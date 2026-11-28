// §3.3.1 — RAMO LIVE della cura della serie M1: in diretta i minuti nuovi arrivano dal servizio
// dati MT5 ogni 20 secondi e si accodano; se la coda non si attacca (buco), la serie si riscarica
// tutta invece di incollare un pezzo fasullo.
//
// Il banco gia' esistente (profili_serie_m1_aggiornata.test.mjs) copre solo il ramo STORICO:
// serie M1 vecchia -> ripiego sulle candele del grafico. Qui si misura il ramo LIVE percorrendo la
// funzione vera `fblSerieM1Assicura`, con `window.fetch` sostituita da una finta: la rete vera non
// viene toccata. Si legge il CONTENUTO di `fblM1Serie.rows` / `.ts`, non una stringa del sorgente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const MIN = 60000;   // anche qui: serve alle asserzioni, oltre che alla funzione girata in pagina

// Funzione AUTO-CONTENUTA, girata dentro la pagina. cfg = {live:true|false, buco:true|false}.
const MISURA = async function (cfg) {
  const MIN = 60000;
  const sec = ms => Math.floor(ms / 1000);
  // Righe in formato APP (quello che sta in fblM1Serie): `date` ISO in UTC, `time` in secondi.
  const riga = (ms, p) => ({date:new Date(ms).toISOString(), time:sec(ms),
    open:p, high:p + 0.3, low:p - 0.3, close:p + 0.05, volume:7});
  // Righe in formato MT5 (quello che arriva da /history): `time` in secondi, tick_volume.
  const grezzo = (ms, p) => ({time:sec(ms), open:p, high:p + 0.3, low:p - 0.3,
    close:p + 0.05, tick_volume:9});

  // L'ultima candela iniziale e' pochi minuti indietro: cosi' la stima dell'app
  // (minuti mancanti + 180 di margine) resta sotto 50000 ed esce davvero la coda.
  const T = Math.floor(Date.now() / MIN) * MIN - 2 * MIN;
  const t = i => T + i * MIN;

  const vecchie = [];
  for (let i = -9; i <= 0; i++) vecchie.push(riga(t(i), 1900 + i * 0.1));

  // Stato iniziale: diretta attiva (o no), grafico a 5 minuti, simbolo MT5 allineato.
  currentAssetKey = 'XAUUSD'; rowsAssetKey = 'XAUUSD';
  mt5ActiveSymbol = 'XAUUSD';
  currentTF = 5;
  liveModeActive = cfg.live;
  liveReplayActive = false;
  fblM1Serie = {asset:'XAUUSD', rows:vecchie, ts:fblTimestampsSerie(vecchie)};
  fblM1UltimoAccodoAt = 0;
  fblM1UltimoTentativoAt = 0;
  fblM1InCorso = null;

  let attacco = [], buco = [], ricarica = [];
  if (cfg.buco) {
    // Prima candela della coda 120 minuti DOPO l'ultima vecchia: la coda non si attacca.
    buco = [t(120), t(121), t(122)].map((ms, k) => grezzo(ms, 2100 + k));
    // Riscaricata: blocco nuovo, contiguo e ben dopo il buco, con prezzo riconoscibile.
    for (let i = 0; i < 12; i++) ricarica.push(grezzo(t(180 + i), 2050 + i * 0.1));
  } else {
    // Coda che si attacca: il primo minuto nuovo COINCIDE con l'ultimo vecchio (e' la candela
    // in formazione, che cambia a ogni giro): devono vincere i nuovi, senza duplicare il minuto.
    attacco = [t(0), t(1), t(2)].map((ms, k) => grezzo(ms, 1910 + k));
  }

  const fetchVera = window.fetch.bind(window);
  const chiamate = [];
  window.fetch = async function (url, opts) {
    const u = String(url || '');
    let p;
    try { p = new URL(u, location.href).searchParams; } catch (e) { p = new URLSearchParams(); }
    if (u.indexOf('/history') >= 0 && p.get('timeframe') === 'M1') {
      const conta = Number(p.get('count'));
      chiamate.push({url:u, count:conta, symbol:p.get('symbol'), timeframe:p.get('timeframe')});
      // Richiesta piccola = coda; richiesta da 20000 (FBL_M1_PROFILI) = riscarica totale.
      const candles = cfg.buco ? (conta >= 10000 ? ricarica : buco) : attacco;
      return {ok:true, status:200, json:async () => ({candles})};
    }
    // Tutto il resto resta la fetch di sempre (il banco blocca comunque la rete).
    return fetchVera(url, opts);
  };

  try {
    await fblSerieM1Assicura();
    const s = fblM1Serie;
    const tsAttesi = s.rows ? fblTimestampsSerie(s.rows) : [];
    return {
      live:cfg.live, buco:!!cfg.buco, T,
      chiamate,
      n:s.rows ? s.rows.length : 0,
      ts:s.rows ? s.ts.slice() : [],
      close:s.rows ? s.rows.map(r => r.close) : [],
      prima:s.rows && s.rows.length ? s.rows[0].close : null,
      ultima:s.rows && s.rows.length ? s.rows[s.rows.length - 1].close : null,
      tsCoerente:!!(s.rows && s.ts && s.ts.length === s.rows.length
        && s.ts.every((v, i) => v === tsAttesi[i])),
      attesi:{vecchie:vecchie.length, attacco:attacco.length, buco:buco.length,
        ricarica:ricarica.length}
    };
  } finally {
    window.fetch = fetchVera;
  }
};

test('LIVE: i minuti M1 nuovi si attaccano in coda alla serie, senza duplicati', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(MISURA, {live:true, buco:false});
    console.log('accodo live:', JSON.stringify({n:r.n, chiamate:r.chiamate.map(c => c.count),
      prima:r.prima, ultima:r.ultima}));

    assert.equal(r.chiamate.length, 1, 'la coda si attacca: una sola richiesta M1, nessuna riscarica');
    assert.equal(r.chiamate[0].timeframe, 'M1');
    assert.equal(r.chiamate[0].symbol, 'XAUUSD');
    assert.ok(r.chiamate[0].count > 0 && r.chiamate[0].count < 50000,
      'deve chiedere la coda, non la riscarica da 50000');

    assert.equal(r.n, r.attesi.vecchie - 1 + r.attesi.attacco,
      'l\'ultimo minuto vecchio viene sostituito dai tre nuovi: la serie cresce di due');
    assert.equal(new Set(r.ts).size, r.ts.length, 'nessun minuto duplicato nella serie');
    assert.equal(r.ts[0], r.T - 9 * MIN, 'i minuti vecchi restano in testa');
    assert.deepEqual(r.ts.slice(-3), [r.T, r.T + MIN, r.T + 2 * MIN],
      'i tre minuti nuovi stanno in coda, compreso quello che sostituisce l\'ultimo vecchio');
    assert.ok(r.ultima > 1912 && r.ultima < 1913, 'il prezzo in coda è quello dei minuti nuovi');
    assert.equal(r.tsCoerente, true, 'fblM1Serie.ts deve rispecchiare le righe');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('LIVE: con un buco nella coda la serie viene RISCARICATA, non cucita', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(MISURA, {live:true, buco:true});
    console.log('buco live:', JSON.stringify({n:r.n, chiamate:r.chiamate.map(c => c.count),
      primaTs:r.ts[0] - r.T, prima:r.prima}));

    assert.equal(r.chiamate.length, 2, 'prima prova la coda, poi riscarica tutto');
    assert.ok(r.chiamate[0].count < 10000, 'la prima richiesta è la coda corta');
    assert.equal(r.chiamate[1].count, 20000, 'la seconda richiesta è la riscarica (FBL_M1_PROFILI)');

    assert.equal(r.n, r.attesi.ricarica, 'la serie finale deve essere quella riscaricata');
    assert.equal(r.ts[0], r.T + 180 * MIN, 'parte dal blocco riscaricato, non da quello vecchio');
    const inventati = r.ts.filter(v => v > r.T && v < r.T + 180 * MIN);
    assert.equal(inventati.length, 0, 'nessun minuto inventato nel buco fra vecchia e riscaricata');
    assert.ok(!r.close.some(c => c > 2099 && c < 2104),
      'le candele del buco, scartate, non devono comparire nella serie');
    assert.ok(r.prima > 2050 && r.prima < 2051, 'il prezzo è quello della serie riscaricata');
    assert.equal(r.tsCoerente, true, 'fblM1Serie.ts deve rispecchiare le righe riscaricate');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('FUORI DALLA DIRETTA: liveModeActive=false non fa nessuna richiesta M1', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(MISURA, {live:false, buco:false});
    console.log('fuori diretta:', JSON.stringify({n:r.n, chiamate:r.chiamate.length}));

    assert.equal(r.chiamate.length, 0, 'senza diretta non si chiede nulla al servizio M1');
    assert.equal(r.n, r.attesi.vecchie, 'la serie iniziale resta invariata');
    assert.equal(r.ts[0], r.T - 9 * MIN);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
