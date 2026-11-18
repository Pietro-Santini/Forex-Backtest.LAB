// LA SCALETTA DEI SETUP — l'indicatore non deve disegnare il risultato già pronto.
//
// CHIESTO DAL PROPRIETARIO (18 novembre 2026): «non voglio un indicatore che mi disegna il
// risultato già pronto, voglio vedere l'evoluzione passo passo. Prende un punto di riferimento,
// poi vede se la struttura è validata o invalidata. Primo punto confermato, secondo punto
// confermato, terzo punto confermato e allora si entra. Con una lista di controllo in un angolo».
// E sull'operazione: entrata, stop, target col rapporto rischio/rendimento e il lottaggio
// calcolato sul conto del programma, non a mano.
//
// QUI SI PROVA il Valid BOS Pullback, che è l'indicatore delle schermate del proprietario. I
// passi sono cinque più l'operazione:
//     Riferimento -> Rottura iniziale -> Estremo confermato -> Pullback valido ->
//     Rottura confermata -> Operazione
//
// LE DUE REGOLE CHE NON DEVONO MAI ROMPERSI, e sono il motivo di questo banco:
//   1. un passo non può accendersi se quello prima non è acceso (altrimenti la scaletta
//      racconta una costruzione che non è avvenuta);
//   2. quando un setup si invalida i passi tornano in attesa e la scaletta scrive il perché,
//      invece di restare accesa su un setup morto.
//
// Le candele sono scritte a mano, una per una, perché ogni barra ha un compito preciso: senza
// questo non si può dire «il passo tre si accende alla barra sette» e il banco diventa un
// misuratore di rumore.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// [open, high, low, close] — prezzi intorno a 100, tick 0,01.
// Parametri usati: leftBars 2, rightBars 2, touchTicks 1, minUntouchedBars 2, tickSize 0,01.
const BOS_RIALZISTA = [
  [100.00, 100.50,  99.50, 100.00],  // 0
  [100.00, 100.60,  99.60, 100.20],  // 1
  [100.20, 101.00, 100.00, 100.80],  // 2  il massimo 101,00: diventa il RIFERIMENTO
  [100.80, 100.90, 100.30, 100.50],  // 3
  [100.40, 100.80, 100.20, 100.40],  // 4  due barre a destra: il pivot è confermato
  [100.40, 101.50, 100.30, 101.30],  // 5  ROTTURA INIZIALE: chiusura 101,30 sopra 101,00
  [101.30, 101.40, 101.10, 101.20],  // 6  nessun massimo nuovo, non tocca il riferimento
  [101.20, 101.45, 101.05, 101.10],  // 7  ESTREMO CONFERMATO (101,50 fermo da due barre)
  [101.10, 101.20, 100.95, 101.05],  // 8  PULLBACK VALIDO: torna sul riferimento e tiene
  [101.05, 101.80, 101.00, 101.70]   // 9  ROTTURA CONFERMATA: chiusura sopra l'estremo 101,50
];

// Come la precedente, ma alla barra 8 il prezzo CHIUDE sotto il riferimento: il setup muore.
const BOS_INVALIDATO = BOS_RIALZISTA.slice(0, 8).concat([
  [101.10, 101.20, 100.40, 100.50]   // 8  chiusura 100,50 sotto 101,00 - allow: setup invalido
]);

const PARAMETRI = {leftBars: 2, rightBars: 2, touchTicks: 1, minUntouchedBars: 2,
                   minExtensionTicks: 1, tickSize: 0.01, rrTarget: 2};

// Esegue l'indicatore barra per barra e riporta, per ogni barra, lo stato dei sei passi.
const PASSO_PASSO = (spec, parametri) => `(() => {
  const def = INDICATOR_DEFS['valid_bos_pullback'];
  const ind = hydrateIndicators([{id: 1, key: 'valid_bos_pullback', params: def.defaultParams()}])[0];
  Object.assign(ind.params, ${JSON.stringify(parametri)});
  const R = ${JSON.stringify(spec)}.map((a, i) => ({
    date: new Date(Date.UTC(2024, 0, 1, 0, i, 0)).toISOString(),
    open: a[0], high: a[1], low: a[2], close: a[3], volume: 100
  }));
  rows = R;
  const storia = [];
  for (let i = 0; i < R.length; i++) {
    idx = i;
    def.compute(R, i, ind);
    const sc = ind.calc.scaletta;
    storia.push({
      barra: i,
      nomi: sc.passi.map(p => p.nome),
      stati: sc.passi.map(p => p.stato),
      note: sc.passi.map(p => p.nota),
      esito: sc.esito,
      op: sc.operazione ? {dir: sc.operazione.dir, entry: sc.operazione.entry, sl: sc.operazione.sl,
                           tp: sc.operazione.tp, rr: sc.operazione.rr,
                           lotto: sc.operazione.lotto} : null
    });
  }
  return {storia, completati: ind.calc.snaps.length};
})()`;

const NOMI = ['Riferimento', 'Rottura iniziale', 'Estremo confermato', 'Pullback valido',
              'Rottura confermata', 'Operazione'];

test('i passi si accendono uno alla volta, nell\'ordine della costruzione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PASSO_PASSO(BOS_RIALZISTA, PARAMETRI));

    assert.deepEqual(r.storia[0].nomi, NOMI, 'i passi mostrati non sono quelli della costruzione');

    // REGOLA 1: mai un passo acceso col precedente spento, su nessuna barra.
    for (const s of r.storia) {
      for (let k = 1; k < s.stati.length; k++) {
        assert.ok(!(s.stati[k] === 'ok' && s.stati[k - 1] !== 'ok'),
          `barra ${s.barra}: il passo ${k + 1} è acceso ma il ${k} no — ${JSON.stringify(s.stati)}`);
      }
    }

    // Le barre in cui ogni passo si accende per la prima volta: sono scritte nelle candele.
    const acceso = k => r.storia.findIndex(s => s.stati[k] === 'ok');
    assert.equal(acceso(0), 4, 'il riferimento si vede quando il pivot è confermato (barra 4)');
    assert.equal(acceso(1), 5, 'la rottura iniziale è alla barra 5');
    assert.equal(acceso(2), 7, 'l\'estremo è confermato alla barra 7');
    assert.equal(acceso(3), 8, 'il pullback valido è alla barra 8');
    assert.equal(acceso(4), 9, 'la rottura confermata è alla barra 9');
    assert.equal(acceso(5), 9, 'l\'operazione nasce con la rottura confermata');

    // Alla fine la scaletta è tutta accesa e il setup è fra quelli disegnati.
    const fine = r.storia[r.storia.length - 1];
    assert.deepEqual(fine.stati, ['ok', 'ok', 'ok', 'ok', 'ok', 'ok'],
      'a setup finito tutti i passi devono essere accesi: ' + JSON.stringify(fine.stati));
    assert.equal(r.completati, 1, 'il setup completato deve restare disegnato');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l\'operazione porta entrata, stop, target, R:R e lottaggio del conto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      // Conto noto, così il lottaggio si può controllare col numero in mano:
      // rischio dell'1% di 10.000 = 100.
      realizedBalanceNow = () => 10000;
      const campo = document.getElementById('risk');
      if (campo) campo.value = '1';
      const out = ${PASSO_PASSO(BOS_RIALZISTA, PARAMETRI)};
      out.contratto = contractSize();
      out.modo = currentInstrument().plMode;
      return out;
    })()`);
    const op = r.storia[r.storia.length - 1].op;
    assert.ok(op, 'alla rottura confermata deve esserci un\'operazione');
    assert.equal(op.dir, 1, 'il setup era rialzista');
    assert.equal(op.entry, 101.70, 'si entra alla chiusura che rompe l\'estremo');
    assert.equal(op.sl, 101.00, 'lo stop sta sul livello ritestato');
    assert.ok(op.sl < op.entry && op.tp > op.entry, 'stop e target dalla parte sbagliata');
    const rr = Math.abs(op.tp - op.entry) / Math.abs(op.entry - op.sl);
    assert.ok(Math.abs(rr - PARAMETRI.rrTarget) < 0.0001,
      'il target non rispetta il R:R chiesto: ' + rr.toFixed(3));

    // Il lottaggio: stessa strada del pannello ordini (saldo × rischio% / perdita per lotto).
    assert.ok(op.lotto, 'il lottaggio non è stato calcolato');
    assert.equal(Math.round(op.lotto.rischio), 100, 'il rischio in valuta non è l\'1% di 10.000');
    assert.ok(op.lotto.lotti > 0, 'lotti a zero');
    const perLotto = r.modo === 'baseEqualsAccount'
      ? (op.entry - op.sl) * r.contratto / op.entry
      : (op.entry - op.sl) * r.contratto;
    assert.ok(Math.abs(op.lotto.lotti * perLotto - 100) <= 100 * 0.05 + perLotto * 0.01,
      'col lottaggio proposto la perdita allo stop non è il rischio chiesto: '
      + (op.lotto.lotti * perLotto).toFixed(2));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('setup invalidato: i passi tornano in attesa e la scaletta dice perché', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PASSO_PASSO(BOS_INVALIDATO, PARAMETRI));
    const fine = r.storia[r.storia.length - 1];
    assert.equal(fine.stati[1], 'attesa', 'la rottura iniziale doveva tornare in attesa');
    assert.equal(fine.stati[2], 'attesa', 'l\'estremo confermato doveva tornare in attesa');
    assert.equal(fine.stati[5], 'attesa', 'non c\'è nessuna operazione da mostrare');
    assert.equal(fine.op, null, 'un setup morto non deve lasciare un\'operazione accesa');
    assert.ok(/riferimento/i.test(fine.esito),
      'la scaletta deve scrivere il motivo, invece dice: ' + JSON.stringify(fine.esito));
    assert.equal(r.completati, 0, 'nessun setup completato');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la lista di controllo si disegna, nei quattro angoli, e sparisce se spenta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      const def = INDICATOR_DEFS['valid_bos_pullback'];
      const ind = hydrateIndicators([{id: 1, key: 'valid_bos_pullback', params: def.defaultParams()}])[0];
      Object.assign(ind.params, ${JSON.stringify(PARAMETRI)});
      const R = ${JSON.stringify(BOS_RIALZISTA)}.map((a, i) => ({
        date: new Date(Date.UTC(2024, 0, 1, 0, i, 0)).toISOString(),
        open: a[0], high: a[1], low: a[2], close: a[3], volume: 100
      }));
      rows = R; idx = R.length - 1;
      def.compute(R, idx, ind);

      // Contesto finto che conta i riquadri e raccoglie le scritte: la lista di controllo è
      // un riquadro con dentro i passi.
      const fatto = () => {
        const riquadri = [], scritte = [];
        const ctx = {canvas: {width: 1300, height: 700},
          save(){}, restore(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){},
          setLineDash(){}, strokeRect(){}, fillRect(x, y, w, h){ riquadri.push([x, y, w, h]); },
          fillText(t, x, y){ scritte.push(String(t)); }, measureText(t){ return {width: String(t).length * 6}; },
          set font(v){}, set textAlign(v){}, set textBaseline(v){}, set fillStyle(v){},
          set strokeStyle(v){}, set lineWidth(v){}, set globalAlpha(v){}};
        def.render(ctx, ind, R, 0, R.length - 1, j => j * 10, v => 700 - (v - 100) * 100);
        return {riquadri, scritte};
      };

      const accesa = fatto();
      const angoli = {};
      for (const pos of SCALETTA_POSIZIONI) {
        ind.params.posScaletta = pos;
        const q = fatto();
        angoli[pos] = q.riquadri.length ? q.riquadri[0] : null;
      }
      ind.params.mostraScaletta = false;
      const spenta = fatto();
      return {accesa, angoli, spentaRiquadri: spenta.riquadri.length, posizioni: SCALETTA_POSIZIONI};
    })()`);

    assert.equal(r.accesa.riquadri.length, 1, 'la lista di controllo deve disegnare il suo riquadro');
    for (const nome of NOMI) {
      assert.ok(r.accesa.scritte.some(t => t.includes(nome)),
        'nel riquadro manca il passo «' + nome + '»');
    }
    assert.ok(r.accesa.scritte.some(t => t === 'Entry' || t === 'Stop' || t === 'Target'),
      'nel riquadro mancano entrata, stop e target');

    // I quattro angoli devono essere davvero quattro posizioni diverse.
    const chiavi = r.posizioni.map(p => (r.angoli[p] || []).join(','));
    assert.equal(new Set(chiavi).size, 4, 'le quattro posizioni finiscono nello stesso punto: ' + JSON.stringify(chiavi));
    assert.equal(r.spentaRiquadri, 0, 'con la scaletta spenta non si deve disegnare nulla');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
