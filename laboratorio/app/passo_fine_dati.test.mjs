// LA FINESTRA CHE FINISCE I SUOI DATI ESCE E LASCIA AVANZARE LE ALTRE.
//
// MISURATO il 16 novembre 2026: `fblReplayPasso` aveva un tetto in avanti
// (`if(t>ultimaT)t=ultimaT`). Quando la finestra che preme e' gia' sull'ultima sua candela, l'istante
// veniva riportato indietro all'ultima candela: la finestra **restava immobile** (ne' avanzava ne'
// usciva) e annunciava quell'istante, quindi **le altre non si muovevano**. Il replay condiviso si
// bloccava senza dire niente, ed e' esattamente il sintomo che il proprietario chiama «si ferma».
//
// LA REGOLA (16 novembre): una finestra senza piu' dati **esce da sola, in silenzio**, e le altre
// continuano. Il ramo che la fa uscire c'era gia' in `fblReplayApplicaIstante`; mancava solo che
// l'istante richiesto le arrivasse, invece di essere tagliato dal tetto.
//
// COME SI MISURA: due finestre a un minuto (la madre con 30 candele, la duplicata con 500), replay
// condiviso avviato sull'ULTIMA candela della madre. Due passi a freccetta: il primo la porta in
// fondo ai suoi dati, il secondo la manda oltre. Si guarda se esce e se la duplicata avanza.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PAGINA = new URL('../../app.html', import.meta.url).href;

const WS_FINTO = () => {
  class WebSocketFinto {
    constructor(url){ this.url = String(url || ''); this.readyState = 0; this.bufferedAmount = 0;
      this.onopen = null; this.onmessage = null; this.onerror = null; this.onclose = null; }
    send(){}
    close(){ this.readyState = 3; try{ this.onclose && this.onclose({code: 1000, reason: 'banco'}); }catch(e){} }
    addEventListener(){} removeEventListener(){} dispatchEvent(){ return false; }
  }
  WebSocketFinto.CONNECTING = 0; WebSocketFinto.OPEN = 1; WebSocketFinto.CLOSING = 2; WebSocketFinto.CLOSED = 3;
  try{ Object.defineProperty(window, 'WebSocket', {configurable: true, writable: true, value: WebSocketFinto}); }catch(e){}
};

function ascoltaErrori(pagina) {
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  return errori;
}

async function nuovaFinestra(contesto, slot) {
  const p = await contesto.newPage();
  const errori = ascoltaErrori(p);
  await p.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p.addInitScript(WS_FINTO);
  await p.goto(PAGINA + '?pipSlot=' + slot, {waitUntil: 'domcontentloaded'});
  await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
    .forEach(el => el.style.display = 'none'));
  return {p, errori};
}

const NIENTE_CAMBIO_ASSET = `(function(){ try{ applyRemoteAssetSwitch=function(){}; }catch(e){} })()`;

// Candele finte NATIVE al time frame della finestra, stesso asset per tutte.
const SCENA = (a) => `(function(){
  const grano=${a.tf};
  const R=[];
  for(let i=0;i<${a.quante};i++){
    const t=${a.base}+i*grano*60000;
    const p=1.0800+i*0.00002;
    R.push({date:new Date(t).toISOString().slice(0,16).replace('T',' '),
            open:p, high:p+0.00015, low:p-0.00015, close:p+0.00005, volume:100});
  }
  baseRows=R;
  rowsAssetKey=currentAssetKey=${JSON.stringify(a.asset)};
  currentTF=${a.tf};
  liveModeActive=true; mt5Connected=false;
  liveReplayActive=false; liveReplaySelecting=false; liveReplayGuideClientX=null;
  replayForm=null;
  positions.length=0; pendingOrders.length=0; trades.length=0;
  masterTime=${a.istante};
  rebuildRows();
  followLatest=true; viewEnd=idx; autoFitWidth=true; priceZoomFactor=1;
  viewPriceLo=null; viewPriceHi=null;
  draw();
  return {slot:PIP_SLOT, tf:currentTF, candele:rows.length, idx:idx};
})()`;

async function assicuraScena(p, a) {
  let ultimo = null;
  for (let giro = 1; giro <= 3; giro++) {
    ultimo = await p.evaluate(SCENA(a));
    await p.waitForTimeout(900);
    const dopo = await p.evaluate(`(function(){
      return {asset:currentAssetKey, candele:rows.length, live:!!liveModeActive, tf:currentTF};
    })()`);
    if (dopo.asset === a.asset && dopo.candele > 0 && dopo.live && dopo.tf === a.tf) {
      return Object.assign({}, ultimo, {giri: giro});
    }
  }
  throw new Error('la finestra non tiene la scena dopo tre giri: ' + JSON.stringify(ultimo));
}

const STATO = `(function(){
  let m=null; try{ m=replayMomentoMostrato(); }catch(e){}
  const r=rows[idx]||null;
  return {slot:PIP_SLOT, tf:currentTF, idx:idx, candele:rows.length, candela:r?r.date:null,
          momento:m, inReplay:!!liveReplayActive, perTutte:!!fblReplayPerTutte,
          ultimaCandela:(baseRows.length?baseRows[baseRows.length-1].date:null)};
})()`;

async function premi(pag, quale) {
  const r = await pag.evaluate((q) => {
    const el = document.getElementById(q);
    if (!el) return {trovato: false};
    el.click();
    return {trovato: true};
  }, quale);
  assert.equal(r.trovato, true, 'il tasto ' + quale + ' deve esistere nel DOM');
  return r;
}

test('la finestra che finisce i dati esce da sola e la duplicata avanza lo stesso', async () => {
  const {browser, pagina: madre, errori: erroriMadre} = await apriApp();
  const dup = await nuovaFinestra(madre.context(), 2);
  const tutte = [madre, dup.p];
  const errori = [erroriMadre, dup.errori];
  try {
    for (const p of tutte) await p.evaluate(NIENTE_CAMBIO_ASSET);

    const BASE = Date.UTC(2026, 0, 5, 0, 0, 0);   // un lunedi', a mezzanotte
    // L'istante di partenza si calcola DENTRO la pagina, dalla sua stessa data: le date del banco
    // sono stringhe senza fuso e la pagina le legge col fuso dei CSV (trappola gia' pagata - un
    // istante costruito in UTC fuori dalla pagina cadeva sul PRIMO minuto invece che sull'ultimo).
    const scenaMadre = {asset: 'EURUSD', tf: 1, quante: 30, base: BASE, istante: null};
    // La duplicata ne ha 500: puo' andare avanti molto oltre.
    const scenaDup = {asset: 'EURUSD', tf: 1, quante: 500, base: BASE, istante: null};
    await assicuraScena(madre, scenaMadre);
    await assicuraScena(dup.p, scenaDup);
    const ULTIMA_MADRE = await madre.evaluate(() => parseDateTime(baseRows[baseRows.length - 1].date));

    // REPLAY CONDIVISO avviato dalla madre, sull'ultima sua candela.
    const avvio = await madre.evaluate((t) => {
      appConfirm = function () { return Promise.resolve(true); };
      return (async function () {
        await fblChiediAmbitoReplay();
        avviaReplayLive(t);
        return {perTutte: !!fblReplayPerTutte, inReplay: !!liveReplayActive,
                momento: replayMomentoMostrato()};
      })();
    }, ULTIMA_MADRE);
    assert.equal(avvio.perTutte, true, 'la scelta deve essere «su tutte le finestre»');
    await dup.p.waitForFunction((t) => replayMomentoMostrato() === t, ULTIMA_MADRE,
      {timeout: 4000, polling: 50});

    const partenza = await Promise.all(tutte.map(p => p.evaluate(STATO)));
    console.log('partenza:', JSON.stringify(partenza.map(s => ({slot: s.slot, momento: s.momento,
      candela: s.candela, inReplay: s.inReplay}))));

    // UN PASSO: parte dall'inizio dell'ultima candela della madre e va oltre i suoi dati. La madre
    // deve uscire da sola; la duplicata deve avanzare di un minuto e continuare.
    await premi(madre, 'next');
    await madre.waitForTimeout(1500);
    const dopo1 = await Promise.all(tutte.map(p => p.evaluate(STATO)));
    console.log('dopo 1 passo:', JSON.stringify(dopo1.map(s => ({slot: s.slot, momento: s.momento,
      inReplay: s.inReplay}))));

    const m = dopo1[0], d = dopo1[1];
    // La madre non e' piu' in replay: e' uscita da sola, invece di restare ferma sull'ultima candela.
    assert.equal(m.inReplay, false,
      'la finestra senza piu dati deve uscire dal replay, invece resta dentro (momento ' + m.momento + ')');
    // La duplicata e' avanzata: l'istante richiesto le e' arrivato lo stesso.
    const atteso = partenza[0].momento + 60000;
    assert.equal(d.momento, atteso,
      'la duplicata deve mostrare l istante richiesto (' + atteso + '), invece mostra ' + d.momento);
    assert.equal(d.inReplay, true, 'la duplicata deve restare in replay e continuare');
    console.log('esito: madre uscita, duplicata a ' + new Date(d.momento).toISOString());
    for (const e of errori) assert.deepEqual(e, []);
  } finally { await browser.close(); }
});
