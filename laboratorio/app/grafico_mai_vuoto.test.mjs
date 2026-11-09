// A MERCATO CHIUSO IL TAGLIO NON DEVE MAI SVUOTARE IL GRAFICO.
//
// SEGNALATO dal proprietario (7 novembre 2026), nella finestra duplicata: «clicco sul grafico
// e mi spariscono candele e indicatori; devo premere \"torna all'ultima candela\" per farli
// tornare».
//
// CAUSA MISURATA: a mercato chiuso getVisibleData() taglia le candele dopo la chiusura. Il
// punto di taglio si cerca sulla meta' fascia: se la finestra visibile e' TUTTA dopo la
// chiusura (chi scorre nel weekend), il primo elemento risulta chiuso, il punto di taglio e'
// ZERO e `result.slice(0,0)` e' un array VUOTO: il grafico restava bianco. Il difetto
// compariva al primo tocco del grafico perche' toccando si esce dall'auto-segli e la vista
// finisce in una fascia che il taglio azzera.
//
// Chi guarda il passato deve poter guardare il passato: se il taglio non lascia niente, non
// si taglia e si mostra quello che c'e'.
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
  // 60 candele CHIUSE. ATTENZIONE AI DATI, che e' la lezione: devono stare DENTRO la chiusura
  // (sabato e domenica), non sforare su lunedi' mattina. Con l'ultima candela su una fascia
  // APERTA la coda chiusa non parte e l'autosegui non ha niente da trattenere - e la prova
  // diventava dipendente dal giorno in cui gira.
  for (let i = 0; i < 60; i++) {                        // 60 candele CHIUSE (sabato/domenica)
    const t = VEN + 120 * 60000 + (i + 1) * 3600000;
    if (t > Date.UTC(2026,10,8,22,0,0)) break;          // fino a domenica sera, non oltre
    rows.push({date: new Date(t).toISOString(), open: 4100, high: 4101, low: 4099,
               close: 4100, volume: 0});
  }
  baseRows = rows.slice();
  idx = rows.length - 1;
  viewEnd = rows.length;
  currentAssetKey = 'XAUUSD';
  csvLibrary = [{id: 'xau', rows}];
  liveModeActive = true; liveReplayActive = false; mt5Connected = false;
};
const CHIUDI = () => {
  orariAsset['XAUUSD'] = {zona: 'UTC', giorni: {mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: []},
                          stato: 'CLOSED', letto: Date.now()};
};

test('scorrendo nel weekend il grafico NON si svuota (il difetto della duplicata)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      (${PREPARA})();
      (${CHIUDI})();
      // Vista su una fascia TUTTA dopo la chiusura: il caso che svuotava il grafico.
      const prima = rows.length;
      viewEnd = rows.length;                             // in fondo, weekend
      const inFondo = getVisibleData().length;
      viewEnd = rows.length - 30;                        // 30 candele prima
      const primaDellaFine = getVisibleData().length;
      viewEnd = 130;                                     // a cavallo della chiusura
      const aCavallo = getVisibleData().length;
      return {prima, inFondo, primaDellaFine, aCavallo};
    })()`);
    assert.ok(r.prima > 120, 'la prova deve avere candele oltre la chiusura: ' + JSON.stringify(r));
    assert.ok(r.inFondo > 0,
      'in fondo al weekend il grafico deve mostrare qualcosa, non restare bianco: ' + JSON.stringify(r));
    assert.ok(r.primaDellaFine > 0, 'e nemmeno 30 candele prima della fine: ' + JSON.stringify(r));
    assert.ok(r.aCavallo > 0, 'a cavallo della chiusura le candele si vedono: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il taglio continua a togliere le candele FABBRICATE dopo la chiusura', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      (${PREPARA})();
      (${CHIUDI})();
      // Auto-segui, visto sull'ultima candela aperta: le candele dopo la chiusura non si
      // devono vedere (e' la richiesta del 1 novembre, che resta valida).
      followLatest = true;
      viewEnd = 130;
      const viste = getVisibleData();
      const ultima = viste.length ? viste[viste.length - 1].date : null;
      return {n: viste.length, ultima, chiude: Date.parse(viste[0].date) };
    })()`);
    assert.ok(r.n > 0, 'le candele prima della chiusura si vedono: ' + JSON.stringify(r));
    assert.ok(Date.parse(r.ultima) <= Date.UTC(2026,10,6,22,0,0),
      "l'ultima candela mostrata non supera la chiusura: " + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
