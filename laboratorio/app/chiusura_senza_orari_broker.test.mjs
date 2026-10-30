// LA CHIUSURA PRIMA DEL MERCATO senza gli orari del broker.
//
// I test di chiusura_prima_del_mercato.test.mjs misurano la strada buona: gli orari veri dello
// strumento, quelli che manda il broker (orariAsset). Ma quegli orari arrivano da CAPITAL.COM: chi
// lavora solo con MT5 non ce li ha, e in quel caso l'app ripiega sul calendario con cui segue
// MT5 (lun-ven fino alle 22, riapertura alle 00).
//
// SEGNALATO dal proprietario (30 ottobre 2026): "l'app non chiude automaticamente le posizioni in
// profitto prima della chiusura di mercato". Misurato, il ripiego era muto in due casi su
// quattro, e per una ragione che non centrava niente con la posizione:
//
//   | situazione                                   | quanto manca alla chiusura |
//   |----------------------------------------------|----------------------------|
//   | grafico sullo STESSO asset della posizione    | 1 minuto  -> chiude        |
//   | grafico su un ALTRO asset                    | 1 minuto  -> chiude        |
//   | grafico su NESSUN asset                       | niente    -> NON chiude    |
//   | grafico su una CRIPTO                         | niente    -> NON chiude    |
//
// Il cancello guardava l'asset A GRAFICO (currentAssetKey) invece di quello della posizione da
// chiudere. Risultato: posizione in guadagno su EURCHF, grafico su una cripto o su niente, e
// oltre la chiusura del mercato nessuno la chiudeva - con lo spread che si apre di decine di pip.
//
// Cosa misura questo banco: il calendario si chiede dell'asset della POSIZIONE, non del grafico.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// 21:59 di Roma (CET, UTC+1) su un giorno feriale, cioe' 20:59 UTC: manca un minuto alle 22.
const UN_MINUTO_PRIMA = Date.UTC(2026, 9, 27, 20, 59, 0);
const TRE_MINUTI_PRIMA = Date.UTC(2026, 9, 27, 20, 57, 0);

const PREPARA = (assetAGrafico) => {
  liveModeActive = true;
  mt5Connected = true;
  orariAsset = {};                     // senza orari del broker: si usa il ripiego
  currentAssetKey = assetAGrafico;
  window.fblPlCorrente = () => 120;    // in guadagno
  tgAutoFx = tgAutoVuoto(); tgAuto = tgAutoFx; tgAutoFx.sale = {};
  const cfg = tgAutoUni(tgAutoFx);
  cfg.chiusuraPre = {attivo: true, minuti: 1};
  // La posizione torna indietro, cosi' la prova la usa invece di inventarne una sua.
  return {id: 'P1', asset: 'EURCHF', side: 'SELL', entry: 0.92828, sl: 0.92827,
          lots: 1.38, tgSala: 'Sala'};
};

test('grafico su un altro asset: la posizione si chiude lo stesso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(({p, t}) => {
      const pos = eval('(' + p + ')')('XAUUSD');
      return {manca: fblMancaAllaChiusura(pos.asset, t),
              decide: fblDaChiuderePrimaDellaChiusura(pos, t)};
    }, {p: PREPARA.toString(), t: UN_MINUTO_PRIMA});
    assert.ok(r.manca != null && r.manca <= 60000, 'deve sapere quanto manca alla chiusura');
    assert.equal(r.decide, true, 'il grafico non c\'entra: la posizione va chiusa');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('grafico su una cripto, o su niente: la posizione si chiude lo stesso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const casi = ['BINANCE:BTCUSDT', ''];
    for (const c of casi) {
      // UN argomento solo (Playwright non ne accetta di piu': li impacchetto).
      const r = await pagina.evaluate(({p, t, primo}) => {
        const pos = eval('(' + p + ')')(primo);
        return {primo: primo || '(niente)', manca: fblMancaAllaChiusura(pos.asset, t),
                decide: fblDaChiuderePrimaDellaChiusura(pos, t)};
      }, {p: PREPARA.toString(), t: UN_MINUTO_PRIMA, primo: c});
      assert.notEqual(r.manca, null, 'col grafico su ' + r.primo + ' il calendario non deve restare muto');
      assert.equal(r.decide, true,
        'la posizione su EURCHF va chiusa, qualsiasi cosa ci sia a grafico (' + r.primo + ')');
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: la cripto non chiude comunque, e lontano dalla chiusura nemmeno', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(({p, t, presto}) => {
      const pos = eval('(' + p + ')')('XAUUSD');
      // Una posizione SU una cripta: quelle non hanno chiusura, quindi non si toccano mai.
      const cripto = {id: 'P2', asset: 'BINANCE:BTCUSDT', side: 'BUY', entry: 60000, lots: 1, tgSala: 'Sala'};
      return {cripto: fblDaChiuderePrimaDellaChiusura(cripto, t),
              presto: fblDaChiuderePrimaDellaChiusura(pos, presto)};
    }, {p: PREPARA.toString(), t: UN_MINUTO_PRIMA, presto: TRE_MINUTI_PRIMA});
    assert.equal(r.cripto, false, 'le cripto non hanno chiusura: non si chiudono per orario');
    assert.equal(r.presto, false, 'tre minuti prima con la finestra a un minuto non si chiude');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
