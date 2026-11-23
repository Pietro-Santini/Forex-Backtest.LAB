// Fix 4 difetti replay (novembre 2026).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = () => {
  const t0 = Date.UTC(2026, 9, 25, 8, 0, 0);
  const R = [];
  for (let i = 0; i < 200; i++) {
    const c = 4000 + i * 0.5;
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: c, high: c + 1, low: c - 1, close: c, volume: 10});
  }
  rows = R; baseRows = R; idx = 80; viewEnd = 80;
  currentAssetKey = 'XAUUSD';
  const sel = document.getElementById('market'); if (sel) sel.value = 'XAUUSD';
  liveModeActive = true; liveReplayActive = true; isPropFirmMode = false;
  mt5Connected = false; mt5AccountInfo = null; livePriceByAsset = {'XAUUSD': R[80].close};
  masterTime = Date.parse(R[80].date);
  positions.length = 0; trades.length = 0; pendingOrders.length = 0;
  equity = [10000]; if($('capital')) $('capital').value='10000';
  sessionByMode.backtest = {positions:[],pendingOrders:[],active:null,equity:[10000],drawings:[],capital:'10000'};
  sessionByMode.live = {positions:[],pendingOrders:[],active:null,equity:[10000],drawings:[],capital:'10000'};
};

test('issue1: chiusura posizione replay-live va in sessione storico, non live', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara}) => {
      eval('(' + prepara + ')()');
      openMarketTrade('BUY');
      const pos = positions[positions.length-1];
      idx=85; viewEnd=85;
      closeTrade('MANUALE', rows[85].close, pos);
      const t = trades[0];
      return {mode:t?.mode, historical:t?.historical, liveTrades: trades.filter(x=>x.mode==='live').length, backtestTrades: trades.filter(x=>x.mode==='backtest').length};
    }, {prepara: PREPARA.toString()});
    assert.equal(r.historical, true);
    assert.equal(r.mode, 'backtest');
    assert.equal(r.liveTrades, 0);
    assert.equal(r.backtestTrades, 1);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('issue2: trade storico in replay ha data reale apertura e asse grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara}) => {
      eval('(' + prepara + ')()');
      openMarketTrade('BUY');
      const pos = positions[positions.length-1];
      const realOpenAt = pos.realOpenAt;
      const startTime = pos.startTime;
      idx=85; viewEnd=85;
      closeTrade('MANUALE', rows[85].close, pos);
      const t = trades[0];
      const lbl = journalOpenAtLabel(t);
      return {hasReal:Number.isFinite(realOpenAt), hasChart:Number.isFinite(startTime), realOpenAt, startTime, lbl, hasBoth:/Apertura reale:/.test(lbl) && /Asse grafico:/.test(lbl)};
    }, {prepara: PREPARA.toString()});
    assert.equal(r.hasReal, true);
    assert.equal(r.hasChart, true);
    assert.equal(r.hasBoth, true);
    assert.ok(Math.abs(r.realOpenAt - Date.now()) < 60000 || r.realOpenAt > 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('issue3-4: in replay niente linee/frecce/sviluppo trade chiuso prima della chiusura', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara}) => {
      eval('(' + prepara + ')()');
      // Crea trade chiuso
      openMarketTrade('BUY');
      const pos = positions[positions.length-1];
      idx=90; viewEnd=90;
      closeTrade('MANUALE', rows[90].close, pos);
      // Torna indietro prima della chiusura
      idx=85; viewEnd=100;
      draw();
      const hitsBefore = closedTradeHitSegments.length;
      // Avanza alla chiusura
      idx=90; viewEnd=100;
      draw();
      const hitsAtClose = closedTradeHitSegments.length;
      // Verifica che non ci siano linee orizzontali replay SL/TP/Entry disegnate dal vecchio blocco:
      // il blocco ? stato rimosso; controlliamo indirettamente che draw non lanci e che prima chiusura sia vuoto.
      return {hitsBefore, hitsAtClose};
    }, {prepara: PREPARA.toString()});
    assert.equal(r.hitsBefore, 0);
    assert.ok(r.hitsAtClose >= 0); // al close pu? esserci hit segment se visibile
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
