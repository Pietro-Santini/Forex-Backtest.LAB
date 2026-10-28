// CONTO PERSO: cosa vuoi farne? La domanda, e le due strade.
//
// RICHIESTO dal proprietario: «per i conti chiusi con la prop firm facciamo in modo che venga
// fuori un messaggio: vuoi continuare a utilizzare questo conto per fare pratica ma senza la
// modalita' prop firm? Oppure vuoi eliminare questo conto e crearne uno nuovo? Se sceglie di
// continuare ad esercitarsi senza la prop firm lo puo' fare tranquillamente. Se dice di
// eliminarlo, prima elimina l'account lasciandolo comunque nella dashboard, poi l'utente puo'
// eliminarlo anche dalla dashboard, definitivamente».
//
// PERCHE' LA DOMANDA SERVE: un conto perso oggi resta li' muto, con la schermata di violazione e
// nient'altro. L'utente non sa se quel conto e' ancora buono per esercitarsi (lo e'), ne' come
// ricominciare. Due strade dichiarate valgono piu' di una schermata rossa.
//
// E LA CANCELLAZIONE E' IN DUE TEMPI DI PROPOSITO: prima si toglie di mezzo, poi - con calma e
// con un gesto diverso - si cancella davvero. Un conto che sparisce al primo clic porta con se'
// lo storico delle operazioni, e quello non si recupera.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

async function nellApp(codice){
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(codice);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    return r;
  } finally { await browser.close(); }
}

test('un conto perso CHIEDE cosa farne, una volta sola', async () => {
  const r = await nellApp(`(function(){
    fblPropContoAzzera();
    fblPropContoStatoSalva('C1', {stato:'chiuso', motivo:'daily'});
    const prima = fblPropContoDaChiedere('C1');
    fblPropContoScegli('C1','pratica');
    const dopo = fblPropContoDaChiedere('C1');
    return {prima, dopo};
  })()`);
  assert.equal(r.prima, true, 'appena perso, la domanda si deve fare');
  assert.equal(r.dopo, false,
    'ma una volta risposto non si richiede piu\': ripetere la stessa domanda e\' un modo di non ascoltare');
});

test('scelta PRATICA: il conto resta usabile, senza prop firm', async () => {
  // «Se sceglie di continuare ad esercitarsi senza la prop firm lo puo' fare tranquillamente».
  const r = await nellApp(`(function(){
    fblPropContoAzzera();
    fblPropContoStatoSalva('C1', {stato:'chiuso', motivo:'daily'});
    fblPropContoScegli('C1','pratica');
    const st = fblPropContoStato('C1');
    return {stato:st.stato, scelta:st.scelta,
            attivo: fblPropContoAttivo('C1'), calcola: fblPropContoCalcola('C1')};
  })()`);
  assert.equal(r.scelta, 'pratica');
  assert.equal(r.attivo, true, 'il conto resta usabile per esercitarsi');
  assert.equal(r.calcola, false,
    'ma la prop firm NON ricomincia a calcolare: la sfida e\' persa, e fingere il contrario sarebbe peggio');
});

test('scelta ELIMINA: il conto si archivia, ma resta nella dashboard', async () => {
  // «Prima elimina l'account lasciandolo comunque nella dashboard». Archiviato non vuol dire
  // sparito: lo storico e' ancora li' da guardare.
  const r = await nellApp(`(function(){
    fblPropContoAzzera();
    fblPropContoStatoSalva('C1', {stato:'chiuso', motivo:'max'});
    fblPropContoScegli('C1','elimina');
    const st = fblPropContoStato('C1');
    return {scelta:st.scelta, archiviato:st.archiviato,
            inElenco: fblPropContiElenco().some(c=>c.id==='C1')};
  })()`);
  assert.equal(r.archiviato, true, 'archiviato');
  assert.equal(r.inElenco, true,
    'ma ancora elencato: cancellarlo subito porterebbe via lo storico, e quello non torna');
});

test('la cancellazione DEFINITIVA e\' un secondo gesto, e allora sparisce davvero', async () => {
  const r = await nellApp(`(function(){
    fblPropContoAzzera();
    fblPropContoStatoSalva('C1', {stato:'chiuso'});
    fblPropContoScegli('C1','elimina');
    const prima = fblPropContiElenco().length;
    fblPropContoEliminaDefinitivo('C1');
    const dopo = fblPropContiElenco().length;
    return {prima, dopo};
  })()`);
  assert.equal(r.prima, 1);
  assert.equal(r.dopo, 0, 'col secondo gesto il conto sparisce per davvero');
});

test('PROVA DI CONTROLLO: un conto IN CORSO non chiede niente e non si archivia', async () => {
  // Senza questa, i test sopra passerebbero anche con un codice che tratta ogni conto come perso
  // - e chiedere «vuoi eliminarlo?» a chi sta andando bene sarebbe allarmante oltre che falso.
  const r = await nellApp(`(function(){
    fblPropContoAzzera();
    return {chiede: fblPropContoDaChiedere('C-NUOVO'),
            archiviato: !!fblPropContoStato('C-NUOVO').archiviato};
  })()`);
  assert.equal(r.chiede, false, 'a un conto in corso non si chiede niente');
  assert.equal(r.archiviato, false);
});

test('un conto archiviato non si confonde con uno perso e basta', async () => {
  // Sono due situazioni diverse: «perso, e non ho ancora deciso» e «perso, e ho deciso di
  // toglierlo». La dashboard le deve poter distinguere, se no mostrerebbe la stessa cosa a chi
  // deve ancora scegliere e a chi ha gia' scelto.
  const r = await nellApp(`(function(){
    fblPropContoAzzera();
    fblPropContoStatoSalva('PERSO', {stato:'chiuso'});
    fblPropContoStatoSalva('TOLTO', {stato:'chiuso'});
    fblPropContoScegli('TOLTO','elimina');
    return {
      persoChiede: fblPropContoDaChiedere('PERSO'),
      persoArch:   !!fblPropContoStato('PERSO').archiviato,
      toltoChiede: fblPropContoDaChiedere('TOLTO'),
      toltoArch:   !!fblPropContoStato('TOLTO').archiviato
    };
  })()`);
  assert.deepEqual(r, {persoChiede:true, persoArch:false, toltoChiede:false, toltoArch:true});
});

test('i due pulsanti esistono davvero e sono premibili', async () => {
  // Un pezzo di logica che nessuno puo' premere non serve a niente. Qui si controlla che la
  // schermata di violazione li mostri, e che premerli registri la scelta sul conto.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      fblPropContoAzzera();
      mt5ContoAttivo = {login:'111222', server:'Prova'};
      const id = fblPropContoId();
      fblPropContoStatoSalva(id, {stato:'chiuso', motivo:'daily'});
      propFirmViolation = {rule:'daily', dailyStartBalance:10000, equityNow:9000,
                           dailyLoss:1000, dailyLossLimit:500, dailyLossPct:10};
      showPropFirmViolationOverlay();
      const box = document.getElementById('pfSceltaConto');
      const visibile = !!(box && box.style.display !== 'none');
      document.getElementById('pfSceltaPraticaBtn').click();
      return {visibile, scelta: fblPropContoStato(id).scelta,
              richiede: fblPropContoDaChiedere(id)};
    })()`);
    assert.equal(r.visibile, true, 'la domanda deve comparire nella schermata di violazione');
    assert.equal(r.scelta, 'pratica', 'e premere il pulsante deve registrare la scelta');
    assert.equal(r.richiede, false, 'dopo non si richiede piu\'');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: a un conto che non ha perso la domanda NON compare', async () => {
  // Chiedere «vuoi eliminare questo conto?» a chi sta andando bene sarebbe allarmante, oltre che
  // falso. Senza questa prova, il test qui sopra passerebbe anche con una domanda sempre accesa.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      fblPropContoAzzera();
      mt5ContoAttivo = {login:'333444', server:'Prova'};
      propFirmViolation = {rule:'max', initialCapital:10000, equityNow:8500,
                           totalLoss:1500, maxDrawdownLimit:1000, totalLossPct:15};
      showPropFirmViolationOverlay();
      const box = document.getElementById('pfSceltaConto');
      return {visibile: !!(box && box.style.display !== 'none')};
    })()`);
    assert.equal(r.visibile, false,
      'senza un conto segnato come perso la domanda non si fa');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
