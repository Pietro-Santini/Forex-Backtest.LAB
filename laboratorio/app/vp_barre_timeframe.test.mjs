// LE BARRE DENTRO L'ISTOGRAMMA NON SI TOCCANO AL CAMBIO DI TIME FRAME.
//
// Parole del proprietario (10 novembre 2026): «se io ho scelto che nell'istogramma devono
// esserci 300 barre, non si devono modificare al cambio di time frame. Cioe', le barre
// rimangono lo stesso numero anche se io cambio time frame, e devono prendere come riferimento
// quello che e' la dimensione del time frame a un minuto. Quindi se a un minuto ci sono 300
// barre e metto un time frame da 5 minuti, anche l'istogramma disegnato su un time frame da 5
// minuti contiene 300 barre, e non di meno. Ne' di meno ne' di piu', deve essere sempre
// uguale: con un time frame da un minuto, da 5, da 15, da 30 minuti, da un'ora, eccetera.»
//
// Nel lessico del progetto «le barre dentro l'istogramma» sono le CANDELE che il profilo
// volumetrico copre (stessa voce del 28 ottobre e del 9 novembre: «cambiando timeframe il
// numero di candele dentro l'istogramma non deve cambiare»). Le FASCE (le righe orizzontali
// dell'istogramma) sono un altro numero e sono gia' a posto: si controllano nella terza prova.
//
// COME SI MISURA: il profilo si crea CON I CLIC VERI dell'utente sul canvas #chart (cosi' nasce
// dal codice dell'app, non da un oggetto scritto a mano nel banco), poi si contano le candele di
// `rows` dentro l'intervallo [p1.time, p2.time] del profilo dopo ogni cambio di time frame fatto
// dal controllo vero (#tf). Quello e' il numero di barre che l'istogramma contiene davvero,
// perche' il volume dell'istogramma si calcola su quelle candele.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const N = 300; // le barre che l'utente ha scelto (oggi 300)
const TF_PROVATI = [1, 5, 15, 30, 60]; // un minuto, 5, 15, 30 minuti, un'ora: come la richiesta

// Storico da 1 minuto (il minuto e' il riferimento), poi il profilo disegnato con i due clic
// sulle candele N-1 e ultima: la stessa cosa che fa l'utente col mouse. 30000 minuti = 500 ore,
// abbastanza per contenere 300 barre anche a un'ora.
const PREPARA = (n) => `(function(){
  const t0=Date.UTC(2026,9,20,8,0,0); const R=[]; let p=1900;
  for(let i=0;i<30000;i++){ p+=(Math.sin(i/13)+Math.cos(i/7))*0.3;
    R.push({date:new Date(t0+i*60000).toISOString(),open:p,high:p+0.8,low:p-0.8,close:p+0.1,volume:10+(i%7)}); }
  csvLibrary=[{name:'t',rows:R}]; rebuildBaseRowsFromLibrary();
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD'; liveModeActive=false; liveReplayActive=false;
  currentTF=1; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
  viewEnd=rows.length-1; idx=rows.length-1; visibleCount=400; autoFitWidth=false; followLatest=false;
  drawings=[]; draw();
  const a=rows.length-${n}, b=rows.length-1;
  const g=chartGeometry(), ts=getRowsTimestamps(), bb=$('chart').getBoundingClientRect();
  // Coordinate RELATIVE al canvas (chartGeometry lavora dentro il riquadro): il clic si fa con
  // locator('#chart').click({position}), che porta il grafico in vista da solo. L'altezza è a
  // meta' riquadro: il prezzo del clic non conta (il profilo prende il suo range dalle candele
  // della finestra, non dai prezzi delle maniglie) e una y fuori dal canvas bloccherebbe il clic.
  return {px1:g.xFromTime(ts[a]), py1:bb.height*0.45,
          px2:g.xFromTime(ts[b]), py2:bb.height*0.45};
})()`;

const CLICCA = (px, py) => ({position: {x: px, y: py}});

// Quante barre entrano nell'istogramma ADESSO: l'intervallo [aIdx,bIdx] che decide proprio
// vpFixedResolveRange, cioe' le candele su cui il volume dell'istogramma viene calcolato. Piu' i
// minuti coperti e il ramo che il codice ha scelto (tempo o numero di candele) per dire il perche'.
const LEGGI = `(function(){
  const d=drawings[0]; if(!d)return null;
  const ts=getRowsTimestamps();
  const r=vpFixedResolveRange(d,ts,idx,rows.length);
  const a=Math.min(r.aIdx,r.bIdx), b=Math.max(r.aIdx,r.bIdx);
  return {tipo:d.type, barre:b-a+1, minutiCoperti:Math.round((d.p2.time-d.p1.time)/60000),
          candleCount:d.candleCount||null,
          ancoraggioScelto:(typeof _vpTfKeepTime==='function')?(_vpTfKeepTime(d)?'tempo':'candele'):null};
})()`;

async function profiloDisegnato(){
  const {browser, pagina, errori} = await apriApp();
  const c = await pagina.evaluate(PREPARA(N));
  await pagina.evaluate(() => { setDrawTool('vpfixed'); });
  await pagina.locator('#chart').click(CLICCA(c.px1, c.py1));
  await pagina.locator('#chart').click(CLICCA(c.px2, c.py2));
  await pagina.evaluate(() => { draw(); });
  const creato = await pagina.evaluate(LEGGI);
  return {browser, pagina, errori, creato};
}

// Gira per tutti i time frame della richiesta e restituisce la tabella {tf5:60, tf15:20, ...}
// con i minuti coperti e il ramo scelto dal codice.
async function tabella(pagina){
  const misurati = {minuti: null, ramo: null};
  for (const tf of TF_PROVATI) {
    if (tf !== 1) {
      await pagina.evaluate((t) => { $('tf').value = String(t); $('tf').dispatchEvent(new Event('change')); draw(); }, tf);
    }
    const d = await pagina.evaluate(LEGGI);
    assert.ok(d, 'il profilo deve restare disegnato dopo il cambio di time frame');
    misurati['tf' + tf] = d.barre;
    misurati.minuti = d.minutiCoperti;
    misurati.ramo = d.ancoraggioScelto;
    misurati.candleCount = d.candleCount;
  }
  return misurati;
}

function sbagliati(misurati){
  const male = {};
  for (const tf of TF_PROVATI) if (misurati['tf' + tf] !== N) male['tf' + tf] = misurati['tf' + tf];
  return male;
}

test('il profilo disegnato dall\'utente tiene N barre a ogni time frame', async () => {
  const {browser, pagina, errori, creato} = await profiloDisegnato();
  try {
    assert.ok(creato && creato.tipo === 'vpfixed',
      'i due clic devono creare un profilo volumetrico a intervallo fisso: ' + JSON.stringify(creato));
    assert.equal(creato.barre, N,
      'a 1 minuto il profilo copre le ' + N + ' barre scelte: ' + JSON.stringify(creato));
    const misurati = await tabella(pagina);
    assert.deepEqual(errori, []);
    // Un solo assert, con la tabella completa nel messaggio: il difetto si vede dai numeri.
    assert.deepEqual(sbagliati(misurati), {},
      'le barre dentro l\'istogramma devono restare ' + N + ' a ogni time frame. Dove non succede: '
      + JSON.stringify(sbagliati(misurati)) + ' — tabella completa: ' + JSON.stringify(misurati));
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: la scelta «il numero di candele» (quella che il modale salva col pulsante OK) tiene le barre', async () => {
  const {browser, pagina, errori, creato} = await profiloDisegnato();
  try {
    assert.ok(creato && creato.tipo === 'vpfixed', 'il profilo deve esistere: ' + JSON.stringify(creato));
    // Cio' che fa applyVpSettingsFromModal() quando l'utente apre le impostazioni del profilo e
    // preme OK: la scelta della tendina «al cambio di time frame tieni fermo» finisce nel disegno.
    await pagina.evaluate(() => {
      const d = drawings[0];
      d.tfAnchor = 'candles'; d.vpTfAnchor = 'candles';
      draw();
    });
    const misurati = await tabella(pagina);
    assert.deepEqual(errori, []);
    assert.deepEqual(sbagliati(misurati), {},
      'con la scelta sul numero di candele le barre restano ' + N + ' a ogni time frame. Dove non '
      + 'succede: ' + JSON.stringify(sbagliati(misurati)) + ' — tabella completa: ' + JSON.stringify(misurati));
    assert.equal(misurati.ramo, 'candele',
      'e il ramo scelto dal codice dev\'essere quello del numero di candele: ' + JSON.stringify(misurati));
    assert.equal(misurati.candleCount, N,
      'con il conto scritto nel disegno (candleCount), non lasciato al calcolo della volta dopo: '
      + JSON.stringify(misurati));
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: le fasce dell\'istogramma (le righe) non dipendono dal time frame', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // Il sintomo «le barre diminuiscono» non sono le fasce orizzontali: quelle sono quante
    // l'utente le chiede (qui 200, il numero con cui nasce un profilo nuovo), a ogni time frame.
    const r = await pagina.evaluate(`(function(){
      const t0=Date.UTC(2026,9,20,8,0,0); const R=[]; let p=1900;
      for(let i=0;i<3000;i++){ p+=(Math.sin(i/13)+Math.cos(i/7))*0.3;
        R.push({date:new Date(t0+i*60000).toISOString(),open:p,high:p+0.8,low:p-0.8,close:p+0.1,volume:10+(i%7)}); }
      csvLibrary=[{name:'t',rows:R}]; rebuildBaseRowsFromLibrary();
      currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD'; liveModeActive=false; liveReplayActive=false;
      const out={};
      [1,5,15].forEach(function(tf){
        currentTF=tf; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
        const prof=computeVolumeProfile(0, rows.length-1, 200);
        out['tf'+tf]=prof?prof.buckets:0;
      });
      return out;
    })()`);
    assert.deepEqual(errori, []);
    assert.equal(r.tf1, 200, 'le fasce richieste sono 200 anche a 1 minuto: ' + JSON.stringify(r));
    assert.equal(r.tf5, r.tf1, 'e restano 200 a 5 minuti: ' + JSON.stringify(r));
    assert.equal(r.tf15, r.tf1, 'e a 15 minuti: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});
