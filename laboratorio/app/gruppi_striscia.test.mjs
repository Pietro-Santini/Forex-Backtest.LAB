// I CARTELLINI DI VICINANZA ANCHE SULLA RIGA DEL GRUPPO.
//
// RICHIESTA del proprietario (22 ottobre 2026): «la linea in fondo a destra di ogni posizione
// deve essere visualizzata anche all'interno dei gruppi, ma anche all'esterno ... se c'e' una
// posizione che e' piu' vicina allo stop profit mi visualizza il cartellino blu, se invece e'
// piu' vicina a una linea del tipo TP mi visualizzera' quella che e' il cartellino verde, e
// allo stesso tempo, se e' la piu' vicina a uno stop loss, una delle posizioni mi visualizzera'
// fuori dal gruppo quella che e' il cartellino rosso».
//
// Due cose si misurano qui:
//  1) la riga del GRUPPO ha il cartellino, e il cartellino e' quello della posizione PIU' VICINA
//     a un livello (blu = stop a profitto, verde = take profit, rosso = stop loss);
//  2) la riga del gruppo ha TUTTE le colonne come le altre righe: prima la striscia mancava e
//     la riga aveva una cella in MENZO, cosi' tutte le sue celle erano spostate a sinistra.
//
// Come si prova che il test serve: prima della modifica la riga del gruppo non aveva nessun
// cartellino e aveva una cella in meno -> il test va rosso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp, PREPARA_BTC} from './aiuti.mjs';

const BLU = 'rgb(75, 179, 232)';    // #4bb3e8 - vicina allo stop a profitto
const VERDE = 'rgb(47, 191, 113)';  // #2fbf71 - vicina al take profit
const ROSSO = 'rgb(224, 82, 82)';   // #e05252 - vicina allo stop loss

// Tre posizioni dello stesso segnale (stessa sala, stesso gruppo, stesso asset): le tre cose
// che il cartellino sa dire, ognuna su una posizione diversa.
const SCENARI = [
  {
    nome: 'la piu\' vicina e\' il take profit (verde)',
    prezzo: 100.5,
    posizioni: [
      {id: 'PV', entry: 100.00, sl: 99.00, tp: 100.525},  // verde ~5%
      {id: 'PB', entry: 100.40, sl: 100.51, tp: 101.00},  // blu   ~9% (stop a profitto)
      {id: 'PR', entry: 100.60, sl: 100.49, tp: 101.00}   // rosso ~9%
    ],
    atteso: VERDE,
    attesoNumero: 1,
    atteseFiglie: [VERDE, BLU, ROSSO]
  },
  {
    nome: 'la piu\' vicina e\' lo stop a profitto (blu)',
    prezzo: 100.5,
    posizioni: [
      {id: 'PV', entry: 100.00, sl: 99.00, tp: 100.550},  // verde ~9%
      {id: 'PB', entry: 100.30, sl: 100.51, tp: 101.00},  // blu   ~5% (stop a profitto)
      {id: 'PR', entry: 100.60, sl: 100.49, tp: 101.00}   // rosso ~9%
    ],
    atteso: BLU,
    attesoNumero: 2,
    atteseFiglie: [VERDE, BLU, ROSSO]
  },
  {
    nome: 'la piu\' vicina e\' lo stop loss (rosso)',
    prezzo: 100.5,
    posizioni: [
      {id: 'PV', entry: 100.00, sl: 99.00, tp: 100.560},  // nessun cartellino
      {id: 'PB', entry: 100.30, sl: 100.52, tp: 101.00},  // blu   ~9%
      {id: 'PR', entry: 100.70, sl: 100.49, tp: 101.00}   // rosso ~5%
    ],
    atteso: ROSSO,
    attesoNumero: 3,
    atteseFiglie: [null, BLU, ROSSO]
  }
];

// Tutto quello che serve avviene DENTRO la pagina: si prepara il gruppo, lo si apre (come
// quando il proprietario preme il pulsante) e si rileggono i cartellini.
const IN_PAGINA = (s) => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++) {
    // L'ultima candela chiude al prezzo voluto: e' da li' che l'app prende il prezzo
    // corrente (currentPrice() = rows[idx].close), quello con cui calcola i cartellini.
    const ch = (i === 199) ? s.prezzo : 100.2;
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: 100, high: Math.max(100.5, ch + 0.2), low: Math.min(99.5, ch - 0.2), close: ch, volume: 5});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD'; if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; mt5Connected = false;
  trades = []; active = null;
  positions = s.posizioni.map((p, i) => ({
    id: p.id, asset: 'EURUSD', side: 'BUY', entry: p.entry, sl: p.sl, rrSl: p.sl, tp: p.tp,
    lots: 0.1, marginUsed: 10, start: 10 + i, startTime: t0 + (10 + i) * 60000,
    tgSala: 'Gold Signals VIP', tgGruppo: 'sgTEST', tgTpIndice: i + 1
  }));
  window.appConfirm = async () => true;
  appConfirm = window.appConfirm;
  update();
  const chiavi = [...fblPosGruppiIds.keys()];
  if (chiavi.length) fblPosGruppiAperti.add(chiavi[0]);
  update();

  const tb = document.getElementById('openPositions');
  const gruppo = tb.querySelector('tr.fblPosGruppo');
  const intest = tb.closest('table').querySelector('thead tr');
  const cella = gruppo ? gruppo.querySelector('td.fblStrisciaCella') : null;
  const badge = cella ? cella.querySelector('span.fblStriscia') : null;
  return {
    chiavi: chiavi,
    haGruppo: !!gruppo,
    prezzoUsato: currentPrice(),
    celleIntestazione: intest ? intest.cells.length : 0,
    celleGruppo: gruppo ? gruppo.cells.length : 0,
    colore: badge ? getComputedStyle(badge).backgroundColor : null,
    titolo: cella ? (cella.getAttribute('title') || '') : '',
    figlie: Array.from(tb.querySelectorAll('tr.fblPosFiglia')).map(tr => {
      const c = tr.querySelector('td.fblStrisciaCella');
      const b = c ? c.querySelector('span.fblStriscia') : null;
      return {
        colore: b ? getComputedStyle(b).backgroundColor : null,
        numero: (tr.cells[0] ? tr.cells[0].textContent : '').trim()
      };
    })
  };
};

test('la riga del gruppo ha il cartellino della posizione piu\' vicina, e tutte le colonne', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA_BTC);
    for (const scenario of SCENARI) {
      const letto = await pagina.evaluate(IN_PAGINA, scenario);

      assert.ok(letto.chiavi.length >= 1, scenario.nome + ': il gruppo non e\' stato riconosciuto');
      assert.ok(letto.haGruppo, scenario.nome + ': la riga del gruppo non c\'e\'');
      assert.equal(letto.prezzoUsato, scenario.prezzo, scenario.nome + ': il prezzo usato non e\' quello voluto');
      assert.equal(letto.celleGruppo, letto.celleIntestazione,
        scenario.nome + ': la riga del gruppo ha ' + letto.celleGruppo + ' celle invece di ' + letto.celleIntestazione + ' (le colonne sono disallineate)');
      assert.equal(letto.colore, scenario.atteso,
        scenario.nome + ': la riga del gruppo mostra ' + letto.colore + ' invece di ' + scenario.atteso);
      assert.match(letto.titolo, new RegExp('Posizione ' + scenario.attesoNumero + ' di'),
        scenario.nome + ': il titolo del cartellino del gruppo deve dire QUALE posizione guardare (' + letto.titolo + ')');

      // Ogni posizione del gruppo ha il PROPRIO cartellino (e non quello del gruppo).
      assert.equal(letto.figlie.length, scenario.posizioni.length,
        scenario.nome + ': non si vedono tutte le posizioni del gruppo');
      assert.deepEqual(letto.figlie.map(f => f.colore), scenario.atteseFiglie,
        scenario.nome + ': ogni posizione del gruppo deve avere il suo cartellino');
      // La posizione piu' vicina (quella indicata dal titolo del gruppo) ha il cartellino del gruppo.
      const vicina = letto.figlie[scenario.attesoNumero - 1];
      assert.equal(vicina.colore, scenario.atteso,
        scenario.nome + ': la posizione piu\' vicina ha ' + vicina.colore + ' invece di ' + scenario.atteso);
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ogni posizione del gruppo ha il proprio cartellino (blu, verde, rosso)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA_BTC);
    const letto = await pagina.evaluate(IN_PAGINA, SCENARI[0]);

    const colori = letto.figlie.map(f => f.colore);
    assert.deepEqual(colori, [VERDE, BLU, ROSSO],
      'le tre posizioni del gruppo devono avere i tre cartellini: verde (TP), blu (stop a profitto), rosso (stop loss)');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
