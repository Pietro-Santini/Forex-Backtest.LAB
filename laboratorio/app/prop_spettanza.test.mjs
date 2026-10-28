// QUANTO TI SPETTEREBBE, a conto sbloccato.
//
// RICHIESTO dal proprietario: «alla fine, quando la sblocchiamo, sul conto avremo la
// visualizzazione di quanto ci aspetterebbe».
//
// LA SOTTIGLIEZZA CHE CAMBIA IL RISULTATO, e che e' facile sbagliare: il profitto delle SFIDE
// NON SI INCASSA. Le sfide sono simulate - servono solo a dimostrare di saper operare. Si viene
// pagati sul profitto fatto DOPO, sul conto finanziato.
//
// Contare anche il profitto delle sfide gonfierebbe la cifra in modo clamoroso proprio nel punto
// in cui l'utente la guarda per decidere se la cosa vale la pena: sarebbe il numero sbagliato
// nel momento peggiore.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const U = (giorno, h) => Date.UTC(2026, 0, giorno, h, 0, 0);

async function conta(punti, capitale, apertoMs, preset){
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((a) => {
      if(a.preset) window.fblPropPresetImposta(a.preset);
      return window.fblPropDedicataConta(a.punti, a.capitale, a.apertoMs);
    }, {punti, capitale, apertoMs, preset});
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    return r;
  } finally { await browser.close(); }
}

test('conto non ancora sbloccato: non spetta niente, e non si inventa una cifra', async () => {
  const r = await conta(
    [{t:U(2,12), cap:10200}, {t:U(3,12), cap:10300}, {t:U(4,12), cap:10400},
     {t:U(5,12), cap:10500}],
    10000, U(2,0), 'ftmo-2step'
  );
  assert.notEqual(r.esito, 'sbloccata');
  assert.ok(!r.spettanza || r.spettanza.tuo === 0,
    'finche\' il conto non e\' finanziato non spetta nulla: mostrare una cifra sarebbe una bugia');
});

test('one step sbloccato: spetta il 90% del profitto fatto DOPO', async () => {
  // Il one step ha una fase sola: si sblocca al +10%, e da li' in poi il conto e' finanziato.
  // Cinque giornate per arrivare a 11.000 (sfida), poi altre tre che aggiungono 600 euro.
  // Quei 600 sono il profitto del conto finanziato: il 90% fa 540.
  const punti = [
    {t:U(2,12), cap:10200}, {t:U(3,12), cap:10400}, {t:U(4,12), cap:10600},
    {t:U(5,12), cap:10800}, {t:U(6,12), cap:11000},
    {t:U(7,12), cap:11200}, {t:U(8,12), cap:11400}, {t:U(9,12), cap:11600}
  ];
  const r = await conta(punti, 10000, U(2,0), 'ftmo-1step');
  assert.equal(r.esito, 'sbloccata');
  assert.equal(r.quotaTrader, 90);
  assert.ok(r.spettanza, 'a conto sbloccato la cifra ci dev\'essere');
  assert.ok(Math.abs(r.spettanza.profitto - 600) < 1,
    'il profitto che conta e\' quello fatto DOPO lo sblocco (600), non il totale: era '
    + r.spettanza.profitto);
  assert.ok(Math.abs(r.spettanza.tuo - 540) < 1,
    'il 90% di 600 fa 540: era ' + r.spettanza.tuo);
});

test('PROVA DI CONTROLLO: NON si conta il profitto delle sfide', async () => {
  // La stessa curva di sopra: se si contasse tutto il profitto (1.600 invece di 600), la cifra
  // sarebbe 1.440 invece di 540 - quasi il triplo. E' l'errore che questo test impedisce, ed e'
  // quello che si farebbe senza pensarci.
  const punti = [
    {t:U(2,12), cap:10200}, {t:U(3,12), cap:10400}, {t:U(4,12), cap:10600},
    {t:U(5,12), cap:10800}, {t:U(6,12), cap:11000},
    {t:U(7,12), cap:11200}, {t:U(8,12), cap:11400}, {t:U(9,12), cap:11600}
  ];
  const r = await conta(punti, 10000, U(2,0), 'ftmo-1step');
  assert.ok(r.spettanza.tuo < 1000,
    'contando anche le sfide verrebbero 1.440: sarebbe il numero sbagliato nel momento peggiore');
});

test('two step: la quota e\' l\'80%, non il 90%', async () => {
  // Due sfide da passare, e al trader spetta l'80%. Se la quota fosse fissa nel codice invece di
  // arrivare dal preset, qui uscirebbe lo stesso numero del one step.
  const punti = [];
  for(let g=2; g<=7; g++)  punti.push({t:U(g,12), cap:10000 + (g-1)*200});
  for(let g=8; g<=13; g++) punti.push({t:U(g,12), cap:11200 + (g-7)*120});
  for(let g=14; g<=16; g++) punti.push({t:U(g,12), cap:11920 + (g-13)*100});
  const r = await conta(punti, 10000, U(2,0), 'ftmo-2step');
  assert.equal(r.esito, 'sbloccata');
  assert.equal(r.quotaTrader, 80, 'nel two step la quota del trader e\' l\'80%');
  assert.ok(r.spettanza && r.spettanza.tuo > 0, 'e la cifra dev\'esserci');
  assert.ok(Math.abs(r.spettanza.tuo - r.spettanza.profitto * 0.8) < 1,
    'dev\'essere l\'80% del profitto dopo lo sblocco');
});
