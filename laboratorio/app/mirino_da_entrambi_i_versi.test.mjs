// IL MIRINO VIAGGIA IN TUTTI E DUE I VERSI, NON SOLO DALLA MADRE ALLE DUPLICATE.
//
// SEGNALATO dal proprietario (19 novembre 2026): «il puntatore del mouse in tutti e due i versi:
// oggi il mirino della madre si vede sulle duplicate, non il contrario».
//
// MISURATO (19 novembre, prima della cura, con una madre M1 e una duplicata M15 sullo stesso asset):
// il messaggio della duplicata ARRIVA alla madre e `fblMirinoRemoto` viene perfino scritto — ma la
// madre continua a disegnare il PROPRIO mirino, fermo dov'era l'ultima volta che il mouse è passato
// di lì. Misura, nella sequenza «mouse sulla madre → mouse sulla duplicata»:
//   madre: locale {x:527,y:353} (fermo), remoto {t:…267.8127, prezzo:1.08720} (quello della duplicata)
//          e il punto DISEGNATO resta {x:527,y:353} locale — cioè il mirino della duplicata non si
//          vede sulla madre, esattamente come dice il proprietario.
//   duplicata: remoto {t:…526.213, prezzo:1.09165} della madre, disegnato (daFuori:true) — questo
//          verso funziona già, ed è la prova di controllo.
// La regola scritta in draw() è «il mirino locale comanda» (giusto mentre il mouse è qui), ma
// `crosshair` non viene mai azzerato quando il mouse se ne va: in un browser vero il passaggio da
// una finestra all'altra può non produrre un `pointerout` (cambio scheda, finestra coperta, finestra
// separata), e il mirino resta appeso per sempre su un punto che non è più sotto il puntatore.
//
// COME SI MISURA, senza pixel: si legge quello che draw() userebbe (locale se c'è, altrimenti il
// remoto, righe ~27800 di app.html) e si controlla che dopo lo spostamento del mouse su un'altra
// finestra il punto disegnato sia quello ARRIVATO, non quello vecchio.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

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
  crosshair = null; fblMirinoRemoto = null;
  masterTime = closeTimeOf(baseRows[baseRows.length-1]);
  rebuildRows();
  followLatest = true; viewEnd = idx; autoFitWidth = true;
  draw();
  return {asset: currentAssetKey, tf: currentTF, candele: rows.length, slot: PIP_SLOT};
})()`;

const NIENTE_CAMBIO_ASSET = `(function(){ try{ applyRemoteAssetSwitch=function(){}; }catch(e){} })()`;

// QUELLO CHE draw() USEREBBE: il mirino di questa finestra se c'è, altrimenti quello arrivato da
// fuori (stessa regola delle righe ~27800). `daFuori` dice chi ha vinto.
const CHI_DISEGNA = `(function(){
  let punto=null, daFuori=false;
  if(crosshair){ punto={x:crosshair.x,y:crosshair.y}; }
  else if(fblMirinoRemoto && fblMirinoRemoto.asset===currentAssetKey){
    const q=fblMirinoSuSchermo(fblMirinoRemoto.t,fblMirinoRemoto.prezzo);
    if(q){ punto={x:q.x,y:q.y}; daFuori=true; }
  }
  return {slot:PIP_SLOT, tf:currentTF,
          locale:crosshair?{x:Math.round(crosshair.x),y:Math.round(crosshair.y)}:null,
          remoto:fblMirinoRemoto?{t:fblMirinoRemoto.t,prezzo:fblMirinoRemoto.prezzo}:null,
          disegna:punto?{x:Math.round(punto.x),y:Math.round(punto.y),daFuori}:null};
})()`;

async function riquadro(pag) {
  await pag.evaluate(() => document.getElementById('chart').scrollIntoView({block:'center'}));
  await pag.waitForTimeout(200);
  const r = await pag.evaluate(() => {
    const b = document.getElementById('chart').getBoundingClientRect();
    const centro = document.elementFromPoint(b.left + b.width/2, b.top + b.height/2);
    return {x:b.left, y:b.top, w:b.width, h:b.height, sopra: centro ? (centro.id || centro.tagName) : null};
  });
  if (!r.sopra) throw new Error('il grafico non e in vista: ' + JSON.stringify(r));
  return r;
}

async function dueFinestre(tfMadre, tfDup) {
  const {browser, pagina} = await apriApp();
  const p2 = await pagina.context().newPage();
  await p2.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p2.goto('file://' + path.join(RADICE, 'app.html') + '?pipSlot=2', {waitUntil:'domcontentloaded'});
  await p2.waitForTimeout(2500);
  await p2.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
    .forEach(el => el.style.display='none'));
  await pagina.evaluate(NIENTE_CAMBIO_ASSET);
  await p2.evaluate(NIENTE_CAMBIO_ASSET);
  const a = await pagina.evaluate(SCENA('EURUSD', tfMadre));
  const b = await p2.evaluate(SCENA('EURUSD', tfDup));
  // Senza candele il banco non misurerebbe niente (trappola gia' pagata in mirino_fra_finestre).
  assert.ok(a.candele > 0 && b.candele > 0, 'le finestre devono avere candele: '
    + JSON.stringify({madre: a, dup: b}));
  return {browser, madre: pagina, dup: p2, riquadroMadre: await riquadro(pagina),
          riquadroDup: await riquadro(p2)};
}

// Il punto che una finestra sta puntando con il mouse, letto dalle sue stesse funzioni.
const PUNTATO = (x, y) => `(function(){ const q=fblMirinoDaSchermo(${x},${y}); return q; })()`;

test('IL MIRINO VIAGGIA NEI DUE VERSI: dalla duplicata alla madre e viceversa', async () => {
  const c = await dueFinestre(1, 15);
  try {
    // 1) mouse sulla MADRE: la duplicata lo riceve (prova di controllo del verso che funziona).
    await c.madre.bringToFront();
    const mx1 = c.riquadroMadre.x + c.riquadroMadre.w * 0.40;
    const my1 = c.riquadroMadre.y + c.riquadroMadre.h * 0.40;
    await c.madre.mouse.move(mx1, my1);
    await c.madre.waitForTimeout(400);
    const puntoMadre = await c.madre.evaluate(PUNTATO(mx1, my1));
    const dopoMadre = await c.dup.evaluate(CHI_DISEGNA);
    console.log('1) mouse sulla madre -> duplicata disegna:', JSON.stringify(dopoMadre));
    assert.equal(dopoMadre.disegna && dopoMadre.disegna.daFuori, true,
      'la duplicata deve disegnare il mirino della madre: ' + JSON.stringify(dopoMadre));
    assert.ok(puntoMadre && Math.abs(dopoMadre.remoto.prezzo - puntoMadre.prezzo) < 1e-9,
      'e deve essere lo stesso prezzo puntato sulla madre: '
      + JSON.stringify({puntato: puntoMadre, arrivato: dopoMadre.remoto}));

    // 2) IL VERSO SEGNALATO: il mouse passa sulla DUPLICATA. La madre deve disegnare il mirino
    //    della duplicata. Oggi resta appeso al suo mirino vecchio (misurato: locale {527,353}).
    await c.dup.bringToFront();
    const dx1 = c.riquadroDup.x + c.riquadroDup.w * 0.60;
    const dy1 = c.riquadroDup.y + c.riquadroDup.h * 0.40;
    await c.dup.mouse.move(dx1, dy1);
    await c.dup.waitForTimeout(400);
    const puntoDup = await c.dup.evaluate(PUNTATO(dx1, dy1));
    const dopoDup = await c.madre.evaluate(CHI_DISEGNA);
    console.log('2) mouse sulla duplicata -> madre disegna:', JSON.stringify(dopoDup));
    assert.ok(dopoDup.remoto, 'il mirino della duplicata deve ARRIVARE alla madre: '
      + JSON.stringify(dopoDup));
    assert.equal(dopoDup.disegna && dopoDup.disegna.daFuori, true,
      'la madre deve DISEGNARE il mirino della duplicata, non il proprio rimasto indietro: '
      + JSON.stringify(dopoDup));
    assert.ok(Math.abs(dopoDup.remoto.prezzo - puntoDup.prezzo) < 1e-9,
      'ed e lo stesso prezzo puntato sulla duplicata: '
      + JSON.stringify({puntato: puntoDup, arrivato: dopoDup.remoto}));

    // 3) e tornando sulla madre, la duplicata non deve restare appesa al suo mirino vecchio.
    await c.madre.bringToFront();
    const mx2 = c.riquadroMadre.x + c.riquadroMadre.w * 0.55;
    const my2 = c.riquadroMadre.y + c.riquadroMadre.h * 0.50;
    await c.madre.mouse.move(mx2, my2);
    await c.madre.waitForTimeout(400);
    const puntoMadre2 = await c.madre.evaluate(PUNTATO(mx2, my2));
    const dup2 = await c.dup.evaluate(CHI_DISEGNA);
    console.log('3) mouse di nuovo madre -> duplicata disegna:', JSON.stringify(dup2));
    assert.equal(dup2.disegna && dup2.disegna.daFuori, true,
      'e viceversa: la duplicata deve tornare a mostrare il mirino della madre: '
      + JSON.stringify(dup2));
    assert.ok(Math.abs(dup2.remoto.prezzo - puntoMadre2.prezzo) < 1e-9,
      'sullo stesso prezzo puntato sulla madre: '
      + JSON.stringify({puntato: puntoMadre2, arrivato: dup2.remoto}));
  } finally { await c.browser.close(); }
});

test('IL MIRINO DI CHI HA MOSSO IL MOUSE PER ULTIMO COMANDA', async () => {
  // LA REGOLA E' CAMBIATA IL 19 NOVEMBRE 2026, e va spiegato perche' (regola del progetto: un
  // banco non si aggiusta per farlo passare, si riscrive quando cambia la regola).
  //
  // Prima: «il mirino locale comanda sempre, quello che arriva da fuori non lo sposta». Era giusto
  // per proteggere chi sta muovendo il mouse QUI, ma non aveva un limite: quando il mouse passava
  // su un'altra finestra senza lasciare un `pointerout` (il caso del proprietario) questa finestra
  // restava col suo mirino vecchio e ignorava tutte le altre — cioe' il mirino viaggiava in un
  // verso solo.
  // Adesso: c'e' UN solo mouse, quindi comanda il MOVIMENTO PIU' RECENTE. Il messaggio porta
  // l'istante del movimento (`at`, stesso orologio, stesso computer): se e' piu' recente del nostro
  // ultimo, il puntatore e' di la' e il nostro mirino e' rimasto indietro.
  //
  // Qui si misurano i due casi che rendono la regola sicura:
  //   - un messaggio VECCHIO (rimasto in volo da prima che il mouse arrivasse qui) NON sposta
  //     niente;
  //   - un messaggio PIU' RECENTE del nostro ultimo movimento prende il posto, perche' il mouse
  //     non puo' essere in due finestre insieme.
  const c = await dueFinestre(1, 15);
  try {
    await c.dup.bringToFront();
    await c.dup.mouse.move(c.riquadroDup.x + c.riquadroDup.w * 0.5,
                           c.riquadroDup.y + c.riquadroDup.h * 0.45);
    await c.dup.waitForTimeout(120);
    const suo = await c.dup.evaluate(CHI_DISEGNA);
    assert.ok(suo.locale, 'la duplicata deve avere il suo mirino sotto il mouse: ' + JSON.stringify(suo));

    // 1) MESSAGGIO VECCHIO: parte dall'ALTRA finestra con un `at` anteriore al nostro movimento.
    //    (Un messaggio mandato dalla stessa finestra non torna indietro: il canale non consegna a
    //    chi lo manda. Il banco deve quindi farlo partire dall'altra, come nella realta'.)
    await c.madre.evaluate(() => {
      tradingChannel.postMessage({type:'mirino', slot:0, at:Date.now()-5000,
        asset:currentAssetKey, t:parseDateTime(baseRows[10].date), prezzo:1.0001});
    });
    await c.dup.waitForTimeout(200);
    const dopoVecchio = await c.dup.evaluate(CHI_DISEGNA);
    console.log('messaggio vecchio -> :', JSON.stringify(dopoVecchio));
    assert.deepEqual(dopoVecchio.locale, suo.locale,
      'un messaggio partito PRIMA del nostro movimento non deve spostare il mirino locale: '
      + JSON.stringify(dopoVecchio));
    assert.equal(dopoVecchio.disegna && dopoVecchio.disegna.daFuori, false);

    // 2) MESSAGGIO PIU' RECENTE: il mouse si e' mosso altrove dopo di noi.
    await c.dup.waitForTimeout(150);
    await c.madre.evaluate(() => {
      tradingChannel.postMessage({type:'mirino', slot:0, at:Date.now(),
        asset:currentAssetKey, t:parseDateTime(baseRows[10].date), prezzo:1.0002});
    });
    await c.dup.waitForTimeout(200);
    const dopoNuovo = await c.dup.evaluate(CHI_DISEGNA);
    console.log('messaggio più recente -> :', JSON.stringify(dopoNuovo));
    assert.equal(dopoNuovo.disegna && dopoNuovo.disegna.daFuori, true,
      'un movimento PIU\' RECENTE del nostro dice che il puntatore e\' altrove: il mirino deve '
      + 'lasciare il posto: ' + JSON.stringify(dopoNuovo));
  } finally { await c.browser.close(); }
});
