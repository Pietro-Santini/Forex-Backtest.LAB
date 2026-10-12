// ORDER BLOCKS (OB) — le tre cose chieste esplicitamente dall'utente, provate una per una:
//   1) DUE regole di rilevamento, scegliibili dalle impostazioni:
//        - "struttura" (ICT/LuxAlgo): rottura di un pivot confermato;
//        - "impulso": ultima candela opposta prima di N candele decise consecutive;
//        - "entrambe".
//   2) MITIGAZIONE: quando il prezzo torna a toccare la zona, la zona si spegne (mitigated=true,
//      con l'indice del tocco) e il disegno si ferma lì invece di allungarsi ancora.
//   3) TETTO MASSIMO di zone disegnate, impostabile (maxZone).
// Si prova qui la LOGICA (compute/render) dell'indicatore reale preso da INDICATOR_DEFS, non una
// copia: se la logica cambia, questo test cambia con essa.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Le candele sono [open, high, low, close]: compatte da scrivere e leggere.
const STRUTTURA = [
  [100, 101, 99, 100],
  [100, 102, 100, 101],
  [101, 103, 100.5, 102],   // pivot high confermato (pivotLen=2), massimo 103
  [102, 102.5, 101, 101.5],
  [101.5, 102, 100.8, 101],
  [101, 102, 100, 101],     // candela origine del movimento (minimo più basso: 100)
  [101, 103.5, 100.9, 103.5], // ROTTURA di struttura: chiusura 103.5 sopra il pivot 103
  [103, 103.2, 101, 101.2]  // il prezzo TORNA nella zona (minimo 101 <= tetto 102): mitigazione
];

const IMPULSO = [
  [100, 100.5, 98.8, 99],      // candela opposta (ribassista): sarà la zona
  [99, 101, 98.9, 100.6],      // candela decisa 1
  [100.6, 102, 100.5, 101.8],  // candela decisa 2
  [101.8, 103, 101.7, 102.9],  // candela decisa 3 -> scatta l'OB (impulsoCandele=3)
  [103, 103.2, 100, 100.5]     // ritorno nella zona: mitigazione
];

test('regola "struttura": la rottura di un pivot crea l\'OB e il ritorno nella zona la MITIGA', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((spec) => {
      const def = INDICATOR_DEFS['order_blocks'];
      const ind = hydrateIndicators([{id: 1, key: 'order_blocks', params: def.defaultParams()}])[0];
      ind.params.pivotLen = 2;
      ind.params.regola = 'struttura';
      const R = spec.map(a => ({date: new Date(Date.UTC(2024, 0, 1, 0, 0, 0)).toISOString(), open: a[0], high: a[1], low: a[2], close: a[3], volume: 100}));
      rows = R; idx = R.length - 1;
      def.compute(R, idx, ind);
      const z = ind.calc.zones;
      return {quante: z.length, zona: z[0] || null, builtTo: ind.calc.builtTo, fine: R.length - 1};
    }, STRUTTURA);
    assert.equal(r.builtTo, r.fine, 'compute non è arrivato all\'ultima candela');
    assert.ok(r.quante >= 1, 'nessun order block: la rottura di struttura non è stata vista');
    assert.equal(r.zona.dir, 'bull', 'la rottura rialzista doveva fare un OB rialzista');
    assert.equal(r.zona.src, 'struttura', 'la zona doveva venire dalla regola "struttura"');
    assert.equal(r.zona.top, 102, 'tetto della zona sbagliato (doveva essere il massimo della candela origine)');
    assert.equal(r.zona.bottom, 100, 'pavimento della zona sbagliato (doveva essere il minimo più basso)');
    assert.equal(r.zona.mitigated, true, 'il ritorno del prezzo nella zona doveva mitigarla');
    assert.equal(r.zona.mitIdx, 7, 'la zona doveva fermarsi alla candela del tocco (barra 7)');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('regola "struttura" con mitigazione SPENTA: la zona resta viva', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((spec) => {
      const def = INDICATOR_DEFS['order_blocks'];
      const ind = hydrateIndicators([{id: 1, key: 'order_blocks', params: def.defaultParams()}])[0];
      ind.params.pivotLen = 2; ind.params.regola = 'struttura'; ind.params.mitigazione = false;
      const R = spec.map(a => ({date: new Date(Date.UTC(2024, 0, 1, 0, 0, 0)).toISOString(), open: a[0], high: a[1], low: a[2], close: a[3], volume: 100}));
      rows = R; idx = R.length - 1;
      def.compute(R, idx, ind);
      const z = ind.calc.zones;
      return {mitigata: z[0] ? z[0].mitigated : null};
    }, STRUTTURA);
    assert.equal(r.mitigata, false, 'con la mitigazione spenta la zona non doveva spegnersi');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('regola "impulso": l\'ultima candela opposta prima delle candele decise diventa l\'OB', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((spec) => {
      const def = INDICATOR_DEFS['order_blocks'];
      const ind = hydrateIndicators([{id: 1, key: 'order_blocks', params: def.defaultParams()}])[0];
      ind.params.regola = 'impulso'; ind.params.impulsoCandele = 3;
      const R = spec.map(a => ({date: new Date(Date.UTC(2024, 0, 1, 0, 0, 0)).toISOString(), open: a[0], high: a[1], low: a[2], close: a[3], volume: 100}));
      rows = R; idx = R.length - 1;
      def.compute(R, idx, ind);
      const z = ind.calc.zones;
      return {quante: z.length, zona: z[0] || null};
    }, IMPULSO);
    assert.ok(r.quante >= 1, 'nessun order block di impulso rilevato');
    assert.equal(r.zona.dir, 'bull');
    assert.equal(r.zona.src, 'impulso');
    assert.equal(r.zona.x1, 0, 'la zona doveva essere la candela opposta (barra 0)');
    assert.equal(r.zona.top, 100.5, 'tetto zona sbagliato');
    assert.equal(r.zona.bottom, 98.8, 'pavimento zona sbagliato');
    assert.equal(r.zona.mitigated, true, 'il ritorno del prezzo doveva mitigare la zona');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('regola "entrambe": su un movimento con impulso trova comunque la zona', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((spec) => {
      const def = INDICATOR_DEFS['order_blocks'];
      const ind = hydrateIndicators([{id: 1, key: 'order_blocks', params: def.defaultParams()}])[0];
      ind.params.regola = 'entrambe';
      const R = spec.map(a => ({date: new Date(Date.UTC(2024, 0, 1, 0, 0, 0)).toISOString(), open: a[0], high: a[1], low: a[2], close: a[3], volume: 100}));
      rows = R; idx = R.length - 1;
      def.compute(R, idx, ind);
      return {quante: ind.calc.zones.length};
    }, IMPULSO);
    assert.ok(r.quante >= 1, 'con "entrambe" la regola impulso doveva comunque produrre una zona');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('tetto massimo: si disegnano solo le ultime "maxZone" zone', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((spec) => {
      const def = INDICATOR_DEFS['order_blocks'];
      const ind = hydrateIndicators([{id: 1, key: 'order_blocks', params: def.defaultParams()}])[0];
      const R = spec.map(a => ({date: new Date(Date.UTC(2024, 0, 1, 0, 0, 0)).toISOString(), open: a[0], high: a[1], low: a[2], close: a[3], volume: 100}));
      rows = R; idx = R.length - 1;
      def.compute(R, idx, ind);
      // Trenta zone finte, recenti, per provare SOLO il tetto di DISEGNO.
      ind.calc.zones = [];
      for (let k = 0; k < 30; k++) ind.calc.zones.push({dir: 'bull', x1: k, creato: k, top: 101, bottom: 100, mitigated: false, mitIdx: null, src: 'test'});
      const disegna = (maxZone) => {
        ind.params.maxZone = maxZone;
        const rects = [];
        const ctx = {save(){}, restore(){}, measureText(){return {width: 10};},
          fillRect(x, y, w, h){ rects.push(w); }, strokeRect(){}, fillText(){},
          set font(v){}, set textBaseline(v){}, set textAlign(v){},
          set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){}};
        def.render(ctx, ind, R, 0, 45, (j) => j * 10, (v) => 1000 - v);
        return rects.length;
      };
      return {cinque: disegna(5), trenta: disegna(30)};
    }, IMPULSO);
    assert.equal(r.cinque, 5, 'con maxZone=5 dovevano disegnarsi 5 zone, non di più');
    assert.equal(r.trenta, 30, 'con maxZone=30 dovevano disegnarsi tutte le 30 zone');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('interfaccia: la voce nel menù, i comandi nelle impostazioni e la guida montata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const voce = !!document.querySelector('#indicatorSelect option[value="order_blocks"]');
      addIndicator('order_blocks');
      const ind = activeIndicators[activeIndicators.length - 1];
      openIndicatorSettingsModal(ind);
      const body = document.getElementById('indicatorSettingsModalBody');
      const guida = body.querySelector('.fbGuide[data-guide="ind_order_blocks"]');
      const blocchi = body.querySelectorAll('.fbGuideSet').length;
      const regolaSel = body.querySelector('select');
      const opzioni = regolaSel ? Array.from(regolaSel.options).map(o => o.value) : [];
      return {voce, guida: !!guida, titolo: guida ? guida.querySelector('.fbGuideHead').textContent : '', blocchi, opzioni};
    });
    assert.equal(r.voce, true, 'nel menù "+ Aggiungi indicatore" manca la voce Order Blocks');
    assert.equal(r.guida, true, 'la guida dell\'Order Block non si è montata nel pannello delle impostazioni');
    assert.ok(r.titolo.includes('Order Block'), 'la guida montata non è quella dell\'Order Block');
    assert.equal(r.blocchi, 4, 'la guida doveva spiegare 4 gruppi di impostazioni');
    assert.deepEqual(r.opzioni, ['struttura', 'impulso', 'entrambe'], 'il comando "Regola" non ha le tre scelte');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
