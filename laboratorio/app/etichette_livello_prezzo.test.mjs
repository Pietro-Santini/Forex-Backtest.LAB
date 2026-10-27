// LE ETICHETTE SI RAGGRUPPANO PER LINEA DI PREZZO, non solo per casella identica.
//
// SEGNALATO dal proprietario (27 ottobre 2026): «quando abbiamo più etichette, più posizioni
// nello stesso prezzo, linea di prezzo, deve visualizzarci soltanto una etichetta. Poi se
// premiamo quell'etichetta allora ci esplode, ci fa vedere tutte le altre etichette. E se
// premiamo fuori, su un punto casuale sul grafico, ritornano raggruppate, quindi a una sola
// etichetta. Questo deve assolutamente funzionare per avere una pulizia del grafico, perché
// se no verrebbero fuori tutte caselle. Se ci fossero 30 posizioni aperte, diventa un quadro
// da dipinto, non è più un grafico.»
//
// IL DIFETTO MISURATO (sonda prima della cura): quattro posizioni con lo STESSO target
// (4200.00000) ma entrate e orari diversi producevano QUATTRO etichette TP sovrapposte sulla
// stessa riga. La regola di raggruppamento era l'identità dell'intera casella
// (asset|entrata|stop|target|orario|span): due posizioni riempite in istanti diversi non
// coincidevano mai, e l'anti-sovrapposizione le accatastava una sotto l'altra.
//
// SECONDO DIFETTO MISURATO: il toggle di espansione era scritto solo nel ramo TOUCH, quindi
// col mouse (il computer del proprietario) premere l'etichetta non faceva niente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const GRAFICO = () => {
  const t0 = Date.now() - 300*60000; let p = 4161; const R = [];
  for (let i=0;i<300;i++){ const o=p, c=p+Math.sin(i/7)*2;
    R.push({date:new Date(t0+i*60000).toISOString(), open:o, high:Math.max(o,c)+2, low:Math.min(o,c)-2, close:c, volume:10}); p=c; }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; currentAssetKey='XAUUSD';
  csvLibrary=[{id:'mt5_live_XAUUSD',name:'MT5 Live',addedAt:Date.now(),rows:R}];
  visibleCount=300;
  liveModeActive=false; mt5Connected=false;
};

// Il testo che finisce davvero a schermo: si aggancia fillText del contesto 2D REALE.
const CATTURA = () => {
  const c=document.getElementById('chart').getContext('2d');
  window.__pill=[];
  if(!c.__fillTextOriginale) c.__fillTextOriginale=c.fillText;
  c.fillText=function(t){ window.__pill.push(String(t)); return c.__fillTextOriginale.apply(this, arguments); };
};

// Quattro posizioni con LO STESSO target ma riempite in istanti diversi, stop diversi.
// È la realtà di un conto: stessa linea di prezzo, operazioni aperte in momenti diversi.
const STESSA_LINEA = () => {
  const R = [];
  for (let n=0;n<4;n++){
    R.push({id:'L'+n,side:'BUY',entry:4161+n,sl:4100-n,tp:4200,lots:0.1,asset:'XAUUSD',
      startTime:Date.parse(rows[100+n*3].date),symbol:'XAUUSD'});
  }
  return R;
};

// Prova di controllo: due target LONTANI non si devono raggruppare (non è "stessa riga").
const TARGET_LONTANI = () => [
  {id:'x1',side:'BUY',entry:4161,sl:4100,tp:4200,lots:0.1,asset:'XAUUSD',startTime:Date.parse(rows[100].date),symbol:'XAUUSD',tgTpIndice:1},
  {id:'x2',side:'BUY',entry:4161,sl:4100,tp:4260,lots:0.1,asset:'XAUUSD',startTime:Date.parse(rows[100].date),symbol:'XAUUSD',tgTpIndice:2}
];

// Click col MOUSE (quello del proprietario) su un hit rect.
const cliccaRect = (rect, chartEl, pointerType) => {
  const rc=chartEl.getBoundingClientRect();
  const opt={pointerId:7,pointerType:pointerType||'mouse',button:0,buttons:1,
             clientX:rc.left+(rect.x+rect.w/2), clientY:rc.top+(rect.y+rect.h/2),
             bubbles:true,cancelable:true};
  chartEl.dispatchEvent(new PointerEvent('pointerdown',opt));
  chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign({},opt,{buttons:0})));
};

// Click col mouse sul VUOTO del canvas (in alto a sinistra: niente candele né caselle lì).
const cliccaVuoto = (chartEl, pointerType) => {
  const rc=chartEl.getBoundingClientRect();
  const opt={pointerId:9,pointerType:pointerType||'mouse',button:0,buttons:1,
             clientX:rc.left+30, clientY:rc.top+4, bubbles:true,cancelable:true};
  chartEl.dispatchEvent(new PointerEvent('pointerdown',opt));
  chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign({},opt,{buttons:0})));
};

const etaTP = pill => pill.filter(t=>/^TP\d?:/.test(t));

test('stessa linea di prezzo (target uguale, riempimenti diversi): UNA sola etichetta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      expandedTpSlGroups=new Set();
      positions=(${STESSA_LINEA})(); active=null; posSelezionata=null; previewTradeLevel=null;
      draw();
      return {tp:window.__pill.filter(function(t){return /^TP\\d?:/.test(t);}),
              livelliTP:positions.map(function(p){return p.tp;})};
    })()`);
    const tp=r.tp.join(' || ');
    assert.equal(r.tp.length,1,'quattro posizioni sullo STESSO target devono dare UNA etichetta, trovate: '+tp);
    assert.ok(/×4/.test(tp),'l\'etichetta deve dire quante posizioni copre ('+tp+')');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('click col MOUSE sull\'etichetta raggruppata: si espande; click sul vuoto: torna una', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      expandedTpSlGroups=new Set();
      positions=(${STESSA_LINEA})(); active=null; posSelezionata=null; previewTradeLevel=null;
      var chartEl=document.getElementById('chart');
      // Gli eventi del banco sono SINTETICI: non esiste un puntatore vero con quell'id, quindi
      // catturare/rilasciare il puntatore genera un NotFoundError che non c'entra con quello che
      // si sta misurando. Nel browser vero i puntatori esistono; qui li si neutralizza.
      try{ chartEl.setPointerCapture=function(){}; chartEl.releasePointerCapture=function(){}; }catch(e){}
      draw(); window.__pill.length=0;
      var gruppo=tpSlPillHitRects.filter(function(x){return String(x.ownerKey).indexOf('gruppo:')===0;});
      if(!gruppo.length)return {errore:'nessuna etichetta di gruppo disegnata'};
      var rc=chartEl.getBoundingClientRect();
      function clicca(rect,tipo){
        var opt={pointerId:7,pointerType:tipo,button:0,buttons:1,bubbles:true,cancelable:true,
                 clientX:rc.left+(rect.x+rect.w/2),clientY:rc.top+(rect.y+rect.h/2)};
        chartEl.dispatchEvent(new PointerEvent('pointerdown',opt));
        chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign({},opt,{buttons:0})));
      }
      clicca(gruppo[0],'mouse');                 // PREMO col mouse sull'etichetta
      var espansoDopoClick=expandedTpSlGroups.size;
      draw(); window.__pill.length=0; draw();
      var esplose=window.__pill.filter(function(t){return /^TP\\d?:/.test(t);}).length;
      // Click sul vuoto, sempre col mouse.
      var vuoto={pointerId:9,pointerType:'mouse',button:0,buttons:1,bubbles:true,cancelable:true,
                 clientX:rc.left+30,clientY:rc.top+4};
      chartEl.dispatchEvent(new PointerEvent('pointerdown',vuoto));
      chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign({},vuoto,{buttons:0})));
      draw(); window.__pill.length=0; draw();
      return {esplose:esplose,
              ricomposte:window.__pill.filter(function(t){return /^TP\\d?:/.test(t);}).length,
              espansoDopoClick:espansoDopoClick};
    })()`);
    if(r.errore){ assert.fail(r.errore); }
    assert.ok(r.espansoDopoClick>0,'il click col mouse sull\'etichetta deve espandere il gruppo');
    assert.ok(r.esplose>1,'dopo l\'espansione si devono vedere tutte le etichette, trovate: '+r.esplose);
    assert.equal(r.ricomposte,1,'dopo il click sul vuoto deve restare UNA etichetta, trovate: '+r.ricomposte);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('prova di controllo: target LONTANI non si raggruppano', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      expandedTpSlGroups=new Set();
      positions=(${TARGET_LONTANI})(); active=null; posSelezionata=null; previewTradeLevel=null;
      draw();
      return {tp:window.__pill.filter(function(t){return /^TP\\d?:/.test(t);})};
    })()`);
    const tp=r.tp.join(' || ');
    assert.equal(r.tp.length,2,'due target lontani restano due etichette distinte, trovate: '+tp);
    assert.ok(/TP1:/.test(tp)&&/TP2:/.test(tp),'restano numerate: '+tp);
    assert.ok(!/×/.test(tp),'nessun raggruppamento per target lontani: '+tp);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

