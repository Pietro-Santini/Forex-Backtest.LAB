// I DISEGNI NON SI SPOSTANO MAI, NEMBRENDO CAMBIARE ASSET.
//
// RICHIESTO dal proprietario (27 ottobre 2026): «mi puoi fare anche una piccola verifica
// sull'aggancio corretto dei disegni, se si spostano più oppure rimangono fermi a dove sono stati
// posizionati, il discorso del time frame che cambia, oppure l'asset che cambia, i disegni che si
// spostano. Cerchiamo di rendere che i disegni non si spostano mai e tengono in riferimento quello
// che è le candele, il prezzo, il timestamp, quindi anche il tempo.»
//
// Il cambio di TIMEFRAME è già coperto da disegni_cambio_tf.test.mjs (timestamp immutato al
// millisecondo). Qui si copre l'altra metà della domanda: il cambio di ASSET. Un disegno è
// ancorato all'asset su cui è stato fatto; uscendoci e rientrando deve tornare ESATTAMENTE dov'era
// (stesso timestamp, stesso prezzo), non ricostruito in un punto "vicino".
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const candele = (minuti=300) => {
  const t0 = Date.now() - minuti*60000; let p = 4161; const R = [];
  for (let i=0;i<minuti;i++){ const o=p, c=p+Math.sin(i/7)*2;
    R.push({date:new Date(t0+i*60000).toISOString(), open:o, high:Math.max(o,c)+2, low:Math.min(o,c)-2, close:c, volume:10}); p=c; }
  return R;
};

test('cambiando asset e tornando indietro, il disegno è esattamente dov-era', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      var XAU=${JSON.stringify(candele(300))}, EUR=${JSON.stringify(candele(200))};   // due asset, storici diversi
      rows=XAU; baseRows=XAU; idx=XAU.length-1; viewEnd=XAU.length;
      currentAssetKey='XAUUSD'; visibleCount=300; liveModeActive=false; mt5Connected=false;
      csvLibrary=[{id:'a',name:'A',addedAt:Date.now(),rows:XAU}];
      // UN disegno sull'oro: un trendline ancorata a due istanti precisi.
      var t1=Date.parse(XAU[100].date)+7000, t2=Date.parse(XAU[140].date)+24000;
      drawings=[{id:'d1',type:'trendline',p1:{time:t1,price:4161},p2:{time:t2,price:4170},
                 locked:false,hidden:false,color:'#fff',lineWidth:1}];
      assetDrawings={backtest:{},live:{},backtest_propfirm:{},live_propfirm:{}};
      // Si esce dall'asset: il disegno viene messo via (captureCurrentAssetDrawings, la funzione
      // vera che l'app chiama a ogni cambio asset).
      captureCurrentAssetDrawings(currentMode());
      var salvato=((assetDrawings[currentMode()]||{})['XAUUSD'])||null;
      // Si entra in un altro asset: il grafico mostra i disegni DI QUELLO asset (nessuno).
      currentAssetKey='EURUSD'; rows=EUR; baseRows=EUR; idx=EUR.length-1; viewEnd=EUR.length;
      drawings=((assetDrawings[currentMode()]||{})['EURUSD'])||[];
      var suEur=drawings.length;
      // Si TORNA sull'oro: il disegno deve essere rimesso com'era.
      currentAssetKey='XAUUSD'; rows=XAU; baseRows=XAU; idx=XAU.length-1; viewEnd=XAU.length;
      drawings=((assetDrawings[currentMode()]||{})['XAUUSD'])||[];
      var d=drawings[0]||null;
      // E la sua posizione a schermo, calcolata con la geometria vera del grafico.
      var g=chartGeometry();
      var x1=g?g.xFromTime(t1):null, y1=g?g.y(4161):null;
      var x2=g?g.xFromTime(t2):null, y2=g?g.y(4170):null;
      return {salvato:!!salvato, suEur:suEur,
              tornato:!!d,
              t1ok:d?d.p1.time===t1:false, t2ok:d?d.p2.time===t2:false,
              p1ok:d?d.p1.price===4161:false, p2ok:d?d.p2.price===4170:false,
              x1:x1,y1:y1,x2:x2,y2:y2,
              x1finito:Number.isFinite(x1), y1finito:Number.isFinite(y1)};
    })()`);
    assert.equal(r.salvato, true, 'uscendo dall\'asset il disegno viene messo via, non perso');
    assert.equal(r.suEur, 0, 'sull\'altro asset non compaiono i disegni dell\'oro');
    assert.equal(r.tornato, true, 'tornando sull\'oro il disegno c\'è');
    assert.ok(r.t1ok && r.t2ok, 'i due timestamp devono essere IDENTICI al millisecondo');
    assert.ok(r.p1ok && r.p2ok, 'i due prezzi devono essere identici');
    assert.ok(r.x1finito && r.y1finito, 'la posizione a schermo si calcola (timestamp e prezzo validi)');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('cambiando ripetutamente asset il disegno non si degrada', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      var A=${JSON.stringify(candele(300))}, B=${JSON.stringify(candele(150))}, C=${JSON.stringify(candele(250))};
      assetDrawings={backtest:{},live:{},backtest_propfirm:{},live_propfirm:{}};
      var t=Date.parse(A[50].date)+3500;
      function dis(){ return {id:'d9',type:'trendline',p1:{time:t,price:4161},p2:{time:t+60000,price:4165},
        locked:false,hidden:false,color:'#fff',lineWidth:1}; }
      // Si entra sull'oro col disegno fatto, poi si mette via (la funzione vera dell'app).
      function entra(ak,rowsx,conDisegno){
        currentAssetKey=ak; rows=rowsx; baseRows=rowsx; idx=rowsx.length-1;
        drawings=conDisegno?[dis()]:[];
        captureCurrentAssetDrawings(currentMode());       // è qui che il disegno viene messo via
      }
      function riapri(ak,rowsx){
        currentAssetKey=ak; rows=rowsx; baseRows=rowsx; idx=rowsx.length-1; viewEnd=rowsx.length;
        drawings=((assetDrawings[currentMode()]||{})[ak])||[];
        return drawings[0]||null;
      }
      entra('XAUUSD',A,true);              // disegno fatto sull'oro
      var d0=riapri('XAUUSD',A);           // ed è subito rimesso: identico?
      entra('EURUSD',B,false);
      entra('GBPUSD',C,false);
      entra('EURUSD',B,false);
      var d1=riapri('XAUUSD',A);           // giro fatto, si torna sull'oro
      return {t0:d0?d0.p1.time:null, t1:d1?d1.p1.time:null,
              p0:d0?d0.p1.price:null, p1:d1?d1.p1.price:null,
              t2_0:d0?d0.p2.time:null, t2_1:d1?d1.p2.time:null,
              tipo:d1?d1.type:null};
    })()`);
    assert.equal(r.t1, r.t0, 'dopo il giro fra tre asset il timestamp deve essere identico');
    assert.equal(r.t2_1, r.t2_0, 'e anche il secondo punto');
    assert.equal(r.p1, r.p0, 'e il prezzo');
    assert.equal(r.tipo, 'trendline', 'il disegno resta quello che era');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
