// STOP E TARGET SI SCRIVONO (E SI CANCELLANO) NELLA BARRA DENTRO AL GRAFICO.
//
// RICHIESTO dal proprietario: «trasportiamo il sistema sulla barra degli ordini, e a fianco a stop
// loss e TP aggiungiamoci il campo di inserimento del valore: così l'utente può anche cancellare
// il valore direttamente dalla casellina, e il pannello sulla pagina madre non serve più».
//
// COME, e perché così: #sl / #tp (e #slPending / #tpPending quando si compone un ordine pendente)
// restano l'UNICA FONTE DI VERITÀ — li leggono più di trenta punti del programma, dal calcolo del
// lottaggio all'apertura vera. I campi nella barra si RISPECCHIANO sopra a quelli, esattamente
// come già fanno il lottaggio e il rischio. Così la barra diventa il posto da cui si lavora senza
// riscrivere l'architettura, e senza il rischio di avere due numeri diversi per la stessa cosa.
//
// E l'interruttore dello Style: acceso si vedono gli ordini pendenti a grafico, spento nessuno.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('scrivendo nella barra si scrive nel campo vero, e svuotandola si toglie il livello', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      quickPendingConfirmActive = false;
      const q = document.getElementById('quickSlVal');
      const vero = document.getElementById('sl');
      q.value = '1.0950';
      q.dispatchEvent(new Event('input', {bubbles: true}));
      const dopoScritto = vero.value;
      // SVUOTARE la casella deve togliere il livello: e' il motivo per cui e' stata chiesta.
      q.value = '';
      q.dispatchEvent(new Event('input', {bubbles: true}));
      const dopoSvuotato = vero.value;
      // E lo stesso per il target.
      const qt = document.getElementById('quickTpVal'), veroTp = document.getElementById('tp');
      qt.value = '1.1200';
      qt.dispatchEvent(new Event('input', {bubbles: true}));
      return {dopoScritto, dopoSvuotato, tp: veroTp.value};
    });
    assert.equal(Number(r.dopoScritto), 1.095, 'il campo vero deve ricevere il valore');
    assert.equal(r.dopoSvuotato, '', 'svuotando la casella il livello si toglie');
    assert.equal(Number(r.tp), 1.12);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('cambiando il livello sul grafico la barra si aggiorna da sola', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      quickPendingConfirmActive = false;
      // Il trascinamento sul grafico scrive nel campo vero SENZA far scattare nessun evento:
      // e' il caso che un semplice listener non coprirebbe.
      document.getElementById('sl').value = '1.0800';
      document.getElementById('tp').value = '1.1500';
      refreshSlTpEuroPreview();
      return {sl: document.getElementById('quickSlVal').value,
              tp: document.getElementById('quickTpVal').value};
    });
    assert.equal(r.sl, '1.0800', 'la barra deve rispecchiare il campo vero, cosi com e scritto');
    assert.equal(r.tp, '1.1500');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('componendo un ordine pendente la barra lavora sui SUOI campi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      quickPendingConfirmActive = true;
      const q = document.getElementById('quickSlVal');
      q.value = '1.0700';
      q.dispatchEvent(new Event('input', {bubbles: true}));
      const out = {pendente: document.getElementById('slPending').value,
                   mercato: document.getElementById('sl').value};
      quickPendingConfirmActive = false;
      return out;
    });
    // Si confronta il NUMERO, non la stringa: il campo normalizza ai decimali dello strumento
    // (1.07000), e un test legato alla formattazione si romperebbe al primo asset con decimali
    // diversi, misurando l incolonnamento invece del comportamento.
    assert.equal(Number(r.pendente), 1.07, 'deve finire nello stop dell ordine pendente');
    assert.equal(r.mercato, '', 'e NON in quello dell ordine a mercato');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l interruttore degli ordini pendenti a grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const out = {};
      try { localStorage.removeItem('fbl_ordini_pendenti'); } catch(e) {}
      out.diBase = fblOrdiniPendentiVisibili();
      localStorage.setItem('fbl_ordini_pendenti', '0');
      out.spento = fblOrdiniPendentiVisibili();
      try { localStorage.removeItem('fbl_ordini_pendenti'); } catch(e) {}
      out.pulsante = !!document.getElementById('toggleOrdiniPendentiBtn');
      return out;
    });
    assert.equal(r.diBase, true, 'acceso di base: e come si comportava prima');
    assert.equal(r.spento, false);
    assert.equal(r.pulsante, true, 'il pulsante deve esistere nelle impostazioni Style');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('spento, a grafico non si disegna nessun ordine pendente', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const c = (re, cosa) => assert.ok(re.test(src), 'manca: ' + cosa);
  c(/\(fblOrdiniPendentiVisibili\(\)\?pendingForChart:\[\]\)/, 'il blocco degli ordini pendenti');
  c(/if\(highlightedPendingOrderId!=null&&fblOrdiniPendentiVisibili\(\)\)/,
    'anche la casella in evidenza deve sparire');
  // Lo specchio si aggiorna dal punto che tutte le strade attraversano, non da un solo evento.
  c(/try\{ quickLivelliSpecchia\(\); \}catch\(e\)\{\}\r?\n const el=\$\('slTpEuroPreview'\)/,
    'lo specchio dentro refreshSlTpEuroPreview');
});
