// XAUUSD LIQUIDITY SWEEP v2: UNA RIGA PER CANDELA NON SI LEGGE.
//
// SEGNALATO dal proprietario (26 novembre 2026): «Anche il XAUSD Sweep V2 ... mi disegna una riga
// per ogni candela ... 30 impostazioni ... non saprei dove mettere le mani».
//
// CAUSA MISURATA: ogni pivot confermato (e ne nasce quasi uno per barra su un grafico che oscilla)
// spingeva un livello in `st.livelli`, l'array non aveva tetto, e il render li disegnava TUTTI,
// ognuno lungo `etaMax` barre. In piu' erano accesi per difetto i motivi degli scarti e TUTTE le
// operazioni, non solo l'ultima.
//
// Il test misura il comportamento: quante righe orizzontali finiscono sul grafico con le
// impostazioni di partenza, e quante ne arrivano se si alza il tetto a mano. E controlla che il
// pannello non sia piu' una fila unica di trentasei campi, ma quattro sezioni con le avanzate
// nascoste.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Candele che oscillano a dente di sega: fabbricano molti pivot, che e' la condizione in cui il
// difetto si vedeva.
const PREPARA = () => {
  rows = []; baseRows = []; let p = 4000;
  for (let i = 0; i < 1200; i++) {
    // Gambe da venti barre: cosi' i massimi e minimi sono veri pivot (servono cinque barre
    // piu' basse per lato), e ne nasce uno ogni venti candele.
    const su = (i % 40) < 20;
    const c = p + (su ? 4 : -4);
    rows.push({date: new Date(Date.UTC(2026, 0, 2, 13, 0) + i * 60000).toISOString(),
      open: p, high: Math.max(p, c) + 3, low: Math.min(p, c) - 3, close: c, volume: 10});
    p = c;
  }
  baseRows = rows.slice(); idx = rows.length - 1; viewEnd = rows.length;
  currentAssetKey = 'XAUUSD'; csvLibrary = [{id: 'x', rows}];
};

test('il grafico dello Sweep v2 non disegna un livello per ogni candela', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      (${PREPARA})();
      const def = INDICATOR_DEFS['xau_sweep_v2'];
      const conta = (params) => {
        const ind = {key:'xau_sweep_v2', hidden:false, params: params, calc:{}};
        def.compute(rows, idx, ind);
        let righe = 0;
        // Contesto finto che accetta qualunque chiamata (il disegno della scaletta usa decine di
        // metodi): conta solo gli inizi di tratto, che sono le righe messe sul grafico.
        const vero = {moveTo(){righe++}, measureText(){return {width:20}}};
        const ctx = new Proxy(vero, {
          get(t, k){ if (k in t) return t[k]; return () => undefined; },
          set(){ return true; }
        });
        const xAbs = j => 10 + (j + .5) * 2;
        def.render(ctx, ind, rows, 0, idx, xAbs, v => 5000 - v);
        return {righe: righe, livelliInMemoria: ind.calc.livelli.length};
      };
      const base = conta(def.defaultParams());
      const larghi = Object.assign(def.defaultParams(), {livelliMax: 300});
      const tutti = conta(larghi);
      const d = def.defaultParams();
      return {base: base, tutti: tutti,
              soloUltima: d.soloUltima, mostraScarti: d.mostraScarti, livelliMax: d.livelliMax};
    })()`);
    // Prima condizione: la prova e' valida solo se i livelli nati sono molti piu' del tetto.
    assert.ok(r.base.livelliInMemoria > 20,
      'il banco deve generare molti pivot, altrimenti non misura nulla: ' + JSON.stringify(r));
    // Le righe disegnate per difetto restano poche: questo era il difetto.
    assert.ok(r.base.righe < 20,
      'con le impostazioni di partenza il grafico deve restare pulito: ' + JSON.stringify(r));
    // CONTROPROVA: alzando il tetto a mano le righe tornano tante, quindi il disegno funziona
    // ancora e non e' stato semplicemente spento.
    assert.ok(r.tutti.righe > r.base.righe + 10,
      'alzando "Quanti livelli alla volta" le righe devono tornare: ' + JSON.stringify(r));
    assert.equal(r.soloUltima, true, 'per difetto si mostra solo l ultima operazione');
    assert.equal(r.mostraScarti, false, 'per difetto i motivi degli scarti sono spenti');
    assert.equal(r.livelliMax, 3);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le impostazioni dello Sweep v2 sono divise in sezioni, con le avanzate nascoste', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      const gruppi = XAUSWEEP_GRUPPI.map(g => g.id);
      const senzaGruppo = XAUSWEEP_SETTINGS.filter(s => gruppi.indexOf(s.g) < 0).map(s => s.key);
      const base = XAUSWEEP_SETTINGS.filter(s => !s.adv);
      // Il pannello si costruisce davvero, con aiuti finti al posto di quelli del modale.
      const riga = document.createElement('div');
      const finto = (t) => { const e = document.createElement('span'); e.dataset.campo = t; return e; };
      const mk = {mkNum: () => finto('num'), mkCheck: () => finto('check'),
                  mkColor: () => finto('color'), mkSelect: () => finto('select')};
      xauSweepBuildSettings({key:'xau_sweep_v2', params: INDICATOR_DEFS['xau_sweep_v2'].defaultParams()}, riga, mk);
      const titoli = Array.prototype.filter.call(riga.children,
        e => e.tagName === 'DIV' && e.textContent && !e.querySelector('[data-campo]')).length;
      return {totale: XAUSWEEP_SETTINGS.length, base: base.length, gruppi: gruppi.length,
              senzaGruppo: senzaGruppo, titoli: titoli};
    })()`);
    assert.deepEqual(r.senzaGruppo, [], 'ogni impostazione deve stare in una sezione');
    assert.equal(r.gruppi, 4);
    assert.ok(r.base <= 20,
      'per difetto si devono vedere poche impostazioni, non tutte: ' + JSON.stringify(r));
    assert.ok(r.totale >= 36, 'nessuna impostazione e stata buttata via: ' + JSON.stringify(r));
    assert.ok(r.titoli >= 4, 'le sezioni devono avere un titolo scritto: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
