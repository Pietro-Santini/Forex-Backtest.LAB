import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('BOS auto-open demo: apre solo in demo MT5 collegata e non su reale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const t0=Date.UTC(2026,9,25,8,0,0);
      rows=[]; for(let i=0;i<120;i++){ const c=4000+i*0.1; rows.push({date:new Date(t0+i*60000).toISOString(),open:c,high:c+0.5,low:c-0.5,close:c,volume:10}); }
      baseRows=rows; idx=rows.length-1; viewEnd=idx; currentAssetKey='XAUUSD';
      liveModeActive=true; liveReplayActive=false; mt5Connected=true; mt5AccountInfo={reale:false,equity:10000,balance:10000,margin_free:10000};
      positions.length=0; trades.length=0; equity=[10000]; if($('capital')) $('capital').value='10000';
      const st={ops:[{nome:'pullback',setupId:'s1',dir:1,entry:4005,sl:4004,tp:4007,lotto:0.1}]};
      const p={autoOpenDemo:true};
      bosAutoApriOpsSetup(st,p,'s1',rows.length-1);
      const demoOpen = positions.length;
      // reale: non deve aprire
      positions.length=0; st.ops[0].autoOpenAttempted=false; mt5AccountInfo.reale=true;
      bosAutoApriOpsSetup(st,p,'s1',rows.length-1);
      const realOpen = positions.length;
      // toggle spento
      positions.length=0; st.ops[0].autoOpenAttempted=false; mt5AccountInfo.reale=false; p.autoOpenDemo=false;
      bosAutoApriOpsSetup(st,p,'s1',rows.length-1);
      const offOpen = positions.length;
      return {demoOpen, realOpen, offOpen, posDemo: demoOpen?1:0};
    });
    assert.equal(r.demoOpen, 1);
    assert.equal(r.realOpen, 0);
    assert.equal(r.offOpen, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
