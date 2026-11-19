// IL REPLAY PARTE SU TUTTE LE FINESTRE: I COMANDI DEVONO COMPARIRE SU TUTTE.
//
// SEGNALATO dal proprietario (19 novembre 2026), con il dettaglio che ha permesso di riprodurlo:
// «finestra separata; il replay parte da tutte le finestre che ci sono, main e duplicate; i
// pulsanti ci sono SOLO nella finestra dove e' stato lanciato il replay e non sono visibili
// nelle altre finestre».
//
// CAUSA, letta nel codice e misurata qui: la finestra che RICEVE l'annuncio `replay_sync` entra
// davvero in replay (`fblReplayApplicaIstante` mette `liveReplayActive=true`) e chiama `update()`,
// ma NON chiama mai `updateLiveReplayUI()` - che e' l'unica funzione che mostra la barra del
// replay, le frecce ◀ ▶, il PLAY, il moltiplicatore di velocita' e il pulsante ESCI. Chi lancia
// il replay passa da `avviaReplayLive`, che invece la chiama: ecco perche' i comandi si vedono
// solo li'.
//
// LA REGOLA: entrare in replay e MOSTRARE i comandi del replay sono la stessa cosa. Una finestra
// che e' dentro al replay ma non puo' avanzare di una candela e' peggio di una che non c'e'
// entrata: sembra rotta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Una finestra duplicata in Live, ferma in diretta, che riceve l'annuncio di un'altra.
const SCENA = `(() => {
  currentAssetKey = 'XAUUSD'; rowsAssetKey = 'XAUUSD';
  rows = [];
  for (let i = 0; i < 40; i++) {
    const p = 4200 - i * 5;
    rows.push({date: new Date(Date.UTC(2026, 10, 1, 10, i, 0)).toISOString(),
      open: p, high: p + 2, low: p - 2, close: p, volume: 1});
  }
  baseRows = rows.slice();
  csvLibrary = [{id: 'mt5_live_XAUUSD', rows: rows.slice()}];
  idx = rows.length - 1; viewEnd = idx; visibleCount = 30;
  liveModeActive = true; liveReplayActive = false;
  trades = []; positions = [];
  try { updateLiveReplayUI(); } catch (e) {}
  try { update(); draw(); } catch (e) {}
  return {replayPrima: !!liveReplayActive};
})()`;

// Lo stato dei comandi, come lo vedrebbe l'utente.
const COMANDI = `(() => {
  const v = id => {
    const el = document.getElementById(id);
    if (!el) return 'assente';
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') return 'nascosto';
    return 'visibile';
  };
  return {barra: v('liveReplayBar'), esci: v('liveReplayStopBtn'),
          indietro: v('pipHistBackBtn'), avanti: v('pipHistNextBtn'),
          play: v('play'), velocita: v('speed'), inReplay: !!liveReplayActive};
})()`;

test('la finestra che riceve l avvio entra in replay E mostra i suoi comandi', async () => {
  const {browser, pagina, errori} = await apriApp({query: '?pipSlot=2'});
  try {
    const r = await pagina.evaluate(`(() => {
      const prima = ${SCENA};
      // L'annuncio che arriva dall'altra finestra, identico a quello che viaggia davvero
      // sul canale (vedi fblAnnunciaReplay): modo «avvia», con l'istante scelto.
      const istante = Date.parse(rows[20].date);
      // Il messaggio entra dalla stessa porta da cui entra davvero: tradingChannel.onmessage.
      tradingChannel.onmessage({data: {type: 'replay_sync', slot: 0, at: Date.now(),
        asset: 'XAUUSD', modo: 'avvia', attivo: true, t: istante}});
      return {prima, dopo: ${COMANDI}};
    })()`);

    assert.equal(r.prima.replayPrima, false, 'premessa: questa finestra era in diretta');
    assert.equal(r.dopo.inReplay, true, 'ricevuto l annuncio, la finestra deve essere in replay');
    assert.equal(r.dopo.esci, 'visibile', 'manca il pulsante ESCI');
    assert.equal(r.dopo.indietro, 'visibile', 'manca la freccia indietro');
    assert.equal(r.dopo.avanti, 'visibile', 'manca la freccia avanti');
    assert.equal(r.dopo.play, 'visibile', 'manca il PLAY');
    assert.equal(r.dopo.velocita, 'visibile', 'manca il moltiplicatore di velocita');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('e quando il replay finisce da un altra finestra, i comandi spariscono', async () => {
  // La prova di controllo: se i comandi restassero accesi dopo l'uscita, la finestra direbbe
  // una cosa falsa nell'altro verso.
  const {browser, pagina, errori} = await apriApp({query: '?pipSlot=2'});
  try {
    const r = await pagina.evaluate(`(() => {
      ${SCENA};
      const istante = Date.parse(rows[20].date);
      // Il messaggio entra dalla stessa porta da cui entra davvero: tradingChannel.onmessage.
      tradingChannel.onmessage({data: {type: 'replay_sync', slot: 0, at: Date.now(),
        asset: 'XAUUSD', modo: 'avvia', attivo: true, t: istante}});
      const dentro = ${COMANDI};
      tradingChannel.onmessage({data: {type: 'replay_sync', slot: 0, at: Date.now(),
        asset: 'XAUUSD', modo: 'stop', attivo: false, t: istante}});
      return {dentro, fuori: ${COMANDI}};
    })()`);

    assert.equal(r.dentro.inReplay, true, 'premessa: prima era in replay');
    assert.equal(r.fuori.inReplay, false, 'con lo stop deve uscire dal replay');
    assert.equal(r.fuori.esci, 'nascosto', 'uscito dal replay, il pulsante ESCI non ha piu senso');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
