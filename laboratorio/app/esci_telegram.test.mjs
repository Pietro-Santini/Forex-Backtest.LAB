// "Esci da Telegram": conferma, il ponte esce e cancella la sessione, l'app dimentica il numero e
// spegne il collegamento; riaccendendo, il ponte chiedera' numero e codice.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('esci da Telegram: conferma, uscita sul ponte, numero dimenticato, collegamento spento', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      localStorage.setItem(TG_TEL_KEY, '+393331234567');
      window.appConfirm = async () => true; appConfirm = window.appConfirm;
      const inviati = []; let spento = null;
      tgWs = {readyState: 1, close(){}};
      tgInvia = (m) => { inviati.push(m.azione); setTimeout(() => tgUscitaAttesa && tgUscitaAttesa({tipo:'uscito', ok:true, logout:true}), 50); return true; };
      tgImpostaAttivo = async (acceso) => { spento = !acceso; };
      $('tgTelefonoForgetBtn').click();
      await new Promise(r => setTimeout(r, 400));
      return {inviati, spento, numero: localStorage.getItem(TG_TEL_KEY), testo: $('tgDimenticaTelBtn').textContent};
    });
    assert.deepEqual(r.inviati, ['esci_telegram']);
    assert.equal(r.spento, true);
    assert.equal(r.numero, null);
    assert.match(r.testo, /Esci da Telegram/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('esci da Telegram: se annulli non succede niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      localStorage.setItem(TG_TEL_KEY, '+393331234567');
      window.appConfirm = async () => false; appConfirm = window.appConfirm;
      const inviati = []; tgInvia = (m) => { inviati.push(m.azione); return true; };
      await tgEsciDaTelegram();
      return {inviati, numero: localStorage.getItem(TG_TEL_KEY)};
    });
    assert.deepEqual(r, {inviati: [], numero: '+393331234567'});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
