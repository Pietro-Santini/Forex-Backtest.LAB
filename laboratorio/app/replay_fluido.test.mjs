// LA CANDELA IN FORMAZIONE NON PUÒ LAMPEGGIARE, E IL PLAY NON SI BLOCCA.
//
// SEGNALATO dal proprietario: «quando aggiorna, la candela si accende e si spegne subito, si
// accende e si spegne subito; le altre, quelle già completate, vanno bene — il problema è
// l'ultima, quella che si sta formando». E prima: «col tasto play a volte si blocca, soprattutto
// con un moltiplicatore di aggiornamento più alto, e deve continuare a girare anche se ci
// troviamo su un'altra scheda».
//
// LA CAUSA DEL LAMPEGGIO: la candela in formazione era un RITOCCO applicato DOPO draw(), e solo
// dal battito del replay. Ogni altro ridisegno — il mirino, il pannello, e soprattutto forward()
// a ogni candela completata — ridipingeva il grafico SENZA di lei. Più si accelerava, più spesso
// le candele si completavano, più spesso il grafico veniva dipinto "senza": per questo lampeggiava
// di più proprio alzando il moltiplicatore.
//
// LA CAUSA DEL BLOCCO: il battito dava per scontato che fra un giro e l'altro passassero
// esattamente 50 ms. Su una scheda non in primo piano i browser rallentano i timer a un battito al
// secondo: si avanzavano 50 ms di mercato ogni 1000 ms di orologio, venti volte più lento.
//
// L'INVARIANTE PROVATA QUI: finché una candela si sta formando, NESSUN draw() può concludersi
// senza averla disegnata. Non si misura "quante volte lampeggia" (non si saprebbe contare), si
// misura che il caso che la fa sparire non esiste più.
//
// Come si prova che il test serve: rimettendo il disegno della formazione fuori da draw() (nel
// solo battito) il primo test va rosso.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

const PREPARA = () => {
  const t0 = Date.now() - 400 * 60000;
  const R = [];
  for (let i = 0; i < 400; i++) R.push({date: new Date(t0 + i * 60000).toISOString(),
    open: 100 + (i % 7) * 0.01, high: 100.4, low: 99.6, close: 100.1 + (i % 5) * 0.01, volume: 4});
  rows = R; baseRows = R; currentTF = 1;
  idx = 300; viewEnd = 320; masterTime = t0 + 300 * 60000;
  currentAssetKey = 'EURUSD'; if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; liveReplayActive = false; mt5Connected = false;
  positions = []; trades = []; drawings = []; replayForm = null;
  followLatest = true; visibleCount = 120; autoFitWidth = false;
  if ($('speed')) $('speed').value = '30';
  draw();
};

// Avvolge draw() e il disegnatore della formazione per contare, ad ogni ridisegno, se la candela
// in formazione c'era oppure no.
const SPIA = () => {
  const origDraw = draw, origForm = replayDisegnaFormazione;
  const conto = {disegni: 0, senzaFormazione: 0};
  let dipinta = false;
  replayDisegnaFormazione = function(f){ dipinta = true; return origForm.apply(this, arguments); };
  draw = function(){
    dipinta = false;
    const r = origDraw.apply(this, arguments);
    conto.disegni++;
    if (replayForm && replayForm.idx === idx + 1 && !dipinta) conto.senzaFormazione++;
    return r;
  };
  conto.basta = () => { draw = origDraw; replayDisegnaFormazione = origForm; };
  return conto;
};

test('finché si forma una candela, nessun ridisegno può concludersi senza averla disegnata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(({PREPARA_SRC, SPIA_SRC}) => {
      eval('(' + PREPARA_SRC + ')()');
      replayForm = replayAvviaFormazione(idx + 1);
      const spia = (eval('(' + SPIA_SRC + ')'))();
      try{
        // Tutte le strade che ridipingono il grafico mentre la candela si sta formando.
        draw();                 // un ridisegno qualunque (mirino, pannello, prezzo dal vivo…)
        update();               // l'aggiornamento del pannello
        draw(); draw();
        const dopoDisegni = {...spia};
        // E la strada che faceva sparire la candela per davvero: una candela che si completa.
        const primaIdx = idx;
        replayForm = null;
        forward();              // ridisegna: qui la formazione non c'è ancora (giusto)
        replayForm = replayAvviaFormazione(idx + 1);
        draw();                 // da qui in poi deve esserci
        return {dopoDisegni: {disegni: dopoDisegni.disegni, senza: dopoDisegni.senzaFormazione},
                finale: {disegni: spia.disegni, senza: spia.senzaFormazione},
                avanzata: idx > primaIdx};
      } finally { spia.basta(); }
    }, {PREPARA_SRC: PREPARA.toString(), SPIA_SRC: SPIA.toString()});
    assert.ok(r.dopoDisegni.disegni >= 3, 'i ridisegni devono essere stati contati davvero');
    assert.equal(r.dopoDisegni.senza, 0,
      'nessun ridisegno deve concludersi senza la candela in formazione');
    assert.ok(r.avanzata, 'forward() deve aver completato la candela');
    assert.equal(r.finale.senza, 0,
      'neanche dopo che una candela si completa: ' + JSON.stringify(r.finale));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un giro del replay ridisegna UNA volta sola, anche se completa più candele', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(({PREPARA_SRC, SPIA_SRC}) => {
      eval('(' + PREPARA_SRC + ')()');
      const spia = (eval('(' + SPIA_SRC + ')'))();
      try{
        timer = setInterval(() => {}, 100000);   // il battito si crede acceso
        replayForm = null; replayMsAccum = 0;
        // Un giro arrivato DOPO due secondi di orologio: a 30x sono 60 secondi di mercato, cioè
        // una candela intera da un minuto più l'inizio della successiva.
        const primaIdx = idx, primaDisegni = spia.disegni;
        replayUltimoBattitoMs = performance.now() - 2000;
        replayAnimTick();
        const unGiro = {disegni: spia.disegni - primaDisegni, candele: idx - primaIdx,
                        senza: spia.senzaFormazione};
        clearInterval(timer); timer = null;
        return unGiro;
      } finally { spia.basta(); }
    }, {PREPARA_SRC: PREPARA.toString(), SPIA_SRC: SPIA.toString()});
    assert.ok(r.candele >= 1,
      'due secondi a 30x devono svelare almeno una candela da un minuto: ' + r.candele);
    assert.equal(r.disegni, 1,
      'un giro del battito deve ridisegnare una volta sola, non una per candela: ' + r.disegni);
    assert.equal(r.senza, 0, 'e il ridisegno deve contenere la candela in formazione');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il ritmo segue l orologio vero, non la cadenza nominale del battito', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PREPARA_SRC => {
      eval('(' + PREPARA_SRC + ')()');
      // Un battito arrivato in ritardo (scheda nascosta: i browser li rallentano a uno al secondo)
      // deve portarsi dietro tutto il tempo che ha accumulato.
      const mille = replayAdvanceSteps(0, 1000, 10).steps;      // 1 s di orologio a 10x
      const cinquanta = replayAdvanceSteps(0, 50, 10).steps;    // 50 ms a 10x
      // E il tetto: un'assenza lunghissima non prova a recuperare tutto in un colpo.
      replayUltimoBattitoMs = performance.now() - 600000;       // dieci minuti fermi
      const tetto = replayElapsedMs();
      // Due misure di fila ravvicinate: la seconda vede solo il tempo passato dalla prima.
      replayUltimoBattitoMs = performance.now() - 300;
      const trecento = replayElapsedMs();
      return {mille, cinquanta, tetto, trecento};
    }, PREPARA.toString());
    assert.equal(r.cinquanta, 0, '50 ms a 10x non fanno ancora un secondo di mercato pieno');
    assert.equal(r.mille, 10, 'un secondo di orologio a 10x deve valere dieci secondi di mercato');
    assert.ok(r.tetto <= 5000 && r.tetto >= 4000,
      'un assenza lunghissima si ferma al tetto invece di bloccare la pagina: ' + r.tetto);
    assert.ok(Math.abs(r.trecento - 300) < 60, 'il tempo misurato è quello vero: ' + r.trecento);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il disegno della formazione vive dentro draw(), non nel battito', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const chiamate = src.match(/replayDisegnaFormazione\(replayForm\)/g) || [];
  assert.equal(chiamate.length, 1,
    'una sola chiamata: quella dentro draw(). Rimetterla nel battito fa tornare il lampeggio');
  assert.match(src, /try\{ if\(replayForm&&replayForm\.idx===idx\+1\)replayDisegnaFormazione\(replayForm\); \}catch\(e\)\{\}\r?\n \/\/ --- Fine zona di protezione/,
    'deve stare in fondo all area protetta di draw()');
  assert.match(src, /forward\(true\);/,
    'il battito deve completare le candele in silenzio, senza un ridisegno per ognuna');
});
