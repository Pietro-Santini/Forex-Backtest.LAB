// BANCO — «ogni asset ha il SUO orario, e lo si capisce dai dati che arrivano da MT5».
//
// DIFETTO SEGNALATO E MISURATO DAL PROPRIETARIO, l'11 novembre 2026, con DUE FACCE OPPOSTE:
//
//  FACCIA A, ore 22:00 — «sono sul grafico, sono le 22 dell'11 novembre e non arriva piu'
//  nessun dato. Sul grafico non c'e' scritta nessuna etichetta del mercato chiuso, proprio
//  perche' da MT5 sul terminale ancora il mercato e' aperto. Non devi prenderla alla lettera
//  che alle 22 chiude il mercato, anche perche' non tutti gli asset chiudono alle 22.»
//
//  FACCIA B, ore 23:32, con foto — Dollar Index (DXY) a 5 minuti: l'app mostra l'etichetta
//  rossa «🔒 Mercato chiuso · apre tra 00:28:16 (12 nov 00:00)» mentre su MT5 il DXY e'
//  APERTO e continua ad aggiornarsi. Pannello diagnostico dello stesso istante:
//      fase=closed   fermo=true   ultimaCandela=2026-11-11T21:49:00.000Z   mt5: collegato
//
// SONO LA STESSA CAUSA VISTA DAI DUE LATI, e la catena e' questa:
//   1. `liveSessionTick()` (app.html, un giro al secondo) decide SOLO con l'orario scritto a
//      mano `liveSessionPhaseAt()` -> LIVE_MT5_CLOSE_MIN = 22*60. Alle 22:00 di Roma, per
//      QUALUNQUE asset non-cripto, chiama `liveSessionFreezeMt5()`;
//   2. `liveSessionFreezeMt5()` fa `stopMt5RefreshTimer(); disconnectMt5Stream();` e
//      `mt5ActiveSymbol=null`: l'app SI STACCA da sola dal passaggio dati MT5. Ecco la
//      FACCIA A: «non arriva piu' nessun dato» - e non arriva perche' l'app ha chiuso il
//      canale, non perche' il mercato abbia chiuso;
//   3. da quel momento `fblMercatoFermoOra()` guarda `mt5UltimoTickPerAsset[asset]` e trova
//      silenzio: dopo 5 minuti (FBL_MT5_SILENZIO_CHIUSO_MS) dichiara «mercato chiuso». La
//      regola «se non arrivano dati e' chiuso» finisce per misurare la disconnessione
//      dell'app stessa: una profezia che si autoavvera;
//   4. l'etichetta rossa invece NON passa da `fblMercatoFermoOra()`: `disegnaStatoMercato()`
//      chiama `statoMercato()`, che i dati che arrivano NON li guarda affatto. Quando MT5
//      (/symbol-check) non da' una risposta fresca, `statoMercato()` ripiega sull'orario
//      scritto a mano e su `fblProssimaRiapertura()`, che per costruzione non puo' tornare
//      altro che la MEZZANOTTE. Ecco la FACCIA B e il suo «apre tra 00:28:16 (12 nov 00:00)».
//
// QUESTO BANCO NON CORREGGE: MISURA. Mette in scena i due istanti veri del proprietario con
// i dati MT5 CHE CONTINUANO AD ARRIVARE e chiede all'app cosa dice. Oggi e' ROSSO.
//
// Le ultime due prove sono di GUARDIA e devono restare VERDI anche dopo la cura:
//   - le cripto non si congelano mai, nemmeno con mezz'ora di silenzio;
//   - una chiusura VERA (sabato, canale vivo, nessun tick) deve continuare a dire «chiuso»,
//     altrimenti l'asse si allunga oltre l'ultima candela (vedi
//     laboratorio/app/asse_si_ferma_alla_chiusura.test.mjs).
//
// COME SI LANCIA (dalla cartella `laboratorio` del repo, un banco per volta):
//   node --test app/mercato_per_asset_dai_dati.test.mjs   (dalla cartella laboratorio)
import test from 'node:test';
import assert from 'node:assert/strict';
// Import RELATIVO: questo banco vive in laboratorio/app e li' sta anche aiuti.mjs.
// MISURATO il 12 novembre: con il percorso assoluto della macchina di chi l'ha scritto,
// su GitHub il file moriva in 35 ms con exitCode 1 e ZERO prove eseguite - un collaudo
// rosso che non misurava niente. Un banco non deve sapere dove abita.
import {apriApp} from './aiuti.mjs';

// 11 novembre 2026 e' un MERCOLEDI'. Roma a novembre e' CET, cioe' UTC+1.
const T_2202 = Date.UTC(2026, 10, 11, 21, 2, 0);   // 22:02 di Roma — la FACCIA A
const T_2332 = Date.UTC(2026, 10, 11, 22, 32, 0);  // 23:32 di Roma — la FACCIA B (la foto)
const T_SABATO = Date.UTC(2026, 10, 14, 10, 0, 0); // sabato 14 novembre, mercato chiuso davvero

// ----------------------------------------------------------------------------------------
// Pezzi che girano DENTRO la pagina. Sono funzioni vere (non stringhe) perche' devono vedere
// le variabili globali dell'app, come fa laboratorio/app/mercato_stato_mt5.test.mjs.
// ----------------------------------------------------------------------------------------

// L'orologio del dispositivo si dichiara, non si eredita: le due facce del difetto stanno a
// un'ora precisa e un banco che dipende da quando lo lanci non e' una misura, e' un'opinione.
const SCENA = ({t, asset, tickDaMs, cripto, calendario, rispostaMt5, apriCanale}) => {
  if (!window.__NOW_VERO) window.__NOW_VERO = Date.now;
  window.__NOW_OFF = t - window.__NOW_VERO.call(Date);
  Date.now = () => window.__NOW_VERO.call(Date) + window.__NOW_OFF;

  // 60 candele da 5 minuti che finiscono dove le ha viste il proprietario.
  const R = [];
  let p = 99.2;
  for (let i = 0; i < 60; i++) {
    const tt = Date.now() - (60 - i) * 5 * 60000;
    const o = p, c = p + Math.sin(i / 6) * 0.03;
    R.push({date: new Date(tt).toISOString(), open: o, high: Math.max(o, c) + 0.01,
            low: Math.min(o, c) - 0.01, close: c, volume: 10});
    p = c;
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length;
  currentTF = 5;
  currentAssetKey = asset; rowsAssetKey = asset;
  csvLibrary = [{id: 'mt5_live_' + asset, rows: R}];
  liveModeActive = true; liveReplayActive = false;
  mt5Connected = true; mt5ActiveSymbol = asset;
  fblNotteMt5 = false; liveSessionPhase = null; liveSessionBusy = false;
  positions.length = 0; pendingOrders.length = 0;

  // Il calendario dello strumento: per il DXY il proprietario non ha Capital.com collegato,
  // quindi NON c'e' - ed e' il caso che fa cadere l'app sull'orario scritto a mano.
  try { delete orariAsset[asset]; } catch (e) {}
  if (calendario) orariAsset[asset] = calendario;

  // La risposta di MT5 a /symbol-check. `null` = non ha dato nessuna prova (e' il caso vero:
  // il ponte risponde `trade_allowed: null` quando non ha un tick fresco per quel simbolo).
  Object.keys(fblMercatoMt5Cache).forEach(k => delete fblMercatoMt5Cache[k]);
  if (rispostaMt5 !== null && rispostaMt5 !== undefined) {
    fblMercatoMt5Cache[asset] = {aperto: rispostaMt5, letto: Date.now()};
  }

  // I DATI CHE ARRIVANO: e' questo il punto di tutta la faccenda.
  mt5UltimoTickPerAsset = {};
  if (tickDaMs !== null && tickDaMs !== undefined) {
    mt5UltimoTickPerAsset[asset] = {at: Date.now() - tickDaMs, prezzo: R[R.length - 1].close};
  }

  // Il canale verso il ponte: APERTO e vivo, come quando MT5 sta davvero quotando.
  if (apriCanale) {
    try {
      connectMt5Stream(asset);
      if (mt5FeedWs && mt5FeedWs.__apri) mt5FeedWs.__apri();
      lastMt5RealTickAt = Date.now() - (tickDaMs || 0);
    } catch (e) {}
  }
  if (cripto) { /* niente: l'asset cripto lo riconosce da solo dal nome */ }

  return {
    adesso: new Date(Date.now()).toISOString(),
    fase: liveSessionPhaseNow(),
    oraRoma: (function () { const d = romeDayAndMinute(Date.now());
      return String(Math.floor(d.min / 60)).padStart(2, '0') + ':' + String(d.min % 60).padStart(2, '0'); })(),
    canaleVivo: !!(typeof mt5FeedWs !== 'undefined' && mt5FeedWs && mt5FeedWs.readyState === 1)
  };
};

// Che cosa dice l'app, per tutte e tre le strade che possono decidere «aperto/chiuso».
const VERDETTO = () => {
  const a = currentAssetKey;
  const st = (function () { try { return statoMercato(a, Date.now()); } catch (e) { return {errore: String(e)}; } })();
  // L'etichetta rossa vera: si cattura il testo che `disegnaStatoMercato()` scriverebbe.
  const testi = [];
  const ctx = {font: '', globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1,
    textAlign: '', textBaseline: '',
    save() {}, restore() {}, beginPath() {}, roundRect() {}, fill() {}, fillRect() {},
    stroke() {}, measureText() { return {width: 220}; }, fillText(t) { testi.push(String(t)); }};
  try { disegnaStatoMercato(ctx, 1000, 600, {l: 60, r: 70, t: 12, b: 34}, '#111', '#fff'); } catch (e) { testi.push('ERRORE ' + e); }
  return {
    fermo: (function () { try { return fblMercatoFermoOra(a, Date.now()); } catch (e) { return String(e); } })(),
    stato: st,
    chiusoSecondoStato: !!(st && st.chiuso),
    etichetta: testi.join(' | '),
    fase: liveSessionPhaseNow(),
    riapertura: (function () { try { const v = fblProssimaRiapertura(Date.now()); return v == null ? null : new Date(v).toISOString(); } catch (e) { return null; } })(),
    canaleVivo: !!(typeof mt5FeedWs !== 'undefined' && mt5FeedWs && mt5FeedWs.readyState === 1),
    simboloAttivo: (typeof mt5ActiveSymbol === 'undefined') ? '(non definito)' : mt5ActiveSymbol,
    notte: (typeof fblNotteMt5 === 'undefined') ? null : !!fblNotteMt5
  };
};

// ========================================================================================
// FACCIA B — 23:32, DXY, i dati di MT5 continuano ad arrivare. L'app deve dire APERTO.
// ========================================================================================
test('FACCIA B — DXY alle 23:32 con i tick che arrivano: niente etichetta «Mercato chiuso»', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const scena = await pagina.evaluate(SCENA, {
      t: T_2332, asset: 'DXY', tickDaMs: 2000, cripto: false,
      calendario: null,     // niente calendario dello strumento: e' il caso vero del proprietario
      rispostaMt5: null,    // MT5 non ha dato nessuna prova (trade_allowed: null)
      apriCanale: true      // ...ma il canale e' vivo e i tick arrivano
    });
    assert.equal(scena.oraRoma, '23:32', 'la scena deve essere alle 23:32 di Roma: ' + JSON.stringify(scena));
    assert.equal(scena.fase, 'closed',
      'la prova vale solo se l\'orario scritto a mano, da solo, direbbe CHIUSO: ' + JSON.stringify(scena));

    const v = await pagina.evaluate(VERDETTO);

    // La misura che inchioda la provenienza della mezzanotte: non e' un calendario del DXY,
    // e' `fblProssimaRiapertura()`, che per costruzione torna solo il primo minuto in cui
    // `liveSessionPhaseAt()` smette di dire 'closed' - cioe' 00:00 esatte.
    assert.equal(v.riapertura, '2026-11-11T23:00:00.000Z',
      'la riapertura proposta deve essere la mezzanotte di Roma (00:00 del 12), quella scritta a mano: ' + v.riapertura);

    // 1) il passaggio dati dice APERTO
    assert.equal(v.fermo, false,
      'con i tick che arrivano da MT5 il mercato NON e\' fermo: ' + JSON.stringify(v));
    // 2) e allora nessuna delle altre strade puo' dire il contrario
    assert.equal(v.chiusoSecondoStato, false,
      'statoMercato() dice ancora CHIUSO mentre i dati arrivano (e disegna l\'etichetta rossa): ' + JSON.stringify(v.stato));
    assert.equal(v.etichetta, '',
      'sul grafico non deve comparire nessuna etichetta di mercato chiuso: «' + v.etichetta + '»');

    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});

// ========================================================================================
// FACCIA A — 22:00: l'app non deve staccarsi da sola da un asset che sta ancora quotando.
// ========================================================================================
test('FACCIA A — alle 22:02 con i tick che arrivano l\'app non si stacca da MT5', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const scena = await pagina.evaluate(SCENA, {
      t: T_2202, asset: 'XAUUSD', tickDaMs: 1500, cripto: false,
      calendario: null, rispostaMt5: null, apriCanale: true
    });
    assert.equal(scena.oraRoma, '22:02', 'la scena deve essere alle 22:02 di Roma: ' + JSON.stringify(scena));
    assert.equal(scena.canaleVivo, true, 'il canale MT5 deve partire vivo: ' + JSON.stringify(scena));

    // Il giro al secondo dell'app, quello che decide la fascia oraria.
    await pagina.evaluate(async () => { try { await liveSessionTick(); } catch (e) {} });
    await pagina.waitForTimeout(300);

    const v = await pagina.evaluate(VERDETTO);
    assert.equal(v.simboloAttivo, 'XAUUSD',
      'l\'app ha rilasciato il grafico (mt5ActiveSymbol=null) solo per l\'orario scritto a mano, mentre i tick arrivavano: ' + JSON.stringify(v));
    assert.equal(v.notte, false,
      'l\'app si e\' messa in «modalita\' notte» mentre il mercato dell\'asset era ancora aperto: ' + JSON.stringify(v));
    assert.equal(v.canaleVivo, true,
      'il canale dati MT5 e\' stato chiuso dall\'app stessa alle 22:00: da qui in poi «non arrivano dati» non significa piu\' niente: ' + JSON.stringify(v));

    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});

// ========================================================================================
// LA PROFEZIA CHE SI AUTOAVVERA — il silenzio causato dall'app non e' una prova di chiusura.
// E' la trappola (b) della proposta «se non arrivano dati e' chiuso»: se il canale non c'e'
// (app staccata, ponte spento, rete caduta) il silenzio non dice niente sul mercato.
// ========================================================================================
test('il silenzio con il canale MT5 staccato non vale come «mercato chiuso»', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENA, {
      t: T_2202, asset: 'XAUUSD', tickDaMs: 1500, cripto: false,
      calendario: null, rispostaMt5: null, apriCanale: true
    });
    // L'app si stacca da sola (e' quello che fa oggi alle 22:00), poi passano 8 minuti.
    const dopo = await pagina.evaluate(async () => {
      try { await liveSessionFreezeMt5('closed'); } catch (e) {}
      window.__NOW_OFF += 8 * 60000;   // avanti di 8 minuti: oltre i 5 della soglia
      return {canale: !!(mt5FeedWs && mt5FeedWs.readyState === 1), simbolo: mt5ActiveSymbol};
    });
    assert.equal(dopo.canale, false, 'la scena vuole il canale staccato: ' + JSON.stringify(dopo));

    const v = await pagina.evaluate(VERDETTO);
    assert.equal(v.fermo, false,
      'con il canale staccato il silenzio e\' colpa dell\'app, non del mercato: non puo\' diventare «mercato chiuso» ' + JSON.stringify(v));
    assert.equal(v.etichetta, '',
      'e non puo\' diventare l\'etichetta rossa: «' + v.etichetta + '»');

    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});

// ========================================================================================
// GUARDIA 1 — le cripto non si congelano MAI. Deve restare verde dopo la cura.
// ========================================================================================
test('GUARDIA — una cripto non si congela nemmeno con mezz\'ora di silenzio', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENA, {
      t: T_2332, asset: 'BINANCE:BTCUSDT', tickDaMs: 30 * 60000, cripto: true,
      calendario: null, rispostaMt5: null, apriCanale: false
    });
    const v = await pagina.evaluate(VERDETTO);
    assert.equal(v.fermo, false, 'una cripto non e\' mai ferma: ' + JSON.stringify(v));
    assert.equal(v.chiusoSecondoStato, false, 'una cripto non ha mai lo stato «chiuso»: ' + JSON.stringify(v.stato));
    assert.equal(v.etichetta, '', 'nessuna etichetta di mercato chiuso sulle cripto: «' + v.etichetta + '»');
    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});

// ========================================================================================
// GUARDIA 2 — una chiusura VERA resta chiusura: sabato, canale vivo, nessun tick.
// Se questa diventasse rossa, l'asse ricomincerebbe ad allungarsi oltre l'ultima candela
// (laboratorio/app/asse_si_ferma_alla_chiusura.test.mjs).
// ========================================================================================
test('GUARDIA — sabato, canale vivo e nessun tick: il mercato e\' chiuso davvero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const scena = await pagina.evaluate(SCENA, {
      t: T_SABATO, asset: 'XAUUSD', tickDaMs: 10 * 60000, cripto: false,
      calendario: null, rispostaMt5: null, apriCanale: true
    });
    assert.equal(scena.fase, 'closed', 'sabato la fase deve essere closed: ' + JSON.stringify(scena));
    const v = await pagina.evaluate(VERDETTO);
    assert.equal(v.fermo, true,
      'canale vivo e dieci minuti senza un tick di sabato: il mercato e\' chiuso: ' + JSON.stringify(v));
    assert.equal(v.chiusoSecondoStato, true,
      'e l\'etichetta ci deve essere: ' + JSON.stringify(v.stato));
    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});
