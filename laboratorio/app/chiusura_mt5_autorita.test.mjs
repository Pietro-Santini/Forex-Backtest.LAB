import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

async function prepara(pagina) {
  await pagina.evaluate(() => {
    liveModeActive = true;
    mt5Connected = true;
    currentAssetKey = 'XAUUSD';
    mt5ActiveSymbol = 'XAUUSD';
    liveSessionPhase = 'mt5';
    liveSessionBusy = false;
    liveOffSessionSavedAt = 0;
    fblNotteMt5 = false;
    // Stato "feed vivo" minimo: timer presente, niente freeze.
    mt5RefreshTimer = mt5RefreshTimer || setInterval(() => {}, 60000);
    // Tick non recenti: simula WS dei tick spento, ma broker aperto.
    if (typeof mt5UltimoTickPerAsset === 'object') mt5UltimoTickPerAsset['XAUUSD'] = {at: 0, prezzo: 0};
    lastMt5TickAt = 0;
    lastMt5RealTickAt = 0;
  });
}

test('dopo l\'orario di chiusura, se MT5 dice trade_allowed=true il feed non viene congelato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina);
    const r = await pagina.evaluate(async () => {
      const freezeCalls = [];
      const origFreeze = liveSessionFreezeMt5;
      const origNow = liveSessionPhaseNow;
      const origNoto = fblMercatoMt5Noto;
      const origDomanda = fblMercatoMt5Domanda;
      const origRiceve = fblAssetRiceveDatiOra;
      try {
        liveSessionPhaseNow = () => 'closed';
        fblAssetRiceveDatiOra = () => false;
        fblMercatoMt5Noto = () => true;
        fblMercatoMt5Domanda = async () => true;
        liveSessionFreezeMt5 = async (ph) => { freezeCalls.push(ph); };
        await liveSessionTick();
        await liveSessionTick();
      } finally {
        liveSessionPhaseNow = origNow;
        fblMercatoMt5Noto = origNoto;
        fblMercatoMt5Domanda = origDomanda;
        fblAssetRiceveDatiOra = origRiceve;
        liveSessionFreezeMt5 = origFreeze;
      }
      return {
        freezeCalls,
        phase: liveSessionPhase,
        mt5ActiveSymbol,
        timerVivo: !!mt5RefreshTimer,
      };
    });
    assert.deepEqual(r.freezeCalls, [], 'non deve congelare il feed se MT5 riporta mercato aperto');
    assert.equal(r.phase, 'mt5', 'la fase deve restare mt5');
    assert.equal(r.mt5ActiveSymbol, 'XAUUSD', 'mt5ActiveSymbol non deve essere azzerato');
    assert.equal(r.timerVivo, true, 'il timer del feed deve restare vivo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se MT5 dice trade_allowed=false, il freeze orario avviene normalmente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina);
    const r = await pagina.evaluate(async () => {
      const freezeCalls = [];
      const origFreeze = liveSessionFreezeMt5;
      const origNow = liveSessionPhaseNow;
      const origNoto = fblMercatoMt5Noto;
      const origDomanda = fblMercatoMt5Domanda;
      const origRiceve = fblAssetRiceveDatiOra;
      try {
        liveSessionPhaseNow = () => 'closed';
        fblAssetRiceveDatiOra = () => false;
        fblMercatoMt5Noto = () => false;
        fblMercatoMt5Domanda = async () => false;
        liveSessionFreezeMt5 = async (ph) => { freezeCalls.push(ph); liveSessionPhase = 'closed'; };
        await liveSessionTick();
      } finally {
        liveSessionPhaseNow = origNow;
        fblMercatoMt5Noto = origNoto;
        fblMercatoMt5Domanda = origDomanda;
        fblAssetRiceveDatiOra = origRiceve;
        liveSessionFreezeMt5 = origFreeze;
      }
      return {freezeCalls, phase: liveSessionPhase};
    });
    assert.deepEqual(r.freezeCalls, ['closed'], 'con trade_allowed=false il freeze deve avvenire');
    assert.equal(r.phase, 'closed');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se gia in fase closed ma MT5 torna tradabile, il grafico si riapre', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await prepara(pagina);
    const r = await pagina.evaluate(async () => {
      let riaperture = 0;
      const origNow = liveSessionPhaseNow;
      const origNoto = fblMercatoMt5Noto;
      const origDomanda = fblMercatoMt5Domanda;
      const origRiceve = fblAssetRiceveDatiOra;
      const origRiapri = fblRiaperturaMt5;
      try {
        liveSessionPhase = 'closed';
        mt5ActiveSymbol = null;
        fblNotteMt5 = true;
        liveSessionPhaseNow = () => 'closed';
        fblAssetRiceveDatiOra = () => false;
        fblMercatoMt5Noto = () => true;
        fblMercatoMt5Domanda = async () => true;
        fblRiaperturaMt5 = async () => { riaperture++; liveSessionPhase = 'mt5'; fblNotteMt5 = false; return true; };
        await liveSessionTick();
      } finally {
        liveSessionPhaseNow = origNow;
        fblMercatoMt5Noto = origNoto;
        fblMercatoMt5Domanda = origDomanda;
        fblAssetRiceveDatiOra = origRiceve;
        fblRiaperturaMt5 = origRiapri;
      }
      return {riaperture, phase: liveSessionPhase};
    });
    assert.equal(r.riaperture, 1, 'deve tentare la riapertura MT5 quando il broker torna tradabile');
    assert.equal(r.phase, 'mt5');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
