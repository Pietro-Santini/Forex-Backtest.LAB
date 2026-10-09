// PASSO 18/19 — linee TP/SL portate a grafico dalla cronologia di una sala.
//
// RICHIESTO dal proprietario (9 ottobre 2026):
//  - le linee di TP e SL NON continuano tutte fino alla candela dell'evento finale: ognuna si ferma
//    alla candela in cui IL SUO livello e' stato colpito;
//  - accanto, alla SINISTRA del punto in cui un TP e' stato preso, una spunta di conferma;
//  - se lo stop NON viene preso, la sua linea ha la stessa lunghezza dell'ultima linea di TP.
//
// La logica sta in due punti: `valuta` (che sa SU QUALE candela ogni TP e lo stop sono scattati) e
// `fblCronoAncore` (che traduce quei tempi in indici di candela a grafico). Qui si provano quei due,
// che e' la parte dove un errore non si vede: il numero esce comunque e sembra sensato.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp, PREPARA_BTC} from './aiuti.mjs';

test('valuta ricorda la candela di OGNI TP e quella dello stop', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // Serie fine da 1 minuto: entrata a mercato a 100, TP 110 (candela 1) e 130 (candela 2).
      const serie = [[
        {t:0,      o:100,h:101,l:99, c:100},
        {t:60000,  o:100,h:111,l:100,c:110},
        {t:120000, o:110,h:131,l:110,c:130},
        {t:180000, o:130,h:132,l:129,c:131}
      ]];
      const preso = fblCronoValuta({ts:-1, direzione:'BUY', entrata:100, sl:90, tp:[110,130], a_mercato:true}, serie);
      // Stop preso senza nessun TP.
      const stop = fblCronoValuta({ts:-1, direzione:'BUY', entrata:100, sl:90, tp:[110,130], a_mercato:true}, [[
        {t:0,     o:100,h:101,l:99, c:100},
        {t:60000, o:100,h:105,l:88, c:92}
      ]]);
      return {presoR:preso.raggiunti, presoTpT:preso.tpT, presoSlT:preso.slT,
              stopSlT:stop.slT, stopR:stop.raggiunti, stopTpT:stop.tpT};
    });
    assert.equal(r.presoR, 2);
    assert.deepEqual(r.presoTpT, [60000, 120000], 'TP1 alla candela 1, TP2 alla candela 2');
    assert.equal(r.presoSlT, null, 'nessuno stop: nessuna candela dello stop');
    assert.equal(r.stopSlT, 60000, 'lo stop segna il tempo della candela in cui e scattato');
    assert.equal(r.stopR, 0);
    assert.deepEqual(r.stopTpT, []);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l ancore fermano ogni linea di TP alla propria candela e lo stop alla sua', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA_BTC);
    const r = await pagina.evaluate(() => {
      currentTF = '1m';
      const t = i => parseDateTime(rows[i].date);
      // TP con prezzi irraggiungibili (1e9): la candela dell'evento la decide solo tFine.
      const acceso = fblCronoAncore({ts:t(10), tFill:t(10), entry:rows[10].close, tFine:t(30), mercato:true,
        tps:[1e9,2e9], raggiunti:2, slPreso:false, tpT:[t(20),t(30)], slT:null});
      const stop = fblCronoAncore({ts:t(10), tFill:t(10), entry:rows[10].close, tFine:t(15), mercato:true,
        tps:[1e9,2e9], raggiunti:0, slPreso:true, tpT:[], slT:t(15), sl:-1e9});
      return {a:acceso.a, tp0:acceso.tpEnd&&acceso.tpEnd[0], tp1:acceso.tpEnd&&acceso.tpEnd[1],
              sl:stop.slEnd};
    });
    assert.equal(r.a, 10, 'entrata sulla candela 10');
    assert.equal(r.tp0, 20, 'TP1 si ferma sulla candela in cui e stato preso');
    assert.equal(r.tp1, 30, 'TP2 si ferma sulla sua candela');
    assert.equal(r.sl, 15, 'lo stop si ferma sulla candela in cui e stato preso');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('Passo 19: stop NON preso → la sua linea finisce dove l ultima di TP', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA_BTC);
    const r = await pagina.evaluate(() => {
      currentTF = '1m';
      const t = i => parseDateTime(rows[i].date);
      // TP1 preso (candela 20), TP2 no; stop non preso. L'ultima linea di TP disegnata e' il TP2 che,
      // non essendo stato preso, arriva all'evento finale (b).
      const an = fblCronoAncore({ts:t(10), tFill:t(10), entry:rows[10].close, tFine:t(40), mercato:true,
        tps:[1e9,2e9], raggiunti:1, slPreso:false, tpT:[t(20)], slT:null});
      return {slEnd:an.slEnd, b:an.b, tp0:an.tpEnd&&an.tpEnd[0], tp1:an.tpEnd&&an.tpEnd[1]};
    });
    assert.equal(r.tp0, 20, 'il TP preso si ferma sulla sua candela');
    assert.equal(r.tp1, null, 'il TP non preso non ha una candela di colpimento');
    assert.equal(r.slEnd, r.b, 'lo stop non preso finisce dove finisce l ultima linea di TP (l evento)');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
