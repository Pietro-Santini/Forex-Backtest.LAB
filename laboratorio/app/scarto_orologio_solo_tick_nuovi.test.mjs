// LO SCARTO DELL'OROLOGIO NON SI SPORCA CON I TICK VECCHI (21 novembre 2026).
//
// SEGNALATO dal proprietario: a mercato chiuso il tempo scorre comunque, e l'ultima candela porta
// un orario che non esiste (XAU/USD: 23:50 di venerdi' sul terminale, 03:19 di sabato sull'app).
//
// CHE COS'E' QUESTO SCARTO. Il servizio dati manda i tick GIA' in UTC (mt5_feed_server.py applica
// lui l'orario del broker, vedi "time_ms": ... - offset). Quindi qui non si misura il fuso del
// broker: si misura l'orologio del SERVIZIO rispetto a quello di QUESTO dispositivo - e il servizio
// gira sullo stesso PC. La differenza vera e' di secondi, mai di ore.
//
// I DUE DIFETTI MISURATI, tutti e due da tick fermi:
//   1. l'ultimo tick si segnava a ogni messaggio, anche quando il ponte ripeteva lo stesso tick;
//   2. un tick vecchio fino a SEI ORE veniva preso per differenza di orologio, e la sua eta'
//      finiva addosso a ogni conto sul tempo.
// E' lo stesso difetto del servizio (vedi _SCARTO_MINIMO_PLAUSIBILE in mt5_feed_server.py).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('tick ripetuti e finestra vuota non cambiano lo scarto dell\'orologio', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      mt5ScartoOrologioMs = 0; mt5ScartiOrologio = []; mt5UltimoOrarioTickNuovo = -Infinity;
      const ora = Date.now();
      const tick = ora + 30000;             // differenza vera: mezzo minuto
      mt5RegistraOrarioTick(tick);
      const dopoNuovo = mt5ScartoOrologioMs;
      // lo stesso tick ripetuto (il ponte lo rimanda a mercato chiuso): non cambia niente
      mt5ScartiOrologio = [];
      mt5RegistraOrarioTick(tick);
      mt5RegistraOrarioTick(tick);
      const dopoRipetuti = mt5ScartoOrologioMs;
      // finestra vuota e un tick piu' vecchio: lo scarto gia' stimato resta
      mt5ScartiOrologio = [];
      mt5RegistraOrarioTick(tick - 60000);
      return {dopoNuovo, dopoRipetuti, dopoVecchio: mt5ScartoOrologioMs};
    });
    assert.ok(Math.abs(r.dopoNuovo - 30000) < 2000, 'il tick nuovo misura i 30 s: ' + JSON.stringify(r));
    assert.equal(r.dopoRipetuti, r.dopoNuovo, 'tick ripetuti non cambiano lo scarto: ' + JSON.stringify(r));
    assert.equal(r.dopoVecchio, r.dopoNuovo, 'un tick piu\' vecchio non cambia lo scarto: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un tick vecchio di ore non diventa uno scarto di orologio', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      mt5ScartoOrologioMs = 0; mt5ScartiOrologio = []; mt5UltimoOrarioTickNuovo = -Infinity;
      const ora = Date.now();
      // Il caso misurato sul servizio: un tick fermo da 4 ore e mezza. Non e' un orologio diverso.
      mt5RegistraOrarioTick(ora - 4.5 * 3600000);
      const dopoVecchio = mt5ScartoOrologioMs;
      mt5ScartiOrologio = []; mt5UltimoOrarioTickNuovo = -Infinity;
      mt5RegistraOrarioTick(ora + 30000);
      return {dopoVecchio, dopoVero: mt5ScartoOrologioMs};
    });
    assert.equal(r.dopoVecchio, 0, 'un tick di 4 ore e mezza non deve spostare l\'orologio: ' + JSON.stringify(r));
    assert.ok(Math.abs(r.dopoVero - 30000) < 2000, 'una differenza vera di 30 s si misura ancora: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
