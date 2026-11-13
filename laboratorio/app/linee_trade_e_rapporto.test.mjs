// BANCO ROSSO — «la linea di entrata di un ordine limite si deve poter spostare» e
//               «toccando stop o target mi deve uscire l'etichetta del rapporto rischio/rendimento».
//
// RICHIESTE del proprietario (12 novembre 2026):
//  1) «quando c'e' un ordine limite devo avere la possibilita' di spostarlo, anche se l'ordine
//     pendente viene creato da una sala segnali: posso spostare la linea di entrata del buy limit
//     e del sell limit».
//  2) «quando apro una posizione e poi vado a toccare lo stop loss o il take profit, e vado a
//     spostare le linee, o le seleziono, mi deve uscire l'etichetta del rapporto
//     rischio-rendimento».
//
// QUESTO BANCO NON CORREGGE: misura.
//  - Parte A: a quali distanze orizzontali il PRIMO tocco aggancia l'entrata, lo stop e il target
//    di un ordine pendente. Le tre linee sono disegnate da `pad.l` a `w-pad.r`, cioe' per TUTTA
//    la larghezza dell'area di plot: devono rispondere su tutta la larghezza su cui si vedono.
//    Misurato il 12 novembre su tela 1234 px (area di plot 1140 px): entrata solo 0-178,
//    stop e target solo 1018-1158 — 859 px in mezzo (il 75%) in cui nessuna linea risponde.
//  - Parte B: toccando (e poi trascinando) lo stop di una posizione aperta deve comparire a
//    grafico il rapporto rischio/rendimento, e durante il trascinamento deve CAMBIARE col
//    movimento. Misurato: nessuna etichetta col rapporto, ne' al tocco ne' durante lo spostamento.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Candele BTC da 1 minuto che finiscono adesso. Autonomo: gira dentro la pagina.
const PREPARA = `(function(){
  var t0 = Date.now() - 150*60000, p = 80000, R = [], i;
  for(i=0;i<150;i++){
    var o=p, c=p+Math.sin(i/7)*60;
    R.push({date:new Date(t0+i*60000).toISOString(),open:o,high:Math.max(o,c)+25,low:Math.min(o,c)-25,close:c,volume:10});
    p=c;
  }
  R[R.length-1].close = 80000;
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length;
  currentAssetKey='BINANCE:BTCUSDT';
  if(typeof rowsAssetKey!=='undefined') rowsAssetKey='BINANCE:BTCUSDT';
  liveModeActive=true; mt5Connected=false; liveReplayActive=false;
  if(typeof fblContoVista!=='undefined') fblContoVista='kraken';
  window.appConfirm=async function(){ return true; }; appConfirm=window.appConfirm;
  trades=[]; drawings=[]; drawTool='cursor'; placingStep=0; placingTradeLevel=null;
  positionsVisible=true;
  // UNA POSIZIONE APERTA: entrata 79900, stop 79700, target 80300 -> rapporto esatto 1:2
  positions=[{id:'P1',asset:currentAssetKey,side:'BUY',lots:0.1,entry:79900,sl:79700,tp:80300,
              startTime:Date.parse(R[R.length-40].date),openTF:1}];
  active=positions[0]; posSelezionata=positions[0];
  // UN ORDINE LIMITE NATO DA UNA SALA SEGNALI: entrata 79500, stop 79300, target 80100
  pendingOrders=[{id:'ORD1',createdAt:Date.now()-60000,asset:currentAssetKey,side:'BUY',
                  kind:'LIMIT',entry:79500,sl:79300,tp:80100,lots:0.1,
                  tgGruppo:'g1',tgTpIndice:1,tgSala:'Sala di prova',tgSegnaleId:'s1'}];
  try{ draw(); }catch(e){}
  return true;
})()`;

// Il testo che finisce DAVVERO sulla tela: il gancio e' fillText del contesto 2D reale, non una
// funzione del programma (dentro il programma le funzioni si chiamano per nome, quindi
// sostituirle dalla finestra non le intercetterebbe).
const CATTURA = `(function(){
  var c=document.getElementById('chart').getContext('2d');
  if(!c.__fillTextOriginale) c.__fillTextOriginale=c.fillText;
  window.__scritte=[];
  c.fillText=function(t){ window.__scritte.push(String(t)); return c.__fillTextOriginale.apply(this, arguments); };
  return true;
})()`;

// Dove rispondono le linee, in frazioni dell'area di plot: 10%, 25%, 50%, 75%, 90%.
const FRAZIONI = [0.10, 0.25, 0.50, 0.75, 0.90];

const sondaFasce = (pagina) => pagina.evaluate((frazioni) => {
  const g = chartGeometry();
  const xDa = g.pad.l, xA = g.rect.width - g.pad.r;
  const utile = xA - xDa;
  const chiedi = (prezzo, f) => {
    const x = xDa + utile*f;
    return tradeLevelHit(g.rect.left + x, g.rect.top + g.y(prezzo), false);
  };
  const righe = {};
  [['entrata',79500,'pending:ORD1:entry'],
   ['stop',79300,'pending:ORD1:sl'],
   ['target',80100,'pending:ORD1:tp']].forEach(([nome,prezzo,atteso]) => {
    righe[nome] = {atteso, risposte: frazioni.map(f => ({
      f, x: Math.round(xDa + utile*f), hit: chiedi(prezzo, f)
    }))};
  });
  return {geo:{tela:Math.round(g.rect.width), padL:g.pad.l, padR:g.pad.r, utile:Math.round(utile)},
          disegnabile: drawableOnCurrentChart(pendingOrders[0]), righe};
}, FRAZIONI);

test('A — le tre linee di un ordine limite si prendono su TUTTA la larghezza su cui si vedono', async () => {
  const {browser, pagina, errori} = await apriApp({larghezza:1300, altezza:850});
  try{
    await pagina.evaluate(PREPARA);
    const r = await sondaFasce(pagina);
    assert.equal(r.disegnabile, true,
      'l\'ordine limite del segnale deve essere disegnabile sul grafico del suo asset: ' + JSON.stringify(r));
    for(const nome of ['entrata','stop','target']){
      const riga = r.righe[nome];
      const mancanti = riga.risposte.filter(x => x.hit !== riga.atteso);
      assert.deepEqual(mancanti, [],
        'la linea ' + nome.toUpperCase() + ' dell\'ordine limite non risponde a queste distanze (tela '
        + r.geo.tela + ' px, area di plot ' + r.geo.utile + ' px): ' + JSON.stringify(mancanti));
    }
    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});

test('A2 — in mezzo al grafico il primo tocco aggancia l\'ENTRATA, non il vuoto', async () => {
  const {browser, pagina, errori} = await apriApp({larghezza:1300, altezza:850});
  try{
    await pagina.evaluate(PREPARA);
    const r = await pagina.evaluate(() => {
      const g = chartGeometry();
      const x = g.rect.left + (g.pad.l + (g.rect.width - g.pad.r - g.pad.l)/2);
      const y = g.rect.top + g.y(pendingOrders[0].entry);
      const prima = tradeLevelHit(x, y, false);
      // Primo tocco vero, a meta' grafico: deve ARMARE la linea dell'entrata.
      document.getElementById('chart').dispatchEvent(new PointerEvent('pointerdown',
        {clientX:x, clientY:y, bubbles:true, pointerId:1, pointerType:'mouse', button:0, isPrimary:true}));
      return {prima, armata: tradeLevelArmata};
    });
    assert.equal(r.prima, 'pending:ORD1:entry',
      'a meta\' grafico il tocco deve trovare l\'entrata dell\'ordine limite, trovato: ' + String(r.prima));
    assert.equal(r.armata, 'pending:ORD1:entry',
      'il primo tocco a meta\' grafico deve selezionare la linea di entrata, armata: ' + String(r.armata));
    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});

test('B — toccando lo stop di una posizione compare il rapporto rischio/rendimento', async () => {
  const {browser, pagina, errori} = await apriApp({larghezza:1300, altezza:850});
  try{
    await pagina.evaluate(PREPARA);
    await pagina.evaluate(CATTURA);
    const r = await pagina.evaluate(() => {
      const g = chartGeometry();
      // Dentro la casella Target/Stop della posizione, dove la sua linea e' agganciabile.
      const oi = rowIndexContainingTime(openReferenceTimeForPos(positions[0]));
      const z = zoneBoxXRange(g, oi, 'pos:P1', idx);
      const x = g.rect.left + (z.xOrigin + z.xRight)/2;
      const y = g.rect.top + g.y(positions[0].sl);
      const hit = tradeLevelHit(x, y, false);
      window.__scritte = [];
      document.getElementById('chart').dispatchEvent(new PointerEvent('pointerdown',
        {clientX:x, clientY:y, bubbles:true, pointerId:1, pointerType:'mouse', button:0, isPrimary:true}));
      draw();
      return {hit, armata: tradeLevelArmata, scritte: window.__scritte.slice()};
    });
    assert.equal(r.hit, 'SL', 'la linea dello stop deve essere agganciabile dentro la sua casella');
    assert.equal(r.armata, 'SL', 'il primo tocco deve selezionare lo stop');
    // Rapporto esatto della posizione: (80300-79900)/(79900-79700) = 2
    const conRapporto = r.scritte.filter(t => /1\s*[:/]\s*2([.,]0+)?\b/.test(t));
    assert.ok(conRapporto.length > 0,
      'toccando lo stop deve comparire a grafico l\'etichetta col rapporto rischio/rendimento (1:2). '
      + 'Scritte trovate: ' + JSON.stringify(r.scritte.slice(-25)));
    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});

test('B2 — trascinando lo stop il rapporto CAMBIA col movimento', async () => {
  const {browser, pagina, errori} = await apriApp({larghezza:1300, altezza:850});
  try{
    await pagina.evaluate(PREPARA);
    await pagina.evaluate(CATTURA);
    const r = await pagina.evaluate(() => {
      const chart = document.getElementById('chart');
      const g = chartGeometry();
      const oi = rowIndexContainingTime(openReferenceTimeForPos(positions[0]));
      const z = zoneBoxXRange(g, oi, 'pos:P1', idx);
      const x = g.rect.left + (z.xOrigin + z.xRight)/2;
      const giu = (p) => g.rect.top + g.y(p);
      const giu_ = (e,cx,cy) => chart.dispatchEvent(new PointerEvent(e,
        {clientX:cx, clientY:cy, bubbles:true, pointerId:1, pointerType:'mouse', button:0, isPrimary:true}));
      // Primo tocco: arma la linea. Secondo tocco sulla stessa linea: parte il trascinamento.
      giu_('pointerdown', x, giu(positions[0].sl));
      giu_('pointerup', x, giu(positions[0].sl));
      giu_('pointerdown', x, giu(positions[0].sl));
      // Ora si trascina lo stop a 79800: rischio 100, rendimento 400 -> rapporto 1:4
      window.__scritte = [];
      chart.dispatchEvent(new PointerEvent('pointermove',
        {clientX:x, clientY:giu(79800), bubbles:true, pointerId:1, pointerType:'mouse', buttons:1, isPrimary:true}));
      draw();
      return {drag: tradeLevelDrag, preview: previewTradeLevel, scritte: window.__scritte.slice()};
    });
    assert.equal(r.drag, 'SL', 'il secondo tocco sulla linea deve far partire il trascinamento dello stop');
    assert.ok(r.preview && Math.abs(r.preview.price - 79800) < 60,
      'l\'anteprima deve seguire il movimento: ' + JSON.stringify(r.preview));
    const conRapporto = r.scritte.filter(t => /1\s*[:/]\s*4([.,]0+)?\b/.test(t));
    assert.ok(conRapporto.length > 0,
      'durante il trascinamento dello stop a 79800 l\'etichetta deve dire 1:4 (rischio 100, '
      + 'rendimento 400). Scritte trovate: ' + JSON.stringify(r.scritte.slice(-25)));
    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});
