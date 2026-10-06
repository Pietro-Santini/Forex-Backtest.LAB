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

test('impostazioni: nome .ts.net obbligatorio, chiave obbligatoria, vuoto = tutto sul PC', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const out = {};
      const salva = (h, k) => { $('fblServerCampo').value = h; $('fblServerChiaveCampo').value = k; $('fblServerSalva').click(); return localStorage.getItem('fbl_server_host'); };
      localStorage.removeItem('fbl_server_host');
      out.ip = salva('129.152.3.237', 'x');
      out.senzaChiave = salva('srv.tail1.ts.net', '');
      out.ok = salva('https://SRV.tail1.ts.net:8000/', 'chiave1');
      out.chiave = localStorage.getItem('fbl_server_chiave');
      out.vuoto = salva('', '');
      return out;
    });
    assert.deepEqual(r, {ip:null, senzaChiave:null, ok:'srv.tail1.ts.net', chiave:'chiave1', vuoto:null});
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
