// IL PREZZO DI UN DISEGNO SELEZIONATO COMPARE SULLA SCALA, NEL PUNTO A E NEL PUNTO B.
//
// RICHIESTO dal proprietario (10 novembre 2026): «quando seleziono un disegno fammi vedere il suo
// prezzo sull'asse dei prezzi, nel punto A e (se il disegno ha due punti) anche nel punto B, e i
// cartellini devono seguire il disegno. Gli assi prezzo e tempo sempre visibili. Per il Fibonacci
// solo i punti 0 e 1: le fasce intermedie restino interne.»
//
// Questo test NON cerca stringhe nel sorgente: strumenta drawPriceAxisTag (la stessa casella gia'
// usata per l'entrata delle posizioni) e conta quali prezzi passano davvero, per ogni tipo di
// disegno. Misura anche che un disegno col prezzo FUORI dalla scala visibile non produca un
// cartellino con un prezzo falso, e che il cartellino segua il disegno quando lo si sposta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Il prepara DEVE essere autonomo: gira dentro la pagina, dove le costanti di Questo file non
// esistono (misurato: "T0 is not defined"). Tutto quello che serve sta scritto qui dentro.
const PREPARA = `(function(){
  var T0=Date.UTC(2026,9,20,10,0,0), R=[], i;
  for(i=0;i<200;i++){
    R.push({date:new Date(T0+i*60000).toISOString(),open:100,high:100.8,low:99.2,close:100.1,volume:10});
  }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length-1;
  currentAssetKey='EURUSD';
  if(typeof rowsAssetKey!=='undefined') rowsAssetKey='EURUSD';
  liveModeActive=false; mt5Connected=false;
  positions=[]; trades=[]; active=null; pendingOrders=[];
  var UNO=['horizontal','horizontalray','vertical','crossline','alarmline'];
  var DUE=['trendline','extendedline','ray','infoline','trendangle','rectangle','fib'];
  drawings=[];
  UNO.concat(DUE).forEach(function(tipo){
    var d={id:'d_'+tipo,type:tipo,color:'#3ea6ff',
           p1:{time:T0+40*60000,price:100},
           p2:{time:T0+120*60000,price:100.6}};
    if(UNO.indexOf(tipo)>=0) d.p2={time:d.p1.time,price:d.p1.price};
    drawings.push(d);
  });
  selectedDrawing=null;
  drawTool='cursor'; pendingDrawing=null; placingStep=0;
  return true;
})()`;

// Conta i prezzi che finiscono davvero sulla scala del prezzo.
const LEGGI = `(function(){
  const originale = drawPriceAxisTag;
  const visti = [];
  drawPriceAxisTag = function(ctx, y, prezzo){
    visti.push(Number(prezzo));
    return originale.apply(this, arguments);
  };
  try { draw(); } finally { drawPriceAxisTag = originale; }
  return visti;
})()`;

const esegui = (pagina, tipo, correzioni) => pagina.evaluate((a) => {
  eval(a.prepara);
  selectedDrawing = drawings.find(function(x){ return x.type === a.tipo; }) || null;
  if (a.correzioni) eval(a.correzioni);
  return eval(a.leggi);
}, {prepara: PREPARA, tipo, correzioni: correzioni || null, leggi: LEGGI});

const conta = (lista, prezzo) => lista.filter(x => Math.abs(x - prezzo) < 1e-9).length;

test('un disegno a un punto mette UN cartellino sulla scala', async () => {
  for (const tipo of ['horizontal', 'horizontalray', 'vertical', 'crossline', 'alarmline']) {
    const {browser, pagina, errori} = await apriApp();
    try {
      const r = await esegui(pagina, tipo);
      assert.equal(conta(r, 100), 1, tipo + ': un punto solo, un cartellino: ' + JSON.stringify(r));
      assert.equal(conta(r, 100.6), 0,
        tipo + ': p2 e\' un clone di p1, non deve comparire due volte: ' + JSON.stringify(r));
      assert.deepEqual(errori, [], 'nessun errore di pagina con ' + tipo);
    } finally { await browser.close(); }
  }
});

test('un disegno a due punti mette DUE cartellini, A e B', async () => {
  for (const tipo of ['trendline', 'extendedline', 'ray', 'infoline', 'trendangle', 'rectangle', 'fib']) {
    const {browser, pagina, errori} = await apriApp();
    try {
      const r = await esegui(pagina, tipo);
      assert.equal(conta(r, 100), 1,
        tipo + ': il punto A deve avere il suo cartellino: ' + JSON.stringify(r));
      assert.equal(conta(r, 100.6), 1,
        tipo + ': e anche il punto B: ' + JSON.stringify(r));
      assert.deepEqual(errori, [], 'nessun errore di pagina con ' + tipo);
    } finally { await browser.close(); }
  }
});

test('il Fibonacci mette i due estremi (0 e 1), non le fasce di mezzo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await esegui(pagina, 'fib');
    assert.equal(conta(r, 100), 1, 'punto 1 sulla scala: ' + JSON.stringify(r));
    assert.equal(conta(r, 100.6), 1, 'punto 0 sulla scala: ' + JSON.stringify(r));
    [100.3564, 100.1708, 100.3, 100.4292, 100.5432].forEach(f => {
      assert.equal(conta(r, f), 0,
        'la fascia ' + f + ' deve restare interna al grafico: ' + JSON.stringify(r));
    });
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza disegno selezionato non compare niente di nuovo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await esegui(pagina, 'trendline', 'selectedDrawing = null;');
    assert.equal(conta(r, 100), 0,
      'senza selezione il disegno non deve occupare la scala: ' + JSON.stringify(r));
    assert.equal(conta(r, 100.6), 0, 'idem per il punto B');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il cartellino segue il disegno: si sposta col prezzo, non resta ancorato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await esegui(pagina, 'trendline',
      'var d=drawings.find(function(x){return x.type==="trendline";}); d.p1.price=99.6; d.p2.price=100.4;');
    assert.equal(conta(r, 99.6), 1,
      'spostato il punto A, il cartellino deve essere al nuovo prezzo: ' + JSON.stringify(r));
    assert.equal(conta(r, 100.4), 1, 'idem per il punto B');
    assert.equal(conta(r, 100), 0,
      'il cartellino non deve restare sul prezzo di prima: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un disegno col prezzo fuori dalla scala NON produce un cartellino falso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await esegui(pagina, 'trendline',
      'var d=drawings.find(function(x){return x.type==="trendline";}); d.p1.price=130; d.p2.price=130.6;');
    assert.equal(conta(r, 130), 0,
      'fuori scala non si deve mostrare un prezzo che non si vede: ' + JSON.stringify(r));
    assert.equal(conta(r, 130.6), 0, 'idem per il punto B');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
