// NESSUN ID PUO' ESSERE RIPETUTO: un id è l'indirizzo di un elemento, e due elementi con lo
// stesso id si spartiscono l'indirizzo.
//
// MISURATO il 22 ottobre 2026: nel pannello «Collegamento» c'erano blocchi interi duplicati.
// getElementById restituisce IL PRIMO, quindi metà dei controlli era MORTA senza che nessuno se
// ne accorgesse: il secondo «Collegamento: —» non reagiva, la seconda casella api_id non
// accettava più nulla. E la cosa peggiore: spostando il primo blocco in un'altra sezione si
// «accendeva» il secondo, e il comportamento cambiava in modo inspiegabile.
//
// QUI SI MISURA IL DOM VERO (la pagina aperta in un browser), non il testo del file: conta solo
// quello che l'utente vede e su cui il codice agisce davvero. Un id che si ripete dentro una
// stringa JavaScript NON è un difetto, e questo test non lo penalizza.
//
// LA PROVA DI CONTROLLO c'è ed è in fondo: si crea un id duplicato apposta e si verifica che il
// controllo lo veda. Un test che non può diventare rosso non dimostra niente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// La conta gira DENTRO la pagina: è l'unico posto dove si vede il DOM vero.
const CONTA_DUPLICATI = () => {
  const quanti = new Map();
  document.querySelectorAll('[id]').forEach(el => {
    const id = el.id;
    if (!id) return;
    quanti.set(id, (quanti.get(id) || 0) + 1);
  });
  const doppi = [];
  quanti.forEach((n, id) => { if (n > 1) doppi.push({id, n}); });
  doppi.sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));
  return doppi;
};

test('nessun id è ripetuto nella pagina', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const doppi = await pagina.evaluate(CONTA_DUPLICATI);
    assert.deepEqual(doppi, [],
      'id ripetuti nella pagina (il secondo è quello che il codice non vede mai): ' +
      doppi.map(d => d.id + ' x' + d.n).join(', '));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i controlli del collegamento e delle sale segnali ci sono una volta sola', async () => {
  // I nomi contati: sono quelli che il codice cerca con getElementById. Se uno di questi
  // fosse duplicato, l'app si accenderebbe a metà: metà dei pulsanti premerebbero e metà no.
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((ids) => {
      const conta = {};
      ids.forEach(id => { conta[id] = document.querySelectorAll('#' + id).length; });
      return conta;
    }, ['tgToggleBtn', 'tgSetupBox', 'tgApiId', 'tgApiHash', 'tgSalvaCredBtn',
        'tgDimenticaTelBtn', 'tgTelefonoForgetBtn', 'tgTelefonoSalvatoLbl',
        'tgGroupList', 'tgNewGroup', 'tgAddBtn', 'tgOpenPanelBtn', 'tgAutoBtn',
        'tgStatusBox', 'tgPort', 'tgRefreshBtn']);
    const ripetuti = Object.entries(r).filter(([, n]) => n > 1).map(([id, n]) => id + ' x' + n);
    assert.deepEqual(ripetuti, [],
      'questi controlli devono esistere una volta sola: ' + ripetuti.join(', '));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: se un id si ripete, il controllo lo vede', async () => {
  // Il test deve poter diventare rosso. Qui si crea un duplicato apposta: se il controllo
  // non lo nota, il test di sopra non vale niente.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((CONTA) => {
      const conta = eval('(' + CONTA + ')');
      const prima = conta();
      const finta = document.createElement('div');
      finta.id = 'tgStatusBox';            // id già presente nella pagina
      document.body.appendChild(finta);
      const dopo = conta();
      finta.remove();
      const tornato = conta();
      return {prima, dopo, tornato};
    }, CONTA_DUPLICATI.toString());
    assert.deepEqual(r.prima, [], 'la pagina di partenza è pulita');
    assert.ok(r.dopo.some(d => d.id === 'tgStatusBox'),
      'il controllo deve vedere l\'id duplicato appena creato: ' + JSON.stringify(r.dopo));
    assert.deepEqual(r.tornato, [], 'e deve tornare pulito quando il duplicato sparisce');
  } finally { await browser.close(); }
});
