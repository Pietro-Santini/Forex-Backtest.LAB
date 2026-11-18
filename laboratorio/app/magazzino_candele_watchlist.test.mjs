// IL MAGAZZINO DELLE CANDELE SEGUE LA WATCHLIST, NON UN NUMERO.
//
// DECISIONE DEL PROPRIETARIO (18 novembre 2026), sul tetto che c'era prima:
// «questo lo voglio implementare solo per gli asset messi nella watchlist e non per 12 asset».
//
// COM'ERA: `FBL_CANDLE_CACHE_MAX=12` teneva le ultime 12 voci asset+timeframe usate, chiunque
// fossero. Bastava guardare dodici asset di passaggio per far buttare le candele dei suoi,
// e allo stesso modo dodici asset di passaggio restavano in magazzino a occupare spazio.
//
// COM'E' ORA: in magazzino restano le voci degli asset della watchlist (quelli con la stellina,
// al massimo dieci) PIU' quelle dell'asset che si sta guardando adesso - altrimenti aprire un
// asset fuori watchlist vorrebbe dire riscaricare tutto il suo storico a ogni sguardo, e la
// cura peggiorerebbe proprio la cosa per cui il magazzino esiste. Tutto il resto si lascia
// andare: sono candele, si riscaricano dal ponte.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Scrive in magazzino una serie finta di `n` candele per asset+tf, come fa il caricamento vero.
const SCRIVI = `async (asset, tf, n) => {
  const righe=[]; const t0=1763400000;
  for(let i=0;i<(n||3);i++){ const p=100+i*0.1; righe.push({time:t0+i*60, date:new Date((t0+i*60)*1000).toISOString(), open:p, high:p+1, low:p-1, close:p, volume:5}); }
  return await fblCandeleCacheScrivi(asset, tf, righe, 2, 0);
}`;

const CE = `async (asset, tf) => !!(await fblCandeleCacheLeggi(asset, tf))`;

async function pulisci(pagina){
  await pagina.evaluate(async () => {
    for(const k of fblCandleCacheIndex.slice()){ try{ await idbDel(k); }catch(e){} }
    fblCandleCacheIndex=[];
    try{ localStorage.removeItem('fblCandleCacheIndex'); }catch(e){}
  });
}

test('un asset della watchlist non viene buttato da asset di passaggio', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pulisci(pagina);
    const r = await pagina.evaluate(async ([scriviSrc, ceSrc]) => {
      const scrivi=eval(scriviSrc), ce=eval(ceSrc);
      favoriteAssets=['EURUSD'];
      await scrivi('EURUSD','M1',5);
      // quindici asset di passaggio, uno dopo l'altro
      for(let i=0;i<15;i++) await scrivi('PASSA'+i,'M1',5);
      return {suo: await ce('EURUSD','M1'), voci: fblCandleCacheIndex.length};
    }, [SCRIVI, CE]);
    assert.equal(r.suo, true, 'le candele di un asset in watchlist devono restare: sono state buttate');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('un asset fuori watchlist non resta in magazzino', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pulisci(pagina);
    const r = await pagina.evaluate(async ([scriviSrc, ceSrc]) => {
      const scrivi=eval(scriviSrc), ce=eval(ceSrc);
      favoriteAssets=['EURUSD'];
      await scrivi('XAUUSD','M1',5);     // asset di passaggio
      await scrivi('EURUSD','M1',5);     // poi si torna sul suo
      return {passaggio: await ce('XAUUSD','M1'), suo: await ce('EURUSD','M1')};
    }, [SCRIVI, CE]);
    assert.equal(r.passaggio, false, 'un asset fuori watchlist non deve occupare il magazzino');
    assert.equal(r.suo, true, 'e il suo deve esserci');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('l asset che si sta guardando resta, anche se non e in watchlist', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pulisci(pagina);
    const r = await pagina.evaluate(async ([scriviSrc, ceSrc]) => {
      const scrivi=eval(scriviSrc), ce=eval(ceSrc);
      favoriteAssets=[];
      await scrivi('XAUUSD','M1',5);
      return await ce('XAUUSD','M1');
    }, [SCRIVI, CE]);
    assert.equal(r, true, 'l\'asset appena caricato deve restare in magazzino, o si riscarica ogni volta');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('dieci asset in watchlist con due timeframe ciascuno stanno tutti in magazzino', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pulisci(pagina);
    const r = await pagina.evaluate(async ([scriviSrc, ceSrc]) => {
      const scrivi=eval(scriviSrc), ce=eval(ceSrc);
      favoriteAssets=['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10'];
      for(const a of favoriteAssets){ await scrivi(a,'M1',3); await scrivi(a,'M5',3); }
      let quanti=0;
      for(const a of favoriteAssets){ if(await ce(a,'M1'))quanti++; if(await ce(a,'M5'))quanti++; }
      return {quanti, voci: fblCandleCacheIndex.length};
    }, [SCRIVI, CE]);
    assert.equal(r.quanti, 20, 'venti voci della watchlist devono starci tutte: ce ne sono ' + r.quanti);
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});
