// STOP E TARGET AUTOMATICI DECISI DALLA SALA, NON SOLO DALLA FAMIGLIA DI STRUMENTO.
//
// CHIESTO dal proprietario: «all'interno della configurazione delle strategie delle sale, se
// selezioniamo apri anche se la sala non da' stop o target, l'utente inserisce la percentuale che
// indica il livello dello stop rapportato al rischio. Esempio: 10.000 euro, 1% -> lo stop deve
// essere messo nel grafico in modo che non si perda piu' dell'1%. Stessa cosa per il target, dove
// possiamo impostare la percentuale del divario fra entrata e stop, con aggiunta di quanti pip».
//
// COSA C'ERA GIA', e che non andava rifatto: il CALCOLO. Senza stop dalla sala, lo stop veniva
// gia' ricavato da una perdita massima in euro (saldo per percentuale); senza target, il TP
// veniva gia' messo a una percentuale della distanza dello stop. Verificato prima di scrivere
// una riga: rifarlo sarebbe stato lavoro buttato, e due calcoli paralleli che si contraddicono.
//
// COSA MANCAVA DAVVERO, ed e' quello che questi test tengono fermo:
//   1. DOVE si sceglie la percentuale: era un'impostazione per FAMIGLIA di strumento (forex,
//      cripto, indici, azioni), mentre la richiesta e' per SALA - due sale sullo stesso
//      strumento possono meritare rischi diversi;
//   2. il target in PIP, che non esisteva: c'era solo la percentuale.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('la percentuale della sala vince su quella della famiglia di strumento', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const famiglia = {rischioSenzaSl: 2};
      return {
        conSala: tgRischioSenzaSlDi(famiglia, {rischioSenzaSl: 0.5}),
        senzaSala: tgRischioSenzaSlDi(famiglia, null),
        salaVuota: tgRischioSenzaSlDi(famiglia, {rischioSenzaSl: 0}),
        salaAssurda: tgRischioSenzaSlDi(famiglia, {rischioSenzaSl: 500})
      };
    });
    assert.equal(r.conSala, 0.5, 'il valore della sala deve valere');
    assert.equal(r.senzaSala, 2,
      'senza valore nella sala resta quello della famiglia: nessuna sala gia\' configurata '
      + 'cambia comportamento finche\' non si scrive un numero nel suo campo');
    assert.equal(r.salaVuota, 2, 'un campo vuoto (zero) non e\' una scelta: vale la famiglia');
    assert.equal(r.salaAssurda, 100, 'e non si rischia piu\' del conto intero');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il target in pip vince sulla percentuale, perche\' e\' la scelta piu\' specifica', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      pip: tgTpSenzaTpPip({tpSenzaTpPip: 30}),
      niente: tgTpSenzaTpPip({tpSenzaTpPct: 10}),
      pct: tgTpSenzaTpPctDi({}, {tpSenzaTpPct: 10}, false)
    }));
    assert.equal(r.pip, 30, 'i pip della sala si leggono');
    assert.equal(r.niente, null, 'senza pip si dice null, e il calcolo usa la percentuale');
    assert.equal(r.pct, 10, 'la percentuale della sala si legge');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l\'esempio del proprietario torna: stop a 100, target al 10% sta a 10', async () => {
  // Il conto che ha descritto a parole, fatto coi numeri. Serve a verificare che la percentuale
  // sia riferita al DIVARIO entrata-stop e non al prezzo: sono due cose diversissime, e
  // sbagliarle metterebbe il target a un'altra galassia.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const entry = 1000, sl = 900;              // divario 100
      const pct = tgTpSenzaTpPctDi({}, {tpSenzaTpPct: 10}, false);
      const tpBuy = entry + Math.abs(entry - sl) * pct / 100;
      const tpSell = (entry) - Math.abs(entry - sl) * pct / 100;
      return {tpBuy, tpSell};
    });
    assert.equal(r.tpBuy, 1010, 'un BUY con stop 100 sotto e target al 10% va a +10');
    assert.equal(r.tpSell, 990, 'e uno SELL, specularmente, a -10');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza niente configurato, tutto si comporta come prima', async () => {
  // LA PROVA DI CONTROLLO. Questa modifica tocca il percorso che apre posizioni vere: se avesse
  // cambiato il comportamento predefinito, ogni sala gia' configurata avrebbe iniziato ad aprire
  // posizioni diverse da quelle attese, senza che nessuno l'abbia chiesto.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      rischio: tgRischioSenzaSlDi(null, null),
      predefinito: tgRischioSenzaSl(null),
      pip: tgTpSenzaTpPip(null)
    }));
    assert.equal(r.rischio, r.predefinito,
      'senza sala e senza famiglia si ricade esattamente sul valore di sempre');
    assert.equal(r.pip, null, 'e nessun target a pip compare dal nulla');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
