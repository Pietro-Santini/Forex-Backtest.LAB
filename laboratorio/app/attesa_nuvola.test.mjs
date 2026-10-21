// L'ATTESA DELLA NUVOLA NON DEVE FAR GIRARE A VUOTO L'APP.
//
// SEGNALATO dal proprietario: «dopo gli aggiornamenti l'applicazione inizia a laggare e scattare
// nel movimento a scorrimento di tutta la pagina e all'interno del grafico, anche in modalità
// replay, ma io penso che sia un problema a monte di connettività».
//
// MISURATO il 21 ottobre 2026, con la pagina FERMA e senza rete: 27 timer attivi per un totale di
// 77,6 risvegli al secondo — e SESSANTASEI venivano da una sola funzione. `waitForFxbtCloud()`
// controllava ogni 30 millisecondi (33 volte al secondo) se Firebase fosse pronto, e smetteva solo
// quando arrivava. Senza rete Firebase non arriva MAI: due attese restavano a battere per sempre.
//
// Il proprietario aveva ragione sulla connettività, ma non nel modo che immaginava: non è la rete
// lenta a far scattare il grafico — è l'app che, quando la rete manca, si mette a girare a vuoto.
// Dopo la correzione, nelle stesse condizioni: 16,3 risvegli al secondo.
//
// LE TRE COSE CHE QUESTI TEST TENGONO FERME:
//   1. l'attesa RALLENTA invece di martellare a ritmo fisso;
//   2. dopo trenta secondi si ARRENDE (restituisce null) invece di restare appesa per sempre —
//      tutti i punti che la chiamano sanno già cosa fare senza nuvola;
//   3. quando la nuvola c'è (o arriva), la si prende SUBITO: rallentare non deve voler dire
//      partire più lenti all'avvio normale, che è il caso di tutti i giorni.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('senza nuvola l\'attesa rallenta, non martella a ritmo fisso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      delete window.fxbtCloud;
      // Si contano i risvegli dei soli timer creati da qui in poi.
      let giri = 0;
      const st = window.setTimeout;
      window.setTimeout = function(fn, ms, ...a){
        return st.call(this, function(){ giri++; return fn.apply(this, arguments); }, ms, ...a);
      };
      waitForFxbtCloud();
      await new Promise(res => st.call(window, res, 1500));
      window.setTimeout = st;
      return {giri};
    });
    // A 30 ms fissi sarebbero una cinquantina in un secondo e mezzo. Col rallentamento sono
    // pochi: il numero esatto non conta, conta che non sia un martello.
    assert.ok(r.giri < 20,
      'in un secondo e mezzo l\'attesa non deve svegliarsi decine di volte: ' + r.giri);
    assert.ok(r.giri > 0, 'ma deve comunque controllare: ' + r.giri);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('dopo trenta secondi si arrende, invece di restare appesa per sempre', async () => {
  // Il tempo si fa scorrere invece di aspettarlo davvero: aspettare trenta secondi in un collaudo
  // vorrebbe dire non farlo girare mai.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      delete window.fxbtCloud;
      const vero = Date.now;
      const p = waitForFxbtCloud();
      // Da adesso l'orologio dice che sono passati 31 secondi.
      Date.now = () => vero.call(Date) + 31000;
      const esito = await Promise.race([
        p,
        new Promise(res => setTimeout(() => res('APPESA'), 3000))
      ]);
      Date.now = vero;
      return {esito: esito === null ? 'null' : String(esito)};
    });
    assert.equal(r.esito, 'null',
      'passati trenta secondi deve restituire null: se resta appesa, chi la aspetta non riparte piu\'');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se la nuvola c\'è già, si prende subito', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      window.fxbtCloud = {uid: 'u1', ready: Promise.resolve()};
      const t0 = performance.now();
      const c = await waitForFxbtCloud();
      return {uid: c && c.uid, ms: performance.now() - t0};
    });
    assert.equal(r.uid, 'u1');
    assert.ok(r.ms < 50, 'nessuna attesa quando la nuvola c\'e\' gia\': ' + r.ms.toFixed(1) + ' ms');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se la nuvola arriva dopo, la si prende lo stesso', async () => {
  // Il caso normale all'avvio: i due script partono in ordine non garantito.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      delete window.fxbtCloud;
      const p = waitForFxbtCloud();
      setTimeout(() => { window.fxbtCloud = {uid: 'tardi', ready: Promise.resolve()}; }, 200);
      const esito = await Promise.race([
        p,
        new Promise(res => setTimeout(() => res({uid: 'MAI'}), 4000))
      ]);
      return {uid: esito && esito.uid};
    });
    assert.equal(r.uid, 'tardi', 'una nuvola che arriva dopo deve essere presa lo stesso');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
