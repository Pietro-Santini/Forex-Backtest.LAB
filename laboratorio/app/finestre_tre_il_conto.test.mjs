// APPLICARE UN CONTO ARRIVATO DA FUORI NON E' ANNUNCIARLO.
//
// SEGNALATO dal proprietario (11 novembre 2026): «ho aperto una terza pagina duplicata e ancora mi
// da' il conto selezionato in precedenza, non quello corrente».
//
// COSA SI E' MISURATO DAVVERO, il 15 novembre, con TRE pagine vere (madre sul conto nuovo,
// duplicata rimasta sul conto vecchio, e una terza che nasce):
//
// 1. IL SINTOMO SEGNALATO NON SI RIPRODUCE PIU'. La terza finestra prende il conto della madre in
//    6 giri su 6, e la traccia dice perche': quando la terza nasce, la duplicata si e' GIA'
//    allineata da sola alla madre, quindi al momento della nascita non c'e' piu' disaccordo. Le
//    cure del 12-13 novembre (propagazione del conto + la guardia sul tempo) tengono. La prova
//    resta qui come guardia di non-regressione, non come difetto aperto.
//
// 2. IL NUMERO «DECINE DI RISPOSTE» IN BUG.md ERA DI PRIMA DELLA CURA DEL 12 NOVEMBRE, e anche la
//    prima misura fatta qui era sbagliata: contava le CHIAMATE a broadcastTradingStateNow(), non i
//    messaggi spediti. Le chiamate sono 12 per 2 richieste, ma le barriere esistenti ne fermavano
//    quasi tutte: i messaggi che uscivano davvero erano UNO. Contare le chiamate avrebbe dato lo
//    stesso numero prima e dopo qualunque cura - una misura che non distingue niente.
//
// 3. QUELL'UNICO MESSAGGIO ERA UN ECO, ed e' il difetto che questo banco tiene fermo. Il blocco
//    `if(msg.conto)` del gestore gira PRIMA del ramo per tipo, e la barriera anti-rimbalzo viene
//    alzata solo dentro il ramo `trading_sync`, piu' sotto. Quindi tutto il percorso che APPLICA
//    il conto - mt5AttivaConto(), scheduleSave(), update() - girava a barriera abbassata e
//    rimandava in giro quello che aveva appena ricevuto. E' il cappio previsto in BUG.md
//    («due finestre in disaccordo sul conto si ribaltano a vicenda»): non e' infinito solo perche'
//    si fermano quando vanno d'accordo, ma ogni cambio conto costa un giro di messaggi in piu', e
//    ogni messaggio fa ridisegnare tutte le finestre.
//    CURA: fblSenzaRiannunciare() alza la barriera per il tempo dell'applicazione, coda asincrona
//    del cambio conto compresa, e la rimette COM'ERA (non a false: il blocco puo' trovarsi
//    annidato dentro un'altra applicazione).
//
// La propagazione NON si perde, ed e' provata altrove: chi propaga e' la finestra dove l'utente ha
// cambiato conto, non chi lo riceve (conto_sincrono.test.mjs, 5/5, nei due versi).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

function ascoltaErrori(pagina) {
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  return errori;
}

const CONTO_VECCHIO = {login: '50100111', server: 'BrokeOne-Demo'};
const CONTO_NUOVO = {login: '50100222', server: 'BrokeOne-Demo'};

// Ponte MT5 finto: risponde al POST /connect con il login richiesto, come il bridge del PC.
// Nessuna rete esce dal banco.
const PONTE_FINTO = (c1, c2) => `(function(){
  var reale = window.fetch;
  window.fetch = function(url, opt){
    var u = String(url);
    if(u.indexOf("/connect") < 0) return reale.apply(window, arguments);
    var corpo = {}; try{ corpo = JSON.parse((opt && opt.body) || "{}"); }catch(e){}
    var login = Number(corpo.login);
    var c1 = ${JSON.stringify(c1)}, c2 = ${JSON.stringify(c2)};
    var noto = (login === Number(c1.login)) ? c1 : (login === Number(c2.login)) ? c2 : null;
    if(!noto) return Promise.resolve({ok:false, status:400, json:function(){
      return Promise.resolve({detail:"conto non salvato " + login}); }});
    return Promise.resolve({ok:true, status:200, json:function(){
      return Promise.resolve({login:Number(noto.login), server:noto.server,
                              reale:false, trade_mode:"demo"}); }});
  };
})()`;

// Mette la finestra su un conto, in Live, SENZA annunciarlo: costruisce la finestra «indietro».
const VAI_SU_CONTO = (conto) => `(function(){
  var c = ${JSON.stringify(conto)};
  mt5AttivaConto(c.login, c.server, false, "demo");
  liveModeActive = true; liveReplayActive = false; mt5Connected = true; mt5MonitorOnly = false;
  fblContoVista = "mt5"; currentAssetKey = "EURUSD";
  positions.length = 0; pendingOrders.length = 0; trades.length = 0;
  return {login: mt5ContoAttivo ? String(mt5ContoAttivo.login) : null};
})()`;

// Conta i messaggi che finiscono DAVVERO sul canale. Non le chiamate: vedi il punto 2 in testa.
const SPIA_MESSAGGI = `(function(){
  window.__spediti = 0;
  var ch = tradingChannel;
  var posta = ch.postMessage.bind(ch);
  ch.postMessage = function(m){
    if(m && m.type === 'trading_sync') window.__spediti++;
    return posta(m);
  };
})()`;

const CHE_CONTO = `(function(){ return {slot: PIP_SLOT,
  login: mt5ContoAttivo ? String(mt5ContoAttivo.login) : null}; })()`;

async function nuovaFinestra(contesto, slot) {
  const p = await contesto.newPage();
  const errori = ascoltaErrori(p);
  await p.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.goto('file://' + path.join(RADICE, 'app.html') + '?pipSlot=' + slot,
               {waitUntil: 'domcontentloaded'});
  await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
    .forEach(el => el.style.display = 'none'));
  return {pagina: p, errori};
}

// Madre sul conto NUOVO, una duplicata rimasta sul conto VECCHIO.
async function dueFinestreInDisaccordo() {
  const {browser, pagina} = await apriApp();
  const contesto = pagina.context();
  await pagina.evaluate(PONTE_FINTO(CONTO_VECCHIO, CONTO_NUOVO));
  const d2 = await nuovaFinestra(contesto, 2);
  await d2.pagina.evaluate(PONTE_FINTO(CONTO_VECCHIO, CONTO_NUOVO));
  await d2.pagina.evaluate(VAI_SU_CONTO(CONTO_VECCHIO));
  await pagina.evaluate(VAI_SU_CONTO(CONTO_NUOVO));
  const statoMadre = await pagina.evaluate(CHE_CONTO);
  const statoDup = await d2.pagina.evaluate(CHE_CONTO);
  return {browser, contesto, madre: pagina, dup2: d2.pagina, statoMadre, statoDup};
}

test('PROVA DI CONTROLLO: le due finestre di partenza sono davvero in disaccordo', async () => {
  // Senza questa, una terza finestra che prende il conto giusto non dimostrerebbe niente: potrebbe
  // prenderlo perche' nessuno le ha mai offerto quello vecchio.
  const {browser, statoMadre, statoDup} = await dueFinestreInDisaccordo();
  try {
    assert.equal(statoMadre.login, CONTO_NUOVO.login,
      'la madre deve stare sul conto nuovo: ' + JSON.stringify(statoMadre));
    assert.equal(statoDup.login, CONTO_VECCHIO.login,
      'la duplicata deve essere rimasta sul conto vecchio, altrimenti il banco non misura il ' +
      'sintomo segnalato: ' + JSON.stringify(statoDup));
  } finally { await browser.close(); }
});

test('CHI APPLICA UN CONTO ARRIVATO DA FUORI NON LO RI-ANNUNCIA', async () => {
  // IL DIFETTO CURATO. Misurato prima della cura: 1 messaggio spedito dalla duplicata mentre
  // applicava il conto della madre. Non era una risposta a una richiesta: era un eco del percorso
  // mt5AttivaConto -> scheduleSave -> broadcast, che girava fuori dalla barriera anti-rimbalzo.
  const {browser, contesto, dup2} = await dueFinestreInDisaccordo();
  try {
    await dup2.evaluate(SPIA_MESSAGGI);
    const terza = await nuovaFinestra(contesto, 3);
    await dup2.waitForTimeout(1500);
    const spediti = await dup2.evaluate(() => window.__spediti || 0);
    console.log('messaggi spediti dalla duplicata mentre applicava il conto:', spediti);
    assert.equal(spediti, 0,
      'applicare un conto ricevuto non deve far partire nessun annuncio: ne sono partiti ' +
      spediti + '. Chi propaga e la finestra dove l utente ha cambiato conto, non chi riceve.');
    await terza.pagina.close();
  } finally { await browser.close(); }
});

test('la barriera si RIMETTE COM ERA, non a false', async () => {
  // Se fblSenzaRiannunciare() forzasse `false` all uscita, un blocco annidato dentro un altra
  // applicazione spalancherebbe la porta a meta strada - e il cappio tornerebbe da li.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      applyingRemoteTradingSync = true;
      var dentro = null;
      fblSenzaRiannunciare(function(){ dentro = applyingRemoteTradingSync; });
      var dopo = applyingRemoteTradingSync;
      applyingRemoteTradingSync = false;
      var dentro2 = null;
      fblSenzaRiannunciare(function(){ dentro2 = applyingRemoteTradingSync; });
      var dopo2 = applyingRemoteTradingSync;
      return {dentro: dentro, dopo: dopo, dentro2: dentro2, dopo2: dopo2};
    })()`);
    console.log('barriera:', JSON.stringify(r));
    assert.equal(r.dentro, true, 'dentro la barriera deve essere alzata');
    assert.equal(r.dopo, true,
      'era alzata prima, deve restare alzata dopo: ' + JSON.stringify(r));
    assert.equal(r.dentro2, true, 'dentro la barriera deve essere alzata anche partendo da false');
    assert.equal(r.dopo2, false,
      'era abbassata prima, deve tornare abbassata: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('la barriera torna a posto anche se il lavoro dentro fallisce', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      applyingRemoteTradingSync = false;
      var scoppiato = false;
      try{ fblSenzaRiannunciare(function(){ throw new Error('finto'); }); }
      catch(e){ scoppiato = true; }
      return {scoppiato: scoppiato, dopo: applyingRemoteTradingSync};
    })()`);
    console.log('dopo un errore:', JSON.stringify(r));
    assert.equal(r.dopo, false,
      'un errore dentro non deve lasciare la barriera alzata per sempre: da quel momento ' +
      'nessuna finestra annuncerebbe piu niente. ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('NON-REGRESSIONE: la terza finestra prende il conto della madre', async () => {
  // Misurato 6 giri su 6 col conto corretto: le cure del 12-13 novembre tengono. Questa prova
  // serve a saperlo se un domani smettessero di tenere.
  const {browser, contesto} = await dueFinestreInDisaccordo();
  try {
    const terza = await nuovaFinestra(contesto, 3);
    await terza.pagina.waitForTimeout(2000);
    const stato = await terza.pagina.evaluate(CHE_CONTO);
    console.log('conto della terza finestra:', JSON.stringify(stato));
    assert.equal(stato.login, CONTO_NUOVO.login,
      'la terza finestra deve collegarsi al conto CORRENTE della madre (' + CONTO_NUOVO.login +
      '), non a quello di una duplicata rimasta indietro: ha preso ' + stato.login);
    assert.deepEqual(terza.errori, [], 'nessun errore di pagina sulla terza finestra');
  } finally { await browser.close(); }
});
