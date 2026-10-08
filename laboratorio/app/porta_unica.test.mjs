// Collegamento/Modalità: una porta sola (il server) e si vede cosa risponde.
//
// RICHIESTO dal proprietario (7 ottobre 2026): «sul telefono o tablet devo inserire il nome del
// server e la chiave del server, non più il nome del computer e la chiave del computer. Quindi
// togli anche la sezione chiave, generazione, la chiave da scrivere sull'altro dispositivo: non
// serve più. [...] E si vede se gli ordini, il grafico e i segnali rispondono.»
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('dalla schermata spariscono i campi e la chiave del computer', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      await fblRemotoApri();
      const c = (id) => !!document.getElementById(id);
      return {
        nomeComputer: c('fblHostCampo'), chiaveComputer: c('fblChiaveCampo'),
        chiaveDaRicopiare: c('fblRemotoChiave'), cambiaChiave: c('fblRemotoRigenera'),
        // Quello che deve restare: il server, e le tre righe.
        nomeServer: c('fblServerCampo'), chiaveServer: c('fblServerChiaveCampo'),
        servizi: c('fblServizi')
      };
    });
    assert.deepEqual(r, {nomeComputer:false, chiaveComputer:false, chiaveDaRicopiare:false,
                         cambiaChiave:false, nomeServer:true, chiaveServer:true, servizi:true});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('col server impostato, gli ordini passano dal server e non dal computer', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      localStorage.setItem('fbl_server_host', 'srv.tail1.ts.net');
      localStorage.setItem('fbl_server_chiave', 'K&1');
      return fblServiziElenco().map(x => ({nome: x.nome, dove: x.dove, url: x.url}));
    });
    const ordini = r.find(x => x.nome === 'Ordini');
    // MT5 gira sul PC, ma il telefono non deve saperne l'indirizzo: ci pensa il server a girare
    // la richiesta. È tutto il senso della "porta unica".
    // La porta è scritta per esteso (`/pc/8000/`) e non più sottintesa (`/pc/`) da quando la riga
    // «Ordini» prova l'indirizzo che la sezione MT5 usa DAVVERO invece di una rotta sua: è la
    // correzione della v108, dove il pallino restava verde mentre MT5 andava altrove. Stessa
    // destinazione sul server (senza porta si intende la 8000), detta in modo esplicito.
    assert.equal(ordini.url, 'https://srv.tail1.ts.net:8000/pc/8000/health?chiave=K%261');
    assert.match(ordini.dove, /tramite il server/);
    assert.equal(r.find(x => x.nome === 'Segnali').url, 'https://srv.tail1.ts.net:8769/health?chiave=K%261');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza server resta tutto sul computer, come prima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      localStorage.removeItem('fbl_server_host'); localStorage.removeItem('fbl_server_chiave');
      return fblServiziElenco().map(x => ({nome: x.nome, dove: x.dove, url: x.url}));
    });
    assert.equal(r.find(x => x.nome === 'Ordini').url, 'http://127.0.0.1:8000/health');
    r.forEach(x => assert.equal(x.dove, 'computer'));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le tre righe dicono quale pezzo manca, non solo "non funziona"', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      localStorage.setItem('fbl_server_host', 'srv.tail1.ts.net');
      localStorage.setItem('fbl_server_chiave', 'K');
      // Il caso vero: il server c'è (Kraken e segnali rispondono) ma il computer non risponde,
      // quindi gli ordini no. Il server lo dice con un 502, non fingendo che vada tutto bene.
      window.fetch = async (u) => String(u).includes('/pc/')
        ? {ok:false, status:502} : {ok:true, status:200};
      const esiti = await fblServiziControlla();
      return {
        esiti: esiti.map(x => ({nome:x.nome, ok:x.ok, esito:x.esito})),
        righe: document.querySelectorAll('#fblServizi .riga').length,
        rossi: document.querySelectorAll('#fblServizi .pal.no').length,
        verdi: document.querySelectorAll('#fblServizi .pal.si').length
      };
    });
    assert.equal(r.righe, 3);
    // Dal telefono anche il GRAFICO passa dal computer (porta 8001, girata dal server): se il
    // computer non risponde restano in piedi solo i segnali, che stanno sul server. È la realtà,
    // e il riquadro deve dirla invece di mostrare un verde consolatorio.
    assert.equal(r.verdi, 1, 'solo i segnali, che stanno sul server');
    assert.equal(r.rossi, 2, 'ordini e grafico dipendono tutti e due dal computer');
    assert.equal(r.esiti.find(x => x.nome === 'Ordini').esito, 'il computer non risponde');
    assert.equal(r.esiti.find(x => x.nome === 'Grafico').esito, 'il computer non risponde');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('chiudendo la schermata si smette di controllare', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      await fblRemotoApri();
      const acceso = fblServiziTimer !== null;
      fblRemotoChiudi();
      return {acceso, spento: fblServiziTimer === null,
              chiusa: document.getElementById('fblRemotoOverlay').style.display};
    });
    // Continuare a bussare a schermata chiusa consumerebbe batteria e dati del telefono.
    assert.deepEqual(r, {acceso:true, spento:true, chiusa:'none'});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('«nessun computer registrato» non si confonde con «il computer non risponde»', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      localStorage.setItem('fbl_server_host', 'srv.tail1.ts.net');
      localStorage.setItem('fbl_server_chiave', 'K');
      const out = {};
      // 503: il server c'è ma nessun computer si è ancora presentato. Si risolve premendo Salva
      // sul computer — niente a che vedere con un computer spento. Chiamarle allo stesso modo ha
      // fatto cercare un guasto che non c'era (segnalato dal proprietario, 7 ottobre 2026).
      window.fetch = async (u) => String(u).includes('/pc/') ? {ok:false, status:503} : {ok:true, status:200};
      out.nonRegistrato = (await fblServiziControlla()).find(x => x.nome === 'Ordini').esito;
      // 502: il computer è registrato ma non risponde davvero.
      window.fetch = async (u) => String(u).includes('/pc/') ? {ok:false, status:502} : {ok:true, status:200};
      out.nonRisponde = (await fblServiziControlla()).find(x => x.nome === 'Ordini').esito;
      return out;
    });
    assert.equal(r.nonRegistrato, 'nessun computer registrato');
    assert.equal(r.nonRisponde, 'il computer non risponde');
    assert.notEqual(r.nonRegistrato, r.nonRisponde,
      'due situazioni che si risolvono in modi opposti non possono avere lo stesso messaggio');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
