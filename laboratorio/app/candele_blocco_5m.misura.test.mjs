// MISURA — PASSANDO DA 1m A 5m LE CANDELE DIVENTANO BLOCCHI PIENI?
//
// SEGNALATO dal proprietario (screenshot): XAU/USD 5m, asse 07→10 novembre (3 giorni),
// candele diventate «grandi blocchi pieni di colore (colonne dense blu/bianche)» invece di
// candele sottili. Tema blue_white: su=#ffffff, giu'=#2f9bff — da qui il bianco/blu.
//
// IL BANCO MISURA IL DISEGNO VERO: intercetta le fillRect del canvas durante draw() e
// conta quanto sono LARGHE le candele disegnate e quanto SPAZIO c'e' fra l'una e l'altra.
// Se la larghezza supera il passo, i corpi si sovrappongono e il grafico diventa un masso.
//
// Non corregge niente: stampa i numeri.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Tre giorni di candele da 1 minuto di XAU/USD, come nello screenshot (07→10 novembre).
// `vis1m` e' quante candele si vedono a 1 minuto prima del cambio.
const SCENARIO = (vis1m) => `(function(){
  const t0=Date.UTC(2026,10,7,0,0,0), N=4320;   // 3 giorni x 1440 minuti
  const R=[]; let p=4100;
  for(let i=0;i<N;i++){
    const o=p, c=p+Math.sin(i/11)*3+Math.cos(i/5)*1.2;
    R.push({date:new Date(t0+i*60000).toISOString(),open:o,high:Math.max(o,c)+1.5,
            low:Math.min(o,c)-1.5,close:c,volume:100+(i%13)});
    p=c;
  }
  csvLibrary=[{id:'x',name:'XAU',addedAt:Date.now(),rows:R}];
  rebuildBaseRowsFromLibrary();
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD';
  liveModeActive=false; liveReplayActive=false; mt5Connected=false;
  candleTheme='blue_white';
  document.getElementById('footprintEnabled').checked=false;
  currentTF=1; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
  idx=rows.length-1; viewEnd=rows.length-1; followLatest=false; autoFitWidth=false;
  visibleCount=${vis1m};
  const primaLarghezza=document.getElementById('chart').clientWidth;
  const primoCw=primaLarghezza-18-chartPadR(primaLarghezza);

  // --- INTERCETTAZIONE: registra ogni fillRect del disegno vero -------------------------
  function misura(nome){
    const proto=CanvasRenderingContext2D.prototype, orig=proto.fillRect;
    const viste=[];
    proto.fillRect=function(x,y,w,h){ viste.push({x:x,y:y,w:w,h:h,st:this.fillStyle}); return orig.apply(this,arguments); };
    try{ draw(); }finally{ proto.fillRect=orig; }
    // I corpi candela: colore esatto del tema e larghezza entro il tetto (12 px, o 90 col footprint)
    const up=currentCandleColors().up, dn=currentCandleColors().down;
    const corpi=viste.filter(v=>(v.st===up||v.st===dn)&&v.w<=90&&v.h>=1).sort((a,b)=>a.x-b.x);
    const passo=primoCw/getVisibleCount();
    const lar=corpi.map(c=>c.w);
    const passi=[];
    for(let i=1;i<corpi.length;i++)passi.push(corpi[i].x-corpi[i-1].x);
    const med=a=>{ if(!a.length)return 0; const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; };
    return {
      nome:nome, tf:currentTF, visibili:getVisibleCount(),
      cw:Math.round(primoCw), passoTeorico:+passo.toFixed(2),
      tettoAntiSovrapposizione:maxNoOverlapVisibleCount(),
      tettoCambioTf:fblTettoCandele(),
      tettoZoomManuale:maxManualZoomOutVisibleCount(),
      corpiDisegnati:corpi.length,
      larghezzaCorpo:+(med(lar)||0).toFixed(2), larghezzaMin:+(Math.min.apply(null,lar.concat([0]))).toFixed(2),
      larghezzaMax:+(Math.max.apply(null,lar.concat([0]))).toFixed(2),
      passoMisurato:+(med(passi)||0).toFixed(2),
      // quanti corpi toccano il vicino (larghezza >= passo): e' il "blocco pieno"
      sovrapposti:passi.filter((p,i)=>p>0&&lar[i+1]>=p-0.01).length,
      totaleConfronti:passi.length
    };
  }
  const a=misura('1m prima');
  // IL CAMBIO TIMEFRAME VERO: il gestore della select #tf, non una rifactura a mano.
  const sel=document.getElementById('tf'); sel.value='5';
  sel.dispatchEvent(new Event('change'));
  const b=misura('5m dopo');
  return {prima:a, dopo:b};
})()`;

test('cambio timeframe 1m → 5m: i corpi delle candele non devono sovrapporsi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    for(const vis of [80, 300, 1500]){
      const r = await pagina.evaluate(({s}) => {
        const fai = eval('(' + s + ')');
        return fai;
      }, {s: SCENARIO(vis)});
      const a=r.prima, b=r.dopo;
      console.log('\n=== visibili a 1m: '+vis+' ===');
      console.log(JSON.stringify(a,null,1));
      console.log(JSON.stringify(b,null,1));
      const passo=b.passoMisurato||b.passoTeorico;
      console.log('-> a 5m: '+b.corpiDisegnati+' corpi, corpo '+b.larghezzaCorpo+'px, passo '+passo+'px'
        +'  RAPPORTO corpo/passo = '+(b.larghezzaCorpo/passo).toFixed(2));
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

