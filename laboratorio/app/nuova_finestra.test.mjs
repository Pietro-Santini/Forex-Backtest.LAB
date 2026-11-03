// IL PULSANTE «NUOVA FINESTRA» DEVE ESISTERE, E DEVE VEDERSI.
//
// Riferito dal proprietario (3 novembre 2026): «facciamo come TradingView: col pulsante ci crea
// una nuova finestra, e se lo riclicchiamo di nuovo ci crea una terza schermata, se lo
// riclicchiamo per la quarta volta ci crea una quarta finestra, e così via dicendo. Togliamo la
// barra con il pulsante X a destra... ci sganciamo da quel sistema.»
//
// TRE DIFETTI MISURATI SULLA v2.0.79, tutti nello stesso pulsante:
//
//   1. IL PULSANTE NON ESISTEVA AFFATTO. Il commento HTML che lo precede finiva con `*/` invece
//      di `-->`: in HTML `*/` non chiude niente, quindi il commento restava APERTO e si mangiava
//      il pulsante. Misurato: document.getElementById('nuovaFinestraBtn') === null. La funzione
//      e' stata pubblicata in tre versioni (2.0.75, 2.0.76, 2.0.78) senza alcun modo di aprirla.
//      Nessun test la guardava: e' per questo che e' passata.
//   2. ANCHE ESISTENDO, SAREBBE STATO INVISIBILE. updateFloatCornerButtons() lo mostrava solo
//      con `active && EXTRA_PIP_WINDOWS_ENABLED`, dove `active` vuol dire "il VECCHIO PIP e'
//      acceso": sulla pagina normale e' falso. Regola giusta quando erano i pulsantini 2/3/4
//      dentro la finestra staccata, sbagliata da quando sono la porta principale.
//   3. IL TETTO ERA TRE. Al quarto clic non nasceva niente: si tornava sulla prima finestra.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const VIS = `(function(){
  const vis=(id)=>{ const e=document.getElementById(id);
    if(!e) return 'ASSENTE';
    const s=getComputedStyle(e);
    if(s.display==='none'||s.visibility==='hidden') return false;
    const r=e.getBoundingClientRect();
    return r.width>0 && r.height>0; };
  return {nuova:vis('nuovaFinestraBtn'), vecchioPip:vis('floatChartBtn'),
          tetto:(typeof FBL_FINESTRE_MAX!=='undefined')?FBL_FINESTRE_MAX:'ASSENTE'};
})()`;

test('il pulsante «Nuova finestra» esiste nel DOM e si vede appena apri l\'app', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const v = await pagina.evaluate(VIS);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.notEqual(v.nuova, 'ASSENTE',
      'il pulsante non esiste nel DOM: controlla che il commento HTML sopra di lui sia chiuso con --> e non con */');
    assert.equal(v.nuova, true,
      'esiste ma non si vede: senza di lui non c\'è nessun modo di aprire una finestra nuova');
  } finally { await browser.close(); }
});

test('il vecchio PIP, con la sua barra e la ✕, non è più sulla pagina', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // Non basta guardarlo appena aperto: updateFloatCornerButtons() gira a ogni
    // ridimensionamento e rimetteva il pulsante a 'flex', annullando il display:none dell'HTML.
    // E' la stessa trappola delle frecce doppie, quindi qui la funzione la si fa girare apposta.
    await pagina.evaluate(`(function(){ try{ updateFloatCornerButtons(); }catch(e){} return true; })()`);
    const v = await pagina.evaluate(VIS);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(v.vecchioPip, false,
      'il vecchio PIP deve restare nascosto anche dopo un giro di aggiornamento dei pulsanti');
    assert.equal(v.nuova, true,
      'e «Nuova finestra» deve restare visibile: non si devono perdere tutti e due');
  } finally { await browser.close(); }
});

test('si possono aprire più di tre finestre', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const v = await pagina.evaluate(VIS);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.notEqual(v.tetto, 'ASSENTE', 'il tetto delle finestre deve essere dichiarato');
    assert.ok(v.tetto > 4,
      '«e così via dicendo»: il tetto di 3 finestre (slot 2,3,4) era troppo basso, ora è ' + v.tetto);
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: ogni clic deve prendere uno slot LIBERO, non ripresentare sempre la prima
// finestra. Senza questa prova, un tetto più alto non servirebbe a niente.
test('ogni clic apre la finestra successiva, non sempre la stessa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const slot = await pagina.evaluate(`(function(){
      const chiesti=[];
      // Si intercetta l'apertura invece di aprire davvero otto finestre vere nel banco.
      openExtraPipWindow=function(s){ chiesti.push(s); extraPipWindows[s]={closed:false,focus:function(){}}; };
      const b=document.getElementById('nuovaFinestraBtn');
      for(let i=0;i<5;i++) b.click();
      return chiesti;
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.deepEqual(slot, [2,3,4,5,6],
      'cinque clic devono aprire cinque finestre diverse, invece ha chiesto: ' + JSON.stringify(slot));
  } finally { await browser.close(); }
});
