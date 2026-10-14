// LE POSIZIONI KRAKEN SI VEDONO INTERE ANCHE SU TELEFONO E TABLET.
//
// SEGNALATO dal proprietario: «sugli altri dispositivi, telefono e tablet, con le posizioni del
// conto Kraken non mi mostra più il TP e lo SL. Mi fa vedere l'entrata sul grafico e il P/L live,
// ma nient'altro. E non funziona nemmeno il pulsante "vai a grafico": non mi carica l'asset di
// quella posizione».
//
// DUE DIFETTI DIVERSI.
//
// 1) TP E SL SPARIVANO. Il disegno prende stop e target dalla posizione così come la racconta
//    Kraken (p.sl, p.tp: gli ordini VERI presenti sull'exchange) e, quando lì non ci sono — e non
//    ci sono ogni volta che a gestirli è l'app invece dell'exchange — ripiega su `tgStrategie`.
//    Ma tgStrategie è DI PROPOSITO del solo dispositivo che ha aperto la posizione: sta scritto
//    accanto a GRAFICO_LS, «sono stato, non configurazione». Su un telefono che quella posizione
//    non l'ha aperta la voce non esiste, stop e target restavano NaN, e drawTpSlZoneBox senza
//    nessuno dei due livelli non disegna niente. L'entrata si vedeva lo stesso perché la disegna
//    un'altra parte, e il P/L arriva dal ponte: ecco il «solo entrata e P/L».
//    LA CURA: il motore delle strategie resta del dispositivo che ha aperto (due dispositivi che
//    muovono lo stesso stop sarebbero un guaio peggiore), ma i LIVELLI da mostrare si pubblicano
//    in una voce condivisa che gli altri usano SOLO per disegnare.
//
// 2) "VAI A GRAFICO" NON CARICAVA NIENTE, in silenzio. I quattro punti che saltano a grafico
//    scrivevano tutti la stessa riga: in Live → loadLiveHistoryFromCapital. Quella funzione
//    comincia con `if(!capitalSessionTokens)return;`, e su un telefono quella sessione non esiste
//    (le credenziali Capital.com si leggono da una CARTELLA del computer). Usciva senza errori e
//    senza candele: il menu mostrava il nuovo asset, il grafico restava col vecchio.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

// Il telefono: nessuna strategia locale (non ha aperto lui le posizioni), e una posizione Kraken
// i cui stop e target NON sono ordini sull'exchange — li gestisce l'app.
const PREPARA = () => {
  const t0 = Date.now() - 300 * 60000;
  const R = [];
  for (let i = 0; i < 300; i++) R.push({date: new Date(t0 + i * 60000).toISOString(),
    open: 60000, high: 60400, low: 59600, close: 60100, volume: 3});
  rows = R; baseRows = R; currentTF = 1; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'BTCUSD'; rowsAssetKey = 'BTCUSD';
  liveModeActive = false; mt5Connected = false; capitalSessionTokens = null;
  positions = []; trades = []; drawings = []; replayForm = null;
  followLatest = false; viewPriceLo = 55000; viewPriceHi = 66000; priceZoomFactor = 1;
  tgStrategie = {};                       // il telefono non ha aperto niente
  localStorage.removeItem(KRAKEN_LIVELLI_KEY);
  krakenLivelliCondivisi = {};
  // Il conto Kraken risulta collegato: senza, il disegno non parte proprio (ed e' giusto cosi').
  krakenConto = {collegato: true, conto_id: 'prova', pnl_aperto: 50};
  krakenPendenti = [];
  krakenPosizioni = {posizioni: [{
    simbolo: 'PF_XBTUSD', lato: 'long', quantita: 0.5, entrata: 60000, mark: 60100,
    pnl: 50, sl: null, tp: [], stops: []     // Kraken non ha ordini: li gestisce l'app
  }]};
};

test('senza la strategia locale, i livelli arrivano da chi ha aperto la posizione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PREPARA_SRC => {
      eval('(' + PREPARA_SRC + ')()');
      const senzaNiente = krakenStrategiaPerDisegno('PF_XBTUSD');
      // Arriva la voce pubblicata dal computer che ha aperto la posizione.
      krakenLivelliCondivisi = {PF_XBTUSD: {creato: Date.now() - 86400000, sl: 58000,
                                            slIniziale: 58000, tps: [62000, 64000]}};
      const conCondivisa = krakenStrategiaPerDisegno('PF_XBTUSD');
      // La strategia LOCALE, quando c'è, comanda lei: è quella che muove davvero lo stop.
      tgStrategie = {g1: {conto: 'kraken', simbolo: 'PF_XBTUSD', creato: Date.now(), sl: 59000,
                          slIniziale: 58000, tps: [61000]}};
      const conLocale = krakenStrategiaPerDisegno('PF_XBTUSD');
      return {senzaNiente, slCondivisa: conCondivisa && conCondivisa.sl,
              tpsCondivisi: conCondivisa && conCondivisa.tps, slLocale: conLocale && conLocale.sl};
    }, PREPARA.toString());
    assert.equal(r.senzaNiente, null, 'se non si sa niente non si inventa niente');
    assert.equal(r.slCondivisa, 58000, 'lo stop arriva dalla voce condivisa');
    assert.deepEqual(r.tpsCondivisi, [62000, 64000], 'e anche i target');
    assert.equal(r.slLocale, 59000, 'ma la strategia di questo dispositivo ha la precedenza');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('chi apre pubblica i livelli, e pubblica quelli giusti', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PREPARA_SRC => {
      eval('(' + PREPARA_SRC + ')()');
      const vecchia = Date.now() - 2 * 86400000, nuova = Date.now();
      tgStrategie = {
        // Due strategie sullo stesso simbolo: il disegno usa la più VECCHIA, e si pubblica quella.
        g1: {conto: 'kraken', simbolo: 'PF_XBTUSD', creato: vecchia, sl: 58000, slIniziale: 57000,
             tps: [62000, 64000]},
        g2: {conto: 'kraken', simbolo: 'PF_XBTUSD', creato: nuova, sl: 59500, slIniziale: 59000,
             tps: [65000]},
        // Una di un altro conto: non c'entra niente e non va pubblicata.
        g3: {conto: 'mt5', simbolo: 'EURUSD', creato: nuova, sl: 1.09, tps: [1.11]}
      };
      const cambiato = krakenLivelliPubblica();
      const salvato = JSON.parse(localStorage.getItem(KRAKEN_LIVELLI_KEY) || '{}');
      const ancora = krakenLivelliPubblica();   // niente di nuovo: non si riscrive
      return {cambiato, ancora, chiavi: Object.keys(salvato).sort(), voce: salvato.PF_XBTUSD};
    }, PREPARA.toString());
    assert.equal(r.cambiato, true);
    assert.equal(r.ancora, false, 'senza cambiamenti non si riscrive (e non si risincronizza)');
    assert.deepEqual(r.chiavi, ['PF_XBTUSD'], 'solo le posizioni Kraken');
    assert.equal(r.voce.sl, 58000, 'si pubblica la strategia più vecchia, la stessa che disegna');
    assert.equal(r.voce.slIniziale, 57000);
    assert.deepEqual(r.voce.tps, [62000, 64000]);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('a grafico la posizione Kraken mostra stop e target anche sul telefono', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PREPARA_SRC => {
      eval('(' + PREPARA_SRC + ')()');
      const orig = drawTpSlZoneBox;
      const viste = [];
      drawTpSlZoneBox = function(ctx, opts){
        if (opts && String(opts.ownerKey || '').startsWith('kraken:')) viste.push({sl: opts.sl, tp: opts.tp});
        return orig.apply(this, arguments);
      };
      let prima, dopo;
      try{
        // Com'era sul telefono: nessuna strategia, nessun ordine su Kraken.
        draw(); prima = viste.slice();
        // Ora arriva la voce pubblicata dal computer.
        krakenLivelliCondivisi = {PF_XBTUSD: {creato: Date.now() - 86400000, sl: 58000,
                                              slIniziale: 58000, tps: [62000, 64000]}};
        viste.length = 0;
        draw(); dopo = viste.slice();
      } finally { drawTpSlZoneBox = orig; }
      return {prima, dopo};
    }, PREPARA.toString());
    assert.equal(r.prima.length, 1, 'il disegno della posizione Kraken deve comunque partire');
    assert.equal(r.prima[0].sl, null, 'senza livelli non si disegna nessuno stop: era il caso rotto');
    assert.equal(r.dopo.length, 1);
    assert.equal(r.dopo[0].sl, 58000, 'con la voce condivisa lo stop compare');
    assert.equal(r.dopo[0].tp, 64000, 'e il target più lontano, come sul computer');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('"Vai a grafico" non può fallire in silenzio', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async PREPARA_SRC => {
      eval('(' + PREPARA_SRC + ')()');
      // Il telefono: Live, nessuna sessione Capital.com, nessuno storico in libreria.
      liveModeActive = true; capitalSessionTokens = null; csvLibrary = [];
      const esito = await caricaStoricoPerSaltoAGrafico('ETHUSD');
      return {ok: esito.ok, motivo: esito.motivo};
    }, PREPARA.toString());
    assert.equal(r.ok, false, 'senza fonte non si può caricare: va detto, non taciuto');
    assert.match(r.motivo, /ETHUSD/, 'il messaggio deve dire di quale asset si parla');
    assert.match(r.motivo, /computer|Libreria/i,
      'e deve dire cosa fare: aprirlo dal computer, o aggiungere lo storico');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una posizione senza orario di apertura non perde comunque TP e SL', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PREPARA_SRC => {
      eval('(' + PREPARA_SRC + ')()');
      // Senza startTime valido la candela di apertura non esiste (openIdx nullo): prima spariva
      // tutta la casella Target/Stop, che però non dipende da quando è stata aperta.
      positions = [{id: 'X1', asset: 'BTCUSD', side: 'BUY', entry: 60000, sl: 58000, rrSl: 58000,
                    tp: 63000, lots: 0.1, marginUsed: 100}];
      positionsVisible = true; active = null; posSelezionata = null;
      const openIdx = rowIndexContainingTime(openReferenceTimeForPos(positions[0]));
      const orig = drawTpSlZoneBox;
      let caselle = 0;
      drawTpSlZoneBox = function(ctx, opts){ if (opts && opts.ownerKey === 'pos:X1') caselle++;
                                             return orig.apply(this, arguments); };
      try{ draw(); } finally { drawTpSlZoneBox = orig; }
      return {openIdx, caselle};
    }, PREPARA.toString());
    assert.equal(r.openIdx, null, 'il test si deve trovare nel caso vero: nessuna candela di apertura');
    assert.equal(r.caselle, 1, 'la casella Target/Stop si deve disegnare lo stesso');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la fonte del salto a grafico si sceglie in un punto solo', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const vecchi = src.match(/if\(liveModeActive\) await loadLiveHistoryFromCapital\(/g) || [];
  assert.equal(vecchi.length, 0,
    'i salti a grafico non devono più chiamare Capital.com direttamente: ' + vecchi.length);
  const usi = src.match(/await caricaStoricoPerSaltoAGrafico\(/g) || [];
  assert.equal(usi.length, 4,
    'i quattro salti (posizione, pendente, pendente MT5, Journal) passano tutti di lì: ' + usi.length);
  assert.match(src, /sorgente=fblSorgenteLivePerCambioTf\(/,
    'la scelta della fonte è quella già collaudata del cambio timeframe');
  assert.match(src, /if\(rowsAssetKey===asset&&rows\.length\)return \{ok:true\};/,
    'si deve verificare che le candele caricate siano DAVVERO di quell asset');
  // I livelli Kraken viaggiano fra i dispositivi, e si pubblicano in un punto solo.
  assert.match(src, /fb_kraken_livelli:v=>/,
    'la voce condivisa deve passare dalla sincronizzazione fra dispositivi');
  assert.match(src, /try\{ krakenLivelliPubblica\(\); \}catch\(e\)\{\}/,
    'si pubblica dal salvataggio delle strategie, il punto che tutte le modifiche attraversano');
});

test('uno stop che non esiste non diventa uno stop a prezzo zero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    // QUARTA volta con lo stesso inganno in questo progetto: Number(null) fa 0, e 0 passa
    // Number.isFinite. Il ponte manda `sl: null` ogni volta che su Kraken non c'e' un ordine di
    // stop - normalissimo quando a gestirlo e' l'app - e quel null diventava uno stop a ZERO: la
    // casella Target/Stop partiva dall'entrata e arrivava a zero, coprendo tutto il grafico.
    const r = await pagina.evaluate(() => ({
      nullo: krakenPrezzo(null), indefinito: krakenPrezzo(undefined), vuoto: krakenPrezzo(''),
      zero: krakenPrezzo(0), negativo: krakenPrezzo(-5), testo: krakenPrezzo('ciao'),
      vero: krakenPrezzo(58000), testoNumerico: krakenPrezzo('58000')
    }));
    assert.ok(Number.isNaN(r.nullo), 'niente non e zero');
    assert.ok(Number.isNaN(r.indefinito));
    assert.ok(Number.isNaN(r.vuoto));
    assert.ok(Number.isNaN(r.zero), 'zero non e un prezzo');
    assert.ok(Number.isNaN(r.negativo));
    assert.ok(Number.isNaN(r.testo));
    assert.equal(r.vero, 58000);
    assert.equal(r.testoNumerico, 58000, 'un numero scritto come testo resta un prezzo valido');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
