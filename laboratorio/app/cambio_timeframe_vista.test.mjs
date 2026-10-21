// AL CAMBIO DI TIMEFRAME IL GRAFICO NON SALTA DA UN'ALTRA PARTE.
//
// SEGNALATO dal proprietario: «ho cambiato il timeframe da un'ora, sono passato a un minuto,
// siamo il 21 di ottobre, mi e' andato al 12 marzo. Cosi', in maniera proprio totalmente casuale.
// Questo non deve assolutamente avvenire. E' inaccettabile».
//
// NON ERA CASUALE. La regola era «conserva la stessa finestra di TEMPO REALE»: sensata in
// apparenza, ma da 1 ora a 1 minuto moltiplica per 60. Misurato su uno storico come quello di un
// conto MT5 vero (marzo -> oggi), partendo da una vista a 1h:
//     60 candele -> 3.600 candele di 1m, bordo sinistro 19 ottobre
//    600 candele -> 36.000, bordo sinistro 26 settembre
//  2.000 candele -> 120.000, bordo sinistro 30 luglio
//  5.000 candele -> 300.000, bordo sinistro 27 MARZO   <- il "12 marzo" del proprietario
//
// E c'era un secondo difetto sotto il primo: il CENTRO non veniva rispettato. viewEnd restava
// incollato all'ultima candela (misurato: 321.870 in tutti e cinque i casi), quindi la finestra
// era ancorata a destra e il bordo sinistro scappava indietro di mesi.
//
// Lo stesso numero spiega la lentezza al cambio timeframe, segnalata separatamente: ricostruire e
// disegnare trecentomila candele costa, e non serve a niente - oltre un certo punto una candela
// e' piu' sottile di un pixel.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Uno storico come quello vero: 1h da marzo a oggi, 1m piu' corto ma pur sempre di mesi.
const SCENARIO = (candele1h, alBordo) => {
  const fine = Date.UTC(2026, 9, 21, 12, 0, 0);
  const mk = (tf, da) => {
    const R = [];
    for (let t = da; t <= fine; t += tf * 60000)
      R.push({date: new Date(t).toISOString(), open: 100, high: 101, low: 99, close: 100, volume: 1});
    return R;
  };
  rows = mk(60, Date.UTC(2026, 2, 1)); baseRows = rows; currentTF = 60;
  idx = rows.length - 1;
  followLatest = false;
  visibleCount = candele1h;
  // Al bordo live, oppure scorso indietro di un mese (720 candele da un'ora).
  viewEnd = alBordo ? idx : Math.max(0, idx - 720);
  const foto = fblVistaFotografa();
  rows = mk(1, Date.UTC(2026, 2, 12)); baseRows = rows; currentTF = 1; idx = rows.length - 1;
  fblVistaRipristina(foto);
  const n = getVisibleCount();
  const sin = Math.max(0, Math.round(viewEnd - (n - 1)));
  const des = Math.min(rows.length - 1, Math.round(viewEnd));
  return {
    centroFoto: foto && foto.tCentro,
    visibili: Math.round(visibleCount),
    sinistra: rows[sin] ? Date.parse(rows[sin].date) : null,
    destra: rows[des] ? Date.parse(rows[des].date) : null,
    ultima: Date.parse(rows[rows.length - 1].date),
    tetto: fblTettoCandele()
  };
};

test('da 1 ora a 1 minuto non si finisce mesi indietro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(({s}) => {
      const fai = eval('(' + s + ')');
      return [60, 600, 5000].map(c => fai(c, false));
    }, {s: SCENARIO.toString()});
    r.forEach((x, i) => {
      // Il bordo sinistro non deve stare piu' di una settimana prima del centro che si guardava:
      // con il difetto era a mesi di distanza.
      const giorni = (x.centroFoto - x.sinistra) / 86400000;
      assert.ok(giorni < 7,
        'caso ' + i + ': il bordo sinistro sta ' + giorni.toFixed(0) + ' giorni prima del centro');
      assert.ok(x.visibili <= x.tetto,
        'caso ' + i + ': ' + x.visibili + ' candele visibili, oltre il tetto di ' + x.tetto);
    });
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('si resta sul momento che si stava guardando', async () => {
  // Il cuore della richiesta: «resti dove stavi guardando». Il centro fotografato deve cadere
  // DENTRO la finestra che si vede dopo il cambio.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(({s}) => {
      const fai = eval('(' + s + ')');
      return [60, 600, 5000].map(c => fai(c, false));
    }, {s: SCENARIO.toString()});
    r.forEach((x, i) => {
      assert.ok(x.centroFoto >= x.sinistra && x.centroFoto <= x.destra,
        'caso ' + i + ': il momento che si guardava (' + new Date(x.centroFoto).toISOString()
        + ') deve stare fra ' + new Date(x.sinistra).toISOString() + ' e '
        + new Date(x.destra).toISOString());
    });
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ma se si stava guardando il bordo live, li\' si resta', async () => {
  // Il centro da solo non basta: il centro di una vista che finisce "adesso" e' mezza finestra
  // fa, e riportarcisi lascerebbe l'ultima candela fuori schermo proprio a chi stava guardando il
  // prezzo di adesso.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(({s}) => {
      const fai = eval('(' + s + ')');
      return fai(200, true);
    }, {s: SCENARIO.toString()});
    assert.equal(r.destra, r.ultima,
      'il bordo destro deve restare sull\'ultima candela: ' + new Date(r.destra).toISOString());
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il tetto non rovina il caso normale: 1m -> 5m conserva la finestra di tempo', async () => {
  // La prova di controllo. Il tetto deve mordere SOLO quando il conto esplode: nei salti di tutti
  // i giorni la regola di prima (stessa finestra di tempo reale) deve restare intatta, altrimenti
  // la cura avrebbe cambiato il comportamento anche dove andava bene.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const fine = Date.UTC(2026, 9, 21, 12, 0, 0);
      const mk = (tf) => { const R = [];
        for (let t = fine - 20000 * tf * 60000; t <= fine; t += tf * 60000)
          R.push({date: new Date(t).toISOString(), open: 100, high: 101, low: 99, close: 100, volume: 1});
        return R; };
      rows = mk(1); baseRows = rows; currentTF = 1; idx = rows.length - 1;
      followLatest = false; viewEnd = Math.max(0, idx - 500); visibleCount = 300;
      const foto = fblVistaFotografa();          // 300 minuti di finestra
      rows = mk(5); baseRows = rows; currentTF = 5; idx = rows.length - 1;
      fblVistaRipristina(foto);
      return {visibili: Math.round(visibleCount), minutiFoto: Math.round(foto.minuti),
              tetto: fblTettoCandele()};
    });
    assert.equal(r.minutiFoto, 300, 'la finestra fotografata e\' di 300 minuti');
    assert.equal(r.visibili, 60,
      '300 minuti in candele da 5 fanno 60 candele: il tetto (' + r.tetto + ') non deve entrarci');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
