// GLI ORDINI PENDENTI STANNO IN TRE TABELLE, NON PIU' IN UNA SOLA.
//
// Riferito dal proprietario (3 novembre 2026): «in modalità replay, facciamo in modo di creare
// due tabelle distinte per gli ordini pendenti. Ordini pendenti MT5 e ordini pendenti storico.
// La tabella ordini pendenti storico deve essere visualizzata soltanto quando siamo in modalità
// replay e modalità backtest attiva. Così gli ordini pendenti dello storico, il replay, andranno
// sulla tabella ordini pendenti storico, mentre quelli di MT5 andranno nella tabella ordini
// pendenti MT5.»
//
// COM'ERA PRIMA: una tabella sola (#pendingOrdersTbl) con dentro tutto — ordini simulati di
// tutte e 4 le sessioni e ordini reali del conto MT5 — distinti solo da un'icona 🖥️.
//
// Il test NON cerca stringhe nel sorgente: apre l'app davvero, mette tre ordini pendenti di tre
// nature diverse e conta le righe che finiscono in ciascuna delle tre tabelle, nei tre stati che
// contano (replay+backtest, replay senza backtest, fuori dal replay).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Tre ordini pendenti, uno per natura:
//   ord-normale -> simulato, nato fuori dal replay   (tabella normale)
//   ord-replay  -> simulato, nato DENTRO il replay   (tabella storico)
//   ord-mt5     -> reale, con ticket MT5             (tabella MT5)
// piu' un ordine reale piazzato A MANO nel terminale (mai tracciato in app): anche lui MT5.
function scenario(replay, backtest) {
  return `(function(){
    const t0=Date.UTC(2026,9,20,8,0,0); const R=[];
    for(let i=0;i<60;i++){ const c=100+i*0.1;
      R.push({date:new Date(t0+i*60000).toISOString(),open:c,high:c+0.5,low:c-0.5,close:c,volume:10}); }
    rows=R; baseRows=R; idx=30; viewEnd=R.length; rowsAssetKey='XAUUSD'; currentAssetKey='XAUUSD';
    liveModeActive=true; liveReplayActive=${replay}; liveReplaySelecting=false;
    fblBacktestModeAttivo=${backtest};
    mt5Connected=true;
    positions.length=0; pendingOrders.length=0; mt5RealPositions.length=0; mt5RealOrders.length=0;
    pendingOrders.push({id:'ord-normale',asset:'XAUUSD',side:'BUY',kind:'LIMIT',entry:99,sl:98,tp:101,
      lots:0.10,createdAt:Date.now()});
    pendingOrders.push({id:'ord-replay',asset:'XAUUSD',side:'SELL',kind:'LIMIT',entry:103,sl:104,tp:101,
      lots:0.20,createdAt:Date.now(),historical:true});
    pendingOrders.push({id:'ord-mt5',asset:'XAUUSD',side:'BUY',kind:'STOP',entry:105,sl:104,tp:108,
      lots:0.30,createdAt:Date.now(),mt5Ticket:777001});
    mt5RealOrders.push({ticket:777002,symbol:'XAUUSD',side:'SELL',kind:'LIMIT',price_open:110,
      sl:111,tp:107,volume:0.40,time_setup:Math.floor(Date.now()/1000)});
    update();
    const conta=(id)=>{ const t=document.getElementById(id); return t?t.querySelectorAll('tr').length:'TABELLA ASSENTE'; };
    const testo=(id)=>{ const t=document.getElementById(id); return t?t.textContent:''; };
    const visibile=(id)=>{ const p=document.getElementById(id);
      if(!p)return 'PANNELLO ASSENTE';
      return getComputedStyle(p).display!=='none'; };
    return {
      righeNormale: conta('pendingOrdersTbl'),
      righeMt5:     conta('mt5PendingTbl'),
      righeReplay:  conta('replayPendingTbl'),
      pannelloMt5:    visibile('mt5PendingPanel'),
      pannelloReplay: visibile('replayPendingPanel'),
      // Per capire DOVE e' finito ciascuno: i lotti sono diversi per ogni ordine, quindi
      // bastano a riconoscerli senza dipendere da come e' scritta la riga.
      normaleHaMt5:     /0\\.30|0\\.40/.test(testo('pendingOrdersTbl')),
      normaleHaReplay:  /0\\.20/.test(testo('pendingOrdersTbl')),
      replayHaIlSuo:    /0\\.20/.test(testo('replayPendingTbl')),
      mt5HaIDueSuoi:    /0\\.30/.test(testo('mt5PendingTbl')) && /0\\.40/.test(testo('mt5PendingTbl'))
    };
  })()`;
}

test('in replay con la modalità backtest accesa ogni ordine va nella SUA tabella', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const v = await pagina.evaluate(scenario(true, true));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(v.pannelloReplay, true,
      'la tabella «Ordini pendenti storico» deve essere visibile in replay + modalità backtest');
    assert.equal(v.righeReplay, 1, 'nella tabella storico deve esserci SOLO l\'ordine nato nel replay');
    assert.equal(v.replayHaIlSuo, true, 'l\'ordine del replay (0.20 lot) deve stare nella tabella storico');
    assert.equal(v.righeMt5, 2,
      'nella tabella MT5 devono esserci i due ordini del conto reale (tracciato + piazzato a mano)');
    assert.equal(v.mt5HaIDueSuoi, true, 'la tabella MT5 deve contenere sia 0.30 sia 0.40 lot');
    assert.equal(v.righeNormale, 1, 'nella tabella normale deve restare solo l\'ordine simulato normale');
    assert.equal(v.normaleHaMt5, false,
      'un ordine del conto MT5 non deve più comparire nella tabella normale: era il mescolamento segnalato');
    assert.equal(v.normaleHaReplay, false,
      'un ordine nato nel replay non deve comparire nella tabella normale quando c\'è quella storico');
  } finally { await browser.close(); }
});

test('fuori dal replay la tabella storico sparisce, e con lei gli ordini del replay', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const v = await pagina.evaluate(scenario(false, true));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(v.pannelloReplay, false,
      'senza replay la tabella storico non si mostra: la modalità backtest da sola non basta');
    assert.equal(v.righeReplay, 0, 'e non contiene righe');
    assert.equal(v.normaleHaReplay, false,
      'scelta del proprietario: fuori dal replay quegli ordini non si vedono, si rivedono rientrando');
    assert.equal(v.righeNormale, 1, 'nella tabella normale resta solo l\'ordine simulato normale');
    assert.equal(v.righeMt5, 2, 'gli ordini del conto MT5 restano dove devono, replay o no');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: senza questa, il test sopra passerebbe anche se gli ordini del replay
// fossero spariti SEMPRE, anche mentre li stai usando. Dentro al replay con la modalità backtest
// spenta la tabella storico non c'è (è la condizione chiesta), quindi quegli ordini devono
// restare dov'erano da sempre — nella tabella normale.
test('in replay con la modalità backtest SPENTA gli ordini del replay restano in tabella normale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const v = await pagina.evaluate(scenario(true, false));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(v.pannelloReplay, false,
      'la tabella storico si mostra SOLO con la modalità backtest accesa dentro al replay');
    assert.equal(v.normaleHaReplay, true,
      'con la tabella storico spenta l\'ordine del replay non deve diventare invisibile mentre lo usi');
    assert.equal(v.righeNormale, 2, 'quindi nella tabella normale ce ne sono due');
    assert.equal(v.normaleHaMt5, false, 'ma gli ordini MT5 restano comunque fuori di lì');
  } finally { await browser.close(); }
});
