// IL MERCATO SI DECIDE DAL PASSAGGIO DATI, NON DALL'ORARIO SCRITTO A MANO.
//
// RICHIESTA DEL PROPRIETARIO (10 novembre 2026): «collegarsi per ogni asset al terminale MT5,
// cosi' che capisce in maniera automatica quando il mercato e' aperto e quando e' chiuso. Se un
// asset chiude alle 23, l'applicazione non riceve piu' dati da quell'asset e quindi lo definisce
// mercato chiuso. Se MT5 continua a dare dati per l'aggiornamento delle candele, il mercato e'
// aperto; dal momento che si interrompe, il mercato e' chiuso».
//
// Questo banco apre l'app vera, fa aprire il canale MT5 (quello finto del laboratorio, che ora
// sa consegnare messaggi) e misura la risposta di fblMercatoFermoOra nei tre casi: tick fresco,
// silenzio breve, silenzio lungo. Misura anche che il battito (heartbeat) NON conti come dato.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = `(function(){
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD';
  liveModeActive=true; liveReplayActive=false;
  mt5Connected=true; mt5ActiveSymbol='XAUUSD';
  // niente calendario e niente cache MT5: devono contare SOLO i dati che arrivano
  Object.keys(fblMercatoMt5Cache).forEach(k=>delete fblMercatoMt5Cache[k]);
  mt5UltimoTickPerAsset={};
  window.__prima=window.__wsFinti?window.__wsFinti.length:0;
  connectMt5Stream('XAUUSD');
  return true;
})()`;

const CANALE = `(function(){
  const L=window.__wsFinti||[];
  return {n:L.length, url:L.length?L[L.length-1].url:null};
})()`;

test('col tick che arriva il mercato è APERTO, col silenzio lungo è CHIUSO', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA);
    const ch = await pagina.evaluate(CANALE);
    assert.ok(ch.n > 0, 'il canale MT5 deve essere stato aperto: ' + JSON.stringify(ch));

    // 1. arriva un tick vero -> il feed è vivo -> mercato aperto
    let r = await pagina.evaluate(`(function(){
      const L=window.__wsFinti; const ws=L[L.length-1];
      ws.__consegna({bid:4130.5, ask:4130.9, time_ms:Date.now(), volume:1});
      return {registrato:mt5UltimoTickPerAsset['XAUUSD'],
              fermo:fblMercatoFermoOra('XAUUSD', Date.now())};
    })()`);
    assert.ok(r.registrato && Number.isFinite(r.registrato.at),
      'il tick deve finire nella mappa per asset: ' + JSON.stringify(r));
    assert.equal(r.fermo, false, 'col tick che arriva il mercato deve risultare APERTO');

    // 2. silenzio di 2 minuti: sotto la soglia, il mercato resta aperto
    r = await pagina.evaluate(`(function(){
      mt5UltimoTickPerAsset['XAUUSD']={at:Date.now()-2*60000, prezzo:4130.5};
      return fblMercatoFermoOra('XAUUSD', Date.now());
    })()`);
    assert.equal(r, false, 'due minuti di silenzio non chiudono il mercato');

    // 3. silenzio di 6 minuti: oltre la soglia, il mercato è CHIUSO
    r = await pagina.evaluate(`(function(){
      mt5UltimoTickPerAsset['XAUUSD']={at:Date.now()-6*60000, prezzo:4130.5};
      return {fermo:fblMercatoFermoOra('XAUUSD', Date.now()),
              fase:liveSessionPhaseAt(Date.now())};
    })()`);
    assert.equal(r.fermo, true,
      'sei minuti senza dati devono dire MERCATO CHIUSO (prima lo decideva solo l\'orario: ' + r.fase + ')');

    // 4. PROVA DI CONTROLLO: senza nessun dato registrato la risposta torna quella di prima
    //    (orario/calendario): la cura non deve inventare niente dove non sa.
    r = await pagina.evaluate(`(function(){
      delete mt5UltimoTickPerAsset['XAUUSD'];
      return fblMercatoFermoOra('XAUUSD', Date.now());
    })()`);
    assert.equal(typeof r, 'boolean', 'senza dati registrati la funzione risponde come prima');

    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});

test('il battito del canale NON è un dato: non tiene il mercato aperto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA);
    const r = await pagina.evaluate(`(function(){
      const L=window.__wsFinti; const ws=L[L.length-1];
      ws.__consegna({heartbeat:true});
      return {registrato:mt5UltimoTickPerAsset['XAUUSD']||null,
              tickAt:lastMt5TickAt, reale:lastMt5RealTickAt};
    })()`);
    assert.equal(r.registrato, null,
      'il battito non deve registrare un tick: il ponte lo manda ogni 2 secondi anche a mercato chiuso');
    assert.ok(r.tickAt > 0, 'il battito resta prova di vita del canale (come prima)');
    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});

test('anche un asset in watchlist (non a grafico) viene seguito', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD';
      liveModeActive=true; mt5Connected=true; mt5ActiveSymbol='XAUUSD';
      Object.keys(fblMercatoMt5Cache).forEach(k=>delete fblMercatoMt5Cache[k]); mt5UltimoTickPerAsset={};
      window.__prima=window.__wsFinti?window.__wsFinti.length:0;
      connectMt5BackgroundStream('EURUSD','EURUSD');
      const L=window.__wsFinti; const ws=L[L.length-1];
      ws.__consegna({bid:1.0875, ask:1.0876, time_ms:Date.now(), volume:1});
      const vivo=!!(mt5UltimoTickPerAsset['EURUSD']);
      mt5UltimoTickPerAsset['EURUSD']={at:Date.now()-9*60000, prezzo:1.0875};
      return {vivo:vivo, chiuso:fblMercatoFermoOra('EURUSD', Date.now())};
    })()`);
    assert.equal(r.vivo, true, 'il tick di watchlist deve finire nella mappa per asset');
    assert.equal(r.chiuso, true, 'nove minuti di silenzio su EURUSD devono dire CHIUSO');
    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});
