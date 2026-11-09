import {apriApp} from './aiuti.mjs';
const {browser, pagina, errori} = await apriApp();
const out = await pagina.evaluate(`(async () => {
  window.fxbtCloud={uid:'UTENTE',ready:Promise.resolve(),
    graficoSalva:async(v)=>{ window.__mandate.push(Object.keys(v)); return true; }};
  window.__mandate=[];
  graficoAttivo=true; graficoDaInviare=new Set(); graficoT={}; __graficoUltimaFirma=null;
  assetDrawings={live:{'XAUUSD':[{type:'line',p1:{x:1,y:2},p2:{x:3,y:4}}]}};
  currentMode=()=>'live'; currentAssetKey='XAUUSD';
  const cliente=(k)=>{ const i=k.indexOf('|'),mode=k.slice(0,i),asset=k.slice(i+1);
    const cc=(typeof graficoChiaveCorrente==='function')?graficoChiaveCorrente():null;
    if(k===cc&&!assetSwitchInProgress)return drawings;
    const l=(assetDrawings[mode]||{})[asset]; return Array.isArray(l)?l:null; };
  graficoDaInviare.add('live|XAUUSD');
  const prima=await graficoInviaOra();
  const firma1=__graficoUltimaFirma;
  graficoDaInviare.add('live|XAUUSD');
  const seconda=await graficoInviaOra();
  const firma2=__graficoUltimaFirma;
  // payload a mano, per confronto
  const v1={}; v1['live%7CXAUUSD']={t:0,d:graficoJson(cliente('live|XAUUSD'))};
  return {mandate:window.__mandate.length, firma1:firma1, firma2:firma2,
          stessoPosto: firma1===firma2, payload:JSON.stringify(v1).slice(0,120),
          firmaAttesa: firmaSemplice(JSON.stringify(v1))};
})()`);
console.log(JSON.stringify(out, null, 1));
console.log('errori:', errori.slice(0,2));
await browser.close();
