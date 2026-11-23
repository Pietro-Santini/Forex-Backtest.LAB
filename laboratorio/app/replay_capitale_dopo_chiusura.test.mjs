// In replay, chiudere una posizione deve aggiornare il capitale del conto storico.
// Segnalato: "quando la chiude non aggiorna il capitale del conto storico, mentre invece nel
// trade journal la fa vedere la posizione con il suo profitto/perdita" (modalità backtest in replay).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = () => {
  const t0 = Date.UTC(2026, 9, 25, 8, 0, 0);
  const R = [];
  for (let i = 0; i < 200; i++) {
    const c = 4000 + i;
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: c, high: c + 0.5, low: c - 0.5, close: c, volume: 10});
  }
  rows = R; baseRows = R; idx = 80; viewEnd = 80;
  currentAssetKey = 'XAUUSD';
  const sel = document.getElementById('market');
  if (sel) sel.value = 'XAUUSD';
  liveModeActive = true;
  liveReplayActive = true;
  mt5Connected = true;
  mt5AccountInfo = {equity: 8000, balance: 8000, margin: 500, margin_free: 7500};
  livePriceByAsset = {'XAUUSD': 4300};
  masterTime = Date.parse(R[80].date);
  positions.length = 0;
  trades.length = 0;
  equity = [10000];
};

test('in replay, chiudere una posizione aggiorna il capitale storico e il journal la mostra', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara}) => {
      eval('(' + prepara + ')()');
      openMarketTrade('BUY');
      const pos = positions[positions.length - 1];
      // Avanza il replay di una candela: il BUY entra in guadagno.
      idx = 81; viewEnd = 81;
      const capitalePrima = equityNow();
      const plFlottante = posLivePL(pos);
      const prezzoChiusura = rows[81].close;
      closeTrade('MANUALE', prezzoChiusura, pos);
      return {
        capitalePrima,
        plFlottante,
        capitaleDopo: equityNow(),
        chiusi: trades.length,
        trade: trades[0] ? {pl: trades[0].pl, mode: trades[0].mode, historical: trades[0].historical} : null,
        aperte: positions.length,
        sessionBacktestEquity: (sessionByMode.backtest && sessionByMode.backtest.equity) || [],
      };
    }, {prepara: PREPARA.toString()});

    assert.equal(r.aperte, 0, 'la posizione deve essere chiusa');
    assert.equal(r.chiusi, 1, 'il trade deve essere nel journal');
    assert.ok(r.plFlottante > 0, 'premessa: la posizione era in guadagno');
    assert.equal(r.trade.pl, r.plFlottante, 'il journal deve registrare il P/L');
    // Le posizioni replay devono finire nella sessione STORICO, non live.
    assert.equal(r.trade.mode, 'backtest');
    assert.equal(r.trade.historical, true);
    // Il capitale live non deve essere contaminato dal trade storico; lo storico riceve il P/L.
    const capStorico = r.sessionBacktestEquity.at(-1);
    assert.ok(Math.abs(capStorico - (10000 + r.trade.pl)) < 0.01,
      'equity sessione storico deve includere il P/L: ' + capStorico);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
