// UNA POSIZIONE APERTA A MANO, MA SU UN SEGNALE: deve portare il nome della sala.
//
// CHIARITO dal proprietario (8 ottobre 2026): «sono quelle operazioni che quando arriva il segnale
// l'app non le apre e mi dice di aprirle manualmente. Anche se la apro io a mano non deve
// risultare "tu", deve risultare il nome della sala segnali».
//
// Il rischio e' attribuirne una alla sala SBAGLIATA: falserebbe il profitto per sala e il win rate
// per sala in positivo o in negativo, senza che si veda. Per questo le condizioni sono strette e
// valgono tutte insieme, e nel dubbio si lascia senza sala.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SEGNALE = (extra) => Object.assign({
  id: 's1', chat: 'Gold Signals VIP', sala: '@gold', stato: 'nuovo',
  ricevuto_ms: Date.now() - 60000,
  segnale: {strumento: 'XAUUSD', direzione: 'SELL', entrata: 4133, stop_loss: 4151, take_profit: [4110]}
}, extra || {});

async function prova(pagina, segnali, posizione) {
  return await pagina.evaluate(([sg, pos]) => {
    tgSegnaliRicevuti = sg;
    const p = Object.assign({}, pos);
    fblAttribuisciSegnale(p);
    return {sala: p.tgSala || null, aMano: !!p.tgAMano, idSegnale: p.tgSegnaleId || null};
  }, [segnali, posizione]);
}

test('aperta a mano poco dopo il segnale: porta il nome della sala', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await prova(pagina, [SEGNALE()], {asset: 'XAUUSD', side: 'SELL', entry: 4134});
    assert.equal(r.sala, 'Gold Signals VIP');
    assert.equal(r.aMano, true, 'va marcata come aperta a mano su quel segnale, non come automatica');
    assert.equal(r.idSegnale, 's1');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('lo strumento scritto in modi diversi e lo stesso mercato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => ({
      conPrefisso: fblStessoStrumento('OANDA:XAU/USD', 'XAUUSD'),
      conBarra: fblStessoStrumento('EUR/USD', 'EURUSD'),
      diversi: fblStessoStrumento('XAUUSD', 'EURUSD'),
      vuoto: fblStessoStrumento('', 'XAUUSD')
    }));
    assert.equal(r.conPrefisso, true);
    assert.equal(r.conBarra, true);
    assert.equal(r.diversi, false, 'oro ed euro-dollaro non sono lo stesso mercato');
    assert.equal(r.vuoto, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('direzione diversa, asset diverso o segnale vecchio: nessuna attribuzione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const direzione = await prova(pagina, [SEGNALE()], {asset: 'XAUUSD', side: 'BUY'});
    const asset = await prova(pagina, [SEGNALE()], {asset: 'EURUSD', side: 'SELL'});
    const vecchio = await prova(pagina, [SEGNALE({ricevuto_ms: Date.now() - 5 * 3600000})], {asset: 'XAUUSD', side: 'SELL'});
    assert.equal(direzione.sala, null, 'il segnale era SELL: una BUY non e sua');
    assert.equal(asset.sala, null);
    assert.equal(vecchio.sala, null, 'cinque ore dopo non e piu «quel segnale di prima»');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un segnale gia aperto dall app, o messo via, non si prende altre posizioni', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const eseguito = await prova(pagina, [SEGNALE({stato: 'eseguito'})], {asset: 'XAUUSD', side: 'SELL'});
    const ignorato = await prova(pagina, [SEGNALE({stato: 'ignorato'})], {asset: 'XAUUSD', side: 'SELL'});
    assert.equal(eseguito.sala, null, 'quel segnale l app lo aveva gia aperto: questa e un altra cosa');
    assert.equal(ignorato.sala, null);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('fra piu segnali validi vince il piu recente, quello appena letto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await prova(pagina, [
      SEGNALE({id: 'vecchio', chat: 'Sala Vecchia', ricevuto_ms: Date.now() - 90 * 60000}),
      SEGNALE({id: 'nuovo', chat: 'Sala Nuova', ricevuto_ms: Date.now() - 2 * 60000})
    ], {asset: 'XAUUSD', side: 'SELL'});
    assert.equal(r.sala, 'Sala Nuova');
    assert.equal(r.idSegnale, 'nuovo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una posizione che ha gia una provenienza non viene toccata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await prova(pagina, [SEGNALE({chat: 'Sala Nuova'})],
      {asset: 'XAUUSD', side: 'SELL', tgSala: 'Sala Originale', tgGruppo: 'sg1'});
    assert.equal(r.sala, 'Sala Originale', 'era gia attribuita: non si sovrascrive');
    assert.equal(r.aMano, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza nessun segnale in attesa, la posizione resta tua', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await prova(pagina, [], {asset: 'XAUUSD', side: 'SELL'});
    assert.equal(r.sala, null, 'nessun segnale: quella l hai aperta davvero tu');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
