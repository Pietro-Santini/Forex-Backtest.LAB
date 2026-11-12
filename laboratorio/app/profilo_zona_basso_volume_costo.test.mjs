// UN PROFILO VOLUMETRICO NON DEVE COSTARE QUANTO TUTTO LO STORICO.
//
// MISURATO sul PC del proprietario (11 novembre 2026, pannello prestazioni, 83.341 candele,
// 3 disegni salvati): 4 fotogrammi al secondo, disegnoMedio 238 ms, e dentro:
//     disegno:vpfixed         = 139,23 ms   (il 58% del fotogramma)
//     disegno:vpfixed>calcolo =   0,08 ms   (il calcolo del profilo e' in cache: non e' lui)
// Sul banco con 51.000 candele lo stesso disegno costava 4,27 ms (commento nel codice). Quindi
// qualcosa cresce con lo storico, e non e' l'istogramma.
//
// CAUSA (app.html, blocco vpfixed in draw): la zona a basso volume viene calcolata a OGNI
// fotogramma con computeLowVolumeZone(profile, ..., rows, 0, lastIdx): parte da ZERO, cioe'
// dall'inizio dello storico, non dall'inizio del profilo. Dentro fa due giri su tutte quelle
// candele piu' un ordinamento dei loro range. Nessuna cache. E lvnEnabled e' acceso per
// impostazione predefinita su ogni profilo nuovo.
//
// LA MISURA E' UN RAPPORTO, non un tempo secco: il costo di un fotogramma con un profilo di 300
// candele su uno storico di 83.000, diviso lo stesso costo su uno storico di 1.000. Il profilo e'
// identico nei due casi: il fotogramma deve costare circa uguale. Un tempo assoluto sotto carico
// e' instabile (misurato oggi: un banco del cloud e' caduto solo perche' il PC era pieno).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

function misuraNellaPagina(nCandele) {
  // Candele a 1 minuto, prezzi intorno a 4160, un profilo sulle ULTIME 300 con la zona a basso
  // volume accesa (com'e' per impostazione predefinita).
  const t0 = Date.now() - nCandele * 60000;
  let p = 4160; const R = [];
  for (let i = 0; i < nCandele; i++) {
    const o = p, c = p + Math.sin(i / 9) * 1.5;
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: o, high: Math.max(o, c) + 0.8,
            low: Math.min(o, c) - 0.8, close: c, volume: 5 + (i % 7)});
    p = c;
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length; currentAssetKey = 'XAUUSD'; currentTF = 1;
  csvLibrary = [{id: 'mt5_live_XAUUSD', name: 'MT5 Live', addedAt: Date.now(), rows: R}];
  visibleCount = 200; liveModeActive = false; mt5Connected = false; liveReplayActive = false;
  positionsVisible = true; positions = []; pendingOrders = []; active = null;
  const PROF = 300;
  const a = R.length - PROF, b = R.length - 1;
  drawings = [{
    id: 'vp_prova', type: 'vpfixed',
    p1: {time: new Date(R[a].date).getTime(), price: R[a].close},
    p2: {time: new Date(R[b].date).getTime(), price: R[b].close},
    locked: false, hidden: false, buckets: 200, barSizePct: 500, extendRight: false,
    bgEnabled: true, bgColor: '#ffffff', bgOpacity: 5,
    lvnEnabled: true, lvnColor: '#00e676', lvnOpacity: 25, lvnThresholdPct: 15, lvnEdgePct: 8,
    pocEnabled: true, pocColor: '#ff9800', pocWidth: 1, pocExtend: false,
    vahEnabled: true, vahColor: '#3ea6ff', vahWidth: 1, valEnabled: true, valColor: '#3ea6ff', valWidth: 1,
    vaExtend: false, upColor: '#26a69a', downColor: '#ef5350'
  }];
  try { setDrawTool('cursor'); } catch (e) {}
  // Vista sulle ultime candele, cosi' il profilo e' a schermo e viene disegnato davvero.
  try { viewPriceLo = 4100; viewPriceHi = 4220; } catch (e) {}
  draw(); // il primo fotogramma paga le cache: non si misura
  const GIRI = 8;
  const t = performance.now();
  for (let i = 0; i < GIRI; i++) draw();
  const ms = (performance.now() - t) / GIRI;
  // Un controllo che il profilo sia stato DAVVERO disegnato: l'istogramma deve avere fasce.
  const fullTs = getRowsTimestamps();
  const {aIdx, bIdx} = vpFixedResolveRange(drawings[0], fullTs, idx, rows.length);
  const prof = computeVolumeProfile(Math.min(aIdx, bIdx), Math.max(aIdx, bIdx), 200);
  return {ms, candele: R.length, fasce: prof ? prof.buckets : 0, inizioProfilo: Math.min(aIdx, bIdx),
          fineProfilo: Math.max(aIdx, bIdx)};
}

test('un profilo di 300 candele costa uguale su 1.000 o su 83.000 candele di storico', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const piccolo = await pagina.evaluate(misuraNellaPagina, 1000);
    const grande = await pagina.evaluate(misuraNellaPagina, 83000);
    console.log('fotogramma con profilo di 300 candele:',
      JSON.stringify({storico_1000: {ms: +piccolo.ms.toFixed(2), fasce: piccolo.fasce},
                      storico_83000: {ms: +grande.ms.toFixed(2), fasce: grande.fasce},
                      rapporto: +(grande.ms / Math.max(0.05, piccolo.ms)).toFixed(1)}));
    // Controlli che la misura sia valida: il profilo esiste, copre 300 candele, ha fasce.
    assert.ok(piccolo.fasce > 0 && grande.fasce > 0, 'il profilo non e\' stato calcolato: misura non valida');
    assert.equal(grande.fineProfilo - grande.inizioProfilo, 299, 'il profilo deve coprire 300 candele');
    assert.equal(piccolo.fineProfilo - piccolo.inizioProfilo, 299, 'il profilo deve coprire 300 candele');
    // IL DIFETTO: oggi il fotogramma cresce con lo storico anche se il profilo e' identico.
    const rapporto = grande.ms / Math.max(0.05, piccolo.ms);
    assert.ok(rapporto <= 3,
      `con 83.000 candele il fotogramma costa ${grande.ms.toFixed(1)} ms contro ${piccolo.ms.toFixed(1)} ` +
      `con 1.000 (${rapporto.toFixed(1)} volte): il profilo e' lo stesso, lo storico fuori dal profilo ` +
      `non dovrebbe contare`);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: la zona a basso volume si calcola solo sulle candele del profilo', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      // 5.000 candele. Un profilo sulle ULTIME 200. Una candela ENORME 3.000 candele PRIMA del
      // profilo, che tocca tutte le fasce: se la zona guarda fuori dal profilo, quella candela
      // marca tutto come "toccato" e la zona cambia; se guarda solo dentro, non la vede.
      const t0 = Date.now() - 5000 * 60000;
      let p = 4160; const R = [];
      for (let i = 0; i < 5000; i++) {
        const o = p, c = p + Math.sin(i / 9) * 1.5;
        R.push({date: new Date(t0 + i * 60000).toISOString(), open: o, high: Math.max(o, c) + 0.8,
                low: Math.min(o, c) - 0.8, close: c, volume: 5 + (i % 7)});
        p = c;
      }
      rows = R; baseRows = R; idx = R.length - 1;
      const a = R.length - 200, b = R.length - 1;
      const prof = computeVolumeProfile(a, b, 60);
      const dentro = computeLowVolumeZone(prof, 15, 8, R, a, b);
      // la stessa chiamata col vecchio punto di partenza (0): deve dare lo STESSO risultato
      // solo se le candele fuori dal profilo non contano. Metto una candela gigante a 2.000.
      R[2000] = Object.assign({}, R[2000], {high: 9999, low: 1});
      const conStoricoIntero = computeLowVolumeZone(prof, 15, 8, R, 0, b);
      const conSoloProfilo = computeLowVolumeZone(prof, 15, 8, R, a, b);
      return {dentro, conStoricoIntero, conSoloProfilo};
    });
    // Il calcolo limitato al profilo non deve cambiare se cambia una candela FUORI dal profilo.
    assert.deepEqual(r.conSoloProfilo, r.dentro,
      'una candela fuori dal periodo del profilo non deve cambiare la zona a basso volume');
  } finally { await browser.close(); }
});
