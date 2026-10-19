// AL CAMBIO ASSET NEL GRAFICO C'È UN SOLO ASSET. MAI DUE, MAI PER UN ISTANTE.
//
// SEGNALATO dal proprietario, con un esempio che spiega tutto: «quando c'è un asset sul grafico e
// faccio il cambio, non viene fuori quella che è la rotellina del caricamento del successivo asset.
// Quello che fa è far rimanere l'asset quello precedente, carica intanto al grafico quello nuovo. Il
// problema è che a un certo punto rimangono tutti e due i grafici [...] vedremo delle candele di un
// asset e delle candele di un altro. No, dobbiamo fare in modo che quando passa smette di
// visualizzare l'asset precedente e carica quello che l'utente ha selezionato successivamente. Mai far
// comparire due grafici, due asset nello stesso grafico, assolutamente. È un bug di visualizzazione e
// di caricamento più che altro, perché alla fine si blocca anche momentaneamente, è lento il
// sistema».
//
// E il CONSEGUENZA PEGGIORE, sempre nella stessa segnalazione: «se abbiamo per esempio un'operazione in
// buy su XAUUSD, dove il prezzo è di oltre 4000, vedremo che la posizione va in negativo sulla fascia
// di prezzo, per esempio, di AUDCAD, che ha un prezzo di 0,980». Perché è la STESSA cosa: le posizioni
// vengono disegnate con i prezzi di una scala e i dati del grafico sono dell'altra. Non è un difetto
// di disegno delle posizioni: è il grafico che contiene i dati di un asset che non è quello scelto.
//
// LA CAUSA (misurata). Il caricamento dello storico è asincrono: parte una richiesta per l'asset
// VECCHIO, l'utente cambia asset prima che torni la risposta, e quando la risposta vecchia arriva
// `__loadLiveHistoryFromMt5Body` scrive le sue candele dentro `csvLibrary` senza più chiedere se
// quell'asset è ancora quello a schermo. Le due risposte si rincorrono e il grafico mostra prima
// l'uno e poi l'altro. Il `guardianoCandeleMt5` (la candela singola) aveva già il controllo
// `asset!==currentAssetKey`; il caricamento dello storico NO.
//
// I test non guardano il sorgente: fanno partire davvero due caricamenti sovrapposti e guardano cosa
// resta nel grafico.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Dentro la pagina: due asset, il cambio, e un `fetch` finto che serve lo storico di ciascuno con
// tempi diversi — il primo asset risponde DOPO che l'utente ha già cambiato, che è esattamente la
// corsa che produce il difetto.
const SCENA = (lentoPrimo) => `(async function(){
  // Prezzi distinti per asset: XAUUSD intorno a 4161, AUDCAD intorno a 0,98. Se i due si
  // mescolassero, i numeri a schermo non potrebbero essere né gli uni né gli altri.
  function fakeHistory(simbolo){
    var base = (simbolo==='XAUUSD') ? 4161 : 0.98;
    var t0 = Date.now() - 60*60000, out = [];
    for (var i=0;i<60;i++){
      var p = base + i*base*0.0001;
      out.push({time:(t0+i*60000)/1000, open:p, high:p*1.0005, low:p*0.9995, close:p, tick_volume:10});
    }
    out.digits = (simbolo==='XAUUSD') ? 2 : 5;
    return out;
  }
  // Il simbolo MT5 è già risolto: niente rete, si va dritti allo storico.
  mt5FeedSymbolForAsset['XAUUSD'] = 'XAUUSD';
  mt5FeedSymbolForAsset['AUDCAD'] = 'AUDCAD';

  var richieste = [];
  var realeFetch = window.fetch;
  window.fetch = function(url){
    var u = String(url);
    var m = u.match(/symbol=([^&]+)/);
    var simbolo = m ? decodeURIComponent(m[1]) : '';
    var attesa = (simbolo==='XAUUSD' && ${lentoPrimo}) ? 700 : 30;
    richieste.push(simbolo);
    return new Promise(function(resolve){
      setTimeout(function(){
        resolve({ok:true, status:200, json:function(){
          return Promise.resolve({candles:fakeHistory(simbolo), digits:outDigits(simbolo)});
        }});
      }, attesa);
    });
  };
  function outDigits(s){ return s==='XAUUSD' ? 2 : 5; }

  liveModeActive = true;
  currentAssetKey = 'XAUUSD';

  // Parte il caricamento del PRIMO asset...
  var primo = loadLiveHistoryFromMt5('XAUUSD', {});
  // ...e nel frattempo l'utente sceglie l'altro. Nessuna attesa: il cambio è immediato.
  currentAssetKey = 'AUDCAD';
  // Il caricamento del secondo parte subito dopo, e risponde PRIMO (è più veloce).
  var secondo = loadLiveHistoryFromMt5('AUDCAD', {});
  await Promise.all([primo, secondo]);

  window.fetch = realeFetch;
  var file = csvLibrary[0] || {};
  var ultima = file.rows && file.rows[file.rows.length-1];
  return {
    assetScelto: currentAssetKey,
    idFile: file.id || null,
    nomeFile: file.name || null,
    richieste: richieste,
    ultimoPrezzo: ultima ? ultima.close : null,
    primoAsset: 'XAUUSD',
    secondoAsset: 'AUDCAD'
  };
})()`;

test('il cambio asset non lascia mai due grafici: la risposta vecchia viene scartata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    // LentoPrimo=true: è il caso reale, il caricamento del vecchio asset TORNA TARDI.
    const r = await pagina.evaluate(SCENA(true));
    assert.equal(r.assetScelto, 'AUDCAD', 'il banco deve essere sull\'asset nuovo');
    assert.notEqual(r.idFile, 'mt5_live_XAUUSD',
      'il grafico mostra ancora il caricamento dell\'asset PRECEDENTE: ' + r.idFile);
    assert.ok(r.idFile==null || String(r.idFile).indexOf('XAUUSD')<0,
      'il file a grafico appartiene ancora all\'asset precedente: ' + r.idFile);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il cambio asset non lascia le posizioni sull\'altra scala dei prezzi', async () => {
  // Il caso che il proprietario ha descritto: posizione BUY su XAUUSD (prezzo oltre 4000) che
  // finisce sulla fascia di AUDCAD (0,98). Non serve nemmeno aprire la posizione: basta che il
  // grafico contenga i dati di un asset diverso da quello scelto, perché il disegno delle posizioni
  // usa i prezzi del grafico. Qui si controlla proprio la radice: i dati a schermo sono quelli
  // dell'asset scelto, quindi le posizioni non possono essere fuori scala.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(SCENA(true));
    assert.equal(r.assetScelto, 'AUDCAD');
    // AUDCAD sta intorno a 0,98; XAUUSD intorno a 4161. I due numeri non si somigliano, quindi
    // questo controllo distingue davvero "grafico giusto" da "grafico sbagliato".
    assert.ok(r.ultimoPrezzo!=null && r.ultimoPrezzo<10,
      'a schermo ci sono prezzi di XAUUSD (' + r.ultimoPrezzo + ') mentre l\'asset scelto è AUDCAD');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il cambio asset non fa accumulare richieste: una per asset, non infinite', async () => {
  // Il proprietario ha detto anche che «alla fine si blocca anche momentaneamente, è lento il
  // sistema». Il loader già riusa la richiesta in volo per lo STESSO asset; qui si controlla che
  // chiedere due volte lo stesso asset non apra due scaricamenti.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      function fakeHistory(s){
        var base=(s==='XAUUSD')?4161:0.98, t0=Date.now()-60*60000, out=[];
        for(var i=0;i<60;i++){var p=base+i*base*0.0001;
          out.push({time:(t0+i*60000)/1000,open:p,high:p*1.0005,low:p*0.9995,close:p,tick_volume:10});}
        return out;
      }
      mt5FeedSymbolForAsset['XAUUSD']='XAUUSD';
      var conta=0;
      var realeFetch=window.fetch;
      window.fetch=function(url){
        var m=String(url).match(/symbol=([^&]+)/);
        var s=m?decodeURIComponent(m[1]):'';
        if(String(url).indexOf('/history')<0) return realeFetch.apply(window, arguments);
        conta++;
        return new Promise(function(resolve){ setTimeout(function(){
          resolve({ok:true,status:200,json:function(){
            return Promise.resolve({candles:fakeHistory(s),digits:2});}});
        },50); });
      };
      liveModeActive=true; currentAssetKey='XAUUSD';
      var a=loadLiveHistoryFromMt5('XAUUSD',{});
      var b=loadLiveHistoryFromMt5('XAUUSD',{});   // subito, stesso asset
      await Promise.all([a,b]);
      window.fetch=realeFetch;
      return {richiesteStorico:conta};
    })()`);
    assert.equal(r.richiesteStorico, 1,
      'due chiamate per lo stesso asset hanno aperto ' + r.richiesteStorico + ' scaricamenti invece di 1');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
