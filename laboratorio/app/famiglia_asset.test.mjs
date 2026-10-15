// SU CHE TIPO DI ASSET STA OPERANDO: FOREX OPPURE CRIPTO.
//
// RICHIESTO dal proprietario: «quando arriva un segnale da un utente Syntra o anche Telegram che
// esegue operazioni sia su Forex che su Crypto, me lo identifica da qualche parte... almeno così
// anche nel trade journal e nelle tabelle posizioni aperte ho sotto controllo su che tipologia di
// asset sta operando».
//
// La famiglia si ricava dall'ASSET, non da un campo salvato: così vale anche per le operazioni
// aperte prima di oggi e non può MAI essere in disaccordo con lo strumento vero. È la stessa
// regola che decide quale delle due apertura automatiche vale per quel segnale (tgFamDaSimbolo).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('cripto e forex si riconoscono a colpo d\'occhio, e la regola e\' la stessa dell\'apertura automatica', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      btc: fblFamigliaBadgeHtml('BINANCE:BTCUSDT'),
      eur: fblFamigliaBadgeHtml('EURUSD'),
      oro: fblFamigliaBadgeHtml('XAUUSD'),
      vuoto: fblFamigliaBadgeHtml(''),
      // La stessa regola che sceglie quale delle due strategie automatiche vale per il segnale.
      famBtc: fblFamigliaAsset('BINANCE:BTCUSDT'), autoBtc: tgFamDaSimbolo('BINANCE:BTCUSDT'),
      famEur: fblFamigliaAsset('EURUSD'), autoEur: tgFamDaSimbolo('EURUSD')
    }));
    assert.match(r.btc, /Cripto/, 'il bitcoin deve essere segnato come cripto');
    assert.match(r.eur, /Forex/, 'EUR/USD deve essere segnato come forex');
    // CAMBIATO (richiesto dal proprietario, v153): le famiglie mostrate sono CINQUE — forex,
    // cripto, materia prima, indice, azione — non più due. L'oro è una MATERIA PRIMA.
    // Che poi segua la strategia FOREX dell'apertura automatica resta vero, ed è scritto nel
    // riquadro: sono due domande diverse, e le due righe qui sotto le tengono ferme entrambe.
    assert.match(r.oro, /Materia prima/, "l'oro è una materia prima, non una coppia di valute");
    assert.match(r.oro, /strategia FOREX/, "ma per l'apertura automatica segue la strategia forex");
    assert.equal(r.vuoto, '', 'senza asset non si inventa nessuna etichetta');
    assert.equal(r.famBtc, r.autoBtc, 'la famiglia mostrata deve essere la stessa che decide la strategia');
    assert.equal(r.famEur, r.autoEur);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l\'etichetta compare nelle posizioni aperte e nel Trade Journal', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const t0 = Date.now() - 100 * 60000;
      const R = [];
      for (let i = 0; i < 100; i++) R.push({date: new Date(t0 + i * 60000).toISOString(), open: 100, high: 100.5, low: 99.5, close: 100.2, volume: 5});
      rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
      currentAssetKey = 'BINANCE:BTCUSDT'; if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'BINANCE:BTCUSDT';
      liveModeActive = false; mt5Connected = false;
      positions = [{id: 'P1', asset: 'BINANCE:BTCUSDT', side: 'BUY', entry: 100, sl: 99, rrSl: 99, tp: 102,
                    lots: 0.1, marginUsed: 10, start: 10, startTime: t0, tgSala: 'Cripto VIP'}];
      trades = [{id: 'T1', asset: 'EURUSD', side: 'BUY', mode: 'backtest', entry: 1.1, exit: 1.11, sl: 1.09,
                 tp: 1.12, lots: 0.1, result: 'TP', pips: 10, pl: 10, pct: 1, account: 1000, strategy: '',
                 startTime: t0, closedAt: new Date(t0 + 60000).toISOString(), tgSala: 'Forex VIP'}];
      update();
      return {posizioni: document.getElementById('openPositions').innerHTML,
              journal: document.getElementById('journal').innerHTML};
    });
    assert.match(r.posizioni, /Cripto/, 'nella tabella delle posizioni aperte deve vedersi che e\' cripto');
    assert.ok(r.journal.length > 0, 'il Trade Journal deve avere la sua riga, altrimenti il test non prova niente');
    assert.match(r.journal, /Forex/, 'nel Trade Journal deve vedersi la famiglia dell asset');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
