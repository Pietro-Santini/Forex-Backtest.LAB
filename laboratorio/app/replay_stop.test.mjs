// REPLAY: FERMANDO L'AVANZAMENTO A META CANDELA SI RESTA A META CANDELA.
//
// Richiesto dal proprietario: timeframe 15 minuti, mancano 3 minuti alla chiusura, si preme
// stop, deve restare li, non ricominciare dal minuto 15.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = () => {
  const t0 = Date.now() - 400 * 60000;
  const R = [];
  for (let i = 0; i < 400; i++) R.push({date: new Date(t0 + i * 60000).toISOString(),
    open: 100 + (i % 7) * 0.01, high: 100.4, low: 99.6, close: 100.1 + (i % 5) * 0.01, volume: 4});
  rows = R; baseRows = R; currentTF = 1;
  idx = 300; viewEnd = 320; masterTime = t0 + 300 * 60000;
  currentAssetKey = 'EURUSD'; if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; liveReplayActive = false; mt5Connected = false;
  positions = []; trades = []; drawings = []; replayForm = null;
  followLatest = true; visibleCount = 120; autoFitWidth = false;
  if ($('speed')) $('speed').value = '5';
  draw();
};

test('allo STOP la formazione resta e PLAY riprende dal punto esatto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(({PREPARA_SRC}) => {
      eval('(' + PREPARA_SRC + ')()');
      // Formazione a meta candela.
      replayForm = replayAvviaFormazione(idx + 1);
      replayForm.sub = 5;
      // PLAY: avvia il timer (la formazione c'e' gia', quindi resta).
      startPlayInterval();
      // STOP: clicca il tasto Play (il timer e' acceso, quindi fa STOP).
      if ($('play')) $('play').click();
      const subDopoStop = replayForm ? replayForm.sub : null;
      const formazioneDopoStop = !!replayForm;
      // PLAY di nuovo: deve riprendere dal punto esatto.
      if ($('play')) $('play').click();
      const subDopoPlay = replayForm ? replayForm.sub : null;
      if (timer) { clearInterval(timer); timer = null; }
      return {subDopoStop, formazioneDopoStop, subDopoPlay};
    }, {PREPARA_SRC: PREPARA.toString()});
    assert.equal(r.formazioneDopoStop, true, 'allo STOP la formazione resta (non viene azzerata)');
    assert.equal(r.subDopoStop, 5, 'allo STOP il progresso resta (sub=5)');
    assert.equal(r.subDopoPlay, 5, 'PLAY riprende dal punto esatto (sub=5), non da zero');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
