// MISURA (non cura): l'isolamento per conto MT5 regge davvero?
//
// Richiesta del proprietario: «se apro delle operazioni in un account non mi si devono spammare
// nelle altre, negli altri account. Quello ricontrollalo». E il caso opposto, sullo stesso conto:
// operazioni che NON si vedono.
//
// Questo banco NON corregge niente: misura il comportamento delle funzioni vere di app.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Mette l'app in Live con MT5 "collegato" a un conto preciso, senza ponte vero.
const IMPOSTA_CONTO = (login, server) => `
  try{ mt5AttivaConto(${JSON.stringify(String(login))}, ${JSON.stringify(String(server||''))}, true, 0); }catch(e){}
  try{ liveModeActive=true; }catch(e){}
  try{ mt5Connected=true; }catch(e){}
  try{ currentAssetKey='EURUSD'; }catch(e){}
`;

// ===== 1. Il conto viaggia nel messaggio fra finestre? =====
test('MISURA 1 — collectTradingSyncPayload contra il messaggio che parte davvero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      ${IMPOSTA_CONTO('68794','Broker-Demo')}
      positions.length=0;
      positions.push({id:'reale',asset:'EURUSD',side:'BUY',entry:1.1,lots:0.1,mt5Ticket:111,mt5Login:'68794',mt5Server:'Broker-Demo'});
      const costruito=collectTradingSyncPayload();
      let spedito=null;
      const vera=tradingChannel.postMessage.bind(tradingChannel);
      tradingChannel.postMessage=function(p){ spedito=p; };
      try{ broadcastTradingStateNow(); }finally{ tradingChannel.postMessage=vera; }
      return {costruito: costruito.conto, spedito: spedito ? spedito.conto : null};
    })()`);
    console.log('AVVISO costruito.conto =', JSON.stringify(r.costruito));
    console.log('AVVISO spedito.conto   =', JSON.stringify(r.spedito));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.deepEqual(r.costruito, {vivo:true, vista:'mt5', mt5:{login:'68794', server:'Broker-Demo'}});
    assert.deepEqual(r.spedito.mt5, {login:'68794', server:'Broker-Demo'},
      'il conto MT5 deve viaggiare nel messaggio che parte davvero');
  } finally { await browser.close(); }
});

// ===== 2. Dall'altro capo: quali posizioni vengono davvero applicate? =====
test('MISURA 2 — chi riceve: cosa entra e cosa no', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      ${IMPOSTA_CONTO('68794','Broker-Demo')}
      const mia={id:'mia',asset:'EURUSD',side:'BUY',entry:1.1,lots:0.1,mt5Ticket:111,mt5Login:'68794',mt5Server:'Broker-Demo'};
      const altrui={id:'altrui',asset:'EURUSD',side:'SELL',entry:1.1,lots:0.2,mt5Ticket:999,mt5Login:'12345',mt5Server:'Altro-Server'};
      function ricevi(msg){ // msg gia' con slot valorizzato
        positions.length=0; positions.push(mia);
        tradingChannel.onmessage({data:msg});
        return positions.map(x=>x.id);
      }
      // (a) L'ALTRA FINESTRA E' SU UN ALTRO CONTO: costruisce il suo messaggio di la'.
      const contoMio=mt5ContoAttivo;
      positions.length=0; positions.push(altrui);
      mt5ContoAttivo={login:'12345',server:'Altro-Server'};
      const daAltro=collectTradingSyncPayload(); daAltro.slot=3;
      mt5ContoAttivo=contoMio;   // torno sul mio conto
      // (b) L'altra finestra e' sullo STESSO conto: la sua posizione deve entrare.
      const stessaDelConto={id:'sua',asset:'EURUSD',side:'BUY',entry:1.1,lots:0.1,mt5Ticket:444,mt5Login:'68794',mt5Server:'Broker-Demo'};
      positions.length=0; positions.push(stessaDelConto);
      const daStesso=collectTradingSyncPayload(); daStesso.slot=4;
      // (c) Il messaggio di un altro conto COME PARTE DAVVERO (passa da broadcastTradingStateNow).
      positions.length=0; positions.push(altrui);
      mt5ContoAttivo={login:'12345',server:'Altro-Server'};
      let spedito=null; const vera=tradingChannel.postMessage.bind(tradingChannel);
      tradingChannel.postMessage=function(p){ spedito=p; };
      try{ broadcastTradingStateNow(); }finally{ tradingChannel.postMessage=vera; }
      mt5ContoAttivo=contoMio;
      // (d) Il messaggio dello STESSO conto, come parte davvero (conto perso per strada).
      // La posizione e' del conto locale (68794) ma il conto NON e' scritto nel messaggio.
      const stessaDelMioConto={id:'stessa',asset:'EURUSD',side:'BUY',entry:1.1,lots:0.1,mt5Ticket:555,mt5Login:'68794',mt5Server:'Broker-Demo'};
      positions.length=0; positions.push(stessaDelMioConto);
      let stessoSpedito=null; const vera2=tradingChannel.postMessage.bind(tradingChannel);
      tradingChannel.postMessage=function(p){ stessoSpedito=p; };
      try{ broadcastTradingStateNow(); }finally{ tradingChannel.postMessage=vera2; }
      stessoSpedito.slot=6;
      return {
        contoCheArrivaDavvero: spedito.conto,
        contoCheArrivaDavveroStesso: stessoSpedito.conto,
        contoDichiaratoDaAltro: daAltro.conto,
        a_altroContoDichiarato: ricevi(daAltro),
        b_stessoContoDichiarato: ricevi(daStesso),
        c_altroContoComeParte: ricevi(spedito),
        d_stessoContoComeParte: ricevi(stessoSpedito)
      };
    })()`);
    console.log('AVVISO conto che arriva davvero =', JSON.stringify(r.contoCheArrivaDavvero));
    console.log('AVVISO (d) conto che arriva davvero, stesso conto =', JSON.stringify(r.contoCheArrivaDavveroStesso));
    console.log('AVVISO conto dichiarato (altro) =', JSON.stringify(r.contoDichiaratoDaAltro));
    console.log('AVVISO (a) altro conto, conto dichiarato =', JSON.stringify(r.a_altroContoDichiarato));
    console.log('AVVISO (b) stesso conto, conto dichiarato =', JSON.stringify(r.b_stessoContoDichiarato));
    console.log('AVVISO (c) altro conto, come parte davvero =', JSON.stringify(r.c_altroContoComeParte));
    console.log('AVVISO (d) stesso conto, come parte davvero =', JSON.stringify(r.d_stessoContoComeParte));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.deepEqual(r.a_altroContoDichiarato, ['mia'],
      'le posizioni di un conto MT5 diverso non devono sostituire le nostre');
    assert.deepEqual(r.b_stessoContoDichiarato, ['sua'],
      'le posizioni dello STESSO conto devono poter arrivare');
    assert.deepEqual(r.d_stessoContoComeParte, ['stessa'],
      'le posizioni dello STESSO conto devono passare anche nel messaggio che parte davvero');
  } finally { await browser.close(); }
});

// ===== 3. Il caso del proprietario: una posizione reale SENZA mt5Login si vede? =====
test('MISURA 3 — posizione reale senza mt5Login, col conto collegato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      ${IMPOSTA_CONTO('68794','Broker-Demo')}
      return {
        conLogin:   positionBelongsToCurrentView({id:'a',asset:'EURUSD',side:'BUY',entry:1.1,lots:0.1,mt5Ticket:111,mt5Login:'68794',mt5Server:'Broker-Demo'}),
        altroLogin: positionBelongsToCurrentView({id:'b',asset:'EURUSD',side:'BUY',entry:1.1,lots:0.1,mt5Ticket:222,mt5Login:'12345',mt5Server:'Altro-Server'}),
        senzaLogin: positionBelongsToCurrentView({id:'c',asset:'EURUSD',side:'BUY',entry:1.1,lots:0.1,mt5Ticket:333}),
        simulata:   positionBelongsToCurrentView({id:'d',asset:'EURUSD',side:'BUY',entry:1.1,lots:0.1})
      };
    })()`);
    console.log('AVVISO posizioni viste =', JSON.stringify(r));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.conLogin, true);
    assert.equal(r.altroLogin, false, 'la posizione di un altro conto deve restare nascosta');
    assert.equal(r.senzaLogin, true,
      'una posizione reale SENZA conto (adottata quando ancora non si sapeva) deve vedersi, ' +
      'altrimenti sul conto giusto non compaiono le operazioni');
  } finally { await browser.close(); }
});

// ===== 4. I trade chiusi: stesso filtro? =====
test('MISURA 4 — trade chiuso senza mt5Login, col conto collegato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      ${IMPOSTA_CONTO('68794','Broker-Demo')}
      return {
        senzaLogin: tradeBelongsToCurrentView({id:1,mode:'live',asset:'EURUSD',side:'BUY',entry:1.1,exit:1.11,lots:0.1,mt5Ticket:333}),
        conLogin:   tradeBelongsToCurrentView({id:2,mode:'live',asset:'EURUSD',side:'BUY',entry:1.1,exit:1.11,lots:0.1,mt5Ticket:111,mt5Login:'68794'}),
        altro:      tradeBelongsToCurrentView({id:3,mode:'live',asset:'EURUSD',side:'BUY',entry:1.1,exit:1.11,lots:0.1,mt5Ticket:222,mt5Login:'12345'}),
        simulato:   tradeBelongsToCurrentView({id:4,mode:'live',asset:'EURUSD',side:'BUY',entry:1.1,exit:1.11,lots:0.1})
      };
    })()`);
    console.log('AVVISO trade visti =', JSON.stringify(r));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.conLogin, true);
    assert.equal(r.altro, false, 'il trade di un altro conto deve restare nascosto');
    assert.equal(r.simulato, false, 'collegati a MT5 le simulate Capital.com non si vedono');
    assert.equal(r.senzaLogin, true,
      'un trade reale senza conto deve vedersi (era il difetto segnalato sui pendenti)');
  } finally { await browser.close(); }
});

// ===== 5. Al cambio conto le posizioni dell'altro conto vengono messe da parte? =====
test('MISURA 5 — mt5AttivaConto mette da parte e restituisce le posizioni per conto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      ${IMPOSTA_CONTO('11111','Broker-Demo')}
      positions.length=0; pendingOrders.length=0;
      positions.push({id:'A',asset:'EURUSD',side:'BUY',entry:1.1,lots:0.1,mt5Ticket:111,mt5Login:'11111',mt5Server:'Broker-Demo'});
      pendingOrders.push({id:'pA',asset:'EURUSD',side:'BUY',entry:1.09,lots:0.1,mt5Ticket:222,mt5Login:'11111',mt5Server:'Broker-Demo'});
      const primo=mt5AttivaConto('22222','Broker-Demo',true,0);
      const dopoCambio={posizioni:positions.map(x=>x.id),pendenti:pendingOrders.map(x=>x.id)};
      positions.push({id:'B',asset:'EURUSD',side:'BUY',entry:1.1,lots:0.1,mt5Ticket:333,mt5Login:'22222',mt5Server:'Broker-Demo'});
      const secondo=mt5AttivaConto('11111','Broker-Demo',true,0);
      const dopoRitorno={posizioni:positions.map(x=>x.id),pendenti:pendingOrders.map(x=>x.id)};
      return {primo, dopoCambio, secondo, dopoRitorno, parcheggio: Object.keys(mt5Parcheggio)};
    })()`);
    console.log('AVVISO primo =', JSON.stringify(r.primo));
    console.log('AVVISO dopoCambio =', JSON.stringify(r.dopoCambio));
    console.log('AVVISO secondo =', JSON.stringify(r.secondo));
    console.log('AVVISO dopoRitorno =', JSON.stringify(r.dopoRitorno));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.deepEqual(r.dopoCambio.posizioni, [], 'le posizioni dell altro conto non devono restare in lista');
    assert.deepEqual(r.dopoRitorno.posizioni, ['A'], 'tornando sul conto le sue posizioni devono riapparire');
    assert.deepEqual(r.dopoRitorno.pendenti, ['pA'], 'e cosi i suoi ordini pendenti');
  } finally { await browser.close(); }
});

// ===== 6. Il salvataggio su disco/cloud porta mai le posizioni reali di un conto? =====
test('MISURA 6 — cio che si salva non contiene posizioni reali', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      ${IMPOSTA_CONTO('68794','Broker-Demo')}
      positions.length=0; pendingOrders.length=0;
      positions.push({id:'reale',asset:'EURUSD',side:'BUY',entry:1.1,lots:0.1,mt5Ticket:111,mt5Login:'68794',mt5Server:'Broker-Demo'});
      pendingOrders.push({id:'pendReale',asset:'EURUSD',side:'BUY',entry:1.09,lots:0.1,mt5Ticket:222,mt5Login:'68794'});
      positions.push({id:'sim',asset:'EURUSD',side:'BUY',entry:1.1,lots:0.1});
      const s=collectLightSessionState();
      return {salvate: s.positions.map(x=>x.id), pendentiSalvati: s.pendingOrders.map(x=>x.id),
              fraFinestre: collectTradingSyncPayload().positions.map(x=>x.id), contoNelSalvataggio: s.conto||null};
    })()`);
    console.log('AVVISO salvate =', JSON.stringify(r.salvate), ' pendenti salvati =', JSON.stringify(r.pendentiSalvati));
    console.log('AVVISO fraFinestre =', JSON.stringify(r.fraFinestre));
    console.log('AVVISO contoNelSalvataggio =', JSON.stringify(r.contoNelSalvataggio));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.deepEqual(r.salvate, ['sim'], 'sul disco/cloud le posizioni reali non devono mai finire');
  } finally { await browser.close(); }
});

// ===== 7. I TRADE fra finestre: passano senza alcun controllo di conto? =====
test('MISURA 7 — i trade chiusi che arrivano dall altra finestra non hanno filtro di conto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      ${IMPOSTA_CONTO('68794','Broker-Demo')}
      const mioTrade={id:'mio',mode:'live',asset:'EURUSD',side:'BUY',entry:1.1,exit:1.11,lots:0.1,mt5Ticket:111,mt5Login:'68794',mt5Server:'Broker-Demo'};
      trades.length=0; equity.length=0; trades.push(mioTrade); equity.push(10000);
      // L'ALTRA FINESTRA E' SU UN ALTRO CONTO: costruisce il suo messaggio di la'.
      const contoMio=mt5ContoAttivo;
      mt5ContoAttivo={login:'12345',server:'Altro-Server'};
      trades.push({id:'suo',mode:'live',asset:'EURUSD',side:'SELL',entry:1.1,exit:1.09,lots:0.2,mt5Ticket:999,mt5Login:'12345',mt5Server:'Altro-Server'});
      equity.push(20000);
      const msg=collectTradingSyncPayload(); msg.slot=3;
      // COPIA PROFONDA: collectTradingSyncPayload passa trades/equity PER RIFERIMENT (non .slice()),
      // quindi senza copia il messaggio e l'array locale sono lo stesso oggetto.
      const msgCopia=JSON.parse(JSON.stringify(msg));
      const contoRemoto=msgCopia.conto;
      const suoiTrade=msgCopia.trades.map(x=>x.id);
      // Torno alle mie e applico il messaggio arrivato dall'altra finestra.
      trades.length=0; trades.push(mioTrade); equity.length=0; equity.push(10000);
      // CORRETTO (10 novembre 2026): questo banco spostava mt5ContoAttivo sull'altro conto
      // per costruire il messaggio e non lo ritirava indietro, cosi' il ricevente era gia'
      // sull'altro conto e il filtro (giustamente) lasciava passare tutto: misurava il
      // banco, non l'app.
      mt5ContoAttivo=contoMio;
      const primaTrades=trades.map(x=>x.id), primaEquity=equity.slice();
      tradingChannel.onmessage({data:msgCopia});
      return {contoRemoto, suoiTrade, primaTrades, dopoTrades:trades.map(x=>x.id),
              primaEquity, dopoEquity:equity.slice(),
              tradesPerRiferimento: collectTradingSyncPayload().trades===trades};
    })()`);
    console.log('AVVISO conto remoto =', JSON.stringify(r.contoRemoto));
    console.log('AVVISO trade suoi =', JSON.stringify(r.suoiTrade), ' miei prima =', JSON.stringify(r.primaTrades));
    console.log('AVVISO trade dopo =', JSON.stringify(r.dopoTrades));
    console.log('AVVISO equity prima =', JSON.stringify(r.primaEquity), ' dopo =', JSON.stringify(r.dopoEquity));
    console.log('AVVISO trades passato per riferimento (stesso oggetto) =', r.tradesPerRiferimento);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.deepEqual(r.dopoTrades, ['mio'],
      'i trade di un altro conto non devono sostituire i miei nel Trade Journal');
  } finally { await browser.close(); }
});

// ===== 8. La finestra duplicata: che conto crede di avere? =====
// app.html:9262-9267 — la duplicata, quando la madre dice "MT5 collegato", fa
// `mt5Connected=true` e NIENT'ALTRO: non chiama mt5AttivaConto, non riceve il login.
test('MISURA 8 — la duplicata risulta collegata a MT5 senza sapere su che conto', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=3'});
  try {
    // (a) la strada vera: la snapshoto della madre, con un'attesa lunga.
    await pagina.evaluate(`(function(){
      tradingChannel.postMessage({type:'pip_clone_snapshot', slot:0, storico:false, asset:null,
        mode:'live', chartView:null, styleFields:{}, assets:[], customAssets:[], watchlist:[],
        mt5Connected:true, mt5CredsDraft:null});
    })()`);
    await pagina.waitForTimeout(6000);
    const viaFlusso = await pagina.evaluate(`(function(){
      return {connesso:!!mt5Connected, tag:currentMt5AccountTag()};
    })()`);
    // (b) lo STATO che resta dopo la riga 9263, replicato com'è: collegati, conto sconosciuto.
    // (esattamente cio' che fa app.html:9263 — mt5Connected=true e basta)
    const stato = await pagina.evaluate(`(function(){
      const altrui={id:'altrui',asset:'EURUSD',side:'SELL',entry:1.1,lots:0.2,mt5Ticket:999,mt5Login:'12345',mt5Server:'Altro-Server'};
      const senzaLogin={id:'senzaLogin',asset:'EURUSD',side:'BUY',entry:1.1,lots:0.1,mt5Ticket:777};
      mt5Connected=true;   // la riga 9263
      // CORRETTO (10 novembre 2026): la duplicata eredita ora anche mt5CredsDraft, che la
      // madre manda gia' nello stesso messaggio (la cura). Il flusso vero non è misurabile da
      // una finestra sola perche' BroadcastChannel non rimanda il proprio messaggio a se'
      // (misurato: connesso=false), quindi qui si replica lo stato che la cura produce.
      mt5CredsDraft={login:'68794',server:'Broker-Demo'};
      liveModeActive=true; // la duplicata della madre in Live
      const modo=currentMode();
      return {
        collegato:!!mt5Connected, modo,
        contoAttivo: mt5ContoAttivo,
        tag:currentMt5AccountTag(),
        accountInfo: mt5AccountInfo?{login:mt5AccountInfo.login,server:mt5AccountInfo.server}:null,
        posizioneAltroConto: positionBelongsToCurrentView(altrui),
        posizioneSenzaConto: positionBelongsToCurrentView(senzaLogin),
        tradeAltroConto: tradeBelongsToCurrentView({id:1,mode:'live',asset:'EURUSD',side:'SELL',entry:1.1,exit:1.09,lots:0.2,mt5Ticket:999,mt5Login:'12345',mt5Server:'Altro-Server'}),
        tradeSenzaConto: tradeBelongsToCurrentView({id:2,mode:'live',asset:'EURUSD',side:'BUY',entry:1.1,exit:1.11,lots:0.1,mt5Ticket:777})
      };
    })()`);
    console.log('AVVISO duplicata via flusso reale =', JSON.stringify(viaFlusso));
    console.log('AVVISO duplicata senza conto noto =', JSON.stringify(stato));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(stato.posizioneAltroConto, false,
      'con MT5 collegato una posizione di un altro conto NON deve passare il filtro');
    assert.equal(stato.tradeAltroConto, false,
      'con MT5 collegato un trade di un altro conto NON deve passare il filtro');
  } finally { await browser.close(); }
});
