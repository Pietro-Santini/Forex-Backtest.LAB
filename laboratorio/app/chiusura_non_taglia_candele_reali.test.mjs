// NON SI TAGLIA MAI UNA CANDELA CHE MT5 HA DAVVERO MANDATO.
//
// SEGNALATO dal proprietario (21 novembre 2026), sera:
//   «l'ultima candela visualizzata al terminale di MT5 e' alle 22:58, mentre a me mi visualizza
//   alle 21:59, e effettivamente mi taglia quella che e' un'ora di mercato. Gli indicatori vanno
//   avanti, ma l'ultima candela e' un'ora prima.»
//
// MISURATO SUL CODICE (non supposto). Due strade concorrono allo stesso taglio:
//   1. `fblChiusuraMinutiLocali()` (app.html ~60426) ripiega su `LIVE_MT5_CLOSE_MIN = 22*60`
//      quando `fblScartoServerSec` e' ignoto (null). E resta ignoto se in quella sessione il
//      grafico non e' passato da MT5 (per esempio con la sorgente su Capital.com). Cosi' le
//      22:00 di Roma diventano "chiusura", qualunque ora sia davvero;
//   2. `_fblConfineChiusuraCalcola()` (~16609) taglia TUTTA LA CODA che l'orario considera
//      chiusa, senza mai guardare i dati realmente ricevuti. Con la chiusura finta delle 22:00
//      butta via le candele 22:00-22:58, che MT5 ha mandato davvero.
//
// LA REGOLA DEL PROPRIETARIO (REGOLE.md, regola 4): il mercato e' chiuso solo quando non arrivano
// piu' dati da MT5. Nessuna ora fissa. L'ultima candela che l'app mostra e' l'ultima che MT5 ha
// dato: oltre quella non c'e' mercato, prima di quella non si taglia niente.
//
// QUESTO BANCO MISURA IL COMPORTAMENTO: monta la scena vera del proprietario (serie che arriva
// alle 22:58 di Roma, tick veri fino a li', scarto del server ignoto, calendario che dice
// aperto) e chiede al grafico quale sia l'ultima candela VISIBILE.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// 11 novembre 2026 e' un MERCOLEDI'. Roma a novembre e' CET, cioe' UTC+1: le 22:58 di Roma sono
// le 21:58 UTC. Gli istanti si dichiarano, non si ereditano dall'orologio di chi lancia il banco
// (la lezione del 19 novembre: lo stesso banco era verde in casa e rosso su GitHub che gira UTC).
const T_2305 = Date.UTC(2026, 10, 11, 22, 5, 0);   // 23:05 di Roma
const T_SABATO = Date.UTC(2026, 10, 14, 11, 0, 0); // sabato 14 novembre, 12:00 di Roma

// Il calendario dello strumento come lo da' Capital.com: aperto tutti i giorni fino a tardi.
// Serve perche' e' la strada in cui `_fblConfineChiusuraCalcola` trova davvero una coda chiusa.
const CALENDARIO_APERTO = {zona: 'UTC', stato: 'OPEN', letto: 0, giorni: {
  mon: ['00:00 - 23:59'], tue: ['00:00 - 23:59'], wed: ['00:00 - 23:59'],
  thu: ['00:00 - 23:59'], fri: ['00:00 - 23:59'], sat: ['00:00 - 23:59'], sun: []
}};

// La scena: `candele` minuti di serie a 1 minuto che finiscono a `ultimaUtc`, un tick vero
// sull'ultima candela, lo scarto del server scelto dalla prova.
const SCENA = ({adesso, ultimaUtc, candele, tickSuUltima, scarto, orari, sorgente}) => {
  if (!window.__NOW_VERO) window.__NOW_VERO = Date.now;
  window.__NOW_OFF = adesso - window.__NOW_VERO.call(Date);
  Date.now = () => window.__NOW_VERO.call(Date) + window.__NOW_OFF;

  const R = [];
  let p = 4100;
  for (let i = candele - 1; i >= 0; i--) {
    const tt = ultimaUtc - i * 60000;
    const o = p, c = p + Math.sin(i / 5) * 0.4;
    R.push({date: new Date(tt).toISOString(), open: o, high: Math.max(o, c) + 0.2,
            low: Math.min(o, c) - 0.2, close: c, volume: 10});
    p = c;
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentTF = 1; currentAssetKey = 'XAUUSD'; rowsAssetKey = 'XAUUSD';
  csvLibrary = [{id: (sorgente === 'capital' ? 'capital_live_' : 'mt5_live_') + 'XAUUSD', rows: R}];
  liveModeActive = true; liveReplayActive = false;
  mt5Connected = true; mt5ActiveSymbol = 'XAUUSD';
  fblNotteMt5 = false; liveSessionPhase = null; liveSessionBusy = false;
  followLatest = true;
  positions.length = 0; pendingOrders.length = 0;

  try { delete orariAsset['XAUUSD']; } catch (e) {}
  if (orari) orariAsset['XAUUSD'] = orari;

  Object.keys(fblMercatoMt5Cache).forEach(k => delete fblMercatoMt5Cache[k]);   // MT5 non ha risposto

  // I DATI CHE SONO DAVVERO ARRIVATI: l'ultimo tick vero, sull'ultima candela della serie.
  mt5UltimoTickPerAsset = {};
  if (tickSuUltima) {
    mt5UltimoTickPerAsset['XAUUSD'] = {at: ultimaUtc, prezzo: R[R.length - 1].close};
  }

  fblScartoServerRicorda(scarto);
  return {totale: rows.length, ultimaUtc: new Date(ultimaUtc).toISOString()};
};

// Che cosa vede l'utente: l'ultima candela della finestra visibile.
const VISTA = () => {
  const v = getVisibleData();
  return {quante: v.length, ultima: v.length ? v[v.length - 1].date : null,
          confine: (function () { try { return fblConfineChiusura(); } catch (e) { return String(e); } })()};
};

test('con lo scarto del server ignoto, le candele vere fino alle 22:58 restano tutte', async () => {
  // E' il caso del proprietario: scarto null (=> ripiego fisso delle 22:00) e serie che arriva
  // alle 22:58 di Roma, ricevuta da MT5. Oggi il grafico si ferma alle 21:59: questa prova e'
  // ROSSA prima della cura.
  const {browser, pagina, errori} = await apriApp();
  try {
    const B = await pagina.evaluate(SCENA, {
      adesso: T_2305, ultimaUtc: Date.UTC(2026, 10, 11, 21, 58, 0),
      candele: 179, tickSuUltima: true, scarto: null, orari: CALENDARIO_APERTO
    });
    const r = await pagina.evaluate(VISTA);
    const attesa = new Date(Date.UTC(2026, 10, 11, 21, 58, 0)).toISOString();
    assert.equal(r.ultima, attesa,
      'l\'ultima candela mostrata deve essere quella vera delle 22:58 di Roma, non le 21:59: '
      + JSON.stringify({scena: B, vista: r}));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con lo scarto del server noto (UTC+2) la stessa serie resta intatta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENA, {
      adesso: T_2305, ultimaUtc: Date.UTC(2026, 10, 11, 21, 58, 0),
      candele: 179, tickSuUltima: true, scarto: 7200, orari: CALENDARIO_APERTO
    });
    const r = await pagina.evaluate(VISTA);
    const attesa = new Date(Date.UTC(2026, 10, 11, 21, 58, 0)).toISOString();
    assert.equal(r.ultima, attesa,
      'col server a UTC+2 la chiusura e\' alle 23:00 di Roma: nessuna candela va tagliata: '
      + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROPROVA: le candele oltre l\'ultima reale non si mostrano', async () => {
  // La cura non deve diventare "non si taglia mai piu' niente": oltre l'ultimo tick vero non c'e'
  // mercato, e quelle candele non si mostrano. La serie arriva alle 23:07 di Roma, il tick vero
  // si ferma alle 22:58: l'ultima visibile deve restare le 22:58.
  //
  // Si misura sulla sorgente CAPITAL.COM, che e' quella che restituisce davvero candele
  // past-close (v. il commento in getVisibleData). Un file di MT5, invece, e' la serie che MT5 ha
  // mandato: li' non esiste una candela "oltre l'ultima reale".
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENA, {
      adesso: T_2305, ultimaUtc: Date.UTC(2026, 10, 11, 22, 7, 0),
      candele: 187, tickSuUltima: false, scarto: null, orari: CALENDARIO_APERTO,
      sorgente: 'capital'
    });
    const r = await pagina.evaluate(([tReale]) => {
      mt5UltimoTickPerAsset['XAUUSD'] = {at: tReale, prezzo: rows[rows.length - 1].close};
      liveSessionPhase = null;
      const v = getVisibleData();
      return {quante: v.length, ultima: v.length ? v[v.length - 1].date : null};
    }, [Date.UTC(2026, 10, 11, 21, 58, 0)]);
    assert.equal(r.ultima, new Date(Date.UTC(2026, 10, 11, 21, 58, 0)).toISOString(),
      'le candele finte oltre l\'ultima reale devono restare fuori: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROPROVA weekend: un asset che trasmette di sabato non viene tagliato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENA, {
      adesso: T_SABATO, ultimaUtc: Date.UTC(2026, 10, 14, 10, 58, 0),
      candele: 179, tickSuUltima: true, scarto: null, orari: CALENDARIO_APERTO
    });
    const r = await pagina.evaluate(VISTA);
    assert.equal(r.ultima, new Date(Date.UTC(2026, 10, 14, 10, 58, 0)).toISOString(),
      'un asset che di sabato trasmette non e\' un mercato chiuso: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('app appena aperta, nessun tick in questa sessione: il file di MT5 resta intero', async () => {
  // IL CASO DEL PROPRIETARIO, detto con le sue parole: «non e' che non e' presente il file, e' che
  // non riesce a scrivere a grafico quelle che sono le candele rimanenti fino all'effettiva
  // chiusura del mercato... in modalita' replay va a ripescare le candele giuste caricate da MT5
  // fino effettivamente all'ultima».
  //
  // Cioe': lo storico e' COMPLETO (arriva alle 23:50 di Roma) e viene da MT5, ma in Live non e'
  // arrivato nessun tick in questa sessione (app aperta dopo, ponte appena agganciato, oppure
  // mercato gia' chiuso). Non c'e' nessun tick da usare come prova: la prova e' il FILE. Se il
  // file e' di MT5, le sue candele sono quelle che MT5 ha mandato, tutte.
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENA, {
      adesso: Date.UTC(2026, 10, 11, 22, 55, 0),          // 23:55 di Roma
      ultimaUtc: Date.UTC(2026, 10, 11, 22, 50, 0),       // 23:50 di Roma, l'ultima vera
      candele: 230, tickSuUltima: false,                   // NESSUN tick in questa sessione
      scarto: null, orari: CALENDARIO_APERTO
    });
    const r = await pagina.evaluate(VISTA);
    assert.equal(r.ultima, new Date(Date.UTC(2026, 10, 11, 22, 50, 0)).toISOString(),
      'un file di MT5 si mostra fino alla sua ultima candela, non fino alle 22:00: '
      + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
