// MISURA: attivata la Prop Firm su Live con MT5, poi il terminale MT5 si scollega.
// Serve a vedere se il cassetto della challenge diventa 'simulato' (Capital.com), come dice
// il proprietario. Nessuna Assertion: stampa solo i numeri.
import {apriApp} from './aiuti.mjs';

const {browser, pagina, errori} = await apriApp();
try {
  await pagina.evaluate(`(function(){
    const k=Object.keys(INDICATOR_DEFS).includes('vp_daily')?'vp_daily':Object.keys(INDICATOR_DEFS)[0];
    activeIndicators=[{id:1,key:k,params:INDICATOR_DEFS[k].defaultParams(),hidden:false,calc:{ref:null,builtTo:-1}}];
    indicatorsByMode=normalizeIndicatorsByMode({},activeIndicators);
    liveModeActive=true; liveReplayActive=false; mt5Connected=true;
    mt5AccountInfo={login:'22222222',server:'Real-Server',balance:10000,equity:10000,currency:'EUR',reale:true};
    mt5AccountHistory={closed:[],deposits:10000,withdrawals:0,stato:'ok'};
    mt5ContoAttivo={login:'22222222',server:'Real-Server',reale:true,tradeMode:'real'};
    capitalSessionTokens=null; pfRealMt5Login=null; pfPendingDecisionLogin=null; isPropFirmMode=false;
    return true;
  })()`);
  await pagina.evaluate(`(async function(){
    document.getElementById('propFirmToggleBtn').click();
    document.getElementById('propFirmChoiceLiveBtn').click();
    await new Promise(r=>setTimeout(r,1400));
    return true;
  })()`);
  const leggi = `(function(){
    let fonte=''; try{ mostraFonteCapitale(); fonte=(document.getElementById('mCapitalFonte')||{}).textContent||''; }catch(e){}
    return {modo:currentMode(), prop:isPropFirmMode, id:fblPropContoId(), tipo:fblTipoConto(),
      usaMt5:pfUsesRealMt5(), mt5:mt5Connected, info:mt5AccountInfo&&String(mt5AccountInfo.login),
      fonte:fonte};
  })()`;
  console.log('CON MT5:', JSON.stringify(await pagina.evaluate(leggi)));
  await pagina.evaluate(`(function(){ mt5Connected=false; mt5AccountInfo=null; return true; })()`);
  console.log('SENZA MT5:', JSON.stringify(await pagina.evaluate(leggi)));
  console.log('ERRORI:', JSON.stringify(errori.filter(e=>!/WebSocket|fetch|network|ERR_/i.test(e))));
} finally { await browser.close(); }
