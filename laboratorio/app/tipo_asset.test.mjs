// FOREX, CRIPTO, MATERIA PRIMA, INDICE O AZIONE — scritto dove si legge un'operazione.
//
// RICHIESTO dal proprietario: «negli ordini pendenti aggiungi la colonna Origine, da che sala
// segnale proviene, insieme alla tipologia: se è un forex, una cripto, una materia prima, un
// indice o un'azione. Riportalo sia nel Trade Journal che negli ordini pendenti». E poi: «anche
// nelle posizioni aperte di Kraken».
//
// ATTENZIONE a non confondere due cose con un nome simile: fblFamigliaAsset() torna 'fx' o 'cr'
// ed è quella che SCEGLIE LA STRATEGIA dell'apertura automatica (due famiglie, non cinque).
// fblTipoAsset() serve solo a DIRE cos'è, e per quello serve più fine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('ogni strumento finisce nella sua famiglia', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const t = a => fblTipoAsset(a);
      return {
        // Cripto: si riconosce da una prova vera (esiste un simbolo Binance), non da un elenco.
        btc: t('BTCUSD'), eth: t('ETHUSDT'), bnb: t('BINANCE:BNBUSDT'), kraken: t('PF_XBTUSD'),
        // Materie prime, anche nelle tante forme con cui lo stesso strumento gira.
        oro: t('XAUUSD'), oro2: t('GOLD'), oro3: t('XAU'), argento: t('XAGUSD'), petrolio: t('USOIL'),
        // Indici.
        us30: t('US30'), nas: t('NAS100'), dax: t('GER40'), ftse: t('UK100'),
        // Forex: sei lettere, due valute conosciute.
        eurusd: t('EURUSD'), gbpjpy: t('GBPJPY'), eurusd2: t('EUR/USD'),
        // Azioni: il ripiego, ed è giusto che lo sia.
        aapl: t('AAPL'), tesla: t('TSLA'),
        vuoto: t(''), nullo: t(null)
      };
    });
    assert.equal(r.btc, 'cripto'); assert.equal(r.eth, 'cripto');
    assert.equal(r.bnb, 'cripto'); assert.equal(r.kraken, 'cripto');
    assert.equal(r.oro, 'materia', 'XAUUSD è una materia prima, non una coppia di valute');
    assert.equal(r.oro2, 'materia'); assert.equal(r.oro3, 'materia');
    assert.equal(r.argento, 'materia'); assert.equal(r.petrolio, 'materia');
    assert.equal(r.us30, 'indice'); assert.equal(r.nas, 'indice');
    assert.equal(r.dax, 'indice'); assert.equal(r.ftse, 'indice');
    assert.equal(r.eurusd, 'forex'); assert.equal(r.gbpjpy, 'forex');
    assert.equal(r.eurusd2, 'forex', 'la barra fra le due valute non deve cambiare la risposta');
    assert.equal(r.aapl, 'azione'); assert.equal(r.tesla, 'azione');
    assert.equal(r.vuoto, ''); assert.equal(r.nullo, '');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la scelta della strategia resta a due famiglie: non si confondono', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      // XAUUSD è una materia prima, ma per l'apertura automatica segue la strategia FOREX:
      // sono due domande diverse e devono restare due funzioni diverse.
      oroTipo: fblTipoAsset('XAUUSD'), oroStrategia: fblFamigliaAsset('XAUUSD'),
      btcTipo: fblTipoAsset('BTCUSD'), btcStrategia: fblFamigliaAsset('BTCUSD')
    }));
    assert.equal(r.oroTipo, 'materia');
    assert.equal(r.oroStrategia, 'fx', 'l oro segue la strategia FOREX dell apertura automatica');
    assert.equal(r.btcTipo, 'cripto');
    assert.equal(r.btcStrategia, 'cr');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il riquadro dice il tipo, e dice anche quale strategia segue', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      oro: fblTipoBadgeHtml('XAUUSD'),
      btc: fblTipoBadgeHtml('BTCUSD'),
      niente: fblTipoBadgeHtml(''),
      // Il vecchio nome continua a funzionare: lo chiamano già il pannello dei segnali e il Journal.
      vecchioNome: fblFamigliaBadgeHtml('US30')
    }));
    assert.match(r.oro, /Materia prima/);
    assert.match(r.oro, /strategia FOREX/, 'nel riquadro si deve leggere anche la strategia');
    assert.match(r.btc, /Cripto/);
    assert.match(r.btc, /strategia CRIPTO/);
    assert.equal(r.niente, '', 'senza asset nessun riquadro');
    assert.match(r.vecchioNome, /Indice/, 'il vecchio nome ora mostra la famiglia fine');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la colonna Origine c è in tutte e tre le tabelle, e le celle restano allineate', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const c = (re, cosa) => assert.ok(re.test(src), 'manca: ' + cosa);
  // Ordini pendenti: intestazione + le DUE righe (quelli dell app e quelli reali di MT5). Se una
  // sola delle due avesse la colonna, tutte le sue celle scivolerebbero di un posto.
  c(/<th title="Da quale sala segnali arriva l'ordine[^"]*">Origine<\/th>/, 'intestazione pendenti');
  const celle = src.match(/\$\{journalOrigineHtml\((?:p|o)\)\}\$\{fblTipoBadgeHtml\(ordAsset\)\}/g) || [];
  assert.equal(celle.length, 2,
    'la cella Origine deve esserci in ENTRAMBE le righe degli ordini pendenti: ' + celle.length);
  // Posizioni Kraken: intestazione e cella.
  c(/>Origine<\/th>'\r?\n\s*\+'<th>Side<\/th>/, 'intestazione nelle posizioni Kraken');
  c(/metti\(\{html:\(st&&st\.sala\?escapeHtmlLite\(String\(st\.sala\)\)/, 'cella Origine su Kraken');
  // E i clic su SL/TP non dipendono piu' da numeri scritti a mano: aggiungendo una colonna
  // sarebbero scivolati, e un clic sullo stop avrebbe aperto i target.
  c(/const colSl=metti\(/, 'le colonne Kraken si numerano da sole');
  assert.ok(!/if\(selezionata&&\(col===4\|\|col===5\)\)/.test(src),
    'i numeri di colonna scritti a mano non devono piu esistere');
});

test('l andamento del conto mostra anche il capitale', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  // RICHIESTO: "oltre al P/L cumulato deve mostrarci anche tutto il capitale".
  assert.ok(/l:'capitale dopo questa operazione'/.test(src),
    'manca il capitale nel riquadro dell andamento del conto');
  // Il saldo e' quello congelato nel Journal, non un ricalcolo: due posti non possono raccontare
  // numeri diversi.
  assert.ok(/const _saldo=Number\(r\.t&&r\.t\.account\);/.test(src),
    'il capitale deve venire dal campo gia salvato, non da un ricalcolo');
});
