// ASCOLTO DI UN DOCUMENTO: dal server Oracle (WebSocket) invece di Firestore.
//
// CURA BOLLETTA del 31 ottobre 2026. Gli ascolti Firestore (onSnapshot) sono la voce piu' cara
// delle LETTURE: ogni modifica di un documento e' una lettura PER OGNI dispositivo in ascolto.
// I numeri della console del proprietario, 30 giorni: letture 293K, scritture 107K, banda oltre
// 10 GB. Ma questi ascolti sincronizzano davvero qualcosa (collegamento del server fra
// dispositivi, preferenze, disegni condivisi), quindi NON si possono spegnere e basta.
//
// LA CURA: commutarli sul WebSocket del server Oracle, che manda solo {nome, versione}. Chi ha
// gia' quella versione non scarica niente - stesso servizio, senza pagare il documento.
//
// QUESTO TEST PROVA IL COMPORTAMENTO, con una nuvola finta: cosa arriva a cb, quante letture
// fa, cosa succede con due avvisi ravvicinati, e cosa succede quando si chiude l'ascolto.
// La logica e' una funzione sola (fblAscoltaDocumento) proprio perche' si possa provare: nel
// banco il modulo Firebase non carica, quindi dentro il modulo non sarebbe raggiungibile.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Una nuvola finta controllabile: quanti avvisi manda, quali documenti restituisce, e quante
// letture vengono chieste. Le promesse si risolvono a mano, cosi' il test decide l'ORDINE in cui
// le risposte arrivano - ed e' l'ordine il punto pericoloso (due risposte in ordine sparso
// possono applicare il documento vecchio per ultimo).
const MONTA = `window.__montaNuvola = function(opzioni){
  var letti = [];
  var aperti = 0;
  var chiuso = false;
  var avvisa = null;
  var inCoda = [];
  var nuvola = {
    leggiServer: async function(nome){
      letti.push(nome);
      const d = opzioni.documenti[nome];
      return (typeof d === 'function') ? d(letti.length) : d;
    },
    ascoltaServer: function(cb){
      aperti++;
      avvisa = cb;
      return function(){ chiuso = true; };
    },
    // aiuti del test
    letti: function(){ return letti.slice(); },
    aperti: function(){ return aperti; },
    chiuso: function(){ return chiuso; },
    avvisa: function(m){ if(avvisa) avvisa(m); }
  };
  return nuvola;
};`;

test('l\'avviso del server fa leggere il documento e passa il contenuto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MONTA);
    const r = await pagina.evaluate(async () => {
      const arrivati = [];
      const n = window.__montaNuvola({
        documenti: {collegamento: {host: 'pc-di-casa', chiave: 'abc', aggiornato: 1}}
      });
      const ferma = window.fblAscoltaDocumento({
        nome: 'collegamento',
        cb: (doc) => arrivati.push(doc),
        ascoltaServer: n.ascoltaServer,
        leggiServer: n.leggiServer,
      });
      // Il server avvisa: "il documento collegamento e' arrivato alla versione 3".
      n.avvisa({nome: 'collegamento', versione: 3});
      await new Promise(res => setTimeout(res, 60));
      const letti = n.letti();
      ferma();
      return {arrivati, letti, aperti: n.aperti()};
    });

    assert.equal(r.aperti, 1, 'deve aprire UN canale solo, non uno per documento');
    assert.deepEqual(r.letti, ['collegamento'], 'deve leggere il documento appena avvisato');
    assert.deepEqual(r.arrivati, [{host: 'pc-di-casa', chiave: 'abc', aggiornato: 1}],
      'a chi ascolta deve arrivare il CONTENUTO del documento, non l\'avviso');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la stessa versione non si rilegge: e\' il risparmio', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MONTA);
    const r = await pagina.evaluate(async () => {
      const arrivati = [];
      const n = window.__montaNuvola({documenti: {preferenze: {scala: 90}}});
      const ferma = window.fblAscoltaDocumento({
        nome: 'preferenze', cb: (d) => arrivati.push(d),
        ascoltaServer: n.ascoltaServer, leggiServer: n.leggiServer,
      });
      // Tre avvisi, ma DUE della stessa versione: il secondo e' lo stesso documento gia' visto.
      n.avvisa({nome: 'preferenze', versione: 1});
      await new Promise(res => setTimeout(res, 40));
      n.avvisa({nome: 'preferenze', versione: 1});
      await new Promise(res => setTimeout(res, 40));
      n.avvisa({nome: 'preferenze', versione: 2});
      await new Promise(res => setTimeout(res, 60));
      ferma();
      return {letti: n.letti(), arrivati: arrivati.length};
    });

    assert.deepEqual(r.letti, ['preferenze', 'preferenze'],
      'tre avvisi ma due versioni diverse = due letture, non tre');
    assert.equal(r.arrivati, 2, 'due aggiornamenti davvero nuovi, non tre');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('due avvisi ravvicinati non si accavallano e non perdono l\'ultimo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MONTA);
    const r = await pagina.evaluate(async () => {
      const arrivati = [];
      // Il documento cambia fra una lettura e l'altra: e' il caso in cui applicare le risposte
      // nell'ordine sbagliato lascerebbe in giro il documento VECCHIO.
      let stato = {v: 'primo'};
      const n = window.__montaNuvola({documenti: {grafico: () => ({voci: stato})}});
      const ferma = window.fblAscoltaDocumento({
        nome: 'grafico',
        cb: (doc) => arrivati.push(doc),
        trasforma: (d) => (d && d.voci) || {},
        ascoltaServer: n.ascoltaServer, leggiServer: n.leggiServer,
      });
      // Due avvisi prima che la prima lettura finisca.
      n.avvisa({nome: 'grafico', versione: 1});
      stato = {v: 'secondo'};
      n.avvisa({nome: 'grafico', versione: 2});
      await new Promise(res => setTimeout(res, 120));
      ferma();
      return {letti: n.letti(), arrivati};
    });

    assert.deepEqual(r.letti, ['grafico', 'grafico'],
      'entrambe le versioni devono essere lette: la seconda non si perde');
    assert.equal(r.arrivati.length, 2, 'devono arrivare due aggiornamenti');
    // L'ULTIMO applicato deve essere il piu' recente. Se le risposte si accavallassero, l'ordine
    // sarebbe impossibile da garantire - ed e' il difetto che questo test deve impedire.
    assert.deepEqual(r.arrivati[r.arrivati.length - 1], {v: 'secondo'},
      'l\'ultimo aggiornamento applicato deve essere il piu\' recente, non il piu\' vecchio');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('gli avvisi degli altri documenti non disturbano', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MONTA);
    const r = await pagina.evaluate(async () => {
      const arrivati = [];
      const n = window.__montaNuvola({documenti: {collegamento: {host: 'x'}}});
      const ferma = window.fblAscoltaDocumento({
        nome: 'collegamento', cb: (d) => arrivati.push(d),
        ascoltaServer: n.ascoltaServer, leggiServer: n.leggiServer,
      });
      // Il canale e' unico: passano gli avvisi di TUTTI i documenti dell'account. Quelli che non
      // sono il suo non devono far scattare letture.
      n.avvisa({nome: 'session', versione: 9});
      n.avvisa({nome: 'grafico', versione: 9});
      await new Promise(res => setTimeout(res, 60));
      const dopoGliAltri = n.letti().length;
      // E un avviso senza nome (spazzatura) non deve far cadere niente.
      n.avvisa(null);
      n.avvisa({});
      n.avvisa({nome: 'collegamento', versione: 1});
      await new Promise(res => setTimeout(res, 60));
      ferma();
      return {dopoGliAltri, letti: n.letti(), arrivati: arrivati.length};
    });

    assert.equal(r.dopoGliAltri, 0,
      'gli avvisi degli altri documenti non devono far leggere niente');
    assert.deepEqual(r.letti, ['collegamento'],
      'solo il proprio documento deve essere letto: e solo quando il suo avviso arriva');
    assert.equal(r.arrivati, 1, 'un solo aggiornamento, non quattro');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('chiuso l\'ascolto, non arriva piu\' niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MONTA);
    const r = await pagina.evaluate(async () => {
      const arrivati = [];
      const n = window.__montaNuvola({documenti: {preferenze: {scala: 100}}});
      const ferma = window.fblAscoltaDocumento({
        nome: 'preferenze', cb: (d) => arrivati.push(d),
        ascoltaServer: n.ascoltaServer, leggiServer: n.leggiServer,
      });
      n.avvisa({nome: 'preferenze', versione: 1});
      await new Promise(res => setTimeout(res, 50));
      ferma();
      // Dopo la chiusura il canale continua a mandare (il server non lo sa): non deve succedere
      // niente. Un ascolto chiuso che applica ancora e' un dispositivo fantasma.
      n.avvisa({nome: 'preferenze', versione: 2});
      await new Promise(res => setTimeout(res, 60));
      return {arrivati: arrivati.length, letti: n.letti().length};
    });

    assert.equal(r.arrivati, 1, 'dopo la chiusura non deve arrivare piu\' niente');
    assert.equal(r.letti, 1, 'e non deve nemmeno leggere');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: senza chi ascolta non si rompe niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      let aperti = 0;
      // Una nuvola muta: non apre canali e non legge niente. La funzione deve restituire una
      // funzione di chiusura valida e non sollevare.
      let chiusura = null;
      try {
        chiusura = window.fblAscoltaDocumento({
          nome: 'collegamento',
          cb: () => {},
          ascoltaServer: () => { aperti++; return function(){}; },
          leggiServer: async () => null,
        });
      } catch (e) { return {esploso: String(e)}; }
      try { chiusura(); } catch (e) { return {esplosoChiusura: String(e)}; }
      return {esploso: null, tipoChiusura: typeof chiusura, aperti};
    });

    assert.equal(r.esploso, null, 'non deve sollevare: ' + r.esploso);
    assert.equal(r.esplosoChiusura, undefined, 'la chiusura non deve sollevare');
    assert.equal(r.tipoChiusura, 'function', 'deve restituire una funzione di chiusura');
    assert.equal(r.aperti, 1, 'il canale deve essere aperto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ====== SE CADE IL PC, CONTINUA FIREBASE ======
//
// CHIESTO dal proprietario (4 novembre 2026): «la fonte primaria è il nostro PC... però facciamo
// in modo che Firebase è la nostra spalla: se cade il PC, continua Firebase».
//
// IL BUCO, trovato leggendo il codice: si scegliva UNA strada all'avvio e non si tornava mai
// indietro. Col PC spento il WebSocket riprovava in silenzio ogni 5-30 secondi, qui non arrivava
// niente, e l'ascolto Firebase NON VENIVA MAI AVVIATO. Quel dispositivo restava zitto: nessun
// aggiornamento dagli altri, e nessun modo di accorgersene.
test('se il nostro server tace, si accende anche l\'ascolto Firebase', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MONTA);
    const r = await pagina.evaluate(async () => {
      const arrivati = [];
      let ricadutaAvviata = 0;
      const n = window.__montaNuvola({documenti: {preferenze: {a: 1}}});
      const ferma = window.fblAscoltaDocumento({
        nome: 'preferenze',
        cb: (doc) => arrivati.push(doc),
        ascoltaServer: n.ascoltaServer,
        leggiServer: n.leggiServer,
        // Il nostro server non avvisa mai: è il PC spento.
        ricaduta: (consenti) => { ricadutaAvviata++; return function(){}; },
        attesaMs: 50,
      });
      await new Promise(res => setTimeout(res, 200));
      ferma();
      return {ricadutaAvviata, arrivati};
    });
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.ricadutaAvviata, 1,
      'col nostro server muto la ricaduta Firebase deve partire, una volta sola');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: se il nostro server risponde, la ricaduta NON si accende. Senza questa,
// bastava accendere sempre Firebase per far passare la prova qui sopra — e si pagherebbero le
// letture che tutto questo lavoro serve a togliere.
test('PROVA DI CONTROLLO: se il nostro server risponde, Firebase resta spento', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MONTA);
    const r = await pagina.evaluate(async () => {
      const arrivati = [];
      let ricadutaAvviata = 0;
      const n = window.__montaNuvola({documenti: {preferenze: {a: 1, at: 1000}}});
      const ferma = window.fblAscoltaDocumento({
        nome: 'preferenze',
        cb: (doc) => arrivati.push(doc),
        ascoltaServer: n.ascoltaServer,
        leggiServer: n.leggiServer,
        ricaduta: (consenti) => { ricadutaAvviata++; return function(){}; },
        attesaMs: 120,
      });
      n.avvisa({nome: 'preferenze', versione: 1});     // il server si fa sentire subito
      await new Promise(res => setTimeout(res, 300));
      ferma();
      return {ricadutaAvviata, arrivati};
    });
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.ricadutaAvviata, 0,
      'col nostro server che risponde, accendere anche Firebase vorrebbe dire pagare due volte');
    assert.equal(r.arrivati.length, 1, 'e il documento deve essere arrivato dal nostro server');
  } finally { await browser.close(); }
});

// ====== LA REGOLA DEL PIÙ FRESCO ======
//
// È quella che rende SICURA la ricaduta, e senza di lei la ricaduta peggiorerebbe il problema
// invece di risolverlo. Scenario vero: il PC resta spento un giorno, in quel giorno si lavora dal
// telefono e Firebase si aggiorna, poi il PC si riaccende e la sua copia — vecchia di un giorno —
// arriva per ultima. Senza regola, il lavoro di oggi verrebbe sostituito da quello di ieri.
test('un documento più vecchio di quello già applicato non si applica', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MONTA);
    const r = await pagina.evaluate(async () => {
      const arrivati = [];
      // Prima lettura: documento di OGGI. Seconda: la copia vecchia che torna dal PC riacceso.
      let giro = 0;
      const n = window.__montaNuvola({documenti: {
        session: () => { giro++; return giro === 1 ? {savedAt: 2000, chi: 'oggi'} : {savedAt: 1000, chi: 'ieri'}; }
      }});
      const ferma = window.fblAscoltaDocumento({
        nome: 'session',
        cb: (doc) => arrivati.push(doc && doc.chi),
        ascoltaServer: n.ascoltaServer,
        leggiServer: n.leggiServer,
      });
      n.avvisa({nome: 'session', versione: 1});
      await new Promise(res => setTimeout(res, 80));
      n.avvisa({nome: 'session', versione: 2});
      await new Promise(res => setTimeout(res, 80));
      ferma();
      return {arrivati};
    });
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.deepEqual(r.arrivati, ['oggi'],
      'la copia di ieri non deve arrivare a cb: invece è arrivato ' + JSON.stringify(r.arrivati));
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: un documento PIÙ FRESCO deve passare. Senza questa, una regola rotta che
// scarta tutto passerebbe la prova qui sopra e l'app non riceverebbe più niente.
test('PROVA DI CONTROLLO: un documento più fresco si applica', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MONTA);
    const r = await pagina.evaluate(async () => {
      const arrivati = [];
      let giro = 0;
      const n = window.__montaNuvola({documenti: {
        session: () => { giro++; return giro === 1 ? {savedAt: 1000, chi: 'prima'} : {savedAt: 5000, chi: 'dopo'}; }
      }});
      const ferma = window.fblAscoltaDocumento({
        nome: 'session',
        cb: (doc) => arrivati.push(doc && doc.chi),
        ascoltaServer: n.ascoltaServer,
        leggiServer: n.leggiServer,
      });
      n.avvisa({nome: 'session', versione: 1});
      await new Promise(res => setTimeout(res, 80));
      n.avvisa({nome: 'session', versione: 2});
      await new Promise(res => setTimeout(res, 80));
      ferma();
      return {arrivati};
    });
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.deepEqual(r.arrivati, ['prima', 'dopo'], 'il più fresco deve arrivare');
  } finally { await browser.close(); }
});

// Un documento SENZA data non si rifiuta: scartarlo sarebbe peggio del male che cura (l'utente
// non vedrebbe niente e non capirebbe perché). Si applica, ma non sposta il riferimento.
test('un documento senza data si applica, e non sposta il riferimento', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      return {
        senzaData: fblDataDocumento({a:1}),
        conSavedAt: fblDataDocumento({savedAt:1234}),
        dentroLaBusta: fblDataDocumento({state:{savedAt:99}}),
        conAt: fblDataDocumento({at:777}),
        nulla: fblDataDocumento(null)
      };
    })()`);
    assert.equal(r.senzaData, null, 'senza data si risponde «non lo so», non zero');
    assert.equal(r.conSavedAt, 1234);
    assert.equal(r.dentroLaBusta, 99, 'su Firestore la data sta dentro la busta `state`');
    assert.equal(r.conAt, 777, 'i documenti piccoli usano `at` invece di `savedAt`');
    assert.equal(r.nulla, null);
  } finally { await browser.close(); }
});
