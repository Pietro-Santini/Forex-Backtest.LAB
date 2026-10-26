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
