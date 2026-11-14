// GLI INDICATORI NON POSSONO ANDARE OLTRE L'ULTIMA CANDELA.
//
// SEGNALATO dal proprietario il 14 novembre 2026, con la schermata: «rimane sempre questo
// problema dello sfasamento, gli indicatori vanno avanti rispetto all'ultima candela». Nel suo
// grafico dell'oro le candele finivano alle 21:55 e le medie mobili proseguivano fino al bordo
// destro, nel vuoto, insieme ai riquadri dell'ICT.
//
// MISURATO con una sonda sulla pagina vera (laboratorio/app/sonda_oltre_ultima_candela.mjs):
// con 100 candele in memoria, `fblIdxPerIndicatori()` rispondeva 140. Gli indicatori venivano
// mandati a calcolare QUARANTA BARRE OLTRE L'ULTIMA CANDELA ESISTENTE.
//
// PERCHE': `idx` puo' correre avanti rispetto ai dati - mercato chiuso, margine futuro a destra,
// orologio che avanza - e quella funzione restituiva `idx` senza mai confrontarlo con quante
// candele ci sono davvero. Da li' in poi `rows[i]` e' undefined: il calcolo lavora nel vuoto, e
// il disegno lo segue perche' le funzioni di disegno si fermano a `st.builtTo`, che valeva 140.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Cento candele da un minuto: la stessa forma della schermata del proprietario.
const PREPARA = `(() => {
  const base = Date.parse('2026-11-13T20:16:00Z');
  rows = [];
  for (let i = 0; i < 100; i++) {
    const t = base + i * 60000;
    rows.push({date: new Date(t).toISOString().slice(0,16).replace('T',' '),
               open: 3875, high: 3876, low: 3874, close: 3875, volume: 1});
  }
  baseRows = rows.slice();
  rowsAssetKey = currentAssetKey = 'XAUUSD';
  currentTF = 1;
})`;

test('con l indice avanti nel tempo, gli indicatori si fermano all ultima candela', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)();
      liveModeActive = false;           // niente regola della candela in formazione
      idx = rows.length + 40;           // l indice e corso avanti: mercato chiuso
      return {candele: rows.length, idx, perIndicatori: fblIdxPerIndicatori()};
    }, PREPARA);
    console.log('indice avanti:', JSON.stringify(r));
    assert.equal(r.perIndicatori, r.candele - 1,
      'con ' + r.candele + ' candele e indice a ' + r.idx + ', gli indicatori devono fermarsi ' +
      'a ' + (r.candele - 1) + '. Prima rispondeva ' + r.idx + ', cioe quaranta barre nel ' +
      'vuoto. Ottenuto: ' + r.perIndicatori);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in DIRETTA la candela in formazione resta esclusa (regola di prima, intatta)', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)();
      liveModeActive = true; liveReplayActive = false;
      idx = rows.length - 1;            // l ultima candela, quella che sta ancora cambiando
      return {perIndicatori: fblIdxPerIndicatori(), ultima: rows.length - 1};
    }, PREPARA);
    console.log('in diretta:', JSON.stringify(r));
    assert.equal(r.perIndicatori, r.ultima - 1,
      'in diretta non si calcola la candela IN FORMAZIONE: cambia a ogni prezzo e farebbe ' +
      'ballare gli indicatori. ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('indietro nel grafico (o in replay) si calcola fin dove sei arrivato', async () => {
  // La cura non deve diventare "si calcola sempre tutto": guardando indietro, o durante un
  // replay, gli indicatori devono fermarsi al punto in cui si e, non all ultima candela nota.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)();
      liveModeActive = false;
      idx = 40;
      return {perIndicatori: fblIdxPerIndicatori()};
    }, PREPARA);
    console.log('indietro:', JSON.stringify(r));
    assert.equal(r.perIndicatori, 40,
      'guardando indietro si calcola fino a dove sei, non oltre: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('senza candele non si calcola niente', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      rows = []; baseRows = []; idx = 5; liveModeActive = false;
      return {perIndicatori: fblIdxPerIndicatori()};
    });
    console.log('senza candele:', JSON.stringify(r));
    assert.ok(r.perIndicatori < 0,
      'con zero candele l indice per gli indicatori deve essere negativo, cosi nessun ciclo ' +
      'parte: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});
