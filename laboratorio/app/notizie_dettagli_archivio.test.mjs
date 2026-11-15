// IN REPLAY LE NOTIZIE DEVONO AVERE ANCORA FORECAST, PREVIOUS E ACTUAL.
//
// SEGNALATO dal proprietario (15 novembre 2026): «in modalita' replay, per quanto riguarda le
// notizie si perde quelli che sono i testi nel dettaglio della notizia all'interno del popup, il
// forecast e il previous non vengono piu' visualizzati, e' come se vengono cancellati... devono
// rimanere leggibili e salvati dentro l'account e anche sul disco E».
//
// CAUSA MISURATA: non venivano cancellati, NON ERANO MAI STATI SALVATI. `notizieVoce()` teneva
// quattro campi - orario, valuta, gravita', titolo - e buttava forecast, previous e actual. In
// Live il popup li prende dal feed dal vivo e si vedono; in replay e in Storico il feed non
// arriva (e' scritto nel codice), le notizie vengono dall'archivio, e quei campi non c'erano.
// Il commento nel sorgente lo diceva senza accorgersi delle conseguenze: «il feed ha i dettagli
// in piu'».
//
// UN SECONDO DIFETTO, trovato leggendo: `if(k && !A[k])` aggiungeva solo le notizie NUOVE, quindi
// una notizia gia' archiviata non veniva mai piu' toccata. L'ACTUAL esce DOPO l'orario
// dell'evento - cioe' sempre su una notizia gia' in archivio - e veniva scartato per sempre.
//
// COSA NON SI PERDEVA, e quindi non si salva: il link a Forex Factory e' CALCOLATO dalla data
// (newsForexFactoryDayUrl), e cosi' il glossario e l'«effetto usuale». Salvarlo per ogni notizia
// costerebbe 179 KB su 3000 eventi, piu' dei tre valori insieme, per un dato che si ricava.
//
// IL COSTO, misurato su 3000 notizie (il tetto dell'archivio): da 213 KB a 333 KB, cioe' da 73 a
// 114 byte per notizia.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Una notizia come la manda il feed dal vivo: con tutti i dettagli.
const DAL_FEED = {
  date: '2026-11-13T13:30:00+00:00',
  country: 'USD',
  impact: 'High',
  title: 'Non-Farm Employment Change',
  forecast: '250K',
  previous: '187K',
  actual: ''
};

const PULISCI = `(function(){
  try{ localStorage.removeItem('fbl_notizie_archivio'); }catch(e){}
  notizieArchivio = null;
  newsEvents = [];
  newsGrafico = []; newsGraficoFirma = '';
})()`;

test('una notizia archiviata conserva forecast e previous', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({pulisci, ev}) => {
      eval(pulisci);
      notizieArchivioAggiungi([ev]);
      const A = notizieArchivioCarica();
      const chiavi = Object.keys(A);
      return {quante: chiavi.length, voce: chiavi.length ? A[chiavi[0]] : null};
    }, {pulisci: PULISCI, ev: DAL_FEED});
    console.log('voce in archivio:', JSON.stringify(r.voce));
    assert.equal(r.quante, 1, 'la notizia deve entrare in archivio');
    assert.equal(r.voce.fore, '250K',
      'il forecast deve essere salvato: ' + JSON.stringify(r.voce));
    assert.equal(r.voce.prev, '187K',
      'e il previous: ' + JSON.stringify(r.voce));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('IN REPLAY: la notizia che viene dal solo archivio ha i dettagli', async () => {
  // La prova del difetto segnalato. Si archivia la notizia, poi si SVUOTA il feed - che e'
  // esattamente la condizione di replay e Storico - e si guarda cosa arriva al popup.
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(({pulisci, ev}) => {
      eval(pulisci);
      notizieArchivioAggiungi([ev]);
      // Il feed non c'e' piu': come in replay.
      newsEvents = [];
      newsGraficoFirma = '';
      notizieGraficoAggiorna();
      const dal = (newsGrafico || []).find(x => x && x.title && x.title.indexOf('Non-Farm') === 0);
      return {quante: (newsGrafico || []).length, evento: dal || null};
    }, {pulisci: PULISCI, ev: DAL_FEED});
    console.log('notizia per il grafico, senza feed:', JSON.stringify(r.evento));
    assert.ok(r.evento, 'la notizia deve comparire anche senza feed: ' + JSON.stringify(r));
    assert.equal(r.evento.forecast, '250K',
      'IL DIFETTO SEGNALATO: in replay il forecast deve esserci ancora. ' +
      JSON.stringify(r.evento));
    assert.equal(r.evento.previous, '187K',
      'e il previous: ' + JSON.stringify(r.evento));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('L ACTUAL che esce DOPO entra in una notizia gia archiviata', async () => {
  // Il secondo difetto. L actual compare dopo l orario dell evento, quindi arriva sempre su una
  // notizia che in archivio c e' gia'. Con `if(k && !A[k])` veniva scartato per sempre.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(({pulisci, ev}) => {
      eval(pulisci);
      notizieArchivioAggiungi([ev]);                       // senza actual
      const primaK = Object.keys(notizieArchivioCarica())[0];
      const prima = Object.assign({}, notizieArchivioCarica()[primaK]);
      // Lo stesso evento ripassa, stavolta col valore uscito.
      const conActual = Object.assign({}, ev, {actual: '263K'});
      const quanti = notizieArchivioAggiungi([conActual]);
      const A = notizieArchivioCarica();
      const chiavi = Object.keys(A);
      return {prima, dopo: A[chiavi[0]], quante: chiavi.length, segnalati: quanti};
    }, {pulisci: PULISCI, ev: DAL_FEED});
    console.log('prima:', JSON.stringify(r.prima), '| dopo:', JSON.stringify(r.dopo));
    assert.equal(r.quante, 1, 'non si deve creare una seconda notizia doppia');
    assert.equal(r.prima.act, undefined, 'prima l actual non c era (controprova)');
    assert.equal(r.dopo.act, '263K',
      'IL SECONDO DIFETTO: l actual uscito dopo deve entrare nella notizia gia archiviata. ' +
      JSON.stringify(r.dopo));
    assert.ok(r.segnalati > 0,
      'e il cambiamento va segnalato, altrimenti non si salva ne si ridisegna');
  } finally { await browser.close(); }
});

test('un valore che c e non viene sostituito da uno vuoto', async () => {
  // Se un giro del feed tornasse con i campi vuoti, non deve cancellare quello che sapevamo.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(({pulisci, ev}) => {
      eval(pulisci);
      notizieArchivioAggiungi([Object.assign({}, ev, {actual: '263K'})]);
      notizieArchivioAggiungi([Object.assign({}, ev, {forecast: '', previous: '', actual: ''})]);
      const A = notizieArchivioCarica();
      return A[Object.keys(A)[0]];
    }, {pulisci: PULISCI, ev: DAL_FEED});
    console.log('dopo un giro vuoto:', JSON.stringify(r));
    assert.equal(r.fore, '250K', 'il forecast deve resistere: ' + JSON.stringify(r));
    assert.equal(r.prev, '187K', 'e il previous');
    assert.equal(r.act, '263K', 'e l actual');
  } finally { await browser.close(); }
});

test('il link e il glossario NON hanno bisogno dell archivio: si ricavano', async () => {
  // Il motivo per cui non li salviamo: costerebbero piu' dei tre valori insieme, e si calcolano
  // dalla data e dal titolo. Questa prova impedisce che un domani si aggiungano "per sicurezza".
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(({pulisci, ev}) => {
      eval(pulisci);
      notizieArchivioAggiungi([ev]);
      newsEvents = []; newsGraficoFirma = '';
      notizieGraficoAggiorna();
      const dal = (newsGrafico || []).find(x => x && x.title && x.title.indexOf('Non-Farm') === 0);
      return {
        link: dal ? newsForexFactoryDayUrl(dal.date) : null,
        glossario: dal ? !!newsGlossaryFor(dal) : null,
        salvatoIlLink: 'url' in (notizieArchivioCarica()[Object.keys(notizieArchivioCarica())[0]])
      };
    }, {pulisci: PULISCI, ev: DAL_FEED});
    console.log('ricavati senza archivio:', JSON.stringify(r));
    assert.ok(r.link && String(r.link).indexOf('forexfactory') >= 0,
      'il link si ricava dalla data: ' + JSON.stringify(r));
    assert.equal(r.glossario, true,
      'e il glossario dal titolo, quindi in replay la scheda resta');
    assert.equal(r.salvatoIlLink, false,
      'e il link NON si salva nell archivio: costerebbe 179 KB su 3000 notizie per un dato '
      + 'che si ricava');
  } finally { await browser.close(); }
});

test('la chiave di una notizia NON cambia salvando il titolo piu lungo', async () => {
  // Il titolo ora si tiene fino a 120 caratteri invece di 80. Se la chiave cambiasse, gli
  // archivi gia' in casa diventerebbero irraggiungibili e si creerebbero doppioni.
  //
  // LA PROVA GIUSTA confronta lo STESSO titolo salvato nei due modi. La prima versione di questa
  // prova confrontava due titoli DIVERSI e li trovava con chiavi diverse: era ovvio, e non
  // misurava niente. La chiave usa i primi 40 caratteri, e 40 < 80, quindi il taglio piu' largo
  // non la tocca - ma va provato, non dedotto.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(({pulisci, ev}) => {
      eval(pulisci);
      const titoloLungo = 'Non-Farm Employment Change and some very long tail that goes well '
                        + 'beyond eighty characters to test the cut';
      const nuovaVoce = notizieVoce(Object.assign({}, ev, {title: titoloLungo}));
      // Come sarebbe stata salvata PRIMA, col taglio a 80.
      const vecchiaVoce = {t: nuovaVoce.t, cur: nuovaVoce.cur, imp: nuovaVoce.imp,
                           tit: titoloLungo.slice(0, 80)};
      return {
        chiaveNuova: notizieChiave(nuovaVoce),
        chiaveVecchia: notizieChiave(vecchiaVoce),
        tenutoPrima: vecchiaVoce.tit.length,
        tenutoOra: nuovaVoce.tit.length
      };
    }, {pulisci: PULISCI, ev: DAL_FEED});
    console.log('chiavi:', JSON.stringify(r));
    assert.equal(r.chiaveNuova, r.chiaveVecchia,
      'la chiave deve restare identica, altrimenti le notizie gia in archivio diventano '
      + 'irraggiungibili e si creano doppioni: ' + JSON.stringify(r));
    assert.equal(r.tenutoPrima, 80, 'controprova: prima il titolo si tagliava a 80');
    assert.ok(r.tenutoOra > 80,
      'e ora si tiene piu lungo: ' + r.tenutoOra + ' caratteri');
  } finally { await browser.close(); }
});
