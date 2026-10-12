// FOOTPRINT: stile (bidask/delta/volume) e "righe per candela" come impostazioni GLOBALI.
// Segnalato dal proprietario: cliccando le candele lo stile cambia, ma cambiando asset o
// timeframe "torna indietro da solo" e le righe non sono più quelle scelte. Causa verificata:
// erano campi di SESSIONE, quindi applyLightSessionState() (invocata al cambio asset/TF/sessione)
// li riportava allo snapshot salvato ('bidask' e 12). Questi test bloccano la regressione.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('un ripristino di sessione NON azzera stile e righe-per-candela scelti', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const fire = (id, ev) => { const el = document.getElementById(id); if (el) el.dispatchEvent(new Event(ev, {bubbles:true})); };
      const sel = document.getElementById('footprintStyle'); sel.value = 'delta'; fire('footprintStyle','change');
      const rt = document.getElementById('footprintAutoRowsTarget'); rt.value = '20'; fire('footprintAutoRowsTarget','change');
      // Snapshot di una sessione VECCHIA che proverebbe a imporre bidask/12.
      applyLightSessionState({version: (typeof SESSION_VERSION!=='undefined'?SESSION_VERSION:10),
        fields:{footprintStyle:'bidask', footprintAutoRowsTarget:'12'}});
      return {style: footprintStyleNow(), rowsTarget: document.getElementById('footprintAutoRowsTarget').value};
    });
    assert.equal(r.style, 'delta', 'lo stile footprint scelto non deve tornare a bidask');
    assert.equal(r.rowsTarget, '20', 'le righe per candela scelte non devono tornare a 12');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('stile e righe-per-candela NON fanno parte dei campi di sessione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => ({
      inSessione: SESSION_CONFIG_FIELD_IDS.includes('footprintStyle') || SESSION_CONFIG_FIELD_IDS.includes('footprintAutoRowsTarget'),
      inStile: STYLE_CLONE_FIELD_IDS.includes('footprintStyle') || STYLE_CLONE_FIELD_IDS.includes('footprintAutoRowsTarget'),
    }));
    assert.equal(r.inSessione, false, 'footprintStyle/righe non devono essere campi di sessione');
    assert.equal(r.inStile, false, 'footprintStyle/righe non devono essere clonati per sessione');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il ciclo stile (bidask→delta→volume) funziona e resta scelto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const sel = document.getElementById('footprintStyle');
      sel.value = 'bidask';
      const seq = [];
      footprintCicloStile(); seq.push(footprintStyleNow());
      footprintCicloStile(); seq.push(footprintStyleNow());
      footprintCicloStile(); seq.push(footprintStyleNow());
      return {seq};
    });
    assert.deepEqual(r.seq, ['delta', 'volume', 'bidask'], 'il clic cicla bidask→delta→volume→bidask');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('righe fisse: esattamente N righe per candela, senza perdere volume', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const fp = {step:0.0001, rows:{}};
      for (let k = 0; k < 7; k++) fp.rows[(1.0 + k * 0.0001).toFixed(4)] = {buy: 10 + k, sell: 5 + k};
      const n20 = footprintResliceFisse(fp, 20);
      const n5 = footprintResliceFisse(fp, 5);
      const somma = o => Object.values(o.rows).reduce((s, c) => s + (c.buy || 0) + (c.sell || 0), 0);
      return {n20: Object.keys(n20.rows).length, n5: Object.keys(n5.rows).length,
        vol20: somma(n20), volOrig: somma(fp)};
    });
    assert.equal(r.n20, 20, 'la candela deve avere esattamente 20 righe');
    assert.equal(r.n5, 5);
    assert.equal(r.vol20, r.volOrig, 'le righe si riaggregano: il volume totale resta identico');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
