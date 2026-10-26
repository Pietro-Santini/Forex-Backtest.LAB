// IN REPLAY I SEGNALI APRONO SUL CONTO SIMULATO, MAI SU MT5. E L'ORDINE LIMITE Resta PENDENTE.
//
// SEGNALATO dal proprietario (26 ottobre 2026), due difetti veri:
//
// A) «in modalità replay le posizioni non vengono aperte nell'account storico, ma vengono
//    aperte sull'account MT5. Devi assolutamente correggere, non va bene. Non possono essere
//    aperte nell'account MT5.»
//    CAUSA misurata: `tgEseguiSegnale()` decideva con `const reale=!!mt5Connected;` — la
//    sessione replay non c'entrava, quindi con MT5 collegato gli ordini dei segnali partivano
//    VERI (placeRealMt5Order / placeRealMt5PendingOrder) anche mentre si rivede il passato.
//
// B) «con il pulsante dell'ordine limite premuto, ce le apre comunque a prezzo del mercato e
//    non ce la posiziona come un ordine limite selezionando quello che è il prezzo per
//    l'ordine pendente.»
//    CAUSA misurata: in `tgPiano()` il prezzo scelto dall'utente veniva messo subito in
//    `entry`, e il confronto che decide "pendente o mercato" era `opz.prezzo!==entry` —
//    cioè il prezzo confrontato con SE STESSO: sempre falso, quindi sempre a mercato.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = () => {
  const t0 = Date.UTC(2026, 9, 25, 8, 0, 0);
  const R = [];
  for (let i = 0; i < 200; i++) {
    const c = 4080 + Math.sin(i / 9) * 5;
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: c, high: c + 1, low: c - 1, close: c, volume: 10});
  }
  rows = R; baseRows = R; idx = 150; viewEnd = 160;
  currentAssetKey = 'XAUUSD';
  masterTime = Date.parse(R[150].date);
  liveModeActive = true;
  mt5Connected = true;                 // MT5 collegato: è il caso del proprietario
  try { $('market').value = 'XAUUSD'; } catch (e) {}
  positions.length = 0;
  pendingOrders.length = 0;
  // Conta le chiamate REALI al bridge: devono essere ZERO in replay.
  window.__reali = {mercato: 0, pendente: 0};
  window.placeRealMt5Order = async () => { window.__reali.mercato++; return true; };
  window.placeRealMt5PendingOrder = async () => { window.__reali.pendente++; return true; };
};

const VOCE = () => ({
  segnale: {strumento: 'XAUUSD', direzione: 'BUY', stop_loss: 4070, take_profit: [4090]},
  chat: 'PipHunter', id: 'seg1', tipo: 'segnale',
});

test('in replay con MT5 collegato il segnale apre SOLO posizioni simulate', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara, voceJs}) => {
      eval('(' + prepara + ')()');
      liveReplayActive = true;          // REPLAY attivo
      const voce = eval('(' + voceJs + ')()');
      const prima = positions.length;
      return (async () => {
        await tgEseguiSegnale(voce, {sym: 'XAUUSD', automatico: true});
        return {
          prima,
          realiMercato: window.__reali.mercato,
          realiPendente: window.__reali.pendente,
          aperte: positions.length - prima,
          simulate: positions.filter(p => p.historical).length,
          entry: positions.length ? positions[positions.length - 1].entry : null,
          prezzoReplay: rows[idx] ? rows[idx].close : null,
        };
      })();
    }, {prepara: PREPARA.toString(), voceJs: VOCE.toString()});

    assert.equal(r.realiMercato, 0, 'NESSUN ordine a mercato reale su MT5: ' + JSON.stringify(r));
    assert.equal(r.realiPendente, 0, 'NESSUN ordine pendente reale su MT5: ' + JSON.stringify(r));
    assert.ok(r.aperte >= 1, 'la posizione deve aprirsi sul conto storico/simulato: ' + JSON.stringify(r));
    assert.ok(r.simulate >= 1, 'la posizione aperta in replay è simulata (historical): ' + JSON.stringify(r));
    assert.equal(r.entry, r.prezzoReplay, 'entra al prezzo della candela mostrata, non a quello di oggi');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('col prezzo scelto dall\'utente il segnale diventa ORDINE PENDENTE, non a mercato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({prepara, voceJs}) => {
      eval('(' + prepara + ')()');
      liveReplayActive = false;
      const mercato = currentPrice();
      // BUY con prezzo SOTTO il mercato -> ordine LIMIT pendente a quel prezzo.
      const prezzoScelto = Number((mercato - 10).toFixed(5));
      const piano = tgPiano({direzione: 'BUY', stop_loss: prezzoScelto - 20, take_profit: [prezzoScelto + 30],
        entrata: prezzoScelto}, 'XAUUSD', 1, {prezzo: prezzoScelto});
      // E con prezzo SOPRA il mercato -> ordine STOP.
      const prezzoStop = Number((mercato + 10).toFixed(5));
      const pianoStop = tgPiano({direzione: 'BUY', stop_loss: prezzoStop - 20, take_profit: [prezzoStop + 30],
        entrata: prezzoStop}, 'XAUUSD', 1, {prezzo: prezzoStop});
      return {
        mercato, prezzoScelto, prezzoStop,
        limit: {pendente: piano.pendente, kind: piano.kind, entry: piano.entry, note: piano.notaEntrata},
        stop: {pendente: pianoStop.pendente, kind: pianoStop.kind, entry: pianoStop.entry},
      };
    }, {prepara: PREPARA.toString(), voceJs: VOCE.toString()});

    assert.equal(r.limit.pendente, true, 'col prezzo scelto sotto al mercato l\'ordine è PENDENTE: ' + JSON.stringify(r.limit));
    assert.equal(r.limit.kind, 'LIMIT', 'ed è un ordine LIMIT: ' + JSON.stringify(r.limit));
    assert.equal(r.limit.entry, r.prezzoScelto, 'al prezzo scelto dall\'utente: ' + JSON.stringify(r.limit));
    assert.equal(r.stop.pendente, true, 'col prezzo scelto sopra al mercato l\'ordine è PENDENTE: ' + JSON.stringify(r.stop));
    assert.equal(r.stop.kind, 'STOP', 'ed è un ordine STOP: ' + JSON.stringify(r.stop));
    assert.equal(r.stop.entry, r.prezzoStop, 'al prezzo scelto dall\'utente: ' + JSON.stringify(r.stop));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in replay NESSUN comando reale al bridge: chiusura, modifica e spostamento stop bloccati', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async () => {
      liveReplayActive = true;
      // Conta qualunque chiamata al bridge.
      window.__chiamate = [];
      const orig = window.fetchMt5WithTimeout;
      window.fetchMt5WithTimeout = async (url) => { window.__chiamate.push(String(url)); return {ok: false, message: 'bloccato dal test'}; };
      const pos = {mt5Ticket: 999, asset: 'XAUUSD', side: 'BUY', entry: 4080, lots: 0.1, sl: 4070, tp: 4090};
      const esiti = {};
      esiti.chiudi = await closeMt5PositionReal(pos, 'TP', {senzaConferma: true});
      esiti.chiudiTabella = await closeMt5TicketFromTable('999');
      esiti.modifica = await modifyMt5TicketFromTable('999');
      const slPrima = pos.sl;
      esiti.spostaStop = await fblMt5SpostaStop(pos, 4075);
      window.fetchMt5WithTimeout = orig;
      return {esiti, chiamate: window.__chiamate, slInvariato: pos.sl === slPrima};
    });
    assert.equal(r.chiamate.length, 0, 'in replay non deve partire NESSUNA chiamata al bridge MT5: ' + JSON.stringify(r.chiamate));
    assert.notEqual(r.esiti.chiudi, true, 'la chiusura reale non deve andare a buon fine in replay');
    assert.notEqual(r.esiti.spostaStop, true, 'lo spostamento dello stop reale non deve andare a buon fine in replay');
    assert.equal(r.slInvariato, true, 'lo stop della posizione non deve essere stato toccato: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
