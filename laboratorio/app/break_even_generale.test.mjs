// IL BREAK-EVEN IN PIP DICE *DOVE* VA LO STOP, NON *QUANDO* PARTE.
//
// CORREZIONE DEL PROPRIETARIO (4 novembre 2026), dopo una prima versione sbagliata: «ci siamo
// fraintesi. Quando noi pigiamo il pulsante break-even, le posizioni dovranno spostarsi a 0 pip
// di guadagno, quindi al punto di entrata; ma se l'utente scrive 10 pip, il break-even si sposta
// a 10 pip. E funziona anche per le sale segnali: quando raggiunge un livello di TP e su quel TP
// è stato assegnato che sposta a break-even, segue la stessa regola — non va a 0 pip, va a 10 pip
// come l'utente ha stabilito, quindi sarà sempre in guadagno. E uguale dentro la configurazione
// della strategia: il pareggio anticipato all'85% verso il primo target sposta le posizioni non a
// livello 0 ma a 10 pip di guadagno. Perché oggi funziona che quando arriva a 10 pip di guadagno
// sposta le posizioni a 0, punto d'inizio.»
//
// COM'ERA (la versione del 3 novembre, che questo file misurava al rovescio): i pip erano la
// SOGLIA, e un giro periodico portava lo stop al pareggio esatto appena il guadagno li
// raggiungeva. Quel giro non esiste più: il numero è la destinazione, e i grilletti restano i tre
// di sempre.
//
// Le prove sotto guidano i TRE grilletti veri, uno per uno, e ognuno ha la sua prova di controllo
// a interruttore spento — altrimenti un valore giusto per caso passerebbe.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Banco comune: EURUSD, BUY aperto a 1.1000 con stop a 1.0950. Il pareggio vero si finge a
// 1.1002 (ingresso più i costi). Con 10 pip impostati lo stop deve finire a 1.1012.
const PAREGGIO = 1.1002, ATTESO_10 = 1.1012;
const BANCO = (attivo, pip, extra) => `(function(){
  const t0=Date.UTC(2026,9,20,8,0,0); const R=[];
  for(let i=0;i<40;i++){ R.push({date:new Date(t0+i*60000).toISOString(),open:1.1,high:1.1,low:1.1,close:1.1,volume:1}); }
  rows=R; baseRows=R; idx=39; viewEnd=39;
  rowsAssetKey='EURUSD'; currentAssetKey='EURUSD';
  liveModeActive=true; liveReplayActive=false;
  positions.length=0;
  positions.push({id:'p1',asset:'EURUSD',side:'BUY',entry:1.1000,sl:1.0950,tp:1.1100,lots:0.10,
    start:10,startTime:Date.parse(R[10].date),openTF:1,createdAt:Date.now()});
  active=null;
  pipSize=function(){ return 0.0001; };
  pipSizeForAsset=function(){ return 0.0001; };
  mt5PrezzoPareggio=function(){ return ${PAREGGIO}; };
  // Le guardie "troppo vicino" si mettono a tacere di proposito: qui si misura DOVE finisce lo
  // stop, non se il broker lo accetterebbe (quello ha già i suoi test).
  fblPareggioTroppoVicino=function(){ return {vicino:false}; };
  fblStopTroppoVicino=function(){ return {vicino:false,distanza:null,forbice:null}; };
  tgAuto.bePipTutte={attivo:${attivo},pip:${pip}};
  ${extra}
})()`;

// ---- GRILLETTO 1: il pulsante premuto dall'utente ----
const A_MANO = (attivo, pip, prezzo) => BANCO(attivo, pip, `
  livePriceByAsset['EURUSD']=${prezzo};
  currentPrice=function(){ return ${prezzo}; };
  fblPrezzoVeroPosizione=function(){ return ${prezzo}; };
  const ok=applyBreakevenToPosition(positions[0]);
  return {ok:!!ok, sl:Number(positions[0].sl.toFixed(5))};`);

test('col pulsante break-even lo stop va ai pip scelti, non a guadagno zero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(A_MANO(true, 10, 1.1030));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.ok, true, 'lo stop doveva essere spostato');
    assert.equal(r.sl, ATTESO_10,
      'lo stop deve finire a 10 pip di guadagno (' + ATTESO_10 + '), non al pareggio nudo');
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: a regola spenta lo stesso pulsante va al pareggio esatto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(A_MANO(false, 10, 1.1030));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.ok, true, 'lo stop doveva essere spostato anche qui');
    assert.equal(r.sl, PAREGGIO,
      'spenta, la regola non deve aggiungere niente: pareggio a guadagno zero');
  } finally { await browser.close(); }
});

test('con 0 pip il break-even resta il punto di partenza', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(A_MANO(true, 0, 1.1030));
    assert.equal(r.sl, PAREGGIO, '0 pip vuol dire guadagno zero, il punto di partenza');
  } finally { await browser.close(); }
});

// Il prezzo non è ancora arrivato ai 10 pip: lo stop cadrebbe OLTRE il prezzo, cioè chiuderebbe
// subito la posizione a mercato. Non si piazza, e si riproverà da solo.
test('se il prezzo non è ancora ai pip scelti, lo stop non si muove', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(A_MANO(true, 10, 1.1003));
    assert.equal(r.ok, false, 'uno stop oltre il prezzo non si piazza mai');
    assert.equal(r.sl, 1.095, 'lo stop deve restare quello di partenza');
  } finally { await browser.close(); }
});

// ---- GRILLETTO 2: il pareggio anticipato della strategia (85% verso il primo target) ----
const ANTICIPATO = (attivo, pip) => BANCO(attivo, pip, `
  // La candela di adesso ha toccato 1.1090: l'85% della strada verso 1.1100 è 1.1085.
  rows[39]={date:rows[39].date,open:1.1030,high:1.1090,low:1.1000,close:1.1030,volume:1};
  livePriceByAsset['EURUSD']=1.1030;
  currentPrice=function(){ return 1.1030; };
  positions[0].tgGruppo='s1';
  tgStrategie={s1:{sym:'EURUSD',side:'BUY',entry:1.1000,tps:[1.1100],sala:'Prova',
    creato:Date.now(),regole:[],fatte:[],avvicinamento:{pct:85,fatto:false}}};
  tgStrategiaValuta();
  return {sl:Number(positions[0].sl.toFixed(5)), fatto:!!(tgStrategie.s1&&tgStrategie.s1.avvicinamento.fatto)};`);

test('il pareggio anticipato della strategia porta lo stop ai pip scelti', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(ANTICIPATO(true, 10));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.fatto, true, 'il banco non ha fatto scattare il pareggio anticipato');
    assert.equal(r.sl, ATTESO_10, 'anche da qui lo stop deve finire a 10 pip di guadagno');
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: a regola spenta il pareggio anticipato va a guadagno zero', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(ANTICIPATO(false, 10));
    assert.equal(r.fatto, true, 'il banco non ha fatto scattare il pareggio anticipato');
    assert.equal(r.sl, PAREGGIO, 'spenta, resta il pareggio esatto');
  } finally { await browser.close(); }
});

// ---- GRILLETTO 3: la regola di sala «al tocco del TP 1 porta lo stop all'entrata» ----
const REGOLA_TP = (attivo, pip) => BANCO(attivo, pip, `
  rows[39]={date:rows[39].date,open:1.1030,high:1.1110,low:1.1000,close:1.1030,volume:1};
  livePriceByAsset['EURUSD']=1.1030;
  currentPrice=function(){ return 1.1030; };
  positions[0].tgGruppo='s1';
  positions[0].tp=1.1200;   // non è la posizione che chiude su questo TP: il suo stop si può toccare
  tgStrategie={s1:{sym:'EURUSD',side:'BUY',entry:1.1000,tps:[1.1100],sala:'Prova',
    creato:Date.now(),regole:[{quando:1,dove:'entrata'}],fatte:[],avvicinamento:null}};
  tgStrategiaValuta();
  return {sl:Number(positions[0].sl.toFixed(5)), fatte:(tgStrategie.s1&&tgStrategie.s1.fatte)||[]};`);

test('la regola di sala «stop all-entrata» al tocco del TP porta ai pip scelti', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(REGOLA_TP(true, 10));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.deepEqual(r.fatte, [1], 'il banco non ha fatto scattare la regola del TP 1');
    assert.equal(r.sl, ATTESO_10, 'anche da qui lo stop deve finire a 10 pip di guadagno');
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: a regola spenta lo «stop all-entrata» va a guadagno zero', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(REGOLA_TP(false, 10));
    assert.deepEqual(r.fatte, [1], 'il banco non ha fatto scattare la regola del TP 1');
    assert.equal(r.sl, PAREGGIO, 'spenta, resta il pareggio esatto');
  } finally { await browser.close(); }
});
