// PASSO 13 — Un segnale su uno strumento che NON esiste né su Kraken né su MT5, ma esiste su
// Capital.com, deve aprirsi su Capital.com. E deve essere una posizione SIMULATA: oggi invece,
// con MT5 collegato, finisce come ordine VERO a MT5 con l'epic di Capital.com, e il broker lo
// rifiuta (l'epic lo conosce solo Capital.com).
//
// DECISO dal proprietario (9 ottobre 2026):
//   - un segnale va su Capital.com SOLO se l'asset non esiste né su MT5 né su Kraken; se c'è su
//     MT5/Kraken si apre lì, come sempre;
//   - la ricerca su Capital.com accende da sola la connessione; se non c'è connessione NON tenta
//     (il segnale resta segnalato nel pannello, non si apre niente);
//   - le posizioni Capital.com sono una FAMIGLIA A PARTE nel Trade Journal, come "🐙 Kraken".
//
// La rete è tutta bloccata dal banco: Capital.com e il ponte MT5 vanno FINTI, e si controlla che a
// MT5 non arrivi NESSUN ordine. È il cuore del passo: mai mandare a MT5 un simbolo che non ha.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Prepara l'app come se fossimo SUl computer, con MT5 collegato e Capital.com disponibile.
// `mt5Conosce` dice se il broker MT5 ha quello strumento; `capitaleCollegato` se Capital.com
// risponde. Gli ordini a MT5 non partono davvero: vengono solo registrati.
const PREPARA = (mt5Conosce, capitaleCollegato) => {
  positions = []; pendingOrders = []; trades = [];
  mt5Connected = true;
  liveModeActive = true; fblContoVista = 'mt5';
  liveCredsDraft = {demo: true};
  // Capital.com "collegato" vuol dire: c'è già un token di sessione.
  capitalSessionTokens = capitaleCollegato ? {cst: 'cst-di-prova', securityToken: 'sec-di-prova'} : null;
  ensureCapitalConnected = async () => !!capitalSessionTokens;
  window.__ordiniMt5 = [];
  fetchMt5WithTimeout = async (p) => { window.__ordiniMt5.push(String(p)); return {ok: true, data: {ticket: 1}}; };
  // MT5: o conosce lo strumento, o non lo conosce affatto (null = "non c'è", non un errore di rete).
  resolveMt5SymbolForAsset = async () => (mt5Conosce ? 'AAPL.O' : null);
  // La libreria dell'app NON contiene l'asset: è Capital.com a doverlo trovare.
  window.availableAssets = () => ['EURUSD', 'XAUUSD', 'BINANCE:BTCUSDT'];
  // Capital.com finto: la ricerca trova l'epic AAPL, il prezzo c'è.
  capitalApiFetch = async (url) => {
    if (String(url).indexOf('/markets?searchTerm=') >= 0)
      return {ok: true, json: async () => ({markets: [{epic: 'AAPL', instrumentName: 'Apple Inc', instrumentType: 'SHARES'}]})};
    if (String(url).indexOf('/prices/AAPL') >= 0)
      return {ok: true, json: async () => ({prices: [{snapshotTimeUTC: '2099-01-01T00:00:00', closePrice: {bid: 190.5, ask: 190.6}}]})};
    return {ok: true, json: async () => ({})};
  };
  refreshLiveStreamSubscriptions = () => {};
};

const SEGNALE = {
  id: 'cap1', chat: 'Sala Azioni', sala: '@azioni', stato: 'nuovo', ricevuto_ms: Date.now(),
  segnale: {strumento: 'AAPL', direzione: 'BUY', entrata: 190, stop_loss: 185, take_profit: [200]}
};

test('MT5 non ha lo strumento ma Capital.com sì: il segnale va su Capital.com', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(false, true), PREPARA.toString());
    const r = await pagina.evaluate(async (seg) => {
      // La decisione vera, presa PRIMA di diramare: su quale conto va questo segnale?
      return {conto: await tgContoEffettivoPerSegnale(seg)};
    }, SEGNALE.segnale);
    assert.equal(r.conto, 'capital', 'deve aprirsi su Capital.com, non su MT5');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se MT5 conosce lo strumento, resta su MT5: Capital.com non c’entra', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(true, true), PREPARA.toString());
    const r = await pagina.evaluate(async (seg) => {
      return {conto: await tgContoEffettivoPerSegnale(seg)};
    }, SEGNALE.segnale);
    assert.equal(r.conto, 'mt5', 'il broker ce l’ha: si apre lì, come sempre');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza connessione a Capital.com non si tenta: niente apertura', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(false, false), PREPARA.toString());
    const r = await pagina.evaluate(async (seg) => {
      return {conto: await tgContoEffettivoPerSegnale(seg)};
    }, SEGNALE.segnale);
    assert.notEqual(r.conto, 'capital', 'senza connessione non si apre su Capital.com');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l’esecutore Capital.com apre simulato e NON tocca MT5', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(false, true), PREPARA.toString());
    const r = await pagina.evaluate(async (seg) => {
      const voce = {id: 'cap1', chat: 'Sala Azioni', sala: '@azioni', stato: 'nuovo', ricevuto_ms: Date.now(), segnale: seg};
      // Un piano già calcolato: qui si prova solo l'APERTURA, non il calcolo del rischio.
      const piano = {side: 'BUY', entry: 190.5, sl: 185, tp: [200], n: 1, lotti: 0.1,
                     problemi: [], pct: 1, importoTot: 100, pendente: false, entry: 190.5};
      await tgCapitalEseguiSegnale(voce, {sym: 'AAPL', piano});
      return {
        ordiniMt5: window.__ordiniMt5.length,
        pos: positions.map(p => ({asset: p.asset, account: p.account, side: p.side, sl: p.sl, tp: p.tp, sala: p.tgSala})),
        stato: voce.stato
      };
    }, SEGNALE.segnale);
    assert.equal(r.ordiniMt5, 0, 'a MT5 non deve arrivare nessun ordine per un asset Capital.com');
    assert.equal(r.pos.length, 1, 'deve nascere una posizione simulata');
    assert.equal(r.pos[0].account, 'capital', 'marcata come posizione di Capital.com');
    assert.equal(r.pos[0].asset, 'AAPL');
    assert.equal(r.pos[0].sala, 'Sala Azioni');
    assert.equal(r.stato, 'eseguito');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nel Trade Journal Capital.com è una famiglia a parte, non «Live»', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => ({
      capital: fblStatCalcoli.contoDi({account: 'capital', mode: 'live'}),
      live: fblStatCalcoli.contoDi({mode: 'live'}),
      kraken: fblStatCalcoli.contoDi({account: 'kraken', krakenConto: 'simulato-1'}),
      eCapital: [fblStatCalcoli.eCapital(fblStatCalcoli.contoDi({account: 'capital', mode: 'live'})),
                 fblStatCalcoli.eCapital('Live'), fblStatCalcoli.eCapital(null)]
    }));
    assert.ok(r.capital.indexOf('Capital.com') >= 0, 'la famiglia Capital.com ha il suo nome: ' + r.capital);
    assert.notEqual(r.capital, r.live, 'Capital.com e «Live» non sono la stessa voce');
    assert.equal(r.live, 'Live', 'nessuna regressione sul nome di prima');
    assert.ok(r.kraken.indexOf('Kraken') >= 0);
    assert.deepEqual(r.eCapital, [true, false, false]);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// Difetto latente del passo 13: nel ramo Capital.com di tgAutoValuta si assegnava `sym` PRIMA della
// sua dichiarazione (`let sym` più sotto): in JavaScript è un errore (TDZ) e l'apertura AUTOMATICA di
// un segnale Capital.com andava in errore. Qui si percorre tutto il ramo automatico.
test('apertura AUTOMATICA di un segnale Capital.com: nessun errore e posizione simulata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => eval('(' + p + ')')(false, true), PREPARA.toString());
    const r = await pagina.evaluate(async (seg) => {
      fetchLatestPriceRest = async () => ({price: 190.5});       // il prezzo lo dà Capital.com
      tgPiano = () => ({side:'BUY', entry:190.5, sl:185, tp:[200], n:1, lotti:0.1,
                        problemi:[], pct:1, importoTot:100, pendente:false});
      tgAutoDecidi = () => ({apri:true, rischio:100, spazio:2, avvicinamento:0, cfg:{}});
      consensoValido = () => true;
      fblRemoto = () => false; fblEMobile = () => false;         // sono il computer
      const voce = {id:'cap-auto', chat:'Sala Azioni', sala:'@azioni', stato:'nuovo', ricevuto_ms:Date.now(), parti:1, segnale:seg};
      await tgAutoValuta(voce, 'capital');
      return {pos: positions.map(p => ({asset: p.asset, account: p.account, side: p.side})),
              motivo: voce.autoMotivo || null, stato: voce.stato};
    }, SEGNALE.segnale);
    assert.equal(r.pos.length, 1, 'deve nascere UNA posizione Capital.com: ' + JSON.stringify(r));
    assert.equal(r.pos[0].account, 'capital');
    assert.equal(r.pos[0].asset, 'AAPL');
    assert.equal(r.stato, 'eseguito');
    assert.equal(r.motivo, null);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
