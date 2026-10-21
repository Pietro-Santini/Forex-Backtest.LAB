// A MERCATO APERTO LA PAGINA NON DEVE RALLENTARE: QUANDO CAMBIA SOLO L'ULTIMA CANDELA, NON SI
// RIFA' TUTTO.
//
// SEGNALATO dal proprietario, ed era l'indizio piu' prezioso di tutta la giornata: «la velocita'
// della pagina accelera veramente tanto quando i mercati sono chiusi. A mercato chiuso il cambio
// di asset e' istantaneo. Quindi e' un problema con il caricamento dei dati che rallenta
// l'applicazione: separiamo le due cose».
//
// AVEVA RAGIONE, ED ERA MISURABILE. A mercato aperto ogni prezzo passa da
// rebuildBaseRowsFromLibrary, che rifa' `baseRows` con uno .slice(): array nuovo, riferimento
// nuovo, e le cache dell'aggregazione e dei tempi - che confrontano il riferimento - si
// buttavano entrambe. Su 200.000 candele (uno storico MT5 da qualche mese) ogni prezzo costava:
//     riaggregare tutto      125 ms
//     ricostruire            50 ms
//     convalidare le date    17,6 ms   <- la voce piu' cara, e la piu' inutile
// Con l'oro che fa piu' prezzi al secondo, il filo principale non respirava piu'. A mercato
// CHIUSO non arriva niente, niente si butta, e tutto va: la differenza che lui vedeva.
//
// LA CURA, in due pezzi:
//   1. le cache distinguono «e' cambiato tutto» da «e' cambiata solo la coda», e nel secondo caso
//      si aggiornano sull'ultimo pezzo invece di essere buttate;
//   2. la rete di sicurezza sulle date si stende solo su cio' che e' NUOVO: una candela gia'
//      convalidata non torna indietro a rompersi.
// MISURATO DOPO: 58 ms -> 2,11 ms per prezzo su 200.000 candele (27 volte), e 8,3 -> 0,86 su
// 50.000.
//
// QUESTI TEST GUARDANO PRIMA LA CORRETTEZZA. Un'aggregazione incrementale sbagliata non si vede:
// produce candele leggermente diverse da quelle vere, in silenzio, e si opera su quelle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Dati volutamente IRREGOLARI: con candele tutte uguali un'aggregazione sbagliata darebbe lo
// stesso risultato di quella giusta e il test non direbbe niente.
const PREPARA = (n, t0) => {
  const R = [];
  for (let i = 0; i < n; i++)
    R.push({date: new Date(t0 + i * 60000).toISOString(),
            open: 100 + (i % 7) / 10, high: 100.5 + (i % 5) / 10,
            low: 99.5 - (i % 3) / 10, close: 100.1 + (i % 11) / 10, volume: 1 + (i % 9)});
  return R;
};

test('aggiornare l\'ultima candela da\' lo STESSO risultato di riaggregare tutto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      const mk = eval('(' + p + ')');
      const T0 = Date.UTC(2026, 0, 1);
      return [5, 15, 60].map(tf => {
        liveModeActive = true;
        csvLibrary = [{rows: mk(5000, T0)}];
        rebuildBaseRowsFromLibrary();
        fullAggCache.clear(); baseTimesCache = null; baseTimesCacheRef = null; baseRowsCoda = null;
        getFullAgg(tf); getBaseTimes();
        const u = csvLibrary[0].rows[csvLibrary[0].rows.length - 1];
        u.high = 999; u.close = 998; u.volume += 50;      // un prezzo nuovo sull'ultima candela
        rebuildBaseRowsFromLibrary();
        return {tf, uguale: JSON.stringify(getFullAgg(tf)) === JSON.stringify(aggregateRows(baseRows, tf))};
      });
    }, PREPARA.toString());
    r.forEach(x => assert.equal(x.uguale, true, 'timeframe ' + x.tf + ': l\'aggregazione incrementale non combacia con quella completa'));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('e cosi\' anche quando nasce una candela NUOVA', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      const mk = eval('(' + p + ')');
      const T0 = Date.UTC(2026, 0, 1);
      return [5, 15, 60].map(tf => {
        liveModeActive = true;
        csvLibrary = [{rows: mk(5000, T0)}];
        rebuildBaseRowsFromLibrary();
        fullAggCache.clear(); baseTimesCache = null; baseTimesCacheRef = null; baseRowsCoda = null;
        getFullAgg(tf); getBaseTimes();
        csvLibrary[0].rows.push({date: new Date(T0 + 5000 * 60000).toISOString(),
                                 open: 1, high: 2, low: 0.5, close: 1.5, volume: 3});
        rebuildBaseRowsFromLibrary();
        const agg = JSON.stringify(getFullAgg(tf)) === JSON.stringify(aggregateRows(baseRows, tf));
        const tempi = JSON.stringify(getBaseTimes()) === JSON.stringify(baseRows.map(x => parseDateTime(x.date)));
        return {tf, agg, tempi};
      });
    }, PREPARA.toString());
    r.forEach(x => {
      assert.equal(x.agg, true, 'timeframe ' + x.tf + ': candele sbagliate dopo una candela nuova');
      assert.equal(x.tempi, true, 'timeframe ' + x.tf + ': tempi sbagliati dopo una candela nuova');
    });
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('cambiando asset la cache NON viene riusata', async () => {
  // LA PROVA DI CONTROLLO PIU' IMPORTANTE. La scorciatoia vale solo per «e' cambiata la coda»: se
  // scattasse anche quando cambia tutto (un altro asset, un altro storico), il grafico mostrerebbe
  // le candele di uno strumento con i dati di un altro - e non si vedrebbe, perche' le candele ci
  // sarebbero comunque.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      const mk = eval('(' + p + ')');
      liveModeActive = true;
      csvLibrary = [{rows: mk(2000, Date.UTC(2026, 0, 1))}];
      rebuildBaseRowsFromLibrary();
      fullAggCache.clear(); baseTimesCache = null; baseTimesCacheRef = null; baseRowsCoda = null;
      getFullAgg(5);
      // Altro asset: storico completamente diverso, con prezzi di un'altra scala.
      const altro = mk(2000, Date.UTC(2020, 5, 1)).map(x => ({...x, open: x.open * 40, high: x.high * 40,
                                                              low: x.low * 40, close: x.close * 40}));
      csvLibrary = [{rows: altro}];
      rebuildBaseRowsFromLibrary();
      return JSON.stringify(getFullAgg(5)) === JSON.stringify(aggregateRows(baseRows, 5));
    }, PREPARA.toString());
    assert.equal(r, true,
      'con uno storico tutto nuovo la cache deve essere rifatta da zero, non ritoccata in coda');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una data rotta viene ancora intercettata, anche se si convalida solo la coda', async () => {
  // La rete di sicurezza esisteva per un difetto vero: una candela con data non valida rompe
  // l'ipotesi di array ordinato su cui si basa la ricerca binaria, e il sintomo e' «una candela
  // isolata di un altro giorno». Rendendo la convalida incrementale NON si deve perdere quella
  // protezione su cio' che arriva.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      const mk = eval('(' + p + ')');
      liveModeActive = true;
      csvLibrary = [{rows: mk(500, Date.UTC(2026, 0, 1))}];
      rebuildBaseRowsFromLibrary();
      const buone = baseRows.length;
      csvLibrary[0].rows.push({date: 'non-e-una-data', open: 1, high: 1, low: 1, close: 1, volume: 0});
      rebuildBaseRowsFromLibrary();
      return {buone, dopo: baseRows.length,
              tutteValide: baseRows.every(x => Number.isFinite(parseDateTime(x.date)))};
    }, PREPARA.toString());
    assert.equal(r.tutteValide, true, 'nessuna data rotta deve entrare nel grafico');
    assert.equal(r.dopo, r.buone, 'la candela con la data rotta va scartata');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// LA GUARDIA CONTRO IL RITORNO DEL DIFETTO, scritta in modo che non dipenda dalla macchina: si
// misura il costo di un prezzo ADESSO e quello del comportamento di PRIMA (riaggregare tutto e
// rileggere tutte le date) nello stesso giro, e si confronta il rapporto.
//
// PERCHE' NON SI PRETENDE «COSTO COSTANTE»: resta una parte che cresce con lo storico - tre copie
// di array per prezzo. Si potevano togliere mutando le cache sul posto, ma `rows` PUO' essere lo
// stesso array della cache (vedi rebuildRows: `rows=fullAgg`), e mutarlo vorrebbe dire cambiare i
// dati sotto il grafico mentre disegna. Un guadagno di due volte in cambio di un difetto
// intermittente e invisibile non e' un affare. Copiare un array e' comunque molto piu' economico
// che rileggere ogni data: e' la differenza fra 2 ms e 58 ms su 200.000 candele.
test('un prezzo costa molto meno di quanto costava prima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      const mk = eval('(' + p + ')');
      liveModeActive = true;
      csvLibrary = [{rows: mk(60000, Date.UTC(2020, 0, 1))}];
      rebuildBaseRowsFromLibrary();
      fullAggCache.clear(); baseTimesCache = null; baseTimesCacheRef = null; baseRowsCoda = null;
      getFullAgg(5); getBaseTimes();          // la prima volta si paga tutto, ed e' giusto

      // ADESSO: venti prezzi come a mercato aperto.
      const a = performance.now();
      for (let k = 0; k < 20; k++) {
        const u = csvLibrary[0].rows[csvLibrary[0].rows.length - 1];
        u.close = 100 + k / 100;
        rebuildBaseRowsFromLibrary(); getFullAgg(5); getBaseTimes();
      }
      const adesso = (performance.now() - a) / 20;

      // PRIMA: riaggregare tutto e rileggere tutte le date, che e' cio' che succedeva a ogni
      // prezzo quando le cache si buttavano.
      const b = performance.now();
      for (let k = 0; k < 20; k++) {
        aggregateRows(baseRows, 5);
        baseRows.map(x => parseDateTime(x.date));
      }
      const prima = (performance.now() - b) / 20;
      return {adesso, prima, volte: prima / Math.max(0.01, adesso)};
    }, PREPARA.toString());
    assert.ok(r.volte >= 5,
      'un prezzo deve costare almeno cinque volte meno di prima: adesso ' + r.adesso.toFixed(2)
      + ' ms, prima ' + r.prima.toFixed(2) + ' ms, cioe\' ' + r.volte.toFixed(1) + ' volte');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
