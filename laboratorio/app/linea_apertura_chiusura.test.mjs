// LA LINEA APERTURA-CHIUSURA NON DEVE SPARIRE CON LO ZOOM LARGO.
//
// SEGNALATO dal proprietario fra i punti del telefono: «la linea apertura↔chiusura deve restare
// visibile anche con zoom largo (gli estremi fuori schermo)».
//
// IL PERCHE' ERA SCRITTO NEL CODICE: la linea si disegnava solo se almeno UNA delle due estremita'
// era dentro la vista (`openOnScreen||closeOnScreen`). Con lo zoom stretto sulle candele,
// un'operazione durata a lungo ha l'apertura fuori a sinistra e la chiusura fuori a destra:
// nessuna delle due e' a schermo, e il segmento che attraversa tutto il grafico non veniva
// disegnato affatto. Il commento sopra quel codice diceva «SEMPRE visibile», ma quel «sempre»
// parlava dell'hover, non dello zoom.
//
// Adesso il segmento si taglia sul riquadro del grafico (fblSegmentoNelRiquadro) e si disegna il
// pezzo che si vede. Tagliare non e' un dettaglio: senza, il tratteggio finirebbe sopra la scala
// prezzi e la barra del tempo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

// Trecento candele piatte intorno a 100; la vista si stringe a venti candele nel MEZZO, cosi' le
// due estremita' del trade restano fuori a destra e a sinistra.
const PREPARA = () => {
  const t0 = Date.UTC(2026, 9, 20, 0, 0, 0);
  const R = [];
  for (let i = 0; i < 300; i++) {
    R.push({date: new Date(t0 + i * 60000).toISOString(),
            open: 100, high: 100.4, low: 99.6, close: 100, volume: 10});
  }
  rows = R; baseRows = R; idx = R.length - 1;
  currentAssetKey = 'EURUSD';
  if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; mt5Connected = false;
  positions = []; pendingOrders = []; active = null; replayForm = null;
  positionsVisible = true;
  try { localStorage.setItem('fbl_posizioni_chiuse', '1'); } catch(e) {}   // trade conclusi a grafico
  try { localStorage.setItem('fbl_connettori', '1'); } catch(e) {}
  followLatest = false;
  visibleCount = 20; viewEnd = 150;    // vista stretta, in mezzo al trade
  window.__t0 = t0;
};

const UN_TRADE = (apre, chiude) => ({
  id: 'T1', asset: 'EURUSD', side: 'BUY', mode: 'backtest', mt5Ticket: null,
  entry: 100, exit: 100, sl: 99.5, tp: 100.5, rrSl: 99.5, lots: 0.1,
  result: 'Win', pips: 0, pl: 5, pct: 0.5, account: 1000, strategy: '',
  startTime: window.__t0 + apre * 60000,
  closedAt: new Date(window.__t0 + chiude * 60000).toISOString()
});

test('il taglio sul riquadro: un segmento che attraversa si vede, uno fuori no', async () => {
  // Il conto puro, prima del disegno: e' qui che un errore di segno o di bordo si vede subito.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const R = [0, 0, 100, 100];   // riquadro: x 0..100, y 0..100
      const t = (x1,y1,x2,y2) => fblSegmentoNelRiquadro(x1,y1,x2,y2,R[0],R[1],R[2],R[3]);
      return {
        attraversa: t(-50, 50, 150, 50),      // entrambe le punte fuori, passa in mezzo
        diagonale: t(-20, -20, 120, 120),     // attraversa in diagonale
        tuttoFuori: t(-50, 50, -10, 50),      // tutto a sinistra
        sopra: t(-50, -5, 150, -5),           // passa sopra il riquadro
        dentro: t(10, 10, 90, 90),            // tutto dentro: resta com'e'
        punto: t(50, 50, 50, 50),             // un punto dentro
        puntoFuori: t(500, 500, 500, 500)
      };
    });
    assert.ok(r.attraversa, 'un segmento con entrambe le punte fuori, che attraversa, DEVE vedersi');
    assert.equal(Math.round(r.attraversa.x1), 0, 'tagliato sul bordo sinistro');
    assert.equal(Math.round(r.attraversa.x2), 100, 'e su quello destro');
    assert.equal(r.attraversa.y1, 50, 'senza spostarsi in verticale');
    assert.ok(r.diagonale, 'anche in diagonale: ' + JSON.stringify(r.diagonale));
    assert.equal(r.tuttoFuori, null, 'un segmento tutto fuori non si disegna');
    assert.equal(r.sopra, null, 'nemmeno uno che passa sopra il riquadro');
    assert.deepEqual([r.dentro.x1, r.dentro.y1, r.dentro.x2, r.dentro.y2], [10, 10, 90, 90],
      'un segmento tutto dentro non va accorciato');
    assert.ok(r.punto, 'un punto dentro il riquadro si vede');
    assert.equal(r.puntoFuori, null, 'un punto fuori no');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('a grafico: con le due estremita\' fuori schermo la linea c\'e\' comunque', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(({p, u}) => {
      eval('(' + p + ')')();
      const fai = eval('(' + u + ')');
      // Apertura alla candela 10, chiusura alla 290: la vista guarda le venti candele intorno
      // alla 150, quindi entrambe le estremita' stanno fuori.
      trades = [fai(10, 290)];
      draw();
      const lungo = closedTradeHitSegments.filter(s => s.tradeId === 'T1');
      // PROVA DI CONTROLLO: un trade che si apre e si chiude tutto a sinistra della vista non
      // deve disegnare niente. Senza questa, il test passerebbe anche se la linea venisse
      // disegnata SEMPRE, che e' l'errore opposto e sporcherebbe il grafico.
      trades = [fai(2, 8)];
      draw();
      const fuori = closedTradeHitSegments.filter(s => s.tradeId === 'T1');
      return {
        lungo: lungo.length, fuori: fuori.length,
        seg: lungo[0] || null,
        riquadro: (() => { const c = document.getElementById('chart');
                           return {w: c.width, h: c.height}; })()
      };
    }, {p: PREPARA.toString(), u: UN_TRADE.toString()});
    assert.equal(r.lungo, 1,
      'la linea del trade che attraversa la vista deve essere disegnata, con le punte fuori schermo');
    assert.equal(r.fuori, 0,
      'ma un trade tutto fuori dalla vista non deve disegnare niente');
    // Tagliata dentro il riquadro: se finisse sopra la scala prezzi si vedrebbe il tratteggio
    // attraversare i numeri.
    assert.ok(r.seg.x1 >= 0 && r.seg.x2 <= r.riquadro.w,
      'il pezzo disegnato sta dentro il canvas: ' + JSON.stringify(r.seg));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('tutte le linee apertura-chiusura passano dal taglio, non solo una', () => {
  // Il modo in cui questa correzione puo' fallire a metà: ce ne sono QUATTRO, di connettori
  // (trade chiusi, trade ancora aperto in replay-Live, drawOpenTradeProgress, posizioni
  // dell'altro conto). Correggerne uno e lasciare gli altri avrebbe fatto credere che il
  // difetto fosse chiuso.
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const quante = src.split('fblSegmentoNelRiquadro(').length - 1;
  assert.ok(quante >= 5, 'la funzione piu\' le sue quattro chiamate: trovate ' + quante);
  assert.ok(!/moveTo\(xOpen,\s*yOpen\)/.test(src),
    'nessun connettore deve disegnare ancora dalle punte intere: resterebbe tagliato fuori dalla vista');
});
