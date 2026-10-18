// L'APK DEVE FARE IL GIRO DI GOOGLE DENTRO LA STESSA APP — E IL SITO DEVE APRIRSI FUORI.
//
// Misurato il 18 ottobre 2026 sul sorgente nativo (node_modules/@capacitor/android,
// Bridge.launchIntent): senza "server.allowNavigation" Capacitor butta nel BROWSER
// ESTERNO ogni navigazione verso un host che non sia l'app. "Accedi con Google" partiva
// quindi per firebaseapp.com dentro Chrome, il login veniva completato lì, e al ritorno
// Chrome cercava https://localhost — l'indirizzo che dentro la WebView esiste e fuori no:
// "Connessione negata da localhost / ERR_CONNECTION_REFUSED". Il login non tornava mai
// indietro e l'utente restava fermo (era il suo secondo errore; il primo,
// "missing initial state", e' il complementare: vedi login_stato_google.test.mjs).
//
// Al tempo stesso pietro-santini.github.io NON deve stare in quella lista: il collegamento
// in alto a sinistra dell'app deve aprirsi nel browser esterno, non dentro l'applicazione
// (richiesta del proprietario: "non deve caricarla all'interno dell'applicazione").
//
// Il test legge la configurazione che produce quel comportamento nativo. Salta, in modo
// visibile, dove il progetto Capacitor non c'e' (GitHub non ce l'ha: l'APK si costruisce
// a mano); FBL_APK_DIR puo' puntare a una copia del progetto in un altro posto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DIR_APK = process.env.FBL_APK_DIR ||
  'C:\\Users\\pietro\\Desktop\\trading\\forex-backtest-mobile';
const CONFIG = path.join(DIR_APK, 'capacitor.config.json');
const ESISTE = fs.existsSync(CONFIG);
const SALTO = "progetto APK non presente su questa macchina (l'APK si costruisce a mano)";

// Le voci di allowNavigation sono ospiti, con l'eventuale "inizio." davanti: "*.google.com"
// copre accounts.google.com, "esempio.com" vale solo quell'ospite.
function copre(voci, ospite){
  return voci.some(v => {
    if (v.startsWith('*.')) return ospite.endsWith(v.slice(1));
    return ospite === v;
  });
}

test('capacitor.config.json: il flusso Google resta dentro la WebView dell\'app',
  {skip: ESISTE ? false : SALTO}, () => {
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const voci = cfg && cfg.server && cfg.server.allowNavigation;
  assert.ok(Array.isArray(voci),
    "manca server.allowNavigation: Capacitor apre ogni pagina di Google nel browser esterno, "
    + "che al ritorno finisce su https://localhost e da' \"Connessione negata da localhost\"");
  assert.ok(copre(voci, 'forex-backtest-lab.firebaseapp.com'),
    "firebaseapp.com (il passaggio intermedio di Google) non e' nella lista: "
    + "il giro del login esce dall'app e non torna piu' indietro");
  assert.ok(copre(voci, 'accounts.google.com'),
    "accounts.google.com non e' nella lista: la scelta dell'account aprirebbe il browser esterno");
});

test('capacitor.config.json: il sito resta FUORI dall\'app (collegamento in alto a sinistra esterno)',
  {skip: ESISTE ? false : SALTO}, () => {
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const voci = (cfg && cfg.server && cfg.server.allowNavigation) || [];
  assert.ok(!copre(voci, 'pietro-santini.github.io'),
    "il sito e' stato messo in allowNavigation: dentro l'APK il collegamento in alto a sinistra "
    + "caricherebbe la landing dentro l'applicazione, che e' esattamente quello che il "
    + "proprietario non vuole");
});
