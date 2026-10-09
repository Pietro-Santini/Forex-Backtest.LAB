// PASSO 20 — stop loss mobile portato a grafico dalla cronologia.
//
// RICHIESTO dal proprietario (9 ottobre 2026): la strategia puo' prevedere che lo stop si sposti a un
// target preso (TP2 -> pareggio, TP3 -> TP1, ...). Il grafico deve mostrare gli spostamenti:
//  - stop colpito subito (prima di ogni TP): la linea resta al livello originale;
//  - TP preso: la linea dello stop sale al livello previsto;
//  - dove lo stop e' colpito: una X;
//  - quando lo stop si e' spostato, l'etichetta dice «Stop P» invece di «SL».
//
// La parte delicata e' il PERCORSO dello stop (tempi + livelli). Qui si prova `fblCronoStopPath`, che
// lo ricava rigiocando il segnale con la strategia vera. Se torna `null`, il disegno usa la linea
// piatta di sempre: e' proprio il caso «stop non spostato».
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('stop che sale a pareggio dopo il TP1 e poi viene colpito', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const sp = await pagina.evaluate(() => {
      const serie = [[
        {t:1000,   o:100,h:101,l:99, c:100},
        {t:61000,  o:100,h:111,l:100,c:110},   // TP1 preso
        {t:121000, o:110,h:120,l:105,c:118},
        {t:181000, o:118,h:120,l:99, c:100}    // torna giu' e tocca lo stop (pareggio)
      ]];
      const r = {dir:'BUY', entry:100, sl:90, tps:[110,130], tFill:1000, ts:1000};
      const cfg = {modo:'posizioni', quote:[50,50], regole:['entrata','']};
      return fblCronoStopPath(r, cfg, serie);
    });
    assert.ok(sp, 'con lo stop spostato il percorso deve esserci');
    assert.equal(sp.muovato, true, 'lo stop si e spostato');
    assert.equal(sp.stopColpito, true, 'lo stop e stato colpito dopo lo spostamento');
    assert.equal(sp.punti.length, 3, 'partenza, spostamento, fine');
    assert.deepEqual(sp.punti[0], {t:1000, p:90}, 'parte al livello originale');
    assert.deepEqual(sp.punti[1], {t:61000, p:100}, 'dopo il TP1 sale al pareggio');
    assert.equal(sp.punti[2].p, 100, 'resta al pareggio fino alla fine');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('stop non spostato (colpito subito): nessun percorso, linea di sempre', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const sp = await pagina.evaluate(() => {
      const serie = [[
        {t:1000,  o:100,h:101,l:99, c:100},
        {t:61000, o:99, h:100,l:85, c:86}    // crolla sotto lo stop prima di ogni TP
      ]];
      const r = {dir:'BUY', entry:100, sl:90, tps:[110,130], tFill:1000, ts:1000};
      const cfg = {modo:'posizioni', quote:[50,50], regole:['entrata','']};
      return fblCronoStopPath(r, cfg, serie);
    });
    assert.equal(sp, null, 'senza spostamento si torna alla linea piatta di sempre');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('stop sale a TP1 dopo il TP2 (regola «al TP1»)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const sp = await pagina.evaluate(() => {
      const serie = [[
        {t:1000,   o:100,h:101,l:99, c:100},
        {t:61000,  o:100,h:111,l:100,c:110},   // TP1
        {t:121000, o:110,h:131,l:105,c:130},   // TP2 -> lo stop sale al TP1 (110)
        {t:181000, o:130,h:130,l:108,c:109}    // torna e tocca lo stop (ora a TP1 = 110)
      ]];
      // Tre target: con due soli target il TP2 chiuderebbe l'operazione e la regola «al TP1» non
      // farebbe in tempo a entrare in gioco.
      const r = {dir:'BUY', entry:100, sl:90, tps:[110,130,150], tFill:1000, ts:1000};
      const cfg = {modo:'posizioni', quote:[34,33,33], regole:['','1','']};
      return fblCronoStopPath(r, cfg, serie);
    });
    assert.ok(sp, 'percorso presente');
    assert.equal(sp.punti[sp.punti.length-1].p, 110, 'dopo il TP2 lo stop e al TP1');
    assert.equal(sp.stopColpito, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
