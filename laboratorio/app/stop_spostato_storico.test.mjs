// LO STOP SPOSTATO NON DEVE ESSERE CONFRONTATO CON IL PASSATO IN CUI NON C'ERA.
//
// SEGNALATO dal proprietario (21 ottobre 2026), con il grafico dell'app e quello di MT5 a
// confronto: «Come ha fatto ad arrivare il prezzo fino a lassù? Non è stato tracciato, quindi come
// ha fatto a chiudere la posizione da solo? [...] effettivamente il mercato vero e proprio non ci
// è arrivato al prezzo di 0,92830. È andato nel senso opposto e ha toccato il livello minimo di
// 0,9247. È più di una volta che mi succede. [...] Lì c'era lo stop loss, 2 ha chiuso in perdita e
// a break even. Ma il mercato in realtà non ci è andato, quindi come ha fatto?»
//
// LA CAUSA, misurata nel codice e coerente con ogni dettaglio dei due grafici.
// scanHistoricalSlTpTouches() gira a OGNI ricaricamento dello storico (riconnessione, cambio
// timeframe, riapertura dell'app): ripassa tutte le candele e chiude la posizione se una qualsiasi
// ha toccato lo stop. L'unico filtro era «candele successive all'APERTURA» (rowTime<=pos.startTime).
// Ma lo stop con cui confronta è quello di ADESSO, che nel frattempo può essere stato spostato.
//
// Nel caso reale, EURCHF del 20 ottobre 2026:
//   17:10  SELL aperta a 0,9283;
//   17:2x  il prezzo sale a 0,9285 — tocca 0,9283 DAVVERO, ma lì lo stop era ancora lontano
//          (0,9300) e infatti non successe niente, correttamente;
//   più tardi  lo stop viene portato a pareggio: 0,92830;
//   23:00  riconnessione -> storico ricaricato -> la riscansione trova la candela delle 17:2x,
//          vede high >= 0,92830 e CHIUDE, al prezzo dello stop, a pareggio.
// Da fuori: una posizione chiusa a un prezzo che il mercato non ha toccato da quando lo stop era
// lì — e sempre a una riapertura, perché è lì che la riscansione gira.
//
// LA REGOLA: una candela vale per lo stop solo se è successiva a QUANDO QUELLO STOP È STATO
// MESSO, non a quando la posizione è stata aperta. Lo stesso per il target.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// EURCHF come nel caso vero. Una SELL aperta alle 17:10 a 0,9283; alle 17:20 il prezzo sale a
// 0,9285 (sopra l'entrata); poi scende tutto il pomeriggio fino a 0,9247. Alle 20:00 lo stop
// viene portato a pareggio (0,9283). Le candele dalle 20:00 in poi non arrivano mai lassù.
const PREPARA = () => {
  const T = (h, m) => new Date(2026, 9, 20, h, m, 0).getTime();
  const R = [];
  const bar = (t, o, h, l, c) => ({date: new Date(t).toISOString(), open: o, high: h, low: l, close: c, volume: 5});
  // 17:00 -> 17:09: prima dell'apertura, prezzo intorno a 0,9280.
  for (let m = 0; m < 10; m++) R.push(bar(T(17, m), 0.9280, 0.9281, 0.9279, 0.9280));
  // 17:10: apertura della SELL.
  R.push(bar(T(17, 10), 0.9283, 0.9283, 0.9282, 0.9283));
  // 17:20: IL MASSIMO DELLA GIORNATA, 0,9285. Qui lo stop era a 0,9300: non doveva succedere nulla.
  for (let m = 11; m < 20; m++) R.push(bar(T(17, m), 0.9283, 0.9284, 0.9282, 0.9283));
  R.push(bar(T(17, 20), 0.9284, 0.9285, 0.9283, 0.9284));
  // Dalle 17:21 alle 23:00 scende e non torna più su: il massimo resta sotto 0,9272.
  let p = 0.9284;
  for (let h = 17, m = 21; h < 23 || (h === 23 && m === 0); ) {
    p = Math.max(0.9247, p - 0.0000012 * 60);
    R.push(bar(T(h, m), p, Math.min(p + 0.00002, 0.92715), p - 0.00002, p));
    m++; if (m >= 60) { m = 0; h++; }
    if (h >= 23) break;
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURCHF';
  if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURCHF';
  liveModeActive = false; mt5Connected = false;
  trades = []; active = null; pendingOrders = []; positions = [];
  positions.push({
    id: 'P1', asset: 'EURCHF', side: 'SELL',
    entry: 0.9283,
    sl: 0.9283,            // PORTATO A PAREGGIO alle 20:00
    slIniziale: 0.9300,    // lo stop con cui era stata aperta
    tp: 0.9240,
    lots: 0.1, marginUsed: 10, start: 10,
    startTime: T(17, 10),
    slAt: T(20, 0)         // QUANDO lo stop è stato messo dov'è adesso
  });
  window._maxDopoLoStop = Math.max(...R.filter(r => new Date(r.date).getTime() > T(20, 0)).map(r => r.high));
};

test('la candela che tocca lo stop PRIMA che lo stop fosse lì non lo fa scattare', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const maxDopo = window._maxDopoLoStop;
      scanHistoricalSlTpTouches();
      return {
        aperte: positions.length,
        chiuse: trades.length,
        motivo: trades.length ? String(trades[0].result || trades[0].reason || '') : null,
        prezzoChiusura: trades.length ? trades[0].exit : null,
        maxDopoLoStop: maxDopo,
        stop: 0.9283
      };
    }, PREPARA.toString());
    // La prova che il mercato NON ci è andato da quando lo stop è lì: il massimo dopo le 20:00
    // è sotto lo stop. Se questa non vale, il banco di prova è costruito male.
    assert.ok(r.maxDopoLoStop < r.stop,
      'il banco deve rappresentare un mercato che NON torna sullo stop: max dopo le 20:00 = ' + r.maxDopoLoStop);
    assert.equal(r.aperte, 1,
      'la posizione deve restare APERTA: il prezzo ha toccato 0,9283 alle 17:20, tre ore prima che ' +
      'lo stop fosse messo lì. Invece è stata chiusa a ' + r.prezzoChiusura + ' (' + r.motivo + ').');
    assert.equal(r.chiuse, 0, 'e nel Journal non deve comparire nessuna chiusura');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('uno stop toccato DOPO essere stato messo chiude ancora, come deve', async () => {
  // La correzione non deve spegnere la funzione: una riapertura che ritrova lo stop toccato
  // davvero (mentre l'app era chiusa) deve continuare a ricostruire la chiusura.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      // Stesso scenario, ma lo stop è stato messo alle 17:15: la candela delle 17:20 (0,9285)
      // è successiva, quindi lo tocca per davvero.
      positions[0].slAt = new Date(2026, 9, 20, 17, 15, 0).getTime();
      scanHistoricalSlTpTouches();
      return {aperte: positions.length, chiuse: trades.length,
              prezzoChiusura: trades.length ? trades[0].exit : null};
    }, PREPARA.toString());
    assert.equal(r.aperte, 0, 'questa volta lo stop è stato toccato DOPO essere stato messo: si chiude');
    assert.equal(r.chiuse, 1);
    assert.equal(Math.round(r.prezzoChiusura * 1e7) / 1e7, 0.9283, 'e si chiude al prezzo dello stop');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una posizione vecchia, senza la data dello stop, non viene chiusa da uno stop spostato', async () => {
  // Le posizioni aperte PRIMA di questa correzione non hanno `slAt`. Per quelle si sa una cosa
  // sola: se lo stop di adesso è diverso da quello di apertura (slIniziale), è stato spostato e
  // NON si sa quando — e allora non si chiude dallo storico. Chiudere per sbaglio costa soldi;
  // non chiudere costa che la posizione resta aperta e la si chiude guardandola.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      delete positions[0].slAt;       // posizione di prima della correzione
      scanHistoricalSlTpTouches();
      return {aperte: positions.length, chiuse: trades.length};
    }, PREPARA.toString());
    assert.equal(r.aperte, 1,
      'stop spostato (0,9283 contro i 0,9300 di apertura) e data sconosciuta: non si chiude dallo storico');
    assert.equal(r.chiuse, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una posizione vecchia con lo stop MAI spostato continua a funzionare come prima', async () => {
  // Qui non c'è nessun dubbio: lo stop è quello di apertura, quindi c'era fin dall'inizio e ogni
  // candela successiva all'apertura vale. Niente deve cambiare per questo caso.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      delete positions[0].slAt;
      positions[0].sl = 0.9285;          // stop di apertura, mai toccato
      positions[0].slIniziale = 0.9285;
      scanHistoricalSlTpTouches();
      return {aperte: positions.length, chiuse: trades.length,
              prezzoChiusura: trades.length ? trades[0].exit : null};
    }, PREPARA.toString());
    assert.equal(r.aperte, 0, 'lo stop di apertura è stato toccato alle 17:20: si chiude, come sempre');
    assert.equal(r.chiuse, 1);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
