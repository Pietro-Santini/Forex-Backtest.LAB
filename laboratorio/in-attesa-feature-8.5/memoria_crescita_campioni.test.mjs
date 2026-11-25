// 8.6.19: crescita memoria = una riga al minuto, non una fotografia.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('campionamento memoria: aggiunge righe con tempo e non è solo fotografia', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const prima = fblMemoriaCampioni.length;
      fblCampionaMemoria();
      fblCampionaMemoria();
      const dopo = fblMemoriaCampioni.length;
      const last = fblMemoriaCampioni[fblMemoriaCampioni.length - 1];
      return {prima, dopo, haT: typeof last.t === 'string', haMb: Object.prototype.hasOwnProperty.call(last,'mb'), haNodi: Number.isFinite(last.nodi)};
    });
    assert.equal(r.dopo, r.prima + 2);
    assert.equal(r.haT, true);
    assert.equal(r.haMb, true);
    assert.equal(r.haNodi, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
