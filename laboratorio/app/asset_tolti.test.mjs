// UNA ✕ PER TOGLIERE UN ASSET DALL'ELENCO, E UNA STRADA PER FARLO TORNARE.
//
// RICHIESTO dal proprietario: «nel pop-up della ricerca dell'asset, accanto alla sezione asset
// disponibili, dobbiamo avere la possibilità con una X di togliere quel asset dall'elenco».
//
// Perché una LISTA DI TOLTI e non «cancello la voce»: l'elenco è fatto di due cose diverse — le
// voci scritte nella pagina (quelle di sempre) e gli asset salvati cercandoli. Cancellare funziona
// solo sui secondi: una voce della pagina tornerebbe al primo ricaricamento e l'utente la vedrebbe
// riapparire senza capire perché.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('tolto sparisce dall\'elenco, e ritrovarlo lo rimette', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      const primo = availableAssets()[0];
      const prima = availableAssets().length;
      // Non deve essere quello a grafico, altrimenti resta apposta (vedi sotto).
      currentAssetKey = availableAssets()[1] || '__nessuno__';
      assetTogliDallElenco(primo);
      const dopo = availableAssets();
      // La strada del ritorno: ricercarlo e sceglierlo.
      rememberCustomAsset(primo, 'Nome qualsiasi', 'forex');
      const tornato = availableAssets().includes(primo);
      ({primo, prima, dopoLen: dopo.length, ancoraLi: dopo.includes(primo), tornato})
    }`);
    assert.ok(r.primo, 'il banco deve avere almeno un asset');
    assert.equal(r.ancoraLi, false, 'tolto non deve più comparire');
    assert.equal(r.dopoLen, r.prima - 1);
    assert.equal(r.tornato, true, 'ritrovarlo e sceglierlo lo rimette nell\'elenco');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la scelta sopravvive al ricaricamento (è salvata, non solo in memoria)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const salvato = await pagina.evaluate(`{
      currentAssetKey='__nessuno__';
      const sym = availableAssets()[0];
      assetTogliDallElenco(sym);
      ({sym, scritto: localStorage.getItem(ASSET_TOLTI_KEY)})
    }`);
    assert.ok(salvato.scritto, 'deve finire in localStorage');
    assert.ok(JSON.parse(salvato.scritto).includes(salvato.sym));
    // Ricaricando, l'elenco si rilegge da lì.
    await pagina.reload({waitUntil:'domcontentloaded'});
    await pagina.waitForTimeout(2500);
    const dopo = await pagina.evaluate(`({tolto: assetEStatoTolto(${JSON.stringify(salvato.sym)}),
                                          nellElenco: availableAssets().includes(${JSON.stringify(salvato.sym)})})`);
    assert.equal(dopo.tolto, true, 'dopo il ricaricamento deve essere ancora tolto');
    assert.equal(dopo.nellElenco, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l\'asset a grafico non sparisce mai da sotto i piedi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      const sym = availableAssets()[0];
      currentAssetKey = sym;                      // è quello che si sta guardando
      const esito = assetTogliDallElenco(sym);    // e lo si prova a togliere lo stesso
      // E il caso peggiore: uno tolto TEMPO FA su cui si arriva adesso (es. saltando al grafico
      // da una posizione vecchia). Deve ricomparire nell'elenco, non lasciare il menu vuoto.
      const altro = availableAssets().find(a => a !== sym);
      currentAssetKey = '__nessuno__';
      assetTogliDallElenco(altro);
      currentAssetKey = altro;
      ({esito, tolto: assetEStatoTolto(sym), ancoraNellElenco: availableAssets().includes(sym),
        vecchioRitrovato: availableAssets().includes(altro)})
    }`);
    assert.equal(r.esito, false, 'togliere l\'asset a grafico viene rifiutato');
    assert.equal(r.tolto, false, 'e non viene nemmeno registrato');
    assert.equal(r.ancoraNellElenco, true,
      'finché è a grafico resta visibile: sparire mentre lo si guarda sarebbe peggio');
    assert.equal(r.vecchioRitrovato, true,
      'e uno tolto tempo fa ricompare se ci si arriva: meglio che un menu che lo nega');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la ✕ c\'è sulle righe dell\'elenco e NON sui risultati di una ricerca', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      currentAssetKey='__nessuno__';
      ({locale:  assetPickerRowHtml('EURUSD','Euro/Dollaro','forex',null,true).includes('fbPickerTogli'),
        ricerca: assetPickerRowHtml('EURUSD','Euro/Dollaro','forex','Capital.com',false).includes('fbPickerTogli'),
        aGrafico:(()=>{ currentAssetKey='EURUSD';
                        return assetPickerRowHtml('EURUSD','Euro/Dollaro','forex',null,true).includes('fbPickerTogli'); })()})
    }`);
    assert.equal(r.locale, true, 'sulle righe dell\'elenco la ✕ ci deve essere');
    assert.equal(r.ricerca, false, 'su un risultato di ricerca no: non è nell\'elenco');
    assert.equal(r.aGrafico, false, 'e mai sull\'asset che si sta guardando');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('togliere non cancella la watchlist altrui né lo storico: toglie solo dall\'elenco', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async () => {
      currentAssetKey='__nessuno__';
      const a = availableAssets()[0], b = availableAssets()[1];
      await addToWatchlist(a); await addToWatchlist(b);
      assetTogliDallElenco(a);
      return {aFuori: !isAssetInWatchlist(a), bRestaDentro: isAssetInWatchlist(b),
              bNellElenco: availableAssets().includes(b)};
    })()`);
    assert.equal(r.aFuori, true, 'l\'asset tolto esce anche dalla watchlist: non avrebbe senso lì');
    assert.equal(r.bRestaDentro, true, 'gli altri non si toccano');
    assert.equal(r.bNellElenco, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
