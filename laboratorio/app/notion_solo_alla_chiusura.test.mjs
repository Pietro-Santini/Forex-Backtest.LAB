// NOTION SI AGGIORNA QUANDO SI CHIUDE UNA POSIZIONE, E SOLO CON QUELLA.
//
// DECISO dal proprietario il 13 novembre 2026, con la bolletta davanti: «Notion non puo' pesare
// cosi' tanto, deve aggiornarsi solo quando si chiude una singola posizione, non sempre,
// altrimenti e' normale che pesa. E si aggiorna solo con l'ultima, non puo' aggiornarsi di
// continuo e ripercorrere tutte le operazioni».
//
// MISURATO sulla console Firebase lo stesso giorno: 42.000 scritture in un giorno (il tetto
// gratuito e' 20.000) e 85.000 letture (tetto 50.000), con 7,01 euro di Cloud Functions su 8,50
// di bolletta. L'app, per conto proprio, quel giorno aveva scritto 57 volte.
//
// IL CONTO CHE INCHIODA LA CAUSA: il giro partiva ogni 30 secondi e mandava fino a 40 operazioni;
// la funzione sul server fa una lettura e una scrittura su Firestore per OGNI operazione. 42.000
// diviso 40 fa 1.050 giri, cioe' quasi ogni giro ne mandava quaranta - e se una sincronizzazione
// non va a buon fine le stesse quaranta tornano al giro dopo, per sempre.
//
// Queste prove misurano le tre cose chieste: nessun giro a tempo, si parte dalla chiusura, e si
// manda SOLO quello che si e' appena chiuso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const RADICE = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const SORGENTE = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');

// Mette l'app nello stato "Notion pronto" e intercetta cio' che parte davvero verso il server.
// Si guarda il corpo della richiesta, non le intenzioni: e' quello che si paga.
const SPIA = `(async (argomento) => {
  const mandati = [];
  notionState = {paid: true, connected: true, preparing: false, complete: true};
  window.__sessionRestoreDone = true;
  const vero = window.notionCall;
  window.notionCall = async (nome, corpo) => {
    mandati.push({nome, chiavi: (corpo.upserts || []).map(x => x.key),
                  cancellate: corpo.deletes || []});
    return {ok: (corpo.upserts || []).map(x => x.key), deleted: corpo.deletes || [], failed: []};
  };
  try { await notionSyncTick(false, argomento); } finally { window.notionCall = vero; }
  return mandati;
})`;

test('NESSUN giro a tempo: non esiste piu un setInterval che sincronizza Notion', () => {
  // Si legge il sorgente perche' e' l'unico modo di dire «non esiste», che e' proprio la cosa da
  // garantire: un timer che riparte e' esattamente il difetto da cui nasceva la bolletta.
  const timer = SORGENTE.match(/setInterval\([^;]{0,80}notionSyncTick/g) || [];
  console.log('timer trovati:', JSON.stringify(timer));
  assert.deepEqual(timer, [],
    'nessun setInterval puo chiamare notionSyncTick: ogni giro costava fino a 40 letture e 40 ' +
    'scritture su Firestore. Trovati: ' + JSON.stringify(timer));
});

test('il gancio sta sui punti di chiusura, non altrove', () => {
  const ganci = (SORGENTE.match(/fblNotionDopoChiusura\(/g) || []).length;
  console.log('ganci:', ganci);
  assert.ok(ganci >= 4,
    'servono la definizione e i punti dove una posizione si chiude davvero (ordine normale, ' +
    'sessione in diretta, Kraken): trovati ' + ganci);
});

test('si manda SOLO l operazione appena chiusa, non lo storico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (spia) => {
      trades.length = 0;
      // Mille operazioni vecchie: nel suo Journal ce ne sono piu' di mille per davvero.
      for (let i = 0; i < 1000; i++) {
        trades.push({id: 'vecchia' + i, asset: 'EURUSD', side: 'BUY', entry: 1.1, exit: 1.2,
                     lots: 0.1, result: 'TP', pl: 10, closedAt: '2026-01-01T10:00:00.000Z',
                     mode: 'backtest'});
      }
      trades.push({id: 'appenachiusa', asset: 'XAUUSD', side: 'SELL', entry: 3883, exit: 3870,
                   lots: 0.15, result: 'TP', pl: 195, closedAt: '2026-11-13T15:00:00.000Z',
                   mode: 'live'});
      notionSaveHashes({});
      const mandati = await eval(spia)('appenachiusa');
      return {mandati, quante: trades.length};
    }, SPIA);
    console.log('mandato a Notion:', JSON.stringify(r));
    assert.equal(r.quante, 1001, 'le mille vecchie ci sono davvero, nel Journal');
    assert.equal(r.mandati.length, 1, 'un solo invio: ' + JSON.stringify(r.mandati));
    assert.deepEqual(r.mandati[0].chiavi, ['appenachiusa'],
      'deve partire SOLO l operazione appena chiusa. Con le mille vecchie dentro sarebbero 40 ' +
      'letture e 40 scritture ogni volta, che e la bolletta di oggi. Partito: ' +
      JSON.stringify(r.mandati[0].chiavi));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('piu chiusure nello stesso giro partono insieme, in UN solo invio', async () => {
  // Il recupero dallo storico puo' trovare quattro posizioni chiuse in una volta: non se ne deve
  // perdere nessuna, e non devono diventare quattro chiamate al server.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(async (spia) => {
      trades.length = 0;
      ['a', 'b', 'c'].forEach(k => trades.push({
        id: k, asset: 'EURUSD', side: 'BUY', entry: 1.1, exit: 1.2, lots: 0.1, result: 'TP',
        pl: 10, closedAt: '2026-11-13T15:00:00.000Z', mode: 'live'}));
      notionSaveHashes({});
      return {mandati: await eval(spia)(['a', 'c'])};
    }, SPIA);
    console.log('tre chiusure:', JSON.stringify(r));
    assert.equal(r.mandati.length, 1, 'un solo invio, non uno per operazione');
    assert.deepEqual(r.mandati[0].chiavi.slice().sort(), ['a', 'c'],
      'devono partire tutte e sole quelle chiuse: la b, che non si e chiusa, resta fuori. ' +
      'Partito: ' + JSON.stringify(r.mandati[0].chiavi));
  } finally { await browser.close(); }
});

test('con una sola operazione in mano non si ARCHIVIA nulla su Notion', async () => {
  // La trappola di questa cura: guardando una operazione sola, tutte le altre sembrerebbero
  // «sparite» e finirebbero archiviate nel Notion del proprietario. Sarebbe peggio del difetto.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(async (spia) => {
      trades.length = 0;
      trades.push({id: 'nuova', asset: 'XAUUSD', side: 'SELL', entry: 3883, exit: 3870,
                   lots: 0.15, result: 'TP', pl: 195, closedAt: '2026-11-13T15:00:00.000Z',
                   mode: 'live'});
      // Nelle impronte risultano gia' mandate cento operazioni che ora non sono in elenco.
      const h = {};
      for (let i = 0; i < 100; i++) h['vecchia' + i] = 'x';
      notionSaveHashes(h);
      return {mandati: await eval(spia)('nuova')};
    }, SPIA);
    console.log('invii:', JSON.stringify(r));
    const cancellate = r.mandati.reduce((n, m) => n + (m.cancellate || []).length, 0);
    assert.equal(cancellate, 0,
      'non si archivia NIENTE quando si guarda una sola operazione: le altre cento non sono ' +
      'sparite, semplicemente non le stiamo guardando. Chieste: ' + JSON.stringify(r.mandati));
  } finally { await browser.close(); }
});

test('la passata completa si puo ancora chiedere a mano, e guarda tutto', async () => {
  // Togliendo il giro a tempo, il pulsante manuale diventa l'unico modo di rifare la passata su
  // tutto: deve esserci, e deve funzionare davvero.
  assert.ok(SORGENTE.includes("$('notionSyncAllBtn')"), 'il pulsante manuale non puo sparire');
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(async (spia) => {
      trades.length = 0;
      ['a', 'b', 'c'].forEach(k => trades.push({
        id: k, asset: 'EURUSD', side: 'BUY', entry: 1.1, exit: 1.2, lots: 0.1, result: 'TP',
        pl: 10, closedAt: '2026-11-13T15:00:00.000Z', mode: 'live'}));
      notionSaveHashes({});
      return {mandati: await eval(spia)(undefined)};   // senza soloId: passata completa
    }, SPIA);
    console.log('passata completa:', JSON.stringify(r));
    assert.equal(r.mandati.length, 1);
    assert.deepEqual(r.mandati[0].chiavi.slice().sort(), ['a', 'b', 'c'],
      'senza soloId devono partire tutte: ' + JSON.stringify(r.mandati[0].chiavi));
  } finally { await browser.close(); }
});
