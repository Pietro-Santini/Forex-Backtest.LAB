// VOCE 8 DELLE FINESTRE DUPLICATE: il modello scelto sulla barra vale per il disegno successivo.
//
// RICHIESTO dal proprietario: «selezionando un disegno salvato come modello e poi cliccando sul
// grafico, il disegno viene tracciato subito con le priorità salvate; al trascinamento si
// applicano tutte le priorità salvate.» Nella lista era segnata «DA VERIFICARE: potrebbe già
// funzionare».
//
// VERIFICATO il 15 novembre 2026: funziona, e questo banco lo tiene fermo. Il passo in dubbio era
// il TRAVASO - scegliere un modello quando NON c'è nessun disegno selezionato deve portare TUTTE
// le proprietà salvate nei comandi della barra, perché è da lì che il prossimo disegno le prende.
//
// LA PROPRIETÀ CHE RISCHIAVA DI RESTARE INDIETRO è il puntinato: `applyDrawingDefaults()` passa un
// oggetto SENZA il campo `dotted`, e sembrava una dimenticanza. Non lo è: lì il puntinato deve
// valere "spento", e `!!undefined` è appunto false. Nel travaso vero (applyTemplateStyleToUI) il
// puntinato c'è e passa da `drawDottedDefault`. Questo banco lo prova una per una, invece di
// fidarsi della lettura del codice.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Un modello con OGNI proprietà diversa dal valore predefinito: se una non viaggia, si vede.
const MODELLO = {
  type: 'rectangle', color: '#ff00aa', lineWidth: 5, dashed: true, dotted: true,
  opacity: 0.4, fillColor: '#00ffcc', fillOpacity: 0.66, text: 'Zona domanda'
};

test('scegliendo un modello senza niente selezionato, TUTTE le proprietà passano alla barra', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((m) => {
      const t = loadDrawingTemplates();
      t['prova'] = m;
      saveDrawingTemplates(t);
      selectedDrawing = null;
      drawTool = 'rectangle';
      applyDrawingTemplate('prova');
      const v = (id) => { const e = document.getElementById(id); return e ? e.value : null; };
      return {
        colore: v('drawColor'),
        spessore: Number(v('drawWidth')),
        opacita: Number(v('drawOpacity')),
        coloreRiempimento: v('drawFillColor'),
        opacitaRiempimento: Number(v('drawFillOpacity')),
        tratteggio: !!drawDashedDefault,
        puntinato: !!drawDottedDefault,
        testoInAttesa: pendingDrawingTemplateText
      };
    }, MODELLO);
    console.log('travaso del modello:', JSON.stringify(r));
    assert.equal(r.colore, MODELLO.color, 'il colore: ' + JSON.stringify(r));
    assert.equal(r.spessore, MODELLO.lineWidth, 'lo spessore: ' + JSON.stringify(r));
    assert.equal(r.opacita, 40, 'l opacita in percento: ' + JSON.stringify(r));
    assert.equal(r.coloreRiempimento, MODELLO.fillColor, 'il colore di riempimento');
    assert.equal(r.opacitaRiempimento, 66, 'l opacita del riempimento');
    assert.equal(r.tratteggio, true, 'il tratteggio');
    assert.equal(r.puntinato, true,
      'IL PUNTINATO: e la proprieta che rischiava di restare indietro. ' + JSON.stringify(r));
    assert.equal(r.testoInAttesa, MODELLO.text, 'e il testo salvato nel modello');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con un disegno SELEZIONATO, il modello si applica a quello', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((m) => {
      const t = loadDrawingTemplates();
      t['prova'] = m;
      saveDrawingTemplates(t);
      const d = {type: 'rectangle', color: '#111111', lineWidth: 1, dashed: false, dotted: false,
                 opacity: 1, fillColor: '#222222', fillOpacity: 0.1, text: ''};
      selectedDrawing = d;
      applyDrawingTemplate('prova');
      return {color: d.color, lineWidth: d.lineWidth, dashed: d.dashed, dotted: d.dotted,
              opacity: d.opacity, fillColor: d.fillColor, fillOpacity: d.fillOpacity,
              text: d.text};
    }, MODELLO);
    console.log('applicato al disegno selezionato:', JSON.stringify(r));
    assert.equal(r.color, MODELLO.color);
    assert.equal(r.lineWidth, MODELLO.lineWidth);
    assert.equal(r.dashed, true);
    assert.equal(r.dotted, true, 'anche il puntinato: ' + JSON.stringify(r));
    assert.equal(r.opacity, MODELLO.opacity);
    assert.equal(r.fillColor, MODELLO.fillColor, 'il riempimento vale per i rettangoli');
    assert.equal(r.fillOpacity, MODELLO.fillOpacity);
    assert.equal(r.text, MODELLO.text, 'e il testo del modello');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('lo stile predefinito spegne il puntinato invece di lasciarlo acceso', async () => {
  // La controprova del dubbio: `applyDrawingDefaults()` non passa il campo `dotted`, e deve
  // risultare SPENTO. Se un domani quel giro cambiasse e lo lasciasse acceso, il disegno
  // successivo nascerebbe puntinato senza che nessuno l abbia chiesto.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((m) => {
      const t = loadDrawingTemplates();
      t['prova'] = m;
      saveDrawingTemplates(t);
      selectedDrawing = null;
      drawTool = 'rectangle';
      applyDrawingTemplate('prova');
      const accesoPrima = !!drawDottedDefault;
      applyDrawingDefaults();
      return {accesoPrima, accesoDopo: !!drawDottedDefault,
              tratteggioDopo: !!drawDashedDefault, testoDopo: pendingDrawingTemplateText};
    }, MODELLO);
    console.log('stile predefinito:', JSON.stringify(r));
    assert.equal(r.accesoPrima, true, 'il modello lo aveva acceso');
    assert.equal(r.accesoDopo, false,
      'lo stile predefinito deve spegnerlo: ' + JSON.stringify(r));
    assert.equal(r.tratteggioDopo, false, 'e anche il tratteggio');
    assert.equal(r.testoDopo, '', 'e il testo torna vuoto');
  } finally { await browser.close(); }
});
