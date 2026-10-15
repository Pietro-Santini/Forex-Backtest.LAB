// LA PERCENTUALE PUÒ ESSERE IL RISCHIO O LA QUOTA DI CAPITALE, E NON SONO LA STESSA COSA.
//
// CHIESTO dal proprietario con un esempio preciso: «SOL a 120, stop a 93, conto da 10.000 euro,
// 5% del capitale: mi deve dare intorno ai 4 lotti». Facendo il conto, quei 4 lotti sono il VALORE
// della posizione (500 / 120 = 4,16), non la perdita possibile: col rischio — che è quello che
// l'app ha sempre fatto — 500 € diviso i 27 $ di stop danno 18,51 lotti, quattro volte e mezzo
// tanti. Da qui l'interruttore per sala: «di rischio» (come prima, predefinito) o «del capitale».
//
// I numeri di questi test sono quelli dell'esempio. Se un domani qualcuno tocca il divisore, qui
// si vede subito di quanto cambia il lottaggio — che è l'unica cosa che conta davvero.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Conto Kraken da 10.000, SOL a 120, stop a 93, un solo target: le opzioni sono quelle che
// l'apertura automatica passa davvero a tgPiano per una cripto (lotto = quantità di monete).
const PIANO = (base, pct) => `tgPiano(
  {direzione:'BUY', stop_loss:93, take_profit:[150]},
  'BINANCE:SOLUSDT',
  ${pct},
  {prezzo:120, saldo:10000, valore:(a,b,l)=>Math.abs(a-b)*l,
   passo:0.01, minimo:0.01, valuta:'USD', base:'${base}', entroRischio:true})`;

test('5% DI RISCHIO su SOL: 18,51 lotti, e allo stop si perdono 500', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const p = await pagina.evaluate(PIANO('rischio', 5));
    assert.deepEqual(p.problemi, undefined, 'il piano deve riuscire');
    assert.equal(p.lotti, 18.51);
    assert.equal(p.base, 'rischio');
    // 18,51 × 27 = 499,77: il 5% di 10.000, meno l'arrotondamento per difetto.
    assert.ok(Math.abs(p.rischioReale - 499.77) < 0.01, 'perdita allo stop: ' + p.rischioReale);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('5% DEL CAPITALE su SOL: 4,16 lotti, cioè una posizione da 500', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const p = await pagina.evaluate(PIANO('capitale', 5));
    assert.deepEqual(p.problemi, undefined, 'il piano deve riuscire');
    // 500 / 120 = 4,1666 -> 4,16 col passo da 0,01, arrotondato per difetto.
    assert.equal(p.lotti, 4.16, 'è il numero che si aspettava il proprietario');
    assert.equal(p.base, 'capitale');
    // Il valore della posizione resta il 5% del conto...
    assert.ok(Math.abs(p.lotti * 120 - 499.2) < 0.01, 'valore posizione: ' + (p.lotti * 120));
    // ...e la perdita allo stop è molto minore: 4,16 × 27 = 112,32, cioè l'1,12%.
    assert.ok(Math.abs(p.rischioReale - 112.32) < 0.01, 'perdita allo stop: ' + p.rischioReale);
    assert.ok(p.rischioRealePct < 1.2, 'col capitale la perdita è una conseguenza, non il tetto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza interruttore si comporta come sempre: il predefinito è il rischio', async () => {
  // È la garanzia che nessuna sala già configurata cambi comportamento da sola.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`({
      senzaBase: tgPiano({direzione:'BUY', stop_loss:93, take_profit:[150]}, 'BINANCE:SOLUSDT', 5,
        {prezzo:120, saldo:10000, valore:(a,b,l)=>Math.abs(a-b)*l, passo:0.01, minimo:0.01, valuta:'USD', entroRischio:true}).lotti,
      cfgVuota: tgBaseLotto({}),
      cfgNulla: tgBaseLotto(null),
      cfgScelta: tgBaseLotto({baseLotto:'capitale'}),
      cfgStrana: tgBaseLotto({baseLotto:'qualcosaltro'})
    })`);
    assert.equal(r.senzaBase, 18.51, 'senza base esplicita vale il rischio, come prima');
    assert.equal(r.cfgVuota, 'rischio');
    assert.equal(r.cfgNulla, 'rischio');
    assert.equal(r.cfgScelta, 'capitale');
    assert.equal(r.cfgStrana, 'rischio', 'un valore non previsto non deve diventare "capitale"');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il rapporto fra le due basi segue la larghezza dello stop', async () => {
  // È il cuore della differenza: con uno stop STRETTO il rischio fa una posizione enorme, la quota
  // di capitale no. È il caso «ho messo il 2% e ha usato 5.839 € di margine».
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      const fai = (sl, base) => tgPiano({direzione:'BUY', stop_loss:sl, take_profit:[150]},
        'BINANCE:SOLUSDT', 5,
        {prezzo:120, saldo:10000, valore:(a,b,l)=>Math.abs(a-b)*l,
         passo:0.01, minimo:0.01, valuta:'USD', base:base, entroRischio:true});
      ({strettoRischio: fai(119.4, 'rischio').lotti,   // stop a 0,5%
        strettoCapitale: fai(119.4, 'capitale').lotti,
        largoRischio: fai(93, 'rischio').lotti,        // stop a 22,5%
        largoCapitale: fai(93, 'capitale').lotti})
    }`);
    // Con la quota di capitale il lottaggio NON cambia: la spesa è sempre il 5%.
    assert.equal(r.strettoCapitale, r.largoCapitale,
      'col capitale lo stop non tocca il lottaggio: la spesa è quella scelta');
    // Col rischio sì, e di molto: stop venti volte più stretto, posizione venti volte più grande.
    assert.ok(r.strettoRischio > r.largoRischio * 10,
      'col rischio uno stop stretto gonfia la posizione: ' + r.strettoRischio + ' contro ' + r.largoRischio);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('uno stop al 22% su una cripto non è un errore di battitura: si apre', async () => {
  // SCOPERTO scrivendo questi test: l'esempio del proprietario (SOL a 120, stop a 93 = -22,5%)
  // veniva RIFIUTATO in partenza, prima ancora di arrivare al lottaggio, perche' il tetto "questo
  // non e' un prezzo vero" era 20% per tutti. Sulle cripto e' troppo stretto. Ora e' 40% la', 20%
  // sul resto: il tetto serve contro i numeri che non sono prezzi, non contro gli stop larghi.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      const fai = (sym, sl) => tgPiano({direzione:'BUY', stop_loss:sl, take_profit:[150]}, sym, 5,
        {prezzo:120, saldo:10000, valore:(a,b,l)=>Math.abs(a-b)*l,
         passo:0.01, minimo:0.01, valuta:'USD', base:'capitale', entroRischio:true});
      ({cripto22: !fai('BINANCE:SOLUSDT', 93).problemi,
        cripto50: !!(fai('BINANCE:SOLUSDT', 60).problemi||[]).length,
        forex22:  !!(fai('XAUUSD', 93).problemi||[]).length})
    }`);
    assert.equal(r.cripto22, true, 'uno stop al 22,5% su una cripto deve passare');
    assert.equal(r.cripto50, true, 'al 50% no: lì non è più un prezzo, ed è a quello che serve il tetto');
    assert.equal(r.forex22, true, 'sul forex il tetto del 20% resta com’era');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
