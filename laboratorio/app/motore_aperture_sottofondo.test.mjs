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
  // Il GRAFICO guardato e' a 30 minuti, la regola lavora a 5: misurato sulla sua app il 27 novembre
  // 2026, la prima stesura del motore prendeva le candele del grafico e lavorava sul timeframe sbagliato.
  currentTF = 30; rows = aggregateRows(baseRows, 30); idx = rows.length - 1; viewEnd = idx; currentAssetKey = 'XAUUSD';
  mt5ActiveSymbol = 'XAUUSD'; fblMotoreSerie = {}; fblMotoreUltimaBase = null; fblMotoreInCorso = false;
  // Le candele del motore arrivano da MT5 (fblMotoreCaricaSerie): qui un finto le costruisce dai
  // minuti di prova, COMPRESA quella in formazione, come fa il servizio dati vero.
  window.__richieste = [];
  fblMotoreCaricaSerie = async (tf, quante) => { __richieste.push(tf); return aggregateRows(baseRows, tf).map(r => ({...r})); };
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

test('spento non apre; acceso apre sul SUO timeframe (5 minuti) mentre il grafico e a 30 minuti', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      await fblMotoreAutoGiro(true);
      const spento = __ordini.length;
      fblMotoreSalvaConfig({__finto: true});
      await fblMotoreAutoGiro(true);
      await new Promise(res => setTimeout(res, 0));
      const o = __ordini[0] || null;
      return {spento, ordini: __ordini.length, graficoTf: currentTF, richieste: [...new Set(__richieste)],
              side: o && o.side, autoTF: o && o.meta.autoTF, origin: o && o.meta.origin,
              rapporto: o ? (o.tp - positions[0].entry) / (positions[0].entry - o.sl) : null};
    })()`);
    assert.equal(r.spento, 0, 'con l interruttore spento non parte niente');
    assert.equal(r.ordini, 1, 'acceso deve aprire: ' + JSON.stringify(r));
    assert.equal(r.graficoTf, 30, 'il grafico guardato e a 30 minuti');
    assert.equal(r.autoTF, 5, 'la regola lavora sui SUOI 5 minuti');
    assert.deepEqual(r.richieste, [5], 'le candele si chiedono a MT5 al timeframe della regola, non a quello del grafico');
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
      await fblMotoreAutoGiro(true); await fblMotoreAutoGiro(true); await fblMotoreAutoGiro(false);
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
      await fblMotoreAutoGiro(true);
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
      await fblMotoreAutoGiro(true);
      await new Promise(res => setTimeout(res, 0));
      const pos = positions[0]; const R = pos.autoRischio;
      // una candela a 1 minuto chiusa che arriva oltre +1,5 R
      // minuti nuovi: il primo arriva oltre +1,5 R; se ne aggiungono abbastanza da CHIUDERE la sua
      // candela a 5 minuti (il motore guarda le candele chiuse) piu' una in formazione
      let t = Date.parse(baseRows[baseRows.length - 1].date) + 60000;
      baseRows.push({date: new Date(t).toISOString(), open: pos.entry, high: pos.entry + 1.6 * R, low: pos.entry, close: pos.entry + R, volume: 10});
      for (let j = 1; j <= 10; j++) baseRows.push({date: new Date(t + j * 60000).toISOString(), open: pos.entry + R, high: pos.entry + R, low: pos.entry + R, close: pos.entry + R, volume: 10});
      await fblMotoreAutoGiro(true);
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
      const prova = async (fn) => { __ordini.length = 0; fblMotoreSerie = {}; fblMotoreUltimaBase = null; for (const k of Object.keys(fblMotoreStati)) delete fblMotoreStati[k];
        fblAutoApertureFatte = null; localStorage.removeItem('fbl_auto_aperture');
        mt5AccountInfo.reale = false; liveReplayActive = false; currentAssetKey = 'XAUUSD'; fn(); await fblMotoreAutoGiro(true); return __ordini.length; };
      return {reale: await prova(() => { mt5AccountInfo.reale = true; }),
              replay: await prova(() => { liveReplayActive = true; }),
              altro: await prova(() => { currentAssetKey = 'EURUSD'; }),
              normale: await prova(() => {})};
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
      const retest = caselle.find(c => c.dataset.motoreRegola === 'hs_retest');
      retest.checked = true; retest.dispatchEvent(new Event('change'));
      return {quante: caselle.length, spente, regole: caselle.map(c => c.dataset.motoreRegola),
              rischi: Array.from(body.querySelectorAll('input[type=number]')).map(c => [c.dataset.rischio, Number(c.value)]),
              salvato: fblMotoreAcceso('hs_retest'), altro: fblMotoreAcceso('hs')};
    })()`);
    assert.equal(r.quante, 4, 'Complex H&S: due regole, ognuna con demo e reale');
    assert.equal(r.spente, true, 'per difetto tutte spente, reale compreso');
    assert.deepEqual(r.regole, ['hs', 'hs@reale', 'hs_retest', 'hs_retest@reale']);
    assert.deepEqual(r.rischi, [['hs', 0.5], ['hs@reale', 0.25], ['hs_retest', 0.5], ['hs_retest@reale', 0.25]],
      'il rischio sta nel pannello: 0,5% demo e 0,25% reale per difetto');
    assert.equal(r.salvato, true); assert.equal(r.altro, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ------------------------------------------------------------------ IL CONTO REALE
// Richiesta del proprietario (27 novembre 2026): «rendili attivabili anche per i conti reali»,
// «tutti gli indicatori in reale», e il rischio «all'interno di ogni pannello dell'indicatore».

test('REALE: senza il suo interruttore non apre (nemmeno se la demo e accesa); con, apre al rischio del reale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      mt5AccountInfo.reale = true;
      fblMotoreSalvaConfig({__finto: true});                       // solo la demo
      await fblMotoreAutoGiro(true);
      const senza = __ordini.length;
      for (const k of Object.keys(fblMotoreStati)) delete fblMotoreStati[k];
      fblMotoreSalvaConfig({'__finto@reale': true, '__finto#rischio': 1, '__finto#rischioReale': 0.25});
      await fblMotoreAutoGiro(true);
      await new Promise(res => setTimeout(res, 0));
      const o = __ordini[0] || null;
      // il lotto atteso per 0,25% del saldo con quello stop
      const atteso = o ? scalettaLotto(positions[0].entry, o.sl, {assoluto: 0.25}).lotti : null;
      return {senza, ordini: __ordini.length, reale: o && o.meta.autoContoReale, lotti: o && o.lots, atteso};
    })()`);
    assert.equal(r.senza, 0, 'sul reale serve l interruttore reale, quello demo non basta');
    assert.equal(r.ordini, 1);
    assert.equal(r.reale, true, 'la posizione e segnata come aperta sul reale');
    assert.ok(r.lotti <= r.atteso + 1e-9, 'il lotto non supera il rischio impostato per il reale: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('REALE: conto di tipo sconosciuto, due posizioni gia aperte, tre perdite oggi: non apre', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      fblMotoreSalvaConfig({'__finto@reale': true});
      const prova = async (fn) => { __ordini.length = 0; fblMotoreSerie = {}; fblMotoreUltimaBase = null; positions.length = 0; trades.length = 0;
        for (const k of Object.keys(fblMotoreStati)) delete fblMotoreStati[k];
        fblAutoApertureFatte = null; localStorage.removeItem('fbl_auto_aperture');
        mt5AccountInfo.reale = true; fn(); await fblMotoreAutoGiro(true); return __ordini.length; };
      const oggi = new Date().toISOString();
      return {
        sconosciuto: await prova(() => { mt5AccountInfo.reale = null; }),
        dueAperte: await prova(() => { positions.push({autoContoReale: true, mt5Ticket: 1}, {autoContoReale: true, mt5Ticket: 2}); }),
        trePerdite: await prova(() => { for (let i = 0; i < 3; i++) trades.push({autoContoReale: true, pl: -10, closedAt: oggi}); }),
        perditeIeri: await prova(() => { for (let i = 0; i < 3; i++) trades.push({autoContoReale: true, pl: -10, closedAt: new Date(Date.now() - 86400000 * 2).toISOString()}); }),
        normale: await prova(() => {})
      };
    })()`);
    assert.equal(r.sconosciuto, 0, 'se non si sa che conto e, non si apre');
    assert.equal(r.dueAperte, 0, 'al massimo due posizioni automatiche insieme sul reale');
    assert.equal(r.trePerdite, 0, 'tre perdite oggi: fermo fino a domani');
    assert.equal(r.perditeIeri, 1, 'le perdite dei giorni prima non contano');
    assert.equal(r.normale, 1, 'CONTROPROVA');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('REALE: anche il pull back apre sul reale col suo interruttore, anche con la demo spenta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      mt5AccountInfo.reale = true; rows = baseRows; idx = rows.length - 1;
      const i = fblIdxPerIndicatori(), prezzo = rows[rows.length - 1].close;
      const st = () => ({ops: [{nome: 'pullback', setupId: 's1', barra: i, dir: 1, entry: prezzo, sl: prezzo - 3, tp: prezzo + 6, lotto: 0.1}]});
      bosAutoApriOpsSetup(st(), {autoOpenDemo: false}, 's1', i);
      const senza = __ordini.length;
      fblMotoreSalvaConfig({'pullback@reale': true});
      bosAutoApriOpsSetup(st(), {autoOpenDemo: false}, 's1', i);
      return {senza, con: __ordini.length};
    })()`);
    assert.equal(r.senza, 0);
    assert.equal(r.con, 1);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('REALE: accendere l interruttore chiede conferma; il rischio fuori misura non si accetta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      localStorage.removeItem('fbl_motore_auto');
      let domande = 0; appConfirm = async () => { domande++; return false; };   // risponde NO
      const body = document.createElement('div');
      fblMotoreAutoSezione({key: 'triangles'}, body);
      const reale = body.querySelector('input[data-motore-regola="triangoli@reale"]');
      reale.checked = true; reale.dispatchEvent(new Event('change'));
      await new Promise(res => setTimeout(res, 0));
      const rischio = body.querySelector('input[data-rischio="triangoli@reale"]');
      rischio.value = '50'; rischio.dispatchEvent(new Event('change'));
      const dopoErrore = Number(rischio.value);
      // (un campo numerico in un browser in inglese svuota "1,5" prima che l'app lo legga; in
      // italiano la virgola la converte il browser stesso: qui si scrive come lo riceve l'app)
      rischio.value = '1.5'; rischio.dispatchEvent(new Event('change'));
      return {domande, acceso: fblRealePermesso('triangoli'), spuntato: reale.checked, dopoErrore, salvato: fblRischio('triangoli', true)};
    })()`);
    assert.equal(r.domande, 1, 'accendere il reale chiede conferma');
    assert.equal(r.acceso, false); assert.equal(r.spuntato, false, 'detto NO, resta spento');
    assert.equal(r.dopoErrore, 0.25, 'un rischio del 50% non si accetta: torna il valore di prima');
    assert.equal(r.salvato, 1.5, 'un rischio sensato si salva');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
