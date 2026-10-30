// GLI ORDINI PENDENTI CREATI IN REPLAY: sessione giusta, simbolo, e visibili a grafico.
//
// RICHIESTO dal proprietario (30 ottobre 2026): "attenzione, in modalita' replay, quando siamo
// collegati a un conto MT5, quando vado a creare quello che e' un ordine limite, un ordine
// pendente, me lo mette nella casella ordini pendenti, ma prima di tutto non deve essere
// sessione live, ma deve risultare quella che e' sessione storico. E ci mettiamo anche a fianco
// quello che e' replay. Ci indica praticamente un simboletto che sara' una nuova sessione. Al
// trade journal e a tutto il resto, dove faremo vedere che quella operazione e' stata aperta in
// modalita' storico, ma con la modalita' replay. E dobbiamo visualizzare quello che e' l'entry,
// il TP e stop loss degli ordini pendenti che creiamo in modalita' replay."
//
// TRE MISURE, e la terza e' quella che non si vedeva:
//   1. la sessione mostrata e' STORICO, non Live (misurato: in replay currentMode() vale 'live');
//   2. a fianco c'e' il simbolino del replay, scritto una volta sola per tutte le tabelle;
//   3. l'ordine SI DISEGNA a grafico, con entrata, stop e target. Misurato il perche' non si
//      vedeva: il filtro del replay confrontava createdAt (che e' Date.now(), cioe' ADESSO) con
//      masterTime (il punto del replay, nel PASSATO): l'ordine appena creato era "nel futuro" e
//      veniva nascosto. Il suo storico era nato in replay (campo historical), che adesso lo
//      fa passare.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = () => {
  liveModeActive = true;
  mt5Connected = true;
  liveReplayActive = true;               // siamo in replay
  currentAssetKey = 'EURUSD';
  rows = [{t: Date.now(), o: 1, h: 2, l: 0.5, c: 1.5, v: 1}];
  idx = 0;
  $('market').value = 'EURUSD';
  $('pendingEntry').value = '0.99000';
  $('slPending').value = '0.98000';
  $('tpPending').value = '1.00000';
};

test('in replay l\'ordine pendente e\' di sessione STORICO col simbolo del replay, non Live', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      // il modo con cui si sta guardando e' live (misurato): e' quello che NON deve uscire
      const modoVero = currentMode();
      createPendingOrder('BUY');
      const o = pendingOrders[pendingOrders.length - 1];
      return {
        modoVero,
        sessioneMostrata: fblSessioneMostrata(o, currentMode()),
        etichettaBadge: fblReplayBadge(o),
        natoInReplay: fblNatoInReplay(o),
        // i livelli che dobbiamo poter vedere
        livelli: {entry: o.entry, sl: o.sl, tp: o.tp}
      };
    }, PREPARA.toString());
    // PROVA CHE CONTA: il modo vero e' live, ma la riga non deve dirlo.
    assert.equal(r.modoVero, 'live', 'in replay il modo con cui si guarda e\' live: e\' il punto');
    assert.equal(r.sessioneMostrata, 'backtest',
      'la sessione MOSTRATA deve essere Storico: in replay non e\' un ordine vero sul conto');
    assert.match(r.etichettaBadge, /REPLAY/, 'a fianco deve esserci il simbolino del replay');
    assert.ok(r.natoInReplay, 'l\'ordine deve sapere di essere nato in replay');
    // I livelli ci sono, con tutti i numeri.
    assert.equal(r.livelli.entry, 0.99, 'l\'entrata deve esserci');
    assert.equal(r.livelli.sl, 0.98, 'lo stop loss deve esserci');
    assert.equal(r.livelli.tp, 1, 'il take profit deve esserci');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: fuori dal replay la sessione resta quella vera, senza simboli', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      const prep = eval('(' + p + ')');
      prep();
      liveReplayActive = false;          // stessa identica cosa, fuori dal replay
      createPendingOrder('SELL');
      const o = pendingOrders[pendingOrders.length - 1];
      return {
        natoInReplay: fblNatoInReplay(o),
        sessioneMostrata: fblSessioneMostrata(o, currentMode()),
        etichettaBadge: fblReplayBadge(o)
      };
    }, PREPARA.toString());
    // Se il marchio comparisse anche qui, non distinguerebbe piu' niente: servirebbe a dire
    // "questo viene dal replay" e invece direbbe "tutto viene dal replay".
    assert.equal(r.natoInReplay, false, 'creato fuori dal replay non e\' nato in replay');
    assert.equal(r.sessioneMostrata, 'live', 'e la sessione resta quella vera');
    assert.equal(r.etichettaBadge, '', 'e nessun simbolo replay a fianco');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('a grafico l\'ordine nato in replay SI VEDE (era nascosto dal confronto con il punto di replay)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      createPendingOrder('BUY');
      const o = pendingOrders[pendingOrders.length - 1];
      // Il punto del replay: ieri. createdAt dell'ordine e' Date.now(), cioe' DOMANI rispetto
      // a masterTime. E' esattamente il caso che lo nascondeva.
      const ieri = Date.now() - 24 * 3600 * 1000;
      const ct = Number(o.createdAt);
      const confrontoVecchio = ct <= ieri + 60000;      // la regola di prima
      const confrontoNuovo = fblNatoInReplay(o);        // la regola di adesso
      return {ct, masterTime: ieri, confrontoVecchio, confrontoNuovo};
    }, PREPARA.toString());
    // LA FIRMA DEL DIFETTO: con la regola di prima l'ordine era "nel futuro" e non si vedeva.
    assert.equal(r.confrontoVecchio, false,
      'col confronto vecchio l\'ordine nato in replay risultava nel futuro: non si vedeva');
    // Con la regola di adesso si vede, perche' porta con se' il suo storico.
    assert.equal(r.confrontoNuovo, true, 'adesso l\'ordine nato in replay passa il filtro');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
