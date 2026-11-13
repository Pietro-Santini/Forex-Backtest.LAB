// IL PULSANTE «AGGIORNA» COMPARE SOLO QUANDO LA PUBBLICAZIONE E' FINITA DEL TUTTO.
//
// SEGNALATO dal proprietario il 12 novembre 2026, con lo schermo davanti: «mi dice che l'ultima
// versione e' la 36 e non c'e' nulla da aggiornare, mentre invece la nuova versione e' la 37».
// E la richiesta: «facciamo in modo che il pulsante venga visualizzato solo quando la
// pubblicazione e' completa del tutto, altrimenti ricorriamo sempre a questo problema».
//
// LA FINESTRA IN CUI SI ROMPE: una Release su GitHub non nasce finita. Prima viene creata (tag e
// note), poi i file ci vengono caricati sopra uno alla volta, da flussi diversi - l'APK ha il
// suo. Il controllo di prima era `assets.length>0`: bastava l'APK appena salito per dichiarare
// «c'e' una versione nuova» mentre il Setup non c'era ancora. Chi premeva Aggiorna in quel minuto
// si sentiva rispondere «sei gia' all'ultima, non c'era niente da installare».
//
// Queste prove misurano la DECISIONE (`fblReleaseCompleta`), con le risposte di GitHub nelle
// forme in cui arrivano davvero durante una pubblicazione.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SETUP = 'ForexBacktestLAB_Setup.exe';
const ZIP = 'installer_build.zip';
const APK = 'forexbacktestlab.apk';
const pronto = (nome) => ({name: nome, state: 'uploaded', size: 1234567});

test('una Release con TUTTI i file e\' completa; a cui ne manca uno, no', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(([setup, zip, apk]) => {
      const p = (nome) => ({name: nome, state: 'uploaded', size: 1234567});
      const casi = {
        // come arriva alla fine, con anche l'APK
        completa: {tag_name: 'v2.2.37', assets: [p(apk), p(setup), p(zip)]},
        // come arriva SENZA l'APK: deve bastare lo stesso, l'APK lo fa un altro flusso
        senzaApk: {tag_name: 'v2.2.37', assets: [p(setup), p(zip)]},
        // il solo Setup basta: e' l'unico file che l'aggiornamento installa davvero
        soloSetup: {tag_name: 'v2.2.37', assets: [p(setup)]},
        // e una risposta che non dichiara la dimensione non e' una prova che il file manchi
        senzaDimensione: {tag_name: 'v2.2.37', assets: [{name: setup}]},
        // IL CASO DEL DIFETTO: l'APK e' gia' salito, il Setup no
        soloApk: {tag_name: 'v2.2.37', assets: [p(apk)]},
        // la Release appena creata, ancora vuota
        vuota: {tag_name: 'v2.2.37', assets: []},
        // un file ancora in salita: GitHub lo dichiara, ma non c'e'
        inSalita: {tag_name: 'v2.2.37',
                   assets: [p(apk), {name: setup, state: 'starter', size: 0}, p(zip)]},
        // un file dichiarato ma di zero byte
        vuotoDentro: {tag_name: 'v2.2.37',
                      assets: [{name: setup, state: 'uploaded', size: 0}, p(zip)]},
        // lo zip da solo non basta: il Setup e' il file che si installa
        soloZip: {tag_name: 'v2.2.37', assets: [p(zip)]},
        // bozza e anteprima non sono pubblicazioni
        bozza: {tag_name: 'v2.2.37', draft: true, assets: [p(setup), p(zip)]},
        anteprima: {tag_name: 'v2.2.37', prerelease: true, assets: [p(setup), p(zip)]}
      };
      const out = {};
      Object.keys(casi).forEach(k => { out[k] = fblReleaseCompleta(casi[k]); });
      out.niente = fblReleaseCompleta(null);
      return out;
    }, [SETUP, ZIP, APK]);
    console.log('completa?', JSON.stringify(r, null, 1));

    assert.equal(r.completa, true, 'con tutti i file la pubblicazione e\' finita');
    assert.equal(r.senzaApk, true,
      'l\'APK non deve essere richiesto: lo costruisce un altro flusso, e se quello fallisse il ' +
      'pulsante non comparirebbe mai sul computer per un pacchetto che al computer non serve');
    assert.equal(r.soloSetup, true,
      "il Setup da solo basta: lo zip dei sorgenti e l'APK non sono cio' che si installa, e " +
      'chiederli rischiava di non far comparire MAI il pulsante se il loro flusso fallisse');
    assert.equal(r.senzaDimensione, true,
      "una risposta che non dichiara la dimensione non e' una prova che il file manchi");
    assert.equal(r.soloZip, false, 'senza il Setup non si installa niente');
    assert.equal(r.soloApk, false,
      'E\' IL CASO DEL DIFETTO: con il solo APK la pubblicazione non e\' finita');
    assert.equal(r.vuota, false, 'una Release appena creata non e\' una pubblicazione');
    assert.equal(r.inSalita, false, 'un file ancora in salita non c\'e\'');
    assert.equal(r.vuotoDentro, false, 'un file da zero byte non si puo\' installare');
    assert.equal(r.bozza, false, 'una bozza non e\' pubblicata');
    assert.equal(r.anteprima, false, 'un\'anteprima nemmeno');
    assert.equal(r.niente, false, 'e senza risposta non si inventa niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con la pubblicazione a meta\' il pulsante non compare, e il tag NON viene annotato', async () => {
  // La seconda meta' conta quanto la prima: se il tag venisse annotato come «gia' visto» mentre
  // la pubblicazione e' a meta', quando finisce davvero il confronto direbbe «niente di nuovo»
  // e l'aggiornamento non verrebbe piu' offerto affatto. Il difetto si trasformerebbe da
  // «compare troppo presto» a «non compare mai piu'», che e' peggio.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(async ([setup, zip, apk]) => {
      const p = (nome) => ({name: nome, state: 'uploaded', size: 1234567});
      localStorage.removeItem('fbl_rel_vista');
      const vero = window.fetch;
      let risposta = {tag_name: 'v2.2.37', assets: [p(apk)]};        // solo l'APK: a meta'
      window.fetch = async (u, o) => {
        if (String(u).indexOf('releases/latest') >= 0) {
          return {ok: true, json: async () => risposta};
        }
        return vero(u, o);
      };
      const el = document.getElementById('fblAggiornaBtn');
      if (el) el.style.display = 'none';
      const pulsante = () => !!(el && el.style.display !== 'none');
      await fblControllaAggiornamento(true);
      const aMeta = {pulsante: pulsante(), tagAnnotato: localStorage.getItem('fbl_rel_vista')};
      // adesso la pubblicazione finisce
      risposta = {tag_name: 'v2.2.37', assets: [p(apk), p(setup), p(zip)]};
      await fblControllaAggiornamento(true);
      const finita = {tagAnnotato: localStorage.getItem('fbl_rel_vista')};
      window.fetch = vero;
      return {aMeta, finita};
    }, [SETUP, ZIP, APK]);
    console.log('a meta\':', JSON.stringify(r.aMeta), '| finita:', JSON.stringify(r.finita));

    assert.equal(r.aMeta.pulsante, false,
      'con la pubblicazione a meta\' il pulsante non deve comparire: ' + JSON.stringify(r.aMeta));
    assert.equal(r.aMeta.tagAnnotato, null,
      'e il tag NON va annotato come visto, altrimenti a pubblicazione finita l\'aggiornamento ' +
      'non verrebbe piu\' offerto: ' + JSON.stringify(r.aMeta));
  } finally { await browser.close(); }
});
