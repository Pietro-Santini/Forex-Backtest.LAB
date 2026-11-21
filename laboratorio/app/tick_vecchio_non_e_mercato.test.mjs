// UN TICK VECCHIO NON E' IL MERCATO APERTO (21 novembre 2026, sabato).
//
// SEGNALATO dal proprietario: a mercato chiuso il tempo scorre comunque e il grafico crea candele.
// CAUSA: l'«ultimo tick» si segnava con l'ora di ARRIVO sul PC. Un prezzo fermo che il ponte
// rimanda con il suo vecchio orario sembrava vivo. Ora conta l'orario del tick.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('un tick con orario vecchio di ore non risulta come mercato vivo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const ora = mt5Adesso();
      return {
        vecchio: mt5TickAt(ora - 3 * 3600000),   // tick di tre ore fa: mercato chiuso
        fresco: mt5TickAt(ora - 10000),           // tick di dieci secondi fa: mercato aperto
        senzaOrario: mt5TickAt(undefined) > 0      // senza orario: comportamento di prima
      };
    });
    assert.equal(r.vecchio, 0, 'un tick di tre ore fa non deve contare come mercato aperto');
    assert.ok(r.fresco > 0, 'un tick di dieci secondi fa deve contare');
    assert.equal(r.senzaOrario, true, 'senza orario del tick resta il comportamento precedente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
