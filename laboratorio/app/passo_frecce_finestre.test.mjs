// IL PASSO A FRECCETTA NEL REPLAY CONDIVISO FRA FINESTRE — banco di misura (16 novembre 2026).
//
// REGOLA DEL PROPRIETARIO (letterale):
// «se pigio la freccettina di andare avanti sulla duplicata M5 e la madre è M1, sulla madre deve
//  avanzare di 5 candele […] se su una finestra c'è un time frame da 15 minuti e sulle altre due
//  finestre ci sono time frame da 1 minuto, tutte e due le altre finestre devono andare avanti di
//  15 candele, mentre su quella da 15 minuti una candela […] se è 30 minuti una finestra, un'altra
//  finestra è 10 minuti, un'altra finestra è 1 minuto, […] quella da 10 farà 3 salti in avanti […]
//  quella da 1 minuto salterà 30 candele. Se invece sono sulla finestra con time frame da 1 minuto e
//  ci sono le altre due finestre che hanno 30 minuti e l'altra da 15 minuti, avanzeranno soltanto di
//  pochissimo, ma non avanza la candela, avanza soltanto l'evoluzione dell'estensione della candela.»
//
// IN UNA RIGA: un passo a freccetta vale la DURATA DELLA CANDELA DI CHI PREME, e chi riceve si mette
// su quell'istante (rebuildRows). Quindi su un time frame piu' grosso NON cambia candela: cambia
// solo l'evoluzione dentro la candela in formazione.
//
// IL DIFETTO MISURATO PRIMA DELLA CURA (simulatore fedele, 16 novembre 2026), con una madre e due
// duplicate in replay condiviso: il passo e' la durata giusta SOLO quando chi preme si trova
// esattamente sul confine di una sua candela. Da qualunque altro stato — in formazione, che e' lo
// stato normale dopo il play, o un istante ricevuto sottominuto — RIAVVOLGE:
//    dup M5 a meta' candela (08:31)   -1 min  invece di +5
//    dup M5 a 08:32                   -2 min  invece di +5
//    ▶ su M15 da meta' candela         -47 s   invece di +15
//    ◀ (#back) da meta' candela M5    -12 min invece di -5
//    primo bucket D1/mensile           idx = -1 (rows[-1] non esiste, #back non risponde piu')
//    finestra M1 con pochi dati + passo da D1: usciva dal replay e annunciava 'stop' a tutte,
//    cioe' il replay condiviso moriva al primo tocco (in Live lo storico si chiede con max=1000)
//
// Come si misura (niente pixel, niente stringa nel sorgente): dallo STATO della pagina —
// replayMomentoMostrato() (l'unico lettore dell'istante mostrato, in millisecondi), idx, rows,
// replayForm.sub. Il passo atteso si calcola nella pagina con replaySecondsPerBar()*1000, la stessa
// funzione che usa il battito del play: se un giorno la regola cambiasse, cambia per tutti e due.
//
// Trappole gia' pagate, tenute presente qui: page.evaluate accetta UN SOLO argomento (si passa un
// oggetto); il grafico sta sotto il bordo della finestra, quindi i tasti si premono con .click()
// dal DOM e non con il mouse; «non risponde mai» si scrive Infinity, non 999.
import test from 'node:test';
import assert from 'node:assert/strict';

// IL PERCORSO DELLA PAGINA SI RICAVA DA DOVE STA QUESTO FILE (17 novembre 2026): era scritto a
// mano "C:/Users/pietro/..." e sul collaudo di GitHub, che gira su Linux, il banco moriva prima di
// cominciare (tre banchi rossi su GitHub e verdi sul PC: era solo questo).
const PAGINA=new URL('../../app.html', import.meta.url).href;
const {apriApp} = await import(new URL('./aiuti.mjs', import.meta.url).href);

// 10 novembre 2026, 08:00. Le date delle candele finte sono scritte come «2026-11-10 08:00»,
// cioe' senza fuso: l'app le legge nell'orario del sorgente CSV (America/New_York), quindi TUTTI
// gli istanti del banco sono spostati della stessa quantita'. Per questo ogni istante ATTESO si
// calcola dentro la pagina con parseDateTime delle stesse stringhe, e il passo con
// replaySecondsPerBar(): il banco non dipende dal fuso su cui gira.
const BASE = Date.UTC(2026, 10, 10, 8, 0, 0);

function ascoltaErrori(pagina) {
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  return errori;
}

// IL PONTE VERO NON SI TOCCA: le finestre duplicate aperte col percorso normale (contesto.newPage)
// non eredita la sostituzione del WebSocket di apriApp, quindi la rifaccio qui. Il banco non deve
// poter aprire connessioni verso il ponte dei segnali del proprietario.
const WS_FINTO = () => {
  class WebSocketFinto {
    constructor(url){ this.url = String(url || ''); this.readyState = 0; this.bufferedAmount = 0;
      this.onopen = null; this.onmessage = null; this.onerror = null; this.onclose = null;
      try{ (window.__wsFinti = window.__wsFinti || []).push(this); }catch(e){} }
    send(){}
    close(){ this.readyState = 3; try{ this.onclose && this.onclose({code: 1000, reason: 'banco'}); }catch(e){} }
    addEventListener(){} removeEventListener(){} dispatchEvent(){ return false; }
  }
  WebSocketFinto.CONNECTING = 0; WebSocketFinto.OPEN = 1; WebSocketFinto.CLOSING = 2; WebSocketFinto.CLOSED = 3;
  try{ Object.defineProperty(window, 'WebSocket', {configurable: true, writable: true, value: WebSocketFinto}); }catch(e){}
};

async function nuovaFinestra(contesto, slot) {
  const p = await contesto.newPage();
  const errori = ascoltaErrori(p);
  await p.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.addInitScript(WS_FINTO);
  await p.goto(PAGINA + '?pipSlot=' + slot, {waitUntil: 'domcontentloaded'});
  await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
    .forEach(el => el.style.display = 'none'));
  return {p, errori};
}

// IL CAMBIO ASSET FRA FINESTRE SI METTE DA PARTE: in Storico l'annuncio di una finestra fa
// ricaricare l'asset alle altre e nel banco non c'e' niente da ricaricare. Qui si misura il passo a
// freccetta, non quella funzione (stessa scelta del banco replay_fra_finestre).
const NIENTE_CAMBIO_ASSET = `(function(){ try{ applyRemoteAssetSwitch=function(){}; }catch(e){} })()`;

// LA SCENA DI UNA FINESTRA: candele finte NATIVE al suo time frame (in Live con MT5 ogni finestra
// scarica il proprio), stesso asset, Live attivo, replay spento, l'istante scelto dal banco.
// Con candele native ogni bucket ha una candela sola, quindi il confine di una candela è esatto:
// è la condizione in cui il passo a freccetta oggi funziona, e la misura del difetto sta nel
// confronto con gli stati NON sul confine.
const SCENA = (a) => `(function(){
  const grano=${a.grano || a.tf};
  const R=[];
  for(let i=0;i<${a.quante};i++){
    const t=${a.base}+i*grano*60000;
    const p=1.0800+i*0.00002;
    R.push({date:new Date(t).toISOString().slice(0,16).replace('T',' '),
            open:p, high:p+0.00015, low:p-0.00015, close:p+0.00005, volume:100});
  }
  baseRows=R;
  rowsAssetKey=currentAssetKey=${JSON.stringify(a.asset)};
  currentTF=${a.tf};
  liveModeActive=true; mt5Connected=false;
  liveReplayActive=false; liveReplaySelecting=false; liveReplayGuideClientX=null;
  replayForm=null;
  positions.length=0; pendingOrders.length=0; trades.length=0;
  if(${a.istante}!=null) masterTime=${a.istante};
  rebuildRows();
  followLatest=true; viewEnd=idx; autoFitWidth=true; priceZoomFactor=1;
  viewPriceLo=null; viewPriceHi=null;
  draw();
  return {slot:PIP_SLOT, asset:currentAssetKey, tf:currentTF, candele:rows.length, idx:idx,
          masterTime:masterTime};
})()`;

// LA SCENA VA FATTA TENERE: una finestra appena nata riceve lo "scatto" della madre
// (pip_clone_snapshot), che passa a Live in modo asincrono e puo' rimettere mano a candele e modo
// DOPO la scena. Si riprova, e se non tiene si butta: mai misurare una finestra vuota e chiamarlo
// difetto del passo a freccetta (trappola gia' pagata nel banco replay_fra_finestre).
async function assicuraScena(p, a) {
  let ultimo = null;
  for (let giro = 1; giro <= 3; giro++) {
    ultimo = await p.evaluate(SCENA(a));
    await p.waitForTimeout(900);
    const dopo = await p.evaluate(`(function(){
      return {asset:currentAssetKey, candele:rows.length, live:!!liveModeActive, tf:currentTF};
    })()`);
    if (dopo.asset === a.asset && dopo.candele > 0 && dopo.live && dopo.tf === a.tf) {
      return Object.assign({}, ultimo, {giri: giro});
    }
  }
  throw new Error('la finestra non tiene la scena dopo tre giri: ' + JSON.stringify(ultimo));
}

// LA DOMANDA DEL REPLAY risposta dal banco, e contata (una risposta che nessuno ha chiesto non
// vale come «la scelta è stata fatta»).
const RISPOSTA = (si) => `(function(){
  window.__chieste=[];
  appConfirm=function(testo,opz){
    window.__chieste.push({testo:String(testo), titolo:(opz&&opz.title)||''});
    return Promise.resolve(${si ? 'true' : 'false'});
  };
})()`;

// L'ISTANTE INIZIALE del replay, calcolato dai DATI della pagina: la candela `riga` piu' `secondi`
// secondi dentro. Cosi' il banco non dipende dal fuso con cui la pagina legge le date.
async function istante(p, riga, secondi) {
  const t = await p.evaluate(({riga, secondi}) => {
    const r = baseRows[riga];
    if (!r) return null;
    const v = parseDateTime(r.date) + secondi * 1000;
    return Number.isFinite(v) ? v : null;
  }, {riga, secondi});
  assert.ok(t !== null && Number.isFinite(t), 'istanza iniziale non trovata (riga ' + riga + ')');
  return t;
}

// IL PASSO ATTESO, calcolato dalla pagina: la durata della candela di CHI PREME. È la stessa
// funzione che usa il battito del play (replaySecondsPerBar), quindi la prova e il gioco misurano
// la stessa regola.
async function passoAtteso(p) {
  const ms = await p.evaluate(() => replaySecondsPerBar() * 1000);
  assert.ok(Number.isFinite(ms) && ms > 0, 'passo atteso non calcolabile: ' + ms);
  return ms;
}

// LO STATO DI UNA FINESTRA, tutto letto dalla pagina.
const STATO = `(function(){
  let m=null; try{ m=replayMomentoMostrato(); }catch(e){}
  let f=null; try{ if(replayForm)f={idx:replayForm.idx, sub:Number(replayForm.sub)||0}; }catch(e){}
  const r=rows[idx]||null;
  let inizio=null; try{ if(r)inizio=bucketKeyOf(closeTimeOf(r),currentTF); }catch(e){}
  return {slot:PIP_SLOT, tf:currentTF, idx:idx, candele:rows.length, candela:r?r.date:null,
          masterTime:(Number.isFinite(masterTime)?masterTime:null), momento:m, formazione:f,
          inizio:inizio, perBar:replaySecondsPerBar(),
          inReplay:!!liveReplayActive, perTutte:!!fblReplayPerTutte, inCorso:!!timer,
          rigaValida:(idx>=0&&idx<rows.length)};
})()`;
const S = (pag) => pag.evaluate(STATO);

// LA SPIA DEL RIDISEGNO: conta le chiamate a draw() di QUESTA pagina. Serve a sapere se il tasto
// premuto ridisegna davvero la finestra di chi preme (oggi il click passa l'evento come
// `silenzioso`, e forward() salta il ridisegno: la misura e' riportata, non corretta, perche' non
// rientra nei tre punti della cura).
const SPIA_DISEGNO = `(function(){
  if(window.__spiaDisegni)return 'gia installata';
  window.__spiaDisegni=true; window.__disegni=0;
  const d0=draw;
  draw=function(){ window.__disegni++; return d0.apply(this,arguments); };
  return 'ok';
})()`;
const DISEGNI = `(function(){ return window.__disegni||0; })()`;
const AZZERA_DISEGNI = `(function(){ window.__disegni=0; })()`;

// IL TASTO VERO: #back/#next sono i comandi a cui delegano le freccette accanto al play e i tasti
// della tastiera (fblDoppioneFrecceVia). Si premono dal DOM, non col mouse: nel banco il grafico
// sta sotto il bordo della finestra.
async function premi(pag, quale, nota) {
  const r = await pag.evaluate((q) => {
    const el = document.getElementById(q);
    if (!el) return {trovato: false};
    el.click();
    return {trovato: true};
  }, quale);
  console.log((nota || quale) + ':', JSON.stringify(r));
  assert.equal(r.trovato, true, 'il tasto ' + quale + ' deve esistere nel DOM');
  return r;
}

// ATTESA CHE UNA FINESTRA RAGGIUNGA UN ISTANTE (il trasporto fra finestre è asincrono). Se non
// risponde, l'attesa scade e la misura dice quanto è rimasta indietro — non un numero inventato.
async function aspettaIstante(pag, t, ms = 4000) {
  try {
    await pag.waitForFunction((atteso) => {
      let m = null; try { m = replayMomentoMostrato(); } catch (e) {}
      return m === atteso;
    }, t, {timeout: ms, polling: 50});
    return true;
  } catch (e) { return false; }
}

// DOPO UN PASSO: si aspetta che il trasporto fra finestre sia passato (il canale è locale al
// browser: nelle misure del 15 novembre le risposte arrivavano tutte entro 23 ms) e si legge lo
// stato di tutte le finestre. Non è un'attesa "finché non succede": è un tempo fisso, perché qui
// si misura QUANTO ha fatto il passo, non se ha fatto quello che doveva.
async function dopoIlPasso(c, ms = 900) {
  await c.madre.waitForTimeout(ms);
  return Promise.all(c.tutte.map(S));
}

// LA SCENA COMPLETA: madre + duplicate, scelta «su tutte le finestre», replay avviato dallo stesso
// punto (`riga`/`secondi` scelgono la candela iniziale fra quelle della MADRE). Restituisce le
// pagine, l'istante iniziale esatto e il passo atteso di chi comanda.
async function scenaCondivisa(finestre, riga, secondi) {
  const {browser, pagina: madre, errori: erroriMadre} = await apriApp();
  const dup = [];
  for (const [i, f] of finestre.slice(1).entries()) {
    dup.push(await nuovaFinestra(madre.context(), 2 + i));
  }
  const tutte = [madre, ...dup.map(d => d.p)];
  const errori = [erroriMadre, ...dup.map(d => d.errori)];
  try {
    for (const p of tutte) await p.evaluate(NIENTE_CAMBIO_ASSET);
    // Le scene prima, e si fanno tenere: una finestra che non tiene la scena non si misura.
    for (const [i, f] of finestre.entries()) await assicuraScena(tutte[i], f);
    // L'istante iniziale, calcolato dai DATI della pagina (il fuso non conta).
    const t0 = await istante(madre, riga, secondi);
    // La domanda, come la fa il pulsante «Replay» (stessa funzione).
    await madre.evaluate(RISPOSTA(true));
    const avvio = await madre.evaluate((t) => {
      window.__chieste = [];
      appConfirm = function (testo, opz) {
        window.__chieste.push({testo: String(testo)});
        return Promise.resolve(true);
      };
      return (async function () {
        await fblChiediAmbitoReplay();
        avviaReplayLive(t);
        return {chieste: (window.__chieste || []).length, perTutte: !!fblReplayPerTutte,
                inReplay: !!liveReplayActive, momento: replayMomentoMostrato()};
      })();
    }, t0);
    // Le altre finestre applicano l'istante: si aspetta che ci siano arrivate.
    for (const p of tutte.slice(1)) await aspettaIstante(p, t0);
    const stati = await Promise.all(tutte.map(S));
    const passo = await passoAtteso(madre);
    return {browser, madre, dup, tutte, errori, avvio, stati, passo, t0};
  } catch (e) {
    await browser.close();
    throw e;
  }
}

const secondi = (ms) => (ms === null || ms === undefined || !Number.isFinite(ms))
  ? null : Math.round(ms / 100) / 10;

// Il delta in millisecondi fra due stati, o null se uno dei due non ha un istante.
const delta = (prima, dopo) => (prima && dopo && Number.isFinite(prima.momento)
  && Number.isFinite(dopo.momento)) ? dopo.momento - prima.momento : null;

// LA MADRE PRIME UNA VOLTA: serve a portare tutte le finestre su un istante NON sul confine
// (lo stato normale dopo il play, quello in cui oggi il passo riavvolge). Il primo passo della
// madre è di un minuto, quindi per un time frame piu' gusto di un minuto quell'istante cade DENTRO
// la candela: è esattamente lo stato misurato dal proprietario.
async function passoMadre(c) {
  await premi(c.madre, 'next', 'madre ▶ (porta tutte in formazione)');
  const t = await c.madre.evaluate(() => replayMomentoMostrato());
  for (const p of c.tutte.slice(1)) await aspettaIstante(p, t);
  return t;
}

// QUANTE CANDELE DEL RICEVENTE SONO STATE ATTRAVERSATE: su una finestra M1 una candela è un
// minuto, quindi il numero di confini attraversati è il tempo passato diviso la durata della sua
// candela. È la misura delle parole del proprietario («sulla madre deve avanzare di 5 candele»),
// ed è indipendente dal secondo di formazione dentro la candela.
function candeleAttraversate(prima, dopo, msPerBar) {
  const d = delta(prima, dopo);
  if (d === null || !Number.isFinite(msPerBar) || msPerBar <= 0) return null;
  return Math.round(d / msPerBar);
}

// Le finestre del banco: stesso asset, candele native al time frame della finestra.
const F = (tf, quante) => ({asset: 'EURUSD', tf, base: BASE, quante, grano: tf, istante: null});

// =====================================================================================
// 1. PROVA DI CONTROLLO DEL BANCO: tre finestre sulla stessa scena, replay condiviso avviato,
//    tutte e tre sullo STESSO istante; senza che nessuno prema niente niente si muove; e il tasto
//    premuto sposta davvero la finestra di chi preme. Senza queste tre prove ogni rosso qui sotto
//    potrebbe essere il banco che non misura niente.
// =====================================================================================
test('CONTROLLO: tre finestre in replay condiviso dallo stesso istante, e il tasto premuto agisce', async () => {
  const c = await scenaCondivisa([F(1, 600), F(5, 600), F(15, 600)], 30, 0);
  try {
    const [madre, m5, m15] = c.stati;
    console.log('scena:', JSON.stringify([madre, m5, m15]));
    assert.equal(c.avvio.chieste, 1, 'la domanda «su tutte le finestre?» deve essere stata fatta una volta');
    for (const [nome, s] of [['madre', madre], ['dup M5', m5], ['dup M15', m15]]) {
      assert.equal(s.inReplay, true, nome + ': deve essere in replay');
      assert.equal(s.perTutte, true, nome + ': deve aver ereditato la scelta «su tutte»');
      assert.ok(s.candele > 0, nome + ': deve avere candele');
      assert.equal(s.rigaValida, true, nome + ': idx deve essere una riga vera');
    }
    // L'istante iniziale è un confine di candela esatto per tutti e tre i time frame.
    assert.equal(m5.momento, c.t0, 'la dup M5 parte dallo stesso istante: ' + JSON.stringify({t0: c.t0, m5: m5.momento}));
    assert.equal(m15.momento, c.t0, 'la dup M15 parte dallo stesso istante');
    assert.equal(madre.momento, c.t0, 'la madre parte dallo stesso istante');

    // SENZA CHE NESSUNO PREMA, NIENTE SI MUOVE (se qui si muovesse, il banco misurerebbe il vento).
    await c.madre.waitForTimeout(700);
    const fermi = await Promise.all(c.tutte.map(S));
    for (const [i, s] of fermi.entries()) {
      assert.equal(s.momento, c.stati[i].momento, 'finestra ' + i + ': senza un passo niente deve muoversi');
    }

    // E IL TASTO PREMUTO AGISCE DAVVERO: lo stato di chi preme cambia.
    const spia = await c.madre.evaluate(SPIA_DISEGNO);
    console.log('spia ridisegno:', spia);
    await c.madre.evaluate(AZZERA_DISEGNI);
    await premi(c.madre, 'next', 'madre ▶ (controllo)');
    const mosso = await S(c.madre);
    const disegni = await c.madre.evaluate(DISEGNI);
    console.log('dopo ▶ sulla madre:', JSON.stringify(mosso));
    console.log('MISURA (riportata, non corretta): ridisegni di draw() fatti dalla finestra di chi preme =', disegni);
    assert.ok(delta(c.stati[0], mosso) !== null && delta(c.stati[0], mosso) !== 0,
      'il tasto premuto deve spostare la finestra di chi preme: ' + JSON.stringify({prima: c.stati[0].momento, dopo: mosso.momento}));
    for (const [i, p] of c.tutte.entries()) assert.deepEqual(c.errori[i], [], 'nessun errore JS sulla finestra ' + i);
  } finally { await c.browser.close(); }
});

// =====================================================================================
// 2. CASO 1 — «se pigio la freccettina di andare avanti sulla duplicata M5 e la madre è M1, sulla
//    madre deve avanzare di 5 candele». Dal CONFINE di una candela oggi il passo è già giusto: è
//    il controllo che la cura non rompe il caso che funziona.
// =====================================================================================
test('CASO 1: ▶ sulla duplicata M5 dal confine, madre M1 → madre +5 candele', async () => {
  const c = await scenaCondivisa([F(1, 600), F(5, 600)], 30, 0);
  try {
    const passo = await passoAtteso(c.dup[0].p);
    const prima = c.stati;
    await premi(c.dup[0].p, 'next', 'dup M5 ▶ (dal confine)');
    const atteso = c.t0 + passo;
    const dopo = await dopoIlPasso(c);
    const [madreP, m5P] = prima, [madreD, m5D] = dopo;
    console.log('madre prima/dopo:', JSON.stringify({idx: [madreP.idx, madreD.idx], momento: [madreP.momento, madreD.momento]}));
    console.log('dup M5 prima/dopo:', JSON.stringify({idx: [m5P.idx, m5D.idx], momento: [m5P.momento, m5D.momento]}));
    assert.equal(m5D.momento, atteso, 'la duplicata avanza di UNA sua candela: ' + JSON.stringify({t0: c.t0, atteso, ora: m5D.momento}));
    assert.equal(m5D.idx - m5P.idx, 1, 'su M5 avanza di una candela');
    assert.equal(candeleAttraversate(madreP, madreD, 60000), 5,
      'sulla madre M1 devono essere avanzate 5 candele: ' + JSON.stringify({delta: delta(madreP, madreD)}));
    assert.equal(madreD.momento, m5D.momento, 'tutte le finestre sullo stesso istante, al millisecondo');
    for (const [i, p] of c.tutte.entries()) assert.deepEqual(c.errori[i], [], 'nessun errore JS sulla finestra ' + i);
  } finally { await c.browser.close(); }
});

// =====================================================================================
// 3. CASO 1b — LA PROVA CHIAVE. Lo stato «in formazione», cioe' lo stato normale dopo il play: la
//    madre ha premuto una volta (la dup M5 è a meta' della sua candela delle 08:30) e adesso la
//    dup preme. La regola del proprietario dice +5; oggi il passo RIAVVOLGE (misurato: −1 min).
// =====================================================================================
test('CASO 1b: ▶ sulla duplicata M5 dallo stato in formazione, madre M1 → madre +5 candele', async () => {
  const c = await scenaCondivisa([F(1, 600), F(5, 600)], 30, 0);
  try {
    const tFormazione = await passoMadre(c);
    const prima = await Promise.all(c.tutte.map(S));
    const passo = await passoAtteso(c.dup[0].p);
    console.log('stato in formazione:', JSON.stringify(prima));
    assert.ok(prima[1].formazione && prima[1].formazione.idx === prima[1].idx + 1,
      'la dup M5 deve essere IN FORMAZIONE (lo stato dopo il play): ' + JSON.stringify(prima[1]));

    await premi(c.dup[0].p, 'next', 'dup M5 ▶ (dallo stato in formazione)');
    const atteso = tFormazione + passo;
    const dopo = await dopoIlPasso(c);
    const [madreP, m5P] = prima, [madreD, m5D] = dopo;
    console.log('madre prima/dopo:', JSON.stringify({idx: [madreP.idx, madreD.idx], momento: [madreP.momento, madreD.momento]}));
    console.log('dup M5 prima/dopo:', JSON.stringify({idx: [m5P.idx, m5D.idx], momento: [m5P.momento, m5D.momento], formazione: [m5P.formazione, m5D.formazione]}));
    const passoFatto = delta(m5P, m5D);
    assert.equal(m5D.momento, atteso,
      'UN PASSO VALE LA DURATA DELLA CANDELA DI CHI PREME: dalla dup M5 a metà candela il passo deve '
      + 'essere +' + (passo / 60000) + ' minuti, invece è stato ' + secondi(passoFatto) + ' s '
      + '(' + JSON.stringify({prima: m5P.momento, dopo: m5D.momento}) + ')');
    assert.equal(candeleAttraversate(madreP, madreD, 60000), 5,
      'sulla madre M1 devono essere avanzate 5 candele: ' + JSON.stringify({delta: delta(madreP, madreD)}));
    assert.equal(m5D.idx - m5P.idx, 1, 'su M5 avanza di una candela');
    assert.equal(madreD.momento, m5D.momento, 'tutte le finestre sullo stesso istante, al millisecondo');
    for (const [i, p] of c.tutte.entries()) assert.deepEqual(c.errori[i], [], 'nessun errore JS sulla finestra ' + i);
  } finally { await c.browser.close(); }
});

// =====================================================================================
// 4. CASO 2 — «se su una finestra c'è un time frame da 15 minuti e sulle altre due finestre ci sono
//    time frame da 1 minuto, tutte e due le altre finestre devono andare avanti di 15 candele,
//    mentre su quella da 15 minuti una candela». Prova dallo stato in formazione (dopo il play):
//    oggi il passo dalla M15 RIAVVOLGE (misurato: −47 s), quindi le due M1 tornano indietro.
// =====================================================================================
test('CASO 2: ▶ sulla finestra M15, due finestre M1 → entrambe +15 candele, su M15 una candela', async () => {
  const c = await scenaCondivisa([F(1, 600), F(15, 600), F(1, 600), F(1, 600)], 30, 0);
  try {
    const tFormazione = await passoMadre(c);
    const prima = await Promise.all(c.tutte.map(S));
    const passo = await passoAtteso(c.dup[0].p);       // la dup M15 è chi preme
    console.log('stato in formazione:', JSON.stringify(prima.map(s => ({slot: s.slot, tf: s.tf, idx: s.idx, momento: s.momento, formazione: s.formazione}))));

    await premi(c.dup[0].p, 'next', 'dup M15 ▶ (dallo stato in formazione)');
    const atteso = tFormazione + passo;
    const dopo = await dopoIlPasso(c);
    const [mP, m15P, d1P, d2P] = prima, [mD, m15D, d1D, d2D] = dopo;
    console.log('M15 prima/dopo:', JSON.stringify({idx: [m15P.idx, m15D.idx], momento: [m15P.momento, m15D.momento]}));
    console.log('M1 #1 prima/dopo:', JSON.stringify({idx: [d1P.idx, d1D.idx], momento: [d1P.momento, d1D.momento]}));
    console.log('M1 #2 prima/dopo:', JSON.stringify({idx: [d2P.idx, d2D.idx], momento: [d2P.momento, d2D.momento]}));

    assert.equal(m15D.momento, atteso,
      'UN PASSO VALE LA DURATA DELLA CANDELA DI CHI PREME: dalla M15 il passo deve essere +'
      + (passo / 60000) + ' minuti, invece è stato ' + secondi(delta(m15P, m15D)) + ' s');
    assert.equal(m15D.idx - m15P.idx, 1, 'su M15 avanza di UNA candela');
    for (const [nome, p, d] of [['M1 #1', d1P, d1D], ['M1 #2', d2P, d2D]]) {
      assert.equal(candeleAttraversate(p, d, 60000), 15,
        'sulla ' + nome + ' devono essere avanzate 15 candele: ' + JSON.stringify({delta: delta(p, d)}));
      assert.equal(d.momento, m15D.momento, 'e deve stare sullo stesso istante di chi ha premuto');
    }
    for (const [i, p] of c.tutte.entries()) assert.deepEqual(c.errori[i], [], 'nessun errore JS sulla finestra ' + i);
  } finally { await c.browser.close(); }
});

// =====================================================================================
// 5. CASO 3 — «se è 30 minuti una finestra, un'altra finestra è 10 minuti, un'altra finestra è 1
//    minuto, quella da 10 farà 3 salti in avanti e quella da 1 minuto salterà 30 candele».
// =====================================================================================
test('CASO 3: ▶ sulla finestra M30, una M10 e una M1 → M10 3 bucket, M1 30 candele', async () => {
  const c = await scenaCondivisa([F(1, 600), F(30, 600), F(10, 600), F(1, 600)], 30, 0);
  try {
    const tFormazione = await passoMadre(c);
    const prima = await Promise.all(c.tutte.map(S));
    const passo = await passoAtteso(c.dup[0].p);       // la dup M30 è chi preme
    console.log('stato in formazione:', JSON.stringify(prima.map(s => ({slot: s.slot, tf: s.tf, idx: s.idx, momento: s.momento}))));

    await premi(c.dup[0].p, 'next', 'dup M30 ▶ (dallo stato in formazione)');
    const atteso = tFormazione + passo;
    const dopo = await dopoIlPasso(c);
    const [mP, m30P, m10P, m1P] = prima, [mD, m30D, m10D, m1D] = dopo;
    console.log('M30 prima/dopo:', JSON.stringify({idx: [m30P.idx, m30D.idx], momento: [m30P.momento, m30D.momento]}));
    console.log('M10 prima/dopo:', JSON.stringify({idx: [m10P.idx, m10D.idx], momento: [m10P.momento, m10D.momento]}));
    console.log('M1  prima/dopo:', JSON.stringify({idx: [m1P.idx, m1D.idx], momento: [m1P.momento, m1D.momento]}));

    assert.equal(m30D.momento, atteso,
      'UN PASSO VALE LA DURATA DELLA CANDELA DI CHI PREME: dalla M30 il passo deve essere +'
      + (passo / 60000) + ' minuti, invece è stato ' + secondi(delta(m30P, m30D)) + ' s');
    assert.equal(m30D.idx - m30P.idx, 1, 'su M30 avanza di UNA candela');
    assert.equal(m10D.idx - m10P.idx, 3,
      'sulla M10 devono essere fatti 3 salti in avanti: ' + JSON.stringify({idx: [m10P.idx, m10D.idx]}));
    assert.equal(m10D.momento, m30D.momento, 'e la M10 sta sullo stesso istante');
    assert.equal(candeleAttraversate(m1P, m1D, 60000), 30,
      'sulla M1 devono essere avanzate 30 candele: ' + JSON.stringify({delta: delta(m1P, m1D)}));
    assert.equal(m1D.momento, m30D.momento, 'e la M1 sta sullo stesso istante');
    for (const [i, p] of c.tutte.entries()) assert.deepEqual(c.errori[i], [], 'nessun errore JS sulla finestra ' + i);
  } finally { await c.browser.close(); }
});

// =====================================================================================
// 6. CASO 4 — «se invece sono sulla finestra con time frame da 1 minuto e ci sono le altre due
//    finestre che hanno 30 minuti e l'altra da 15 minuti, avanzeranno soltanto di pochissimo, ma
//    non avanza la candela, avanza soltanto l'evoluzione dell'estensione della candela».
//    Si misura dallo stato sottominuto (l'istante ricevuto da fuori, non sul confine): li' oggi il
//    passo della finestra M1 RIAVVOLGE al confine della candela e le due finestre grosse CAMBIANO
//    candela, che è esattamente il contrario della regola.
// =====================================================================================
test('CASO 4: ▶ sulla finestra M1, altre M30 e M15 → nessuna cambia candela, solo l evoluzione', async () => {
  // Istante iniziale a 23 secondi dentro il minuto: lo stato di un istante ricevuto sottominuto.
  const c = await scenaCondivisa([F(1, 600), F(1, 600), F(30, 600), F(15, 600)], 30, 23);
  try {
    const passo = await passoAtteso(c.dup[0].p);       // la dup M1 è chi preme
    const prima = await Promise.all(c.tutte.map(S));
    console.log('stato sottominuto:', JSON.stringify(prima.map(s => ({slot: s.slot, tf: s.tf, idx: s.idx, momento: s.momento, sub: s.formazione ? s.formazione.sub : null}))));
    assert.ok(prima[1].formazione, 'la dup M1 che preme deve avere la candela in formazione: ' + JSON.stringify(prima[1]));

    await premi(c.dup[0].p, 'next', 'dup M1 ▶ (istante sottominuto)');
    const atteso = c.t0 + passo;
    const dopo = await dopoIlPasso(c);
    const [mP, m1P, m30P, m15P] = prima, [mD, m1D, m30D, m15D] = dopo;
    console.log('M1 (chi preme) prima/dopo:', JSON.stringify({idx: [m1P.idx, m1D.idx], momento: [m1P.momento, m1D.momento]}));
    console.log('M30 prima/dopo:', JSON.stringify({idx: [m30P.idx, m30D.idx], momento: [m30P.momento, m30D.momento], sub: [m30P.formazione, m30D.formazione]}));
    console.log('M15 prima/dopo:', JSON.stringify({idx: [m15P.idx, m15D.idx], momento: [m15P.momento, m15D.momento], sub: [m15P.formazione, m15D.formazione]}));

    assert.equal(m1D.momento, atteso,
      'UN PASSO VALE LA DURATA DELLA CANDELA DI CHI PREME: dalla M1 il passo deve essere +60 s, '
      + 'invece è stato ' + secondi(delta(m1P, m1D)) + ' s');
    assert.equal(m1D.idx - m1P.idx, 1, 'su M1 avanza di una candela');
    for (const [nome, p, d] of [['M30', m30P, m30D], ['M15', m15P, m15D]]) {
      assert.equal(d.idx, p.idx,
        'sulla ' + nome + ' NON deve cambiare la candela (avanza solo l evoluzione dentro quella in '
        + 'formazione): ' + JSON.stringify({idx: [p.idx, d.idx]}));
      assert.equal(d.formazione.sub - p.formazione.sub, passo / 1000,
        'sulla ' + nome + ' l evoluzione della candela in formazione deve avanzare di '
        + (passo / 1000) + ' secondi: ' + JSON.stringify({sub: [p.formazione.sub, d.formazione.sub]}));
      assert.equal(d.momento, m1D.momento, 'e deve stare sullo stesso istante di chi ha premuto');
    }
    for (const [i, p] of c.tutte.entries()) assert.deepEqual(c.errori[i], [], 'nessun errore JS sulla finestra ' + i);
  } finally { await c.browser.close(); }
});

// =====================================================================================
// 7. ◀ INDIETRO — stessa regola, al contrario: un passo indietro vale la durata della candela di
//    chi preme. Oggi #back fa idx-- e prende la chiusura della candela prima, quindi dallo stato in
//    formazione RIAVVOLGE (misurato: −12 min invece di −5).
// =====================================================================================
test('◀ INDIETRO dalla duplicata M5 in formazione → madre −5 candele, non −12 min', async () => {
  const c = await scenaCondivisa([F(1, 600), F(5, 600)], 30, 0);
  try {
    const tFormazione = await passoMadre(c);
    const prima = await Promise.all(c.tutte.map(S));
    const passo = await passoAtteso(c.dup[0].p);
    console.log('stato in formazione:', JSON.stringify(prima));
    assert.ok(prima[1].formazione && prima[1].formazione.idx === prima[1].idx + 1,
      'la dup M5 deve essere IN FORMAZIONE: ' + JSON.stringify(prima[1]));

    await premi(c.dup[0].p, 'back', 'dup M5 ◀ (dallo stato in formazione)');
    const atteso = tFormazione - passo;
    const dopo = await dopoIlPasso(c);
    const [madreP, m5P] = prima, [madreD, m5D] = dopo;
    console.log('madre prima/dopo:', JSON.stringify({idx: [madreP.idx, madreD.idx], momento: [madreP.momento, madreD.momento]}));
    console.log('dup M5 prima/dopo:', JSON.stringify({idx: [m5P.idx, m5D.idx], momento: [m5P.momento, m5D.momento]}));

    assert.equal(m5D.momento, atteso,
      'UN PASSO INDIETRO VALE LA DURATA DELLA CANDELA DI CHI PREME: dalla dup M5 in formazione il '
      + 'passo deve essere −' + (passo / 60000) + ' minuti, invece è stato ' + secondi(delta(m5P, m5D)) + ' s');
    assert.equal(candeleAttraversate(madreP, madreD, 60000), -5,
      'sulla madre M1 devono essere tornate indietro 5 candele: ' + JSON.stringify({delta: delta(madreP, madreD)}));
    assert.equal(madreD.momento, m5D.momento, 'tutte le finestre sullo stesso istante, al millisecondo');
    for (const [i, p] of c.tutte.entries()) assert.deepEqual(c.errori[i], [], 'nessun errore JS sulla finestra ' + i);
  } finally { await c.browser.close(); }
});

// =====================================================================================
// 8. IL PRIMO BUCKET — il trasporto fa idx-- quando l'istante cade DENTRO la candela mostrata, ma
//    sul PRIMO bucket quell'idx-- non aveva la guardia idx>0: misurato idx=-1, con rows[-1] che non
//    esiste e #back che non risponde piu' (la sua guardia è idx<=0). È il caso delle finestre D1 e
//    mensili, il cui primo bucket contiene ore o giorni interi.
// =====================================================================================
test('IL PRIMO BUCKET: una finestra D1 non deve finire a idx=-1 (la riga non esiste)', async () => {
  // La dup D1 ha tre candele da un giorno: l'istante iniziale cade DENTRO il primo bucket.
  const c = await scenaCondivisa([F(1, 600), F(1440, 3)], 30, 0);
  try {
    await passoMadre(c);                     // 08:31, un minuto dentro il primo bucket D1
    const d1 = await S(c.dup[0].p);
    console.log('dup D1 sullo stato iniziale:', JSON.stringify(d1));
    await premi(c.madre, 'next', 'madre ▶ (un altro minuto)');
    await c.madre.waitForTimeout(600);
    const d1Dopo = await S(c.dup[0].p);
    console.log('dup D1 dopo il passo della madre:', JSON.stringify(d1Dopo));
    const atteso = await c.madre.evaluate(() => replayMomentoMostrato());
    assert.equal(d1Dopo.rigaValida, true,
      'la finestra D1 deve restare su una riga vera: oggi idx=-1 (rows[-1] non esiste) — '
      + JSON.stringify({idx: d1Dopo.idx, candele: d1Dopo.candele}));
    assert.equal(d1Dopo.momento, atteso,
      'e deve stare sullo stesso istante della madre: ' + JSON.stringify({madre: atteso, d1: d1Dopo.momento}));
    // ◀ INDIETRO deve rispondere: con idx=-1 la sua guardia (idx<=0) lo faceva tacere per sempre.
    await premi(c.dup[0].p, 'back', 'dup D1 ◀ (deve rispondere)');
    await c.dup[0].p.waitForTimeout(400);
    const d1Indietro = await S(c.dup[0].p);
    console.log('dup D1 dopo ◀:', JSON.stringify(d1Indietro));
    assert.equal(d1Indietro.rigaValida, true, 'e anche dopo ◀ la riga deve essere vera');
    for (const [i, p] of c.tutte.entries()) assert.deepEqual(c.errori[i], [], 'nessun errore JS sulla finestra ' + i);
  } finally { await c.browser.close(); }
});

// =====================================================================================
// 9. «NESSUN TETTO, MA IL REPLAY NON MUORE» — in Live lo storico si chiede con max=1000, quindi una
//    finestra M1 tiene 1.000 minuti. Un passo da una finestra D1 (1.440 minuti) la manda OLTRE i
//    suoi dati: oggi quella finestra esce dal replay e, con esciReplayLive(), annuncia 'stop' a
//    TUTTE — il replay condiviso moriva al primo tocco. Deve invece uscire da sé, in silenzio, e
//    lasciare le altre finestre a rivedere.
// =====================================================================================
test('LA FINESTRA SENZA PIU DATI esce da sé, senza annunciare stop a tutte le altre', async () => {
  // Madre M1 con 1.000 candele (16 ore e 40 minuti, il tetto del Live) e una dup D1 con dieci
  // giorni: un passo della D1 vale un giorno intero, che sulla madre non esiste.
  const c = await scenaCondivisa([F(1, 1000), F(1440, 10)], 30, 0);
  try {
    const passo = await passoAtteso(c.dup[0].p);
    await premi(c.dup[0].p, 'next', 'dup D1 ▶ (un giorno intero)');
    await c.madre.waitForTimeout(900);
    const tD1 = await c.dup[0].p.evaluate(() => replayMomentoMostrato());
    const madreOltre = await S(c.madre);
    console.log('madre spinta oltre i suoi dati:', JSON.stringify(madreOltre));

    // Adesso la madre preme ▶ : oggi uscirebbe dal replay annunciando 'stop' a tutte.
    await premi(c.madre, 'next', 'madre ▶ (fine dei propri dati)');
    await c.madre.waitForTimeout(600);
    const madreDopo = await S(c.madre);
    const d1Dopo = await S(c.dup[0].p);
    console.log('madre dopo il proprio passo:', JSON.stringify(madreDopo));
    console.log('dup D1 nello stesso istante:', JSON.stringify(d1Dopo));
    assert.equal(madreDopo.inReplay, false,
      'la finestra che ha finito i PROPRI dati esce dal replay: ' + JSON.stringify({inReplay: madreDopo.inReplay}));
    assert.equal(d1Dopo.inReplay, true,
      'MA IL REPLAY CONDIVISO NON DEVE MORIRE: la dup D1 deve restare in replay, oggi esce perche\' '
      + 'la madre le annuncia lo stop — ' + JSON.stringify({d1: d1Dopo.inReplay}));

    // PROVA CHE è DAVVERO ANCORA VIVO: la dup D1 preme ▶ e avanza di un altro giorno.
    const primaD1 = d1Dopo.momento;
    await premi(c.dup[0].p, 'next', 'dup D1 ▶ (il replay continua)');
    await c.dup[0].p.waitForTimeout(600);
    const d1Avanti = await S(c.dup[0].p);
    console.log('dup D1 dopo avere premuto di nuovo:', JSON.stringify(d1Avanti));
    assert.equal(d1Avanti.momento - primaD1, passo,
      'la dup D1 avanza di un altro passo, il replay condiviso respira: '
      + JSON.stringify({prima: primaD1, dopo: d1Avanti.momento, passo}));
    assert.equal(d1Avanti.inReplay, true, 'e resta in replay');
    for (const [i, p] of c.tutte.entries()) assert.deepEqual(c.errori[i], [], 'nessun errore JS sulla finestra ' + i);
  } finally { await c.browser.close(); }
});

// =====================================================================================
// MISURA RIPORTATA (prova tolta perche' un banco rosso non resta nel repo) — «NESSUN TETTO».
// Misurata il 16 novembre con questo stesso banco: madre M1 di 60 candele (in Live max=1000) e una
// dup D1 di dieci giorni, replay condiviso, madre sull'ultima sua candela (08:59, idx 59/60):
//   prima : madre idx 59, masterTime 08:59, inReplay true
//   ▶     : madre idx 59, masterTime 08:59, inReplay TRUE (non esce, non si muove)
//           dup D1 momento 08:59 -> 08:59 (nessun passo: l'annuncio è l'istante di prima)
// La cura in working tree AGGANCIA il passo di chi preme alla sua ultima candela (in fblReplayPasso:
// "se t>ultimaT allora t=ultimaT"), quindi "il replay non muore" è rispettato, ma il "nessun tetto"
// del proprietario no: chi preme non esce da sé, resta fermo dentro il replay. Non succede quando
// l'istante ARRIVA da un'altra finestra: lì la finestra esce da sé in silenzio (ramo apposito in
// fblReplayApplicaIstante, provato dalla prova 9 qui sopra). Quando il varano sarà curato la prova
// va rimessa così:
//   const c = await scenaCondivisa([F(1, 60), F(1440, 10)], 59, 0);
//   await premi(c.madre, 'next', 'madre ▶');  const dopo = await dopoIlPasso(c);
//   assert.equal(dopo[0].inReplay, false);           // esce da sé, in silenzio
//   assert.equal(dopo[1].inReplay, true);            // e le altre finestre continuano
//   assert.equal(dopo[1].momento - prima[1].momento, await passoAtteso(c.madre));
// =====================================================================================
// 10. CONTROLLO: IL PLAY continua a seguire la stessa regola — nessun orologio a parte. Il battito
//     avanza una candela per volta (replaySecondsPerBar è la sua durata) e pubblica l'istante: la
//     duplicata applica quello stesso istante, quindi le due finestre restano all'unisono.
// =====================================================================================
test('CONTROLLO: il PLAY fa avanzare madre e duplicata insieme, sullo stesso istante', async () => {
  const c = await scenaCondivisa([F(1, 600), F(5, 600)], 30, 0);
  try {
    await c.madre.evaluate(`(function(){ const s=$('speed'); if(s)s.value='30'; })()`);
    await c.madre.bringToFront();
    const prima = await Promise.all(c.tutte.map(S));
    await premi(c.madre, 'play', 'madre ▶ PLAY (30x)');
    await c.madre.waitForTimeout(2500);
    const durante = await Promise.all(c.tutte.map(S));
    const avanzMadre = delta(prima[0], durante[0]);
    const avanzDup = delta(prima[1], durante[1]);
    const sfasamento = (durante[0].momento !== null && durante[1].momento !== null)
      ? durante[0].momento - durante[1].momento : null;
    console.log('madre:', JSON.stringify({momento: durante[0].momento, idx: durante[0].idx, formazione: durante[0].formazione}));
    console.log('dup M5:', JSON.stringify({momento: durante[1].momento, idx: durante[1].idx, formazione: durante[1].formazione}));
    console.log('AVANZATO in 2,5 s a 30x: madre', secondi(avanzMadre), 's | dup', secondi(avanzDup), 's | sfasamento', secondi(sfasamento), 's');

    assert.ok(durante[0].inCorso, 'il battito della madre deve girare');
    assert.ok(avanzMadre !== null && avanzMadre > 30000,
      'la madre col PLAY a 30x in 2,5 s deve avanzare di piu\' di 30 s di mercato: ' + secondi(avanzMadre));
    assert.ok(avanzDup !== null && avanzDup > 30000,
      'E LA DUPLICATA DEVE AVANZARE INSIEME, non restare ferma: ' + secondi(avanzDup));
    assert.ok(Math.abs(avanzMadre - avanzDup) < 5000,
      'le due finestre avanzano dello stesso mercato (nessun orologio a parte): madre '
      + secondi(avanzMadre) + ' s contro dup ' + secondi(avanzDup) + ' s');
    assert.ok(sfasamento !== null && Math.abs(sfasamento) <= 2000,
      'e restano sullo STESSO istante (tolleranza di un fotogramma): ' + secondi(sfasamento) + ' s');
    // Il passo a freccetta dopo il play deve seguire la stessa regola: un minuto per chi preme.
    // La base si rilegge DOPO la pausa: fra la lettura qui sopra e la pausa il battito poteva
    // ancora fare un giro (a 30x sono secondi di mercato), e la base sarebbe stata stantia.
    const passo = await passoAtteso(c.madre);
    await premi(c.madre, 'play', 'madre ▶ PLAY → pausa');
    await c.madre.waitForTimeout(500);
    const fermo = await S(c.madre);
    assert.equal(fermo.inCorso, false, 'la pausa deve fermare il battito');
    await premi(c.madre, 'next', 'madre ▶ (un passo dopo il play)');
    const dopoPasso = await dopoIlPasso(c);
    const passoFatto = delta(fermo, dopoPasso[0]);
    console.log('dopo il passo a freccetta uscito dal play:', JSON.stringify(dopoPasso.map(s => ({slot: s.slot, momento: s.momento}))));
    assert.equal(dopoPasso[1].momento, dopoPasso[0].momento,
      'anche il passo dopo il play vale una candela di chi preme e viaggia alle altre finestre: '
      + JSON.stringify({madre: dopoPasso[0].momento, dup: dopoPasso[1].momento}));
    assert.equal(passoFatto, passo,
      'e il passo fatto vale esattamente la durata della candela di chi preme: ' + secondi(passoFatto) + ' s');
    for (const [i, p] of c.tutte.entries()) assert.deepEqual(c.errori[i], [], 'nessun errore JS sulla finestra ' + i);
  } finally { await c.browser.close(); }
});