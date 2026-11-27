// IL MOTORE OSSERVA, REGISTRA E SI SOSPENDE DA SOLO (v2.2.123, 27 novembre 2026).
//
// Proposto da Claude e approvato dal proprietario («Sì, procedi») dopo la sua domanda «non so se
// effettivamente sia in funzione questa cosa o meno». Tre cose:
//  1. OSSERVAZIONE: ogni segnale diventa un'operazione "in ombra" seguita sulle candele chiuse
//     (lo stop vince il pareggio, break-even dalla candela dopo, costi 0,20 $), senza ordini;
//  2. REGISTRO: ogni segnale con il suo esito e il motivo, e lo stato dell'ultimo giro;
//  3. SOSPENSIONE: dopo 10 R di calo nelle operazioni osservate la regola smette di aprire,
//     finche' non si preme «Riprendi».
// Stesso banco del motore (motore_aperture_sottofondo.test.mjs): regola finta, candele finte,
// ordini finti. Nessuna rete.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = `
  const t0 = Date.UTC(2026, 10, 25, 8, 0, 0);
  baseRows = [];
  for (let i = 0; i < 300; i++) { const c = 4000 + Math.sin(i / 9) * 2;
    baseRows.push({date: new Date(t0 + i * 60000).toISOString(), open: c, high: c + 0.6, low: c - 0.6, close: c, volume: 10}); }
  currentTF = 30; rows = aggregateRows(baseRows, 30); idx = rows.length - 1; viewEnd = idx; currentAssetKey = 'XAUUSD';
  mt5ActiveSymbol = 'XAUUSD'; fblMotoreSerie = {}; fblMotoreUltimaBase = null; fblMotoreInCorso = false;
  fblMotoreCaricaSerie = async (tf, quante) => aggregateRows(baseRows, tf).map(r => ({...r}));
  liveModeActive = true; liveReplayActive = false; mt5Connected = true;
  mt5AccountInfo = {reale: false, equity: 10000, balance: 10000, margin_free: 10000};
  positions.length = 0; trades.length = 0; equity = [10000]; if ($('capital')) $('capital').value = '10000';
  fblAutoApertureFatte = null;
  for (const k of ['fbl_auto_aperture', 'fbl_motore_auto', 'fbl_motore_ombra', 'fbl_motore_registro']) localStorage.removeItem(k);
  window.__ordini = [];
  placeRealMt5Order = async (side, forz) => {
    __ordini.push({side, sl: forz.sl, tp: forz.tp});
    const ticket = 800000 + __ordini.length;
    positions.push(Object.assign({id: Date.now() + Math.random(), asset: forz.sym, side, entry: forz.prezzo,
      sl: forz.sl, tp: forz.tp, mt5Ticket: ticket}, forz.meta || {}));
    return ticket;
  };
  syncMt5PositionLevels = async () => {};
  // Indicatore finto: un long sulla candela window.__barra, stop 2 dollari sotto la chiusura.
  INDICATOR_DEFS.__finto = {label: 'finto', defaultParams: () => ({}), compute(r, upTo, ind) {
    const st = ind.calc; if (!st.trades) st.trades = [];
    if (upTo === window.__barra && !st.trades.some(t => t.bar === upTo))
      st.trades.push({dir: 1, bar: upTo, stop: r[upTo].close - 2});
  }, render() {}};
  FBL_MOTORE_REGOLE.length = 0;
  FBL_MOTORE_REGOLE.push({id: '__finto', key: '__finto', nome: 'Finto', tf: 5, obiettivoR: 3, be: null, segnale: 'triangoli', verifica: 'prova'});
  for (const k of Object.keys(fblMotoreStati)) delete fblMotoreStati[k];
  const agg = aggregateRows(baseRows, 5); const chiuse5 = agg.slice(0, agg.length - 1);
  window.__barra = chiuse5.length - 1;
  // Aggiunge minuti: la candela a 5 minuti che li contiene si chiude, piu' una in formazione.
  window.__minuti = (alto, basso) => {
    const ultima = baseRows[baseRows.length - 1]; let t = Date.parse(ultima.date) + 60000; const c = ultima.close;
    baseRows.push({date: new Date(t).toISOString(), open: c, high: alto, low: basso, close: c, volume: 10});
    for (let j = 1; j <= 10; j++) baseRows.push({date: new Date(t + j * 60000).toISOString(), open: c, high: c + 0.1, low: c - 0.1, close: c, volume: 10});
  };
`;

test('apertura spenta: il segnale NON apre ma viene osservato e registrato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      await fblMotoreAutoGiro(true);
      return {ordini: __ordini.length, registro: fblMotoreRegistroDi('__finto'), ombra: fblMotoreOmbraDi('__finto'),
              giro: fblMotoreUltimoGiro.testo};
    })()`);
    assert.equal(r.ordini, 0, 'con l apertura spenta non parte nessun ordine');
    assert.equal(r.registro.length, 1, 'un segnale, una voce di registro: ' + JSON.stringify(r.registro));
    assert.equal(r.registro[0].esito, 'osservato');
    assert.equal(r.ombra.length, 1);
    assert.equal(r.ombra[0].stato, 'aperta');
    assert.match(r.giro, /^girato: 1 regole calcolate \(0 possono aprire/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un segnale osservato NON si apre in ritardo se si accende l apertura dopo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      await fblMotoreAutoGiro(true);                 // osservato
      fblMotoreSalvaConfig({__finto: true});        // poi si accende l'apertura
      await fblMotoreAutoGiro(true);
      return {ordini: __ordini.length, registro: fblMotoreRegistroDi('__finto').map(v => v.esito)};
    })()`);
    assert.equal(r.ordini, 0, 'entrare piu tardi del segnale sarebbe un altra operazione');
    assert.deepEqual(r.registro, ['osservato']);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l operazione osservata si chiude all obiettivo: +3 R meno i costi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      await fblMotoreAutoGiro(true);
      const o = fblMotoreOmbraDi('__finto')[0];
      __minuti(o.tp + 0.5, o.entry - 0.5);               // tocca l'obiettivo, non lo stop
      await fblMotoreAutoGiro(true);
      return {o: fblMotoreOmbraDi('__finto')[0], st: fblMotoreStatistiche('__finto')};
    })()`);
    assert.equal(r.o.stato, 'chiusa');
    assert.equal(r.o.uscita, 'obiettivo');
    assert.ok(Math.abs(r.o.R - (3 - 0.2 / 2)) < 1e-9, 'R = 3 - 0,20/2: ' + r.o.R);
    assert.equal(r.st.chiuse, 1); assert.equal(r.st.vinte, 1);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nella stessa candela stop e obiettivo: vince lo stop, come nella ricerca', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      await fblMotoreAutoGiro(true);
      const o = fblMotoreOmbraDi('__finto')[0];
      __minuti(o.tp + 0.5, o.stop - 0.5);
      await fblMotoreAutoGiro(true);
      return fblMotoreOmbraDi('__finto')[0];
    })()`);
    assert.equal(r.uscita, 'stop');
    assert.ok(Math.abs(r.R - (-1 - 0.2 / 2)) < 1e-9, 'R = -1 - 0,20/2: ' + r.R);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('apertura accesa ma bloccata da una guardia: il registro dice PERCHE', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      // conto REALE, interruttore reale acceso, ma due posizioni automatiche reali gia aperte
      mt5AccountInfo.reale = true;
      fblMotoreSalvaConfig({'__finto@reale': true});
      positions.push({id: 1, asset: 'XAUUSD', autoContoReale: true, mt5Ticket: 1}, {id: 2, asset: 'XAUUSD', autoContoReale: true, mt5Ticket: 2});
      await fblMotoreAutoGiro(true);
      return {ordini: __ordini.length, registro: fblMotoreRegistroDi('__finto'), ombra: fblMotoreOmbraDi('__finto').length};
    })()`);
    assert.equal(r.ordini, 0);
    assert.equal(r.registro[0].esito, 'bloccato');
    assert.match(r.registro[0].motivo, /tetto/);
    assert.equal(r.ombra, 1, 'anche bloccato, il segnale si osserva');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('apertura accesa e riuscita: registro APERTO', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      fblMotoreSalvaConfig({__finto: true});
      await fblMotoreAutoGiro(true);
      return {ordini: __ordini.length, registro: fblMotoreRegistroDi('__finto')};
    })()`);
    assert.equal(r.ordini, 1);
    assert.equal(r.registro[0].esito, 'aperto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('dopo 10 R di calo la regola si SOSPENDE: non apre ma osserva; Riprendi azzera il calo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      fblMotoreSalvaConfig({__finto: true});
      // dieci operazioni osservate chiuse in perdita, gia nel magazzino
      const ombra = [];
      for (let i = 0; i < 10; i++) ombra.push({id: 'v' + i, regola: '__finto', stato: 'chiusa', R: -1.1,
        chiusa: new Date(Date.UTC(2026, 10, 20, 10, i)).toISOString(), barra: new Date(Date.UTC(2026, 10, 20, 9, i)).toISOString()});
      localStorage.setItem('fbl_motore_ombra', JSON.stringify(ombra));
      await fblMotoreAutoGiro(true);
      const sospesa = fblMotoreSospesa('__finto');
      const reg = fblMotoreRegistroDi('__finto').map(v => v.esito);
      const ordini = __ordini.length;
      fblMotoreRiprendi('__finto');
      return {sospesa, reg, ordini, dopo: fblMotoreSospesa('__finto'), caloDopo: fblMotoreStatistiche('__finto').caloOraR};
    })()`);
    assert.ok(r.sospesa, 'sospesa');
    assert.match(r.sospesa.motivo, /11\.0 R/);
    assert.equal(r.ordini, 0, 'sospesa non apre, anche con l apertura accesa');
    assert.deepEqual(r.reg, ['sospesa', 'osservato'], 'letto prima di Riprendi');
    assert.equal(r.dopo, null);
    assert.equal(r.caloDopo, 0, 'dopo Riprendi il calo si conta da capo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('fermo: il motore dice perche (non in diretta, MT5 non collegato)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      liveModeActive = false; await fblMotoreAutoGiro(true); const a = fblMotoreUltimoGiro.testo;
      liveModeActive = true; mt5Connected = false; await fblMotoreAutoGiro(true); const b = fblMotoreUltimoGiro.testo;
      return {a, b};
    })()`);
    assert.equal(r.a, 'fermo: non sei in diretta');
    assert.equal(r.b, 'fermo: MT5 non collegato');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nel pannello: casella osserva accesa di serie, numeri, registro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      for (const k of ['fbl_motore_auto', 'fbl_motore_ombra', 'fbl_motore_registro']) localStorage.removeItem(k);
      const body = document.createElement('div');
      fblMotoreAutoSezione({key: 'complex_hs'}, body);
      const oss = Array.from(body.querySelectorAll('input[data-motore-osserva]'));
      const accese = oss.map(c => c.checked);
      oss[0].checked = false; oss[0].dispatchEvent(new Event('change'));
      return {accese, ids: oss.map(c => c.dataset.motoreOsserva), spenta: fblMotoreOsserva('hs'), altra: fblMotoreOsserva('hs_retest'),
              numeri: Array.from(body.querySelectorAll('[data-motore-numeri]')).map(d => d.textContent),
              registri: body.querySelectorAll('[data-motore-registro]').length, giro: !!body.querySelector('[data-motore-giro]')};
    })()`);
    assert.deepEqual(r.ids, ['hs', 'hs_retest']);
    assert.deepEqual(r.accese, [true, true], 'osservazione accesa di serie');
    assert.equal(r.spenta, false); assert.equal(r.altra, true);
    assert.deepEqual(r.numeri, ['Osservate: nessuna operazione ancora', 'Osservate: nessuna operazione ancora']);
    assert.equal(r.registri, 2); assert.equal(r.giro, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
