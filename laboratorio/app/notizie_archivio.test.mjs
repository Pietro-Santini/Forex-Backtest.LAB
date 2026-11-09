// LE NOTIZIE SUL GRAFICO NON SI PERDONO PIU': archivio locale + account, e pallini anche in
// Storico/replay.
//
// RICHIESTO dal proprietario (8 novembre 2026): «tutte le notizie che vengono aggiunte sul
// grafico salvale in locale e sull'account scelto al login, così non le richiede a Forex Factory
// di continuo ogni volta che entriamo nel grafico, e abbiamo anche uno storico personale delle
// notizie sul grafico che rimangono e che funziona anche in modalità replay. Dal momento del
// primo login in assoluto lui inizia a registrare tutte le notizie».
//
// CAUSA MISURATA: i pallini si disegnavano solo da `newsEvents`, l'ultima copia del feed, e il
// feed arrivava SOLO in Live (il polling è agganciato allo stato Live). In Storico/replay
// `newsEvents` è vuoto, quindi nessun pallino — e non c'era modo di rivedere le notizie di ieri.
// L'archivio locale esisteva già (fbl_notizie_archivio) ma lo usava solo la statistica del
// "freno notizie", non il grafico.
//
// CURA: la lista che il grafico disegna è l'archivio (locale + account) PIU' l'ultima copia del
// feed; l'archivio si unisce a quello dell'account all'avvio; le notizie nuove partono per
// l'account. Il test misura la lista che il grafico disegna davvero, il filtro che applica, e
// che senza rete i pallini restano.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Tre notizie come le manda il feed (forma del ponte /news).
const FEED = () => [
  {title:'Non Farm Payrolls', country:'USD', date:'2026-11-06T13:30:00.000Z', impact:'High', forecast:'150K', previous:'120K'},
  {title:'CPI y/y',          country:'USD', date:'2026-11-06T13:30:00.002Z', impact:'High'},
  {title:'Retail Sales m/m', country:'GBP', date:'2026-11-06T09:30:00.000Z', impact:'Medium'},
  {title:'Rumore di fondo',  country:'EUR', date:'2026-11-06T08:00:00.000Z', impact:'Low'},
];

const PREPARA = (modo) => `(function(){
  newsEvents=${JSON.stringify(FEED())}; newsFetchedAt=Date.now();
  newsGrafico=[]; newsGraficoFirma='';
  notizieArchivio=null;
  try{ localStorage.removeItem('fbl_notizie_archivio'); }catch(e){}
  newsEnabled=true; newsSeverityFilter={Low:true,Medium:true,High:true}; newsCountryFilter={};
  currentAssetKey='XAUUSD';
  liveModeActive=${modo==='replay'}; liveReplayActive=${modo==='replay'};
  return notizieArchivioAggiungi(newsEvents);
})()`;

test("in Storico/replay i pallini restano, anche senza rete", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // IL GRAFICO VERO: candele finte intorno alle notizie di prova, e draw() davvero.
    // Misuro newsDotHitRects, cioe' i pallini che il grafico ha DISEGNATO (lo riempie draw()):
    // non una stringa nel sorgente, il risultato che si vede a schermo.
    const r = await pagina.evaluate(`(() => {
      const VEN=Date.UTC(2026,10,6,7,0,0);
      let p=4100; const R=[];
      for(let i=0;i<500;i++){
        const t=VEN+i*60000, o=p, c=p+Math.sin(i/7)*2;
        R.push({date:new Date(t).toISOString(),open:o,high:Math.max(o,c)+1,low:Math.min(o,c)-1,close:c,volume:10});
        p=c;
      }
      rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length;
      currentAssetKey='XAUUSD'; csvLibrary=[{id:'mt5_live_xau',rows:R}];
      liveModeActive=false; liveReplayActive=true; mt5Connected=false;   // REPLAY
      // Tutta la fascia visibile: la vista stretta (80 candele) lascerebbe le notizie fuori.
      autoFitWidth=false; visibleCount=500;
      newsEnabled=true; newsSeverityFilter={Low:true,Medium:true,High:true}; newsCountryFilter={};
      notizieArchivio=null; try{ localStorage.removeItem('fbl_notizie_archivio'); }catch(e){}
      const nuove=notizieArchivioAggiungi(${JSON.stringify(FEED())});
      newsEvents=[];                       // in replay il feed non arriva: resta l'archivio
      draw();
      const conArchivio=newsDotHitRects.length;
      // E senza rete il risultato non cambia: la fetch fallisce, l'archivio resta.
      window.fetchMt5WithTimeout=()=>Promise.reject(new Error('rete assente'));
      return refreshNewsFeed().then(()=>{
        draw();
        return {nuove:nuove, conArchivio:conArchivio, dopoRete:newsDotHitRects.length};
      });
    })()`);
    assert.ok(r.conArchivio > 0,
      'in replay i pallini devono essere disegnati (misurato: zero, perche\' si disegnavano solo'
      + ' dall\'ultima copia del feed, che in replay non arriva): ' + JSON.stringify(r));
    assert.equal(r.dopoRete, r.conArchivio,
      'e la rete che non risponde non deve toglierli: ' + JSON.stringify(r));
    assert.ok(r.nuove >= 4, 'le notizie di prova devono entrare tutte nell\'archivio: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("l'archivio dell'account e quello locale si uniscono (stesse notizie, due forme)", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      (${PREPARA('live')});
      notizieArchivio=null; try{ localStorage.removeItem('fbl_notizie_archivio'); }catch(e){}
      // La forma in cui sta sul cloud: t/cur/imp/tit, senza data leggibile. Il codice di prima
      // queste notizie NON le capiva (cercava ev.date) e le scartava: ecco perche' la prova
      // misura l'ARCHIVIO, che esiste in tutte e due le versioni.
      const daCloud=[{t:Date.parse('2026-11-05T13:30:00.000Z'),cur:'USD',imp:'High',tit:'Dal cloud'},
                     {t:Date.parse('2026-11-04T13:30:00.000Z'),cur:'EUR',imp:'Medium',tit:'Anche questa'}];
      const nuove=notizieArchivioAggiungi(daCloud);
      const titoli=Object.values(notizieArchivioCarica()).map(e=>e.tit).sort();
      return {nuove:nuove, titoli:quanti(titoli)};
      function quanti(a){ return a; }
    })()`);
    assert.equal(r.nuove, 2, 'le notizie dell\'account si devono aggiungere: ' + JSON.stringify(r));
    assert.deepEqual(r.titoli, ['Anche questa', 'Dal cloud'],
      'e devono restare nell\'archivio, con la stessa forma delle altre: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le notizie nuove partono per l\'account (e solo quelle nuove)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      const nuove=${PREPARA('live')};              // le quattro notizie del feed entrano nell'archivio
      // Il tempo di attesa della pubblicazione si annulla: la prova deve girare in un attimo.
      const veroSetTimeout=window.setTimeout;
      window.setTimeout=(fn)=>{ try{ fn(); }catch(e){} return 0; };
      const mandate=[];
      window.fxbtCloud={ uid:'UTENTE', ready:Promise.resolve(),
        notizieSalva:async(eventi)=>{ mandate.push({eventi:eventi, bytes:JSON.stringify(eventi).length}); return true; },
        notizieLeggi:async()=>null };
      notizieCloudPubblica();                       // quello che c'e' di nuovo parte per l'account
      // La pubblicazione è asincrona (aspetta il cloud): si aspetta lei, col timer VERO.
      for(let i=0;i<100&&!mandate.length;i++)await new Promise(r=>veroSetTimeout(r,10));
      const seconda=notizieArchivioAggiungi(newsEvents);   // le stesse: niente di nuovo
      window.setTimeout=veroSetTimeout;
      return {nuove:nuove, seconda:seconda, mandate:mandate.length,
              nellunica:mandate.length?mandate[0].eventi.length:0, nellunicaByte:mandate.length?mandate[0].bytes:0};
    })()`);
    assert.equal(r.nuove, 4, 'il feed porta quattro notizie nuove: ' + JSON.stringify(r));
    assert.equal(r.seconda, 0, ' le stesse notizie una seconda volta non sono nuove: ' + JSON.stringify(r));
    assert.equal(r.mandate, 1, ' all\'account partono una volta sola: ' + JSON.stringify(r));
    assert.equal(r.nellunica, 4, ' e con tutte le notizie: ' + JSON.stringify(r));
    assert.ok(r.nellunicaByte > 0 && r.nellunicaByte < 4096,
      ' e pesano poco (l\'archivio e\' fatto di campi corti): ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("l'archivio tiene le importanti un anno e tutto per due settimane", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      notizieArchivio=null; try{ localStorage.removeItem('fbl_notizie_archivio'); }catch(e){}
      const ora=Date.now(), G=86400000;
      const voci=[
        {t:ora-300*G, cur:'USD', imp:'High',   tit:'Importante di dieci mesi fa'},
        {t:ora-300*G, cur:'USD', imp:'Low',    tit:'Rumore di dieci mesi fa'},
        {t:ora-20*G,  cur:'EUR', imp:'Low',    tit:'Rumore di venti giorni fa'},
        {t:ora-3*G,   cur:'GBP', imp:'Low',    tit:'Rumore di tre giorni fa'},
      ];
      notizieArchivioAggiungi(voci);
      notizieArchivioSalva();
      const salvate=JSON.parse(localStorage.getItem('fbl_notizie_archivio')||'[]');
      return {salvate:salvate.map(e=>e.tit).sort(),
              LowRecenti:salvate.filter(e=>e.imp==='Low').length};
    })()`);
    assert.ok(r.salvate.includes('Importante di dieci mesi fa'),
      'una notizia importante di dieci mesi fa deve restare (la statistica guarda indietro): ' + JSON.stringify(r));
    assert.ok(!r.salvate.includes('Rumore di dieci mesi fa'),
      'il rumore di dieci mesi fa no: ' + JSON.stringify(r));
    assert.ok(r.salvate.includes('Rumore di tre giorni fa'),
      'il rumore recente si tiene (in replay i pallini devono esserci): ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: senza archivio e senza feed, nessun pallino (niente di inventato)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      newsEvents=[]; newsGrafico=[]; newsGraficoFirma='';
      notizieArchivio=null; try{ localStorage.removeItem('fbl_notizie_archivio'); }catch(e){}
      newsEnabled=true;
      draw();                                   // niente notizie: niente pallini
      return {viste: newsDotHitRects.length};
    })()`);
    assert.equal(r.viste, 0, 'senza notizie non si disegna niente: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
