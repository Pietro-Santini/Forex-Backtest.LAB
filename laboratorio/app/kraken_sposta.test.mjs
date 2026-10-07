// Selezionare una posizione Kraken e spostarne stop e target.
//
// RICHIESTO dal proprietario (7 ottobre 2026): «facciamo in modo che nel conto Kraken ci sia la
// possibilità comunque di selezionare la posizione e di spostare quelli che sono TP e SL».
//
// Il campo che il ponte si aspetta è `sl`, non `prezzo`: sbagliarlo non dà errore a schermo, dà
// uno stop che non si muove. Questi test guardano cosa viene mandato davvero.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = () => {
  window._mandato = [];
  krakenConto = {collegato: true, ambiente: 'simulato', saldo: 10000, conto_id: 'conto-1', leva: 5};
  krakenPosizioni = {posizioni: [
    {simbolo: 'PF_XBTUSD', lato: 'BUY', quantita: 1, entrata: 100, mark: 110, sl: 90,
     tp: [{prezzo: 120, quantita: 0.5}, {prezzo: 130, quantita: 0.5}], pnl: 10}
  ]};
  krakenPendenti = [];
  window.krakenBridge = async (p, corpo) => { window._mandato.push({p, corpo}); return {ok: true, data: {}}; };
  window.krakenLeggiPosizioni = async () => {};
  window.appConfirm = async () => true;
  krakenSelezionata = 'PF_XBTUSD';
  krakenPosPannello();
};

const posizione = () => (krakenPosizioni.posizioni[0]);

test('lo stop si manda col campo che il ponte si aspetta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      window.appPrompt = async () => '95';
      await krakenSpostaSl(krakenPosizioni.posizioni[0]);
      return window._mandato;
    }, PREPARA.toString());
    assert.equal(r[0].p, '/sl');
    // Il ponte legge `sl`: con `prezzo` risponderebbe 422 e lo stop resterebbe dov'è.
    assert.deepEqual(r[0].corpo, {simbolo: 'PF_XBTUSD', sl: 95});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la virgola decimale si accetta: in italiano si scrive così', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      window.appPrompt = async () => '95,5';
      await krakenSpostaSl(krakenPosizioni.posizioni[0]);
      return window._mandato[0].corpo.sl;
    }, PREPARA.toString());
    assert.equal(r, 95.5);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('annullando non si manda niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      window.appPrompt = async () => null;
      await krakenSpostaSl(krakenPosizioni.posizioni[0]);
      window.appPrompt = async () => '  ';
      await krakenSpostaSl(krakenPosizioni.posizioni[0]);
      window.appPrompt = async () => 'abc';
      await krakenSpostaSl(krakenPosizioni.posizioni[0]);
      return window._mandato.length;
    }, PREPARA.toString());
    assert.equal(r, 0, 'niente di quello che non è un prezzo deve arrivare al ponte');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i target si danno tutti insieme, separati da «/»', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      window.appPrompt = async () => '120 / 135 / 150';
      await krakenSpostaTp(krakenPosizioni.posizioni[0]);
      return window._mandato;
    }, PREPARA.toString());
    assert.equal(r[0].p, '/tp');
    assert.deepEqual(r[0].corpo, {simbolo: 'PF_XBTUSD', tp: [120, 135, 150]});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('lasciando vuoto si tolgono tutti i target', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      window.appPrompt = async () => '';
      await krakenSpostaTp(krakenPosizioni.posizioni[0]);
      return window._mandato[0].corpo;
    }, PREPARA.toString());
    assert.deepEqual(r, {simbolo: 'PF_XBTUSD', tp: []});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le celle SL e TP si cliccano solo sulla posizione selezionata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      const celle = () => [...document.querySelectorAll('#krakenPosPanel tbody tr:first-child td')];
      const conSelezione = celle().map(td => td.style.cursor);
      krakenSelezionata = '';           // deselezionata
      krakenPosPannello();
      const senzaSelezione = celle().map(td => td.style.cursor);
      return {
        slSelezionata: conSelezione[4], tpSelezionata: conSelezione[5],
        slDeselezionata: senzaSelezione[4], tpDeselezionata: senzaSelezione[5]
      };
    }, PREPARA.toString());
    assert.equal(r.slSelezionata, 'pointer');
    assert.equal(r.tpSelezionata, 'pointer');
    // Un clic distratto su un'altra riga non deve poter toccare il suo stop.
    assert.equal(r.slDeselezionata, '');
    assert.equal(r.tpDeselezionata, '');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
