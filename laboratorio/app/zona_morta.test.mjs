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
    // ATTENZIONE AI DATI: devono stare DENTRO la chiusura, non sforare su lunedi' mattina
    // (che e' una fascia APERTA). Con l'ultima candela su una fascia aperta la coda chiusa non
    // parte e l'autosegui non ha niente da trattenere: misurato, la vista schizzava avanti.
    if (t > Date.UTC(2026,10,8,22,0,0)) break;          // fino a domenica sera, non oltre
    rows.push({date: new Date(t).toISOString(), open: 4100, high: 4101, low: 4099, close: 4100, volume: 0});
  }
  baseRows = rows.slice(); idx = rows.length - 1; viewEnd = rows.length;
  currentAssetKey = 'XAUUSD'; csvLibrary = [{id: 'xau', rows}];
  liveModeActive = true; liveReplayActive = false; mt5Connected = false;
};

test("a mercato chiuso, CON L'AUTOSEGUI ACCESO, il tetto e' l'ultima candela APERTA", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      (${PREPARA})();
      orariAsset['XAUUSD'] = {zona:'UTC',giorni:{mon:[],tue:[],wed:[],thu:[],fri:['00:00 - 22:00'],sat:[],sun:[]},
                              stato:'CLOSED',letto:Date.now()};
      followLatest = true;                       // autosegui acceso: non si scappa avanti da solo
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

test("cliccare sul grafico NON fa saltare la vista nella zona morta (difetto dell'8 novembre)", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // Il difetto originale era proprio questo: «clicco sul grafico e lui si sposta da solo
    // nella zona morta, in modo del tutto casuale». La cura mette il tetto sull'autosegui;
    // questa prova controlla che il CLIC - che toglie l'autosegui e quindi allarga il tetto -
    // non sposti niente da solo: un clic senza trascinamento deve lasciare la vista dov'era.
    const r = await pagina.evaluate(`(() => {
      (${PREPARA})();
      orariAsset['XAUUSD'] = {zona:'UTC',giorni:{mon:[],tue:[],wed:[],thu:[],fri:['00:00 - 22:00'],sat:[],sun:[]},
                              stato:'CLOSED',letto:Date.now()};
      const aperte = rows.filter(r => !fblMercatoFermoOra('XAUUSD', Date.parse(r.date))).length;
      followLatest = true; viewEnd = idx;         // in fondo, sull'ultima candela
      const prima = getViewWindow().end;
      const cv = document.getElementById('chart');
      // Il puntatore è sintetico: non c'è un dito vero, e senza queste due righe
      // setPointerCapture/releasePointerCapture lanciano (lo fanno già le altre prove).
      cv.setPointerCapture = () => {}; cv.releasePointerCapture = () => {};
      const b = cv.getBoundingClientRect();
      const X = b.left + b.width/2, Y = b.top + b.height/2;
      const tocca = (tipo) => cv.dispatchEvent(new PointerEvent(tipo, {
        pointerId: 3, pointerType: 'mouse', bubbles: true, cancelable: true,
        clientX: X, clientY: Y, button: 0, buttons: 1 }));
      tocca('pointerdown');                       // clic (senza pointermove: nessun trascinamento)
      tocca('pointerup');
      const dopo = getViewWindow().end;
      // E anche dieci clic in fila: nessuno deve spostare niente.
      for (let i = 0; i < 10; i++) { tocca('pointerdown'); tocca('pointerup'); }
      const dopoDieci = getViewWindow().end;
      return {aperte, prima, dopo, dopoDieci, tetto: maxViewEnd()};
    })()`);
    assert.equal(r.prima, r.aperte, 'la vista parte sull\'ultima candela aperta: ' + JSON.stringify(r));
    assert.equal(r.dopo, r.prima,
      'cliccare non deve spostare la vista: ' + JSON.stringify(r));
    assert.equal(r.dopoDieci, r.prima,
      'e nemmeno dieci clic in fila (era "del tutto casuale"): ' + JSON.stringify(r));
    assert.ok(r.tetto > r.aperte,
      'col tetto aperto dall\'autosegui spento lo spostamento a mano e\' possibile: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("con l'autosegui acceso il grafico non scappa nella zona morta, a mano si entra", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // LE DUE RICHIESTE DEL PROPRIETARIO, che sembrano opposte e non lo sono:
    //   8 novembre: «clicco sul grafico e lui si sposta da solo nella zona morta» -> con
    //              l'AUTOSEGUI acceso la finestra non deve avanzare oltre l'ultima candela;
    //   9 novembre: «il grafico non mi permette di andare oltre l'ultima candela
    //              spostandomi» -> con lo spostamento A MANO si deve potere, fino in fondo
    //              ai dati. MISURATO prima della cura: si fermava alla candela 60 su 180
    //              righe, non si arrivava nemmeno all'ultima candela vera.
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
      const n = getVisibleCount();
      // AUTOSEGUI ACCESO: la finestra non avanza da sola oltre l'ultima candela aperta.
      followLatest = true;
      viewEnd = aperte + 40;                     // prova a sfondare da solo
      const auto = getViewWindow().end;
      // SPOSTAMENTO A MANO: si arriva fino all'ultima candela VERA, e anche oltre.
      followLatest = false;                      // l'utente ha appena spostato il grafico
      viewEnd = Math.min(20, aperte-1);  const a = getViewWindow().end;
      viewEnd = Math.min(55, aperte-1);  const b = getViewWindow().end;
      viewEnd = rows.length - 1;                 // voglio l'ULTIMA candela vera
      const sullUltima = getViewWindow().end;
      viewEnd = rows.length + 40;                // e oltre, nello spazio vuoto
      const oltre = getViewWindow().end;
      return {aperte, n, a, b, auto, sullUltima, oltre,
              righe: rows.length, margine: idx + Math.max(1, Math.floor(n * 0.85))};
    })()`);
    assert.ok(r.aperte > 5, 'la prova deve avere candele aperte da contare: ' + JSON.stringify(r));
    assert.equal(r.auto, r.aperte,
      'con l\'autosegui acceso non si scappa nella zona morta: ' + JSON.stringify(r));
    assert.ok(r.b !== r.a, 'spostarsi avanti a mano deve cambiare la finestra: ' + JSON.stringify(r));
    assert.ok(r.b <= r.aperte, 'restando dentro le candele vere: ' + JSON.stringify(r));
    assert.ok(r.sullUltima >= r.righe - 1,
      'spostandosi a mano si deve arrivare fino all\'ULTIMA candela vera (misurato prima della'
      + ' cura: si fermava all\'ultima APERTA): ' + JSON.stringify(r));
    assert.ok(r.oltre > r.sullUltima,
      'e si deve potere andare oltre, nello spazio vuoto dopo l\'ultima candela: ' + JSON.stringify(r));
    assert.ok(r.oltre <= r.margine,
      'ma non all\'infinito: il margine e\' quello di sempre: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
