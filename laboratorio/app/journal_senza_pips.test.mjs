// UN'OPERAZIONE SENZA `pips` NON DEVE ROMPERE IL TRADE JOURNAL.
//
// TROVATO il 28 ottobre 2026 dal collaudo completo, e non da un test scritto apposta:
// cloud_incrementale pretende che la pagina non abbia MAI errori JS, e si e' accorto di un
// «Cannot read properties of undefined (reading 'toFixed')» che veniva da tutt'altra parte.
//
// LA CAUSA: nella riga del Trade Journal c'era `t.pips.toFixed(1)` senza protezione, mentre la
// riga SUBITO SOTTO ce l'aveva gia' per `t.pct` - due campi uguali, uno difeso e uno no. E quella
// riga gira dentro una `map()`: basta UNA operazione senza quel campo e salta il disegno
// dell'INTERO Trade Journal. Non la sua riga: tutte.
//
// E non e' un caso di laboratorio. Le operazioni arrivano anche da Firestore e dal server Oracle
// (tradesLeggi / serverTradesLeggi): una salvata da una versione che non scriveva `pips`, o
// arrivata monca da una sincronizzazione interrotta, basterebbe a lasciare l'utente con una
// tabella vuota e nessuna spiegazione.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const OP = (i, extra) => Object.assign({
  id: 't' + i, mode: 'backtest', asset: 'EURUSD', side: i % 2 ? 'BUY' : 'SELL',
  entry: 1.1000, exit: 1.1050, lots: 0.1, pl: 12.5, pct: 0.5, pips: 50,
  account: 10000, openTime: 1700000000000 + i * 3600000,
  closeTime: 1700003600000 + i * 3600000
}, extra || {});

async function disegna(operazioni){
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((ops) => {
      trades = ops;
      update();
      const tb = document.getElementById('journal');
      return {righe: tb ? tb.querySelectorAll('tr').length : -1};
    }, operazioni);
    return {r, errori};
  } finally { await browser.close(); }
}

test('un\'operazione SENZA pips non impedisce il disegno delle altre', async () => {
  const ops = [OP(1), OP(2, {pips: undefined}), OP(3)];
  const {r, errori} = await disegna(ops);
  assert.deepEqual(errori, [],
    'nessun errore JS: con `t.pips.toFixed()` senza protezione saltava tutta la tabella');
  assert.ok(r.righe >= 3,
    'le tre operazioni devono comparire lo stesso, era ' + r.righe + ' righe');
});

test('vale anche per pips nullo o non numerico', async () => {
  // Da una sincronizzazione interrotta puo' arrivare null, una stringa vuota, o del testo.
  const ops = [OP(1, {pips: null}), OP(2, {pips: ''}), OP(3, {pips: 'boh'}), OP(4)];
  const {r, errori} = await disegna(ops);
  assert.deepEqual(errori, [], 'nessun errore JS con pips nullo, vuoto o non numerico');
  assert.ok(r.righe >= 4, 'tutte e quattro le righe devono esserci, era ' + r.righe);
});

test('PROVA DI CONTROLLO: coi pips buoni il numero si vede davvero', async () => {
  // Senza questa, i due test qui sopra passerebbero anche con un codice che non mostra MAI i
  // pips - cioe' «riparato» togliendo l'informazione invece di difenderla.
  const {browser, pagina, errori} = await apriApp();
  try {
    const testo = await pagina.evaluate((ops) => {
      trades = ops;
      update();
      const tb = document.getElementById('journal');
      return tb ? tb.textContent : '';
    }, [OP(1, {pips: 42.7})]);
    assert.ok(testo.indexOf('42.7') >= 0 || testo.indexOf('42,7') >= 0,
      'un pips valido deve comparire nella tabella: non si ripara nascondendo il dato');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
