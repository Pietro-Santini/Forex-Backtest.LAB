// PASSO 3: LE FASI VERE — seconda sfida, giorni minimi, costanza, trailing.
//
// Il passo 2 ha messo le regole in un posto solo. Qui qualcuno comincia a LEGGERLE davvero:
// finora il motore delle sale conosceva una fase sola, col 5% al giorno e il 10% statico, cioe'
// la sfida 1 del two step. Il one step e la sfida 2 esistevano come dato e basta.
//
// LE QUATTRO COSE CHE ENTRANO ADESSO, tutte dalle regole FTMO lette il 27 ottobre 2026:
//   - la SECONDA SFIDA del two step, che riparte dal capitale iniziale e chiede solo il 5%;
//   - i GIORNI MINIMI (4 nel two step): l'obiettivo raggiunto in due giorni non sblocca niente;
//   - il MASSIMO TRAILING del one step, che insegue il saldo di FINE GIORNATA;
//   - la REGOLA DI COSTANZA del one step, che si SEGNALA e non boccia (FTMO non la tratta come
//     una violazione: «not a hard breach»).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const U = (giorno, h) => Date.UTC(2026, 0, giorno, h, 0, 0);

async function conta(punti, capitale, apertoMs, preset){
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((a) => {
      if(a.preset) window.fblPropPresetImposta(a.preset);
      return window.fblPropDedicataConta(a.punti, a.capitale, a.apertoMs);
    }, {punti, capitale, apertoMs, preset});
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    return r;
  } finally { await browser.close(); }
}

// ---------------------------------------------------------------------------------------------
test('two step: la sfida 2 riparte dal capitale iniziale e chiede solo il 5%', async () => {
  // Sei giorni di salita lenta fino a +10% (sfida 1 passata, e sono piu' di 4 giorni), poi altri
  // sei giorni che aggiungono un altro +5% scarso.
  //
  // IL PUNTO: alla fine della sfida 1 il conto e' a 11.000. Se la sfida 2 continuasse da li',
  // per fare il suo +5% dovrebbe arrivare a 11.550. Ma FTMO la fa ripartire dal capitale
  // INIZIALE: il conto torna a 10.000 e l'obiettivo e' 10.500 - che su questa curva si raggiunge.
  const punti = [];
  for(let g=2; g<=7; g++)  punti.push({t:U(g,12), cap:10000 + (g-1)*200});   // fino a 11.200...
  for(let g=8; g<=13; g++) punti.push({t:U(g,12), cap:11200 + (g-7)*120});
  const r = await conta(punti, 10000, U(2,0), 'ftmo-2step');
  assert.ok(Array.isArray(r.fasi), 'deve raccontare fase per fase, non un verdetto solo');
  assert.equal(r.fasi.length, 2, 'il two step ha due sfide');
  assert.equal(r.fasi[0].esito, 'passata', 'la sfida 1 arriva al +10%');
  assert.equal(r.fasi[1].obiettivo, 5, 'la sfida 2 chiede il 5%, non il 10%');
  assert.equal(r.esito, 'sbloccata', 'passate tutte e due, il conto e\' finanziato');
});

test('two step: l\'obiettivo raggiunto in pochi giorni NON sblocca niente', async () => {
  // +10% in due sole giornate. FTMO pretende almeno 4 giorni di operativita': senza, l'obiettivo
  // non vale. E' la regola che impedisce di passare con un colpo di fortuna.
  const r = await conta(
    [{t:U(2,12), cap:10500}, {t:U(3,12), cap:11000}],
    10000, U(2,0), 'ftmo-2step'
  );
  assert.notEqual(r.esito, 'sbloccata',
    'con due soli giorni di operativita\' la sfida non e\' passata, anche col +10% raggiunto');
  assert.ok(r.fasi[0].giorniMancanti >= 1,
    'e si deve poter dire QUANTI giorni mancano, invece di lasciare l\'utente a indovinare');
});

test('PROVA DI CONTROLLO: con i giorni giusti lo stesso obiettivo sblocca', async () => {
  // Stessa salita al +10%, ma distribuita su cinque giornate invece di due: ora i 4 giorni
  // minimi ci sono. Senza questa prova, il test qui sopra passerebbe anche con un codice che
  // non sblocca MAI niente.
  const r = await conta(
    [{t:U(2,12), cap:10200}, {t:U(3,12), cap:10400}, {t:U(4,12), cap:10600},
     {t:U(5,12), cap:10800}, {t:U(6,12), cap:11000}],
    10000, U(2,0), 'ftmo-2step'
  );
  assert.equal(r.fasi[0].esito, 'passata', 'con cinque giorni la sfida 1 passa');
});

// ---------------------------------------------------------------------------------------------
test('one step: il massimo INSEGUE il saldo di fine giornata', async () => {
  // Il one step ha una fase sola, perdita giorno 3%, e il massimo del 10% che insegue il saldo
  // di FINE GIORNATA (non il minimo toccato durante il giorno: e' una formula diversa).
  //
  // La curva: si sale a 10.900 e poi si scende piano fino a 9.700.
  //   STATICO (two step):   9.700 e' il 3% sotto il capitale iniziale -> tutto a posto
  //   TRAILING (one step):  il massimo di fine giornata e' 10.900, e il 10% sotto fa 9.810:
  //                         a 9.700 si e' sfondato.
  // Le giornate scendono di 300 alla volta: il 3% di 10.000 e' 300, quindi la perdita
  // giornaliera NON viene mai superata e a bocciare puo' essere solo il massimo.
  const r = await conta(
    [{t:U(2,12), cap:10900}, {t:U(3,12), cap:10600}, {t:U(4,12), cap:10300},
     {t:U(5,12), cap:10000}, {t:U(6,12), cap:9700}],
    10000, U(2,0), 'ftmo-1step'
  );
  assert.equal(r.esito, 'finita',
    'col massimo che insegue il picco di fine giornata, 9.700 sotto 10.900 e\' una violazione');
});

test('PROVA DI CONTROLLO: la stessa curva col two step NON viola niente', async () => {
  // La stessa identica curva, cambiando solo il preset. Col massimo STATICO 9.700 e' il 3% sotto
  // il capitale iniziale: non e' successo niente. E' la prova che il trailing viene davvero
  // letto dalle regole, e non e' un comportamento fisso travestito.
  const r = await conta(
    [{t:U(2,12), cap:10900}, {t:U(3,12), cap:10600}, {t:U(4,12), cap:10300},
     {t:U(5,12), cap:10000}, {t:U(6,12), cap:9700}],
    10000, U(2,0), 'ftmo-2step'
  );
  assert.notEqual(r.esito, 'finita',
    'col massimo statico la stessa curva e\' sanissima: e\' il preset a cambiare il verdetto');
});

// ---------------------------------------------------------------------------------------------
test('one step: la regola di costanza si SEGNALA, non boccia', async () => {
  // Miglior giornata molto oltre la meta' del profitto totale. FTMO la chiama regola di
  // costanza ma NON e' una violazione («not a hard breach»): si continua a operare, e basta
  // saperlo. Trattarla come una bocciatura sarebbe piu' severi di FTMO, che e' un modo elegante
  // di dare un risultato sbagliato.
  const r = await conta(
    [{t:U(2,12), cap:10900}, {t:U(3,12), cap:10950}, {t:U(4,12), cap:11000},
     {t:U(5,12), cap:11050}, {t:U(6,12), cap:11100}],
    10000, U(2,0), 'ftmo-1step'
  );
  assert.notEqual(r.esito, 'finita', 'la costanza non boccia');
  assert.equal(r.costanzaSuperata, true,
    'ma si deve poter dire che il miglior giorno vale piu\' della meta\' del profitto');
});
