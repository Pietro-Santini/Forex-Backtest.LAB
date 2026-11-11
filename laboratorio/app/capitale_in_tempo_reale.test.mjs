// BANCO — «margine libero e capitale non si aggiornano in tempo reale, o sono in
//
// CURATO nella v2.2.29 (11 novembre 2026). Rosso prima, verde dopo:
//   - prima: /account letto 1 volta in 8 secondi contro 9 letture di /positions;
//   - dopo : 9 contro 9, e capitale e margine libero cambiano quanto il P/L live.
// Le due cure stanno in app.html: il cancello tolto da mt5PositionsGiro e l'avviso che in
// Modalita' Prop Firm non tace piu' quando il conto non arriva (mostraFonteCapitale).
// ritardo di minuti; il P/L invece sì».
//
// DIFETTO SEGNALATO dal proprietario (11 novembre 2026), testuale: «il riquadro che non mi si
// aggiorna in tempo reale è questo qua, e in modalità pagina intera è quella sulla barra degli
// strumenti sotto, che c'è comunque il margine libero, il capitale e tutto il resto che non mi
// si aggiorna in tempo reale. O comunque sia in ritardo... deve essere un aggiornamento come si
// aggiorna il profitto, si aggiorna anche il capitale, il margine libero. E tutto il resto.»
// Nella foto: margine libero 11.102,54 e capitale 11.102,54 (identici), sotto il capitale
// l'etichetta «Capitale della Challenge Prop Firm (simulato)» — conto in Modalità Prop Firm.
//
// QUESTO BANCO NON CORREGGE: misura. Mette in piedi un ponte MT5 finto che risponde SUBITO e
// con numeri sempre nuovi, accende il polling VERO dell'app (startMt5PositionsPolling) e conta,
// nella stessa finestra di 8 secondi:
//   - quante volte l'app legge /positions   (la strada del P/L)
//   - quante volte l'app legge /account     (la strada di capitale e margine libero)
//   - quante volte CAMBIA il testo di #mCapital, #mMargin e del box P/L live
//
// MISURA DI OGGI (v2.2.28): /positions 9 letture, /account 1 sola — quella del collegamento.
// Il P/L cambia 9 volte, capitale e margine libero 1 volta e poi restano fermi per sempre.
// Causa nel mirino: app.html riga 42822-42826
//     function mt5PositionsGiro(){
//      fetchMt5Positions();
//      fetchMt5Orders();
//      if(!mt5PositionsFetchInFlight&&!mt5OrdersFetchInFlight)fetchMt5AccountInfo();
//     }
// le due chiamate della riga sopra alzano quei due interruttori in modo SINCRONO (prima del
// loro primo await): quando si arriva al controllo sono sempre e comunque alzati, quindi
// /account non parte mai. Gli unici due chiamanti di fetchMt5AccountInfo sono la riga 42805
// (collegamento) e questa riga 42825 (sbarrata).
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

// Gli aiuti del banco di prova stanno nel repository: questo banco vive fuori da
// laboratorio/app, quindi se la copia accanto non c'è si va a prendere quella vera.
const REPO_AIUTI = 'C:/Users/pietro/Documents/GitHub/Forex-Backtest.LAB/laboratorio/app/aiuti.mjs';
let aiuti;
try { aiuti = await import('./aiuti.mjs'); }
catch (e) { aiuti = await import(pathToFileURL(REPO_AIUTI).href); }
const {apriApp, PREPARA_BTC} = aiuti;

const FINESTRA_MS = 8000;

// Stato di chi sta operando dal vivo col terminale MT5 attaccato al ponte, una posizione reale
// aperta e il grafico alimentato da MT5. `propFirm` accende la Modalità Prop Firm, `accountRotto`
// fa rispondere /account con il 400 «Non connesso» del ponte.
function scenarioInPagina({propFirm, accountRotto, finestraMs}) {
  return async ({propFirm, accountRotto, finestraMs}) => {
    fblContoVista = 'mt5';
    mt5Connected = true; liveModeActive = true; liveReplayActive = false; mt5MonitorOnly = false;
    mt5ContoAttivo = {login: '11111', server: 'Banco-Demo', reale: false};
    mt5ActiveSymbol = 'EURUSD'; currentAssetKey = 'EURUSD';
    lastMt5TickPrice = 1.1000; lastMt5RealTickAt = Date.now();
    mt5AccountHistory = {closed: [], deposits: 10000, withdrawals: 0};
    document.getElementById('capital').value = '11000';
    if (propFirm) {
      isPropFirmMode = true; pfRealMt5Login = null; pfPendingDecisionLogin = null;
      // qualche giro dell'app rimette a posto lo stato da solo: la si tiene accesa
      setInterval(() => { isPropFirmMode = true; }, 100);
    }

    // Una posizione reale già adottata in app, come fa il polling vero.
    positions.length = 0;
    positions.push({id: 1, side: 'BUY', entry: 1.1000, lots: 1, sl: 1.0950, tp: 1.1100,
      marginUsed: 250, asset: 'EURUSD', mt5Ticket: 777, mt5Login: '11111', mt5Server: 'Banco-Demo',
      openedAt: Date.now() - 60000});
    livePriceByAsset['EURUSD'] = 1.1000;

    // ---- PONTE FINTO: risponde subito, e ogni risposta porta numeri NUOVI ----
    let profitto = 102.54, equity = 11102.54;
    const letture = {account: 0, positions: 0, orders: 0};
    window.fetchMt5WithTimeout = async (path) => {
      const p = String(path || '');
      if (p.startsWith('/account_history')) return {ok: true, status: 200, data: {closed: [], deposits: 10000, withdrawals: 0}};
      if (p.startsWith('/account')) {
        letture.account++;
        if (accountRotto) return {ok: false, status: 400, message: 'Non connesso', data: null};
        equity += 7.13;
        return {ok: true, status: 200, data: {login: 11111, server: 'Banco-Demo', equity: equity,
          balance: 11000, margin_free: equity - 250, margin: 250, currency: 'EUR', reale: false}};
      }
      if (p.startsWith('/positions')) {
        letture.positions++; profitto += 3.41;
        return {ok: true, status: 200, conto: {login: '11111', server: 'Banco-Demo'},
          data: [{ticket: 777, symbol: 'EURUSD', side: 'BUY', volume: 1, price_open: 1.1000,
            sl: 1.0950, tp: 1.1100, profit: profitto, swap: 0, commission: 0,
            bid: 1.1010, ask: 1.1011, point: 0.00001, margine: 250,
            time: Math.floor((Date.now() - 60000) / 1000)}]};
      }
      if (p.startsWith('/orders')) { letture.orders++; return {ok: true, status: 200, data: []}; }
      return {ok: false, status: 400, message: 'Non connesso', data: null};
    };

    // La fascia della barra degli strumenti in modalità pagina intera (#fblMiniDash).
    try { fblMiniDashMostra(document.getElementById('resetView') || document.body.firstElementChild); } catch (e) {}

    // Contatori: quante volte CAMBIA davvero il testo di ogni riquadro.
    const cambi = {}; const visti = {};
    for (const id of ['mCapital', 'mMargin', 'liveValue', 'fblMiniDash']) {
      const el = document.getElementById(id);
      if (!el) { cambi[id] = -1; continue; }
      cambi[id] = 0; visti[id] = [];
      let prima = el.textContent;
      new MutationObserver(() => {
        if (el.textContent === prima) return;
        prima = el.textContent; cambi[id]++;
        if (visti[id].length < 12) visti[id].push(String(prima).slice(0, 40));
      }).observe(el, {childList: true, subtree: true, characterData: true});
    }

    startMt5PositionsPolling();                       // il polling VERO dell'app
    await new Promise(r => setTimeout(r, finestraMs));

    return {letture, cambi, visti,
      statsAttive: (() => { try { return mt5StatsActive(); } catch (e) { return String(e); } })(),
      propFirmAccesa: (() => { try { return !!isPropFirmMode; } catch (e) { return null; } })(),
      fonte: (document.getElementById('mCapitalFonte') || {}).textContent,
      equityInMemoria: mt5AccountInfo ? mt5AccountInfo.equity : null,
      profittoInMemoria: (mt5RealPositions[0] || {}).profit,
      capitaleAschermo: (document.getElementById('mCapital') || {}).textContent,
      margineAschermo: (document.getElementById('mMargin') || {}).textContent};
  };
}

async function misura(opzioni) {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA_BTC);
    const esito = await pagina.evaluate(scenarioInPagina(opzioni),
      {propFirm: !!opzioni.propFirm, accountRotto: !!opzioni.accountRotto, finestraMs: opzioni.finestraMs || FINESTRA_MS});
    return {esito, errori};
  } finally { await browser.close(); }
}

test('le due strade vanno alla stessa velocita: /account quanto /positions', async () => {
  const {esito} = await misura({propFirm: false});
  console.log('MT5 normale →', JSON.stringify(esito.letture), 'cambi:', JSON.stringify(esito.cambi));
  // Contromisura: se il ponte finto non venisse mai interrogato, il banco non misurerebbe niente.
  assert.ok(esito.letture.positions >= 6,
    `il banco non ha misurato niente: solo ${esito.letture.positions} letture di /positions in ${FINESTRA_MS} ms`);
  // IL DIFETTO: capitale e margine libero arrivano da /account, che deve essere riletto con la
  // stessa cadenza delle posizioni. Oggi: 1 lettura contro 9.
  assert.ok(esito.letture.account >= esito.letture.positions - 1,
    `/account letto ${esito.letture.account} volte contro ${esito.letture.positions} letture di /positions: `
    + 'capitale e margine libero restano fermi all\'unica lettura del collegamento');
});

test('capitale e margine libero cambiano quanto il P/L live', async () => {
  const {esito} = await misura({propFirm: false});
  console.log('cambi a schermo →', JSON.stringify(esito.cambi), esito.visti && JSON.stringify(esito.visti.mCapital));
  // Contromisura: il P/L live DEVE muoversi, altrimenti la pagina è ferma e il confronto è falso.
  assert.ok(esito.cambi.liveValue >= 6,
    `il P/L live è cambiato solo ${esito.cambi.liveValue} volte: la pagina è ferma, misura non valida`);
  // IL DIFETTO, come lo vede il proprietario.
  assert.ok(esito.cambi.mCapital >= esito.cambi.liveValue - 1,
    `Capitale cambiato ${esito.cambi.mCapital} volte contro ${esito.cambi.liveValue} del P/L live`);
  assert.ok(esito.cambi.mMargin >= esito.cambi.liveValue - 1,
    `Margine libero cambiato ${esito.cambi.mMargin} volte contro ${esito.cambi.liveValue} del P/L live`);
});

test('in Prop Firm, se il ponte non da il conto lo dice invece di tacere', async () => {
  const {esito} = await misura({propFirm: true, accountRotto: true});
  console.log('Prop Firm con /account rotto →', JSON.stringify({fonte: esito.fonte,
    statsAttive: esito.statsAttive, propFirmAccesa: esito.propFirmAccesa, letture: esito.letture}));
  assert.equal(esito.propFirmAccesa, true, 'la Modalità Prop Firm non è rimasta accesa: scenario non valido');
  assert.equal(esito.statsAttive, false, 'con /account rotto i dati veri non si possono usare: scenario non valido');
  // IL DIFETTO: in mostraFonteCapitale() (app.html riga 42529) il ramo `isPropFirmMode` viene
  // PRIMA del ramo `mt5Connected`, quindi l'avviso «i dati del conto MT5 non arrivano» non
  // compare mai in Modalità Prop Firm: si legge una riga rassicurante e il numero resta fermo.
  assert.ok(/non arriv|in attesa|Non connesso/i.test(String(esito.fonte || '')),
    `sotto il capitale c'è scritto «${esito.fonte}»: non dice che il ponte non sta dando i dati del conto`);
});
