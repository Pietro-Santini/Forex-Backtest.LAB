// IL PULSANTE «ESPLODI ETICHETTE» E IL TOCCO SULL'ETICHETTA TP/SL.
//
// RICHIESTO ESPLICITAMENTE (23 ottobre 2026): «inseriamo un pulsante che ci esplode tutte le
// etichette e facciamo anche in modo che possiamo selezionare una posizione anche toccando
// l'etichetta tp-sl-stop profit».
//
// IL DIFETTO: il raggruppamento delle caselle coincidenti (vedi etichette_raggruppate.test.mjs)
// era una strada sola: le etichette raggruppate SI, ma nessun modo di rivedere ognuna da sola.
// E il tocco sulla casella TP/SL apriva le statistiche P&L/R:R senza selezionare la posizione,
// che si selezionava solo toccando la freccia di apertura (o il pulsante nella tabella).
//
// LA CURA: un invertitore «Esplodi etichette raggruppate» nella stessa sezione degli
// interruttori TP/SL (scelta ricordata per QUESTO dispositivo, come i suoi fratelli) che
// scompatta il gruppo: ogni posizione torna con la sua etichetta TP1/TP2/TP3 e i suoi soldi,
// niente «×N». E il tocco sull'etichetta — sia che l'etichetta sia di gruppo sia che sia
// scompattata — seleziona ANCHE la posizione, oltre ad aprire le statistiche di sempre.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const GRAFICO = () => {
  const t0 = Date.now() - 200*60000; let p = 4161; const R = [];
  for (let i=0;i<200;i++){ const o=p, c=p+Math.sin(i/7)*2;
    R.push({date:new Date(t0+i*60000).toISOString(), open:o, high:Math.max(o,c)+1, low:Math.min(o,c)-1, close:c, volume:10}); p=c; }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; currentAssetKey='XAUUSD';
  csvLibrary=[{id:'mt5_live_XAUUSD',name:'MT5 Live',addedAt:Date.now(),rows:R}];
  visibleCount=200;
  liveModeActive=false; mt5Connected=false;
};

// Il testo che finisce davvero a schermo: si aggancia fillText del contesto 2D REALE.
const CATTURA = () => {
  const c=document.getElementById('chart').getContext('2d');
  window.__pill=[];
  if(!c.__fillTextOriginale) c.__fillTextOriginale=c.fillText;
  c.fillText=function(t){ window.__pill.push(String(t)); return c.__fillTextOriginale.apply(this, arguments); };
};

// Tre posizioni dello stesso segnale di sala: la casella intera coincide, si raggruppano.
const GRUPPO = () => {
  const st=Date.parse(rows[100].date);
  const sala={tgSala:'PipHunter',tgGruppo:'g1',tgSegnaleId:'s1'};
  return [1,2,3].map(n=>Object.assign({
    id:'p'+n,side:'BUY',entry:4161,sl:4100,tp:4200,lots:0.1,asset:'XAUUSD',
    startTime:st,symbol:'XAUUSD'
  },sala,{tgTpIndice:n}));
};

// Lettura pulita: solo le etichette TP disegnate dopo l'ultimo giro (la cattura accumula
// anche i ridisegni fatti dentro il gestore del tasto o del tocco).
const pillTP = () => window.__pill.filter(t=>/^TP\d?:/.test(t)).join(' || ');

test('il pulsante «Esplodi etichette» scompatta il gruppo e lo ricompone', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      function pillTP(){ return window.__pill.filter(function(t){return /^TP\\d?:/.test(t);}).join(' || '); }
      try{ localStorage.removeItem('fbl_etichette_esplose'); }catch(e){}
      positions=(${GRUPPO})(); active=null; posSelezionata=null; previewTradeLevel=null;
      draw();
      var raggruppata=pillTP(); window.__pill.length=0;
      var b=document.getElementById('explodeTpSlEtichetteBtn');
      var esiste=!!b;
      b.click();
      var scompatta=pillTP(); window.__pill.length=0;
      b.click();
      var ricompone=pillTP(); window.__pill.length=0;
      return {esiste:esiste, raggruppata:raggruppata, scompatta:scompatta, ricompone:ricompone};
    })()`);
    assert.equal(r.esiste, true, 'il tasto «Esplodi etichette raggruppate» deve esistere sulla barra');
    // Default: il gruppo resta raggruppato (una sola etichetta, con «×N»), come prima.
    assert.ok(r.raggruppata.split('||').length===1,'comportamento di prima: UNA sola etichetta raggruppata, trovate: '+r.raggruppata);
    assert.ok(/×3/.test(r.raggruppata),'il gruppo di default resta raggruppato con il numero di posizioni: '+r.raggruppata);
    // Premuto: il gruppo si scompatta — tre etichette numerate, ognuna con i suoi soldi.
    assert.ok(r.scompatta.split('||').length===3,'esplodendo tornano tre etichette distinte, trovate: '+r.scompatta);
    assert.ok(/TP1:/.test(r.scompatta)&&/TP2:/.test(r.scompatta)&&/TP3:/.test(r.scompatta),'le etichette numerate tornano da sole: '+r.scompatta);
    assert.ok(!/×/.test(r.scompatta),'scompattato non deve restare nessun «×N»: '+r.scompatta);
    // Ripremuto: il gruppo torna com'era, una sola etichetta con «×N».
    assert.ok(r.ricompone.split('||').length===1,'ripremuto il tasto il raggruppamento torna: '+r.ricompone);
    assert.ok(/×3/.test(r.ricompone),'ritornato insieme c\'è di nuovo il numero di posizioni: '+r.ricompone);
    assert.deepEqual(errori.filter(x=>!/PointerCapture/.test(x)), []);
  } finally { await browser.close(); }
});

test("toccare l'etichetta TP/SL seleziona la posizione e apre le statistiche", async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      function pillTP(){ return window.__pill.filter(function(t){return /^TP\\d?:/.test(t);}).join(' || '); }
      try{ localStorage.removeItem('fbl_etichette_esplose'); }catch(e){}
      positions=(${GRUPPO})(); active=null; posSelezionata=null; previewTradeLevel=null;
      draw();
      // L'ETICHETTA del gruppo (la pillola TP a destra della casella) è disegnata per il
      // RAPPRESENTANTE (la prima del gruppo): toccarla deve selezionare proprio quella.
      var eti=tpSlPillHitRects.filter(function(x){return x.ownerKey==='pos:p1';});
      if(!eti.length)return {errore:'nessuna etichetta disegnata'};
      var rc=chartEl.getBoundingClientRect();
      var opt={pointerId:31,pointerType:'touch',button:0,buttons:1,
               clientX:rc.left+(eti[0].x+eti[0].x+eti[0].w)/2,
               clientY:rc.top+(eti[0].y+eti[0].h/2),
               bubbles:true,cancelable:true};
      chartEl.dispatchEvent(new PointerEvent('pointerdown',opt));
      chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign({},opt,{buttons:0})));
      return {scelta:posSelezionata?posSelezionata.id:null, statistica:zoneStatsOpenKey};
    })()`);
    assert.ok(!r.errore,'la casella TP/SL del gruppo deve essere disegnata: '+r.errore);
    assert.equal(r.scelta,'p1',"il tocco sull'etichetta deve selezionare la posizione (il rappresentante), selezione: "+r.scelta);
    assert.equal(r.statistica,'pos:p1','e le statistiche P&L/R:R restano aperte sulla casella toccata: '+r.statistica);
    assert.deepEqual(errori.filter(x=>!/PointerCapture/.test(x)), []);
  } finally { await browser.close(); }
});

test('scompattando il gruppo, il tocco seleziona la posizione giusta (TP2)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      function pillTP(){ return window.__pill.filter(function(t){return /^TP\\d?:/.test(t);}).join(' || '); }
      try{ localStorage.removeItem('fbl_etichette_esplose'); }catch(e){}
      positions=(${GRUPPO})(); active=null; posSelezionata=null; previewTradeLevel=null;
      draw();
      document.getElementById('explodeTpSlEtichetteBtn').click();
      window.__pill.length=0; // la cattura accumula: parte pulita, conta solo l'ultima vista
      // Col gruppo scompattato ogni etichetta è sua: toccare quella di seconda posizione.
      var eti=tpSlPillHitRects.filter(function(x){return x.ownerKey==='pos:p2';});
      if(!eti.length)return {errore:'etichetta di p2 assente con il gruppo scompattato'};
      var rc=chartEl.getBoundingClientRect();
      var opt={pointerId:32,pointerType:'touch',button:0,buttons:1,
               clientX:rc.left+(eti[0].x+eti[0].x+eti[0].w)/2,
               clientY:rc.top+(eti[0].y+eti[0].h/2),
               bubbles:true,cancelable:true};
      chartEl.dispatchEvent(new PointerEvent('pointerdown',opt));
      chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign({},opt,{buttons:0})));
      return {scelta:posSelezionata?posSelezionata.id:null, statistica:zoneStatsOpenKey,
              pill:window.__pill.filter(function(t){return /^TP\\d?:/.test(t);})};
    })()`);
    assert.ok(!r.errore,"con l'etichette scompatte il tocco su TP2 deve trovare la casella: "+r.errore);
    assert.equal(r.scelta,'p2',"il tocco sull'etichetta di seconda posizione seleziona p2, non il rappresentante: "+r.scelta);
    assert.equal(r.statistica,'pos:p2','e le sue statistiche si aprono: '+r.statistica);
    assert.ok(r.pill.some(t=>/^TP2:/.test(t)),"l'etichetta TP2 resta disegnata dopo il tocco: "+(r.pill.join(' || ')));
    assert.ok(!r.pill.some(t=>/×/.test(t)),'dopo il tocco il gruppo non si ri-aggrega (niente «×N»): '+(r.pill.join(' || ')));
    assert.deepEqual(errori.filter(x=>!/PointerCapture/.test(x)), []);
  } finally { await browser.close(); }
});
