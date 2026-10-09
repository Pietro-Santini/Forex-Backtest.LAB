// FILTRO ANTI-DOPPIONI dei segnali (progetto in laboratorio/coordinamento/MESSAGGI/03).
//
// Problema: la stessa idea di ingresso arriva due volte (stessa sala o sale diverse) con parole
// diverse ("BUY GOLD 4120 SL 4100 TP 4140" e "oro long 4119,8 target 4140 stop 4101"): il testo non
// basta a riconoscerli e l'app apre DUE posizioni dov'era una.
//
// Regola: due segnali sono lo stesso trade se hanno STRUMENTO uguale (normalizzato), STESSA
// DIREZIONE, stesse FASCE DI PREZZO DI APERTURA e stessi TAKE PROFIT, entro una tolleranza.
// La funzione che si prova qui e' `fblDedupMotivo(voce)`: restituisce '' se non e' un doppione,
// altrimenti una frase che dice DOVE/CHI l'ha gia' aperto.
//
// Questi test nascono ROSSI: `fblDedupMotivo` non esiste ancora (test-first).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Azzera lo stato e prepara un conto simulato "pulito". Legge i dati da window.__pos / window.__strat
// (messi prima di chiamarla: dentro `evaluate` non si possono passare funzioni con argomenti).
const PREPARA = () => {
  positions = (window.__pos || []).slice();
  pendingOrders = [];
  trades = [];
  tgSegnaliRicevuti = [];
  tgStrategie = window.__strat || {};
  mt5Connected = false;
  liveModeActive = true; fblContoVista = 'mt5';
  currentAssetKey = 'XAUUSD';
};

// Prepara la pagina con posizioni/strategie date e azzera lo stato.
async function prepara(pagina, posizioni, strategie) {
  await pagina.evaluate((d) => { window.__pos = d[0]; window.__strat = d[1]; }, [posizioni || [], strategie || {}]);
  await pagina.evaluate((p) => eval('(' + p + ')')(), PREPARA.toString());
}

// Apre una voce-segnale e chiede il motivo del doppione.
async function motivo(pagina, seg, extra) {
  return pagina.evaluate((d) => {
    const voce = Object.assign({id: 's2', chat: 'Sala B', sala: '@b', stato: 'nuovo', ricevuto_ms: Date.now()},
      d.extra || {}, {segnale: d.seg});
    return fblDedupMotivo(voce);
  }, {seg, extra: extra || null});
}

const POS_BUY = [{asset: 'XAUUSD', side: 'BUY', entry: 4120, sl: 4100, tp: [4140], tgSala: 'Sala A', tgGruppo: 'g1'}];

test('doppione con testo diverso: stessa direzione, stessa entrata, stessi TP -> bloccato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina, POS_BUY, {});
    const m = await motivo(pagina, {strumento: 'XAUUSD', direzione: 'BUY', entrata: 4119.8, stop_loss: 4101, take_profit: [4140]});
    assert.ok(m && m.length, 'il secondo segnale è lo stesso trade: deve risultare doppione');
    assert.ok(/Sala A/.test(m), 'il motivo deve dire chi l\'ha già aperto: ' + m);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('direzione opposta NON è un doppione: un SELL con un BUY aperto si apre', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina, POS_BUY, {});
    const m = await motivo(pagina, {strumento: 'XAUUSD', direzione: 'SELL', entrata: 4120, stop_loss: 4140, take_profit: [4100]});
    assert.equal(m, '', 'direzione opposta: non è un doppione');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('TP diversi NON sono lo stesso trade', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina, POS_BUY, {});
    const m = await motivo(pagina, {strumento: 'XAUUSD', direzione: 'BUY', entrata: 4120, stop_loss: 4100, take_profit: [4160]});
    assert.equal(m, '', 'target diversi: è un altro trade');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('entrata fuori tolleranza NON è un doppione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina, POS_BUY, {});
    const m = await motivo(pagina, {strumento: 'XAUUSD', direzione: 'BUY', entrata: 4135, stop_loss: 4100, take_profit: [4140]});
    assert.equal(m, '', 'entrata lontana: non è lo stesso ingresso');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('lo stesso trade da un\'altra sala è comunque un doppione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina, POS_BUY, {});
    const m = await motivo(pagina, {strumento: 'XAUUSD', direzione: 'BUY', entrata: 4120, stop_loss: 4100, take_profit: [4140]},
      {chat: 'Sala Zeta', sala: '@zeta'});
    assert.ok(m && /Sala A/.test(m), 'la sala di origine diversa non salva dal doppione: ' + m);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('sottotipo seconda_entrata è ESENTE dal filtro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina, POS_BUY, {});
    const m = await motivo(pagina, {strumento: 'XAUUSD', direzione: 'BUY', entrata: 4120, stop_loss: 4100, take_profit: [4140]},
      {chat: 'Sala A', sala: '@a', sottotipo: 'seconda_entrata'});
    assert.equal(m, '', 'una seconda entrata voluta non è un doppione');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('doppione di una posizione Kraken registrata in tgStrategie', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina, [], {gk: {conto: 'kraken', sala: 'Sala K', simbolo: 'BTCUSD',
                                     sym: 'BINANCE:BTCUSDT', side: 'BUY', entry: 60000, tps: [62000]}});
    const m = await motivo(pagina, {strumento: 'BTCUSDT', direzione: 'BUY', entrata: 60000, take_profit: [62000]},
      {chat: 'Sala K', sala: '@k'});
    assert.ok(m && m.length, 'anche su Kraken il doppione va riconosciuto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
