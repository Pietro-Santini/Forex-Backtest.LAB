// IN REPLAY NESSUN ORDINE VERO ESCE VERSO MT5 — E LA GUARDIA STA ALLA PORTA.
//
// RICHIESTO dal proprietario: «le operazioni aperte in modalita' replay non inficiano su quelle
// del conto MT5 ma solo su quelle del conto storico».
//
// PERCHE' ALLA PORTA E NON NELLE SINGOLE FUNZIONI: la guardia era stata messa in sette funzioni
// su dieci che scrivono ordini su MT5. Le tre rimaste (syncMt5PositionLevels,
// syncMt5PendingOrderLevels, e la cancellazione di un pendente dalla tabella) agiscono solo su
// elementi che hanno un ticket MT5, e in replay la lista e' gia' filtrata - quindi erano
// PROBABILMENTE irraggiungibili. Su soldi veri «probabilmente» non basta, e dieci guardie da
// tenere allineate a mano sono dieci occasioni di dimenticarne una: la prossima funzione che
// qualcuno aggiunge nasce scoperta.
//
// Qui il controllo e' nell'unico punto da cui passano TUTTE le chiamate al ponte
// (fetchMt5WithTimeout): in replay le rotte che SCRIVONO (/order/...) non partono proprio.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

async function nellApp(codice){
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(codice);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    return r;
  } finally { await browser.close(); }
}

// Sostituisce fetch con un contatore: cosi' si misura se la chiamata e' USCITA davvero,
// invece di fidarsi di quello che risponde la funzione.
const BANCO = `
  window.__usciti = [];
  window.fetch = function(u){ window.__usciti.push(String(u)); return Promise.resolve({
    ok:true, status:200, json:()=>Promise.resolve({ok:true}) }); };
`;

test('in replay, un ordine a mercato NON parte', async () => {
  const r = await nellApp(`(async function(){
    ${BANCO}
    liveReplayActive = true;
    const res = await fetchMt5WithTimeout('/order/market', {method:'POST'});
    return {ok:res.ok, messaggio:res.message||'', usciti:window.__usciti.length};
  })()`);
  assert.equal(r.usciti, 0, 'nessuna chiamata deve uscire verso il ponte');
  assert.equal(r.ok, false, 'e la funzione deve dire che non e\' partito');
  assert.match(r.messaggio, /replay/i, 'con un motivo leggibile, non un errore generico');
});

test('in replay, nemmeno una cancellazione di pendente parte', async () => {
  // E' una delle tre strade che erano rimaste scoperte.
  const r = await nellApp(`(async function(){
    ${BANCO}
    liveReplayActive = true;
    const res = await fetchMt5WithTimeout('/order/cancel', {method:'POST'});
    return {ok:res.ok, usciti:window.__usciti.length};
  })()`);
  assert.equal(r.usciti, 0);
  assert.equal(r.ok, false);
});

test('in replay, nemmeno una modifica di stop/target parte', async () => {
  // L'altra strada scoperta: syncMt5PositionLevels passa di qui.
  const r = await nellApp(`(async function(){
    ${BANCO}
    liveReplayActive = true;
    const res = await fetchMt5WithTimeout('/order/modify', {method:'POST'});
    return {ok:res.ok, usciti:window.__usciti.length};
  })()`);
  assert.equal(r.usciti, 0);
  assert.equal(r.ok, false);
});

test('PROVA DI CONTROLLO: in replay le LETTURE continuano a funzionare', async () => {
  // Senza questa prova si "riparerebbe" tagliando tutto il ponte: e senza letture il grafico,
  // il saldo e l'elenco posizioni smetterebbero di aggiornarsi: molto peggio del difetto.
  const r = await nellApp(`(async function(){
    ${BANCO}
    liveReplayActive = true;
    const res = await fetchMt5WithTimeout('/positions', {});
    return {ok:res.ok, usciti:window.__usciti.length};
  })()`);
  assert.equal(r.usciti, 1, 'una lettura in replay deve uscire normalmente');
  assert.equal(r.ok, true);
});

test('PROVA DI CONTROLLO: fuori dal replay gli ordini partono come sempre', async () => {
  // L'altra meta' che conta: la guardia non deve spegnere il trading vero.
  const r = await nellApp(`(async function(){
    ${BANCO}
    liveReplayActive = false;
    const res = await fetchMt5WithTimeout('/order/market', {method:'POST'});
    return {ok:res.ok, usciti:window.__usciti.length};
  })()`);
  assert.equal(r.usciti, 1, 'fuori dal replay l\'ordine deve uscire davvero');
  assert.equal(r.ok, true);
});
