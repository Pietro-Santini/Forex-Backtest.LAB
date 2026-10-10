// Prova dell'indicatore nativo "Gann 21.7 Profit Factor (4h)" (INDICATOR_DEFS.gann217).
// Non apre il browser: estrae dal vero app.html il blocco `gann217:{...}`, lo esegue su una serie nota
// e disegna su un contesto finto che CONTA le chiamate. Cosi' e' veloce e non dipende dalla rete.
//
// Come si prova che il test serve: `GANN_APP=<file senza l'indicatore> node ...` deve uscire rosso.
// Prove di controllo (lezione del 9 ottobre): il disegno si misura anche col caso che NON deve
// disegnare nulla, altrimenti un disegno mancante passerebbe per buono.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const qui = path.dirname(fileURLToPath(import.meta.url));
const appPath = process.env.GANN_APP || path.resolve(qui, '..', '..', 'app.html');
const src = fs.readFileSync(appPath, 'utf8');

let falliti = 0;
function prova(nome, fn) {
  try { fn(); console.log('ok   -', nome); }
  catch (e) { falliti++; console.log('FAIL -', nome, '\n      ', e.message); }
}

// ---- estrazione del blocco gann217 da app.html (a capo CRLF compreso) ----
function estrai(testo) {
  const m = /^[ \t]*gann217:\{/m.exec(testo);
  if (!m) return null;
  const ini = testo.indexOf('{', m.index);
  let prof = 0, i = ini, q = null;
  for (; i < testo.length; i++) {
    const ch = testo[i];
    if (q) { if (ch === '\\') i++; else if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue; }
    if (ch === '/' && testo[i + 1] === '/') { while (i < testo.length && testo[i] !== '\n') i++; continue; }
    if (ch === '{') prof++;
    else if (ch === '}') { prof--; if (prof === 0) break; }
  }
  return testo.slice(ini, i + 1);
}

const blocco = estrai(src);
let def = null;
prova('INDICATOR_DEFS.gann217 esiste in app.html', () => {
  assert.ok(blocco, 'blocco gann217 non trovato in ' + appPath);
  def = new Function('return (' + blocco + ')')();
  assert.equal(typeof def.compute, 'function');
  assert.equal(typeof def.render, 'function');
  assert.equal(typeof def.defaultParams, 'function');
});
prova('e\' selezionabile dal menu "+ Aggiungi indicatore"', () => {
  assert.ok(/<option value="gann217">/.test(src), 'manca <option value="gann217"> nel menu');
});
prova('il pannello impostazioni ha il ramo gann217', () => {
  assert.ok(/ind\.key==='gann217'/.test(src), "manca il ramo ind.key==='gann217' nel modale impostazioni");
});
if (!def) { console.log('\nFalliti:', falliti); process.exit(1); }

// ---- serie nota: trend a onde con volumi, deterministica ----
function serie(n = 700) {
  const rows = []; let prezzo = 100, seme = 12345;
  const rnd = () => (seme = (seme * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let i = 0; i < n; i++) {
    const deriva = Math.sin(i / 25) * 0.9 + (rnd() - 0.5) * 0.8;
    const o = prezzo, c = o + deriva;
    const h = Math.max(o, c) + rnd() * 0.6, l = Math.min(o, c) - rnd() * 0.6;
    const v = 1000 + rnd() * 500 + (i % 37 === 0 ? 4000 : 0);
    rows.push({ time: 1.7e9 + i * 14400, open: o, high: h, low: l, close: c, volume: v });
    prezzo = c;
  }
  return rows;
}
const rows = serie();
const nuovo = (over = {}) => ({ key: 'gann217', params: { ...def.defaultParams(), ...over }, calc: { builtTo: -1 } });

prova('i parametri di default sono tutti numeri o interruttori (modificabili dal pannello)', () => {
  const d = def.defaultParams(), chiavi = Object.keys(d);
  assert.ok(chiavi.length >= 30, 'pochi parametri: ' + chiavi.length);
  for (const k of chiavi) assert.ok(['number', 'boolean'].includes(typeof d[k]), k + ' non e\' numero ne\' booleano');
});

const ind = nuovo({ useEmaFilter: false });
def.compute(rows, rows.length - 1, ind);
const c = ind.calc;

prova('compute produce la linea Gann su una serie nota', () => {
  const buoni = c.gannLine.filter(Number.isFinite).length;
  assert.ok(buoni > rows.length * 0.9, 'linea Gann quasi vuota: ' + buoni);
  assert.ok(c.gannTrend.some(t => t === 1) && c.gannTrend.some(t => t === -1), 'il trend non gira mai');
});
prova('compute produce segnali e operazioni', () => {
  assert.ok(c.signals.length > 3, 'segnali: ' + c.signals.length);
  assert.ok(c.signals.every(s => ['long', 'short'].includes(s.side) && /GANN|VOL|REV/.test(s.source)));
  assert.ok(c.trades.length > 0, 'nessuna operazione chiusa');
});
prova('il calcolo a pezzi da' + ' lo stesso risultato del calcolo intero', () => {
  const b = nuovo({ useEmaFilter: false });
  def.compute(rows, 300, b); def.compute(rows, rows.length - 1, b);
  assert.deepEqual(b.calc.signals, c.signals);
  assert.deepEqual(b.calc.gannLine.map(x => Number.isNaN(x) ? null : x), c.gannLine.map(x => Number.isNaN(x) ? null : x));
});
prova('il filtro EMA toglie segnali (il parametro agisce davvero)', () => {
  const e = nuovo({ useEmaFilter: true, emaLen: 50 });
  def.compute(rows, rows.length - 1, e);
  const gann = k => k.filter(s => s.source === 'GANN').length;
  assert.ok(gann(e.calc.signals) < gann(c.signals), gann(e.calc.signals) + ' vs ' + gann(c.signals));
});

// ---- disegno: contesto finto che conta ----
function disegna(indic, da = 0, a = rows.length - 1) {
  const n = { stroke: 0, fill: 0, text: 0, textList: [] };
  const ctx = new Proxy({}, { get(_, k) {
    if (k === 'stroke') return () => n.stroke++;
    if (k === 'fill') return () => n.fill++;
    if (k === 'fillText') return (t) => { n.text++; n.textList.push(String(t)); };
    return () => {};
  }, set() { return true; } });
  def.render(ctx, indic, rows, da, a, i => i * 5, p => 500 - p * 3, 0, 400);
  return n;
}
prova('render disegna davvero (linea, triangoli, etichette)', () => {
  const n = disegna(ind);
  assert.ok(n.stroke > 100, 'tratti della linea: ' + n.stroke);
  assert.ok(n.fill > 0, 'triangoli: ' + n.fill);
  assert.ok(n.textList.some(t => /^(LONG|SHORT) \[(GANN|VOL|REV)\]$/.test(t)), 'nessuna etichetta di ingresso');
});
prova('CONTROLLO: con tutto spento render non disegna niente', () => {
  const off = nuovo({ useEmaFilter: false, showGannLine: false, showRawShapes: false, showMarkers: false, showLabels: false });
  def.compute(rows, rows.length - 1, off);
  const n = disegna(off);
  assert.equal(n.stroke + n.fill + n.text, 0, JSON.stringify(n));
});
prova('CONTROLLO: fuori dalla finestra visibile non disegna niente', () => {
  const n = disegna(ind, 5000, 5100);
  assert.equal(n.stroke + n.fill + n.text, 0);
});
prova('showLabels spento: restano i triangoli, spariscono le etichette', () => {
  const l = nuovo({ useEmaFilter: false, showLabels: false });
  def.compute(rows, rows.length - 1, l);
  const n = disegna(l);
  assert.equal(n.text, 0); assert.ok(n.fill > 0);
});
prova('showDebug: le etichette "bloccato" compaiono solo se attivo', () => {
  const d = nuovo({ useEmaFilter: true, emaLen: 50, showDebug: true });
  def.compute(rows, rows.length - 1, d);
  assert.ok(d.calc.blocked.length > 0, 'nessun flip bloccato da mostrare: serie inadatta');
  assert.ok(disegna(d).textList.some(t => /bloccato/.test(t)));
  assert.ok(!disegna(ind).textList.some(t => /bloccato/.test(t)));
});

console.log('\nFalliti:', falliti);
process.exit(falliti ? 1 : 0);
