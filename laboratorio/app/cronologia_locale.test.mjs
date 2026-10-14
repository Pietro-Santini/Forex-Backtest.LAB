// LA CRONOLOGIA A GRAFICO RESTA SU QUESTO DISPOSITIVO.
//
// SEGNALATO dal proprietario: «quando inserisco al grafico una sala, le sue posizioni, sui
// dispositivi vengono riportati... questa sessione non deve essere trasportata su tutti gli altri
// dispositivi. Se sono da PC non va a trasferire le posizioni della cronologia anche agli altri
// dispositivi; stessa cosa dal tablet verso telefono e PC: deve rimanere su quel dispositivo».
//
// Due cose la facevano "viaggiare":
//  1) il disegno guardava solo `vista.sala` e l'asset A GRAFICO, non l'asset che era stato
//     analizzato QUI: bastava che il grafico finisse su un asset con dei risultati salvati per
//     quella sala — e l'asset a grafico si sincronizza fra i dispositivi — perché la cronologia
//     ricomparisse da sola su uno schermo che non l'aveva chiesta;
//  2) la scelta era salvata sotto una chiave uguale su tutti i dispositivi.
// In più, richiesto: un pulsante per TOGLIERE le posizioni dal grafico, e il cambio di sala che
// toglie da solo quella di prima.
//
// Come si prova che il test serve: togliendo il controllo `currentAssetKey!==vista.asset` da
// fblCronoDisegna, il primo test va rosso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Un risultato di cronologia finto per la sala/asset indicati, messo dove lo cerca il disegno.
const PREPARA = (sala, asset, assetAGrafico) => {
  const t0 = Date.now() - 100 * 60000;
  const R = [];
  for (let i = 0; i < 100; i++) {
    const o = 100 + i * 0.1;
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: o, high: o + 0.3, low: o - 0.3, close: o + 0.1, volume: 5});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = assetAGrafico;
  if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = assetAGrafico;
  const ris = [{ts: t0 + 5 * 60000, tFill: t0 + 6 * 60000, tFine: t0 + 40 * 60000, dir: 'BUY',
                entry: 100.5, sl: 99.5, tps: [102, 103], raggiunti: 1, esito: 'TP1 poi SL', valutato: true}];
  localStorage.setItem('fbl_crono_ris:' + sala + '|' + asset, JSON.stringify(ris));
  window.fblCronoVista({sala, asset, mostra: true, caselle: false});
};

// Quante righe orizzontali disegna la cronologia: è il suo mestiere (entrata, SL, TP).
const CONTA = () => {
  const ctx = document.createElement('canvas').getContext('2d');
  let tratti = 0;
  const vS = ctx.stroke.bind(ctx);
  ctx.stroke = function () { tratti++; return vS(); };
  const y = p => 500 - (p - 100) * 10;
  window.fblCronoDisegna(ctx, y, 90, 120, {l: 18, r: 76, t: 18, b: 40}, 900, 100, 0, 1000);
  return tratti;
};

test('il grafico mostra la cronologia SOLO dell\'asset analizzato su questo dispositivo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((args) => {
      const P = eval('(' + args.prep + ')'), C = eval('(' + args.conta + ')');
      // Analizzata EURUSD: con EURUSD a grafico si disegna.
      P('Sala X', 'EURUSD', 'EURUSD');
      const suoAsset = C();
      // Il grafico passa a un ALTRO asset (è quello che succede quando un altro dispositivo
      // cambia asset): la cronologia NON deve seguire.
      currentAssetKey = 'GBPUSD';
      const altroAsset = C();
      return {suoAsset, altroAsset};
    }, {prep: PREPARA.toString(), conta: CONTA.toString()});
    assert.ok(r.suoAsset > 0, 'sul suo asset la cronologia si deve vedere');
    assert.equal(r.altroAsset, 0, 'su un altro asset non deve comparire niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la scelta e\' salvata sotto una chiave di QUESTO dispositivo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      chiave: window.fblCronoChiaveVista(),
      id: localStorage.getItem('fbl_dispositivo_id')
    }));
    assert.ok(r.id && r.id.length >= 6, 'ogni dispositivo deve avere il suo numero');
    assert.ok(r.chiave.startsWith('fbl_crono_vista:'), 'la chiave deve essere quella della cronologia');
    assert.ok(r.chiave.endsWith(r.id), 'la chiave deve finire col numero di questo dispositivo: ' + r.chiave);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('«Togli dal grafico» toglie davvero, senza buttare l\'analisi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((args) => {
      const P = eval('(' + args.prep + ')'), C = eval('(' + args.conta + ')');
      P('Sala X', 'EURUSD', 'EURUSD');
      const prima = C();
      window.fblCronoTogliDalGrafico();
      const dopo = C();
      const v = window.fblCronoVista();
      return {prima, dopo, sala: v.sala, asset: v.asset,
              analisiSalvata: !!localStorage.getItem('fbl_crono_ris:Sala X|EURUSD')};
    }, {prep: PREPARA.toString(), conta: CONTA.toString()});
    assert.ok(r.prima > 0);
    assert.equal(r.dopo, 0, 'dopo «Togli dal grafico» non si disegna piu\' niente');
    assert.equal(r.sala, '', 'la sala a grafico si azzera');
    assert.equal(r.asset, null, 'e cosi\' l\'asset');
    assert.equal(r.analisiSalvata, true, 'l\'analisi NON si butta: si rimette a grafico senza riscaricare le candele');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('cambiando sala, quella di prima sparisce da sola dal grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((args) => {
      const P = eval('(' + args.prep + ')'), C = eval('(' + args.conta + ')');
      P('Sala X', 'EURUSD', 'EURUSD');
      const prima = C();
      // Si sceglie un'altra sala nella tendina: è lo stesso evento che scatta col mouse.
      const sel = document.getElementById('fblCronoSala');
      const o = document.createElement('option'); o.value = 'Sala Y'; o.textContent = 'Sala Y';
      sel.appendChild(o); sel.value = 'Sala Y';
      sel.dispatchEvent(new Event('change', {bubbles: true}));
      const dopo = C();
      return {prima, dopo, vista: window.fblCronoVista()};
    }, {prep: PREPARA.toString(), conta: CONTA.toString()});
    assert.ok(r.prima > 0);
    assert.equal(r.dopo, 0, 'la cronologia della sala di prima non deve restare a grafico');
    assert.equal(r.vista.sala, '');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
