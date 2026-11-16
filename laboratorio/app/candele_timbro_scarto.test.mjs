// TIMBRO DELLO SCARTO ORARIO SULLE CANDELE SALVATE (15 novembre 2026).
//
// MISURA IL COMPORTAMENTO, non il testo del sorgente: quante candele l'app CHIEDE al servizio
// dati (il numero nel `count`) e cosa finisce nello storico dopo la fusione col magazzino locale.
//
// La richiesta del proprietario, parole sue: «Non voglio che ricarica ogni volta l'intero storico,
// soltanto l'ultima parte aggiunta dopo l'ultima visualizzazione. Quindi si riallinea in automatico
// con quello che c'è e quello che manca.»
//
// Il difetto misurato: il ponte pubblica i tempi GIA' spostati sul fuso del broker e dichiara
// quale scarto ha applicato (`utc_offset_seconds_applied`). Il magazzino locale salvava i tempi
// senza registrare con che scarto erano stati calcolati, quindi una serie scaricata quando lo
// scarto era misurato male non combacia piu' con la coda nuova: nessun `time` in comune, ramo
// `else`, e via con lo SCARICO INTERO da 200000 candele — esattamente quello che il proprietario
// non vuole. Con la cura: la serie si sposta per somma (o si misura dalla sovrapposizione) e si
// chiede sempre e solo la coda.
//
// Le prove:
//  1. timbro uguale            -> solo la coda, nessun 200000;
//  2. timbro diverso           -> riallineamento per somma, count piccolo (la prova chiesta);
//  3. serie senza timbro, 7200 -> scostamento MISURATO dalla sovrapposizione, applicato e scritto;
//  4. serie senza timbro coerente -> nessuno spostamento, ma il timbro viene scritto;
//  5. PROVA DI CONTROLLO: serie con due orologi dentro -> scarico intero (il ripiego deve esistere)
//     e lo DEVE DIRE nella barra di stato, non tacere;
//  6. le date rigenerate restano ISO con la Z (una data senza fuso sposta ogni candela di 5 ore);
//  7. il giro VERO nel magazzino (IndexedDB): il timbro si salva e si rilegge, e un timbro
//     mancante torna null e non 0 (le altre prove sostituiscono il magazzino con un finto).
//
// SECONDA REVISIONE (punti rimasti aperti dalla prima):
//  8. riallineata e poi BUTTATA VIA: la riga `__riallineamentoSec=null` del ramo `else`. La prova
//     5 arrivava allo scarico intero senza aver mai riallineato niente, quindi passava anche
//     senza quella riga: questo e' il caso che la tocca davvero.
//  9. UN SOLO punto discordante su cinque (l'identita' di una candela sono quattro numeri, e due
//     candele diverse possono averli uguali) NON deve costare lo scarico intero: dominante >= 80%.
// 10. ponte vecchio che non dichiara piu' lo scarto + magazzino timbrato: il timbro scritto e'
//     `vecchio - misurato`. La formula era giusta ma nessuno la misurava.
// 11. un tempo NON FINITO nel magazzino: deve finire nello scarico intero, MAI in una coda corta
//     che sostituisce magazzino e grafico (il `catch` vuoto trasformava l'eccezione in coda).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// La forma che le date devono avere SEMPRE. Una data senza la Z viene riletta col fuso dei CSV
// (America/New_York) e sposta ogni candela di 5 ore: cura del 10 novembre, pagata cara.
const ISO_Z = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

// Definizioni iniettate DENTRO la pagina.
const DEFS = `
  function candeleDa(t0, n, base){
    base = base||4161; var out=[];
    for(var i=0;i<n;i++){ var p=base+i*0.01; out.push({time:t0+i*60, open:p, high:p+0.5, low:p-0.5, close:p, tick_volume:10}); }
    return out;
  }
  function righeCache(serie, sec){
    sec = sec||0;
    return serie.map(function(c){
      var t=c.time+sec;
      return {time:t, date:new Date(t*1000).toISOString(), open:c.open, high:c.high, low:c.low, close:c.close, volume:c.tick_volume};
    });
  }
`;

// fetch finto che CONTA i count richiesti (lo strumento giusto: e' il numero che il proprietario
// paga in secondi di attesa) e dichiara lo scarto orario applicato come fa il ponte vero.
//   scarto: '7200' | '0' | 'null' | 'ASSENTE' (ponte vecchio: il campo non c'e' proprio)
function istallaFetch(corpo, scarto){
  const campo = (scarto === 'ASSENTE') ? '' : ', utc_offset_seconds_applied:' + scarto;
  return `(function(){
    var reale = window.fetch;
    window.__count = [];
    window.fetch = function(url){
      var u=String(url);
      var m=u.match(/count=(\\d+)/);
      var count=m?Number(m[1]):null;
      if(count!=null) window.__count.push(count);
      var candles = (function(count){ ${corpo} })(count);
      return Promise.resolve({ok:true, status:200, json:function(){ return Promise.resolve({candles:candles, digits:2${campo}}); }});
    };
    return reale;
  })()`;
}

// Il registratore della scrittura nel magazzino: e' li' che il timbro deve finire, e senza cura
// non ci finisce affatto (la funzione aveva quattro parametri).
const SCRITTURA_FINTA = `
  window.__scritto = [];
  window.fblCandeleCacheScrivi = async function(a,t,rows,d,scarto){
    window.__scritto.push({quante:rows.length, digits:d, scarto:scarto, ultimo:rows[rows.length-1].time});
    return true;
  };
`;

// ============================================================================================
// 1. TIMBRO UGUALE: si chiede solo la coda, nessuno scarico intero.
// ============================================================================================
test('timbro uguale: chiede solo la coda e non rifa\' lo storico intero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      ${DEFS}
      mt5FeedSymbolForAsset['XAUUSD']='XAUUSD';
      var ora0 = Math.floor(Date.now()/1000/60)*60;
      window.__tutto = candeleDa(ora0-360*60, 361);          // 6 ore di M1, fino a ora0
      var cached = righeCache(window.__tutto.slice(296,356)); // ultime 60, ma 5 minuti fa
      var ultimo = cached[cached.length-1];
      window.fblCandeleCacheLeggi = async () => ({rows:cached, digits:2, ultimoTs:ultimo.time, salvatoAt:Date.now(), scarto:7200});
      ${SCRITTURA_FINTA}
      var reale = (${istallaFetch('return window.__tutto;', '7200')})();
      csvLibrary = []; currentAssetKey='XAUUSD'; liveModeActive=true;
      await loadLiveHistoryFromMt5('XAUUSD', {});
      window.fetch = reale;
      var f=csvLibrary[0]||{};
      return {counts:window.__count, righe:(f.rows||[]).length, scritto:window.__scritto};
    })()`);
    assert.ok(!r.counts.includes(200000), 'con il timbro uguale non deve MAI chiedere lo storico intero: '+JSON.stringify(r.counts));
    assert.ok(r.counts[0] < 200000, 'la prima richiesta e\' la coda');
    assert.equal(r.righe, 65, 'storico = 60 in locale + 5 nuove');
    assert.equal(r.scritto.length, 1);
    assert.equal(r.scritto[0].scarto, 7200, 'il timbro si riscrive uguale');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ============================================================================================
// 2. TIMBRO DIVERSO: riallineamento per somma, count piccolo. LA PROVA CHIESTA DAL PROPRIETARIO.
// ============================================================================================
test('timbro diverso: riallinea la serie per somma e chiede solo la coda', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      ${DEFS}
      mt5FeedSymbolForAsset['XAUUSD']='XAUUSD';
      var ora0 = Math.floor(Date.now()/1000/60)*60;
      window.__tutto = candeleDa(ora0-360*60, 361);
      // Serie salvata con scarto 0 (tempi del broker grezzi) mentre adesso il ponte dichiara
      // 7200: i tempi salvati sono 2 ore AVANTI rispetto a quelli giusti.
      var giuste = window.__tutto.slice(296,356);
      var cached = righeCache(giuste, +7200);
      var ultimo = cached[cached.length-1];
      window.fblCandeleCacheLeggi = async () => ({rows:cached, digits:2, ultimoTs:ultimo.time, salvatoAt:Date.now(), scarto:0});
      ${SCRITTURA_FINTA}
      var reale = (${istallaFetch('return window.__tutto;', '7200')})();
      csvLibrary = []; currentAssetKey='XAUUSD'; liveModeActive=true;
      await loadLiveHistoryFromMt5('XAUUSD', {});
      window.fetch = reale;
      var f=csvLibrary[0]||{};
      var righe=f.rows||[];
      return {counts:window.__count, righe:righe.length,
              primo:righe.length?righe[0].time:null, primoAtteso:giuste[0].time,
              ultimo:righe.length?righe[righe.length-1].time:null,
              scritto:window.__scritto,
              stato:document.getElementById('status').textContent,
              doppioni: righe.length - new Set(righe.map(x=>x.time)).size};
    })()`);
    assert.ok(!r.counts.includes(200000), 'il timbro diverso NON deve portare allo scarico intero: '+JSON.stringify(r.counts));
    assert.ok(r.counts[0] < 200000, 'la richiesta resta la coda');
    assert.equal(r.righe, 65, 'storico = 60 in locale riallineate + 5 nuove');
    assert.equal(r.primo, r.primoAtteso, 'la testa dello storico e\' quella di prima, solo spostata');
    assert.equal(r.doppioni, 0, 'nessun doppione');
    assert.equal(r.scritto.length, 1);
    assert.equal(r.scritto[0].scarto, 7200, 'il timbro nuovo si scrive nel magazzino');
    assert.match(r.stato, /riallineata/, 'il riallineamento va DETTO nella barra di stato');
    assert.match(r.stato, /-7200 s/, 'e va detto di quanto, in secondi');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ============================================================================================
// 3. SERIE SENZA TIMBRO: lo scostamento si MISURA dalla sovrapposizione (3+ punti), si applica
//    e il timbro si scrive.
// ============================================================================================
test('serie senza timbro: misura lo scostamento dalla sovrapposizione e lo applica', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      ${DEFS}
      mt5FeedSymbolForAsset['XAUUSD']='XAUUSD';
      var ora0 = Math.floor(Date.now()/1000/60)*60;
      window.__tutto = candeleDa(ora0-360*60, 361);
      // Nessuno dice con che scarto e' stata salvata (serie gia' in casa): 7200 s indietro.
      var giuste = window.__tutto.slice(296,356);
      var cached = righeCache(giuste, -7200);
      var ultimo = cached[cached.length-1];
      window.fblCandeleCacheLeggi = async () => ({rows:cached, digits:2, ultimoTs:ultimo.time, salvatoAt:Date.now()});
      ${SCRITTURA_FINTA}
      var reale = (${istallaFetch('return window.__tutto;', '0')})();
      csvLibrary = []; currentAssetKey='XAUUSD'; liveModeActive=true;
      await loadLiveHistoryFromMt5('XAUUSD', {});
      window.fetch = reale;
      var f=csvLibrary[0]||{};
      var righe=f.rows||[];
      return {counts:window.__count, righe:righe.length,
              primo:righe.length?righe[0].time:null, primoAtteso:giuste[0].time,
              scritto:window.__scritto,
              stato:document.getElementById('status').textContent,
              date:righe.every(function(x){ return ${ISO_Z.toString()}.test(x.date); }),
              coerenti:righe.every(function(x){ return Date.parse(x.date)/1000 === x.time; })};
    })()`);
    assert.ok(!r.counts.includes(200000), 'misurare non costa nessuna richiesta in piu\': '+JSON.stringify(r.counts));
    assert.equal(r.righe, 65, 'storico = 60 riallineate + 5 nuove');
    assert.equal(r.primo, r.primoAtteso, 'lo scostamento misurato (+7200) e\' stato applicato');
    assert.equal(r.scritto.length, 1);
    assert.equal(r.scritto[0].scarto, 0, 'il timbro si scrive: scarto dichiarato adesso = 0');
    assert.match(r.stato, /riallineata/);
    assert.match(r.stato, /\+7200 s/);
    assert.ok(r.date, 'le date rigenerate restano ISO con la Z');
    assert.ok(r.coerenti, 'date e time dicono lo stesso istante');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ============================================================================================
// 4. SERIE SENZA TIMBRO E GIA' COERENTE: nessuno spostamento, solo il timbro.
//    (Guardia contro la cura che sposta troppo: una serie gia' giusta deve restare ferma.)
// ============================================================================================
test('serie senza timbro e coerente: non sposta niente, scrive il timbro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      ${DEFS}
      mt5FeedSymbolForAsset['XAUUSD']='XAUUSD';
      var ora0 = Math.floor(Date.now()/1000/60)*60;
      window.__tutto = candeleDa(ora0-360*60, 361);
      var cached = righeCache(window.__tutto.slice(296,356));
      var ultimo = cached[cached.length-1];
      window.fblCandeleCacheLeggi = async () => ({rows:cached, digits:2, ultimoTs:ultimo.time, salvatoAt:Date.now()});
      ${SCRITTURA_FINTA}
      var reale = (${istallaFetch('return window.__tutto;', '0')})();
      csvLibrary = []; currentAssetKey='XAUUSD'; liveModeActive=true;
      await loadLiveHistoryFromMt5('XAUUSD', {});
      window.fetch = reale;
      var f=csvLibrary[0]||{};
      var righe=f.rows||[];
      return {counts:window.__count, righe:righe.length,
              primo:righe.length?righe[0].time:null, primoAtteso:cached[0].time,
              scritto:window.__scritto,
              stato:document.getElementById('status').textContent};
    })()`);
    assert.ok(!r.counts.includes(200000), 'coerente = solo la coda: '+JSON.stringify(r.counts));
    assert.equal(r.righe, 65);
    assert.equal(r.primo, r.primoAtteso, 'una serie gia\' allineata non si sposta di un secondo');
    assert.equal(r.scritto.length, 1);
    assert.equal(r.scritto[0].scarto, 0, 'il timbro si scrive anche quando e\' 0 (0 e\' un valore, non un\'assenza)');
    assert.doesNotMatch(r.stato, /riallineata/, 'niente da riallineare: non si dice niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ============================================================================================
// 5. PROVA DI CONTROLLO: la serie ha DUE orologi dentro (meta' e meta'). Nessuna somma la
//    raddrizza: si rifa' lo scarico intero, come prima. Il ripiego deve esistere, altrimenti la
//    cura mostrerebbe una coda corta come se fosse tutto lo storico (il pericolo opposto).
//    E il ripiego lo DEVE DIRE: quanti punti discordavano. Un ripiego silenzioso e'
//    indistinguibile da un difetto - e' cosi' che e' nata questa cura.
// ============================================================================================
test('prova di controllo: sovrapposizione con punti discordanti -> scarico intero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      ${DEFS}
      mt5FeedSymbolForAsset['XAUUSD']='XAUUSD';
      var ora0 = Math.floor(Date.now()/1000/60)*60;
      window.__tutto = candeleDa(ora0-360*60, 361);
      window.__pieno = candeleDa(ora0-500*60, 501);
      var giuste = window.__tutto.slice(296,356);
      // Meta' serie a un orologio, meta' a un altro: e' il caso gia' capitato (uno scarto di -57600).
      var cached = righeCache(giuste.slice(0,30), -7200).concat(righeCache(giuste.slice(30)));
      var ultimo = cached[cached.length-1];
      window.fblCandeleCacheLeggi = async () => ({rows:cached, digits:2, ultimoTs:ultimo.time, salvatoAt:Date.now()});
      ${SCRITTURA_FINTA}
      var reale = (${istallaFetch('return count>=200000 ? window.__pieno : window.__tutto;', '0')})();
      csvLibrary = []; currentAssetKey='XAUUSD'; liveModeActive=true;
      await loadLiveHistoryFromMt5('XAUUSD', {});
      window.fetch = reale;
      var f=csvLibrary[0]||{};
      return {counts:window.__count, righe:(f.rows||[]).length, scritto:window.__scritto,
              stato:document.getElementById('status').textContent};
    })()`);
    assert.equal(r.counts[0] < 200000, true, 'la prima richiesta e\' la coda');
    assert.ok(r.counts.includes(200000), 'con due orologi dentro si rifa\' lo scarico intero: '+JSON.stringify(r.counts));
    assert.equal(r.righe, 501, 'lo storico finale e\' quello intero, non una coda');
    assert.equal(r.scritto[0].quante, 501, 'nel magazzino finisce la serie intera, non la coda');
    assert.doesNotMatch(r.stato, /riallineata/, 'non si dichiara un riallineamento che non c\'e\' stato');
    assert.match(r.stato, /30 candele su 60/, 'il ripiego dice QUANTI punti discordavano: '+r.stato);
    assert.match(r.stato, /orari diversi dal broker/, 'e dice perche\': '+r.stato);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ============================================================================================
// 7. IL GIRO VERO NEL MAGAZZINO: scrittura e rilettura del timbro su IndexedDB, e il campo
//    MANCANTE che non deve diventare zero (Number(null) fa 0 ed e' finito: LEZIONI, quarta volta).
//    Le prove sopra sostituiscono il magazzino con un finto: senza questa, un errore nel record
//    salvato (o nella sua rilettura) non lo vedrebbe nessuno.
// ============================================================================================
test('magazzino vero: il timbro si salva, si rilegge, e se manca e\' null non 0', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      var rows=[]; var t0=1763200000;
      for(var i=0;i<5;i++){ rows.push({time:t0+i*60, date:new Date((t0+i*60)*1000).toISOString(), open:1+i, high:1.5+i, low:0.5+i, close:1.2+i, volume:10}); }
      await fblCandeleCacheScrivi('PROVA', 1, rows, 2, 7200);
      var con = await fblCandeleCacheLeggi('PROVA', 1);
      await fblCandeleCacheScrivi('PROVA2', 1, rows, 2);   // ponte vecchio: nessun timbro
      var senza = await fblCandeleCacheLeggi('PROVA2', 1);
      await fblCandeleCacheScrivi('PROVA3', 1, rows, 2, 0); // zero e' un timbro, non un'assenza
      var zero = await fblCandeleCacheLeggi('PROVA3', 1);
      return {conScarto:con?con.scarto:'non letto', senzaScarto:senza?String(senza.scarto):'non letto',
              zeroScarto:zero?zero.scarto:'non letto', righe:con?con.rows.length:0,
              dateOk:con?con.rows.every(function(x){ return /^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d\\.\\d{3}Z$/.test(x.date); }):false};
    })()`);
    assert.equal(r.conScarto, 7200, 'il timbro scritto si rilegge uguale');
    assert.equal(r.senzaScarto, 'null', 'timbro assente = null, mai 0 (0 farebbe spostare la serie di tutto lo scarto)');
    assert.equal(r.zeroScarto, 0, 'zero e\' un timbro vero (broker in UTC) e resta zero');
    assert.equal(r.righe, 5);
    assert.ok(r.dateOk, 'le date rilette dal magazzino restano ISO con la Z');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ============================================================================================
// 6. LE DATE RIGENERATE: ISO con la Z, su tutta la serie (non solo sulla coda nuova).
// + 7. il giro vero nel magazzino (sopra), che le altre prove sostituiscono con un finto.
// ============================================================================================
test('le date rigenerate sono ISO con la Z su tutta la serie riallineata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      ${DEFS}
      mt5FeedSymbolForAsset['XAUUSD']='XAUUSD';
      var ora0 = Math.floor(Date.now()/1000/60)*60;
      window.__tutto = candeleDa(ora0-360*60, 361);
      var giuste = window.__tutto.slice(296,356);
      var cached = righeCache(giuste, +7200);
      var ultimo = cached[cached.length-1];
      window.fblCandeleCacheLeggi = async () => ({rows:cached, digits:2, ultimoTs:ultimo.time, salvatoAt:Date.now(), scarto:0});
      ${SCRITTURA_FINTA}
      var reale = (${istallaFetch('return window.__tutto;', '7200')})();
      csvLibrary = []; currentAssetKey='XAUUSD'; liveModeActive=true;
      await loadLiveHistoryFromMt5('XAUUSD', {});
      window.fetch = reale;
      var f=csvLibrary[0]||{};
      var righe=f.rows||[];
      var re=/^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d\\.\\d{3}Z$/;
      return {righe:righe.length,
              senzaZ:righe.filter(function(x){ return !re.test(x.date); }).map(function(x){ return x.date; }),
              incoerenti:righe.filter(function(x){ return Date.parse(x.date)/1000 !== x.time; }).length,
              ordinate:righe.every(function(x,i){ return i===0 || righe[i-1].time < x.time; })};
    })()`);
    assert.deepEqual(r.senzaZ, [], 'nessuna data senza fuso: sposterebbe ogni candela di 5 ore');
    assert.equal(r.incoerenti, 0, 'data e time dicono lo stesso istante');
    assert.ok(r.ordinate, 'la serie resta in ordine di tempo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ============================================================================================
// 8. RIALLINEATA E POI BUTTATA VIA (revisione, punto 1).
//    Il ramo `else` (sovrapposizione che non torna) butta via il lavoro fatto sopra e rifa' lo
//    scarico intero: in quel caso la barra di stato NON deve dire «riallineata», perche' la serie
//    a schermo e' tutta nuova. La riga `__riallineamentoSec=null;` e' l'unica che lo garantisce.
//    La prova 5 NON la toccava: arrivava allo scarico intero senza aver mai riallineato niente,
//    quindi la sua asserzione passava anche con quella riga cancellata. Questo e' il caso che la
//    copre davvero: il timbro diverso sposta la serie (il lavoro viene fatto), e POI la
//    sovrapposizione butta via tutto.
// ============================================================================================
test('riallineata e poi buttata via: la barra di stato non dice riallineata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      ${DEFS}
      mt5FeedSymbolForAsset['XAUUSD']='XAUUSD';
      var ora0 = Math.floor(Date.now()/1000/60)*60;
      window.__tutto = candeleDa(ora0-360*60, 361);
      window.__pieno = candeleDa(ora0-500*60, 501);
      var giuste = window.__tutto.slice(296,356);
      // Serie salvata col timbro 7200 (tempi = broker - 7200) mentre il ponte adesso dichiara 0.
      var cached = righeCache(giuste, -7200);
      // L'ULTIMA candela salvata ha un prezzo diverso da quella del broker: la sovrapposizione
      // non torna e la serie appena spostata viene buttata via (scartata per intero).
      cached[59].close = cached[59].close + 1;
      var ultimo = cached[cached.length-1];
      window.fblCandeleCacheLeggi = async () => ({rows:cached, digits:2, ultimoTs:ultimo.time, salvatoAt:Date.now(), scarto:7200});
      ${SCRITTURA_FINTA}
      var reale = (${istallaFetch('return count>=200000 ? window.__pieno : window.__tutto;', '0')})();
      csvLibrary = []; currentAssetKey='XAUUSD'; liveModeActive=true;
      await loadLiveHistoryFromMt5('XAUUSD', {});
      window.fetch = reale;
      var f=csvLibrary[0]||{};
      return {counts:window.__count, righe:(f.rows||[]).length, scritto:window.__scritto,
              stato:document.getElementById('status').textContent};
    })()`);
    assert.equal(r.counts[0] < 200000, true, 'la prima richiesta e\' la coda');
    assert.ok(r.counts.includes(200000), 'la sovrapposizione con prezzi diversi rifa\' lo scarico intero: '+JSON.stringify(r.counts));
    assert.equal(r.righe, 501, 'lo storico finale e\' quello intero');
    assert.equal(r.scritto[0].quante, 501, 'nel magazzino finisce la serie intera, non la coda');
    assert.doesNotMatch(r.stato, /riallineata/, 'il riallineamento e\' stato buttato via: dirlo sarebbe una bugia');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ============================================================================================
// 9. UN SOLO PUNTO DISCORDANTE NON COSTA LO STORICO INTERO (revisione, punto 2).
//    LA MISURA: l'identita' di una candela sono QUATTRO numeri uguali (open|high|low|close). Su
//    uno strumento con pochi decimali DUE CANDELE DIVERSE possono avere gli stessi quattro valori
//    (barra piatta), quindi una candela salvata combacia con quella SBAGLIATA e produce un punto
//    con uno scostamento diverso dagli altri. Prima UN SOLO punto cosi' buttava via l'intera
//    misura e costringeva allo scarico intero da 200000: esattamente il sintomo del proprietario.
//    Adesso si accetta lo scostamento DOMINANTE, se copre almeno l'80% dei punti utili e almeno
//    3 punti. Qui 4 su 5 = l'80% esatto: la prova sta sul confine della regola.
// ============================================================================================
test('un punto discordante su cinque non butta via la serie', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      ${DEFS}
      mt5FeedSymbolForAsset['XAUUSD']='XAUUSD';
      var ora0 = Math.floor(Date.now()/1000/60)*60;
      window.__tutto = candeleDa(ora0-360*60, 361);
      var giuste = window.__tutto.slice(296,301);   // 5 candele salvate
      var cached = righeCache(giuste, -7200);       // scostamento misurato S = +7200
      // La candela salvata in mezzo porta per sbaglio l'OHLC della PRIMA della serie: combacia
      // con una candela del broker che non e' la sua, ed e' l'unico punto discordante.
      cached[2].open = giuste[0].open; cached[2].high = giuste[0].high;
      cached[2].low = giuste[0].low;  cached[2].close = giuste[0].close;
      var ultimo = cached[cached.length-1];
      window.fblCandeleCacheLeggi = async () => ({rows:cached, digits:2, ultimoTs:ultimo.time, salvatoAt:Date.now()});
      ${SCRITTURA_FINTA}
      var reale = (${istallaFetch('return window.__tutto;', '0')})();
      csvLibrary = []; currentAssetKey='XAUUSD'; liveModeActive=true;
      await loadLiveHistoryFromMt5('XAUUSD', {});
      window.fetch = reale;
      var f=csvLibrary[0]||{};
      var righe=f.rows||[];
      return {counts:window.__count, righe:righe.length,
              primo:righe.length?righe[0].time:null, primoAtteso:giuste[0].time,
              scritto:window.__scritto, stato:document.getElementById('status').textContent};
    })()`);
    assert.ok(!r.counts.includes(200000), 'un punto su cinque non deve costare lo storico intero: '+JSON.stringify(r.counts));
    assert.ok(r.counts[0] < 200000, 'la richiesta resta la coda');
    assert.equal(r.righe, 65, 'storico = 5 riallineate + 60 nuove');
    assert.equal(r.primo, r.primoAtteso, 'lo scostamento dominante (+7200) viene applicato lo stesso');
    assert.equal(r.scritto.length, 1);
    assert.equal(r.scritto[0].scarto, 0, 'il timbro del ponte si riscrive');
    assert.match(r.stato, /riallineata/, 'il riallineamento lo si dice');
    assert.match(r.stato, /\+7200 s/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ============================================================================================
// 10. PONTE VECCHIO SENZA SCARTO + MAGAZZINO TIMBRATO (revisione, punto 5).
//     Il ponte non dichiara piu' `utc_offset_seconds_applied`, ma la serie salvata porta il suo
//     timbro: lo scarto giusto si ricava dalla misura (scarto_nuovo = timbro_vecchio -
//     scostamento). La formula e' una differenza perche' il tempo pubblicato e'
//     `tempo_broker - scarto`: invertendo il segno il banco resterebbe verde (i tempi tornano
//     comunque) e il magazzino si riempirebbe di un timbro sbagliato di 2 volte lo scostamento,
//     cioe' la prossima riapertura risposterebbe la serie dall'orologio sbagliato. Qui
//     timbro=7200, scostamento misurato +7200: il timbro scritto deve essere 0.
// ============================================================================================
test('ponte senza scarto: il timbro scritto e\' vecchio - misurato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      ${DEFS}
      mt5FeedSymbolForAsset['XAUUSD']='XAUUSD';
      var ora0 = Math.floor(Date.now()/1000/60)*60;
      window.__tutto = candeleDa(ora0-360*60, 361);
      var giuste = window.__tutto.slice(296,356);
      var cached = righeCache(giuste, -7200);       // scostamento misurato S = +7200
      var ultimo = cached[cached.length-1];
      window.fblCandeleCacheLeggi = async () => ({rows:cached, digits:2, ultimoTs:ultimo.time, salvatoAt:Date.now(), scarto:7200});
      ${SCRITTURA_FINTA}
      var reale = (${istallaFetch('return window.__tutto;', 'ASSENTE')})();   // ponte vecchio: campo assente
      csvLibrary = []; currentAssetKey='XAUUSD'; liveModeActive=true;
      await loadLiveHistoryFromMt5('XAUUSD', {});
      window.fetch = reale;
      var f=csvLibrary[0]||{};
      var righe=f.rows||[];
      return {counts:window.__count, righe:righe.length,
              primo:righe.length?righe[0].time:null, primoAtteso:giuste[0].time,
              scritto:window.__scritto, stato:document.getElementById('status').textContent};
    })()`);
    assert.ok(!r.counts.includes(200000), 'la misura non costa nessuna richiesta in piu\': '+JSON.stringify(r.counts));
    assert.equal(r.righe, 65, 'storico = 60 riallineate + 5 nuove');
    assert.equal(r.primo, r.primoAtteso, 'lo scostamento misurato (+7200) e\' stato applicato');
    assert.equal(r.scritto.length, 1);
    // 7200 (timbro salvato) - 7200 (scostamento misurato) = 0. Col segno invertito farebbe 14400.
    assert.equal(r.scritto[0].scarto, 0, 'il timbro scritto e\' vecchio - misurato, non la somma: '+r.scritto[0].scarto);
    assert.match(r.stato, /riallineata/);
    assert.match(r.stato, /\+7200 s/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ============================================================================================
// 11. UN TEMPO NON FINITO NEL MAGAZZINO (revisione, punto 4).
//     `__fblSpostaSerie` chiama `new Date(t*1000).toISOString()`, che SOLLLEVA su un tempo non
//     finito. Se solleva a mezzo ciclo la serie resta mezza spostata, l'eccezione finiva nel
//     `catch` VUOTO, `mt5Rows` restava la CODA corta appena scaricata (~200 candele) e quella
//     coda sostituiva magazzino e grafico: una coda corta mostrata come se fosse tutto lo
//     storico, cioe' il rovescio esatto di questa cura. Ora: niente spostamento a meta', e
//     l'insuccesso porta allo scarico intero.
// ============================================================================================
test('tempo non finito nel magazzino: scarico intero, mai una coda corta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      ${DEFS}
      mt5FeedSymbolForAsset['XAUUSD']='XAUUSD';
      var ora0 = Math.floor(Date.now()/1000/60)*60;
      window.__tutto = candeleDa(ora0-360*60, 361);
      window.__pieno = candeleDa(ora0-500*60, 501);
      var giuste = window.__tutto.slice(296,302);
      var cached = righeCache(giuste, -7200);
      // Una candela con un tempo non finito (Float64Array in IndexedDB puo' contenere Infinity):
      // la lasciamo IN MEZZO, cosi' la prova misura anche che non si scrive mezzo risultato.
      // I prezzi li rendo irriconoscibili (non combaciano con nessuna candela del broker), cosi'
      // la MISURA resta pulita e l'insuccesso puo' arrivare solo dallo spostamento: se no la
      // prova sarebbe rossa per il motivo sbagliato e non misurerebbe quest'eccezione.
      cached[3].time = Infinity;
      cached[3].open = 99999; cached[3].high = 99999; cached[3].low = 99999; cached[3].close = 99999;
      var ultimo = cached[cached.length-1];
      window.fblCandeleCacheLeggi = async () => ({rows:cached, digits:2, ultimoTs:ultimo.time, salvatoAt:Date.now()});
      ${SCRITTURA_FINTA}
      var reale = (${istallaFetch('return count>=200000 ? window.__pieno : window.__tutto;', '0')})();
      csvLibrary = []; currentAssetKey='XAUUSD'; liveModeActive=true;
      await loadLiveHistoryFromMt5('XAUUSD', {});
      window.fetch = reale;
      var f=csvLibrary[0]||{};
      return {counts:window.__count, righe:(f.rows||[]).length, scritto:window.__scritto,
              stato:document.getElementById('status').textContent};
    })()`);
    assert.equal(r.counts[0] < 200000, true, 'la prima richiesta e\' la coda');
    assert.ok(r.counts.includes(200000), 'una serie illeggibile rifa\' lo scarico intero: '+JSON.stringify(r.counts));
    assert.equal(r.righe, 501, 'lo storico finale e\' quello intero');
    assert.equal(r.scritto[0].quante, 501, 'nel magazzino finisce la serie intera, MAI la coda di '+361);
    assert.doesNotMatch(r.stato, /riallineata/, 'una serie spostata a meta\' non si dichiara riallineata');
    assert.match(r.stato, /buttata via/, 'l\'insuccesso lo si dice: '+r.stato);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
