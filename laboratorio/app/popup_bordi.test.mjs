// NESSUN POPUP OLTREPASSA IL BORDO DELLO SCHERMO, E NESSUN TESTO ESCE DAL POPUP.
//
// RICHIESTO dal proprietario fra i punti del telefono, tre righe distinte:
//   «i popup non devono mai oltrepassare il bordo dello schermo (visto sulle strategie)»;
//   «il testo non deve mai uscire dal popup (impostazioni e collegamento compresi)»;
//   «i popup devono adattarsi al contenuto: quello della cronologia sale e' troppo piccolo».
//
// MISURATO il 21 ottobre 2026 aprendo tutti e 24 i popup in una finestra da telefono, in quattro
// condizioni. I numeri da cui nascono le correzioni:
//   - a scala 130%, il riquadro sforava di 117 px SOTTO il bordo e fino a 73 px di LATO. Causa:
//     `max-height:88vh` viene calcolato sull'altezza vera della finestra e poi moltiplicato dallo
//     zoom del body (812 x 0,88 x 1,3 = 929: esattamente 117 px oltre). Nessuna regola CSS puo'
//     leggere lo zoom, quindi ora la scala si scrive in --fblZoom e i limiti ci dividono.
//     Sforavano di piu' tgAutoOverlay e tgConfigOverlay: le due finestre delle STRATEGIE, cioe'
//     dove il proprietario l'ha visto.
//   - la striscia delle schede delle impostazioni sforava di 109 px, e senza scorrimento le
//     schede oltre il bordo erano IRRAGGIUNGIBILI;
//   - la voce «Collegamento/Modalita'» della colonna delle impostazioni sforava di 43 px, perche'
//     e' piu' larga della colonna (132 px fissi) e aveva white-space:nowrap. E' la voce che il
//     proprietario ha nominato.
//
// QUELLO CHE RESTA, detto perche' non sembri dimenticato: in tre popup una TABELLA (le sale, le
// regole) e' piu' larga dello spazio disponibile su uno schermo da 320 px — 389 px in 264. Una
// tabella non si stringe sotto le sue colonne: ora SCORRE dentro il popup, che e' il
// comportamento giusto, invece di spingere il riquadro fuori dallo schermo come prima.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

const POPUP = ['liveLoginModalOverlay','generalSettingsModalOverlay','propFirmModeChoiceModalOverlay',
 'propFirmCapitalModalOverlay','pfMt5IneligibleModalOverlay','customScriptModalOverlay',
 'aiConvertModalOverlay','liveGuideModalOverlay','mt5LoginModalOverlay','drawStyleModalOverlay',
 'fibModalOverlay','vpModalOverlay','chartSettingsModalOverlay','chartLayersModalOverlay',
 'assetPickerOverlay','watchlistModalOverlay','alarmsListModalOverlay','newsEventModalOverlay',
 'newsClusterModalOverlay','indicatorSettingsModalOverlay','fblRemotoOverlay','tgAutoOverlay',
 'tgConfigOverlay','fblCronoOverlay'];

// Apre ogni popup e misura di quanto il suo riquadro esce dallo schermo.
const MISURA = (ids, scala) => {
  if (scala) fblScalaUiImposta(localStorage, document, scala);
  const fuori = [];
  ids.forEach(id => {
    const ov = document.getElementById(id);
    if (!ov) { fuori.push({id, manca: true}); return; }
    const prima = ov.style.display;
    ov.style.display = 'flex';
    const box = ov.querySelector('.fbModalBox') || ov.firstElementChild;
    if (box) {
      const r = box.getBoundingClientRect();
      const dx = Math.round(Math.max(0, -r.left) + Math.max(0, r.right - window.innerWidth));
      const dy = Math.round(Math.max(0, -r.top) + Math.max(0, r.bottom - window.innerHeight));
      if (dx > 0 || dy > 0) fuori.push({id, dx, dy, w: Math.round(r.width), h: Math.round(r.height)});
    }
    ov.style.display = prima;
  });
  return fuori;
};

test('su uno schermo da telefono nessun popup esce dai bordi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.setViewportSize({width: 375, height: 812});
    const fuori = await pagina.evaluate(({ids, m}) => eval('(' + m + ')')(ids, null),
                                        {ids: POPUP, m: MISURA.toString()});
    assert.deepEqual(fuori, [], 'popup fuori dallo schermo: ' + JSON.stringify(fuori));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nemmeno con l\'interfaccia ingrandita al 130%: era il difetto segnalato', async () => {
  // E' il caso che il proprietario ha visto. Prima di questa correzione: 117 px sotto il bordo su
  // sei popup, e fino a 73 px di lato su tre.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.setViewportSize({width: 375, height: 812});
    const fuori = await pagina.evaluate(({ids, m}) => eval('(' + m + ')')(ids, 130),
                                        {ids: POPUP, m: MISURA.toString()});
    assert.deepEqual(fuori, [], 'popup fuori dallo schermo a scala 130%: ' + JSON.stringify(fuori));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nemmeno su uno schermo piccolo o in orizzontale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.setViewportSize({width: 320, height: 568});
    const piccolo = await pagina.evaluate(({ids, m}) => eval('(' + m + ')')(ids, null),
                                          {ids: POPUP, m: MISURA.toString()});
    await pagina.setViewportSize({width: 812, height: 375});
    const orizz = await pagina.evaluate(({ids, m}) => eval('(' + m + ')')(ids, null),
                                        {ids: POPUP, m: MISURA.toString()});
    assert.deepEqual(piccolo, [], 'telefono piccolo (320x568): ' + JSON.stringify(piccolo));
    assert.deepEqual(orizz, [], 'in orizzontale (812x375), dove l\'altezza e\' quella che manca: '
      + JSON.stringify(orizz));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le schede delle impostazioni si raggiungono tutte, e le voci non escono dal popup', async () => {
  // I due sfori piu' grossi, e i piu' dannosi: una scheda fuori dal bordo senza scorrimento non
  // si puo' premere, e una voce tagliata non si puo' leggere.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.setViewportSize({width: 375, height: 812});
    const r = await pagina.evaluate(() => {
      const out = {};
      const g = document.getElementById('generalSettingsModalOverlay');
      g.style.display = 'flex';
      const tabs = g.querySelector('.fbModalTabs');
      out.schede = tabs ? {sforo: tabs.scrollWidth - tabs.clientWidth,
                           righe: new Set([...tabs.children].map(c => Math.round(c.getBoundingClientRect().top))).size}
                        : null;
      g.style.display = 'none';
      const c = document.getElementById('chartSettingsModalOverlay');
      c.style.display = 'flex';
      const nav = c.querySelector('.fbSettingsNav');
      const voce = document.getElementById('chartSettingsTabLiveMt5');
      const rn = nav.getBoundingClientRect(), rv = voce.getBoundingClientRect();
      out.collegamento = {oltre: Math.round(rv.right - rn.right), aCapo: rv.height > 24};
      c.style.display = 'none';
      return out;
    });
    assert.ok(r.schede, 'la striscia delle schede deve esserci');
    assert.ok(r.schede.sforo <= 1,
      'la striscia delle schede non deve sforare: sforo di ' + r.schede.sforo + ' px');
    assert.ok(r.schede.righe > 1,
      'su un telefono le schede devono andare a capo (su piu\' righe), non scorrere via: '
      + r.schede.righe + ' riga/righe');
    assert.ok(r.collegamento.oltre <= 1,
      'la voce «Collegamento/Modalita\'» non deve uscire dalla colonna: ' + r.collegamento.oltre + ' px');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la scala e\' dichiarata al CSS: e\' il punto su cui tutto questo si regge', () => {
  // Senza la variabile, i limiti dei popup non possono tenere conto dello zoom del body e il
  // difetto torna identico. Se un domani qualcuno toglie la riga che la scrive, il resto delle
  // correzioni smette silenziosamente di funzionare: questo lo rende rumoroso.
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  assert.match(src, /setProperty\('--fblZoom'/,
    'fblScalaUiApplica deve scrivere la scala in --fblZoom');
  assert.match(src, /max-height:calc\(88vh \/ var\(--fblZoom,1\)\)/,
    'l\'altezza massima dei popup deve dividere per la scala');
  assert.ok(!/\.fbModalBox\{width:95vw!important;max-width:none/.test(src),
    'le regole per telefono non devono piu\' annullare il limite di larghezza');
});
