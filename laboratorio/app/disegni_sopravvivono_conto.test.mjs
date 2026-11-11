// I DISEGNI DEVONO SOPRAVVIVERE AL CAMBIO CONTO MT5.
//
// RICHIESTO DAL PROPRIETARIO (10 novembre 2026), testuale: «quando cambio account MT5 non mi deve
// togliere i disegni che ho fatto su un account, quelli comunque rimangono, devono rimanere tra un
// account e l'altro, anche quando faccio il passaggio, quelli devono rimanere sempre in lista per
// ogni asset.»
//
// Il banco misura il comportamento, non il sorgente: mette DUE disegni a mano sull'asset del conto
// A, passa al conto B (la strada vera e' connectToMt5Bridge -> mt5AttivaConto), torna sul conto A e
// conta i disegni. Oggi il conteggio tornato è 0 (rosso).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Mette l'app in Live con MT5 "collegato" a un conto preciso, senza ponte vero.
const IMPOSTA_CONTO = (login, server) => `
  try{ mt5AttivaConto(${JSON.stringify(String(login))}, ${JSON.stringify(String(server || ''))}, true, 0); }catch(e){}
  try{ liveModeActive=true; }catch(e){}
  try{ mt5Connected=true; }catch(e){}
  try{ currentAssetKey='EURUSD'; }catch(e){}
`;

// Due disegni fatti a mano, come li scrive l'app quando si disegna sul grafico.
const DISEGNI = `[
  {id:'d1',type:'trendline',p1:{time:1700000000000,price:1.1},p2:{time:1700000600000,price:1.12},locked:false,hidden:false,color:'#fff',lineWidth:1},
  {id:'d2',type:'hline',p1:{time:0,price:1.09},p2:{time:0,price:1.09},locked:false,hidden:false,color:'#fff',lineWidth:1}
]`;

// ATTENZIONE — MISURATO (10 novembre 2026): nel giro piu' semplice (stesso asset, cambio conto e
// ritorno) i disegni OGGI tornano (2 su 2), quindi questo caso da solo NON è il difetto. Non è un
// merito del codice: è un incidente. All'andata la riga 5984 assegna assetDrawings[mode][asset]
// =drawings PER RIFERIMENTO, e al ritorno il ripristino (riga 5994) fa push proprio su quell'array;
// la riga 5997 poi ne fa la copia. Due riferimenti condivisi salvano il ripristino per caso. Resta
// come GUARDIA: se qualcuno corregge il cambio conto toccando quei riferimenti, deve restare verde.
test('GUARDIA — giro semplice: cambio conto e ritorno, i disegni tornano (oggi sì, per riferimento condiviso)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      assetDrawings={backtest:{},live:{},backtest_propfirm:{},live_propfirm:{}};
      positions.length=0; pendingOrders.length=0;
      ${IMPOSTA_CONTO('11111','Broker-Demo')}
      drawings=${DISEGNI};                       // due disegni fatti a mano sul conto 11111
      var fatti=drawings.length;
      // --- passo al conto 22222: la strada vera del cambio conto ---
      mt5AttivaConto('22222','Broker-Demo',true,0);
      var sullAltroConto=drawings.length;
      var assetSullAltro=((assetDrawings[currentMode()]||{})['EURUSD']||[]).length;
      var parcheggio11111AllaPartenza=((mt5Parcheggio['11111']||[]).length);
      // --- torno sul conto 11111 ---
      mt5AttivaConto('11111','Broker-Demo',true,0);
      var tornato=drawings.length;
      var parcheggio11111AlRitorno=((mt5Parcheggio['11111']||[]).length);
      var pendentiFantasma=pendingOrders.length;    // dove finiscono i disegni "ripristinati"?
      var backup=null;
      try{ backup=JSON.parse(localStorage.getItem('fxbt_drawings_backup_v1')||'null'); }catch(e){}
      return {fatti, sullAltroConto, assetSullAltro, parcheggio11111AllaPartenza,
              tornato, parcheggio11111AlRitorno, pendentiFantasma,
              backupAsset: backup ? ((backup.assetDrawings||{}).live||{}).EURUSD||null : null,
              contoAttivo: mt5ContoAttivo ? mt5ContoAttivo.login : null};
    })()`);
    console.log('MISURA fatti sul conto A            =', r.fatti);
    console.log('MISURA visibili sul conto B         =', r.sullAltroConto);
    console.log('MISURA in assetDrawings su B        =', r.assetSullAltro);
    console.log('MISURA parcheggiati alla partenza   =', r.parcheggio11111AllaPartenza);
    console.log('MISURA tornati sul conto A          =', r.tornato);
    console.log('MISURA parcheggiati al ritorno      =', r.parcheggio11111AlRitorno);
    console.log('MISURA pendenti fantasma al ritorno =', r.pendentiFantasma);
    console.log('MISURA copia dedicata (backup)      =', JSON.stringify(r.backupAsset));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.fatti, 2, 'i disegni fatti a mano devono essere 2');
    assert.equal(r.tornato, 2,
      'tornando sul conto A i due disegni devono esserci ANCORA — misurato: ' + r.tornato);
  } finally { await browser.close(); }
});

// LA PERDITA DEFINITIVA: i disegni parcheggiati al cambio conto non sanno su che ASSET erano.
// Sequenza misurata: disegni su EURUSD (conto A) -> passo al conto B -> nel frattempo seleziono un
// altro asset -> torno sul conto A. Il ripristino (app.html:5992-5995) li consegna all'asset che
// è a grafico IN QUEL MOMENTO (currentAssetKey), non a quello su cui erano stati fatti, e la riga
// 5999 cancella il parcheggio: per l'asset giusto sono persi per sempre.
test('cambio conto con un altro asset nel mezzo: i disegni non si perdono ne cambiano asset', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      assetDrawings={backtest:{},live:{},backtest_propfirm:{},live_propfirm:{}};
      positions.length=0; pendingOrders.length=0;
      ${IMPOSTA_CONTO('11111','Broker-Demo')}
      drawings=${DISEGNI};                                  // due disegni su EURUSD, conto A
      captureCurrentAssetDrawings(currentMode());           // la funzione vera dell'app al cambio asset
      var suEurPrima=((assetDrawings[currentMode()]||{}).EURUSD||[]).length;
      mt5AttivaConto('22222','Broker-Demo',true,0);         // passo al conto B (stesso asset)
      // Nel frattempo, sul conto B, seleziono un altro asset (la strada vera del cambio asset).
      currentAssetKey='GBPUSD'; drawings=[];
      mt5AttivaConto('11111','Broker-Demo',true,0);         // torno sul conto A
      var suEurDopo=((assetDrawings[currentMode()]||{}).EURUSD||[]).length;
      var suGbp=((assetDrawings[currentMode()]||{}).GBPUSD||[]).length;
      var parcheggioRimasto=Object.keys(mt5Parcheggio);
      return {suEurPrima, suEurDopo, suGbp, parcheggioRimasto};
    })()`);
    console.log('MISURA su EURUSD prima      =', r.suEurPrima);
    console.log('MISURA su EURUSD dopo       =', r.suEurDopo);
    console.log('MISURA su GBPUSD (estranei) =', r.suGbp);
    console.log('MISURA parcheggio rimasto   =', JSON.stringify(r.parcheggioRimasto));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.suEurDopo, 2,
      'i disegni restano sull asset su cui sono stati fatti — misurato: ' + r.suEurDopo);
    assert.equal(r.suGbp, 0,
      'i disegni di EURUSD non devono finire su GBPUSD — misurato: ' + r.suGbp);
  } finally { await browser.close(); }
});

test('i disegni del conto A restano anche mentre si è sul conto B', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      assetDrawings={backtest:{},live:{},backtest_propfirm:{},live_propfirm:{}};
      ${IMPOSTA_CONTO('11111','Broker-Demo')}
      drawings=${DISEGNI};
      mt5AttivaConto('22222','Broker-Demo',true,0);   // cambio conto, STESSO asset
      return {sulContoB: drawings.length,
              inElencoAsset: ((assetDrawings[currentMode()]||{})['EURUSD']||[]).length,
              contoAttivo: mt5ContoAttivo ? mt5ContoAttivo.login : null};
    })()`);
    console.log('MISURA rimasti sul conto B          =', r.sulContoB);
    console.log('MISURA in elenco per asset su B     =', r.inElencoAsset);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.sulContoB, 2,
      'i disegni fatti sull\'asset devono restare anche passando all\'altro conto — misurato: ' + r.sulContoB);
  } finally { await browser.close(); }
});
