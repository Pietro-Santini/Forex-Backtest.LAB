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
