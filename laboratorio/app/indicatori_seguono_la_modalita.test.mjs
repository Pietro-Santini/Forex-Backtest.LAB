// GLI INDICATORI SI PORTANO DIETRO AL CAMBIO DI MODALITA'.
//
// SEGNALATO dal proprietario il 17 novembre 2026: «quando si chiude quello che è un conto prop
// firm, quelle che sono le impostazioni delle pagine duplicate si resettano completamente, si
// resettano anche quelli che sono gli indicatori e questo non va bene, perché non posso stare a
// ripristinare sempre quelli che sono gli indicatori alla chiusura di un conto».
//
// CAUSA MISURATA (non supposta):
//   1. `collectTradingSyncPayload` manda `isPropFirmMode`, e chi riceve lo applica SENZA nessuna
//      guardia: `if(msg.isPropFirmMode!=null)isPropFirmMode=!!msg.isPropFirmMode;`
//      Nella stessa funzione `trades` ed `equity` sono protetti da `_stessoContoMt5`; questo no.
//   2. `currentMode()` vale `base+'_propfirm'` quando la prop firm e' accesa.
//   3. `indicatorsByMode` e' archiviato PER MODALITA':
//      `{backtest:null, live:null, backtest_propfirm:null, live_propfirm:null}`.
//
// Quindi chiudendo la prop firm sulla madre, ogni duplicata passa da `live_propfirm` a `live` e
// mostra gli indicatori dell'ALTRO cassetto - vuoto, se non l'ha mai riempito. GLI INDICATORI
// NON SI RESETTANO: SONO NELL'ALTRO CASSETTO. E' la stessa forma del difetto dei modelli dei
// disegni: non una perdita, una chiave che cambia sotto.
//
// SCELTA DEL PROPRIETARIO fra tre strade, 17 novembre 2026: la **C** - «le duplicate seguono la
// madre, e al cambio di modalita' gli indicatori si portano dietro».
//
// LA REGOLA, e il "se" conta: si portano dietro SOLO se la modalita' di destinazione non ha
// indicatori suoi. Se ne ha, sono stati scelti deliberatamente la' e non si sovrascrivono -
// sovrascriverli sarebbe un secondo modo di perdere il proprio lavoro, cioe' lo stesso difetto
// al contrario.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Due indicatori finti NELLA FORMA VERA. La prima stesura di questo banco usava `type:` e
// `serializeIndicators` li scartava tutti (`if(!ind||!ind.key)return;`): la prova restava rossa
// anche con la cura giusta, e la colpa sembrava del codice. Il campo si chiama `key`.
const PREPARA = (conIndicatoriNellaDestinazione) => `(() => {
  liveModeActive = true;
  isPropFirmMode = true;                       // siamo in 'live_propfirm'
  indicatorsByMode = {
    backtest: null,
    live: ${conIndicatoriNellaDestinazione ? "[{key:'sma', id:'suo-1', params:{len:20}}]" : 'null'},
    backtest_propfirm: null,
    live_propfirm: [{key:'ema', id:'mio-1', params:{len:9}}, {key:'rsi', id:'mio-2', params:{len:14}}]
  };
  return {modoPrima: currentMode(), quantiPrima: (indicatorsByMode[currentMode()]||[]).length};
})()`;

// Il messaggio che la madre manda quando chiude la prop firm.
const RICEVI_CHIUSURA = `(() => {
  const modoPrima = currentMode();
  fblApplicaStatoTrading({
    type:'trading_sync', slot:0, at:Date.now(),
    modo:'live', isPropFirmMode:false,
    conto:{vivo:true, vista:'mt5', mt5:null}
  });
  const modoDopo = currentMode();
  const dopo = indicatorsByMode[modoDopo] || [];
  return {modoPrima, modoDopo, quanti: dopo.length, ids: dopo.map(x=>x&&x.id)};
})()`;

test('la madre chiude la prop firm: la duplicata cambia modalità e NON perde gli indicatori', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const prima = await pagina.evaluate(PREPARA(false));
    assert.equal(prima.modoPrima, 'live_propfirm', 'la preparazione deve partire in prop firm');
    assert.equal(prima.quantiPrima, 2, 'la preparazione deve avere due indicatori');

    const r = await pagina.evaluate(RICEVI_CHIUSURA);
    assert.equal(r.modoDopo, 'live', 'la duplicata deve seguire la madre (scelta C)');
    assert.equal(r.quanti, 2,
      'gli indicatori devono portarsi dietro: trovati ' + r.quanti + ' (' + JSON.stringify(r.ids) + ')');
    assert.deepEqual(r.ids, ['mio-1','mio-2'], 'devono essere gli stessi, non altri');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se la modalità di destinazione ha già i suoi indicatori, non si sovrascrivono', async () => {
  // Il "se" della regola. Sovrascrivere il lavoro fatto nell'altra modalita' sarebbe lo stesso
  // difetto al contrario: perdere gli indicatori, solo dall'altro lato.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA(true));
    const r = await pagina.evaluate(RICEVI_CHIUSURA);
    assert.equal(r.modoDopo, 'live');
    assert.deepEqual(r.ids, ['suo-1'],
      'la modalità di destinazione aveva i suoi: devono restare i suoi, non arrivare quelli di prima');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('torna in prop firm: gli indicatori di quella modalità sono ancora i suoi', async () => {
  // Portarsi dietro non vuol dire FONDERE: la modalita' di partenza non perde niente, cosi'
  // andare e tornare non mescola due configurazioni.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA(false));
    await pagina.evaluate(RICEVI_CHIUSURA);
    const r = await pagina.evaluate(`(() => {
      fblApplicaStatoTrading({
        type:'trading_sync', slot:0, at:Date.now(),
        modo:'live_propfirm', isPropFirmMode:true,
        conto:{vivo:true, vista:'mt5', mt5:null}
      });
      const l = indicatorsByMode[currentMode()] || [];
      return {modo: currentMode(), ids: l.map(x=>x&&x.id)};
    })()`);
    assert.equal(r.modo, 'live_propfirm');
    assert.deepEqual(r.ids, ['mio-1','mio-2'], 'la modalità di partenza non deve aver perso niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO: un messaggio che non cambia modalità non tocca niente', async () => {
  // Senza questa, una cura che copia gli indicatori a ogni messaggio del canale passerebbe le
  // prove di sopra e riempirebbe tutte le modalità di copie - rumore che poi va sul cloud.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA(false));
    const r = await pagina.evaluate(`(() => {
      fblApplicaStatoTrading({
        type:'trading_sync', slot:0, at:Date.now(),
        modo:'live_propfirm', isPropFirmMode:true,
        conto:{vivo:true, vista:'mt5', mt5:null}
      });
      return {
        modo: currentMode(),
        live: indicatorsByMode.live,
        propfirm: (indicatorsByMode.live_propfirm||[]).map(x=>x&&x.id),
        backtest: indicatorsByMode.backtest
      };
    })()`);
    assert.equal(r.modo, 'live_propfirm', 'la modalità non deve cambiare');
    assert.equal(r.live, null, 'le altre modalità non devono riempirsi di copie: live = ' + JSON.stringify(r.live));
    assert.equal(r.backtest, null, 'backtest = ' + JSON.stringify(r.backtest));
    assert.deepEqual(r.propfirm, ['mio-1','mio-2']);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
