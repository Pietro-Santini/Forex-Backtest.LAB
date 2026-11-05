// LAVORO 2 — CANDELE IN LOCALE. Misura il COMPORTAMENTO: quanto si chiede al servizio
// dati (un numero piccolo quando c'è la copia locale, 200000 quando non c'è) e cosa
// finisce nel grafico (lo storico completo, mai una coda corta).
//
// Perche' conta: senza questa cura, a ogni cambio asset/timeframe l'app riscaricava
// 5 MB (50000 candele). Il pericolo della cura è l'OPPOSTO: mostrare una coda corta
// come se fosse tutto lo storico. Le prove qui sotto coprono entrambi i versi.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Definizioni iniettate DENTRO la pagina: candeleDa e cachedRows devono vedersi tra loro.
const DEFS = `
  function candeleDa(t0, n, base){
    base = base||4161; var out=[];
    for(var i=0;i<n;i++){ var p=base+i*0.01; out.push({time:t0+i*60, open:p, high:p+0.5, low:p-0.5, close:p, tick_volume:10}); }
    return out;
  }
  function cachedRows(t0, n, base){
    return candeleDa(t0, n, base).map(function(c){
      return {time:c.time, date:new Date(c.time*1000).toISOString(), open:c.open, high:c.high, low:c.low, close:c.close, volume:c.tick_volume};
    });
  }
`;

// Istalla un fetch finto che registra il count richiesto e risponde con le candele dal corpo dato.
function istallaFetch(corpo){
  return `(function(){
    var reale = window.fetch;
    window.__count = [];
    window.fetch = function(url){
      var u=String(url);
      var m=u.match(/count=(\\d+)/);
      var count=m?Number(m[1]):null;
      if(count!=null) window.__count.push(count);
      var candles = (function(count){ ${corpo} })(count);
      return Promise.resolve({ok:true, status:200, json:function(){ return Promise.resolve({candles:candles, digits:2}); }});
    };
    return reale;
  })()`;
}

(async () => {
test('copertura: senza magazzino locale chiede lo storico intero (count=200000)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      ${DEFS}
      mt5FeedSymbolForAsset['XAUUSD']='XAUUSD';
      window.fblCandeleCacheLeggi = async () => null;
      window.fblCandeleCacheScrivi = async () => true;
      var t0 = (Date.now()/1000) - 60*60;
      window.__cand = candeleDa(t0, 60);
      var reale = (${istallaFetch('return window.__cand;')})();
      csvLibrary = []; currentAssetKey='XAUUSD'; liveModeActive=true;
      await loadLiveHistoryFromMt5('XAUUSD', {});
      window.fetch = reale;
      var f = csvLibrary[0]||{};
      return {counts: window.__count, righe: f.rows?f.rows.length:0};
    })()`);
    assert.deepEqual(r.counts, [200000], 'senza copia locale deve chiedere lo storico intero');
    assert.equal(r.righe, 60);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con magazzino locale coerente chiede solo la coda (count piccolo) e conserva lo storico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      ${DEFS}
      mt5FeedSymbolForAsset['XAUUSD']='XAUUSD';
      var t0 = (Date.now()/1000) - 60*60;
      var cached = cachedRows(t0, 60);
      var ultimo = cached[cached.length-1];
      window.fblCandeleCacheLeggi = async () => ({rows:cached, digits:2, ultimoTs:ultimo.time, salvatoAt:Date.now()});
      window.fblCandeleCacheScrivi = async () => true;
      // coda coerente: stessa serie da t0, a partire dall'ultima candela locale (indice 59) => 6 candele
      window.__coda = candeleDa(t0, 65).slice(59);
      var reale = (${istallaFetch('return window.__coda;')})();
      csvLibrary = []; currentAssetKey='XAUUSD'; liveModeActive=true;
      await loadLiveHistoryFromMt5('XAUUSD', {});
      window.fetch = reale;
      var f = csvLibrary[0]||{};
      var righe = f.rows||[];
      return {counts: window.__count, righe: righe.length,
              doppioni: righe.length - new Set(righe.map(x=>x.date)).size};
    })()`);
    assert.equal(r.counts[0] < 200000, true, 'con copia locale deve chiedere un count piccolo');
    assert.equal(r.righe, 65, 'storico = 60 in locale + 5 nuove');
    assert.equal(r.doppioni, 0, 'nessun doppione: la sovrapposizione non si duplica');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l\'OHLC salvato non torna: rifà lo scarico intero, mai una coda corta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      ${DEFS}
      mt5FeedSymbolForAsset['XAUUSD']='XAUUSD';
      var t0 = (Date.now()/1000) - 60*60;
      var cached = cachedRows(t0, 60);
      var ultimo = cached[cached.length-1];
      window.fblCandeleCacheLeggi = async () => ({rows:cached, digits:2, ultimoTs:ultimo.time, salvatoAt:Date.now()});
      window.fblCandeleCacheScrivi = async () => true;
      // coda che combacia per DATA sulla sovrapposizione ma con OHLC diverso
      var coda = candeleDa(t0, 65).slice(59);
      coda[0].open = 9999; coda[0].close = 9999;
      window.__coda = coda;
      window.__pieno = candeleDa(t0, 300);
      var reale = (${istallaFetch('return count>=200000 ? window.__pieno : window.__coda;')})();
      csvLibrary = []; currentAssetKey='XAUUSD'; liveModeActive=true;
      await loadLiveHistoryFromMt5('XAUUSD', {});
      window.fetch = reale;
      var f = csvLibrary[0]||{};
      return {counts: window.__count, righe: (f.rows||[]).length};
    })()`);
    assert.equal(r.counts[0] < 200000, true, 'la prima richiesta è la coda piccola');
    assert.equal(r.counts[1], 200000, 'se la sovrapposizione non torna deve rifare lo scarico intero');
    assert.equal(r.righe, 300, 'lo storico finale è quello intero, non la coda');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
})();