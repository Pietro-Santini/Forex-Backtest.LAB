// LE DUE REGOLE PROVATE SUL PERIODO C, NEL MOTORE IN SOLA OSSERVAZIONE (v2.2.124, 27 novembre 2026).
//
// Trovato da Claude: le due regole che la squadra di analisti ha congelato e provato sul periodo
// mai visto (ottobre-novembre) NON erano quelle che il motore faceva girare. Nella ricerca
// (ricerca_sweep\squadra\sweep_regola.json e ifvg_regola.json):
//   - XAU Sweep v2: 15 minuti, wickMin 0,2, penMax 0,9, sessione si', bias no, obiettivo 1:3,
//     break-even a +1 R -> +0,05 R. Periodo C: PF 1,66 su 21 operazioni;
//   - Sweeps & IFVG, segnale sweep: 15 minuti, stop 1,25 ATR, obiettivo 1:4, break-even, e solo con
//     un'ombra contraria lunga almeno 1,5 volte la media delle 20 candele prima (spike>1.5x di
//     ricerca_broker.maschere / anatomia.spike). Periodo C: PF 1,15 su 98.
// Nel motore c'erano versioni precedenti (Sweep a 5 minuti 1:4 senza break-even; IFVG senza spike
// e stop 1,5 ATR). Il proprietario: «Sì, aggiungile» — in SOLA osservazione, accanto alle vecchie.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('le due regole del periodo C ci sono, sui 15 minuti, con i parametri della ricerca', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      const s = FBL_MOTORE_REGOLE.find(x => x.id === 'sweep15_c'), f = FBL_MOTORE_REGOLE.find(x => x.id === 'ifvg_spike_c');
      for (const k of Object.keys(fblMotoreStati)) delete fblMotoreStati[k];
      const p = s && fblMotoreStato(s).ind.params;
      return {s: s && {tf: s.tf, R: s.obiettivoR, be: s.be, solo: s.soloOsserva},
              f: f && {tf: f.tf, R: f.obiettivoR, be: f.be, stopAtr: f.stopAtr, filtro: f.filtro, solo: f.soloOsserva},
              p: p && {wickMin: p.wickMin, penMax: p.penMax, sessOn: p.sessOn, bias: p.bias, pivot: p.pivot},
              vecchia: fblMotoreStato(FBL_MOTORE_REGOLE.find(x => x.id === 'sweep')).ind.params.wickMin};
    })()`);
    assert.deepEqual(r.s, {tf: 15, R: 3, be: [1, 0.05], solo: true});
    assert.deepEqual(r.f, {tf: 15, R: 4, be: [1, 0.05], stopAtr: 1.25, filtro: {spike: 1.5, n: 20}, solo: true});
    assert.deepEqual(r.p, {wickMin: 0.2, penMax: 0.9, sessOn: true, bias: 'Nessuno', pivot: 5});
    assert.equal(r.vecchia, 0.45, 'la regola vecchia resta con i parametri di serie');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il filtro spike: ombra contraria almeno 1,5 volte la media delle 20 candele prima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      const reg = {filtro: {spike: 1.5, n: 20}};
      const R = [];
      // 20 candele con ombra inferiore 1 e superiore 1 (corpo fra 100 e 101)
      for (let i = 0; i < 20; i++) R.push({open: 100, close: 101, high: 102, low: 99});
      const prova = (ombraGiu, ombraSu, dir) => { const c = {open: 100, close: 101, high: 101 + ombraSu, low: 100 - ombraGiu};
        return fblMotoreFiltroOk(reg, {dir}, R.concat([c]), 20); };
      return {longSi: prova(1.5, 0, 1), longNo: prova(1.4, 5, 1), shortSi: prova(0, 1.5, -1), shortNo: prova(5, 1.4, -1),
              pocheCandele: fblMotoreFiltroOk(reg, {dir: 1}, R.slice(0, 10), 9), senzaFiltro: fblMotoreFiltroOk({}, {dir: 1}, R, 5)};
    })()`);
    assert.equal(r.longSi, true, 'long: ombra SOTTO 1,5 volte la media');
    assert.equal(r.longNo, false, 'long: conta l ombra sotto, non quella sopra');
    assert.equal(r.shortSi, true);
    assert.equal(r.shortNo, false);
    assert.equal(r.pocheCandele, false, 'meno di 20 candele prima: niente media, niente segnale');
    assert.equal(r.senzaFiltro, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('solo osservazione: non aprono anche con gli interruttori accesi, e nel pannello non hanno interruttori di apertura', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      localStorage.removeItem('fbl_motore_auto');
      fblMotoreSalvaConfig({sweep15_c: true, 'sweep15_c@reale': true});
      const reg = FBL_MOTORE_REGOLE.find(x => x.id === 'sweep15_c');
      const body = document.createElement('div');
      fblMotoreAutoSezione({key: 'xau_sweep_v2'}, body);
      return {apre: fblMotoreApreSulConto(reg, 'demo'), apreReale: fblMotoreApreSulConto(reg, 'reale'),
              vecchiaApre: fblMotoreApreSulConto(FBL_MOTORE_REGOLE.find(x => x.id === 'sweep'), 'demo'),
              apertura: Array.from(body.querySelectorAll('input[data-motore-regola]')).map(c => c.dataset.motoreRegola),
              osserva: Array.from(body.querySelectorAll('input[data-motore-osserva]')).map(c => c.dataset.motoreOsserva)};
    })()`);
    assert.equal(r.apre, false); assert.equal(r.apreReale, false);
    assert.equal(r.vecchiaApre, false, 'la vecchia, con il suo interruttore spento, non apre');
    assert.deepEqual(r.apertura, ['sweep', 'sweep@reale'], 'solo la regola vecchia ha gli interruttori di apertura');
    assert.deepEqual(r.osserva, ['sweep', 'sweep15_c']);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nel giro: un segnale senza spike viene FILTRATO e registrato, non osservato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      const t0 = Date.UTC(2026, 10, 25, 8, 0, 0);
      baseRows = [];
      // prezzi PIATTI: ogni candela a 5 minuti ha la stessa ombra, quindi il rapporto e' esattamente 1
      for (let i = 0; i < 300; i++) { const c = 4000;
        baseRows.push({date: new Date(t0 + i * 60000).toISOString(), open: c, high: c + 0.6, low: c - 0.6, close: c, volume: 10}); }
      currentTF = 30; rows = aggregateRows(baseRows, 30); idx = rows.length - 1; currentAssetKey = 'XAUUSD';
      mt5ActiveSymbol = 'XAUUSD'; fblMotoreSerie = {}; fblMotoreUltimaBase = null; fblMotoreInCorso = false;
      fblMotoreCaricaSerie = async (tf) => aggregateRows(baseRows, tf).map(x => ({...x}));
      liveModeActive = true; liveReplayActive = false; mt5Connected = true; liveSessionPhaseNow = () => 'mt5';  // mercato aperto: il banco non dipende dal giorno vero (v2.2.125)
  mt5AccountInfo = {reale: false};
      for (const k of ['fbl_motore_auto', 'fbl_motore_ombra', 'fbl_motore_registro']) localStorage.removeItem(k);
      INDICATOR_DEFS.__finto = {label: 'finto', defaultParams: () => ({}), compute(r, upTo, ind) {
        const st = ind.calc; if (!st.trades) st.trades = [];
        if (upTo === window.__barra && !st.trades.some(t => t.bar === upTo)) st.trades.push({dir: 1, bar: upTo, stop: r[upTo].close - 2});
      }, render() {}};
      FBL_MOTORE_REGOLE.length = 0;
      FBL_MOTORE_REGOLE.push({id: '__finto', key: '__finto', nome: 'Finto', tf: 5, obiettivoR: 3, be: null, segnale: 'triangoli',
        filtro: {spike: 1.5, n: 20}, soloOsserva: true, verifica: 'prova'});
      for (const k of Object.keys(fblMotoreStati)) delete fblMotoreStati[k];
      const agg = aggregateRows(baseRows, 5); window.__barra = agg.length - 2;
      await fblMotoreAutoGiro(true);
      return {registro: fblMotoreRegistroDi('__finto').map(v => [v.esito, v.motivo]), ombra: fblMotoreOmbraDi('__finto').length};
    })()`);
    // candele con ombre tutte uguali: l'ombra della candela del segnale e' pari alla media, non 1,5 volte
    assert.deepEqual(r.registro, [['filtrato', 'nessuna spike: ombra contraria sotto 1.5 volte la media di 20 candele']]);
    assert.equal(r.ombra, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
