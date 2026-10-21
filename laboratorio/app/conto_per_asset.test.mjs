// IL CONTO SEGUE L'ASSET.
//
// RICHIESTO dal proprietario: «dobbiamo fare in modo che se clicchiamo un asset appartenente al
// mondo forex, indici, azioni mi si ricollega in automatico al conto mt5, mentre se passo a una
// criptovaluta mi fa il passaggio automatico al conto kraken. È importante, mi raccomando, questo
// deve avvenire pure con i pulsanti vai al grafico delle posizioni aperte».
//
// DUE DOMANDE DIVERSE, e vanno tenute diverse. fblContoDiOperazione() guarda i campi di una
// POSIZIONE (su che conto è stata aperta davvero): è un fatto, e vince sempre. fblContoDiAsset()
// guarda l'ASSET, e risponde con la regola del mercato: le cripto si operano su Kraken, tutto il
// resto su MT5. La seconda serve quando la prima non sa rispondere — una posizione simulata non
// porta né ticket MT5 né riferimenti Kraken.
//
// L'ORO: è una materia prima, non un forex, ma si opera su MT5 come il forex. È lo stesso criterio
// che fblFamigliaAsset usa già per scegliere la strategia, e qui va tenuto uguale: due risposte
// diverse alla stessa domanda sarebbero una trappola.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('ogni tipo di asset sa su che conto si opera', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      btc: fblContoDiAsset('BTCUSD'), eth: fblContoDiAsset('ETHUSDT'), kraken: fblContoDiAsset('PF_SOLUSD'),
      eurusd: fblContoDiAsset('EURUSD'), gbpjpy: fblContoDiAsset('GBPJPY'),
      us30: fblContoDiAsset('US30'), nas: fblContoDiAsset('NAS100'),
      aapl: fblContoDiAsset('AAPL'),
      oro: fblContoDiAsset('XAUUSD'), argento: fblContoDiAsset('XAGUSD'),
      vuoto: fblContoDiAsset(''), nullo: fblContoDiAsset(null)
    }));
    assert.equal(r.btc, 'kraken'); assert.equal(r.eth, 'kraken');
    assert.equal(r.kraken, 'kraken', 'anche un contratto Kraken (PF_...) è una cripto');
    assert.equal(r.eurusd, 'mt5'); assert.equal(r.gbpjpy, 'mt5');
    assert.equal(r.us30, 'mt5'); assert.equal(r.nas, 'mt5');
    assert.equal(r.aapl, 'mt5', 'le azioni si operano su MT5');
    assert.equal(r.oro, 'mt5', 'l\'oro è una materia prima ma si opera su MT5, come il forex');
    assert.equal(r.argento, 'mt5');
    assert.equal(r.vuoto, null, 'senza asset non si cambia niente');
    assert.equal(r.nullo, null);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

const PREPARA = () => {
  liveModeActive = true;
  window._scelti = [];
  // Si registra QUALE conto viene chiesto: è la decisione che questi test devono misurare.
  // Il cambio vero richiede un conto collegato, che su un banco di prova non c'è.
  window.fblContoScegli = async (c) => { window._scelti.push(c); fblContoVista = c; };
  fblContoVista = 'capital';
};

test('passando a una cripto si va su Kraken, a un forex su MT5', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      await fblContoPerAsset('BTCUSD');
      const dopoCripto = fblContoVista;
      await fblContoPerAsset('EURUSD');
      const dopoForex = fblContoVista;
      await fblContoPerAsset('US30');
      return {dopoCripto, dopoForex, dopoIndice: fblContoVista, scelti: window._scelti};
    }, PREPARA.toString());
    assert.equal(r.dopoCripto, 'kraken');
    assert.equal(r.dopoForex, 'mt5');
    assert.equal(r.dopoIndice, 'mt5');
    assert.deepEqual(r.scelti, ['kraken', 'mt5'],
      'MT5 si chiede una volta sola: da forex a indice il conto e\' gia\' quello giusto — ' + r.scelti.join(','));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se il conto e\' gia\' quello giusto non si cambia niente', async () => {
  // Cambiare conto ricarica il grafico: farlo per niente vorrebbe dire ricaricarlo per niente.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      fblContoVista = 'kraken';
      const cambiato = await fblContoPerAsset('BTCUSD');
      return {cambiato, scelti: window._scelti};
    }, PREPARA.toString());
    assert.equal(r.cambiato, false);
    assert.deepEqual(r.scelti, [], 'nessun cambio di conto, quindi nessuna ricarica del grafico');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in Storico non si cambia conto: i conti sono una cosa del Live', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      liveModeActive = false;
      const cambiato = await fblContoPerAsset('BTCUSD');
      return {cambiato, scelti: window._scelti, vista: fblContoVista};
    }, PREPARA.toString());
    assert.equal(r.cambiato, false);
    assert.deepEqual(r.scelti, []);
    assert.equal(r.vista, 'capital', 'in Storico la vista non si tocca');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('«vai a grafico»: il conto della POSIZIONE vince sempre su quello dell\'asset', async () => {
  // Una posizione aperta davvero su MT5 su un asset cripto (capita: alcuni broker MT5 quotano
  // BTC) deve portare su MT5, non su Kraken. Il fatto batte la regola.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      await fblVaiAlContoDi({asset: 'BTCUSD', mt5Ticket: 12345});
      return {vista: fblContoVista, scelti: window._scelti};
    }, PREPARA.toString());
    assert.equal(r.vista, 'mt5', 'la posizione e\' su MT5: si va su MT5 anche se l\'asset e\' una cripto');
    assert.deepEqual(r.scelti, ['mt5']);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('«vai a grafico» su una posizione SIMULATA: decide l\'asset', async () => {
  // Il caso che prima non cambiava niente: una simulata non porta ne' ticket MT5 ne' riferimenti
  // Kraken, quindi fblContoDiOperazione rispondeva null e il conto restava quello di prima.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      await fblVaiAlContoDi({asset: 'BTCUSD', id: 'SIM1'});
      const cripto = fblContoVista;
      await fblVaiAlContoDi({asset: 'EURUSD', id: 'SIM2'});
      return {cripto, forex: fblContoVista, scelti: window._scelti};
    }, PREPARA.toString());
    assert.equal(r.cripto, 'kraken', 'una simulata su una cripto porta su Kraken');
    assert.equal(r.forex, 'mt5', 'e una su un forex porta su MT5');
    assert.deepEqual(r.scelti, ['kraken', 'mt5']);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
