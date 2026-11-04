// SUL CLOUD SI MANDA SOLO QUELLO CHE È CAMBIATO.
//
// CHIESTO dal proprietario (4 novembre 2026): «quello che è stato scritto rimane archiviato nel
// dispositivo. Quello che deve scrivere è soltanto l'ultimo aggiornamento e non deve
// sovrascrivere, altrimenti è normale che scrive una marea di dati. Prende riferimento soltanto
// l'ultima scrittura, che è di qualche byte, non può essere kilobyte o addirittura megabyte.»
// E il conto che lo motiva, suo: «ieri su Firestore siamo arrivati a 250.000 letture e 122.000
// scritture. O sistemiamo qualcosa all'interno che non mi faccia pagare, o cambiamo sistema.»
//
// COM'ERA: una firma dell'INTERO pacchetto di sessione. Identico = non si scrive (quello
// funzionava già), ma se cambiava UNA cosa si rimandava TUTTO.
//
// MISURATO su una sessione realistica (8 posizioni, 4 ordini pendenti, disegni su 12 asset in 2
// sessioni, ultima candela vista per asset e per sessione): la fotografia intera pesa 52,4 KB, di
// cui 42 KB di soli `assetDrawings`. Chiudere una posizione faceva rimandare tutti i 52,4 KB.
//
// DUE LIVELLI, e il secondo serve: la firma per CAMPO basta per le posizioni (1,1 KB invece di
// 52,4), ma non per i disegni — `assetDrawings` è un campo solo con dentro tutti gli asset di
// tutte le sessioni, quindi il delta per campo avrebbe mandato ancora 42,9 KB. Per quello (e per
// `assetChartViews`) la firma scende di un livello: modalità e asset.
//
// LA PROVA CHE CONTA PIÙ DEL RISPARMIO è la quarta: quando una CHIAVE SPARISCE si riscrive tutto.
// La fusione non cancella, e un risparmio che ti fa ricomparire un disegno cancellato non è un
// risparmio.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Costruisce il pacchetto, poi applica una modifica e torna il confronto fra le due scritture.
// `modifica` è codice che gira DOPO la prima firma: è la cosa che l'utente fa.
const BANCO = (modifica) => `(function(){
  const t0=Date.now()-500*60000; const R=[];
  for(let i=0;i<500;i++){ const p=1.1+Math.sin(i/9)*0.002;
    R.push({date:new Date(t0+i*60000).toISOString(),open:p,high:p+0.0005,low:p-0.0005,close:p,volume:5}); }
  csvLibrary=[{name:'t',rows:R}]; rebuildBaseRowsFromLibrary();
  currentAssetKey='EURUSD'; rowsAssetKey='EURUSD'; liveModeActive=false;
  currentTF=1; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
  viewEnd=rows.length-1; idx=rows.length-1;
  positions.length=0; pendingOrders.length=0;
  for(let i=0;i<8;i++) positions.push({id:'p'+i,asset:'EURUSD',side:i%2?'SELL':'BUY',entry:1.1+i*1e-4,
    sl:1.095,tp:1.105,lots:0.1,start:400+i,startTime:parseDateTime(rows[400+i].date),openTF:1,createdAt:1});
  for(let i=0;i<4;i++) pendingOrders.push({id:'o'+i,asset:'EURUSD',side:'BUY',price:1.099,sl:1.095,tp:1.105,lots:0.1,createdAt:1});
  const assets=['EURUSD','GBPUSD','XAUUSD','USDJPY','NAS100','BTCUSD','AUDUSD','USDCAD','EURJPY','SP500','GER40','OIL'];
  assetDrawings={};
  ['storico','live'].forEach(function(m){ assetDrawings[m]={};
    assets.forEach(function(a){ const lista=[];
      for(let i=0;i<10;i++) lista.push({id:a+'-'+m+'-'+i,type:'trend',
        p1:{time:t0+i*60000,price:1.1+i*1e-4},p2:{time:t0+(i+30)*60000,price:1.102+i*1e-4},
        color:'#3ea6ff',width:2,dashed:false});
      assetDrawings[m][a]=lista; }); });
  drawings=assetDrawings.storico.EURUSD.slice();
  assetChartViews={};
  ['storico','live'].forEach(function(m){ assetChartViews[m]={};
    assets.forEach(function(a){ assetChartViews[m][a]={masterTime:masterTime,viewEnd:499,visibleCount:120}; }); });
  assetAutoMeta={}; assets.forEach(function(a){ assetAutoMeta[a]={decimals:5,pip:0.0001}; });
  favoriteAssets=assets.slice(0,6);

  const raccogli=function(){ const b=collectLightSessionState(); b.assetChartViews=assetChartViews;
    delete b.trades; delete b.footprintCells; return b; };
  const peso=function(v){ try{ return JSON.stringify(v).length; }catch(e){ return -1; } };

  const primo=raccogli();
  const firmeBase=fblCloudFirmeDi(primo);
  ${modifica}
  const secondo=raccogli();
  const scelta=fblCloudCampiCambiati(secondo, firmeBase);
  return {
    intero:scelta.intero, motivo:scelta.motivo,
    campi:Object.keys(scelta.parti||{}).sort(),
    byteDelta:scelta.intero?peso(secondo):peso(scelta.parti),
    byteIntero:peso(secondo),
    // per i disegni: quali modalita'/asset sono finiti nel delta
    disegniNelDelta:(scelta.parti&&scelta.parti.assetDrawings)
      ? Object.keys(scelta.parti.assetDrawings).map(function(m){
          return m+':'+Object.keys(scelta.parti.assetDrawings[m]).join('|'); }).sort()
      : null
  };
})()`;

test('senza una base da cui partire, la prima scrittura è intera', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      const p={version:9,savedAt:1,positions:[{id:'a'}]};
      const s=fblCloudCampiCambiati(p,null);
      return {intero:s.intero, campi:Object.keys(s.parti).sort()};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.intero, true, 'la prima volta il documento va scritto per intero');
  } finally { await browser.close(); }
});

test('chiudo una posizione: si manda solo quel campo, e pesa una frazione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(BANCO(`positions.pop();`));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.intero, false, 'non serve una scrittura intera per una posizione in meno');
    assert.deepEqual(r.campi, ['positions', 'savedAt', 'version'],
      'oltre a positions devono viaggiare solo version e savedAt, invece: ' + r.campi.join(', '));
    // Controllo del banco: se il pacchetto fosse vuoto, qualunque confronto sarebbe banale.
    assert.ok(r.byteIntero > 40000,
      'il banco non ha costruito una sessione realistica (' + r.byteIntero + ' byte)');
    assert.ok(r.byteDelta * 10 < r.byteIntero,
      'il delta deve pesare meno di un decimo dell\'intero: ' + r.byteDelta + ' contro ' + r.byteIntero);
  } finally { await browser.close(); }
});

test('sposto un disegno: si manda solo l\'asset toccato, non tutti i disegni', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(BANCO(`
      assetDrawings.storico.EURUSD[0].p2.price+=0.0007;
      drawings=assetDrawings.storico.EURUSD.slice();`));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.intero, false, 'non serve una scrittura intera per un disegno spostato');
    // Il pacchetto rispecchia i disegni correnti anche nella modalità A SCHERMO (qui
    // `backtest`, vedi mirrorCurrentDrawingsIntoAssetDrawings): due rami cambiano per davvero.
    // Quello che conta, ed è la richiesta, è che viaggi UN SOLO ASSET e non tutti e dodici.
    assert.ok(Array.isArray(r.disegniNelDelta) && r.disegniNelDelta.length > 0,
      'nel delta devono finirci dei disegni: ' + JSON.stringify(r.disegniNelDelta));
    r.disegniNelDelta.forEach(riga => assert.equal(riga.split(':')[1], 'EURUSD',
      "nel delta deve viaggiare solo l'asset toccato, invece: " + JSON.stringify(r.disegniNelDelta)));
    assert.ok(r.byteIntero > 40000,
      'il banco non ha costruito una sessione realistica (' + r.byteIntero + ' byte)');
    assert.ok(r.byteDelta * 4 < r.byteIntero,
      'il delta dei disegni deve pesare molto meno dell\'intero: ' + r.byteDelta + ' contro '
      + r.byteIntero + ' (col delta per CAMPO erano 42,9 KB su 52,4: quasi niente)');
  } finally { await browser.close(); }
});

// LA PROVA CHE CONTA PIÙ DEL RISPARMIO.
test('se cancello i disegni di un asset, si riscrive tutto: la fusione non cancella', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(BANCO(`delete assetDrawings.storico.GBPUSD;`));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.intero, true,
      'una chiave sparita richiede una scrittura intera, o il disegno cancellato tornerebbe');
    assert.ok(/chiave/.test(r.motivo), 'il motivo deve dirlo: "' + r.motivo + '"');
  } finally { await browser.close(); }
});

test('se sparisce un campo intero, si riscrive tutto', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      const a={version:1,savedAt:1,positions:[],favoriteAssets:['EURUSD']};
      const firme=fblCloudFirmeDi(a);
      const b={version:1,savedAt:2,positions:[]};
      const s=fblCloudCampiCambiati(b,firme);
      return {intero:s.intero, motivo:s.motivo};
    })()`);
    assert.equal(r.intero, true, 'un campo sparito non si cancella con la fusione');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: se non è cambiato niente non si manda niente. Senza questa, un delta che
// mandasse sempre tutti i campi passerebbe le prove qui sopra e non risparmierebbe un byte.
test('PROVA DI CONTROLLO: se non cambia niente, il delta è vuoto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(BANCO(``));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.intero, false, 'niente di cambiato non è una scrittura intera');
    assert.deepEqual(r.campi, [],
      'non c\'è niente da mandare, invece manderebbe: ' + r.campi.join(', '));
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: `savedAt` da solo non è una modifica. Cambia a ogni raccolta del pacchetto:
// se contasse, si riscriverebbe a ogni giro e il risparmio sarebbe zero.
test('PROVA DI CONTROLLO: il solo orario di salvataggio non fa scrivere niente', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      const a={version:1,savedAt:1000,positions:[{id:'x'}]};
      const firme=fblCloudFirmeDi(a);
      const b={version:1,savedAt:9999,positions:[{id:'x'}]};
      const s=fblCloudCampiCambiati(b,firme);
      return {campi:Object.keys(s.parti).sort(), intero:s.intero};
    })()`);
    assert.deepEqual(r.campi, [], 'il solo savedAt non deve far partire una scrittura');
  } finally { await browser.close(); }
});
