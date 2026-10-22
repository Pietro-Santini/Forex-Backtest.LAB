// STRISCE DI VICINANZA NELLE LISTE POSIZIONI.
//
// CHIESTO dal proprietario: «nella lista delle posizioni, sia di Kraken che di MT5, una striscia
// verticale a destra della riga: verde quando e' vicina al take profit, rossa quando e' vicina
// allo stop, azzurra per lo stop a profitto. La percentuale la decido io e posso spegnerle. Come
// l'app di MT5 per telefono, che le mette a sinistra: qui a destra».
//
// DA DOVE SI MISURA LA VICINANZA - e' il punto che decide se la striscia dice qualcosa o no:
//  - TAKE PROFIT e STOP LOSS si misurano DALL'ENTRATA. La distanza totale e' entrata->livello, e
//    si e' vicini quando ne resta meno della percentuale scelta. Misurarla dal prezzo di adesso
//    darebbe una striscia sempre accesa appena aperta la posizione, quando il prezzo e' ancora
//    sull'entrata: cioe' un indicatore che non indica niente;
//  - lo STOP A PROFITTO si misura DALL'ULTIMO TARGET RAGGIUNTO, perche' quello e' il punto da cui
//    si sta tornando indietro. Dall'entrata non direbbe niente: lo stop a profitto sta gia' oltre
//    l'entrata per definizione, quindi risulterebbe "vicino" sempre.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Un BUY con entrata 100 e stop 90: la distanza e' 10. Al 10% si e' vicini sotto 91.
const CASO = {side: 'BUY', entry: 100, sl: 90, tp: 120};

test('la striscia si accende quando il prezzo e\' davvero vicino, non prima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((c) => {
      const el = document.getElementById('fblStriscePos'); if (el) el.checked = true;
      const n = document.getElementById('fblStriscePct'); if (n) n.value = '10';
      const q = (prezzo) => { const s = fblStrisciaPosizione({...c, prezzo}); return s ? s.colore : null; };
      return {
        appenaAperta: q(100),      // sull'entrata: lontana da tutto
        aMeta: q(95),              // meta' strada verso lo stop: ancora lontana
        vicinoStop: q(90.5),       // dentro il 10% dallo stop
        oltreStop: q(89),          // gia' oltre: la striscia resta accesa
        vicinoTp: q(118.5),        // dentro il 10% dal target
        aMetaSuTp: q(110)          // meta' strada verso il target: lontana
      };
    }, CASO);
    assert.equal(r.appenaAperta, null, 'appena aperta non deve accendersi niente');
    assert.equal(r.aMeta, null, 'a meta\' strada nemmeno');
    assert.equal(r.vicinoStop, '#e05252', 'vicino allo stop: rossa');
    assert.equal(r.oltreStop, '#e05252', 'oltre lo stop: resta rossa');
    assert.equal(r.vicinoTp, '#2fbf71', 'vicino al target: verde');
    assert.equal(r.aMetaSuTp, null, 'a meta\' strada verso il target: niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('lo stop a profitto e\' azzurro e si misura dall\'ultimo target raggiunto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const el = document.getElementById('fblStriscePos'); if (el) el.checked = true;
      const n = document.getElementById('fblStriscePct'); if (n) n.value = '10';
      // BUY entrato a 100, primo target raggiunto a 120, stop portato a 110 (in profitto).
      const base = {side: 'BUY', entry: 100, sl: 110, tp: 140, ultimoTp: 120};
      return {
        appenaOltre: fblStrisciaPosizione({...base, prezzo: 119}),   // 1 su 10 dal target: vicino allo stop? no
        vicino: fblStrisciaPosizione({...base, prezzo: 110.8}),      // quasi sullo stop a profitto
        lontano: fblStrisciaPosizione({...base, prezzo: 118})        // ancora lontano dallo stop
      };
    });
    assert.equal(r.vicino && r.vicino.colore, '#4bb3e8', 'vicino allo stop a profitto: azzurra');
    assert.match(r.vicino.titolo, /ultimo target/, 'e il suggerimento deve dire da dove si misura');
    assert.equal(r.lontano, null, 'lontano dallo stop a profitto: niente striscia');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('spegnendole non compare piu\' niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((c) => {
      const el = document.getElementById('fblStriscePos');
      el.checked = false;
      const spenta = fblStrisciaPosizione({...c, prezzo: 90.2});
      el.checked = true;
      const accesa = fblStrisciaPosizione({...c, prezzo: 90.2});
      return {spenta, accesa: accesa && accesa.colore};
    }, CASO);
    assert.equal(r.spenta, null, 'spente vuol dire spente');
    assert.equal(r.accesa, '#e05252', 'e riaccese tornano');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la percentuale scelta cambia davvero quando si accende', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((c) => {
      document.getElementById('fblStriscePos').checked = true;
      const con = (pct, prezzo) => {
        document.getElementById('fblStriscePct').value = String(pct);
        const s = fblStrisciaPosizione({...c, prezzo});
        return s ? s.colore : null;
      };
      return {stretta: con(2, 94), larga: con(50, 94)};
    }, CASO);
    assert.equal(r.stretta, null, 'al 2% un prezzo a meta\' strada non e\' vicino');
    assert.equal(r.larga, '#e05252', 'al 50% invece si');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza i dati non si inventa una striscia', async () => {
  // Meglio nessuna striscia che una che dice una cosa a caso: una posizione senza stop, o senza
  // prezzo, non puo' essere "vicina" a niente.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      document.getElementById('fblStriscePos').checked = true;
      return {
        senzaPrezzo: fblStrisciaPosizione({side: 'BUY', entry: 100, sl: 90, tp: 120}),
        senzaLivelli: fblStrisciaPosizione({side: 'BUY', entry: 100, prezzo: 100}),
        senzaNiente: fblStrisciaPosizione(null)
      };
    });
    assert.equal(r.senzaPrezzo, null);
    assert.equal(r.senzaLivelli, null);
    assert.equal(r.senzaNiente, null);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le due tabelle restano gemelle: la striscia e\' l\'ultima colonna in tutte e due', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // Non tutte le tabelle con classe `posTable` sono tabelle di POSIZIONI: la stessa classe
      // la usa anche quella degli ORDINI PENDENTI, che giustamente non ha la striscia - un ordine
      // non ancora aperto non puo' essere vicino al suo stop. Si riconoscono dalla colonna
      // «P/L live», che solo una posizione aperta puo' avere.
      const teste = [...document.querySelectorAll('table.posTable thead tr')]
        .filter(t => /P\/L live/.test(t.textContent || ''));
      return teste.map(t => {
        const ult = t.lastElementChild;
        return !!(ult && ult.classList.contains('fblStrisciaCella'));
      });
    });
    assert.ok(r.length >= 2, 'devono esserci almeno due tabelle posizioni: ' + r.length);
    assert.ok(r.every(Boolean),
      'in ogni tabella delle posizioni l\'ultima colonna deve essere quella della striscia: '
      + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
