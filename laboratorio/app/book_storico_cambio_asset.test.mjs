// 8.6.20 — PULIZIA DELLO STORICO DEL BOOK AL CAMBIO ASSET.
//
// Portazione in app.html delle 9 prove pure del modulo Forex-Backtest-LAB-Migration,
// piu' due prove di controllo sulle chiavi reali del book (bn:/ext: e simbolo risolto dal
// broker) e una prova d'integrazione: il cambio asset scatenato DAVVERO dal menu #market.
//
// Fonte (MISURATO, cervello/BUG.md, 24 novembre 2026): «cambiando asset, lo storico book
// 12h dell'asset precedente restava in orderBookHistoryByAsset. Causa: nessuna pulizia al
// cambio asset. Cura: fblPulisciBookStoricoAlCambioAsset chiamata sugli switch asset;
// mantiene asset corrente e chiavi reg:». Il 27/11 risultava PERSO.
//
// Le prime nove prove iniettano lo storico dentro la pagina e misurano il comportamento
// delle funzioni esposte dall'app (nessun DOM, localStorage o ponte coinvolto). L'ultima
// prova non chiama la funzione di pulizia a mano: cambia asset nell'app e guarda cosa resta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Lo stesso storico del banco d'origine, con chiavi superficiali, profonde e reg:.
function storicoBase(){
  return {
    XAUUSD:[{time_ms:1},{time_ms:2},{time_ms:3}],
    EURUSD:[{time_ms:10}],
    'bn:BTCUSDT':[{time_ms:20},{time_ms:21}],
    'reg:foo':[{time_ms:30}],
    'reg:bar':[{time_ms:40}],
  };
}

// Serie di prove pure: ogni evaluate riceve lo storico gia' serializzato e restituisce
// solo numeri/stringhe/booleani, così il confronto e' sempre sul comportamento.
async function provaPura(storico, corpo){
  const {browser, pagina, errori} = await apriApp();
  try{
    const esito = await pagina.evaluate(({s, corpo}) => {
      orderBookHistoryByAsset = s;
      // Il corpo e' una funzione scritta come stringa per far passare il codice
      // dentro la pagina senza dipendere da closure del banco.
      return Function('storicoIniziale', 'return (' + corpo + ')(storicoIniziale);')(s);
    }, {s:storico, corpo});
    assert.deepEqual(errori, [], 'nessun errore in pagina');
    return esito;
  } finally { await browser.close(); }
}

// ---- La regola di conservazione --------------------------------------

test('8.6.20: al cambio asset restano solo l’asset corrente e le chiavi reg:', async () => {
  const r = await provaPura(storicoBase(), `function(s){
    const r = fblPulisciBookStoricoAlCambioAsset('EURUSD');
    return {chiavi:Object.keys(orderBookHistoryByAsset).sort(), rimosse:r.rimosse.sort(),
            conservate:r.conservate};
  }`);
  assert.deepEqual(r.chiavi, ['EURUSD', 'reg:bar', 'reg:foo']);
  assert.deepEqual(r.rimosse, ['XAUUSD', 'bn:BTCUSDT']);
  assert.equal(r.conservate, 3);
});

test('8.6.20: eChiaveReg riconosce solo il prefisso esatto reg:', async () => {
  const r = await provaPura(storicoBase(), `function(){
    return ['reg:foo','reg:','xreg:foo','REG:foo',null].map(k=>fblBookStoricoEChiaveReg(k));
  }`);
  assert.deepEqual(r, [true, true, false, false, false]);
});

test('8.6.20: chiaviDaRimuovere è pura e non tocca lo storico', async () => {
  const r = await provaPura(storicoBase(), `function(s){
    const prima = JSON.stringify(s);
    const rimosse = fblBookStoricoChiaviDaRimuovere(s, 'XAUUSD');
    return {rimosse, intatto:JSON.stringify(s)===prima};
  }`);
  assert.deepEqual(r.rimosse, ['EURUSD', 'bn:BTCUSDT']);
  assert.equal(r.intatto, true, 'la funzione che legge le chiavi non muta lo storico');
});

test('8.6.20: le chiavi reg: restano anche se l’asset corrente è un altro', async () => {
  const r = await provaPura(storicoBase(), `function(){
    const r = fblPulisciBookStoricoAlCambioAsset('GBPUSD');
    return {chiavi:Object.keys(orderBookHistoryByAsset).sort(), rimosse:r.rimosse.length};
  }`);
  assert.deepEqual(r.chiavi, ['reg:bar', 'reg:foo']);
  assert.equal(r.rimosse, 3);
});

// ---- Niente danni collaterali ----------------------------------------

test('8.6.20: non sostituisce gli array conservati né l’oggetto globale', async () => {
  const r = await provaPura(storicoBase(), `function(s){
    const oggetto = orderBookHistoryByAsset;
    const eur = s.EURUSD, reg = s['reg:foo'];
    fblPulisciBookStoricoAlCambioAsset('EURUSD');
    return {stessoOggetto:orderBookHistoryByAsset===oggetto,
            stessoArrayEuro:orderBookHistoryByAsset.EURUSD===eur,
            stessoArrayReg:orderBookHistoryByAsset['reg:foo']===reg,
            chiavi:Object.keys(s)};
  }`);
  assert.equal(r.stessoOggetto, true, 'la pulizia e’ in loco, non rimpiazza il magazzino');
  assert.equal(r.stessoArrayEuro, true, 'stesso array, non una copia');
  assert.equal(r.stessoArrayReg, true, 'stesso array, non una copia');
  assert.deepEqual(r.chiavi.sort(), ['EURUSD', 'reg:bar', 'reg:foo']);
});

test('8.6.20: snapshotRimossi conta i dati liberati, non solo le chiavi', async () => {
  const r = await provaPura(storicoBase(), `function(){
    return fblPulisciBookStoricoAlCambioAsset('EURUSD').snapshotRimossi;
  }`);
  assert.equal(r, 5, '3 di XAUUSD + 2 di bn:BTCUSDT');
});

test('8.6.20: ripulire due volte non rimuove niente la seconda volta', async () => {
  const r = await provaPura(storicoBase(), `function(){
    fblPulisciBookStoricoAlCambioAsset('EURUSD');
    const prima = Object.keys(orderBookHistoryByAsset).sort();
    const secondo = fblPulisciBookStoricoAlCambioAsset('EURUSD');
    return {rimosse:secondo.rimosse, snapshot:secondo.snapshotRimossi,
            chiavi:Object.keys(orderBookHistoryByAsset).sort(), prima};
  }`);
  assert.deepEqual(r.rimosse, []);
  assert.equal(r.snapshot, 0);
  assert.deepEqual(r.chiavi, r.prima);
});

// ---- Valori mancanti --------------------------------------------------

test('8.6.20: senza asset corrente restano solo le chiavi reg:', async () => {
  const r = await provaPura(storicoBase(), `function(){
    fblPulisciBookStoricoAlCambioAsset(null);
    return Object.keys(orderBookHistoryByAsset).sort();
  }`);
  assert.deepEqual(r, ['reg:bar', 'reg:foo']);
});

test('8.6.20: storico assente o malformato non lancia', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      orderBookHistoryByAsset = null;
      const vuoto = fblPulisciBookStoricoAlCambioAsset('XAUUSD');
      const esitoVuoto = {chiavi:Object.keys(orderBookHistoryByAsset), rimosse:vuoto.rimosse,
        conservate:vuoto.conservate, snapshot:vuoto.snapshotRimossi};
      orderBookHistoryByAsset = {XAUUSD:'non un array', EURUSD:null};
      const male = fblPulisciBookStoricoAlCambioAsset('EURUSD');
      let nonLancia = true;
      try{ fblBookStoricoChiaviDaRimuovere(undefined, undefined); }catch(e){ nonLancia = false; }
      return {esitoVuoto, maleChiavi:Object.keys(orderBookHistoryByAsset),
              maleSnapshot:male.snapshotRimossi, nonLancia};
    });
    assert.deepEqual(r.esitoVuoto, {chiavi:[], rimosse:[], conservate:0, snapshot:0});
    assert.deepEqual(r.maleChiavi, ['EURUSD']);
    assert.equal(r.maleSnapshot, 0);
    assert.equal(r.nonLancia, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ---- Chiavi REALI dell'asset corrente (difetto trovato in revisione) ---

test('8.6.20: la chiave profonda bn:BTCUSDT resta con l’etichetta BINANCE:BTCUSDT', async () => {
  const r = await provaPura({
    'BINANCE:BTCUSDT':[{time_ms:1}],
    'bn:BTCUSDT':[{time_ms:2},{time_ms:3},{time_ms:4}],
    'ext:BTCUSDT':[{time_ms:5}],
    XAUUSD:[{time_ms:6}],
    'reg:foo':[{time_ms:7}],
  }, `function(s){
    const deep = s['bn:BTCUSDT'], ext = s['ext:BTCUSDT'];
    const out = fblPulisciBookStoricoAlCambioAsset('BINANCE:BTCUSDT');
    return {
      chiavi: Object.keys(orderBookHistoryByAsset).sort(),
      rimosse: out.rimosse.sort(),
      stessoDeep: orderBookHistoryByAsset['bn:BTCUSDT'] === deep,
      stessoExt: orderBookHistoryByAsset['ext:BTCUSDT'] === ext,
      snapshot: out.snapshotRimossi,
    };
  }`);
  assert.deepEqual(r.chiavi, ['BINANCE:BTCUSDT', 'bn:BTCUSDT', 'ext:BTCUSDT', 'reg:foo'],
    'lo storico profondo dell’asset corrente non va cancellato');
  assert.deepEqual(r.rimosse, ['XAUUSD']);
  assert.equal(r.stessoDeep, true, 'gli snapshot profondi restano gli stessi array');
  assert.equal(r.stessoExt, true, 'anche la chiave ext: corrispondente resta');
  assert.equal(r.snapshot, 1, 'viene conteggiato solo il vecchio asset rimosso');
});

test('8.6.20: resta il simbolo risolto dal broker (XAUUSD → XAUUSDm)', async () => {
  const r = await provaPura({
    XAUUSD:[{time_ms:1}],
    XAUUSDm:[{time_ms:2},{time_ms:3}],
    EURUSD:[{time_ms:4}],
    'reg:foo':[{time_ms:5}],
  }, `function(s){
    // Il broker risolve XAUUSD in XAUUSDm e mette la risoluzione in cache, esattamente come
    // fa resolveMt5SymbolForAsset() nel loader Live.
    mt5FeedSymbolForAsset['XAUUSD'] = 'XAUUSDm';
    const risolto = s['XAUUSDm'];
    const out = fblPulisciBookStoricoAlCambioAsset('XAUUSD');
    return {
      chiavi: Object.keys(orderBookHistoryByAsset).sort(),
      rimosse: out.rimosse.sort(),
      stessoRisolto: orderBookHistoryByAsset['XAUUSDm'] === risolto,
      snapshot: out.snapshotRimossi,
    };
  }`);
  assert.deepEqual(r.chiavi, ['XAUUSD', 'XAUUSDm', 'reg:foo'],
    'la chiave del simbolo risolto e’ dell’asset corrente, non va rimossa');
  assert.deepEqual(r.rimosse, ['EURUSD']);
  assert.equal(r.stessoRisolto, true, 'lo storico del simbolo risolto resta lo stesso array');
  assert.equal(r.snapshot, 1);
});

// ---- Integrazione: vero cambio asset dal menu -------------------------

test('8.6.20: cambiando asset dal menu, la chiave vecchia sparisce e reg: resta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      currentAssetKey = 'XAUUSD';
      liveModeActive = false;
      liveReplayActive = false;
      orderBookHistoryByAsset = {
        XAUUSD:[{time_ms:1},{time_ms:2}],
        EURUSD:[{time_ms:3}],
        'reg:foo':[{time_ms:4}],
        'bn:BTCUSDT':[{time_ms:5}],
      };
      const vecchio = orderBookHistoryByAsset.XAUUSD;
      const reg = orderBookHistoryByAsset['reg:foo'];
      const sel = document.getElementById('market');
      if(sel){
        if(!Array.from(sel.options).some(o=>o.value==='EURUSD')){
          const opt = document.createElement('option');
          opt.value = 'EURUSD'; opt.textContent = 'EURUSD';
          sel.appendChild(opt);
        }
        sel.value = 'EURUSD';
        sel.dispatchEvent(new Event('change'));
      }
      await new Promise(res=>setTimeout(res,200));
      return {
        selezione: sel ? sel.value : null,
        assetCorrente: currentAssetKey,
        chiavi: Object.keys(orderBookHistoryByAsset).sort(),
        stessaChiaveNuova: orderBookHistoryByAsset.EURUSD && orderBookHistoryByAsset.EURUSD.length===1,
        stessoArrayReg: orderBookHistoryByAsset['reg:foo']===reg,
        arrayVecchioIntatto: vecchio.length===2,
      };
    });
    assert.equal(r.selezione, 'EURUSD', 'il banco deve aver scelto EURUSD nel menu');
    assert.equal(r.assetCorrente, 'EURUSD', 'l’app deve aver cambiato asset davvero');
    assert.deepEqual(r.chiavi, ['EURUSD', 'reg:foo'],
      'lo storico del vecchio asset (e bn:BTCUSDT) non deve restare in memoria');
    assert.equal(r.stessaChiaveNuova, true);
    assert.equal(r.stessoArrayReg, true, 'le chiavi reg: non vanno sostituite');
    assert.equal(r.arrayVecchioIntatto, true, 'non si mutano gli array, si rimuove solo la chiave');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
