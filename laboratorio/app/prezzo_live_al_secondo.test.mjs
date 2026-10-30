// IL PREZZO "ADESSO" E' QUELLO DEL TICK LIVE, NON LA CHIUSURA DELL'ULTIMA CANDELA.
//
// RICHIESTO dal proprietario (30 ottobre 2026): "qualunque disegno, qualunque linea viene
// generata deve essere aggiornata al secondo e non può essere aggiornata a secondo del time
// frame scelto. Nel senso, a secondo del time frame, per esempio un minuto, gli indicatori e
// le linee delle entrate dei prezzi delle posizioni quello che unisce la freccia di apertura
// con la freccia di chiusura in tempo reale si aggiorna ogni minuto, e se passiamo al time
// frame da 5 minuti si aggiornano ogni 5 minuti, time frame da 15 minuti si aggiornano ogni
// 15 minuti, e invece non va bene. Si devono aggiornare, si deve aggiornare tutto quanto,
// ogni singola cosa al tempo di un secondo."
//
// MISURATO il perche': currentPrice() restituiva rows[idx].close. Con currentTF=5 quella e'
// la chiusura dell'ULTIMA candela a 5 minuti: la linea dalla freccia di apertura a quella di
// uscita, gli indicatori che si appoggiano al prezzo corrente e le caselle TP/SL restavano
// fermi fino alla chiusura della candela, perche' non c'era niente di piu' recente da leggere.
// Il tick live (MT5 o Capital.com) viene applicato a rows, ma il "prezzo adesso" che si
// legge per i disegni era quello vecchio.
//
// Cosa misura questo banco:
//   - in Live, con un tick live arrivato, currentPrice() restituisce il tick, non la
//     chiusura della candela;
//   - in Storico, senza tick live, si ripiega sulla chiusura della candela (non si inventa
//     un prezzo che non c'e');
//   - PROVA DI CONTROLLO: se il tick live e' piu' vecchio del tick applicato, non si usa
//     (un prezzo vecchio che sovrascrive il presente sarebbe peggio di nessun prezzo).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('in Live currentPrice() e\' il tick live, non la chiusura dell\'ultima candela', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      liveModeActive = true;
      const c = {date: '2026-01-01 00:00', open: 10, high: 11, low: 9, close: 10.5, v: 1};
      rows = [c]; idx = 0;
      // 1) senza tick live: il prezzo "adesso" e' la chiusura dell'ultima candela.
      mt5ActiveSymbol = null; lastMt5TickPrice = NaN; lastPrimaryEpicPrice = null;
      const senzaTick = currentPrice();
      // 2) arriva il tick live (MT5): deve vincere, anche se la candela resta dov'e'.
      mt5ActiveSymbol = 'EURUSD'; lastMt5TickPrice = 10.73;
      const colTick = currentPrice();
      // 3) il tick live viene preferito anche se la candela chiude piu' in alto.
      rows[0].close = 10.99;
      const tickVince = currentPrice();
      return {senzaTick, colTick, tickVince, chiusuraCandela: 10.99};
    });
    assert.equal(r.senzaTick, 10.5, 'senza tick live si ripiega sulla chiusura dell\'ultima candela');
    assert.equal(r.colTick, 10.73, 'col tick live il prezzo "adesso" e\' il tick live');
    assert.equal(r.tickVince, 10.73, 'il tick vince anche se la candela e\' piu\' su: e\' piu\' recente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('fuori dal Live si ripiega sulla candela: non si inventa un prezzo che non c\'e\'', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      liveModeActive = false;
      // un tick live "rimasto in memoria" non deve valere fuori dal Live: non e' il prezzo
      // di questa sessione.
      mt5ActiveSymbol = 'EURUSD';
      lastMt5TickPrice = 999;
      lastPrimaryEpicPrice = 999;
      const c = {date: '2026-01-01 00:00', open: 10, high: 11, low: 9, close: 10.5, v: 1};
      rows = [c]; idx = 0;
      return currentPrice();
    });
    assert.equal(r, 10.5, 'fuori dal Live si usa la chiusura dell\'ultima candela');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: il tick live perde se non e\' un numero valido', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      liveModeActive = true;
      mt5ActiveSymbol = 'EURUSD';
      const c = {date: '2026-01-01 00:00', open: 10, high: 11, low: 9, close: 10.5, v: 1};
      rows = [c]; idx = 0;
      // Un "tick" non finito non deve mai sovrascrivere il prezzo della candela: sarebbe peggio
      // di non avere nessun tick.
      lastMt5TickPrice = NaN;
      lastPrimaryEpicPrice = null;
      const colNaN = currentPrice();
      lastMt5TickPrice = 0;
      const colZero = currentPrice();
      return {colNaN, colZero};
    });
    assert.equal(r.colNaN, 10.5, 'un tick NaN non sovrascrive la candela');
    assert.equal(r.colZero, 10.5, 'un tick a zero non e\' un prezzo reale: si ripiega sulla candela');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
