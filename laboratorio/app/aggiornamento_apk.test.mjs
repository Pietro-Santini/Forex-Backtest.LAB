// L'APK DEVE RICEVERE IL PACCHETTO DI AGGIORNAMENTO.
//
// SEGNALATO dal proprietario (20 ottobre 2026): "l'applicazione sui dispositivi mobili
// non riesce a ricevere il pacchetto di aggiornamento della versione".
//
// LA CAUSA, misurata: dentro l'APK la pagina gira in una WebView (Capacitor), e in una
// WebView il trucco del download - un <a href="..." download> su cui si fa click -
// NON scarica niente: il file non parte e l'utente resta con la versione vecchia senza
// accorgersene. Quello che invece funziona e' la NAVIGAZIONE verso l'indirizzo esterno:
// Capacitor (che non ha l'host fra quelli ammessi dentro l'app) apre il browser di
// sistema, li' il pacchetto viene scaricato davvero e Android chiede se installarlo.
//
// Il test guarda il COMPORTAMENTO, non il sorgente:
//   1. nell'APK il pacchetto si apre come navigazione (link SENZA l'attributo "download");
//      nel browser normale invece si scarica (link CON "download"): la WebView e' l'unica
//      in cui il download diretto non funziona;
//   2. nell'APK il tag della release NON viene annotato e l'app NON si chiude: l'utente
//      deve ancora scaricare e installare, e il pulsante "Aggiorna" deve restare li';
//   3. il numero di build nel tag ("v2.0.7-131") non deve far sembrare nuova una
//      versione che e' gia' installata: subito dopo l'installazione non deve comparire
//      un falso "Aggiorna".
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

// Apre la pagina vera con l'API di GitHub risolta da una release finta.
// `capacitor:true` imita l'APK: dentro la WebView c'e' l'oggetto Capacitor che
// il ponte inietta, ed e' quello che l'app usa per capire di essere nell'APK.
async function apriConRelease({tagInLocale = null, userAgent, capacitor = false} = {}) {
  const {browser, pagina, errori} = await apriApp(userAgent ? {userAgent} : {});
  await pagina.route('**/api.github.com/**', r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(RELEASE_FINTA),
  }));
  // I click sui link vengono registrati, non eseguiti: sul banco di prova non si
  // scarica niente. Si registra ANCHE se il link aveva l'attributo "download",
  // che e' la differenza fra il browser (scarica) e la WebView (non scarica).
  await pagina.evaluate((cap) => {
    window.__aperti = [];
    HTMLAnchorElement.prototype.click = function () {
      window.__aperti.push({href: this.href, download: this.download || ''});
    };
    if (cap) {
      window.Capacitor = {getPlatform: () => 'android', isNativePlatform: () => true};
    }
  }, capacitor);
  await pagina.evaluate((tag) => {
    try { if (tag) localStorage.setItem('fbl_rel_vista', tag); else localStorage.removeItem('fbl_rel_vista'); } catch (e) {}
  }, tagInLocale);
  return {browser, pagina, errori};
}

const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

test('nell\'APK il pacchetto si apre come navigazione: e\' l\'unico modo che la WebView scarichi', async () => {
  const {browser, pagina, errori} = await apriConRelease({
    tagInLocale: 'v0.0.1-1', userAgent: UA_ANDROID, capacitor: true,
  });
  try {
    await pagina.evaluate(async () => { await fblControllaAggiornamento(); });
    await pagina.click('#fblAggiornaBtn');
    await pagina.waitForFunction(() => window.__aperti.length > 0, {timeout: 5000});
    const aperti = await pagina.evaluate(() => window.__aperti);
    const apk = aperti.find(a => a.href.endsWith('.apk'));
    assert.ok(apk, 'nell\'APK deve partire il pacchetto .apk della release: ' + JSON.stringify(aperti));
    assert.equal(apk.download, '',
      'il link nell\'APK NON puo\' avere l\'attributo "download": nella WebView un download '
      + 'cosi\' non parte mai, e il pacchetto non arriva al dispositivo');
  } finally { await browser.close(); }
});

test('nell\'APK il tag non si annota e l\'app non si chiude: l\'utente deve ancora installare', async () => {
  const {browser, pagina} = await apriConRelease({
    tagInLocale: 'v0.0.1-1', userAgent: UA_ANDROID, capacitor: true,
  });
  try {
    await pagina.evaluate(async () => { await fblControllaAggiornamento(); });
    await pagina.click('#fblAggiornaBtn');
    await pagina.waitForFunction(() => window.__aperti.length > 0, {timeout: 5000});
    await pagina.waitForTimeout(300);
    const stato = await pagina.evaluate(() => ({
      tag: (() => { try { return localStorage.getItem('fbl_rel_vista'); } catch (e) { return null; } })(),
      pulsante: (() => { const b = document.getElementById('fblAggiornaBtn'); return b ? {disabilitato: b.disabled, testo: b.textContent} : null; })(),
    }));
    assert.equal(stato.tag, 'v0.0.1-1',
      'il tag della release si annota solo DOPO l\'installazione: se si annotasse subito, '
      + 'il pulsante "Aggiorna" sparirebbe e l\'utente resterebbe con la versione veccia');
    assert.equal(stato.pulsante.disabilitato, false,
      'il pulsante "Aggiorna" deve restare premibile: il pacchetto si scarica nel browser, '
      + 'ma fino a quando non e\' installato l\'aggiornamento non e\' fatto');
  } finally { await browser.close(); }
});

test('nel browser normale il pacchetto si SCARICA (col suo attributo "download")', async () => {
  const {browser, pagina} = await apriConRelease({tagInLocale: 'v0.0.1-1', userAgent: UA_ANDROID});
  try {
    await pagina.evaluate(async () => { await fblControllaAggiornamento(); });
    await pagina.click('#fblAggiornaBtn');
    await pagina.waitForFunction(() => window.__aperti.length > 0, {timeout: 5000});
    const aperti = await pagina.evaluate(() => window.__aperti);
    const apk = aperti.find(a => a.href.endsWith('.apk'));
    assert.ok(apk, 'su Android il pacchetto scaricato deve essere l\'apk: ' + JSON.stringify(aperti));
    assert.notEqual(apk.download, '',
      'nel browser (e non nella WebView) il download diretto funziona: va tenuto');
  } finally { await browser.close(); }
});

test('il numero di build nel tag non fa sembrare nuova la versione gia\' installata', async () => {
  const {browser, pagina} = await apriConRelease({tagInLocale: 'v0.0.1-1'});
  try {
    // La versione installata e' la stessa della release (2.0.7), ma il tag porta
    // anche il numero di build ("v2.0.7-131"): non e' una versione nuova.
    const nuova = await pagina.evaluate(async () => {
      const release = {tag_name: 'v2.0.7-131'};
      const installata = '2.0.7';
      return fblConfrontaVersioni(fblVersioneDaTag(release.tag_name), installata) > 0;
    });
    assert.equal(nuova, false,
      'appena installata la 2.0.7 non deve comparire un falso "Aggiorna": il "-131" del tag '
      + 'e\' il numero di build della release, non un numero di versione');
    const versione = await pagina.evaluate(() => fblVersioneDaTag('v2.0.7-131'));
    assert.equal(versione, '2.0.7', 'dal tag si legge il numero di versione, senza il build');
  } finally { await browser.close(); }
});
