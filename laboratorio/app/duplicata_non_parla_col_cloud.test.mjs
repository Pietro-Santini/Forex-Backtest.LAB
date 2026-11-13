// UNA FINESTRA DUPLICATA NON PARLA CON IL CLOUD: ASCOLTA LA MADRE (13 novembre 2026).
//
// Paletto del progetto «duplicate come specchio», chiesto dal proprietario: «mi raccomando
// attento al peso sul PC e al peso dei dati che girano su Firebase».
//
// MISURATO prima della cura, aprendo l'app con un Firebase finto che conta invece di parlare:
//   madre     -> 3 ascolti permanenti
//   duplicata -> 2 ascolti permanenti, tutti suoi
// E un ascolto non e' gratis: ogni volta che un altro dispositivo scrive quel documento, ognuno
// di quegli ascolti produce UNA lettura. Con la madre piu' due duplicate, una modifica fatta dal
// telefono si moltiplica per tre.
//
// Dopo la cura la duplicata ne apre ZERO: ascolta la madre sul canale fra finestre, che non
// costa niente. Queste prove misurano le due meta' della cosa - che non ascolti, e che riceva
// lo stesso quello che la madre ha ricevuto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Firebase non si scarica in un banco: si serve un modulo finto con gli stessi nomi, che CONTA.
// Senza, il modulo del cloud non parte e si misurerebbe zero per il motivo sbagliato.
const FIREBASE_CONTATORE = `
globalThis.__fbConta = globalThis.__fbConta || {ascolti:0, scritture:0, documenti:[]};
export const initializeApp = () => ({name:'banco'});
export const getAuth = () => ({});
export const onAuthStateChanged = (a,cb) => { try{ cb({uid:'banco-uid', email:'x@y.z'}); }catch(e){} return () => {}; };
export const onIdTokenChanged = () => () => {};
export const signOut = async () => {};
export const getFirestore = () => ({});
export const doc = (...a) => ({__doc:a.slice(1).join('/')});
export const getDoc = async () => ({exists:()=>false, data:()=>({})});
export const setDoc = async (r) => { globalThis.__fbConta.scritture++; };
export const onSnapshot = (r,cb) => { globalThis.__fbConta.ascolti++; globalThis.__fbConta.documenti.push(r&&r.__doc); return () => {}; };
export const serverTimestamp = () => null;
export const arrayUnion = (...x) => x;
export const getFunctions = () => ({});
export const httpsCallable = () => async () => ({data:{}});
`;
const conFirebaseFinto = async (p) => {
  await p.route('**/firebasejs/**', r => r.fulfill({
    status: 200, contentType: 'text/javascript', body: FIREBASE_CONTATORE}));
};

test('la MADRE ascolta il cloud; una DUPLICATA non apre nemmeno un ascolto', async () => {
  const madre = await apriApp({primaDiNavigare: conFirebaseFinto});
  let a, b;
  try {
    await madre.pagina.waitForTimeout(3500);
    a = await madre.pagina.evaluate(() => ({
      slot: PIP_SLOT,
      ascolti: (globalThis.__fbConta || {}).ascolti || 0,
      documenti: ((globalThis.__fbConta || {}).documenti || []).slice()
    }));
  } finally { await madre.browser.close(); }

  const figlia = await apriApp({query: '?pipSlot=2', primaDiNavigare: conFirebaseFinto});
  try {
    await figlia.pagina.waitForTimeout(3500);
    b = await figlia.pagina.evaluate(() => ({
      slot: PIP_SLOT,
      ascolti: (globalThis.__fbConta || {}).ascolti || 0
    }));
  } finally { await figlia.browser.close(); }

  console.log('madre:', JSON.stringify(a), '\nduplicata:', JSON.stringify(b));
  assert.equal(a.slot, 0, 'la prima pagina e la madre');
  assert.ok(a.ascolti >= 1,
    'la madre deve ascoltare il cloud per tutte: se non ascolta nessuno, nessuno riceve piu ' +
    'niente e questa prova non misura la cura ma un guasto: ' + JSON.stringify(a));
  assert.equal(b.slot, 2, 'la seconda pagina e una duplicata');
  assert.equal(b.ascolti, 0,
    'una duplicata NON deve aprire ascolti verso il cloud: ne apriva 2, e ognuno produce una ' +
    'lettura ogni volta che un altro dispositivo scrive quel documento. Trovati: ' + b.ascolti);
});

test('e una duplicata non scrive sul cloud', async () => {
  const {browser, pagina} = await apriApp({query: '?pipSlot=2', primaDiNavigare: conFirebaseFinto});
  try {
    await pagina.waitForTimeout(2500);
    const r = await pagina.evaluate(() => {
      const c = window.fxbtCloud;
      if (!c || typeof c._puoScrivere !== 'function') return {assente: true};
      return {assente: false, slot: PIP_SLOT, puo: c._puoScrivere('session'),
              puoPreferenze: c._puoScrivere('preferenze')};
    });
    console.log('scrittura da una duplicata:', JSON.stringify(r));
    assert.ok(!r.assente, 'il modulo cloud deve essere caricato: senza, questa prova non misura niente');
    assert.equal(r.puo, false,
      'due finestre che scrivono lo stesso documento non raddoppiano solo la bolletta: si ' +
      'sovrascrivono a vicenda, e l ultima che parla vince senza che nessuno lo decida');
    assert.equal(r.puoPreferenze, false, 'vale per qualunque documento');
  } finally { await browser.close(); }
});

test('quello che la madre riceve arriva alla duplicata, e con la stessa funzione', async () => {
  // La seconda meta' della cura, e senza questa la prima sarebbe un danno: se una duplicata
  // smette di ascoltare e nessuno le gira niente, resta al buio.
  const {browser, pagina} = await apriApp({query: '?pipSlot=2', primaDiNavigare: conFirebaseFinto});
  try {
    const r = await pagina.evaluate(() => {
      const arrivati = [];
      // Si registra come farebbe il modulo cloud dentro una duplicata.
      const stacca = fblAscoltaDocDallaMadre('preferenze', (contenuto) => { arrivati.push(contenuto); });
      // La madre annuncia il documento sul canale: qui si consegna il messaggio a mano, che e
      // quello che fa il canale fra finestre.
      const prima = arrivati.length;
      tradingChannel.onmessage({data: {type: 'cloud_doc', slot: 0, nome: 'preferenze',
                                       contenuto: {tema: 'scuro', v: 7}}});
      const dopo = arrivati.slice();
      // Un documento per cui NON si e registrato nessuno non deve fare niente.
      tradingChannel.onmessage({data: {type: 'cloud_doc', slot: 0, nome: 'grafico',
                                       contenuto: {qualcosa: true}}});
      // E staccandosi non si riceve piu nulla.
      stacca();
      tradingChannel.onmessage({data: {type: 'cloud_doc', slot: 0, nome: 'preferenze',
                                       contenuto: {tema: 'chiaro'}}});
      return {prima, dopo, dopoStacco: arrivati.length};
    });
    console.log('giro del documento:', JSON.stringify(r));
    assert.equal(r.prima, 0, 'si parte senza niente');
    assert.deepEqual(r.dopo, [{tema: 'scuro', v: 7}],
      'il documento della madre deve arrivare alla duplicata intatto: ' + JSON.stringify(r));
    assert.equal(r.dopoStacco, 1,
      'staccato l ascolto non deve arrivare piu niente: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('una duplicata appena nata CHIEDE alla madre com e fatto adesso', async () => {
  // Senza questo, una finestra aperta ora resterebbe al buio fino alla prossima modifica fatta
  // da qualcun altro - che puo' voler dire per ore.
  const {browser, pagina} = await apriApp({query: '?pipSlot=2', primaDiNavigare: conFirebaseFinto});
  try {
    const r = await pagina.evaluate(() => {
      const mandati = [];
      const vero = tradingChannel.postMessage.bind(tradingChannel);
      tradingChannel.postMessage = function (m) { mandati.push(m); return vero(m); };
      fblAscoltaDocDallaMadre('collegamento', () => {});
      tradingChannel.postMessage = vero;
      return {mandati: mandati.map(m => ({type: m.type, nome: m.nome}))};
    });
    console.log('richiesta alla madre:', JSON.stringify(r));
    assert.deepEqual(r.mandati, [{type: 'cloud_doc_chiedi', nome: 'collegamento'}],
      'registrandosi, una duplicata deve chiedere subito il contenuto attuale: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: la madre risponde solo di cio che ha gia visto, e non applica a se stessa', async () => {
  const {browser, pagina} = await apriApp({primaDiNavigare: conFirebaseFinto});
  try {
    const r = await pagina.evaluate(() => {
      const mandati = [];
      const vero = tradingChannel.postMessage.bind(tradingChannel);
      tradingChannel.postMessage = function (m) { mandati.push(m); return vero(m); };
      // Un documento mai visto: non si inventa una risposta.
      const senzaAverVisto = fblRispondiDocCloud('mai-visto');
      // Adesso la madre riceve davvero un documento dal cloud e lo annuncia.
      fblAnnunciaDocCloud('preferenze', {tema: 'scuro'});
      const dopoAverVisto = fblRispondiDocCloud('preferenze');
      // E il messaggio che ha mandato lei non deve tornarle addosso: nella madre non c e
      // nessuna callback registrata.
      const applicati = fblApplicaDocCloudDaMadre('preferenze', {tema: 'chiaro'});
      tradingChannel.postMessage = vero;
      return {senzaAverVisto, dopoAverVisto, applicati,
              tipi: mandati.map(m => m.type)};
    });
    console.log('madre:', JSON.stringify(r));
    assert.equal(r.senzaAverVisto, false, 'di un documento mai visto non si inventa il contenuto');
    assert.equal(r.dopoAverVisto, true, 'di uno gia visto si risponde, senza leggere dal cloud');
    assert.equal(r.applicati, 0,
      'nella madre non c e nessuna callback registrata: il suo stesso annuncio non le torna addosso');
  } finally { await browser.close(); }
});
