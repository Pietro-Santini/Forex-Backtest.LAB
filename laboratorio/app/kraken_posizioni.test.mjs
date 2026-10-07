// Le posizioni Kraken: riquadro separato da quelle MetaTrader, stesse colonne, stessi pulsanti.
//
// RICHIESTO dal proprietario (7 ottobre 2026): «bisogna rispecchiare esattamente la tabella delle
// posizioni aperte collegate a MetaTrader: asset, side, entry, SL, TP, rischio/rendimento, lotti,
// margine, prezzo corrente e P/L live. Poi i pulsanti vai a grafico, seleziona e BE. Ma le
// posizioni Kraken non devono stare nella stessa casella di quelle di MetaTrader.»
//
// Sono due conti con valute e contratti diversi: tenerli nella stessa casella invita a sommare
// numeri che non si sommano.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const DUE_POSIZIONI = () => {
  krakenConto = {collegato: true, ambiente: 'simulato', saldo: 10000,
                 conto_id: 'conto-1', conto_nome: 'Conto prova 1', leva: 5};
  krakenPosizioni = {posizioni: [
    {simbolo: 'PF_XBTUSD', lato: 'BUY', quantita: 0.25, entrata: 80000, mark: 81500, sl: 79000,
     tp: [{prezzo: 83000, quantita: 0.12}, {prezzo: 86000, quantita: 0.13}], pnl: 375},
    {simbolo: 'PF_ETHUSD', lato: 'SELL', quantita: 3, entrata: 2500, mark: 2560, sl: 2520,
     tp: [{prezzo: 2400, quantita: 3}], pnl: -180}
  ]};
  krakenPendenti = [];
  krakenPosPannello();
};

test('le colonne sono le stesse della tabella MetaTrader, nello stesso ordine', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const kraken = [...document.querySelectorAll('#krakenPosPanel th')].map(t => t.textContent.trim());
      // La tabella MetaTrader, per confronto: è quella che si deve rispecchiare.
      const mt5 = [...document.querySelectorAll('#mt5PosPanel th')].map(t => t.textContent.trim());
      return {kraken, mt5};
    }, DUE_POSIZIONI.toString());
    assert.deepEqual(r.kraken,
      ['#', 'Asset', 'Side', 'Entry', 'SL', 'TP', 'R/R', 'Lotti', 'Margine', 'Prezzo corrente', 'P/L live', '']);
    // Stesse colonne di MT5, tolto il «Ticket» che su Kraken non esiste.
    assert.deepEqual(r.kraken, r.mt5.filter(x => x !== 'Ticket'));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il riquadro Kraken è separato da quello delle posizioni MetaTrader', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const wrap = document.getElementById('krakenPosPanelWrap');
      const tabellaApp = document.getElementById('openPositions');
      return {
        visibile: wrap.style.display !== 'none',
        // Il punto della richiesta: non deve stare dentro il pannello delle altre posizioni.
        dentroAltroPannello: tabellaApp.closest('.panel').contains(wrap),
        titolo: document.getElementById('krakenPosTitolo').textContent,
        // E il titolo non deve essere scritto due volte.
        titoliNelRiquadro: wrap.querySelectorAll('.label').length
      };
    }, DUE_POSIZIONI.toString());
    assert.equal(r.visibile, true);
    assert.equal(r.dentroAltroPannello, false, 'le due tabelle devono stare in riquadri diversi');
    assert.match(r.titolo, /Conto prova 1/);
    assert.equal(r.titoliNelRiquadro, 1, 'un titolo solo, non due uguali');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ogni riga ha vai a grafico, seleziona, BE e chiudi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      return [...document.querySelectorAll('#krakenPosPanel tbody tr')]
        .map(tr => [...tr.querySelectorAll('button')].map(b => b.textContent));
    }, DUE_POSIZIONI.toString());
    assert.equal(r.length, 2, 'due posizioni, due righe: non si nascondono a vicenda');
    r.forEach(b => assert.deepEqual(b, ['📍 Vai a grafico', 'Seleziona', 'BE', 'Chiudi']));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il rapporto rischio/rendimento usa lo stop di APERTURA, non quello di adesso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      // Prima riga: entrata 80.000, stop 79.000 (rischio 1.000), target più lontano 86.000
      // (rendimento 6.000) → 1:6.
      const celle = [...document.querySelectorAll('#krakenPosPanel tbody tr')[0].querySelectorAll('td')]
        .map(t => t.textContent.trim());
      return {rr: celle[6], lotti: celle[7], margine: celle[8]};
    }, DUE_POSIZIONI.toString());
    assert.equal(r.rr, '1:6');
    assert.equal(r.lotti, '0,25');
    // Margine = quantità × prezzo / leva = 0,25 × 81.500 / 5 = 4.075.
    assert.match(r.margine, /4\.?075/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('«Seleziona» evidenzia, e ripremendolo si toglie', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const riga = () => document.querySelectorAll('#krakenPosPanel tbody tr')[0];
      const bottone = () => [...riga().querySelectorAll('button')][1];
      const prima = riga().className;
      bottone().click();
      const dopo = {classe: riga().className, testo: bottone().textContent, scelta: krakenSelezionata};
      bottone().click();
      return {prima, dopo, tolta: krakenSelezionata};
    }, DUE_POSIZIONI.toString());
    assert.equal(r.prima, '');
    assert.equal(r.dopo.classe, 'focused');
    assert.equal(r.dopo.testo, '✓ Selezionata');
    assert.equal(r.dopo.scelta, 'PF_XBTUSD');
    assert.equal(r.tolta, '', 'ripremendo si deseleziona');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza posizioni il riquadro non occupa spazio', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      krakenConto = {collegato: true, ambiente: 'simulato', saldo: 10000, conto_id: 'c1'};
      krakenPosizioni = {posizioni: []}; krakenPendenti = [];
      krakenPosPannello();
      return document.getElementById('krakenPosPanelWrap').style.display;
    });
    assert.equal(r, 'none');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
