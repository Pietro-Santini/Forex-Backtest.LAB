import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('dal ponte locale la strada degli ordini e\' locale, scelta senza indagini', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async () => {
      // La pagina del banco arriva da file:, quindi da sola non PUO' sapere nulla: onesto.
      const dalNiente = fblPaginaDalPonteLocale();
      const casa = fblPaginaDalPonteLocale('http://127.0.0.1:8000');
      const localhost = fblPaginaDalPonteLocale('http://localhost:8000');
      const nomePc = fblPaginaDalPonteLocale('https://pietro.tail83d918.ts.net:8000');
      const sito = fblPaginaDalPonteLocale('https://pietro-santini.github.io');
      const telefono = fblPaginaDalPonteLocale('http://192.168.1.7:8000');
      // La strada: con l'indirizzo del computer NON deve passare dal server.
      // Si misura la FUNZIONE dell'indirizzo, non il suo interno.
      const urlLocale = (() => {
        const vera = fblPaginaDalPonteLocale;
        let origine = null;
        // fblPaginaDalPonteLocale con l'argomento vuoto leggera location: qui si guarda
        // invece cosa risponde la scelta della strada, che e' il pezzo che conta.
        return {vera: vera('http://127.0.0.1:8000'), vuota: vera('')};
      })();
      return {dalNiente, casa, localhost, nomePc, sito, telefono, urlLocale};
    });
    assert.equal(r.dalNiente, false,
      'da file:// non si sa niente, ed e\' onesto dirlo: ' + JSON.stringify(r));
    assert.equal(r.casa, true, '127.0.0.1 e\' questo computer');
    assert.equal(r.localhost, true, 'e localhost pure');
    assert.equal(r.nomePc, false, 'il nome Tailscale e\' un ALTRO indirizzo, non la prova che sia locale');
    assert.equal(r.sito, false, 'il sito non e\' il ponte');
    assert.equal(r.telefono, false, 'un indirizzo di rete privata non e\' questo computer');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la strada scelta dal ponte locale NON passa dal server', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async () => {
      // Conta le prove di rete: devono essere ZERO, la risposta la si conosce gia'.
      let prove = 0;
      const veraProva = fblControllaPonteLocale;
      fblControllaPonteLocale = async () => { prove++; return false; };
      let scelta = null, url = null;
      try {
        scelta = await fblScegliStradaOrdini('http://127.0.0.1:8000');
        url = fblUrlOrdini();
        return {scelta, prove, url};
      } finally {
        fblControllaPonteLocale = veraProva;
      }
    });
    assert.equal(r.scelta, 'locale',
      'la strada e\' locale, senza passare dal server: ' + JSON.stringify(r));
    assert.equal(r.prove, 0,
      'nessuna prova di rete per una domanda che ha una risposta sola: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('dopo tre letture fallite il polling si allenta, e al successo torna subito a 1s', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async () => {
      const passi = [];
      const segna = (ok, etichetta) => { mt5PollSegnaEsito(ok); passi.push(etichetta + ':' + mt5PollPassoMs); };
      segna(false, 'dopo 1 fallimento');
      segna(false, 'dopo 2 fallimenti');
      const primaDelTerzo = mt5PollPassoMs;
      segna(false, 'dopo 3 fallimenti');   // qui scatta il freno
      segna(false, 'dopo 4 fallimenti');
      const massimo = mt5PollPassoMs;
      segna(true, 'dopo il successo');
      return {passi, primaDelTerzo, massimo, finale: mt5PollPassoMs};
    });
    assert.equal(r.primaDelTerzo, 1000, 'sotto i tre fallimenti il passo resta 1s: ' + JSON.stringify(r));
    assert.ok(r.massimo > 1000, 'al terzo fallimento il passo si allenta: ' + JSON.stringify(r));
    assert.ok(r.massimo <= 10000, 'ma non oltre 10s: ' + JSON.stringify(r));
    assert.equal(r.finale, 1000, 'al primo successo si torna a 1s (sui soldi veri serve pronto)');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
