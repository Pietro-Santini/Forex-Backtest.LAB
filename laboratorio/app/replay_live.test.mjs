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
//     il replay durante un rollover).
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
});