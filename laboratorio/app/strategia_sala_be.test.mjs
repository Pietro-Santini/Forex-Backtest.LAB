// LA STRATEGIA DELLA SALA DEVE SPOSTARE LO STOP, ANCHE QUANDO IL GRAFICO GUARDA ALTROVE.
//
// SEGNALATO dal proprietario (19 novembre 2026): «quando vado ad aprire delle posizioni, dei
// segnali e delle sale, e vado a fare la configurazione e dico "al secondo take profit mi devi
// spostare le posizioni a break even"... non me lo fa più, non mi sposta più le posizioni a
// break even in maniera automatica».
//
// MISURATO (non supposto), facendo girare la strategia vera su una scena con posizioni REALI
// MT5 di un simbolo diverso da quello a grafico. Tre cose, tutte e tre sui soldi veri:
//
//  1. LA STRATEGIA E' OSTAGGIO DELL'ASSET A GRAFICO. `tgStrategiaValuta()` viene chiamata solo
//     da dentro `evaluate()`, che pero' esce prima in due casi che non c'entrano niente con i
//     segnali: se un'altra finestra duplicata «possiede» l'asset a grafico, e se lo storico
//     dell'asset a grafico non e' ancora stato scansionato. Misurato: con la scansione non
//     fatta, lo stop non si muove e la regola non risulta nemmeno valutata. Ma la strategia
//     governa posizioni di ALTRI simboli, e posizioni REALI che quella funzione non tocca mai:
//     non ha motivo di dipendere da cosa sta guardando il grafico in quel momento.
//
//  2. IL BREAK-EVEN IN PIP E' ANNIDATO NEL POSTO SBAGLIATO: sta dentro
//     `if(st.avvicinamento && !st.avvicinamento.fatto && ...)`. Chi accende solo il break-even
//     in pip - senza il pareggio anticipato - non lo vede scattare mai. E chi li accende tutti
//     e due lo perde appena il primo e' «fatto».
//
//  3. UNA REGOLA RIFIUTATA RESTA «FATTA» PER SEMPRE. Il numero del target finisce in `st.fatte`
//     anche quando non si e' spostata NESSUNA posizione (stop dentro la forbice, prezzo gia'
//     oltre, pareggio non calcolabile in quel momento). Al giro dopo la regola viene saltata, e
//     quello spostamento non avverra' mai piu'.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Grafico su XAUUSD; il segnale e le posizioni sono su EURUSD, come nel caso del proprietario
// (il grafico sta su un simbolo, le posizioni della sala su un altro).
// `valore_punto` e' il profitto per un movimento di 1,0 di prezzo (vedi _valore_punto nel ponte):
// per 0,1 lotti di EURUSD sono 10.000 nella valuta del conto.
const SCENA = (extra) => `(() => {
  const t0 = Date.now() - 100 * 60000;
  const R = [];
  for (let i = 0; i < 100; i++) {
    const p = 4000 + i * 0.5;
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: p, high: p + 2, low: p - 2, close: p, volume: 10});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'XAUUSD'; rowsAssetKey = 'XAUUSD';
  csvLibrary = [{id: 'mt5_live_XAUUSD', rows: R}];
  liveModeActive = true; mt5Connected = true; liveReplayActive = false;
  livePriceByAsset = {EURUSD: 1.1025, XAUUSD: 4050};

  positions = [{id: 'P1', asset: 'EURUSD', side: 'BUY', entry: 1.1000, sl: 1.0980, tp: 1.1030,
    lots: 0.1, mt5Ticket: 111, tgGruppo: 'G1', tgSala: 'Sala prova', tgTpIndice: 3,
    start: 0, startTime: t0}];
  mt5RealPositions = [{ticket: 111, symbol: 'EURUSD', side: 'BUY', volume: 0.1, price_open: 1.1000,
    sl: 1.0980, tp: 1.1030, bid: 1.1025, ask: 1.1026, price_current: 1.1025,
    commission: -0.2, swap: 0, valore_punto: 10000, digits: 5, point: 0.00001}];

  tgStrategie = {G1: Object.assign({
    sym: 'EURUSD', side: 'BUY', entry: 1.1000, sala: 'Sala prova', conto: 'mt5',
    tps: [1.1010, 1.1020, 1.1030], creato: Date.now(), fatte: [], tickets: ['111'],
    regole: [null, {quando: 2, dove: 'entrata'}, null]
  }, ${JSON.stringify(extra || {})})};
  return {slPrima: positions[0].sl};
})()`;

test('lo stop va a pareggio al secondo target anche se il grafico guarda un altro simbolo', async () => {
  // Il caso base, quello del proprietario: grafico su XAU, posizioni della sala su EUR, e lo
  // storico del simbolo a grafico non ancora scansionato - cosa normalissima subito dopo un
  // cambio asset o una riapertura.
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      ${SCENA()};
      slTpScanDoneForAsset = null;   // lo storico del simbolo A GRAFICO non e' stato scansionato
      evaluate();
      return {sl: positions[0].sl, fatte: (tgStrategie.G1.fatte || []).slice()};
    })()`);

    assert.ok(Math.abs(r.sl - 1.10004) < 1e-6,
      'lo stop doveva andare al pareggio della posizione (1,10004): e rimasto a ' + r.sl);
    assert.deepEqual(r.fatte, [2], 'la regola del secondo target doveva risultare eseguita');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('e anche quando un altra finestra duplicata possiede l asset a grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      ${SCENA()};
      slTpScanDoneForAsset = currentAssetKey;
      // Un'altra finestra sta mostrando lo stesso asset a grafico: la chiusura SL/TP delle
      // posizioni simulate spetta a lei, ma la strategia della sala non c'entra.
      anotherWindowOwnsAssetEvaluation = () => true;
      evaluate();
      return {sl: positions[0].sl, fatte: (tgStrategie.G1.fatte || []).slice()};
    })()`);

    assert.ok(Math.abs(r.sl - 1.10004) < 1e-6,
      'con una finestra duplicata aperta lo stop non si e mosso: ' + r.sl);
    assert.deepEqual(r.fatte, [2]);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il break-even in pip scatta anche senza il pareggio anticipato acceso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      ${SCENA({regole: [], bePip: {pip: 5, fatto: false}, avvicinamento: null})};
      slTpScanDoneForAsset = currentAssetKey;
      evaluate();
      return {sl: positions[0].sl, fatto: !!(tgStrategie.G1.bePip || {}).fatto};
    })()`);

    assert.equal(r.fatto, true, 'il break-even in pip non e stato nemmeno valutato');
    assert.ok(Math.abs(r.sl - 1.10004) < 1e-6,
      'raggiunti i pip di guadagno, lo stop doveva andare a pareggio: e rimasto a ' + r.sl);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una regola che non ha spostato niente non resta «fatta»: si riprova', async () => {
  // Il caso che spiega «non me lo fa piu'»: al primo giro lo spostamento viene rifiutato (qui
  // perche' il pareggio cadrebbe oltre il prezzo di quel momento), e la regola veniva comunque
  // segnata come fatta. Al giro dopo, col prezzo tornato buono, non si riprovava piu'.
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      ${SCENA({tps: [1.1002, 1.1005, 1.1010]})};
      slTpScanDoneForAsset = currentAssetKey;
      // Primo giro: il target n.2 (1,1005) E' stato toccato, ma il prezzo sta ancora dentro la
      // forbice del cambio giornata rispetto al pareggio (12 pip su EURUSD): mettere li' lo stop
      // vorrebbe dire regalarlo al primo allargamento, quindi il rifiuto e' giusto.
      mt5RealPositions[0].price_current = 1.1006;
      mt5RealPositions[0].bid = 1.1006; mt5RealPositions[0].ask = 1.1007;
      livePriceByAsset.EURUSD = 1.1006;   // il filtro della forbice legge di qui
      evaluate();
      const dopoPrimo = {sl: positions[0].sl, fatte: (tgStrategie.G1.fatte || []).slice()};
      // Secondo giro: il prezzo e' risalito, adesso lo stop a pareggio ci sta.
      mt5RealPositions[0].price_current = 1.1025;
      mt5RealPositions[0].bid = 1.1025; mt5RealPositions[0].ask = 1.1026;
      livePriceByAsset.EURUSD = 1.1025;
      evaluate();
      return {dopoPrimo, sl: positions[0].sl, fatte: (tgStrategie.G1.fatte || []).slice()};
    })()`);

    assert.equal(r.dopoPrimo.sl, 1.0980, 'premessa: al primo giro lo spostamento va rifiutato');
    assert.deepEqual(r.dopoPrimo.fatte, [],
      'una regola che non ha spostato niente non deve risultare «fatta»: altrimenti non si '
      + 'riprova mai piu. Trovato: ' + JSON.stringify(r.dopoPrimo.fatte));
    assert.ok(Math.abs(r.sl - 1.10004) < 1e-6,
      'al secondo giro, col prezzo buono, lo stop doveva andare a pareggio: ' + r.sl);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
