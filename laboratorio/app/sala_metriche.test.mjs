// DASHBOARD: PASSANDO SOPRA UNA SALA SI VEDE ANCHE COME HA RESO DAVVERO.
//
// RICHIESTO dal proprietario: «nella sezione del profitto per sala, quando passiamo sopra a ogni
// sala segnali, oltre al profitto nel tempo, al numero di trade, al win rate e al loss rate, ci
// deve anche far vedere la resa espressa in percentuale, il guadagno medio per operazione, R/R e
// il drawdown max».
//
// Sono i quattro numeri che dicono se una sala vale la pena al di là del totale in euro: due sale
// con lo stesso profitto possono avere un rischio per operazione e una discesa completamente
// diversi.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

// Quattro operazioni della stessa sala: due vinte e due perse, con un calo in mezzo.
const TRADES = () => {
  const g = (i) => Date.UTC(2026, 0, 2 + i, 10, 0, 0);
  trades = [
    {id: 'A', asset: 'EURUSD', side: 'BUY', mode: 'backtest', entry: 1.1, exit: 1.11, sl: 1.09, tp: 1.12,
     lots: 0.1, result: 'TP', pips: 10, pl: 200, pct: 2, account: 10000, strategy: '', tgSala: 'Sala Uno',
     startTime: g(0), closedAt: new Date(g(0) + 3600000).toISOString()},
    {id: 'B', asset: 'EURUSD', side: 'BUY', mode: 'backtest', entry: 1.1, exit: 1.09, sl: 1.09, tp: 1.12,
     lots: 0.1, result: 'SL', pips: -10, pl: -100, pct: -1, account: 10200, strategy: '', tgSala: 'Sala Uno',
     startTime: g(1), closedAt: new Date(g(1) + 3600000).toISOString()},
    {id: 'C', asset: 'EURUSD', side: 'BUY', mode: 'backtest', entry: 1.1, exit: 1.09, sl: 1.09, tp: 1.12,
     lots: 0.1, result: 'SL', pips: -10, pl: -100, pct: -1, account: 10100, strategy: '', tgSala: 'Sala Uno',
     startTime: g(2), closedAt: new Date(g(2) + 3600000).toISOString()},
    {id: 'D', asset: 'EURUSD', side: 'BUY', mode: 'backtest', entry: 1.1, exit: 1.12, sl: 1.09, tp: 1.12,
     lots: 0.1, result: 'TP', pips: 20, pl: 400, pct: 4, account: 10000, strategy: '', tgSala: 'Sala Uno',
     startTime: g(3), closedAt: new Date(g(3) + 3600000).toISOString()}
  ];
};

test('il riquadro della sala porta resa, guadagno medio, R/R e calo massimo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      fblStatApri();
      // fblStatApri disegna su requestAnimationFrame: due frame e c'e' tutto.
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const carte = [...document.querySelectorAll('#fblStatOverlay .fsCard')];
      const c = carte.find(x => /Profitto per sala/.test(x.textContent));
      if (!c) return {trovata: false};
      // Il riquadro che compare passando sopra: lo si legge dal titolo della barra.
      // La tabella della carta e' chiusa finche' non si preme «Tabella».
      const bt = [...c.querySelectorAll('button.fsTab')].find(x => x.textContent === 'Tabella');
      if (bt) bt.click();
      return {trovata: true, testo: c.textContent};
    }, TRADES.toString());
    assert.equal(r.trovata, true, 'la carta «Profitto per sala» deve esserci');
    // La tabella della carta porta le stesse colonne: e' li' che si leggono senza passare sopra.
    assert.match(r.testo, /Resa/, 'manca la resa in percentuale');
    assert.match(r.testo, /Medio/, 'manca il guadagno medio per operazione');
    assert.match(r.testo, /R\/R/, 'manca il R/R');
    assert.match(r.testo, /Calo max/, 'manca il calo massimo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i numeri sono quelli giusti: resa sommata, medio, calo dal punto piu\' alto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      fblStatApri();
      // fblStatApri disegna su requestAnimationFrame: due frame e c'e' tutto.
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const c = [...document.querySelectorAll('#fblStatOverlay .fsCard')].find(x => /Profitto per sala/.test(x.textContent));
      const bt = [...c.querySelectorAll('button.fsTab')].find(x => x.textContent === 'Tabella');
      if (bt) bt.click();
      // tabellaHtml costruisce <table> senza <tbody>: le righe stanno dirette dentro la tabella.
      return [...c.querySelectorAll('table.fsT tr')].map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent)).filter(r => r.length);
    }, TRADES.toString());
    const riga = r.find(x => x[0] === 'Sala Uno');
    assert.ok(riga, 'la riga della sala deve esserci: ' + JSON.stringify(r));
    assert.equal(riga[1], '4', 'quattro operazioni');
    // resa = 2 - 1 - 1 + 4 = +4,00%
    assert.match(riga[3], /\+4[.,]00%/, 'resa attesa +4,00%, trovata ' + riga[3]);
    // medio = (200-100-100+400)/4 = +100
    assert.match(riga[4], /100/, 'guadagno medio atteso 100 €, trovato ' + riga[4]);
    // calo massimo: dal picco 200 si scende a 0 -> −200
    assert.match(riga[6], /200/, 'calo massimo atteso 200 €, trovato ' + riga[6]);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il riquadro al passaggio del mouse elenca le stesse quattro voci', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  assert.match(src, /const plTipSala=\(nome,a\)=>\{/, 'serve un riquadro dedicato alla sala');
  ['resa ', 'in media ', 'R/R ', 'calo massimo '].forEach(voce => {
    assert.ok(src.includes("l:'" + voce) || src.includes("l:'" + voce.trim()),
      'manca la voce «' + voce.trim() + '» nel riquadro della sala');
  });
  assert.match(src, /tip:plTipSala\(k,a\)/, 'la carta «Profitto per sala» deve usare quel riquadro');
});
