// ============================================================================
// BANCO SUONO + SFARFALLIO (scritto dall'agente di misura, NON eseguito da lui)
// Forex Backtest LAB — difetto del 16 novembre 2026, parole del proprietario:
//
//   «e ancora avviene quello che è il doppio/triplo suono dell'esecuzione /
//    chiusura della posizione con le pagine duplicate e quando avviene la
//    chiusura o l'apertura della posizione tra le finestre duplicate avviene
//    uno sfarfallio della chiusura della posizione a grafico con le linee
//    tp-sl-entry che lampeggiano diverse volte prima di andarsene per le
//    posizioni chiuse mentre per le posizioni aperte rimanere fisse e stabili.»
//
// COSA MISURA, e con che strade:
//   1. il SUONO: `playOrderSound` è sostituita da un contatore (non si ascolta
//      niente). Il banco guida i giri di polling del ponte a mano, in ciascuna
//      delle due finestre, e conta quanti suoni parte per finestra. Il totale
//      che il proprietario sente è la somma: oggi è 2 per l'apertura e 2-3 per
//      la chiusura, deve essere 1 e 1.
//   2. lo SFARFALLIO: `draw` è avvolta da un contatore e le primitive del
//      canvas (`moveTo`/`lineTo`/`stroke`) sono intercettate come fanno i
//      banchi sull'aspetto (`interruttori_posizioni.test.mjs`). Per ogni giro
//      di disegno si registra: la posizione chiusa è ancora in `positions`? e
//      quante righe orizzontali da bordo a bordo (la linea di entrata) sono
//      state dipinte in quel giro. "Lampeggia" = dopo la PRIMA sparizione la
//      posizione ricompare e la sua linea di entrata viene ridipinta.
//   3. PROVA DI CONTROLLO del difetto: una misura dedicata che oggi è VERDE e
//      con la cura diventerà ROSSA — è la dimostrazione che il banco vede il
//      difetto, non che l'app è giusta. Va capovolta quando il difetto è curato.
//   4. PROVA DI CONTROLLO dell'app: la posizione ancora APERTA non deve mai
//      sparire né lampegggiare, e con UNA finestra sola il suono deve partire
//      comunque una volta (la cura non deve tacitare l'app a una finestra).
//
// TRAPPOLE AFFRONTATE QUI, una per una:
//   - `page.evaluate(fn, arg)` prende UN SOLO argomento: tutto passa in un
//     unico oggetto di configurazione (CFG), mai due argomenti.
//   - il grafico sta sotto il bordo della finestra: non si clicca niente, si
//     misura il disegno con le primitive del canvas; la larghezza utile viene
//     letta dal canvas, non dallo schermo.
//   - l'annuncio dell'asset fra finestre svuota le candele della seconda: le
//     candele sono preparate in ENTRAMBE le pagine DOPO che sono aperte, con lo
//     stesso `currentAssetKey`, e il banco VERIFICA che `rows` non sia vuoto
//     prima di ogni misura (altrimenti il test sarebbe muto).
//   - una linea fuori dalla scala di prezzo visibile non si disegna: le
//     candele finte hanno banda ±35 attorno a 1900, così entrata 1900, SL 1890
//     e TP 1920 stanno tutti dentro la scala.
//   - un test è muto se passa anche senza la cura: le prove 4 e 5 sopra sono
//     esattamente il controllo che il banco non è muto.
//   - "non risponde mai" si scrive Infinity, non 999.
//
// Il ponte MT5 è FINTO (nessun ponte vero viene toccato: `apriApp` stacca la
// rete e qui `fetchMt5WithTimeout` è sostituita). Le due finestre sono due
// pagine VERE dello stesso contesto (?pipSlot=2), così il BroadcastChannel
// dell'app le collega davvero.
// ============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

// Il banco sta in %TEMP%\opencode: importa gli aiuti dal repo con un percorso
// assoluto, con il riscontro a './aiuti.mjs' se un giorno viene copiato dentro
// laboratorio/app (dove sta di casa).
let aiuti = null;
try { aiuti = await import('./aiuti.mjs'); }
catch (e) {
  aiuti = await import('file:///C:/Users/pietro/Documents/GitHub/Forex-Backtest.LAB/laboratorio/app/aiuti.mjs');
}
const { apriApp } = aiuti;
const RADICE = aiuti.RADICE || 'C:/Users/pietro/Documents/GitHub/Forex-Backtest.LAB';

// ---------------------------------------------------------------------------
// CONFIGURAZIONE UNICA della scena (un solo oggetto, passato a evaluate).
// ---------------------------------------------------------------------------
const CFG = {
  asset: 'XAUUSD', login: '7712345', server: 'Demo',
  candele: 300, base: 1900, banda: 35,
  // La posizione che VERRA' CHIUSA (ticket 888001) e quella che resta APERTA
  // (ticket 888002, prova di controllo).
  chiusa: { ticket: 888001, symbol: 'XAUUSD', side: 'BUY', volume: 0.50, price_open: 1900, sl: 1890, tp: 1920, time: 0 },
  aperta: { ticket: 888002, symbol: 'XAUUSD', side: 'SELL', volume: 0.25, price_open: 1905, sl: 1925, tp: 1885, time: 0 },
  uscita: 1920, pl: 184.20, saldoDopo: 10184.20
};

// ---------------------------------------------------------------------------
// PREPARA: gira DENTRO la pagina. Prepara le candele, il conto MT5 finto, il
// ponte finto, il contatore dei suoni e l'intercettazione del disegno.
// ---------------------------------------------------------------------------
const PREPARA = (cfg) => {
  // --- candele finte, stesse in tutte e due le finestre -------------------
  // Finiscono "adesso" e hanno banda ±35 attorno a 1900: entrata 1900, SL
  // 1890 e TP 1920 stanno tutti dentro la scala di prezzo visibile, quindi le
  // loro linee si disegnano davvero (una linea fuori scala non si disegna e il
  // banco risulterebbe muto).
  const T00 = Date.now() - cfg.candele * 60000;
  const R = [];
  for (let i = 0; i < cfg.candele; i++) {
    const c = cfg.base + Math.sin(i / 11) * 1.5;
    R.push({
      date: new Date(T00 + i * 60000).toISOString(),
      open: c, high: c + cfg.banda, low: c - cfg.banda, close: c, volume: 10
    });
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length;
  visibleCount = Math.min(300, R.length);
  if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = cfg.asset;
  currentAssetKey = cfg.asset;

  // --- sessione: Live, niente replay, niente backtest, niente prop firm ---
  liveModeActive = true; liveReplayActive = false;
  if (typeof isPropFirmMode !== 'undefined') isPropFirmMode = false;
  if (typeof fblBacktestModeAttivo !== 'undefined') fblBacktestModeAttivo = false;

  // --- conto MT5 finto, IDENTICO nelle due finestre ----------------------
  try { mt5AttivaConto(cfg.login, cfg.server, true, 0); } catch (e) {}
  mt5Connected = true;

  // --- stato pulito: la madre ripristina da disco, e una posizione o una
  // riga di Journal arrivate da ieri renderebbero muta ogni misura qui sotto.
  positions.length = 0; pendingOrders.length = 0; trades.length = 0; equity.length = 0;
  try { if (sessionByMode && sessionByMode.live) { sessionByMode.live.positions.length = 0; sessionByMode.live.trades.length = 0; } } catch (e) {}
  if (typeof active !== 'undefined') active = null;

  // --- ponte finto: /positions legge window.__foto, /deal_reason inventa --
  window.__foto = [];
  window.__dealChiamate = 0;
  window.fetchMt5WithTimeout = async function (url) {
    const u = String(url || '');
    if (u.indexOf('/positions') === 0) return { ok: true, data: window.__foto };
    if (u.indexOf('/deal_reason') === 0) {
      window.__dealChiamate++;
      const t = Math.floor(Date.now() / 1000);
      return {
        ok: true, data: {
          reason: 'TP', price: cfg.uscita, profit_net: cfg.pl, balance: cfg.saldoDopo,
          time: t, time_open: t - 600, price_open: cfg.chiusa.price_open
        }
      };
    }
    if (u.indexOf('/account') === 0) {
      return { ok: true, data: { login: cfg.login, server: cfg.server, balance: cfg.saldoDopo } };
    }
    return { ok: false, message: 'banco di prova' };
  };

  // --- il polling NON deve girare da solo: i giri li guida il banco ------
  try { stopMt5PositionsPolling(true); } catch (e) {}
  window.mt5PositionsGiro = function () { };              // timer muto
  window.startMt5PositionsPolling = function () { };      // non si riaccende
  window.guardianoCandeleMt5 = function () { return Promise.resolve(); };

  // --- il suono non si ascolta: si conta ---------------------------------
  window.__suoni = 0;
  window.playOrderSound = function () { window.__suoni++; };

  // --- il disegno si conta: avvolgo draw() e intercetto le primitive -----
  const proto = CanvasRenderingContext2D.prototype;
  const vM = proto.moveTo, vL = proto.lineTo, vS = proto.stroke;
  window.__stato = { intere: 0 };
  proto.moveTo = function (x, y) { window.__ultimo = { x1: x, y1: y }; return vM.apply(this, arguments); };
  proto.lineTo = function (x, y) { if (window.__ultimo) { window.__ultimo.x2 = x; window.__ultimo.y2 = y; } return vL.apply(this, arguments); };
  proto.stroke = function () {
    const u = window.__ultimo;
    // Solo le righe che partono dal BORDO SINISTRO e attraversano quasi tutto
    // il grafico: sono le righe di prezzo (entrata, e le TP/SL della casella).
    if (u && u.x2 != null && Math.abs(u.y1 - u.y2) < 0.5
        && u.x1 < 30 && (u.x2 - u.x1) > window.__larg * 0.9) window.__stato.intere++;
    window.__ultimo = null;
    return vS.apply(this, arguments);
  };
  window.__larg = (document.getElementById('chart').clientWidth || 800) - 60;

  const veroDraw = window.draw;
  window.__log = [];
  window.draw = function () {
    window.__stato.intere = 0;
    try { return veroDraw.apply(this, arguments); }
    finally {
      const c = positions.some(p => p && p.mt5Ticket != null && String(p.mt5Ticket) === String(cfg.chiusa.ticket));
      const a = positions.some(p => p && p.mt5Ticket != null && String(p.mt5Ticket) === String(cfg.aperta.ticket));
      window.__log.push({ t: Date.now(), chiusa: c, aperta: a, intere: window.__stato.intere });
    }
  };

  // PROVA CHE L'INTERCETTAZIONE FUNZIONA (altrimenti il banco sarebbe muto):
  // un giro di draw() chiamato a mano deve comparire nel log.
  const prima = window.__log.length;
  try { draw(); } catch (e) {}
  const selfCheck = window.__log.length > prima && window.__larg > 100;

  return {
    slot: PIP_SLOT, canale: !!tradingChannel, righe: rows.length,
    conto: currentMt5AccountTag().mt5Login || null, selfCheck: selfCheck
  };
};

// ---------------------------------------------------------------------------
// Aiuti dentro la pagina: cambio della fotografia del ponte e giro di polling.
// ---------------------------------------------------------------------------
const FOTO = (lista) => ({ foto: lista });
const setFoto = (pagina, lista) => pagina.evaluate((a) => { window.__foto = a.foto; }, FOTO(lista));
const giro = (pagina) => pagina.evaluate(() => fetchMt5Positions());

const LEGGI = (pagina) => pagina.evaluate(() => ({
  suoni: window.__suoni, deal: window.__dealChiamate,
  posizioni: positions.map(p => (p.mt5Ticket != null ? String(p.mt5Ticket) : 'sim')).join(','),
  trades: trades.length,
  log: window.__log.length,
  righe: rows.length,
  moda: currentMode(), login: currentMt5AccountTag().mt5Login || null
}));

// ---------------------------------------------------------------------------
// Madre (?pipSlot assente) + duplicata (?pipSlot=2), STESSO contesto: è così
// che le apre il pulsante «Duplica finestra» ed è l'unico modo perché il
// BroadcastChannel dell'app le raggiunga davvero.
// ---------------------------------------------------------------------------
function ascoltaErrori(pagina) {
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  return errori;
}

async function apriDueFinestre() {
  const { browser, pagina, errori } = await apriApp();
  const p2 = await pagina.context().newPage();
  const errori2 = ascoltaErrori(p2);
  await p2.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p2.goto('file://' + RADICE.replace(/\\/g, '/') + '/app.html?pipSlot=2', { waitUntil: 'domcontentloaded' });
  await p2.waitForTimeout(2500);
  await p2.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
    .forEach(el => el.style.display = 'none'));
  return { browser, madre: pagina, duplicata: p2, errori, errori2 };
}

async function preparaDue(bench) {
  const a = await bench.madre.evaluate(PREPARA, CFG);
  const b = await bench.duplicata.evaluate(PREPARA, CFG);
  return { madre: a, duplicata: b };
}

// ---------------------------------------------------------------------------
// Analisi del log dei disegni: "lampeggia" = dopo la prima sparizione la
// posizione RICOMPARE e una sua riga di prezzo viene RIDIPINTA.
//
// `base` è quante righe orizzontali da bordo a bordo dipinge il grafico QUANDO
// LA POSIZIONE CHIUSA NON C'E' PIU' (misurata a scena assestata: la posizione
// aperta ne disegna già da sé, quindi il numero assoluto non concluderebbe
// niente — quello che conta è la DIFFERENZA).
// ---------------------------------------------------------------------------
function analizza(log, campo, base) {
  const b = Number.isFinite(base) ? base : 0;
  const primo = log.findIndex(e => e[campo]);
  if (primo < 0) return { maiVista: true, ricomparse: 0, giriDopo: 0, righeInPiu: 0 };
  const sparizione = log.findIndex((e, i) => i >= primo && !e[campo]);
  if (sparizione < 0) return { maiSparita: true, ricomparse: 0, giriDopo: 0, righeInPiu: 0 };
  let ricomparse = 0, giriDopo = 0, righeInPiu = 0;
  for (let i = sparizione; i < log.length; i++) {
    if (log[i][campo]) ricomparse++;                 // ricomparsa = un lampo
    if ((log[i].intere || 0) > b) righeInPiu++;      // una sua riga è stata ridipinta
    giriDopo++;
  }
  return { maiVista: false, maiSparita: false, sparizione, ricomparse, giriDopo, righeInPiu, base: b };
}

// Misura la baseline: a scena assestata, quante righe orizzontali da bordo a
// bordo disegna il grafico (la posizione aperta ne disegna già qualcuna).
// Riporta anche se la posizione chiusa è ancora in elenco: se lo fosse, la
// baseline conterebbe anche le sue righe e la misura non concluderebbe niente.
const baseRighe = (pagina, cfg) => pagina.evaluate((c) => {
  const prima = window.__log.length;
  try { draw(); } catch (e) {}
  const u = window.__log[window.__log.length - 1];
  return {
    base: u ? (u.intere || 0) : 0,
    giri: window.__log.length,
    chiusaAncora: positions.some(p => p && p.mt5Ticket != null && String(p.mt5Ticket) === String(c.ticket)),
    selfCheck: window.__log.length > prima
  };
}, cfg ? { ticket: cfg.chiusa.ticket } : { ticket: 0 });

// ===========================================================================
// PROVA 1 — MISURA DEL DIFETTO (l'apertura suona in OGNI finestra)
//
// Oggi è VERDE e conta 2 suoni per una sola apertura: è la dimostrazione che
// il banco vede il difetto. Quando il difetto sarà curato questa prova diventa
// ROSSA e va CAPOVOLTA in `assert.equal(suoni, 1)` (cioè assorbita dalla
// prova 2). Fino ad allora è il controllo che il banco non è muto.
// ===========================================================================
test('MISURA DEL DIFETTO: con due finestre la STESSA apertura suona due volte (una per finestra)', async () => {
  const bench = await apriDueFinestre();
  try {
    const prep = await preparaDue(bench);
    assert.equal(prep.madre.selfCheck && prep.duplicata.selfCheck, true,
      'l\'intercettazione di draw() non ha funzionato: il banco sarebbe muto');
    assert.equal(prep.madre.canale && prep.duplicata.canale, true,
      'il canale fra finestre non è attivo: il banco non potrebbe misurare');
    assert.ok(prep.madre.righe > 100 && prep.duplicata.righe > 100,
      'le candele finte non sono caricate: senza candele niente si disegna e il test è muto');

    // --- giro 1: base silenziosa (niente da adottare, niente da annunciare)
    await setFoto(bench.madre, []);
    await setFoto(bench.duplicata, []);
    await Promise.all([giro(bench.madre), giro(bench.duplicata)]);
    await bench.madre.waitForTimeout(800);

    // --- giro 2: la posizione nuova compare. Due giri "contemporanei" (due
    // polling indipendenti, come nel vero): la fotografia arriva a tutte e due.
    await setFoto(bench.madre, [CFG.chiusa]);
    await setFoto(bench.duplicata, [CFG.chiusa]);
    await Promise.all([giro(bench.madre), giro(bench.duplicata)]);
    await bench.madre.waitForTimeout(900);

    const a = await LEGGI(bench.madre);
    const b = await LEGGI(bench.duplicata);
    const suoni = a.suoni + b.suoni;
    assert.equal(suoni, 2,
      'con due finestre la stessa apertura deve suonare DUE volte (una per finestra): ' +
      'madre ' + a.suoni + ', duplicata ' + b.suoni + ', posizioni adottate ' +
      a.posizioni + ' / ' + b.posizioni);
    assert.deepEqual(bench.errori, [], 'la madre non deve avere errori JS');
    assert.deepEqual(bench.errori2, [], 'la duplicata non deve avere errori JS');
  } finally { await bench.browser.close(); }
});

// ===========================================================================
// PROVA 2 — con due finestre l'apertura deve suonare UNA volta sola
// (OGGI ROSSA: conta 2. Con la cura deve diventare 1.)
// ===========================================================================
test('con due finestre l\'apertura di una posizione suona una volta sola', async () => {
  const bench = await apriDueFinestre();
  try {
    await preparaDue(bench);
    await setFoto(bench.madre, []);
    await setFoto(bench.duplicata, []);
    await Promise.all([giro(bench.madre), giro(bench.duplicata)]);
    await bench.madre.waitForTimeout(800);
    await setFoto(bench.madre, [CFG.chiusa]);
    await setFoto(bench.duplicata, [CFG.chiusa]);
    await Promise.all([giro(bench.madre), giro(bench.duplicata)]);
    await bench.madre.waitForTimeout(900);
    const a = await LEGGI(bench.madre);
    const b = await LEGGI(bench.duplicata);
    assert.equal(a.suoni + b.suoni, 1,
      'una sola apertura deve produrre un solo suono, non uno per finestra. ' +
      'Madre ' + a.suoni + ' + duplicata ' + b.suoni + ' = ' + (a.suoni + b.suoni));
  } finally { await bench.browser.close(); }
});

// ===========================================================================
// PROVA 3 — la CHIUSURA fra finestre duplicate
//
// Scena fedele al vero: i due polling sono indipendenti, quindi la fotografia
// della MADRE perde il ticket un paio di giri prima di quella della DUPLICATA
// (nel vero la differenza è di uno-due secondi, ed è esattamente il disalline-
// amento che produce lo sfarfallio). Si misura:
//   - quanti suoni di chiusura parte in tutto (deve essere 1);
//   - quante righe di Journal restano (deve essere 1: oggi la chiusura viene
//     riscritta e la riga si duplica);
//   - quante volte la posizione chiusa ricompare a grafico e viene ridipinta
//     (deve essere 0).
// ===========================================================================
test('con due finestre la chiusura suona una volta, non lascia righe doppie e non fa lampeggiare le linee', async () => {
  const bench = await apriDueFinestre();
  try {
    await preparaDue(bench);

    // --- giro 1: base silenziosa, niente da adottare ---------------------
    await setFoto(bench.madre, []);
    await setFoto(bench.duplicata, []);
    await Promise.all([giro(bench.madre), giro(bench.duplicata)]);
    await bench.madre.waitForTimeout(800);

    // --- giro 2: le posizioni nuove compaiono: le adottano tutte e due ---
    await setFoto(bench.madre, [CFG.chiusa, CFG.aperta]);
    await setFoto(bench.duplicata, [CFG.chiusa, CFG.aperta]);
    await Promise.all([giro(bench.madre), giro(bench.duplicata)]);
    await bench.madre.waitForTimeout(900);
    const suoniDopoApertura = (await LEGGI(bench.madre)).suoni + (await LEGGI(bench.duplicata)).suoni;

    // --- giri 3 e 4: la MADRE non vede più il ticket, la DUPLICATA sì -----
    // (disallineamento dei due polling: nel vero è la norma, non l'eccezione)
    for (let g = 0; g < 2; g++) {
      await setFoto(bench.madre, [CFG.aperta]);
      await setFoto(bench.duplicata, [CFG.chiusa, CFG.aperta]);
      await giro(bench.madre);
      await bench.madre.waitForTimeout(700);
      await giro(bench.duplicata);
      await bench.madre.waitForTimeout(700);
    }

    // --- giri 5..8: la duplicata finalmente perde il ticket ----------------
    for (let g = 0; g < 4; g++) {
      await setFoto(bench.madre, [CFG.aperta]);
      await setFoto(bench.duplicata, [CFG.aperta]);
      await giro(bench.madre);
      await bench.madre.waitForTimeout(700);
      await giro(bench.duplicata);
      await bench.madre.waitForTimeout(700);
    }

    // --- assestamento: gli ultimi messaggi fra finestre devono passar ----
    await bench.madre.waitForTimeout(1500);

    const a = await LEGGI(bench.madre);
    const b = await LEGGI(bench.duplicata);
    const logA = await bench.madre.evaluate(() => window.__log);
    const logB = await bench.duplicata.evaluate(() => window.__log);

    const baseA = await baseRighe(bench.madre, CFG);
    const baseB = await baseRighe(bench.duplicata, CFG);
    // Se la posizione chiusa fosse ancora in elenco, tutta la misura dello
    // sfarfallio sarebbe muta: la baseline conterebbe anche le sue righe.
    assert.equal(baseA.chiusaAncora || baseB.chiusaAncora, false,
      'la posizione chiusa deve essere FUORI dalle posizioni a scena assestata: ' +
      'madre ' + a.posizioni + ', duplicata ' + b.posizioni);
    const chiusaA = analizza(logA, 'chiusa', baseA.base);
    const chiusaB = analizza(logB, 'chiusa', baseB.base);
    const suoniChiusura = (a.suoni + b.suoni) - suoniDopoApertura;

    assert.equal(suoniChiusura, 1,
      'la chiusura di una posizione deve produrre UN suono in tutto, con quante ' +
      'finestre si vuole. Suoni di chiusura contati: ' + suoniChiusura +
      ' (madre ' + a.suoni + ', duplicata ' + b.suoni + ', dopo apertura ' +
      suoniDopoApertura + ').');
    assert.equal(a.trades, 1,
      'la chiusura deve lasciare UNA riga nel Journal. Righe sulla madre: ' + a.trades);
    assert.equal(chiusaA.ricomparse + chiusaB.ricomparse, 0,
      'le linee della posizione chiusa non devono ricomparre dopo la sparizione. ' +
      'Ricomparse sulla madre: ' + chiusaA.ricomparse + ' (' + chiusaA.giriDopo +
      ' giri dopo la sparizione), sulla duplicata: ' + chiusaB.ricomparse +
      ' (' + chiusaB.giriDopo + ' giri).');
    assert.equal(chiusaA.righeInPiu + chiusaB.righeInPiu, 0,
      'le righe di prezzo della posizione chiusa non devono essere ridipinte ' +
      'dopo la chiusura. Giri con una riga in piu\': madre ' + chiusaA.righeInPiu +
      ' (baseline ' + chiusaA.base + ' righe da sola), duplicata ' + chiusaB.righeInPiu +
      ' (baseline ' + chiusaB.base + ' righe da sola).');
  } finally { await bench.browser.close(); }
});

// ===========================================================================
// PROVA 4 — CONTROLLO: la posizione APERTA resta fissa e stabile
//
// È la metà del sintomo del proprietario («per le posizioni aperte rimanere
// fisse e stabili»). Se questa prova passa e la prova 3 no, la causa è una
// sola con due effetti: la posizione chiusa passa da una lista all'altra,
// quella aperta non ci passa mai.
// ===========================================================================
test('PROVA DI CONTROLLO: la posizione ancora aperta non lampeggia e non sparisce', async () => {
  const bench = await apriDueFinestre();
  try {
    await preparaDue(bench);
    await setFoto(bench.madre, []);
    await setFoto(bench.duplicata, []);
    await Promise.all([giro(bench.madre), giro(bench.duplicata)]);
    await bench.madre.waitForTimeout(800);
    await setFoto(bench.madre, [CFG.chiusa, CFG.aperta]);
    await setFoto(bench.duplicata, [CFG.chiusa, CFG.aperta]);
    await Promise.all([giro(bench.madre), giro(bench.duplicata)]);
    await bench.madre.waitForTimeout(900);
    await setFoto(bench.madre, [CFG.aperta]);
    await setFoto(bench.duplicata, [CFG.aperta]);
    for (let g = 0; g < 6; g++) {
      await giro(bench.madre);
      await bench.madre.waitForTimeout(600);
      await giro(bench.duplicata);
      await bench.madre.waitForTimeout(600);
    }
    await bench.madre.waitForTimeout(1200);
    const a = await LEGGI(bench.madre);
    const b = await LEGGI(bench.duplicata);
    const logA = await bench.madre.evaluate(() => window.__log);
    const logB = await bench.duplicata.evaluate(() => window.__log);
    const apertaA = analizza(logA, 'aperta');
    const apertaB = analizza(logB, 'aperta');
    const giriConApertaA = logA.filter(e => e.aperta).length;
    const giriConApertaB = logB.filter(e => e.aperta).length;
    assert.equal(giriConApertaA > 0 && giriConApertaB > 0, true,
      'la posizione aperta deve risultare disegnata in tutte e due le finestre ' +
      '(madre ' + giriConApertaA + ' giri, duplicata ' + giriConApertaB + ' giri)');
    assert.equal(apertaA.ricomparse + apertaB.ricomparse, 0,
      'la posizione aperta non deve lampeggiare: ricomparse madre ' +
      apertaA.ricomparse + ', duplicata ' + apertaB.ricomparse);
    assert.ok(a.posizioni.indexOf(String(CFG.aperta.ticket)) >= 0
      && b.posizioni.indexOf(String(CFG.aperta.ticket)) >= 0,
      'la posizione aperta deve restare in elenco in tutte e due le finestre: ' +
      a.posizioni + ' / ' + b.posizioni);
  } finally { await bench.browser.close(); }
});

// ===========================================================================
// PROVA 5 — CONTROLLO: con UNA finestra sola il suono deve partire comunque
//
// Senza questa prova la cura più facile («non suona nessuno») farebbe passare
// tutte le altre. È la prova che la cura deve scegliere CHI suona, non zittire.
// ===========================================================================
test('PROVA DI CONTROLLO: con una finestra sola l\'apertura e la chiusura suonano comunque', async () => {
  const { browser, pagina } = await apriApp();
  try {
    const prep = await pagina.evaluate(PREPARA, CFG);
    assert.equal(prep.selfCheck, true, 'l\'intercettazione di draw() non funziona: banco muto');
    assert.equal(prep.canale, true, 'il canale fra finestre deve esistere anche con una finestra sola');

    // UNA POSIZIONE PER VOLTA, e la prima stesura di questa prova sbagliava proprio qui
    // (corretto il 17 novembre 2026, lanciando il banco per la prima volta): adottava DUE
    // posizioni in un colpo solo (`[chiusa, aperta]`) e poi pretendeva UN suono. Due posizioni
    // che compaiono fanno due suoni, ed e' ragionevole: la prova falliva per la sua attesa, non
    // per un difetto dell'app, e letta di fretta diceva «il suono raddoppia anche con una
    // finestra sola» - che avrebbe mandato la diagnosi dalla parte sbagliata.
    // Cosi' invece la misura non e' ambigua: un'apertura un suono, una chiusura un suono.
    await setFoto(pagina, []);
    await giro(pagina);                         // base silenziosa
    await pagina.waitForTimeout(500);
    await setFoto(pagina, [CFG.aperta]);
    await giro(pagina);                         // UNA adozione: deve suonare una volta
    await pagina.waitForTimeout(600);
    const dopoApertura = await LEGGI(pagina);
    assert.equal(dopoApertura.suoni, 1,
      'con una finestra sola l\'apertura deve suonare una volta: ' + dopoApertura.suoni);

    await setFoto(pagina, [CFG.aperta, CFG.chiusa]);
    await giro(pagina);                         // la seconda apertura: due suoni in tutto
    await pagina.waitForTimeout(600);
    const dopoSeconda = await LEGGI(pagina);
    assert.equal(dopoSeconda.suoni, 2,
      'la seconda apertura deve suonare a sua volta (2 in tutto): ' + dopoSeconda.suoni);

    await setFoto(pagina, [CFG.aperta]);
    for (let g = 0; g < 3; g++) { await giro(pagina); await pagina.waitForTimeout(500); }
    await pagina.waitForTimeout(600);
    const dopoChiusura = await LEGGI(pagina);
    assert.equal(dopoChiusura.suoni, 3,
      'e la chiusura deve suonare una volta sola (3 in tutto): ' + dopoChiusura.suoni);
    assert.equal(dopoChiusura.trades, 1,
      'con una finestra sola la chiusura lascia una riga sola: ' + dopoChiusura.trades);
    assert.equal(dopoChiusura.posizioni.indexOf(String(CFG.aperta.ticket)) >= 0, true,
      'la posizione aperta deve restare: ' + dopoChiusura.posizioni);
  } finally { await browser.close(); }
});