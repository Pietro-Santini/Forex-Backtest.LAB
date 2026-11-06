// DOVE FINISCONO I DATI CLOUD CON «TIENI I DATI SUL MIO COMPUTER» ACCESO.
// Deve essere il PONTE LOCALE del PC (127.0.0.1:8000), perche' il PC e' la fonte primaria e
// i documenti devono finire su E:\Forex Backtest Lab\dati. Oggi invece fblUrlDati() segue
// MT5_BRIDGE_URL (= fblUrlOrdini()): se gli ordini sono «via server» il dominio, le
// scritture /dati vanno sul server e la cartella del PC resta vuota (misurato: 401 sulla
// rotta ma cartella vuota). La prova misura proprio questo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('con «tieni i dati sul mio computer» acceso, i dati vanno al ponte LOCALE, non «via server»', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      localStorage.setItem('fbl_cloud_nostro', '1');                 // interruttore acceso
      MT5_BRIDGE_URL = 'https://forexbacktestlab.duckdns.org/pc/8000'; // ordini «via server»
      fblOrdiniVia = 'server';
      return {dati: fblUrlDati(), noi: fblCloudNostro()};
    });
    assert.equal(r.noi, true, 'l\'interruttore del cloud nostro è acceso');
    assert.equal(r.dati, 'http://127.0.0.1:8000',
      'i dati devono finire nel ponte LOCALE del PC (fonte primaria su E:), non via server');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('prova di controllo: a interruttore spento, i dati NON sono forzati sul PC', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      localStorage.setItem('fbl_cloud_nostro', '0');                 // interruttore spento
      MT5_BRIDGE_URL = 'http://127.0.0.1:8000';
      fblOrdiniVia = 'locale';
      return {dati: fblUrlDati(), noi: fblCloudNostro()};
    });
    assert.equal(r.noi, false);
    // A spento NON il locale forzato: segue il server (o nulla). La cura non deve toccare questo ramo.
    assert.notEqual(r.dati, 'http://127.0.0.1:8000',
      'a interruttore spento non deve forzare il ponte locale');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});