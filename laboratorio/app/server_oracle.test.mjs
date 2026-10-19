// Server sempre acceso (Oracle): Kraken e segnali passano dal server quando e' impostato; MT5 e
// tutto il resto restano sul PC. Senza server, nulla cambia.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('senza server: Kraken passa dal PC come prima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      localStorage.removeItem('fbl_server_host'); localStorage.removeItem('fbl_server_chiave');
      const chiamate = []; fetchMt5WithTimeout = async (p) => { chiamate.push(p); return {ok:true, data:{}}; };
      await krakenBridge('/stato');
      return {chiamate, ponteOk: await tgAssicuraPonte.toString().includes('fblServer')};
    });
    assert.deepEqual(r.chiamate, ['/kraken/stato']);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con il server: Kraken e segnali al server con la sua chiave, ponte non avviato dal PC', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      localStorage.setItem('fbl_server_host', 'srv.tail1234.ts.net'); localStorage.setItem('fbl_server_chiave', 'K&1');
      const pc = []; fetchMt5WithTimeout = async (p) => { pc.push(p); return {ok:true, data:{}}; };
      const url = []; window.fetch = async (u) => { url.push(String(u)); return new Response(JSON.stringify({ok:true}), {status:200}); };
      const kr = await krakenBridge('/stato');
      const ws = []; window.WebSocket = class { constructor(u){ ws.push(u); this.readyState = 0; } close(){} };
      localStorage.setItem(TG_ATTIVO_KEY, '1'); tgWs = null; tgCollega();
      const ponte = await tgAssicuraPonte();
      return {url, ws, pc, kr: kr.ok, ponte};
    });
    assert.deepEqual(r.url, ['https://srv.tail1234.ts.net:8000/kraken/stato?chiave=K%261']);
    assert.deepEqual(r.ws, ['wss://srv.tail1234.ts.net:8769/ws/segnali?chiave=K%261']);
    assert.equal(r.kr, true);
    assert.equal(r.ponte, true);
    assert.deepEqual(r.pc, [], 'nessuna chiamata al PC per Kraken o per avviare il ponte');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('impostazioni: non ci sono più campi nome/chiave del server', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const c = (id) => !!document.getElementById(id);
      return {
        campoServer: c('fblServerCampo'),
        chiaveServer: c('fblServerChiaveCampo'),
        salvaServer: c('fblServerSalva')
      };
    });
    assert.deepEqual(r, {campoServer:false, chiaveServer:false, salvaServer:true});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// "il tasto Prova il server non lo vedo": era in fondo a una finestra il cui pulsante parlava solo
// di "altri dispositivi". Il pulsante deve nominare il server e portare alla sezione.
test('il pulsante del menu porta a «Prova il server»', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const b = document.getElementById('fblRemotoBtn');
      const testo = b.textContent;
      await fblRemotoApri();
      const p = document.getElementById('fblServerProva');
      return {testo, dentro: document.getElementById('fblRemotoOverlay').contains(p),
              aperta: document.getElementById('fblRemotoOverlay').style.display};
    });
    assert.match(r.testo, /server Oracle/);
    assert.equal(r.dentro, true);
    assert.equal(r.aperta, 'flex');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// METÀ DEL DIFETTO CHE TENEVA FUORI I TELEFONI. L'app chiedeva la chiave personale a
//   https://nome-ta.ts.net/register
// cioe' SENZA porta, e su 443 Tailscale Serve non serve niente: la chiamata non arrivava nemmeno
// al server. La verita' non si poteva vedere perche' la richiesta moriva in un catch muto, e l'unica
// cosa visibile era "non si collega". Si prova l'indirizzo DAVVERO usato, non una stringa nel codice.
test('registrazione: va su /register della porta 8000, non sulla 443', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      localStorage.setItem('fbl_server_host', 'srv.tail1234.ts.net');
      localStorage.removeItem('fbl_server_chiave');
      const url = [];
      window.fetch = async (u) => { url.push(String(u));
        return new Response(JSON.stringify({ok:true, uid:'u1', chiave:'K-24carati'}),
                            {status:200, headers:{'Content-Type':'application/json'}}); };
      const fintaUtente = {getIdToken: async () => 'token-di-prova'};
      const ottenuta = await fblRegistraSulServer(fintaUtente);
      return {url, ottenuta, salvata: localStorage.getItem('fbl_server_chiave')};
    });
    assert.deepEqual(r.url, ['https://srv.tail1234.ts.net:8000/register'],
      'la registrazione deve andare alla porta 8000 del ponte');
    assert.equal(r.ottenuta, 'K-24carati');
    assert.equal(r.salvata, 'K-24carati', 'la chiave si salva solo se il server l\'ha consegnata');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// Il recupero: se la chiave non vale piu' l'app deve buttarla e ne chieda una subito, altrimenti
// un utente resta fuori fino a riavviare l'app - ed e' successo che la chiave salvata diventasse
// quella sbagliata e l'app continuasse a mandarla.
test('403 «chiave non valida»: la vecchia si butta e se ne chiede una nuova subito', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      localStorage.setItem('fbl_server_host', 'srv.tail1234.ts.net');
      localStorage.setItem('fbl_server_chiave', 'VECCHIA');
      window.fblUtenteCorrente = {getIdToken: async () => 'token-di-prova'};
      const url = [];
      window.fetch = async (u) => {
        url.push(String(u));
        if(String(u).indexOf('/register') >= 0)
          return new Response(JSON.stringify({ok:true, uid:'u1', chiave:'NUOVA'}),
                              {status:200, headers:{'Content-Type':'application/json'}});
        return new Response(JSON.stringify({detail:'Chiave non valida o mancante'}),
                            {status:403, headers:{'Content-Type':'application/json'}});
      };
      const risposta = await fetchServerWithTimeout('/kraken/stato', {}, 5000);
      return {url, risposta, chiave: localStorage.getItem('fbl_server_chiave')};
    });
    assert.deepEqual(r.url, [
      'https://srv.tail1234.ts.net:8000/kraken/stato?chiave=VECCHIA',
      'https://srv.tail1234.ts.net:8000/register'], 'prima il tentativo con la vecchia, poi la nuova');
    assert.equal(r.chiave, 'NUOVA', 'la chiave rifiutata va sostituita con quella nuova');
    assert.deepEqual(r.risposta, {ok:false, message:'Chiave non valida o mancante'});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
