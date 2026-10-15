// A MERCATO CHIUSO SI FERMA TUTTO, NON SOLO IL DISEGNO.
//
// SEGNALATO dal proprietario: «il comportamento a mercato chiuso — posizioni e footprint
// sfalsati». Erano due sintomi della stessa cosa: tre pezzi dell'app rispondevano in tre modi
// diversi alla domanda «il mercato di questo asset è fermo adesso?».
//   - le CANDELE lo chiedevano al calendario dell'asset (statoMercato) → si fermavano;
//   - il FOOTPRINT lo chiedeva a liveSessionPhaseAt, ma solo dentro `if(mt5Connected)`: senza MT5
//     collegato non lo chiedeva a nessuno → continuava a registrare;
//   - il PREZZO CHE VALUTA LE POSIZIONI non lo chiedeva affatto → continuava a muoversi.
//
// MISURATO sul banco, prima della correzione: con il mercato chiuso un tick a 4080 su un asset in
// sottofondo faceva SCATTARE LO STOP di una posizione (1 posizione aperta → 0), su un prezzo che
// il grafico non ha mai mostrato. Non era un difetto estetico.
//
// Da qui in poi l'autorità è una sola (fblMercatoFermoOra). Questi test la tengono tale.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Prepara una pagina in Live con un asset forex IN SOTTOFONDO (non quello a grafico): è lì che
// mancava ogni controllo.
const PREPARA = () => {
  const t0 = Date.now() - 150*60000; let p = 4100; const R = [];
  for(let i=0;i<150;i++){ const o=p, c=p+Math.sin(i/7)*2; R.push({date:new Date(t0+i*60000).toISOString(),open:o,high:Math.max(o,c)+1,low:Math.min(o,c)-1,close:c,volume:10}); p=c; }
  R[R.length-1].close = 4100;
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; currentAssetKey='EURUSD';
  csvLibrary=[{rows:R}];
  liveModeActive=true; mt5Connected=false; mt5ActiveSymbol=null;
  epicToAsset['GOLD']='XAUUSD';
  capitalWsPrimaryEpic='EURUSD_EPIC';
  livePriceByAsset['XAUUSD']=4100;
  positions=[{id:1,side:'BUY',entry:4100,sl:4090,tp:4200,lots:0.1,asset:'XAUUSD',mt5Ticket:null,
              origin:'MANUAL',startTime:Date.now()-600000}];
};
const CHIUDI_MERCATO = () => {
  orariAsset['XAUUSD']={zona:'UTC',giorni:{mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[]},stato:'CLOSED',letto:Date.now()};
};

test('a mercato chiuso il tick non muove il prezzo che valuta le posizioni', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(${PREPARA})(); (${CHIUDI_MERCATO})();
      applyLiveTick({epic:'GOLD',bid:4080,timestamp:Date.now()});
      ({prezzo: livePriceByAsset['XAUUSD'], chiuso: !!(statoMercato('XAUUSD',Date.now())||{}).chiuso})`);
    assert.equal(r.chiuso, true, 'il banco deve davvero avere il mercato chiuso');
    assert.equal(r.prezzo, 4100, 'il prezzo deve restare l\'ultimo di quando il mercato era aperto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('a mercato chiuso lo stop NON scatta (è il difetto misurato)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(${PREPARA})(); (${CHIUDI_MERCATO})();
      // 4080 è sotto lo stop a 4090: a mercato aperto chiuderebbe la posizione.
      applyLiveTick({epic:'GOLD',bid:4080,timestamp:Date.now()});
      ({aperte: positions.length})`);
    assert.equal(r.aperte, 1, 'la posizione non può chiudersi su un prezzo senza candela');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('a mercato APERTO tutto continua a funzionare come prima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(${PREPARA})();
      delete orariAsset['XAUUSD'];                  // nessun calendario: mercato aperto
      applyLiveTick({epic:'GOLD',bid:4095,timestamp:Date.now()});
      const dopoPrezzo = livePriceByAsset['XAUUSD'];
      applyLiveTick({epic:'GOLD',bid:4080,timestamp:Date.now()});   // sotto lo stop
      ({dopoPrezzo, aperte: positions.length})`);
    assert.equal(r.dopoPrezzo, 4095, 'a mercato aperto il prezzo deve muoversi');
    assert.equal(r.aperte, 0, 'e lo stop deve scattare: la correzione non deve spegnere il motore');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il footprint tace quando la candela non si disegna', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(${PREPARA})(); (${CHIUDI_MERCATO})();
      const prima = (footprintTickLogByAsset['XAUUSD']||[]).length;
      const candela = applyLivePriceToChart(4130, Date.now(), {fromAsset:'XAUUSD'});
      footprintRegisterTick(4130, Date.now(), 'XAUUSD', 1, 'capital');
      ({candela, prima, dopo: (footprintTickLogByAsset['XAUUSD']||[]).length})`);
    assert.equal(r.candela, false, 'la candela non si disegna a mercato chiuso');
    assert.equal(r.dopo, r.prima, 'e allora nemmeno il tick si registra: è la stessa autorità');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le cripto non chiudono mai, e lo storico non si blocca', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(${PREPARA})(); (${CHIUDI_MERCATO})();
      // Una cripto, anche con un calendario appiccicato addosso, non si ferma mai.
      orariAsset['BINANCE:BTCUSDT']=orariAsset['XAUUSD'];
      const cripto = fblMercatoFermoOra('BINANCE:BTCUSDT', Date.now());
      // Fuori dalla Live il tempo lo decide il replay, non l'orologio: non si blocca niente.
      liveModeActive=false;
      const storico = fblMercatoFermoOra('XAUUSD', Date.now());
      ({cripto, storico})`);
    assert.equal(r.cripto, false, 'le cripto sono aperte 24/7');
    assert.equal(r.storico, false, 'in Storico/replay il calendario dell\'orologio non c\'entra');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
