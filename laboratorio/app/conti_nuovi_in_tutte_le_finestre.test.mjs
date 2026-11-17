// UN CONTO AGGIUNTO IN UNA FINESTRA COMPARE ANCHE NELLE ALTRE.
//
// RICHIESTO dal proprietario il 17 novembre 2026: «se nelle impostazioni della pagina madre,
// oppure nelle impostazioni delle pagine duplicate, vado ad aggiungere un nuovo conto, dopo si
// spalma su tutti quanti le finestre che sono presenti. Mi raccomando, questa e' una cosa molto
// importante.» E, al chiarimento: «Semplicemente se aggiungo un nuovo conto mi si deve aprire
// anche sulle altre finestre visibili e non solo su quella dove l'ho aggiunto da impostazioni.»
//
// ATTENZIONE: questa voce era stata capita AL ROVESCIO per due commit - «si spalma» letto come
// una lamentela invece che come la cosa desiderata. E' una RICHIESTA, non un difetto da togliere.
//
// LA CAUSA, misurata: `mt5SavedAccounts` e' una CACHE IN MEMORIA della cartella delle credenziali
// (`let mt5SavedAccounts=[]; // cache della lista di conti letta dalla cartella`). Aggiungendo un
// conto si aggiorna solo la cache di QUELLA finestra
// (`mt5SavedAccounts=await upsertMt5AccountInHandle(handle,creds)`): la cartella su disco e' una
// sola e condivisa, ma le altre finestre tengono la loro copia vecchia finche' non rileggono. E
// l'elenco non viaggia sul canale fra finestre (`collectTradingSyncPayload` non lo manda).
//
// COSA VIAGGIA, E COSA NO - LA REGOLA CHE NON SI TOCCA: si manda solo «rileggi», mai l'elenco.
// Dentro quei record ci sono le CREDENZIALI, e quelle non viaggiano mai, nemmeno fra due finestre
// della stessa macchina. Il banco lo misura: nel messaggio non ci devono essere ne' password ne'
// numeri di conto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('aggiungendo un conto si annuncia alle altre finestre, e si annuncia solo «rileggi»', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      // Si intercetta il canale: niente vola davvero, si guarda cosa SAREBBE partito.
      // `tradingChannel` e' un `let` in cima allo script, quindi NON sta su `window`: si
      // assegna per nome. (Prima stesura di questo banco: passava da `window.tradingChannel`,
      // creava un oggetto nuovo che nessuno guardava, e la prova restava rossa con la cura
      // giusta. Terza volta nella stessa giornata che e' il banco a sbagliare, non il codice.)
      const inviati=[];
      tradingChannel={ postMessage:(m)=>{ inviati.push(m); } };
      await fblContiMt5Annuncia();
      return {inviati, testo: JSON.stringify(inviati)};
    });
    const annunci = r.inviati.filter(m => m && m.type === 'conti_mt5_cambiati');
    assert.equal(annunci.length, 1, 'deve partire un annuncio solo: ' + r.testo);
    // LA REGOLA: nel messaggio non c'e' l'elenco, e quindi non ci sono credenziali.
    assert.equal('conti' in annunci[0], false, 'l\'elenco NON deve viaggiare: ' + r.testo);
    assert.match(r.testo.toLowerCase().indexOf('password') >= 0 ? 'TROVATA' : 'nessuna', /nessuna/,
      'nessuna password nel messaggio: ' + r.testo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ricevendo l\'annuncio, la finestra rilegge la cartella e ridisegna la tendina', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      let letture=0, ridisegni=0;
      // la cartella «su disco»: al secondo giro contiene un conto in piu'
      const finti=[{login:'111', server:'Demo-A'}];
      window.mt5ContiSenzaChiedere = async () => { letture++; return finti.slice(); };
      window.renderMt5AccountSelect = () => { ridisegni++; };
      mt5SavedAccounts = [];
      await fblContiMt5Rileggi();
      const dopoUno = {letture, ridisegni, quanti: mt5SavedAccounts.length};
      finti.push({login:'222', server:'Demo-B'});
      await fblContiMt5Rileggi();
      return {dopoUno, letture, ridisegni, quanti: mt5SavedAccounts.length,
        logins: mt5SavedAccounts.map(a=>String(a.login))};
    });
    assert.equal(r.dopoUno.letture, 1, 'deve rileggere la cartella');
    assert.equal(r.dopoUno.quanti, 1, 'e prendere quello che c\'e\'');
    assert.equal(r.dopoUno.ridisegni, 1, 'e ridisegnare la tendina, altrimenti non si vede');
    assert.equal(r.quanti, 2, 'al secondo giro deve vedere il conto nuovo: ' + JSON.stringify(r.logins));
    assert.deepEqual(r.logins, ['111','222']);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO: se la cartella non si puo\' leggere, l\'elenco che c\'era non si svuota', async () => {
  // La trappola di questa cura: `mt5ContiSenzaChiedere` torna null quando il permesso sulla
  // cartella non c'e' (succede: e' una scelta dichiarata, l'elenco resta vuoto e vale il
  // comportamento di sempre). Se il ricevitore assegnasse quel null, un annuncio innocuo
  // CANCELLEREBBE l'elenco dei conti in tutte le altre finestre - molto peggio del difetto.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      window.mt5ContiSenzaChiedere = async () => null;
      window.renderMt5AccountSelect = () => {};
      mt5SavedAccounts = [{login:'111', server:'Demo-A'}];
      await fblContiMt5Rileggi();
      return {quanti: mt5SavedAccounts.length};
    });
    assert.equal(r.quanti, 1, 'l\'elenco non deve svuotarsi se la cartella non si legge');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO: una finestra non reagisce al proprio annuncio', async () => {
  // Il dispacciatore scarta i messaggi del proprio slot (`msg.slot===PIP_SLOT`), ed e' la
  // ragione per cui non si innesca un giro infinito di riletture fra due finestre.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      let letture=0;
      window.mt5ContiSenzaChiedere = async () => { letture++; return []; };
      window.renderMt5AccountSelect = () => {};
      // un messaggio che arriva dal MIO stesso slot
      if(tradingChannel && tradingChannel.onmessage){
        tradingChannel.onmessage({data:{type:'conti_mt5_cambiati', slot:PIP_SLOT}});
      }
      return {letture, slot:PIP_SLOT};
    });
    assert.equal(r.letture, 0, 'il proprio annuncio non deve far rileggere niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
