// §3.3.1 — IL PROFILO DI OGNI GIORNO DEVE USARE I MINUTI DEL GIORNO GIUSTO.
//
// SINTOMO MISURATO IL 28/11/2026 (sonda laboratorio/misura_profili_serie_m1.mjs): con una serie
// M1 del magazzino ferma al 20 novembre 21:49 e candele CSV del 23-27 novembre, TUTTI i profili
// dei giorni 23, 24, 25, 26 e 27 — a 5 e a 15 minuti — venivano calcolati sugli ultimi minuti
// del 20 (5 minuti: 21:45-21:49, prezzo 1899,20-1899,81; 15 minuti: 21:35-21:49, prezzo
// 1899,20-1899,94). La serie del 27 doveva invece stare su 2039-2042,1 (minuti del 27).
//
// CAUSA MISURATA: app.html:59262 (`if(lo<s.ts[0])return null;`) guarda solo l'INIZIO del profilo.
// Un profilo ancorato il 27 passa il controllo (27 > 20) e la catena di draw() gli passa la serie
// M1 vecchia; `rowIndexNearTime` schiaccia l'indice sull'ultimo minuto del 20 e, con "tieni fermo
// il numero di candele" (vpFixedResolveRange, app.html:15137-15151), l'inizio viene tirato
// indietro. Nessun segnale: la forma e' identica ogni giorno e ogni time frame.
//
// IL BANCO MISURA IL COMPORTAMENTO, non una stringa nel sorgente: prepara i dati, percorre la
// catena REALE di draw() (fblSerieM1PerProfilo -> vpFixedResolveRange -> computeVolumeProfile) e
// legge le candele e i prezzi che escono. Due controlli evitano che il banco passi "spengendo" la
// serie M1: un profilo DENTRO il 20 deve continuare a usarla, e una serie M1 FRESCA deve essere
// usata per il 27.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Funzione AUTO-CONTENUTA, girata dentro la pagina. `mode`: 'vecchia' | 'fresca' | 'no'.
const MISURA = function (cfg) {
  const giorno = cfg.giorno, tf = cfg.tf, mode = cfg.mode;
  const prezzi = {23: 2000, 24: 2010, 25: 2020, 26: 2030, 27: 2040};

  // Serie BASE/CSV recente: 5 minuti, 23-27 novembre, un prezzo diverso per giorno.
  const base = [];
  for (const g of [23, 24, 25, 26, 27]) {
    const t0 = Date.UTC(2026, 10, g, 8, 0, 0);
    for (let i = 0; i < 12; i++) {
      const p = prezzi[g] + i * 0.1;
      base.push({date: new Date(t0 + i * 5 * 60000).toISOString(),
                 open: p, high: p + 1, low: p - 1, close: p + 0.5, volume: 100 + g});
    }
  }
  // Serie M1 VECCHIA: solo 20 novembre, prezzo ~1900.
  const vecchie = [];
  const t20 = Date.UTC(2026, 10, 20, 8, 0, 0);
  for (let i = 0; i < 830; i++) {
    const ms = t20 + i * 60000, p = 1900 + Math.sin(i / 17) * 0.5;
    vecchie.push({date: new Date(ms).toISOString(), time: Math.floor(ms / 1000),
                  open: p, high: p + 0.3, low: p - 0.3, close: p + 0.05, volume: 7 + (i % 3)});
  }
  // Serie M1 FRESCA: copre anche il 27, allo stesso prezzo delle candele del grafico.
  const fresche = [];
  for (const g of [23, 24, 25, 26, 27]) {
    const t0 = Date.UTC(2026, 10, g, 8, 0, 0);
    for (let i = 0; i < 60; i++) {
      const ms = t0 + i * 60000, p = prezzi[g] + i * 0.01;
      fresche.push({date: new Date(ms).toISOString(), time: Math.floor(ms / 1000),
                    open: p, high: p + 0.3, low: p - 0.3, close: p + 0.05, volume: 7 + (i % 3)});
    }
  }

  csvLibrary = [{name: 'recente', rows: base}];
  rebuildBaseRowsFromLibrary();
  currentAssetKey = 'XAUUSD'; rowsAssetKey = 'XAUUSD';
  liveModeActive = false; liveReplayActive = false;   // Storico/CSV: qui non c'e' MT5 a cui accodare
  currentTF = tf;
  masterTime = closeTimeOf(baseRows[baseRows.length - 1]);
  rebuildRows();

  const scelta = mode === 'vecchia' ? vecchie : (mode === 'fresca' ? fresche : null);
  fblM1Serie = scelta ? {asset: 'XAUUSD', rows: scelta, ts: fblTimestampsSerie(scelta)}
                      : {asset: null, rows: null, ts: null};

  // Profilo ancorato sul giorno richiesto (ms assoluti, come li tiene l'app).
  const t0p = Date.UTC(2026, 10, giorno, 8, 0, 0);
  const t1 = Date.UTC(2026, 10, giorno, 8, 55, 0);
  const d = {id: 'vp' + giorno, type: 'vpfixed', p1: {time: t0p, price: 0}, p2: {time: t1, price: 0},
             tfAnchor: cfg.anchor || 'candles', vpTfAnchor: cfg.anchor || 'candles',
             buckets: 24, barSizePct: 500, upColor: '#2fbf71', downColor: '#e05252',
             _vpIndBars: true, bgEnabled: false, lvnEnabled: false,
             pocEnabled: false, vahEnabled: false, valEnabled: false, extendRight: false};

  // La catena REALE di draw() (app.html 28286-28313).
  const fullTs = getRowsTimestamps();
  const serieM1 = fblSerieM1PerProfilo(d, fullTs);
  const serieProf = serieM1 ? serieM1.rows : rows;
  const tsProf = serieM1 ? serieM1.ts : fullTs;
  const idxLiveProf = serieM1 ? serieM1.idxLive : idx;
  const range = vpFixedResolveRange(d, tsProf, idxLiveProf, serieProf.length, serieM1 ? serieProf : null);
  const a = Math.min(range.aIdx, range.bIdx), b = Math.max(range.aIdx, range.bIdx);
  const prof = computeVolumeProfile(a, b, 24, serieProf);
  const iso = t => Number.isFinite(t) ? new Date(t).toISOString() : null;
  return {
    tf, giorno, mode,
    serieUsata: serieM1 ? 'M1' : 'grafico',
    candele: b - a + 1,
    primaCandela: iso(tsProf[a]), ultimaCandela: iso(tsProf[b]),
    prezzoLo: prof ? prof.priceLo : null, prezzoHi: prof ? prof.priceHi : null,
    maxTotale: prof ? Math.round(prof.maxTotal) : null
  };
};

test('con la serie M1 vecchia il profilo del 27 USA I MINUTI DEL 27, non quelli del 20', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const misure = [];
    for (const tf of [5, 15]) {
      const r = await pagina.evaluate(MISURA, {tf, giorno: 27, mode: 'vecchia'});
      console.log('M' + tf + ' 27 con M1 vecchia:', JSON.stringify(r));
      misure.push({tf, r});
    }
    for (const {tf, r} of misure) {
      assert.ok(String(r.primaCandela || '').startsWith('2026-11-27'),
        'M' + tf + ': il profilo del 27 deve partire da minuti del 27, parte da ' + r.primaCandela
        + ' (serie usata: ' + r.serieUsata + ', prezzi ' + r.prezzoLo + '-' + r.prezzoHi + ')');
      assert.ok(String(r.ultimaCandela || '').startsWith('2026-11-27'),
        'M' + tf + ': anche l\'ultima candela del profilo deve essere del 27, non ' + r.ultimaCandela);
      assert.ok(r.prezzoLo > 2038,
        'M' + tf + ': il prezzo del profilo deve essere quello del 27 (~2039-2042), non ' + r.prezzoLo);
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO: un profilo DENTRO il 20 continua a usare la serie M1 (non basta spegnerla)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(MISURA, {tf: 5, giorno: 20, mode: 'vecchia', anchor: 'time'});
    console.log('M5 20 con M1 vecchia:', JSON.stringify(r));
    assert.equal(r.serieUsata, 'M1', 'un profilo che cade dentro i dati M1 deve ancora usare la serie M1');
    assert.ok(String(r.primaCandela || '').startsWith('2026-11-20'), 'e deve usare minuti del 20');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO: con una serie M1 FRESCA il profilo del 27 usa la serie M1', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(MISURA, {tf: 5, giorno: 27, mode: 'fresca'});
    console.log('M5 27 con M1 fresca:', JSON.stringify(r));
    assert.equal(r.serieUsata, 'M1', 'una serie M1 aggiornata deve essere usata dal profilo');
    assert.ok(String(r.primaCandela || '').startsWith('2026-11-27'), 'e deve contenere minuti del 27');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
