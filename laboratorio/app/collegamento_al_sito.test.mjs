// IL COLLEGAMENTO IN ALTO A SINISTRA DELL'APP DEVE PORTARE AL SITO VERO.
//
// Segnalato dal proprietario (17 ottobre 2026): «dentro l'APK il collegamento in alto a sinistra
// verso index.html deve funzionare e riportare alla pagina web; oggi da' "pagina non
// raggiungibile"».
//
// Causa misurata: dentro l'APK la WebView serve i file da https://localhost/, quindi "index.html"
// non e' la pagina del sito ma il bootstrap locale da 660 byte (www/index.html). Peggio: la
// navigazione e' l'unico caso in cui la richiesta del service worker NON arriva al server locale, e
// senza copia in cache veniva rifiutata -> pagina di errore del sistema.
//
// Correzione: il collegamento punta al sito in modo ASSOLUTO. Dal telefono il sistema apre il
// browser (com'e' giusto: l'app non puo' e non deve mostrare il sito dentro di se'); dal computer
// resta nel sito.
//
// Questo test NON cerca una stringa nel sorgente: apre app.html, PREME il collegamento e guarda
// dove parte la navigazione.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SITO = 'https://pietro-santini.github.io/Forex-Backtest.LAB/';

test('il collegamento in alto a sinistra porta al sito vero, non alla pagina locale', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const link = pagina.locator('header a[title*="Torna al sito"]').first();
    assert.equal(await link.count(), 1, 'il collegamento "torna al sito" non c\'e\'');

    const href = await link.getAttribute('href');
    assert.ok(href && href.startsWith(SITO),
      'il collegamento non punta al sito: ' + href);
    assert.ok(!/index\.html/.test(href),
      'il collegamento punta ancora a index.html: dentro l\'APK e\' il bootstrap locale, non il sito');

    // E ora lo si preme davvero: la navigazione tentata deve andare al sito.
    const tentate = [];
    pagina.on('request', r => { if (r.resourceType() === 'document') tentate.push(r.url()); });
    await link.click({force: true});
    await pagina.waitForTimeout(900);

    assert.ok(tentate.some(u => u.startsWith(SITO)),
      'premuto il collegamento non e\' partita nessuna navigazione verso il sito: ' +
      (tentate.join(' | ') || 'nessuna navigazione'));
    assert.ok(!tentate.some(u => /\/index\.html(\?|$)/.test(u)),
      'la navigazione tentata e\' ancora quella locale (index.html)');
  } finally {
    await browser.close();
  }
});
