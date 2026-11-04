// IL CLOUD NOSTRO: DOVE VA A SCRIVERE L'APP QUANDO I DATI STANNO SUL COMPUTER.
//
// CHIESTO dal proprietario (4 novembre 2026): «per quanto riguarda il server, accendiamolo e lo
// mettiamo all'interno del nostro disco e sul PC», e subito dopo: «il nostro PC sarà di
// collegamento anche agli altri utenti per il discorso cloud».
//
// COM'ERA: le rotte /dati esistevano solo sul server Linux, e l'indirizzo era scritto come
// `'https://' + nome + ':8000'`. Due cose non tornavano per il computer: lì si parla in chiaro
// con 127.0.0.1 (https su un indirizzo locale non porta a niente), e il nome del server non è
// l'indirizzo del ponte.
//
// COM'È ADESSO: le rotte /dati vivono DENTRO il ponte del computer (porta 8000, la stessa degli
// ordini — vedi documenti_utente.py montato da bridge.py), quindi l'indirizzo dei documenti è
// quello del ponte, qualunque strada l'app abbia scelto per raggiungerlo: locale, diretta sulla
// rete privata, o inoltrata dal server. È quest'ultima la strada con cui ci arriva chi non è in
// casa — cioè la risposta alla sua seconda frase.
//
// LE DUE PROVE DI CONTROLLO contano quanto la cura: a interruttore SPENTO non deve cambiare
// niente (si torna al server Oracle se impostato, altrimenti a Firebase), e l'indirizzo
// dell'ascolto deve seguire il protocollo giusto — `wss` su https, `ws` sul ponte in chiaro,
// altrimenti il canale non si apre e gli avvisi da venti byte non arrivano.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const CHIEDI = (preparazione) => `(function(){
  ${preparazione}
  return {
    dati: fblUrlDati(),
    ascolto: fblUrlDatiAscolto('abc123'),
    acceso: fblCloudNostro(),
    dove: fblCloudDoveScrivere()
  };
})()`;

test('acceso, i documenti seguono l\'indirizzo del ponte', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(CHIEDI(`
      fblCloudNostroImposta(true);
      MT5_BRIDGE_URL='http://127.0.0.1:8000';`));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.acceso, true);
    assert.equal(r.dati, 'http://127.0.0.1:8000',
      'i documenti devono andare al ponte locale, invece: ' + r.dati);
    assert.equal(r.ascolto, 'ws://127.0.0.1:8000/dati/ascolta?token=abc123',
      'sul ponte in chiaro l\'ascolto è ws, non wss: ' + r.ascolto);
  } finally { await browser.close(); }
});

// La strada con cui ci arriva chi NON è in casa: il server inoltra al computer su /pc/8000.
test('acceso e fuori casa, i documenti passano dall\'inoltro del server', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(CHIEDI(`
      fblCloudNostroImposta(true);
      MT5_BRIDGE_URL='https://pietro.tail83d918.ts.net:8000/pc/8000';`));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.dati, 'https://pietro.tail83d918.ts.net:8000/pc/8000',
      'da fuori i documenti passano dalla stessa strada degli ordini: ' + r.dati);
    assert.ok(r.ascolto.startsWith('wss://'),
      'su https l\'ascolto deve essere wss: ' + r.ascolto);
  } finally { await browser.close(); }
});

test('acceso, si scrive sul nostro computer anche senza server Oracle', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(CHIEDI(`
      try{ localStorage.removeItem('fbl_server_host'); }catch(e){}
      fblCloudNostroImposta(true);
      MT5_BRIDGE_URL='http://127.0.0.1:8000';`));
    assert.equal(r.dove, 'nostro',
      "senza questo tutto ricadrebbe su Firebase anche con l'interruttore acceso");
  } finally { await browser.close(); }
});

// ---- PROVE DI CONTROLLO ----

test('PROVA DI CONTROLLO: spento, resta tutto come prima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(CHIEDI(`
      fblCloudNostroImposta(false);
      try{ localStorage.setItem('fbl_server_host','pietro.tail83d918.ts.net'); }catch(e){}
      MT5_BRIDGE_URL='http://127.0.0.1:8000';`));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.acceso, false);
    assert.equal(r.dati, 'https://pietro.tail83d918.ts.net:8000',
      'spento, i documenti vanno al server come sempre: ' + r.dati);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: spento e senza server, non c\'è nessun indirizzo (si usa Firebase)', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(CHIEDI(`
      fblCloudNostroImposta(false);
      try{ localStorage.removeItem('fbl_server_host'); }catch(e){}`));
    assert.equal(r.dati, '', 'senza server non c\'è un indirizzo: si scrive su Firebase');
    assert.equal(r.ascolto, '', 'e non si apre nessun ascolto');
    assert.equal(r.dove, 'firebase');
  } finally { await browser.close(); }
});

// Un nome secco deve continuare a diventare https + porta: è così che si arriva al server da
// fuori, e cambiarlo romperebbe il collegamento che arriva dall'altro dispositivo.
test('PROVA DI CONTROLLO: un nome secco resta https con la porta', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      try{ localStorage.setItem('fbl_server_host','pietro.tail83d918.ts.net'); }catch(e){}
      return {otto:fblServerUrl(8000), mille:fblServerUrl(8001)};
    })()`);
    assert.equal(r.otto, 'https://pietro.tail83d918.ts.net:8000');
    assert.equal(r.mille, 'https://pietro.tail83d918.ts.net:8001');
  } finally { await browser.close(); }
});
