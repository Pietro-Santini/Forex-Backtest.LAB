// FOOTPRINT: stile (bidask/delta/volume) e "righe per candela" come impostazioni GLOBALI.
// Segnalato dal proprietario: cliccando le candele lo stile cambia, ma cambiando asset o
// timeframe "torna indietro da solo" e le righe non sono più quelle scelte. Causa verificata:
// erano campi di SESSIONE, quindi applyLightSessionState() (invocata al cambio asset/TF/sessione)
// li riportava allo snapshot salvato ('bidask' e 12). Questi test bloccano la regressione.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('un ripristino di sessione NON azzera stile e righe-per-candela scelti', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const fire = (id, ev) => { const el = document.getElementById(id); if (el) el.dispatchEvent(new Event(ev, {bubbles:true})); };
      const sel = document.getElementById('footprintStyle'); sel.value = 'delta'; fire('footprintStyle','change');
      const rt = document.getElementById('footprintAutoRowsTarget'); rt.value = '20'; fire('footprintAutoRowsTarget','change');
      // Snapshot di una sessione VECCHIA che proverebbe a imporre bidask/12.
      applyLightSessionState({version: (typeof SESSION_VERSION!=='undefined'?SESSION_VERSION:10),
        fields:{footprintStyle:'bidask', footprintAutoRowsTarget:'12'}});
      return {style: footprintStyleNow(), rowsTarget: document.getElementById('footprintAutoRowsTarget').value};
    });
    assert.equal(r.style, 'delta', 'lo stile footprint scelto non deve tornare a bidask');
    assert.equal(r.rowsTarget, '20', 'le righe per candela scelte non devono tornare a 12');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('stile e righe-per-candela NON fanno parte dei campi di sessione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => ({
      inSessione: SESSION_CONFIG_FIELD_IDS.includes('footprintStyle') || SESSION_CONFIG_FIELD_IDS.includes('footprintAutoRowsTarget'),
      inStile: STYLE_CLONE_FIELD_IDS.includes('footprintStyle') || STYLE_CLONE_FIELD_IDS.includes('footprintAutoRowsTarget'),
    }));
    assert.equal(r.inSessione, false, 'footprintStyle/righe non devono essere campi di sessione');
    assert.equal(r.inStile, false, 'footprintStyle/righe non devono essere clonati per sessione');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il ciclo stile (bidask→delta→volume) funziona e resta scelto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const sel = document.getElementById('footprintStyle');
      sel.value = 'bidask';
      const seq = [];
      footprintCicloStile(); seq.push(footprintStyleNow());
      footprintCicloStile(); seq.push(footprintStyleNow());
      footprintCicloStile(); seq.push(footprintStyleNow());
      return {seq};
    });
    assert.deepEqual(r.seq, ['delta', 'volume', 'bidask'], 'il clic cicla bidask→delta→volume→bidask');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});


// ============================== SCALA UNIFORME DEL FOOTPRINT ==============================
// RICHIESTO dal proprietario, in sostituzione delle "righe fisse per candela": il passo di riga
// deve essere UNO SOLO per tutto il grafico (in pip e quindi in pixel). Conseguenza voluta: una
// candela corta mostra POCHE righe, una lunga NE MOSTRA MOLTE, e le caselline restano alte uguali
// in tutta la vista — con la stessa dimensione del testo.
// Prima si riaggregava la griglia DENTRO ogni candela in un numero fisso di fasce
// (footprintResliceFisse): due caselline affiancate potevano valere 3 pip e 40 pip, i numeri non
// erano confrontabili fra candele e il testo ballava.
//
// Come si prova che il test serve: rimettendo la riaggregazione per candela, il primo test va
// rosso perché entrambe le candele chiedono lo stesso numero di righe.

// Disegna una candela di footprint su un canvas vero e restituisce i livelli di prezzo che la
// funzione ha DAVVERO chiesto di convertire in pixel: da quelli si leggono le righe disegnate.
const DISEGNA = (nRighe) => {
  // Passo 1 e livelli interi: le chiavi delle righe tornano identiche passando da testo a numero
  // (come nei bucket veri) e i bordi a mezzo passo sono esatti, senza polvere di virgola mobile.
  const passo = 1;                          // il passo globale, lo stesso per tutte le candele
  const base = 100;
  const fp = {step: passo, rows: {}};
  for (let k = 0; k < nRighe; k++) fp.rows[base + k * passo] = {buy: 5 + k, sell: 4};
  // Alta/bassa (e apertura/chiusura) sui bordi esatti della prima e dell'ultima riga, così gli
  // unici livelli chiesti sono i bordi delle righe e il conto si legge senza ambiguità.
  const lo = base - passo / 2, hi = base + (nRighe - 0.5) * passo;
  const r = {open: lo, close: hi, high: hi, low: lo, volume: 1};
  const chiesti = [];
  const yFn = p => { chiesti.push(p); return 900 - (p - base) * 10; };
  const ctx = document.createElement('canvas').getContext('2d');
  drawFootprintCandle(ctx, r, 300, 60, yFn, fp, '#ffffff', 'bidask', {up:'#26a69a', down:'#ef5350', passo:60});
  const liv = [...new Set(chiesti)].sort((a, b) => a - b);
  const salti = [];
  for (let i = 1; i < liv.length; i++) salti.push(liv[i] - liv[i - 1]);
  return {bordi: liv.length, salti, passo};
};

test('scala uniforme: una candela lunga mostra PIU\' righe di una corta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((d) => {
      const f = eval('(' + d + ')');
      return {corta: f(4), lunga: f(40)};
    }, DISEGNA.toString());
    // N righe disegnate = N+1 bordi (le righe sono attaccate e condividono i bordi).
    assert.equal(r.corta.bordi, 5, 'una candela da 4 righe deve disegnarne 4, non un numero fisso');
    assert.equal(r.lunga.bordi, 41, 'una candela da 40 righe deve disegnarne 40');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('scala uniforme: il passo fra le righe e\' lo STESSO su candele diverse', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((d) => {
      const f = eval('(' + d + ')');
      return {corta: f(4), lunga: f(40)};
    }, DISEGNA.toString());
    [['corta', r.corta], ['lunga', r.lunga]].forEach(([nome, o]) => {
      o.salti.forEach(s => assert.ok(Math.abs(s - o.passo) < 1e-12,
        'sulla candela ' + nome + ' tutte le righe devono essere alte uguali (passo ' + o.passo + ', trovato ' + s + ')'));
    });
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la riaggregazione per candela non esiste piu\'', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => typeof window.footprintResliceFisse);
    assert.equal(r, 'undefined', 'il regrigliato dentro la singola candela e\' stato tolto: il passo e\' uno solo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
