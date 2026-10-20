// QUANTO MANCA ALLA CHIUSURA DEL MERCATO.
//
// PERCHE' SERVE, e i numeri da cui nasce. Misurato il 21 ottobre 2026 sui tick veri del conto del
// proprietario (MT5, Simboli -> Ticks), EURCHF al cambio giornata:
//
//   00:00:42.091   bid 0,92461   ask 0,92961   ->  50,0 pip di spread
//   00:01:28.613   bid 0,92598   ask 0,92903   ->  30,5 pip
//   00:03:17.229   bid 0,92463   ask 0,92963   ->  50,0 pip
//
// Cinque tick in cinque minuti, con lo spread 250 volte più largo del normale (0,2 pip). Tre
// posizioni SELL con stop a 0,92827 sono state chiuse in quell'istante: legittimamente, perché lo
// stop di una SELL si esegue sull'ASK (0,92961) mentre il grafico disegna il BID (0,92461) — e
// quindi mostrava il movimento OPPOSTO. Dal punto di vista del proprietario: «chiuse a un prezzo
// dove il mercato non è mai andato».
//
// Non c'è niente da correggere nell'esecuzione. C'è da NON FARSI TROVARE LÌ: avvisare prima, e
// poter chiudere da soli le posizioni in guadagno prima che il mercato chiuda. Tutto questo si
// regge su una domanda sola, che è quella che questi test tengono ferma.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Un calendario come quelli che manda il broker: lunedì-venerdì aperto, con la pausa giornaliera.
// «22:05 - 00:00» è proprio la forma che orariIntervalli() sa leggere (finisce a mezzanotte).
const PREPARA = () => {
  liveModeActive = true;
  orariAsset = {
    EURCHF: {
      zona: 'UTC',
      giorni: {
        mon: ['00:00 - 21:59'], tue: ['00:00 - 21:59'], wed: ['00:00 - 21:59'],
        thu: ['00:00 - 21:59'], fri: ['00:00 - 21:59']
      },
      letto: Date.now()
    }
  };
};

test('dice a che ora chiude, leggendo il calendario dello strumento', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      // Martedì 20 ottobre 2026, 18:00 UTC: il mercato chiude alle 21:59 dello stesso giorno.
      const t = Date.UTC(2026, 9, 20, 18, 0, 0);
      const chiusura = fblProssimaChiusura('EURCHF', t);
      return {
        chiusura,
        atteso: Date.UTC(2026, 9, 20, 21, 59, 0),
        manca: fblMancaAllaChiusura('EURCHF', t)
      };
    }, PREPARA.toString());
    assert.equal(r.chiusura, r.atteso, 'la chiusura è quella del calendario dello strumento');
    assert.equal(r.manca, 3 * 3600000 + 59 * 60000, 'e mancano 3 ore e 59 minuti');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un minuto prima della chiusura lo dice, dieci minuti prima no', async () => {
  // È la soglia su cui si regge la chiusura automatica chiesta dal proprietario: «un minuto prima,
  // se la posizione è in guadagno, chiudila».
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const chiusura = Date.UTC(2026, 9, 20, 21, 59, 0);
      return {
        unMinutoPrima: fblVicinoAllaChiusura('EURCHF', 1, chiusura - 60000),
        pocoPrima: fblVicinoAllaChiusura('EURCHF', 1, chiusura - 30000),
        dieciMinutiPrima: fblVicinoAllaChiusura('EURCHF', 1, chiusura - 10 * 60000),
        conSogliaDieci: fblVicinoAllaChiusura('EURCHF', 10, chiusura - 10 * 60000),
        sogliaZero: fblVicinoAllaChiusura('EURCHF', 0, chiusura - 30000),
        sogliaAssurda: fblVicinoAllaChiusura('EURCHF', NaN, chiusura - 30000)
      };
    }, PREPARA.toString());
    assert.equal(r.unMinutoPrima, true, 'esattamente un minuto prima ci siamo');
    assert.equal(r.pocoPrima, true, 'e mezzo minuto prima a maggior ragione');
    assert.equal(r.dieciMinutiPrima, false, 'dieci minuti prima no, con la soglia a uno');
    assert.equal(r.conSogliaDieci, true, 'con la soglia a dieci, sì');
    assert.equal(r.sogliaZero, false, 'soglia zero non è una soglia: non scatta niente');
    assert.equal(r.sogliaAssurda, false, 'e un numero che non è un numero nemmeno');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('a mercato già chiuso non c\'è nessuna chiusura «in arrivo»', async () => {
  // Importante per chi chiama: «null» non vuol dire «adesso», vuol dire «non c'è niente da
  // aspettare». Confonderli farebbe chiudere posizioni a caso di notte.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const fuoriOrario = Date.UTC(2026, 9, 20, 23, 0, 0);   // dopo le 21:59
      const sabato = Date.UTC(2026, 9, 24, 12, 0, 0);        // mercato chiuso tutto il giorno
      return {
        fuoriOrario: fblProssimaChiusura('EURCHF', fuoriOrario),
        sabato: fblProssimaChiusura('EURCHF', sabato),
        mancaFuoriOrario: fblMancaAllaChiusura('EURCHF', fuoriOrario),
        vicinoFuoriOrario: fblVicinoAllaChiusura('EURCHF', 1, fuoriOrario)
      };
    }, PREPARA.toString());
    assert.equal(r.fuoriOrario, null, 'già chiuso: non c\'è una chiusura in arrivo');
    assert.equal(r.sabato, null, 'di sabato nemmeno');
    assert.equal(r.mancaFuoriOrario, null);
    assert.equal(r.vicinoFuoriOrario, false, 'e soprattutto non deve risultare «vicino»');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le cripto non chiudono mai: non si inventa un orario', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      return {
        btc: fblProssimaChiusura('BTCUSD', Date.now()),
        vicino: fblVicinoAllaChiusura('BTCUSD', 60, Date.now()),
        senzaAsset: fblProssimaChiusura('', Date.now())
      };
    }, PREPARA.toString());
    assert.equal(r.btc, null, 'il mercato cripto non chiude: nessuna chiusura da aspettare');
    assert.equal(r.vicino, false, 'e non è mai «vicino alla chiusura»');
    assert.equal(r.senzaAsset, null);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un asset senza calendario non fa esplodere niente e non inventa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      // Nessun calendario per questo asset, e MT5 non collegato: non si sa, e si dice.
      mt5Connected = false;
      return {
        sconosciuto: fblProssimaChiusura('GBPNZD', Date.UTC(2026, 9, 20, 18, 0, 0)),
        vicino: fblVicinoAllaChiusura('GBPNZD', 1, Date.UTC(2026, 9, 20, 18, 0, 0))
      };
    }, PREPARA.toString());
    assert.equal(r.sconosciuto, null, 'senza calendario si risponde «non si sa»');
    assert.equal(r.vicino, false, 'e «non si sa» non diventa mai «sì, è vicino»');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
