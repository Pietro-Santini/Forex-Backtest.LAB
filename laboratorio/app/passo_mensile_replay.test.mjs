// IL PASSO A FRECCETTA SU UNA CANDELA MENSILE DEVE AVANZARE DI UN MESE DI CALENDARIO.
//
// SEGNALATO dalla misura del 16 novembre: `replaySecondsPerBar()` vale `currentTF*60` secondi, quindi
// sul time frame mensile (43200 minuti) il passo e' **30 giorni fissi**. Ma la candela mensile non
// dura 30 giorni: `fblInizioBucket` per `minutes>=43200` usa i mesi di calendario, che sono 28-31
// giorni. Conseguenze misurate sull'aritmetica vera (2026): in 7 mesi su 12 il passo da 30 giorni
// atterra ancora DENTRO lo stesso mese (1 gennaio + 30 giorni = 31 gennaio: la candela non avanza) e
// a febbraio sfora di due giorni (1 febbraio + 30 = 3 marzo, saltando un mese).
//
// COME SI MISURA: non si legge il sorgente e non si indovina la formula. Si guida la pagina vera -
// candele giornaliere finte, time frame 43200, replay avviato, un passo a freccetta - e si guarda
// **quale mese mostra** il grafico dopo. La regola e' quella del proprietario («un passo = una
// candela»), applicata a una candela che non ha una durata fissa.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// ~4 anni di candele giornaliere: bastano a coprire i 12 mesi del 2026 con un anno di storico prima
// e uno dopo, cosi' nessun passo sbatte contro il bordo dei dati (che e' un'altra storia, si misura
// in passo_fine_dati.test.mjs).
const SCENA = `(function(){
  const R=[]; let p=1.0800;
  for(let i=0;i<1460;i++){
    const d=new Date(Date.UTC(2024,0,1,12)+i*86400000);
    p+=0.00001;
    R.push({date:d.toISOString().slice(0,19).replace('T',' '),
            open:p, high:p+0.0002, low:p-0.0002, close:p+0.00005, volume:100});
  }
  baseRows=R;
  rowsAssetKey=currentAssetKey='EURUSD';
  currentTF=43200;                       // il time frame mensile
  liveModeActive=true; mt5Connected=false;
  liveReplayActive=false; liveReplaySelecting=false; liveReplayGuideClientX=null;
  replayForm=null;
  positions.length=0; pendingOrders.length=0; trades.length=0;
  rebuildRows();
  followLatest=true; viewEnd=idx; autoFitWidth=true; priceZoomFactor=1;
  viewPriceLo=null; viewPriceHi=null;
  draw();
  return {candele:rows.length, tf:currentTF};
})()`;

// UN PASSO IN AVANTI DA OGNI MESE DEL 2026, guidato dalla pagina vera.
const PASSO_AVANTI = `(function(){
  const out=[];
  for(let m=0;m<12;m++){
    // SI PARTE DAL PRIMO DEL MESE, non dal 15: e' lo stato vero della candela mensile sul grafico
    // (il suo inizio). Partendo dal 15 il difetto si nascondeva - 15 gennaio + 30 giorni = 14
    // febbraio, che per caso e' il mese giusto. Misurato: e' dal primo del mese che la formula
    // vecchia sbaglia, e da li' un passo indietro finiva perfino a dicembre (idx 24 -> 23).
    const partenza=Date.UTC(2026,m,1,0,0,0);
    avviaReplayLive(partenza,{propaga:false});
    const da=replayMomentoMostrato();
    if(!Number.isFinite(da)){ out.push({mese:m, errore:'replay non partito'}); continue; }
    const prima=fblInizioBucket(da,43200);
    fblReplayPasso(1,false);             // UN passo a freccetta, la strada vera del tasto
    const dopoIstante=replayMomentoMostrato();
    const dopo=Number.isFinite(dopoIstante)?fblInizioBucket(dopoIstante,43200):null;
    out.push({mese:m, da, prima, dopo,
              avanzate:Number.isFinite(dopo)?(dopo>prima):null,
              // cosa avrebbe fatto la formula vecchia (30 giorni fissi): serve solo a dimostrare
              // che questo banco il difetto lo vede davvero, non a definire il comportamento.
              con30Giorni:fblInizioBucket(da+43200*60000,43200)});
    try{ esciReplayLive({esci:true,propaga:false}); }catch(e){}
    try{ liveReplayActive=false; replayForm=null; }catch(e){}
  }
  return out;
})()`;

// LO STESSO PASSO ALL'INDIETRO.
const PASSO_INDIETRO = `(function(){
  const out=[];
  for(let m=1;m<12;m++){
    const partenza=Date.UTC(2026,m,1,0,0,0);
    avviaReplayLive(partenza,{propaga:false});
    const da=replayMomentoMostrato();
    if(!Number.isFinite(da)){ out.push({mese:m, errore:'replay non partito'}); continue; }
    const prima=fblInizioBucket(da,43200);
    fblReplayPasso(-1,false);
    const dopoIstante=replayMomentoMostrato();
    const dopo=Number.isFinite(dopoIstante)?fblInizioBucket(dopoIstante,43200):null;
    out.push({mese:m, da, prima, dopo});
    try{ esciReplayLive({esci:true,propaga:false}); }catch(e){}
    try{ liveReplayActive=false; replayForm=null; }catch(e){}
  }
  return out;
})()`;

test('un passo a freccetta su una candela mensile avanza di UN mese di calendario', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const scena = await pagina.evaluate(SCENA);
    assert.equal(scena.tf, 43200, 'la scena deve essere sul time frame mensile');
    assert.ok(scena.candele >= 12, 'la scena deve avere almeno 12 candele mensili: ' + scena.candele);

    const casi = await pagina.evaluate(PASSO_AVANTI);
    const righe = [];
    let vecchiaSbagliata = 0;
    for (const c of casi) {
      assert.ok(!c.errore, 'mese ' + c.mese + ': ' + c.errore);
      const attesoPrima = Date.UTC(2026, c.mese, 1);
      const attesoDopo = Date.UTC(2026, c.mese + 1, 1);
      righe.push((c.mese + 1) + ': ' + new Date(c.prima).toISOString().slice(0, 10)
        + ' -> ' + (c.dopo === null ? 'null' : new Date(c.dopo).toISOString().slice(0, 10)));
      assert.equal(c.prima, attesoPrima,
        'la candela di partenza del mese ' + (c.mese + 1) + ' non e il primo del mese');
      assert.equal(c.dopo, attesoDopo,
        'dal mese ' + (c.mese + 1) + ' un passo deve mostrare il mese dopo ('
        + new Date(attesoDopo).toISOString().slice(0, 10) + '), invece mostra '
        + (c.dopo === null ? 'niente' : new Date(c.dopo).toISOString().slice(0, 10)));
      if (c.con30Giorni !== attesoDopo) vecchiaSbagliata++;
    }
    console.log('passo mensile, mese per mese:\n  ' + righe.join('\n  '));
    // PROVA DI CONTROLLO: la formula vecchia (30 giorni fissi) sbaglia la maggior parte dei mesi.
    // Se un giorno qualcuno la rimettesse, questo numero lo direbbe subito.
    console.log('la formula vecchia (30 giorni fissi) sbagliava ' + vecchiaSbagliata + ' mesi su 12');
    assert.ok(vecchiaSbagliata >= 6,
      'prova di controllo: con 30 giorni fissi il passo deve sbagliare almeno 6 mesi su 12, ne sbaglia '
      + vecchiaSbagliata + ' - se e 0, questo banco non sta piu misurando niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('all indietro il passo mensile torna al mese prima, e dal primo del mese non si ferma', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENA);
    const casi = await pagina.evaluate(PASSO_INDIETRO);
    for (const c of casi) {
      assert.ok(!c.errore, 'mese ' + c.mese + ': ' + c.errore);
      assert.equal(c.dopo, Date.UTC(2026, c.mese - 1, 1),
        'dal mese ' + (c.mese + 1) + ' un passo indietro deve mostrare il mese prima, invece mostra '
        + (c.dopo === null ? 'niente' : new Date(c.dopo).toISOString().slice(0, 10)));
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('dal 31 gennaio un passo in avanti resta dentro febbraio, non salta a marzo', async () => {
  // Il caso peggiore: 31 giorni di gennaio applicati al 31 gennaio portano al 3 marzo, quindi
  // febbraio non si vedrebbe mai. La regola e' "una candela avanti": la candela dopo gennaio e
  // febbraio, e ci si deve restare dentro.
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENA);
    const r = await pagina.evaluate(`(function(){
      const partenza=Date.UTC(2026,0,31,23,0,0);   // ultimo giorno di gennaio, in chiusura
      avviaReplayLive(partenza,{propaga:false});
      const da=replayMomentoMostrato();
      fblReplayPasso(1,false);
      const m=replayMomentoMostrato();
      const dopo=Number.isFinite(m)?fblInizioBucket(m,43200):null;
      let esci=true; try{ esciReplayLive({esci:true,propaga:false}); }catch(e){}
      return {da, dopo, mostrato:m};
    })()`);
    assert.equal(r.dopo, Date.UTC(2026, 1, 1),
      'dal 31 gennaio si deve finire a febbraio, non il '
      + (r.dopo === null ? 'nulla' : new Date(r.dopo).toISOString().slice(0, 10)));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
