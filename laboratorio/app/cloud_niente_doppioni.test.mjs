// SU FIREBASE NON SI RISCRIVE QUELLO CHE NON E' CAMBIATO.
//
// CHIESTO dal proprietario: «facciamo in modo di pesare il meno possibile anche il passaggio di
// dati con Firebase, perche' sennò sforiamo i livelli massimi di utilizzo gratuiti e dovremmo
// iniziare a pagare per le richieste e lo scambio di dati».
//
// IL CONTO CHE SI PAGA: ogni salvataggio manda l'INTERO pacchetto di sessione - conto, posizioni,
// Trade Journal, disegni, ultima candela vista per asset, celle del footprint - e puo' avvicinarsi
// al tetto di 1 MB per documento. Firestore si paga a SCRITTURA e a BYTE trasferito, quindi due
// salvataggi identici costano come due diversi. Pagare due volte per la stessa fotografia e' lo
// spreco piu' facile da togliere, ed e' anche quello che capita piu' spesso: il salvataggio parte
// all'uscita della pagina e quando si chiude un'operazione, e fra i due puo' non essere cambiato
// niente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

const PREPARA = () => {
  const mandati = [];
  window.fxbtCloud = {uid: 'u1', save: async (b) => { mandati.push(b); }};
  window.__mandati = mandati;
  fblCloudUltimaFirma = null; fblCloudScritture = 0; fblCloudSaltate = 0;
  lastFirebaseSyncAt = 0;
  // Si evita che il salvataggio locale faccia altro lavoro durante la prova.
  saveLightStateToLocalStorageNow = () => ({version: SESSION_VERSION, trades: [], posizioni: []});
  captureCurrentAssetChartView = () => {};
  flushAssetChartViewsPersist = async () => {};
  footprintCollectCloudAggregate = () => ({});
};

test('due salvataggi identici diventano uno solo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      await syncFullStatusToFirebase('prova', true);
      await syncFullStatusToFirebase('prova', true);
      await syncFullStatusToFirebase('prova', true);
      return {mandati: window.__mandati.length, scritture: fblCloudScritture, saltate: fblCloudSaltate};
    }, PREPARA.toString());
    assert.equal(r.mandati, 1, 'tre salvataggi identici devono diventare una scrittura sola');
    assert.equal(r.scritture, 1);
    assert.equal(r.saltate, 2, 'e le due risparmiate si contano, per poterle guardare');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ma appena cambia qualcosa si scrive', async () => {
  // LA PROVA DI CONTROLLO, e la piu' importante: un risparmio che si mangia anche i salvataggi
  // VERI non e' un risparmio, e' una perdita di dati. Qui si cambia una sola operazione del
  // Trade Journal e la scrittura deve ripartire.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      let n = 0;
      saveLightStateToLocalStorageNow = () => ({version: SESSION_VERSION, trades: new Array(n).fill(0).map((_, i) => ({id: i}))});
      await syncFullStatusToFirebase('prima', true);
      n = 1;                                    // si chiude un'operazione
      await syncFullStatusToFirebase('dopo', true);
      n = 2;                                    // e un'altra
      await syncFullStatusToFirebase('ancora', true);
      return {mandati: window.__mandati.length, scritture: fblCloudScritture, saltate: fblCloudSaltate};
    }, PREPARA.toString());
    assert.equal(r.mandati, 3, 'ogni cambiamento vero deve essere salvato: ' + r.mandati);
    assert.equal(r.saltate, 0, 'e non si deve saltare niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una scrittura fallita viene rifatta, non data per buona', async () => {
  // La firma si aggiorna solo DOPO una scrittura riuscita. Se si aggiornasse prima, un errore di
  // rete farebbe credere all'app di avere salvato, e quel pezzo di sessione sarebbe perso per
  // sempre - un risparmio pagato con i dati.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      let rompi = true;
      const mandati = [];
      window.fxbtCloud = {uid: 'u1', save: async (b) => {
        if (rompi) throw new Error('rete assente');
        mandati.push(b);
      }};
      await syncFullStatusToFirebase('fallisce', true);
      rompi = false;
      await syncFullStatusToFirebase('riprova', true);
      return {riusciti: mandati.length, scritture: fblCloudScritture};
    }, PREPARA.toString());
    assert.equal(r.riusciti, 1, 'dopo un errore il salvataggio deve essere ritentato');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il consumo si vede nella misura delle prestazioni', () => {
  // Senza numeri, il consumo si scopre solo dalla bolletta.
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const i = src.indexOf('function fblMisuraPrestazioni');
  assert.ok(i > 0, 'la funzione di misura deve esistere');
  // Fino alla funzione SUCCESSIVA, non una finestra a lunghezza fissa: dentro la misura il
  // codice cresce (ci sono appena entrati i pezzi dell'aggiornamento e l'avviso sulle misure
  // prese a vuoto) e una finestra corta smetterebbe di vedere quello che cerca - e' gia'
  // successo due volte in questa sessione.
  const dentro = src.slice(i);
  const fine = dentro.search(new RegExp('\\r?\\n(async )?function '));
  const f = dentro.slice(0, fine > 0 ? fine : 12000);
  assert.match(f, /cloudScritture/, 'quante scritture sono partite');
  assert.match(f, /cloudSaltate/, 'quante sono state risparmiate');
  assert.match(f, /cloudUltimoPeso_KB/, 'e quanto pesa l\'ultima fotografia mandata');
});
