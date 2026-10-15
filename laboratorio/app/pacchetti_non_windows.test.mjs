// IL SERVIZIO MT5 È UN PROGRAMMA PER WINDOWS: dove non è Windows, non si propone di installarlo.
//
// SEGNALATO dal proprietario (15 ottobre 2026): «quando faccio l'accesso a un nuovo dispositivo e
// vado ad aggiungere un account di MT5, mi compare il messaggio dell'installazione dei pacchetti
// per il servizio MT5, io comunque al server sono collegato. Risolviamo questo bug sui dispositivi
// mobili».
//
// Un controllo per telefoni e tablet c'era già (fblEMobile), ma riconosce il dispositivo dalla
// User-Agent e dal touch — e la User-Agent mente, di proposito, ogni volta che il browser è in
// «modalità desktop». Un riconoscimento che può sbagliare non è il posto giusto per una decisione
// che ha una risposta certa: il Setup è un installatore Windows, e il sistema operativo il browser
// lo sa senza doverlo indovinare.
//
// Questi test prendono il caso che sfuggiva: un dispositivo che si presenta come computer, senza
// touch (quindi fblEMobile dice «no»), con l'indirizzo del ponte ancora su 127.0.0.1 (quindi
// fblRemoto dice «no») — ma che Windows non è.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {chromium, RADICE} from './aiuti.mjs';

// Apre l'app fingendo un sistema operativo diverso. Si tocca sia la User-Agent sia i Client Hints
// (navigator.userAgentData), perché è da lì che la funzione prende la risposta quando ci sono.
async function apriCon({userAgent, platform}){
  const browser = await chromium.launch();
  const contesto = await browser.newContext({viewport:{width:1280, height:800}, userAgent});
  await contesto.addInitScript(([p]) => {
    Object.defineProperty(navigator, 'userAgentData', {
      configurable: true,
      get: () => (p === null ? undefined : {platform: p, mobile: false, brands: []})
    });
  }, [platform]);
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  await pagina.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pagina.goto('file://' + path.join(RADICE, 'app.html'), {waitUntil:'domcontentloaded'});
  await pagina.waitForTimeout(2500);
  await pagina.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay').forEach(el => el.style.display='none'));
  return {browser, pagina, errori};
}

// Ponte spento: è la situazione in cui il passo 1 compare.
const PONTE_SPENTO = () => {
  fetchMt5WithTimeout = async () => ({ok:false});
  window.setTimeout = ((vero) => (fn, ms) => vero(fn, Math.min(ms||0, 5)))(window.setTimeout);
  $('mt5LoginModalOverlay').style.display = 'flex';
};

const CASI = [
  {nome:'iPad che si dichiara Mac (modalità desktop, niente touch rilevato)',
   userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
   platform:'macOS'},
  {nome:'tablet Android in modalità desktop',
   userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
   platform:'Android'},
  {nome:'nessun Client Hint: decide la User-Agent, e non dice Windows',
   userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
   platform:null},
];

for(const caso of CASI){
  test(`${caso.nome}: mai "installa i pacchetti"`, async () => {
    const {browser, pagina, errori} = await apriCon(caso);
    try{
      const r = await pagina.evaluate(async (prep) => {
        eval('(' + prep + ')')();
        await mt5StartLoginFlow();
        return {mobile: fblEMobile(),
                remoto: fblRemoto(),
                siInstalla: fblQuiSiInstallaIlServizio(),
                titolo: $('mt5BridgeStepTitle').textContent,
                testo: $('mt5BridgeStepTesto').textContent,
                scaricaNascosto: $('mt5DownloadDesktopAppBtn').style.display === 'none'};
      }, PONTE_SPENTO.toString());
      // È proprio il caso che sfuggiva: i due controlli di prima dicono «è il computer».
      assert.equal(r.mobile, false, 'qui fblEMobile non riconosce il dispositivo: è il caso del bug');
      assert.equal(r.remoto, false, 'e l\'indirizzo del ponte è ancora quello locale');
      assert.equal(r.siInstalla, false, 'ma qui il Setup non si installa: non è Windows');
      assert.doesNotMatch(r.titolo, /Installa i pacchetti/,
        'dove il Setup non si esegue, non si può chiedere di installarlo');
      assert.match(r.testo, /computer/, 'deve spiegare che il collegamento lo fa il computer');
      assert.equal(r.scaricaNascosto, true, 'e il pulsante di download non deve comparire');
      assert.deepEqual(errori, []);
    } finally { await browser.close(); }
  });
}

test('su Windows invece non cambia niente: la schermata di installazione resta', async () => {
  // Il guardiano di questa correzione: non deve spegnere il caso vero, che è il computer.
  const {browser, pagina, errori} = await apriCon({
    userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    platform:'Windows'});
  try{
    const r = await pagina.evaluate(async (prep) => {
      eval('(' + prep + ')')();
      await mt5StartLoginFlow();
      return {siInstalla: fblQuiSiInstallaIlServizio(),
              titolo: $('mt5BridgeStepTitle').textContent,
              scaricaVisibile: $('mt5DownloadDesktopAppBtn').style.display !== 'none'};
    }, PONTE_SPENTO.toString());
    assert.equal(r.siInstalla, true, 'su Windows il Setup si installa eccome');
    assert.match(r.titolo, /Installa i pacchetti/, 'sul computer la schermata resta quella di prima');
    assert.equal(r.scaricaVisibile, true, 'e il download resta a disposizione');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
