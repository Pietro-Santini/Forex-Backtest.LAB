// I CONTI CHIUSI NON SPORCANO I TOTALI DEI CONTI CHE SI USANO.
//
// RICHIESTO dal proprietario: «nella dashboard compaiono conti MT5 che non ho più. Lasciamoli, ma
// mettiamoli in una sezione "conti chiusi", così chi vuole li guarda — però almeno non vanno a
// interferire sui calcoli statistici totali dei conti che ho attivi».
//
// Come si riconosce un conto chiuso: il suo numero non è più nell'elenco dei conti MT5 salvati.
// Solo MT5, perché solo di MT5 esiste un elenco di "quelli che ci sono": per Kraken, Capital.com e
// le sessioni simulate non c'è niente con cui confrontare.
//
// IL CONTROLLO PIÙ IMPORTANTE è l'ultimo del test: con l'elenco VUOTO non si dichiara chiuso
// niente. L'elenco si legge dal computer e all'avvio — o con MT5 scollegato — è vuoto: senza
// quella riga, per qualche secondo ogni conto risulterebbe chiuso e la dashboard si svuoterebbe.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('e chiuso solo un conto MT5 che non e piu fra quelli salvati', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      mt5SavedAccounts = [{login: 111}, {login: 222}];
      const {eContoChiuso}=window.fblStatCalcoli;
      return {
        vivo: eContoChiuso('MT5 111'),
        chiuso: eContoChiuso('MT5 999'),
        kraken: eContoChiuso('\u{1F419} Kraken Conto 1'),
        capital: eContoChiuso('\u{1F4B9} Capital.com'),
        storico: eContoChiuso('Storico'),
        sconosciuto: eContoChiuso('MT5 (conto sconosciuto)'),
        vuoto: eContoChiuso('')
      };
    });
    assert.equal(r.vivo, false);
    assert.equal(r.chiuso, true, 'un conto MT5 non piu salvato e chiuso');
    assert.equal(r.kraken, false, 'di Kraken non esiste un elenco: non si dichiara niente');
    assert.equal(r.capital, false);
    assert.equal(r.storico, false);
    assert.equal(r.sconosciuto, false, 'senza numero non si puo dire niente');
    assert.equal(r.vuoto, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con l elenco dei conti vuoto non si dichiara chiuso NIENTE', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // All avvio, o con MT5 scollegato, l elenco e vuoto: e il momento in cui un controllo
      // frettoloso svuoterebbe l intera dashboard.
      const {eContoChiuso} = window.fblStatCalcoli;
      mt5SavedAccounts = [];
      const vuoto = eContoChiuso('MT5 999');
      mt5SavedAccounts = null;
      const nullo = eContoChiuso('MT5 999');
      return {vuoto, nullo};
    });
    assert.equal(r.vuoto, false, 'elenco vuoto: non si dichiara chiuso niente');
    assert.equal(r.nullo, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il filtro li tiene fuori dalle viste insieme, e li mostra solo se scelti', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const c = (re, cosa) => assert.ok(re.test(src), 'manca: ' + cosa);
  c(/if\(F\.conto==='__chiusi'\)return eContoChiuso\(r\.conto\);/, 'la voce "tutti i conti chiusi"');
  c(/if\(eContoChiuso\(r\.conto\)&&F\.conto!==r\.conto\)return false;/,
    'fuori da ogni vista insieme, dentro solo se scelto apposta');
  c(/Conti chiusi \(fuori dai totali\)/, 'il gruppo nel menu');
  // E il menu delle famiglie si costruisce sui soli conti VIVI: altrimenti un conto chiuso
  // comparirebbe due volte, dentro la sua famiglia e fra i chiusi.
  c(/const vivi=valori\.filter\(v=>!eContoChiuso\(v\)\);/, 'le famiglie si costruiscono sui vivi');
});
