// Richiesta: nella colonna STRATEGIA della modale "Apertura automatica" ci deve essere un MENU' A
// TENDINA. Premendolo esce SOLO la configurazione (cosa succede a ogni take profit e dove va lo
// stop), non il riassunto: il riassunto resta in fondo, nel box. Aprendo il menu' di una sala le
// altre restano dove sono (il pannello copre la tabella invece di allungarla). Lo stesso vale per
// la strategia universale.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// due sale accese (forex), nessuna regola a mano: parte "prudente", che il riassunto mostrera'.
const PREPARA = () => {
  positions = []; pendingOrders = []; trades = [];
  tgGruppi = ['@a', '@b']; tgGruppiSyntra = [];
  tgAutoFx = {attivo:true, maxGlobali:40, perditaMaxGiorno:10, perditaAttiva:false, etaMaxS:600,
    sale:{'@a':{attivo:true, rischio:1, maxPosizioni:6}, '@b':{attivo:true, rischio:1, maxPosizioni:6}},
    spentoIl:null, predefinitiV:2, universale:null};
  tgAutoMostraFam('fx');
  document.getElementById('tgAutoOverlay').style.display = 'flex';
};
async function prepara(pagina){
  await pagina.evaluate((p) => { eval('(' + p + ')')(); }, PREPARA.toString());
}

test('la colonna Strategia e\' un menu a tendina: niente riassunto sul pulsante', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina);
    const es = await pagina.evaluate(() => {
      const b = document.querySelector('#tgAutoSale [data-tgstrat="@a"]');
      return {trovato: !!b, testo: b ? b.textContent : null, disabilitato: b ? b.disabled : null};
    });
    assert.equal(es.trovato, true, 'deve esserci il menu della sala');
    assert.equal(es.testo, '\u25b8 Strategia', JSON.stringify(es));
    assert.ok(!/pareggio|TP1|posizione /.test(String(es.testo)), 'il pulsante non deve portare il riassunto: ' + es.testo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('premendo il menu esce solo la configurazione, e le altre sale restano', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina);
    const prima = await pagina.evaluate(() => ({
      righe: document.querySelectorAll('#tgAutoSale tr').length,
      sale: document.querySelectorAll('#tgAutoSale [data-tgstrat]').length
    }));
    await pagina.click('#tgAutoSale [data-tgstrat="@a"]');
    const dopo = await pagina.evaluate(() => {
      const pop = document.querySelector('.tgStratPop');
      return {
        popAperto: !!pop,
        popTesto: pop ? pop.textContent : '',
        righe: document.querySelectorAll('#tgAutoSale tr').length,
        sale: document.querySelectorAll('#tgAutoSale [data-tgstrat]').length,
        saleB: !!document.querySelector('#tgAutoSale [data-tgstrat="@b"]'),
        riepilogo: (document.getElementById('tgAutoRiepilogo') || {}).textContent || ''
      };
    });
    assert.equal(dopo.popAperto, true, 'premendo il menu deve uscire il pannello');
    assert.ok(/Take profit n\. 1/.test(dopo.popTesto), 'il pannello deve contenere la configurazione: ' + dopo.popTesto.slice(0, 200));
    assert.ok(/porta lo stop a/.test(dopo.popTesto), 'deve dire dove va lo stop: ' + dopo.popTesto.slice(0, 200));
    assert.equal(dopo.righe, prima.righe, 'aprire il menu non deve aggiungere righe alla tabella');
    assert.equal(dopo.sale, 2, 'le due sale devono restare');
    assert.equal(dopo.saleB, true, 'l\'altra sala non deve sparire');
    assert.ok(/TP1\u2192pareggio/.test(dopo.riepilogo), 'il riassunto resta in fondo: ' + dopo.riepilogo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il menu si chiude cliccando fuori', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina);
    await pagina.click('#tgAutoSale [data-tgstrat="@a"]');
    assert.equal(await pagina.evaluate(() => !!document.querySelector('.tgStratPop')), true);
    await pagina.click('#tgAutoFamNota');
    assert.equal(await pagina.evaluate(() => !!document.querySelector('.tgStratPop')), false, 'cliccando fuori il pannello sparisce');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('strategia universale: stesso menu a tendina, con la sola configurazione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina);
    await pagina.evaluate(() => { tgAutoFx.universale = {attivo:true, rischio:1, maxPosizioni:10}; tgAutoDisegna(); });
    const b = await pagina.evaluate(() => {
      const x = document.querySelector('#tgAutoUniRegole [data-tgstrat="uni"]');
      const sale = document.querySelector('#tgAutoSale [data-tgstrat="@a"]');
      return {trovato: !!x, testo: x ? x.textContent : null, testoSala: sale ? sale.textContent : null, saleDisab: sale ? sale.disabled : null};
    });
    assert.equal(b.trovato, true, 'deve esserci il menu della strategia universale');
    assert.equal(b.testo, '\u25b8 Strategia universale', JSON.stringify(b));
    assert.equal(b.testoSala, '\u2014', 'con l\'universale accesa le sale non mostrano il riassunto: ' + b.testoSala);
    assert.equal(b.saleDisab, true);
    await pagina.click('#tgAutoUniRegole [data-tgstrat="uni"]');
    const pop = await pagina.evaluate(() => {
      const p = document.querySelector('.tgStratPop');
      return {aperto: !!p, testo: p ? p.textContent : ''};
    });
    assert.equal(pop.aperto, true, 'premendo il menu universale deve uscire il pannello');
    assert.ok(/Take profit n\. 1/.test(pop.testo), 'il pannello deve contenere la configurazione: ' + pop.testo.slice(0, 200));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il campo "Senza stop e senza target" non esiste piu\'', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina);
    const es = await pagina.evaluate(() => ({
      campo: !!document.getElementById('tgAutoTpSenzaNulla'),
      scritta: document.getElementById('tgAutoOverlay').textContent.indexOf('Senza stop e senza target') >= 0
    }));
    assert.equal(es.campo, false, 'il campo e\' stato tolto');
    assert.equal(es.scritta, false, 'nemmeno la scritta deve restare');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
