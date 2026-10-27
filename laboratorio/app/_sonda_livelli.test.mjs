// SONDA (non è un test del collaudo): misura come si comporta OGGI il raggruppamento delle
// etichette quando le posizioni sono allo stesso livello di prezzo ma NON identiche.
// Serve a distinguere "il raggruppamento non c'è" da "il raggruppamento c'è ma la sua regola
// è più stretta di quella che serve".
import test from 'node:test';
import {apriApp} from './aiuti.mjs';

const GRAFICO = () => {
  const t0 = Date.now() - 300*60000; let p = 4161; const R = [];
  for (let i=0;i<300;i++){ const o=p, c=p+Math.sin(i/7)*2;
    R.push({date:new Date(t0+i*60000).toISOString(), open:o, high:Math.max(o,c)+1, low:Math.min(o,c)-1, close:c, volume:10}); p=c; }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; currentAssetKey='XAUUSD';
  csvLibrary=[{id:'mt5_live_XAUUSD',name:'MT5 Live',addedAt:Date.now(),rows:R}];
  visibleCount=300;
  liveModeActive=false; mt5Connected=false;
};

const CATTURA = () => {
  const c=document.getElementById('chart').getContext('2d');
  window.__pill=[];
  if(!c.__fillTextOriginale) c.__fillTextOriginale=c.fillText;
  c.fillText=function(t){ window.__pill.push(String(t)); return c.__fillTextOriginale.apply(this, arguments); };
};

const CASO_A = () => {
  // STESSO livello di TARGET (4200) ma entrate e orari diversi: due posizioni aperte in
  // momenti diversi che condividono l'obiettivo. È il caso "stessa linea di prezzo".
  const R = [];
  for (let n=0;n<4;n++){
    R.push({id:'a'+n,side:'BUY',entry:4161+n,sl:4100-n,tp:4200,lots:0.1,asset:'XAUUSD',
      startTime:Date.parse(rows[100+n*3].date),symbol:'XAUUSD'});
  }
  return R;
};

const CASO_B = () => {
  // Posizioni sfalsate di mezzo punto: il quadro da dipinto che il proprietario descrive.
  const R = [];
  for (let n=0;n<8;n++){
    R.push({id:'b'+n,side:n%2?'SELL':'BUY',entry:4161+n*0.5,sl:4100-n*0.5,tp:4200+n*0.5,lots:0.1,
      asset:'XAUUSD',startTime:Date.parse(rows[90+n].date),symbol:'XAUUSD'});
  }
  return R;
};

const SONDA = async (nome, prepara) => {
  const {browser, pagina} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      positions=(${prepara})(); active=null; posSelezionata=null; previewTradeLevel=null;
      draw();
      return {tp:window.__pill.filter(function(t){return /^TP\\d??:/.test(t);}),
              sl:window.__pill.filter(function(t){return /^(SL|Stop Profit):/.test(t);})};
    })()`);
    console.log('=== '+nome+' ===');
    console.log('etichette TP disegnate: '+r.tp.length);
    r.tp.forEach(t=>console.log('   TP: '+t));
    console.log('etichette SL disegnate: '+r.sl.length);
    r.sl.forEach(t=>console.log('   SL: '+t));
  } catch(e){ console.log('ERRORE '+nome+': '+e.message); }
  finally { await browser.close(); }
};

test('SONDA A: stesso target, entrate/orari diversi', async () => { await SONDA('CASO A (stesso TP 4200, 4 entrate/orari diversi)', CASO_A); });
test('SONDA B: posizioni sfalsate di mezzo punto', async () => { await SONDA('CASO B (8 posizioni sfalsate)', CASO_B); });
