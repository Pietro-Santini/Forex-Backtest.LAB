// MAI CANDELE DI UN'ALTRA RISOLUZIONE CON L'ETICHETTA DEL TIME FRAME SCELTO (21 novembre 2026).
//
// SEGNALATO dal proprietario: «il time frame selezionato e' 1m ma mi visualizza le candele da 5m,
// mentre invece se seleziono 15 minuti me le fa vedere correttamente».
//
// Quell'indizio E' la diagnosi: e' la stessa serie da 5 minuti nei due casi. A 15 minuti si aggrega
// bene (15 e' multiplo di 5) e sembra giusta; a 1 minuto viene mostrata cosi' com'e', cioe' candele
// da 5m etichettate 1m. Succede quando la ricarica del time frame non riesce e restano le candele
// di prima. Meglio tornare alla risoluzione vera che disegnare un grafico falso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Candele da 5 minuti, con dentro un buco vero come quello di XAU/USD (76 minuti al giorno):
// il passo si misura sulla distanza PIU' FREQUENTE, non sulla media, altrimenti il buco la falsa.
const SERIE_5M = (n = 60) => {
  const R = [];
  let t = Date.UTC(2026, 10, 20, 8, 0, 0);
  for (let i = 0; i < n; i++) {
    if (i === 30) t += 76 * 60000;          // la pausa giornaliera del broker
    R.push({date: new Date(t).toISOString(), open: 1, high: 2, low: 0.5, close: 1.5, volume: 10});
    t += 5 * 60000;
  }
  return R;
};

test('il passo della serie si misura sulla distanza piu frequente, non sulla media', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((R) => {
      baseRows = R;
      return {passo: fblPassoSerieMinuti(), passoEsplicito: fblPassoSerieMinuti(R)};
    }, SERIE_5M());
    assert.equal(r.passo, 5, 'una serie da 5 minuti con un buco resta da 5 minuti: ' + JSON.stringify(r));
    assert.equal(r.passoEsplicito, 5, 'stessa risposta passando le righe: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('a 1m con una serie da 5m il grafico torna a 5m e lo dice, invece di mostrare candele false', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((R) => {
      baseRows = R; rows = R; idx = R.length - 1;
      csvLibrary = [{id: 'mt5_live_XAUUSD', rows: R, tf: 'M5'}];
      currentAssetKey = 'XAUUSD';
      const sel = document.getElementById('tf');
      currentTF = 1; if (sel) sel.value = '1';        // la ricarica a 1m non e' riuscita
      fblControllaPassoDopoCambioTf(5);
      return {tf: currentTF, select: sel ? sel.value : null,
              stato: document.getElementById('status').textContent};
    }, SERIE_5M());
    assert.equal(r.tf, 5, 'il grafico deve tornare alla risoluzione che i dati hanno davvero: ' + JSON.stringify(r));
    assert.equal(r.select, '5', 'e la casella del time frame deve dire la stessa cosa: ' + JSON.stringify(r));
    assert.match(r.stato, /non sono arrivate|grafico falso/i, 'e lo deve dire: ' + r.stato);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: con una serie davvero da 1m il time frame non si tocca', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const R = []; let t = Date.UTC(2026, 10, 20, 8, 0, 0);
      for (let i = 0; i < 60; i++) { R.push({date: new Date(t).toISOString(), open: 1, high: 2, low: 0.5, close: 1.5, volume: 10}); t += 60000; }
      baseRows = R; rows = R; idx = R.length - 1;
      currentTF = 1; const sel = document.getElementById('tf'); if (sel) sel.value = '1';
      fblControllaPassoDopoCambioTf(5);
      return {tf: currentTF, passo: fblPassoSerieMinuti()};
    });
    assert.equal(r.passo, 1, 'la serie e da 1 minuto');
    assert.equal(r.tf, 1, 'e il time frame resta 1: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
