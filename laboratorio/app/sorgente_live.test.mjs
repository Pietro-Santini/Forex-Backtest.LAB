// Collaudo: la fonte scelta al cambio timeframe in Live (fblSorgenteLivePerCambioTf).
// Perche' serve: il guasto segnalato ("cambiando timeframe, disegni/linee/posizioni/indicatori si
// staccano dalle candele, soprattutto a mercato chiuso") nasceva dal fatto che il cambio timeframe
// chiamava SEMPRE Capital.com, anche quando il grafico stava mostrando MT5: la serie veniva
// sostituita e, a mercato chiuso, lo streaming Capital.com si riaccendeva creando candele finte.
// Qui si prova che la fonte scelta dipende dal FILE a grafico (maintains the same source) e non
// cambia di nascosto.
// Come si prova che il collaudo serve: `SORGENTE_APP=<file senza la funzione> node ...` esce rosso.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const qui = path.dirname(fileURLToPath(import.meta.url));
const appPath = process.env.SORGENTE_APP || path.resolve(qui, '..', '..', 'app.html');
const src = fs.readFileSync(appPath, 'utf8');

let falliti = 0;
function prova(nome, fn) {
  try { fn(); console.log('ok   -', nome); }
  catch (e) { falliti++; console.log('FAIL -', nome, '\n       ', e.message); }
}

const M0 = '// FBL:TESTA-SORGENTE-LIVE:INIZIO';
const M1 = '// FBL:TESTA-SORGENTE-LIVE:FINE';
function estrai() {
  const a = src.indexOf(M0), b = src.indexOf(M1);
  if (a < 0 || b < 0 || b < a) return null;
  const blocco = src.slice(a + M0.length, b);
  return new Function(blocco + '; return fblSorgenteLivePerCambioTf;')();
}
let scelta = null;
prova('la scelta della fonte sta in app.html ed e\' una funzione', () => {
  scelta = estrai();
  assert.equal(typeof scelta, 'function', 'blocco FBL:TESTA-SORGENTE-LIVE non trovato in ' + appPath);
});

prova('grafico su MT5 + cambio TF: resta MT5 (non passa di nascosto a Capital.com)', () => {
  assert.equal(scelta('mt5_live_XAUUSD', 'mt5', true), 'mt5');
  assert.equal(scelta('mt5_live_XAUUSD', 'closed', true), 'mt5');
  assert.equal(scelta('mt5_live_XAUUSD', 'capital', true), 'mt5');
});

prova('grafico su Capital.com + cambio TF: resta Capital.com', () => {
  assert.equal(scelta('capital_live_GOLD', 'mt5', false), 'capital');
  assert.equal(scelta('capital_live_GOLD', 'closed', false), 'capital');
  assert.equal(scelta('capital_live_GOLD', 'free', false), 'capital');
});

prova('senza file (avvio): MT5 se collegato, altrimenti Capital.com', () => {
  assert.equal(scelta('', 'free', true), 'mt5');
  assert.equal(scelta(null, 'free', true), 'mt5');
  assert.equal(scelta('', 'free', false), 'capital');
  assert.equal(scelta(undefined, 'free', false), 'capital');
});

prova('nome file imprevisto: ricade su MT5 se collegato, altrimenti Capital.com', () => {
  assert.equal(scelta('altro_file', 'mt5', true), 'mt5');
  assert.equal(scelta('altro_file', 'mt5', false), 'capital');
});

prova('la vecchia logica (sempre Capital.com) NON sarebbe accettata', () => {
  // Controprova: il bug era "sempre Capital.com". Con questa funzione, per un grafico MT5 il
  // risultato NON e' mai 'capital'.
  for (const fase of ['mt5', 'capital', 'closed', 'free'])
    assert.notEqual(scelta('mt5_live_XAUUSD', fase, true), 'capital', 'fase ' + fase);
});

console.log(falliti ? `\n${falliti} prove fallite` : '\nTutte le prove superate');
process.exit(falliti ? 1 : 0);
