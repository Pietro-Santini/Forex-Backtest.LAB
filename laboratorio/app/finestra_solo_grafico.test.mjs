// LA FINESTRA DUPLICATA MOSTRA SOLO IL GRAFICO.
//
// Riferito dal proprietario (4 novembre 2026): «in modalità duplica schermo ho visto che passi
// anche quelle che sono le tabelle delle posizioni, gli ordini pendenti, eccetera eccetera.
// Invece no, deve aprirsi a tutto schermo quello che è soltanto il grafico. Stop.» E con due
// regole attaccate: «le operazioni che apro sulle pagine duplicate andranno a finire nella
// pagina madre... per quanto riguarda i disegni invece no, quello rimane indipendente tra pagina
// e pagina, e ovviamente va scritto come informativo. E anche per esempio gli indicatori: se
// inserisco due indicatori sulla pagina duplicata non devono andare a finire su tutte le altre.»
//
// MISURATO sulla v2.0.80: una finestra aperta con ?pipSlot=2 mostrava l'intestazione e TUTTI i
// pannelli della pagina normale (posizioni aperte, ordini pendenti, diario, configurazioni), col
// grafico alto come su una pagina qualsiasi.
//
// La cura nasconde i pannelli invece di toglierli dal documento, e quella scelta è voluta: il
// motore dell'app continua a leggerli e scriverli, ed è così che una posizione aperta qui arriva
// comunque alla pagina madre. Le due prove sotto misurano esattamente questo confine.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const RITRATTO = `(function(){
  const vis=e=>{ if(!e)return false; const s=getComputedStyle(e);
    if(s.display==='none'||s.visibility==='hidden')return false;
    const b=e.getBoundingClientRect(); return b.width>0&&b.height>0; };
  const cw=document.querySelector('.chartWrap');
  const rc=cw?cw.getBoundingClientRect():{height:0};
  return {
    slot:(typeof PIP_SLOT==='number')?PIP_SLOT:-1,
    grafico:vis(cw),
    altezzaGrafico:Math.round(rc.height),
    pannelliVisibili:[...document.querySelectorAll('main > .panel')].filter(vis).length,
    intestazione:vis(document.querySelector('header')),
    posizioniAperte:vis(document.getElementById('openPositions')),
    ordiniPendenti:vis(document.getElementById('pendingOrdersTbl')),
    // Il documento deve restare INTERO: nascosti, non rimossi.
    pannelliNelDocumento:document.querySelectorAll('main > .panel').length,
    posizioniNelDocumento:!!document.getElementById('openPositions')
  };
})()`;

test('la finestra duplicata mostra il grafico a tutto schermo e niente altro', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=2', altezza:800});
  try {
    await pagina.waitForTimeout(2500);
    const r = await pagina.evaluate(RITRATTO);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.slot, 2, 'l\'app deve riconoscersi come finestra duplicata numero 2');
    assert.ok(r.grafico, 'il grafico deve vedersi');
    assert.ok(r.altezzaGrafico > 600,
      'il grafico deve prendere tutta la finestra, non ' + r.altezzaGrafico + 'px su 800');
    assert.equal(r.intestazione, false, 'l\'intestazione della pagina non deve vedersi');
    assert.equal(r.posizioniAperte, false, 'la tabella delle posizioni aperte non deve vedersi');
    assert.equal(r.ordiniPendenti, false, 'la tabella degli ordini pendenti non deve vedersi');
    assert.equal(r.pannelliVisibili, 1,
      'deve restare visibile un solo pannello (il grafico), invece sono ' + r.pannelliVisibili);
    // I pannelli sono NASCOSTI, non rimossi: se li togliessimo dal documento, le posizioni
    // aperte da questa finestra non arriverebbero più alla pagina madre.
    assert.ok(r.pannelliNelDocumento > 3,
      'i pannelli devono restare nel documento (trovati ' + r.pannelliNelDocumento + ')');
    assert.ok(r.posizioniNelDocumento, 'la tabella delle posizioni deve restare nel documento');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: la pagina normale non deve essere stata toccata. Senza questa, una regola
// CSS troppo larga nasconderebbe mezza applicazione a tutti e il test sopra resterebbe verde.
test('la pagina principale continua a mostrare tutto', async () => {
  const {browser, pagina, errori} = await apriApp({altezza:800});
  try {
    await pagina.waitForTimeout(2500);
    const r = await pagina.evaluate(RITRATTO);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.slot, 0, 'la pagina principale è lo slot 0');
    assert.ok(r.grafico, 'il grafico deve vedersi anche qui');
    assert.ok(r.intestazione, 'sulla pagina principale l\'intestazione ci deve essere');
    assert.ok(r.pannelliVisibili > 1,
      'sulla pagina principale i pannelli visibili devono essere più di uno, non '
      + r.pannelliVisibili);
  } finally { await browser.close(); }
});

// L'INFORMATIVA CHIESTA: il pulsante deve dire da sé cosa passa e cosa no.
test('il pulsante «Duplica finestra» spiega cosa è in comune e cosa resta della finestra', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const t = await pagina.evaluate(`(document.getElementById('nuovaFinestraBtn')||{}).title||''`);
    const b = t.toLowerCase();
    assert.ok(b.includes('posizioni') && b.includes('comune'),
      'il title deve dire che le posizioni sono in comune con la pagina principale: "' + t + '"');
    assert.ok(b.includes('disegni') && b.includes('indicatori'),
      'il title deve dire che disegni e indicatori restano di questa finestra: "' + t + '"');
  } finally { await browser.close(); }
});

// ====== COSA PASSA TRA UNA FINESTRA E L'ALTRA, E COSA NO ======
//
// Il proprietario ha messo il confine in due frasi: «le operazioni che apro sulle pagine
// duplicate andranno a finire nella pagina madre... per quanto riguarda i disegni invece no,
// quello rimane indipendente tra pagina e pagina». I disegni viaggiavano: c'era un messaggio
// 'drawings_sync' sul canale tra finestre, chiesto a suo tempo dal proprietario stesso e ora
// revocato. Gli indicatori non hanno mai viaggiato, e non devono iniziare.
//
// Qui si parla direttamente al gestore del canale (tradingChannel.onmessage): è lo stesso codice
// che gira quando il messaggio arriva per davvero da un'altra finestra, senza dover aprire due
// finestre vere in un banco di prova.
const ARRIVA = (messaggio) => `(function(){
  if(typeof tradingChannel==='undefined'||!tradingChannel||typeof tradingChannel.onmessage!=='function')return {canale:false};
  currentAssetKey='EURUSD'; rowsAssetKey='EURUSD';
  drawings=[{id:'mio',type:'trend'}];
  if(typeof activeIndicators!=='undefined')activeIndicators=[{id:'mio-ind',type:'ema'}];
  positions.length=0;
  tradingChannel.onmessage({data:${messaggio}});
  return {canale:true,
    disegni:drawings.map(function(d){return d.id;}),
    indicatori:((typeof activeIndicators!=='undefined'&&activeIndicators)||[]).map(function(i){return i.id;}),
    posizioni:positions.length};
})()`;

test('i disegni di un\'altra finestra NON entrano in questa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(ARRIVA(
      `{type:'drawings_sync',slot:1,asset:'EURUSD',mode:currentMode(),drawings:[{id:'altrui',type:'rect'}]}`));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.ok(r.canale, 'il canale tra finestre non è attivo: questa prova misurerebbe il vuoto');
    assert.deepEqual(r.disegni, ['mio'],
      'i disegni devono restare quelli di questa finestra, invece: ' + JSON.stringify(r.disegni));
    assert.deepEqual(r.indicatori, ['mio-ind'], 'gli indicatori restano locali anche loro');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO, la metà che DEVE passare: senza questa, un canale rotto o spento farebbe
// passare la prova qui sopra senza dimostrare niente.
test('le posizioni di un\'altra finestra entrano eccome', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(ARRIVA(
      `{type:'trading_sync',slot:1,at:Date.now(),positions:[{id:'daAltraFinestra',asset:'EURUSD',side:'BUY',entry:1.1,sl:1.09,tp:1.11,lots:0.1}],pendingOrders:[]}`));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.ok(r.canale, 'il canale tra finestre non è attivo');
    assert.equal(r.posizioni, 1,
      'una posizione aperta in un\'altra finestra deve arrivare qui (è la pagina madre che tiene tutto)');
  } finally { await browser.close(); }
});

// ====== E I PANNELLI NON DEVONO POTER TORNARE ======
//
// CAUSA MISURATA del difetto che il proprietario vedeva. Il nascondimento c'era già, ma lo
// faceva con uno stile INLINE (display:none !important messo sul nodo), e un
// `elemento.style.display='block'` scritto più tardi da qualunque parte dell'app CANCELLA quella
// dichiarazione inline. In una finestra duplicata basta che il codice riaccenda un pannello —
// succede quando arrivano le posizioni dalla pagina madre, o un ordine pendente — e la tabella
// ricompare a tutto schermo sopra il grafico. Misurato: pannelli visibili 1 → 2.
//
// La cura è una regola di foglio di stile con !important, che lo stile inline non può battere.
test('un pannello riacceso dal codice resta invisibile nella finestra duplicata', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=2', altezza:800});
  try {
    await pagina.waitForTimeout(2500);
    const r = await pagina.evaluate(`(function(){
      const vis=e=>{ const s=getComputedStyle(e); if(s.display==='none')return false;
        const b=e.getBoundingClientRect(); return b.width>0&&b.height>0; };
      const conta=()=>[...document.querySelectorAll('main > *')].filter(vis).length;
      const prima=conta();
      const t=document.getElementById('openPositions');
      if(!t)return {errore:'manca la tabella delle posizioni'};
      const pan=t.closest('.panel')||t;
      // Esattamente come fa l'app quando riaccende un pannello. NON con !important inline: quello
      // batterebbe qualunque foglio di stile, e l'app non lo usa - chiedere di resistere anche a
      // quello vorrebbe dire pretendere dal CSS una cosa che il CSS non puo' fare.
      pan.style.display='block';
      return {prima, dopo:conta(), tabellaVisibile:vis(pan)};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.ok(!r.errore, r.errore || '');
    assert.equal(r.prima, 1, 'all\'avvio deve essere visibile solo il grafico');
    assert.equal(r.tabellaVisibile, false,
      'la tabella delle posizioni non deve tornare a vista in una finestra duplicata');
    assert.equal(r.dopo, 1,
      'dopo la riaccensione i pannelli visibili devono restare uno (il grafico), sono ' + r.dopo);
  } finally { await browser.close(); }
});
