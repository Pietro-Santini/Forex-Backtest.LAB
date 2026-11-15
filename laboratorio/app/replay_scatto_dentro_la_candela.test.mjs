// IN REPLAY UN ORDINE SCATTA QUANDO IL PREZZO TOCCA IL LIVELLO, NON A CANDELA CHIUSA.
//
// SEGNALATO dal proprietario il 14 novembre 2026: «appena passa sopra il prezzo alla linea di
// entrata scatta l'apertura e non dopo che finisce la candela e passa alla successiva, deve
// funzionare come in tempo reale allo stesso modo lo deve simulare alla perfezione».
//
// MISURATO con una sonda sulla pagina vera, candela da un minuto, ordine a 1,00150:
//     passo 11  prezzo 1,00150  pendenti=1 posizioni=0   <- il prezzo E' sull'entrata
//     passo 17  prezzo 1,00200  pendenti=1 posizioni=0   <- l'ha superata di 5 pip
//     passo 58  prezzo 1,00050  pendenti=1 posizioni=0   <- tornato sotto, ancora pendente
//     passo 59  idx avanza      pendenti=0 posizioni=1   <- scatta ORA, a candela chiusa
// Ritardo misurato: 48 secondi su 60, l'80% della candela. Su un grafico orario, 48 minuti.
//
// LA CAUSA: checkPendingOrders() ed evaluate() venivano chiamate SOLO da forward(), cioe' solo
// alla chiusura di una candela. Il battito del replay chiamava solo draw().
//
// PERCHE' I BANCHI DI PRIMA NON LO VEDEVANO: `pendenti_scattano_in_replay.test.mjs` avanza
// l'indice a mano con un ciclo e poi chiama checkPendingOrders() direttamente - `replayForm`
// non esiste mai, il battito non gira, il prezzo dentro la barra non viene mai calcolato. Era
// un banco sul COSA, non sul QUANDO: per questo il difetto e' sopravvissuto alla correzione
// del 30 ottobre.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Una candela in formazione che sale fino a 1,00200: l'ordine a 1,00150 viene toccato nel
// primo terzo del tempo, perche' il percorso dichiarato va apertura -> massimo -> minimo ->
// chiusura.
const SCENA = `((entrata, lato) => {
  const base = Date.parse('2026-11-10T10:00:00Z');
  rows = [];
  for (let i = 0; i < 8; i++) {
    rows.push({date: new Date(base + i * 60000).toISOString().slice(0,16).replace('T',' '),
               open: 1.0005, high: 1.00055, low: 1.00045, close: 1.0005, volume: 1});
  }
  baseRows = rows.slice();
  rowsAssetKey = currentAssetKey = 'EURUSD';
  currentTF = 1;
  idx = 4;
  liveReplayActive = true;
  positions.length = 0;
  pendingOrders.length = 0;
  replayForm = {idx: 5, sub: 0, perBar: 60,
                path: replaySintesiPath({open:1.0005, high:1.002, low:1.00045, close:1.0005}, 61)};
  if (entrata != null) {
    pendingOrders.push({id:'p1', side: lato||'BUY', entry: entrata, lots: 0.01,
                        sl: null, tp: null, historical: true, asset: 'EURUSD'});
  }
})`;

// Svela i secondi uno per uno, come fa il battito vero, e dice a quale secondo e' scattato.
const SVELA = `((quanti) => {
  const tracciato = [];
  for (let k = 0; k < quanti; k++) {
    const prima = replayPrezzoFormazione();
    replayForm.sub++;
    const dopo = replayPrezzoFormazione();
    replayValutaFormazione(prima, dopo);
    tracciato.push({sub: replayForm.sub, prezzo: dopo,
                    pendenti: pendingOrders.length, posizioni: positions.length});
  }
  return tracciato;
})`;

test('l ordine pendente scatta DENTRO la candela, non alla sua chiusura', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({scena, svela}) => {
      eval(scena)(1.0015, 'BUY');
      const t = eval(svela)(60);
      const scatto = t.find(x => x.posizioni > 0);
      const tocco = t.find(x => x.prezzo >= 1.0015);
      return {tocco: tocco || null, scatto: scatto || null, idxFinale: idx,
              ultimo: t[t.length - 1]};
    }, {scena: SCENA, svela: SVELA});
    console.log('scatto:', JSON.stringify(r));
    assert.ok(r.tocco, 'la scena deve far toccare il livello: ' + JSON.stringify(r));
    assert.ok(r.scatto, 'l ordine deve scattare: ' + JSON.stringify(r));
    assert.ok(r.scatto.sub <= r.tocco.sub + 1,
      'deve scattare nel secondo in cui il prezzo tocca (tocco al ' + r.tocco.sub + '), non ' +
      'alla fine della candela: ' + JSON.stringify(r));
    assert.equal(r.idxFinale, 4,
      'e la candela NON deve essere ancora chiusa quando scatta: ' + JSON.stringify(r));
    // UN ORDINE, UNA POSIZIONE. Il percorso dichiarato attraversa lo stesso livello piu' volte
    // (sale al massimo, scende al minimo, risale alla chiusura): senza togliere l'ordine dalla
    // lista prima di attivarlo, ne nascono tre. Misurato mentre si scriveva la cura, ed e' il
    // motivo per cui questa riga esiste.
    assert.equal(r.ultimo.posizioni, 1,
      'un solo ordine pendente deve aprire UNA sola posizione, anche se il prezzo riattraversa ' +
      'il livello: ' + JSON.stringify(r));
    assert.equal(r.ultimo.pendenti, 0,
      'e l ordine deve sparire dalla lista dei pendenti: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('IL PERCORSO SEGUE IL VERSO DELLA CANDELA', async () => {
  // Fino al 14 novembre il percorso andava SEMPRE apertura -> massimo -> minimo -> chiusura,
  // qualunque fosse il verso. Era una distorsione sistematica, non un rumore: pessimista per
  // gli acquisti e ottimista per le vendite.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const su = replaySintesiPath({open: 100, high: 110, low: 90, close: 105}, 61);
      const giu = replaySintesiPath({open: 105, high: 110, low: 90, close: 100}, 61);
      const primoEstremo = (p) => {
        for (const v of p) { if (v >= 109.9) return 'massimo'; if (v <= 90.1) return 'minimo'; }
        return 'nessuno';
      };
      return {rialzista: primoEstremo(su), ribassista: primoEstremo(giu)};
    });
    console.log('verso:', JSON.stringify(r));
    assert.equal(r.rialzista, 'minimo',
      'in una candela che sale il prezzo tocca prima il MINIMO: ' + JSON.stringify(r));
    assert.equal(r.ribassista, 'massimo',
      'in una che scende tocca prima il MASSIMO: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('SL e TP si valutano secondo per secondo, come in tempo reale', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(({scena, svela}) => {
      eval(scena)(null, null);
      positions.push({id: 's1', side: 'SELL', entry: 1.0005, lots: 0.01,
                      sl: 1.0015, tp: null, historical: true, asset: 'EURUSD',
                      start: idx, startTime: Date.parse('2026-11-10T10:05:00Z')});
      const t = eval(svela)(60);
      const chiusa = t.find(x => x.posizioni === 0);
      return {chiusa: chiusa || null, idxFinale: idx, operazioni: trades.length};
    }, {scena: SCENA, svela: SVELA});
    console.log('stop dentro la barra:', JSON.stringify(r));
    assert.ok(r.chiusa, 'lo stop deve chiudere la posizione dentro la barra: ' + JSON.stringify(r));
    assert.equal(r.idxFinale, 4,
      'e la candela non deve essere ancora chiusa: ' + JSON.stringify(r));
    assert.equal(r.operazioni, 1, 'l operazione finisce nel Journal');
  } finally { await browser.close(); }
});

test('L ESITO DIPENDE DAL MERCATO, NON DAL PERCORSO', async () => {
  // La prova che il percorso non decide piu' da solo. MISURATO su tutte le 58 aperture
  // possibili dentro una candela, con stop a 2 pip e target a 4:
  //     col vecchio percorso: 34 stop / 17 target / 7 aperte, UGUALE in tutti e due i versi
  //     col percorso nuovo:   candela che sale  -> 11 stop / 25 target / 22 aperte
  //                           candela che scende-> 40 stop /  6 target / 12 aperte
  // Comprare in una candela che sale va bene, comprare in una che scende va male: e' il
  // mercato a decidere, non l'ordine di visita.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const prova = (c) => {
        let sl = 0, tp = 0, aperte = 0;
        for (let apertura = 1; apertura <= 58; apertura++) {
          const base = Date.parse('2026-11-10T10:00:00Z');
          rows = [];
          for (let i = 0; i < 8; i++) rows.push({date: new Date(base+i*60000).toISOString().slice(0,16).replace('T',' '),
            open: c.open, high: c.high, low: c.low, close: c.close, volume: 1});
          baseRows = rows.slice();
          rowsAssetKey = currentAssetKey = 'EURUSD'; currentTF = 1; idx = 4;
          liveReplayActive = true; positions.length = 0; trades.length = 0; pendingOrders.length = 0;
          replayForm = {idx: 5, sub: apertura, perBar: 60, path: replaySintesiPath(c, 61)};
          const entrata = replayPrezzoFormazione();
          positions.push({id: 'x', side: 'BUY', entry: entrata, lots: 0.01,
                          sl: entrata - 0.0002, tp: entrata + 0.0004,
                          historical: true, asset: 'EURUSD', start: idx,
                          startTime: parseDateTime(rows[5].date)});
          for (let k = apertura; k < 60; k++) {
            const prima = replayPrezzoFormazione();
            replayForm.sub++;
            replayValutaFormazione(prima, replayPrezzoFormazione());
          }
          if (positions.length) aperte++;
          else if (trades[trades.length-1].result === 'TP') tp++;
          else sl++;
        }
        return {sl, tp, aperte};
      };
      return {
        rialzista: prova({open:1.0800, high:1.0806, low:1.0795, close:1.0804}),
        ribassista: prova({open:1.0804, high:1.0806, low:1.0795, close:1.0800}),
      };
    });
    console.log('58 aperture:', JSON.stringify(r));
    assert.ok(r.rialzista.tp > r.rialzista.sl,
      'comprando in una candela che SALE devono vincere piu target che stop: ' + JSON.stringify(r));
    assert.ok(r.ribassista.sl > r.ribassista.tp,
      'comprando in una che SCENDE deve essere il contrario: ' + JSON.stringify(r));
    assert.notDeepEqual(r.rialzista, r.ribassista,
      'i due versi NON possono dare lo stesso risultato: se lo danno, a decidere e il percorso ' +
      'e non il mercato. ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('un ordine NON nato in replay non scatta sul prezzo del passato', async () => {
  // L'errore opposto, e sarebbe peggiore: un ordine vero che scatta su una candela rivista.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(({scena, svela}) => {
      eval(scena)(null, null);
      pendingOrders.push({id:'live1', side:'BUY', entry:1.0015, lots:0.01,
                          historical:false, asset:'EURUSD'});
      const t = eval(svela)(60);
      return {pendentiAllaFine: pendingOrders.length, posizioni: positions.length};
    }, {scena: SCENA, svela: SVELA});
    console.log('ordine live:', JSON.stringify(r));
    assert.equal(r.pendentiAllaFine, 1,
      'un ordine che non e nato nel replay non puo scattare su un prezzo del passato');
    assert.equal(r.posizioni, 0, 'e non deve aprire niente');
  } finally { await browser.close(); }
});

test('un ordine VERO del broker non viene mai attivato dal replay', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(({scena, svela}) => {
      eval(scena)(null, null);
      pendingOrders.push({id:'mt5', side:'BUY', entry:1.0015, lots:0.01,
                          historical:true, mt5Ticket:12345, asset:'EURUSD'});
      eval(svela)(60);
      return {pendentiAllaFine: pendingOrders.length, posizioni: positions.length};
    }, {scena: SCENA, svela: SVELA});
    console.log('ordine MT5:', JSON.stringify(r));
    assert.equal(r.pendentiAllaFine, 1,
      'gli ordini con un ticket MT5 li decide il broker, mai il replay');
    assert.equal(r.posizioni, 0);
  } finally { await browser.close(); }
});

test('un livello MAI toccato non fa scattare niente', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(({scena, svela}) => {
      eval(scena)(1.5, 'BUY');          // molto sopra il massimo della candela
      eval(svela)(60);
      return {pendenti: pendingOrders.length, posizioni: positions.length};
    }, {scena: SCENA, svela: SVELA});
    console.log('mai toccato:', JSON.stringify(r));
    assert.equal(r.pendenti, 1, 'resta pendente');
    assert.equal(r.posizioni, 0, 'non si apre niente');
  } finally { await browser.close(); }
});
