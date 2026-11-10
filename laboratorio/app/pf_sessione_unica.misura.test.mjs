// MISURA (non correzione) â€” DIFETTO 1: attivando la Prop Firm i disegni, la vista del grafico
// (timeframe/candela/zoom) e gli indicatori devono restare IDENTICI a quelli della sessione
// base. Qui si misura cosa fa davvero il codice oggi, in numeri.
//
// Percorso misurato: proceedEnablePropFirm(false) -> startNewPropFirmChallenge(10000)
// (l'attivazione vera della Prop Firm da Storico) e disablePropFirmMode() (la disattivazione).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const candele = (minuti=300) => {
  const t0 = Date.now() - minuti*60000; let p = 4161; const R = [];
  for (let i=0;i<minuti;i++){ const o=p, c=p+Math.sin(i/7)*2;
    R.push({date:new Date(t0+i*60000).toISOString(), open:o, high:Math.max(o,c)+2, low:Math.min(o,c)-2, close:c, volume:10}); p=c; }
  return R;
};

// Stato iniziale realistico: 3 disegni su XAUUSD, vista salvata (TF 5, candela 250, 123 candele
// visibili), 1 indicatore attivo, 1 strategia di trade. Tutto nella sessione base (Storico).
// Le fotografie (capture*) sono quelle che l'app fa SEMPRE prima di lasciare la sessione.
const prepara = (C) => `(function(){
  rows=CJSON; baseRows=CJSON; idx=CJSON.length-1; viewEnd=CJSON.length-50;
  currentAssetKey='XAUUSD'; liveModeActive=false; mt5Connected=false; isPropFirmMode=false;
  csvLibrary=[{id:'a',name:'A',addedAt:Date.now(),rows:CJSON}];
  var d=[{id:'d1',type:'trendline',locked:false,hidden:false,color:'#fff',lineWidth:1,
          p1:{time:Date.parse(CJSON[100].date)+7000,price:4161},p2:{time:Date.parse(CJSON[140].date)+24000,price:4170}},
         {id:'d2',type:'alarmline',price:4200,locked:false,hidden:false,color:'#f00',lineWidth:1},
         {id:'d3',type:'fib',locked:false,hidden:false,color:'#0f0',lineWidth:1,
          p1:{time:Date.parse(CJSON[10].date)+1000,price:4100},p2:{time:Date.parse(CJSON[20].date)+2000,price:4300}}];
  drawings=d;
  var masterTimeVal=Date.parse(CJSON[249].date)+30000;
  assetChartViews={backtest:{XAUUSD:{masterTime:masterTimeVal,currentTF:5,viewEnd:250,followLatest:true,
                 priceZoomFactor:2,viewPriceLo:null,viewPriceHi:null,autoFitWidth:true,visibleCount:123}},
                 live:{},backtest_propfirm:{},live_propfirm:{}};
  assetDrawings={backtest:{XAUUSD:d},live:{},backtest_propfirm:{},live_propfirm:{}};
  activeIndicators=[{id:'ind1',key:'vp_daily',params:{days:3},hidden:false}];
  indicatorsByMode={backtest:null,live:null,backtest_propfirm:null,live_propfirm:null};
  tradeStrategies=[{id:'ts1',nome:'Scalping'}];
  captureCurrentAssetChartView('backtest');
  captureCurrentAssetDrawings('backtest');
  captureCurrentModeSnapshot();
  return true;
})()`.replace(/CJSON/g, () => 'C');

test('attivando la Prop Firm, disegni/vista/indicatori della base NON arrivano nella nuova sessione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const m = await pagina.evaluate(`(async function(){
      var C=${JSON.stringify(candele(300))};
      ${prepara(candele(300))}
      // ---- ATTIVAZIONE VERA (stesso percorso del pulsante) ----
      var erroreAttivazione=null;
      try{ await proceedEnablePropFirm(false); }catch(e){ erroreAttivazione=String(e).slice(0,120); }
      var dopoModulo={disegni:drawings.length, indic:activeIndicators.length};
      await startNewPropFirmChallenge(10000);      // capitale confermato -> Challenge creata
      return {
        dopoModulo:dopoModulo,
        erroreAttivazione:erroreAttivazione,
        modo:currentMode(),
        disegniDopo:drawings.length,
        assetDrawingsPf:((assetDrawings['backtest_propfirm']||{})['XAUUSD'])||null,
        assetDrawingsPfVuoto:Object.keys(assetDrawings['backtest_propfirm']||{}).length,
        assetDrawingsBase:(((assetDrawings['backtest']||{})['XAUUSD'])||[]).length,
        vistaPf:((assetChartViews['backtest_propfirm']||{})['XAUUSD'])||null,
        vistaBaseTF:((assetChartViews['backtest']||{})['XAUUSD']||{}).currentTF,
        indicatoriEreditati:activeIndicators.length,
        indicatoriChiave:activeIndicators[0]?activeIndicators[0].key:null,
        indicatorsByModePf:((indicatorsByMode['backtest_propfirm']||[]).length),
        strategies:tradeStrategies.length,
        sessionPfEsiste:!!sessionByMode['backtest_propfirm'],
        sessionPfDisegni:sessionByMode['backtest_propfirm']?(sessionByMode['backtest_propfirm'].drawings||[]).length:-1,
        pfSourceDefinita:('pfSourceDrawings' in window)
      };
    })()`);
    assert.equal(m.modo, 'backtest_propfirm', 'siamo davvero in sessione Prop Firm');
    assert.ok(!/pfSourceDrawings is not defined/.test(m.erroreAttivazione||''),
      'attivare la Prop Firm NON deve esplodere piu\' sul frammento P13 (curato 10/11/2026): ' + m.erroreAttivazione);
    assert.equal(m.disegniDopo, 3, 'i 3 disegni della base devono restare a grafico in Prop Firm (sessione unica)');
    assert.equal(Array.isArray(m.assetDrawingsPf)?m.assetDrawingsPf.length:-1, 3, 'la sessione Prop Firm deve avere i 3 disegni della base (sessione unica)');
    assert.equal(m.assetDrawingsPfVuoto, 1, 'un asset con i disegni copiati nella sessione Prop Firm');
    assert.equal(m.assetDrawingsBase, 3, 'i disegni della base sono ancora salvati (ma non usati in Prop Firm)');
    assert.ok(m.vistaPf && typeof m.vistaPf === 'object', 'la vista del grafico deve passare anche lei nella sessione Prop Firm');
    assert.equal(m.vistaBaseTF, 1, 'la vista della base NON e intatta: il timeframe salvato passa da 5 a 1');
    assert.equal(m.indicatoriEreditati, 1, 'al primo ingresso gli indicatori sono ereditati (copia)');
    assert.equal(m.indicatoriChiave, 'vp_daily', 'l indicatore ereditato Ã¨ lo stesso');
    assert.equal(m.strategies, 1, 'le strategie di trade non vengono toccate');
    assert.equal(m.sessionPfEsiste, true, 'la sessione Prop Firm esiste');
    assert.equal(m.sessionPfDisegni, 3, 'la sessione Prop Firm parte con i 3 disegni della base');
    // --- P13: la cura "Prop Firm sessione unica" (10 novembre 2026) ---
    // pfSourceDrawings e' dichiarata con let (dichiarata con let): non compare tra le proprieta' di window, quindi
    // il controllo 'pfSourceDrawings' in window non dice nulla. Cio' che conta e' che attivare
    // la Prop Firm non sollevi piu' il ReferenceError e i disegni arrivino (assicurato sopra).
    assert.deepEqual(errori, [], 'nessun errore di pagina: il codice morto non solleva nulla');
  } finally { await browser.close(); }
});

test('P13, se lo si alimenta a mano, esplode su "key is not defined"', async () => {
  const {browser, pagina} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      var C=${JSON.stringify(candele(300))};
      ${prepara(candele(300))}
      // Riscritto (10 novembre 2026): prima questo banco chiamava SOLO proceedEnablePropFirm e poi
      // dava da mangiare a window.pfSourceDrawings - che con let (dichiarata con let) non e' la variabile del modulo,
      // quindi non misurava niente. La cura vera e': proceedEnablePropFirm fotografa, poi
      // startNewPropFirmChallenge crea la Challenge e rimette i disegni.
      var errore=null;
      try{
        await proceedEnablePropFirm(false);
        await startNewPropFirmChallenge(10000);
      }catch(e){ errore=String(e).slice(0,160); }
      return {errore:errore,
              pfSorgenteCopiata:((assetDrawings['backtest_propfirm']||{})['XAUUSD'])||null,
              disegni:drawings.length};
    })()`);
    assert.ok(!r.errore || !/key is not defined/.test(r.errore),
      'il frammento P13 non deve piu\' esplodere su key (curato 10/11/2026): ' + r.errore);
    assert.ok(!r.errore, 'attivare la Prop Firm non deve sollevare errori: ' + r.errore);
    assert.equal(Array.isArray(r.pfSorgenteCopiata)?r.pfSorgenteCopiata.length:-1, 3, 'i disegni della base devono essere copiati nella sessione Prop Firm');
    assert.equal(r.disegni, 3, 'i 3 disegni della base devono essere a grafico nella sessione Prop Firm');
  } finally { await browser.close(); }
});

test('riselezionando lo stesso asset in Prop Firm: disegni e zoom tornano, il timeframe no (residuo noto)', async () => {
  const {browser, pagina} = await apriApp();
  try{
    const v = await pagina.evaluate(`(async function(){
      var C=${JSON.stringify(candele(300))};
      ${prepara(candele(300))}
      try{ await proceedEnablePropFirm(false); }catch(e){}
      await startNewPropFirmChallenge(10000);
      // riselezione dell'asset: rebuild della vista + ricarica dei disegni da
      // assetDrawings[sessione][asset], esattamente ciÃ² che fa autoLoadAssetLibrary
      rows=C; baseRows=C; idx=C.length-1;
      applyChartViewForAsset('XAUUSD');
      var ricaricati=((assetDrawings[currentMode()]||{})['XAUUSD'])||[];
      return {disegniRicarichi:ricaricati.length, tf:currentTF, visibili:visibleCount,
              baseTf:assetChartViews['backtest']['XAUUSD'].currentTF,
              baseVisibili:assetChartViews['backtest']['XAUUSD'].visibleCount};
    })()`);
    assert.equal(v.disegniRicarichi, 3, 'in Prop Firm i disegni ricaricati per XAUUSD devono essere 3 (sessione unica)');
    assert.equal(v.tf, 1, 'RESIDUO NOTO (10/11/2026): il timeframe in Prop Firm riparte da 1 - da curare; disegni e zoom invece tornano');
    assert.equal(v.visibili, v.baseVisibili, 'lo zoom (candele visibili) deve essere quello della base (' + v.baseVisibili + ')');
  } finally { await browser.close(); }
});

test('disattivando la Prop Firm la base torna intatta: il buco Ã¨ in entrata, non in uscita', async () => {
  const {browser, pagina} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      var C=${JSON.stringify(candele(300))};
      ${prepara(candele(300))}
      try{ await proceedEnablePropFirm(false); }catch(e){}
      await startNewPropFirmChallenge(10000);
      await disablePropFirmMode();
      rows=C; baseRows=C; idx=C.length-1;
      applyChartViewForAsset('XAUUSD');
      var ricaricati=((assetDrawings[currentMode()]||{})['XAUUSD'])||[];
      return {modo:currentMode(), disegniRicarichi:ricaricati.length, tf:currentTF,
              visibili:visibleCount, baseVisibili:assetChartViews['backtest']['XAUUSD'].visibleCount,
              indicatori:activeIndicators.length};
    })()`);
    assert.equal(r.modo, 'backtest', 'tornati in Storico');
    assert.equal(r.disegniRicarichi, 3, 'tornando in Storico i 3 disegni ricompaiono');
    assert.equal(r.tf, 1, 'anche il timeframe della base NON torna (5 -> 1): la sessione base e stata alterata');
    assert.equal(r.visibili, r.baseVisibili, 'lo zoom della base torna');
    assert.equal(r.indicatori, 1, 'gli indicatori tornano');
  } finally { await browser.close(); }
});
