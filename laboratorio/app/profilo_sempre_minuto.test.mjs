// IL PROFILO VOLUMETRICO E' SEMPRE QUELLO GENERATO AL MINUTO, A QUALUNQUE TIME FRAME.
//
// RICHIESTA DEL PROPRIETARIO (16 novembre 2026): «gli istogrammi del profilo volumetrico non
// mantengono il numero e le dimensioni fisse del time frame a 1 minuto quando cambiamo time frame
// piu' alti, se siamo a time frame 5 minuti dobbiamo sempre vedere l'istogramma generato e in
// evoluzione del time frame da 1 minuto sempre! non si deve regolare al cambio time frame ma il
// numero delle barre rimane sempre lo stesso identico.»
// E il chiarimento del 17, dopo che avevo guardato dalla parte sbagliata: «la regola riguarda solo
// gli istogrammi dei profili volumetrici e non riguarda il footprint... del footprint non va
// modificato assolutamente nulla».
//
// COME SI MISURA: stessa finestra di tempo (gli ultimi 300 minuti di mercato), stessi dati, e si
// confrontano le LUNGHEZZE delle barre disegnate a 1, 5 e 15 minuti. Se il profilo e' davvero
// quello del minuto, devono essere identiche: la differenza deve essere ~0 px.
// PRIMA DELLA CURA (misurato il 17 novembre): 53 px di differenza media a 5 minuti (peggiore 130),
// 222 px a 15 minuti (peggiore 501). Non era la "dimensione" agganciata male: erano le candele
// sbagliate. In Live lo storico arriva gia' aggregato al time frame del grafico, quindi a 5 minuti
// il profilo veniva distribuito su 12 candele da 5 minuti invece che su 60 da un minuto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// `m1Disponibile` simula quello che in uso vero fa fblSerieM1Assicura(): la serie a un minuto dello
// stesso asset presa dal magazzino o dal servizio dati. Nel banco i dati sono quelli del file, e
// quindi la serie M1 e' esattamente la stessa che genera le candele del grafico.
const MISURA = ({tf = 1, minutiProfilo = 300, m1Disponibile = true}) => `(function(){
  const t0=Date.UTC(2026,9,20,8,0,0); const R=[]; let p=1900;
  for(let i=0;i<900;i++){ p+=(Math.sin(i/13)+Math.cos(i/7))*0.3;
    R.push({date:new Date(t0+i*60000).toISOString(),open:p,high:p+0.8,low:p-0.8,close:p+0.1,volume:10+(i%7)}); }
  csvLibrary=[{name:'t',rows:R}]; rebuildBaseRowsFromLibrary();
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD'; liveModeActive=false; liveReplayActive=false;
  currentTF=${tf}; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
  // LO ZOOM DEVE ESSERE LO STESSO, o si misurerebbero due cose insieme: con 80 candele a schermo a
  // 1 minuto si vedono 80 minuti, a 15 minuti 1200. Qui a schermo c'e' sempre la stessa finestra
  // (${minutiProfilo} minuti), cioe' ${minutiProfilo}/${tf} candele: cosi' la lunghezza delle barre
  // si puo' confrontare davvero.
  viewEnd=rows.length-1; idx=rows.length-1; visibleCount=${Math.round(minutiProfilo / tf)}; autoFitWidth=false; followLatest=false;
  // La serie a un minuto che fblSerieM1PerProfilo si aspetta di trovare gia' caricata.
  if(${m1Disponibile?1:0}&&${tf}>1){ fblM1Serie={asset:'XAUUSD',rows:R,ts:fblTimestampsSerie(R)}; }
  else { fblM1Serie={asset:null,rows:null,ts:null}; }
  // La finestra e' la STESSA in tutti i casi: gli ultimi ${minutiProfilo} minuti di mercato.
  const t1=parseDateTime(baseRows[baseRows.length-1].date);
  const t0p=t1-${minutiProfilo}*60000;
  drawings=[{id:'vp1',type:'vpfixed',
    p1:{time:t0p,price:0}, p2:{time:t1,price:0},
    buckets:120,barSizePct:500,upColor:'#2fbf71',downColor:'#e05252',
    _vpIndBars:true,bgEnabled:false,lvnEnabled:false,pocEnabled:false,vahEnabled:false,valEnabled:false,extendRight:false}];
  draw();
  const barre=vpIndBarRects.get('vp1')||[];
  let piuLunga=0;
  barre.forEach(function(b){ const L=b.x2-b.x1; if(L>piuLunga)piuLunga=L; });
  const lung=barre.map(function(b){ return Math.round((b.x2-b.x1)*10)/10; });
  const a=rowIndexNearTime(t0p), b=rowIndexNearTime(t1);
  return {tf:${tf}, fasce:barre.length, piuLunga:Math.round(piuLunga), candele:(b-a+1), lung:lung, m1:${m1Disponibile?1:0}};
})()`;

function confronto(a, b) {
  let peggiore = 0, somma = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a[i] - b[i]);
    peggiore = Math.max(peggiore, d);
    somma += d;
  }
  return {peggiore: Math.round(peggiore * 10) / 10, media: Math.round((somma / Math.max(1, n)) * 10) / 10, n};
}

test('a 5 e a 15 minuti il profilo e lo stesso identico di quello a 1 minuto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const m1 = await pagina.evaluate(MISURA({tf: 1}));
    const m5 = await pagina.evaluate(MISURA({tf: 5}));
    const m15 = await pagina.evaluate(MISURA({tf: 15}));
    console.log('M1 :', JSON.stringify({fasce: m1.fasce, candele: m1.candele, piuLunga: m1.piuLunga}));
    console.log('M5 :', JSON.stringify({fasce: m5.fasce, candele: m5.candele, piuLunga: m5.piuLunga}));
    console.log('M15:', JSON.stringify({fasce: m15.fasce, candele: m15.candele, piuLunga: m15.piuLunga}));
    // La prova che conta: la forma delle barre e' la stessa.
    const d5 = confronto(m1.lung, m5.lung);
    const d15 = confronto(m1.lung, m15.lung);
    console.log('M1 vs M5 :', JSON.stringify(d5));
    console.log('M1 vs M15:', JSON.stringify(d15));
    assert.equal(m5.fasce, m1.fasce, 'il numero delle fasce non cambia col time frame');
    assert.equal(m15.fasce, m1.fasce, 'il numero delle fasce non cambia col time frame');
    assert.ok(d5.media <= 1 && d5.peggiore <= 2,
      'a 5 minuti le barre devono essere quelle del minuto (differenza media ' + d5.media + ' px, peggiore ' + d5.peggiore + ')');
    assert.ok(d15.media <= 1 && d15.peggiore <= 2,
      'a 15 minuti le barre devono essere quelle del minuto (differenza media ' + d15.media + ' px, peggiore ' + d15.peggiore + ')');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: senza la serie a un minuto il profilo torna quello del grafico', async () => {
  // Senza questa, un banco che passasse perche' non disegna niente sarebbe indistinguibile da uno
  // che passa perche' il profilo e' giusto. Qui si spegne apposta la serie M1 e si pretende che le
  // differenze TORNINO: e' il difetto che il banco sa ancora vedere.
  const {browser, pagina, errori} = await apriApp();
  try {
    const m1 = await pagina.evaluate(MISURA({tf: 1}));
    const m5 = await pagina.evaluate(MISURA({tf: 5, m1Disponibile: false}));
    const d = confronto(m1.lung, m5.lung);
    console.log('controllo, M1 vs M5 senza serie M1 :', JSON.stringify(d));
    assert.equal(m5.fasce, m1.fasce, 'le fasce restano comunque le stesse');
    assert.ok(d.media > 2 || d.peggiore > 5,
      'senza la serie a un minuto il profilo a 5 minuti DEVE discostarsi (misurato ' + d.media + ' px di media)');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
