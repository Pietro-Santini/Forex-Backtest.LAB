// Stile MT5 (richiesto esplicitamente): quando si clicca una posizione aperta, quella viene
// EVIDENZIATA e resta nei suoi colori (entrata BUY/SELL + caselle TP/SL), mentre le ALTRE posizioni
// passano in grigio (TRADE_DIM_GREY = #8b96a5) sulla sola riga di entrata.
//
// AGGIORNATO DUE VOLTE. La v142 fece sparire del tutto le caselle TP/SL delle altre posizioni; il
// 14 ottobre 2026 il proprietario ha chiesto di tornare a vederle, ma SPENTE: «vengano messe in
// grigio anche le linee dello stop e del target, insieme alle etichette, così ci rendiamo conto di
// dove sono posizionati gli altri livelli; le caselle invece vengono disattivate momentaneamente e
// resta colorata solo quella della posizione selezionata». Cliccando (o toccando) sul vuoto torna
// tutto come prima.
//
// E la selezione è quella dell'UTENTE (posSelezionata, che la mette solo un clic), non `active`:
// `active` l'app la riassegna da sola in cinque punti, e finché contava lei una posizione sembrava
// "selezionarsi da sola". Vedi selezione_posizioni.test.mjs.
//
// Con due posizioni BUY dello stesso asset (entrate/livelli ben distinti) selezionarne una deve:
//  - lasciare verde (#2fbf71) la SUA riga di entrata e grigia (#8b96a5) quella dell'altra;
//  - lasciare nei colori scelti le SUE linee TP (#e8a13b) / SL (#e05252), e disegnare quelle
//    dell'altra IN GRIGIO — presenti, ma spente, e senza il riempimento colorato.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const TRE_CANDELE = [
  {date:'2026-10-08T09:00:00.000Z',open:100,high:101,low:99, close:100,volume:5},
  {date:'2026-10-08T09:01:00.000Z',open:100,high:102,low:98, close:99, volume:6},
  {date:'2026-10-08T09:02:00.000Z',open:99, high:99, low:90, close:92, volume:7}
];
const TRE_CANDELE_JS = JSON.stringify(TRE_CANDELE);

// Spia su window: registra OGNI stroke() orizzontale (y1 ≈ y2) con la sua y, il colore
// (strokeStyle) e l'alpha (globalAlpha). Filtriamo poi per colore/y nel test, così le righe della
// griglia (colorate diversamente, alpha bassissima) non danno fastidio.
const SPIA_ORIZ = `
  (function(){
    const proto = CanvasRenderingContext2D.prototype;
    const vM = proto.moveTo, vL = proto.lineTo, vS = proto.stroke;
    let ultimo = null;
    const spia = {oriz: [], proto: proto, vM: vM, vL: vL, vS: vS};
    proto.moveTo = function (x, y) { ultimo = {x1: x, y1: y}; return vM.apply(this, arguments); };
    proto.lineTo = function (x, y) { if (ultimo) { ultimo.x2 = x; ultimo.y2 = y; } return vL.apply(this, arguments); };
    proto.stroke = function () {
      if (ultimo && ultimo.x2 != null && Math.abs(ultimo.y1 - ultimo.y2) < 0.5) {
        spia.oriz.push({y: Math.round(ultimo.y1 * 10) / 10, x1: Math.round(ultimo.x1), x2: Math.round(ultimo.x2),
                        a: Math.round((this.globalAlpha || 1) * 100) / 100, c: String(this.strokeStyle || '')});
      }
      ultimo = null;
      return vS.apply(this, arguments);
    };
    window.__spiaOriz = spia;
  })();
`;

test('MT5) click su una posizione: la sua resta a colori, le altre vanno in grigio (non spariscono)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((o) => {
      const R = JSON.parse(o.JS), SPIA = o.SPIA;
      eval(SPIA);
      const spia = window.__spiaOriz;
      // I toggle delle linee (posizioni e prezzo) devono essere attivi, altrimenti le righe non
      // vengono disegnate affatto.
      try{ localStorage.removeItem('fbl_linee_pos'); localStorage.removeItem('fbl_linee_prezzo'); }catch(e){}
      // Colori TP/SL scelti dall'utente, noti e distinti dal grigio di spegnimento.
      $('tpZoneColor').value = '#e8a13b';
      $('slZoneColor').value = '#e05252';

      currentTF = 1; liveModeActive = true; liveReplayActive = false;
      currentAssetKey = 'TESTX'; if(typeof rowsAssetKey !== 'undefined')rowsAssetKey = 'TESTX';
      baseRows = R; rows = R; idx = 2; viewEnd = 2;
      masterTime = closeTimeOf(R[2]); slTpScanDoneForAsset = 'TESTX';
      trades = []; positionsVisible = true;
      followLatest = false; viewPriceLo = 97; viewPriceHi = 103; priceZoomFactor = 1;
      const t0 = parseDateTime(R[0].date);
      // Due posizioni BUY dello stesso asset, entrate e target/stop ben distinti.
      positions = [
        {id:'P1', asset:'TESTX', side:'BUY', entry:100.5, sl:99.5, tp:101.5, rrSl:99.5, lots:0.1, start:1, startTime:t0, mt5Ticket:null, marginUsed:10},
        {id:'P2', asset:'TESTX', side:'BUY', entry:102.0, sl:101.0, tp:103.0, rrSl:101.0, lots:0.1, start:1, startTime:t0, mt5Ticket:null, marginUsed:10}
      ];
      active = null; posSelezionata = null;

      const Y = p => Math.round(chartGeometry().y(p) * 10) / 10;
      const GREY = TRADE_DIM_GREY;                       // '#8b96a5'
      // cattura(): ridisegna e restituisce sia gli stroke orizzontali sia i riquadri cliccabili
      // TP/SL realmente creati (zoneBoxHitRects -> ownerKey 'pos:<id>').
      const cattura = () => { spia.oriz.length = 0; draw(); return {oriz: spia.oriz.slice(), keys: zoneBoxHitRects.map(z => z.ownerKey)}; };
      const vicino = (arr, yy) => arr.filter(x => Math.abs(x.y - yy) <= 1.5);
      const primo = (arr, yy, col) => { const h = vicino(arr, yy).find(x => x.c.includes(col)); return h || null; };
      const ha = (arr, yy, col) => !!primo(arr, yy, col);

      const y = {p1e:Y(100.5), p1tp:Y(101.5), p1sl:Y(99.5), p2e:Y(102.0), p2tp:Y(103.0), p2sl:Y(101.0)};
      const senza = cattura();       // nessuna selezione: tutte colorate
      focusPosition(positions[0]);   // P1 scelta dall'utente (e' la strada di ogni clic)
      const sel1 = cattura();
      focusPosition(positions[1]);   // P2 scelta
      const sel2 = cattura();

      spia.proto.moveTo = spia.vM; spia.proto.lineTo = spia.vL; spia.proto.stroke = spia.vS;

      return {
        GREY, y,
        senza: {
          grigie: senza.oriz.filter(x => x.c.includes(GREY)).length,
          keys: senza.keys,
          p1e: primo(senza.oriz, y.p1e, '#2fbf71'),
          p2e: primo(senza.oriz, y.p2e, '#2fbf71'),
          p1tp: primo(senza.oriz, y.p1tp, '#e8a13b'),
          p1sl: primo(senza.oriz, y.p1sl, '#e05252'),
          p2tp: primo(senza.oriz, y.p2tp, '#e8a13b'),
          p2sl: primo(senza.oriz, y.p2sl, '#e05252'),
        },
        sel1: {
          keys: sel1.keys,
          p1e: primo(sel1.oriz, y.p1e, '#2fbf71'),
          p1eGrigia: ha(sel1.oriz, y.p1e, GREY),
          p2e: ha(sel1.oriz, y.p2e, '#2fbf71'),
          p2eGrigia: primo(sel1.oriz, y.p2e, GREY),
          p1tp: primo(sel1.oriz, y.p1tp, '#e8a13b'),
          p1sl: primo(sel1.oriz, y.p1sl, '#e05252'),
          // P2 NON deve avere NESSUNA riga TP/SL: né col colore scelto né in grigio.
          p2tpColore: primo(sel1.oriz, y.p2tp, '#e8a13b'),
          p2tpGrigio: primo(sel1.oriz, y.p2tp, GREY),
          p2slColore: primo(sel1.oriz, y.p2sl, '#e05252'),
          p2slGrigio: primo(sel1.oriz, y.p2sl, GREY),
        },
        sel2: {
          keys: sel2.keys,
          p2e: primo(sel2.oriz, y.p2e, '#2fbf71'),
          p2eGrigia: ha(sel2.oriz, y.p2e, GREY),
          p1e: ha(sel2.oriz, y.p1e, '#2fbf71'),
          p1eGrigia: primo(sel2.oriz, y.p1e, GREY),
          p2tp: primo(sel2.oriz, y.p2tp, '#e8a13b'),
          p2sl: primo(sel2.oriz, y.p2sl, '#e05252'),
          p1tpColore: primo(sel2.oriz, y.p1tp, '#e8a13b'),
          p1tpGrigio: primo(sel2.oriz, y.p1tp, GREY),
          p1slColore: primo(sel2.oriz, y.p1sl, '#e05252'),
          p1slGrigio: primo(sel2.oriz, y.p1sl, GREY),
        },
      };
    }, {JS: TRE_CANDELE_JS, SPIA: SPIA_ORIZ});

    // ---- Nessuna selezione: tutto colorato, niente grigio, tutte le caselle presenti. ----
    assert.equal(r.senza.grigie, 0, 'senza selezione non deve esserci nessuna riga grigia (' + r.GREY + ')');
    assert.ok(r.senza.keys.includes('pos:P1') && r.senza.keys.includes('pos:P2'), 'senza selezione ci sono le caselle TP/SL di entrambe');
    assert.ok(r.senza.p1e, 'senza selezione l\'entry di P1 è verde');
    assert.ok(r.senza.p2e, 'senza selezione l\'entry di P2 è verde');
    assert.ok(r.senza.p1tp, 'senza selezione il Target di P1 ha il colore scelto');
    assert.ok(r.senza.p1sl, 'senza selezione lo Stop di P1 ha il colore scelto');
    assert.ok(r.senza.p2tp, 'senza selezione il Target di P2 ha il colore scelto');
    assert.ok(r.senza.p2sl, 'senza selezione lo Stop di P2 ha il colore scelto');

    // ---- P1 selezionata: P1 evidenziata, la casella TP/SL di P2 sparisce del tutto. ----
    assert.ok(r.sel1.keys.includes('pos:P1') && r.sel1.keys.includes('pos:P2'),
      'le caselle restano disegnate per tutte: quelle delle altre spente, non sparite');
    assert.ok(r.sel1.p1e, 'con P1 selezionata l\'entry di P1 resta verde');
    assert.equal(r.sel1.p1eGrigia, false, 'con P1 selezionata l\'entry di P1 NON è grigia');
    assert.equal(r.sel1.p2e, false, 'con P1 selezionata l\'entry di P2 NON è più verde');
    assert.ok(r.sel1.p2eGrigia, 'con P1 selezionata l\'entry di P2 è grigia');
    assert.ok(r.sel1.p2eGrigia.c.includes(r.GREY), 'la riga di P2 usa proprio ' + r.GREY);
    assert.ok(r.sel1.p2eGrigia.a < (r.sel1.p1e.a || 1), 'la riga grigia è anche più spenta (alpha minore)');
    assert.ok(r.sel1.p1tp, 'con P1 selezionata il Target di P1 resta nel colore scelto');
    assert.ok(r.sel1.p1sl, 'con P1 selezionata lo Stop di P1 resta nel colore scelto');
    assert.equal(r.sel1.p2tpColore, null, 'con P1 selezionata il Target di P2 non ha più il suo colore');
    assert.ok(r.sel1.p2tpGrigio, 'ma il Target di P2 si deve ancora vedere, in grigio');
    assert.equal(r.sel1.p2slColore, null, 'con P1 selezionata lo Stop di P2 non ha più il suo colore');
    assert.ok(r.sel1.p2slGrigio, 'ma lo Stop di P2 si deve ancora vedere, in grigio');

    // ---- P2 selezionata: speculare. ----
    assert.ok(r.sel2.keys.includes('pos:P1') && r.sel2.keys.includes('pos:P2'),
      'anche qui le caselle restano tutte, spente quelle delle altre');
    assert.ok(r.sel2.p2e, 'con P2 selezionata l\'entry di P2 resta verde');
    assert.equal(r.sel2.p2eGrigia, false, 'con P2 selezionata l\'entry di P2 NON è grigia');
    assert.equal(r.sel2.p1e, false, 'con P2 selezionata l\'entry di P1 NON è più verde');
    assert.ok(r.sel2.p1eGrigia, 'con P2 selezionata l\'entry di P1 è grigia');
    assert.ok(r.sel2.p2tp, 'con P2 selezionata il Target di P2 resta nel colore scelto');
    assert.ok(r.sel2.p2sl, 'con P2 selezionata lo Stop di P2 resta nel colore scelto');
    assert.equal(r.sel2.p1tpColore, null, 'con P2 selezionata il Target di P1 non ha più il suo colore');
    assert.ok(r.sel2.p1tpGrigio, 'ma il Target di P1 si deve ancora vedere, in grigio');
    assert.equal(r.sel2.p1slColore, null, 'con P2 selezionata lo Stop di P1 non ha più il suo colore');
    assert.ok(r.sel2.p1slGrigio, 'ma lo Stop di P1 si deve ancora vedere, in grigio');

    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
