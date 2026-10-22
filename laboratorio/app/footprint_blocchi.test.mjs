// IL REGISTRO DEI TICK SI SALVA A BLOCCHI.
//
// SEGNALATO dal proprietario (22 ottobre 2026): «scatto peggiore 1.264 ms», cioe' un blocco di
// oltre un secondo in cui l'app non risponde. La causa indicata: il salvataggio del registro dei
// tick.
//
// MISURATO sul banco di prova (150.000 tick, il tetto per asset):
//   scrittura di oggi (tutto il registro, ogni volta) ...... 105 ms
//   un blocco da 20.000 tick, con gli oggetti ..............  24 ms
//   un blocco da 20.000 tick, in forma compatta ............ 2,5 ms
// Il costo e' quasi tutto nella copia strutturata di centinaia di migliaia di oggetti.
//
// LA CURA: si scrive SOLO il blocco in coda (non tutto il registro) e in FORMA COMPATTA (quattro
// numeri per tick invece di oggetti). La forma compatta non deve perdere nulla: il footprint
// continua a sapere chi ha comprato e chi ha venduto.
//
// IL TEST MISURA IL COMPORTAMENTO: scrive il registro, lo rilegge (riaprendo la pagina, come fa
// l'utente), e guarda QUANTO si scrive a ogni salvataggio. Non legge il sorgente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Un registro di tick come quello vero: istante, prezzo, lato, peso, provenienza.
const PREPARA_TICK = (n, asset) => {
  const log = [];
  for(let i = 0; i < n; i++){
    log.push({t: 1760000000000 + i * 37, price: 1.1 + (i % 500) / 100000, side: (i % 2) ? 1 : -1, weight: 1, src: 'mt5'});
  }
  return log;
};

test('il registro dei tick si salva a BLOCCHI: indice, blocchi, e il blocco pieno non si riscrive', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // La spia sulle scritture: si vede QUANTO si scrive davvero, non cosa c'e' nel codice.
    await pagina.evaluate(() => {
      window.__scritte = [];
      if(!window.__idbPutOrig)window.__idbPutOrig = window.idbPut;
      window.idbPut = function(k, v){ window.__scritte.push(k); return window.__idbPutOrig(k, v); };
    });

    const primo = await pagina.evaluate(async (asset) => {
      footprintTickLogByAsset = {};
      footprintTickLogByAsset[asset] = [];
      for(let i = 0; i < 25000; i++){
        footprintTickLogByAsset[asset].push({t: 1760000000000 + i * 37, price: 1.1 + (i % 500) / 100000, side: (i % 2) ? 1 : -1, weight: 1, src: 'mt5'});
      }
      footprintTicksDirty = true;
      await saveFootprintTicksNow();
      const idx = await idbGet('ftickIndice');
      const b0 = await idbGet('ftick:' + asset + ':0');
      const b1 = await idbGet('ftick:' + asset + ':1');
      return {indice: idx, b0: b0 ? b0.n : null, b1: b1 ? b1.n : null};
    }, 'TEST');

    assert.ok(primo.indice, 'il registro deve essere salvato a blocchi: esiste un indice (ftickIndice)');
    assert.deepEqual(primo.indice.TEST.len, [20000, 5000],
      '25.000 tick sono due blocchi: uno pieno (20.000) e uno in coda (5.000)');
    assert.equal(primo.b0, 20000, 'il primo blocco contiene i primi 20.000 tick');
    assert.equal(primo.b1, 5000, 'il secondo blocco contiene gli ultimi 5.000');

    // Il secondo salvataggio: un tick in piu'. Il blocco pieno NON si riscrive.
    const secondo = await pagina.evaluate(async (asset) => {
      window.__scritte = [];
      footprintTickLogByAsset[asset].push({t: 1760000000000 + 25000 * 37, price: 1.2, side: 1, weight: 1, src: 'mt5'});
      footprintTicksDirty = true;
      await saveFootprintTicksNow();
      return window.__scritte.slice();
    }, 'TEST');

    assert.ok(secondo.indexOf('ftick:TEST:1') >= 0,
      'il blocco in coda si riscrive: e\' l\'unico che cambia (scritte: ' + JSON.stringify(secondo) + ')');
    assert.ok(secondo.indexOf('ftick:TEST:0') < 0,
      'il blocco PIENO non si riscrive: riscriverlo costerebbe quanto riscrivere tutto (scritte: ' + JSON.stringify(secondo) + ')');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('riscritto e riletto: il registro torna IDENTICO (come all\'ultima riapertura)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(async () => {
      footprintTickLogByAsset = {TEST: []};
      for(let i = 0; i < 25000; i++){
        footprintTickLogByAsset.TEST.push({t: 1760000000000 + i * 37, price: 1.1 + (i % 500) / 100000, side: (i % 2) ? 1 : -1, weight: 1, src: 'mt5'});
      }
      // Un tick storico: ha i campi in piu' (aggr/vol/mode). Se la forma compatta li perde, il
      // footprint smette di sapere chi ha comprato e chi ha venduto.
      footprintTickLogByAsset.TEST.push({t: 1760000000000 + 25000 * 37, price: 1.2, side: 1, weight: 3, aggr: -1, vol: 3, mode: 'flags'});
      footprintTicksDirty = true;
      await saveFootprintTicksNow();
    });

    // Si riapre la pagina: e' quello che fa l'utente la mattina dopo.
    await pagina.reload({waitUntil: 'domcontentloaded'});
    await pagina.waitForFunction(() => (footprintTickLogByAsset.TEST || []).length > 0, {timeout: 20000});

    const riletto = await pagina.evaluate(() => {
      const l = footprintTickLogByAsset.TEST || [];
      const ordine = (x) => Object.keys(x).sort().map(k => k + '=' + JSON.stringify(x[k])).join('|');
      return {
        n: l.length,
        primo: l[0] ? ordine(l[0]) : null,
        ultimo: l[l.length - 1] ? ordine(l[l.length - 1]) : null,
        tickIntermedi: l[12345] ? ordine(l[12345]) : null,
      };
    });

    assert.equal(riletto.n, 25001, 'dopo aver scritto e riletto, i tick sono gli stessi: nessuno perso, nessuno doppio');
    assert.equal(riletto.primo, 'price=1.1|side=-1|src="mt5"|t=1760000000000|weight=1',
      'il primo tick torna identico (i campi contano, l\'ordine delle chiavi no)');
    assert.equal(riletto.ultimo, 'aggr=-1|mode="flags"|price=1.2|side=1|t=1760000925000|vol=3|weight=3',
      'il tick storico torna con TUTTI i suoi campi: aggr, vol e mode sono il cuore del footprint');
    assert.equal(riletto.tickIntermedi, 'price=1.10345|side=1|src="mt5"|t=1760000456765|weight=1',
      'un tick in mezzo torna identico');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il vecchio formato (un blob unico) si legge ancora: chi aveva il registro lo ritrova', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(async () => {
      // Il formato di prima: una chiave sola, con dentro tutto il registro.
      const log = [];
      for(let i = 0; i < 100; i++){
        log.push({t: 1760000000000 + i * 37, price: 1.1 + (i % 50) / 100000, side: (i % 2) ? 1 : -1, weight: 1, src: 'mt5'});
      }
      await idbPut('footprintTicks', {TESTVECCHIO: log});
    });

    await pagina.reload({waitUntil: 'domcontentloaded'});
    await pagina.waitForFunction(() => (footprintTickLogByAsset.TESTVECCHIO || []).length > 0, {timeout: 20000});

    const riletto = await pagina.evaluate(() => ({
      n: (footprintTickLogByAsset.TESTVECCHIO || []).length,
      primo: (footprintTickLogByAsset.TESTVECCHIO || [])[0],
    }));
    assert.equal(riletto.n, 100, 'il registro salvato nel formato vecchio si legge ancora: nessuno perde la sua storia');
    assert.equal(riletto.primo.price, 1.1, 'e i tick sono quelli giusti');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: quando il registro supera il tetto, quello che resta sul disco e\' giusto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const esito = await pagina.evaluate(async () => {
      const MAX = FOOTPRINT_MAX_TICKS_PER_ASSET;
      const asset = 'TESTTAGLIO';
      const nuovo = (i) => ({t: 1760000000000 + i * 37, price: 1 + i / 1000000, side: (i % 2) ? 1 : -1, weight: 1, src: 'mt5'});
      const log = [];
      for(let i = 0; i <= MAX; i++)log.push(nuovo(i));
      footprintTickLogByAsset = {};
      footprintTickLogByAsset[asset] = log;

      // PRIMO SALVATAGGIO: il registro va a blocchi, sul disco.
      footprintTicksDirty = true;
      await saveFootprintTicksNow();

      // Poi il tetto si supera di nuovo, come nella vita vera: il registro e' gia' al tetto e
      // continuano ad arrivare tick. Il registro si accorcia di un blocco intero dalla testa.
      for(let i = MAX + 1; i <= MAX + 20001; i++)log.push(nuovo(i));
      fblTickTaglia(asset, log);
      footprintTicksDirty = true;
      await saveFootprintTicksNow();

      const idx = await idbGet('ftickIndice');
      const vecchioBlocco = await idbGet('ftick:' + asset + ':0');
      return {
        max: MAX,
        rimasti: log.length,
        primoT: log[0].t,
        base: (idx && idx[asset]) ? idx[asset].base : null,
        len: (idx && idx[asset]) ? idx[asset].len : null,
        bloccoVecchioAncora: !!vecchioBlocco,
      };
    });

    // Dopo il taglio il registro e' piu' corto, ma NON vuoto.
    assert.ok(esito.rimasti > 0 && esito.rimasti < esito.max,
      'il tetto si rispetta: il registro si accorcia (' + esito.rimasti + ' tick su ' + esito.max + ')');

    await pagina.reload({waitUntil: 'domcontentloaded'});
    await pagina.waitForFunction(() => (footprintTickLogByAsset.TESTTAGLIO || []).length > 0, {timeout: 30000});

    const riletto = await pagina.evaluate(() => {
      const l = footprintTickLogByAsset.TESTTAGLIO || [];
      return {n: l.length, primoT: l[0] ? l[0].t : null, ultimoT: l[l.length - 1] ? l[l.length - 1].t : null};
    });
    assert.ok(riletto.n > 0, 'dopo il taglio e il salvataggio, il registro sul disco non e\' vuoto');
    assert.equal(riletto.n, esito.rimasti,
      'sul disco c\'e\' esattamente il registro tagliato: niente tick persi e niente tick fuori posto');
    assert.equal(riletto.primoT, esito.primoT,
      'il primo tick sul disco e\' quello giusto: i blocchi non si sono spostati sotto');
    assert.equal(esito.bloccoVecchioAncora, false,
      'il blocco uscito dalla testa sparisce dal disco: il registro non cresce all\'infinito');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
