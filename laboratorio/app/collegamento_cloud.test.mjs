// LA CHIAVE DEL SERVER ARRIVA DALL'ACCOUNT GOOGLE, E NON SI VEDE MAI.
//
// Richiesto dal proprietario (18 ottobre 2026): «sui dispositivi mobili quando mi collego con
// l'account google non mi trasferisce in automatico la chiave ... non sono connesso ne a mt5,
// ne a kraken, ne posso inviare ordini, grafico. sul pc ancora vedo la chiave e il nome del
// server! NO! non devono essere visualizzati, perche' la chiave circola dentro l'account e il
// server che lo trasmette ai dispositivi».
//
// Causa misurata nel sorgente: host e chiave del server vivono SOLO nei localStorage di ogni
// dispositivo (FBL_SERVER_KEY / FBL_SERVER_CHIAVE_KEY) e il bundle di sincronizzazione
// (collectLightSessionState) non li include: nessuno li porta mai sull'altro dispositivo. Il
// registro della chiave personale (fblRegistraSulServer) poi non parte senza il nome del server
// gia' impostato: per chi arriva da un altro dispositivo il circolo non si apre mai.
//
// Il rimedio e' un documento dentro l'account (users/{uid}/data/collegamento): il PC ci scrive
// host e chiave quando salva il server, gli altri dispositivi dello stesso account lo ascoltano
// e riempiono da soli i propri magazzini; chi non trova niente deve essere avvisato che i
// servizi completi (MT5, Kraken, ordini, grafico) si registrano dal PC, mentre backtest e
// sessione Capital.com restano a disposizione.
//
// Questo test NON cerca una stringa nel sorgente: estrae il blocco marcato dentro app.html
// (quindi prova il codice che e' davvero pubblicato) e lo esegue con magazzini e "nuvola" finti.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {RADICE} from './aiuti.mjs';

const APP = path.join(RADICE, 'app.html');
const HTML = fs.readFileSync(APP, 'utf8');

function leggiBlocco(){
  const inizio = HTML.indexOf('COLLEGAMENTO CLOUD: INIZIO');
  assert.ok(inizio >= 0, "in app.html manca il blocco marcato COLLEGAMENTO CLOUD: INIZIO");
  const s = HTML.lastIndexOf('/*', inizio);
  assert.ok(s >= 0 && inizio - s < 60, "il marcatore di apertura non sta dentro un commento /* ... */");
  const fine = HTML.indexOf('COLLEGAMENTO CLOUD: FINE', inizio);
  assert.ok(fine > inizio, "in app.html manca il marcatore COLLEGAMENTO CLOUD: FINE");
  const e = HTML.indexOf('*/', fine);
  assert.ok(e > fine, "il marcatore di chiusura non sta dentro un commento");
  return HTML.slice(s, e + 2);
}
const BLOCCO = leggiBlocco();

// Le chiavi dei magazzini sono lette dal sorgente per usarle TAL QUALI sul banco: sono il
// contratto con fblServer()/fblServerChiave(), non un valore inventato dal test.
function constante(nome){
  const m = HTML.match(new RegExp('const\\s+' + nome + "\\s*=\\s*'([^']+)'"));
  assert.ok(m, 'in app.html manca la costante ' + nome);
  return m[1];
}
const K_HOST = constante('FBL_SERVER_KEY');
const K_CHIAVE = constante('FBL_SERVER_CHIAVE_KEY');

// Un magazzino finti, stesso comportamento del vero localStorage.
function memoria(){
  const m = new Map();
  return {
    get length(){ return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

// Modalita' privata: ogni accesso viene negato.
const NEGATO = {
  getItem(){ throw new Error('negato'); },
  setItem(){ throw new Error('negato'); },
  removeItem(){ throw new Error('negato'); },
  get length(){ return 0; },
  key(){ return null; },
};

// Esegue il blocco estratto e ritorna le sue funzioni. Le costanti arrivano in ingresso perche'
// nel sorgente sono dichiarate nello script della pagina, non sul global object.
function funzioni(){
  const f = new Function('FBL_SERVER_KEY', 'FBL_SERVER_CHIAVE_KEY',
    BLOCCO + '\nreturn {fblCollegamentoPrepara, fblCollegamentoRicevi, fblCollegamentoServeAvviso,'
    + ' fblCollegamentoPubblica, fblCollegamentoAvvia};');
  return f(K_HOST, K_CHIAVE);
}

// La "nuvola": un magazzino condiviso per uid con gli ascoltatori, stesso comportamento di
// setDoc + onSnapshot di Firestore (sparata iniziale + avviso a ogni scrittura).
function nuvola(){
  const documenti = new Map();
  const ascoltatori = new Map();
  return {
    documenti,
    cloud(uid){
      return {
        async collegamentoSalva(payload){
          documenti.set(uid, {...payload});
          for(const cb of (ascoltatori.get(uid) || [])){ try{ cb({...payload}); }catch(e){} }
        },
        collegamentoAscolta(cb){
          if(!ascoltatori.has(uid)) ascoltatori.set(uid, new Set());
          ascoltatori.get(uid).add(cb);
          cb(documenti.has(uid) ? {...documenti.get(uid)} : null);   // spara subito lo stato attuale
          return () => ascoltatori.get(uid).delete(cb);
        },
      };
    },
  };
}

test("il blocco del collegamento cloud e' JavaScript valido", () => {
  assert.doesNotThrow(() => funzioni(), "il blocco estratto da app.html non si puo' nemmeno istanziare");
});

test("il PC con il server salvato pubblica host e chiave sull'account", () => {
  const f = funzioni();
  const store = memoria();
  store.setItem(K_HOST, '  mio-server.ts.net  ');
  store.setItem(K_CHIAVE, 'segreto-123');
  const nv = nuvola();
  assert.equal(f.fblCollegamentoPubblica(nv.cloud('uid-uno'), store), true,
    "il PC ha il server salvato ma non pubblica niente: gli altri dispositivi restano al buio");
  const doc = nv.documenti.get('uid-uno');
  assert.ok(doc, "il documento del collegamento non e' arrivato sulla nuvola");
  assert.equal(doc.host, 'mio-server.ts.net', "l'host pubblicato deve coincidere con quello salvato (ripulito)");
  assert.equal(doc.chiave, 'segreto-123', "la chiave pubblicata deve coincidere con quella salvata");
  assert.equal(typeof doc.aggiornato, 'number',
    "senza data non si distingue un documento nuovo da uno rimasto indietro");
});

test("senza server configurato il PC non pubblica niente", () => {
  const f = funzioni();
  const nv = nuvola();
  assert.equal(f.fblCollegamentoPubblica(nv.cloud('uid-uno'), memoria()), false);
  assert.equal(nv.documenti.size, 0,
    "un documento vuoto sulla nuvola direbbe agli altri dispositivi che il server c'e' quando non c'e'");
});

test("host senza chiave (o chiave senza host) non si pubblica: mai mezzo collegamento", () => {
  const f = funzioni();
  const soloHost = memoria();
  soloHost.setItem(K_HOST, 'casa.ts.net');
  const soloChiave = memoria();
  soloChiave.setItem(K_CHIAVE, 'k');
  assert.equal(f.fblCollegamentoPubblica(nuvola().cloud('u'), soloHost), false,
    "un host senza chiave non collega niente e inganna il dispositivo che lo riceve");
  assert.equal(f.fblCollegamentoPubblica(nuvola().cloud('u'), soloChiave), false);
});

test("il primo accesso da un dispositivo senza il PC viene avvisato", () => {
  const f = funzioni();
  assert.equal(f.fblCollegamentoServeAvviso(memoria()), true,
    "dispositivo appena arrivato: deve sapere che i servizi completi si registrano dal PC");
  const soloHost = memoria();
  soloHost.setItem(K_HOST, 'casa.ts.net');
  assert.equal(f.fblCollegamentoServeAvviso(soloHost), true,
    "host senza chiave non collega niente: l'avviso deve restare");
  const completo = memoria();
  completo.setItem(K_HOST, 'casa.ts.net');
  completo.setItem(K_CHIAVE, 'k');
  assert.equal(f.fblCollegamentoServeAvviso(completo), false,
    "collegamento completo: l'avviso non deve disturbare");
  assert.equal(f.fblCollegamentoServeAvviso(NEGATO), true,
    "senza memoria leggibile si presume il caso da avvisare, non quello a posto");
});

test("il telefono riceve da solo il collegamento: stesso account, nessuna digitazione", () => {
  const f = funzioni();
  const nv = nuvola();
  // Il PC salva il server (stessa cosa che fa il gestore di salvataggio dell'app).
  const pc = memoria();
  pc.setItem(K_HOST, 'casa-mia.ts.net');
  pc.setItem(K_CHIAVE, 'chiave-del-server');
  f.fblCollegamentoPubblica(nv.cloud('uid-uno'), pc);

  // Il telefono, magazzini vuoti, si aggancia allo stesso account.
  const telefono = memoria();
  let arrivato = 0;
  f.fblCollegamentoAvvia(nv.cloud('uid-uno'), telefono, () => arrivato++);
  assert.equal(telefono.getItem(K_HOST), 'casa-mia.ts.net',
    "l'host non e' arrivato: il telefono resterebbe senza server e senza MT5/Kraken/ordini");
  assert.equal(telefono.getItem(K_CHIAVE), 'chiave-del-server',
    "la chiave non e' arrivata: ogni richiesta al server verrebbe rifiutata");
  assert.equal(arrivato, 1, "il segnale di collegamento non e' partito: la registrazione non riparte");
  assert.equal(f.fblCollegamentoServeAvviso(telefono), false,
    "con la chiave arrivata l'avviso di primo accesso non deve piu' apparire");
});

test("due dispositivi dello stesso account finiscono con lo stesso collegamento", () => {
  const f = funzioni();
  const nv = nuvola();
  const pc = memoria();
  pc.setItem(K_HOST, 'casa.ts.net');
  pc.setItem(K_CHIAVE, 'k-123');
  f.fblCollegamentoPubblica(nv.cloud('uid-uno'), pc);
  const tablet = memoria();
  const telefono = memoria();
  f.fblCollegamentoAvvia(nv.cloud('uid-uno'), tablet, () => {});
  f.fblCollegamentoAvvia(nv.cloud('uid-uno'), telefono, () => {});
  assert.equal(tablet.getItem(K_HOST), telefono.getItem(K_HOST), "i due dispositivi vedono host diversi");
  assert.equal(tablet.getItem(K_CHIAVE), telefono.getItem(K_CHIAVE), "i due dispositivi vedono chiavi diverse");
  assert.equal(telefono.getItem(K_HOST), 'casa.ts.net');
});

test("il PC cambia la chiave: gli altri dispositivi la seguono senza scrivere niente", () => {
  const f = funzioni();
  const nv = nuvola();
  const telefono = memoria();
  let arrivati = 0;
  f.fblCollegamentoAvvia(nv.cloud('uid-uno'), telefono, () => arrivati++);
  assert.equal(telefono.getItem(K_CHIAVE), null, "prima del PC il telefono non puo' avere la chiave");
  const pc = memoria();
  pc.setItem(K_HOST, 'casa.ts.net');
  pc.setItem(K_CHIAVE, 'prima');
  f.fblCollegamentoPubblica(nv.cloud('uid-uno'), pc);
  assert.equal(telefono.getItem(K_CHIAVE), 'prima');
  pc.setItem(K_CHIAVE, 'seconda');
  f.fblCollegamentoPubblica(nv.cloud('uid-uno'), pc);
  assert.equal(telefono.getItem(K_CHIAVE), 'seconda',
    "il telefono resta con la chiave vecchia e il server lo rifiuta finche' non si slogga");
  assert.equal(arrivati, 2, "ogni aggiornamento deve riaccendere il segnale di collegamento");
});

test("un documento difettoso viene rifiutato e il magazzino resta come prima", () => {
  const f = funzioni();
  const cattivi = [
    {nome: 'documento assente', d: null},
    {nome: 'oggetto vuoto', d: {}},
    {nome: 'manca la chiave', d: {host: 'casa.ts.net'}},
    {nome: 'manca l host', d: {chiave: 'k'}},
    {nome: 'host non tailscale', d: {host: 'esempio.com', chiave: 'k'}},
    {nome: 'tipi sbagliati', d: {host: 123, chiave: {}}},
    {nome: 'valori lunghissimi', d: {host: 'a'.repeat(400) + '.ts.net', chiave: 'b'.repeat(400)}},
  ];
  for(const {nome, d} of cattivi){
    const store = memoria();
    store.setItem(K_HOST, 'vecchio.ts.net');
    store.setItem(K_CHIAVE, 'vecchia');
    assert.equal(f.fblCollegamentoRicevi(d, store), false, nome + ': non deve essere accettato');
    assert.equal(store.getItem(K_HOST), 'vecchio.ts.net', nome + ": ha toccato l'host gia' salvato");
    assert.equal(store.getItem(K_CHIAVE), 'vecchia', nome + ': ha cancellato la chiave buona');
  }
});

test("i documenti difettosi non accendono il segnale di collegamento", () => {
  const f = funzioni();
  const nv = nuvola();
  const telefono = memoria();
  let arrivati = 0;
  const cloud = nv.cloud('uid-uno');   // ascolta PRIMA che la nuvola abbia documenti
  f.fblCollegamentoAvvia(cloud, telefono, () => arrivati++);
  assert.equal(arrivati, 0, "la nuvola era vuota: nessun segnale poteva esserci");
  cloud.collegamentoSalva({host: 'esempio.com', chiave: 'k'});   // arriva un documento rotto
  assert.equal(arrivati, 0, "un documento non valido non deve far credere che il collegamento c'e'");
  assert.equal(telefono.getItem(K_HOST), null);
});

test("una nuvola che non sa parlare non blocca l'avvio dell'app", () => {
  const f = funzioni();
  assert.equal(f.fblCollegamentoPubblica({}, memoria()), false);
  assert.equal(f.fblCollegamentoPubblica(null, memoria()), false);
  assert.equal(f.fblCollegamentoAvvia({}, memoria(), () => { throw new Error('non deve chiamare'); }), null);
  assert.equal(f.fblCollegamentoAvvia(null, memoria(), null), null);
});

test("modalita' privata (localStorage negato): nessun errore e l'avviso resta acceso", () => {
  const f = funzioni();
  assert.equal(f.fblCollegamentoPrepara(NEGATO), null,
    "con la memoria negata non si puo' decidere cosa pubblicare");
  assert.equal(f.fblCollegamentoRicevi({host: 'casa.ts.net', chiave: 'k'}, NEGATO), false);
  assert.equal(f.fblCollegamentoServeAvviso(NEGATO), true);
  const nv = nuvola();
  nv.documenti.set('uid', {host: 'casa.ts.net', chiave: 'k'});
  assert.equal(f.fblCollegamentoPubblica(nv.cloud('uid'), NEGATO), false,
    "senza leggere il proprio magazzino non si pubblica un valore a caso");
  let chiamato = false;
  const r = f.fblCollegamentoAvvia(nv.cloud('uid'), NEGATO, () => { chiamato = true; });
  assert.equal(typeof r, 'function', "l'ascolto deve comunque partire e potersi sbloccare");
  assert.equal(chiamato, false, "il magazzino era negato: il segnale non deve mentire");
});
