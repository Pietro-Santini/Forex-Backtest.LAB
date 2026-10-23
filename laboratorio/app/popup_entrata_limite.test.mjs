// IL PREZZO DI APERTURA DIVENTA ORDINE LIMITE SOLO A RICHIESTA — E SE E' CONTRARIO AI TP, NON SI APRE.
//
// Richiesta del proprietario, parola per parola: «nei livelli comuni a tutte le posizioni il
// prezzo di apertura all'inizio non si vede: selezioniamo il checkbox (cambia prezzo di entrata
// "ordine limite") e appare il campo per l'inserimento del prezzo di apertura. E stabiliamo una
// regola per l'ordine limite: se il prezzo di entrata è sotto al prezzo del momento di mercato e
// ci sono i take profit sotto al prezzo di entrata — oppure l'incontrario — manda un messaggio di
// errore, perché l'utente sta inserendo un ordine contrario alla direzione dei TP/SL; in quel caso
// il tasto "Apri le posizioni" non sarà selezionabile finché non corregge la configurazione».
//
// LA CURA: la checkbox #tgCfgEntryOn governa il campo #tgCfgEntry (nascosto di default); la
// validazione (tgValidaEntrataVsTp) gira dentro tgCfgPiano(), quindi tocca in UN punto solo
// riepilogo e tasto: se trova un TP attivo dalla parte sbagliata (o un SL dal lato opposto
// all'entrata) mette il problema nel piano, e il riepilogo disabilita il tasto "Apri".
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('tgValidaEntrataVsTp: coerente passa, contrario viene bloccato (BUY e SELL)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // firma: tgValidaEntrataVsTp(prezzoDiApertura, stopLoss, direzione, tpAttivi)
      return {
        buyPass:  tgValidaEntrataVsTp(100, 96, 'BUY', [101.5, 104]),
        buyFermo: tgValidaEntrataVsTp(100, 96, 'BUY', [99.5, 101.5]),
        buyBordo: tgValidaEntrataVsTp(100, 96, 'BUY', [100]),
        sellPass:  tgValidaEntrataVsTp(100, 103, 'SELL', [98, 95]),
        sellFermo: tgValidaEntrataVsTp(100, 103, 'SELL', [101.5]),
        senzaEntry: tgValidaEntrataVsTp(NaN, 96, 'BUY', [99.5]),
        slContrario: tgValidaEntrataVsTp(100, 101, 'BUY', [102])
      };
    });
    assert.equal(r.buyPass, '', 'BUY con i target sopra all\'entrata: coerente, nessun problema: ' + JSON.stringify(r));
    assert.ok(r.buyFermo.includes('incoerente'), 'BUY con un target sotto all\'entrata → errore richiesto: ' + JSON.stringify(r));
    assert.ok(r.buyBordo.includes('incoerente'), 'target ESATTAMENTE all\'entrata = fermo (un pari non può essere TP): ' + JSON.stringify(r));
    assert.equal(r.sellPass, '', 'SELL con i target sotto all\'entrata: coerente: ' + JSON.stringify(r));
    assert.ok(r.sellFermo.includes('incoerente'), 'SELL con un target sopra all\'entrata → errore richiesto: ' + JSON.stringify(r));
    assert.equal(r.senzaEntry, '', 'senza prezzo inserito non si valida nulla (apertura a mercato): ' + JSON.stringify(r));
    assert.ok(r.slContrario.includes('stop loss'), 'SL sopra all\'entrata per BUY → errore richiesto: ' + JSON.stringify(r));
    assert.equal(errori.length, 0, 'errori console: ' + errori.join(' | '));
  } finally { await browser.close(); }
});

test('il tasto "Apri le posizioni" si disabilita con il prezzo contrario e torna abilitato se correggi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(() => {
      // Config minima, come la prepara tgApriConfigurazione; il grafico in collaudo non ha
      // candele, quindi gli diamo un prezzo "attuale" noto (100) via rows[idx].
      rows[idx] = {close: 100};
      tgCfg = {
        voce: {segnale: {direzione: 'BUY', strumento: 'GOLD', stop_loss: 96, take_profit: [104]}},
        sym: 'XAUUSD', side: 'BUY', sl: 96, pct: 1,
        righe: [{tp: 104, attivo: true}], regole: [''],
        avvicinamento: {attivo: false, pct: 70}
      };
    });
    // 1) Contrario: entrata 110 con TP 104 (sotto, per un BUY) → il tasto si ferma.
    let r = await pagina.evaluate(() => {
      $('tgCfgEntry').value = '110';
      $('tgCfgSl').value = '96';
      tgCfgDisegna();
      return {
        problemi: (tgCfgPiano().problemi || []).join('; '),
        tasto: $('tgConfigApri').disabled,
        riepilogo: $('tgConfigRiepilogo').textContent
      };
    });
    assert.ok(r.problemi.includes('incoerente'), 'il piano deve portare il problema: ' + JSON.stringify(r));
    assert.equal(r.tasto, true, '"Apri le posizioni" NON deve essere premibile con l\'ordine contrario: ' + JSON.stringify(r));
    assert.ok(r.riepilogo.includes('Non si può aprire'), 'il riepilogo mostra l\'errore: ' + JSON.stringify(r));
    // 2) Corregge: entrata 99.5 con TP 104 (sopra) → coerente → tasto abilitato.
    r = await pagina.evaluate(() => {
      $('tgCfgEntry').value = '99.5';
      tgCfgDisegna();
      return {tasto: $('tgConfigApri').disabled, problemi: tgCfgPiano().problemi};
    });
    assert.equal(r.tasto, false, 'correggendo la configurazione il tasto torna premibile: ' + JSON.stringify(r));
    // 3) Checkbox: senza spunta il campo non c'è (e non si valida nulla).
    r = await pagina.evaluate(() => {
      $('tgCfgEntryOn').checked = false;
      $('tgCfgEntryOn').dispatchEvent(new Event('change'));
      return {
        campoVisibile: $('tgCfgEntryBox').style.display !== 'none',
        valore: $('tgCfgEntry').value,
        tasto: $('tgConfigApri').disabled
      };
    });
    assert.equal(r.campoVisibile, false, 'senza la spunta il campo prezzo si nasconde: ' + JSON.stringify(r));
    assert.equal(r.valore, '', 'senza la spunta il prezzo si svuota (apertura a mercato): ' + JSON.stringify(r));
    assert.equal(r.tasto, false, 'a mercato nessun problema di coerenza: ' + JSON.stringify(r));
    // 4) Con la spunta il campo torna visibile.
    r = await pagina.evaluate(() => {
      $('tgCfgEntryOn').checked = true;
      $('tgCfgEntryOn').dispatchEvent(new Event('change'));
      return {campoVisibile: $('tgCfgEntryBox').style.display !== 'none'};
    });
    assert.equal(r.campoVisibile, true, 'con la spunta il campo prezzo si mostra: ' + JSON.stringify(r));
    assert.equal(errori.length, 0, 'errori console: ' + errori.join(' | '));
  } finally { await browser.close(); }
});
