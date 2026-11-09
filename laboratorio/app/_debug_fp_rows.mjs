import {apriApp, PREPARA_BTC} from './aiuti.mjs';
const {browser, pagina, errori} = await apriApp();
const out = await pagina.evaluate((prep) => {
  eval('(' + prep + ')')();
  const el=document.getElementById('footprintAutoRow'); if(el)el.checked=true;
  const esiti=[];
  for(const tf of [1,5,15,60]){
    currentTF=tf; rebuildRows();
    _fpAutoRow={key:null,pips:0};           // cache azzerata: voglio il valore puro
    const tip=footprintTypicalCandlePips(currentAssetKey);
    const pips=footprintRowPipsForAsset(currentAssetKey);
    const righe=tip&&pips?Math.round(tip/pips):null;
    const dec=getDecimals();
    esiti.push({tf:tf, candele:rows.length, tipico:+Number(tip).toFixed(2), pips:pips, righe:righe,
                dec:dec, pipSize:pipSizeForAsset(currentAssetKey)});
  }
  currentTF=1; rebuildRows();
  return esiti;
}, PREPARA_BTC.toString());
console.log(JSON.stringify(out, null, 1));
console.log('errori:', errori.slice(0,3));
await browser.close();
