// RAGGRUPPAMENTO SEMPRE ATTIVO E CLICK SULL'ETICHETTA ×N.
//
// RICHIESTO ESPLICITAMENTE (23 ottobre 2026): «inseriamo un pulsante che ci esplode tutte le
// etichette e facciamo anche in modo che possiamo selezionare una posizione anche toccando
// l'etichetta tp-sl-stop profit».
//
// CAMBIATO dal proprietario (26 ottobre 2026): «e devono raggrupparsi nel grafico se nella stessa
// linea di prezzo ci sono più etichette. L'utente premerà l'etichetta, un'unica etichetta, dove
// all'interno verranno visualizzate il numero di posizioni ... e differenziarli i gruppi per sale
// segnali. Poi l'utente premerà quell'unica etichetta e quando la preme si espanderà ... E non deve
// stare il pulsante all'interno di style. ... se clicchiamo fuori nel grafico su un punto vuoto ...
// tornerà raggruppato in automatico.»
//
// QUINDI: niente più pulsante "Esplodi etichette" nelle impostazioni. Il raggruppamento è il
// comportamento di default e resta sempre; il gruppo si ESPANDE toccando la sua etichetta ×N e
// si RICOMPONE toccando un punto vuoto del grafico.
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

const pillTP = () => window.__pill.filter(t=>/^TP\d?:/.test(t)).join(' || ');

// Tocco finto su un hit rect (touch), come fa il test sul tocco dell'etichetta.
const toccaRect = (rect, chartEl) => {
  const rc=chartEl.getBoundingClientRect();
  const opt={pointerId:31,pointerType:'touch',button:0,buttons:1,
             clientX:rc.left+(rect.x+rect.w/2), clientY:rc.top+(rect.y+rect.h/2),
             bubbles:true,cancelable:true};
  chartEl.dispatchEvent(new PointerEvent('pointerdown',opt));
  chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign({},opt,{buttons:0})));
};
// Tocco finto su un PUNTO VUOTO del canvas (in alto, fuori da candele e caselle).
const toccaVuoto = (chartEl) => {
  const rc=chartEl.getBoundingClientRect();
  const opt={pointerId:41,pointerType:'touch',button:0,buttons:1,
             clientX:rc.left+30, clientY:rc.top+4, bubbles:true,cancelable:true};
  chartEl.dispatchEvent(new PointerEvent('pointerdown',opt));
  chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign({},opt,{buttons:0})));
};

test('raggruppato di default; il tocco sull\'etichetta ×N espande; il vuoto raggruppa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      function pillTP(){ return window.__pill.filter(function(t){return /^TP\\d?:/.test(t);}).join(' || '); }
      try{ localStorage.removeItem('fbl_etichette_esplose'); }catch(e){}
      expandedTpSlGroups=new Set();                // gruppo raggruppato: nessun espanso all'inizio
      positions=(${GRUPPO})(); active=null; posSelezionata=null; previewTradeLevel=null;
      var chartEl=document.getElementById('chart');
      draw();
      var raggruppata=pillTP(); window.__pill.length=0;
      // Il pulsante "Esplodi etichette" NON deve più esisterere nelle impostazioni.
      var pulsante=!!document.getElementById('explodeTpSlEtichetteBtn');
      // Tocco sull'etichetta del GRUPPO (la pillola con ×N).
      var hitGruppo=tpSlPillHitRects.filter(function(x){return String(x.ownerKey).indexOf('gruppo:')===0;});
      if(!hitGruppo.length)return {errore:'nessuna etichetta di gruppo disegnata', raggruppata:raggruppata};
      var rc=chartEl.getBoundingClientRect();
      var eti=hitGruppo[0];
      var opt={pointerId:31,pointerType:'touch',button:0,buttons:1,
               clientX:rc.left+(eti.x+eti.w/2), clientY:rc.top+(eti.y+eti.h/2),
               bubbles:true,cancelable:true};
      chartEl.dispatchEvent(new PointerEvent('pointerdown',opt));
      window.__pill.length=0;            // pulito: conta solo il disegno del rilascio
      chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign({},opt,{buttons:0})));
      var espansaConta=expandedTpSlGroups.size;
      window.__pill.length=0;            // e ridisegna pulito: lo stato ESPANSO, deterministico
      draw();
      var espansa=pillTP(); window.__pill.length=0;
      // Tocco sul VUOTO: il gruppo torna raggruppato.
      var ov={pointerId:42,pointerType:'touch',button:0,buttons:1,
              clientX:rc.left+30, clientY:rc.top+4, bubbles:true,cancelable:true};
      chartEl.dispatchEvent(new PointerEvent('pointerdown',ov));
      window.__pill.length=0;            // pulito: conta solo il disegno del tocco sul vuoto
      chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign({},ov,{buttons:0})));
      window.__pill.length=0;            // e ridisegna pulito: lo stato RAGGRUPPATO, deterministico
      draw();
      var ricomposta=pillTP(); window.__pill.length=0;
      return {pulsante:pulsante, raggruppata:raggruppata, espansa:espansa,
              espansaConta:espansaConta, ricomposta:ricomposta};
    })()`);
    assert.ok(!r.errore,'il gruppo deve avere la sua etichetta ×N: '+r.errore);
    assert.equal(r.pulsante, false, 'il pulsante "Esplodi etichette" non deve più esistere nelle impostazioni');
    // Default: raggruppato — UNA sola etichetta con «×3».
    assert.ok(r.raggruppata.split('||').length===1,'di default il gruppo è raggruppato: '+r.raggruppata);
    assert.ok(/×3/.test(r.raggruppata),'il numero di posizioni compare nell\'etichetta di gruppo: '+r.raggruppata);
    // Toccata l'etichetta ×N: si espande — tre etichette numerate, niente ×N.
    assert.equal(r.espansaConta, 1, 'toccando l\'etichetta il gruppo è marcato espanso: '+r.espansaConta);
    assert.ok(r.espansa.split('||').length===3,'esplodendo tornano tre etichette distinte: '+r.espansa);
    assert.ok(/TP1:/.test(r.espansa)&&/TP2:/.test(r.espansa)&&/TP3:/.test(r.espansa),'le etichette numerate tornano da sole: '+r.espansa);
    assert.ok(!/×/.test(r.espansa),'espanso non deve restare nessun «×N»: '+r.espansa);
    // Toccato il vuoto: torna raggruppato — UNA sola etichetta con «×3».
    assert.ok(r.ricomposta.split('||').length===1,'toccando il vuoto il raggruppamento torna: '+r.ricomposta);
    assert.ok(/×3/.test(r.ricomposta),'ritornato insieme c\'è di nuovo il numero di posizioni: '+r.ricomposta);
    assert.deepEqual(errori.filter(x=>!/PointerCapture/.test(x)), []);
  } finally { await browser.close(); }
});

test('col gruppo espanso, il tocco sull\'etichetta seleziona la posizione giusta (TP2)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      function pillTP(){ return window.__pill.filter(function(t){return /^TP\\d?:/.test(t);}).join(' || '); }
      positions=(${GRUPPO})(); active=null; posSelezionata=null; previewTradeLevel=null;
      var chartEl=document.getElementById('chart');
      draw();
      // ESPANSIONE toccando l'etichetta del gruppo (×N), non col pulsante.
      var hitGruppo=tpSlPillHitRects.filter(function(x){return String(x.ownerKey).indexOf('gruppo:')===0;});
      if(!hitGruppo.length)return {errore:'nessuna etichetta di gruppo'};
      var rc=chartEl.getBoundingClientRect();
      var eti=hitGruppo[0];
      var opt={pointerId:31,pointerType:'touch',button:0,buttons:1,
               clientX:rc.left+(eti.x+eti.w/2), clientY:rc.top+(eti.y+eti.h/2),
               bubbles:true,cancelable:true};
      chartEl.dispatchEvent(new PointerEvent('pointerdown',opt));
      chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign({},opt,{buttons:0})));
      window.__pill.length=0; // la cattura accumula: parte pulita, conta solo l'ultima vista
      // Col gruppo espanso ogni etichetta è sua: toccare quella di seconda posizione.
      var eti2=tpSlPillHitRects.filter(function(x){return x.ownerKey==='pos:p2';});
      if(!eti2.length)return {errore:'etichetta di p2 assente col gruppo espanso'};
      toccaEt2:
      var opt2={pointerId:32,pointerType:'touch',button:0,buttons:1,
                clientX:rc.left+(eti2[0].x+eti2[0].w/2), clientY:rc.top+(eti2[0].y+eti2[0].h/2),
                bubbles:true,cancelable:true};
      chartEl.dispatchEvent(new PointerEvent('pointerdown',opt2));
      chartEl.dispatchEvent(new PointerEvent('pointerup',Object.assign({},opt2,{buttons:0})));
      return {scelta:posSelezionata?posSelezionata.id:null, statistica:zoneStatsOpenKey,
              pill:window.__pill.filter(function(t){return /^TP\\d?:/.test(t);})};
    })()`);
    assert.ok(!r.errore,"col gruppo espanso il tocco su TP2 deve trovare la casella: "+r.errore);
    assert.equal(r.scelta,'p2',"il tocco sull'etichetta di seconda posizione seleziona p2: "+r.scelta);
    assert.equal(r.statistica,'pos:p2','e le sue statistiche si aprono: '+r.statistica);
    assert.ok(r.pill.some(t=>/^TP2:/.test(t)),"l'etichetta TP2 resta disegnata dopo il tocco: "+(r.pill.join(' || ')));
    assert.ok(!r.pill.some(t=>/×/.test(t)),'dopo il tocco il gruppo non si ri-aggrega (niente «×N»): '+(r.pill.join(' || ')));
    assert.deepEqual(errori.filter(x=>!/PointerCapture/.test(x)), []);
  } finally { await browser.close(); }
});
