// I PARAMETRI SL/TP IN COMPOSIZIONE NON PASSANO DA UN CONTO MT5 A UN ALTRO.
//
// Riferito dal proprietario (3 novembre 2026): «quando sono collegato a un conto e apro una
// posizione, sia ordine a mercato che ordine pendente, e poi faccio lo switch di un altro account
// MT5, l'ultima posizione che ho aperto nel precedente account mi riporta i parametri sul nuovo
// account del TP e del SL. Questo non deve avvenire: quando cambio account deve fare un refresh.
// Anche quando si eseguono posizioni automatiche su piu' conti rimane in memoria l'ultima
// posizione a grafico, e cio' non deve succedere.»
//
// CAUSA MISURATA: refreshTradeLevelUI() riempie le caselle SL/TP quando c'e' una posizione
// selezionata, ma NON le svuota mai quando quella posizione sparisce (c'e' scritto apposta: di
// solito contengono la bozza del prossimo ordine). Al cambio conto mt5AttivaConto() mette da parte
// le posizioni dell'altro conto e azzera `active`, ma le CASELLE e le linee trascinabili restano
// con i numeri del conto lasciato.
//
// Il test NON cerca stringhe nel sorgente: apre l'app, mette in scena un conto con una posizione
// reale selezionata, fa lo switch e guarda cosa resta nelle caselle e sul grafico.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Conto 111 collegato, una posizione REALE selezionata con stop 1890 e target 1960: le caselle
// SL/TP e le linee trascinabili si riempiono con i suoi numeri, come succede davvero.
const SCENARIO = `(function(){
  const base=Date.UTC(2026,9,20,8,0,0); const R=[];
  for(let i=0;i<40;i++){ const c=1900+i*0.5;
    R.push({date:new Date(base+i*60000).toISOString(),open:c,high:c+1,low:c-1,close:c,volume:5}); }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=idx;
  rowsAssetKey='XAUUSD'; currentAssetKey='XAUUSD';
  liveModeActive=true; liveReplayActive=false; mt5Connected=true;
  positions.length=0; pendingOrders.length=0;
  mt5ContoAttivo=null;
  mt5AttivaConto('111','Broker-Demo');
  const pos={id:'p1',asset:'XAUUSD',side:'BUY',entry:1920,sl:1890,tp:1960,lots:0.50,
    mt5Ticket:999001,mt5Login:'111',mt5AddedAt:Date.now(),
    start:idx,startTime:Date.now(),openTF:1,createdAt:Date.now()};
  positions.push(pos);
  active=pos;
  // Un ordine pendente in composizione, scritto a mano nelle sue caselle.
  document.getElementById('pendingEntry').value='1935';
  document.getElementById('slPending').value='1925';
  document.getElementById('tpPending').value='1975';
  syncTradeLevels();        // riempie le linee trascinabili dal posizione selezionata
  refreshTradeLevelUI();    // riempie le caselle SL/TP del trade a mercato
  return true;
})()`;

const LEGGI = `(function(){
  const v=(id)=>{ const e=document.getElementById(id); return e?String(e.value||''):'ASSENTE'; };
  return {
    sl:v('sl'), tp:v('tp'),
    entrataPend:v('pendingEntry'), slPend:v('slPending'), tpPend:v('tpPending'),
    lineaSL: tradeSLLine?tradeSLLine.price:null,
    lineaTP: tradeTPLine?tradeTPLine.price:null,
    anteprima: (typeof previewTradeLevel!=='undefined'&&previewTradeLevel)?previewTradeLevel.price:null,
    posizioniVive: positions.length,
    contoOra: mt5ContoAttivo?mt5ContoAttivo.login:null
  };
})()`;

test('cambiando conto MT5 le caselle SL/TP non portano i numeri del conto di prima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENARIO);
    const prima = await pagina.evaluate(LEGGI);
    // Controllo del banco: senza questo il test potrebbe passare perche' le caselle erano
    // vuote fin dall'inizio, misurando il vuoto.
    assert.equal(prima.sl, '1890', 'il banco deve partire con lo stop del conto 111 nella casella');
    assert.equal(prima.tp, '1960', 'e con il suo target');
    await pagina.evaluate(`(function(){ mt5AttivaConto('222','Broker-Demo'); return true; })()`);
    const dopo = await pagina.evaluate(LEGGI);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(dopo.contoOra, '222', 'il conto collegato deve essere quello nuovo');
    assert.equal(dopo.sl, '', 'sul conto nuovo la casella Stop deve essere vuota, invece aveva: '+dopo.sl);
    assert.equal(dopo.tp, '', 'sul conto nuovo la casella Target deve essere vuota, invece aveva: '+dopo.tp);
    assert.equal(dopo.entrataPend, '', 'e anche l\'entrata dell\'ordine pendente in composizione');
    assert.equal(dopo.slPend, '', 'e il suo stop');
    assert.equal(dopo.tpPend, '', 'e il suo target');
    assert.equal(dopo.lineaSL, null, 'la linea Stop trascinabile non deve restare disegnata col prezzo del conto di prima');
    assert.equal(dopo.lineaTP, null, 'idem la linea Target');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO 1: ricollegandosi allo STESSO conto non si butta via niente. Senza questa
// prova il test sopra passerebbe anche con un reset che scatta a ogni respiro, e che cancellerebbe
// la bozza che stai scrivendo ogni volta che il ponte si riconnette da solo.
test('ricollegandosi allo stesso conto la bozza resta dov\'è', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENARIO);
    await pagina.evaluate(`(function(){ mt5AttivaConto('111','Broker-Demo'); return true; })()`);
    const dopo = await pagina.evaluate(LEGGI);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(dopo.sl, '1890', 'stesso conto: lo stop in composizione non si tocca');
    assert.equal(dopo.tp, '1960', 'stesso conto: il target in composizione non si tocca');
    assert.equal(dopo.slPend, '1925', 'e nemmeno la bozza dell\'ordine pendente');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO 2: il reset riguarda SOLO cio' che e' in composizione. Una posizione vera
// non si chiude e non si cancella: al cambio conto viene messa da parte, e torna quando si
// ricollega quel conto. Senza questa prova, un reset troppo largo passerebbe inosservato.
test('il reset non cancella la posizione vera: torna tornando sul suo conto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENARIO);
    await pagina.evaluate(`(function(){ mt5AttivaConto('222','Broker-Demo'); return true; })()`);
    const suDue = await pagina.evaluate(LEGGI);
    await pagina.evaluate(`(function(){ mt5AttivaConto('111','Broker-Demo'); return true; })()`);
    const tornato = await pagina.evaluate(`(function(){
      return {posizioni:positions.length, ticket:positions[0]?positions[0].mt5Ticket:null};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(suDue.posizioniVive, 0, 'sul conto 222 la posizione del 111 non si vede (messa da parte)');
    assert.equal(tornato.posizioni, 1, 'tornando sul 111 la posizione vera c\'è ancora');
    assert.equal(tornato.ticket, 999001, 'ed è proprio lei, con il suo ticket');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO 3: anche l'anteprima disegnata sul grafico (la linea che stai posizionando)
// se ne va. Senza, il conto nuovo si ritroverebbe addosso una linea "da confermare" nata altrove.
test('al cambio conto sparisce anche l\'anteprima della linea sul grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENARIO);
    await pagina.evaluate(`(function(){
      previewTradeLevel={type:'SL',price:1888,side:'BUY'};
      placingTradeLevel='SL';
      return true;
    })()`);
    const prima = await pagina.evaluate(LEGGI);
    assert.equal(prima.anteprima, 1888, 'il banco deve partire con un\'anteprima disegnata');
    await pagina.evaluate(`(function(){ mt5AttivaConto('222','Broker-Demo'); return true; })()`);
    const dopo = await pagina.evaluate(LEGGI);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(dopo.anteprima, null, 'l\'anteprima non deve sopravvivere al cambio conto');
  } finally { await browser.close(); }
});
