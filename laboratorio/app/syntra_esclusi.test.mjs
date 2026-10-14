// UTENTI SYNTRA DA ESCLUDERE DAI SEGNALI.
//
// RICHIESTO dal proprietario: «dobbiamo inserire un campo dove inseriamo gli utenti che vogliamo
// escludere dai segnali... se al robot arriva un segnale da quell'utente escluso, non lo
// identifica come un segnale e passa avanti. E deve essere portato comunque sempre nella tabella
// degli utenti di Syntra. E se lo deve ricordare a memoria».
//
// Tre cose insieme, e vanno provate tutte e tre: il segnale NON entra, l'utente SI' (altrimenti
// non lo si potrebbe piu' riammettere), e la scelta resta scritta.
//
// Come si prova che il test serve: togliendo il controllo `syntraEscluso(m.chat)` da
// tgMessaggioSegnali, il primo test va rosso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SEGNALE = (id, chat) => JSON.stringify({
  tipo: 'segnale', id, chat,
  // `avvisi` e `confidenza` li manda sempre il ponte: senza, il messaggio di stato in fondo a
  // tgMessaggioSegnali va in errore (e il test fallirebbe per il motivo sbagliato).
  segnale: {strumento: 'EURUSD', direzione: 'BUY', entrata: 1.1, stop_loss: 1.09, take_profit: [1.12], avvisi: [], confidenza: 90},
  eta_ms: 0
});

const PREPARA = () => {
  tgSegnaliRicevuti = [];
  syntraEsclusi = []; syntraVisti = [];
  window.tgSuonaSegnale = () => {};              // niente suoni nel banco di prova
  window.tgAutoInCoda = () => {};                // niente apertura automatica: qui si prova il filtro
};

test('un segnale di un utente ESCLUSO non viene nemmeno riconosciuto come segnale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((args) => {
      eval('(' + args.prep + ')')();
      const S = eval('(' + args.seg + ')');
      tgMessaggioSegnali({data: S(1, 'Syntra · Mario')}, 'syntra');
      const normale = tgSegnaliRicevuti.length;
      syntraEscludi('Syntra · Mario', true);
      tgMessaggioSegnali({data: S(2, 'Syntra · Mario')}, 'syntra');
      const escluso = tgSegnaliRicevuti.length;
      // Un ALTRO utente non deve essere toccato dall'esclusione.
      tgMessaggioSegnali({data: S(3, 'Syntra · Luca')}, 'syntra');
      const altro = tgSegnaliRicevuti.length;
      return {normale, escluso, altro, visti: syntraVisti.slice()};
    }, {prep: PREPARA.toString(), seg: SEGNALE.toString()});
    assert.equal(r.normale, 1, 'prima dell\'esclusione il segnale entra normalmente');
    assert.equal(r.escluso, 1, 'dopo l\'esclusione il segnale NON entra: si passa avanti');
    assert.equal(r.altro, 2, 'l\'esclusione vale solo per quell\'utente');
    assert.ok(r.visti.indexOf('Syntra · Mario') >= 0,
      'l\'utente escluso deve restare nell\'elenco, altrimenti non lo si puo\' piu\' riammettere');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l\'esclusione si ricorda, e non si lascia ingannare da maiuscole o prefisso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((args) => {
      eval('(' + args.prep + ')')();
      syntraEscludi('Syntra · CrownPips', true);
      return {
        salvato: JSON.parse(localStorage.getItem('fb_syntra_esclusi') || '[]'),
        conPrefisso: syntraEscluso('Syntra · CrownPips'),
        senzaPrefisso: syntraEscluso('CrownPips'),
        maiuscole: syntraEscluso('Syntra · CROWNPIPS'),
        altro: syntraEscluso('Syntra · Mario')
      };
    }, {prep: PREPARA.toString(), seg: SEGNALE.toString()});
    assert.deepEqual(r.salvato, ['Syntra · CrownPips'], 'la scelta va scritta in memoria');
    assert.equal(r.conPrefisso, true);
    assert.equal(r.senzaPrefisso, true, 'il prefisso «Syntra · » non deve cambiare l\'esito');
    assert.equal(r.maiuscole, true, 'un\'esclusione che non scatta per una maiuscola e\' peggio di nessuna esclusione');
    assert.equal(r.altro, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('si riammette togliendo la spunta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((args) => {
      eval('(' + args.prep + ')')();
      const S = eval('(' + args.seg + ')');
      syntraEscludi('Syntra · Mario', true);
      syntraEscludi('Syntra · Mario', false);
      tgMessaggioSegnali({data: S(1, 'Syntra · Mario')}, 'syntra');
      return {escluso: syntraEscluso('Syntra · Mario'), entrati: tgSegnaliRicevuti.length,
              salvato: JSON.parse(localStorage.getItem('fb_syntra_esclusi') || '[]')};
    }, {prep: PREPARA.toString(), seg: SEGNALE.toString()});
    assert.equal(r.escluso, false);
    assert.equal(r.entrati, 1, 'riammesso, i suoi segnali tornano a entrare');
    assert.deepEqual(r.salvato, []);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
