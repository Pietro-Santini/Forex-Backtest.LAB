// QUANDO È STATA ESEGUITA: l'orario nelle tabelle.
//
// RICHIESTO dal proprietario: «nelle posizioni aperte, sia per Kraken che per MT5 e anche gli
// ordini pendenti, ci mettiamo l'orario di esecuzione, quindi quando è stato messo all'interno
// della tabella, sia per gli ordini pendenti che per gli ordini a mercato».
//
// DUE SCELTE che questi test tengono ferme:
//   - quando l'orario non si SA si scrive «—», non «adesso». Un orario inventato è falso e per
//     giunta credibile: è lo stesso errore che spostava le posizioni a un'ora qualunque (v163);
//   - MT5 manda i secondi, il resto dell'app i millisecondi. Convertirli a mano in ogni punto è il
//     modo più sicuro per dimenticarsene e ritrovarsi una data del 1970.
//
// E UNA LEZIONE (v166): i test dell'orario che si limitavano a contare quante volte
// «fblOrarioEsecuzione(...)» compare nel sorgente sono passati mentre la riga raggruppata aveva le
// due celle SCAMBIATE (l'orario sotto «Asset», l'asset sotto «Eseguita»). Contare le celle non
// dice DOVE stanno. Da qui in giù si rende la tabella vera e si legge ogni cella SOTTO LA SUA
// INTESTAZIONE.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('secondi o millisecondi: una funzione sola a deciderlo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      const ms = Date.UTC(2026, 9, 15, 20, 0, 0);
      ({daMs: fblMsDaOrario(ms),
        daSecondi: fblMsDaOrario(Math.round(ms/1000)),
        zero: fblMsDaOrario(0), nulla: fblMsDaOrario(null),
        testo: fblMsDaOrario('boh'), negativo: fblMsDaOrario(-5), atteso: ms})
    }`);
    assert.equal(r.daMs, r.atteso);
    assert.equal(r.daSecondi, r.atteso, 'i secondi di MT5 diventano millisecondi da soli');
    assert.equal(r.zero, null, 'zero non è un orario: sarebbe il 1970');
    assert.equal(r.nulla, null);
    assert.equal(r.testo, null);
    assert.equal(r.negativo, null);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza orario si scrive «—», non si inventa adesso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`({
      nulla: fblOrarioEsecuzione(null), zero: fblOrarioEsecuzione(0),
      testo: fblOrarioEsecuzione('boh'),
      titolo: fblOrarioEsecuzioneTitolo(null)
    })`);
    assert.equal(r.nulla, '—');
    assert.equal(r.zero, '—');
    assert.equal(r.testo, '—');
    assert.match(r.titolo, /non disponibile/, 'e il suggerimento dice che non si sa');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('oggi si scrive solo l\'ora, un altro giorno anche la data', async () => {
  // In una tabella che si guarda di continuo la data di oggi su ogni riga è rumore; su una
  // posizione di tre giorni fa l'ora da sola inganna.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      const adesso = new Date();
      const oggi = new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate(), 14, 35, 0).getTime();
      const treGiorniFa = oggi - 3*24*3600*1000;
      ({oggi: fblOrarioEsecuzione(oggi), prima: fblOrarioEsecuzione(treGiorniFa)})
    }`);
    assert.match(r.oggi, /^\d{2}:\d{2}$/, 'oggi: solo ora e minuti — ' + r.oggi);
    assert.match(r.prima, /^\d{2}\/\d{2} \d{2}:\d{2}$/, 'altro giorno: anche la data — ' + r.prima);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// Cinque posizioni dello stesso segnale sull'asset a grafico: nella tabella stanno in UNA riga
// raggruppata. È proprio lì che il v166 aveva orario e asset scambiati.
const PREPARA_GRUPPO = () => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++) {
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: 100, high: 100.5, low: 99.5, close: 100.2, volume: 5});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD'; if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; mt5Connected = false;
  trades = []; active = null; positions = [];
  const quando = Date.now() - 3600 * 1000;   // un'ora fa: oggi, quindi solo ora e minuti
  for (let i = 0; i < 5; i++) positions.push({
    id: 'P' + i, asset: 'EURUSD', side: 'BUY', entry: 100, sl: 99, rrSl: 99, tp: 101 + i,
    lots: 0.1, marginUsed: 10, start: 10, startTime: quando, openTime: quando,
    tgSala: 'Gold Signals VIP', tgGruppo: 'sgTEST', tgTpIndice: i + 1
  });
  update();
};

test('nella riga raggruppata l\'asset sta sotto «Asset» e l\'orario sotto «Eseguita»', async () => {
  // LE CELLE SI LEGGONO PER NOME DI COLONNA. Leggerle per numero è la stessa fragilità che l'app
  // aveva dentro: aggiungendo una colonna ogni numero scivola di un posto, e il test si mette a
  // misurare la cella sbagliata. Prima della correzione questa prova era ROSSA: sotto «Asset»
  // trovava l'orario.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const tab = document.getElementById('openPositions').closest('table');
      const nomi = [...tab.querySelectorAll('thead th')].map(t => t.textContent.trim());
      const riga = document.querySelector('#openPositions tr.fblPosGruppo');
      if (!riga) return {manca: true, nomi};
      const celle = [...riga.querySelectorAll('td')].map(t => t.textContent.trim());
      const sotto = n => celle[nomi.indexOf(n)];
      return {asset: sotto('Asset'), eseguita: sotto('Eseguita'), nomi};
    }, PREPARA_GRUPPO.toString());
    assert.ok(!r.manca, 'le cinque posizioni devono fare una riga raggruppata');
    assert.ok(r.nomi.includes('Asset') && r.nomi.includes('Eseguita'),
      'mancano le intestazioni: ' + r.nomi.join(' | '));
    assert.equal(r.asset, 'EURUSD', 'sotto «Asset» ci deve stare l\'asset, non l\'orario');
    assert.match(r.eseguita, /\d{2}:\d{2}/, 'sotto «Eseguita» ci deve stare un orario: ' + r.eseguita);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// Un ordine pendente messo dall'app: ha `createdAt` (o `mt5AddedAt` se reale su MT5), NON
// `startTime` come le posizioni. È il campo che il v166 leggeva sbagliato, lasciando «—».
const PREPARA_PENDENTE = () => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
  for (let i = 0; i < 200; i++) {
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: 100, high: 100.5, low: 99.5, close: 100.2, volume: 5});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'EURUSD'; if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  liveModeActive = false; mt5Connected = false;
  trades = []; active = null; positions = [];
  pendingOrders = [{id: 'pend1', createdAt: Date.now() - 3600 * 1000, asset: 'EURUSD', side: 'BUY',
    kind: 'LIMIT', entry: 99, sl: 98, tp: 101, lots: 0.1}];
  update();
};

test('un ordine pendente messo dall\'app mostra in «Messo» l\'orario in cui è stato messo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const tab = document.getElementById('pendingOrdersTbl').closest('table');
      const nomi = [...tab.querySelectorAll('thead th')].map(t => t.textContent.trim());
      const riga = document.querySelector('#pendingOrdersTbl tr');
      if (!riga) return {manca: true, nomi};
      const celle = [...riga.querySelectorAll('td')].map(t => t.textContent.trim());
      return {messo: celle[nomi.indexOf('Messo')], asset: celle[nomi.indexOf('Asset')]};
    }, PREPARA_PENDENTE.toString());
    assert.ok(!r.manca, 'l\'ordine pendente deve comparire nella tabella');
    assert.match(r.messo, /\d{2}:\d{2}/, 'la colonna «Messo» deve dire quando l\'ordine è stato messo: ' + r.messo);
    assert.equal(r.asset, 'EURUSD');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
