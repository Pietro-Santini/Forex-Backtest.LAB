// UN DISEGNO FATTO SU UNA FINESTRA DEVE COMPARIRE ANCHE SULLE ALTRE, SUBITO.
//
// RICHIESTO dal proprietario (10 novembre 2026): «per quanto riguarda i disegni che aggiungo su
// una pagina duplicata, mi si deve spalmare anche nelle altre pagine. Cioè, se metto un rettangolo
// o una linea o un ritracciamento Fibonacci su una finestra, mi si deve spalmare anche nelle altre
// finestre.»
//
// COME SONO FATTE LE FINESTRE (misurato, non supposto):
//   - la finestra PRINCIPALE (slot 0) e le pagine DUPLICATE aperte dal pulsante «Duplica finestra»
//     (openExtraPipWindow(), app.html?pipSlot=N con window.open): ognuna è una copia COMPLETA e
//     indipendente dell'app, con il suo motore JS e la sua copia di `drawings`;
//   - il canale che le collega esiste già: BroadcastChannel 'fxbt_trading_sync_v1' (tradingChannel),
//     oggi usato SOLO per posizioni/ordini/conto ('trading_sync'). Per i disegni esiste un
//     messaggio dedicato ('drawings_sync') che dal 4 novembre 2026 non viene più né mandato né
//     applicato: broadcastDrawingsStateNow() (riga ~9090) è un `return` e il ramo che riceve
//     'drawings_sync' (riga ~9224) è un altro `return`.
//
// Questo banco misura il COMPORTAMENTO con due pagine vere, non le stringhe del sorgente.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

// Raccoglie gli errori JS di OGNI pagina aperta dal banco (apriApp lo fa solo per la prima).
function ascoltaErrori(pagina) {
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  return errori;
}

// 200 candele sulla STESSA asset in tutte e due le finestre: i disegni sono salvati per
// asset+modalità, quindi perché un disegno possa "spalmarsi" le due finestre devono mostrare la
// stessa cosa. Stesso prepara degli altri banchi dei disegni.
const PREPARA = () => {
  const T0 = Date.UTC(2026, 9, 20, 10, 0, 0);
  const R = [];
  for (let i = 0; i < 200; i++) R.push({date: new Date(T0 + i * 60000).toISOString(),
    open: 100, high: 100.8, low: 99.2, close: 100.1, volume: 10});
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  currentAssetKey = 'EURUSD';
  liveModeActive = false; mt5Connected = false;
  positions = []; trades = []; active = null; pendingOrders = [];
  drawings = []; selectedDrawing = null; pendingDrawing = null; placingStep = 0;
  return {slot: PIP_SLOT, asset: currentAssetKey, canale: !!tradingChannel};
};

// Il percorso VERO dell'utente: preme lo strumento rettangolo e mette due punti sul canvas.
const DISEGNA_RETTANGOLO = () => {
  const el = document.getElementById('chart');
  try { el.setPointerCapture = function(){}; el.releasePointerCapture = function(){}; } catch(e){}
  setDrawTool('rectangle');
  draw();
  const rc = el.getBoundingClientRect();
  const tocca = (x, y) => {
    const opt = {pointerId: 7, pointerType: 'mouse', button: 0, buttons: 1, bubbles: true, cancelable: true,
                 clientX: rc.left + x, clientY: rc.top + y};
    el.dispatchEvent(new PointerEvent('pointerdown', opt));
    el.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, opt, {buttons: 0})));
  };
  tocca(220, 200);           // primo punto
  const passo = placingStep; // 1 = primo punto fissato, manca il secondo
  tocca(420, 340);           // secondo punto: il disegno nasce qui
  return {passo: passo, quanti: drawings.length, tipi: drawings.map(d => d.type),
          selezionato: selectedDrawing ? selectedDrawing.type : null};
};

const LEGGI_DISEGNI = () => ({slot: PIP_SLOT, quanti: drawings.length,
  tipi: drawings.map(d => d.type), asset: currentAssetKey, modo: currentMode()});

// Madre + pagina duplicata (?pipSlot=2), stessa pagina dello stesso contesto: è così che le apre
// il pulsante «Duplica finestra» e così che il BroadcastChannel dell'app le raggiunge.
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

// PROVA DI CONTROLLO, e senza questa le altre non concluderebbero niente: se il canale fra le due
// pagine non trasportasse i messaggi, vedere zero disegni sull'altra finestra non significherebbe
// che il programma li trattiene — significherebbe che il banco non può misurare.
test('PROVA DI CONTROLLO: il canale fra le due finestre trasporta davvero i messaggi', async () => {
  const {browser, madre, duplicata} = await apriDueFinestre();
  try {
    const prep = await madre.evaluate(PREPARA);
    assert.equal(prep.canale, true, 'la finestra principale deve avere il canale BroadcastChannel');
    await duplicata.evaluate(PREPARA);
    await duplicata.evaluate(() => {
      window.__arrivi = [];
      tradingChannel.onmessage = function(ev){ window.__arrivi.push(ev && ev.data); };
    });
    await madre.evaluate(() => { try { tradingChannel.postMessage({type: 'sonda', slot: PIP_SLOT}); } catch(e){} });
    await madre.waitForTimeout(900);
    const arrivi = await duplicata.evaluate(() => (window.__arrivi || []).map(m => m && m.type));
    // La sonda deve ARRIVARE (e' la prova che il banco sa misurare). Non si pretende che sia
    // l'unico messaggio: la madre annuncia anche l'asset quando la duplicata si apre
    // (misurato il 10 novembre 2026 - l'elenco esatto dipende da quando l'altra pagina
    // finisce di caricarsi, e un banco che pretende l'ordine esterno e' un banco fragile).
    assert.ok(arrivi.indexOf('sonda') >= 0,
      'il canale esiste ma non consegna fra le due pagine: ' + JSON.stringify(arrivi));
  } finally { await browser.close(); }
});

// LA MISURA DEL DIFETTO, col percorso vero dell'utente: un rettangolo messo sulla finestra
// principale NON compare sulla duplicata. Oggi misura 1 contro 0.
test('un rettangolo disegnato sulla finestra principale si spalma anche sulla duplicata', async () => {
  const {browser, madre, duplicata, errori, errori2} = await apriDueFinestre();
  try {
    await madre.evaluate(PREPARA);
    await duplicata.evaluate(PREPARA);
    const fatto = await madre.evaluate(DISEGNA_RETTANGOLO);
    assert.deepEqual(errori, [], 'nessun errore di pagina mentre si disegna');
    assert.equal(fatto.passo, 1, 'il primo punto del rettangolo deve essere fissato (placingStep=1)');
    assert.equal(fatto.quanti, 1, 'il rettangolo deve esistere sulla finestra dove l\'ho disegnato');
    assert.deepEqual(fatto.tipi, ['rectangle']);

    // Il giro che diffonde i disegni confronta la loro firma ogni 1500 ms: si aspetta abbastanza
    // da non misurare un passo prima della campanella.
    await madre.waitForTimeout(3200);
    const qua = await madre.evaluate(LEGGI_DISEGNI);
    const la = await duplicata.evaluate(LEGGI_DISEGNI);
    assert.deepEqual(errori, [], 'nessun errore di pagina nella finestra principale');
    assert.deepEqual(errori2, [], 'nessun errore di pagina nella duplicata');
    assert.equal(la.quanti, qua.quanti,
      'il rettangolo disegnato sulla finestra principale (slot ' + qua.slot + ', ' + qua.quanti
      + ' disegno) deve vedersi anche sulla duplicata (slot ' + la.slot + ', ' + la.asset
      + '): invece la duplicata ne ha ' + la.quanti);
    assert.deepEqual(la.tipi, ['rectangle'], 'e deve essere lo STESSO rettangolo');
  } finally { await browser.close(); }
});

// LA SECONDA META' DEL DIFETTO, dal lato della finestra che crea il disegno: la funzione che
// dovrebbe annunciarlo non manda NESSUN messaggio. Zero messaggi, non "uno sbagliato".
test('creato un disegno, la finestra annuncia il cambiamento alle altre', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA);
    const mandati = await pagina.evaluate(() => {
      const visti = [];
      tradingChannel.postMessage = function(m){ visti.push(m && m.type); };
      broadcastDrawingsStateNow();   // quello che chiama il giro da 1500ms quando i disegni cambiano
      requestDrawingsSyncNow();      // e quello che chiede i disegni alle altre finestre
      return visti;
    });
    assert.deepEqual(errori, [], 'nessun errore di pagina');
    assert.ok(mandati.indexOf('drawings_sync') >= 0,
      'creando un disegno la finestra deve avvisare le altre con un drawings_sync; messaggi mandati: '
      + JSON.stringify(mandati));
  } finally { await browser.close(); }
});

// LA TERZA META', dal lato di chi RICEVE: un drawings_sync che arriva davvero deve cambiare i
// disegni di questa finestra. Oggi non fa niente (misurato: 0 disegni resta 0).
test('un drawings_sync che arriva viene applicato ai disegni di questa finestra', async () => {
  const {browser, pagina, errori} = await apriApp({query: '?pipSlot=2'});
  try {
    await pagina.waitForTimeout(2000);
    const r = await pagina.evaluate(() => {
      drawings.length = 0;
      tradingChannel.onmessage({data: {type: 'drawings_sync', slot: 0, asset: currentAssetKey,
        mode: currentMode(),
        drawings: [{id: 'r1', type: 'rectangle', p1: {time: 1, price: 100}, p2: {time: 2, price: 100.6}}]}});
      return {dopo: drawings.length, tipi: drawings.map(d => d.type)};
    });
    assert.deepEqual(errori, [], 'nessun errore di pagina');
    assert.equal(r.dopo, 1,
      'un disegno arrivato dall\'altra finestra deve comparire anche qui; disegni qui: ' + r.dopo);
    assert.deepEqual(r.tipi, ['rectangle']);
  } finally { await browser.close(); }
});


// LA SCELTA DEL PROPRIETARIO (10 novembre 2026), e non e' una formalita': alla domanda «confermi
// che i disegni ora devono passare da una finestra a tutte le altre?» ha risposto «solo alcuni tipi
// di disegno». Quindi rettangolo, linee e Fibonacci viaggiano; il profilo volumetrico, la VWAP e le
// linee Allarme restano di ogni finestra, come aveva chiesto il 4 novembre.
test('passano solo i disegni condivisi: rettangolo, linea e Fibonacci si, VWAP no', async () => {
  const {browser, pagina, errori} = await apriApp();
  const dup = await pagina.context().newPage();
  const errori2 = [];
  dup.on('pageerror', e => errori2.push(String(e).slice(0, 300)));
  try {
    await dup.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await dup.goto('file://' + path.join(RADICE, 'app.html') + '?pipSlot=2', {waitUntil: 'domcontentloaded'});
    await dup.waitForTimeout(2500);
    for (const pg of [pagina, dup]) {
      await pg.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
        .forEach(el => el.style.display = 'none'));
    }
    await pagina.evaluate(PREPARA);
    await dup.evaluate(PREPARA);

    //Tre disegni sulla madre, col percorso vero dell'utente: rettangolo (due punti), trendline
    //(due punti) e VWAP (un punto solo). Il primo e il secondo devono viaggiare, il terzo no.
    const messi = await pagina.evaluate(() => {
      const el = document.getElementById('chart');
      try { el.setPointerCapture = function(){}; el.releasePointerCapture = function(){}; } catch(e){}
      const rc = el.getBoundingClientRect();
      const tocca = (x, y) => { const o = {pointerId: 7, pointerType: 'mouse', button: 0,
        buttons: 1, bubbles: true, cancelable: true, clientX: rc.left + x, clientY: rc.top + y};
        el.dispatchEvent(new PointerEvent('pointerdown', o));
        el.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, o, {buttons: 0}))); };
      setDrawTool('rectangle'); draw(); tocca(200, 180); tocca(380, 300);
      setDrawTool('trendline'); draw(); tocca(200, 360); tocca(380, 460);
      setDrawTool('vwap');       draw(); tocca(300, 250);
      return drawings.map(d => d.type);
    });
    assert.deepEqual(messi, ['rectangle', 'trendline', 'vwap'],
      'i tre disegni devono esistere sulla finestra dove li ho fatti, trovati: ' + JSON.stringify(messi));

    await pagina.waitForTimeout(3200);
    const la = await dup.evaluate(LEGGI_DISEGNI);
    assert.deepEqual(errori, [], 'nessun errore di pagina nella finestra principale');
    assert.deepEqual(errori2, [], 'nessun errore di pagina nella duplicata');
    assert.deepEqual(la.tipi, ['rectangle', 'trendline'],
      'rettangolo e linea devono passare, la VWAP deve restare di questa finestra; sulla duplicata ci '
      + 'sono: ' + JSON.stringify(la.tipi));
  } finally { await browser.close(); }
});
