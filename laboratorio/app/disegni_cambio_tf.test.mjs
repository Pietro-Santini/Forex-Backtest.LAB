// AL CAMBIO TIME FRAME I DISEGNI RESTANO ESATTAMENTE DOVE ERANO.
//
// SEGNALATO dal proprietario (26 ottobre 2026): «i disegni devono rispettare sempre la stessa
// identica posizione ... non è possibile che ogni volta che cambia time frame si spostano».
//
// STORIA del difetto: gli ancoraggi dei disegni sono a TEMPO reale (ms) + prezzo. Il vecchio
// rimedio (fblDisegniRiAgganciaAlTf) spostava ogni punto al timestamp della candela del TF
// nuovo più vicina: 10:07 diventava 10:05 o 10:10, e il disegno VISIVAMENTE slittava di quasi
// una candela intera a ogni cambio TF — proprio il difetto che il rimedio voleva curare.
//
// LA CURA DEFINITIVA: i disegni mantengono il loro timestamp ASSOLUTO (p.time non viene mai
// toccato). dataPosFromTime() li mappa già correttamente nella serie del nuovo TF: 10:07 a TF 5m
// cade DENTRO la candela 10:05-10:10, alla stessa posizione relativa (2/5 della candela), quindi
// la punta resta visivamente dov'era. Qui si misura: stessi timestamp prima e dopo il cambio TF
// vero (attraverso il listener di #tf), stessi prezzi, e la posizione frazionaria coerente
// (7 minuti dall'inizio = 1.4 bucket da 5 minuti).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('cambio TF: i disegni non si spostano (timestamp e prezzi immutati)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // Storico M1: 40 candele da 10:00 a 10:39 (tempo aperta candela = t), listo a 100.
      const t0 = Date.UTC(2026, 0, 5, 10, 0);
      const R = [];
      for (let k = 0; k < 40; k++){
        const t = t0 + k * 60000;
        R.push({date: new Date(t).toISOString(), open: 100, high: 101, low: 99, close: 100, volume: 1});
      }
      rows = R; baseRows = R; currentTF = 1; idx = 10; viewEnd = R.length - 1;
      masterTime = Date.parse(R[10].date);
      // Un trend a mano: punta A sull'apertura della candela 7 (10:07), punta B sulla 17 (10:17).
      drawings = [{tipo: 'trend', p1: {time: Date.parse(R[7].date), price: 100}, p2: {time: Date.parse(R[17].date), price: 101}}];
      const prima = JSON.parse(JSON.stringify(drawings[0]));
      // Cambio TF VERO dal controllo del grafico (attraverso il listener di #tf)
      $('tf').value = '5';
      $('tf').dispatchEvent(new Event('change'));
      const dopo = {p1: {time: drawings[0].p1.time, price: drawings[0].p1.price},
                    p2: {time: drawings[0].p2.time, price: drawings[0].p2.price}};
      // La posizione VISIVA: il timestamp assoluto del disegno cade DENTRO la candela del nuovo
      // TF che lo contiene, alla stessa frazione di prima. 10:07 a TF 5m sta tra la candela che
      // apre 10:05 (indice 1) e quella che apre 10:10 (indice 2), al 40% (2 minuti su 5).
      const ts = getRowsTimestamps();
      let indiceCandela = -1, frazione = 0;
      for (let i = 0; i < ts.length - 1; i++) {
        if (dopo.p1.time >= ts[i] && dopo.p1.time < ts[i + 1]) {
          indiceCandela = i;
          frazione = (dopo.p1.time - ts[i]) / (ts[i + 1] - ts[i]);
          break;
        }
      }
      return {
        prima, dopo,
        candele5m: rows.length,
        tempoInvariato: dopo.p1.time === prima.p1.time && dopo.p2.time === prima.p2.time,
        prezziOk: dopo.p1.price === 100 && dopo.p2.price === 101,
        indiceCandela,
        frazione,
      };
    });
    assert.ok(r.candele5m === 8, '40 candele M1 diventano 8 candele da 5m: ' + JSON.stringify({c: r.candele5m}));
    assert.ok(r.tempoInvariato, 'I TIMESTAMP NON SI TOCCANO: ' + JSON.stringify({prima: r.prima, dopo: r.dopo}));
    assert.ok(r.prezziOk, 'i prezzi delle ancore restano immutati: ' + JSON.stringify(r));
    // La posizione visiva è coerente: 10:07 cade nella candela 5m che apre alle 10:05 (indice 1),
    // al 40% dentro (2 minuti su 5). Nessuno slittamento: la punta resta dov'era.
    assert.equal(r.indiceCandela, 1, '10:07 cade nella candela 5m che apre 10:05 (indice 1): ' + JSON.stringify(r));
    assert.ok(Math.abs(r.frazione - 0.4) < 0.01, 'e al 40% dentro quella candela (2 min su 5): ' + JSON.stringify(r));
    assert.equal(errori.length, 0, 'errori console: ' + errori.join(' | '));
  } finally { await browser.close(); }
});

test('CON PROVA DI CONTROLLO: il timestamp resta 10:07 anche a TF 5m (mai agganciato alle candele)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const t0 = Date.UTC(2026, 0, 5, 10, 0);
      const R = [];
      for (let k = 0; k < 40; k++){
        const t = t0 + k * 60000;
        R.push({date: new Date(t).toISOString(), open: 100, high: 101, low: 99, close: 100, volume: 1});
      }
      rows = R; baseRows = R; currentTF = 1; idx = 10; viewEnd = R.length - 1;
      masterTime = Date.parse(R[10].date);
      drawings = [{tipo: 'trend', p1: {time: Date.parse(R[7].date), price: 100}}];
      // Cambio TF: solo rebuildRows, senza nessuna riscrittura dei timestamp.
      currentTF = 5; rebuildRows();
      const setOff = new Set(getRowsTimestamps());
      return {p1: drawings[0].p1, allineata: setOff.has(drawings[0].p1.time)};
    });
    // 10:07 NON è apertura di una candela 5m (le aperture sono 10:00, 10:05, 10:10...): e va
    // bene così — il disegno resta al suo istante assoluto, visualizzato DENTRO la candela
    // che lo contiene da dataPosFromTime, senza mai slittare alle candele vicine.
    assert.ok(!r.allineata, 'il timestamp resta il suo, non viene agganciato alle aperture 5m: ' + JSON.stringify(r));
    assert.ok(r.p1.time === Date.parse(new Date(Date.UTC(2026, 0, 5, 10, 7)).toISOString()),
      'l\'istante del disegno resta 10:07: ' + JSON.stringify(r));
    assert.equal(errori.length, 0, 'errori console: ' + errori.join(' | '));
  } finally { await browser.close(); }
});
