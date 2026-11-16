// VOCE 6: PREMENDO REPLAY CON DUPLICATE APERTE, SI CHIEDE SE FARLO ANCHE LA'.
//
// RICHIESTO dal proprietario: «premendo Replay con duplicate aperte, il programma chiede se
// applicare il replay anche alle altre duplicate. Se confermato, le duplicate entrano in replay e
// le posizioni replay si trasportano sulle altre.»
//
// COSA C'ERA PRIMA: niente. Sul canale fra finestre esistevano `chart_time_sync` e
// `random_jump_sync` - cioe' la POSIZIONE nel tempo - e nessun messaggio che dicesse «sono
// entrato in replay». Premere Replay su una finestra lasciava le altre in diretta. C'erano anche
// `remoteSyncConsent` e enqueueRemoteSyncConfirm(), ma chiedono nel verso OPPOSTO (e' la finestra
// che RICEVE a chiedere «applica o ignora») e partivano da consenso gia' dato, quindi non
// chiedevano niente a nessuno.
//
// LE SCELTE FATTE, e il perche':
// - la domanda si fa UNA VOLTA, premendo "Replay", come descritto dal proprietario, e NON a ogni
//   spostamento del punto dentro un replay gia' avviato: la' il pulsante serve a spostarsi;
// - la domanda non si fa se non c'e' nessun altro: una finestra sola non ha nulla da sincronizzare;
// - per sapere se ci sono altre finestre si CHIEDE e si aspetta 300 ms, invece di tenere un
//   elenco: una finestra chiusa non risponde, mentre in un elenco resterebbe per sempre
//   (`siblingAssetBySlot` non si svuota mai);
// - la scelta vale anche per lo STOP: se hai detto "su tutte", fermarne una ferma tutte.
//   Altrimenti servirebbe fermarle a mano una per una, che e' peggio del problema di partenza.
//   DAL 16 NOVEMBRE «fermare» ha un significato nuovo, deciso dal proprietario: «STOP pausa dove
//   è, PLAY riparte dallo stesso secondo». Col replay condiviso il primo STOP ARMA la pausa su
//   tutte le finestre allo stesso istante; e' il SECONDO STOP (a orologio fermo) a uscire dal
//   replay, e a quel punto escono tutte. Quindi la prova qui sotto guarda il primo STOP (pausa
//   propagata, stesso istante su tutte) e poi il secondo (uscita propagata): e' lo stesso intento
//   del 15 novembre, con la regola di oggi.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

function ascoltaErrori(pagina) {
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0, 300)));
  return errori;
}

// Venti candele da un minuto, finestra in Live: lo stato da cui si entra in replay.
const IN_LIVE = `(function(){
  const base = Date.parse('2026-11-10T10:00:00Z');
  const R = [];
  for (let i = 0; i < 20; i++) R.push({date: new Date(base + i*60000).toISOString().slice(0,16).replace('T',' '),
    open: 1.0800, high: 1.0806, low: 1.0795, close: 1.0802, volume: 100});
  rows = R; baseRows = R.slice();
  rowsAssetKey = currentAssetKey = 'EURUSD';
  currentTF = 1; idx = 19; viewEnd = 19;
  liveModeActive = true; liveReplayActive = false; mt5Connected = false;
  positions.length = 0; pendingOrders.length = 0; trades.length = 0;
  masterTime = closeTimeOf(baseRows[baseRows.length-1]);
  return {live: liveModeActive, candele: rows.length};
})()`;

// Sostituisce la finestra di conferma con una risposta decisa dal banco, e la CONTA.
const RISPOSTA = (si) => `(function(){
  window.__chieste = [];
  appConfirm = function(testo, opz){
    window.__chieste.push({testo: String(testo), titolo: (opz&&opz.title)||''});
    return Promise.resolve(${si ? 'true' : 'false'});
  };
})()`;

const STATO = `(function(){ return {slot: PIP_SLOT, inReplay: !!liveReplayActive,
  masterTime: masterTime, perTutte: !!fblReplayPerTutte}; })()`;

async function dueFinestreInLive() {
  const {browser, pagina} = await apriApp();
  const errori = ascoltaErrori(pagina);
  const p2 = await pagina.context().newPage();
  const errori2 = ascoltaErrori(p2);
  await p2.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await p2.goto('file://' + path.join(RADICE, 'app.html') + '?pipSlot=2',
                {waitUntil: 'domcontentloaded'});
  await p2.waitForTimeout(2500);
  await p2.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
    .forEach(el => el.style.display = 'none'));
  await pagina.evaluate(IN_LIVE);
  await p2.evaluate(IN_LIVE);
  return {browser, madre: pagina, dup: p2, errori, errori2};
}

test('PROVA DI CONTROLLO: con una finestra sola non si chiede niente', async () => {
  // Senza questa, un "non ha chiesto" non direbbe se la regola funziona o se la domanda e' rotta.
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(IN_LIVE);
    await pagina.evaluate(RISPOSTA(true));
    const r = await pagina.evaluate(`(async function(){
      await fblChiediAmbitoReplay();
      return {chieste: window.__chieste.length, perTutte: !!fblReplayPerTutte};
    })()`);
    console.log('una finestra sola:', JSON.stringify(r));
    assert.equal(r.chieste, 0,
      'con una finestra sola non c e niente da sincronizzare: non si deve chiedere nulla');
    assert.equal(r.perTutte, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con una duplicata aperta, la domanda si fa', async () => {
  const {browser, madre, errori, errori2} = await dueFinestreInLive();
  try {
    await madre.evaluate(RISPOSTA(true));
    const r = await madre.evaluate(`(async function(){
      const altre = await fblChiediPresenzaFinestre();
      await fblChiediAmbitoReplay();
      return {altre: altre, chieste: window.__chieste, perTutte: !!fblReplayPerTutte};
    })()`);
    console.log('presenza e domanda:', JSON.stringify(r));
    assert.deepEqual(r.altre, [2],
      'la finestra duplicata deve farsi sentire: ' + JSON.stringify(r));
    assert.equal(r.chieste.length, 1, 'la domanda si fa una volta sola');
    assert.ok(/finestra aperta|finestre aperte/.test(r.chieste[0].testo),
      'la domanda deve dire quante altre finestre ci sono: ' + JSON.stringify(r.chieste));
    assert.equal(r.perTutte, true, 'rispondendo si, la scelta e "su tutte"');
    assert.deepEqual(errori, []);
    assert.deepEqual(errori2, []);
  } finally { await browser.close(); }
});

test('SCEGLIENDO «su tutte», la duplicata entra in replay dallo stesso punto', async () => {
  const {browser, madre, dup, errori, errori2} = await dueFinestreInLive();
  try {
    await madre.evaluate(RISPOSTA(true));
    const quando = await madre.evaluate(`(async function(){
      await fblChiediAmbitoReplay();
      const t = closeTimeOf(baseRows[10]);
      avviaReplayLive(t);
      return t;
    })()`);
    await dup.waitForTimeout(1200);
    const laMadre = await madre.evaluate(STATO);
    const laDup = await dup.evaluate(STATO);
    console.log('madre:', JSON.stringify(laMadre), '| duplicata:', JSON.stringify(laDup));
    assert.equal(laMadre.inReplay, true, 'la madre deve essere in replay');
    assert.equal(laDup.inReplay, true,
      'e la duplicata anche, perche la scelta era «su tutte»: ' + JSON.stringify(laDup));
    assert.equal(laDup.masterTime, quando,
      'dallo STESSO punto nel tempo: ' + JSON.stringify({quando, dup: laDup.masterTime}));
    assert.deepEqual(errori, []);
    assert.deepEqual(errori2, []);
  } finally { await browser.close(); }
});

test('SCEGLIENDO «solo questa», la duplicata resta in diretta', async () => {
  const {browser, madre, dup, errori2} = await dueFinestreInLive();
  try {
    await madre.evaluate(RISPOSTA(false));
    await madre.evaluate(`(async function(){
      await fblChiediAmbitoReplay();
      avviaReplayLive(closeTimeOf(baseRows[10]));
    })()`);
    await dup.waitForTimeout(1200);
    const laMadre = await madre.evaluate(STATO);
    const laDup = await dup.evaluate(STATO);
    console.log('solo questa -> madre:', JSON.stringify(laMadre), '| duplicata:', JSON.stringify(laDup));
    assert.equal(laMadre.inReplay, true, 'la madre entra comunque in replay');
    assert.equal(laDup.inReplay, false,
      'la duplicata NON deve entrare: e stato detto «solo questa». ' + JSON.stringify(laDup));
    assert.deepEqual(errori2, []);
  } finally { await browser.close(); }
});

test('lo STOP segue la stessa scelta: se era su tutte, lo ferma su tutte (prima pausa, poi uscita)', async () => {
  const {browser, madre, dup} = await dueFinestreInLive();
  try {
    await madre.evaluate(RISPOSTA(true));
    await madre.evaluate(`(async function(){
      await fblChiediAmbitoReplay();
      avviaReplayLive(closeTimeOf(baseRows[10]));
    })()`);
    await dup.waitForTimeout(1200);
    const primaDup = await dup.evaluate(STATO);
    assert.equal(primaDup.inReplay, true, 'la duplicata deve essere entrata prima dello STOP');
    // PRIMO STOP = PAUSA ARMATA (regola del 16 novembre), propagata a tutte.
    await madre.evaluate(`(function(){ esciReplayLive(); })()`);
    await dup.waitForTimeout(1200);
    const pausaMadre = await madre.evaluate(STATO);
    const pausaDup = await dup.evaluate(STATO);
    console.log('dopo il PRIMO STOP -> madre:', JSON.stringify(pausaMadre), '| duplicata:', JSON.stringify(pausaDup));
    assert.equal(pausaMadre.inReplay, true, 'il primo STOP mette in pausa, non esce: ' + JSON.stringify(pausaMadre));
    assert.equal(pausaDup.inReplay, true,
      'e la duplicata resta in replay anche lei, ferma sullo stesso istante: ' + JSON.stringify(pausaDup));
    assert.equal(pausaDup.masterTime, pausaMadre.masterTime,
      'la pausa ferma tutte allo STESSO istante, non a uno ciascuno');
    // SECONDO STOP, a orologio fermo = USCITA, e con lui escono tutte.
    await madre.evaluate(`(function(){ esciReplayLive(); })()`);
    await dup.waitForTimeout(1200);
    const dopoMadre = await madre.evaluate(STATO);
    const dopoDup = await dup.evaluate(STATO);
    console.log('dopo lo STOP due volte -> madre:', JSON.stringify(dopoMadre), '| duplicata:', JSON.stringify(dopoDup));
    assert.equal(dopoMadre.inReplay, false, 'la madre esce dal replay');
    assert.equal(dopoDup.inReplay, false,
      'e la duplicata anche, altrimenti bisognerebbe fermarle a mano una per una: '
      + JSON.stringify(dopoDup));
    assert.equal(dopoDup.perTutte, false,
      'e la scelta non si eredita oltre la fine del replay condiviso: un replay avviato qui '
      + 'per una strada che non passa dalla domanda non deve partire su tutte. '
      + JSON.stringify(dopoDup));
  } finally { await browser.close(); }
});

test('chi APPLICA un replay ricevuto non lo ri-annuncia', async () => {
  // La stessa regola della cura del conto del 15 novembre: applicare non e' annunciare. Senza la
  // barriera, due finestre si rimanderebbero l annuncio a vicenda.
  const {browser, madre, dup} = await dueFinestreInLive();
  try {
    await dup.evaluate(`(function(){
      window.__spediti = 0;
      const ch = tradingChannel, posta = ch.postMessage.bind(ch);
      ch.postMessage = function(m){
        if(m && m.type === 'replay_sync') window.__spediti++;
        return posta(m);
      };
    })()`);
    await madre.evaluate(RISPOSTA(true));
    await madre.evaluate(`(async function(){
      await fblChiediAmbitoReplay();
      avviaReplayLive(closeTimeOf(baseRows[10]));
    })()`);
    await dup.waitForTimeout(1500);
    const r = await dup.evaluate(() => ({spediti: window.__spediti || 0,
      inReplay: !!liveReplayActive}));
    console.log('eco dalla duplicata:', JSON.stringify(r));
    assert.equal(r.inReplay, true, 'la duplicata deve essere entrata in replay');
    assert.equal(r.spediti, 0,
      'ma non deve aver rimandato in giro l annuncio: ne ha spediti ' + r.spediti);
  } finally { await browser.close(); }
});

test('le posizioni aperte nel replay si vedono sull altra finestra', async () => {
  // Il secondo pezzo della richiesta: «le posizioni replay si trasportano sulle altre». Non
  // serviva niente di nuovo - le posizioni simulate viaggiano gia' nel messaggio trading_sync -
  // ma va PROVATO, altrimenti e' solo una supposizione.
  const {browser, madre, dup} = await dueFinestreInLive();
  try {
    await madre.evaluate(RISPOSTA(true));
    await madre.evaluate(`(async function(){
      await fblChiediAmbitoReplay();
      avviaReplayLive(closeTimeOf(baseRows[10]));
    })()`);
    await dup.waitForTimeout(1200);
    await madre.evaluate(`(function(){
      positions.push({id:'r1', asset:'EURUSD', side:'BUY', entry:1.0801, lots:0.01,
                      sl:1.0795, tp:1.0810, historical:true, start:idx,
                      startTime: parseDateTime(rows[idx].date)});
      broadcastTradingStateNow(true);
    })()`);
    await dup.waitForTimeout(1500);
    const r = await dup.evaluate(() => ({quante: positions.length,
      id: positions.map(p => p.id), inReplay: !!liveReplayActive}));
    console.log('posizioni sulla duplicata:', JSON.stringify(r));
    assert.equal(r.inReplay, true, 'la duplicata e in replay');
    assert.ok(r.id.includes('r1'),
      'la posizione aperta nel replay sulla madre deve comparire anche qui: '
      + JSON.stringify(r));
  } finally { await browser.close(); }
});
