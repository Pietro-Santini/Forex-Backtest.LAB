// IN REPLAY UNA POSIZIONE APPENA APERTA NON SI CHIUDE DA SOLA COL FUTURO CHE NON E' ANCORA
// ARRIVATO.
//
// SEGNALATO dal proprietario il 17 novembre 2026, con la diagnosi già dentro la segnalazione:
//
//   «sto facendo backtest su tutte le pagine collegate, vado ad aprire un'operazione, appena la
//    apro me la chiude. […] magicamente me la chiude in profitto in questo caso a più 315 euro e
//    il 3,15% del conto […] E i PIP sono 157,6, che è giusto. […] non ho messo né uno stop loss,
//    né un take profit, non ho messo nulla e lui comunque ha aperto la posizione e me l'ha chiusa
//    subito. […] in modalità replay effettivamente il prezzo sta a 4.172 e il prezzo al momento
//    sta a 3.850 […] Io ho aperto una posizione in sell e quindi mi si è chiusa in guadagno, e
//    infatti se la vado ad aprire in buy me la chiude in negativo, a meno 315.»
//
// CAUSA, letta nel codice e poi riprodotta qui: `scanHistoricalSlTpTouches()` ricostruisce le
// chiusure avvenute «mentre l'app non era aperta» e scorre TUTTE le candele salvate:
//
//     for(let i=0;i<rows.length;i++){
//
// In replay però `idx` è CONGELATO sul punto scelto (lo dice il commento a ~5084), quindi le
// candele da `idx+1` in poi sono **il futuro** dal punto di vista del replay. La ricostruzione le
// legge come passato già avvenuto e chiude la posizione al primo tocco dello stop o del target -
// che ci sono anche senza metterli a mano, perché l'app ne mette due automatici a 1:1
// (`applyLocalSlTpDefaultsIfMissing` / `defaultSlTpFor`). Da qui tutto quello che ha visto lui:
// chiusura istantanea, esattamente sul livello, sell in guadagno e buy in perdita.
//
// LA CURA NON E' SPEGNERE LA RICOSTRUZIONE IN REPLAY: dentro la finestra del replay - fra
// l'apertura e il punto dove si è arrivati - un tocco dello stop è un esito di backtest vero e
// DEVE chiudere. Il giro deve solo fermarsi a `idx`. La terza prova di questo banco è quella, ed
// è la ragione per cui la cura non può essere un `if(liveReplayActive)return`.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Una serie che SCENDE: 20 candele da 4200 a 3850, un punto ogni candela.
// In replay ci si ferma a metà (idx=9, prezzo ~4027): da lì in avanti il prezzo continua a
// scendere fino a 3850, ed è quel pezzo che non deve contare.
const PREPARA = (opz) => `(() => {
  const o = ${JSON.stringify(opz)};
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD';
  rows=[];
  for(let i=0;i<20;i++){
    const p=4200-i*18;   // 4200, 4182, ... 3858
    rows.push({date:'2026-11-0'+(1+Math.floor(i/10))+'T'+String(10+(i%10)).padStart(2,'0')+':00:00.000Z',
      open:p, high:p+2, low:p-2, close:p, volume:1});
  }
  idx = o.idx;
  liveModeActive = true;
  liveReplayActive = o.replay;
  slTpScanDoneForAsset = currentAssetKey;
  trades=[]; equity=[]; positions=[];
  window.anotherWindowOwnsAssetEvaluation = () => false;
  // La posizione: SELL aperta al prezzo del replay, con stop e target automatici a 1:1 come
  // fa l'app quando non si mette niente a mano.
  const entrata = rows[o.aperta].close;
  const dist = 100;
  positions.push({
    id:'p1', asset:'XAUUSD', side:'SELL', entry:entrata,
    sl: entrata + dist, tp: entrata - dist,
    slAt: null, tpAt: null, rrSl: entrata + dist, slIniziale: entrata + dist,
    lots:0.1, start:o.aperta, startTime:Date.parse(rows[o.aperta].date),
    openTF:1, historical:true, mt5Ticket:null
  });
  return {quante:positions.length, entrata, idx, replay:liveReplayActive};
})()`;

const SCANSIONA = `(() => {
  slTpScanDoneForAsset = null;    // la funzione lo rimette: cosi' non esce prima del tempo
  scanHistoricalSlTpTouches();
  const tAll = [].concat(trades||[], ((sessionByMode.backtest||{}).trades)||[], ((sessionByMode.backtest_propfirm||{}).trades)||[]);
  const last = tAll[tAll.length-1];
  return {aperte:positions.length, chiuse:tAll.length,
    esito: last ? String(last.result||last.reason||'') : null};
})()`;

test('in replay la posizione NON si chiude col futuro che il replay non ha ancora raggiunto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    // aperta alla candela 9 (prezzo 4038), replay fermo alla 9: il target a -100 (3938) viene
    // toccato solo alla candela 15, cioe' nel FUTURO rispetto a dove siamo.
    const prep = await pagina.evaluate(PREPARA({idx:9, aperta:9, replay:true}));
    assert.equal(prep.quante, 1, 'la preparazione deve avere una posizione');
    const r = await pagina.evaluate(SCANSIONA);
    assert.equal(r.aperte, 1,
      'la posizione deve restare APERTA: è stata chiusa dal futuro (chiuse: ' + r.chiuse + ', esito ' + r.esito + ')');
    assert.equal(r.chiuse, 0, 'nessuna riga nel Journal');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO fuori dal replay: la ricostruzione dallo storico funziona come sempre', async () => {
  // Senza questa, una cura che spegne la ricostruzione passerebbe la prova di sopra e
  // romperebbe il motivo per cui quella funzione esiste: riaprendo l'app dopo giorni, una
  // posizione il cui stop era stato toccato DEVE risultare chiusa.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA({idx:19, aperta:9, replay:false}));
    const r = await pagina.evaluate(SCANSIONA);
    assert.equal(r.aperte, 0,
      'fuori dal replay il tocco nello storico deve chiudere la posizione');
    assert.equal(r.chiuse, 1, 'e lasciare una riga nel Journal');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO dentro il replay: un tocco GIA\' avvenuto chiude, ed è un esito di backtest vero', async () => {
  // La ragione per cui la cura non può essere «in replay non si ricostruisce niente». Se fra
  // l'apertura e il punto dove si è arrivati il prezzo ha toccato il livello, quella chiusura è
  // un risultato del backtest e deve esserci.
  const {browser, pagina, errori} = await apriApp();
  try{
    // aperta alla candela 2, replay arrivato alla 18: il target è stato toccato per strada.
    await pagina.evaluate(PREPARA({idx:18, aperta:2, replay:true}));
    const r = await pagina.evaluate(SCANSIONA);
    assert.equal(r.aperte, 0,
      'il tocco avvenuto DENTRO la finestra del replay deve chiudere: è backtest, non il futuro');
    assert.equal(r.chiuse, 1);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO: il confine è esattamente idx, non idx+1', async () => {
  // La candela dove il replay si trova ADESSO vale; quella dopo no. Un errore di uno qui
  // sarebbe invisibile a occhio e riaprirebbe il difetto sul primo passo del replay.
  const {browser, pagina, errori} = await apriApp();
  try{
    // Aperta alla candela 0 (4200), target a -100 = 4100: la serie scende di 18 per candela,
    // quindi `low` arriva a 4100 alla candela 6 (4200-6*18=4092, low 4090). Con il replay fermo
    // alla 5 non è ancora toccato; alla 6 sì.
    await pagina.evaluate(PREPARA({idx:5, aperta:0, replay:true}));
    const r5 = await pagina.evaluate(SCANSIONA);
    await pagina.evaluate(PREPARA({idx:6, aperta:0, replay:true}));
    const r6 = await pagina.evaluate(SCANSIONA);
    assert.equal(r5.aperte, 1, 'ferma alla 5 il target non è ancora stato toccato: deve restare aperta');
    assert.equal(r6.aperte, 0, 'arrivata alla 6 il target è stato toccato: deve chiudere');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
