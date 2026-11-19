// VALID BOS PULLBACK: DUE ENTRATE CHE CONVIVONO.
//
// CHIESTO DAL PROPRIETARIO: «le entrate sono due, e devono convivere».
//
//   ENTRATA 1 - AL PULLBACK. Si entra dove c'e' il cerchietto, cioe' sul ritest del livello.
//     Lo stop sta sotto il minimo della barra del ritest (piu' un cuscinetto in tick): se quel
//     minimo viene perso, il ritest non ha tenuto e il setup non esiste piu'.
//     Il target NON e' una proiezione: e' LA ZONA DELLA ROTTURA, cioe' l'estremo che il prezzo
//     deve rompere per confermare. E' li' che la prima operazione chiude, ed e' esattamente il
//     punto in cui la seconda comincia.
//
//   ENTRATA 2 - ALLA CONFERMA. Quella di sempre: si entra alla chiusura che rompe l'estremo,
//     lo stop sul livello ritestato, il target proiettato al R:R scelto.
//
// LE DUE REGOLE CHE QUESTO BANCO DIFENDE:
//   1. le due operazioni CONVIVONO: quando arriva la conferma, la prima non sparisce. Sono due
//      operazioni diverse, con due stop diversi e due target diversi;
//   2. ognuna porta il SUO lottaggio. Gli stop sono a distanze diverse dall'entrata, quindi lo
//      stesso lotto su tutte e due vorrebbe dire rischiare due cifre diverse: e' il difetto che
//      il proprietario ha gia' pagato col lotto arrotondato male (2.2.63).
//
// E tutti i livelli vanno DISEGNATI sul grafico - linee, non numeri dentro un riquadro.
//
// Le candele sono le stesse di scaletta_setup.test.mjs, scritte a mano una per una: ogni barra
// ha un compito preciso, e senza questo non si puo' dire «la prima entrata nasce alla barra 8».
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// [open, high, low, close] — prezzi intorno a 100, tick 0,01.
const BOS_RIALZISTA = [
  [100.00, 100.50,  99.50, 100.00],  // 0
  [100.00, 100.60,  99.60, 100.20],  // 1
  [100.20, 101.00, 100.00, 100.80],  // 2  il massimo 101,00: diventa il RIFERIMENTO
  [100.80, 100.90, 100.30, 100.50],  // 3
  [100.40, 100.80, 100.20, 100.40],  // 4  due barre a destra: il pivot e' confermato
  [100.40, 101.50, 100.30, 101.30],  // 5  ROTTURA INIZIALE, e l'estremo e' 101,50
  [101.30, 101.40, 101.10, 101.20],  // 6
  [101.20, 101.45, 101.05, 101.10],  // 7  ESTREMO CONFERMATO
  [101.10, 101.20, 100.95, 101.05],  // 8  PULLBACK VALIDO  -> ENTRATA 1
  [101.05, 101.80, 101.00, 101.70]   // 9  ROTTURA CONFERMATA -> ENTRATA 2
];

const PARAMETRI = {leftBars: 2, rightBars: 2, touchTicks: 1, minUntouchedBars: 2,
                   minExtensionTicks: 1, tickSize: 0.01, rrTarget: 2};

// Esegue l'indicatore barra per barra e riporta le operazioni vive a ogni barra.
const PASSO_PASSO = `(() => {
  // Conto noto, cosi' il lottaggio si puo' controllare col numero in mano: 1% di 10.000 = 100.
  realizedBalanceNow = () => 10000;
  const campo = document.getElementById('risk');
  if (campo) campo.value = '1';

  const def = INDICATOR_DEFS['valid_bos_pullback'];
  const ind = hydrateIndicators([{id: 1, key: 'valid_bos_pullback', params: def.defaultParams()}])[0];
  Object.assign(ind.params, ${JSON.stringify(PARAMETRI)});
  const R = ${JSON.stringify(BOS_RIALZISTA)}.map((a, i) => ({
    date: new Date(Date.UTC(2024, 0, 1, 0, i, 0)).toISOString(),
    open: a[0], high: a[1], low: a[2], close: a[3], volume: 100
  }));
  rows = R;
  const storia = [];
  for (let i = 0; i < R.length; i++) {
    idx = i;
    def.compute(R, i, ind);
    const leggi = o => ({nome: o.nome, dir: o.dir, entry: o.entry, sl: o.sl, tp: o.tp, rr: o.rr,
      barra: o.barra, esito: o.esito || null, barraFine: o.barraFine,
      lotti: o.lotto ? o.lotto.lotti : null, rischio: o.lotto ? o.lotto.rischio : null});
    const ops = (ind.calc.ops || []).map(leggi);
    const finite = (ind.calc.opsFinite || []).map(leggi);
    storia.push({barra: i, ops, finite});
  }
  return {storia, contratto: contractSize(), modo: currentInstrument().plMode};
})()`;

const alBarra = (r, n) => r.storia[n].ops;
const conNome = (ops, nome) => ops.find(o => o.nome === nome) || null;

test('al pullback nasce la PRIMA entrata: stop sotto il minimo del ritest, target sulla zona della rottura', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PASSO_PASSO);

    // Prima del ritest non c'e' niente da comprare.
    assert.deepEqual(alBarra(r, 7), [], 'alla barra 7 il pullback non c\'e\' ancora: nessuna operazione');

    const pb = conNome(alBarra(r, 8), 'pullback');
    assert.ok(pb, 'alla barra 8 (pullback valido) deve nascere la prima entrata');
    assert.equal(pb.dir, 1, 'il setup era rialzista');
    assert.equal(pb.barra, 8, 'la prima entrata nasce sulla barra del ritest');
    assert.equal(pb.entry, 101.05, 'si entra alla chiusura della barra del ritest');

    // Lo stop: sotto il minimo del ritest (100,95), col cuscinetto di un tick (0,01).
    assert.ok(pb.sl < 100.95, 'lo stop deve stare SOTTO il minimo del ritest (100,95): e ' + pb.sl);
    assert.ok(Math.abs(pb.sl - 100.94) < 1e-9, 'lo stop e il minimo del ritest meno un tick: atteso 100,94, trovato ' + pb.sl);

    // Il target: la zona della rottura, cioe' l'estremo da rompere. Non una proiezione.
    assert.ok(Math.abs(pb.tp - 101.50) < 1e-9,
      'il target della prima entrata e la zona della rottura (101,50), non una proiezione: ' + pb.tp);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('alla conferma nasce la SECONDA entrata, e la prima incassa il suo target', async () => {
  // LA REGOLA, scritta dopo aver misurato: il target della prima entrata E' la zona della
  // rottura, e la rottura confermata e' proprio il prezzo che attraversa quella zona. Quindi
  // nella barra che fa nascere la seconda entrata, la prima ha gia' incassato - e' il suo esito
  // migliore, non una sparizione. Le due convivono nelle barre fra il ritest e la conferma; qui
  // si pretende che la prima sia CHIUSA A TARGET e resti a vista con scritto come e' finita.
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PASSO_PASSO);

    // Prima della conferma le due possono convivere davvero: alla barra 8 la prima e' viva.
    assert.ok(conNome(alBarra(r, 8), 'pullback'), 'premessa: alla barra 8 la prima entrata e viva');

    const ops = alBarra(r, 9);
    const cf = conNome(ops, 'conferma');
    const pb = conNome(r.storia[9].finite, 'pullback');
    assert.ok(cf, 'alla barra 9 (rottura confermata) deve esserci la seconda entrata');
    assert.ok(pb, 'la prima non deve sparire in silenzio: deve restare col suo esito');
    assert.equal(pb.esito, 'target', 'la prima ha raggiunto la zona della rottura: esito target');
    assert.equal(pb.barraFine, 9, 'e ci e arrivata nella barra della conferma');

    assert.equal(cf.entry, 101.70, 'si entra alla chiusura che rompe l\'estremo');
    assert.equal(cf.sl, 101.00, 'lo stop della seconda sta sul livello ritestato');
    const rr = Math.abs(cf.tp - cf.entry) / Math.abs(cf.entry - cf.sl);
    assert.ok(Math.abs(rr - PARAMETRI.rrTarget) < 1e-6,
      'il target della seconda e proiettato al R:R chiesto: trovato 1:' + rr.toFixed(3));

    // Due target diversi, e il primo cade dove la seconda comincia.
    assert.ok(pb.tp < cf.tp, 'i due target devono essere diversi, e quello del pullback piu\' vicino');
    assert.ok(pb.tp <= cf.entry,
      'il target della prima cade dove comincia la seconda: ' + pb.tp + ' contro ' + cf.entry);
    assert.ok(pb.sl !== cf.sl, 'due stop diversi: la prima rischia il minimo del ritest, la seconda il livello');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ogni entrata porta il SUO lottaggio: stop diversi, lotti diversi, stesso rischio', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PASSO_PASSO);
    const pb = conNome(alBarra(r, 8), 'pullback');      // viva alla barra del ritest
    const cf = conNome(alBarra(r, 9), 'conferma');

    assert.ok(pb.lotti > 0 && cf.lotti > 0,
      'tutte e due devono avere un lottaggio: ' + JSON.stringify([pb, cf]));
    assert.equal(Math.round(pb.rischio), 100, 'il rischio della prima e l\'1% di 10.000');
    assert.equal(Math.round(cf.rischio), 100, 'e anche quello della seconda');

    // Lo stop della prima e' piu' stretto (0,11) di quello della seconda (0,70): a parita' di
    // rischio il lotto deve essere PIU' GRANDE. Un lotto uguale vorrebbe dire due rischi diversi.
    const dPb = Math.abs(pb.entry - pb.sl), dCf = Math.abs(cf.entry - cf.sl);
    assert.ok(dPb < dCf, 'premessa: lo stop del pullback e piu stretto');
    assert.ok(pb.lotti > cf.lotti,
      'a parita di rischio, stop piu stretto = lotto piu grande: ' + pb.lotti + ' contro ' + cf.lotti);

    // E il conto torna: lotti x perdita per lotto = il rischio chiesto.
    const perLotto = (entry, sl) => r.modo === 'baseEqualsAccount'
      ? Math.abs(entry - sl) * r.contratto / entry : Math.abs(entry - sl) * r.contratto;
    for (const o of [pb, cf]) {
      const perdita = o.lotti * perLotto(o.entry, o.sl);
      assert.ok(Math.abs(perdita - 100) <= 100 * 0.05 + perLotto(o.entry, o.sl) * 0.01,
        'col lotto proposto per «' + o.nome + '» la perdita allo stop non e il rischio chiesto: ' + perdita.toFixed(2));
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('tutti i livelli delle due entrate finiscono SUL GRAFICO, come linee', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      realizedBalanceNow = () => 10000;
      const campo = document.getElementById('risk'); if (campo) campo.value = '1';
      const def = INDICATOR_DEFS['valid_bos_pullback'];
      const ind = hydrateIndicators([{id: 1, key: 'valid_bos_pullback', params: def.defaultParams()}])[0];
      Object.assign(ind.params, ${JSON.stringify(PARAMETRI)});
      const R = ${JSON.stringify(BOS_RIALZISTA)}.map((a, i) => ({
        date: new Date(Date.UTC(2024, 0, 1, 0, i, 0)).toISOString(),
        open: a[0], high: a[1], low: a[2], close: a[3], volume: 100
      }));
      rows = R; idx = R.length - 1;
      def.compute(R, idx, ind);

      // Contesto finto: raccoglie i segmenti tracciati e le scritte.
      const segmenti = [], scritte = [];
      let yCorrente = null;
      const ctx = {canvas: {width: 1300, height: 700},
        save(){}, restore(){}, beginPath(){ yCorrente = null; },
        moveTo(x, y){ yCorrente = y; }, lineTo(x, y){ if (yCorrente === y) segmenti.push(y); },
        stroke(){}, setLineDash(){}, strokeRect(){}, fillRect(){},
        fillText(t){ scritte.push(String(t)); }, measureText(t){ return {width: String(t).length * 6}; },
        set font(v){}, set textAlign(v){}, set textBaseline(v){}, set fillStyle(v){},
        set strokeStyle(v){}, set lineWidth(v){}, set globalAlpha(v){}};
      const y = v => 700 - (v - 100) * 100;
      def.render(ctx, ind, R, 0, R.length - 1, j => j * 10, y);
      const tutte = (ind.calc.ops || []).concat(ind.calc.opsFinite || []);
      return {segmenti, scritte, ops: tutte.map(o => ({nome: o.nome, entry: o.entry, sl: o.sl, tp: o.tp, esito: o.esito || null})),
              y: {e1: y(101.05), s1: y(100.94), t1: y(101.50), e2: y(101.70), s2: y(101.00)}};
    })()`);

    assert.equal(r.ops.length, 2,
      'premessa: due operazioni da disegnare (la conferma viva e il pullback chiuso a target): '
      + JSON.stringify(r.ops));
    // Sei livelli disegnati: entrata, stop e target di ciascuna.
    const vicino = (v) => r.segmenti.some(s => Math.abs(s - v) < 0.6);
    assert.ok(vicino(r.y.e1), 'manca la linea dell\'entrata al pullback');
    assert.ok(vicino(r.y.s1), 'manca la linea dello stop del pullback');
    assert.ok(vicino(r.y.t1), 'manca la linea del target del pullback (la zona della rottura)');
    assert.ok(vicino(r.y.e2), 'manca la linea dell\'entrata alla conferma');
    assert.ok(vicino(r.y.s2), 'manca la linea dello stop della conferma');

    // E si deve capire quale e quale, senza indovinare.
    const testo = r.scritte.join(' | ').toLowerCase();
    assert.ok(/pullback/.test(testo), 'sul grafico non si legge quale e l\'entrata al pullback: ' + testo);
    assert.ok(/conferma/.test(testo), 'sul grafico non si legge quale e l\'entrata alla conferma: ' + testo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
