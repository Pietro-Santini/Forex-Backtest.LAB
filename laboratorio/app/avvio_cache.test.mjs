// Il service worker deve mostrare SUBITO la copia salvata, non dopo 4 secondi.
//
// Segnalato dal proprietario: sul telefono l'app resta ferma sul logo. Misurato il 7 ottobre 2026:
// app.html pesa 4,03 MB e ci mette 3,2 s a scaricarsi da un computer con rete veloce; su dati
// mobili molto di piu'. Prima sw.js chiedeva sempre la rete e si decideva a usare la copia salvata
// solo dopo 4 secondi di attesa: con un file da 4 MB quell'attesa c'era praticamente sempre.
//
// La funzione si ESTRAE da sw.js, non si copia: se domani cambia li', questa prova misura il
// codice nuovo. Si prova senza browser, con sostituti di `caches` e `fetch`: quello che conta e'
// la DECISIONE (rispondo con la copia o aspetto la rete?), non il trasporto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SORGENTE = fs.readFileSync(path.join(RADICE, 'sw.js'), 'utf8');

// Prepara la funzione vera con dei sostituti attorno.
// `ritardoRete` = quanto ci mette la rete; `inCache` = se una copia salvata c'e'.
function prepara({ritardoRete = 50, inCache = null}) {
  const da = SORGENTE.indexOf('function rispostaSubitoPoiAggiorna');
  assert.ok(da > 0, 'rispostaSubitoPoiAggiorna non trovata in sw.js');
  const fine = SORGENTE.indexOf('\nself.addEventListener("fetch"', da);
  const corpo = SORGENTE.slice(da, fine > da ? fine : undefined);

  const messe = [];                     // cosa e' stato salvato in cache
  let chiamateRete = 0;
  const CACHE_NAME = 'prova';
  const caches = {
    match: async () => inCache,
    open: async () => ({ put: async (req, resp) => { messe.push(resp && resp.corpo); } })
  };
  const fetch = (req) => {
    chiamateRete++;
    return new Promise((ok, ko) => setTimeout(() => {
      if (ritardoRete < 0) return ko(new Error('offline'));
      ok({ status: 200, corpo: 'dalla rete', clone: () => ({ corpo: 'dalla rete' }) });
    }, Math.abs(ritardoRete)));
  };
  const fn = new Function('caches', 'fetch', 'CACHE_NAME',
    corpo + '\nreturn rispostaSubitoPoiAggiorna;')(caches, fetch, CACHE_NAME);
  return {fn, messe, rete: () => chiamateRete};
}

test('con una copia salvata si risponde SUBITO, senza aspettare la rete', async () => {
  // La rete ci mette 3 secondi, come su un telefono: la risposta non deve aspettarla.
  const {fn, rete} = prepara({ritardoRete: 3000, inCache: {corpo: 'dalla cache'}});
  const t0 = Date.now();
  const r = await fn('/app.html');
  const ms = Date.now() - t0;
  assert.equal(r.corpo, 'dalla cache');
  assert.ok(ms < 200, 'ha aspettato ' + ms + ' ms: deve rispondere subito');
  assert.equal(rete(), 1, 'la rete parte lo stesso, per aggiornare la copia');
});

test('la copia si aggiorna dietro, per la volta dopo', async () => {
  const {fn, messe} = prepara({ritardoRete: 20, inCache: {corpo: 'dalla cache'}});
  await fn('/app.html');
  await new Promise(r => setTimeout(r, 120));      // tempo alla rete di finire
  assert.deepEqual(messe, ['dalla rete'], 'la risposta della rete deve finire in cache');
});

test('prima apertura in assoluto: nessuna copia, si aspetta la rete', async () => {
  const {fn} = prepara({ritardoRete: 30, inCache: null});
  const r = await fn('/app.html');
  assert.equal(r.corpo, 'dalla rete');
});

test('senza rete e senza copia non si inventa una risposta', async () => {
  const {fn} = prepara({ritardoRete: -1, inCache: null});
  await assert.rejects(() => fn('/app.html'), /offline/);
});

test('senza rete ma con la copia, l\'app si apre lo stesso', async () => {
  const {fn} = prepara({ritardoRete: -1, inCache: {corpo: 'dalla cache'}});
  const r = await fn('/app.html');
  assert.equal(r.corpo, 'dalla cache');
});

// La ragione per cui il download di sfondo non deve piu' saltare la cache del browser: su dati
// mobili sarebbero 4 MB a ogni apertura. Con l'ETag di GitHub Pages diventa una domanda da pochi
// byte. E' una scelta che si perde facilmente in una modifica distratta: qui resta scritta.
test('il download di sfondo non salta la cache del browser (niente no-store)', () => {
  const da = SORGENTE.indexOf('function rispostaSubitoPoiAggiorna');
  const fine = SORGENTE.indexOf('\nself.addEventListener("fetch"', da);
  const corpo = SORGENTE.slice(da, fine > da ? fine : undefined);
  assert.doesNotMatch(corpo, /no-store/,
    "con no-store si riscaricano 4 MB a ogni apertura, anche quando il file non e' cambiato");
});
