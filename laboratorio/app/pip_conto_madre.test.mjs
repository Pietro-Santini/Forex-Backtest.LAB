// LA FINESTRA DUPLICATA (PIP_SLOT>0) DEVE APRIRE CON IL CONTO DELLA MADRE, NON CON LO STORICO.
//
// SEGNALATO dal proprietario (7 novembre 2026): «se ho duplicato la finestra e sono col conto
// collegato a MT5, non mi puo' aprire una finestra che e' collegata con il conto CSV.
// Assolutamente no. Deve essere sempre uguale al conto selezionato.»
//
// CAUSA MISURATA: initExtraPipWindow() parte SEMPRE in Storico (liveModeActive=false, csvLibrary
// vuoto). La madre manda il suo stato con pip_clone_snapshot (campo storico:!liveModeActive), ma
// il gestore applicava solo stili, asset e warm-start MT5: MAI il passaggio a Live. Risultato:
// con la madre in Live MT5 la duplicata restava in Storico, con l'elenco asset vuoto.
//
// CURA: nel gestore di pip_clone_snapshot, se la madre e' in Live (storico:false) e la finestra
// PIP non lo e', si chiama switchAccountMode(true) PRIMA del resto.
//
// Il test misura il COMPORTAMENTO, non il testo: apre davvero la pagina con ?pipSlot=2, le
// consegna un pip_clone_snapshot della madre in Live e guarda se liveModeActive diventa true.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('la finestra PIP entra in Live se la madre e\' in Live', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=2'});
  try {
    // Deve essere davvero una finestra PIP: se no', il test non misura niente.
    const slot = await pagina.evaluate(() => PIP_SLOT);
    assert.equal(slot, 2, 'la pagina deve aprirsi come finestra PIP 2');

    const r = await pagina.evaluate(async () => {
      const prima = liveModeActive;
      // Stessa forma del messaggio che manda la madre (vedi pip_clone_snapshot piu' su nel file).
      tradingChannel.onmessage({data:{
        type:'pip_clone_snapshot', slot:0, storico:false,
        asset:'XAUUSD', mode:'live', chartView:null, styleFields:{},
        mt5Connected:true, mt5CredsDraft:{server:'127.0.0.1',port:8000,login:'1',password:''}
      }});
      await new Promise(res=>setTimeout(res,300));
      return {prima, dopo:liveModeActive};
    });
    assert.equal(r.prima, false, 'la finestra PIP nasce in Storico (come oggi)');
    assert.equal(r.dopo, true,
      'con la madre in Live la duplicata DEVE passare in Live: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la finestra PIP resta in Storico se la madre e\' in Storico', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=3'});
  try {
    const r = await pagina.evaluate(async () => {
      tradingChannel.onmessage({data:{
        type:'pip_clone_snapshot', slot:0, storico:true,
        asset:null, mode:'backtest', chartView:null, styleFields:{},
        mt5Connected:false, mt5CredsDraft:null
      }});
      await new Promise(res=>setTimeout(res,300));
      return {dopo:liveModeActive};
    });
    assert.equal(r.dopo, false, 'con la madre in Storico la duplicata resta in Storico');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
