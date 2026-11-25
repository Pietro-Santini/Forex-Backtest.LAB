// 8.6.20: al cambio asset, lo storico book degli altri asset non deve restare in memoria.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('cambio asset: lo storico book mantiene solo asset corrente e reg', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // Aspetta che la funzione sia disponibile (script grande = parsing lento, fino a 2 min in CI)
    // Polling manuale perché waitForFunction ha timeout hardcoded
    for(let i=0; i<240; i++){ // 240 * 500ms = 2 minuti
      const ok = await pagina.evaluate(() => typeof fblPulisciBookStoricoAlCambioAsset === 'function');
      if(ok) break;
      await new Promise(r=>setTimeout(r,500));
    }
    const r = await pagina.evaluate(() => {
      orderBookHistoryByAsset = {
        XAUUSD: [{time_ms:1,bids:[],asks:[]}],
        EURUSD: [{time_ms:2,bids:[],asks:[]}],
        'reg:file.csv': [{time_ms:3,bids:[],asks:[]}],
      };
      heatmapCellsMeta = {XAUUSD:{}, EURUSD:{}, 'reg:file.csv':{}};
      latestOrderBookByAsset = {XAUUSD:{}, EURUSD:{}};
      fblPulisciBookStoricoAlCambioAsset('XAUUSD');
      return {
        keys: Object.keys(orderBookHistoryByAsset).sort(),
        meta: Object.keys(heatmapCellsMeta).sort(),
        latest: Object.keys(latestOrderBookByAsset).sort(),
      };
    });
    assert.deepEqual(r.keys, ['XAUUSD', 'reg:file.csv']);
    assert.deepEqual(r.meta, ['XAUUSD', 'reg:file.csv']);
    assert.deepEqual(r.latest, ['XAUUSD']);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
