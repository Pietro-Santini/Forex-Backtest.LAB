// IL BREAK-EVEN DOPPIO DENTRO LE IMPOSTAZIONI DELL'INDICATORE (21 novembre 2026).
//
// ORA CI SONO DUE BREAK-EVEN SEPARATI:
//   BE1 (posizione PULLBACK): parametri bePerc1 / bePips1.
//     - Scatta quando il prezzo raggiunge beLivello1 (50% target pullback).
//     - Sposta LO STOP DI ENTRAMBE LE POSIZIONI all'entrata pullback + bePips1.
//   BE2 (posizione CONFERMA): parametri bePerc2 / bePips2.
//     - Scatta SOLO DOPO che la rottura è confermata (extConfirmed=true).
//     - Sposta LO STOP DELLA SOLA POSIZIONE CONFERMA al livello della ROTTURA CONFERMATA + bePips2.
//
// LE TRE REGOLE PER OGNI BE:
//   1. finché il prezzo non arriva alla percentuale scelta, lo stop non si muove,
//      ma il livello a cui scatterà si deve già vedere sul grafico;
//   2. quando ci arriva, lo stop va all'entrata PIÙ i pip scelti (meno, per una vendita);
//   3. a percentuale zero il break-even è SPENTO.

import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const BOS_CON_SALITA = [
  [100.00, 100.50,  99.50, 100.00],  // 0
  [100.00, 100.60,  99.60, 100.20],  // 1
  [100.20, 101.00, 100.00, 100.80],  // 2  riferimento 101,00
  [100.80, 100.90, 100.30, 100.50],  // 3
  [100.40, 100.80, 100.20, 100.40],  // 4
  [100.40, 101.50, 100.30, 101.30],  // 5  rottura iniziale, estremo 101,50
  [101.30, 101.40, 101.10, 101.20],  // 6
  [101.20, 101.45, 101.05, 101.10],  // 7  estremo confermato
  [101.10, 101.20, 100.95, 101.05],  // 8  pullback valido -> prima entrata
  [101.05, 101.80, 101.00, 101.70],  // 9  rottura confermata -> seconda entrata
  [101.70, 102.00, 101.60, 101.95],  // 10 sale, ma non arriva a 102,40
  [101.95, 102.30, 101.90, 102.20],  // 11 ancora sotto la meta'
  [102.20, 102.60, 102.10, 102.50],  // 12 SUPERA 102,40: il break-even scatta
  [102.50, 102.70, 102.30, 102.45]   // 13
];

// IMPORTANTE: rrTarget2: 2 per far sì che il target conferma sia 103.10 (come prima)
// e il 50% sia 102.40, raggiunto alla barra 12.
// Questi test descrivono la seconda entrata alla rottura confermata ('dopo') e lo stop
// del pullback sulla candela di ritest: le due scelte di default sono coperte da prove a parte.
const PARAMETRI = {leftBars: 2, rightBars: 2, touchTicks: 1, minUntouchedBars: 2,
                   minExtensionTicks: 1, tickSize: 0.01, rrTarget: 2, rrTarget2: 2, maxWait: 120, modoSeconda: 'dopo', stopPullback: 'candela'};

const PROVA = (be) => `(() => {
  realizedBalanceNow = () => 10000;
  const campo = document.getElementById('risk'); if (campo) campo.value = '1';
  const def = INDICATOR_DEFS['valid_bos_pullback'];
  const ind = hydrateIndicators([{id: 1, key: 'valid_bos_pullback', params: def.defaultParams()}])[0];
  Object.assign(ind.params, ${JSON.stringify(PARAMETRI)}, ${JSON.stringify(be)});
  const R = ${JSON.stringify(BOS_CON_SALITA)}.map((a, i) => ({
    date: new Date(Date.UTC(2024, 0, 1, 0, i, 0)).toISOString(),
    open: a[0], high: a[1], low: a[2], close: a[3], volume: 100
  }));
  rows = R;
  const storia = [];
  for (let i = 0; i < R.length; i++) {
    idx = i;
    def.compute(R, i, ind);
    const leggi = o => ({nome: o.nome, entry: o.entry, sl: o.sl, tp: o.tp, barra: o.barra,
                         esito: o.esito || null, beLivello2: o.beLivello2, be2Fatto: !!o.be2Fatto,
                         slIniziale: o.slIniziale});
    storia.push({barra: i,
      ops: (ind.calc.ops || []).map(leggi),
      finite: (ind.calc.opsFinite || []).map(leggi)});
  }
  return {storia, passo: (typeof bosPassoBreakEven === 'function') ? bosPassoBreakEven(ind.params) : null};
})()`;

const conferma = (r, barra) => (r.storia[barra].ops.concat(r.storia[barra].finite))
  .find(o => o.nome === 'conferma') || null;

test('finche il prezzo non arriva alla percentuale, lo stop non si muove - ma il livello si vede (BE2 conferma)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // BE2 al 50% del target conferma, 10 pip
    const r = await pagina.evaluate(PROVA({bePerc2: 50, bePips2: 10}));

    const alla10 = conferma(r, 10);
    assert.ok(alla10, 'premessa: alla barra 10 la seconda entrata deve esserci');
    assert.equal(alla10.sl, 101.00, 'lo stop non si deve muovere prima della percentuale scelta');
    assert.equal(alla10.be2Fatto, false, 'il break-even 2 non è ancora scattato');

    // Il livello a cui scatterà si deve già conoscere: meta' strada fra 101,70 e 103,10.
    assert.ok(Number.isFinite(alla10.beLivello2),
      'il livello del break-even 2 deve essere noto PRIMA che scatti, per poterlo disegnare');
    assert.ok(Math.abs(alla10.beLivello2 - 102.40) < 1e-6,
      'il 50% della strada verso il target conferma e 102,40: trovato ' + alla10.beLivello2);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('quando il prezzo ci arriva, lo stop va alla rottura confermata piu i pip scelti (BE2)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PROVA({bePerc2: 50, bePips2: 10}));
    assert.ok(Number.isFinite(r.passo) && r.passo > 0,
      'il banco deve sapere quanto vale un pip per questo strumento: ' + r.passo);

    const alla12 = conferma(r, 12);
    assert.ok(alla12, 'alla barra 12 la seconda entrata deve esserci ancora');
    assert.equal(alla12.be2Fatto, true, 'alla barra 12 il prezzo ha superato 102,40: il break-even 2 deve scattare');

    // BE2 = livello della ROTTURA CONFERMATA (101,50) + pip scelti, come da regola del proprietario.
    const atteso = Number((101.50 + 10 * r.passo).toFixed(6));
    assert.ok(Math.abs(alla12.sl - atteso) < 1e-6,
      'lo stop deve andare a rottura confermata 101,50 + 10 pip (' + atteso + '): trovato ' + alla12.sl);
    assert.ok(alla12.sl > alla12.slIniziale, 'lo stop si alza: il rischio della seconda entrata si riduce');
    assert.ok(Math.abs(alla12.slIniziale - 101.00) < 1e-9,
      'lo stop di partenza resta ricordato, per sapere quanto si e guadagnato in sicurezza');

    // E non torna piu' indietro.
    const alla13 = conferma(r, 13);
    assert.ok(Math.abs(alla13.sl - atteso) < 1e-6, 'lo stop a pareggio non torna indietro');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('a percentuale zero il break-even 2 e spento: non succede niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PROVA({bePerc2: 0, bePips2: 10}));
    const alla13 = conferma(r, 13);
    assert.ok(alla13, 'premessa: la seconda entrata deve esserci');
    assert.equal(alla13.sl, 101.00, 'con il break-even spento lo stop non si muove');
    assert.equal(alla13.be2Fatto, false, 'e non deve risultare scattato');
    assert.equal(alla13.beLivello2, null, 'e non c e nessun livello da disegnare');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il livello del break-even 2 si disegna sul grafico, e si legge una volta sola', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      realizedBalanceNow = () => 10000;
      const campo = document.getElementById('risk'); if (campo) campo.value = '1';
      const def = INDICATOR_DEFS['valid_bos_pullback'];
      const ind = hydrateIndicators([{id: 1, key: 'valid_bos_pullback', params: def.defaultParams()}])[0];
      Object.assign(ind.params, ${JSON.stringify(PARAMETRI)}, {bePerc2: 50, bePips2: 10});
      const R = ${JSON.stringify(BOS_CON_SALITA)}.map((a, i) => ({
        date: new Date(Date.UTC(2024, 0, 1, 0, i, 0)).toISOString(),
        open: a[0], high: a[1], low: a[2], close: a[3], volume: 100
      }));
      rows = R;
      // Ci si ferma alla barra 11: il break-even 2 NON e ancora scattato, e il suo livello
      // dev'essere gia' disegnato - e' il senso della richiesta.
      for (let i = 0; i <= 11; i++) { idx = i; def.compute(R, i, ind); }
      const segmenti = [], scritte = [];
      let yCorrente = null;
      const ctx = {canvas: {width: 1300, height: 700},
        save(){}, restore(){}, beginPath(){ yCorrente = null; },
        moveTo(x, y){ yCorrente = y; }, lineTo(x, y){ if (yCorrente === y) segmenti.push(y); },
        stroke(){}, setLineDash(){}, strokeRect(){}, fillRect(){},
        fillText(t){ scritte.push(String(t)); }, measureText(t){ return {width: String(t).length * 6}; },
        set font(v){}, set textAlign(v){}, set textBaseline(v){}, set fillStyle(v){},
        set strokeStyle(v){}, set lineWidth(v){}, set globalAlpha(v){}};
      const y = v => 700 - (v - 100) * 100;
      def.render(ctx, ind, R, 0, 11, j => j * 10, y);
      return {segmenti, scritte, yBe: y(102.40)};
    })()`);

    assert.ok(r.segmenti.some(s => Math.abs(s - r.yBe) < 0.6),
      'la linea del livello di break-even 2 non e disegnata');
    const quante = r.scritte.filter(t => /break|^BE2\b|pareggio 2/i.test(t)).length;
    assert.ok(quante >= 1, 'sul grafico non si legge che quella linea e il break-even 2');
    assert.ok(quante <= 2, 'la scritta del break-even 2 si ripete troppe volte: ' + quante);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});