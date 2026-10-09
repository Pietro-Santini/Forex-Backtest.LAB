// PASSO 22 — due interruttori più fini del "posizioni" e del "linee posizioni": uno spegne SOLO
// le linee tra la freccia di apertura e quella di chiusura, l'altro SOLO le orizzontali di prezzo
// (apertura e chiusura). Le linee TP/SL, le frecce e le caselle colorate non devono essere toccate.
// Prima della correzione questi due interruttori NON esistevano: il test falliva.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('due interruttori separano le linee apertura/chiusura dalle linee di prezzo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const ag = document.getElementById('toggleConnettoriBtn');
      const lp = document.getElementById('toggleLineePrezzoBtn');
      const sel = '#chartSettingsModalOverlay [data-settings-panel="style"] ';
      const partenza = {conn: fblConnettoriVisibili(), prez: fblLineePrezzoVisibili(), linee: fblLineePosVisibili(), etic: fblEtichetteTpSlVisibili()};
      // Spegni SOLO i connettori, poi riaccendi.
      ag.click();
      const dopoConn = {conn: fblConnettoriVisibili(), prez: fblLineePrezzoVisibili(), linee: fblLineePosVisibili()};
      ag.click();
      // Spegni SOLO le linee di prezzo, poi riaccendi.
      lp.click();
      const dopoPrez = {conn: fblConnettoriVisibili(), prez: fblLineePrezzoVisibili(), linee: fblLineePosVisibili(), etic: fblEtichetteTpSlVisibili()};
      lp.click();
      return {
        ag: !!ag, lp: !!lp,
        inStyle: !!document.querySelector(sel + '#toggleConnettoriBtn'),
        inStyle2: !!document.querySelector(sel + '#toggleLineePrezzoBtn'),
        partenza, dopoConn, dopoPrez,
        tornato: {conn: fblConnettoriVisibili(), prez: fblLineePrezzoVisibili()},
        sync: ('fbl_connettori' in GRAFICO_LS) && ('fbl_linee_prezzo' in GRAFICO_LS)
      };
    });
    assert.equal(r.ag, true, 'esiste il pulsante delle linee apertura/chiusura');
    assert.equal(r.lp, true, 'esiste il pulsante delle linee di prezzo');
    assert.equal(r.inStyle && r.inStyle2, true, 'i due interruttori stanno nelle impostazioni dello stile');
    assert.deepEqual(r.partenza, {conn:true, prez:true, linee:true, etic:true}, 'di base si vede tutto');
    assert.equal(r.dopoConn.conn, false, 'il primo pulsante spegne le linee apertura/chiusura');
    assert.equal(r.dopoConn.prez, true, 'e NON tocca le linee di prezzo');
    assert.equal(r.dopoConn.linee, true, 'e NON spegne le linee posizioni (quindi neanche le TP/SL)');
    assert.equal(r.dopoPrez.prez, false, 'il secondo pulsante spegne le linee di prezzo');
    assert.equal(r.dopoPrez.conn, true, 'e NON tocca i connettori');
    assert.equal(r.dopoPrez.linee, true, 'e NON spegne le linee posizioni (quindi neanche le TP/SL)');
    assert.equal(r.dopoPrez.etic, true, 'né le etichette Target/Stop');
    assert.deepEqual(r.tornato, {conn:true, prez:true}, 'ripremendo si torna indietro');
    assert.equal(r.sync, true, 'le due scelte si sincronizzano fra i dispositivi');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// SEGNALATO dal proprietario (9 ottobre 2026): con l'interruttore acceso comparivano le
// orizzontali di prezzo anche delle operazioni GIA' CHIUSE. Con uno storico lungo sono centinaia
// di righe che attraversano tutto il grafico: «esce fuori un bordello».
// Devono esserci solo sulle posizioni APERTE, dove dicono a che prezzo si e' entrati su
// un'operazione ancora viva. Su una conclusa non aggiungono niente: ci sono gia' frecce e casella.
test('le orizzontali di prezzo si vedono solo sulle posizioni aperte, mai sui trade chiusi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      // Si contano le righe orizzontali che attraversano TUTTO il grafico: sono quelle del
      // prezzo. Le linee TP/SL non arrivano da bordo a bordo (stanno dentro la loro casella),
      // quindi non vengono contate e restano fuori da questa misura.
      const proto = CanvasRenderingContext2D.prototype;
      const vM = proto.moveTo, vL = proto.lineTo, vS = proto.stroke;
      let ultimo = null, intere = 0, larghezza = 0;
      proto.moveTo = function (x, y) { ultimo = {x1: x, y1: y}; return vM.apply(this, arguments); };
      proto.lineTo = function (x, y) { if (ultimo) { ultimo.x2 = x; ultimo.y2 = y; } return vL.apply(this, arguments); };
      proto.stroke = function () {
        // Solo le righe che partono dal BORDO SINISTRO e attraversano tutto: sono quelle del
        // prezzo. La linea che insegue il prezzo di una posizione aperta parte dalla candela di
        // apertura, non dal bordo, e quindi non viene contata: altrimenti si misurerebbe anche
        // quella, che dipende da un altro interruttore.
        if (ultimo && ultimo.x2 != null && Math.abs(ultimo.y1 - ultimo.y2) < 0.5
            && ultimo.x1 < 25 && (ultimo.x2 - ultimo.x1) > larghezza * 0.9) intere++;
        ultimo = null;
        return vS.apply(this, arguments);
      };
      const conta = () => { intere = 0; draw(); return intere; };
      // Tutti i tratti disegnati, serve come prova di controllo (vedi sotto).
      let tutti = 0;
      const vS2 = proto.stroke;
      proto.stroke = function () { tutti++; return vS2.apply(this, arguments); };
      const tuttiTratti = () => { tutti = 0; draw(); return tutti; };

      const t0 = Date.UTC(2024, 0, 1), R = [];
      for (let i = 0; i < 400; i++) {
        const p = 100 + Math.sin(i / 9) * 2;
        R.push({date: new Date(t0 + i * 60000).toISOString(), open: p, high: p + 1, low: p - 1, close: p, volume: 10});
      }
      rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1; visibleCount = 300;
      currentAssetKey = 'TEST:ASSET'; if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'TEST:ASSET';
      larghezza = (document.getElementById('chart').clientWidth || 800) - 40;

      // Il grafico disegna di suo delle orizzontali (la griglia dei prezzi): si misura quindi
      // quanto AGGIUNGONO le operazioni rispetto a un grafico vuoto, non il totale.
      positions = []; active = null; trades = [];
      const vuoto = conta();
      const trattiVuoto = tuttiTratti();

      // a) dieci operazioni CHIUSE, nessuna aperta
      trades = [];
      for (let i = 0; i < 10; i++) trades.push({
        id: 'T' + i, asset: 'TEST:ASSET', side: i % 2 ? 'BUY' : 'SELL',
        entry: 100 + i * 0.1, exit: 101 + i * 0.1, sl: 98, tp: 103, rrSl: 98, lots: 0.1,
        pl: i % 2 ? 10 : -10, pips: 10, mode: 'backtest',
        // DENTRO la finestra visibile (si vedono gli indici 100-399): fuori non verrebbero
        // disegnate affatto, e il test passerebbe per il motivo sbagliato.
        startTime: t0 + (150 + i * 10) * 60000, closedAt: new Date(t0 + (170 + i * 10) * 60000).toISOString()
      });
      const soloChiuse = conta() - vuoto;
      // CONTROLLO: le operazioni chiuse devono essere disegnate davvero (frecce, casella,
      // connettori). Se non lo fossero, l'assenza delle righe di prezzo non direbbe niente.
      const chiuseDisegnate = tuttiTratti() - trattiVuoto;

      // b) una posizione APERTA, nessuna chiusa
      trades = [];
      positions = [{id: 'P1', asset: 'TEST:ASSET', side: 'BUY', entry: 100.5, sl: 98, tp: 103,
                    rrSl: 98, lots: 0.1, start: 200, startTime: t0 + 200 * 60000, marginUsed: 10}];
      const conAperta = conta() - vuoto;

      // c) la stessa posizione aperta, ma con l'interruttore spento
      localStorage.setItem('fbl_linee_prezzo', '0');
      const apertaSpenta = conta() - vuoto;
      localStorage.setItem('fbl_linee_prezzo', '1');

      proto.moveTo = vM; proto.lineTo = vL; proto.stroke = vS;
      return {soloChiuse, conAperta, apertaSpenta, chiuseDisegnate};
    });
    assert.ok(r.chiuseDisegnate > 0,
      'le operazioni chiuse non vengono disegnate affatto: cosi il test non proverebbe niente');
    assert.equal(r.soloChiuse, 0,
      'dieci operazioni chiuse hanno aggiunto ' + r.soloChiuse + ' righe di prezzo al grafico: non devono essercene');
    // Una posizione aperta disegna anche altre orizzontali che partono da sinistra (le TP/SL
    // della sua casella), e dipendono da altri interruttori. Quello che si misura qui e' la
    // DIFFERENZA: spegnendo questo interruttore deve sparire esattamente UNA riga, quella del
    // prezzo di entrata, e nient'altro.
    assert.equal(r.conAperta - r.apertaSpenta, 1,
      'l interruttore deve togliere esattamente la riga del prezzo di entrata. Numeri: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
