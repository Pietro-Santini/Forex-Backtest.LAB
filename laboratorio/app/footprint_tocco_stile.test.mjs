// FOOTPRINT: cambio stile al tocco della candela.
// REGOLA FISSA (richiesta esplicita del proprietario, vale per tutte le modifiche future):
// toccando SOPRA una candela lo stile del footprint deve SEMPRE passare bid/ask -> delta -> volume.
// L'area sensibile è volutamente una fascia che parte SOPRA l'alta della candela (non di fianco,
// dove stanno numeri/caselline), così anche candele minuscole o senza tick restano toccabili.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp, PREPARA_BTC} from './aiuti.mjs';

// Un PointerEvent sintetico non ha un "active pointer" vero: i setPointerCapture/
// releasePointerCapture del gestore principale del canvas sollevano NotFoundError. È rumore del banco
// di prova, non un errore dell'app, quindi lo si scarta prima di controllare errori[].
const senzaRumorePointer = (errori) => errori.filter(e => !/PointerCapture/.test(e));

test('tocco SOPRA la candela: lo stile passa sempre bid/ask -> delta -> volume -> bid/ask', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA_BTC);
    const r = await pagina.evaluate(() => {
      const cb = document.getElementById('footprintEnabled');
      cb.checked = true;
      footprintEnabled = true;
      const sel = document.getElementById('footprintStyle');
      sel.value = 'bidask';
      draw();
      const rects = footprintStyleHitRects.slice();
      if (!rects.length) return {n: 0};
      // Una candela in mezzo allo schermo: la sua fascia "cambio stile" parte sopra l'alta.
      const rec = rects[Math.floor(rects.length / 2)];
      const rc = chartEl.getBoundingClientRect();
      const x = (rec.xxLeft + rec.xxRight) / 2;
      // Punto all'estremità SUPERIORE della fascia: sicuramente SOPRA la candela.
      const y = rec.yTop + 1;
      const sopraLaCandela = !footprintCellHitRects.some(c => x >= c.xxLeft && x <= c.xxRight && y >= c.yTop && y <= c.yBot);
      const tap = () => {
        const opt = {pointerId: 7, pointerType: 'mouse', button: 0, buttons: 1,
          clientX: rc.left + x, clientY: rc.top + y, bubbles: true, cancelable: true};
        chartEl.dispatchEvent(new PointerEvent('pointerdown', opt));
        chartEl.dispatchEvent(new PointerEvent('pointerup', opt));
      };
      const seq = [];
      tap(); seq.push(footprintStyleNow());
      tap(); seq.push(footprintStyleNow());
      tap(); seq.push(footprintStyleNow());
      return {n: rects.length, sopraLaCandela, seq};
    });
    assert.ok(r.n > 0, 'con footprint acceso devono esserci candele toccabili');
    assert.equal(r.sopraLaCandela, true, 'il punto di tocco del test deve stare SOPRA la candela');
    assert.deepEqual(r.seq, ['delta', 'volume', 'bidask'], 'ogni tocco sopra la candela cicla lo stile');
    assert.deepEqual(senzaRumorePointer(errori), []);
  } finally { await browser.close(); }
});

test('un tocco lontano dal grafico NON cambia lo stile (la fascia non copre tutto)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA_BTC);
    const r = await pagina.evaluate(() => {
      const cb = document.getElementById('footprintEnabled');
      cb.checked = true;
      footprintEnabled = true;
      document.getElementById('footprintStyle').value = 'bidask';
      draw();
      const rc = chartEl.getBoundingClientRect();
      const opt = {pointerId: 9, pointerType: 'mouse', button: 0, buttons: 1,
        clientX: rc.left + 2, clientY: rc.top + 2, bubbles: true, cancelable: true};
      chartEl.dispatchEvent(new PointerEvent('pointerdown', opt));
      chartEl.dispatchEvent(new PointerEvent('pointerup', opt));
      return {stile: footprintStyleNow()};
    });
    assert.equal(r.stile, 'bidask', 'fuori da ogni candela lo stile resta invariato');
    assert.deepEqual(senzaRumorePointer(errori), []);
  } finally { await browser.close(); }
});

// ====================== REGOLA FISSA: TUTTE LE CANDELE, SEMPRE ======================
// RICHIESTO di nuovo dal proprietario, perche' la prima versione non bastava: «il cambio di stile
// del footprint deve essere modificabile al clic su TUTTE le candele, anche quelle passate, non
// solo quella del presente... deve funzionare in qualsiasi timeframe e in qualsiasi momento per
// tutti gli asset. Rendilo definitivo».
//
// Il meccanismo funzionava gia' su ogni candela: quello che mancava era il BERSAGLIO. La fascia
// sensibile era larga quanto il CORPO della candela (62% della colonna, con un tetto di 12 px) e
// alta quanto la candela piu' 18 px sopra: misurata nel banco di prova, 9 px per 45. Un bersaglio
// cosi' si prende solo per fortuna, col dito su un tablet mai, e fra una candela e l'altra restava
// il 38% di colonna morta.
//
// Questi test sono il guard-rail che lo tiene fermo: provano OGNI candela a schermo, al centro e
// sui due bordi della colonna, e con zoom diversi. Stringere di nuovo la fascia li fa diventare
// rossi.
const PREPARA_ORO = (quante) => {
  const t0 = Date.now() - quante * 60000; const R = []; let p = 4000;
  for (let i = 0; i < quante; i++) {
    const o = p, c = p + (i < quante / 2 ? -1.2 : 1.4);
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: o, high: Math.max(o, c) + 0.6,
            low: Math.min(o, c) - 0.6, close: c, volume: 10});
    p = c;
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'XAUUSD'; if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'XAUUSD';
  liveModeActive = true; mt5Connected = false; positions = []; trades = []; active = null;
  const cb = document.getElementById('footprintEnabled'); cb.checked = true; footprintEnabled = true;
  document.getElementById('footprintStyle').value = 'bidask';
  draw();
};

const TAP = (x, y) => {
  const rc = chartEl.getBoundingClientRect();
  const opt = {pointerId: 7, pointerType: 'mouse', button: 0, buttons: 1,
    clientX: rc.left + x, clientY: rc.top + y, bubbles: true, cancelable: true};
  chartEl.dispatchEvent(new PointerEvent('pointerdown', opt));
  chartEl.dispatchEvent(new PointerEvent('pointerup', opt));
};

test('OGNI candela a schermo risponde al clic, dalla prima all\'ultima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((args) => {
      eval('(' + args.prep + ')')(140);
      const T = eval('(' + args.tap + ')');
      const rects = footprintStyleHitRects.slice();
      const sorde = [];
      rects.forEach((rec, i) => {
        const prima = footprintStyleNow();
        T((rec.xxLeft + rec.xxRight) / 2, (rec.yTop + rec.yBot) / 2);
        if (footprintStyleNow() === prima) sorde.push(i);
      });
      return {quante: rects.length, sorde};
    }, {prep: PREPARA_ORO.toString(), tap: TAP.toString()});
    assert.ok(r.quante > 20, 'servono abbastanza candele per avere senso: ' + r.quante);
    assert.deepEqual(r.sorde, [], 'queste candele non hanno risposto al clic: ' + JSON.stringify(r.sorde));
    assert.deepEqual(senzaRumorePointer(errori), []);
  } finally { await browser.close(); }
});

test('nessun vuoto fra una candela e l\'altra: contano anche i bordi della colonna', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r2 = await pagina.evaluate((args) => {
      eval('(' + args.prep + ')')(140);
      const T = eval('(' + args.tap + ')');
      const rects = footprintStyleHitRects.slice();
      // Le colonne devono TOCCARSI: fra la fine di una e l'inizio della successiva niente vuoto.
      let buchi = 0, maxBuco = 0;
      for (let i = 1; i < rects.length; i++) {
        const buco = rects[i].xxLeft - rects[i - 1].xxRight;
        if (buco > 0.5) { buchi++; maxBuco = Math.max(maxBuco, buco); }
      }
      // E i due bordi di una colonna devono rispondere come il centro.
      const rec = rects[Math.floor(rects.length / 2)];
      const yM = (rec.yTop + rec.yBot) / 2;
      const prima = footprintStyleNow();
      T(rec.xxLeft + 1, yM); const dopoSin = footprintStyleNow();
      T(rec.xxRight - 1, yM); const dopoDes = footprintStyleNow();
      // La colonna di una candela: e' il bersaglio che la fascia deve coprire tutto.
      const colonna = (chartEl.clientWidth - 18 - chartPadR(chartEl.clientWidth)) / getViewWindow().n;
      return {buchi, maxBuco, larghezza: rec.xxRight - rec.xxLeft, altezza: rec.yBot - rec.yTop,
              colonna, prima, dopoSin, dopoDes};
    }, {prep: PREPARA_ORO.toString(), tap: TAP.toString()});
    assert.equal(r2.buchi, 0, 'fra le colonne non devono restare zone morte (il buco piu\' largo: ' + r2.maxBuco + ' px)');
    assert.notEqual(r2.dopoSin, r2.prima, 'il bordo sinistro della colonna deve rispondere');
    assert.notEqual(r2.dopoDes, r2.dopoSin, 'e anche il bordo destro');
    assert.ok(r2.larghezza >= r2.colonna * 0.98,
      'la fascia deve coprire TUTTA la colonna della candela: ' + r2.larghezza.toFixed(1)
      + ' px su ' + r2.colonna.toFixed(1));
    assert.ok(r2.altezza >= 44, 'la fascia deve restare comoda anche in altezza: ' + r2.altezza + ' px');
    assert.deepEqual(senzaRumorePointer(errori), []);
  } finally { await browser.close(); }
});

test('vale con pochi candele larghe e con tante candele strette (zoom e timeframe diversi)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((args) => {
      const P = eval('(' + args.prep + ')'), T = eval('(' + args.tap + ')');
      const prova = (quante) => {
        P(quante);
        const rects = footprintStyleHitRects.slice();
        let sorde = 0;
        rects.forEach(rec => {
          const prima = footprintStyleNow();
          T((rec.xxLeft + rec.xxRight) / 2, (rec.yTop + rec.yBot) / 2);
          if (footprintStyleNow() === prima) sorde++;
        });
        return {quante: rects.length, sorde, larghezza: rects.length ? rects[0].xxRight - rects[0].xxLeft : 0};
      };
      return {poche: prova(30), tante: prova(400)};
    }, {prep: PREPARA_ORO.toString(), tap: TAP.toString()});
    assert.equal(r.poche.sorde, 0, 'con poche candele larghe devono rispondere tutte');
    assert.equal(r.tante.sorde, 0, 'con tante candele strette devono rispondere tutte');
    assert.deepEqual(senzaRumorePointer(errori), []);
  } finally { await browser.close(); }
});
