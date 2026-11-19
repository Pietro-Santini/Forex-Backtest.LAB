// UNA POSIZIONE NASCE SULL'ASSET CHE SI STA GUARDANDO.
//
// MISURATO il 19 novembre 2026, mentre si cercava il difetto segnalato dal proprietario («in
// replay apro una posizione e sparisce, e non compare nemmeno nel Trade Journal»):
// `openMarketTrade` prende l'asset dalla tendina dell'interfaccia — `asset: $('market')?.value||''`
// — e NON dall'asset a grafico. Nella scena di prova quella tendina era vuota, e la posizione e'
// nata con `asset: ""`. Da li' in poi spariva da sola: `belongsToCurrentAsset` rispondeva false,
// quindi SL e TP non venivano piu' valutati, il filtro per asset non la mostrava a grafico, e
// nel Journal finiva senza il suo strumento.
//
// NELL'USO NORMALE la tendina viene allineata (sceglie l'asset dalla watchlist e il codice ce lo
// scrive dentro), quindi il piu' delle volte combacia. Ma e' un allineamento che si puo' perdere:
// l'asset puo' arrivare da una finestra duplicata, dal ripristino della sessione, da uno storico
// caricato da file. Quando si perde, la posizione nasce su uno strumento che non e' quello che
// l'utente sta guardando - e sui soldi veri e' un difetto che non si puo' correre.
//
// LA REGOLA: comanda l'asset A GRAFICO. La tendina resta valida solo se dice la stessa cosa.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SCENA = (valoreTendina) => `(() => {
  currentAssetKey = 'XAUUSD'; rowsAssetKey = 'XAUUSD';
  rows = [];
  for (let i = 0; i < 40; i++) {
    const p = 4200 - i * 5;
    rows.push({date: new Date(Date.UTC(2026, 10, 1, 10, i, 0)).toISOString(),
      open: p, high: p + 2, low: p - 2, close: p, volume: 1});
  }
  baseRows = rows.slice();
  csvLibrary = [{id: 'storico_XAUUSD', rows: rows.slice()}];
  idx = 20; viewEnd = 20; visibleCount = 30;
  liveModeActive = false; liveReplayActive = true;
  slTpScanDoneForAsset = currentAssetKey;
  trades = []; equity = []; positions = []; active = null;
  mt5Connected = false;
  realizedBalanceNow = () => 10000;
  window.anotherWindowOwnsAssetEvaluation = () => false;
  try { if (document.getElementById('risk')) document.getElementById('risk').value = '1'; } catch (e) {}
  // La tendina dell'interfaccia: qui si DICHIARA cosa contiene, perche' e' esattamente la cosa
  // che nella realta' puo' essere disallineata.
  const sel = document.getElementById('market');
  if (sel) sel.value = ${JSON.stringify(valoreTendina)};
  return {tendina: sel ? sel.value : null, grafico: currentAssetKey};
})()`;

test('con la tendina vuota, la posizione prende comunque l asset a grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      const scena = ${SCENA('')};
      openMarketTrade('BUY');
      const p = positions[0] || null;
      return {scena, asset: p ? p.asset : null,
              riconosciuta: p ? !!belongsToCurrentAsset(p) : null,
              quante: positions.length};
    })()`);

    assert.equal(r.scena.tendina, '', 'premessa: la tendina e vuota');
    assert.equal(r.quante, 1, 'la posizione deve aprirsi');
    assert.equal(r.asset, 'XAUUSD',
      'la posizione e nata con asset «' + r.asset + '» invece di quello a grafico: da li in poi sparisce dai filtri');
    assert.equal(r.riconosciuta, true,
      'con l asset sbagliato la posizione non viene nemmeno riconosciuta come dell asset a grafico');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con la tendina su un ALTRO strumento, comanda sempre il grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      const scena = ${SCENA('EURUSD')};
      openMarketTrade('SELL');
      const p = positions[0] || null;
      return {scena, asset: p ? p.asset : null, riconosciuta: p ? !!belongsToCurrentAsset(p) : null};
    })()`);

    assert.equal(r.scena.tendina, 'EURUSD', 'premessa: la tendina dice un altro strumento');
    assert.equal(r.asset, 'XAUUSD',
      'a grafico c e XAUUSD: la posizione non puo nascere su ' + r.asset);
    assert.equal(r.riconosciuta, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('e la posizione nata in replay resta: viene valutata, non sparisce', async () => {
  // La conseguenza pratica, che e' il motivo per cui questo banco esiste: una posizione con
  // l'asset giusto passa i filtri, quindi resta a grafico e il suo SL/TP viene valutato con la
  // candela del replay - non con il prezzo di oggi.
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      ${SCENA('')};
      openMarketTrade('BUY');
      const prima = positions.length;
      evaluate(); draw(); update();
      for (let k = 0; k < 3; k++) { idx++; evaluate(); }
      return {prima, dopo: positions.length, chiuse: trades.length,
              asset: positions[0] ? positions[0].asset : null};
    })()`);

    assert.equal(r.prima, 1, 'premessa: la posizione si e aperta');
    assert.equal(r.dopo, 1, 'dopo qualche candela di replay la posizione deve essere ancora li');
    assert.equal(r.chiuse, 0, 'e non deve essersi chiusa da sola');
    assert.equal(r.asset, 'XAUUSD');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
