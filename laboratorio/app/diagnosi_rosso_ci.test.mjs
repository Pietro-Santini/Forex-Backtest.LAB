// DIAGNOSI (sola misura, non corregge niente): perche' il collaudo su GitHub e' ROSSO.
//
// Due test cadono sul CI (run 40920898732 e 40919794119, commit 717a7ec e 66b5d6e):
//   265 - "tre caselle identiche diventano UNA etichetta, con numero, origine e accumulo della perdita"
//   788 - "il popup dei pacchetti MT5 non propone niente da installare su telefono e tablet"
// Questo banco misura il COMPORTAMENTO all'origine dei due errori, con i numeri.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// ============================================================ 788: mt5Passo1Parole
// Il test originale chiama mt5Passo1Parole(false) e legge subito scarica.style.display.
// Se la funzione e' diventata ASINCRONA (c'e' un await prima di toccare il DOM), la lettura
// prende il valore di prima: il test non misura piu' niente.
test('788 - mt5Passo1Parole: quanto ci mette a toccare il DOM, e cosa legge chi non aspetta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const scarica = document.getElementById('mt5DownloadDesktopAppBtn');
      // (a) la funzione e' asincrona? Se sì, la prima riga eseguita e' l'attesa, non il DOM.
      const t0 = Date.now();
      const p = mt5Passo1Parole(false);
      const asyncPromessa = (p instanceof Promise);
      // lettura IMMEDIATA: quella che fa il test originale
      const subito = scarica.style.display;
      // lettura dopo che la funzione ha finito davvero
      await p;
      const dopoAttesa = scarica.style.display;
      return {asyncPromessa, subito, dopoAttesa, ms: Date.now()-t0,
              haAwait: /await/.test(mt5Passo1Parole.toString())};
    });
    // La prova di controllo: il test originale passa SE E SOLO SE la lettura immediata
    // vede già il risultato definitivo.
    assert.equal(r.haAwait, true, 'mt5Passo1Parole contiene un await: e\' asincrona');
    // NUMERO CHE CONTA: tra la chiamata e la scrittura sul DOM passa un'attesa.
    // Se subito === primoStato e dopoAttesa !== subito, il test misura lo stato vecchio.
    console.log('788:', JSON.stringify(r));
  } finally { await browser.close(); }
});

// Stessa lettura, ma con il ramo "telefono" del test: e' il caso che cade (expected false).
test('788 - ramo telefono: display letto subito vs dopo l\'attesa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const scarica = document.getElementById('mt5DownloadDesktopAppBtn');
      const vero = fblEMobile;
      window.fblEMobile = () => true; fblEMobile = window.fblEMobile;
      const p = mt5Passo1Parole(false);
      const subito = scarica.style.display;
      const visibileSubito = scarica.style.display !== 'none';
      await p;
      const visibileDopo = scarica.style.display !== 'none';
      window.fblEMobile = vero; fblEMobile = vero;
      return {subito, visibileSubito, visibileDopo, ms: 0};
    });
    console.log('788-mobile:', JSON.stringify(r));
    // L'asserzione del test e': visibile === false. Mostro cosa vede chi non aspetta.
    assert.equal(typeof r.visibileSubito, 'boolean');
    assert.equal(typeof r.visibileDopo, 'boolean');
    console.log('788 CONFRONTO: chi-non-aspetta vede visibile=' + r.visibileSubito +
                ', chi-aspetta vede visibile=' + r.visibileDopo);
  } finally { await browser.close(); }
});

// ============================================================ 265: etichetta del gruppo
const GRAFICO = () => {
  const t0 = Date.now() - 200*60000; let p = 4161; const R = [];
  for (let i=0;i<200;i++){ const o=p, c=p+Math.sin(i/7)*2;
    R.push({date:new Date(t0+i*60000).toISOString(), open:o, high:Math.max(o,c)+1, low:Math.min(o,c)-1, close:c, volume:10}); p=c; }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; currentAssetKey='XAUUSD';
  csvLibrary=[{id:'mt5_live_XAUUSD',name:'MT5 Live',addedAt:Date.now(),rows:R}];
  visibleCount=200;
  liveModeActive=false; mt5Connected=false;
};
const CATTURA = () => {
  const c=document.getElementById('chart').getContext('2d');
  window.__pill=[];
  if(!c.__fillTextOriginale) c.__fillTextOriginale=c.fillText;
  c.fillText=function(t){ window.__pill.push(String(t)); return c.__fillTextOriginale.apply(this, arguments); };
};
const GRUPPO = () => {
  const st=Date.parse(rows[100].date);
  const sala={tgSala:'PipHunter',tgGruppo:'g1',tgSegnaleId:'s1'};
  return [1,2,3].map(n=>Object.assign({
    id:'p'+n,side:'BUY',entry:4161,sl:4100,tp:4200,lots:0.1,asset:'XAUUSD',
    startTime:st,symbol:'XAUUSD'
  },sala,{tgTpIndice:n}));
};

test('265 - etichetta raggruppata: origine (sala) presente o no', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      var pos=(${GRUPPO})();
      positions=pos; active=null; posSelezionata=null; previewTradeLevel=null;
      draw();
      var tpPills=window.__pill.filter(function(t){return /^TP\\d??:/.test(t);});
      var slPills=window.__pill.filter(function(t){return /^(SL|Stop Profit):/.test(t);});
      return {tpPills:tpPills, slPills:slPills};
    })()`);
    const tp=r.tpPills.join(' || '), sl=r.slPills.join(' || ');
    console.log('265 TP:', JSON.stringify(r.tpPills));
    console.log('265 SL:', JSON.stringify(r.slPills));
    // I numeri che il test confronta:
    console.log('265 NUMERI: quante etichette TP=' + r.tpPills.length +
                ', quante SL=' + r.slPills.length +
                ', moltiplicatore presente in TP=' + /×3/.test(tp) +
                ', sala "PipHunter" in TP=' + /PipHunter/.test(tp) +
                ', sala "PipHunter" in SL=' + /PipHunter/.test(sl));
  } finally { await browser.close(); }
});

// Prova di controllo: UNA posizione sola deve ancora portare l'origine (non e' toccata dal
// gruppo). Se anche qui l'origine manisse, la causa sarebbe un'altra.
test('265 - controllo: una posizione sola, l\'origine deve esserci', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      var st=Date.parse(rows[100].date);
      var sala={tgSala:'PipHunter',tgGruppo:'g1',tgSegnaleId:'s1'};
      positions=[Object.assign({id:'a',side:'BUY',entry:4161,sl:4100,tp:4200,lots:0.1,asset:'XAUUSD',startTime:st},sala,{tgTpIndice:1})];
      active=null; posSelezionata=null; previewTradeLevel=null;
      draw();
      var tpPills=window.__pill.filter(function(t){return /^TP\\d??:/.test(t);});
      return {tpPills:tpPills};
    })()`);
    const tp=r.tpPills.join(' || ');
    console.log('265-controllo TP:', JSON.stringify(r.tpPills), 'PipHunter=' + /PipHunter/.test(tp));
  } finally { await browser.close(); }
});
