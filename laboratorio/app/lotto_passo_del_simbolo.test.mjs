// IL LOTTO SI CALCOLA COL PASSO VERO DEL SIMBOLO, NON SEMPRE CON 0,01.
//
// CONSEGUENZA DIRETTA DELLA v2.2.63. Da quel rilascio il ponte RIFIUTA un volume che, arrotondato
// per difetto al passo del simbolo, resta sotto il `volume_min` di quel simbolo - invece di
// alzarlo al minimo come faceva prima (0,03 lot richiesti su un simbolo con passo 0,1
// diventavano 0,1: tre volte il rischio scelto, in silenzio).
//
// Quella cura e' giusta e protegge i soldi, ma da sola lascia un buco dall'altra parte: l'app
// continua a calcolare SEMPRE col passo 0,01 (`opz.passo` e' valorizzato solo per Kraken), quindi
// su un simbolo con passo 0,1 produce un numero che il ponte non puo' accettare, e il segnale non
// si apre affatto. Il risultato e' sicuro ma inutile: meglio aprirlo della dimensione giusta.
//
// IL DATO C'E' GIA' E VIENE BUTTATO: `/symbol-check` del servizio dati dichiara `volume_step` e
// `volume_min` (mt5_feed_server.py, righe ~602-603). L'app legge solo `volume_min`, lo salva come
// `minDeal`, e `tgPiano` non lo guarda mai.
//
// PERCHE' NON SI RIUSA `minDeal`: quel campo e' gia' scritto da altre due strade con un
// significato DIVERSO - Capital.com ci mette `minDealSize` e Binance `minQty`, che sono minimi di
// quantita' nelle loro unita', non lotti MT5. Usarlo come minimo di lotto vorrebbe dire far
// decidere il lottaggio MT5 a un numero di un altro broker. Quindi due campi nuovi e dichiarati,
// `lotStep` e `lotMin`, scritti SOLO dalla strada MT5.
//
// LA REGOLA CHE NON CAMBIA: si arrotonda sempre per DIFETTO, e se nemmeno il lotto minimo del
// simbolo sta dentro il rischio scelto, NON si apre - non si apre piu' grande.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Un conto da 10.000 al 5% = 500 di rischio. Con 132,6 di perdita per lotto il lotto ideale e'
// 3,7707...: un numero che NON cade sul passo, quindi si vede di quanto viene tagliato.
//   passo 0,01 -> 3,77   (quello che l'app fa oggi, sempre)
//   passo 0,1  -> 3,7    (quello che il simbolo vuole davvero)
const PIANO = (meta) => `(() => {
  ${meta}
  return tgPiano(
    {direzione:'BUY', stop_loss:90, take_profit:[150]},
    'XAUUSD',
    5,
    {prezzo:100, saldo:10000, valore:(a,b,l)=>132.6*l, entroRischio:true}
  );
})()`;

const META_PASSO_GROSSO = `
  assetAutoMeta['XAUUSD'] = Object.assign({}, assetAutoMeta['XAUUSD']||{},
    {decimals:2, contractSize:100, lotStep:0.1, lotMin:0.1, locked:true, source:'mt5/symbol-check'});
`;
const META_SENZA_PASSO = `
  assetAutoMeta['XAUUSD'] = Object.assign({}, assetAutoMeta['XAUUSD']||{},
    {decimals:2, contractSize:100, locked:true, source:'mt5/symbol-check'});
  delete assetAutoMeta['XAUUSD'].lotStep;
  delete assetAutoMeta['XAUUSD'].lotMin;
`;

test('passo 0,1 dichiarato dal simbolo: il lotto e\' un multiplo di 0,1, per difetto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const p = await pagina.evaluate(PIANO(META_PASSO_GROSSO));
    assert.deepEqual(p.problemi, undefined, 'il piano deve riuscire: 3,7 lot stanno dentro il rischio');
    assert.equal(p.lotti, 3.7, 'col passo 0,1 il lotto e\' 3,7, non 3,77 (che il ponte rifiuterebbe)');
    // E resta dentro il rischio scelto: 3,7 x 132,6 = 490,62 su 500.
    assert.ok(p.rischioReale <= 500 + 1e-9, 'perdita allo stop: ' + p.rischioReale);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il lotto non cade mai fra due passi del simbolo', async () => {
  // La misura generale: qualunque passo il simbolo dichiari, il lotto ci cade sopra esatto.
  // Senza questa, un numero come 3,70000000000001 passerebbe il test di sopra e verrebbe
  // rifiutato dal ponte comunque.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(() => {
      const out = [];
      for(const passo of [0.01, 0.1, 0.5, 1]){
        assetAutoMeta['XAUUSD'] = Object.assign({}, assetAutoMeta['XAUUSD']||{},
          {decimals:2, contractSize:100, lotStep:passo, lotMin:passo, locked:true, source:'mt5/symbol-check'});
        const p = tgPiano({direzione:'BUY', stop_loss:90, take_profit:[150]}, 'XAUUSD', 5,
          {prezzo:100, saldo:10000, valore:(a,b,l)=>132.6*l, entroRischio:true});
        out.push({passo, lotti:p.lotti, problemi:p.problemi||null});
      }
      return out;
    })()`);
    for(const v of r){
      assert.equal(v.problemi, null, 'passo ' + v.passo + ': il piano deve riuscire');
      const resto = Math.abs(v.lotti / v.passo - Math.round(v.lotti / v.passo));
      assert.ok(resto < 1e-6,
        'passo ' + v.passo + ': ' + v.lotti + ' non e\' un multiplo del passo');
      assert.ok(v.lotti * 132.6 <= 500 + 1e-9,
        'passo ' + v.passo + ': ' + v.lotti + ' lot rischiano ' + (v.lotti*132.6) + ', oltre i 500 scelti');
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se nemmeno il lotto minimo del simbolo sta nel rischio, NON si apre', async () => {
  // Il caso che oggi produce un numero che il ponte rifiuta. Con 20.000 di perdita per lotto e
  // 500 di rischio, il lotto ideale e' 0,025: sotto il minimo 0,1 del simbolo. Aprire 0,1
  // vorrebbe dire rischiare 2.000 invece di 500, cioe' QUATTRO volte il rischio scelto.
  // Oggi l'app calcola col minimo 0,01, trova 0,02 "dentro il rischio" e lo manda al ponte, che
  // lo rifiuta perche' sotto il minimo del simbolo: il segnale non si apre e nessuno dice perche'.
  const {browser, pagina, errori} = await apriApp();
  try{
    const p = await pagina.evaluate(`(() => {
      ${META_PASSO_GROSSO}
      return tgPiano({direzione:'BUY', stop_loss:90, take_profit:[150]}, 'XAUUSD', 5,
        {prezzo:100, saldo:10000, valore:(a,b,l)=>20000*l, entroRischio:true});
    })()`);
    assert.ok(p.problemi && p.problemi.length, 'deve rifiutare, non produrre un lotto');
    assert.ok(!(p.lotti > 0), 'nessun lotto da mandare al ponte: ' + p.lotti);
    // Il motivo deve dire il minimo VERO del simbolo, non 0,01: e' l'unico modo per capire
    // cosa fare (alzare il rischio della sala, o aprire a mano).
    const motivo = p.problemi.join(' ');
    assert.match(motivo, /0[.,]1/, 'il motivo deve nominare il minimo vero del simbolo: ' + motivo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// --- PROVE DI CONTROLLO: senza il dato nuovo, tutto come prima ---------------------------------

test('CONTROLLO simbolo che non dichiara il passo: identico a oggi (0,01)', async () => {
  // E' la garanzia che nessun lottaggio gia' in uso cambi da solo. Se questa diventa rossa, la
  // cura ha cambiato il comportamento di tutti i simboli invece che dei soli interessati.
  const {browser, pagina, errori} = await apriApp();
  try{
    const p = await pagina.evaluate(PIANO(META_SENZA_PASSO));
    assert.deepEqual(p.problemi, undefined);
    assert.equal(p.lotti, 3.77, 'senza passo dichiarato vale 0,01, come prima della cura');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO Kraken: il passo passato dal chiamante vince sul simbolo', async () => {
  // Kraken valorizza opz.passo/opz.minimo col passo del CONTRATTO, che non ha niente a che
  // vedere coi lotti MT5. Un valore esplicito del chiamante non si tocca.
  const {browser, pagina, errori} = await apriApp();
  try{
    const p = await pagina.evaluate(`(() => {
      ${META_PASSO_GROSSO}
      return tgPiano({direzione:'BUY', stop_loss:90, take_profit:[150]}, 'XAUUSD', 5,
        {prezzo:100, saldo:10000, valore:(a,b,l)=>132.6*l, passo:0.01, minimo:0.01, entroRischio:true});
    })()`);
    assert.deepEqual(p.problemi, undefined);
    assert.equal(p.lotti, 3.77, 'col passo esplicito del chiamante il simbolo non c\'entra');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
