// PASSO 22 — due interruttori più fini del "posizioni" e del "linee posizioni": uno spegne SOLO
// le linee tra la freccia di apertura e quella di chiusura, l'altro SOLO le orizzontali di prezzo
// (apertura e chiusura). Le linee TP/SL, le frecce e le caselle colorate non devono essere toccate.
// Prima della correzione questi due interruttori NON esistevano: il test falliva.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('due interruttori separano le linee apertura/chiusura dalle linee di prezzo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const ag = document.getElementById('toggleConnettoriBtn');
      const lp = document.getElementById('toggleLineePrezzoBtn');
      const sel = '#chartSettingsModalOverlay [data-settings-panel="style"] ';
      const partenza = {conn: fblConnettoriVisibili(), prez: fblLineePrezzoVisibili(), linee: fblLineePosVisibili(), etic: fblEtichetteTpSlVisibili()};
      // Spegni SOLO i connettori, poi riaccendi.
      ag.click();
      const dopoConn = {conn: fblConnettoriVisibili(), prez: fblLineePrezzoVisibili(), linee: fblLineePosVisibili()};
      ag.click();
      // Spegni SOLO le linee di prezzo, poi riaccendi.
      lp.click();
      const dopoPrez = {conn: fblConnettoriVisibili(), prez: fblLineePrezzoVisibili(), linee: fblLineePosVisibili(), etic: fblEtichetteTpSlVisibili()};
      lp.click();
      return {
        ag: !!ag, lp: !!lp,
        inStyle: !!document.querySelector(sel + '#toggleConnettoriBtn'),
        inStyle2: !!document.querySelector(sel + '#toggleLineePrezzoBtn'),
        partenza, dopoConn, dopoPrez,
        tornato: {conn: fblConnettoriVisibili(), prez: fblLineePrezzoVisibili()},
        sync: ('fbl_connettori' in GRAFICO_LS) && ('fbl_linee_prezzo' in GRAFICO_LS)
      };
    });
    assert.equal(r.ag, true, 'esiste il pulsante delle linee apertura/chiusura');
    assert.equal(r.lp, true, 'esiste il pulsante delle linee di prezzo');
    assert.equal(r.inStyle && r.inStyle2, true, 'i due interruttori stanno nelle impostazioni dello stile');
    assert.deepEqual(r.partenza, {conn:true, prez:true, linee:true, etic:true}, 'di base si vede tutto');
    assert.equal(r.dopoConn.conn, false, 'il primo pulsante spegne le linee apertura/chiusura');
    assert.equal(r.dopoConn.prez, true, 'e NON tocca le linee di prezzo');
    assert.equal(r.dopoConn.linee, true, 'e NON spegne le linee posizioni (quindi neanche le TP/SL)');
    assert.equal(r.dopoPrez.prez, false, 'il secondo pulsante spegne le linee di prezzo');
    assert.equal(r.dopoPrez.conn, true, 'e NON tocca i connettori');
    assert.equal(r.dopoPrez.linee, true, 'e NON spegne le linee posizioni (quindi neanche le TP/SL)');
    assert.equal(r.dopoPrez.etic, true, 'né le etichette Target/Stop');
    assert.deepEqual(r.tornato, {conn:true, prez:true}, 'ripremendo si torna indietro');
    assert.equal(r.sync, true, 'le due scelte si sincronizzano fra i dispositivi');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
