// IL CONTO ALLA ROVESCIA DELLA CANDELA DEVE SCORRERE IN TUTTE LE FINESTRE.
//
// SEGNALATO dal proprietario (18 novembre 2026): «sulle pagine duplicate non mi fa vedere
// l'aggiornamento del timer della chiusura delle candele. Alcune volte si pianta: magari su una
// pagina duplicata funziona, ma sull'altra no. Mentre sul main funziona sempre.»
//
// CAUSA, letta nel codice e misurata qui: il numero non ha un orologio suo. `fmtCandleCountdown()`
// calcola quanto manca al minuto solo quando qualcuno chiama `draw()`, e a chiamare `draw()` ogni
// secondo sono i timer del FEED: `startMt5RefreshTimer` esce subito se `mt5Connected` o
// `mt5ActiveSymbol` sono falsi, `startLiveRefreshTimer` fa lo stesso per Capital.com. La finestra
// madre ha quasi sempre un feed collegato, una duplicata no - e quella senza feed non ridisegna
// mai, quindi il numero resta inchiodato. «A volte una sì e una no» e' esattamente questo: dipende
// da quale finestra ha il collegamento.
//
// LA REGOLA: il conto alla rovescia e' un orologio, non un dato di mercato. Deve scorrere anche
// senza feed, in ogni finestra.
//
// ------------------------------------------------------------------------------------------
// LO STATO DEL MERCATO SI DICHIARA, NON SI EREDITA DALL'OROLOGIO (19 novembre 2026).
//
// Questo file e' uscito ROSSO nel collaudo della 2.2.77 su due prove, e verde in quelli dei
// giorni prima con lo stesso codice. Misurato: il collaudo e' passato dopo le 22, e a mercato
// chiuso il conto alla rovescia e' SPENTO di proposito (`showCountdown` guarda
// `liveSessionPhaseNow()!=='closed'`, «come su MT5»). La prova misurava il vuoto:
// `fmtCandleCountdown` non veniva chiamata nemmeno una volta, e l'elenco dei valori era `[]`.
// Un collaudo che dipende da che ora lo lanci non e' un collaudo (stessa lezione del banco del
// tasto BE, e del sistema operativo dichiarato in aiuti.mjs).
//
// Fissare l'orologio non serve, ed e' stato provato: congela anche il tempo che DEVE scorrere, e
// il battito - che chiede «e' passato un secondo?» - non batte piu'. Quindi qui si dichiara il
// MERCATO, non l'ora:
//   - mercato sempre aperto: un asset che non chiude mai (una cripto). Vale a ogni ora;
//   - mercato chiuso: il calendario dello strumento, dichiarato con una fascia che non contiene
//     adesso. Anche questo vale a ogni ora, e ogni prova si assicura di essere nello stato che
//     dice di misurare prima di misurarlo.
//
// E la terza prova, cosi', misura davvero quello per cui esiste: a mercato CHIUSO, in replay,
// due giri da un secondo ridisegnavano il grafico (il conto alla rovescia a grafico fermo e il
// congelamento di fine sessione). In replay il disegno lo comanda il replay: un ridisegno di
// adesso ridipinge lo stato live sopra il fotogramma che si sta guardando - ed e' la sera, cioe'
// esattamente quando il replay si usa.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Una finestra duplicata, senza nessun collegamento ai dati, con una serie a grafico.
// `asset` si dichiara: 'EURUSD' chiude la sera, 'BTCUSD' non chiude mai.
const SCENA = (asset) => `(() => {
  mt5Connected = false; mt5ActiveSymbol = null; liveModeActive = true; liveReplayActive = false;
  const R = []; const t0 = Date.now() - 60 * 60000;
  for (let i = 0; i < 60; i++) {
    const p = 100 + i * 0.1;
    R.push({date:new Date(t0 + i*60000).toISOString(), open:p, high:p+1, low:p-1, close:p, volume:5});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length; currentTF = 1;
  currentAssetKey = ${JSON.stringify(asset)}; rowsAssetKey = ${JSON.stringify(asset)};
  csvLibrary = [{id:'mt5_live_' + ${JSON.stringify(asset)}, rows:R}];
  window.__disegni = 0;
  const vero = window.draw;
  window.draw = function(){ window.__disegni++; return vero.apply(this, arguments); };
  return {slot: (typeof PIP_SLOT!=='undefined' ? PIP_SLOT : null),
          fase: liveSessionPhaseNow()};
})()`;

// Il calendario dello strumento che dichiara: adesso e' CHIUSO. Una sola fascia di un minuto,
// uguale tutti i giorni, cosi' non dipende ne' dall'ora ne' dal giorno della settimana; la prova
// che la usa controlla comunque di essere davvero a mercato chiuso prima di misurare.
const CALENDARIO_CHIUSO = (asset) => `(() => {
  const fascia = ['03:17 - 03:18'];
  orariAsset = {}; orariAsset[${JSON.stringify(asset)}] = {zona:'UTC', letto:Date.now(), stato:null,
    giorni:{sun:fascia, mon:fascia, tue:fascia, wed:fascia, thu:fascia, fri:fascia, sat:fascia}};
  const st = statoMercato(${JSON.stringify(asset)}, Date.now());
  return {chiuso: !!(st && st.chiuso), fonte: st && st.fonte};
})()`;

test('in una finestra duplicata senza feed il grafico si ridisegna comunque ogni secondo', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=2'});
  try{
    const s = await pagina.evaluate(SCENA('BTCUSD'));
    assert.ok(s.slot > 0, 'la finestra di prova deve essere una duplicata: PIP_SLOT=' + s.slot);
    assert.notEqual(s.fase, 'closed', 'scena a mercato aperto: un asset che non chiude mai');
    await pagina.evaluate(() => { window.__disegni = 0; });
    await pagina.waitForTimeout(3200);
    const n = await pagina.evaluate(() => window.__disegni);
    assert.ok(n >= 2,
      'in tre secondi il grafico deve ridisegnarsi almeno due volte, o il conto alla rovescia resta '
      + 'fermo: ridisegni contati ' + n);
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('e il numero che finisce SUL GRAFICO cambia da un secondo all altro', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=2'});
  try{
    const s = await pagina.evaluate(SCENA('BTCUSD'));
    assert.notEqual(s.fase, 'closed',
      'questa prova vale a mercato APERTO: a mercato chiuso il conto alla rovescia e spento '
      + 'di proposito, e si misurerebbe il vuoto');
    // Non si chiede «quanto manca?» alla funzione: quella risponde sempre, anche se nessuno la
    // chiama mai. Si registra il valore che finisce DAVVERO nel disegno, che e' quello che il
    // proprietario vede fermo.
    await pagina.evaluate(() => {
      window.__mostrati = [];
      const vero = window.fmtCandleCountdown;
      window.fmtCandleCountdown = function(){ const v = vero.apply(this, arguments); window.__mostrati.push(v); return v; };
    });
    await pagina.waitForTimeout(3200);
    const mostrati = await pagina.evaluate(() => window.__mostrati);
    const diversi = new Set(mostrati).size;
    assert.ok(diversi >= 2,
      'sul grafico il numero deve cambiare: valori disegnati in tre secondi ' + JSON.stringify(mostrati));
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('GUARDIA: in replay il battito non ridisegna da se (lo fa il replay)', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=2'});
  try{
    await pagina.evaluate(SCENA('EURUSD'));
    // MERCATO CHIUSO DICHIARATO: e' li' che il difetto viveva. A mercato aperto questa prova
    // passerebbe senza provare niente.
    const m = await pagina.evaluate(CALENDARIO_CHIUSO('EURUSD'));
    assert.equal(m.chiuso, true, 'la scena deve essere a mercato chiuso: stato letto ' + JSON.stringify(m));
    await pagina.evaluate(() => { liveReplayActive = true; window.__disegni = 0; });
    await pagina.waitForTimeout(3200);
    const n = await pagina.evaluate(() => window.__disegni);
    assert.equal(n, 0,
      'durante il replay il disegno lo comanda il replay: il battito non deve metterci mano. '
      + 'Ridisegni contati: ' + n);
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});
