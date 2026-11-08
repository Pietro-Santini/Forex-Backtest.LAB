// A MERCATO CHIUSO LE LINEE ENTRY/TP/SL DEGLI ORDINI PENDENTI DEVONO VEDERSI.
//
// SEGNALATO dal proprietario (8 novembre 2026): «non si vedono piu' le linee entry tp-sl degli
// ordini pendenti, ne' in modalita' replay ne' in tempo reale, quando il mercato e' chiuso».
//
// Le righe attraversano il grafico da un bordo all'altro; l'unica condizione che le nasconde è
// finire FUORI dal range verticale [lo,hi] (lo/hi vengono da computePriceRange(data), e i prezzi
// degli ordini pendenti entrano in quel range tramite collectTradeLevelPrices). Quindi la misura
// giusta è: l'entrata, lo stop e il target di un ordine pendente restano DENTRO il range
// verticale calcolato a mercato chiuso, non fuori.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = () => {
  const VEN = Date.UTC(2026,10,6,20,0,0);
  rows=[]; baseRows=[]; let p=4100;
  for(let i=0;i<120;i++){                                // 120 candele APERTE (venerdi' sera)
    const t=VEN+i*60000, o=p, c=p+Math.sin(i/7)*2;
    rows.push({date:new Date(t).toISOString(),open:o,high:Math.max(o,c)+1,low:Math.min(o,c)-1,close:c,volume:10});
    p=c;
  }
  for(let i=0;i<40;i++){                                 // poi il weekend, tutto chiuso
    const t=VEN+120*60000+(i+1)*3600000;
    rows.push({date:new Date(t).toISOString(),open:4100,high:4101,low:4099,close:4100,volume:0});
  }
  baseRows=rows.slice(); idx=rows.length-1; viewEnd=rows.length;
  currentAssetKey='XAUUSD'; csvLibrary=[{id:'xau',rows}];
  liveModeActive=true; liveReplayActive=false; mt5Connected=false;
  positions=[];
  pendingOrders=[{id:'p1',asset:'XAUUSD',side:'BUY',kind:'LIMIT',entry:4080,
                  sl:4070,tp:4120,lots:0.1,createdAt:VEN}];
};

const CHIUDI = () => {
  orariAsset['XAUUSD']={zona:'UTC',giorni:{mon:[],tue:[],wed:[],thu:[],fri:['00:00 - 22:00'],sat:[],sun:[]},
                        stato:'CLOSED',letto:Date.now()};
};

test("a mercato chiuso l'entrata dello stop e del target di un ordine pendente restano nel range", async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(() => {
      (${PREPARA})();
      (${CHIUDI})();
      followLatest = true;                     // come all'apertura: auto-segui acceso
      const w = getViewWindow();
      const data = getVisibleData();
      const {lo,hi} = computePriceRange(data);
      const p = pendingOrders[0];
      return {entry:p.entry, sl:p.sl, tp:p.tp, lo:lo, hi:hi,
              visibili: (computePriceRange(data), [lo,hi,p.entry,p.sl,p.tp].every(Number.isFinite))};
    })()`);
    assert.ok(r.visibili, 'tutti i numeri devono essere finiti (un range vuoto darebbe NaN): ' + JSON.stringify(r));
    assert.ok(r.entry >= r.lo && r.entry <= r.hi,
      "l'entrata dell'ordine deve restare dentro il range verticale: " + JSON.stringify(r));
    assert.ok(r.sl >= r.lo && r.sl <= r.hi,
      'e lo stop anche: ' + JSON.stringify(r));
    assert.ok(r.tp <= r.hi,
      'e il target anche: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('a mercato APERTO le stesse righe restano nel range (prova di controllo)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(() => {
      (${PREPARA})();
      fblMercatoMt5Cache['XAUUSD'] = {aperto: true, letto: Date.now()};
      followLatest = true;
      const data = getVisibleData();
      const {lo,hi} = computePriceRange(data);
      const p = pendingOrders[0];
      return {entry:p.entry, sl:p.sl, tp:p.tp, lo:lo, hi:hi};
    })()`);
    assert.ok(r.entry >= r.lo && r.entry <= r.hi, 'aperto: entrata nel range: ' + JSON.stringify(r));
    assert.ok(r.sl >= r.lo && r.sl <= r.hi, 'aperto: stop nel range: ' + JSON.stringify(r));
    assert.ok(r.tp <= r.hi, 'aperto: target nel range: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
