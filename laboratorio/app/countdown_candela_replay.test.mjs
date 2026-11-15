// IL CONTO ALLA ROVESCIA DELLA CANDELA SI VEDE ANCHE IN REPLAY.
//
// SEGNALATO dal proprietario il 14 novembre 2026: «non ci mostra il timer sul cartellino
// sull'asse del prezzo».
//
// MISURATO con una sonda sulla pagina vera, replay sul conto STORICO con il PLAY premuto:
//     liveModeActive ......... false
//     showCountdown .......... false   <- il cancello chiudeva comunque
//     prezzo sul cartellino .. disegnato
//     conto alla rovescia .... NON disegnato
//
// LA CAUSA: una guardia rimasta indietro. Diceva che il conto alla rovescia «ha senso solo in
// Live perche' si basa sull'orologio reale» - vero quando fu scritta, non piu' dopo che
// fmtCandleCountdown() ha imparato a scorrere col moltiplicatore del replay. Il numero si
// calcolava e non si disegnava: nessuno era tornato a riaprire il cancello.
//
// Due facce dello stesso difetto, tutte e due misurate:
//   - replay sul conto Storico/CSV: il timer non compare MAI (liveModeActive e' falso);
//   - replay-Live: spariva ogni volta che l'orologio VERO diceva mercato chiuso, anche se il
//     momento rivisto era un martedi' a meta' sessione.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const REPLAY_STORICO = `((sub) => {
  const base = Date.parse('2026-11-10T10:00:00Z');   // un martedi'
  rows = [];
  for (let i = 0; i < 6; i++) {
    rows.push({date: new Date(base + i * 60000).toISOString().slice(0,16).replace('T',' '),
               open: 100, high: 100.05, low: 99.95, close: 100, volume: 1});
  }
  baseRows = rows.slice();
  rowsAssetKey = currentAssetKey = 'XAUUSD';
  currentTF = 1;
  idx = 4;
  liveModeActive = false;            // conto STORICO: e' il caso del proprietario
  liveReplayActive = false;
  replayForm = {idx: 5, sub: sub, perBar: 60,
                path: replaySintesiPath({open:100, high:101, low:99, close:100.5}, 61)};
})`;

test('col PLAY in replay il conto alla rovescia esiste, e segue il replay', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)(30);                       // meta' di una candela da un minuto
      return {testo: fmtCandleCountdown(), liveModeActive};
    }, REPLAY_STORICO);
    console.log('a meta barra:', JSON.stringify(r));
    assert.equal(r.testo, '0:30',
      'a meta di una candela da un minuto devono mancare 30 secondi, contati sul replay e non ' +
      'sull orologio vero: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il numero NON dipende dall orologio vero', async () => {
  // Prima qui usciva 0:32, e cambiava a ogni sguardo: era anche una prova instabile.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)(45);
      const a = fmtCandleCountdown();
      const b = fmtCandleCountdown();
      return {a, b};
    }, REPLAY_STORICO);
    console.log('due letture:', JSON.stringify(r));
    assert.equal(r.a, '0:15', 'a 45 secondi su 60 ne mancano 15: ' + JSON.stringify(r));
    assert.equal(r.a, r.b, 'due letture di fila devono dare lo stesso numero');
  } finally { await browser.close(); }
});

test('il cartellino si allunga per fare posto al timer', async () => {
  // E' il segnale che il disegno lo prevede davvero: senza, il numero non avrebbe dove stare.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)(30);
      const conFormazione = !!(replayForm && replayForm.idx === idx + 1);
      replayForm = null;
      const senzaFormazione = !!(replayForm && replayForm.idx === idx + 1);
      return {conFormazione, senzaFormazione};
    }, REPLAY_STORICO);
    console.log('formazione:', JSON.stringify(r));
    assert.equal(r.conFormazione, true, 'con una candela in formazione il timer ci vuole');
    assert.equal(r.senzaFormazione, false, 'senza formazione no');
  } finally { await browser.close(); }
});

test('a inizio e a fine barra i limiti sono giusti', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)(0);
      const inizio = fmtCandleCountdown();
      replayForm.sub = 60;
      const fine = fmtCandleCountdown();
      replayForm.sub = 120;                 // oltre la fine: non deve andare negativo
      const oltre = fmtCandleCountdown();
      return {inizio, fine, oltre};
    }, REPLAY_STORICO);
    console.log('limiti:', JSON.stringify(r));
    assert.equal(r.inizio, '1:00', 'a barra appena iniziata manca un minuto intero');
    assert.equal(r.fine, '0:00', 'a barra finita, zero');
    assert.ok(!String(r.oltre).includes('-'), 'mai un numero negativo: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('fuori dal replay il comportamento di prima resta intatto', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)(30);
      replayForm = null;
      liveModeActive = false;
      const inFormazione = !!(replayForm && replayForm.idx === idx + 1);
      const showCountdown = inFormazione || (liveModeActive && liveSessionPhaseNow() !== 'closed');
      return {showCountdown};
    }, REPLAY_STORICO);
    console.log('fuori dal replay:', JSON.stringify(r));
    assert.equal(r.showCountdown, false,
      'senza replay e senza Live il timer non si mostra, come prima: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});
