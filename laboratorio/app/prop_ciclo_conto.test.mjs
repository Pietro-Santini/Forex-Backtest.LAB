// IL CICLO DELLA PROP FIRM E' LEGATO AL CONTO, non alla sessione.
//
// RICHIESTO dal proprietario: «il calcolo della prop firm inizia quando aggiungiamo un nuovo
// conto. Se la chiudiamo correttamente, finisce li' e quel conto rimane in esecuzione. Se la
// perdiamo, i calcoli non li deve piu' fare: deve smettere e dire che il conto e' stato chiuso.
// E se l'utente apre un nuovo conto demo, ricomincia il ciclo da zero per quel conto».
//
// COM'ERA PRIMA: lo stato stava in sessionByMode, cioe' legato alla SESSIONE (storico, live,
// storico+prop, live+prop). Cambiando conto MT5 ci si portava dietro la sfida di un altro conto:
// il capitale iniziale, la violazione, tutto. Due conti diversi con una sfida sola e' il tipo di
// confusione che su un conto in gestione costa davvero.
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

test('un conto nuovo comincia da zero, senza ereditare niente', async () => {
  // Il caso del proprietario: si perde la sfida su un conto, se ne apre un altro, e quello nuovo
  // deve partire pulito. Ereditare la violazione vorrebbe dire nascere gia' bocciati.
  const r = await nellApp(`(function(){
    fblPropContoAzzera();
    fblPropContoStatoSalva('CONTO-A', {stato:'chiuso', motivo:'daily'});
    return {
      vecchio: fblPropContoStato('CONTO-A').stato,
      nuovo:   fblPropContoStato('CONTO-B').stato
    };
  })()`);
  assert.equal(r.vecchio, 'chiuso', 'il conto perso resta perso');
  assert.equal(r.nuovo, 'in_corso', 'e quello nuovo nasce pulito, non eredita la bocciatura');
});

test('tornando al conto di prima si ritrova il SUO stato', async () => {
  // PROVA DI CONTROLLO della precedente: se lo stato non fosse davvero per conto, "azzerare"
  // significherebbe perdere quello vecchio - e un conto chiuso che torna in corso e' peggio che
  // non tenerne traccia affatto.
  const r = await nellApp(`(function(){
    fblPropContoAzzera();
    fblPropContoStatoSalva('CONTO-A', {stato:'chiuso', motivo:'max'});
    fblPropContoStatoSalva('CONTO-B', {stato:'finanziato'});
    return {a: fblPropContoStato('CONTO-A').stato, b: fblPropContoStato('CONTO-B').stato};
  })()`);
  assert.deepEqual(r, {a:'chiuso', b:'finanziato'},
    'ogni conto si tiene il suo: scriverne uno non ne tocca un altro');
});

test('conto CHIUSO: il motore smette di calcolare', async () => {
  // «Se la perdiamo, i calcoli non li deve piu' fare». Continuare a calcolare su un conto chiuso
  // produrrebbe numeri che non significano niente - e peggio, sembrerebbero significare qualcosa.
  const r = await nellApp(`(function(){
    fblPropContoAzzera();
    fblPropContoStatoSalva('CONTO-A', {stato:'chiuso', motivo:'daily'});
    return {calcola: fblPropContoCalcola('CONTO-A')};
  })()`);
  assert.equal(r.calcola, false, 'su un conto chiuso non si calcola piu\' niente');
});

test('conto FINANZIATO: la sfida finisce li\', ma il conto resta in esecuzione', async () => {
  // «Se la chiudiamo correttamente finisce li' e quel conto rimane in esecuzione». Sono due cose
  // diverse: la SFIDA e' finita (non si ricomincia da capo), il CONTO no.
  const r = await nellApp(`(function(){
    fblPropContoAzzera();
    fblPropContoStatoSalva('CONTO-A', {stato:'finanziato'});
    return {
      calcola: fblPropContoCalcola('CONTO-A'),
      attivo:  fblPropContoAttivo('CONTO-A')
    };
  })()`);
  assert.equal(r.calcola, false, 'la sfida non si rigioca: e\' stata passata');
  assert.equal(r.attivo, true, 'ma il conto e\' vivo e continua a operare');
});

test('PROVA DI CONTROLLO: un conto in corso si calcola eccome', async () => {
  // Senza questa, i due test qui sopra passerebbero anche con una funzione che risponde sempre
  // "no" - cioe' con una prop firm che non calcola mai niente.
  const r = await nellApp(`(function(){
    fblPropContoAzzera();
    return {calcola: fblPropContoCalcola('CONTO-NUOVO'), attivo: fblPropContoAttivo('CONTO-NUOVO')};
  })()`);
  assert.equal(r.calcola, true, 'un conto in corso si calcola');
  assert.equal(r.attivo, true, 'ed e\' attivo');
});

test('il conto si riconosce dal login MT5, e due login sono due conti', async () => {
  // L'identita' dev'essere quella vera del conto, non un numero inventato: se due conti MT5
  // diversi dessero lo stesso identificativo, si mescolerebbero le sfide senza che nulla lo dica.
  const r = await nellApp(`(function(){
    mt5ContoAttivo = {login:'5057460278', server:'MetaQuotes-Demo'};
    const a = fblPropContoId();
    mt5ContoAttivo = {login:'9999999', server:'MetaQuotes-Demo'};
    const b = fblPropContoId();
    mt5ContoAttivo = null;
    const senza = fblPropContoId();
    return {a, b, senza};
  })()`);
  assert.notEqual(r.a, r.b, 'due login diversi sono due conti diversi');
  assert.ok(r.a.indexOf('5057460278') >= 0, 'e l\'identificativo contiene il login vero');
  assert.ok(r.senza && r.senza.length > 0,
    'senza MT5 collegato serve comunque un identificativo: la prop si prova anche in simulato');
});
