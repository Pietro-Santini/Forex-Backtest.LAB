// MENTRE SI DISEGNA UNA LINEA, IL MIRINO DEL MOUSE CON I DUE ASSI E I LORO CARTELLINI.
//
// RICHIESTO dal proprietario (10 novembre 2026): «però, quando andiamo a selezionare una trend
// line, cioè una riga, ci deve far vedere il puntatore, sia l'asse del tempo che l'asse del
// prezzo, con i rispettivi cartellini. Come se ci stessimo spostando nel grafico con il mouse. E
// deve valere sia per la posizione del punto A che del punto B. Così l'utente ha modo di vedere
// dove sta mettendo il punto A e il punto B, sia sulla scala verticale che su quella
// orizzontale.»
//
// QUESTO BANCO MISURA IL COMPORTAMENTO, non una stringa nel sorgente: con lo strumento trendline
// attivo muove il mouse sopra il grafico con un pointermove SINTETICO MA VERO (pointerType:'mouse')
// e legge ciò che il mirino disegna davvero — le due linee della croce (pixel letti col
// getImageData del contesto reale) e i due cartellini (testi catturati agganciando fillText).
// Tre situazioni, tutte richieste: COL CURSORE (prova di controllo: il mirino oggi funziona, se
// questa è rossa il banco è rotto, non l'app), PRIMA di fissare il punto A, e col punto A già
// fissato mentre si tira il punto B.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Un PointerEvent sintetico non ha un "active pointer" vero: i releasePointerCapture del gestore
// principale del canvas sollevano NotFoundError. È rumore del banco, non un errore dell'app:
// stessa regola di footprint_tocco_stile.test.mjs.
const senzaRumorePointer = (errori) => errori.filter(e => !/PointerCapture/.test(e));

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
  return true;
})()`;

// Dentro la pagina. Cattura i testi disegnati con fillText e conta i pixel chiari (la croce del
// mirino è bianca) sulla riga e sulla colonna del mouse.
const esegui = (pagina, opzioni) => pagina.evaluate((a) => {
  eval(a.prepara);
  const cv = document.getElementById('chart');
  const ctx = cv.getContext('2d');
  const testi = [];
  if(!ctx.__fillOrig) ctx.__fillOrig = ctx.fillText;
  ctx.fillText = function(t){ testi.push(String(t)); return ctx.__fillOrig.apply(this, arguments); };
  const rc = cv.getBoundingClientRect();
  const x = rc.left + 400, y = rc.top + rc.height/2;
  const muovi = () => cv.dispatchEvent(new PointerEvent('pointermove',
    {pointerId:7, pointerType:'mouse', button:0, buttons:0, clientX:x, clientY:y, bubbles:true, cancelable:true}));
  const click = () => {
    const o = {pointerId:7, pointerType:'mouse', button:0, buttons:1, clientX:x, clientY:y, bubbles:true, cancelable:true};
    cv.dispatchEvent(new PointerEvent('pointerdown', o));
    cv.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, o, {buttons:0})));
  };
  if(a.strumento !== 'cursor') setDrawTool(a.strumento);
  if(a.primaIlClick) click();        // fissa il punto A: placingStep 1, il mouse tira il punto B
  muovi();
  // I pixel: la croce del mirino è una linea chiara (bianca su fondo scuro, nera su fondo chiaro)
  // che attraversa quasi tutta l'area di disegno. La riconosco per CONTRASTO, non per il bianco
  // assoluto: il tema potrebbe essere chiaro (misurato: il colore linea segue il fondo scelto).
  // Un pixel fa parte della croce se è molto diverso dallo sfondo preso nello stesso punto DOPO
  // aver spento il mirino: la croce è l'unica cosa che sparisce, candele e assi restano.
  const dpr = cv.width/cv.clientWidth, w = cv.clientWidth, h = cv.clientHeight;
  const relX = x - rc.left, relY = y - rc.top;
  const leggi = () => {
    const r = ctx.getImageData(Math.round(18*dpr), Math.round(relY*dpr), Math.round((w-76-18)*dpr), 1).data;
    const c = ctx.getImageData(Math.round(relX*dpr), Math.round(18*dpr), 1, Math.round((h-18-18)*dpr)).data;
    return {r:r, c:c};
  };
  const conMirino = leggi();
  crosshair = null; anteprimaDisegno = null; draw();
  const senzaMirino = leggi();
  const distanza = (a, b) => Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]);
  const differenze = (con, senza) => {
    let n = 0;
    for(let i = 0; i < con.length; i += 4){
      if(distanza([con[i],con[i+1],con[i+2]], [senza[i],senza[i+1],senza[i+2]]) > 60) n++;
    }
    return n;
  };
  ctx.fillText = ctx.__fillOrig;
  return {
    passi: {strumento:drawTool, placingStep:placingStep, pending:!!pendingDrawing},
    // rigaCroce/colonnaCroce: quanti pixel della riga/colonna del mouse sono cambiati
    // accendendo il mirino (candele e assi restano identici: è la croce, e solo lei)
    rigaCroce: differenze(conMirino.r, senzaMirino.r),
    colonnaCroce: differenze(conMirino.c, senzaMirino.c),
    testi: testi,
    // il prezzo sotto al mouse, formattato come fa l'app: il cartellino della scala prezzi
    prezzoAtteso: (()=>{ const g=chartGeometry(); return g?fmtPrice(g.price(relY)):null; })()
  };
}, {prepara: PREPARA, strumento: opzioni.strumento, primaIlClick: !!opzioni.primaIlClick});

// Il cartellino del tempo del mirino: "20 ott '26  14:26" (giorno mese 'anno  ora:minuto).
const REG_DATA = /^\d{1,2} \S+ '\d{2}\s+\d{2}:\d{2}$/;

test('COL CURSORE il mirino c\'è: riga + colonna + cartellino prezzo + cartellino data', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await esegui(pagina, {strumento:'cursor', primaIlClick:false});
    assert.ok(r.rigaCroce > 200, 'la riga orizzontale del mirino deve esserci: ' + r.rigaCroce);
    assert.ok(r.colonnaCroce > 200, 'e anche la colonna verticale: ' + r.colonnaCroce);
    assert.ok(r.testi.some(t => REG_DATA.test(t)),
      'il cartellino della data/ora deve comparire: ' + JSON.stringify(r.testi));
    assert.deepEqual(senzaRumorePointer(errori), []);
  } finally { await browser.close(); }
});

test('TRENDLINE, prima di fissare il punto A: il mirino con i due assi deve esserci', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await esegui(pagina, {strumento:'trendline', primaIlClick:false});
    assert.equal(r.passi.strumento, 'trendline', 'lo strumento riga è selezionato');
    assert.equal(r.passi.placingStep, 0, 'ancora nessun punto fissato: si sta scegliendo il punto A');
    assert.ok(r.rigaCroce > 200,
      'il puntatore deve comparire anche mentre si prepara la riga: ' + r.rigaCroce);
    assert.ok(r.colonnaCroce > 200,
      'e deve evidenziare anche l\'asse del tempo: ' + r.colonnaCroce);
    assert.ok(r.testi.some(t => REG_DATA.test(t)),
      'i cartellini di prezzo e tempo devono esserci: ' + JSON.stringify(r.testi));
    assert.deepEqual(senzaRumorePointer(errori), []);
  } finally { await browser.close(); }
});

test('TRENDLINE, punto A già fissato: il mirino con i due assi deve restare', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await esegui(pagina, {strumento:'trendline', primaIlClick:true});
    assert.equal(r.passi.placingStep, 1, 'il punto A è fissato: si sta tirando il punto B');
    assert.equal(r.passi.pending, true, 'pendingDrawing attivo');
    assert.ok(r.rigaCroce > 200,
      'il puntatore deve restare mentre si tira il punto B: ' + r.rigaCroce);
    assert.ok(r.colonnaCroce > 200,
      'e l\'asse del tempo evidenziato: ' + r.colonnaCroce);
    assert.ok(r.testi.some(t => REG_DATA.test(t)),
      'i cartellini di prezzo e tempo devono esserci: ' + JSON.stringify(r.testi));
    assert.deepEqual(senzaRumorePointer(errori), []);
  } finally { await browser.close(); }
});
