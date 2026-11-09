import {apriApp} from './aiuti.mjs';
const {browser, pagina, errori} = await apriApp();
const out = await pagina.evaluate(`(() => {
  const t0=Date.UTC(2026,9,20,8,0,0); const R=[]; let p=1900;
  for(let i=0;i<6000;i++){ p+=(Math.sin(i/13)+Math.cos(i/7))*0.3;
    R.push({date:new Date(t0+i*60000).toISOString(),open:p,high:p+0.8,low:p-0.8,close:p+0.1,volume:10+(i%7)}); }
  csvLibrary=[{name:'t',rows:R}]; rebuildBaseRowsFromLibrary();
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD'; liveModeActive=false; liveReplayActive=false;
  const a1m=()=>{ currentTF=1; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
                 viewEnd=rows.length-1; idx=rows.length-1; };
  visibleCount=80; autoFitWidth=false; followLatest=false;
  a1m();
  const N=300, a=rows.length-N, b=rows.length-1;
  const mk=(ancora)=>({id:'vp1',type:'vpfixed',
    p1:{time:parseDateTime(rows[a].date),price:rows[a].close},
    p2:{time:parseDateTime(rows[b].date),price:rows[b].close},
    tfAnchor:ancora, vpTfAnchor:ancora, candleCount:N,
    buckets:300,barSizePct:500,upColor:'#2fbf71',downColor:'#e05252',
    _vpIndBars:true,bgEnabled:false,lvnEnabled:false,pocEnabled:false,vahEnabled:false,valEnabled:false,extendRight:false});
  const esiti=[];
  for(const ancora of ['time','candles']){
    drawings=[mk(ancora)];
    const righe=[];
    for(const tf of [1,5,15]){
      currentTF=tf; rebuildRows();
      draw();
      const barre=vpIndBarRects.get('vp1')||[];
      const fullTs=getRowsTimestamps();
      const r=vpFixedResolveRange(drawings[0],fullTs,rows.length-1,rows.length);
      righe.push({tf:tf, fasce:barre.length, candele:Math.abs(r.bIdx-r.aIdx)+1});
    }
    esiti.push({ancora:ancora, righe:righe});
    a1m();
  }
  return esiti;
})()`);
console.log(JSON.stringify(out));
console.log('errori:', errori.slice(0,3));
await browser.close();
