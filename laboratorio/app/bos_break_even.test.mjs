// IL BREAK-EVEN DENTRO LE IMPOSTAZIONI DELL'INDICATORE.
//
// CHIESTO DAL PROPRIETARIO: «il break even dentro le impostazioni dell'indicatore: a che
// percentuale del target scatta il pareggio, e di quanti pip spostare lo stop dall'ingresso
// (10, 20, 30...), come gia' fa il pulsante BE della strategia. E la linea del BE va disegnata,
// cosi' si vede a che livello scattera' PRIMA che scatti».
//
// LE TRE REGOLE DI QUESTO BANCO:
//   1. finche' il prezzo non arriva alla percentuale scelta, lo stop non si muove di un tick -
//      e il livello a cui scattera' si deve gia' vedere sul grafico;
//   2. quando ci arriva, lo stop va all'entrata PIU' i pip scelti (meno, per una vendita): non
//      sull'entrata nuda, che con commissioni e spread e' una perdita (e' la stessa lezione del
//      pulsante BE delle posizioni vere, mt5PrezzoPareggio);
//   3. a percentuale zero il break-even e' SPENTO e non succede niente: chi non lo vuole non se
//      lo trova addosso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// La costruzione di sempre (vedi bos_due_entrate), piu' una salita che arriva a meta' strada
// verso il target della SECONDA entrata senza toccarlo:
//   entrata 101,70 · stop 101,00 · target 103,10  ->  meta' strada = 102,40
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

const PARAMETRI = {leftBars: 2, rightBars: 2, touchTicks: 1, minUntouchedBars: 2,
                   minExtensionTicks: 1, tickSize: 0.01, rrTarget: 2, maxWait: 120};

// `be` sono i due numeri nuovi: percentuale verso il target e pip oltre l'entrata.
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
                         esito: o.esito || null, beLivello: o.beLivello, beFatto: !!o.beFatto,
                         slIniziale: o.slIniziale});
    storia.push({barra: i,
      ops: (ind.calc.ops || []).map(leggi),
      finite: (ind.calc.opsFinite || []).map(leggi)});
  }
  return {storia, passo: (typeof bosPassoBreakEven === 'function') ? bosPassoBreakEven(ind.params) : null};
})()`;

const conferma = (r, barra) => (r.storia[barra].ops.concat(r.storia[barra].finite))
  .find(o => o.nome === 'conferma') || null;

test('finche il prezzo non arriva alla percentuale, lo stop non si muove - ma il livello si vede', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PROVA({bePerc: 50, bePips: 10}));

    const alla10 = conferma(r, 10);
    assert.ok(alla10, 'premessa: alla barra 10 la seconda entrata deve esserci');
    assert.equal(alla10.sl, 101.00, 'lo stop non si deve muovere prima della percentuale scelta');
    assert.equal(alla10.beFatto, false, 'il break-even non e ancora scattato');

    // Il livello a cui scattera' si deve gia' conoscere: meta' strada fra 101,70 e 103,10.
    assert.ok(Number.isFinite(alla10.beLivello),
      'il livello del break-even deve essere noto PRIMA che scatti, per poterlo disegnare');
    assert.ok(Math.abs(alla10.beLivello - 102.40) < 1e-6,
      'il 50% della strada verso il target e 102,40: trovato ' + alla10.beLivello);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('quando il prezzo ci arriva, lo stop va all entrata piu i pip scelti', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PROVA({bePerc: 50, bePips: 10}));
    assert.ok(Number.isFinite(r.passo) && r.passo > 0,
      'il banco deve sapere quanto vale un pip per questo strumento: ' + r.passo);

    const alla12 = conferma(r, 12);
    assert.ok(alla12, 'alla barra 12 la seconda entrata deve esserci ancora');
    assert.equal(alla12.beFatto, true, 'alla barra 12 il prezzo ha superato 102,40: il break-even deve scattare');

    const atteso = Number((101.70 + 10 * r.passo).toFixed(6));
    assert.ok(Math.abs(alla12.sl - atteso) < 1e-6,
      'lo stop deve andare a entrata + 10 pip (' + atteso + '), non sull entrata nuda: trovato ' + alla12.sl);
    assert.ok(alla12.sl > alla12.entry, 'per un acquisto lo stop a pareggio sta SOPRA l entrata');
    assert.ok(Math.abs(alla12.slIniziale - 101.00) < 1e-9,
      'lo stop di partenza resta ricordato, per sapere quanto si e guadagnato in sicurezza');

    // E non torna piu' indietro.
    const alla13 = conferma(r, 13);
    assert.ok(Math.abs(alla13.sl - atteso) < 1e-6, 'lo stop a pareggio non torna indietro');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('a percentuale zero il break-even e spento: non succede niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PROVA({bePerc: 0, bePips: 10}));
    const alla13 = conferma(r, 13);
    assert.ok(alla13, 'premessa: la seconda entrata deve esserci');
    assert.equal(alla13.sl, 101.00, 'con il break-even spento lo stop non si muove');
    assert.equal(alla13.beFatto, false, 'e non deve risultare scattato');
    assert.equal(alla13.beLivello, null, 'e non c e nessun livello da disegnare');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il livello del break-even si disegna sul grafico, e si legge una volta sola', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      realizedBalanceNow = () => 10000;
      const campo = document.getElementById('risk'); if (campo) campo.value = '1';
      const def = INDICATOR_DEFS['valid_bos_pullback'];
      const ind = hydrateIndicators([{id: 1, key: 'valid_bos_pullback', params: def.defaultParams()}])[0];
      Object.assign(ind.params, ${JSON.stringify(PARAMETRI)}, {bePerc: 50, bePips: 10});
      const R = ${JSON.stringify(BOS_CON_SALITA)}.map((a, i) => ({
        date: new Date(Date.UTC(2024, 0, 1, 0, i, 0)).toISOString(),
        open: a[0], high: a[1], low: a[2], close: a[3], volume: 100
      }));
      rows = R;
      // Ci si ferma alla barra 11: il break-even NON e ancora scattato, e il suo livello
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
      'la linea del livello di break-even non e disegnata');
    const quante = r.scritte.filter(t => /break|^BE\b|pareggio/i.test(t)).length;
    assert.ok(quante >= 1, 'sul grafico non si legge che quella linea e il break-even');
    assert.ok(quante <= 2, 'la scritta del break-even si ripete troppe volte: ' + quante);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
