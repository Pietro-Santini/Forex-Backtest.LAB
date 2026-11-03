// LA LINEA TRATTEGGIATA DELL'ENTRATA DEVE VEDERSI, E NON DEVE COPRIRE LE ETICHETTE.
//
// DUE RICHIESTE DELLO STESSO GIORNO (3 novembre 2026) che sembravano in conflitto:
//  - mattina: «quando selezioniamo una linea delle etichette, la linea passa sopra all'etichetta
//    e invece deve passargli sotto: l'etichetta in primo piano e la linea in secondo»;
//  - sera: «non si vede piu' la linea tratteggiata di entrata delle posizioni: c'e' la maniglia a
//    destra e la freccia della posizione, ma non c'e' la linea che collega la freccia con la
//    maniglia».
//
// COS'ERA SUCCESSO: la prima richiesta era stata risolta TOGLIENDO la riga dalla casella TP/SL,
// contando sulla linea a tutta larghezza della prima passata. Ma quella e' un'altra cosa: dipende
// dall'interruttore «linea del prezzo di entrata», e con quello SPENTO non restava piu' niente a
// unire la freccia di apertura alla maniglia. Lo scenario qui sotto e' proprio quello.
//
// LA CURA non sceglie fra le due: la linea c'e', ma salta le etichette invece di passarci sopra.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Conta i segmenti orizzontali col tratteggio [1,3] (quello dell'entrata) e la loro lunghezza.
const MISURA = (extra) => `(function(){
  const t0=Date.UTC(2026,9,20,8,0,0); const R=[];
  for(let i=0;i<80;i++){ const c=1900+Math.sin(i/7)*4;
    R.push({date:new Date(t0+i*60000).toISOString(),open:c,high:c+2,low:c-2,close:c,volume:10}); }
  rows=R; baseRows=R; idx=70; viewEnd=79; rowsAssetKey='XAUUSD'; currentAssetKey='XAUUSD';
  liveModeActive=false; liveReplayActive=false;
  positions.length=0;
  positions.push({id:'p1',asset:'XAUUSD',side:'BUY',entry:1900,sl:1890,tp:1920,lots:0.5,
    start:40,startTime:Date.parse(R[40].date),openTF:1,createdAt:Date.now()});
  active=positions[0];
  ${extra}
  const proto=CanvasRenderingContext2D.prototype;
  const vM=proto.moveTo,vL=proto.lineTo,vS=proto.stroke;
  let u=null, segmenti=0, lunghezza=0;
  proto.moveTo=function(x,y){u={x1:x,y1:y};return vM.apply(this,arguments);};
  proto.lineTo=function(x,y){if(u){u.x2=x;u.y2=y;}return vL.apply(this,arguments);};
  proto.stroke=function(){
    try{ const d=this.getLineDash&&this.getLineDash();
      if(u&&u.x2!=null&&Math.abs(u.y1-u.y2)<0.5&&d&&d.length===2&&d[0]===1&&d[1]===3){
        segmenti++; lunghezza+=Math.abs(u.x2-u.x1); } }catch(e){}
    u=null; return vS.apply(this,arguments);
  };
  draw();
  proto.moveTo=vM; proto.lineTo=vL; proto.stroke=vS;
  return {segmenti, lunghezza:Math.round(lunghezza)};
})()`;

test('con l\'interruttore della linea di prezzo SPENTO la linea dell\'entrata si vede lo stesso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // E' la condizione esatta della segnalazione: senza questo il test misurerebbe la linea a
    // tutta larghezza, che non e' quella che mancava.
    const r = await pagina.evaluate(MISURA("try{ localStorage.setItem('fbl_linee_prezzo','0'); }catch(e){}"));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.ok(r.segmenti >= 1,
      'nessun tratteggio all\'altezza dell\'entrata: la freccia e la maniglia restano scollegate');
    assert.ok(r.lunghezza > 50,
      'la linea c\'è ma è lunga ' + r.lunghezza + 'px: deve arrivare dalla freccia alla maniglia');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: la linea non deve tornare a passare SOPRA le etichette. Con l'etichetta
// dell'entrata proprio sulla sua strada, il tratteggio deve spezzarsi in due pezzi invece di
// attraversarla: e' il modo in cui le due richieste convivono.
test('dove c\'è un\'etichetta la linea si interrompe, non ci passa sopra', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      // Una striscia registrata come etichetta in mezzo al percorso della linea.
      resetLabelPlacements();
      labelPlacements.push({x:300,y:195,w:120,h:14});
      const tratti=[];
      const proto=CanvasRenderingContext2D.prototype;
      const vM=proto.moveTo,vL=proto.lineTo,vS=proto.stroke;
      let u=null;
      proto.moveTo=function(x,y){u={x1:x,y1:y};return vM.apply(this,arguments);};
      proto.lineTo=function(x,y){if(u){u.x2=x;u.y2=y;}return vL.apply(this,arguments);};
      proto.stroke=function(){ if(u&&u.x2!=null)tratti.push([Math.round(u.x1),Math.round(u.x2)]); u=null; return vS.apply(this,arguments); };
      const c=document.getElementById('chart').getContext('2d');
      fblLineaSaltaEtichette(c,200,600,202);   // 202 cade dentro la striscia 195..209
      proto.moveTo=vM; proto.lineTo=vL; proto.stroke=vS;
      return tratti;
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.length, 2, 'la linea deve uscire in DUE pezzi, uno per lato dell\'etichetta: ' + JSON.stringify(r));
    assert.ok(r[0][1] <= 300, 'il primo pezzo si ferma prima dell\'etichetta');
    assert.ok(r[1][0] >= 420, 'il secondo riprende dopo');
  } finally { await browser.close(); }
});
