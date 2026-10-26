// IL CONTO STORICO IN REPLAY: la posizione aperta si vede, e i numeri sono quelli del passato.
//
// SEGNALATO dal proprietario (25-26 ottobre 2026):
//   «In modalità replay il PL live non viene visualizzato al momento in cui si apre una posizione
//    in modalità replay che va a finire in storico ... verranno visualizzati i profitti/perdite
//    della posizione aperta in replay le etichette tp-sl-stop profit eccetera, si aggiornerà anche
//    quello che è la tabella contenente il margine libero, win/loss rate, capitale eccetera
//    dell'account storico quando siamo in modalità replay live.»
//
// MISURATO PRIMA DELLA CORREZIONE (banco con MT5 collegato, la configurazione del proprietario):
//   - la posizione non si disegnava affatto: drawableOnCurrentChart() era false, zero testi con
//     l'euro sulla tela, zero righe in #openPositions (positionBelongsToCurrentView esigeva un
//     mt5Ticket, che una posizione simulata non ha);
//   - con un tick live vero 0,30 più in alto del prezzo del replay, il capitale storico scendeva a
//     8.481 € invece di 10.000 €: floatingPL() valutava la posizione al prezzo di ADESSO.
//
// Qui si misura il comportamento: testi davvero disegnati, numeri del conto, livelli trascinati.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Prepara un replay in Live con MT5 collegato e un prezzo live VERO molto lontano dal punto di
// replay (4300 contro 4080): è la situazione in cui il difetto si vedeva.
const PREPARA = ({mt5 = true, live = true, replay = true} = {}) => {
  const t0 = Date.UTC(2026, 9, 25, 8, 0, 0);
  const R = [];
  for (let i = 0; i < 200; i++) {
    const c = 4000 + i;   // prezzo unico per candela: dice subito QUALE candela è stata usata
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: c, high: c + 0.5, low: c - 0.5, close: c, volume: 10});
  }
  rows = R; baseRows = R; idx = 80; viewEnd = 80;
  currentAssetKey = 'XAUUSD';
  const sel = document.getElementById('market');
  if (sel) sel.value = 'XAUUSD';
  liveModeActive = !!live;
  liveReplayActive = !!replay;
  mt5Connected = !!mt5;
  mt5AccountInfo = mt5 ? {equity: 8000, balance: 8000, margin: 500, margin_free: 7500} : null;
  livePriceByAsset = {'XAUUSD': 4300};   // il feed live continua: adesso il mercato è a 4300
  masterTime = Date.parse(R[80].date);
  positions.length = 0;
  trades.length = 0;
  // Cattura del testo DAVVERO disegnato sulla tela (etichetta P/L, TP, SL).
  if (!window.__testiPatch) {
    window.__testiPatch = true;
    window.__testi = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (txt, x, y, ...rest) {
      try { window.__testi.push(String(txt)); } catch (e) {}
      return orig.call(this, txt, x, y, ...rest);
    };
  }
  window.__testi.length = 0;
};

// Le caselle Target/Stop davvero consegnate al disegno (entry/SL/TP/indici).
const CATTURA_CASELLE = () => {
  if (window.__casellePatch) return;
  window.__casellePatch = true;
  window.__caselle = [];
  const orig = window.drawTpSlZoneBox;
  window.drawTpSlZoneBox = function (ctx, o) {
    try { window.__caselle.push({ownerKey: o.ownerKey, originIdx: o.originIdx, entry: o.entry, sl: o.sl, tp: o.tp, stopProfit: !!o.stopProfit}); } catch (e) {}
    return orig.apply(this, arguments);
  };
};

test('in replay, con MT5 collegato, la posizione aperta si disegna e mostra il P/L live', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara, cattura}) => {
      eval('(' + prepara + ')()');
      eval('(' + cattura + ')()');
      openMarketTrade('BUY');
      const pos = positions[positions.length - 1];
      window.__testi.length = 0; window.__caselle.length = 0;
      draw();
      const riga = [...document.querySelectorAll('#openPositions tr')].find(tr => /BUY/.test(tr.textContent) && tr.textContent.includes('XAUUSD'));
      return {
        entry: pos.entry,
        prezzoReplay: currentPrice(),
        drawable: drawableOnCurrentChart(pos),
        revealed: posRevealedInReplay(pos),
        testiEuro: window.__testi.filter(t => /€/.test(t)),
        casella: window.__caselle.find(c => String(c.ownerKey).startsWith('pos:')) || null,
        rigaTabella: riga ? [...riga.querySelectorAll('td')].map(td => td.textContent.trim()) : null,
        pl: posLivePL(pos),
      };
    }, {prepara: PREPARA.toString(), cattura: CATTURA_CASELLE.toString()});

    assert.equal(r.entry, r.prezzoReplay, 'la posizione deve entrare al prezzo della candela mostrata');
    assert.equal(r.drawable, true, 'con MT5 collegato la posizione del replay deve restare disegnabile');
    assert.equal(r.revealed, true, 'la posizione è alla sua candela di apertura: va rivelata');
    assert.ok(r.testiEuro.some(t => /\+0,00\s*€/.test(t)), 'deve esserci il P/L live accanto alla linea di apertura, non solo TP/SL: ' + JSON.stringify(r.testiEuro));
    assert.ok(r.casella, 'deve essere disegnata la casella Target/Stop della posizione');
    assert.equal(r.casella.entry, r.entry, 'la casella deve partire dall\'entrata vera');
    assert.ok(Number.isFinite(r.casella.sl) && Number.isFinite(r.casella.tp), 'SL e TP devono avere un prezzo');
    assert.ok(r.rigaTabella, 'la posizione deve comparire nella tabella delle posizioni aperte');
    assert.ok(r.rigaTabella.includes('BUY'), 'la riga deve dire il lato');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in replay il conto storico non si valuta al prezzo live di adesso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara}) => {
      eval('(' + prepara + ')()');
      const capitalePrima = equityNow();
      openMarketTrade('BUY');
      const pos = positions[positions.length - 1];
      return {
        capitalePrima,
        capitale: equityNow(),
        floating: floatingPL(),
        margineLibero: freeMargin(),
        usato: usedMargin(),
        mt5StatsActive: mt5StatsActive(),
        entry: pos.entry,
        prezzoLiveVero: livePriceByAsset['XAUUSD'],
        // Il valore che si sarebbe visto col difetto: (4300 - 4080) * 100 once * 1 lotto.
        valoreColDifetto: (4300 - 4080) * 100,
      };
    }, {prepara: PREPARA.toString()});

    assert.equal(r.mt5StatsActive, false, 'in replay i numeri del conto devono essere quelli dello storico, non del conto MT5');
    assert.equal(r.floating, 0, 'appena aperta, una posizione al prezzo del replay ha P/L flottante zero');
    assert.equal(r.capitale, r.capitalePrima, 'il capitale storico non deve muoversi per il prezzo live vero (sarebbe +' + r.valoreColDifetto + ' €)');
    assert.equal(r.margineLibero, r.capitale - r.usato, 'margine libero = capitale - margine usato, tutto del conto storico');
    assert.ok(r.margineLibero > 5000, 'il margine libero non deve essere quello vero del conto MT5 (7.500) né un numero da prezzo live');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in replay il P/L live segue il prezzo del replay, non quello vero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara}) => {
      eval('(' + prepara + ')()');
      openMarketTrade('BUY');
      const pos = positions[positions.length - 1];
      const plAllApertura = posLivePL(pos);
      const capitaleAllApertura = equityNow();
      // Il replay avanza di una candela: 4080 -> 4081 (il prezzo VERO resta 4300).
      idx = 81; viewEnd = 81;
      const plAvanti = posLivePL(pos);
      const capitaleAvanti = equityNow();
      const atteso = calculateForexPL('BUY', pos.entry, rows[81].close, pos.lots, 'XAUUSD');
      return {plAllApertura, plAvanti, atteso, capitaleAllApertura, capitaleAvanti,
        prezzoReplay: rows[81].close, prezzoLiveVero: livePriceByAsset['XAUUSD']};
    }, {prepara: PREPARA.toString()});

    assert.equal(r.plAllApertura, 0, 'all\'apertura il P/L è zero');
    assert.equal(r.plAvanti, r.atteso, 'il P/L deve essere calcolato sul prezzo del replay (' + r.prezzoReplay + ')');
    assert.ok(r.plAvanti > 0, 'con il prezzo del replay salito, il BUY è in guadagno: ' + r.plAvanti);
    assert.equal(r.capitaleAvanti, r.capitaleAllApertura + r.plAvanti,
      'il capitale storico deve seguire il P/L del replay, non il prezzo vero ' + r.prezzoLiveVero);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in replay SL e TP della posizione aperta si possono spostare', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara, cattura}) => {
      eval('(' + prepara + ')()');
      eval('(' + cattura + ')()');
      openMarketTrade('BUY');
      const pos = positions[positions.length - 1];
      const slPrima = pos.sl, tpPrima = pos.tp;
      active = pos;                                  // come quando la si seleziona col dito
      setTradeLevel('SL', pos.entry - 2);            // stop trascinato più stretto
      setTradeLevel('TP', pos.entry + 5);            // target trascinato più largo
      window.__caselle.length = 0;
      draw();
      const casella = window.__caselle.find(c => String(c.ownerKey).startsWith('pos:'));
      return {
        slPrima, tpPrima,
        slDopo: pos.sl, tpDopo: pos.tp,
        slDisegnato: casella ? casella.sl : null,
        tpDisegnato: casella ? casella.tp : null,
        entry: pos.entry,
      };
    }, {prepara: PREPARA.toString(), cattura: CATTURA_CASELLE.toString()});

    assert.notEqual(r.slDopo, r.slPrima, 'lo stop deve essersi spostato');
    assert.notEqual(r.tpDopo, r.tpPrima, 'il target deve essersi spostato');
    assert.equal(r.slDopo, r.entry - 2, 'lo stop deve stare dove lo si è portato');
    assert.equal(r.tpDopo, r.entry + 5, 'il target deve stare dove lo si è portato');
    assert.equal(r.slDisegnato, r.slDopo, 'il disegno deve mostrare lo stop nuovo');
    assert.equal(r.tpDisegnato, r.tpDopo, 'il disegno deve mostrare il target nuovo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nel conto Storico, con MT5 collegato, la posizione aperta resta a grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara}) => {
      // Storico (backtest): liveModeActive false, nessun replay. MT5 resta collegato in background.
      eval('(' + prepara + ')({mt5: true, live: false, replay: false})');
      openMarketTrade('BUY');
      const pos = positions[positions.length - 1];
      window.__testi.length = 0;
      draw();
      return {
        entry: pos.entry,
        drawable: drawableOnCurrentChart(pos),
        testiEuro: window.__testi.filter(t => /€/.test(t)),
      };
    }, {prepara: PREPARA.toString()});

    assert.equal(r.drawable, true, 'nel conto Storico una posizione simulata non deve essere filtrata via da MT5');
    assert.ok(r.testiEuro.length > 0, 'la posizione deve mostrare i suoi valori sul grafico');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------------------------------------
// I CASI TROVATI DAL REVISORE (26 ottobre 2026), tutti misurati prima di correggerli.
// Il conto storico in replay era ancora mescolato col conto reale, nei due sensi, e il filtro
// della vista era troppo largo: dopo lo STOP una posizione simulata entrava nel conto MT5.
// ---------------------------------------------------------------------------------------------

test('in replay il conto storico non contiene i soldi del conto reale, e contiene i propri', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara}) => {
      const esiti = {};
      // A) Una posizione MT5 REALE aperta (+250 di profitto vero): non deve entrare nel capitale storico.
      eval('(' + prepara + ')()');
      positions.push({id: 'reale1', asset: 'XAUUSD', side: 'BUY', entry: 4000, lots: 0.1, sl: null, tp: null,
        start: 80, startTime: Date.parse(rows[80].date), marginUsed: 400, mt5Ticket: 111});
      esiti.A = {equity: equityNow(), floating: floatingPL(), base: baseCapital()};

      // B) Un'operazione MT5 REALE chiusa a -3.000: non deve togliere soldi al capitale storico.
      eval('(' + prepara + ')()');
      trades.push({id: 't1', mode: currentMode(), asset: 'XAUUSD', side: 'BUY', entry: 4000, exit: 3970,
        lots: 1, pl: -3000, mt5Ticket: 222, mt5Login: '999',
        startTime: Date.parse(rows[10].date), closeTime: Date.parse(rows[20].date)});
      esiti.B = {equity: equityNow(), closedPL: closedPL(), base: baseCapital()};

      // C) Un'operazione SIMULATA del replay chiusa a +1.000: deve entrare nel capitale storico.
      eval('(' + prepara + ')()');
      trades.push({id: 't2', mode: currentMode(), asset: 'XAUUSD', side: 'BUY', entry: 4080, exit: 4090,
        lots: 1, pl: 1000, historical: true,
        startTime: Date.parse(rows[80].date), closeTime: Date.parse(rows[90].date)});
      esiti.C = {equity: equityNow(), closedPL: closedPL(), base: baseCapital()};

      // D) Il margine libero storico non sconta il margine delle posizioni reali.
      eval('(' + prepara + ')()');
      positions.push({id: 'reale2', asset: 'XAUUSD', side: 'BUY', entry: 4000, lots: 0.1, sl: null, tp: null,
        start: 80, startTime: Date.parse(rows[80].date), marginUsed: 999, mt5Ticket: 333});
      esiti.D = {margineLibero: freeMargin(), usato: usedMargin()};
      return esiti;
    }, {prepara: PREPARA.toString()});

    assert.equal(r.A.equity, r.A.base, 'una posizione MT5 reale non deve entrare nel capitale storico (era ' + r.A.equity + ')');
    assert.equal(r.A.floating, 0, 'il P/L flottante storico non deve contenere il profitto vero del conto MT5');
    assert.equal(r.B.equity, r.B.base, 'un\'operazione MT5 reale chiusa non deve togliere soldi al conto storico (era ' + r.B.equity + ')');
    assert.equal(r.B.closedPL, 0, 'le operazioni reali MT5 non fanno parte del conto storico');
    assert.equal(r.C.equity, r.C.base + 1000, 'un\'operazione simulata del replay chiusa in utile DEVE entrare nel capitale storico');
    assert.equal(r.C.closedPL, 1000, 'il risultato delle operazioni simulate deve contare');
    assert.equal(r.D.usato, 0, 'il margine usato storico non deve contenere quello delle posizioni reali');
    assert.equal(r.D.margineLibero, r.A.base, 'il margine libero storico non deve scontare il margine del conto reale');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in replay una posizione nata nel replay non viene chiusa dal prezzo di oggi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara}) => {
      eval('(' + prepara + ')()');
      slTpScanDoneForAsset = 'XAUUSD';   // come dopo la scansione dello storico in Live
      openMarketTrade('BUY');
      const pos = positions[positions.length - 1];
      pos.tp = pos.entry + 10;           // target raggiungibile SOLO dal prezzo vero di oggi (4300)
      pos.sl = pos.entry - 10;
      const prima = {aperte: positions.length, pl: posLivePL(pos), prezzoReplay: prezzoMostratoOra(),
        prezzoOggi: livePriceByAsset['XAUUSD'], tp: pos.tp};
      evaluate();
      return {prima, aperteDopo: positions.length, chiusiDopo: trades.length,
        candelaDelReplay: rows[80].close, candelaDiOggi: rows[rows.length - 1].close};
    }, {prepara: PREPARA.toString()});

    assert.equal(r.aperteDopo, r.prima.aperte,
      'la posizione aperta in replay non deve essere chiusa dalla candela di oggi (' + r.candelaDiOggi +
      ') mentre il replay è fermo a ' + r.candelaDelReplay);
    assert.equal(r.chiusiDopo, 0, 'non deve nascere nessun trade chiuso dal prezzo del futuro');
    assert.equal(r.prima.pl, 0, 'il P/L a grafico è zero al prezzo del replay');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la vista Live normale resta com\'era: dentro solo le posizioni del conto reale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara}) => {
      // Live normale con MT5 collegato.
      eval('(' + prepara + ')({mt5: true, live: true, replay: false})');
      const reale = {id: 'r', asset: 'XAUUSD', side: 'BUY', entry: 4300, lots: 0.1, sl: null, tp: null,
        start: 80, startTime: Date.parse(rows[80].date), marginUsed: 0, mt5Ticket: 777};
      const simulata = {id: 's', asset: 'XAUUSD', side: 'BUY', entry: 4300, lots: 0.1, sl: null, tp: null,
        start: 80, startTime: Date.parse(rows[80].date), marginUsed: 0};
      const capital = {id: 'c', asset: 'XAUUSD', side: 'BUY', entry: 4300, lots: 0.1, sl: null, tp: null,
        start: 80, startTime: Date.parse(rows[80].date), marginUsed: 0, historical: false};
      const live = {reale: positionBelongsToCurrentView(reale), simulata: positionBelongsToCurrentView(simulata),
        capital: positionBelongsToCurrentView(capital)};

      // In replay: solo quella nata nel replay.
      liveReplayActive = true;
      const inReplay = {reale: positionBelongsToCurrentView(reale), simulata: positionBelongsToCurrentView(simulata),
        capital: positionBelongsToCurrentView(capital)};

      // Dopo lo STOP la posizione nata nel replay non deve entrare nel conto reale.
      liveReplayActive = false;
      const nataNelReplay = {id: 'h', asset: 'XAUUSD', side: 'BUY', entry: 4300, lots: 0.1, sl: null, tp: null,
        start: 80, startTime: Date.parse(rows[80].date), marginUsed: 0, historical: true};
      return {live, inReplay, dopoStop: positionBelongsToCurrentView(nataNelReplay)};
    }, {prepara: PREPARA.toString()});

    assert.equal(r.live.reale, true, 'in Live con MT5 collegato la posizione del conto reale si vede');
    assert.equal(r.live.simulata, false, 'in Live con MT5 collegato una posizione senza ticket non deve entrare (era così prima)');
    assert.equal(r.live.capital, false, 'in Live con MT5 collegato una posizione Capital.com non deve entrare (era così prima)');
    assert.equal(r.inReplay.reale, false, 'in replay una posizione reale MT5 non deve comparire sul grafico del passato');
    assert.equal(r.inReplay.capital, false, 'in replay una posizione reale Capital.com non deve comparire sul grafico del passato');
    assert.equal(r.inReplay.simulata, false, 'in replay solo le posizioni nate nel replay (historical)');
    assert.equal(r.dopoStop, false, 'dopo lo STOP una posizione simulata non deve entrare nel conto reale MT5');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
