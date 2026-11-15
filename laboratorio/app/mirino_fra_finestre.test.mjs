// IL MIRINO SI TRASPORTA SULLE ALTRE FINESTRE DELLO STESSO ASSET, ANCHE A TIME FRAME DIVERSO.
//
// RICHIESTO dal proprietario (15 novembre 2026): «se sono su pagine duplicate e su tutte le
// pagine c'e' lo stesso identico asset, se sto con il mirino su una finestra mi si deve
// trasportare anche sulle altre... sullo stesso punto del prezzo, stesso punto dell'orario... e'
// esattamente come funziona su TradingView». E le sue tre condizioni:
//   1. solo il mouse, non il dito: «questo vale soltanto per il PC»;
//   2. solo lo stesso asset: «non puo' essere riportato su un asset diverso, questa e' la
//      condizione»;
//   3. i time frame possono essere diversi: «se sulla finestra 1 siamo a 15 minuti... e la pagina
//      madre a 1 minuto, sulle altre pagine segue l'asse del prezzo e l'asse del tempo».
//
// E la richiesta della stessa sera: «in modalita' replay, quando andiamo a selezionare un nuovo
// punto, l'anteprima deve venire anche sulle altre pagine duplicate... l'asse verticale che
// delimita il taglio... anche se hanno un time frame diverso».
//
// PERCHE' VIAGGIANO ORARIO E PREZZO, NON I PIXEL: una x in pixel non significa niente in una
// finestra con un altro zoom, un'altra larghezza e un altro time frame. Orario e prezzo
// significano la stessa cosa in tutte, e chi riceve li riconverte nei propri pixel.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

function ascoltaErrori(pagina) {
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  return errori;
}

// 600 candele da un minuto su un asset: ogni finestra le aggrega al proprio time frame, come fa
// l'app vera (currentTF). Il prezzo sale piano, cosi' prezzi diversi stanno a quote diverse.
const SCENA = (asset, tf) => `(function(){
  const base = Date.parse('2026-11-10T08:00:00Z');
  const R = [];
  for (let i = 0; i < 600; i++) {
    const o = 1.0800 + i * 0.00002;
    R.push({date: new Date(base + i*60000).toISOString().slice(0,16).replace('T',' '),
            open: o, high: o + 0.00015, low: o - 0.00015, close: o + 0.00005, volume: 100});
  }
  baseRows = R;
  rowsAssetKey = currentAssetKey = ${JSON.stringify(asset)};
  currentTF = ${tf};
  liveModeActive = false; liveReplayActive = false; mt5Connected = false;
  positions.length = 0; pendingOrders.length = 0; trades.length = 0;
  masterTime = closeTimeOf(baseRows[baseRows.length-1]);
  rebuildRows();
  followLatest = true; viewEnd = idx; autoFitWidth = true;
  draw();
  return {asset: currentAssetKey, tf: currentTF, candele: rows.length};
})()`;

const SPIA = `(function(){
  window.__mirini = [];
  const ch = tradingChannel;
  ch.addEventListener('message', ev => {
    const m = ev && ev.data;
    if (m && (m.type === 'mirino' || m.type === 'mirino_taglio')) window.__mirini.push(m);
  });
})()`;

async function dueFinestre(assetA, tfA, assetB, tfB) {
  const {browser, pagina} = await apriApp();
  const errori = ascoltaErrori(pagina);
  const p2 = await pagina.context().newPage();
  const errori2 = ascoltaErrori(p2);
  await p2.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p2.goto('file://' + path.join(RADICE, 'app.html') + '?pipSlot=2',
                {waitUntil: 'domcontentloaded'});
  await p2.waitForTimeout(2500);
  await p2.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
    .forEach(el => el.style.display = 'none'));
  // IL CAMBIO ASSET FRA FINESTRE SI METTE DA PARTE, ed e' necessario spiegare perche'.
  //
  // MISURATO mentre si scriveva questo banco: appena A disegna, annuncia il proprio asset
  // (asset_announce), e B rifa' la procedura di cambio asset - che SVUOTA le candele e prova a
  // ricaricarle da disco. Nel banco non c'e' niente da ricaricare, quindi B restava con zero
  // candele e la ricerca della barra tornava -1: il banco accusava il mirino di un difetto che
  // era di un'altra funzione. Quella funzione ha i suoi banchi (clic_sul_grafico,
  // disegni_fra_finestre); qui si isola il mirino.
  const NIENTE_CAMBIO_ASSET = `(function(){
    try{ applyRemoteAssetSwitch = function(){}; }catch(e){}
  })()`;
  await pagina.evaluate(NIENTE_CAMBIO_ASSET);
  await p2.evaluate(NIENTE_CAMBIO_ASSET);
  const a = await pagina.evaluate(SCENA(assetA, tfA));
  const b = await p2.evaluate(SCENA(assetB, tfB));
  await p2.evaluate(SPIA);
  // SENZA QUESTO CONTROLLO il banco potrebbe misurare due finestre vuote e dire «non funziona»
  // (o «funziona») per il motivo sbagliato: e' esattamente l'errore appena corretto.
  assert.ok(a.candele > 0 && b.candele > 0,
    'le due finestre devono avere candele, altrimenti non si misura niente: '
    + JSON.stringify({A: a, B: b}));
  return {browser, A: pagina, B: p2, statoA: a, statoB: b, errori, errori2};
}

// IL GRAFICO VA PORTATO IN VISTA PRIMA DI MUOVERE IL MOUSE.
//
// MISURATO mentre si scriveva questo banco: nella pagina il grafico sta a y=855 con altezza 720,
// cioe' SOTTO il bordo della finestra. `mouse.move()` muove il mouse VERO in coordinate della
// finestra: un punto a y=1143 non e' sopra nessun elemento (document.elementFromPoint restituisce
// null), quindi nessun pointermove arrivava al grafico e il banco misurava «non manda niente»
// mentre il programma era giusto. Un evento costruito a mano passerebbe comunque, perche'
// scavalca il controllo di cosa c'e' sotto: sarebbe una prova piu' debole, che non direbbe se il
// gesto vero del mouse funziona.
async function riquadro(pag) {
  await pag.evaluate(() => {
    document.getElementById('chart').scrollIntoView({block: 'center'});
  });
  await pag.waitForTimeout(200);
  const r = await pag.evaluate(() => {
    const b = document.getElementById('chart').getBoundingClientRect();
    const centro = document.elementFromPoint(b.left + b.width/2, b.top + b.height/2);
    return {x: b.left, y: b.top, w: b.width, h: b.height,
            sopra: centro ? (centro.id || centro.tagName) : null};
  });
  if (!r.sopra) throw new Error('il grafico non e in vista: nessun elemento al suo centro. '
    + JSON.stringify(r));
  return r;
}

// Muove il mouse dentro il grafico della finestra A e restituisce orario e prezzo puntati.
async function muoviIlMouse(A, frazioneX = 0.6, frazioneY = 0.4) {
  const box = await riquadro(A);
  const cx = box.x + box.w * frazioneX, cy = box.y + box.h * frazioneY;
  await A.mouse.move(cx, cy);
  await A.waitForTimeout(150);
  return A.evaluate(({cx, cy}) => {
    const q = fblMirinoDaSchermo(cx, cy);
    return {q, asset: currentAssetKey, tf: currentTF};
  }, {cx, cy});
}

test('PROVA DI CONTROLLO: muovendo il mouse parte un messaggio col mirino', async () => {
  // Senza questa, un "non e' arrivato" non distinguerebbe fra la regola e il banco che non misura.
  const {browser, A, B, errori, errori2} = await dueFinestre('EURUSD', 1, 'EURUSD', 15);
  try {
    const puntato = await muoviIlMouse(A);
    const arrivati = await B.evaluate(() => window.__mirini.filter(m => m.type === 'mirino'));
    console.log('puntato:', JSON.stringify(puntato), '| arrivati:', arrivati.length);
    assert.ok(puntato.q, 'il punto sotto il mouse deve avere un orario e un prezzo');
    assert.ok(arrivati.length > 0,
      'il messaggio del mirino deve arrivare all altra finestra: arrivati ' + arrivati.length);
    assert.equal(arrivati[arrivati.length - 1].asset, 'EURUSD',
      'il messaggio porta l asset, che e la condizione del proprietario');
    assert.deepEqual(errori, []);
    assert.deepEqual(errori2, []);
  } finally { await browser.close(); }
});

test('TIME FRAME DIVERSI: il mirino SI MUOVE dentro la candela, in proporzione', async () => {
  // LA CORREZIONE CHIESTA dal proprietario: «non si deve posare, ma deve muoversi in tempo reale
  // senza fermarsi anche a time frame diversi: deve calcolare lo spostamento che avviene su time
  // frame da 1 minuto rapportato ai time frame piu' alti».
  //
  // Prima il mirino si metteva al CENTRO della candela che contiene l'istante: su un grafico da
  // 15 minuti saltava di una candela intera per volta, cioe' a scatti di quindici minuti, mentre
  // sull'altra finestra scorreva liscio. Qui si misura che due posizioni VICINE sul grafico da 1
  // minuto danno due posizioni DIVERSE e vicine su quello da 15, in proporzione.
  const {browser, A, B, statoA, statoB} = await dueFinestre('EURUSD', 1, 'EURUSD', 15);
  try {
    assert.equal(statoA.tf, 1, 'la finestra A deve stare a 1 minuto');
    assert.equal(statoB.tf, 15, 'la finestra B a 15 minuti');
    const box = await riquadro(A);
    // Dove cade il mirino su B, per una serie di posizioni vicine su A.
    const dove = [];
    for (const fx of [0.50, 0.52, 0.54, 0.56, 0.58]) {
      await A.mouse.move(box.x + box.w * fx, box.y + box.h * 0.45);
      await A.waitForTimeout(90);
      const q = await B.evaluate(() => {
        if (!fblMirinoRemoto) return null;
        const p = fblMirinoSuSchermo(fblMirinoRemoto.t, fblMirinoRemoto.prezzo);
        const i = fblRigaPerIstante(fblMirinoRemoto.t);
        return p ? {x: p.x, candela: i, t: fblMirinoRemoto.t,
                    larghezzaCandela: fblGeoGrafico.cw / fblGeoGrafico.n} : null;
      });
      if (q) dove.push(q);
    }
    console.log('posizioni su B:', JSON.stringify(dove));
    assert.ok(dove.length >= 4, 'servono piu misure per dire se si muove: ' + dove.length);
    const xs = dove.map(d => d.x);
    const diverse = new Set(xs.map(x => Math.round(x * 100))).size;
    assert.ok(diverse >= 4,
      'IL MIRINO DEVE MUOVERSI: cinque posizioni vicine su A devono dare posizioni DIVERSE su B. '
      + 'Se si posasse al centro della candela, sarebbero tutte uguali. ' + JSON.stringify(xs));
    // E deve muoversi NELLO STESSO VERSO: mouse verso destra, mirino verso destra.
    for (let k = 1; k < xs.length; k++) {
      assert.ok(xs[k] > xs[k - 1],
        'muovendo il mouse a destra il mirino deve andare a destra: ' + JSON.stringify(xs));
    }
    // IN PROPORZIONE: lo spostamento su B, diviso la larghezza di una sua candela, deve stare
    // nello stesso rapporto dei minuti percorsi su A diviso i minuti della candela di B.
    const primo = dove[0], ultimo = dove[dove.length - 1];
    const minutiPercorsi = (ultimo.t - primo.t) / 60000;
    const spostamento = ultimo.x - primo.x;
    const atteso = (minutiPercorsi / 15) * primo.larghezzaCandela;
    console.log('minuti percorsi su A:', minutiPercorsi.toFixed(2),
      '| spostamento su B:', spostamento.toFixed(1), 'px | atteso:', atteso.toFixed(1), 'px',
      '| una candela di B:', primo.larghezzaCandela.toFixed(1), 'px');
    assert.ok(Math.abs(spostamento - atteso) < Math.max(2, atteso * 0.12),
      'lo spostamento su B deve essere quello dei minuti percorsi su A, in scala sul time frame '
      + 'da 15: atteso ' + atteso.toFixed(1) + ' px, misurato ' + spostamento.toFixed(1) + ' px');
  } finally { await browser.close(); }
});

test('l istante che viaggia e CONTINUO, non arrotondato alla candela', async () => {
  // Se si spedisse l'orario della candela, il movimento sarebbe a scatti sul ricevente anche col
  // conto giusto: gli scatti sarebbero gia' dentro il numero mandato.
  const {browser, A} = await dueFinestre('EURUSD', 1, 'EURUSD', 15);
  try {
    const box = await riquadro(A);
    const t = [];
    for (const fx of [0.500, 0.502, 0.504]) {
      await A.mouse.move(box.x + box.w * fx, box.y + box.h * 0.45);
      await A.waitForTimeout(90);
      const q = await A.evaluate(({x, y}) => fblMirinoDaSchermo(x, y),
        {x: box.x + box.w * fx, y: box.y + box.h * 0.45});
      if (q) t.push(q.t);
    }
    console.log('istanti mandati:', JSON.stringify(t));
    assert.equal(t.length, 3, 'servono tre misure');
    const tuttiAlMinuto = t.every(v => v % 60000 === 0);
    assert.equal(tuttiAlMinuto, false,
      'gli istanti non devono cadere tutti su un minuto esatto: vorrebbe dire che sono '
      + 'arrotondati alla candela. ' + JSON.stringify(t));
    assert.ok(t[2] > t[0], 'e devono crescere muovendosi a destra: ' + JSON.stringify(t));
  } finally { await browser.close(); }
});

test('il prezzo che arriva e lo STESSO, non una x in pixel', async () => {
  const {browser, A, B} = await dueFinestre('EURUSD', 1, 'EURUSD', 5);
  try {
    const puntato = await muoviIlMouse(A, 0.5, 0.35);
    const r = await B.evaluate(() => (fblMirinoRemoto ? {prezzo: fblMirinoRemoto.prezzo} : null));
    console.log('prezzo puntato:', puntato.q.prezzo, '| ricevuto:', JSON.stringify(r));
    assert.ok(r, 'il mirino deve essere arrivato');
    assert.ok(Math.abs(r.prezzo - puntato.q.prezzo) < 1e-9,
      'il prezzo deve essere identico: ' + JSON.stringify({mandato: puntato.q.prezzo, arrivato: r.prezzo}));
  } finally { await browser.close(); }
});

test('ASSET DIVERSO: non si trasporta niente', async () => {
  // «Non puo' essere riportato su un asset diverso, questa e' la condizione.»
  const {browser, A, B} = await dueFinestre('EURUSD', 1, 'XAUUSD', 1);
  try {
    // IN STORICO LE FINESTRE SI SEGUONO SULL'ASSET, ed e' voluto (asset_announce ->
    // applyRemoteAssetSwitch). MISURATO mentre si scriveva il banco: B nasceva su XAU/USD e
    // veniva riportata su EUR/USD dall'annuncio di A, quindi la prova misurava due finestre sullo
    // STESSO asset e non diceva niente. Si rimette l'asset di B subito prima della misura, e poi
    // si CONTROLLA che sia rimasto: senza quel controllo la prova sarebbe verde per il motivo
    // sbagliato una seconda volta.
    await B.evaluate(`(function(){ rowsAssetKey = currentAssetKey = 'XAUUSD';
      fblMirinoRemoto = null; window.__mirini = []; })()`);
    await muoviIlMouse(A);
    const r = await B.evaluate(() => ({
      remoto: fblMirinoRemoto, asset: currentAssetKey,
      arrivati: (window.__mirini || []).length
    }));
    console.log('asset diverso -> su B:', JSON.stringify(r));
    assert.ok(r.arrivati > 0,
      'il messaggio arriva comunque sul canale (e il banco lo vede): se non arrivasse, questa '
      + 'prova sarebbe verde per il motivo sbagliato');
    assert.equal(r.asset, 'XAUUSD',
      'la finestra B deve essere ancora su XAU/USD, altrimenti questa prova confronta due '
      + 'finestre sullo stesso asset: ' + JSON.stringify(r));
    assert.equal(r.remoto, null,
      'ma su un asset diverso NON si deve applicare: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('IL DITO NO: solo il mouse trasporta il mirino', async () => {
  // «Questo vale soltanto per il PC.»
  const {browser, A, B} = await dueFinestre('EURUSD', 1, 'EURUSD', 1);
  try {
    const box = await riquadro(A);
    // Un movimento col DITO, costruito come lo manda un tablet.
    await A.evaluate(({x, y}) => {
      const el = document.getElementById('chart');
      el.dispatchEvent(new PointerEvent('pointermove', {pointerType: 'touch', pointerId: 7,
        clientX: x, clientY: y, bubbles: true, cancelable: true}));
    }, {x: box.x + box.w * 0.6, y: box.y + box.h * 0.4});
    await B.waitForTimeout(300);
    const r = await B.evaluate(() => ({remoto: fblMirinoRemoto,
      arrivati: (window.__mirini || []).filter(m => m.type === 'mirino' && !m.via).length}));
    console.log('col dito -> su B:', JSON.stringify(r));
    assert.equal(r.arrivati, 0,
      'il dito non deve mandare niente: ne sono arrivati ' + r.arrivati);
    assert.equal(r.remoto, null);
  } finally { await browser.close(); }
});

test('uscendo dal grafico, il mirino sparisce anche sulle altre', async () => {
  const {browser, A, B} = await dueFinestre('EURUSD', 1, 'EURUSD', 1);
  try {
    await muoviIlMouse(A);
    const prima = await B.evaluate(() => !!fblMirinoRemoto);
    assert.equal(prima, true, 'prima deve esserci');
    await A.evaluate(() => {
      document.getElementById('chart').dispatchEvent(
        new PointerEvent('pointerout', {pointerType: 'mouse', bubbles: true}));
    });
    await B.waitForTimeout(400);
    const dopo = await B.evaluate(() => fblMirinoRemoto);
    console.log('dopo l uscita:', JSON.stringify(dopo));
    assert.equal(dopo, null,
      'altrimenti resterebbe appeso dove si trovava, e sembrerebbe un disegno');
  } finally { await browser.close(); }
});

test('il mirino LOCALE comanda su quello che arriva da fuori', async () => {
  const {browser, A, B} = await dueFinestre('EURUSD', 1, 'EURUSD', 1);
  try {
    // B ha il suo mirino sotto il mouse, e intanto A manda il proprio.
    const boxB = await riquadro(B);
    await B.mouse.move(boxB.x + boxB.w * 0.3, boxB.y + boxB.h * 0.6);
    await B.waitForTimeout(120);
    const suo = await B.evaluate(() => (crosshair ? {x: crosshair.x, y: crosshair.y} : null));
    assert.ok(suo, 'B deve avere il suo mirino');
    await muoviIlMouse(A, 0.8, 0.2);
    const dopo = await B.evaluate(() => ({
      suo: crosshair ? {x: crosshair.x, y: crosshair.y} : null,
      remoto: !!fblMirinoRemoto}));
    console.log('locale contro remoto:', JSON.stringify(dopo));
    assert.deepEqual(dopo.suo, suo,
      'il mirino di chi sta muovendo il mouse QUI non deve essere spostato da un altra finestra: '
      + JSON.stringify(dopo));
  } finally { await browser.close(); }
});

test('i messaggi sono strozzati: non uno per pixel', async () => {
  // Un mouse genera fino a 120 movimenti al secondo. Mandarli tutti vorrebbe dire inondare il
  // canale e far ridisegnare le altre finestre a ogni pixel: e' l errore delle letture
  // moltiplicate al ponte, misurato oggi stesso.
  const {browser, A, B} = await dueFinestre('EURUSD', 1, 'EURUSD', 1);
  try {
    const box = await riquadro(A);
    const t0 = Date.now();
    for (let i = 0; i < 60; i++) {
      await A.mouse.move(box.x + box.w * (0.2 + i * 0.01), box.y + box.h * 0.5);
    }
    const durata = Date.now() - t0;
    await B.waitForTimeout(300);
    const quanti = await B.evaluate(() =>
      (window.__mirini || []).filter(m => m.type === 'mirino' && !m.via).length);
    const tetto = Math.ceil(durata / 40) + 3;
    console.log('60 movimenti in', durata, 'ms -> messaggi:', quanti, '(tetto', tetto + ')');
    assert.ok(quanti > 0, 'qualcosa deve pur arrivare');
    assert.ok(quanti <= tetto,
      'al massimo uno ogni 40 ms: ne sono arrivati ' + quanti + ' in ' + durata + ' ms');
  } finally { await browser.close(); }
});

test('REPLAY: l anteprima del taglio compare anche sull altra finestra', async () => {
  const {browser, A, B} = await dueFinestre('EURUSD', 1, 'EURUSD', 15);
  try {
    // Le due finestre in Live, e la scelta «su tutte le finestre» gia' fatta.
    // NIENTE «liveModeActive=true» QUI: senza un ponte collegato, entrare in Live svuota le
    // candele di questa finestra e il taglio non si potrebbe posare su nessuna barra - misurato,
    // la ricerca della candela tornava -1. Per l'anteprima basta la scelta del punto in corso.
    await A.evaluate(`(function(){ fblReplayPerTutte=true;
      liveReplaySelecting=true; liveReplayGuideClientX=null; draw(); })()`);
    const box = await riquadro(A);
    await A.mouse.move(box.x + box.w * 0.45, box.y + box.h * 0.5);
    await A.waitForTimeout(250);
    const r = await B.evaluate(() => ({
      guida: fblGuidaRemota ? {t: fblGuidaRemota.t, asset: fblGuidaRemota.asset} : null,
      tagli: (window.__mirini || []).filter(m => m.type === 'mirino_taglio' && !m.via).length
    }));
    console.log('anteprima del taglio su B:', JSON.stringify(r));
    assert.ok(r.tagli > 0, 'l anteprima deve essere annunciata: ' + JSON.stringify(r));
    assert.ok(r.guida, 'e registrata sull altra finestra: ' + JSON.stringify(r));
    // E deve cadere su una candela vera di B, che sta a 15 minuti.
    const dove = await B.evaluate((t) => {
      const i = fblRigaPerIstante(t);
      return {i, inizio: rows[i] ? parseDateTime(rows[i].date) : null};
    }, r.guida.t);
    console.log('la candela del taglio su B:', JSON.stringify(dove));
    assert.ok(dove.i >= 0 && dove.inizio <= r.guida.t,
      'il taglio si posa sulla candela che contiene quell istante: ' + JSON.stringify(dove));
  } finally { await browser.close(); }
});

test('REPLAY: con «solo questa» l anteprima NON va sulle altre', async () => {
  // L ambito e' quello gia' scelto alla domanda della voce 6: disegnare un taglio su finestre
  // che non devono entrare in replay sarebbe sbagliato.
  const {browser, A, B} = await dueFinestre('EURUSD', 1, 'EURUSD', 15);
  try {
    await A.evaluate(`(function(){ fblReplayPerTutte=false;
      liveReplaySelecting=true; liveReplayGuideClientX=null; draw(); })()`);
    const box = await riquadro(A);
    await A.mouse.move(box.x + box.w * 0.45, box.y + box.h * 0.5);
    await A.waitForTimeout(250);
    const r = await B.evaluate(() => ({
      guida: fblGuidaRemota,
      tagli: (window.__mirini || []).filter(m => m.type === 'mirino_taglio' && !m.via).length
    }));
    console.log('solo questa -> taglio su B:', JSON.stringify(r));
    assert.equal(r.tagli, 0,
      'con «solo questa» l anteprima del taglio non deve partire: ' + JSON.stringify(r));
    assert.equal(r.guida, null);
  } finally { await browser.close(); }
});
