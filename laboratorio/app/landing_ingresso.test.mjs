// I PULSANTI VERI DELLA LANDING — premuti davvero, in un browser vero.
//
// Il test accanto (porta_ingresso.test.mjs) prova il comportamento della porta; questo prova che i
// pulsanti di index.html LE PASSANO davvero per la porta, e che non se ne vanno piu' dritti a
// login.html come facevano prima.
//
// Si apre con la piattaforma DICHIARATA (Windows), come fanno gli altri test del banco: cosi' il
// risultato e' lo stesso sul computer e su GitHub.
//
// Caso Windows: il tentativo di aprire l'app passa da un iframe nascosto e, non essendoci nessuna
// app a rispondere, dopo l'attesa compaure il riquadro. Si controlla anche il testo di quel
// riquadro e dove porta il "continua": e' li' che si vede se il pulsante ha conservato la sua
// destinazione.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {chromium, RADICE} from './aiuti.mjs';

const UA_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const UA_IPHONE  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function apriLanding(userAgent){
  const browser = await chromium.launch();
  const contesto = await browser.newContext({viewport:{width:1366, height:900}, userAgent});
  await contesto.addInitScript(([p]) => {
    Object.defineProperty(navigator, 'userAgentData', {configurable:true,
      get: () => (p === null ? undefined : {platform: p, mobile: false, brands: []})});
  }, ['Windows']);
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  // Niente rete: la pagina deve cavarsela da sola (Tailwind e i font arrivano dal CDN).
  await pagina.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pagina.goto('file://' + path.join(RADICE, 'index.html'), {waitUntil:'domcontentloaded'});
  return {browser, pagina, errori};
}

// Il riquadro compare dopo un'attesa voluta (la porta aspetta per vedere se l'app risponde).
const RIQUADRO = '#fblInstallBox';

test("il pulsante della prova gratuita passa dalla porta e offre l'installazione", async () => {
  const {browser, pagina} = await apriLanding(UA_WINDOWS);
  try {
    assert.equal(await pagina.locator(RIQUADRO).count(), 0, 'riquadro presente prima di premere');
    await pagina.getByRole('button', {name: /Avvia Prova Gratuita di 7 Giorni/}).first().click();
    await pagina.waitForSelector(RIQUADRO, {timeout: 5000});
    // Il pulsante NON deve piu' portare via dalla landing verso login.html.
    assert.ok(pagina.url().includes('index.html'), 'la pagina se n\'e\' andata: ' + pagina.url());
    const pulsanti = await pagina.locator('#fblInstallBox a').allTextContents();
    assert.ok(pulsanti.some(t => /installer/i.test(t)), 'manca il download dell\'installer');
    const continua = await pagina.locator('#fblInstallBox a', {hasText:'Continua col sito web'}).getAttribute('href');
    assert.equal(continua, 'login.html', 'chi non installa non arriva dove voleva (login.html)');
  } finally { await browser.close(); }
});

test('il pulsante "Apri Simulatore" porta all\'installazione e, se non si installa, ad app.html', async () => {
  const {browser, pagina} = await apriLanding(UA_WINDOWS);
  try {
    await pagina.getByRole('button', {name: /Apri Simulatore/}).first().click();
    await pagina.waitForSelector(RIQUADRO, {timeout: 5000});
    assert.ok(pagina.url().includes('index.html'));
    const continua = await pagina.locator('#fblInstallBox a', {hasText:'Continua col sito web'}).getAttribute('href');
    assert.equal(continua, 'app.html');
  } finally { await browser.close(); }
});

test("il pulsante dell'abbonamento conserva l'intenzione d'acquisto e la porta avanti", async () => {
  const {browser, pagina} = await apriLanding(UA_WINDOWS);
  try {
    await pagina.getByRole('button', {name: /Oppure abbonati subito/}).first().click();
    await pagina.waitForSelector(RIQUADRO, {timeout: 5000});
    const intenzione = await pagina.evaluate(() => localStorage.getItem('fxbt_buy_license_intent'));
    assert.ok(intenzione, 'l\'intenzione d\'acquisto non e\' stata registrata');
    const continua = await pagina.locator('#fblInstallBox a', {hasText:'Continua col sito web'}).getAttribute('href');
    assert.equal(continua, 'app.html?buy=license');
  } finally { await browser.close(); }
});

test('su iPhone non si offre un download che non esiste', async () => {
  const {browser, pagina} = await apriLanding(UA_IPHONE);
  try {
    await pagina.getByRole('button', {name: /Avvia Prova Gratuita di 7 Giorni/}).first().click();
    await pagina.waitForSelector(RIQUADRO, {timeout: 5000});
    const pulsanti = (await pagina.locator('#fblInstallBox a').allTextContents()).join(' | ');
    assert.ok(!/apk|installer/i.test(pulsanti), 'propone un download inesistente: ' + pulsanti);
  } finally { await browser.close(); }
});
