// Prova del "Testa strategia" — il motore del backtester che gira sulle candele caricate
// (storico o live), come il tester di TradingView.
//
// Il motore vive in app.html fra due marcatori e viene estratto da qui ed eseguito fuori dal
// browser: veloce e senza rete. Come si prova che il test serve:
// `TESTA_APP=<file senza il motore> node ...` deve uscire rosso.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const qui = path.dirname(fileURLToPath(import.meta.url));
const appPath = process.env.TESTA_APP || path.resolve(qui, '..', '..', 'app.html');
const src = fs.readFileSync(appPath, 'utf8');

let falliti = 0;
function prova(nome, fn) {
  try { fn(); console.log('ok   -', nome); }
  catch (e) { falliti++; console.log('FAIL -', nome, '\n       ', e.message); }
}

const M0 = '// ==== TESTA-STRATEGIA: motore (estraibile) ====';
const M1 = '// ==== TESTA-STRATEGIA: fine motore ====';
function estraiMotore() {
  const a = src.indexOf(M0), b = src.indexOf(M1);
  if (a < 0 || b < 0 || b < a) return null;
  const blocco = src.slice(a + M0.length, b);
  return new Function(blocco + '; return fblTestaStrategiaDiCandele;')();
}
let motore = null;
prova('il motore "Testa strategia" sta in app.html ed e\' una funzione', () => {
  motore = estraiMotore();
  assert.equal(typeof motore, 'function', 'blocco motore non trovato in ' + appPath);
});

// --- serie di prova ---
function piatta(n) { return Array.from({ length: n }, (_, i) => ({ time: 1.7e9 + i * 14400, open: 100, high: 100, low: 100, close: 100, volume: 0 })); }
function salita(n) {
  let px = 100, s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [];
  for (let i = 0; i < n; i++) {
    const cyc = i % 40, drift = cyc < 30 ? 0.9 : -1.4;
    const c = px + drift + (rnd() - 0.5) * 0.7, o = px;
    out.push({ time: 1.7e9 + i * 14400, open: o, high: Math.max(o, c) + rnd() * 0.25, low: Math.min(o, c) - rnd() * 0.25, close: c, volume: 0 });
    px = c;
  }
  return out;
}
const BASE = { gannLength: 3, useEmaFilter: false, initK: 2, trailK: 3, useFlip: true, rischio: 1, capitale: 10000 };

prova('serie piatta: nessun trade, la curva e\' un punto solo, resta il capitale', () => {
  const r = motore(piatta(300), BASE);
  assert.equal(r.usate, 0, 'ha inventato trade: ' + r.usate);
  assert.equal(r.punti.length, 1);
  assert.equal(r.finale, 10000);
  assert.equal(r.resa, 0);
});

prova('serie in salita: il trend-following chiude in profitto', () => {
  const r = motore(salita(400), BASE);
  assert.ok(r.usate >= 5, 'troppo pochi trade per giudicare: ' + r.usate);
  assert.ok(r.resa > 0, 'resa non positiva: ' + r.resa);
  assert.equal(r.perAnno.length, 1);
});

prova('la curva e\' coerente: punti = trade+1, parte dal capitale, finisce al finale', () => {
  const r = motore(salita(400), BASE);
  assert.equal(r.punti.length, r.usate + 1, 'punti ' + r.punti.length + ' vs trade ' + r.usate);
  assert.equal(r.punti[0].cap, r.capitale);
  assert.ok(Math.abs(r.punti[r.punti.length - 1].cap - r.finale) < 1e-6, 'ultimo punto != finale');
});

prova('il finale e\' il capitale composto col rischio per trade (1% per trade)', () => {
  const r = motore(salita(400), BASE);
  const atteso = r.trades.reduce((acc, t) => acc * (1 + 0.01 * t.R), r.capitale);
  assert.ok(Math.abs(r.finale - atteso) < 1e-6, r.finale + ' vs ' + atteso);
});

prova('PF = profitti lordi / perdite lorde (dai numeri, non da una stima)', () => {
  const r = motore(salita(400), BASE);
  const w = r.trades.filter(t => t.R > 0).reduce((s, t) => s + t.R, 0);
  const l = -r.trades.filter(t => t.R < 0).reduce((s, t) => s + t.R, 0);
  const pf = l ? w / l : (w > 0 ? Infinity : 0);
  assert.ok(r.pf === pf || Math.abs(r.pf - pf) < 1e-9, r.pf + ' vs ' + pf);
});

prova('CONTROLLO: le commissioni alte peggiorano il risultato (il parametro agisce)', () => {
  const zero = motore(salita(400), { ...BASE, commPct: 0 });
  const caro = motore(salita(400), { ...BASE, commPct: 0.5 });
  assert.ok(caro.finale < zero.finale, 'le commissioni non hanno effetto: ' + caro.finale + ' vs ' + zero.finale);
});

prova('CONTROLLO: ogni trade chiude dopo la sua apertura', () => {
  const r = motore(salita(400), BASE);
  assert.ok(r.trades.length > 0);
  assert.ok(r.trades.every(t => t.iUscita > t.iEntrata && typeof t.R === 'number' && isFinite(t.R)));
});

prova('CONTROLLO: con rischio 0 il capitale non cambia (il sizing e\' collegato al rischio)', () => {
  const r = motore(salita(400), { ...BASE, rischio: 0 });
  assert.ok(r.usate >= 1, 'nessun trade da valutare: ' + r.usate);
  assert.equal(r.finale, 10000);
});

// --- serie che PERDONO, per collaudare le protezioni ---
function seghettata(n) {
  let s = 4242; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let px = 100; const out = [];
  for (let i = 0; i < n; i++) {
    const dir = (i % 2 === 0) ? 1 : -1;
    const c = px * (1 + dir * 0.012) + (rnd() - 0.5) * 0.6, o = px;
    out.push({ time: 1.7e9 + i * 14400, open: o, high: Math.max(o, c) + rnd() * 0.3, low: Math.min(o, c) - rnd() * 0.3, close: c, volume: 0 });
    px = c;
  }
  return out;
}
function camminata(n) {
  let s = 31337; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const gauss = () => { const u = Math.max(rnd(), 1e-9), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  let px = 100; const out = [];
  for (let i = 0; i < n; i++) { const o = px, c = o * Math.exp(0.015 * gauss()); out.push({ time: 1.7e9 + i * 14400, open: o, high: Math.max(o, c) * 1.002, low: Math.min(o, c) * 0.998, close: c, volume: 0 }); px = c; }
  return out;
}

prova('l\'interruttore sul conto ferma tutto quando il drawdown supera la soglia', () => {
  const senza = motore(seghettata(1500), { ...BASE, rischio: 1 });
  const con = motore(seghettata(1500), { ...BASE, rischio: 1, ddStopPct: 0.5 });
  assert.ok(senza.ddMax > 10, 'la serie di prova non perde come previsto: ddMax=' + senza.ddMax);
  assert.equal(con.interrotto, true, 'l\'interruttore non e\' scattato');
  assert.ok(con.usate < senza.usate, 'non ha ridotto i trade: ' + con.usate + ' vs ' + senza.usate);
  assert.ok(con.ddMax <= 1.5, 'drawdown non contenuto: ' + con.ddMax);
});

prova('CONTROLLO: senza interruttore (ddStop 0) il conto continua a operare', () => {
  const r = motore(seghettata(1500), { ...BASE, rischio: 1, ddStopPct: 0 });
  assert.equal(r.interrotto, false);
  assert.ok(r.usate > 50, 'troppo pochi trade: ' + r.usate);
});

prova('limite di perdita giornaliera: raggiunto, niente nuove aperture quel giorno', () => {
  const senza = motore(camminata(1500), { ...BASE, rischio: 1 });
  const con = motore(camminata(1500), { ...BASE, rischio: 1, perditaGiornoPct: 0.05 });
  assert.ok(con.usate < senza.usate, 'il limite giornaliero non ha ridotto i trade: ' + con.usate + ' vs ' + senza.usate);
  assert.ok(con.ddMax <= senza.ddMax, 'drawdown peggiorato: ' + con.ddMax + ' vs ' + senza.ddMax);
});

// --- le candele dell'app hanno `date` (stringa MT5), non `time`: il motore deve leggerle ---
function salitaConDate(n) {
  let px = 100, s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const p2 = (x) => String(x).padStart(2, '0');
  const out = [];
  for (let i = 0; i < n; i++) {
    const cyc = i % 40, drift = cyc < 30 ? 0.9 : -1.4;
    const c = px + drift + (rnd() - 0.5) * 0.7, o = px;
    const d = new Date(1750000000000 + i * 14400000);
    out.push({
      date: d.getUTCFullYear() + '.' + p2(d.getUTCMonth() + 1) + '.' + p2(d.getUTCDate()) + ' ' + p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()),
      open: o, high: Math.max(o, c) + rnd() * 0.25, low: Math.min(o, c) - rnd() * 0.25, close: c, volume: 0,
    });
    px = c;
  }
  return out;
}

prova('candele con `date` (come nell\'app) invece di `time`: il motore le legge, non lancia errori', () => {
  const r = motore(salitaConDate(400), BASE);
  assert.ok(r.usate >= 5, 'troppo pochi trade sulle candele con `date`: ' + r.usate);
  assert.equal(r.perAnno.length, 1, 'la data non viene letta: anni calcolati = ' + r.perAnno.length);
  assert.ok(Number.isFinite(r.punti[0].t), 'il primo punto della curva non ha un tempo valido');
});

prova('CONTROLLO: una candela senza `time` ne\' `date` non fa esplodere il motore', () => {
  const dati = salitaConDate(200);
  delete dati[100].date;
  let r;
  assert.doesNotThrow(() => { r = motore(dati, BASE); }, 'il motore deve ignorare una candela senza data');
  assert.ok(r && Number.isFinite(r.finale), 'il risultato deve essere comunque calcolato');
});

console.log('\nFalliti:', falliti);

process.exit(falliti ? 1 : 0);
