// CORREZIONE DELLA v155, scritta qui perché non succeda di nuovo.
//
// La v155 diceva di aver risolto il footprint «a pezzoni, a strati» fermando la registrazione
// nella fascia serale 22-23. NON HA MAI FERMATO UN SOLO TICK: dalla v131 liveSessionPhaseAt()
// non restituisce più 'capital' (a mercato chiuso il grafico si ferma e basta, non prosegue su
// Capital.com), quindi la condizione `liveSessionPhaseNow()!=='capital'` era sempre vera.
//
// E il collaudo non poteva accorgersene, perché i test della v155 leggevano il TESTO del codice
// («c'è scritta questa riga?») invece di misurarne l'effetto. Un test così dimostra che il codice
// è stato scritto, non che serve a qualcosa.
//
// La causa vera è in laboratorio/app/mercato_chiuso.test.mjs: il calendario dell'asset, che ora
// vale per le candele, per il footprint e per il prezzo che valuta le posizioni — uno solo.
// Qui restano i due invarianti di questa zona che sono ancora veri e vale la pena tenere fermi.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('la fascia serale 22-23 non esiste più: nessuna ora può restituire "capital"', async () => {
  // È il fatto che ha reso inerte la v155. Se un domani qualcuno rimettesse quella fascia, questo
  // test si accorge subito che un pezzo di app torna a dipendere da uno stato che era morto.
  const {browser, pagina, errori} = await apriApp();
  try{
    const fasi = await pagina.evaluate(() => {
      const viste = new Set();
      // Una settimana intera, minuto per minuto: ogni fase che l'app può davvero assumere.
      const base = Date.UTC(2026, 9, 12); // lunedì
      for(let m=0; m<7*24*60; m++) viste.add(liveSessionPhaseAt(base + m*60000));
      return [...viste].sort();
    });
    assert.ok(!fasi.includes('capital'),
      'liveSessionPhaseAt non può restituire "capital": fasi trovate = ' + fasi.join(','));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le due registrazioni del footprint passano dalla stessa variabile price', () => {
  // Questo invariante della v155 è ancora buono: se un domani una delle due righe usasse un
  // prezzo diverso dall'altra, lo stesso asset finirebbe registrato a due livelli diversi.
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const righe = src.match(/footprintRegisterTick\(price,Date\.now\(\),asset,undefined,'capital'\)/g) || [];
  assert.equal(righe.length, 2,
    'le due registrazioni (a grafico e di sottofondo) devono passare dalla stessa variabile: ' + righe.length);
});
