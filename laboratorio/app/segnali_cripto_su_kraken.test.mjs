// UN SEGNALE CRIPTO VA SU KRAKEN. Su Capital.com solo se Kraken quella moneta non ce l'ha.
//
// SEGNALATO dal proprietario: «c'è stato un errore che ha aperto la posizione su Capital.com
// invece che su Kraken. Assolutamente no: se non lo sceglie l'utente, tutte le posizioni che
// arrivano da Syntra o da Telegram devono andare su Kraken — a meno che quella criptovaluta sia
// così strana che Kraken non ce l'ha».
//
// DUE BUCHI, non uno:
//
// 1) LA SPUNTA PARTIVA SPENTA. "Apri i segnali cripto sul conto Kraken" era spenta di base, e da
//    spenta un segnale cripto ricadeva sul ramo MT5; se MT5 non aveva quello strumento, finiva su
//    Capital.com. Ora parte accesa: chi la spegne di proposito se la vede rispettata, chi non
//    l'ha mai toccata ha il comportamento giusto senza doverci pensare.
//
// 2) IL RICONOSCIMENTO DELLE CRIPTO STAVA TUTTO IN UNA TABELLA DI NOMI (binanceSymbolForAsset).
//    Una moneta scritta dalla sala in una forma che quella tabella non conosce non risultava
//    cripto per niente: il segnale proseguiva sul ramo MT5 e finiva su Capital.com. Ora, prima di
//    dirottare, si CHIEDE A KRAKEN se quel contratto ce l'ha: è lui la fonte autorevole, e non
//    c'è nessun elenco da tenere aggiornato.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('la spunta dei segnali cripto su Kraken è accesa finché non la si spegne', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const out = {};
      try { localStorage.removeItem('fbl_kraken_ordini'); } catch(e) {}
      out.maiToccata = krakenOrdiniAttivi();
      localStorage.setItem('fbl_kraken_ordini', '0');
      out.spentaAMano = krakenOrdiniAttivi();
      localStorage.setItem('fbl_kraken_ordini', '1');
      out.accesaAMano = krakenOrdiniAttivi();
      try { localStorage.removeItem('fbl_kraken_ordini'); } catch(e) {}
      return out;
    });
    assert.equal(r.maiToccata, true, 'chi non l ha mai toccata deve avere le cripto su Kraken');
    assert.equal(r.spentaAMano, false, 'chi la spegne di proposito se la deve vedere rispettata');
    assert.equal(r.accesaAMano, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una cripto va su Kraken anche quando la tabella dei nomi non la conosce', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const chiamate = [];
      // Kraken risponde di sì solo per la moneta "strana": è la fonte autorevole.
      const origBridge = krakenBridge;
      krakenBridge = async (p) => { chiamate.push(p); return {ok: /\/strumento\/STRANA$/.test(p)}; };
      const origPronto = krakenContoPronto, origAgg = krakenAggiornaConto;
      krakenContoPronto = () => true; krakenAggiornaConto = async () => {};
      // La tabella dei nomi NON conosce questa moneta: è esattamente il caso del difetto.
      const origBn = binanceSymbolForAsset;
      binanceSymbolForAsset = () => '';
      // E MT5 non ha lo strumento: senza il controllo su Kraken finirebbe su Capital.com.
      const origAsset = tgAssetPerStrumento, origMt5 = resolveMt5SymbolForAsset;
      tgAssetPerStrumento = async () => 'STRANAUSD';
      resolveMt5SymbolForAsset = async () => null;
      mt5Connected = true;
      try {
        localStorage.removeItem('fbl_kraken_ordini');
        const conto = await tgContoEffettivoPerSegnale({strumento: 'STRANAUSD'});
        // E una moneta che nemmeno Kraken ha: quella sì che può andare su Capital.com.
        const altro = await tgContoEffettivoPerSegnale({strumento: 'IGNOTAUSD'});
        return {conto, altro, chiamate};
      } finally {
        krakenBridge = origBridge; krakenContoPronto = origPronto; krakenAggiornaConto = origAgg;
        binanceSymbolForAsset = origBn; tgAssetPerStrumento = origAsset;
        resolveMt5SymbolForAsset = origMt5;
      }
    });
    assert.equal(r.conto, 'kraken',
      'se Kraken ha quel contratto il segnale va li, non su Capital.com: ' + JSON.stringify(r));
    assert.equal(r.altro, 'capital',
      'una moneta che nemmeno Kraken ha puo andare su Capital.com');
    assert.ok(r.chiamate.some(p => /\/strumento\//.test(p)),
      'si deve davvero CHIEDERE a Kraken: ' + JSON.stringify(r.chiamate));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('spegnendo la spunta non si disturba piu Kraken', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const chiamate = [];
      const origBridge = krakenBridge;
      krakenBridge = async (p) => { chiamate.push(p); return {ok: true}; };
      const origBn = binanceSymbolForAsset; binanceSymbolForAsset = () => '';
      const origAsset = tgAssetPerStrumento, origMt5 = resolveMt5SymbolForAsset;
      tgAssetPerStrumento = async () => 'STRANAUSD';
      resolveMt5SymbolForAsset = async () => null;
      mt5Connected = true;
      try {
        localStorage.setItem('fbl_kraken_ordini', '0');   // spenta di proposito
        const conto = await tgContoEffettivoPerSegnale({strumento: 'STRANAUSD'});
        return {conto, chiamate};
      } finally {
        krakenBridge = origBridge; binanceSymbolForAsset = origBn;
        tgAssetPerStrumento = origAsset; resolveMt5SymbolForAsset = origMt5;
        try { localStorage.removeItem('fbl_kraken_ordini'); } catch(e) {}
      }
    });
    assert.equal(r.conto, 'capital', 'con la spunta spenta si torna al comportamento di prima');
    assert.deepEqual(r.chiamate, [], 'e non si chiede niente a Kraken');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la regola sta scritta dove si decide il conto', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const c = (re, cosa) => assert.ok(re.test(src), 'manca: ' + cosa);
  c(/localStorage\.getItem\('fbl_kraken_ordini'\)!=='0'/, 'la spunta accesa di base');
  c(/if\(ri&&ri\.ok\)return 'kraken';/, 'la risposta di Kraken decide');
  // La domanda a Kraken deve stare PRIMA del dirottamento su Capital.com, non dopo.
  c(/if\(ri&&ri\.ok\)return 'kraken';[\s\S]{0,900}?return \(suMt5===null\)\?'capital':base;/,
    'si chiede a Kraken PRIMA di dirottare su Capital.com');
});
