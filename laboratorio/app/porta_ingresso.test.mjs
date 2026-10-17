// LA PORTA D'INGRESSO DELLA LANDING — il comportamento dei pulsanti che portano all'app.
//
// Richiesta del proprietario (17 ottobre 2026): «i pulsanti della landing devono portare
// all'installazione dell'APK, ovvio oggi non esiste ancora e' da implementare; in poche parole un
// pulsante, esempio il pulsante prova gratuita di 7 giorni, dove se l'utente e' nuovo lo porta alla
// installazione dell'applicazione, altrimenti se ha gia' installato l'applicazione lo riporta dentro
// l'app, collegamento diretto».
//
// Questi test NON cercano una stringa nel sorgente: prendono il blocco <script> che sta DENTRO
// index.html (quindi provano il testo che e' davvero pubblicato), lo eseguono in un ambiente che
// assomiglia al browser, e guardano cosa fa — quale indirizzo prepara, se compare il riquadro di
// installazione, e se non compare quando il passaggio dentro l'app e' riuscito davvero.
//
// La distinzione "app installata / non installata" non si puo' leggere da una pagina web: si prova
// a passare dentro, si aspetta, e si guarda un solo fatto verificabile — la finestra ha perso il
// fuoco. Il riquadro di installazione arriva solo quando quel fatto manca.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {RADICE} from './aiuti.mjs';

const INDEX = path.join(RADICE, 'index.html');

// Estrae la porta da index.html: dal commento-marca fino alla sua </script>.
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

// Ambiente minimo con la sola cosa che conta: `fuoco` dice se il sistema ha preso in mano la
// chiamata (la finestra perde il fuoco, l'app si e' aperta). Le attese scattano subito, in ordine.
function ambiente({userAgent, fuoco=false}){
  const box = {testo: '', azioni: []};
  const attese = [];
  const finestra = {
    __fblFuocoPerduto: false,
    addEventListener: (nome, f) => { if (nome === 'blur' && fuoco) f(); },
    location: {href: ''},
  };
  const nodo = (sel) => sel.endsWith('-t')
    ? {set textContent(v){ box.testo = v; }, get textContent(){ return box.testo; }}
    : {appendChild: (a) => box.azioni.push({testo: a.textContent, href: a.href})};
  const documento = {
    body: {appendChild(){}},
    createElement: () => ({
      style: {}, setAttribute(){}, addEventListener(){}, appendChild(){}, remove(){},
      parentNode: null, set innerHTML(v){}, get innerHTML(){ return ''; },
      querySelector: (sel) => nodo(sel),
    }),
    getElementById: () => ({querySelector: (sel) => nodo(sel), remove(){}}),
  };
  const esegui = new Function('window', 'document', 'navigator', 'setTimeout',
    PORTA + '; return window.FBL;');
  const FBL = esegui(finestra, documento, {userAgent}, (f) => { attese.push(f); return attese.length; });
  return {FBL, finestra, box, scatta: () => { while (attese.length) attese.shift()(); }};
}

test("la porta pubblicata e' JavaScript valido", () => {
  assert.doesNotThrow(() => new Function(PORTA));
  assert.match(PORTA, /function apriApp/, "manca la funzione apriApp");
});

test("Android: prepara l'intento verso il pacchetto giusto, col ritiro sull'APK", () => {
  const a = ambiente({userAgent: ANDROID});
  const r = a.FBL.apriApp('avvia', 'login.html');
  assert.equal(r.scelta, 'intent-android');
  const u = a.finestra.location.href;
  assert.match(u, /^intent:\/\/avvia#Intent;/, 'non e\' un intent');
  assert.match(u, /scheme=forexbacktestlab/, 'manca lo scheme');
  assert.match(u, /package=com\.pietrosantini\.forexbacktestlab/, 'manca il pacchetto dell\'app');
  assert.match(u, /S\.browser_fallback_url=/, 'manca il ritiro sull\'APK: un telefono senza app resterebbe bloccato');
  assert.match(decodeURIComponent(u), /releases\/latest\/download\/[^&]+\.apk/, 'il ritiro non punta a un APK');
});

test('Android senza app: dopo l\'attesa arriva il riquadro con il download', () => {
  const a = ambiente({userAgent: ANDROID});
  a.FBL.apriApp('avvia', 'login.html');
  a.scatta();
  assert.ok(a.box.azioni.length > 0, 'nessun riquadro: l\'utente nuovo resterebbe fermo');
  assert.ok(a.box.azioni.some(x => /apk/i.test(x.testo)), 'manca il pulsante per scaricare l\'APK');
});

test('Android con app aperta: il riquadro non copre la finestra', () => {
  const a = ambiente({userAgent: ANDROID, fuoco: true});
  a.FBL.apriApp('avvia', 'login.html');
  a.scatta();
  assert.deepEqual(a.box.azioni, [], 'l\'app si era aperta e il riquadro l\'ha coperta');
});

test("Windows senza app: dopo l'attesa offre l'installer E il collegamento diretto", () => {
  const a = ambiente({userAgent: WINDOWS});
  const r = a.FBL.apriApp('avvia', 'login.html');
  assert.equal(r.scelta, 'schema-desktop');
  a.scatta();
  assert.ok(a.box.azioni.some(x => /installer/i.test(x.testo)), 'manca il download dell\'installer');
  assert.ok(a.box.azioni.some(x => x.href === 'forexbacktestlab://avvia'),
    'manca il collegamento diretto: chi ha gia\' l\'app deve poterci entrare con un tocco');
});

test('Windows con app aperta: nessun riquadro', () => {
  const a = ambiente({userAgent: WINDOWS, fuoco: true});
  a.FBL.apriApp('avvia');
  a.scatta();
  assert.deepEqual(a.box.azioni, []);
});

test("iPhone: nessun download inventato, si spiega che si usa dal browser", () => {
  const a = ambiente({userAgent: IPHONE});
  const r = a.FBL.apriApp('avvia', 'login.html');
  assert.equal(r.scelta, 'installazione');
  assert.ok(a.box.testo.length > 0, 'nessuna spiegazione');
  assert.ok(!a.box.azioni.some(x => /apk|installer/i.test(x.testo)),
    'propone un download che per iPhone non esiste');
});

test("chi non installa arriva dove voleva andare (non alla home)", () => {
  const a = ambiente({userAgent: WINDOWS});
  a.FBL.apriApp('avvia', 'login.html');
  a.scatta();
  const continua = a.box.azioni.find(x => x.testo === 'Continua col sito web');
  assert.ok(continua, 'manca il modo di proseguire senza installare');
  assert.equal(continua.href, 'login.html', 'il proseguimento porta altrove');
});
