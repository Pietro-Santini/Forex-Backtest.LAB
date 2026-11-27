// IL MOTORE DELLE APERTURE AUTOMATICHE IN SOTTOFONDO: ogni regola sul SUO timeframe.
//
// CHIESTO dal proprietario (27 novembre 2026): «le posizioni si devono aprire indifferentemente
// dal time frame che si sta guardando, fanno loro un calcolo interno in background»; «devi
// portare tutti gli indicatori».
//
// Qui si prova l'IMPIANTO con un indicatore finto che produce un segnale sulla candela che
// diciamo noi: interruttore, timeframe proprio, candela in formazione esclusa, obiettivo in R,
// niente doppioni, break-even portato su MT5, interruttore nelle impostazioni. I SEGNALI dei sette
// indicatori veri si verificano a parte, confrontandoli con la ricerca sugli stessi dati del broker.
// L'ordine non puo' partire dal banco (niente rete): un finto di placeRealMt5Order registra.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = `
  // 300 candele a 1 minuto, allineate ai 5 minuti; l'ultima e' quella in formazione.
  const t0 = Date.UTC(2026, 10, 25, 8, 0, 0);
  baseRows = [];
  for (let i = 0; i < 300; i++) { const c = 4000 + Math.sin(i / 9) * 2;
    baseRows.push({date: new Date(t0 + i * 60000).toISOString(), open: c, high: c + 0.6, low: c - 0.6, close: c, volume: 10}); }
  rows = baseRows; idx = rows.length - 1; viewEnd = idx; currentTF = 1; currentAssetKey = 'XAUUSD';
  liveModeActive = true; liveReplayActive = false; mt5Connected = true;
  mt5AccountInfo = {reale: false, equity: 10000, balance: 10000, margin_free: 10000};
  positions.length = 0; trades.length = 0; equity = [10000]; if ($('capital')) $('capital').value = '10000';
  fblAutoApertureFatte = null; localStorage.removeItem('fbl_auto_aperture'); localStorage.removeItem('fbl_motore_auto');
  window.__ordini = []; window.__modifiche = [];
  placeRealMt5Order = async (side, forz) => {
    __ordini.push({side, sl: forz.sl, tp: forz.tp, lots: forz.lots, meta: forz.meta});
    const ticket = 700000 + __ordini.length;
    positions.push(Object.assign({id: Date.now() + Math.random(), asset: forz.sym, side, entry: forz.prezzo,
      sl: forz.sl, tp: forz.tp, mt5Ticket: ticket}, forz.meta || {}));
    return ticket;
  };
  syncMt5PositionLevels = async (pos) => { __modifiche.push({sl: pos.sl}); };
  // L'indicatore finto: un "trade" long sulla candela (del SUO grafico) indicata da window.__barra.
  INDICATOR_DEFS.__finto = {label: 'finto', defaultParams: () => ({}), compute(r, upTo, ind) {
    const st = ind.calc; if (!st.trades) st.trades = [];
    if (upTo === window.__barra && !st.trades.some(t => t.bar === upTo))
      st.trades.push({dir: 1, bar: upTo, stop: r[upTo].close - 2});
  }, render() {}};
  FBL_MOTORE_REGOLE.push({id: '__finto', key: '__finto', nome: 'Finto', tf: 5, obiettivoR: 3, be: [1.5, 0.5], segnale: 'triangoli', verifica: 'prova'});
  for (const k of Object.keys(fblMotoreStati)) delete fblMotoreStati[k];
  // Il grafico a 5 minuti come lo costruisce il motore, senza la candela in formazione.
  const agg = aggregateRows(baseRows, 5); const chiuse5 = agg.slice(0, agg.length - 1);
  window.__barra = chiuse5.length - 1;      // il segnale nasce sull'ultima candela a 5 minuti CHIUSA
`;

test('spento non apre; acceso apre sul SUO timeframe (5 minuti) mentre il grafico e a 1 minuto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      fblMotoreAutoGiro(true);
      const spento = __ordini.length;
      fblMotoreSalvaConfig({__finto: true});
      fblMotoreAutoGiro(true);
      await new Promise(res => setTimeout(res, 0));
      const o = __ordini[0] || null;
      return {spento, ordini: __ordini.length, graficoTf: currentTF,
              side: o && o.side, autoTF: o && o.meta.autoTF, origin: o && o.meta.origin,
              rapporto: o ? (o.tp - positions[0].entry) / (positions[0].entry - o.sl) : null};
    })()`);
    assert.equal(r.spento, 0, 'con l interruttore spento non parte niente');
    assert.equal(r.ordini, 1, 'acceso deve aprire: ' + JSON.stringify(r));
    assert.equal(r.graficoTf, 1, 'il grafico guardato e a 1 minuto');
    assert.equal(r.autoTF, 5, 'la regola lavora sui SUOI 5 minuti');
    assert.equal(r.side, 'BUY');
    assert.equal(r.origin, 'MOTORE_AUTO');
    assert.ok(Math.abs(r.rapporto - 3) < 0.2, 'obiettivo a 3 volte il rischio: ' + r.rapporto);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un segnale, un ordine: un nuovo giro senza candela nuova non riapre', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      fblMotoreSalvaConfig({__finto: true});
      fblMotoreAutoGiro(true); fblMotoreAutoGiro(true); fblMotoreAutoGiro(false);
      return {ordini: __ordini.length};
    })()`);
    assert.equal(r.ordini, 1);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un segnale VECCHIO (nato prima dell accensione) non apre', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      window.__barra = window.__barra - 4;      // il segnale e di venti minuti fa
      fblMotoreSalvaConfig({__finto: true});
      fblMotoreAutoGiro(true);
      return {ordini: __ordini.length};
    })()`);
    assert.equal(r.ordini, 0, 'si apre solo sull ultima candela chiusa');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il break-even arriva a +1,5 R e porta lo stop a +0,5 R anche su MT5', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      fblMotoreSalvaConfig({__finto: true});
      fblMotoreAutoGiro(true);
      await new Promise(res => setTimeout(res, 0));
      const pos = positions[0]; const R = pos.autoRischio;
      // una candela a 1 minuto chiusa che arriva oltre +1,5 R
      const t = Date.parse(baseRows[baseRows.length - 1].date) + 60000;
      baseRows.push({date: new Date(t).toISOString(), open: pos.entry, high: pos.entry + 1.6 * R, low: pos.entry, close: pos.entry + R, volume: 10});
      baseRows.push({date: new Date(t + 60000).toISOString(), open: pos.entry + R, high: pos.entry + R, low: pos.entry + R, close: pos.entry + R, volume: 10});
      fblMotoreAutoGiro(false);
      return {sl: pos.sl, atteso: pos.entry + 0.5 * R, modifiche: __modifiche.length, fatto: pos.autoBeFatto};
    })()`);
    assert.equal(r.modifiche, 1, 'lo stop spostato deve arrivare a MT5');
    assert.ok(Math.abs(r.sl - r.atteso) < 1e-9, 'stop a +0,5 R: ' + JSON.stringify(r));
    assert.equal(r.fatto, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('conto reale, replay o altro asset: il motore non apre', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      fblMotoreSalvaConfig({__finto: true});
      const prova = (fn) => { __ordini.length = 0; for (const k of Object.keys(fblMotoreStati)) delete fblMotoreStati[k];
        fblAutoApertureFatte = null; localStorage.removeItem('fbl_auto_aperture');
        mt5AccountInfo.reale = false; liveReplayActive = false; currentAssetKey = 'XAUUSD'; fn(); fblMotoreAutoGiro(true); return __ordini.length; };
      return {reale: prova(() => { mt5AccountInfo.reale = true; }),
              replay: prova(() => { liveReplayActive = true; }),
              altro: prova(() => { currentAssetKey = 'EURUSD'; }),
              normale: prova(() => {})};
    })()`);
    assert.equal(r.reale, 0); assert.equal(r.replay, 0); assert.equal(r.altro, 0);
    assert.equal(r.normale, 1, 'CONTROPROVA: nelle stesse condizioni ma in regola, apre');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('gli interruttori compaiono nelle impostazioni dell indicatore, spenti, e ricordano la scelta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      localStorage.removeItem('fbl_motore_auto');
      const body = document.createElement('div');
      fblMotoreAutoSezione({key: 'complex_hs'}, body);
      const caselle = Array.from(body.querySelectorAll('input[type=checkbox]'));
      const spente = caselle.every(c => !c.checked);
      caselle[1].checked = true; caselle[1].dispatchEvent(new Event('change'));
      return {quante: caselle.length, spente, regole: caselle.map(c => c.dataset.motoreRegola),
              salvato: fblMotoreAcceso('hs_retest'), altro: fblMotoreAcceso('hs')};
    })()`);
    assert.equal(r.quante, 2, 'Complex H&S ha due regole: alla rottura e sul retest');
    assert.equal(r.spente, true, 'per difetto spente');
    assert.deepEqual(r.regole, ['hs', 'hs_retest']);
    assert.equal(r.salvato, true); assert.equal(r.altro, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
