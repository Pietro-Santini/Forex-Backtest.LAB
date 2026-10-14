// IL FOOTPRINT DELLE CANDELE PASSATE NON SI PERDE PIU'.
//
// RICHIESTO dal proprietario: «nel footprint le candele passate, anche magari di giorni, devono
// rimanere salvati i dati di ogni singola candela, perché se no passa qualche giorno e i dati
// precedenti non li abbiamo più. E se passiamo a un timeframe da 4 ore o un giorno vedremo solo le
// ultime due candele. Bisogna conservare tutti i dati. Assolutamente».
//
// PERCHÉ SUCCEDEVA: il footprint si ricostruiva SEMPRE dal log dei tick grezzi, che ha un tetto di
// 150.000 tick per asset e scarta i più vecchi (FIFO). Su uno strumento movimentato quel tetto
// copre poche ore: passando a 4h o a 1D restavano solo le ultime candele, perché i tick delle
// precedenti erano già stati buttati per fare spazio ai nuovi.
//
// LA CURA: si conservano non i tick (sarebbero troppi) ma le CELLE GIÀ AGGREGATE AL MINUTO — le
// caselline che si rivedono a schermo. Da lì si costruisce qualunque timeframe sommando i minuti
// che ci stanno dentro, ri-aggregando le righe sul passo del momento.
//
// Come si prova che il test serve: senza footprintArchivioVersaNeiBucket in __footprintRebuildBuckets
// il secondo test trova zero candele invece di diciotto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Tre giorni di minuti archiviati su un asset, un tick al minuto.
const ARCHIVIA = (minuti) => {
  currentAssetKey = 'TESTX';
  liveModeActive = true;
  footprintArchivio = {};
  footprintArchivioSporchi.clear();
  footprintByBucket = {};
  footprintTickLogByAsset = {};
  const fine = Date.UTC(2026, 0, 10, 0, 0, 0);
  const inizio = fine - minuti * 60000;
  for (let t = inizio; t < fine; t += 60000) {
    // prezzo che oscilla, cosi le righe non sono tutte uguali
    const p = 100 + ((t / 60000) % 20) * 0.1;
    footprintArchivioAggiungi('TESTX', p, t, 1, 2, 0.1, 1, 2);
  }
  return {minuti, archiviati: Object.keys(footprintArchivio.TESTX || {}).length};
};

test('ogni tick finisce nel minuto a cui appartiene, con le celle di sempre', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((a) => {
      const A = eval('(' + a + ')');
      const out = A(120);                     // due ore di minuti
      const arc = footprintArchivio.TESTX;
      const primo = arc[Object.keys(arc)[0]];
      const cella = primo.rows[Object.keys(primo.rows)[0]];
      return {out, passo: primo.step,
              campi: Object.keys(cella).sort(),
              sporchi: [...footprintArchivioSporchi]};
    }, ARCHIVIA.toString());
    assert.equal(r.out.archiviati, 120, 'due ore devono dare 120 minuti archiviati');
    assert.equal(r.passo, 0.1);
    assert.deepEqual(r.campi, ['askVol', 'bidVol', 'buy', 'sell', 'trades'],
      'le celle devono avere la stessa forma di quelle vere');
    assert.ok(r.sporchi.length >= 1, 'il giorno toccato va segnato da salvare');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('su 4 ore si vedono TUTTE le candele dei giorni passati, non solo le ultime due', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((a) => {
      const A = eval('(' + a + ')');
      A(3 * 24 * 60);                          // tre giorni di minuti
      currentTF = 240;                         // timeframe 4 ore
      // Nessun tick in memoria: e la situazione del giorno dopo, col log gia svuotato dal tetto.
      footprintTickLogByAsset = {};
      __footprintRebuildBuckets();
      const candele = Object.keys(footprintByBucket).length;
      const unaQualunque = footprintByBucket[Object.keys(footprintByBucket)[0]];
      return {candele, righe: Object.keys(unaQualunque.rows).length, passo: unaQualunque.step};
    }, ARCHIVIA.toString());
    // Tre giorni a 4 ore = 18 candele.
    assert.equal(r.candele, 18, 'tre giorni su 4 ore fanno 18 candele, trovate ' + r.candele);
    assert.ok(r.righe > 0, 'ogni candela deve avere le sue righe');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('su un giorno intero le stesse ore si sommano in una candela sola', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((a) => {
      const A = eval('(' + a + ')');
      A(3 * 24 * 60);
      currentTF = 1440;                        // timeframe giornaliero
      footprintTickLogByAsset = {};
      __footprintRebuildBuckets();
      const chiavi = Object.keys(footprintByBucket);
      const somma = (b) => Object.values(b.rows).reduce((s, c) => s + c.buy + c.sell, 0);
      return {candele: chiavi.length, volume: somma(footprintByBucket[chiavi[0]])};
    }, ARCHIVIA.toString());
    assert.equal(r.candele, 3, 'tre giorni fanno tre candele giornaliere, trovate ' + r.candele);
    // 1440 minuti x un tick da peso 2 = 2880 per giornata.
    assert.equal(r.volume, 2880, 'la candela del giorno deve contenere tutti i suoi minuti');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i minuti coperti dai tick ancora in memoria non si contano due volte', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((a) => {
      const A = eval('(' + a + ')');
      A(120);                                  // due ore in archivio
      currentTF = 60;
      // L ultima mezz ora e ANCHE nel log dei tick: li comanda il log, piu fine.
      const fine = Date.UTC(2026, 0, 10, 0, 0, 0);
      const log = [];
      for (let t = fine - 30 * 60000; t < fine; t += 60000) log.push({t, price: 100.5, side: 1, weight: 2});
      footprintTickLogByAsset = {TESTX: log};
      __footprintRebuildBuckets();
      const somma = Object.values(footprintByBucket)
        .reduce((s, b) => s + Object.values(b.rows).reduce((x, c) => x + c.buy + c.sell, 0), 0);
      return {somma};
    }, ARCHIVIA.toString());
    // 120 minuti, peso 2 l uno: 240 in tutto. Se i 30 minuti in comune si contassero due volte
    // verrebbe 300.
    assert.equal(r.somma, 240, 'volume totale atteso 240 (niente doppi conteggi), trovato ' + r.somma);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('cambiando passo le righe si ri-aggregano senza perdere volume', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((a) => {
      const A = eval('(' + a + ')');
      A(60);
      currentTF = 60;
      footprintTickLogByAsset = {};
      const totale = (bb) => Object.values(bb)
        .reduce((s, b) => s + Object.values(b.rows).reduce((x, c) => x + c.buy + c.sell, 0), 0);
      // Passo fine
      footprintByBucket = {};
      footprintArchivioVersaNeiBucket('TESTX', 0.1, Infinity);
      const fine = {righe: Object.keys(footprintByBucket[Object.keys(footprintByBucket)[0]].rows).length,
                    vol: totale(footprintByBucket)};
      // Passo grosso: meno righe, stesso volume
      footprintByBucket = {};
      footprintArchivioVersaNeiBucket('TESTX', 1, Infinity);
      const grosso = {righe: Object.keys(footprintByBucket[Object.keys(footprintByBucket)[0]].rows).length,
                      vol: totale(footprintByBucket)};
      return {fine, grosso};
    }, ARCHIVIA.toString());
    assert.ok(r.grosso.righe < r.fine.righe, 'col passo grosso le righe devono essere meno');
    assert.equal(r.grosso.vol, r.fine.vol, 'ri-aggregando non si perde volume');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
