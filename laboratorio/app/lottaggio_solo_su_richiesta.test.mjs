// POSIZIONARE LO STOP NON SCRIVE IL LOTTAGGIO. IL LOTTAGGIO SI SCRIVE SOLO SE LO CHIEDI.
//
// RICHIESTA del proprietario, parola per parola: «all'interno del grafico il lottaggio viene
// esclusivamente modificato solo se l'utente preme direttamente dentro la casella e inserisce lui un
// valore, oppure solo quando ha scritto quello che è il rischio in percentuale e poi clicca il
// bottone lottaggio. [...] E non deve scrivere direttamente quello che è il lottaggio in maniera
// automatica quando io vado a posizionare quello che è lo stop loss prima di aprire un'operazione.
// No. Prima posiziono lo stop loss, poi scrivo il rischio, pigio il pulsante e allora a quel punto
// mi farà vedere il lottaggio consigliato».
//
// IL DIFETTO, misurato: esisteva una funzione, autoLottoDaGrafico(), chiamata dai tre punti in cui
// si posiziona un livello PRIMA di aprire un ordine (lo stop a mercato, lo stop/target dell'ordine
// pendente, l'entrata del pendente). Quella funzione scriveva il numero dentro il campo Lottaggio.
// Il risultato a schermo era un lottaggio "già pronto" che l'utente non aveva mai scelto e che
// finiva nell'ordine al primo click: il rischio reale non era quello scritto nella casella RISCHIO,
// era quello di un numero apparso da solo. Il numero spariva appena si toccava qualcos'altro, quindi
// non era nemmeno un valore stabile da cui ragionare.
//
// LA REGOLA, adesso: il campo Lottaggio si scrive in due modi e in due soli, entrambi con un dito
// dell'utente sopra.
//   1) l'utente scrive un numero nella casella (o preme i pulsanti ﹀ / ︿ / ﹂ / ﹁);
//   2) l'utente preme il pulsante del lottaggio consigliato, che calcola da stop loss + rischio %.
// Posizionare lo stop può mostrare un CONSIGLIO, ma non può scrivere il campo. È la differenza
// fra "quello che ti consiglio" e "quello che stai per mandare": il primo si può ignorare, il
// secondo no.
//
// I test qui sotto non guardano il sorgente: mettono l'app nelle condizioni descritte e guardano il
// campo che l'ordine legge davvero. Se un domani il numero ricomincia a scriversi da solo, il primo
// test si accorge.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Prepara il caso di tutti i test: un grafico con delle candele vere (senza prezzo non c'e'
// nessun calcolo), nessuna posizione aperta — siamo "prima di aprire" —, un saldo noto, un
// lottaggio iniziale che NON coincide per caso col consigliato, e un rischio noto.
// Va come CODICE (stringa), non come funzione: questa gira dentro la pagina, e una funzione
// definita nel processo di Node non esiste li' dentro.
const PREPARA = `function PREPARA(){
  // 150 candele EUR/USD a 1.1000: senza un prezzo vero computeSuggestedLots() restituisce
  // null e il test passerebbe (o fallirebbe) per il motivo sbagliato.
  var t0 = Date.now() - 150*60000, pz = 1.1000, R = [];
  for (var i=0;i<150;i++){ var o=pz, c=pz+Math.sin(i/7)*0.0010;
    R.push({date:new Date(t0+i*60000).toISOString(), open:o, high:Math.max(o,c)+0.0005,
            low:Math.min(o,c)-0.0005, close:c, volume:10}); pz=c; }
  R[R.length-1].close = 1.1000;
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; currentAssetKey='EURUSD';
  csvLibrary=[{rows:R}];
  positions = [];
  active = null;
  ['sl','tp','pendingEntry','slPending','tpPending'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var cap = document.getElementById('capital');
  if (cap) { cap.value = '10000'; cap.dispatchEvent(new Event('input', {bubbles:true})); }
  var rischio = document.getElementById('risk');
  if (rischio) { rischio.value = '1'; rischio.dispatchEvent(new Event('input', {bubbles:true})); }
  quickPendingConfirmActive = false;
  var lotti = document.getElementById('lots');
  if (lotti) { lotti.value = '0.07'; lotti.dispatchEvent(new Event('change', {bubbles:true})); }
  return {entry: currentPrice(), lottoIniziale: document.getElementById('lots').value};
}`;

test('posizionare lo STOP sul grafico NON scrive il lottaggio (è il difetto segnalato)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      ${PREPARA}
      var prima = PREPARA();
      // Stop a 2% sotto il prezzo: abbastanza largo da dare un consiglio ben diverso da 0,07.
      setTradeLevel('SL', prima.entry * 0.98);   // esattamente quello che fa il click sul grafico
      var s = computeSuggestedLots();
      return {
        lottoPrima: prima.lottoIniziale,
        lottoDopo: document.getElementById('lots').value,
        slMesso: Number(document.getElementById('sl').value),
        consigliato: s ? s.lots : null
      };
    })()`);
    // Lo stop è stato messo: questo funziona e deve continuare a funzionare.
    assert.ok(Number.isFinite(r.slMesso), 'lo stop deve essere stato posizionato');
    // Il consiglio esiste (è quello che l'utente può chiedere di applicare).
    assert.ok(r.consigliato != null && r.consigliato !== Number(r.lottoPrima),
      'il calcolo del consigliato deve funzionare e dare un numero diverso da quello già scritto');
    // E IL PUNTO: il campo non si è mosso.
    assert.equal(r.lottoDopo, r.lottoPrima,
      'posizionare lo stop ha scritto il lottaggio da solo: era ' + r.lottoDopo +
      ' invece di ' + r.lottoPrima + ' (il consigliato era ' + r.consigliato + ')');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('lo stesso vale per il TARGET e per lo stop dell’ordine pendente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      ${PREPARA}
      var prima = PREPARA();
      setTradeLevel('TP', currentPrice() * 1.04);
      var dopoTarget = document.getElementById('lots').value;
      var lp = document.getElementById('lotsPending');
      lp.value = '0.07'; lp.dispatchEvent(new Event('change', {bubbles:true}));
      var lottoPendentePrima = lp.value;
      setTradeLevel('SL_PENDING', currentPrice() * 0.97);
      setTradeLevel('ENTRY_PENDING', currentPrice());
      return {lottoPrima: prima.lottoIniziale, dopoTarget: dopoTarget,
              lottoPendentePrima: lottoPendentePrima,
              lottoPendenteDopo: lp.value};
    })()`);
    assert.equal(r.dopoTarget, r.lottoPrima, 'il target non deve scrivere il lottaggio');
    assert.equal(r.lottoPendenteDopo, r.lottoPendentePrima,
      "lo stop/entrata dell'ordine pendente non deve scrivere il suo lottaggio");
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il pulsante del lottaggio consigliato continua ad applicare: è la strada voluta', async () => {
  // Se questo test diventasse verde per il motivo sbagliato (nessuno scrive più nulla anywhere)
  // il sistema sarebbe muto. Il pulsante deve scrivere il numero che il calcolo ha prodotto.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      ${PREPARA}
      PREPARA();
      setTradeLevel('SL', currentPrice() * 0.98);
      var atteso = computeSuggestedLots().lots;
      document.getElementById('applySuggestedLot').click();
      return {atteso: atteso, scritto: document.getElementById('lots').value};
    })()`);
    assert.equal(r.atteso != null, true, 'il calcolo deve dare un numero');
    assert.equal(Number(r.scritto), r.atteso,
      'il pulsante deve applicare esattamente il consigliato (' + r.atteso + '), non un altro');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('quello che scrive l’utente nella casella resta intatto', async () => {
  // La regola è "il lottaggio lo decidi tu": neppure il passaggio dal grafico deve
  // sovrascrivere un numero scritto a mano.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      ${PREPARA}
      PREPARA();
      setTradeLevel('SL', currentPrice() * 0.98);
      var el = document.getElementById('lots');
      el.value = '0.33';
      el.dispatchEvent(new Event('input', {bubbles:true}));
      el.dispatchEvent(new Event('change', {bubbles:true}));
      return {scritto: el.value};
    })()`);
    assert.equal(Number(r.scritto), 0.33, 'il valore scritto a mano deve restare');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('spostando lo stop DOPO aver aperto la posizione il lottaggio resta com’era', async () => {
  // Il caso della posizione già aperta non passa da autoLottoDaGrafico, ma è quello che il
  // proprietario tocca di più spesso: anche lì lo stop non deve scrivere il campo del prossimo
  // ordine (il lottaggio di una posizione aperta è comunque quello con cui è stata aperta).
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      ${PREPARA}
      PREPARA();
      var entry = currentPrice();
      positions = [{id:'p1', side:'BUY', entry:entry, sl:entry*0.98, tp:null,
                    lots:0.07, asset:currentAssetKey}];
      active = positions[0];
      var el = document.getElementById('lots');
      el.value = '0.07'; el.dispatchEvent(new Event('change', {bubbles:true}));
      setTradeLevel('SL', entry * 0.96);
      return {lotti: el.value, slPosizione: active.sl, entry: entry};
    })()`);
    assert.equal(Number(r.lotti), 0.07, 'spostare lo stop di una posizione aperta non scrive il campo');
    assert.ok(Math.abs(r.slPosizione - r.entry * 0.96) < 1e-9, 'lo stop della posizione deve esserci');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
