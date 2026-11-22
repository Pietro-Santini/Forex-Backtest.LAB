// VALID BOS PULLBACK: IL TP DELLA SECONDA ENTRA' NASCE SOLO ALLA CONFERMA.
//
// CHIESTO DAL PROPRIETARIO (22 novembre 2026): «la seconda entrata (al pullback) non deve avere
// TP ma solo lo stop loss identico alla prima; il TP va impostato solo quando la rottura del
// punto di liquidità è confermata, calcolando il target dall'entrata del pullback al punto di
// rottura, con R:R 1:2 o 1:3 (modificabile nelle impostazioni)».
//
// Quindi, nella modalità «insieme» (le due entrate nascono tutte e due al pullback):
//   - alla nascita la seconda ha SOLO lo stop, identico a quello della prima;
//   - il suo TP compare alla barra che CHIUDE oltre il punto di rottura (la conferma), ed è
//     (entrata del pullback -> punto di rottura) × rrTarget2, dove rrTarget2 vale 2 o 3.
//
// MISURATO PRIMA DELLA CURA (candele di bos_due_entrate.test.mjs, entrata 101,05, stop 100,94,
// punto di rottura 101,50, rrTarget2 = 2): la seconda nasceva già con TP 101,27 — cioè il rischio
// (0,11) × 2, non la distanza fino alla rottura — e nella scena in cui la rottura NON arriva un
// massimo di 101,35 la chiudeva a target alla barra 9, con la rottura ancora da confermare. Con
// la cura il suo TP è 101,95 e nasce alla conferma; senza conferma resta aperta con il solo stop.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Le stesse candele di bos_due_entrate.test.mjs: ogni barra ha un compito preciso.
const BOS_RIALZISTA = [
  [100.00, 100.50,  99.50, 100.00],  // 0
  [100.00, 100.60,  99.60, 100.20],  // 1
  [100.20, 101.00, 100.00, 100.80],  // 2  il massimo 101,00: diventa il RIFERIMENTO
  [100.80, 100.90, 100.30, 100.50],  // 3
  [100.40, 100.80, 100.20, 100.40],  // 4  due barre a destra: il pivot e' confermato
  [100.40, 101.50, 100.30, 101.30],  // 5  ROTTURA INIZIALE, estremo 101,50
  [101.30, 101.40, 101.10, 101.20],  // 6
  [101.20, 101.45, 101.05, 101.10],  // 7  ESTREMO CONFERMATO
  [101.10, 101.20, 100.95, 101.05],  // 8  PULLBACK VALIDO -> nascono le due entrate
  [101.05, 101.80, 101.00, 101.70]   // 9  ROTTURA CONFERMATA -> il TP della seconda
];

// La scena SENZA conferma: dopo il pullback il prezzo sale ma non chiude mai oltre 101,50.
const BOS_SENZA_CONFERMA = BOS_RIALZISTA.slice(0, 9).concat([
  [101.05, 101.35, 101.00, 101.30],  // 9
  [101.30, 101.40, 101.20, 101.35],  // 10
  [101.35, 101.45, 101.25, 101.40],  // 11
  [101.40, 101.45, 101.30, 101.35]   // 12
]);

const PARAMETRI = {leftBars: 2, rightBars: 2, touchTicks: 1, minUntouchedBars: 2,
                   minExtensionTicks: 1, tickSize: 0.01, rrTarget: 2, rrTarget2: 2,
                   modoSeconda: 'insieme', stopPullback: 'candela'};

const PASSO_PASSO_SU = (spec, par) => `(() => {
  realizedBalanceNow = () => 10000;
  const campo = document.getElementById('risk');
  if (campo) campo.value = '1';
  const def = INDICATOR_DEFS['valid_bos_pullback'];
  const ind = hydrateIndicators([{id: 1, key: 'valid_bos_pullback', params: def.defaultParams()}])[0];
  Object.assign(ind.params, ${JSON.stringify(par || PARAMETRI)});
  const R = ${JSON.stringify(spec)}.map((a, i) => ({
    date: new Date(Date.UTC(2024, 0, 1, 0, i, 0)).toISOString(),
    open: a[0], high: a[1], low: a[2], close: a[3], volume: 100
  }));
  rows = R;
  const storia = [];
  for (let i = 0; i < R.length; i++) {
    idx = i;
    def.compute(R, i, ind);
    const leggi = o => ({nome: o.nome, dir: o.dir, entry: o.entry, sl: o.sl,
      tp: Number.isFinite(o.tp) ? o.tp : null, rr: o.rr, barra: o.barra,
      esito: o.esito || null, barraFine: o.barraFine,
      livelloRottura: o.livelloRotturaConfermata});
    storia.push({barra: i, ops: (ind.calc.ops || []).map(leggi), finite: (ind.calc.opsFinite || []).map(leggi)});
  }
  return {storia};
})()`;

const alBarra = (r, n) => r.storia[n].ops;
const conNome = (ops, nome) => ops.find(o => o.nome === nome) || null;

test('al pullback la seconda entrata nasce senza TP, con lo stop identico alla prima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PASSO_PASSO_SU(BOS_RIALZISTA));
    const ops = alBarra(r, 8);
    const pb = conNome(ops, 'pullback');
    const cf = conNome(ops, 'conferma');
    assert.ok(pb && cf, 'premessa: alla barra 8 nascono tutte e due le entrate: ' + JSON.stringify(ops));
    assert.equal(cf.tp, null,
      'alla nascita la seconda NON deve avere un target: trovato ' + cf.tp);
    assert.equal(cf.sl, pb.sl,
      'lo stop della seconda è identico a quello della prima: ' + cf.sl + ' contro ' + pb.sl);
    assert.equal(pb.tp, 101.50, 'la prima tiene il suo target, che è la zona della rottura');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('alla conferma il TP della seconda è la distanza fino al punto di rottura × 2', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PASSO_PASSO_SU(BOS_RIALZISTA));
    assert.ok(conNome(alBarra(r, 8), 'conferma'), 'premessa: alla barra 8 la seconda è viva');
    const cf = conNome(alBarra(r, 9), 'conferma');
    assert.ok(cf, 'alla barra 9 la seconda deve essere ancora aperta (il suo TP è lontano)');
    // entrata 101,05 / punto di rottura 101,50 -> 0,45; × 2 = 0,90 -> 101,95
    assert.ok(Math.abs(cf.tp - 101.95) < 1e-9,
      'il target deve stare a (101,50 - 101,05) × 2 dall\'entrata: atteso 101,95, trovato ' + cf.tp);
    assert.equal(cf.livelloRottura, 101.50, 'il punto di rottura usato è quello del setup');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con R:R 1:3 il target della seconda va al triplo della distanza fino alla rottura', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const par = Object.assign({}, PARAMETRI, {rrTarget2: 3});
    const r = await pagina.evaluate(PASSO_PASSO_SU(BOS_RIALZISTA, par));
    const cf = conNome(alBarra(r, 9), 'conferma');
    assert.ok(cf, 'alla barra 9 la seconda deve essere ancora aperta');
    // 0,45 × 3 = 1,35 -> 102,40
    assert.ok(Math.abs(cf.tp - 102.40) < 1e-9,
      'con 1:3 il target deve stare a 102,40: trovato ' + cf.tp);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza la conferma della rottura la seconda resta aperta col solo stop', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PASSO_PASSO_SU(BOS_SENZA_CONFERMA));
    const fine = r.storia[r.storia.length - 1];
    const cf = conNome(fine.ops, 'conferma');
    assert.ok(cf, 'la seconda deve restare aperta: senza target non può chiudersi a target');
    assert.equal(cf.tp, null, 'nessuna rottura confermata: il target non deve essere stato impostato');
    assert.equal(cf.esito, null, 'non deve risultare chiusa: esito «' + cf.esito + '»');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
