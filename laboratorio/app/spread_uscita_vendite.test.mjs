// UNA VENDITA SI CHIUDE SULL'ASK, NON SUL PREZZO DEL GRAFICO.
//
// PERCHE'. Il grafico — il nostro e quello di MT5 — disegna il BID. Chi ha comprato chiude
// VENDENDO, cioè al bid: per lui il grafico dice già la verità. Chi ha venduto chiude COMPRANDO,
// cioè all'ASK, che sta sempre più in alto di tutto lo spread.
//
// Fino al 21 ottobre 2026 la simulazione confrontava stop e target delle vendite col bid. Le
// vendite sopravvivevano quindi a eventi che sul conto vero le avrebbero chiuse — ed è
// esattamente quello che è successo quella notte: tre SELL EURCHF chiuse dal broker a 0,92827
// mentre il bid stava a 0,92461 (spread 50 pip). Rifacendo quella notte in backtest non sarebbe
// successo niente: i risultati del simulato risultano migliori del reale proprio nei momenti
// peggiori, che è il modo più pericoloso di sbagliare.
//
// COSA RESTA FUORI, detto invece che nascosto: qui si modella lo spread sull'USCITA delle
// vendite, non sull'ENTRATA degli acquisti (che in simulazione entrano al prezzo del grafico
// invece che all'ask). In Modalità Prop Firm l'entrata lo spread ce l'ha già
// (applySpreadToEntry), quindi lì il giro è completo; fuori, la simulazione resta ottimista
// sugli acquisti quanto lo era prima — non di più.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// EURUSD: strumento noto all'app (pip 0,0001, spread tipico 0,6 → 0,00006 di prezzo).
// Candele piatte a 1,1000, con il massimo a 1,10003: il BID non arriva a 1,10005, l'ASK sì.
const PREPARA = () => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++) {
    R.push({date: new Date(t0 + i * 60000).toISOString(),
            open: 1.1000, high: 1.10003, low: 1.09997, close: 1.1000, volume: 5});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD';
  if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; mt5Connected = false;
  trades = []; active = null; pendingOrders = []; positions = [];
  window.T0 = t0;
};

test('lo spread di uscita vale solo per le vendite', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      return {
        vendita: fblSpreadUscita({asset: 'EURUSD', side: 'SELL'}),
        acquisto: fblSpreadUscita({asset: 'EURUSD', side: 'BUY'}),
        atteso: spreadCostForAsset('EURUSD')
      };
    }, PREPARA.toString());
    assert.ok(Math.abs(r.vendita - r.atteso) < 1e-12, 'una vendita paga lo spread in uscita');
    assert.equal(r.acquisto, 0, 'un acquisto chiude al bid: il grafico è già quello');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una VENDITA si chiude se lo stop è raggiunto dall\'ask, anche se il grafico non ci arriva', async () => {
  // È il cuore del difetto: la candela si ferma a 1,10003, lo stop è a 1,10005 — il grafico non
  // ci arriva. L'ask (1,10003 + 0,00006 = 1,10009) sì, e sul conto vero la posizione si chiude.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      positions.push({id: 'V', asset: 'EURUSD', side: 'SELL', entry: 1.0990, sl: 1.10005,
                      rrSl: 1.10005, lots: 0.1, marginUsed: 10, start: 10, startTime: window.T0});
      const massimoGrafico = Math.max(...rows.map(x => x.high));
      evaluate();
      return {aperte: positions.length, chiuse: trades.length, massimoGrafico,
              stop: 1.10005, spread: spreadCostForAsset('EURUSD')};
    }, PREPARA.toString());
    assert.ok(r.massimoGrafico < r.stop,
      'il banco deve rappresentare un grafico che NON tocca lo stop: ' + r.massimoGrafico);
    assert.equal(r.aperte, 0,
      'la vendita deve chiudersi: l\'ask (' + (r.massimoGrafico + r.spread) + ') supera lo stop');
    assert.equal(r.chiuse, 1);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un ACQUISTO non cambia: niente stop fantasma per colpa dello spread', async () => {
  // Il rischio opposto, e sarebbe peggio: chiudere acquisti che nella realtà restano aperti.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      // Minimo del grafico 1,09997, stop appena sotto: non deve scattare.
      positions.push({id: 'A', asset: 'EURUSD', side: 'BUY', entry: 1.1010, sl: 1.09995,
                      rrSl: 1.09995, lots: 0.1, marginUsed: 10, start: 10, startTime: window.T0});
      evaluate();
      return {aperte: positions.length, chiuse: trades.length};
    }, PREPARA.toString());
    assert.equal(r.aperte, 1, 'l\'acquisto resta aperto: il bid non ha toccato il suo stop');
    assert.equal(r.chiuse, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('e il target di una vendita arriva piu\' TARDI, non prima', async () => {
  // L'altra faccia della stessa medaglia, e va nella direzione giusta: per incassare, l'ask deve
  // scendere sotto il target, quindi il bid deve scendere ANCORA DI PIU'. Una simulazione che
  // ignora lo spread regala anche i target, non solo gli stop.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      // Minimo del grafico 1,09997. Target a 1,09999: col bid sarebbe preso, con l'ask no.
      positions.push({id: 'V2', asset: 'EURUSD', side: 'SELL', entry: 1.1010, tp: 1.09999,
                      lots: 0.1, marginUsed: 10, start: 10, startTime: window.T0});
      evaluate();
      const colBid = positions.length;
      // Il target di una vendita scatta quando l'ask ci arriva: ask = minimo + spread. Quindi
      // basta che il target NON stia sotto quel livello — un filo sopra e viene preso.
      positions[0] && (positions[0].tp = 1.09997 + spreadCostForAsset('EURUSD') + 0.000001);
      evaluate();
      return {colBid, dopo: positions.length, chiuse: trades.length};
    }, PREPARA.toString());
    assert.equal(r.colBid, 1, 'col solo bid il target sembrerebbe preso: con l\'ask non lo è');
    assert.equal(r.dopo, 0, 'sceso abbastanza, il target si prende');
    assert.equal(r.chiuse, 1);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
