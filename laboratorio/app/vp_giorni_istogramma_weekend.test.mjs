// IL PROFILO VOLUMETRICO GIORNALIERO: "5 ISTOGRAMMI NEL PASSATO" DEVONO ESSERE 5, NON 3.
//
// SEGNALATO DAL PROPRIETARIO (10 novembre 2026): «se oggi è martedì 10 novembre 2026 e metto 5
// istogrammi nel passato, quello di domenica e quello di sabato per il Forex o XAUUSD non sono
// stati caricati — non c'è stato mercato. Lui conta uguale il giorno di domenica e sabato, e
// quindi fa vedere l'istogramma di martedì, quello di lunedì e quello di venerdì: in totale SOLO
// 3 istogrammi. Invece deve capire che domenica e sabato non li deve prendere in considerazione,
// e quindi mostrare martedì, lunedì, venerdì, giovedì e mercoledì.»
//
// Cioè: il numero chiesto è il numero di GIORNI CON MERCATO, non la larghezza della finestra di
// calendario. Questo banco costruisce candele solo sui giorni feriali (il weekend non esiste, come
// per XAUUSD) e conta quanti istogrammi escono davvero.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Candele di 1 minuto dalle 11:00 alle 15:00 UTC (a Roma è già il giorno dopo solo in estate;
// a novembre Roma è UTC+1, quindi il giorno resta quello: nessuna candela scivola di giorno).
// I giorni sono scelti uno per uno, saltando il weekend: il 2026-10-31 e il 2026-11-01 sono
// sabato e domenica e NON generano candele, come per il Forex.
const GIORNI = ['2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-11-02','2026-11-03',
                '2026-11-04','2026-11-05','2026-11-06','2026-11-09','2026-11-10'];

const PREPARA = (giorni, giorniRichiesti) => `(function(){
  const giorni=${JSON.stringify(giorni)};
  const R=[];
  giorni.forEach(g=>{
    const d=new Date(g+'T11:00:00.000Z').getTime();
    for(let m=0;m<240;m++){
      const t=d+m*60000, p=1900+Math.sin(m/9)*3;
      R.push({date:new Date(t).toISOString(),open:p,high:p+0.6,low:p-0.6,close:p+0.15,volume:10+(m%5)});
    }
  });
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; currentAssetKey='XAUUSD';
  const ind={id:'b1',key:'vp_daily',params:{days:${giorniRichiesti},groupDays:1,hiddenKeys:[]}};
  const istanze=vpIndIstanzeCalcola(ind);
  const etichette=istanze.map(x=>x.label);
  // Misura anche il livello "grafico": quanti istogrammi virtuali vengono davvero costruiti.
  const ts=getRowsTimestamps(), t0=ts[0], t1=ts[ts.length-1];
  const geo={pad:{l:0,r:0},rect:{width:1200},
    xFromTime:t=>10+(t-t0)/(t1-t0)*1180,
    y:p=>500-((p-1895)/10)*500};
  activeIndicators=[Object.assign({},ind,{params:{days:${giorniRichiesti},groupDays:1,hiddenKeys:[],style:{}}})];
  let disegni=[];
  try{ disegni=buildVpIndicatorVirtualDrawings(geo).filter(d=>d._vpIndBars); }catch(e){ disegni=[]; }
  return {nIstanze:istanze.length, etichette, nDisegni:disegni.length, ultimaCandela:R[R.length-1].date};
})()`;

test('profilo giornaliero: con 5 istogrammi chiesti escono 5 giorni di mercato (non 3)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PREPARA(GIORNI, 5));
    const msg = 'attesi 5 istogrammi, trovati ' + r.nIstanze + ' (' + r.etichette.join(' | ') + ')';
    assert.equal(r.nIstanze, 5, msg);
    assert.deepEqual(r.etichette,
      ['Giorno 04/11','Giorno 05/11','Giorno 06/11','Giorno 09/11','Giorno 10/11'],
      'gli istogrammi devono essere gli ultimi 5 giorni CON DATI, in ordine');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('profilo giornaliero: il filtro dei giorni tocca anche il livello del grafico (disegni virtuali)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PREPARA(GIORNI, 5));
    assert.equal(r.nDisegni, 5,
      'il grafico deve mostrare 5 istogrammi, ne mostra ' + r.nDisegni);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// Il difetto non è solo con 5: è la finestra di CALENDARIO. Chiedendo 3 giorni con il weekend in
// mezzo (venerdì, sabato, domenica, lunedì, martedì) la finestra arriva solo a venerdì e quindi
// escono 2 istogrammi, non 3. Con 7 la finestra è tanto larga da coprire comunque il weekend, ed
// è per questo che il difetto non si vedeva tutti i giorni: dipende da dove casca il weekend.
const CONTEGGIO = (giorni) => `(function(){
  const giorni=${JSON.stringify(giorni)};
  const R=[];
  giorni.forEach(g=>{ const d=new Date(g+'T11:00:00.000Z').getTime();
    for(let m=0;m<240;m++){ const t=d+m*60000, p=1900+Math.sin(m/9)*3;
      R.push({date:new Date(t).toISOString(),open:p,high:p+0.6,low:p-0.6,close:p+0.15,volume:10+(m%5)}); } });
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; currentAssetKey='XAUUSD';
  const fuori={};
  for(let n=1;n<=7;n++){
    const ind={id:'c'+n,key:'vp_daily',params:{days:n,groupDays:1,hiddenKeys:[]}};
    fuori[n]=vpIndIstanzeCalcola(ind).length;
  }
  return fuori;
})()`;

test('profilo giornaliero: ogni valore di "istogrammi nel passato" dà esattamente quel numero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(CONTEGGIO(GIORNI));
    for(let n=1;n<=7;n++){
      assert.equal(r[n], n,
        'con '+n+' istogrammi chiesti ne escono '+r[n]+' — il weekend viene contato come giorno di mercato');
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
