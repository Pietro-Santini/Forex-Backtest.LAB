// IN REPLAY LE POSIZIONI SEGUONO L'AVANZAMENTO, E SI RICORDA OGNI SPOSTAMENTO.
//
// RICHIESTO dal proprietario: «in modalità replay, quando avanza il grafico in maniera automatica
// col tasto play, le linee delle posizioni devono essere proprio sincronizzate alla velocità di
// aggiornamento selezionata; in più devono visualizzarsi tutte le linee di entry, TP e stop loss
// con i relativi valori di guadagno/perdita; e devono anche visualizzarsi quelli che sono stati
// gli spostamenti mano a mano: si deve ricordare OGNI movimento che è stato fatto».
//
// LE DUE CAUSE, distinte:
//
// 1) NON SEGUIVANO L'AVANZAMENTO. P/L, connettore e bordo delle caselle passavano tutti da
//    currentPrice(), che è rows[idx].close: la chiusura dell'ultima candela COMPIUTA. Dentro la
//    formazione quel numero non cambia mai, quindi facevano un salto secco una volta per candela
//    invece di muoversi al ritmo del moltiplicatore. Ora leggono prezzoMostratoOra(), che in
//    formazione è il prezzo svelato finora.
//
// 2) DEGLI SPOSTAMENTI NON RESTAVA TRACCIA. Una posizione portava solo i suoi livelli ATTUALI:
//    uno stop alzato tre volte lasciava il valore finale e basta. Rivedendo quel trade in replay
//    si vedeva quindi lo stop di oggi su candele di ieri. Ora ogni posizione tiene la propria
//    storia (storiaLivelli) e il disegno rilegge i livelli in forza all'istante mostrato.
//
// Come si prova che i test servono: rimettendo currentPrice() dentro posLivePL il terzo va rosso;
// togliendo posLivelliAlTempo dal disegno il quarto va rosso.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

// Una posizione aperta a metà serie, su un asset forex, con il grafico fermo a una candela dalla
// fine: così esiste la candela SUCCESSIVA, quella che il replay mette in formazione.
const PREPARA = () => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++) R.push({date: new Date(t0 + i * 60000).toISOString(),
    open: 100, high: 100.8, low: 99.2, close: 100.2, volume: 5});
  rows = R; baseRows = R; currentTF = 1;
  idx = R.length - 2; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD'; if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; liveReplayActive = false; mt5Connected = false;
  trades = []; drawings = []; replayForm = null;
  positions = [
    {id: 'P1', asset: 'EURUSD', side: 'BUY', entry: 100, sl: 99.5, rrSl: 99.5, tp: 100.6,
     lots: 0.1, marginUsed: 10, start: 150, startTime: t0 + 150 * 60000}
  ];
  active = null; posSelezionata = null; positionsVisible = true;
  followLatest = false; viewPriceLo = 98; viewPriceHi = 101.5; priceZoomFactor = 1;
  window.__t0 = t0;
  draw();
};

test('la memoria tiene UNA riga per ogni spostamento, e nessuna se non si muove niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PREPARA_SRC => {
      eval('(' + PREPARA_SRC + ')()');
      const p = positions[0];
      const righe = () => p.storiaLivelli.map(x => ({t: x.t, sl: x.sl, tp: x.tp}));
      // draw() ha già scritto la riga di apertura, datata all'APERTURA della posizione (non
      // all'istante in cui il codice l'ha vista la prima volta).
      const apertura = righe();
      // Lo stesso disegno, mille volte: non deve aggiungere niente.
      draw(); draw(); draw();
      const dopoTreDisegni = righe().length;
      // Tre spostamenti a tre istanti diversi (passati espressamente, così il test non dipende
      // dall'orologio): tre righe in più.
      const base = window.__t0 + 160 * 60000;
      posStoriaSegna(Object.assign(p, {sl: 99.7}), base);
      posStoriaSegna(Object.assign(p, {sl: 99.9}), base + 60000);
      posStoriaSegna(Object.assign(p, {sl: 100.0, tp: 101.0}), base + 120000);
      const finali = righe();
      // Stop e target mossi NELLO STESSO istante restano una riga sola.
      posStoriaSegna(Object.assign(p, {sl: 100.1}), base + 180000);
      const quante1 = righe().length;
      posStoriaSegna(Object.assign(p, {tp: 101.5}), base + 180000);
      const quante2 = righe().length;
      return {apertura, dopoTreDisegni, finali, quante1, quante2,
              aperturaAttesa: openReferenceTimeForPos(p)};
    }, PREPARA.toString());
    assert.equal(r.apertura.length, 1, 'alla prima occasione si scrive la riga di apertura');
    assert.equal(r.apertura[0].sl, 99.5);
    assert.equal(r.apertura[0].t, r.aperturaAttesa,
      'la prima riga è datata all apertura della posizione');
    assert.equal(r.dopoTreDisegni, 1, 'ridisegnare senza spostare niente non aggiunge righe');
    assert.deepEqual(r.finali.map(x => x.sl), [99.5, 99.7, 99.9, 100.0],
      'una riga per ogni spostamento, in ordine');
    assert.equal(r.finali[3].tp, 101.0, 'la riga porta anche il target di quel momento');
    assert.equal(r.quante2, r.quante1,
      'stop e target spostati nello stesso istante restano una riga sola');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i livelli in forza a un certo istante sono quelli di allora', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PREPARA_SRC => {
      eval('(' + PREPARA_SRC + ')()');
      const p = positions[0];
      const t0 = window.__t0;
      p.storiaLivelli = [
        {t: t0 + 150 * 60000, entry: 100, sl: 99.5, tp: 100.6},
        {t: t0 + 170 * 60000, entry: 100, sl: 99.9, tp: 100.6},
        {t: t0 + 190 * 60000, entry: 100, sl: 100.2, tp: 101.0}
      ];
      p.sl = 100.2; p.tp = 101.0;
      return {
        prima:  posLivelliAlTempo(p, t0 + 100 * 60000).sl,
        dopo1:  posLivelliAlTempo(p, t0 + 160 * 60000).sl,
        dopo2:  posLivelliAlTempo(p, t0 + 180 * 60000).sl,
        dopo3:  posLivelliAlTempo(p, t0 + 199 * 60000).sl,
        tpDopo2: posLivelliAlTempo(p, t0 + 180 * 60000).tp,
        senzaIstante: posLivelliAlTempo(p, null).sl,
        senzaStoria: posLivelliAlTempo({sl: 42, tp: 43}, t0).sl
      };
    }, PREPARA.toString());
    assert.equal(r.prima, 99.5, 'prima del primo movimento valgono i livelli di apertura');
    assert.equal(r.dopo1, 99.5, 'fra il primo e il secondo movimento vale il primo');
    assert.equal(r.dopo2, 99.9, 'dopo il secondo vale il secondo');
    assert.equal(r.dopo3, 100.2, 'dopo il terzo vale il terzo');
    assert.equal(r.tpDopo2, 100.6, 'il target segue la stessa riga dello stop');
    assert.equal(r.senzaIstante, 100.2, 'senza istante si risponde con i livelli di adesso');
    assert.equal(r.senzaStoria, 42, 'una posizione senza storia risponde con i livelli di adesso');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in replay il P/L e il bordo della casella seguono la candela in formazione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PREPARA_SRC => {
      eval('(' + PREPARA_SRC + ')()');
      const p = positions[0];
      // Formazione pilotata a mano: tre passi a prezzi noti, così i numeri sono verificabili.
      const metti = sub => { replayForm = {idx: idx + 1, sub, path: [100, 100.3, 100.6],
                                          fp: {step: 0, rows: {}}, vol: 0}; };
      const fuoriReplay = {pl: posLivePL(p), prezzo: prezzoMostratoOra(),
                           momento: replayMomentoMostrato(), frazione: replayFrazioneBarra()};
      metti(0); const a = {pl: posLivePL(p), prezzo: prezzoMostratoOra()};
      metti(1); const b = {pl: posLivePL(p), prezzo: prezzoMostratoOra()};
      metti(2); const c = {pl: posLivePL(p), prezzo: prezzoMostratoOra()};
      // La frazione di candela svelata: metà barra = metà passo del bordo della casella.
      const perBar = replaySecondsPerBar();
      metti(Math.round(perBar / 2)); const mezza = replayFrazioneBarra();
      metti(perBar); const piena = replayFrazioneBarra();
      // L'istante mostrato avanza di un secondo per ogni passo svelato.
      metti(10); const m10 = replayMomentoMostrato();
      metti(40); const m40 = replayMomentoMostrato();
      replayForm = null;
      return {fuoriReplay, a, b, c, mezza, piena, perBar, m10, m40,
              chiusuraUltima: Number(rows[idx].close)};
    }, PREPARA.toString());
    assert.equal(r.fuoriReplay.momento, null, 'fuori dal replay non si viaggia nel tempo');
    assert.equal(r.fuoriReplay.frazione, 0);
    assert.equal(r.fuoriReplay.prezzo, r.chiusuraUltima,
      'fuori dal replay il prezzo mostrato è la chiusura dell ultima candela');
    assert.equal(r.a.prezzo, 100, 'in formazione il prezzo è quello svelato finora');
    assert.equal(r.b.prezzo, 100.3);
    assert.equal(r.c.prezzo, 100.6);
    assert.ok(r.a.pl < r.b.pl && r.b.pl < r.c.pl,
      'il P/L avanza col prezzo in formazione, non a scatti di una candela: ' +
      JSON.stringify([r.a.pl, r.b.pl, r.c.pl]));
    assert.ok(Math.abs(r.mezza - 0.5) < 0.02, 'a metà barra la frazione è mezza: ' + r.mezza);
    assert.equal(r.piena, 1, 'a barra completa la frazione è piena');
    assert.equal(r.m40 - r.m10, 30000, 'l istante mostrato avanza di un secondo per passo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in replay a grafico si vedono i livelli DI ALLORA, non quelli di adesso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PREPARA_SRC => {
      eval('(' + PREPARA_SRC + ')()');
      const p = positions[0];
      const t0 = window.__t0;
      // Lo stop è stato alzato DOPO il momento che il replay sta per mostrare.
      const istanteMostrato = t0 + 199 * 60000;   // apertura della candela in formazione
      p.storiaLivelli = [
        {t: t0 + 150 * 60000, entry: 100, sl: 99.0, tp: 100.6},
        {t: istanteMostrato + 50000, entry: 100, sl: 99.9, tp: 100.6}
      ];
      p.sl = 99.9;
      // SI SPIA LA CASELLA TARGET/STOP, NON PIU' LA SCALA PREZZI. Fino al 21 ottobre 2026 qui si
      // spiava drawPriceAxisTag, cioè i cartellini sul bordo destro: erano il modo più diretto di
      // sapere a che prezzo il disegno aveva messo lo stop. Quei cartellini di target e stop sono
      // stati TOLTI su richiesta del proprietario (sul telefono coprivano i numeri della scala),
      // quindi quella spia adesso non vedrebbe più niente e il test sarebbe verde misurando il
      // vuoto. L'INTENTO NON CAMBIA: in replay si devono disegnare i livelli DI ALLORA. Si guarda
      // dove lo stop è ancora scritto, cioè la casella Target/Stop a grafico, che riceve gli
      // stessi livelli dalla stessa fonte (posLivelliAlTempo).
      const originale = drawTpSlZoneBox;
      const prezzi = [];
      drawTpSlZoneBox = function(ctx, o){ if (o) { prezzi.push(Number(o.sl)); prezzi.push(Number(o.tp)); }
                                          return originale.apply(this, arguments); };
      let inReplay = [], adesso = [];
      try{
        replayForm = {idx: idx + 1, sub: 10, path: [100, 100.1, 100.2],
                      fp: {step: 0, rows: {}}, vol: 0};
        prezzi.length = 0; draw(); inReplay = prezzi.slice();
        replayForm = null;
        prezzi.length = 0; draw(); adesso = prezzi.slice();
      } finally { drawTpSlZoneBox = originale; }
      return {inReplay, adesso};
    }, PREPARA.toString());
    assert.ok(r.inReplay.includes(99),
      'in replay lo stop disegnato è quello di allora (99): ' + JSON.stringify(r.inReplay));
    assert.ok(!r.inReplay.includes(99.9),
      'e NON quello di adesso (99.9): ' + JSON.stringify(r.inReplay));
    assert.ok(r.adesso.includes(99.9),
      'fuori dal replay si torna a disegnare lo stop di adesso: ' + JSON.stringify(r.adesso));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la memoria si aggiorna nel punto che tutte le strade attraversano', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  // Si registra dentro draw(), non nelle dieci strade che spostano uno stop: è la stessa lezione
  // già pagata tre volte in questo file (il ramo touch, l'avvio del polling delle notizie, lo
  // stile del footprint) — agganciarsi a UNA strada vuol dire dimenticarsi delle altre.
  assert.match(src, /function draw\(\)\{\r?\n fblScadeDecimali\(\);[\s\S]{0,400}?posStoriaAggiornaTutte\(\)/,
    'posStoriaAggiornaTutte deve essere chiamata in testa a draw()');
  // Il bordo destro della casella avanza con la frazione di candela svelata, non a scatti.
  assert.match(src, /keepPaceIdx:idx\+replayFrazioneBarra\(\)/,
    'la casella Target/Stop deve tenere il passo della formazione');
  // Il P/L non deve più passare da currentPrice().
  assert.match(src, /function posLivePL\(pos\)\{[\s\S]{0,900}?const price=prezzoMostratoOra\(\);/,
    'posLivePL deve leggere il prezzo mostrato, non la chiusura dell ultima candela');
  // E in replay non si usa il netto del terminale MT5 (è il profitto di ADESSO).
  assert.match(src, /const rivedendo=replayMomentoMostrato\(\)!=null;/,
    'in replay il netto reale MT5 va escluso');
});
