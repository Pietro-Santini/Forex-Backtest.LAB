// LA RESA DELLA SALA TIENE CONTO DELLO SPOSTAMENTO DELLO STOP.
//
// RICHIESTO dal proprietario (8 ottobre 2026): «quando si calcola la resa economica nel tempo di
// quella sala, deve tener conto anche dello spostamento dello stop loss, se impostato. Se al TP2
// sposta lo stop al punto di entrata, il calcolo alla fine sara' diverso».
//
// Il difetto che questo test impedisce e' silenzioso: si configurano gli spostamenti, si guarda il
// grafico del rendimento, e quel grafico li ignora. Nessun errore, nessun avviso - solo un numero
// sbagliato su cui si decide se fidarsi di una sala.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Un segnale che arriva al primo target e poi torna indietro fino allo stop iniziale.
// Senza spostamento: al TP1 incassa la sua quota, il resto esce in perdita.
// Con lo stop a pareggio dopo il TP1: il resto esce a zero invece che in perdita.
const SCENA = () => {
  const c = (t, h, l) => ({t, o: 100, h, l, c: 100});
  return {
    segnale: {valutato: true, tFill: 1000, ts: 1000, entry: 100, sl: 90, tps: [110, 120], raggiunti: 1, slPreso: true},
    candele: [c(1000, 101, 99), c(2000, 112, 99), c(3000, 101, 89)]
  };
};

test('cambiando dove va lo stop, la resa della sala cambia davvero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((scena) => {
      const {segnale, candele} = eval('(' + scena + ')')();
      const ris = [segnale];
      const serie = [candele];
      const quote = [50, 50];
      // a) nessuno spostamento: quello che resta aperto esce allo stop iniziale, in perdita
      const fermo = fblCronoRendCurva(ris, 10000, 1, serie, {modo: 'posizioni', quote, regole: ['', '']});
      // b) al TP1 lo stop va a pareggio: quello che resta esce a zero
      const pareggio = fblCronoRendCurva(ris, 10000, 1, serie, {modo: 'posizioni', quote, regole: ['entrata', '']});
      // c) stessa cosa con la chiusura parziale: la posizione e' una, lo stop e' uno
      const parzialeFermo = fblCronoRendCurva(ris, 10000, 1, serie, {modo: 'parziali', quote, regole: ['', '']});
      const parzialePareggio = fblCronoRendCurva(ris, 10000, 1, serie, {modo: 'parziali', quote, regole: ['entrata', '']});
      // d) senza candele non si puo' rigiocare niente: e' il caso in cui NON si conta
      const senzaCandele = fblCronoRendCurva(ris, 10000, 1, null, {modo: 'posizioni', quote, regole: ['entrata', '']});
      return {
        fermo: fermo.finale, pareggio: pareggio.finale,
        parzialeFermo: parzialeFermo.finale, parzialePareggio: parzialePareggio.finale,
        senzaCandele: senzaCandele.finale
      };
    }, SCENA.toString());
    assert.notEqual(r.fermo, r.pareggio,
      'lo spostamento dello stop non ha cambiato il risultato: non viene conteggiato');
    assert.ok(r.pareggio > r.fermo,
      'portare lo stop a pareggio dopo il primo target deve far finire meglio, non peggio: ' + r.fermo + ' -> ' + r.pareggio);
    assert.notEqual(r.parzialeFermo, r.parzialePareggio,
      'anche con la chiusura parziale lo stop si sposta, quindi il risultato deve cambiare');
    assert.equal(r.fermo, r.parzialeFermo,
      'in multipli del rischio le due metodologie danno lo stesso numero: cambia come si esegue');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza candele in memoria lo spostamento non si puo conteggiare, e il numero resta quello semplice', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((scena) => {
      const {segnale} = eval('(' + scena + ')')();
      const ris = [segnale];
      const a = fblCronoRendCurva(ris, 10000, 1, null, {modo: 'posizioni', quote: [50, 50], regole: ['entrata', '']});
      const b = fblCronoRendCurva(ris, 10000, 1, null, {modo: 'posizioni', quote: [50, 50], regole: ['', '']});
      return {conRegole: a.finale, senzaRegole: b.finale};
    }, SCENA.toString());
    // E' la verita' scomoda da sapere: senza candele i due casi danno lo STESSO numero, perche'
    // non si sta rigiocando niente. Per questo la nota sotto il grafico lo dice a chiare lettere.
    assert.equal(r.conRegole, r.senzaRegole,
      'senza candele non si rigioca: i due casi devono coincidere, ed e il motivo dell avviso');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
