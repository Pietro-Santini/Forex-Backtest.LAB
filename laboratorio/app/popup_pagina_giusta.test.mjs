// IL POPUP COMPARE SULLA PAGINA DEL PULSANTE CHE LO HA APERTO — anche col grafico staccato.
//
// RICHIESTO ESPLICITAMENTE: «Se sono in modalita' PIP e apro la Watch list, il popup deve comparire
// sulla pagina PIP; se lo apro dalla pagina principale, sulla principale. Uguale per le impostazioni
// generali e per quelle dentro al grafico. Ogni pulsante fa riferimento alla pagina su cui sono.»
//
// Il file teneva il documento dell'ultimo tocco (lastInteractionDoc) per decidere, ma la scelta non
// lo guardava: con il PIP attivo il popup finiva SEMPRE nella finestra separata, anche premendo un
// pulsante della pagina principale. Misurato prima di correggere: daPagina = "pip".
//
// Il banco riproduce la "seconda finestra" con un iframe same-origin, come fa il test
// pip_apertura_strategia: stessa struttura di due document distinti (floatingDoc/floatingWin)
// senza dipendere dalla finestra di sistema che il browser puo' bloccare.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('col grafico staccato il popup va nel documento del pulsante premuto, non sempre nel PIP', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      // --- Seconda finestra, come la apre openFloatingChart (PIP) ------------------------------
      const fr=document.createElement('iframe');
      fr.style.cssText='position:fixed;left:-9999px;top:0;width:900px;height:600px;border:0';
      document.body.appendChild(fr);
      const doc=fr.contentDocument, win=fr.contentWindow;
      copyStylesInto(doc);
      floatingWin=win; floatingDoc=doc;
      trackPopupInteractions(doc);

      const ov=document.getElementById('chartSettingsModalOverlay');
      const dove=()=>ov.ownerDocument===document?'principale':(ov.ownerDocument===doc?'pip':'altrove');

      // 1) Ultimo tocco sulla PAGINA PRINCIPALE: il popup resta li'.
      lastInteractionDoc=document;
      ov.style.display='none';
      moveModalToFloatingIfActive(ov);
      ov.style.display='flex';
      const daPagina=dove();

      // 2) Ultimo tocco NEL PIP: il popup si sposta nella finestra separata.
      lastInteractionDoc=doc;
      ov.style.display='none';
      moveModalToFloatingIfActive(ov);
      ov.style.display='flex';
      const daPip=dove();

      // 3) Riaperto dalla pagina principale: torna indietro (non resta appeso al PIP).
      lastInteractionDoc=document;
      ov.style.display='none';
      moveModalToFloatingIfActive(ov);
      ov.style.display='flex';
      const rientrato=dove();

      // 4) Copertura automatica: un popup che diventa visibile da solo viene instradato
      //    guardando lo stesso documento (l'osservatore lo instrada senza chiamate esplicite).
      const altro=document.getElementById('chartLayersModalOverlay');
      lastInteractionDoc=doc;
      altro.style.display='flex';
      await new Promise(ok=>setTimeout(ok,80));
      const autoNelPip=altro.ownerDocument===doc;
      lastInteractionDoc=document;
      altro.style.display='none';
      altro.style.display='flex';
      await new Promise(ok=>setTimeout(ok,80));
      const autoACasa=altro.ownerDocument===document;

      // 5) Uscita dal PIP: niente resta appeso a una finestra che si chiude.
      restoreChartToMainPage();
      const fineRientro=dove();
      const pipVuoto=!doc.querySelector('.fbModalOverlay');

      ov.style.display='none'; altro.style.display='none';
      fr.remove();
      return {daPagina, daPip, rientrato, autoNelPip, autoACasa, fineRientro, pipVuoto};
    });

    assert.equal(r.daPagina,'principale','col tocco sulla pagina principale il popup resta sulla principale');
    assert.equal(r.daPip,'pip','col tocco nel PIP il popup si apre nel PIP');
    assert.equal(r.rientrato,'principale','riaprendolo dalla principale torna sulla principale');
    assert.equal(r.autoNelPip,true,'un popup che si apre da solo, col tocco nel PIP, va nel PIP');
    assert.equal(r.autoACasa,true,'e torna sulla principale quando il tocco e\' li\'');
    assert.equal(r.fineRientro,'principale','uscendo dal PIP nessun popup resta appeso');
    assert.equal(r.pipVuoto,true,'nella finestra separata non resta nessun popup');
    assert.deepEqual(errori,[]);
  } finally { await browser.close(); }
});
