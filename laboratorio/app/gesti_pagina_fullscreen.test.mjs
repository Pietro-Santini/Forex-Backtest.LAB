// GESTI SUL GRAFICO: la regola del proprietario (27 ottobre 2026), misurata.
//
// «Se scorro con un dito e sono sulla pagina principale, quindi non in modalità schermo intero,
// e sto sopra il grafico, non mi scorre più la pagina, rimane bloccata. È come se il tocco fosse
// agganciato all'interno del grafico e non mi scorre più la pagina. Mentre abbiamo detto che con
// due dita scorriamo quello che è il grafico, con un dito invece scorriamo la pagina.»
//
// «Lo zoom in modalità tutta pagina o in modalità pip: ci possiamo spostare nel grafico solamente
// con un dito. Quindi diventa un po' il contrario rispetto alla pagina madre. Con un dito ci
// spostiamo nel grafico. Con due dita invece effettuiamo lo zoom: se facciamo un pitch verticale
// ci zoom in maniera verticale; se facciamo un pitch orizzontale, ci zoom in orizzontale.
// Distingue le due cose, quindi isolale o una o l'altra. Poi quando ritorniamo alla pagina normale
// questa funzione non sarà più attiva.»
//
// La tabella che si misura qui:
//
// | Contesto             | 1 dito                        | 2 dita                   |
// |----------------------|-------------------------------|--------------------------|
// | pagina normale       | NON tocca il grafico, la pagina scorre | sposta il grafico (pan) |
// | schermo intero / PIP | sposta il grafico             | ZOOM isolato per asse    |
//
// Gli eventi sono SINTETICI (TouchEvent/PointerEvent costruiti a mano), la strada già usata dagli
// altri test dell'app: sono affidabili dovunque giri il collaudo, a differenza degli eventi touch
// veri del browser, che sul runner di GitHub non si comportano come sul computer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const GRAFICO = () => {
  const t0=Date.now()-300*60000; let p=4161; const R=[];
  for(let i=0;i<300;i++){ const o=p, c=p+Math.sin(i/7)*2;
    R.push({date:new Date(t0+i*60000).toISOString(), open:o, high:Math.max(o,c)+2, low:Math.min(o,c)-2, close:c, volume:10}); p=c; }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; currentAssetKey='XAUUSD';
  csvLibrary=[{id:'x',name:'X',addedAt:Date.now(),rows:R}]; visibleCount=300;
  liveModeActive=false; mt5Connected=false; drawTool='cursor'; pendingDrawing=null;
  active=null; posSelezionata=null; positions=[]; expandedTpSlGroups=new Set();
  priceZoomFactor=1; viewPriceLo=null; viewPriceHi=null; followLatest=false;
};

// Un punto che sia DAVvero sul canvas, dentro la zona del disegno (non l'asse dei prezzi).
const PUNTO = (chart, fx, fy) => {
  const r=chart.getBoundingClientRect();
  return {x:Math.round(r.left+r.width*fx), y:Math.round(r.top+r.height*fy)};
};

// Nucleo comune: prepara il grafico e restituisce gli attrezzi per il gesto.
const PREPARA = `(function(){
  (${GRAFICO})();
  var chart=document.getElementById('chart');
  // Eventi sintetici: catturare un puntatore inesistente genera errori che non c'entrano con
  // quello che si misura. Nel browser vero i puntatori esistono.
  try{ chart.setPointerCapture=function(){}; chart.releasePointerCapture=function(){}; }catch(e){}
  // Misura se qualcuno ha impedito il comportamento predefinito del tocco: è da lì che dipende
  // lo scorrimento della pagina.
  window.__prevent={tocchi:0, preventDefault:0};
  ['touchstart','touchmove'].forEach(function(t){
    chart.addEventListener(t,function(e){ window.__prevent.tocchi++; if(e.defaultPrevented)window.__prevent.preventDefault++; },false);
  });
  function evTouch(tipo,x,y,id){
    var opts={clientX:x,clientY:y,identifier:id,target:chart,bubbles:true,cancelable:true};
    var t=null;
    try{ t=new Touch(opts); }catch(e){ return false; }
    var ev=new TouchEvent(tipo,{touches:[t],targetTouches:[t],changedTouches:[t],bubbles:true,cancelable:true});
    chart.dispatchEvent(ev); return true;
  }
  function evPtr(tipo,x,y,id,dita){
    var opt={pointerId:id,pointerType:'touch',button:0,buttons:dita?dita:1,bubbles:true,cancelable:true,clientX:x,clientY:y};
    chart.dispatchEvent(new PointerEvent(tipo,opt));
  }
  // Un punto sul canvas dentro la zona del disegno (non l'asse dei prezzi).
  function punto(fx,fy){ var r=chart.getBoundingClientRect();
    return {x:Math.round(r.left+r.width*(fx||0.5)), y:Math.round(r.top+r.height*(fy||0.5))}; }
  // Un dito che si sposta in orizzontale sul canvas.
  function unDito(dx,dy){
    var p=punto();
    evTouch('touchstart',p.x,p.y,11); evPtr('pointerdown',p.x,p.y,11,1);
    for(var i=1;i<=6;i++){ var x=p.x+dx/6*i, y=p.y+(dy||0)/6*i;
      evTouch('touchmove',x,y,11); evPtr('pointermove',x,y,11,1); }
    evTouch('touchend',p.x+dx,p.y+(dy||0),11); evPtr('pointerup',p.x+dx,p.y+(dy||0),11,0);
    return p;
  }
  // Due dita: pinch in orizzontale (dx>0) o in verticale (dy>0), muovendosi dal centro.
  function dueDita(dx,dy){
    var p=punto();
    var a={x:p.x-30,y:p.y}, b={x:p.x+30,y:p.y};
    function manda(tipo,tocchi){
      var opt={bubbles:true,cancelable:true};
      if(dx){ opt.touches=tocche(tipo,a,b,dx); }
      else { opt.touches=tocche(tipo,a,b,0,dy); }
      var ev=new TouchEvent(tipo,opt); chart.dispatchEvent(ev);
    }
    function tocce(tipo,ta,tb,ddx,ddy){
      var na=new Touch({identifier:1,target:chart,clientX:ta.x,clientY:ta.y});
      var nb=new Touch({identifier:2,target:chart,clientX:tb.x,clientY:tb.y});
      var arr=[na,nb]; if(tipo==='touchend')arr=[];
      return arr;
    }
    return {punto:p};
  }
  window.__gesti={chart:chart,evTouch:evTouch,evPtr:evPtr,unDito:unDito,dueDita:dueDita,punto:punto};
  return {pronto:true};
})()`;

test('pagina normale: un dito non tocca il grafico (e non impedisce lo scroll della pagina)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${PREPARA});
      var prima={viewEnd:viewEnd, visible:getVisibleCount()};
      var p=window.__gesti.punto(0.5,0.5);
      // Un dito che Si SPOSTA in orizzontale (tentativo di pan).
      window.__gesti.evTouch('touchstart',p.x,p.y,11);
      window.__gesti.evPtr('pointerdown',p.x,p.y,11,1);
      for(var i=1;i<=6;i++){ window.__gesti.evTouch('touchmove',p.x+i*20,p.y,11); window.__gesti.evPtr('pointermove',p.x+i*20,p.y,11,1); }
      window.__gesti.evTouch('touchend',p.x+120,p.y,11);
      window.__gesti.evPtr('pointerup',p.x+120,p.y,11,0);
      var dopo={viewEnd:viewEnd, visible:getVisibleCount()};
      return {prima:prima, dopo:dopo, prevent:window.__prevent};
    })()`);
    // 1) Il grafico non si muove col dito solo.
    assert.ok(Math.abs(r.dopo.viewEnd-r.prima.viewEnd)<0.5,
      'in pagina normale un dito NON deve spostare il grafico (viewEnd '+r.prima.viewEnd+' -> '+r.dopo.viewEnd+')');
    assert.equal(r.dopo.visible, r.prima.visible, 'né cambiarne lo zoom');
    // 2) E non deve impedire lo scroll della pagina: è la regola che il proprietario ha chiesto.
    assert.ok(r.prevent.tocchi>0, 'i gesti devono essere arrivati al canvas');
    assert.equal(r.prevent.preventDefault, 0,
      'in pagina normale il tocco NON deve essere bloccato, sennò la pagina non scorre più');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('schermo intero: un dito sposta il grafico e blocca lo scroll della pagina', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${PREPARA});
      // Simula lo schermo intero: cambia lo STATO, non il codice sotto esame.
      Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>document.body});
      var prima={viewEnd:viewEnd, visible:getVisibleCount()};
      var p=window.__gesti.punto(0.5,0.5);
      window.__gesti.evTouch('touchstart',p.x,p.y,11);
      window.__gesti.evPtr('pointerdown',p.x,p.y,11,1);
      for(var i=1;i<=6;i++){ window.__gesti.evTouch('touchmove',p.x+i*20,p.y,11); window.__gesti.evPtr('pointermove',p.x+i*20,p.y,11,1); }
      window.__gesti.evTouch('touchend',p.x+120,p.y,11);
      window.__gesti.evPtr('pointerup',p.x+120,p.y,11,0);
      var dopo={viewEnd:viewEnd, visible:getVisibleCount()};
      return {prima:prima, dopo:dopo, prevent:window.__prevent};
    })()`);
    assert.ok(Math.abs(r.dopo.viewEnd-r.prima.viewEnd)>0.5,
      'in schermo intero un dito deve spostare il grafico ('+r.prima.viewEnd+' -> '+r.dopo.viewEnd+')');
    assert.equal(r.dopo.visible, r.prima.visible, 'il pan a un dito non cambia lo zoom');
    assert.ok(r.prevent.preventDefault>0, 'in schermo intero il tocco va bloccato: serve al pan');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('schermo intero: due dita fanno zoom ISOLATO per asse', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${PREPARA});
      Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>document.body});
      var c=window.__gesti.chart;
      var p=window.__gesti.punto(0.5,0.5);
      // --- DUE DITA CHE SI ALLONTANANO IN VERTICALE ---
      var primaV={zoom:priceZoomFactor, vis:getVisibleCount()};
      function dita(vx,vy,idA,idB){
        // 45px per lato: la distanza fra le dita parte da 90px. Sotto i 60px l'app tratta il
        // gesto come "spostamento libero" invece che come pinch (twoFingerCloseMode): è una
        // regola voluta, quindi il test deve stare SOPRA quella soglia.
        window.__gesti.evPtr('pointerdown',p.x+vx,p.y+vy,idA,1);
        window.__gesti.evPtr('pointerdown',p.x-vx,p.y-vy,idB,2);
        for(var i=1;i<=5;i++){
          window.__gesti.evPtr('pointermove',p.x+vx+i*8,p.y+vy+i*8,idA,2);
          window.__gesti.evPtr('pointermove',p.x-vx-i*8,p.y-vy-i*8,idB,2);
        }
        window.__gesti.evPtr('pointerup',p.x+vx+40,p.y+vy+40,idA,0);
        window.__gesti.evPtr('pointerup',p.x-vx-40,p.y-vy-40,idB,0);
      }
      dita(0,45,21,22);            // le dita partono vicine in VERTICALE e si allontanano
      var dopoV={zoom:priceZoomFactor, vis:getVisibleCount()};
      // --- DUE DITA CHE SI ALLONTANO IN ORIZZONTALE ---
      priceZoomFactor=1; viewPriceLo=null; viewPriceHi=null; draw();
      var primaO={zoom:priceZoomFactor, vis:getVisibleCount()};
      dita(45,0,23,24);            // partono vicine in ORIZZONTALE e si allontanano
      var dopoO={zoom:priceZoomFactor, vis:getVisibleCount()};
      return {primaV:primaV, dopoV:dopoV, primaO:primaO, dopoO:dopoO};
    })()`);
    assert.ok(r.dopoV.zoom!==r.primaV.zoom,
      'il pinch verticale deve cambiare lo zoom verticale ('+r.primaV.zoom+' -> '+r.dopoV.zoom+')');
    assert.equal(r.dopoV.vis, r.primaV.vis,
      'il pinch verticale NON deve toccare quello orizzontale ('+r.primaV.vis+' -> '+r.dopoV.vis+')');
    assert.ok(r.dopoO.vis!==r.primaO.vis,
      'il pinch orizzontale deve cambiare lo zoom orizzontale ('+r.primaO.vis+' -> '+r.dopoO.vis+')');
    assert.equal(r.dopoO.zoom, r.primaO.zoom,
      'il pinch orizzontale NON deve toccare quello verticale ('+r.primaO.zoom+' -> '+r.dopoO.zoom+')');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('tornati sulla pagina normale il dito non sposta più il grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${PREPARA});
      Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>document.body});
      var p=window.__gesti.punto(0.5,0.5);
      window.__gesti.evTouch('touchstart',p.x,p.y,11); window.__gesti.evPtr('pointerdown',p.x,p.y,11,1);
      for(var i=1;i<=6;i++){ window.__gesti.evTouch('touchmove',p.x+i*20,p.y,11); window.__gesti.evPtr('pointermove',p.x+i*20,p.y,11,1); }
      window.__gesti.evTouch('touchend',p.x+120,p.y,11); window.__gesti.evPtr('pointerup',p.x+120,p.y,11,0);
      var mossoInFullscreen=viewEnd;
      // Si torna alla pagina normale.
      Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>null});
      var prima={viewEnd:viewEnd};
      window.__gesti.evTouch('touchstart',p.x,p.y+200,12); window.__gesti.evPtr('pointerdown',p.x,p.y+200,12,1);
      for(var j=1;j<=6;j++){ window.__gesti.evTouch('touchmove',p.x+j*20,p.y+200,12); window.__gesti.evPtr('pointermove',p.x+j*20,p.y+200,12,1); }
      window.__gesti.evTouch('touchend',p.x+120,p.y+200,12); window.__gesti.evPtr('pointerup',p.x+120,p.y+200,12,0);
      return {mossoInFullscreen:mossoInFullscreen, prima:prima.viewEnd, dopo:viewEnd};
    })()`);
    assert.ok(Math.abs(r.mossoInFullscreen-300)>0.5,
      'in schermo intero il grafico deve essersi mosso ('+r.mossoInFullscreen+')');
    assert.ok(Math.abs(r.dopo-r.prima)<0.5,
      'tornati sulla pagina normale un dito non deve più spostarlo ('+r.prima+' -> '+r.dopo+')');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
