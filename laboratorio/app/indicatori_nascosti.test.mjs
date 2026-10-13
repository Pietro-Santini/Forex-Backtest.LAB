// UN INDICATORE NASCOSTO NON DEVE PESARE SUL GRAFICO.
//
// RICHIESTO dal proprietario: spegnendo l'occhio di un indicatore il grafico restava lento. Il
// motivo: si saltava solo il DISEGNO, mentre compute() girava comunque a ogni ridisegno. Con dieci
// indicatori nascosti si pagava il conto di dieci indicatori accesi, e il risultato non lo vedeva
// nessuno.
//
// Riaccendendolo non si deve perdere niente: il calcolo e' incrementale (parte da
// ind.calc.builtTo), quindi al primo ridisegno recupera da solo le candele saltate.
//
// Si prova con un indicatore FINTO aggiunto a INDICATOR_DEFS, che conta quante volte vengono
// chiamati compute e render: e' esattamente l'affermazione da dimostrare, senza dipendere da come
// e' fatto un indicatore vero.
//
// Come si prova che il test serve: rimettendo il vecchio `if(!ind.hidden)def.render(...)` (con
// compute FUORI dall'if) il primo test va rosso, perche' compute viene chiamato comunque.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp, PREPARA_BTC} from './aiuti.mjs';

// Indicatore finto: conta le chiamate e ricorda fin dove gli e' stato chiesto di calcolare.
const FINTO = (nascosto) => {
  window.__conti = {compute:0, render:0, fino:[]};
  INDICATOR_DEFS.__prova = {
    label:'Prova',
    defaultParams:()=>({}),
    compute:(rows,upToIdx,ind)=>{ window.__conti.compute++; window.__conti.fino.push(upToIdx); ind.calc.builtTo=upToIdx; },
    render:()=>{ window.__conti.render++; }
  };
  activeIndicators = [{id:1, key:'__prova', params:{}, hidden:!!nascosto, calc:{ref:null, builtTo:-1}}];
};

test('un indicatore NASCOSTO non viene nemmeno calcolato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((args) => {
      eval('(' + args.prep + ')')();
      eval('(' + args.finto + ')')(true);
      draw(); draw();                      // due ridisegni: nascosto deve costare zero
      return {conti: window.__conti, builtTo: activeIndicators[0].calc.builtTo};
    }, {prep: PREPARA_BTC.toString(), finto: FINTO.toString()});
    assert.equal(r.conti.compute, 0, 'nascosto: compute() non deve essere chiamato nemmeno una volta');
    assert.equal(r.conti.render, 0, 'nascosto: non si disegna, come prima');
    assert.equal(r.builtTo, -1);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un indicatore VISIBILE viene calcolato e disegnato, fino alla candela corrente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((args) => {
      eval('(' + args.prep + ')')();
      eval('(' + args.finto + ')')(false);
      draw();
      return {conti: window.__conti, builtTo: activeIndicators[0].calc.builtTo, idx};
    }, {prep: PREPARA_BTC.toString(), finto: FINTO.toString()});
    assert.ok(r.conti.compute >= 1, 'visibile: compute() deve girare');
    assert.ok(r.conti.render >= 1, 'visibile: si disegna');
    assert.equal(r.builtTo, r.idx, 'il calcolo arriva alla candela corrente, non oltre');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('riaccendendo l\'occhio il calcolo riparte e recupera fino alla candela corrente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((args) => {
      eval('(' + args.prep + ')')();
      eval('(' + args.finto + ')')(true);
      draw();
      const daSpento = window.__conti.compute;
      activeIndicators[0].hidden = false;      // si riaccende l'occhio
      draw();
      return {daSpento, dopo: window.__conti.compute, fino: window.__conti.fino,
              builtTo: activeIndicators[0].calc.builtTo, idx};
    }, {prep: PREPARA_BTC.toString(), finto: FINTO.toString()});
    assert.equal(r.daSpento, 0);
    assert.ok(r.dopo >= 1, 'riacceso: il calcolo riparte da solo al primo ridisegno');
    assert.equal(r.builtTo, r.idx, 'riacceso deve ritrovarsi al pari, senza buchi');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
