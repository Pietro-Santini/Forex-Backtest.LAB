// Asse prezzi: l'unica cosa che deve fare è zoomare la vista.
//
// Difetto segnalato (9 ottobre 2026): trascinando sulla barra dei prezzi, se sotto c'era una linea
// TP/SL o un ordine pendente partiva il trascinamento della LINEA invece dello zoom. E le colonne
// COB/SVP zoomavano pure loro, perché la striscia di zoom era stata spostata sopra di esse.
//
// Qui si prova il comportamento VERO del gestore del grafico, con eventi sintetici sul canvas:
//  - sulla striscia dell'asse si zooma e NON si sposta la linea che sta sotto;
//  - sulle colonne COB/SVP non si zooma: si trascina il grafico (pan);
//  - la striscia di zoom resta ancorata al bordo destro, non sopra le colonne.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp, PREPARA_BTC} from './aiuti.mjs';

// Rende il grafico pronto e "una linea sotto il puntatore": l'hit-test delle linee risponde di sì e
// la linea è pronta a essere trascinata. Inoltre neutralizza le catture di puntatore (con un evento
// sintetico il puntatore non è "attivo": setPointerCapture lancerebbe).
const PREPARA = () => {
  drawTool = 'cursor';
  placingTradeLevel = null; priceAxisDrag = null; tradeLevelDrag = null; panDrag = false;
  highlightCloseBtnRect = null; pendingHighlightCloseBtnRect = null; zoneStatsCloseBtnRect = null;
  const cv = document.getElementById('chart');
  cv.setPointerCapture = () => {}; cv.releasePointerCapture = () => {};
  tradeLevelHit = () => ({kind:'tp'});
  tradeLevelPronta = () => true;
};

test('sulla barra dei prezzi si zooma e NON si sposta la linea che sta sotto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA_BTC);
    const r = await pagina.evaluate((prep) => {
      eval('(' + prep + ')')();
      const cv = document.getElementById('chart');
      const b = cv.getBoundingClientRect();
      const tocca = (tipo, x, y) => cv.dispatchEvent(new PointerEvent(tipo, {
        pointerId: 7, pointerType: 'mouse', bubbles: true, cancelable: true, clientX: x, clientY: y
      }));
      tocca('pointerdown', b.left + b.width - 10, b.top + b.height / 2);   // ultimi 10px: sull'asse
      return {zoom: !!priceAxisDrag, linea: !!tradeLevelDrag};
    }, PREPARA.toString());
    assert.equal(r.zoom, true, 'sulla striscia dell asse deve partire lo zoom verticale');
    assert.equal(r.linea, false, 'sulla striscia dell asse NON deve partire il trascinamento di una linea');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('sulle colonne COB/SVP non si zooma: si trascina il grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA_BTC);
    const r = await pagina.evaluate((prep) => {
      eval('(' + prep + ')')();
      cobSvpActiveNow = () => true;    // colonne accese
      cobSvpExtraWidth = () => 128;    // 128px di colonne: fascia [w-204, w-76)
      const cv = document.getElementById('chart');
      const b = cv.getBoundingClientRect();
      const tocca = (tipo, x, y) => cv.dispatchEvent(new PointerEvent(tipo, {
        pointerId: 7, pointerType: 'mouse', bubbles: true, cancelable: true, clientX: x, clientY: y
      }));
      tocca('pointerdown', b.left + b.width - 140, b.top + b.height / 2);  // dentro le colonne
      return {pan: !!panDrag, zoom: !!priceAxisDrag, linea: !!tradeLevelDrag};
    }, PREPARA.toString());
    assert.equal(r.pan, true, 'sulle colonne COB/SVP si deve spostare il grafico');
    assert.equal(r.zoom, false, 'sulle colonne COB/SVP NON si deve zoomare la vista');
    assert.equal(r.linea, false, 'sulle colonne COB/SVP non si deve spostare una linea');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la striscia di zoom resta ancorata al bordo, non sopra le colonne COB/SVP', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA_BTC);
    const r = await pagina.evaluate(() => {
      cobSvpExtraWidth = () => 128;    // anche con 128px di colonne la striscia non si deve spostare
      draw();
      const cv = document.getElementById('chart').getBoundingClientRect();
      const pz = document.getElementById('priceAxisZone').getBoundingClientRect();
      return {cvRight: cv.right, pzLeft: pz.left, pzRight: pz.right};
    });
    assert.ok(r.pzLeft >= r.cvRight - 78,
      'la striscia di zoom deve stare sugli ultimi 76px (px left ' + r.pzLeft + ', canvas right ' + r.cvRight + ')');
    assert.ok(r.pzRight <= r.cvRight + 1, 'la striscia di zoom non deve sporgere oltre il bordo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
