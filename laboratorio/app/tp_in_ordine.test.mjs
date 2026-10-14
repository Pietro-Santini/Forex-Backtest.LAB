// IL TP1 È SEMPRE QUELLO PIÙ VICINO ALL'ENTRATA, COMUNQUE LA SALA LI SCRIVA.
//
// SEGNALATO dal proprietario: «se una sala inserisce i TP in ordine crescente li segnala bene, ma
// li deve segnalare bene anche in ordine decrescente, al contrario. Non mi può selezionare come
// TP1 quello più lontano: il TP1 è sempre quello più vicino al momento dell'entrata,
// indipendentemente da come scrive la sala».
//
// IL CASO VERO che l'ha fatto vedere (sala di prova, oro):
//     XAUUSD BUY LIMIT 4085 · SL 4175 · TP 4130 · TP 4115 · TP 4096 · TP 4092 · TP 4088
// scritti dal più lontano al più vicino. L'app teneva l'ordine di scrittura — non ordinava da
// nessuna parte — quindi il TP1 diventava 4130, l'ultimo obiettivo.
//
// E NON È SOLO UN'ETICHETTA: la strategia dice «quando il prezzo raggiunge il take profit n.1,
// sposta lo stop delle altre posizioni a...». Col numero sbagliato, gli stop si spostano nel
// momento sbagliato.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('il primo take profit è quello che il prezzo tocca per primo, in tutte e due le direzioni', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      // Il caso vero: BUY con i target scritti dal più lontano al più vicino.
      buyAlContrario: tgTpInOrdine([4130, 4115, 4096, 4092, 4088], 'BUY'),
      // La stessa sala che li scrive nel verso giusto: non deve cambiare niente.
      buyGiaInOrdine: tgTpInOrdine([4088, 4092, 4096, 4115, 4130], 'BUY'),
      // Sparsi a caso.
      buySparsi: tgTpInOrdine([4096, 4130, 4088, 4115, 4092], 'BUY'),
      // SELL: i target stanno sotto l'entrata, quindi il primo toccato è il più ALTO.
      sellAlContrario: tgTpInOrdine([1.0800, 1.0850, 1.0900], 'SELL'),
      sellGiaInOrdine: tgTpInOrdine([1.0900, 1.0850, 1.0800], 'SELL'),
      // Robustezza: roba non numerica, un valore solo, niente.
      sporchi: tgTpInOrdine([4096, null, 'x', 4088, undefined], 'BUY'),
      unoSolo: tgTpInOrdine(4100, 'BUY'),
      vuoto: tgTpInOrdine(null, 'BUY'),
      // Senza direzione si tratta come un acquisto (il caso di gran lunga più comune).
      senzaDirezione: tgTpInOrdine([3, 1, 2], '')
    }));
    assert.deepEqual(r.buyAlContrario, [4088, 4092, 4096, 4115, 4130],
      'BUY: il TP1 è il più basso, cioè il più vicino sopra l entrata');
    assert.deepEqual(r.buyGiaInOrdine, [4088, 4092, 4096, 4115, 4130]);
    assert.deepEqual(r.buySparsi, [4088, 4092, 4096, 4115, 4130]);
    assert.deepEqual(r.sellAlContrario, [1.09, 1.085, 1.08],
      'SELL: il TP1 è il più alto, cioè il più vicino sotto l entrata');
    assert.deepEqual(r.sellGiaInOrdine, [1.09, 1.085, 1.08]);
    assert.deepEqual(r.sporchi, [4088, 4096], 'quello che non è un numero si butta');
    assert.deepEqual(r.unoSolo, [4100], 'un valore solo, non un array, vale lo stesso');
    assert.deepEqual(r.vuoto, []);
    assert.deepEqual(r.senzaDirezione, [1, 2, 3]);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la finestra di configurazione numera le posizioni nell ordine di arrivo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // Si entra dal punto vero: la voce del segnale, com'è fatta quando arriva dalla sala.
      const seg = {strumento: 'XAUUSD', direzione: 'BUY', entrata: 4085, tipo_ordine: 'limit',
                   stop_loss: 4075, take_profit: [4130, 4115, 4096, 4092, 4088]};
      return {
        righe: tgTpInOrdine(seg.take_profit, seg.direzione),
        // La riga del pannello deve mostrarli nello stesso ordine della finestra: due ordini
        // diversi per lo stesso segnale sono già di per sé un errore da leggere.
        primo: tgTpInOrdine(seg.take_profit, seg.direzione)[0]
      };
    });
    assert.equal(r.primo, 4088, 'il TP n.1 è 4088, non 4130');
    assert.deepEqual(r.righe, [4088, 4092, 4096, 4115, 4130]);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('tutti i punti che leggono i take profit passano dallo stesso ordinamento', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  // Nessuno deve più costruire la lista da solo: era proprio il tenere l'ordine di scrittura.
  const grezzi = src.match(/\(seg\.take_profit\|\|\[\]\)\.map\(Number\)\.filter\(Number\.isFinite\)/g) || [];
  assert.equal(grezzi.length, 0,
    'la lista dei take profit si costruisce solo con tgTpInOrdine: ' + grezzi.length + ' punti grezzi');
  // I tre che contano: pannello, finestra di configurazione, apertura vera.
  assert.match(src, /const tps=tgTpInOrdine\(seg\.take_profit,seg\.direzione\);\r?\n  card\.appendChild/,
    'il pannello');
  assert.match(src, /const tps=tgTpInOrdine\(seg\.take_profit,seg\.direzione\);\r?\n tgCfg=\{/,
    'la finestra di configurazione');
  assert.match(src, /const tutti=tgTpInOrdine\(seg\.take_profit,side\)/,
    'l apertura vera delle posizioni');
});

test('il rifiuto dello stop dice QUALE numero sta guardando', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  // SEGNALATO: «IMPOSSIBILE, il prezzo è a 4090» — il messaggio chiamava "prezzo di adesso" il
  // prezzo di ENTRATA della sala (un ordine pendente), e faceva cercare un errore inesistente.
  assert.doesNotMatch(src, /dalla parte sbagliata rispetto al prezzo di adesso/,
    'la vecchia frase, che chiamava "prezzo di adesso" l entrata della sala, non deve esistere più');
  assert.match(src, /const rifEntrata=pendente\?\('entrata '\+kind\+' della sala '/,
    'per un ordine pendente si deve dire che quel numero è l entrata della sala, non il mercato');
  assert.match(src, /const rifMercato=\(Number\.isFinite\(mercato\)&&mercato!==entry\)/,
    'e si deve mostrare anche il prezzo di mercato vero, quando è diverso');
});
