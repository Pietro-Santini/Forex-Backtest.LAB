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
  assert.equal(b.fblScalaUiLeggi(fintoMag({'fbl_ui_scala_pct': '10'}), NAV_PC, FIN_PC), 100,
    'sotto il minimo uguale');
  assert.equal(b.fblScalaUiLeggi(fintoMag({}), NAV_PC, FIN_PC), 100, 'mai impostato: il predefinito');
  assert.equal(b.fblScalaUiLeggi(fintoMag({}), NAV_PC, FIN_PC), 100);
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

test('mai sotto i 70 e sopra i 150 per cento', () => {
  const b = blocco();
  const m = mondo();
  assert.equal(b.fblScalaUiApplica(m.doc, 300), 150);
  assert.equal(b.fblScalaUiApplica(m.doc, 10), 70);
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
      inp.dispatchEvent(new Event('input', {bubbles: true}));
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
