// MISURA delle guardie delle aperture automatiche prima/dopo il cambio conto, con gli
// interruttori ACCESI: così il risultato non dipende da un messaggio ma dal comportamento.
import {apriApp} from './aiuti.mjs';

const {browser, pagina, errori} = await apriApp();
try {
  const prima = await pagina.evaluate(`(function(){
    const k=Object.keys(INDICATOR_DEFS).includes('vp_daily')?'vp_daily':Object.keys(INDICATOR_DEFS)[0];
    activeIndicators=[{id:1,key:k,params:INDICATOR_DEFS[k].defaultParams(),hidden:false,calc:{ref:null,builtTo:-1}}];
    indicatorsByMode=normalizeIndicatorsByMode({},activeIndicators);
    fblMotoreSalvaConfig({'pullback@reale':true});
    liveModeActive=true; liveReplayActive=false; mt5Connected=true; mt5ActiveSymbol='XAUUSD';
    mt5AccountInfo={login:'22222222',server:'Real-Server',balance:10000,equity:10000,currency:'EUR',reale:true};
    mt5AccountHistory={closed:[],deposits:10000,withdrawals:0,stato:'ok'};
    mt5ContoAttivo={login:'22222222',server:'Real-Server',reale:true,tradeMode:'real'};
    capitalSessionTokens=null;
    return {
      tipo:fblTipoConto(),
      puoAprireReale:fblPuoAprireSulConto({},'pullback'),
      motivo:fblMotivoContoNo('pullback'),
      config:fblMotoreConfig()['pullback@reale']
    };
  })()`);
  const dopo = await pagina.evaluate(`(function(){
    mt5AttivaConto('33333333','Altro-Real',true,'real');
    mt5Connected=true;
    return {
      tipo:fblTipoConto(),
      puoAprireReale:fblPuoAprireSulConto({},'pullback'),
      motivo:fblMotivoContoNo('pullback'),
      config:fblMotoreConfig()['pullback@reale'],
      accountAttivo:mt5ContoAttivo&&mt5ContoAttivo.login,
      info:mt5AccountInfo&&String(mt5AccountInfo.login)
    };
  })()`);
  console.log('PRIMA :', JSON.stringify(prima));
  console.log('DOPO  :', JSON.stringify(dopo));
  console.log('ERRORI:', JSON.stringify(errori.filter(e=>!/WebSocket|fetch|network|ERR_/i.test(e))));
} finally { await browser.close(); }
