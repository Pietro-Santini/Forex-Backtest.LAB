// v1.0.138 — Test delle nuove richieste:
//  A) in replay le orizzontali dei livelli (entry/TP/SL) si vedono SOLO finché la posizione è
//     ANCORA aperta a quel punto del replay; appena il replay supera la candela di chiusura
//     (closeReached) spariscono tutte (restano solo frecce e linea tratteggiata).
//  B) P/L live in PIP aggiornato anche in modalità PIP/finestra separata (vedi livePLElement).
//  C) sicurezza selezione: click su posizione aperta (freccia o riga) la seleziona; click su un
//     punto vuoto deseleziona TUTTO; senza selezione i tasti SL/TP definiscono i livelli della
//     NUOVA posizione (bozza), mai una posizione già aperta; la casella TP/SL della bozza resta
//     sempre visibile anche col riempimento caselle spento, e torna nascosta all'apertura.
//  D) replay fluido "come dal vivo": ▶ fa nascere la candela successiva (formazione graduale,
//     footprint che accumula) e forward() la rivela vera; la select Velocità è ora un
//     moltiplicatore dei DATI 1x-2x-3x-4x-5x-10x-15x-20x-25x-30x, applicato subito se cambi
//     durante il play.
//  E) freno notizie nell'apertura automatica: sezione nel popup, stato di default, helper
//     tgAutoNotiziaRossaVicina (gravità+paesi+finestra minuti, con minuti PRIMA e DOPO separati e
//     pulsante paesi ON/OFF), migrazione dal vecchio campo unico, e gate in tgAutoValuta che
//     sospende l'apertura senza buttare il segnale.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {apriApp} from './aiuti.mjs';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');

const TRE_CANDELE = [
  {date:'2026-10-08T09:00:00.000Z',open:100,high:101,low:99, close:100,volume:5},
  {date:'2026-10-08T09:01:00.000Z',open:100,high:102,low:98, close:99, volume:6},
  {date:'2026-10-08T09:02:00.000Z',open:99, high:99, low:90, close:92, volume:7}
];
const TRE_CANDELE_JS = JSON.stringify(TRE_CANDELE);

// 40 candele m1 per il test del play fluido (il moltiplicatore 30x le consuma in fretta).
const QUARANTA_CANDELE = [];
{
  const t0 = Date.parse('2026-10-08T09:00:00.000Z');
  for (let i = 0; i < 40; i++) {
    QUARANTA_CANDELE.push({
      date: new Date(t0 + i * 60000).toISOString(),
      open: 100, high: 101, low: 99, close: 100, volume: 5
    });
  }
}
const QUARANTA_CANDELE_JS = JSON.stringify(QUARANTA_CANDELE);

// Spia condivisa su window: conta le righe orizzontali a tutto grafico (y costante). È un'IIFE che
// espone window.__spia, così le funzioni definite nel test possono leggerla (un eval di sole
// istruzioni non farebbe uscire const/let dal proprio scope).
const SPIA_RIGHE = `
  (function(){
    const proto = CanvasRenderingContext2D.prototype;
    const vM = proto.moveTo, vL = proto.lineTo, vS = proto.stroke;
    let ultimo = null;
    const spia = {intere: 0, righe: [], larghezza: 0, proto: proto, vM: vM, vL: vL, vS: vS};
    proto.moveTo = function (x, y) { ultimo = {x1: x, y1: y}; return vM.apply(this, arguments); };
    proto.lineTo = function (x, y) { if (ultimo) { ultimo.x2 = x; ultimo.y2 = y; } return vL.apply(this, arguments); };
    proto.stroke = function () {
      var col = String(this.strokeStyle || '');
      var bianca = col === '#ffffff' || col === '#fff' || col === 'white' || /255,\s*255,\s*255/.test(col);
      if (ultimo && ultimo.x2 != null && Math.abs(ultimo.y1 - ultimo.y2) < 0.5 && !bianca
          && ultimo.x1 < 25 && (ultimo.x2 - ultimo.x1) > spia.larghezza * 0.9) {
        spia.intere++;
        spia.righe.push({y1: Math.round(ultimo.y1 * 10) / 10, x1: Math.round(ultimo.x1), x2: Math.round(ultimo.x2),
                    a: this.globalAlpha, c: String(this.strokeStyle || '')});
      }
      ultimo = null;
      return vS.apply(this, arguments);
    };
    window.__spia = spia;
  })();
`;

test('A) in replay le orizzontali dei livelli si vedono solo finché la posizione è aperta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((o) => {
      const R = JSON.parse(o.JS), SPIA = o.SPIA;
      eval(SPIA);
      const spia = window.__spia;
      spia.larghezza = (document.getElementById('chart').clientWidth || 800) - 40;
      const conta = () => { spia.intere = 0; spia.righe.length = 0; draw(); return spia.righe.slice(); };

      currentTF = 1; liveModeActive = true;
      currentAssetKey = 'TESTX'; if(typeof rowsAssetKey !== 'undefined')rowsAssetKey = 'TESTX';
      baseRows = R; rows = R; idx = 2; viewEnd = 2;
      masterTime = closeTimeOf(R[2]); slTpScanDoneForAsset = 'TESTX';
      positions = []; active = null; trades = [];

      avviaReplayLive(parseDateTime(R[0].date));   // idx = 0, in replay
      followLatest = false; viewPriceLo = 97; viewPriceHi = 103; priceZoomFactor = 1;
      const vuoto = conta();

      const t0 = parseDateTime(R[0].date), t2 = parseDateTime(R[2].date);
      trades = [{id: 'T1', asset: 'TESTX', side: 'BUY', mode: 'live', mt5Ticket: null,
                 entry: 100, exit: 100.2, sl: 99.5, tp: 101.5, rrSl: 99.5, lots: 0.1, result: 'Loss',
                 pips: 10, pl: 10, pct: 0.5, account: 1000, strategy: '',
                 startTime: t0, closedAt: new Date(t2).toISOString()}];
      const aperta = conta();                      // idx=0: apertura 0<=0, chiusura non raggiunta

      // La candela di chiusura NON è ancora raggiunta: le orizzontali restano.
      idx = 1; viewEnd = 1; masterTime = closeTimeOf(R[1]);
      const ancoraAperta = conta();

      // Replay oltre la candela di chiusura (closeIdx 2 <= idx 2): TUTTE le orizzontali spariscono.
      idx = 2; viewEnd = 2; masterTime = closeTimeOf(R[2]);
      const chiusa = conta();

      spia.proto.moveTo = spia.vM; spia.proto.lineTo = spia.vL; spia.proto.stroke = spia.vS;
      const kw = (x) => x.y1 + '|' + x.a + '|' + x.c;
      const diff = (A, B) => B.filter(b => !A.some(a => kw(a) === kw(b))).map(kw);
      return {
        extraAperta: diff(vuoto, aperta),
        extraAncora: diff(vuoto, ancoraAperta),
        extraChiusa: diff(vuoto, chiusa),
      };
    }, {JS: TRE_CANDELE_JS, SPIA: SPIA_RIGHE});
    assert.equal(r.extraAperta.length, 3, 'a posizione ancora aperta si vedono le 3 orizzontali ricostruite (entry, TP, SL): ' + JSON.stringify(r.extraAperta));
    assert.equal(r.extraAncora.length, 3, 'prima della chiusura restano ancora 3: ' + JSON.stringify(r.extraAncora));
    assert.equal(r.extraChiusa.length, 0, 'oltre la candela di chiusura le orizzontali spariscono tutte: ' + JSON.stringify(r.extraChiusa));
    assert.ok(r.extraAperta.some(k => k.includes('#2fbf71')), 'tra i livelli c\'è il TP verde');
    assert.ok(r.extraAperta.some(k => k.includes('#3b82f6')), 'tra i livelli c\'è l\'entry blu');
    assert.ok(r.extraAperta.some(k => k.includes('#e05252')), 'tra i livelli c\'è lo SL rosso');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('C) click: posizione si seleziona dalla freccia/riga; il vuoto deseleziona tutto; SL/TP senza selezione agiscono sulla bozza', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((JS) => {
      const R = JSON.parse(JS);
      currentTF = 1; liveModeActive = true;
      currentAssetKey = 'TESTX'; if(typeof rowsAssetKey !== 'undefined')rowsAssetKey = 'TESTX';
      baseRows = R; rows = R; idx = 2; viewEnd = 2;
      masterTime = closeTimeOf(R[2]); slTpScanDoneForAsset = 'TESTX';
      trades = []; drawings = []; pendingDrawing = null;
      active = null; selectedDrawing = null; selectedClosedTradeIds = new Set();
      highlightCloseBtnRect = null; pendingHighlightCloseBtnRect = null; zoneStatsCloseBtnRect = null;
      followLatest = false; viewPriceLo = 97; viewPriceHi = 103; priceZoomFactor = 1;
      const t0 = parseDateTime(R[0].date);
      positions = [{id:'P1', asset:'TESTX', side:'BUY', entry:100.5, sl:99, tp:102, rrSl:99,
                    lots:0.1, start:1, startTime:t0, mt5Ticket:null, marginUsed:10}];

      const cv = document.getElementById('chart');
      cv.setPointerCapture = () => {}; cv.releasePointerCapture = () => {};
      // IMPORTANTE: la getBoundingClientRect() del canvas CAMBIA tra un click e l'altro (la
      // selezione di una posizione fa comparire un pannello DOM che sposta il canvas verso il
      // basso). Va quindi riletta OGNI volta: una rect catturata una sola volta all'inizio fa
      // atterrare i click successivi nel punto sbagliato (68px più in alto).
      const rect = () => cv.getBoundingClientRect();
      const clicca = (x, y) => {  // x/y LOCALI (relativi al canvas)
        const rx = rect();
        const X = rx.left + x, Y = rx.top + y;
        cv.dispatchEvent(new PointerEvent('pointerdown', {pointerId: 7, pointerType:'mouse', bubbles:true, cancelable:true, clientX:X, clientY:Y}));
        cv.dispatchEvent(new PointerEvent('pointerup',   {pointerId: 7, pointerType:'mouse', bubbles:true, cancelable:true, clientX:X, clientY:Y}));
      };

      draw();
      const arrow = openPosHitRects.find(r=>r.pos && r.pos.id==='P1');
      if (!arrow) return {errore: 'nessun openPosHitRects per P1; totali=' + openPosHitRects.length};
      clicca((arrow.x1 + arrow.x2) / 2, (arrow.y1 + arrow.y2) / 2);
      const dopoFreccia = {id: active && active.id, len: openPosHitRects.length};

      // Trova un punto vuoto (stessi predicati del blocco sicurezza nel pointerup) e clicca.
      const g = chartGeometry();
      const padL = g.pad.l, padR = g.pad.r, w = cv.clientWidth, h = cv.clientHeight;
      const bNow = rect();   // rect FRESCA: a questo punto il canvas può già essersi spostato
      const vuoto = (x, y) => {
        if (x < padL + 8 || x > w - padR - 8 || y < g.pad.t + 8 || y > h - g.pad.b - 8) return false;
        if (isOnPriceAxis(bNow.left + x)) return false;
        if (hitTestDrawings(bNow.left + x, bNow.top + y, true)) return false;
        if (zoneBoxHitRects.some(rr => x >= rr.xOrigin && x <= rr.xRight && y >= rr.yMin && y <= rr.yMax)) return false;
        if (footprintCellHitRects.some(rr => x >= rr.xxLeft && x <= rr.xxRight && y >= rr.yTop && y <= rr.yBot)) return false;
        if (openPosHitRects.some(rr => x >= rr.x1 && x <= rr.x2 && y >= rr.y1 && y <= rr.y2)) return false;
        if (tradeLevelHit(bNow.left + x, bNow.top + y, false) !== null) return false;
        if (closedTradeHitSegments.some(rr => distToSegment(x, y, rr.x1, rr.y1, rr.x2, rr.y2) <= CLOSED_TRADE_HIT_TOL)) return false;
        if (newsDotHitRects.some(n => Math.hypot(x - n.x, y - n.y) <= n.r + 2)) return false;
        if (vpIndHitRects.some(rr => x >= rr.x1 && x <= rr.x2 && y >= rr.y1 && y <= rr.y2)) return false;
        if (zoneStatsCloseBtnRect && x >= zoneStatsCloseBtnRect.x && x <= zoneStatsCloseBtnRect.x + zoneStatsCloseBtnRect.w &&
            y >= zoneStatsCloseBtnRect.y && y <= zoneStatsCloseBtnRect.y + zoneStatsCloseBtnRect.h) return false;
        return true;
      };
      let vuotoXY = null;
      for (let fy = 12; fy <= 20 && !vuotoXY; fy++) for (let fx = 10; fx <= 70 && !vuotoXY; fx++) {
        const x = Math.round(padL + (w-padL-padR) * fx / 80), y = Math.round(g.pad.t + (h-g.pad.t-g.pad.b) * fy / 24);
        if (vuoto(x, y)) vuotoXY = {x, y};
      }
      if (!vuotoXY) return {errore: 'nessun punto vuoto trovato', padL, padR};
      clicca(vuotoXY.x, vuotoXY.y);
      const dopoVuoto = {active: active, sel: selectedDrawing, nSel: selectedClosedTradeIds.size};
      clicca(vuotoXY.x, vuotoXY.y);   // di nuovo sul vuoto: nessun effetto, nessun crash
      const dopoDoppioVuoto = {active: active, sel: selectedDrawing, nSel: selectedClosedTradeIds.size};

      // SL/TP senza selezione: valorizzano SOLO la bozza, non toccano P1.
      const tpPrima = positions[0].tp;
      setTradeLevel('TP', 104.5, 'input');
      const bozzaTP = $('tp').value;
      const tpP1DopoBozza = positions[0].tp;

      // Riseleziono P1 dalla freccia: ora il tasto modifica la posizione vera.
      draw();
      const arrow2 = openPosHitRects.find(rr => rr.pos && rr.pos.id === 'P1');
      clicca((arrow2.x1 + arrow2.x2) / 2, (arrow2.y1 + arrow2.y2) / 2);
      const riselezionato = active && active.id;
      setTradeLevel('TP', 103.2, 'input');
      const tpP1Modificato = positions[0].tp;

      return {dopoFreccia, dopoVuoto, dopoDoppioVuoto, bozzaTP, attesoBozza: fmtPrice(104.5), tpPrima, tpP1DopoBozza, riselezionato, tpP1Modificato, vuotoXY};
    }, TRE_CANDELE_JS);
    assert.deepEqual(r.dopoFreccia, {id:'P1', len:2}, 'clic sulla freccia di apertura seleziona P1 (2 hit rect: freccia + riga)');
    if (r.errore) assert.fail(r.errore);
    assert.equal(r.dopoVuoto.active, null, 'il click sul vuoto deseleziona la posizione attiva');
    assert.equal(r.dopoVuoto.sel, null, 'il click sul vuoto deseleziona anche il disegno selezionato');
    assert.equal(r.dopoVuoto.nSel, 0, 'il click sul vuoto svuota la multi-selezione dei trade chiusi');
    assert.equal(r.dopoDoppioVuoto.active, null, 'un secondo click sul vuoto non ha effetti collaterali');
    assert.equal(r.bozzaTP, r.attesoBozza, 'senza selezione il tasto TP valorizza la bozza (casella), formattato come fmtPrice');
    assert.equal(r.tpP1DopoBozza, r.tpPrima, 'senza selezione P1 NON viene toccata dal tasto TP');
    assert.equal(r.riselezionato, 'P1', 'si può riselezionare P1 dalla freccia dopo la deselezione');
    assert.equal(r.tpP1Modificato, 103.2, 'con P1 selezionata il tasto TP modifica la posizione vera');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('C4) la casella TP/SL della bozza resta visibile anche col riempimento spento; all\'apertura torna nascosta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((JS) => {
      const R = JSON.parse(JS);
      currentTF = 1; liveModeActive = true;
      currentAssetKey = 'TESTX'; if(typeof rowsAssetKey !== 'undefined')rowsAssetKey = 'TESTX';
      baseRows = R; rows = R; idx = 2; viewEnd = 2;
      masterTime = closeTimeOf(R[2]); slTpScanDoneForAsset = 'TESTX';
      trades = []; drawings = []; active = null;
      followLatest = false; viewPriceLo = 97; viewPriceHi = 103; priceZoomFactor = 1;
      const t0 = parseDateTime(R[0].date);
      positions = [];

      // Conta i fillRect con i colori ESATTI del riempimento delle caselle TP/SL
      // (gli stessi che usa drawTpSlZoneBox: currentZoneColors()/currentZoneOpacity()).
      const proto = CanvasRenderingContext2D.prototype;
      const vF = proto.fillRect;
      const colTP = hexToRgba(currentZoneColors().tp, currentZoneOpacity().tp);
      const colSL = hexToRgba(currentZoneColors().sl, currentZoneOpacity().sl);
      const normS = s => s.replace(/,\s+/g, ',');   // il canvas normalizza il colore (spazi dopo le virgole)
      let riempimenti = 0;
      proto.fillRect = function (x, y, w, hgt) {
        if (normS(String(this.fillStyle || '')) === colTP || normS(String(this.fillStyle || '')) === colSL) riempimenti++;
        return vF.apply(this, arguments);
      };

      tpSlZoneFillVisible = false;              // riempimento caselle SPENTO
      $('sl').value = ''; $('tp').value = '101.8';
      draw();
      const bozza = riempimenti;                 // la bozza forzata visibile: riempimenti presenti

      riempimenti = 0;
      positions = [{id:'P1', asset:'TESTX', side:'BUY', entry:100.5, sl:99, tp:102, rrSl:99,
                    lots:0.1, start:1, startTime:t0, mt5Ticket:null, marginUsed:10}];
      active = positions[0];                     // P1 aperta E selezionata: la bozza sparisce
      $('sl').value = ''; $('tp').value = '';    // caselle svuotate all'apertura, come nel flusso reale
      draw();
      const aperta = riempimenti;                // posizione aperta con rimpiempimento spento: 0

      proto.fillRect = vF;
      return {bozza, aperta};
    }, TRE_CANDELE_JS);
    assert.ok(r.bozza > 0, 'in creazione (bozza) la casella TP/SL si vede anche col riempimento spento: bozza=' + r.bozza);
    assert.equal(r.aperta, 0, 'una volta aperta, con il riempimento caselle spento, non si riempie nulla: aperta=' + r.aperta);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('D) play fluido: la candela si forma al secondo; il moltiplicatore accelera i secondi di mercato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (JS) => {
      const R = JSON.parse(JS);
      currentTF = 1; liveModeActive = false;
      currentAssetKey = 'TESTX'; if(typeof rowsAssetKey !== 'undefined')rowsAssetKey = 'TESTX';
      baseRows = R; rows = R; idx = 2; viewEnd = 2;
      masterTime = closeTimeOf(R[2]);
      positions = []; active = null; trades = [];

      const opzioni = [...document.querySelectorAll('#speed option')].map(o => o.value + '=' + o.textContent.trim());
      $('speed').value = '1';
      $('play').click();                          // ▶ avvia il loop fluido (50ms/frame)

      // RICHIESTO: a 1x si avanza 1 SECONDO di mercato al secondo. Su 1m servono 60s per candela,
      // quindi dopo ~1,4s la formazione è appena iniziata (replayForm.sub=1) e idx NON è avanzato.
      await new Promise(rz => setTimeout(rz, 1400));
      const durante1x = {
        timer: !!timer, form: !!replayForm,
        idx: idx,
        secondiFormati: replayForm ? replayForm.sub : 0,
        status: $('status').textContent,
      };

      $('speed').value = '30'; $('speed').dispatchEvent(new Event('change'));   // cambio moltiplicatore DURANTE il play
      // 30x = 30 secondi di mercato al secondo: in 3s ~90s, quindi almeno una candela (60s) completa.
      await new Promise(rz => setTimeout(rz, 3000));
      const durante30x = { timer: !!timer, idx: idx };

      $('play').click();                               // ferma il play (toggle ▶ STOP)
      await new Promise(rz => setTimeout(rz, 60));
      const fermato = { timer: !!timer, play: $('play').textContent };
      return {opzioni, durante1x, durante30x, fermato, perBar: replaySecondsPerBar()};
    }, QUARANTA_CANDELE_JS);
    assert.deepEqual(r.opzioni,
      ['1=1x','2=2x','3=3x','4=4x','5=5x','10=10x','15=15x','20=20x','25=25x','30=30x'],
      'la select Velocità è il moltiplicatore dei secondi di mercato 1x..30x richiesto');
    assert.equal(r.perBar, 60, 'su 1m una candela vale 60 secondi di mercato');
    assert.ok(r.durante1x.timer && r.durante1x.form, 'durante il play esiste la candela in formazione');
    assert.equal(r.durante1x.idx, 2, 'a 1x in 1,4s non si è ancora completata una candela (ne servono 60): idx=' + r.durante1x.idx);
    assert.ok(r.durante1x.secondiFormati >= 1, 'la formazione ha già svelato almeno 1 secondo di mercato');
    assert.ok(String(r.durante1x.status).includes('s/s'), 'lo status parla di secondi di mercato al secondo: ' + r.durante1x.status);
    assert.ok(r.durante30x.idx >= 3, 'cambiando a 30x DURANTE il play i secondi scorrono molto più veloci (candela completata): idx=' + r.durante30x.idx);
    assert.deepEqual(r.fermato, {timer:false, play:'▶ PLAY'}, 'premendo di nuovo ▶ STOP il play si ferma e torna ▶ PLAY');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('E) freno notizie: sezione, default, helper con gravità/paesi/finestra e gate nel flusso', async () => {
  // 1) presenze statiche (come il test 5 di replay_live): markup e gate nel flusso.
  for (const id of ['tgAutoNewsAttiva','tgAutoNewsMinPre','tgAutoNewsMinPost','tgAutoNewsHigh','tgAutoNewsMedium','tgAutoNewsLow','tgAutoNewsPaesi','tgAutoNewsPaesiTutte'])
    assert.ok(APP.includes('id="' + id + '"'), 'il markup del freno notizie contiene #' + id);
  assert.ok(APP.includes('newsAttiva:false,newsMinPre:15,newsMinPost:15,newsSeverita:{High:true,Medium:false},newsPaesi:null'),
            'i default del freno notizie sono: spento, 15 minuti prima e 15 dopo, solo notizie alte, tutti i paesi');
  assert.ok(APP.includes('if(A.attivo&&A.newsAttiva){'), 'il gate del freno notizie è in tgAutoValuta');
  assert.ok(APP.includes("voce.autoMotivo='sospesa dal freno notizie: "), 'il segnale sospeso resta col motivo "sospesa dal freno notizie"');

  // 2) comportamento in pagina.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const def = tgAutoVuoto();
      const ora = Date.now();
      // Una notizia ALTA appena passata (5 minuti fa) e una BASSA.
      newsEvents = [
        {impact:'High', country:'US', date:new Date(ora - 5*60000).toISOString(), title:'  Nonfarm   Payrolls  '},
        {impact:'Low',  country:'US', date:new Date(ora - 3*60000).toISOString(), title:'Sondaggio'},
      ];
      // Minuti PRIMA e DOPO separati: una notizia passata da 5 minuti scatta solo con un "dopo"
      // abbastanza largo; col solo "prima" no, perché è già passata.
      const vicinaDopo = tgAutoNotiziaRossaVicina({newsMinPre:0, newsMinPost:15, newsSeverita:{High:true}, newsPaesi:null});
      const lontanoDopo = tgAutoNotiziaRossaVicina({newsMinPre:0, newsMinPost:1, newsSeverita:{High:true}, newsPaesi:null});
      const soloPrimaPassata = tgAutoNotiziaRossaVicina({newsMinPre:15, newsMinPost:0, newsSeverita:{High:true}, newsPaesi:null});
      // Il vecchio campo unico resta valido per le configurazioni salvate prima di questa modifica.
      const legacy = tgAutoNotiziaRossaVicina({newsMin:15, newsSeverita:{High:true}, newsPaesi:null});
      // Gravità e paese si applicano alla stessa finestra.
      const soloMedia = tgAutoNotiziaRossaVicina({newsMinPre:0, newsMinPost:15, newsSeverita:{Medium:true}, newsPaesi:null});
      const soloRegnoUnito = tgAutoNotiziaRossaVicina({newsMinPre:0, newsMinPost:15, newsSeverita:{High:true}, newsPaesi:{GB:true}});
      // Notizia ALTA fra 10 minuti: scatta col "prima" largo, non con quello stretto.
      newsEvents = [{impact:'High', country:'US', date:new Date(ora + 10*60000).toISOString(), title:'CPI'}];
      const vicinaPrima = tgAutoNotiziaRossaVicina({newsMinPre:15, newsMinPost:0, newsSeverita:{High:true}, newsPaesi:null});
      const futuraLontana = tgAutoNotiziaRossaVicina({newsMinPre:1, newsMinPost:0, newsSeverita:{High:true}, newsPaesi:null});
      // Paesi: il pulsante "Tutti i paesi" è ON/OFF (tutti -> nessuno -> tutti).
      newsEvents = [
        {impact:'High', country:'US', date:new Date(ora - 5*60000).toISOString(), title:'A'},
        {impact:'High', country:'GB', date:new Date(ora - 5*60000).toISOString(), title:'B'},
      ];
      const listaPaesi = newsCountriesForAuto ? newsCountriesForAuto() : [];
      tgAuto.newsPaesi = null;
      $('tgAutoNewsPaesiTutte').click();
      const paesiDopoPrimoClic = JSON.parse(JSON.stringify(tgAuto.newsPaesi));
      $('tgAutoNewsPaesiTutte').click();
      const paesiDopoSecondoClic = tgAuto.newsPaesi;
      const senzaEventi = (newsEvents = []) && tgAutoNotiziaRossaVicina({newsMinPre:0, newsMinPost:15, newsSeverita:{High:true}, newsPaesi:null});
      // Il checkbox scrive sullo stato della famiglia attiva.
      $('tgAutoNewsAttiva').checked = true;
      $('tgAutoNewsAttiva').dispatchEvent(new Event('change'));
      return {
        def: {attiva: def.newsAttiva, pre: def.newsMinPre, post: def.newsMinPost, sev: def.newsSeverita, paesi: def.newsPaesi},
        vicinaDopo, lontanoDopo, soloPrimaPassata, legacy, soloMedia, soloRegnoUnito,
        vicinaPrima, futuraLontana, senzaEventi,
        attivatoDalCheckbox: tgAuto.newsAttiva,
        listaPaesi, paesiDopoPrimoClic, paesiDopoSecondoClic,
      };
    });
    assert.deepEqual(r.def, {attiva:false, pre:15, post:15, sev:{High:true,Medium:false}, paesi:null}, 'default del freno notizie come richiesto');
    assert.ok(r.vicinaDopo && r.vicinaDopo.includes('Nonfarm'), 'la notizia alta passata da 5 min scatta col "dopo" a 15: ' + r.vicinaDopo);
    assert.ok(r.lontanoDopo === null, 'con "dopo" a 1 minuto una notizia di 5 minuti fa non è più vicina');
    assert.equal(r.soloPrimaPassata, null, 'col solo "prima" una notizia già passata non sospende');
    assert.ok(r.legacy && r.legacy.includes('Nonfarm'), 'il vecchio campo unico "newsMin" resta valido');
    assert.equal(r.soloMedia, null, 'una notizia Alta non scatta se sono filtrate solo le Medie');
    assert.equal(r.soloRegnoUnito, null, 'una notizia USA non scatta se è filtrato solo il Regno Unito');
    assert.ok(r.vicinaPrima && r.vicinaPrima.includes('CPI'), 'una notizia fra 10 minuti scatta col "prima" a 15');
    assert.equal(r.futuraLontana, null, 'col "prima" a 1 minuto una notizia fra 10 non è ancora vicina');
    assert.equal(r.senzaEventi, null, 'senza eventi il freno non scatta');
    assert.equal(r.attivatoDalCheckbox, true, 'la spunta accende/spegne lo stato del freno nella scheda attiva');
    assert.deepEqual(r.listaPaesi, ['GB','US'], 'la lista dei paesi si popola dagli eventi ricevuti');
    assert.deepEqual(r.paesiDopoPrimoClic, {GB:false,US:false}, 'il primo clic del pulsante deseleziona tutti i paesi');
    assert.equal(r.paesiDopoSecondoClic, null, 'il secondo clic riseleziona tutti i paesi');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('B) updateLivePL aggiorna il P/L anche da finestra separata (livePLElement cross-document)', () => {
  // B è stato spostato dentro #chartFsSidebar e reso indipendente dal documento: verifichiamo
  // i pezzi statici che lo rendono sicuro in PIP/finestra separata (niente più dipendenza dal
  // #livePL dentro .chartWrap; guardia null nel calcolo; aggiornamento via livePLElement()).
  assert.ok(APP.includes('function livePLElement('), 'esiste livePLElement() per trovare il P/L nel documento giusto');
  assert.ok(APP.includes("livePLElement('liveSide')"), 'updateLivePL usa livePLElement(id) (e quindi aggiorna il P/L anche nella finestra separata/PIP)');
  assert.ok(APP.includes('id="chartFsSidebar"'), 'la sidebar esiste');
  assert.ok(APP.includes('id="livePL"'), 'il #livePL rimane nel markup');
});