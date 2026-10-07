// Il Trade Journal di Kraken si ricostruisce dal server, e non si riempie di doppioni.
//
// RICHIESTO dal proprietario (7 ottobre 2026): «il conto Kraken deve rimanere in memoria dentro il
// server Oracle, così che quando rifaccio l'accesso quel conto è salvato con tutti i dati,
// dashboard compresa, trade journal».
//
// Il buco: le righe del giornale le scriveva l'app nel momento della chiusura. Con il server
// sempre acceso le posizioni si chiudono anche a app chiusa — ed è proprio il motivo per cui il
// server esiste — quindi quelle righe non nascevano per nessuno.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Una giornata vera sul conto: si apre, si aggiunge, si chiude in due volte, e si perde un trade.
const STORICO = [
  {ts: 1000, simbolo:'PF_XBTUSD', lato:'buy',  quantita:1, prezzo:100, tipo:'market', pnl:0,   commissione:0.1, cliOrdId:null},
  {ts: 2000, simbolo:'PF_XBTUSD', lato:'buy',  quantita:1, prezzo:110, tipo:'market', pnl:0,   commissione:0.1, cliOrdId:null},
  // chiusura parziale in guadagno (take profit)
  {ts: 3000, simbolo:'PF_XBTUSD', lato:'sell', quantita:1, prezzo:130, tipo:'take_profit', pnl:25, commissione:0.1, cliOrdId:null},
  // resto chiuso in perdita (stop)
  {ts: 4000, simbolo:'PF_XBTUSD', lato:'sell', quantita:1, prezzo:90,  tipo:'stop', pnl:-15, commissione:0.1, cliOrdId:null},
  // il funding non è un'operazione: non deve diventare una riga del giornale
  {ts: 4500, simbolo:'PF_XBTUSD', lato:'sell', quantita:0, prezzo:0,   tipo:'funding', pnl:-0.5, commissione:0, cliOrdId:null},
  // un altro contratto, aperto e chiuso
  {ts: 5000, simbolo:'PF_ETHUSD', lato:'sell', quantita:2, prezzo:50,  tipo:'market', pnl:0,  commissione:0.1, cliOrdId:null},
  {ts: 6000, simbolo:'PF_ETHUSD', lato:'buy',  quantita:2, prezzo:40,  tipo:'take_profit', pnl:20, commissione:0.1, cliOrdId:null}
];

const PREPARA = (storico) => {
  trades = [];
  // conto_id e' quello che non cambia se il conto viene rinominato: e' quello che fa da chiave.
  krakenConto = {collegato: true, ambiente: 'simulato', saldo: 10000,
                 conto_id: 'conto-1', conto_nome: 'Conto prova 1'};
  krakenStorico = storico;
  krakenLeggiStorico = async () => {};
  krakenCambioEur = async () => 1;          // 1 USD = 1 EUR: i numeri restano leggibili
  window.save = () => {};
  window.renderTrades = () => {};
  window.update = () => {};
};

test('le operazioni chiuse a app spenta tornano nel giornale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async ([prep, storico]) => {
      eval('(' + prep + ')')(storico);
      const quante = await krakenRicostruisciGiornale();
      return {quante, righe: trades.map(t => ({sym: t.krakenSimbolo, side: t.side,
        entry: t.entry, exit: t.exit, pl: t.pl, result: t.result, ric: !!t.krakenRicostruita}))};
    }, [PREPARA.toString(), STORICO]);
    assert.equal(r.quante, 3, 'due chiusure su BTC e una su ETH; il funding non conta');
    // Media d'ingresso: due acquisti a 100 e 110 fanno 105, non "l'ultimo prezzo".
    assert.equal(r.righe[0].entry, 105);
    assert.equal(r.righe[0].exit, 130);
    assert.equal(r.righe[0].result, 'TP');
    assert.equal(r.righe[0].pl, 24.9, 'profitto al netto della commissione');
    assert.equal(r.righe[1].result, 'SL');
    assert.equal(r.righe[2].sym, 'PF_ETHUSD');
    assert.equal(r.righe[2].side, 'SELL', 'si era aperto vendendo');
    assert.ok(r.righe.every(x => x.ric), 'si deve vedere che sono state ritrovate, non viste dal vivo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('rifarlo due volte NON raddoppia le righe', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async ([prep, storico]) => {
      eval('(' + prep + ')')(storico);
      await krakenRicostruisciGiornale();
      const dopoUno = trades.length;
      // Succede davvero: due dispositivi sullo stesso conto, o un semplice cambio di conto e
      // ritorno. Ogni riga porta una chiave ricavata dal dato del server, non dal momento in cui
      // l'app se n'è accorta.
      const aggiunte = await krakenRicostruisciGiornale();
      return {dopoUno, dopoDue: trades.length, aggiunte};
    }, [PREPARA.toString(), STORICO]);
    assert.equal(r.dopoUno, 3);
    assert.equal(r.dopoDue, 3, 'niente doppioni');
    assert.equal(r.aggiunte, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una riga già scritta dal vivo non viene riscritta dalla ricostruzione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async ([prep, storico]) => {
      eval('(' + prep + ')')(storico);
      // Come se l'app fosse stata aperta quando la prima posizione si è chiusa.
      trades.push({id: 1, account: 'kraken', krakenSimbolo: 'PF_XBTUSD', pl: 24.9,
                   krakenChiave: krakenChiaveRiga('conto-1', 'PF_XBTUSD', 3000)});
      const aggiunte = await krakenRicostruisciGiornale();
      return {aggiunte, totale: trades.length,
              dalVivo: trades.filter(t => !t.krakenRicostruita).length};
    }, [PREPARA.toString(), STORICO]);
    assert.equal(r.aggiunte, 2, 'le altre due sì, quella già presente no');
    assert.equal(r.totale, 3);
    assert.equal(r.dalVivo, 1, 'la riga vista dal vivo resta quella, non ne nasce una gemella');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('su un conto reale non si inventa niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async ([prep, storico]) => {
      eval('(' + prep + ')')(storico);
      // Sul conto reale lo storico delle esecuzioni non arriva all'app: si guarda su Kraken.
      krakenConto.ambiente = 'reale';
      return {aggiunte: await krakenRicostruisciGiornale(), righe: trades.length};
    }, [PREPARA.toString(), STORICO]);
    assert.deepEqual(r, {aggiunte: 0, righe: 0});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una posizione che si gira ricomincia da capo, non somma i due versi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (prep) => {
      // Comprata 1, poi venduta 2: chiude la lunga e ne apre una corta da 1.
      eval('(' + prep + ')')([
        {ts:1000, simbolo:'PF_XBTUSD', lato:'buy',  quantita:1, prezzo:100, tipo:'market', pnl:0,  commissione:0},
        {ts:2000, simbolo:'PF_XBTUSD', lato:'sell', quantita:2, prezzo:120, tipo:'market', pnl:20, commissione:0},
        {ts:3000, simbolo:'PF_XBTUSD', lato:'buy',  quantita:1, prezzo:110, tipo:'market', pnl:10, commissione:0}
      ]);
      await krakenRicostruisciGiornale();
      return trades.map(t => ({side:t.side, entry:t.entry, exit:t.exit}));
    }, PREPARA.toString());
    assert.equal(r.length, 2);
    assert.deepEqual(r[0], {side:'BUY', entry:100, exit:120}, 'chiude la lunga');
    // Il prezzo d'ingresso della corta è quello a cui si è girata, non la media con la lunga.
    assert.deepEqual(r[1], {side:'SELL', entry:120, exit:110});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
