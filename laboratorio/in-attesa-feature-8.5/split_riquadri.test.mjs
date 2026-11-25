// RIQUADRI: PIU' GRAFICI DENTRO LA STESSA FINESTRA (punto 8.5.13 della consegna del 19 novembre).
//
// RICHIESTA DEL PROPRIETARIO (24 novembre 2026), decisa prima di scrivere il codice:
//   1. fino a 4 riquadri, impaginati 1x1, 1x2 (in fila) o 2x2 (in griglia);
//   2. gli ASSET sono INDIPENDENTI: lo stesso asset puo' stare in due riquadri, e cambiarlo in
//      uno non deve spostare gli altri;
//   3. MIRINO e REPLAY sono SINCRONIZZATI fra i riquadri, con la stessa regola delle finestre
//      duplicate (stesso asset, time frame anche diversi, orario+prezzo -> pixel del ricevitore).
//
// COM'E' FATTO, e perche': un riquadro e' una PAGINA COMPLETA dentro un <iframe>
// (app.html?riquadro=N), non una seconda area di disegno nella stessa pagina. La misura e' in
// cervello/INDAGINE-DIVISIONE-GRAFICO.md: una seconda area di disegno nella stessa pagina resta
// NERA (0 pixel dipinti) e, con lo stesso id, il disegno va da una parte e i gesti dall'altra -
// perche' lo stato del grafico e' una variabile globale sola. L'isolamento che funziona e' il
// documento separato, ed e' lo stesso che usano gia' le finestre duplicate.
//
// COSA MISURANO QUESTE PROVE (comportamento, non testo):
//   - il pulsante porta 1 -> 2 -> 4 -> 1 e l'impaginazione e' quella decisa;
//   - passando da 2 a 4 i due riquadri gia' aperti NON si ricaricano (si riconosce il nodo);
//   - con 1 grafico gli iframe spariscono e il canvas della madre torna visibile;
//   - una pagina-riquadro si riconosce (slot 21-24), e' "solo grafico", non e' madre e NON
//     annida altri riquadri;
//   - un riquadro si apre sull'asset e sul time frame della madre (dall'indirizzo), invece che
//     vuoto;
//   - il MIRINO di un grafico arriva al riquadro (stessa traduzione orario+prezzo delle finestre);
//   - i RIQUADRI NON SI SEGUONO L'UN L'ALTRO SULL'ASSET (decisione 2 del proprietario).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

// 600 candele da un minuto: ogni riquadro le aggrega al proprio time frame, come fa l'app vera.
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

const SPIA_MIRINO = `(function(){
  window.__mirini = [];
  tradingChannel.addEventListener('message', ev => {
    const m = ev && ev.data;
    if (m && m.type === 'mirino') window.__mirini.push(m);
  });
})()`;

async function riquadro(pag) {
  await pag.evaluate(() => document.getElementById('chart').scrollIntoView({block: 'center'}));
  await pag.waitForTimeout(200);
  const r = await pag.evaluate(() => {
    const b = document.getElementById('chart').getBoundingClientRect();
    const sopra = document.elementFromPoint(b.left + b.width/2, b.top + b.height/2);
    return {x: b.left, y: b.top, w: b.width, h: b.height, sopra: sopra ? (sopra.id || sopra.tagName) : null};
  });
  if (!r.sopra) throw new Error('il grafico non e in vista: ' + JSON.stringify(r));
  return r;
}

test('il pulsante porta 1 -> 2 -> 4 -> 1 e impagina come deciso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const esito = await pagina.evaluate(() => {
      const out = {};
      const ov = () => document.getElementById('fblRiquadri');
      const frames = () => ov() ? Array.from(ov().querySelectorAll('iframe')) : [];
      // 1 -> 2 (clic vero sul pulsante, non la funzione a mano)
      out.partenza = fblRiquadriLayout;
      document.getElementById('riquadriBtn').click();
      out.due = {n: fblRiquadriLayout, frame: frames().length,
        src: frames().map(f => f.getAttribute('src')),
        colonne: ov().style.gridTemplateColumns, righe: ov().style.gridTemplateRows};
      const primoNodo = frames()[0];
      // 2 -> 4: i due aperti restano QUELLI (nessun ricaricamento)
      document.getElementById('riquadriBtn').click();
      out.quattro = {n: fblRiquadriLayout, frame: frames().length,
        colonne: ov().style.gridTemplateColumns, righe: ov().style.gridTemplateRows,
        stessoNodo: frames()[0] === primoNodo};
      // 4 -> 1: si chiude tutto e torna il canvas della madre
      document.getElementById('riquadriBtn').click();
      out.uno = {n: fblRiquadriLayout, overlay: !!ov(),
        canvasVisibile: getComputedStyle(document.getElementById('chartMainArea')).display};
      return out;
    });
    assert.equal(esito.partenza, 1, 'si parte da un grafico solo');
    assert.equal(esito.due.n, 2);
    assert.equal(esito.due.frame, 2, 'due riquadri = due grafici');
    assert.equal(esito.due.colonne, '1fr 1fr');
    assert.equal(esito.due.righe, '1fr', '1x2: in fila, una riga sola');
    for (const s of esito.due.src) {
      assert.match(s, /\?pipSlot=2[1-4]&riquadro=[1-4]/, 'ogni riquadro e una pagina con il suo slot: ' + s);
    }
    assert.equal(esito.quattro.n, 4);
    assert.equal(esito.quattro.frame, 4);
    assert.equal(esito.quattro.colonne, '1fr 1fr');
    assert.equal(esito.quattro.righe, '1fr 1fr', '2x2: due righe da due');
    assert.ok(esito.quattro.stessoNodo, 'passando da 2 a 4 i riquadri gia aperti non si ricaricano');
    assert.equal(esito.uno.n, 1);
    assert.equal(esito.uno.overlay, false, 'tornando a 1 grafico gli iframe si chiudono');
    assert.notEqual(esito.uno.canvasVisibile, 'none', 'il canvas della madre torna visibile');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la pagina-riquadro: slot suo, solo grafico, non e madre e non annida riquadri', async () => {
  const {browser, pagina, errori} = await apriApp({query: '?riquadro=2'});
  try {
    const esito = await pagina.evaluate(() => ({
      slot: PIP_SLOT,
      sonoRiquadro: FBL_SONO_RIQUADRO,
      eMadre: fblFinestraMadre(),
      // la pagina-riquadro mostra SOLO il grafico (stessa impaginazione delle finestre duplicate)
      soloGrafico: document.body.classList.contains('fbPipChartOnly'),
      pulsante: getComputedStyle(document.getElementById('riquadriBtn')).display,
      // e non puo' annidare: chiedere 2 riquadri qui dentro non fa niente
      dopo: (() => { const r = fblRiquadriApplica(2); return {n: r, overlay: !!document.getElementById('fblRiquadri')}; })()
    }));
    assert.equal(esito.slot, 22, 'riquadro 2 = slot 22 (sopra le finestre duplicate 2-9)');
    assert.equal(esito.sonoRiquadro, true);
    assert.equal(esito.eMadre, false, 'un riquadro non e la pagina madre');
    assert.equal(esito.soloGrafico, true, 'un riquadro mostra soltanto il grafico');
    assert.equal(esito.pulsante, 'none', 'dentro un riquadro il pulsante riquadri non c e');
    assert.equal(esito.dopo.n, 1);
    assert.equal(esito.dopo.overlay, false, 'i riquadri non si annidano');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il riquadro si apre sull asset e sul time frame della madre, non vuoto', async () => {
  // Come li passa la madre nell'indirizzo (vedi fblRiquadroUrl): ?riquadro=1&asset=...&tf=...
  const {browser, pagina, errori} = await apriApp({query: '?riquadro=1&asset=EURUSD&tf=15'});
  try {
    // L'asset lo applica l'indirizzo (come farebbe l'utente dal menu); il TIME FRAME, misurato,
    // si applica solo quando le candele di quell'asset ci sono (il cambio time frame esce subito
    // se non c'e' storico: vedi il primo controllo in #tf). Quindi qui si fa la stessa cosa che
    // succede nell'app vera: prima arrivano le candele, poi il time frame si posa.
    await pagina.waitForTimeout(1500);
    await pagina.evaluate(SCENA('EURUSD', 1));
    let esito = null;
    for (let i = 0; i < 30; i++) {
      await pagina.waitForTimeout(200);
      esito = await pagina.evaluate(() => ({
        menu: document.getElementById('market').value,
        menuTf: document.getElementById('tfChart').value,
        tf: currentTF
      }));
      if (esito.tf === 15) break;
    }
    assert.equal(esito.menu, 'EURUSD', 'l asset scelto dalla madre e gia nel menu del riquadro');
    assert.equal(esito.menuTf, '15');
    assert.equal(esito.tf, 15, 'anche il time frame e quello della madre');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i riquadri NON si seguono sull asset: cambiarlo in uno non sposta gli altri', async () => {
  // DECISIONE 2 DEL PROPRIETARIO (24 novembre 2026): asset indipendenti. In Storico, fra FINESTRE
  // duplicate vale ancora la regola di sempre (si seguono, vedi mirino_fra_finestre.test.mjs);
  // fra RIQUADRI no. Questa prova misura i due versi: il riquadro non segue la madre, la madre
  // non segue il riquadro.
  const {browser, pagina, errori} = await apriApp();
  const errori2 = [];
  try {
    const pannello = await pagina.context().newPage();
    pannello.on('pageerror', e => errori2.push(String(e).slice(0, 300)));
    await pannello.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await pannello.goto('file://' + path.join(RADICE, 'app.html') + '?riquadro=1',
                        {waitUntil: 'domcontentloaded'});
    await pannello.waitForTimeout(2500);
    await pannello.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
      .forEach(el => el.style.display = 'none'));
    await pagina.evaluate(SCENA('EURUSD', 1));
    await pannello.evaluate(SCENA('XAUUSD', 15));
    await pagina.waitForTimeout(300);
    // la madre cambia asset e lo annuncia (e' cio' che fa draw() quando cambia currentAssetKey)
    await pagina.evaluate(`(function(){ rowsAssetKey = currentAssetKey = 'GBPUSD';
      broadcastAssetAnnounce(); })()`);
    await pagina.waitForTimeout(500);
    const delRiquadro = await pannello.evaluate(() => currentAssetKey);
    // e il riquadro cambia il suo: la madre non deve seguirlo
    await pannello.evaluate(`(function(){ rowsAssetKey = currentAssetKey = 'USDJPY';
      broadcastAssetAnnounce(); })()`);
    await pagina.waitForTimeout(500);
    const dellaMadre = await pagina.evaluate(() => currentAssetKey);
    assert.equal(delRiquadro, 'XAUUSD',
      'il riquadro deve restare sul SUO asset quando la madre ne cambia uno: ' + delRiquadro);
    assert.equal(dellaMadre, 'GBPUSD',
      'e la madre non deve seguire il riquadro: ' + dellaMadre);
    assert.deepEqual(errori, []);
    assert.deepEqual(errori2, []);
  } finally { await browser.close(); }
});

test('il mirino del grafico arriva al riquadro (stesso asset, time frame diverso)', async () => {
  // La traduzione del mirino e' orario+prezzo, non pixel: attraversa un riquadro esattamente come
  // attraversa una finestra duplicata. Qui il ricevente e' una pagina ?riquadro=1.
  const {browser, pagina, errori} = await apriApp();
  const errori2 = [];
  try {
    const pannello = await pagina.context().newPage();
    pannello.on('pageerror', e => errori2.push(String(e).slice(0, 300)));
    await pannello.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await pannello.goto('file://' + path.join(RADICE, 'app.html') + '?riquadro=1',
                        {waitUntil: 'domcontentloaded'});
    await pannello.waitForTimeout(2500);
    await pannello.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
      .forEach(el => el.style.display = 'none'));
    // Il cambio asset fra grafici si mette da parte: qui si misura il mirino, non quello.
    const NIENTE_CAMBIO_ASSET = `(function(){ try{ applyRemoteAssetSwitch=function(){}; }catch(e){} })()`;
    await pagina.evaluate(NIENTE_CAMBIO_ASSET);
    await pannello.evaluate(NIENTE_CAMBIO_ASSET);
    const a = await pagina.evaluate(SCENA('EURUSD', 1));
    const b = await pannello.evaluate(SCENA('EURUSD', 15));
    await pannello.evaluate(SPIA_MIRINO);
    assert.ok(a.candele > 0 && b.candele > 0, 'servono candele da entrambe le parti: '
      + JSON.stringify({a, b}));
    assert.equal(await pannello.evaluate(() => PIP_SLOT), 21, 'il ricevente e il riquadro 1');
    const box = await riquadro(pagina);
    await pagina.mouse.move(box.x + box.w * 0.55, box.y + box.h * 0.45);
    await pagina.waitForTimeout(200);
    const arrivati = await pannello.evaluate(() => window.__mirini);
    assert.ok(arrivati.length > 0, 'il mirino deve arrivare anche a un riquadro: arrivati ' + arrivati.length);
    assert.equal(arrivati[arrivati.length - 1].asset, 'EURUSD', 'porta l asset, come fra finestre');
    assert.deepEqual(errori, []);
    assert.deepEqual(errori2, []);
  } finally { await browser.close(); }
});
