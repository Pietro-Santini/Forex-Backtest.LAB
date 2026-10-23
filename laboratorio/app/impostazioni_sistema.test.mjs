// IL POPUP DEL TASTO «COLLEGAMENTO/MODALITÀ» SI CHIAMA «IMPOSTAZIONI DI SISTEMA».
//
// RICHIESTO ESPLICITAMENTE (23 ottobre 2026): «impostazioni di sistema deve stare dentro al
// collegamento del tasto collegamento/modalità; il titolo all'interno è: impostazioni di
// sistema non impostazioni generali».
//
// IL DIFETTO: il popup che il tasto «🔌 Collegamento/Modalità» apriva portava il titolo
// «⚙️ Impostazioni generali»: fuori posto, perché quello che c'è dentro (ponte dei segnali,
// accesso da altri dispositivi, conti, modalità Live/Storico, sale, versione) non è
// preferenza cosmetica ma la configurazione a livello di sistema del dispositivo.
//
// LA CURA: il titolo del popup diventa «⚙️ Impostazioni di sistema», in tutta l'app — il
// popup, i commenti che lo citano, i testi che dicono dove trovare una preferenza. Niente
// più «Impostazioni generali» da nessuna parte. Il tasto e le schede restano quelli.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('il popup del Collegamento/Modalità porta il titolo «Impostazioni di sistema»', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.click('#generalSettingsBtn');
    const r = await pagina.evaluate(`(function(){
      const ov=document.getElementById('generalSettingsModalOverlay');
      const tit=ov.querySelector('h3');
      return {aperto:ov.style.display, titolo:tit?tit.textContent.trim():null};
    })()`);
    assert.ok(r.aperto!=='none','cliccando «Collegamento/Modalità» il popup si deve aprire');
    assert.ok(r.titolo.includes('⚙️'), 'il titolo mantiene la sua icona: '+r.titolo);
    assert.ok(r.titolo.includes('Impostazioni di sistema'), 'il titolo deve essere «Impostazioni di sistema»: '+r.titolo);
    assert.ok(!/general/i.test(r.titolo),'non deve restare nessun «generale» nel titolo: '+r.titolo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('non resta nessun «Impostazioni generali» scritto da nessuna parte nella pagina', async () => {
  // La lettera del richiesta: NON più «impostazioni generali» ma «impostazioni di sistema»:
  // trova ogni occorrenza rimasta nei testi visibili e nei commenti del codice della pagina.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      const old='Impostazioni generali';
      const dove=[];
      // 1) testi visibili
      const walker=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while(walker.nextNode()) if(walker.currentNode.textContent.includes(old))
        dove.push('testo: '+walker.currentNode.textContent.trim().slice(0,80));
      // 2) attributi title/aria che il mouse legge
      document.querySelectorAll('[title],[aria-label]').forEach(el=>{
        const t=(el.getAttribute('title')||el.getAttribute('aria-label')||'');
        if(t.includes(old)) dove.push('attributo: '+t.slice(0,80));
      });
      return dove;
    })()`);
    assert.equal(r.length,0,'nessun «Impostazioni generali» deve restare: '+JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
