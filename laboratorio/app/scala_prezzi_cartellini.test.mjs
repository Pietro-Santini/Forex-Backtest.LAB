// LA SCALA PREZZI MOSTRA L'ENTRATA, NON PIU' TARGET E STOP.
//
// RICHIESTO dal proprietario fra i punti del telefono: «via i cartellini TP/SL dalla barra dei
// prezzi». Su uno schermo da telefono quella striscia e' alta pochi millimetri: con tre o quattro
// posizioni aperte i cartellini diventavano una colonna di rettangoli uno sull'altro, che copriva
// i numeri della scala — cioe' l'unica cosa per cui la scala serve.
//
// LA COSA CHE QUESTO TEST DEVE DAVVERO PROTEGGERE non e' la sparizione: e' che l'informazione non
// se ne vada con i cartellini. Target e stop restano sulle loro linee a grafico e nella casella
// Target/Stop, col prezzo scritto. Un test che controllasse soltanto «i cartellini non ci sono
// piu'» resterebbe verde anche se il giorno che qualcuno spegne per sbaglio le linee dello stop
// non restasse scritto da nessuna parte a che prezzo chiude la posizione.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Una posizione aperta con stop e target DENTRO la vista: se stessero fuori dal range di prezzo
// visibile non verrebbe disegnato niente comunque, e il test misurerebbe il vuoto scambiandolo
// per una conferma (e' successo il 9 ottobre 2026, vedi PUBBLICARE.md).
const PREPARA = () => {
  const t0 = Date.UTC(2026, 9, 20, 10, 0, 0);
  const R = [];
  for (let i = 0; i < 200; i++) {
    R.push({date: new Date(t0 + i * 60000).toISOString(),
            open: 100, high: 100.8, low: 99.2, close: 100.1, volume: 10});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD';
  if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; mt5Connected = false;
  trades = []; active = null; pendingOrders = []; replayForm = null;
  positions = [{id: 'P1', asset: 'EURUSD', side: 'BUY', entry: 100, sl: 99.5, tp: 100.5,
                lots: 0.1, marginUsed: 10, start: 10, startTime: t0 + 10 * 60000}];
  positionsVisible = true;
};

test('sulla scala prezzi resta il cartellino dell\'entrata, e solo quello', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const originale = drawPriceAxisTag;
      const prezzi = [];
      drawPriceAxisTag = function(ctx, y, prezzo){ prezzi.push(Number(prezzo));
                                                   return originale.apply(this, arguments); };
      try { draw(); } finally { drawPriceAxisTag = originale; }
      return {prezzi};
    }, PREPARA.toString());
    assert.ok(r.prezzi.includes(100),
      'il cartellino dell\'entrata deve restare: ' + JSON.stringify(r.prezzi));
    assert.ok(!r.prezzi.includes(99.5),
      'lo stop NON va piu\' sulla scala prezzi: ' + JSON.stringify(r.prezzi));
    assert.ok(!r.prezzi.includes(100.5),
      'il target NON va piu\' sulla scala prezzi: ' + JSON.stringify(r.prezzi));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ma stop e target restano scritti a grafico: l\'informazione non se ne va', async () => {
  // La prova di controllo: se domani sparissero anche da qui, questo test diventa rosso e dice
  // che il prezzo dello stop non e' piu' scritto da nessuna parte sul grafico.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const originale = drawTpSlZoneBox;
      const caselle = [];
      drawTpSlZoneBox = function(ctx, o){ if (o) caselle.push({sl: Number(o.sl), tp: Number(o.tp)});
                                          return originale.apply(this, arguments); };
      try { draw(); } finally { drawTpSlZoneBox = originale; }
      return {caselle};
    }, PREPARA.toString());
    assert.equal(r.caselle.length, 1, 'la casella Target/Stop della posizione deve essere disegnata');
    assert.equal(r.caselle[0].sl, 99.5, 'con il prezzo dello stop: ' + JSON.stringify(r.caselle[0]));
    assert.equal(r.caselle[0].tp, 100.5, 'e quello del target: ' + JSON.stringify(r.caselle[0]));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
