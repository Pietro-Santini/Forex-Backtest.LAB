// LO STRUMENTO PER MISURARE IL RALLENTAMENTO, SULLA MACCHINA VERA.
//
// SEGNALATO dal proprietario: «appena installato il pacchetto il programma era fluidissimo, zero
// freeze, tre schede aperte senza problemi, aggiornamento del grafico perfetto. Dopo un po'
// incominciava a calare le prestazioni e a dare problemi di velocita'».
//
// QUELL'INDIZIO VALE PIU' DI OGNI ALTRO, e cambia dove si cerca: una cosa che parte veloce e
// peggiora NON e' un costo fisso (sarebbe lenta subito) - e' qualcosa che si ACCUMULA.
//
// PERCHE' LO STRUMENTO STA NELL'APP E NON QUI. Nel banco si e' misurato tutto il misurabile, e
// NON spiega il rallentamento:
//   - ricostruire i bucket del footprint col registro tick pieno al massimo (150.000 tick,
//     che e' il tetto): 28 ms. Cresce, ma non blocca;
//   - update() e draw() con 5.000 operazioni e 30 posizioni: 3,7 ms e 6,4 ms (da 0,2 e 0,9 a
//     app vuota). Crescono, ma non bloccano.
// Il difetto vive dove il banco non arriva - il flusso dati dal vivo, che i test bloccano apposta
// per non toccare il ponte del proprietario. Quindi lo strumento va dove vive il difetto, e il
// banco si limita a garantire che lo strumento funzioni e non faccia danni.
//
// LE TRE COSE CHE QUESTI TEST TENGONO FERME, perche' sono i modi in cui una misura fa danno:
//   1. restituisce NUMERI, non impressioni;
//   2. rimette a posto tutto quello che ha toccato (se restassero avvolti setTimeout, draw e
//      update, la misura stessa diventerebbe la causa del rallentamento successivo);
//   3. non inventa: quello che non si sa resta null.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('la misura restituisce numeri, non impressioni', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => await fblMisuraPrestazioni(1));
    assert.ok(r.secondi >= 1, 'deve dire quanto e\' durata: ' + r.secondi);
    assert.ok(typeof r.risvegliAlSecondo === 'number',
      'i risvegli al secondo sono il numero che ha trovato la causa del 21 ottobre');
    assert.ok(typeof r.fotogrammiAlSecondo === 'number' && r.fotogrammiAlSecondo > 0,
      'i fotogrammi al secondo: ' + r.fotogrammiAlSecondo);
    assert.ok(typeof r.scatti === 'number', 'gli scatti sono quello che si VEDE');
    assert.ok(typeof r.tickFootprint === 'number',
      'e le memorie che crescono usando l\'app, che sono le indiziate numero uno');
    assert.ok(typeof r.operazioni === 'number');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('rimette a posto tutto: la misura non deve diventare la causa', async () => {
  // Il modo piu' facile di fare danno con uno strumento di misura: lasciare avvolte le funzioni
  // che ha strumentato. Da quel momento OGNI disegno e OGNI timer pagherebbero il costo della
  // misura, per sempre - e il rallentamento peggiorerebbe proprio dopo averlo misurato.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      // Anche i PEZZI del disegno, che lo strumento avvolge per dire quale costa: se restassero
      // avvolti, ogni singola candela del footprint pagherebbe per sempre il costo della misura.
      const PEZZI = ['drawClosedTradeMarkers', 'fblCronoDisegna', 'krakenDisegnaGrafico',
                     'drawFootprintCandle', 'drawTpSlZoneBox'];
      const primaPezzi = {};
      PEZZI.forEach(n => { if (typeof window[n] === 'function') primaPezzi[n] = window[n]; });
      const prima = {st: window.setTimeout, si: window.setInterval, d: window.draw, u: window.update};
      await fblMisuraPrestazioni(1);
      const pezziTornati = Object.keys(primaPezzi).filter(n => window[n] !== primaPezzi[n]);
      return {
        timeout: window.setTimeout === prima.st,
        interval: window.setInterval === prima.si,
        draw: window.draw === prima.d,
        update: window.update === prima.u,
        quantiPezzi: Object.keys(primaPezzi).length,
        pezziNonTornati: pezziTornati
      };
    });
    assert.ok(r.quantiPezzi > 0, 'il test deve trovarne almeno uno, altrimenti non verifica niente');
    assert.deepEqual(r.pezziNonTornati, [],
      'questi pezzi del disegno sono rimasti avvolti dopo la misura: ' + JSON.stringify(r.pezziNonTornati));
    assert.deepEqual({timeout: r.timeout, interval: r.interval, draw: r.draw, update: r.update},
      {timeout: true, interval: true, draw: true, update: true},
      'setTimeout, setInterval, draw e update devono tornare esattamente quelli di prima');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('due misure di fila si possono fare, ed e\' il punto', async () => {
  // L'uso previsto: una misura quando va bene, una quando va lenta. Se la seconda non partisse,
  // o riportasse i numeri della prima, lo strumento non servirebbe a niente.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const a = await fblMisuraPrestazioni(1);
      const b = await fblMisuraPrestazioni(1);
      return {a: a.quando, b: b.quando, disegniA: a.disegni, disegniB: b.disegni,
              ultima: window.fblUltimaMisuraPrestazioni ? window.fblUltimaMisuraPrestazioni.secondi : null};
    });
    assert.ok(r.ultima >= 1, 'l\'ultima misura resta a disposizione');
    assert.equal(typeof r.disegniB, 'number', 'la seconda misura conta per conto suo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('quello che non si sa resta vuoto, non diventa zero', async () => {
  // La memoria JS non e' disponibile su tutti i browser: dire "0 MB" sarebbe un dato falso.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const vera = performance.memory;
      try {
        Object.defineProperty(performance, 'memory', {configurable: true, get(){ return undefined; }});
        const m = await fblMisuraPrestazioni(1);
        return {memoria: m.memoria_MB};
      } finally {
        try { Object.defineProperty(performance, 'memory', {configurable: true, value: vera}); } catch(e) {}
      }
    });
    assert.equal(r.memoria, null, 'senza il dato si scrive null, non 0');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una misura presa a vuoto lo dice, invece di sembrare una vittoria', async () => {
  // SUCCESSO DAVVERO il 22 ottobre: una misura con il grafico vuoto ha dato 88 fotogrammi al
  // secondo e zero scatti, e sembrava che il rallentamento fosse sparito. Non si era disegnato
  // niente. Una misura presa a vuoto non dice che va tutto bene: dice che non c'era niente da
  // fare - e confonderle fa smettere di cercare proprio quando si era sulla strada giusta.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      rows = []; baseRows = [];
      const vuota = await fblMisuraPrestazioni(1);
      return {avviso: vuota.ATTENZIONE || null, candele: vuota.candele};
    });
    assert.equal(r.candele, 0, 'si parte da un grafico vuoto');
    assert.ok(r.avviso, 'con il grafico vuoto la misura deve avvisare, non tacere');
    assert.match(r.avviso, /VUOTO/,
      'e deve dire PERCHE\' non vale: ' + r.avviso);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
