// BANCO ROSSO — «in SELL mi segnala per un attimo un profitto che non e' vero, e mi dice che ho
// sbloccato la Prop Firm».
//
// DIFETTO SEGNALATO dal proprietario (11 novembre 2026): «quando vado ad aprire una posizione, al
// momento che la apro e imposto i livelli TP e stop loss, in SELL la maggior parte delle volte,
// succede che mi segnala per un attimo come se avessi un profitto che ovviamente non e'
// assolutamente vero. E questo comporta anche che in quel frangente l'applicazione mi dice che ho
// sbloccato la Prop Firm. Un bug del genere non e' accettabile.»
//
// I NUMERI DELLA FOTO DEL JOURNAL (XAUUSD, conto MT5 ...68794, SELL, 0,10 lotti):
//   riga 1059  entrata 4030.38  ->  pip +40303.8   P/L +40.303,80 EUR
//   riga 1058  entrata 4030.48  ->  pip +40304.8   P/L +40.304,80 EUR
// 4030.38 / 0.1 = 40303.8 (i pip) e 4030.38 * 100 * 0.10 = 40303.8 (gli euro).
// Non e' un profitto: e' il PREZZO D'ENTRATA usato come se fosse la differenza di prezzo, cioe'
// una differenza calcolata contro un prezzo di uscita pari a ZERO.
//
// QUESTO BANCO NON CORREGGE: MISURA. Quattro misure, in fila lungo la catena:
//   1. la formula            calculateForexPL()      -> il prezzo diventa profitto?
//   2. il riquadro a schermo computeTotalLivePL()    -> lo mostra?
//   3. la Prop Firm          checkPropFirmRules()    -> scatta su quel valore?
//   4. cio' che resta        closeTrade()            -> lo scrive nel Journal (e quindi nel cloud)?
//
// NON TOCCA NESSUN CONTO VERO: pagina locale, rete bloccata, WebSocket finti (vedi aiuti.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
// Import RELATIVO: questo banco vive in laboratorio/app e li' sta anche aiuti.mjs.
// MISURATO il 12 novembre: con il percorso assoluto della macchina di chi l'ha scritto,
// su GitHub il file moriva in 35 ms con exitCode 1 e ZERO prove eseguite - un collaudo
// rosso che non misurava niente. Un banco non deve sapere dove abita.
import {apriApp} from './aiuti.mjs';

// I numeri esatti della foto del proprietario.
const ENTRATA = 4030.38;
const LOTTI = 0.10;
const SL = 4019.03;
const TP = 3999.96;
const FALSO = 40303.8;          // ENTRATA * 100 (contractSize XAUUSD) * 0.10 lotti
const TOLLERANZA = 0.5;

// Candele XAUUSD che finiscono adesso, intorno al prezzo d'entrata: il grafico e' "sano".
const CANDELE = () => {
  const t0 = Date.now() - 300 * 60000; const R = [];
  for (let i = 0; i < 300; i++) {
    const t = t0 + i * 60000, p = ENTRATA + Math.sin(i / 19) * 1.5;
    R.push({date: new Date(t).toISOString(), open: p, high: p + 0.4, low: p - 0.4, close: p, volume: 10});
  }
  return R;
};

// La posizione SELL della foto, appena aperta su MT5 con TP e SL impostati.
const POSIZIONE = {
  side: 'SELL', asset: 'XAUUSD', entry: ENTRATA, lots: LOTTI,
  sl: SL, tp: TP, rrSl: SL, origin: 'MARKET',
  mt5Ticket: 998877, mt5Login: '68794', mt5Server: 'Demo',
  marginUsed: 0, risk: 0, dist: 0, hasRiskModel: false,
  startTime: Date.now() - 60000, openTF: 1, historical: false
};

// Prepara la pagina: strumento XAUUSD a grafico, sessione Live col conto MT5 collegato, la
// posizione SELL appena aperta e la fotografia del ponte ANCORA VUOTA — che e' esattamente
// l'istante descritto dal proprietario («al momento che la apro»): la posizione in app esiste
// gia', il profitto vero del broker non e' ancora arrivato.
const PREPARA = (a) => {
  const R = a.candele;
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length;
  currentAssetKey = 'XAUUSD';
  try { if (document.getElementById('market')) document.getElementById('market').value = 'XAUUSD'; } catch (e) {}
  try { if (document.getElementById('capital')) document.getElementById('capital').value = '10000'; } catch (e) {}
  liveModeActive = true;
  mt5Connected = true; mt5MonitorOnly = false; mt5ActiveSymbol = 'XAUUSD';
  lastMt5TickPrice = NaN; lastPrimaryEpicPrice = NaN;  // nessun tick vero ancora applicato
  mt5RealPositions = [];                               // fotografia del ponte non ancora arrivata
  mt5AccountInfo = null; mt5AccountHistory = null;
  liveReplayActive = false; replayForm = null;
  positions = [Object.assign({}, a.pos)];
  active = positions[0];
  pendingOrders = [];
  window.appConfirm = async () => true; appConfirm = window.appConfirm;
};

async function apri() {
  const r = await apriApp();
  await r.pagina.evaluate(PREPARA, {candele: CANDELE(), pos: POSIZIONE});
  return r;
}

// ---------------------------------------------------------------------------------------------
// MISURA 1 — LA FORMULA. Il prezzo d'entrata diventa profitto quando il prezzo di uscita manca.
// ---------------------------------------------------------------------------------------------
test('1. calculateForexPL: con il prezzo di uscita mancante, in SELL esce il PREZZO al posto del profitto', async () => {
  const {browser, pagina, errori} = await apri();
  try {
    const m = await pagina.evaluate((a) => {
      const prova = (lato, uscita) => {
        let v; try { v = calculateForexPL(lato, a.entrata, uscita, a.lotti, 'XAUUSD'); } catch (e) { v = 'errore: ' + e; }
        return v;
      };
      return {
        sellZero: prova('SELL', 0),
        sellNull: prova('SELL', null),
        sellVuoto: prova('SELL', ''),
        sellIndefinito: prova('SELL', undefined),
        buyZero: prova('BUY', 0),
        sano: prova('SELL', a.entrata + 1)   // prova di controllo: col prezzo vero deve dare -10
      };
    }, {entrata: ENTRATA, lotti: LOTTI});

    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');

    // Prova di controllo: con un prezzo vero la formula e' giusta (SELL, prezzo salito di 1 -> -10 EUR).
    assert.ok(Math.abs(m.sano + 10) < 0.01,
      'prova di controllo: SELL 0,10 lotti XAUUSD con prezzo +1 deve dare -10 EUR, ha dato ' + m.sano);

    // QUI DEVE DIVENTARE ROSSO: un prezzo di uscita che non esiste non puo' produrre un profitto.
    assert.ok(!(Math.abs(m.sellZero - FALSO) < TOLLERANZA),
      'con uscita 0 la SELL produce ' + m.sellZero + ' EUR, cioe' + "'" + ' il prezzo d\'entrata ('
      + ENTRATA + ' x 100 x ' + LOTTI + ' = ' + FALSO + '): un prezzo mancante deve dare null, non un profitto');
    assert.ok(!(Math.abs(m.sellNull - FALSO) < TOLLERANZA),
      'con uscita null la SELL produce ' + m.sellNull + ' EUR: Number(null) fa 0 e 0 passa Number.isFinite');
    assert.ok(!(Math.abs(m.sellVuoto - FALSO) < TOLLERANZA),
      'con uscita stringa vuota la SELL produce ' + m.sellVuoto + ' EUR');

    // L'ASIMMETRIA che spiega «la maggior parte delle volte in SELL»: dall'altro lato lo stesso
    // errore esce come perdita mostruosa, e una perdita non sblocca nessuna Prop Firm.
    assert.ok(!(Math.abs(m.buyZero + FALSO) < TOLLERANZA),
      'in BUY lo stesso errore vale ' + m.buyZero + ' EUR (perdita): e\' per questo che si nota solo in SELL');
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------------------------------------
// MISURA 2 — IL RIQUADRO. Posizione appena aperta, fotografia del ponte non ancora arrivata.
// ---------------------------------------------------------------------------------------------
test('2. riquadro P/L Live: appena aperta la SELL, con la candela a zero mostra il prezzo come profitto', async () => {
  const {browser, pagina, errori} = await apri();
  try {
    const m = await pagina.evaluate(() => {
      // L'ultima candela perde il prezzo (chiusura 0): e' l'unico stato di mezzo che il codice
      // lascia passare, perche' currentPrice() difende il TICK dal valore 0 ma non la candela.
      rows[idx].close = 0; baseRows[baseRows.length - 1].close = 0;
      return {
        prezzoCorrente: currentPrice(),
        riquadro: computeTotalLivePL(),
        flottante: floatingPL(),
        rigaPosizione: (typeof posLivePL === 'function') ? posLivePL(positions[0]) : null
      };
    });
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');

    assert.ok(!(Math.abs(m.riquadro - FALSO) < TOLLERANZA),
      'il riquadro "P/L Live" mostra ' + m.riquadro + ' EUR su una posizione appena aperta: '
      + 'e\' il prezzo d\'entrata, non un profitto (prezzo corrente letto: ' + m.prezzoCorrente + ')');
    assert.ok(!(Math.abs(m.flottante - FALSO) < TOLLERANZA),
      'floatingPL() — quello che alimenta capitale, margine e Prop Firm — vale ' + m.flottante + ' EUR');
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------------------------------------
// MISURA 3 — LA PROP FIRM. La domanda che conta: una regola puo' decidere su un valore
// non ancora validato? E quello che decide, RESTA SCRITTO?
// ---------------------------------------------------------------------------------------------
// 3a — IL FLOTTANTE. In sessione Storico (e Storico Prop Firm) il flottante si calcola sul
// prezzo del grafico: una candela senza prezzo diventa un profitto, e la regola decide su quello.
test('3a. Prop Firm: la sfida viene dichiarata superata su un FLOTTANTE impossibile', async () => {
  const {browser, pagina, errori} = await apri();
  try {
    const m = await pagina.evaluate((a) => {
      rows[idx].close = 0; baseRows[baseRows.length - 1].close = 0;
      liveModeActive = false;         // sessione Storico: il flottante passa da currentPrice()
      isPropFirmMode = true;
      pfRealMt5Login = null; pfPendingDecisionLogin = null;
      propFirmViolation = null; propFirmSbloccataShown = false;
      propFirmChallengeInitialCapital = 10000;
      equity = [10400];               // +4%: ben sotto l'obiettivo del 10%, nessuno ha vinto niente
      propFirmDailyBaselineDate = cetDateKey(currentPropFirmNowMs());
      propFirmDailyStartBalance = 10400;
      try { localStorage.removeItem('fbl_prop_conti'); } catch (e) {}

      const flottante = propFirmFloatingPL();
      const nozionale = Math.abs(a.entrata * 100 * a.lotti);   // il valore INTERO della posizione
      checkPropFirmRules();
      const stato = (typeof fblPropContoStato === 'function') ? fblPropContoStato() : null;
      let salvato = null; try { salvato = localStorage.getItem('fbl_prop_conti'); } catch (e) {}
      return {
        flottante, nozionale,
        sbloccata: !!propFirmSbloccataShown,
        faseSuperata: stato ? stato.faseSuperata : undefined,
        statoConto: stato ? stato.stato : undefined,
        scrittoInMemoria: salvato,
        testoStato: (document.getElementById('status') || {}).textContent || ''
      };
    }, {entrata: ENTRATA, lotti: LOTTI});

    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');

    // Un flottante non puo' valere quanto l'intera posizione: la posizione vale 40.303,80 EUR di
    // nozionale, e un profitto pari al 100% del nozionale significa prezzo arrivato a zero.
    assert.ok(Math.abs(m.flottante) < m.nozionale * 0.9,
      'il flottante vale ' + m.flottante + ' EUR su un nozionale di ' + m.nozionale
      + ' EUR: una variazione impossibile, e nessuno la rifiuta');

    assert.equal(m.sbloccata, false,
      'la Prop Firm ha dichiarato la sfida SUPERATA su un flottante impossibile '
      + '(flottante ' + m.flottante + ' EUR, saldo chiuso 10.400 su capitale 10.000). '
      + 'Messaggio a schermo: "' + m.testoStato + '"');

    assert.equal(m.faseSuperata, null,
      'la fase e\' stata segnata come superata e SALVATA (fbl_prop_conti): un lampo di un tick '
      + 'avanza la Challenge per sempre — scritto: ' + m.scrittoInMemoria);
  } finally { await browser.close(); }
});

// 3b — LA CATENA VERA, quella che spiega la foto. La chiusura falsa non lampeggia: entra nel
// Journal, spinge la curva di equity, e da li' la Prop Firm legge un saldo CHIUSO gonfiato.
// Nessun valore "di mezzo" serve piu': il numero falso e' diventato storia del conto.
test('3b. Prop Firm: la chiusura falsa gonfia il saldo chiuso e la Challenge risulta superata', async () => {
  const {browser, pagina, errori} = await apri();
  try {
    const m = await pagina.evaluate(() => {
      isPropFirmMode = true; liveModeActive = true;
      pfRealMt5Login = null; pfPendingDecisionLogin = null;
      propFirmViolation = null; propFirmSbloccataShown = false;
      propFirmChallengeInitialCapital = 10000;
      trades = [];
      equity = [10400];               // +4%: la Challenge e' in corso, obiettivo 10% non raggiunto
      propFirmDailyBaselineDate = cetDateKey(currentPropFirmNowMs());
      propFirmDailyStartBalance = 10400;
      try { localStorage.removeItem('fbl_prop_conti'); } catch (e) {}
      try { syncFullStatusToFirebase = () => {}; } catch (e) {}

      // La chiusura senza prezzo: lo stesso ingresso di SL/TP, margin call, "chiudi tutte",
      // chiusura a blocco e chiusura reale MT5 — nessuno chiede che il prezzo sia > 0.
      closeTrade('SL', 0, positions[0]);
      const rigaJournal = trades[trades.length - 1] || {};
      const equityDopo = equity.slice();
      const saldoChiuso = propFirmClosedBalance();
      checkPropFirmRules();
      const stato = (typeof fblPropContoStato === 'function') ? fblPropContoStato() : null;
      let salvato = null; try { salvato = localStorage.getItem('fbl_prop_conti'); } catch (e) {}
      return {
        plJournal: rigaJournal.pl, equityDopo, saldoChiuso,
        sbloccata: !!propFirmSbloccataShown,
        faseSuperata: stato ? stato.faseSuperata : undefined,
        statoConto: stato ? stato.stato : undefined,
        scrittoInMemoria: salvato,
        testoStato: (document.getElementById('status') || {}).textContent || ''
      };
    });

    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');

    assert.ok(m.saldoChiuso < 12000,
      'il saldo CHIUSO della Challenge e\' diventato ' + m.saldoChiuso + ' EUR partendo da 10.400: '
      + 'la chiusura falsa (' + m.plJournal + ' EUR) e\' entrata nella curva di equity ' + JSON.stringify(m.equityDopo));

    assert.equal(m.sbloccata, false,
      'la Prop Firm dichiara la sfida SUPERATA sul saldo gonfiato dalla chiusura falsa. '
      + 'Messaggio a schermo: "' + m.testoStato + '"');

    assert.equal(m.faseSuperata, null,
      'la fase e\' stata segnata come superata e SALVATA (fbl_prop_conti): ' + m.scrittoInMemoria);

    assert.notEqual(m.statoConto, 'finanziato',
      'il conto e\' stato marcato "finanziato" su un numero che non e\' mai esistito');
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------------------------------------
// MISURA 4 — CIO' CHE RESTA. Un numero falso che lampeggia si dimentica; uno scritto nel
// Journal (e quindi mandato nel cloud) resta.
// ---------------------------------------------------------------------------------------------
test('4. Journal: una chiusura senza prezzo scrive il prezzo d\'entrata come profitto (e lo manda nel cloud)', async () => {
  const {browser, pagina, errori} = await apri();
  try {
    const m = await pagina.evaluate(() => {
      trades = [];
      equity = [11102.54];
      let cloud = 0;
      // Si conta solo la CHIAMATA al salvataggio nel cloud: il banco non ha rete.
      try { window.__cloudVero = syncFullStatusToFirebase; syncFullStatusToFirebase = () => { cloud++; }; } catch (e) {}
      const pos = positions[0];
      // Chiusura con un prezzo che non esiste: e' lo stesso ingresso che ogni strada di chiusura
      // usa (SL/TP, margin call, chiudi tutte, chiusura a blocco), nessuna delle quali chiede che
      // il prezzo sia > 0 — chiedono solo che sia "finito", e lo zero e' finito.
      closeTrade('SL', 0, pos);
      const t = trades[trades.length - 1] || {};
      return {quanti: trades.length, pl: t.pl, pips: t.pips, uscita: t.exit, conto: t.account, cloud};
    });
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');

    assert.ok(!(Math.abs(m.pl - FALSO) < TOLLERANZA),
      'nel Journal e\' finita una riga da ' + m.pl + ' EUR (pip ' + m.pips + ', uscita ' + m.uscita
      + ', conto ' + m.conto + '): sono gli stessi numeri della foto del proprietario, '
      + 'e sono stati messi in coda per il cloud ' + m.cloud + ' volta/e');
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------------------------------------
// MISURA 5 — IL PUNTO ESATTO. Chiusura REALE su MT5: se la risposta del ponte non porta il
// prezzo di esecuzione, `Number(null)` fa 0, 0 passa Number.isFinite, e il ripiego sicuro
// (fblPrezzoRipiegoChiusura, che pretende > 0) non viene mai raggiunto.
// LA STESSA LEZIONE E' GIA' SCRITTA nell'altra strada di chiusura (fetchMt5Positions, dove c'e'
// il commento «Number(null) vale 0, che e' finito: cosi' un prezzo mancante diventava un'uscita
// a 0» e il controllo prezzo > 0). Qui non e' stata applicata.
// ---------------------------------------------------------------------------------------------
// Il ponte (bridge.py, /order/close) risponde {"ticket":…,"deal":…,"price":result.price}.
// `result.price` di MT5 vale 0.0 quando il server non la riporta, e in Python un campo assente
// diventa None, cioe' `null` in JSON: entrambi diventano 0 in JavaScript.
for (const [nome, risposta] of [['price: 0', {price: 0}], ['price: null', {price: null}]]) {
  test('5. closeMt5PositionReal con ' + nome + ' dal ponte: l\'uscita diventa 0 e il P/L il prezzo d\'entrata', async () => {
    const {browser, pagina, errori} = await apri();
    try {
      const m = await pagina.evaluate(async (dati) => {
        trades = []; equity = [10400];
        try { syncFullStatusToFirebase = () => {}; } catch (e) {}
        fetchMt5WithTimeout = async (url) => {
          if (String(url).indexOf('/order/close') >= 0) return {ok: true, data: dati};
          return {ok: true, data: []};
        };
        await closeMt5PositionReal(positions[0], 'MANUAL', {senzaConferma: true});
        const t = trades[trades.length - 1] || {};
        return {quanti: trades.length, pl: t.pl, pips: t.pips, uscita: t.exit, conto: t.account,
          ripiegoSicuro: fblPrezzoRipiegoChiusura({side: 'SELL', entry: 4030.38, sl: 4019.03}, 'MANUAL'),
          status: (document.getElementById('status') || {}).textContent || ''};
      }, risposta);
      assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');

      assert.ok(!(Math.abs(m.pl - FALSO) < TOLLERANZA),
        'chiusura reale con ' + nome + ': uscita registrata ' + m.uscita + ', P/L ' + m.pl
        + ' EUR, pip ' + m.pips + ', conto ' + m.conto + '. Il ripiego sicuro '
        + '(fblPrezzoRipiegoChiusura, che pretende > 0) avrebbe dato ' + m.ripiegoSicuro
        + ', ma non viene mai chiamato: Number(null) fa 0 e 0 passa Number.isFinite. '
        + 'A schermo si legge: "' + m.status + '"');
    } finally { await browser.close(); }
  });
}

// ---------------------------------------------------------------------------------------------
// MISURA 6 — IL SECONDO BUCO, indipendente dal primo. Lo storico MT5 recuperato all'avvio
// (/history_deals): quando il ponte non sa dire il profitto netto, il P/L si ricalcola dai
// prezzi — e un prezzo di chiusura mancante produce lo stesso numero falso. Qui si vede anche
// l'incoerenza: la colonna "Uscita" resta vuota (fblPrezzoValido la scarta correttamente) ma il
// P/L nella riga accanto e' stato calcolato proprio su quel prezzo che "non esiste".
// ---------------------------------------------------------------------------------------------
test('6. storico MT5 recuperato: profitto assente + prezzo di chiusura assente = il prezzo d\'entrata come profitto', async () => {
  const {browser, pagina, errori} = await apri();
  try {
    const m = await pagina.evaluate((a) => {
      trades = []; equity = [10400];
      try { syncFullStatusToFirebase = () => {}; } catch (e) {}
      addBackfilledMt5Trade({
        positionId: 554433, symbol: 'XAUUSD', side: 'SELL', volume: a.lotti,
        priceOpen: a.entrata, priceClose: null,     // il deal di chiusura non e' leggibile
        profit: null, swap: null, commission: null, // e nemmeno il netto del broker
        timeOpen: Math.floor(Date.now() / 1000) - 600, timeClose: Math.floor(Date.now() / 1000),
        reason: 'SL', sl: 4019.03, tp: 3999.96
      });
      const t = trades[trades.length - 1] || {};
      return {pl: t.pl, pips: t.pips, uscita: t.exit, pct: t.pct, conto: t.account};
    }, {entrata: ENTRATA, lotti: LOTTI});
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');

    assert.ok(!(Math.abs(m.pl - FALSO) < TOLLERANZA),
      'lo storico recuperato ha scritto nel Journal P/L ' + m.pl + ' EUR e pip ' + m.pips
      + ' mentre la colonna Uscita e\' ' + JSON.stringify(m.uscita)
      + ': il prezzo "non esiste" per la colonna, ma e\' stato usato per il calcolo (conto '
      + m.conto + ', ' + m.pct + '%)');
  } finally { await browser.close(); }
});
