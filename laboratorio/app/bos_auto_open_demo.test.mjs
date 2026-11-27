// APERTURA AUTOMATICA DEL PULL BACK (e del No-Wick, stessa funzione): ORDINE VERO SU MT5 DEMO.
//
// SEGNALATO dal proprietario (27 novembre 2026): «nel conto demo non riesce ad aprire le posizioni
// in tempo reale l'indicatore pull back valid». MISURATO sulla sua app aperta: lo short delle
// 19:28 UTC del 26 novembre era stato aperto in diretta ma con ticket MT5 vuoto - l'apertura
// automatica creava solo una posizione SIMULATA nell'app, e su MetaTrader non arrivava niente.
// Decisione del proprietario: «Sì, ordini veri in demo».
//
// Questo banco prima controllava che in diretta nascesse una posizione SIMULATA: era il
// comportamento sbagliato, misurato sulla sua app. Ora controlla che parta l'ORDINE VERO, e le
// quattro guardie che lo accompagnano. L'ordine non puo' andare a MT5 dal banco di prova (niente
// rete): placeRealMt5Order e syncMt5PositionLevels si sostituiscono con due finti che
// registrano cosa ricevono, e il finto dell'ordine fa quello che fa la funzione vera quando MT5
// risponde "eseguito": mette in positions[] una posizione con il suo ticket e i suoi metadati.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = `
  const t0 = Date.UTC(2026, 9, 25, 8, 0, 0);
  rows = []; for (let i = 0; i < 120; i++) { const c = 4000 + i * 0.1;
    rows.push({date: new Date(t0 + i * 60000).toISOString(), open: c, high: c + 0.5, low: c - 0.5, close: c, volume: 10}); }
  baseRows = rows; idx = rows.length - 1; viewEnd = idx; currentAssetKey = 'XAUUSD';
  liveModeActive = true; liveReplayActive = false; mt5Connected = true;
  mt5AccountInfo = {reale: false, equity: 10000, balance: 10000, margin_free: 10000};
  positions.length = 0; trades.length = 0; equity = [10000]; if ($('capital')) $('capital').value = '10000';
  fblAutoApertureFatte = null; localStorage.removeItem('fbl_auto_aperture');
  window.__ordini = []; window.__modifiche = [];
  placeRealMt5Order = async (side, forz) => {
    __ordini.push({side, sym: forz.sym, lots: forz.lots, sl: forz.sl, tp: forz.tp, senzaConferma: forz.senzaConferma});
    const ticket = 900000 + __ordini.length;
    positions.push(Object.assign({id: Date.now() + Math.random(), asset: forz.sym, side, entry: forz.prezzo,
      sl: forz.sl, tp: forz.tp, lots: forz.lots, mt5Ticket: ticket}, forz.meta || {}));
    return ticket;
  };
  syncMt5PositionLevels = async (pos) => { __modifiche.push({ticket: pos.mt5Ticket, sl: pos.sl, tp: pos.tp}); };
  const prezzo = rows[rows.length - 1].close;          // il prezzo di adesso
  const nuovoSetup = (barra, opz) => ({ops: [Object.assign({nome: 'pullback', setupId: 's1', barra, dir: 1,
    entry: prezzo, sl: prezzo - 3, tp: prezzo + 6, lotto: 0.1}, opz || {})]});
  const p = {autoOpenDemo: true};
`;

test('in diretta su demo parte l ORDINE VERO a MT5, senza finestra di conferma, con stop e obiettivo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      const i = fblIdxPerIndicatori();                 // la candela che la diretta calcola davvero
      const st = nuovoSetup(i);
      bosAutoApriOpsSetup(st, p, 's1', i);
      await new Promise(res => setTimeout(res, 0));
      const pos = positions[0] || null;
      return {ordini: __ordini, collegata: st.ops[0].autoPosId === (pos && pos.id),
              bosAuto: pos && pos.bosAuto, nome: pos && pos.bosNome, origine: pos && pos.origin};
    })()`);
    assert.equal(r.ordini.length, 1, 'deve partire un ordine verso MT5: ' + JSON.stringify(r));
    assert.equal(r.ordini[0].side, 'BUY');
    assert.equal(r.ordini[0].sym, 'XAUUSD');
    assert.equal(r.ordini[0].senzaConferma, true, 'l apertura automatica non puo aspettare un clic');
    assert.ok(Number.isFinite(r.ordini[0].sl), 'mai un ordine senza stop');
    assert.ok(Number.isFinite(r.ordini[0].tp));
    assert.equal(r.collegata, true, 'l operazione dell indicatore deve conoscere la sua posizione');
    assert.equal(r.bosAuto, true);
    assert.equal(r.nome, 'pullback');
    assert.equal(r.origine, 'BOS_AUTO');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('apre anche sulla candela in formazione (pull back) e su quella appena chiusa (No-Wick)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      const inFormazione = rows.length - 1, chiusa = fblIdxPerIndicatori();
      bosAutoApriOpsSetup(nuovoSetup(inFormazione, {setupId: 'a'}), p, 'a', inFormazione);
      bosAutoApriOpsSetup(nuovoSetup(chiusa, {setupId: 'b', nome: 'nowick', indicatore: 'nowick'}), p, 'b', chiusa);
      return {ordini: __ordini.length, chiusa, inFormazione};
    })()`);
    assert.equal(r.chiusa, r.inFormazione - 1, 'in diretta gli indicatori calcolano fino alla candela chiusa');
    assert.equal(r.ordini, 2, 'tutte e due le candele devono poter aprire: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le guardie: conto reale, interruttore spento, candela vecchia, stop vicino, prezzo oltre lo stop', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      const i = fblIdxPerIndicatori();
      const prova = (fn) => { __ordini.length = 0; positions.length = 0; fblAutoApertureFatte = null;
        localStorage.removeItem('fbl_auto_aperture'); mt5AccountInfo.reale = false; p.autoOpenDemo = true;
        fn(); return __ordini.length; };
      return {
        contoReale: prova(() => { mt5AccountInfo.reale = true; bosAutoApriOpsSetup(nuovoSetup(i), p, 's1', i); }),
        spento: prova(() => { p.autoOpenDemo = false; bosAutoApriOpsSetup(nuovoSetup(i), p, 's1', i); }),
        candelaVecchia: prova(() => { bosAutoApriOpsSetup(nuovoSetup(i - 3), p, 's1', i - 3); }),
        // MISURATO sulla sua app: entrata 3568,20, stop 3568,16 - quattro centesimi di rischio
        stopVicino: prova(() => { bosAutoApriOpsSetup(nuovoSetup(i, {sl: prezzo - 0.04}), p, 's1', i); }),
        oltreLoStop: prova(() => { bosAutoApriOpsSetup(nuovoSetup(i, {entry: prezzo + 5, sl: prezzo + 2, tp: prezzo + 11}), p, 's1', i); }),
        normale: prova(() => { bosAutoApriOpsSetup(nuovoSetup(i), p, 's1', i); })
      };
    })()`);
    assert.equal(r.contoReale, 0, 'sul conto reale non parte mai nulla');
    assert.equal(r.spento, 0, 'con l interruttore spento non parte nulla');
    assert.equal(r.candelaVecchia, 0, 'un segnale di tre candele fa non apre adesso');
    assert.equal(r.stopVicino, 0, 'uno stop di quattro centesimi non apre');
    assert.equal(r.oltreLoStop, 0, 'se il prezzo ha gia superato lo stop non si apre (sarebbe una posizione nuda)');
    assert.equal(r.normale, 1, 'CONTROPROVA: lo stesso segnale fatto bene apre');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('lo stesso segnale non si apre due volte, nemmeno dopo un ricalcolo completo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      const i = fblIdxPerIndicatori();
      bosAutoApriOpsSetup(nuovoSetup(i), p, 's1', i);
      await new Promise(res => setTimeout(res, 0));
      positions.length = 0;                       // la posizione si e' chiusa
      bosAutoApriOpsSetup(nuovoSetup(i), p, 's1', i);   // ricalcolo: stato nuovo, segno "tentato" perso
      fblAutoApertureFatte = null;                 // e anche un riavvio dell'app
      bosAutoApriOpsSetup(nuovoSetup(i), p, 's1', i);
      return {ordini: __ordini.length};
    })()`);
    assert.equal(r.ordini, 1, 'un segnale, un ordine: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il break-even dell indicatore arriva anche su MT5; la chiusura a stop la decide MT5', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      const i = fblIdxPerIndicatori();
      const st = nuovoSetup(i);
      bosAutoApriOpsSetup(st, p, 's1', i);
      await new Promise(res => setTimeout(res, 0));
      const op = st.ops[0];
      op.sl = op.entry + 0.1;                      // break-even
      bosSyncAutoPos(op);
      const dopoBe = positions.length;
      bosChiudiAutoPos(op, 'SL', op.sl);           // l'app NON chiude: lo fa MT5
      return {modifiche: __modifiche, rimaste: positions.length, dopoBe};
    })()`);
    assert.equal(r.modifiche.length, 1, 'lo stop spostato deve arrivare al conto MT5');
    assert.equal(r.rimaste, r.dopoBe, 'una posizione vera la chiude MT5, non il calcolo dell app');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in REPLAY resta tutto simulato: nessun ordine a MT5', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      liveReplayActive = true; replayForm = {idx: rows.length - 1};
      bosAutoApriOpsSetup(nuovoSetup(rows.length - 1), p, 's1', rows.length - 1);
      return {ordini: __ordini.length, simulate: positions.filter(x => x.bosAuto && x.mt5Ticket == null).length};
    })()`);
    assert.equal(r.ordini, 0, 'in replay nessun ordine vero');
    assert.equal(r.simulate, 1, 'in replay la posizione resta simulata, come prima');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
