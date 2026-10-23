// LE ETICHETTE TP/SL CHE SI SOVRAPPONGONO SI RAGGRUPPANO IN UNA SOLA.
//
// SEGNALATO (23 ottobre 2026): «quando un gruppo di segnali apre più posizioni insieme, a
// grafico le caselle TP/SL coincidono e le etichette si impilano una sopra l'altra: TP1, TP2,
// TP3 scritti una sull'altra non si leggono, e sembrano obiettivi diversi mentre è lo stesso
// obiettivo diviso in tagli. Raggruppare in un'unica etichetta: numero di posizioni, origine,
// e l'accumulo della perdita per gli SL».
//
// IL DIFETTO: la casella Target/Stop si disegna per OGNI posizione (drawTpSlZoneBox una
// chiamata per posizione): tre posizioni con stessa entrata, stesso stop e stesso target
// scrivono tre etichette alle stesse coordinate, l'una sopra l'altra.
//
// LA CURA: posizioni con casella IDENTICA (stesso freccia d'apertura, spigolo destro e
// stessi livelli) si disegnano UNA volta sola, con un'unica etichetta che dice quante sono
// («×3»), da chi arrivano (la sala, o «miste») e quanto perdono IN TOTALE se lo stop prende
// tutte (la somma, non la perdita della sola posizione disegnata). Durante il trascinamento
// di un livello il raggruppamento si stacca: si sta modificando una posizione, e quella
// momentaneamente si vede da sola, come prima.
//
// Quel che resta per UNA posizione sola non cambia niente: etichette e numeri sono quelli di
// sempre (i test di etichette_tp_sl.test.mjs restano verdi su quella parte).
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

// Tre posizioni dello stesso segnale di sala: entrata, stop, target e orario di apertura
// identici (è il gruppo di segnali che il proprietario ha detto: lo stesso obiettivo in tagli).
const GRUPPO = () => {
  const st=Date.parse(rows[100].date);
  const sala={tgSala:'PipHunter',tgGruppo:'g1',tgSegnaleId:'s1'};
  return [1,2,3].map(n=>Object.assign({
    id:'p'+n,side:'BUY',entry:4161,sl:4100,tp:4200,lots:0.1,asset:'XAUUSD',
    startTime:st,symbol:'XAUUSD'
  },sala,{tgTpIndice:n}));
};

test('tre caselle identiche diventano UNA etichetta, con numero, origine e accumulo della perdita', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      var pos=(${GRUPPO})();
      positions=pos; active=null; posSelezionata=null; previewTradeLevel=null;
      draw();
      var tpPills=window.__pill.filter(function(t){return /^TP\\d??:/.test(t);});
      var slPills=window.__pill.filter(function(t){return /^(SL|Stop Profit):/.test(t);});
      // L'accumulo atteso: la perdita di UNA posizione all'SL, per tre, formattata come la scrive
      // l'app (stessa funzione euro(): non si indovina il formato, si usa il suo).
      var attesa=' • -'+euro(3*euroAtLevel(4161,4100,0.1,'XAUUSD'));
      return {tpPills:tpPills, slPills:slPills, attesa:attesa};
    })()`);
    const tp=r.tpPills.join(' || '), sl=r.slPills.join(' || ');
    // UNA SOLA etichetta per i target del gruppo: tre TP1/TP2/TP3 impilate era il difetto.
    assert.equal(r.tpPills.length,1,'ci deve essere UNA sola etichetta TP raggruppata, trovate: '+tp);
    assert.ok(/^TP:/.test(r.tpPills[0]),'nel gruppo l\'etichetta non porta il numero della singola: '+tp);
    assert.ok(/×3/.test(tp),'manca il numero di posizioni ('+tp+')');
    assert.ok(/PipHunter/.test(tp),'manca l\'origine del gruppo ('+tp+')');
    // E per lo stop: una sola etichetta, con la perdita ACCUMULATA del gruppo (non di una sola).
    assert.equal(r.slPills.length,1,'ci deve essere UNA sola etichetta SL raggruppata, trovate: '+sl);
    assert.ok(/×3/.test(sl),'manca il numero di posizioni sull\'etichetta SL ('+sl+')');
    assert.ok(/PipHunter/.test(sl),'manca l\'origine sull\'etichetta SL ('+sl+')');
    assert.ok(sl.includes(r.attesa),'manca l\'accumulo della perdita: atteso «'+r.attesa+'», trovato: '+sl);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('target DIVERSI non si raggruppano: le etichette restano TP1 e TP2, come prima', async () => {
  // La prova di controllo del capitolo: raggruppano solo le caselle che coincidono davvero,
  // non tutte quelle vicine. Due posizioni con target diversi devono restare separate.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      var st=Date.parse(rows[100].date);
      var sala={tgSala:'PipHunter',tgGruppo:'g1',tgSegnaleId:'s1'};
      positions=[Object.assign({id:'a',side:'BUY',entry:4161,sl:4100,tp:4200,lots:0.1,asset:'XAUUSD',startTime:st},sala,{tgTpIndice:1}),
                 Object.assign({id:'b',side:'BUY',entry:4161,sl:4100,tp:4260,lots:0.1,asset:'XAUUSD',startTime:st},sala,{tgTpIndice:2})];
      active=null; posSelezionata=null; previewTradeLevel=null;
      draw();
      return {pill:window.__pill.filter(function(t){return /^TP\\d??:/.test(t);})};
    })()`);
    const tp=r.pill.join(' || ');
    assert.equal(r.pill.length,2,'con target diversi ci sono due etichette distinte, trovate: '+tp);
    assert.ok(/TP1:/.test(tp)&&/TP2:/.test(tp),'le due etichette restano numerate: '+tp);
    assert.ok(!/×/.test(tp),'nessun raggruppamento con target diversi: '+tp);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('mentre si sta trascinando un livello il raggruppamento si stacca', async () => {
  // Il trascinamento mostra il valore LIVE della posizione che si muove: in quel momento ognuna
  // si vede da sola, perché le caselle non coincidono più mentre il dito trascina.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      positions=(${GRUPPO})();
      active=positions[0]; posSelezionata=null;
      previewTradeLevel={type:'SL',price:4050};
      draw();
      return {pill:window.__pill.filter(function(t){return /^TP\\d??:/.test(t);})};
    })()`);
    const tp=r.pill.join(' || ');
    assert.equal(r.pill.length,3,'durante il trascinamento le tre etichette si vedano da sole, trovate: '+tp);
    assert.ok(/TP1:/.test(tp)&&/TP2:/.test(tp)&&/TP3:/.test(tp),'le etichette numerate tornano: '+tp);
    assert.ok(!/×/.test(tp),'nessun «×» durante il trascinamento: '+tp);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
