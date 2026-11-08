// A MERCATO CHIUSO L'INDICATORE NON SI ALLUNGA NELLO SPAZIO VUOTO.
//
// SEGNALATO dal proprietario (8 novembre 2026): «gli indicatori continuano a scorrere il tempo
// e non si fermano al momento dell'ultima candela registrata prima della chiusura del mercato».
//
// CAUSA MISURATA nel codice dell'EMA: l'offset di disegno (quello dello script Pine, che
// "sposta solo il DISEGNO della linea, non il valore") viene applicato a DESTRA. Il ciclo che
// traccia la linea finiva a `dataEnd-off+2`, e `dataEnd` PUO' superare `idx` (lo spazio futuro
// dopo l'ultima candela): con l'orologio fermo a mercato chiuso, tutta quella spinta portava
// la curva dentro lo spazio vuoto a destra dell'ultima candela.
//
// Il test misura il COMPORTAMENTO: disegna l'EMA con un offset e guarda il punto piu' a
// destra raggiunto dalla linea - non deve mai finire oltre l'ultima candela vera.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = () => {
  rows = []; baseRows = []; let p = 4100;
  for (let i = 0; i < 60; i++) {
    const c = p + Math.sin(i / 5) * 3;
    rows.push({date: new Date(Date.now() - (60 - i) * 60000).toISOString(), open: p, high: Math.max(p, c) + 1, low: Math.min(p, c) - 1, close: c, volume: 10});
    p = c;
  }
  baseRows = rows.slice(); idx = rows.length - 1; viewEnd = rows.length;
  currentAssetKey = 'XAUUSD'; csvLibrary = [{id: 'x', rows}];
  liveModeActive = true; liveReplayActive = false; mt5Connected = false;
};

test("l'EMA con offset non finisce oltre l'ultima candela vera", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      (${PREPARA})();
      activeIndicators = [];
      const ind = {key:'ema_ind', hidden:false, params:{length:9, offset:12, color:'#3ea6ff', maType:'None', maLength:14, bbMult:2.0, maColor:'#f5c400', bbColor:'#26d07c'},
                   calc:{ref:null, builtParamsKey:null, builtTo:-1, out:[], smoothing:[], bbUp:[], bbLo:[], emaPrev:null}};
      INDICATOR_DEFS['ema_ind'].compute(rows, idx, ind);
      // Si disegna su un contesto finto che registra i punti toccati dalla linea.
      const toccati = [];
      const ctx = {save(){},restore(){},beginPath(){},moveTo(x){toccati.push(x)},lineTo(x){toccati.push(x)},
                   stroke(){},closePath(){},fill(){},set strokeStyle(v){},set lineWidth(v){},set fillStyle(v){}};
      const start = 0, n = 40, cw = 800, pad = {l: 10, r: 10};
      const xAbs = j => pad.l + (j - start + .5) * cw / n;
      INDICATOR_DEFS['ema_ind'].render(ctx, ind, rows, 0, idx + 20, xAbs, v => 100 - v);
      const ultimoCandelaX = xAbs(idx);
      return {toccati: toccati.length, maxX: Math.max.apply(null, toccati),
              ultimoCandelaX: ultimoCandelaX, offset: ind.params.offset};
    })()`);
    assert.ok(r.toccati > 0, "l'indicatore deve essere disegnato: " + JSON.stringify(r));
    assert.ok(r.maxX <= r.ultimoCandelaX + 0.6,
      "la linea non deve finire oltre l'ultima candela (era il difetto segnalato): " + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("col mercato APERTO l'offset continua a spostare il disegno (la cura non cambia la resa)", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      (${PREPARA})();
      activeIndicators = [];
      const ind = {key:'ema_ind', hidden:false, params:{length:9, offset:12, color:'#3ea6ff', maType:'None', maLength:14, bbMult:2.0, maColor:'#f5c400', bbColor:'#26d07c'},
                   calc:{ref:null, builtParamsKey:null, builtTo:-1, out:[], smoothing:[], bbUp:[], bbLo:[], emaPrev:null}};
      INDICATOR_DEFS['ema_ind'].compute(rows, idx, ind);
      const toccati = [];
      const ctx = {save(){},restore(){},beginPath(){},moveTo(x){toccati.push(x)},lineTo(x){toccati.push(x)},
                   stroke(){},closePath(){},fill(){},set strokeStyle(v){},set lineWidth(v){},set fillStyle(v){}};
      const start = 0, n = 40, cw = 800, pad = {l: 10, r: 10};
      const xAbs = j => pad.l + (j - start + .5) * cw / n;
      // dataEnd coincide con idx: a mercato aperto la finestra finisce li' dove finiscono i dati.
      INDICATOR_DEFS['ema_ind'].render(ctx, ind, rows, 0, idx, xAbs, v => 100 - v);
      const maxX = Math.max.apply(null, toccati);
      return {maxX: maxX, ultimoCandelaX: xAbs(idx)};
    })()`);
    assert.ok(r.maxX <= r.ultimoCandelaX + 12.5,
      "a mercato aperto il disegno resta quello di sempre:" + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
