// La strategia di esecuzione: pesi per TP, spostamento dello stop, chiusura parziale.
//
// RICHIESTO dal proprietario (7 ottobre 2026): poter impostare la strategia PRIMA di calcolare il
// rendimento di una sala — «così almeno facciamo diversi test per trovare la vera strategia» — con
// percentuali diverse per ogni TP, e potendo scegliere fra una posizione per TP e una posizione
// sola chiusa a pezzi. Lo stesso modello vale per le aperture automatiche.
//
// È un conto in cui un errore non si vede: il numero esce comunque. I casi qui sotto sono scelti
// perché il risultato giusto si può verificare a mente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Entrata 100, stop 90 → il rischio è 10 punti. TP a 110 (1R), 120 (2R), 130 (3R).
const SEG = {dir:'BUY', entry:100, sl:90, tps:[110,120,130], tFill:0};
// Candele: ogni passo arriva a un livello. l/h sono minimo e massimo.
const C = (t,l,h) => ({t, l, h, o:(l+h)/2, c:(l+h)/2});

test('senza strategia e a pesi uguali: media dei multipli', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(([seg,c]) => {
      const C = eval('(' + c + ')');
      // Sale fino a 130: si prendono tutti e tre i TP.
      return fblSimulaStrategia(seg, [C(1,99,111), C(2,109,121), C(3,119,131)],
                                {modo:'posizioni', quote:[], regole:['','','']});
    }, [SEG, C.toString()]);
    // Un terzo a 1R, un terzo a 2R, un terzo a 3R = 2R.
    assert.equal(r.R, 2);
    assert.equal(r.presi, 3);
    assert.equal(r.esito, 'tutti i TP');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('pesi diversi per ogni TP cambiano il risultato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(([seg,c]) => {
      const C = eval('(' + c + ')');
      const ser = [C(1,99,111), C(2,109,121), C(3,119,131)];
      return {
        // Tutto sul primo TP: si incassa 1R e basta.
        primo: fblSimulaStrategia(seg, ser, {quote:[100,0,0], regole:['','','']}).R,
        // Tutto sull'ultimo: 3R.
        ultimo: fblSimulaStrategia(seg, ser, {quote:[0,0,100], regole:['','','']}).R,
        // 50/30/20 → 0,5·1 + 0,3·2 + 0,2·3 = 1,7R
        misto: fblSimulaStrategia(seg, ser, {quote:[50,30,20], regole:['','','']}).R,
        // I rapporti contano, non la somma: 5/3/2 dà lo stesso di 50/30/20.
        rapporti: fblSimulaStrategia(seg, ser, {quote:[5,3,2], regole:['','','']}).R
      };
    }, [SEG, C.toString()]);
    assert.equal(r.primo, 1);
    assert.equal(r.ultimo, 3);
    assert.equal(r.misto, 1.7);
    assert.equal(r.rapporti, 1.7);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('stop al pareggio dopo il primo TP: il resto esce a zero, non in perdita', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(([seg,c]) => {
      const C = eval('(' + c + ')');
      // Tocca il TP1, poi torna giù fino a 85 (sotto lo stop originale).
      const ser = [C(1,99,111), C(2,85,109)];
      return {
        // Senza regola: il resto esce allo stop originale, in perdita.
        senza: fblSimulaStrategia(seg, ser, {quote:[], regole:['','','']}),
        // Con lo stop portato al pareggio: il resto esce a zero.
        conBE: fblSimulaStrategia(seg, ser, {quote:[], regole:['entrata','','']})
      };
    }, [SEG, C.toString()]);
    // Senza: 1/3 a 1R (+0,333) e 2/3 persi (−0,667) = −0,333R.
    assert.equal(Math.round(r.senza.R * 1000) / 1000, -0.333);
    // Con il pareggio: resta solo il guadagno del TP1.
    assert.equal(Math.round(r.conBE.R * 1000) / 1000, 0.333);
    assert.equal(r.conBE.stopFinale, 100, 'lo stop è stato spostato all\'entrata');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('stop portato al TP1 dopo il TP2: si esce in guadagno anche se il prezzo torna indietro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(([seg,c]) => {
      const C = eval('(' + c + ')');
      // TP1 e TP2 presi, poi il prezzo crolla.
      const ser = [C(1,99,111), C(2,109,121), C(3,80,118)];
      return fblSimulaStrategia(seg, ser, {quote:[], regole:['','1','']});
    }, [SEG, C.toString()]);
    // 1/3 a 1R + 1/3 a 2R = 1R, e l'ultimo terzo esce a 110, che è +1R: totale 1,333R.
    assert.equal(Math.round(r.R * 1000) / 1000, 1.333);
    assert.equal(r.stopFinale, 110, 'lo stop è al TP1');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('lo stop non torna mai indietro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(([seg,c]) => {
      const C = eval('(' + c + ')');
      const ser = [C(1,99,111), C(2,109,121), C(3,119,131)];
      // Dopo il TP2 lo stop va al TP1 (110). Dopo il TP3 una regola lo rimanderebbe all'entrata
      // (100), cioè più indietro: aumenterebbe il rischio dopo aver già incassato. Non si fa.
      return fblSimulaStrategia(seg, ser, {quote:[], regole:['','1','entrata']}).stopFinale;
    }, [SEG, C.toString()]);
    assert.equal(r, 110, 'resta al TP1, non torna all\'entrata');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una regola impossibile si ignora invece di fingere che valga', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // "Preso il TP1, sposta lo stop al TP3": il TP3 non è ancora stato raggiunto.
      const s = fblStrategiaNormalizza({regole:['3','','']}, 3);
      return s.regole;
    });
    assert.deepEqual(r, ['', '', ''], 'si può spostare solo a un TP già preso');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('stop e TP nella stessa candela: si conta lo stop, e si dice che è ambiguo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(([seg,c]) => {
      const C = eval('(' + c + ')');
      // Una candela che tocca sia 111 (TP1) sia 89 (sotto lo stop): non si sa cosa sia venuto prima.
      return fblSimulaStrategia(seg, [C(1,89,111)], {quote:[], regole:['','','']});
    }, [SEG, C.toString()]);
    assert.equal(r.R, -1, 'si conta lo stop: è la lettura prudente');
    assert.equal(r.ambiguo, true, 'e lo si dichiara, invece di far finta di saperlo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una vendita funziona al contrario, con gli stessi numeri', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(([c]) => {
      const C = eval('(' + c + ')');
      // Venduto a 100, stop a 110, TP a 90/80/70.
      const seg = {dir:'SELL', entry:100, sl:110, tps:[90,80,70], tFill:0};
      const ser = [C(1,89,101), C(2,79,91), C(3,69,81)];
      return fblSimulaStrategia(seg, ser, {quote:[], regole:['','','']}).R;
    }, [C.toString()]);
    assert.equal(r, 2);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('posizione mai chiusa: resta aperta e non si conta come vinta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(([seg,c]) => {
      const C = eval('(' + c + ')');
      // Solo il TP1, poi la serie finisce.
      return fblSimulaStrategia(seg, [C(1,99,111), C(2,105,112)], {quote:[], regole:['','','']});
    }, [SEG, C.toString()]);
    assert.equal(r.aperta, true);
    assert.equal(r.presi, 1);
    assert.equal(r.esito, 'in corso (TP1)');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i due modi danno lo stesso guadagno: cambia come si esegue, non quanto rende', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(([seg,c]) => {
      const C = eval('(' + c + ')');
      const ser = [C(1,99,111), C(2,109,121), C(3,85,118)];
      const reg = {quote:[50,30,20], regole:['','entrata','']};
      return {
        posizioni: fblSimulaStrategia(seg, ser, {...reg, modo:'posizioni'}).R,
        parziali:  fblSimulaStrategia(seg, ser, {...reg, modo:'parziali'}).R
      };
    }, [SEG, C.toString()]);
    assert.equal(r.posizioni, r.parziali,
      'in multipli del rischio sono identici: cambiano commissioni, margine e numero di ordini');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
