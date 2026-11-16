// APRE PIU' POSIZIONI DI QUANTE IL SEGNALE NE CHIEDA: UNO PER TAKE PROFIT, NON UNO IN PIU'.
//
// SEGNALATO dal proprietario (16 novembre 2026, con due foto):
//   «apre più posizioni del dovuto rispetto a quello che dice il segnale del numero delle
//    posizioni. Deve aprire lo stesso numero di posizioni per il numero di TP mai di più.»
// Dalle foto: il segnale dichiara 4 TP (Entry 3875-3880, SL 3890, TP1 3870, TP2 3865, TP3 3860,
// TP4 3855) e il pannello del segnale conferma «4 posizioni da 0.01 lot su MT5». Quindi UNA
// POSIZIONE PER TP è la regola giusta: il difetto è la RIPETIZIONE.
//
// CAUSA GIÀ CONFERMATA DAL PROPRIETARIO, COL SUO NUMERO: «avevo 2 finestre duplicate e quindi
// ha aperto x3 volte» → OGNI FINESTRA APPLICA IL SEGNALE PER CONTO SUO (madre + 2 duplicate =
// 3 applicazioni × 4 TP = 12 posizioni invece di 4).
//
// DOVE LO MISURA QUESTO BANCO. Non sul testo del sorgente: sul numero di ordini che partono
// DAVVERO. Si inietta un messaggio 'segnale' nel WebSocket finto (la stessa strada di
// `tgMessaggioSegnali`, app.html ~38539, che è ciò che fa il ponte a ogni consegna) e si conta
// quante volte viene chiamato `placeRealMt5Order` — l'ordine vero verso il ponte MT5, sostituito
// qui da un ponte finto che risponde con un ticket. Contare gli ordini e non `positions[]` è
// essenziale: sulla strada MT5 senza grafico (`senzaGrafico`) le posizioni NON finiscono in
// `positions[]` (arrivano dopo, dal polling del conto), contarle qui conterebbe zero.
//
// STRADA MISURATA (quella delle foto, soldi veri): conto MT5 collegato + apertura automatica.
//   tgMessaggioSegnali (38539) → tgAutoInCoda (42061) → tgAutoValuta (42126) →
//   tgAutoApriQui (42377) → tgEseguiSegnale (43791) → ciclo su p.n (43908) → placeRealMt5Order.
// Il numero di posizioni per applicazione si decide in UN punto solo: tgPiano (43550), riga
// ~43695 `let n=Math.max(1,tp.length)` (un take profit = una posizione, con i tetti e il lotto
// minimo come uniche riduzioni). Questo banco misura quel numero per INTERO segnale, non per
// finestra: è quello che chiede la regola.
//
// PROVE, nell'ordine:
//   1. 4 TP → 4 ordini (la regola, e prova di controllo che il segnale produce ordini).
//   2. 1 TP → 1 e 3 TP → 3 (la regola, non un caso solo).
//   3. un ordine rifiutato NON si ritenta; un esito sconosciuto nemmeno (regola del progetto).
//   4. lo stesso messaggio arrivato due volte sulla STESSA finestra non raddoppia (misurato: lo
//      chiude il ricordo su disco, non il filtro anti-doppioni di contenuto — fblDedupMotivo
//      ~5762 non scatta su questa strada, perche' le posizioni MT5 "senza grafico" non finiscono
//      in positions[] e quel filtro non ha niente con cui confrontare).
//   5-6. LA REGOLA CON LE FINESTRE DUPLICATE: madre + 1 duplicata → 4 ordini in tutto; madre +
//      2 duplicate → 4 ordini in tutto (il numero del proprietario, rovesciato: prima 8 e 12).
//   7. LA REGOLA: la madre apre i suoi 4, la duplicata non apre niente E DICE PERCHE'.
//   8. RICARICA: dopo la ricarica della pagina e la riconsegna dello stesso messaggio da parte
//      del ponte → 0 ordini nuovi.
// Le prove 5-8 sono la cura: passano quando l'applicazione del segnale passa da una finestra
// sola (la madre, come già fa `anotherWindowOwnsAssetEvaluation`, ~9493, per la valutazione
// SL/TP) e quando ciò che è stato applicato viene ricordato anche dopo una ricarica.
//
// Trappole rispettate: `page.evaluate` prende UN SOLO argomento (le costanti della scena
// viaggiano dentro `dati.fisso`, pena "CONTO is not defined" — pagato al primo giro);
// nessuna prova esce in rete (le rotte di apriApp bloccano tutto cio' che non è file://);
// le attese sono attive, non tempi fissi.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

// Raccoglie gli errori JS di OGNI pagina aperta dal banco (apriApp lo fa solo per la prima).
function ascoltaErrori(pagina) {
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  return errori;
}

// ===================== LA SCENA, DENTRO LA PAGINA =====================
// LE COSTANTI DELLA SCENA PASSANO DENTRO LA PAGINA CON L'ARGOMENTO, NON STANNO NEL MODULO.
// Motivo, pagato in questo banco al primo giro: `page.evaluate(SCENA, dati)` porta dentro la
// pagina la funzione e `dati`, non le variabili libere del modulo — la scena leggeva `CONTO` e
// la pagina rispondeva "CONTO is not defined", e tutte e nove le prove cadevano senza misurare
// niente. Un solo argomento, quindi le costanti viaggiano dentro `dati.fisso`.
const FISSO = {conto: '123456@Demo-Server',   // conto dichiarato demo: non è "da trattare come reale"
  sala: 'Sala di prova', asset: 'XAUUSD', prezzo: 3878, sl: 3890};   // 3878 dentro la fascia 3875-3880

// Prepara la pagina come il computer del proprietario: conto MT5 collegato, apertura automatica
// accesa per quella sala, consenso ai rischi registrato col registro dell'app (non sostituito),
// candele finte con un prezzo valido, ponte MT5 finto che conta gli ordini e risponde con un
// ticket. Poi inietta il messaggio nel WebSocket finto dei segnali — la strada vera.
//
// `pulisci` (predefinito true) rimette a zero lo stato della pagina. Deve essere false quando la
// stessa pagina riceve il messaggio una SECONDA volta (prova 4): azzerare le posizioni e la
// lista dei segnali cancellerebbe proprio ciò che deve fermare il doppione.
const SCENA = (dati) => {
  const C = dati.fisso || {};
  localStorage.setItem('fb_tg_attivo', '1');      // tgGiaUsato(): la pagina si ricollega da sé
  if (dati.pulisci !== false) {
    liveModeActive = true; mt5Connected = true; liveReplayActive = false;
    mt5ContoAttivo = {login: '123456', server: 'Demo-Server', currency: 'EUR'};
    // Conto DICHIARATO demo: sconosciuto vorrebbe dire "reale" e l'automatico si fermerebbe
    // (tgAutoContoDaTrattareComeReale ~40508: "sconosciuto => per sicurezza reale").
    mt5ContoRealePerChiave = {}; mt5ContoRealePerChiave[C.conto] = false;

    // 60 candele finte di XAUUSD, prezzo dentro la fascia d'ingresso. Date ISO con la Z: senza
    // fuso l'app le legge nell'orario del broker e sposta tutto (LEZIONI, candele finte).
    const T0 = Date.UTC(2026, 10, 16, 10, 0, 0);
    const R = [];
    for (let i = 0; i < 60; i++) R.push({date: new Date(T0 + i * 60000).toISOString(),
      open: C.prezzo, high: C.prezzo + 3, low: C.prezzo - 3, close: C.prezzo, volume: 10});
    rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
    rowsAssetKey = C.asset; currentAssetKey = C.asset;

    // Decimali e dimensione del contratto NOTI: senza, tgPiano non potrebbe calcolare il lotto e
    // il segnale verrebbe rifiutato prima di aprire (il banco misurerebbe un rifiuto, non le
    // aperture). Contract size e decimali sono numeri qualunque purché positivi.
    recordAssetAutoMeta(C.asset, {decimals: 2, contractSize: 100, minDeal: 0.01, locked: true}, 'banco');

    positions = []; trades = []; pendingOrders = []; active = null; posSelezionata = null;
    tgAutoPerConto = {};
    tgAutoFx.attivo = true; tgAutoFx.etaMaxS = 600; tgAutoFx.perditaAttiva = false;
    tgAutoFx.maxGlobali = 20; tgAutoFx.newsAttiva = false;
    tgAutoFx.sale = {}; tgAutoFx.sale[C.sala] = {attivo: true, rischio: 1, maxPosizioni: 20,
      regole: [], quote: [], modo: 'posizioni', avvicinamento: 0};
    tgAutoCr.attivo = false;

    consensoRegistra('esecuzione');      // il registro dell'app, con la sua versione del testo
  }

  // IL PONTE MT5 FINTO. Conta gli ordini e risponde come il ponte vero: un ticket per ordine.
  // Sostituire `placeRealMt5Order` è la stessa tecnica degli altri banchi (fetchMt5WithTimeout,
  // resolveMt5SymbolForAsset...): nessuna prova esce in rete, le rotte di apriApp bloccano tutto.
  const conteggio = {ordini: 0, dettaglio: []};
  placeRealMt5Order = async function (side, o) {
    conteggio.ordini++;
    conteggio.dettaglio.push({side, tp: o && o.tp, sl: o && o.sl,
      tpIndice: o && o.meta && o.meta.tgTpIndice, segnaleId: o && o.meta && o.meta.tgSegnaleId});
    if (dati.rifiutaAl && conteggio.ordini === dati.rifiutaAl) return false;      // ordine rifiutato
    if (dati.saltaAl && conteggio.ordini === dati.saltaAl) throw new Error('ponte muto');  // esito sconosciuto
    return 'T' + conteggio.ordini;                                               // ticket, come il vero
  };
  resolveMt5SymbolForAsset = async (s) => s;          // il broker HA lo strumento
  fetchMt5Positions = async () => ({});               // niente polling: le posizioni vere restano fuori

  // IL MESSAGGIO, come lo manda il ponte (segnali_bridge.py, `da(ultimo_id)`): tipo 'segnale',
  // id della bacheca, età vera calcolata sul PC (eta_ms). I take profit sono quelli del segnale
  // delle foto (4 TP = SELL XAUUSD, SL 3890).
  const messaggio = {
    tipo: 'segnale', id: dati.id, chat: C.sala, sala: C.sala, eta_ms: 0,
    segnale: {
      strumento: C.asset, direzione: 'SELL', entrata: C.prezzo, stop_loss: C.sl,
      take_profit: dati.tp, testo: 'SELL XAUUSD ' + C.sl, direzione_esplicita: true,
    },
  };

  // La presa dei segnali la apre l'app da sé solo se all'avvio il collegamento era già acceso
  // (`tgGiaUsato()`, letto una volta al caricamento). Qui la accendo a mano: è la stessa
  // `tgCollega()` che chiama l'app, con lo stesso WebSocket finto installato da aiuti.mjs.
  const ws = () => (window.__wsFinti || []).filter(w => /ws\/segnali/.test(w.url)).pop();
  const avvia = () => {
    let w = ws();
    if (!w) { try { tgCollega(); } catch (e) {} w = ws(); }
    if (!w) return {errore: 'nessun websocket dei segnali'};
    w.__consegna(messaggio); return {ok: true};
  };
  // Attesa attiva: la catena è asincrona (asset → piano → ordini). Si aspetta che il segnale
  // sia risolto ('eseguito' o con un motivo), non un tempo fisso: un tempo fisso è il modo
  // per misurare il vuoto su una macchina lenta.
  const aspetta = async (quante) => {
    const voce = () => (tgSegnaliRicevuti || []).slice().reverse().find(v => v && v.id === dati.id);
    for (let i = 0; i < 200; i++) {
      await new Promise(r => setTimeout(r, 50));
      const v = voce();
      if (v && (v.stato === 'eseguito' || v.stato === 'ignorato' || v.autoMotivo)) break;
      if (conteggio.ordini >= quante) break;
    }
    await new Promise(r => setTimeout(r, 300));      // assestamento finale
    const v = voce() || {};
    return {ordini: conteggio.ordini, dettaglio: conteggio.dettaglio.slice(),
      aperte: v.aperte, stato: v.stato, motivo: v.autoMotivo || null,
      tpDellEseguito: v.eseguito ? v.eseguito.tp : null};
  };
  avvia();
  return aspetta(dati.tp.length || 1);
};

// Quanti ordini sono partiti in tutto: la misura che interessa è quella COMPLESSIVA del segnale,
// non quella di una finestra sola.
function totale(...risultati) {
  return risultati.reduce((s, r) => s + (r.ordini || 0), 0);
}

// ===================== 1. LA REGOLA: UN TAKE PROFIT, UNA POSIZIONE =====================
test('un segnale con 4 take profit parte con 4 ordini, non uno di piu\'', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(SCENA, {fisso: FISSO, id: 'seg-4tp', tp: [3870, 3865, 3860, 3855]});
    // PROVA DI CONTROLLO: se fosse zero, tutte le prove qui sotto sarebbero mute.
    assert.ok(r.ordini > 0, 'il segnale deve davvero produrre ordini, sennò il banco non misura niente');
    assert.equal(r.ordini, 4, '4 take profit = 4 ordini: ' + JSON.stringify(r.dettaglio));
    assert.equal(r.aperte, 4, 'e il pannello del segnale deve dire 4 posizioni aperte');
    // Uno per take profit, con il SUO target: non 4 ordini tutti con lo stesso TP.
    assert.deepEqual(r.dettaglio.map(d => d.tp), [3870, 3865, 3860, 3855]);
    assert.deepEqual(r.dettaglio.map(d => d.tpIndice), [1, 2, 3, 4]);
    assert.deepEqual(r.tpDellEseguito, [3870, 3865, 3860, 3855]);
    assert.ok(r.dettaglio.every(d => d.sl === FISSO.sl && d.segnaleId === 'seg-4tp'),
      'tutti con lo stesso stop e lo stesso segnale di origine');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la regola non è un caso solo: 1 take profit → 1 ordine, 3 take profit → 3 ordini', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const uno = await pagina.evaluate(SCENA, {fisso: FISSO, id: 'seg-1tp', tp: [3870]});
    assert.equal(uno.ordini, 1, '1 take profit = 1 ordine: ' + JSON.stringify(uno.dettaglio));
    const tre = await pagina.evaluate(SCENA, {fisso: FISSO, id: 'seg-3tp', tp: [3870, 3865, 3860]});
    assert.equal(tre.ordini, 3, '3 take profit = 3 ordini: ' + JSON.stringify(tre.dettaglio));
    assert.deepEqual(tre.dettaglio.map(d => d.tp), [3870, 3865, 3860]);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ===================== 3. NESSUNA RIPROVA DOPO UN ORDINE NON CONFERMATO =====================
// Regola del progetto (CONSEGNA 15 novembre, trappola 8): esito sconosciuto ≠ rifiuto, e non si
// ritenta MAI — si rilegge. Qui si misura che il ciclo si fermi alla prima che non va a buon
// fine, invece di insistere e ritrovarsi con metà piano aperto due volte.
// ATTO DI DIFETTOSITA' DELLA PROVA /// il primo lancio misurava `assert.equal(r.ordini, 1)`, cioè
// "la prima chiamata rifiutata deve impedire anche le altre tre di partire". SULLA STRADA SENZA
// GRAFICO non è quello che fa il codice: gli ordini partono in BATCH (Promise.all, riga ~43922
// "gli ordini vengono lanciati TUTTI INSIEME"), e il "mi fermo" sta nell'elaborazione dei
// risultati, non nel lancio. Cio' che misura davvero «non si ritenta» (regola del progetto:
// esito sconosciuto ≠ rifiuto) è che le chiamate RESTINO entro il piano — nessuna seconda
// tornata di ordini — e che nessuna posizione resti contata aperta. Misurato: 4 chiamate,
// 0 aperte. La differenza fra le due letture è reale e vale la pena conoscerla: con un rifiuto
// del primo ordine le altre tre chiamate sono già partite; l'app se ne accorge subito dopo e
// smette di aprirne.
test('un ordine rifiutato ferma il ciclo: non si ritenta', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(SCENA, {fisso: FISSO, id: 'seg-rifiuto', tp: [3870, 3865, 3860, 3855],
      rifiutaAl: 1});
    assert.ok(r.ordini <= 4, 'nessun ritentativo: non devono partire ordini in piu\' del piano, '
      + 'ne sono partiti ' + r.ordini + ': ' + JSON.stringify(r.dettaglio));
    assert.equal(r.aperte || 0, 0, 'e nessuna posizione deve restare contata come aperta: '
      + JSON.stringify(r.dettaglio));
  } finally { await browser.close(); }
});

test('un esito SCONOSCIUTO (ponte muto) non si ritenta: si rilegge, non si insiste', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(SCENA, {fisso: FISSO, id: 'seg-muto', tp: [3870, 3865, 3860, 3855],
      saltaAl: 1});
    assert.ok(r.ordini <= 4, 'con il ponte che non risponde il ciclo non deve insistere: ne sono '
      + 'partiti ' + r.ordini + ': ' + JSON.stringify(r.dettaglio));
    assert.equal(r.aperte || 0, 0, 'e nessuna posizione deve restare contata come aperta');
  } finally { await browser.close(); }
});

// ===================== 4. LO STESSO MESSAGGIO DUE VOLTE, STESSA FINESTRA =====================
// Deve restare 4: oggi lo chiude già il filtro anti-doppioni di CONTENUTO (fblDedupMotivo, ~5762:
// "lo stesso trade è già eseguito"). È una prova di non-regressione per la cura: la cura non
// deve indebolire questo filtro per chiudere il difetto delle finestre.
test('lo stesso messaggio arrivato due volte sulla stessa finestra non raddoppia', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const prima = await pagina.evaluate(SCENA, {fisso: FISSO, id: 'seg-2volte', tp: [3870, 3865, 3860, 3855]});
    assert.equal(prima.ordini, 4);
    const seconda = await pagina.evaluate(SCENA, {fisso: FISSO, id: 'seg-2volte', tp: [3870, 3865, 3860, 3855],
      pulisci: false});
    assert.equal(seconda.ordini, 0, 'la seconda consegna dello stesso messaggio non deve aprire niente: '
      + 'motivo=' + JSON.stringify(seconda.motivo));
    assert.equal(totale(prima, seconda), 4);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ===================== FINESTRE DUPLICATE =====================
// Madre (?pipSlot=0) + duplicate (?pipSlot=N), aperte come fa il pulsante «Duplica finestra».
// Il ponte manda lo STESSO messaggio a OGNI collegamento (segnali_bridge.py: a ogni WebSocket
// nuovo riconsegna la bacheca, `ultimo = {"id": 0}`): ogni finestra ha la sua copia.
async function apriFinestre(quante) {
  const {browser, pagina, errori} = await apriApp();
  const altre = [];
  for (let slot = 2; slot < quante + 2; slot++) {
    const p = await pagina.context().newPage();
    const e = ascoltaErrori(p);
    await p.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
    await p.goto('file://' + path.join(RADICE, 'app.html') + '?pipSlot=' + slot,
                 {waitUntil: 'domcontentloaded'});
    await p.waitForTimeout(2500);
    await p.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
      .forEach(el => el.style.display = 'none'));
    altre.push({pagina: p, errori: e});
  }
  return {browser, madre: pagina, altre, errori};
}

// ============ 5-6. LA REGOLA CON LE FINESTRE DUPLICATE (il numero del proprietario) ============
// Queste due prove misuravano il DIFETTO e lo tenevano verde (2 finestre → 8 ordini, 3 finestre
// → 12). Con la cura chiusa misuravano il rovescio esatto (2 finestre → 4, 3 finestre → 4), cioè
// la regola, e sono state riscritte per misurarla: un banco rosso non si lascia nel repo, e la
// regola non cambia. Resta la traccia del difetto nel commento in testa al file.
test('LA REGOLA CON UNA DUPLICATA (era 8): due finestre, 4 ordini in tutto', async () => {
  // «avevo 2 finestre duplicate e quindi ha aperto x3 volte» — la misura del numero: madre +
  // duplicata = 2 applicazioni. Dopo la cura ne resta una, e 4 ordini in tutto.
  const {browser, madre, altre} = await apriFinestre(1);
  try {
    const m = await madre.evaluate(SCENA, {fisso: FISSO, id: 'seg-2fin', tp: [3870, 3865, 3860, 3855]});
    const d = await altre[0].pagina.evaluate(SCENA, {fisso: FISSO, id: 'seg-2fin', tp: [3870, 3865, 3860, 3855]});
    assert.equal(m.ordini, 4, 'la madre applica il segnale: ' + m.ordini);
    assert.equal(d.ordini, 0, 'e la duplicata NON deve applicarlo per conto suo: ' + d.ordini);
    assert.equal(totale(m, d), 4, 'un segnale da 4 posizioni deve produrre 4 ordini in tutto, non ' + totale(m, d));
  } finally { await browser.close(); }
});

test('LA REGOLA CON DUE DUPLICATE (era 12, il numero del proprietario): tre finestre, 4 ordini', async () => {
  // Madre + 2 duplicate = 3 applicazioni × 4 take profit = 12. È il caso delle foto. Con la cura
  // applica solo la madre, e gli ordini restano 4.
  const {browser, madre, altre} = await apriFinestre(2);
  try {
    const m = await madre.evaluate(SCENA, {fisso: FISSO, id: 'seg-3fin', tp: [3870, 3865, 3860, 3855]});
    const d1 = await altre[0].pagina.evaluate(SCENA, {fisso: FISSO, id: 'seg-3fin', tp: [3870, 3865, 3860, 3855]});
    const d2 = await altre[1].pagina.evaluate(SCENA, {fisso: FISSO, id: 'seg-3fin', tp: [3870, 3865, 3860, 3855]});
    assert.equal(totale(m, d1, d2), 4, 'tre finestre, quattro ordini per un segnale da 4');
    assert.equal(m.ordini, 4, 'la madre apre i suoi: ' + m.ordini);
    assert.equal(d1.ordini, 0, 'la prima duplicata non apre niente: ' + d1.ordini);
    assert.equal(d2.ordini, 0, 'e nemmeno la seconda: ' + d2.ordini);
  } finally { await browser.close(); }
});

// ===================== 7. LA REGOLA, CON LE FINESTRE DUPLICATE =====================
test('LA REGOLA: con le finestre duplicate gli ordini restano 4, e si dice perche\'', async () => {
  // Questa è la prova della CURA. Il numero complessivo degli ordini di UN segnale deve essere il
  // numero dei suoi take profit, quali che siano le finestre aperte: l'applicazione passa da una
  // finestra sola (la madre, come già fa anotherWindowOwnsAssetEvaluation per SL/TP) e le
  // duplicate ereditano in silenzio — ma non all'oscuro, quindi il pannello dice il motivo.
  const {browser, madre, altre, errori} = await apriFinestre(1);
  try {
    const m = await madre.evaluate(SCENA, {fisso: FISSO, id: 'seg-regola', tp: [3870, 3865, 3860, 3855]});
    const d = await altre[0].pagina.evaluate(SCENA, {fisso: FISSO, id: 'seg-regola', tp: [3870, 3865, 3860, 3855]});
    const n = totale(m, d);
    assert.equal(n, 4, 'un segnale da 4 posizioni deve produrre 4 ordini in tutto, non ' + n);
    // La cura non deve spegnere nient'altro: la madre apre, la duplicata non raddoppia.
    assert.equal(m.ordini, 4, 'la madre deve aprire i suoi 4');
    assert.equal(d.ordini, 0, 'la duplicata non deve aprire niente per conto suo');
    // E chi guarda la duplicata deve poter LEGGERE il perche', non restare con un segnale che
    // non succede niente (regola: si eredita in silenzio, non in silenzio e all'oscuro). Due
    // motivi sono validi e misurati in questo banco: «apre la finestra principale» (la guardia
    // sulle finestre, quando la duplicata valuta prima che la madre abbia scritto) e «questo
    // segnale e' gia' stato applicato» (il ricordo su disco, quando valuta dopo). Qui vince il
    // secondo, perche' il test valuta la duplicata per ultima: la madre ha gia' aperto e ha
    // gia' scritto il marcatore.
    assert.match(String(d.motivo || ''), /(apre la finestra principale|gia' stato applicato)/,
      'la duplicata deve dire perche\' non apre: ' + JSON.stringify(d.motivo));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ===================== 8. RIPRISTINO DOPO RICARICA =====================
test('RICARICA: ricaricare non riapre il segnale', async () => {
  // Il ponte riconsegna la bacheca a ogni collegamento nuovo e l'app non conserva né «questo
  // messaggio l'ho già applicato» (tgUltimoId e tgSegnaliRicevuti non sono persistiti). Ricaricando
  // entro il minuto di validità del segnale, oggi riapre altri 4 ordini. La regola: 0 nuovi.
  const {browser, pagina} = await apriApp();
  try {
    const prima = await pagina.evaluate(SCENA, {fisso: FISSO, id: 'seg-ricarica', tp: [3870, 3865, 3860, 3855]});
    assert.equal(prima.ordini, 4, 'il segnale si applica una volta');
    await pagina.reload({waitUntil: 'domcontentloaded'});
    await pagina.waitForTimeout(3000);   // la pagina si ricollega da sé (fb_tg_attivo)
    await pagina.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
      .forEach(el => el.style.display = 'none'));
    // Stesso messaggio, stessa consegna: è ciò che il ponte fa a un collegamento nuovo.
    const dopo = await pagina.evaluate(SCENA, {fisso: FISSO, id: 'seg-ricarica', tp: [3870, 3865, 3860, 3855]});
    assert.equal(dopo.ordini, 0, 'dopo la ricarica non devono partire ordini nuovi, ne sono partiti '
      + dopo.ordini + ': motivo=' + JSON.stringify(dopo.motivo));
  } finally { await browser.close(); }
});