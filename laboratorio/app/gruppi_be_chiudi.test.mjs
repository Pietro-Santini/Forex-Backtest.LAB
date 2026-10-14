// SUL GRUPPO DI POSIZIONI: TUTTI A PAREGGIO, OPPURE CHIUDI TUTTO.
//
// RICHIESTO dal proprietario: «dobbiamo inserire un pulsante BE e chiudi: col BE imposteremo tutte
// le posizioni a BE, col chiudi chiudiamo tutte quelle posizioni appartenenti a quel gruppo in
// un'unica botta... e ci farà vedere anche un resoconto del guadagno, quindi il profitto o la
// perdita, quando eseguiamo questa chiusura al gruppo».
//
// Un segnale con cinque target apre cinque posizioni, che nella tabella stanno in una riga sola:
// da lì si devono poter fare le due cose che si fanno davvero su un gruppo.
//
// Come si prova che il test serve: senza i pulsanti e senza fblGruppoPareggio il primo test va
// rosso con "not a function".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

// Cinque posizioni dello stesso segnale sull'asset a grafico, come ne nascono davvero.
const PREPARA = () => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++) {
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: 100, high: 100.5, low: 99.5, close: 100.2, volume: 5});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD'; if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; mt5Connected = false;
  trades = []; active = null;
  positions = [];
  for (let i = 0; i < 5; i++) positions.push({
    id: 'P' + i, asset: 'EURUSD', side: 'BUY', entry: 100, sl: 99, rrSl: 99, tp: 101 + i,
    lots: 0.1, marginUsed: 10, start: 10, startTime: t0 + 10 * 60000,
    tgSala: 'Gold Signals VIP', tgGruppo: 'sgTEST', tgTpIndice: i + 1
  });
  window.appConfirm = async () => true;
  appConfirm = window.appConfirm;
  update();
  return [...fblPosGruppiIds.keys()];
};

test('la riga del gruppo ha i pulsanti BE e Chiudi, e sa quali posizioni tocca', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      const chiavi = eval('(' + p + ')')();
      const riga = document.querySelector('#openPositions tr.fblPosGruppo');
      return {
        chiavi,
        be: !!(riga && riga.querySelector('[data-posgruppo-be]')),
        chiudi: !!(riga && riga.querySelector('[data-posgruppo-chiudi]')),
        ids: chiavi.length ? fblPosGruppiIds.get(chiavi[0]).ids : []
      };
    }, PREPARA.toString());
    assert.equal(r.chiavi.length, 1, 'le cinque posizioni devono fare UN gruppo solo');
    assert.equal(r.be, true, 'manca il pulsante BE sulla riga del gruppo');
    assert.equal(r.chiudi, true, 'manca il pulsante Chiudi sulla riga del gruppo');
    assert.deepEqual(r.ids.sort(), ['P0', 'P1', 'P2', 'P3', 'P4'], 'il gruppo deve conoscere le sue cinque posizioni');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('BE porta a pareggio lo stop di TUTTE le posizioni del gruppo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      const chiavi = eval('(' + p + ')')();
      const slPrima = positions.map(x => x.sl);
      await fblGruppoPareggio(fblPosGruppiIds.get(chiavi[0]));
      return {slPrima, slDopo: positions.map(x => x.sl), entrate: positions.map(x => x.entry),
              marcate: positions.filter(x => x.beMarkerSl != null).length};
    }, PREPARA.toString());
    assert.deepEqual(r.slPrima, [99, 99, 99, 99, 99]);
    assert.deepEqual(r.slDopo, r.entrate, 'ogni stop deve finire sul pareggio della SUA posizione');
    assert.equal(r.marcate, 5, 'il Journal deve poter riconoscere queste chiusure come «BE», non come un generico stop');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('Chiudi chiude tutte e cinque in un colpo e dice quanto ha reso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      const chiavi = eval('(' + p + ')')();
      const g = fblPosGruppiIds.get(chiavi[0]);
      await fblChiudiBlocco(x => x && g.ids.indexOf(String(x.id)) >= 0, 'Gruppo ' + g.descr);
      return {aperteDopo: positions.length, chiuse: trades.length,
              stato: document.getElementById('status').textContent};
    }, PREPARA.toString());
    assert.equal(r.aperteDopo, 0, 'tutte e cinque devono chiudersi, in un colpo');
    assert.equal(r.chiuse, 5, 'e finire nel Trade Journal');
    assert.match(r.stato, /Chiuse 5 posizioni/, 'il messaggio deve dire quante: ' + r.stato);
    assert.match(r.stato, /risultato/, 'e deve dire QUANTO ha reso: ' + r.stato);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('sulle sessioni che non sono a schermo i due pulsanti non compaiono', () => {
  // Le altre tre sessioni non hanno le loro posizioni in `positions`: un pulsante che non puo'
  // funzionare e' peggio di un pulsante che non c'e'.
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  assert.match(src, /const gruppoAgibile=\(primo\.sessionKey===currentMode\(\)\);/,
    'i pulsanti del gruppo devono valere solo per la sessione a schermo');
  assert.match(src, /const azioniG=gruppoAgibile/, 'e non devono nemmeno essere scritti per le altre');
});
