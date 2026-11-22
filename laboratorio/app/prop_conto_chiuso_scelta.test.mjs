// CONTO PERSO: stato visibile, nessuna domanda ripetuta (8.4.9).
//
// 8.4.9 (decisione proprietario): dopo la violazione non deve comparire più la domanda/popup
// "cosa vuoi farne". Lo stato del conto (attivo/fallito/passato) va mostrato nella lista conti.
// I conti non idonei non devono generare popup; le scelte già prese non si richiedono più.
//
// La cancellazione resta in due tempi (archivio -> eliminazione definitiva) dove usata.
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

test('8.4.9: un conto perso NON chiede cosa farne (nessun popup ripetuto)', async () => {
  const r = await nellApp(`(function(){
    fblPropContoAzzera();
    fblPropContoStatoSalva('C1', {stato:'chiuso', motivo:'daily'});
    const prima = fblPropContoDaChiedere('C1');
    fblPropContoScegli('C1','pratica');
    const dopo = fblPropContoDaChiedere('C1');
    return {prima, dopo, stato:fblPropContoStato('C1').stato};
  })()`);
  assert.equal(r.prima, false, '8.4.9: dopo violazione nessuna domanda');
  assert.equal(r.dopo, false, '8.4.9: nessuna domanda ripetuta');
  assert.equal(r.stato, 'chiuso');
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

test('8.4.9: conto perso/archiviato non genera domanda, ma si distingue per stato/archivio', async () => {
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
  assert.deepEqual(r, {persoChiede:false, persoArch:false, toltoChiede:false, toltoArch:true});
});

test('8.4.9: dopo violazione la domanda "cosa farne" non compare', async () => {
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
      return {visibile, richiede: fblPropContoDaChiedere(id), stato: fblPropContoStato(id).stato};
    })()`);
    assert.equal(r.visibile, false, '8.4.9: nessuna domanda nella schermata di violazione');
    assert.equal(r.richiede, false);
    assert.equal(r.stato, 'chiuso');
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
