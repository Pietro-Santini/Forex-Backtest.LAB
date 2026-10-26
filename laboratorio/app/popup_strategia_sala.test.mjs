// IL MENU DELLA STRATEGIA DI SALA: al centro della pagina, con il nome della sala.
//
// SEGNALATO dal proprietario (26 ottobre 2026):
//   «in modalità a tutto schermo abbiamo problemi con la visualizzazione del pop-up delle
//    strategie di ogni sala segnali. Non viene visualizzata ... quei pop-up delle strategie
//    vengono messi tutti alla destra, invece no, deve stare al centro pagina, non può stare
//    tutto a destra, perché sennò il bordo lo copre. Al massimo, dentro al pop-up, ci
//    mettiamo il nome della sala segnale in alto a sinistra.»
//
// LA CAUSA misurata nel codice: tgAutoPosizionaPop() ancorava il menù al pulsante premuto
// (`left=Math.min(r.left, ...)`), quindi finiva a DESTRA della pagina, tagliato dal bordo; e
// lo z-index era 96, troppo basso per stare sopra al grafico a tutto schermo.
//
// LA CURA: il menù è centrato orizzontalmente, lo z-index è sopra ogni altro elemento e in
// testa al menù compare il nome della sala (o "Strategia unica"), così si riconosce subito
// quale strategia si sta modificando.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('il menù della strategia sta al centro della pagina, non a destra', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      // Un menù finto già aperto, con misure note.
      tgAutoPop = document.createElement('div');
      tgAutoPop.className = 'tgStratPop';
      tgAutoPop.style.width = '600px';
      tgAutoPopChiave = 'PipHunter';
      tgAutoPopInfo = {cfg: {}, quanti: 2, dove: 'di questa sala'};
      document.body.appendChild(tgAutoPop);
      // Il pulsante è in FONDO A DESTRA: è il caso in cui il menù finiva tagliato dal bordo.
      const btn = document.createElement('button');
      btn.style.position = 'fixed';
      btn.style.left = (window.innerWidth - 200) + 'px';
      btn.style.top = (window.innerHeight - 100) + 'px';
      btn.style.width = '120px';
      btn.style.height = '40px';
      document.body.appendChild(btn);
      tgAutoPosizionaPop(btn);
      const left = parseFloat(tgAutoPop.style.left);
      const w = tgAutoPop.offsetWidth;
      const centroAtteso = Math.round((window.innerWidth - w) / 2);
      const dentro = left >= 0 && left + w <= window.innerWidth;
      const vicinoAlCentro = Math.abs(left - centroAtteso) <= 2;
      tgAutoPop.remove(); btn.remove(); tgAutoPop = null;
      return {left, w, centroAtteso, dentro, vicinoAlCentro, innerWidth: window.innerWidth};
    });
    assert.ok(r.dentro, 'il menù deve stare DENTRO la finestra (non tagliato dal bordo destro): ' + JSON.stringify(r));
    assert.ok(r.vicinoAlCentro, 'il menù deve essere centrato orizzontalmente: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in testa al menù compare il nome della sala', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      // Il corpo del menù (le regole della sala) non serve a questa misura: lo si svuota,
      // così la configurazione vuota non fa crashare il costruttore. Qui si misura la TESTA.
      window.tgAutoCostruisciRegole = function(){};
      tgAutoPop = document.createElement('div');
      tgAutoPop.className = 'tgStratPop';
      tgAutoPopChiave = 'PipHunter';
      tgAutoPopInfo = {cfg: {}, quanti: 2, dove: 'di questa sala'};
      document.body.appendChild(tgAutoPop);
      tgAutoRiempiStrat();
      const primi = [...tgAutoPop.children].slice(0, 2).map(e => e.textContent);
      tgAutoPop.remove(); tgAutoPop = null;
      return {primi};
    });
    assert.ok(r.primi.join(' ').indexOf('PipHunter') >= 0,
      'il nome della sala deve comparire in alto nel menù: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
