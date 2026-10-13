// REPLAY IN LIVE (richiesto esplicitamente): "tornare indietro nel tempo" in Live scegliendo un
// punto (trascinando il grafico o digitando giorno/ora), con le candele live che continuano ad
// arrivare in background ma NON vengono stampate finché si è in replay; le posizioni aperte
// spariscono dal grafico e riappaiono rivelate mano a mano che il replay avanza, con l'andamento
// del profitto fino al punto corrente; tutte le operazioni e gli indicatori si costruiscono passo
// passo come nel backtest.
//
// Cosa verificano questi test:
//  1. la barra 🔁 Replay è visibile solo in Live e il tasto ⏹ STOP compare solo durante replay/
//     scelta del punto;
//  2. avviare il replay congela masterTime/idx sul punto scelto; uscire (STOP) riporta in diretta;
//  3. in Live, evaluate() restano SEMPRE agganciate all'ultima candela VERA (scelta esplicita:
//     SL/TP continuano in background), mai al punto di replay;
//  4. si avanza candela per candela con forward(); arrivati all'ultima candela si esce da soli;
//  5. guardia di riga: i 5 punti che in Live riporterebbero masterTime all'ultima candela sono
//     tutti protetti da liveReplayActive (senza di questi ogni risincronizzazione butterebbe via
//     il replay durante un rollover);
//  6. durante il replay le posizioni REALI aperte spariscono dal grafico, i trade rivelati
//     mostrano la ricostruzione dei livelli (entry/TP/SL da bordo a bordo) e in diretta le chiuse
//     tornano nascoste (interruttore spento di default);
//  7. col PLAY in corso dentro il replay-Live si riserva la colonna extra a destra dove la
//     candela si forma (era il bug "in replay Live il PLAY non aggiorna la candela": lo spazio
//     non c'era e il corpo della candela veniva ritagliato dal clip), e il conto alla rovescia
//     della candela scorre col MOLTIPLICATORE di velocita' invece che con l'orologio vero.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {apriApp} from './aiuti.mjs';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');

// Le stesse tre candele m1 usate DENTRO la pagina (là la funzione Node non esiste).
const TRE_CANDELE = [
  {date:'2026-10-08T09:00:00.000Z',open:100,high:101,low:99, close:100,volume:5},
  {date:'2026-10-08T09:01:00.000Z',open:100,high:102,low:98, close:99, volume:6},
  {date:'2026-10-08T09:02:00.000Z',open:99, high:99, low:90, close:92, volume:7}
];
const TRE_CANDELE_JS = JSON.stringify(TRE_CANDELE);

test('1) la barra Replay è di Live; ⏹ STOP compare solo durante replay/scelta del punto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const viso=(id)=>{
        const el=document.getElementById(id);
        if(!el)return false;
        const cs=getComputedStyle(el);
        if(cs.display==='none'||cs.visibility==='hidden')return false;
        return el.offsetParent!==null || el.getClientRects().length>0;
      };
      liveModeActive = true;
      updateLiveModeUI();            // mostra la barra Replay
      const inLive = {
        barra  : viso('liveReplayBar'),
        replay : viso('liveReplayBtn'),
        stop   : !viso('liveReplayStopBtn'),
      };
      avviaSelezioneReplayLive();    // inizia la "scelta del punto"
      const inScelta = {
        stop      : viso('liveReplayStopBtn'),
        replay    : !viso('liveReplayBtn'),
        selecting : liveReplaySelecting,
      };
      esciReplayLive();              // annulla la scelta
      const annullato = {
        stop   : !viso('liveReplayStopBtn'),
        replay : viso('liveReplayBtn'),
      };
      liveModeActive = false;
      updateLiveModeUI();            // in Storico la barra sparisce
      const inStorico = {
        barra  : !viso('liveReplayBar'),
        replay : !viso('liveReplayBtn'),
      };
      return {inLive, inScelta, annullato, inStorico};
    });
    assert.deepEqual(r.inLive, {barra:true, replay:true, stop:true}, 'in Live: barra e Replay visibili, STOP nascosto');
    assert.deepEqual(r.inScelta, {stop:true, replay:true, selecting:true}, 'in scelta punto: STOP visibile, Replay nascosto');
    assert.deepEqual(r.annullato, {stop:true, replay:true}, 'annullando la scelta: STOP nascosto, Replay visibile');
    assert.deepEqual(r.inStorico, {barra:true, replay:true}, 'in Storico la barra Replay non esiste');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('2) avviaReplayLive congela il punto; STOP (esciReplayLive) torna in diretta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((JS) => {
      const R = JSON.parse(JS);
      const vedi=(id)=>['none',''].includes(getComputedStyle(document.getElementById(id)).display)?false:true;
      currentTF = 1; liveModeActive = true;
      currentAssetKey = 'TESTX';
      baseRows = R; rows = R; idx = 2; viewEnd = 2;
      masterTime = closeTimeOf(R[2]);
      slTpScanDoneForAsset = 'TESTX';
      avviaReplayLive(parseDateTime(R[0].date));
      const durante = {
        active : liveReplayActive,
        idx    : idx,
        masterTime : masterTime,
        viewEnd : viewEnd,
        followLatest : followLatest,
        stop : vedi('liveReplayStopBtn'),
        frecce : vedi('pipHistBackBtn') && getComputedStyle(document.getElementById('pipHistBackBtn').parentElement).display==='flex',
        rigaAvanti : getComputedStyle(document.getElementById('replayControlsRow')).display==='grid',
      };
      esciReplayLive();
      const dopo = {
        active : liveReplayActive,
        idx    : idx,
        allUltima : masterTime === closeTimeOf(baseRows[baseRows.length-1]),
        idxUltima : idx === baseRows.length-1,
      };
      return {durante, dopo};
    }, TRE_CANDELE_JS);
    assert.deepEqual(r.durante, {
      active:true, idx:0, masterTime:Date.parse(TRE_CANDELE[0].date), viewEnd:0,
      followLatest:true, stop:true, frecce:true, rigaAvanti:true
    }, 'il replay si ancora al punto scelto e mostra i comandi');
    assert.deepEqual(r.dopo, {active:false, idx:2, allUltima:true, idxUltima:true},
                     'STOP riporta all\'ultima candela vera');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('3) in Live, SL/TP restano sull\'ultima candela VERA anche durante il replay', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((JS) => {
      const R = JSON.parse(JS);
      currentTF = 1; liveModeActive = true;
      currentAssetKey = 'TESTX';
      baseRows = R; rows = R; idx = 2; viewEnd = 2;
      masterTime = closeTimeOf(R[2]);
      slTpScanDoneForAsset = 'TESTX';
      positions = [];
      avviaReplayLive(parseDateTime(R[0].date));   // il grafico è sul passato (idx 0, low=99)
      // Posizione BUY con SL a 95: la candela del replay (low 99) NON lo tocca, l'ultima vera sì.
      positions = [{id:'p1', asset:'TESTX', side:'BUY', entry:100, sl:95, tp:200, lots:0.1,
                    mt5Ticket:null, startTime:parseDateTime(R[1].date), start:1}];
      const chiusure = [];
      closeTrade = (result, price, pos) => { chiusure.push({result, price}); positions = positions.filter(p=>p!==pos); };
      evaluate();
      return {
        chiusi : chiusure,
        ancoraAperte : positions.length,
        idxRestato : idx,               // il replay NON deve essersi mosso
      };
    }, TRE_CANDELE_JS);
    assert.deepEqual(r.chiusi, [{result:'SL', price:95}], 'SL scatta sulla candela VERA durante il replay');
    assert.equal(r.ancoraAperte, 0, 'la posizione si chiude in background');
    assert.equal(r.idxRestato, 0, 'il punto di replay non si muove mentre lo SL lavora in background');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('4) avanza candela per candela e all\'ultima candela esce da solo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((JS) => {
      const R = JSON.parse(JS);
      currentTF = 1; liveModeActive = true;
      currentAssetKey = 'TESTX';
      baseRows = R; rows = R; idx = 2; viewEnd = 2;
      masterTime = closeTimeOf(R[2]);
      slTpScanDoneForAsset = 'TESTX'; positions = [];
      avviaReplayLive(parseDateTime(R[0].date));
      forward();                                   // → candela 1
      const prima = {idx, active: liveReplayActive};
      forward();                                   // → candela 2 = ultima → esce da solo
      const dopo = {idx, active: liveReplayActive, allUltima: masterTime===closeTimeOf(baseRows[baseRows.length-1])};
      return {prima, dopo};
    }, TRE_CANDELE_JS);
    assert.deepEqual(r.prima, {idx:1, active:true}, 'un passo avanti = una candela, sempre in replay');
    assert.deepEqual(r.dopo, {idx:2, active:false, allUltima:true}, 'all\'ultima candela si esce da soli');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('5) guardie anti-reset del replay presenti nei 5 punti critici', () => {
  // Senza questi guard, ad ogni risincronizzazione live (rollover di candela, riconnessione,
  // ricarica storico) masterTime tornerebbe all'ultima candela e il replay verrebbe buttato via.
  const conta = (s)=>APP.split(s).length-1;
  assert.ok(conta('if(!liveReplayActive)masterTime=baseRows.length?closeTimeOf(baseRows[baseRows.length-1]):null;')===3,
            'i 3 caricatori (Capital/MT5/Binance) non devono spostare masterTime durante il replay');
  assert.ok(APP.includes('if(!liveReplayActive&&(followLatest||liveModeActive))masterTime=closeTimeOf(baseRows[baseRows.length-1]);'),
            'applyLivePriceToChart non deve riportare al presente durante il replay');
  assert.ok(APP.includes('if(!liveReplayActive)masterTime=closeTimeOf(baseRows[baseRows.length-1]); // in Live sempre'),
            'il tick-guardiano non deve riportare al presente durante il replay');
  assert.ok(APP.includes('const liveMargin=(liveModeActive&&!liveReplayActive)?n*LIVE_FUTURE_MARGIN_FRACTION:0;'),
            'niente spazio futuro a destra durante il replay');
  assert.ok(conta('liveModeActive?rows[rows.length-1]:rows[idx]')===3,
            'evaluate, checkPendingOrders e checkAlarmLines usano l\'ultima candela vera in Live');
  assert.ok(APP.includes('function updateLiveReplayUI(){'), 'esiste updateLiveReplayUI');
  assert.ok(APP.includes('id="liveReplayBar"'), 'la barra Replay è nel markup');
  // --- aggiunte: le altre cose che in replay NON devono inseguire il presente ---
  assert.ok(APP.includes('const replaySlot=(followLatest&&timer&&(!liveModeActive||liveReplayActive)&&idx<rows.length-1)?1:0;'),
            'la colonna extra della candela in formazione serve anche nel replay-Live');
  assert.ok(APP.includes('try{ return !liveReplayActive && cobSvpEnabledNow()'),
            'COB e SVP (book e profilo di adesso) restano spenti durante il replay');
  // I due timer da 1 secondo (Capital.com e MT5) non devono ridisegnare durante il replay: senza
  // le graffe, draw() restava FUORI dall'if e i pannelli tornavano a inseguire il presente.
  assert.ok((APP.split('if(!liveReplayActive){ update(); draw(); }').length-1)>=2,
            'i timer da 1 s non devono aggiornare/ridisegnare durante il replay (graffe comprese)');
  assert.ok(!/if\(!liveReplayActive\)update\(\);draw\(\);/.test(APP),
            'nessun timer deve avere draw() fuori dalla guardia del replay');
  assert.ok(APP.includes('function posRevealedInReplay(pos){'),
            'una posizione reale si mostra solo quando il replay ha raggiunto la sua apertura');
});

test('6) in replay: posizioni reali nascoste, trade rivelati con ricostruzione livelli', async () => {
  // RICHIESTE ESPLICITE:
  //  - in modalità replay le posizioni REALI ancora aperte spariscono dal grafico (linee,
  //    etichette target/stop/stop profit, caselle e P/L) e riappaiono solo tornando in diretta;
  //  - i trade rivelati dal replay (apertura raggiunta: openIdx<=idx) mostrano la ricostruzione
  //    del posizionamento: le linee orizzontali dei loro livelli (entry, TP, SL / Stop Profit),
  //    da bordo a bordo, come chiesto per il "riavvolgimento".
  //  - le orizzontali dei trade chiusi NON dipendono dall'interruttore "posizioni chiuse" durante
  //    il replay; in diretta (interruttore spento di default) spariscono e le chiuse non si vedono.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((JS) => {
      const R = JSON.parse(JS);
      // Conteggio delle righe orizzontali che attraversano TUTTO il grafico (bordo sinistro →
      // bordo destro, a y costante): il metodo usato per le righe di prezzo negli altri test.
      const proto = CanvasRenderingContext2D.prototype;
      const vM = proto.moveTo, vL = proto.lineTo, vS = proto.stroke;
      let ultimo = null, intere = 0, larghezza = 0;
      const righe = [];
      proto.moveTo = function (x, y) { ultimo = {x1: x, y1: y}; return vM.apply(this, arguments); };
      proto.lineTo = function (x, y) { if (ultimo) { ultimo.x2 = x; ultimo.y2 = y; } return vL.apply(this, arguments); };
      proto.stroke = function () {
        if (ultimo && ultimo.x2 != null && Math.abs(ultimo.y1 - ultimo.y2) < 0.5
            && ultimo.x1 < 25 && (ultimo.x2 - ultimo.x1) > larghezza * 0.9) {
          intere++;
          righe.push({y1: Math.round(ultimo.y1 * 10) / 10, x1: Math.round(ultimo.x1), x2: Math.round(ultimo.x2),
                      a: this.globalAlpha, c: String(this.strokeStyle || '')});
        }
        ultimo = null;
        return vS.apply(this, arguments);
      };
      let righeVuoto = [], righeLivelli = [], righeAperta = [], righeDiretta = [];
      const conta = (tag) => {
        intere = 0; righe.length = 0;
        draw();
        if (tag === 'V') righeVuoto = righe.slice();
        if (tag === 'L') righeLivelli = righe.slice();
        if (tag === 'A') righeAperta = righe.slice();
        if (tag === 'D') righeDiretta = righe.slice();
        return intere;
      };

      currentTF = 1; liveModeActive = true;
      currentAssetKey = 'TESTX'; if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'TESTX';
      baseRows = R; rows = R; idx = 2; viewEnd = 2;
      masterTime = closeTimeOf(R[2]); slTpScanDoneForAsset = 'TESTX';
      larghezza = (document.getElementById('chart').clientWidth || 800) - 40;
      positions = []; active = null; trades = [];

      avviaReplayLive(parseDateTime(R[0].date));   // il grafico è sul passato: idx = 0
      // Scala verticale fissa e nota (97–103): così i 3 livelli scelti del trade rivelato stanno
      // tutti dentro il range e il test è deterministico (l'auto-fit del replay, altrimenti,
      // apre una finestra ~±1.1 attorno al prezzo che taglia fuori i livelli più lontani).
      followLatest = false; viewPriceLo = 97; viewPriceHi = 103; priceZoomFactor = 1;
      const vuoto = conta('V');

      // Trade CHIUSO nel passato (09:00 → 09:02) la cui apertura è già stata raggiunta dal
      // replay (openIdx 0 <= idx 0): si vedono i 3 livelli ricostruiti (entry, TP, SL).
      const t0 = parseDateTime(R[0].date), t2 = parseDateTime(R[2].date);
      trades = [{id: 'T1', asset: 'TESTX', side: 'BUY', mode: 'live', mt5Ticket: null,
                 entry: 100, exit: 100.2, sl: 99.5, tp: 101.5, rrSl: 99.5, lots: 0.1, result: 'Loss',
                 pips: 10, pl: 10, pct: 0.5, account: 1000, strategy: '',
                 startTime: t0, closedAt: new Date(t2).toISOString()}];
      const livelli = conta('L');

      // Posizione APERTA reale (same scala, entry 100.5 dentro la zoom): durante il replay
      // NON deve comparire, quindi la lista delle righe nuove resta identica a quella dei soli
      // livelli rivelati. SL/TP messi fuori portata (80/200) così l'eventuale evaluate() di
      // STOP non la chiude.
      positions = [{id: 'P1', asset: 'TESTX', side: 'BUY', entry: 100.5, sl: 80, tp: 200, rrSl: 80,
                    lots: 0.1, start: 1, startTime: t0 + 60000, marginUsed: 10}];
      const conAperta = conta('A');

      esciReplayLive();                    // STOP: si torna in diretta
      // In diretta ri-fissa la scala (98–103, così l'entry dell'aperta, 100.5, rientra a schermo)
      // perché esciReplayLive riattiva followLatest e l'auto-fit la rifarebbe da sé.
      followLatest = false; viewPriceLo = 98; viewPriceHi = 103; priceZoomFactor = 1;
      const inDiretta = conta('D');   // l'aperta torna (riga di entrata), le chiuse (interruttore off) no

      proto.moveTo = vM; proto.lineTo = vL; proto.stroke = vS;
      const kw = (r) => r.y1 + '|' + r.a + '|' + r.c;
      const diff = (A, B) => B.filter(b => !A.some(a => kw(a) === kw(b))).map(kw);
      return {
        extraL: diff(righeVuoto, righeLivelli),
        extraA: diff(righeVuoto, righeAperta),
        extraD: diff(righeVuoto, righeDiretta),
      };
    }, TRE_CANDELE_JS);
    // extraL: righe piene NUOVE (y+alpha+colore) rispetto al grafico vuoto. La ricostruzione
    // disegna le 3 linee dei livelli (entry, TP, SL) con alpha 0.6 e i suoi colori → ognuna è
    // una riga distinta; la griglia di prezzo ha alpha/colori diversi e non interferisce.
    assert.equal(r.extraL.length, 3,
      'il trade rivelato mostra la ricostruzione: entry, TP e SL da bordo a bordo. extraL=' + JSON.stringify(r.extraL));
    assert.ok(r.extraL.some(k => k.includes('#2fbf71')),
      'tra i livelli ricostruiti c\'è anche la linea del TP (verde): ' + JSON.stringify(r.extraL));
    assert.ok(r.extraL.some(k => k.includes('#3b82f6')),
      'tra i livelli ricostruiti c\'è anche la linea dell\'entry (blu): ' + JSON.stringify(r.extraL));
    assert.equal(r.extraA.length, r.extraL.length,
      'durante il replay la posizione REALE aperta non aggiunge nessuna riga (restano solo i livelli rivelati): extraA=' + JSON.stringify(r.extraA));
    assert.equal(r.extraD.length, 1,
      'tornati in diretta, della posizione aperta resta la sua riga di entrata (le chiuse, interruttore spento, spariscono del tutto): extraD=' + JSON.stringify(r.extraD));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
test('7) col PLAY in replay-Live: colonna extra per la candela in formazione e countdown col moltiplicatore', async () => {
  // RICHIESTE ESPLICITE, nate da due difetti visti dal proprietario:
  //  - "in REPLAY LIVE il tasto PLAY non aggiorna la candela": lo spazio a destra dove la candela
  //    si forma veniva riservato solo in Storico, quindi in replay-Live la candela in formazione
  //    (indice idx+1) cadeva oltre il bordo dell'area di disegno e il clip la tagliava via. Si
  //    vedeva muoversi solo l'etichetta sull'asse (che sta fuori dal clip), non il corpo.
  //  - il conto alla rovescia della candela deve scorrere col MOLTIPLICATORE di velocità: a 10x
  //    scende di 10 secondi per ogni secondo vero, come la candela che si forma.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((JS) => {
      const R = JSON.parse(JS);
      currentTF = 1; liveModeActive = true;
      currentAssetKey = 'TESTX';
      baseRows = R; rows = R; idx = 2; viewEnd = 2;
      masterTime = closeTimeOf(R[2]);
      slTpScanDoneForAsset = 'TESTX'; positions = [];
      avviaReplayLive(parseDateTime(R[0].date));   // idx 0, followLatest true, viewEnd 0
      const fermo = getViewWindow();               // PLAY non premuto: nessuna colonna extra
      timer = setInterval(() => {}, 1000000);      // PLAY in corso (il loop vero non serve)
      const inPlay = getViewWindow();
      // Il conto alla rovescia: 1 minuto per candela (TF 1), 10 secondi già consumati → 0:50.
      replayForm = {idx: 1, sub: 10, path: [], fp: {}, vol: 0};
      const a10 = fmtCandleCountdown();
      replayForm = {idx: 1, sub: 0, path: [], fp: {}, vol: 0};
      const a0 = fmtCandleCountdown();
      replayForm = {idx: 1, sub: 60, path: [], fp: {}, vol: 0};
      const aFine = fmtCandleCountdown();
      replayForm = null;
      const senzaFormazione = fmtCandleCountdown();
      clearInterval(timer); timer = null;
      return {fermo: {end: fermo.end, dataEnd: fermo.dataEnd},
              inPlay: {end: inPlay.end, dataEnd: inPlay.dataEnd},
              a10, a0, aFine, senzaFormazione, perBar: replaySecondsPerBar()};
    }, TRE_CANDELE_JS);
    assert.equal(r.fermo.end, 0, 'senza PLAY il bordo destro resta sulla candela del replay');
    assert.equal(r.inPlay.end, 1, 'col PLAY si riserva UNA colonna extra: è lì che la candela si forma');
    assert.equal(r.fermo.dataEnd, 0, 'nessuna candela vera in più viene mostrata');
    assert.equal(r.inPlay.dataEnd, 0, 'nemmeno col PLAY: lo spazio è vuoto, non è una candela rivelata');
    assert.equal(r.perBar, 60, 'su TF 1 una candela vale 60 secondi di replay');
    assert.equal(r.a10, '0:50', '10 secondi consumati sui 60 → manca 0:50');
    assert.equal(r.a0, '1:00', 'appena nata la candela manca un minuto intero');
    assert.equal(r.aFine, '0:00', 'a fine candela il conto arriva a zero, non va negativo');
    assert.equal(r.senzaFormazione, '1:00', 'senza candela in formazione si mostra la durata piena');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
