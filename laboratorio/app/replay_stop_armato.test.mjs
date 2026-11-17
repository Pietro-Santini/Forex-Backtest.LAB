// AGGIORNATO IL 17-18 NOVEMBRE 2026, su richiesta del proprietario: CAMBIA IL PULSANTE, NON LA
// REGOLA. La pausa resta quella chiesta il 15-16 novembre - tutte le finestre ferme sullo stesso
// istante, senza salto all'ultima candela, e il PLAY che riprende dallo stesso secondo - ma ora la
// fa il pulsante PLAY, che diventa «STOP» mentre il replay scorre. Il pulsante rosso si chiama
// ESCI e fa una cosa sola: esce, e riporta all'ultima candela vera. Sue parole: «non deve uscire
// il tasto stop, ma deve venire fuori quello che e' il tasto esci. Il tasto stop stara' soltanto
// quando premiamo quello che e' il tasto play e poi dopo si trasforma in tasto stop».
// Quindi qui la pausa si preme con $('play') e l'uscita con $('liveReplayStopBtn'), UNA volta.
// REPLAY CONDIVISO: LO STOP PAUSA SUL PUNTO, IL PLAY RIPRENDE DALLO STESSO SECONDO.
//
// RICHIESTO DAL PROPRIETARIO (16 novembre 2026), per estendere a tutti i casi la regola che il
// 15 novembre era stata data solo per l'istante: «STOP pausa dove è, PLAY riparte dallo stesso
// secondo». Oggi lo STOP, col replay condiviso («su tutte le finestre»), ESCIrebbe dal replay:
// la finestra tornava in diretta e il grafico restava dov'era, ma senza più i comandi del replay.
// Con una finestra sola invece lo STOP continua a fare quello che ha sempre fatto: tornare
// all'ultima candela VERA (è la prova n. 2 di replay_live.test.mjs, che qui non deve cadere).
//
// COSA SI MISURA:
//  1. PROVA DI CONTROLLO — da soli (nessuna duplicata, scelta «solo questa» implicita) lo STOP
//     ESCI dal replay e riporta all'ultima candela vera, come prima;
//  2. col replay condiviso e l'orologio in corso, lo STOP tiene tutte le finestre IN REPLAY,
//     ferme sullo STESSO istante (nessun salto all'ultima candela, formazione conservata);
//  3. il PLAY riparte da QUEL istante su tutte le finestre (uguali all'inizio, poi avanzano);
//  4. la strada esplicita per uscire resta: STOP con tutto già fermo esce dal replay.
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

// Lo stato che interessa: in replay o no, che istante si vede, se l'orologio gira.
const STATO = `(function(){ return {slot: PIP_SLOT, inReplay: !!liveReplayActive,
  perTutte: !!fblReplayPerTutte, timer: !!timer,
  momento: replayMomentoMostrato(),
  ultimaVera: masterTime === closeTimeOf(baseRows[baseRows.length-1]),
  play: ($('play')&&$('play').textContent)||'', formazioni: !!replayForm}; })()`;

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

test('PROVA DI CONTROLLO: da soli, lo STOP esce dal replay come prima', async () => {
  // Senza questa, un "esce" o "resta" non direbbe se la regola del condiviso funziona oppure se
  // e' lo STOP in generale ad aver cambiato padrone.
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(IN_LIVE);
    const r = await pagina.evaluate(`(async function(){
      await fblChiediAmbitoReplay();               // da solo: non chiede niente, scelta vuota
      const scelta = closeTimeOf(baseRows[10]);
      avviaReplayLive(scelta);
      const prima = {inReplay: !!liveReplayActive, momento: replayMomentoMostrato()};
      esciReplayLive();                             // lo STOP di sempre
      return {prima, scelta,
        dopo: {inReplay: !!liveReplayActive, momento: replayMomentoMostrato(),
                ultimaVera: masterTime === closeTimeOf(baseRows[baseRows.length-1]),
                idx: idx}};
    })()`);
    console.log('da soli:', JSON.stringify(r));
    assert.equal(r.prima.inReplay, true, 'il replay deve essere partito');
    assert.equal(r.dopo.inReplay, false,
      'da soli lo STOP deve USCIRE dal replay, come ha sempre fatto: ' + JSON.stringify(r.dopo));
    assert.equal(r.dopo.ultimaVera, true,
      'e riportare all\'ultima candela vera, non lasciare il grafico a metà storico: ' + JSON.stringify(r.dopo));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('col replay condiviso il PLAY mette in pausa sul punto: tutte le finestre restano in replay, stesso istante', async () => {
  const {browser, madre, dup, errori, errori2} = await dueFinestreInLive();
  try {
    await madre.evaluate(RISPOSTA(true));
    await madre.evaluate(`(async function(){
      await fblChiediAmbitoReplay();
      avviaReplayLive(closeTimeOf(baseRows[10]));
    })()`);
    await dup.waitForTimeout(1200);
    // L'orologio in corso: e' la situazione descritta dal proprietario (stava scorrendo).
    await madre.evaluate(() => { if ($('play')) $('play').click(); });
    await madre.waitForTimeout(600);
    const inCorso = await madre.evaluate(STATO);
    assert.equal(inCorso.timer, true, 'il PLAY deve aver avviato l\'orologio: ' + JSON.stringify(inCorso));
    const istanteStop = inCorso.momento;

    // LA PAUSA: si preme il pulsante PLAY, che a orologio in corso mostra «⏹ STOP». Premuto
    // col pulsante vero, non chiamando la funzione.
    await madre.evaluate(() => { if ($('play')) $('play').click(); });
    await dup.waitForTimeout(900);
    const dMadre = await madre.evaluate(STATO);
    const dDup = await dup.evaluate(STATO);
    console.log('dopo lo STOP -> madre:', JSON.stringify(dMadre), '| duplicata:', JSON.stringify(dDup));

    assert.equal(dMadre.inReplay, true,
      'la pausa NON deve far uscire dal replay: ' + JSON.stringify(dMadre));
    assert.equal(dDup.inReplay, true,
      'la duplicata deve restare in replay anche lei: ' + JSON.stringify(dDup));
    assert.equal(dMadre.timer, false, 'l\'orologio deve essere fermo: ' + JSON.stringify(dMadre));
    assert.equal(dDup.timer, false, 'anche quello della duplicata: ' + JSON.stringify(dDup));
    assert.equal(dDup.momento, dMadre.momento,
      'tutte le finestre devono essere ferme sullo STESSO istante: ' + JSON.stringify({m: dMadre.momento, d: dDup.momento}));
    assert.equal(dMadre.momento, istanteStop,
      'e l\'istante dev\'essere quello in cui si è premuto STOP, non un altro: '
      + JSON.stringify({stop: istanteStop, dopo: dMadre.momento}));
    assert.equal(dMadre.ultimaVera, false,
      'non si deve saltare all\'ultima candela vera: ' + JSON.stringify(dMadre));

    // PLAY: riparte da QUEL istante, su tutte. La lettura è IMMEDIATA (senza attesa): misura
    // la ripresa, non l'avanzata. Un tick di grafico al massimo può aggiungere un secondo.
    await madre.evaluate(() => { if ($('play')) $('play').click(); });
    const iMadre = await madre.evaluate(STATO);
    const iDup = await dup.evaluate(STATO);
    console.log('subito dopo il PLAY -> madre:', JSON.stringify(iMadre), '| duplicata:', JSON.stringify(iDup));
    assert.ok(iMadre.momento >= dMadre.momento && iMadre.momento <= dMadre.momento + 1000,
      'il PLAY deve ripartire ESATTAMENTE dall\'istante in cui si era fermato: '
      + JSON.stringify({prima: dMadre.momento, ora: iMadre.momento}));
    assert.equal(iDup.momento, dMadre.momento,
      'la duplicata riparte dallo stesso istante della madre: '
      + JSON.stringify({madre: iMadre.momento, dup: iDup.momento}));
    assert.equal(iMadre.inReplay, true, 'il replay continua: ' + JSON.stringify(iMadre));
    assert.equal(iDup.inReplay, true, 'anche sulla duplicata: ' + JSON.stringify(iDup));
    // ...e dopo un secondo di attesa l'orologio deve essere avanzato, su tutte.
    await madre.waitForTimeout(1400);
    const rMadre = await madre.evaluate(STATO);
    const rDup = await dup.evaluate(STATO);
    console.log('dopo un secondo di PLAY -> madre:', JSON.stringify(rMadre), '| duplicata:', JSON.stringify(rDup));
    assert.ok(rMadre.momento > istanteStop,
      'l\'orologio deve essere avanzato: ' + JSON.stringify({stop: istanteStop, dopo: rMadre.momento}));
    assert.equal(rMadre.inReplay, true, 'il replay continua: ' + JSON.stringify(rMadre));
    assert.equal(rDup.inReplay, true, 'anche sulla duplicata: ' + JSON.stringify(rDup));

    // L'USCITA: UN solo colpo sul pulsante ESCI (prima ne servivano due, perche' il primo
    // armava la pausa: dal 17 novembre la pausa ha il suo pulsante e questo esce subito).
    await madre.evaluate(() => { if ($('liveReplayStopBtn')) $('liveReplayStopBtn').click(); });
    await dup.waitForTimeout(1100);
    const uMadre = await madre.evaluate(STATO);
    const uDup = await dup.evaluate(STATO);
    console.log('doppio STOP -> madre:', JSON.stringify(uMadre), '| duplicata:', JSON.stringify(uDup));
    assert.equal(uMadre.inReplay, false,
      'il pulsante ESCI esce dal replay al primo colpo: ' + JSON.stringify(uMadre));
    assert.equal(uDup.inReplay, false, 'e la duplicata esce con lei: ' + JSON.stringify(uDup));
    assert.equal(uMadre.perTutte, false,
      'finita la pausa condivisa la scelta non si eredita: ' + JSON.stringify(uMadre));
    assert.deepEqual(errori, []);
    assert.deepEqual(errori2, []);
  } finally { await browser.close(); }
});