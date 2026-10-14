// IL CERCHIETTO DI AVANZAMENTO MENTRE SCARICA LE CANDELE.
//
// RICHIESTO dal proprietario: «nella cronologia delle sale segnali, a fianco al pulsante "Analizza
// e mostra a grafico", quando si trasforma in "scarico le candele", un cerchietto di riempimento
// con una percentuale, che fa vedere quanto tempo ha a disposizione prima che scarichi tutte
// quante le candele: almeno così si rende conto di quanto deve aspettare».
//
// Su una sala con anni di storia quello scarico dura, e senza percentuale non si capisce se sta
// lavorando o se è piantato.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('il cerchietto si riempie seguendo la percentuale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // Un pulsante finto, come quello della tabella degli asset.
      const td = document.createElement('div');
      const b = document.createElement('button');
      td.appendChild(b); document.body.appendChild(td);
      const box = window.fblCronoAvanzamentoCrea(b);
      const leggi = () => ({
        offset: Number(box.querySelector('.arco').getAttribute('stroke-dashoffset')),
        testo: box.querySelector('.num').textContent,
        che: box.querySelector('.che').textContent
      });
      const a0 = leggi();
      window.fblCronoAvanzamentoAggiorna(box, 0.25, 'candele da 5 minuti');
      const a25 = leggi();
      window.fblCronoAvanzamentoAggiorna(box, 1, 'candele pronte');
      const a100 = leggi();
      const circonferenza = 2 * Math.PI * 9;
      box.remove(); td.remove();
      return {a0, a25, a100, circonferenza};
    });
    assert.equal(r.a0.testo, '0%', 'si parte da zero');
    assert.equal(r.a25.testo, '25%');
    assert.equal(r.a25.che, 'candele da 5 minuti', 'deve dire anche COSA sta scaricando');
    assert.equal(r.a100.testo, '100%');
    // Il cerchio si riempie: l arco scoperto si accorcia man mano.
    assert.ok(r.a0.offset > r.a25.offset && r.a25.offset > r.a100.offset,
      'il cerchietto deve riempirsi: ' + JSON.stringify([r.a0.offset, r.a25.offset, r.a100.offset]));
    assert.ok(Math.abs(r.a100.offset) < 0.2, 'al 100% il cerchio e pieno');
    assert.ok(Math.abs(r.a0.offset - r.circonferenza) < 0.2, 'a zero e vuoto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la percentuale non esce mai dai binari', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const td = document.createElement('div');
      const b = document.createElement('button');
      td.appendChild(b); document.body.appendChild(td);
      const box = window.fblCronoAvanzamentoCrea(b);
      const prova = (v) => { window.fblCronoAvanzamentoAggiorna(box, v, ''); return box.querySelector('.num').textContent; };
      const out = [prova(-1), prova(0), prova(2), prova(NaN), prova(undefined)];
      box.remove(); td.remove();
      return out;
    });
    assert.deepEqual(r, ['0%', '0%', '100%', '0%', '0%'],
      'fuori scala, non un numero, niente: sempre una percentuale sensata');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('lo scarico racconta a che punto e, e il cerchietto sparisce quando ha finito', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  // binanceKlines deve poter dire quanti blocchi ha scaricato: senza, la percentuale sarebbe finta.
  assert.match(src, /async function binanceKlines\(simbolo,intervallo,quante,fineMs,onAvanzamento\)/,
    'binanceKlines deve accettare un avanzamento');
  assert.match(src, /if\(onAvanzamento\)onAvanzamento\(tutte\.length,quante\)/,
    'e chiamarlo dopo ogni blocco scaricato');
  // E il cerchietto non deve restare li dopo.
  assert.match(src, /finally\{ if\(avanz\)avanz\.remove\(\);/,
    'il cerchietto deve sparire anche se lo scarico va storto');
});
