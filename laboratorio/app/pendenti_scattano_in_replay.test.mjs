// GLI ORDINI PENDENTI CREATI IN REPLAY SCATTANO QUANDO IL PREZZO PASSA SULL'ENTRATA.
//
// SEGNALATO dal proprietario (30 ottobre 2026): "gli ordini pendenti creati all'interno della
// modalita' replay, tutto questo ovviamente quando attiva la modalita' backtest, gli ordini
// pendenti non vengono eseguiti, cioe' vengono segnati ma non vengono aperti quando il prezzo
// passa sulla linea dell'entry. Sistemiamo."
//
// La misura: in replay-in-live `checkPendingOrders()` guardava SEMPRE l'ultima candela vera
// (rows[rows.length-1]), anche per gli ordini creati DURANTE il replay. Con l'ordine a 1.0005 e
// il replay che avanza fino a 1.0009, l'entrata passava sulla barra di mezzo - ma l'ULTIMA barra
// era a 1.0009 e il suo range non la conteneva piu': l'ordine restava in elenco per sempre,
// "segnato ma non aperto".
//
// E evaluate() - le posizioni - aveva GIA' questa eccezione dal 26 ottobre (revisore): una
// posizione nata durante il replay (`historical`) si valuta sulla candela DEL REPLAY, perche'
// il prezzo di oggi non c'entra. Qui mancava, solo per gli ordini pendenti. Ora c'�, con la
// stessa regola e la stessa forma.
//
// Cosa misura questo banco:
//   1. l'ordine nato in replay scatta quando il replay passa sulla sua entrata (era il difetto);
//   2. PROVA DI CONTROLLO: un ordine NON nato in replay continua a essere giudicato dal prezzo
//      vero di oggi - se si cambiasse per tutti, "le cose fatte in tempo reale" inizierebbero a
//      filtrare nel passato, che e' l'errore opposto e altrettanto costoso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = () => {
  liveModeActive = true;
  mt5Connected = true;
  liveReplayActive = true;               // replay in live: il caso del proprietario
  currentAssetKey = 'EURUSD';
  $('market').value = 'EURUSD';
  // Tutto inline: nel browser non arriva nulla da qui fuori.
  const bars = [];
  for (let i = 0; i < 10; i++) {
    const c = 1.0000 + i * 0.0001;
    bars.push({date: '2026-01-0' + (1 + (i % 9)) + ' 00:00', t: Date.UTC(2026, 0, 2 + i),
               o: c, high: c + 0.00005, low: c - 0.00005, close: c, v: 1});
  }
  rows = bars; baseRows = bars; idx = 0; currentTF = 1;
  masterTime = bars[0].t;
  $('pendingEntry').value = '1.0005';    // il replay lo tocca alla barra 5
  $('slPending').value = '0.9995';
  $('tpPending').value = '1.0015';
};

test('ordine nato in replay: scatta quando il replay passa sulla sua entrata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      createPendingOrder('BUY');
      const o = pendingOrders[pendingOrders.length - 1];
      // LA FIRMA DEL DIFETTO: l'ultima candela (1.0009) NON contiene l'entrata, il punto di
      // replay (barra 5, 1.0005) SI. Con la regola di prima l'ordine non sarebbe scattato mai.
      const ultima = rows[rows.length - 1];
      const dentroUltima = ultima.low <= o.entry && ultima.high >= o.entry;
      // ora faccio avanzare il replay FINO ALLA BARRA CHE CONTIENE L'ENTRATA (la 5ª:
      // 1.00049-1.00055). Andare oltre la salterebbe: e' il senso della prova.
      for (let k = 0; k < 5; k++) { idx++; masterTime = rows[idx].t; }
      const nati = fblNatoInReplay(o);
      checkPendingOrders();
      return {dentroUltima, nati, pendenti: pendingOrders.length, posizioni: positions.length};
    }, PREPARA.toString());
    // La firma: col confronto di prima l'ordine era condannato a restare in elenco.
    assert.equal(r.dentroUltima, false,
      'l\'ultima candela non contiene l\'entrata: ed e\' quello che si guardava prima');
    assert.ok(r.nati, 'l\'ordine e\' nato durante il replay');
    // LA CURA: adesso scatta, e diventa una posizione.
    assert.equal(r.pendenti, 0, 'l\'ordine non resta piu\' in elenco: e\' scattato');
    assert.equal(r.posizioni, 1, 'ed e\' diventato una posizione, aperta al suo prezzo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: un ordine NON nato in replay si giudica ancora col prezzo vero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      createPendingOrder('BUY');
      // lo same identico ordine, ma NON nato in replay: viene da prima, da una sessione live
      const o = pendingOrders[pendingOrders.length - 1];
      o.historical = false;
      o.entry = 1.00005;               // sotto il range di TUTTE le barre: non scatta da nessuna
      for (let k = 0; k < 5; k++) { idx++; masterTime = rows[idx].t; }
      const ultima = rows[rows.length - 1];
      const dentroUltima = ultima.low <= o.entry && ultima.high >= o.entry;
      checkPendingOrders();
      return {dentroUltima, pendenti: pendingOrders.length, posizioni: positions.length};
    }, PREPARA.toString());
    assert.equal(r.dentroUltima, false, 'l\'entrata non � nel range dell\'ultima candela vera');
    // Se la regola valesse per tutti, questo scatterebbe "nel passato": e' l'errore opposto.
    assert.equal(r.posizioni, 0, 'non nato in replay: non scatta sul punto di replay');
    assert.equal(r.pendenti, 1, 'resta in elenco, ad aspettare il prezzo vero');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
