// KRAKEN FRA LE SESSIONI DEL FILTRO DEL TRADE JOURNAL.
//
// RICHIESTO dal proprietario: «nel Trade Journal dobbiamo inserire anche come sessione e conto
// anche quella di Kraken». Mancava: le operazioni sulle cripto si potevano solo cercare a occhio
// in mezzo a tutte le altre.
//
// Kraken non è una «modalità» come Storico o Live — non è un valore di t.mode, è un CONTO. Si
// riconosce con la stessa funzione che usa tutto il resto dell'app (fblContoDiOperazione):
// scriverne qui una seconda versione vorrebbe dire avere due idee diverse di «operazione su
// Kraken» e accorgersene il giorno che non coincidono.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

// Quattro operazioni: una Kraken (riconosciuta dal simbolo), una MT5, una Live Capital.com e una
// di Storico. Sono le quattro che il filtro deve saper separare.
const TRADES = `[
  {mode:'live', krakenSimbolo:'PF_SOLUSD', asset:'BINANCE:SOLUSDT'},
  {mode:'live', mt5Ticket:123, mt5Login:'500100', asset:'XAUUSD'},
  {mode:'live', asset:'EURUSD'},
  {mode:'backtest', asset:'EURUSD'}
]`;

test('il filtro Kraken prende le operazioni Kraken e solo quelle', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      const t = ${TRADES};
      ({kraken: t.filter(x=>journalTradeMatchesFilter(x,'kraken')).length,
        quale:  t.findIndex(x=>journalTradeMatchesFilter(x,'kraken'))})
    }`);
    assert.equal(r.kraken, 1);
    assert.equal(r.quale, 0, 'è la prima, quella con il simbolo Kraken');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('«Live Capital.com» non si prende più le operazioni Kraken', async () => {
  // È il punto delicato: un'operazione Kraken nasce mentre la sessione Live è accesa, quindi ha
  // mode 'live'. Ma chi filtra «Live Capital.com» vuole quelle di Capital.com.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      const t = ${TRADES};
      ({live: t.filter(x=>journalTradeMatchesFilter(x,'live')).length,
        storico: t.filter(x=>journalTradeMatchesFilter(x,'backtest')).length,
        tutte: t.filter(x=>journalTradeMatchesFilter(x,'all')).length})
    }`);
    assert.equal(r.live, 1, 'solo quella di Capital.com: non la Kraken, non la MT5');
    assert.equal(r.storico, 1);
    assert.equal(r.tutte, 4, '«tutte» resta tutte, Kraken compresa');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i filtri per singolo conto MT5 non cambiano', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      const t = ${TRADES};
      ({mt5: t.filter(x=>journalTradeMatchesFilter(x,'mt5:500100')).length,
        altroConto: t.filter(x=>journalTradeMatchesFilter(x,'mt5:999999')).length})
    }`);
    assert.equal(r.mt5, 1);
    assert.equal(r.altroConto, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una Kraken di Storico resta fuori anche da «Storico»', async () => {
  // Stessa regola dell'altro verso: il conto vince sulla sessione.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      const t = [{mode:'backtest', krakenSimbolo:'PF_XBTUSD'}];
      ({storico: t.filter(x=>journalTradeMatchesFilter(x,'backtest')).length,
        kraken: t.filter(x=>journalTradeMatchesFilter(x,'kraken')).length})
    }`);
    assert.equal(r.storico, 0);
    assert.equal(r.kraken, 1);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l\'opzione c\'è nel menu del Journal', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const i = src.indexOf('id="journalModeFilterSelect"');
  assert.ok(i > 0, 'il filtro del Journal deve esistere');
  const sel = src.slice(i, i + 1400);
  assert.ok(/<option value="kraken">/.test(sel), 'manca la voce Kraken nel filtro del Journal');
});
