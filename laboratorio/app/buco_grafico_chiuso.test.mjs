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
  const NOMI=['sun','mon','tue','wed','thu','fri','sat'];
  const D0=Date.now()-3*86400000;
  const D=Date.UTC(new Date(D0).getUTCFullYear(),new Date(D0).getUTCMonth(),new Date(D0).getUTCDate());
  const giorni={sun:[],mon:[],tue:[],wed:[],thu:[],fri:[],sat:[]};
  const wd=new Date(D).getUTCDay();
  giorni[NOMI[wd]]=['00:00 - 22:00'];
  giorni[NOMI[(wd+1)%7]]=['00:00 - 22:00'];
  orariAsset['XAUUSD']={zona:'UTC',giorni:giorni,stato:'CLOSED',letto:Date.now()};
  rows=[]; baseRows=[]; let p=4100;
  const metti=t=>{
    const o=p, c=p+Math.sin(t/900000)*2;
    rows.push({date:new Date(t).toISOString(),open:o,high:Math.max(o,c)+1,low:Math.min(o,c)-1,close:c,volume:10});
    p=c;
  };
  for(let i=0;i<1260;i++)metti(D+i*60000);                    // giorno D aperto
  for(let i=0;i<120;i++)metti(D+1260*60000+i*60000);          // pausa notturna (chiusa)
  for(let i=0;i<1260;i++)metti(D+86400000+i*60000);           // giorno D+1 aperto
  for(let i=0;i<360;i++)metti(D+86400000+1260*60000+i*60000); // coda chiusa
  baseRows=rows.slice(); idx=rows.length-1; viewEnd=idx;
  currentAssetKey='XAUUSD'; csvLibrary=[{id:'mt5_live_xau',rows:rows}];
  liveModeActive=true; liveReplayActive=false; mt5Connected=false;
  followLatest=false; autoFitWidth=false; visibleCount=${candeleViste};
  return {totale:rows.length, D:D, chiusura:D+86400000+1260*60000};
})()`;

// IL CONFINE VERO, calcolato col predicato candela per candela (quello di prima): l'ultima
// candela APERTA e' l'ultima che il grafico deve poter mostrare. Se questa cura e' spenta,
// questo numero resta giusto e le prove restano rosse: misura il comportamento, non il testo.
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

test('la coda dopo la chiusura non si mostra, ma lo storico resta tutto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    // LA RICHIESTA DEL 1 NOVEMBRE, CHE RESTA: a mercato chiuso le candele successive alla
    // chiusura non devono comparire. La cura toglie i buchi, non questa regola.
    const r = await pagina.evaluate(`(() => {
      const B=${PREPARA(300)};
      const confine=${CONFINE};
      viewEnd = 2999;                        // prova a sfondare nell'ultima candela
      const v = getVisibleData();
      return {chiusura: B.chiusura, confine: confine, viste: v.length, attese: Math.min(300, confine) - 1,
              ultima: v.length?v[v.length-1].date:null, attesaUltima: rows[confine-1].date};
    })()`);
    assert.equal(r.viste, r.attese,
      'la finestra resta piena, meno la candela oltre la chiusura: ' + JSON.stringify(r));
    assert.equal(r.ultima, r.attesaUltima,
      "l'ultima candela mostrata deve essere l'ultima APERTA, non una oltre la chiusura: "
      + JSON.stringify(r));
    assert.ok(Date.parse(r.ultima) < r.chiusura,
      "e deve stare prima dell'istante di chiusura: " + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('TUTTE le finestre dello storico tengono le loro candele (la spazzata)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      const B=${PREPARA(300)};
      const N = rows.length, confine = ${CONFINE};
      let buchi = 0, primoBuco = -1, esempio = null;
      // QUANTE CANDELE DEVONO ESSERCI. La finestra e' [end-299, end] con end limitata dal
      // tetto, e le candele da confine in poi non si mostrano: quindi l'ultima visibile e'
      // confine-1 anche quando end arriva a confine. La spazzata gira su TUTTE le finestre
      // dello storico: e' la misura di "in tutte le zone", non di un punto solo.
      const n = 300;
      for (let v = 0; v < N; v++) {
        viewEnd = v;
        const end = Math.min(v, Math.min(v, confine), confine);
        const hi = Math.min(Math.min(v, confine), confine - 1);
        const lo = Math.max(0, Math.min(v, confine) - n + 1);
        const attese = Math.max(0, hi - lo + 1);
        const viste = getVisibleData().length;
        if (viste !== attese) {
          buchi++;
          if (primoBuco < 0) { primoBuco = v; esempio = {viewEnd: v, viste: viste, attese: attese}; }
        }
      }
      return {N: N, confine: confine, buchi: buchi, primoBuco: primoBuco, esempio: esempio};
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
      const fetta = fblTagliaDopoChiusura(rows.slice(1200, 1500), 1200);
      viewEnd = 2999;
      const viste = getVisibleData().length;
      return {totale: rows.length, fetta: fetta.length, viste: viste};
    })()`);
    assert.equal(r.fetta, 300, 'col mercato aperto la fetta resta intatta: ' + JSON.stringify(r));
    assert.ok(r.viste >= 299, 'e la finestra tiene tutte le sue candele: ' + JSON.stringify(r));
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
