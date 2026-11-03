// LO STATO DEL MERCATO LO DICE MT5, NON UN ORARIO FISSO.
//
// SEGNALATO dal proprietario (3 novembre 2026): "ogni asset apre e chiude in fasce orarie
// diverse. NZD/CAD in questo momento il mercato e' aperto. E in realta' mi dice che il
// mercato e' chiuso e che apre tra 17 minuti a mezzanotte. Ed e' impossibile perche' sul
// terminale MT5, ma si vede anche dall'aggiornamento delle tabelle delle posizioni aperte,
// che il mercato e' aperto. Perche' il PL live si aggiorna di quell'asset."
//
// CAUSA MISURATA: statoMercato()/fblMercatoFermoOra() decidevano l'apertura con la schedule
// fissa (chiusura alle 22 di Roma per tutti). Uno strumento che chiude alle 23 risultava chiuso
// alle 22. MT5 invece lo sa simbolo per simbolo.
//
// Come si misura: si mette in scena un'ora in cui l'orario fisso dice CHIUSO (dopo le 22 di
// Roma) e si da' a MT5 una risposta. Se MT5 dice APERTO e l'app continua a dire "chiuso", la
// cura non c'e'. Delegare a MT5 e' la cura.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// 23:30 di Roma del 20 ottobre 2026 (CEST, UTC+2): la schedule fissa qui dice CHIUSO.
const T0 = Date.UTC(2026, 9, 20, 21, 30, 0);

// Funzione vera (non una stringa): cosi' l'argomento arriva davvero e le variabili della
// pagina (rows, liveModeActive, fblMercatoMt5Cache...) sono quelle globali dell'app.
function scenario({t0, statoMt5}) {
  const R = [];
  // 30 candele da 1 minuto: restano tutte DENTRO la fascia in cui l'orario fisso dice "chiuso"
  // (23:30-00:00 di Roma). Con 59 candele si scavalca la mezzanotte di Roma e l'orario fisso
  // tornerebbe "aperto", e la prova non distinguerebbe piu' niente.
  for (let i = 0; i < 30; i++) {
    const c = 100 + i * 0.01;
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: c, high: c + 0.2, low: c - 0.2, close: c, volume: 10});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length;
  rowsAssetKey = 'XAUUSD'; currentAssetKey = 'XAUUSD';
  liveModeActive = true; liveReplayActive = false; mt5Connected = true;
  positions.length = 0; pendingOrders.length = 0;
  // La cache di MT5: si svuota e si mette ESATTAMENTE la risposta che la prova vuole dare.
  Object.keys(fblMercatoMt5Cache).forEach(k => delete fblMercatoMt5Cache[k]);
  if (statoMt5 !== null) fblMercatoMt5Cache['XAUUSD'] = {aperto: statoMt5, letto: Date.now()};
  const tFine = t0 + 29 * 60000;
  return {
    chiusoSecondoOrarioFisso: liveSessionPhaseAt(tFine) === 'closed',
    tFine: tFine
  };
}

const LEGGI = (tFine) => ({
  fermo: fblMercatoFermoOra('XAUUSD', tFine),
  stato: statoMercato('XAUUSD', tFine)
});

test('se MT5 dice mercato APERTO, l\'app non dice chiuso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const prep = await pagina.evaluate(scenario, {t0: T0, statoMt5: true});
    // La prova vale solo se l'orario fisso da solo avrebbe detto "chiuso".
    assert.equal(prep.chiusoSecondoOrarioFisso, true,
      'lo scenario deve essere a mercato chiuso secondo l\'orario fisso, altrimenti non distingue');
    const r = await pagina.evaluate(LEGGI, prep.tFine);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.fermo, false, 'con MT5 che dice "aperto" il grafico non deve restare fermo');
    assert.ok(r.stato === null || r.stato.chiuso !== true,
      'e non deve mostrare "mercato chiuso": ' + JSON.stringify(r.stato));
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: se MT5 dice chiuso, resta chiuso come prima', async () => {
  // Senza questa prova la cura si potrebbe fare "dicendo sempre aperto", che e' l'errore opposto.
  const {browser, pagina, errori} = await apriApp();
  try {
    const prep = await pagina.evaluate(scenario, {t0: T0, statoMt5: false});
    assert.equal(prep.chiusoSecondoOrarioFisso, true);
    const r = await pagina.evaluate(LEGGI, prep.tFine);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.fermo, true, 'MT5 dice chiuso: il grafico deve restare fermo, come prima');
    assert.ok(r.stato && r.stato.chiuso === true, 'e deve dire "mercato chiuso"');
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: senza risposta di MT5 resta l\'orario fisso di prima', async () => {
  // La cura non deve cambiare niente quando MT5 non ha ancora risposto: al peggio l'app si
  // comporta ESATTAMENTE come adesso (primo avvio, ponte che non risponde).
  const {browser, pagina, errori} = await apriApp();
  try {
    const prep = await pagina.evaluate(scenario, {t0: T0, statoMt5: null});
    assert.equal(prep.chiusoSecondoOrarioFisso, true);
    const r = await pagina.evaluate(LEGGI, prep.tFine);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.fermo, true, 'senza risposta di MT5 deve valere l\'orario fisso: fermo, come prima');
  } finally { await browser.close(); }
});
