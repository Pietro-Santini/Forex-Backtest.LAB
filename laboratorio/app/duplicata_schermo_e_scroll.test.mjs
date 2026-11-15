// LE VOCI 2 E 3 DELLE FINESTRE DUPLICATE: schermo intero sulla madre, e niente scorrimento.
//
// Sono due difetti SEGNALATI dal proprietario e curati l'8 novembre 2026, mai coperti da un banco.
// Verificati con la misura il 15 novembre: funzionano. Questo file serve a saperlo subito se un
// domani smettessero, perche' sono due cose che si notano a occhio e danno l'idea di un programma
// rotto.
//
// VOCE 2 - «quando creo una finestra duplicata non mi permette piu' alla pagina madre di andare a
// schermo intero. E invece deve farlo.» La cura sta in toggleMainChartFullscreen(): il ripiego in
// CSS si arma SEMPRE dopo 200 ms, non dentro il .then() della richiesta, perche' con piu' finestre
// aperte il browser (o il WebView2 dell'app) puo' ignorare la richiesta senza risolvere ne'
// rifiutare niente. MISURATO qui: con una duplicata aperta la madre entra a schermo intero NATIVO
// su #chartWrap, e il pulsante resta visibile.
//
// VOCE 3 - «la rodellina fa scorrere la pagina, ma deve esserci solo il grafico». MISURATO qui:
// nella duplicata la pagina non ha nulla da scorrere (0 px) e la rotellina la lascia ferma; sulla
// madre lo scorrimento resta, perche' la' la pagina intera e' giusto che scorra.
//
// NOTA ONESTA SUI LIMITI DI QUESTO BANCO: il browser del laboratorio concede lo schermo intero
// nativo, l'app vera gira in WebView2 e la' la richiesta puo' essere ignorata - e' proprio il caso
// per cui esiste il ripiego in CSS. Qui si prova che la strada nativa funziona e che il pulsante
// non viene nascosto; il ripiego ha la sua prova a parte, piu' sotto, chiamato a mano.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

async function conUnaDuplicata() {
  const {browser, pagina} = await apriApp();
  const p = await pagina.context().newPage();
  await p.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.goto('file://' + path.join(RADICE, 'app.html') + '?pipSlot=2',
               {waitUntil: 'domcontentloaded'});
  await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
    .forEach(el => el.style.display = 'none'));
  return {browser, madre: pagina, duplicata: p};
}

test('VOCE 2: con una duplicata aperta, la madre va a schermo intero', async () => {
  const {browser, madre} = await conUnaDuplicata();
  try {
    const prima = await madre.evaluate(() => {
      const b = document.getElementById('chartFullscreenBtn');
      return {pulsanteVisibile: b ? getComputedStyle(b).display !== 'none' : null};
    });
    assert.equal(prima.pulsanteVisibile, true,
      'il pulsante schermo intero non deve sparire quando si duplica una finestra');
    await madre.evaluate(() => { try { toggleMainChartFullscreen(); } catch (e) {} });
    await madre.waitForTimeout(600);   // il ripiego in CSS si arma a 200 ms: si aspetta oltre
    const dopo = await madre.evaluate(() => ({
      nativo: !!document.fullscreenElement,
      chi: document.fullscreenElement ? document.fullscreenElement.id : null,
      ripiegoCss: (typeof fblSchermoInteroCssAttivo === 'function')
        ? !!fblSchermoInteroCssAttivo() : null
    }));
    console.log('schermo intero sulla madre:', JSON.stringify(dopo));
    assert.ok(dopo.nativo || dopo.ripiegoCss,
      'la madre deve allargare il grafico per una delle due strade (nativa o ripiego in CSS): ' +
      JSON.stringify(dopo));
    if (dopo.nativo) {
      assert.equal(dopo.chi, 'chartWrap',
        'a schermo intero deve andarci il grafico, non altro: ' + JSON.stringify(dopo));
    }
  } finally { await browser.close(); }
});

test('VOCE 2: il ripiego in CSS allarga il grafico anche senza schermo intero nativo', async () => {
  // La strada che serve nell'app vera, dove la richiesta nativa puo' essere ignorata in silenzio.
  const {browser, madre} = await conUnaDuplicata();
  try {
    const r = await madre.evaluate(() => {
      fblEntraSchermoInteroCss();
      const attivo = !!fblSchermoInteroCssAttivo();
      const w = document.getElementById('chartWrap');
      const alto = w ? w.getBoundingClientRect().height : 0;
      fblEsciSchermoInteroCss();
      return {attivo, alto, uscito: !!fblSchermoInteroCssAttivo(),
              finestra: window.innerHeight};
    });
    console.log('ripiego in CSS:', JSON.stringify(r));
    assert.equal(r.attivo, true, 'il ripiego deve attivarsi: ' + JSON.stringify(r));
    assert.ok(r.alto > r.finestra * 0.7,
      'col ripiego il grafico deve prendersi quasi tutta la finestra: alto ' + r.alto +
      ' su ' + r.finestra);
    assert.equal(r.uscito, false, 'e si deve poter uscire');
  } finally { await browser.close(); }
});

test('VOCE 3: nella duplicata la pagina non scorre, nella madre si', async () => {
  const {browser, madre, duplicata} = await conUnaDuplicata();
  try {
    const misura = async (pag) => {
      const q = await pag.evaluate(() => ({
        slot: (typeof PIP_SLOT !== 'undefined') ? PIP_SLOT : null,
        scorrevole: document.documentElement.scrollHeight - document.documentElement.clientHeight
      }));
      await pag.mouse.move(400, 300);
      await pag.mouse.wheel(0, 600);
      await pag.waitForTimeout(400);
      q.dopoRotellina = await pag.evaluate(() =>
        document.documentElement.scrollTop || document.body.scrollTop || 0);
      return q;
    };
    const m = await misura(madre), d = await misura(duplicata);
    console.log('scorrimento madre:', JSON.stringify(m), '| duplicata:', JSON.stringify(d));
    assert.equal(d.slot, 2, 'la seconda pagina deve essere una duplicata');
    assert.equal(d.scorrevole, 0,
      'nella duplicata non ci deve essere niente da scorrere: ' + JSON.stringify(d));
    assert.equal(d.dopoRotellina, 0,
      'e la rotellina non deve muovere la pagina: ' + JSON.stringify(d));
    // CONTROLLO: se la madre non scorresse, la prova sopra sarebbe verde per il motivo sbagliato
    // (una pagina che non scorre da nessuna parte non dimostra niente sulla duplicata).
    assert.ok(m.dopoRotellina > 0,
      'sulla madre lo scorrimento deve restare, altrimenti questo banco non distingue niente: ' +
      JSON.stringify(m));
  } finally { await browser.close(); }
});
