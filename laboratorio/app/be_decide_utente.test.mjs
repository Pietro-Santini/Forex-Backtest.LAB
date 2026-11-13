// IL PAREGGIO LO DECIDE L'UTENTE: LA FORBICE AVVISA, NON METTE IL VETO (13 novembre 2026).
//
// SEGNALATO dal proprietario con lo schermo davanti, leggendo la barra di stato dire «Pareggio
// NON spostato: cadrebbe a 12.8 pip dal prezzo, dentro la forbice del cambio giornata»:
// «in realta' lo deve ignorare, e' un'azione che fa l'utente, quindi l'azione dell'utente e'
// prioritaria su quello che dice lui. Il BE non viene inserito SOLO se il prezzo non e'
// abbastanza lontano da poter impostare il BE con le rispettive impostazioni del setting sulla
// distanza in guadagno in pip».
//
// Quindi: un solo rifiuto resta in piedi (lo stop cadrebbe OLTRE il prezzo e chiuderebbe la
// posizione all'istante, che non e' un parere ma un ordine che si rifiuta da solo), e la forbice
// diventa un avviso scritto accanto al risultato.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Una posizione in guadagno, con il prezzo lontano dall'entrata: il pareggio e' valido.
const SCENA = `(function(){
  positions.length=0; trades.length=0;
  liveModeActive=true; mt5Connected=false; currentAssetKey='EURUSD';
  const pos={id:'p1', asset:'EURUSD', side:'BUY', entry:1.1000, lots:0.10,
             sl:1.0950, tp:1.1100, startTime:Date.now()-600000, openTF:1, mt5Ticket:null};
  positions.push(pos);
  // Il prezzo di adesso, ben sopra l'entrata: il pareggio cade DIETRO il prezzo, quindi il
  // rifiuto «stop oltre il prezzo» non c'entra e si misura solo la forbice.
  window.fblPrezzoVeroPosizione=function(){ return 1.1050; };
  return pos.id;
})()`;

test('con la forbice larga il pareggio si sposta LO STESSO, e lo dice', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((scena) => {
      eval(scena);
      const pos = positions[0];
      const slPrima = pos.sl;
      // La guardia della forbice dice «troppo vicino»: e' esattamente la situazione dello
      // screenshot del proprietario. Si sostituisce la GUARDIA, non la decisione: qui si misura
      // cosa fa il pulsante quando la guardia si lamenta.
      window.fblStopTroppoVicino = () => ({vicino: true, distanza: 0.00128, forbice: 0.0018});
      const esito = applyBreakevenToPosition(pos);
      return {esito, slPrima, slDopo: pos.sl,
              stato: String(document.getElementById('status').textContent || ''),
              rifiutatoIl: pos.bePareggioRifiutatoIl || null};
    }, SCENA);
    console.log('BE con forbice larga:', JSON.stringify(r));

    assert.notEqual(r.esito, false, 'il pareggio NON deve essere rifiutato: ' + JSON.stringify(r));
    assert.notEqual(r.slDopo, r.slPrima,
      'e lo stop deve essersi davvero spostato: ' + JSON.stringify(r));
    assert.ok(/pareggio/i.test(r.stato),
      'la barra di stato deve dire che e stato spostato: ' + r.stato);
    assert.ok(/Attenzione/i.test(r.stato),
      'ma l avviso della forbice deve restare scritto, perche l informazione serve: ' + r.stato);
    assert.ok(/come hai chiesto/i.test(r.stato),
      'e deve essere chiaro che si e proceduto su richiesta: ' + r.stato);
    assert.equal(r.rifiutatoIl, null,
      'e non va segnato come rifiutato, altrimenti il resto dell app crede che non sia successo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("RESTA il rifiuto vero: uno stop oltre il prezzo chiuderebbe la posizione all'istante", async () => {
  // E' l'unico caso che il proprietario ha lasciato in piedi: «il BE non viene inserito solo se
  // il prezzo non e' abbastanza lontano». Con il pareggio spostato in guadagno di N pip e il
  // prezzo che non ci e' ancora arrivato, lo stop cadrebbe oltre il prezzo.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((scena) => {
      eval(scena);
      const pos = positions[0];
      // Il prezzo e' appena sopra l'entrata: il pareggio + lo spostamento cade oltre.
      window.fblPrezzoVeroPosizione = function () { return 1.10001; };
      window.fblStopTroppoVicino = () => ({vicino: false, distanza: 1, forbice: 0});
      // Pareggio spostato in guadagno di 10 pip, come l'impostazione del proprietario.
      // NOTA sul numero che si legge nel messaggio: in questa scena non ci sono candele
      // caricate, quindi pipSize() ripiega su un valore grosso e il livello stampato esce
      // buffo (2.10000 invece di 1.10100). Non e' uno sbaglio di scala dell'app - lo stesso
      // conto con le candele vere torna giusto - e non cambia cio' che si misura qui: che
      // uno stop OLTRE il prezzo venga rifiutato.
      window.fblBeOffsetPip = () => 10;
      const slPrima = pos.sl;
      const esito = applyBreakevenToPosition(pos);
      return {esito, slPrima, slDopo: pos.sl,
              stato: String(document.getElementById('status').textContent || '')};
    }, SCENA);
    console.log('BE oltre il prezzo:', JSON.stringify(r));
    assert.equal(r.esito, false, 'questo rifiuto resta: ' + JSON.stringify(r));
    assert.equal(r.slDopo, r.slPrima, 'e lo stop non si muove');
    assert.ok(/NON spostato/i.test(r.stato), 'e si spiega perche: ' + r.stato);
  } finally { await browser.close(); }
});
