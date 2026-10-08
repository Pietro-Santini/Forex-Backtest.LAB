// Il grafico dal telefono: quale strada prende, e cosa succede se una non risponde.
//
// SEGNALATO dal proprietario (8 ottobre 2026): dal telefono e dal tablet il grafico resta col
// pallino rosso, mentre ordini e segnali funzionano.
//
// LA CAUSA (difetto introdotto in v98): dei tre servizi, il grafico era l'unico a non passare mai
// dal server. Ordini e segnali fanno `srv ? perServer(...)`; il grafico usava `fblBaseUrl(8001)`,
// che va al server SOLO se il campo "computer" vale 127.0.0.1. Sul telefono era rimasto scritto un
// indirizzo dei primi tentativi: ordini e segnali lo ignoravano, il grafico ci andava a sbattere.
//
// Verificato sul vero impianto prima di scrivere il rimedio: la porta 8001 del computer risponde
// 200 con candele vere sia via Tailscale sia inoltrata dal server. Le due strade esistono tutte e
// due: il punto e' sceglierne una che risponde, invece di insistere su una morta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Mette l'app nei panni di un telefono: nessun ponte locale, un server configurato, e - il punto -
// un indirizzo del computer rimasto scritto da tentativi precedenti.
// `rispondono` elenca i pezzi di URL che devono rispondere; tutto il resto fallisce.
const SCENA = (hostVecchio, rispondono) => {
  localStorage.setItem('fbl_server_host', 'pietro.tail83d918.ts.net');
  localStorage.setItem('fbl_server_chiave', 'CHIAVE-DEL-SERVER');
  localStorage.setItem('fb_chiave_ponte', 'CHIAVE-DEL-PC');
  if (hostVecchio) localStorage.setItem('fb_indirizzo_ponte', hostVecchio);
  else localStorage.removeItem('fb_indirizzo_ponte');
  window.fblChiamate = [];
  window.fetch = (url, opz) => {
    const u = String(url);
    window.fblChiamate.push(u);
    const ok = rispondono.some((p) => u.includes(p));
    return Promise.resolve({ok, status: ok ? 200 : 502, json: () => Promise.resolve({ok})});
  };
  // Lo stato del ponte locale si rimette a zero, altrimenti vale la risposta di un giro precedente.
  fblPonteLocaleVivo = null; fblPonteLocaleAt = 0; fblPonteLocaleInCorso = null;
  fblGraficoVia = null;
};

async function scegli(pagina, hostVecchio, rispondono) {
  return pagina.evaluate(async ([p, h, r]) => {
    eval('(' + p + ')')(h, r);
    const via = await fblScegliStradaGrafico();
    return {via, feed: MT5_FEED_URL, chiamate: window.fblChiamate};
  }, [SCENA.toString(), hostVecchio, rispondono]);
}

test('IL DIFETTO: con un indirizzo vecchio rimasto scritto, il grafico passa dal server', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    // Solo il server risponde. Prima si restava su 192.168.1.5 per sempre.
    const r = await scegli(pagina, '192.168.1.5', ['pietro.tail83d918.ts.net']);
    assert.equal(r.via, 'server');
    assert.ok(r.feed.includes('/pc/8001'), 'i dati del grafico devono passare dal server: ' + r.feed);
    assert.ok(!r.feed.includes('192.168.1.5'), 'l\'indirizzo vecchio non deve piu\' comparire');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se il computer risponde in diretta, si usa quella: e\' una tappa in meno per ogni tick', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await scegli(pagina, 'desktop-d15isfu.tail83d918.ts.net',
                           ['desktop-d15isfu', 'pietro.tail83d918.ts.net']);
    assert.equal(r.via, 'diretto');
    assert.ok(r.feed.includes('desktop-d15isfu'), r.feed);
    assert.ok(!r.feed.includes('/pc/8001'), 'niente giro dal server quando il computer risponde');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il canale dal vivo segue la stessa strada, firmato con la chiave giusta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async ([p]) => {
      eval('(' + p + ')')('192.168.1.5', ['pietro.tail83d918.ts.net']);
      await fblScegliStradaGrafico();
      // E' cosi' che l'app costruisce il canale dei prezzi dal vivo.
      return fblConChiave(MT5_FEED_URL.replace(/^http/, 'ws') + '/ws/ticks/EURUSD');
    }, [SCENA.toString()]);
    assert.ok(r.startsWith('wss://'), 'canale sicuro: ' + r);
    assert.ok(r.includes('/pc/8001/ws/ticks/EURUSD'), r);
    // Dal telefono la chiave del computer non c'e': al server si parla con la chiave del server.
    assert.ok(r.includes('CHIAVE-DEL-SERVER'), 'firmato con la chiave del server');
    assert.ok(!r.includes('CHIAVE-DEL-PC'), 'mai la chiave del computer verso il server');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('sul computer non cambia niente: si resta in locale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await scegli(pagina, '', ['127.0.0.1']);
    assert.equal(r.via, 'locale');
    assert.ok(r.feed.includes('127.0.0.1'), r.feed);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se non risponde nessuna delle due, lo si sa invece di fingere', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await scegli(pagina, '192.168.1.5', ['niente-risponde']);
    assert.equal(r.via, null);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
