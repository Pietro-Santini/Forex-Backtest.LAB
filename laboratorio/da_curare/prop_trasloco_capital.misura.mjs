// MISURA (non correzione) del gesto descritto dal proprietario il 27 novembre 2026:
//   «succede sia in conto reale che in conto demo ... quando cambio conto e quando attivo la
//   modalità prop firm demo su un conto demo e quando attivo la modalità reale (quando esce fuori
//   il popup che mi dice se attivare la modalità propfirm su questo conto reale/demo) ...
//   aperture automatiche non partono, indicatori spariti o azzerati, conto simulato attenzione».
//
// Stampa i numeri grezzi prima/dopo il cambio conto MT5, senza Assertion: serve a capire dove
// avviene il trasloco prima di scrivere il banco. Nessun dato vero esce dal banco di prova.
import {apriApp} from './aiuti.mjs';

const PREPARA = (login, server, reale) => `(function(){
  const k=Object.keys(INDICATOR_DEFS).includes('vp_daily')?'vp_daily':Object.keys(INDICATOR_DEFS)[0];
  const ind={id:1,key:k,params:INDICATOR_DEFS[k].defaultParams(),hidden:false,calc:{ref:null,builtTo:-1}};
  activeIndicators=[ind];
  indicatorsByMode=normalizeIndicatorsByMode({}, [ind]);
  mt5Connected=true;
  mt5ActiveSymbol='XAUUSD';
  mt5AccountInfo={login:'${login}',server:'${server}',balance:10000,equity:10000,currency:'EUR',reale:${reale}};
  mt5AccountHistory={closed:[],deposits:10000,withdrawals:0,stato:'ok'};
  mt5ContoAttivo={login:'${login}',server:'${server}',reale:${reale},tradeMode:'${reale?'real':'demo'}'};
  capitalSessionTokens=null; liveCredsDraft=null;
  try{ localStorage.removeItem('${'forex_lab_pf_mt5_choice_by_login'}'); }catch(e){}
  pfRealMt5Login=null; pfPendingDecisionLogin=null;
  isPropFirmMode=false; liveModeActive=true;
  return true;
})()`;

const LEGGI = `(function(){
  const ids=(a)=>Array.isArray(a)?a.map(x=>x&&(x.key||x.id)).join(','):'';
  let fonte=''; try{ mostraFonteCapitale(); fonte=(document.getElementById('mCapitalFonte')||{}).textContent||''; }catch(e){ fonte='ERR:'+String(e).slice(0,60); }
  return {
    modo: currentMode(), propFirmAccesa:isPropFirmMode, liveAttivo:liveModeActive,
    tipoConto: fblTipoConto(), idContoProp: fblPropContoId(), usaMt5Reale: pfUsesRealMt5(),
    pfRealMt5Login: pfRealMt5Login==null?null:String(pfRealMt5Login),
    aperturaDemoConsentita: (function(){try{return fblPuoAprireSulConto({},'pullback');}catch(e){return 'ERR';}})(),
    motivoNo: (function(){try{return fblMotivoContoNo('pullback');}catch(e){return 'ERR';}})(),
    ultimoGiroMotore: (fblMotoreUltimoGiro&&fblMotoreUltimoGiro.testo)||null,
    indicatoriAttivi: ids(activeIndicators),
    indicatoriLive: ids(indicatorsByMode['live']),
    indicatoriLivePf: ids(indicatorsByMode['live_propfirm']),
    mt5AccountInfoLogin: mt5AccountInfo&&String(mt5AccountInfo.login),
    mt5ContoAttivoLogin: mt5ContoAttivo&&String(mt5ContoAttivo.login),
    capitaleVisuale: (document.getElementById('capital')||{}).value,
    fonteCapitale: fonte,
    modaleVeraDemo: (document.getElementById('pfMt5IneligibleModalOverlay')||{}).style?.display,
    modaleCapitale: (document.getElementById('propFirmCapitalModalOverlay')||{}).style?.display
  };
})()`;

const ATTIVA = `(async function(){
  document.getElementById('propFirmToggleBtn').click();
  document.getElementById('propFirmChoiceLiveBtn').click();
  await new Promise(r=>setTimeout(r,1600));
  return true;
})()`;

for (const [nome, login, server, reale] of [
  ['CONTO DEMO MT5', '11111111', 'Demo-Server', false],
  ['CONTO REALE MT5', '22222222', 'Real-Server', true]
]) {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA(login, server, reale));
    const prima = await pagina.evaluate(LEGGI);
    await pagina.evaluate(ATTIVA);
    const dopoAttivazione = await pagina.evaluate(LEGGI);
    // Il gesto vero: cambio conto dal menu MT5 (stessa funzione che gira sul pulsante «Connetti»).
    const cambio = await pagina.evaluate(`(function(){
      const nuovo='${reale ? '33333333' : '44444444'}';
      const nuovoServer='${reale ? 'Altro-Real' : 'Altro-Demo'}';
      const nuovoReale=${reale};
      mt5AttivaConto(nuovo, nuovoServer, nuovoReale, nuovoReale?'real':'demo');
      mt5Connected=true;
      return true;
    })()`);
    await new Promise(r => setTimeout(r, 400));
    const dopoCambio = await pagina.evaluate(LEGGI);
    console.log('=== ' + nome + ' === (cambio conto eseguito: ' + cambio + ')');
    console.log('PRIMA          :', JSON.stringify(prima));
    console.log('DOPO ATTIVAZIONE:', JSON.stringify(dopoAttivazione));
    console.log('DOPO CAMBIO    :', JSON.stringify(dopoCambio));
    console.log('ERRORI PAGINA  :', JSON.stringify(errori.filter(e => !/WebSocket|fetch|network|ERR_/i.test(e))));
  } finally { await browser.close(); }
}
