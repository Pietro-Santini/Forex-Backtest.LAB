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
// | Contesto                    | 1 dito              | 2 dita                    |
// |-----------------------------|---------------------|---------------------------|
// | pagina normale              | scorre LA PAGINA    | sposta il grafico (pan)   |
// | schermo intero / PIP        | sposta il grafico   | ZOOM isolato per asse     |
//
// Gli eventi touch sono VERI (CDP), non sintetici: è lo scroll nativo del browser ciò che si
// misura, non un callback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from './aiuti.mjs';

const PREPARA = () => {
  const t0=Date.now()-300*60000; let p=4161; const R=[];
  for(let i=0;i<300;i++){ const o=p, c=p+Math.sin(i/7)*2;
    R.push({date:new Date(t0+i*60000).toISOString(), open:o, high:Math.max(o,c)+2, low:Math.min(o,c)-2, close:c, volume:10}); p=c; }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; currentAssetKey='XAUUSD';
  csvLibrary=[{id:'x',name:'X',addedAt:Date.now(),rows:R}]; visibleCount=300;
  liveModeActive=false; mt5Connected=false; drawTool='cursor'; pendingDrawing=null;
  active=null; posSelezionata=null;
  document.getElementById('chart').scrollIntoView({block:'center'});
  draw();
};

// Apre la pagina col preparativo del banco (senza, reindirizza a login.html) + il touch vero.
async function apriConTouch(){
  const browser = await chromium.launch({});
  const contesto = await browser.newContext({
    viewport:{width:600, height:760},      // stretto: la pagina è più alta dello schermo
    hasTouch:true,
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
  });
  const pagina = await contesto.newPage();
  await contesto.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgentData', {configurable:true,
      get: () => ({platform: 'Windows', mobile: false, brands: []})});
    class WS { constructor(u){ this.url=String(u||''); this.readyState=0; this.bufferedAmount=0;
        this.onopen=null; this.onmessage=null; this.onerror=null; this.onclose=null; }
      send(){} close(){ this.readyState=3; try{ this.onclose&&this.onclose({code:1000,reason:'banco'}); }catch(e){} }
      addEventListener(){} removeEventListener(){} dispatchEvent(){ return false; } }
    WS.CONNECTING=0; WS.OPEN=1; WS.CLOSING=2; WS.CLOSED=3;
    try{ Object.defineProperty(window,'WebSocket',{configurable:true,writable:true,value:WS}); }catch(e){}
  });
  await pagina.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  const path = await import('node:path');
  await pagina.goto('file://' + path.resolve(process.cwd(), 'app.html'), {waitUntil:'domcontentloaded'});
  await pagina.waitForTimeout(2500);
  await pagina.evaluate(()=>{ document.querySelectorAll('#auth-check-overlay,.fbModalOverlay').forEach(el=>el.style.display='none'); });
  const cdp = await pagina.context().newCDPSession(pagina);
  return {browser, pagina, cdp};
}

// Un punto che sia DAVVERO sopra il canvas del grafico.
const puntoSulCanvas = (pagina) => pagina.evaluate(`(function(){
  (${PREPARA})();
  const chart=document.getElementById('chart');
  const r=chart.getBoundingClientRect();
  for(const fx of [0.5,0.35,0.7,0.2,0.85]){
    for(const fy of [0.5,0.35,0.7,0.25,0.8]){
      const px=Math.round(r.left+r.width*fx), py=Math.round(r.top+r.height*fy);
      if(document.elementFromPoint(px,py)===chart) return {x:px,y:py};
    }
  }
  return null;
})()`);

// Trascina un dito verticalmente verso il basso (basso = la pagina va su).
async function trascinaUnDito(cdp, pagina, x, y, passi=8, di=25){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=passi;i++){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+i*di}]});
    await pagina.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await pagina.waitForTimeout(250);
}

// Pinch: due dita che si allontanano in orizzontale (dx), in verticale (dy), o in entrambe.
async function pinch(cdp, pagina, cx, cy, delta, quanti=5){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',
    touchPoints:[{x:cx-30,y:cy},{x:cx+30,y:cy}]});
  for(let i=1;i<=quanti;i++){
    const f=i/quanti;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',
      touchPoints:[{x:cx-30-delta*f,y:cy},{x:cx+30+delta*f,y:cy}]});
    await pagina.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await pagina.waitForTimeout(250);
}
async function pinchVerticale(cdp, pagina, cx, cy, delta, quanti=5){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',
    touchPoints:[{x:cx,y:cy+30},{x:cx,y:cy-30}]});
  for(let i=1;i<=quanti;i++){
    const f=i/quanti;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',
      touchPoints:[{x:cx,y:cy+30+delta*f},{x:cx,y:cy-30-delta*f}]});
    await pagina.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await pagina.waitForTimeout(250);
}

const statoVista = (pagina) => pagina.evaluate(()=>({
  viewEnd:viewEnd, visible:getVisibleCount(), zoomPrezzi:priceZoomFactor,
  lo:viewPriceLo, hi:viewPriceHi
}));

test('pagina normale: un dito sopra il grafico fa scorrere la pagina e NON sposta il grafico', async () => {
  const {browser, pagina, cdp} = await apriConTouch();
  try{
    const p = await puntoSulCanvas(pagina);
    assert.ok(p, 'devo trovare un punto sopra il canvas');
    const prima = await statoVista(pagina);
    const scrollPrima = await pagina.evaluate(()=>window.scrollY);
    await trascinaUnDito(cdp, pagina, p.x, p.y);
    const dopo = await statoVista(pagina);
    const scrollDopo = await pagina.evaluate(()=>window.scrollY);
    assert.ok(Math.abs(scrollDopo-scrollPrima)>20,
      'un dito sulla pagina normale deve far scorrere la pagina (scrollY '+scrollPrima+' -> '+scrollDopo+')');
    assert.ok(Math.abs(dopo.viewEnd-prima.viewEnd)<0.5 && dopo.visible===prima.visible,
      'un dito NON deve spostare il grafico (viewEnd '+prima.viewEnd+' -> '+dopo.viewEnd+')');
  } finally { await browser.close(); }
});

test('schermo intero: un dito sposta il grafico, e lo zoom a due dita è ISOLATO per asse', async () => {
  const {browser, pagina, cdp} = await apriConTouch();
  try{
    const p = await puntoSulCanvas(pagina);
    assert.ok(p, 'devo trovare un punto sopra il canvas');
    // Simula lo schermo intero: la pagina non ha più scroll da far scorrere, e il grafico
    // occupa tutto. È lo STATO a cambiare, non il codice sotto esame.
    await pagina.evaluate(()=>{
      Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>document.body});
      draw();
    });
    const prima = await statoVista(pagina);
    // --- UN DITO = PAN del grafico ---
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
    for(let i=1;i<=8;i++){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x-i*20,y:p.y}]});
      await pagina.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await pagina.waitForTimeout(250);
    const dopoPan = await statoVista(pagina);
    assert.ok(Math.abs(dopoPan.viewEnd-prima.viewEnd)>0.5,
      'in schermo intero un dito deve spostare il grafico (viewEnd '+prima.viewEnd+' -> '+dopoPan.viewEnd+')');
    // --- DUE DITA in VERTICALE = solo zoom verticale ---
    const primaV = await statoVista(pagina);
    await pinchVerticale(cdp, pagina, p.x, p.y, 60);
    const dopoV = await statoVista(pagina);
    assert.ok(dopoV.zoomPrezzi!==primaV.zoomPrezzi,
      'il pinch verticale deve cambiare lo zoom verticale ('+primaV.zoomPrezzi+' -> '+dopoV.zoomPrezzi+')');
    assert.ok(dopoV.visible===primaV.visible,
      'il pinch verticale NON deve toccare lo zoom orizzontale ('+primaV.visible+' -> '+dopoV.visible+')');
    // --- DUE DITA in ORIZZONTALE = solo zoom orizzontale ---
    await pagina.evaluate(()=>{ priceZoomFactor=1; viewPriceLo=null; viewPriceHi=null; draw(); });
    const primaO = await statoVista(pagina);
    await pinch(cdp, pagina, p.x, p.y, 60);
    const dopoO = await statoVista(pagina);
    assert.ok(dopoO.visible!==primaO.visible,
      'il pinch orizzontale deve cambiare lo zoom orizzontale ('+primaO.visible+' -> '+dopoO.visible+')');
    assert.ok(dopoO.zoomPrezzi===primaO.zoomPrezzi,
      'il pinch orizzontale NON deve toccare lo zoom verticale ('+primaO.zoomPrezzi+' -> '+dopoO.zoomPrezzi+')');
  } finally { await browser.close(); }
});

test('finestra staccata/PIP: stessa regola dello schermo intero (un dito sposta, due dita zoom isolato)', async () => {
  const {browser, pagina, cdp} = await apriConTouch();
  try{
    const p = await puntoSulCanvas(pagina);
    assert.ok(p, 'devo trovare un punto sopra il canvas');
    // Il PIP non passa da fullscreenElement: passa da floatingWin. È l'altra metà della
    // domanda "il grafico occupa tutto lo schermo?", quindi la misura si fa su quella.
    await pagina.evaluate(()=>{ floatingWin={document:{}}; draw(); });
    const prima = await statoVista(pagina);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
    for(let i=1;i<=8;i++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x-i*20,y:p.y}]}); await pagina.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await pagina.waitForTimeout(250);
    const dopoPan = await statoVista(pagina);
    assert.ok(Math.abs(dopoPan.viewEnd-prima.viewEnd)>0.5,
      'nella finestra staccata un dito deve spostare il grafico ('+prima.viewEnd+' -> '+dopoPan.viewEnd+')');
    // Zoom verticale isolato.
    const primaV = await statoVista(pagina);
    await pinchVerticale(cdp, pagina, p.x, p.y, 60);
    const dopoV = await statoVista(pagina);
    assert.ok(dopoV.zoomPrezzi!==primaV.zoomPrezzi, 'il pinch verticale deve zoomare in verticale');
    assert.ok(dopoV.visible===primaV.visible, 'il pinch verticale non deve toccare l\'orizzontale');
    // Zoom orizzontale isolato.
    await pagina.evaluate(()=>{ priceZoomFactor=1; viewPriceLo=null; viewPriceHi=null; draw(); });
    const primaO = await statoVista(pagina);
    await pinch(cdp, pagina, p.x, p.y, 60);
    const dopoO = await statoVista(pagina);
    assert.ok(dopoO.visible!==primaO.visible, 'il pinch orizzontale deve zoomare in orizzontale');
    assert.ok(dopoO.zoomPrezzi===primaO.zoomPrezzi, 'il pinch orizzontale non deve toccare il verticale');
  } finally { await browser.close(); }
});

test('tornati sulla pagina normale il dito non sposta più il grafico', async () => {
  const {browser, pagina, cdp} = await apriConTouch();
  try{
    const p = await puntoSulCanvas(pagina);
    assert.ok(p, 'devo trovare un punto sopra il canvas');
    await pagina.evaluate(()=>{
      Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>document.body});
      draw();
    });
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
    for(let i=1;i<=8;i++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x-i*20,y:p.y}]}); await pagina.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await pagina.waitForTimeout(250);
    const mosso = (await statoVista(pagina)).viewEnd;
    // Si torna alla pagina normale: la proprietà del documento viene rimessa com'era.
    await pagina.evaluate(()=>{
      Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>null});
      draw();
    });
    const prima = await statoVista(pagina);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
    for(let i=1;i<=8;i++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x-i*20,y:p.y}]}); await pagina.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await pagina.waitForTimeout(250);
    const dopo = (await statoVista(pagina)).viewEnd;
    assert.ok(Math.abs(dopo-prima.viewEnd)<0.5,
      'sulla pagina normale un dito non deve più spostare il grafico (era '+mosso+', ora '+prima.viewEnd+' -> '+dopo+')');
  } finally { await browser.close(); }
});
