// AL CAMBIO TIME FRAME I DISEGNI RESTANO SULLE LORO CANDELE.
//
// SEGNALATO dal proprietario: «cambio Time Frame e le forme (trend, quadrati, linee) slittano».
//
// LA CAUSA (misurata): gli ancoraggi dei disegni sono a TEMPO reale (ms) + prezzo. Cambiando TF
// le candele diventano bucket aggregati M1→5m/15m/1H con orario = inizio bucket: un'ancora
// all'istante di apertura di una candela M1 (es. 10:07) nel TF nuovo (5m) non e' l'apertura di
// NESSUNA candela (i bucket sono 10:05, 10:10…): la punta slitta in mezzo alla candela, fino a
// quasi una larghezza intera, e l'inclinazione si riscrive.
//
// LA CURA: al cambio TF ogni punto si riaggrappa alla candela del TF attuale piu' vicina
// (fblDisegniRiAgganciaAlTf), l'aggancio che aveva al momento del disegno. La chiamano SOLO i
// veri cambi TF: il listener di #tf in storico, e i percorsi Live (Capital/MT5/Binance) quando
// ricevono opts.tfChangeSpanMinutes. PROVA DI CONTROLLO: senza cura la punta 10:07 NON e'
// un'apertura di candela 5m — qui sotto si misura proprio prima (non allineata) e dopo
// (allineata), e che l'aiuto non tocchi niente quando non serve (idempotente, e a TF 1 immobile).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('cambio TF: le ancore dei disegni cadono su candele del nuovo TF, prezzi immutati', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // Storico M1: 40 candele da 10:00 a 10:38 (tempo aperta candela = t), listo a 100.
      const t0 = Date.UTC(2026, 0, 5, 10, 0);
      const R = [];
      for (let k = 0; k < 40; k++){
        const t = t0 + k * 60000;
        R.push({date: new Date(t).toISOString(), open: 100, high: 101, low: 99, close: 100, volume: 1});
      }
      rows = R; baseRows = R; currentTF = 1; idx = 10; viewEnd = R.length - 1;
      masterTime = Date.parse(R[10].date);
      // Un trend a mano: punta A sull'apertura della candela 7 (10:07: M1, NON bucket 5m),
      // punta B sull'apertura della candela 17 (10:17). Prezzi che il riaggancio non tocca.
      drawings = [{tipo: 'trend', p1: {time: Date.parse(R[7].date), price: 100}, p2: {time: Date.parse(R[17].date), price: 101}}];
      const prima = JSON.parse(JSON.stringify(drawings[0]));
      // come sta dopo il riaggancio a TF 1: un'ancora M1 e' gia' apertura di candela M1: non move.
      fblDisegniRiAgganciaAlTf();
      const aTf1 = JSON.parse(JSON.stringify(drawings[0]));
      // CAMBIO TF VERO dal controllo del grafico (attraverso il listener di #tf)
      $('tf').value = '5';
      $('tf').dispatchEvent(new Event('change'));
      const tempi = getRowsTimestamps();
      const setOff = new Set(tempi);
      const dopo = {p1: drawings[0].p1, p2: drawings[0].p2};
      return {
        prima,
        aTf1,
        dopo,
        candele5m: rows.length,
        allineate: setOff,
        p1allineata: setOff.has(dopo.p1.time),
        p2allineata: setOff.has(dopo.p2.time),
        p1primaAllineata: setOff.has(prima.p1.time),
        prezziOk: dopo.p1.price === 100 && dopo.p2.price === 101,
        aggrappate: JSON.stringify([aTf1.p1.time, aTf1.p2.time]) === JSON.stringify([prima.p1.time, prima.p2.time])
      };
    });
    assert.ok(r.aggrappate, 'a TF 1 le ancore M1 sono gia\' su candele: non si toccano: ' + JSON.stringify(r));
    assert.ok(r.candele5m === 8, '40 candele M1 diventano 8 candele da 5m: ' + JSON.stringify({c: r.candele5m}));
    assert.ok(!r.p1primaAllineata, 'IL DIFETTO, misurato: 10:07 NON e\' apertura di una candela 5m: ' + JSON.stringify(r));
    assert.ok(r.p1allineata && r.p2allineata, 'DOPO il cambio TF entrambe le punte stanno su candele 5m: ' + JSON.stringify(r));
    assert.equal(r.prima.p1.price, r.dopo.p1.price, 'il prezzo delle ancore non si tocca: ' + JSON.stringify(r));
    assert.equal(r.prima.p2.price, r.dopo.p2.price, 'il prezzo delle ancore (B) non si tocca: ' + JSON.stringify(r));
    assert.equal(errori.length, 0, 'errori console: ' + errori.join(' | '));
  } finally { await browser.close(); }
});

test('CON PROVA DI CONTROLLO: senza il riaggancio la punta resta staccata dalle candele 5m', async () => {
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
      // Cambio TF SENZA cura: solo rebuildRows (esattamente una cura sbagliata o assente).
      currentTF = 5; rebuildRows();
      const setOff = new Set(getRowsTimestamps());
      return {p1: drawings[0].p1, allineata: setOff.has(drawings[0].p1.time)};
    });
    assert.ok(!r.allineata, 'senza cura 10:07 resta NON apertura di candela 5m (il difetto): ' + JSON.stringify(r));
    assert.ok(r.p1.time === Date.parse(new Date(Date.UTC(2026, 0, 5, 10, 7)).toISOString()),
      'l\'istante del difetto resta 10:07: ' + JSON.stringify(r));
    assert.equal(errori.length, 0, 'errori console: ' + errori.join(' | '));
  } finally { await browser.close(); }
});
