// SEGNALATO dal proprietario (10 novembre 2026), con lo schermo del pannello «Configura le
// posizioni del segnale»: «ho impostato l'1% del rischio totale, 0.02 lotti per operazione in base
// allo stop loss selezionato, break even a 10 pip, seconda operazione che sposta a break even
// quando il prezzo raggiunge il take profit 2. Perché non apre le posizioni in automatico? Tutte e
// 5? Me ne apre soltanto la prima. Oggi di segnali come questo mi apre soltanto una posizione
// invece di aprirmi tutte quante le posizioni.»
//
// Il pannello mostrava CINQUE righe (APRI 1..5, un take profit per riga) e la strategia «nessuno
// spostamento automatico dello stop». Cinque righe nella configurazione, quindi cinque posizioni
// all'apertura: e' quello che si misura qui, senza guardare il sorgente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Oro a 4090, segnale SELL con i CINQUE take profit dello screenshot, in ordine di scrittura
// decrescente (la sala li scrive dal piu' vicino al piu' lontano, o viceversa: l'ordine lo rimette
// l'app, qui non deve contare niente).
const SEGNALE = {
  strumento:'XAUUSD', direzione:'SELL', entrata:4090, stop_loss:4100,
  take_profit:[4078,4067,4063,4060,4057]
};

// Il segnale cosi' come lo vede l'app, col livello «giornata» che sta dietro a ogni segnale.
const VOCE = (ID) => ({id:ID, chat:'Sala A', sala:'@a', stato:'nuovo', ricevuto_ms:Date.now(),
  segnale:SEGNALE});

// La preparazione: candele di XAUUSD a 4090, conto simulato, niente MT5 (come sul computer di chi
// guarda il replay / non ha il terminale collegato). `posizioni` e `ordiniInAttesa` vengono
// svuotati, la finestra di conferma risponde sempre di si' come quando si preme «Apri le posizioni».
// Il segnale viene messo DENTRO la pagina, perché MISURA lo deve trovare come lo trova l'app.
const PREPARA = () => {
  const SEGNALE = {
    strumento:'XAUUSD', direzione:'SELL', entrata:4090, stop_loss:4100,
    take_profit:[4078,4067,4063,4060,4057]
  };
  const VOCE = {id:1, chat:'Sala A', sala:'@a', stato:'nuovo', ricevuto_ms:Date.now(),
    segnale:SEGNALE};
  window.__segnale = {SEGNALE, VOCE};
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++) {
    const p = 4090;
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: p, high: p + 1, low: p - 1,
            close: p, volume: 5});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'XAUUSD';
  if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'XAUUSD';
  // Modalità LIVE (conto simulato): i segnali dal vivo si aprono solo qui, in Storico no.
  liveModeActive = true; mt5Connected = false;
  positions = []; pendingOrders = []; trades = [];
  tgStrategie = {}; tgSegnaliRicevuti = [];
  return 'pronto';
};

// Quante posizioni nascono davvero da un segnale con cinque take profit, e cosa resta nel piano
// (n, take profit, lotti) all'ingresso del ciclo di apertura. Torna anche il PERCORSO delle
// chiamate alla funzione che apre davvero una posizione, per dire da che numero si è fermato.
async function MISURA(){
  const SEGNALE = window.__segnale.SEGNALE;
  const voce = window.__segnale.VOCE;
  tgSegnaliRicevuti.push(voce);
  const piano = tgPiano(SEGNALE, 'XAUUSD', 1, {prezzo: 4090});
  window.appConfirm = async () => true;
  appConfirm = window.appConfirm;
  await tgEseguiSegnale(voce, {sym: 'XAUUSD', piano});
  return {
    piano: {n: piano.n, tp: piano.tp, lotti: piano.lotti, problemi: piano.problemi || []},
    aperte: positions.length,
    ordiniInAttesa: pendingOrders.length,
    tps: positions.map(p => p.tp),
    gruppi: [...new Set(positions.map(p => String(p.tgGruppo)))],
    voce: {aperte: voce.aperte, stato: voce.stato}
  };
};

test('un segnale con cinque take profit apre cinque posizioni, non una sola', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      return eval('(' + d.mis + ')')();
    }, {prep: PREPARA.toString(), mis: MISURA.toString()});
    assert.equal(r.aperte, 5,
      'il piano dice '+r.piano.n+' posizioni, in posizioni ce ne sono '+r.aperte+
      '; la voce del segnale dice '+r.voce.aperte);
    assert.equal(r.piano.n, 5, 'il piano deve avere una posizione per ognuno dei 5 take profit');
    assert.equal(r.voce.aperte, 5, 'il segnale deve ricordare 5 posizioni aperte');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// Il percorso dell'APERTURA AUTOMATICA (quello che il proprietario usa: «perché non apre le
// posizioni in automatico?»). Qui si misura quanta parte del piano sopravvive: la decisione
// della sala (tgAutoDecidi, coi suoi tetti) e il piano che ne esce.
async function MISURA_AUTO(){
  const voce = window.__segnale.VOCE;
  tgSegnaliRicevuti.push(voce);
  window.__tgAutoFxBackup = JSON.parse(JSON.stringify(tgAutoFx));
  // La configurazione della famiglia Forex (l'oro XAUUSD sta qui) con l'apertura automatica
  // accesa, rischio 1%, e una sala spuntata come nel pannello del proprietario.
  tgAutoFx = tgAutoDaSalvato({attivo:true, rischio:1, maxGlobali:40, perditaAttiva:false,
    sale:{'Sala A':{attivo:true, rischio:1, maxPosizioni:6, quote:[], regole:[], avvicinamento:0}}});
  const deciso = tgAutoDecidi(voce, tgAutoChiaveDestinazione(voce));
  const spazio = deciso && deciso.spazio;
  const piano = tgPiano(window.__segnale.SEGNALE, 'XAUUSD', deciso ? deciso.rischio : 1,
    {maxN: spazio, entroRischio: true, prezzo: 4090});
  tgAutoFx = window.__tgAutoFxBackup;
  return {
    deciso, spazio,
    pianoN: piano.n, pianoTp: piano.tp,
    problemi: piano.problemi || []
  };
};

test('le cinque posizioni portano il loro take profit e il gruppo del segnale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      return eval('(' + d.mis + ')')();
    }, {prep: PREPARA.toString(), mis: MISURA.toString()});
    assert.equal(r.aperte, 5, 'devono essere cinque posizioni, una per take profit');
    const tps = r.tps.sort((a, b) => a - b);
    assert.deepEqual(tps, [4057, 4060, 4063, 4067, 4078],
      'ogni posizione deve portare il SUO take profit: ' + JSON.stringify(tps));
    assert.equal(r.gruppi.length, 1, 'le cinque posizioni devono fare un gruppo solo, quello del segnale');
  } finally { await browser.close(); }
});

// Il percorso COMPLETO, quello che gira quando un segnale arriva davvero e l'apertura automatica
// e' accesa: tgAutoValuta prende la decisione e, se apre, passa da tgAutoApriQui. Si misura il
// numero finale di posizioni, che e' il numero che il proprietario vede sul conto.
async function MISURA_AUTO_COMPLETO(){
  const voce = window.__segnale.VOCE;
  tgSegnaliRicevuti.push(voce);
  window.__tgAutoFxBackup = JSON.parse(JSON.stringify(tgAutoFx));
  tgAutoFx = tgAutoDaSalvato({attivo:true, rischio:1, maxGlobali:40, perditaAttiva:false,
    sale:{'Sala A':{attivo:true, rischio:1, maxPosizioni:6, quote:[], regole:[], avvicinamento:0}}});
  consensoValido = () => true;
  await tgAutoValuta(voce, 'sim');
  const r = {
    motivo: voce.autoMotivo || null,
    aperte: positions.length,
    tps: positions.map(p => p.tp),
    voce: {aperte: voce.aperte, stato: voce.stato}
  };
  tgAutoFx = window.__tgAutoFxBackup;
  return r;
};

test('apertura automatica: la decisione della sala concede tutte e cinque le posizioni', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      return eval('(' + d.mis + ')')();
    }, {prep: PREPARA.toString(), mis: MISURA_AUTO.toString()});
    assert.equal(r.deciso.apri, true,
      'la sala deve aprire in automatico; motivo: ' + (r.deciso.motivo || 'nessuno'));
    assert.equal(r.spazio >= 5, true,
      'lo spazio concesso dai tetti non deve essere minore dei target del segnale: è '+r.spazio);
    assert.equal(r.pianoN, 5,
      'il piano deve portare 5 posizioni, una per take profit; tp: ' + JSON.stringify(r.pianoTp));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// IL PERCORSO DEL PROPRIETARIO secondo lo schermo che ha mandato: pannello «Configura le
// posizioni del segnale» con CINQUE righe, e il conto MT5 collegato (la finestra dice «ORDINI
// VERI su MT5»). In questo percorso tgEseguiSegnale gira il ciclo sequenziale — NON il batch —
// perche' dalla finestra di configurazione non arriva `senzaGrafico`.
//
// Si misura quanti ordini partirono davvero, sostituendo placeRealMt5Order con una che conta le
// chiamate e risponde «ordine accettato»: e' esattamente quello che fa il ponte verso MT5, senza
// toccare niente di vero. Le posizioni vere NON stanno in `positions[] (arrivano dopo dal
// polling del conto) e questo e' il punto su cui misurare.
async function MISURA_MT5(){
  const voce = window.__segnale.VOCE;
  tgSegnaliRicevuti.push(voce);
  window.__ordini = [];
  window.__placeBackup = window.placeRealMt5Order;
  window.placeRealMt5Order = async function(side, forz){
    window.__ordini.push({side, lots: forz && forz.lots, tp: forz && forz.tp,
                          sl: forz && forz.sl});
    return 900000 + window.__ordini.length;      // un ticket, come fa il ponte
  };
  const piano = tgPiano(window.__segnale.SEGNALE, 'XAUUSD', 1, {prezzo: 4090});
  window.appConfirm = async () => true;
  appConfirm = window.appConfirm;
  const esito = await tgEseguiSegnale(voce, {sym: 'XAUUSD', piano});
  window.placeRealMt5Order = window.__placeBackup;
  return {
    ordini: window.__ordini.length,
    tpDegliOrdini: window.__ordini.map(o => o.tp),
    aperte: voce.aperte,
    posizioniSimulate: positions.length,
    voce: {stato: voce.stato}
  };
};
test('apertura automatica completa: di un segnale con 5 take profit si aprono 5 posizioni', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      return eval('(' + d.mis + ')')();
    }, {prep: PREPARA.toString(), mis: MISURA_AUTO_COMPLETO.toString()});
    assert.equal(r.voce.aperte, 5, 'il segnale deve ricordare 5 posizioni aperte');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// La stessa cosa col conto MT5 collegato, che e' la strada che prende chi ha il terminale aperto
// (il pannello dice «ORDINI VERI su MT5»). Qui il ciclo e' sequenziale e gli ordini passano da
// placeRealMt5Order: si contano gli ORDINI, non le posizioni in `positions[]`.
test('con MT5 collegato: un segnale con 5 take profit manda 5 ordini, non uno solo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      mt5Connected = true;               // conto reale collegato
      return eval('(' + d.mis + ')')();
    }, {prep: PREPARA.toString(), mis: MISURA_MT5.toString()});
    assert.equal(r.ordini, 5,
      'il piano del pannello dice 5 posizioni, ordini inviati a MT5: ' + r.ordini);
    assert.deepEqual(r.tpDegliOrdini.sort((a, b) => a - b), [4057, 4060, 4063, 4067, 4078],
      'ogni ordine deve portare il SUO take profit: ' + JSON.stringify(r.tpDegliOrdini));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
