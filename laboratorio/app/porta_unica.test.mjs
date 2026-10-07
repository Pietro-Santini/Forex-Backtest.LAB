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
    assert.equal(ordini.url, 'https://srv.tail1.ts.net:8000/pc/health?chiave=K%261');
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
      // Il caso vero: il server c'è (Kraken e segnali rispondono) ma il computer è spento, quindi
      // gli ordini no. Il server lo dice con un 502, non fingendo che vada tutto bene.
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
    assert.equal(r.verdi, 2, 'grafico e segnali rispondono');
    assert.equal(r.rossi, 1, 'solo gli ordini no');
    assert.equal(r.esiti.find(x => x.nome === 'Ordini').esito, 'computer spento');
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
