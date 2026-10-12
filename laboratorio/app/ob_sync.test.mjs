// Regressione "l'Order Block si toglie da solo": la condivisione fra dispositivi manda l'elenco
// COMPLETO degli indicatori e chi scrive per ultimo vince. Se un altro dispositivo (es. il telefono
// che gira ancora in cache una versione che non conosce l'Order Block) risponde con la sua lista
// SENZA l'OB, la sostituzione glielo cancellava dal grafico nel giro di pochi secondi.
// Con la correzione l'arrivo di una voce remota fa un'UNIONE: gli indicatori presenti SOLO su
// questo dispositivo vengono tenuti; per gli stessi id vince la voce remota (parametri aggiornati).
import {apriApp, PREPARA_BTC} from './aiuti.mjs';

const {browser, pagina, errori} = await apriApp();
let falliti=0;
const check=(nome,ok)=>{ console.log((ok?'✅':'❌')+' '+nome); if(!ok)falliti++; };
try{
  await pagina.evaluate(PREPARA_BTC);
  const es=await pagina.evaluate(()=>{
    addIndicator('order_blocks');
    const _draw=window.draw; window.draw=()=>{}; // il test isola la logica di MERGE, non il rendering
    const att=()=>serializeIndicators(activeIndicators).map(x=>x.key).sort();
    const ob=()=>activeIndicators.find(x=>x.key==='order_blocks');
    const out={};
    const obId=ob().id; // l'id dell'OB aggiunto qui, salvato PRIMA che arrivi la voce remota
    // 1) Voce remota VECCHIA (senza l'OB, es. telefono che non lo conosce) che arriva DOPO:
    //    l'OB aggiunto qui NON deve sparire; l'indicatore nuovo che porta va comunque aggiunto.
    graficoApplica('ind|live',[{id:111,key:'volume_default',params:{opacity:70}}]);
    out.dopoVoceSenzaOb=att();
    // 2) Stesso id condiviso: vince la voce remota (parametri aggiornati dall'altro dispositivo).
    graficoApplica('ind|live',[{id:obId,key:'order_blocks',params:Object.assign({},ob()?ob().params:{}, {amt:7})}]);
    out.parametri=ob()?ob().params.amt:null;
    // 3) Voce remota COMPLETA di un dispositivo nuovo: applicata integra (OB + sr_breaks), volume_default tenuto.
    graficoApplica('ind|live',[{id:obId,key:'order_blocks',params:ob().params},{id:222,key:'sr_breaks',params:{leftBars:15,rightBars:15}}]);
    out.voceCompleta=att();
    _draw(); return out;
  });
  check('OB NON rimosso dalla voce remota senza OB', es.dopoVoceSenzaOb.includes('order_blocks'));
  check('indicatore nuovo dalla voce remota aggiunto (volume_default)', es.dopoVoceSenzaOb.includes('volume_default'));
  check('parametri condivisi: vince la voce remota (amt=7)', es.parametri===7);
  check('voce completa applicata (order_blocks+sr_breaks+volume_default)', JSON.stringify(es.voceCompleta)==='["order_blocks","sr_breaks","volume_default"]');
  console.log('Dettagli:',JSON.stringify(es));
  console.log('ERRORI PAGINA: '+(errori.length?errori.join(' | '):'nessuno'));
  if(errori.length)falliti++;
}catch(e){ console.log('ERRORE TEST:',e&&e.stack||e); falliti=1; }
finally{ await browser.close(); }
process.exit(falliti?1:0);