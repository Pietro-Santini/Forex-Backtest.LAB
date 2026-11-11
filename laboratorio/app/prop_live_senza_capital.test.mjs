// PROP FIRM SU LIVE CON MT5 GIA' COLLEGATO: NON SI CHIEDE IL LOGIN A CAPITAL.COM.
//
// REGOLA DEL PROPRIETARIO (10 novembre 2026), testuale:
// «per quanto riguarda l'attivazione della prop firm direttamente dentro l'applicazione: non
// bisogna per forza essere loggati con capital.com, quindi quando scegliamo se attivarla sul
// conto storico o conto live, se scegliamo il live non per forza bisogna eseguire il login col
// capital.com, perché se siamo collegati con MT5 direttamente lui si collega con MT5. Quindi
// correggi.»
//
// Percorso misurato, quello vero dei pulsanti: click su «🛡️ MODALITÀ PROP FIRM» ->
// modulo «In quale sessione?» -> click su «🔴 Live» -> proceedEnablePropFirm(true).
//
// Cosa si misura: quante volte si apre il login di Capital.com (#liveLoginModalOverlay /
// openLiveLoginModal) e se la Prop Firm si accende davvero (currentMode()==='live_propfirm').
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Stato realistico di chi ha gia' il terminale MT5 attaccato al ponte locale: mt5Connected=true
// con conto e storico pronti (capitali versati 10.000, equity 10.000). NESSUNA sessione
// Capital.com aperta: capitalSessionTokens resta null, perche' e' lì che sta il difetto.
const MT5_COLLEGATO = `(function(){
  mt5Connected=true;
  mt5AccountInfo={login:12345678, server:'PropFirm-Live', balance:10000, equity:10000, currency:'EUR'};
  mt5AccountHistory={closed:[], deposits:10000, withdrawals:0};
  capitalSessionTokens=null;
  liveCredsDraft=null;
  window.__mt5Prima={connesso:mt5Connected, login:mt5AccountInfo.login};
  return true;
})()`;

// Contromisura: stessa pagina, STESSO percorso, ma senza MT5 collegato. Qui il login a
// Capital.com DEVE aprirsi: senza questo controllo il test passerebbe anche con un codice che
// non chiede mai l'accesso a nessuno.
const MT5_STACCATO = `(function(){
  mt5Connected=false;
  mt5AccountInfo=null; mt5AccountHistory=null;
  capitalSessionTokens=null;
  liveCredsDraft=null;
  return true;
})()`;

// Spia sul punto esatto in cui l'app chiede l'accesso a Capital.com: openLiveLoginModal() è
// l'unica strada che apre #liveLoginModalOverlay (app.html, riga 53003).
const SPIA = `(function(){
  window.__loginCapital=0;
  const vero=window.openLiveLoginModal;
  if(typeof vero!=='function')return 'NESSUNA openLiveLoginModal';
  window.openLiveLoginModal=function(){ window.__loginCapital++; return vero.apply(this,arguments); };
  return 'spia pronta';
})()`;

// IL PERCORSO VERO DEI PULSANTI, non la funzione chiamata a mano.
const PERCORSO = `(async function(){
  const t0=Date.now();
  document.getElementById('propFirmToggleBtn').click();                 // «🛡️ MODALITÀ PROP FIRM»
  const sceltaAperta=document.getElementById('propFirmModeChoiceModalOverlay').style.display;
  document.getElementById('propFirmChoiceLiveBtn').click();             // «🔴 Live»
  await new Promise(r=>setTimeout(r,1200));                             // il giro è asincrono
  return {
    sceltaAperta:sceltaAperta,
    modo:currentMode(),
    propFirmAccesa:isPropFirmMode,
    liveAttivo:liveModeActive,
    loginCapital:window.__loginCapital||0,
    modaleLoginVisibile:document.getElementById('liveLoginModalOverlay').style.display,
    capitaleChallenge:propFirmChallengeInitialCapital,
    mt5AncoraCollegato:mt5Connected,
    ms:Date.now()-t0
  };
})()`;

// Il login a Capital.com viene chiesto da ensureCapitalConnected() (app.html riga 24640), che
// risponde "true" subito se capitalSessionTokens c'è già. Qui si misura la SUA risposta.
const RISPOSTA = `(async function(){
  try{ return {ok:await ensureCapitalConnected('banco di prova'), errore:null}; }
  catch(e){ return {ok:null, errore:String(e).slice(0,160)}; }
})()`;

async function scenario(prepara){
  const {browser, pagina, errori} = await apriApp();
  try{
    const spia = await pagina.evaluate(SPIA);
    await pagina.evaluate(prepara);
    const r = await pagina.evaluate(PERCORSO);
    const risposta = await pagina.evaluate(RISPOSTA);
    return {spia, r, risposta, errori};
  } finally { await browser.close(); }
}

// ---------------------------------------------------------------------------------------------
test('MT5 COLLEGATO + Prop Firm su Live: NON deve aprirsi il login di Capital.com', async () => {
  const {spia, r, errori} = await scenario(MT5_COLLEGATO);
  assert.equal(spia, 'spia pronta', 'la spia sul login di Capital.com deve potersi installare: ' + spia);
  assert.deepEqual(errori.filter(e=>!/WebSocket|fetch|network|ERR_/i.test(e)), [],
    'la pagina non deve avere errori JS: ' + JSON.stringify(errori));
  assert.equal(r.sceltaAperta, 'flex', 'il modulo «Storico o Live?» deve essersi aperto: ' + r.sceltaAperta);
  assert.equal(r.loginCapital, 0,
    ' con MT5 già collegato scegliendo Live NON deve chiedersi il login a Capital.com; '
    + 'aperto ' + r.loginCapital + ' volte (modale: ' + r.modaleLoginVisibile + ')');
  assert.notEqual(r.modaleLoginVisibile, 'flex',
    'il modulo del login di Capital.com non deve essere a schermo, oggi è: ' + r.modaleLoginVisibile);
  // ...e la Prop Firm deve accendersi DAVVERO, sulla sessione live_propfirm.
  assert.equal(r.propFirmAccesa, true,
    'con MT5 collegato la Prop Firm su Live si accende, oggi isPropFirmMode=' + r.propFirmAccesa);
  assert.equal(r.modo, 'live_propfirm', 'sessione raggiunta: ' + r.modo);
  assert.equal(r.capitaleChallenge, 10000,
    'il capitale della Challenge è quello VERO del conto MT5 (10.000 versati), non un modulo da riempire');
});

// PROVA DI CONTROLLO: senza MT5 il login a Capital.com resta necessario — serve a dimostrare che
// la spia misura qualcosa e che la cura non è "non chiedere mai più l'accesso".
test('PROVA DI CONTROLLO: senza MT5 il login a Capital.com viene chiesto', async () => {
  const {r, errori} = await scenario(MT5_STACCATO);
  assert.deepEqual(errori.filter(e=>!/WebSocket|fetch|network|ERR_/i.test(e)), [],
    'la pagina non deve avere errori JS: ' + JSON.stringify(errori));
  assert.equal(r.loginCapital, 1,
    'senza MT5 collegato il login di Capital.com deve aprirsi una volta, oggi ' + r.loginCapital);
  assert.equal(r.propFirmAccesa, false,
    'senza accesso non si attiva nulla: oggi isPropFirmMode=' + r.propFirmAccesa);
});

// PROVA DI CONTROLLO 2: la scelta «📼 Storico» non deve mai tirare in ballo Capital.com,
// con o senza MT5. Oggi è già verde, e deve restare verde dopo la cura.
test('PROVA DI CONTROLLO: in Storico nessun login Capital.com, MT5 collegato o no', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(SPIA);
    await pagina.evaluate(MT5_COLLEGATO);
    const r = await pagina.evaluate(`(async function(){
      document.getElementById('propFirmToggleBtn').click();
      document.getElementById('propFirmChoiceStoricoBtn').click();   // «📼 Storico»
      await new Promise(r2=>setTimeout(r2,800));
      return {loginCapital:window.__loginCapital||0, modo:currentMode(), propFirmAccesa:isPropFirmMode};
    })()`);
    assert.deepEqual(errori.filter(e=>!/WebSocket|fetch|network|ERR_/i.test(e)), [],
      'la pagina non deve avere errori JS: ' + JSON.stringify(errori));
    assert.equal(r.loginCapital, 0, 'in Storico non si chiede Capital.com: ' + r.loginCapital);
    assert.equal(r.propFirmAccesa, true, 'la Prop Firm su Storico si accende');
  } finally { await browser.close(); }
});
