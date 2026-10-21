// LA PERCENTUALE DI CARICAMENTO DEVE DIRE QUALCOSA DI VERO.
//
// SEGNALATO dal proprietario: «quando mostra la percentuale di caricamento del grafico, in realta'
// rimane sempre al 0% e non aumenta. Rimane sempre al 0% e poi apre, e fine li'. Invece dovrebbe
// mostrare un andamento verosimile con il caricamento definitivo del grafico».
//
// ERA ARITMETICA: i passi sono tre e la percentuale era `passo/3`. Il primo passo e' lo ZERO,
// quindi il riquadro si apriva a 0%; e quando lo storico arriva dalla cache - il caso piu'
// frequente - dal passo 0 si salta dritti alla fine senza passare per gli altri due. Da fuori:
// 0%, poi il grafico. Una barra ferma a zero sembra un programma bloccato, ed e' peggio di
// nessuna barra.
//
// LE DUE REGOLE, e la seconda e' quella che la tiene onesta:
//   1. MAI ZERO: se il riquadro e' a schermo, qualcosa sta davvero succedendo;
//   2. MAI CENTO PRIMA DELLA FINE: dentro un passo la barra avanza verso il successivo ma non lo
//      raggiunge mai. Il 100% lo scrive solo chi ha finito davvero. Una barra che arriva a 100 e
//      poi resta li' e' la versione peggiore del difetto di partenza: dice una cosa falsa invece
//      di non dire niente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('non parte mai da zero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      fblCaricamentoMostra('EURUSD', 0);
      const pct = fblCaricamentoPct();
      fblCaricamentoFine();
      return pct;
    });
    assert.ok(r > 0, 'appena aperto deve gia\' mostrare qualcosa, non 0%: ' + r);
    assert.ok(r <= 20, 'ma nemmeno fingere di essere a meta\' strada: ' + r);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('avanza quando il caricatore dice quanto ha fatto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      fblCaricamentoMostra('EURUSD', 0);
      const a = fblCaricamentoPct();
      fblCaricamentoFrazione(0.5);
      const b = fblCaricamentoPct();
      fblCaricamentoMostra('EURUSD', 1);
      const c = fblCaricamentoPct();
      fblCaricamentoMostra('EURUSD', 2);
      const d = fblCaricamentoPct();
      fblCaricamentoFine();
      return {a, b, c, d};
    });
    assert.ok(r.b > r.a, 'meta\' del primo passo deve valere piu\' del suo inizio: ' + JSON.stringify(r));
    assert.ok(r.c > r.b, 'il secondo passo piu\' del primo: ' + JSON.stringify(r));
    assert.ok(r.d > r.c, 'il terzo piu\' del secondo: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('non arriva mai a 100 finche\' il caricamento non e\' finito', async () => {
  // La regola che la tiene onesta. Una barra che arriva a 100 e poi resta ferma e' peggio di una
  // che resta a zero: la prima dice una cosa falsa, la seconda non dice niente.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      fblCaricamentoMostra('EURUSD', 2);          // ultimo passo
      fblCaricamentoFrazione(1);                  // e dichiarato finito DENTRO il passo
      const prima = fblCaricamentoPct();
      // E anche lasciandola correre da sola, la stima non deve mai toccare il fondo.
      for (let i = 0; i < 200; i++) fblCaricamentoFrazione(0.999);
      const dopo = fblCaricamentoPct();
      fblCaricamentoFine();
      return {prima, dopo};
    });
    assert.ok(r.prima < 100, 'dentro l\'ultimo passo non si scrive 100: ' + r.prima);
    assert.ok(r.dopo < 100, 'e nemmeno insistendo: ' + r.dopo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('alla fine il riquadro sparisce e il contatore si azzera', async () => {
  // Due cose insieme: il riquadro non deve restare a coprire il grafico, e lo stato non deve
  // restare sporco - altrimenti il caricamento SUCCESSIVO ripartirebbe da dove era arrivato
  // questo, mostrando una percentuale che non ha niente a che fare con lui.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      fblCaricamentoMostra('EURUSD', 1);
      fblCaricamentoFrazione(0.9);
      fblCaricamentoFine();
      const resta = !!document.getElementById('fblCaricamentoAsset');
      fblCaricamentoMostra('XAUUSD', 0);
      const nuovo = fblCaricamentoPct();
      fblCaricamentoFine();
      return {resta, nuovo};
    });
    assert.equal(r.resta, false, 'il riquadro deve sparire');
    assert.ok(r.nuovo <= 20,
      'e il caricamento dopo deve ripartire dall\'inizio, non da dove era arrivato quello prima: '
      + r.nuovo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
