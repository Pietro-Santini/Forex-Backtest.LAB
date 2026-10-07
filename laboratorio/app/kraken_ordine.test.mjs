// Ordine manuale su Kraken: target automatico a 1:1, e la fusione detta PRIMA.
//
// RICHIESTO dal proprietario (7 ottobre 2026): «se ho aperto una posizione e ancora non ho
// impostato TP e SL, li imposta lui automaticamente come l'anteprima che avviene per MT5: apro la
// posizione e mi mette a una determinata altezza 1 a 1 SL e TP».
//
// E la fusione: Kraken Futures tiene una sola posizione per contratto, quindi una seconda
// apertura sullo stesso contratto si fonde con la prima e l'entrata diventa la media pesata. Il
// proprietario ha deciso di lasciarla così, ma va detta prima di confermare: dopo, lo stop messo
// in precedenza si trova a una distanza diversa da quella scelta, senza aver toccato niente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Prepara tutto quello che serve a krakenOrdineManuale, e cattura il testo della conferma
// invece di aprirla: è lì che si vede cosa l'app sta per fare.
const PREPARA = (posizioniAperte) => {
  window._conferma = '';
  window._inviato = null;
  krakenConto = {collegato: true, ambiente: 'simulato', saldo: 10000, disponibile: 10000,
                 conto_id: 'conto-1', conto_nome: 'Conto prova 1'};
  krakenPosizioni = {posizioni: posizioniAperte || []};
  currentAssetKey = 'BINANCE:BTCUSDT';
  window.binanceSymbolForAsset = () => 'BTCUSDT';
  window.krakenLeva = () => 5;
  window.getLotSize = () => 1;
  window.fmtPrice = (v) => String(v);
  window.playOrderSound = () => {};
  window.krakenAggiornaConto = async () => {};
  window.krakenLeggiPosizioni = async () => {};
  window.krakenLeggiStorico = async () => {};
  window.krakenDisegnaConto = () => {};
  // Lo strumento, come lo darebbe il ponte.
  window.krakenBridge = async (p) => {
    if (String(p).startsWith('/strumento/'))
      return {ok: true, data: {simbolo: 'PF_XBTUSD', prezzo: 100, step: 0.0001, min: 0.0001, tick: 1}};
    return {ok: true, data: {}};
  };
  window.krakenEseguiSegnale = async (voce, o) => { window._inviato = o.piano; return true; };
  window.appConfirm = async (testo) => { window._conferma = testo; return false; };  // non si invia davvero
  // Le caselle SL e TP della barra ordini.
  const metti = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  metti('sl', ''); metti('tp', '');
};

test('senza TP scritto, il target si mette a 1:1 dallo stop', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')([]);
      document.getElementById('sl').value = '90';     // entrata 100, stop 90 → rischio 10
      await krakenOrdineManuale('BUY');
      return window._conferma;
    }, PREPARA.toString());
    // Il target deve finire a 110: stessa distanza dello stop, dall'altra parte.
    assert.match(r, /Take profit 110/);
    assert.match(r, /1:1 automatico/, 'va detto che l\'ha messo l\'app, non l\'utente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una vendita mette il target sotto, non sopra', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')([]);
      document.getElementById('sl').value = '110';    // SELL: stop sopra
      await krakenOrdineManuale('SELL');
      return window._conferma;
    }, PREPARA.toString());
    assert.match(r, /Take profit 90/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un TP scritto a mano non viene toccato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')([]);
      document.getElementById('sl').value = '90';
      document.getElementById('tp').value = '130';
      await krakenOrdineManuale('BUY');
      return window._conferma;
    }, PREPARA.toString());
    assert.match(r, /Take profit 130/);
    assert.doesNotMatch(r, /1:1 automatico/, 'il target è dell\'utente: non va spacciato per automatico');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con una posizione già aperta si avvisa della fusione, con i numeri', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      // Già aperta: BUY 1 a 80. Se ne apre un'altra BUY 1 a 100 → media 90, totale 2.
      eval('(' + p + ')')([{simbolo: 'PF_XBTUSD', lato: 'BUY', quantita: 1, entrata: 80, mark: 100, pnl: 20, tp: []}]);
      document.getElementById('sl').value = '90';
      await krakenOrdineManuale('BUY');
      return window._conferma;
    }, PREPARA.toString());
    assert.match(r, /ATTENZIONE/);
    assert.match(r, /una sola posizione per contratto/);
    assert.match(r, /entrata media 90/, 'il numero vero, non un avviso generico');
    assert.match(r, /BUY 2 /, 'il lottaggio dopo la fusione');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('su un contratto diverso non si parla di fusione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')([{simbolo: 'PF_ETHUSD', lato: 'BUY', quantita: 1, entrata: 2000, mark: 2000, pnl: 0, tp: []}]);
      document.getElementById('sl').value = '90';
      await krakenOrdineManuale('BUY');
      return window._conferma;
    }, PREPARA.toString());
    assert.doesNotMatch(r, /ATTENZIONE/, 'contratti diversi convivono: non si fondono');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
