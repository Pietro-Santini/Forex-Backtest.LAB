// IL MESSAGGIO DEL SERVIZIO DATI DIPENDE DA CHI STA GUARDANDO.
//
// SEGNALATO dal proprietario (30 ottobre 2026): dal cellulare compariva
// "avvia uvicorn mt5_feed_server:app --port 8001 sul tuo PC" - un ordine che dal telefono non si
// puo' eseguire. Chi legge Crede di aver sbagliato qualcosa, e intanto il vero problema (il
// servizio dati del computer non risponde) non e' detto da nessuno.
//
// Cosa misura questo banco, e perche' conta:
//   1. da computer il comando resta (e' li' che si avvia: toglierlo non aiuterebbe nessuno);
//   2. da telefono/tablet il comando impossibile NON compare piu', e al suo posto si dice la cosa
//      vera: il servizio dati del computer non risponde, e si avvia l'app sul computer;
//   3. PROVA DI CONTROLLO: la CADUTA su Capital.com resta identica nei due casi. Cambiano solo le
//      parole: se il test facesse passare anche il comportamento, non starebbe misurando il
//      messaggio ma un'altra cosa.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// mt5Connesso: per arrivare al caricamento da MT5 serve la modalita' Live con MT5 collegato.
// `dove`: 'pc' (Windows, si installa qui) oppure 'telefono'.
const PREPARA = (dove) => {
  const mobile = dove === 'telefono';
  mt5Connected = true;
  liveModeActive = true;
  rows = [{t: 1, o: 1, h: 2, l: 0.5, c: 1.5, v: 1}];
  idx = 0;
  // Errore di RETE: e' il caso "il servizio non risponde", non "il simbolo non esiste" (null).
  resolveMt5SymbolForAsset = async () => undefined;
  fblEMobile = () => mobile;
  fblRemoto = () => mobile;
  fblQuiSiInstallaIlServizio = () => !mobile;
  window.__cadute = 0;
  currentAssetKey = 'EURUSD';
  __loadLiveHistoryFromCapitalImpl = async () => { window.__cadute++; return []; };
};

test('da computer: il comando per avviare il servizio resta, ed e\' quello giusto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate((p) => eval('(' + p + ')')('pc'), PREPARA.toString());
    const r = await pagina.evaluate(async () => {
      await loadLiveHistoryFromMt5('EURUSD');
      return {stato: $('status').textContent, cadute: window.__cadute};
    });
    // Qui il comando e' eseguibile: chi legge e' seduto davanti al computer.
    assert.match(r.stato, /uvicorn mt5_feed_server:app --port 8001/,
      'sul computer il comando per avviare il servizio ci vuole, ed e\' questo');
    assert.match(r.stato, /non raggiungibile/);
    assert.equal(r.cadute, 1, 'il grafico deve ricadere su Capital.com');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('da telefono o tablet: NON si ordina di avviare niente, e si dice dove sta il problema', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate((p) => eval('(' + p + ')')('telefono'), PREPARA.toString());
    const r = await pagina.evaluate(async () => {
      await loadLiveHistoryFromMt5('EURUSD');
      return {stato: $('status').textContent, cadute: window.__cadute};
    });
    // IL DIFETTO SEGNALATO: dal telefono questo ordine non si puo' eseguire, e chi legge crederebbe
    // di aver sbagliato qualcosa.
    assert.doesNotMatch(r.stato, /uvicorn/,
      'dal telefono non si ordina di avviare uvicorn: non e\' una cosa che si puo\' fare da lǪ');
    assert.doesNotMatch(r.stato, /sul tuo PC/);
    // E si dice la cosa vera, che prima non era detta da nessuno.
    assert.match(r.stato, /servizio dati del computer/i, 'deve dire che non risponde il servizio dati');
    assert.match(r.stato, /avvia l'app Forex Backtest LAB sul computer/i,
      'da telefono la cosa da fare e\' avviare l\'app sul computer');
    // La rassicurazione che conta: questa caduta tocca il GRAFICO, non i soldi.
    assert.match(r.stato, /Ordini e posizioni su MT5 non sono toccati/i,
      'va detto che ordini e posizioni non sono toccati: stanno su un altro servizio');
    assert.equal(r.cadute, 1, 'la caduta su Capital.com resta: cambia solo il messaggio');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il grafico tornato su MT5 da solo quando il servizio dati ricomincia a rispondere', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate((p) => eval('(' + p + ')')('pc'), PREPARA.toString());
    const r = await pagina.evaluate(async () => {
      // 1) il servizio NON risponde: il grafico cade su Capital.com (chiamata VERA, così la
      //    caduta viene segnata davvero).
      window.__caricamenti = 0;
      await loadLiveHistoryFromMt5('EURUSD');
      const dopoCaduta = {segno: Number(mt5FeedCadutoSuCapitalAt) || 0};
      // 2) ORA si conta quante volte il grafico viene ricaricato: da qui in poi la chiamata
      //    diventa un contatore, perché quello che si misura è il RICARICO, non la caduta.
      loadLiveHistoryFromMt5 = async () => { window.__caricamenti++; };
      // 3) il servizio TORNA a rispondere.
      resolveMt5SymbolForAsset = async () => 'EURUSD';
      fblRisponde = async () => true;
      fblScegliStradaGrafico = async () => { fblGraficoVia = 'diretto'; return 'diretto'; };
      await fblGraficoRitentaSeRipreso();
      const dopoRitenta = {caricamenti: window.__caricamenti};
      // 4) chiamata ripetuto senza che niente sia cambiato: non deve ricaricare di nuovo.
      await fblGraficoRitentaSeRipreso();
      const dopoSecondo = {caricamenti: window.__caricamenti};
      return {dopoCaduta, dopoRitenta, dopoSecondo};
    });
    // La caduta resta SEGNATA: senza, il timer non potrebbe distinguere un guasto da un primo avvio.
    assert.ok(r.dopoCaduta.segno > 0, 'la caduta su Capital.com va segnata, non solo mostrata');
    // Tornato a rispondere, il grafico si RICARICA da MT5: prima restava su Capital.com fino alla
    // ricarica a mano della pagina, che e' esattamente il sintomo segnalato.
    assert.equal(r.dopoRitenta.caricamenti, 1,
      'quando il servizio dati torna a rispondere il grafico si ricarica da MT5 da solo');
    // E a riposo non ricarica di nuovo: senza questa prova un timer che ricaricasse sempre
    // sarebbe "verde" lo stesso, e il traffico verso il PC lo pagherebbe l'utente.
    assert.equal(r.dopoSecondo.caricamenti, 1, 'se niente è cambiato non ricarica una seconda volta');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
