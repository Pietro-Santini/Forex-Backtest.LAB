// Consenso informato ai rischi prima di ricevere i segnali e di aprire posizioni dai segnali.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {apriApp, RISULTATI} from './aiuti.mjs';

const PREPARA = () => {
  localStorage.removeItem('fbl_consensi_rischi');
  fetchMt5WithTimeout = async () => ({ok:false, message:'ponte finto spento'});
  window.appConfirm = async () => true; appConfirm = window.appConfirm;
};
const spunta = (pagina, n) => pagina.evaluate(n => { [...document.querySelectorAll('#fblConsensoOverlay [data-consenso]')].slice(0, n).forEach(c => { c.checked = true; c.dispatchEvent(new Event('change')); }); }, n);
const stato = pagina => pagina.evaluate(() => {
  const si = document.querySelector('#fblConsensoOverlay [data-azione="si"]');
  return {aperto: !!document.getElementById('fblConsensoOverlay'), caselle: document.querySelectorAll('#fblConsensoOverlay [data-consenso]').length, accettaAttivo: si ? !si.disabled : null};
});

test('ricezione segnali: senza consenso resta spenta, con tutte le spunte si accende', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA);
    // 1) rifiuto
    pagina.evaluate(() => { window.__p = tgImpostaAttivo(true); });
    await pagina.waitForSelector('#fblConsensoOverlay');
    assert.deepEqual(await stato(pagina), {aperto:true, caselle:4, accettaAttivo:false});
    await pagina.click('#fblConsensoOverlay [data-azione="no"]');
    await pagina.evaluate(() => window.__p);
    assert.equal(await pagina.evaluate(() => tgAttivo()), false);
    // 2) spunte parziali: Accetto resta spento
    pagina.evaluate(() => { window.__p = tgImpostaAttivo(true); });
    await pagina.waitForSelector('#fblConsensoOverlay');
    await spunta(pagina, 3);
    assert.equal((await stato(pagina)).accettaAttivo, false);
    await spunta(pagina, 4);
    assert.equal((await stato(pagina)).accettaAttivo, true);
    await pagina.screenshot({path: path.join(RISULTATI, 'consenso_segnali.png')});
    await pagina.click('#fblConsensoOverlay [data-azione="si"]');
    await pagina.evaluate(() => window.__p);
    const r = await pagina.evaluate(() => ({attivo: tgAttivo(), valido: consensoValido('segnali'), reg: JSON.parse(localStorage.getItem('fbl_consensi_rischi')).segnali}));
    assert.equal(r.attivo, true);
    assert.equal(r.valido, true);
    assert.equal(r.reg.versione, '2026-10-06');
    assert.ok(Date.now() - Date.parse(r.reg.il) < 60000, 'data del consenso registrata');
    // 3) gia' accettato: nessuna nuova richiesta
    await pagina.evaluate(() => tgImpostaAttivo(false));
    await pagina.evaluate(() => tgImpostaAttivo(true));
    assert.equal((await stato(pagina)).aperto, false);
    // 4) testo cambiato (versione diversa): si richiede
    await pagina.evaluate(() => { const c = JSON.parse(localStorage.getItem('fbl_consensi_rischi')); c.segnali.versione = '2000-01-01'; localStorage.setItem('fbl_consensi_rischi', JSON.stringify(c)); });
    assert.equal(await pagina.evaluate(() => consensoValido('segnali')), false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('apertura automatica: chiede segnali + esecuzione; senza consenso non apre nulla', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA);
    // freno: segnale da aprire ma nessun consenso -> non si apre e lo dice
    const freno = await pagina.evaluate(async () => {
      tgAutoDecidi = () => ({apri:true}); let rivendicato = false; tgRivendicaSegnale = async () => { rivendicato = true; return true; };
      const voce = {segnale:{strumento:'BTCUSD'}};
      await tgAutoValuta(voce, 'kraken');
      return {motivo: voce.autoMotivo || '', rivendicato};
    });
    assert.match(freno.motivo, /consenso/);
    assert.equal(freno.rivendicato, false);
    // accensione dal pannello: prima le 4 avvertenze dei segnali, poi le 6 dell'esecuzione
    await pagina.evaluate(() => { const c = $('tgAutoAttivo'); c.checked = true; c.dispatchEvent(new Event('change')); });
    await pagina.waitForSelector('#fblConsensoOverlay');
    assert.equal((await stato(pagina)).caselle, 4);
    await spunta(pagina, 4); await pagina.click('#fblConsensoOverlay [data-azione="si"]');
    await pagina.waitForFunction(() => document.querySelectorAll('#fblConsensoOverlay [data-consenso]').length === 6);
    await pagina.screenshot({path: path.join(RISULTATI, 'consenso_esecuzione.png')});
    await spunta(pagina, 6); await pagina.click('#fblConsensoOverlay [data-azione="si"]');
    await pagina.waitForFunction(() => !document.getElementById('fblConsensoOverlay') && tgAuto.attivo === true);
    assert.equal(await pagina.evaluate(() => consensoValido('esecuzione')), true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
