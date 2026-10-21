// LA LINEA DELL'ENTRATA FINISCE DOVE FINISCE L'OPERAZIONE.
//
// SEGNALATO dal proprietario con la schermata sotto gli occhi (XAU/USD a 5 minuti, una settimana
// di segnali): «la linea dell'entry viene prolungata davvero tanto. Deve finire nel punto in cui
// e' stato colpito l'ultimo TP o quando e' stato colpito lo stop loss. Altrimenti abbiamo linee
// di entrata lungo tutto quanto il grafico, quindi non e' corretto».
//
// ERA L'UNICA LINEA RIMASTA INDIETRO. Dal passo 18/19 ogni TP si ferma sulla candela in cui quel
// livello e' stato colpito, e lo stop sulla sua; l'entrata invece veniva disegnata fino a `x2`,
// cioe' il bordo destro della vista. Con molti segnali sullo stesso asset il risultato e' una
// ragnatela di linee bianche orizzontali che attraversano tutto il grafico - e una linea che non
// finisce non dice piu' quanto e' durata l'operazione.
//
// COSA SI MISURA QUI: non il disegno (un canvas non si interroga), ma il numero che decide dove
// la linea si ferma. Si costruiscono tre operazioni con esiti diversi e si guarda che l'entrata
// finisca dove deve.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {RADICE} from './aiuti.mjs';

const SORGENTE = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
const BLOCCO = (() => {
  const i = SORGENTE.indexOf('const xEntrataFine=');
  assert.ok(i > 0, 'il calcolo della fine dell\'entrata deve esistere');
  return SORGENTE.slice(i, i + 900);
})();

// La stessa logica del file, estratta per poterla esercitare con dei numeri.
const fineEntrata = (r, an, idx, x2, xFine) => {
  if (r.slPreso && an.slEnd != null) return xFine(an.slEnd);
  if (r.raggiunti > 0 && an.tpEnd && an.tpEnd[r.raggiunti - 1] != null) return xFine(an.tpEnd[r.raggiunti - 1]);
  if (an.b != null) return xFine(Math.min(an.b, idx));
  return x2;
};
const xFine = ri => ri;          // in prova la x e' l'indice stesso: si confrontano le candele
const BORDO = 9999;              // il bordo destro, cioe' il difetto da evitare

test('stop preso: l\'entrata finisce sulla candela dello stop', () => {
  const r = {slPreso: true, raggiunti: 2};
  const an = {slEnd: 140, tpEnd: [100, 120], b: 140};
  assert.equal(fineEntrata(r, an, 500, BORDO, xFine), 140);
});

test('TP presi e niente stop: finisce sull\'ULTIMO TP preso, non sul primo', () => {
  // `raggiunti` dice quanti TP sono stati presi: con 3 presi su 4, la linea si ferma al terzo.
  const r = {slPreso: false, raggiunti: 3};
  const an = {slEnd: null, tpEnd: [100, 120, 155, null], b: 155};
  assert.equal(fineEntrata(r, an, 500, BORDO, xFine), 155,
    'deve fermarsi al TP3 (candela 155), non al TP1 e non al bordo');
});

test('operazione ANCORA IN CORSO: la linea arriva ad adesso, ed e\' giusto', () => {
  // La prova di controllo, e la piu' importante: la cura non deve accorciare le operazioni vive.
  // Finche' niente e' stato colpito l'entrata e' ancora valida, e deve arrivare fino al presente.
  const r = {slPreso: false, raggiunti: 0};
  const an = {slEnd: null, tpEnd: [null, null], b: null};
  assert.equal(fineEntrata(r, an, 500, BORDO, xFine), BORDO,
    'un segnale ancora aperto deve continuare fino al bordo: accorciarlo sarebbe un difetto nuovo');
});

test('chiusa per altro motivo (scaduta o chiusa a mano): vale l\'ancora di fine', () => {
  const r = {slPreso: false, raggiunti: 0};
  const an = {slEnd: null, tpEnd: [null], b: 88};
  assert.equal(fineEntrata(r, an, 500, BORDO, xFine), 88);
});

test('e non si sfora mai la candela corrente del replay', () => {
  // Tornando indietro col replay, una linea non puo' arrivare a una candela che non e' ancora
  // stata raggiunta: finirebbe nel futuro di quello che si sta guardando.
  const r = {slPreso: false, raggiunti: 0};
  const an = {slEnd: null, tpEnd: [null], b: 300};
  assert.equal(fineEntrata(r, an, 120, BORDO, xFine), 120, 'si ferma alla candela di replay');
});

test('il codice dell\'app usa davvero questa regola, non il bordo', () => {
  // Il legame fra quello che si prova qui e quello che l'app disegna: senza, questo file
  // misurerebbe una copia e l'app potrebbe tornare a disegnare fino in fondo.
  assert.match(BLOCCO, /r\.slPreso&&an\.slEnd!=null/, 'lo stop preso viene prima di tutto');
  assert.match(BLOCCO, /an\.tpEnd\[r\.raggiunti-1\]/, 'poi l\'ultimo TP preso');
  assert.match(SORGENTE, /linea\(r\.entry,'rgba\(232,237,243,0\.85\)',\[4,3\],1\.2,xEntrataFine\)/,
    'e la linea dell\'entrata deve essere disegnata con QUESTA fine, non con x2');
});
