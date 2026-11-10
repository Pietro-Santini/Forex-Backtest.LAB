// BANCO DI MISURA (non corregge niente): riproduce su Chromium la situazione del telefono
// dentro l'APK, cioe' con l'ORIGINE DELLA PAGINA uguale a quella che il log del proprietatore
// stampa (Â«da questa pagina: https://localhostÂ»).
//
// IL LOG DEL 10 NOVEMBRE 2026 (screenshot del proprietatore):
//   servizio Ordini (questo computer): risponde in 14 ms
//   servizio Grafico (computer): non raggiungibile in 7 ms
//   servizio Segnali (server): risponde in 192 ms
//   da questa pagina: https://localhost
//   "Simulato: i dati del conto MT5 non arrivano (risposta non valida)"
//
// Qui si misura la STESSA app.html in due versioni:
//   - VECCHIA  = `git show HEAD:app.html`, quella che sta su GitHub Pages e dentro l'APK;
//   - ATTUALE  = il file di lavoro (con la cura del 10 novembre 2026 su fblPaginaDalPonteLocale).
// La pagina viene servita da http://localhost:PORTA (hostname Â«localhostÂ», come
// https://localhost dentro la WebView di Capacitor). Il server locale risponde 200 a
// QUALSIASI percorso, come fa il server incorporato della WebView: e' quello che produce il
// falso Â«rispondeÂ» degli ordini.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from './aiuti.mjs';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP_ATTUALE = fs.readFileSync(path.join(RADICE, 'app.html'));
const APP_VECCHIA = execFileSync('git', ['show', 'HEAD:app.html'], {cwd: RADICE, maxBuffer: 64 * 1024 * 1024});
// La porta NON e' la 8000 ne' la 8001: su questo computer girano il ponte e il servizio dati
// VERI del proprietore, e un banco di prova non li tocca. Non cambia niente della misura:
// l'app guarda il nome dell'host (localhost), non la porta.
const PORTA = 18777;

// Lo stato del telefono nel log: server Oracle per nome, chiave presente, NESSUN indirizzo del
// computer scritto a mano (l'APK non lo scrive).
const PREPARA_TELEFONO = () => {
  try{ localStorage.setItem('fbl_server_host', 'pietro.tail83d918.ts.net'); }catch(e){}
  try{ localStorage.setItem('fbl_server_chiave', 'K'.repeat(36)); }catch(e){}
  try{ localStorage.removeItem('fb_indirizzo_ponte'); }catch(e){}
  try{ localStorage.removeItem('fb_chiave_ponte'); }catch(e){}
  fblPonteLocaleVivo = null; fblPonteLocaleAt = 0; fblPonteLocaleInCorso = null;
  fblOrdiniVia = null; fblGraficoVia = null;
};

async function misura(APP) {
  const server = http.createServer((req, res) => {
    if (req.url.split('?')[0] === '/app.html') {
      res.writeHead(200, {'content-type': 'text/html; charset=utf-8'}); res.end(APP);
    } else {
      res.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
      res.end('<!DOCTYPE html><title>app</title><p>pagina del telefono</p>');
    }
  });
  await new Promise((r) => server.listen(PORTA, '127.0.0.1', r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}});
  await ctx.addInitScript(() => {
    class WS { constructor(u){ this.url = String(u||''); this.readyState = 0; }
      send(){} close(){ this.readyState = 3; } addEventListener(){} removeEventListener(){} }
    try{ Object.defineProperty(window, 'WebSocket', {configurable: true, writable: true, value: WS}); }catch(e){}
  });
  await ctx.addInitScript(PREPARA_TELEFONO);
  const pagina = await ctx.newPage();
  // Il giro delle richieste si mette PRIMA del goto: l'app, se trova il modulo di Firebase e
  // nessuna sessione, se ne va su login.html (app.html:1190 LOGIN_PAGE). Qui il modulo non
  // carica (rete tagliata) e non si esce da questa pagina, come nel banco dell'app.
  await pagina.route('**', (r) => {
    const u = r.request().url();
    if (u.startsWith('http://localhost:' + PORTA + '/')) return r.continue();
    if (u.indexOf('/login.html') >= 0) return r.abort();
    if (/tail83d918\.ts\.net|github\.io/.test(u)) {
      return r.fulfill({status: 200, contentType: 'application/json', body: '{"ok":true}'});
    }
    return r.abort();
  });
  await pagina.goto('http://localhost:' + PORTA + '/app.html', {waitUntil: 'domcontentloaded'});
  await pagina.waitForTimeout(2500);
  await pagina.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
    .forEach((el) => { el.style.display = 'none'; }));
  try {
    return await pagina.evaluate(async () => {
      let proveOrdini = 0;
      const vera = fblControllaPonteLocale;
      fblControllaPonteLocale = async () => { proveOrdini++; return false; };
      let sceltaOrdini = null, urlOrdini = null;
      try { sceltaOrdini = await fblScegliStradaOrdini(); urlOrdini = fblUrlOrdini(); }
      finally { fblControllaPonteLocale = vera; }
      const esiti = [];
      for (const v of fblServiziElenco()) {
        const e = await fblProvaUno(v, 6000);
        esiti.push({nome: v.nome, dove: v.dove, esito: e.esito, ms: e.ms});
      }
      let conto = null;
      try {
        const res = await fetch(fblUrlOrdini() + '/account');
        conto = {status: res.status, json: await res.json()};
      } catch (e) { conto = {errore: String((e && e.name) || e)}; }
      return {
        origine: location.origin,
        localeVuoto: fblPaginaDalPonteLocale(),
        localeCapacitor: fblPaginaDalPonteLocale('https://localhost'),
        localePc: fblPaginaDalPonteLocale('http://127.0.0.1:8000'),
        sceltaOrdini, proveOrdini, urlOrdini,
        graficoUrlLocale: fblGraficoUrlLocale(),
        urlGrafico: fblUrlGrafico(), feedUrl: MT5_FEED_URL,
        server: fblServer(),
        esiti, conto,
      };
    });
  } finally { await browser.close(); server.close(); }
}

test('MISURA con la app.html DI OGGI SU GITHUB PAGES (HEAD): riproduce il log del telefono', async () => {
  const r = await misura(APP_VECCHIA);
  console.log('APP_VECCHIA:', JSON.stringify(r, null, 1));
  // L'origine dell'APK viene presa per "qui gira il ponte del computer".
  assert.equal(r.localeCapacitor, true, "https://localhost e' l'origine dell'APK");
  assert.equal(r.localeVuoto, true);
  // Gli ordini prendono la strada "locale" senza UNA sola prova di rete...
  assert.equal(r.sceltaOrdini, 'locale');
  assert.equal(r.proveOrdini, 0);
  // ...e puntano alla PAGINA STESSA: il telefono chiede al telefono.
  assert.equal(r.urlOrdini, 'http://localhost:' + PORTA);
  // Il pannello ripete le tre righe del log.
  const ordini = r.esiti.find((e) => e.nome === 'Ordini');
  const grafico = r.esiti.find((e) => e.nome === 'Grafico');
  const segnali = r.esiti.find((e) => e.nome === 'Segnali');
  assert.equal(ordini.dove, 'questo computer');
  assert.equal(ordini.esito, 'risponde');
  assert.ok(ordini.ms < 500, 'falso positivo, non esce dal telefono: ' + ordini.ms + ' ms');
  assert.equal(grafico.esito, 'non raggiungibile');
  assert.equal(segnali.dove, 'server');
  assert.equal(segnali.esito, 'risponde');
  // Il conto: la risposta non e' JSON -> "i dati del conto MT5 non arrivano".
  assert.ok(r.conto.errore !== undefined || r.conto.json === undefined,
            'la risposta del conto non e\' JSON valido: ' + JSON.stringify(r.conto));
  // E il grafico? Finisce su una porta che sul telefono non esiste.
  assert.equal(r.graficoUrlLocale, 'http://localhost:8001');
  assert.equal(r.urlGrafico, 'http://localhost:8001');
  assert.equal(r.feedUrl, 'http://localhost:8001');
});

test('MISURA con la cura del 10 novembre: ordini a posto, grafico ancora no', async () => {
  const r = await misura(APP_ATTUALE);
  console.log('APP_ATTUALE:', JSON.stringify(r, null, 1));
  // CURATO: l'origine dell'APK non e' piu' scambiata per il ponte.
  assert.equal(r.localeCapacitor, false);
  assert.equal(r.localePc, true, 'sul PC la pagina e\' servita dal ponte sulla 8000');
  assert.notEqual(r.sceltaOrdini, 'locale');
  assert.ok(String(r.urlOrdini).indexOf('pietro.tail83d918.ts.net:8000/pc/8000') >= 0, r.urlOrdini);
  // MA il grafico no: fblGraficoUrlLocale guarda ancora solo l'hostname.
  assert.equal(r.graficoUrlLocale, 'http://localhost:8001',
               'fblGraficoUrlLocale non e\' stata curata: accetta qualsiasi origine localhost');
  assert.equal(r.urlGrafico, 'http://localhost:8001');
  assert.equal(r.feedUrl, 'http://localhost:8001');
});
