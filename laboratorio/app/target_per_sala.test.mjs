// QUANTI TARGET HA DAVVERO QUESTA SALA.
//
// RICHIESTO dal proprietario (8 ottobre 2026): «scegliendo la sala, capisce automaticamente il
// numero massimo di TP che ha inserito nella storia del tempo, cosi' quando calcoliamo quanto
// avrebbe reso abbiamo lo stesso numero di TP da configurare».
//
// Prima si guardavano solo i segnali dell'asset analizzato in quel momento, e il tetto era cinque.
// Una sala che su oro manda due target e su indici ne manda cinque si configurava con due righe:
// le altre tre sparivano, e il rendimento simulato era piu' basso del vero senza dirlo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// La cronologia di una sala vive in localStorage: e' da li' che la si legge senza il ponte.
const METTI = (sala, listeTp) => {
  const segs = listeTp.map((tp, i) => ({
    ts: Date.now() - (i + 1) * 3600000, strumento: i % 2 ? 'EURUSD' : 'XAUUSD',
    direzione: 'BUY', entrata: 100, sl: 90, tp
  }));
  localStorage.setItem('fbl_crono_seg:' + sala, JSON.stringify(segs));
};

test('il numero di target e il massimo della sala, su TUTTI i suoi asset', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((metti) => {
      eval('window.__metti=' + metti);
      // Su oro due target, su euro-dollaro cinque: devono valere cinque.
      window.__metti('Sala Mista', [[110, 120], [110, 120, 130, 140, 150], [110, 120, 130]]);
      return {
        dallaSala: stratQuantiTp([], 'Sala Mista'),
        // senza sala resta il ripiego sui risultati analizzati
        dalRipiego: stratQuantiTp([{tps: [1, 2, 3]}], '')
      };
    }, METTI.toString());
    assert.equal(r.dallaSala, 5, 'doveva contare i cinque target del segnale piu ricco');
    assert.equal(r.dalRipiego, 3);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una sala con piu di cinque target non viene piu troncata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((metti) => {
      eval('window.__metti=' + metti);
      window.__metti('Sala Generosa', [[1, 2, 3, 4, 5, 6, 7, 8]]);
      window.__metti('Sala Enorme', [new Array(20).fill(0).map((_, i) => i + 1)]);
      return {otto: stratQuantiTp([], 'Sala Generosa'), tanti: stratQuantiTp([], 'Sala Enorme'), tetto: FBL_MAX_TP};
    }, METTI.toString());
    assert.equal(r.tetto, 10, 'il tetto dei target deve essere dieci, come la strategia universale');
    assert.equal(r.otto, 8, 'otto target devono restare otto, non cinque');
    assert.equal(r.tanti, 10, 'oltre il tetto ci si ferma al tetto, non si sbaglia');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una sala senza cronologia o senza target non lascia la strategia a zero righe', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((metti) => {
      eval('window.__metti=' + metti);
      window.__metti('Sala Vuota', [[], []]);
      return {maiLetta: stratQuantiTp([], 'Sala Mai Letta'), senzaTarget: stratQuantiTp([], 'Sala Vuota')};
    }, METTI.toString());
    assert.equal(r.maiLetta, 1, 'senza cronologia si parte comunque da una riga');
    assert.equal(r.senzaTarget, 1);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i target scritti male non vengono contati', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((metti) => {
      eval('window.__metti=' + metti);
      window.__metti('Sala Sporca', [[110, null, 'boh', 130, undefined]]);
      return stratQuantiTp([], 'Sala Sporca');
    }, METTI.toString());
    // Number(null) vale 0, che e un numero finito: senza il controllo giusto un target vuoto
    // verrebbe contato come vero, e la strategia mostrerebbe una riga di troppo.
    assert.equal(r, 2, 'solo i due target veri, 110 e 130');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
