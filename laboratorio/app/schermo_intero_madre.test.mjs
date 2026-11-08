// SCHERMO INTERO SULLA PAGINA MADRE, ANCHE CON LE FINESTRE DUPLICATE APERTE.
//
// SEGNALATO dal proprietario (7 novembre 2026): «quando creo una finestra duplicata non mi
// permette piu' alla pagina madre di andare su schermo intero. E invece deve farlo.»
//
// CAUSA MISURATA: toggleMainChartFullscreen() si affidava SOLO a wrap.requestFullscreen().
// Nell'app desktop (pywebview, piu' finestre WebView2 aperte) quella chiamata viene rifiutata
// o non parte, e NON c'era alcun ripiego: restava solo il messaggio d'errore, il grafico non
// si allargava mai.
//
// CURA: se il fullscreen nativo non entra entro un attimo (o rifiuta), si allarga il grafico a
// tutto schermo con una classe CSS. Il risultato visivo e' identico e funziona sempre.
//
// Il test misura il COMPORTAMENTO: nel banco il fullscreen nativo non esiste (o rifiuta), quindi
// e' ESATTAMENTE il caso del difetto. Si guarda che il grafico venga davvero allargato.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('se il fullscreen nativo non entra, il grafico si allarga lo stesso a tutto schermo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async () => {
      const wrap = document.getElementById('chartWrap');
      // Il banco non ha fullscreen nativo: lo fingiamo RIFIUTATO, il caso peggiore (pywebview
      // con piu' finestre aperte). L'app deve ripiegare sul CSS.
      wrap.requestFullscreen = () => Promise.reject(new Error('bloccato'));
      document.fullscreenElement = null;
      const prima = {cls: wrap.className, w: wrap.getBoundingClientRect().width};
      toggleMainChartFullscreen();
      await new Promise(res => setTimeout(res, 400));
      const st = getComputedStyle(wrap);
      const rett = wrap.getBoundingClientRect();
      const dopo = {
        attivo: fblSchermoInteroCssAttivo(),
        posizione: st.position,
        larghezza: Math.round(rett.width),
        altezza: Math.round(rett.height),
        vw: window.innerWidth, vh: window.innerHeight
      };
      // Secondo click: si torna indietro.
      toggleMainChartFullscreen();
      await new Promise(res => setTimeout(res, 100));
      const uscito = {attivo: fblSchermoInteroCssAttivo(), cls: wrap.className};
      return {prima, dopo, uscito};
    });
    assert.equal(r.dopo.attivo, true, 'lo schermo intero CSS deve attivarsi: ' + JSON.stringify(r.dopo));
    assert.equal(r.dopo.posizione, 'fixed', 'il grafico deve uscire dal flusso e riempire lo schermo');
    assert.ok(r.dopo.larghezza >= r.dopo.vw - 2, 'larghezza a tutto schermo: ' + JSON.stringify(r.dopo));
    assert.ok(r.dopo.altezza >= r.dopo.vh - 2, 'altezza a tutto schermo: ' + JSON.stringify(r.dopo));
    assert.equal(r.uscito.attivo, false, 'il secondo click deve tornare alla dimensione normale');
    assert.ok(!r.uscito.cls.includes('fbCssFullscreen'), 'la classe CSS deve essere tolta');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DEL DIFETTO CON LE FINESTRE DUPLICATE: la richiesta che NON risolve', async () => {
  // Il caso segnalato: con una finestra duplicata aperta il browser (e il WebView2 dell'app
  // desktop) ignora la richiesta di schermo intero e non risolve ne' rifiuta niente. Il ripiego
  // stava dentro il .then(): non veniva raggiunto mai. Qui si misura proprio quello.
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async () => {
      const wrap = document.getElementById('chartWrap');
      // Una richiesta che non risolve mai: ne' allora, ne' rifiutata.
      wrap.requestFullscreen = () => new Promise(() => {});
      document.fullscreenElement = null;
      toggleMainChartFullscreen();
      await new Promise(res => setTimeout(res, 1500));
      return {
        classe: wrap.className,
        attivo: fblSchermoInteroCssAttivo(),
        posizione: getComputedStyle(wrap).position,
        larghezza: Math.round(wrap.getBoundingClientRect().width),
        vw: window.innerWidth
      };
    });
    assert.equal(r.attivo, true,
      'la richiesta che non risolve deve comunque far comparire il ripiego: ' + JSON.stringify(r));
    assert.equal(r.posizione, 'fixed',
      'e il grafico si deve allargare a tutto schermo: ' + JSON.stringify(r));
    assert.ok(r.larghezza >= r.vw - 2,
      'larghezza a tutto schermo: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: col fullscreen nativo che funziona NON scatta il ripiego CSS', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async () => {
      const wrap = document.getElementById('chartWrap');
      // Fullscreen nativo che RIESCE: il browser entra davvero (finzione), nessun ripiego.
      let _fs = null;
      Object.defineProperty(document, 'fullscreenElement', {get(){return _fs;}, configurable:true});
      wrap.requestFullscreen = async () => { _fs = wrap; document.dispatchEvent(new Event('fullscreenchange')); return undefined; };
      toggleMainChartFullscreen();
      await new Promise(res => setTimeout(res, 400));
      const attivo = fblSchermoInteroCssAttivo();
      _fs = null;
      return {attivo};
    });
    assert.equal(r.attivo, false, 'col fullscreen nativo riuscito non deve scattare il ripiego CSS');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
