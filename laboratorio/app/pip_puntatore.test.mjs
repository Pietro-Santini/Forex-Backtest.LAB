// IL PUNTATORE NELLA FINESTRA SEPARATA DEVE PUNTARE IL PUNTO CHE SI INDICA.
//
// RICHIESTA del proprietario (22 ottobre 2026): «abbiamo problemi con il puntatore, che e'
// sfasato di posizione sia dell'asse X che dell'asse Y: io punto il mouse sopra il grafico e la
// posizione effettiva e' spostata in alto a sinistra».
//
// MISURA (non intuirione): con la scala UI al 130% il #chartWrap porta il CONTRO-ZOOM (perche'
// il body della pagina e' zoomato) e quel contro-zoom VIAGGIA col nodo quando il grafico si
// sposta in un'altra finestra. Ma in quella finestra il body NON e' zoomato: il grafico si
// trovava 950 px di layout contro 730 px a schermo, e il mirino finiva 78 px a sinistra e 55 px
// in alto rispetto al mouse.
//
// Il test misura il COMPORTAMENTO: muove il mouse in un punto noto della finestra separata,
// guarda i PIXEL del canvas e cerca la linea del mirino: deve cadere sotto il mouse.
// Come si prova che il test serve: prima della correzione il mirino cadeva 78 px a sinistra e
// 55 px in alto -> il test va rosso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp, PREPARA_BTC} from './aiuti.mjs';

// La scala UI con cui il difetto si vede: il contro-zoom del grafico viaggia col nodo.
const SCALA = 130;

function finestraNuova(pagina) {
  const pagine = pagina.context().pages();
  return pagine[pagine.length - 1];
}

test('nella finestra separata il mirino cade sotto il mouse (X e Y)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA_BTC);
    await pagina.evaluate((s) => { fblScalaUiApplica(document, s); }, SCALA);
    await pagina.waitForTimeout(300);

    await pagina.click('#floatChartBtn');
    await pagina.waitForTimeout(1200);
    const finestra = finestraNuova(pagina);
    await finestra.waitForTimeout(600);

    const geo = await finestra.evaluate(() => {
      const c = document.getElementById('chart');
      const r = c.getBoundingClientRect();
      return {left: r.left, top: r.top, width: r.width, height: r.height,
              clientW: c.clientWidth, clientH: c.clientHeight,
              attrW: c.width, attrH: c.height, dpr: devicePixelRatio};
    });

    // La regola che deve valere: il grafico e' la stessa cosa in layout e a schermo. Se il
    // contro-zoom resta appiccicato al nodo spostato, il disegno e la lettura del puntatore
    // parlano di due grafici diversi.
    assert.ok(Math.abs(geo.clientW - geo.width) <= 1,
      'il grafico nella finestra e\' piu\' piccolo a schermo che in layout (' + geo.clientW + ' contro ' + geo.width + '): il puntatore non puo\' puntare il posto giusto');
    assert.ok(Math.abs(geo.clientH - geo.height) <= 1,
      'stessa cosa in verticale (' + geo.clientH + ' contro ' + geo.height + ')');

    const mouse = {x: Math.round(geo.left + geo.width * 0.5), y: Math.round(geo.top + geo.height * 0.4)};
    const atteso = {x: mouse.x - geo.left, y: mouse.y - geo.top};

    // Scatto col mirino, poi scatto senza: la differenza dice DOVE il mirino e' stato
    // disegnato. Niente stringhe nel sorgente: si guarda il risultato a schermo.
    await finestra.mouse.move(mouse.x, mouse.y);
    await finestra.waitForTimeout(300);
    await finestra.evaluate(() => {
      const c = document.getElementById('chart');
      window.__scattaA = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    });
    await finestra.mouse.move(5, 5);
    await finestra.waitForTimeout(400);

    const diff = await finestra.evaluate(() => {
      const c = document.getElementById('chart');
      const B = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      const A = window.__scattaA;
      const W = c.width, H = c.height;
      const col = new Array(W).fill(0), row = new Array(H).fill(0);
      for (let i = 0; i < A.length; i += 4) {
        if (Math.abs(A[i] - B[i]) > 12 || Math.abs(A[i + 1] - B[i + 1]) > 12 || Math.abs(A[i + 2] - B[i + 2]) > 12) {
          const p = i / 4, x = p % W, y = (p - x) / W;
          col[x]++; row[y]++;
        }
      }
      // La colonna del mirino: si cerca dentro l'area del grafico (l'asse dei prezzi sta
      // nell'ultimo pezzo a destra e ha una sua etichetta luminosa: non e' il mirino).
      const limite = Math.max(0, W - 90);
      let best = -1, bestN = 0;
      for (let x = 0; x < limite; x++) { if (col[x] > bestN) { bestN = col[x]; best = x; } }
      let bestY = 0, bestYN = 0;
      for (let y = 0; y < H; y++) { if (row[y] > bestYN) { bestYN = row[y]; bestY = y; } }
      return {x: best, y: bestY, nCol: bestN, nRow: bestYN};
    });

    assert.ok(diff.nCol > 5 && diff.nRow > 5, 'non si vede nessun mirino nella finestra separata');

    const dpr = geo.dpr || 1;
    const scartoX = Math.abs(diff.x / dpr - atteso.x);
    const scartoY = Math.abs(diff.y / dpr - atteso.y);
    assert.ok(scartoX <= 3,
      'in X il mirino cade ' + (diff.x / dpr).toFixed(1) + ' invece di ' + atteso.x.toFixed(1) + ': sfasato di ' + scartoX.toFixed(1) + ' px');
    assert.ok(scartoY <= 3,
      'in Y il mirino cade ' + (diff.y / dpr).toFixed(1) + ' invece di ' + atteso.y.toFixed(1) + ': sfasato di ' + scartoY.toFixed(1) + ' px');

    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('al rientro il grafico torna nella pagina con la sua scala (il contro-zoom torna)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA_BTC);
    await pagina.evaluate((s) => { fblScalaUiApplica(document, s); }, SCALA);
    await pagina.waitForTimeout(300);

    const prima = await pagina.evaluate(() => getComputedStyle(document.getElementById('chartWrap')).zoom);

    await pagina.click('#floatChartBtn');
    await pagina.waitForTimeout(1200);
    const finestra = finestraNuova(pagina);
    await finestra.waitForTimeout(400);

    // Nella finestra separata il contro-zoom deve SPARIRE (l'i' non c'e' piu' un body zoomato
    // da contro-zoomare): e' lui che faceva puntare il mouse nel posto sbagliato.
    const inFinestra = await finestra.evaluate(() => ({
      zoomInline: document.getElementById('chartWrap').style.zoom,
      zoomCalcolato: getComputedStyle(document.getElementById('chartWrap')).zoom
    }));
    assert.equal(inFinestra.zoomInline, '', 'nella finestra separata il contro-zoom deve essere tolto');

    await pagina.evaluate(() => { try { floatingWin.close(); } catch (e) {} });
    await pagina.waitForTimeout(800);

    const dopo = await pagina.evaluate(() => ({
      zoomCalcolato: getComputedStyle(document.getElementById('chartWrap')).zoom,
      nelDocumentoPrincipale: document.getElementById('chartWrap').ownerDocument === document,
      chiusa: !floatingChartActive()
    }));
    assert.equal(dopo.nelDocumentoPrincipale, true, 'il grafico non e\' tornato nella pagina principale');
    assert.equal(dopo.chiusa, true, 'la finestra separata risulta ancora aperta');
    assert.equal(dopo.zoomCalcolato, prima, 'al rientro il contro-zoom del grafico deve tornare com\'era');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
