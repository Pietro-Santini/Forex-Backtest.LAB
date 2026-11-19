// I MODELLI DEI DISEGNI: SOLO LINEE E RETTANGOLI NELLA BARRA LATERALE, E UN «PREDEFINITO»
// IN OGNI PANNELLO.
//
// SEGNALATO dal proprietario (19 novembre 2026): «ancora il salvataggio dei modelli per il
// ritracciamento fibonacci non funziona, neanche per i profili volumetrici disegnati a mano, come
// neanche il VWAP. Per quanto riguarda la lista dei modelli sulla barra laterale mi deve fare
// vedere solo i modelli delle linee e rettangoli.» E poi: «dobbiamo anche aggiungere un pulsante
// dentro ogni modello e setup, un tasto con scritto "predefinito", cioe' un tasto che ci permette
// di ritornare alle impostazioni di fabbrica dell'indicatore/disegno ecc.»
//
// MISURATO PRIMA DELLA CURA (19 novembre 2026):
//   - nel menu laterale «Modello ⌄» comparivano anche i modelli Fibonacci e quelli dei profili:
//     il proprietario li vuole SOLO nel cassetto a cui appartengono;
//   - salvando un modello dal pannello del profilo DOPO aver cambiato i campi SENZA premere Ok,
//     il modello si portava dietro i valori di PRIMA (buckets 24 invece di 99, colore vecchio):
//     si salvava una cosa e se ne applicava un'altra - «non funziona» e' una descrizione esatta;
//   - i modelli salvati dalle versioni precedenti nel cassetto sbagliato (un Fibonacci dentro
//     `fbtDrawingTemplates_v1`) restavano invisibili per sempre nel menu in cui si cercano;
//   - il pannello del profilo, quello dello stile del disegno e quello degli indicatori non
//     avevano alcun «Predefinito»: per tornare alle impostazioni di fabbrica bisognava
//     ricostruirle a mano.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SCENA = (tipo) => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++) {
    const p = 100 + Math.sin(i / 9);
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: p, high: p + 1, low: p - 1, close: p, volume: 10});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD'; rowsAssetKey = 'EURUSD';
  csvLibrary = [{id: 'mt5_live_EURUSD', rows: R}];
  for (const k of ['fbtDrawingTemplates_v1', 'fbtFibTemplates_v1', 'fbtVpTemplates_v1']) {
    try { localStorage.removeItem(k); } catch (e) {}
  }
  drawings = [];
  const d = {id: 'D1', type: tipo, x1: 10, y1: 100, x2: 60, y2: 101, color: '#888888', lineWidth: 1,
    dashed: false, dotted: false, opacity: 1, buckets: 24, upColor: '#00ff00', downColor: '#e05b64',
    barSizePct: 500, extendRight: false, levels: newFibLevels(), opts: newFibOpts(),
    // I due punti veri: il disegno sul grafico li vuole (p1/p2 con tempo e prezzo) e senza di loro
    // draw() si ferma cercando "time" - un errore che non c'entra con quello che si sta misurando.
    p1: {time: t0 + 10 * 60000, price: 100}, p2: {time: t0 + 60 * 60000, price: 101},
    band1Enabled: true, band1Mult: 1.5, band1Color: '#3ea6ff', band1Width: 2};
  drawings.push(d);
  selectedDrawing = d;
  return d.id;
};

const TUTTI = ['fbtDrawingTemplates_v1', 'fbtFibTemplates_v1', 'fbtVpTemplates_v1'];

async function scriviNome(pagina, nome) {
  const input = pagina.locator('[data-role="input"]');
  await input.waitFor({state: 'visible', timeout: 5000});
  await input.fill(nome);
  await pagina.locator('[data-role="ok"]').click();
  await pagina.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// 1. LA BARRA LATERALE ELENCA SOLO LINEE E RETTANGOLI
// ---------------------------------------------------------------------------
test('il menu laterale "Modello" elenca solo linee e rettangoli, non Fibonacci ne profili', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async ([chiavi]) => {
      for (const k of chiavi) { try { localStorage.removeItem(k); } catch (e) {} }
      const salva = async (d, nome) => {
        window.chiediNomeModello = async () => ({nome, sovrascrivi: false});
        selectedDrawing = d;
        return await saveCurrentDrawingAsTemplate();
      };
      await salva({type: 'line', color: '#fff', lineWidth: 2, x1: 0, y1: 0, x2: 10, y2: 10}, 'LA MIA LINEA');
      await salva({type: 'rectangle', color: '#fff', lineWidth: 2, x1: 0, y1: 0, x2: 10, y2: 10, fillColor: '#fff', fillOpacity: .1}, 'IL MIO RETTANGOLO');
      await salva({type: 'fib', color: '#fff', lineWidth: 2, x1: 0, y1: 0, x2: 10, y2: 10, levels: newFibLevels(), opts: newFibOpts()}, 'IL MIO FIB');
      await salva({type: 'vpfixed', color: '#888', lineWidth: 1, x1: 0, y1: 0, x2: 10, y2: 10, buckets: 30, upColor: '#00ff00', downColor: '#e05b64'}, 'IL MIO PROFILO');
      await salva({type: 'vwap', color: '#3ea6ff', lineWidth: 2, x1: 0, y1: 0, x2: 10, y2: 10, band1Mult: 2}, 'IL MIO VWAP');
      renderDrawTemplateMenu();
      const testo = (id) => { const el = document.getElementById(id); return el ? el.textContent : 'ASSENTE'; };
      return {
        laterale: testo('drawTemplateList'),
        fib: Object.keys(loadFibTemplates()),
        vp: Object.keys(loadVpTemplates())
      };
    }, [TUTTI]);

    assert.ok(r.laterale.includes('LA MIA LINEA'), 'la linea deve comparire: ' + JSON.stringify(r.laterale));
    assert.ok(r.laterale.includes('IL MIO RETTANGOLO'), 'il rettangolo deve comparire: ' + JSON.stringify(r.laterale));
    assert.ok(!r.laterale.includes('IL MIO FIB'),
      'il modello Fibonacci NON deve comparire nel menu laterale (ha il suo «Modello Fib»): ' + JSON.stringify(r.laterale));
    assert.ok(!r.laterale.includes('IL MIO PROFILO'),
      'il modello del profilo NON deve comparire nel menu laterale: ' + JSON.stringify(r.laterale));
    assert.ok(!r.laterale.includes('IL MIO VWAP'),
      'il modello del VWAP NON deve comparire nel menu laterale: ' + JSON.stringify(r.laterale));
    assert.deepEqual(r.fib, ['IL MIO FIB'], 'il Fibonacci deve stare nel suo cassetto: ' + JSON.stringify(r.fib));
    assert.ok(r.vp.includes('IL MIO PROFILO') && r.vp.includes('IL MIO VWAP'),
      'profili e VWAP devono stare nel cassetto dei profili: ' + JSON.stringify(r.vp));
  } finally { await browser.close(); }
  assert.deepEqual(errori, []);
});

// ---------------------------------------------------------------------------
// 2. IL MODELLO DEL PROFILO SALVA QUELLO CHE SI VEDE NEI CAMPI
//    (anche se non si e' ancora premuto Ok: il pulsante e' li' dentro)
// ---------------------------------------------------------------------------
test('il modello del profilo salva i valori appena scritti nei campi, senza dover premere Ok', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENA, 'vpfixed');
    await pagina.evaluate(() => {
      openVpSettingsModal(selectedDrawing);
      document.getElementById('vpBuckets').value = '99';
      document.getElementById('vpUpColor').value = '#0000ff';
      document.getElementById('vpLvnThreshold').value = '42';
    });
    await pagina.click('#vpTemplateSaveAs');
    await scriviNome(pagina, 'PROFILO EDITATO');
    const r = await pagina.evaluate(() => {
      const t = loadVpTemplates()['PROFILO EDITATO'] || null;
      return t ? {buckets: t.buckets, upColor: String(t.upColor).toLowerCase(), lvnThresholdPct: t.lvnThresholdPct} : null;
    });
    assert.ok(r, 'il modello deve esistere nel cassetto dei profili');
    assert.equal(r.buckets, 99, 'le barre devono essere quelle appena scritte (99), non quelle di prima: ' + JSON.stringify(r));
    assert.equal(r.upColor, '#0000ff', 'e il colore appena scelto, non quello vecchio: ' + JSON.stringify(r));
    assert.equal(r.lvnThresholdPct, 42, 'e la soglia appena scritta: ' + JSON.stringify(r));
  } finally { await browser.close(); }
  assert.deepEqual(errori, []);
});

test('il modello del VWAP salva la banda appena scritta nei campi, senza dover premere Ok', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENA, 'vwap');
    await pagina.evaluate(() => {
      openVpSettingsModal(selectedDrawing);
      document.getElementById('vpBand1Mult').value = '9.5';
      document.getElementById('vpBand2Enabled').checked = true;
    });
    await pagina.click('#vpTemplateSaveAs');
    await scriviNome(pagina, 'VWAP EDITATO');
    const r = await pagina.evaluate(() => {
      const t = loadVpTemplates()['VWAP EDITATO'] || null;
      return t ? {band1Mult: t.band1Mult, band2Enabled: t.band2Enabled, type: t.type} : null;
    });
    assert.ok(r, 'il modello deve esistere');
    assert.equal(r.type, 'vwap', 'deve ricordare di essere un VWAP');
    assert.equal(r.band1Mult, 9.5, 'la banda appena scritta (9.5) deve finire nel modello: ' + JSON.stringify(r));
    assert.equal(r.band2Enabled, true, 'e la banda 2 accesa: ' + JSON.stringify(r));
  } finally { await browser.close(); }
  assert.deepEqual(errori, []);
});

// ---------------------------------------------------------------------------
// 3. I MODELLI FINITI NEL CASSETTO SBAGLIATO VENGONO RECUPERATI
//    (i giorni di tentativi hanno lasciato modelli in memorie vecchie)
// ---------------------------------------------------------------------------
test('un modello Fibonacci lasciato nel cassetto dei disegni torna nel suo, con il tipo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      for (const k of ['fbtDrawingTemplates_v1', 'fbtFibTemplates_v1', 'fbtVpTemplates_v1']) { try { localStorage.removeItem(k); } catch (e) {} }
      // Come li scriveva la strada generica prima del 18 novembre: senza `type`, con levels/opts.
      localStorage.setItem('fbtDrawingTemplates_v1', JSON.stringify({
        'VECCHIO FIB': {color: '#fff', lineWidth: 2, levels: [{value: 0.5, enabled: true, color: '#fff'}], opts: {trendline: true}}
      }));
      fblRiparaCassettiModelli();
      return {
        disegni: Object.keys(loadDrawingTemplates()),
        fib: Object.keys(loadFibTemplates()),
        tipo: (loadFibTemplates()['VECCHIO FIB'] || {}).type
      };
    });
    assert.deepEqual(r.disegni, [], 'il cassetto dei disegni deve restare per linee e rettangoli: ' + JSON.stringify(r.disegni));
    assert.deepEqual(r.fib, ['VECCHIO FIB'], 'il modello deve tornare nel cassetto Fibonacci: ' + JSON.stringify(r.fib));
    assert.equal(r.tipo, 'fib', 'e gli va dato il tipo che gli mancava, altrimenti non si applica');
  } finally { await browser.close(); }
  assert.deepEqual(errori, []);
});

test('un profilo e un VWAP lasciati nel cassetto dei disegni tornano nel loro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      for (const k of ['fbtDrawingTemplates_v1', 'fbtFibTemplates_v1', 'fbtVpTemplates_v1']) { try { localStorage.removeItem(k); } catch (e) {} }
      // Un profilo senza `type`, riconoscibile dai suoi campi, e un VWAP col tipo.
      localStorage.setItem('fbtDrawingTemplates_v1', JSON.stringify({
        'VECCHIO PROFILO': {color: '#888', lineWidth: 1, buckets: 150, upColor: '#26a69a', pocEnabled: true},
        'VECCHIO VWAP': {type: 'vwap', color: '#3ea6ff', lineWidth: 2, band1Mult: 3}
      }));
      fblRiparaCassettiModelli();
      return {
        disegni: Object.keys(loadDrawingTemplates()),
        vp: Object.keys(loadVpTemplates()),
        tipoProfilo: (loadVpTemplates()['VECCHIO PROFILO'] || {}).type
      };
    });
    assert.deepEqual(r.disegni, [], 'niente profili nel cassetto dei disegni: ' + JSON.stringify(r.disegni));
    assert.deepEqual(r.vp.sort(), ['VECCHIO PROFILO', 'VECCHIO VWAP'], 'devono stare nel cassetto dei profili: ' + JSON.stringify(r.vp));
    assert.equal(r.tipoProfilo, 'vpfixed', 'al profilo senza tipo va dato quello a intervallo fisso, che era il predefinito');
  } finally { await browser.close(); }
  assert.deepEqual(errori, []);
});

// ---------------------------------------------------------------------------
// 3-bis. UN NOME DI UN MODELLO DI PROFILO OCCUPA IL NOME IN TUTTO IL PROGRAMMA
//    (la regola del proprietario e' «il nome e' unico»: vale anche per i profili)
// ---------------------------------------------------------------------------
test('un nome gia usato da un modello di profilo chiede la sovrascrittura e viene sostituito', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      for (const k of ['fbtDrawingTemplates_v1', 'fbtFibTemplates_v1', 'fbtVpTemplates_v1']) { try { localStorage.removeItem(k); } catch (e) {} }
      saveVpTemplates({'ZONA MIA': {type: 'vpfixed', buckets: 30}});
      const dove = nomeModelloGiaUsato('ZONA MIA');
      const neiSuggerimenti = nomiModelliGiaUsati().some(v => v.nome === 'ZONA MIA');
      eliminaModelloOmonimo('ZONA MIA');
      return {
        dove,
        neiSuggerimenti,
        dopoDisegni: Object.keys(loadDrawingTemplates()),
        dopoFib: Object.keys(loadFibTemplates()),
        dopoVp: Object.keys(loadVpTemplates())
      };
    });
    assert.ok(r.dove, 'il nome di un modello di profilo deve risultare gia usato: ' + JSON.stringify(r.dove));
    assert.ok(String(r.dove.dove).toLowerCase().includes('modelli'),
      'e deve dire dove si trova, cosi la domanda di sovrascrittura ha senso: ' + JSON.stringify(r.dove));
    assert.equal(r.neiSuggerimenti, true, 'il nome deve comparire fra quelli suggeriti mentre si scrive');
    assert.deepEqual(r.dopoVp, [], 'la sovrascrittura deve togliere il vecchio modello dal cassetto dei profili');
  } finally { await browser.close(); }
  assert.deepEqual(errori, []);
});

// ---------------------------------------------------------------------------
// 4. IL «PREDEFINITO» DENTRO OGNI PANNELLO
// ---------------------------------------------------------------------------
test('il pannello del profilo ha «Predefinito» e riporta lo strumento alle impostazioni di fabbrica', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENA, 'vpfixed');
    await pagina.evaluate(() => {
      const d = selectedDrawing;
      d.buckets = 999; d.upColor = '#ff00ff'; d.lvnThresholdPct = 77; d.pocEnabled = false;
      openVpSettingsModal(d);
    });
    const pulsante = await pagina.evaluate(() => !!document.getElementById('vpTemplateReset'));
    assert.equal(pulsante, true, 'manca il pulsante «Predefinito» nel pannello del profilo');
    await pagina.click('#vpTemplateReset');
    await pagina.waitForTimeout(300);
    const r = await pagina.evaluate(() => {
      const d = selectedDrawing;
      return {buckets: d.buckets, upColor: String(d.upColor).toLowerCase(), lvnThresholdPct: d.lvnThresholdPct,
        pocEnabled: d.pocEnabled, campoBarre: document.getElementById('vpBuckets').value};
    });
    assert.equal(r.buckets, 200, 'le barre devono tornare al predefinito 200: ' + JSON.stringify(r));
    assert.equal(r.campoBarre, '200', 'e il campo deve mostrarlo: ' + JSON.stringify(r));
    assert.equal(r.lvnThresholdPct, 15, 'la soglia di fabbrica e 15: ' + JSON.stringify(r));
    assert.equal(r.pocEnabled, true, 'il POC torna acceso come di fabbrica: ' + JSON.stringify(r));
  } finally { await browser.close(); }
  assert.deepEqual(errori, []);
});

test('il pannello del VWAP ha «Predefinito» e riporta le bande di fabbrica', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENA, 'vwap');
    await pagina.evaluate(() => {
      const d = selectedDrawing;
      d.band1Mult = 9; d.band2Enabled = true; d.band3Enabled = true; d.color = '#ff00ff';
      openVpSettingsModal(d);
    });
    assert.equal(await pagina.evaluate(() => !!document.getElementById('vpTemplateReset')), true,
      'manca il pulsante «Predefinito» nel pannello del VWAP');
    await pagina.click('#vpTemplateReset');
    await pagina.waitForTimeout(300);
    const r = await pagina.evaluate(() => {
      const d = selectedDrawing;
      return {band1Mult: d.band1Mult, band2Enabled: d.band2Enabled, band3Enabled: d.band3Enabled};
    });
    assert.equal(r.band1Mult, 1, 'la banda 1 deve tornare a 1: ' + JSON.stringify(r));
    assert.equal(r.band2Enabled, false, 'la banda 2 deve tornare spenta: ' + JSON.stringify(r));
    assert.equal(r.band3Enabled, false, 'la banda 3 deve tornare spenta: ' + JSON.stringify(r));
  } finally { await browser.close(); }
  assert.deepEqual(errori, []);
});

test('il pannello dello stile del disegno ha «Predefinito» e riporta lo stile di fabbrica', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENA, 'line');
    await pagina.evaluate(() => {
      // Il disegno resta fuori dall'elenco: qui si misura il PANNELLO, non il disegno sul grafico,
      // e un disegno finto senza i punti veri farebbe fallire draw() per un motivo che non c'entra.
      const d = selectedDrawing;
      drawings = [];
      d.color = '#ff00ff'; d.lineWidth = 8; d.dashed = true; d.opacity = .3; d.text = 'PROVA';
      openDrawStyleModal(d);
    });
    assert.equal(await pagina.evaluate(() => !!document.getElementById('drawStyleModalDefaultBtn')), true,
      'manca il pulsante «Predefinito» nel pannello dello stile');
    await pagina.click('#drawStyleModalDefaultBtn');
    await pagina.waitForTimeout(300);
    const r = await pagina.evaluate(() => {
      const d = selectedDrawing;
      return {lineWidth: d.lineWidth, dashed: d.dashed, opacity: d.opacity, testo: d.text,
        campoSpessore: document.getElementById('dsWidth').value};
    });
    assert.equal(r.lineWidth, 2, 'lo spessore torna a 2: ' + JSON.stringify(r));
    assert.equal(r.dashed, false, 'la linea torna continua: ' + JSON.stringify(r));
    assert.equal(r.opacity, 1, 'l\'opacita torna piena: ' + JSON.stringify(r));
    assert.equal(r.testo, '', 'il testo aggiunto si svuota: ' + JSON.stringify(r));
    assert.equal(r.campoSpessore, '2', 'e il campo lo mostra: ' + JSON.stringify(r));
  } finally { await browser.close(); }
  assert.deepEqual(errori, []);
});

test('il pannello dell\'indicatore ha «Predefinito» e riporta i parametri di fabbrica', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async () => {
      const chiave = Object.keys(INDICATOR_DEFS)[0];
      const def = INDICATOR_DEFS[chiave];
      const fabbrica = def.defaultParams();
      const ind = {id: 'IND1', key: chiave, params: JSON.parse(JSON.stringify(fabbrica)), calc: {serie: null, builtTo: -1}};
      // Si sporca OGNI parametro numerico: cosi' la prova non dipende da quale indicatore capita.
      for (const k of Object.keys(ind.params)) {
        if (typeof ind.params[k] === 'number') ind.params[k] = ind.params[k] + 17;
        else if (typeof ind.params[k] === 'boolean') ind.params[k] = !ind.params[k];
      }
      activeIndicators = [ind];
      openIndicatorSettingsModal(ind);
      const c = document.getElementById('indPresetDefaultBtn');
      if (!c) return {manca: true};
      c.click();
      await new Promise(r => setTimeout(r, 100));
      const uguali = {};
      for (const k of Object.keys(fabbrica)) uguali[k] = ind.params[k] === fabbrica[k];
      return {manca: false, uguali};
    });
    assert.equal(r.manca, false, 'manca il pulsante «Predefinito» nel pannello dell\'indicatore');
    const diversi = Object.keys(r.uguali).filter(k => !r.uguali[k]);
    assert.deepEqual(diversi, [], 'dopo «Predefinito» i parametri devono essere quelli di fabbrica: diversi ' + JSON.stringify(diversi));
  } finally { await browser.close(); }
  assert.deepEqual(errori, []);
});
