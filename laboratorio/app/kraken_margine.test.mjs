// IL RISCHIO È QUANTO PERDI ALLO STOP. IL MARGINE È QUANTO CAPITALE RESTA IMPEGNATO.
//
// SEGNALATO dal proprietario: «ho un conto da 10.000, nella sala ho impostato il 2%: come mai ha
// utilizzato un margine di 5.839?».
//
// NON ERA UN ERRORE DI CALCOLO, ed è importante che resti scritto. Il 2% è il RISCHIO: quanto si
// perde SE ARRIVA LO STOP. La quantità esce da lì — rischio in soldi diviso la distanza dallo stop
// — e il margine è una conseguenza del prezzo e della leva:
//
//     rischio 2% di 10.000 = 200 $      stop a 10 punti su un prezzo di 730
//     quantità = 200 / 10 = 20 monete   valore = 20 × 730 = 14.600 $
//     margine (leva 2x)    = 7.300 $
//
// Stop stretto e leva bassa (le cripto in UE sono 2x) = molto margine per poco rischio. Il conto
// non è in pericolo per 200 $, ma resta quasi tutto impegnato e non si possono aprire altre
// posizioni. Di qui la richiesta: «dobbiamo far decidere quanto margine utilizzare».
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

const PREPARA = () => {
  // Conto Kraken simulato da 10.000 $, leva 2x, contratto con passo fine.
  krakenConto = {collegato: true, conto_id: 'c1', ambiente: 'simulato', saldo: 10000,
                 disponibile: 10000, leva: 2};
  krakenPosizioni = {posizioni: []};
  try { localStorage.removeItem('fbl_kraken_margine_max'); } catch(e) {}
  // Il contratto a grafico: passo 0,001 e minimo 0,001 (come un future cripto).
  window.__infoFinta = {step: 0.001, min: 0.001};
  krakenInfoCorrente = () => window.__infoFinta;
  krakenModoOrdini = () => true;
};

test('senza tetto il conto si comporta come prima, e il margine si vede', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PREPARA_SRC => {
      eval('(' + PREPARA_SRC + ')()');
      // Il caso vero: entrata 730, stop 740 (SELL), rischio 2%.
      const s = krakenLottiConsigliati(730, 740, 2);
      return {lots: s.lots, riskAmount: s.riskAmount, margine: s.margine,
              oltreTetto: s.oltreTetto, maxPct: s.margineMaxPct};
    }, PREPARA.toString());
    assert.equal(r.riskAmount, 200, 'il 2% di 10.000 sono 200 $ di RISCHIO');
    assert.equal(r.lots, 20, '200 $ di rischio su uno stop da 10 punti sono 20 monete');
    assert.equal(r.maxPct, 100, 'di base nessun tetto: come si comportava prima');
    assert.equal(r.oltreTetto, false);
    // 20 × 730 / 2 = 7.300 $ di margine: è il numero che aveva sorpreso, ed è corretto.
    assert.ok(Math.abs(r.margine - 7300) < 1, 'il margine impegnato va mostrato: ' + r.margine);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('col tetto la quantità si riduce, e il rischio vero scende sotto quello chiesto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PREPARA_SRC => {
      eval('(' + PREPARA_SRC + ')()');
      localStorage.setItem('fbl_kraken_margine_max', '20');   // al massimo il 20% del conto
      const s = krakenLottiConsigliati(730, 740, 2);
      // Il rischio VERO con quella quantità: è più basso del 2% chiesto, e si deve poter dire.
      return {lots: s.lots, margine: s.margine, oltreTetto: s.oltreTetto, maxPct: s.margineMaxPct,
              rischioVero: s.lots * 10};
    }, PREPARA.toString());
    assert.equal(r.maxPct, 20);
    assert.equal(r.oltreTetto, true, 'il tetto deve risultare applicato');
    // Tetto 20% di 10.000 = 2.000 $ di margine; a leva 2x sono 4.000 $ di valore; a 730 l una,
    // 5,479 monete (arrotondate per difetto al passo del contratto).
    assert.ok(Math.abs(r.margine - 2000) < 5, 'il margine deve stare nel tetto: ' + r.margine);
    assert.ok(r.lots > 5.4 && r.lots < 5.5, 'quantità ridotta di conseguenza: ' + r.lots);
    assert.ok(r.rischioVero < 200, 'il rischio vero scende sotto i 200 $ chiesti: ' + r.rischioVero);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il tetto non si intromette quando non serve', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PREPARA_SRC => {
      eval('(' + PREPARA_SRC + ')()');
      localStorage.setItem('fbl_kraken_margine_max', '80');
      // Stop LARGO: 100 punti. Rischio 2% = 200 $ -> 2 monete -> 1.460 $ di valore -> 730 $ di
      // margine, molto sotto il tetto dell 80% (8.000 $).
      const s = krakenLottiConsigliati(730, 830, 2);
      return {lots: s.lots, margine: s.margine, oltreTetto: s.oltreTetto};
    }, PREPARA.toString());
    assert.equal(r.oltreTetto, false, 'con lo stop largo il tetto non c entra');
    assert.equal(r.lots, 2, 'la quantità resta quella del rischio scelto');
    assert.ok(Math.abs(r.margine - 730) < 1);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il calcolo del rischio è lo STESSO di MT5: importo diviso la perdita per unità', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  // MT5: lots = riskAmount / lossPerLot. Kraken: q = riskAmount / dist, dove dist È la perdita per
  // una moneta. È la stessa identica formula; a cambiare è solo cosa vale "una unità".
  assert.match(src, /let lots=riskAmount\/lossPerLot;/, 'la formula MT5');
  assert.match(src, /let q=riskAmount\/dist, cappedByMargin=false, oltreTetto=false;/,
    'la formula Kraken, con lo stesso significato');
  assert.match(src, /const riskAmount=saldo\*riskPct\/100;/,
    'e lo stesso importo di rischio: percentuale del saldo del conto');
});

test('il tetto di margine esiste, si salva, si condivide e vale anche per i segnali', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  assert.match(src, /id="krakenMargineMax"/, 'il campo nelle impostazioni Kraken');
  assert.match(src, /function krakenMargineMaxPct\(\)\{/, 'la lettura del valore');
  assert.match(src, /fbl_kraken_margine_max:v=>|fbl_kraken_margine_max:\(\)=>/,
    'deve viaggiare fra i dispositivi come la leva');
  // Sui segnali NON si ritoccano i numeri a mano: si ricalcola il piano con un rischio ridotto,
  // così minimi del contratto e fette per ogni target restano coerenti.
  assert.match(src, /const ridotto=tgPiano\(seg,symG,d\.rischio\*fattore,opzPiano\);/,
    'il piano si ricalcola, non si aggiusta a posteriori');
  assert.match(src, /voce\.autoMotivo='rischio ridotto dal '/,
    'e la riduzione si deve leggere nella scheda del segnale');
});
