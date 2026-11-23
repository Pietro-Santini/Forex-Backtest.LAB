import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('openMarketTrade rifiuta entry 0/non valida (no posizione con livello 0)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const t0=Date.UTC(2026,9,25,8,0,0);
      rows=[{date:new Date(t0).toISOString(),open:0,high:0,low:0,close:0,volume:1}];
      baseRows=rows; idx=0; viewEnd=0; currentAssetKey='XAUUSD';
      const sel=document.getElementById('market'); if(sel) sel.value='XAUUSD';
      liveModeActive=false; liveReplayActive=false; mt5Connected=false;
      positions.length=0; trades.length=0; equity=[10000]; if($('capital')) $('capital').value='10000';
      openMarketTrade('BUY');
      const pos0 = positions.length;
      const status = ($('status')||{}).textContent||'';
      // prezzo valido deve aprire
      rows[0].close=4000; rows[0].open=4000; rows[0].high=4001; rows[0].low=3999;
      openMarketTrade('BUY');
      const pos1 = positions.length;
      const entry = positions[0] ? positions[0].entry : null;
      return {pos0,pos1,entry,status};
    });
    assert.equal(r.pos0, 0);
    assert.match(r.status, /Prezzo corrente non disponibile|non valido/i);
    assert.equal(r.pos1, 1);
    assert.ok(Number.isFinite(r.entry) && r.entry > 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
