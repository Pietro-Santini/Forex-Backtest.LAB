// Quanto avrebbe reso una sala: conto iniziale + percentuale per segnale → curva di crescita.
//
// RICHIESTO dal proprietario (7 ottobre 2026): «imposto il conto iniziale, imposto quanto in
// percentuale investo su ogni singola operazione, e alla fine mi fa vedere il rapporto rendimento
// delle operazioni, il numero totale delle operazioni e quanto ha reso quella sala».
//
// È il genere di conto in cui un errore non si vede: il numero esce comunque, e sembra sensato.
// Per questo i casi qui sotto sono scelti perché il risultato giusto si può fare a mente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Entrata 100, stop 90 → si rischiano 10 punti. TP a 110 e 130 → 1R e 3R.
const SEGNALE = (raggiunti, slPreso, extra) => Object.assign({
  valutato: true, entry: 100, sl: 90, tps: [110, 130], raggiunti, slPreso, tFill: 1000
}, extra || {});

test('stop preso senza nessun TP: si perde tutto il rischio', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => fblCronoRendR(
      {valutato:true, entry:100, sl:90, tps:[110,130], raggiunti:0, slPreso:true}));
    assert.equal(r, -1, 'meno una volta il rischio');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('tutti i TP presi: ogni parte vale il suo multiplo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => fblCronoRendR(
      {valutato:true, entry:100, sl:90, tps:[110,130], raggiunti:2, slPreso:false}));
    // Metà posizione a 1R + metà a 3R = 2R.
    assert.equal(r, 2);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('primo TP preso e poi stop: il guadagno resta, il resto si perde', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => fblCronoRendR(
      {valutato:true, entry:100, sl:90, tps:[110,130], raggiunti:1, slPreso:true}));
    // Metà a 1R (+0,5) e metà persa (−0,5) = pari. È il caso che la gente sottovaluta.
    assert.equal(r, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('segnali che non si possono contare restano fuori', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      nonValutato: fblCronoRendR({valutato:false, entry:100, sl:90, tps:[110]}),
      senzaStop:   fblCronoRendR({valutato:true, entry:100, sl:null, tps:[110]}),
      senzaTp:     fblCronoRendR({valutato:true, entry:100, sl:90, tps:[]}),
      stopUguale:  fblCronoRendR({valutato:true, entry:100, sl:100, tps:[110]})
    }));
    assert.deepEqual(r, {nonValutato:null, senzaStop:null, senzaTp:null, stopUguale:null});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la crescita è composta: la percentuale è sul capitale di quel momento', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(([seg]) => {
      const vinta = eval('(' + seg + ')')(2, false);     // +2R
      const c = fblCronoRendCurva([vinta, {...vinta, tFill:2000}], 10000, 10);
      return {finale: Math.round(c.finale), usate: c.usate, vinte: c.vinte,
              resa: Math.round(c.resa * 10) / 10};
    }, [SEGNALE.toString()]);
    // 10.000 → +20% = 12.000 → +20% di 12.000 = 14.400. Se fosse fisso in euro farebbe 14.000:
    // è esattamente la differenza che il proprietario ha chiesto di vedere.
    assert.equal(r.finale, 14400);
    assert.deepEqual({usate:r.usate, vinte:r.vinte, resa:r.resa}, {usate:2, vinte:2, resa:44});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il calo massimo si misura dal punto più alto, non dalla partenza', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(([seg]) => {
      const S = eval('(' + seg + ')');
      // Sale, poi scende: il calo va contato dal massimo raggiunto.
      const c = fblCronoRendCurva([S(2,false,{tFill:1}), S(0,true,{tFill:2})], 10000, 10);
      return Math.round(c.ddMax * 10) / 10;
    }, [SEGNALE.toString()]);
    // 10.000 → 12.000 (picco) → perde 10% di 12.000 = 10.800. Calo dal picco: 10%.
    assert.equal(r, 10);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una vendita conta come una compera, al contrario', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => fblCronoRendR(
      // Venduto a 100, stop a 110, TP a 90 e 70: stessi numeri, dall'altra parte.
      {valutato:true, entry:100, sl:110, tps:[90,70], raggiunti:2, slPreso:false}));
    assert.equal(r, 2, 'il verso non cambia i multipli del rischio');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
