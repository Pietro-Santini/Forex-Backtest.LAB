// IL TESTO DELL'APP NON DEVE RESTARE STORPIATO DA UNO SCRIPT DI MASSA.
//
// SEGNALATO dal proprietario il 21 ottobre: «come mai hai incominciato a prendere il desktop e a
// riempirlo di file? Mettili nella cartella apposita o eliminali». Erano 50 script di debug
// lasciati sul Desktop, tutti datati 19 ottobre. Spostati via - ma uno di loro aveva lasciato un
// danno dentro app.html, ed e' quello che questo test tiene fermo.
//
// IL DANNO. `fix_all_apostrofi_final.py` trovava `l'app`, scriveva `l\'app` e poi avanzava di 4
// caratteri invece di 5: l'ultima `p` veniva riprocessata e riscritta. Risultato: 165 parole
// storpiate in `appp` e `appplicazione`. Non solo nei commenti - anche in testi che l'utente
// legge, per esempio il suggerimento «Ricarica l\'app (nell\'appp installata...)».
// Piu' 31 backslash finiti in commenti e testo HTML, dove non sono escape ma caratteri.
//
// PERCHE' UN TEST E NON SOLO UNA CORREZIONE: una sostituzione di massa su un file da 4,7 MB e'
// una cosa che si rifara', prima o poi, per un altro motivo. Questo test e' la rete che si
// accorge se quel tipo di errore torna - e costa un millisecondo.
//
// NOTA SUL METODO, perche' mi ha ingannato due volte: contando i backslash da riga di comando, la
// shell li mangiava prima che arrivassero a Python, e il conto tornava *apostrofi* invece di
// *backslash-apostrofo* (176, poi 378: entrambi falsi). Un numero che non torna con quello che si
// vede davanti e' sempre un numero sbagliato. Qui si usa String.fromCharCode(92), che non passa
// da nessun escape.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {RADICE} from './aiuti.mjs';

const BS = String.fromCharCode(92);

test('nessuna parola storpiata in "appp"', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const quanti = (src.match(/appp/g) || []).length;
  assert.equal(quanti, 0,
    'trovate ' + quanti + ' occorrenze di "appp": e\' la firma di una sostituzione di massa che '
    + 'ha avanzato di un carattere in meno del dovuto');
});

test('nessun backslash lasciato nei commenti HTML, dove non e\' un escape', () => {
  // In un commento HTML (o in un commento CSS) il backslash non significa niente: e' solo un
  // carattere in piu' che sporca la frase. Dentro una stringa JavaScript invece serve, e li' non
  // si tocca - per questo si guardano SOLO i commenti HTML.
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const sporchi = [];
  for (const m of src.matchAll(/<!--[\s\S]*?-->/g)) {
    if (m[0].includes(BS + "'")) sporchi.push(m[0].slice(0, 90).replace(/\s+/g, ' '));
  }
  assert.deepEqual(sporchi, [],
    'commenti HTML con un backslash di troppo: ' + JSON.stringify(sporchi.slice(0, 3)));
});

test('gli escape veri dentro le stringhe JavaScript restano al loro posto', () => {
  // LA PROVA DI CONTROLLO, ed e' la piu' importante di questo file: la cura di un testo storpiato
  // e' togliere backslash, e chi la esagera rompe il codice. Nel file ce ne sono centinaia che
  // SERVONO (l\'app dentro una stringa fra apici singoli): se un domani una pulizia troppo
  // allegra li togliesse, l'app non partirebbe nemmeno - e questo test lo direbbe prima.
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const quanti = src.split(BS + "'").length - 1;
  assert.ok(quanti > 300,
    'gli escape legittimi nelle stringhe JS devono restare: trovati ' + quanti
    + ', erano 521 il 21 ottobre');
});
