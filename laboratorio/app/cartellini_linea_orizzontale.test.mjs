// LINEA ORIZZONTALE / TREND LINE DRITTA: SULLA SCALA DEL PREZZO DEVE USCIRE UN SOLO CARTELLINO.
//
// RICHIESTO dal proprietario (10 novembre 2026): «per quanto riguarda i cartellini sui disegni: se
// mettiamo una linea dritta, dovrà farci vedere sull'asse del prezzo soltanto un cartellino, perché
// il punto A e il punto B stanno sullo stesso prezzo. Mentre se è obliqua ci disegnerà due etichette
// diverse.»
//
// QUESTO BANCO MISURA IL NUMERO DI CARTELLINI CHE ESCONO DAVVERO: disegna la trendline COL MOUSE
// (pointerdown/pointerup sintetici ma veri, come nei banchi etichette_livello_prezzo e
// footprint_tocco_stile) e conta le chiamate a drawPriceAxisTag, la casella riusata per l'entrata
// delle posizioni. La trendline si prova in tre modi: i due click alla STESSA altezza, la stessa
// linea col lucchetto "linea dritta" (applyStraightLock obbliga il punto B sul prezzo del punto A)
// e la linea OBLIQUA, che deve invece continuare a fare DUE cartellini (prova di controllo: senza
// di essa un banco verde potrebbe voler dire "un cartellino sempre").
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Un PointerEvent sintetico non ha un "active pointer" vero: i releasePointerCapture del gestore
// principale del canvas sollevano NotFoundError. È rumore del banco, non un errore dell'app:
// stessa regola di footprint_tocco_stile.test.mjs.
const senzaRumorePointer = (errori) => errori.filter(e => !/PointerCapture/.test(e));

// Il prepara DEVE essere autonomo: gira dentro la pagina, dove le costanti di questo file non
// esistono (misurato: "T0 is not defined" nel primo tentativo con variabili esterne).
const PREPARA = `(function(){
  var T0=Date.UTC(2026,9,20,10,0,0), R=[], i;
  for(i=0;i<200;i++){
    R.push({date:new Date(T0+i*60000).toISOString(),open:100,high:100.8,low:99.2,close:100.1,volume:10});
  }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length-1;
  currentAssetKey='EURUSD'; rowsAssetKey='EURUSD';
  liveModeActive=false; mt5Connected=false;
  positions=[]; trades=[]; active=null; pendingOrders=[];
  drawings=[]; selectedDrawing=null; pendingDrawing=null; placingStep=0; drawTool='cursor';
  straightLockKey=false; straightLockToggle=false;
  return true;
})()`;

// Misura (A): due click col mouse. dySpostamento sposta in altezza il SECONDO click (0 = stessa
// altezza, quindi A e B hanno lo stesso prezzo). forzaDritta accende il lucchetto della trendline.
const eseguiA = (pagina, opzioni) => pagina.evaluate((a) => {
  eval(a.prepara);
  const cv = document.getElementById('chart');
  const rc = cv.getBoundingClientRect();
  const click = (x, y) => {
    const o = {pointerId:7,pointerType:'mouse',button:0,buttons:1,clientX:x,clientY:y,bubbles:true,cancelable:true};
    cv.dispatchEvent(new PointerEvent('pointerdown', o));
    cv.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, o, {buttons:0})));
  };
  drawTool = 'trendline';
  straightLockToggle = !!a.forzaDritta;
  const yA = rc.top + rc.height/2;
  click(rc.left+300, yA);
  click(rc.left+700, yA + a.dySpostamento);
  const d = drawings[drawings.length-1] || null;
  const creato = d ? {tipo:d.type, p1:d.p1.price, p2:d.p2.price} : null;
  selectedDrawing = d; drawTool = 'cursor';
  const originale = drawPriceAxisTag, visti = [];
  drawPriceAxisTag = function(ctx, y, prezzo){ visti.push(Number(prezzo)); return originale.apply(this, arguments); };
  try { draw(); } finally { drawPriceAxisTag = originale; }
  return {creato:creato, prezzi:visti};
}, {prepara: PREPARA, forzaDritta: !!opzioni.forzaDritta, dySpostamento: opzioni.dySpostamento || 0});

const conta = (lista, prezzo) => lista.filter(x => Math.abs(x - prezzo) < 1e-9).length;

test('trendline coi due punti allo stesso prezzo: UN cartellino, non due', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await eseguiA(pagina, {dySpostamento: 0});
    assert.equal(r.creato.tipo, 'trendline', 'il primo click fissa il punto A, il secondo il punto B');
    assert.equal(r.creato.p1, r.creato.p2,
      'i due click sono alla stessa altezza: A e B hanno lo stesso prezzo');
    assert.equal(conta(r.prezzi, r.creato.p1), 1,
      'stesso prezzo in A e in B: UN SOLO cartellino. Cartellini usciti: ' + JSON.stringify(r.prezzi));
    assert.equal(r.prezzi.length, 1, 'nient\'altro sulla scala: ' + JSON.stringify(r.prezzi));
    assert.deepEqual(senzaRumorePointer(errori), []);
  } finally { await browser.close(); }
});

test('trendline col lucchetto "linea dritta": UN cartellino', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await eseguiA(pagina, {dySpostamento: 120, forzaDritta: true});
    assert.equal(r.creato.p1, r.creato.p2,
      'il lucchetto della linea dritta obbliga il punto B sullo stesso prezzo del punto A');
    assert.equal(conta(r.prezzi, r.creato.p1), 1,
      'linea dritta: UN SOLO cartellino. Cartellini usciti: ' + JSON.stringify(r.prezzi));
    assert.deepEqual(senzaRumorePointer(errori), []);
  } finally { await browser.close(); }
});

test('trendline OBLIQUA: DUE cartellini, prezzi diversi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await eseguiA(pagina, {dySpostamento: 120});
    assert.notEqual(r.creato.p1, r.creato.p2, 'i due punti sono ad altezze diverse: prezzi diversi');
    assert.equal(conta(r.prezzi, r.creato.p1), 1, 'il punto A deve avere il suo cartellino: ' + JSON.stringify(r.prezzi));
    assert.equal(conta(r.prezzi, r.creato.p2), 1, 'e anche il punto B: ' + JSON.stringify(r.prezzi));
    assert.equal(r.prezzi.length, 2, 'uno per punto, non di piu\': ' + JSON.stringify(r.prezzi));
    assert.deepEqual(senzaRumorePointer(errori), []);
  } finally { await browser.close(); }
});
