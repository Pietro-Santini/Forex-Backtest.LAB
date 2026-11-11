// LINEE TP/SL — percorso VERO dell'utente (un clic = pointerdown+pointerup), NON due pressioni.
//
// SEGNALATO (10 novembre 2026): «la PRIMA volta è come se mi selezionasse la POSIZIONE e non mi
// seleziona la LINEA [...] se clicco la prima volta sopra la linea e poi muovo soltanto il mouse,
// si sposta la visuale». Misura lo STATO dentro la pagina dopo un clic reale sulla linea SL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

function esegui(){
  const t0=Date.now()-200*60000; let p=4161; const R=[];
  for(let i=0;i<200;i++){ const o=p,c=p+Math.sin(i/7)*2;
    R.push({date:new Date(t0+i*60000).toISOString(),open:o,high:Math.max(o,c)+1,low:Math.min(o,c)-1,close:c,volume:10}); p=c; }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; currentAssetKey='XAUUSD'; currentTF=1;
  csvLibrary=[{id:'mt5_live_XAUUSD',name:'MT5 Live',addedAt:Date.now(),rows:R}];
  visibleCount=200; liveModeActive=false; mt5Connected=false; liveReplayActive=false;
  positionsVisible=true; viewPriceLo=4090; viewPriceHi=4250; priceZoomFactor=1;
  const sl=4110, tp=4230, entry=4165;
  const pos={id:'p1',side:'BUY',entry,sl,tp,lots:0.1,asset:'XAUUSD',startTime:t0+60*60000,openTF:1};
  positions=[pos]; active=null; posSelezionata=null; pendingOrders=[];
  tradeLevelArmata=null; lineaTradePremuta=null; previewTradeLevel=null; tradeLevelDrag=null;
  placingTradeLevel=null; placingTradeLevelDrag=null; panDrag=false; priceAxisDrag=null;
  shapeDrag=null; zoneWidthDrag=null; twoFingerPan=false; assetSwitchInProgress=false;
  try{ setDrawTool('cursor'); }catch(e){}
  if(!window.__capPatch){
    const a=Element.prototype.setPointerCapture; Element.prototype.setPointerCapture=function(){try{return a&&a.apply(this,arguments);}catch(e){}};
    const b=Element.prototype.releasePointerCapture; Element.prototype.releasePointerCapture=function(){try{return b&&b.apply(this,arguments);}catch(e){}};
    window.__capPatch=true;
  }
  draw();
  const g=chartGeometry(); if(!g)return {errore:'chartGeometry null'};
  const rect={left:g.rect.left,top:g.rect.top};
  let hit=null;
  const xsH=[rect.left+g.xLocal(idx)-40, rect.left+g.xLocal(Math.floor(idx*0.6)), rect.left+g.xLocal(idx)-14];
  const yBase=rect.top+g.y(sl);
  for(const x of xsH){ for(let dy=-20;dy<=20;dy+=4){ const y=yBase+dy;
    try{ if(tradeLevelHit(x,y,false)==='SL'){ hit={x,y}; break; } }catch(e){} } if(hit)break; }
  if(!hit)return {errore:'pixel SL non trovato'};
  const chart=document.getElementById('chart');
  const fire=(t,x,y,buttons)=>chart.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,
    composed:true,pointerType:'mouse',pointerId:9,clientX:x,clientY:y,buttons,button:0}));

  // ===== A: UN CLIC (down+up) sulla linea =====
  fire('pointerdown',hit.x,hit.y,1);
  fire('pointerup',hit.x,hit.y,0);
  const A={armDopoUp:tradeLevelArmata, posSelIsPos:(posSelezionata===pos), activeIsPos:(active===pos)};
  // reset per B
  tradeLevelArmata=null; panDrag=false; active=null; posSelezionata=null; previewTradeLevel=null; tradeLevelDrag=null;

  // ===== B: pan avviato e poi ANNULLATO, poi mouse a riposo =====
  const yVuoto=rect.top+g.y((4250+4090)/2);
  fire('pointerdown',hit.x,yVuoto,1);
  const panDopoDown=panDrag;
  fire('pointercancel',hit.x,yVuoto,0);
  const panDopoCancel=panDrag;
  const vEndPrima=viewEnd;
  fire('pointermove',hit.x+120,yVuoto,0);
  fire('pointermove',hit.x+240,yVuoto,0);
  const vEndDopo=viewEnd;
  return {errore:null, A, panDopoDown, panDopoCancel, vEndPrima, vEndDopo, spostataVista:(vEndDopo!==vEndPrima)};
}

test('A: il primo clic sulla linea la MARCA, non deve trascinare la posizione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(esegui);
    if(r.errore)return assert.fail('preparazione: '+r.errore);
    assert.equal(r.A.armDopoUp,'SL','il primo clic deve armare la linea SL');
    // ROSSO = difetto: oggi il primo clic seleziona anche la POSIZIONE.
    assert.equal(r.A.activeIsPos,false,'il primo clic sulla linea NON deve selezionare la posizione (active cambiato)');
    assert.equal(r.A.posSelIsPos,false,'il primo clic sulla linea NON deve impostare posSelezionata');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('B: guardia anti-regressione — un pan annullato non lascia la vista appesa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(esegui);
    if(r.errore)return assert.fail('preparazione: '+r.errore);
    assert.equal(r.panDopoDown,true,'il pointerdown su punto vuoto avvia il pan (panDrag)');
    // VERDE oggi: recuperato da fblChiudiTrascinamentiTrade + pointercancel di chartEl.
    assert.equal(r.panDopoCancel,false,'il pointercancel deve azzerare panDrag');
    assert.equal(r.spostataVista,false,'dopo l\'annullamento un movimento a riposo non deve spostare la vista');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
