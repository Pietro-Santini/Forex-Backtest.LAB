// UNA FINESTRA APPENA APERTA NON DEVE CANCELLARE LE POSIZIONI DELLE ALTRE.
//
// SEGNALATO dal proprietario (4 novembre 2026), e una causa sola spiegava quattro cose insieme:
// «quando clicchiamo il pulsante duplica finestra, i parametri di prezzo attuale, P/L live… non
// ci visualizza più le posizioni a grafico… sulla seconda finestra, se abbiamo delle posizioni
// aperte, in realtà non ci fa vedere più proprio nulla, non ci aggiorna nulla… è come se cercasse
// di caricare le posizioni esistenti sulla pagina madre e caricarle sulla seconda finestra, e va
// in conflitto: appare poi scompare, appare scompare di continuo».
//
// CAUSA MISURATA. Una finestra duplicata nasce VUOTA per scelta esplicita: non ripristina da
// disco (vedi initSession, `if(PIP_SLOT>0){ await initExtraPipWindow(); return; }`). Ma
// `scheduleSave()` annuncia lo stato del conto alle altre finestre a OGNI singola azione, e
// durante l'avvio di azioni ce ne sono molte — tutte PRIMA che arrivi la risposta alla richiesta
// dello stato. Quindi la finestra nuova annunciava `positions: []`, e il gestore all'altro capo
// fa `positions = msg.positions`: **la madre cancellava le sue posizioni**. Poi la madre le
// riannunciava, la nuova le riceveva, e intanto ne annunciava altre vuote — da qui l'apparire e
// scomparire continuo che il proprietario descrive.
//
// E SPIEGA ANCHE IL RESTO: il P/L live, il prezzo attuale e il margine libero della mini
// dashboard si calcolano DALLE POSIZIONI. Senza posizioni non mostrano niente — non erano rotti
// loro.
//
// LA REGOLA: si parla solo se si ha qualcosa da dire. Uno stato vuoto, da chi non ha mai ricevuto
// niente, non è un'informazione: è una cancellazione.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const CON_POSIZIONI = `
  positions.length=0;
  positions.push({id:'p1',asset:'EURUSD',side:'BUY',entry:1.1,sl:1.09,tp:1.11,lots:0.1,createdAt:1});
  positions.push({id:'p2',asset:'EURUSD',side:'SELL',entry:1.1,sl:1.11,tp:1.09,lots:0.2,createdAt:2});
`;

test('la madre non perde le posizioni quando una finestra vuota annuncia il suo stato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      ${CON_POSIZIONI}
      if(typeof tradingChannel==='undefined'||!tradingChannel||typeof tradingChannel.onmessage!=='function')
        return {canale:false};
      // Esattamente quello che mandava una finestra duplicata appena aperta.
      tradingChannel.onmessage({data:{type:'trading_sync',slot:2,at:Date.now(),
        positions:[],pendingOrders:[],trades:[],equity:[]}});
      return {canale:true, quante:positions.length, quali:positions.map(p=>p.id)};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.ok(r.canale, 'il canale fra finestre non è attivo: questa prova misurerebbe il vuoto');
    assert.equal(r.quante, 2,
      'le posizioni della madre non devono sparire: invece ne sono rimaste ' + r.quante);
    assert.deepEqual(r.quali, ['p1', 'p2']);
  } finally { await browser.close(); }
});

// E L'ALTRA METÀ: una finestra che NON ha ancora ricevuto niente e non ha niente di suo deve
// TACERE. È qui che si rompeva la catena.
test('una finestra duplicata appena aperta e vuota non annuncia niente', async () => {
  const {browser, pagina, errori} = await apriApp({query: '?pipSlot=2'});
  try {
    await pagina.waitForTimeout(2000);
    const r = await pagina.evaluate(`(function(){
      if(typeof tradingChannel==='undefined'||!tradingChannel)return {canale:false};
      const mandati=[];
      tradingChannel.postMessage=function(m){ mandati.push(m); };
      positions.length=0; pendingOrders.length=0; trades.length=0;
      tradingSyncRicevuto=false;           // come appena aperta: non sa ancora niente
      broadcastTradingStateNow();
      return {canale:true, slot:PIP_SLOT, mandati:mandati.map(m=>m&&m.type)};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.ok(r.canale, 'il canale fra finestre non è attivo');
    assert.equal(r.slot, 2, 'questa prova deve girare in una finestra duplicata');
    assert.deepEqual(r.mandati, [],
      'una finestra che non sa niente e non ha niente non deve annunciare uno stato vuoto');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO numero uno: appena ha RICEVUTO lo stato, la finestra duplicata deve poter
// parlare — anche per dire «non ci sono più posizioni», perché una posizione chiusa da qui deve
// svuotare la lista anche sulle altre. Senza questa, il silenzio diventerebbe permanente.
test('PROVA DI CONTROLLO: ricevuto lo stato, la finestra duplicata annuncia di nuovo', async () => {
  const {browser, pagina, errori} = await apriApp({query: '?pipSlot=2'});
  try {
    await pagina.waitForTimeout(2000);
    const r = await pagina.evaluate(`(function(){
      const mandati=[];
      tradingChannel.postMessage=function(m){ mandati.push(m); };
      positions.length=0; pendingOrders.length=0; trades.length=0;
      tradingSyncRicevuto=false;
      // La madre risponde alla richiesta: da qui questa finestra SA.
      tradingChannel.onmessage({data:{type:'trading_sync',slot:0,at:Date.now(),
        positions:[{id:'m1',asset:'EURUSD',side:'BUY',entry:1.1,sl:1.09,tp:1.11,lots:0.1}],
        pendingOrders:[],trades:[],equity:[]}});
      const ricevute=positions.length;
      // Ora chiude la posizione qui, e la lista vuota DEVE viaggiare.
      positions.length=0;
      mandati.length=0;
      broadcastTradingStateNow();
      return {ricevute, ricevuto:tradingSyncRicevuto, mandati:mandati.map(m=>m&&m.type)};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.ricevute, 1, 'la finestra duplicata deve ricevere le posizioni della madre');
    assert.equal(r.ricevuto, true);
    assert.deepEqual(r.mandati, ['trading_sync'],
      'dopo aver ricevuto, anche una lista vuota è un\'informazione vera e deve viaggiare');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO numero due: una finestra che non ha ricevuto niente ma ha una posizione
// APERTA DA LEI deve annunciarla. Senza questa, una posizione aperta nella finestra duplicata non
// arriverebbe mai alla pagina madre — ed è proprio quello che il proprietario vuole che accada.
test('PROVA DI CONTROLLO: una posizione aperta nella finestra duplicata arriva comunque', async () => {
  const {browser, pagina, errori} = await apriApp({query: '?pipSlot=2'});
  try {
    await pagina.waitForTimeout(2000);
    const r = await pagina.evaluate(`(function(){
      const mandati=[];
      tradingChannel.postMessage=function(m){ mandati.push(m); };
      tradingSyncRicevuto=false;           // non ha ancora saputo niente da nessuno
      positions.length=0;
      positions.push({id:'mia',asset:'EURUSD',side:'BUY',entry:1.1,sl:1.09,tp:1.11,lots:0.1});
      broadcastTradingStateNow();
      return {mandati:mandati.map(m=>m&&m.type),
              posizioniMandate:(mandati[0]&&mandati[0].positions||[]).map(p=>p.id)};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.deepEqual(r.mandati, ['trading_sync'],
      'chi ha qualcosa di suo da dire parla, anche se non ha ancora ricevuto niente');
    assert.deepEqual(r.posizioniMandate, ['mia'],
      'e la posizione aperta qui deve arrivare alla pagina madre');
  } finally { await browser.close(); }
});

// LA TARGHETTA «PIP 2» NON DEVE PIÙ ESISTERE.
// «Quello togliamolo, non serve assolutamente niente… non devono chiamarsi PIP2, PIP3, PIP4.»
test('nella finestra duplicata non c\'è nessuna targhetta «PIP»', async () => {
  const {browser, pagina, errori} = await apriApp({query: '?pipSlot=2', altezza: 800});
  try {
    await pagina.waitForTimeout(2500);
    const r = await pagina.evaluate(`(function(){
      const cw=document.querySelector('.chartWrap');
      return {
        targhetta: !!document.getElementById('fbPipChartOnlyBadge'),
        scrittaPip: /PIP\\s*2/.test(document.body.innerText||''),
        altezzaGrafico: cw?Math.round(cw.getBoundingClientRect().height):0
      };
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.targhetta, false, 'la banderuola «PIP 2 — solo grafico…» non deve esserci');
    assert.equal(r.scrittaPip, false, 'e non deve comparire la scritta «PIP 2» da nessuna parte');
    // I 24 px che la banderuola occupava tornano al grafico: erano una striscia vuota rubata.
    assert.ok(r.altezzaGrafico > 780,
      'senza la banderuola il grafico prende tutta l\'altezza (' + r.altezzaGrafico + 'px su 800)');
  } finally { await browser.close(); }
});

// ====== AL CAMBIO ASSET NON SI PRESELEZIONA NESSUNA POSIZIONE ======
//
// SEGNALATO dal proprietario (4 novembre 2026): «quando selezioniamo l'asset dove ci sono aperte
// le posizioni, prova a ricaricare sempre l'ultima posizione aperta, quella dei dati di take
// profit e stop loss dell'ultima posizione aperta, cosa che invece assolutamente non deve fare».
//
// COM'ERA: quattro punti del file facevano, identici, `active = l'ULTIMA posizione di questo
// asset` e poi riempivano le caselle Stop Loss e Take Profit con i SUOI valori. Scegliere per
// l'utente quale posizione sta modificando — e metterne i livelli nelle caselle da cui parte il
// prossimo ordine — è una decisione che non spetta al programma: su un conto vero quei numeri
// diventano un ordine.
//
// LE POSIZIONI NON SI TOCCANO: restano tutte aperte e tutte disegnate. È la selezione che
// scompare, non le operazioni.
test('cambiando asset non si seleziona nessuna posizione e le caselle si svuotano', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      positions.length=0;
      positions.push({id:'a1',asset:'EURUSD',side:'BUY',entry:1.1,sl:1.09,tp:1.11,lots:0.1});
      positions.push({id:'a2',asset:'EURUSD',side:'BUY',entry:1.1,sl:1.095,tp:1.115,lots:0.1});
      active=positions[1];
      let svuotate=0;
      const vera=window.clearDraftTradeLevelFields;
      clearDraftTradeLevelFields=function(){ svuotate++; };
      const dopo=fblAssetCambiatoAzzeraSelezione(true);
      clearDraftTradeLevelFields=vera;
      return {selezionata:dopo, attiva:active, svuotate, quantePosizioni:positions.length};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.selezionata, null, 'nessuna posizione deve risultare selezionata');
    assert.equal(r.attiva, null);
    assert.equal(r.svuotate, 1, 'le caselle SL/TP vanno svuotate, o restano i numeri dell\'altro asset');
    assert.equal(r.quantePosizioni, 2,
      'le POSIZIONI non si toccano: restano tutte aperte, è la selezione che scompare');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO, e non è un dettaglio: questa strada viene percorsa anche dal refresh del
// grafico Live, circa ogni secondo. Svuotare le caselle a ogni giro cancellerebbe una bozza di
// ordine che l'utente sta ancora componendo — un difetto già curato in passato, da non far
// tornare.
test('PROVA DI CONTROLLO: se l\'asset non è cambiato non si tocca niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      positions.length=0;
      positions.push({id:'b1',asset:'EURUSD',side:'BUY',entry:1.1,sl:1.09,tp:1.11,lots:0.1});
      active=positions[0];
      let svuotate=0;
      const vera=window.clearDraftTradeLevelFields;
      clearDraftTradeLevelFields=function(){ svuotate++; };
      const dopo=fblAssetCambiatoAzzeraSelezione(false);
      clearDraftTradeLevelFields=vera;
      return {restaSelezionata:dopo&&dopo.id, svuotate};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.restaSelezionata, 'b1',
      'col refresh dello stesso asset la selezione resta dov\'era');
    assert.equal(r.svuotate, 0,
      'e le caselle non si svuotano: ci potrebbe essere una bozza di ordine in composizione');
  } finally { await browser.close(); }
});

// ====== FRA FINESTRE VIAGGIA ANCHE IL CONTO REALE ======
//
// SEGNALATO dal proprietario (5 novembre 2026), dopo la cura della cancellazione: «la pagina
// duplicata presenta ancora gli stessi sintomi di prima, non è cambiato nulla». E alla domanda se
// gli ordini pendenti fossero simulati o reali: «sono ordini reali». Quella risposta ha chiuso il
// cerchio.
//
// CAUSA. Il messaggio fra finestre usava `stripMt5TrackedForSave()`, che TOGLIE tutto quello che
// ha un `mt5Ticket` — cioè ogni posizione e ogni ordine VERO del conto. Alla finestra duplicata
// non arrivava mai niente di reale: restava vuota **per costruzione**. La cancellazione curata
// prima era un difetto in più, non questo — ed è per questo che per lui «non è cambiato nulla».
//
// PERCHÉ QUELLA FUNZIONE ESISTE, e perché lì non andava usata: il nome lo dice, «ForSave». Serve a
// non SALVARE su disco e in cloud le posizioni reali, che appartengono al broker e si rileggono da
// MT5 — una copia vecchia salvata ieri sarebbe una bugia. Ma fra due finestre della STESSA
// macchina, sullo STESSO conto, nello stesso momento, non c'è niente da proteggere.
test('il messaggio fra finestre porta anche le posizioni e gli ordini REALI', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      positions.length=0; pendingOrders.length=0;
      positions.push({id:'sim',asset:'EURUSD',side:'BUY',entry:1.1,sl:1.09,tp:1.11,lots:0.1});
      positions.push({id:'reale',asset:'EURUSD',side:'SELL',entry:1.1,sl:1.11,tp:1.09,lots:0.2,mt5Ticket:111});
      pendingOrders.push({id:'pendSim',asset:'EURUSD',side:'BUY',entry:1.098,lots:0.1});
      pendingOrders.push({id:'pendReale',asset:'EURUSD',side:'BUY',entry:1.097,lots:0.1,mt5Ticket:222});
      const p=collectTradingSyncPayload();
      return {posizioni:p.positions.map(x=>x.id), pendenti:p.pendingOrders.map(x=>x.id)};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.deepEqual(r.posizioni, ['sim', 'reale'],
      'anche la posizione reale deve viaggiare: invece ' + JSON.stringify(r.posizioni));
    assert.deepEqual(r.pendenti, ['pendSim', 'pendReale'],
      'anche l\'ordine pendente reale deve viaggiare: invece ' + JSON.stringify(r.pendenti));
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO, e non è un dettaglio: il filtro deve RESTARE dove serve. Le posizioni reali
// appartengono al broker e si rileggono da MT5: salvarne una copia su disco o in cloud vorrebbe
// dire ritrovarsi domani una posizione che non esiste più, con i prezzi di ieri.
test('PROVA DI CONTROLLO: nel pacchetto che si SALVA le posizioni reali restano fuori', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      positions.length=0; pendingOrders.length=0;
      positions.push({id:'sim',asset:'EURUSD',side:'BUY',entry:1.1,sl:1.09,tp:1.11,lots:0.1});
      positions.push({id:'reale',asset:'EURUSD',side:'SELL',entry:1.1,sl:1.11,tp:1.09,lots:0.2,mt5Ticket:111});
      pendingOrders.push({id:'pendReale',asset:'EURUSD',side:'BUY',entry:1.097,lots:0.1,mt5Ticket:222});
      const b=collectLightSessionState();
      return {posizioni:(b.positions||[]).map(x=>x.id), pendenti:(b.pendingOrders||[]).map(x=>x.id)};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.deepEqual(r.posizioni, ['sim'],
      'nel salvataggio la posizione reale NON deve entrare: ' + JSON.stringify(r.posizioni));
    assert.deepEqual(r.pendenti, [],
      'e nemmeno l\'ordine pendente reale: ' + JSON.stringify(r.pendenti));
  } finally { await browser.close(); }
});
