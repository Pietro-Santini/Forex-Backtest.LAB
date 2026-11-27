import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// NO-WICK RETEST LEVELS: per difetto SOLO VISUALIZZAZIONE, e break-even spento.
// Si misura il COMPORTAMENTO, non il sorgente: si costruisce una serie che genera davvero un
// livello senza stoppino e il suo ritest, si fa girare compute() e si guarda cosa succede
// (quante posizioni esistono, dove sta lo stop del trade).

// Serie comune: 100 barre in salita (trend rialzista per le EMA a 1 minuto, stoppini da tutte
// e due le parti cosi' nessuna di queste crea un livello), poi:
//  - barra 100: candela rialzista SENZA stoppino inferiore -> livello long al prezzo P;
//  - barra 101: scende a toccare P e richiude sopra -> ritest, ingresso long a P;
//  - barra 102 (solo per il break-even): sale oltre la soglia ma non arriva al target.
const SERIE = `(() => {
  const t0 = Date.UTC(2026, 9, 25, 8, 0, 0);
  const base = [];
  for (let i = 0; i < 100; i++) {
    const o = 4000 + i * 2, c = o + 1;
    base.push({date: new Date(t0 + i * 60000).toISOString(), open: o, high: c + 0.5, low: o - 0.5, close: c, volume: 10});
  }
  const P = 4000 + 100 * 2;
  base.push({date: new Date(t0 + 100 * 60000).toISOString(), open: P, high: P + 3, low: P, close: P + 2, volume: 10});
  base.push({date: new Date(t0 + 101 * 60000).toISOString(), open: P + 2, high: P + 4, low: P - 1, close: P + 3, volume: 10});
  const corte = base.slice();                       // finisce sulla barra dell'ingresso
  const lunghe = base.slice();
  // Barra in avanzamento: arriva a P+1,5 — oltre la soglia del 10% verso il target (che sta a
  // circa P+4, due ATR) — senza prendere ne' il target ne' lo stop (circa P-2).
  lunghe.push({date: new Date(t0 + 102 * 60000).toISOString(), open: P + 1, high: P + 1.5, low: P + 0.5, close: P + 1.2, volume: 10});
`;

test('No-Wick: per difetto non apre niente, con l\'interruttore acceso apre in demo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(SERIE + `
      rows = corte; baseRows = rows; idx = rows.length - 1; viewEnd = idx;
      currentAssetKey = 'XAUUSD';
      liveModeActive = true; liveReplayActive = false;
      mt5Connected = true; mt5AccountInfo = {reale: false, equity: 10000, balance: 10000, margin_free: 10000};
      trades.length = 0; equity = [10000]; if ($('capital')) $('capital').value = '10000';
      // DAL 27 NOVEMBRE 2026 in diretta l'apertura automatica manda l'ORDINE VERO a MT5 demo
      // (prima creava solo una posizione simulata: vedi bos_auto_open_demo.test.mjs). Dal banco
      // l'ordine non puo' partire: un finto registra cosa riceverebbe MT5.
      window.__ordini = [];
      placeRealMt5Order = async (side, forz) => { __ordini.push({side, sl: forz.sl, tp: forz.tp}); return 900000 + __ordini.length; };

      const def = INDICATOR_DEFS.no_wick_retest;
      const giro = (acceso, reale) => {
        positions.length = 0; __ordini.length = 0;
        fblAutoApertureFatte = null; localStorage.removeItem('fbl_auto_aperture');
        mt5AccountInfo.reale = reale;
        const params = def.defaultParams();
        if (acceso !== null) params.autoOpenDemo = acceso;
        const ind = {key: 'no_wick_retest', params, calc: {}, oneMinRows: rows};
        def.compute(rows, idx, ind);
        return {posizioni: __ordini.length, ingressi: (ind.calc.events || []).length};
      };

      const perDifetto = giro(null, false);          // impostazioni di fabbrica
      const acceso = giro(true, false);              // interruttore acceso, conto demo
      const spentoAMano = giro(false, false);        // interruttore spento a mano
      const contoReale = giro(true, true);           // interruttore acceso ma conto REALE
      positions.length = 0;
      return {perDifetto, acceso, spentoAMano, contoReale, difettoAcceso: def.defaultParams().autoOpenDemo};
    })()`);

    // Il segnale esiste davvero: altrimenti il test non misurerebbe niente.
    assert.equal(r.perDifetto.ingressi, 1, 'la serie deve generare un ingresso del no-wick');
    // Per difetto: solo visualizzazione.
    assert.equal(r.difettoAcceso, false, 'autoOpenDemo deve essere falso per difetto');
    assert.equal(r.perDifetto.posizioni, 0, 'per difetto non si deve aprire niente');
    assert.equal(r.spentoAMano.posizioni, 0);
    // Conto reale: mai, nemmeno con l'interruttore acceso.
    assert.equal(r.contoReale.posizioni, 0, 'sul conto reale non si apre mai');
    // Interruttore acceso in demo: l'apertura viene richiesta.
    assert.equal(r.acceso.posizioni, 1, 'con l\'interruttore acceso deve aprire in demo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('No-Wick: break-even spento per difetto, acceso porta lo stop a pareggio oltre la soglia', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(SERIE + `
      rows = lunghe; baseRows = rows; idx = rows.length - 1; viewEnd = idx;
      currentAssetKey = 'XAUUSD';
      liveModeActive = false; liveReplayActive = false; mt5Connected = false;
      positions.length = 0; trades.length = 0;

      const def = INDICATOR_DEFS.no_wick_retest;
      const giro = (perc, pips) => {
        const params = def.defaultParams();
        if (perc !== null) { params.bePerc1 = perc; params.bePips1 = pips; }
        const ind = {key: 'no_wick_retest', params, calc: {}, oneMinRows: rows};
        def.compute(rows, idx, ind);
        const t = (ind.calc.trades || [])[0] || null;
        return t ? {entry: t.entry, stop: t.stop, target: t.target, beFatto: !!t.beFatto, chiuso: !!t.closed} : null;
      };

      return {
        difettoPerc: def.defaultParams().bePerc1,
        spento: giro(null, 0),
        acceso: giro(10, 0)
      };
    })()`);

    assert.equal(r.difettoPerc, 0, 'il break-even deve essere spento per difetto (bePerc1 = 0)');
    assert.ok(r.spento, 'il trade deve esistere');
    assert.equal(r.spento.chiuso, false, 'la barra di prova non deve chiudere il trade');
    assert.equal(r.spento.beFatto, false, 'con il break-even spento lo stop non si muove');
    assert.ok(r.spento.stop < r.spento.entry, 'lo stop di partenza sta sotto l\'entrata');
    // Acceso: superata la soglia, lo stop va esattamente a pareggio (0 pip oltre l'entrata).
    assert.equal(r.acceso.beFatto, true, 'con il break-even acceso lo stop deve andare a pareggio');
    assert.equal(r.acceso.stop, r.acceso.entry);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
