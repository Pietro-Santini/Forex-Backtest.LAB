// A MERCATO CHIUSO L'ASSE NON SI ALLUNGA OLTRE L'ULTIMA CANDELA.
//
// SEGNALATO dal proprietario (7 novembre 2026), con lo screenshot: XAU/USD 1m, asse da
// "nov 22:29" fino a "07 nov '26 23:59" - di SABATO, col mercato chiuso dal venerdi' sera.
// «Se il mercato e' chiuso, punto: non sposto il grafico, non sposto i disegni, non sposto
// gli indicatori, non sposto le candele, non sposto l'orario, non sposto nulla.»
//
// CAUSA MISURATA: lo spazio vuoto dopo l'ultima candela (liveMargin) si metteva guardando
// UNA sola autorita' (fblMercatoFermoOra), che risponde "non fermo" quando MT5 dice che il
// mercato e' aperto - e la sua risposta puo' essere vecchia di dieci minuti. Basta quel
// minuto per far ripartire l'asse oltre la chiusura.
//
// CURA: il margine esiste solo a mercato aperto, e la chiusura si decide su DUE autorita':
// il calendario dello strumento E la fase della sessione (liveSessionPhaseNow, che non
// dipende da quella cache). Se una delle due dice chiuso, l'asse si ferma all'ultima candela.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Oggi e' sabato 7 novembre 2026: il mercato ha chiuso venerdi' 6 alle 22 (ora di Roma).
const VEN = Date.UTC(2026, 10, 6, 20, 0, 0);

const PREPARA = () => {
  const VEN = Date.UTC(2026,10,6,20,0,0);
  rows = []; baseRows = []; let p = 4100;
  for (let i = 0; i < 120; i++) {                       // venerdi' sera, mercato APERTO
    const t = VEN + i * 60000, o = p, c = p + Math.sin(i / 7) * 2;
    rows.push({date: new Date(t).toISOString(), open: o, high: Math.max(o, c) + 1,
               low: Math.min(o, c) - 1, close: c, volume: 10});
    p = c;
  }
  baseRows = rows.slice(); idx = rows.length - 1; viewEnd = rows.length;
  currentAssetKey = 'XAUUSD'; csvLibrary = [{id: 'xau', rows}];
  liveModeActive = true; liveReplayActive = false; mt5Connected = false;
};

// Il caso del proprietatore: MT5 nella sua cache dice "aperto" (risposta vecchia), ma la
// sessione e' chiusa perche' e' sabato. L'asse NON deve allungarsi.
test('a mercato chiuso l\'asse non si allunga, anche se MT5 nella cache dice aperto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      (${PREPARA})();
      // La prova DEVE girare in un sabato: "di sabato la sessione e' chiusa" e' la sua tesi, e
      // farla girare nel giorno in cui capita renderebbe la prova un'opinione (misurato: lunedi'
      // notte la sessione e' 'mt5' e la prova diventava rossa senza che il codice fosse cambiato).
      const _D = Date.now;
      const SAB = Date.UTC(2026,10,7,22,30,0);               // sabato 23:30 di Roma: chiuso
      Date.now = () => SAB;
      // La cache di MT5 dice "aperto" (ed e' il caso che faceva ripartire l'asse).
      fblMercatoMt5Cache['XAUUSD'] = {aperto: true, letto: SAB};
      followLatest = true;
      viewEnd = rows.length;
      const w = getViewWindow();
      const fase = liveSessionPhaseNow();
      const fermo = fblMercatoFermoOra('XAUUSD', SAB);
      Date.now = _D;
      return {end: w.end, n: w.n, candele: rows.length, fase: fase, fermo: fermo};
    })()`);
    assert.equal(r.fase, 'closed', 'di sabato la sessione e\' chiusa: ' + JSON.stringify(r));
    assert.equal(r.end, r.candele,
      'l\'asse deve fermarsi all\'ultima candela, non allungarsi oltre: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('a mercato APERTO lo spazio futuro resta (la cura non spegne il motore)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      (${PREPARA})();
      // Venerdi' pomeriggio, sessione aperta, niente calendario che dica chiuso.
      const _D = Date.now;
      Date.now = () => Date.UTC(2026,10,6,20,1,0);                  // dentro la fascia aperta
      fblMercatoMt5Cache['XAUUSD'] = {aperto: true, letto: Date.UTC(2026,10,6,20,1,0)};
      followLatest = true;
      viewEnd = rows.length;
      const w = getViewWindow();
      Date.now = _D;
      return {end: w.end, n: w.n, candele: rows.length};
    })()`);
    assert.ok(r.end > r.candele,
      'a mercato aperto lo spazio futuro deve restare: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
