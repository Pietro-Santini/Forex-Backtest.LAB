// IL FOOTPRINT NEL DOCUMENTO SUO: fino a 400 KB che non passano piu' da ogni salvataggio.
//
// LA BOLLETTA (numeri veri della console Firebase, 30 giorni, scritti anche in
// syncFullStatusToFirebase): letture 293K, scritture 107K, "larghezza di banda oltre 10 GB",
// "byte archiviati oltre 1 GB". Tolto lo storico operazioni (194 KB, curato il 26 ottobre col
// salvataggio incrementale), RESTAVA il secondo pezzo grosso: footprintCollectCloudAggregate()
// arrivava fino a FOOTPRINT_CLOUD_MAX_BYTES (400 KB) e finiva DENTRO il documento session,
// quindi veniva rimandato per intero ad ogni salvataggio (pagehide, logout, operazione chiusa).
//
// LA CURA (31 ottobre 2026): il footprint esce dal session e sta in users/{uid}/data/footprint,
// documento a parte, scritto solo se cambiato e non piu' di una volta al minuto. E' una rete di
// sicurezza per gli asset senza log tick locale, non un dato che cambia ad ogni tick: un minuto
// di ritardo non si vede, 400 KB ad ogni salvataggio si pagano.
//
// QUESTO TEST MISURA I BYTE CHE PARTONO DAVVERO, non il sorgente: come per il salvataggio
// incrementale, si sostituisce fxbtCloud con delle spie e si guarda cosa arriverebbe a Firestore.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// UN FINTO CLOUD COMPLETO, uno solo per tutto il file (lezione del 28 ottobre 2026: due copie
// divergenti dello stesso finto hanno fatto cadere il collaudo due volte in un giorno). Qui
// dentro c'e' TUTTO quello che l'app chiama su fxbtCloud, compresi i due metodi nuovi del
// footprint. Se ne nasce uno nuovo si aggiunge una volta sola, e vale per ogni test.
const MONTA_FINTO_CLOUD = `window.__montaFintoCloud = function(spie){
  var vero = window.fxbtCloud;
  window.fxbtCloud = Object.assign({}, vero, {
    uid: 'UTENTE-DI-PROVA',
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
    tradesConteggio: async function(){ return 0; },
    footprintLeggi: async function(){ return null; },
    footprintSalva: async function(){ return false; }
  }, spie || {});
  return vero;
};`;

// Celle footprint finte ma del peso VERO: ~200 KB, come quelle che stanno sul computer del
// proprietario (la misura del progetto diceva 106 KB al tetto del footprint, con un tetto
// possibile di 400 KB).
const celleFootprint = () => {
  const celle = {};
  for (let asset = 0; asset < 3; asset++) {
    const perAsset = {};
    for (let bucket = 0; bucket < 120; bucket++) {
      const righe = [];
      for (let prezzo = 0; prezzo < 40; prezzo++) {
        righe.push([4000 + prezzo, 100 + prezzo * 7, 90 + prezzo * 5, asset * 10 + bucket]);
      }
      perAsset[String(1700000000 + bucket * 60000)] = righe;
    }
    celle['XAUUSD' + asset] = perAsset;
  }
  return celle;
};

test('il footprint non viaggia piu\' dentro il salvataggio del session', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MONTA_FINTO_CLOUD);
    const r = await pagina.evaluate(async (celle) => {
      // Il footprint grosso, come se l'app l'avesse raccolto davvero.
      footprintCollectCloudAggregate = () => celle;
      const viste = {save: null, footprint: null};
      const cloudVero = window.__montaFintoCloud({
        save: async (stato) => {
          const testo = JSON.stringify(stato);
          viste.save = {
            haFootprint: !!(stato && 'footprintCells' in stato),
            haTrades: !!(stato && 'trades' in stato),
            // Quanti campi restano: il session non deve SVUOTARSI togliendo i due pezzi grossi.
            chiavi: stato ? Object.keys(stato).length : 0,
            byte: testo.length
          };
          return true;
        },
        footprintSalva: async (ce) => {
          viste.footprint = {quantiAsset: ce ? Object.keys(ce).length : null,
                             byte: JSON.stringify(ce).length};
          return true;
        },
      });
      try { await syncFullStatusToFirebase('test', true); }
      finally { window.fxbtCloud = cloudVero; }
      return {
        viste,
        pesoSoloFootprint: JSON.stringify(celle).length
      };
    }, celleFootprint());

    // 1) Il documento session non porta piu' il footprint: e' il risparmio, in un campo.
    assert.ok(r.viste.save, 'il salvataggio del documento session deve essere stato chiamato');
    assert.equal(r.viste.save.haFootprint, false,
      'il documento session non deve piu\' contenere footprintCells: ' + JSON.stringify(r.viste.save));
    // 2) E non deve essersi svuotato: togliendo i due pezzi grossi (footprint e, nel percorso
    //    incrementale, anche le operazioni che viaggiano da sole) il documento session resta un
    //    documento con i suoi campi - conto, posizioni, viste, disegni.
    assert.ok(r.viste.save.chiavi > 0,
      'il session non deve svuotarsi togliendo il footprint: ' + JSON.stringify(r.viste.save));
    assert.equal(r.viste.save.haTrades, false,
      'nel percorso incrementale le operazioni non stanno nel session: e\' la cura del 26 ottobre');
    // 3) Il peso mandato crolla: senza quei byte il documento e' molto piu' leggero.
    assert.ok(r.viste.save.byte < r.pesoSoloFootprint,
      'il documento session deve pesare meno del solo footprint: ' +
      r.viste.save.byte + ' byte contro ' + r.pesoSoloFootprint);
    // 4) Il footprint parte da solo, nel documento suo.
    assert.ok(r.viste.footprint, 'il footprint deve essere mandato al documento separato');
    assert.equal(r.viste.footprint.quantiAsset, 3, 'devono partire tutti e 3 gli asset');
    // 5) PROVA DI CONTROLLO: un byte deve essersi spostato, non sparito.
    assert.ok(r.viste.footprint.byte > 1000,
      'il documento separato deve portare le celle davvero: ' + r.viste.footprint.byte);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il footprint non si riscrive a raffica: una volta sola, poi aspetta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MONTA_FINTO_CLOUD);
    const r = await pagina.evaluate(async (celle) => {
      footprintCollectCloudAggregate = () => celle;
      let quanteVolte = 0;
      const cloudVero = window.__montaFintoCloud({
        save: async () => true,
        footprintSalva: async () => { quanteVolte++; return true; },
      });
      try {
        // Due salvateggi ravvicinati, come capita davvero (operazione chiusa e pagehide).
        await syncFullStatusToFirebase('test', true);
        await syncFullStatusToFirebase('test', true);
        await syncFullStatusToFirebase('test', true);
      } finally { window.fxbtCloud = cloudVero; }
      return {quanteVolte};
    }, celleFootprint());

    // Il freno: tre salvataggi ravvicinati devono produrre UNA sola scrittura del footprint.
    // Senza, il "documento separato" sarebbe costato come prima - o peggio.
    assert.equal(r.quanteVolte, 1,
      'tre salvataggi ravvicinati devono scrivere il footprint una volta sola, non ' + r.quanteVolte);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: senza footprint da salvare, non si chiama niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(MONTA_FINTO_CLOUD);
    const r = await pagina.evaluate(async () => {
      // Nessun raccolto: footprintCollectCloudAggregate() restituisce vuoto, come quando non si
      // e' guardato nessun grafico con il footprint acceso.
      footprintCollectCloudAggregate = () => ({});
      let quanteVolte = 0;
      const cloudVero = window.__montaFintoCloud({
        save: async () => true,
        footprintSalva: async () => { quanteVolte++; return true; },
      });
      try { await syncFullStatusToFirebase('test', true); }
      finally { window.fxbtCloud = cloudVero; }
      return {quanteVolte};
    });

    // Controprova che conta: se non c'e' niente da salvare, non si scrive. Un documento vuoto
    // scritto lo stesso sarebbe una scrittura pagata per niente - esattamente il difetto.
    assert.equal(r.quanteVolte, 0,
      'senza celle footprint non si deve scrivere niente, invece ' + r.quanteVolte);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
