// RAGGRUPPARE LE POSIZIONI DI UNO STESSO INGRESSO.
//
// SEGNALATO dal proprietario (8 ottobre 2026): «una sala con una posizione si comprime e si
// espande, un'altra con 5 posizioni no». Causa: si raggruppava solo con l'entrata IDENTICA, e
// dieci ordini non si aprono tutti nello stesso istante allo stesso prezzo. Sua la diagnosi:
// «ci puo' stare che ci sia una differenza di prezzo tra l'una e l'altra, capisci in automatico
// che hanno un minimo di margine e falle restare unite».
//
// Due regole, in quest'ordine: il codice del segnale quando c'e' (certo), la vicinanza di prezzo
// e orario quando non c'e' (stima). La stima non deve mai unire cose di segnali diversi.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Oro: entrata 4133, stop 4151 -> distanza 18, quindi tolleranza 2,7 punti.
const ORO = (extra) => Object.assign({
  id: 'P' + Math.random().toString(36).slice(2, 8), asset: 'XAUUSD', side: 'SELL',
  entry: 4133, sl: 4151, rrSl: 4151, tp: 4110, lots: 0.03, marginUsed: 10,
  tgSala: 'Gold Signals VIP', startTime: Date.UTC(2026, 9, 8, 6, 0, 0)
}, extra || {});

async function raggruppa(pagina, posizioni) {
  return await pagina.evaluate((ps) => {
    const righe = ps.map(p => ({item: p, sessionKey: 'live'}));
    return fblPosRaggruppa(righe).map(g => ({
      quante: g.righe.length,
      entrate: g.righe.map(r => r.item.entry),
      sala: g.righe[0].item.tgSala || null
    }));
  }, posizioni);
}

test('cinque riempimenti a prezzi leggermente diversi restano un gruppo solo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // E' il caso che non funzionava: stessa sala, stesso segnale, prezzi che ballano di poco.
    const g = await raggruppa(pagina, [
      ORO({entry: 4133.0}), ORO({entry: 4133.4}), ORO({entry: 4132.8}),
      ORO({entry: 4133.9}), ORO({entry: 4132.5})
    ]);
    assert.equal(g.length, 1, 'dovevano restare uniti, invece sono ' + g.length + ' gruppi');
    assert.equal(g[0].quante, 5);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('due entrate lontane fra loro NON si uniscono, anche se la sala e la stessa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // 4133 e 4160: ventisette punti, dieci volte la tolleranza. Sono due ingressi diversi.
    const g = await raggruppa(pagina, [ORO({entry: 4133}), ORO({entry: 4160})]);
    assert.equal(g.length, 2, 'due ingressi distinti non devono finire insieme');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('stesso prezzo ma a ore di distanza: sono due ingressi, non uno', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const g = await raggruppa(pagina, [
      ORO({entry: 4133, startTime: Date.UTC(2026, 9, 8, 6, 0, 0)}),
      ORO({entry: 4133, startTime: Date.UTC(2026, 9, 8, 11, 0, 0)})
    ]);
    assert.equal(g.length, 2, 'cinque ore dopo e un altro segnale, anche allo stesso prezzo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il codice del segnale comanda: stesso segnale sempre insieme, anche se il prezzo e lontano', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // Un ordine in attesa puo' scattare molto dopo e molto piu' in la': resta del suo segnale.
    const g = await raggruppa(pagina, [
      ORO({entry: 4133, tgGruppo: 'sg1'}),
      ORO({entry: 4190, tgGruppo: 'sg1', startTime: Date.UTC(2026, 9, 8, 15, 0, 0)}),
      ORO({entry: 4134, tgGruppo: 'sg1'})
    ]);
    assert.equal(g.length, 1, 'le tre posizioni sono dello stesso segnale: un gruppo solo');
    assert.equal(g[0].quante, 3);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('segnali diversi non si mescolano mai, nemmeno allo stesso identico prezzo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const g = await raggruppa(pagina, [
      ORO({entry: 4133, tgGruppo: 'sg1'}), ORO({entry: 4133, tgGruppo: 'sg2'})
    ]);
    assert.equal(g.length, 2, 'due segnali diversi devono restare due gruppi');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('sale diverse, asset diversi e direzioni diverse restano separati', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const g = await raggruppa(pagina, [
      ORO({entry: 4133}),
      ORO({entry: 4133, tgSala: 'SALA STARK'}),
      ORO({entry: 4133, asset: 'EURUSD'}),
      ORO({entry: 4133, side: 'BUY'})
    ]);
    assert.equal(g.length, 4, 'quattro cose diverse: quattro gruppi');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la tolleranza si adatta allo strumento: quella dell oro spaccherebbe l euro-dollaro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => ({
      oro: fblTolleranzaEntrata({entry: 4133, sl: 4151, rrSl: 4151}),
      eur: fblTolleranzaEntrata({entry: 1.0850, sl: 1.0820, rrSl: 1.0820}),
      senzaStop: fblTolleranzaEntrata({entry: 4133})
    }));
    // Mezzo punto sull'oro e' niente; sull'euro-dollaro sarebbe mezzo prezzo.
    assert.ok(r.oro > 2 && r.oro < 4, 'tolleranza oro fuori scala: ' + r.oro);
    assert.ok(r.eur > 0.0003 && r.eur < 0.0006, 'tolleranza euro-dollaro fuori scala: ' + r.eur);
    assert.ok(r.senzaStop > 0, 'senza stop deve comunque esserci una tolleranza');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le posizioni aperte a mano restano ognuna per se', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const g = await raggruppa(pagina, [
      ORO({entry: 4133, tgSala: undefined}), ORO({entry: 4133, tgSala: undefined})
    ]);
    assert.equal(g.length, 2, 'senza sala non si raggruppa: le hai aperte tu, una per una');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
