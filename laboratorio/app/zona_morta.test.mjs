// IL CLIC SUL GRAFICO NON DEVE PORTARE NELLA ZONA MORTA.
//
// SEGNALATO dal proprietario (8 novembre 2026): «se clicco sul grafico all'apertura mi porta
// tutto avanti in una zona morta non esistente dove non c'e' nessun dato; anche quando clicco
// torna all'ultima candela e poi clicco dentro al grafico, lui si sposta automaticamente piu'
// avanti nella zona morta, in modo del tutto casuale».
//
// CAUSA MISURATA: maxViewEnd() lasciava arrivare viewEnd fino a idx+0,85*n, cioè OLTRE
// l'ultima candela. In Live quel margine serve; a mercato chiuso non serve piu' niente, ed e'
// spazio vuoto preso a pieno diritto. Il click spegne l'auto-segui, e con l'auto-segui spento il
// congelamento non aveva piu' niente da trattenere: la finestra restava nella zona morta.
//
// Il test misura il COMPORTAMENTO: a mercato chiuso il tetto di viewEnd è l'ultima candela
// APERTA. E la prova di controllo: a mercato aperto il margine resta (la cura non deve togliere
// lo spazio per gli orari futuri, che e' richiesto esplicito).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Venerdi' 6 novembre aperto fino alle 22, poi weekend chiuso.
const VEN = Date.UTC(2026, 10, 6, 20, 0, 0);

const PREPARA = () => {
  const VEN = Date.UTC(2026,10,6,20,0,0);
  rows = []; baseRows = []; let p = 4100;
  for (let i = 0; i < 120; i++) {                       // 120 candele APERTE (venerdi' sera)
    const t = VEN + i * 60000, o = p, c = p + Math.sin(i / 7) * 2;
    rows.push({date: new Date(t).toISOString(), open: o, high: Math.max(o, c) + 1,
               low: Math.min(o, c) - 1, close: c, volume: 10});
    p = c;
  }
  for (let i = 0; i < 60; i++) {                        // 60 candele CHIUSE (sabato/domenica)
    const t = VEN + 120 * 60000 + (i + 1) * 3600000;
    rows.push({date: new Date(t).toISOString(), open: 4100, high: 4101, low: 4099, close: 4100, volume: 0});
  }
  baseRows = rows.slice(); idx = rows.length - 1; viewEnd = rows.length;
  currentAssetKey = 'XAUUSD'; csvLibrary = [{id: 'xau', rows}];
  liveModeActive = true; liveReplayActive = false; mt5Connected = false;
};

test('a mercato chiuso il tetto di viewEnd e\' l\'ultima candela APERTA, non oltre', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      (${PREPARA})();
      orariAsset['XAUUSD'] = {zona:'UTC',giorni:{mon:[],tue:[],wed:[],thu:[],fri:['00:00 - 22:00'],sat:[],sun:[]},
                              stato:'CLOSED',letto:Date.now()};
      const tetto = maxViewEnd();
      const aperte = rows.filter(r => !fblMercatoFermoOra('XAUUSD', Date.parse(r.date))).length;
      // E la finestra costruita su quel tetto non mostra candele oltre la chiusura.
      viewEnd = tetto;
      const viste = getVisibleData();
      const ultimaVista = viste.length ? viste[viste.length-1].date : null;
      return {tetto: tetto, aperte: aperte, ultimaVista: ultimaVista,
              chiusura: new Date(Date.UTC(2026,10,6,22,0,0)).toISOString()};
    })()`);
    assert.equal(r.tetto, r.aperte,
      'il tetto deve essere le candele aperte: ' + JSON.stringify(r));
    assert.ok(Date.parse(r.ultimaVista) <= Date.parse(r.chiusura),
      "e l'ultima candela mostrata non deve superare la chiusura: " + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: a mercato aperto il margine futuro resta (richiesto esplicito)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      (${PREPARA})();
      // MT5 dice che il mercato e' aperto: sabato o no, cosi' si prova il caso senza
      // dipendere dal giorno in cui gira il collaudo.
      fblMercatoMt5Cache['XAUUSD'] = {aperto: true, letto: Date.now()};
      const tetto = maxViewEnd();
      return {tetto: tetto, idx: idx, n: getVisibleCount()};
    })()`);
    assert.ok(r.tetto > r.idx,
      "a mercato aperto il margine oltre l'ultima candela deve restare: " + JSON.stringify(r));
    assert.ok(r.tetto <= r.idx + Math.max(1, Math.floor(r.n * 0.85)),
      "e resta il margine di prima, non di piu: " + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("a mercato chiuso ci si puo' spostare DENTRO le candele vere, non oltre", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // NOTA SUI DATI, che e' anche la lezione: la chiusura si decide sull'ora di ROMA
    // (liveSessionPhaseAt passa da romeDayAndMinute), non sull'UTC. Le candele qui sotto
    // sono in UTC: 20:00-20:59 UTC = 21:00-21:59 Roma, quindi APERTE; da 21:00 UTC
    // (= 22:00 Roma) in poi CHIUSE. Il numero di candele aperte non va scritto a mano:
    // lo misura il testo, cosi' non dipende dal fuso.
    const r = await pagina.evaluate(`(() => {
      (${PREPARA})();
      orariAsset['XAUUSD'] = {zona:'UTC',giorni:{mon:[],tue:[],wed:[],thu:[],fri:['00:00 - 22:00'],sat:[],sun:[]},
                              stato:'CLOSED',letto:Date.now()};
      const aperte = rows.filter(r => !fblMercatoFermoOra('XAUUSD', Date.parse(r.date))).length;
      followLatest = false;                       // l'utente ha appena cliccato sul grafico
      viewEnd = Math.min(20, aperte-1);  const a = getViewWindow().end;
      viewEnd = Math.min(55, aperte-1);  const b = getViewWindow().end;
      viewEnd = aperte + 40;                     // prova a sfondare: non deve potere
      const sfondato = getViewWindow().end;
      return {aperte: aperte, a: a, b: b, sfondato: sfondato};
    })()`);
    assert.ok(r.aperte > 5, 'la prova deve avere candele aperte da contare: ' + JSON.stringify(r));
    assert.ok(r.b !== r.a, 'spostarsi avanti deve cambiare la finestra: ' + JSON.stringify(r));
    assert.ok(r.b <= r.aperte, 'restando dentro le candele vere: ' + JSON.stringify(r));
    assert.ok(r.sfondato <= r.aperte,
      'e non si deve potere sfondare nella zona morta: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
