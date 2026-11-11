// L'ORDINE PENDENTE CANCELLATO DAL TERMINALE MT5 RESTA FANTASMA NELL'APP.
//
// SEGNALATO dal proprietario (10 novembre 2026), con screenshot: un ordine pendente
// (SELL LIMIT XAU/USD, entry 4102.80, SL 4110.67, TP 4080.60, lotti 0.13, origine "Manuale",
// sessione MT5 REALE) è stato CANCELLATO DIRETTAMENTE dal terminale MT5, ma resta nella tabella
// "Ordini pendenti MT5 (conto reale collegato)" e non viene disegnato sul grafico.
//
// MISURA SUL LOG VERO DEL PONTE (cartella del programma installato):
//   ForexBacktestLAB.log.1 : 120 righe 'GET /orders HTTP/1.1" 400 Bad Request' (+ 120 'positions 400')
//   ForexBacktestLAB.log   :  96 righe 'GET /orders HTTP/1.1" 400 Bad Request' (+  97 'positions 400')
//   Cioè ZERO letture di /orders riuscite. E i 200 non si possono contare da lì per costruzione:
//   il filtro _LOG_RE_RUMORE (bridge.py riga ~98) butta le righe 2xx del polling. Il 400 lo alza
//   bridge.py riga ~3834: `if not mt5_connected: raise HTTPException(400, "Non connesso...")`.
//
// IPOTESI DA MISURARE (non data per buona): l'app viene a sapere che un ordine è sparito SOLO
// quando la lettura GET /orders riesce. Se il ponte risponde 400, il calcolo di `vanished`
// (app.html ~41885) non gira mai e l'ordine fantasma resta per sempre.
//
// Qui il ponte è finto con un HTTP VERO: si sostituisce solo window.fetch, così `res.ok` e
// `res.json()` sono quelli di una risposta vera e non di una funzione ritoccata.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const TICKET = '7770123';
const FANTASMA = {
  id: 4242, asset: 'XAU/USD', side: 'SELL', kind: 'LIMIT',
  entry: 4102.80, sl: 4110.67, tp: 4080.60, lots: 0.13,
  origin: 'Manuale', createdAt: Date.now() - 3600000, mt5AddedAt: Date.now() - 3600000,
  mt5Ticket: TICKET, mt5Login: '68794', mt5Server: 'Broker-Demo',
};

// La scena della segnalazione dentro la pagina. `loginConto` è il conto su cui l'app dice di
// essere collegata adesso; il fantasma porta mt5Login del conto che l'ha creato.
function scena(loginConto) {
  return `
  const t0=Date.now()-200*60000; let pv=4094; const R=[];
  for(let i=0;i<200;i++){ const o=pv,c=pv+Math.sin(i/9)*1.2;
    R.push({date:new Date(t0+i*60000).toISOString(),open:o,high:Math.max(o,c)+0.6,low:Math.min(o,c)-0.6,close:c,volume:5}); pv=c; }
  rows=R; baseRows=R.slice(); idx=R.length-1; viewEnd=R.length; visibleCount=120;
  currentAssetKey='XAU/USD'; rowsAssetKey='XAU/USD';
  liveModeActive=true; liveReplayActive=false; fblBacktestModeAttivo=false;
  mt5Connected=true;
  mt5ContoAttivo=${loginConto ? "{login:" + JSON.stringify(loginConto) + ",server:'Broker-Demo'}" : "null"};
  mt5ActiveSymbol=null; lastMt5TickPrice=null; lastPrimaryEpicPrice=null;
  positions=[]; active=null; posSelezionata=null; pendingOrders=[];
  followLatest=true; viewPriceLo=null; viewPriceHi=null;
  localStorage.setItem('fbl_ordini_pendenti','1');`;
}

// Il ponte finto: /orders risponde con `codice` e il corpo JSON dato (stringa già pronta).
// Le altre rotte proseguono come prima (aiuti.mjs le aborta: niente esce dal banco).
function ponte(codice, corpoJson) {
  // ATTENZIONE: il corpo va iniettato come STRINGA. Un array/oggetto iniettato come valore
  // diventerebbe "[]"/"[object Object]" e `res.json()` non leggerebbe niente: è così che il
  // primo giro di questo banco misurava un finto "non si toglie mai".
  return `
  const veroFetch=window.fetch, viste=[], corpo=${JSON.stringify(JSON.stringify(corpoJson))};
  window.fetch=function(u){ const url=String(u);
    if(url.indexOf('/orders')>=0){ viste.push(url);
      return Promise.resolve(new Response(corpo,{status:${codice},headers:{'Content-Type':'application/json'}})); }
    return veroFetch.apply(this,arguments); };
  window.__ripristinaFetch=function(){ window.fetch=veroFetch; };
  window.__viste=viste;`;
}

function bancoBase(codice, corpo, loginConto, fantasma) {
  return "(async () => {\n"
    + "  const F=" + JSON.stringify(fantasma) + ";\n"
    + scena(loginConto) + "\n"
    + "  pendingOrders.push(JSON.parse(JSON.stringify(F)));\n"
    + "  const prima={pendenti:pendingOrders.length,biglietti:pendingOrders.map(x=>x.mt5Ticket)};\n"
    + ponte(codice, corpo) + "\n"
    + "  await fetchMt5Orders();\n"      // il polling vero chiama questa ogni secondo
    + "  await fetchMt5Orders();\n"
    + "  window.__ripristinaFetch();\n"
    + "  update();\n"
    // Le righe della tabella MT5: il ticket di un ordine tracciato sta solo nell'attributo
    // title (app.html ~14202), quindi si contano le righe, non il testo.
    + "  const righe=document.querySelectorAll('#mt5PendingTbl tr').length;\n"
    + "  return {prima:prima, dopo:{pendenti:pendingOrders.length,biglietti:pendingOrders.map(x=>x.mt5Ticket),"
    + "ordiniDalPonte:mt5RealOrders.length,lettureOrders:window.__viste.length,righeInTabella:righe,"
    + "pannelloVisibile:document.getElementById('mt5PendingPanel').style.display,"
    + "stato:document.getElementById('status').textContent.slice(0,140)}};\n"
    + "})()";
}

// =====================================================================
// 1. IL DIFETTO: il ponte risponde 400 (com'è misurato sul log vero).
// =====================================================================
test("il pendente cancellato dal terminale resta in tabella se GET /orders risponde 400", async () => {
  const { browser, pagina, errori } = await apriApp();
  try {
    const r = await pagina.evaluate(bancoBase(
      400, { detail: 'Non connesso: chiama prima /connect' }, '68794', FANTASMA));
    console.log('PONTE /orders = 400 :', JSON.stringify(r, null, 1));
    // OGGI È ROSSO: due letture, due 400, e il fantasma è ancora in pendingOrders e in tabella.
    assert.equal(r.dopo.pendenti, 0,
      "l'ordine sparito dal conto deve sparire da pendingOrders anche col ponte in 400: " + JSON.stringify(r.dopo));
    assert.equal(r.dopo.righeInTabella, 0,
      'e non deve restare nessuna riga col suo ticket nella tabella dei pendenti MT5: ' + JSON.stringify(r.dopo));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// =====================================================================
// 2. CONTROLLO: la lettura riesce (200) e il conto non ha più quell'ordine.
//    Dimostra che la causa È il 400, e non una condizione del filtro `vanished`.
// =====================================================================
test("con la lettura riuscita (200) lo stesso fantasma viene tolto: la causa è il 400", async () => {
  const { browser, pagina, errori } = await apriApp();
  try {
    const r = await pagina.evaluate(bancoBase(200, [], '68794', FANTASMA));
    console.log('PONTE /orders = 200 [] :', JSON.stringify(r, null, 1));
    // VERDE: mt5Ticket, mt5AddedAt, mt5Login NON escludono l'ordine. L'unico ostacolo è
    // `result.ok` (app.html ~41861): con 400 è falso e il calcolo di `vanished` non parte.
    assert.equal(r.dopo.pendenti, 0,
      'con la fotografia riuscita il fantasma si toglie: ' + JSON.stringify(r.dopo));
    assert.equal(r.dopo.righeInTabella, 0, 'e la riga sparisce dalla tabella: ' + JSON.stringify(r.dopo));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// =====================================================================
// 2b. Il filtro "altro conto" (app.html ~41885): se il fantasma porta il login di un conto
//     DIVERSO da quello collegato, la lettura RIUSCITA non lo toglie. Seconda strada, voluta,
//     per cui un fantasma può restare in tabella: la sua assenza non dice niente di quel conto.
// =====================================================================
test("il fantasma di un ALTRO conto non viene tolto nemmeno con la lettura riuscita", async () => {
  const { browser, pagina, errori } = await apriApp();
  try {
    const altro = Object.assign({}, FANTASMA, { mt5Login: '99999' });
    const r = await pagina.evaluate(bancoBase(200, [], '68794', altro));
    console.log('PONTE 200, fantasma di un altro conto :', JSON.stringify(r, null, 1));
    assert.equal(r.dopo.pendenti, 1,
      'finché il fantasma porta il login di un altro conto resta (scelta voluta): ' + JSON.stringify(r.dopo));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// =====================================================================
// 3. PERCHÉ NON COMPARE A GRAFICO: la catena esatta dei filtri che applica draw()
//    (app.html ~20505: interruttore di Style, poi drawableOnCurrentChart, poi il prezzo
//    dentro il range [lo,hi] — ~20529 per l'entrata, ~20560 per SL/TP).
// =====================================================================
test("il fantasma in tabella non passa i filtri del grafico (misurati uno per uno)", async () => {
  const { browser, pagina, errori } = await apriApp();
  try {
    const r = await pagina.evaluate("(async () => {\n"
      + "  const F=" + JSON.stringify(FANTASMA) + ";\n"
      + scena('68794') + "\n"
      + "  pendingOrders.push(JSON.parse(JSON.stringify(F)));\n"
      + "  const p=pendingOrders[0];\n"
      + "  const data=getVisibleData();\n"
      + "  const rg=computePriceRange(data);\n"
      + "  const catena={\n"
      + "    interruttoreOrdiniPendenti: fblOrdiniPendentiVisibili(),\n"
      + "    assetAGrafico: currentAssetKey,\n"
      + "    appartieneAllAsset: belongsToCurrentAsset(p),\n"
      + "    appartieneAllaVista: positionBelongsToCurrentView(p),\n"
      + "    disegnabile: drawableOnCurrentChart(p),\n"
      + "    entry: p.entry, lo: rg.lo, hi: rg.hi,\n"
      + "    entryDentroRange: p.entry>=rg.lo && p.entry<=rg.hi,\n"
      + "    slDentroRange: p.sl>=rg.lo && p.sl<=rg.hi,\n"
      + "    tpDentroRange: p.tp>=rg.lo && p.tp<=rg.hi,\n"
      + "  };\n"
      + "  function snap(){ const c=document.getElementById('chart'); return c.getContext('2d').getImageData(0,0,c.width,c.height).data; }\n"
      + "  function diff(a,b){ let n=0; for(let i=0;i<a.length;i+=4){ if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++; } return n; }\n"
      + "  draw(); const A=snap();\n"
      + "  pendingOrders.length=0; draw(); const B=snap();\n"
      + "  draw(); const B2=snap();\n"
      + "  pendingOrders.push(JSON.parse(JSON.stringify(F)));\n"
      + "  return {catena:catena, pixelDiversiTogliendoIlFantasma:diff(A,B), pixelDiversiRumore:diff(B,B2)};\n"
      + "})()");
    console.log('GRAFICO (stesso conto) :', JSON.stringify(r, null, 1));
    assert.ok(r.catena.disegnabile, 'col fantasma dello stesso conto il filtro di vista passa: ' + JSON.stringify(r.catena));
    assert.ok(r.pixelDiversiTogliendoIlFantasma > 0,
      'togliere il fantasma deve cambiare il canvas (cioè era disegnato): ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// =====================================================================
// 3b. La stessa misura col fantasma di un altro conto: la riga RESTA in tabella (la tabella
//     non ha il filtro del conto, app.html ~14200) ma il grafico non lo disegna. È esattamente
//     ciò che si vede nello screenshot: in tabella sì, a grafico no.
// =====================================================================
test("il fantasma di un altro conto: in tabella sì, a grafico no", async () => {
  const { browser, pagina, errori } = await apriApp();
  try {
    const r = await pagina.evaluate("(async () => {\n"
      + "  const F=" + JSON.stringify(Object.assign({}, FANTASMA, { mt5Login: '99999' })) + ";\n"
      + scena('68794') + "\n"
      + "  pendingOrders.push(JSON.parse(JSON.stringify(F)));\n"
      + "  update();\n"
      + "  const p=pendingOrders[0];\n"
      + "  const data=getVisibleData();\n"
      + "  const rg=computePriceRange(data);\n"
      + "  const righe=document.querySelectorAll('#mt5PendingTbl tr').length;\n"
      + "  function snap(){ const c=document.getElementById('chart'); return c.getContext('2d').getImageData(0,0,c.width,c.height).data; }\n"
      + "  function diff(a,b){ let n=0; for(let i=0;i<a.length;i+=4){ if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++; } return n; }\n"
      + "  draw(); const A=snap();\n"
      + "  pendingOrders.length=0; draw(); const B=snap();\n"
      + "  pendingOrders.push(JSON.parse(JSON.stringify(F)));\n"
      + "  return {righeInTabella:righe,\n"
      + "    appartieneAllaVista: positionBelongsToCurrentView(p),\n"
      + "    disegnabile: drawableOnCurrentChart(p),\n"
      + "    lo: rg.lo, hi: rg.hi, entry: p.entry,\n"
      + "    pixelDiversiTogliendoIlFantasma: diff(A,B)};\n"
      + "})()");
    console.log('GRAFICO (fantasma di un altro conto) :', JSON.stringify(r, null, 1));
    assert.equal(r.righeInTabella, 1, 'la riga resta in tabella: la tabella non filtra per conto');
    assert.equal(r.disegnabile, false, 'il grafico invece non lo disegna: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// =====================================================================
// 4. IL «CANCELLA» DI DOMENICA: l'ordine che MT5 non ha più, provato a cancellare, resta.
//    È ciò che è successo DAVVERO il 10 novembre alle 14:28:53 — dal journal del terminale
//    MT5 (D0E8209F...\logs\20261110.log, ordine #581084659 = quello dello screenshot):
//       14:28:53.016  failed cancel order #581084659 buy 0 at market [Invalid request]
//       14:28:53.018  failed cancel order #581084659 buy 0 at market [Invalid request]
//    e nel log del ponte ci sono 2 righe 'POST /order/cancel HTTP/1.1" 400 Bad Request'.
//    Il ponte risponde 400 → l'app scrive l'avviso e NON toglie il pendente (app.html ~30406).
// =====================================================================
test("il «Cancella» su un ordine che MT5 non ha più non lo toglie dalla lista", async () => {
  const { browser, pagina, errori } = await apriApp();
  try {
    const r = await pagina.evaluate("(async () => {\n"
      + "  const F=" + JSON.stringify(FANTASMA) + ";\n"
      + scena('68794') + "\n"
      + "  pendingOrders.push(JSON.parse(JSON.stringify(F)));\n"
      + "  window.appConfirm=async()=>true; appConfirm=window.appConfirm;\n"
      + "  update();\n"
      // Il ponte: /order/cancel risponde 400 (ciò che MT5 ha risposto davvero) e /orders pure,
      // perché in quello stesso istante la lettura dei pendenti non riusciva (log del ponte).
      + "  const veroFetch=window.fetch, viste=[];\n"
      + "  window.fetch=function(u){ const url=String(u); viste.push(url);\n"
      + "    return Promise.resolve(new Response(JSON.stringify({detail:'Ordine rifiutato dal broker: Invalid request'}),"
      + "{status:400,headers:{'Content-Type':'application/json'}})); };\n"
      + "  const prima=pendingOrders.length;\n"
      + "  const btn=document.querySelector('#mt5PendingTbl [data-cancelpending]');\n"
      + "  const cliccato=!!btn;\n"
      + "  if(btn)btn.click();\n"
      + "  await new Promise(r=>setTimeout(r,400));\n"
      + "  window.fetch=veroFetch;\n"
      + "  const righe=document.querySelectorAll('#mt5PendingTbl tr').length;\n"
      + "  return {prima:prima, cliccato:cliccato, dopo:pendingOrders.length, righeInTabella:righe,\n"
      + "    annulli:viste.filter(u=>u.indexOf('/order/cancel')>=0).length,\n"
      + "    stato:document.getElementById('status').textContent.slice(0,140)};\n"
      + "})()");
    console.log('CANCELLA FALLITO :', JSON.stringify(r, null, 1));
    // OGGI È ROSSO: il pulsante è cliccato, MT5 risponde "non ce l'ho", e il fantasma resta.
    assert.equal(r.dopo, 0,
      'un ordine che il ponte dichiara inesistente non deve restare in elenco: ' + JSON.stringify(r));
    assert.equal(r.righeInTabella, 0, 'e la riga deve sparire dalla tabella: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
