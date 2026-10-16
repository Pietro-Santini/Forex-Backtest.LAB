// L'ORARIO E IL PREZZO DI APERTURA SONO FATTI, NON STATI DELL'APPLICAZIONE.
//
// SEGNALATO dal proprietario: «ho aperto una posizione su Kraken alle 22. Dopo aver aggiornato
// l'applicazione, chiusa e riaperta, sono andato a riaprire il grafico e la posizione me l'ha
// messa alle 19:20. Per ogni posizione salva questi dati, sono stra importanti: non possiamo avere
// un cambio di posizione dentro il grafico, né di apertura né di chiusura. Deve sempre combaciare
// con la candela giusta».
//
// LA CAUSA: l'orario veniva da tre posti in ordine di preferenza — l'orario vero dell'exchange,
// poi la data della strategia locale, poi «venti candele prima della fine». I primi due vivono in
// memoria o in una mappa che scade: dopo un riavvio restava il terzo, che non è un orario ma un
// ripiego. Da lì il salto.
//
// E LA STESSA FALLA, dall'altro lato: «nei dispositivi mobili visualizza sempre l'origine in
// maniera manuale, cosa che non è assolutamente vera». Le mappe che dicono CHI ha aperto una
// posizione vivevano solo sul dispositivo che l'aveva aperta.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('un orario osservato una volta si scrive, e sopravvive al riavvio', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const scritto = await pagina.evaluate(`{
      const k = 'kraken:PF_SOLUSD|conto-1';
      const alle22 = Date.UTC(2026, 9, 15, 20, 0, 0);   // 22:00 italiane
      posAnagraficaSegna(k, {apertaMs: alle22, entry: 105.91, sala: 'Segnali', side: 'BUY'});
      ({salvato: localStorage.getItem(POS_ANAGRAFICA_KEY), letto: posAnagraficaDi(k), alle22})
    }`);
    assert.ok(scritto.salvato, 'deve finire in localStorage, non solo in memoria');
    assert.equal(scritto.letto.apertaMs, scritto.alle22);
    assert.equal(scritto.letto.sala, 'Segnali');
    // Il riavvio dell'app è il caso del difetto: si ricarica la pagina e si rilegge.
    await pagina.reload({waitUntil:'domcontentloaded'});
    await pagina.waitForTimeout(2500);
    const dopo = await pagina.evaluate(`posAnagraficaDi('kraken:PF_SOLUSD|conto-1')`);
    assert.equal(dopo.apertaMs, scritto.alle22, 'dopo il riavvio l\'orario deve essere ancora quello');
    assert.equal(dopo.entry, 105.91);
    assert.equal(dopo.sala, 'Segnali');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un orario già noto NON viene riscritto da una fonte peggiore', async () => {
  // È il cuore della correzione: rincorrere la fonte del momento è esattamente il difetto.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      const k = 'kraken:PF_XBTUSD|conto-1';
      const vero = Date.UTC(2026, 9, 15, 20, 0, 0);
      const ripiego = Date.UTC(2026, 9, 15, 17, 20, 0);
      posAnagraficaSegna(k, {apertaMs: vero});
      const cambiato = posAnagraficaSegna(k, {apertaMs: ripiego});   // arriva un orario diverso
      ({cambiato, adesso: posAnagraficaDi(k).apertaMs, vero})
    }`);
    assert.equal(r.cambiato, false, 'il secondo orario non deve essere accettato');
    assert.equal(r.adesso, r.vero, 'resta quello osservato per primo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('niente ripieghi dentro l\'anagrafica: si scrive solo quello che si sa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      const k = 'kraken:PF_ETHUSD|conto-1';
      ({zero: posAnagraficaSegna(k, {apertaMs: 0}),
        nulla: posAnagraficaSegna(k, {apertaMs: null}),
        testo: posAnagraficaSegna(k, {apertaMs: 'boh'}),
        vuoto: posAnagraficaSegna(k, {sala: ''}),
        dopo: posAnagraficaDi(k)})
    }`);
    assert.equal(r.zero, false, 'zero non è un orario');
    assert.equal(r.nulla, false);
    assert.equal(r.testo, false);
    assert.equal(r.vuoto, false, 'una sala vuota non è un nome');
    assert.ok(!r.dopo || r.dopo.apertaMs == null, 'non deve restare niente di inventato');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la sala viaggia con i livelli Kraken pubblicati agli altri dispositivi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      tgStrategie = {s1: {conto:'kraken', simbolo:'PF_SOLUSD', creato: 1000,
                          sl: 96.13, slIniziale: 96.13, tps: [106.66], sala: 'Segnali'}};
      const pubblicato = krakenLivelliDaStrategie();
      ({sala: pubblicato['PF_SOLUSD'] && pubblicato['PF_SOLUSD'].sala,
        sl: pubblicato['PF_SOLUSD'] && pubblicato['PF_SOLUSD'].sl})
    }`);
    assert.equal(r.sala, 'Segnali',
      'senza il nome della sala, sul telefono la posizione risulta aperta a mano: è il difetto segnalato');
    assert.equal(r.sl, 96.13, 'e i livelli continuano a viaggiare come prima');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le due mappe che dicono CHI ha aperto sono fra quelle sincronizzate', async () => {
  // Senza questo, sul telefono le posizioni MT5 aperte dalle sale restano "Manuale".
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`({
      mt5: 'fb_mt5_ticket_segnale' in GRAFICO_LS,
      anagrafica: 'fbl_pos_anagrafica' in GRAFICO_LS,
      livelli: 'fb_kraken_livelli' in GRAFICO_LS
    })`);
    assert.equal(r.mt5, true, 'il ticket MT5 -> sala deve arrivare anche sugli altri dispositivi');
    assert.equal(r.anagrafica, true);
    assert.equal(r.livelli, true, 'e i livelli Kraken restano sincronizzati come prima');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('arrivando da un altro dispositivo i ticket si FONDONO, non si sostituiscono', async () => {
  // Ogni dispositivo può aver aperto ticket suoi: una sostituzione secca cancellerebbe gli altri.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      mt5TgMeta = {'111': {tgSala:'Sala di qui'}};
      GRAFICO_LS['fb_mt5_ticket_segnale'](JSON.stringify({'222': {tgSala:'Sala dell altro'}}));
      ({qui: !!mt5TgMeta['111'], altro: !!mt5TgMeta['222'],
        nomeQui: mt5TgMeta['111'] && mt5TgMeta['111'].tgSala})
    }`);
    assert.equal(r.qui, true, 'i ticket di questo dispositivo non si perdono');
    assert.equal(r.altro, true, 'e arrivano quelli dell\'altro');
    assert.equal(r.nomeQui, 'Sala di qui');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la colonna Origine non dice più "Manuale" quando semplicemente non sa', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const i = src.indexOf('ORIGINE: da quale sala arriva la posizione');
  assert.ok(i > 0, 'la cella Origine delle posizioni Kraken deve esistere');
  const cella = src.slice(i, i + 1400);
  assert.ok(/origine da confermare/.test(cella),
    'quando l\'anagrafica non è ancora arrivata si deve dire che non si sa, non "Manuale"');
  assert.ok(/posAnagraficaDi/.test(cella), 'e la cella deve leggere anche l\'anagrafica');
});
