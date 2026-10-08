// OPERAZIONI A BLOCCO SULLE POSIZIONI APERTE, come su MetaTrader 5.
//
// RICHIESTO dal proprietario (8 ottobre 2026): «un unico pulsante che, premuto, fa vedere tramite
// menu a tendina: chiudi tutte, chiudi quelle in guadagno, chiudi quelle in perdita, chiudi le
// sell, e addirittura chiudi l'asset selezionato - con dentro la direzione, buy o sell».
//
// Qui si chiudono posizioni a gruppi, quindi un filtro sbagliato chiude roba che non doveva
// chiudere. Questi test guardano CHI finisce dentro ogni voce, prima ancora di come e' fatto il
// menu: e' la parte che costa soldi se e' sbagliata.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Sei posizioni: due su oro (una buy in guadagno, una sell in perdita), due su euro-dollaro,
// una su indice, e una senza prezzo noto (asset mai portato a grafico).
const SCENA = () => {
  positions = [
    {id: 'a', asset: 'XAUUSD', side: 'BUY',  entry: 4100, lots: 0.1, sl: 4080, tp: 4150},
    {id: 'b', asset: 'XAUUSD', side: 'SELL', entry: 4100, lots: 0.1, sl: 4120, tp: 4050},
    {id: 'c', asset: 'EURUSD', side: 'BUY',  entry: 1.080, lots: 0.2, sl: 1.075, tp: 1.090},
    {id: 'd', asset: 'EURUSD', side: 'SELL', entry: 1.080, lots: 0.2, sl: 1.085, tp: 1.070},
    {id: 'e', asset: 'US30',   side: 'BUY',  entry: 40000, lots: 0.3, sl: 39800, tp: 40500},
    {id: 'f', asset: 'MAI_VISTO', side: 'BUY', entry: 10, lots: 0.1, sl: 9, tp: 11}
  ];
  // Prezzi di adesso: l'oro e salito, l'euro-dollaro e sceso, l'indice e fermo.
  livePriceByAsset['XAUUSD'] = 4130;
  livePriceByAsset['EURUSD'] = 1.075;
  livePriceByAsset['US30'] = 40000;
  delete livePriceByAsset['MAI_VISTO'];
  currentAssetKey = 'XAUUSD';
};

async function quali(pagina, filtro) {
  return await pagina.evaluate(([scena, f]) => {
    eval('(' + scena + ')')();
    const fn = eval('(' + f + ')');
    return fblPosizioniBlocco().filter(fn).map(p => p.id).sort();
  }, [SCENA.toString(), filtro.toString()]);
}

test('il P/L di ogni posizione si legge col prezzo del SUO asset, non di quello a grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((scena) => {
      eval('(' + scena + ')')();
      const m = {};
      positions.forEach(p => { const v = fblPlCorrente(p); m[p.id] = v == null ? null : (v > 0 ? 'su' : (v < 0 ? 'giu' : 'zero')); });
      return m;
    }, SCENA.toString());
    assert.equal(r.a, 'su',  'oro comprato a 4100 e ora a 4130: in guadagno');
    assert.equal(r.b, 'giu', 'oro venduto a 4100 e ora a 4130: in perdita');
    assert.equal(r.c, 'giu', 'euro-dollaro comprato a 1.080 e ora a 1.075: in perdita');
    assert.equal(r.d, 'su',  'euro-dollaro venduto a 1.080 e ora a 1.075: in guadagno');
    assert.equal(r.f, null,  'di questo asset non si ha il prezzo: il risultato non si puo dire');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('chiudi quelle in guadagno e chiudi quelle in perdita non si sovrappongono mai', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const su = await quali(pagina, p => { const v = fblPlCorrente(p); return v != null && v > 0; });
    const giu = await quali(pagina, p => { const v = fblPlCorrente(p); return v != null && v < 0; });
    assert.deepEqual(su, ['a', 'd']);
    assert.deepEqual(giu, ['b', 'c']);
    const comuni = su.filter(x => giu.includes(x));
    assert.deepEqual(comuni, [], 'una posizione non puo essere insieme in guadagno e in perdita');
    // Quella senza prezzo non deve finire ne' di qua ne' di la': non si sa come sta.
    assert.ok(!su.includes('f') && !giu.includes('f'), 'senza prezzo non si decide, non si indovina');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('per direzione: le buy sono le buy, le sell sono le sell', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const buy = await quali(pagina, p => String(p.side).toUpperCase() === 'BUY');
    const sell = await quali(pagina, p => String(p.side).toUpperCase() === 'SELL');
    assert.deepEqual(buy, ['a', 'c', 'e', 'f']);
    assert.deepEqual(sell, ['b', 'd']);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un asset alla volta, e dentro la direzione: tocca solo quelle di quel nome', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const oro = await quali(pagina, p => String(p.asset || '') === 'XAUUSD');
    const oroBuy = await quali(pagina, p => String(p.asset || '') === 'XAUUSD' && String(p.side).toUpperCase() === 'BUY');
    const oroSell = await quali(pagina, p => String(p.asset || '') === 'XAUUSD' && String(p.side).toUpperCase() === 'SELL');
    assert.deepEqual(oro, ['a', 'b'], 'solo le posizioni su oro, non quelle sugli altri');
    assert.deepEqual(oroBuy, ['a']);
    assert.deepEqual(oroSell, ['b']);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il menu elenca gli asset aperti, e dice quante posizioni tocca ogni voce', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((scena) => {
      eval('(' + scena + ')')();
      fblBloccoCostruisci();
      const voci = [...document.querySelectorAll('#fblBloccoVoci button')].map(b => b.textContent);
      return {
        voci,
        tutte: voci.find(v => v.indexOf('Chiudi tutte le posizioni') === 0),
        haOro: voci.some(v => v.indexOf('Chiudi XAUUSD') === 0),
        haEur: voci.some(v => v.indexOf('Chiudi EURUSD') === 0),
        haDirezioni: voci.some(v => /XAUUSD BUY/.test(v)) && voci.some(v => /XAUUSD SELL/.test(v))
      };
    }, SCENA.toString());
    assert.equal(r.tutte, 'Chiudi tutte le posizioni  (6)', 'ogni voce deve dire quante ne tocca');
    assert.equal(r.haOro, true);
    assert.equal(r.haEur, true);
    assert.equal(r.haDirezioni, true, 'dentro ogni asset ci devono essere buy e sell separate');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza posizioni aperte il menu non propone niente da chiudere', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      positions = [];
      fblBloccoCostruisci();
      return {
        bottoni: document.querySelectorAll('#fblBloccoVoci button').length,
        testo: document.getElementById('fblBloccoVoci').textContent
      };
    });
    assert.equal(r.bottoni, 0, 'nessun pulsante: non c e niente da chiudere');
    assert.match(r.testo, /Nessuna posizione aperta/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
