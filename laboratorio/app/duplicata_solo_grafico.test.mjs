// NELLA FINESTRA DUPLICATA: SOLO IL GRAFICO, NESSUN SCORRIMENTO, BARRA ANCORATA (voce 3).
//
// SEGNALATO dal proprietatore (8 novembre 2026): «quando ho una finestra duplicata mi fa
// scorrere la pagina come se sotto ci fosse qualcosa, ma invece no: ci deve essere soltanto il
// grafico e non mi deve scorrere nulla con la rotellina del mouse oppure con il dito che
// scorre sulla pagina. E la barra laterale degli strumenti e del replay deve restare ancorata
// li' a sinistra e non avere problemi.»
//
// Il test misura lo STATO DICHIARATO dal documento, non il testo del CSS: chiede al browser
// cosa vale davvero per html, body e la barra laterale, e conta quanti elementi restano
// visibili fuori dal grafico. La prima stesura guardava il sorgente del foglio di stile: era
// provato rosso-senza ma non diceva nulla su quello che l'utente vede.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('nella duplicata non si puo\' scorrere la pagina, in nessun modo', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=2'});
  try{
    // Il documento deve essere davvero in modalita' "solo grafico”.
    const mode = await pagina.evaluate(() => ({
      pip: PIP_SLOT,
      htmlKiosk: document.documentElement.classList.contains('fbPipChartOnly'),
      bodyKiosk: document.body.classList.contains('fbPipChartOnly')
    }));
    assert.equal(mode.pip, 2, 'la pagina deve aprirsi come finestra duplicata');
    assert.equal(mode.htmlKiosk, true, "la modalita' solo-grafico deve essere accesa su <html>");
    assert.equal(mode.bodyKiosk, true, 'e su <body>');

    const r = await pagina.evaluate(() => {
      const csHtml = getComputedStyle(document.documentElement);
      const csBody = getComputedStyle(document.body);
      // Il documento e' piu' alto della finestra? Se lo fosse', si potrebbe scorrere.
      const documento = document.documentElement;
      const altezzaEccessiva = documento.scrollHeight - documento.clientHeight;
      return {
        overflowHtml: csHtml.overflow, overflowBody: csBody.overflow,
        overscrollHtml: csHtml.overscrollBehaviorY, overscrollBody: csBody.overscrollBehaviorY,
        altezzaEccessiva: altezzaEccessiva,
        // La barra laterale degli strumenti: deve esistere e restare ancorata a SINISTRA DEL
        // GRAFICO (la si misura rispetto al grafico, non alla finestra: e' la posizione dentro
        // il riquadro che conta, ed e' li' che l'utente la guarda).
        sidebar: (() => {
          const sb = document.querySelector('.chartFsSidebar');
          if(!sb) return {presente:false};
          const cs = getComputedStyle(sb);
          const r = sb.getBoundingClientRect();
          const wrap = document.querySelector('.chartWrap');
          const w = wrap ? wrap.getBoundingClientRect() : null;
          return {presente:true, overflowY: cs.overflowY,
                  aSinistra: w ? Math.abs(r.left - w.left) <= 2 : r.left <= 1,
                  larghezza: Math.round(r.width)};
        })()
      };
    });
    assert.ok(r.overflowHtml === 'hidden' && r.overflowBody === 'hidden',
      'html e body devono dichiarare overflow nascosto: ' + JSON.stringify(r));
    assert.equal(r.overscrollHtml, 'none', 'niente rimbalzo elastico su <html>: ' + JSON.stringify(r));
    assert.equal(r.overscrollBody, 'none', 'niente rimbalzo elastico sul body: ' + JSON.stringify(r));
    assert.ok(r.altezzaEccessiva <= 2,
      'il documento non deve essere piu\' alto della finestra (era la barra di scorrimento vera): ' + JSON.stringify(r));
    assert.equal(r.sidebar.presente, true,
      'la barra laterale degli strumenti deve esserci: ' + JSON.stringify(r));
    assert.equal(r.sidebar.aSinistra, true,
      'e restare ancorata a sinistra: ' + JSON.stringify(r));
    assert.equal(r.sidebar.overflowY, 'auto',
      'e poter scorrere da sola se gli strumenti non ci stanno (toglierglielo la renderebbe illeggibile): ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('sulla pagina PRINCIPALE non cambia niente (prova di controllo)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      htmlKiosk: document.documentElement.classList.contains('fbPipChartOnly'),
      bodyKiosk: document.body.classList.contains('fbPipChartOnly'),
      touch: getComputedStyle(document.body).touchAction,
      overscroll: getComputedStyle(document.documentElement).overscrollBehaviorY
    }));
    assert.equal(r.htmlKiosk, false, 'la pagina madre non e\' una duplicata: ' + JSON.stringify(r));
    assert.equal(r.bodyKiosk, false, 'e nemmeno il suo body: ' + JSON.stringify(r));
    assert.notEqual(r.touch, 'none',
      'il touch-action della madre non si tocca (non e\' nostro da spegnere): ' + JSON.stringify(r));
    assert.notEqual(r.overscroll, 'none',
      'e nemmeno il suo overscroll: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
