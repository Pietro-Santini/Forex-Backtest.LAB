// BANCO DI MISURA (non corregge niente): com'e' fatto il collegamento del telefono dopo la R3
// (v2.2.13, commit aec50f2), che ha sostituito `pietro.tail83d918.ts.net` con
// `pietro-santini.github.io` in mobile/www-sorgente/index.html.
//
// Misura gli INDIRIZZI che l'app costruisce per il telefono con quell'host, e misura se
// quell'host risponde davvero (confronto con l'host di prima).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const NUOVO = 'pietro-santini.github.io';        // quello scritto in www-sorgente ora
const VECCHIO = 'pietro.tail83d918.ts.net';      // quello che c'era prima della R3

// Mette l'app nei panni di un telefono: nessun ponte sul telefonino, un server configurato,
// NESSUN indirizzo del computer scritto a mano (l'APK non lo scrive: lo fa solo index.html).
const SCENA = (host) => {
  try{ localStorage.setItem('fbl_server_host', host); }catch(e){}
  try{ localStorage.removeItem('fbl_server_chiave'); }catch(e){}
  try{ localStorage.removeItem('fb_indirizzo_ponte'); }catch(e){}
  try{ localStorage.removeItem('fb_chiave_ponte'); }catch(e){}
  fblPonteLocaleVivo = null; fblPonteLocaleAt = 0; fblPonteLocaleInCorso = null;
  fblOrdiniVia = null; fblGraficoVia = null;
};

async function indirizzi(pagina, host) {
  return pagina.evaluate(async ([p, h]) => {
    eval('(' + p + ')')(h);
    // Sul telefono non c'e' nessun ponte su 127.0.0.1: la domanda la fa l'app da sola.
    await fblControllaPonteLocale();
    return {
      server: fblServer(),
      serverUrl8000: fblServerUrl(8000),
      serverUrl8001: fblServerUrl(8001),
      registrazione: fblUrlRegistrazione(),
      base8000: fblBaseUrl(8000),
      base8001: fblBaseUrl(8001),
      urlDati: fblUrlDati(),
      urlGrafico: fblUrlGrafico(),
      urlOrdini: fblUrlOrdini(),
      segnaliWs: (fblServer() ? fblServerConChiave(fblServerUrl(8769).replace(/^https/,'wss')+'/ws/segnali') : ''),
      kraken: (fblServer() ? fblServerConChiave(fblServerUrl(8000)+'/kraken/stato') : ''),
      // Il collegamento che viaggia dentro l'account Google (PC -> telefono).
      hostValidoNuovo: fblCollegamentoHostValido('pietro-santini.github.io'),
      hostValidoVecchio: fblCollegamentoHostValido('pietro.tail83d918.ts.net'),
      hostValidoDominio: fblCollegamentoHostValido('dati.esempio.org'),
    };
  }, [SCENA.toString(), host]);
}

test('MISURA: con l’host nuovo (pietro-santini.github.io) gli indirizzi del telefono', async () => {
  const {browser, pagina} = await apriApp();
  try{
    const r = await indirizzi(pagina, NUOVO);
    console.log('HOST NUOVO', JSON.stringify(r, null, 1));
    // Il servizio 8000 del telefono diventa il nome secco del sito con la porta del ponte.
    assert.equal(r.serverUrl8000, 'https://pietro-santini.github.io:8000');
    assert.equal(r.base8000, 'https://pietro-santini.github.io:8000/pc/8000');
    assert.equal(r.base8001, 'https://pietro-santini.github.io:8000/pc/8001');
    assert.equal(r.registrazione, 'https://pietro-santini.github.io:8000/register');
  } finally { await browser.close(); }
});

test('MISURA: con l’host vecchio gli indirizzi puntano al server Oracle (vivo)', async () => {
  const {browser, pagina} = await apriApp();
  try{
    const r = await indirizzi(pagina, VECCHIO);
    console.log('HOST VECCHIO', JSON.stringify(r, null, 1));
    assert.equal(r.serverUrl8000, 'https://pietro.tail83d918.ts.net:8000');
    assert.equal(r.base8000, 'https://pietro.tail83d918.ts.net:8000/pc/8000');
  } finally { await browser.close(); }
});
