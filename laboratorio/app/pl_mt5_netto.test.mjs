// P/L LIVE delle posizioni reali MT5 — deve essere IDENTICO a quello del terminale.
// Il risultato vero di un'operazione aperta è: profitto di prezzo (POSITION_PROFIT) + swap
// cumulato (POSITION_SWAP) + commissione d'ingresso (dai deal): le tre cifre che MT5 tiene in
// campi separati, la cui SOMMA è il netto del conto. Prima l'app somma solo profit+swap
// (commissione dimenticata) e, sull'etichetta a grafico e nel tooltip, ricalcolava perfino in
// locale col prezzo di un'ALTRA fonte dati: da lì il divario segnalato dal proprietario
// ("+208 sul grafico della mia applicazione" contro "+190 su MT5"). Questi test bloccano la
// regressione: per una posizione reale si usa SEMPRE la fotografia del bridge (mt5RealNet).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Conto MT5 collegato: profit 100, swap -8, commissione -2 -> NETTO 90.
const PREPARA = () => {
  positions = [{id:1, asset:'XAUUSD', side:'BUY', entry:2000, sl:1990, tp:2010, lots:0.5, mt5Ticket:123, mode:'live'}];
  pendingOrders = []; trades = [];
  liveModeActive = true; mt5Connected = true; mt5MonitorOnly = false;
  fblContoVista = 'mt5';
  mt5RealPositions = [{ticket:123, symbol:'XAUUSD', side:'BUY', volume:0.5,
    price_open:2000, price_current:2005, sl:1990, tp:2010, profit:100, swap:-8, commission:-2}];
};

test('netto di una posizione reale = profit+swap+commission (non solo profit+swap)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(), PREPARA.toString());
    const r = await pagina.evaluate(() => ({
      net: mt5RealNet(123),
      comm: mt5RealCommission(123),
      totale: computeTotalLivePL(),
      blocco: fblPlCorrente(positions[0]),
    }));
    assert.equal(r.net, 90, 'netto = 100 (prezzo) - 8 (swap) - 2 (commissione)');
    assert.equal(r.comm, -2, 'la commissione d\'ingresso si legge dalla fotografia');
    assert.equal(r.totale, 90, 'il box "P/L Live" somma il NETTO, commissione inclusa');
    assert.equal(r.blocco, 90, 'la chiusura a blocco legge lo stesso netto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l\'etichetta (posLivePL) usa il netto di MT5, MAI il prezzo di un\'altra fonte', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(), PREPARA.toString());
    const r = await pagina.evaluate(() => {
      // Lotti enormi: se l'etichetta ricalcolasse col prezzo locale, il numero esploderebbe.
      // Con il netto del terminale resta identico a quello di MT5.
      positions[0].lots = 1000;
      return {etichetta: posLivePL(positions[0]), net: mt5RealNet(123)};
    });
    assert.equal(r.etichetta, 90, 'per una posizione reale vale il netto del terminale');
    assert.equal(r.etichetta, r.net);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('commissione assente nella fotografia: il netto resta profit+swap (nessuna rottura)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(), PREPARA.toString());
    const r = await pagina.evaluate(() => {
      mt5RealPositions[0] = Object.assign({}, mt5RealPositions[0], {commission: undefined});
      return {net: mt5RealNet(123)};
    });
    assert.equal(r.net, 92, '100 - 8: la commissione mancante conta 0, non fa sparire la cifra');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una posizione SIMULATA non prende il netto di un ticket del bridge', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(), PREPARA.toString());
    const r = await pagina.evaluate(() => {
      // Posizione senza ticket; nel bridge c'e' per sbaglio un ticket con netto 1000.
      positions = [{id:2, asset:'XAUUSD', side:'BUY', entry:2000, sl:1990, tp:2010, lots:0.1}];
      mt5RealPositions = [{ticket:999, profit:1000, swap:0, commission:0}];
      return {v: posLivePL(positions[0])};
    });
    assert.ok(r.v !== 1000, 'una posizione simulata non legge la fotografia MT5');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
