// LA RIGA DEL PREZZO SI MUOVE QUANTO LA CANDELA, NON A GRADINI DI UN SECONDO.
//
// Riferito dal proprietario (3 novembre 2026): «la linea tratteggiata del prezzo reale con la
// relativa etichetta sull'asse dei prezzi arriva in ritardo, l'aggiornamento va a scatti, non e'
// uguale a quello delle candele»; e poi, chiarendo: «e' un ritardo di aggiornamento, la segue
// bene, e' solo che la velocita' di aggiornamento della candela e' piu' veloce della velocita' di
// aggiornamento della riga del prezzo».
//
// CAUSA MISURATA: i tick arrivano piu' volte al secondo ma l'app li MEMORIZZA soltanto; l'unico
// punto che li scriveva nella candela e ridisegnava erano i due timer da UN SECONDO. Ora c'e' un
// pennello leggero a 250 ms (fblPitturaPrezzoFine) che fa SOLO quello: applica l'ultimo tick e
// ridisegna, senza toccare tabelle, salvataggi, chiamate al ponte e valutazione di stop e target.
//
// Il test NON cerca stringhe nel sorgente: apre l'app, finge i tick memorizzati e conta quante
// volte la candela e la riga cambiano davvero in un secondo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Banco: Live su MT5, storico 1m finto, mercato aperto, nessuna rete vera.
const BANCO = `(function(){
  const base=Date.UTC(2026,9,20,8,0,0); const R=[];
  for(let i=0;i<40;i++){ const c=100+i*0.1;
    R.push({date:new Date(base+i*60000).toISOString(),open:c,high:c+0.2,low:c-0.2,close:c,volume:5}); }
  csvLibrary=[{name:'t',rows:R}];
  rebuildBaseRowsFromLibrary();
  currentTF=1; liveModeActive=true; liveReplayActive=false; followLatest=true;
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD'; chartFeedSuspended=false;
  mt5Connected=true; mt5ActiveSymbol='XAUUSD';
  mt5CandleFrozen=false; liveCandleFrozen=false;
  liveSessionPhaseNow=function(){ return 'free'; };
  statoMercato=function(){ return null; };
  fblMercatoFermoOra=function(){ return false; };
  // L'orologio della fonte: fermo dentro l'ultima candela, cosi' nessun giro apre una barra nuova.
  const dentroUltima=base+39*60000+10000;
  mt5Adesso=function(){ return dentroUltima; };
  masterTime=closeTimeOf(baseRows[baseRows.length-1]);
  rebuildRows(); viewEnd=idx;
  lastMt5TickPrice=null; lastPrimaryEpicPrice=null;
  window.__barre=rows.length;
  return true;
})()`;

// Conta quante volte la chiusura della candela cambia davvero mentre arrivano tick nuovi.
// Il tick lo cambiamo ogni 60 ms: piu' spesso del pennello, cosi' e' il pennello a decidere
// la cadenza e non noi.
const CORSA = (ms) => `(async function(){
  const visti=[];
  let n=0;
  const t0=Date.now();
  const ticker=setInterval(()=>{ n++; lastMt5TickPrice=100+ (n%20)*0.05 + 3; },60);
  const spia=setInterval(()=>{
    const c=rows[idx]?Number(rows[idx].close):null;
    if(visti.length===0||visti[visti.length-1]!==c)visti.push(c);
  },15);
  await new Promise(r=>setTimeout(r,${ms}));
  clearInterval(ticker); clearInterval(spia);
  return {cambi:visti.length-1, durata:Date.now()-t0, barre:rows.length, barrePrima:window.__barre};
})()`;

test('in un secondo la candela e la riga cambiano piu' + "'" + ' di una volta sola', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(BANCO);
    const r = await pagina.evaluate(CORSA(1000));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    // Quattro volte al secondo = 4 cambi attesi in 1000 ms. Si chiede almeno 3 per lasciare
    // margine a un giro perso su una macchina carica: il punto e' «piu' di uno», non «esattamente
    // quattro». Con il solo timer del secondo qui ne arrivava 1 (o 0).
    assert.ok(r.cambi >= 3,
      'in un secondo il prezzo a grafico deve cambiare almeno 3 volte, ne ho contati ' + r.cambi);
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO 1: il pennello NON deve mai aprire una candela nuova — quello resta compito
// del timer del secondo, l'unico che sa distinguere un tick vero da un prezzo ripetuto.
test('il pennello non apre mai una candela nuova', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(BANCO);
    const r = await pagina.evaluate(CORSA(1000));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.barre, r.barrePrima,
      'il numero di candele non deve cambiare: il pennello aggiorna solo quella in corso');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO 2: dentro al replay il tempo lo comanda il Play, non l'orologio. Il pennello
// deve stare fermo, altrimenti il replay correrebbe da solo.
test('in replay il pennello non tocca niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(BANCO);
    await pagina.evaluate('(function(){ liveReplayActive=true; return true; })()');
    const r = await pagina.evaluate(CORSA(900));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.cambi, 0, 'in replay la candela non si deve muovere da sola, cambi contati: ' + r.cambi);
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO 3: a prezzo fermo non si ridisegna. Senza questa prova il pennello potrebbe
// ridipingere quattro volte al secondo anche con il mercato immobile — lavoro puro sprecato, e su
// telefono e tablet si pagherebbe in batteria.
test('a prezzo fermo il pennello non ridisegna', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(BANCO);
    const r = await pagina.evaluate(`(async function(){
      lastMt5TickPrice=103.33;
      let disegni=0;
      const vero=window.draw;
      window.draw=function(){ disegni++; return vero.apply(this,arguments); };
      await new Promise(r=>setTimeout(r,300));   // il primo giro applica il prezzo nuovo
      const dopoPrimo=disegni;
      await new Promise(r=>setTimeout(r,900));   // da qui in poi il prezzo non cambia piu'
      const fine=disegni;
      window.draw=vero;
      return {dopoPrimo, aggiunti:fine-dopoPrimo};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.aggiunti, 0,
      'con il prezzo fermo il pennello non deve ridisegnare nulla, ridisegni contati: ' + r.aggiunti);
  } finally { await browser.close(); }
});
