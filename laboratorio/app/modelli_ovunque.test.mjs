// SALVARE, RITROVARE E CANCELLARE UN SETUP: DEVE VALERE OVUNQUE.
//
// CHIESTO DAL PROPRIETARIO (19 novembre 2026): «tutti gli indicatori si devono poter salvare e
// comparire nella lista del carica setup con il nome che abbiamo salvato. Il pulsante della
// cartella per eliminare un setup salvato deve funzionare, perche' oggi si preme ma non mostra
// nulla: deve uscire fuori la lista dei nomi salvati, dove possiamo premere il cestino per
// eliminarlo. Stessa identica cosa per il VWAP ancorato, il profilo volume a intervallo fisso e
// il profilo volume ancorato, perche' oggi non esiste la possibilita' di salvarli come modello».
//
// MISURATO PRIMA DI SCRIVERE QUESTO BANCO, sullo stato di allora:
//   - gli indicatori sono 23 e hanno TUTTI i loro parametri: salvabili tutti. Il nome salvato
//     compariva gia' nella tendina «Carica setup»;
//   - ma il pulsante accanto al salva, premuto senza prima scegliere dalla tendina, rispondeva
//     «Seleziona prima un setup dal menu da eliminare» e non mostrava NESSUNA lista;
//   - il pannello dei profili/VWAP aveva solo ✕, Indietro e Ok: nessun modo di salvare da li';
//   - linee e rettangoli (menu «Modello ⌄») e il Fibonacci (menu «Modello Fib ⌄») funzionavano
//     gia', con lista, anteprima e cestino: qui si pretende che restino cosi'.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SCENA = `(() => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++) { const p = 100 + Math.sin(i / 9);
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: p, high: p + 1, low: p - 1, close: p, volume: 10}); }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD'; rowsAssetKey = 'EURUSD';
  csvLibrary = [{id: 'mt5_live_EURUSD', rows: R}];
  try { localStorage.clear(); } catch (e) {}
  drawings = [];
  window.appConfirm = async () => true; appConfirm = window.appConfirm;
})()`;

const TESTI = `(el => el ? Array.from(el.querySelectorAll('*')).map(n => (n.textContent || '').trim()).filter(Boolean) : null)`;

test('ogni indicatore si puo salvare: hanno tutti i loro parametri', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const chiavi = Object.keys(INDICATOR_DEFS);
      const senza = chiavi.filter(k => typeof INDICATOR_DEFS[k].defaultParams !== 'function');
      return {quanti: chiavi.length, senza};
    });
    assert.ok(r.quanti > 10, 'premessa: gli indicatori devono essere parecchi, trovati ' + r.quanti);
    assert.deepEqual(r.senza, [],
      'questi indicatori non hanno parametri da salvare, quindi un setup non si potrebbe fare: ' + JSON.stringify(r.senza));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il setup salvato compare nella tendina col nome scelto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      ${SCENA};
      activeIndicators = hydrateIndicators([{id: 1, key: 'valid_bos_pullback',
        params: INDICATOR_DEFS['valid_bos_pullback'].defaultParams()}]);
      const ind = activeIndicators[0];
      openIndicatorSettingsModal(ind);
      window.appPrompt = async () => 'Setup A'; appPrompt = window.appPrompt;
      await savePresetForIndicator(ind);
      const sel = Array.from(document.querySelectorAll('#indicatorSettingsModalBody select'))
        .find(s => Array.from(s.options).some(o => /Carica setup|Nessun setup/.test(o.textContent)));
      return {voci: sel ? Array.from(sel.options).map(o => o.textContent) : null};
    })()`);
    assert.ok(r.voci && r.voci.indexOf('Setup A') >= 0,
      'il nome salvato deve comparire nella tendina: ' + JSON.stringify(r.voci));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il pulsante accanto al salva apre la LISTA dei setup, con un cestino per ciascuno', async () => {
  // E' la richiesta precisa: «si preme ma non mostra nulla... deve uscire fuori la lista dei nomi
  // salvati, dove possiamo premere il cestino per eliminarlo».
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      ${SCENA};
      activeIndicators = hydrateIndicators([{id: 1, key: 'valid_bos_pullback',
        params: INDICATOR_DEFS['valid_bos_pullback'].defaultParams()}]);
      const ind = activeIndicators[0];
      openIndicatorSettingsModal(ind);
      window.appPrompt = async () => 'Setup A'; appPrompt = window.appPrompt;
      await savePresetForIndicator(ind);
      window.appPrompt = async () => 'Setup B'; appPrompt = window.appPrompt;
      await savePresetForIndicator(ind);

      // Si preme il pulsante SENZA scegliere niente dalla tendina: deve comparire la lista.
      const bottone = Array.from(document.querySelectorAll('#indicatorSettingsModalBody button'))
        .find(b => b.textContent.indexOf('🗑') >= 0);
      if (bottone) bottone.click();
      await new Promise(r => setTimeout(r, 300));
      const lista = document.getElementById('indPresetList');
      const voci = ${TESTI}(lista);
      // Si elimina il primo col suo cestino.
      const cestino = lista ? lista.querySelector('[data-elimina="Setup A"]') : null;
      if (cestino) cestino.click();
      await new Promise(r => setTimeout(r, 300));
      return {
        bottoneCera: !!bottone,
        listaCompare: !!lista,
        voci,
        cestinoCera: !!cestino,
        rimastiInMemoria: Object.keys(loadIndicatorPresets(ind.key)),
        vociDopo: ${TESTI}(document.getElementById('indPresetList'))
      };
    })()`);

    assert.equal(r.bottoneCera, true, 'premessa: il pulsante accanto al salva deve esserci');
    assert.equal(r.listaCompare, true,
      'premendo il pulsante non compare nessuna lista dei setup salvati');
    assert.ok((r.voci || []).some(t => t.indexOf('Setup A') >= 0) && (r.voci || []).some(t => t.indexOf('Setup B') >= 0),
      'nella lista devono esserci tutti i nomi salvati: ' + JSON.stringify(r.voci));
    assert.equal(r.cestinoCera, true, 'ogni riga deve avere il suo cestino');
    assert.deepEqual(r.rimastiInMemoria, ['Setup B'], 'il cestino deve eliminare davvero quel setup');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

for (const tipo of ['vpfixed', 'vpanchor', 'vwap']) {
  test(`dal pannello di ${tipo} si salva un modello, e lo si ritrova nella sua lista`, async () => {
    const {browser, pagina, errori} = await apriApp();
    try {
      const r = await pagina.evaluate(`(async () => {
        ${SCENA};
        const d = {id: 'D1', type: ${JSON.stringify(tipo)}, x1: 10, y1: 100, x2: 60, y2: 101,
          color: '#888888', lineWidth: 1, dashed: false, dotted: false, opacity: 1,
          buckets: 24, upColor: '#00ff00', downColor: '#e05b64', barSizePct: 500};
        drawings.push(d); selectedDrawing = d;
        openVpSettingsModal(d);
        window.appPrompt = async () => 'Modello volume'; appPrompt = window.appPrompt;
        // Il pulsante per salvare dev'essere DENTRO il pannello dello strumento: e' li' che il
        // proprietario lo cerca, e li' che il messaggio del salvataggio manda a riprenderlo.
        const salva = Array.from(document.querySelectorAll('#vpModalOverlay button'))
          .find(b => /salva/i.test(b.textContent || '') || /salva/i.test(b.title || ''));
        if (salva) { salva.click(); await new Promise(r => setTimeout(r, 400)); }
        return {
          salvaCera: !!salva,
          inMemoria: Object.keys(loadVpTemplates()),
          nellaLista: ${TESTI}(document.getElementById('vpTemplateList'))
        };
      })()`);

      assert.equal(r.salvaCera, true,
        'nel pannello di questo strumento manca il pulsante per salvare un modello');
      assert.deepEqual(r.inMemoria, ['Modello volume'], 'il modello doveva finire in memoria');
      assert.ok((r.nellaLista || []).some(t => t.indexOf('Modello volume') >= 0),
        'e comparire nella lista del pannello: ' + JSON.stringify(r.nellaLista));
      assert.deepEqual(errori, []);
    } finally { await browser.close(); }
  });
}

// QUELLO CHE SALVI DEVE VEDERSI DOVE L'HAI SALVATO (19 novembre 2026).
//
// SEGNALATO: «Fibonacci non funziona manco per sogno... magari lo salvera' pure, ma non me lo fa
// vedere nella lista, per poterlo richiamare». MISURATO: un Fibonacci salvato dal menu
// «Modello ⌄» della barra finisce nel cassetto dei modelli Fibonacci e in QUEL menu non compare
// piu' (si vede solo aprendo il modulo del Fibonacci); un profilo salvato da li' sparisce allo
// stesso modo. Dal 18 novembre ogni classe ha il suo cassetto - giusto - ma nessuno mostra
// all'utente dove e' finito.
for (const caso of [
  {tipo: 'fib', nome: 'Fib salvato qui', extra: {levels: [{v: 0}, {v: 0.618}, {v: 1}], opts: {labelsPrice: true}}},
  {tipo: 'vpfixed', nome: 'Profilo salvato qui', extra: {buckets: 24, upColor: '#00ff00', downColor: '#e05b64'}},
  {tipo: 'vwap', nome: 'VWAP salvato qui', extra: {band1Enabled: true, band1Mult: 2}},
  {tipo: 'line', nome: 'Linea salvata qui', extra: {}}
]) {
  test(`un ${caso.tipo} salvato dal menu «Modello» si vede in quel menu`, async () => {
    const {browser, pagina, errori} = await apriApp();
    try {
      const r = await pagina.evaluate(`(async () => {
        ${SCENA};
        const d = Object.assign({id: 'D1', type: ${JSON.stringify(caso.tipo)}, x1: 10, y1: 100, x2: 60, y2: 104,
          color: '#888888', lineWidth: 2, dashed: false, dotted: false, opacity: 1},
          ${JSON.stringify(caso.extra)});
        drawings.push(d); selectedDrawing = d;
        window.appPrompt = async () => ${JSON.stringify(caso.nome)}; appPrompt = window.appPrompt;
        const ok = await saveCurrentDrawingAsTemplate(d);
        openDrawTemplateMenu();
        return {ok, voci: ${TESTI}(document.getElementById('drawTemplateList'))};
      })()`);

      assert.equal(r.ok, true, 'il modello doveva salvarsi');
      assert.ok((r.voci || []).some(t => t.indexOf(caso.nome) >= 0),
        'salvato dal menu «Modello», in quel menu non si vede piu: ' + JSON.stringify(r.voci));
      assert.deepEqual(errori, []);
    } finally { await browser.close(); }
  });
}

test('linee e rettangoli: il modello si salva, si vede nella lista e si cancella col cestino', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      ${SCENA};
      const linea = {id: 'L1', type: 'line', x1: 10, y1: 100, x2: 50, y2: 104, color: '#ff0000',
        lineWidth: 2, dashed: false, dotted: false, opacity: 1};
      drawings.push(linea); selectedDrawing = linea;
      window.appPrompt = async () => 'Linea A'; appPrompt = window.appPrompt;
      const ok = await saveCurrentDrawingAsTemplate(linea);
      openDrawTemplateMenu();
      const cestino = document.querySelector('#drawTemplateList .drawTemplateRowDel');
      if (cestino) cestino.click();
      await new Promise(r => setTimeout(r, 300));
      return {ok, dopoIlCestino: Object.keys(loadDrawingTemplates())};
    })()`);
    assert.equal(r.ok, true, 'il modello di una linea deve potersi salvare');
    assert.deepEqual(r.dopoIlCestino, [], 'il cestino della lista deve eliminarlo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('Fibonacci: il modello salvato si applica premendo il suo nome', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      ${SCENA};
      const fib = {id: 'F1', type: 'fib', x1: 10, y1: 100, x2: 50, y2: 104, color: '#00bcd4',
        lineWidth: 1, opacity: 1,
        levels: [{v: 0, on: true}, {v: 0.618, on: true}, {v: 1, on: true}],
        opts: {labelsPrice: true, labelsPct: false, extendRight: true}};
      drawings.push(fib); selectedDrawing = fib;
      window.appPrompt = async () => 'Fib A'; appPrompt = window.appPrompt;
      const ok = await saveCurrentDrawingAsTemplate(fib);
      // Si apre il modulo del Fibonacci e si preme il nome nella lista: i campi devono
      // prendere le impostazioni salvate.
      if (typeof openFibSettingsModal === 'function') openFibSettingsModal(fib);
      if (typeof renderFibTemplateMenu === 'function') renderFibTemplateMenu();
      const prima = document.getElementById('fibOptExtendRight') ? document.getElementById('fibOptExtendRight').checked : null;
      if (document.getElementById('fibOptExtendRight')) document.getElementById('fibOptExtendRight').checked = false;
      const riga = document.querySelector('#fibTemplateList .drawTemplateRow');
      if (riga) riga.click();
      await new Promise(r => setTimeout(r, 300));
      const dopo = document.getElementById('fibOptExtendRight') ? document.getElementById('fibOptExtendRight').checked : null;
      return {ok, inMemoria: Object.keys(loadFibTemplates()), rigaCera: !!riga, prima, dopo,
              cestino: !!document.querySelector('#fibTemplateList .drawTemplateRowDel')};
    })()`);

    assert.equal(r.ok, true, 'il modello Fibonacci deve potersi salvare');
    assert.deepEqual(r.inMemoria, ['Fib A'], 'e stare nel suo cassetto');
    assert.equal(r.rigaCera, true, 'nella lista «Modello Fib» deve comparire il nome salvato');
    assert.equal(r.cestino, true, 'con il suo cestino per eliminarlo');
    assert.equal(r.dopo, true,
      'premendo il nome, le impostazioni salvate devono tornare nei campi del modulo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
