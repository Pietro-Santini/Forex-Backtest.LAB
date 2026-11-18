// OGNI CLASSE DI STRUMENTO HA IL SUO CASSETTO DI MODELLI.
//
// SEGNALATO dal proprietario (18 novembre 2026, dopo che lo spazio liberato ha fatto ripartire i
// salvataggi): «gli indicatori e le linee con rettangoli mi fa salvare il modello, per il
// fibonacci e il profilo volumetrico ancora non me li salva i modelli». E prima, in lista: «i
// modelli "Salva come" devono essere distinti per classe (linee/rettangoli, Fibonacci, profilo
// volume a intervallo fisso, profilo volumetrico ancorato, VWAP); l'elenco nomi deve mostrare
// solo quelli della classe».
//
// MISURATO PRIMA DELLA CURA (banco di misura, 18 novembre):
//   - un Fibonacci salvato dalla strada dei disegni finiva in `fbtDrawingTemplates_v1`, cioe' nel
//     menu «Modello ⌄», e NON in `fbtFibTemplates_v1`, che e' il menu «Modello Fib ⌄» dove il
//     proprietario lo cerca. L'app diceva la verita' («salvato») e lo metteva in un altro
//     cassetto: per chi guarda, non salva.
//   - un profilo a intervallo fisso salvava un modello con SOLO colore, spessore e opacita':
//     niente passo, niente percentili, niente righe. Un modello vuoto, e nessun pulsante per
//     salvarlo (sul profilo il tasto destro apre le impostazioni).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';


// I campi veri che l'app mette dentro un profilo o un VWAP appena nato (vedi la creazione in
// app.html, dove sono scritti uno per uno). Qui ne basta un pugno, purche' siano VERI: un
// modello che non li porta e' un modello vuoto.
const DISEGNO = (tipo) => {
  const base = {type:tipo, color:'#3ea6ff', lineWidth:1, dashed:false, dotted:false, opacity:1,
                x1:0,y1:0,x2:10,y2:10, locked:false, hidden:false};
  if (tipo === 'vwap') return Object.assign(base, {
    band1Enabled:true, band1Mult:1.5, band1Color:'#3ea6ff', band1Width:2,
    band2Enabled:true, band2Mult:2.5, band2Color:'#f0a020', band2Width:1,
    band3Enabled:false, band3Mult:3, band3Color:'#c77dff', band3Width:1});
  return Object.assign(base, {
    upColor:'#26a69a', downColor:'#ef5350', buckets:150, barSizePct:400, extendRight:true,
    bgEnabled:true, bgColor:'#ffffff', bgOpacity:7,
    lvnEnabled:true, lvnColor:'#00e676', lvnOpacity:30, lvnThresholdPct:12, lvnEdgePct:6,
    pocEnabled:true, pocColor:'#ff9800', pocWidth:2, pocExtend:true,
    vahEnabled:true, vahColor:'#3ea6ff', vahWidth:1,
    valEnabled:true, valColor:'#3ea6ff', valWidth:1, vaExtend:true,
    ...(tipo==='vpfixed' ? {tfAnchor:'candles', vpTfAnchor:'candles'} : {})});
};

const PULISCI = `(() => {
  for(const k of ['fbtDrawingTemplates_v1','fbtFibTemplates_v1','fbtVpTemplates_v1']){ try{ localStorage.removeItem(k); }catch(e){} }
  window.chiediNomeModello = async () => ({nome:'PROVA', sovrascrivi:false});
  return true;
})()`;

test('un modello Fibonacci finisce nel cassetto del Fibonacci', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PULISCI);
    const r = await pagina.evaluate(async () => {
      selectedDrawing = {type:'fib', color:'#fff', lineWidth:2, x1:0,y1:0,x2:10,y2:10,
        levels:newFibLevels(), opts:newFibOpts()};
      const esito = await saveCurrentDrawingAsTemplate();
      return {esito, fib:Object.keys(loadFibTemplates()), disegni:Object.keys(loadDrawingTemplates())};
    });
    assert.equal(r.esito, true, 'il salvataggio deve riuscire');
    assert.deepEqual(r.fib, ['PROVA'],
      'il modello deve stare nel cassetto Fibonacci (menu «Modello Fib»): c\'e\' ' + JSON.stringify(r.fib));
    assert.deepEqual(r.disegni, [],
      'e NON nel cassetto dei disegni, dove nessuno lo cerca: c\'e\' ' + JSON.stringify(r.disegni));
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('un modello Fibonacci porta con se livelli e opzioni, non solo lo stile', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PULISCI);
    const r = await pagina.evaluate(async () => {
      const liv = newFibLevels();
      liv[0] = Object.assign({}, liv[0], {value: 0.123});
      selectedDrawing = {type:'fib', color:'#fff', lineWidth:2, x1:0,y1:0,x2:10,y2:10,
        levels: liv, opts: Object.assign({}, newFibOpts(), {extendRight:true})};
      await saveCurrentDrawingAsTemplate();
      const t = loadFibTemplates()['PROVA'] || {};
      return {quantiLivelli:(t.levels||[]).length, primo:(t.levels||[])[0], opzioni:!!t.opts};
    });
    assert.ok(r.quantiLivelli > 0, 'i livelli devono essere nel modello: ' + r.quantiLivelli);
    assert.equal(r.primo && r.primo.value, 0.123, 'e devono essere QUELLI del disegno salvato');
    assert.equal(r.opzioni, true, 'anche le opzioni dello strumento');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

for (const [tipo, etichetta] of [['vpfixed','profilo a intervallo fisso'], ['vpanchor','profilo ancorato'], ['vwap','VWAP']]) {
  test('il modello di un ' + etichetta + ' porta le sue opzioni, non solo i colori', async () => {
    const {browser, pagina, errori} = await apriApp();
    try{
      await pagina.evaluate(PULISCI);
      const r = await pagina.evaluate(async (disegno) => {
        const d = disegno;
        selectedDrawing = d;
        const esito = await saveCurrentDrawingAsTemplate();
        const t = loadVpTemplates()['PROVA'] || null;
        return {esito, modello:t, chiaviDisegno:Object.keys(d).length,
                chiaviModello:t?Object.keys(t).length:0};
      }, DISEGNO(tipo));
      assert.equal(r.esito, true, 'il salvataggio deve riuscire');
      assert.ok(r.modello, 'il modello deve stare nel cassetto dei profili: non c\'e\'');
      assert.equal(r.modello.type, tipo, 'e deve ricordare di che classe e\'');
      assert.ok(r.chiaviModello >= 6,
        'un modello di ' + etichetta + ' con sei campi o meno e\' solo stile: campi ' + r.chiaviModello);
    } finally { await browser.close(); }
    assert.deepEqual(errori, [], 'niente errori in pagina');
  });
}

test('ogni menu mostra solo i modelli della sua classe', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PULISCI);
    const r = await pagina.evaluate(async (PROFILO) => {
      // tre modelli, uno per classe, con nomi diversi
      window.chiediNomeModello = async () => ({nome:'LINEA', sovrascrivi:false});
      selectedDrawing = {type:'line', color:'#fff', lineWidth:2, x1:0,y1:0,x2:10,y2:10};
      await saveCurrentDrawingAsTemplate();
      window.chiediNomeModello = async () => ({nome:'FIBO', sovrascrivi:false});
      selectedDrawing = {type:'fib', color:'#fff', lineWidth:2, x1:0,y1:0,x2:10,y2:10, levels:newFibLevels(), opts:newFibOpts()};
      await saveCurrentDrawingAsTemplate();
      window.chiediNomeModello = async () => ({nome:'PROFILO', sovrascrivi:false});
      selectedDrawing = PROFILO;
      await saveCurrentDrawingAsTemplate();
      return {disegni:Object.keys(loadDrawingTemplates()), fib:Object.keys(loadFibTemplates()), vp:Object.keys(loadVpTemplates())};
    }, DISEGNO('vpfixed'));
    assert.deepEqual(r.disegni, ['LINEA'], 'nel cassetto dei disegni solo la linea: ' + JSON.stringify(r.disegni));
    assert.deepEqual(r.fib, ['FIBO'], 'nel cassetto Fibonacci solo il Fibonacci: ' + JSON.stringify(r.fib));
    assert.deepEqual(r.vp, ['PROFILO'], 'nel cassetto dei profili solo il profilo: ' + JSON.stringify(r.vp));
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

// ---------------------------------------------------------------------------------------
// I SETUP DEGLI INDICATORI: stessa regola dei modelli. SEGNALATO il 18 novembre: «nemmeno gli
// indicatori si salvano». La strada era rimasta indietro rispetto alla cura della mattina:
// `saveIndicatorPresets` non rispondeva niente, quindi chi la chiama diceva «salvato» anche
// quando la memoria rifiutava.
// ---------------------------------------------------------------------------------------
test('«setup salvato» per un indicatore si dice solo se e salvato davvero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const key = Object.keys(INDICATOR_DEFS)[0];
      const ind = {key, params: INDICATOR_DEFS[key].defaultParams()};
      window.appPrompt = async () => 'SETUP DI PROVA';
      // la memoria rifiuta, come quando il deposito e' pieno
      const vero = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (k, v) => { if (String(k).indexOf('fbtPresets_v1_') === 0) throw new Error('QuotaExceededError (finto)'); return vero(k, v); };
      const esito = await savePresetForIndicator(ind);
      localStorage.setItem = vero;
      return {esito, quanti: Object.keys(loadIndicatorPresets(key)).length, chiave: key};
    });
    assert.equal(r.esito, false, 'deve rispondere «no» quando la memoria rifiuta: ha risposto ' + r.esito);
    assert.equal(r.quanti, 0, 'e il setup non deve risultare in lista');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('CONTROLLO: quando la memoria accetta, il setup si salva e si rilegge', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const key = Object.keys(INDICATOR_DEFS)[0];
      try{ localStorage.removeItem('fbtPresets_v1_' + key); }catch(e){}
      const ind = {key, params: INDICATOR_DEFS[key].defaultParams()};
      window.appPrompt = async () => 'SETUP DI PROVA';
      const esito = await savePresetForIndicator(ind);
      return {esito, nomi: Object.keys(loadIndicatorPresets(key))};
    });
    assert.equal(r.esito, true, 'con la memoria libera deve riuscire');
    assert.deepEqual(r.nomi, ['SETUP DI PROVA'], 'e il nome deve comparire nella lista: ' + JSON.stringify(r.nomi));
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});
