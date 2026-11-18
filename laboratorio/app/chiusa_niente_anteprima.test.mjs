// CHIUSA LA POSIZIONE, IL GRAFICO RESTA PULITO: NESSUNA ANTEPRIMA DI ORDINE.
//
// SEGNALATO dal proprietario (18 novembre 2026): «seleziono la posizione, dalla tendina a sinistra
// la chiudo, in modalita' tutto schermo. Quando clicco chiudi, mi genera automaticamente una
// preview del livello di stop loss e take profit, in maniera totalmente inutile. Chiudo la
// posizione e basta: il grafico e' pulito, non mi deve fare nessuna preview. Succede ogni volta.»
//
// CAUSA, letta nel codice: selezionando una posizione, i suoi livelli finiscono nelle caselle SL e
// TP della barra (sono quelle che permettono di modificarli). Alla chiusura la posizione sparisce
// e `active` diventa nullo, ma le CASELLE restano piene - e il disegno ha un ramo «se non c'e' una
// posizione attiva e le caselle hanno dei numeri, mostra l'anteprima dell'ordine che stai per
// aprire» (`ownerKey:'draft:market'`). Quei numeri pero' non sono una bozza: sono l'eco della
// posizione appena chiusa.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SCENA = `(() => {
  const R = []; const t0 = Date.now() - 60 * 60000;
  for (let i = 0; i < 60; i++) { const p = 100 + i*0.1;
    R.push({date:new Date(t0+i*60000).toISOString(), open:p, high:p+1, low:p-1, close:p, volume:5}); }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length; currentTF = 1;
  currentAssetKey = 'EURUSD'; rowsAssetKey = 'EURUSD';
  csvLibrary = [{id:'mt5_live_EURUSD', rows:R}];
  liveModeActive = false; liveReplayActive = false;
  positions.length = 0; trades.length = 0;
  const pos = {id:'p1', side:'BUY', entry:105, sl:103, tp:109, lots:0.10, asset:'EURUSD',
               openIdx: R.length-5, openedAt: Date.now()-300000};
  positions.push(pos);
  active = pos;
  // la selezione riempie le caselle, come fa l'app quando scegli la posizione
  if($('sl')) $('sl').value = '103';
  if($('tp')) $('tp').value = '109';
  // si registra ogni casella Target/Stop disegnata, con il suo proprietario
  window.__caselle = [];
  const vero = window.drawTpSlZoneBox;
  window.drawTpSlZoneBox = function(ctx, opts){ try{ window.__caselle.push(String(opts && opts.ownerKey)); }catch(e){} return vero.apply(this, arguments); };
  return {posizioni: positions.length, sl: $('sl') ? $('sl').value : null};
})()`;

test('chiusa la posizione, non compare nessuna anteprima di ordine', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const s = await pagina.evaluate(SCENA);
    assert.equal(s.posizioni, 1, 'la scena deve avere una posizione aperta');
    assert.equal(s.sl, '103', 'e le caselle devono essere piene, come dopo la selezione');
    const r = await pagina.evaluate(() => {
      closeTrade('MANUAL', 106, positions[0]);
      window.__caselle = [];
      draw();
      return {anteprime: window.__caselle.filter(k => String(k).indexOf('draft:') === 0),
              caselleDisegnate: window.__caselle,
              sl: $('sl') ? $('sl').value : null, tp: $('tp') ? $('tp').value : null,
              posizioni: positions.length, chiusi: trades.length};
    });
    assert.equal(r.posizioni, 0, 'la posizione deve essere chiusa');
    assert.equal(r.chiusi, 1, 'e finita nel Journal');
    assert.deepEqual(r.anteprime, [],
      'nessuna anteprima deve essere disegnata dopo la chiusura: ' + JSON.stringify(r.caselleDisegnate));
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('GUARDIA: una bozza scritta a mano, senza posizioni, l anteprima la deve avere', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(SCENA);
    const r = await pagina.evaluate(() => {
      positions.length = 0; active = null;
      // l'utente scrive i livelli del prossimo ordine: QUESTA e' una bozza vera
      if($('sl')) $('sl').value = '103';
      if($('tp')) $('tp').value = '109';
      window.__caselle = [];
      draw();
      return window.__caselle.filter(k => String(k).indexOf('draft:') === 0);
    });
    assert.ok(r.length >= 1,
      'con i livelli scritti a mano e nessuna posizione, l\'anteprima serve e deve restare: ' + JSON.stringify(r));
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

// ---------------------------------------------------------------------------------------
// LA STRADA VERA, trovata misurando: `refreshTradeLevelUI()` riempie le caselle da `active`
// SENZA CONTROLLARE che quella posizione sia ancora aperta. Dentro closeTrade l'ordine e':
// svuota le caselle -> ... -> refreshTradeLevelUI(). Se in quel momento `active` punta ancora
// alla posizione appena chiusa, le caselle si RIEMPIONO di nuovo con i suoi livelli; subito
// dopo il giro di MT5 (fetchMt5Positions) azzera `active`, e a quel punto il disegno vede
// «nessuna posizione attiva + caselle piene» = anteprima dell'ordine. Ecco la preview dal
// nulla, e il motivo per cui si vede con le posizioni REALI piu' che con le simulate.
// ---------------------------------------------------------------------------------------
test('le caselle non si riempiono da una posizione che non e piu aperta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(SCENA);
    const r = await pagina.evaluate(() => {
      const pos = positions[0];
      positions.length = 0;          // la posizione non c'e' piu' (chiusa)
      active = pos;                  // ma `active` punta ancora a lei
      if($('sl')) $('sl').value = '';
      if($('tp')) $('tp').value = '';
      refreshTradeLevelUI();
      return {sl: $('sl') ? $('sl').value : null, tp: $('tp') ? $('tp').value : null};
    });
    assert.equal(r.sl, '', "la casella SL deve restare vuota: c'e' <" + r.sl + ">");
    assert.equal(r.tp, '', "la casella TP deve restare vuota: c'e' <" + r.tp + ">");
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('tutta la catena: chiusa la posizione e azzerato active, nessuna anteprima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(SCENA);
    const r = await pagina.evaluate(() => {
      const pos = positions[0];
      closeTrade('MANUAL', 106, pos);
      // il giro di MT5 arriva dopo e azzera la selezione, come nel caso vero
      active = null;
      window.__caselle = [];
      draw();
      return {anteprime: window.__caselle.filter(k => String(k).indexOf('draft:') === 0),
              sl: $('sl') ? $('sl').value : null};
    });
    assert.deepEqual(r.anteprime, [],
      'nessuna anteprima dopo la chiusura, nemmeno quando la selezione si azzera dopo: '
      + JSON.stringify(r.anteprime) + " (casella SL: <" + r.sl + ">)");
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});
