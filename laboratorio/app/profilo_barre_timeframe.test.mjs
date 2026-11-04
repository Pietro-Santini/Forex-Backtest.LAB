// L'ISTOGRAMMA DEL PROFILO: IL NUMERO DELLE FASCE È FISSO, LA LUNGHEZZA SEGUE LO ZOOM.
//
// SONO DUE COSE DIVERSE, e io le ho confuse. Vale la pena scriverlo per intero, perché questo
// file per qualche ora ha PRETESO il comportamento sbagliato — che è il modo peggiore in cui un
// test può passare.
//
// QUELLO CHE IL PROPRIETARIO AVEVA CHIESTO (3-4 novembre 2026): «se stabilisco quelle che sono
// 300 barre con un time frame impostato a un minuto, se passo a 5 minuti non possono dimezzare…
// è importantissimo mantenere in verticale sempre il numero selezionato dall'utente di n barre,
// perché sennò si sposterebbe quello che è il not volume». Cioè: il NUMERO delle fasce.
//
// QUELLO CHE AVEVO FATTO IO: avevo agganciato la LUNGHEZZA delle barre al riquadro del grafico
// invece che al periodo coperto dal profilo. E la sua risposta, appena pubblicato: «attenzione,
// abbiamo un problema gravissimo… siamo ritornati al vecchissimo problema che avevamo una volta:
// quando effettuavamo lo zoom, le dimensioni dell'istogramma rimangono uguali. No, no, no, devi
// ritornare alla versione precedente. Io ti avevo detto soltanto di modificare quello che era il
// numero delle barre, ma non il fatto della dimensione… sono due cose diverse.»
//
// Aveva ragione, ed era un difetto già corretto una volta in passato. Da qui le DUE prove di
// questo file, che misurano le due cose separatamente:
//   1. il numero delle fasce NON cambia col timeframe (la richiesta vera);
//   2. la lunghezza delle barre CAMBIA con lo zoom (il difetto da non far tornare).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Disegna un profilo manuale e restituisce quante fasce ha disegnato e quanto è lunga la barra
// più lunga. Si legge `vpIndBarRects`, dove il disegnatore registra la geometria ESATTA di ogni
// barra: leggere i rettangoli dal canvas prenderebbe dentro candele, sfondi e zona a basso
// volume (tre misure sbagliate, prima di arrivare a questa).
const MISURA = ({tf = 1, candeleAVista = 80, minutiProfilo = 300}) => `(function(){
  const t0=Date.UTC(2026,9,20,8,0,0); const R=[]; let p=1900;
  for(let i=0;i<900;i++){ p+=(Math.sin(i/13)+Math.cos(i/7))*0.3;
    R.push({date:new Date(t0+i*60000).toISOString(),open:p,high:p+0.8,low:p-0.8,close:p+0.1,volume:10+(i%7)}); }
  csvLibrary=[{name:'t',rows:R}]; rebuildBaseRowsFromLibrary();
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD'; liveModeActive=false; liveReplayActive=false;
  currentTF=${tf}; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
  viewEnd=rows.length-1; idx=rows.length-1;
  visibleCount=${candeleAVista}; autoFitWidth=false; followLatest=false;
  // Il profilo copre gli ULTIMI 300 MINUTI DI MERCATO in tutti i casi, non le ultime N candele:
  // altrimenti si confronterebbero periodi di durata diversa.
  const ultime=Math.round(${minutiProfilo}/${tf});
  const a=rows.length-ultime, b=rows.length-1;
  drawings=[{id:'vp1',type:'vpfixed',
    p1:{time:parseDateTime(rows[a].date),price:rows[a].close},
    p2:{time:parseDateTime(rows[b].date),price:rows[b].close},
    buckets:120,barSizePct:500,upColor:'#2fbf71',downColor:'#e05252',
    _vpIndBars:true,bgEnabled:false,lvnEnabled:false,pocEnabled:false,vahEnabled:false,valEnabled:false,extendRight:false}];
  draw();
  const barre=vpIndBarRects.get('vp1')||[];
  let piuLunga=0;
  barre.forEach(function(b){ const L=b.x2-b.x1; if(L>piuLunga)piuLunga=L; });
  return {fasce:barre.length, piuLunga:Math.round(piuLunga)};
})()`;

// ---- 1. LA RICHIESTA VERA: il numero delle fasce non dipende dal timeframe ----
test('il numero delle fasce resta lo stesso a 1, 5 e 15 minuti', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const a = await pagina.evaluate(MISURA({tf: 1}));
    const b = await pagina.evaluate(MISURA({tf: 5}));
    const c = await pagina.evaluate(MISURA({tf: 15}));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    // Controllo del banco: se non disegnasse niente, l'uguaglianza sotto sarebbe banalmente vera.
    assert.ok(a.fasce > 50, 'il banco non disegna l\'istogramma: ' + a.fasce + ' fasce');
    assert.equal(a.fasce, b.fasce,
      'da 1 a 5 minuti le fasce sono cambiate: ' + a.fasce + ' -> ' + b.fasce);
    assert.equal(a.fasce, c.fasce,
      'da 1 a 15 minuti le fasce sono cambiate: ' + a.fasce + ' -> ' + c.fasce
      + ' (è quello che spostava il «not volume»)');
  } finally { await browser.close(); }
});

// ---- 2. IL DIFETTO DA NON FAR TORNARE: la lunghezza deve seguire lo zoom ----
//
// «Quando effettuavamo lo zoom, le dimensioni dell'istogramma rimangono uguali»: è il vecchio
// difetto. La lunghezza è agganciata al PERIODO coperto dal profilo, quindi zoomando dentro le
// barre si allungano insieme alle candele. Si confrontano due zoom sullo stesso profilo: meno
// candele a vista = più pixel per candela = periodo più largo = barre più lunghe.
test('la lunghezza delle barre segue lo zoom, non resta immobile', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // PERIODO CORTO (30 minuti) DI PROPOSITO: la lunghezza ha un tetto massimo
    // (VP_MAX_BAR_PX = 60% della larghezza del riquadro), e con un profilo lungo le barre
    // saturano quel tetto a entrambi gli zoom. La prima versione di questa prova misurava
    // proprio il soffitto - 684 px da una parte e 684 dall'altra - e dava per immobile una
    // lunghezza che invece si muove. Con 30 minuti si resta sotto il tetto e si vede il vero
    // comportamento.
    const largo = await pagina.evaluate(MISURA({tf: 1, candeleAVista: 320, minutiProfilo: 30}));
    const stretto = await pagina.evaluate(MISURA({tf: 1, candeleAVista: 80, minutiProfilo: 30}));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.ok(largo.fasce > 50 && stretto.fasce > 50,
      'il banco non disegna l\'istogramma: ' + largo.fasce + '/' + stretto.fasce);
    assert.ok(stretto.piuLunga > largo.piuLunga,
      'zoomando dentro le barre devono allungarsi: con 320 candele a vista ' + largo.piuLunga
      + ' px, con 80 ' + stretto.piuLunga + ' px. Se sono uguali la lunghezza è stata agganciata'
      + ' al riquadro invece che al periodo, ed è il difetto segnalato il 4 novembre 2026.');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: «Dimensione istogramma» deve continuare a funzionare. Senza questa, la
// lunghezza potrebbe essere bloccata su un numero fisso ignorando la scelta dell'utente.
test('la manopola «Dimensione istogramma» continua a cambiare la larghezza', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const grande = await pagina.evaluate(MISURA({tf: 5}));
    const piccola = await pagina.evaluate(MISURA({tf: 5}).replace('barSizePct:500', 'barSizePct:150'));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.ok(piccola.piuLunga < grande.piuLunga,
      'al 150% le barre devono essere più corte che al 500% (' + piccola.piuLunga + 'px contro '
      + grande.piuLunga + 'px)');
  } finally { await browser.close(); }
});
