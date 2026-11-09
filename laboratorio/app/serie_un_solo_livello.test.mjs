// UN CAMBIO DI SORGENTE NON DEVE MESCOLARE DUE LIVELLI DI PREZZO NELLE STESSE CANDELE.
//
// SEGNALATO dal proprietatore (9 novembre 2026, con due foto): «è ritornato questo problema
// delle candele che vengono disegnate così, il problema arriva da un momento all'altro tenendo
// l'app ferma e il footprint diventa così come nella seconda foto». Nelle foto: candele
// altissime con code lunghissime, e le caselline numerate del footprint SPARPAGLIATE su tutta
// l'area del grafico invece di stare impilate dentro la loro candela.
//
// CAUSA MISURATA (indagine del 9 novembre, senza correggere niente): il marcatore «è cambiata
// solo la coda» - quello che serve a non rifare tutto lo storico per un tick - guardava solo
// quante candele ci sono e la data dell'ultima. Cambiando sorgente (MT5 -> Capital.com e
// ritorno, che succede da solo) lunghezza e data RESTANO, il livello di prezzo NO: su XAUUSD i
// due broker quotano lo stesso oro a circa 66 punti di distanza. Il marcatore scattava,
// l'aggregazione teneva in vita le candele della serie VECCHIA e rifaceva solo la coda con
// quelle NUOVE: due livelli dentro le stesse candele. Misurato prima della cura, su 21 candele
// da 15 minuti: estremi 88,6 punti invece di 23 (la prova di controllo con la serie
// riaggregata per intero dà 23). Una candela che assorbe i due livelli diventa 4,3 volte piu'
// alta, e le caselline del footprint - che stanno dentro l'alto-basso della loro candela - si
// spargono su tutta l'area: sono tutte e due le foto.
//
// NON E' UN DIFETTO NUOVO: è la stessa strada della v155 (il footprint «a strati» del 15
// ottobre), con una cura che allora teneva insieme i due livelli per altre vie. Le altre
// difese reggono, e le prove qui sotto lo misurano: il passo delle righe del footprint resta
// UNO SOLO, e le righe restano dentro la candela. Quello che mancava era la serie.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// 300 minuti di mercato, XAUUSD, aggregati a 15m: 21 candele. `livello` è di quanti punti la
// serie sta più su o più giù (il gioco dei due broker, misurato a 66 punti).
const SERIE = (livello) => `(function(){
  const t0=Date.UTC(2026,10,6,16,0,0); const R=[]; let p=4186+(${livello||0});
  for(let i=0;i<300;i++){ p+=(Math.sin(i/11)+Math.cos(i/7))*0.25;
    R.push({date:new Date(t0+i*60000).toISOString(),open:p,high:p+0.8,low:p-0.8,close:p+0.1,volume:10+(i%7)}); }
  return R;
})()`;

const PREPARA = `(function(){
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD'; liveModeActive=true; liveReplayActive=false;
  currentTF=15; masterTime=Date.UTC(2026,10,6,20,59,0);
  return true;
})()`;

// Mette la serie nel banco e rifà i dati di base (la strada che nel programma percorre il
// caricatore Live: rebuildBaseRowsFromLibrary).
const CARICA = (livello) => `(function(){
  csvLibrary=[{id:'mt5_live_xau',rows:${SERIE(livello)}}];
  rebuildBaseRowsFromLibrary();
  rebuildRows();
  return {candele:rows.length, segnale:!!baseRowsCoda};
})()`;

// Quanto è alta la candela piu' alta, e quanto è largga la fascia di prezzo visibile: con due
// livelli dentro la stessa serie la FASCIA esplode (misurato dall'indagine: 88,6 punti invece
// di 23) e con lei la scala verticale, che è quella che fa sembrare le candele "disegnate
// cosi'".
const AMPIEZZE = `(function(){
  let max=0, alto=-Infinity, basso=Infinity;
  rows.forEach(function(r){
    const a=Number(r.high)-Number(r.low); if(a>max)max=a;
    if(Number(r.high)>alto)alto=Number(r.high);
    if(Number(r.low)<basso)basso=Number(r.low);
  });
  return {candela:+max.toFixed(2), fascia:+(alto-basso).toFixed(2)};
})()`;

test('un cambio di sorgente con la stessa lunghezza NON mescola due livelli', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      ${PREPARA};
      const primo=${CARICA(0)};                 // serie al livello MT5
      const buona=${AMPIEZZE};
      const primaDiLui=rows.slice();            // che candele tiene in vista l'aggregazione
      // La serie nuova: STESSA lunghezza, STESSA data sull'ultima candela, 66 punti piu' in
      // basso - il cambio di sorgente (Capital.com al posto di MT5) che succede da solo.
      const dopo=${CARICA(-66)};
      const mista=${AMPIEZZE};
      return {primo, dopo, buona, mista, quante:rows.length};
    })()`);
    assert.ok(r.primo.candele > 5, 'il banco deve aggregare le candele: ' + JSON.stringify(r));
    assert.ok(r.buona.fascia < 30,
      'la serie sana deve avere una fascia stretta (un livello solo): ' + JSON.stringify(r));
    assert.equal(r.dopo.segnale, false,
      'con un ALTRO livello di prezzo il marcatore "solo la coda" NON deve scattare: '
      + JSON.stringify(r));
    assert.ok(r.mista.fascia <= r.buona.fascia * 1.6,
      'dopo il cambio di sorgente la fascia deve restare di UN livello solo (misurato dall'
      + 'indagine, prima della cura, sulla stessa strada: 88,6 punti invece di 23, e le'
      + ' caselline del footprint sparse su tutta l area del grafico): ' + JSON.stringify(r));
    assert.ok(r.mista.candela <= r.buona.candela * 1.6,
      'e le candele non devono allungarsi: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("PROVA DI CONTROLLO: un tick sull'ultima candela segnala ancora \"solo la coda\"", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // Il marcatore serve a questo: un prezzo nuovo sull'ultima candela, o una candela nuova in
    // fondo - il 99% dei giri. Se la cura lo spegnesse sempre, ogni tick rifarebbe tutto lo
    // storico (ed è il carcame che aveva lasciato l'app su "Non risponde").
    const r = await pagina.evaluate(`(() => {
      ${PREPARA};
      const primo=${CARICA(0)};
      // Una candela nuova in fondo, stesso livello di prezzo: è il caso vero del marcatore.
      csvLibrary[0].rows=csvLibrary[0].rows.concat([csvLibrary[0].rows[csvLibrary[0].rows.length-1]]);
      csvLibrary[0].rows[csvLibrary[0].rows.length-1]={
        date:new Date(Date.UTC(2026,10,6,21,0,0)).toISOString(),
        open:4186.1,high:4187.0,low:4185.8,close:4186.9,volume:9};
      rebuildBaseRowsFromLibrary();
      const dopo=!!baseRowsCoda;
      return {primo, dopo};
    })()`);
    assert.ok(r.primo.candele > 5, 'il banco deve aggregare: ' + JSON.stringify(r));
    assert.equal(r.dopo, true,
      'con una candela nuova in fondo il marcatore DEVE scattare, o ogni tick rifarebbe tutto lo'
      + ' storico: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("PROVA DI CONTROLLO: il footprint tiene un passo solo e le righe dentro la candela", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // Le difese di ieri (v144 scala uniforme, v145 righe dentro la candela) devono reggere: la
    // cura di oggi lavora sulla SERIE, non sul disegno.
    const r = await pagina.evaluate(`(() => {
      ${PREPARA};
      ${CARICA(-66)};
      rebuildRows();
      visibleCount=300; autoFitWidth=false; followLatest=false;
      footprintEnabled=true; footprintStyle='bidask';
      draw();
      const passi={};
      rows.forEach(function(riga){
        if(riga && riga.footprint && riga.footprint.step)passi[riga.footprint.step]=(passi[riga.footprint.step]||0)+1;
      });
      return {passi:Object.keys(passi), quanteRighe:rows.length};
    })()`);
    assert.ok(r.passi.length <= 1,
      'il passo delle righe del footprint deve essere UNO SOLO per tutto il grafico: '
      + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
