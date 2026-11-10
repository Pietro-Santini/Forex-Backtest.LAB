// MISURA 3 — IL "BLOCCO PIENO" È IL FOOTPRINT?
//
// Il proprietario dice di no («non è un problema di footprint»). Qui si misura COM'E' fatto
// il disegno col footprint ACCESO, perché la larghezza del corpo cambia radicalmente:
//     const bw=Math.max(2,Math.min(_footprintOn?90:12,cw/n*.62));   // app.html riga 18654
// col footprint acceso il tetto passa da 12px a 90px, e passando a un timeframe più alto
// (stessa finestra di tempo = 1/5 delle candele) bw si allarga di conseguenza.
//
// Tick finti iniettati nel registro dell'asset, poi il cambio timeframe VERO (select #tf).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SCENARIO = `(function(){
  const t0=Date.UTC(2026,10,7,0,0,0), N=4320;
  const R=[]; let p=4100;
  for(let i=0;i<N;i++){
    const o=p, c=p+Math.sin(i/11)*3+Math.cos(i/5)*1.2;
    R.push({date:new Date(t0+i*60000).toISOString(),open:o,high:Math.max(o,c)+1.5,
            low:Math.min(o,c)-1.5,close:c,volume:100+(i%13)});
    p=c;
  }
  csvLibrary=[{id:'x',name:'XAU',addedAt:Date.now(),rows:R}];
  rebuildBaseRowsFromLibrary();
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD';
  liveModeActive=false; liveReplayActive=false; mt5Connected=false;
  candleTheme='blue_white';
  // REGISTRO TICK: qualche tick per ogni minuto, sui livelli di prezzo della candela.
  footprintTickLogByAsset={XAUUSD:[]};
  for(let i=0;i<N;i++){
    const t=t0+i*60000, pr=R[i].close;
    for(let k=0;k<6;k++)
      footprintTickLogByAsset.XAUUSD.push({t:t+6000*k, price:pr+(k-2.5)*0.25,
        side:(k%2)?1:-1, weight:1+(k%3), src:'mt5'});
  }
  document.getElementById('footprintEnabled').checked=true;      // footprint ACCESO
  currentTF=1; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
  idx=rows.length-1; viewEnd=rows.length-1; followLatest=false; autoFitWidth=false;
  visibleCount=80;
  const L=document.getElementById('chart').clientWidth, cwChart=L-18-chartPadR(L);
  function misura(nome){
    const proto=CanvasRenderingContext2D.prototype, orig=proto.fillRect;
    const viste=[];
    proto.fillRect=function(x,y,w,h){ viste.push({x:x,y:y,w:w,h:h,st:this.fillStyle}); return orig.apply(this,arguments); };
    try{ draw(); }finally{ proto.fillRect=orig; }
    const up=currentCandleColors().up, dn=currentCandleColors().down;
    const corpi=viste.filter(v=>(v.st===up||v.st===dn)&&v.w<=90&&v.h>=1).sort((a,b)=>a.x-b.x);
    const lar=corpi.map(c=>c.w), passi=[];
    for(let i=1;i<corpi.length;i++)passi.push(corpi[i].x-corpi[i-1].x);
    const med=a=>{ if(!a.length)return 0; const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; };
    // Area totale colorata dai corpi candela, in px², e quante candele hanno il footprint
    const area=corpi.reduce((s,c)=>s+c.w*c.h,0);
    const celle=Object.keys(footprintByBucket||{}).length;
    return {nome:nome, tf:currentTF, visibili:getVisibleCount(),
      corpo:+(med(lar)||0).toFixed(2), corpoMax:+(Math.max.apply(null,lar.concat([0]))).toFixed(2),
      passo:+(med(passi)||0).toFixed(2),
      rapporto:+((med(lar)||0)/(med(passi)||1)).toFixed(2),
      areaCorpi:Math.round(area), bucketFootprint:celle, passoRiga:footprintStepForAsset('XAUUSD')};
  }
  const prima=misura('prima (1m, 80 candele)');
  const sel=document.getElementById('tf'); sel.value='5';
  sel.dispatchEvent(new Event('change'));
  const dopo=misura('dopo (5m)');
  return {prima:prima, dopo:dopo, cwChart:Math.round(cwChart)};
})()`;

test('con il footprint acceso, 1m → 5m: quanto diventa largo il corpo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r=await pagina.evaluate(({s})=>eval('('+s+')'),{s:SCENARIO});
    console.log('\n=== FOOTPRINT ACCESO, 1m → 5m ===');
    console.log('cw='+r.cwChart);
    console.log('prima : '+JSON.stringify(r.prima));
    console.log('dopo  : '+JSON.stringify(r.dopo));
    assert.deepEqual(errori,[]);
  } finally { await browser.close(); }
});
