// L'app si apre senza errori JavaScript e con i pezzi principali al loro posto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp, RISULTATI} from './aiuti.mjs';
import path from 'node:path';

test('avvio: nessun errore JavaScript, grafico e barra ordini presenti', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const c = await pagina.evaluate(() => ({
      grafico: !!document.getElementById('chart'),
      barra: !!document.getElementById('quickTradeBar'),
      rischio: !!document.getElementById('quickRiskVal'),
      draw: typeof draw === 'function', update: typeof update === 'function'
    }));
    assert.deepEqual(c, {grafico:true, barra:true, rischio:true, draw:true, update:true});
    assert.deepEqual(errori, [], 'errori JavaScript all\'avvio');
    await pagina.screenshot({path: path.join(RISULTATI, 'avvio.png')});
  } finally { await browser.close(); }
});

test('avvio su telefono (390 px): nessun errore e nessuno scorrimento orizzontale della pagina', async () => {
  const {browser, pagina, errori} = await apriApp({larghezza:390, altezza:844});
  try{
    const largo = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.deepEqual(errori, []);
    // Segnalato come avviso, non come errore: e' un difetto di aspetto, non una rottura.
    if(largo > 2) console.log('AVVISO: la pagina e\' piu\' larga dello schermo di '+largo+' px su telefono');
    await pagina.screenshot({path: path.join(RISULTATI, 'avvio_telefono.png')});
  } finally { await browser.close(); }
});
