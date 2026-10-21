// DENTRO IL GRAFICO, SU UN TELEFONO, I PULSANTI NON SI SOVRAPPONGONO.
//
// SEGNALATO dal proprietario fra i punti del telefono: «dentro il grafico i pulsanti stanno uno
// sopra l'altro».
//
// PERCHE' IL BANCO DI PROVA NON LO VEDEVA, e perche' questo test e' scritto cosi'. Misurando i
// gruppi flottanti in tre finestre da telefono, le sovrapposizioni erano ZERO: `qtAutoLayout`
// faceva il suo lavoro. Il motivo e' che nel banco meta' dei gruppi e' NASCOSTA (barra del
// replay, legenda degli indicatori, barra degli strumenti): si vedono sul telefono vero, in
// Live, con quelle barre accese. E qtAutoLayout si scansava da DUE gruppi su sei.
//
// Due difetti, trovati leggendo invece che guardando:
//   1. l'elenco dei gruppi da cui scansarsi era fermo a chartFloatControls e
//      chartFloatControlsExtra: tutto il resto non esisteva, per lui;
//   2. la legenda degli indicatori stava a `top:86px` SCRITTO A MANO nel CSS - un numero che vale
//      solo se le righe di pulsanti sono alte esattamente 86 px. Vanno a capo in base a quanti
//      pulsanti sono accesi: appena diventano piu' alte, la legenda ci finisce sotto.
//
// La regola di questo test: i gruppi si ACCENDONO prima di misurare. Un test che misura la
// finestra come viene fuori dal banco misura una situazione che sul telefono non esiste.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

// Accende tutti i gruppi flottanti dentro il grafico e restituisce le sovrapposizioni.
const MISURA = () => {
  const host = document.getElementById('chartWrap');
  const sel = ['#chartFloatControls', '#chartFloatControlsExtra', '.inChartIndLegend',
               '#liveReplayBar', '#indicatorsToolbar', '#quickTradeCluster'];
  // ACCESI: e' la condizione del telefono in Live, non quella del banco.
  const gruppi = [];
  sel.forEach(s => [...host.querySelectorAll(s)].forEach(e => {
    e.style.display = (e.id === 'quickTradeCluster' || e.classList.contains('inChartIndLegend'))
      ? 'flex' : '';
    if (e.classList.contains('inChartIndLegend') && !e.children.length) {
      // Una legenda vuota non occupa spazio: le si da' del contenuto, come quando ci sono
      // indicatori accesi.
      const d = document.createElement('div');
      d.className = 'indChip'; d.textContent = 'EMA 200';
      d.style.cssText = 'height:22px;background:#111';
      e.appendChild(d);
    }
    gruppi.push(e);
  }));
  qtAutoLayout();
  const hr = host.getBoundingClientRect();
  const visibili = gruppi.filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  const sovr = [];
  for (let i = 0; i < visibili.length; i++) for (let j = i + 1; j < visibili.length; j++) {
    const A = visibili[i], B = visibili[j];
    if (A.contains(B) || B.contains(A)) continue;
    const a = A.getBoundingClientRect(), b = B.getBoundingClientRect();
    const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (ox > 2 && oy > 2) sovr.push({
      a: A.id || A.className, b: B.id || B.className, ox: Math.round(ox), oy: Math.round(oy)
    });
  }
  const leg = host.querySelector('.inChartIndLegend');
  const pulsanti = host.querySelector('#chartFloatControls');
  const barra = host.querySelector('#quickTradeCluster');
  // Quante righe occupano i pulsanti: si contano le posizioni verticali distinte dei figli
  // visibili. Una riga sola = un solo valore di `top`.
  const righe = pulsanti
    ? new Set([...pulsanti.children]
        .filter(c => c.getBoundingClientRect().height > 0)
        .map(c => Math.round(c.getBoundingClientRect().top))).size
    : 0;
  return {
    sovr,
    quanti: visibili.length,
    legendaTop: leg ? Math.round(leg.getBoundingClientRect().top - hr.top) : null,
    fondoPulsanti: pulsanti ? Math.round(pulsanti.getBoundingClientRect().bottom - hr.top) : null,
    clusterTop: barra ? Math.round(barra.getBoundingClientRect().top - hr.top) : null,
    pulsantiTop: pulsanti ? Math.round(pulsanti.getBoundingClientRect().top - hr.top) : null,
    righePulsanti: righe,
    sforoPulsanti: pulsanti ? pulsanti.scrollWidth - pulsanti.clientWidth : null
  };
};

test('con tutti i gruppi accesi, su un telefono, niente si sovrappone', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.setViewportSize({width: 375, height: 812});
    const r = await pagina.evaluate((m) => eval('(' + m + ')')(), MISURA.toString());
    assert.ok(r.quanti >= 3, 'servono almeno tre gruppi accesi, altrimenti non si misura niente: '
      + r.quanti);
    assert.deepEqual(r.sovr, [], 'gruppi sovrapposti dentro il grafico: ' + JSON.stringify(r.sovr));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la legenda degli indicatori sta SOTTO i pulsanti, qualunque altezza abbiano', async () => {
  // Il numero scritto a mano (86) era giusto per caso. Qui si controlla la relazione, non il
  // numero: la legenda comincia dopo la fine delle righe di pulsanti.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.setViewportSize({width: 375, height: 812});
    const r = await pagina.evaluate((m) => eval('(' + m + ')')(), MISURA.toString());
    assert.ok(r.legendaTop != null && r.fondoPulsanti != null, 'servono entrambi per confrontarli');
    assert.ok(r.legendaTop >= r.fondoPulsanti,
      'la legenda (top ' + r.legendaTop + ') non deve cominciare prima della fine dei pulsanti ('
      + r.fondoPulsanti + ')');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('anche in orizzontale, dove l\'altezza e\' quella che manca', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.setViewportSize({width: 812, height: 375});
    const r = await pagina.evaluate((m) => eval('(' + m + ')')(), MISURA.toString());
    assert.deepEqual(r.sovr, [], 'gruppi sovrapposti in orizzontale: ' + JSON.stringify(r.sovr));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i gruppi si cercano per selettore, non per un id indovinato', () => {
  // Scritto perche' ci sono cascato: il primo tentativo cercava getElementById('inChartIndLegend'),
  // ma quello e' il nome della CLASSE - l'elemento ha id `activeIndicators`. Non trovava niente e
  // non faceva niente, in silenzio, e la misura sembrava a posto. Un id sbagliato non da' errore:
  // da' zero elementi.
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  assert.ok(!/getElementById\('inChartIndLegend'\)/.test(src),
    'inChartIndLegend e\' una classe, non un id: getElementById non trovera\' mai niente');
  assert.match(src, /dentroGrafico\('\.inChartIndLegend'\)/,
    'la legenda va cercata per classe dentro il grafico');
  // Il `top` nel CSS resta come punto di partenza per il primissimo disegno, prima che
  // qtAutoLayout giri: quello che conta e' che poi sia il codice a deciderlo, ed e' misurato dal
  // vivo nel test qui sopra. Qui si tiene fermo solo che il codice lo scriva davvero.
  assert.match(src, /if\(leg\.style\.top!==tl\)leg\.style\.top=tl;/,
    'qtAutoLayout deve impostare il top della legenda, non lasciarlo al numero del CSS');
});

test("sul telefono la barra delle operazioni e' attaccata al bordo alto, i pulsanti sotto", async () => {
  // SCELTO dal proprietario il 21 ottobre 2026, fra tre possibilita': «la barra in cima e i
  // pulsanti ridotti a icone su una riga sola». Serviva decidere perche' i due non ci stanno
  // insieme: la barra e' 360 px e il grafico, su un telefono, ne ha 309 - misurati.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.setViewportSize({width: 375, height: 812});
    const r = await pagina.evaluate((m) => eval('(' + m + ')')(), MISURA.toString());
    assert.equal(r.clusterTop, 8, 'la barra delle operazioni deve stare al bordo alto del grafico');
    assert.ok(r.pulsantiTop > r.clusterTop,
      'i pulsanti devono stare SOTTO la barra (barra a ' + r.clusterTop + ', pulsanti a '
      + r.pulsantiTop + ')');
    assert.deepEqual(r.sovr, []);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una riga sola, e NIENTE nascosto dietro uno scorrimento', async () => {
  // La trappola da evitare: «una riga sola» ottenuta mettendoci dentro uno scorrimento orizzontale
  // nasconde i pulsanti oltre il bordo, ed e' lo stesso difetto delle schede delle impostazioni
  // (irraggiungibili). I sei comandi chiedevano 388 px in 293 disponibili: ci stanno perche'
  // «DATA RANDOM» perde la scritta e resta l'icona, e il selettore dell'asset si accorcia.
  const {browser, pagina, errori} = await apriApp();
  try{
    for (const vp of [{w: 375, h: 812}, {w: 320, h: 568}]) {
      await pagina.setViewportSize({width: vp.w, height: vp.h});
      const r = await pagina.evaluate((m) => eval('(' + m + ')')(), MISURA.toString());
      assert.equal(r.righePulsanti, 1,
        vp.w + 'px: i pulsanti devono stare su UNA riga, trovate ' + r.righePulsanti);
      assert.ok(r.sforoPulsanti <= 1,
        vp.w + 'px: nessun pulsante deve restare fuori dalla riga (sforo ' + r.sforoPulsanti + ' px)');
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('su uno schermo largo non cambia niente: i pulsanti restano in alto', async () => {
  // La correzione vale per il telefono. Su un monitor la barra e i pulsanti stanno sulla stessa
  // riga senza toccarsi, e spingere i pulsanti in basso sarebbe un peggioramento gratuito.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.setViewportSize({width: 1400, height: 900});
    const r = await pagina.evaluate((m) => eval('(' + m + ')')(), MISURA.toString());
    assert.equal(r.pulsantiTop, 8, 'su schermo largo i pulsanti restano al bordo alto');
    assert.deepEqual(r.sovr, [], 'e non si sovrappongono alla barra: ' + JSON.stringify(r.sovr));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
