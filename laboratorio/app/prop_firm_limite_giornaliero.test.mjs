// IL MOTORE DAL VIVO: checkPropFirmRules(), quello che ferma davvero le operazioni.
//
// La funzione pura delle sale (fblPropDedicataConta) aveva lo stesso errore ed e' gia' corretta
// in prop_firm_regole_ftmo.test.mjs. Ma la prop in sessione - storico, replay e live - passa da
// QUI, ed e' quella che blocca il simulatore e mostra la schermata rossa. Un conto sbagliato a
// questo punto non falsa una statistica: ferma, o non ferma, chi sta operando.
//
// LA REGOLA, da ftmo.com/en/trading-objectives: «Maximum Daily Loss: 5% of the Initial Simulated
// Capital». Il limite in euro e' FISSO; si azzera ogni giorno il RIFERIMENTO, non il limite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Prepara una Challenge a tavolino e chiede il verdetto.
//   iniziale  = capitale di partenza della Challenge
//   aperturaGiorno = saldo con cui si e' aperta la giornata di oggi
//   adesso    = equity in questo momento
async function verdetto(iniziale, aperturaGiorno, adesso){
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((a) => {
      isPropFirmMode = true;
      liveModeActive = false;          // sessione Storico: niente MT5 reale di mezzo
      propFirmViolation = null;
      propFirmSbloccataShown = false;
      propFirmChallengeInitialCapital = a.iniziale;
      positions = [];                  // nessun flottante: il conto e' tutto "chiuso"
      equity = [a.adesso];             // propFirmClosedBalance() legge l'ultimo valore
      // La fotografia del saldo di inizio giornata e' GIA' fatta per oggi: cosi'
      // ensurePropFirmDailyBaseline() non la rifa' e il valore messo qui resta.
      propFirmDailyBaselineDate = cetDateKey(currentPropFirmNowMs());
      propFirmDailyStartBalance = a.aperturaGiorno;
      checkPropFirmRules();
      const v = propFirmViolation;
      return v ? {regola:v.rule, limite:v.dailyLossLimit, perdita:v.dailyLoss} : null;
    }, {iniziale, aperturaGiorno, adesso});
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    return r;
  } finally { await browser.close(); }
}

test('conto in utile: il limite giornaliero resta il 5% del capitale INIZIALE, non del saldo di stamattina', async () => {
  // Capitale 10.000 -> limite FTMO 500 euro, sempre.
  // La giornata si apre a 10.800 e adesso siamo a 10.280: -520 euro.
  //   FTMO:           520 > 500             -> VIOLATO
  //   formula vecchia: 520 < 540 (5% di 10.800) -> «tutto a posto»
  const v = await verdetto(10000, 10800, 10280);
  assert.ok(v, 'una perdita di 520 euro su 10.000 di capitale supera il limite FTMO di 500');
  assert.equal(v.regola, 'daily', 'deve scattare la regola della perdita giornaliera');
  assert.ok(Math.abs(v.limite - 500) < 0.01,
    'il limite mostrato dev\'essere 500 (5% di 10.000), non 540 (5% di 10.800): era '+v.limite);
});

test('conto in perdita: una giornata dentro i 500 euro NON viene bocciata', async () => {
  // La giornata si apre a 9.500 e adesso siamo a 9.010: -490 euro.
  //   FTMO:           490 < 500             -> si continua
  //   formula vecchia: 490 > 475 (5% di 9.500) -> bocciata per errore
  const v = await verdetto(10000, 9500, 9010);
  assert.equal(v, null,
    'una perdita di 490 euro sta dentro il limite FTMO di 500: non si deve bloccare niente');
});

test('PROVA DI CONTROLLO: oltre i 500 euro si blocca davvero', async () => {
  // Senza questo, i due test qui sopra passerebbero anche con un motore che non boccia mai.
  const v = await verdetto(10000, 10000, 9400);   // -600 euro
  assert.ok(v, 'una perdita di 600 euro deve far scattare la violazione');
  assert.equal(v.regola, 'daily');
});

test('PROVA DI CONTROLLO: il massimo totale resta il 10% del capitale iniziale', async () => {
  // Questa meta' era gia' giusta (si misurava sul capitale iniziale): il test la blocca, cosi'
  // sistemando il limite giornaliero non si rompe per distrazione anche questa.
  // Giornata aperta a 8.900 e adesso 8.850: la perdita di giornata e' solo 50 euro, quindi a
  // bocciare puo' essere soltanto il massimo totale (-11,5% sul capitale iniziale).
  const v = await verdetto(10000, 8900, 8850);
  assert.ok(v, 'a 8.850 su 10.000 il massimo totale del 10% e\' superato');
  assert.equal(v.regola, 'max', 'deve scattare il massimo totale, non la perdita giornaliera');
});
