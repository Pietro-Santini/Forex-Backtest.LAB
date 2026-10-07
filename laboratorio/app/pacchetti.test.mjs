// «Installa i pacchetti aggiuntivi» chiesto a chi li ha gia' installati.
//
// Segnalato dal proprietario: «sul computer mi chiede molto spesso di installare i pacchetti
// aggiuntivi anche se li ho gia' scaricati». Causa vera: mt5StartLoginFlow() provava /health UNA
// volta sola e, se non rispondeva, mostrava il passo 1 — che e' la schermata dell'installazione.
// Ma /health muto quasi sempre vuol dire "il servizio non ha ancora finito di partire": parte da
// solo, e su un PC appena acceso ci mette qualche secondo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Un /health che fallisce le prime `quanti` volte e poi risponde: e' il PC appena acceso.
// `quanti` = Infinity per il servizio che non risponde mai. Non un numero grande: con l'attesa
// accorciata qui sotto si fanno oltre mille tentativi in pochi secondi, e un "999" verrebbe
// raggiunto davvero, facendo riuscire la prova che doveva fallire.
const PREPARA = (quanti, giaVisto) => {
  let n = 0;
  window._tentativi = 0;
  // La variabile si legge da localStorage all'AVVIO della pagina: impostarla adesso nel deposito
  // non cambierebbe quella gia' in memoria. Si imposta tutte e due, cosi' valgono entrambe.
  pontGiaVisto = !!giaVisto;
  try{ giaVisto ? localStorage.setItem('fxbt_ponteGiaVisto','1') : localStorage.removeItem('fxbt_ponteGiaVisto'); }catch(e){}
  fetchMt5WithTimeout = async (percorso) => {
    if (percorso === '/health') {
      window._tentativi = ++n;
      return n > quanti ? {ok: true, data: {}} : {ok: false};
    }
    if (percorso === '/mt5-terminal-status') return {ok: true, data: {installed: true}};
    return {ok: true, data: {}};
  };
  // L'attesa fra un tentativo e l'altro e' di 1,5 s: nel test si accorcia, altrimenti ogni prova
  // durerebbe venti secondi senza dimostrare niente di piu'.
  window.setTimeout = ((vero) => (fn, ms) => vero(fn, Math.min(ms || 0, 5)))(window.setTimeout);
  $('mt5LoginModalOverlay').style.display = 'flex';
};

test('il servizio che ci mette qualche secondo a partire NON fa comparire «installa i pacchetti»', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (prep) => {
      eval('(' + prep + ')(2, true)');      // risponde al terzo tentativo
      await mt5StartLoginFlow();
      return {tentativi: window._tentativi,
              passo1: $('mt5BridgeHelp').style.display,
              visto: localStorage.getItem('fxbt_ponteGiaVisto')};
    }, PREPARA.toString());
    assert.ok(r.tentativi >= 3, 'deve riprovare, non arrendersi al primo tentativo (tentativi: ' + r.tentativi + ')');
    assert.equal(r.passo1, 'none', 'il passo «installa i pacchetti» non deve comparire');
    assert.equal(r.visto, '1');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('servizio gia' + "'" + ' installato ma zitto: si dice che non risponde, non di installarlo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (prep) => {
      eval('(' + prep + ')(Infinity, true)');   // non risponde mai
      await mt5StartLoginFlow();
      return {passo1: $('mt5BridgeHelp').style.display,
              titolo: $('mt5BridgeStepTitle').textContent,
              testo: $('mt5BridgeStepTesto').textContent,
              avanti: $('mt5BridgeContinueBtn').textContent};
    }, PREPARA.toString());
    assert.notEqual(r.passo1, 'none', 'qualcosa va pur detto: il servizio non risponde');
    assert.doesNotMatch(r.titolo, /Installa i pacchetti/,
      'a chi li ha gia\' installati non si chiede di installarli');
    assert.match(r.testo, /gi(à|a)\s+installati/i);
    assert.match(r.avanti, /Riprova/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('primo avvio davvero senza pacchetti: la schermata di installazione resta quella di prima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (prep) => {
      eval('(' + prep + ')(Infinity, false)');
      await mt5StartLoginFlow();
      return {titolo: $('mt5BridgeStepTitle').textContent,
              scarica: $('mt5DownloadDesktopAppBtn').textContent};
    }, PREPARA.toString());
    assert.match(r.titolo, /Installa i pacchetti/);
    assert.match(r.scarica, /download dei pacchetti/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
