// Le linee di SL e TP delle posizioni Kraken devono restare FERME.
//
// SEGNALATO dal proprietario (7 ottobre 2026): «nell'account Kraken, quando apro una posizione, il
// TP e SL avanzano, cioè si spostano con lo spostarsi del prezzo. Le linee TP e SL devono rimanere
// ferme. Quando arriva il prezzo alla linea, chiudiamo la posizione.»
//
// Causa: il grafico mostra i prezzi di Binance, Kraken esegue ai suoi. La piccola differenza
// veniva compensata con uno scostamento RICALCOLATO a ogni disegno: muovendosi il prezzo, si
// muoveva anche lo scostamento, e con lui le linee. Una linea di stop che insegue il prezzo non
// dice più dove si chiuderà la posizione.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('lo scostamento si calcola una volta sola e poi non cambia', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const k = 'kraken:PF_XBTUSD:100';
      // Primo disegno: prezzo a grafico 101, prezzo Kraken 100 → scostamento +1.
      const primo = krakenScostamento(k, 101, 100);
      // Il prezzo sale: lo scostamento NON deve seguirlo.
      const dopoSalita = krakenScostamento(k, 140, 100);
      const dopoDiscesa = krakenScostamento(k, 60, 100);
      return {primo, dopoSalita, dopoDiscesa};
    });
    assert.equal(r.primo, 1);
    assert.equal(r.dopoSalita, 1, 'lo scostamento ha seguito il prezzo: le linee si muoverebbero');
    assert.equal(r.dopoDiscesa, 1);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una differenza troppo grande non si compensa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      // Oltre il 2% non è una differenza fra mercati: è un altro asset, o un prezzo vecchio.
      // Compensarla sposterebbe le linee a caso.
      enorme: krakenScostamento('a', 150, 100),
      senzaPrezzo: krakenScostamento('b', NaN, 100),
      senzaMark: krakenScostamento('c', 100, 0),
      // Dentro il 2% si compensa, perché lì serve davvero.
      piccola: krakenScostamento('d', 100.5, 100)
    }));
    assert.deepEqual(r, {enorme: 0, senzaPrezzo: 0, senzaMark: 0, piccola: 0.5});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una posizione nuova sullo stesso contratto ricalcola da capo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const vecchia = krakenScostamento('kraken:PF_XBTUSD:100', 101, 100);
      // La posizione si chiude: il suo scostamento non deve restare in giro.
      krakenScostamentiPulisci([]);
      // Se ne apre un'altra, allo stesso contratto ma a un'altra entrata.
      const nuova = krakenScostamento('kraken:PF_XBTUSD:200', 202, 200);
      return {vecchia, nuova, restano: Object.keys(krakenScostamenti).length};
    });
    assert.equal(r.vecchia, 1);
    assert.equal(r.nuova, 2, 'la posizione nuova ha il suo scostamento, non quello della vecchia');
    assert.equal(r.restano, 1, 'gli scostamenti delle posizioni chiuse non restano in memoria');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('finché la posizione è aperta il suo scostamento non si perde', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const k = 'kraken:PF_ETHUSD:50';
      krakenScostamento(k, 50.2, 50);
      // Giro di disegno successivo: la posizione c'è ancora.
      krakenScostamentiPulisci([k, 'kraken:PF_XBTUSD:100']);
      return krakenScostamenti[k];
    });
    assert.ok(Math.abs(r - 0.2) < 1e-9, 'lo scostamento di una posizione aperta deve sopravvivere');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
