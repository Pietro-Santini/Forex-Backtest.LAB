// 8.5.16 — IL POPUP DELLA NOTIZIA CHIEDE L'ACTUAL AL PONTE (LATO APP).
//
// Banco comportamentale: apre app.html vera, sostituisce window.fetch PRIMA del caricamento con
// un ponte finto che risponde solo a /news/actual. Nessuna rete vera, nessun identificativo di
// modello, nessuna chiave. Misura la richiesta che parte e la sola riga «Actual» del modale.
//
// Fonte (MISURATO, sola lettura): cervello/STATO-SCALETTA-19-NOVEMBRE.md riga 57 e 136 —
// «Popup notizie usa /news/actual per High/Medium senza actual…» e «PERSO lato app
// (openNewsEventModal non chiama /news/actual)». Sul repo pubblicato openNewsEventModal non
// chiama la rotta: questo banco deve essere ROSSO perche' la chiamata non parte.

import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Date RELATIVE all'orologio vero: con una data fissa, «futuro» diventa passato col passare
// dei giorni e la prova misura il caso sbagliato (lezione gia' pagata in notizie_archivio).
const QUANDO = new Date(Date.now() - 3600000).toISOString();
const RISPOSTA_BUONA = {
  valore: '3.2%', unita: '', fonte: 'BLS, comunicato ufficiale', motivo: null,
};

function evento(extra) {
  return Object.assign({
    title: 'US Nonfarm Payrolls', country: 'USD', impact: 'High',
    date: QUANDO, actual: null,
  }, extra || {});
}

// Ponte finto: nessuna richiesta esce dal banco. Le altre rotte rispondono vuote per non
// disturbare l'avvio dell'app (stesso schema di costo_esecuzione_ombra.test.mjs).
async function apriConPonte(risposta) {
  return apriApp({primaDiNavigare: async (pagina) => {
    await pagina.addInitScript((cfg) => {
      window.__actualChiamate = [];
      window.__actualRisposta = cfg;
      const R = (d) => new Response(JSON.stringify(d), {
        status: 200, headers: {'Content-Type': 'application/json'},
      });
      window.fetch = async function (u) {
        const url = String((u && u.url) ? u.url : u);
        const c = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
        if (c.indexOf('/news/actual') >= 0) {
          window.__actualChiamate.push(url);
          if (window.__actualRisposta && window.__actualRisposta.fallisci) {
            throw new Error('rete giu (finto)');
          }
          return R(window.__actualRisposta || {});
        }
        if (c.indexOf('/news') >= 0) return R([]);
        if (c.indexOf('/health') >= 0 || c.indexOf('/mt5-terminal-status') >= 0) return R({ok: true});
        if (c.indexOf('/positions') >= 0 || c.indexOf('/orders') >= 0 || c.indexOf('/history') >= 0) return R([]);
        return R({});
      };
    }, risposta || RISPOSTA_BUONA);
  }});
}

// Apre il modale vero (quante volte si dice) e legge SOLO la riga Actual e le chiamate al ponte.
// Non guarda il sorgente: guarda cio' che il browser ha fatto e mostrato.
const APRI = async ({ev, quante = 1}) => {
  window.__actualChiamate.length = 0;
  const prima = document.getElementById('newsEventActualValore');
  const testoPrima = prima ? prima.textContent : '';
  for (let i = 0; i < (quante || 1); i++) openNewsEventModal(ev);
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 10));
    const ora = document.getElementById('newsEventActualValore');
    if (ora && ora.textContent !== testoPrima) break;
  }
  const val = document.getElementById('newsEventActualValore');
  const riga = document.getElementById('newsEventActualRow');
  const chiamate = window.__actualChiamate.map((u) => {
    try {
      const p = new URL(u);
      return {path: p.pathname, params: Object.fromEntries(p.searchParams)};
    } catch (e) { return {path: u, params: {}}; }
  });
  return {
    riga: riga ? riga.textContent : '',
    valore: val ? val.textContent : '',
    chiamate,
    cacheKeys: Object.keys(localStorage).filter((k) => k.indexOf('fbl_news_actual') === 0),
  };
};

// ---- Quando si chiede ---------------------------------------------------

test('8.5.16: High/Medium passato senza actual chiama il ponte con i quattro parametri', async () => {
  const {browser, pagina, errori} = await apriConPonte();
  try {
    const alta = await pagina.evaluate(APRI, {ev: evento()});
    assert.equal(alta.chiamate.length, 1,
      'LA CHIAMATA NON PARTE: ' + JSON.stringify(alta));
    assert.equal(alta.chiamate[0].path, '/news/actual');
    assert.equal(alta.chiamate[0].params.titolo, 'US Nonfarm Payrolls');
    assert.equal(alta.chiamate[0].params.valuta, 'USD');
    assert.equal(alta.chiamate[0].params.quando, QUANDO);
    assert.equal(alta.chiamate[0].params.impatto, 'High');

    const media = await pagina.evaluate(APRI, {ev: evento({impact: 'Medium'})});
    assert.equal(media.chiamate.length, 1, 'Medium deve chiamare il ponte');
    assert.equal(media.chiamate[0].params.impatto, 'Medium');

    for (const imp of ['alto', 'medio']) {
      const r = await pagina.evaluate(APRI, {ev: evento({impact: imp})});
      assert.equal(r.chiamate.length, 1, 'anche «' + imp + '» deve chiamare il ponte');
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('8.5.16: Low non chiama il ponte (con controllo che il ponte risponde davvero)', async () => {
  const {browser, pagina} = await apriConPonte();
  try {
    const controllo = await pagina.evaluate(APRI, {ev: evento()});
    assert.equal(controllo.chiamate.length, 1,
      'CONTROLLO: un High passato senza actual deve far partire la chiamata');
    const basso = await pagina.evaluate(APRI, {ev: evento({impact: 'Low'})});
    assert.equal(basso.chiamate.length, 0, 'Low non deve chiamare il ponte');
  } finally { await browser.close(); }
});

test('8.5.16: evento futuro non chiama il ponte (con controllo)', async () => {
  const {browser, pagina} = await apriConPonte();
  try {
    const controllo = await pagina.evaluate(APRI, {ev: evento()});
    assert.equal(controllo.chiamate.length, 1, 'CONTROLLO: la chiamata deve partire');
    const futuro = await pagina.evaluate(APRI, {
      ev: evento({date: new Date(Date.now() + 7200000).toISOString()}),
    });
    assert.equal(futuro.chiamate.length, 0,
      "un valore che non puo' ancora esistere non si chiede");
  } finally { await browser.close(); }
});

test('8.5.16: evento con actual non chiama e mostra il valore gia presente (con controllo)', async () => {
  const {browser, pagina} = await apriConPonte();
  try {
    const controllo = await pagina.evaluate(APRI, {ev: evento()});
    assert.equal(controllo.chiamate.length, 1, 'CONTROLLO: la chiamata deve partire');
    const presente = await pagina.evaluate(APRI, {ev: evento({actual: 'GIA-NEL-FEED'})});
    assert.equal(presente.chiamate.length, 0, 'con actual non si chiama il ponte');
    assert.match(presente.valore, /GIA-NEL-FEED/,
      'e il valore del feed resta visibile');
  } finally { await browser.close(); }
});

// ---- Valore, motivo e cache ---------------------------------------------

test('8.5.16: valore e fonte compaiono nella sola riga Actual', async () => {
  const {browser, pagina} = await apriConPonte();
  try {
    const r = await pagina.evaluate(APRI, {ev: evento()});
    assert.equal(r.chiamate.length, 1, 'LA CHIAMATA NON PARTE');
    assert.match(r.valore, /3\.2%/, 'il valore uscito deve comparire');
    assert.match(r.valore, /BLS/, 'e la fonte ufficiale deve comparire');
    // Le altre righe del modale non vengono toccate: devono essere ancora li'.
    const altre = await pagina.evaluate(() => {
      const b = document.getElementById('newsEventModalBody');
      return b ? b.textContent : '';
    });
    assert.match(altre, /Valuta/);
    assert.match(altre, /Gravita|Gravità/);
    assert.match(altre, /Forex Factory/);
  } finally { await browser.close(); }
});

test('8.5.16: motivo onesto quando il ponte non ha il valore', async () => {
  const {browser, pagina} = await apriConPonte({
    valore: null, unita: null, fonte: null, motivo: 'dato non ancora pubblicato',
  });
  try {
    const r = await pagina.evaluate(APRI, {ev: evento()});
    assert.equal(r.chiamate.length, 1, 'LA CHIAMATA NON PARTE');
    assert.match(r.valore, /non disponibile da questa fonte/);
    assert.match(r.valore, /dato non ancora pubblicato/, 'il motivo va mostrato');
  } finally { await browser.close(); }
});

test('8.5.16: secondo popup entro il TTL legge la cache senza richiamare il ponte', async () => {
  const {browser, pagina} = await apriConPonte();
  try {
    const primo = await pagina.evaluate(APRI, {ev: evento()});
    assert.equal(primo.chiamate.length, 1, 'LA CHIAMATA NON PARTE');
    assert.ok(primo.cacheKeys.length > 0, 'il valore va memoizzato in localStorage');
    const secondo = await pagina.evaluate(APRI, {ev: evento()});
    assert.equal(secondo.chiamate.length, 0, 'entro 10 minuti non si richiama il ponte');
    assert.equal(secondo.valore, primo.valore);
  } finally { await browser.close(); }
});

test('8.5.16: cache piu vecchia di 10 minuti richiama il ponte', async () => {
  const {browser, pagina} = await apriConPonte();
  try {
    const primo = await pagina.evaluate(APRI, {ev: evento()});
    assert.equal(primo.chiamate.length, 1, 'LA CHIAMATA NON PARTE');
    await pagina.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (k.indexOf('fbl_news_actual') !== 0) continue;
        try {
          const v = JSON.parse(localStorage.getItem(k));
          v.t = Date.now() - 11 * 60 * 1000;
          localStorage.setItem(k, JSON.stringify(v));
        } catch (e) {}
      }
    });
    await pagina.evaluate((v) => { window.__actualRisposta = v; },
      {valore: '4.0%', unita: '', fonte: 'BLS, aggiornato', motivo: null});
    const dopo = await pagina.evaluate(APRI, {ev: evento()});
    assert.equal(dopo.chiamate.length, 1, 'scaduto il TTL la richiesta deve ripartire');
    assert.match(dopo.valore, /4\.0%/);
  } finally { await browser.close(); }
});

test('8.5.16: fallimento non memoizzato, al secondo popup si riprova', async () => {
  const {browser, pagina} = await apriConPonte({fallisci: true});
  try {
    const guasto = await pagina.evaluate(APRI, {ev: evento()});
    assert.equal(guasto.chiamate.length, 1, 'LA CHIAMATA NON PARTE');
    assert.match(guasto.valore, /fonte non raggiungibile/,
      'se la richiesta fallisce il modale resta leggibile');
    assert.deepEqual(guasto.cacheKeys, [], 'un fallimento non si memoizza');

    await pagina.evaluate(() => {
      window.__actualRisposta = {valore: '5.1%', unita: '', fonte: 'BLS', motivo: null};
    });
    const riprova = await pagina.evaluate(APRI, {ev: evento()});
    assert.equal(riprova.chiamate.length, 1, 'al secondo popup si riprova');
    assert.match(riprova.valore, /5\.1%/);
  } finally { await browser.close(); }
});

test('8.5.16: due popup ravvicinati fanno una richiesta sola', async () => {
  const {browser, pagina} = await apriConPonte();
  try {
    const r = await pagina.evaluate(APRI, {ev: evento(), quante: 2});
    assert.equal(r.chiamate.length, 1,
      'due aperture prima che la prima risposta arrivi non devono duplicare la richiesta');
    assert.match(r.valore, /3\.2%/);
  } finally { await browser.close(); }
});

test('8.5.16: eventi diversi non condividono la voce di cache', async () => {
  const {browser, pagina} = await apriConPonte();
  try {
    const a = await pagina.evaluate(APRI, {ev: evento()});
    assert.equal(a.chiamate.length, 1, 'LA CHIAMATA NON PARTE');
    const b = await pagina.evaluate(APRI, {ev: evento({title: 'US CPI'})});
    assert.equal(b.chiamate.length, 1, 'un evento diverso non usa la cache dell altro');
    const chiavi = await pagina.evaluate(({e1, e2}) => ({
      c1: typeof fblNewsActualChiaveCache === 'function' ? fblNewsActualChiaveCache(e1) : null,
      c2: typeof fblNewsActualChiaveCache === 'function' ? fblNewsActualChiaveCache(e2) : null,
    }), {e1: evento(), e2: evento({title: 'US CPI'})});
    assert.ok(chiavi.c1 && chiavi.c2 && chiavi.c1 !== chiavi.c2,
      'la chiave stabile deve cambiare con i campi della query: ' + JSON.stringify(chiavi));
  } finally { await browser.close(); }
});

// --- Rilievi del revisore -------------------------------------------------

test('8.5.16: col grafico flottante/PIP attivo la riga Actual si aggiorna nel documento giusto', async () => {
  const {browser, pagina, errori} = await apriConPonte();
  try {
    const r = await pagina.evaluate(async () => {
      window.__actualChiamate.length = 0;
      // Seconda finestra vera (iframe same-origin), come fa openFloatingChart: due documenti
      // distinti, FloatingDoc punta a quello del PIP (stessa struttura di popup_pagina_giusta).
      const fr = document.createElement('iframe');
      fr.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;height:600px;border:0';
      document.body.appendChild(fr);
      const doc = fr.contentDocument, win = fr.contentWindow;
      copyStylesInto(doc);
      floatingWin = win; floatingDoc = doc;
      trackPopupInteractions(doc);
      lastInteractionDoc = doc;
      const ev = {
        title: 'US Nonfarm Payrolls', country: 'USD', impact: 'High',
        date: new Date(Date.now() - 3600000).toISOString(), actual: null,
      };
      openNewsEventModal(ev);
      for (let i = 0; i < 30; i++) {
        await new Promise((ok) => setTimeout(ok, 10));
        const e = doc.getElementById('newsEventActualValore');
        if (e && e.textContent !== 'in attesa dalla fonte ufficiale…') break;
      }
      const nelPip = doc.getElementById('newsEventActualValore');
      const esito = {
        chiamate: window.__actualChiamate.length,
        testoPip: nelPip ? nelPip.textContent : '',
        nellaPrincipale: !!document.getElementById('newsEventActualValore'),
        overlayPip: !!doc.getElementById('newsEventModalOverlay'),
      };
      fr.remove(); floatingWin = null; floatingDoc = null; lastInteractionDoc = document;
      return esito;
    });
    assert.equal(r.chiamate, 1, 'la richiesta deve partire anche col PIP attivo');
    assert.equal(r.overlayPip, true, 'il modale deve essere stato spostato nel documento flottante');
    assert.equal(r.nellaPrincipale, false, 'controprova: non e piu nel documento principale');
    assert.match(r.testoPip, /3\.2%/,
      "IL DIFETTO: document.getElementById non trova la riga spostata, $() deve trovarla nel PIP");
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('8.5.16: con valore nullo il motivo vince sulla fonte e resta nella riga Actual', async () => {
  // Il ponte reale (bridge.py) manda valore:null, fonte:"BLS…" e motivo:"…non ancora pubblicato"
  // insieme: buttare via il motivo quando c'e' la fonte dice l'opposto di cio' che e' successo.
  const {browser, pagina} = await apriConPonte({
    valore: null, unita: null, fonte: 'BLS', motivo: 'il valore non è ancora pubblicato',
  });
  try {
    const r = await pagina.evaluate(APRI, {ev: evento()});
    assert.equal(r.chiamate.length, 1, 'LA CHIAMATA NON PARTE');
    assert.match(r.valore, /il valore non è ancora pubblicato/,
      'IL DIFETTO: il motivo deve comparire anche quando la fonte e presente');
    assert.match(r.valore, /BLS/, 'e la fonte resta come complemento');
  } finally { await browser.close(); }
});

test('8.5.16: voce di cache con t:null non viene riutilizzata', async () => {
  const {browser, pagina} = await apriConPonte();
  try {
    const r = await pagina.evaluate(async ({ev}) => {
      window.__actualChiamate.length = 0;
      const chiave = fblNewsActualChiaveCache(ev);
      localStorage.setItem('fbl_news_actual_v1|' + chiave, JSON.stringify({
        t: null, valore: 'VALORE-SCADUTO', unita: '', fonte: '', motivo: '',
      }));
      // Ora fissa a 0: con Number(null)===0 la voce verrebbe accettata come appena scritta.
      const memorizzato = fblNewsActualLeggiCache(chiave, 0);
      const esito = await fblNewsActualCarica(ev, 0);
      return {
        memorizzato: !!memorizzato,
        chiamate: window.__actualChiamate.length,
        testo: fblNewsActualRiga(esito),
      };
    }, {ev: evento()});
    assert.equal(r.memorizzato, false, 'IL DIFETTO: t:null non e un orario, la voce va scartata');
    assert.equal(r.chiamate, 1, 'la voce non va riutilizzata: nuova richiesta al ponte');
    assert.doesNotMatch(r.testo, /VALORE-SCADUTO/);
  } finally { await browser.close(); }
});
