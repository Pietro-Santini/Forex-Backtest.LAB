// OPERAZIONI A BLOCCO ANCHE SU KRAKEN.
//
// RICHIESTO dal proprietario: «dobbiamo inserire il pulsante operazioni a blocco anche per le
// posizioni kraken». C'erano per le posizioni dell'app e per il Trade Journal, non qui — e su
// Kraken le posizioni di un segnale sono spesso tre o quattro insieme, cioè proprio il caso in
// cui servono.
//
// VALE LA STESSA REGOLA DELLE ALTRE, ed è il motivo per cui questi test contano le conferme:
// UNA sola domanda per tutte, mai una per posizione. Sul conto Kraken la chiusura passa dal
// ponte, e un popup per posizione vorrebbe dire restare a premere «sì» mentre il prezzo corre.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Tre posizioni: due in guadagno, una in perdita. Due contratti diversi, due lati diversi.
const PREPARA = () => {
  krakenConto = {collegato: true, ambiente: 'simulato', saldo: 10000, conto_id: 'conto-1', leva: 5};
  krakenPosizioni = {posizioni: [
    {simbolo: 'PF_XBTUSD', lato: 'BUY',  quantita: 1, entrata: 100, mark: 110, sl: 90, tp: [], pnl: 120},
    {simbolo: 'PF_SOLUSD', lato: 'BUY',  quantita: 5, entrata: 200, mark: 210, sl: 190, tp: [], pnl: 50},
    {simbolo: 'PF_SOLUSD', lato: 'SELL', quantita: 2, entrata: 300, mark: 310, sl: 320, tp: [], pnl: -80}
  ]};
  krakenPendenti = [];
  window._mandato = [];
  window._conferme = [];
  window.krakenBridge = async (p, corpo) => { window._mandato.push({p, corpo}); return {ok: true, data: {}}; };
  window.krakenLeggiPosizioni = async () => {};
  window.krakenAggiornaConto = () => {};
  window.krakenLeggiStorico = () => {};
  window.appConfirm = async (t) => { window._conferme.push(String(t || '')); return true; };
  appConfirm = window.appConfirm;
  krakenSelezionata = '';
  krakenPosPannello();
};

test('il menu delle operazioni a blocco c\'è, sopra la tabella Kraken', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const m = document.getElementById('krakenBloccoMenu');
      if (!m) return {manca: true};
      const voci = [...m.querySelectorAll('button')].map(b => b.textContent.trim());
      return {titolo: m.querySelector('summary').textContent.trim(), voci};
    }, PREPARA.toString());
    assert.equal(r.manca, undefined, 'nel riquadro Kraken manca il menu delle operazioni a blocco');
    assert.match(r.titolo, /blocco/i, 'il pulsante deve dirsi: ' + r.titolo);
    assert.ok(r.voci.some(v => /Chiudi tutte$/.test(v)), 'manca «Chiudi tutte»: ' + r.voci.join(' | '));
    assert.ok(r.voci.some(v => /in guadagno/i.test(v)), 'manca «in guadagno»');
    assert.ok(r.voci.some(v => /in perdita/i.test(v)), 'manca «in perdita»');
    assert.ok(r.voci.some(v => /pareggio/i.test(v)), 'manca lo stop a pareggio');
    // Due contratti diversi: si deve poter agire su uno solo.
    assert.ok(r.voci.some(v => /PF_SOLUSD/.test(v)), 'con piu\' contratti serve anche «un contratto alla volta»');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('«Chiudi tutte»: una conferma sola, e tre chiusure al ponte', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      await krakenBloccoChiudi(() => true, 'Tutte le posizioni');
      return {conferme: window._conferme.length, testo: window._conferme[0] || '',
              mandato: window._mandato};
    }, PREPARA.toString());
    assert.equal(r.conferme, 1, 'una domanda sola per tutte e tre: ' + r.conferme);
    assert.equal(r.mandato.length, 3, 'e tre chiusure al ponte');
    assert.ok(r.mandato.every(m => m.p === '/chiudi'), 'tutte su /chiudi');
    assert.match(r.testo, /3 posizioni/, 'la domanda deve dire quante: ' + r.testo);
    assert.match(r.testo, /Risultato di adesso/, 'e quanto rendono adesso: ' + r.testo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('«in guadagno» chiude solo quelle in guadagno, «in perdita» solo l\'altra', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      await krakenBloccoChiudi(x => Number(x.pnl) > 0, 'Le posizioni in guadagno');
      const guadagno = window._mandato.map(m => m.corpo.simbolo);
      window._mandato = [];
      await krakenBloccoChiudi(x => Number(x.pnl) < 0, 'Le posizioni in perdita');
      return {guadagno, perdita: window._mandato.map(m => m.corpo.simbolo)};
    }, PREPARA.toString());
    assert.deepEqual(r.guadagno.sort(), ['PF_SOLUSD', 'PF_XBTUSD'], 'le due in guadagno');
    assert.deepEqual(r.perdita, ['PF_SOLUSD'], 'e la sola in perdita');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('lo stop a pareggio in blocco manda l\'ENTRATA di ogni posizione, non un valore solo', async () => {
  // Ogni posizione ha il SUO prezzo di entrata: mandarne uno per tutte metterebbe lo stop di una
  // dalla parte sbagliata, e quella si chiuderebbe all'istante.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      await krakenBloccoPareggio(() => true, 'Tutte le posizioni');
      return {conferme: window._conferme.length, mandato: window._mandato};
    }, PREPARA.toString());
    assert.equal(r.conferme, 1, 'una conferma sola anche qui');
    assert.equal(r.mandato.length, 3);
    assert.ok(r.mandato.every(m => m.p === '/sl'), 'tutte su /sl');
    const perSimbolo = {};
    r.mandato.forEach(m => { perSimbolo[m.corpo.simbolo + '-' + m.corpo.sl] = true; });
    assert.ok(perSimbolo['PF_XBTUSD-100'], 'BTC a 100, la sua entrata');
    assert.ok(perSimbolo['PF_SOLUSD-200'] && perSimbolo['PF_SOLUSD-300'],
      'le due SOL devono andare ognuna alla PROPRIA entrata: ' + JSON.stringify(r.mandato.map(m => m.corpo)));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('chi annulla non manda niente al ponte', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      window.appConfirm = async () => false; appConfirm = window.appConfirm;
      await krakenBloccoChiudi(() => true, 'Tutte le posizioni');
      await krakenBloccoPareggio(() => true, 'Tutte le posizioni');
      return {mandato: window._mandato.length};
    }, PREPARA.toString());
    assert.equal(r.mandato, 0, 'annullando non si tocca niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('sul conto con soldi veri la domanda lo dice', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      krakenConto.ambiente = 'reale';
      await krakenBloccoChiudi(() => true, 'Tutte le posizioni');
      return {testo: window._conferme[0] || ''};
    }, PREPARA.toString());
    assert.match(r.testo, /SOLDI VERI/i, 'su un conto reale va detto: ' + r.testo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nel riquadro di schermo intero non c\'è più «Operazione»', async () => {
  // RICHIESTO: «togliamo operazione, non serve visualizzarlo lì, anche perché ne abbiamo più di
  // una, quindi ce ne visualizzerebbe solo una e non avrebbe senso». Il P/L live resta: quello è
  // la somma di TUTTE, e per tutte ha senso.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const el = document.createElement('div');
      el.id = 'fblMiniDash';
      document.body.appendChild(el);
      fblMiniDashAggiorna();
      return {html: el.innerHTML};
    }, PREPARA.toString());
    assert.ok(!/Operazione/i.test(r.html),
      'la riga «Operazione» non deve esserci piu\': ' + r.html.slice(0, 300));
    assert.match(r.html, /P\/L live/, 'il P/L live invece resta: ' + r.html.slice(0, 200));
    assert.match(r.html, /Margine libero/, 'e anche il margine libero');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
