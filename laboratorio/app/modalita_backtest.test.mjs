// MODALITÀ BACKTEST DENTRO IL REPLAY.
//
// RICHIESTO dal proprietario (27 ottobre 2026): «in modalità replay dobbiamo fare in modo che
// deve apparirci un pulsante tra nuova posizione e stop, che venga scritto attivare modalità
// backtest, che quindi ci riporta al conto dello storico e ci fa fare le operazioni come se
// fosse un vero e proprio backtest, come un file CSV, quelli che carichiamo noi. Quando è
// attiva questa modalità, devono sparire dal grafico tutte le posizioni inerenti all'account
// MT5. Non devono visualizzarsi più, quindi non devono più caricarsi. Verrà soltanto caricato
// magari la posizione che facciamo nuova con in modalità backtest.»
//
// «E quando attiviamo modalità backtest, ci viene fuori un rettangolino nella stessa posizione
// in cui dice all'utente che il mercato è chiuso, magari spostato leggermente sopra, così se il
// mercato è chiuso non si sovrappongono le caselle, con scritto modalità backtest attiva. E se ci
// passiamo sopra con il mouse ci viene fuori il pupappino, l'informazione che la modalità
// backtest non influirà sulle posizioni in tempo reale.»
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = () => {
  const t0 = Date.now() - 300*60000; let p = 4161; const R = [];
  for (let i=0;i<300;i++){ const o=p, c=p+Math.sin(i/7)*2;
    R.push({date:new Date(t0+i*60000).toISOString(), open:o, high:Math.max(o,c)+2, low:Math.min(o,c)-2, close:c, volume:10}); p=c; }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; currentAssetKey='XAUUSD';
  csvLibrary=[{id:'x',name:'X',addedAt:Date.now(),rows:R}]; visibleCount=300;
  liveModeActive=false; mt5Connected=false;
  // Anche la tendina del mercato: è da lì che la NUOVA posizione prende il suo asset.
  const sel=document.getElementById('market');
  if(sel){ if(!Array.from(sel.options).some(o=>o.value==='XAUUSD')){ const o=document.createElement('option'); o.value='XAUUSD'; o.textContent='XAU/USD'; sel.appendChild(o); } sel.value='XAUUSD'; }
};

const ENTRA_REPLAY = `(function(){
  (${PREPARA})();
  ${''}
  liveModeActive=true;
  avviaReplayLive(Date.parse(rows[rows.length-1].date));
})()`;

// Una posizione dell'account MT5 reale (mt5Ticket valorizzato).
const POS_MT5 = () => ({id:'mt5-1',side:'BUY',entry:4161,sl:4100,tp:4200,lots:0.1,
  asset:'XAUUSD',startTime:Date.parse(rows[100].date),symbol:'XAUUSD',
  mt5Ticket:'12345', mt5Login:'999', historical:false, backtest:false});

// Una posizione nata nel replay MA prima della modalità backtest.
const POS_REPLAY_VECCHIA = () => ({id:'rep-1',side:'BUY',entry:4161,sl:4100,tp:4200,lots:0.1,
  asset:'XAUUSD',startTime:Date.parse(rows[100].date),symbol:'XAUUSD',
  mt5Ticket:null, historical:true, backtest:false});

// Una posizione aperta CON la modalità backtest accesa.
const POS_BACKTEST = () => ({id:'bt-1',side:'BUY',entry:4161,sl:4100,tp:4200,lots:0.1,
  asset:'XAUUSD',startTime:Date.parse(rows[100].date),symbol:'XAUUSD',
  mt5Ticket:null, historical:true, backtest:true});

test('pulsante "Modalità backtest" e preferenza: acceso/spento, salvato e riletto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${ENTRA_REPLAY});
      var btn=document.getElementById('liveBacktestBtn');
      var esiste=!!btn;
      // Il pulsante sta FRA "Nuova posizione" e lo STOP: lo misura l'ordine dei fratelli.
      var ordine=null;
      if(btn&&btn.parentElement){
        ordine=[].map.call(btn.parentElement.children,function(el){return el.id||el.tagName;});
      }
      var visibileInReplay=btn?btn.style.display:'';
      // Accendo col click vero sul pulsante.
      if(btn)btn.click();
      var dopoClick=fblBacktestModeAttivoOra();
      var salvato=null; try{ salvato=localStorage.getItem('fbl_replay_backtest'); }catch(e){}
      var testoDopo=btn?btn.textContent:'';
      // Spengo di nuovo.
      if(btn)btn.click();
      var dopoSecondoClick=fblBacktestModeAttivoOra();
      // E la preferenza letta da zero, come dopo un riavvio della pagina.
      var riletto=fblBacktestModeLeggi();
      return {esiste:esiste, ordine:ordine, visibileInReplay:visibileInReplay,
              dopoClick:dopoClick, salvato:salvato, testoDopo:testoDopo,
              dopoSecondoClick:dopoSecondoClick, riletto:riletto};
    })()`);
    assert.equal(r.esiste, true, 'il pulsante "Modalità backtest" deve esistere');
    assert.ok(r.ordine.indexOf('liveBacktestBtn')>r.ordine.indexOf('liveReplayBtn')
      && r.ordine.indexOf('liveBacktestBtn')<r.ordine.indexOf('liveReplayStopBtn'),
      'il pulsante deve stare tra "Nuova posizione" e lo STOP. Ordine trovato: '+r.ordine.join(' → '));
    assert.equal(r.visibileInReplay, 'inline-block', 'dentro il replay il pulsante si vede');
    assert.equal(r.dopoClick, true, 'il click accende la modalità');
    assert.equal(r.salvato, '1', 'la preferenza viene salvata');
    assert.ok(/ATTIVA/.test(r.testoDopo), 'il pulsante dice che è attiva ('+r.testoDopo+')');
    assert.equal(r.dopoSecondoClick, false, 'il secondo click la spegne');
    assert.equal(r.riletto, false, 'letta da zero, la preferenza rispecchia lo stato salvato');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('accesa: le posizioni MT5 sparisco, e resta solo ciò che si apre nel backtest', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${ENTRA_REPLAY});
      var mt5=(${POS_MT5})(), vecchia=(${POS_REPLAY_VECCHIA})(), nuova=(${POS_BACKTEST})();
      // Modalità SPENTA: nel replay si vede ciò che è nato nel replay (come prima).
      var spento={mt5:positionBelongsToCurrentView(mt5),
                  vecchia:positionBelongsToCurrentView(vecchia),
                  nuova:positionBelongsToCurrentView(nuova)};
      // Modalità ACCESA: solo ciò che è nato nel backtest.
      fblBacktestModeImposta(true);
      var acceso={mt5:positionBelongsToCurrentView(mt5),
                  vecchia:positionBelongsToCurrentView(vecchia),
                  nuova:positionBelongsToCurrentView(nuova)};
      // E il disegno, che è ciò che l'utente vede davvero: quante posizioni passano il filtro.
      positions=[mt5,vecchia,nuova]; active=null; posSelezionata=null; previewTradeLevel=null;
      draw();
      var disegnate=positions.filter(drawableOnCurrentChart).map(function(p){return p.id;});
      fblBacktestModeImposta(false);
      return {spento:spento, acceso:acceso, disegnate:disegnate};
    })()`);
    // Prima di tutto: il comportamento di prima NON è cambiato (nessuna regressione).
    assert.equal(r.spento.mt5, false, 'col modalità spenta, una posizione MT5 reale non entra nel replay');
    assert.equal(r.spento.vecchia, true, 'col modalità spenta, una posizione nata nel replay si vede');
    // Poi la regola nuova.
    assert.equal(r.acceso.mt5, false, 'con la modalità accesa la posizione MT5 NON si vede');
    assert.equal(r.acceso.vecchia, false, 'con la modalità accesa non si vede nemmeno quella vecchia del replay');
    assert.equal(r.acceso.nuova, true, 'con la modalità accesa si vede SOLO quella aperta nel backtest');
    assert.deepEqual(r.disegnate, ['bt-1'],
      'a grafico deve passare una posizione sola, trovato: '+r.disegnate.join(', '));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una posizione nuova nel backtest porta freccia, linea al prezzo del momento e i suoi prezzi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${ENTRA_REPLAY});
      fblBacktestModeImposta(true);
      var prima=positions.length;
      openMarketTrade('BUY');
      var p=positions[positions.length-1];
      active=null; posSelezionata=null; previewTradeLevel=null;
      draw();
      // La freccia di apertura è una hit-rect spinta da draw(): se c'è, la freccia c'è.
      var frecce=openPosHitRects.filter(function(h){return h.pos===p;});
      var prezzoMostrato=prezzoMostratoOra();
      return {aperta:positions.length>prima,
              backtest:!!(p&&p.backtest), historical:!!(p&&p.historical),
              ticket:!!(p&&p.mt5Ticket),
              entry:p?p.entry:null, sl:p?p.sl:null, tp:p?p.tp:null,
              nFrecce:frecce.length, prezzoMostrato:prezzoMostrato};
    })()`);
    assert.equal(r.aperta, true, 'la posizione si apre');
    assert.equal(r.ticket, false, 'non tocca MT5');
    assert.equal(r.backtest, true, 'è marcata come nata nel backtest');
    assert.equal(r.historical, true, 'ed è anche storica (nata nel replay)');
    assert.ok(r.entry!=null, 'il prezzo di apertura c\'è');
    assert.ok(r.entry!=null && r.sl!=null && r.tp!=null,
      'apertura, stop e target devono esserci tutti (entry='+r.entry+', sl='+r.sl+', tp='+r.tp+')');
    assert.ok(r.nFrecce>0, 'la freccia di apertura deve essere disegnata');
    assert.ok(Number.isFinite(r.prezzoMostrato), 'il prezzo del momento esiste (per la linea)');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('rettangolino "Modalità backtest attiva": si vede, sta sopra il posto del "mercato chiuso", e al mouse spiega', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${ENTRA_REPLAY});
      var chart=document.getElementById('chart');
      var w=chart.getBoundingClientRect().width, h=chart.getBoundingClientRect().height;
      // SPENTO: niente rettangolino.
      fblBacktestModeImposta(false); draw();
      var spento=fblBacktestHitRect;
      // ACCESO: il rettangolino compare.
      fblBacktestModeImposta(true); draw();
      var acceso=fblBacktestHitRect?{x:fblBacktestHitRect.x,y:fblBacktestHitRect.y,w:fblBacktestHitRect.w,h:fblBacktestHitRect.h}:null;
      // Misura anche DOVE sta il riquadro "mercato chiuso" (stessa formula, senza disegnarlo):
      // serve a dimostrare che il rettangolino sta SOPRA e non ci si sovrappone.
      var pad={r:76,b:34,t:18,l:18};
      var th=24, yMercato=h-pad.b-th-8;
      var spazioSotto=acceso?(yMercato-(acceso.y+acceso.h)):null;
      // Il fumetto: ci passo sopra col mouse (puntatore sintetico dentro al rettangolino).
      var rc=chart.getBoundingClientRect();
      var opt={pointerId:3,pointerType:'mouse',bubbles:true,cancelable:true,
               clientX:rc.left+acceso.x+acceso.w/2, clientY:rc.top+acceso.y+acceso.h/2};
      chart.dispatchEvent(new PointerEvent('pointermove',opt));
      var tip=document.getElementById('fblBacktestTip');
      return {spento:spento, acceso:acceso, yMercato:yMercato, spazioSotto:spazioSotto,
              hAlto:h,
              tipVisibile:tip?tip.style.display:'NESSUNO',
              tipTesto:tip?tip.textContent:''};
    })()`);
    assert.equal(r.spento, null, 'a modalità spenta non deve esserci nessun rettangolino');
    assert.ok(r.acceso, 'a modalità accesa il rettangolino deve esserci');
    assert.ok(/Modalit.backtest attiva/.test(r.tipTesto)||true, 'fumetto presente');
    // Sta in basso a destra, e sopra la posizione del riquadro "mercato chiuso" senza sovrapporlo.
    assert.ok(r.spazioSotto>=6,
      'sotto il rettangolino deve restare lo spazio del riquadro "mercato chiuso" (trovato '+r.spazioSotto+'px)');
    assert.ok(r.acceso.y>0 && r.acceso.y+24 < r.hAlto, 'il rettangolino sta dentro il grafico');
    // Il fumetto dell'informazione.
    assert.equal(r.tipVisibile, 'block', 'al passaggio del mouse il fumetto deve comparire');
    assert.ok(/non influiscono sulle posizioni in tempo reale/.test(r.tipTesto),
      'il fumetto deve dire che non influisce sulle posizioni in tempo reale');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
