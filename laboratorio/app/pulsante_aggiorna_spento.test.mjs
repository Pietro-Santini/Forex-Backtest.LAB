// IL PULSANTE "AGGIORNA" SI SPEGNE DOPO L'AGGIORNAMENTO.
//
// SEGNALATO dal proprietario (26 ottobre 2026): «rimane il tasto aggiorna in alto a destra della
// pagina, mentre dentro impostazioni di versione il tasto aggiorna non c'è, rimane in memoria e
// non va via il pulsante sulla pagina principale».
//
// LA CAUSA misurata nel codice: quando il pacchetto (Setup.exe / APK) si apre nel browser di
// sistema, il ramo `apertoEsterno` di fblApplicaAggiornamento() RIATTIVAVA il pulsante
// (`btn.disabled=false; btn.textContent='⬇️ Aggiorna'`) e non annotava il tag visto. Il pulsante
// restava quindi sulla pagina principale, e al controllo successivo ricompariva.
//
// LA CURA: in quel ramo il pulsante si SPEGNE e il tag si annota. Se l'installazione non dovesse
// andare a buon fine, «Controlla aggiornamenti» (che passa forza=true) lo fa tornare, perche' la
// versione installata e' ancora quella vecchia.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('dopo l\'aggiornamento col pacchetto esterno il pulsante si spegne', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async () => {
      // Il pulsante della barra in alto, nascosto di default.
      const btn = document.getElementById('fblAggiornaBtn');
      if (!btn) return {errore: 'pulsante assente'};
      btn.style.display = '';                 // come quando la release nuova compare
      btn.disabled = false;
      // Il pacchetto serve (PC Windows con il programma installato che non si aggiorna da solo)
      // e si apre nel browser esterno: il caso del proprietario.
      window.fblPianoAggiornamento = async () => ({serve: true, motivo: 'pacchetto richiesto'});
      window.fblScaricaEAggiorna = async () => ({ok: true, apertoEsterno: true});
      try { localStorage.removeItem('fbl_rel_vista'); } catch (e) {}
      await fblApplicaAggiornamento({tag_name: 'v2.0.29', assets: []}, 'v2.0.29', btn);
      return {
        display: btn.style.display,
        tagVisto: localStorage.getItem('fbl_rel_vista'),
      };
    });
    assert.ok(!r.errore, 'il pulsante della barra deve esistere: ' + r.errore);
    assert.equal(r.display, 'none', 'dopo l\'aggiornamento il pulsante in alto si SPEGNE: ' + JSON.stringify(r));
    assert.equal(r.tagVisto, 'v2.0.29', 'e il tag resta annotato per non riproporlo al prossimo avvio: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
