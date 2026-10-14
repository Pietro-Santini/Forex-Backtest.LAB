// ORDINI PENDENTI A GRAFICO: si vede QUANTO, e si spengono con le altre posizioni.
//
// RICHIESTO dal proprietario: «per gli ordini limite sul grafico mi deve far vedere comunque il
// lottaggio prescelto di quella posizione di ordine limite. In più, quando andiamo a selezionare
// una posizione a grafico, è vero che mette in grigio le altre posizioni attive, ma deve mettere
// in grigio anche gli ordini pendenti e deve togliere le linee orizzontali dei TP e degli stop
// loss degli ordini pendenti».
//
// Le righe di stop e target di un ordine pendente attraversano TUTTO il grafico da un bordo
// all'altro: sono proprio quelle che impediscono di leggere la posizione che si è scelta.
// L'entrata invece resta — spenta — perché serve a sapere che quell'ordine è lì in attesa.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

const PREPARA = () => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++) R.push({date: new Date(t0 + i * 60000).toISOString(),
    open: 100, high: 100.8, low: 99.2, close: 100.2, volume: 5});
  rows = R; baseRows = R; currentTF = 1; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD'; if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; liveReplayActive = false; mt5Connected = false;
  trades = []; drawings = []; replayForm = null;
  positions = [{id: 'P1', asset: 'EURUSD', side: 'BUY', entry: 100, sl: 99.5, rrSl: 99.5,
                tp: 100.6, lots: 0.1, marginUsed: 10, start: 150, startTime: t0 + 150 * 60000}];
  pendingOrders = [{id: 'O1', asset: 'EURUSD', side: 'BUY', kind: 'LIMIT', entry: 99.8,
                    sl: 99.3, tp: 100.9, lots: 0.25, createdAt: t0}];
  active = null; posSelezionata = null; positionsVisible = true;
  highlightedPendingOrderId = null;
  followLatest = false; viewPriceLo = 99; viewPriceHi = 101; priceZoomFactor = 1;
  draw();
};

// Raccoglie tutte le scritte di un giro di disegno.
const SCRITTE = () => {
  const proto = CanvasRenderingContext2D.prototype;
  const orig = proto.fillText;
  const viste = [];
  proto.fillText = function(t, ...r){ viste.push(String(t)); return orig.call(this, t, ...r); };
  try { draw(); } finally { proto.fillText = orig; }
  return viste;
};

test('un ordine limite dice anche quanto: il lottaggio sta nella sua etichetta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(({P, S}) => {
      eval('(' + P + ')()');
      const viste = (eval('(' + S + ')'))();
      return viste.filter(t => /LIMIT/.test(t));
    }, {P: PREPARA.toString(), S: SCRITTE.toString()});
    assert.ok(r.length, 'l etichetta dell ordine limite deve esserci');
    assert.ok(r.some(t => /0\.25/.test(t)),
      'e deve contenere il lottaggio scelto: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('scelta una posizione, le linee di TP e SL dei pendenti spariscono', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(({P, S}) => {
      eval('(' + P + ')()');
      const prima = (eval('(' + S + ')'))().filter(t => /\(pending\)/.test(t));
      // L utente sceglie la posizione: da qui in poi il grafico si concentra su quella.
      focusPosition(positions[0]);
      const dopo = (eval('(' + S + ')'))().filter(t => /\(pending\)/.test(t));
      // E cliccando sul vuoto torna tutto.
      active = null; posSelezionata = null;
      const ripristino = (eval('(' + S + ')'))().filter(t => /\(pending\)/.test(t));
      return {prima, dopo, ripristino};
    }, {P: PREPARA.toString(), S: SCRITTE.toString()});
    assert.equal(r.prima.length, 2, 'senza selezione si vedono le righe di SL e TP del pendente');
    assert.deepEqual(r.dopo, [],
      'con una posizione scelta devono sparire: ' + JSON.stringify(r.dopo));
    assert.equal(r.ripristino.length, 2, 'cliccando sul vuoto tornano');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('e l ordine pendente resta visibile, ma spento', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(({P}) => {
      eval('(' + P + ')()');
      // Si guarda il colore con cui viene tracciata la linea dell entrata del pendente.
      const proto = CanvasRenderingContext2D.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'strokeStyle');
      let grigi = 0;
      Object.defineProperty(proto, 'strokeStyle', {
        configurable: true,
        get(){ return desc.get.call(this); },
        set(v){ if (String(v) === TRADE_DIM_GREY) grigi++; desc.set.call(this, v); }
      });
      let senza = 0, con = 0;
      try{
        grigi = 0; draw(); senza = grigi;
        focusPosition(positions[0]);
        grigi = 0; draw(); con = grigi;
      } finally { Object.defineProperty(proto, 'strokeStyle', desc); }
      // E l etichetta dell ordine c e ancora.
      const orig = proto.fillText; const viste = [];
      proto.fillText = function(t, ...r){ viste.push(String(t)); return orig.call(this, t, ...r); };
      try{ draw(); } finally { proto.fillText = orig; }
      return {senza, con, etichetta: viste.some(t => /LIMIT/.test(t))};
    }, {P: PREPARA.toString()});
    assert.equal(r.senza, 0, 'senza selezione niente è spento');
    assert.ok(r.con > 0, 'con una posizione scelta il pendente passa al grigio spento');
    assert.equal(r.etichetta, true, 'ma l ordine resta visibile: deve sapersi che è lì in attesa');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la regola è la stessa delle posizioni, non una seconda scritta a parte', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  // Si riusa activeOnChart: la condizione "una posizione scelta DALL UTENTE su questo grafico".
  assert.match(src, /const pendSpento=activeOnChart;/,
    'gli ordini pendenti devono seguire la stessa condizione delle posizioni');
  assert.match(src, /if\(pendSpento\)return;/,
    'e le loro righe orizzontali di SL e TP non si disegnano affatto');
  assert.match(src, /const lotTxt=Number\.isFinite\(Number\(p\.lots\)\)/,
    'il lottaggio deve entrare nell etichetta dell ordine');
});
