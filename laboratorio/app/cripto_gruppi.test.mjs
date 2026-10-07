// Le criptovalute si riconoscono e si ritrovano fra gli asset.
//
// SEGNALATO dal proprietario (7 ottobre 2026): «nella pagina prova sale segnali, quando vado a
// inserire una criptovaluta non viene riconosciuta. Qualsiasi criptovaluta metto.»
//
// Il difetto stava in DUE posti: il ponte normalizzava solo BTC e ETH, e l'app conosceva i gruppi
// di sinonimi solo di quelle due. Sistemarne uno avrebbe dato il peggiore dei risultati: segnale
// riconosciuto e poi scartato piu' avanti, con un messaggio diverso. Questi test guardano il
// secondo posto - quello dell'app.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('una cripto trova il suo gruppo da qualunque forma', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      // tgCandidati vuole la chiave normalizzata (maiuscole, senza punteggiatura).
      solusd: tgCandidati('SOLUSD'),
      sol: tgCandidati('SOL'),
      solana: tgCandidati('SOLANA'),
      perp: tgCandidati('AVAXPERP')
    }));
    // Da SOLUSD si devono poter provare anche SOL e SOLUSDT: il broker la chiama come vuole.
    for(const nome of ['SOLUSD', 'SOL', 'SOLUSDT', 'SOLANA']){
      assert.ok(r.solusd.includes(nome), 'da SOLUSD manca ' + nome);
      assert.ok(r.sol.includes(nome), 'da SOL manca ' + nome);
      assert.ok(r.solana.includes(nome), 'da SOLANA manca ' + nome);
    }
    assert.ok(r.perp.includes('AVAXUSD'), 'la forma dei futures deve portare alla coppia');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la parola della sala resta la prima da provare', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => tgCandidati('SOLUSDT'));
    // Ha sempre la precedenza: se il broker usa proprio quel nome, si apre subito quello giusto.
    assert.equal(r[0], 'SOLUSDT');
    assert.equal(new Set(r).size, r.length, 'niente doppioni: l\'ordine di prova deve restare prevedibile');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le monete principali ci sono tutte, e oro e forex non si sono rotti', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const monete = ['BTC','ETH','SOL','XRP','ADA','DOGE','LTC','AVAX','LINK','DOT','MATIC','TRX','ATOM','SHIB'];
      const mancanti = monete.filter(mn => !tgCandidati(mn + 'USD').includes(mn));
      return {mancanti, oro: tgCandidati('XAUUSD'), btc: tgCandidati('BITCOIN')};
    });
    assert.deepEqual(r.mancanti, []);
    assert.ok(r.oro.includes('GOLD'), 'l\'oro deve ancora trovare il suo gruppo');
    assert.ok(r.btc.includes('BTCUSD'), 'BITCOIN per esteso deve portare a BTCUSD');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
