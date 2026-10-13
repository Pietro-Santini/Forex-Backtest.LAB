// REPLAY AL SECONDO (richiesto esplicitamente): il moltiplicatore #speed sono SECONDI di
// mercato avanzati per ogni secondo reale (1x = tempo reale, 10x = 10 s/s, ...), non più
// "candele". Questi test bloccano la regressione del ritmo e della durata di una candela.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('replayAdvanceSteps: esattamente N secondi di mercato per ogni secondo reale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const frame = 50; // = REPLAY_FRAME_MS
      const out = {};
      for (const mult of [1, 2, 3, 4, 10, 15, 20, 30]) {
        let accumMs = 0, steps = 0;
        // Un secondo reale = 1000/frame frame.
        for (let i = 0; i < 1000 / frame; i++) {
          const a = replayAdvanceSteps(accumMs, frame, mult);
          accumMs = a.accumMs; steps += a.steps;
        }
        out[mult] = steps;
      }
      return out;
    });
    for (const [mult, steps] of Object.entries(r)) {
      assert.equal(steps, Number(mult), mult + 'x deve avanzare esattamente ' + mult + ' secondi in un secondo reale');
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una candela vale currentTF*60 secondi: definisce la durata della formazione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const out = {};
      const tfVecchio = currentTF;
      for (const tf of [1, 5, 15, 30, 60, 240, 1440]) { currentTF = tf; out[tf] = replaySecondsPerBar(); }
      currentTF = tfVecchio;
      return out;
    });
    assert.deepEqual(r, {1: 60, 5: 300, 15: 900, 30: 1800, 60: 3600, 240: 14400, 1440: 86400});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il vecchio ritmo "a candela" non esiste più (nessuna costante a passo fisso)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => ({
      subN: typeof REPLAY_SUB_N,
      baseMs: typeof REPLAY_BASE_MS,
      subSteps: typeof replaySubStepsThisFrame,
      perBar: typeof replaySecondsPerBar,
    }));
    assert.equal(r.subN, 'undefined', 'REPLAY_SUB_N non deve più esistere');
    assert.equal(r.baseMs, 'undefined', 'REPLAY_BASE_MS non deve più esistere');
    assert.equal(r.subSteps, 'undefined', 'replaySubStepsThisFrame non deve più esistere');
    assert.equal(r.perBar, 'function', 'replaySecondsPerBar deve esistere');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
