// A MERCATO CHIUSO IL PREDICATO NON DEVE COSTARE MIGLIAIA DI Intl A OGNI CHIAMATA.
//
// MISURATO (7 novembre 2026, sabato): l'app del proprietario crashava «da un momento
// all'altro, e piu' andiamo avanti e piu' crasha». Nei log dei servizi Python non c'era
// niente: il crash era dalla parte della finestra.
//
// CAUSA: per dire «aperto o chiuso» statoMercato() cerca LA PROSSIMA APERTURA scorrendo
// fino a 4*24*60 = 5760 minuti, e per ognuno chiama liveSessionPhaseAt() che costruisce un
// Intl.DateTimeFormat. A mercato chiuso il ciclo non si interrompe MAI. E fblMercatoFermoOra()
// sta nel percorso caldo: getViewWindow() la chiama per il margine futuro, e getViewWindow()
// gira MOLTE volte per fotogramma. Ogni ridisegno pagava migliaia di Intl: thread principale
// saturato, «Non risponde», finestra chiusa dal sistema.
//
// CURA: la risposta dipende solo dal minuto, quindi si tiene in memoria per minuto
// (fblProssimaRiapertura). Il test conta quanti formattatori si costruiscono davvero e
// misura il tempo: il comportamento, non il testo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('a mercato chiuso e senza calendario, il predicato costa uno e non uno per minuto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      // Sabato 7 novembre 2026, 14:30 UTC: mercato chiuso (oggi per davvero).
      const ADESSO = Date.UTC(2026, 10, 7, 14, 30, 0);
      // Conto i formattatori costruiti: e' ESATTAMENTE quello che costa (uno per chiamata di
      // liveSessionPhaseAt dentro il ciclo di ricerca della riapertura).
      let quante = 0;
      const Vera = Intl.DateTimeFormat;
      function Contata() { quante++; return new Vera(...arguments); }
      Contata.prototype = Vera.prototype;
      Contata.supportedLocalesOf = Vera.supportedLocalesOf.bind(Vera);
      Intl.DateTimeFormat = Contata;
      try {
        currentAssetKey = 'XAUUSD';
        liveModeActive = true; mt5Connected = false;
        // NESSUN calendario per l'asset (Capital.com non collegato): si cade nel ramo
        // dell'orario MT5, quello con il ciclo da 5760 minuti. Il caso peggiore.
        delete orariAsset['XAUUSD'];
        const t0 = performance.now();
        // 2000 chiamate: quante ne fa il disegno in pochi secondi (getViewWindow gira molte
        // volte per fotogramma, e ognuna chiede il mercato).
        for (let i = 0; i < 2000; i++) fblMercatoFermoOra('XAUUSD', ADESSO);
        const ms = performance.now() - t0;
        return {fermo: fblMercatoFermoOra('XAUUSD', ADESSO), quante, ms};
      } finally {
        Intl.DateTimeFormat = Vera;
      }
    });
    assert.equal(r.fermo, true, 'il mercato deve risultare davvero chiuso');
    assert.ok(r.quante < 100,
      '2000 chiamate NON devono costruire 2000 calendari: ' + JSON.stringify(r));
    assert.ok(r.ms < 150,
      'e devono costare pochissimo: senza memoria erano ~2 secondi di thread principale, '
      + 'che a 60 fotogrammi al secondo saturavano l\'app: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
