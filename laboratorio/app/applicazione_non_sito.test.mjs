// IN UN'APPLICAZIONE F5 E CTRL+R NON DEVONO FARE NIENTE.
//
// RICHIESTO ESPLICITAMENTE dal proprietario (7 novembre 2026): «questa e' un'applicazione e
// deve essere del tutto sganciata da un sito web o da Chrome o da qualsiasi altro motore di
// ricerca... questi pulsanti non devono esserci e non devono fare nulla, nessuna applicazione
// fa una cosa del genere».
//
// HA RAGIONE, E NON E' SOLO ESTETICA: ricaricare la pagina mentre si guarda una posizione
// aperta butta lo stato in memoria (posizioni, disegni, zoom) e fa ricominciare tutto da capo,
// mentre l'app ha gia' il SUO modo di aggiornarsi - il pulsante «Aggiorna», che installa
// davvero. Ricaricare dal motore di render non aggiorna niente.
//
// COSA SI MIDE QUI, E COSA NON SI PUO' MISURARE. Due prove, entrambe oneste:
//   1. la tastiera VERA non fa navigare la pagina (framenavigated resta a zero);
//   2. il gestore dell'app CONTROLLA il tasto (preventDefault), cosi' il browser non ha modo di
//      - interpretarlo come ricarica; e dove si scrive (caselle di testo) non lo tocca.
// La prova 1 da sola NON distinguerebbe i due versi: MISURATO, in Chromium headless su file://
// F5 non ricarica comunque, quindi senza la cura resterebbe verde - e un test verde che non
// distingue non prova niente (e' l'errore che ho fatto prima di arrivare qui, ed e' scritto
// perche' non ci si ricaschi).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Navigazioni vere della pagina, viste da fuori.
async function contaNavigazioni(pagina) {
  let navigate = 0;
  const handler = () => { navigate++; };
  pagina.on('framenavigated', handler);
  return {valore: () => navigate,
          smonta: () => { try { pagina.off('framenavigated', handler); } catch (e) {} }};
}

test('la tastiera vera non fa navigare l\'applicazione', async () => {
  const {browser, pagina, errori} = await apriApp();
  const nav = await contaNavigazioni(pagina);
  try {
    await pagina.keyboard.press('F5');
    await pagina.keyboard.press('Control+r');
    await pagina.waitForTimeout(600);
    assert.equal(nav.valore(), 0,
      'premendo F5 e Ctrl+R la pagina non deve navigare: ' + nav.valore());
    assert.ok(pagina.url().indexOf('app.html') >= 0, 'la pagina deve essere ancora quella dell\'app');
    assert.deepEqual(errori, []);
  } finally { nav.smonta(); await browser.close(); }
});

test('il gestore dell\'app blocca il tasto: senza di lui il browser potrebbe ricaricare', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const premi = (chiave, target) => {
        const e = new KeyboardEvent('keydown', {key: chiave, bubbles: true, cancelable: true});
        Object.defineProperty(e, 'ctrlKey', {value: chiave === 'r'});
        (target || document.body).dispatchEvent(e);
        return e.defaultPrevented;
      };
      // Fuori dalle caselle: il tasto deve essere bloccato.
      const f5 = premi('F5');
      const ctrlR = premi('r');
      // Dentro una casella di testo: i tasti restano liberi (la' non sono scorciatoie).
      const box = document.createElement('input');
      document.body.appendChild(box);
      const f5InCasella = premi('F5', box);
      const ctrlRInCasella = premi('r', box);
      box.remove();
      return {f5, ctrlR, f5InCasella, ctrlRInCasella};
    });
    assert.equal(r.f5, true, 'F5 fuori dalle caselle deve essere bloccato: ' + JSON.stringify(r));
    assert.equal(r.ctrlR, true, 'Ctrl+R fuori dalle caselle deve essere bloccato: ' + JSON.stringify(r));
    assert.equal(r.f5InCasella, false,
      'scrivendo in una casella, F5 resta libero (un\'app vera non toglie i tasti a chi scrive): ' + JSON.stringify(r));
    assert.equal(r.ctrlRInCasella, false,
      'scrivendo in una casella, Ctrl+R resta libero: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
