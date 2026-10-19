// SYNC CLOUD DELLE PREFERENZE: watchlist, ricerche e scala UI girano DENTRO l'account Google
// (users/{uid}/data/preferenze): le preferenze scelte su un dispositivo arrivano da sole
// agli altri dello stesso account, come il collegamento del server.
//
// Perche' serve un documento a parte: il bundle di sessione (che contiene tutto) viene
// ritagliato per dimensione e parte solo all'uscita dall'app; le preferenze sono piccole
// e cambiano spesso (stellina, ricerca salvata, scala), quindi le segue un documento loro
// dedicato, sempre aggiornato.
//
// Questo test NON cerca una stringa nel sorgente: estrae il blocco marcato dentro app.html
// (quindi prova il codice che e' davvero pubblicato) e lo esegue con magazzino e «nuvola»
// finti: le chiavi arrivano dal test come parametri, sono il contratto con il resto dell'app.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {RADICE} from './aiuti.mjs';

const APP = path.join(RADICE, 'app.html');
const HTML = fs.readFileSync(APP, 'utf8');

function leggiBlocco(){
  const inizio = HTML.indexOf('SYNC PREFERENZE: INIZIO');
  assert.ok(inizio >= 0, "in app.html manca il blocco marcato SYNC PREFERENZE: INIZIO");
  const s = HTML.lastIndexOf('/*', inizio);
  assert.ok(s >= 0 && inizio - s < 60, "il marcatore di apertura non sta dentro un commento /* ... */");
  const fine = HTML.indexOf('SYNC PREFERENZE: FINE', inizio);
  assert.ok(fine > inizio, "in app.html manca il marcatore SYNC PREFERENZE: FINE");
  const e = HTML.indexOf('*/', fine);
  assert.ok(e > fine, "il marcatore di chiusura non sta dentro un commento");
  return HTML.slice(s, e + 2);
}
const BLOCCO = leggiBlocco();

// Le chiavi dei magazzini sono lette dal sorgente per usarle TAL QUALI sul banco: sono il
// contratto con il resto dell'app, non un valore inventato dal test.
function constante(nome){
  const m = HTML.match(new RegExp('const\\s+' + nome + "\\s*=\\s*'([^']+)'"));
  assert.ok(m, 'in app.html manca la costante ' + nome);
  return m[1];
}
const K_WL = constante('FBL_SYNC_WATCHLIST_KEY');
const K_RC = constante('FBL_SYNC_RICERCHE_KEY');
const K_SCALA = constante('FBL_UI_SCALA_KEY');

// Un magazzino finto, stesso comportamento del vero localStorage.
function memoria(){
  const m = new Map();
  return {
    get length(){ return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

// Modalita' privata: ogni accesso viene negato.
const NEGATO = {
  getItem(){ throw new Error('negato'); },
  setItem(){ throw new Error('negato'); },
  removeItem(){ throw new Error('negato'); },
  get length(){ return 0; },
  key(){ return null; },
};

// Esegue il blocco estratto e ritorna le sue funzioni. Le chiavi arrivano in ingresso perche'
// nel sorgente sono dichiarate nello script della pagina, non sul global object.
function funzioni(){
  const f = new Function('FBL_SYNC_WATCHLIST_KEY', 'FBL_SYNC_RICERCHE_KEY', 'FBL_UI_SCALA_KEY',
    BLOCCO + '\nreturn {fblSyncPrepara, fblSyncRicevi, fblSyncPubblica, fblSyncAvvia};');
  return f(K_WL, K_RC, K_SCALA);
}

// La "nuvola": un magazzino condiviso per uid con gli ascoltatori, stesso comportamento di
// setDoc + onSnapshot di Firestore (sparata iniziale + avviso a ogni scrittura).
function nuvola(){
  const documenti = new Map();
  const ascoltatori = new Map();
  return {
    documenti,
    cloud(uid){
      return {
        async preferenzeSalva(payload){
          documenti.set(uid, {...payload});
          for(const cb of (ascoltatori.get(uid) || [])){ try{ cb({...payload}); }catch(e){} }
        },
        preferenzeAscolta(cb){
          if(!ascoltatori.has(uid)) ascoltatori.set(uid, new Set());
          ascoltatori.get(uid).add(cb);
          cb(documenti.has(uid) ? {...documenti.get(uid)} : null);   // spara subito lo stato attuale
          return () => ascoltatori.get(uid).delete(cb);
        },
      };
    },
  };
}

test("il blocco delle preferenze e' JavaScript valido", () => {
  assert.doesNotThrow(() => funzioni(), "il blocco estratto da app.html non si puo' nemmeno istanziare");
});

test("pubblica watchlist, ricerche e scala quando ce n'e' qualcosa", () => {
  const f = funzioni();
  const store = memoria();
  store.setItem(K_WL, JSON.stringify(['EUR/USD', 'BINANCE:BTCUSDT']));
  store.setItem(K_RC, JSON.stringify([{symbol: 'AAPL.US', name: 'Apple', type: 'stock'}]));
  store.setItem(K_SCALA, '120');
  const nv = nuvola();
  assert.equal(f.fblSyncPubblica(nv.cloud('uid-uno'), store), true,
    "il dispositivo ha preferenze ma non pubblica niente: gli altri restano con le loro");
  const doc = nv.documenti.get('uid-uno');
  assert.ok(doc, "il documento delle preferenze non e' arrivato sulla nuvola");
  assert.deepEqual(doc.watchlist, ['EUR/USD', 'BINANCE:BTCUSDT']);
  assert.deepEqual(doc.ricerche, [{symbol: 'AAPL.US', name: 'Apple', type: 'stock'}]);
  assert.equal(doc.scala, 120);
  assert.equal(typeof doc.aggiornato, 'number',
    "senza data non si distingue un documento nuovo da uno rimasto indietro");
});

test("senza preferenze non pubblica niente: un documento vuoto ingannerebbe gli altri", () => {
  const f = funzioni();
  const nv = nuvola();
  assert.equal(f.fblSyncPubblica(nv.cloud('uid-uno'), memoria()), false);
  assert.equal(nv.documenti.size, 0,
    "un documento vuoto sulla nuvola direbbe agli altri dispositivi di tutto togliere");
});

test("il telefono riceve da solo le preferenze: stesso account, nessuna digitazione", () => {
  const f = funzioni();
  const nv = nuvola();
  // Il PC pubblica le sue preferenze (stessa cosa che fa pubblicaPreferenze qui sopra).
  const pc = memoria();
  pc.setItem(K_WL, JSON.stringify(['XAU/USD']));
  pc.setItem(K_RC, JSON.stringify([{symbol: 'TSLA.US', name: 'Tesla', type: 'stock'}]));
  pc.setItem(K_SCALA, '85');
  f.fblSyncPubblica(nv.cloud('uid-uno'), pc);

  // Il telefono, magazzini vuoti, si aggancia allo stesso account.
  const telefono = memoria();
  let arrivato = 0;
  f.fblSyncAvvia(nv.cloud('uid-uno'), telefono, () => arrivato++);
  assert.equal(telefono.getItem(K_WL), JSON.stringify(['XAU/USD']),
    "la watchlist non e' arrivata: il telefono resterebbe con quella vuota");
  assert.equal(telefono.getItem(K_RC), JSON.stringify([{symbol: 'TSLA.US', name: 'Tesla', type: 'stock'}]),
    "le ricerche non sono arrivate: ogni ricerca andrebbe rifatta a ogni riapertura");
  assert.equal(telefono.getItem(K_SCALA), '85',
    "la scala non e' arrivata: il telefono resterebbe con il carattere del computer");
  assert.equal(arrivato, 1, "il segnale delle preferenze non e' partito: l'applicazione non riparte");
});

test("due dispositivi dello stesso account finiscono con le stesse preferenze", () => {
  const f = funzioni();
  const nv = nuvola();
  const pc = memoria();
  pc.setItem(K_WL, JSON.stringify(['GBP/USD']));
  pc.setItem(K_SCALA, '110');
  f.fblSyncPubblica(nv.cloud('uid-uno'), pc);
  const tablet = memoria();
  const telefono = memoria();
  f.fblSyncAvvia(nv.cloud('uid-uno'), tablet, () => {});
  f.fblSyncAvvia(nv.cloud('uid-uno'), telefono, () => {});
  assert.equal(tablet.getItem(K_WL), telefono.getItem(K_WL), "i due dispositivi vedono watchlist diverse");
  assert.equal(tablet.getItem(K_SCALA), telefono.getItem(K_SCALA), "i due dispositivi vedono scale diverse");
  assert.equal(telefono.getItem(K_WL), JSON.stringify(['GBP/USD']));
});

test("il PC cambia una preferenza: gli altri dispositivi la seguono senza scrivere niente", () => {
  const f = funzioni();
  const nv = nuvola();
  const telefono = memoria();
  let arrivati = 0;
  f.fblSyncAvvia(nv.cloud('uid-uno'), telefono, () => arrivati++);
  assert.equal(telefono.getItem(K_WL), null, "prima del PC il telefono non puo' avere la watchlist");
  const pc = memoria();
  pc.setItem(K_WL, JSON.stringify(['prima']));
  f.fblSyncPubblica(nv.cloud('uid-uno'), pc);
  assert.equal(telefono.getItem(K_WL), JSON.stringify(['prima']));
  pc.setItem(K_WL, JSON.stringify(['seconda']));
  f.fblSyncPubblica(nv.cloud('uid-uno'), pc);
  assert.equal(telefono.getItem(K_WL), JSON.stringify(['seconda']),
    "il telefono resta con la watchlist vecchia e non vede mai quella nuova");
  assert.equal(arrivati, 2, "ogni aggiornamento deve riaccendere il segnale delle preferenze");
});

test("un documento difettoso viene rifiutato e il magazzino resta come prima", () => {
  const f = funzioni();
  const cattivi = [
    {nome: 'documento assente', d: null},
    {nome: 'oggetto vuoto', d: {}},
    {nome: 'watchlist non e\' un elenco', d: {watchlist: 'EUR/USD'}},
    {nome: 'niente di valido nel documento', d: {watchlist: 42, ricerche: 'mm', scala: 'x'}},
    {nome: 'troppi asset in watchlist', d: {watchlist: Array.from({length: 11}, (_, i) => 'A' + i), ricerche: 99, scala: 999}},
    {nome: 'ricerca senza symbol', d: {ricerche: [{name: 'Apple'}]}},
    {nome: 'ricerca con symbol non valido', d: {ricerche: [{symbol: '***'}]}},
    {nome: 'scala fuori misura', d: {scala: 999}},
    {nome: 'scala non e\' un numero', d: {scala: '120'}},
  ];
  for(const {nome, d} of cattivi){
    const store = memoria();
    store.setItem(K_WL, JSON.stringify(['vecchia']));
    store.setItem(K_SCALA, '100');
    assert.equal(f.fblSyncRicevi(d, store), false, nome + ': non deve essere accettato');
    assert.equal(store.getItem(K_WL), JSON.stringify(['vecchia']), nome + ": ha toccato la watchlist gia' salvata");
    assert.equal(store.getItem(K_SCALA), '100', nome + ': ha cancellata la scala buona');
  }
});

test("i documenti difettosi non accendono il segnale delle preferenze", () => {
  const f = funzioni();
  const nv = nuvola();
  const telefono = memoria();
  let arrivati = 0;
  const cloud = nv.cloud('uid-uno');   // ascolta PRIMA che la nuvola abbia documenti
  f.fblSyncAvvia(cloud, telefono, () => arrivati++);
  assert.equal(arrivati, 0, "la nuvola era vuota: nessun segnale poteva esserci");
  cloud.preferenzeSalva({scala: 999});   // arriva un documento rotto
  assert.equal(arrivati, 0, "un documento non valido non deve far credere che le preferenze ci siano");
  assert.equal(telefono.getItem(K_SCALA), null);
});

test("una nuvola che non sa parlare non blocca l'avvio dell'app", () => {
  const f = funzioni();
  assert.equal(f.fblSyncPubblica({}, memoria()), false);
  assert.equal(f.fblSyncPubblica(null, memoria()), false);
  assert.equal(f.fblSyncAvvia({}, memoria(), () => { throw new Error('non deve chiamare'); }), null);
  assert.equal(f.fblSyncAvvia(null, memoria(), null), null);
});

test("modalita' privata (localStorage negato): nessun errore", () => {
  const f = funzioni();
  assert.equal(f.fblSyncPrepara(NEGATO), null,
    "con la memoria negata non si puo' decidere cosa pubblicare");
  assert.equal(f.fblSyncRicevi({watchlist: ['EUR/USD']}, NEGATO), false);
  const nv = nuvola();
  nv.documenti.set('uid', {watchlist: ['EUR/USD']});
  assert.equal(f.fblSyncPubblica(nv.cloud('uid'), NEGATO), false,
    "senza leggere il proprio magazzino non si pubblica un valore a caso");
  let chiamato = false;
  const r = f.fblSyncAvvia(nv.cloud('uid'), NEGATO, () => { chiamato = true; });
  assert.equal(typeof r, 'function', "l'ascolto deve comunque partire e potersi sbloccare");
  assert.equal(chiamato, false, "il magazzino era negato: il segnale non deve mentire");
});
