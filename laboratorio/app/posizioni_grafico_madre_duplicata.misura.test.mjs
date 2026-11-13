// MISURA (non correzione) — DIFETTO: «nella finestra MADRE le posizioni dello storico non si
// vedono a grafico, nella DUPLICATA sì; senza indicatori non si vede niente».
//
// Si misura, in numeri:
//  1. il filtro che decide cosa arriva a grafico (tradeBelongsToCurrentView /
//     positionBelongsToCurrentView) contro ciò che mostra il Trade Journal;
//  2. cosa riceve davvero la finestra duplicata dal messaggio della madre;
//  3. l'interruttore delle posizioni chiuse (spento di default);
//  4. se gli indicatori cambiano qualcosa nel disegno delle posizioni;
//  5. se in Live l'asset della madre arriva alla duplicata (belongsToCurrentAsset).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// 600 candele da 1 minuto che finiscono adesso: i 3 trade dello "storico" cadono dentro.
const candele = (n=600) => {
  const t0 = Date.now() - n*60000; let p = 2350; const R = [];
  for (let i=0;i<n;i++){ const o=p, c=p+Math.sin(i/11)*1.5;
    R.push({date:new Date(t0+i*60000).toISOString(), open:o, high:Math.max(o,c)+1, low:Math.min(o,c)-1, close:c, volume:10}); p=c; }
  return R;
};
// Le tre operazioni chiuse di cui parla il proprietario (20:27, 20:38, 22:43), sull'oro, fatte
// "nello storico". startTime = ms di apertura, closedAt = ISO di chiusura.
const treTrade = (C) => {
  const t0 = Date.parse(C[0].date);
  return [
    {id:'T1', asset:'XAU/USD', side:'BUY',  entry:2348, exit:2352, sl:2344, tp:2355, lots:0.1, pl:40,  pips:400, mode:'backtest',
     startTime:t0+300*60000, closedAt:new Date(t0+330*60000).toISOString(), closeTF:1, openTF:1, mt5Ticket:null, mt5Login:null},
    {id:'T2', asset:'XAU/USD', side:'SELL', entry:2352, exit:2350, sl:2356, tp:2346, lots:0.1, pl:-200, pips:-200, mode:'backtest',
     startTime:t0+400*60000, closedAt:new Date(t0+420*60000).toISOString(), closeTF:1, openTF:1, mt5Ticket:null, mt5Login:null},
    {id:'T3', asset:'XAU/USD', side:'BUY',  entry:2351, exit:2360, sl:2347, tp:2362, lots:0.2, pl:180, pips:900, mode:'backtest',
     startTime:t0+540*60000, closedAt:new Date(t0+560*60000).toISOString(), closeTF:1, openTF:1, mt5Ticket:null, mt5Login:null}
  ];
};

const prepara = (C) => `(function(){
  rows=CJSON; baseRows=CJSON; idx=CJSON.length-1; viewEnd=CJSON.length-1; visibleCount=400;
  currentAssetKey='XAU/USD'; if(typeof rowsAssetKey!=='undefined')rowsAssetKey='XAU/USD';
  liveReplayActive=false; fblBacktestModeAttivo=false; positionsVisible=true;
  localStorage.setItem('fbl_posizioni_chiuse','0');
  trades=${JSON.stringify(treTrade(C))};
  positions=[]; pendingOrders=[];
  var sel=document.getElementById('journalModeFilterSelect'); if(sel)sel.value='all';
  return true;
})()`.replace(/CJSON/g, () => 'C');

test('madre in Live con MT5: il Trade Journal mostra le 3, il grafico NON le passa (filtro modo)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const C = candele(600);
    const r = await pagina.evaluate(`(function(){
      var C=${JSON.stringify(C)};
      ${prepara(C)}
      function contaFiltro(){ return trades.filter(function(t){return tradeBelongsToCurrentView(t);}).length; }
      function contaAsset(){ return trades.filter(function(t){return belongsToCurrentAsset(t);}).length; }
      function contaPosizioni(){ return positions.filter(function(p){return drawableOnCurrentChart(p);}).length; }
      // Il journal conta ciò che passa il SUO filtro (quello del pannello a parte)
      function contaJournal(){ return trades.filter(function(t){return journalTradeMatchesFilter(t,'all');}).length; }
      var out={journal:contaJournal(), asset:contaAsset()};
      // a) conto STORICO (backtest) - nessun filtro sorgente
      liveModeActive=false; mt5Connected=true; out.storico=contaFiltro();
      // b) LIVE con MT5 collegato: le operazioni dello "storico" (mode backtest, senza ticket)
      liveModeActive=true; mt5Connected=true; mt5ContoAttivo={login:'68794',server:'X-Live'};
      out.liveMt5_storico=contaFiltro(); out.posizioniStorico=contaPosizioni();
      // c) LIVE senza MT5 collegato (la duplicata prima del warm-start)
      mt5Connected=false; mt5ContoAttivo=null; out.liveNoMt5=contaFiltro();
      // d) LIVE con MT5: una operazione REALE di quel conto passa
      mt5Connected=true; mt5ContoAttivo={login:'68794',server:'X-Live'};
      trades.push({id:'T4', asset:'XAU/USD', side:'BUY', entry:2349, exit:2353, pl:20, mode:'live',
                   startTime:Date.now()-30*60000, closedAt:new Date().toISOString(), closeTF:1, openTF:1,
                   mt5Ticket:12345, mt5Login:'68794'});
      out.liveMt5_reale=contaFiltro();
      // d2) operazione reale SENZA login salvato (registrata prima della versione che lo salva)
      trades.push({id:'T5', asset:'XAU/USD', side:'BUY', entry:2349, exit:2353, pl:20, mode:'live',
                   startTime:Date.now()-30*60000, closedAt:new Date().toISOString(), closeTF:1, openTF:1,
                   mt5Ticket:12346, mt5Login:null});
      out.liveMt5_senzaLogin=contaFiltro();
      // e) la stessa operazione reale ma di un ALTRO conto
      // CORRETTO (10 novembre 2026): questo banco contava TUTTO l'elenco invece della singola
      // operazione resa 'di un altro conto', quindi ci finiva dentro anche quella senza login
      // (che appartiene al conto collegato). Si toglie quella senza login e si misura solo la
      // modifica: l'isolamento deve dare 0.
      trades.splice(4,1);
      trades[3].mt5Login='99999'; out.liveMt5_altroConto=contaFiltro();
      return out;
    })()`);
    assert.equal(r.journal, 3, 'il Journal mostra le 3 dello storico (filtro "tutte")');
    assert.equal(r.asset, 3, 'le 3 dello storico sono dell asset XAU/USD a grafico');
    assert.equal(r.storico, 3, 'nella sessione Storico si vedono tutte e 3');
    assert.equal(r.liveMt5_storico, 0,
      'in Live con MT5 collegato le operazioni dello "storico" (mode backtest) NON passano: ' + JSON.stringify(r));
    assert.equal(r.posizioniStorico, 0, 'nessuna posizione simulata passa in Live con MT5');
    assert.equal(r.liveNoMt5, 0,
      'in Live anche SENZA MT5 le operazioni mode=backtest NON passano (filtro modo, riga 6049): ' + JSON.stringify(r));
    assert.equal(r.liveMt5_reale, 1, 'la reale del conto giusto passa: ' + JSON.stringify(r));
    // CORRETTO (10 novembre 2026): prima ci si aspettava 1 perche' la cura non c'era e la
    // madre buttava via la reale senza login (era il «sul conto non vedo le operazioni»).
    // Ora un reale senza mt5Login appartiene al conto collegato (il ponte ne interroga uno
    // solo): passano 2 su 3, e resta fuori solo quella di un altro conto.
    assert.equal(r.liveMt5_senzaLogin, 2,
      'la reale senza login passa: e\' del conto collegato: ' + JSON.stringify(r));
    assert.equal(r.liveMt5_altroConto, 0, 'quella di un altro conto non passa: ' + JSON.stringify(r));
    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});

test('duplicata (?pipSlot=2): vede ciò che la madre non vede', async () => {
  const {browser, pagina} = await apriApp({query:'?pipSlot=2'});
  try{
    const C = candele(600);
    const r = await pagina.evaluate(`async function(){
      var C=${JSON.stringify(C)};
      ${prepara(C)}
      function contaFiltro(){ return trades.filter(function(t){return tradeBelongsToCurrentView(t);}).length; }
      function contaAsset(){ return trades.filter(function(t){return belongsToCurrentAsset(t);}).length; }
      var prima={slot:PIP_SLOT, live:liveModeActive, modo:currentMode(), mt5:mt5Connected,
                 assetKey:currentAssetKey, passano:contaFiltro(), asset:contaAsset()};
      // La madre (slot 0, in Live su MT5) annuncia il suo stato
      tradingChannel.onmessage({data:{type:'trading_sync', slot:0, at:Date.now(),
        positions:[], pendingOrders:[], trades:trades, equity:[10000],
        conto:{vivo:true, vista:'mt5'}}});
      await new Promise(function(res){ setTimeout(res, 1000); });
      // Nella duplicata, passati in Live, si sceglie lo STESSO asset a mano (la madre è in Live:
      // l'asset non si propaga da sola). Poi si rimisura.
      currentAssetKey='XAU/USD';
      return {
        prima:prima,
        dopo:{live:liveModeActive, modo:currentMode(), mt5:mt5Connected, trades:trades.length,
              assetKeyPrimaDelSync:prima.assetKey, assetKeyDopoSync:'XAU/USD',
              passano:contaFiltro(), asset:contaAsset()}
      };
    }()`);
    assert.equal(r.prima.passano, 3, 'la duplicata appena aperta, in Storico, passerebbe tutte e 3');
    assert.equal(r.dopo.live, true, 'con la madre in Live la duplicata passa in Live');
    assert.equal(r.dopo.trades, 3, 'i trades arrivano dal messaggio della madre');
    assert.equal(r.dopo.passano, 0,
      'in Live anche la duplicata NON mostra le 3 dello "storico" (filtro modo, riga 6049): ' + JSON.stringify(r.dopo));
    assert.equal(r.dopo.asset, 3, 'l asset invece e a posto: il muro e il filtro modo/sorgente, non l asset');
  } finally { await browser.close(); }
});

test('duplicata senza asset valido: belongsToCurrentAsset butta via TUTTO (grafico pulito)', async () => {
  const {browser, pagina} = await apriApp({query:'?pipSlot=2'});
  try{
    const C = candele(600);
    const r = await pagina.evaluate(`async function(){
      var C=${JSON.stringify(C)};
      rows=C; baseRows=C; idx=C.length-1; trades=${JSON.stringify(treTrade(C))};
      positions=[]; currentAssetKey='';           // duplicata appena aperta: nessun asset
      function contaFiltro(){ return trades.filter(function(t){return tradeBelongsToCurrentView(t)&&belongsToCurrentAsset(t);}).length; }
      var senzaAsset=contaFiltro();
      // Clone dalla madre che è in LIVE: l'asset NON si propaga (solo in Storico)
      tradingChannel.onmessage({data:{type:'pip_clone_snapshot', slot:0, storico:false, mode:'live',
        asset:'XAU/USD', chartView:{masterTime:Date.now()}, styleFields:{}, assets:[], customAssets:[], watchlist:[]}});
      await new Promise(function(res){ setTimeout(res, 400); });
      var dopoClone=currentAssetKey;               // cosa resta DOPO il clone dalla madre in Live
      currentAssetKey='XAU/USD';                  // scelto a mano dall utente
      var conAssetInLive=contaFiltro();
      liveModeActive=false;                        // la duplicata che RIMANE in Storico
      var conAssetInStorico=contaFiltro();
      return {senzaAsset:senzaAsset, conAssetInLive:conAssetInLive, conAssetInStorico:conAssetInStorico,
              dopoClone:dopoClone, live:liveModeActive, mt5:mt5Connected};
    }()`);
    assert.equal(r.senzaAsset, 0,
      'senza asset selezionato belongsToCurrentAsset esclude tutto: ' + JSON.stringify(r));
    assert.equal(r.conAssetInLive, 0,
      'con l asset scelto ma in Live le 3 dello "storico" restano invisibili (filtro modo): ' + JSON.stringify(r));
    assert.equal(r.conAssetInStorico, 3, 'le stesse 3, sulla duplicata rimasta in STORICO, tornano');
  } finally { await browser.close(); }
});

test('duplicata col warm-start MT5: login VUOTO, quindi passano tutte (anche senza login sul trade)', async () => {
  const {browser, pagina} = await apriApp({query:'?pipSlot=2'});
  try{
    const C = candele(600);
    const r = await pagina.evaluate(`async function(){
      var C=${JSON.stringify(C)};
      rows=C; baseRows=C; idx=C.length-1;
      // Due operazioni REALI del conto 68794: una col login salvato, una senza (la seconda e'
      // quella che la madre butta via). La duplicata le riceve dalla madre.
      var tt=[
        {id:'R1', asset:'XAU/USD', side:'BUY', entry:2348, exit:2352, pl:20, mode:'live',
         startTime:Date.now()-60*60000, closedAt:new Date(Date.now()-50*60000).toISOString(), closeTF:1, openTF:1,
         mt5Ticket:111, mt5Login:'68794'},
        {id:'R2', asset:'XAU/USD', side:'BUY', entry:2348, exit:2352, pl:20, mode:'live',
         startTime:Date.now()-60*60000, closedAt:new Date(Date.now()-50*60000).toISOString(), closeTF:1, openTF:1,
         mt5Ticket:112, mt5Login:null}
      ];
      var MADRE={type:'trading_sync', slot:0, at:Date.now(), positions:[], pendingOrders:[],
                 trades:tt, equity:[10000], conto:{vivo:true, vista:'mt5'}};
      tradingChannel.onmessage({data:MADRE});
      await new Promise(function(res){ setTimeout(res, 800); });
      currentAssetKey='XAU/USD';
      function contaFiltro(){ return trades.filter(function(t){return tradeBelongsToCurrentView(t);}).length; }
      var primaWarm={live:liveModeActive, mt5:mt5Connected, login:currentMt5AccountTag().mt5Login,
                     tagChiavi:Object.keys(currentMt5AccountTag()), passano:contaFiltro()};
      // Il warm-start: la madre dice "MT5 collegato" e la duplicata eredita SOLO il flag.
      tradingChannel.onmessage({data:{type:'pip_clone_snapshot', slot:0, storico:false, mode:'live',
        asset:'XAU/USD', chartView:{masterTime:Date.now()}, styleFields:{}, assets:[], customAssets:[],
        watchlist:[], mt5Connected:true}});
      await new Promise(function(res){ setTimeout(res, 800); });
      return {
        primaWarm:primaWarm,
        dopoWarm:{mt5:mt5Connected, login:currentMt5AccountTag().mt5Login,
                  contoAttivo:!!mt5ContoAttivo, accountInfo:!!mt5AccountInfo, credsLogin:(mt5CredsDraft&&mt5CredsDraft.login)||null,
                  passano:contaFiltro(), trades:trades.length}
      };
    }()`);
    assert.equal(r.primaWarm.passano, 0,
      'in Live senza MT5 le operazioni REALI col ticket non passano (servono solo le simulate): ' + JSON.stringify(r.primaWarm));
    assert.equal(r.dopoWarm.mt5, true, 'la duplicata eredita il flag MT5 collegato');
    assert.equal(r.dopoWarm.contoAttivo, false, 'ma NON eredita mt5ContoAttivo della madre');
    assert.equal(r.dopoWarm.accountInfo, false, 'ne mt5AccountInfo');
    assert.equal(r.dopoWarm.login, undefined, 'quindi il login attivo e VUOTO: ' + JSON.stringify(r.dopoWarm));
    // MISURA AGGIORNATA IL 13 NOVEMBRE: qui c'era 2, cioe la fotografia del difetto —
    // «col login vuoto passano TUTTE le operazioni col ticket». Il proprietario ha chiesto il
    // contrario: «se sono collegato con l account 1 non posso vedere le posizioni chiuse dell
    // account 2 a grafico». Con il conto ignoto adesso non ne passa nessuna: e la stessa regola
    // gia scelta per le posizioni aperte (v2.2.28) e per l apertura automatica — non lo so non
    // puo valere fai pure. Il resto di questa misura non cambia: la duplicata eredita il flag
    // MT5 e NON il conto, ed e proprio quello il motivo per cui il filtro deve chiudersi.
    assert.equal(r.dopoWarm.passano, 0,
      'col login vuoto non passa NESSUNA operazione reale: ' + JSON.stringify(r.dopoWarm));
  } finally { await browser.close(); }
});

test('il messaggio della madre perde il conto MT5 (sovrascritto alla riga 8778)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      var catturati=[];
      tradingChannel.postMessage=function(m){ catturati.push(m); };
      mt5Connected=true; mt5ContoAttivo={login:'68794',server:'X-Live'};
      liveModeActive=true; fblContoVista='mt5';
      positions=[{id:'p1',asset:'XAU/USD',side:'BUY',entry:2348,sl:2344,tp:2355,lots:0.1,mt5Ticket:777,mt5Login:'68794'}];
      broadcastTradingStateNow();
      var msg=catturati.filter(function(m){return m&&m.type==='trading_sync';}).pop()||null;
      return {
        haMsg:!!msg,
        conto:msg?msg.conto:null,
        mt5NelMessaggio:!!(msg&&msg.conto&&msg.conto.mt5),
        positionsInviate:msg&&msg.positions?msg.positions.length:-1
      };
    })()`);
    assert.equal(r.haMsg, true, 'la madre annuncia il suo stato');
    assert.equal(r.positionsInviate, 1, 'le posizioni partono nel messaggio');
    // CORRETTO (10 novembre 2026): prima ci si aspettava false perche' broadcastTradingStateNow
    // SOSTITUIVA p.conto perdendo mt5. Ora si unisce: login e server partono davvero.
    assert.equal(r.mt5NelMessaggio, true,
      'il conto MT5 (login/server) deve partire: conto=' + JSON.stringify(r.conto));
    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});

test('interruttore "posizioni chiuse" spento: nessuna freccia, con o senza indicatori', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const C = candele(600);
    const r = await pagina.evaluate(`(function(){
      var C=${JSON.stringify(C)};
      ${prepara(C)}
      // Conta TUTTI i tratti del canvas: differenza fra "con le 3 chiuse" e "senza".
      var proto=CanvasRenderingContext2D.prototype;
      var vS=proto.stroke, vF=proto.fill, tratti=0;
      proto.stroke=function(){ tratti++; return vS.apply(this,arguments); };
      proto.fill=function(){ tratti++; return vF.apply(this,arguments); };
      function conta(){ tratti=0; draw(); return tratti; }
      var vuoto=conta();
      var flagLetto=fblPosizioniChiuseVisibili();
      localStorage.setItem('fbl_posizioni_chiuse','0');
      trades=${JSON.stringify(treTrade(C))}; var spento=conta();
      localStorage.setItem('fbl_posizioni_chiuse','1');
      var acceso=conta();
      localStorage.setItem('fbl_posizioni_chiuse','0');
      var spentoDiNuovo=conta();
      // Stessa misura CON un indicatore attivo (a parita di tutto il resto)
      activeIndicators=[{id:'i1',key:'vp_daily',params:{days:3},hidden:false}];
      localStorage.setItem('fbl_posizioni_chiuse','1');
      var accesoInd=conta();
      activeIndicators=[];
      proto.stroke=vS; proto.fill=vF;
      return {vuoto:vuoto, flagLetto:flagLetto, spento:spento, acceso:acceso,
              spentoDiNuovo:spentoDiNuovo, accesoInd:accesoInd};
    })()`);
    assert.equal(r.flagLetto, false, 'di base l interruttore delle posizioni chiuse è SPENTO (letto: ' + r.flagLetto + ')');
    assert.equal(r.spento, r.vuoto,
      'con l interruttore spento le 3 chiuse non aggiungono NESSUN tratto: ' + JSON.stringify(r));
    assert.ok(r.acceso > r.vuoto, 'con l interruttore acceso si disegnano davvero: ' + JSON.stringify(r));
    assert.ok(r.accesoInd > r.acceso,
      'l indicatore aggiunge i suoi tratti, ma non toglie quelli delle posizioni: ' + JSON.stringify(r));
    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});
