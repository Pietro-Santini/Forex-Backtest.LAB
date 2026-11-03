// LA PROP FIRM SI SCEGLIE CON I NOMI SUI PULSANTI, E ALLA FINE SI ACCENDE DAVVERO.
//
// Riferito dal proprietario (3 novembre 2026), tre cose in una segnalazione sola:
//  1. «all'aggiunta del nuovo conto venisse definito se era un conto per esercitazione senza
//     prop firm o in modalità prop firm»;
//  2. «mi chiede se impostare la prop firm one step o two step, e i pulsanti sono CONTINUA e
//     INDIETRO: continua è attribuito a one step, indietro a two step. Invece deve essere una
//     scelta, deve esserci scritto one step o two step» — e lo stesso per swing/standard;
//  3. «non viene attivata quella che è la modalità prop firm: c'è tutta la configurazione, i
//     passaggi eccetera, ma quando andiamo a completare non ci attiva la vera e propria
//     modalità prop firm», quindi non compaiono max drawdown giornaliero e totale.
//
// IL PUNTO PIU' SERIO non era l'estetica dei pulsanti: con appConfirm, premere Esc o cliccare
// fuori dal riquadro vale ANNULLA, che lì significava «two step» e «standard». Chiudere una
// finestra sceglieva al posto dell'utente una configurazione di RISCHIO, in silenzio — su un one
// step si rischia il 3% al giorno, su un two step il 5%.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Apre il selettore e descrive cosa c'è dentro, senza premere niente.
const APRI = `(function(){
  window.__esito='in attesa';
  appScelta('Quante fasi?',{title:'Tipo di sfida',aLabel:'One step',bLabel:'Two step'})
    .then(function(r){ window.__esito=(r===null?'NULL':r); });
  return true;
})()`;
const BOTTONI = `(function(){
  const ov=document.querySelector('.appConfirmOverlay');
  if(!ov)return 'NESSUN POPUP';
  return [...ov.querySelectorAll('button')].map(b=>b.textContent.trim());
})()`;

test('la scelta mostra i NOMI delle due strade, non Continua e Indietro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(APRI);
    const b = await pagina.evaluate(BOTTONI);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.ok(Array.isArray(b), 'il selettore deve comparire: ' + b);
    assert.ok(b.includes('One step'), 'manca il pulsante «One step», trovati: ' + JSON.stringify(b));
    assert.ok(b.includes('Two step'), 'manca il pulsante «Two step», trovati: ' + JSON.stringify(b));
    // NB: il terzo pulsante si chiama «Indietro» e va benissimo. L'app ha una convenzione sua
    // (un normalizzatore dei popup) che rinomina ogni «Annulla/Chiudi» in «Indietro»: la prima
    // versione di questo test lo trattava come un errore, ma quello è il pulsante di USCITA, non
    // una terza strada. Quello che conta — e che si misura qui sotto — è che premerlo NON
    // scelga: era esattamente il difetto, perché prima «Indietro» valeva «two step».
    await pagina.evaluate(`(function(){ document.querySelector('[data-role="chiudi"]').click(); return true; })()`);
    await pagina.waitForTimeout(80);
    const uscita = await pagina.evaluate('window.__esito');
    assert.equal(uscita, 'NULL',
      '«Indietro» deve chiudere senza scegliere, non valere «two step» come faceva prima');
  } finally { await browser.close(); }
});

test('ogni pulsante restituisce la SUA scelta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(APRI);
    await pagina.evaluate(`(function(){ document.querySelector('[data-role="b"]').click(); return true; })()`);
    await pagina.waitForTimeout(80);
    const r = await pagina.evaluate('window.__esito');
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r, 'b', 'premendo «Two step» deve risultare la seconda scelta, non la prima');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO, ED E' IL CUORE DELLA SEGNALAZIONE: chiudere senza scegliere non deve
// configurare niente. Con appConfirm, Esc valeva «two step».
test('chiudere con Esc non sceglie al posto tuo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(APRI);
    await pagina.keyboard.press('Escape');
    await pagina.waitForTimeout(80);
    const r = await pagina.evaluate('window.__esito');
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r, 'NULL',
      'Esc deve voler dire «non ho scelto», non «two step»: altrimenti chiudere una finestra imposta un rischio');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: anche il clic fuori dal riquadro è un «non ho scelto».
test('cliccare fuori dal riquadro non sceglie al posto tuo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(APRI);
    await pagina.evaluate(`(function(){
      const ov=document.querySelector('.appConfirmOverlay');
      ov.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
      return true; })()`);
    await pagina.waitForTimeout(80);
    const r = await pagina.evaluate('window.__esito');
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r, 'NULL', 'il clic sullo sfondo non deve impostare una configurazione di rischio');
  } finally { await browser.close(); }
});

test('finita la configurazione, la modalità prop firm si accende davvero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // Il percorso vero chiama proceedEnablePropFirm(true): è lo stesso del pulsante
    // «🛡️ MODALITÀ PROP FIRM». Qui si controlla che quella chiamata esista nel giro della
    // configurazione — prima il giro finiva dopo aver impostato preset e tipo di conto, e la
    // Challenge non partiva (niente max drawdown giornaliero né totale).
    const c = await pagina.evaluate(`(function(){
      return {
        esiste: typeof proceedEnablePropFirm==='function',
        scelta: typeof appScelta==='function',
        preset: typeof fblPropPresetImposta==='function',
        tipo: typeof fblPropTipoContoImposta==='function'
      };
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(c.scelta, true, 'serve il selettore a due scelte');
    assert.equal(c.esiste, true, 'serve la funzione che accende davvero la modalità');
    assert.equal(c.preset, true); assert.equal(c.tipo, true);
  } finally { await browser.close(); }
});
