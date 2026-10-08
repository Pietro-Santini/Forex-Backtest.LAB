// LA STRADA DEGLI ORDINI (porta 8000: MT5, posizioni, apertura e chiusura).
//
// Il guasto, trovato l'8 ottobre 2026 sul telefono del proprietario: la sezione MT5 non si
// collegava, mentre grafico e segnali funzionavano e il pannello «Cosa risponde adesso» era
// tutto verde. Causa: l'indirizzo degli ordini veniva INDOVINATO da `fblBaseUrl(8000)`, che
// passa dal server solo col campo "computer" vuoto. Con un indirizzo rimasto scritto da prima,
// tutte le chiamate di MT5 andavano li' e il server non veniva nemmeno provato. Il grafico no,
// perche' dalla v105 la sua strada se la prova.
//
// Qui la rete e' tutta bloccata: e' il caso peggiore (niente risponde), quello in cui si vede se
// la scelta della strada e' una scelta o una scommessa.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium, RADICE} from './aiuti.mjs';
import path from 'node:path';

const SERVER = 'server-di-prova.tail0000.ts.net';
const VECCHIO = 'computer-vecchio.tail0000.ts.net';

async function apri({server, vecchioIndirizzo}) {
  const browser = await chromium.launch();
  const pagina = await browser.newPage({viewport: {width: 390, height: 844}});
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  await pagina.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pagina.addInitScript(([srv, vec]) => {
    if (srv) { localStorage.setItem('fbl_server_host', srv); localStorage.setItem('fbl_server_chiave', 'chiave-di-prova'); }
    else { localStorage.removeItem('fbl_server_host'); localStorage.removeItem('fbl_server_chiave'); }
    if (vec) { localStorage.setItem('fb_indirizzo_ponte', vec); localStorage.setItem('fb_chiave_ponte', 'vecchia'); }
    else { localStorage.removeItem('fb_indirizzo_ponte'); localStorage.removeItem('fb_chiave_ponte'); }
  }, [server || '', vecchioIndirizzo || '']);
  await pagina.goto('file://' + path.join(RADICE, 'app.html'), {waitUntil: 'domcontentloaded'});
  await pagina.waitForTimeout(3500);
  await pagina.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay').forEach(el => el.style.display = 'none'));
  return {browser, pagina, errori};
}

test('col server impostato, un indirizzo del computer rimasto scritto non dirotta più MT5', async () => {
  const {browser, pagina, errori} = await apri({server: SERVER, vecchioIndirizzo: VECCHIO});
  try {
    const r = await pagina.evaluate(async () => {
      await fblScegliStradaOrdini();
      return {via: fblOrdiniVia, url: MT5_BRIDGE_URL, host: fblHost()};
    });
    assert.equal(r.host, 'computer-vecchio.tail0000.ts.net', 'l\'indirizzo vecchio è davvero ancora scritto');
    assert.equal(r.via, 'server');
    assert.ok(r.url.includes('/pc/8000'), 'gli ordini passano dal server: ' + r.url);
    assert.ok(!r.url.includes('computer-vecchio'), 'non si va più dritti all\'indirizzo vecchio: ' + r.url);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza server, l\'indirizzo del computer resta quello che comanda (come prima)', async () => {
  const {browser, pagina, errori} = await apri({server: '', vecchioIndirizzo: VECCHIO});
  try {
    const r = await pagina.evaluate(async () => {
      await fblScegliStradaOrdini();
      return {via: fblOrdiniVia, url: MT5_BRIDGE_URL};
    });
    assert.equal(r.via, null, 'niente server e niente risposte: nessuna strada da dichiarare');
    assert.ok(r.url.includes('computer-vecchio'), 'si continua a parlare col computer scritto: ' + r.url);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il pannello dei servizi prova l\'indirizzo che usa DAVVERO la sezione MT5', async () => {
  const {browser, pagina, errori} = await apri({server: SERVER, vecchioIndirizzo: VECCHIO});
  try {
    const r = await pagina.evaluate(async () => {
      await fblScegliStradaOrdini();
      const riga = fblServiziElenco().find(x => x.chiave === 'ordini');
      return {url: riga.url, dove: riga.dove, usato: MT5_BRIDGE_URL};
    });
    // E' questo il punto: prima la riga "Ordini" provava una rotta sua e restava verde mentre
    // MT5 andava altrove. Un controllo che conferma una cosa diversa da quella in uso manda a
    // cercare il guasto dove non e'.
    assert.ok(r.url.startsWith(r.usato + '/health'), 'la riga Ordini prova ' + r.url + ' e MT5 usa ' + r.usato);
    assert.equal(r.dove, 'computer, tramite il server');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
