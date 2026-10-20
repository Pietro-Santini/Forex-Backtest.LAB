// STOP E TARGET DI KRAKEN SI SPOSTANO DAL GRAFICO, NON DALLA TABELLA.
//
// RICHIESTO dal proprietario (20 ottobre 2026): «nelle posizioni kraken ora è in funzione che se
// clicco sulla tabella delle operazioni sul tp-sl mi fa cambiare il valore del prezzo, invece no
// non deve farlo».
//
// COM'ERA, E PERCHE' CAMBIA. Il 7 ottobre aveva chiesto di «poter selezionare la posizione e
// spostare TP e SL», e l'unica strada possibile allora era un clic sulla cella della tabella, che
// apriva una finestrella in cui si scriveva il prezzo. Il 16 ottobre (v165) è arrivata la strada
// vera: si seleziona la posizione, si afferra la linea sul grafico e si trascina. Da quel momento
// il clic in tabella è diventato una SECONDA strada per muovere un ordine reale — e la più facile
// da premere per sbaglio, perché la tabella si scorre col dito.
//
// LA REGOLA ADESSO: le celle SL e TP della tabella non si cliccano e non mandano niente. La cella
// «Eseguita» invece SI' (v167: l'orario di una posizione aperta prima della v163 si dichiara a
// mano) — lì non si muove nessun ordine vero, e questi test tengono fermo anche quello, perché
// togliere il clic sbagliato non deve portarsi via quello giusto.
//
// LE DUE GARANZIE PORTATE QUI DAL VECCHIO BANCO. Erano scritte sui due metodi della tabella, che
// adesso non esistono più; valgono però identiche sulla strada del trascinamento, che è l'unica
// che manda ordini. Se andassero perdute nessuno se ne accorgerebbe a schermo:
//   - il ponte legge il campo `sl`: mandargli `prezzo` non dà errore, dà uno stop che non si muove;
//   - i target si mandano TUTTI insieme: mandando solo quello spostato, gli altri si cancellano.
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
  // Le celle si cercano PER NOME DI COLONNA, non per numero: aggiungendo una colonna ogni numero
  // scivola di un posto e il test finisce a misurare la cella sbagliata (già successo con «Origine»).
  window._cella = (nome) => {
    const nomi = [...document.querySelectorAll('#krakenPosPanel th')].map(t => t.textContent.trim());
    const celle = [...document.querySelectorAll('#krakenPosPanel tbody tr:first-child td')];
    const i = nomi.indexOf(nome);
    return i < 0 ? null : celle[i];
  };
};

test('le celle SL e TP non si cliccano, nemmeno sulla posizione selezionata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      const sl = window._cella('SL'), tp = window._cella('TP');
      if (!sl || !tp) return {manca: true};
      // Se qualcuno ci riattacca un ascoltatore, il clic lo fa scattare e il ponte riceve.
      sl.click(); tp.click();
      await new Promise(r => setTimeout(r, 60));
      return {
        slCursore: sl.style.cursor, tpCursore: tp.style.cursor,
        slSottolineato: sl.style.textDecoration, tpSottolineato: tp.style.textDecoration,
        mandato: window._mandato
      };
    }, PREPARA.toString());
    assert.equal(r.manca, undefined, 'nella tabella Kraken mancano le colonne SL/TP');
    assert.notEqual(r.slCursore, 'pointer', 'la cella SL non deve invitare al clic');
    assert.notEqual(r.tpCursore, 'pointer', 'la cella TP non deve invitare al clic');
    assert.ok(!/underline/.test(r.slSottolineato || ''), 'niente sottolineatura da «cliccami» su SL');
    assert.ok(!/underline/.test(r.tpSottolineato || ''), 'niente sottolineatura da «cliccami» su TP');
    assert.deepEqual(r.mandato, [],
      'un clic sulle celle SL/TP non deve mandare NIENTE al ponte: ' + JSON.stringify(r.mandato));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la cella SL dice dove si sposta lo stop, invece di non dire niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      return {sl: window._cella('SL').title, tp: window._cella('TP').title};
    }, PREPARA.toString());
    assert.match(r.sl, /grafico/i, 'il suggerimento deve indicare la strada giusta: ' + r.sl);
    assert.match(r.tp, /grafico/i, 'idem per i target: ' + r.tp);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la cella «Eseguita» resta cliccabile: togliere il clic sbagliato non porta via quello giusto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      const es = window._cella('Eseguita');
      return es ? {cursore: es.style.cursor, titolo: es.title} : {manca: true};
    }, PREPARA.toString());
    assert.equal(r.manca, undefined, 'manca la colonna «Eseguita»');
    assert.equal(r.cursore, 'pointer',
      'l\'orario di una posizione senza orario vero si dichiara a mano (v167): quel clic resta');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('dal grafico lo stop si manda col campo che il ponte si aspetta', async () => {
  // PORTATO dal vecchio banco: il ponte legge `sl`. Con `prezzo` non si vede nessun errore a
  // schermo, e lo stop resta dov'era.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      await krakenLivelloApplica({simbolo: 'PF_XBTUSD', tipo: 'SL', scostamento: 0}, 95);
      return window._mandato;
    }, PREPARA.toString());
    assert.equal(r.length, 1, 'una sola chiamata al ponte: ' + JSON.stringify(r));
    assert.equal(r[0].p, '/sl');
    assert.deepEqual(r[0].corpo, {simbolo: 'PF_XBTUSD', sl: 95});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('dal grafico i target si mandano TUTTI insieme, non solo quello spostato', async () => {
  // PORTATO dal vecchio banco: mandando solo il target trascinato, gli altri si cancellano.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      // Si trascina il SECONDO target (indice 1) da 130 a 140: il primo deve restare 120.
      await krakenLivelloApplica({simbolo: 'PF_XBTUSD', tipo: 'TP', indice: 1, scostamento: 0}, 140);
      return window._mandato;
    }, PREPARA.toString());
    assert.equal(r[0].p, '/tp');
    assert.deepEqual(r[0].corpo, {simbolo: 'PF_XBTUSD', tp: [120, 140]},
      'il target non trascinato deve essere rimandato com\'era: ' + JSON.stringify(r[0].corpo));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('annullando la conferma non si manda niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      window.appConfirm = async () => false;
      await krakenLivelloApplica({simbolo: 'PF_XBTUSD', tipo: 'SL', scostamento: 0}, 95);
      return window._mandato;
    }, PREPARA.toString());
    assert.deepEqual(r, [], 'chi annulla non sposta niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
