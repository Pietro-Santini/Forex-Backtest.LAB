// IL BREAK-EVEN IN PIP VALE SU TUTTE LE POSIZIONI, NON SOLO SU QUELLE DELLE SALE.
//
// Riferito dal proprietario (3 novembre 2026): «nelle impostazioni delle aperture automatiche,
// dentro la sezione freni, l'impostazione generale di tutte quelle che sono le posizioni
// automatiche tramite sala segnali E le operazioni manuali. Lo spostamento del break even è
// espresso in pip sullo specifico asset e rimane uguale fino a quando l'utente non lo accende,
// lo spegne oppure lo modifica con un valore più alto oppure ritorna a 0, e 0 sarebbe il punto
// di partenza, quindi guadagno 0.»
//
// COM'ERA: il break-even in pip esisteva solo dentro la configurazione di OGNI SALA
// (tgCfg.bePip), e girava dentro la strategia del segnale — quindi una posizione aperta a mano
// non veniva mai toccata.
//
// LE PROTEZIONI, che qui si misurano una per una perché si tratta di spostare stop su denaro
// vero: una volta sola per posizione, mai all'indietro, mai oltre il prezzo attuale.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Banco: una posizione BUY aperta A MANO (nessun tgSala, nessun tgGruppo) su EURUSD a 1.1000,
// stop a 1.0950. Il prezzo è a 1.1020, cioè 20 pip di guadagno.
// Il punto di pareggio si finge a 1.1002 (ingresso più i costi): è quello che la regola deve
// mettere come stop.
const BANCO = (pip, attivo, prezzo) => `(function(){
  const t0=Date.UTC(2026,9,20,8,0,0); const R=[];
  for(let i=0;i<40;i++){ const c=1.1; R.push({date:new Date(t0+i*60000).toISOString(),open:c,high:c,low:c,close:c,volume:1}); }
  rows=R; baseRows=R; idx=39; viewEnd=39;
  rowsAssetKey='EURUSD'; currentAssetKey='EURUSD';
  liveModeActive=true; liveReplayActive=false;
  positions.length=0;
  positions.push({id:'manuale',asset:'EURUSD',side:'BUY',entry:1.1000,sl:1.0950,tp:1.1100,lots:0.10,
    start:10,startTime:Date.parse(R[10].date),openTF:1,createdAt:Date.now()});
  active=null;
  livePriceByAsset['EURUSD']=${prezzo};
  // Il prezzo "di adesso" e il passo del pip: fissati, così la prova non dipende dal feed.
  currentPrice=function(){ return ${prezzo}; };
  pipSize=function(){ return 0.0001; };
  pipSizeForAsset=function(){ return 0.0001; };
  mt5PrezzoPareggio=function(p){ return 1.1002; };
  fblPareggioTroppoVicino=function(){ return {vicino:false}; };
  tgAuto.bePipTutte={attivo:${attivo},pip:${pip}};
  const mosse=fblBePipTutteGiro();
  const p=positions[0];
  return {mosse, sl:p.sl, fatto:!!p.beGenFatto};
})()`;

test('una posizione aperta A MANO va a pareggio quando arriva ai pip impostati', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(BANCO(10, true, 1.1020));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.mosse, 1, 'la posizione manuale doveva essere portata a pareggio');
    assert.equal(r.sl, 1.1002, 'lo stop deve andare al punto di PAREGGIO (costi compresi), non all\'ingresso');
    assert.equal(r.fatto, true, 'e deve restare segnata come già fatta');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO 1: spento non deve succedere niente. Senza questa, un test verde non
// direbbe se la regola funziona o se semplicemente sposta sempre tutto.
test('con l\'interruttore spento nessuno stop si muove', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(BANCO(10, false, 1.1020));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.mosse, 0, 'spento vuol dire spento');
    assert.equal(r.sl, 1.0950, 'lo stop deve restare quello di partenza');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO 2: non ci siamo ancora arrivati. Con 50 pip richiesti e 20 di guadagno,
// la regola deve stare ferma — se no sposterebbe lo stop su una posizione ancora in gioco.
test('se i pip di guadagno non bastano, lo stop non si tocca', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(BANCO(50, true, 1.1020));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.mosse, 0, 'servivano 50 pip, ce ne sono 20: non si muove niente');
    assert.equal(r.sl, 1.0950, 'lo stop resta dov\'era');
  } finally { await browser.close(); }
});

// 0 PIP È UN VALORE LEGITTIMO: «0 sarebbe il punto di partenza, quindi guadagno 0».
// Con il prezzo appena sopra l'ingresso lo stop va comunque a pareggio.
test('con 0 pip lo stop va a pareggio appena il prezzo lo consente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(BANCO(0, true, 1.1010));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.mosse, 1, '0 pip è il punto di partenza, non "spento"');
    assert.equal(r.sl, 1.1002, 'lo stop va al pareggio');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO 3: LA PIÙ IMPORTANTE. Lo stop non deve MAI finire oltre il prezzo attuale:
// sarebbe una chiusura immediata travestita da protezione. Qui il pareggio (1.1002) è sopra il
// prezzo (1.1001), quindi la regola deve rinunciare.
test('lo stop non va mai oltre il prezzo attuale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(BANCO(0, true, 1.1001));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.mosse, 0,
      'il pareggio era oltre il prezzo: spostarci lo stop avrebbe chiuso la posizione all\'istante');
    assert.equal(r.sl, 1.0950, 'lo stop resta quello di partenza');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO 4: mai all'indietro. Se lo stop è già più avanti del pareggio (posizione
// già protetta), la regola non deve riportarlo giù.
test('uno stop già più avanti del pareggio non torna indietro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // Si monta il banco (che muove lo stop una prima volta), poi si rimette uno stop GIÀ più
    // avanti del pareggio e si richiede il giro: la regola deve rinunciare.
    await pagina.evaluate(BANCO(10, true, 1.1020));
    const r2 = await pagina.evaluate(`(function(){
      positions[0].sl=1.1010; positions[0].beGenFatto=false;
      const mosse=fblBePipTutteGiro();
      return {mosse, sl:positions[0].sl};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r2.mosse, 0, 'uno stop migliore non si peggiora');
    assert.equal(r2.sl, 1.1010, 'e resta dov\'era');
  } finally { await browser.close(); }
});
