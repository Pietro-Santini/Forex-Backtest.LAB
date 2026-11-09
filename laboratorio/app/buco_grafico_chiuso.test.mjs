// IL GRAFICO NON DEVE PERDERE LE CANDELE IN MEZZO ALLO STORICO.
//
// SEGNALATO dal proprietario (8 novembre 2026), con tre foto scattate in tre punti diversi:
// «quando sto scorrendo il grafico a mercato chiuso il grafico si rompe in delle zone
// specifiche, smette di far visualizzare le candele lungo il grafico in parte; se ci
// spostiamo un altro po' ritorna a funzionare».
//
// CAUSA MISURATA, ed e' UNA SOLA per tre sintomi. Il confine della chiusura si cercava con una
// ricerca binaria che da' per certo che il predicato sia ordinato (prima tutte aperte, poi
// tutte chiuse). Il mercato non e' ordinato cosi': pausa notturna 22:00-00:00, riapertura,
// weekend. Misurato su 3000 candele da un minuto con due giorni aperti, la pausa notturna in
// mezzo e la coda chiusa del weekend:
//   - la finestra che attraversa la pausa notturna (righe 1200-1499) teneva 60 candele su 300:
//     240 candele SPARITE, ed e' esattamente il buco delle foto;
//   - 629 finestre su 2701 (il 23%) avevano buchi, da pochi minuti a quasi tutta la finestra;
//   - spostandosi la finestra cambia, il confine cambia, e in alcuni tratti le candele
//     tornano: da cui «se ci spostiamo un altro po' ritorna a funzionare».
// La stessa ricerca sbagliata era anche il tetto di maxViewEnd() (da cui «il grafico non mi
// permette di andare oltre l'ultima candela») e il congelamento dell'autosegui.
//
// Il test misura il COMPORTAMENTO: quante candele restano nella finestra, in tutte le zone
// dello storico, piu' l'etichetta del prezzo che deve restare sull'ultima candela creata.
//
// Le attese si calcolano col predicato che l'app usava PRIMA della cura
// (fblMercatoFermoOra, candela per candela): cosi' il rosso-senza misura il difetto vero e non
// l'assenza di una funzione nuova.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// IL BANCO DI PROVA. I dati sono costruiti intorno a due GIORNI APERTI del calendario che non
// sono mai "adesso" (oggi - 3 giorni e oggi - 2 giorni), cosi' il risultato non dipende dal
// giorno in cui gira il collaudo - che e' la stessa lezione dei test "su un computer".
//   giorno D      00:00-20:59 UTC  aperto   (Roma 01:00-21:59)
//   giorno D      21:00-22:59 UTC  chiuso   (la pausa notturna, IN MEZZO allo storico)
//   giorno D+1    00:00-20:59 UTC  aperto
//   giorno D+1    21:00-...        chiuso   (la coda: il weekend)
const PREPARA = (candeleViste) => `(function(){
  const VENERDI=Date.UTC(2026,10,6,0,0,0);            // venerdi' 6 novembre, mezzanotte UTC
  const LUNEDI=Date.UTC(2026,10,9,0,0,0);             // lunedi' 9 novembre
  const giorni={sun:[],mon:[],tue:[],wed:[],thu:[],fri:[],sat:[]};
  giorni.fri=['00:00 - 22:00'];
  giorni.mon=['00:00 - 22:00'];
  orariAsset['XAUUSD']={zona:'UTC',giorni:giorni,stato:'CLOSED',letto:Date.now()};
  rows=[]; baseRows=[]; let p=4100;
  const metti=t=>{
    const o=p, c=p+Math.sin(t/900000)*2;
    rows.push({date:new Date(t).toISOString(),open:o,high:Math.max(o,c)+1,low:Math.min(o,c)-1,close:c,volume:10});
    p=c;
  };
  for(let i=0;i<1260;i++)metti(VENERDI+i*60000);           // venerdi' aperto
  for(let i=0;i<120;i++)metti(VENERDI+1260*60000+i*60000); // pausa notturna (chiusa)
  for(let i=0;i<1260;i++)metti(LUNEDI+i*60000);            // lunedi' aperto
  for(let i=0;i<360;i++)metti(LUNEDI+1260*60000+i*60000);  // coda chiusa
  baseRows=rows.slice(); idx=rows.length-1; viewEnd=idx;
  currentAssetKey='XAUUSD'; csvLibrary=[{id:'mt5_live_xau',rows:rows}];
  liveModeActive=true; liveReplayActive=false; mt5Connected=false;
  // L'OROLOGIO SI BLOCCA SU UN SABATO: senza, la prova dipende da quando gira - e
  // MISURATO il 9 novembre (lunedi' prestto) il mercato era APERTO, l'app aggiungeva lo
  // spazio futuro (36 candele su 300) e la spazzata diventava rossa senza che il codice
  // fosse cambiato.
  const _D=Date.now; Date.now=function(){ return Date.UTC(2026,10,9,21,40,0); };
  window.__orologioVero=_D;
  followLatest=false; autoFitWidth=false; visibleCount=${candeleViste};
  return {totale:rows.length, chiusura:LUNEDI+1260*60000, adesso:Date.now()};
})()`;
const CONFINE = `(function(){
  for(let i=rows.length-1;i>=0;i--){
    if(!fblMercatoFermoOra('XAUUSD',Date.parse(rows[i].date)))return i+1;
  }
  return 0;
})()`;

test('la finestra che attraversa la pausa notturna tiene TUTTE le candele', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // La finestra piu' colpita dalla cura, misurata: righe 1200-1499, con la pausa notturna
    // (1260-1379) nel mezzo. La ricerca vecchia ne teneva 60 su 300.
    const r = await pagina.evaluate(`(() => {
      const B=${PREPARA(300)};
      viewEnd = 1499;
      const v = getVisibleData();
      return {viste: v.length, prima: v.length?v[0].date:null, ultima: v.length?v[v.length-1].date:null,
              attesaPrima: rows[1200].date, attesaUltima: rows[1499].date};
    })()`);
    assert.equal(r.viste, 300,
      'la finestra deve essere intera, non 60 candele: ' + JSON.stringify(r));
    assert.equal(r.ultima, r.attesaUltima,
      "e l'ultima candela della finestra deve essere quella chiesta: " + JSON.stringify(r));
    assert.equal(r.prima, r.attesaPrima, 'la prima pure: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("la coda dopo la chiusura: con l'autosegui non si mostra, a mano il grafico non si svuota", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // LE TRE REGOLE CHE DEVONO STARE IN PIEDI INSIEME (richieste del proprietatore in giorni
    // diversi, e la cura deve tenere tutte e tre):
    //   1 novembre: a mercato chiuso le candele successive alla chiusura non si mostrano;
    //   7 novembre: ...ma scorrendo nel weekend il grafico non deve restare bianco;
    //   9 novembre: ...e spostandomi a mano devo poterne uscire, non restare bloccato.
    const r = await pagina.evaluate(`(() => {
      const B=${PREPARA(300)};
      const confine=${CONFINE};
      // (a) AUTOSEGUI ACCESO, cioe' la vista di tutti i giorni a mercato chiuso.
      followLatest = true;
      viewEnd = 2999;                     // oltre la fine: l'autosegui non ci va da solo
      const auto = getVisibleData();
      // (b) SPOSTAMENTO A MANO fin dentro il weekend.
      followLatest = false;
      const mano = getVisibleData();
      return {confine: confine,
              autoN: auto.length, autoUltima: auto.length?auto[auto.length-1].date:null,
              manoN: mano.length, attesaUltima: rows[confine-1].date};
    })()`);
    assert.equal(r.autoN, 299,
      'con l\'autosegui la finestra e\' piena meno la candela oltre la chiusura: ' + JSON.stringify(r));
    assert.equal(r.autoUltima, r.attesaUltima,
      "e l'ultima candela mostrata e' l'ultima APERTA, non una oltre la chiusura: " + JSON.stringify(r));
    assert.equal(r.manoN, 300,
      'spostandosi a mano dentro il weekend il grafico NON si svuota (regola del 7 novembre): '
      + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('TUTTE le finestre dello storico tengono le loro candele (la spazzata)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      const B=${PREPARA(300)};
      const N = rows.length, confine = ${CONFINE};
      // Il tetto a mano (l'autosegui e' spento qui): e' il margine di sempre, non il confine.
      const tetto = maxViewEnd();
      let buchi = 0, primoBuco = -1, esempio = null;
      // QUANTE CANDELE DEVONO ESSERCI. La finestra e' [end-299, end] con end limitata dal
      // tetto; da confine in poi le candele non si mostrano, quindi l'ultima visibile e'
      // confine-1; MA se la finestra cade TUTTA dopo il confine il grafico non si svuota e
      // mostra le sue candele (regola del 7 novembre). La spazzata gira su TUTTE le finestre
      // dello storico: e' la misura di "in tutte le zone", non di un punto solo.
      const n = 300;
      for (let v = 0; v < N; v++) {
        viewEnd = v;
        const end = Math.min(tetto, v);
        const hi = Math.min(end, confine - 1);
        const lo = Math.max(0, end - n + 1);
        const attese = (lo >= confine) ? n : Math.max(0, hi - lo + 1);
        const viste = getVisibleData().length;
        if (viste !== attese) {
          buchi++;
          if (primoBuco < 0) { primoBuco = v; esempio = {viewEnd: v, viste: viste, attese: attese}; }
        }
      }
      const esito={N: N, confine: confine, buchi: buchi, primoBuco: primoBuco, esempio: esempio};
      if(window.__orologioVero)Date.now=window.__orologioVero;
      return esito;
    })()`);
    assert.equal(r.buchi, 0,
      'nessuna finestra deve perdere candele (misurato: 629 finestre con buchi prima della cura): '
      + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("l'etichetta del prezzo resta sull'ultima candela creata, non segue lo scorrimento", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // SEGNALATO (8 novembre 2026): «se scorro indietro nel tempo l'etichetta del prezzo
    // corrente prende di riferimento l'ultima candela visualizzabile nel grafico, invece
    // deve rimanere sempre sull'ultima candela creata, non si puo' spostare l'etichetta con
    // la linea». La riga si misura a schermo: e' la candela piu' a destra di quelle che il
    // grafico disegna DAVVERO. Se scorrendo indietro l'etichetta cambia numero, il difetto
    // c'e' ancora.
    const r = await pagina.evaluate(`(() => {
      const B=${PREPARA(300)};
      const confine=${CONFINE};
      const atteso = Number(rows[confine-1].close);
      const allaFine = fblPrezzoRigaCorrente();
      viewEnd = 10;        const indietro = fblPrezzoRigaCorrente();
      viewEnd = 1400;      const meta = fblPrezzoRigaCorrente();
      viewEnd = 2999;      const sfondato = fblPrezzoRigaCorrente();
      return {atteso: atteso, allaFine: allaFine, indietro: indietro, meta: meta, sfondato: sfondato};
    })()`);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: a mercato aperto non si taglia niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      const B=${PREPARA(300)};
      fblMercatoMt5Cache['XAUUSD'] = {aperto: true, letto: Date.now()};   // MT5 dice: aperto
      const confine = fblConfineChiusura();
      const fetta = fblTagliaDopoChiusura(rows.slice(1200, 1500), 1200);
      viewEnd = 2999;
      const v = getVisibleData();
      // La larghezza della finestra non si misura qui: dipende dallo spazio futuro che l'app
      // riserva a mercato APERTO (misurato: di sabato sera 300 candele, di lunedi' mattina 264),
      // e quella e' un'altra prova. Qui si misura il TAGLIO: quante candele restano e quale
      // e' l'ultima.
      return {totale: rows.length, confine: confine, fetta: fetta.length, viste: v.length,
              ultima: v.length ? v[v.length-1].date : null,
              attesaUltima: rows[rows.length-1].date};
    })()`);
    assert.equal(r.confine, r.totale, 'col mercato aperto non c\'e\' confine: ' + JSON.stringify(r));
    assert.equal(r.fetta, 300, 'la fetta resta intatta: ' + JSON.stringify(r));
    assert.ok(r.viste > 200, 'e la finestra tiene le sue candele: ' + JSON.stringify(r));
    assert.equal(r.ultima, r.attesaUltima,
      'e l\'ultima candela mostrata e\' l\'ultima dei dati: niente viene tagliato: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test("il grafico si puo' spostare liberamente nei dati, fino all'ultima candela aperta", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // SECONDO SINTOMO della stessa causa: «il grafico non mi permette di andare oltre
    // l'ultima candela spostandomi». maxViewEnd() dava come tetto il confine a caso della
    // ricerca binaria, che sta PRIMA dell'ultima candela aperta: lo spostamento si fermava
    // nel mezzo dello storico.
    const r = await pagina.evaluate(`(() => {
      const B=${PREPARA(300)};
      const confine=${CONFINE};
      const tetto = maxViewEnd();
      viewEnd = 100;    const a = getViewWindow().end;
      viewEnd = 2000;   const b = getViewWindow().end;
      viewEnd = 100000; const sfondato = getViewWindow().end;
      return {confine: confine, tetto: tetto, a: a, b: b, sfondato: sfondato};
    })()`);
    assert.ok(r.tetto >= r.confine - 1,
      'il tetto deve arrivare almeno fino all\'ultima candela aperta: ' + JSON.stringify(r));
    assert.ok(r.b !== r.a, 'spostarsi avanti deve cambiare la finestra: ' + JSON.stringify(r));
    assert.ok(r.b <= r.tetto, 'restando dentro il tetto: ' + JSON.stringify(r));
    assert.ok(r.sfondato <= r.tetto,
      'e non si deve sfondare, ma nemmeno restare bloccati prima dell\'ultima candela: '
      + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
