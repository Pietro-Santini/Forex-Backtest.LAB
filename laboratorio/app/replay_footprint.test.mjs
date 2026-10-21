// IL FOOTPRINT IN REPLAY: quello che si forma non deve sparire quando la candela si chiude.
//
// SEGNALATO dal proprietario fra i «due pezzi grossi» (insieme al comportamento a mercato chiuso,
// chiuso in v157). Non era mai stato affrontato.
//
// MISURATO il 21 ottobre, e non era un difetto di disegno: era scritto nel codice, e il commento
// lo diceva pure — «la candela e' completata: il buffer delta della formazione finita va perso».
// Il buffer veniva azzerato (replayForm=null) senza che nessuno lo depositasse da nessuna parte.
// Da fuori: mentre la candela si forma il footprint cresce e si vede, e nell'istante in cui la
// candela diventa vera sparisce.
//
// NOTA SUL DIARIO, perché serve a chi legge: la voce del 19 ottobre dichiarava una funzione
// `replayFinalizzaFootprint` che copiava il footprint in `rows[idx].footprint`. Quella funzione
// nel file NON c'era. Una voce di diario non è una prova che una cosa esista: lo è un test.
//
// LA REGOLA ADESSO: il footprint della candela completata si deposita nella STESSA memoria delle
// candele vere (footprintByBucket), con la stessa griglia e le stesse celle — e si SOMMA a quello
// che c'è già, perché in replay-Live i tick veri continuano ad arrivare e sovrascriverli
// vorrebbe dire buttare dati veri per metterci quelli ricostruiti.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Venti candele da un minuto su EURUSD, con volume: serve volume, altrimenti non c'è footprint
// da accumulare e il test misurerebbe zero contro zero.
const PREPARA = () => {
  const t0 = Date.UTC(2026, 9, 20, 10, 0, 0);
  const R = [];
  for (let i = 0; i < 20; i++) {
    const o = 1.1000 + i * 0.0001;
    R.push({date: new Date(t0 + i * 60000).toISOString(),
            open: o, high: o + 0.0004, low: o - 0.0003, close: o + 0.0002, volume: 100});
  }
  rows = R; baseRows = R; idx = 5; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD';
  if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; mt5Connected = false;
  trades = []; active = null; positions = []; pendingOrders = [];
  footprintByBucket = {};
  window.T0 = t0;
};

test('mentre la candela si forma, il footprint si accumula', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const f = replayAvviaFormazione(6);
      if (!f) return {manca: true};
      if (!(f.fp.step > 0)) return {senzaGriglia: true};
      for (let i = 0; i < 20; i++) { replaySubAccumulo(f); f.sub++; }
      const livelli = Object.keys(f.fp.rows);
      let vol = 0;
      livelli.forEach(k => { vol += (f.fp.rows[k].askVol || 0) + (f.fp.rows[k].bidVol || 0); });
      return {livelli: livelli.length, vol};
    }, PREPARA.toString());
    assert.equal(r.manca, undefined, 'la formazione non parte');
    assert.equal(r.senzaGriglia, undefined, 'senza griglia del footprint non si accumula niente');
    assert.ok(r.livelli > 1, 'il footprint deve toccare più livelli di prezzo: ' + r.livelli);
    assert.ok(r.vol > 0, 'e avere del volume dentro: ' + r.vol);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('quando la candela si chiude il footprint RESTA, nella memoria delle candele vere', async () => {
  // È il cuore del difetto: prima di questa correzione, qui footprintByBucket restava vuoto.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const f = replayAvviaFormazione(6);
      for (let i = 0; i < 20; i++) { replaySubAccumulo(f); f.sub++; }
      const sommaFormazione = Object.keys(f.fp.rows)
        .reduce((s, k) => s + (f.fp.rows[k].askVol || 0) + (f.fp.rows[k].bidVol || 0), 0);
      const salvato = replayFinalizzaFootprint(f);
      const bucket = footprintBucketStart(parseDateTime(rows[6].date));
      const dentro = footprintByBucket[bucket];
      const sommaSalvata = dentro ? Object.keys(dentro.rows)
        .reduce((s, k) => s + (dentro.rows[k].askVol || 0) + (dentro.rows[k].bidVol || 0), 0) : 0;
      return {salvato, ceDentro: !!dentro, sommaFormazione, sommaSalvata,
              stessoPasso: dentro ? dentro.step === f.fp.step : false};
    }, PREPARA.toString());
    assert.equal(r.salvato, true, 'il deposito deve riuscire');
    assert.equal(r.ceDentro, true,
      'la candela completata deve avere il suo footprint nella memoria delle candele vere');
    assert.ok(Math.abs(r.sommaSalvata - r.sommaFormazione) < 1e-9,
      'e deve essere TUTTO quello accumulato: ' + r.sommaSalvata + ' contro ' + r.sommaFormazione);
    assert.equal(r.stessoPasso, true, 'sulla stessa griglia delle candele vere');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('si SOMMA ai dati veri, non li sovrascrive', async () => {
  // In replay-Live i tick veri continuano ad arrivare su quella candela. Sovrascriverli
  // vorrebbe dire buttare dati veri per metterci quelli ricostruiti: il contrario di quel che serve.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const f = replayAvviaFormazione(6);
      for (let i = 0; i < 20; i++) { replaySubAccumulo(f); f.sub++; }
      // Un dato "vero" gia' presente su quella candela, su un livello che la formazione tocca.
      const bucket = footprintBucketStart(parseDateTime(rows[6].date));
      const livello = Object.keys(f.fp.rows)[0];
      footprintByBucket[bucket] = {step: f.fp.step, rows: {}};
      footprintByBucket[bucket].rows[livello] = {buy: 7, sell: 0, askVol: 70, bidVol: 0, trades: 7};
      replayFinalizzaFootprint(f);
      const cella = footprintByBucket[bucket].rows[livello];
      return {buy: cella.buy, askVol: cella.askVol, trades: cella.trades,
              formazioneBuy: f.fp.rows[livello].buy};
    }, PREPARA.toString());
    assert.ok(r.buy > 7, 'il dato vero (7) deve restare e sommarsi: trovato ' + r.buy);
    assert.ok(r.askVol > 70, 'anche il volume: ' + r.askVol);
    assert.ok(r.trades > 7, 'e il conteggio dei trade: ' + r.trades);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una formazione vuota non sporca niente', async () => {
  // Una candela senza volume non deve creare un bucket vuoto: un bucket che esiste ma non contiene
  // niente fa credere al disegnatore che ci siano dati, e si vede una candela "piatta" al posto di
  // una senza footprint.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const f = replayAvviaFormazione(6);
      f.fp.rows = {};              // niente accumulato
      const salvato = replayFinalizzaFootprint(f);
      return {salvato, quanti: Object.keys(footprintByBucket).length};
    }, PREPARA.toString());
    assert.equal(r.salvato, false, 'niente da depositare: si dice di no');
    assert.equal(r.quanti, 0, 'e non si crea nessun bucket vuoto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il giro vero del replay lo deposita davvero: la funzione e\' agganciata', async () => {
  // La differenza che conta: una funzione giusta che nessuno chiama non corregge niente. Qui si
  // fa girare replayAnimTick (il battito vero del replay) finche' una candela si completa, e si
  // guarda se il footprint di quella candela e' finito nella memoria.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      idx = 5;
      const partenza = idx;
      replayForm = replayAvviaFormazione(idx + 1);
      const bucket = footprintBucketStart(parseDateTime(rows[idx + 1].date));
      // IL BATTITO MISURA L'OROLOGIO VERO (replayElapsedMs), ed e' giusto cosi': e' la correzione
      // del «a volte si blocca» quando la scheda non e' in primo piano. In un ciclo di prova pero'
      // non passa tempo reale, quindi senza farlo scorrere il replay non avanzerebbe mai e questo
      // test misurerebbe soltanto se stesso.
      window.replayElapsedMs = () => 5000;
      for (let giri = 0; giri < 400 && idx === partenza; giri++) {
        try { replayAnimTick(); } catch (e) { return {errore: String(e).slice(0, 150)}; }
      }
      const dentro = footprintByBucket[bucket];
      return {
        avanzata: idx > partenza,
        ceDentro: !!dentro,
        livelli: dentro ? Object.keys(dentro.rows).length : 0
      };
    }, PREPARA.toString());
    assert.equal(r.errore, undefined, 'il battito del replay non deve esplodere: ' + r.errore);
    assert.equal(r.avanzata, true, 'la candela deve essersi completata');
    assert.equal(r.ceDentro, true,
      'completata la candela, il suo footprint deve essere nella memoria: senza l\'aggancio ' +
      'resterebbe vuoto anche con la funzione scritta');
    assert.ok(r.livelli > 0, 'e con dentro dei livelli: ' + r.livelli);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
