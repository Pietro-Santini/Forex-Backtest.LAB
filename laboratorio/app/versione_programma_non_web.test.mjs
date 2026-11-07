// IL PULSANTE "AGGIORNA" DEVE PARLARE DEL PROGRAMMA INSTALLATO, NON DELLA COPIA WEB.
//
// SEGNALATO dal proprietario (7 novembre 2026): «ero sulla 2.0.99, entro e non mi mostra il
// pulsante aggiorna; chiudo, riapro, crash ripetuti, e mi ritrovo sulla 2.1.1 SENZA aver
// toccato nulla e senza che mi abbia installato i pacchetti».
//
// MISURATO sul suo PC: il ponte serviva `app_aggiornata\app.html` congelato dalla v2.1.1
// (marcatori trovati nel file), mentre gli .exe erano quelli vecchi. fblVersioneInstallata()
// legge la versione dalla CACHE DEL SERVICE WORKER, cioe' da QUELLA copia web: rispondeva
// 2.1.1, il confronto col tag remoto diceva «pari», il pulsante non compariva MAI. L'app
// sembrava aggiornata senza esserlo.
//
// CURA: la verse che decide l'aggiornamento e' quella dell'ESEGUIBILE
// (fblVersioneProgrammaInstallato, il ponte la legge dal registro). Solo se il ponte non
// risponde si ripiega sulla copia web, come prima.
//
// Il test misura il COMPORTAMENTO: mette in scena ESATTAMENTE quel caso (web nuova,
// programma vecchio) e guarda se il pulsante compare.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Scena eseguita DENTRO la pagina: copia web nuova (cache) + programma alla versione data.
// la si passa come SORGENTE (nessun backtick dentro), e la pagina la esegue davvero.
const SCENA_SRC = "(function(prog, web, tag){"
  + "  window.__fintaRelease={tag_name:tag,assets:[{name:'ForexBacktestLAB_Setup.exe'}]};"
  + "  try{ caches.keys=async function(){ return ['forex-backtest-lab-v'+web]; }; }catch(e){}"
  + "  window.fblPonteVersioneProgramma=async function(){"
  + "    return {programma:prog, pagina:web, da_aggiornare:prog!==web}; };"
  + "  var vero=window.fetch;"
  + "  window.fetch=function(url,opt){"
  + "    return (String(url).indexOf('api.github.com')>=0)"
  + "      ? Promise.resolve({ok:true,json:async function(){ return window.__fintaRelease; }})"
  + "      : vero(url,opt); };"
  + "})";

test('web nuova ma PROGRAMMA vecchio: il pulsante Aggiorna DEVE comparire', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (sorgente) => {
      const scena = eval('(' + sorgente + ')');
      const btn = document.getElementById('fblAggiornaBtn');
      if (!btn) return {errore: 'pulsante assente'};
      btn.style.display = 'none';
      try { localStorage.setItem('fbl_rel_vista', 'v2.0.99'); } catch (e) {}
      scena('2.0.99', '2.1.1', 'v2.1.1');
      await fblControllaAggiornamento(true);
      return {
        display: btn.style.display,
        etichetta: btn.textContent,
        lettaDaProgramma: await fblVersioneProgrammaInstallato()
      };
    }, SCENA_SRC);
    assert.ok(!r.errore, 'il pulsante della barra deve esistere: ' + r.errore);
    assert.equal(r.lettaDaProgramma, '2.0.99', 'la versione letta dal programma installato: ' + r.lettaDaProgramma);
    assert.notEqual(r.display, 'none',
      'con il PROGRAMMA vecchio il pulsante deve comparire anche se la copia web è nuova: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('programma e release all\'ultima: il pulsante resta spento', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (sorgente) => {
      const scena = eval('(' + sorgente + ')');
      const btn = document.getElementById('fblAggiornaBtn');
      if (!btn) return {errore: 'pulsante assente'};
      btn.style.display = '';
      try { localStorage.setItem('fbl_rel_vista', 'v2.0.99'); } catch (e) {}
      scena('2.1.1', '2.1.1', 'v2.1.1');
      await fblControllaAggiornamento(true);
      return {display: btn.style.display};
    }, SCENA_SRC);
    assert.ok(!r.errore, 'il pulsante della barra deve esistere: ' + r.errore);
    assert.equal(r.display, 'none',
      'programma e release all\'ultima: il pulsante resta spento: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se il ponte non risponde, non si inventa una versione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async () => {
      let quante = 0;
      window.fblPonteVersioneProgramma = async () => { quante++; return null; };
      const v = await fblVersioneProgrammaInstallato();
      return {v, quante};
    });
    assert.equal(r.v, '', 'senza risposta del ponte non si inventa una versione');
    assert.ok(r.quante >= 1, 'il ponte viene davvero interpellato: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
