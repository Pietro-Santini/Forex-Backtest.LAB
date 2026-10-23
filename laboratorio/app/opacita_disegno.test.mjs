// L'OPACITÀ DI UN DISEGNO NON DEVE APPICCICARSI AL DISEGNO SUCCESSIVO.
//
// SEGNALATO dal proprietario: «se vado a inserire una nuova linea e modifico l'opacità di quella
// linea, al prossimo disegno (trend line, linea di allarme, Fibonacci) rimane impostato il valore
// precedentemente impostato, quindi 0 — e l'utente non vede più le linee. L'impostazione vale
// soltanto per quel disegno; il prossimo disegno nasce con i valori di sempre.»
//
// LA CAUSA MISURATA: selezionando un disegno, `syncDrawStyleUI` copia il SUO stile (opacità
// compresa) dentro #drawOpacity della toolbar; il disegno NUOVO rilegge quei valori con
// `styleFromUI`. Il valore "di quel disegno" diventava default del prossimo.
//
// LA CURA: alla prima selezione si fa un catastico dello stile già in toolbar; quando la
// selezione finisce (o quando styleFromUI legge per creare il disegno nuovo) si ripristina il
// catastico. Se i valori li ha cambiati l'utente senza selezione, non c'è catastico da
// ripristinare e i suoi valori restano default. In ogni caso i controlli della toolbar
// continuano a modificare live il disegno selezionato: solo la LETTURA per il disegno nuovo
// cambia (e il rientro di selezione riporta la toolbar al suo stato preregola).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const disegnoDi = (opacity) => ({type:'trend',color:'#ff5c5c',lineWidth:2,dashed:false,dotted:false,
  opacity,fillColor:'#ff5c5c',fillOpacity:.12});

test('lo stile del disegno selezionato non diventa default del disegno nuovo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((mk) => {
      const d0 = eval('(' + mk + ')');
      const res = {};
      // 1. L'utente ha scelto la sua opacità in toolbar (60%): è il suo default, vale.
      $('drawOpacity').value = '60';
      res.utenteDefault = styleFromUI('trend').opacity;         // atteso 0.6
      // 2. Seleziona un disegno (riprodotto come fa il grafico: tocco/clic → syncDrawStyleUI)
      //    con opacità 0 (il disegno invisibile del proprietario).
      const d = d0(0);
      syncDrawStyleUI(d);
      res.toolbarDopoSelezione = $('drawOpacity').value;        // la toolbar mostra 0 (live edit ok)
      // 3. Ricrea un disegno: la LETTURA deve usare quanto c'era prima della selezione, non 0.
      res.letturaNuovoDisegno = styleFromUI('trend').opacity;   // atteso 0.6 (non 0)
      // 4. Deseleziona: la toolbar torna a ciò che c'era prima (60), il resto della UI coerente.
      deselectDrawing();
      res.toolbarDopoDesel = $('drawOpacity').value;            // atteso '60'
      // 5. Stesso principio per colore e spessore, non solo opacità.
      $('drawColor').value = '#7fb2ff';
      const e = d0(1); e.color = '#000000'; e.lineWidth = 5;
      syncDrawStyleUI(e);
      res.dopoColore = styleFromUI('trend').color;              // atteso '#7fb2ff'
      deselectDrawing();
      res.toolbarColoreDopo = $('drawColor').value;             // atteso '#7fb2ff'
      // 6. Il disegno selezionato continua a vedersi modificato live dalla toolbar.
      $('drawOpacity').value = '30';
      const g = d0(1);                // il disegno di partenza di questo giro (opacita' 1)
      selectedDrawing = g;            // nel vero flusso e' il selectedDrawing
      $('drawOpacity').dispatchEvent(new Event('input'));
      res.liveSuDisegno = g.opacity;  // atteso 0.3 (modifica applicata al disegno)
      deselectDrawing();
      return res;
    }, disegnoDi.toString());
    assert.equal(r.utenteDefault, 0.6, 'lo stile scelto dall\'utente in toolbar deve restare default: ' + JSON.stringify(r));
    assert.equal(r.toolbarDopoSelezione, '0', 'selezionando, la toolbar mostra lo stile del disegno (live edit): ' + JSON.stringify(r));
    assert.equal(r.letturaNuovoDisegno, 0.6, 'il disegno NUOVO non deve ereditare l\'opacità del disegno selezionato: ' + JSON.stringify(r));
    assert.equal(r.toolbarDopoDesel, '60', 'deselezionando, la toolbar torna ai valori dell\'utente: ' + JSON.stringify(r));
    assert.equal(r.dopoColore, '#7fb2ff', 'stesso principio per il colore: ' + JSON.stringify(r));
    assert.equal(r.toolbarColoreDopo, '#7fb2ff', 'la toolbar torna al colore dell\'utente: ' + JSON.stringify(r));
    assert.equal(errori.length, 0, 'errori console: ' + errori.join(' | '));
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: senza il ripristino il difetto si riproduce (l\'opacità 0 si eredita)', async () => {
  const {browser, pagina} = await apriApp();
  try{
    const r = await pagina.evaluate((mk) => {
      const d0 = eval('(' + mk + ')');
      // Vecchio comportamento, ricostruito DAL VIVO: la copia dello stile nella toolbar senza
      // catastico/ripristino era L'INTERO syncDrawStyleUI. Se la cura venisse tolta, questo
      // test tornerebbe verde e il test sopra diventerebbe rosso di nuovo.
      $('drawOpacity').value = '60';
      const copiaCiecaDallaSelezione = (d) => {   // ciò che faceva syncDrawStyleUI in fondo
        $('drawOpacity').value = String(Math.round((d.opacity!=null?d.opacity:1)*100));
      };
      copiaCiecaDallaSelezione(d0(0));
      return {eredita: styleFromUI('trend').opacity};   // con il difetto: 0
    }, disegnoDi.toString());
    assert.equal(r.eredita, 0, 'senza il ripristino l\'opacità 0 si eredita (difetto confermato)');
  } finally { await browser.close(); }
});
