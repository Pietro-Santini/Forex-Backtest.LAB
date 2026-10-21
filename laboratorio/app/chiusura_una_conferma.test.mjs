// CHIUDERE PIU' POSIZIONI INSIEME: UNA CONFERMA SOLA.
//
// RICHIESTO dal proprietario: «quando l'utente decide di chiudere più posizioni insieme non gli
// deve venire fuori la conferma della chiusura ad ogni posizione; se clicca chiudi x posizioni gli
// viene fuori soltanto un messaggio di conferma per la chiusura di tutte, poi l'applicazione se
// confermato le chiude tutte quelle selezionate. Stessa cosa anche per le operazioni in blocco».
//
// DOV'ERA IL DIFETTO. Non nelle funzioni di blocco — quelle una conferma la chiedevano già — ma
// dentro al ciclo: `closeMt5PositionReal` apriva un popup suo per OGNI posizione reale. Con cinque
// posizioni MT5 erano cinque popup in fila dopo quello del blocco, e un «sì» di troppo chiudeva
// quello che non si voleva. Le posizioni simulate non chiedevano niente, quindi il difetto si
// vedeva SOLO sul conto MT5 reale — ed è per questo che sembrava capriccioso.
//
// E il pulsante CHIUDI TUTTE era messo peggio: non chiedeva NESSUNA conferma complessiva e si
// appoggiava a quelle singole. Il messaggio di stato lo diceva pure: «per quelle REALI su MT5,
// conferma la chiusura nel popup comparso». Il difetto era scritto nell'interfaccia.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Tre posizioni REALI su MT5 sull'asset a grafico. Reali perché è lì che si vedeva il difetto.
const PREPARA = () => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++) {
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: 100, high: 100.5, low: 99.5, close: 100.2, volume: 5});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD'; if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; mt5Connected = false;
  trades = []; active = null; pendingOrders = []; positions = [];
  for (let i = 0; i < 3; i++) positions.push({
    id: 'R' + i, asset: 'EURUSD', side: 'BUY', entry: 100, sl: 99, rrSl: 99, tp: 101 + i,
    lots: 0.1, marginUsed: 10, start: 10, startTime: t0 + 10 * 60000,
    mt5Ticket: 900 + i
  });
  // Si conta quante volte viene chiesta una conferma. closeMt5PositionReal resta QUELLA VERA:
  // è il suo popup il difetto, quindi fingerla vorrebbe dire non misurare niente.
  window._conferme = [];
  window.appConfirm = async (testo) => { window._conferme.push(String(testo || '')); return true; };
  appConfirm = window.appConfirm;
  // Il ponte MT5 risponde sempre di sì: qui si misura la conferma, non la rete.
  window.fetchMt5WithTimeout = async () => ({ok: true, data: {price: 100.2}});
  window.fetchMt5Positions = () => {};
  window.mt5RealPositions = [];
  update();
};

test('operazioni a blocco: una conferma sola per tre posizioni reali', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      await fblChiudiBlocco(() => true, 'Tutte le posizioni');
      return {conferme: window._conferme.length, aperte: positions.length, chiuse: trades.length,
              testo: window._conferme[0] || ''};
    }, PREPARA.toString());
    assert.equal(r.conferme, 1,
      'una sola domanda per tutte e tre, non una per posizione: ' + r.conferme);
    assert.equal(r.aperte, 0, 'e dopo il «sì» si chiudono tutte');
    assert.equal(r.chiuse, 3, 'tutte e tre nel Trade Journal');
    assert.match(r.testo, /3 posizioni/, 'la domanda deve dire quante sono: ' + r.testo);
    assert.match(r.testo, /REALI sul conto MT5/i, 'e che sono vere, non una simulazione: ' + r.testo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CHIUDI TUTTE: una conferma sola, e dice quante e quanto rendono', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      await document.getElementById('closeAll').onclick();
      await new Promise(res => setTimeout(res, 100));
      return {conferme: window._conferme.length, testo: window._conferme[0] || '',
              aperte: positions.length, stato: document.getElementById('status').textContent};
    }, PREPARA.toString());
    assert.equal(r.conferme, 1,
      'prima questo pulsante non chiedeva niente e lasciava i popup alle singole: ' + r.conferme);
    assert.match(r.testo, /3 posizioni/, 'la domanda deve dire quante: ' + r.testo);
    assert.match(r.testo, /Risultato di adesso/, 'e quanto rendono adesso: ' + r.testo);
    assert.equal(r.aperte, 0, 'dopo il «sì» si chiudono tutte');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('chi annulla non chiude niente, in tutte e due le strade', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      window.appConfirm = async () => false; appConfirm = window.appConfirm;
      await fblChiudiBlocco(() => true, 'Tutte le posizioni');
      const dopoBlocco = positions.length;
      await document.getElementById('closeAll').onclick();
      await new Promise(res => setTimeout(res, 100));
      return {dopoBlocco, dopoTutte: positions.length, chiuse: trades.length};
    }, PREPARA.toString());
    assert.equal(r.dopoBlocco, 3, 'annullando il blocco non si chiude niente');
    assert.equal(r.dopoTutte, 3, 'annullando CHIUDI TUTTE nemmeno');
    assert.equal(r.chiuse, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la chiusura di UNA posizione reale continua a chiedere conferma', async () => {
  // Il confine: togliere la conferma di troppo non deve togliere quella che serve. Chiudere una
  // singola posizione vera, premendo il suo pulsante, resta una cosa che si conferma.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      await closeMt5PositionReal(positions[0], 'MANUAL');
      return {conferme: window._conferme.length, testo: window._conferme[0] || ''};
    }, PREPARA.toString());
    assert.equal(r.conferme, 1, 'una chiusura singola si conferma');
    assert.match(r.testo, /Chiudere DAVVERO/i, 'ed e\' la domanda della singola: ' + r.testo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CHIUDI TUTTE dice che le posizioni di altri asset restano aperte', async () => {
  // Chiude solo l'asset a grafico (per gli altri non c'è un prezzo valido adesso). Prima lo si
  // scopriva dopo, vedendole ancora lì: ora lo dice nella domanda e nel messaggio finale.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      positions.push({id: 'ALTRO', asset: 'XAUUSD', side: 'BUY', entry: 4000, sl: 3900,
                      lots: 0.1, marginUsed: 10, start: 10, startTime: Date.now() - 3600000,
                      mt5Ticket: 999});
      await document.getElementById('closeAll').onclick();
      await new Promise(res => setTimeout(res, 100));
      return {testo: window._conferme[0] || '', rimaste: positions.length,
              stato: document.getElementById('status').textContent};
    }, PREPARA.toString());
    assert.match(r.testo, /altri asset/i, 'la domanda deve dirlo: ' + r.testo);
    assert.equal(r.rimaste, 1, 'quella di XAUUSD resta aperta');
    assert.match(r.stato, /altri asset/i, 'e anche il messaggio finale: ' + r.stato);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
