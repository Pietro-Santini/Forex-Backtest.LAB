// Riproduce "l'Order Block si inserisce e dopo qualche secondo si toglie da solo".
// Apre app.html, aggiunge order_blocks, campiona activeIndicators per ~10 s e registra
// quale funzione potrebbe averlo rimosso (hydrateIndicators / graficoApplica / loadIndicatorsForMode).
import {apriApp, PREPARA_BTC} from './aiuti.mjs';

const {browser, pagina, errori} = await apriApp();
const log=[];
try{
  await pagina.evaluate(PREPARA_BTC);
  // Spie: registrano quando una funzione di ri-idratazione droppa l'order_blocks.
  await pagina.evaluate(() => {
    window.__spie=[];
    const segna=(nome,lista)=>{
      const keys=(Array.isArray(lista)?lista:[]).map(i=>i&&i.key);
      if(!keys.includes('order_blocks'))window.__spie.push({t:Date.now(),nome,keys:keys.slice(0,20)});
    };
    const origH=window.hydrateIndicators;
    window.hydrateIndicators=(l)=>{ const r=origH(l); segna('hydrateIndicators',r); return r; };
    const attivi=()=>Array.from(activeIndicators||[]);
    const origL=window.loadIndicatorsForMode;
    if(typeof origL==='function')window.loadIndicatorsForMode=(m)=>{ const r=origL(m); segna('loadIndicatorsForMode',attivi()); return r; };
    if(window.graficoApplica&&!window.graficoApplica.__spiato){
      const origA=window.graficoApplica;
      window.graficoApplica=(k,v)=>{ const r=origA(k,v); if(String(k).startsWith('ind|'))segna('graficoApplica '+k,attivi()); return r; };
      window.graficoApplica.__spiato=true;
    }
  });
  await pagina.evaluate(() => addIndicator('order_blocks'));
  await pagina.waitForTimeout(300);
  const campioni=[];
  for(let i=0;i<40;i++){
    const s=await pagina.evaluate(() => ({
      t:Date.now(),
      attivi:(activeIndicators||[]).map(x=>x.key)
    }));
    campioni.push(s);
    await pagina.waitForTimeout(250);
  }
  const sparito=campioni.findIndex(c=>!c.attivi.includes('order_blocks'));
  console.log('CAMPIONI n='+campioni.length);
  console.log('ADD→SPARSO in campione: '+(sparito>=0?sparito:'MAI SPARSO')+' (0=subito, ogni campione ~250ms)');
  console.log('Traccia:',JSON.stringify(campioni.map(c=>c.attivi.join(',')),null,0));
  console.log('SPIE (ri-idratazioni senza order_blocks):');
  console.log(JSON.stringify(await pagina.evaluate(()=>window.__spie),null,1));
  console.log('ERRORI PAGINA: '+(errori.length?errori.join(' | '):'nessuno'));
}catch(e){
  console.log('ERRORE TEST:',e&&e.stack||e);
}finally{
  await browser.close();
}