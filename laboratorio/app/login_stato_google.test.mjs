// IL LOGIN CON GOOGLE SU TELEFONO E TABLET NON DEVE PERDERE LO STATO.
//
// Segnalato dal proprietario (18 ottobre 2026): «sul telefono e sul tablet il login con
// Google non viene eseguito» — Firebase risponde "Unable to process request due to missing
// initial state..." e l'utente resta fermo davanti alla pagina di accesso.
//
// Causa misurata nel sorgente: Firebase conserva lo stato del reindirizzamento in
// sessionStorage, che vive SOLO in memoria del processo. Dentro la WebView dell'APK la scelta
// dell'account Google tiene l'app in secondo piano per qualche secondo e Android puo' uccidere
// il processo: al ritorno sessionStorage e' vuoto e il login muore. L'archivio di ripiego in
// localStorage sopravvive invece alla morte del processo, quindi prima di partire si copia
// tutto li', e al ritorno si rimette ogni chiave mancante al suo posto PRIMA di parlare con
// Firebase.
//
// Questo test NON cerca una stringa nel sorgente: estrae il blocco di funzioni marcato dentro
// login.html (quindi prova il codice che e' davvero pubblicato), lo esegue con dei magazzini
// finti e SIMULA la morte del processo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {RADICE} from './aiuti.mjs';

const LOGIN = path.join(RADICE, 'login.html');

function leggiBlocco(){
  const html = fs.readFileSync(LOGIN, 'utf8');
  const inizio = html.indexOf('STATO LOGIN GOOGLE: INIZIO');
  assert.ok(inizio >= 0, "in login.html manca il blocco marcato STATO LOGIN GOOGLE: INIZIO");
  // Si prende l'intero commento di apertura (senza il "/*" il taglio non e' JavaScript):
  const s = html.lastIndexOf('/*', inizio);
  assert.ok(s >= 0 && inizio - s < 60, "il marcatore di apertura non sta dentro un commento /* ... */");
  const fine = html.indexOf('STATO LOGIN GOOGLE: FINE', inizio);
  assert.ok(fine > inizio, "in login.html manca il marcatore STATO LOGIN GOOGLE: FINE");
  const e = html.indexOf('*/', fine);
  assert.ok(e > fine, "il marcatore di chiusura non sta dentro un commento");
  return html.slice(s, e + 2);
}
const BLOCCO = leggiBlocco();

// Un magazzino finti, stesso comportamento del vero sessionStorage/localStorage.
function memoria(){
  const m = new Map();
  return {
    get length(){ return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

// Esegue il blocco estratto e ritorna le sue funzioni.
function funzioni({session, local}){
  const f = new Function('sessionStorage', 'localStorage', 'Date',
    BLOCCO + '\nreturn {salvaStatoAuth, ripristinaStatoAuth, consumaStatoAuth, destinazioneLogin};');
  return f(session, local, Date);
}

test("il blocco del login Google e' JavaScript valido", () => {
  assert.doesNotThrow(() => new Function(BLOCCO));
});

test("morte del processo durante la scelta dell'account: al ritorno lo stato e' intero", () => {
  const session1 = memoria();
  const local1 = memoria();
  // Firebase ha appena scritto il suo stato prima di partire per Google.
  session1.setItem('firebase:authRequest:CHIAVE', '{"id":"gira-tanto"}');
  session1.setItem('altro', 'valore');
  const f1 = funzioni({session: session1, local: local1});
  f1.salvaStatoAuth();

  // IL PROCESSO MUORE: la memoria di sessione sparisce per intero, localStorage resta.
  const session2 = memoria();
  const f2 = funzioni({session: session2, local: local1});
  const pendente = f2.ripristinaStatoAuth();

  assert.equal(pendente, true,
    "senza il ritorno del stato Firebase non puo' completare il login (missing initial state)");
  assert.equal(session2.getItem('firebase:authRequest:CHIAVE'), '{"id":"gira-tanto"}',
    "lo stato di Firebase non e' tornato al suo posto");
  assert.equal(session2.getItem('altro'), 'valore',
    "le altre chiavi di sessione non sono tornate");
});

test("bandierina scritta solo in localStorage: sopravvive alla morte del processo", () => {
  const session1 = memoria();
  const local1 = memoria();
  const f1 = funzioni({session: session1, local: local1});
  f1.salvaStatoAuth();

  const session2 = memoria();
  const f2 = funzioni({session: session2, local: local1});
  assert.equal(f2.ripristinaStatoAuth(), true,
    "la bandierina stava in sessionStorage e con il processo morto non si vede piu'");
});

test("nessun login in corso: il ripristino non tocca niente", () => {
  const session = memoria();
  const f = funzioni({session, local: memoria()});
  session.setItem('sessione', 'non-toccare');
  assert.equal(f.ripristinaStatoAuth(), false, "segna un login in corso dove non c'e'");
  assert.equal(session.getItem('sessione'), 'non-toccare');
  assert.equal(session.length, 1, "aggiunge chiavi a un magazzino che doveva restare com'e'");
});

test("lo stato sopravvissuto non viene sovrascritto da quello del backup", () => {
  const session1 = memoria();
  const local1 = memoria();
  session1.setItem('chiave', 'vecchio');
  session1.setItem('sparito', 'salvato');
  const f1 = funzioni({session: session1, local: local1});
  f1.salvaStatoAuth();

  // Solo una chiave e' sopravvissuta alla morte del processo, con un valore gia' aggiornato.
  const session2 = memoria();
  session2.setItem('chiave', 'aggiornato');
  const f2 = funzioni({session: session2, local: local1});
  f2.ripristinaStatoAuth();
  assert.equal(session2.getItem('chiave'), 'aggiornato',
    "il backup vecchio sovrascrive uno stato sopravvissuto: si perdono i dati piu' recenti");
  assert.equal(session2.getItem('sparito'), 'salvato', "la chiave sparita non e' tornata");
});

test("dopo il completamento il backup si consuma: nessun falso ripristino ai visiti successivi", () => {
  const session1 = memoria();
  const local1 = memoria();
  const f1 = funzioni({session: session1, local: local1});
  f1.salvaStatoAuth();
  const session2 = memoria();
  const f2 = funzioni({session: session2, local: local1});
  assert.equal(f2.ripristinaStatoAuth(), true);
  f2.consumaStatoAuth();
  const f3 = funzioni({session: memoria(), local: local1});
  assert.equal(f3.ripristinaStatoAuth(), false,
    "la bandierina non consumata fingerebbe un login in corso a ogni visita");
});

test("una bandierina troppo vecchia non blocca l'accesso: si butta via", () => {
  const local1 = memoria();
  const f1 = funzioni({session: memoria(), local: local1});
  // Valore scritto un'ora e un minuto fa: oltre la finestra (un'ora, perche' l'approvazione
  // in due passaggi su un altro dispositivo puo' durare anche una ventina di minuti).
  local1.setItem('fblRedirectPending', String(Date.now() - 61 * 60 * 1000));
  local1.setItem('fblAuthBackup', '{}');
  const f2 = funzioni({session: memoria(), local: local1});
  assert.equal(f2.ripristinaStatoAuth(), false,
    "una bandierina antica resta li' e sopprime l'accesso automatico di chi e' gia' loggato");
  assert.equal(local1.getItem('fblRedirectPending'), null,
    "la bandierina scaduta deve essere rimossa, non solo ignorata");
});

test("una bandierina di venti minuti e' ancora valida: l'approvazione in due passaggi puo' durare", () => {
  const local1 = memoria();
  const f1 = funzioni({session: memoria(), local: local1});
  // L'utente e' sul suo telefono ad approvare l'accesso: il giro dura, e la bandierina
  // non deve scadere sotto gli occhi (misurato il 20 ottobre 2026: con dieci minuti scadeva
  // mentre l'utente era ancora al lavoro, e il giro ripartiva da capo).
  local1.setItem('fblRedirectPending', String(Date.now() - 20 * 60 * 1000));
  local1.setItem('fblAuthBackup', '{}');
  const f2 = funzioni({session: memoria(), local: local1});
  assert.equal(f2.ripristinaStatoAuth(), true,
    "dopo venti minuti il giro e' ancora in corso: la bandierina deve valere");
});

test("bandierina '1' della vecchia versione (priva di data) viene trattata come scaduta", () => {
  const local1 = memoria();
  local1.setItem('fblRedirectPending', '1');
  const f = funzioni({session: memoria(), local: local1});
  assert.equal(f.ripristinaStatoAuth(), false, "il valore '1' equivale al 1970: non e' un login in corso");
});

test("localStorage non disponibile (modalita' privata): la partita per Google parte lo stesso", () => {
  const session = memoria();
  const niente = {
    getItem(){ throw new Error('negato'); },
    setItem(){ throw new Error('negato'); },
    removeItem(){ throw new Error('negato'); },
    get length(){ return 0; },
    key(){ return null; },
  };
  const f = funzioni({session, local: niente});
  assert.doesNotThrow(() => f.salvaStatoAuth(),
    "con il localStorage bloccato il pulsante Google non deve nemmeno provare a partire");
  assert.equal(f.ripristinaStatoAuth(), false);
  assert.doesNotThrow(() => f.consumaStatoAuth());
});

test("dopo il login: dentro l'APP si va in app.html, sul SITO si torna alla porta", () => {
  const f = funzioni({session: memoria(), local: memoria()});
  assert.equal(f.destinazioneLogin(true), 'app.html',
    "dentro l'APK il login deve finire nel programma, non nella landing");
  assert.equal(f.destinazioneLogin(false), 'index.html?dopo=login',
    "sul sito il login deve tornare alla porta d'ingresso, che apre l'app o offre l'installazione");
});
