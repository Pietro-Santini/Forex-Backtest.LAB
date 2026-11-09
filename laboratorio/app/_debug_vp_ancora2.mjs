import {apriApp} from './aiuti.mjs';
const {browser, pagina} = await apriApp();
const out = await pagina.evaluate(`(() => {
  const t0=Date.UTC(2026,9,20,8,0,0); const R=[]; let p=1900;
  for(let i=0;i<900;i++){ p+=(Math.sin(i/13)+Math.cos(i/7))*0.3;
    R.push({date:new Date(t0+i*60000).toISOString(),open:p,high:p+0.8,low:p-0.8,close:p+0.1,volume:10+(i%7)}); }
  csvLibrary=[{name:'t',rows:R}]; rebuildBaseRowsFromLibrary();
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD'; liveModeActive=false; liveReplayActive=false;
  currentTF=1; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
  return {base:baseRows.length, rows:rows.length, idx:idx, primaI:baseRows[0]?baseRows[0].date:null,
          ultimaI:baseRows[baseRows.length-1]?baseRows[baseRows.length-1].date:null};
})()`);
console.log(JSON.stringify(out));
await browser.close();
