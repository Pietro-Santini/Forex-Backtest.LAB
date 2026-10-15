// «VAI A GRAFICO» PORTA ANCHE SUL CONTO GIUSTO.
//
// RICHIESTO dal proprietario: «se premo su una posizione Kraken, o su un'operazione cripto nel
// trade journal, deve passare al conto Kraken da solo; e viceversa, su una posizione forex deve
// caricare il conto MT5. Deve riconoscere dove è stata presa, così il grafico e i numeri
// combaciano».
//
// PERCHÉ CONTA: il conto scelto decide la FONTE dei prezzi del grafico. Guardare una posizione
// Kraken con il conto MT5 davanti vuol dire leggere i suoi livelli sopra candele di un'altra
// fonte — due numeri che non torneranno mai.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('si riconosce il conto di un operazione da come è fatta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      // Un'operazione Kraken, come la scrive krakenRegistraChiusura.
      krakenJournal: fblContoDiOperazione({asset: 'BINANCE:BNBUSDT', krakenConto: 'Kraken simulato',
                                           krakenSimbolo: 'PF_BNBUSD'}),
      krakenChiave: fblContoDiOperazione({krakenChiave: 'c1|PF_XBTUSD|123'}),
      krakenAccount: fblContoDiOperazione({account: 'kraken'}),
      // Una posizione reale MT5.
      mt5: fblContoDiOperazione({asset: 'EURUSD', mt5Ticket: 12345}),
      mt5Login: fblContoDiOperazione({asset: 'EURUSD', mt5Login: 10013138461}),
      capital: fblContoDiOperazione({account: 'capital'}),
      // Una simulata: non appartiene a nessun conto vero, quindi non si cambia niente.
      simulata: fblContoDiOperazione({asset: 'EURUSD', lots: 0.1}),
      niente: fblContoDiOperazione(null)
    }));
    assert.equal(r.krakenJournal, 'kraken');
    assert.equal(r.krakenChiave, 'kraken');
    assert.equal(r.krakenAccount, 'kraken');
    assert.equal(r.mt5, 'mt5');
    assert.equal(r.mt5Login, 'mt5');
    assert.equal(r.capital, 'capital');
    assert.equal(r.simulata, null, 'una simulata non deve far cambiare conto');
    assert.equal(r.niente, null);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il cambio conto avviene, e solo quando serve', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const chiamate = [];
      const orig = fblContoScegli;
      fblContoScegli = async (c) => { chiamate.push(c); fblContoVista = c; liveModeActive = true; };
      try{
        fblContoVista = 'mt5'; liveModeActive = true;
        // Operazione Kraken: si deve passare a Kraken.
        await fblVaiAlContoDi({krakenConto: 'Kraken simulato'});
        const dopoKraken = chiamate.slice();
        // Già su Kraken: non si deve rifare niente (ricaricherebbe il grafico per niente).
        await fblVaiAlContoDi({krakenConto: 'Kraken simulato'});
        const senzaDoppione = chiamate.slice();
        // Operazione MT5: si torna su MT5.
        await fblVaiAlContoDi({mt5Ticket: 99});
        const dopoMt5 = chiamate.slice();
        // Simulata: non si tocca niente.
        await fblVaiAlContoDi({asset: 'EURUSD'});
        return {dopoKraken, senzaDoppione, dopoMt5, finale: chiamate.slice()};
      } finally { fblContoScegli = orig; }
    });
    assert.deepEqual(r.dopoKraken, ['kraken'], 'da MT5 a una posizione Kraken si cambia conto');
    assert.deepEqual(r.senzaDoppione, ['kraken'], 'già sul conto giusto: non si ricarica per niente');
    assert.deepEqual(r.dopoMt5, ['kraken', 'mt5'], 'e si torna su MT5 per una posizione MT5');
    assert.deepEqual(r.finale, ['kraken', 'mt5'], 'una simulata non cambia conto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('tutti i punti che portano a grafico passano dal conto giusto', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  // NOTA DI METODO: su un sorgente da 4,6 MB non si usa assert.match — quando fallisce stampa
  // l'INTERO file e il messaggio vero si perde. Si prova la condizione e si scrive a mano cosa
  // mancava.
  const c = (re, cosa) => assert.ok(re.test(src), 'manca: ' + cosa);
  c(/await fblVaiAlContoDi\(pos\);/, 'il conto giusto nel salto su una posizione aperta');
  c(/await fblVaiAlContoDi\(t\);/, 'il conto giusto nel salto da un operazione del Trade Journal');
  c(/await fblContoScegli\('kraken'\);[\s\S]{0,40}?const base=krakenBaseDaSimbolo/,
    'il conto Kraken dalla tabella delle posizioni Kraken');
  // Il conto si cambia PRIMA di caricare l asset: cambiare conto ricarica il grafico, farlo dopo
  // vorrebbe dire caricarlo due volte e, per un istante, mostrare la fonte sbagliata.
  c(/await fblVaiAlContoDi\(pos\);[\s\S]{0,200}?const currentAsset=/, 'prima il conto, poi l asset');
});
