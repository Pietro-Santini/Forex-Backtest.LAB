// LA PORTA SI APRE DA SOLA DOPO IL LOGIN FATTO SUL SITO.
//
// Richiesta del proprietario (18 ottobre 2026): sul sito, fatta l'identita' con Google o
// email, «deve apparire l'offerta di installazione dell'APK se non e' installata, altrimenti
// l'apertura diretta dell'applicazione». Finora login.html finiva su app.html (il simulatore
// nel browser) e su telefono o tablet il simulatore non serve: l'utente resta li' senza
// nemmeno sapere che l'app esiste.
//
// Correzione: login.html, dal sito, dopo il login torna su index.html?dopo=login e la porta
// d'ingresso (la stessa dei pulsanti della landing) si apre da sola — prima prova a passare
// dentro l'app, se non ci riesce offre l'installazione, con sempre l'uscita "Continua col
// sito web" verso app.html. La query si pulisce subito: un aggiornamento della pagina non
// deve riaprire la porta un'altra volta.
//
// Questi test NON cercano una stringa nel sorgente: estraggono la porta da index.html, la
// eseguono in un ambiente fintamente browser con ?dopo=login nell'indirizzo e guardano cosa
// fa — o, senza il parametro, che NON faccia niente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {RADICE} from './aiuti.mjs';

const INDEX = path.join(RADICE, 'index.html');

function leggiPorta(){
  const html = fs.readFileSync(INDEX, 'utf8');
  const inizio = html.search(/<!--\s*PORTA D'INGRESSO/);
  assert.ok(inizio >= 0, "in index.html manca il blocco della porta d'ingresso");
  const s = html.indexOf('<script>', inizio);
  assert.ok(s >= 0, "la porta d'ingresso non e' dentro un blocco <script>");
  const e = html.indexOf('</script>', s);
  assert.ok(e > s, "la porta d'ingresso non si chiude");
  return html.slice(s + '<script>'.length, e);
}
const PORTA = leggiPorta();

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const IPHONE  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// Ambiente come in porta_ingresso.test.mjs, con in piu' l'indirizzo della pagina (search,
// pathname, hash), history.replaceState e document.readyState: sono le tre cose con cui la
// porta decide se si e' appena arrivati dal login.
function ambiente({userAgent, search = '', readyState = 'complete', fuoco = false}){
  const box = {testo: '', azioni: []};
  const attese = [];
  const ascoltatori = [];
  const storicato = [];
  const finestra = {
    __fblFuocoPerduto: false,
    addEventListener: (nome, f) => { if (nome === 'blur' && fuoco) f(); },
    location: {href: '', search, pathname: '/Forex-Backtest.LAB/', hash: ''},
    history: {replaceState: (_s, _t, u) => storicato.push(u)},
  };
  const nodo = (sel) => sel.endsWith('-t')
    ? {set textContent(v){ box.testo = v; }, get textContent(){ return box.testo; }}
    : {appendChild: (a) => box.azioni.push({testo: a.textContent, href: a.href})};
  const documento = {
    readyState,
    body: {appendChild(){}},
    createElement: () => ({
      style: {}, setAttribute(){}, addEventListener(){}, appendChild(){}, remove(){},
      parentNode: null, set innerHTML(v){}, get innerHTML(){ return ''; },
      querySelector: (sel) => nodo(sel),
    }),
    getElementById: () => ({querySelector: (sel) => nodo(sel), remove(){}}),
    addEventListener: (nome, f) => { if (nome === 'DOMContentLoaded') ascoltatori.push(f); },
  };
  const esegui = new Function('window', 'document', 'navigator', 'setTimeout',
    PORTA + '; return window.FBL;');
  const FBL = esegui(finestra, documento, {userAgent}, (f) => { attese.push(f); return attese.length; });
  return {
    FBL, finestra, box, storicato,
    paginaParsa: () => { documento.readyState = 'complete'; ascoltatori.splice(0).forEach(f => f()); },
    scatta: () => { while (attese.length) attese.shift()(); },
  };
}

test("la porta pubblicata e' JavaScript valido", () => {
  assert.doesNotThrow(() => new Function(PORTA));
});

test("Android: il login sul sito porta subito all'intento verso l'app", () => {
  const a = ambiente({userAgent: ANDROID, search: '?dopo=login'});
  assert.match(a.finestra.location.href, /^intent:\/\/avvia#Intent;/,
    "con ?dopo=login la porta non si e' aperta: l'utente appena loggato resta sulla landing");
  assert.match(decodeURIComponent(a.finestra.location.href), /releases\/latest\/download\/[^&]+\.apk/,
    "senza app installata l'intento non cade sull'APK: l'utente resta a bocca aperta");
});

test("dopo il login la query sparisce: un aggiornamento della pagina non riapre la porta", () => {
  const a = ambiente({userAgent: ANDROID, search: '?dopo=login'});
  assert.ok(a.storicato.length > 0, "l'indirizzo con ?dopo=login resta nella barra");
  assert.ok(!a.storicato[0].includes('dopo=login'),
    "replaceState deve togliere il parametro, altrimenti F5 riaprirebbe la porta all'infinito");
});

test("Android senza app: dopo l'attesa arriva il riquadro, e l'uscita porta al simulatore web", () => {
  const a = ambiente({userAgent: ANDROID, search: '?dopo=login'});
  a.scatta();
  assert.ok(a.box.azioni.length > 0, "nessun riquadro: chi non installa non sa piu' dove andare");
  const continua = a.box.azioni.find(x => x.testo === 'Continua col sito web');
  assert.ok(continua, "manca il modo di proseguire senza installare");
  assert.equal(continua.href, 'app.html',
    "chi rifiuta l'installazione dopo il login deve finire nel simulatore web, non alla home");
});

test("Windows: dopo il login si prova il collegamento diretto, poi l'installer", () => {
  const a = ambiente({userAgent: WINDOWS, search: '?dopo=login'});
  a.scatta();
  assert.ok(a.box.azioni.some(x => /installer/i.test(x.testo)), "manca il download dell'installer");
  assert.ok(a.box.azioni.some(x => x.href === 'forexbacktestlab://avvia'),
    "manca il collegamento diretto per chi ha gia' l'app desktop");
});

test("iPhone: dopo il login si spiega, senza download inventati", () => {
  const a = ambiente({userAgent: IPHONE, search: '?dopo=login'});
  assert.ok(a.box.testo.length > 0, "porta mai aperta: il login finisce e non succede niente");
  assert.ok(!a.box.azioni.some(x => /apk|installer/i.test(x.testo)),
    "propone un download che per iPhone non esiste");
});

test("nella pagina vera la porta aspetta che il documento sia pronto, poi scatta", () => {
  // E' il percorso reale: il codice della porta gira dentro <head>, quando il body
  // non esiste ancora e appendChild crollerebbe. L'attivazione deve arrivare con
  // DOMContentLoaded, non subito.
  const a = ambiente({userAgent: ANDROID, search: '?dopo=login', readyState: 'loading'});
  assert.equal(a.finestra.location.href, '',
    "si e' attivata durante il parsing: con il body non ancora lì il riquadro crollerebbe");
  a.paginaParsa();
  assert.match(a.finestra.location.href, /^intent:\/\/avvia#Intent;/,
    "passata la lettura del documento la porta non si e' aperta: il login non porta da nessuna parte");
});

test("l'app aperta (finestra persa) copre tutto: nessun riquadro sopra l'app", () => {
  const a = ambiente({userAgent: ANDROID, search: '?dopo=login', fuoco: true});
  a.scatta();
  assert.deepEqual(a.box.azioni, [],
    "l'app si era aperta e il riquadro d'installazione l'ha coperta");
});

test("senza ?dopo=login la porta resta chiusa: la landing non apre intenti a caso", () => {
  for (const userAgent of [ANDROID, WINDOWS, IPHONE]) {
    const a = ambiente({userAgent, search: ''});
    assert.equal(a.finestra.location.href, '',
      "la porta si e' aperta da sola senza che nessuno l'abbia chiamata (" + userAgent.slice(0, 10) + ")");
    assert.deepEqual(a.box.azioni, []);
  }
});

test("parametri altrui non aprono la porta (solo dopo=login)", () => {
  const a = ambiente({userAgent: ANDROID, search: '?altro=1&x=dopo=login'});
  assert.equal(a.finestra.location.href, '',
    "un parametro che CONTIENE la parola dopo=login ha aperto la porta per caso");
});
