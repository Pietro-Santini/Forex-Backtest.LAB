// Due ponti dei segnali: Telegram sul server, Syntra sul computer.
//
// SEGNALATO dal proprietario (8 ottobre 2026): «il lato Syntra di BlueStacks non va più e il robot
// non aggiorna la sessione notifiche».
//
// LA CAUSA non era nel lettore: il ponte dei segnali sul computer NON GIRAVA. `tgAssicuraPonte`
// risponde «c'è già» appena c'è un server, e da allora nessuno accende più quello locale — ma
// Syntra vive lì, perché legge BlueStacks con ADB.
//
// Il difetto che questi test devono impedire è il silenzioso: l'interruttore di Syntra si muove, la
// configurazione parte verso il ponte sbagliato, e non succede niente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SCENA = (conServer, ponteLocale) => {
  if (conServer) {
    localStorage.setItem('fbl_server_host', 'pietro.tail83d918.ts.net');
    localStorage.setItem('fbl_server_chiave', 'CHIAVE-DEL-SERVER');
  } else {
    localStorage.removeItem('fbl_server_host');
    localStorage.removeItem('fbl_server_chiave');
  }
  fblPonteLocaleVivo = ponteLocale;
};

const prepara = (pagina, conServer, ponteLocale) =>
  pagina.evaluate(([p, s, l]) => eval('(' + p + ')')(s, l), [SCENA.toString(), conServer, ponteLocale]);

test('i due ponti si separano solo sul computer, non sul telefono', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(([p]) => {
      const f = eval('(' + p + ')');
      const out = {};
      f(true, true);   out.computer = tgSyntraSeparata();   // server + ponte locale = computer
      f(true, false);  out.telefono = tgSyntraSeparata();   // server, niente ponte locale = telefono
      f(false, true);  out.soloPc  = tgSyntraSeparata();    // nessun server: un ponte solo, come prima
      return out;
    }, [SCENA.toString()]);
    assert.equal(r.computer, true);
    // Dal telefono non c'è niente da separare: Syntra ha bisogno dell'emulatore, che sta sul computer.
    assert.equal(r.telefono, false);
    assert.equal(r.soloPc, false, 'senza server resta un ponte solo, come si è sempre fatto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('IL DIFETTO SILENZIOSO: la configurazione di Syntra non va al ponte di Telegram', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await prepara(pagina, true, true);
    const r = await pagina.evaluate(() => {
      const andati = {principale: [], syntra: []};
      tgWs = {readyState: 1, send: (s) => andati.principale.push(JSON.parse(s))};
      tgWsSyntra = {readyState: 1, send: (s) => andati.syntra.push(JSON.parse(s))};
      tgInviaSyntra({azione: 'syntra_config', attivo: true});
      tgInvia({azione: 'leggi_chat'});
      return andati;
    });
    assert.equal(r.syntra.length, 1, 'la configurazione di Syntra deve arrivare al lettore vero');
    assert.equal(r.syntra[0].azione, 'syntra_config');
    assert.equal(r.principale.length, 1, 'e le cose di Telegram restano sull\'altro');
    assert.equal(r.principale[0].azione, 'leggi_chat');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza separazione la configurazione resta dov\'era: nessuna regressione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await prepara(pagina, false, true);
    const r = await pagina.evaluate(() => {
      const andati = [];
      tgWs = {readyState: 1, send: (s) => andati.push(JSON.parse(s))};
      tgWsSyntra = null;
      tgInviaSyntra({azione: 'syntra_config', attivo: true});
      return andati;
    });
    assert.equal(r.length, 1);
    assert.equal(r[0].azione, 'syntra_config');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('lo stato di Syntra lo scrive solo il ponte di Syntra', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await prepara(pagina, true, true);
    const r = await pagina.evaluate(() => {
      // Il ponte del server gira su Linux: il suo stato di Syntra è "non può funzionare".
      tgApplicaStato({tipo: 'stato', syntra: {attivo: false, errore: 'solo su Windows'}}, 'principale');
      const dopoServer = syntraStatoUltimo;
      // Quello del computer sa com'è davvero.
      tgApplicaStato({tipo: 'stato', syntra: {attivo: true, collegato: true, utenti: ['Mario']}}, 'syntra');
      return {dopoServer, dopoPc: syntraStatoUltimo};
    });
    assert.notEqual(r.dopoServer && r.dopoServer.errore, 'solo su Windows',
      'il ponte del server non deve poter dire che Syntra non funziona: non è lui a saperlo');
    assert.equal(r.dopoPc.collegato, true);
    assert.equal(r.dopoPc.attivo, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il canale di Syntra punta al computer, mai al server', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await prepara(pagina, true, true);
    const r = await pagina.evaluate(() =>
      fblConChiave(fblBaseUrl(tgPortNow(), '127.0.0.1').replace(/^http/, 'ws') + '/ws/segnali'));
    assert.ok(r.startsWith('ws://127.0.0.1:'), 'il lettore è qui, non dall\'altra parte: ' + r);
    assert.ok(!r.includes('/pc/'), 'niente giro dal server per un servizio che gira su questa macchina');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
