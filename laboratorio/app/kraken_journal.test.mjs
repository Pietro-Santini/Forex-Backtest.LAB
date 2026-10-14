// KRAKEN: UNA STRATEGIA CHE SPOSTA LO STOP NON È UNA STRATEGIA CHIUSA.
// E la riga che finisce nel Trade Journal deve avere numeri veri.
//
// SEGNALATO dal proprietario (BNBUSD, SELL da 734.95, quattro take profit): «si è chiusa la prima
// posizione in parziale a 730.57. I pip non me li ha calcolati, mi segna 0.0. Il conto mi dice
// NaN. E adesso non mi visualizza più né stop loss né TP: è come se fossero spariti dopo aver
// chiuso la prima operazione in parziale. Io qua avevo 4 TP diversi, ha preso il primo e da lì è
// iniziato questo problema».
//
// LA CORSA (la causa di "è sparito tutto dopo il primo TP). Appena un take profit viene colpito,
// la strategia SPOSTA LO STOP — ed è proprio il suo mestiere. Spostarlo significa cancellare
// l'ordine di stop e piazzarne uno nuovo: per un istante il vecchio id non c'è più e il nuovo non
// è ancora nella fotografia degli ordini aperti. Se in quell'istante arriva un giro del controllo
// con la fotografia di PRIMA, `stopAperto` è falso e il codice conclude «stop eseguito»: cancella
// i take profit rimasti, scrive una chiusura nel Journal e BUTTA la strategia. Da fuori: dopo il
// primo TP spariscono stop e target, e i TP 2-3-4 vengono tolti da Kraken.
//
// I DUE NUMERI SBAGLIATI erano scritti alla lettera nella riga: `pips:0` fisso, e `account` con
// dentro la stringa 'kraken' — ma quella colonna passa da euro(), e una stringa non è un numero.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('la riga di Journal di una chiusura Kraken porta pip veri e il saldo del conto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      trades = [];
      krakenConto = {collegato: true, conto_id: 'c1', ambiente: 'simulato', saldo: 11000, pnl_aperto: 0};
      krakenStorico = [];                       // nessuna esecuzione nota: P/L stimato dal mark
      krakenPosizioni = {posizioni: [{simbolo: 'PF_BNBUSD', mark: 730.57, entrata: 734.95}]};
      krakenCambioEur = async () => 1.10;       // 1 € = 1,10 $
      const st = {conto: 'kraken', simbolo: 'PF_BNBUSD', sym: 'BINANCE:BNBUSDT', side: 'SELL',
                  entry: 734.95, tps: [730.57, 726, 718, 702], sl: 748, slIniziale: 748,
                  quantita: 4, creato: Date.now() - 3600000, sala: 'Crypto Trading'};
      await krakenRegistraChiusura('g1', st);
      const t = trades[trades.length - 1];
      return t ? {pips: t.pips, account: t.account, pl: t.pl, asset: t.asset, side: t.side,
                  entry: t.entry, exit: t.exit, krakenConto: t.krakenConto} : null;
    });
    assert.ok(r, 'la chiusura deve scrivere una riga nel Journal');
    assert.equal(r.entry, 734.95);
    // SELL da 734.95 uscita a 730.57: il prezzo è sceso, quindi i pip sono POSITIVI e non zero.
    assert.ok(r.pips > 0, 'i pip non possono essere zero su una vincita: ' + r.pips);
    assert.ok(Number.isFinite(r.account), 'il conto deve essere un numero, non NaN: ' + r.account);
    // Saldo 11.000 $ con il cambio a 1,10 → 10.000 € tondi.
    assert.ok(Math.abs(r.account - 10000) < 1, 'il saldo va convertito come il P/L: ' + r.account);
    assert.equal(r.krakenConto != null, true, 'resta scritto che è un conto Kraken');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la colonna Conto del Journal non può mostrare NaN', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      stringa: euro('kraken'),      // com'era: la stringa finiva dritta in euro()
      numero: euro(10000)
    }));
    assert.match(r.stringa, /NaN/,
      'è proprio questo che si vedeva in tabella: euro() di una stringa non è un importo');
    assert.doesNotMatch(r.numero, /NaN/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una fotografia degli ordini più vecchia della nostra mossa non decide niente', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  // Il guard: finché non arriva una lettura PIÙ RECENTE dello spostamento dello stop, non si può
  // dire se quello stop è sparito perché eseguito o perché l'abbiamo appena sostituito noi.
  assert.match(src, /if\(Number\.isFinite\(Number\(st\.toccatoAt\)\)&&krakenPosizioniAt<=Number\(st\.toccatoAt\)\+1500\)continue;/,
    'serve il guard sulla lettura più vecchia dell ultima nostra mossa');
  // E il marcatore va messo proprio dove lo stop viene sostituito.
  assert.match(src, /st\.stopId=String\(r\.data\.sl\.id\); st\.sl=sl; st\.quantitaStop=rimasta;[\s\S]{0,300}?st\.toccatoAt=Date\.now\(\);/,
    'spostando lo stop si deve segnare l istante della mossa');
  // E i due numeri non devono più essere scritti a mano.
  assert.doesNotMatch(src, /pct:saldo>0\?plUsd\/saldo\*100:0,pips:0,result,account:'kraken'/,
    'pips fissi a zero e account con dentro una stringa non devono più esistere');
  assert.match(src, /pips:pipsFromPrice\(st\.side,entry,exit,/,
    'i pip si calcolano come per ogni altra operazione');
});
