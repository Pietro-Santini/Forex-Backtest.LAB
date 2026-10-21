// IL TRADE JOURNAL DEVE SOPRAVVIVERE A UN AGGIORNAMENTO.
//
// SEGNALATO dal proprietario: «non rimane salvato in memoria nel trade journal e sparisce alla
// prossima installazione del programma o aggiornamento».
//
// LA CAUSA, letta nel codice. Le operazioni vivono in localStorage e IndexedDB, che il browser
// tiene SEPARATI PER INDIRIZZO D'INGRESSO: il sito, il 127.0.0.1 del ponte e il localhost
// dell'APK sono tre magazzini diversi. La copia che segue l'ACCOUNT - quella su Firestore - si
// scriveva SOLO su 'pagehide' e sul logout, e 'pagehide' e' l'istante in cui la pagina viene
// distrutta: una scrittura asincrona li' puo' non arrivare mai. Al riavvio, se in locale non c'e'
// niente (indirizzo diverso dopo un aggiornamento), si legge il cloud - dove la copia poteva non
// essere mai stata scritta.
//
// PERCHE' NON SI SCRIVEVA PRIMA, e perche' e' giusto farlo ADESSO: il salvataggio su Firestore
// era stato tolto dal giro dell'autosalvataggio, che gira ogni ~800 ms durante il trading - li'
// sarebbe stata una tempesta di scritture. Un'operazione CHE SI CHIUDE e' un'altra cosa: sono
// pochi eventi al giorno.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

const PREPARA = () => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++)
    R.push({date: new Date(t0 + i * 60000).toISOString(),
            open: 100, high: 100.5, low: 99.5, close: 100.2, volume: 5});
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD';
  if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; mt5Connected = false;
  trades = []; active = null; positions = [];
  for (let i = 0; i < 10; i++) positions.push({
    id: 'P' + i, asset: 'EURUSD', side: 'BUY', entry: 100, sl: 99, rrSl: 99, tp: 101,
    lots: 0.1, marginUsed: 10, start: 10, startTime: t0 + 10 * 60000});
  // L'attesa vera e' di otto secondi: in prova si accorcia, altrimenti il test durerebbe
  // piu' del collaudo intero.
  FBL_CLOUD_TRADE_ATTESA_MS = 60;
};

test('chiudere un\'operazione la manda nel cloud, senza aspettare che la pagina muoia', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      const chiamate = [];
      const vero = syncFullStatusToFirebase;
      syncFullStatusToFirebase = (motivo, forza) => { chiamate.push({motivo, forza}); };
      try{
        closeTrade('MANUAL', 100.3, positions[0]);
        await new Promise(r2 => setTimeout(r2, 300));
        return {chiamate, quantiTrade: trades.length};
      } finally { syncFullStatusToFirebase = vero; }
    }, PREPARA.toString());
    assert.equal(r.quantiTrade, 1, 'l\'operazione deve essere finita nel Journal');
    assert.equal(r.chiamate.length, 1, 'e deve essere stata mandata nel cloud: ' + JSON.stringify(r.chiamate));
    assert.equal(r.chiamate[0].forza, true,
      'forzata: il limite di frequenza non deve poter saltare proprio il dato che non si puo\' perdere');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('dieci chiusure di fila fanno UNA scrittura, non dieci', async () => {
  // La chiusura a blocco chiama closeTrade dieci volte in un colpo. Senza l'attesa sarebbero
  // dieci scritture per un fatto solo - ed e' proprio il motivo per cui il salvataggio su cloud
  // era stato tolto dal giro automatico.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      const chiamate = [];
      const vero = syncFullStatusToFirebase;
      syncFullStatusToFirebase = () => { chiamate.push(1); };
      try{
        [...positions].forEach(x => closeTrade('MANUAL', 100.3, x));
        await new Promise(r2 => setTimeout(r2, 300));
        return {scritture: chiamate.length, chiusi: trades.length};
      } finally { syncFullStatusToFirebase = vero; }
    }, PREPARA.toString());
    assert.equal(r.chiusi, 10, 'tutte e dieci devono essere chiuse');
    assert.equal(r.scritture, 1,
      'ma la scrittura sul cloud deve essere una sola: trovate ' + r.scritture);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('e l\'uscita della pagina resta l\'ultima rete, forzata', () => {
  // Il salvataggio quando il Journal cambia non sostituisce quello all'uscita: lo affianca. Ma
  // quello all'uscita partiva SENZA forzatura, quindi il limite di frequenza di quattro secondi
  // poteva saltarlo - e saltare l'ultima occasione di salvare significa perdere l'ultimo pezzo di
  // sessione proprio alla chiusura.
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  assert.match(src, /syncFullStatusToFirebase\('pagehide',true\)/,
    'il salvataggio all\'uscita deve essere forzato');
  assert.ok(!/syncFullStatusToFirebase\('pagehide'\)/.test(src),
    'non deve restarne in giro una versione non forzata');
});
