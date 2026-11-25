// Replay-live: un trade storico chiuso deve comparire nel Journal/conto replay,
// e restare visibile nella sessione storico corretta quando si esce dal replay.
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
  mt5Connected = false; mt5AccountInfo = null; livePriceByAsset = {XAUUSD: R[80].close};
  masterTime = Date.parse(R[80].date);
  positions.length = 0; trades.length = 0; pendingOrders.length = 0;
  equity = [10000];
  if ($('capital')) $('capital').value = '10000';
  sessionByMode.backtest = {positions:[], pendingOrders:[], active:null, equity:[10000], drawings:[], capital:'10000', trades:[]};
  sessionByMode.live = {positions:[], pendingOrders:[], active:null, equity:[10000], drawings:[], capital:'10000', trades:[]};
};

test('replay-live: chiusura storica visibile in Journal e nel conto replay', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara}) => {
      eval('(' + prepara + ')()');
      openMarketTrade('BUY');
      const pos = positions[positions.length - 1];
      idx = 85; viewEnd = 85;
      closeTrade('TP', rows[85].close, pos);
      update();
      const bt = (sessionByMode.backtest && sessionByMode.backtest.trades) || [];
      const inGlobal = trades.filter(t => t && t.historical);
      const inStats = statsTrades().filter(t => t && t.historical);
      const journal = (document.getElementById('journal') && document.getElementById('journal').textContent) || '';
      return {
        bucket: bt.length,
        globalHist: inGlobal.length,
        statsHist: inStats.length,
        journalHasXau: /XAUUSD/.test(journal),
        realCloseAt: Number.isFinite(bt[0]?.realCloseAt) || Number.isFinite(inGlobal[0]?.realCloseAt),
      };
    }, {prepara: PREPARA.toString()});
    assert.equal(r.bucket, 1);
    assert.equal(r.globalHist, 1);
    assert.equal(r.statsHist, 1);
    assert.equal(r.journalHasXau, true);
    assert.equal(r.realCloseAt, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('replay-live: dopo uscita dal replay il trade resta nel Journal storico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara}) => {
      eval('(' + prepara + ')()');
      openMarketTrade('BUY');
      const pos = positions[positions.length - 1];
      idx = 85; viewEnd = 85;
      closeTrade('TP', rows[85].close, pos);
      liveModeActive = false; liveReplayActive = false;
      restoreModeSnapshot(currentMode());
      update();
      const journal = (document.getElementById('journal') && document.getElementById('journal').textContent) || '';
      const bt = (sessionByMode.backtest && sessionByMode.backtest.trades) || [];
      return {bucket: bt.length, journalHasXau: /XAUUSD/.test(journal), mode: currentMode()};
    }, {prepara: PREPARA.toString()});
    assert.equal(r.mode, 'backtest');
    assert.equal(r.bucket, 1);
    assert.equal(r.journalHasXau, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
