// IN REPLAY LA PROP FIRM GIUDICA IL CONTO STORICO, NON IL CONTO MT5.
//
// SEGNALATO dal proprietario (22 novembre 2026): «in replay il comando di apertura posizione non
// prende e mostra il messaggio di blocco prop-firm, benché il conto storico sia a 9.938,25 €».
// Il messaggio che vede è la riga in fondo: «🛑 Conto Prop Firm chiuso per violazione: nessuna
// nuova operazione consentita.» — cioè `propFirmViolation` è valorizzata.
//
// LA REGOLA, già scritta in `fblPropContoId()` (consegna del 28 ottobre 2026): «in replay vale
// SEMPRE il conto storico, anche con MT5 collegato». Il motore delle regole però non la seguiva:
// `pfUsesRealMt5()` rispondeva «sì» anche durante il replay (perché il replay vive dentro la
// sessione Live), quindi i limiti si misuravano sull'equity del conto MT5 vero e non su quella
// del passato. MISURATO qui sotto: conto MT5 con 12.000 di capitale iniziale e 9.938,25 di
// equity (-17,2%, oltre il 10%) contro un conto storico che perde 61,75 su 10.000 (-0,6%).
// Prima della cura: violazione «max» a carico del conto reale e ordine rifiutato. Dopo: nessuna
// violazione, la posizione si apre.
//
// Seconda strada dello stesso difetto, misurata a parte: la violazione del conto reale resta in
// memoria e la sessione `live_propfirm` è UNA SOLA (il replay vive lì dentro), quindi il blocco
// del conto vero si portava dietro anche il replay. La violazione appartiene al CONTO, non alla
// finestra: in replay quella del conto reale non deve bloccare, e deve tornare quando si esce.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Replay in Live con MT5 collegato, prop firm accesa sul conto reale, conto storico in salute.
const PREPARA = ({violazioneInMemoria = null} = {}) => {
  const t0 = Date.UTC(2026, 9, 25, 8, 0, 0);
  const R = [];
  for (let i = 0; i < 200; i++) {
    const c = 4000 + i;
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: c, high: c + 0.5, low: c - 0.5, close: c, volume: 10});
  }
  rows = R; baseRows = R; idx = 80; viewEnd = 80;
  currentAssetKey = 'XAUUSD';
  const sel = document.getElementById('market');
  if (sel) sel.value = 'XAUUSD';

  // Replay dentro il Live: è la configurazione in cui il difetto si vede.
  liveModeActive = true;
  liveReplayActive = true;
  mt5Connected = true;
  isPropFirmMode = true;
  pfRealMt5Login = '5001234';
  pfPendingDecisionLogin = null;

  // IL CONTO MT5 VERO: capitale iniziale 12.000 (depositi), equity 9.938,25 -> -17,2% > 10%.
  mt5AccountInfo = {login: '5001234', equity: 9938.25, balance: 9938.25, currency: 'EUR'};
  mt5AccountHistory = {closed: [], deposits: 12000, withdrawals: 0};
  livePriceByAsset = {'XAUUSD': 4300};

  masterTime = Date.parse(R[80].date);
  positions.length = 0;
  trades.length = 0;

  // IL CONTO STORICO: 10.000 iniziali, adesso 9.938,25 -> -61,75 (-0,6%). Nessuna regola violata.
  equity = [10000, 9938.25];
  propFirmChallengeInitialCapital = 10000;
  propFirmViolation = violazioneInMemoria;
  propFirmSbloccataShown = false;
  propFirmDailyBaselineDate = cetDateKey(currentPropFirmNowMs());
  propFirmDailyStartBalance = 10000;
  try { fblPropContoStatoSalva('storico', {stato: 'in_corso'}); } catch (e) {}
  try { hidePropFirmViolationOverlay(); } catch (e) {}
};

test('in replay, con MT5 collegato, la prop firm NON giudica il conto MT5 reale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara}) => {
      eval('(' + prepara + ')()');
      const conto = fblPropContoId();
      checkPropFirmRules();
      const v = propFirmViolation
        ? {regola: propFirmViolation.rule, conto: propFirmViolation.realMt5Login || propFirmViolation.contoId || null}
        : null;
      openMarketTrade('BUY');
      return {
        conto, v,
        aperte: positions.length,
        stato: document.getElementById('status').textContent,
      };
    }, {prepara: PREPARA.toString()});

    assert.equal(r.conto, 'storico', 'in replay la sfida è quella del conto storico, anche con MT5 collegato');
    assert.equal(r.v, null,
      'il conto storico perde 61,75 su 10.000 (-0,6%): nessuna regola è violata, invece: ' + JSON.stringify(r.v));
    assert.equal(r.aperte, 1, 'in replay l\'ordine deve aprire la posizione. Stato: «' + r.stato + '»');
    assert.equal(/chiuso per violazione/.test(r.stato), false,
      'non deve comparire il blocco prop firm: «' + r.stato + '»');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una violazione del conto reale non blocca il replay, e torna quando si esce dal replay', async () => {
  const VIOLAZIONE = {
    rule: 'max', realMt5Login: '5001234', initialCapital: 12000, equityNow: 9938.25,
    totalLoss: 2061.75, maxDrawdownLimit: 1200, totalLossPct: 17.18,
    timestamp: Date.now(), timestampIso: new Date().toISOString(),
  };
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara, violazione}) => {
      eval('(' + prepara + ')({violazioneInMemoria: ' + JSON.stringify(violazione) + '})');
      checkPropFirmRules();
      const inReplay = {
        violazione: propFirmViolation ? propFirmViolation.rule : null,
        conto: fblPropContoId(),
      };
      openMarketTrade('BUY');
      inReplay.aperte = positions.length;
      inReplay.stato = document.getElementById('status').textContent;

      // Si esce dal replay: il conto reale è ancora oltre il 10%, e la sua chiusura deve tornare.
      liveReplayActive = false;
      checkPropFirmRules();
      const dopoIlReplay = {violazione: propFirmViolation ? propFirmViolation.rule : null,
        conto: fblPropContoId()};
      return {inReplay, dopoIlReplay};
    }, {prepara: PREPARA.toString(), violazione: VIOLAZIONE});

    assert.equal(r.inReplay.conto, 'storico', 'premessa: si sta lavorando sul conto storico');
    assert.equal(r.inReplay.violazione, null,
      'la violazione è del conto MT5 reale, non dello storico: in replay non deve restare in memoria');
    assert.equal(r.inReplay.aperte, 1, 'in replay l\'ordine deve aprire la posizione. Stato: «' + r.inReplay.stato + '»');
    assert.equal(/chiuso per violazione/.test(r.inReplay.stato), false,
      'non deve comparire il blocco prop firm: «' + r.inReplay.stato + '»');

    // PROVA DI CONTROLLO: la chiusura del conto vero non è stata cancellata, solo messa da parte.
    assert.equal(r.dopoIlReplay.conto.substring(0, 4), 'mt5:', 'uscendo dal replay si torna al conto MT5 reale');
    assert.equal(r.dopoIlReplay.violazione, 'max',
      'tornati sul conto reale, che è ancora oltre il 10%, la sua violazione deve riapparire');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
