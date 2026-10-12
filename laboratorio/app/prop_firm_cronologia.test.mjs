// PUNTO 4 — prop firm DEDICATA alla cronologia sale.
//
// Il cuore del Punto 4 (raggruppare la curva per giorno, il drawdown giornaliero del 5%, il
// drawdown totale del 10%, l'obiettivo +10% che "sblocca" la prop) e' una funzione PURA,
// fblPropDedicataConta(punti, capitale, apertoMs): la si prova qui senza browser, su curve
// scritte a mano, cosi' il conto si puo' verificare a occhio.
//
// Come si prova che il test serve: senza l'esposizione `window.fblPropDedicataConta` il primo
// test va rosso con "not a function".
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Un punto della curva della resa: `t` e' l'istante del fill (ms), `cap` il conto dopo quel trade.
// Gli orari sono in UTC a mezzogiorno, cosi' il giorno di Roma e' sempre lo stesso in ogni fuso.
const U = (giorno, h) => Date.UTC(2026, 0, giorno, h, 0, 0);

async function conta(punti, capitale, apertoMs){
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((a) => window.fblPropDedicataConta(a.punti, a.capitale, a.apertoMs),
      {punti, capitale, apertoMs});
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    return r;
  } finally { await browser.close(); }
}

test('un giorno che scende oltre il 5% chiude la prop, e si dice QUALE giorno', async () => {
  // Il 2 gennaio il conto arriva a 10.600 (dal capitale di 10.000); il 3 gennaio scende a 9.900:
  // dal saldo d'inizio giornata (10.600) e' -6,6% -> la prop sarebbe finita quel giorno.
  const r = await conta(
    [{t:U(2,12), cap:10600}, {t:U(3,12), cap:9900}],
    10000, U(2,0)
  );
  assert.equal(r.esito, 'finita');
  assert.ok(r.maxDDGiorno > 5, 'il massimo drawdown giornaliero deve superare il 5%');
  assert.equal(r.maxDDGiornoData, '2026-01-03', 'il giorno indicato deve essere quello della perdita');
});

test('raggiunto il +10% la prop e\' SBLOCCATA: il 5% giornaliero successivo non vale piu\'', async () => {
  // Il 2 gennaio il conto arriva a 11.000 = +10% (obiettivo). Il 3 gennaio perde il 7,3%: NON
  // deve contare, perche' la prop era gia' stata sbloccata il giorno prima.
  const r = await conta(
    [{t:U(2,12), cap:11000}, {t:U(3,12), cap:10200}],
    10000, U(2,0)
  );
  assert.equal(r.esito, 'sbloccata');
  assert.equal(r.esitoData, '2026-01-02');
});

test('senza violazioni e senza obiettivo resta "ok", col profitto finale dichiarato', async () => {
  const r = await conta(
    [{t:U(2,12), cap:10200}, {t:U(3,12), cap:10500}],
    10000, U(2,0)
  );
  assert.equal(r.esito, 'ok');
  assert.ok(Math.abs(r.profFinale - 5) < 0.001, 'a fine periodo il conto e\' a +5%');
  assert.ok(r.maxDDGiorno < 5 && r.maxDDTot < 10);
});

test('nessun singolo giorno oltre il 5%, ma il totale oltre il 10%: chiude comunque', async () => {
  // Tre giornate da -4% l'una: nessuna supera il 5% giornaliero, ma il totale supera il 10%.
  const r = await conta(
    [{t:U(2,12), cap:9600}, {t:U(3,12), cap:9216}, {t:U(4,12), cap:8847.36}],
    10000, U(2,0)
  );
  assert.equal(r.esito, 'finita');
  assert.ok(r.maxDDGiorno < 5, 'nessun singolo giorno oltre il 5%');
  assert.ok(r.maxDDTot > 10, 'il drawdown totale deve superare il 10%');
});

test('se non c\'e\' nessuna operazione dopo l\'apertura, lo dice invece di inventare', async () => {
  const r = await conta(
    [{t:U(2,12), cap:10600}],
    10000, U(9,0) // apertura DOPO l'unica operazione
  );
  assert.equal(r.vuoto, true);
});
