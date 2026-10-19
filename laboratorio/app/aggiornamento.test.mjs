// AGGIORNAMENTO AUTOMATICO: all'arrivo di una versione nuova l'app MOSTRA «Disponibile una
// nuova versione» e, quando l'utente preme «Aggiorna», riparte da sola sulla versione nuova.
//
// Richiesto dal proprietario (18 ottobre 2026): «al commit su GitHub l'app mostra
// "Disponibile una nuova versione"; l'utente preme e l'aggiornamento parte da solo con
// riavvio automatico».
//
// Il giro completo, misurato pezzo per pezzo:
//   1. il browser confronta sw.js con quello installato SOLO quando una pagina si naviga o
//      quando lo si chiede con registration.update(): un'app che resta aperta per giorni non
//      naviga quasi mai, quindi senza i richiami periodici (ogni mezz'ora, tornando la scheda
//      in primo piano, tornando il fuoco sulla finestra) l'avviso NON sarebbe mai arrivato;
//   2. sw.js installa la versione nuova (CACHE_NAME diverso = file diversi), PULISCE LE
//      CACHE VECCHIE e solo DOPO manda «versione-nuova» a tutte le pagine aperte: il
//      messaggio dopo la pulizia garantisce che la ricarica prenda il file NUOVO, perché
//      caches.match cerca in tutte le cache, vecchie e nuove;
//   3. alla PRIMA installazione in assoluto non si dice niente: non c'è nulla di nuovo;
//   4. l'utente preme «Aggiorna» → location.reload() → la versione nuova è già tutta in
//      cache, quindi il riavvio da solo basta: niente barre di progresso inventate.
//
// Nessun test qui cerca una stringa nel sorgente: il service worker, il blocco PWA di
// app.html e quello di login.html si ESTRAGGONO dai loro marcatori /* ... */ e si eseguono
// con sostituti finti; gli ultimi due test aprono la pagina vera in Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {apriApp} from './aiuti.mjs';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SW = fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8');
const HTML = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
const LOGIN = fs.readFileSync(path.join(RADICE, 'login.html'), 'utf8');

// Estrazione coi marcatori /* MARCATORE: INIZIO ... MARCATORE: FINE */, stesso schema di
// SCALA UI e COLLEGAMENTO CLOUD: il blocco che si esegue è il codice vero del file.
function estrai(sorgente, marcatore, file) {
  const inizio = sorgente.indexOf(marcatore + ': INIZIO');
  assert.ok(inizio >= 0, `in ${file} manca il blocco marcato ${marcatore}: INIZIO`);
  const s = sorgente.lastIndexOf('/*', inizio);
  assert.ok(s >= 0 && inizio - s < 60, `il marcatore di apertura di ${marcatore} non sta dentro un commento /* ... */`);
  const fine = sorgente.indexOf(marcatore + ': FINE', inizio);
  assert.ok(fine > inizio, `in ${file} manca il marcatore ${marcatore}: FINE`);
  const e = sorgente.indexOf('*/', fine);
  assert.ok(e > fine, `il marcatore di chiusura di ${marcatore} non sta dentro un commento`);
  return sorgente.slice(s, e + 2);
}

// ===================== SERVICE WORKER: install e activate =====================
const BLOCCO_SW = estrai(SW, 'AGGIORNAMENTO SW', 'sw.js');

// Un mondo fintamente ServiceWorker: `aggiornamento:true` significa che sul dispositivo c'è
// già una versione installata (self.registration.active punta al worker vecchio), come
// succede davvero quando arriva un CACHE_NAME nuovo.
function mondoSw({aggiornamento = false} = {}) {
  const eventi = [];                       // cosa è successo, in che ordine: l'ordine conta
  const handlers = {};
  const clienti = [1, 2].map(n => ({postMessage: m => eventi.push(`msg${n}:${m.tipo}`)}));
  const self = {
    registration: {active: aggiornamento ? {} : null},
    skipWaiting: () => eventi.push('skipWaiting'),
    addEventListener: (nome, fn) => { handlers[nome] = fn; },
    clients: {
      claim: () => { eventi.push('claim'); return Promise.resolve(); },
      matchAll: (op) => {
        // Come il browser VERO poco dopo l'attivazione: le pagine aperte sono ancora
        // controllate dal worker VECCHIO, quindi il nuovo worker le vede SOLO se chiede
        // includeUncontrolled — senza quella opzione l'elenco sarebbe vuoto e l'avviso
        // non arriverebbe mai a nessuno (è la trappola che questo test tiene d'occhio).
        return Promise.resolve(op && op.includeUncontrolled ? clienti : []);
      },
    },
  };
  const caches = {
    open: async () => ({addAll: async (a) => { eventi.push('install:' + a.length); }}),
    keys: async () => ['forex-backtest-lab-v2.0.1', 'forex-backtest-lab-v2.0.0', 'altre-cose'],
    delete: async (k) => { eventi.push('delete:' + k); return true; },
  };
  return {self, handlers, caches, eventi,
          CACHE_NAME: 'forex-backtest-lab-v2.0.1', ASSETS: ['app.html', 'sw.js']};
}

function caricaSw(m) {
  new Function('self', 'caches', 'CACHE_NAME', 'ASSETS', BLOCCO_SW)(
    m.self, m.caches, m.CACHE_NAME, m.ASSETS);
}
async function attiva(m) {
  const attese = [];
  const evento = {waitUntil: p => attese.push(Promise.resolve(p))};
  m.handlers.install(evento);
  m.handlers.activate(evento);
  await Promise.all(attese);
}

test('alla PRIMA installazione non arriva nessun avviso: non c\'è nulla di nuovo', async () => {
  const m = mondoSw({aggiornamento: false});
  caricaSw(m);
  await attiva(m);
  assert.ok(!m.eventi.some(e => e.startsWith('msg')),
    'la prima apertura dell\'app non deve partire con «è arrivata una versione nuova»');
});

test('in un AGGIORNAMENTO tutte le pagine aperte dicono «versione-nuova», DOPO la pulizia', async () => {
  const m = mondoSw({aggiornamento: true});
  caricaSw(m);
  await attiva(m);
  const messaggi = m.eventi.filter(e => e.startsWith('msg'));
  assert.equal(messaggi.length, 2, 'tutte e due le pagine aperte devono sapere');
  assert.ok(messaggi.every(e => e.endsWith(':versione-nuova')), 'il messaggio è «versione-nuova»');
  const iDelete = m.eventi.findIndex(e => e === 'delete:forex-backtest-lab-v2.0.0');
  const iPrimoMsg = m.eventi.findIndex(e => e.startsWith('msg'));
  assert.ok(iDelete >= 0, 'le cache vecchie si cancellano all\'attivazione');
  assert.ok(iPrimoMsg > iDelete,
    'l\'avviso arriva DOPO la pulizia: la ricarica deve trovare solo il file nuovo in cache');
  assert.ok(m.eventi.includes('skipWaiting'), 'la versione nuova deve prendere il posto senza aspettare');
});

test('la pulizia cancella le cache vecchie e NON tocca quella della versione nuova', async () => {
  const m = mondoSw({aggiornamento: true});
  caricaSw(m);
  await attiva(m);
  assert.ok(!m.eventi.includes('delete:forex-backtest-lab-v2.0.1'),
    'cancellare la cache appena riempita significherebbe scaricare di nuovo 4 MB');
});

// ===================== app.html: registrazione, controlli, banner =====================
const BLOCCO_APP = estrai(HTML, 'PWA AGGIORNAMENTO', 'app.html');

function mondoApp() {
  const ascoltatori = {window: {}, document: {}, sw: {}};
  const registrazioni = [];                // cosa ha chiamato register
  let aggiornamenti = 0;                   // quante volte registration.update() è partito
  const intervalli = [];
  const fakeReg = {update: async () => { aggiornamenti++; }};
  const sw = {
    register: (url, opz) => { registrazioni.push([url, opz]); return {catch(){}}; },
    getRegistration: () => Promise.resolve(fakeReg),
    addEventListener: (n, f) => { (ascoltatori.sw[n] = ascoltatori.sw[n] || []).push(f); },
  };
  const perId = {};                        // elementi per id, come nel documento vero
  const bottoni = {};                      // pulsanti letti dall'innerHTML del banner
  const doc = {
    hidden: false,
    addEventListener: (n, f) => { (ascoltatori.document[n] = ascoltatori.document[n] || []).push(f); },
    getElementById: id => perId[id] || null,
    createElement: () => ({id: '', style: {}, innerHTML: '', remove() { this.rimosso = true; }}),
    body: {appendChild: el => {
      if (el.id) perId[el.id] = el;
      for (const m of String(el.innerHTML || '').matchAll(/id="([^"]+)"/g)) {
        bottoni[m[1]] = {clic: []};
        perId[m[1]] = {addEventListener: (n, f) => bottoni[m[1]].clic.push(f)};
      }
    }},
  };
  const win = {addEventListener: (n, f) => { (ascoltatori.window[n] = ascoltatori.window[n] || []).push(f); }};
  const location = {reload: () => { location.ricariche = (location.ricariche || 0) + 1; }};
  const intervallo = (fn, ms) => { intervalli.push({fn, ms}); return intervalli.length; };
  const orologio = {t: 1_000_000, now() { return this.t; }};
  const esegui = () => new Function('window', 'navigator', 'document', 'location', 'setInterval', 'Date',
    BLOCCO_APP)(win, {serviceWorker: sw}, doc, location, intervallo, orologio);
  return {ascoltatori, registrazioni, aggiornamenti: () => aggiornamenti, intervalli,
          perId, bottoni, doc, location, esegui, orologio};
}
const batte = () => new Promise(r => setImmediate(r));   // fa finire i microtask del .then

test('app.html registra il service worker senza lasciarlo invecchiare in cache', () => {
  const m = mondoApp();
  m.esegui();
  m.ascoltatori.window.load.forEach(f => f());
  assert.equal(m.registrazioni.length, 1, 'alla carica della pagina si registra il service worker');
  assert.equal(m.registrazioni[0][0], 'sw.js');
  assert.equal(m.registrazioni[0][1] && m.registrazioni[0][1].updateViaCache, 'none',
    'senza updateViaCache none il confronto di sw.js può arrivare da una cache CDN e non '
    + 'vedere MAI che esiste una versione nuova');
});

test('il controllo periodico chiede gli aggiornamenti: ogni mezz\'ora, tornando in primo piano, tornando il fuoco', async () => {
  const m = mondoApp();
  m.esegui();
  assert.equal(m.intervalli.length, 1,
    'manca il controllo periodico: un\'app aperta per giorni non naviga mai e il browser non '
    + 'controlla sw.js da solo');
  assert.equal(m.intervalli[0].ms, 30 * 60 * 1000, 'il giro di controllo è ogni mezz\'ora');
  m.intervalli[0].fn();                                  // scatta l'allarme
  await batte();
  assert.equal(m.aggiornamenti(), 1, 'l\'allarme deve chiedere registration.update()');
  m.doc.hidden = false;
  m.ascoltatori.document.visibilitychange.forEach(f => f());
  await batte();
  assert.equal(m.aggiornamenti(), 1, 'un controllo al minuto, non a ogni occhiata: niente spam di rete');
  m.orologio.t += 61000;
  m.ascoltatori.document.visibilitychange.forEach(f => f());
  await batte();
  assert.equal(m.aggiornamenti(), 2, 'appena passato il minuto, tornando in primo piano si ricontrolla');
  m.doc.hidden = true;
  m.orologio.t += 61000;
  m.ascoltatori.document.visibilitychange.forEach(f => f());
  await batte();
  assert.equal(m.aggiornamenti(), 2, 'con la scheda nascosta non si spreca rete');
  m.doc.hidden = false;
  m.orologio.t += 61000;
  m.ascoltatori.window.focus.forEach(f => f());
  await batte();
  assert.equal(m.aggiornamenti(), 3, 'tornando il fuoco sulla finestra si ricontrolla');
});

test('il messaggio del service worker mostra «Disponibile una nuova versione» con i pulsanti giusti', () => {
  const m = mondoApp();
  m.esegui();
  m.ascoltatori.sw.message.forEach(f => f({data: {tipo: 'versione-nuova'}}));
  const banner = m.perId['fblVersioneNuova'];
  assert.ok(banner, 'senza banner il proprietario non vede mai l\'avviso');
  assert.match(banner.innerHTML, /Disponibile una nuova versione/,
    'il testo deve essere quello richiesto dal proprietario');
  assert.ok(m.bottoni['fblVersioneRicarica'], 'manca il pulsante «Aggiorna»');
  assert.ok(m.bottoni['fblVersionePoi'], 'manca il pulsante «Più tardi»');
  // premo «Aggiorna»: la versione nuova è già installata in cache, il riavvio da solo basta
  m.bottoni['fblVersioneRicarica'].clic[0]();
  assert.equal(m.location.ricariche, 1, '«Aggiorna» deve far ripartire la pagina');
  // premo «Più tardi»: il banner se ne va e resta il resto
  m.bottoni['fblVersionePoi'].clic[0]();
  assert.ok(banner.rimosso, '«Più tardi» deve togliere il banner');
  // due messaggi di fila: un solo banner, un solo «Aggiorna» da premere
  m.ascoltatori.sw.message.forEach(f => f({data: {tipo: 'versione-nuova'}}));
  assert.equal(m.perId['fblVersioneNuova'], banner, 'il banner si fa una volta sola');
});

// ===================== login.html: stessa difesa di app.html =====================
const BLOCCO_LOGIN = estrai(LOGIN, 'LOGIN SW', 'login.html');

test('login.html registra il service worker con updateViaCache none, come app.html', () => {
  const chiamate = [];
  const fakeNav = {serviceWorker: {register: (url, opz) => { chiamate.push([url, opz]); return {catch(){}}; }}};
  new Function('navigator', BLOCCO_LOGIN)(fakeNav);
  assert.equal(chiamate.length, 1, 'login è la prima pagina per molti: è qui che l\'app deve risultare installabile');
  assert.equal(chiamate[0][0], 'sw.js');
  assert.equal(chiamate[0][1] && chiamate[0][1].updateViaCache, 'none',
    'anche da login.html sw.js deve essere sempre controllato sulla rete, mai preso da una cache');
});

// ===================== La pagina vera in Chromium =====================
test('nella pagina vera il banner dice «Disponibile una nuova versione» e «Più tardi» lo chiude', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(() => navigator.serviceWorker.dispatchEvent(
      new MessageEvent('message', {data: {tipo: 'versione-nuova'}})));
    await pagina.waitForSelector('#fblVersioneNuova', {timeout: 3000});
    const testo = await pagina.textContent('#fblVersioneNuova');
    assert.match(testo, /Disponibile una nuova versione/, 'il banner dice la parola richiesta');
    assert.match(testo, /Aggiorna/, 'manca il pulsante «Aggiorna»');
    await pagina.click('#fblVersionePoi');
    assert.equal(await pagina.$('#fblVersioneNuova'), null, '«Più tardi» deve togliere il banner');
    assert.deepEqual(errori, []);
  } finally {
    await browser.close();
  }
});

test('nella pagina vera, premere «Aggiorna» fa ripartire la pagina (riavvio automatico)', async () => {
  const {browser, pagina} = await apriApp();
  try {
    await pagina.evaluate(() => {
      window.__primaDellAggiornamento = true;
      navigator.serviceWorker.dispatchEvent(
        new MessageEvent('message', {data: {tipo: 'versione-nuova'}}));
    });
    await pagina.waitForSelector('#fblVersioneNuova', {timeout: 3000});
    const laNavigazione = pagina.waitForEvent('framenavigated', {timeout: 8000}).catch(() => null);
    await pagina.click('#fblVersioneRicarica');
    assert.ok(await laNavigazione, 'premere «Aggiorna» deve far ripartire la pagina');
    const ancoraLaVecchia = await pagina.evaluate(() => window.__primaDellAggiornamento === true);
    assert.equal(ancoraLaVecchia, false, 'dopo il riavvio la vecchia pagina non c\'è più');
  } finally {
    await browser.close();
  }
});
