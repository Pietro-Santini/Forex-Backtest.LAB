// BE2 della seconda entrata: la % verso il TP può partire dalla rottura o dall'apertura.
// Richiesta: "il be della seconda operazione quando raggiunge la percentuale di arrivo al tp
// deve partire dalla rottura e non dalla apertura della posizione stessa" (opzione bePerc2Da).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const BOS_RIALZISTA = [
  [100.00, 100.50,  99.50, 100.00],
  [100.00, 100.60,  99.60, 100.20],
  [100.20, 101.00, 100.00, 100.80],
  [100.80, 100.90, 100.30, 100.50],
  [100.40, 100.80, 100.20, 100.40],
  [100.40, 101.50, 100.30, 101.30],
  [101.30, 101.40, 101.10, 101.20],
  [101.20, 101.45, 101.05, 101.10],
  [101.10, 101.20, 100.95, 101.05],
  [101.05, 101.80, 101.00, 101.70], // conferma: nasce TP seconda
  [101.70, 101.75, 101.60, 101.72],
  [101.72, 101.76, 101.65, 101.73], // vicino a 101.725 ma sotto 101.75
  [101.73, 101.78, 101.70, 101.76],
];

const BASE = {leftBars: 2, rightBars: 2, touchTicks: 1, minUntouchedBars: 2,
              minExtensionTicks: 1, tickSize: 0.01, rrTarget: 2, rrTarget2: 2,
              modoSeconda: 'insieme', stopPullback: 'candela', bePerc2: 50, bePips2: 5};

const ESEGUI = (bePerc2Da) => `(() => {
  realizedBalanceNow = () => 10000;
  const campo = document.getElementById('risk'); if (campo) campo.value = '1';
  const def = INDICATOR_DEFS['valid_bos_pullback'];
  const ind = hydrateIndicators([{id: 1, key: 'valid_bos_pullback', params: def.defaultParams()}])[0];
  Object.assign(ind.params, ${JSON.stringify(BASE)}, {bePerc2Da: ${JSON.stringify(bePerc2Da)}});
  const R = ${JSON.stringify(BOS_RIALZISTA)}.map((a, i) => ({
    date: new Date(Date.UTC(2024, 0, 1, 0, i, 0)).toISOString(),
    open: a[0], high: a[1], low: a[2], close: a[3], volume: 100
  }));
  rows = R;
  let cf = null;
  for (let i = 0; i < R.length; i++) {
    idx = i; def.compute(R, i, ind);
    const tutte = (ind.calc.ops || []).concat(ind.calc.opsFinite || []);
    cf = tutte.find(o => o.nome === 'conferma') || cf;
  }
  return cf ? {beLivello2: cf.beLivello2, be2Fatto: cf.be2Fatto, sl: cf.sl, tp: cf.tp, entry: cf.entry, livelloRottura: cf.livelloRotturaConfermata} : null;
})()`;

test('BE2 con % calcolata dalla rottura usa rottura come base', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(ESEGUI('rottura'));
    assert.ok(r, 'deve esistere la seconda entrata');
    // entry 101.05, rottura 101.50, tp 101.95, 50% da rottura = 101.725
    assert.ok(Math.abs(r.beLivello2 - 101.725) < 1e-9, 'livello BE2 da rottura: ' + r.beLivello2);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('BE2 con % calcolata dall\'apertura mantiene il comportamento precedente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(ESEGUI('apertura'));
    assert.ok(r, 'deve esistere la seconda entrata');
    // entry 101.05, tp 101.95, 50% da apertura = 101.50
    assert.ok(Math.abs(r.beLivello2 - 101.50) < 1e-9, 'livello BE2 da apertura: ' + r.beLivello2);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
