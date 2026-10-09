// INNESTO del filtro anti-doppioni nell'APERTURA AUTOMATICA (requisito C).
//
// I test di `filtro_doppioni.test.mjs` provano la funzione pura `fblDedupMotivo`.
// Qui si prova il GANCIO: la decisione VERA `tgAutoDecidi` (non una finta) deve rifiutare un
// doppione, e deve invece lasciar passare un trade diverso.
//
// Serve una sala automatica accesa: si configura `tgAutoFx` al volo. Lo strumento XAUUSD e' famiglia
// "fx" (non cripto), quindi la decisione usa tgAutoFx.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Azzera lo stato e accende una sala automatica finta. Riceve le posizioni da `window.__pos`.
const PREPARA = (posizioni) => {
  positions = (posizioni || []).slice();
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
async function decidi(pagina, posizioni, seg) {
  await pagina.evaluate((d) => {
    eval('(' + d.prep + ')')(d.pos);
    window.__seg = d.seg;
  }, {prep: PREPARA.toString(), pos: posizioni || [], seg});
  return pagina.evaluate(() => {
    const voce = {id: 1, chat: 'Sala A', sala: '@a', stato: 'nuovo', ricevuto_ms: Date.now(), segnale: window.__seg};
    return tgAutoDecidi(voce);
  });
}

test('apertura automatica: un doppione NON viene aperto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const d = await decidi(pagina,
      [{asset:'XAUUSD', side:'BUY', entry:4120, sl:4100, tp:4140, tgSala:'Sala A', tgGruppo:'g1'}],
      {strumento:'XAUUSD', direzione:'BUY', entrata:4119.8, stop_loss:4101, take_profit:[4140]});
    assert.equal(d.apri, false, 'il doppione non deve aprire: ' + JSON.stringify(d));
    assert.ok(/doppione/i.test(String(d.motivo)), 'il motivo deve dire che è un doppione: ' + d.motivo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('apertura automatica: un trade DIVERSO (TP diversi) viene aperto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const d = await decidi(pagina,
      [{asset:'XAUUSD', side:'BUY', entry:4120, sl:4100, tp:4160, tgSala:'Sala A', tgGruppo:'g1'}],
      {strumento:'XAUUSD', direzione:'BUY', entrata:4120, stop_loss:4100, take_profit:[4140]});
    assert.equal(d.apri, true, 'trade diverso: deve poter aprire: ' + JSON.stringify(d));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
