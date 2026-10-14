// LE COLONNE COB E SVP DEVONO AVERE LO STESSO ASPETTO SU OGNI ASSET.
//
// SEGNALATO dal proprietario con tre foto: «su XAU/USD le linee sono molto fitte, quindi sono
// giuste; su EUR/USD le candele del COB SVP sono veramente tanto larghe; e nelle cripto le
// colonne sono molto distaccate l'una dall'altra. Cerchiamo di renderle attaccate e ben disegnate».
//
// LA CAUSA: il passo delle righe era quello del FOOTPRINT (pip × "altezza riga"), che è tarato
// sull'altezza di una CANDELA — una cosa che non c'entra niente con una scaletta di liquidità — e
// che cambia da asset a asset in modo tutto suo. Su EUR/USD usciva una riga da una decina di pixel,
// su XAU un paio, e sulle cripto il passo era così fine rispetto all'intervallo di prezzo che i
// livelli del book finivano in bin sparsi, coi buchi in mezzo.
//
// LA CURA: il passo si decide in PIXEL, arrotondato a un passo tondo dell'asset.
//
// Come si prova che il test serve: rimettendo il passo del footprint, il primo test va rosso
// (EUR/USD e XAU/USD danno righe di altezza molto diversa).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('il passo tondo cade sempre su multipli sensati del pip', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const casi = [
        // [voluto, pip] -> atteso
        [0.00012, 0.0001],   // EUR/USD: poco piu di un pip -> un pip
        [0.00031, 0.0001],   // -> 2 pip
        [0.00061, 0.0001],   // -> 5 pip
        [0.00120, 0.0001],   // -> 10 pip
        [0.42, 0.1],         // XAU/USD -> 0,5
        [7.3, 0.1]           // -> 10
      ];
      return casi.map(([v, p]) => cobSvpPassoTondo(v, p));
    });
    const atteso = [0.0001, 0.0002, 0.0005, 0.001, 0.5, 10];
    r.forEach((v, i) => assert.ok(Math.abs(v - atteso[i]) < 1e-9,
      'caso ' + i + ': atteso ' + atteso[i] + ', trovato ' + v));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('su asset diversi le righe vengono alte uguali (e sottili)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // Tre strumenti con pip e intervalli di prezzo molto diversi: sono i tre delle foto.
      const altezza = (range, pip, ch) => {
        const step = cobSvpPassoTondo(range / Math.max(1, ch) * COB_SVP_RIGA_PX, pip);
        return step / range * ch;          // altezza della riga in pixel
      };
      return {
        eurusd: altezza(0.0060, 0.0001, 900),   // EUR/USD su 5m
        xauusd: altezza(85, 0.1, 900),          // XAU/USD
        btc: altezza(1500, 0.1, 900)            // BTC/USDT
      };
    });
    // Tutte e tre vicine al bersaglio: e questo che rende uguale l aspetto fra un asset e l altro.
    [['eurusd', r.eurusd], ['xauusd', r.xauusd], ['btc', r.btc]].forEach(([nome, px]) => {
      assert.ok(px >= 2 && px <= 14,
        nome + ': riga di ' + px.toFixed(1) + ' px, fuori da quello che si vuole (2-14)');
    });
    const massimo = Math.max(r.eurusd, r.xauusd, r.btc), minimo = Math.min(r.eurusd, r.xauusd, r.btc);
    assert.ok(massimo / minimo <= 3,
      'fra un asset e l altro le righe non devono cambiare tanto: '
      + JSON.stringify({eurusd: r.eurusd, xauusd: r.xauusd, btc: r.btc}));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il passo NON dipende piu dall impostazione del footprint', () => {
  // È il cuore della correzione: la scaletta di liquidità e la griglia del footprint sono due cose
  // diverse, e legarle faceva cambiare aspetto alle colonne da asset a asset.
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const i = src.indexOf('function drawCobSvpColumns(');
  const j = src.indexOf('\nfunction ', i + 10);
  const corpo = src.slice(i, j > 0 ? j : i + 6000);
  assert.ok(!/footprintStepForAsset/.test(corpo),
    'drawCobSvpColumns non deve piu prendere il passo dal footprint');
  assert.match(corpo, /cobSvpPassoTondo\(range\//, 'il passo si deve calcolare dai pixel');
});

test('le righe sono attaccate: niente pixel di stacco fra una e l altra', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const i = src.indexOf('function drawCobSvpColumns(');
  const j = src.indexOf('\nfunction ', i + 10);
  const corpo = src.slice(i, j > 0 ? j : i + 6000);
  assert.ok(!/g\.yTop\+0\.5,[^)]*g\.h-1/.test(corpo),
    'le barre non devono piu essere disegnate alte g.h-1 a partire da mezzo pixel piu sotto');
  assert.match(corpo, /Math\.round\(y\(\(k\+0\.5\)\*step\)\)/,
    'i bordi delle righe vanno arrotondati al pixel, altrimenti restano le righe chiare in mezzo');
});
