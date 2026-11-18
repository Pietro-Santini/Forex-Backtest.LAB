// LO STORICO DEL BOOK SI SCRIVE OGNI ORA, NON OGNI GIRO.
//
// DECISIONE DEL PROPRIETARIO (18 novembre 2026), sulla riga che diceva «riscritto ogni 4 secondi»:
// «mettiamo ogni ora».
//
// COM'ERA: `saveOrderBookHistoryNow()` stava dentro lo stesso giro debounced a 800 ms dello stato
// leggero. A mercato vivo voleva dire riscrivere, ogni pochi secondi, TUTTO il log del book di
// TUTTI gli asset: la scrittura piu' grossa e piu' frequente dell'app, su un dato che serve solo
// a ridisegnare la heatmap dopo una riapertura.
//
// COM'E' ORA: al massimo una volta all'ora. Ma quando si esce davvero - pagina che si chiude,
// uscita dalla sessione - si FORZA, altrimenti la cura si mangerebbe fino a un'ora di storico.
// Le due prove coprono i due versi: non deve scrivere troppo, e non deve perdere niente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Conta le scritture su IndexedDB delle chiavi del book, e fa finta che ci sia roba nuova.
const PREPARA = `(() => {
  window.__scritte = [];
  const vero = idbPut;
  window.idbPut = async (k,v) => { window.__scritte.push(String(k)); return true; };
  orderBookHistoryByAsset = {EURUSD:[{time_ms:1,bids:[{price:1,volume:1}],asks:[]}]};
  orderBookHistoryDirty = true;
  orderBookSalvatoAt = 0;
  orderBookDeepDirty = false; providerSvpDirty = false;
  return typeof window.idbPut === 'function';
})()`;

test('due giri di autosalvataggio di fila scrivono il book UNA volta sola', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    assert.equal(await pagina.evaluate(PREPARA), true);
    const r = await pagina.evaluate(async () => {
      await saveOrderBookHistoryNow();          // primo giro: scrive (non ha mai scritto)
      orderBookHistoryDirty = true;             // arriva roba nuova
      await saveOrderBookHistoryNow();          // secondo giro, pochi istanti dopo
      orderBookHistoryDirty = true;
      await saveOrderBookHistoryNow();          // terzo
      return {scritte: window.__scritte.filter(k=>k==='orderBookHistory').length,
              sporco: orderBookHistoryDirty};
    });
    assert.equal(r.scritte, 1, 'doveva scrivere una volta sola: ha scritto ' + r.scritte + ' volte');
    assert.equal(r.sporco, true, 'la roba nuova non va persa: resta da scrivere al prossimo giro utile');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('passata un ora, il giro dopo scrive', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA);
    const r = await pagina.evaluate(async () => {
      await saveOrderBookHistoryNow();
      orderBookHistoryDirty = true;
      orderBookSalvatoAt = Date.now() - 3600001;   // e' passata un'ora
      await saveOrderBookHistoryNow();
      return window.__scritte.filter(k=>k==='orderBookHistory').length;
    });
    assert.equal(r, 2, 'dopo un\'ora deve scrivere di nuovo: scritture ' + r);
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('alla chiusura si scrive comunque, anche se l ora non e passata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA);
    const r = await pagina.evaluate(async () => {
      await saveOrderBookHistoryNow();          // scrive
      orderBookHistoryDirty = true;             // poi arriva altra roba
      await saveOrderBookHistoryNow(true);      // la pagina sta sparendo
      return {scritte: window.__scritte.filter(k=>k==='orderBookHistory').length,
              sporco: orderBookHistoryDirty};
    });
    assert.equal(r.scritte, 2, 'all\'uscita deve salvare comunque: scritture ' + r.scritte);
    assert.equal(r.sporco, false, 'e dopo non resta niente da scrivere');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('se la scrittura fallisce, non si aspetta un altra ora', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA);
    const r = await pagina.evaluate(async () => {
      window.idbPut = async (k,v) => { window.__scritte.push(String(k)); return false; }; // memoria piena
      await saveOrderBookHistoryNow();
      const dopoIlNo = {sporco: orderBookHistoryDirty, orologio: orderBookSalvatoAt};
      window.idbPut = async (k,v) => { window.__scritte.push(String(k)); return true; };
      await saveOrderBookHistoryNow();          // subito dopo: deve riprovare
      return {dopoIlNo, scritte: window.__scritte.filter(k=>k==='orderBookHistory').length};
    });
    assert.equal(r.dopoIlNo.sporco, true, 'un no non deve far perdere il flag');
    assert.equal(r.dopoIlNo.orologio, 0, 'e non deve far partire l\'ora di attesa');
    assert.equal(r.scritte, 2, 'deve riprovare subito: tentativi ' + r.scritte);
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});
