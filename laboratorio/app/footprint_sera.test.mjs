// IL FOOTPRINT NON PUÒ REGISTRARE DUE PREZZI DIVERSI PER LO STESSO ISTANTE.
//
// SEGNALATO dal proprietario, con foto: «il footprint lo ha caricato a pezzoni, a strati; tutto
// questo quando si ferma il mercato, poi quando riprende torna a visualizzarsi correttamente».
//
// LA CAUSA: dalle 22 alle 23 il prezzo Capital.com viene spostato per agganciarsi al livello MT5
// (fblCapitalSeraAllinea) — i due non quotano lo stesso identico prezzo, e senza quello scarto la
// candela farebbe un salto di decine di punti alle 22:00 in punto.
// Ma quello spostamento si applica SOLO all'asset a grafico. Un asset della watchlist non a
// grafico riceveva il prezzo GREZZO; lo stesso asset, quando era a grafico, lo riceveva SPOSTATO.
// Nel suo registro finivano due livelli diversi per lo stesso prezzo, a decine di punti l'uno
// dall'altro: disegnati insieme sono le due bande staccate della foto.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('lo scarto della sera si applica SOLO nella sua fascia', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // Fuori dalla fascia il prezzo non si tocca: è la garanzia che lo scarto non "sporchi"
      // nient'altro.
      const origFase = liveSessionPhaseNow;
      liveSessionPhaseNow = () => 'mt5';
      const fuori = fblCapitalSeraAllinea(4100, 'XAUUSD');
      liveSessionPhaseNow = () => 'closed';
      const chiuso = fblCapitalSeraAllinea(4100, 'XAUUSD');
      liveSessionPhaseNow = origFase;
      return {fuori, chiuso};
    });
    assert.equal(r.fuori, 4100, 'in orario MT5 il prezzo resta quello vero');
    assert.equal(r.chiuso, 4100, 'a mercato chiuso idem');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nella fascia 22-23 il footprint di un asset NON a grafico si ferma', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const c = (re, cosa) => assert.ok(re.test(src), 'manca: ' + cosa);
  // È il punto preciso: il ramo degli asset in background registrava il prezzo GREZZO, mentre
  // quello a grafico registra lo stesso prezzo SPOSTATO.
  c(/if\(asset && isAssetInWatchlist\(asset\) && liveSessionPhaseNow\(\)!=='capital'\)/,
    'il footprint di sottofondo deve fermarsi nella fascia 22-23');
  // E lo scarto resta applicato all'asset a grafico, che è il motivo per cui esiste.
  c(/if\(p\.epic===capitalWsPrimaryEpic\)price=fblCapitalSeraAllinea\(price,/,
    'lo scarto sull asset a grafico non si tocca');
});

test('le due righe del footprint leggono la stessa variabile price', () => {
  // Se un domani qualcuno rimettesse il prezzo grezzo in una delle due, tornerebbero le bande.
  // Qui si fissa che il prezzo registrato è SEMPRE quello della variabile già corretta.
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const righe = src.match(/footprintRegisterTick\(price,Date\.now\(\),asset,undefined,'capital'\)/g) || [];
  assert.equal(righe.length, 2,
    'le due registrazioni (a grafico e di sottofondo) devono passare dalla stessa variabile: ' + righe.length);
});
