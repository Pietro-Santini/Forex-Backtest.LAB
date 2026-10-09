// PASSO 21 — il grafico della resa deve restare FERMO.
//
// RICHIESTO dal proprietario (9 ottobre 2026):
//  - scorrendo indietro nella resa, a volte la schermata si piantava e diventava bianca;
//  - il grafico si «zoomava da solo» al passaggio del mouse: deve restare fermo.
//
// Due cause distinte:
//  1. il gesto di ZOOM (pinch da trackpad = evento 'wheel' con ctrlKey, come Chrome lo consegna)
//     sopra la cronologia non era bloccato: la pagina si zoomava. Il grafico prezzi ha il suo
//     'touch-action', la cronologia no.
//  2. la larghezza con cui si disegna la resa si riprendeva a OGNI disegno: passando il mouse
//     cambiano i numeri sopra il grafico, il riquadro puo' spostarsi di qualche pixel, il canvas
//     viene riallocato (e si vede bianco) e la curva si riscala. La larghezza deve restare ferma
//     finche' la finestra non cambia davvero.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const CURVA = () => {
  const punti = [];
  for (let i = 0; i <= 100; i++) punti.push({t: 1000 + i * 60000, cap: 10000 + i * 10, usate: i, vinte: i, perse: 0, sommaR: i, ddMax: 0});
  return {punti, finale: punti[punti.length - 1].cap};
};

async function prepara(pagina) {
  await pagina.evaluate((curva) => {
    const c = eval('(' + curva + ')')();
    const box = document.getElementById('fblRendimento'); if (box) box.style.display = 'block';
    const ov = document.getElementById('fblCronoOverlay'); if (ov) ov.style.display = 'flex';
    fblRendProva(c, 10000);
  }, CURVA.toString());
  await pagina.waitForTimeout(150);
}

test('la rotellina di zoom sopra la resa non zooma la pagina', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina);
    const r = await pagina.evaluate(() => {
      const cv = document.getElementById('fblRendGrafico');
      // Ctrl+rotellina e' il modo in cui Chrome consegna il pinch da trackpad.
      const pinch = new WheelEvent('wheel', {ctrlKey: true, deltaY: -100, cancelable: true, bubbles: true});
      cv.dispatchEvent(pinch);
      // La rotellina normale deve restare libera (scorre la finestra).
      const normale = new WheelEvent('wheel', {deltaY: 100, cancelable: true, bubbles: true});
      cv.dispatchEvent(normale);
      return {pinch: pinch.defaultPrevented, normale: normale.defaultPrevented};
    });
    assert.equal(r.pinch, true, 'Ctrl+rotellina (pinch) sopra la resa non deve zoomare la pagina');
    assert.equal(r.normale, false, 'la rotellina normale deve restare libera');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('passando il mouse il grafico non si rialloca ne si riscala', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina);
    const r = await pagina.evaluate(async () => {
      const cv = document.getElementById('fblRendGrafico');
      const body = document.querySelector('#fblCronoOverlay .fbModalBody');
      const raf = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const back0 = cv.width;
      const client0 = cv.clientWidth;
      // Il riquadro si restringe, come quando sopra compare/sparisce la barra di scorrimento.
      // NON e' un ridimensionamento della finestra: il grafico deve restare com'era.
      body.style.paddingRight = '140px';
      await raf();
      const client1 = cv.clientWidth;
      // Passaggio del mouse sul grafico: e' il gesto che lo faceva saltare/zoomare.
      const b = cv.getBoundingClientRect();
      cv.dispatchEvent(new PointerEvent('pointermove', {pointerId: 1, pointerType: 'mouse', bubbles: true, cancelable: true, clientX: b.left + b.width * 0.7, clientY: b.top + b.height / 2}));
      await raf();
      const back1 = cv.width;
      body.style.paddingRight = '';
      return {back0, back1, client0, client1};
    });
    assert.ok(r.client1 < r.client0, 'la prova deve davvero restringere il riquadro');
    assert.equal(r.back1, r.back0,
      'passando il mouse il canvas non deve riallocarsi: la larghezza del disegno e la scala della curva devono restare ferme');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
