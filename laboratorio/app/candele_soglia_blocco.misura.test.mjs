// MISURA 2 — SOGLIA DI SOVRAPPOSIZIONE E CAMBIO TIMEFRAME CON FINESTRA AMPIA.
//
// Stesso impianto di candele_blocco_5m.misura.test.mjs: intercetta le fillRect di draw()
// e misura quanto sono larghe le candele e quanto spazio c'e' fra l'una e l'altra.
//
//   A. a partire da QUANTE candele visibili i corpi iniziano a toccarsi (e quando sono un muro)?
//   B. col gestore VERO della select #tf, cambiando timeframe con una finestra di tempo AMPIA
//      dove si finisce?
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SCENARIO = (oldTF, vis) => `(function(oldTF, vis){
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
  document.getElementById('footprintEnabled').checked=false;
  currentTF=oldTF; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
  idx=rows.length-1; viewEnd=rows.length-1; followLatest=false; autoFitWidth=false;
  visibleCount=vis;
  const L=document.getElementById('chart').clientWidth;
  const cwChart=L-18-chartPadR(L);
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
    return {nome:nome, tf:currentTF, visibili:getVisibleCount(),
      corpo:+(med(lar)||0).toFixed(2), passo:+(med(passi)||0).toFixed(2),
      rapporto:+((med(lar)||0)/(med(passi)||1)).toFixed(2),
      sovrapposti:passi.filter((p,i)=>p>0&&lar[i+1]>=p-0.01).length, su:passi.length,
      minutiFinestra:+(getVisibleCount()*currentTF).toFixed(0)};
  }
  const prima=misura('prima');
  const sel=document.getElementById('tf'); sel.value='5';
  sel.dispatchEvent(new Event('change'));
  const dopo=misura('dopo');
  return {prima:prima, dopo:dopo, cwChart:Math.round(cwChart),
          tettoAntiSovr:maxNoOverlapVisibleCount(), tettoTf:fblTettoCandele()};
})(${oldTF},${vis})`;

test('A. soglia: da quante candele i corpi si toccano (grafico 1234px)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const out=[];
    for(const n of [80,200,300,350,400,600,864,1200,2000]){
      const r=await pagina.evaluate(({s})=>{ return eval('('+s+')'); },{s:SCENARIO(5,n)});
      out.push({n:r.prima.visibili, corpo:r.prima.corpo, passo:r.prima.passo,
                rapporto:r.prima.rapporto, sovrapposti:r.prima.sovrapposti+'/'+r.prima.su});
    }
    console.log('\n=== SOGLIA DI SOVRAPPOSIZIONE ===');
    out.forEach(o=>console.log(JSON.stringify(o)));
    assert.deepEqual(errori,[]);
  } finally { await browser.close(); }
});

test('B. cambio timeframe con finestra di tempo ampia: dove si finisce?', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const righe=[];
    // Stessa finestra di tempo reale (~50 ore) vista da timeframe diversi, poi -> 5m.
    for(const [oldTF,vis] of [[1,3000],[5,600],[15,200],[60,50],[240,12]]){
      const r=await pagina.evaluate(({s})=>{ return eval('('+s+')'); },{s:SCENARIO(oldTF,vis)});
      righe.push({da:oldTF+'m', visPrima:r.prima.visibili, minuti:r.prima.minutiFinestra,
        visDopo:r.dopo.visibili, corpo:r.dopo.corpo, passo:r.dopo.passo, rapporto:r.dopo.rapporto,
        sovrapposti:r.dopo.sovrapposti+'/'+r.dopo.su, tettoAntiSovr:r.tettoAntiSovr, tettoTf:r.tettoTf});
    }
    console.log('\n=== FINESTRA DI ~50 ORE, POI -> 5m ===');
    righe.forEach(r=>console.log(JSON.stringify(r)));
    assert.deepEqual(errori,[]);
  } finally { await browser.close(); }
});

test('C. il caso dello screenshot: 3 giorni a 5m (864 candele)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r=await pagina.evaluate(({s})=>{ return eval('('+s+')'); },{s:SCENARIO(5,864)});
    console.log('\n=== 3 GIORNI A 5m ===');
    console.log('prima : '+JSON.stringify(r.prima));
    console.log('dopo  : '+JSON.stringify(r.dopo));
    console.log('cw='+r.cwChart+' tettoAntiSovrapposizione='+r.tettoAntiSovr+' tettoCambioTf='+r.tettoTf);
    assert.deepEqual(errori,[]);
  } finally { await browser.close(); }
});
