// PASSO 2: LE REGOLE IN UN POSTO SOLO, con i preset one step e two step.
//
// Finora i numeri 5, 10 e 10 erano scritti DENTRO le formule, in tre funzioni diverse. Finche'
// restano li', «one step o two step?» non e' una scelta: e' una riscrittura.
//
// Questo passo non deve cambiare NESSUN comportamento: sposta solo dove stanno i numeri. La
// garanzia e' che i 19 test gia' scritti restano verdi senza toccarne uno.
//
// I test qui sotto controllano due cose diverse, e la seconda e' quella che conta davvero:
//   1. che i preset esistano e abbiano i numeri di ftmo.com;
//   2. che le formule li LEGGANO davvero, invece di avere ancora i numeri dentro.
// Il (2) si prova cambiando il preset e guardando se il verdetto cambia: un numero rimasto fisso
// nel codice ignorerebbe il cambio, e il test lo vedrebbe.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

async function nellApp(fn, arg){
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(fn, arg);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    return r;
  } finally { await browser.close(); }
}

test('i due preset esistono, coi numeri veri di ftmo.com', async () => {
  const r = await nellApp(() => {
    const R = window.FBL_PROP_REGOLE;
    if(!R) return {mancante:true};
    const u = R['ftmo-1step'], d = R['ftmo-2step'];
    return {
      uno: u && {obiettivi:u.fasi.map(f=>f.obiettivo), giorno:u.perditaGiorno, totale:u.perditaTotale,
                 insegue:u.totaleInsegue, minimi:u.giorniMinimi, costanza:u.costanzaMaxGiorno, quota:u.quotaTrader},
      due: d && {obiettivi:d.fasi.map(f=>f.obiettivo), giorno:d.perditaGiorno, totale:d.perditaTotale,
                 insegue:d.totaleInsegue, minimi:d.giorniMinimi, quota:d.quotaTrader}
    };
  });
  assert.ok(!r.mancante, 'FBL_PROP_REGOLE deve esistere ed essere raggiungibile');

  // ONE STEP: una fase sola al 10%, perdita giorno 3%, massimo 10% che INSEGUE, quota 90%.
  assert.deepEqual(r.uno.obiettivi, [10], 'il one step ha UNA fase sola, obiettivo 10%');
  assert.equal(r.uno.giorno, 3, 'one step: perdita giornaliera 3%');
  assert.equal(r.uno.totale, 10, 'one step: perdita totale 10%');
  assert.equal(r.uno.insegue, true, 'one step: il massimo INSEGUE il saldo di fine giornata');
  assert.equal(r.uno.costanza, 50, 'one step: il miglior giorno non oltre il 50% del profitto');
  assert.equal(r.uno.quota, 90, 'one step: al trader spetta il 90%');

  // TWO STEP: due fasi (10% e 5%), perdita giorno 5%, massimo 10% STATICO, 4 giorni, quota 80%.
  assert.deepEqual(r.due.obiettivi, [10, 5], 'il two step ha DUE fasi: 10% e poi 5%');
  assert.equal(r.due.giorno, 5, 'two step: perdita giornaliera 5%');
  assert.equal(r.due.totale, 10, 'two step: perdita totale 10%');
  assert.equal(r.due.insegue, false, 'two step: il massimo e\' STATICO, non insegue');
  assert.equal(r.due.minimi, 4, 'two step: almeno 4 giorni di operativita\'');
  assert.equal(r.due.quota, 80, 'two step: al trader spetta l\'80%');
});

test('senza scegliere niente vale il two step sfida 1: quello che l\'app fa da sempre', async () => {
  // Il passo 2 non deve cambiare niente a chi non tocca nulla. Il preset predefinito dev'essere
  // quello che riproduce il comportamento di oggi: 5% al giorno, 10% statico, obiettivo 10%.
  const r = await nellApp(() => {
    const a = window.fblPropRegoleAttive && window.fblPropRegoleAttive();
    return a && {giorno:a.perditaGiorno, totale:a.perditaTotale, insegue:a.totaleInsegue,
                 primoObiettivo:a.fasi[0].obiettivo};
  });
  assert.ok(r, 'fblPropRegoleAttive() deve esistere');
  assert.equal(r.giorno, 5);
  assert.equal(r.totale, 10);
  assert.equal(r.insegue, false);
  assert.equal(r.primoObiettivo, 10);
});

// ---------------------------------------------------------------------------------------------
// IL TEST CHE CONTA: le formule leggono il preset, o hanno ancora i numeri dentro?
test('il motore LEGGE il preset: passando al one step il limite giornaliero diventa il 3%', async () => {
  // Capitale 10.000.
  //   two step (5%): limite 500 -> una perdita di 400 euro NON viola
  //   one step (3%): limite 300 -> la stessa perdita di 400 euro VIOLA
  // Se il 5 fosse ancora scritto nel codice, il secondo verdetto sarebbe uguale al primo: ed e'
  // esattamente quello che questo test impedisce.
  const r = await nellApp(() => {
    function prova(preset){
      if(preset) window.fblPropPresetImposta(preset);
      isPropFirmMode = true; liveModeActive = false;
      propFirmViolation = null; propFirmSbloccataShown = false;
      propFirmChallengeInitialCapital = 10000;
      positions = []; equity = [9600];                 // -400 euro
      propFirmDailyBaselineDate = cetDateKey(currentPropFirmNowMs());
      propFirmDailyStartBalance = 10000;
      checkPropFirmRules();
      return propFirmViolation ? propFirmViolation.rule : null;
    }
    return {due: prova('ftmo-2step'), uno: prova('ftmo-1step')};
  });
  assert.equal(r.due, null, 'col two step 400 euro stanno dentro il limite di 500');
  assert.equal(r.uno, 'daily', 'col one step 400 euro superano il limite di 300: deve violare');
});

test('il motore LEGGE anche l\'obiettivo: la sfida 2 del two step si sblocca al 5%', async () => {
  // Stessa prova dall'altra parte: un +6% sblocca la fase col 5% di obiettivo, non quella col 10%.
  const r = await nellApp(() => {
    function prova(fase){
      window.fblPropPresetImposta('ftmo-2step');
      window.fblPropFaseImposta(fase);
      isPropFirmMode = true; liveModeActive = false;
      propFirmViolation = null; propFirmSbloccataShown = false;
      propFirmChallengeInitialCapital = 10000;
      positions = []; equity = [10600];                // +6%
      propFirmDailyBaselineDate = cetDateKey(currentPropFirmNowMs());
      propFirmDailyStartBalance = 10000;
      checkPropFirmRules();
      return !!propFirmSbloccataShown;
    }
    return {sfida1: prova(0), sfida2: prova(1)};
  });
  assert.equal(r.sfida1, false, 'nella sfida 1 l\'obiettivo e\' il 10%: col +6% non si sblocca');
  assert.equal(r.sfida2, true, 'nella sfida 2 l\'obiettivo e\' il 5%: col +6% si sblocca');
});
