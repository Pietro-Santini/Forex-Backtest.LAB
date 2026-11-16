// IL REPLAY CONDIVISO E LE FINESTRE CHE NASCONO DOPO â€” banco di misura (15 novembre 2026, sera).
//
// PAROLE DEL PROPRIETARIO:
// Â«il mirino, la linea che viene creata al momento che si pigia il tasto replay deve risultare su
// tutte le pagine duplicate anche se una pagina duplicata viene creata dopo che e' stato scelto.
// Deve sincronizzarsi con le altre: cioe' se ho aperto una sola pagina duplicata e clicco il
// pulsante replay e mi chiede la scelta se farlo su tutte le finestre, al momento che dico "su
// tutte le finestre", se dopo aggiungo un'altra finestra duplicata quella riprende la scelta che e'
// stata fatta prima... se si vuole modificare si deve uscire dalla modalita' replay e riselezionare
// la scelta. E il puntatore standard di sempre deve sempre seguire tutte le finestre duplicate e
// non limitarsi a 1 e la madre.Â»
//
// I TRE FATTI DA MISURARE, separati:
//   1. la SCELTA (Â«su tutteÂ» / Â«solo questaÂ») viene EREDITATA da una finestra che nasce dopo?
//   2. la LINEA di scelta del punto del replay compare su tutte e tre?
//   3. il MIRINO arriva a tutte e tre?
//
// E LA PROVA DI CONTROLLO, che e' quella che rende il banco un banco: una cosa che deve restare
// indipendente (lo zoom verticale del grafico) NON deve trasmettersi, e con Â«solo questaÂ» la linea
// non deve partire mentre il mirino deve arrivare lo stesso. Senza questi due controlli il banco
// misurerebbe Â«tutto si copiaÂ» e non il mirino.
//
// COME SI MISURA LA LINEA (non come stringa nel sorgente): si traveste il contesto 2D del canvas e
// si contano le pennellate che sono DAVVERO la guida del replay â€” tratto verticale, colore
// #3ea6ff, tratteggio [5,4], spessore 1,5. Nel file c'e' un solo punto che disegna cosi'
// (app.html riga 26067). La prova di controllo di questo strumento sta nella prima prova: senza
// replay la guida deve essere 0 su tutte, e mettendo `liveReplaySelecting` a mano sulla madre deve
// salire SOLO li'.
//
// COME SI MISURA IL MIRINO: `fblMirinoRemoto` (stato leggibile) piu' la conversione
// `fblMirinoSuSchermo()` che dice se quel punto cadrebbe DENTRO la finestra: un mirino registrato
// ma fuori scala non si disegna (trappola gia' pagata) e non va contato come Â«arrivatoÂ».
//
// NON SI MISURA QUI (per non misurare un'altra funzione): l'annuncio dell'asset fra finestre, che
// svuota le candele della finestra nuova. Viene messo da parte su tutte le pagine, come nel banco
// `mirino_fra_finestre`.
//
// ---------------------------------------------------------------------------------------------
// LE PROVE, COSA MISURANO, CHE COLORE CI SI ASPETTA OGGI (DA CONFERMARE in fase 2):
//   1  CONTROLLO scena+strumento  ................. VERDE  (se rosso, il banco non misura)
//   2  FATTO 1 scelta ereditata dalla terza ...... ROSSA  oggi (perTutte/inReplay false)
//   3  FATTO 2 linea del taglio su tutte e tre .... VERDE  oggi (mirino_taglio non filtra)
//   4  FATTO 3 mirino su tutte e tre + zoom no .... VERDE  oggi
//   5  CONTROLLO «solo questa» .................... VERDE  oggi
//   6  AVANZAMENTO 1 play -> la dup avanza? ........ ROSSA  oggi (play locale)
//   7  AVANZAMENTO 2 pausa/stop stesso istante ..... ROSSA  oggi (deriva + stop che salta)
//   8  AVANZAMENTO 3 pausa->play = stesso secondo . ROSSA/VERDE (per finestra funziona; fra finestre no)
//   9  AVANZAMENTO 4 M1 vs M5, stessa porzione .... ROSSA  oggi (nessun trasporto)
//  10  CONTROLLO ASSET (replay_sync non filtra) ... ROSSA  oggi (la finestra GBPUSD entra)
// DURATA stimata: 10 prove x (apertura 3 finestre ~10 s + attese 5-15 s) = circa 4-6 minuti;
// da confermare con la prima esecuzione. Si lancia con:
//   node --test "C:/Users/pietro/AppData/Local/Temp/opencode/banco_replay_finestre.test.mjs"
// ---------------------------------------------------------------------------------------------
//
// CHE COLORE CI SI ASPETTA OGGI (15 novembre 2026, sera) - letto nel sorgente, DA CONFERMARE in
// fase 2 eseguendo il banco:
//   VERDI (funzionano gia'):
//     - CONTROLLO scena, FATTO 2 (la linea del taglio arriva via `mirino_taglio`, che NON filtra
//       `fblReplayPerTutte` del ricevente: app.html 9771-9781), FATTO 3 (il mirino arriva via
//       `fblAnnunciaMirino`, guard `fblMirinoPuoParlare()` senza il filtro della scelta: 11089),
//     - CONTROLLO «solo questa».
//   ROSSE PER COSTRUZIONE (sono il difetto del proprietario; dopo la cura devono diventare verdi):
//     - FATTO 1 (la scelta non e' ereditata: `fblReplayPerTutte` nasce false, 59515; lo scatto
//       `pip_clone_snapshot` 9878 e `trading_sync` 9177 non la portano),
//     - AVANZAMENTO 1/2/3/4 (il play e' locale: `$('play')` 32146; durante l'avanzamento parte
//       solo `chart_time_sync` 32389, che in Live viene IGNORATO da `applyRemoteChartTimeSync`
//       9432 `if(liveModeActive||...)return`),
//     - AVANZAMENTO 2 seconda parte (lo STOP salta all'ultima candela: 59485, e butta il tempo
//       anche a chi non era in replay),
//     - CONTROLLO ASSET (`replay_sync` 59559 non porta nessun `asset` e il ramo 9789 non filtra).
// ---------------------------------------------------------------------------------------------
import test from 'node:test';
import assert from 'node:assert/strict';

const REPO = 'C:/Users/pietro/Documents/GitHub/Forex-Backtest.LAB';
const {apriApp} = await import('file:///' + REPO + '/laboratorio/app/aiuti.mjs');
const PAGINA = 'file://' + REPO + '/app.html';

// La candela su cui si sceglie il punto del replay: tardi nello storico, cosi' dopo il taglio
// restano candele a sufficienza perche' la linea e il mirino cadano DENTRO la parte visibile di
// tutte le finestre (a time frame diverso il taglio lascerebbe una finestra con una candela sola).
const CANDELA_DEL_REPLAY = 550;

function ascoltaErrori(pagina) {
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  return errori;
}

async function nuovaFinestra(contesto, slot) {
  const p = await contesto.newPage();
  const errori = ascoltaErrori(p);
  await p.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.goto(PAGINA + '?pipSlot=' + slot, {waitUntil: 'domcontentloaded'});
  await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
    .forEach(el => el.style.display = 'none'));
  return {p, errori};
}

// IL CAMBIO ASSET FRA FINESTRE SI METTE DA PARTE: in Storico l'annuncio di una finestra fa
// ricaricare l'asset alle altre e nel banco non c'e' niente da ricaricare (candele a zero). Qui si
// misura il replay, non quella funzione.
const NIENTE_CAMBIO_ASSET = `(function(){ try{ applyRemoteAssetSwitch=function(){}; }catch(e){} })()`;

// LO SCENARIO: 600 candele da un minuto, la finestra in Live, lo stesso asset, il time frame che
// si sceglie. `nonToccareReplay` serve alla finestra che nasce DOPO la scelta: se il replay le e'
// stato ereditato, il banco non deve azzerarglielo (altrimenti misurerebbe la propria zavorra).
const SCENA = (asset, tf, opz) => {
  const o = Object.assign({nonToccareReplay: false, zoom: 1, candela: CANDELA_DEL_REPLAY}, opz || {});
  const azzera = o.nonToccareReplay ? ''
    : `liveReplayActive=false; liveReplaySelecting=false; liveReplayGuideClientX=null;`;
  return `(function(){
    const base=Date.parse('2026-11-10T08:00:00Z');
    const R=[];
    for(let i=0;i<600;i++){
      const p=1.0800+i*0.00002;
      R.push({date:new Date(base+i*60000).toISOString().slice(0,16).replace('T',' '),
              open:p, high:p+0.00015, low:p-0.00015, close:p+0.00005, volume:100});
    }
    baseRows=R;
    rowsAssetKey=currentAssetKey=${JSON.stringify(asset)};
    currentTF=${tf};
    liveModeActive=true; mt5Connected=false;
    ${azzera}
    positions.length=0; pendingOrders.length=0; trades.length=0;
    // Se questa finestra e' GIA' in replay (ereditato), il suo punto nel tempo non si tocca: e'
    // proprio quello che si sta misurando. Altrimenti la si mette sullo stesso periodo delle
    // altre, cosi' la linea e il mirino hanno dove cadere e il confronto e' onesto.
    if(!liveReplayActive){ masterTime=closeTimeOf(baseRows[${o.candela}]); }
    rebuildRows();
    followLatest=true; viewEnd=idx; autoFitWidth=true; priceZoomFactor=${o.zoom};
    viewPriceLo=null; viewPriceHi=null;
    draw();
    return {slot:PIP_SLOT, asset:currentAssetKey, tf:currentTF, candele:rows.length, idx:idx,
            live:!!liveModeActive, inReplay:!!liveReplayActive, perTutte:!!fblReplayPerTutte,
            masterTime:masterTime};
  })()`;
};

// LA SCENA VA FATTA TENERE: una finestra appena nata riceve lo "scatto" della madre
// (pip_clone_snapshot), che passa a Live in modo asincrono e puo' rimettere mano a candele e modo
// DOPO la scena. Si riprova, e se non tiene si dice: mai misurare una finestra vuota e chiamarlo
// difetto del mirino (e' la trappola gia' pagata nel banco omonimo).
async function assicuraScena(p, asset, tf, opz) {
  let ultimo = null;
  for (let giro = 1; giro <= 3; giro++) {
    ultimo = await p.evaluate(SCENA(asset, tf, opz));
    await p.waitForTimeout(900);
    const dopo = await p.evaluate(`(function(){
      return {asset:currentAssetKey, candele:rows.length, live:!!liveModeActive};
    })()`);
    if (dopo.asset === asset && dopo.candele > 0 && dopo.live) {
      return Object.assign({}, ultimo, {giri: giro});
    }
  }
  throw new Error('la finestra non tiene la scena dopo tre giri: ' + JSON.stringify(ultimo));
}

// LO STRUMENTO CHE CONTA LA LINEA. Il contesto 2D e' uno solo per tutta la pagina: si traveste
// `stroke()` e si guarda il tratto appena costruito da moveTo/lineTo (verticale e lungo), il
// colore, il tratteggio e lo spessore. Non e' una lettura del sorgente: e' quello che viene
// dipinto sul canvas #chart.
const STRUMENTO = `(function(){
  if(window.__spiaGuida)return;
  window.__spiaGuida=true;
  window.__guida=0; window.__guidaX=[]; window.__seg=null;
  const P=CanvasRenderingContext2D.prototype;
  const m0=P.moveTo, l0=P.lineTo, s0=P.stroke;
  const col=v=>String(v||'').toLowerCase().replace(/\\s+/g,'');
  const eGuida=c=>col(c)==='#3ea6ff'||col(c)==='rgb(62,166,255)';
  P.moveTo=function(x,y){ try{ window.__seg={x:x,y0:y,verticale:false}; }catch(e){}
    return m0.apply(this,arguments); };
  P.lineTo=function(x,y){ try{ const s=window.__seg;
      if(s&&Math.abs(x-s.x)<0.6&&Math.abs(y-s.y0)>100)s.verticale=true; }catch(e){}
    return l0.apply(this,arguments); };
  P.stroke=function(){
    try{
      const s=window.__seg;
      if(this.canvas&&this.canvas.id==='chart'&&s&&s.verticale
         && this.lineWidth===1.5 && eGuida(this.strokeStyle)
         && String(this.getLineDash&&this.getLineDash()).indexOf('5,4')===0){
        window.__guida++; window.__guidaX.push(Math.round(s.x));
      }
    }catch(e){}
    return s0.apply(this,arguments);
  };
})()`;

const AZZERA_STRUMENTO = `(function(){ window.__guida=0; window.__guidaX=[]; })()`;

const MISURA = `(function(){
  let remoto=null, disegnabile=null, guidaRemota=null;
  try{ if(fblMirinoRemoto) remoto={t:fblMirinoRemoto.t, prezzo:fblMirinoRemoto.prezzo,
                                   asset:fblMirinoRemoto.asset}; }catch(e){}
  try{ if(remoto){ const q=fblMirinoSuSchermo(remoto.t,remoto.prezzo);
        disegnabile=q?{dentroX:!!q.dentroX, dentroY:!!q.dentroY, x:Math.round(q.x)}:null; } }catch(e){}
  try{ if(fblGuidaRemota) guidaRemota={t:fblGuidaRemota.t, asset:fblGuidaRemota.asset}; }catch(e){}
  return {slot:PIP_SLOT, asset:currentAssetKey, tf:currentTF, candele:rows.length,
          live:!!liveModeActive, inReplay:!!liveReplayActive, seleziona:!!liveReplaySelecting,
          perTutte:!!fblReplayPerTutte, masterTime:masterTime, zoom:priceZoomFactor,
          guida:(window.__guida||0), guidaX:(window.__guidaX||[]).slice(-4),
          remoto:remoto, disegnabile:disegnabile, guidaRemota:guidaRemota};
})()`;

const STATO_NASCITA = `(function(){ return {slot:PIP_SLOT, asset:currentAssetKey,
  candele:(typeof rows!=='undefined'&&rows)?rows.length:null, live:!!liveModeActive,
  inReplay:!!liveReplayActive, perTutte:!!fblReplayPerTutte,
  masterTime:(typeof masterTime!=='undefined')?masterTime:null}; })()`;

// La domanda del replay risposta dal banco, e contata (una risposta che nessuno ha chiesto non
// vale come Â«la scelta e' stata fattaÂ»).
const RISPOSTA = (si) => `(function(){
  window.__chieste=[];
  appConfirm=function(testo,opz){
    window.__chieste.push({testo:String(testo), titolo:(opz&&opz.title)||''});
    return Promise.resolve(${si ? 'true' : 'false'});
  };
})()`;

// IL GRAFICO VA PORTATO IN VISTA PRIMA DI MUOVERE IL MOUSE: nella pagina sta sotto il bordo della
// finestra e un punto fuori non e' sopra nessun elemento (mouse.move muove il mouse vero).
async function riquadro(pag) {
  await pag.evaluate(() => document.getElementById('chart').scrollIntoView({block:'center'}));
  await pag.waitForTimeout(200);
  const r = await pag.evaluate(() => {
    const b = document.getElementById('chart').getBoundingClientRect();
    const centro = document.elementFromPoint(b.left + b.width/2, b.top + b.height/2);
    return {x:b.left, y:b.top, w:b.width, h:b.height,
            sopra: centro ? (centro.id || centro.tagName) : null};
  });
  if (!r.sopra) throw new Error('il grafico non e in vista: ' + JSON.stringify(r));
  return r;
}

// Muove il mouse dentro il grafico di una finestra e dice quale (orario, prezzo) ha puntato.
async function muovi(pag, fx, fy) {
  const b = await riquadro(pag);
  const cx = b.x + b.w * fx, cy = b.y + b.h * fy;
  await pag.mouse.move(cx, cy);
  await pag.waitForTimeout(160);
  return pag.evaluate(({cx, cy}) => fblMirinoDaSchermo(cx, cy), {cx, cy});
}

// =====================================================================================
// LA SCENA A TRE FINESTRE, con la scelta Â«su tutteÂ» gia' fatta e la terza nata DOPO.
// Restituisce anche lo stato di nascita della terza: e' una misura, non un dettaglio.
// =====================================================================================
async function scenaConReplayCondiviso(risposta, opz) {
  // `tfDue`/`candela`/`assetDue` servono alla seconda parte: time frame diversi e asset diversi.
  const o = Object.assign({tfMadre: 1, tfDue: 15, candela: CANDELA_DEL_REPLAY,
                           assetDue: 'EURUSD'}, opz || {});
  const {browser, pagina: madre, errori} = await apriApp();
  const d2 = await nuovaFinestra(madre.context(), 2);
  await madre.evaluate(NIENTE_CAMBIO_ASSET);
  await d2.p.evaluate(NIENTE_CAMBIO_ASSET);
  const sMadre = await assicuraScena(madre, 'EURUSD', o.tfMadre, {candela: o.candela});
  const sD2 = await assicuraScena(d2.p, o.assetDue, o.tfDue, {candela: o.candela});
  // LO STRUMENTO CHE CONTA LA LINEA SU TUTTE E TRE: senza quello su madre e dup2 le prove che
  // misurano la linea dipinta LA' leggerebbero `window.__guida` = undefined -> 0, cioe' un rosso
  // (o un verde) per lo strumento mancante invece che per il difetto. Installato PRIMA della
  // domanda, cosi' conta anche le linee dipinte durante l avvio del replay.
  await madre.evaluate(STRUMENTO);
  await d2.p.evaluate(STRUMENTO);

  // LA DOMANDA, come la fa il pulsante Â«ReplayÂ» (stessa funzione, riga 59516).
  await madre.evaluate(RISPOSTA(risposta));
  const scelta = await madre.evaluate(`(async function(){
    await fblChiediAmbitoReplay();
    return {chieste:(window.__chieste||[]).length, perTutte:!!fblReplayPerTutte};
  })()`);
  // E il punto scelto (il rilascio del mouse), che fa partire il replay e â€” se la scelta era Â«su
  // tutteÂ» â€” lo annuncia.
  const quando = await madre.evaluate(`(function(){
    const t=closeTimeOf(baseRows[${o.candela}]);
    avviaReplayLive(t);
    return masterTime;
  })()`);
  await d2.p.waitForTimeout(1200);

  // LA TERZA NASCE ADESSO, dopo la scelta: e' il caso del proprietario.
  const d3 = await nuovaFinestra(madre.context(), 3);
  await d3.p.evaluate(NIENTE_CAMBIO_ASSET);
  const nascita = await d3.p.evaluate(STATO_NASCITA);
  const sD3 = await assicuraScena(d3.p, 'EURUSD', 1, {nonToccareReplay: true, candela: o.candela});
  await d3.p.evaluate(STRUMENTO);
  await d3.p.waitForTimeout(1200);

  return {browser, madre, d2p:d2.p, d3p:d3.p, scelta, quando, nascita,
          sMadre, sD2, sD3, errori, errori2:d2.errori, errori3:d3.errori};
}

const M = (pag) => pag.evaluate(MISURA);

// =====================================================================================
// 1. PROVA DI CONTROLLO DEL BANCO: la scena tiene, e lo strumento che conta la linea vede
//    la linea quando c'e' e tace quando non c'e'.
// =====================================================================================
test('CONTROLLO: tre finestre sulla stessa scena, e la linea si conta solo dove e dipinta', async () => {
  const {browser, pagina: madre, errori} = await apriApp();
  const d2 = await nuovaFinestra(madre.context(), 2);
  const d3 = await nuovaFinestra(madre.context(), 3);
  try {
    for (const p of [madre, d2.p, d3.p]) { await p.evaluate(NIENTE_CAMBIO_ASSET); await p.evaluate(STRUMENTO); }
    const a = await assicuraScena(madre, 'EURUSD', 1);
    const b = await assicuraScena(d2.p, 'EURUSD', 15);
    const c = await assicuraScena(d3.p, 'EURUSD', 5);
    console.log('scene:', JSON.stringify([a, b, c]));
    assert.ok(a.candele > 0 && b.candele > 0 && c.candele > 0,
      'tutte e tre devono avere candele: ' + JSON.stringify([a, b, c]));
    assert.deepEqual([a.tf, b.tf, c.tf], [1, 15, 5], 'time frame diversi, come nella richiesta');

    // Senza nessun replay, nessuna guida dipinta da nessuna parte.
    await madre.evaluate(AZZERA_STRUMENTO); await d2.p.evaluate(AZZERA_STRUMENTO);
    await d3.p.evaluate(AZZERA_STRUMENTO);
    await madre.evaluate(() => draw());
    await d2.p.evaluate(() => draw());
    await d3.p.evaluate(() => draw());
    const zero = [await M(madre), await M(d2.p), await M(d3.p)].map(x => x.guida);
    console.log('guida senza replay:', JSON.stringify(zero));
    assert.deepEqual(zero, [0, 0, 0],
      'senza replay la guida non deve essere dipinta da nessuna parte: ' + JSON.stringify(zero));

    // E ora la prova che lo strumento MISURA: la guida accesa a mano sulla madre.
    await madre.evaluate(() => {
      liveReplaySelecting = true;
      const r = document.getElementById('chart').getBoundingClientRect();
      liveReplayGuideClientX = r.left + r.width * 0.5;
      draw();
    });
    const acceso = [await M(madre), await M(d2.p), await M(d3.p)];
    console.log('guida accesa solo sulla madre:', JSON.stringify(
      acceso.map(x => ({slot:x.slot, guida:x.guida, x:x.guidaX}))));
    assert.ok(acceso[0].guida > 0,
      'lo strumento deve vedere la linea dipinta sulla madre (se e 0, il banco non misura '
      + 'niente e ogni rosso successivo sarebbe falso): ' + JSON.stringify(acceso[0]));
    assert.equal(acceso[1].guida, 0, 'e non deve vederla sulla duplicata, che non ha ricevuto niente');
    assert.equal(acceso[2].guida, 0, 'ne sulla terza');
    await madre.evaluate(`(function(){ liveReplaySelecting=false; liveReplayGuideClientX=null; draw(); })()`);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// =====================================================================================
// 2. FATTO 1 â€” LA SCELTA: una finestra nata dopo la scelta la eredita?
// =====================================================================================
test('FATTO 1: la finestra nata DOPO la scelta eredita Â«su tutteÂ» e il replay', async () => {
  const c = await scenaConReplayCondiviso(true);
  try {
    console.log('la domanda:', JSON.stringify(c.scelta), '| punto del replay:', c.quando);
    console.log('nascita della terza:', JSON.stringify(c.nascita));
    const madre = await M(c.madre), due = await M(c.d2p), tre = await M(c.d3p);
    console.log('madre :', JSON.stringify(madre));
    console.log('dup 2 :', JSON.stringify(due));
    console.log('dup 3 :', JSON.stringify({slot:tre.slot, inReplay:tre.inReplay,
      perTutte:tre.perTutte, masterTime:tre.masterTime, candele:tre.candele, asset:tre.asset}));

    assert.equal(c.scelta.chieste, 1, 'la domanda deve essere stata fatta una volta');
    assert.equal(madre.inReplay, true, 'la madre e in replay');
    assert.equal(due.inReplay, true, 'la duplicata gia aperta segue (questo e il caso GIA curato)');
    assert.equal(due.perTutte, true, 'e ne ha ereditato la scelta');

    // QUELLO CHE CHIEDE IL PROPRIETARIO, e che oggi non e' garantito.
    // ATTENZIONE, falso verde possibile: `tre.masterTime` uguale a quello della madre NON prova
    // l'eredita' - la scena della terza (nonToccareReplay) la mette sullo stesso punto per far
    // cadere linea e mirino. Le prove vere sono le due righe sopra: perTutte e inReplay.
    assert.equal(tre.perTutte, true,
      'LA SCELTA DEVE ESSERE EREDITATA da una finestra che nasce dopo: la terza dice '
      + 'perTutte=' + tre.perTutte);
    assert.equal(tre.inReplay, true,
      'E DEVE ESSERE IN REPLAY: il tasto replay su quella finestra deve attivare il replay su '
      + 'tutte, dalla scelta gia fatta. La terza dice inReplay=' + tre.inReplay);
    assert.equal(tre.masterTime, madre.masterTime,
      'dallo stesso punto nel tempo: ' + JSON.stringify({madre:madre.masterTime, tre:tre.masterTime}));
    assert.deepEqual(c.errori, []);
    assert.deepEqual(c.errori2, []);
    assert.deepEqual(c.errori3, []);
  } finally { await c.browser.close(); }
});

// =====================================================================================
// 3. FATTO 2 â€” LA LINEA: compare su tutte e tre, anche su quella nata dopo?
// =====================================================================================
test('FATTO 2: la linea del taglio compare su tutte e tre (anche su quella nata dopo)', async () => {
  const c = await scenaConReplayCondiviso(true);
  try {
    // Â«Nuova posizioneÂ»: la stessa funzione del pulsante mentre il replay e' attivo (riga 59502).
    await c.madre.evaluate(`(function(){ avviaSelezioneReplayLive(); return !!liveReplaySelecting; })()`);
    for (const p of [c.madre, c.d2p, c.d3p]) await p.evaluate(AZZERA_STRUMENTO);
    const b = await riquadro(c.madre);
    for (const fx of [0.42, 0.45, 0.48]) {
      await c.madre.mouse.move(b.x + b.w * fx, b.y + b.h * 0.5);
      await c.madre.waitForTimeout(140);
    }
    await c.d2p.waitForTimeout(400); await c.d3p.waitForTimeout(400);
    const madre = await M(c.madre), due = await M(c.d2p), tre = await M(c.d3p);
    const righe = [madre, due, tre].map(x => ({slot:x.slot, tf:x.tf, guida:x.guida,
      guidaX:x.guidaX, guidaRemota:x.guidaRemota}));
    console.log('linea del taglio:', JSON.stringify(righe));

    assert.ok(madre.guida > 0,
      'la madre dipinge la linea mentre sceglie il punto: ' + JSON.stringify(madre));
    assert.ok(due.guida > 0,
      'e la duplicata gia aperta deve averla (questo e il caso GIA curato): ' + JSON.stringify(due));
    assert.ok(tre.guida > 0,
      'E LA TERZA, nata dopo la scelta, DEVE AVERLA: e la regola del proprietario. '
      + JSON.stringify({guida:tre.guida, remota:tre.guidaRemota, inReplay:tre.inReplay,
                        perTutte:tre.perTutte, asset:tre.asset, candele:tre.candele}));
    assert.ok(tre.guidaRemota, 'la terza deve avere registrata la guida arrivata da fuori');
    assert.equal(tre.guidaRemota.asset, 'EURUSD', 'sullo stesso asset');
    assert.deepEqual(c.errori, []); assert.deepEqual(c.errori2, []); assert.deepEqual(c.errori3, []);
  } finally { await c.browser.close(); }
});

// =====================================================================================
// 4. FATTO 3 â€” IL MIRINO su tutte e tre, e il CONTROLLO che non si copia tutto.
// =====================================================================================
test('FATTO 3: il mirino arriva a tutte e tre, e lo zoom resta indipendente', async () => {
  const c = await scenaConReplayCondiviso(true);
  try {
    // PROVA DI CONTROLLO, prima del gesto: lo zoom verticale della madre e' un fatto SUO.
    await c.madre.evaluate(`(function(){ priceZoomFactor=2.5; draw(); return priceZoomFactor; })()`);
    for (const p of [c.madre, c.d2p, c.d3p]) await p.evaluate(AZZERA_STRUMENTO);

    const puntato = await muovi(c.madre, 0.55, 0.42);
    await c.d2p.waitForTimeout(400); await c.d3p.waitForTimeout(400);
    const madre = await M(c.madre), due = await M(c.d2p), tre = await M(c.d3p);
    console.log('puntato:', JSON.stringify(puntato));
    console.log('mirino madre:', JSON.stringify({remoto:madre.remoto, zoom:madre.zoom, tf:madre.tf}));
    console.log('mirino dup 2:', JSON.stringify({remoto:due.remoto, disegnabile:due.disegnabile,
      zoom:due.zoom, tf:due.tf}));
    console.log('mirino dup 3:', JSON.stringify({remoto:tre.remoto, disegnabile:tre.disegnabile,
      zoom:tre.zoom, tf:tre.tf}));

    assert.ok(puntato && puntato.t && puntato.prezzo,
      'il mouse deve aver puntato un punto vero del grafico: ' + JSON.stringify(puntato));

    // IL MIRINO DEVE ARRIVARE A TUTTE E TRE.
    for (const [nome, w] of [['dup 2', due], ['dup 3', tre]]) {
      assert.ok(w.remoto, 'il mirino deve essere arrivato alla ' + nome + ': ' + JSON.stringify(w));
      assert.equal(w.remoto.asset, 'EURUSD', 'porta l asset, che e la condizione del proprietario');
      assert.ok(Math.abs(w.remoto.prezzo - puntato.prezzo) < 1e-9,
        'lo stesso prezzo, non un x in pixel: ' + JSON.stringify({mandato:puntato.prezzo,
          arrivato:w.remoto.prezzo}));
      // Tolleranza di 1 ms: il valore annunciato viene calcolato dall'evento del mouse, quello
      // atteso e' ricalcolato da questo banco con le coordinate frazionarie passate a
      // `mouse.move` — la differenza e' sub-pixel (misurata: 0,05 ms). Un confronto esatto
      // fra due float misurerebbe il banco, non l'app.
      assert.ok(Math.abs(w.remoto.t - puntato.t) <= 1, 'e lo stesso istante (tolleranza 1 ms)');
      assert.ok(w.disegnabile && w.disegnabile.dentroX,
        'e deve cadere DENTRO la finestra, altrimenti non si disegna: ' + JSON.stringify(w.disegnabile));
    }

    // E IL CONTROLLO: lo zoom della madre non e' viaggiato, e i time frame sono rimasti i suoi.
    assert.equal(due.zoom, 1, 'lo zoom verticale NON si trasmette: ' + JSON.stringify({zoom:due.zoom}));
    assert.equal(tre.zoom, 1, 'nemmeno alla terza: ' + JSON.stringify({zoom:tre.zoom}));
    assert.deepEqual([madre.tf, due.tf, tre.tf], [1, 15, 1],
      'i time frame restano indipendenti: ' + JSON.stringify([madre.tf, due.tf, tre.tf]));
    assert.deepEqual(c.errori, []); assert.deepEqual(c.errori2, []); assert.deepEqual(c.errori3, []);
  } finally { await c.browser.close(); }
});

// =====================================================================================
// 5. LA PROVA DI CONTROLLO DEL VERSO OPPOSTO: con Â«solo questaÂ» non si eredita niente e la
//    linea non parte â€” ma il mirino deve arrivare lo stesso. Se questo test diventasse rosso
//    sul mirino, una cura avrebbe fatto viaggiare TUTTO, che non e cio' che e stato chiesto.
// =====================================================================================
test('CONTROLLO Â«solo questaÂ»: la linea non parte, il mirino si', async () => {
  const c = await scenaConReplayCondiviso(false);
  try {
    await c.madre.evaluate(`(function(){ avviaSelezioneReplayLive(); })()`);
    for (const p of [c.madre, c.d2p, c.d3p]) await p.evaluate(AZZERA_STRUMENTO);
    const b = await riquadro(c.madre);
    for (const fx of [0.42, 0.45, 0.48]) {
      await c.madre.mouse.move(b.x + b.w * fx, b.y + b.h * 0.5);
      await c.madre.waitForTimeout(140);
    }
    await c.d2p.waitForTimeout(400); await c.d3p.waitForTimeout(400);
    const madre = await M(c.madre), due = await M(c.d2p), tre = await M(c.d3p);
    console.log('solo questa ->', JSON.stringify([madre, due, tre].map(x =>
      ({slot:x.slot, inReplay:x.inReplay, perTutte:x.perTutte, guida:x.guida,
        remoto:!!x.remoto}))));

    assert.equal(madre.inReplay, true, 'la madre entra comunque in replay');
    assert.equal(due.inReplay, false, 'la duplicata no: e stato detto Â«solo questaÂ»');
    assert.equal(tre.inReplay, false, 'e nemmeno la terza');
    assert.ok(madre.guida > 0, 'la madre dipinge la sua linea');
    assert.equal(due.guida, 0, 'ma la linea non deve partire verso le altre');
    assert.equal(tre.guida, 0, 'nemmeno verso quella nata dopo');
    // IL MIRINO INVECE VIAGGIA SEMPRE: non dipende dalla scelta del replay.
    assert.ok(due.remoto, 'il mirino deve arrivare alla duplicata anche con Â«solo questaÂ»');
    assert.ok(tre.remoto, 'e alla terza');
    assert.deepEqual(c.errori, []); assert.deepEqual(c.errori2, []); assert.deepEqual(c.errori3, []);
  } finally { await c.browser.close(); }
});

// =====================================================================================
// SECONDA PARTE â€” L'AVANZAMENTO: PLAY, PAUSA, STOP, E I TIME FRAME DIVERSI.
//
// PAROLE DEL PROPRIETARIO (15 novembre 2026):
// Â«quando pigio il pulsante play deve avanzare anche su tutte le pagine duplicate, non solo su una
// pagina, e deve avvenire in modo all'unisono preciso e coordinato, tenendo anche conto la
// differenza dei time frame tra pagine duplicate. Mi raccomando anche la perfezione del tasto stop:
// ferma su tutte le pagine duplicate allo stesso tempo e allo stesso prezzo, senza sfalsi. E che
// poi, quando ripremo il tasto play, rifa ripartire in maniera precisa lo scorrimento delle
// candele e il loro aggiornamento al secondo, tenendo in considerazione il moltiplicatore.Â»
//
// COME SI MISURA L'ISTANTE (non a occhio, e non come stringa nel sorgente): `replayMomentoMostrato()`
// (app.html 28425) e' l'unico lettore dell'istante mostrato e lo restituisce in MILLISECONDI. Da li'
// si ricava anche la finestra di tempo che quella pagina sta mostrando (inizio del bucket + durata
// del time frame), che e' quello che serve per il confronto M1 / M5.
//
// L'ISTANTE DI OGNI FINESTRA E' UN SUO `masterTime`: nessuna delle due parti in gioco lo condivide
// oggi per il replay. Il banco lo legge dalla pagina, non lo deduce.
// =====================================================================================

// Lo stato del tempo di una finestra, tutto ricavato dallo stato della pagina (nessun pixel, nessuna
// stringa di sorgente).
const MOMENTO = `(function(){
  let m=null; try{ m=replayMomentoMostrato(); }catch(e){}
  let form=null; try{ if(replayForm)form={idx:replayForm.idx, sub:Number(replayForm.sub)||0}; }catch(e){}
  let perBar=null; try{ perBar=replaySecondsPerBar(); }catch(e){}
  let vel=null; try{ vel=num($('speed').value)||1; }catch(e){}
  let mt=null; try{ mt=(Number.isFinite(masterTime)?masterTime:null); }catch(e){}
  const i=(form&&Number.isFinite(form.idx))?form.idx:idx;
  const r=rows[i]||null;
  // La porzione di tempo MOSTRATA: l'inizio del bucket della candela mostrata e la sua durata.
  // (bucketKeyOf restituisce l'INIZIO del bucket in ms: app.html 13047.)
  let inizio=null, fine=null;
  try{
    if(r){ const tc=closeTimeOf(r);
      if(Number.isFinite(tc)){ inizio=bucketKeyOf(tc,currentTF); fine=inizio+currentTF*60000; } }
  }catch(e){}
  return {slot:PIP_SLOT, asset:currentAssetKey, tf:currentTF, inReplay:!!liveReplayActive,
          inCorso:!!timer, momento:(m===null?null:m), masterTime:mt,
          idx:idx, iMostrata:i, candela:(r?r.date:null), inizio:inizio, fine:fine,
          formazione:form, perBar:perBar, velocita:vel,
          contiene:(m!==null&&inizio!==null&&fine!==null)?(m>=inizio&&m<fine):null};
})()`;
const L = (pag) => pag.evaluate(MOMENTO);

// LA SPIA DEL CANALE: che cosa esce DAVVERO dalla finestra mentre il replay avanza. Serve a
// rispondere alla domanda Â«play/pausa/stop sono trasmessi? con quale messaggio?Â» con i messaggi
// contati, non con un'ipotesi. E' anche la prova di controllo dello strumento: allo STOP un
// `replay_sync` deve comparire, altrimenti la spia non sta guardando il canale giusto.
const SPIA_CANALE = `(function(){
  window.__inviati=[];
  if(!tradingChannel)return 'nessun canale';
  if(window.__spiaCanale)return 'gia istallata';
  window.__spiaCanale=true;
  const p0=tradingChannel.postMessage.bind(tradingChannel);
  tradingChannel.postMessage=function(m){
    try{ window.__inviati.push({type:(m&&m.type)||'?', attivo:(m&&m.attivo),
      t:(m&&m.t), asset:(m&&m.asset), storico:(m&&m.storico)}); }catch(e){}
    return p0(m);
  };
  return 'ok';
})()`;
const MESSAGGI = `(function(){ return (window.__inviati||[]).slice(); })()`;

async function premiPlay(p, nota, velocita) {
  const r = await p.evaluate(({velocita}) => {
    const out = {};
    try {
      if (velocita && $('speed')) $('speed').value = String(velocita);
      out.velocita = velocita || null;
      out.primaInCorso = !!timer;
      out.primaIdx = idx;
      out.righe = rows.length;
      $('play').click();
      out.dopoInCorso = !!timer;
      out.testo = $('play').textContent;
    } catch (e) { out.errore = String(e).slice(0, 200); }
    return out;
  }, {velocita});
  console.log('PLAY (' + nota + '):', JSON.stringify(r));
  return r;
}

// IL TASTO STOP DEL REPLAY (app.html 4627, gestore 59520 -> esciReplayLive 59474).
async function premiStop(p, nota) {
  const r = await p.evaluate(() => {
    const out = {};
    try {
      const b = $('liveReplayStopBtn');
      out.trovato = !!b;
      out.visibile = !!(b && b.style.display !== 'none');
      if (b) b.click(); else $('liveReplayStopBtn').click();
      out.dopoInReplay = !!liveReplayActive;
      out.dopoInCorso = !!timer;
      out.masterTime = (typeof masterTime === 'number' && Number.isFinite(masterTime)) ? masterTime : null;
      out.stato = (($('status') || {}).textContent || '').slice(0, 90);
    } catch (e) { out.errore = String(e).slice(0, 200); }
    return out;
  });
  console.log('STOP (' + nota + '):', JSON.stringify(r));
  return r;
}

const secondi = (ms) => (ms === null || ms === undefined || !Number.isFinite(ms))
  ? null : Math.round(ms / 100) / 10;

// =====================================================================================
// 6. FATTO NUOVO 1 â€” PLAY SULLA MADRE: la duplicata avanza? e sul canale esce qualcosa che
//    dica Â«sto andandoÂ»?
// =====================================================================================
test('AVANZAMENTO 1: premendo PLAY sulla madre, la duplicata avanza insieme?', async () => {
  const c = await scenaConReplayCondiviso(true);
  try {
    console.log('spia canale:', await c.madre.evaluate(SPIA_CANALE));
    const inizioM = await L(c.madre), inizioD = await L(c.d2p);
    const clic = await premiPlay(c.madre, 'madre, 30x', 30);
    await c.madre.waitForTimeout(3000);
    const dopoM = await L(c.madre), dopoD = await L(c.d2p);
    const inviati = await c.madre.evaluate(MESSAGGI);

    const avanzM = (dopoM.momento !== null && inizioM.momento !== null)
      ? dopoM.momento - inizioM.momento : null;
    const avanzD = (dopoD.momento !== null && inizioD.momento !== null)
      ? dopoD.momento - inizioD.momento : null;
    const sfasamento = (dopoM.momento !== null && dopoD.momento !== null)
      ? dopoM.momento - dopoD.momento : null;
    const diReplay = inviati.filter(m => m.type === 'replay_sync');

    console.log('madre  prima:', JSON.stringify(inizioM));
    console.log('madre  dopo :', JSON.stringify({momento:dopoM.momento, idx:dopoM.idx,
      formazione:dopoM.formazione, velocita:dopoM.velocita, inCorso:dopoM.inCorso}));
    console.log('dup 2  prima:', JSON.stringify(inizioD));
    console.log('dup 2  dopo :', JSON.stringify({momento:dopoD.momento, idx:dopoD.idx,
      formazione:dopoD.formazione, inCorso:dopoD.inCorso, inReplay:dopoD.inReplay}));
    console.log('AVANZATO in 3 s: madre', secondi(avanzM), 's | duplicata', secondi(avanzD),
      's | sfasamento', secondi(sfasamento), 's');
    console.log('messaggi usciti dalla madre durante il play:', JSON.stringify(inviati));

    // CONTROLLO DELLO STRUMENTO: la madre col moltiplicatore 30x e il suo orologio avanza davvero.
    // Se questo e' rosso, il banco non sta misurando il play e tutto il resto sarebbe falso.
    assert.ok(avanzM !== null && avanzM > 30000,
      'la madre a 30x in 3 secondi deve avanzare di ~90 s di mercato (controllo del banco): '
      + JSON.stringify({avanzato:secondi(avanzM), clic}));

    // QUELLO CHE CHIEDE IL PROPRIETARIO.
    assert.ok(avanzD !== null && avanzD > 30000,
      'LA DUPLICATA DEVE AVANZARE INSIEME ALLA MADRE: e avanzata di '
      + secondi(avanzD) + ' s contro i ' + secondi(avanzM) + ' s della madre '
      + '(sfasamento ' + secondi(sfasamento) + ' s). Oggi il play e un fatto locale: '
      + 'l\'orologio e `replayMsAccum`/`timer` di ciascuna finestra (app.html 32169, 32205).');

    assert.ok(diReplay.length > 0,
      'durante il play deve uscire dal canale un messaggio che dica Â«sto avanzandoÂ»: di '
      + '`replay_sync` ne sono usciti 0. Sono usciti soltanto: '
      + JSON.stringify(inviati.map(m => m.type)));
    assert.deepEqual(c.errori, []); assert.deepEqual(c.errori2, []); assert.deepEqual(c.errori3, []);
  } finally { await c.browser.close(); }
});

// =====================================================================================
// 7. FATTO NUOVO 2 â€” PAUSA E STOP: chi conserva l'istante, e chi lo porta alle altre.
//    Sono due cose diverse e oggi il codice le fa al contrario l'una dell'altra.
// =====================================================================================
test('AVANZAMENTO 2: la pausa conserva l istante ma non viaggia, lo STOP viaggia ma non lo conserva',
  async () => {
    const c = await scenaConReplayCondiviso(true);
    try {
      console.log('spia canale:', await c.madre.evaluate(SPIA_CANALE));
      await premiPlay(c.madre, 'madre, 30x', 30);
      await c.madre.waitForTimeout(1200);

      // --- LA PAUSA (#play, riga 32148): clearInterval + draw, senza toccare l'istante.
      await c.madre.evaluate(SPIA_CANALE);
      const m0 = await L(c.madre), d0 = await L(c.d2p);
      await premiPlay(c.madre, 'madre: pausa', null);
      await c.madre.waitForTimeout(500);
      const m1 = await L(c.madre), d1 = await L(c.d2p);
      await c.madre.waitForTimeout(400);
      const m2 = await L(c.madre), d2 = await L(c.d2p);
      const inviatiPausa = (await c.madre.evaluate(MESSAGGI)).filter(m => m.type === 'replay_sync');

      console.log('PAUSA madre:', JSON.stringify({prima:m0.momento, dopo:m1.momento,
        dopo400:m2.momento, inCorso:m1.inCorso, formazione:m1.formazione}));
      console.log('PAUSA dup 2:', JSON.stringify({prima:d0.momento, dopo:d1.momento,
        dopo400:d2.momento, inCorso:d1.inCorso}));
      console.log('PAUSA: il fermo e stabile? madre', (m2.momento - m1.momento), 'ms | dup',
        (d2.momento - d1.momento), 'ms | replay_sync usciti:', inviatiPausa.length);
      console.log('PAUSA: sfasamento fra le due finestre', secondi(m1.momento - d1.momento), 's');

      // CONTROLLO: la pausa ferma davvero, e conserva il punto (non torna indietro).
      assert.equal(m1.inCorso, false, 'dopo la pausa il battito della madre deve essere spento');
      assert.equal(m2.momento - m1.momento, 0,
        'e l istante non deve muoversi di un millisecondo: '
        + JSON.stringify({a:m1.momento, b:m2.momento}));

      // QUELLO CHE CHIEDE IL PROPRIETARIO: ferme tutte sullo stesso istante.
      assert.ok(Math.abs(m1.momento - d1.momento) <= 1000,
        'ALLA PAUSA LE DUE FINESTRE DEVONO STARE SULLO STESSO ISTANTE: distano '
        + secondi(m1.momento - d1.momento) + ' s (madre ' + new Date(m1.momento).toISOString()
        + ' contro duplicata '
        + (d1.momento === null ? 'fuori replay' : new Date(d1.momento).toISOString()) + ')');

      // --- LO STOP VERO (liveReplayStopBtn -> esciReplayLive, riga 59474).
      await premiPlay(c.madre, 'madre: riprendi prima dello STOP', null);
      await c.madre.waitForTimeout(800);
      const primaStopM = await L(c.madre), primaStopD = await L(c.d2p);
      const primaStopD3 = await L(c.d3p);
      const stop = await premiStop(c.madre, 'madre');
      await c.madre.waitForTimeout(600);
      const dopoStopM = await L(c.madre), dopoStopD = await L(c.d2p);
      const dopoStopD3 = await L(c.d3p);
      const inviatiStop = (await c.madre.evaluate(MESSAGGI)).filter(m => m.type === 'replay_sync');

      const persoM = (primaStopM.momento !== null && dopoStopM.masterTime !== null)
        ? dopoStopM.masterTime - primaStopM.momento : null;
      console.log('STOP: istante mostrato prima del clic madre',
        primaStopM.momento === null ? null : new Date(primaStopM.momento).toISOString(),
        '| dopo lo STOP masterTime =',
        dopoStopM.masterTime === null ? null : new Date(dopoStopM.masterTime).toISOString(),
        '| distanza', secondi(persoM), 's');
      console.log('STOP: madre', JSON.stringify({inReplay:dopoStopM.inReplay,
        inCorso:dopoStopM.inCorso, momento:dopoStopM.momento, masterTime:dopoStopM.masterTime,
        idx:dopoStopM.idx, candele:dopoStopM.iMostrata}));
      console.log('STOP: dup 2', JSON.stringify({inReplay:dopoStopD.inReplay,
        momento:dopoStopD.momento, masterTime:dopoStopD.masterTime, idx:dopoStopD.idx}));
      console.log('STOP: dup 3', JSON.stringify({inReplay:dopoStopD3.inReplay,
        momento:dopoStopD3.momento, masterTime:dopoStopD3.masterTime, idx:dopoStopD3.idx}));
      console.log('STOP: replay_sync usciti:', JSON.stringify(inviatiStop));

      // CONTROLLO DELLO STRUMENTO: lo STOP e l'unico momento in cui oggi il canale parla di replay.
      assert.ok(inviatiStop.length > 0,
        'lo STOP deve uscire sul canale con un replay_sync: se qui e 0 la spia non guarda il '
        + 'canale giusto e il rosso qui sotto non varrebbe niente: ' + JSON.stringify(stop));

      // QUELLO CHE CHIEDE IL PROPRIETARIO: ferme tutte allo stesso istante, e quell'istante e
      // quello del clic, non la fine del dato.
      assert.ok(persoM !== null && Math.abs(persoM) <= 1000,
        'LO STOP DEVE FERMARE DOVE SI E, non saltare all ultima candela: dopo il clic la '
        + 'finestra e a ' + secondi(persoM) + ' s di distanza dall istante che stava mostrando. '
        + 'esciReplayLive (59478) fa `masterTime=closeTimeOf(baseRows[ultima])`.');
      assert.ok(dopoStopM.momento !== null && dopoStopD.momento !== null
        && Math.abs(dopoStopM.momento - dopoStopD.momento) <= 1000,
        'e le due finestre devono restare sullo stesso istante anche dopo lo STOP: '
        + JSON.stringify({madre:dopoStopM.momento, duplicata:dopoStopD.momento}));
      // LA TERZA FINESTRA, che oggi NON entra in replay con loro (e' il difetto della prova 1).
      // Qui si misura un secondo effetto: lo STOP «su tutte» non deve spostare il tempo di una
      // finestra che non sta rivedendo niente. Oggi `replay_sync` (59478? no: 9789) non filtra e
      // `esciReplayLive` le porta via `masterTime` all'ultima candela (59485).
      assert.equal(dopoStopD3.masterTime, primaStopD3.masterTime,
        'LO STOP DI UN REPLAY A CUI QUESTA FINESTRA NON PARTECIPA NON DEVE SPOSTARLE IL TEMPO: '
        + 'prima ' + new Date(primaStopD3.masterTime).toISOString() + ', dopo '
        + (dopoStopD3.masterTime === null ? 'null' : new Date(dopoStopD3.masterTime).toISOString())
        + '. Il ramo replay_sync (9789) non guarda l asset e non guarda chi era in replay.');
      assert.deepEqual(c.errori, []); assert.deepEqual(c.errori2, []); assert.deepEqual(c.errori3, []);
    } finally { await c.browser.close(); }
  });

// =====================================================================================
// 8. FATTO NUOVO 3 â€” PAUSA E POI PLAY: riparte da dove si era fermata, o da capo?
//    Misurato per finestra (dove oggi funziona) e poi fra le finestre (dove non c'e' nessuno
//    che riparta, perche' il play non e' mai stato trasmesso).
// =====================================================================================
test('AVANZAMENTO 3: dopo la pausa il play riprende dallo stesso secondo, non dall inizio',
  async () => {
    const c = await scenaConReplayCondiviso(true);
    try {
      await premiPlay(c.madre, 'madre, 30x', 30);
      await c.madre.waitForTimeout(1000);
      const a = await L(c.madre);
      await premiPlay(c.madre, 'madre: pausa', null);
      await c.madre.waitForTimeout(500);
      const p = await L(c.madre), pd = await L(c.d2p);
      await premiPlay(c.madre, 'madre: riprende', null);
      await c.madre.waitForTimeout(500);
      const r = await L(c.madre), rd = await L(c.d2p);
      // IL MOLTIPLICATORE ALLA RIPRESA (parole del proprietario: «rifa ripartire in maniera precisa
      // lo scorrimento delle candele e il loro aggiornamento al secondo, tenendo in considerazione
      // il moltiplicatore»): a 30x, due secondi veri devono essere circa 60 s di mercato.
      await c.madre.waitForTimeout(2000);
      const ritmo = await L(c.madre);
      const passati = (ritmo.momento !== null && r.momento !== null) ? ritmo.momento - r.momento : null;
      console.log('RITMO dopo la ripresa:', secondi(passati),
        's di mercato in 2 s (a 30x attesi ~60)');
      assert.ok(passati !== null && passati >= 45000 && passati <= 90000,
        'dopo la ripresa il ritmo deve essere quello del moltiplicatore (30x): ' + secondi(passati)
        + ' s in 2 s. replayElapsedMs (32197) misura l orologio, replayMultSel (32179) il selettore.');

      const saltoRipresa = (p.momento !== null && r.momento !== null) ? r.momento - p.momento : null;
      const saltoDup = (p.momento !== null) ? (r.momento - p.formazione?.idx * 0) : null;
      console.log('PRIMA della pausa :', a.momento === null ? null : new Date(a.momento).toISOString(),
        '| formazione', JSON.stringify(a.formazione));
      console.log('in pausa          :', p.momento === null ? null : new Date(p.momento).toISOString(),
        '| formazione', JSON.stringify(p.formazione));
      console.log('dopo il nuovo PLAY:', r.momento === null ? null : new Date(r.momento).toISOString(),
        '| formazione', JSON.stringify(r.formazione));
      console.log('RIPRESA: la madre e ripartita da dove era? salto =', secondi(saltoRipresa),
        's (se fosse Â«da capoÂ» sarebbe di circa -',
        secondi(p.momento === null ? null : p.momento - (p.momento - 1000 * ((p.idx || 0) + 1))), '... )');
      console.log('RIPRESA dup 2: da', pd.momento === null ? null : new Date(pd.momento).toISOString(),
        'a', rd.momento === null ? null : new Date(rd.momento).toISOString(),
        '| salto', secondi(rd.momento === null || pd.momento === null ? null
          : rd.momento - pd.momento), 's');

      // CONTROLLO (per finestra): la ripresa non torna indietro e non riparte da capo.
      assert.ok(saltoRipresa !== null && saltoRipresa >= 0 && saltoRipresa < 20000,
        'la madre deve riprendere dallo stesso secondo in cui si era fermata: salto = '
        + secondi(saltoRipresa) + ' s. startPlayInterval (32207) conserva `replayForm`.');
      // La formazione e' un oggetto {idx, sub}. Il confronto giusto e' quello per campi: idx uguale
      // (stessa candela) e sub dentro il minuto (lo stesso secondo di partenza, arrotondato al
      // centesimo). deepEqual fra un oggetto e una STRINGA non passerebbe con nessuna cura.
      assert.ok(r.formazione && p.formazione && r.formazione.idx === p.formazione.idx,
        'deve riprendere dalla STESSA CANDELA in cui si era fermata: '
        + JSON.stringify({inPausa:p.formazione, dopoPlay:r.formazione}));
      assert.ok(r.formazione && p.formazione && r.formazione.sub >= p.formazione.sub
        && r.formazione.sub < p.formazione.sub + 60000,
        'e dallo stesso secondo di partenza (il replay riprende, non ricomincia): '
        + JSON.stringify({inPausa:p.formazione, dopoPlay:r.formazione}));

      // QUELLO CHE CHIEDE IL PROPRIETARIO: anche la duplicata riparte, dallo stesso punto.
      // La soglia misurata, non scelta a occhio: il play gira a moltiplicatore 30x per 500 ms,
      // cioe' circa 15 s di mercato. Chiedere 20 s era impossibile per costruzione.
      assert.ok(rd.momento !== null && pd.momento !== null && (rd.momento - pd.momento) > 10000,
        'E LA DUPLICATA DEVE RIPARTIRE CON LEI: e avanzata di '
        + secondi(rd.momento === null || pd.momento === null ? null : rd.momento - pd.momento)
        + ' s dopo il nuovo PLAY (madre ' + secondi(saltoRipresa) + ' s). Nessuna finestra riceve '
        + 'il play: `$(\'play\')` (32146) agisce solo in locale.');

      // E DOPO LO STOP VERO il punto scelto e ancora li?
      await premiStop(c.madre, 'madre: stop definitivo');
      await c.madre.waitForTimeout(400);
      const dopoStop = await L(c.madre);
      const ripreso = await premiPlay(c.madre, 'madre: play DOPO lo stop');
      await c.madre.waitForTimeout(600);
      const dopoTutto = await L(c.madre);
      console.log('DOPO LO STOP, il play fa ripartire?', JSON.stringify({clic:ripreso,
        inReplay:dopoTutto.inReplay, inCorso:dopoTutto.inCorso, momento:dopoTutto.momento,
        idx:dopoTutto.idx, candele:dopoTutto.iMostrata}));
      assert.ok(dopoTutto.inCorso === true && dopoTutto.momento !== null,
        'DOPO LO STOP IL PLAY DEVE RIPARTIRE dallo stesso punto: oggi lo STOP esce dal replay e '
        + 'porta `masterTime` all ultima candela (59478), quindi il tasto PLAY non trova piu '
        + 'niente da riprendere (il guard `if(idx>=rows.length-1)return` a 32149) e non parte: '
        + JSON.stringify({inReplay:dopoTutto.inReplay, inCorso:dopoTutto.inCorso,
          momento:dopoTutto.momento}));
      assert.deepEqual(c.errori, []); assert.deepEqual(c.errori2, []); assert.deepEqual(c.errori3, []);
    } finally { await c.browser.close(); }
  });

// =====================================================================================
// 9. FATTO NUOVO 4 â€” TIME FRAME DIVERSI: allo stesso istante, la M5 deve mostrare la candela che
//    contiene quell'istante. E la funzione che SA farlo (masterTime + rebuildRows) esiste gia':
//    la si misura da sola, cosi' il rosso dice Â«manca il trasportoÂ», non Â«manca il calcoloÂ».
// =====================================================================================
test('AVANZAMENTO 4: madre su M1 e duplicata su M5 â€” stessa porzione di tempo allo stesso istante',
  async () => {
    // Candela 549 (e non 550) perche' il suo istante cade a 4/5 del bucket da 5 minuti: cosi' un
    // avanzamento di due minuti esce dal bucket e la differenza si vede, invece di restare
    // nascosta dentro la stessa candela.
    const c = await scenaConReplayCondiviso(true, {candela: 549, tfDue: 5});
    try {
      const aM = await L(c.madre), aD = await L(c.d2p);
      console.log('inizio: madre', JSON.stringify({tf:aM.tf, momento:aM.momento, idx:aM.idx}));
      console.log('inizio: dup 2', JSON.stringify({tf:aD.tf, momento:aD.momento, idx:aD.idx,
        inizio:aD.inizio, fine:aD.fine, contiene:aD.contiene}));
      await premiPlay(c.madre, 'madre M1, 30x', 30);
      await c.madre.waitForTimeout(4000);
      const m = await L(c.madre), d = await L(c.d2p);

      console.log('dopo 4 s: madre M1 momento',
        m.momento === null ? null : new Date(m.momento).toISOString(),
        '| idx', m.idx, '| formazione', JSON.stringify(m.formazione));
      console.log('dopo 4 s: dup M5 momento',
        d.momento === null ? null : new Date(d.momento).toISOString(),
        '| candela mostrata da', d.inizio === null ? null : new Date(d.inizio).toISOString(),
        'a', d.fine === null ? null : new Date(d.fine).toISOString(),
        '| contiene l istante della madre?', d.contiene);
      console.log('TIME FRAME: sfasamento', secondi(m.momento - d.momento), 's');

      // CONTROLLO POSITIVO DELLA FUNZIONE DA RIUSARE: se le si passa l'istante giusto, la finestra
      // M5 si mette sulla candela che lo contiene. Il calcolo quindi c'e' (avviaReplayLive 59459 ->
      // rebuildRows 13142); quello che non c'e' e' chi lo trasporta durante l'avanzamento.
      const prova = await c.d2p.evaluate(({t}) => {
        // propaga:false: questo e' un controllo del calcolo, non un secondo avvio da annunciare.
        avviaReplayLive(t, {propaga:false});
        let mm = null; try { mm = replayMomentoMostrato(); } catch (e) {}
        return {momento:mm, tf:currentTF, idx:idx};
      }, {t: m.momento});
      const provaDopo = await L(c.d2p);
      console.log('CONTROLLO: dup M5 con l istante della madre imposto a mano:', JSON.stringify({
        ...prova, inizio: provaDopo.inizio, fine: provaDopo.fine, contiene: provaDopo.contiene}));
      assert.equal(provaDopo.contiene, true,
        'la funzione che porta un istante su un altro time frame deve funzionare (masterTime + '
        + 'rebuildRows): se questo e rosso, il banco sta misurando la funzione sbagliata: '
        + JSON.stringify({madre:m.momento, dup:provaDopo}));

      // TORNANDO ALLA MISURA: senza il trasporto, la M5 e rimasta indietro.
      assert.equal(d.contiene, true,
        'ALLO STESSO ISTANTE LA FINESTRA M5 DEVE MOSTRARE LA CANDELA CHE CONTIENE QUELL ISTANTE: '
        + 'l istante della madre (' + (m.momento === null ? 'null' : new Date(m.momento).toISOString())
        + ') cade FUORI dalla candela che la duplicata sta mostrando ('
        + (d.inizio === null ? '?' : new Date(d.inizio).toISOString()) + ' - '
        + (d.fine === null ? '?' : new Date(d.fine).toISOString()) + '), indietro di '
        + secondi(m.momento - d.momento) + ' s.');
      assert.deepEqual(c.errori, []); assert.deepEqual(c.errori2, []); assert.deepEqual(c.errori3, []);
    } finally { await c.browser.close(); }
  });

// =====================================================================================
// 10. PROVA DI CONTROLLO DEL VERSO OPPOSTO â€” due finestre su ASSET DIVERSI.
//     COSA DICE IL PROGETTO: il tempo del replay e per asset. La regola e' scritta in
//     `anotherWindowOwnsAssetEvaluation()` (app.html 9493): per un dato asset conta una finestra
//     sola, quella con lo slot piu' basso, e le altre non lo valutano. `replay_sync` (59452) pero'
//     non porta nessun campo `asset`, e il ramo che lo riceve (9789) non guarda che asset ha.
//     Quindi la misura e': il replay di EURUSD porta via il tempo a una finestra su GBPUSD?
// =====================================================================================
test('CONTROLLO ASSET: il replay di un asset non deve portare il tempo a una finestra su un altro',
  async () => {
    const c = await scenaConReplayCondiviso(true, {assetDue: 'GBPUSD'});
    try {
      await c.madre.evaluate(SPIA_CANALE);
      await premiPlay(c.madre, 'madre EURUSD, 30x', 30);
      await c.madre.waitForTimeout(2000);
      const m = await L(c.madre), d = await L(c.d2p);
      const regola = await c.d2p.evaluate(() => ({
        mioAsset: currentAssetKey,
        eurPossedutoDaAltri: anotherWindowOwnsAssetEvaluation('EURUSD'),
        gbpPossedutoDaAltri: anotherWindowOwnsAssetEvaluation('GBPUSD'),
        elenco: Object.assign({}, siblingAssetBySlot)
      }));
      const sorti = (await c.madre.evaluate(MESSAGGI)).filter(x => x.type === 'replay_sync');
      console.log('madre EURUSD:', JSON.stringify({asset:m.asset, momento:m.momento, idx:m.idx,
        inReplay:m.inReplay, inCorso:m.inCorso}));
      console.log('dup GBPUSD  :', JSON.stringify({asset:d.asset, momento:d.momento, idx:d.idx,
        inReplay:d.inReplay, inCorso:d.inCorso}));
      console.log('la regola del progetto vista dalla duplicata:', JSON.stringify(regola));
      console.log('replay_sync usciti dalla madre (con quale asset?):', JSON.stringify(sorti));

      // CONTROLLO: la regola che il progetto ha gia' scritto e' vera in questa scena, altrimenti il
      // confronto qui sotto non direbbe niente.
      assert.equal(regola.eurPossedutoDaAltri, true,
        'EURUSD deve risultare posseduto da un altra finestra (slot piu basso): '
        + JSON.stringify(regola));

      // LA MISURA: quella finestra non deve essere trascinata nel tempo di EURUSD.
      assert.equal(d.inReplay, false,
        'IL REPLAY DI EURUSD NON DEVE PORTARE IL TEMPO A UNA FINESTRA SU GBPUSD: la duplicata e '
        + 'entrata in replay sull istante di EURUSD ('
        + (d.momento === null ? 'null' : new Date(d.momento).toISOString())
        + ') pur essendo su ' + d.asset + '. `replay_sync` (59452) manda slot/attivo/t e nessun '
        + 'asset; il ramo 9789 non filtra: ' + JSON.stringify(sorti));
      assert.deepEqual(c.errori, []); assert.deepEqual(c.errori2, []); assert.deepEqual(c.errori3, []);
    } finally { await c.browser.close(); }
  });
