// SCORRERE IL GRAFICO DEL RENDIMENTO COL DITO.
//
// SEGNALATO dal proprietario (8 ottobre 2026, telefono e tablet): «quando premo dentro al disegno
// della linea della resa mi si blocca, mi si sposta in maniera casuale, mi si chiude ed espande, e
// alcune volte da' lo schermo bianco su quel disegno».
//
// Quattro difetti, tutti introdotti con lo scorrimento:
//  1. il canvas veniva riallocato a ogni movimento (riassegnare width/height lo cancella):
//     su un telefono lo si prende a meta' strada e si vede bianco;
//  2. il rettangolo del canvas si rimisurava a ogni movimento, ma i numeri sopra il grafico
//     cambiano mentre si scorre e spostano il grafico: il dito finiva su un punto diverso da
//     quello che stava toccando;
//  3. `touchAction:'none'` si mangiava anche lo scorrimento verticale della pagina;
//  4. si ridisegnava a ogni evento invece che a ogni immagine.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Una curva finta con 101 punti: l'indice e' facile da verificare a occhio (0 a sinistra,
// 100 a destra, 50 in mezzo).
const CURVA = () => {
  const punti = [];
  for (let i = 0; i <= 100; i++) punti.push({t: 1000 + i * 60000, cap: 10000 + i * 10, usate: i, vinte: i, perse: 0, sommaR: i, ddMax: 0});
  return {punti, finale: punti[punti.length - 1].cap, usate: 100, vinte: 100, perse: 0, sommaR: 100, ddMax: 0, resa: 10};
};

async function prepara(pagina) {
  await pagina.evaluate((curva) => {
    const c = eval('(' + curva + ')')();
    // Il riquadro del rendimento deve essere visibile, altrimenti il canvas non ha larghezza.
    const box = document.getElementById('fblRendimento'); if (box) box.style.display = 'block';
    const ov = document.getElementById('fblCronoOverlay'); if (ov) ov.style.display = 'flex';
    fblRendProva(c, 10000);
  }, CURVA.toString());
  await pagina.waitForTimeout(150);
}

test('lo scorrimento in verticale della pagina resta libero sul grafico', async () => {
  const {browser, pagina, errori} = await apriApp({larghezza: 390, altezza: 844});
  try {
    await prepara(pagina);
    const t = await pagina.evaluate(() => document.getElementById('fblRendGrafico').style.touchAction);
    // 'none' bloccherebbe anche lo scorrimento verticale: il dito sembra piantato.
    assert.equal(t, 'pan-y', 'col grafico non si deve perdere lo scorrimento verticale della pagina');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il dito segue il punto dove sta, e alzandolo si torna al totale', async () => {
  const {browser, pagina, errori} = await apriApp({larghezza: 390, altezza: 844});
  try {
    await prepara(pagina);
    const r = await pagina.evaluate(async () => {
      const cv = document.getElementById('fblRendGrafico');
      const b = cv.getBoundingClientRect();
      const pad = 10, dentro = b.width - pad * 2; // 10 = pl/pr di rendDisegnaGrafico e indiceDa (SVG); il 16 era del vecchio canvas
      const tocca = (tipo, frazione) => cv.dispatchEvent(new PointerEvent(tipo, {
        pointerId: 1, pointerType: 'touch', bubbles: true, cancelable: true,
        clientX: b.left + pad + dentro * frazione, clientY: b.top + b.height / 2
      }));
      const attesa = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      tocca('pointerdown', 0.5); await attesa();
      const meta = fblRendPunto();
      tocca('pointermove', 0.0); await attesa();
      const inizio = fblRendPunto();
      tocca('pointermove', 1.0); await attesa();
      const fine = fblRendPunto();
      tocca('pointerup', 1.0); await attesa();
      const dopo = fblRendPunto();
      return {meta, inizio, fine, dopo};
    });
    assert.ok(Math.abs(r.meta - 50) <= 2, 'a meta del grafico ci si aspetta il punto 50, non ' + r.meta);
    assert.equal(r.inizio, 0, 'tutto a sinistra e il primo punto');
    assert.equal(r.fine, 100, 'tutto a destra e l ultimo punto');
    assert.equal(r.dopo, null, 'alzando il dito si torna al totale');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il mirino non salta se i numeri sopra il grafico cambiano altezza', async () => {
  const {browser, pagina, errori} = await apriApp({larghezza: 390, altezza: 844});
  try {
    await prepara(pagina);
    // E' il difetto piu' insidioso: scorrendo cambiano i numeri sopra, che possono spostare il
    // grafico di qualche pixel. Rimisurando a ogni movimento, il dito finirebbe su un punto
    // diverso da quello che tocca. Qui il grafico viene spostato APPOSTA a meta' gesto.
    const r = await pagina.evaluate(async () => {
      const cv = document.getElementById('fblRendGrafico');
      const b = cv.getBoundingClientRect();
      const pad = 10, dentro = b.width - pad * 2; // 10 = pl/pr di rendDisegnaGrafico e indiceDa (SVG); il 16 era del vecchio canvas
      const tocca = (tipo, frazione) => cv.dispatchEvent(new PointerEvent(tipo, {
        pointerId: 1, pointerType: 'touch', bubbles: true, cancelable: true,
        clientX: b.left + pad + dentro * frazione, clientY: b.top + b.height / 2
      }));
      const attesa = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      tocca('pointerdown', 0.25); await attesa();
      const primo = fblRendPunto();
      // il riquadro dei numeri cresce: il grafico scende
      const riep = document.getElementById('fblRendRiepilogo');
      if (riep) riep.style.paddingTop = '120px';
      await attesa();
      tocca('pointermove', 0.75); await attesa();
      const secondo = fblRendPunto();
      tocca('pointerup', 0.75);
      if (riep) riep.style.paddingTop = '';
      return {primo, secondo};
    });
    assert.ok(Math.abs(r.primo - 25) <= 2, 'a un quarto ci si aspetta il punto 25, non ' + r.primo);
    assert.ok(Math.abs(r.secondo - 75) <= 2,
      'dopo che il grafico si e spostato il dito deve restare sul punto che tocca: atteso 75, trovato ' + r.secondo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ridisegnare non rialloca il canvas: e quello che lo faceva lampeggiare bianco', async () => {
  const {browser, pagina, errori} = await apriApp({larghezza: 390, altezza: 844});
  try {
    const r = await pagina.evaluate((curva) => {
      const c = eval('(' + curva + ')')();
      const box = document.getElementById('fblRendimento'); if (box) box.style.display = 'block';
      const ov = document.getElementById('fblCronoOverlay'); if (ov) ov.style.display = 'flex';
      const cv = document.getElementById('fblRendGrafico');
      // Si conta quante volte la larghezza del canvas viene RISCRITTA: ogni riscrittura
      // cancella il disegno, ed e' la causa del bianco.
      let riscritture = 0;
      const vera = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'width');
      Object.defineProperty(cv, 'width', {
        get() { return vera.get.call(this); },
        set(v) { riscritture++; vera.set.call(this, v); }
      });
      fblRendProva(c, 10000);
      const dopoIlPrimo = riscritture;
      for (let i = 0; i < 20; i++) fblCronoRendDisegna(c.punti, i);
      return {dopoIlPrimo, dopoVenti: riscritture};
    }, CURVA.toString());
    assert.equal(r.dopoVenti, r.dopoIlPrimo,
      'venti ridisegni hanno riallocato il canvas ' + (r.dopoVenti - r.dopoIlPrimo) + ' volte: ognuna e un lampo bianco');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
