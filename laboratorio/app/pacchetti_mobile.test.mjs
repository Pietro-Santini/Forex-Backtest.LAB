// Il popup «Installa i pacchetti aggiuntivi» deve esistere solo sul computer.
//
// Segnalato dal proprietario (9 ottobre 2026): su telefono e tablet compare ancora
// la schermata che chiede di scaricare i pacchetti. Causa vera, due buchi:
// (1) il gate «hai già installato MT5?» (passo 2) cade sul passo 1 con le parole
//     STATICHE dell'installazione quando il bridge smette di rispondere mentre si è
//     al gate: mt5ShowStepVisible(1) senza mt5Passo1Parole, su QUALSIASI dispositivo;
// (2) fblEMobile() non riconosce un telefono con il browser in "modalità desktop":
//     la User-Agent mente, e il controllo chiedeva maxTouchPoints > 1 (un telefono
//     così ne ha anche solo 1).
//
// Il collegamento degli ordini (porta 8000) è sul computer: scaricare pacchetti da
// un telefono o da un tablet non ha senso, lì il popup non deve mai comparire.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {apriApp, chromium, RADICE} from './aiuti.mjs';

// Stato del ponte finto, mutabile DURANDO la prova (il bridge può morire mentre si
// è al gate). `salute` = quante volte /health risponde bene prima di smettere.
const PREPARA = (opz) => {
  window._mock = {n: 0, salute: opz.salute || 0, giaVisto: !!opz.giaVisto, terminale: !!opz.terminale};
  pontGiaVisto = window._mock.giaVisto;
  try{ window._mock.giaVisto ? localStorage.setItem('fxbt_ponteGiaVisto','1') : localStorage.removeItem('fxbt_ponteGiaVisto'); }catch(e){}
  fetchMt5WithTimeout = async (percorso) => {
    const m = window._mock;
    if (percorso === '/health') { m.n++; return m.n <= m.salute ? {ok: true, data: {}} : {ok: false}; }
    if (percorso === '/mt5-terminal-status') return {ok: true, data: {installed: m.terminale}};
    return {ok: true, data: {}};
  };
  // L'attesa fra un tentativo e l'altro e' di 1,5 s (e il gate aspetta 20 s): nel
  // test si accorcia, altrimenti ogni prova durerebbe decine di secondi veri.
  window.setTimeout = ((vero) => (fn, ms) => vero(fn, Math.min(ms || 0, 5)))(window.setTimeout);
  $('mt5LoginModalOverlay').style.display = 'flex';
};
// Aspetta (al massimo `limiteMs`) che il passo 1 del wizard sia a schermo.
test('il gate che cade sul passo 1 non mostra la schermata dell\'installazione (computer)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (prep) => {
      eval('(' + prep + ')')({salute: 1, giaVisto: true, terminale: false});
      // Bridge vivo, terminale MT5 NON installato: il flusso si ferma al passo 2 (gate).
      await mt5StartLoginFlow();
      const gateAperto = $('mt5TerminalGate').style.display === 'flex';
      // Adesso il bridge muore (esattamente cosa è successo il 9 ottobre: il servizio
      // si è impallato restando in vita). Chi risponde "Sì, è installato" scopre che
      // il ponte non c'è più.
      window._mock.salute = 0;
      $('mt5GateYesBtn').click();
      // Il gate riprova per 20 s (l'attesa fra i tentativi e' accorciata,
      // ma il tempo e' quello vero). Il segnale che il gate e' finito NON
      // e' il titolo del passo 1: quello e' gia' visibile anche al passo 2.
      // Il gate invece si chiude solo quando il flusso cambia davvero passo.
      const t0 = Date.now();
      for(;;){
        if($('mt5TerminalGate').style.display !== 'flex')break;
        if(Date.now() - t0 >= 35000)break;
        await new Promise(ris => setTimeout(ris, 100));
      }
      return {gateAperto,
              arrivato: $('mt5TerminalGate').style.display !== 'flex',
              titolo: $('mt5BridgeStepTitle').textContent,
              testo: $('mt5BridgeStepTesto').textContent,
              avanti: $('mt5BridgeContinueBtn').textContent};
    }, PREPARA.toString());
    assert.equal(r.gateAperto, true, 'il flusso deve passare dal gate (passo 2)');
    assert.equal(r.arrivato, true, 'il passo 1 deve comparire dopo il gate');
    assert.doesNotMatch(r.titolo, /Installa i pacchetti/,
      'i pacchetti su questo PC risultano già installati: non si chiede di installarli');
    assert.match(r.titolo, /non risponde/, 'deve dire che il servizio non risponde');
    assert.match(r.avanti, /Riprova/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('telefono in "modalità desktop" (User-Agent da computer): mai installare pacchetti', async () => {
  // Contesto a parte: User-Agent da computer MA touch e puntatore grossolano, come
  // un telefono Android con il browser in modalità desktop. apriApp() non lo sa fare.
  const browser = await chromium.launch();
  const contesto = await browser.newContext({viewport:{width: 1280, height: 800}, hasTouch: true});
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  try{
    await pagina.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await pagina.goto('file://' + path.join(RADICE, 'app.html'), {waitUntil: 'domcontentloaded'});
    await pagina.waitForTimeout(2500);
    await pagina.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay').forEach(el => el.style.display = 'none'));
    const r = await pagina.evaluate(async (prep) => {
      eval('(' + prep + ')')({salute: 0, giaVisto: false, terminale: false});
      await mt5StartLoginFlow();
      return {mobile: fblEMobile(),
              titolo: $('mt5BridgeStepTitle').textContent,
              testo: $('mt5BridgeStepTesto').textContent,
              scaricaNascosto: $('mt5DownloadDesktopAppBtn').style.display === 'none'};
    }, PREPARA.toString());
    assert.equal(r.mobile, true,
      'un dispositivo con touch, puntatore grossolano e schermo piccolo è mobile: la User-Agent mente, l\'hardware no');
    assert.doesNotMatch(r.titolo, /Installa i pacchetti/,
      'su telefono/tablet il popup dei pacchetti non deve mai comparire');
    assert.equal(r.scaricaNascosto, true, 'il pulsante di download non deve stare su un dispositivo mobile');
    assert.match(r.testo, /computer/, 'deve spiegare che il collegamento lo fa il computer');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('telefono con l\'indirizzo del computer scritto (chiave ereditata): mai installare', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (prep) => {
      eval('(' + prep + ')')({salute: 0, giaVisto: false, terminale: false});
      // Chiave di prima del 7 ottobre: il telefono aveva scritto a mano
      // l'indirizzo del COMPUTER (non del server). fblRemoto() vale, e
      // il dispositivo non e' il computer anche se la User-Agent lo dice.
      localStorage.setItem('fb_indirizzo_ponte','pc-esempio.tail83d918.ts.net');
      await mt5StartLoginFlow();
      return {remoto: fblRemoto(),
              titolo: $('mt5BridgeStepTitle').textContent,
              scaricaNascosto: $('mt5DownloadDesktopAppBtn').style.display === 'none'};
    }, PREPARA.toString());
    assert.equal(r.remoto, true, 'con l\'indirizzo del computer scritto, l\'app sa di non essere sul computer');
    assert.doesNotMatch(r.titolo, /Installa i pacchetti/,
      'su un dispositivo remoto il popup dei pacchetti non deve comparire');
    assert.equal(r.scaricaNascosto, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('computer senza touch, primo avvio: la schermata di installazione resta quella di prima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (prep) => {
      eval('(' + prep + ')')({salute: 0, giaVisto: false, terminale: false});
      await mt5StartLoginFlow();
      return {mobile: fblEMobile(),
              titolo: $('mt5BridgeStepTitle').textContent,
              scarica: $('mt5DownloadDesktopAppBtn').textContent,
              scaricaVisibile: $('mt5DownloadDesktopAppBtn').style.display !== 'none'};
    }, PREPARA.toString());
    assert.equal(r.mobile, false, 'il computer senza touch non è mobile');
    assert.match(r.titolo, /Installa i pacchetti/, 'sul computer la schermata di installazione resta');
    assert.match(r.scarica, /download dei pacchetti/);
    assert.equal(r.scaricaVisibile, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
