// IN REPLAY SI ENTRA AL PREZZO DEL MOMENTO CHE SI STA GUARDANDO.
//
// SEGNALATO dal proprietario il 14 novembre 2026: «quando piazza il tp e sl non prende in
// considerazione il momento in cui si trova sul prezzo ma prende come riferimento da dove è
// partita l'ultima candela e non il prezzo corrente».
//
// MISURATO con una sonda sulla pagina vera, candela in formazione 100,00 / 101,00 / 99,00 /
// 100,50 fermata a META' barra (sub 30 su 60):
//     chiusura dell'ultima candela compiuta ....... 100,0000
//     prezzo corrente VERO del replay ............. 100,1111
//     entry consegnata all'anteprima .............. 100,0000   <- sbagliato
//
// LA CAUSA: si usava currentPrice(), che da' rows[idx].close - la chiusura dell'ultima candela
// COMPIUTA, cioe' esattamente l'apertura di quella in formazione. Le parole del proprietario,
// alla lettera.
//
// E NON ERA SOLO IL DISEGNO: la stessa fonte alimentava openMarketTrade(), quindi la posizione
// ENTRAVA DAVVERO a quel prezzo. Non un difetto estetico: P/L, Trade Journal, statistiche ed
// equity del backtest venivano calcolati su un prezzo mai esistito in quel momento.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Una candela in formazione, e ci si ferma a meta'. Gli stessi numeri della misura.
const META_CANDELA = `(() => {
  const base = Date.parse('2026-11-13T10:00:00Z');
  rows = [];
  for (let i = 0; i < 6; i++) {
    rows.push({date: new Date(base + i * 60000).toISOString().slice(0,16).replace('T',' '),
               open: 100, high: 100.05, low: 99.95, close: 100, volume: 1});
  }
  baseRows = rows.slice();
  rowsAssetKey = currentAssetKey = 'XAUUSD';
  currentTF = 1;
  idx = 4;
  liveReplayActive = true;
  // La candela 5 si sta formando: 100 -> 101 -> 99 -> 100,50, e siamo a meta' del tempo.
  replayForm = {idx: 5, sub: 30, perBar: 60,
                path: replaySintesiPath({open: 100, high: 101, low: 99, close: 100.5}, 61)};
})`;

test('a meta candela il prezzo per un ordine NON e l apertura della candela', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)();
      return {
        chiusuraUltimaCompiuta: rows[idx].close,
        aperturaInFormazione: replayForm.path[0],
        prezzoMostrato: prezzoMostratoOra(),
        perOrdine: prezzoOraPerOrdine(),
        currentPrice: currentPrice(),
      };
    }, META_CANDELA);
    console.log('prezzi:', JSON.stringify(r));
    assert.equal(r.perOrdine, r.prezzoMostrato,
      'il prezzo per un ordine deve essere quello che l utente sta VEDENDO: ' + JSON.stringify(r));
    assert.notEqual(r.perOrdine, r.chiusuraUltimaCompiuta,
      'non puo essere la chiusura dell ultima candela compiuta, che e da dove e partita quella ' +
      'in formazione: e il difetto segnalato. ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('muovendosi dentro la barra, il prezzo per l ordine si muove con lei', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)();
      const letti = [];
      [0, 10, 30, 50, 60].forEach(sub => {
        replayForm.sub = sub;
        letti.push({sub, prezzo: prezzoOraPerOrdine()});
      });
      return letti;
    }, META_CANDELA);
    console.log('lungo la barra:', JSON.stringify(r));
    const valori = r.map(x => x.prezzo);
    assert.equal(new Set(valori).size > 2, true,
      'fermandosi in punti diversi della candela il prezzo deve essere diverso: ' +
      JSON.stringify(r));
    assert.equal(valori[0], 100, 'a inizio barra e l apertura');
    assert.equal(valori[valori.length - 1], 100.5, 'a fine barra e la chiusura');
  } finally { await browser.close(); }
});

test('IN REPLAY NESSUN PREZZO DEL PRESENTE entra in un ordine', async () => {
  // Il ramo peggiore, misurato: con un tick dal vivo in memoria currentPrice() restituiva il
  // prezzo di ADESSO (123,456) invece di quello del momento rivisto. Un ordine ancorato li'
  // non ha niente a che vedere con la candela guardata.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)();
      replayForm = null;                       // PLAY in pausa: nessuna formazione
      try { lastPrimaryEpicPrice = 123.456; } catch (e) {}
      try { lastMt5TickPrice = 123.456; } catch (e) {}
      return {perOrdine: prezzoOraPerOrdine(), chiusuraMostrata: rows[idx].close,
              currentPrice: currentPrice()};
    }, META_CANDELA);
    console.log('tick dal vivo:', JSON.stringify(r));
    assert.notEqual(r.perOrdine, 123.456,
      'in replay il prezzo del presente non puo MAI entrare in un ordine: ' + JSON.stringify(r));
    assert.equal(r.perOrdine, r.chiusuraMostrata,
      'senza formazione si usa la chiusura della candela che si sta guardando');
  } finally { await browser.close(); }
});

test('FUORI dal replay non cambia niente', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)();
      liveReplayActive = false; replayForm = null;
      try { lastPrimaryEpicPrice = 123.456; } catch (e) {}
      return {perOrdine: prezzoOraPerOrdine(), currentPrice: currentPrice()};
    }, META_CANDELA);
    console.log('fuori dal replay:', JSON.stringify(r));
    assert.equal(r.perOrdine, r.currentPrice,
      'fuori dal replay la fonte resta currentPrice(), identica a prima: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('la posizione ENTRA davvero al prezzo del momento, non solo nel disegno', async () => {
  // La parte che conta per i conti: P/L, Journal, statistiche ed equity nascono da qui.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)();
      positions.length = 0;
      const atteso = prezzoOraPerOrdine();
      try { openMarketTrade('BUY'); } catch (e) { return {errore: e.message}; }
      const pos = positions[positions.length - 1];
      return {atteso, entry: pos ? pos.entry : null,
              chiusuraUltimaCompiuta: rows[idx].close};
    }, META_CANDELA);
    console.log('riempimento:', JSON.stringify(r));
    assert.ok(!r.errore, 'apertura non riuscita: ' + r.errore);
    assert.equal(r.entry, r.atteso,
      'la posizione deve entrare al prezzo del momento guardato: ' + JSON.stringify(r));
    assert.notEqual(r.entry, r.chiusuraUltimaCompiuta,
      'entrare alla chiusura della candela precedente falsa P/L, Journal, statistiche ed ' +
      'equity del backtest: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});
