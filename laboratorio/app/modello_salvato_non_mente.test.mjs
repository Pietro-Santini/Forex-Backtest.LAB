// «MODELLO SALVATO» SI DICE SOLO SE E' SALVATO DAVVERO.
//
// SEGNALATO dal proprietario il 18 novembre 2026: «per quanto riguarda i disegni del tipo linea e
// rettangolo, quando vado a salvarlo mi dice modello salvato, ma dopo quando vado sulla lista dei
// modelli non è presente. Quindi dice che lo salva, ma in realtà non lo salva.»
//
// CAUSA TROVATA, ed è una riga che non guarda un risultato:
//
//     saveDrawingTemplates(templates);        // il risultato NON si guarda
//     renderDrawTemplateMenu();
//     $('status').textContent=`Modello "${nome}" salvato: ...`;
//     return true;                            // true SEMPRE
//
// Dal 17 novembre `saveDrawingTemplates` risponde true/false e, quando la scrittura fallisce,
// scrive nella barra di stato quanto è piena la memoria. Ma nessuno guardava quel risultato: il
// messaggio della memoria veniva scritto e **subito sovrascritto** da «Modello salvato», il menu
// si ridisegnava (vuoto), e la funzione rispondeva `true` - quindi anche il pulsante dentro le
// impostazioni mostrava «✅ Modello salvato». Il programma diceva una cosa falsa, e la diceva con
// una spunta verde.
//
// E' anche il motivo per cui il proprietario non ha mai visto il messaggio della memoria piena
// introdotto il giorno prima: durava un millisecondo.
//
// LA REGOLA: se la scrittura non è andata, non si dice che è andata, non si ridisegna un menu che
// non è cambiato, e non si cancella dalla barra di stato il motivo - che è l'unica cosa che
// permette di capire cosa fare.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Un disegno finto, e la finestra del nome che risponde da sé (niente interfaccia).
const PREPARA = (scritturaRotta) => `(() => {
  window.chiediNomeModello = async () => ({nome:'Prova Supporto', sovrascrivi:false});
  selectedDrawing = {type:'line', color:'#fff', lineWidth:2, dashed:false, dotted:false,
    opacity:1, text:'', x1:0, y1:0, x2:10, y2:10};
  // si parte da zero, cosi' «non c'e'» vuol dire qualcosa
  try{ localStorage.removeItem('fbtDrawingTemplates_v1'); }catch(e){}
  ${scritturaRotta ? `
  // LA MEMORIA RIFIUTA: e' quello che succede quando il deposito del browser e' pieno.
  const vero = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (k,v) => {
    if(String(k).indexOf('fbtDrawingTemplates_v1')===0) throw new Error('QuotaExceededError (finto)');
    return vero(k,v);
  };` : ''}
  return {partenza: Object.keys(loadDrawingTemplates()).length};
})()`;

test('se la memoria rifiuta, NON dice «salvato» e non lo mette in lista', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const p = await pagina.evaluate(PREPARA(true));
    assert.equal(p.partenza, 0, 'la preparazione deve partire senza modelli');

    const r = await pagina.evaluate(async () => {
      const esito = await saveCurrentDrawingAsTemplate();
      return {esito,
        stato: ($('status').textContent||''),
        quanti: Object.keys(loadDrawingTemplates()).length};
    });
    assert.equal(r.esito, false, 'deve rispondere «no»: ha risposto ' + r.esito);
    assert.equal(r.quanti, 0, 'e in lista non ci deve essere niente: ' + r.quanti);
    assert.doesNotMatch(r.stato, /salvato/i,
      'la barra di stato NON deve dire «salvato»: "' + r.stato + '"');
    assert.match(r.stato, /memoria/i,
      'deve restare scritto il motivo, che è l\'unica cosa utile: "' + r.stato + '"');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO: quando la memoria accetta, lo salva e lo dice', async () => {
  // Senza questa, una cura che risponde sempre «no» passerebbe la prova di sopra e romperebbe il
  // salvataggio per tutti.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA(false));
    const r = await pagina.evaluate(async () => {
      const esito = await saveCurrentDrawingAsTemplate();
      const t = loadDrawingTemplates();
      return {esito, stato: ($('status').textContent||''), nomi: Object.keys(t)};
    });
    assert.equal(r.esito, true, 'deve rispondere «sì»');
    assert.deepEqual(r.nomi, ['Prova Supporto'], 'e il modello deve esserci: ' + JSON.stringify(r.nomi));
    assert.match(r.stato, /salvato/i, 'e lo deve dire: "' + r.stato + '"');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO: il modello salvato sopravvive alla rilettura, non vive solo in memoria', async () => {
  // «Dice che lo salva ma non lo salva» puo' avere due forme: non scrivere, oppure scrivere in un
  // posto che la lista non legge. Questa prova chiude la seconda: si rilegge da localStorage, non
  // dalla variabile.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA(false));
    const r = await pagina.evaluate(async () => {
      await saveCurrentDrawingAsTemplate();
      let grezzo=null; try{ grezzo=localStorage.getItem('fbtDrawingTemplates_v1'); }catch(e){}
      const riletto = grezzo ? Object.keys(JSON.parse(grezzo)) : [];
      return {riletto};
    });
    assert.deepEqual(r.riletto, ['Prova Supporto'],
      'il modello deve stare nella stessa chiave che la lista legge: ' + JSON.stringify(r.riletto));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
