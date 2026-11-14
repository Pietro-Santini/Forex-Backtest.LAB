// GLI INDICATORI NON POSSONO RESTARE SULL'ASSET PRECEDENTE.
//
// SEGNALATO dal proprietario il 14 novembre 2026, con cinque schermate: «guarda cosa succede
// quando cambiamo asset, tra EUR/USD e XAU/USD: gli indicatori rimangono sull'asset precedente e
// le candele carica quelle dell'asset selezionato, quindi non c'è un aggiornamento al cambio di
// asset ma rimane indietro la parte degli indicatori».
//
// COSA SI VEDEVA NELLE SUE IMMAGINI:
//   - grafico XAU/USD a 3878, tabella ICT «Last Breaker Bearish (1.10)»     <- livelli EUR/USD
//   - grafico EUR/USD a 1.10,  tabella ICT «Last Breaker Bullish (3878.93)» <- livelli oro
//   - in una, la scala verticale da -5083 a +8094, per tenere dentro i disegni dei due insieme.
//
// LE DUE CAUSE, tutte e due necessarie:
//
// 1) LA TARGA DELLA SERIE USAVA L'ASSET SCELTO, NON QUELLO DEI DATI. `rowsSerie()` conteneva
//    `currentAssetKey`, che passa al nuovo asset SUBITO mentre le candele arrivano dopo. Quindi:
//    al cambio la targa cambiava e l'indicatore si ricalcolava sulle candele VECCHIE, salvando
//    quello stato sotto la targa NUOVA; poi arrivavano le candele giuste, ma asset, timeframe e
//    data della prima candela erano identici (due storici da un minuto partono dallo stesso
//    istante), la targa NON cambiava, e l'indicatore non si ricalcolava mai piu'.
//    E' questo che rendeva il difetto permanente invece che passeggero.
//
// 2) SI CALCOLAVA ANCHE QUANDO LE CANDELE ERANO DI UN ALTRO ASSET. Ora il disegno degli
//    indicatori si salta finche' `rowsAssetKey` non combacia con l'asset scelto: meglio un
//    grafico senza indicatori per un istante che indicatori di un altro strumento, perche'
//    quelli si leggono come veri e ci si opera sopra.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const RADICE = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

test('la targa della serie segue i DATI, non la scelta nel menu', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      // Due storici che partono dallo stesso istante: e' il caso vero, ed e' quello che
      // rendeva la targa cieca.
      const stessaPartenza = [{date: '2026-11-13 00:00', open: 1, high: 1, low: 1, close: 1}];
      baseRows = stessaPartenza;
      currentTF = 1;

      rowsAssetKey = 'EURUSD';
      currentAssetKey = 'EURUSD';
      const aEurusd = rowsSerie();

      // IL MOMENTO DEL DIFETTO: l'utente ha scelto l'oro, ma in memoria ci sono ancora le
      // candele di EUR/USD.
      currentAssetKey = 'XAUUSD';
      const durante = rowsSerie();

      // Arrivano le candele dell'oro, con la stessa data di partenza.
      rowsAssetKey = 'XAUUSD';
      const aOro = rowsSerie();

      return {aEurusd, durante, aOro};
    });
    console.log('targhe:', JSON.stringify(r));
    assert.equal(r.durante, r.aEurusd,
      'finche in memoria ci sono le candele di EUR/USD la targa NON deve cambiare: se cambia, ' +
      'l indicatore si ricalcola sui dati vecchi e salva quel risultato sotto il nome del nuovo ' +
      'asset. Targhe: ' + JSON.stringify(r));
    assert.notEqual(r.aOro, r.aEurusd,
      'quando arrivano davvero le candele dell oro la targa DEVE cambiare, altrimenti ' +
      'l indicatore non si ricalcola mai piu e resta sui livelli di EUR/USD per sempre - che e ' +
      'il difetto delle cinque schermate. Targhe: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('due storici con la stessa data di partenza restano DUE serie diverse', async () => {
  // La prova che inchioda il meccanismo: prima dell 14 novembre la targa di questi due casi era
  // identica, ed e' per questo che il difetto non si correggeva da solo.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      baseRows = [{date: '2026-11-13 00:00', open: 1, high: 1, low: 1, close: 1}];
      currentTF = 1;
      currentAssetKey = 'XAUUSD';          // scelto: lo stesso in tutti e due i casi
      rowsAssetKey = 'EURUSD';
      const conCandeleEurusd = rowsSerie();
      rowsAssetKey = 'XAUUSD';
      const conCandeleOro = rowsSerie();
      return {conCandeleEurusd, conCandeleOro};
    });
    console.log('stessa partenza:', JSON.stringify(r));
    assert.notEqual(r.conCandeleEurusd, r.conCandeleOro,
      'stesso asset scelto, stesso timeframe, stessa data della prima candela: se la targa non ' +
      'distingue a CHI appartengono le candele, i due casi sono indistinguibili e l indicatore ' +
      'tiene lo stato sbagliato. ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('con le candele di un altro asset gli indicatori non si disegnano proprio', () => {
  // Si legge il sorgente perche' la garanzia e' «non viene fatto»: il calcolo e il disegno degli
  // indicatori stanno dietro al controllo che le candele siano dell asset giusto.
  const sorgente = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  assert.ok(
    sorgente.includes('if(activeIndicators.length && (!rowsAssetKey || !currentAssetKey || rowsAssetKey===currentAssetKey)){'),
    'il blocco che calcola e disegna gli indicatori deve stare dietro al controllo che le ' +
    'candele appartengano all asset scelto');
});
