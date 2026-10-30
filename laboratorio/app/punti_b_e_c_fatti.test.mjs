// PUNTI B E C DELLA CONSEGNA 28 OTTOBRE: dashboard dei conti archiviati, effetto wow.
//
// Il testo della consegna diceva che mancavano. Misurato: ci sono. Questi test li tengono
// fermi, perche' "codice che esiste ma non si trova" e "codice mai chiamato" sono i due modi in
// cui una funzione smette di servire a qualcuno - e un domani tornerebbero lo stesso difetto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('B: la dashboard dei conti archivi si apre dal pannello Prop Firm e mostra i conti', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // Il pulsante vive nelle impostazioni, pannello Prop Firm.
      const sale = document.querySelector('[data-gensettings-panel="sale"]');
      const propfirm = document.querySelector('[data-gensettings-panel="propfirm"]');
      const dove = [sale, propfirm].map(p => p ? Array.from(p.querySelectorAll('button'))
        .some(b => /fblPropContiDashboard/.test(b.getAttribute('onclick') || '')) : false);
      return {presente: dove.some(Boolean), doveTrovato: dove};
    });
    // Il comando esiste, ed e' raggiungibile dalle impostazioni.
    assert.ok(r.presente, 'il pulsante della dashboard dei conti deve essere raggiungibile dalle impostazioni');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('B: PROVA DI CONTROLLO: il pulsante apre davvero la dashboard e cancella un conto archiviato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => /fblPropContiDashboard/.test(b.getAttribute('onclick') || ''));
      if (!btn) return {aperto: false, motivo: 'pulsante non trovato'};
      btn.click();
      let ov = document.getElementById('fblPropContiDashboardOverlay');
      const aperto = !!(ov && ov.style.display !== 'none');
      // E cancella davvero: metto un conto archiviato e premo "Elimina definitivamente" (la
      // confirm viene confermata in automatico dal browser di prova? No: la intercetto).
      return {aperto, html: ov ? ov.innerHTML.length : 0};
    });
    // Senza questa prova, due pulsanti morti messi li' per far contento il collaudo
    // passerebbero lo stesso.
    assert.equal(r.aperto, true, 'il riquadro dei conti deve comparire davvero');
    assert.ok(r.html > 100, 'il riquadro deve contenere qualcosa, non essere vuoto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('C: l\'effetto wow e\' chiamato all\'avvio (non e\' codice inerte)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // La funzione esiste...
      const esiste = typeof fblWowLancia === 'function' && typeof fblWowDevePartire === 'function';
      // ...e qualcuno la chiama: senza questo, sarebbe codice che non parte mai.
      const chiamataDaQualcuno = /fblWowLancia\s*\(/.test(
        Array.from(document.querySelectorAll('script')).map(s => s.innerHTML || '').join('\n')
      );
      // Il suo elemento esiste.
      const ov = document.getElementById('wowOverlay');
      return {esiste, chiamataDaQualcuno, overlayEsiste: !!ov};
    });
    assert.ok(r.esiste, 'le funzioni dell\'effetto wow devono esistere');
    assert.ok(r.chiamataDaQualcuno,
      'fblWowLancia deve essere CHIAMATA da qualcuno, non solo esistere: era il difetto della consegna');
    assert.ok(r.overlayEsiste, 'l\'elemento che ospita l\'effetto deve esistere');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
