// La dashboard: conti Kraken separati dai Forex, e la linea di tendenza.
//
// RICHIESTO dal proprietario: «nella dashboard la selezione del conto Kraken deve restare separata
// da quella dei conti Forex: sono valori che non si possono sommare» e «accanto alle barre, la
// linea di tendenza del P/L giornaliero».
//
// Il difetto vero stava in `contoDi`: i trade Kraken (nessun ticket MT5, mode 'live') finivano
// sotto il conto "Live", insieme ai trade simulati. Non erano separabili nemmeno a mano.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('un trade Kraken non finisce piu\' nel conto «Live»', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      // Come lo scrive krakenRicostruisciGiornale / la chiusura dal vivo.
      kraken: fblStatCalcoli.contoDi({account: 'kraken', mode: 'live', krakenConto: 'simulato-1'}),
      // Riconosciuto anche da krakenChiave: le righe ricostruite dal server hanno quella.
      perChiave: fblStatCalcoli.contoDi({mode: 'live', krakenChiave: 'x|PF_SOLUSD|1'}),
      live: fblStatCalcoli.contoDi({mode: 'live'}),
      mt5: fblStatCalcoli.contoDi({mt5Ticket: 7, mt5Login: 12345, mode: 'live'}),
      storico: fblStatCalcoli.contoDi({mode: 'backtest'})
    }));
    assert.notEqual(r.kraken, r.live, 'era questo il difetto: Kraken e Live erano la stessa voce');
    assert.ok(r.kraken.includes('Kraken'));
    assert.ok(r.perChiave.includes('Kraken'));
    // Nessuna regressione sui nomi di prima.
    assert.equal(r.live, 'Live');
    assert.equal(r.mt5, 'MT5 12345');
    assert.equal(r.storico, 'Storico');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le due famiglie si riconoscono', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      kr: fblStatCalcoli.eKraken(fblStatCalcoli.contoDi({account: 'kraken', krakenConto: 'c1'})),
      mt5: fblStatCalcoli.eKraken('MT5 12345'),
      live: fblStatCalcoli.eKraken('Live'),
      niente: fblStatCalcoli.eKraken(null)
    }));
    assert.equal(r.kr, true);
    assert.equal(r.mt5, false);
    assert.equal(r.live, false);
    assert.equal(r.niente, false, 'un conto senza nome non e\' di Kraken');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la tendenza dice se si sta migliorando, e tace quando non sa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      sale: fblStatCalcoli.tendenzaLineare([-30, -10, 10, 30]),
      scende: fblStatCalcoli.tendenzaLineare([40, 20, 0, -20]),
      // Due punti stanno sempre su una retta: una "tendenza" su due giorni direbbe
      // una cosa che non si sa.
      due: fblStatCalcoli.tendenzaLineare([10, 20]),
      uno: fblStatCalcoli.tendenzaLineare([10]),
      vuoto: fblStatCalcoli.tendenzaLineare([]),
      // Valori tutti uguali: pendenza zero, non e' una tendenza ma e' una risposta onesta.
      piatta: fblStatCalcoli.tendenzaLineare([5, 5, 5, 5])
    }));
    assert.ok(r.sale.pendenza > 0, 'risultati che migliorano → pendenza positiva');
    assert.ok(r.scende.pendenza < 0);
    // +20 per periodo: -30, -10, +10, +30 sono esattamente in fila.
    assert.ok(Math.abs(r.sale.pendenza - 20) < 1e-9);
    assert.ok(Math.abs(r.sale.inizio + 30) < 1e-9, 'la retta passa dai punti, qui allineati');
    assert.equal(r.due, null);
    assert.equal(r.uno, null);
    assert.equal(r.vuoto, null);
    assert.equal(r.piatta.pendenza, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un valore non numerico non falsa la tendenza', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      // Number(null) è 0: un periodo senza valore conterebbe come un pareggio e
      // tirerebbe giù la retta. Vanno scartati, non messi a zero.
      conNulli: fblStatCalcoli.tendenzaLineare([10, 20, 30, null, undefined, NaN]),
      pulita: fblStatCalcoli.tendenzaLineare([10, 20, 30])
    }));
    assert.deepEqual(r.conNulli, r.pulita);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// Fino a qui si sono controllati i conti. Questi due aprono la dashboard per davvero: una
// funzione giusta che non viene disegnata non serve a niente, ed è un difetto che i test sui
// numeri non vedono.
const PREPARA = () => {
  trades = [];
  const g = 86400000;
  // Dieci giorni di forex su un conto MT5, in salita.
  for (let i = 0; i < 10; i++) {
    const pl = -120 + i * 40;
    trades.push({id: 'fx' + i, asset: 'OANDA:XAUUSD', side: 'BUY', entry: 100, exit: 101, pl,
      pct: pl / 100, pips: pl / 10, result: pl >= 0 ? 'TP' : 'SL', mt5Ticket: 1000 + i,
      mt5Login: 12345, mode: 'live', lots: 0.1,
      closedAt: new Date(Date.now() - (10 - i) * g).toISOString(),
      startTime: Date.now() - (10 - i) * g - 3600000});
  }
  // E tre operazioni sul conto Kraken simulato.
  for (let i = 0; i < 3; i++) {
    trades.push({id: 'kr' + i, asset: 'BINANCE:SOLUSDT', side: 'SELL', entry: 180, exit: 175,
      pl: 60 + i * 10, pct: 1, pips: 0, result: 'TP', account: 'kraken', mode: 'live',
      krakenConto: 'simulato-1', krakenSimbolo: 'PF_SOLUSD', lots: 1,
      closedAt: new Date(Date.now() - (3 - i) * g).toISOString(),
      startTime: Date.now() - (3 - i) * g - 3600000});
  }
  fblStatApri();
};

async function apriStatistiche() {
  const amb = await apriApp({larghezza: 1280, altezza: 1400});
  await amb.pagina.evaluate((p) => eval('(' + p + ')')(), PREPARA.toString());
  await amb.pagina.waitForTimeout(2200);
  return amb;
}

test('il menu dei conti parte dal solo Forex e offre le due famiglie', async () => {
  const {browser, pagina, errori} = await apriStatistiche();
  try{
    const r = await pagina.evaluate(() => {
      const el = document.getElementById('fsConto');
      return {
        scelto: el.value,
        valori: [...el.querySelectorAll('option')].map(o => o.value),
        gruppi: [...el.querySelectorAll('optgroup')].map(g => g.label)
      };
    });
    assert.equal(r.scelto, '__forex', 'con Kraken in mezzo non si parte da una somma fra mondi');
    assert.ok(r.valori.includes('__kraken'));
    assert.ok(r.valori.includes(''), 'sommarli resta possibile: lo si sceglie');
    assert.ok(r.gruppi.some(g => /Kraken/.test(g)), 'Kraken in un gruppo suo: ' + r.gruppi);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('sommando i due mondi l\'avviso compare; separandoli sparisce', async () => {
  const {browser, pagina, errori} = await apriStatistiche();
  try{
    const soloForex = await pagina.evaluate(() => !!document.getElementById('fsMisto'));
    assert.equal(soloForex, false, 'sul solo Forex non c\'è niente da avvisare');
    const misto = await pagina.evaluate(async () => {
      const el = document.getElementById('fsConto');
      el.value = '';                                  // Tutti (Forex + Kraken)
      el.dispatchEvent(new Event('change', {bubbles: true}));
      await new Promise(r => setTimeout(r, 400));
      return !!document.getElementById('fsMisto');
    });
    assert.equal(misto, true, 'un totale fra valute e capitali diversi non si mostra muto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la linea di tendenza si disegna sulle barre del profitto', async () => {
  const {browser, pagina, errori} = await apriStatistiche();
  try{
    const r = await pagina.evaluate(() => {
      // La carta del profitto per periodo: quella con le barre divergenti.
      const carte = [...document.querySelectorAll('#fsGrid .fsCard')];
      const c = carte.find(x => /Profitto giorno per giorno/.test(x.querySelector('h4').textContent));
      if(!c)return {trovata: false};
      const tratteggiate = [...c.querySelectorAll('svg line[stroke-dasharray]')]
        .filter(l => l.getAttribute('stroke-dasharray') === '6 4');
      const et = [...c.querySelectorAll('svg text')].map(t => t.textContent)
        .filter(t => /tendenza/.test(t));
      return {trovata: true, linee: tratteggiate.length, etichette: et};
    });
    assert.equal(r.trovata, true, 'la carta del profitto per periodo deve esserci');
    assert.equal(r.linee, 1, 'una linea di tendenza, una sola');
    assert.equal(r.etichette.length, 1, 'con scritto di quanto migliora: ' + JSON.stringify(r.etichette));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
