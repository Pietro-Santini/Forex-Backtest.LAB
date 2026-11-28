// APERTURE AUTOMATICHE NEL REPLAY IN MODALITA' STORICO (backtest CSV).
//
// RICHIESTO dal proprietario: «vedere nel replay come gli indicatori aprono e chiudono le
// posizioni; le posizioni devono andare a finire sul conto storico e non sul conto capital.com o
// mt5 in live ... associa lo stesso identico conto storico che utilizzo per i file CSV».
//
// PRIMA DELLA CURA (misurato): in Storico nessuno apriva. `bosPuoAutoAprireDemo` vuole il Live e
// MT5 demo; `fblPuoAprireSulConto` vuole un tipo di conto MT5; il motore in sottofondo si fermava
// su «non sei in diretta». Il banco qui sotto pretende esattamente le quattro cose chieste:
//  1. le posizioni nascono NEL conto storico (positions[]), non su MT5/Capital.com;
//  2. ZERO chiamate a placeRealMt5Order (si sostituisce e si conta);
//  3. le chiusure a stop/obiettivo finiscono nel Journal con mode:'backtest';
//  4. nessun segnale dal futuro: il motore non calcola mai una candela oltre masterTime.
// In piu': lo stato del motore in Storico non deve sporcare quello del Live (ombre, registro,
// sospensioni), che vive nelle stesse chiavi localStorage.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Candele finte M1 che salgono piano: +0.3 al minuto, ombre di 0.5.
// Con stop a 0.5 sotto l'entrata e obiettivo a 2R (+1.0) il target arriva in pochi minuti.
function PREPARA(){
  const t0 = Date.parse('2026-11-20T00:00:00Z');
  const R = [];
  let p = 4000;
  for (let i = 0; i < 400; i++) {
    const o = p, c = p + 0.3;
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: o,
            high: Math.max(o, c) + 0.5, low: Math.min(o, c) - 0.3, close: c, volume: 10});
    p = c;
  }
  baseRows = R; rows = R; rowsAssetKey = 'XAUUSD';
  currentTF = 1; liveModeActive = false; liveReplayActive = false; liveReplaySelecting = false;
  mt5Connected = true;                       // MT5 collegato: e' il caso pericoloso
  mt5ActiveSymbol = 'XAUUSD';
  mt5AccountInfo = {login:'12345', server:'Demo-Server', balance:10000, equity:10000, currency:'EUR', reale:false};
  currentAssetKey = 'XAUUSD';
  // Si parte da meta' CSV: le posizioni che nascono da qui in poi sono quelle del replay.
  masterTime = Date.parse(R[200].date);
  idx = 200; viewEnd = 201; visibleCount = 200;
  positions = []; trades = []; pendingOrders = []; active = null; equity = [];
  const sel = document.getElementById('market');
  if (sel) {
    if (!Array.from(sel.options).some(o => o.value === 'XAUUSD')) {
      const o = document.createElement('option'); o.value = 'XAUUSD'; o.textContent = 'XAU/USD'; sel.appendChild(o);
    }
    sel.value = 'XAUUSD';
  }
}

// Una regola di prova, agganciata all'impianto VERO del motore: stessa forma delle regole in
// FBL_MOTORE_REGOLE e stessa estrazione del segnale (`segnale:'xausweep'`). Non simula l'apertura:
// quella la fa il codice dell'app, che e' cio' che si vuole misurare.
function MONTA_REGOLA_PROVA(){
  INDICATOR_DEFS['prova_storico'] = {
    defaultParams: () => ({}),
    compute: (rowsTf, k, ind) => {
      const r = rowsTf[k];
      if (!r) return;
      ind.calc.operazioni = [{da:k, dir:1, stopIniziale:r.close - 0.5}];
      ind.calc.vistoFino = r.date;                     // sonda: l'ultima candela calcolata
    }
  };
  FBL_MOTORE_REGOLE.push({id:'prova', key:'prova_storico', nome:'Regola di prova',
                          tf:1, obiettivoR:2, be:null, segnale:'xausweep'});
  // Tutte le regole vere spente e in sola osservazione disattivata: apre solo la prova.
  const c = fblMotoreConfig();
  FBL_MOTORE_REGOLE.forEach(x => { delete c[x.id]; c[x.id + '#osserva'] = false; });
  c['prova'] = true;
  fblMotoreSalvaConfig(c);
  // Il ponte vero non va toccato: se qualcuno prova ad aprire un ordine, si conta.
  window.__ordiniVero = 0;
  window.placeRealMt5Order = function(){ window.__ordiniVero++; return null; };
}

// Il corpo del banco, con dentro le due funzioni preparatorie scritte qui sopra.
const PAGINA = (corpo) => '(function(){\n(' + PREPARA.toString() + ')();\n'
  + '(' + MONTA_REGOLA_PROVA.toString() + ')();\n' + corpo + '\n})()';

test('in Storico le regole accese aprono posizioni SIMULATE nel conto storico, mai ordini veri', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PAGINA(`
      for (let i = 0; i < 6; i++) forward(false);
      return {
        quante: positions.length,
        tutteSimulate: positions.every(p => p && p.mt5Ticket == null),
        tutteStorico: positions.every(p => p && p.asset === 'XAUUSD' && p.backtest === true),
        ordiniVero: window.__ordiniVero,
        davanti: positions.map(p => ({entry:p.entry, sl:p.sl, tp:p.tp, side:p.side, barra:p.autoBarra}))
      };
    `));
    assert.ok(r.quante > 0, 'in Storico il motore deve aprire almeno una posizione');
    assert.equal(r.tutteSimulate, true, 'nessuna posizione deve avere un ticket MT5');
    assert.equal(r.tutteStorico, true, 'tutte le posizioni sono del conto storico, marcate backtest');
    assert.equal(r.ordiniVero, 0, 'ZERO ordini veri: trovati ' + r.ordiniVero);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nessun segnale dal futuro: il motore non calcola mai una candela oltre il punto mostrato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PAGINA(`
      const andato = [];
      for (let i = 0; i < 4; i++) {
        forward(false);
        const st = fblMotoreStatiS && fblMotoreStatiS['prova'];
        andato.push({idx: idx,
                     mostrato: rows[idx] ? rows[idx].date : null,
                     calcolatoFino: st && st.ind && st.ind.calc ? st.ind.calc.vistoFino : null});
      }
      return andato;
    `));
    assert.equal(r.length, 4);
    for (const g of r) {
      assert.ok(g.calcolatoFino != null, 'il motore deve aver calcolato almeno una candela');
      assert.ok(Date.parse(g.calcolatoFino) <= Date.parse(g.mostrato) + 1000,
        'candela calcolata (' + g.calcolatoFino + ') oltre quella mostrata (' + g.mostrato + ')');
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le chiusure a stop/obiettivo finiscono nel Journal del conto storico con mode backtest', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PAGINA(`
      for (let i = 0; i < 40; i++) forward(false);
      return {
        chiusi: trades.length,
        mode: trades.map(t => t.mode),
        risultati: trades.map(t => t.result),
        ordiniVero: window.__ordiniVero,
        aperti: positions.filter(p => p && p.mt5Ticket == null).length
      };
    `));
    assert.ok(r.chiusi > 0, 'almeno un\'operazione deve essersi chiusa a stop o obiettivo');
    assert.equal(r.mode.every(m => m === 'backtest'), true,
      'tutte le chiusure nel conto storico: mode trovati ' + JSON.stringify(r.mode));
    assert.ok(r.risultati.every(x => x === 'TP' || x === 'SL'),
      'chiusure a target o stop: ' + JSON.stringify(r.risultati));
    assert.equal(r.ordiniVero, 0, 'ZERO ordini veri anche chiudendo: trovati ' + r.ordiniVero);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('lo stato del motore in Storico non sporca quello del Live (ombre, registro, sospensioni)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PAGINA(`
      // Stato del Live gia' presente, che NON deve cambiare.
      localStorage.setItem('fbl_motore_ombra', JSON.stringify([{id:'live-1', regola:'sweep', stato:'aperta'}]));
      localStorage.setItem('fbl_motore_registro', JSON.stringify([{regola:'sweep', esito:'osservato'}]));
      for (let i = 0; i < 20; i++) forward(false);
      return {
        ombra: JSON.parse(localStorage.getItem('fbl_motore_ombra') || '[]'),
        registro: JSON.parse(localStorage.getItem('fbl_motore_registro') || '[]'),
        config: fblMotoreConfig()
      };
    `));
    assert.equal(r.ombra.length, 1, 'le operazioni in ombra del Live non si toccano: ' + JSON.stringify(r.ombra));
    assert.equal(r.registro.length, 1, 'il registro del Live non si tocca: ' + JSON.stringify(r.registro));
    assert.equal(r.config['prova#sospesa'], undefined, 'in Storico non si sospende la regola del Live');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('anche il pull back automatico apre nel conto storico, senza toccare MT5', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(PAGINA(`
      const p = {autoOpenDemo:true, rischioOperazione:0.5};
      const op = {nome:'pullback', indicatore:'pullback', setupId:'pb-storico-1', barra:idx,
                  dir:1, entry:4000, sl:3990, tp:4020, lotto:1};
      const st = {ops:[op]};
      bosAutoApriOpsSetup(st, p, op.setupId, idx);
      return {quante: positions.length,
              simulata: positions.length ? positions[0].mt5Ticket == null : false,
              storica: positions.length ? (positions[0].backtest === true && positions[0].asset === 'XAUUSD') : false,
              ordiniVero: window.__ordiniVero};
    `));
    assert.equal(r.quante, 1, 'il pull back deve aprire una posizione nel conto storico');
    assert.equal(r.simulata, true, 'la posizione non deve avere un ticket MT5');
    assert.equal(r.storica, true, 'la posizione e\' del conto storico, marcata backtest');
    assert.equal(r.ordiniVero, 0, 'ZERO ordini veri: trovati ' + r.ordiniVero);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
