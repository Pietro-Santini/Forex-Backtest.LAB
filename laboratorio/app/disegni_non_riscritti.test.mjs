// IL DOCUMENTO DEI DISEGNI CONDIVISI: NON SI RISCRIVE QUANDO NON E' CAMBIATO, E SI VEDE QUANTO
// PESA.
//
// MISURATO dal proprietatore (8 novembre 2026, tabella Traffico dell'app):
//   documento grafico — 0 scritture, 6 letture, 4889,5 KB  (815 KB a lettura)
// Il numero delle operazioni e' piccolo: il conto vero e' il PESO. E la scrittura partiva ogni
// volta che QUALCOSA veniva marcato, anche se il contenuto era identico a quello gia' scritto —
// e ogni scrittura fa scattare una lettura su tutti gli altri dispositivi (l'eco che non si
// vede). Col documento a 815 KB, la firma "identico = non si scrive" risparmia banda due volte.
//
// Il test misura il comportamento: quante volte parte davvero la scrittura, e quanto pesa ogni
// chiave del documento letto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = () => {
  window.fxbtCloud = { uid: 'UTENTE', ready: Promise.resolve(),
    graficoSalva: async (voci) => { window.__mandate.push(Object.keys(voci)); return true; },
    serverDatiFondi: async () => true };
  window.__mandate = [];
  graficoAttivo = true;
  graficoDaInviare = new Set();
  graficoT = {};
  __graficoUltimaFirma = null;
  assetDrawings = {live: {'XAUUSD': [{type: 'line', p1: {x: 1, y: 2}, p2: {x: 3, y: 4}}]}};
  currentMode = () => 'live';
  currentAssetKey = 'XAUUSD';
  graficoPesoPerChiave = {};
};

test('stesso contenuto: non si riscrive (e non fa scattare letture sugli altri)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      (${PREPARA.toString()})();
      graficoDaInviare.add('live|XAUUSD');
      await graficoInviaOra();                       // la prima volta si scrive
      const dopoPrima = window.__mandate.length;
      graficoDaInviare.add('live|XAUUSD');           // marcato di nuovo, contenuto IDENTICO
      await graficoInviaOra();
      const dopoSeconda = window.__mandate.length;
      // Qualcosa cambia DAVVERO: ora si riscrive. Si cambia l'array drawings, che e' quello
      // che graficoValoreLocale() restituisce per la chiave dell'asset a grafico.
      drawings.push({type: 'line', p1: {x: 5, y: 6}, p2: {x: 7, y: 8}});
      graficoDaInviare.add('live|XAUUSD');
      await graficoInviaOra();
      const dopoTerza = window.__mandate.length;
      return {dopoPrima, dopoSeconda, dopoTerza, voci: window.__mandate[0]};
    })()`);
    assert.equal(r.dopoPrima, 1, 'la prima scrittura deve partire: ' + JSON.stringify(r));
    assert.equal(r.dopoSeconda, 1,
      'a contenuto identico NON si riscrive (misurato prima: riscriveva, e ogni scrittura costa'
      + ' una lettura su ogni altro dispositivo): ' + JSON.stringify(r));
    assert.equal(r.dopoTerza, 2,
      'con qualcosa di cambiato si riscrive: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('quanto pesa ogni chiave del documento, che e\' il conto vero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      (${PREPARA.toString()})();
      // Come lo manda il cloud: voci con il dato in forma di stringa JSON.
      const grosso = JSON.stringify([{type:'line',p1:{x:1,y:2},p2:{x:3,y:4}}]);
      const piccolo = JSON.stringify([{type:'line',p1:{x:1,y:2},p2:{x:3,y:4}}]).slice(0,20);
      graficoRicevi({'live%7CXAUUSD': {t: 2, d: grosso}, 'ind%7Clive': {t: 1, d: piccolo}});
      return {perChiave: graficoPesoPerChiave, totale: Object.keys(graficoPesoPerChiave).length};
    })()`);
    assert.equal(r.totale, 2, 'ogni chiave del documento va pesata: ' + JSON.stringify(r));
    assert.equal(r.perChiave['live|XAUUSD'], JSON.stringify([{type:'line',p1:{x:1,y:2},p2:{x:3,y:4}}]).length,
      'e il peso e\' quello del dato che arriva davvero: ' + JSON.stringify(r));
    assert.ok(r.perChiave['live|XAUUSD'] > r.perChiave['ind|live'],
      'la chiave grossa deve risultare piu\' pesante: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
