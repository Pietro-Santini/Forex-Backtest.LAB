// NESSUNA POSIZIONE SI SELEZIONA DA SOLA, E IL DITO DESELEZIONA COME IL MOUSE.
//
// SEGNALATO dal proprietario: «da un momento all'altro, in maniera tutta casuale, viene
// visualizzata la singola operazione a grafico: è come se venisse selezionata e si vedono solo il
// suo prezzo di entrata, lo stop e il TP. Noi non abbiamo premuto niente, si preme da sola. Deve
// succedere SOLO se l'utente la clicca, altrimenti restano tutte visualizzate». E: «sul tablet e
// sul telefono, toccando il grafico in un punto vuoto col DITO non avviene la deselezione; me lo
// fa fare solo con la penna».
//
// LA CAUSA DEL PRIMO: `active` faceva due mestieri. È la posizione su cui lavorano le caselle
// SL/TP — e l'app la riassegna DA SOLA in cinque punti (cambio asset, chiusura di una posizione,
// ripristino di sessione, adozione dal conto MT5) — ed era ANCHE la posizione "scelta", quella che
// fa sparire le caselle di tutte le altre. Ogni riassegnazione automatica diventava così una
// selezione che l'utente non aveva mai fatto.
//
// LA CAUSA DEL SECONDO: il gestore di pointerup esce prima per `pointerType==='touch'`, e il
// blocco della deselezione stava dopo quell'uscita.
//
// Come si prova che i test servono: rimettendo `activeOnChart` su `active` il primo va rosso;
// togliendo la chiamata a fblClickSuVuoto nel ramo touch, il terzo va rosso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Due posizioni aperte sullo stesso asset, come dopo un segnale a due target.
const PREPARA = () => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++) R.push({date: new Date(t0 + i * 60000).toISOString(),
    open: 100, high: 100.8, low: 99.2, close: 100.2, volume: 5});
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD'; if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; mt5Connected = false; trades = []; drawings = [];
  positions = [
    {id: 'P1', asset: 'EURUSD', side: 'BUY', entry: 100, sl: 99.5, rrSl: 99.5, tp: 100.6,
     lots: 0.1, marginUsed: 10, start: 150, startTime: t0 + 150 * 60000},
    {id: 'P2', asset: 'EURUSD', side: 'BUY', entry: 100, sl: 99.5, rrSl: 99.5, tp: 100.9,
     lots: 0.1, marginUsed: 10, start: 150, startTime: t0 + 150 * 60000}
  ];
  active = null; posSelezionata = null;
  followLatest = false; viewPriceLo = 99; viewPriceHi = 101; priceZoomFactor = 1;
  draw();
};

// Quante posizioni vengono disegnate "spente" (in grigio). RICHIESTO dal proprietario: scelta una
// posizione, le altre NON spariscono piu' - restano le loro linee di stop e target con le etichette,
// in grigio e senza il riempimento colorato, cosi' si continua a vedere dove sono i livelli.
// Si conta quante volte il disegno usa il grigio dello "spento": zero quando non c'e' nessuna
// scelta, piu' di zero quando una posizione e' scelta e le altre vanno in grigio.
const GRIGIE = () => {
  const proto = CanvasRenderingContext2D.prototype;
  const originale = Object.getOwnPropertyDescriptor(proto, 'strokeStyle');
  let quante = 0;
  Object.defineProperty(proto, 'strokeStyle', {
    configurable: true,
    get(){ return originale.get.call(this); },
    set(v){ if (String(v) === TRADE_DIM_GREY) quante++; originale.set.call(this, v); }
  });
  try { draw(); } finally { Object.defineProperty(proto, 'strokeStyle', originale); }
  return quante;
};

test('se l-app riassegna «active» da sola, NON deve nascondere le altre posizioni', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((args) => {
      eval('(' + args.prep + ')')();
      const C = eval('(' + args.grigie + ')');
      const tutte = C();
      // E la riga che l-app esegue da sola in cinque punti (cambio asset, chiusura, ripristino):
      // `active = l-ultima posizione di questo asset`. Nessun clic dell-utente.
      active = positions[positions.length - 1];
      const dopoRiassegnazione = C();
      return {tutte, dopoRiassegnazione, scelta: posSelezionata};
    }, {prep: PREPARA.toString(), grigie: GRIGIE.toString()});
    assert.equal(r.tutte, 0, 'senza nessuna scelta nessuna posizione deve essere disegnata spenta');
    assert.equal(r.dopoRiassegnazione, 0,
      'una riassegnazione automatica di «active» non deve spegnere le altre posizioni');
    assert.equal(r.scelta, null, 'e non deve nemmeno contare come scelta dell utente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('cliccando DAVVERO una posizione, le altre vanno in grigio (non spariscono)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((args) => {
      eval('(' + args.prep + ')')();
      const C = eval('(' + args.grigie + ')');
      const tutte = C();
      focusPosition(positions[0]);          // e la strada di ogni clic dell utente
      const dopoClic = C();
      return {tutte, dopoClic, scelta: posSelezionata ? posSelezionata.id : null};
    }, {prep: PREPARA.toString(), grigie: GRIGIE.toString()});
    assert.equal(r.scelta, 'P1', 'il clic deve segnare la posizione scelta');
    assert.ok(r.dopoClic > r.tutte,
      'scelta una posizione, le altre devono essere disegnate in grigio (' + r.dopoClic + ' contro ' + r.tutte + ')');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il TOCCO su un punto vuoto deseleziona, come il mouse e la penna', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((args) => {
      eval('(' + args.prep + ')')();
      const C = eval('(' + args.grigie + ')');
      focusPosition(positions[0]);
      const conScelta = C();
      // Un tocco col DITO, fermo, su un angolo vuoto del grafico.
      const rc = chartEl.getBoundingClientRect();
      const opt = {pointerId: 11, pointerType: 'touch', button: 0, buttons: 1,
                   clientX: rc.left + rc.width * 0.5, clientY: rc.top + 8,
                   bubbles: true, cancelable: true};
      chartEl.dispatchEvent(new PointerEvent('pointerdown', opt));
      chartEl.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, opt, {buttons: 0})));
      const dopoTocco = C();
      return {conScelta, dopoTocco, scelta: posSelezionata};
    }, {prep: PREPARA.toString(), grigie: GRIGIE.toString()});
    assert.equal(r.scelta, null, 'col dito la deselezione deve avvenire: non succedeva, serviva la penna');
    assert.ok(r.conScelta > 0, 'con una posizione scelta le altre devono essere in grigio');
    assert.equal(r.dopoTocco, 0,
      'dopo il tocco sul vuoto nessuna posizione deve restare spenta: ' + r.dopoTocco);
    assert.deepEqual(errori.filter(x => !/PointerCapture/.test(x)), []);
  } finally { await browser.close(); }
});

test('il dito, la penna e il mouse fanno la stessa identica cosa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((args) => {
      const P = eval('(' + args.prep + ')'), C = eval('(' + args.grigie + ')');
      const prova = (tipo, id) => {
        P();
        focusPosition(positions[0]);
        const conScelta = C();
        const rc = chartEl.getBoundingClientRect();
        const opt = {pointerId: id, pointerType: tipo, button: 0, buttons: 1,
                     clientX: rc.left + rc.width * 0.5, clientY: rc.top + 8,
                     bubbles: true, cancelable: true};
        chartEl.dispatchEvent(new PointerEvent('pointerdown', opt));
        chartEl.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, opt, {buttons: 0})));
        return {conScelta, dopo: C(), scelta: posSelezionata};
      };
      return {dito: prova('touch', 21), penna: prova('pen', 22), mouse: prova('mouse', 23)};
    }, {prep: PREPARA.toString(), grigie: GRIGIE.toString()});
    ['dito', 'penna', 'mouse'].forEach(come => {
      assert.equal(r[come].scelta, null, 'col ' + come + ' la deselezione non e avvenuta');
      assert.ok(r[come].conScelta > 0, 'col ' + come + ' le altre dovevano essere in grigio');
      assert.equal(r[come].dopo, 0, 'col ' + come + ' i colori non sono tornati');
    });
    assert.deepEqual(errori.filter(x => !/PointerCapture/.test(x)), []);
  } finally { await browser.close(); }
});
