// BANCO ROSSO — «sul grafico devono comparire SOLO le posizioni del conto MT5 attivo».
//
// DIFETTO SEGNALATO dal proprietario (10 novembre 2026): «ho aperto due posizioni, una per
// ogni account, in due account diversi... sui dispositivi mobili, tipo sul tablet, ho
// lasciato aperto il grafico, mi ha scritto sia la posizione dell'account 1 che la
// posizione dell'account 2, nello stesso grafico. E questo non deve assolutamente
// succedere.»
//
// QUESTO BANCO NON CORREGGE: misura. Mette in `positions[]` due posizioni vere di due
// conti MT5 diversi e conta quante ne arrivano a grafico (drawableOnCurrentChart, lo
// stesso filtro che usa draw()) e quante nella tabella «Posizioni aperte», in OGNI
// stato possibile della connessione. Deve fare 1 (solo la mia) in tutti; oggi fa 2
// negli stati in cui `mt5Connected` è falso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Candele EurUsd che finiscono adesso: le due posizioni stanno dentro la finestra.
const CANDELE = () => {
  const t0 = Date.now() - 300 * 60000; const R = [];
  for (let i = 0; i < 300; i++) { const t = t0 + i * 60000, p = 1.1 + Math.sin(i / 17) * 0.01;
    R.push({date: new Date(t).toISOString(), open: p, high: p + 0.0005, low: p - 0.0005, close: p, volume: 10}); }
  return R;
};

// La posizione del MIO conto (11111) e quella di un ALTRO conto (22222), stesso asset.
const DUE_POSIZIONI = () => ([
  {id: 'mia',   asset: 'EURUSD', side: 'BUY',  entry: 1.1,   lots: 0.1, mt5Ticket: 111,
   mt5Login: '11111', mt5Server: 'Broker', startTime: Date.now() - 5 * 60000, openTF: 1},
  {id: 'altrui', asset: 'EURUSD', side: 'SELL', entry: 1.105, lots: 0.2, mt5Ticket: 999,
   mt5Login: '22222', mt5Server: 'Broker', startTime: Date.now() - 5 * 60000, openTF: 1}
]);

// Gli stati in cui l'app si trova davvero: collegata, «solo posizioni» (mt5MonitorOnly,
// dopo «Disconnetti»), spenta del tutto, e duplicata che ha ereditato il flag senza conto.
// `attese` = quante posizioni DEVONO restare a grafico e in tabella.
//
// NELLO STATO 4 SONO ZERO, ed e' voluto (11 novembre 2026). La finestra duplicata nasce
// sapendo di essere collegata ma senza il numero di conto; con due posizioni in elenco e
// nessun modo di attribuirle, l'unica risposta onesta e' non mostrarne nessuna: mostrare
// «mia» sarebbe indovinare, e indovinare male significa mostrare anche quelle di un altro
// conto - cioe' il difetto segnalato dal proprietario. Il conto lo si impara in due modi
// (il polling di /account e l'annuncio della madre) e da li' in poi le posizioni giuste
// tornano: la prova qui sotto lo verifica a parte.
const STATI = [
  {nome: 'MT5 collegato sul conto 11111', collegato: true,  monitor: false, conto: '11111', attese: 1},
  {nome: 'grafico scollegato, posizioni sincronizzate (mt5MonitorOnly)', collegato: false, monitor: true, conto: '11111', attese: 1},
  {nome: 'MT5 spento del tutto', collegato: false, monitor: false, conto: '11111', attese: 1},
  {nome: 'collegato ma conto non ancora noto (finestra duplicata)', collegato: true, monitor: false, conto: null, attese: 0}
];

const IN_PAGINA = `(function(stato){
  const C=${JSON.stringify(CANDELE())};
  rows=C; baseRows=C; idx=C.length-1; viewEnd=C.length-1;
  currentAssetKey='EURUSD'; liveModeActive=true; liveReplayActive=false; fblContoVista='mt5';
  const due=${JSON.stringify(DUE_POSIZIONI())};
  positions.length=0; pendingOrders.length=0; trades.length=0;
  // LE DUE POSIZIONI DEVONO STARE DENTRO LA FINESTRA CHE L'APP DISEGNA DAVVERO (12 novembre 2026).
  // Prima avevano l'ora di apertura «cinque minuti fa», cioe' la candela 295 di 300. Ma la
  // finestra in vista non arriva fino in fondo: getViewWindow() lascia dello spazio vuoto a
  // destra (misurato qui: n=80, start=170, end=249), quindi la candela 295 e' FUORI, la freccia
  // cadeva a x=1806 su una tela larga 1234 e draw() giustamente non la dipingeva. Il banco
  // pretendeva 2 frecce e ne contava 0: sembrava un difetto dell'app, era il banco che metteva
  // la posizione dove il grafico non guarda. Adesso l'ora di apertura e il prezzo si prendono da
  // una candela IN MEZZO alla finestra vera, qualunque finestra l'app scelga.
  // LA FINESTRA LA DICHIARA IL BANCO, NON L'OROLOGIO DI CHI LO LANCIA (12 novembre 2026).
  // Verde sul PC, rosso su GitHub: la' il collaudo gira di notte in UTC, il mercato risulta
  // chiuso e - con l'autosegui acceso - getViewWindow() congela il bordo destro all'ultima
  // candela aperta (fblConfineAutosegui). La vista diventa un'altra, la posizione finisce fuori
  // e nessuna freccia viene dipinta: il banco accusava il disegno, la causa era l'ora.
  // followLatest=false significa «questa finestra l'ha scelta l'utente a mano», e in quel caso
  // l'app non congela e non allunga niente - e' scritto dentro getViewWindow stessa.
  followLatest = false;
  const _v=getViewWindow();
  const _m=Math.max(0,Math.min(C.length-1,Math.floor((_v.start+_v.end)/2)));
  const _tm=new Date(C[_m].date).getTime(), _pm=C[_m].close;
  due.forEach(p=>{ p.startTime=_tm; p.entry=(p.id==='mia')?_pm:_pm+0.0002; positions.push(p); });
  mt5Connected=!!stato.collegato; mt5MonitorOnly=!!stato.monitor;
  mt5ContoAttivo = stato.conto ? {login: stato.conto, server: 'Broker'} : null;
  if(stato.conto===null){ mt5AccountInfo=null; mt5CredsDraft=null; }
  // Cosa si vede davvero: lo stesso criterio del disegno del grafico.
  const sulGrafico = positions.filter(drawableOnCurrentChart).map(p=>p.id);
  const inTabella = positions.filter(positionBelongsToCurrentView).map(p=>p.id);
  // E cosa dipinge draw(): le frecce di apertura (una per posizione disegnata).
  const frecce=[]; const veraFreccia=window.drawTradeArrow;
  window.drawTradeArrow=function(ctx,px,py,dir,col){ frecce.push({px:px,py:py,dir:dir}); return veraFreccia.apply(this,arguments); };
  let errore=null; try{ draw(); }catch(e){ errore=String(e); }
  const frecceConLAltro=frecce.length;
  // E ADESSO LO STESSO DISEGNO SENZA la posizione dell'altro conto. Se il grafico la stava
  // dipingendo, qui le frecce calano; se la ignorava davvero, il numero non cambia.
  // Si confrontano DUE MISURE invece di pretendere un numero fisso: quante frecce costi una
  // posizione dipende da cosa e' in vista (quella dell'entrata c'e' sempre, quella del prezzo
  // di adesso solo se il suo punto cade dentro la finestra), e un numero scritto a mano in un
  // banco scade — e' gia' successo il 12 novembre, con «1 posizione = 2 frecce» diventato falso.
  frecce.length=0;
  const soloMie=positions.filter(p=>p.id!=='altrui');
  positions.length=0; soloMie.forEach(p=>positions.push(p));
  try{ draw(); }catch(e){}
  const frecceSenzaLAltro=frecce.length;
  window.drawTradeArrow=veraFreccia;
  // La tabella HTML dopo update().
  let erroreUpdate=null; try{ update(); }catch(e){ erroreUpdate=String(e); }
  const righeTabella=Array.from(document.querySelectorAll('#openPositions tr'))
    .map(r=>r.textContent.replace(/\\s+/g,' ')).join(' | ');
  return {stato:stato.nome, tag:currentMt5AccountTag(),
          sulGrafico:sulGrafico, quanteSulGrafico:sulGrafico.length,
          inTabella:inTabella, quanteInTabella:inTabella.length,
          frecceDisegnate:frecceConLAltro, frecceSenzaLAltro:frecceSenzaLAltro,
          errore:errore, erroreUpdate:erroreUpdate,
          righeTabella:righeTabella};
})`;

test('due posizioni di due conti: a grafico compare SOLO quella del conto attivo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const misure = [];
    for (const stato of STATI) {
      const r = await pagina.evaluate(`(${IN_PAGINA})(${JSON.stringify(stato)})`);
      misure.push({...r, attese: stato.attese});
      console.log('AVVISO ' + r.stato + ' -> sulGrafico=' + r.quanteSulGrafico +
        ' inTabella=' + r.quanteInTabella + ' frecce=' + r.frecceDisegnate +
        ' tag=' + JSON.stringify(r.tag));
    }
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    for (const r of misure) {
      assert.equal(r.errore, null, r.stato + ': draw() non deve lanciare');
      // In OGNI stato deve restare a grafico SOLO la posizione del conto attivo. Quando
      // `mt5Connected` e' falso il filtro per conto non viene applicato affatto
      // (positionBelongsToCurrentView, app.html:13787, ritorno a 13843-13851) e oggi misura 2.
      assert.equal(r.quanteSulGrafico, r.attese,
        r.stato + ': IL FILTRO PER CONTO MANCA (' + r.sulGrafico.join(' + ') +
        ' a grafico, ' + r.frecceDisegnate + ' frecce disegnate da draw())');
      assert.deepEqual(r.sulGrafico, r.attese ? ['mia'] : [],
        r.stato + ': a grafico devono essere SOLO le posizioni del conto attivo');
      // NIENTE NUMERI FISSI: si confronta il disegno CON la posizione dell'altro conto e quello
      // SENZA. Se il grafico la stesse dipingendo, togliendola le frecce calerebbero. Quante
      // frecce costi una posizione non e' una costante — quella dell'entrata c'e' sempre, quella
      // del prezzo di adesso solo se cade dentro la finestra — e infatti il numero scritto a
      // mano in questo banco («1 posizione = 2 frecce») era gia' diventato falso.
      assert.equal(r.frecceDisegnate, r.frecceSenzaLAltro,
        r.stato + ': togliendo la posizione dell altro conto le frecce passano da ' +
        r.frecceDisegnate + ' a ' + r.frecceSenzaLAltro + ': vuol dire che draw() la stava ' +
        'dipingendo');
    }
  } finally { await browser.close(); }
});

test('la posizione dell altro conto non entra in nessuna tabella', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    for (const stato of STATI) {
      const r = await pagina.evaluate(`(${IN_PAGINA})(${JSON.stringify(stato)})`);
      console.log('AVVISO tabella ' + r.stato + ' -> ' + r.righeTabella.slice(0, 120));
      assert.equal(r.quanteInTabella, stato.attese,
        r.stato + ': nella tabella «Posizioni aperte» devono restare solo le posizioni del ' +
        'conto attivo, oggi ' + r.quanteInTabella + ' (' + r.inTabella.join(' + ') + ')');
    }
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
  } finally { await browser.close(); }
});

// ===== IL CASO VERO: il ponte è CONDIVISO ed è finito su un altro conto =====
//
// Il ponte (bridge.py) è uno solo per computer: la pagina sul tablet, una seconda finestra,
// o il ponte dei segnali possono collegarlo a un ALTRO account mentre questa pagina è
// aperta. GET /positions allora risponde con le posizioni DI QUELL' account, e l'app le
// adotta con il tag del conto che LEI CREDE (currentMt5AccountTag(), app.html:41922):
// la posizione dell'altro conto entra in positions[] già col mio numero addosso, passa il
// filtro e finisce a grafico — esattamente il sintomo del proprietario. La fotografia non
// dice di che conto è (bridge.py:3014-3070 non Restituisce il login): l'app non può
// accorgersene, la misura è qui.
const PONTE_ALTRO_CONTO = `(async function(){
  const T0=Date.now()-300*60000; const arr=[];
  for(let i=0;i<300;i++){ const t=T0+i*60000, p=1.1+Math.sin(i/17)*0.01;
    arr.push({date:new Date(t).toISOString(),open:p,high:p+0.0005,low:p-0.0005,close:p,volume:10}); }
  rows=arr; baseRows=arr; idx=arr.length-1; viewEnd=arr.length-1;
  currentAssetKey='EURUSD'; liveModeActive=true; liveReplayActive=false; fblContoVista='mt5';
  mt5Connected=true; mt5MonitorOnly=false; mt5AttivaConto('11111','Broker',true,0);
  positions.length=0; pendingOrders.length=0; trades.length=0;
  positions.push({id:'mia',asset:'EURUSD',side:'BUY',entry:1.1,lots:0.1,mt5Ticket:111,
    mt5Login:'11111',mt5Server:'Broker',startTime:Date.now()-10*60000,openTF:1});
  // Il ponte adesso risponde per l'ALTRO conto (22222).
  const oraSec=Math.floor(Date.now()/1000);
  const foto=[{ticket:999,symbol:'EURUSD',side:'SELL',volume:0.2,price_open:1.105,sl:null,tp:null,
    price_current:1.105,bid:1.105,ask:1.1051,profit:25,swap:0,commission:0,time:oraSec,
    point:0.00001,digits:5,margine:50}];
  const vera=fetchMt5WithTimeout;
  window.fetchMt5WithTimeout=async function(path,opt,t){
    const p=String(path||'');
    // IL PONTE DICHIARA IL CONTO (11 novembre 2026, bridge.py: header X-MT5-Login/Server):
    // lo stub fa lo stesso, altrimenti misurerebbe un ponte vecchio che non esiste piu'.
    if(p.startsWith('/positions')) return {ok:true,data:foto,conto:{login:'22222',server:'Broker'}};
    if(p.startsWith('/orders')) return {ok:true,data:[]};
    if(p.startsWith('/deal_reason')) return {ok:true,data:{stillOpen:true}};
    if(p.startsWith('/account')) return {ok:true,data:{login:22222,server:'Broker',equity:10000,balance:10000,currency:'EUR',leverage:100,reale:false}};
    return vera.call(this,path,opt,t);
  };
  try{
    await fetchMt5Positions();
    var esito={
      tagCheCredevamo: currentMt5AccountTag().mt5Login,
      posizioni: positions.map(p=>({id:p.id,ticket:p.mt5Ticket,tag:p.mt5Login})),
      contiDiversiInLista: [...new Set(positions.map(p=>String(p.mt5Login)))].length,
      sulGrafico: positions.filter(drawableOnCurrentChart).length,
      inTabella: positions.filter(positionBelongsToCurrentView).length
    };
  } finally { window.fetchMt5WithTimeout=vera; }
  return esito;
})()`;

// PROVA DI CONTROLLO: con il conto NOTO la stessa fotografia di prima non e' piu' un mistero.
// Serve a dimostrare che lo stato 4 (zero righe) non e' «l'app non mostra piu' niente»: e' solo
// «non attribuisce finche' non sa». Appena il conto si conosce, la sua posizione torna a grafico.
test('PROVA DI CONTROLLO: appena il conto si conosce, la posizione giusta torna a grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      const C=${JSON.stringify(CANDELE())};
      rows=C; baseRows=C; idx=C.length-1; viewEnd=C.length-1;
      currentAssetKey='EURUSD'; liveModeActive=true; liveReplayActive=false; fblContoVista='mt5';
      const due=${JSON.stringify(DUE_POSIZIONI())};
      positions.length=0; due.forEach(p=>positions.push(p));
      mt5Connected=true; mt5MonitorOnly=false;
      mt5ContoAttivo=null; mt5AccountInfo=null; mt5CredsDraft=null;   // conto ignoto
      const prima=positions.filter(positionBelongsToCurrentView).map(p=>p.id);
      mt5AttivaConto('11111','Broker',true,0);                        // il conto si conosce
      const dopo=positions.filter(positionBelongsToCurrentView).map(p=>p.id);
      return {prima, dopo};
    })()`);
    console.log('AVVISO conto ignoto ->', JSON.stringify(r.prima), '| conto noto ->', JSON.stringify(r.dopo));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.deepEqual(r.prima, [], 'senza conto non si attribuisce nessuna posizione');
    assert.deepEqual(r.dopo, ['mia'], 'con il conto noto resta solo la posizione di quel conto');
  } finally { await browser.close(); }
});

test('una fotografia del ponte di un ALTRO conto non entra in positions[]', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PONTE_ALTRO_CONTO);
    console.log('AVVISO ponte su un altro conto =', JSON.stringify(r));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.deepEqual(r.posizioni.map(p => p.ticket), [111],
      'la posizione ticket 999 (altrui, arrivata dal ponte mentre era sull altro conto) ' +
      'non deve entrare in positions[]: entra e oggi misura ' + JSON.stringify(r.posizioni));
    assert.equal(r.sulGrafico, 1, 'a grafico deve restare solo la mia');
  } finally { await browser.close(); }
});
