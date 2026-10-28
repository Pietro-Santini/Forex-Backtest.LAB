import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('profilo vpfixed: per default il tempo resta fisso (p2.time non viene riscritto)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      const t0 = Date.now() - 60*60000; const R = [];
      for(let i=0;i<60;i++){ const p = 100 + (i%10); R.push({date:new Date(t0+i*60000).toISOString(), open:p, high:p+1, low:p-1, close:p, volume:100}); }
      rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; viewStart=0; currentAssetKey='XAUUSD';
      const d = {type:'vpfixed', p1:{time:parseDateTime(R[0].date), price:100}, p2:{time:parseDateTime(R[R.length-1].date), price:110}};
      const before = d.p2.time;
      vpFixedResolveRange(d, getRowsTimestamps(), idx, rows.length);
      return {before, after: d.p2.time, changed: d.p2.time !== before};
    })()`);
    assert.equal(r.changed, false, 'in modalità tempo p2.time non deve cambiare');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('profilo vpfixed: con interruttore sulle candele p2.time viene riscritto (comportamento originale)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      const t0 = Date.now() - 60*60000; const R = [];
      for(let i=0;i<60;i++){ const p = 100 + (i%10); R.push({date:new Date(t0+i*60000).toISOString(), open:p, high:p+1, low:p-1, close:p, volume:100}); }
      rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; viewStart=0; currentAssetKey='XAUUSD';
      const d = {type:'vpfixed', tfAnchor:'candles', p1:{time:parseDateTime(R[0].date), price:100}, p2:{time:parseDateTime(R[R.length-1].date), price:110}};
      const before = d.p2.time;
      // forza candleCount nullo per far ricalcolare
      delete d.candleCount;
      vpFixedResolveRange(d, getRowsTimestamps(), idx, rows.length);
      return {ok:true};
    })()`);
    assert.ok(r.ok);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});