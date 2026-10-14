// LE BANDIERE DELLE NOTIZIE SI DEVONO VEDERE ANCHE SU TELEFONO E TABLET.
//
// SEGNALATO dal proprietario: «sugli altri dispositivi, telefono e tablet, in fondo alla linea
// temporale le bandiere delle notizie non vengono visualizzate».
//
// LA CAUSA: le bandiere si disegnano solo se `newsEvents` ha qualcosa dentro, e `newsEvents` si
// riempie solo se gira il POLLING. Il polling però partiva da DUE strade sole, e nessuna delle due
// esiste su un telefono:
//   1) il passaggio Storico → Live fatto a mano (switchAccountMode);
//   2) la riconnessione automatica a Capital.com dopo un ricaricamento di pagina — che sul telefono
//      non può avvenire, perché legge le credenziali da una CARTELLA del computer (File System
//      Access API, che su telefono e tablet non esiste).
// In Live da telefono `newsEvents` restava quindi vuoto per sempre.
//
// LA CURA: il polling si allinea da solo allo stato (in Live acceso, fuori spento), ed è chiamato
// da updateLiveModeUI() — l'unico punto che TUTTE le strade attraversano, compreso il ripristino
// della sessione all'avvio, che è la strada del telefono.
//
// Come si prova che il test serve: togliendo la chiamata a newsPollingSincronizza() da
// updateLiveModeUI(), il primo test va rosso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Due notizie vere sulla finestra a grafico, come le manda il ponte.
const PREPARA = (inLive) => {
  const t0 = Date.now() - 100 * 60000;
  const R = [];
  for (let i = 0; i < 100; i++) R.push({date: new Date(t0 + i * 60000).toISOString(),
    open: 100, high: 100.5, low: 99.5, close: 100.2, volume: 5});
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD'; if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = !!inLive; mt5Connected = false; positions = []; trades = []; drawings = [];
  newsEnabled = true;
  newsEvents = [
    {date: new Date(t0 + 40 * 60000).toISOString(), country: 'USD', impact: 'High', title: 'NFP'},
    {date: new Date(t0 + 70 * 60000).toISOString(), country: 'EUR', impact: 'Medium', title: 'CPI'}
  ];
  draw();
};

test('il polling delle notizie si accende da SOLO quando si e in Live, da qualunque strada', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // Si simula la strada del telefono: la sessione viene ripristinata GIA in Live, senza
      // passare da switchAccountMode e senza la riconnessione a Capital.com (che sul telefono
      // non esiste). L unico punto che viene attraversato e updateLiveModeUI().
      stopNewsPolling();
      liveModeActive = true;
      const primaDellAggiornamento = !!newsPollTimer;
      updateLiveModeUI();
      const dopo = !!newsPollTimer;
      // E tornando in Storico si deve spegnere, per non tenere una richiesta al minuto per niente.
      liveModeActive = false;
      updateLiveModeUI();
      const inStorico = !!newsPollTimer;
      return {primaDellAggiornamento, dopo, inStorico};
    });
    assert.equal(r.primaDellAggiornamento, false, 'si parte col polling spento');
    assert.equal(r.dopo, true, 'in Live il polling deve accendersi da solo: e questo che mancava sul telefono');
    assert.equal(r.inStorico, false, 'fuori dal Live si spegne');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('chiamarlo dieci volte non accumula dieci timer', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      stopNewsPolling();
      liveModeActive = true;
      updateLiveModeUI();
      const primo = newsPollTimer;
      for (let i = 0; i < 10; i++) updateLiveModeUI();
      return {stesso: newsPollTimer === primo, acceso: !!newsPollTimer};
    });
    assert.equal(r.acceso, true);
    assert.equal(r.stesso, true, 'il timer deve restare lo stesso: altrimenti si scaricano le notizie dieci volte');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con le notizie in memoria le bandiere si disegnano davvero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      const P = eval('(' + p + ')');
      P(true);
      // Si contano gli EVENTI coperti, non i pallini: due notizie vicine finiscono in un pallino
      // solo (clusterNewsForDisplay), e il punto qui e che siano tutte e due sull asse.
      const eventi = (rr) => rr.reduce((n, x) => n + x.events.length, 0);
      const inLive = eventi(newsDotHitRects);
      P(false);                      // in Storico non si disegnano, come e sempre stato
      const inStorico = eventi(newsDotHitRects);
      return {inLive, inStorico};
    }, PREPARA.toString());
    assert.equal(r.inLive, 2, 'tutte e due le notizie devono finire sull asse del tempo');
    assert.equal(r.inStorico, 0, 'in Storico restano fuori, come prima');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
