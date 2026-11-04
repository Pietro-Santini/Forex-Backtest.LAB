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

// ====== L'INTERRUTTORE NON SI ACCENDE CONTRO UN PONTE VECCHIO ======
//
// Le rotte /dati arrivano col pacchetto della v2.0.82. Un ponte precedente risponde 404: acceso
// contro quello, l'utente crederebbe di aver spostato i suoi dati senza averlo fatto (Firebase
// resta la rete di sicurezza, quindi non si perde niente — ma la convinzione sbagliata resta).
// La domanda non porta il token di proposito: senza token una rotta che ESISTE risponde 401 e una
// che non esiste risponde 404. Bastano quei due numeri.
const PREMI_INTERRUTTORE = `(async function(){
  fblCloudNostroImposta(false);
  MT5_BRIDGE_URL='http://127.0.0.1:8000';
  const sw=document.getElementById('fblCloudNostroSw');
  if(!sw) return {errore:'manca l interruttore nel pannello'};
  sw.checked=true;
  sw.dispatchEvent(new Event('change'));
  for(let i=0;i<40;i++){ await new Promise(r=>setTimeout(r,50)); if(!sw.checked||fblCloudNostro())break; }
  return {spuntato:sw.checked, acceso:fblCloudNostro(), dove:fblCloudDoveScrivere(),
          nota:(document.getElementById('fblCloudNostroNota')||{}).textContent||''};
})()`;

test('col ponte vecchio (404) l\'interruttore si rifiuta di accendersi e spiega perché', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.route(u => u.pathname.endsWith('/dati/session'),
      r => r.fulfill({status: 404, contentType: 'application/json', body: '{"detail":"Not Found"}'}));
    const r = await pagina.evaluate(PREMI_INTERRUTTORE);
    assert.ok(!r.errore, r.errore || '');
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.acceso, false, 'non si deve accendere contro un ponte che non ha le rotte');
    assert.equal(r.spuntato, false, 'e la spunta deve tornare indietro, non restare accesa a vuoto');
    assert.equal(r.dove, 'firebase', 'i dati devono restare su Firebase');
    assert.ok(/pacchetto|v2\.0\.82/i.test(r.nota),
      'la nota deve dire cosa fare (installare il pacchetto nuovo): "' + r.nota + '"');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: col ponte che LE HA (risponde 401, cioè «ci sono, e chiedo chi sei»)
// l'interruttore si accende. Senza questa, un controllo rotto che rifiuta sempre passerebbe la
// prova qui sopra e la funzione non si potrebbe mai accendere.
test('PROVA DI CONTROLLO: col ponte nuovo (401) l\'interruttore si accende', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.route(u => u.pathname.endsWith('/dati/session'),
      r => r.fulfill({status: 401, contentType: 'application/json',
                      body: '{"detail":"Token Firebase mancante."}'}));
    const r = await pagina.evaluate(PREMI_INTERRUTTORE);
    assert.ok(!r.errore, r.errore || '');
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.acceso, true, '401 vuol dire che la rotta c\'è: si deve poter accendere');
    assert.equal(r.dove, 'nostro');
  } finally { await browser.close(); }
});

// ====== LA SESSIONE ARRIVA IN DUE FORME ======
//
// L'ascolto della sessione era l'ULTIMO documento rimasto su onSnapshot — ed è il più grosso: 48
// KB misurati. Con Firestore ogni modifica lo fa riscaricare intero a ogni dispositivo in
// ascolto, anche a quello che l'ha appena scritto: è da lì che vengono le letture che si pagano.
// Gli altri tre documenti erano già passati all'ascolto nostro il 31 ottobre; questo no, e così
// la cura restava a metà — la metà che si paga.
//
// La forma del dato è diversa fra i due posti: su Firestore il documento è `{state: ...}`, sul
// nostro il contenuto È lo stato. Tradurla male non dà un errore: dà uno stato VUOTO, che è il
// modo più silenzioso di cancellare il lavoro di qualcuno. Per questo la traduzione è una
// funzione sola, e si misura qui.
test('la sessione si legge giusta da entrambe le forme', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      const dentro={positions:[{id:'p1'}],version:9};
      return {
        daFirestore: fblSessioneDaDocumento({state:dentro}),
        dalNostro: fblSessioneDaDocumento(dentro),
        vuoto: fblSessioneDaDocumento(null),
        bustaVuota: fblSessioneDaDocumento({state:null})
      };
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.deepEqual(r.daFirestore, {positions:[{id:'p1'}], version:9},
      'da Firestore si apre la busta `state`');
    assert.deepEqual(r.dalNostro, {positions:[{id:'p1'}], version:9},
      'dal nostro server il contenuto è già lo stato: non va cercata una busta che non c\'è');
    assert.equal(r.vuoto, null, '«non c\'è niente» deve restare null');
    assert.equal(r.bustaVuota, null, 'una busta vuota è «non c\'è niente», non uno stato vuoto');
  } finally { await browser.close(); }
});

// ====== ACCESO DI DEFAULT, MA SOLO DOVE RISPONDE ======
//
// CHIESTO dal proprietario (4 novembre 2026): «di default poi il mio PC terrà i dati degli utenti
// e miei sul mio PC, sul disco E».
//
// PERCHÉ IL DEFAULT NON PUÒ ESSERE «ACCESO E BASTA»: su un telefono non c'è nessun ponte, quindi
// un default acceso alla cieca farebbe sbattere OGNI salvataggio contro una porta chiusa prima di
// ricadere su Firebase — lento e inutile. Quindi all'avvio si chiede una volta se le rotte ci
// sono, e la risposta si ricorda sul dispositivo.
//
// E SONO TRE STATI, non due: una scelta esplicita dell'utente non si scavalca al prossimo avvio.
// Senza lo '0', chi spegne l'interruttore lo ritroverebbe acceso la volta dopo.
const STATO = (preparazione) => `(function(){
  try{ localStorage.removeItem('fbl_cloud_nostro'); }catch(e){}
  try{ localStorage.removeItem('fbl_cloud_nostro_visto'); }catch(e){}
  ${preparazione}
  return {acceso: fblCloudNostro(), scelta: fblCloudNostroScelta(), visto: fblCloudNostroVisto()};
})()`;

test('senza scelta dell\'utente, acceso se le rotte hanno risposto su questo dispositivo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const risponde = await pagina.evaluate(STATO(`fblCloudNostroVistoImposta(true);`));
    const nonRisponde = await pagina.evaluate(STATO(`fblCloudNostroVistoImposta(false);`));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(risponde.acceso, true,
      'dove il cloud nostro risponde, di default i dati stanno sul computer');
    assert.equal(nonRisponde.acceso, false,
      'dove non risponde (un telefono senza ponte) non si accende: si resta su Firebase');
  } finally { await browser.close(); }
});

// LA PROVA CHE CONTA PER CHI USA L'APP: una scelta esplicita non viene scavalcata dal default.
test('se l\'utente lo spegne, resta spento anche se le rotte rispondono', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(STATO(`
      fblCloudNostroVistoImposta(true);
      fblCloudNostroImposta(false);`));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.scelta, '0', 'lo spegnimento si scrive, non si cancella e basta');
    assert.equal(r.acceso, false,
      'senza lo «0» il default lo riaccenderebbe al prossimo avvio, e l\'utente ritroverebbe acceso quello che aveva spento');
  } finally { await browser.close(); }
});

test('se l\'utente lo accende, resta acceso anche se la verifica non ha ancora risposto', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(STATO(`
      fblCloudNostroVistoImposta(false);
      fblCloudNostroImposta(true);`));
    assert.equal(r.acceso, true, 'la scelta dell\'utente vince sulla verifica');
  } finally { await browser.close(); }
});

// La verifica all'avvio ricorda la risposta: è lei che decide il default.
test('la verifica all\'avvio ricorda se le rotte ci sono', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.route(u => u.pathname.endsWith('/dati/session'),
      r => r.fulfill({status: 401, contentType: 'application/json', body: '{}'}));
    const r = await pagina.evaluate(`(async function(){
      try{ localStorage.removeItem('fbl_cloud_nostro'); }catch(e){}
      fblCloudNostroVistoImposta(false);
      MT5_BRIDGE_URL='http://127.0.0.1:8000';
      await fblCloudNostroGuarda();
      return {visto: fblCloudNostroVisto(), acceso: fblCloudNostro()};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.visto, true, '401 vuol dire che la rotta c\'è: va ricordato');
    assert.equal(r.acceso, true, 'e da lì il default è acceso');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: col 404 la verifica deve ricordare che NON ci sono. Senza questa, una
// verifica rotta che risponde sempre «sì» accenderebbe il default anche su un telefono.
test('PROVA DI CONTROLLO: col 404 la verifica ricorda che le rotte non ci sono', async () => {
  const {browser, pagina} = await apriApp();
  try {
    await pagina.route(u => u.pathname.endsWith('/dati/session'),
      r => r.fulfill({status: 404, contentType: 'application/json', body: '{}'}));
    const r = await pagina.evaluate(`(async function(){
      try{ localStorage.removeItem('fbl_cloud_nostro'); }catch(e){}
      fblCloudNostroVistoImposta(true);
      MT5_BRIDGE_URL='http://127.0.0.1:8000';
      await fblCloudNostroGuarda();
      return {visto: fblCloudNostroVisto(), acceso: fblCloudNostro()};
    })()`);
    assert.equal(r.visto, false, 'il 404 va ricordato come «non ci sono»');
    assert.equal(r.acceso, false, 'e il default resta spento: si usa Firebase');
  } finally { await browser.close(); }
});
