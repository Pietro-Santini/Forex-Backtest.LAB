// LO ZOOM RESTA DI OGNI MACCHINA: NIENTE SINCRONIZZAZIONE DELLO ZOOM TRA DISPOSITIVI.
//
// Richiesto dal proprietario: «lo zoom non deve sincronizzarsi tra macchine».
//
// LA CAUSA (misurata): lo zoom (priceZoomFactor, viewPriceLo/Hi) viaggiava nel pacchetto di
// sessione (collectLightSessionState) destinato ANCHE al cloud: aprendo l'app su un'altra
// macchina arrivava lo zoom dell'altra; e alla sincronizzazione successiva scappava pure lo
// zoom scelto qui. Lo stesso valeva per lo zoom orizzontale e l'autogamma dentro assetChartViews.
//
// LA CURA: lo zoom di QUESTA macchina vive in un localStorage separato (fbl_zoom_dispositivo)
// fresco ad ogni salvataggio, e NESSUN pacchetto in cloud lo porta (trimTradesForCloudBudget e'
// l'unico punto di passaggio delle scritture cloud, e clona senza toccare la memoria locale);
// chi riceve uno stato remoto mantiene lo zoom che aveva. PROVA DI CONTROLLO: il pacchetto
// VECCHIO che ancora portava lo zoom NON lo applica piu' (vince il file del dispositivo), e
// l'originale della memoria locale resta intatto dopo la preparazione all'invio.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('il pacchetto di sessione non porta lo zoom, e il file per dispositivo si', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      priceZoomFactor = 2.5; viewPriceLo = 19; viewPriceHi = 180; visibleCount = 37; autoFitWidth = false;
      const st = collectLightSessionState();
      const zd = JSON.parse(localStorage.getItem('fbl_zoom_dispositivo') || 'null');
      // il bundle "senza zoom" applicato NON deve azzerare lo zoom corrente del dispositivo
      const statoSenzaZoom = {version: SESSION_VERSION, currentTF: 1, idx: 0, viewEnd: 0, masterTime: null, followLatest: false, gridSpacingIdx: 0, fields: {}};
      applyLightSessionState(statoSenzaZoom);
      return {
        nelloStato: [st.priceZoomFactor, st.viewPriceLo, st.viewPriceHi],
        nelDispositivo: zd,
        dopo: {priceZoomFactor, viewPriceLo, viewPriceHi}
      };
    });
    assert.deepEqual(r.nelloStato, [undefined, undefined, undefined],
      'lo zoom verticale NON sta nel pacchetto di sessione: ' + JSON.stringify(r.nelloStato));
    assert.ok(r.nelDispositivo && r.nelDispositivo.priceZoomFactor === 2.5 && r.nelDispositivo.viewPriceLo === 19
      && r.nelDispositivo.viewPriceHi === 180 && r.nelDispositivo.visibleCount === 37,
      'lo zoom vive nel file per dispositivo: ' + JSON.stringify(r.nelDispositivo));
    assert.ok(r.dopo.priceZoomFactor === 2.5 && r.dopo.viewPriceLo === 19 && r.dopo.viewPriceHi === 180,
      'uno stato remoto SENZA zoom non deve toccare lo zoom di questa macchina: ' + JSON.stringify(r.dopo));
    assert.equal(errori.length, 0, 'errori console: ' + errori.join(' | '));
  } finally { await browser.close(); }
});

test('il pacchetto che sale in cloud non ha zoom, per nessun asset, e la memoria resta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const bundle = {
        priceZoomFactor: 3.3, viewPriceLo: 5, viewPriceHi: 7,
        assetChartViews: {Storico: {'XAUUSD': {masterTime: 42, viewEnd: 9, priceZoomFactor: 1.7, viewPriceLo: 1, viewPriceHi: 2, visibleCount: 55, autoFitWidth: false}}}
      };
      const preparato = trimTradesForCloudBudget(bundle, 4096); // 4096: nessun taglio trade, passa lo strip zoom
      return {
        root: [preparato.priceZoomFactor, preparato.viewPriceLo, preparato.viewPriceHi],
        asset: preparato.assetChartViews.Storico.XAUUSD,
        originaleIntatto: {priceZoomFactor: bundle.priceZoomFactor, viewPriceLo: bundle.viewPriceLo, assetZoom: bundle.assetChartViews.Storico.XAUUSD.priceZoomFactor, visibleCount: bundle.assetChartViews.Storico.XAUUSD.visibleCount}
      };
    });
    assert.deepEqual(r.root, [undefined, undefined, undefined],
      'lo zoom verticale NON sale in cloud: ' + JSON.stringify(r.root));
    const a = r.asset;
    assert.ok(a.priceZoomFactor === undefined && a.viewPriceLo === undefined && a.viewPriceHi === undefined
      && a.visibleCount === undefined && a.autoFitWidth === undefined,
      'lo zoom per asset NON sale in cloud: ' + JSON.stringify(a));
    assert.ok(a.masterTime === 42 && a.viewEnd === 9,
      'le ancore di POSIZIONE (masterTime/viewEnd) viaggiano ancora: ' + JSON.stringify(a));
    const o = r.originaleIntatto;
    assert.ok(o.priceZoomFactor === 3.3 && o.viewPriceLo === 5 && o.assetZoom === 1.7 && o.visibleCount === 55,
      "l'originale della memoria locale NON si tocca (lo zoom resta vivo qui): " + JSON.stringify(o));
    assert.equal(errori.length, 0, 'errori console: ' + errori.join(' | '));
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: il pacchetto VECCHIO che portava lo zoom non lo applica piu (vince il dispositivo)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // lo zoom DI QUESTA macchina
      priceZoomFactor = 2.5; viewPriceLo = 19; viewPriceHi = 180;
      collectLightSessionState(); // semina il file per dispositivo
      // un pacchetto ALLA VECCHIA MANIERA, con dentro lo zoom di UN'ALTRA macchina
      const vecchio = {version: SESSION_VERSION, priceZoomFactor: 9.9, viewPriceLo: 1, viewPriceHi: 2, currentTF: 1, idx: 0, viewEnd: 0, masterTime: null, followLatest: false, gridSpacingIdx: 0, fields: {}};
      applyLightSessionState(vecchio);
      return {priceZoomFactor, viewPriceLo, viewPriceHi};
    });
    assert.ok(r.priceZoomFactor === 2.5 && r.viewPriceLo === 19 && r.viewPriceHi === 180,
      "lo zoom di un'altra macchina NON deve passare nemmeno da un pacchetto vecchio: " + JSON.stringify(r));
    assert.equal(errori.length, 0, 'errori console: ' + errori.join(' | '));
  } finally { await browser.close(); }
});
