// IL PROFILO VOLUMETRICO: CAMBIANDO TIME FRAME IL NUMERO DI CANDELE DENTRO L'ISTOGRAMMA NON
// DEVE CAMBIARE (voce del 28 ottobre, risegnalata il 9 novembre 2026).
//
// Parole del proprietatore (9 novembre): «è rimasto il problema del numero delle barre che
// diminuiscono al cambio di time frame, devono rimanere le stesse del time frame da 1m, quindi
// se sono a un time frame da 15m non possono diminuire le barre dell'istogramma ma devono
// rimanere le stesse del timeframe da 1 minuto, come funziona su TradingView. Mi raccomando è
// importante». Nel lessico del progetto «le barre dentro l'istogramma» sono le CANDELE che il
// profilo copre (la richiesta del 28 ottobre diceva: «cambiando timeframe il numero di candele
// dentro l'istogramma non deve cambiare»).
//
// LE DUE COSE SONO DIVERSE, e vanno tenute separate (lezione del 4 novembre 2026, quando cursare
// una delledue rovinava l'altra):
//   1. il NUMERO DELLE CANDELE dentro il profilo (questa prova);
//   2. il NUMERO DELLE FASCE (le righe orizzontali del profilo: profilobarre_timeframe.test.mjs);
//   3. la LUNGHEZZA delle barre, che deve continuare a seguire lo zoom (sempre profilobarre_...
//      .test.mjs). Qui non si tocca.
//
// MISURA DEL DIFETTO, prima della cura: un profilo disegnato sulle ultime 300 candele a 1
// minuto, passando a 15 minuti, crollava a 20 candele — perché il codice spostava sempre
// l'estremo DESTRO, e quello era già sull'ultima candela: non poteva allungarsi e il conto
// veniva tagliato ai dati disponibili.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Disegna un profilo sulle ultime N CANDELE (come fa l'utente col mouse) e misura quante candele
// contiene davvero e quante ore copre, a ogni time frame. Si legge vpFixedResolveRange, che è la
// funzione che decide il range: misurare il disegno prenderebbe dentro anche zone e sfondi.
const PREPARA = (ancora, N = 300) => `(function(){
  const t0=Date.UTC(2026,9,20,8,0,0); const R=[]; let p=1900;
  for(let i=0;i<6000;i++){ p+=(Math.sin(i/13)+Math.cos(i/7))*0.3;
    R.push({date:new Date(t0+i*60000).toISOString(),open:p,high:p+0.8,low:p-0.8,close:p+0.1,volume:10+(i%7)}); }
  csvLibrary=[{name:'t',rows:R}]; rebuildBaseRowsFromLibrary();
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD'; liveModeActive=false; liveReplayActive=false;
  const a1m=function(){ currentTF=1; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
                        viewEnd=rows.length-1; idx=rows.length-1; };
  visibleCount=80; autoFitWidth=false; followLatest=false;
  a1m();
  // Il profilo si disegna SEMPRE con le candele da 1 minuto (come quando l'utente lo crea).
  const N=${N};
  const a=rows.length-N, b=rows.length-1;
  const d={id:'vp1',type:'vpfixed',
    p1:{time:parseDateTime(rows[a].date),price:rows[a].close},
    p2:{time:parseDateTime(rows[b].date),price:rows[b].close},
    tfAnchor:'${ancora}', vpTfAnchor:'${ancora}', candleCount:N,
    buckets:300,barSizePct:500,upColor:'#2fbf71',downColor:'#e05252',
    _vpIndBars:true,bgEnabled:false,lvnEnabled:false,pocEnabled:false,vahEnabled:false,valEnabled:false,extendRight:false};
  const fuori={};
  for(const tf of [1,5,15]){
    currentTF=tf; rebuildRows();
    const fullTs=getRowsTimestamps();
    const r=vpFixedResolveRange(d,fullTs,rows.length-1,rows.length);
    fuori['tf'+tf]={candele:Math.abs(r.bIdx-r.aIdx)+1,
                    ore:+((d.p2.time-d.p1.time)/3600000).toFixed(1)};
  }
  return fuori;
})()`;

test("con l'ancora sul NUMERO DI CANDELE, a ogni time frame restano le stesse", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PREPARA('candles'));
    assert.deepEqual(errori, []);
    assert.equal(r.tf1.candele, 300, 'il profilo parte da 300 candele a 1 minuto: ' + JSON.stringify(r));
    assert.equal(r.tf5.candele, 300,
      'a 5 minuti devono restare 300 candele, non 60: ' + JSON.stringify(r));
    assert.equal(r.tf15.candele, 300,
      'e a 15 minuti 300, non 20 — è il difetto segnalato (misurato prima della cura: 20): '
      + JSON.stringify(r));
    // E si vede nel tempo coperto: 300 candele a 15 minuti sono 75 ore, non le 5 di prima.
    // Non è un difetto, è aritmetica: è esattamente il senso di «tieni fermo il numero».
    assert.ok(r.tf15.ore > r.tf1.ore * 10,
      'tenendo fermo il numero di candele il profilo copre più tempo (misurato: non si stava '
      + 'muovendo per niente): ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test("PROVA DI CONTROLLO: con l'ancora sul TEMPO restano le stesse ORE", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // L'altra meta' dell'interruttore, che non va cancellata: chi sceglie «il tempo» deve
    // continuare ad avere il profilo sulle stesse ore (e il numero di candele cambia: è
    // aritmetica anche questa, non un difetto).
    const r = await pagina.evaluate(PREPARA('time'));
    assert.deepEqual(errori, []);
    assert.ok(Math.abs(r.tf1.ore - r.tf5.ore) < 0.5 && Math.abs(r.tf1.ore - r.tf15.ore) < 0.5,
      'col tempo ancorato le ORE restano: ' + JSON.stringify(r));
    assert.ok(r.tf5.candele < r.tf1.candele,
      'e il numero di candele cambia di conseguenza (scelta di chi ha scelto «il tempo»): '
      + JSON.stringify(r));
  } finally { await browser.close(); }
});

test("PROVA DI CONTROLLO: le fasce (le righe del profilo) restano comunque fisse", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // La richiesta del 3-4 novembre («300 barre in verticale non possono dimezzare») è curata da
    // tempo e va tenuta verde: questa cura non deve rovinarla.
    const r = await pagina.evaluate(`(() => {
      const t0=Date.UTC(2026,9,20,8,0,0); const R=[]; let p=1900;
      for(let i=0;i<900;i++){ p+=(Math.sin(i/13)+Math.cos(i/7))*0.3;
        R.push({date:new Date(t0+i*60000).toISOString(),open:p,high:p+0.8,low:p-0.8,close:p+0.1,volume:10+(i%7)}); }
      csvLibrary=[{name:'t',rows:R}]; rebuildBaseRowsFromLibrary();
      currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD'; liveModeActive=false; liveReplayActive=false;
      const fuori={};
      for(const tf of [1,5,15]){
        currentTF=tf; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
        viewEnd=rows.length-1; idx=rows.length-1; visibleCount=80; autoFitWidth=false; followLatest=false;
        const ultime=Math.round(300/tf);
        const a=rows.length-ultime, b=rows.length-1;
        drawings=[{id:'vp1',type:'vpfixed',
          p1:{time:parseDateTime(rows[a].date),price:rows[a].close},
          p2:{time:parseDateTime(rows[b].date),price:rows[b].close},
          buckets:300,barSizePct:500,upColor:'#2fbf71',downColor:'#e05252',
          _vpIndBars:true,bgEnabled:false,lvnEnabled:false,pocEnabled:false,vahEnabled:false,valEnabled:false,extendRight:false}];
        draw();
        const barre=vpIndBarRects.get('vp1')||[];
        fuori['tf'+tf]=barre.length;
      }
      return fuori;
    })()`);
    assert.deepEqual(errori, []);
    assert.ok(r.tf1 > 50, 'il banco deve disegnare le fasce: ' + JSON.stringify(r));
    assert.equal(r.tf5, r.tf1, 'da 1 a 5 minuti le fasce sono cambiate: ' + JSON.stringify(r));
    assert.equal(r.tf15, r.tf1, 'e da 1 a 15 neanche: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test("PROVA DI CONTROLLO: chi aveva scelto «il tempo» lo tiene (la scelta viaggia col disegno)", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // Il predefinito adesso è «il numero di candele» (richiesto due volte). Questa prova controlla
    // due cose: che il nuovo predefinito si VEDA (l'elenco delle impostazioni si apre su quella
    // scelta, quando si crea un profilo nuovo) e che il cambio di predefinito non strappi la
    // scelta a chi aveva già disegnato un profilo: il valore sta nel disegno, non in un posto
    // unico da sovrascrivere.
    const r = await pagina.evaluate(`(() => {
      const sel=document.getElementById('vpTfAnchor');
      const d={id:'vp1',type:'vpfixed',p1:{time:1,price:1},p2:{time:2,price:2},tfAnchor:'time'};
      const antico={id:'vp2',type:'vpfixed',p1:{time:1,price:1},p2:{time:2,price:2}};
      return {predefinitoNuovo:sel?sel.value:null,
              sceltoTempo:_vpTfKeepTime(d), senzaScelta:_vpTfKeepTime(antico)};
    })()`);
    assert.equal(r.predefinitoNuovo, 'candles',
      'creando un profilo nuovo la scelta predefinita dev\'essere «il numero di candele» (la '
      + 'richiesta del 9 novembre): ' + JSON.stringify(r));
    assert.equal(r.sceltoTempo, true,
      'un disegno con «il tempo» scelto resta ancorato al tempo: ' + JSON.stringify(r));
    assert.equal(r.senzaScelta, true,
      'e un disegno senza scelta esplicita (fatto prima dell\'interruttore) non cambia '
      + 'comportamento: il predefinito nuovo vale solo per i profili nuovi: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
