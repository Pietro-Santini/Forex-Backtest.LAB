// IN REPLAY GLI ORDINI VERI PASSANO — DECISIONE ROVESCIATA DAL PROPRIETARIO (2 novembre 2026).
//
// Storia, perche' questo file oggi dice il contrario di quello che diceva:
// fino al 26 ottobre 2026 il proprietario aveva richiesto «le operazioni aperte in
// modalita' replay non inficino su quelle del conto MT5 ma solo su quelle del conto
// storico», e in replay le rotte che scrivono non partivano. Il 2 novembre 2026 ha
// rovesciato la scelta, con cognizione di causa (conferma esplicita sul rischio di
// ordini reali in background): i segnali che arrivano mentre si fa backtest devono
// ESEGUIRE SUL CONTO MT5 REALE, in background, non creare posizioni finte.
//
// DOV'E' LA GUARDIA: nell'unico punto da cui passano TUTTE le chiamate al ponte
// (fetchMt5WithTimeout). Non e' stata spostata nelle singole funzioni: le rotte che
// scrivono passano tutte da qui, quindi una modifica sola le riapre tutte - e sono
// sette funzioni su dieci che scrivono ordini su MT5.
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

test('in replay, un ordine a mercato PARTE davvero', async () => {
  const r = await nellApp(`(async function(){
    ${BANCO}
    liveReplayActive = true;
    const res = await fetchMt5WithTimeout('/order/market', {method:'POST'});
    return {ok:res.ok, messaggio:res.message||'', usciti:window.__usciti.length};
  })()`);
  assert.equal(r.usciti, 1, 'in replay la rotta che scrive deve uscire verso il ponte');
  assert.equal(r.ok, true, 'e non deve essere bloccata');
});

test('in replay, anche la cancellazione di un pendente parte', async () => {
  const r = await nellApp(`(async function(){
    ${BANCO}
    liveReplayActive = true;
    const res = await fetchMt5WithTimeout('/order/cancel', {method:'POST'});
    return {ok:res.ok, usciti:window.__usciti.length};
  })()`);
  assert.equal(r.usciti, 1);
  assert.equal(r.ok, true);
});

test('in replay, anche la modifica di stop/target parte', async () => {
  // syncMt5PositionLevels passa di qui.
  const r = await nellApp(`(async function(){
    ${BANCO}
    liveReplayActive = true;
    const res = await fetchMt5WithTimeout('/order/modify', {method:'POST'});
    return {ok:res.ok, usciti:window.__usciti.length};
  })()`);
  assert.equal(r.usciti, 1);
  assert.equal(r.ok, true);
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
  const r = await nellApp(`(async function(){
    ${BANCO}
    liveReplayActive = false;
    const res = await fetchMt5WithTimeout('/order/market', {method:'POST'});
    return {ok:res.ok, usciti:window.__usciti.length};
  })()`);
  assert.equal(r.usciti, 1);
  assert.equal(r.ok, true);
});

test('PROVA DI CONTROLLO: la guardia non era "taglia tutto il ponte"', async () => {
  // Le rotte che NON scrivono non devono essere toccate in nessun caso: la decisione
  // rovesciata riguarda gli ordini, non il resto del ponte.
  const r = await nellApp(`(async function(){
    ${BANCO}
    liveReplayActive = true;
    const res = await fetchMt5WithTimeout('/account', {});
    return {ok:res.ok, usciti:window.__usciti.length};
  })()`);
  assert.equal(r.usciti, 1);
  assert.equal(r.ok, true);
});
