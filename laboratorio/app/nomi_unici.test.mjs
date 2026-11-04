// DUE DEFINIZIONI CON LO STESSO NOME: LA SECONDA CANCELLA LA PRIMA, IN SILENZIO.
//
// PERCHÉ ESISTE QUESTA PROVA, ed è un mio errore del 4 novembre 2026. Ho aggiunto un cronometro
// chiamando una sua funzione `fblCronoDisegna`. Quel nome ESISTEVA GIÀ in `app.html`: è il
// disegnatore della cronologia delle sale Telegram, assegnato a `window` più in basso nel file e
// chiamato dal `draw()` con nove argomenti. Risultato: la mia dichiarazione veniva soppiantata da
// quella, il mio cronometro era **codice morto**, e me ne sono accorto solo perché un test
// leggeva un riquadro rimasto vuoto.
//
// È ANDATA BENE PER UN SOFFIO. A ordine invertito — la mia dopo la sua — avrei **rotto un grafico
// che funziona**, e nessun test lo avrebbe detto: `draw()` chiama quel nome dentro un
// `try/catch`, quindi il grafico delle sale sarebbe semplicemente scomparso, senza un errore a
// schermo.
//
// In un file da 55.000 righe un nome nuovo non si controlla a memoria. Lo controlla questa prova.
//
// DUE DISTINZIONI CHE HO DOVUTO IMPARARE SCRIVENDOLA, e senza le quali era rossa su un codice
// sano:
//   1. `window.nome = nome` è un'ABITUDINE VOLUTA di questo progetto: si dichiara la funzione e
//      poi si espone su window perché la raggiunga anche il modulo Firebase. Innocua. Il caso
//      pericoloso è un altro: `window.nome = function(...)`, cioè una SECONDA definizione.
//   2. Nella guida agli indicatori ci sono ESEMPI scritti a mano (`function compute(rows, ...)
//      { ... }`) che non sono codice: vivono dentro testo. Si riconoscono dal segnaposto `{ ... }`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {RADICE} from './aiuti.mjs';

const SORGENTE = () => fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');

// Una riga che contiene il segnaposto `{ ... }` è un esempio nella documentazione, non una
// funzione vera: nessuno scrive tre puntini come corpo di una funzione che deve girare.
const esempioScritto = (riga) => /\{\s*\.\.\.\s*\}/.test(riga);

function dichiarazioni(sorgente){
  const trovate = new Map();   // nome -> righe
  sorgente.split('\n').forEach((riga, i) => {
    const m = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(riga);
    if(!m || esempioScritto(riga)) return;
    if(!trovate.has(m[1])) trovate.set(m[1], []);
    trovate.get(m[1]).push(i + 1);
  });
  return trovate;
}

test('nessuna funzione è dichiarata due volte in app.html', () => {
  const trovate = dichiarazioni(SORGENTE());
  // Controllo del banco: se la ricerca non trovasse le funzioni, la prova sarebbe verde a vuoto.
  assert.ok(trovate.size > 500,
    'la ricerca non ha trovato le funzioni di app.html (' + trovate.size + '): misurerebbe il vuoto');
  const doppie = [...trovate.entries()]
    .filter(([, righe]) => righe.length > 1)
    .map(([nome, righe]) => nome + ' (righe ' + righe.join(', ') + ')');
  assert.deepEqual(doppie, [],
    'queste funzioni sono dichiarate più di una volta, e l\'ultima cancella le altre in silenzio: '
    + doppie.join(' — '));
});

// L'ALTRA METÀ DELLO STESSO DIFETTO, ed è esattamente quella che mi ha preso: una funzione
// dichiarata con `function nome(){}` e POI ridefinita con `window.nome = function(...)`. Non si
// vede cercando due `function` uguali, e quale delle due sopravvive dipende dall'ordine nel file.
test('nessuna funzione dichiarata viene poi RIDEFINITA su window', () => {
  const sorgente = SORGENTE();
  const dichiarate = new Set(dichiarazioni(sorgente).keys());
  const scontri = [];
  sorgente.split('\n').forEach((riga, i) => {
    // NIENTE ANCORA DI FINE RIGA, e per un carattere invisibile: app.html ha fine-riga
    // Windows, quindi ogni riga finisce con un ritorno a capo in piu'. In JavaScript il punto
    // non prende i fine-riga, e l'ancora di fine riga senza il modificatore multilinea combacia
    // solo alla fine della STRINGA: con quell'ancora in coda questa riga non veniva MAI
    // esaminata, e la guardia era muta proprio sul difetto per cui l'ho scritta. Trovato
    // provandola nei due sensi: senza quella prova sarebbe entrata verde e inutile.
    const m = /^\s*window\.([A-Za-z_$][\w$]*)\s*=\s*(.*)/.exec(riga);
    if(!m || !dichiarate.has(m[1])) return;
    // `window.nome = nome` espone e non ridefinisce: è l'abitudine voluta del progetto.
    // `window.nome = function(...)`, `= (…)=>` o `= async function` sono una seconda definizione.
    const nuovaDefinizione = /^(?:async\s+)?function\b|^\(|^[A-Za-z_$][\w$]*\s*=>/.test(m[2]);
    if(nuovaDefinizione) scontri.push(m[1] + ' (riga ' + (i + 1) + ')');
  });
  assert.ok(dichiarate.size > 500, 'la ricerca non ha trovato le funzioni: misurerebbe il vuoto');
  assert.deepEqual(scontri, [],
    'questi nomi sono sia dichiarati come funzione sia RIDEFINITI su window: una delle due '
    + 'versioni non girerà mai, e quale dipende dall\'ordine nel file — ' + scontri.join(' — '));
});
