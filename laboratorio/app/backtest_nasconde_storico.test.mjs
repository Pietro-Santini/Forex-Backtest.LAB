// IN MODALITA' BACKTEST SPARISCE ANCHE LO STORICO, non solo le posizioni aperte.
//
// SEGNALATO dal proprietario (28 ottobre 2026): «quando attiviamo la modalita' backtest non deve
// farci piu' visualizzare le posizioni dello storico di MT5, devono sparire dal grafico. Le linee
// di apertura, entry, TP, stop loss, cioe' tutto deve sparire».
//
// LA CAUSA: i filtri sono DUE e separati. `positionBelongsToCurrentView` decide cosa si vede
// delle posizioni APERTE, e conosceva la modalita' backtest da quando e' nata.
// `tradeBelongsToCurrentView` decide cosa si vede delle operazioni GIA' CHIUSE - ed e' quella
// che disegna le righe piu' invadenti, perche' sono tante e vecchie - e non l'aveva mai saputo.
// Si accendeva il backtest, le posizioni aperte sparivano, e lo storico restava tutto li'.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Mette l'app in replay con la modalita' backtest accesa, e chiede ai due filtri cosa passa.
// `mostraMt5` e' l'interruttore nuovo delle impostazioni.
const CHIEDI = (mostraMt5) => `(function(){
  liveModeActive = true;
  liveReplayActive = true;
  fblBacktestModeAttivo = true;
  // MT5 COLLEGATO: senza, le sue operazioni non si vedrebbero COMUNQUE, e il test misurerebbe
  // quella regola invece della modalita' backtest - passando per il motivo sbagliato.
  mt5Connected = true;
  try{ localStorage.setItem('fbl_replay_backtest_mostra_mt5', ${mostraMt5 ? "'1'" : "'0'"}); }catch(e){}

  // Un'operazione MT5 vera gia' chiusa (lo storico che deve sparire) e una nata nel backtest.
  const m = currentMode();
  const storicoMt5 = {id:'t1', mode:m, mt5Ticket:555, mt5Login:'5057460278', entry:1.11, exit:1.12};
  const miaDelBacktest = {id:'t2', mode:m, mt5Ticket:null, backtest:true, historical:true, entry:1.11, exit:1.12};

  // E le due corrispondenti ancora APERTE.
  const apertaMt5 = {id:'p1', mt5Ticket:556, mt5Login:'5057460278'};
  const apertaMia = {id:'p2', mt5Ticket:null, backtest:true, historical:true};

  return {
    storicoMt5:      tradeBelongsToCurrentView(storicoMt5),
    miaDelBacktest:  tradeBelongsToCurrentView(miaDelBacktest),
    apertaMt5:       positionBelongsToCurrentView(apertaMt5),
    apertaMia:       positionBelongsToCurrentView(apertaMia)
  };
})()`;

async function chiedi(mostraMt5){
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(CHIEDI(mostraMt5));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    return r;
  } finally { await browser.close(); }
}

test('backtest acceso: lo STORICO di MT5 non si vede piu\'', async () => {
  const r = await chiedi(false);
  assert.equal(r.storicoMt5, false,
    'le operazioni gia\' chiuse dell\'account MT5 devono sparire: sono loro a disegnare le linee '
    +'di entrata, target e stop che sporcano il grafico');
  assert.equal(r.apertaMt5, false, 'e le posizioni aperte di MT5 pure (questo gia\' funzionava)');
});

test('backtest acceso: quello che apri TU resta visibile', async () => {
  // LA PROVA DI CONTROLLO della precedente: senza, il test passerebbe anche con un filtro che
  // nasconde tutto - e un grafico vuoto non e' un backtest, e' un grafico rotto.
  const r = await chiedi(false);
  assert.equal(r.miaDelBacktest, true,
    'le operazioni chiuse NATE nel backtest devono restare: sono il backtest');
  assert.equal(r.apertaMia, true, 'e cosi\' quelle ancora aperte');
});

test('l\'interruttore acceso rimette lo storico MT5 a grafico', async () => {
  // RICHIESTO: «nelle impostazioni mettiamo il pulsante: vuoi visualizzare le posizioni di MT5
  // in modalita' backtest? Se l'utente lo seleziona, verranno visualizzate».
  const r = await chiedi(true);
  assert.equal(r.storicoMt5, true, 'con l\'interruttore acceso lo storico MT5 torna visibile');
  assert.equal(r.miaDelBacktest, true, 'e ovviamente restano anche le tue');

  // LE POSIZIONI APERTE DI MT5 RESTANO NASCOSTE ANCHE COSI', ed e' giusto.
  //
  // Non e' la modalita' backtest a nasconderle: e' una regola piu' vecchia del replay, «si
  // vedono SOLO le posizioni nate nel replay». Mentre rivivi una giornata di marzo, una
  // posizione aperta OGGI su quel grafico non significherebbe niente - comparirebbe a un prezzo
  // che in quel momento non esisteva.
  //
  // L'interruttore governa lo STORICO, che e' quello che il proprietario ha chiesto di poter
  // rivedere («allora ci verra' visualizzato tutto lo storico di MT5»). Il test lo scrive
  // perche' sembra un'incoerenza e non lo e': se un domani qualcuno la "aggiusta", qui trovera'
  // il motivo invece di una sorpresa.
  assert.equal(r.apertaMt5, false,
    'nel replay le posizioni aperte OGGI restano fuori comunque: le nasconde il replay, non il backtest');
});
