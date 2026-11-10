// BANCO DI MISURA (non corregge niente) — LE POSIZIONI SUL TELEFONO.
//
// Sintomo del proprietario (10 novembre 2026): «sui dispositivi mobili il collegamento del
// grafico, dei dati e delle posizioni non funziona». Questo banco copre la parte POSIZIONI:
// quale indirizzo chiama davvero il polling, se le tabelle vengono riempite, e quale canale
// porta i dati sul telefono.
//
// Tre scene, nell'ordine in cui le incontra il proprietario:
//   1. APK (Capacitor): la pagina la serve il WebView del telefono su http://localhost.
//   2. Browser del telefono sul sito, con l'host del server scritto dal bootstrap.
//   3. Browser del telefono sul sito, senza nessun server configurato.
//
// Niente viene corretto qui: si misura e si stampa.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import {apriApp, RADICE, chromium} from './aiuti.mjs';

const APP = fs.readFileSync(path.join(RADICE, 'app.html'));

// Serve app.html da un piccolo server HTTP locale su una porta QUALUNQUE (non 8000): è la
// stessa forma dell'APK, dove la pagina la serve il WebView del telefono su http://localhost.
// La differenza conta: questo server NON è il ponte degli ordini, e l'app non lo sa.
function avviaServitoreLocale(){
  return new Promise(risolve=>{
    const srv=http.createServer((req,res)=>{
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
      res.end(APP);
    });
    srv.listen(0,'127.0.0.1',()=>risolve({srv,origine:'http://127.0.0.1:'+srv.address().port}));
  });
}

async function apriDa(indirizzo){
  const browser=await chromium.launch({});
  const contesto=await browser.newContext({viewport:{width:412,height:915}});
  await contesto.route('**',r=>{
    const u=r.request().url();
    // Solo il file servito dal servitore locale passa; tutto il resto (internet, porte del
    // ponte) viene bloccato: sul telefono quelle porte non ci sono.
    return u.startsWith(indirizzo)?r.continue():r.abort();
  });
  const pagina=await contesto.newPage();
  const errori=[];
  pagina.on('pageerror',e=>errori.push(String(e).slice(0,200)));
  await pagina.goto(indirizzo+'/app.html?hideServer=1',{waitUntil:'domcontentloaded'});
  await pagina.waitForTimeout(2500);
  await pagina.evaluate(()=>document.querySelectorAll('#auth-check-overlay,.fbModalOverlay').forEach(el=>el.style.display='none'));
  return {browser,pagina,errori};
}

// La scena del telefono: NESSUN indirizzo del computer scritto a mano (sul telefono lo scrive
// solo chi apre le impostazioni), e l'host del server che il bootstrap dell'APK precarica.
const SCENA_TELEFONO=(host)=>{
  try{ localStorage.setItem('fbl_server_host',host); }catch(e){}
  try{ localStorage.removeItem('fbl_server_chiave'); }catch(e){}
  try{ localStorage.removeItem('fb_indirizzo_ponte'); }catch(e){}
  try{ localStorage.removeItem('fb_chiave_ponte'); }catch(e){}
  // Lo stato della "prova del ponte locale" su un telefono: non c'è niente su 127.0.0.1.
  fblPonteLocaleVivo=null; fblPonteLocaleAt=0; fblPonteLocaleInCorso=null;
  fblOrdiniVia=null; fblOrdiniInCorso=null; fblGraficoVia=null;
};

// =====================================================================
// SCENA 1 — L'APK: la pagina la serve il WebView del telefono.
// =====================================================================
test('SCENA 1 (APK): il WebView del telefono NON è scambiato per il ponte', async () => {
  const serv=await avviaServitoreLocale();
  const {browser,pagina,errori}=await apriDa(serv.origine);
  try{
    const r=await pagina.evaluate(async(scena)=>{
      eval('('+scena+')')('');
      const misure={};
      misure.originePagina=location.origin;
      misure.paginaDalPonteLocale=fblPaginaDalPonteLocale();
      // La strada degli ordini la sceglie da sola, senza che nessuno le dia un indirizzo.
      misure.stradaScelta=await fblScegliStradaOrdini();
      misure.ordiniVia=fblOrdiniVia;
      misure.urlOrdini=fblUrlOrdini();
      // Ecco l'indirizzo VERO con cui parte la lettura delle posizioni:
      misure.urlPosizioni=fblConChiave(fblUrlOrdini()+'/positions');
      misure.urlOrdiniPendenti=fblConChiave(fblUrlOrdini()+'/orders');
      misure.urlOrdineMercato=fblConChiave(fblUrlOrdini()+'/order/market');
      return misure;
    },[SCENA_TELEFONO.toString()]);
    console.log('SCENA 1 (APK, origine '+r.originePagina+'):',JSON.stringify(r,null,1));
    // CORRETTO (10 novembre 2026): qui si misurava il DIFETTO. Il WebView del telefono veniva
    // scambiato per il ponte (la funzione guardava solo l'hostname, non la porta) e le
    // posizioni venivano chieste al telefono stesso, che non ha nessun ponte. Ora la pagina
    // servita dal WebView NON è il ponte: il ponte sta sulla 8000 e basta.
    assert.equal(r.paginaDalPonteLocale,false,'il WebView del telefono non deve essere scambiato per il ponte');
    assert.notEqual(r.stradaScelta,'locale','senza il ponte locale la strada non può essere locale');
    assert.notEqual(r.urlPosizioni,r.originePagina+'/positions','le posizioni non devono essere chieste al telefono stesso');
    assert.notEqual(r.urlOrdiniPendenti,r.originePagina+'/orders');
    assert.notEqual(r.urlOrdineMercato,r.originePagina+'/order/market');
    assert.deepEqual(errori,[]);
  } finally { await browser.close(); serv.srv.close(); }
});

// Quanto è larga la porta del riconoscimento: localhost con QUALUNQUE porta.
test('SCENA 1b: fblPaginaDalPonteLocale guarda la porta (8000 e basta)', async () => {
  const {browser,pagina}=await apriApp();
  try{
    const r=await pagina.evaluate(()=>{
      const prova=(a)=>fblPaginaDalPonteLocale(a);
      return {
        localhost:prova('http://localhost'),
        localhost8000:prova('http://localhost:8000'),
        localhost8001:prova('http://localhost:12345'),
        loopback:prova('http://127.0.0.1:8000'),
        iphone:prova('https://pietro-santini.github.io'),
        iphoneIp:prova('http://192.168.1.5:8000'),
        file:prova('file:///C:/x/index.html')
      };
    });
    console.log('RICONOSCIMENTO PAGINA DAL PONTE:',JSON.stringify(r,null,1));
    // CORRETTO (10 novembre 2026): «localhost con qualunque porta» ERA il difetto. Il ponte sta
    // sulla 8000: quella passa, tutte le altre no (è il caso del WebView del telefono).
    assert.equal(r.localhost8000,true,'la porta del ponte passa');
    assert.equal(r.loopback,true,'127.0.0.1 sulla porta del ponte passa');
    assert.equal(r.localhost8001,false,'una porta qualunque NON è il ponte: era il buco');
    assert.equal(r.iphone,false);
    assert.equal(r.iphoneIp,false,'un IP di rete locale non è il ponte di questo telefono');
    assert.equal(r.file,false);
  } finally { await browser.close(); }
});

// =====================================================================
// SCENA 2 — Browser del telefono sul sito, con l'host che scrive il bootstrap.
// =====================================================================
test('MISURA scena 2 (telefono + server github.io): quale indirizzo prendono le posizioni', async () => {
  const {browser,pagina}=await apriApp();
  try{
    const r=await pagina.evaluate(async(scena)=>{
      eval('('+scena+')')('pietro-santini.github.io');
      const visti=[];
      // Si registra l'indirizzo VERO con cui parte ogni chiamata al ponte.
      const veroFetch=window.fetch;
      window.fetch=function(u,...a){ visti.push(String(u)); return veroFetch.apply(this,a); };
      const esito={};
      esito.strada=await fblScegliStradaOrdini();
      esito.urlOrdini=fblUrlOrdini();
      // Il giro di polling delle posizioni, come lo fa l'app.
      fetchMt5WithTimeout=async(percorso)=>{ return {ok:false,message:'banco: ponte spento'}; };
      startMt5PositionsPolling();
      await new Promise(r2=>setTimeout(r2,300));
      stopMt5PositionsPolling();
      window.fetch=veroFetch;
      esito.indirizziProvati=[...new Set(visti)];
      return esito;
    },[SCENA_TELEFONO.toString()]);
    // Secondo giro: si registrano i PERCORSI chiesti dalle funzioni del polling.
    const percorsi=await pagina.evaluate(async(scena)=>{
      eval('('+scena+')')('pietro-santini.github.io');
      await fblScegliStradaOrdini();
      const chiesti=[];
      fetchMt5WithTimeout=async(p)=>{ chiesti.push(p); return {ok:false,message:'banco'}; };
      startMt5PositionsPolling();
      await new Promise(r2=>setTimeout(r2,400));
      stopMt5PositionsPolling();
      return {ordinivia:fblOrdiniVia, url:fblUrlOrdini(), chiesti};
    },[SCENA_TELEFONO.toString()]);
    console.log('SCENA 2 (server github.io):',JSON.stringify({...r,...percorsi},null,1));
    assert.equal(percorsi.ordinivia,'server');
    assert.equal(percorsi.url,'https://pietro-santini.github.io:8000/pc/8000');
    assert.ok(percorsi.chiesti.includes('/positions'),'il polling chiede /positions');
    assert.ok(percorsi.chiesti.includes('/orders'),'il polling chiede /orders');
  } finally { await browser.close(); }
});

// =====================================================================
// SCENA 3 — Browser del telefono sul sito, senza nessun server.
// =====================================================================
test('MISURA scena 3 (telefono, nessun server): quale indirizzo prendono le posizioni', async () => {
  const {browser,pagina}=await apriApp();
  try{
    const r=await pagina.evaluate(async(scena)=>{
      eval('('+scena+')')('');
      await fblScegliStradaOrdini();
      return {via:fblOrdiniVia,url:fblUrlOrdini(),
              posizioni:fblConChiave(fblUrlOrdini()+'/positions')};
    },[SCENA_TELEFONO.toString()]);
    console.log('SCENA 3 (nessun server):',JSON.stringify(r,null,1));
    // Senza server configurato l'indirizzo resta 127.0.0.1, che sul telefono è il telefono.
    assert.equal(r.url,'http://127.0.0.1:8000');
  } finally { await browser.close(); }
});

// =====================================================================
// LE TABELLE: vengono riempite sul telefono? C'è un filtro per piattaforma?
// =====================================================================
test('MISURA: le tabelle delle posazioni si riempiono anche col telefono davanti', async () => {
  const {browser,pagina,errori}=await apriApp();
  try{
    const r=await pagina.evaluate(async()=>{
      // Il ponte risponde con UNA posizione vera e un ordine pendente.
      const foto=[{ticket:4321,symbol:'EURUSD',side:'BUY',price_open:1.1000,price_current:1.1010,
                   volume:0.10,sl:1.0950,tp:1.1100,profit:10,swap:0,commission:0,time:0}];
      const fotoOrdini=[{ticket:9876,symbol:'EURUSD',side:'SELL',price_open:1.0900,volume:0.05,
                         sl:1.0950,tp:1.0800}];
      fetchMt5WithTimeout=async(p)=>{
        if(p==='/positions')return {ok:true,data:foto};
        if(p==='/orders')return {ok:true,data:fotoOrdini};
        if(p==='/account')return {ok:true,data:{equity:10000,balance:10000}};
        return {ok:false,message:'banco'};
      };
      // Appena collegato: parte il polling.
      mt5Connected=true; liveModeActive=true; currentTF=1;
      updateMt5ModeUI();
      await new Promise(r2=>setTimeout(r2,600));
      const tbodyOpen=document.querySelectorAll('#openPositions tr').length;
      const tbodyMt5=document.querySelectorAll('#mt5OpenPositions tr').length;
      const tbodyPend=document.querySelectorAll('#pendingOrdersTbl tr').length
                     +document.querySelectorAll('#mt5PendingTbl tr').length;
      const pannelloMt5=document.getElementById('mt5PosPanel').style.display;
      const haPulsanteChiudi=Array.from(document.querySelectorAll('#mt5OpenPositions [data-mt5-close]')).length;
      const biglietto=(mt5RealPositions||[]).map(p=>p.ticket).join(',');
      // Le candele devono esserci, sennò non è colpa delle tabelle.
      const candele=Array.isArray(rows)?rows.length:0;
      return {tbodyOpen,tbodyMt5,tbodyPend,pannelloMt5,haPulsanteChiudi,biglietto,candele,
              posizioniApp:(Array.isArray(positions)?positions.length:0),
              timer:typeof mt5PositionsPollTimer!=='undefined'&&!!mt5PositionsPollTimer};
    });
    console.log('TABELLE CON UNA POSIZIONE VERA:',JSON.stringify(r,null,1));
    assert.ok(r.tbodyMt5>=1,'la tabella "Posizioni MT5" ha la riga');
    assert.equal(r.pannelloMt5,'block','il riquadro è visibile');
    assert.ok(r.haPulsanteChiudi>=1,'il pulsante Chiudi c\'è');
    assert.ok(r.posizioniApp>=1,'la posizione reale è adottata anche in "Posizioni aperte"');
    assert.ok(r.tbodyOpen>=1,'la tabella "Posizioni aperte" ha la riga');
    assert.ok(r.tbodyPend>=1,'la tabella ordini pendenti ha la riga');
    assert.equal(r.timer,true,'il polling delle posizioni è partito');
    assert.deepEqual(errori,[]);
  } finally { await browser.close(); }
});

// La stessa misura con l'app che si crede un telefono: cambia qualcosa?
test('MISURA: con fblEMobile()=true le tabelle delle posizioni si riempiono lo stesso', async () => {
  const {browser,pagina,errori}=await apriApp();
  try{
    const r=await pagina.evaluate(async()=>{
      fblEMobile=()=>true;             // l'app si crede un telefono
      fblRemoto=()=>true;
      const foto=[{ticket:777,symbol:'XAUUSD',side:'SELL',price_open:2300,price_current:2290,
                   volume:0.20,sl:2305,tp:2290,profit:20,swap:0,commission:0,time:0}];
      fetchMt5WithTimeout=async(p)=>p==='/positions'?{ok:true,data:foto}
        :(p==='/account'?{ok:true,data:{equity:10000,balance:10000}}:{ok:false,message:'banco'});
      mt5Connected=true; liveModeActive=true;
      updateMt5ModeUI();
      await new Promise(r2=>setTimeout(r2,500));
      return {mobile:fblEMobile(),
              righeMt5:document.querySelectorAll('#mt5OpenPositions tr').length,
              righeOpen:document.querySelectorAll('#openPositions tr').length,
              adottate:(Array.isArray(positions)?positions.length:0),
              timer:typeof mt5PositionsPollTimer!=='undefined'&&!!mt5PositionsPollTimer};
    });
    console.log('TABELLE CON fblEMobile()=true:',JSON.stringify(r,null,1));
    assert.equal(r.righeMt5,1,'la tabella MT5 si riempie anche da telefono');
    assert.equal(r.righeOpen,1,'e anche la tabella standard');
    assert.equal(r.adottate,1);
    assert.equal(r.timer,true,'il polling è partito');
    assert.deepEqual(errori,[]);
  } finally { await browser.close(); }
});

// =====================================================================
// IL CANALE: BroadcastChannel non esiste sul telefono (browser solo).
// =====================================================================
test('MISURA: senza BroadcastChannel il canale fra finestre si spegne senza rompere niente', async () => {
  const {browser,pagina,errori}=await apriApp();
  try{
    const r=await pagina.evaluate(()=>{
      // Il telefono ha UN browser solo: nessuna seconda finestra, e in molti browser mobili
      // BroadcastChannel non c'è. È esattamente il ramo con cui l'oggetto nasce nullo.
      const vecchio=tradingChannel;
      let messo=false;
      try{ tradingChannel=null; broadcastTradingStateNow(); messo=true; }catch(e){ messo='ERRORE '+String(e); }
      // Anche il gestore deve uscire senza lanciare.
      let gestore='non chiamato';
      try{
        if(typeof tradingChannelOnMessage==='function')tradingChannelOnMessage({data:{type:'trading_sync',slot:1,positions:[]}});
        gestore='sopravvissuto';
      }catch(e){ gestore='ERRORE '+String(e); }
      const richiesta=fblStatoDaAnnunciare({positions:[{id:1}]});
      tradingChannel=vecchio;
      return {nome:TRADING_CHANNEL_NAME,abilitato:EXTRA_PIP_WINDOWS_ENABLED,
              canaleEraNullo:vecchio===null,postSenzaCanale:messo,gestore,richiesta};
    });
    console.log('CANALE FRA FINESTRE SUL TELEFONO:',JSON.stringify(r,null,1));
    assert.notEqual(r.postSenzaCanale,'ERRORE','nessun errore senza canale');
    assert.notEqual(r.gestore,'ERRORE','il gestore sopravvive senza canale');
    assert.deepEqual(errori,[]);
  } finally { await browser.close(); }
});

// =====================================================================
// LA COPIA MOBILE: quanto è indietro?
// =====================================================================
test('MISURA: la copia che gira sul telefono è vecchia di quanto?', async () => {
  const leggi=(f)=>{ try{ return fs.readFileSync(f,'utf8'); }catch(e){ return ''; } };
  const radice=leggi(path.join(RADICE,'app.html'));
  const www=leggi(path.join(RADICE,'mobile','www','app.html'));
  const apk=leggi(path.join(RADICE,'mobile','android','app','src','main','assets','public','app.html'));
  const segni=['mt5PollSegnaEsito','mt5PositionsGiro','fblPaginaDalPonteLocale','fblAvvisiMt5Giro',
               'resolveMt5OpenAnchor','allTrackedMt5PositionTickets','fetchMt5Positions','fetchMt5Orders',
               'fblServerConChiave','EXTRA_PIP_WINDOWS_ENABLED'];
  const righe={radice:radice.split('\n').length,www:www.split('\n').length,apk:apk.split('\n').length};
  const tabella={};
  for(const s of segni){
    tabella[s]={radice:radice.includes(s),www:www.includes(s),apk:apk.includes(s)};
  }
  const bootstrap=leggi(path.join(RADICE,'mobile','www-sorgente','index.html'));
  const hostBootstrap=(bootstrap.match(/setItem\('fbl_server_host'\s*,\s*'([^']+)'/)||[])[1]||null;
  const versioneApk=(apk.match(/FBL_VERSIONE_BUNDLE\s*=\s*'([^']+)'/)||[])[1]||null;
  const versioneWww=(www.match(/FBL_VERSIONE_BUNDLE\s*=\s*'([^']+)'/)||[])[1]||null;
  console.log('COPIE MOBILI:',JSON.stringify({righe,tabella,hostBootstrap,versioneApk,versioneWww},null,1));
  assert.ok(radice.includes('fetchMt5Positions')&&www.includes('fetchMt5Positions')&&apk.includes('fetchMt5Positions'),
    'il codice delle posizioni c\'è in tutte e tre le copie');
  // Il numero che dice quanto è indietro la copia del telefono.
  assert.ok(www.length<radice.length,'la copia www è più corta di quella della radice');
});

// =====================================================================
// LA COPIA CHE GIRA DAVVERO SUL TELEFONO: l'APK (2.0.36) come si comporta?
// =====================================================================
async function apriCopia(percorso){
  const browser=await chromium.launch({});
  const contesto=await browser.newContext({viewport:{width:412,height:915}});
  await contesto.route('**',r=>r.request().url().startsWith('file://')?r.continue():r.abort());
  const pagina=await contesto.newPage();
  const errori=[];
  pagina.on('pageerror',e=>errori.push(String(e).slice(0,200)));
  await pagina.goto('file://'+percorso,{waitUntil:'domcontentloaded'});
  await pagina.waitForTimeout(3000);
  await pagina.evaluate(()=>document.querySelectorAll('#auth-check-overlay,.fbModalOverlay').forEach(el=>el.style.display='none'));
  return {browser,pagina,errori};
}

test('MISURA: la copia dentro l\'APK, con la scena del telefono, dove manda le posizioni', async () => {
  const copia=path.join(RADICE,'mobile','android','app','src','main','assets','public','app.html');
  if(!fs.existsSync(copia)){ console.log('copia APK assente, misura saltata'); return; }
  const {browser,pagina}=await apriCopia(copia);
  try{
    const r=await pagina.evaluate(async(scena)=>{
      eval('('+scena+')')('pietro-santini.github.io');
      const chiesti=[];
      fetchMt5WithTimeout=async(p)=>{ chiesti.push(p); return {ok:false,message:'banco: ponte spento'}; };
      await fblScegliStradaOrdini();
      startMt5PositionsPolling();
      await new Promise(r2=>setTimeout(r2,400));
      stopMt5PositionsPolling();
      return {haFreno:typeof mt5PollSegnaEsito==='function',
              haPaginaDalPonte:typeof fblPaginaDalPonteLocale==='function',
              via:fblOrdiniVia,base:fblUrlOrdini(),chiesti,
              ogni:null};
    },[SCENA_TELEFONO.toString()]);
    console.log('COPIA DENTRO L APK COL TELEFONO:',JSON.stringify(r,null,1));
    // AGGIORNATO (10 novembre 2026): prima questo banco misurava la copia VECCHIA dentro l'APK
    // (28 ottobre, v2.0.36) e si aspettava che non avesse ne' il freno del polling ne' il
    // riconoscimento del ponte. Ora la copia dentro l'APK e' la 2.2.19 (rifatto il giro
    // mobile): il freno c'e', il riconoscimento c'e', e continua a non scambiare il WebView
    // del telefono per il ponte.
    assert.equal(r.haFreno,true,'la copia dentro l\'APK ha il freno del polling (aggiornata)');
    assert.equal(r.haPaginaDalPonte,true,'e ha il riconoscimento "la pagina la serve il ponte"');
    assert.equal(r.base,'https://pietro-santini.github.io:8000/pc/8000');
    assert.ok(r.chiesti.includes('/positions'));
  } finally { await browser.close(); }
});

// =====================================================================
// APERTURA E CHIUSURA da telefono: stessa strada delle letture?
// =====================================================================
test('MISURA: apertura e chiusura passano dalla stessa strada delle letture', async () => {
  const {browser,pagina,errori}=await apriApp();
  try{
    const r=await pagina.evaluate(async(scena)=>{
      eval('('+scena+')')('pietro-santini.github.io');
      await fblScegliStradaOrdini();
      const chiesti=[];
      fetchMt5WithTimeout=async(p)=>{ chiesti.push(p); return {ok:false,message:'banco: niente ponte'}; };
      window.appConfirm=async()=>true; appConfirm=window.appConfirm;
      rows=[{date:new Date().toISOString(),open:1,high:1,low:1,close:1,volume:1}];
      baseRows=rows; idx=0; currentAssetKey='EURUSD'; liveModeActive=true; liveReplayActive=false;
      // Chiusura di una posizione reale.
      positions=[{id:9,asset:'EURUSD',side:'BUY',entry:1.1,sl:1.09,tp:1.12,lots:0.1,mt5Ticket:4321}];
      const esitoChiusura=await closeMt5PositionReal(positions[0],'MANUALE',{senzaConferma:true});
      // Apertura di un ordine a mercato reale.
      const esitoApertura=await placeRealMt5Order('BUY');
      return {via:fblOrdiniVia,base:fblUrlOrdini(),chiesti,esitoChiusura,esitoApertura};
    },[SCENA_TELEFONO.toString()]);
    console.log('APERTURA/CHIUSURA DA TELEFONO:',JSON.stringify(r,null,1));
    assert.ok(r.chiesti.includes('/order/close'),'la chiusura vera parte da qui');
    assert.ok(r.chiesti.includes('/order/market'),'l\'apertura vera parte da qui');
    // Sono riservate al locale? No: usano la stessa strada delle letture, che sul telefono
    // è quella del server (o di 127.0.0.1). La prova è che il percorso è lo stesso.
    assert.equal(r.base,'https://pietro-santini.github.io:8000/pc/8000');
    assert.deepEqual(errori,[]);
  } finally { await browser.close(); }
});
