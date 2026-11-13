// QUATTRO MODI IN CUI UN CONTO FINIVA ADDOSSO A UN ALTRO (13 novembre 2026).
//
// Tutti e quattro misurati, tutti e quattro con la stessa radice: un pezzo di codice che decide
// «e' roba mia?» guardando troppo poco. Il ticket senza il conto, il conto ignoto trattato come
// «passano tutte», la modalita' mai confrontata.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// ---------------------------------------------------------------------------------------------
// 1. LO STORICO DI UN CONTO NON RISCRIVE LE OPERAZIONI DI UN ALTRO
// ---------------------------------------------------------------------------------------------
test('un deal del conto B non riscrive l operazione del conto A con lo stesso ticket', async () => {
  // I numeri di posizione MT5 sono unici DENTRO un broker, non fra broker: il ticket 101 esiste
  // su MetaQuotes e su FTMO. Misurato il 12 novembre: entry 1.1 -> 1.5, exit 1.102 -> 1.4,
  // pl 10 -> -9999, e poi salvato su disco.
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      trades.length = 0;
      trades.push({id: 'a', asset: 'EURUSD', side: 'BUY', entry: 1.1, exit: 1.102, pl: 10,
                   mode: 'live', mt5Ticket: 101, mt5Login: '11111', mt5Server: 'Broker',
                   closedAt: new Date(Date.now() - 3600000).toISOString()});
      trades.push({id: 'senza', asset: 'EURUSD', side: 'BUY', entry: 1.2, exit: 1.21, pl: 5,
                   mode: 'live', mt5Ticket: 202, mt5Login: null,
                   closedAt: new Date(Date.now() - 3600000).toISOString()});
      // Collegati al conto 22222, e dal suo storico arrivano i deal 101 (suo!) e 202.
      mt5Connected = true;
      mt5ContoAttivo = {login: '22222', server: 'Broker'};
      const deals = [
        {positionId: 101, timeOpen: 1762900000, timeClose: 1762903600,
         priceOpen: 1.5, priceClose: 1.4, profit: -9999, swap: 0, commission: 0},
        {positionId: 202, timeOpen: 1762900000, timeClose: 1762903600,
         priceOpen: 1.2, priceClose: 1.25, profit: 50, swap: 0, commission: 0}
      ];
      let errore = null;
      try { mt5RiallineaTradeNoti(deals); } catch (e) { errore = String(e); }
      const a = trades.find(t => t.id === 'a'), senza = trades.find(t => t.id === 'senza');
      return {errore,
              a: {entry: a.entry, exit: a.exit, pl: a.pl},
              senza: {pl: senza.pl, login: senza.mt5Login}};
    });
    console.log('dopo il riallineamento:', JSON.stringify(r));
    assert.equal(r.errore, null, 'il riallineamento non deve sollevare: ' + r.errore);
    assert.equal(r.a.entry, 1.1, 'l operazione del conto 11111 non si tocca: ' + JSON.stringify(r.a));
    assert.equal(r.a.pl, 10, 'e il suo P/L nemmeno (misurato: diventava -9999)');
    assert.equal(r.senza.pl, 50,
      'un operazione SENZA conto e del conto collegato e si riallinea: ' + JSON.stringify(r.senza));
    assert.equal(r.senza.login, '22222',
      'e le si scrive addosso il conto, cosi domani non e piu ambigua: ' + JSON.stringify(r.senza));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con il conto collegato IGNOTO non si riallinea niente', async () => {
  // «Non lo so» non puo' valere «fai pure», e qui varrebbe «riscrivi i dati salvati».
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      trades.length = 0;
      trades.push({id: 'a', asset: 'EURUSD', side: 'BUY', entry: 1.1, exit: 1.102, pl: 10,
                   mode: 'live', mt5Ticket: 101, mt5Login: '11111', mt5Server: 'Broker',
                   closedAt: new Date(Date.now() - 3600000).toISOString()});
      mt5Connected = true;
      mt5ContoAttivo = null; mt5AccountInfo = null; mt5CredsDraft = null;
      try {
        mt5RiallineaTradeNoti([{positionId: 101, timeOpen: 1762900000, timeClose: 1762903600,
                                priceOpen: 9, priceClose: 9.9, profit: -1234}]);
      } catch (e) {}
      const a = trades.find(t => t.id === 'a');
      return {entry: a.entry, pl: a.pl};
    });
    console.log('conto ignoto:', JSON.stringify(r));
    assert.equal(r.entry, 1.1, 'senza sapere il conto non si tocca niente: ' + JSON.stringify(r));
    assert.equal(r.pl, 10);
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------------------------------------
// 2. LO STORICO A GRAFICO E' SOLO DEL CONTO COLLEGATO
// ---------------------------------------------------------------------------------------------
test('con il conto ignoto, a grafico non finisce lo storico di nessuno', async () => {
  // Richiesta del proprietario: «se sono collegato con l account 1 non posso vedere le posizioni
  // chiuse dell account 2 a grafico». Misurato il 12 novembre con il conto ignoto: 5 operazioni
  // di due conti a grafico e P/L totale 1230, cioe' la somma esatta dei due.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      trades.length = 0;
      const base = {asset: 'EURUSD', side: 'BUY', entry: 1.1, exit: 1.11, mode: 'live',
                    closedAt: new Date(Date.now() - 3600000).toISOString()};
      trades.push({...base, id: 'a1', mt5Ticket: 1, mt5Login: '11111', pl: 30});
      trades.push({...base, id: 'b1', mt5Ticket: 2, mt5Login: '22222', pl: 1200});
      trades.push({...base, id: 'sim', mt5Ticket: null, pl: 7});
      liveModeActive = true; mt5Connected = true;
      const conto = (login) => {
        mt5ContoAttivo = login ? {login, server: 'Broker'} : null;
        if (!login) { mt5AccountInfo = null; mt5CredsDraft = null; }
        return {
          grafico: trades.filter(tradeBelongsToCurrentView).map(t => t.id),
          statistiche: statsTrades().map(t => t.id)
        };
      };
      return {suA: conto('11111'), suB: conto('22222'), ignoto: conto(null)};
    });
    console.log('storico a grafico:', JSON.stringify(r));
    assert.deepEqual(r.suA.grafico, ['a1'], 'sul conto A solo il conto A: ' + JSON.stringify(r.suA));
    assert.deepEqual(r.suB.grafico, ['b1'], 'sul conto B solo il conto B: ' + JSON.stringify(r.suB));
    assert.deepEqual(r.ignoto.grafico, [],
      'con il conto ignoto non si disegna lo storico di nessuno: ' + JSON.stringify(r.ignoto));
    assert.deepEqual(r.ignoto.statistiche, [],
      'e non si sommano i P/L di due conti (misurato: 1230 = 30 + 1200): ' + JSON.stringify(r.ignoto));
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------------------------------------
// 3. UNA FINESTRA IN REPLAY NON SI FA SOVRASCRIVERE DA UNA IN LIVE
// ---------------------------------------------------------------------------------------------
test('la posizione aperta in replay NON sparisce quando parla la finestra in Live', async () => {
  // SEGNALATO: «sulle pagine duplicate, se vado ad aprire una posizione in modalita replay con
  // backtest attivo non me la fa visualizzare e sparisce». La catena misurata: la figlia in
  // Storico non ha un conto MT5, adottava quello della madre, e da li' la guardia diceva «stesso
  // conto» e sostituiva l intero elenco delle posizioni.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      // Io sono la finestra in Storico con il backtest, e ho una posizione simulata mia.
      liveModeActive = false; liveReplayActive = true; mt5Connected = false;
      mt5ContoAttivo = null; mt5AccountInfo = null; mt5CredsDraft = null;
      positions.length = 0;
      positions.push({id: 'mia-backtest', asset: 'EURUSD', side: 'BUY', entry: 1.1, lots: 0.1,
                      startTime: Date.now() - 60000, mt5Ticket: null});
      equity = [10000, 10010];
      const prima = {posizioni: positions.map(p => p.id), equity: equity.slice(),
                     contoMio: JSON.stringify(currentMt5AccountTag())};
      // Arriva lo stato della madre: Live, conto MT5 vero, altre posizioni.
      fblApplicaStatoTrading({
        type: 'trading_sync', slot: 0, modo: 'live',
        positions: [{id: 'della-madre', asset: 'XAUUSD', side: 'SELL', entry: 3900, lots: 0.5,
                     mt5Ticket: 777}],
        pendingOrders: [], trades: [], equity: [50000, 40000, 30000],
        conto: {vivo: true, vista: 'mt5', mt5: {login: '68794', server: 'Broker-Demo'}}
      });
      return {prima, dopo: {posizioni: positions.map(p => p.id), equity: equity.slice(),
                            contoMio: JSON.stringify(currentMt5AccountTag())}};
    });
    console.log('replay vs live:', JSON.stringify(r));
    assert.deepEqual(r.dopo.posizioni, ['mia-backtest'],
      'la posizione aperta nel backtest deve restare, e quella della madre non deve entrare: ' +
      JSON.stringify(r.dopo));
    assert.deepEqual(r.dopo.equity, [10000, 10010],
      'e nemmeno la curva del capitale della madre: ' + JSON.stringify(r.dopo));
    assert.equal(r.dopo.contoMio, '{}',
      'una finestra in Storico non adotta il conto MT5 di nessuno: ' + r.dopo.contoMio);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: due finestre nella STESSA modalita e sullo stesso conto si sincronizzano ancora', async () => {
  // Senza questa, la cura potrebbe essere «non si sincronizza piu' niente», che non e' una cura:
  // le finestre duplicate devono continuare a vedere quello che vede la madre.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      liveModeActive = true; liveReplayActive = false; mt5Connected = true;
      mt5AttivaConto('68794', 'Broker-Demo');
      positions.length = 0;
      fblApplicaStatoTrading({
        type: 'trading_sync', slot: 0, modo: currentMode(),
        positions: [{id: 'della-madre', asset: 'XAUUSD', side: 'SELL', entry: 3900, lots: 0.5,
                     mt5Ticket: 777, mt5Login: '68794', mt5Server: 'Broker-Demo'}],
        pendingOrders: [], trades: [], equity: [12000],
        conto: {vivo: true, vista: 'mt5', mt5: {login: '68794', server: 'Broker-Demo'}}
      });
      return {posizioni: positions.map(p => p.id), equity: equity.slice()};
    });
    console.log('stessa modalita:', JSON.stringify(r));
    assert.deepEqual(r.posizioni, ['della-madre'],
      'stesso conto e stessa modalita: la sincronizzazione deve funzionare come prima: ' +
      JSON.stringify(r));
    assert.deepEqual(r.equity, [12000], 'e anche la curva del capitale');
  } finally { await browser.close(); }
});
