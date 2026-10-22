// IL PACCHETTO DI INSTALLAZIONE NON SI SCARICA A OGNI VERSIONE.
//
// SEGNALATO dal proprietario (22 ottobre 2026): «30-40 file nella cartella Download invece di
// uno sostituito». La catena, tutta vera: ogni release pubblica un Setup nuovo -> il pulsante
// «Aggiorna» lo scarica -> il browser di sistema lo mette in Download con lo stesso nome e un
// suffisso (1), (2), (3)...
//
// IL DIFETTO NON E' DEL BROWSER: una pagina web non puo' sostituire un file nella cartella
// dell'utente (non esiste un'API che lo permetta) e il nome con il suffisso lo mette il
// browser, non l'app. IL DIFETTO E' NOSTRO: il pulsante scarica TUTTO il pacchetto anche
// quando non serve niente di tutto.
//
// LA MISURA: dal 22 ottobre il ponte scarica da se' una COPIA AGGIORNATA di app.html e sw.js e
// serve quella, invece di quella congelata dentro l'eseguibile. Lo dichiara in /health, nel
// campo app.da. Quando e' cosi' il Setup non porterebbe niente di nuovo: scaricarlo e' solo un
// file in piu'.
//
// IL TEST MISURA IL COMPORTAMENTO: clicca «Aggiorna ora» e guarda SE PARTE UN DOWNLOAD DEL
// PACCHETTO OPPURE UNA RICARICA DELLA PAGINA. Non legge il sorgente: un test che cerca una
// stringa nel codice dimostra che l'hai scritto, non che serve.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const RELEASE_FINTA = {
  tag_name: 'v99.0.0',
  body: 'release di prova',
  assets: [
    {name: 'ForexBacktestLAB_Setup.exe', browser_download_url: 'https://esempio.test/Setup.exe'},
    {name: 'forexbacktestlab.apk', browser_download_url: 'https://esempio.test/app.apk'},
  ],
};
// Un dispositivo che non e' un computer: niente Setup, niente APK.
const UA_NON_COMPUTER = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

// Apre la pagina vera con l'API di GitHub risolta da una release finta e il ponte locale che
// risponde come gli si dice: niente rete, niente installazioni vere sul banco di prova.
//   salute = {versione, da}  -> il ponte dice quale copia dell'app sta servendo
//   salute = null            -> il ponte non risponde (il computer dove il programma non parte)
async function apriConPonte({salute, userAgent} = {}) {
  const {browser, pagina, errori} = await apriApp(userAgent ? {userAgent} : {});
  // Quante volte e' stato chiesto al ponte di riscaricare l'app: se non lo si chiede, la
  // ricarica darebbe ancora la copia vecchia.
  const chiesti = {aggiorna: 0};
  await pagina.route(u => u.host.indexOf('api.github.com') >= 0, r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(RELEASE_FINTA),
  }));
  await pagina.route(u => u.pathname.endsWith('/health'), r => {
    if(!salute) return r.abort();
    return r.fulfill({status: 200, contentType: 'application/json',
      body: JSON.stringify({status: 'ok', app: salute})});
  });
  await pagina.route(u => u.pathname.endsWith('/aggiorna-app'), r => {
    chiesti.aggiorna++;
    return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({ok: true})});
  });
  // Un click sul download non deve davvero scaricare: si registra l'indirizzo e basta.
  await pagina.evaluate(() => {
    window.__clic = [];
    window.__ricaricato = 0;
    HTMLAnchorElement.prototype.click = function(){
      window.__clic.push(this.getAttribute('href') || '');
    };
    // La ricarica della pagina: si conta, ma non si ricarica davvero (il collaudo non deve
    // ricaricare la pagina del test).
    window.fblRicaricaPagina = function(){ window.__ricaricato++; };
  });
  return {browser, pagina, errori, chiesti};
}

// Prepara il pannello versione (cosi' il pulsante «Aggiorna ora» esiste) e poi lo preme.
async function aggiorna(pagina) {
  await pagina.evaluate(() => fblAggiornaPannelloVersione(true));
  await pagina.evaluate(() => document.getElementById('fblVerAggiornaBtn').click());
}

test('sul computer con il programma che aggiorna l\'app da solo, il pulsante NON scarica il pacchetto', async () => {
  const {browser, pagina, chiesti} = await apriConPonte({salute: {versione: '2.0.20', da: 'copia aggiornata'}});
  try {
    await pagina.evaluate(() => fblAggiornaPannelloVersione(true));
    const etichetta = await pagina.evaluate(() => document.getElementById('fblVerAggiornaBtn').textContent);
    assert.ok(etichetta.indexOf("Aggiorna l'app") >= 0,
      'il pulsante deve dire che aggiorna l\'app, non che scarica un pacchetto (etichetta: ' + etichetta + ')');
    await pagina.evaluate(() => document.getElementById('fblVerAggiornaBtn').click());
    await pagina.waitForFunction(() => window.__ricaricato > 0 || window.__clic.length > 0, {timeout: 8000});
    const esito = await pagina.evaluate(() => ({scaricati: window.__clic, ricaricato: window.__ricaricato}));
    assert.equal(esito.scaricati.filter(u => /\.(exe|apk|msi|dmg)$/i.test(u)).length, 0,
      'il programma gia\' si aggiorna da solo: scaricare il pacchetto aggiungerebbe un file in Download a ogni versione (scaricati: ' + JSON.stringify(esito.scaricati) + ')');
    assert.equal(esito.ricaricato, 1,
      'senza pacchetto da scaricare l\'app ricarica la pagina: e\' cosi\' che l\'app nuova entra');
    assert.equal(chiesti.aggiorna, 1,
      'al ponte si deve chiedere di riscaricare l\'app: altrimenti la ricarica darebbe ancora la copia vecchia');
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: se il programma installato serve la copia congelata, il pacchetto viene scaricato', async () => {
  const {browser, pagina} = await apriConPonte({salute: {versione: '2.0.19', da: 'copia installata'}});
  try {
    await aggiorna(pagina);
    await pagina.waitForFunction(() => window.__clic.length > 0, {timeout: 8000});
    const scaricati = await pagina.evaluate(() => window.__clic);
    assert.ok(scaricati.some(u => u.endsWith('.exe')),
      'un programma troppo vecchio per aggiornarsi da solo ha bisogno del Setup: il download deve partire (scaricati: ' + JSON.stringify(scaricati) + ')');
  } finally { await browser.close(); }
});

test('se il ponte non risponde, il pacchetto si scarica (la via che non lascia nessuno indietro)', async () => {
  const {browser, pagina} = await apriConPonte({salute: null});
  try {
    await aggiorna(pagina);
    await pagina.waitForFunction(() => window.__clic.length > 0, {timeout: 8000});
    const scaricati = await pagina.evaluate(() => window.__clic);
    assert.ok(scaricati.some(u => u.endsWith('.exe')),
      'senza il ponte non si puo\' sapere se il programma installato si aggiorna da solo: si scarica (scaricati: ' + JSON.stringify(scaricati) + ')');
  } finally { await browser.close(); }
});

test('su un dispositivo che non e\' un computer il pacchetto del computer non si scarica mai', async () => {
  const {browser, pagina} = await apriConPonte({salute: null, userAgent: UA_NON_COMPUTER});
  try {
    await aggiorna(pagina);
    await pagina.waitForFunction(() => window.__ricaricato > 0 || window.__clic.length > 0, {timeout: 8000});
    const esito = await pagina.evaluate(() => ({scaricati: window.__clic, ricaricato: window.__ricaricato}));
    assert.equal(esito.scaricati.filter(u => /\.(exe|apk|msi|dmg)$/i.test(u)).length, 0,
      'qui l\'app si aggiorna da sola: il pacchetto del computer non serve a nulla (scaricati: ' + JSON.stringify(esito.scaricati) + ')');
    assert.equal(esito.ricaricato, 1, 'senza pacchetto l\'app ricarica la pagina');
  } finally { await browser.close(); }
});

// IL WIZARD DEI PACCHETTI: LO STESSO DIFETTO, SECONDO PORTA.
//
// Quando il servizio non risponde, il wizard MT5 apre il passo 1. Se i pacchetti sono gia'
// installati offriva lo stesso «Scarica di nuovo i pacchetti»: ogni click aggiungeva un file
// alla cartella Download. Se pero' anche l'app qui e' gia' aggiornata, riscaricare non porta
// niente: il pulsante sparisce e resta spiegato come rimediare.
//
// IL TEST MISURA IL COMPORTAMENTO: guarda se il pulsante di download c'e' o no, e cosa dice il
// testo. Non legge il sorgente.
const PREPARA_WIZARD = (versioneInstallata) => {
  // IL SERVIZIO NON RISPONDE: e' la situazione in cui il wizard si apre.
  pontGiaVisto = true;   // i pacchetti su questo computer ci sono gia'
  try{ localStorage.setItem('fxbt_ponteGiaVisto','1'); }catch(e){}
  fetchMt5WithTimeout = async (percorso) => {
    if (percorso === '/health') return {ok: false};
    if (percorso === '/mt5-terminal-status') return {ok: true, data: {installed: true}};
    return {ok: true, data: {}};
  };
  // L'attesa del servizio non e' quello che si vuole provare qui: si accorcia.
  waitForBridgeHealthy = async () => ({ok: false});
  // La versione installata su questo dispositivo: e' quella che il pannello Versione confronta.
  fblVersioneInstallata = async () => versioneInstallata;
  $('mt5LoginModalOverlay').style.display = 'flex';
};

// Apre la pagina, dice quale release e' pubblicata e avvia il wizard MT5.
async function apriWizard({tagRemoto, versioneInstallata}) {
  const {browser, pagina, errori} = await apriApp();
  await pagina.route(u => u.host.indexOf('api.github.com') >= 0, r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({tag_name: 'v' + tagRemoto, body: 'release di prova', assets: []}),
  }));
  const r = await pagina.evaluate(async (dati) => {
    eval('(' + dati.prep + ')(' + JSON.stringify(dati.versione) + ')');
    // La release pubblicata, come la tiene il controllo automatico (nessuna rete).
    await fblLeggiUltimaRelease(true);
    await mt5StartLoginFlow();
    return {
      scaricaNascosto: $('mt5DownloadDesktopAppBtn').style.display === 'none',
      testo: $('mt5BridgeStepTesto').textContent,
      avanti: $('mt5BridgeContinueBtn').textContent,
    };
  }, {prep: PREPARA_WIZARD.toString(), versione: versioneInstallata});
  return {browser, pagina, errori, r};
}

test('nel wizard, se l\'app qui e\' gia\' aggiornata, il download dei pacchetti sparisce', async () => {
  const aperto = await apriWizard({tagRemoto: '2.0.19', versioneInstallata: '2.0.19'});
  try {
    const r = aperto.r;
    assert.equal(r.scaricaNascosto, true,
      'i pacchetti sono gia\' installati e l\'app e\' aggiornata: riscaricarli aggiungerebbe solo un file in Download (testo: ' + r.testo + ')');
    assert.match(r.testo, /gi(à|a)\s+aggiornata/i,
      'il testo deve dire PERCHE\' il download e\' sparito: il testo: ' + r.testo);
    assert.match(r.avanti, /Riprova/);
    assert.deepEqual(aperto.errori, []);
  } finally { await aperto.browser.close(); }
});

test('PROVA DI CONTROLLO: nel wizard, se l\'app qui e\' indietro, il download dei pacchetti resta', async () => {
  const aperto = await apriWizard({tagRemoto: '99.0.0', versioneInstallata: '2.0.19'});
  try {
    const r = aperto.r;
    assert.equal(r.scaricaNascosto, false,
      'un\'app indietro puo\' avere bisogno dei pacchetti nuovi: il download non puo\' sparire (testo: ' + r.testo + ')');
    assert.match(r.testo, /installati/i);
    assert.deepEqual(aperto.errori, []);
  } finally { await aperto.browser.close(); }
});
