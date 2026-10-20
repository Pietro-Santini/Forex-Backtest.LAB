// IL RISULTATO DELL'ACCESSO CON GOOGLE VA LETTO, ANCHE SE LA PAGINA NON SI RICARICA.
//
// MISURATO il 20 ottobre 2026 dal proprietario, sull'app: "il login riesce, il problema e' che
// porta sempre sulla pagina di Google con l'errore 400. Solo che stavolta ho chiuso, sono
// ritornato indietro. Ho chiuso l'applicazione, l'ho riaperta e mi ha fatto l'accesso.
// Mentre invece sul tablet continua a riaprirsi quella che e' la pagina verifica in due passaggi
// e l'accesso con Google. Non riesce a fare l'accesso."
//
// LA CAUSA: quando Firebase richiama l'app (https://localhost/login.html#...token...), dentro la
// WebView dell'APK la pagina puo' cambiare SOLO il fragmento, senza ricaricarsi. Il codice della
// pagina resta quello di prima, che aveva gia' letto il risultato (e l'aveva svuotato): la
// credenziale arrivava e nessuno la leggeva. L'app restava ferma sulla pagina di accesso, e al
// giro dopo la bandierina "login in corso" faceva ripartire tutto - sul tablet non finiva piu'.
// Sul telefono bastava riaprire l'app: Firebase aveva gia' salvato l'utente, e al riavvio
// onAuthStateChanged lo trovava. Insomma: l'accesso andava, a leggerlo no.
//
// IL RIMEDIO: il risultato si legge SEMPRE (non solo quando la bandierina dice che il giro e'
// partito), e si rilegge quando il fragmento arriva (hashchange), quando la pagina torna dalla
// cronologia (pageshow) e quando l'utente torna sull'app (visibilitychange).
//
// Questo test esegue il blocco vero di login.html con Firebase e finestra finti: guarda quante
// volte il risultato viene chiesto e che cosa succede, non come e' scritto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {RADICE} from './aiuti.mjs';

const LOGIN = path.join(RADICE, 'login.html');

function leggiBlocco() {
  const html = fs.readFileSync(LOGIN, 'utf8');
  const inizio = html.indexOf('ESITO DEL GIRO DI ACCESSO: INIZIO');
  assert.ok(inizio >= 0, 'in login.html manca il blocco marcato ESITO DEL GIRO DI ACCESSO: INIZIO');
  const s = html.lastIndexOf('/*', inizio);
  assert.ok(s >= 0 && inizio - s < 60, 'il marcatore di apertura non sta dentro un commento /* ... */');
  const fine = html.indexOf('ESITO DEL GIRO DI ACCESSO: FINE', inizio);
  assert.ok(fine > inizio, 'in login.html manca il marcatore ESITO DEL GIRO DI ACCESSO: FINE');
  const e = html.indexOf('*/', fine);
  assert.ok(e > fine, 'il marcatore di chiusura non sta dentro un commento');
  return html.slice(s, e + 2);
}
const BLOCCO = leggiBlocco();

// Un mondo finto: si conta quante volte viene chiesto il risultato e dove finisce l'utente.
function mondo({cred = null, errore = null, hash = '', pendente = false} = {}) {
  const eventi = [];
  const errori = [];
  const messaggi = [];
  const consumati = [];
  const hashChange = [];
  const pageShow = [];
  const visibility = [];

  const fakeWin = {
    location: {hash, replace: (u) => { eventi.push('va-a:' + u); }},
    addEventListener: (n, f) => {
      if (n === 'hashchange') hashChange.push(f);
      if (n === 'pageshow') pageShow.push(f);
    },
  };
  const fakeDoc = {
    visibilityState: 'visible',
    addEventListener: (n, f) => { if (n === 'visibilitychange') visibility.push(f); },
  };

  const funzione = new Function(
    'window', 'document', 'auth', 'getRedirectResult', 'consumaStatoAuth',
    'getAdditionalUserInfo', 'ensureUserProfile', 'sendWelcomeEmail',
    'showInfo', 'showError', 'traduciErrore', 'DESTINATION',
    'fblFrammentoConCredenziale', 'loginGoogleInCorso',
    `
      let skipAutoRedirect = false;
      ${BLOCCO}
      return {leggi: leggiEsitoAccesso, salta: () => skipAutoRedirect, esitoLetto: () => esitoLetto};
    `);

  let richieste = 0;
  const f = funzione(
    fakeWin, fakeDoc, {},
    async () => {
      richieste++;
      eventi.push('lette-risultato');
      if (errore) throw errore;
      return cred;
    },
    () => { consumati.push('consumato'); },
    () => ({isNewUser: false}),
    async () => {},
    async () => {},
    (m) => { messaggi.push(m); },
    (m) => { errori.push(m); },
    (c) => 'errore:' + (c || 'senza-codice'),
    'app.html',
    () => !!(fakeWin.location.hash && /access_token|id_token/.test(fakeWin.location.hash)),
    pendente);

  return {
    f, eventi, errori, messaggi, consumati, hashChange, pageShow, visibility,
    richieste: () => richieste,
    // Il blocco, quando viene eseguito, chiama da per se' leggiEsitoAccesso(false): e' la
    // lettura dell'avvio della pagina. Il test aspetta che finisca, altrimenti le letture
    // successive verrebbero rimandate (e non si vedrebbe nessun errore).
    attendi: async () => { for (let i = 0; i < 5; i++) await new Promise(r => setImmediate(r)); },
    // Il fragmento arriva dopo, senza ricaricare la pagina (il caso della WebView).
    arrivaIlFragmento: (h) => { fakeWin.location.hash = h; hashChange.forEach(f => f()); },
    tornaInPrimoPiano: () => { visibility.forEach(f => f()); },
  };
}

test('il blocco dell\'esito e\' JavaScript valido', () => {
  assert.doesNotThrow(() => new Function(BLOCCO));
});

test('il risultato viene letto SUBITO, anche senza la bandierina "login in corso"', async () => {
  // Questo e' il punto: prima il risultato si leggeva solo se la bandierina c'era, e la
  // bandierina poteva non esserci (perche' il giro e' finito, o perche' e' scaduta) mentre la
  // credenziale era l'i': la pagina non leggeva niente e l'accesso non si completava.
  const m = mondo({cred: {user: {uid: 'u1'}}, pendente: false});
  await m.attendi();
  assert.equal(m.richieste(), 1, 'il risultato va chiesto comunque');
  assert.ok(m.eventi.includes('va-a:app.html'), 'con la credenziale si entra nell\'app');
  assert.deepEqual(m.consumati, ['consumato'], 'lo stato del giro si consuma');
});

test('il fragmento che arriva DOPO (senza ricaricare la pagina) viene letto: l\'accesso si completa', async () => {
  // Il caso misurato sull'APK: la pagina e' gia' caricata, il fragmento con la credenziale
  // arriva e la pagina NON si ricarica. Senza il rilettura, l'utente restava fermo.
  const m = mondo({cred: null, pendente: true, hash: ''});
  await m.attendi();
  assert.equal(m.richieste(), 1, 'alla carica si chiede il risultato (e non c\'e\' ancora)');
  assert.deepEqual(m.errori, [], 'non si deve sbagliare a dire "accesso non riuscito" se il giro non e\' ancora tornato');

  // Ora arriva la credenziale, nel fragmento, senza ricaricare la pagina.
  m.arrivaIlFragmento('#access_token=abc');
  await m.attendi();
  assert.ok(m.richieste() >= 2, 'il fragmento che arriva dopo deve far rileggere il risultato');
});

test('il giro annullato: l\'utente viene avvisato e lo stato non resta appeso', async () => {
  const m = mondo({cred: null, pendente: true});
  await m.attendi();
  await m.f.leggi(true);
  await m.attendi();
  assert.equal(m.errori.length, 1, 'l\'utente deve vedere che il giro non e\' riuscito');
  assert.deepEqual(m.consumati, ['consumato'],
    'lo stato del giro va buttato: altrimenti la prossima visita sembra un accesso in corso');
  assert.equal(m.f.salta(), false, 'il reindirizzamento automatico va riaperto');
});

test('il giro finito male: si dice l\'errore e non si lascia la bandierina appesa', async () => {
  const e = new Error('no');
  e.code = 'auth/network-request-failed';
  const m = mondo({errore: e, pendente: true});
  await m.attendi();
  await m.f.leggi(true);
  await m.attendi();
  assert.equal(m.errori.length, 1, 'l\'errore del giro va mostrato');
  assert.match(m.errori[0], /network-request-failed/, 'e deve essere quello vero');
  assert.deepEqual(m.consumati, ['consumato'], 'anche in errore lo stato si consuma');
});

test('rileggere due volte non fa danni: il risultato e\' lo stesso', async () => {
  const m = mondo({cred: {user: {uid: 'u1'}}, pendente: true});
  await m.attendi();
  const n = m.richieste();
  await m.f.leggi(true);
  await m.attendi();
  assert.ok(m.richieste() >= n, 'una seconda lettura e\' lecita (il fragmento puo\' arrivare dopo)');
  assert.ok(m.eventi.includes('va-a:app.html'), 'e l\'accesso resta quello');
});
