// INTERRUTTORE UNICO D'EMERGENZA DELLE APERTURE AUTOMATICHE (§3.4.4.a).
//
// Si misura il COMPORTAMENTO, non il testo del sorgente: si preparano autorizzazioni DEMO valide,
// un indicatore che genera davvero un segnale e un MT5 finto (nessun ordine vero esce dal banco).
// Prima si prova che SENZA l'interruttore le aperture partono (prova di controllo: un test che
// passasse anche col difetto non dimostrerebbe niente), poi si accende l'interruttore e si chiede:
//  (a) pull back e No-Wick non aprono;  (b) il motore in diretta non apre ma continua a osservare;
//  (c) il motore nel conto storico CSV non apre;
//  (d) nessuna chiamata a placeRealMt5Order;
//  (e) uno SL di una posizione GIA' aperta continua a chiudersi con evaluate();
//  (f) il controllo c'e' nel pannello e l'impostazione sopravvive a una NUOVA apriApp;
//  (g) sesto test: con l'interruttore acceso le aperture MANUALI restano disponibili.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Prepara una diretta demo con MT5 finto. `pulisciConfig=false` serve alla prova di persistenza:
// in quel caso la configurazione arriva dal localStorage della pagina precedente.
const PREPARA_LIVE = (pulisciConfig = true) => {
  const t0 = Date.UTC(2026, 10, 25, 8, 0, 0);
  baseRows = [];
  for (let i = 0; i < 300; i++) {
    const c = 4000 + Math.sin(i / 9) * 2;
    baseRows.push({date: new Date(t0 + i * 60000).toISOString(), open: c,
      high: c + 0.6, low: c - 0.6, close: c, volume: 10});
  }
  currentTF = 30; rows = aggregateRows(baseRows, 30); idx = rows.length - 1; viewEnd = idx;
  rowsAssetKey = 'XAUUSD'; currentAssetKey = 'XAUUSD';
  liveModeActive = true; liveReplayActive = false; liveReplaySelecting = false;
  mt5Connected = true; mt5ActiveSymbol = 'XAUUSD';
  mt5AccountInfo = {reale: false, equity: 10000, balance: 10000, margin_free: 10000};
  liveSessionPhaseNow = () => 'mt5';
  slTpScanDoneForAsset = 'XAUUSD';
  positions = []; trades = []; pendingOrders = []; active = null; equity = [10000];
  if ($('capital')) $('capital').value = '10000';
  currentPrice = () => 4000;
  fblStopMinimoAuto = () => 0;          // non e' la guardia sotto prova: la rende neutrale
  marginForLots = () => 0;
  fblAutoApertureFatte = null; localStorage.removeItem('fbl_auto_aperture');
  window.__ordini = [];
  placeRealMt5Order = async (side, forz) => {
    __ordini.push({side, sl: forz.sl, tp: forz.tp});
    const ticket = 900000 + __ordini.length;
    positions.push(Object.assign({id: Date.now() + Math.random(), asset: forz.sym || currentAssetKey,
      side, entry: forz.prezzo, sl: forz.sl, tp: forz.tp, mt5Ticket: ticket}, forz.meta || {}));
    return ticket;
  };
  syncMt5PositionLevels = async () => {};
  INDICATOR_DEFS.__finto = {
    label: 'finto', defaultParams: () => ({}), render() {},
    compute(r, upTo, ind) {
      const st = ind.calc; if (!st.trades) st.trades = [];
      if (upTo === window.__barra && !st.trades.some(t => t.bar === upTo))
        st.trades.push({dir: 1, bar: upTo, stop: r[upTo].close - 2});
    }
  };
  FBL_MOTORE_REGOLE.length = 0;
  FBL_MOTORE_REGOLE.push({id: '__finto', key: '__finto', nome: 'Finto', tf: 5,
    obiettivoR: 3, be: null, segnale: 'triangoli', verifica: 'prova'});
  for (const k of Object.keys(fblMotoreStati)) delete fblMotoreStati[k];
  const agg = aggregateRows(baseRows, 5), chiuse5 = agg.slice(0, agg.length - 1);
  window.__barra = chiuse5.length - 1;
  fblMotoreCaricaSerie = async (tf) => aggregateRows(baseRows, tf).map(r => ({...r}));
  fblMotoreSerie = {}; fblMotoreUltimaBase = null; fblMotoreInCorso = false;
  if (pulisciConfig) {
    for (const k of ['fbl_motore_auto', 'fbl_motore_ombra', 'fbl_motore_registro']) localStorage.removeItem(k);
  }
};

// Prepara il conto storico CSV con una regola che genera davvero un segnale a ogni candela.
const PREPARA_STORICO = () => {
  const t0 = Date.parse('2026-11-20T00:00:00Z');
  const R = []; let p = 4000;
  for (let i = 0; i < 400; i++) {
    const o = p, c = p + 0.3;
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: o,
      high: Math.max(o, c) + 0.5, low: Math.min(o, c) - 0.3, close: c, volume: 10});
    p = c;
  }
  baseRows = R; rows = R; rowsAssetKey = 'XAUUSD'; currentAssetKey = 'XAUUSD';
  currentTF = 1; liveModeActive = false; liveReplayActive = false; liveReplaySelecting = false;
  mt5Connected = true; mt5ActiveSymbol = 'XAUUSD';
  mt5AccountInfo = {reale: false, equity: 10000, balance: 10000, margin_free: 10000};
  masterTime = Date.parse(R[200].date); idx = 200; viewEnd = 201; visibleCount = 200;
  positions = []; trades = []; pendingOrders = []; active = null; equity = [];
  if ($('capital')) $('capital').value = '10000';
  marginForLots = () => 0;
  INDICATOR_DEFS['prova_storico'] = {
    defaultParams: () => ({}),
    compute(r, k, ind) {
      const row = r[k]; if (!row) return;
      ind.calc.operazioni = [{da: k, dir: 1, stopIniziale: row.close - 0.5}];
    }
  };
  FBL_MOTORE_REGOLE.length = 0;
  FBL_MOTORE_REGOLE.push({id: 'prova', key: 'prova_storico', nome: 'Regola di prova',
    tf: 1, obiettivoR: 2, be: null, segnale: 'xausweep'});
  for (const k of Object.keys(fblMotoreStatiS)) delete fblMotoreStatiS[k];
  window.__ordiniVeri = 0;
  placeRealMt5Order = () => { __ordiniVeri++; return null; };
  const c = fblMotoreConfig();
  for (const x of FBL_MOTORE_REGOLE) { delete c[x.id]; c[x.id + '#osserva'] = false; }
  c.prova = true; c.masterOff = false; fblMotoreSalvaConfig(c);
};

test('interruttore acceso: niente aperture automatiche in diretta, ma le chiusure SL/TP restano', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      (${PREPARA_LIVE.toString()})();
      const azzera = (spento) => {
        const c = fblMotoreConfig(); c.__finto = true; c.masterOff = !!spento; fblMotoreSalvaConfig(c);
        fblAutoApertureFatte = null; localStorage.removeItem('fbl_auto_aperture');
        for (const k of Object.keys(fblMotoreStati)) delete fblMotoreStati[k];
        fblMotoreSerie = {}; fblMotoreUltimaBase = null;
        localStorage.removeItem('fbl_motore_ombra'); localStorage.removeItem('fbl_motore_registro');
        __ordini.length = 0; positions.length = 0; trades.length = 0;
      };
      const apriIndicatori = () => {
        const p = {autoOpenDemo: true, rischioOperazione: 0.5};
        for (const id of ['pullback', 'nowick']) {
          const op = {nome: 'prova', indicatore: id, setupId: 'pb-' + id + '-' + Math.random(),
            barra: idx, dir: 1, entry: 4000, sl: 3990, tp: 4020, lotto: 0.2};
          bosAutoApriOpsSetup({ops: [op]}, p, op.setupId, idx);
        }
      };
      const diretto = (chiave) => fblAutoInviaOrdineDemo({autoOpenDemo: true}, 'XAUUSD', {dir: 1},
        {entry: 4000, sl: 3990, tp: 4020, lots: 0.1, chiave});

      // PROVA DI CONTROLLO: senza interruttore le tre strade devonoaprire davvero.
      azzera(false);
      await fblMotoreAutoGiro(true);
      const controlloMotore = __ordini.length;
      apriIndicatori();
      const controlloIndicatori = __ordini.length;
      diretto('diretto-controllo');
      const controlloDiretto = __ordini.length;

      // Ora l'interruttore si accende: tutto si ferma, salvo l'osservazione.
      azzera(true);
      await fblMotoreAutoGiro(true);
      const motoreBloccato = __ordini.length;
      const osservate = fblMotoreOmbraDi('__finto').length;
      apriIndicatori();
      const indicatoriBloccati = __ordini.length;
      const direttoBloccato = diretto('diretto-emergenza');
      const ordiniFinali = __ordini.length;

      // Una posizione GIA' aperta, che non e' MT5: il suo stop deve scattare lo stesso.
      positions.length = 0; trades.length = 0;
      const ultima = rows[rows.length - 1];
      ultima.low = 3900; ultima.high = 4005;
      ultima.date = new Date(Date.now() - 60000).toISOString();
      positions.push({id: 'GIA-APERTA', asset: 'XAUUSD', side: 'BUY', entry: 4000, sl: 3995,
        rrSl: 3995, lots: 0.1, marginUsed: 0, start: 0, startTime: Date.UTC(2026, 10, 24)});
      evaluate();
      return {controlloMotore, controlloIndicatori, controlloDiretto,
        motoreBloccato, osservate, indicatoriBloccati, direttoBloccato, ordiniFinali,
        chiuse: trades.length, aperte: positions.length,
        configurato: fblMotoreConfig().masterOff === true};
    })()`);
    assert.ok(r.controlloMotore >= 1, 'prova di controllo: il motore deve aprire senza interruttore');
    assert.equal(r.controlloIndicatori, r.controlloMotore + 2,
      'prova di controllo: pull back e No-Wick devono aprire senza interruttore');
    assert.equal(r.controlloDiretto, r.controlloIndicatori + 1,
      'prova di controllo: la porta comune deve aprire senza interruttore');
    assert.equal(r.configurato, true, 'premessa: l interruttore risulta acceso nella configurazione');
    assert.equal(r.motoreBloccato, 0, 'con l interruttore acceso il motore in diretta non apre');
    assert.equal(r.osservate, 1, 'l osservazione delle regole deve continuare');
    assert.equal(r.indicatoriBloccati, 0, 'pull back e No-Wick non devono aprire');
    assert.equal(r.direttoBloccato, false, 'la porta comune deve rifiutare l ordine');
    assert.equal(r.ordiniFinali, 0, 'ZERO chiamate a placeRealMt5Order');
    assert.equal(r.chiuse, 1, 'lo stop di una posizione gia aperta deve continuare a chiudersi');
    assert.equal(r.aperte, 0, 'la posizione gia aperta deve essere sparita dopo lo stop');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('interruttore acceso: il motore non apre nemmeno sul conto storico CSV', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      (${PREPARA_STORICO.toString()})();
      const azzera = (spento) => {
        const c = fblMotoreConfig(); c.prova = true; c.masterOff = !!spento; fblMotoreSalvaConfig(c);
        for (const k of Object.keys(fblMotoreStatiS)) delete fblMotoreStatiS[k];
        positions.length = 0; trades.length = 0; window.__ordiniVeri = 0;
      };
      azzera(false);
      fblMotoreGiroStorico();
      const controllo = positions.length;
      azzera(true);
      fblMotoreGiroStorico();
      return {controllo, bloccate: positions.length, ordiniVeri: __ordiniVeri,
        configurato: fblMotoreConfig().masterOff === true};
    })()`);
    assert.ok(r.controllo >= 1, 'prova di controllo: senza interruttore il CSV deve aprire');
    assert.equal(r.bloccate, 0, 'con l interruttore acceso nessuna posizione sul conto storico');
    assert.equal(r.ordiniVeri, 0, 'ZERO ordini MT5 anche nel backtest');
    assert.equal(r.configurato, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il pannello delle aperture automatiche ha il controllo e lo stato sopravvive a una nuova apriApp', async () => {
  const {browser, pagina, errori} = await apriApp();
  let salvato;
  try {
    const r = await pagina.evaluate(`(() => {
      const body = document.createElement('div');
      fblMotoreAutoSezione({key: 'valid_bos_pullback'}, body);
      const master = body.querySelector('[data-motore-master-off]');
      if (!master) return {trovato: false, caselle: body.querySelectorAll('input[type=checkbox]').length};
      const etichetta = (master.parentElement && master.parentElement.textContent) || '';
      master.checked = true;
      master.dispatchEvent(new Event('change'));
      return {trovato: true, etichetta, salvato: localStorage.getItem('fbl_motore_auto')};
    })()`);
    assert.equal(r.trovato, true,
      'il pannello delle aperture automatiche deve avere l interruttore unico (caselle trovate: ' + r.caselle + ')');
    assert.match(r.etichetta, /blocca TUTTE le aperture automatiche/, 'etichetta italiana chiara');
    salvato = r.salvato;
    assert.equal(JSON.parse(salvato || '{}').masterOff, true, 'la scelta va salvata su localStorage');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }

  // NUOVA apriApp: il contesto e' nuovo, quindi si restituisce il localStorage salvato prima
  // che la pagina parta (e' cio' che succede a un riavvio dell'app sullo stesso dispositivo).
  const seconda = await apriApp({primaDiNavigare: async (paginaNuova) => {
    await paginaNuova.addInitScript((valore) => {
      localStorage.setItem('fbl_motore_auto', valore);
    }, salvato);
  }});
  try {
    const r = await seconda.pagina.evaluate(`(() => {
      (${PREPARA_LIVE.toString()})(false);
      const p = {autoOpenDemo: true, rischioOperazione: 0.5};
      const op = {nome: 'prova', indicatore: 'pullback', setupId: 'dopo-riavvio', barra: idx,
        dir: 1, entry: 4000, sl: 3990, tp: 4020, lotto: 0.2};
      bosAutoApriOpsSetup({ops: [op]}, p, op.setupId, idx);
      return {ordini: __ordini.length, configurato: fblMotoreConfig().masterOff === true,
        letto: localStorage.getItem('fbl_motore_auto')};
    })()`);
    assert.equal(r.configurato, true, 'dopo il riavvio l impostazione deve essere ancora letta');
    assert.equal(r.ordini, 0, 'dopo il riavvio l interruttore acceso deve bloccare le aperture');
    assert.equal(JSON.parse(r.letto || '{}').masterOff, true);
    assert.deepEqual(seconda.errori, []);
  } finally { await seconda.browser.close(); }
});

// Le sale Telegram hanno una strada propria: tgAutoValuta -> tgAutoDecidi -> tgEseguiSegnale.
// Il banco passa per la decisione VERA (non una finta) e conta placeRealMt5Order: nessun ordine
// vero esce dal banco, ma si misura quanti ne sarebbero partiti.
test('interruttore acceso: un segnale automatico di sala non manda ordini MT5', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      const t0 = Date.now() - 200 * 60000, R = [];
      for (let i = 0; i < 200; i++) R.push({date: new Date(t0 + i * 60000).toISOString(),
        open: 4090, high: 4091, low: 4089, close: 4090, volume: 5});
      rows = R; baseRows = R; idx = R.length - 1; viewEnd = idx;
      currentAssetKey = 'XAUUSD';
      if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'XAUUSD';
      liveModeActive = true; liveReplayActive = false; mt5Connected = true;
      positions = []; trades = []; pendingOrders = []; equity = [10000];
      if ($('capital')) $('capital').value = '10000';
      tgStrategie = {}; tgSegnaliRicevuti = []; tgAutoPerConto = {};
      consensoValido = () => true; fblRemoto = () => false; fblEMobile = () => false;
      tgContoPerSegnale = () => 'sim';
      tgPreparaAssetAutomatico = async () => 'XAUUSD';
      syncMt5PositionLevels = async () => {};
      window.__placeOriginale = window.placeRealMt5Order;
      const SEGNALE = {strumento: 'XAUUSD', direzione: 'SELL', entrata: 4090,
        stop_loss: 4100, take_profit: [4078]};
      const CFG = {attivo: true, rischio: 1, maxGlobali: 40, perditaAttiva: false,
        sale: {'Sala A': {attivo: true, rischio: 1, maxPosizioni: 6, quote: [], regole: [], avvicinamento: 0}}};
      const giro = async (spento) => {
        const c = fblMotoreConfig(); c.masterOff = !!spento; fblMotoreSalvaConfig(c);
        window.__ordiniSala = []; positions.length = 0; trades.length = 0;
        window.placeRealMt5Order = async function(side, forz) {
          __ordiniSala.push({side, sl: forz.sl, tp: forz.tp});
          return 910000 + __ordiniSala.length;
        };
        const voce = {id: 7, chat: 'Sala A', sala: '@a', stato: 'nuovo', ricevuto_ms: Date.now(),
          segnale: JSON.parse(JSON.stringify(SEGNALE))};
        tgSegnaliRicevuti.push(voce);
        tgAutoFx = tgAutoDaSalvato(JSON.parse(JSON.stringify(CFG)));
        const deciso = tgAutoDecidi(voce, tgAutoChiaveDestinazione(voce));
        await tgAutoValuta(voce, 'sim');
        return {ordini: __ordiniSala.length, decisione: deciso.apri,
          motivoDecisione: deciso.motivo || null, motivo: voce.autoMotivo || null};
      };
      const controllo = await giro(false);
      const bloccato = await giro(true);
      window.placeRealMt5Order = window.__placeOriginale;
      return {controllo, bloccato};
    })()`);
    assert.equal(r.controllo.decisione, true,
      'prova di controllo: senza interruttore la sala deve decidere di aprire: ' + r.controllo.motivoDecisione);
    assert.ok(r.controllo.ordini >= 1,
      'prova di controllo: senza interruttore deve partire almeno un ordine, trovati ' + r.controllo.ordini);
    assert.equal(r.bloccato.decisione, false, 'con l interruttore acceso la decisione deve essere NO');
    assert.equal(r.bloccato.ordini, 0, 'con l interruttore acceso ZERO ordini dalle sale');
    assert.match(r.bloccato.motivoDecisione || '', /interruttore di emergenza/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('deposito non leggibile: interruttore FAIL-CLOSED, poi ripristinato si torna ad aprire', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      (${PREPARA_LIVE.toString()})();
      const p = {autoOpenDemo: true, rischioOperazione: 0.5};
      const apri = (chiave) => fblAutoInviaOrdineDemo(p, 'XAUUSD', {dir: 1},
        {entry: 4000, sl: 3990, tp: 4020, lots: 0.1, chiave});
      const c = fblMotoreConfig(); c.masterOff = false; fblMotoreSalvaConfig(c);
      const prima = apri('controllo-deposito-ok');
      localStorage.getItem = function(){ throw new Error('deposito non leggibile'); };
      const conErrore = apri('blocco-deposito-guasto');
      const motivo = fblAutoUltimoMotivo;
      delete localStorage.getItem;                 // si ripristina il metodo del prototype
      const dopo = apri('dopo-ripristino');
      return {prima, conErrore, dopo, motivo, ordini: __ordini.length,
        letto: localStorage.getItem('fbl_motore_auto') != null};
    })()`);
    assert.equal(r.prima, true, 'prova di controllo: con deposito leggibile si apre');
    assert.equal(r.conErrore, false, 'con il deposito che lancia NON si deve aprire');
    assert.match(r.motivo, /interruttore di emergenza/, 'il motivo deve dire che e l emergenza');
    assert.equal(r.dopo, true, 'dopo aver ripristinato getItem si torna ad aprire');
    assert.equal(r.ordini, 2, 'devono essere partiti solo i due ordini delle prove valide');
    assert.equal(r.letto, true, 'il metodo originale di localStorage e tornato');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// SESTO CASO — PROVA DI CONTROLLO DELLE APERTURE MANUALI (§3.4.4.a).
//
// I cinque test qui sopra misurano che con masterOff=true le aperture AUTOMATICHE si fermano e le
// chiusure SL/TP continuano. Qui si misura il COMPLEMENTARE: l'interruttore NON deve bloccare le
// aperture MANUALI. Se domani una guardia venisse spostata dentro placeRealMt5Order o
// tgEseguiSegnale, quei cinque test resterebbero verdi e la regressione passerebbe inosservata.
// Nessun ordine vero: MT5 e' staccato e la porta degli ordini resta finta; rete spenta.
//  (a) openMarketTrade('BUY') apre una posizione simulata, come fa oggi, e la si misura in positions[];
//  (b) il pannello segnali (tgApriConfigurazione -> tgConfigApri -> tgEseguiSegnale, senza flag
//      `automatico`) apre comunque, con conferma e consenso finti come quando si preme il pulsante.
test('interruttore acceso: le aperture MANUALI (BUY e pannello segnali) restano disponibili', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(async () => {
      (${PREPARA_LIVE.toString()})();
      // La porta degli ordini resta finta in ogni caso: dal banco non esce nessun ordine vero.
      const placeFinto = placeRealMt5Order;
      const configura = (spento) => {
        const c = fblMotoreConfig(); c.__finto = false; c.masterOff = !!spento; fblMotoreSalvaConfig(c);
        fblAutoApertureFatte = null; localStorage.removeItem('fbl_auto_aperture');
        __ordini.length = 0; positions.length = 0; trades.length = 0;
      };

      // PROVA DI CONTROLLO: con masterOff=false l'apertura AUTOMATICA avviene. Lo dimostrano gia'
      // i primi due test; qui si riusa lo stesso risultato per legare il controllo a questo caso.
      configura(false);
      const controlloAuto = fblAutoInviaOrdineDemo({autoOpenDemo:true}, 'XAUUSD', {dir:1},
        {entry:4000, sl:3990, tp:4020, lots:0.1, chiave:'controllo-manuale-auto'});
      const controlloOrdini = __ordini.length;

      // Ora l'interruttore si accende: la strada automatica si ferma, quella manuale no.
      configura(true);
      const bloccatoAuto = fblAutoInviaOrdineDemo({autoOpenDemo:true}, 'XAUUSD', {dir:1},
        {entry:4000, sl:3990, tp:4020, lots:0.1, chiave:'blocco-manuale-auto'});
      const bloccaOrdini = __ordini.length;

      // (a) PULSANTE BUY: senza MT5 collegato openMarketTrade apre una posizione simulata,
      // esattamente come fa oggi. Si misura che compaia in positions[].
      mt5Connected = false;
      fblContoVista = 'mt5';
      openMarketTrade('BUY');
      const buy = {posizioni: positions.length, lato: positions[0] && positions[0].side,
        ordini: __ordini.length};

      // (b) PANNELLO SEGNALI: il pulsante «Apri le posizioni» passa da tgConfigApri a
      // tgEseguiSegnale senza il flag automatico. Conferma e consenso finti, nessuna rete.
      window.appConfirm = async () => true; appConfirm = window.appConfirm;
      window.appAlert = async () => true; appAlert = window.appAlert;
      consensoValido = () => true;
      tgPreparaAsset = async () => 'XAUUSD';
      tgSegnaliRicevuti = []; tgStrategie = {};
      const voce = {id: 777, chat: 'Sala A', sala: '@a', stato: 'nuovo', ricevuto_ms: Date.now(),
        segnale: {strumento: 'XAUUSD', direzione: 'BUY', entrata: 4000, stop_loss: 3990,
          take_profit: [4020]}};
      tgSegnaliRicevuti.push(voce);
      await tgApriConfigurazione(voce);
      const piano = tgCfgPiano();
      const abilitato = !!$('tgConfigApri') && !$('tgConfigApri').disabled;
      const primaPannello = positions.length;
      $('tgConfigApri').click();
      await new Promise(risolvi => setTimeout(risolvi, 150));
      const pannello = {prima: primaPannello, dopo: positions.length,
        aperte: voce.aperte || 0, ordini: __ordini.length};

      return {controlloAuto, controlloOrdini, bloccatoAuto, bloccaOrdini,
        configurato: fblMotoreConfig().masterOff === true, placeFinto: typeof placeFinto === 'function',
        buy, pianoProblemi: (piano && piano.problemi) || [], abilitato, pannello};
    })()`);
    assert.equal(r.controlloAuto, true, 'prova di controllo: senza interruttore l apertura automatica parte');
    assert.equal(r.controlloOrdini, 1, 'prova di controllo: un ordine finto deve essere partito');
    assert.equal(r.configurato, true, 'premessa: l interruttore e acceso');
    assert.equal(r.bloccatoAuto, false, 'con l interruttore acceso l apertura automatica e bloccata');
    assert.equal(r.bloccaOrdini, 0, 'con l interruttore acceso ZERO ordini automatici');
    assert.equal(r.placeFinto, true, 'premessa: la porta degli ordini e finta');
    assert.equal(r.buy.posizioni, 1, 'apertura MANUALE con BUY: la posizione deve comparire in positions[]');
    assert.equal(r.buy.lato, 'BUY', 'la posizione aperta a mano deve essere BUY');
    assert.equal(r.buy.ordini, 0, 'l apertura manuale non passa dalla porta degli ordini MT5');
    assert.deepEqual(r.pianoProblemi, [], 'il pannello segnali deve avere un piano valido');
    assert.equal(r.abilitato, true, 'il pulsante del pannello segnali deve essere abilitato');
    assert.equal(r.pannello.dopo, r.pannello.prima + 1,
      'apertura MANUALE dal pannello segnali: una posizione in piu in positions[]');
    assert.equal(r.pannello.ordini, 0, 'nessun ordine vero dal pannello segnali');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
