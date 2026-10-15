// IL PANNELLO DEGLI ORDINI SPARISCE DALLA VISTA, MA I SUOI CAMPI RESTANO.
//
// RICHIESTO dal proprietario: «visto che ora si aprono gli ordini direttamente dalla barra dentro
// al grafico, il pannello degli ordini sulla pagina madre non serve più: nascondilo».
//
// PERCHÉ NASCOSTO E NON CANCELLATO: quei campi non sono un duplicato di quelli della barra, sono
// LA MEMORIA dell'applicazione. Li legge più di mezzo programma — $('sl') 17 volte,
// $('pendingEntry') 23, $('slPending') 22 — dal lottaggio consigliato fino all'apertura vera.
// La barra dentro al grafico ci scrive sopra: cancellarli romperebbe proprio la barra che li ha
// sostituiti. Questo test tiene fermo l'invariante: invisibili, ma presenti e funzionanti.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('il pannello non si vede piu', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const p = document.getElementById('pannelloOrdini');
      return {esiste: !!p, visibile: p ? p.offsetParent !== null : null};
    });
    assert.equal(r.esiste, true);
    assert.equal(r.visibile, false, 'il pannello deve essere nascosto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ma tutti i suoi campi esistono ancora, e si leggono', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const ids = ['lots', 'risk', 'sl', 'tp', 'lotsPending', 'riskPending',
                   'slPending', 'tpPending', 'pendingEntry'];
      const mancanti = ids.filter(i => !document.getElementById(i));
      // E si possono ancora scrivere e rileggere: e' quello che fa la barra del grafico.
      document.getElementById('sl').value = '1.2345';
      const riletto = document.getElementById('sl').value;
      return {mancanti, riletto};
    });
    assert.deepEqual(r.mancanti, [],
      'nessun campo deve sparire: li legge mezzo programma');
    assert.equal(r.riletto, '1.2345', 'devono restare leggibili e scrivibili');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('e la barra del grafico continua a lavorarci sopra', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      quickPendingConfirmActive = false;
      const q = document.getElementById('quickSlVal');
      q.value = '1.0900';
      q.dispatchEvent(new Event('input', {bubbles: true}));
      return Number(document.getElementById('sl').value);
    });
    assert.equal(r, 1.09, 'scrivendo nella barra si scrive nel campo nascosto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('chiudere le posizioni resta raggiungibile senza quel pannello', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      // Il menu "Operazioni a blocco" vive nella tabella delle posizioni aperte, che resta:
      // offre piu' di quanto facesse il pulsante "CHIUDI TUTTE" del pannello nascosto.
      menuBlocco: !!document.getElementById('fblBloccoMenu'),
      // E il menu si costruisce davvero.
      voci: (() => { try { fblBloccoCostruisci();
        return document.getElementById('fblBloccoVoci').textContent.length > 0; }
        catch(e){ return false; } })()
    }));
    assert.equal(r.menuBlocco, true, 'il menu delle chiusure a blocco deve restare');
    assert.equal(r.voci, true, 'e deve funzionare');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
