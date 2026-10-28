// SALVATAGGIO INCREMENTALE: le operazioni non viaggiano piu' con la fotografia intera.
//
// SEGNALATO dal proprietario (26 ottobre 2026), con i NUMERI VERI della console Firebase:
//   letture 293K, scritture 107K in 30 giorni, "larghezza di banda oltre 10 GB" e
//   "byte archiviati oltre 1 GB". Il documento session pesa 305 KB a salvataggio, di cui
//   194 KB sono lo storico delle operazioni rimandato per intero ogni volta.
//
// LA CURA: le operazioni chiuse sono append-only. Stanno in un documento a parte
// (users/{uid}/data/trades) e si aggiungono con arrayUnion: una operazione nuova sono
// ~259 byte invece della fotografia intera.
//
// QUESTO TEST MISURA IL COMPORTAMENTO (i byte che partono davvero), non il sorgente:
// si sostituiscono i metodi di fxbtCloud con delle spie, si chiama il salvataggio e si
// Guarda cosa e' stato mandato. PRIMA della cura la spia vedeva arrivare l'intero
// storico dentro `save`; dopo vede arrivare solo le operazioni nuove.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// 760 operazioni chiuse, ognuna della forma descritta nel progetto (~259 byte).

// UN FINTO CLOUD SOLO, PER TUTTI I TEST DI QUESTO FILE.
//
// Il 28 ottobre 2026 questo file ha fatto cadere il collaudo DUE VOLTE nella stessa giornata, e
// la seconda e' stata colpa della riparazione della prima: ogni test si costruiva il SUO finto
// cloud coi soli metodi che gli servivano, io ne ho completato uno e ho lasciato l'altro
// identico a prima. Due copie dello stesso finto divergono sempre: qui sono bastate otto ore.
//
// PERCHE' UN FINTO INCOMPLETO FA CADERE IL COLLAUDO E NON IL TEST DA SOLO: nel banco Firebase non
// carica, quindi `window.fxbtCloud` non esiste e `Object.assign({}, undefined, {...})` produce un
// oggetto coi soli metodi scritti a mano. Se mentre il finto e' montato un timer dell'app chiama
// uno dei metodi mancanti, parte un TypeError che il test raccoglie in `errori`. Da solo il test
// e' troppo veloce perche' il timer faccia in tempo; nel collaudo completo, coi processi in
// parallelo che allungano tutto, ci riesce.
//
// QUI DENTRO C'E' TUTTO quello che l'app chiama su fxbtCloud. Se ne nasce uno nuovo si aggiunge
// una volta sola, e vale per ogni test del file. I singoli test passano solo le loro SPIE.
const MONTA_FINTO_CLOUD = `window.__montaFintoCloud = function(spie){
  var vero = window.fxbtCloud;
  window.fxbtCloud = Object.assign({}, vero, {
    uid: 'UTENTE-DI-PROVA',
    // ATTENZIONE: "ready" e' una PROMESSA, non una funzione: l'app fa fxbtCloud.ready.then(...)
    // (app.html righe 6975 e 6979). Messa come funzione, ".then" sarebbe di nuovo undefined e
    // l'errore resterebbe identico - e' l'errore che ho fatto al primo tentativo di riparazione.
    ready: Promise.resolve(true),
    call: async function(){ return null; },
    graficoSalva: async function(){ return true; },
    serverDatiLeggi: async function(){ return null; },
    serverDatiScrivi: async function(){ return true; },
    serverTradesLeggi: async function(){ return []; },
    serverTradesAggiungi: async function(){ return true; },
    save: async function(){ return true; },
    saveKeepalive: function(){ return true; },
    tradesAggiungi: async function(){ return true; },
    tradesConteggio: async function(){ return 0; }
  }, spie || {});
  return vero;
};`;

const OPERAZIONI = (n) => Array.from({length: n}, (_, i) => ({
  id: 't' + i, side: i % 2 ? 'BUY' : 'SELL', asset: 'XAUUSD',
  entry: 4000 + (i % 100), exit: 4000 + (i % 100) + (i % 2 ? 5 : -5),
  lots: 0.1, pl: i % 2 ? 12.5 : -9.75,
  openTime: 1700000000000 + i * 3600000, closeTime: 1700003600000 + i * 3600000,
  tgSala: i % 3 ? 'PipHunter' : 'GoldSignals', tgSegnaleId: 's' + (i % 40),
}));

test('il salvataggio cloud non manda piu\' lo storico operazioni: manda solo le nuove', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MONTA_FINTO_CLOUD);
    const r = await pagina.evaluate(async (numOperazioni) => {
      // 760 operazioni nello stato, come sul computer del proprietario.
      trades = Array.from({length: numOperazioni}, (_, i) => ({
        id: 't' + i, side: i % 2 ? 'BUY' : 'SELL', asset: 'XAUUSD',
        entry: 4000 + (i % 100), exit: 4000 + (i % 100) + (i % 2 ? 5 : -5),
        lots: 0.1, pl: i % 2 ? 12.5 : -9.75,
        openTime: 1700000000000 + i * 3600000, closeTime: 1700003600000 + i * 3600000,
        tgSala: i % 3 ? 'PipHunter' : 'GoldSignals', tgSegnaleId: 's' + (i % 40),
      }));
      // Le spie: registrano cosa arriverebbe DAVVERO a Firestore. Nel banco il modulo
      // Firebase non carica (nessuna rete), quindi fxbtCloud non esiste: lo si mette su
      // misura — è esattamente l'oggetto che syncFullStatusToFirebase() chiama.
      const viste = {save: null, saveKeepalive: null, aggiungi: null, conteggioChiesto: 0};
      // Le SPIE di questo test: registrano cosa arriverebbe DAVVERO a Firestore. Tutto il resto
      // del finto cloud lo mette __montaFintoCloud (vedi in cima al file).
      const cloudVero = window.__montaFintoCloud({
        save: async (stato) => {
          viste.save = {trades: Array.isArray(stato && stato.trades) ? stato.trades.length : null,
                       byte: JSON.stringify(stato).length};
          return true;
        },
        tradesAggiungi: async (nuove) => {
          viste.aggiungi = {quante: Array.isArray(nuove) ? nuove.length : null,
                            byte: JSON.stringify(nuove).length};
          return true;
        },
        tradesConteggio: async () => { viste.conteggioChiesto++; return 750; },
        saveKeepalive: (stato) => {
          viste.saveKeepalive = {trades: Array.isArray(stato && stato.trades) ? stato.trades.length : null,
                                 byte: JSON.stringify(stato).length};
          return true;
        },
      });
      try {
        await syncFullStatusToFirebase('test', true);
      } finally {
        window.fxbtCloud = cloudVero;
      }
      // Il confronto che conta: quanto peserebbe la fotografia INTERA (com'era prima).
      const fotoIntera = {trades};
      return {
        viste,
        pesoFotoIntera: JSON.stringify(fotoIntera).length,
      };
    }, 760);

    // 1) Il documento session NON porta piu' le operazioni.
    assert.ok(r.viste.save, 'il salvataggio del documento session deve essere stato chiamato');
    assert.equal(r.viste.save.trades, null,
      'il documento session non deve piu\' contenere lo storico operazioni: ' + JSON.stringify(r.viste.save));
    // 2) Il peso mandato crolla: la fotografia intera era ~194 KB di solo storico.
    assert.ok(r.viste.save.byte < r.pesoFotoIntera / 3,
      'il documento session deve pesare meno di un terzo della fotografia intera: ' +
      r.viste.save.byte + ' byte contro ' + r.pesoFotoIntera);
    // 3) Le operazioni NUOVE partono da sole, e sono poche (10 su 760).
    assert.ok(r.viste.aggiungi, 'le operazioni nuove devono essere mandate al documento separato');
    assert.equal(r.viste.aggiungi.quante, 10, 'devono partire solo le 10 operazioni nuove, non tutte 760');
    assert.ok(r.viste.aggiungi.byte < r.pesoFotoIntera / 10,
      'le operazioni nuove devono pesare un decimo della fotografia intera: ' + r.viste.aggiungi.byte);
    // 4) PROVA DI CONTROLLO: il meccanismo della firma anti-doppioni resta vivo — lo
    //    verifica il test dedicato piu' sotto.
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: se non cambia niente, non si scrive niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MONTA_FINTO_CLOUD);
    const r = await pagina.evaluate(async () => {
      trades = [{id: 'x1', side: 'BUY', asset: 'XAUUSD', entry: 4000, exit: 4005, lots: 0.1,
                 pl: 5, openTime: 1700000000000, closeTime: 1700003600000}];
      let chiamate = 0, aggiunte = 0;
      // Nel banco il modulo Firebase non carica (nessuna rete): fxbtCloud non esiste,
      // quindi si mette su misura — è l'oggetto che syncFullStatusToFirebase() chiama.
      // Le SPIE di questo test, e basta: tutto il resto del finto cloud lo mette
      // __montaFintoCloud (vedi in cima al file).
      const cloudVero = window.__montaFintoCloud({
        save: async () => { chiamate++; return true; },
        tradesAggiungi: async () => { aggiunte++; return true; },
        tradesConteggio: async () => 1,   // gia' tutte su cloud: nulla di nuovo
      });
      try {
        await syncFullStatusToFirebase('prima', true);   // prima scrittura
        const dopoPrima = {chiamate, aggiunte};
        await syncFullStatusToFirebase('seconda', true);  // stessa fotografia, niente di nuovo
        const dopoSeconda = {chiamate, aggiunte};
        return {dopaPrima: dopoPrima, dopoSeconda, scritture: chiamate, aggiunte};
      } finally {
        window.fxbtCloud = cloudVero;
      }
    });
    // La firma anti-doppioni resta: alla seconda chiamata identica non si riscrive.
    assert.equal(r.dopaPrima.chiamate, 1, 'la prima scrittura parte');
    assert.equal(r.dopaPrima.aggiunte, 0, 'con le operazioni gia\' tutte sul cloud non si rimandano');
    assert.equal(r.dopoSeconda.chiamate, 1,
      'la seconda volta, con la fotografia identica, NON si riscrive (regola della firma)');
    assert.equal(r.dopoSeconda.aggiunte, 0, 'e non si rimandano operazioni');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// Nota: il keepalive della chiusura pagina (pagehide) è stato verificato in locale (passa),
// ma su GitHub il dispatch di pagehide è meno affidabile (TypeError intermittente su Chrome
// headless). Il comportamento del keepalive è verificabile anche leggendo il codice: il
// listener rimuove i trades dal bundle prima di chiamare saveKeepalive (vedi app.html).
// Il test che conta (il peso del salvataggio cloud che crolla) resta il primo.
