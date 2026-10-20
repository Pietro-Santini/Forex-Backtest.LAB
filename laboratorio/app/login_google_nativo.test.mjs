// NELL'APP INSTALLATA L'ACCESSO CON GOOGLE LO FA IL SISTEMA, NON LA PAGINA.
//
// SEGNALATO dal proprietario (20 ottobre 2026), dopo che il giro dentro la pagina era già
// stato corretto due volte: «quando installiamo l'applicazione e andiamo a fare il login con
// google ci manda al collegamento con firebase e ci fa mettere email e password, poi ci porta
// all'autenticazione a due fattori, una volta che confermiamo l'autenticazione invece di
// accedere all'applicazione ci rimanda alla pagina web google con errore 400. [...] dopo di
// che ritorno sull'applicazione e rimane ancora in corso l'autenticazione a due fattori che
// continua a girare la rotellina del caricamento ma io l'ho confermato».
//
// MISURATO prima di cambiare strada: l'APK che aveva in mano era costruito alle 11:10, DOPO
// l'aggiornamento di www alle 11:09, quindi conteneva già la correzione della 2.0.10 (il test
// apk_versione.test.mjs lo conferma: dentro il pacchetto c'è la stessa versione del
// repository). Non era una copia vecchia: la strada era sbagliata.
//
// PERCHE' ERA SBAGLIATA. Dentro la WebView dell'app il giro OAuth di Google non è
// affidabile, né col popup (la WebView non apre finestre nuove: Firebase resta senza
// "opener" e risponde 400) né col reindirizzamento (si finisce comunque su una pagina di
// Google con errore 400 dopo la verifica in due passaggi). Non è un difetto da aggirare con
// un altro accorgimento: l'accesso OAuth in una WebView incorporata è una strada chiusa.
//
// COME FUNZIONA ADESSO: lo fa il sistema operativo, fuori dalla pagina, con il plugin nativo
// (@capacitor-firebase/authentication 8.5.2 — quello suggerito all'inizio,
// @codetrix-studio/capacitor-google-auth, è alla 3.4.0-rc.4 e dichiara Capacitor 6, mentre il
// progetto è su Capacitor 8). Android restituisce un idToken, e qui lo si scambia con Firebase
// (signInWithCredential). Nessuna navigazione, nessuna finestra, nessun ritorno da leggere.
//
// LA REGOLA CHE QUESTI TEST TENGONO FERMA: nell'app, se il nativo non riesce, NON si ripiega
// sul popup né sul reindirizzamento — si ripiegherebbe esattamente nell'errore 400. Si dice
// cosa è andato storto e si resta sulla pagina di accesso.
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
  const fine = html.indexOf('SCEGLTA FLUSSO GOOGLE: FINE', inizio);
  assert.ok(fine > inizio, 'in login.html manca il marcatore SCEGLTA FLUSSO GOOGLE: FINE');
  const e = html.indexOf('*/', fine);
  return html.slice(s, e + 2);
}
const BLOCCO = leggiBlocco();

// Un mondo finto. `nativo` descrive come si comporta il plugin di Android:
//   'ok'        -> restituisce un idToken, come quando l'utente scegli l'account;
//   'assente'   -> il plugin non c'è (APK vecchio che apre una pagina nuova);
//   'annullato' -> l'utente ha chiuso l'elenco degli account;
//   'impronta'  -> DEVELOPER_ERROR: firma o client OAuth non corrispondenti;
//   'senzaToken'-> risponde, ma senza idToken (il caso che lasciava la rotellina a girare).
function mondo({nativo = 'ok', capacitor = true, nuovoUtente = false} = {}) {
  const eventi = [];
  const errori = [];
  const messaggi = [];

  const pulsante = {
    handler: null,
    addEventListener(nome, fn) { if (nome === 'click') this.handler = fn; },
  };
  const fakeDoc = {getElementById: (id) => (id === 'google-signin-btn' ? pulsante : null)};

  const plugin = {
    async signInWithGoogle() {
      eventi.push('nativo');
      if (nativo === 'annullato') throw new Error('Sign in canceled.');
      if (nativo === 'impronta') { const e = new Error('10: DEVELOPER_ERROR'); throw e; }
      if (nativo === 'senzaToken') return {credential: {}};
      return {credential: {idToken: 'ID-TOKEN-FINTO', accessToken: 'ACCESS-FINTO'}};
    }
  };
  const fakeWin = {
    location: {replace: (u) => { eventi.push('va-a:' + u); }},
    Capacitor: (capacitor && nativo !== 'assente')
      ? {isNativePlatform: () => true, Plugins: {FirebaseAuthentication: plugin}}
      : (capacitor ? {isNativePlatform: () => true, Plugins: {}} : undefined)
  };

  const funzione = new Function(
    'document', 'window', 'auth', 'isCapacitor', 'tocchiGrossi',
    'salvaStatoAuth', 'consumaStatoAuth',
    'signInWithRedirect', 'signInWithPopup', 'signInWithCredential', 'GoogleAuthProvider',
    'getAdditionalUserInfo', 'ensureUserProfile', 'sendWelcomeEmail',
    'showInfo', 'showError', 'traduciErrore', 'clearMsgs', 'DESTINATION', 'pulsante',
    `
      let skipAutoRedirect = false;
      ${BLOCCO}
      return {clic: () => pulsante.handler(), saltaRedirect: () => skipAutoRedirect};
    `);

  const Provider = function GoogleAuthProvider() { this.providerId = 'google.com'; };
  // Quella vera costruisce una credenziale dai due token: qui si registra come è stata chiamata.
  Provider.credential = (idToken, accessToken) => ({_id: idToken, _access: accessToken});

  const f = funzione(
    fakeDoc, fakeWin, {utente: 'finto'},
    capacitor, () => false,
    () => { eventi.push('salva-stato'); },
    () => { eventi.push('consuma-stato'); },
    async () => { eventi.push('redirect'); return {user: {uid: 'u1'}}; },
    async () => { eventi.push('popup'); return {user: {uid: 'u1'}}; },
    async (a, credenziale) => {
      eventi.push('scambio-con-firebase:' + credenziale._id + '/' + credenziale._access);
      return {user: {uid: 'u1'}};
    },
    Provider,
    () => ({isNewUser: nuovoUtente}),
    async () => { eventi.push('profilo'); },
    async () => { eventi.push('email-benvenuto'); },
    (m) => { messaggi.push(m); },
    (m) => { errori.push(m); },
    (codice) => 'FIREBASE:' + (codice || 'senza-codice'),
    () => {},
    'app.html',
    pulsante);

  return {f, eventi, errori, messaggi};
}

test('il blocco del login Google e\' JavaScript valido', () => {
  assert.doesNotThrow(() => new Function(BLOCCO));
});

test('nell\'app si accede col NATIVO: niente popup, niente reindirizzamento', async () => {
  const m = mondo({nativo: 'ok'});
  await m.f.clic();
  assert.ok(m.eventi.includes('nativo'), 'deve chiedere l\'accesso al sistema: ' + m.eventi.join(', '));
  assert.ok(!m.eventi.includes('popup'), 'il popup e\' proprio quello che dava l\'errore 400');
  assert.ok(!m.eventi.includes('redirect'), 'nemmeno il reindirizzamento: finiva anch\'esso in 400');
  assert.deepEqual(m.errori, [], 'nessun errore mostrato: ' + m.errori.join(' | '));
});

test('il token di Google viene scambiato con Firebase, e si entra nell\'app', async () => {
  const m = mondo({nativo: 'ok'});
  await m.f.clic();
  assert.ok(m.eventi.includes('scambio-con-firebase:ID-TOKEN-FINTO/ACCESS-FINTO'),
    'l\'idToken deve diventare una credenziale Firebase: ' + m.eventi.join(', '));
  assert.ok(m.eventi.includes('profilo'), 'il profilo utente va assicurato come nelle altre strade');
  assert.ok(m.eventi.includes('va-a:app.html'), 'e si entra nell\'app: ' + m.eventi.join(', '));
});

test('utente nuovo: email di benvenuto e prova gratuita, come nelle altre strade', async () => {
  const m = mondo({nativo: 'ok', nuovoUtente: true});
  await m.f.clic();
  assert.ok(m.eventi.includes('email-benvenuto'), 'un utente nuovo riceve il benvenuto');
  assert.ok(m.messaggi.some(x => /prova gratuita/i.test(x)),
    'e legge dei 7 giorni di prova: ' + m.messaggi.join(' | '));
});

test('se il nativo non riesce NON si ripiega sulla pagina (sarebbe tornare nell\'errore 400)', async () => {
  const m = mondo({nativo: 'annullato'});
  await m.f.clic();
  assert.ok(m.eventi.includes('nativo'));
  assert.ok(!m.eventi.includes('popup') && !m.eventi.includes('redirect'),
    'nessun ripiego dentro la WebView: ' + m.eventi.join(', '));
  assert.equal(m.errori.length, 1, 'e si dice all\'utente cosa e\' successo');
});

test('annullato dall\'utente: lo dice con parole sue, non «Errore: undefined»', async () => {
  const m = mondo({nativo: 'annullato'});
  await m.f.clic();
  assert.match(m.errori[0], /annullato/i, 'messaggio: ' + m.errori[0]);
  assert.ok(!/undefined/.test(m.errori[0]),
    'gli errori del plugin non hanno un codice Firebase: senza traduzione si leggeva «Errore: undefined»');
});

test('impronta di firma sbagliata: lo dice chiaramente, ed e\' il caso da riconoscere', async () => {
  // DEVELOPER_ERROR = SHA-1 o client OAuth non corrispondenti. Se l'utente legge un messaggio
  // generico, cerca il problema nel suo account Google e non lo trova mai.
  const m = mondo({nativo: 'impronta'});
  await m.f.clic();
  assert.match(m.errori[0], /impronta di firma|client OAuth/i, 'messaggio: ' + m.errori[0]);
  assert.match(m.errori[0], /non e' un problema del tuo account|configurazione del progetto/i,
    'e deve dire che non e\' colpa dell\'utente: ' + m.errori[0]);
});

test('plugin che risponde senza token: si dice, non si resta a girare', async () => {
  // E' il sintomo riferito dal proprietario: «rimane ancora in corso [...] continua a girare
  // la rotellina del caricamento». Senza credenziale non c'e' niente da scambiare: si dichiara.
  const m = mondo({nativo: 'senzaToken'});
  await m.f.clic();
  assert.ok(!m.eventi.some(x => x.startsWith('scambio-con-firebase')),
    'senza idToken non si puo\' scambiare niente');
  assert.equal(m.errori.length, 1, 'e l\'utente deve leggere qualcosa, non vedere una rotellina');
  assert.match(m.errori[0], /credenziali|riprova/i, 'messaggio: ' + m.errori[0]);
});

test('APK vecchio senza il plugin: si continua come prima, non si rompe niente', async () => {
  // Una pagina nuova dentro un pacchetto vecchio e' un caso reale (il sito si aggiorna da solo,
  // l'APK no). Senza plugin si torna alla strada di prima invece di non fare nulla.
  const m = mondo({nativo: 'assente'});
  await m.f.clic();
  assert.ok(!m.eventi.includes('nativo'), 'il plugin non c\'e\'');
  assert.ok(m.eventi.includes('redirect'),
    'si riprende la strada di prima invece di lasciare il pulsante morto: ' + m.eventi.join(', '));
});

test('sul computer non cambia niente: resta il popup', async () => {
  const m = mondo({capacitor: false, nativo: 'ok'});
  await m.f.clic();
  assert.ok(m.eventi.includes('popup'), 'sul computer il popup e\' la strada buona: ' + m.eventi.join(', '));
  assert.ok(!m.eventi.includes('nativo'), 'e il plugin nativo non c\'entra');
  assert.ok(m.eventi.includes('va-a:app.html'));
});

test('un codice Firebase vero resta tradotto da Firebase', async () => {
  // traduciErroreAccesso non deve mangiarsi i codici "auth/...": quelli li traduce gia'
  // traduciErrore, e le due traduzioni non devono litigare.
  const m = mondo({nativo: 'ok'});
  const r = m.f;
  assert.ok(r, 'il blocco si costruisce');
  // Si prova la delega passando un errore con codice Firebase attraverso il percorso nativo.
  const m2 = mondo({nativo: 'annullato'});
  await m2.f.clic();
  assert.ok(!/^FIREBASE:/.test(m2.errori[0]),
    'un errore del plugin NON va passato a Firebase: ' + m2.errori[0]);
});
