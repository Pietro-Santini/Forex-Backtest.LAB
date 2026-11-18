// IL BLU DEL PAREGGIO SI ACCENDE A ZERO, NON PRIMA.
//
// SEGNALATO dal proprietario (18 novembre 2026): «quando vado a trascinare lo stop loss, lo metto
// a break even, e sul terminale MT5 risulta che ho perso comunque dei soldi. La striscia sul
// grafico mi deve diventare blu quando effettivamente la perdita non e' negativa, ma e' zero. Il
// profitto e' zero, in poche parole. Questo va a rispettare il risk management con il rapporto
// rischio-rendimento e il win rate.»
//
// CAUSA: quattro punti diversi decidevano «stop a pareggio o oltre» con la stessa riga ingenua
//     pos.side==='BUY' ? sl>=entry : sl<=entry
// cioe' confrontando con il PREZZO DI ENTRATA. Ma chiudere all'entrata non vuol dire zero: restano
// la commissione (si paga due volte, entrata e uscita) e lo swap. Con uno stop li' il conto MT5
// chiude in PERDITA, e la striscia era gia' blu: diceva «sei al sicuro» mentre non lo era.
//
// L'app il prezzo giusto lo conosceva gia': `mt5PrezzoPareggio(pos)` - lo stesso che usa il
// pulsante BE - porta l'entrata avanti di quanto serve a ripagare commissioni e swap, e arrotonda
// SEMPRE contro di noi. Il colore adesso guarda quello.
//
// Le due prove di GUARDIA tengono il resto fermo: su una posizione simulata (nessun costo
// separato: lo spread e' gia' dentro l'entrata) e su una posizione di cui NON si conoscono i
// costi, il comportamento resta quello di prima - l'app non inventa numeri.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Una posizione MT5 vera con i suoi costi: commissione 3,50 (a lato) e swap 1,20, tutti negativi
// come li manda MT5. valore_punto 10 = un punto intero vale 10 € con questo lotto.
const SCENA = `(() => {
  positions.length = 0;
  const pos = {id:'p1', side:'BUY', entry:1.10000, sl:1.09000, tp:1.11000, lots:0.10,
               asset:'EURUSD', mt5Ticket:777};
  positions.push(pos);
  mt5RealPositions = [{ticket:777, commission:-3.5, swap:-1.2, valore_punto:10, point:0.00001, digits:5}];
  return {pareggio: mt5PrezzoPareggio(pos), entry: pos.entry};
})()`;

test('BUY: lo stop ESATTAMENTE all entrata non e ancora pareggio', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const s = await pagina.evaluate(SCENA);
    assert.ok(s.pareggio > s.entry,
      'il pareggio vero deve stare sopra l\'entrata: ' + s.pareggio + ' contro ' + s.entry);
    const r = await pagina.evaluate(() => {
      const pos = positions[0];
      pos.sl = pos.entry;
      return {blu: isStopProfitLevel(pos)};
    });
    assert.equal(r.blu, false,
      'con commissioni e swap da pagare, lo stop all\'entrata e\' ancora una perdita: non deve essere blu');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('BUY: al prezzo di pareggio vero, il blu si accende', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(SCENA);
    const r = await pagina.evaluate(() => {
      const pos = positions[0];
      pos.sl = mt5PrezzoPareggio(pos);
      return {blu: isStopProfitLevel(pos), sl: pos.sl};
    });
    assert.equal(r.blu, true, 'al pareggio vero (' + r.sl + ') la striscia deve essere blu');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('SELL: lo stop all entrata non e pareggio, al pareggio vero si', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      positions.length = 0;
      const pos = {id:'p2', side:'SELL', entry:1.10000, sl:1.11000, lots:0.10, asset:'EURUSD', mt5Ticket:778};
      positions.push(pos);
      mt5RealPositions = [{ticket:778, commission:-3.5, swap:-1.2, valore_punto:10, point:0.00001, digits:5}];
      const pareggio = mt5PrezzoPareggio(pos);
      pos.sl = pos.entry;
      const alEntrata = isStopProfitLevel(pos);
      pos.sl = pareggio;
      return {pareggio, entry: pos.entry, alEntrata, alPareggio: isStopProfitLevel(pos)};
    });
    assert.ok(r.pareggio < r.entry, 'per un SELL il pareggio vero sta SOTTO l\'entrata: ' + r.pareggio);
    assert.equal(r.alEntrata, false, 'lo stop all\'entrata e\' ancora una perdita');
    assert.equal(r.alPareggio, true, 'al pareggio vero la striscia deve essere blu');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('GUARDIA: su una posizione simulata il pareggio resta l entrata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      positions.length = 0;
      const pos = {id:'p3', side:'BUY', entry:1.10000, sl:1.10000, lots:0.10, asset:'EURUSD'};
      positions.push(pos);
      mt5RealPositions = [];
      return isStopProfitLevel(pos);
    });
    assert.equal(r, true, 'senza costi separati (simulata) lo stop all\'entrata e\' pareggio, come prima');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('GUARDIA: se i costi non si conoscono, non si inventa niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      positions.length = 0;
      const pos = {id:'p4', side:'BUY', entry:1.10000, sl:1.10000, lots:0.10, asset:'EURUSD', mt5Ticket:999};
      positions.push(pos);
      mt5RealPositions = [];            // la posizione non c'e' nella lista: costi ignoti
      return isStopProfitLevel(pos);
    });
    assert.equal(r, true, 'con i costi ignoti il comportamento resta quello di prima');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('i punti che accendono il blu sono solo due, e sono Kraken', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const {RADICE} = await import('./aiuti.mjs');
  const righe = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8').split(String.fromCharCode(10));
  // Dove si decide ancora «a profitto» confrontando con l'ENTRATA, e dentro quale funzione.
  const trovati = [];
  let funzione = '(fuori da una funzione)';
  righe.forEach((r, i) => {
    const m = r.match(/^(?:async )?function ([A-Za-z0-9_]+)/);
    if (m) funzione = m[1];
    if (/sl>=entry\s*:\s*sl<=entry|liveSl>=pos\.entry|pos\.sl>=pos\.entry/.test(r)) {
      trovati.push({riga: i + 1, funzione});
    }
  });
  // Restano SOLO i due punti di Kraken, e restano per un motivo scritto nel codice: Kraken non
  // comunica la commissione per singola posizione, quindi il pareggio vero non si puo' calcolare
  // e l'app non inventa numeri (vedi il messaggio di krakenConfermaBlocco sullo stop a pareggio).
  const nonKraken = trovati.filter(t => t.funzione.indexOf('kraken') !== 0);
  assert.deepEqual(nonKraken, [],
    "fuori da Kraken nessun punto deve decidere il blu guardando l'entrata: " + JSON.stringify(nonKraken));
  assert.equal(trovati.length, 2,
    'i punti Kraken sono due e vanno lasciati: trovati ' + JSON.stringify(trovati));
});
