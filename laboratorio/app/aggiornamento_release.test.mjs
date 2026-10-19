// AGGIORNAMENTO DA GITHUB RELEASES: il pulsante «Aggiorna» nell'header deve apparire SOLO
// quando esce una release NUOVA, e premendolo deve partire il download del pacchetto giusto
// per il dispositivo (APK su Android, EXE su Windows).
//
// Richiesto dal proprietario (18 ottobre 2026): «deve apparire il pulsante aggiorna ad ogni
// nuovo aggiornamento che facciamo su GitHub con il dovuto pacchetto di installazione».
//
// Il comportamento, misurato sulla pagina vera in Chromium con una release finta (l'API di
// GitHub è intercettata, niente rete):
//   1. al PRIMO avvio (nessun tag annotato) il tag della release viene salvato in silenzio e
//      il pulsante resta nascosto: chi ha appena installato non deve vedere un falso
//      «aggiorna disponibile»;
//   2. quando il tag dell'ultima release DIVERGE da quello annotato, il pulsante appare;
//   3. premendolo parte il download dell'asset della release (apk su Android, exe su
//      Windows) e il tag viene annotato solo DOPO il click, cosi' un download fallito lascia
//      il pulsante disponibile.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const RELEASE_FINTA = {
  tag_name: 'v9.9.9-1',
  assets: [
    {name: 'ForexBacktestLAB_Setup.exe', browser_download_url: 'https://esempio.test/Setup.exe'},
    {name: 'forexbacktestlab.apk', browser_download_url: 'https://esempio.test/app.apk'},
  ],
};

// Apre la pagina vera con l'API di GitHub risolta da una release finta e con il download
// intercettato: niente rete, niente installazioni vere sul banco di prova.
async function apriConRelease({tagInLocale = null, userAgent} = {}) {
  const {browser, pagina, errori} = await apriApp(userAgent ? {userAgent} : {});
  // La route registrata per ultima vince su quella di apriApp che blocca la rete.
  await pagina.route('**/api.github.com/**', r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(RELEASE_FINTA),
  }));
  // Un click sul download non deve davvero scaricare: si registra l'indirizzo e basta.
  await pagina.evaluate(() => {
    window.__clicDownload = [];
    HTMLAnchorElement.prototype.click = function(){
      if(this.download) window.__clicDownload.push(this.href);
    };
  });
  // Si riparte da uno stato pulito: il tag annotato e' deciso dal test, non dal momento
  // in cui la pagina ha eseguito il suo primo controllo automatico.
  await pagina.evaluate((tag) => {
    try{ if(tag) localStorage.setItem('fbl_rel_vista', tag); else localStorage.removeItem('fbl_rel_vista'); }catch(e){}
  }, tagInLocale);
  const chiama = () => pagina.evaluate(async () => {
    await fblControllaAggiornamento();
    return {
      nascosto: document.getElementById('fblAggiornaBtn').style.display === 'none',
      tag: (() => { try{ return localStorage.getItem('fbl_rel_vista'); }catch(e){ return null; } })(),
    };
  });
  return {browser, pagina, errori, chiama};
}

test('al primo avvio il tag della release si annota in silenzio e il pulsante resta nascosto', async () => {
  const {browser, chiama} = await apriConRelease();
  try {
    const stato = await chiama();
    assert.equal(stato.nascosto, true,
      'chi ha appena installato l\'app non deve vedere «aggiorna disponibile» al primo avvio');
    assert.equal(stato.tag, 'v9.9.9-1',
      'il tag dell\'ultima release va annotato al primo avvio, sennò il prossimo controllo non ha nulla da confrontare');
  } finally { await browser.close(); }
});

test('con un tag VECCHIO annotato il pulsante appare', async () => {
  const {browser, chiama} = await apriConRelease({tagInLocale: 'v0.0.1-1'});
  try {
    const stato = await chiama();
    assert.equal(stato.nascosto, false,
      'una release nuova rispetto a quella vista deve far apparire il pulsante «Aggiorna»');
  } finally { await browser.close(); }
});

test('con lo STESSO tag annotato il pulsante resta nascosto (nessun falso avviso)', async () => {
  const {browser, chiama} = await apriConRelease({tagInLocale: 'v9.9.9-1'});
  try {
    const stato = await chiama();
    assert.equal(stato.nascosto, true,
      'se la release è già quella vista il pulsante non deve disturbare');
  } finally { await browser.close(); }
});

test('su Windows il pulsante scarica l\'EXE della release e annota il tag', async () => {
  const {browser, pagina, chiama} = await apriConRelease({tagInLocale: 'v0.0.1-1'});
  try {
    await chiama();
    await pagina.click('#fblAggiornaBtn');
    await pagina.waitForFunction(() => window.__clicDownload.length > 0, {timeout: 3000});
    const scaricati = await pagina.evaluate(() => window.__clicDownload);
    assert.ok(scaricati.some(u => u.endsWith('.exe')),
      'su Windows deve partire il download dell\'installatore .exe della release, non dell\'apk');
    const tag = await pagina.evaluate(() => localStorage.getItem('fbl_rel_vista'));
    assert.equal(tag, 'v9.9.9-1',
      'il tag va annotato solo dopo che il download è partito, cosi un errore lascia il pulsante disponibile');
  } finally { await browser.close(); }
});

test('su Android il pulsante scarica l\'APK della release', async () => {
  const {browser, pagina, chiama} = await apriConRelease({
    tagInLocale: 'v0.0.1-1',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
  });
  try {
    await chiama();
    await pagina.click('#fblAggiornaBtn');
    await pagina.waitForFunction(() => window.__clicDownload.length > 0, {timeout: 3000});
    const scaricati = await pagina.evaluate(() => window.__clicDownload);
    assert.ok(scaricati.some(u => u.endsWith('.apk')),
      'sul telefono deve partire il download dell\'apk della release');
  } finally { await browser.close(); }
});
