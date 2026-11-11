// IL TETTO DEL CLOUD E LA RILETTURA DEL GRAFICO: LA BOLLETTA SI FERMA DAVVERO?
//
// Segnalato dal proprietario (10 novembre 2026): «attenzione sono aumentate le scritture e le
// letture». Console Firebase: 67,5% delle scritture e 56,7% delle letture giornaliere.
//
// MISURATO dal banco (misura_cloud.py): il pannello dell'app contava 102 scritture e 86 letture
// in 24 ore, la console 14.000 e 28.000. Due cause:
//  1. il tetto giornaliero viveva SOLO in memoria: ogni riapertura della pagina ripartiva da
//     zero, quindi non proteggeva il progetto ma una singola finestra;
//  2. la rilettura del grafico gira ogni 60 secondi per dispositivo, e allentava solo con
//     `liveModeActive && mercato chiuso`: fuori dal Live non allentava MAI.
//
// Questi testi misurano il comportamento, non il testo del codice: il conto del giorno si
// rilegge da localStorage, e due riletture consecutive fuori dal Live non passano entrambe.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// FIREBASE FINTE, MA IL CODICE E' QUELLO VERO.
//
// Il modulo cloud importa Firebase da un CDN e il banco blocca la rete: senza questo stub il
// modulo non partiva affatto, `window.fxbtCloud` non esisteva, e la misura non poteva toccare
// il tetto. Lo stub risponde a tutte le import usate dal modulo; le funzioni che scrivono o
// leggono davvero non vengono mai chiamate da questi test.
const FIREBASE_FINTO = `
export const initializeApp = () => ({name:'banco'});
export const getAuth = () => ({});
export const onAuthStateChanged = () => () => {};
export const onIdTokenChanged = () => () => {};
export const signOut = async () => {};
export const getFirestore = () => ({});
export const doc = (...a) => ({__doc:a});
export const getDoc = async () => ({exists:()=>false, data:()=>({})});
export const setDoc = async () => {};
export const onSnapshot = () => () => {};
export const serverTimestamp = () => null;
export const arrayUnion = (...x) => x;
export const getFunctions = () => ({});
export const httpsCallable = () => async () => ({data:{}});
`;
async function firebaseFinto(pagina){
  await pagina.route('**/firebasejs/**', r => r.fulfill({status:200,
    contentType:'text/javascript', body:FIREBASE_FINTO}));
}

test('il tetto giornaliero del cloud sopravvive alla riapertura della pagina', async () => {
  const {browser, pagina, errori} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    // `window.fxbtCloud` (non `fxbtCloud`): il modulo cloud si registra sul globale e in
    // questo contesto il nome nudo non e' garantito come binding.
    const r = await pagina.evaluate(`(function(){
      const cloud=window.fxbtCloud;
      if(!cloud) return {manca:true};
      const g=new Date().toISOString().slice(0,10);
      // Il conto che una pagina precedente aveva gia' consumato oggi.
      localStorage.setItem('fbl_cloud_budget_giorno',
        JSON.stringify({giorno:g, conta:{grafico:3000}, totale:3000, avvisato:true}));
      // La "riapertura": lo stato in memoria riparte vuoto, come in una pagina nuova.
      cloud._budget={giorno:null, conta:{}, totale:0, avvisato:false};
      const stato=cloud.budgetStato();
      const puoScrivere=cloud._puoScrivere('prova');
      // E il consumo di oggi si salva: 2999 + questa scrittura = 3000 sul disco.
      cloud._budget={giorno:null, conta:{}, totale:0, avvisato:false};
      localStorage.setItem('fbl_cloud_budget_giorno',
        JSON.stringify({giorno:g, conta:{}, totale:2999, avvisato:false}));
      const passa=cloud._puoScrivere('prova');
      let salvato=null;
      try{ salvato=JSON.parse(localStorage.getItem('fbl_cloud_budget_giorno')||'null'); }catch(e){}
      return {stato, puoScrivere, passa, salvatoTotale: salvato?salvato.totale:null};
    })()`);
    assert.ok(!r.manca, 'il modulo cloud (window.fxbtCloud) deve essere caricato');
    console.log('AVVISO tetto dopo riapertura =', JSON.stringify(r.stato),
                '| si puo scrivere =', r.puoScrivere,
                '| salvato dopo una scrittura =', r.salvatoTotale);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.stato.totale, 3000,
      'il conto delle scritture di oggi deve essere riletto da localStorage, non ripartire da zero');
    assert.equal(r.stato.tetto, 3000, 'il tetto e\' quello configurato');
    assert.equal(r.puoScrivere, false,
      'a tetto raggiunto non si scrive sul cloud (si salva solo in locale)');
    assert.equal(r.passa, true, 'sotto il tetto si scrive');
    assert.equal(r.salvatoTotale, 3000,
      'ogni scrittura consumata deve essere salvata su disco, altrimenti la riapertura la perde');
  } finally { await browser.close(); }
});

test('fuori dal Live la rilettura del grafico e\' allentata a cinque minuti', async () => {
  const {browser, pagina, errori} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const r = await pagina.evaluate(`(function(){
      liveModeActive=false;             // backtest/replay: il caso che non allentava mai
      __graficoUltimaRilettura=0;       // pagina appena aperta
      const prima=fblGraficoRiletturaConsentita(false);
      const subito=fblGraficoRiletturaConsentita(false);
      const forzata=fblGraficoRiletturaConsentita(true);
      const dopoForzata=fblGraficoRiletturaConsentita(false);
      return {prima, subito, forzata, dopoForzata};
    })()`);
    console.log('AVVISO rilettura fuori dal Live =', JSON.stringify(r));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.prima, true, 'la prima rilettura di una pagina appena aperta deve passare');
    assert.equal(r.subito, false,
      'fuori dal Live non si rilegge il grafico ogni minuto: la seconda rilettura deve aspettare');
    assert.equal(r.forzata, true,
      'una richiesta esplicita (si torna sull\'app, si tocca un disegno) deve passare sempre');
    assert.equal(r.dopoForzata, false,
      'anche dopo una forzata, la rilettura automatica resta allentata');
  } finally { await browser.close(); }
});
