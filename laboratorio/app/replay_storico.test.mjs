// MODALITÀ STORICO IN REPLAY: le posizioni aperte durante il replay restano simulate.
//
// Richiesto dal proprietario (25 ottobre 2026): «in modalità replay dobbiamo poter aprire
// posizioni che vanno a finire in modalità storico... non devono influire sul conto reale».
//
// Misura del comportamento (non del sorgente): con MT5 "collegato" (mt5Connected=true) e
// liveReplayActive=true, aprire una posizione a mercato NON chiama il bridge (nessun
// mt5Ticket), crea una posizione simulata marcata historical, e non fa crescere l'equity
// (che è del conto reale).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('in replay, BUY a mercato crea una posizione simulata (historical), senza toccare MT5', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      // Dati minimi per aprire
      const t0 = Date.now() - 200*60000; let p = 1.1; const R = [];
      for (let i = 0; i < 200; i++) { const o = p, c = p + Math.sin(i/7)*0.01;
        R.push({date: new Date(t0+i*60000).toISOString(), open:o, high:Math.max(o,c)+0.001, low:Math.min(o,c)-0.001, close:c, volume:10}); p = c; }
      rows = R; baseRows = R; idx = R.length-1; viewEnd = R.length; currentAssetKey = 'EURUSD';
      liveModeActive = true;
      liveReplayActive = true;
      masterTime = Date.parse(R[R.length-1].date);
      mt5Connected = true; // simula MT5 collegato: il guard deve impedire il bridge
      const eqPrima = equity.length;
      const posPrima = positions.length;
      openMarketTrade('BUY');
      const nuova = positions.length > posPrima ? positions[positions.length-1] : null;
      return {
        eqPrima, eqDopo: equity.length,
        posPrima, posDopo: positions.length,
        historical: nuova ? !!nuova.historical : null,
        mt5Ticket: nuova ? nuova.mt5Ticket : 'NA',
        mode: nuova ? nuova.mode : null,
      };
    });
    assert.equal(r.posDopo, r.posPrima + 1, 'deve essersi aperta una posizione');
    assert.equal(r.historical, true, 'la posizione deve essere marcata historical');
    assert.ok(r.mt5Ticket == null, 'nessun ticket MT5: non ha toccato il conto reale');
    assert.equal(r.eqDopo, r.eqPrima, 'equity (conto reale) non deve crescere all\'apertura');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in replay, un ordine pendente creato resta simulato (historical)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const t0 = Date.now() - 200*60000; let p = 1.1; const R = [];
      for (let i = 0; i < 200; i++) { const o = p, c = p + Math.sin(i/7)*0.01;
        R.push({date: new Date(t0+i*60000).toISOString(), open:o, high:Math.max(o,c)+0.001, low:Math.min(o,c)-0.001, close:c, volume:10}); p = c; }
      rows = R; baseRows = R; idx = R.length-1; viewEnd = R.length; currentAssetKey = 'EURUSD';
      liveModeActive = true;
      liveReplayActive = true;
      masterTime = Date.parse(R[R.length-1].date);
      mt5Connected = true;
      $('pendingEntry').value = String(rows[idx].close + 0.05);
      $('slPending').value = String(rows[idx].close - 0.02);
      $('tpPending').value = String(rows[idx].close + 0.1);
      const prima = pendingOrders.length;
      createPendingOrder('BUY');
      const nuovo = pendingOrders.length > prima ? pendingOrders[pendingOrders.length-1] : null;
      return { prima, dopo: pendingOrders.length, historical: nuovo ? !!nuovo.historical : null };
    });
    assert.equal(r.dopo, r.prima + 1, 'deve essersi creato un ordine pendente');
    assert.equal(r.historical, true, 'l\'ordine pendente deve essere marcato historical');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});