// CHI SI PRENDE UN CLIC SUL GRAFICO, E CHI NO.
//
// Tre segnalazioni diverse del proprietario, una causa sola: cosa assorbe un clic.
//
//  1. «Non tocco assolutamente nulla sul grafico e a un certo punto mi seleziona in automatico
//     una posizione.»
//  2. «Se vado a toccare fuori, dove non c'e' ne' una candela ne' una linea di target, stop loss
//     o entry, mi deve deselezionare... per toccare fuori intendo ANCHE sopra un indicatore:
//     l'indicatore non e' un oggetto che si puo' premere, e' solo di visualizzazione.»
//     E: «sul PC devo andare a premere per forza tutta la parte destra, fuori da qualunque area».
//  3. «Il cambio stile del footprint deve funzionare in maniera perfetta e precisa, su tutte le
//     candele, a qualsiasi timeframe, col mouse e col dito. Non puo' avere bug.»
//
// LE CAUSE, trovate leggendo:
//  - la CASELLA Target/Stop (zoneBoxHitRects) e' un rettangolo che va dall'entrata fino ad adesso
//    e puo' coprire mezzo grafico. Bloccava sia la deselezione sia il cambio stile: da li' nasce
//    «devo premere tutta la parte destra» e «a volte non cambia»;
//  - gli INDICATORI (vpIndHitRects) bloccavano la deselezione: il caso nominato;
//  - l'ENFASI della posizione (linea spessa, grassetto) era legata ad `active`, che l'app
//    riassegna da sola in cinque punti - fra cui l'apertura e la chiusura automatica di una
//    posizione. Da fuori: «si e' selezionata da sola»;
//  - c'erano DUE meccanismi per il cambio stile, e uno era morto: footprintCellClickCandidate
//    veniva calcolato a ogni pointerdown e non lo leggeva nessuno.
//
// LA REGOLA, scritta una volta: un bersaglio SOTTILE E MIRATO vince un clic (una linea TP/SL, la
// freccia di una posizione, un disegno, una candela); un RIEMPIMENTO LARGO no.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

const PREPARA = () => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++)
    R.push({date: new Date(t0 + i * 60000).toISOString(),
            open: 100, high: 100.5, low: 99.5, close: 100.2, volume: 8});
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD';
  if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; mt5Connected = false;
  trades = []; pendingOrders = []; replayForm = null;
  positions = [{id: 'P1', asset: 'EURUSD', side: 'BUY', entry: 100, sl: 99, rrSl: 99, tp: 101,
                lots: 0.1, marginUsed: 10, start: 10, startTime: t0 + 10 * 60000}];
  positionsVisible = true;
  active = positions[0];
  posSelezionata = null;
  draw(); update();
};

test('una posizione assegnata DA SOLA non viene disegnata come selezionata', async () => {
  // La prova sta nel disegno: si guarda lo spessore della linea con cui la posizione viene
  // tracciata. `active` c'e' (serve alle caselle SL/TP), ma nessuno l'ha scelta.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const ctx = document.getElementById('chart').getContext('2d');
      const spessori = [];
      const vero = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(ctx), 'lineWidth') || null;
      // Si registra ogni spessore usato mentre si disegna.
      let w = 1;
      Object.defineProperty(ctx, 'lineWidth', {
        configurable: true,
        get(){ return w; },
        set(v){ w = v; spessori.push(v); }
      });
      try {
        posSelezionata = null; active = positions[0];
        spessori.length = 0; draw();
        const automatica = spessori.includes(2.4);
        posSelezionata = positions[0];
        spessori.length = 0; draw();
        const scelta = spessori.includes(2.4);
        return {automatica, scelta};
      } finally {
        delete ctx.lineWidth;
        if (vero) Object.defineProperty(Object.getPrototypeOf(ctx), 'lineWidth', vero);
      }
    }, PREPARA.toString());
    assert.equal(r.automatica, false,
      'con `active` assegnata da sola la posizione NON deve avere la linea in evidenza');
    assert.equal(r.scelta, true,
      'ma scegliendola davvero l\'evidenza ci deve essere (prova di controllo: senza, questo '
      + 'test passerebbe anche se l\'evidenza non esistesse piu\' affatto)');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la casella Target/Stop e gli indicatori non trattengono piu\' la selezione', () => {
  // Erano le due guardie che impedivano di deselezionare. Si controlla il codice perche' il
  // percorso vero richiede un pointerdown+pointerup con geometria reale: qui conta che quelle due
  // condizioni non siano piu' nell'elenco di chi blocca.
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const i = src.indexOf('function fblClickSuVuoto');
  assert.ok(i > 0, 'la funzione della deselezione deve esistere');
  const f = src.slice(i, i + 3000);
  assert.ok(!/if\(!hitDraw&&!hitZone&&!hitFp\)/.test(f),
    'la casella Target/Stop non deve piu\' bloccare la deselezione');
  assert.ok(!/&&!hitVp&&/.test(f),
    'un indicatore non deve bloccare la deselezione: si guarda, non si preme');
  // Quello che DEVE ancora trattenere, parola per parola dalla richiesta.
  assert.match(f, /hitFp/, 'una candela trattiene la selezione');
  assert.match(f, /hitClosed/, 'la riga apertura-chiusura trattiene la selezione');
  assert.match(f, /hitLevel/, 'le righe TP/SL/entry trattengono la selezione');
});

test('il cambio stile del footprint non muore piu\' dentro la casella Target/Stop', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  // Si parte da fpTocco, non dal primo pointerdown del file: di gestori pointerdown sul grafico
  // ce n'e' piu' d'uno (il gesto a due dita ha il suo), e prendere il primo che capita
  // misurerebbe un'altra cosa.
  const i = src.indexOf('let fpTocco=null;');
  assert.ok(i > 0, 'il gestore del tocco sulle candele deve esistere');
  const f = src.slice(i, i + 3500);
  assert.match(f, /const _suCandela=footprintCellHitRects\.some/,
    'si deve sapere se il tocco e\' sul corpo della candela');
  assert.match(f, /if\(!_suCandela&&zoneBoxHitRects\.some/,
    'la casella Target/Stop cede alla candela: altrimenti, con una posizione aperta, il cambio '
    + 'stile muore in silenzio su mezzo grafico');
});

test('la tolleranza del tocco e\' quella di un dito, non quella di un mouse', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  assert.match(src, /\(t\.dito\?16:4\)/,
    'col dito servono piu\' pixel di scivolamento: a 10 px il cambio stile saltava in silenzio');
  assert.match(src, /t\.t>\(t\.dito\?1200:700\)/,
    'e piu\' tempo: un tocco col dito e\' piu\' lento di un clic, e sul grafico non c\'e\' '
    + 'nessuna azione legata alla pressione lunga');
});

test('un solo meccanismo per il cambio stile, non due', () => {
  // Due strade per lo stesso gesto, di cui una morta, sono il modo piu' sicuro di far sembrare
  // casuale un comportamento: chi legge non sa quale delle due stia guardando.
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  assert.ok(!/footprintCellClickCandidate=/.test(src),
    'la variabile del secondo meccanismo non deve piu\' essere assegnata da nessuna parte');
  assert.match(src, /function footprintCicloStile/,
    'resta una sola strada: fpTocco -> footprintCicloStile');
});
