// TRASLOCO PROP FIRM -> CONTO DI CAPITAL.COM (difetto segnalato il 27 novembre 2026, SOLO
// lettura e banco: la cura in app.html la applica chi tiene il file).
//
// PAROLE DEL PROPRIETARIO:
// «alcune volte in un conto reale, un conto demo, quando attivare quella che è la modalità prop
// firm, per sbaglio mi va ad attivarla sul conto di capital.com. le impostazioni degli indicatori,
// le impostazioni del grafico cambiano tutte quante [...] aperture automatiche non partono».
// Al Question del 27 novembre ha precisato: succede SIA in reale sia in demo; il gesto è
// «🛡️ MODALITÀ PROP FIRM» → «🔴 Live», poi «quando cambio conto e quando attivo la modalità
// prop firm demo su un conto demo e quando attivo la modalità reale (quando esce fuori il popup
// che mi dice se attivare la modalità propfirm su questo conto reale/demo)». Dopo vede
// «aperture automatiche non partono, indicatori spariti o azzerati, conto simulato attenzione».
//
// PERCORSO MISURATO (prop_trasloco_capital.misura.mjs, 27 novembre 2026):
//  - attivazione Live con MT5 collegato: modo live_propfirm, tipoConto demo/reale corretto,
//    indicatori conservati, guardia delle aperture = true (con interruttore acceso);
//  - subito dopo `mt5AttivaConto(nuovoLogin, nuovoServer, reale, tradeMode)` — la stessa funzione
//    che gira quando si cambia conto dal menu MT5 — la riga 6173 di app.html azzera
//    `mt5AccountInfo` perché il login è cambiato. Misurato:
//      tipoConto 'reale' -> null, guardia true -> false, motivo 'tipo di conto sconosciuto',
//      fonte capitale '🛡️ Capitale della Challenge Prop Firm (simulato) · ⚠️ i dati del conto
//      MT5 non arrivano (in attesa…)', idContoProp da mt5:VECCHIO a mt5:NUOVO (challenge
//      traslocata sul conto nuovo senza chiedere).
// È esattamente il quadro descritto: le aperture si fermano e il conto appare come simulato.
//
// Cosa NON si asserta qui: una stringa nel sorgente. Si asserta il valore restituito da
// fblTipoConto() e da fblPuoAprireSulConto() con gli interruttori accesi, cioè il comportamento.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from '../app/aiuti.mjs';

const PREPARA = (login, server, reale) => `(function(){
  const k=Object.keys(INDICATOR_DEFS).includes('vp_daily')?'vp_daily':Object.keys(INDICATOR_DEFS)[0];
  activeIndicators=[{id:1,key:k,params:INDICATOR_DEFS[k].defaultParams(),hidden:false,calc:{ref:null,builtTo:-1}}];
  indicatorsByMode=normalizeIndicatorsByMode({},activeIndicators);
  fblMotoreSalvaConfig({'pullback@reale':true});   // interruttore REALE acceso: la guardia non e' il motivo
  liveModeActive=true; liveReplayActive=false;
  mt5Connected=true; mt5ActiveSymbol='XAUUSD';
  mt5AccountInfo={login:'${login}',server:'${server}',balance:10000,equity:10000,currency:'EUR',reale:${reale}};
  mt5AccountHistory={closed:[],deposits:10000,withdrawals:0,stato:'ok'};
  mt5ContoAttivo={login:'${login}',server:'${server}',reale:${reale},tradeMode:'${reale?'real':'demo'}'};
  capitalSessionTokens=null;
  pfRealMt5Login=null; pfPendingDecisionLogin=null;
  isPropFirmMode=false;
  return true;
})()`;

const ATTIVA = `(async function(){
  document.getElementById('propFirmToggleBtn').click();     // 🛡️ MODALITÀ PROP FIRM
  document.getElementById('propFirmChoiceLiveBtn').click(); // 🔴 Live
  await new Promise(r=>setTimeout(r,1500));
  return {modo:currentMode(), propFirmAccesa:isPropFirmMode};
})()`;

const CAMBIA = (login, server, reale) => `(function(){
  mt5AttivaConto('${login}','${server}',${reale},'${reale?'real':'demo'}');
  mt5Connected=true;
  return true;
})()`;

const LEGGI = (demo) => `(function(){
  let fonte=''; try{ mostraFonteCapitale(); fonte=(document.getElementById('mCapitalFonte')||{}).textContent||''; }catch(e){}
  return {
    modo:currentMode(), propFirmAccesa:isPropFirmMode,
    tipoConto:fblTipoConto(),
    idContoProp:fblPropContoId(),
    guardiaApri:fblPuoAprireSulConto(${demo?'{autoOpenDemo:true}':'{}'},'pullback'),
    motivo:fblMotivoContoNo('pullback'),
    interruttoreConfig:fblMotoreConfig()['pullback@reale'],
    indicatori:Array.isArray(activeIndicators)?activeIndicators.map(x=>x&&x.key).join(','):'',
    loginInfo:mt5AccountInfo&&String(mt5AccountInfo.login),
    loginAttivo:mt5ContoAttivo&&String(mt5ContoAttivo.login),
    fonteCapitale:fonte
  };
})()`;

async function scenario(login, server, reale){
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA(login, server, reale));
    const attivazione = await pagina.evaluate(ATTIVA);
    const prima = await pagina.evaluate(LEGGI(!reale));
    await pagina.evaluate(CAMBIA(reale?'33333333':'44444444', reale?'Altro-Real':'Altro-Demo', reale));
    const dopo = await pagina.evaluate(LEGGI(!reale));
    return {attivazione, prima, dopo, errori:errori.filter(e=>!/WebSocket|fetch|network|ERR_/i.test(e))};
  } finally { await browser.close(); }
}

test('PROVA DI CONTROLLO: prima del cambio conto la Prop Firm e` accesa e le aperture sono permesse', async () => {
  const {attivazione, prima, errori} = await scenario('22222222', 'Real-Server', true);
  assert.deepEqual(errori, [], 'la pagina non deve avere errori JS: ' + JSON.stringify(errori));
  assert.equal(attivazione.modo, 'live_propfirm', 'sessione raggiunta: ' + attivazione.modo);
  assert.equal(attivazione.propFirmAccesa, true, 'la Prop Firm si accende');
  assert.equal(prima.tipoConto, 'reale', 'prima del cambio il conto e` riconosciuto come reale');
  assert.equal(prima.interruttoreConfig, true, 'l’interruttore REALE e` acceso: la guardia puo` solo passare');
  assert.equal(prima.guardiaApri, true, 'prima del cambio l’apertura automatica e` permessa: ' + prima.motivo);
  assert.notEqual(prima.indicatori, '', 'gli indicatori ci sono prima del cambio');
});

test('CAMBIO CONTO DA REALE: tipo di conto e guardia delle aperture devono restare corretti (ROSSO oggi)', async () => {
  const {prima, dopo, errori} = await scenario('22222222', 'Real-Server', true);
  assert.deepEqual(errori, [], 'la pagina non deve avere errori JS: ' + JSON.stringify(errori));
  assert.equal(prima.guardiaApri, true, 'controllo: prima del cambio si apriva');
  assert.equal(dopo.loginAttivo, '33333333', 'il cambio conto e` avvenuto davvero');
  // QUI IL DIFETTO MISURATO: mt5AttivaConto azzera mt5AccountInfo e fblTipoConto torna null.
  assert.equal(dopo.tipoConto, 'reale',
    'dopo il cambio conto il tipo deve essere ancora reale (conto MT5 ' + dopo.loginAttivo
    + '), oggi ' + String(dopo.tipoConto) + ' — motivo: ' + dopo.motivo);
  assert.equal(dopo.guardiaApri, true,
    'con l’interruttore REALE acceso e MT5 collegato l’apertura deve restare permessa dopo il cambio; '
    + 'oggi ' + dopo.guardiaApri + ' — motivo: ' + dopo.motivo);
});

test('CAMBIO CONTO DA DEMO: tipo di conto e guardia delle aperture devono restare corretti (ROSSO oggi)', async () => {
  const {prima, dopo, errori} = await scenario('11111111', 'Demo-Server', false);
  assert.deepEqual(errori, [], 'la pagina non deve avere errori JS: ' + JSON.stringify(errori));
  assert.equal(prima.guardiaApri, true, 'controllo: prima del cambio si apriva in demo');
  assert.equal(dopo.loginAttivo, '44444444', 'il cambio conto e` avvenuto davvero');
  assert.equal(dopo.tipoConto, 'demo',
    'dopo il cambio conto il tipo deve essere ancora demo, oggi ' + String(dopo.tipoConto)
    + ' — motivo: ' + dopo.motivo);
  assert.equal(dopo.guardiaApri, true,
    'in demo con MT5 collegato l’apertura deve restare permessa dopo il cambio; oggi '
    + dopo.guardiaApri + ' — motivo: ' + dopo.motivo);
});

test('DOPO IL CAMBIO il cassetto Prop Firm non deve diventare quello simulato di Capital.com', async () => {
  const {prima, dopo} = await scenario('22222222', 'Real-Server', true);
  assert.equal(prima.idContoProp, 'mt5:22222222@Real-Server', 'prima la challenge e` sul conto MT5');
  // fblPropContoId() passa a mt5:33333333@Altro-Real: la challenge creata sul conto vecchio
  // viene riassegnata al nuovo senza che nessuno chieda nulla (misurato).
  assert.equal(dopo.idContoProp, prima.idContoProp,
    'la challenge non deve traslocare da sola sul conto appena collegato: era ' + prima.idContoProp
    + ', oggi ' + dopo.idContoProp);
  assert.equal(dopo.fonteCapitale.includes('non arrivano'), false,
    'il riquadro non deve dire che i dati MT5 non arrivano mentre MT5 e` collegato: ' + dopo.fonteCapitale);
});
