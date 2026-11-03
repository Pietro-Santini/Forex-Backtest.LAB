// IL CONTO MT5 SI MUOVE MENTRE BACKTESTI: SUONO SEMPRE, AVVISO DENTRO AL REPLAY.
//
// Riferito dal proprietario (3 novembre 2026): «se sono in modalità storico, replay, comunque,
// della sezione MT5, se mi si chiudono delle posizioni sotto, in background, o mi si aprono, il
// suono dell'ordine eseguito me lo deve fare comunque. E mi mostra una notifica soltanto quando
// sono in modalità replay che la posizione X si è chiusa, dove specifica se è una posizione
// manuale o di una specifica sala, il profitto in euro e in percentuale, il prezzo raggiunto e
// il numero del TP.»
//
// CAUSA MISURATA: il suono viveva ATTACCATO all'adozione (playOrderSound() sta dentro il ciclo
// che aggiunge la posizione reale a positions[]). In modalità backtest le posizioni MT5 non
// vengono adottate affatto, quindi il conto si muoveva in silenzio.
//
// Il test NON cerca stringhe nel sorgente: apre l'app, finge le fotografie di /positions che
// arrivano dal ponte e conta i suoni partiti davvero e i cartellini comparsi davvero.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Banco: replay acceso con la modalità backtest accesa (il caso in cui prima non suonava
// niente), MT5 collegato, e due agganci sostituiti — il suono e la chiamata al ponte — per
// poterli contare e per non toccare nessun ponte vero.
const BANCO = `(function(){
  const t0=Date.UTC(2026,9,20,8,0,0); const R=[];
  for(let i=0;i<60;i++){ const c=1900+i*0.5;
    R.push({date:new Date(t0+i*60000).toISOString(),open:c,high:c+1,low:c-1,close:c,volume:10}); }
  rows=R; baseRows=R; idx=30; viewEnd=R.length; rowsAssetKey='XAUUSD'; currentAssetKey='XAUUSD';
  liveModeActive=true; liveReplayActive=true; fblBacktestModeAttivo=true;
  mt5Connected=true;
  positions.length=0; pendingOrders.length=0; mt5RealPositions.length=0; mt5RealOrders.length=0;
  window.__suoni=0;
  playOrderSound=function(){ window.__suoni++; };
  // Il ponte finto: risponde come /deal_reason con un take profit della sala "Alpha",
  // profitto 184,20 € su un saldo che PRIMA era 10.000 (quindi +1,84%), uscita a 1925,50.
  window.__dealChiamate=0;
  fetchMt5WithTimeout=async function(p){
    if(String(p).indexOf('/deal_reason')===0){
      window.__dealChiamate++;
      return {ok:true,data:{reason:'TP',price:1925.50,profit_net:184.20,balance:10184.20,
        time:Math.floor(Date.now()/1000),time_open:Math.floor(Date.now()/1000)-600,price_open:1900}};
    }
    return {ok:false,message:'banco di prova'};
  };
  // La sala e il numero del take profit vivono nella memoria ticket -> segnale: e' da li' che
  // l'avviso li prende anche per una posizione mai adottata.
  mt5RicordaSegnale(888001,{tgSala:'Alpha',tgTpIndice:2,tgGruppo:'g1',tgSegnaleId:'s1'});
  return true;
})()`;

const APERTA = {ticket:888001, symbol:'XAUUSD', side:'BUY', volume:0.50, price_open:1900, price_current:1910};

const giro = (lista) => `(function(){ fblAvvisiMt5Giro(${JSON.stringify(lista)}); return window.__suoni; })()`;

const LEGGI = `(function(){
  const pila=document.getElementById('fblAvvisiReplay');
  const carte=pila?[...pila.children]:[];
  return {suoni:window.__suoni, deal:window.__dealChiamate,
    cartellini:carte.length, testo:carte.map(c=>c.textContent).join(' | ')};
})()`;

test('in modalità backtest una posizione MT5 che si apre in background fa comunque il suono', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(BANCO);
    // Prima fotografia: è solo la base, non deve suonare niente (altrimenti all'avvio dell'app
    // suonerebbe una volta per ogni posizione già aperta sul conto).
    await pagina.evaluate(giro([]));
    const dopoBase = await pagina.evaluate('window.__suoni');
    // Seconda fotografia: una posizione nuova sul conto. L'app NON la adotta (modalità backtest),
    // ma il suono deve partire lo stesso.
    await pagina.evaluate(giro([APERTA]));
    const dopoApertura = await pagina.evaluate('window.__suoni');
    const adottata = await pagina.evaluate('positions.length');
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(dopoBase, 0, 'la prima fotografia è la base: silenziosa');
    assert.equal(dopoApertura, 1, 'una posizione nuova sul conto deve far partire il suono (' + dopoBase + ' -> ' + dopoApertura + ')');
    assert.equal(adottata, 0,
      'ma la modalità backtest resta pulita: la posizione non viene adottata né disegnata');
  } finally { await browser.close(); }
});

test('la chiusura in background fa il suono e il cartellino con sala, euro, percentuale, prezzo e TP', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(BANCO);
    await pagina.evaluate(giro([APERTA]));        // base, con la posizione già aperta
    // Sparisce una volta sola: è solo un sospetto, un giro di polling sfortunato non deve
    // annunciare una chiusura che non c'è stata.
    await pagina.evaluate(giro([]));
    const dopoPrimoBuco = await pagina.evaluate(LEGGI);
    // Manca anche al giro successivo: adesso è una chiusura vera.
    await pagina.evaluate(giro([]));
    await pagina.waitForTimeout(400);             // l'avviso chiede il deal al ponte: è asincrono
    const fine = await pagina.evaluate(LEGGI);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(dopoPrimoBuco.deal, 0,
      'sparita una volta sola: nessuna domanda al ponte, nessun annuncio — è solo un sospetto');
    assert.equal(fine.deal, 1, 'alla seconda assenza si chiede il deal vero al ponte');
    assert.equal(fine.suoni, 1, 'la chiusura in background deve far partire il suono');
    assert.equal(fine.cartellini, 1, 'e in replay deve comparire un cartellino');
    assert.match(fine.testo, /Alpha/, 'il cartellino deve dire da quale sala arriva la posizione');
    assert.match(fine.testo, /184[.,]20/, 'deve dire il profitto in euro');
    assert.match(fine.testo, /\+1[.,]84\s*%/, 'deve dire la percentuale sul saldo del conto');
    assert.match(fine.testo, /1925[.,]50/, 'deve dire il prezzo raggiunto');
    assert.match(fine.testo, /TP 2/, 'deve dire il numero del take profit');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO 1: fuori dal replay il suono resta, il cartellino no — è la condizione
// chiesta («una notifica soltanto quando sono in modalità replay»). Senza questa prova il test
// sopra passerebbe anche con un cartellino che compare sempre.
test('fuori dal replay la chiusura suona ma non mostra nessun cartellino', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(BANCO);
    await pagina.evaluate('(function(){ liveReplayActive=false; return true; })()');
    await pagina.evaluate(giro([APERTA]));
    await pagina.evaluate(giro([]));
    await pagina.evaluate(giro([]));
    await pagina.waitForTimeout(400);
    const fine = await pagina.evaluate(LEGGI);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(fine.suoni, 1, 'il suono ci deve essere comunque: «me lo deve fare comunque»');
    assert.equal(fine.cartellini, 0, 'il cartellino invece è solo del replay');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO 2: quando la strada ordinaria si è già occupata di un ticket (adozione
// normale, fuori dalla modalità backtest) il giro degli avvisi lo deve SALTARE, altrimenti lo
// stesso ordine suonerebbe due volte.
test('un ticket già annunciato dalla strada ordinaria non suona una seconda volta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(BANCO);
    await pagina.evaluate(giro([]));                                   // base
    await pagina.evaluate('(function(){ fblMt5Annunciato(888001); return true; })()');
    await pagina.evaluate(giro([APERTA]));
    const dopo = await pagina.evaluate('window.__suoni');
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(dopo, 0, 'già annunciato altrove: qui non si suona di nuovo');
  } finally { await browser.close(); }
});
