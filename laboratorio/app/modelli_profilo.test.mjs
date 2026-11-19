// I MODELLI DEL PROFILO VOLUMETRICO DEVONO ESSERE RITROVABILI.
//
// SEGNALATO dal proprietario (18 novembre 2026): «per il fibonacci e il profilo volumetrico
// ancora non me li salva i modelli». Il Fibonacci e' stato curato quel giorno; il profilo no, e
// qui si vede perche'.
//
// MISURATO prima di scrivere questo banco:
//   - salvando un modello da un profilo, `saveVpTemplates` scrive davvero in
//     `fbtVpTemplates_v1`, e la barra di stato dice «lo trovi nelle impostazioni dello
//     strumento, in "Modelli"»;
//   - ma `loadVpTemplates()` non viene chiamata da NESSUNA parte se non dal salvataggio stesso:
//     nessuna lista li mostra, nessuna funzione li applica;
//   - e la riga che dovrebbe ridisegnare il menu, `renderVpTemplateMenu()`, chiama una funzione
//     CHE NON ESISTE - dentro un `try{...}catch(e){}` che inghiotte l'errore in silenzio.
//
// Cioe': il modello finisce in un cassetto che nessuno apre mai, e il programma dice all'utente
// di cercarlo in un posto che non c'e'. Dal suo punto di vista «non me lo salva», ed e' una
// descrizione esatta di cosa succede.
//
// LE REGOLE CHE QUESTO BANCO DIFENDE:
//   1. un modello salvato si vede nelle impostazioni dello strumento;
//   2. sceglierlo applica i suoi parametri al profilo aperto;
//   3. si puo' eliminare, e sparisce sia dalla lista sia dalla memoria;
//   4. nessuna funzione chiamata da quel percorso puo' non esistere: il `try/catch` non deve
//      coprire un errore di programmazione.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SCENA = `(() => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++) {
    const p = 100 + Math.sin(i / 9);
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: p, high: p + 1, low: p - 1, close: p, volume: 10});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD'; rowsAssetKey = 'EURUSD';
  csvLibrary = [{id: 'mt5_live_EURUSD', rows: R}];
  try { localStorage.removeItem('fbtVpTemplates_v1'); } catch (e) {}
  drawings = [];
  // Due profili: uno da cui si salva il modello, uno a cui applicarlo.
  const fatto = (id, buckets, up) => ({id, type: 'vpfixed', x1: 10, y1: 100, x2: 60, y2: 101,
    color: '#888888', lineWidth: 1, dashed: false, dotted: false, opacity: 1,
    buckets, upColor: up, downColor: '#e05b64', barSizePct: 500, extendRight: false});
  const a = fatto('A', 24, '#00ff00');
  const b = fatto('B', 200, '#55c28b');
  drawings.push(a, b);
  return {ok: true};
})()`;

test('la funzione che ridisegna la lista dei modelli del profilo deve esistere', async () => {
  // La prova piu' semplice, e quella che il try/catch vuoto nascondeva: il percorso del
  // salvataggio chiama renderVpTemplateMenu(), e se non esiste nessuno se ne accorge.
  const {browser, pagina, errori} = await apriApp();
  try {
    const tipi = await pagina.evaluate(() => ({
      render: typeof renderVpTemplateMenu,
      applica: typeof applyVpTemplate,
      elimina: typeof deleteVpTemplate
    }));
    assert.equal(tipi.render, 'function', 'renderVpTemplateMenu non esiste: la lista non si ridisegna mai');
    assert.equal(tipi.applica, 'function', 'applyVpTemplate non esiste: un modello salvato non si puo applicare');
    assert.equal(tipi.elimina, 'function', 'deleteVpTemplate non esiste: un modello salvato non si puo togliere');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il modello salvato si vede nelle impostazioni del profilo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      ${SCENA};
      const a = drawings[0], b = drawings[1];
      selectedDrawing = a;
      window.appPrompt = async () => 'Profilo mio'; appPrompt = window.appPrompt;
      window.appConfirm = async () => true; appConfirm = window.appConfirm;
      const salvato = await saveCurrentDrawingAsTemplate(a);
      openVpSettingsModal(b);
      const lista = document.getElementById('vpTemplateList');
      return {
        salvato,
        inMemoria: Object.keys(loadVpTemplates()),
        listaEsiste: !!lista,
        nellaLista: lista ? Array.from(lista.querySelectorAll('*')).map(n => n.textContent.trim()).filter(Boolean) : null
      };
    })()`);

    assert.equal(r.salvato, true, 'il salvataggio deve riuscire');
    assert.deepEqual(r.inMemoria, ['Profilo mio'], 'il modello deve stare in memoria');
    assert.equal(r.listaEsiste, true,
      'nelle impostazioni del profilo manca la lista dei modelli, ma la barra di stato dice di cercarli li');
    assert.ok((r.nellaLista || []).some(t => t.indexOf('Profilo mio') >= 0),
      'il modello salvato non compare nella lista: ' + JSON.stringify(r.nellaLista));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('sceglierlo applica i suoi parametri al profilo aperto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      ${SCENA};
      const a = drawings[0], b = drawings[1];
      selectedDrawing = a;
      window.appPrompt = async () => 'Profilo mio'; appPrompt = window.appPrompt;
      window.appConfirm = async () => true; appConfirm = window.appConfirm;
      await saveCurrentDrawingAsTemplate(a);
      const prima = {buckets: b.buckets, upColor: b.upColor};
      openVpSettingsModal(b);
      applyVpTemplate('Profilo mio');
      return {prima, dopo: {buckets: b.buckets, upColor: b.upColor}};
    })()`);

    assert.equal(r.prima.buckets, 200, 'premessa: il secondo profilo parte con parametri suoi');
    assert.equal(r.dopo.buckets, 24, 'applicando il modello, il numero di fasce deve diventare quello salvato');
    assert.equal(String(r.dopo.upColor).toLowerCase(), '#00ff00', 'e anche il colore');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('e si puo eliminare: sparisce dalla lista e dalla memoria', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      ${SCENA};
      const a = drawings[0], b = drawings[1];
      selectedDrawing = a;
      window.appPrompt = async () => 'Profilo mio'; appPrompt = window.appPrompt;
      window.appConfirm = async () => true; appConfirm = window.appConfirm;
      await saveCurrentDrawingAsTemplate(a);
      openVpSettingsModal(b);
      await deleteVpTemplate('Profilo mio');
      const lista = document.getElementById('vpTemplateList');
      return {
        inMemoria: Object.keys(loadVpTemplates()),
        nellaLista: lista ? Array.from(lista.querySelectorAll('*')).map(n => n.textContent.trim()).filter(Boolean) : null
      };
    })()`);

    assert.deepEqual(r.inMemoria, [], 'dalla memoria deve sparire');
    assert.ok(!(r.nellaLista || []).some(t => t.indexOf('Profilo mio') >= 0),
      'dalla lista deve sparire: ' + JSON.stringify(r.nellaLista));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
