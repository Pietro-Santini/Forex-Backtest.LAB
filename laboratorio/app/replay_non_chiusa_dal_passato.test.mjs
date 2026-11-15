// UNA POSIZIONE NON PUO' ESSERE CHIUSA DA UN PREZZO ACCADUTO PRIMA CHE ESISTESSE.
//
// MISURATO con una sonda sulla pagina vera, il 15 novembre 2026: una vendita aperta al secondo
// 30 di una candela e' stata chiusa in stop su un massimo che il prezzo aveva toccato DODICI
// SECONDI PRIMA che la posizione esistesse.
//
// LA CAUSA: `startTime` veniva preso da rows[idx], la candela GIA' CHIUSA, mentre in replay la
// posizione nasce in quella in formazione. Il controllo di evaluate()
// (`if(rowTime<=pos.startTime)return;`) serve proprio a non valutare una posizione contro la
// propria candela di nascita: con l'istante sbagliato non scattava, e quella candela veniva
// valutata per intero - massimo e minimo compresi, incluso il tratto precedente all'ingresso.
//
// Non e' un'approssimazione discutibile: un prezzo accaduto prima non puo' chiudere una
// posizione, e' impossibile.
//
// COSA SI PERDE, e il banco lo mette nero su bianco: saltando la candela di nascita, uno stop
// toccato davvero dopo l'ingresso ma dentro quella stessa candela si vedra' solo dalla
// successiva. Un'approssimazione limitata a una candela, al posto di un errore senza limite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SCENA = `(() => {
  const base = Date.parse('2026-11-10T10:00:00Z');
  rows = [];
  for (let i = 0; i < 8; i++) {
    rows.push({date: new Date(base + i * 60000).toISOString().slice(0,16).replace('T',' '),
               open: 1.0800, high: 1.0806, low: 1.07950, close: 1.08020, volume: 1});
  }
  baseRows = rows.slice();
  rowsAssetKey = currentAssetKey = 'EURUSD';
  currentTF = 1;
  idx = 4;
  liveReplayActive = true;
  positions.length = 0; pendingOrders.length = 0; trades.length = 0;
  replayForm = {idx: 5, sub: 30, perBar: 60,
                path: replaySintesiPath({open:1.0800, high:1.0806, low:1.0795, close:1.0802}, 61)};
})`;

test('l istante di nascita e quello della candela in FORMAZIONE, non di quella chiusa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)();
      const dellaChiusa = parseDateTime(rows[idx].date);
      const dellaFormazione = parseDateTime(rows[replayForm.idx].date);
      positions.length = 0;
      openMarketTrade('SELL');
      const pos = positions[positions.length - 1];
      return {startTime: pos ? pos.startTime : null, dellaChiusa, dellaFormazione};
    }, SCENA);
    console.log('nascita:', JSON.stringify(r));
    assert.equal(r.startTime, r.dellaFormazione,
      'la posizione nasce nella candela che si sta formando, non in quella gia chiusa: ' +
      JSON.stringify(r));
    assert.notEqual(r.startTime, r.dellaChiusa,
      'con l istante della candela chiusa, evaluate() valuta la candela di nascita per intero ' +
      'e puo chiudere su un prezzo precedente all ingresso: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la candela di nascita non chiude la posizione su un prezzo gia passato', async () => {
  // Il caso misurato: vendita aperta a meta' candela, con lo stop a un livello che il prezzo
  // aveva gia' toccato PRIMA. Alla chiusura della candela non deve succedere niente.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)();
      positions.length = 0; trades.length = 0;
      openMarketTrade('SELL');
      const pos = positions[positions.length - 1];
      // SENZA QUESTA RIGA LA PROVA SAREBBE VERDE PER IL MOTIVO SBAGLIATO: nel banco il menu
      // dell'asset e' vuoto, la posizione nasce con asset:"" ed evaluate() la salta del tutto.
      // Misurato mentre si scriveva questo file.
      pos.asset = currentAssetKey;
      pos.sl = 1.0806;                     // il massimo della candela, toccato al secondo 18
      pos.tp = null;
      const prima = positions.length;
      forward(true);                       // la candela di nascita si chiude
      return {prima, dopo: positions.length, operazioni: trades.length,
              massimoCandela: rows[idx].high, sl: pos.sl};
    }, SCENA);
    console.log('candela di nascita:', JSON.stringify(r));
    assert.equal(r.prima, 1, 'la posizione deve esserci prima');
    assert.equal(r.dopo, 1,
      'e deve esserci ancora dopo: lo stop e stato toccato PRIMA che la posizione esistesse. ' +
      JSON.stringify(r));
    assert.equal(r.operazioni, 0,
      'niente deve finire nel Journal: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('dalla candela SUCCESSIVA la posizione si valuta normalmente', async () => {
  // La cura non deve rendere la posizione immortale: dalla candela dopo tutto riprende.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)();
      positions.length = 0; trades.length = 0;
      openMarketTrade('SELL');
      const pos = positions[positions.length - 1];
      // SENZA QUESTA RIGA LA PROVA SAREBBE VERDE PER IL MOTIVO SBAGLIATO: nel banco il menu
      // dell'asset e' vuoto, la posizione nasce con asset:"" ed evaluate() la salta del tutto.
      // Misurato mentre si scriveva questo file.
      pos.asset = currentAssetKey;
      pos.sl = 1.0806; pos.tp = null;
      forward(true);                       // candela di nascita: saltata
      replayForm = null;
      forward(true);                       // la successiva: qui si valuta
      return {posizioni: positions.length, operazioni: trades.length,
              esito: trades.length ? trades[trades.length - 1].result : null};
    }, SCENA);
    console.log('candela successiva:', JSON.stringify(r));
    assert.equal(r.posizioni, 0,
      'dalla candela dopo lo stop deve funzionare: ' + JSON.stringify(r));
    assert.equal(r.operazioni, 1, 'e l operazione finisce nel Journal');
  } finally { await browser.close(); }
});

test('FUORI dal replay l istante resta quello di prima', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((prep) => {
      eval(prep)();
      liveReplayActive = false; replayForm = null;
      positions.length = 0;
      openMarketTrade('BUY');
      const pos = positions[positions.length - 1];
      return {startTime: pos ? pos.startTime : null, attesa: parseDateTime(rows[idx].date)};
    }, SCENA);
    console.log('fuori dal replay:', JSON.stringify(r));
    assert.equal(r.startTime, r.attesa,
      'senza replay l istante e quello della candela corrente, identico a prima: ' +
      JSON.stringify(r));
  } finally { await browser.close(); }
});
