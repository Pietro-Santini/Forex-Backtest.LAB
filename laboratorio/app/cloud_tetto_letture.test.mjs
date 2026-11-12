// LE LETTURE DAL CLOUD HANNO UN TETTO, COME LE SCRITTURE (12 novembre 2026).
//
// MISURATO sulla console Firebase del proprietario, 12 novembre:
//     scritture 22.000 su 20.000 al giorno   -> QUOTA SUPERATA, si paga
//     letture   44.000 su 50.000 al giorno   -> 88%, la prossima a sfondare
//
// Il tetto delle scritture esisteva da giorni e sopravvive alle riaperture. Le LETTURE no:
// non passavano da nessun controllo. E non si fanno solo chiedendo: i quattro ascolti permanenti
// (session, grafico, collegamento, preferenze) generano una lettura a testa OGNI VOLTA che un
// altro dispositivo scrive quel documento. Con tre dispositivi accesi una scrittura ne produce
// due, per ognuno dei quattro documenti: e' il moltiplicatore che il pannello dell'app non
// vedeva, perche' conta le proprie chiamate e non gli arrivi.
//
// Queste prove misurano il COMPORTAMENTO: che il conto salga, che il tetto fermi, che
// sopravviva alla riapertura della pagina e che le letture non rubino il tetto alle scritture.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Firebase non si scarica in un banco (nessuna rete): si serve un modulo finto con gli stessi
// nomi, cosi' il modulo del cloud dell'app PARTE DAVVERO e si misurano i suoi contatori veri.
// Senza questo, `window.fxbtCloud` non esiste e le prove si saltano in silenzio: un banco che
// non misura da' una sicurezza falsa, che e' peggio di un banco rosso.
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


test('il conto delle letture sale, e il tetto ferma quando e\' pieno', async () => {
  const {browser, pagina} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const r = await pagina.evaluate(() => {
      const c = window.fxbtCloud;
      if (!c || typeof c._puoLeggere !== 'function') return {assente: true};
      // tetto basso apposta, per misurare senza fare cinquemila giri
      localStorage.setItem('fbl_cloud_tetto_letture', '5');
      c._budget = {giorno: null, conta: {}, totale: 0, avvisato: false};
      const esiti = [];
      for (let i = 0; i < 8; i++) esiti.push(c._puoLeggere('session'));
      const stato = c.budgetLetture();
      return {assente: false, esiti, letture: stato.letture, tetto: stato.tetto,
              dettaglio: stato.dettaglio};
    });
    assert.ok(!r.assente, 'il modulo cloud deve essere caricato: senza, questa prova non misura niente');
    console.log('letture:', JSON.stringify(r));
    assert.equal(r.tetto, 5, 'il tetto deve potersi abbassare per la misura');
    assert.deepEqual(r.esiti.slice(0, 5), [true, true, true, true, true],
      'le prime cinque letture devono passare');
    assert.deepEqual(r.esiti.slice(5), [false, false, false],
      'oltre il tetto le letture non devono piu\' passare: ' + JSON.stringify(r.esiti));
    assert.equal(r.dettaglio.session, 5, 'il conto per documento serve a sapere CHI consuma');
  } finally { await browser.close(); }
});

test('il tetto delle letture sopravvive alla riapertura della pagina', async () => {
  // E' la stessa trappola gia' pagata per le scritture: un tetto che vive solo in memoria
  // protegge una finestra, non il progetto, perche' in una WebView le ricariche sono frequenti.
  const {browser, pagina} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    await pagina.evaluate(() => {
      const c = window.fxbtCloud;
      if (!c || typeof c._puoLeggere !== 'function') return;
      localStorage.setItem('fbl_cloud_tetto_letture', '5');
      c._budget = {giorno: null, conta: {}, totale: 0, avvisato: false};
      for (let i = 0; i < 4; i++) c._puoLeggere('grafico');
    });
    await pagina.reload({waitUntil: 'domcontentloaded'});
    await pagina.waitForTimeout(1200);
    const r = await pagina.evaluate(() => {
      const c = window.fxbtCloud;
      if (!c || typeof c._puoLeggere !== 'function') return {assente: true};
      const primaDiTutto = c.budgetLetture();
      const ancora = [c._puoLeggere('grafico'), c._puoLeggere('grafico')];
      return {assente: false, riprese: primaDiTutto.letture, ancora};
    });
    assert.ok(!r.assente, 'il modulo cloud deve essere caricato: senza, questa prova non misura niente');
    console.log('dopo la riapertura:', JSON.stringify(r));
    assert.equal(r.riprese, 4,
      'riaprendo la pagina il conto del giorno deve essere ripreso, non azzerato: ' + r.riprese);
    assert.deepEqual(r.ancora, [true, false],
      'la quinta lettura passa, la sesta no: il tetto e\' quello del giorno, non della finestra');
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: le letture non consumano il tetto delle scritture', async () => {
  // I due tetti sono separati apposta: le quote di Firebase sono separate (20.000 scritture,
  // 50.000 letture), e un solo contatore farebbe fermare le scritture per colpa delle letture
  // o viceversa - cioe' smetterebbe di salvare i dati del proprietario per un motivo sbagliato.
  const {browser, pagina} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const r = await pagina.evaluate(() => {
      const c = window.fxbtCloud;
      if (!c || typeof c._puoLeggere !== 'function') return {assente: true};
      localStorage.setItem('fbl_cloud_tetto_letture', '3');
      localStorage.setItem('fbl_cloud_tetto_giorno', '3');
      c._budget = {giorno: null, conta: {}, totale: 0, avvisato: false};
      for (let i = 0; i < 5; i++) c._puoLeggere('session');     // sfondo le letture
      const scritturaDopo = c._puoScrivere('session');          // la scrittura deve passare lo stesso
      return {assente: false, scritturaDopo,
              letture: c.budgetLetture().letture, scritture: c.budgetStato().totale};
    });
    assert.ok(!r.assente, 'il modulo cloud deve essere caricato: senza, questa prova non misura niente');
    console.log('tetti separati:', JSON.stringify(r));
    assert.equal(r.scritturaDopo, true,
      'il tetto delle letture non deve bloccare le scritture: sono quote diverse');
    assert.equal(r.scritture, 1, 'e la scrittura deve essere contata una volta sola');
  } finally { await browser.close(); }
});
