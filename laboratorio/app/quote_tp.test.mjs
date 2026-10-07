// Quanto si mette su ogni target: percentuali diverse per TP, e chiusure parziali sulle cripto.
//
// RICHIESTO dal proprietario (7 ottobre 2026): «poter applicare una percentuale di investimento
// diversa per posizione, per ogni TP [...] e per le cripto viene utilizzata soltanto la strategia
// con la chiusura parziale: a mano a mano che si raggiunge il TP prescelto chiude una percentuale
// del lottaggio iniziale».
//
// Il difetto peggiore qui sarebbe silenzioso: le percentuali si salvano, sembrano funzionare e non
// cambiano niente. Questi test guardano i lotti che escono davvero dal calcolo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('le quote si normalizzano: contano i rapporti, non la somma', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      percento: tgAutoQuotePerSegnale({quote: [50, 30, 20]}, 3),
      rapporti: tgAutoQuotePerSegnale({quote: [5, 3, 2]}, 3),
      // Senza quote: parti uguali, come si è sempre fatto.
      vuote: tgAutoQuotePerSegnale({quote: []}, 4),
      // Più quote che target: si usano le prime, rinormalizzate.
      tagliate: tgAutoQuotePerSegnale({quote: [50, 30, 20, 10]}, 2)
    }));
    assert.deepEqual(r.percento, [0.5, 0.3, 0.2]);
    assert.deepEqual(r.rapporti, [0.5, 0.3, 0.2], '5/3/2 è lo stesso di 50/30/20');
    assert.deepEqual(r.vuote, [0.25, 0.25, 0.25, 0.25]);
    assert.deepEqual(r.tagliate, [0.625, 0.375]);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('zero ovunque non azzera il lotto: vale come parti uguali', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      zeri: tgAutoQuotePerSegnale({quote: [0, 0, 0]}, 3),
      negative: tgAutoQuotePerSegnale({quote: [-5, -5]}, 2),
      senzaCfg: tgAutoQuotePerSegnale(null, 2)
    }));
    // Una configurazione sbagliata non deve mai produrre un lotto nullo: si torna al sensato.
    assert.deepEqual(r.zeri, [1 / 3, 1 / 3, 1 / 3]);
    assert.deepEqual(r.negative, [0.5, 0.5]);
    assert.deepEqual(r.senzaCfg, [0.5, 0.5]);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// Il calcolo dei lotti, con un conto finto: entrata 100, stop 99 → si perde 1 per lotto.
// I target stanno VICINI al prezzo: oltre il 20% l'app li scarta come prezzi assurdi, e il test
// misurerebbe quel filtro invece delle quote.
const PIANO = (quote, minimo) => {
  window.realizedBalanceNow = () => 10000;
  window.currentPrice = () => 100;
  window.euroAtLevel = (a, b, l) => Math.abs(a - b) * l;
  window.marginForLots = () => 0;
  window.tgRischioTotale = () => 3;          // 3% di 10.000 = 300 da rischiare
  return tgPiano({direzione: 'BUY', stop_loss: 99, take_profit: [101, 102, 103]},
                 'OANDA:XAUUSD', 3,
                 {prezzo: 100, passo: 0.01, minimo: minimo || 0.01, quote});
};

test('con le quote, ogni target prende la sua fetta di rischio', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      const piano = eval('(' + p + ')')([0.5, 0.3, 0.2]);
      return {lottiTp: piano.lottiTp, rischio: Math.round(piano.rischioReale), problemi: piano.problemi};
    }, PIANO.toString());
    assert.equal(r.problemi, undefined);
    // 300 da rischiare: 150 / 90 / 60. A 1 per lotto → 150 / 90 / 60.
    assert.deepEqual(r.lottiTp, [150, 90, 60]);
    assert.equal(r.rischio, 300, 'la somma delle fette è il rischio scelto, non di più');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza quote resta tutto come prima: parti uguali', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      const piano = eval('(' + p + ')')(undefined);
      return {lottiTp: piano.lottiTp, lotti: piano.lotti};
    }, PIANO.toString());
    assert.equal(r.lottiTp, null, 'niente lotti per target: si usa quello unico, come prima');
    assert.equal(r.lotti, 100, '300 diviso 3 target, a 1 per lotto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il rischio scelto resta un tetto: si arrotonda per difetto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      // Con 7/2/1 le fette sono 210 / 60 / 30 del rischio, a 1 per lotto.
      const piano = eval('(' + p + ')')([0.7, 0.2, 0.1]);
      return {lottiTp: piano.lottiTp, rischio: piano.rischioReale};
    }, PIANO.toString());
    assert.deepEqual(r.lottiTp, [210, 60, 30]);
    assert.ok(r.rischio <= 300 + 1e-9,
      'mai piu\' del rischio scelto: un arrotondamento per eccesso qui sarebbe rischiare di piu\' senza saperlo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se una fetta non arriva al lotto minimo si torna alle parti uguali', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      // Lotto minimo 10: con 99 / 0,5 / 0,5 le ultime due fette (1,5 lotti) non ci arrivano.
      const piano = eval('(' + p + ')')([0.99, 0.005, 0.005], 10);
      return piano.lottiTp;
    }, PIANO.toString());
    // Meglio parti uguali che un ordine rifiutato dal broker a metà apertura.
    assert.equal(r, null);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
