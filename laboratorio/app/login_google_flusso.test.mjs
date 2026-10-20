// IL LOGIN CON GOOGLE NELL'APK DEVE ANDARE, E NON DEVE LASCIARE L'UTENTE FUORI.
//
// SEGNALATO dal proprietario (20 ottobre 2026), parola per parola: "inserisco l'email,
// inserisco la password dell'account Google, poi mi manda all'autorizzazione da un altro
// dispositivo. Ok, do l'autorizzazione. Una volta data l'autorizzazione si ricollega con
// la pagina web e mi manda sempre con errore 400. [...] Poi ritorno sull'applicazione e
// mi riporta alla verifica in due passaggi. [...] Quando la verifico mi porta sulla pagina
// web, mi dà quell'errore. [...] comunque, io chiudo l'applicazione, quindi la riavvio.
// E giustamente quando la vado a riavviare mi riporta alla pagina login, rieseguo, accedi
// con Google e quando stavolta premo il pulsante Google mi dà tutta schermata bianca."
//
// LA CAUSA, misurata: il popup di Firebase è una FINESTRA NUOVA (window.open). Dentro la
// WebView dell'APK quella finestra non viene creata: la pagina di Google si apre al posto
// dell'app e Firebase, trovandosi senza "opener", non sa a chi restituire la credenziale.
// Risponde con l'errore 400 e l'app resta a metà del giro ("verifica in due passaggi").
//
// Il REINDIRIZZAMENTO invece è una normale navigazione e funziona: la WebView apre Google,
// l'utente fa il login, Firebase richiama l'app (l'indirizzo di ritorno è questa pagina
// stessa, https://localhost/login.html, e "localhost" è fra i domini autorizzati del
// progetto) e qui getRedirectResult() legge la credenziale.
//
// Questo test NON cerca una stringa nel sorgente: estrae il blocco marcato dentro
// login.html (quindi esegue il codice che è davvero pubblicato), lo esegue con Firebase,
// finestra e magazzini finti, e guarda QUALE strada viene presa e che cosa succede.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {RADICE} from './aiuti.mjs';

const LOGIN = path.join(RADICE, 'login.html');

function leggiBlocco() {
  const html = fs.readFileSync(LOGIN, 'utf8');
  const inizio = html.indexOf('SCEGLTA FLUSSO GOOGLE: INIZIO');
  assert.ok(inizio >= 0, 'in login.html manca il blocco marcato SCEGLTA FLUSSO GOOGLE: INIZIO');
  const s = html.lastIndexOf('/*', inizio);
  assert.ok(s >= 0 && inizio - s < 60, 'il marcatore di apertura non sta dentro un commento /* ... */');
  const fine = html.indexOf('SCEGLTA FLUSSO GOOGLE: FINE', inizio);
  assert.ok(fine > inizio, 'in login.html manca il marcatore SCEGLTA FLUSSO GOOGLE: FINE');
  const e = html.indexOf('*/', fine);
  assert.ok(e > fine, 'il marcatore di chiusura non sta dentro un commento');
  return html.slice(s, e + 2);
}
const BLOCCO = leggiBlocco();

// Un mondo finto: si guarda QUALE strada di Firebase viene presa, in che ordine, e
// che cosa resta scritto nei magazzini.
function mondo({popup = 'ok', redirect = 'ok', grossi = false, capacitor = false} = {}) {
  const eventi = [];
  const errori = [];
  const messaggi = [];
  const salvati = [];
  const consumati = [];

  // Il pulsante finto: quando il blocco gli aggancia il click, ce lo tiene qui dentro
  // (il blocco gira in un ambito proprio, quindi il handler deve restare su un oggetto
  // condiviso, non in una variabile di questo file).
  const pulsante = {
    handler: null,
    addEventListener(nome, fn) { if (nome === 'click') this.handler = fn; },
  };
  const fakeDoc = {
    getElementById: (id) => (id === 'google-signin-btn' ? pulsante : null),
  };
  const fakeWin = {location: {replace: (u) => { eventi.push('va-a:' + u); }}};

  const funzione = new Function(
    'document', 'window', 'auth', 'isCapacitor', 'tocchiGrossi',
    'salvaStatoAuth', 'consumaStatoAuth',
    'signInWithRedirect', 'signInWithPopup', 'GoogleAuthProvider',
    'getAdditionalUserInfo', 'ensureUserProfile', 'sendWelcomeEmail',
    'showInfo', 'showError', 'traduciErrore', 'clearMsgs', 'DESTINATION', 'pulsante',
    `
      let skipAutoRedirect = false;
      ${BLOCCO}
      return {clic: () => pulsante.handler(), saltaRedirect: () => skipAutoRedirect};
    `);

  const f = funzione(
    fakeDoc, fakeWin, {},
    capacitor, () => grossi,
    () => { salvati.push('salvato'); },
    () => { consumati.push('consumato'); },
    async () => {
      eventi.push('redirect');
      if (redirect === 'errore') { const e = new Error('no'); e.code = 'auth/network-request-failed'; throw e; }
      return {user: {uid: 'u1'}};
    },
    async () => {
      eventi.push('popup');
      if (popup === 'errore') { const e = new Error('no'); e.code = 'auth/popup-blocked'; throw e; }
      if (popup === 'bloccato') { const e = new Error('no'); e.code = 'auth/popup-blocked'; throw e; }
      return {user: {uid: 'u1'}};
    },
    function GoogleAuthProvider() { this.providerId = 'google.com'; },
    () => ({isNewUser: false}),
    async () => {},
    async () => {},
    (m) => { messaggi.push(m); },
    (m) => { errori.push(m); },
    (codice) => 'errore:' + (codice || 'senza-codice'),
    () => {},
    'app.html',
    pulsante);

  return {f, eventi, errori, messaggi, salvati, consumati};
}

test('il blocco del login Google e\' JavaScript valido', () => {
  assert.doesNotThrow(() => new Function(BLOCCO));
});

test('nell\'APK si parte col REINDIRIZZAMENTO, mai col popup (il popup e\' cio\' che dava l\'errore 400)', async () => {
  const m = mondo({capacitor: true});
  await m.f.clic();
  assert.deepEqual(m.eventi, ['redirect'],
    'nell\'APK il popup non viene nemmeno tentato: dentro la WebView non esiste la finestra '
    + 'nuova in cui Firebase deve rimandare la credenziale, ed e\' da l\' che nasceva l\'errore 400');
  assert.deepEqual(m.errori, [], 'il giro di accesso non deve finire con un errore');
});

test('nell\'APK, prima di partire, lo stato del giro viene salvato (il processo puo\' morire)', async () => {
  const m = mondo({capacitor: true});
  await m.f.clic();
  assert.deepEqual(m.salvati, ['salvato'],
    'senza il backup dello stato, se Android uccide il processo durante la scelta dell\'account '
    + 'Firebase perde il giro e l\'utente resta fermo con "missing initial state"');
});

test('sul telefono nel BROWSER (non nell\'app) si parte col reindirizzamento', async () => {
  const m = mondo({grossi: true});
  await m.f.clic();
  assert.deepEqual(m.eventi, ['redirect'],
    'il popup sui browser mobili e\' inaffidabile: si usa il reindirizzamento');
});

test('sul computer si parte col popup (che li\' funziona ed e\' piu\' scorrevole)', async () => {
  const m = mondo({});
  await m.f.clic();
  assert.equal(m.eventi[0], 'popup', 'sul computer il popup e\' la strada normale');
  assert.ok(!m.eventi.includes('redirect'), 'sul computer non serve il reindirizzamento se il popup va bene');
  assert.ok(m.eventi.includes('va-a:app.html'), 'dopo il popup si entra nel programma');
});

test('sul computer, se il popup viene bloccato, si ripiega sul reindirizzamento', async () => {
  const m = mondo({popup: 'bloccato'});
  await m.f.clic();
  assert.deepEqual(m.eventi, ['popup', 'redirect'],
    'il popup bloccato non deve lasciare l\'utente davanti a un errore: si ripiega');
  assert.deepEqual(m.salvati, ['salvato'],
    'il ripiego col reindirizzamento deve salvare lo stato del giro come il giro normale');
});

test('se il reindirizzamento non parte, l\'errore si vede e lo stato non resta appeso', async () => {
  const m = mondo({capacitor: true, redirect: 'errore'});
  await m.f.clic();
  assert.equal(m.errori.length, 1, 'l\'utente deve vedere che cosa e\' andato storto');
  assert.deepEqual(m.consumati, ['consumato'],
    'lo stato del giro fallito va buttato: altrimenti la prossima visita sembra un login in corso');
  assert.equal(m.f.saltaRedirect(), false,
    'dopo un errore il reindirizzamento automatico va riaperto (altrimenti chi e\' gia\' loggato '
    + 'non entra piu\' nell\'app)');
});

test('con il popup riuscito si va nell\'app e non si lascia appeso il reindirizzamento', async () => {
  const m = mondo({});
  await m.f.clic();
  assert.ok(m.eventi.includes('va-a:app.html'), 'dopo il login si entra nel programma');
  assert.equal(m.f.saltaRedirect(), true,
    'durante il giro il reindirizzamento automatico resta fermo, altrimenti si salta la schermata');
});
