// L'ETICHETTA STA SEMPRE DAVANTI, LA LINEA SELEZIONATA DIETRO.
//
// SEGNALATO dal proprietario (5 novembre 2026): «quando selezioniamo una linea delle etichette,
// la linea che viene evidenziata passa sopra all'etichetta e invece non deve passargli sopra, ma
// deve passargli sotto, perché altrimenti si vedrebbe questa linea che va sopra l'etichetta e non
// si leggerebbe il contenuto. Facciamo in modo che l'etichetta viene messa sempre in primo piano
// e poi la linea in secondo piano».
//
// MISURATO PRIMA DI CURARE, perché l'ordine del disegno sembrava dire il contrario (la linea
// evidenziata si disegna a metà di draw(), le pillole TP/SL molto più avanti): al momento in cui
// `disegnaLineaTradeEvidenziata` gira risultavano già **5 etichette registrate, e due esattamente
// all'altezza della linea**. Erano state disegnate in un giro precedente, quindi la linea ci
// passava sopra per davvero.
//
// LA CURA riusa il meccanismo che la linea NORMALE ha già: `fblLineaSaltaEtichette` interrompe il
// tratto prima di ogni scritta e lo riprende dopo, leggendo il registro condiviso
// `labelPlacements`. La selezione si vede comunque — la linea riprende subito dopo la parola.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Si misurano i TRATTI DISEGNATI, non quanti sono: si registrano le coppie moveTo/lineTo e si
// guarda se qualche tratto copre il rettangolo di un'etichetta che la linea attraversa. È la
// domanda vera — «la scritta resta leggibile?» — e non dipende da quante etichette ci sono.
//
// LA PRIMA VERSIONE DI QUESTA PROVA CHIEDEVA LA COSA SBAGLIATA: contava i tratti e pretendeva che
// fossero più di due. Ma se l'unica etichetta attraversata sta in FONDO alla linea, il tratto
// giusto è uno per passata (si ferma prima della scritta e non riprende, perché dopo non c'è più
// niente da disegnare) — e il test bocciava una cura che funzionava. Misurare la cosa giusta vale
// più che misurare tanto.
const COPERTURA = `(function(){
  const t0=Date.now()-300*60000; const R=[];
  for(let i=0;i<300;i++){ const p=1.1+Math.sin(i/9)*0.002;
    R.push({date:new Date(t0+i*60000).toISOString(),open:p,high:p+0.0005,low:p-0.0005,close:p,volume:5}); }
  csvLibrary=[{name:'t',rows:R}]; rebuildBaseRowsFromLibrary();
  currentAssetKey='EURUSD'; rowsAssetKey='EURUSD'; liveModeActive=false;
  currentTF=1; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
  viewEnd=rows.length-1; idx=rows.length-1; visibleCount=120;
  positions.length=0;
  positions.push({id:'p1',asset:'EURUSD',side:'BUY',entry:1.1,sl:1.098,tp:1.102,lots:0.1,
    start:250,startTime:parseDateTime(rows[250].date),openTF:1,createdAt:1});
  active=positions[0]; syncTradeLevels();
  tradeLevelArmata='TP';                 // l'utente ha selezionato la linea del Take Profit

  let misura=null;
  const vera=window.disegnaLineaTradeEvidenziata;
  disegnaLineaTradeEvidenziata=function(ctx,colore,yy,xDa,xA){
    const tratti=[];
    let ultimo=null;
    const moveVero=ctx.moveTo.bind(ctx), lineVero=ctx.lineTo.bind(ctx);
    ctx.moveTo=function(x,y){ ultimo=(Math.abs(y-yy)<0.5)?x:null; return moveVero(x,y); };
    ctx.lineTo=function(x,y){ if(ultimo!==null&&Math.abs(y-yy)<0.5)tratti.push([ultimo,x]); return lineVero(x,y); };
    const esito=vera.apply(this,arguments);
    ctx.moveTo=moveVero; ctx.lineTo=lineVero;
    // Le etichette che la linea ATTRAVERSA davvero: stessa altezza E sovrapposte in orizzontale.
    const attraversate=labelPlacements.filter(function(b){
      return yy>=b.y-2 && yy<=b.y+b.h+2 && Math.max(xDa,b.x) < Math.min(xA,b.x+b.w); });
    // Quante di quelle restano COPERTE da un tratto disegnato: devono essere zero.
    const coperte=attraversate.filter(function(b){
      return tratti.some(function(t){
        const a=Math.min(t[0],t[1]), z=Math.max(t[0],t[1]);
        return a < b.x+b.w-1 && z > b.x+1;    // il tratto entra dentro la scritta
      }); });
    misura={attraversate:attraversate.length, coperte:coperte.length, tratti:tratti.length};
    return esito;
  };
  draw();
  disegnaLineaTradeEvidenziata=vera;
  return misura;
})()`;

test('la linea selezionata si interrompe sulle etichette invece di passarci sopra', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(COPERTURA);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.ok(r, 'la linea evidenziata non è stata disegnata: la prova misurerebbe il vuoto');
    // Controllo del banco: se la linea non attraversasse nessuna etichetta non ci sarebbe
    // niente da scavalcare, e l'asserzione sotto sarebbe vera per il motivo sbagliato.
    assert.ok(r.attraversate >= 1,
      'il banco non ha etichette attraversate dalla linea (' + r.attraversate
      + '): la prova misurerebbe il vuoto');
    assert.equal(r.coperte, 0,
      'nessuna etichetta deve restare coperta dalla linea selezionata: ' + r.coperte
      + ' su ' + r.attraversate + ' lo sono, e il contenuto non si legge');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: senza nessuna etichetta a quell'altezza la linea deve restare INTERA. Senza
// questa, una cura che spezzetta sempre la linea passerebbe la prova qui sopra e si vedrebbe una
// selezione tratteggiata dove non serve.
test('PROVA DI CONTROLLO: dove non ci sono etichette la linea resta intera', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      const ctx=document.createElement('canvas').getContext('2d');
      labelPlacements.length=0;          // nessuna scritta da scavalcare
      let tratti=0;
      const moveVero=ctx.moveTo.bind(ctx);
      ctx.moveTo=function(x,y){ tratti++; return moveVero(x,y); };
      disegnaLineaTradeEvidenziata(ctx,'#3ea6ff',100,50,500);
      return {tratti};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.tratti, 2,
      'senza etichette la linea è un tratto solo per passata (due in tutto): invece ' + r.tratti);
  } finally { await browser.close(); }
});
