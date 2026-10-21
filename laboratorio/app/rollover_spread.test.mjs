// LO SPREAD DEL CAMBIO GIORNATA: misurarlo, avvisare, e non mettere lo stop dentro la forbice.
//
// I NUMERI VERI da cui nasce tutto, letti dal proprietario su MT5 (Simboli → Ticks), EURCHF,
// notte fra il 20 e il 21 ottobre 2026:
//
//   00:00:42.091   bid 0,92461   ask 0,92961   ->  50,0 pip   (spread normale: 0,2 pip)
//
// In quell'istante tre posizioni SELL con stop a 0,92827 sono state chiuse. Legittimamente: lo
// stop di una vendita si esegue sull'ASK, e l'ask era 0,92961. Il grafico, che disegna il BID,
// mostrava 0,92461 — cioè il movimento OPPOSTO.
//
// Tre cose da farci, tutte chieste dal proprietario:
//   1. AVVISARE prima della chiusura se uno stop sta dentro la forbice;
//   2. MISURARE quanto si apre la forbice, invece di indovinarlo (il dato passa davanti all'app
//      a ogni tick: basta guardarlo nel momento giusto);
//   3. NON piazzare lo stop di pareggio quando cadrebbe dentro la forbice. Due di quelle tre
//      posizioni avevano lo stop a UN DECIMO DI PIP dall'entrata (0,92828 → 0,92827), portate
//      li' proprio dal pareggio. Il prezzo del pareggio resta ESATTO - zero, non quasi zero:
//      il 21 ottobre era stato provato ad aggiungerci un margine pari allo spread, e il
//      proprietario ha misurato il risultato: «sposta le posizioni a break-even, ma perdono
//      ugualmente meno 2 euro». Un pareggio che perde non è un pareggio. Quindi: prezzo esatto,
//      e chi lo piazza si RIFIUTA quando non c'è spazio.
//
// NOTA sui test: si usa EURUSD e non EURCHF perché EURUSD è fra gli strumenti noti dell'app
// (pip 0,0001, spread tipico 0,6), quindi i numeri sono deterministici. Il pip di EURCHF è lo
// stesso, quindi i conti non cambiano.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = () => {
  liveModeActive = true;
  orariAsset = {EURUSD: {zona: 'UTC', giorni: {
    mon: ['00:00 - 21:59'], tue: ['00:00 - 21:59'], wed: ['00:00 - 21:59'],
    thu: ['00:00 - 21:59'], fri: ['00:00 - 21:59']}, letto: Date.now()}};
  window.CHIUSURA = Date.UTC(2026, 9, 20, 21, 59, 0);   // martedì
  fblSpreadRoll = {};
  fblAvvisoChiusuraFatto = {};
  try { localStorage.removeItem('fbl_spread_rollover'); } catch(e) {}
};

// ============================ 2. MISURARE LA FORBICE ============================

test('lo spread si misura nella mezz\'ora prima della chiusura, e non fuori', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      // Lontano dalla chiusura: non si registra niente, anche se lo spread è enorme.
      fblSpreadRolloverOsserva('EURUSD', 1.1000, 1.1050, window.CHIUSURA - 3 * 3600000);
      const lontano = fblSpreadRoll.EURUSD || null;
      // Dentro la mezz'ora: si registra. 0,0050 di differenza = 50 pip, come quella notte.
      fblSpreadRolloverOsserva('EURUSD', 1.1000, 1.1050, window.CHIUSURA - 10 * 60000);
      return {lontano, vicino: fblSpreadRoll.EURUSD};
    }, PREPARA.toString());
    assert.equal(r.lontano, null, 'fuori dalla finestra non è spread di rollover: è spread e basta');
    assert.ok(r.vicino, 'dentro la mezz\'ora si deve registrare');
    assert.equal(r.vicino.pips, 50, 'bid 1,1000 e ask 1,1050 fanno 50 pip');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('si tiene il PEGGIO visto, non l\'ultimo', async () => {
  // Serve a dire «il tuo stop è dentro la forbice»: la forbice che conta è quella larga.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const t = window.CHIUSURA - 10 * 60000;
      fblSpreadRolloverOsserva('EURUSD', 1.1000, 1.1050, t);        // 50 pip
      fblSpreadRolloverOsserva('EURUSD', 1.1000, 1.1003, t + 1000); // 3 pip: non deve cancellare
      const dopoPiccolo = fblSpreadRoll.EURUSD.pips;
      fblSpreadRolloverOsserva('EURUSD', 1.1000, 1.1080, t + 2000); // 80: questo sì
      return {dopoPiccolo, dopoGrande: fblSpreadRoll.EURUSD.pips};
    }, PREPARA.toString());
    assert.equal(r.dopoPiccolo, 50, 'uno spread più stretto non cancella il peggio già visto');
    assert.equal(r.dopoGrande, 80, 'uno più largo sì');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('finché non si è visto un rollover si usa una stima DICHIARATA, non un numero a caso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const stima = fblSpreadRolloverPips('EURUSD');       // niente misurato
      fblSpreadRolloverOsserva('EURUSD', 1.1000, 1.1050, window.CHIUSURA - 60000);
      return {stima, misurato: fblSpreadRolloverPips('EURUSD'), tipico: typicalSpreadPipsForAsset('EURUSD')};
    }, PREPARA.toString());
    assert.ok(r.stima >= 10, 'la stima non scende sotto i 10 pip: ' + r.stima);
    assert.ok(r.stima > r.tipico * 5, 'e non è lo spread normale: ' + r.stima + ' contro ' + r.tipico);
    assert.equal(r.misurato, 50, 'appena si misura un rollover vero, vince la misura');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ============================ 3. IL PAREGGIO LASCIA LO SPREAD ============================

test('il pareggio è ZERO: al prezzo del pareggio il risultato netto è 0,00', async () => {
  // RICHIESTO dal proprietario dopo aver visto il margine in azione: «bisogna fare in modo che
  // qualsiasi posizione viene spostata a break-even venga accertata che allo spostamento sia
  // effettivamente il risultato di 0 euro, cioè quindi a break-even».
  //
  // Qui il conto si fa come lo fa il conto vero: distanza dal prezzo × valore del punto, più le
  // commissioni di ANDATA E RITORNO e lo swap già maturato. Se il numero non torna zero, il
  // pulsante mente sul proprio nome.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      // Una posizione vera sul conto: 3 di commissione per lato, 2 di swap già pagato.
      mt5RealPositions = [{ticket: 77, valore_punto: 10000, commission: -3, swap: -2,
                           point: 0.00001, digits: 5}];
      const vera = {asset: 'EURUSD', side: 'BUY', entry: 1.1000, mt5Ticket: 77};
      const veraSell = {asset: 'EURUSD', side: 'SELL', entry: 1.1000, mt5Ticket: 77};
      const netto = (pos, prezzo) => {
        const d = (pos.side === 'BUY') ? (prezzo - pos.entry) : (pos.entry - prezzo);
        return d * 10000 + (2 * -3) + (-2);
      };
      const be = mt5PrezzoPareggio(vera), beS = mt5PrezzoPareggio(veraSell);
      return {
        be, beS, netto: netto(vera, be), nettoS: netto(veraSell, beS),
        unTick: 0.00001 * 10000,
        // Una posizione simulata ha già lo spread dentro l'entrata: il pareggio è l'entrata.
        simulata: mt5PrezzoPareggio({asset: 'EURUSD', side: 'SELL', entry: 1.1000})
      };
    }, PREPARA.toString());
    // Zero, e mai sotto zero: l'arrotondamento al tick va dalla parte di chi ha la posizione.
    assert.ok(r.netto >= -1e-9, 'un pareggio che perde non è un pareggio: ' + r.netto);
    assert.ok(r.netto < r.unTick, 'e nemmeno un guadagno travestito: ' + r.netto);
    assert.ok(r.nettoS >= -1e-9, 'anche in vendita: ' + r.nettoS);
    assert.ok(r.nettoS < r.unTick, 'anche in vendita: ' + r.nettoS);
    assert.ok(Math.abs(r.simulata - 1.1000) < 1e-12,
      "sulla simulata il pareggio è l'entrata: " + r.simulata);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ma non si piazza se cadrebbe dentro la forbice: è il caso EURCHF', async () => {
  // La protezione si è spostata qui, dove non costa niente a chi è in pari: il prezzo resta
  // esatto, e lo stop non si muove affatto quando starebbe a un decimo di pip dal prezzo. Lo stop
  // di prima è più lontano, quindi lasciarlo dov'è protegge di più che spostarlo.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      currentAssetKey = 'XXXYYY';                 // il prezzo si legge da livePriceByAsset
      livePriceByAsset = {EURUSD: 1.10000};
      fblSpreadRoll = {};                         // nessun rollover ancora misurato: stima dichiarata
      const vicina = {asset: 'EURUSD', side: 'SELL', entry: 1.10001};   // un decimo di pip sopra
      const lontana = {asset: 'EURUSD', side: 'SELL', entry: 1.10500};  // cinquanta pip sopra
      return {
        vicina: fblPareggioTroppoVicino(vicina, mt5PrezzoPareggio(vicina)),
        lontana: fblPareggioTroppoVicino(lontana, mt5PrezzoPareggio(lontana)),
        // Senza un prezzo non si sa, e non sapere non deve bloccare niente.
        ignota: fblPareggioTroppoVicino({asset: 'ZZZ', side: 'BUY', entry: 1}, 1)
      };
    }, PREPARA.toString());
    assert.equal(r.vicina.vicino, true,
      'un pareggio a un decimo di pip dal prezzo deve essere rifiutato: ' + JSON.stringify(r.vicina));
    assert.ok(r.vicina.forbice > r.vicina.distanza,
      'e il motivo deve essere misurato, non detto: ' + JSON.stringify(r.vicina));
    assert.equal(r.lontana.vicino, false,
      'un pareggio a cinquanta pip si piazza come sempre: ' + JSON.stringify(r.lontana));
    assert.equal(r.ignota.vicino, false, 'senza prezzo non si blocca niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il pulsante vero: sposta quando ci sta, e quando non ci sta NON tocca lo stop', async () => {
  // LA DIFFERENZA CHE CONTA: una funzione giusta che nessuno chiama non corregge niente. Qui si
  // chiama applyBreakevenToPosition, cioè esattamente ciò che fa il pulsante, e si guarda il
  // campo sl dopo. Il modo in cui questa correzione potrebbe fallire sul serio è proprio questo:
  // un rifiuto che però lo stop lo sposta comunque, e nessuno se ne accorge finché non arriva il
  // cambio giornata.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const t0 = Date.now() - 100 * 60000;
      const R = [];
      for (let i = 0; i < 100; i++) R.push({date: new Date(t0 + i * 60000).toISOString(),
        open: 1.1, high: 1.1004, low: 1.0997, close: 1.1, volume: 5});
      rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
      currentAssetKey = 'XXXYYY';                  // il prezzo si legge da livePriceByAsset
      if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'XXXYYY';
      livePriceByAsset = {EURUSD: 1.10000};
      trades = []; active = null;

      const vicina  = {id: 'V', asset: 'EURUSD', side: 'SELL', entry: 1.10001, sl: 1.10500, lots: 0.1};
      const lontana = {id: 'L', asset: 'EURUSD', side: 'SELL', entry: 1.10500, sl: 1.11000, lots: 0.1};
      positions = [vicina, lontana];

      applyBreakevenToPosition(vicina);
      const statoVicina = document.getElementById('status').textContent;
      applyBreakevenToPosition(lontana);
      return {
        slVicina: vicina.sl, marcataVicina: vicina.beMarkerSl == null,
        statoVicina,
        slLontana: lontana.sl, marcataLontana: lontana.beMarkerSl
      };
    }, PREPARA.toString());
    // Il rifiuto: lo stop resta dov'era (1,10500), più lontano del pareggio.
    assert.equal(r.slVicina, 1.10500,
      'rifiutato il pareggio, lo stop di prima non si tocca: trovato ' + r.slVicina);
    assert.equal(r.marcataVicina, true,
      'e la posizione non va marcata come «a pareggio»: nel Journal direbbe il falso');
    assert.match(r.statoVicina, /NON spostato/,
      'e lo si deve DIRE, altrimenti si crede di essere protetti: ' + r.statoVicina);
    assert.match(r.statoVicina, /forbice/, 'con il motivo: ' + r.statoVicina);
    // Il caso normale continua a funzionare: cinquanta pip di spazio, pareggio esatto.
    assert.equal(r.slLontana, 1.10500, "con spazio, lo stop va sul pareggio esatto (l'entrata)");
    assert.equal(r.marcataLontana, 1.10500, 'e il Journal la riconosce come BE');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ============================ 1. L'AVVISO ============================

const PREPARA_AVVISO = () => {
  liveModeActive = true;
  orariAsset = {EURUSD: {zona: 'UTC', giorni: {
    mon: ['00:00 - 21:59'], tue: ['00:00 - 21:59'], wed: ['00:00 - 21:59'],
    thu: ['00:00 - 21:59'], fri: ['00:00 - 21:59']}, letto: Date.now()}};
  window.CHIUSURA = Date.UTC(2026, 9, 20, 21, 59, 0);
  fblSpreadRoll = {EURUSD: {pips: 50, il: Date.now()}};   // misurato: 50 pip, come quella notte
  fblAvvisoChiusuraFatto = {};
  window.fblPrezzoChiusura = () => 1.1000;
  // Stop a 10 pip: dentro una forbice da 50. È il caso della posizione che ha perso 439 euro.
  positions = [{id: 'P1', asset: 'EURUSD', side: 'SELL', entry: 1.0990, sl: 1.1010, lots: 1}];
  window._avvisi = [];
  const st = document.getElementById('status');
  if (st) Object.defineProperty(st, 'textContent', {
    set(v) { window._avvisi.push(String(v)); }, get() { return ''; }, configurable: true});
};

test('un quarto d\'ora prima avvisa, se c\'è uno stop dentro la forbice', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const detti = fblAvvisoChiusuraGiro(window.CHIUSURA - 10 * 60000);
      return {detti, avvisi: window._avvisi};
    }, PREPARA_AVVISO.toString());
    assert.equal(r.detti, 1, 'deve avvisare');
    const msg = r.avvisi.find(a => /chiude il mercato/i.test(a)) || '';
    assert.match(msg, /EURUSD/, 'deve dire quale asset: ' + msg);
    assert.match(msg, /50 pip misurati/, 'e che la forbice è MISURATA, non stimata: ' + msg);
    assert.match(msg, /prezzo di acquisto/i, 'e perché succede: ' + msg);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('non martella: una volta sola per ogni chiusura', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const primo = fblAvvisoChiusuraGiro(window.CHIUSURA - 10 * 60000);
      const secondo = fblAvvisoChiusuraGiro(window.CHIUSURA - 9 * 60000);
      const terzo = fblAvvisoChiusuraGiro(window.CHIUSURA - 60000);
      return {primo, secondo, terzo};
    }, PREPARA_AVVISO.toString());
    assert.equal(r.primo, 1);
    assert.equal(r.secondo, 0, 'già detto per questa chiusura');
    assert.equal(r.terzo, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('uno stop LONTANO dalla forbice non fa suonare niente', async () => {
  // Altrimenti l'avviso diventa rumore e si smette di leggerlo.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      positions[0].sl = 1.1300;          // 300 pip sopra: la forbice da 50 non ci arriva
      const detti = fblAvvisoChiusuraGiro(window.CHIUSURA - 10 * 60000);
      return {detti};
    }, PREPARA_AVVISO.toString());
    assert.equal(r.detti, 0, 'uno stop a 300 pip non rischia niente dal rollover');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('lontano dalla chiusura, in Storico e senza posizioni: silenzio', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const presto = fblAvvisoChiusuraGiro(window.CHIUSURA - 3 * 3600000);
      fblAvvisoChiusuraFatto = {};
      liveModeActive = false;
      const storico = fblAvvisoChiusuraGiro(window.CHIUSURA - 10 * 60000);
      liveModeActive = true;
      positions = [];
      const senzaPosizioni = fblAvvisoChiusuraGiro(window.CHIUSURA - 10 * 60000);
      return {presto, storico, senzaPosizioni};
    }, PREPARA_AVVISO.toString());
    assert.equal(r.presto, 0, 'tre ore prima non è «prima della chiusura»');
    assert.equal(r.storico, 0, 'in Storico non c\'è niente da proteggere');
    assert.equal(r.senzaPosizioni, 0, 'senza posizioni non c\'è niente da perdere');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
