// LE DUE MEMORIE DEL DISEGNO: devono far risparmiare lavoro, mai cambiare risposta.
//
// Passo 3 delle prestazioni (8 ottobre 2026). Trascinare il grafico con gli indicatori accesi
// costava 50 ms a immagine su un telefono, cioe' venti immagini al secondo: si impuntava. Due
// lavori venivano rifatti identici a ogni disegno:
//   - i profili volumi ricostruivano le loro istanze riscorrendo all'indietro giorni di candele;
//   - `chartGeometry` controllava con un `every` che TUTTI i timestamp fossero validi.
// Ora si ricordano. Il pericolo di una memoria e' uno solo: rispondere con roba vecchia. Qui si
// prova che quando l'ingresso cambia la risposta cambia, e quando non cambia e' identica a quella
// calcolata da zero.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = (n) => {
  const t0 = Date.UTC(2024, 0, 1, 0, 0, 0); let p = 2000; const R = [];
  for (let i = 0; i < n; i++) { const o = p, c = p + Math.sin(i / 11) * 3;
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: o, high: Math.max(o, c) + 1, low: Math.min(o, c) - 1, close: c, volume: 100 + (i % 97)}); p = c; }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1; visibleCount = 200;
  currentAssetKey = 'TEST:ASSET';
  rowsTimeCache = null; rowsTimeCacheRef = null;
  return R;
};

test('i profili volumi: con gli stessi dati la risposta e identica a quella calcolata da zero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((prepara) => {
      eval('window.__prep=' + prepara);
      window.__prep(6000);
      const def = INDICATOR_DEFS['vp_daily'];
      const ind = hydrateIndicators([{id: 1, key: 'vp_daily', params: def.defaultParams()}])[0];
      const dallaMemoria = vpIndBuildInstances(ind);         // prima volta: calcola e ricorda
      const ancora = vpIndBuildInstances(ind);               // seconda: deve venire dalla memoria
      const daZero = vpIndIstanzeCalcola(ind);               // il calcolo vero, senza memoria
      const stesso = dallaMemoria === ancora;                // proprio lo stesso array
      return {
        stesso,
        quante: daZero.length,
        uguali: JSON.stringify(dallaMemoria) === JSON.stringify(daZero)
      };
    }, PREPARA.toString());
    assert.ok(r.quante > 0, 'nessuna istanza costruita: la prova non direbbe niente');
    assert.equal(r.stesso, true, 'la seconda chiamata doveva venire dalla memoria');
    assert.equal(r.uguali, true, 'la memoria risponde diversamente dal calcolo da zero');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i profili volumi: se avanza il tempo o cambiano i parametri, la memoria si rifa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((prepara) => {
      eval('window.__prep=' + prepara);
      window.__prep(6000);
      const def = INDICATOR_DEFS['vp_daily'];
      const ind = hydrateIndicators([{id: 1, key: 'vp_daily', params: def.defaultParams()}])[0];
      const primo = JSON.stringify(vpIndBuildInstances(ind));
      // 1) avanza la candela attuale: l'ultimo profilo deve crescere
      idx = 3000;
      const dopoIdx = JSON.stringify(vpIndBuildInstances(ind));
      const daZeroIdx = JSON.stringify(vpIndIstanzeCalcola(ind));
      // 2) cambia un parametro
      ind.params.days = Math.max(1, (Number(ind.params.days) || 5) - 2);
      const dopoParam = JSON.stringify(vpIndBuildInstances(ind));
      const daZeroParam = JSON.stringify(vpIndIstanzeCalcola(ind));
      // 3) cambiano le candele
      window.__prep(9000);
      const dopoDati = JSON.stringify(vpIndBuildInstances(ind));
      const daZeroDati = JSON.stringify(vpIndIstanzeCalcola(ind));
      return {cambiataSuIdx: primo !== dopoIdx, idxGiusto: dopoIdx === daZeroIdx,
              paramGiusto: dopoParam === daZeroParam, datiGiusto: dopoDati === daZeroDati};
    }, PREPARA.toString());
    assert.equal(r.cambiataSuIdx, true, 'avanzando nel tempo il profilo deve crescere, non restare fermo');
    assert.equal(r.idxGiusto, true, 'dopo il cambio di candela la memoria dava una risposta vecchia');
    assert.equal(r.paramGiusto, true, 'dopo il cambio di parametri la memoria dava una risposta vecchia');
    assert.equal(r.datiGiusto, true, 'dopo il cambio di candele la memoria dava una risposta vecchia');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i timestamp tutti validi: la risposta ricordata e quella che darebbe il controllo completo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((prepara) => {
      eval('window.__prep=' + prepara);
      // a) dataset sano
      window.__prep(2000);
      const ts1 = getRowsTimestamps();
      const sano = {ricordata: getRowsTimestampsTutteValide(), vera: ts1.length >= 2 && ts1.every(Number.isFinite)};
      // b) dataset con una data rotta in mezzo, non recuperabile dai vicini
      const R = window.__prep(2000);
      R[500].date = 'non una data';
      R[501].date = 'nemmeno questa';
      rowsTimeCache = null; rowsTimeCacheRef = null;
      const ts2 = getRowsTimestamps();
      const rotto = {ricordata: getRowsTimestampsTutteValide(), vera: ts2.length >= 2 && ts2.every(Number.isFinite)};
      // c) tornando a un dataset sano la risposta deve tornare vera
      window.__prep(1500);
      const ts3 = getRowsTimestamps();
      const tornato = {ricordata: getRowsTimestampsTutteValide(), vera: ts3.length >= 2 && ts3.every(Number.isFinite)};
      return {sano, rotto, tornato};
    }, PREPARA.toString());
    assert.equal(r.sano.ricordata, r.sano.vera);
    assert.equal(r.rotto.ricordata, r.rotto.vera, 'con una data rotta la risposta ricordata non coincide');
    assert.equal(r.tornato.ricordata, r.tornato.vera, 'cambiando dataset la risposta e rimasta quella di prima');
    assert.equal(r.sano.vera, true, 'un dataset sano deve risultare tutto valido');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
