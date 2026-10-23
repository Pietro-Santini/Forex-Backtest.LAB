// LE NOTIFICHE SONO «PUSH», NON «DEL BROWSER».
//
// Richiesta del proprietario: (1) il tasto si chiama «Attiva notifiche push» come la sezione;
// (2) NON esiste piu' la frase «Notifiche bloccate dal browser» (non verificata: l'app e' un'
// applicazione); (3) nell'app Android le notifiche arrivano dal telefono via
// @capacitor/local-notifications, non via Notification API (che nella WebView non fa nulla).
//
// LA CURA: la via unica fblNotificaMostra/fblNotificaChiediPermesso — Capacitor se c'e', altrimenti
// Notification. PROVA DI CONTROLLO: il mock di Capacitor (tasto + mostra) gira via plugin, quello
// del browser via Notification: se la via unica saltasse, i due test si accorgerebbero dell'uno
// e dell'altro.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test("UI: sezione e tasto «push», niente «bloccate dal browser»; mostra via Notification quando non c'è Capacitor", async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const res = {};
      // Mock del browser: Notification finto con permesso mutevole e che registra le notifiche.
      window.__notifiche = [];
      window.__perm = 'default';
      window.Notification = class {
        constructor(titolo, opz){ window.__notifiche.push({titolo, ...opz}); }
        static get permission(){ return window.__perm; }
        static async requestPermission(){ window.__perm = 'granted'; return 'granted'; }
      };
      res.titolo = [...document.querySelectorAll('.fbSettingsSectionTitle')].some(x => x.textContent.includes('🔔 Notifiche push'));
      res.tasto = $('alarmNotifPermissionBtn')?.textContent.trim();
      // attivo la spunta: la riga col tasto compare, il testo non parla piu' di "bloccate"
      $('alarmWebNotifCheckbox').checked = true;
      $('alarmWebNotifCheckbox').dispatchEvent(new Event('change'));
      res.rigaVisibile = $('alarmNotifPermissionRow').style.display !== 'none';
      res.stato = $('alarmNotifPermissionStatus').textContent;
      // via unica: senza Capacitor deve usare Notification (mock sopra)
      window.Capacitor = undefined;
      fblNotificaMostra('Prova titolo', 'Prova corpo', 'fxbt-prova-1');
      res.mostrate = window.__notifiche.length;
      res.corpo = window.__notifiche[0] && window.__notifiche[0].body;
      // tasto: chiede il permesso (mock lo concede) e la riga si nasconde davanti all'utente
      $('alarmNotifPermissionBtn').click();
      await new Promise(r => setTimeout(r, 250));
      res.permission = window.__perm;
      res.rigaDopo = $('alarmNotifPermissionRow').style.display;
      return res;
    });
    assert.ok(r.titolo, 'la sezione si chiama «🔔 Notifiche push»: ' + JSON.stringify(r));
    assert.equal(r.tasto, '🔔 Attiva notifiche push', 'il tasto si chiama «Attiva notifiche push»: ' + JSON.stringify(r));
    assert.ok(r.rigaVisibile, 'con la spunta la riga del permesso compare: ' + JSON.stringify(r));
    assert.ok(r.stato && !r.stato.includes('bloccate dal browser'), 'niente piu\' «bloccate dal browser»: ' + JSON.stringify(r));
    assert.equal(r.mostrate, 1, 'senza Capacitor la via unica usa Notification: ' + JSON.stringify(r));
    assert.equal(r.corpo, 'Prova corpo', 'la notifica porta il corpo: ' + JSON.stringify(r));
    assert.equal(r.permission, 'granted', 'il tasto ha chiesto il permesso: ' + JSON.stringify(r));
    assert.equal(r.rigaDopo, 'none', 'concesso il permesso la riga del tasto sparisce: ' + JSON.stringify(r));
    assert.equal(errori.length, 0, 'errori console: ' + errori.join(' | '));
  } finally { await browser.close(); }
});

test('CON PROVA DI CONTROLLO: nell\'app (Capacitor) la notifica va dal plugin LocalNotifications', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const res = {};
      window.__pluginNotifiche = [];
      window.Capacitor = {
        getPlatform: () => 'android',
        Plugins: { LocalNotifications: {
          checkPermissions: async () => ({granted: true}),
          schedule: async (opz) => { window.__pluginNotifiche.push(opz); }
        }}
      };
      // False che non fosse granted: la mostra parte lo stesso via plugin.
      window.Notification = class {
        constructor(){ window.__pluginNotificheViaWeb = (window.__pluginNotificheViaWeb || 0) + 1; }
        static get permission(){ return 'default'; }
      };
      fblNotificaMostra('🔔 Prova', 'Dall\'app', 'fxbt-prova-2');
      res.quante = window.__pluginNotifiche.length;
      res.prima = window.__pluginNotifiche[0] && window.__pluginNotifiche[0].notifications && window.__pluginNotifiche[0].notifications[0];
      res.viaWeb = window.__pluginNotificheViaWeb || 0;
      // e il testo dello stato parla di app/telefono, non di browser
      $('alarmWebNotifCheckbox').checked = true;
      $('alarmWebNotifCheckbox').dispatchEvent(new Event('change'));
      return Promise.resolve().then(() => new Promise(ris => setTimeout(ris, 250))).then(() => {
        res.stato = $('alarmNotifPermissionStatus').textContent;
        res.riga = $('alarmNotifPermissionRow').style.display;
        return res;
      });
    });
    assert.equal(r.quante, 1, 'il plugin riceve la notifica: ' + JSON.stringify(r));
    assert.ok(r.prima && r.prima.title === '🔔 Prova' && r.prima.body === 'Dall\'app', 'titolo e corpo passati al plugin: ' + JSON.stringify(r));
    assert.equal(r.viaWeb, 0, 'la Notification API resta fuori: ' + JSON.stringify(r));
    assert.ok(r.riga === 'none', 'permesso concesso (granted nel plugin): la riga del tasto si nasconde: ' + JSON.stringify(r));
    assert.equal(errori.length, 0, 'errori console: ' + errori.join(' | '));
  } finally { await browser.close(); }
});
