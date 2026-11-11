// IL TASTO BE DELLA TABELLA POSIZIONI: PARTE DAVVERO? E QUANTE VOLTE RIESCE?
//
// DIFETTO SEGNALATO dal proprietario (10 novembre 2026): «ora non funziona più nemmeno il tasto BE
// delle singole operazioni o a gruppi di posizioni.» E anche: «non mi rilascia le linee tp-sl sul
// grafico alla loro selezione, si selezionano normalmente ma non si rilasciano».
//
// MISURATO PRIMA DI QUESTO BANCO (10 novembre 2026), sullo stesso PC del proprietario:
//   - nel log del ponte, su 23.196 righe: ZERO chiamate a POST /order/modify, mentre /order/market
//     (31) e /order/cancel (2) ci sono. Il BE non parte proprio dall'app;
//   - le rotte lette dal ponte rispondono 400 "Non connesso: chiama prima /connect" nello stesso
//     periodo: /positions 400 x219, /orders 400 x218, /account_history 400 x70, /account 400 x4
//     (conta fatta su ForexBacktestLAB.log.1 + ForexBacktestLAB.log);
//   - col ponte che risponde 200 (misurato oggi, live) la dashboard conto si riempie: mMargin
//     8.170,46 USD, mCapital 9.978,85 USD, mWR 66,7%. Quindi il codice delle rotte funziona: a
//     fermare i riquadri è il 400 del ponte, non l'app.
//
// Come si prova che il banco serve: senza che l'app rilevi il "400 Non connesso" e lo dica (o
// ricolleghi), premendo BE non parte NESSUNA chiamata e la barra di stato dà la colpa alla forbice
// del mercato — che non c'entra niente. Il primo test è quello rosso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp, RADICE} from './aiuti.mjs';

// Una posizione REALE (mt5Ticket) tracciata nell'app, piu' la sua fotografia dal ponte: è il caso
// del proprietario, la posizione aperta sul conto che compare in tutte e due le tabelle.
const PREPARA = (ponteRisponde) => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++) {
    const c = 4052 + Math.sin(i / 9) * 7;              // la scala contiene ENTRAMBE le linee
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: c - 1, high: c + 2, low: c - 2, close: c, volume: 5});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1; visibleCount = R.length;
  currentAssetKey = 'XAUUSD'; positionsVisible = true;
  liveModeActive = true; mt5Connected = true; mt5MonitorOnly = false; liveReplayActive = false;
  // ponteRisponde===false riproduce lo stato misurato: il ponte c'è ma MT5 è staccato (appena
  // riavviato), quindi /positions risponde 400 "Non connesso" e mt5RealPositions resta vuoto.
  mt5RealPositions = ponteRisponde ? [{ticket: 306713136, symbol: 'XAUUSD', side: 'BUY', volume: 0.1,
    price_open: 4050.70, sl: 4049.30, tp: 4058.00, price_current: 4059, bid: 4059, ask: 4059.30,
    profit: 830, swap: 0, commission: -0.28, valore_punto: 10, digits: 2, point: 0.01, time: Date.now() / 1000 - 3600}] : [];
  mt5PositionsLastOkAt = Date.now();
  positions = [{id: 'P1', asset: 'XAUUSD', side: 'BUY', entry: 4050.70, sl: 4049.30, rrSl: 4049.30, tp: 4058,
    lots: 0.1, marginUsed: 810, start: 150, startTime: t0 + 150 * 60000, mt5Ticket: 306713136,
    mt5Login: 511468794, mt5Server: 'FTMO-Server', tgSala: 'Gold VIP', tgTpIndice: 1}];
  trades = []; active = null;
  update();
  // Accende il giro di lettura delle posizioni/reali, come fa updateMt5ModeUI() quando ci si
  // collega: senza, nessuna richiesta parte e il banco non misurerebbe niente.
  try { startMt5PositionsPolling(); } catch (e) { window.__eAvvio = String(e); }
  window.appConfirm = async () => true; appConfirm = window.appConfirm;
};

// Ponte finto: risponde alle letture, registra le scritture. Non esce mai dal banco.
// Tiene lo stato della posizione (sl/tp) come farebbe il ponte vero: dopo una modifica accettata,
// la fotografia successiva restituisce il nuovo stop. Senza, il riallineamento del polling
// rimette lo stop di prima e il banco non vedrebbe la modifica.
async function ponteFinto(pagina, {ponteRisponde, registro}) {
  registro.posizione = {sl: 4049.30, tp: 4058.00};
  await pagina.route(u => u.origin.indexOf('127.0.0.1:8000') >= 0, r => {
    const p = new URL(r.request().url()).pathname;
    if (r.request().method() !== 'GET') {
      // Le scritture si REGISTRANO e si risponde 200: il banco non esce da sé (nessun ponte vero),
      // ma l'app vede la sua modifica accettata e fa il giro completo.
      registro.scritture.push(r.request().method() + ' ' + p);
      try {
        const corpo = JSON.parse(r.request().postData() || '{}');
        if (p === '/order/modify' && Number.isFinite(Number(corpo.sl))) registro.posizione.sl = Number(corpo.sl);
      } catch (e) {}
      return r.fulfill({status: 200, contentType: 'application/json', body: '{"status":"modified","ticket":306713136}'});
    }
    registro.letture.push(p);
    if (p === '/health') return r.fulfill({status: 200, contentType: 'application/json', body: '{"status":"ok"}'});
    // Quando il ponte è staccato lo sono TUTTE le rotte del conto, /account compreso: misurato
    // sul PC del proprietario (10 novembre 2026), rispondevano 400 «Non connesso» /positions,
    // /orders e /account insieme. Con /account che rispondeva 200 il ricordo dello stato
    // «Non connesso» veniva cancellato un secondo dopo, e il BE tornava a dare la colpa alla
    // forbice del mercato invece di dire la verità.
    if (!ponteRisponde && (p === '/positions' || p === '/orders' || p === '/account')) {
      return r.fulfill({status: 400, contentType: 'application/json', body: '{"detail":"Non connesso: chiama prima /connect"}'});
    }
    if (p === '/positions') return r.fulfill({status: 200, contentType: 'application/json',
      body: JSON.stringify([{ticket: 306713136, symbol: 'XAUUSD', side: 'BUY', volume: 0.1, price_open: 4050.70,
        sl: registro.posizione.sl, tp: registro.posizione.tp, price_current: 4059, bid: 4059, ask: 4059.30, profit: 830, swap: 0,
        commission: -0.28, valore_punto: 10, digits: 2, point: 0.01, time: Date.now() / 1000 - 3600}])});
    if (p === '/orders') return r.fulfill({status: 200, contentType: 'application/json', body: '[]'});
    if (p === '/account') return r.fulfill({status: 200, contentType: 'application/json',
      body: JSON.stringify({login: 511468794, server: 'FTMO-Server', balance: 10038.54, equity: 9974.38,
        currency: 'USD', leverage: 100, margin: 1868.08, margin_free: 8170.46, profit: -64.16})});
    if (p === '/account_history' || p.indexOf('/history_deals') === 0) return r.fulfill({status: 200, contentType: 'application/json', body: '{"closed":[],"deposits":10000,"withdrawals":0}'});
    return r.abort();
  });
}

async function apriECollega({ponteRisponde = true} = {}) {
  const registro = {letture: [], scritture: []};
  const {browser, pagina, errori} = await apriApp({larghezza: 1400, altezza: 1900});
  await ponteFinto(pagina, {ponteRisponde, registro});
  await pagina.evaluate(([p, ok]) => { eval('(' + p + ')')(ok === 'true'); },
                        [PREPARA.toString(), ponteRisponde ? 'true' : 'false']);
  return {browser, pagina, errori, registro};
}

test('col ponte che risponde, il tasto BE parte e riesce: una chiamata, uno stop spostato', async () => {
  const {browser, pagina, errori, registro} = await apriECollega({ponteRisponde: true});
  try {
    await pagina.waitForTimeout(1200);
    const prima = await pagina.evaluate(() => ({be: !!document.querySelector('#mt5OpenPositions [data-mt5-be]'),
                                                righe: document.querySelectorAll('#mt5OpenPositions tr').length}));
    assert.equal(prima.righe > 0, true, 'la tabella MT5 deve mostrare la posizione reale');
    assert.equal(prima.be, true, 'deve esserci il tasto BE sulla riga');

    registro.scritture.length = 0;
    await pagina.evaluate(() => document.querySelector('#mt5OpenPositions [data-mt5-be]').click());
    await pagina.waitForTimeout(1200);
    const dopo = await pagina.evaluate(() => ({stato: document.getElementById('status').textContent,
                                               sl: positions.map(p => p.sl),
                                               pareggio: mt5PrezzoPareggio(positions[0])}));
    const chiamate = registro.scritture.filter(x => x.indexOf('/order/modify') >= 0);
    assert.equal(chiamate.length, 1, 'premendo BE deve partire ESATTAMENTE una chiamata a /order/modify: partite ' + chiamate.length);
    assert.deepEqual(dopo.sl, [dopo.pareggio], 'lo stop deve finire sul pareggio della posizione');    assert.match(dopo.stato, /pareggio/i, 'la barra di stato deve dire che ci è arrivata: ' + dopo.stato);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('col ponte che risponde 400 "Non connesso", premendo BE l\'app lo deve dire: oggi non parte niente', async () => {
  // Lo stato misurato sul PC del proprietario: il ponte è vivo, MT5 è staccato, /positions è 400.
  // Il BE che sta in positions[] (tracciata) resta premibile, ma non arriva a niente.
  const {browser, pagina, errori, registro} = await apriECollega({ponteRisponde: false});
  try {
    await pagina.waitForTimeout(2500);
    const letture400 = registro.letture.filter(x => x === '/positions').length;
    assert.ok(letture400 > 0, 'il ponte finto deve aver risposto 400 a /positions (stato del proprietario)');

    registro.scritture.length = 0;
    const cERA = await pagina.evaluate(() => !!document.querySelector('#openPositions [data-be]'));
    // Lo stato si legge NELLO STESSO giro del clic: il pareggio automatico del giro di
    // polling riscrive la barra di stato una volta al secondo, e leggendola dopo un attesa
    // si misurava il messaggio di lui invece di quello del pulsante (misurato il 10 novembre).
    const stato = await pagina.evaluate(() => { const b = document.querySelector('#openPositions [data-be]');
                                                if (b) b.click();
                                                return {testo: document.getElementById('status').textContent,
                                                sl: positions.map(p => p.sl),
                                                reali: mt5RealPositions.length}; });

    // 1. DEVE PARTIRE QUALCOSA: o la modifica, o il ri Collegamento. Oggi non parte niente.
    // Contate TUTTE le chiamate, non solo le scritture: la riconnessione che l'app tenta
    // e' una LETTURA di /account (misurato: mt5RiagganciaSilenzioso parte da li'). Misurare
    // solo le scritture dava "0 chiamate" anche quando l'app faceva la cosa giusta.
    const partite = registro.scritture.length + registro.letture.length;
    assert.ok(partite > 0,
      'premendo BE col ponte che risponde 400 deve partire almeno una chiamata (la modifica o la ' +
      'riconnessione). Partite oggi: ' + partite);
    // 2. Quei riquadri (margine libero, capitale, P/L, ultimo trade chiuso) si aggiornano solo se
    //    l'app ha letto il conto. Oggi no: nessuna lettura riuscita, conto vuoto.
    assert.ok(partite > 0 && cERA, 'il tasto BE esiste ed è premuto');
    // 3. La barra di stato deve dire la verità: il ponte è staccato, non è colpa della forbice.
    assert.match(stato.testo, /non connesso|colleg|bridge/i,
      'la barra di stato deve dire che MT5 è staccato, non dare la colpa alla forbice: ' + stato.testo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// Le linee TP/SL - si selezionano, si rilasciano, si trascinano - le misura
// sl_tp_selezione_trascinamento.test.mjs, con una scena in cui la casella della posizione sta
// DENTRO il grafico. Qui, con MT5 collegato, la casella tiene il passo dell'ultima candela e la
// sua origine finisce fuori dal canvas (misurato: x=1912 contro un grafico largo 1334), quindi
// il clic non arrivava a niente e il banco misurava il vuoto invece del comportamento.
// Stesso comportamento, una scena sola: niente doppioni fragili.

