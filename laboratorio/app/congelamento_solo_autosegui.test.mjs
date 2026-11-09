// A MERCATO CHIUSO SI FERMA L'AUTO-SEGUI, NON IL GRAFICO.
//
// PRIMA CURA (v2.1.0, RITIRATA): congelavo `end` sempre, a mercato chiuso.
// MISURATO dal proprietario: «il grafico mi si sposta solo in verticale ma non in
// orizzontale» — di sabato, mercato chiuso tutto il giorno, non si poteva piu'
// scorrere la cronologia. Una regressione pesante, e aveva ragione.
//
// REGOLA GIUSTA, che questi test tengono:
//   - auto-segui acceso (followLatest) + mercato chiuso -> la finestra NON avanza
//     da sola oltre l'ultima candela aperta (era quello che faceva scorrere il
//     tempo e spostare disegni e indicatori);
//   - spostamento a mano (pan/zoom) -> SI MUOVE, sempre, anche a mercato chiuso.
//     Appena si sposta il grafico followLatest diventa false, quindi il
//     congelamento non c'e' piu'.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Come PREPARA_GRAFICO di mercato_chiuso.test.mjs: candele vere, mercato poi chiuso.
const PREPARA = () => {
  const t0 = Date.now() - 150*60000; let p = 4100; const R = [];
  for(let i=0;i<150;i++){ const o=p, c=p+Math.sin(i/7)*2;
    R.push({date:new Date(t0+i*60000).toISOString(),open:o,high:Math.max(o,c)+1,low:Math.min(o,c)-1,close:c,volume:10}); p=c; }
  R[R.length-1].close = 4100;
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; currentAssetKey='XAUUSD';
  csvLibrary=[{id:'xau',rows:R}];
  liveModeActive=true; liveReplayActive=false; mt5Connected=false; mt5ActiveSymbol=null;
  capitalWsPrimaryEpic='XAUUSD_EPIC'; epicToAsset['XAUUSD_EPIC']='XAUUSD';
};
// Mercato chiuso: sabato/domenica chiusi per liveSessionPhaseAt, e calendario vuoto.
const CHIUDI = () => {
  orariAsset['XAUUSD']={zona:'UTC',giorni:{mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[]},
                        stato:'CLOSED',letto:Date.now()};
};

test('a mercato chiuso, spostando il grafico a mano la finestra SI MUOVE (la regressione v2.1.0)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(`(${PREPARA})()`);
    const r = await pagina.evaluate(`(() => {
      (${CHIUDI})();
      followLatest=false;                       // l'utente ha appena spostato il grafico
      viewEnd=80;                               // torno indietro nella cronologia
      const a=getViewWindow();
      viewEnd=120;                              // vado avanti
      const b=getViewWindow();
      return {aEnd:a.end, bEnd:b.end, aStart:a.start, bStart:b.start,
              fermo:fblMercatoFermoOra('XAUUSD', Date.now())};
    })()`);
    assert.equal(r.fermo, true, 'il banco deve avere il mercato davvero chiuso');
    assert.equal(r.bEnd, 120, 'la finestra deve poter andare avanti: ' + JSON.stringify(r));
    assert.ok(r.bStart > r.aStart, 'e lo start deve seguire: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// IL CASO VERO DELLA REGRESSIONE v2.1.0: nel dataset ci sono candele DOPO la chiusura
// (weekend), quindi il punto di congelamento cade PRIMA dell'ultima candela. Con la cura
// rotta il congelamento era attivo sempre e la vista veniva ribloccata indietro: non si
// poteva andare avanti. Qui si misura proprio quello.
test('a mercato chiuso con candele oltre la chiusura, andare AVANTI a mano resta possibile', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(`(${PREPARA})()`);
    const r = await pagina.evaluate(`(() => {
      (${CHIUDI})();
      // Venerdi' 6 novembre 2026, aperto fino alle 22 (ora di Roma): 90 candele APERTE.
      // Poi sabato 7 novembre, tutto chiuso: 40 candele CHIUSE. Il punto di congelamento
      // cade all'indice 90, ben prima della fine del dataset: e' il caso della regressione.
      const VEN = Date.UTC(2026,10,6,20,0,0);      // 20:00 UTC = 21:00 Roma (aperto)
      rows=[]; baseRows=[]; let p=4100;
      for(let i=0;i<90;i++){
        const t=VEN+i*60000, o=p, c=p+Math.sin(i/7)*2;
        rows.push({date:new Date(t).toISOString(),open:o,high:Math.max(o,c)+1,low:Math.min(o,c)-1,close:c,volume:10});
        p=c;
      }
      for(let i=0;i<40;i++){
        const t=VEN+90*60000+(i+1)*3600000;
        rows.push({date:new Date(t).toISOString(),open:4100,high:4101,low:4099,close:4100,volume:0});
      }
      baseRows=rows.slice(); idx=rows.length-1; viewEnd=rows.length;
      const totale=rows.length;
      followLatest=false;
      viewEnd=totale-1;                          // voglio vedere l'ULTIMA candela
      const a=getViewWindow();
      viewEnd=totale-5;                          // e anche 5 prima
      const b=getViewWindow();
      return {totale,aEnd:a.end,bEnd:b.end};
    })()`);
    assert.ok(r.totale>=130, 'la prova deve avere candele oltre la chiusura: '+JSON.stringify(r));
    // L'ultima candela VERA, non una posizione in piu': dalla cura della zona morta (8 novembre
    // 2026) arrivare a rows.length significava finire nello spazio vuoto dopo l'ultima candela.
    assert.equal(r.aEnd, r.totale-1,
      'si deve poter arrivare fino all\'ultima candela vera: '+JSON.stringify(r));
    assert.ok(r.bEnd < r.aEnd, 'e tornare indietro: '+JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('a mercato chiuso in AUTO-SEGUI la finestra non avanza da sola', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(`(${PREPARA})()`);
    const r = await pagina.evaluate(`(() => {
      (${CHIUDI})();
      followLatest=true;                        // auto-segui acceso
      const a=getViewWindow();
      // Il rollover fa avanzare idx/viewEnd da solo: la finestra non deve seguirlo.
      idx=165; viewEnd=166;
      const b=getViewWindow();
      return {aEnd:a.end, bEnd:b.end, aStart:a.start, bStart:bStart(b)};
      function bStart(w){ return w.start; }
    })()`);
    assert.equal(r.aEnd, r.bEnd,
      'in auto-segui a mercato chiuso la finestra non deve avanzare: ' + JSON.stringify(r));
    assert.equal(r.aStart, r.bStart,
      'e di conseguenza non devono muoversi i disegni: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('a mercato chiuso in auto-segui i disegni restano fermi (xFromTime costante)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(`(${PREPARA})()`);
    const r = await pagina.evaluate(`(() => {
      (${CHIUDI})();
      followLatest=true;
      const t=Date.parse(rows[10].date);
      const g1=chartGeometry(); const x1=g1?g1.xFromTime(t):null;
      idx=165; viewEnd=166;
      const g2=chartGeometry(); const x2=g2?g2.xFromTime(t):null;
      return {x1,x2};
    })()`);
    assert.equal(r.x2, r.x1,
      'un disegno ancorato al tempo non deve spostarsi: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('a mercato APERTO l\'auto-segui continua ad avanzare (la cura non spegne il motore)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(`(${PREPARA})()`);
    const r = await pagina.evaluate(`(() => {
      delete orariAsset['XAUUSD'];             // nessun calendario: mercato aperto
      const _D=Date.now; Date.now=()=>Date.UTC(2026,9,20,15,0,0);
      followLatest=true;
      const a=getViewWindow();
      idx=160; viewEnd=161;                    // la formazione avanza davvero
      const b=getViewWindow();
      Date.now=_D;
      return {aEnd:a.end, bEnd:b.end};
    })()`);
    assert.ok(r.bEnd > r.aEnd,
      'a mercato aperto la finestra deve avanzare con le candele: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
