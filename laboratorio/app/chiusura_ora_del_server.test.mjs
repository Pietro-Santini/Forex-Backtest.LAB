// L'ORA DI CHIUSURA LA DICE IL SERVER DEL BROKER, NON UNA COSTANTE SCRITTA A MANO.
//
// SEGNALATO dal proprietario (18 novembre 2026), con la foto del grafico XAU/USD: «ecco spiegato
// il perche' del fatto che non mi fa vedere le candele successive dopo le 22: in realta' MT5
// trasmette le candele fino a una certa ora mentre il nostro programma pensa che alle 22 e'
// chiuso».
//
// MISURATO sul suo PC, lo stesso giorno, interrogando i suoi servizi vivi:
//   - GET 127.0.0.1:8001/history?symbol=XAUUSD -> "utc_offset_seconds_applied": 7200.
//     Il server del broker (FTMO-Demo) e' UTC+2, non UTC+3;
//   - l'ultima candela M1 servita era delle 22:49 LOCALI (21:49 UTC), e alle 23:06 non ne
//     arrivavano piu': il giorno di trading finisce alle 24:00 del server, cioe' alle 23:00
//     locali - un'ora DOPO quella che l'app dava per buona.
//
// L'app aveva l'orario scolpito: LIVE_MT5_CLOSE_MIN = 22*60. Quel 22:00 e' giusto solo per un
// server UTC+3 con l'Italia in ora solare. Con questo broker e' sbagliato di un'ora tutto l'anno,
// e si porta dietro tre cose, non una:
//   1. il grafico, che dalle 22 in poi prosegue solo per la cura dei tick della 2.2.70 (una rete
//      di sicurezza, non la regola giusta);
//   2. l'etichetta rossa «Mercato chiuso» e il conto alla rovescia;
//   3. SOLDI VERI: la finestra calda del margine di chiusura, quella in cui il pulsante BE
//      allontana lo stop di uno spread di rollover (44 pip su XAUUSD). Con la chiusura sbagliata
//      quella protezione si accendeva alle 21:30-22:00, cioe' nell'ora sbagliata, e si spegneva
//      proprio nella mezz'ora vera del cambio giornata.
//
// Il dato giusto l'app ce l'ha gia' in mano: il servizio dati DICHIARA lo scarto del server in
// ogni risposta dello storico. Qui si pretende che lo usi.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Lo scarto del server, in secondi, come lo dichiara il servizio dati.
const UTC2 = 7200;      // il broker del proprietario (FTMO-Demo), ora solare
const UTC3 = 10800;     // il caso per cui era stato scritto il 22:00

// Un'ora locale di oggi, in millisecondi.
const oggiAlle = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); };

async function preparaApp() {
  const {browser, pagina, errori} = await apriApp();
  await pagina.evaluate(() => {
    liveModeActive = true; mt5Connected = true; currentAssetKey = 'XAUUSD';
    orariAsset = {};            // nessun calendario Capital.com: si decide con l'orario di MT5
  });
  return {browser, pagina, errori};
}

test('col server a UTC+2 il mercato chiude alle 23:00 locali, non alle 22:00', async () => {
  const {browser, pagina, errori} = await preparaApp();
  try {
    const r = await pagina.evaluate(([scarto, alle2230, alle2310, alle2130]) => {
      fblScartoServerRicorda(scarto);
      return {
        minutiChiusura: fblChiusuraMinutiLocali(alle2230),
        alle2230: liveSessionPhaseAt(alle2230),
        alle2310: liveSessionPhaseAt(alle2310),
        alle2130: liveSessionPhaseAt(alle2130)
      };
    }, [UTC2, oggiAlle(22, 30), oggiAlle(23, 10), oggiAlle(21, 30)]);

    assert.equal(r.minutiChiusura, 23 * 60, 'la chiusura deve cadere alle 23:00 locali (24:00 del server UTC+2)');
    assert.notEqual(r.alle2230, 'closed', 'alle 22:30 il mercato e ancora aperto: MT5 stava trasmettendo');
    assert.notEqual(r.alle2130, 'closed', 'alle 21:30, tanto piu');
    assert.equal(r.alle2310, 'closed', 'alle 23:10 e chiuso davvero: l ultima candela era delle 22:49');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('col server a UTC+3 resta il comportamento di prima: chiusura alle 22:00', async () => {
  // La prova di controllo. Non si sta spostando un orario sbagliato su un altro orario sbagliato:
  // si sta derivando dalla mezzanotte del server, e per un server UTC+3 quella mezzanotte cade
  // davvero alle 22:00 italiane d inverno.
  const {browser, pagina, errori} = await preparaApp();
  try {
    const r = await pagina.evaluate(([scarto, alle2230]) => {
      fblScartoServerRicorda(scarto);
      return {minutiChiusura: fblChiusuraMinutiLocali(alle2230), alle2230: liveSessionPhaseAt(alle2230)};
    }, [UTC3, oggiAlle(22, 30)]);
    const atteso = new Date(oggiAlle(22, 30)).getTimezoneOffset() === -60 ? 22 * 60 : 23 * 60;
    assert.equal(r.minutiChiusura, atteso, 'con un server UTC+3 la mezzanotte del server cade un ora prima');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('scarto del server ignoto: non si inventa niente, resta il 22:00 di prima', async () => {
  // Ponte vecchio, o storico mai scaricato: il campo non c e. Qui non si tira a indovinare -
  // si tiene il comportamento conosciuto, che e quello prudente (al massimo il grafico resta
  // fermo un ora di troppo, mai candele finte a mercato chiuso).
  const {browser, pagina, errori} = await preparaApp();
  try {
    const r = await pagina.evaluate((alle2230) => {
      fblScartoServerRicorda(null);
      return {minutiChiusura: fblChiusuraMinutiLocali(alle2230), alle2230: liveSessionPhaseAt(alle2230)};
    }, oggiAlle(22, 30));
    assert.equal(r.minutiChiusura, 22 * 60, 'senza lo scarto del server resta la soglia storica');
    assert.equal(r.alle2230, 'closed', 'e alle 22:30 il mercato risulta chiuso, come prima');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('SOLDI VERI: la finestra calda del margine di chiusura segue la chiusura vera', async () => {
  // Il punto per cui questo banco esiste davvero. Il pulsante BE allontana lo stop di uno spread
  // di rollover nella mezz ora prima della chiusura. Con la chiusura sbagliata, quella mezz ora
  // era la sbagliata: protezione accesa alle 21:30 (mercato pieno) e SPENTA alle 22:30, che e
  // esattamente il momento in cui il cambio giornata allarga la forbice.
  const {browser, pagina, errori} = await preparaApp();
  try {
    const r = await pagina.evaluate(([scarto, alle2230, alle2130]) => {
      fblScartoServerRicorda(scarto);
      const pos = {asset: 'XAUUSD', side: 'BUY', entry: 4050.70, mt5Ticket: 306713136};
      mt5RealPositions = [{ticket: 306713136, symbol: 'XAUUSD', side: 'BUY', price_open: 4050.70,
        bid: 4059, ask: 4059.30, commission: -0.28, swap: 0, valore_punto: 10, digits: 2, point: 0.01}];
      return {
        alle2230: fblFinestraChiusura('XAUUSD', alle2230),
        alle2130: fblFinestraChiusura('XAUUSD', alle2130),
        stop2230: fblPareggioPerStop(pos, alle2230),
        stop2130: fblPareggioPerStop(pos, alle2130)
      };
    }, [UTC2, oggiAlle(22, 30), oggiAlle(21, 30)]);

    assert.equal(r.alle2230.calda, true, 'alle 22:30 manca mezz ora alla chiusura vera: finestra calda');
    assert.equal(r.alle2230.fase, 'chiusura', 'e la fase e la chiusura');
    assert.ok(r.stop2230.margine > 0, 'alle 22:30 il BE deve allontanare lo stop: margine ' + r.stop2230.margine);
    assert.equal(r.alle2130.calda, false, 'alle 21:30 manca un ora e mezza: niente margine, mercato pieno');
    assert.equal(r.stop2130.margine, 0, 'alle 21:30 lo stop va sul pareggio esatto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
