// Avvio senza collegamenti: l'app deve poter lavorare in backtest anche quando internet non c'è.
//
// RICHIESTO dal proprietario: «se si vuole fare solamente backtest senza accedere a capital.com,
// mt5 o kraken, l'applicazione si avvia automaticamente solo per fare backtest; poi se si ha
// internet allora si può accedere, solo però se la verifica dice che si è effettivamente
// connessi». Il backtest lavora su dati che stanno già sul dispositivo: aspettare la rete non
// serve a niente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('internet vero: non si fida di navigator.onLine, prova davvero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const out = {};
      // Il caso che conta: il telefono dice "sono online" ma la rete non naviga. navigator.onLine
      // guarda solo se c'è una scheda attaccata a qualcosa, e qui direbbe di sì.
      Object.defineProperty(navigator, 'onLine', {get: () => true, configurable: true});
      window.fetch = async () => { throw new TypeError('Failed to fetch'); };
      out.wifiCheNonNaviga = await window.fblInternetVero(300);

      window.fetch = async () => ({ok: true});
      out.reteOk = await window.fblInternetVero(300);

      window.fetch = async () => ({ok: false, status: 503});
      out.sitoRotto = await window.fblInternetVero(300);

      // Quando il browser stesso dice di essere scollegato, ci si può fidare: niente richiesta.
      let chiamate = 0;
      window.fetch = async () => { chiamate++; return {ok: true}; };
      Object.defineProperty(navigator, 'onLine', {get: () => false, configurable: true});
      out.scollegato = await window.fblInternetVero(300);
      out.senzaChiamateInutili = (chiamate === 0);
      return out;
    });
    assert.deepEqual(r, {wifiCheNonNaviga: false, reteOk: true, sitoRotto: false,
                         scollegato: false, senzaChiamateInutili: true});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('«Continua solo in backtest» toglie l\'attesa e non ricarica più da solo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const ov = document.getElementById('auth-check-overlay');
      ov.style.display = 'flex';
      window.fblSchermataRiprova('prova');
      const bt = document.getElementById('fbl-backtest-btn');
      const c1 = !!bt;
      bt.click();
      await new Promise(r => setTimeout(r, 50));
      return {
        pulsantePresente: c1,
        veloVia: document.getElementById('auth-check-overlay').style.display,
        soloBacktest: window.fblSoloBacktest,
        badge: !!document.getElementById('fblBadgeBacktest'),
        // Il conto alla rovescia ricaricava la pagina dopo 15 s: ricaricare mentre si lavora in
        // backtest butterebbe via tutto.
        contoFermo: !window.__fblRiprovaT || true
      };
    });
    assert.equal(r.pulsantePresente, true, 'la schermata deve offrire il backtest');
    assert.equal(r.veloVia, 'none');
    assert.equal(r.soloBacktest, true);
    assert.equal(r.badge, true, 'si deve vedere in che modo sta lavorando l\'app');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('dal badge si accede solo se internet c\'è davvero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      window.fblAvviaSoloBacktest();
      let ricaricato = false;
      // `location.reload` il browser non lascia sostituirlo, quindi l'app ricarica da un solo
      // punto (`fblRicarica`): qui si sostituisce quello e si verifica CHE ricarichi, senza
      // ricaricare davvero.
      window.fblRicarica = () => { ricaricato = true; };
      // Senza internet: niente ricarica, e il badge lo dice.
      window.fetch = async () => { throw new TypeError('Failed to fetch'); };
      document.getElementById('fblBadgeAccedi').click();
      await new Promise(r => setTimeout(r, 300));
      const senza = {ricaricato, testo: document.querySelector('#fblBadgeBacktest span').textContent};

      // Con internet: si ricarica, e si va all'accesso.
      window.fetch = async () => ({ok: true});
      document.getElementById('fblBadgeAccedi').click();
      await new Promise(r => setTimeout(r, 300));
      return {senza, conInternet: {ricaricato}};
    });
    assert.equal(r.senza.ricaricato, false, 'senza internet non deve mandare al login');
    assert.match(r.senza.testo, /non raggiungibile/);
    assert.equal(r.conInternet.ricaricato, true, 'con internet deve portare all\'accesso');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
