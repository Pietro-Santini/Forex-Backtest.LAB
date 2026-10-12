// LOTTAGGIO per asset FUORI dalla tabella scritta a mano — il caso NZDCHF segnalato dal
// proprietario: rischio 5%, stop 0,5%, ma l'app consigliava un lotto assurdo (112247) con
// "margine insufficiente" e mostrava un profitto del TP di "+0,00 €".
// Causa verificata: il contract size auto-rilevato da Capital.com (instrument.lotSize = 1 per i
// CFD forex) veniva preso alla lettera, mentre il simulatore (e MT5) usano 1 lotto = 100.000
// unità. Con contractSize=1 la perdita per lotto crolla -> lotto enorme e P/L ~0.
// Questi test bloccano la regressione: la dimensione si decide per FAMIGLIA dell'asset.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Riproduce le specifiche che Capital.com dà per NZDCHF: lotSize=1 (CFD forex).
const PREPARA = () => {
  const mk = document.getElementById('market');
  if (mk && ![...mk.options].some(o => o.value === 'NZDCHF')) {
    const o = document.createElement('option'); o.value = 'NZDCHF'; o.textContent = 'NZDCHF'; mk.appendChild(o);
  }
  if (mk) mk.value = 'NZDCHF';
  currentAssetKey = 'NZDCHF';
  assetAutoMeta['NZDCHF'] = {decimals:5, pipDigit:4, contractSize:1, instrType:'CURRENCIES', locked:true};
  document.getElementById('risk').value = '5';
  document.getElementById('pendingEntry').value = '0.46616';
  document.getElementById('sl').value = '0.46383';
};

test('coppia forex con lotSize=1 del broker: 1 lotto resta 100.000 unità (non 1)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(), PREPARA.toString());
    const r = await pagina.evaluate(() => ({
      cs: contractSize('NZDCHF'),
      viaFun: contractSizePerFamiglia('NZDCHF', {contractSize:1, instrType:'CURRENCIES'}),
    }));
    assert.equal(r.cs, 100000, 'NZDCHF deve valere 1 lotto = 100.000 unità');
    assert.equal(r.viaFun, 100000);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('lottaggio consigliato sano e profitto del TP non azzerato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(), PREPARA.toString());
    const r = await pagina.evaluate(() => {
      const s = computeSuggestedLots();
      return {lots: s && s.lots, riskAmount: s && s.riskAmount,
        prof1lot: euroAtLevel(0.46616, 0.46386, 1, 'NZDCHF')};
    });
    assert.ok(Number.isFinite(r.lots), 'il lotto deve essere un numero valido');
    assert.ok(r.lots > 0.01 && r.lots < 50, 'lotto plausibile, non 112247: ' + r.lots);
    assert.ok(Math.abs(r.prof1lot - 230) < 1, 'profitto TP di 1 lotto ≈ 230 €, non ~0: ' + r.prof1lot);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nessuna regressione: cripto=1, oro=100, argento=5000, forex=100000', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => ({
      btc: contractSizePerFamiglia('BINANCE:BTCUSDT', {}),
      xau: contractSizePerFamiglia('XAUUSD', {}),
      xag: contractSizePerFamiglia('XAGUSD', {}),
      eur: contractSizePerFamiglia('EURUSD', {}),
      nzd: contractSizePerFamiglia('NZDCHF', {}),
    }));
    assert.equal(r.btc, 1);
    assert.equal(r.xau, 100);
    assert.equal(r.xag, 5000);
    assert.equal(r.eur, 100000);
    assert.equal(r.nzd, 100000);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
