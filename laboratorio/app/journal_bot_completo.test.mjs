// §3.4.5 — TRADE JOURNAL COMPLETO DEL BOT (banco VERDE: registro completo).
//
// Il proprietario chiede: per OGNI operazione del motore (aperta, bloccata, osservata, filtrata)
// motivo dell'entrata, contesto di mercato, gestione ed esito finale; analisi di errori e profitti.
// MISURATO il 28/11/2026 con la sonda `laboratorio/misura_journal_bot.mjs` su candele fisse,
// rete spenta, MT5 finto, nessun ordine vero:
//   - PRIMA: 12 campi mancanti su 12 voci (contesto, gestione, esitoFinale per aperto, bloccato,
//     osservato e filtrato); R e uscita restavano SOLO nell'ombra, e il filtrato non aveva ombra.
//   - DOPO: ogni voce porta contesto (ATR, OHLC della candela segnale, rischio, obiettivoR, be) e
//     gestione (stopOra, be, beFatto); quando l'ombra chiude, la voce collegata da ombraId riceve
//     esitoFinale={uscita, R, chiusa}, e il filtrato chiude subito con uscita='filtrato', R=0.
// Il primo test DIMOSTRA che i quattro casi si generano; il secondo controlla i campi reali del
// registro; il terzo chiama la fblMotoreOmbraAggiorna VERA su una candela chiusa che tocca
// l'obiettivo e verifica che il registro (non solo l'ombra) riceva uscita/R/chiusa, con una voce
// di controllo che deve restare identica; il quarto copre lo `scartato`; il quinto la ripartenza
// della serie. Nessuna ricerca di stringhe nel sorgente: si legge lo stato vero di registro e ombra.
// NOTA: la parte «in replay» e' la voce 8.1.4, bloccata da decisione del proprietario: NON provata.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Stessa preparazione del banco `motore_osservazione_registro.test.mjs`: 300 minuti fissi,
// indicatore finto che segnala una candela, ponte MT5 finto. Nessun dato vero, nessun ordine vero.
const PREPARA = `
  const t0 = Date.UTC(2026, 10, 25, 8, 0, 0);
  baseRows = [];
  for (let i = 0; i < 300; i++) { const c = 4000 + Math.sin(i / 9) * 2;
    baseRows.push({date: new Date(t0 + i * 60000).toISOString(), open: c, high: c + 0.6, low: c - 0.6, close: c, volume: 10}); }
  currentTF = 30; rows = aggregateRows(baseRows, 30); idx = rows.length - 1; viewEnd = idx; currentAssetKey = 'XAUUSD';
  mt5ActiveSymbol = 'XAUUSD'; fblMotoreSerie = {}; fblMotoreUltimaBase = null; fblMotoreInCorso = false;
  fblMotoreCaricaSerie = async (tf, quante) => aggregateRows(baseRows, tf).map(r => ({...r}));
  liveModeActive = true; liveReplayActive = false; mt5Connected = true; liveSessionPhaseNow = () => 'mt5';
  mt5AccountInfo = {reale: false, equity: 10000, balance: 10000, margin_free: 10000};
  positions.length = 0; trades.length = 0; equity = [10000]; if ($('capital')) $('capital').value = '10000';
  fblAutoApertureFatte = null;
  for (const k of ['fbl_auto_aperture', 'fbl_motore_auto', 'fbl_motore_ombra', 'fbl_motore_registro']) localStorage.removeItem(k);
  window.__ordini = [];
  placeRealMt5Order = async (side, forz) => {
    __ordini.push({side, sl: forz.sl, tp: forz.tp});
    const ticket = 800000 + __ordini.length;
    positions.push(Object.assign({id: Date.now() + Math.random(), asset: forz.sym, side, entry: forz.prezzo,
      sl: forz.sl, tp: forz.tp, mt5Ticket: ticket}, forz.meta || {}));
    return ticket;
  };
  syncMt5PositionLevels = async () => {};
  INDICATOR_DEFS.__finto = {label: 'finto', defaultParams: () => ({}), compute(r, upTo, ind) {
    const st = ind.calc; if (!st.trades) st.trades = [];
    if (upTo === window.__barra && !st.trades.some(t => t.bar === upTo))
      st.trades.push({dir: 1, bar: upTo, stop: r[upTo].close - 2});
  }, render() {}};
  FBL_MOTORE_REGOLE.length = 0;
  FBL_MOTORE_REGOLE.push({id: '__finto', key: '__finto', nome: 'Finto', tf: 5, obiettivoR: 3, be: null, segnale: 'triangoli', verifica: 'prova'});
  for (const k of Object.keys(fblMotoreStati)) delete fblMotoreStati[k];
  const agg = aggregateRows(baseRows, 5); const chiuse5 = agg.slice(0, agg.length - 1);
  window.__barra = chiuse5.length - 1;
`;

const ESITI = ['aperto', 'bloccato', 'osservato', 'filtrato'];
const SCENARI = [
  ['aperto', `fblMotoreSalvaConfig({__finto: true});`],
  ['bloccato', `mt5AccountInfo.reale = true; fblMotoreSalvaConfig({'__finto@reale': true});
    positions.push({id: 1, asset: 'XAUUSD', autoContoReale: true, mt5Ticket: 1},
                   {id: 2, asset: 'XAUUSD', autoContoReale: true, mt5Ticket: 2});`],
  ['osservato', `/* apertura spenta per questo conto */`],
  ['filtrato', `FBL_MOTORE_REGOLE[0].filtro = {spike: 1.5, n: 20};`],   // ombra contraria 0,6 contro media 0,6
];

// Quattro giri su candele identiche: cambia solo la configurazione della regola. Restituisce lo
// STATO REALE letto con le funzioni dell'app (localStorage), non il testo del sorgente.
async function generaQuattroEsiti(pagina){
  const out = {};
  for (const [nome, azione] of SCENARI){
    out[nome] = await pagina.evaluate(`(async () => { ${PREPARA}
      ${azione}
      await fblMotoreAutoGiro(true);
      return {registro: fblMotoreRegistroDi('__finto').map(v => ({...v})),
              ombra: fblMotoreOmbraDi('__finto').map(o => ({...o})),
              ordini: __ordini.length};
    })()`);
  }
  return out;
}

test('i quattro esiti del motore si generano tutti (precondizione del journal)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await generaQuattroEsiti(pagina);
    for (const esito of ESITI){
      const voci = r[esito].registro.filter(v => v.esito === esito);
      assert.ok(voci.length >= 1, 'manca il caso ' + esito + ': ' + JSON.stringify(r[esito].registro));
    }
    // Le guardie devono funzionare davvero: non e' un caso "aperto" travestito.
    assert.equal(r.aperto.ordini, 1, 'il caso aperto deve inviare un ordine (finto)');
    assert.equal(r.bloccato.ordini, 0, 'il caso bloccato non invia ordini');
    assert.equal(r.osservato.ordini, 0, 'il caso osservato non invia ordini');
    assert.equal(r.filtrato.ordini, 0, 'il caso filtrato non invia ordini');
    assert.equal(r.filtrato.ombra.length, 0, 'il filtro scarta il segnale prima dell ombra');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ogni voce del journal ha motivo, contesto, gestione ed esito finale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await generaQuattroEsiti(pagina);
    // `motivo` c'e' gia' oggi; gli altri tre sono quelli che il proprietario chiede e che la
    // misura ha trovato assenti. Li chiediamo a ogni voce, compresa quella FILTRATA.
    const CAMPI = ['motivo', 'contesto', 'gestione', 'esitoFinale'];
    const mancanti = [];
    for (const esito of ESITI){
      const voci = r[esito].registro.filter(v => v.esito === esito);
      assert.ok(voci.length >= 1, 'manca il caso ' + esito);   // non deve essere questo il rosso
      for (const v of voci) for (const campo of CAMPI)
        if (!(campo in v)) mancanti.push(esito + '.' + campo);
    }
    assert.deepEqual(mancanti, [], 'campi mancanti nel journal del motore (' + mancanti.length + '): ' + mancanti.join(', '));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// Chiusura REALE: si chiama fblMotoreOmbraAggiorna con le candele aggregate dopo l'aggiunta di una
// candela che tocca il take profit. Si controlla anche una voce con ombraId diverso, che non deve
// cambiare: senza questa prova di controllo un aggiornamento "a tutto il registro" passerebbe.
test('la chiusura dell ombra scrive uscita, R e chiusa nel registro, non nelle altre voci', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      fblMotoreRegistra({regola:'__finto', ombraId:'__finto|controllo|1', esito:'osservato',
                         motivo:'prova di controllo', esitoFinale:{uscita:null, R:null, chiusa:null}});
      await fblMotoreAutoGiro(true);
      const prima = fblMotoreRegistroDi('__finto').map(v => ({...v}));
      const ombra = fblMotoreOmbraDi('__finto')[0];
      const aggiungi = (alto, basso) => {
        const ultima = baseRows[baseRows.length - 1]; const t = Date.parse(ultima.date) + 60000; const c = ultima.close;
        baseRows.push({date: new Date(t).toISOString(), open: c, high: alto, low: basso, close: c, volume: 10});
        for (let j = 1; j <= 10; j++) baseRows.push({date: new Date(t + j * 60000).toISOString(), open: c,
          high: c + 0.1, low: c - 0.1, close: c, volume: 10});
      };
      aggiungi(ombra.tp + 0.5, ombra.entry - 0.5);              // tocca l'obiettivo, non lo stop
      const righe = aggregateRows(baseRows, 5);
      fblMotoreOmbraAggiorna(FBL_MOTORE_REGOLE[0], righe);      // LA funzione vera, non una copia
      return {prima, dopo: fblMotoreRegistroDi('__finto').map(v => ({...v})), ombra,
              ombraDopo: fblMotoreOmbraDi('__finto').find(o => o.id === ombra.id),
              date: righe.map(x => x.date), high: righe.map(x => x.high)};
    })()`);
    const primaVoce = r.prima.find(v => v.ombraId === r.ombra.id);
    assert.ok(primaVoce, 'manca la voce del registro collegata all ombra');
    assert.equal(primaVoce.esito, 'osservato');
    assert.equal(primaVoce.esitoFinale.uscita, null, 'prima della chiusura non c e un esito finale');
    // La data attesa viene dalla candela vera che ha toccato l'obiettivo, non dall'ombra.
    const i = r.high.findIndex((h, j) => Date.parse(r.date[j]) > Date.parse(r.ombra.barra) && h >= r.ombra.tp);
    assert.ok(i >= 0, 'nessuna candela dopo il segnale tocca l obiettivo: caso non riprodotto');
    const dataAttesa = r.date[i];
    const dopoVoce = r.dopo.find(v => v.ombraId === r.ombra.id);
    assert.ok(dopoVoce, 'la voce e sparita dopo la chiusura');
    assert.ok(['stop', 'obiettivo'].includes(dopoVoce.esitoFinale.uscita),
      'uscita finale non aggiornata: ' + JSON.stringify(dopoVoce.esitoFinale));
    assert.equal(dopoVoce.esitoFinale.uscita, 'obiettivo');
    assert.ok(Number.isFinite(dopoVoce.esitoFinale.R), 'R finale non finito: ' + JSON.stringify(dopoVoce.esitoFinale));
    assert.equal(dopoVoce.esitoFinale.chiusa, dataAttesa, 'la chiusura deve essere la data della candela che ha toccato il target');
    assert.equal(r.ombraDopo.stato, 'chiusa');
    assert.equal(r.ombraDopo.chiusa, dataAttesa);
    const ctlPrima = r.prima.find(v => v.ombraId === '__finto|controllo|1');
    const ctlDopo = r.dopo.find(v => v.ombraId === '__finto|controllo|1');
    assert.deepEqual(ctlPrima, ctlDopo, 'la voce con ombraId diverso non va riscritta');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('uno stop dal lato sbagliato e scartato con esito finale terminale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      INDICATOR_DEFS.__finto.compute = (rr, upTo, ind) => {
        const st = ind.calc; if (!st.trades) st.trades = [];
        if (upTo === window.__barra && !st.trades.some(t => t.bar === upTo))
          st.trades.push({dir: 1, bar: upTo, stop: rr[upTo].close + 2});   // long con stop SOPRA: impossibile
      };
      await fblMotoreAutoGiro(true);
      return {registro: fblMotoreRegistroDi('__finto').map(v => ({...v})),
              ombra: fblMotoreOmbraDi('__finto').map(o => ({...o}))};
    })()`);
    const v = r.registro.find(x => x.esito === 'scartato');
    assert.ok(v, 'il segnale con stop dal lato sbagliato deve essere scartato: ' + JSON.stringify(r.registro));
    assert.deepEqual(v.esitoFinale, {uscita:'scartato', R:0}, 'uno scartato non puo restare con il placeholder null');
    assert.equal(r.ombra.length, 0, 'uno scartato non crea ombra');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la ripartenza della serie non duplica la voce del registro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => { ${PREPARA}
      await fblMotoreAutoGiro(true);
      const prima = fblMotoreRegistroDi('__finto').map(v => ({...v}));
      fblMotoreSerie = {};                    // serie ripartita: nuova identita', segnale riemesso
      await fblMotoreAutoGiro(true);
      return {prima, dopo: fblMotoreRegistroDi('__finto').map(v => ({...v}))};
    })()`);
    assert.equal(r.prima.length, 1, 'preparazione: una sola voce dopo il primo giro');
    assert.equal(r.dopo.length, 1, 'la ripartenza non deve accodare una seconda voce');
    assert.deepEqual(r.dopo, r.prima, 'la ripartenza non deve riscrivere la voce gia presente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
