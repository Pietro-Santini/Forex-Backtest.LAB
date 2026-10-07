// Dove vanno a finire le richieste: diritte al computer, oppure attraverso il server.
//
// RICHIESTO dal proprietario (7 ottobre 2026): dal telefono deve funzionare anche il grafico, e i
// prezzi devono arrivare al millisecondo. La catena è: terminale MT5 → ponte sul computer (8001)
// → server → telefono. Sul computer invece si va diretti, senza far viaggiare i dati del grafico
// fino al server e ritorno.
//
// È il genere di cosa che si rompe in silenzio: un indirizzo sbagliato non dà errore, dà un
// grafico fermo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const CON_SERVER = (ponteLocale) => {
  localStorage.setItem('fbl_server_host', 'srv.tail1.ts.net');
  localStorage.setItem('fbl_server_chiave', 'K&1');
  fblPonteLocaleVivo = ponteLocale;      // true = siamo sul computer, false = sul telefono
  fblAggiornaIndirizzi();
};

test('sul computer si va diritti al ponte locale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')(true);
      return {ordini: MT5_BRIDGE_URL, grafico: MT5_FEED_URL};
    }, CON_SERVER.toString());
    // Anche col server impostato: i dati del grafico non devono fare il giro fino in Oracle.
    assert.deepEqual(r, {ordini: 'http://127.0.0.1:8000', grafico: 'http://127.0.0.1:8001'});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('dal telefono si passa dal server, porta per porta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')(false);
      return {ordini: MT5_BRIDGE_URL, grafico: MT5_FEED_URL};
    }, CON_SERVER.toString());
    assert.equal(r.ordini, 'https://srv.tail1.ts.net:8000/pc/8000');
    assert.equal(r.grafico, 'https://srv.tail1.ts.net:8000/pc/8001');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza server non cambia niente: tutto sul computer', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      localStorage.removeItem('fbl_server_host'); localStorage.removeItem('fbl_server_chiave');
      fblPonteLocaleVivo = false;        // anche credendo che il ponte non ci sia
      fblAggiornaIndirizzi();
      return {ordini: MT5_BRIDGE_URL, grafico: MT5_FEED_URL};
    });
    assert.deepEqual(r, {ordini: 'http://127.0.0.1:8000', grafico: 'http://127.0.0.1:8001'});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('passando dal server si usa la chiave DEL SERVER, non quella del computer', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')(false);
      return {
        storico: fblConChiave(MT5_FEED_URL + '/history?symbol=EURUSD'),
        // I prezzi dal vivo viaggiano su un canale WebSocket: l'indirizzo comincia con wss://,
        // non con https://. Dimenticarlo vuol dire partire senza chiave e farsi rifiutare.
        dalVivo: fblConChiave(MT5_FEED_URL.replace(/^http/, 'ws') + '/ws/ticks/EURUSD')
      };
    }, CON_SERVER.toString());
    assert.equal(r.storico,
      'https://srv.tail1.ts.net:8000/pc/8001/history?symbol=EURUSD&chiave=K%261');
    assert.equal(r.dalVivo,
      'wss://srv.tail1.ts.net:8000/pc/8001/ws/ticks/EURUSD?chiave=K%261');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('sul computer non si attacca nessuna chiave: non serve a sé stessi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')(true);
      return fblConChiave(MT5_FEED_URL + '/history?symbol=EURUSD');
    }, CON_SERVER.toString());
    assert.equal(r, 'http://127.0.0.1:8001/history?symbol=EURUSD');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la pagina di prova dei segnali si apre dove sta davvero il ponte', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const out = {};
      localStorage.setItem('fbl_server_host', 'srv.tail1.ts.net');
      localStorage.setItem('fbl_server_chiave', 'K&1');
      out.colServer = tgUrlPaginaProva();
      localStorage.removeItem('fbl_server_host'); localStorage.removeItem('fbl_server_chiave');
      out.senzaServer = tgUrlPaginaProva();
      return out;
    });
    // Col server i segnali stanno lì, per tutti i dispositivi: anche dal computer.
    assert.equal(r.colServer, 'https://srv.tail1.ts.net:8769/prova?chiave=K%261');
    assert.equal(r.senzaServer, 'http://127.0.0.1:8769/prova');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
