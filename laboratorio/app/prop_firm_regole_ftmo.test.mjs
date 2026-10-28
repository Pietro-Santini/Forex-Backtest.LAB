// LE REGOLE FTMO, QUELLE VERE — i casi che distinguono la regola giusta da quella sbagliata.
//
// Letti dal sito il 27 ottobre 2026 (https://ftmo.com/en/trading-objectives/), two step sfida 1:
//   «Maximum Daily Loss: 5% of the Initial Simulated Capital», ricalcolato ogni giorno alle 00:00
//   CE(S)T, e «Maximum Loss: 10% of the Initial Simulated Capital», STATICO.
//
// DUE ERRORI che l'app aveva, e che questi test misurano:
//
// 1) IL LIMITE GIORNALIERO ERA CALCOLATO SULLA BASE SBAGLIATA. Il limite in euro e' FISSO (il 5%
//    del capitale iniziale); quello che si azzera ogni giorno e' il RIFERIMENTO da cui si misura
//    la perdita. L'app invece prendeva il 5% del saldo di apertura di QUEL giorno, cioe' un
//    limite che cresce quando il conto e' in utile e si stringe quando e' in perdita.
//
// 2) IL DRAWDOWN TOTALE ERA MISURATO DAL PICCO (trailing). Nel two step FTMO e' STATICO: 10%
//    sotto il capitale INIZIALE, e non si muove mai. (Il trailing esiste, ma e' del one step, e
//    trailing sul saldo di FINE GIORNATA - un'altra cosa ancora.)
//
// I cinque test gia' esistenti in prop_firm_cronologia.test.mjs passano identici con la regola
// corretta: i loro numeri cadono dalla stessa parte con tutte e due le formule. Per questo
// servono i casi qui sotto, costruiti apposta perche' le due regole diano verdetti OPPOSTI.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const U = (giorno, h) => Date.UTC(2026, 0, giorno, h, 0, 0);

async function conta(punti, capitale, apertoMs){
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((a) => window.fblPropDedicataConta(a.punti, a.capitale, a.apertoMs),
      {punti, capitale, apertoMs});
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    return r;
  } finally { await browser.close(); }
}

// ---------------------------------------------------------------------------------------------
// ERRORE 1, PRIMA META': quando il conto e' IN UTILE la regola sbagliata e' troppo generosa.
test('conto in utile: una perdita oltre il 5% del CAPITALE INIZIALE chiude, anche se sta dentro il 5% del saldo di ieri', async () => {
  // Capitale 10.000 -> il limite FTMO e' 500 euro al giorno, SEMPRE.
  // 2 gen: sale a 10.800 (sotto l'obiettivo di 11.000: la prop non e' ancora sbloccata).
  // 3 gen: scende a 10.280, cioe' -520 euro in giornata.
  //   FTMO:          520 > 500            -> FINITA
  //   regola vecchia: 520 < 540 (5% di 10.800) -> «va tutto bene»
  // Nessun'altra regola si intromette: il totale resta sopra il capitale iniziale.
  const r = await conta(
    [{t:U(2,12), cap:10800}, {t:U(3,12), cap:10280}],
    10000, U(2,0)
  );
  assert.equal(r.esito, 'finita',
    'una perdita di 520 euro su un capitale iniziale di 10.000 supera il limite FTMO di 500');
  assert.equal(r.esitoData, '2026-01-03', 'il giorno indicato dev\'essere quello della perdita');
});

// ERRORE 1, SECONDA META': quando il conto e' IN PERDITA la regola sbagliata e' troppo severa.
test('conto in perdita: una perdita sotto il 5% del CAPITALE INIZIALE non chiude, anche se supera il 5% del saldo di ieri', async () => {
  // 2 gen: scende a 9.500, cioe' -500 euro: esattamente il limite, che NON e' superato.
  // 3 gen: scende a 9.010, cioe' -490 euro in giornata.
  //   FTMO:          490 < 500                -> si continua
  //   regola vecchia: 490 > 475 (5% di 9.500) -> «prop finita», bocciata per errore
  // Il totale resta a -9,9%, dentro il 10%: non e' il drawdown totale a decidere.
  const r = await conta(
    [{t:U(2,12), cap:9500}, {t:U(3,12), cap:9010}],
    10000, U(2,0)
  );
  assert.equal(r.esito, 'ok',
    'una perdita di 490 euro sta dentro il limite FTMO di 500: la prop NON deve chiudere');
});

// ---------------------------------------------------------------------------------------------
// ERRORE 2: il massimo del two step e' STATICO, non dal picco.
test('two step: scendere dal picco non chiude finche\' si resta sopra il capitale iniziale', async () => {
  // 10.000 -> 10.900 (sotto l'obiettivo di 11.000) e poi giu' piano fino a 9.800, in tre giornate
  // da -400, -350 e -350: nessuna di esse sfiora il limite giornaliero, ne' con una regola ne'
  // con l'altra.
  //   dal picco (regola vecchia): (10.900-9.800)/10.900 = 10,09% -> «prop finita»
  //   FTMO due step, statico:      9.800 e' il 2% sotto il capitale iniziale -> non e' successo niente
  // E' il caso che il proprietario riconoscerebbe come assurdo: un conto che ha guadagnato e poi
  // restituito una parte del guadagno viene dichiarato violato pur essendo quasi intatto.
  const r = await conta(
    [{t:U(2,12), cap:10900}, {t:U(3,12), cap:10500}, {t:U(4,12), cap:10150}, {t:U(5,12), cap:9800}],
    10000, U(2,0)
  );
  assert.equal(r.esito, 'ok',
    'il massimo del two step e\' il 10% sotto il CAPITALE INIZIALE: a 9.800 su 10.000 non e\' violato');
  assert.ok(r.maxDDTot < 10,
    'il drawdown totale va misurato sul capitale iniziale (2%), non sul picco (10,09%): era '+r.maxDDTot);
});

// ---------------------------------------------------------------------------------------------
// PROVA DI CONTROLLO: la regola statica deve comunque CHIUDERE quando si scende davvero.
// Senza questo, i tre test qui sopra si accontenterebbero di una funzione che non boccia mai.
test('PROVA DI CONTROLLO: sotto il 10% del capitale iniziale la prop chiude lo stesso', async () => {
  // Stessa forma del test qui sopra, ma la discesa prosegue fino a 8.950: sotto i 9.000, cioe'
  // oltre il 10% del capitale iniziale. Le giornate restano tutte dentro il limite giornaliero,
  // quindi a bocciare puo' essere SOLO il massimo totale.
  const r = await conta(
    [{t:U(2,12), cap:10900}, {t:U(3,12), cap:10500}, {t:U(4,12), cap:10150},
     {t:U(5,12), cap:9800}, {t:U(6,12), cap:9400}, {t:U(7,12), cap:8950}],
    10000, U(2,0)
  );
  assert.equal(r.esito, 'finita',
    '8.950 su 10.000 e\' oltre il 10%: qui la prop deve chiudere davvero');
  assert.ok(r.maxDDTot > 10, 'il drawdown totale dev\'essere oltre il 10%: era '+r.maxDDTot);
});
