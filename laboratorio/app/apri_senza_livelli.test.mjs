// I SEGNALI SENZA STOP O SENZA TARGET SI APRONO SOLO SE LO DECIDI TU.
//
// RICHIESTO dal proprietario: «dobbiamo avere all'interno delle impostazioni dell'apertura
// automatica dei tasti che attivano o disattivano la posizione senza stop della sala, stessa cosa
// per il take profit».
//
// Prima la risposta era «sempre sì, calcolandoli»: lo stop lo ricavava dal rischio dedicato, il
// target da una percentuale della distanza dello stop. Sono due invenzioni dell'app, non due
// numeri della sala — e chi non le voleva se ne accorgeva a posizione aperta.
//
// I due interruttori valgono SOLO per l'apertura automatica: a mano ogni segnale si configura
// come si vuole, ed è una scelta cosciente. Il confine è quello già in uso per il rischio
// dedicato: automatico = la percentuale arriva dalla sala (pctForzata valorizzata).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Oro a 4100. Il segnale arriva con o senza stop, con o senza target; la percentuale passata
// come terzo argomento è quella della sala, cioè "siamo in automatico".
const OPZ = `{prezzo:4100, saldo:10000, entroRischio:true}`;

test('predefinito: si apre anche senza stop e senza target, come ha sempre fatto', async () => {
  // La garanzia che accendendo questa funzione nessuno smetta di aprire segnali che prima apriva.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      const A = tgAutoVuoto();
      ({apreSenzaSl: tgApreSenzaSl(A), apreSenzaTp: tgApreSenzaTp(A),
        // anche una configurazione vecchia, salvata prima che questi campi esistessero
        vecchiaSl: tgApreSenzaSl({maxGlobali:40}), vecchiaTp: tgApreSenzaTp({maxGlobali:40})})
    }`);
    assert.equal(r.apreSenzaSl, true);
    assert.equal(r.apreSenzaTp, true);
    assert.equal(r.vecchiaSl, true, 'una configurazione salvata prima non deve cambiare comportamento');
    assert.equal(r.vecchiaTp, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('interruttore spento: il segnale senza stop non si apre, e dice perché', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      tgAutoFx.apriSenzaSl = false;
      // Nessuno stop dalla sala, ma un target sì.
      const p = tgPiano({direzione:'BUY', take_profit:[4150]}, 'XAUUSD', 1, ${OPZ});
      ({problemi: p.problemi || null, lotti: p.lotti})
    }`);
    assert.ok(r.problemi && r.problemi.length, 'deve rifiutare');
    assert.match(r.problemi[0], /non ha dato lo stop loss/);
    assert.match(r.problemi[0], /valutare a mano/, 'deve dire dove finisce il segnale');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('interruttore spento: il segnale senza target non si apre, e dice perché', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      tgAutoFx.apriSenzaTp = false;
      // Lo stop c'è, i target no.
      const p = tgPiano({direzione:'BUY', stop_loss:4080}, 'XAUUSD', 1, ${OPZ});
      ({problemi: p.problemi || null})
    }`);
    assert.ok(r.problemi && r.problemi.length, 'deve rifiutare');
    assert.match(r.problemi[0], /nessun take profit/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('spegnere uno non spegne l\'altro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      tgAutoFx.apriSenzaSl = false; tgAutoFx.apriSenzaTp = true;
      // Senza stop: rifiutato. Senza target (ma con stop): aperto lo stesso.
      const senzaSl = tgPiano({direzione:'BUY', take_profit:[4150]}, 'XAUUSD', 1, ${OPZ});
      const senzaTp = tgPiano({direzione:'BUY', stop_loss:4080}, 'XAUUSD', 1, ${OPZ});
      ({slRifiutato: !!(senzaSl.problemi||[]).length,
        tpAperto: !(senzaTp.problemi||[]).length,
        tpCalcolato: !!senzaTp.tpCalcolato})
    }`);
    assert.equal(r.slRifiutato, true);
    assert.equal(r.tpAperto, true, 'il target mancante resta permesso: gli interruttori sono due');
    assert.equal(r.tpCalcolato, true, 'e il target se lo calcola l\'app, come prima');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('a mano gli interruttori non c\'entrano: si configura quello che si vuole', async () => {
  // Senza la percentuale della sala (pctForzata) NON siamo in automatico: è l'utente che sta
  // configurando un segnale a mano, e lì decide lui.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      tgAutoFx.apriSenzaSl = false; tgAutoFx.apriSenzaTp = false;
      const p = tgPiano({direzione:'BUY', take_profit:[4150]}, 'XAUUSD', undefined, ${OPZ});
      ({problemi: (p.problemi||[]).length, slCalcolato: !!p.slCalcolato})
    }`);
    assert.equal(r.problemi, 0, 'a mano non si rifiuta niente: gli interruttori sono dell\'automatico');
    assert.equal(r.slCalcolato, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
