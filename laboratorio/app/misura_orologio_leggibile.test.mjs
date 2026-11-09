// LA RIGA DEGLI OROLOGI DEVE LEGGERSI, NON USCIRE "[object Object]".
//
// SEGNALATO dal proprietario (7 novembre 2026): «orologio non c'e'». Il campo C'ERA, ma il
// rendering lo stampava come "[object Object]" - una riga che non si legge e non si copia,
// cioe' inutile: senza quei numeri non si puo' curare la chiusura del mercato (decisa
// sull'orologio sbagliato: MT5 va avanti anche di un'ora rispetto al dispositivo).
//
// Il test misura il COMPORTAMENTO: apre la pagina, fa la misura, e guarda che nel testo
// consegnato all'utente ci siano i numeri degli orologi, non un oggetto anonimo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('nella misura la riga degli orologi si legge (non [object Object])', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay').forEach(el => el.style.display = 'none'));
    // Misura corta: non e' la durata che si prova, e' come viene reso il risultato.
    const r = await pagina.evaluate(async () => {
      rows = []; baseRows = []; currentAssetKey = 'XAUUSD';
      for (let i = 0; i < 30; i++) {
        rows.push({date: new Date(Date.now() - (30 - i) * 60000).toISOString(), open: 4000, high: 4001, low: 3999, close: 4000, volume: 1});
      }
      baseRows = rows.slice(); idx = rows.length - 1; viewEnd = rows.length;
      liveModeActive = true; mt5Connected = false;
      csvLibrary = [{id: 'x', rows}];
      await fblMisuraPrestazioni(1);
      const pre = document.getElementById('fblPrestOut');
      return {testo: pre ? pre.textContent : '', oggetto: window.fblUltimaMisuraPrestazioni || null};
    });
    assert.ok(r.oggetto && typeof r.oggetto === 'object', 'la misura deve restituire un oggetto');
    assert.ok(r.oggetto.orologio, 'deve esserci il campo orologio: ' + Object.keys(r.oggetto).join(', '));
    assert.ok(r.testo.indexOf('[object Object]') < 0,
      'nessun valore deve uscire come [object Object]: ' + r.testo.slice(0, 400));
    // La riga degli orologi, con i suoi pezzi, deve essere nel testo copiabile.
    assert.ok(/orologio\s*:\s*\{/.test(r.testo),
      'la riga orologio deve aprirsi in coppie chiave=valore: ' + r.testo.slice(0, 600));
    assert.ok(r.testo.indexOf('dispositivo=') >= 0, 'deve dirci l\'ora del dispositivo');
    assert.ok(r.testo.indexOf('fase=') >= 0, 'e la fase calcolata della sessione');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
