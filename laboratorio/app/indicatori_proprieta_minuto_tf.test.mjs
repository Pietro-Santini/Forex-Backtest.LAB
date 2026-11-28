// §3.3.2 — INDICATORI CALCOLATI SUL MINUTO: LE STESSE PROPRIETA' A OGNI TIMEFRAME.
//
// MISURATO il 28/11/2026 con la sonda laboratorio/misura_indicatori_proprieta_minuto_tf.mjs
// (stessa serie M1 di 300 minuti, 27 novembre 08:00-12:55, M1/M5/M15 sullo stesso intervallo):
//
//   No-Wick "Trend a 1 minuto" (EMA20/EMA50 che il codice dichiara calcolate sulle barre M1):
//     M1 : emaVeloce 2013.8143260229606, emaLenta 2013.484383048887, diff +0.329943, trend NESSUNO
//     M5 : emaVeloce 2012.3739997819414, emaLenta 2008.7841467128917, diff +3.589853, trend RIALZISTA
//     M15: emaLenta = null (50 barre richieste, 20 barre a schermo) -> trend impossibile
//     M5 con oneMinRows=M1: 2013.8143260229606 / 2013.484383048887 — identico a M1.
//
//   XAU Sweep v2 (backtest dichiarato su M1): ATR 1.30 / 1.99 / 3.65, livBuy
//   2016.374878 / 2014.175672 / null, livelli 13 / 11 / 0 a M1/M5/M15. Il bias a 60 minuti
//   invece e' uguale (2004.878675753144) — non e' una differenza di fonte, e' il calcolo delle
//   proprietà sulle barre del grafico.
//
//   CONTROLLO §3.3.1 (profili): POC 2002.347016, VAH 2005.41344, VAL 2000.36286,
//   maxTotale 1109.35529166555 IDENTICI a M1/M5/M15 — la cura dei profili regge.
//
// CAUSA MISURATA (non un commento): app.html:27902 passa a `def.compute()` le sole `rows`, cioe'
// le candele del timeframe del grafico; app.html:20144 legge `ind.oneMinRows || rows`, ma
// `oneMinRows` non viene impostato da nessuna parte dell'app (solo da due banchi di prova).
// Il trend "a 1 minuto" dell'No-Wick viene quindi calcolato su 60 barre M5 (o 20 M15) invece
// che sulle 300 barre M1 dello stesso intervallo; `rowsSerie()` (app.html:13763-13790) mette
// `currentTF` nella targa, quindi il cambio timeframe azzera la cache e il valore sbagliato
// resta fino al ritorno a M1.
//
// IL BANCO MISURA IL COMPORTAMENTO: prepara la serie M1, la aggrega a M5/M15 con la funzione
// dell'app e legge i numeri che escono da compute(). Due controlli evitano il falso verde:
// il gancio `oneMinRows` dimostra che l'uguaglianza e' raggiungibile, e i profili dimostrano
// che non e' colpa della serie M1 in se'.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Serie M1 nota e Deterministica, girata dentro la pagina. Nessuna rete, nessun file.
const MISURA = function () {
  const t0 = Date.UTC(2026, 10, 27, 8, 0, 0);
  const m1 = [];
  for (let i = 0; i < 300; i++) {
    const ms = t0 + i * 60000;
    const c = 2000 + i * 0.05 + Math.sin(i / 7) * 2;
    m1.push({date: new Date(ms).toISOString(), open: c - 0.2, high: c + 0.6,
             low: c - 0.7, close: c, volume: 100 + (i % 5) * 10});
  }
  const m5 = aggregateRows(m1, 5);
  const m15 = aggregateRows(m1, 15);
  // 12:55: ultimo minuto "tondo" comune a M1 (indice 295), M5 (59) e M15 (19).
  const fine = {1: 295, 5: 59, 15: 19};
  const base = tf => {
    rows = tf === 1 ? m1 : (tf === 5 ? m5 : m15);
    baseRows = rows; currentTF = tf;
    currentAssetKey = 'XAUUSD'; rowsAssetKey = 'XAUUSD';
    liveModeActive = false; liveReplayActive = false;
    idx = rows.length - 1; viewEnd = rows.length;
    masterTime = closeTimeOf(rows[rows.length - 1]);
  };
  const nowick = (tf, conOneMin) => {
    base(tf);
    const def = INDICATOR_DEFS.no_wick_retest, params = def.defaultParams();
    const ind = {key: 'no_wick_retest', params, calc: {}};
    if (conOneMin) ind.oneMinRows = m1;
    def.compute(rows, fine[tf], ind);
    const st = ind.calc, j = st.ptr;
    const f = st.fast[j], s = st.slow[j], c = st.m[j].c;
    return {tf, barreTrend: st.m.length, oraTrend: st.m[j].t, chiusura: c,
            veloce: f, lenta: s, diff: f - s,
            rialzista: f > s && (!params.requirePricePosition || c > f),
            ribassista: f < s && (!params.requirePricePosition || c < f)};
  };
  const profilo = tf => {
    base(tf);
    fblM1Serie = {asset: 'XAUUSD', rows: m1, ts: fblTimestampsSerie(m1)};
    const d = {id: 'vp', type: 'vpfixed', p1: {time: t0, price: 0},
      p2: {time: t0 + 120 * 60000, price: 0}, tfAnchor: 'candles', vpTfAnchor: 'candles',
      buckets: 24, barSizePct: 500, bgEnabled: false, lvnEnabled: false, pocEnabled: false,
      vahEnabled: false, valEnabled: false, extendRight: false};
    const ts = getRowsTimestamps();
    const s = fblSerieM1PerProfilo(d, ts);
    const serie = s ? s.rows : rows;
    const r = vpFixedResolveRange(d, s ? s.ts : ts, s ? s.idxLive : idx, serie.length, s ? serie : null);
    const a = Math.min(r.aIdx, r.bIdx), b = Math.max(r.aIdx, r.bIdx);
    const p = computeVolumeProfile(a, b, 24, serie);
    const va = computeValueArea(p, 0.7);
    return {tf, poc: va.pocPrice, vah: va.vahPrice, val: va.valPrice, maxTotale: p.maxTotal};
  };
  return {
    m1: nowick(1, false), m5: nowick(5, false),
    m5ConM1: nowick(5, true), m15: nowick(15, false),
    profili: [profilo(1), profilo(5), profilo(15)]
  };
};

test('ROSSO: il trend a 1 minuto dell\'No-Wick deve essere lo stesso a M1 e a M5', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(MISURA);
    console.log('MISURATO M1 :', JSON.stringify(r.m1));
    console.log('MISURATO M5 :', JSON.stringify(r.m5));
    assert.equal(r.m1.barreTrend, 300, 'la serie M1 deve avere 300 minuti');
    assert.equal(r.m5.barreTrend, 60, 'la serie M5 deve avere 60 candele');
    assert.equal(r.m1.oraTrend, r.m5.oraTrend, 'le due misure devono finire nello stesso istante');
    assert.ok(Number.isFinite(r.m1.veloce) && Number.isFinite(r.m5.veloce), 'serve un EMA veloce valido');
    assert.ok(Number.isFinite(r.m1.lenta) && Number.isFinite(r.m5.lenta), 'serve un EMA lento valido');
    assert.ok(Math.abs(r.m1.veloce - r.m5.veloce) < 1e-9,
      'EMA20 a 1 minuto: M1=' + r.m1.veloce + ', M5=' + r.m5.veloce
      + ' (scarto ' + (r.m5.veloce - r.m1.veloce).toFixed(6) + ')');
    assert.ok(Math.abs(r.m1.lenta - r.m5.lenta) < 1e-9,
      'EMA50 a 1 minuto: M1=' + r.m1.lenta + ', M5=' + r.m5.lenta
      + ' (scarto ' + (r.m5.lenta - r.m1.lenta).toFixed(6) + ')');
    assert.equal(r.m5.rialzista, r.m1.rialzista,
      'il trend a 1 minuto non puo cambiare col timeframe del grafico');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO: passando le M1 il trend a M5 e identico a quello a M1', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(MISURA);
    assert.equal(r.m5ConM1.barreTrend, 60, 'con oneMinRows la mappa resta sulle 60 barre del grafico');
    assert.ok(Math.abs(r.m1.veloce - r.m5ConM1.veloce) < 1e-9);
    assert.ok(Math.abs(r.m1.lenta - r.m5ConM1.lenta) < 1e-9);
    assert.equal(r.m5ConM1.rialzista, r.m1.rialzista);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO: i profili volumetrici restano identici a M1, M5 e M15 (cura 3.3.1)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(MISURA);
    const [a, b, c] = r.profili;
    for (const k of ['poc', 'vah', 'val', 'maxTotale']) {
      assert.ok(Math.abs(a[k] - b[k]) < 1e-9, k + ' M1/M5: ' + a[k] + ' vs ' + b[k]);
      assert.ok(Math.abs(a[k] - c[k]) < 1e-9, k + ' M1/M15: ' + a[k] + ' vs ' + c[k]);
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// QUARTO BANCO — lo STESSO indicatore, prima SENZA M1 e poi con la M1 arrivata dopo.
// Misura i NUMERI che escono da compute(): non cerca una stringa nel sorgente. Copre tre
// strade: la cache che non si invalidava (2012.374 invece di 2013.814), lo slot globale
// unico che perdeva la M1 di A, e il gancio automatico che sopravviveva al cambio asset.
const CACHE_M1 = function () {
  const t0 = Date.UTC(2026, 10, 27, 8, 0, 0);
  const m1 = [];
  for (let i = 0; i < 300; i++) {
    const ms = t0 + i * 60000, c = 2000 + i * 0.05 + Math.sin(i / 7) * 2;
    m1.push({date: new Date(ms).toISOString(), open: c - 0.2, high: c + 0.6,
             low: c - 0.7, close: c, volume: 100 + (i % 5) * 10});
  }
  // Secondo asset: stessa forma, prezzo +100. Serve a distinguere con un NUMERO la M1 di A
  // da quella di B, invece di fidarsi di un controllo sul testo del codice.
  const m1B = m1.map(b => ({...b, open: b.open + 100, high: b.high + 100,
                            low: b.low + 100, close: b.close + 100}));
  const m5 = aggregateRows(m1, 5), m5B = aggregateRows(m1B, 5);
  const upToM5 = m5.length - 1;        // 59: ultima candela M5, data 12:55
  // L'ultima candela M5 comincia a quell'istante: e' l'indice 295 della M1, non il 299.
  const tUltimaM5 = new Date(m5[upToM5].date).getTime();
  const ultimoMinuto = m1.findIndex(b => new Date(b.date).getTime() === tUltimaM5);
  const base = (tf, righe, asset) => {
    rows = righe; baseRows = righe; currentTF = tf;
    currentAssetKey = asset; rowsAssetKey = asset;
    liveModeActive = true; liveReplayActive = false;  // salta il ripiego sulle barre base
    idx = righe.length - 1; viewEnd = righe.length;
    masterTime = closeTimeOf(righe[righe.length - 1]);
  };
  const def = INDICATOR_DEFS.no_wick_retest, p = def.defaultParams();
  const leggi = ind => ({veloce: ind.calc.fast[ind.calc.ptr],
                        lenta: ind.calc.slow[ind.calc.ptr],
                        barre: ind.calc.m.length});
  const ema = (serie, n) => nowickEma(serie.map(b => b.close), p.fastEma)[n];

  // (i) A a 5 minuti, senza NESSUNA M1: l'EMA e' quella delle 60 barre del grafico.
  fblM1Serie = null;
  if (fblUltimaM1Indicatore && typeof fblUltimaM1Indicatore === 'object') {
    for (const k of Object.keys(fblUltimaM1Indicatore)) delete fblUltimaM1Indicatore[k];
  } else { fblUltimaM1Indicatore = {}; }
  base(5, m5, 'XAUUSD');
  const ind = {key: 'no_wick_retest', params: p, calc: {}};
  def.compute(rows, upToM5, ind);
  const senza = leggi(ind);

  // (ii) Arriva la M1 vera, sullo STESSO ind, con le stesse rows e lo stesso upTo.
  ind.oneMinRows = m1;
  def.compute(rows, upToM5, ind);
  const con = leggi(ind);

  // (iii) M1 registrate per due asset (A poi B), poi A a 5 minuti: serve la M1 di A.
  base(1, m1, 'XAUUSD');
  def.compute(rows, ultimoMinuto, {key: 'no_wick_retest', params: p, calc: {}});
  base(1, m1B, 'EURUSD');
  def.compute(rows, ultimoMinuto, {key: 'no_wick_retest', params: p, calc: {}});
  const voci = Object.keys(fblUltimaM1Indicatore).length;
  base(5, m5, 'XAUUSD');
  const indA = {key: 'no_wick_retest', params: p, calc: {}};
  fblNoWickM1PerIndicatore(indA);       // la stessa funzione che chiama draw()
  const agganciatoA = !!indA.oneMinRows && !!indA._m1Auto;
  def.compute(rows, upToM5, indA);
  const usaA = leggi(indA);

  // (iv) Cambio asset senza serie M1 valida: il gancio automatico va staccato e l'EMA
  // deve tornare alle barre del nuovo asset, non restare su A.
  base(5, m5B, 'EURUSD');
  const indAuto = {key: 'no_wick_retest', params: p, calc: {}};
  fblNoWickM1PerIndicatore(indAuto);    // qui la M1 di EURUSD c'e'
  const agganciato = !!indAuto.oneMinRows && !!indAuto._m1Auto;
  base(5, m5B, 'USDJPY');               // asset nuovo, nessuna M1 per lui
  fblNoWickM1PerIndicatore(indAuto);
  const staccato = !Object.prototype.hasOwnProperty.call(indAuto, 'oneMinRows') && !indAuto._m1Auto;
  def.compute(rows, upToM5, indAuto);
  const dopo = leggi(indAuto);

  return {senza, con, usaA, dopo, voci, agganciatoA, agganciato, staccato,
          rifA: ema(m1, ultimoMinuto), rifB: ema(m1B, ultimoMinuto),
          emaM5: ema(m5, upToM5), emaM5B: ema(m5B, upToM5)};
};

test('M1 arrivata dopo: cache invalidata, mappa sul grafico, M1 per asset, gancio staccato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(CACHE_M1);
    console.log('MISURATO senza M1 :', JSON.stringify(r.senza));
    console.log('MISURATO con M1   :', JSON.stringify(r.con));
    console.log('MISURATO asset A  :', JSON.stringify(r.usaA));
    console.log('MISURATO nuovo asset:', JSON.stringify(r.dopo));
    console.log('RIFERIMENTI EMA  :', JSON.stringify({rifA: r.rifA, rifB: r.rifB,
      emaM5: r.emaM5, emaM5B: r.emaM5B, voci: r.voci}));
    // (i)-(ii): senza M1 si usano le barre M5; con la M1 l'EMA cambia ed e' quella M1.
    assert.ok(Math.abs(r.senza.veloce - r.emaM5) < 1e-9, 'senza M1 deve usare le barre M5');
    assert.equal(r.senza.barre, 60, 'la mappa resta sulle 60 barre del grafico');
    assert.ok(Math.abs(r.con.veloce - r.rifA) < 1e-9,
      'con la M1 l EMA deve essere quella M1: ' + r.con.veloce + ' vs ' + r.rifA);
    assert.ok(Math.abs(r.con.veloce - r.senza.veloce) > 1,
      'la cache deve invalidarsi all arrivo della M1: ' + r.senza.veloce + ' -> ' + r.con.veloce);
    assert.equal(r.con.barre, 60, 'anche con la M1 la mappa resta sul grafico');
    // (iii): A(M1) -> B(M1) -> A(M5) deve usare la M1 di A, non quella di B.
    assert.equal(r.voci, 2, 'la memoria delle M1 deve avere una voce per asset');
    assert.equal(r.agganciatoA, true, 'su A deve agganciarsi la M1 di A');
    assert.ok(Math.abs(r.usaA.veloce - r.rifA) < 1e-9, 'A a M5 deve usare la M1 di A');
    assert.ok(Math.abs(r.usaA.veloce - r.rifB) > 1, 'non deve usare la M1 di B');
    // (iv): senza M1 per il nuovo asset il gancio automatico va staccato.
    assert.equal(r.agganciato, true, 'su EURUSD la M1 c era e va agganciata');
    assert.equal(r.staccato, true, 'cambiando asset senza M1 il gancio va staccato');
    assert.ok(Math.abs(r.dopo.veloce - r.emaM5B) < 1e-9, 'dopo il cambio usa le barre del nuovo asset');
    assert.ok(Math.abs(r.dopo.veloce - r.rifA) > 1, 'non deve restare sulla M1 di A');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// QUINTO BANCO — tetto di memoria sulla mappa delle serie M1 per asset.
// Ogni voce trattiene un array intero di candele: senza limite la mappa cresce per tutta la
// sessione. Si misura lo STATO REALE della mappa dopo aver registrato piu' asset del tetto,
// non una stringa nel sorgente.
const LIMITE_M1 = function () {
  for (const k of Object.keys(fblUltimaM1Indicatore)) delete fblUltimaM1Indicatore[k];
  const t0 = Date.UTC(2026, 10, 27, 8, 0, 0);
  const nomi = [];
  for (let a = 1; a <= 9; a++) {
    const nome = 'ASSET' + a;
    const righe = [];
    for (let i = 0; i < 8; i++) {
      const ms = t0 + i * 60000;
      righe.push({date: new Date(ms).toISOString(), open: 2000, high: 2001,
                  low: 1999, close: 2000, volume: 1});
    }
    rowsAssetKey = nome;                     // la chiave che usa fblRegistraUltimaM1Indicatore
    fblRegistraUltimaM1Indicatore(righe);
    nomi.push(nome);
  }
  const possiede = nome => Object.prototype.hasOwnProperty.call(fblUltimaM1Indicatore, nome);
  const esito = {conteggio: Object.keys(fblUltimaM1Indicatore).length,
                 primoPresente: possiede(nomi[0]), ultimoPresente: possiede(nomi[nomi.length - 1])};
  for (const k of Object.keys(fblUltimaM1Indicatore)) delete fblUltimaM1Indicatore[k];
  return esito;
};

test('Memoria limitata: la mappa M1 non supera sei asset e trattiene l ultimo registrato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(LIMITE_M1);
    console.log('MISURATO voci M1 :', JSON.stringify(r));
    assert.ok(r.conteggio <= 6, 'il tetto di sei asset non va superato: ' + r.conteggio);
    assert.equal(r.conteggio, 6, 'devono restare esattamente sei asset');
    assert.equal(r.primoPresente, false, 'la voce registrata per prima deve essere stata eliminata');
    assert.equal(r.ultimoPresente, true, 'l asset registrato per ultimo deve restare in memoria');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
