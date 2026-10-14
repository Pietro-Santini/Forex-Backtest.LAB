// FOOTPRINT: UNA SOLA SCALA, E LE RIGHE SOLO A FIANCO DELLA CANDELA.
//
// SEGNALATO dal proprietario con una foto: "ci sono più livelli di footprint, mentre invece deve
// esserci soltanto un livello. È tutto sparpagliato... il footprint, gli istogrammi devono essere
// visualizzati soltanto a fianco alla candela e non sopra, sotto".
//
// Due cause distinte, tutt'e due vere:
//  1) le righe nascono dai TICK e possono cadere FUORI dall'alta/bassa della candela disegnata
//     (candele dall'OHLC del broker, tick dal feed; e l'arrotondamento al passo sposta fino a
//     mezza riga). Finché si rifaceva la griglia dentro ogni candela venivano schiacciate dentro
//     per forza; con la scala uniforme vanno riportate dentro sommandole alla riga di bordo —
//     riportate, non buttate, altrimenti si perde volume vero;
//  2) ogni bucket si porta dietro il passo con cui è stato costruito (bucket.step) e il disegno
//     usava QUELLO: due candele costruite con passi diversi — dopo un cambio del passo automatico,
//     e sempre con le celle aggregate che arrivano dal backup cloud di un altro dispositivo —
//     finivano sullo stesso grafico con righe alte in modo diverso. È esattamente il "più livelli"
//     della segnalazione: la scala uniforme saltava.
//
// Come si prova che i test servono: togliendo la chiamata a footprintDentroLaCandela in
// drawFootprintCandle, il primo e il terzo test vanno rossi.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Somma di un campo su tutte le righe: serve a provare che riportando le righe dentro la candela
// non si perde niente.
const SOMMA = `(fp, campo) => Object.values(fp.rows).reduce((s, c) => s + (Number(c[campo]) || 0), 0)`;

test('una riga sopra l\'alta della candela viene riportata dentro, non buttata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((somma) => {
      const S = eval(somma);
      // Passo 1, livelli interi: la candela va da 100 a 103, ma due righe stanno fuori (97 e 106).
      const fp = {step: 1, rows: {}};
      [97, 100, 101, 102, 103, 106].forEach((lv, i) => { fp.rows[lv] = {buy: 10, sell: 5, askVol: 10, bidVol: 5, trades: 1}; });
      const candela = {open: 100, close: 103, high: 103, low: 100};
      const out = footprintDentroLaCandela(fp, candela, 1);
      const liv = Object.keys(out.rows).map(Number).sort((a, b) => a - b);
      return {liv, volPrima: S(fp, 'buy') + S(fp, 'sell'), volDopo: S(out, 'buy') + S(out, 'sell'),
              bordoBasso: out.rows[100], bordoAlto: out.rows[103]};
    }, SOMMA);
    assert.deepEqual(r.liv, [100, 101, 102, 103], 'nessuna riga puo\' stare sopra o sotto la candela');
    assert.equal(r.volDopo, r.volPrima, 'il volume delle righe fuori non si perde: si somma al bordo');
    assert.equal(r.bordoBasso.buy, 20, 'la riga sotto (97) si somma alla prima riga della candela');
    assert.equal(r.bordoAlto.buy, 20, 'la riga sopra (106) si somma all\'ultima riga della candela');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un bucket costruito con un passo DIVERSO torna sulla griglia globale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((somma) => {
      const S = eval(somma);
      // Bucket vecchio a passo 0,5 (es. celle aggregate arrivate dal cloud di un altro
      // dispositivo); il grafico adesso lavora a passo 1.
      const fp = {step: 0.5, rows: {}};
      [100, 100.5, 101, 101.5, 102].forEach(lv => { fp.rows[lv] = {buy: 4, sell: 2, askVol: 4, bidVol: 2, trades: 1}; });
      const candela = {open: 100, close: 102, high: 102, low: 100};
      const out = footprintDentroLaCandela(fp, candela, 1);
      return {passo: out.step, liv: Object.keys(out.rows).map(Number).sort((a, b) => a - b),
              volPrima: S(fp, 'buy'), volDopo: S(out, 'buy')};
    }, SOMMA);
    assert.equal(r.passo, 1, 'il passo del disegno e\' quello GLOBALE, non quello del bucket');
    assert.deepEqual(r.liv, [100, 101, 102], 'le righe si riaggregano sulla griglia globale');
    assert.equal(r.volDopo, r.volPrima, 'riaggregando non si perde volume');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un bucket gia\' a posto non viene nemmeno copiato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const fp = {step: 1, rows: {100: {buy: 1, sell: 1}, 101: {buy: 1, sell: 1}}};
      const candela = {open: 100, close: 101, high: 101, low: 100};
      return footprintDentroLaCandela(fp, candela, 1) === fp;
    });
    assert.equal(r, true, 'nel caso normale (passo giusto, righe dentro) si deve tornare lo stesso oggetto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('disegnando, nessuna casella finisce piu\' di mezza riga fuori dalla candela', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const fp = {step: 1, rows: {}};
      [95, 100, 101, 102, 103, 109].forEach(lv => { fp.rows[lv] = {buy: 8, sell: 6, askVol: 8, bidVol: 6, trades: 2}; });
      const candela = {open: 100, close: 103, high: 103, low: 100, volume: 10};
      const scala = 20;                       // 20 px per unita' di prezzo
      const yFn = p => 600 - (p - 100) * scala;
      const ctx = document.createElement('canvas').getContext('2d');
      const proto = CanvasRenderingContext2D.prototype, vFR = proto.fillRect;
      const rects = [];
      proto.fillRect = function (x, y, w, h) { rects.push({y, h}); return vFR.apply(this, arguments); };
      drawFootprintCandle(ctx, candela, 300, 40, yFn, fp, '#ffffff', 'bidask',
        {up: '#26a69a', down: '#ef5350', passo: 40, stepGlobale: 1});
      proto.fillRect = vFR;
      // Mezza riga di tolleranza sopra e sotto: la griglia e' a passo intero, il bordo della prima
      // e dell'ultima riga cade per forza a meta' passo oltre l'alta e la bassa.
      const limiteAlto = yFn(103 + 0.5), limiteBasso = yFn(100 - 0.5);
      const fuori = rects.filter(q => q.y < limiteAlto - 0.6 || (q.y + q.h) > limiteBasso + 0.6);
      return {quante: rects.length, fuori: fuori.length, limiteAlto, limiteBasso};
    });
    assert.ok(r.quante > 0, 'qualcosa deve pur essere stato disegnato');
    assert.equal(r.fuori, 0, 'nessuna casella sopra o sotto la candela: ne sono uscite ' + r.fuori);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ====================== IL FOOTPRINT VIVE ANCHE IN REPLAY ======================
// RICHIESTO: "anche in modalità replay si deve vedere il footprint che viene ricalcolato e avanza
// aggiornamento dopo aggiornamento". Le righe della candela in formazione vanno sulla STESSA
// griglia globale delle candele vere, con le stesse celle: così si disegnano con lo stesso
// disegnatore (drawFootprintCandle) invece che con un istogramma tutto loro.
test('in replay la candela in formazione accumula righe sulla griglia globale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // Percorso sintetico che sale da 100 a 103: 12 secondi di formazione, passo di riga 0,5.
      const path = [];
      for (let i = 0; i <= 12; i++) path.push(100 + i * 0.25);
      const f = {idx: 1, sub: 1, path, fp: {step: 0.5, rows: {}}, vol: 120};
      const tappe = [];
      for (let s = 1; s <= 12; s++) {
        f.sub = s;
        replaySubAccumulo(f);
        tappe.push(Object.keys(f.fp.rows).length);
      }
      const liv = Object.keys(f.fp.rows).map(Number).sort((a, b) => a - b);
      const fuoriGriglia = liv.filter(v => Math.abs(v / 0.5 - Math.round(v / 0.5)) > 1e-9);
      const cella = f.fp.rows[liv[0]];
      return {tappe, liv, fuoriGriglia, cella};
    });
    assert.ok(r.tappe[r.tappe.length - 1] > r.tappe[0],
      'le righe devono CRESCERE aggiornamento dopo aggiornamento: ' + JSON.stringify(r.tappe));
    assert.deepEqual(r.fuoriGriglia, [], 'ogni riga deve cadere sulla griglia globale: ' + JSON.stringify(r.liv));
    assert.ok(r.cella && typeof r.cella.askVol === 'number' && typeof r.cella.trades === 'number',
      'le celle devono avere la stessa forma di quelle vere (askVol/bidVol/trades), non un numero secco');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza un passo noto la formazione non inventa righe', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const f = {idx: 1, sub: 1, path: [100, 100.5, 101], fp: {step: 0, rows: {}}, vol: 60};
      replaySubAccumulo(f);
      return Object.keys(f.fp.rows).length;
    });
    assert.equal(r, 0, 'senza passo non si accumula niente: la candela resta una candela semplice');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
