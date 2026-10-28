import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('resa totale di piu sale: si apre e non esplode', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      fblResaTotaleSaleApri();
      const ov = document.getElementById('fblResaTotaleSaleOverlay');
      return {aperto: !!(ov && ov.style.display !== 'none')};
    })()`);
    assert.equal(r.aperto, true, 'l overlay deve aprirsi');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('resa totale di piu sale: calcolo con nessuna sala non esplode', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      fblResaTotaleSaleApri();
      try { fblResaTotaleSaleCalcola(); } catch(e){ return {errore: String(e)}; }
      return {ok: true};
    })()`);
    assert.ok(!r.errore, 'il calcolo non deve esplodere: ' + (r.errore||''));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});