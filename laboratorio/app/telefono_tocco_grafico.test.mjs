// QUATTRO COSE CHE IL DITO NON RIUSCIVA A FARE SUL GRAFICO.
//
// SEGNALATO dal proprietario (4 novembre 2026): «a volte avviene un bug che sui dispositivi
// mobili, con il dito, quando voglio trascinare la pagina e sono sopra il grafico, non me lo fa
// trascinare. In più tengo premuto il dito sopra il grafico e dovrebbe uscirmi quello che è il
// puntatore: anche quello non funziona bene. Non funziona bene nemmeno quello che è il selezionare
// una linea TP/SL e poi la trascino: al momento che comincio a trascinarla si blocca... se sono
// soltanto con un dito, in modalità pagina principale. Se invece sono a tutto schermo, un dito
// effettivamente fa quello di spostare il grafico: quello è corretto. I zoom vanno bene, sia in
// verticale che in orizzontale, col pizzicare delle due dita.» E poco dopo: «non mi fa premere
// quelle che sono le notizie sotto al grafico, sulla barra del tempo: vado là col dito e non mi fa
// premere la notizia ed espanderla, mentre invece sul tablet con la penna sì».
//
// LE CAUSE, misurate una per una in questo stesso banco a 375 px con lo userAgent di un telefono:
//
//   1. SCORRIMENTO DELLA PAGINA. Il grafico blocca lo scorrimento (touch-action:none) per la
//      durata di un gesto suo e lo sblocca nel ramo del rilascio. Se un rilascio si perde — e sul
//      telefono si perde — il blocco resta PER SEMPRE: misurato, dopo un mirino da pressione
//      lunga col rilascio perso, touch-action restava 'none' anche al tocco successivo. Da lì in
//      poi la pagina non si scorreva più sopra il grafico. Di qui il «a volte» della segnalazione.
//   2. LINEA TP/SL. Sulla pagina normale il tocco su una linea NON veniva bloccato, quindi il
//      browser si prendeva il gesto per scorrere la pagina e il trascinamento moriva sul nascere.
//      In schermo intero funzionava: è esattamente la differenza che il proprietario descrive.
//   3. PALLINO-NOTIZIA. Non era un bersaglio troppo piccolo (raggio 13 px): era uno scontro. Il
//      mirino della pressione lunga scatta a 450 ms e si mangiava il rilascio, mentre la notizia
//      si apriva solo per tocchi sotto i 700 ms e 10 px. Un dito che prende la mira sta giù di
//      più: la penna, che tocca e stacca in un lampo, passava. Misurato: tocco di 900 ms con 12
//      px di scarto → non si apriva; tocco istantaneo → si apriva.
//
// LA PROVA DI CONTROLLO È LA PRIMA, e non è un dettaglio: le cure 2 e 3 danno il gesto al dito in
// più casi, quindi va misurato che sul grafico VUOTO il dito continui a scorrere la pagina — che è
// la regola che il proprietario ha chiesto a suo tempo e che non va perduta curando il resto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const telefono = () => apriApp({larghezza:375, altezza:812, piattaforma:'Android', userAgent:UA_ANDROID});

// I tocchi di questo banco sono FABBRICATI (new PointerEvent), quindi per il browser non
// esiste un puntatore vero da catturare: setPointerCapture/releasePointerCapture tirano
// NotFoundError. E' rumore del banco, non un difetto dell'app - con un dito vero quei puntatori
// esistono. Si scarta SOLO questo, cosi' qualunque altro errore della pagina resta visibile.
const erroriVeri = (errori) => errori.filter(e => !/PointerCapture/.test(String(e)));

// Candele finte, una posizione con TP/SL, e gli strumenti per fabbricare tocchi veri: il banco
// manda SIA i PointerEvent SIA i TouchEvent, perché un telefono manda entrambi e la rete di
// sicurezza vive sui secondi.
const PREPARA = `
  const t0=Date.now()-200*60000; const R=[];
  for(let i=0;i<200;i++){ const p=1.1+Math.sin(i/9)*0.002;
    R.push({date:new Date(t0+i*60000).toISOString(),open:p,high:p+0.0005,low:p-0.0005,close:p,volume:5}); }
  csvLibrary=[{name:'t',rows:R}]; rebuildBaseRowsFromLibrary();
  currentAssetKey='EURUSD'; rowsAssetKey='EURUSD'; liveReplayActive=false;
  currentTF=1; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
  viewEnd=rows.length-1; idx=rows.length-1; visibleCount=80; autoFitWidth=false; followLatest=false;
  const rc=chartEl.getBoundingClientRect();
  const P=(x,y,id)=>({pointerId:id,pointerType:'touch',isPrimary:true,bubbles:true,cancelable:true,clientX:x,clientY:y,buttons:1});
  const T=(tipo,x,y,id,restano)=>{ const t=new Touch({identifier:id,target:chartEl,clientX:x,clientY:y});
    return new TouchEvent(tipo,{bubbles:true,cancelable:true,
      touches:restano?[t]:[],targetTouches:restano?[t]:[],changedTouches:[t]}); };
  const cercaLinea=()=>{ for(let y=0;y<rc.height;y+=2){
    if(tradeLevelHit(rc.left+rc.width*0.6, rc.top+y))return {x:rc.left+rc.width*0.6,y:rc.top+y}; } return null; };
`;

// ---- 1. PROVA DI CONTROLLO: sul grafico vuoto il dito scorre la pagina ----
test('sul grafico vuoto, un dito solo continua a scorrere la pagina', async () => {
  const {browser, pagina, errori} = await apriApp({larghezza:375, altezza:812, piattaforma:'Android', userAgent:UA_ANDROID});
  try {
    const r = await pagina.evaluate(`(function(){
      ${PREPARA}
      liveModeActive=false; positions.length=0; active=null; drawings=[]; draw();
      // Un punto in alto a sinistra del grafico: nessuna linea, nessun disegno, nessun pallino.
      const X=rc.left+30, Y=rc.top+40;
      const ts=T('touchstart',X,Y,1,true);
      chartEl.dispatchEvent(ts);
      const scorre=getComputedStyle(chartEl).touchAction;
      chartEl.dispatchEvent(T('touchend',X,Y,1,false));
      return {bloccato:ts.defaultPrevented, touchAction:scorre};
    })()`);
    assert.deepEqual(erroriVeri(errori), [], 'la pagina non deve avere errori JS');
    assert.equal(r.bloccato, false,
      'sul grafico vuoto il tocco NON va bloccato: è così che la pagina si scorre col dito');
    assert.ok(/pan-y/.test(r.touchAction),
      'il grafico deve lasciare lo scorrimento verticale al browser, invece: ' + r.touchAction);
  } finally { await browser.close(); }
});

// ---- 2. La linea TP/SL si prende col dito anche sulla pagina normale ----
test('un dito su una linea TP/SL la prende e la trascina, sulla pagina normale', async () => {
  const {browser, pagina, errori} = await telefono();
  try {
    const r = await pagina.evaluate(`(function(){
      ${PREPARA}
      liveModeActive=false;
      positions.length=0;
      positions.push({id:'p1',asset:'EURUSD',side:'BUY',entry:1.1,sl:1.098,tp:1.102,lots:0.1,
        start:150,startTime:parseDateTime(rows[150].date),openTF:1,createdAt:Date.now()});
      active=positions[0]; syncTradeLevels(); draw();
      let punto=cercaLinea();
      if(!punto)return {errore:'il banco non trova la linea TP/SL: misurerebbe il vuoto'};
      // Primo tocco: seleziona e basta (è la regola dell'app, "poi si ripreme sopra per
      // spostarla"). Dopo il primo tocco la pagina si ridisegna, quindi la linea si ricerca.
      chartEl.dispatchEvent(new PointerEvent('pointerdown',P(punto.x,punto.y,21)));
      chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign(P(punto.x,punto.y,21),{buttons:0})));
      punto=cercaLinea();
      if(!punto)return {errore:'la linea è sparita dopo il primo tocco'};
      const ts=T('touchstart',punto.x,punto.y,22,true);
      chartEl.dispatchEvent(ts);
      chartEl.dispatchEvent(new PointerEvent('pointerdown',P(punto.x,punto.y,22)));
      const partito=!!tradeLevelDrag;
      chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign(P(punto.x,punto.y,22),{buttons:0})));
      chartEl.dispatchEvent(T('touchend',punto.x,punto.y,22,false));
      return {bloccato:ts.defaultPrevented, partito};
    })()`);
    assert.deepEqual(erroriVeri(errori), [], 'la pagina non deve avere errori JS');
    assert.ok(!r.errore, r.errore || '');
    assert.equal(r.bloccato, true,
      'il tocco su una linea va bloccato, o il browser scorre la pagina e il trascinamento muore');
    assert.equal(r.partito, true, 'il secondo tocco sulla linea deve avviare il trascinamento');
  } finally { await browser.close(); }
});

// ---- 3. Il pallino-notizia si apre con un tocco di dito vero ----
test('un tocco di dito su un pallino-notizia apre la notizia', async () => {
  const {browser, pagina, errori} = await telefono();
  try {
    const r = await pagina.evaluate(`(async function(){
      ${PREPARA}
      liveModeActive=true;
      fblMercatoFermoOra=function(){ return false; }; statoMercato=function(){ return {aperto:true}; };
      newsEnabled=true; newsSeverityFilter={High:true,Medium:true,Low:true};
      newsCountryEnabled=function(){ return true; };
      const quando=new Date(parseDateTime(rows[rows.length-20].date)).toISOString();
      newsEvents=[{id:'n1',title:'Prova notizia',country:'US',currency:'USD',impact:'High',date:quando}];
      draw();
      if(!newsDotHitRects.length)return {errore:'il banco non disegna nessun pallino-notizia'};
      const d=newsDotHitRects[0];
      const X=rc.left+d.x, Y=rc.top+d.y;
      let aperta=false;
      const vero=openNewsEventModal; openNewsEventModal=function(){ aperta=true; };
      try{
        // Un tocco di dito vero: fermo 900 ms, poi 12 px di scarto al rilascio.
        chartEl.dispatchEvent(T('touchstart',X,Y,41,true));
        chartEl.dispatchEvent(new PointerEvent('pointerdown',P(X,Y,41)));
        await new Promise(r=>setTimeout(r,900));
        chartEl.dispatchEvent(new PointerEvent('pointermove',P(X+12,Y+8,41)));
        chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign(P(X+12,Y+8,41),{buttons:0})));
        chartEl.dispatchEvent(T('touchend',X+12,Y+8,41,false));
      } finally { openNewsEventModal=vero; }
      return {raggio:d.r, aperta, mirinoRimasto:!!fblMirinoTocco};
    })()`);
    assert.deepEqual(erroriVeri(errori), [], 'la pagina non deve avere errori JS');
    assert.ok(!r.errore, r.errore || '');
    assert.equal(r.aperta, true,
      'la notizia deve aprirsi: è un tocco di 900 ms con 12 px di scarto, cioè un dito normale');
    assert.equal(r.mirinoRimasto, false,
      'sopra un pallino il mirino della pressione lunga non deve partire');
  } finally { await browser.close(); }
});

// ---- 4. Un rilascio perso non deve lasciare la pagina incollata ----
test('se il rilascio del dito si perde, lo scorrimento della pagina torna libero', async () => {
  const {browser, pagina, errori} = await telefono();
  try {
    const r = await pagina.evaluate(`(async function(){
      ${PREPARA}
      liveModeActive=false; positions.length=0; active=null; draw();
      const X=rc.left+rc.width*0.4, Y=rc.top+rc.height*0.4;
      chartEl.dispatchEvent(T('touchstart',X,Y,51,true));
      chartEl.dispatchEvent(new PointerEvent('pointerdown',P(X,Y,51)));
      await new Promise(r=>setTimeout(r,600));   // oltre i 450 ms: parte il mirino e blocca lo scorrimento
      const durante=chartEl.style.touchAction;
      const mirino=!!fblMirinoTocco;
      // IL RILASCIO DEL PUNTATORE SI PERDE: arriva solo il touchend del browser. È il caso reale
      // che incollava la pagina (dito uscito dall'elemento, puntatore annullato dal browser...).
      chartEl.dispatchEvent(T('touchend',X,Y,51,false));
      const dopo=chartEl.style.touchAction;
      chartEl.dispatchEvent(T('touchstart',X+40,Y+40,52,true));
      const alNuovo=chartEl.style.touchAction;
      return {durante, mirino, dopo, alNuovo};
    })()`);
    assert.deepEqual(erroriVeri(errori), [], 'la pagina non deve avere errori JS');
    // Controllo del banco: se il mirino non fosse partito, non ci sarebbe niente da sbloccare e
    // le due misure sotto sarebbero banalmente vere.
    assert.equal(r.mirino, true, 'il banco non ha fatto partire il mirino: misurerebbe il vuoto');
    assert.equal(r.durante, 'none', 'col mirino attivo lo scorrimento deve essere bloccato');
    assert.equal(r.dopo, 'pan-y',
      'alzato il dito, lo scorrimento deve tornare libero anche se il rilascio del puntatore si è perso');
    assert.equal(r.alNuovo, 'pan-y', 'e al tocco successivo la pagina deve scorrere di nuovo');
  } finally { await browser.close(); }
});

// ---- 5. PROVA DI CONTROLLO: la pressione lunga mostra ancora il mirino ----
test('la pressione lunga sul grafico mostra ancora il mirino', async () => {
  const {browser, pagina} = await telefono();
  try {
    const r = await pagina.evaluate(`(async function(){
      ${PREPARA}
      liveModeActive=false; positions.length=0; active=null; newsEvents=[]; draw();
      const X=rc.left+rc.width*0.5, Y=rc.top+rc.height*0.5;
      chartEl.dispatchEvent(T('touchstart',X,Y,61,true));
      chartEl.dispatchEvent(new PointerEvent('pointerdown',P(X,Y,61)));
      await new Promise(r=>setTimeout(r,200));
      chartEl.dispatchEvent(new PointerEvent('pointermove',P(X+6,Y+4,61)));  // il dito sbanda un po'
      await new Promise(r=>setTimeout(r,400));
      const mirino=!!fblMirinoTocco, croce=!!crosshair;
      chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign(P(X+6,Y+4,61),{buttons:0})));
      chartEl.dispatchEvent(T('touchend',X+6,Y+4,61,false));
      return {mirino, croce, dopoAlzato:!!fblMirinoTocco};
    })()`);
    assert.equal(r.mirino, true, 'tenendo premuto il dito il mirino deve comparire');
    assert.equal(r.croce, true, 'e la croce degli assi deve essere posizionata');
    assert.equal(r.dopoAlzato, false, 'alzando il dito il mirino deve sparire');
  } finally { await browser.close(); }
});

// ====== DUE DITA SPOSTANO IL GRAFICO SULLA PAGINA NORMALE ======
//
// REGRESSIONE MIA, segnalata dal proprietario (5 novembre 2026): «in modalità pagina principale
// non si sposta il grafico con due dita, dobbiamo tornare come era prima: con due dita in
// modalità normale devo poter spostare il grafico, mentre se sono a schermo intero lo sposto con
// un dito». L'avevo introdotta io con la rete di sicurezza dello scorrimento.
//
// CAUSA MISURATA, e sta nell'ORDINE degli eventi del browser: per un tocco arriva prima
// `pointerdown` — che registra il dito in `touchPoints` — e DOPO `touchstart`. La mia rete girava
// anche su touchstart e svuotava quel registro: misurato **1 dito dopo il pointerdown, 0 dopo la
// rete**. Il secondo dito non trovava più il primo, la coppia non si formava, e
// `iniziaGestoDueDita()` non partiva mai.
//
// Ora il registro si pulisce solo quando non c'è più nessun dito sullo schermo, dove è sicuro per
// definizione. All'inizio di un tocco si rimette solo lo scorrimento, che era il punto della cura.
test('sulla pagina normale due dita formano la coppia e avviano il gesto', async () => {
  const {browser, pagina, errori} = await telefono();
  try {
    const r = await pagina.evaluate(`(function(){
      ${PREPARA}
      liveModeActive=false; positions.length=0; active=null; draw();
      const X=rc.left+rc.width*0.4, Y=rc.top+rc.height*0.4;
      const Tdue=(tipo,punti)=>{ const ts=punti.map(p=>new Touch({identifier:p[2],target:chartEl,clientX:p[0],clientY:p[1]}));
        return new TouchEvent(tipo,{bubbles:true,cancelable:true,touches:ts,targetTouches:ts,changedTouches:[ts[ts.length-1]]}); };
      // L'ordine VERO del browser: pointerdown, poi touchstart. Se si invertisse, questa prova
      // non misurerebbe il difetto che c'era.
      chartEl.dispatchEvent(new PointerEvent('pointerdown',P(X,Y,1)));
      const dopoPointerdown=touchPoints.size;
      chartEl.dispatchEvent(Tdue('touchstart',[[X,Y,1]]));
      const dopoTouchstart=touchPoints.size;
      chartEl.dispatchEvent(new PointerEvent('pointerdown',P(X+120,Y+40,2)));
      chartEl.dispatchEvent(Tdue('touchstart',[[X,Y,1],[X+120,Y+40,2]]));
      return {dopoPointerdown, dopoTouchstart, dita:touchPoints.size, gesto:!!twoFingerPan};
    })()`);
    assert.deepEqual(erroriVeri(errori), [], 'la pagina non deve avere errori JS');
    assert.equal(r.dopoPointerdown, 1, 'il pointerdown registra il primo dito');
    assert.equal(r.dopoTouchstart, 1,
      'e il touchstart NON deve cancellarlo: era la regressione (misurato 0 prima della cura)');
    assert.equal(r.dita, 2, 'due dita appoggiate devono risultare due');
    assert.equal(r.gesto, true,
      'con due dita sulla pagina normale il gesto di spostamento del grafico deve partire');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: la rete di sicurezza deve continuare a fare il suo lavoro — a schermo
// libero da dita il registro si pulisce e lo scorrimento torna. Senza questa, la cura qui sopra
// potrebbe aver semplicemente spento la rete, e tornerebbe il difetto del 4 novembre (la pagina
// che non si scorre più sopra il grafico).
test('PROVA DI CONTROLLO: alzate le dita, il registro si pulisce e lo scorrimento torna', async () => {
  const {browser, pagina, errori} = await telefono();
  try {
    const r = await pagina.evaluate(`(async function(){
      ${PREPARA}
      liveModeActive=false; positions.length=0; active=null; draw();
      const X=rc.left+rc.width*0.4, Y=rc.top+rc.height*0.4;
      chartEl.dispatchEvent(T('touchstart',X,Y,51,true));
      chartEl.dispatchEvent(new PointerEvent('pointerdown',P(X,Y,51)));
      await new Promise(r=>setTimeout(r,600));     // parte il mirino: blocca lo scorrimento
      const durante=chartEl.style.touchAction, ditaDurante=touchPoints.size;
      chartEl.dispatchEvent(T('touchend',X,Y,51,false));   // nessun dito resta
      return {durante, ditaDurante, dopo:chartEl.style.touchAction, ditaDopo:touchPoints.size};
    })()`);
    assert.deepEqual(erroriVeri(errori), [], 'la pagina non deve avere errori JS');
    assert.equal(r.durante, 'none', 'col mirino attivo lo scorrimento resta bloccato');
    assert.equal(r.dopo, 'pan-y', 'alzato il dito lo scorrimento deve tornare libero');
    assert.equal(r.ditaDopo, 0, 'e il registro delle dita si svuota: li\u00ec pulire \u00e8 sicuro');
  } finally { await browser.close(); }
});
