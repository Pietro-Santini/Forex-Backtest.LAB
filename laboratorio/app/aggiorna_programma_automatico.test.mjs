// IL PULSANTE «AGGIORNA» DEVE AGGIORNARE ANCHE IL PROGRAMMA, non solo la pagina.
//
// SEGNALATO dal proprietario: «carica la nuova impaginazione ma non scarica
// ForexBacktestLAB.exe. Ogni volta devo andare su collegamento, spegnere il terminale MT5 e
// mettermi a scaricare i pacchetti a mano».
//
// LA CAUSA, trovata leggendo fblPianoAggiornamento(): si chiedeva al ponte QUALE COPIA dell'app
// stesse servendo, e se serviva quella aggiornata si concludeva «il pacchetto non serve». Ma il
// ponte puo' servire la pagina nuova restando lui stesso un ESEGUIBILE VECCHIO - ed e' proprio
// la situazione che rompe il collegamento con MT5, perche' li' il codice vecchio c'e' davvero.
// Le due cose non sono la stessa, e trattarle come tali faceva rispondere «tutto a posto»
// esattamente nel caso in cui non lo era.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Prepara l'app come se girasse su Windows e mette un finto ponte che risponde quello che
// vogliamo. Torna il piano d'aggiornamento calcolato.
const PIANO = (rispostaVersioneProgramma, rispostaHealth) => `(async function(){
  fblPianoAggiornamentoCache = null;            // la cache dura 60s: va azzerata o si misura il giro prima
  fblPiattaforma = () => 'windows';
  window.__chiamate = [];
  fetchMt5WithTimeout = async function(percorso){
    window.__chiamate.push(percorso);
    if(percorso.indexOf('/versione-programma')===0) return ${JSON.stringify(rispostaVersioneProgramma)};
    if(percorso.indexOf('/health')===0)            return ${JSON.stringify(rispostaHealth)};
    return {ok:false};
  };
  const piano = await fblPianoAggiornamento();
  return {piano, chiamate: window.__chiamate};
})()`;

test('programma indietro rispetto alla pagina: il pacchetto serve, e si installa da solo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PIANO(
      {ok:true, data:{programma:'2.0.30', pagina:'2.0.37', da_aggiornare:true}},
      {ok:true, data:{app:{versione:'2.0.37', da:'copia aggiornata'}}}
    ));
    assert.equal(r.piano.serve, true,
      'con l\'eseguibile alla 2.0.30 e la pagina alla 2.0.37 il pacchetto serve');
    assert.equal(r.piano.automatico, true,
      'e il ponte puo\' installarlo da solo: e\' questo che toglie il lavoro a mano all\'utente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('IL CASO CHE PRIMA SBAGLIAVA: ponte che serve la pagina nuova ma ha l\'eseguibile vecchio', async () => {
  // E' lo scenario reale del proprietario. `/health` dice «copia aggiornata» - e con la vecchia
  // regola bastava per concludere «non serve il pacchetto» e limitarsi a ricaricare la pagina,
  // lasciando l'eseguibile indietro e il collegamento MT5 rotto. Ora decide la versione
  // dell'eseguibile, e la risposta si capovolge.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PIANO(
      {ok:true, data:{programma:'2.0.30', pagina:'2.0.37', da_aggiornare:true}},
      {ok:true, data:{app:{versione:'2.0.37', da:'copia aggiornata'}}}   // la vecchia regola direbbe "non serve"
    ));
    assert.equal(r.piano.serve, true,
      'servire la pagina nuova NON vuol dire essere un eseguibile nuovo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('programma gia\' aggiornato: si ricarica la pagina e basta, niente pacchetto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PIANO(
      {ok:true, data:{programma:'2.0.37', pagina:'2.0.37', da_aggiornare:false}},
      {ok:true, data:{app:{versione:'2.0.37', da:'copia installata'}}}
    ));
    assert.equal(r.piano.serve, false,
      'se l\'eseguibile e\' gia\' alla versione della pagina, scaricare il pacchetto non porta niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ponte vecchio che non conosce la rotta: si ricade sul ragionamento di prima, senza rompersi', async () => {
  // Compatibilita' all'indietro: un'app nuova con un ponte vecchio deve comportarsi come ieri,
  // non peggio. La rotta risponde 404 (ok:false) e si torna a guardare quale copia serve.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PIANO(
      {ok:false},
      {ok:true, data:{app:{versione:'2.0.37', da:'copia aggiornata'}}}
    ));
    assert.equal(r.piano.serve, false, 'col ponte vecchio vale la vecchia regola');
    assert.ok(r.chiamate.some(c=>c.indexOf('/health')===0),
      'deve aver chiesto /health come ripiego');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('«non lo so» non diventa «tutto a posto»', async () => {
  // Quando il registro non si legge, il ponte risponde da_aggiornare:null. Trattare quel null
  // come «false» sarebbe il modo piu' silenzioso di rimettere il difetto dov'era: si deve
  // ricadere sul ripiego, non concludere che va tutto bene.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PIANO(
      {ok:true, data:{programma:null, pagina:'2.0.37', da_aggiornare:null}},
      {ok:true, data:{app:{versione:'2.0.37', da:'copia installata'}}}   // il ripiego dice: serve
    ));
    assert.equal(r.piano.serve, true,
      'con «non lo so» si ricade sul ripiego, che qui dice che il pacchetto serve');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
