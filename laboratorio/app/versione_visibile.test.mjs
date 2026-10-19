// LA VERSIONE SI DEVE VEDERE — e deve essere quella vera, non una scritta a mano.
//
// RICHIESTO dal proprietario (19 ottobre 2026): «dopo questo aggiornamento... io ero alla 2.0.5 e
// non mi e' apparso il pulsante di aggiornare la pagina... non so adesso se e' la versione giusta
// 2.0.6 o e' rimasta quella di prima. Magari nelle impostazioni generali mettiamo una nota di
// rilascio che fa vedere la versione che e' presente sul dispositivo, almeno uno cosi' si fa un'idea».
//
// Due difetti misurati quel giorno, entrambi qui sotto:
//  1. il controllo aggiornamenti girava ogni 24 ore: un'app lasciata aperta non si accorgeva di una
//     release nuova fino al giorno dopo;
//  2. la versione non si vedeva da nessuna parte.
//
// Il test NON cerca una stringa nel sorgente: prende il blocco VERSIONE VISIBILE pubblicato, lo
// esegue, e guarda cosa risponde con cache e rete finte. Poi apre l'app vera e guarda il pannello.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium, RADICE, apriApp} from './aiuti.mjs';

const APP = path.join(RADICE, 'app.html');

function leggiBlocco(){
  const html = fs.readFileSync(APP, 'utf8');
  const a = html.indexOf('// VERSIONE VISIBILE: INIZIO');
  const b = html.indexOf('// VERSIONE VISIBILE: FINE');
  assert.ok(a >= 0 && b > a, 'in app.html manca il blocco VERSIONE VISIBILE');
  return html.slice(a, b);
}

const BLOCCO = leggiBlocco();

function banco({chiaviCache, swjs, cacheRotta}){
  const caches = {
    keys: async () => {
      if (cacheRotta) throw new Error('cache negata');
      return chiaviCache || [];
    },
  };
  const fetchFinto = async (url) => {
    if (String(url).includes('sw.js')) {
      if (swjs == null) throw new Error('rete assente');
      return {ok:true, text: async () => swjs};
    }
    throw new Error('rete assente');
  };
  const f = new Function('caches', 'fetch', BLOCCO +
    '\nreturn {fblConfrontaVersioni, fblVersioneDaChiavi, fblVersioneInstallata};')(caches, fetchFinto);
  return f;
}

test('il confronto delle versioni e\' numerico, non alfabetico', () => {
  const f = banco({});
  assert.equal(f.fblConfrontaVersioni('2.0.10', '2.0.9'), 1, '2.0.10 e\' piu\' nuova di 2.0.9');
  assert.equal(f.fblConfrontaVersioni('2.1', '2.0.9'), 1);
  assert.equal(f.fblConfrontaVersioni('2.0.6', '2.0.6'), 0);
  assert.equal(f.fblConfrontaVersioni('1.9.9', '2.0.0'), -1);
});

test('la versione esce dalla cache del service worker, e non da una scritta a mano', () => {
  const f = banco({chiaviCache:['forex-backtest-lab-v2.0.5', 'forex-backtest-lab-v2.0.10', 'qualcosa-altro']});
  assert.equal(f.fblVersioneDaChiavi(['forex-backtest-lab-v2.0.5']), '2.0.5');
  assert.equal(f.fblVersioneDaChiavi(['roba', 'forex-backtest-lab-v2.0.9', 'forex-backtest-lab-v2.0.10']), '2.0.10',
    'con due pacchetti salvati deve vincere il piu\' nuovo, non l\'ultimo scritto');
  assert.equal(f.fblVersioneDaChiavi([]), '', 'senza pacchetti non si inventa un numero');
});

test('senza cache del service worker la versione si legge dal pacchetto sul dispositivo', async () => {
  const f = banco({cacheRotta:true, swjs:'const CACHE_NAME = "forex-backtest-lab-v2.0.7";'});
  assert.equal(await f.fblVersioneInstallata(), '2.0.7');
});

test('senza cache e senza pacchetto la versione resta sconosciuta, senza errori', async () => {
  const f = banco({cacheRotta:true, swjs:null});
  assert.equal(await f.fblVersioneInstallata(), '');
});

// ---------------------------------------------------------------- l'app vera

const UA_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

async function apriConApi(releaseFinta){
  const browser = await chromium.launch();
  const contesto = await browser.newContext({viewport:{width:1300, height:900}, userAgent:UA_WINDOWS});
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  await pagina.route('**', r => {
    const u = r.request().url();
    if (u.startsWith('file://')) return r.continue();
    if (u.includes('api.github.com')) {
      return r.fulfill({status:200, contentType:'application/json', body: JSON.stringify(releaseFinta)});
    }
    return r.abort();
  });
  await pagina.goto('file://' + APP, {waitUntil:'domcontentloaded'});
  await pagina.waitForTimeout(2500);
  await pagina.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay').forEach(el => el.style.display='none'));
  return {browser, pagina, errori};
}

async function apriSchedaVersione(pagina){
  await pagina.evaluate(() => document.getElementById('generalSettingsBtn').click());
  await pagina.waitForTimeout(200);
  await pagina.click('#genSettingsTabVersione');
}

test("il pannello dice la versione installata e quella pubblicata, e offre l'aggiornamento", async () => {
  const {browser, pagina, errori} = await apriConApi({
    tag_name:'v2.0.7',
    body:'Correzioni della versione 2.0.7.',
    assets:[{name:'ForexBacktestLAB_Setup.exe', browser_download_url:'https://example.invalid/setup.exe'}]});
  try {
    // Il pacchetto che sta servendo la pagina e' la 2.0.6: il pannello deve dirlo.
    await pagina.evaluate(() => caches.open('forex-backtest-lab-v2.0.6'));
    await apriSchedaVersione(pagina);
    await pagina.waitForFunction(
      () => document.getElementById('fblVerRemota')?.textContent?.includes('2.0.7'), {timeout:5000});

    const installata = await pagina.locator('#fblVerInstallata').textContent();
    const remota = await pagina.locator('#fblVerRemota').textContent();
    const stato = await pagina.locator('#fblVerStato').textContent();
    const note = await pagina.locator('#fblVerNote').textContent();
    const aggiorna = await pagina.locator('#fblVerAggiornaBtn').isVisible();

    assert.match(installata, /2\.0\.6/, 'la versione installata mostrata non e\' quella vera: ' + installata);
    assert.match(remota, /2\.0\.7/, 'manca la versione pubblicata');
    assert.match(stato, /nuova/, 'non avvisa che c\'e\' una versione nuova: ' + stato);
    assert.match(note, /2\.0\.7/, 'le note della release non si vedono: ' + note);
    assert.equal(aggiorna, true, 'con una versione nuova il pulsante Aggiorna ora deve comparire');
    // Il pulsante deve comparire anche in alto, non solo dentro il pannello.
    assert.equal(await pagina.locator('#fblAggiornaBtn').isVisible(), true,
      'il pulsante Aggiorna in alto non e\' comparso');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('quando il dispositivo e\' gia\' all\'ultima versione lo dice, senza offrire aggiornamenti', async () => {
  const {browser, pagina, errori} = await apriConApi({tag_name:'v2.0.7', body:'', assets:[]});
  try {
    await pagina.evaluate(() => caches.open('forex-backtest-lab-v2.0.7'));
    await apriSchedaVersione(pagina);
    await pagina.waitForFunction(
      () => document.getElementById('fblVerRemota')?.textContent?.includes('2.0.7'), {timeout:5000});
    const stato = await pagina.locator('#fblVerStato').textContent();
    assert.match(stato, /ultima/, 'non riconosce di essere aggiornato: ' + stato);
    assert.equal(await pagina.locator('#fblVerAggiornaBtn').isVisible(), false,
      'offre un aggiornamento che non serve');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza rete il pannello lo dice invece di inventare una versione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await apriSchedaVersione(pagina);
    await pagina.waitForFunction(
      () => document.getElementById('fblVerRemota')?.textContent?.includes('non disponibile'), {timeout:5000});
    const stato = await pagina.locator('#fblVerStato').textContent();
    assert.match(stato, /connessione|limite/, 'non spiega perche\' non c\'e\' il dato: ' + stato);
    assert.equal(await pagina.locator('#fblVerAggiornaBtn').isVisible(), false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
