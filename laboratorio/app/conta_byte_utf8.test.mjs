// 8.6.23 — LE BYTE DEL TRAFFICO CLOUD (NON I CARATTERI)
//
// Portato dal modulo pronto della migrazione (10 prove, verdi 10/10). Qui pero' si misura
// l'APP VERA: le funzioni globali si chiamano dentro pagina.evaluate e il caso integrato
// passa da cloud._conta, che e' il punto in cui il traffico viene contato davvero.
//
// MISURATO prima della cura: app.html riga 1423 fa
//   byte = (typeof dato==='string') ? dato.length : JSON.stringify(dato||{}).length
// e in tutto il file non c'e' nessun TextEncoder. «perché» pesa quindi 6 (caratteri)
// invece di 7 (byte), e «😀» 2 invece di 4. Il banco deve essere ROSSO per QUESTO,
// non perche' manca una funzione: i messaggi di errore riportano il conto vecchio.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Firebase finto: il modulo cloud importa da un CDN e il banco blocca la rete. Senza questo
// stub window.fxbtCloud non esiste e il caso integrato non puo' misurare niente.
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

// Il contatore vecchio, calcolato qui solo per dire nel messaggio perche' il banco e' rosso.
// Non e' usato per passare le prove: e' il diagnostico del difetto misurato.
function contaVecchia(s){ return typeof s === 'string' ? s.length : JSON.stringify(s == null ? {} : s).length; }

test('8.6.23: ASCII: un carattere e un byte', async () => {
  const {browser, pagina, errori} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const r = await pagina.evaluate(() => ({
      byte: typeof window.fblByteUtf8 === 'function'
        ? window.fblByteUtf8('abc', {encode: s => new TextEncoder().encode(s)}) : null,
      caratteri: 'abc'.length,
    }));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.byte, 3,
      'l\'app conta ' + contaVecchia('abc') + ' caratteri: con l\'ASCII il numero e\' uguale, ma il conteggio deve passare da TextEncoder');
    assert.equal(r.byte, r.caratteri);
  } finally { await browser.close(); }
});

test('8.6.23: italiano accentato: «perché» sono 7 byte e 6 caratteri', async () => {
  const {browser, pagina} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const q = await pagina.evaluate(() => typeof window.fblConfrontoByte === 'function'
      ? window.fblConfrontoByte('perché', {encode: s => new TextEncoder().encode(s)}) : null);
    assert.deepEqual(q, {caratteri: 6, byte: 7, differenza: 1},
      'l\'app conta ' + contaVecchia('perché') + ' caratteri invece dei 7 byte UTF-8 di «perché»: manca il confronto fra caratteri e byte');
  } finally { await browser.close(); }
});

test('8.6.23: emoji: 4 byte e 2 unità UTF-16', async () => {
  const {browser, pagina} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const q = await pagina.evaluate(() => typeof window.fblConfrontoByte === 'function'
      ? window.fblConfrontoByte('😀', {encode: s => new TextEncoder().encode(s)}) : null);
    assert.deepEqual(q, {caratteri: 2, byte: 4, differenza: 2},
      'l\'app conta ' + contaVecchia('😀') + ' unità UTF-16 invece dei 4 byte UTF-8 dell\'emoji');
  } finally { await browser.close(); }
});

test('8.6.23: un elemento fuori BMP pesa 4 byte', async () => {
  const {browser, pagina} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const byte = await pagina.evaluate(() => typeof window.fblByteUtf8 === 'function'
      ? window.fblByteUtf8('𝄞', {encode: s => new TextEncoder().encode(s)}) : null);
    assert.equal(byte, 4,
      'l\'app conta ' + contaVecchia('𝄞') + ' unità UTF-16 invece dei 4 byte UTF-8 del violino');
  } finally { await browser.close(); }
});

test('8.6.23: un oggetto viene serializzato e poi pesato in byte', async () => {
  const {browser, pagina} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const r = await pagina.evaluate(() => {
      const dato = {nome: 'perché', citta: 'Roma'};
      const json = JSON.stringify(dato);
      const encoder = {encode: s => new TextEncoder().encode(s)};
      return {
        byte: typeof window.fblContaPayloadByte === 'function' ? window.fblContaPayloadByte(dato, encoder) : null,
        atteso: encoder.encode(json).length,
        caratteri: json.length,
      };
    });
    assert.equal(r.byte, r.atteso,
      'l\'app conta ' + contaVecchia({nome: 'perché', citta: 'Roma'}) + ' caratteri del JSON invece dei ' + r.atteso + ' byte');
    assert.ok(r.byte > r.caratteri, 'con un accento dentro il JSON i byte devono superare i caratteri');
  } finally { await browser.close(); }
});

test('8.6.23: una stringa viene pesata come stringa, non riserializzata', async () => {
  const {browser, pagina} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const byte = await pagina.evaluate(() => typeof window.fblContaPayloadByte === 'function'
      ? window.fblContaPayloadByte('perché', {encode: s => new TextEncoder().encode(s)}) : null);
    assert.equal(byte, 7,
      'l\'app conta ' + contaVecchia('perché') + ' caratteri invece dei 7 byte della stringa "perché"');
  } finally { await browser.close(); }
});

// IL CASO INTEGRATO: non si chiama la funzione nuova a mano, si lascia che SIA cloud._conta
// a passare i byte a fblTrafficoSegna. Si legge l'effetto nel magazzino, come fa il pannello.
test('8.6.23: cloud._conta passa a fblTrafficoSegna i byte, non i caratteri', async () => {
  const {browser, pagina, errori} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const r = await pagina.evaluate(() => {
      const cloud = window.fxbtCloud;
      if(!cloud) return {manca: true};
      try{ localStorage.removeItem('fbl_cloud_traffico'); }catch(e){}
      cloud._conta('scrittura', 'session', 'perché');
      let t = null;
      try{ t = JSON.parse(localStorage.getItem('fbl_cloud_traffico') || 'null'); }catch(e){}
      return {
        byte: t && t.byteScritti ? t.byteScritti.session : null,
        scritture: t && t.scritture ? t.scritture.session : null,
      };
    });
    assert.ok(!r.manca, 'il modulo cloud (window.fxbtCloud) deve essere caricato');
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.scritture, 1, 'prova di controllo: la scrittura deve essere contata davvero');
    assert.equal(r.byte, 7,
      'cloud._conta deve passare 7 byte UTF-8 a fblTrafficoSegna; ha passato ' + r.byte + ' (i caratteri di "perché")');
  } finally { await browser.close(); }
});

test('8.6.23: il contatore riceve byte diversi per documenti diversi', async () => {
  const {browser, pagina} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const visti = await pagina.evaluate(() => {
      const out = [];
      const segna = (tipo, documento, byte) => out.push({tipo, documento, byte});
      if(typeof window.fblTrafficoSegnaByte !== 'function') return null;
      // Si inietta chi segna: si misura cio' che arriva al contatore, senza scrivere
      // nel magazzino. Stessa strada che _conta usa per i payload reali.
      const encoder = {encode: s => new TextEncoder().encode(s)};
      window.fblTrafficoSegnaByte('scrittura', 'session', 'Roma', {encoder, segna});
      window.fblTrafficoSegnaByte('scrittura', 'notizie', 'perché', {encoder, segna});
      return out;
    });
    assert.ok(visti, 'il modulo cloud e la funzione di conteggio devono essere caricati');
    assert.deepEqual(visti.map(v => v.byte), [4, 7],
      'Roma pesa 4 byte e "perché" 7: i caratteri davano ' + contaVecchia('Roma') + ' e ' + contaVecchia('perché'));
    assert.equal(visti[0].documento, 'session');
    assert.equal(visti[1].documento, 'notizie');
  } finally { await browser.close(); }
});

test('8.6.23: stringa vuota pesa zero; null segue il «dato||{}» dell\'app', async () => {
  const {browser, pagina} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const r = await pagina.evaluate(() => {
      const encoder = {encode: s => new TextEncoder().encode(s)};
      if(typeof window.fblByteUtf8 !== 'function' || typeof window.fblContaPayloadByte !== 'function') return null;
      return {
        nullo: window.fblByteUtf8(null, encoder),
        vuota: window.fblByteUtf8('', encoder),
        payloadVuota: window.fblContaPayloadByte('', encoder),
        payloadNulla: window.fblContaPayloadByte(null, encoder),
      };
    });
    assert.deepEqual(r, {nullo: 0, vuota: 0, payloadVuota: 0, payloadNulla: 2},
      'il valore mancante deve seguire "dato||{}" e pesare i 2 byte di "{}"');
  } finally { await browser.close(); }
});

test('8.6.23: encoder guasto o dato circolare non fanno cadere il salvataggio', async () => {
  const {browser, pagina} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const r = await pagina.evaluate(() => {
      const encoder = {encode: s => new TextEncoder().encode(s)};
      const rotto = {encode: () => { throw new Error('encoder assente'); }};
      if(typeof window.fblByteUtf8 !== 'function' || typeof window.fblContaPayloadByte !== 'function'
         || typeof window.fblTrafficoSegnaByte !== 'function') return null;
      const circolare = {};
      circolare.self = circolare;
      const visti = [];
      const esito = window.fblTrafficoSegnaByte('scrittura', 'session', circolare, {
        encoder, segna: (t, d, b) => visti.push({t, d, b}),
      });
      // Un contatore che lancia non deve poter interrompere un salvataggio riuscito.
      let errore = null;
      try{
        window.fblTrafficoSegnaByte('scrittura', 'session', 'perché', {
          encoder, segna: () => { throw new Error('contatore rotto'); },
        });
      }catch(e){ errore = String(e && e.message); }
      return {
        guasto: window.fblByteUtf8('perché', rotto),
        circolare: window.fblContaPayloadByte(circolare, encoder),
        byte: esito.byte, segnato: esito.segnato, visti: visti.length, errore,
      };
    });
    assert.ok(r, 'le funzioni di conteggio devono essere presenti');
    assert.equal(r.guasto, null, 'con l\'encoder guasto non si inventa un numero, nemmeno zero');
    assert.equal(r.circolare, null, 'un payload non serializzabile non ha un conteggio, nemmeno zero');
    assert.equal(r.byte, null);
    assert.equal(r.segnato, false, 'non si deve segnare uno zero falso per un payload circolare');
    assert.equal(r.visti, 0, 'il contatore non deve essere chiamato affatto');
    assert.equal(r.errore, null, 'il contatore non deve mai interrompere un salvataggio');
  } finally { await browser.close(); }
});

// LO ZERO FALSO TROVATO DAL REVISORE: JSON.stringify non lancia su funzioni e Symbol,
// restituisce undefined. Senza la guardia typeof il contatore riceveva 0 e diceva segnato:true.
test('8.6.23: funzione e Symbol non si serializzano: niente segno, niente zero falso', async () => {
  const {browser, pagina} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const r = await pagina.evaluate(() => {
      const encoder = {encode: s => new TextEncoder().encode(s)};
      if(typeof window.fblTrafficoSegnaByte !== 'function') return null;
      const visti = [];
      const segna = (t, d, b) => visti.push({t, d, b});
      const funzione = window.fblTrafficoSegnaByte('scrittura', 'session', function(){}, {encoder, segna});
      const simbolo = window.fblTrafficoSegnaByte('scrittura', 'notizie', Symbol('x'), {encoder, segna});
      return {
        funzione: {byte: funzione.byte, segnato: funzione.segnato},
        simbolo: {byte: simbolo.byte, segnato: simbolo.segnato},
        visti: visti.length,
        ausiliaria: window.fblContaPayloadByte(function(){}, encoder),
      };
    });
    assert.ok(r, 'le funzioni di conteggio devono essere presenti');
    assert.deepEqual(r.funzione, {byte: null, segnato: false},
      'una funzione non produce una stringa: non si deve segnare uno zero falso');
    assert.deepEqual(r.simbolo, {byte: null, segnato: false},
      'un Symbol non produce una stringa: non si deve segnare uno zero falso');
    assert.equal(r.visti, 0, 'il contatore non deve essere chiamato in nessuno dei due casi');
    assert.equal(r.ausiliaria, null, 'anche la funzione ausiliaria deve dire che non c\'e una misura');
  } finally { await browser.close(); }
});

test('8.6.23: un encoder iniettabile che lancia non fa segnare niente', async () => {
  const {browser, pagina} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const r = await pagina.evaluate(() => {
      if(typeof window.fblTrafficoSegnaByte !== 'function') return null;
      const rotto = {encode: () => { throw new Error('encoder assente'); }};
      const visti = [];
      let errore = null;
      let esito = null;
      try{
        esito = window.fblTrafficoSegnaByte('scrittura', 'session', 'perché', {
          encoder: rotto, segna: (t, d, b) => visti.push({t, d, b}),
        });
      }catch(e){ errore = String(e && e.message); }
      return {byte: esito && esito.byte, segnato: esito && esito.segnato,
              visti: visti.length, errore};
    });
    assert.ok(r, 'le funzioni di conteggio devono essere presenti');
    assert.equal(r.errore, null, 'un encoder rotto non deve lanciare verso il salvataggio');
    assert.equal(r.byte, null, 'senza byte misurato non si riporta zero');
    assert.equal(r.segnato, false, 'non si segna niente se l\'encoder non funziona');
    assert.equal(r.visti, 0, 'il contatore non deve essere chiamato');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: la guardia non deve scambiare uno zero legittimo per un guasto.
test('8.6.23: PROVA DI CONTROLLO - la stringa vuota resta 0 byte segnato', async () => {
  const {browser, pagina} = await apriApp({primaDiNavigare: firebaseFinto});
  try {
    const r = await pagina.evaluate(() => {
      if(typeof window.fblTrafficoSegnaByte !== 'function') return null;
      const visti = [];
      const esito = window.fblTrafficoSegnaByte('scrittura', 'session', '', {
        encoder: {encode: s => new TextEncoder().encode(s)},
        segna: (t, d, b) => visti.push({t, d, b}),
      });
      return {byte: esito.byte, segnato: esito.segnato, visti};
    });
    assert.ok(r, 'le funzioni di conteggio devono essere presenti');
    assert.deepEqual(r.visti, [{t: 'scrittura', d: 'session', b: 0}]);
    assert.equal(r.byte, 0, 'zero byte e\' legitimo per la stringa vuota');
    assert.equal(r.segnato, true, 'la stringa vuota deve essere contata, non scartata');
  } finally { await browser.close(); }
});
