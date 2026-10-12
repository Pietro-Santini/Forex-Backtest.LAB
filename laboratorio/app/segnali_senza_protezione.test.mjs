// Richiesta: i segnali SENZA take profit e SENZA stop loss si eliminano (non si aprono da soli,
// via dal pannello); i segnali con il target ma SENZA stop loss non si aprono in automatico ma
// restano nel pannello per l'apertura a mano.
// Proviamo la decisione VERA `tgAutoDecidi` e il suo innesto nel pannello (`tgAutoValuta`).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Azzera lo stato e accende una sala automatica finta (stessa base di filtro_doppioni_auto).
const PREPARA = () => {
  positions = [];
  pendingOrders = [];
  trades = [];
  tgSegnaliRicevuti = [];
  tgStrategie = {};
  mt5Connected = false;
  liveModeActive = true; fblContoVista = 'mt5';
  currentAssetKey = 'XAUUSD';
  tgAutoFx = {attivo:true, maxGlobali:40, perditaMaxGiorno:10, perditaAttiva:false, etaMaxS:600,
    sale:{'@a':{attivo:true, rischio:1, maxPosizioni:6, avvicinamento:0}}, spentoIl:null,
    predefinitiV:2, universale:null};
};

// Prepara e chiede alla DECISIONE VERA che cosa farebbe con questo segnale.
async function decidi(pagina, seg) {
  await pagina.evaluate((d) => {
    eval('(' + d.prep + ')')();
    window.__seg = d.seg;
  }, {prep: PREPARA.toString(), seg});
  return pagina.evaluate(() => {
    const voce = {id: 1, chat: 'Sala A', sala: '@a', stato: 'nuovo', ricevuto_ms: Date.now(), segnale: window.__seg};
    return tgAutoDecidi(voce);
  });
}

test('senza stop e senza target: segnale eliminato (mai in automatico)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const d = await decidi(pagina, {strumento:'XAUUSD', direzione:'BUY', entrata:4120, stop_loss:null, take_profit:[]});
    assert.equal(d.apri, false, JSON.stringify(d));
    assert.equal(d.elimina, true, 'deve portare il marcatore elimina: ' + JSON.stringify(d));
    assert.ok(/senza stop loss e senza take profit/.test(String(d.motivo)), String(d.motivo));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza stop e senza target ma con BUY/SELL scritto: eliminato comunque', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const d = await decidi(pagina, {strumento:'XAUUSD', direzione:'BUY', entrata:4120, stop_loss:null, take_profit:[], testo:'BUY XAUUSD ora'});
    assert.equal(d.apri, false, JSON.stringify(d));
    assert.equal(d.elimina, true, 'il BUY/SELL scritto non salva un segnale senza livelli: ' + JSON.stringify(d));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con target ma SENZA stop: non si apre da solo, resta nel pannello (niente elimina)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const d = await decidi(pagina, {strumento:'XAUUSD', direzione:'BUY', entrata:4120, stop_loss:null, take_profit:[4140]});
    assert.equal(d.apri, false, JSON.stringify(d));
    assert.equal(d.elimina, undefined, 'deve RESTARE nel pannello: ' + JSON.stringify(d));
    assert.ok(/senza stop loss/.test(String(d.motivo)), String(d.motivo));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con stop e target: si apre (comportamento invariato)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const d = await decidi(pagina, {strumento:'XAUUSD', direzione:'BUY', entrata:4120, stop_loss:4100, take_profit:[4140]});
    assert.equal(d.apri, true, JSON.stringify(d));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nel pannello: il segnale eliminato sparisce, quello senza stop resta col motivo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate((p) => { eval('(' + p + ')')(); }, PREPARA.toString());
    const es = await pagina.evaluate(async () => {
      const senzaTutto = {id:1, chat:'Sala A', sala:'@a', stato:'nuovo', ricevuto_ms:Date.now(),
        segnale:{strumento:'XAUUSD', direzione:'BUY', entrata:4120, stop_loss:null, take_profit:[]}};
      const senzaSl = {id:2, chat:'Sala A', sala:'@a', stato:'nuovo', ricevuto_ms:Date.now(),
        segnale:{strumento:'XAUUSD', direzione:'BUY', entrata:4120, stop_loss:null, take_profit:[4140]}};
      tgSegnaliRicevuti.push(senzaTutto, senzaSl);
      await tgAutoValuta(senzaTutto, 'sim');
      await tgAutoValuta(senzaSl, 'sim');
      return {
        ancora: tgSegnaliRicevuti.map(v => v.id),
        motivoSenzaSl: senzaSl.autoMotivo || null
      };
    });
    assert.deepEqual(es.ancora, [2], 'deve restare solo il segnale senza stop (col target): ' + JSON.stringify(es));
    assert.ok(/senza stop loss/.test(String(es.motivoSenzaSl)), String(es.motivoSenzaSl));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});