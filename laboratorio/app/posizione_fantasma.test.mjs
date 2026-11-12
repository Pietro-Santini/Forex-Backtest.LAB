// LA POSIZIONE FANTASMA AL PREZZO 0 — banco DI PROVA DEL DIFETTO (misura, NON correzione).
//
// RIPRODUCE quello che il proprietario ha fotografato il 10 novembre 2026 sulla pagina
// DUPLICATA del grafico XAUUSD 5m: una posizione fantasma al prezzo 0, con profitto
// +24.452,88 €, che non esiste da nessuna parte (non in dashboard, non tra le posizioni
// aperte, non nel terminale MT5). Nel pannello di sinistra: «SELL 0.06 -24,11 €», «SELL 0.03
// -9,36 €», «BUY 0.01 -14,53 €», «SELL 0.11 -48,48 €» e il fantasma «BUY 0.06 +24.452,88 €».
//
// QUESTO BANCO E' ROSSO FINCHE' IL DIFETTO ESISTE. Asserisce il comportamente CORRETTO: un
// trade chiuso con il prezzo di entrata ASSENTE o A ZERO non deve essere disegnato. Oggi
// drawClosedTradeMarkers filtran solo `entry==null` (riga 17959 di app.html), e 0 non e' null:
// il fantasma passa e viene disegnato — ed e' per questo che il test cade oggi. Va fatto
// diventare VERDE con la cura (il filtro prezzo<=0), non silenziato.
//
// Il numero del proprietario nasce qui: XAUUSD ha contractSize=100 e plMode 'approx', quindi
// con entry=0 e uscita reale il P&L vale (4075,48-0)*100*0,06 = 24.452,88 € ESATTI, lo stesso
// valore che calculateForexPL darebbe anche con entry=null (perche' Number(null)===0).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Seicento candele da un minuto intorno a 4075 (l'oro dello screenshot): la chiusura a 4075,48
// sta dentro la fascia visibile, l'entrata a 0 sta molto sotto il fondo.
const PREPARA = () => {
  const t0 = Date.UTC(2026, 9, 20, 0, 0, 0);
  const R = [];
  for (let i = 0; i < 300; i++) {
    R.push({date: new Date(t0 + i * 60000).toISOString(),
            open: 4075, high: 4075.6, low: 4074.4, close: 4075, volume: 10});
  }
  rows = R; baseRows = R; idx = R.length - 1;
  viewEnd = R.length - 1; visibleCount = 300;
  currentAssetKey = 'XAUUSD';
  if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'XAUUSD';
  liveModeActive = false;               // sessione Storico/backtest: passa il filtro modo
  mt5Connected = false; fblBacktestModeAttivo = false;
  positions = []; pendingOrders = []; active = null;
  positionsVisible = true;
  try { localStorage.setItem('fbl_posizioni_chiuse', '1'); } catch(e) {}   // trade chiusi a grafico
  try { localStorage.setItem('fbl_connettori', '1'); } catch(e) {}          // linea apertura/chiusura
  followLatest = false;
  window.__t0 = t0;
};

// Il "fantasma": BUY 0,06 chiuso con l'ENTRATA rotta. entry è il parametro: 0 = il caso del
// proprietario; null = prezzo davvero assente (la prova di controllo, oggi scartato).
const FANTASMA = (entry) => ({
  id: 'T1', asset: 'XAUUSD', side: 'BUY', mode: 'backtest', mt5Ticket: null,
  entry: entry, exit: 4075.48, sl: 4070, tp: 4080, lots: 0.06,
  result: 'Win', pips: 0, pl: 0, pct: 0, account: 1000, strategy: '',
  startTime: window.__t0 + 100 * 60000,
  closedAt: new Date(window.__t0 + 160 * 60000).toISOString()
});

test('un trade chiuso senza prezzo di entrata non deve essere disegnato', async () => {
  // Slot valido per una finestra duplicata: da 2 a 9 (PIP_SLOT in app.html accetta solo quelli).
  const {browser, pagina, errori} = await apriApp({query: '?pipSlot=2'});   // pagina duplicata
  try{
    const r = await pagina.evaluate(({p, f}) => {
      eval('(' + p + ')')();
      const fai = eval('(' + f + ')');
      const misura = (entry) => {
        trades = [fai(entry)];
        draw();
        return {
          seg: closedTradeHitSegments.filter(s => s.tradeId === 'T1').length,
          pl: calculateForexPL('BUY', entry, 4075.48, 0.06, 'XAUUSD')
        };
      };
      const nullo = misura(null);   // entrata DAVVERO assente
      const zero  = misura(0);      // entrata mancante travestita da zero = il fantasma
      return {nullo, zero, pipSlot: (typeof PIP_SLOT !== 'undefined' ? PIP_SLOT : null)};
    }, {p: PREPARA.toString(), f: FANTASMA.toString()});

    assert.equal(r.pipSlot, 2, 'il banco gira sulla pagina duplicata (?pipSlot=2)');

    // PROVA DI CONTROLLO: senza un prezzo di entrata vero oggi non si disegna niente — quindi il
    // banco misura davvero il disegno (lezione: «un test sul disegno va prima visto fallire»).
    assert.equal(r.nullo.seg, 0,
      'PROVA DI CONTROLLO: con entry=null oggi non deve disegnare niente');

    // IL DIFETTO, RIPRODOTTO. entry=0 supera il filtro `==null` e viene disegnato, con il suo
    // profitto fantasma (+24.452,88 €). Questo assert è ROSSO finche' non c'è il filtro prezzo<=0.
    assert.equal(r.zero.seg, 0,
      'DIFETTO (10 nov 2026): drawClosedTradeMarkers disegna il trade chiuso anche con entry=0 ' +
      // DAL 12 NOVEMBRE il P/L di un prezzo mancante e' `null`, non piu' un numero inventato
      // (calculateForexPL rifiuta i prezzi non validi): il messaggio deve reggere tutti e due i
      // casi, o il banco cade mentre COSTRUISCE l'errore invece di misurare quello che dice.
      '(segmenti disegnati: ' + r.zero.seg + ', P&L fantasma ' +
      (r.zero.pl == null ? 'null (giusto: prezzo mancante)' : Number(r.zero.pl).toFixed(2)) + ' €). ' +
      'Un prezzo mancante travestito da zero non è un prezzo: non deve ne essere disegnato ne tenuto.');

    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
