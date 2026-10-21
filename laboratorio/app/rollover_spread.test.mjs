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
//   3. non mettere il pareggio ESATTO, perché uno stop a pareggio sta dentro la forbice. Due di
//      quelle tre posizioni avevano lo stop a UN DECIMO DI PIP dall'entrata (0,92828 → 0,92827).
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

test('il pareggio non mette più lo stop a un decimo di pip dall\'entrata', async () => {
  // È il difetto misurato: SELL a 0,92828 con stop a 0,92827. Lo stop di una vendita si esegue
  // sull'ask: così sta DENTRO la forbice e al primo allargamento viene preso di sicuro.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const vendita = {asset: 'EURUSD', side: 'SELL', entry: 1.1000};
      const acquisto = {asset: 'EURUSD', side: 'BUY', entry: 1.1000};
      return {
        vendita: mt5PrezzoPareggio(vendita),
        acquisto: mt5PrezzoPareggio(acquisto),
        venditaNuda: mt5PrezzoPareggio(vendita, {senzaMargine: true}),
        spread: spreadCostForAsset('EURUSD')
      };
    }, PREPARA.toString());
    // Per una VENDITA lo stop sta SOPRA: il margine lo allontana ancora più su.
    assert.ok(r.vendita > 1.1000, 'per una vendita il pareggio va spostato in alto: ' + r.vendita);
    assert.ok(Math.abs((r.vendita - 1.1000) - r.spread) < 1e-9,
      'e di esattamente uno spread: ' + (r.vendita - 1.1000) + ' contro ' + r.spread);
    // Per un ACQUISTO sta SOTTO.
    assert.ok(r.acquisto < 1.1000, 'per un acquisto va spostato in basso: ' + r.acquisto);
    assert.ok(Math.abs((1.1000 - r.acquisto) - r.spread) < 1e-9);
    // Il numero nudo resta disponibile per chi deve MOSTRARLO, non per piazzarci uno stop.
    assert.ok(Math.abs(r.venditaNuda - 1.1000) < 1e-12, 'senza margine è il pareggio esatto');
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
