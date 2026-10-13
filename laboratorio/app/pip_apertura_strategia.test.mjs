// RICHIESTO ESPLICITAMENTE: "il popup per la configurazione della strategia dentro il pannello
// Apertura automatica delle posizioni deve visualizzarsi anche in modalità PIP".
//
// Il pannello "⚡ Apertura automatica" è un .fbModalOverlay e viene instradato da solo nella
// finestra separata (routeModalToHostDoc). Il suo menù della Strategia (.tgStratPop), invece, è un
// semplice <div> creato al volo: prima finiva SEMPRE in document.body della pagina principale e in
// PIP restava invisibile (anzi, l'ancoraggio non trovava nemmeno il pulsante, che stava nell'altra
// finestra). Ora viene creato nel documento che ospita il pulsante premuto, si aggancia/si
// riposiziona lì, e rientra a casa quando si esce dal PIP.
//
// Il banco di prova riproduce una "seconda finestra" con un iframe same-origin: stessa struttura di
// due document distinti che il PIP usa realmente (floatingDoc/floatingWin), senza dipendere dalla
// finestra di sistema che il browser può bloccare.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('PIP) il menù della Strategia dell\'apertura automatica si apre nella finestra separata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      // --- Seconda finestra, come la apre openFloatingChart (finestra separata/PIP) ------------
      const fr=document.createElement('iframe');
      fr.style.cssText='position:fixed;left:-9999px;top:0;width:900px;height:600px;border:0';
      document.body.appendChild(fr);
      const doc=fr.contentDocument, win=fr.contentWindow;
      copyStylesInto(doc);              // come openFloatingChart
      floatingWin=win; floatingDoc=doc;
      trackPopupInteractions(doc);
      tgAutoAgganciaPopSuDoc(doc,win);  // come openFloatingChart (nuovo)
      lastInteractionDoc=doc;

      // --- Il pannello dell'apertura automatica deve finire nel PIP (premessa del test) -------
      tgApriAuto();
      await new Promise(ok=>setTimeout(ok,60));   // l'instradamento passa dall'osservatore dei popup
      const pannelloInPip=!!doc.querySelector('#tgAutoOverlay') && !document.querySelector('#tgAutoOverlay');

      // --- Un pulsante "Strategia" DENTRO la finestra separata (come quelli della tabella sale) -
      const btn=doc.createElement('button');
      btn.type='button'; btn.dataset.tgstrat='SALA_PIP'; btn.textContent='Strategia';
      btn.style.cssText='position:absolute;left:120px;top:140px';
      doc.body.appendChild(btn);

      tgAuto.sale['SALA_PIP']={attivo:true, rischio:1, maxPosizioni:2,
                               regole:tgAutoRegolePrudenti(3), avvicinamento:70, quote:[], modo:'posizioni'};
      const cfg=tgAuto.sale['SALA_PIP'];
      const apri=()=>tgAutoApriStrat('SALA_PIP', btn, cfg, 3, 'di questa sala');

      // 1) Apertura: il menù nasce nella finestra separata, non nella pagina principale.
      apri();
      const nelPip=!!doc.querySelector('.tgStratPop');
      const nellaPrincipale=!!document.querySelector('.tgStratPop');
      const owner=tgAutoPop && tgAutoPop.ownerDocument===doc;
      const ancorato=tgAutoAncoraPop()===btn;
      const posizionato=!!(tgAutoPop && tgAutoPop.style.left && tgAutoPop.style.top);

      // 2) Clic "fuori", dentro la finestra separata: il menù deve chiudersi (i gestori devono
      //    essere agganciati ANCHE a quel documento).
      const fuori=doc.createElement('div');
      doc.body.appendChild(fuori);
      fuori.dispatchEvent(new MouseEvent('mousedown', {bubbles:true, cancelable:true}));
      const chiusoDopoClickFuori=!doc.querySelector('.tgStratPop') && !tgAutoPop;

      // 3) Toggle: premere di nuovo lo stesso pulsante chiude, non duplica.
      apri();
      const apertoDiNuovo=!!doc.querySelector('.tgStratPop');
      apri();
      const chiusoDopoRetoggle=!doc.querySelector('.tgStratPop') && !tgAutoPop;

      // 4) Uscita dal PIP: il menù (se aperto) deve tornare nella pagina principale, non restare
      //    appeso a una finestra che si chiude.
      apri();
      const inPipPrima=!!doc.querySelector('.tgStratPop');
      restoreChartToMainPage();
      const aCasa=!!document.querySelector('.tgStratPop') && !!tgAutoPop && tgAutoPop.ownerDocument===document;
      const pipDopo=!!doc.querySelector('.tgStratPop');

      tgAutoChiudiStrat();
      const ov=document.getElementById('tgAutoOverlay')||doc.getElementById('tgAutoOverlay');
      if(ov)ov.style.display='none';
      fr.remove();
      return {pannelloInPip, nelPip, nellaPrincipale, owner, ancorato, posizionato,
              chiusoDopoClickFuori, apertoDiNuovo, chiusoDopoRetoggle, inPipPrima, aCasa, pipDopo};
    });

    assert.equal(r.pannelloInPip, true, 'il pannello Apertura automatica viene ospitato nella finestra separata');
    assert.equal(r.nelPip, true, 'il menù della Strategia compare nella finestra separata (PIP)');
    assert.equal(r.nellaPrincipale, false, 'il menù NON viene creato nella pagina principale');
    assert.equal(r.owner, true, 'il menù appartiene al documento della finestra separata');
    assert.equal(r.ancorato, true, 'l\'ancoraggio trova il pulsante nella finestra separata');
    assert.equal(r.posizionato, true, 'il menù viene posizionato rispetto a quella finestra');
    assert.equal(r.chiusoDopoClickFuori, true, 'un clic fuori, dentro la finestra separata, chiude il menù');
    assert.equal(r.apertoDiNuovo, true, 'il menù si riapre');
    assert.equal(r.chiusoDopoRetoggle, true, 'ripremendo lo stesso pulsante il menù si chiude (toggle)');
    assert.equal(r.inPipPrima, true, 'da aperto, il menù è nella finestra separata');
    assert.equal(r.aCasa, true, 'uscendo dal PIP il menù torna nella pagina principale');
    assert.equal(r.pipDopo, false, 'e non resta appeso alla finestra separata');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
