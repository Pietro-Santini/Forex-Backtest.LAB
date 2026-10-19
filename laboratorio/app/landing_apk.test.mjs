// IL SITO NON MANDA A UN DOWNLOAD CHE NON C'E'.
//
// RIFERITO dal proprietario (19 ottobre 2026, dal tablet): «sul sito, il pulsante scarica l'APK, mi
// riporta alla pagina GitHub con 404». Misurato: l'ultima release con l'APK allegato e' la
// v2.0.4-125; dalla v2.0.4-126 le release allegano solo il Setup Windows, mentre index.html punta a
// un indirizzo stabile "latest/download/forexbacktestlab.apk" che quindi risponde 404.
//
// LA REGOLA: il sito chiede all'API quali file ci sono DAVVERO nell'ultima release e, se l'APK non
// c'e', lo dice e toglie quel pulsante. Non inventa un download, non manda a una pagina d'errore.
// Se la rete non risponde, resta il link stabile di sempre (comportamento di prima).
//
// Qui l'API e' finta ma la pagina e' quella vera: si preme il pulsante vero della landing.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {chromium, RADICE} from './aiuti.mjs';

const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

async function apriLandingAndroid(assets){
  const browser = await chromium.launch();
  const contesto = await browser.newContext({viewport:{width:412, height:900}, userAgent:UA_ANDROID});
  await contesto.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgentData', {configurable:true,
      get: () => ({platform:'Android', mobile:true, brands:[]})});
  });
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  await pagina.route('**', r => {
    const u = r.request().url();
    if (u.startsWith('file://')) return r.continue();
    if (u.includes('api.github.com')) {
      return r.fulfill({status:200, contentType:'application/json',
        body: JSON.stringify({tag_name:'v2.0.6', assets})});
    }
    return r.abort();   // Tailwind, font, GitHub: niente rete
  });
  await pagina.goto('file://' + path.join(RADICE, 'index.html'), {waitUntil:'domcontentloaded'});
  return {browser, pagina, errori};
}

async function apriRiquadroAndroid(pagina){
  await pagina.getByRole('button', {name:/Avvia Prova Gratuita di 7 Giorni/}).first().click();
  await pagina.getByRole('button', {name:'Android'}).first().click();
  await pagina.waitForSelector('#fblInstallBox', {timeout:5000});
}

test("se l'ultima release non ha l'APK, il sito lo dice e non offre quel download", async () => {
  const {browser, pagina, errori} = await apriLandingAndroid([{name:'ForexBacktestLAB_Setup.exe'}]);
  try {
    await apriRiquadroAndroid(pagina);
    await pagina.waitForFunction(
      () => /non ha ancora/.test(document.querySelector('#fblInstallBox-t')?.textContent || ''),
      {timeout:5000});
    const href = await pagina.locator('#fblInstallBox a').evaluateAll(as => as.map(a => a.getAttribute('href')));
    assert.ok(!href.some(h => /\.apk/i.test(h || '')),
      'il sito manda ancora al download inesistente: ' + href.join(' | '));
    assert.ok(await pagina.locator('#fblInstallBox a', {hasText:'Continua col sito web'}).count() > 0,
      'senza il download si resta bloccati: manca il modo di proseguire');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("quando l'APK c'e' davvero, il download resta al suo posto", async () => {
  const {browser, pagina, errori} = await apriLandingAndroid([
    {name:'forexbacktestlab.apk', browser_download_url:'https://example.invalid/forexbacktestlab.apk'},
    {name:'ForexBacktestLAB_Setup.exe'}]);
  try {
    await apriRiquadroAndroid(pagina);
    // Il controllo gira e non deve togliere niente.
    await pagina.waitForTimeout(400);
    const href = await pagina.locator('#fblInstallBox a').evaluateAll(as => as.map(a => a.getAttribute('href')));
    assert.ok(href.some(h => /\.apk/i.test(h || '')),
      'con l\'APK presente il download e\' sparito: ' + href.join(' | '));
    const testo = await pagina.locator('#fblInstallBox-t').textContent();
    assert.ok(!/non ha ancora/.test(testo), 'avviso comparso senza motivo: ' + testo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
