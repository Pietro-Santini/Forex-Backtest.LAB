// ALLE 22 LA CANDELA SI FERMA ANCHE SE MT5 CONTINUA A TRASMETTERE.
//
// SEGNALATO dal proprietario (17 novembre 2026): «il grafico XAUUSD si blocca alle 22 mentre MT5
// continua a trasmettere; il PL live funziona, solo la candela non si aggiorna» - e vale per
// tutti gli asset, non solo per l'oro.
//
// IL 12 NOVEMBRE erano state curate DUE strade su tre: l'app non si stacca piu' dal canale di un
// asset che sta ancora quotando (`liveSessionTick`), e l'etichetta rossa non compare piu' per
// orologio (`statoMercato`/`fblMercatoFermoOra`). Il banco di quel giorno
// (`mercato_per_asset_dai_dati`) oggi e' verde su tutte e cinque le prove.
//
// LA TERZA STRADA ERA RIMASTA, ed e' quella che si vede: `applyLivePriceToChart()` - la funzione
// che porta il prezzo sulla candela - comincia con
//
//     if(liveSessionPhaseNow()==='closed')return false;
//
// e `liveSessionPhaseNow()` guarda SOLO l'orologio scritto a mano (`LIVE_MT5_CLOSE_MIN=22*60`).
// Dalle 22 in poi nessun prezzo tocca piu' il grafico, qualunque cosa stia facendo MT5. Subito
// sotto c'e' lo stesso sbarramento via `statoMercato()`. Il canale resta vivo, i tick arrivano,
// il PL delle posizioni si aggiorna (quello viene dal conto, non dalla candela): si ferma solo
// il disegno. E' esattamente cio' che il proprietario descrive.
//
// Le due prove di GUARDIA sono quelle che impediscono alla cura di diventare un difetto nuovo:
// a mercato davvero chiuso (sabato, oppure silenzio vero dopo le 22) il grafico NON deve
// inventare candele - era il bug «candele finte fino alle 02:00» gia' corretto una volta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// 11 novembre 2026 e' un MERCOLEDI'. Roma a novembre e' CET, cioe' UTC+1.
const T_2202 = Date.UTC(2026, 10, 11, 21, 2, 0);   // 22:02 di Roma, mercato MT5 ancora vivo
const T_SABATO = Date.UTC(2026, 10, 14, 10, 0, 0); // sabato: chiuso davvero

// La scena e' la stessa del banco del 12 novembre (mercato_per_asset_dai_dati): stesso istante,
// stessi dati che arrivano. Qui pero' non si chiede all'app «e' chiuso?», si chiede «la candela
// si muove?».
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


// Porta un prezzo nuovo sulla candela, come fa un tick vero in arrivo.
const TICCHETTA = (dopoMs) => `(() => {
  const file = csvLibrary[0];
  const prima = {righe: file.rows.length, close: file.rows[file.rows.length-1].close};
  const t = Date.now() + (${dopoMs||0});
  const nuovo = prima.close + 0.25;
  const esito = applyLivePriceToChart(nuovo, t, {fromAsset: currentAssetKey});
  const dopo = {righe: file.rows.length, close: file.rows[file.rows.length-1].close};
  return {esito, prima, dopo, fase: liveSessionPhaseNow()};
})()`;

test('alle 22:02 con i tick che arrivano, il prezzo muove ancora la candela', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const scena = await pagina.evaluate(`(${SCENA})({t:${T_2202}, asset:'XAUUSD', tickDaMs:1500, rispostaMt5:null, apriCanale:true})`);
    assert.equal(scena.oraRoma, '22:02', 'la scena deve stare alle 22:02 di Roma: e\' alle ' + scena.oraRoma);
    const r = await pagina.evaluate(TICCHETTA(0));
    assert.equal(r.esito, true, 'il prezzo deve arrivare alla candela: applyLivePriceToChart ha risposto ' + r.esito);
    assert.ok(r.dopo.close > r.prima.close,
      'la candela in corso deve muoversi: close ' + r.prima.close + ' -> ' + r.dopo.close);
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('alle 22:02 nasce anche la candela nuova quando cambia il minuto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(`(${SCENA})({t:${T_2202}, asset:'XAUUSD', tickDaMs:1500, rispostaMt5:null, apriCanale:true})`);
    const r = await pagina.evaluate(TICCHETTA(5*60000));   // il bucket successivo (TF 5 minuti)
    assert.equal(r.esito, true, 'il tick del bucket nuovo deve essere accettato');
    assert.equal(r.dopo.righe, r.prima.righe + 1,
      'deve nascere una candela nuova: righe ' + r.prima.righe + ' -> ' + r.dopo.righe);
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('GUARDIA — sabato il grafico non inventa candele', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(`(${SCENA})({t:${T_SABATO}, asset:'XAUUSD', tickDaMs:null, rispostaMt5:null, apriCanale:true})`);
    const r = await pagina.evaluate(TICCHETTA(5*60000));
    assert.equal(r.esito, false, 'di sabato nessun prezzo deve toccare il grafico');
    assert.equal(r.dopo.righe, r.prima.righe, 'e nessuna candela deve nascere');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('GUARDIA — dopo le 22, se i tick sono finiti davvero, il grafico si ferma', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(`(${SCENA})({t:${T_2202}, asset:'XAUUSD', tickDaMs:12*60000, rispostaMt5:null, apriCanale:true})`);
    const r = await pagina.evaluate(TICCHETTA(5*60000));
    assert.equal(r.esito, false, 'dodici minuti di silenzio dopo le 22 sono una chiusura vera');
    assert.equal(r.dopo.righe, r.prima.righe, 'e nessuna candela deve nascere');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});
