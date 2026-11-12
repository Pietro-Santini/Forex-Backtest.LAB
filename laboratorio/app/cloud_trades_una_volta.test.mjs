// OGNI OPERAZIONE CHIUSA SI PAGA UNA VOLTA SOLA.
//
// SEGNALATO dal proprietario con i numeri del suo pannello prestazioni (11 novembre 2026):
//   cloudTradesInviati: 3469 | cloudScritture: 6 | operazioni: 1138
// `fblCloudTradesInviati` si alza SOLO dopo una scrittura riuscita, di `tradesNuovi.length`
// (app.html riga 10076), e vive in memoria: 3469 invii per 1138 operazioni in SEI
// sincronizzazioni vuol dire che ogni operazione e' partita circa tre volte, nella stessa
// pagina aperta. Firestore si paga a BANDA (bolletta di ottobre: 43,86 GiB in uscita, 3,57
// euro, e il gratuito e' 10 GiB/mese), quindi rimandare lo storico sono soldi.
//
// PERCHE' UN SIMULATORE DI FIRESTORE E NON LE SOLITE SPIE: i banchi che c'erano
// (cloud_incrementale.test.mjs) sostituiscono `tradesConteggio` con un numero FISSO - 750, 1,
// 0 - quindi non provano mai il giro vero: scrivi il documento, lo rileggi, e il conteggio che
// torna decide quali operazioni sono "nuove". Il difetto sta proprio in quel giro, ed e' per
// questo che nessun test lo vedeva. Qui il modulo Firebase del CDN viene sostituito da un
// simulatore che rispetta le regole DOCUMENTATE di Firestore, e il codice dell'app - sia
// `syncFullStatusToFirebase`, sia i metodi veri `tradesAggiungi`/`tradesLeggi`/`tradesConteggio`
// del modulo cloud - gira senza una riga finta.
//
// LE REGOLE DI FIRESTORE CHE IL SIMULATORE RISPETTA (riferimento: Firestore API, messaggio
// `Write` e `DocumentTransform.FieldTransform`):
//   1. `setDoc(ref, dati)` SENZA `{merge:true}` SOSTITUISCE il documento: quello che c'era
//      prima e non e' nei dati nuovi smette di esistere.
//   2. `setDoc(ref, dati, {merge:true})` fonde campo per campo e lascia stare il resto.
//   3. le sentinelle (`arrayUnion`, `serverTimestamp`) non sono dati: viaggiano a parte come
//      trasformazioni e si applicano DOPO il passo 1 o 2, sul valore che il campo ha in quel
//      momento. `arrayUnion` su un campo che non c'e' parte dall'array VUOTO.
//   La regola 1 piu' la regola 3 sono il difetto: un `setDoc` senza merge con `arrayUnion`
//   non aggiunge in coda, RIFA' la lista con le sole operazioni appena mandate.
// Il primo test qui sotto prova il simulatore su queste regole, a vista: se un domani la
// semantica cambiasse, cade quello e si sa subito dove guardare.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const FIRESTORE_SIMULATO = `
// Il magazzino: percorso del documento -> contenuto. E il registro di quello che si paga:
// byte scritti e byte letti, documento per documento.
//
// UN REGISTRO SOLO, E CONDIVISO. La rotta del banco risponde con QUESTO stesso testo a tutte
// e quattro le import di Firebase (app, auth, firestore, functions): sono quattro URL diversi,
// quindi il browser crea quattro istanze del modulo. Col registro dichiarato qui dentro ognuna
// aveva il SUO, l'app scriveva nel registro dell'una e il test guardava quello dell'altra: la
// prima versione di questo banco misurava zero byte e zero letture su un'app che stava
// scrivendo. Si prende quello che c'e' gia' su globalThis, e si crea solo la prima volta.
const FS = globalThis.__FS || (globalThis.__FS =
  { docs:{}, scritture:[], letture:[], guastaLetture:null });

const copia = (x) => (x===undefined ? undefined : JSON.parse(JSON.stringify(x)));
const uguali = (a,b) => JSON.stringify(a)===JSON.stringify(b);

export const initializeApp = () => ({name:'banco'});
export const getAuth = () => ({});
export const onAuthStateChanged = () => () => {};
export const onIdTokenChanged = () => () => {};
export const signOut = async () => {};
export const getFirestore = () => ({});
export const onSnapshot = () => () => {};
export const getFunctions = () => ({});
export const httpsCallable = () => async () => ({data:{}});
// doc(db,"users",uid,"data","trades") -> "users/<uid>/data/trades"
export const doc = (...a) => ({__percorso: a.slice(1).join('/')});
// Le due sentinelle: NON sono valori, sono trasformazioni (regola 3).
export const serverTimestamp = () => ({__sentinella:'ora'});
export const arrayUnion = (...valori) => ({__sentinella:'unione', valori: valori});

// Separa i dati veri dalle sentinelle, come fa l'SDK prima di spedire.
function separa(dati, trasformazioni, prefisso){
  const puro = {};
  Object.keys(dati||{}).forEach(k=>{
    const v = dati[k];
    if(v && typeof v==='object' && v.__sentinella){
      trasformazioni.push({percorso: prefisso.concat([k]), tipo: v.__sentinella, valori: v.valori});
      return;
    }
    if(v && typeof v==='object' && !Array.isArray(v)){
      puro[k] = separa(v, trasformazioni, prefisso.concat([k]));
      return;
    }
    puro[k] = copia(v);
  });
  return puro;
}
function fondi(base, parti){
  Object.keys(parti||{}).forEach(k=>{
    const v = parti[k];
    if(v && typeof v==='object' && !Array.isArray(v)){
      if(!base[k] || typeof base[k]!=='object' || Array.isArray(base[k])) base[k] = {};
      fondi(base[k], v);
    } else base[k] = copia(v);
  });
  return base;
}
function leggiPercorso(documento, percorso){
  let n = documento;
  for(const p of percorso){ if(!n || typeof n!=='object') return undefined; n = n[p]; }
  return n;
}
function scriviPercorso(documento, percorso, valore){
  let n = documento;
  for(let i=0;i<percorso.length-1;i++){
    const p = percorso[i];
    if(!n[p] || typeof n[p]!=='object') n[p] = {};
    n = n[p];
  }
  n[percorso[percorso.length-1]] = valore;
}
function applica(documento, t){
  if(t.tipo==='ora'){ scriviPercorso(documento, t.percorso, Date.now()); return; }
  // arrayUnion: si parte dal valore che il campo ha ADESSO - cioe' DOPO la sostituzione o la
  // fusione. Se non c'e', si parte dall'array vuoto (regola 3).
  const attuale = leggiPercorso(documento, t.percorso);
  const base = Array.isArray(attuale) ? attuale.slice() : [];
  (t.valori||[]).forEach(v=>{ if(!base.some(x=>uguali(x,v))) base.push(copia(v)); });
  scriviPercorso(documento, t.percorso, base);
}
export async function setDoc(ref, dati, opzioni){
  const chiave = ref.__percorso;
  const trasformazioni = [];
  const puro = separa(dati, trasformazioni, []);
  const merge = !!(opzioni && opzioni.merge);
  const dopo = merge ? fondi(copia(FS.docs[chiave]) || {}, puro) : puro;
  trasformazioni.forEach(t=>applica(dopo, t));
  FS.docs[chiave] = dopo;
  // I BYTE CHE PARTONO DAVVERO: il pacchetto spedito, non il documento sul server. Le
  // sentinelle pesano quanto i loro elementi (arrayUnion manda gli elementi nuovi).
  let byte = 0;
  try{
    byte = JSON.stringify(dati, (k,v)=> (v && typeof v==='object' && v.__sentinella)
      ? (v.valori!==undefined ? v.valori : 0) : v).length;
  }catch(e){ byte = 0; }
  const uniti = trasformazioni.filter(t=>t.tipo==='unione')
    .reduce((s,t)=>s+((t.valori&&t.valori.length)||0),0);
  FS.scritture.push({documento:chiave, merge:merge, byte:byte, elementiUniti:uniti});
}
export async function getDoc(ref){
  const chiave = ref.__percorso;
  if(FS.guastaLetture && chiave.indexOf(FS.guastaLetture)>=0){
    FS.letture.push({documento:chiave, byte:0, guasto:true});
    throw new Error('banco: lettura di '+chiave+' non riuscita (rete che non risponde)');
  }
  const d = FS.docs[chiave];
  let byte = 0; try{ byte = d ? JSON.stringify(d).length : 0; }catch(e){ byte = 0; }
  FS.letture.push({documento:chiave, byte:byte});
  return { exists: ()=> !!d, data: ()=> copia(d) };
}
`;

async function firestoreSimulato(pagina){
  await pagina.route('**/firebasejs/**', r => r.fulfill({status:200,
    contentType:'text/javascript', body:FIRESTORE_SIMULATO}));
}

// Lo stato dell'app ridotto all'essenziale della misura: le operazioni chiuse e nulla che
// faccia altro lavoro durante la prova. `trades` e' il globale vero che l'app salva.
const PREPARA = () => {
  window.fxbtCloud.uid = 'UTENTE-DI-PROVA';
  fblCloudUltimaFirma = null; fblCloudFirmeCampi = null;
  fblCloudScritture = 0; fblCloudSaltate = 0; fblCloudTradesInviati = 0;
  lastFirebaseSyncAt = 0;
  // "Pagina appena aperta": il conto delle operazioni che stanno sul cloud non si sa ancora.
  fblCloudTradesGiaSuCloud = {uid:null, n:-1};
  trades = [];
  // Il tetto giornaliero del cloud non deve entrare nella misura: il banco riparte da zero.
  try{ localStorage.removeItem('fbl_cloud_budget_giorno'); }catch(e){}
  window.fxbtCloud._budget = {giorno:null, conta:{}, totale:0, avvisato:false};
  // Si manda esattamente lo storico operazioni corrente, senza toccare disco e grafico.
  saveLightStateToLocalStorageNow = () => ({version: SESSION_VERSION, trades: trades.slice(), posizioni: []});
  captureCurrentAssetChartView = () => {};
  flushAssetChartViewsPersist = async () => {};
  footprintCollectCloudAggregate = () => ({});
  // Una operazione chiusa come quelle vere (~259 byte), col suo identificativo.
  window.__chiudi = (quante) => {
    for(let i=0;i<quante;i++){
      const n = trades.length;
      trades.push({id:'t'+n, side: n%2 ? 'BUY':'SELL', asset:'XAUUSD',
        entry: 4000+(n%100), exit: 4000+(n%100)+(n%2?5:-5), lots:0.1,
        pl: n%2 ? 12.5 : -9.75, openTime: 1700000000000+n*3600000,
        closeTime: 1700003600000+n*3600000,
        tgSala: n%3 ? 'PipHunter':'GoldSignals', tgSegnaleId:'s'+(n%40)});
    }
  };
  // Il conto di quello che si paga sul documento delle operazioni.
  window.__conto = () => {
    const FS = window.__FS;
    const soloTrades = (x) => x.documento.indexOf('/data/trades')>=0;
    const lista = (FS.docs['users/UTENTE-DI-PROVA/data/trades']||{}).lista || [];
    return {
      invii: fblCloudTradesInviati,
      elementiSpediti: FS.scritture.filter(soloTrades).reduce((s,w)=>s+w.elementiUniti,0),
      scrittureTrades: FS.scritture.filter(soloTrades).length,
      byteScrittiTrades: FS.scritture.filter(soloTrades).reduce((s,w)=>s+w.byte,0),
      byteLettiTrades: FS.letture.filter(soloTrades).reduce((s,r)=>s+r.byte,0),
      lettureTrades: FS.letture.filter(soloTrades).length,
      senzaMerge: FS.scritture.filter(soloTrades).filter(w=>!w.merge).length,
      sulCloud: lista.length,
      idSulCloud: lista.map(t=>t.id),
      inMemoria: trades.length,
    };
  };
};

test('il simulatore rispetta le regole di Firestore (sostituzione, fusione, arrayUnion)', async () => {
  const {browser, pagina, errori} = await apriApp({primaDiNavigare: firestoreSimulato});
  try{
    const r = await pagina.evaluate(async () => {
      const m = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
      const FS = window.__FS;
      const rif = m.doc({}, 'prova', 'uno');
      // 1) senza merge, con arrayUnion: la lista parte dal vuoto ogni volta.
      await m.setDoc(rif, {v:1, lista: m.arrayUnion('a','b')});
      const dopoPrima = FS.docs['prova/uno'].lista.slice();
      await m.setDoc(rif, {v:1, lista: m.arrayUnion('c')});
      const senzaMerge = FS.docs['prova/uno'].lista.slice();
      // 2) con merge, con arrayUnion: si aggiunge in coda e non si duplica.
      FS.docs = {};
      await m.setDoc(rif, {v:1, lista: m.arrayUnion('a','b')}, {merge:true});
      await m.setDoc(rif, {v:1, lista: m.arrayUnion('b','c')}, {merge:true});
      const conMerge = FS.docs['prova/uno'].lista.slice();
      // 3) senza merge, un campo non ripetuto scompare.
      FS.docs = {};
      await m.setDoc(rif, {a:1, b:2});
      await m.setDoc(rif, {a:9});
      const sostituito = JSON.stringify(FS.docs['prova/uno']);
      return {dopoPrima, senzaMerge, conMerge, sostituito};
    });
    assert.deepEqual(r.dopoPrima, ['a','b'], 'la prima scrittura crea la lista');
    assert.deepEqual(r.senzaMerge, ['c'],
      'REGOLA 1+3: una setDoc senza merge rifa\' il documento, quindi arrayUnion riparte dal vuoto');
    assert.deepEqual(r.conMerge, ['a','b','c'],
      'REGOLA 2+3: con merge:true arrayUnion aggiunge in coda e non duplica');
    assert.equal(r.sostituito, '{"a":9}', 'senza merge i campi non ripetuti scompaiono');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ogni operazione chiusa si manda UNA volta sola', async () => {
  const {browser, pagina, errori} = await apriApp({primaDiNavigare: firestoreSimulato});
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      // Lo storico di partenza: venti operazioni chiuse prima di questa sessione.
      window.__chiudi(20);
      await syncFullStatusToFirebase('banco: primo salvataggio', true);
      const dopoIlPrimo = window.__conto();
      // Poi sei salvataggi, con due operazioni chiuse ogni volta: e' la giornata del
      // proprietario in piccolo (lui ne ha 1138 e sei salvataggi).
      for(let giro=0; giro<6; giro++){
        window.__chiudi(2);
        await syncFullStatusToFirebase('banco: giro '+giro, true);
      }
      return {dopoIlPrimo, fine: window.__conto()};
    }, PREPARA.toString());

    const f = r.fine;
    console.log('AVVISO operazioni in memoria =', f.inMemoria,
      '| invii contati dall\'app =', f.invii,
      '| elementi arrivati al documento =', f.elementiSpediti,
      '| byte scritti =', f.byteScrittiTrades,
      '| byte letti per contare =', f.byteLettiTrades,
      '| letture =', f.lettureTrades,
      '| scritture senza merge =', f.senzaMerge,
      '| operazioni rimaste sul cloud =', f.sulCloud);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');

    // LA MISURA CHE CONTA: 32 operazioni chiuse, 32 invii. Nemmeno uno in piu'.
    assert.equal(f.inMemoria, 32, 'il banco chiude 20 + 6x2 = 32 operazioni');
    assert.equal(f.invii, 32,
      'ogni operazione si manda UNA volta: ' + f.invii + ' invii per 32 operazioni');
    assert.equal(f.elementiSpediti, 32,
      'e gli elementi arrivati davvero al documento sono gli stessi: ' + f.elementiSpediti);
    // E NON SI PERDE NIENTE: il documento sul cloud deve contenerle tutte, una volta ciascuna.
    assert.equal(f.sulCloud, 32,
      'il documento delle operazioni deve contenerle tutte e 32, non solo le ultime: ' + f.sulCloud);
    assert.equal(new Set(f.idSulCloud).size, f.idSulCloud.length,
      'nessun doppione nel documento sul cloud');
    // Il costo in byte: le 32 operazioni pesano ~8 KB. Tre volte tanto e' la bolletta che
    // segnalava il proprietario.
    assert.ok(f.byteScrittiTrades < 32*400,
      'i byte scritti devono essere quelli delle 32 operazioni, non dello storico rimandato: '
      + f.byteScrittiTrades);
    // E IL CONTEGGIO NON SI RICOMPRA A OGNI SALVATAGGIO. Rileggere il documento per contare
    // costa, in banda, quanto tutto lo storico: nel banco erano 7 letture e 27,5 KB per sette
    // numeri, e sul computer del proprietario una lettura e' ~295 KB. Una per pagina basta.
    assert.equal(f.lettureTrades, 1,
      'il documento delle operazioni si rilegge UNA volta per pagina, non a ogni salvataggio: '
      + f.lettureTrades + ' letture');
    assert.ok(f.byteLettiTrades < 32*400,
      'e quella lettura non deve crescere con lo storico piu del necessario: '
      + f.byteLettiTrades + ' byte');
  } finally { await browser.close(); }
});

test('se la lettura del conteggio non riesce, lo storico NON si rimanda', async () => {
  // L'ALTRA META' DEL DIFETTO: `tradesConteggio()` tornava 0 anche quando la lettura FALLIVA
  // (rete assente, permesso negato), perche' `tradesLeggi()` risponde `null` sia per
  // "documento mai scritto" sia per "non ho potuto leggere". Zero vuol dire "sul cloud non
  // c'e' niente", quindi l'app rimandava TUTTO lo storico. Qui si guasta la lettura e si
  // guarda: non deve partire una sola operazione in piu'.
  const {browser, pagina, errori} = await apriApp({primaDiNavigare: firestoreSimulato});
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      window.__chiudi(30);
      await syncFullStatusToFirebase('banco: storico sul cloud', true);
      const prima = window.__conto();
      // Da qui la rete non risponde piu' sul documento delle operazioni, e il conto non si
      // sa (e' la condizione di una pagina appena aperta: e' allora che si legge davvero).
      window.__FS.guastaLetture = '/data/trades';
      fblCloudTradesGiaSuCloud = {uid:null, n:-1};
      fblCloudUltimaFirma = null;   // qualcosa e' cambiato: il salvataggio deve partire
      window.__chiudi(1);
      // La PROVA DI CONTROLLO, e serve: "non si rimanda lo storico" si puo' rispettare anche
      // non salvando NIENTE, che e' molto peggio. La fotografia intera deve partire.
      const foto = [];
      const saveVero = window.fxbtCloud.save;
      window.fxbtCloud.save = async (f) => { foto.push(Array.isArray(f&&f.trades)?f.trades.length:null); return saveVero.call(window.fxbtCloud, f); };
      await syncFullStatusToFirebase('banco: lettura guasta', true);
      window.fxbtCloud.save = saveVero;
      const dopo = window.__conto();
      return {prima, dopo, foto};
    }, PREPARA.toString());

    console.log('AVVISO con la lettura guasta: invii prima =', r.prima.invii,
      '| invii dopo =', r.dopo.invii, '| in memoria =', r.dopo.inMemoria,
      '| operazioni dentro la fotografia di ricaduta =', JSON.stringify(r.foto));
    assert.deepEqual(errori, [], 'una lettura che non riesce non deve lasciare errori JS in pagina');
    assert.equal(r.prima.invii, 30, 'lo storico parte una volta');
    assert.ok(r.dopo.invii <= 31,
      'con la lettura guasta non si rimanda lo storico: ' + r.dopo.invii + ' invii su 31 operazioni');
    assert.deepEqual(r.foto, [31],
      'e la rete di sicurezza deve davvero scattare: una fotografia intera con tutte e 31 le '
      + 'operazioni dentro, non un salvataggio che non fa niente. Visto: ' + JSON.stringify(r.foto));
  } finally { await browser.close(); }
});

test('la ricaduta funziona anche col cloud nostro acceso (fotografia intera, niente abort)', async () => {
  // LA STRADA CHE IL PROPRIETARIO PERCORRE DAVVERO. Col cloud nostro acceso (dal 4 novembre
  // 2026 i suoi dati stanno sul disco del suo PC) la ricaduta leggeva due variabili dichiarate
  // piu' SOTTO nella stessa funzione: ReferenceError, quindi la copia della sessione sul
  // server non partiva e il salvataggio si fermava li'. La ricaduta e' la rete di sicurezza di
  // tutto il salvataggio incrementale: se si rompe lei, non si accorge nessuno.
  const {browser, pagina, errori} = await apriApp({primaDiNavigare: firestoreSimulato});
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      fblCloudNostro = () => true;            // il cloud nostro acceso, come sul suo computer
      const visti = {server:[], serverTrades:0, foto:null};
      window.fxbtCloud.serverDatiScrivi = async (nome, dato) => {
        visti.server.push({nome, operazioni: Array.isArray(dato&&dato.trades)?dato.trades.length:null});
        return true;
      };
      window.fxbtCloud.serverTradesAggiungi = async () => { visti.serverTrades++; return true; };
      window.fxbtCloud.save = async (foto) => {
        visti.foto = Array.isArray(foto&&foto.trades) ? foto.trades.length : null; return true;
      };
      window.__chiudi(12);
      window.__FS.guastaLetture = '/data/trades';   // il conteggio non si sa: si ricade
      await syncFullStatusToFirebase('banco: ricaduta col cloud nostro', true);
      return {visti, conto: window.__conto()};
    }, PREPARA.toString());

    console.log('AVVISO ricaduta: documenti mandati al server =', JSON.stringify(r.visti.server),
      '| operazioni nella fotografia =', r.visti.foto, '| invii al documento separato =', r.conto.invii);
    assert.deepEqual(errori, [],
      'la ricaduta non deve lasciare errori JS in pagina (era un ReferenceError su trimmedBundle/tradesNuovi)');
    assert.equal(r.visti.foto, 12,
      'nella ricaduta le operazioni viaggiano DENTRO la fotografia intera');
    assert.deepEqual(r.visti.server.map(x=>x.nome), ['session'],
      'e la stessa fotografia deve arrivare al server nostro: ' + JSON.stringify(r.visti.server));
    assert.equal(r.visti.server[0].operazioni, 12,
      'col le operazioni dentro, non una sessione senza storico');
    assert.equal(r.conto.invii, 0,
      'nella ricaduta non si manda niente al documento separato: ' + r.conto.invii);
  } finally { await browser.close(); }
});
