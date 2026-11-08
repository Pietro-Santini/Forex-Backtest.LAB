// LA FINESTRA DUPLICATA DEVE STARE SULLO STESSO CONTO DELLA MADRE (voce 5).
//
// SEGNALATO dal proprietario (8 novembre 2026): «se ho duplicato la finestra e sono col conto
// collegato a MT5, non mi puo' aprire una finestra collegata con il conto CSV. Assolutamente
// no. Deve essere sempre uguale al conto selezionato. Se invece nella pagina madre cambio e
// passo a un conto storico, allora le pagine duplicate si adatteranno al conto storico in
// maniera automatica, quindi deve esserci questo collegamento tra di loro.»
//
// Il test misura il COMPORTAMENTO, non il testo: costruisce la DECISIONE (fblApplicaContoMadre)
// per i tre casi che il proprietario ha descritto, e verifica che dica \"cambia\" quando deve e
// \"lascia stare\" quando e' gia' allineato - piu' la prova di controllo su un messaggio senza
// conto, che non deve toccare niente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Prepara una duplicata nello stato descritto. `madreViva/madreConto` è quello che la madre
// possiede; `miaViva/mioConto` è ciò che questa finestra possiede ora.
const PREPARA = (miaViva, mioConto, madreViva, madreConto) => `(function(){
  currentAssetKey='XAUUSD'; liveModeActive=${miaViva}; liveReplayActive=false;
  fblContoVista=${JSON.stringify(mioConto)};
  const msg={slot:0, type:'trading_sync', positions:[], pendingOrders:[], trades:[],
             conto:{vivo:${madreViva}, vista:${JSON.stringify(madreConto)}}};
  return fblApplicaContoMadre(msg.conto);
})()`;

test('madre su MT5, duplicata in Storico: deve passare in Live', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=2'});
  try{
    const r = await pagina.evaluate(PREPARA(false,'mt5', true,'mt5'));
    assert.equal(r.cambiato, true,
      'una duplicata nata in Storico con la madre su MT5 deve passare in Live: ' + JSON.stringify(r));
    assert.equal(r.promessa, "live", "e deve farlo passando per la modalita Live: " + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('madre su Storico, duplicata in Live: deve tornare in Storico', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=3'});
  try{
    const r = await pagina.evaluate(PREPARA(true,'mt5', false,'storico'));
    assert.equal(r.cambiato, true,
      'se la madre passa allo Storico la duplicata deve adattarsi: ' + JSON.stringify(r));
    assert.equal(r.promessa, 'storico', 'tornando in Storico: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('stessa modalita Live, conto diverso: la duplicata prende il conto della madre', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=4'});
  try{
    const r = await pagina.evaluate(PREPARA(true,'mt5', true,'kraken'));
    assert.equal(r.cambiato, true,
      'con la madre su Kraken la duplicata non puo\' restare su MT5: ' + JSON.stringify(r));
    assert.equal(r.promessa, "conto", "deve cambiare conto, non modalita: " + JSON.stringify(r));
    assert.equal(r.vista, 'kraken', 'e il conto che prende e\' quello della madre: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: gia\' allineata, non si tocca niente', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=5'});
  try{
    const r = await pagina.evaluate(PREPARA(true,'kraken', true,'kraken'));
    assert.equal(r.cambiato, false,
      'una duplicata gia\' sul conto della madre non va riavviata a ogni messaggio: ' + JSON.stringify(r));
    assert.equal(r.motivo, 'gia allineato', 'e il motivo lo dice: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ATTRAVERSO IL MESSAGGIO: la duplicata passa davvero in Live', async () => {
  // Il caso del proprietario, misurato per intero: messaggio che arriva, conto che cambia.
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=7'});
  try{
    const r = await pagina.evaluate(async () => {
      currentAssetKey='XAUUSD'; liveModeActive=false; fblContoVista='mt5';
      const prima = liveModeActive;
      tradingChannel.onmessage({data:{slot:0, type:'trading_sync', positions:[], pendingOrders:[],
        trades:[], conto:{vivo:true, vista:'mt5'}}});
      await new Promise(res => setTimeout(res, 900));
      return {prima: prima, dopo: liveModeActive};
    });
    assert.equal(r.prima, false, 'la duplicata parte in Storico');
    assert.equal(r.dopo, true,
      'e dopo il messaggio della madre deve essere in Live: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: un messaggio senza conto non tocca niente (finestra vecchia)', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=6'});
  try{
    const r = await pagina.evaluate(`(function(){
      currentAssetKey='XAUUSD'; liveModeActive=true; fblContoVista='mt5';
      return fblApplicaContoMadre(undefined);
    })()`);
    assert.equal(r.cambiato, false,
      'senza il conto nel messaggio non si cambia niente: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
