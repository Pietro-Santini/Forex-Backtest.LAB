// UN TICKET MT5 = UNA RIGA SOLA NEL JOURNAL. (20 novembre 2026)
//
// SEGNALATO dal proprietario: «mi ha contato due posizioni in una, non è la prima volta che
// succede. mi mostra pure l'EA e a volte me lo mostra pure sul trade journal con tutto 0 sui
// valori».
//
// MISURATO, non supposto (laboratorio/app/_misura_doppione_journal.mjs): un ticket chiuso
// dall'EA produceva UNA riga, poi runMt5HistoryCatchUp() la riaggiungeva - 2, poi 3, poi 4
// righe identiche, tutte col risultato «EA» - a ogni giro di recupero storico. La causa
// misurata era nel filtro del recupero: passava da fblTradeDelContoCollegato(t), che vale
// FALSE quando currentMt5AccountTag() è vuoto, quindi NESSUNA riga risultava nota e ogni
// riconnessione riaggiungeva lo stesso deal. La controprova col conto noto
// (_misura_doppione_journal2.mjs) dava 1 riga sola: il buco è il conto ignoto e, in generale,
// l'assenza di un invariante per ticket.
//
// Il test NON cerca stringhe nel sorgente: apre l'app, finge il ponte MT5 (/positions,
// /deal_reason, /history_deals), chiude la posizione come fa l'EA e poi rifà il giro del
// recupero storico. Conta le righe che finiscono DAVVERO nel Journal.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const TICKET = 777001;
const ORA_S = Math.floor(Date.now() / 1000);

// Il ponte finto vive dentro la pagina e il banco ne cambia lo stato fra un passo e l'altro.
// `contoNoto` è la differenza che aveva nascosto la causa: col conto ignoto il filtro vecchio
// non riconosceva nessuna riga, col conto noto sì.
const BANCO = (contoNoto) => `(function(){
  const t0=Date.UTC(2026,10,20,8,0,0); const R=[];
  for(let i=0;i<60;i++){ const c=1.10+i*0.0001;
    R.push({date:new Date(t0+i*60000).toISOString(),open:c,high:c+0.0005,low:c-0.0005,close:c,volume:10}); }
  rows=R; baseRows=R; idx=20; viewEnd=R.length; currentAssetKey='EURUSD'; rowsAssetKey='EURUSD';
  liveModeActive=true; liveReplayActive=false; fblBacktestModeAttivo=false;
  if(typeof mt5PositionsPollTimer!=='undefined'&&mt5PositionsPollTimer){clearInterval(mt5PositionsPollTimer);mt5PositionsPollTimer=null;}
  positions.length=0; pendingOrders.length=0; trades.length=0; equity.length=0;
  mt5Connected=true; mt5ConnessioneInCorso=0; mt5GenerazioneConto=1;
  ${contoNoto ? "mt5ContoAttivo={login:'11111',server:'Fintex-Server'};\n  mt5AccountInfo={login:'11111',server:'Fintex-Server'};" : 'mt5ContoAttivo=null; mt5AccountInfo=null; mt5CredsDraft=null;'}
  window.__ponte={foto:[],deal:null,storico:null};
  fetchMt5WithTimeout=async function(p){
    const u=String(p);
    if(u.indexOf('/positions')===0) return {ok:true,conto:{login:'11111',server:'Fintex-Server'},data:window.__ponte.foto};
    if(u.indexOf('/deal_reason')===0) return {ok:true,data:window.__ponte.deal};
    if(u.indexOf('/history_deals')===0) return {ok:true,data:window.__ponte.storico||[]};
    if(u.indexOf('/orders')===0) return {ok:true,data:[]};
    if(u.indexOf('/account')===0) return {ok:true,data:{balance:10000}};
    return {ok:false,message:'banco di prova'};
  };
  playOrderSound=function(){};
  return true;
})()`;

const APRI_TICKET = `(function(){
  window.__ponte.foto=[{ticket:${TICKET},symbol:'EURUSD',side:'BUY',volume:0.10,
    price_open:1.1000,price_current:1.1000,sl:null,tp:null,time:${ORA_S - 600}}];
  return true; })()`;

// L'EA ha chiuso: il ticket sparisce da /positions e /deal_reason conferma il perché.
const CHIUDI = `(function(){
  window.__ponte.foto=[];
  window.__ponte.deal={reason:'EA',price:1.1200,price_open:1.1000,profit_net:200.00,
    balance:10200.00,time:${ORA_S},time_open:${ORA_S - 600}};
  return true; })()`;

// Lo stesso ticket, letto dallo storico: è quello che il recupero storico ripropone a ogni
// riconnessione (una voce per posizione, come fa /history_deals nel ponte).
const STORICO = `(function(){
  window.__ponte.storico=[{positionId:${TICKET},symbol:'EURUSD',side:'BUY',volume:0.10,
    priceOpen:1.1000,priceClose:1.1200,timeOpen:${ORA_S - 600},timeClose:${ORA_S},
    sl:null,tp:null,profit:200.00,swap:0,commission:0,reason:'EA'}];
  return true; })()`;

const CONTA = `(function(){
  const righe=trades.filter(t=>String(t.mt5Ticket)==='${TICKET}');
  return {righe:righe.length, pl:righe.map(t=>t.pl), exit:righe.map(t=>t.exit),
    risultato:righe.map(t=>t.result), equity:equity.length,
    aperte:positions.length};
})()`;

// Il giro completo: adozione, chiusura da parte dell'EA, poi TRE recuperi storici.
async function giroCompleto(pagina) {
  await pagina.evaluate(APRI_TICKET);
  await pagina.evaluate('fetchMt5Positions()');
  await pagina.waitForTimeout(400);
  await pagina.evaluate(CHIUDI);
  await pagina.evaluate('fetchMt5Positions()');
  await pagina.waitForTimeout(300);
  await pagina.evaluate('fetchMt5Positions()');
  await pagina.waitForTimeout(600);
  const dopoChiusura = await pagina.evaluate(CONTA);
  for (let i = 0; i < 3; i++) {
    await pagina.evaluate(STORICO);
    await pagina.evaluate('runMt5HistoryCatchUp()');
    await pagina.waitForTimeout(600);
  }
  const dopoStorico = await pagina.evaluate(CONTA);
  return {dopoChiusura, dopoStorico};
}

test('un ticket chiuso dall\'EA resta una riga sola, anche se il recupero storico lo rilegge',
  async () => {
    const {browser, pagina, errori} = await apriApp({larghezza: 1400, altezza: 900});
    try {
      await pagina.evaluate(BANCO(false));            // conto ignoto: il buco misurato
      const {dopoChiusura, dopoStorico} = await giroCompleto(pagina);
      assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
      assert.equal(dopoChiusura.righe, 1,
        'la chiusura dell\'EA deve scrivere UNA riga sola (trovate ' + dopoChiusura.righe + ')');
      assert.equal(dopoStorico.righe, 1,
        'il recupero storico rilegge lo stesso ticket: deve restare UNA riga (trovate ' +
        dopoStorico.righe + ')');
      assert.deepEqual(dopoStorico.pl, [200], 'il profitto della riga è quello vero del broker');
      assert.deepEqual(dopoStorico.exit, [1.12], 'l\'uscita della riga è quella vera');
      assert.deepEqual(dopoStorico.risultato, ['EA'], 'il motivo resta quello confermato dal ponte');
      assert.equal(dopoStorico.aperte, 0, 'e la posizione resta chiusa');
      assert.equal(dopoStorico.equity, 1,
        'un solo punto nell\'equity curve: il conto non deve crescere da solo a ogni riconnessione');
    } finally { await browser.close(); }
  });

// PROVA DI CONTROLLO: la stessa strada col conto GIÀ noto. Senza questa prova il test sopra
// passerebbe anche se la cura avesse semplicemente smesso di registrare le chiusure.
test('col conto noto la regola è la stessa: una riga sola', async () => {
  const {browser, pagina, errori} = await apriApp({larghezza: 1400, altezza: 900});
  try {
    await pagina.evaluate(BANCO(true));
    const {dopoChiusura, dopoStorico} = await giroCompleto(pagina);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(dopoChiusura.righe, 1, 'la chiusura scrive una riga');
    assert.equal(dopoStorico.righe, 1, 'il recupero storico non ne aggiunge una seconda');
    assert.deepEqual(dopoStorico.pl, [200], 'con i valori veri');
  } finally { await browser.close(); }
});

test('la riga rimasta con i valori a 0 si aggiorna con quelli veri, non si affianca', async () => {
  const {browser, pagina, errori} = await apriApp({larghezza: 1400, altezza: 900});
  try {
    await pagina.evaluate(BANCO(true));
    const esito = await pagina.evaluate(`(function(){
      const vuota={id:1,asset:'EURUSD',side:'BUY',entry:1.1,exit:0,pl:0,mode:'live',
        mt5Ticket:${TICKET}};
      const vera={id:2,asset:'EURUSD',side:'BUY',entry:1.1,exit:1.12,pl:200,pct:2,pips:120,
        result:'EA',mode:'live',mt5Ticket:${TICKET}};
      trades.length=0;
      fblRegistraTradeMt5(vuota);
      fblRegistraTradeMt5(vera);
      return {righe:trades.length, exit:trades.map(t=>t.exit), pl:trades.map(t=>t.pl)};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(esito.righe, 1, 'una riga vuota e una vera sono la stessa operazione: una riga sola');
    assert.deepEqual(esito.exit, [1.12], 'la riga che resta ha l\'uscita vera');
    assert.deepEqual(esito.pl, [200], 'e il profitto vero, non più 0');
  } finally { await browser.close(); }
});

// I numeri di posizione MT5 sono unici DENTRO un broker, non fra broker: lo stesso numero su
// due conti sono due operazioni diverse, e la deduplica non deve cancellarne una.
test('due conti diversi con lo stesso numero di ticket sono due operazioni distinte', async () => {
  const {browser, pagina, errori} = await apriApp({larghezza: 1400, altezza: 900});
  try {
    await pagina.evaluate(BANCO(true));
    const esito = await pagina.evaluate(`(function(){
      const r=(login)=>({id:Math.random(),asset:'EURUSD',side:'BUY',entry:1.1,exit:1.12,pl:200,
        result:'EA',mode:'live',mt5Ticket:${TICKET},mt5Login:login});
      trades.length=0;
      fblRegistraTradeMt5(r('11111'));
      fblRegistraTradeMt5(r('22222'));
      fblRegistraTradeMt5(r('22222'));
      const login=trades.map(t=>t.mt5Login);
      return {righe:trades.length, login};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(esito.righe, 2,
      'stesso ticket su due conti diversi: due righe, non una (la deduplica non deve mangiare ' +
      'un\'operazione vera)');
    assert.deepEqual(esito.login, ['11111', '22222'], 'una riga per conto');
  } finally { await browser.close(); }
});

test('al caricamento i doppioni già salvati si riparano e l\'equity torna al suo posto',
  async () => {
    const {browser, pagina, errori} = await apriApp({larghezza: 1400, altezza: 900});
    try {
      await pagina.evaluate(`(function(){
        const t0=Date.UTC(2026,10,20,8,0,0); const R=[];
        for(let i=0;i<60;i++){ const c=1.10+i*0.0001;
          R.push({date:new Date(t0+i*60000).toISOString(),open:c,high:c+0.0005,low:c-0.0005,close:c,volume:10}); }
        rows=R; baseRows=R; idx=20; viewEnd=R.length; currentAssetKey='EURUSD'; rowsAssetKey='EURUSD';
        liveModeActive=true; return true; })()`);
      // Lo stato salvato dalle versioni precedenti: lo stesso ticket due volte (una riga presa
      // in diretta, una recuperata dallo storico) e tre punti nell'equity curve.
      const esito = await pagina.evaluate((ticket) => {
        const riga = (pl) => ({id: Math.random(), asset: 'EURUSD', side: 'BUY', entry: 1.1,
          exit: 1.12, pl, pct: 2, result: 'EA', mode: 'live', lots: 0.1,
          closedAt: '2026-11-20T10:00:00.000Z', mt5Ticket: ticket,
          mt5Login: '11111', mt5Server: 'Fintex-Server'});
        const stato = {version: (typeof SESSION_VERSION !== 'undefined' ? SESSION_VERSION : 2),
          positions: [], pendingOrders: [], trades: [riga(200), riga(200)],
          equity: [10000, 10200, 10400], fields: {market: 'EURUSD'}, liveModeActive: true,
          statsBaselineByMode: {backtest: 0, live: 0, backtest_propfirm: 0, live_propfirm: 0},
          sessionByMode: {}};
        try { applyLightSessionState(stato); } catch (e) { return {errore: String(e)}; }
        return {righe: trades.length, pl: trades.map(t => t.pl), equity: equity.length,
          equityVal: equity.slice(), baseline: (statsBaselineByMode || {}).live};
      }, TICKET);
      assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
      assert.equal(esito.righe, 1,
        'il doppione già salvato va tolto al caricamento (trovate ' + esito.righe + ' righe)');
      assert.deepEqual(esito.pl, [200], 'la riga che resta ha i valori veri');
      assert.deepEqual(esito.equityVal, [10000, 10200],
        'anche l\'equity curve perde il punto del doppione');
      assert.equal(esito.baseline, 0, 'e la baseline dei conteggi non si sposta');
    } finally { await browser.close(); }
  });

test('un ticket nuovo viene aggiunto: la deduplica non blocca il Journal', async () => {
  const {browser, pagina, errori} = await apriApp({larghezza: 1400, altezza: 900});
  try {
    await pagina.evaluate(BANCO(true));
    const esito = await pagina.evaluate(`(function(){
      trades.length=0; equity.length=0;
      const r=(ticket,pl)=>({id:Math.random(),asset:'EURUSD',side:'BUY',entry:1.1,exit:1.12,pl,
        result:'EA',mode:'live',mt5Ticket:ticket});
      fblRegistraTradeMt5(r(${TICKET},200));
      fblRegistraTradeMt5(r(777002,-50));
      const simulata={id:Math.random(),asset:'EURUSD',side:'BUY',entry:1.1,exit:1.11,pl:-10,
        result:'Manuale',mode:'backtest'};
      fblRegistraTradeMt5(simulata);
      return {righe:trades.length, pl:trades.map(t=>t.pl)};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(esito.righe, 3,
      'ticket diversi e operazioni simulate continuano a finire nel Journal');
    assert.deepEqual(esito.pl, [200, -50, -10], 'con i loro profitti');
  } finally { await browser.close(); }
});