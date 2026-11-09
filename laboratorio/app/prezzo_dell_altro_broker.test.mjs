// IL PENNELLO DEL PREZZO NON DEVE PRENDERE IL PREZZO DALL'ALTRO BROKER.
//
// SEGNALATO dal proprietatore (9 novembre 2026, con una foto): «al caricamento dello stesso
// asset si rompe e diventa così... ci sono problemi multipli». Nella foto: candele da 5m con
// ampiezze di 20-30 punti (quando sono di 2-3) e code lunghissime.
//
// CAUSA MISURATA (indagine dell'8-9 novembre, due banchi, senza correggere niente): "ricaduta"
// = grafico su Capital.com (file capital_live_), si riseleziona lo STESSO asset e il caricatore
// MT5 sostituisce la libreria con i dati MT5 - ma NON azzera né capitalWsPrimaryEpic né
// lastPrimaryEpicPrice. Il pennello da 250 ms sceglie il prezzo con «chi ha preso il grafico»
// (mt5ActiveSymbol) e «quale prezzo c'è», MAI con «di quale broker è il file a grafico». Da cui:
// ampiezza della candela 2,86 -> 67,2 (22 volte), fascia visibile 20,81 -> 82,19. La candela
// rotta non torna più indietro perché high/low non si restringono mai. Il difetto opposto
// (prezzo MT5 su grafico Capital.com) misura uguale: 67,75 in 2,2 secondi.
//
// fromAsset non distingue niente qui: MT5 e Capital.com usano lo STESSO nome asset ("XAUUSD") e
// quotano lo stesso oro a circa 66 punti di distanza - numero misurato dal proprietatore il 15
// ottobre 2026.
//
// Il test misura il COMPORTAMENTO sull'ultima candela: ampiezza e fascia devono restare di UN
// livello solo, in tutti e due i versi.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// 288 candele da 5m al livello MT5 (4186), come le manda il ponte.
const SERIE_MT5 = `(function(){
  const t0=Date.UTC(2026,10,6,15,0,0); const R=[]; let p=4186;
  for(let i=0;i<288;i++){ const o=p,c=p+Math.sin(i/11)*0.35;
    R.push({date:new Date(t0+i*300000).toISOString(),open:o,high:o+0.35,low:Math.min(o,c)-0.05,close:c,volume:10+(i%7)}); p=c; }
  return R;
})()`;

const METTI = `(function(){
  currentAssetKey='XAUUSD'; currentTF=5; masterTime=Date.UTC(2026,10,6,20,59,0);
  liveModeActive=true; liveReplayActive=false; mt5Connected=true;
  const fuori={};
  // La candela rotta si misura sull'ULTIMA riga della libreria, dove il pennello scrive.
  fuori.ampiezza=function(){ const r=csvLibrary[0].rows[csvLibrary[0].rows.length-1]; return Number(r.high)-Number(r.low); };
  fuori.fascia=function(){ let a=-Infinity,b=Infinity;
    csvLibrary[0].rows.forEach(function(r){ if(Number(r.high)>a)a=Number(r.high); if(Number(r.low)<b)b=Number(r.low); });
    return a-b; };
  fuori.righe=function(){ return csvLibrary[0].rows.length; };
  return fuori;
})()`;

test("il prezzo dell'altro broker non entra nella candela (grafico MT5, prezzo Capital.com)", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      const M=${METTI};
      // Il grafico è MT5...
      csvLibrary=[{id:'mt5_live_XAUUSD',rows:${SERIE_MT5}}];
      rebuildBaseRowsFromLibrary(); rebuildRows();
      const giusteAmpiezza=M.ampiezza();
      const fasciaPrima=M.fascia();
      // ...e in memoria resta il prezzo dell'ALTRO broker, com'è misurato sul PC.
      lastPrimaryEpicPrice=4122.92; lastPrimaryEpicPriceAsset='XAUUSD';
      mt5ActiveSymbol='XAUUSD'; lastMt5TickPrice=null;
      liveSessionPhaseNow=function(){ return 'mt5'; };
      statoMercato=function(){ return null; };
      // Il pennello lavora sull'istante della fonte: lo si mette DENTRO l'ultima candela, come
      // succede dal vero (un tick che arriva mentre la candela e' ancora aperta).
      const veroNow=Date.now;
      const dentroUltima=parseDateTime(csvLibrary[0].rows[csvLibrary[0].rows.length-1].date)+120000;
      Date.now=function(){ return dentroUltima; };
      mt5Adesso=function(){ return dentroUltima; };
      // Il pennello da 250 ms, come gira davvero.
      fblPitturaPrezzoFine();
      Date.now=veroNow;
      return {giusteAmpiezza, fasciaPrima, dopoAmpiezza:M.ampiezza(), dopoFascia:M.fascia(),
              righe:M.righe(), prezzoUltima:csvLibrary[0].rows[csvLibrary[0].rows.length-1].close};
    })()`);
    assert.ok(r.giusteAmpiezza < 2, 'la candela sana deve essere bassa: ' + JSON.stringify(r));
    assert.ok(r.dopoAmpiezza <= r.giusteAmpiezza * 2.5,
      'il prezzo di Capital.com non deve allargare la candela MT5 (misurato prima della cura:'
      + ' 2,86 -> 67,2, e la candela rotta non tornava piu\' indietro): ' + JSON.stringify(r));
    assert.ok(Math.abs(r.dopoFascia - r.fasciaPrima) < 0.0001,
      'e la fascia visibile non deve cambiare (misurato prima della cura: 20,81 -> 82,19, cioe'
      + ' due livelli dentro le stesse candele): ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("il prezzo MT5 non entra nella candela (grafico Capital.com, prezzo MT5)", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      const M=${METTI};
      csvLibrary=[{id:'capital_live_XAUUSD',rows:${SERIE_MT5}}];
      rebuildBaseRowsFromLibrary(); rebuildRows();
      const buona=M.ampiezza();
      lastPrimaryEpicPrice=null; lastPrimaryEpicPriceAsset=null;
      mt5ActiveSymbol='XAUUSD'; lastMt5TickPrice=4187.95;
      liveSessionPhaseNow=function(){ return 'mt5'; };
      statoMercato=function(){ return null; };
      // Stesso orologio della prova qui sopra: dentro l'ultima candela, come dal vero.
      const veroNow=Date.now;
      const dentroUltima=parseDateTime(csvLibrary[0].rows[csvLibrary[0].rows.length-1].date)+120000;
      Date.now=function(){ return dentroUltima; };
      mt5Adesso=function(){ return dentroUltima; };
      fblPitturaPrezzoFine();
      Date.now=veroNow;
      return {buona, dopo:M.ampiezza(), fascia:M.fascia()};
    })()`);
    assert.ok(r.dopo <= r.buona * 2.5,
      'il prezzo di MT5 non deve allargare la candela Capital.com (misurato: 67,75 in 2,2 secondi'
      + ' nell\'altro verso): ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("PROVA DI CONTROLLO: il prezzo del broker GIUSTO continua ad aggiornare la candela", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // La cura non deve spegnere l'aggiornamento normale: col prezzo della fonte che sta
    // disegnando il grafico la candela si deve aggiornare come prima.
    const r = await pagina.evaluate(`(() => {
      const M=${METTI};
      csvLibrary=[{id:'mt5_live_XAUUSD',rows:${SERIE_MT5}}];
      rebuildBaseRowsFromLibrary(); rebuildRows();
      const prima=csvLibrary[0].rows[csvLibrary[0].rows.length-1].close;
      mt5ActiveSymbol='XAUUSD'; lastMt5TickPrice=4190.00;
      lastPrimaryEpicPrice=null; lastPrimaryEpicPriceAsset=null;
      liveSessionPhaseNow=function(){ return 'mt5'; };
      statoMercato=function(){ return null; };
      // Il pennello usa l'orologio della fonte: lo si mette DENTRO l'ultima candela, come
      // succede dal vero (un tick che arriva mentre la candela e' ancora aperta).
      const veroNow=Date.now;
      const dentroUltima=parseDateTime(csvLibrary[0].rows[csvLibrary[0].rows.length-1].date)+120000;
      Date.now=function(){ return dentroUltima; };
      mt5Adesso=function(){ return dentroUltima; };
      fblPitturaPrezzoFine();
      Date.now=veroNow;
      return {prima:prima, dopo:csvLibrary[0].rows[csvLibrary[0].rows.length-1].close,
              alto:csvLibrary[0].rows[csvLibrary[0].rows.length-1].high};
    })()`);
    assert.ok(r.dopo !== r.prima || r.alto >= 4190,
      'il prezzo della fonte giusta deve aggiornare la candela: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("PROVA DI CONTROLLO: fblSorgenteGrafico legge l'id del file", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      csvLibrary=[{id:'mt5_live_XAUUSD',rows:[]}];    const a=fblSorgenteGrafico();
      csvLibrary=[{id:'capital_live_XAUUSD',rows:[]}]; const b=fblSorgenteGrafico();
      csvLibrary=[{id:'altro',rows:[]}];              const c=fblSorgenteGrafico();
      csvLibrary=[];                                  const d=fblSorgenteGrafico();
      return {mt5:a, capital:b, altro:c, vuoto:d};
    })()`);
    assert.equal(r.mt5, 'mt5', 'un file mt5_live_ è del broker MT5: ' + JSON.stringify(r));
    assert.equal(r.capital, 'capital', 'un file capital_live_ è di Capital.com: ' + JSON.stringify(r));
    assert.equal(r.altro, null, 'un file che non si sa di chi è non dice niente: ' + JSON.stringify(r));
    assert.equal(r.vuoto, null, 'senza file non dice niente: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
