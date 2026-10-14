// RESA DELLA SALA: ANCHE IL MASSIMO CALO IN UNA SOLA GIORNATA.
//
// RICHIESTO dal proprietario: «oltre a farci visualizzare la resa della sala sul conto iniziale,
// come sarebbe finito il conto, le operazioni contate, il guadagno medio per operazione, in
// guadagno/in perdita, il calo massimo dal punto più alto, dobbiamo inserirci anche il massimo
// drawdown giornaliero accanto al massimo drawdown dal punto più alto».
//
// Dicono due cose diverse: una sala può non essere mai scesa molto dal picco e avere comunque una
// giornata storta che una prop firm non perdona (il suo limite è giornaliero, non sul picco).
//
// Come si prova che il test serve: senza ddGiorno in rendCurva il primo test va rosso (undefined).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Due giorni: il primo sale, il secondo scende parecchio ma mai sotto il punto di partenza.
const U = (giorno, ora) => Date.UTC(2026, 0, giorno, ora, 0, 0);

test('il calo di una sola giornata si conta dal saldo con cui la giornata e\' cominciata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((u) => {
      const U2 = eval('(' + u + ')');
      // Rischio 10% per operazione: +1R, +1R (giorno 2), poi -1R, -1R (giorno 3).
      const ris = [
        {valutato: true, tFill: U2(2, 9), raggiunti: 1, tps: [2], entry: 1, sl: 0.9, slPreso: false},
        {valutato: true, tFill: U2(2, 15), raggiunti: 1, tps: [2], entry: 1, sl: 0.9, slPreso: false},
        {valutato: true, tFill: U2(3, 9), raggiunti: 0, tps: [2], entry: 1, sl: 0.9, slPreso: true},
        {valutato: true, tFill: U2(3, 15), raggiunti: 0, tps: [2], entry: 1, sl: 0.9, slPreso: true}
      ];
      const c = window.fblCronoRendCurva(ris, 10000, 10, null, null);
      const ultimo = c.punti[c.punti.length - 1];
      return {ddGiorno: c.ddGiorno, ddMax: c.ddMax, suiPunti: ultimo.ddGiorno,
              primo: c.punti[0].ddGiorno, quanti: c.punti.length};
    }, U.toString());
    assert.equal(typeof r.ddGiorno, 'number', 'la curva deve dire il calo giornaliero massimo');
    assert.equal(r.primo, 0, 'al primo punto non c\'e\' ancora nessun calo');
    assert.ok(r.ddGiorno > 0, 'il secondo giorno perde: il calo giornaliero non puo\' essere zero');
    assert.equal(r.suiPunti, r.ddGiorno, 'ogni punto si porta dietro il conto di allora, per lo scorrimento');
    // Due perdite del 10% nella stessa giornata: -19% dal saldo d'inizio giornata.
    assert.ok(Math.abs(r.ddGiorno - 19) < 0.5, 'atteso circa 19%, trovato ' + r.ddGiorno);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il calo giornaliero e\' una cosa diversa dal calo dal punto piu\' alto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((u) => {
      const U2 = eval('(' + u + ')');
      // Una perdita sola, in un giorno solo: dal picco e dalla giornata coincidono.
      // Due perdite in giorni DIVERSI: dal picco si sommano, nella giornata no.
      const spalmate = [
        {valutato: true, tFill: U2(2, 9), raggiunti: 0, tps: [2], entry: 1, sl: 0.9, slPreso: true},
        {valutato: true, tFill: U2(3, 9), raggiunti: 0, tps: [2], entry: 1, sl: 0.9, slPreso: true},
        {valutato: true, tFill: U2(4, 9), raggiunti: 0, tps: [2], entry: 1, sl: 0.9, slPreso: true}
      ];
      const c = window.fblCronoRendCurva(spalmate, 10000, 10, null, null);
      return {ddMax: c.ddMax, ddGiorno: c.ddGiorno};
    }, U.toString());
    assert.ok(r.ddMax > r.ddGiorno,
      'tre perdite in tre giorni: dal picco si sommano (' + r.ddMax.toFixed(1) + '%), nella singola giornata no ('
      + r.ddGiorno.toFixed(1) + '%)');
    assert.ok(Math.abs(r.ddGiorno - 10) < 0.5, 'una perdita al giorno = circa 10% al giorno');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la cifra si vede a schermo, accanto al calo dal punto piu\' alto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      window.fblRendProva({punti: [{t: Date.UTC(2026, 0, 2, 9), cap: 10000, usate: 0, vinte: 0, perse: 0, sommaR: 0, ddMax: 0, ddGiorno: 0},
                                   {t: Date.UTC(2026, 0, 2, 15), cap: 9100, usate: 1, vinte: 0, perse: 1, sommaR: -1, ddMax: 9, ddGiorno: 9}],
                           finale: 9100, usate: 1, vinte: 0, perse: 1, sommaR: -1, ddMax: 9, ddGiorno: 9, resa: -9}, 10000);
      return document.getElementById('fblRendRiepilogo').textContent;
    });
    assert.match(r, /calo massimo dal punto più alto/, 'il calo dal picco deve restare');
    assert.match(r, /massimo calo in una sola giornata/, 'manca il calo giornaliero nel riepilogo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
