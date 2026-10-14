// QUALI SALE RENDONO DI PIÙ QUANDO ESCONO LE NOTIZIE IMPORTANTI.
//
// RICHIESTO dal proprietario: «inseriamo anche una statistica delle sale segnali più profittevoli
// nei momenti in cui arrivano le notizie, quelle in rosso, dove a ogni sala attribuiamo le valute,
// la gravità eccetera. Così nella dashboard vediamo quali sale sono più profittevoli quando escono
// notizie importanti, e calcoliamo chi prende più operazioni con queste notizie e chi invece è
// meno profittevole».
//
// PERCHÉ SERVIVA UN ARCHIVIO: `newsEvents` è l'ULTIMA fotografia del calendario (la settimana in
// corso) e viene sostituita ad ogni aggiornamento. Per dire se un trade di tre settimane fa è nato
// sotto una notizia importante, quella notizia bisogna averla conservata. Stessa idea
// dell'archivio del footprint.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('le valute di un asset: il calendario parla per valuta, gli asset no', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      eurusd: fblValuteDiAsset('EURUSD'),
      xauusd: fblValuteDiAsset('XAUUSD'),
      btcusdt: fblValuteDiAsset('BTCUSDT'),
      gbpjpy: fblValuteDiAsset('GBPJPY'),
      sporco: fblValuteDiAsset('EUR/USD'),
      corto: fblValuteDiAsset('US30'),
      niente: fblValuteDiAsset(null)
    }));
    assert.deepEqual(r.eurusd, ['USD', 'EUR']);
    assert.deepEqual(r.xauusd, ['USD', 'XAU'], 'l oro si muove sulle notizie del dollaro');
    assert.deepEqual(r.btcusdt, ['USD', 'BTC'], 'le stablecoin sono dollari');
    assert.deepEqual(r.gbpjpy, ['JPY', 'GBP']);
    assert.deepEqual(r.sporco, ['USD', 'EUR'], 'barre e spazi non devono cambiare la risposta');
    assert.deepEqual(r.corto, []);
    assert.deepEqual(r.niente, []);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l archivio conserva solo le notizie che contano, e non duplica', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      localStorage.removeItem(NOTIZIE_ARCHIVIO_KEY);
      notizieArchivio = null;
      const base = Date.now() - 3 * 86400000;
      const eventi = [
        {date: new Date(base).toISOString(), country: 'USD', impact: 'High', title: 'Non-Farm Payrolls'},
        {date: new Date(base + 3600000).toISOString(), country: 'EUR', impact: 'Medium', title: 'CPI'},
        {date: new Date(base + 7200000).toISOString(), country: 'GBP', impact: 'Low', title: 'rumore'},
        {date: 'data-che-non-esiste', country: 'USD', impact: 'High', title: 'illeggibile'}
      ];
      const primi = notizieArchivioAggiungi(eventi);
      const ancora = notizieArchivioAggiungi(eventi);        // le stesse: niente di nuovo
      const dentro = Object.values(notizieArchivioCarica());
      return {primi, ancora, quante: dentro.length,
              gravita: dentro.map(e => e.imp).sort(),
              // sopravvive al ricaricamento: è su localStorage
              salvate: JSON.parse(localStorage.getItem(NOTIZIE_ARCHIVIO_KEY) || '[]').length};
    });
    assert.equal(r.primi, 2, 'si tengono solo rosse e arancioni: le Low sono rumore');
    assert.equal(r.ancora, 0, 'le stesse notizie non si riscrivono');
    assert.equal(r.quante, 2);
    assert.deepEqual(r.gravita, ['High', 'Medium']);
    assert.equal(r.salvate, 2, 'l archivio deve sopravvivere al ricaricamento della pagina');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un operazione è "sulla notizia" solo se è vicina NEL TEMPO e sulla sua VALUTA', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      localStorage.removeItem(NOTIZIE_ARCHIVIO_KEY);
      notizieArchivio = null;
      const T = Date.parse('2026-10-09T12:30:00Z');
      notizieArchivioAggiungi([
        {date: new Date(T).toISOString(), country: 'USD', impact: 'High', title: 'NFP'},
        {date: new Date(T).toISOString(), country: 'JPY', impact: 'High', title: 'BoJ'},
        {date: new Date(T + 4 * 3600000).toISOString(), country: 'EUR', impact: 'Medium', title: 'CPI area euro'}
      ]);
      const q = (min, asset, rosse) => {
        const ev = fblNotiziaImportanteVicina(T + min * 60000, asset, rosse !== false);
        return ev ? (ev.cur + '/' + ev.imp) : null;
      };
      return {
        inPunto: q(0, 'EURUSD'),
        pocoPrima: q(-20, 'EURUSD'),
        pocoDopo: q(25, 'EURUSD'),
        troppoPrima: q(-45, 'EURUSD'),
        troppoDopo: q(60, 'EURUSD'),
        altraValuta: q(0, 'AUDCAD'),
        suoYen: q(0, 'GBPJPY'),
        oro: q(0, 'XAUUSD'),
        // L'arancione non conta fra le "rosse", ma si trova chiedendo anche quelle.
        arancioneEsclusa: q(240, 'EURUSD'),
        arancioneInclusa: q(240, 'EURUSD', false),
        senzaData: fblNotiziaImportanteVicina(null, 'EURUSD', true)
      };
    });
    assert.equal(r.inPunto, 'USD/High', 'EURUSD tocca il dollaro');
    assert.equal(r.pocoPrima, 'USD/High', 'mezz ora prima conta: il mercato si muove già');
    assert.equal(r.pocoDopo, 'USD/High');
    assert.equal(r.troppoPrima, null, '45 minuti prima è fuori finestra');
    assert.equal(r.troppoDopo, null);
    assert.equal(r.altraValuta, null, 'una notizia sul dollaro non riguarda AUDCAD');
    assert.equal(r.suoYen, 'JPY/High', 'GBPJPY prende la notizia sullo yen');
    assert.equal(r.oro, 'USD/High', 'l oro prende le notizie del dollaro');
    assert.equal(r.arancioneEsclusa, null, 'chiedendo solo le rosse, l arancione non conta');
    assert.equal(r.arancioneInclusa, 'EUR/Medium');
    assert.equal(r.senzaData, null, 'senza un momento non si risponde a caso');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la dashboard confronta la sala sulle notizie con la stessa sala fuori', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  assert.match(src, /📰 Sale sulle notizie importanti/, 'la carta deve esistere nella dashboard');
  // È il confronto a rispondere alla domanda: una sala può guadagnare di più sulle notizie solo
  // perché opera di più, e il totale da solo non lo direbbe.
  assert.match(src, /const medioFuori=k=>/,
    'serve il medio della STESSA sala fuori dalle notizie, non solo il totale');
  assert.match(src, /'Medio su notizia','Medio fuori','Differenza'/,
    'e le tre colonne che lo mettono a confronto');
  // Il momento che conta è l'apertura, non la chiusura.
  assert.match(src, /const quando=Number\.isFinite\(r\.to\)\?r\.to:r\.tc;/,
    'un operazione è "sulla notizia" per quando è stata APERTA');
  // L'archivio si riempie da solo dal punto in cui le notizie esistono davvero.
  assert.match(src, /notizieArchivioAggiungi\(newsEvents\)/,
    'ogni calendario che arriva deve lasciare qualcosa nell archivio');
});

// Due sale, stesse quattro operazioni a testa: "Sala Lampo" apre SULLE notizie, "Sala Calma" no.
// I numeri sono scelti perche' la risposta si possa verificare a mano.
const TRADES = () => {
  // Date RECENTI: la dashboard parte con un periodo filtrato, e operazioni di mesi fa non
  // comparirebbero nella tabella (il test misurerebbe il filtro, non la carta).
  const NOTIZIA = Date.now() - 3 * 86400000;
  const g = (giorno, ora) => Date.now() - giorno * 86400000 + ora * 3600000;
  const t = (id, sala, apre, pl) => ({
    id, asset: 'EURUSD', side: 'BUY', mode: 'backtest', entry: 1.1, exit: 1.11, sl: 1.09, tp: 1.12,
    lots: 0.1, result: pl >= 0 ? 'TP' : 'SL', pips: pl / 20, pl, pct: pl / 100, account: 10000,
    strategy: '', tgSala: sala, startTime: apre,
    closedAt: new Date(apre + 3600000).toISOString()
  });
  trades = [
    // Sala Lampo: due aperte dentro la finestra della notizia, due lontane.
    t('L1', 'Sala Lampo', NOTIZIA - 10 * 60000, 300),
    t('L2', 'Sala Lampo', NOTIZIA + 15 * 60000, 500),
    t('L3', 'Sala Lampo', g(2, 1), -100),
    t('L4', 'Sala Lampo', g(1, 1), -100),
    // Sala Calma: una sola sulla notizia, e va male.
    t('C1', 'Sala Calma', NOTIZIA + 5 * 60000, -200),
    t('C2', 'Sala Calma', g(2, 2), 150),
    t('C3', 'Sala Calma', g(1, 2), 150)
  ];
  localStorage.removeItem(NOTIZIE_ARCHIVIO_KEY);
  notizieArchivio = null;
  notizieArchivioAggiungi([{date: new Date(NOTIZIA).toISOString(), country: 'USD',
                            impact: 'High', title: 'Non-Farm Payrolls'}]);
};

test('la carta si disegna davvero, e i conti tornano', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      fblStatApri();
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const carte = [...document.querySelectorAll('#fblStatOverlay .fsCard')];
      const c = carte.find(x => /Sale sulle notizie importanti/.test(x.textContent));
      if (!c) return {trovata: false, titoli: carte.map(x => x.textContent.slice(0, 40))};
      const bt = [...c.querySelectorAll('button.fsTab')].find(x => x.textContent === 'Tabella');
      if (bt) bt.click();
      // La tabella si costruisce al click, non prima: un frame e c'e'.
      await new Promise(res => requestAnimationFrame(res));
      const righe = [...c.querySelectorAll('tr')]
        .map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim()))
        .filter(x => x.length);
      return {trovata: true, righe};
    }, TRADES.toString());
    assert.equal(r.trovata, true,
      'la carta deve comparire fra le altre: ' + JSON.stringify(r.titoli || []));
    const lampo = r.righe.find(x => x[0] === 'Sala Lampo');
    const calma = r.righe.find(x => x[0] === 'Sala Calma');
    assert.ok(lampo, 'Sala Lampo deve avere una riga: ' + JSON.stringify(r.righe));
    assert.equal(lampo[1], '2', 'due operazioni aperte dentro la finestra della notizia');
    assert.match(lampo[2], /^100([.,]0+)?\s*%$/, 'vinte tutte e due: ' + lampo[2]);
    assert.ok(calma, 'anche Sala Calma, con la sua unica operazione sulla notizia');
    assert.equal(calma[1], '1');
    assert.match(calma[2], /^0([.,]0+)?\s*%$/, 'l unica sulla notizia e persa: ' + calma[2]);
    // L ordine e per P/L sulla notizia: chi lavora meglio sulle notizie sta in cima.
    assert.equal(r.righe[0][0], 'Sala Lampo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
