// GLI UNDICI INDICATORI NUOVI SONO DAVVERO NEL GRAFICO (12 novembre 2026).
//
// Erano stati portati da altrettanti script Pine v6 e tenuti da parte in attesa che il lavoro sul
// resto del programma finisse. Questo banco misura che siano ARRIVATI e che FUNZIONINO, non che
// il loro codice sia presente nel sorgente: si aggiungono al grafico, si calcolano su candele
// vere, si disegnano, e il pannello delle impostazioni si apre con dei campi dentro.
//
// Perché serve una prova e non basta guardarli: un indicatore può essere registrato e poi
// esplodere al primo calcolo (una variabile mancante, una funzione dell'app che non esiste), e
// draw() inghiotte le eccezioni degli indicatori apposta, per non rompere il resto del grafico.
// Senza questa prova, un indicatore rotto resterebbe rotto in silenzio.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const NUOVI = [
  'amd_fvg_trade', 'amd_poc_trade', 'complex_hs', 'gann_method', 'mss_sweep_fib',
  'no_wick_retest', 'open10_key_levels', 'sweeps_ifvg', 'trendline_liquidity',
  'triangles', 'valid_bos_pullback',
];

// Candele vere abbastanza da far lavorare tutti: 600 da 5 minuti, con un movimento che crea
// massimi e minimi, gap e ritracciamenti (gli indicatori cercano proprio quelli).
function PREPARA(n) {
  const t0 = Date.UTC(2026, 10, 9, 0, 0, 0);
  let p = 4000; const R = [];
  for (let i = 0; i < n; i++) {
    const onda = Math.sin(i / 11) * 6 + Math.sin(i / 37) * 14;
    const o = p, c = 4000 + onda + (i % 13 === 0 ? 5 : 0);
    const hi = Math.max(o, c) + 1.5 + (i % 7);
    const lo = Math.min(o, c) - 1.5 - (i % 5);
    R.push({date: new Date(t0 + i * 300000).toISOString(), open: o, high: hi, low: lo,
            close: c, volume: 10 + (i % 23)});
    p = c;
  }
  return R;
}

test('tutti e undici si aggiungono, si calcolano e si disegnano senza rompersi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((chiavi) => {
      const t0 = Date.UTC(2026, 10, 9, 0, 0, 0);
      let p = 4000; const R = [];
      for (let i = 0; i < 600; i++) {
        const onda = Math.sin(i / 11) * 6 + Math.sin(i / 37) * 14;
        const o = p, c = 4000 + onda + (i % 13 === 0 ? 5 : 0);
        R.push({date: new Date(t0 + i * 300000).toISOString(), open: o,
                high: Math.max(o, c) + 1.5 + (i % 7), low: Math.min(o, c) - 1.5 - (i % 5),
                close: c, volume: 10 + (i % 23)});
        p = c;
      }
      rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length;
      currentAssetKey = 'XAUUSD'; currentTF = 5; visibleCount = 150;
      csvLibrary = [{id: 'prova', name: 'prova', addedAt: Date.now(), rows: R}];
      liveModeActive = false; mt5Connected = false; positions = []; pendingOrders = [];

      const esito = {};
      for (const k of chiavi) {
        const def = (typeof INDICATOR_DEFS !== 'undefined') ? INDICATOR_DEFS[k] : null;
        if (!def) { esito[k] = {registrato: false}; continue; }
        const ind = {key: k, hidden: false, params: def.defaultParams(), calc: {ref: null, builtTo: -1}};
        const voce = {registrato: true, etichetta: def.label || null};
        // 1) il calcolo, sulle candele vere
        try { def.compute(rows, idx, ind); voce.calcolo = 'ok'; voce.builtTo = ind.calc.builtTo; }
        catch (e) { voce.calcolo = 'ERRORE: ' + (e && e.message ? e.message : String(e)); }
        // 2) il disegno, con un contesto che conta le operazioni invece di dipingere
        let tratti = 0;
        const ctx = new Proxy({canvas: {width: 1200, height: 700}, globalAlpha: 1, font: '',
            fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: '', textBaseline: '',
            lineDashOffset: 0},
          {get(o, k2) {
            if (k2 in o) return o[k2];
            return (...a) => { tratti++; if (k2 === 'measureText') return {width: 40}; };
          }, set(o, k2, v) { o[k2] = v; return true; }});
        const g = (typeof chartGeometry === 'function') ? chartGeometry() : null;
        const xAbs = j => (g ? g.xLocal(j) : j * 2);
        const y = pr => (g ? g.y(pr) : 700 - (pr - 3900) * 2);
        try {
          def.render(ctx, ind, rows, Math.max(0, idx - 149), idx, xAbs, y, {l: 60, r: 70, t: 12, b: 34}, 700);
          voce.disegno = 'ok'; voce.tratti = tratti;
        } catch (e) { voce.disegno = 'ERRORE: ' + (e && e.message ? e.message : String(e)); }
        // 3) i campi del pannello
        voce.haBuildSettings = typeof def.buildSettings === 'function';
        esito[k] = voce;
      }
      return esito;
    }, NUOVI);

    const rotti = [];
    for (const k of NUOVI) {
      const v = r[k] || {};
      if (!v.registrato) { rotti.push(k + ': NON registrato in INDICATOR_DEFS'); continue; }
      if (v.calcolo !== 'ok') rotti.push(k + ' calcolo -> ' + v.calcolo);
      if (v.disegno !== 'ok') rotti.push(k + ' disegno -> ' + v.disegno);
      if (!v.etichetta) rotti.push(k + ': senza etichetta, nel menu comparirebbe vuoto');
      if (!v.haBuildSettings) rotti.push(k + ': senza buildSettings, il pannello resterebbe vuoto');
    }
    console.log('undici indicatori:', JSON.stringify(r, null, 1).slice(0, 1500));
    assert.deepEqual(rotti, [], 'indicatori che non funzionano:\n  ' + rotti.join('\n  '));
    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});

test('sono tutti nel menu, e il menu non ha due volte la stessa voce', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((chiavi) => {
      const sel = document.getElementById('indicatorSelect');
      const valori = sel ? [].slice.call(sel.options).map(o => o.value) : [];
      const mancanti = chiavi.filter(k => valori.indexOf(k) < 0);
      const doppioni = valori.filter((v, i) => v && valori.indexOf(v) !== i);
      // ogni voce del menu deve corrispondere a un indicatore che esiste davvero
      const orfane = valori.filter(v => v && !INDICATOR_DEFS[v] && v !== 'custom_script');
      return {quante: valori.length, mancanti, doppioni, orfane};
    }, NUOVI);
    assert.deepEqual(r.mancanti, [], 'indicatori registrati ma non scegliibili dal menu');
    assert.deepEqual(r.doppioni, [], 'voci ripetute nel menu');
    assert.deepEqual(r.orfane, [], 'voci di menu che non corrispondono a nessun indicatore');
  } finally { await browser.close(); }
});

test('il pannello delle impostazioni si riempie di campi, per ognuno', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((chiavi) => {
      const esito = {};
      for (const k of chiavi) {
        const def = INDICATOR_DEFS[k];
        if (!def) { esito[k] = -1; continue; }
        const ind = {key: k, hidden: false, params: def.defaultParams(), calc: {ref: null, builtTo: -1}};
        const riga = document.createElement('div');
        // gli stessi costruttori che usa rebuildIndicatorSettingsModal
        const mk = {
          mkNum: (l) => { const e = document.createElement('label'); e.textContent = l; return e; },
          mkColor: (l) => { const e = document.createElement('label'); e.textContent = l; return e; },
          mkCheck: (l) => { const e = document.createElement('label'); e.textContent = l; return e; },
          mkSelect: (l) => { const e = document.createElement('label'); e.textContent = l; return e; },
        };
        try { def.buildSettings(ind, riga, mk); esito[k] = riga.children.length; }
        catch (e) { esito[k] = 'ERRORE: ' + (e && e.message ? e.message : String(e)); }
      }
      return esito;
    }, NUOVI);
    const vuoti = NUOVI.filter(k => !(typeof r[k] === 'number' && r[k] > 0));
    console.log('campi per indicatore:', JSON.stringify(r));
    assert.deepEqual(vuoti, [],
      'indicatori il cui pannello resterebbe vuoto o va in errore: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: tornando indietro nel replay il calcolo si rifa, non resta avanti', async () => {
  // È la trappola che il progetto ha già pagato (order blocks, EMA, FVG): il calcolo è
  // incrementale e, se chi torna indietro non azzera lo stato, l'indicatore continua a mostrare
  // quello che ha visto in candele che nel replay non sono ancora arrivate: look-ahead.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((chiavi) => {
      const t0 = Date.UTC(2026, 10, 9, 0, 0, 0);
      let p = 4000; const R = [];
      for (let i = 0; i < 400; i++) {
        const o = p, c = 4000 + Math.sin(i / 9) * 8;
        R.push({date: new Date(t0 + i * 300000).toISOString(), open: o,
                high: Math.max(o, c) + 2, low: Math.min(o, c) - 2, close: c, volume: 10});
        p = c;
      }
      rows = R; baseRows = R; currentAssetKey = 'XAUUSD'; currentTF = 5;
      const esito = {};
      for (const k of chiavi) {
        const def = INDICATOR_DEFS[k];
        if (!def) continue;
        const ind = {key: k, hidden: false, params: def.defaultParams(), calc: {ref: null, builtTo: -1}};
        try {
          def.compute(R, 399, ind);          // fino in fondo
          def.compute(R, 150, ind);          // e poi INDIETRO, come il replay
          esito[k] = ind.calc.builtTo;
        } catch (e) { esito[k] = 'ERRORE: ' + (e && e.message ? e.message : String(e)); }
      }
      return esito;
    }, NUOVI);
    const avanti = NUOVI.filter(k => typeof r[k] === 'number' && r[k] > 150);
    console.log('builtTo dopo essere tornati a 150:', JSON.stringify(r));
    assert.deepEqual(avanti, [],
      'questi indicatori restano calcolati OLTRE la candela del replay (look-ahead): ' +
      JSON.stringify(r));
  } finally { await browser.close(); }
});
