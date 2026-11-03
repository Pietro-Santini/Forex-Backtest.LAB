// MENTRE L'APP SI AGGIORNA, L'APP NON SI USA.
//
// Riferito dal proprietario (3 novembre 2026): «quando l'utente preme il pulsante aggiorna
// l'applicazione, deve uscire fuori il pop-up dello scaricamento dei pacchetti, della nuova
// release, e non far continuare l'utilizzo dell'applicazione, perché se no magari l'utente fa una
// cosa e avvia subito l'installazione, quindi chiude l'applicazione. Facciamo in modo che esce
// fuori un pop-up dove indica installazione in corso, aggiornamento in corso.»
//
// Non è cortesia: durante l'aggiornamento il ponte si ferma, i servizi si spengono e l'installer
// chiude l'app. Un ordine piazzato in quel mezzo minuto è un ordine piazzato mentre il pavimento
// sta sparendo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Cosa si vede e cosa si può toccare: si misura col punto esatto al centro dello schermo, cioè
// quello che intercetta davvero il clic (elementFromPoint), non con una lettura degli stili.
const STATO = `(function(){
  const ov=document.getElementById('fblAggOverlay');
  const acceso=!!(ov&&ov.classList.contains('acceso'));
  const cx=Math.floor(innerWidth/2), cy=Math.floor(innerHeight/2);
  const sotto=document.elementFromPoint(cx,cy);
  const dentroIlVelo=!!(ov&&sotto&&(sotto===ov||ov.contains(sotto)));
  const fase=document.getElementById('fblAggFase');
  const chiudi=document.getElementById('fblAggChiudi');
  return {acceso, dentroIlVelo, testo:fase?fase.textContent:'',
    uscita: chiudi?getComputedStyle(chiudi).display!=='none':false};
})()`;

test('il pannello copre la pagina e si prende i clic al posto dell\'app', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const prima = await pagina.evaluate(STATO);
    // Controllo del banco: senza questo il test passerebbe anche se il velo ci fosse sempre.
    assert.equal(prima.acceso, false, 'ad app aperta il pannello non deve esserci');
    assert.equal(prima.dentroIlVelo, false, 'e i clic devono arrivare alla pagina');

    await pagina.evaluate(`(function(){ fblAggPannello('Scarico il pacchetto…'); return true; })()`);
    const dopo = await pagina.evaluate(STATO);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(dopo.acceso, true, 'premendo Aggiorna il pannello deve comparire');
    assert.equal(dopo.dentroIlVelo, true,
      'il clic al centro dello schermo deve finire sul velo, non su un pulsante dell\'app');
    assert.match(dopo.testo, /Scarico il pacchetto/, 'il pannello deve dire cosa sta succedendo');
  } finally { await browser.close(); }
});

test('il pannello non si chiude premendo Esc né cliccandoci sopra', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(`(function(){ fblAggPannello('Installazione in corso…'); return true; })()`);
    await pagina.keyboard.press('Escape');
    await pagina.waitForTimeout(80);
    const dopoEsc = await pagina.evaluate(STATO);
    await pagina.mouse.click(10, 10);
    await pagina.waitForTimeout(80);
    const dopoClic = await pagina.evaluate(STATO);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(dopoEsc.acceso, true, 'Esc non deve far tornare usabile un\'app che si sta chiudendo');
    assert.equal(dopoClic.acceso, true, 'e nemmeno un clic di fianco');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: il velo non deve poter restare appeso per sempre su un'app ancora viva.
// Quando l'aggiornamento finisce in una strada che lascia l'app funzionante (pacchetto da
// installare a mano), compare il motivo e una via d'uscita.
test('quando l\'app resta viva il pannello offre una via d\'uscita', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(`(function(){
      fblAggPannello('Il pacchetto è nella cartella Download. Aprilo e installa.',{fermo:true});
      return true; })()`);
    const fermo = await pagina.evaluate(STATO);
    assert.equal(fermo.uscita, true, 'deve esserci il pulsante per tornare all\'app');
    await pagina.evaluate(`(function(){ document.getElementById('fblAggChiudi').click(); return true; })()`);
    await pagina.waitForTimeout(80);
    const dopo = await pagina.evaluate(STATO);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(dopo.acceso, false, 'premendolo si torna a lavorare');
    assert.equal(dopo.dentroIlVelo, false, 'e i clic tornano alla pagina');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: il velo si alza al PRIMO istante, prima di qualunque attesa di rete. Il
// momento pericoloso comincia col clic, non quando il pacchetto arriva.
test('il pannello si alza prima ancora di sapere quale aggiornamento serve', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const acceso = await pagina.evaluate(`(function(){
      // fblPianoAggiornamento non risponde mai: si misura l'istante prima di ogni attesa.
      fblPianoAggiornamento=function(){ return new Promise(function(){}); };
      const btn=document.createElement('button'); document.body.appendChild(btn);
      fblApplicaAggiornamento({},'v9.9.9',btn);
      const ov=document.getElementById('fblAggOverlay');
      return !!(ov&&ov.classList.contains('acceso'));
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(acceso, true,
      'il velo deve essere gia\' su mentre si decide cosa scaricare, non dopo');
  } finally { await browser.close(); }
});
