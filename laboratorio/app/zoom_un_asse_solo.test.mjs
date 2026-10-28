// IL PIZZICO SCEGLIE UN ASSE E CI RESTA — con le dita vere, non con quelle perfette.
//
// SEGNALATO dal proprietario (28 ottobre 2026): «fa sia lo zoom orizzontale che verticale
// insieme. Il grafico si muove in tutte le direzioni, si ridimensiona in verticale e in
// orizzontale: non va bene. Quando le dita si muovono in verticale non deve assolutamente
// muovere l'asse orizzontale, e viceversa».
//
// LA CAUSA: c'erano DUE `if` indipendenti, ognuno con una soglia di 2 pixel. Due dita che si
// allargano "in verticale" cambiano comunque la distanza orizzontale di molto piu' di 2 pixel -
// nessuna mano fa un pizzico perfettamente verticale - quindi scattavano sempre tutti e due.
//
// PERCHE' IL TEST CHE C'ERA NON L'AVEVA VISTO, ed e' la parte che vale la pena ricordare:
// muoveva le dita in verticale PURO, partendo da una distanza orizzontale di ZERO. In quel caso
// una vecchia guardia (`twoFingerStartDistX>1`) escludeva l'asse orizzontale, e il test passava -
// ma passava per il motivo sbagliato, su un gesto che a mano non esiste. Qui le dita partono
// in diagonale e sbandano, come fanno davvero.
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

// `da`, `via` e `a` sono gli scostamenti del PRIMO dito dal centro: il secondo fa lo specchio.
// Il punto di passaggio serve a descrivere un gesto che CAMBIA DIREZIONE a meta' strada - che
// e' l'unico modo di provare che l'asse, una volta scelto, non si lascia piu' convincere.
const PIZZICO = `(function(da, via, a){
  (function(){
    (${GRAFICO})();
    var chart=document.getElementById('chart');
    try{ chart.setPointerCapture=function(){}; chart.releasePointerCapture=function(){}; }catch(e){}
    window.__chart=chart;
  })();
  Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>document.body});
  var chart=window.__chart, r=chart.getBoundingClientRect();
  var cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
  function ptr(tipo,x,y,id,b){ chart.dispatchEvent(new PointerEvent(tipo,{pointerId:id,pointerType:'touch',button:0,buttons:b,bubbles:true,cancelable:true,clientX:x,clientY:y})); }
  var prima={vis:getVisibleCount(), zoom:priceZoomFactor};
  ptr('pointerdown',cx+da[0],cy+da[1],41,1);
  ptr('pointerdown',cx-da[0],cy-da[1],42,2);
  function tratto(p0,p1){
    for(var i=1;i<=4;i++){
      var fx=p0[0]+(p1[0]-p0[0])*i/4, fy=p0[1]+(p1[1]-p0[1])*i/4;
      ptr('pointermove',cx+fx,cy+fy,41,2);
      ptr('pointermove',cx-fx,cy-fy,42,2);
    }
  }
  tratto(da, via);
  tratto(via, a);
  ptr('pointerup',cx+a[0],cy+a[1],41,0);
  ptr('pointerup',cx-a[0],cy-a[1],42,0);
  return {prima:prima, dopo:{vis:getVisibleCount(), zoom:priceZoomFactor}};
})`;

// Senza punto di passaggio il gesto e' dritto: `via` diventa la meta' strada.
async function pizzica(da, a, via){
  const mezzo = via || [(da[0]+a[0])/2, (da[1]+a[1])/2];
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(
      `(${PIZZICO})(${JSON.stringify(da)}, ${JSON.stringify(mezzo)}, ${JSON.stringify(a)})`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    return r;
  } finally { await browser.close(); }
}

test('pizzico VERTICALE con lo sbandamento di una mano vera: tocca solo lo zoom verticale', async () => {
  // Le dita partono in diagonale (60 px di distanza orizzontale, 100 di verticale: tutte e due
  // ben oltre zero) e si allargano soprattutto in verticale, sbandando di 20 px in orizzontale.
  //   distanza verticale:   100 -> 200  (cambia di 100)
  //   distanza orizzontale:  60 ->  80  (cambia di 20, lo sbandamento della mano)
  // Col codice di prima quei 20 px bastavano e avanzavano per far scattare anche lo zoom
  // orizzontale: era esattamente il difetto segnalato.
  const r = await pizzica([-30,-50], [-40,-100]);
  assert.notEqual(r.dopo.zoom, r.prima.zoom,
    'il pizzico verticale deve cambiare lo zoom verticale');
  assert.equal(r.dopo.vis, r.prima.vis,
    'e NON deve toccare quello orizzontale, nemmeno di una candela: era '+r.prima.vis+', ora '+r.dopo.vis);
});

test('pizzico ORIZZONTALE con lo stesso sbandamento: tocca solo lo zoom orizzontale', async () => {
  // Lo specchio del caso qui sopra: si allarga soprattutto in orizzontale, con 20 px di
  // sbandamento in verticale.
  const r = await pizzica([-50,-30], [-100,-40]);
  assert.notEqual(r.dopo.vis, r.prima.vis,
    'il pizzico orizzontale deve cambiare quante candele si vedono');
  assert.equal(r.dopo.zoom, r.prima.zoom,
    'e NON deve toccare la scala dei prezzi: era '+r.prima.zoom+', ora '+r.dopo.zoom);
});

test('scelto un asse non si cambia piu\', nemmeno se le dita cambiano direzione a meta\'', async () => {
  // PRIMA META': quasi solo verticale (la distanza verticale passa da 100 a 220, quella
  //   orizzontale da 60 a 68). Qui l'asse si blocca sul verticale.
  // SECONDA META': si allarga moltissimo in orizzontale (da 68 a 300). Alla fine l'orizzontale
  //   si e' mosso quasi il doppio del verticale - e se il blocco non tenesse, il grafico
  //   comincerebbe a zoomare anche di lato a meta' gesto: e' proprio il «si muove in tutte le
  //   direzioni» che il proprietario descrive.
  const r = await pizzica([-30,-50], [-150,-115], [-34,-110]);
  assert.notEqual(r.dopo.zoom, r.prima.zoom,
    'l\'asse scelto all\'inizio era il verticale, e deve restare lui a lavorare');
  assert.equal(r.dopo.vis, r.prima.vis,
    'l\'orizzontale non deve entrare in gioco nemmeno quando poi si muove di piu\': era '
    +r.prima.vis+', ora '+r.dopo.vis);
});

test('PROVA DI CONTROLLO: un pizzico piccolissimo non zooma niente', async () => {
  // Senza questa, i test qui sopra passerebbero anche con un codice che zooma a caso purche'
  // tocchi un asse solo. Sotto la soglia dei 12 px non si muove NIENTE: meglio il grafico fermo
  // un istante che un grafico che parte al primo tremolio delle dita.
  const r = await pizzica([-30,-50], [-33,-54]);
  assert.equal(r.dopo.vis, r.prima.vis, 'troppo poco per zoomare in orizzontale');
  assert.equal(r.dopo.zoom, r.prima.zoom, 'e troppo poco anche per il verticale');
});
