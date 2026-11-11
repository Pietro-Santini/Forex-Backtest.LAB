// SUL PC IL TRADE JOURNAL RESTA VUOTO: UN DISEGNO FINITO IN "ORDINI PENDENTI" FERMA update().
//
// SEGNALATO dal proprietario (10 novembre 2026): «sul PC non vedo piu' quelli che sono i thread
// journal, cioe' vedo la casellina thread journal ma non e' compilata, mentre invece sul tablet e
// sui dispositivi mobili si. Come mai sul PC non arrivano i thread journal?»
//
// MISURATO SUL PC DEL PROPRIETARIO (pagina viva, 127.0.0.1:8000/app.html, in sola lettura):
//   - `trades.length` = 1044 (i dati ci sono), `#journal` (tbody) = 0 righe;
//   - `__journalLastRenderSig` = null e `#journal.__fblHtml` mai impostato: il blocco che disegna
//     il Trade Journal dentro update() NON E' MAI STATO ESEGUITO, non e' "vuoto per mancanza di dati";
//   - in console, ripetuto: "TypeError: Cannot read properties of undefined (reading 'toFixed')"
//         at rigaPendenteTracciato (app.html:14103)  -> `${p.lots.toFixed(2)}`
//         at update (app.html:14148)                 -> pendMt5/pendNormali.map(rigaPendenteTracciato)
//   - `collectAcrossSessions('pendingOrders')` = 75 elementi, TUTTI disegni (trendline 24, fib 13,
//     rectangle 22, vpanchor 3, horizontal 6, alarmline 7), con p1/p2/color/fillColor e SENZA lots;
//   - lo stato salvato (localStorage forex_lab_standard_state) ha `pendingOrders` = 69 disegni alla
//     radice: l'inquinamento e' PERSISTENTE, torna a ogni avvio (applyLightSessionState).
//
// PERCHE' SOLO SUL PC: quei 75 disegni portano `mt5Login` e `mt5MissingSince` - le impronte del
// parcheggio MT5. Li ha messi li' il commit aec50f2 (v2.2.13, 9 novembre 2026), che parcheggiava i
// disegni per conto con `{modo, tipo:'disegno', p:disegno}`. La cura del 10 novembre (LEZIONI n.25)
// ha rovesciato quella scelta, ma il RIPRISTINO (app.html:5960) e' rimasto cosi':
//     (x.tipo==='pos' ? pos : pend).push(x.p)
// cioe': qualunque voce che non sia 'pos' - 'disegno' compresa - finisce negli ORDINI PENDENTI.
// mt5Parcheggio sta nel localStorage del PC (dove gira MT5), quindi succede solo li'.
//
// E LA CADUTA A CATENA: rigaPendenteTracciato (app.html:14218) fa `p.lots.toFixed(2)` su un
// disegno -> update() muore alla riga 14263 ->TUTTO quello che viene dopo non viene piu' disegnato,
// Trade Journal (14277) e barra di paginazione (14357) compresi. E' la stessa lezione del 28
// ottobre 2026 (journal_senza_pips.test.mjs): basta UNA riga rotta e la tabella intera sparisce.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Un ordine pendente VERO, come lo scrive placeRealMt5PendingOrder.
const ORDINE = (i, extra) => Object.assign({
  id: 'p' + i, createdAt: 1700000000000 + i * 60000, asset: 'EURUSD',
  side: 'BUY', kind: 'LIMIT', entry: 1.1, sl: 1.095, tp: 1.11, lots: 0.1
}, extra || {});

// Un DISEGNO finito negli ordini pendenti: la forma esatta misurata sul PC del proprietario
// (trendline con p1/p2/color, mt5Login e mt5MissingSince del parcheggio, e NESSUN lots).
const DISEGNO = {
  type: 'trendline', opacity: 1, lineWidth: 2, locked: false, color: '#3ea6ff',
  dotted: false, mt5Login: '1515193540', mt5MissingSince: null, fillColor: '#3ea6ff',
  dashed: false, fillOpacity: 0.1, p1: {t: 1, p: 1.1}, id: 1790286529445.3772,
  hidden: false, p2: {t: 2, p: 1.12}, asset: 'XAUUSD'
};

// Le tre operazioni chiuse che devono comparire nel Trade Journal.
const OP = (i, extra) => Object.assign({
  id: 't' + i, mode: 'backtest', asset: 'EURUSD', side: i % 2 ? 'BUY' : 'SELL',
  entry: 1.1000, exit: 1.1050, lots: 0.1, pl: 12.5, pct: 0.5, pips: 50,
  account: 10000, openTime: 1700000000000 + i * 3600000, closeTime: 1700003600000 + i * 3600000,
  closedAt: '2026-11-10T18:00:00.000Z'
}, extra || {});

// Chiama update() e dice quante righe ha davvero il Trade Journal.
async function giornaleCon({ordini, operazioni}){
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((o) => {
      trades = o.operazioni;
      pendingOrders = o.ordini;
      update();
      const tb = document.getElementById('journal');
      return {righe: tb ? tb.querySelectorAll('tr').length : -1,
              maiDisegnato: tb ? (tb.__fblHtml === undefined) : true};
    }, {ordini, operazioni});
    return {r, errori};
  } finally { await browser.close(); }
}

test('un DISEGNO finito negli ordini pendenti non deve impedire il disegno del Trade Journal', async () => {
  const {r, errori} = await giornaleCon({ordini: [ORDINE(1), DISEGNO], operazioni: [OP(1), OP(2), OP(3)]});
  assert.ok(r.righe >= 3,
    'il Trade Journal deve disegnare le sue 3 operazioni anche con un disegno in mezzo agli ordini ' +
    'pendenti: oggi update() muore in rigaPendenteTracciato e lascia la tabella a ' + r.righe + ' righe');
});

test('PROVA DI CONTROLLO: con soli ordini pendenti veri il Trade Journal si disegna davvero', async () => {
  // Senza questa prova ledue qui sopra passerebbero anche con un codice che non disegna MAI il
  // journal: un banco che misura il vuoto non protegge niente.
  const {r, errori} = await giornaleCon({ordini: [ORDINE(1), ORDINE(2)], operazioni: [OP(1), OP(2), OP(3)]});
  assert.ok(r.righe >= 3, 'con ordini pendenti veri le 3 operazioni devono comparire: ' + r.righe);
  assert.ok(!r.maiDisegnato, 'il blocco del journal deve essere stato eseguito');
});

test('il numero del trade si vede: non si ripara nascondendo il dato', async () => {
  const {browser, pagina} = await apriApp();
  try{
    const testo = await pagina.evaluate((ops) => {
      trades = ops; pendingOrders = [];
      update();
      return document.getElementById('journal').textContent;
    }, [OP(1, {lots: 1.25})]);
    assert.ok(/1[,.]25/.test(testo), 'i lotti devono comparire nella riga: ' + testo.slice(0, 120));
  } finally { await browser.close(); }
});

test('CAUSA: una voce "disegno" ripresa dal parcheggio MT5 non deve finire negli ordini pendenti', async () => {
  // La riga che rovescia il parcheggio dentro pendingOrders (app.html:5960):
  //   (x.tipo==='pos' ? pos : pend).push(x.p)
  // Con tipo 'disegno' la voce va negli ordini pendenti, non nei disegni (app.html:5981).
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((disegno) => {
      // Sessione Live+PropFirm (quella misurata sul PC) e conto appena collegato.
      liveModeActive = true; isPropFirmMode = true;
      const login = '1515193540';
      mt5Parcheggio = {};
      mt5Parcheggio[login] = [{modo: 'live_propfirm', tipo: 'disegno', p: disegno}];
      try { mt5SalvaParcheggio(); } catch(e){}
      mt5AttivaConto(login, 'ServerDiProva', true, null);
      return {negliOrdini: pendingOrders.filter(p => p && p.lots === undefined).length,
              ordiniTotali: pendingOrders.length,
              neiDisegni: drawings.filter(d => d && d.id === disegno.id).length};
    }, DISEGNO);
    assert.equal(r.negliOrdini, 0,
      'la voce "disegno" del parcheggio deve tornare nei DISEGNI, non negli ordini pendenti: ' +
      'ritrovata ' + r.negliOrdini + ' voce senza lots in mezzo agli ordini (e sono quelle che ' +
      'poi fermano update())');
    assert.equal(r.neiDisegni, 1, 'il disegno deve tornare al suo posto fra i disegni');
    // La prova di controllo della Causa: una voce 'pos' ripresa dal parcheggio invece torna davvero.
    const c = await pagina.evaluate((disegno) => {
      const login = '1515193540';
      const pos = {id: 'x1', asset: 'EURUSD', side: 'BUY', entry: 1.1, lots: 0.2, mt5Ticket: 12345};
      mt5Parcheggio = {}; mt5Parcheggio[login] = [{modo: 'live_propfirm', tipo: 'pos', p: pos}];
      mt5AttivaConto(login, 'ServerDiProva', true, null);
      return {posizioni: positions.filter(p => p && p.id === 'x1').length,
              ordini: pendingOrders.length};
    }, DISEGNO);
    assert.equal(c.posizioni, 1, 'la voce "pos" ripresa dal parcheggio deve tornare nelle posizioni');
    assert.equal(c.ordini, 0, 'e non deve scambiare di posto con gli ordini pendenti');
  } finally { await browser.close(); }
});
