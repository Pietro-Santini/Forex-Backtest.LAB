// SCALA DELL'INTERFACCIA AL PERCENTUALE, IL GRAFICO ESCLUSO.
//
// Richiesto dal proprietario (18 ottobre 2026): «carattere/elementi: dimensioni in percentuale
// in Impostazioni → Stile; carattere più piccolo sul telefono» e «zoom: Ctrl+rotellina su PC,
// dita su telefono/tablet, per tutta la pagina MA ESCLUSO il grafico».
//
// Come funziona (ogni passaggio e' stato MISURATO in Chromium con la sonda di laboratorio,
// prima di scrivere una riga di codice):
//   1. la pagina si ingrandisce con zoom CSS su <body>: con body{zoom:1.5} un overlay
//      position:fixed inset:0 copre il viewport ESATTO (1200x800) e le modali restano
//      centrate; la pagina scorre in verticale (scrollY arriva in fondo); il contenuto
//      ingrandito non viene tagliato ma si adatta per riflusso, come una finestra piu'
//      stretta - per questo a zoom >100% non serve nessuna scrollbar orizzontale;
//   2. il grafico NON segue la pagina: #chartWrap riceve il contro-zoom (1/scala) e
//      basta - la larghezza NON va detta a mano. Con il contro-zoom il riempimento si
//      riattingua da solo perché la finestra locale (viewport diviso la scala) si stringe
//      quanto la scala allarga: misurato nella pagina vera, a 130% il grafico da 1234 px
//      è tornato 1214 (sempre allo stesso posto) mentre la pagina cresceva del 30%.
//      (Una larghezza forzata ai px del pannello, provata prima, lo rimpiccioliva a 934:
//      il pannello vive nel viewport, che con lo zoom si stringe);
//   3. i gesti: Ctrl+rotellina (e il pinch del trackpad, che Chrome consegna come wheel+ctrl)
//      e due dita (pizzico) al di FUORI del grafico zoomano la pagina; sopra il grafico il
//      gesto resta del grafico, come e' sempre stato.
//
// Questi test non cercano una stringa: il blocco marcato SCALA UI viene estratto da app.html
// ed eseguito con magazzini, documento e finestra finti; i due test finali aprono la pagina
// vera in Chromium.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {apriApp} from './aiuti.mjs';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HTML = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');

function leggiBlocco(){
  const inizio = HTML.indexOf('SCALA UI: INIZIO');
  assert.ok(inizio >= 0, "in app.html manca il blocco marcato SCALA UI: INIZIO");
  const s = HTML.lastIndexOf('/*', inizio);
  assert.ok(s >= 0 && inizio - s < 60, "il marcatore di apertura non sta dentro un commento /* ... */");
  const fine = HTML.indexOf('SCALA UI: FINE', inizio);
  assert.ok(fine > inizio, "in app.html manca il marcatore SCALA UI: FINE");
  const e = HTML.indexOf('*/', fine);
  assert.ok(e > fine, "il marcatore di chiusura non sta dentro un commento");
  return HTML.slice(s, e + 2);
}
const BLOCCO = leggiBlocco();

function blocco(){
  return new Function(BLOCCO + `
    return {fblScalaUiMin, fblScalaUiMax, fblScalaUiAttuale, fblScalaUiTocco, fblScalaUiPredefinita,
            fblScalaUiLeggi, fblScalaUiApplica, fblScalaUiSalva,
            fblScalaUiVaria, fblScalaUiImposta, fblScalaUiAdattaGrafico,
            fblScalaUiDentroGrafico, fblScalaUiGesti,
            fblScalaUiAvvia};
  `)();
}

// Un magazzino fintamente localStorage: `errore:true` diventa la modalita' privata (tutto negato).
function fintoMag(cosa){
  return {
    getItem(k){ if(cosa.errore) throw new Error('negato'); return (k in cosa) ? cosa[k] : null; },
    setItem(k, v){ if(cosa.errore) throw new Error('negato'); cosa[k] = String(v); },
  };
}
function mondo({larghezza = 1000} = {}){
  const ascoltatori = {};
  const fin = {addEventListener: (n, f) => { (ascoltatori[n] = ascoltatori[n] || []).push(f); }};
  const cw = {style: {}, parentElement: {clientWidth: larghezza}};
  const campo = {value: '100'};
  const doc = {body: {style: {}}, documentElement: {style: {}},
    getElementById: id => id === 'chartWrap' ? cw : (id === 'fblUiScalaPct' ? campo : null)};
  return {fin, cw, campo, doc, ascoltatori};
}
const dentro = cw => ({closest: sel => sel === '#chartWrap' ? cw : null});
const fuori = () => ({closest: () => null});
const NAV_PC = {userAgentData: {mobile: false}};
const FIN_PC = {matchMedia: () => ({matches: false})};

test('il blocco della scala interfaccia è JavaScript valido', () => {
  const b = blocco();
  assert.equal(typeof b.fblScalaUiApplica, 'function');
  assert.equal(typeof b.fblScalaUiAvvia, 'function');
});

test('sul telefono il carattere si parte più piccolo, sul computer come sempre', () => {
  const b = blocco();
  assert.equal(b.fblScalaUiPredefinita({userAgentData: {mobile: true}}, FIN_PC), 85,
    'telefono che si dichiara: 85 per cento, il carattere più piccolo richiesto');
  assert.equal(b.fblScalaUiPredefinita(NAV_PC, {matchMedia: q => ({matches: /pointer:\s*coarse/.test(q)})}), 85,
    'telefono che non si dichiara ma ha il tocco grosso: stessa risposta');
  assert.equal(b.fblScalaUiPredefinita(NAV_PC, FIN_PC), 100, 'computer: 100 per cento, come sempre');
});

test('la scala salvata si riprende, una scala rovina si butta', () => {
  const b = blocco();
  assert.equal(b.fblScalaUiLeggi(fintoMag({'fbl_ui_scala_pct': '120'}), NAV_PC, FIN_PC), 120);
  assert.equal(b.fblScalaUiLeggi(fintoMag({'fbl_ui_scala_pct': '123'}), NAV_PC, FIN_PC), 125,
    'il valore si riporta al passo di 5');
  assert.equal(b.fblScalaUiLeggi(fintoMag({'fbl_ui_scala_pct': '999'}), NAV_PC, FIN_PC), 100,
    'oltre il massimo il valore si butta, non si applica');
  assert.equal(b.fblScalaUiLeggi(fintoMag({'fbl_ui_scala_pct': '5'}), NAV_PC, FIN_PC), 100,
    'sotto il minimo (10) il valore si butta, non si applica');
  assert.equal(b.fblScalaUiLeggi(fintoMag({}), NAV_PC, FIN_PC), 100, 'mai impostato: il predefinito');
  assert.equal(b.fblScalaUiLeggi(fintoMag({}), NAV_PC, FIN_PC), 100);
});

test('la scala puo\' scendere fino al 10%: sul telefono il 70% era troppo', () => {
  const b = blocco();
  const m = mondo();
  assert.equal(b.fblScalaUiMin(), 10,
    'il tetto minimo richiesto dal proprietario: si deve poter scendere a 60, 50, 20, 15, 10');
  for (const v of [60, 50, 20, 15, 10]) {
    assert.equal(b.fblScalaUiApplica(m.doc, v), v,
      'la scala ' + v + '% deve poter essere usata: il telefono chiedeva di scendere sotto il 70%');
  }
  assert.equal(m.doc.body.style.zoom, '0.1', 'al 10% la pagina si rimpicciolisce davvero');
  assert.ok(Math.abs(parseFloat(m.cw.style.zoom) - 10) < 1e-9,
    'il grafico riceve il contro-zoom (10), cosi\' resta alla sua misura');
  // Il valore salvato e\' quello che l\'utente ha scelto: torna indietro alla riapertura.
  const mag = fintoMag({});
  b.fblScalaUiImposta(mag, m.doc, 20);
  assert.equal(mag.getItem('fbl_ui_scala_pct'), '20', 'il 20% si ricorda per la prossima volta');
  assert.equal(b.fblScalaUiLeggi(mag, NAV_PC, FIN_PC), 20,
    'alla riapertura si riparte dal 20%, non dal predefinito');
});

test('modalità privata: la memoria negata non fa esplodere niente', () => {
  const b = blocco();
  const negato = fintoMag({errore: true});
  assert.equal(b.fblScalaUiLeggi(negato, NAV_PC, FIN_PC), 100, 'senza memoria si riparte dal predefinito');
  const m = mondo();
  b.fblScalaUiApplica(m.doc, 120);
  assert.equal(m.doc.body.style.zoom, '1.2', 'l\'applicazione continua a funzionare');
  b.fblScalaUiSalva(negato, 120);  // deve solo non lamentarsi
});

test('la pagina si ingrandisce, il grafico resta alle sue vere dimensioni', () => {
  const b = blocco();
  const m = mondo();
  const v = b.fblScalaUiApplica(m.doc, 150);
  assert.equal(v, 150);
  assert.equal(m.doc.body.style.zoom, '1.5', 'tutta la pagina cresce');
  assert.ok(Math.abs(parseFloat(m.cw.style.zoom) - 1 / 1.5) < 1e-9,
    'il grafico riceve il contro-zoom, come misurato nella sonda');
  assert.equal(m.cw.style.width, undefined,
    'la larghezza non si tocca a mano: con il contro-zoom il riempimento si riattingua da solo');
  assert.equal(m.campo.value, '150', 'anche il campo percentuale in Impostazioni si aggiorna');
});

test('a 100 per cento non resta niente appiccicato: zoom e larghezza si spengono', () => {
  const b = blocco();
  const m = mondo();
  b.fblScalaUiApplica(m.doc, 150);
  b.fblScalaUiApplica(m.doc, 100);
  assert.equal(m.doc.body.style.zoom, '', 'senza zoom la pagina torna com\'era');
  assert.equal(m.cw.style.zoom, '', 'e il grafico non tiene contro-zoom residui');
  assert.ok(!m.cw.style.width, 'e nessuna larghezza è stata imposta a mano, a nessuna scala');
});

test('mai sotto il 10 e sopra il 150 per cento', () => {
  const b = blocco();
  const m = mondo();
  assert.equal(b.fblScalaUiApplica(m.doc, 300), 150);
  assert.equal(b.fblScalaUiApplica(m.doc, 1), 10, 'sotto il 10% la scala si ferma al tetto');
});

test('Ctrl+rotellina fuori dal grafico: la pagina la zooma e il valore si ricorda', () => {
  const b = blocco();
  const m = mondo();
  const mag = fintoMag({});
  b.fblScalaUiGesti(m.fin, m.doc, mag);
  const ev = {ctrlKey: true, deltaY: -100, target: fuori(), preventDefault(){ this.fatto = true; }};
  m.ascoltatori.wheel[0](ev);
  assert.equal(ev.fatto, true, 'lo zoom del browser si blocca: la pagina la zoomiamo noi');
  assert.equal(b.fblScalaUiAttuale(), 105);
  assert.equal(mag.getItem('fbl_ui_scala_pct'), '105', 'il valore si ricorda per la prossima volta');
  const giu = {ctrlKey: true, deltaY: 100, target: fuori(), preventDefault(){}};
  m.ascoltatori.wheel[0](giu);
  assert.equal(b.fblScalaUiAttuale(), 100, 'rotellina verso il basso: si rimpicciolisce');
});

test('Ctrl+rotellina SUL grafico: il gesto resta del grafico', () => {
  const b = blocco();
  const m = mondo();
  b.fblScalaUiGesti(m.fin, m.doc, fintoMag({}));
  const ev = {ctrlKey: true, deltaY: -100, target: dentro(m.cw), preventDefault(){ this.fatto = true; }};
  m.ascoltatori.wheel[0](ev);
  assert.equal(ev.fatto, true, 'niente zoom del browser nemmeno sopra il grafico, come sempre');
  assert.equal(b.fblScalaUiAttuale(), 100, 'la pagina NON si zooma dove comanda il grafico');
  const piano = {ctrlKey: false, deltaY: -100, target: fuori(), preventDefault(){ this.fatto = true; }};
  m.ascoltatori.wheel[0](piano);
  assert.equal(piano.fatto, undefined, 'la rotellina senza Ctrl continua a scorrere la pagina');
});

test('due dita fuori dal grafico: il pizzico zooma la pagina', () => {
  const b = blocco();
  const m = mondo();
  const mag = fintoMag({});
  b.fblScalaUiGesti(m.fin, m.doc, mag);
  b.fblScalaUiImposta(mag, m.doc, 100);
  m.ascoltatori.touchstart[0]({touches: [{clientX: 0, clientY: 0, target: fuori()},
                                        {clientX: 100, clientY: 0, target: fuori()}]});
  const ev = {touches: [{clientX: 0, clientY: 0}, {clientX: 130, clientY: 0}],
              preventDefault(){ this.fatto = true; }};
  m.ascoltatori.touchmove[0](ev);
  assert.equal(ev.fatto, true, 'il pinch del browser si blocca: la pagina la zoomiamo noi');
  assert.equal(b.fblScalaUiAttuale(), 130, 'il pizzico ha allargato la pagina del 30 per cento');
  m.ascoltatori.touchend[0]({touches: []});
  assert.equal(mag.getItem('fbl_ui_scala_pct'), '130', 'alla fine del gesto il valore si ricorda');
});

test('due dita SUL grafico: il pizzico resta del grafico', () => {
  const b = blocco();
  const m = mondo();
  b.fblScalaUiGesti(m.fin, m.doc, fintoMag({}));
  m.ascoltatori.touchstart[0]({touches: [{clientX: 0, clientY: 0, target: dentro(m.cw)},
                                        {clientX: 100, clientY: 0, target: dentro(m.cw)}]});
  const ev = {touches: [{clientX: 0, clientY: 0}, {clientX: 130, clientY: 0}],
              preventDefault(){ this.fatto = true; }};
  m.ascoltatori.touchmove[0](ev);
  assert.equal(ev.fatto, undefined, 'il gesto del grafico non si mangia');
  assert.equal(b.fblScalaUiAttuale(), 100, 'la pagina resta ferma sopra il grafico');
});

test('dopo la scala, il grafico riceve un resize finto per riadattarsi alla colonna', () => {
  const b = blocco();
  const m = mondo();
  let resize = 0;
  m.doc.defaultView = {dispatchEvent: e => { if(e && e.type === 'resize') resize++; }};
  b.fblScalaUiVaria(fintoMag({}), m.doc, 10);
  assert.equal(resize, 1, 'a scala diversa da 100 il resize arriva: la libreria del grafico si riadatta');
  b.fblScalaUiImposta(fintoMag({}), m.doc, 100);
  assert.equal(resize, 1, 'a 100 per cento il grafico non ha bisogno di niente');
});

test('alla carica: si applica la scala salvata e i gesti ci sono da subito', () => {
  const b = blocco();
  const m = mondo();
  const v = b.fblScalaUiAvvia(m.fin, m.doc, fintoMag({'fbl_ui_scala_pct': '120'}), NAV_PC);
  assert.equal(v, 120);
  assert.equal(m.doc.body.style.zoom, '1.2');
  assert.equal(m.ascoltatori.wheel.length, 1, 'la rotellina è agganciata una volta sola');
  assert.equal(m.ascoltatori.touchmove.length, 1, 'le dita sono agganciate una volta sola');
});

// ============ LA PAGINA VERA, IN CHROMIUM ============

test('nella pagina vera: il campo in Impostazioni → Stile scala la pagina e il grafico non si muove', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const inp = document.getElementById('fblUiScalaPct');
      if(!inp) return {mancato: true};
      const cv = document.getElementById('chart');
      const prima = cv ? cv.getBoundingClientRect().width : 0;
      inp.value = '130';
      // 'change', non 'input': dal 20 ottobre 2026 la modifica si applica QUANDO SI ESCE dal
      // campo, non a ogni tasto (richiesto dal proprietario — vedi i test in fondo al file).
      // Quello che QUESTO test misura non cambia: il campo scala la pagina e non il grafico.
      inp.dispatchEvent(new Event('change', {bubbles: true}));
      const cw = document.getElementById('chartWrap');
      const dopo = cv ? cv.getBoundingClientRect().width : 0;
      return {zoomPagina: document.body.style.zoom,
              zoomGrafico: cw.style.zoom,
              prima, dopo, salvato: localStorage.getItem('fbl_ui_scala_pct')};
    });
    assert.equal(r.mancato, undefined, 'in Impostazioni → Stile manca il campo «Interfaccia»');
    assert.equal(r.zoomPagina, '1.3', 'la pagina è cresciuta del 30 per cento');
    // la tolleranza è larga perché il CSSOM restituisce style.zoom troncato a 6 cifre
    assert.ok(Math.abs(parseFloat(r.zoomGrafico) - 1 / 1.3) < 1e-5, 'il grafico ha il contro-zoom');
    assert.equal(r.salvato, '130', 'la percentuale si ricorda');
    assert.ok(r.dopo > r.prima * 0.9 && r.dopo < r.prima * 1.05,
      `il canvas del grafico NON deve seguire lo zoom della pagina: prima ${r.prima} px, dopo ${r.dopo} px`);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nella pagina vera: la scala salvata si applica alla carica, come al riaprirsi dell\'app', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(() => localStorage.setItem('fbl_ui_scala_pct', '85'));
    await pagina.reload({waitUntil: 'domcontentloaded'});
    await pagina.waitForTimeout(2500);
    const r = await pagina.evaluate(() => ({
      zoom: document.body.style.zoom,
      campo: document.getElementById('fblUiScalaPct') ? document.getElementById('fblUiScalaPct').value : null,
    }));
    assert.equal(r.zoom, '0.85', 'all\'apertura la scala salvata è già applicata');
    assert.equal(r.campo, '85', 'e il campo di Impostazioni la mostra');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("nella pagina vera: anche il testo del grafico si puo' ridurre fino al 10%", async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const inp = document.getElementById('chartFontScalePct');
      if(!inp) return {mancato: true};
      const fuori = [];
      for (const v of [50, 20, 15, 10]) {
        inp.value = String(v);
        // 'change', non 'input': si applica a modifica finita (vedi i test in fondo al file).
        inp.dispatchEvent(new Event('change', {bubbles: true}));
        fuori.push(Math.round(chartFontScale * 1000) / 1000);
      }
      // Sotto il tetto: il valore si ferma al 10%.
      inp.value = '1';
      inp.dispatchEvent(new Event('change', {bubbles: true}));
      return {valori: fuori, sotto: Math.round(chartFontScale * 1000) / 1000};
    });
    assert.equal(r.mancato, undefined, 'in Impostazioni -> Stile manca il campo della dimensione del testo del grafico');
    assert.deepEqual(r.valori, [0.5, 0.2, 0.15, 0.1],
      'il testo del grafico deve poter scendere fino al 10% (richiesto dal proprietario)');
    assert.equal(r.sotto, 0.1, 'sotto il 10% il testo si ferma al tetto: non diventa illeggibile');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ============================================================================================
// LA MODIFICA SI APPLICA QUANDO HAI FINITO DI SCRIVERE, NON A OGNI TASTO.
//
// RICHIESTO dal proprietario (20 ottobre 2026): «l'utente clicca sul valore da modificare,
// modifica il valore e solo allora, quando ha inserito il valore e clicca fuori, viene applicata
// la modifica, e non mentre la sta inserendo. Se cancella il valore e lo porta a 0, lui
// ripristina automaticamente il valore precedente».
//
// IL DIFETTO, raccontato da lui con un esempio: «se la percentuale e' impostata a 50% e l'utente
// vuole mettere il 30%, l'app non glielo fa mettere: quando cancella lo 0 e poi il 5 ripristina
// automaticamente il valore di 50, oppure se inserisce un numero prima del 5 gli porta la scala
// alla scala massima di 150%».
//
// Succedeva perche' i due campi erano agganciati all'evento 'input', che scatta a OGNI TASTO:
// con "50" nel campo, un backspace lascia "5", e "5" veniva applicato subito, schiacciato al
// tetto minimo e RISCRITTO nel campo. Il numero che l'utente stava scrivendo gli veniva cambiato
// sotto le dita a metà.
// ============================================================================================

test('scala interfaccia: mentre si scrive non si applica e non si riscrive niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const inp = document.getElementById('fblUiScalaPct');
      if(!inp) return {mancato: true};
      // Si parte dal 50% dell'esempio del proprietario, per la via pubblica.
      fblScalaUiImposta(localStorage, document, 50);
      const partenza = {campo: inp.value, zoom: document.body.style.zoom};
      // Ora l'utente vuole il 30%. Cancella lo "0": nel campo resta "5".
      inp.value = '5';
      inp.dispatchEvent(new Event('input', {bubbles: true}));
      const dopoBackspace = {campo: inp.value, zoom: document.body.style.zoom};
      // Scrive il "3" e poi lo "0": passa per "3" e "30".
      inp.value = '3';
      inp.dispatchEvent(new Event('input', {bubbles: true}));
      const dopoTre = {campo: inp.value, zoom: document.body.style.zoom};
      inp.value = '30';
      inp.dispatchEvent(new Event('input', {bubbles: true}));
      const dopoTrenta = {campo: inp.value, zoom: document.body.style.zoom};
      // Solo adesso clicca fuori.
      inp.dispatchEvent(new Event('change', {bubbles: true}));
      return {partenza, dopoBackspace, dopoTre, dopoTrenta,
              fine: {campo: inp.value, zoom: document.body.style.zoom,
                     salvato: localStorage.getItem('fbl_ui_scala_pct')}};
    });
    assert.equal(r.mancato, undefined, 'in Impostazioni → Stile manca il campo «Interfaccia»');
    assert.equal(r.partenza.zoom, '0.5', 'si parte dal 50%');
    // IL CUORE: mentre scrive, il campo resta quello che ha scritto LUI.
    assert.equal(r.dopoBackspace.campo, '5', 'il "5" intermedio non deve essere riscritto dall\'app');
    assert.equal(r.dopoBackspace.zoom, '0.5', 'e la pagina non si deve rimpicciolire al tetto minimo');
    assert.equal(r.dopoTre.campo, '3', 'nemmeno il "3" va riscritto');
    assert.equal(r.dopoTre.zoom, '0.5');
    assert.equal(r.dopoTrenta.campo, '30');
    assert.equal(r.dopoTrenta.zoom, '0.5', 'finche\' non esce dal campo non si applica niente');
    // E alla fine il 30% che voleva.
    assert.equal(r.fine.zoom, '0.3', 'uscendo dal campo si applica il 30% che aveva scritto');
    assert.equal(r.fine.campo, '30');
    assert.equal(r.fine.salvato, '30', 'e si ricorda');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('scala interfaccia: svuotare il campo rimette il valore di prima, non 0', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const inp = document.getElementById('fblUiScalaPct');
      fblScalaUiImposta(localStorage, document, 80);
      inp.value = '';
      inp.dispatchEvent(new Event('input', {bubbles: true}));
      inp.dispatchEvent(new Event('change', {bubbles: true}));
      const vuoto = {campo: inp.value, zoom: document.body.style.zoom};
      // Anche uno zero esplicito non e' una scala: si torna a quella di prima.
      inp.value = '0';
      inp.dispatchEvent(new Event('change', {bubbles: true}));
      return {vuoto, zero: {campo: inp.value, zoom: document.body.style.zoom}};
    });
    assert.equal(r.vuoto.zoom, '0.8', 'il campo svuotato non deve cambiare la pagina');
    assert.equal(r.vuoto.campo, '80', 'e il campo si ricompila col valore di prima');
    assert.equal(r.zero.zoom, '0.8', 'zero non e\' una scala');
    assert.equal(r.zero.campo, '80');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('testo del grafico: si applica a modifica finita, e svuotarlo non lo riporta al 100%', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const inp = document.getElementById('chartFontScalePct');
      if(!inp) return {mancato: true};
      // Si parte dal 50%, a modifica finita.
      inp.value = '50';
      inp.dispatchEvent(new Event('change', {bubbles: true}));
      const partenza = Math.round(chartFontScale * 1000) / 1000;
      // L'utente vuole il 30%: passa per "5" e per "3".
      inp.value = '5';
      inp.dispatchEvent(new Event('input', {bubbles: true}));
      const dopoBackspace = {scala: Math.round(chartFontScale * 1000) / 1000, campo: inp.value};
      inp.value = '30';
      inp.dispatchEvent(new Event('input', {bubbles: true}));
      const dopoTrenta = Math.round(chartFontScale * 1000) / 1000;
      inp.dispatchEvent(new Event('change', {bubbles: true}));
      const fine = Math.round(chartFontScale * 1000) / 1000;
      // Svuotato: resta quello di prima, non torna al 100%.
      inp.value = '';
      inp.dispatchEvent(new Event('change', {bubbles: true}));
      return {partenza, dopoBackspace, dopoTrenta, fine,
              vuoto: {scala: Math.round(chartFontScale * 1000) / 1000, campo: inp.value}};
    });
    assert.equal(r.mancato, undefined, 'manca il campo della dimensione del testo del grafico');
    assert.equal(r.partenza, 0.5, 'si parte dal 50%');
    assert.equal(r.dopoBackspace.scala, 0.5, 'il "5" intermedio non si applica');
    assert.equal(r.dopoBackspace.campo, '5', 'e non viene riscritto');
    assert.equal(r.dopoTrenta, 0.5, 'finche\' non esce dal campo non cambia niente');
    assert.equal(r.fine, 0.3, 'uscendo dal campo si applica il 30%');
    assert.equal(r.vuoto.scala, 0.3, 'il campo svuotato non riporta il testo al 100%');
    assert.equal(r.vuoto.campo, '30', 'e il campo si ricompila col valore di prima');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
