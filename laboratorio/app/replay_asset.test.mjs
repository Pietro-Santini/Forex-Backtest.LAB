// REPLAY: CAMBIANDO ASSET SI ESCE AUTOMATICAMENTE DAL REPLAY.
//
// Richiesto dal proprietario: cambiando asset si esce automaticamente dal replay e si carica
// l'ultimo prezzo.
//
// LA CORREZIONE: all'inizio del gestore del cambio asset (l'evento 'change' di #market) si
// chiama esciReplayLive() se si era in replay. Senza, il replay restava attivo sul vecchio
// asset mentre il grafico mostrava il nuovo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('cambiando asset si esce dal replay', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      // Stato minimo per essere "in replay Live".
      liveModeActive = true;
      try { updateLiveModeUI(); } catch (e) {}
      const t0 = Date.now() - 10 * 60000;
      const R = [];
      for (let i = 0; i < 20; i++) R.push({date: new Date(t0 + i * 60000).toISOString(),
        open: 100, high: 101, low: 99, close: 100.5, volume: 4});
      rows = R; baseRows = R; currentTF = 1;
      idx = 5; viewEnd = 10; masterTime = t0 + 5 * 60000;
      currentAssetKey = 'EURUSD';
      if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
      liveReplayActive = true;
      liveReplaySelecting = false;
      // Un asset diverso nel selettore (lo aggiungo se manca).
      const sel = document.getElementById('market');
      if (sel && !Array.from(sel.options).some(o => o.value === 'GBPUSD')) {
        const opt = document.createElement('option');
        opt.value = 'GBPUSD'; opt.textContent = 'GBPUSD';
        sel.insertBefore(opt, sel.querySelector('option[value="capital_search"]') || null);
      }
      if (sel) sel.value = 'GBPUSD';
      // Scatena il cambio asset.
      try { if (sel) sel.dispatchEvent(new Event('change')); } catch (e) {}
      // Lascia finire i microtask (il gestore e' async).
      await new Promise(res => setTimeout(res, 50));
      return {liveReplayActive, currentAssetKey};
    });
    assert.equal(r.liveReplayActive, false, 'cambiando asset si esce dal replay');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
