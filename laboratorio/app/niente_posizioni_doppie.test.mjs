// DUE POSIZIONI CON LO STESSO TICKET NON POSSONO ESISTERE.
//
// SEGNALATO dal proprietario il 13 novembre 2026, con lo screenshot davanti: «ho aperto solamente
// una posizione in sell, ma in realta' me ne avrei due. E se vado a vedere sul terminale MT5, in
// effetti c'e' soltanto una posizione. E' come se prendesse un doppione della stessa posizione,
// che in realta' non esiste. Succede anche con le posizioni aperte in automatico dalle sale
// segnali: a volte le raddoppia o le triplica».
//
// Un ticket MT5 identifica UNA posizione su quel conto. Due righe con lo stesso numero vogliono
// dire che una e' un fantasma - e un fantasma non e' un problema estetico: entra nei conti del
// margine, nei tetti dell'apertura automatica («quante ne ho gia' aperte»), nel P/L mostrato e
// nelle statistiche.
//
// Le strade che aggiungono una posizione sono nove. Invece di indovinare quale si e' inceppata,
// la porta e' diventata una sola (fblAggiungiPosizione) e il controllo sta li'. Queste prove
// misurano la porta, e poi che le strade ci passino davvero.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const RADICE = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

test('lo stesso ticket aggiunto due volte resta UNA posizione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      positions.length = 0;
      const a = {id: 'a', asset: 'XAUUSD', side: 'SELL', entry: 3883, lots: 0.15, mt5Ticket: 777};
      const b = {id: 'b', asset: 'XAUUSD', side: 'SELL', entry: 3883, lots: 0.15, mt5Ticket: 777};
      const primo = fblAggiungiPosizione(a);
      const secondo = fblAggiungiPosizione(b);
      return {quante: positions.length, idRimasto: positions[0].id,
              primoEIlSecondo: primo === secondo};
    });
    console.log('doppione:', JSON.stringify(r));
    assert.equal(r.quante, 1, 'il ticket 777 non puo stare in elenco due volte: ' + JSON.stringify(r));
    assert.equal(r.idRimasto, 'a', 'resta la prima, che e quella che il resto dell app conosce gia');
    assert.equal(r.primoEIlSecondo, true,
      'e chi chiama deve ricevere la posizione VERA, non una copia buttata via: cosi puo ' +
      'continuare a lavorarci senza accorgersi di niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la seconda chiamata non si perde: riempie i campi che mancavano', async () => {
  // La seconda chiamata spesso porta un dato migliore della prima (l'orario vero del broker, lo
  // stop, la sala del segnale). Scartarla del tutto sarebbe curare un difetto creandone un altro.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      positions.length = 0;
      fblAggiungiPosizione({id: 'a', asset: 'XAUUSD', side: 'SELL', entry: 3883, lots: 0.15,
                            mt5Ticket: 777, sl: null, tgSala: null});
      fblAggiungiPosizione({id: 'b', asset: 'XAUUSD', side: 'SELL', entry: 3883, lots: 0.15,
                            mt5Ticket: 777, sl: 3886.14, tgSala: 'Sala X', startTime: 1762900000000});
      const p = positions[0];
      return {quante: positions.length, sl: p.sl, sala: p.tgSala, entry: p.entry};
    });
    console.log('campi riempiti:', JSON.stringify(r));
    assert.equal(r.quante, 1, 'sempre una sola');
    assert.equal(r.sl, 3886.14, 'lo stop che mancava arriva dalla seconda: ' + JSON.stringify(r));
    assert.equal(r.sala, 'Sala X', 'e anche la sala del segnale');
    assert.equal(r.entry, 3883, 'ma un campo che c era gia non viene sovrascritto');
  } finally { await browser.close(); }
});

test('le posizioni SIMULATE non vengono toccate: due sono due', async () => {
  // Senza ticket non c'e' niente che le identifichi come la stessa cosa, e due ordini uguali
  // aperti davvero devono restare due. La cura non puo' diventare «ne mostro una sola».
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      positions.length = 0;
      fblAggiungiPosizione({id: 's1', asset: 'XAUUSD', side: 'BUY', entry: 3880, lots: 0.1, mt5Ticket: null});
      fblAggiungiPosizione({id: 's2', asset: 'XAUUSD', side: 'BUY', entry: 3880, lots: 0.1, mt5Ticket: null});
      return {quante: positions.length};
    });
    console.log('simulate:', JSON.stringify(r));
    assert.equal(r.quante, 2,
      'due posizioni simulate identiche sono due posizioni: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('e due ticket DIVERSI restano due posizioni', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      positions.length = 0;
      fblAggiungiPosizione({id: 'a', asset: 'XAUUSD', side: 'SELL', entry: 3883, lots: 0.15, mt5Ticket: 777});
      fblAggiungiPosizione({id: 'b', asset: 'XAUUSD', side: 'SELL', entry: 3883, lots: 0.15, mt5Ticket: 778});
      return {quante: positions.length};
    });
    assert.equal(r.quante, 2, 'due ticket diversi sono due posizioni vere: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('NESSUNA strada aggiunge posizioni scavalcando la porta', () => {
  // La prova che tiene insieme tutte le altre: se domani qualcuno rimette un positions.push
  // diretto, il controllo del ticket non lo vedrebbe nemmeno. Si legge il sorgente perche' e'
  // l'unico modo di dire «non esiste un'altra strada», che e' proprio cio' che si vuole
  // garantire - e si legge da qui, non dalla pagina: un file:// non si puo' fetchare.
  const testo = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const diretti = (testo.match(/(?<![.\w])positions\.push\(/g) || []).length;
  const dallaPorta = (testo.match(/fblAggiungiPosizione\(/g) || []).length;
  console.log('strade:', JSON.stringify({diretti, dallaPorta}));
  assert.equal(diretti, 0,
    'nessun positions.push diretto: si passa da fblAggiungiPosizione, altrimenti il controllo ' +
    'del ticket non vede niente. Trovati: ' + diretti);
  assert.ok(dallaPorta >= 8, 'e la porta deve essere usata da tutte le strade: ' + dallaPorta);
});
