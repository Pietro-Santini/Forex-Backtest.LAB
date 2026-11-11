// IL CONTO MT5 SCELTO DEVE ESSERE UNO SOLO PER TUTTE LE FINESTRE E TUTTI I DISPOSITIVI.
//
// RICHIESTO dal proprietario (10 novembre 2026): «quando sono collegato con un dispositivo mobile a
// un conto e sul PC dopo vado a cambiare quello che è il conto, l'account, anche sui dispositivi
// mobili questo mi si deve modificare. Cioè se passa da conto 1 a conto 2 sul PC, allora anche sul
// tablet e sugli altri dispositivi mi passerà automaticamente dal conto 1 al conto 2. E viceversa,
// quindi se sul tablet passo dal conto 1 al conto 2 o dal conto 2 al conto 1, sul PC farà la stessa
// identica cosa.»
//
// DOVE SI SCEGLIE IL CONTO (misurato nel sorgente):
//   - il menu a tendina dei conti (#mt5AccountSelect) → connectToMt5Bridge() (riga 53341-53353),
//     unica porta del POST /connect; la risposta viene registrata da mt5AttivaConto() (riga 5924),
//     che riempie mt5ContoAttivo = {login, server};
//   - il conto resta SOLO in memoria: non è salvato in localStorage, non va in cloud, non è
//     annunciato a nessuno. All'avvio lo si riprende SOLO con mt5RiagganciaSilenzioso() (riga 52428),
//     che legge GET /account (cioè il conto su cui il ponte del PC è collegato in QUEL momento);
//   - il canale fra finestre esiste (BroadcastChannel 'fxbt_trading_sync_v1', tradingChannel) e il
//     messaggio 'trading_sync' porta giи il campo conto.mt5 = {login, server} (riga 8793), ma chi
//     riceve lo misura con fblApplicaContoMadre() (riga 48954), che confronta SOLO vivo/vista e NON
//     legge mai il login: due conti MT5 diversi hanno infatti la stessa vista ('mt5') e la stessa
//     modalitа (Live), quindi la decisione е "giа allineato" e il cambio non passa.
//
// Questo banco misura il COMPORTAMENTO con due pagine vere, non le stringhe del sorgente: cambia
// il conto sulla finestra principale per la strada vera dell'utente (connectToMt5Bridge, come fa la
// tendina dei conti) e guarda su che conto resta la duplicata.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

function ascoltaErrori(pagina) {
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  return errori;
}

// Ponte MT5 finto: risponde al POST /connect con il login che gli si chiede, come farebbe il
// bridge vero del PC (bridge.py, /connect). Nessuna rete esce dal banco.
const PONTE_FINTO = (conto1, conto2) => `(function(){
  var reale = window.fetch;
  window.fetch = function(url, opt){
    var u = String(url);
    if(u.indexOf('/connect') < 0) return reale.apply(window, arguments);
    var corpo = {};
    try{ corpo = JSON.parse((opt && opt.body) || '{}'); }catch(e){}
    var login = Number(corpo.login);
    var noto = (login === Number(${JSON.stringify(conto1)}.login)) ? ${JSON.stringify(conto1)}
              : (login === Number(${JSON.stringify(conto2)}.login)) ? ${JSON.stringify(conto2)} : null;
    if(!noto) return Promise.resolve({ok:false, status:400, json:function(){
      return Promise.resolve({detail:'conto non salvato '+login}); }});
    return Promise.resolve({ok:true, status:200, json:function(){
      return Promise.resolve({login:Number(noto.login), server:noto.server, reale:false, trade_mode:'demo'}); }});
  };
})()`;

// Mette QUESTA finestra sul conto MT5 indicato, in Live, con una posizione reale di quel conto:
// е esattamente lo stato in cui si trova una finestra collegata a un conto MT5.
const VAI_SU_CONTO = (conto, conPosizione) => `(function(){
  mt5AttivaConto(${JSON.stringify(conto)}.login, ${JSON.stringify(conto)}.server, false, 'demo');
  liveModeActive = true; liveReplayActive = false; mt5Connected = true; mt5MonitorOnly = false;
  fblContoVista = 'mt5';
  currentAssetKey = 'EURUSD';
  positions.length = 0; pendingOrders.length = 0; trades.length = 0;
  ${conPosizione ? "positions.push({id:'p1',asset:'EURUSD',side:'BUY',entry:1.1,sl:1.09,tp:1.11,lots:0.1,createdAt:1,mt5Ticket:7001,mt5Login:String(" + JSON.stringify(conto) + ".login),mt5Server:" + JSON.stringify(conto) + ".server});" : ''}
  return {login: mt5ContoAttivo ? String(mt5ContoAttivo.login) : null, vista: fblContoVista, live: liveModeActive};
})()`;

const LEGGI_STATO = () => ({slot: PIP_SLOT, login: mt5ContoAttivo ? String(mt5ContoAttivo.login) : null,
  server: mt5ContoAttivo ? String(mt5ContoAttivo.server || '') : '', vista: fblContoVista,
  live: liveModeActive, posizioni: positions.map(p => String(p.mt5Login || ''))});

async function apriDueFinestre() {
  const {browser, pagina, errori} = await apriApp();
  const p2 = await pagina.context().newPage();
  const errori2 = ascoltaErrori(p2);
  await p2.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p2.goto('file://' + path.join(RADICE, 'app.html') + '?pipSlot=2', {waitUntil: 'domcontentloaded'});
  await p2.waitForTimeout(2500);
  await p2.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
    .forEach(el => el.style.display = 'none'));
  return {browser, madre: pagina, duplicata: p2, errori, errori2};
}

const CONTO1 = {login: '50100111', server: 'BrokeOne-Demo'};
const CONTO2 = {login: '50100222', server: 'BrokeOne-Demo'};

// PROVA DI CONTROLLO: senza questa le altre non concluderebbero niente. Se il canale fra le due
// pagine non trasportasse i messaggi, una duplicata che non si allinea non significherebbe che il
// programma li trattiene — significherebbe che il banco non puo' misurare.
test('PROVA DI CONTROLLO: il canale porta il conto dalla madre alla duplicata', async () => {
  const {browser, madre, duplicata} = await apriDueFinestre();
  try {
    await madre.evaluate(PONTE_FINTO(CONTO1, CONTO2));
    await duplicata.evaluate(PONTE_FINTO(CONTO1, CONTO2));
    await madre.evaluate(VAI_SU_CONTO(CONTO1, false));
    await duplicata.evaluate(`(function(){
      window.__arrivi = [];
      var orig = tradingChannel.onmessage;
      tradingChannel.onmessage = function(ev){ try{ window.__arrivi.push(ev && ev.data); }catch(e){}
        try{ orig && orig(ev); }catch(e){} };
    })()`);
    await madre.evaluate(`(function(){ broadcastTradingStateNow(); })()`);
    await duplicata.waitForTimeout(900);
    const arrivi = await duplicata.evaluate(() => (window.__arrivi || [])
      .filter(m => m && m.type === 'trading_sync')
      .map(m => ({vivo: m.conto && m.conto.vivo, vista: m.conto && m.conto.vista,
                  login: m.conto && m.conto.mt5 ? String(m.conto.mt5.login) : null})));
    assert.ok(arrivi.length > 0, 'il banco non riesce a misurare: nessun trading_sync ricevuto');
    assert.equal(arrivi[arrivi.length - 1].login, CONTO1.login,
      'il messaggio deve portare il conto MT5 della madre: ' + JSON.stringify(arrivi));
  } finally { await browser.close(); }
});

// IL DIFETTO. Percorso vero dell'utente: sulla madre si sceglie l'altro conto dalla tendina
// (connectToMt5Bridge, la stessa strada di #mt5AccountSelect, riga 53353). La duplicata, che stava
// sullo STESSO conto, deve seguire.
test('cambiando conto MT5 sulla madre, la duplicata passa allo stesso conto', async () => {
  const {browser, madre, duplicata, errori, errori2} = await apriDueFinestre();
  try {
    await madre.evaluate(PONTE_FINTO(CONTO1, CONTO2));
    await duplicata.evaluate(PONTE_FINTO(CONTO1, CONTO2));
    // Le due finestre sullo STESSO conto MT5, ognuna con la sua posizione reale.
    const primaMadre = await madre.evaluate(VAI_SU_CONTO(CONTO1, true));
    const primaDup = await duplicata.evaluate(VAI_SU_CONTO(CONTO1, true));
    assert.equal(primaMadre.login, CONTO1.login);
    assert.equal(primaDup.login, CONTO1.login, 'la duplicata deve partire dal conto 1');
    // La duplicata registra quello che arriva dal canale.
    await duplicata.evaluate(`(function(){
      window.__arrivi = [];
      var orig = tradingChannel.onmessage;
      tradingChannel.onmessage = function(ev){ try{ window.__arrivi.push(ev && ev.data); }catch(e){}
        try{ orig && orig(ev); }catch(e){} };
    })()`);
    // IL CAMBIO CONTO, sulla madre, per la strada della tendina dei conti.
    const cambio = await madre.evaluate(`(async function(){
      var acc = {login: ${JSON.stringify(CONTO2)}.login, password:'x',
                 server: ${JSON.stringify(CONTO2)}.server};
      mt5SavedAccounts = [${JSON.stringify(CONTO1)}, ${JSON.stringify(CONTO2)}]
        .map(function(a){ return {login:a.login, password:'x', server:a.server}; });
      var r = await connectToMt5Bridge(acc);
      return {ok: !!(r && r.ok), login: mt5ContoAttivo ? String(mt5ContoAttivo.login) : null,
              parcheggiate: r && r.notaConti ? r.notaConti : null};
    })()`);
    assert.equal(cambio.ok, true, 'il ponte finto deve accettare il cambio conto');
    assert.equal(cambio.login, CONTO2.login, 'la madre deve essere passata sul conto 2');
    // Il tempo che impiegherebbe il polling a dire la sua: due secondi abbondanti.
    await duplicata.waitForTimeout(2500);
    const stato = await duplicata.evaluate(LEGGI_STATO);
    const arrivi = await duplicata.evaluate(() => (window.__arrivi || [])
      .filter(m => m && m.type === 'trading_sync')
      .map(m => ({login: m.conto && m.conto.mt5 ? String(m.conto.mt5.login) : null,
                  pos: (m.positions || []).map(function(p){ return String(p.mt5Login || ''); })})));
    assert.deepEqual(errori, [], 'nessun errore di pagina sulla madre');
    assert.deepEqual(errori2, [], 'nessun errore di pagina sulla duplicata');
    assert.equal(stato.login, CONTO2.login,
      'la duplicata deve seguire la madre sul conto 2: invece е ancora su ' + stato.login
      + '. Messaggi ricevuti dal canale: ' + JSON.stringify(arrivi));
  } finally { await browser.close(); }
});

// L'ANNUNCIO, misurato da solo: il cambio conto sulla madre parte da connectToMt5Bridge(), che
// trasmette alle altre finestre SOLO se c'era qualcosa da parcheggiare (mt5AttivaConto chiama
// scheduleSave() solo quando parcheggiate||riprese, riga 6012). Senza posizioni da spostare,
// l'annuncio dipende da quali altri giri gli capitano di chiamare scheduleSave().
test('il cambio conto viene annunciato sul canale anche senza posizioni da spostare', async () => {
  const {browser, madre, duplicata} = await apriDueFinestre();
  try {
    await madre.evaluate(PONTE_FINTO(CONTO1, CONTO2));
    await duplicata.evaluate(PONTE_FINTO(CONTO1, CONTO2));
    await madre.evaluate(VAI_SU_CONTO(CONTO1, false));
    await duplicata.evaluate(VAI_SU_CONTO(CONTO1, false));
    await duplicata.evaluate(`(function(){
      window.__arrivi = [];
      var orig = tradingChannel.onmessage;
      tradingChannel.onmessage = function(ev){ try{ window.__arrivi.push(ev && ev.data); }catch(e){}
        try{ orig && orig(ev); }catch(e){} };
    })()`);
    await madre.evaluate(`(async function(){
      await connectToMt5Bridge({login: ${JSON.stringify(CONTO2)}.login, password:'x',
                                server: ${JSON.stringify(CONTO2)}.server});
    })()`);
    await duplicata.waitForTimeout(2500);
    const arrivi = await duplicata.evaluate(() => (window.__arrivi || [])
      .filter(m => m && m.type === 'trading_sync')
      .map(m => (m.conto && m.conto.mt5) ? String(m.conto.mt5.login) : null));
    assert.ok(arrivi.indexOf(CONTO2.login) >= 0,
      'il conto nuovo NON viene annunciato alle altre finestre: ricevuti ' + JSON.stringify(arrivi));
  } finally { await browser.close(); }
});

// E IL VERSO INVERSO, che il proprietario ha chiesto a chiare lettere («e viceversa, quindi se sul
// tablet passo dal conto 1 al conto 2 o dal conto 2 al conto 1, sul PC farà la stessa identica
// cosa»): qui il cambio lo fa la DUPLICATA e deve seguirlo la finestra principale.
test('cambiando conto MT5 sulla duplicata, la finestra principale passa allo stesso conto', async () => {
  const {browser, madre, duplicata, errori, errori2} = await apriDueFinestre();
  try {
    await madre.evaluate(PONTE_FINTO(CONTO1, CONTO2));
    await duplicata.evaluate(PONTE_FINTO(CONTO1, CONTO2));
    const primaMadre = await madre.evaluate(VAI_SU_CONTO(CONTO1, true));
    const primaDup = await duplicata.evaluate(VAI_SU_CONTO(CONTO1, true));
    assert.equal(primaMadre.login, CONTO1.login);
    assert.equal(primaDup.login, CONTO1.login);
    await madre.evaluate(`(function(){
      window.__arrivi = [];
      var orig = tradingChannel.onmessage;
      tradingChannel.onmessage = function(ev){ try{ window.__arrivi.push(ev && ev.data); }catch(e){}
        try{ orig && orig(ev); }catch(e){} };
    })()`);
    // Il cambio conto sulla duplicata, stessa strada della tendina dei conti.
    await duplicata.evaluate(`(async function(){
      await connectToMt5Bridge({login: ${JSON.stringify(CONTO2)}.login, password:'x',
                                server: ${JSON.stringify(CONTO2)}.server});
    })()`);
    await madre.waitForTimeout(2500);
    const stato = await madre.evaluate(LEGGI_STATO);
    const arrivi = await madre.evaluate(() => (window.__arrivi || [])
      .filter(m => m && m.type === 'trading_sync')
      .map(m => ({login: m.conto && m.conto.mt5 ? String(m.conto.mt5.login) : null,
                  pos: (m.positions || []).length})));
    assert.deepEqual(errori, [], 'nessun errore di pagina sulla madre');
    assert.deepEqual(errori2, [], 'nessun errore di pagina sulla duplicata');
    assert.equal(stato.login, CONTO2.login,
      'la finestra principale deve seguire la duplicata sul conto 2: invece е ancora su '
      + stato.login + '. Messaggi ricevuti dal canale: ' + JSON.stringify(arrivi));
  } finally { await browser.close(); }
});

// LA DECISIONE, misurata direttamente con il messaggio che la madre manda DAVVERO (voce 5):
// la duplicata sul conto 1, la madre passata al conto 2, stessa modalitа (Live) e stessa vista
// (mt5). Oggi la risposta е "cambiato:false, motivo:gia allineato" — ecco perche' non si allinea.
test('la decisione sul conto della madre deve guardare anche il login MT5', async () => {
  const {browser, pagina, errori} = await apriApp({query: '?pipSlot=2'});
  try {
    const r = await pagina.evaluate(`(function(){
      liveModeActive = true; fblContoVista = 'mt5';
      mt5AttivaConto(${JSON.stringify(CONTO1)}.login, ${JSON.stringify(CONTO1)}.server, false, 'demo');
      // Il campo conto esattamente come lo costruisce collectTradingSyncPayload() (riga 8790).
      var conto = {vivo: true, vista: 'mt5',
                   mt5: {login: ${JSON.stringify(CONTO2)}.login, server: ${JSON.stringify(CONTO2)}.server}};
      return fblApplicaContoMadre(conto);
    })()`);
    assert.deepEqual(errori, []);
    assert.equal(r.cambiato, true,
      'due conti MT5 diversi devono far scattare il cambio: invece la decisione dice '
      + JSON.stringify(r));
  } finally { await browser.close(); }
});
