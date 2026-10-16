// OGNI SALA COMPARE SOLO DOVE MANDA SEGNALI DAVVERO.
//
// RICHIESTO dal proprietario: «nella sezione apertura automatica dobbiamo suddividere bene le sale.
// Nella sezione cripto verranno messe solo le sale che hanno aperto almeno una volta un'operazione
// cripto. Non possiamo avere le stesse identiche sale sia nel forex sia nelle cripto. A meno che
// una sala non mandi entrambi i segnali». E: «quando la inseriamo per la prima volta compare un
// pop-up: che tipo di segnali manda questa sala? […] è un toggle dove seleziona — o ne seleziona
// una delle due, o le seleziona tutte e due».
//
// DUE STRADE che si sommano: la scelta dell'utente, e quello che la sala MANDA davvero. Si aggiunge
// soltanto, mai si toglie da sola: una sala che ha mandato una cripto a settembre resta nelle
// cripto anche se da allora manda solo forex — toglierla farebbe sparire una configurazione
// dell'utente senza dirglielo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PULISCI = `fblSalaFam={}; tgGruppi=['@forexroom','@cryptoroom','@mista','@nuova']; tgGruppiSyntra=[];`;

test('senza niente di saputo una sala si vede in tutte e due le sezioni', async () => {
  // È il comportamento di prima, ed è la scelta prudente: una sala che sparisce da una sezione è
  // una sala che non apre più posizioni lì.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      ${PULISCI}
      ({fam: fblSalaFamDi('@nuova'),
        inFx: fblSaleDiFamiglia('fx').includes('@nuova'),
        inCr: fblSaleDiFamiglia('cr').includes('@nuova')})
    }`);
    assert.equal(r.fam.saputo, false, 'deve dire che non si sa, non inventare una famiglia');
    assert.equal(r.inFx, true);
    assert.equal(r.inCr, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i segnali che arrivano insegnano, e si somma invece di sostituire', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      ${PULISCI}
      // Quattro segnali forex: la sala è forex.
      ['XAUUSD','EURUSD','GBPJPY','US500'].forEach(()=>fblSalaFamSegna('@mista','fx',false));
      const soloFx = {fx: fblSaleDiFamiglia('fx').includes('@mista'),
                      cr: fblSaleDiFamiglia('cr').includes('@mista')};
      // Il quinto è una cripto: da adesso sta in tutte e due (è l'esempio del proprietario).
      fblSalaFamSegna('@mista','cr',false);
      const dopoCripto = {fx: fblSaleDiFamiglia('fx').includes('@mista'),
                          cr: fblSaleDiFamiglia('cr').includes('@mista')};
      // E altri dieci forex non la tolgono dalle cripto.
      for(let i=0;i<10;i++) fblSalaFamSegna('@mista','fx',false);
      const dopoAncoraForex = fblSaleDiFamiglia('cr').includes('@mista');
      ({soloFx, dopoCripto, dopoAncoraForex})
    }`);
    assert.deepEqual(r.soloFx, {fx:true, cr:false}, 'quattro segnali forex: solo nel forex');
    assert.deepEqual(r.dopoCripto, {fx:true, cr:true}, 'il quinto segnale cripto la mette anche lì');
    assert.equal(r.dopoAncoraForex, true, 'e non se ne va più: si aggiunge, non si sostituisce');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una sala di sole cripto non compare nel forex', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      ${PULISCI}
      fblSalaFamSegna('@cryptoroom','cr',false);
      fblSalaFamSegna('@forexroom','fx',false);
      ({fxSezione: fblSaleDiFamiglia('fx'), crSezione: fblSaleDiFamiglia('cr')})
    }`);
    assert.ok(!r.fxSezione.includes('@cryptoroom'), 'una sala di sole cripto non sta nel forex');
    assert.ok(!r.crSezione.includes('@forexroom'), 'e viceversa');
    assert.ok(r.fxSezione.includes('@forexroom'));
    assert.ok(r.crSezione.includes('@cryptoroom'));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la scelta dell\'utente riscrive, quella imparata no', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      ${PULISCI}
      // Imparata: forex e cripto.
      fblSalaFamSegna('@mista','fx',false);
      fblSalaFamSegna('@mista','cr',false);
      // L'utente dice "solo cripto": lui comanda.
      fblSalaFamSegna('@mista',{fx:false,cr:true},true);
      ({dopoScelta: fblSalaFamDi('@mista'),
        inFx: fblSaleDiFamiglia('fx').includes('@mista')})
    }`);
    assert.deepEqual({fx:r.dopoScelta.fx, cr:r.dopoScelta.cr}, {fx:false, cr:true},
      'quando lo dice l\'utente, la scelta sostituisce quello che era stato imparato');
    assert.equal(r.inFx, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la famiglia si riconosce dal NOME dello strumento del segnale', async () => {
  // Il segnale porta "BTCUSD", non la chiave del grafico "BINANCE:BTCUSDT": chi guarda solo la
  // seconda direbbe "forex" su ogni cripto.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`({
      btc: fblTipoAsset('BTCUSD'), sol: fblTipoAsset('SOLUSD'),
      kraken: fblTipoAsset('PF_XBTUSD'), oro: fblTipoAsset('XAUUSD'), eur: fblTipoAsset('EURUSD')
    })`);
    assert.equal(r.btc, 'cripto');
    assert.equal(r.sol, 'cripto');
    assert.equal(r.kraken, 'cripto', 'anche il simbolo del contratto Kraken');
    assert.ok(r.oro !== 'cripto');
    assert.ok(r.eur !== 'cripto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la scelta arriva dagli altri dispositivi senza cancellare quello che si sa qui', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      ${PULISCI}
      fblSalaFamSegna('@forexroom','fx',false);          // visto solo qui
      GRAFICO_LS['fbl_sala_famiglie'](JSON.stringify({'@cryptoroom':{cr:true}}));
      ({qui: fblSaleDiFamiglia('fx').includes('@forexroom'),
        altro: fblSaleDiFamiglia('cr').includes('@cryptoroom'),
        sincronizzata: 'fbl_sala_famiglie' in GRAFICO_LS})
    }`);
    assert.equal(r.qui, true, 'quello che sa questo dispositivo non si perde');
    assert.equal(r.altro, true, 'e arriva quello dell\'altro');
    assert.equal(r.sincronizzata, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il popup mostra le caselle, e la scelta cambia la famiglia', async () => {
  // La richiesta del proprietario: «quando la inseriamo per la prima volta compare un pop-up: che
  // tipo di segnali manda questa sala? [...] è un toggle dove seleziona — o ne seleziona una delle
  // due, o le seleziona tutte e due». Prima della correzione le due caselle finivano a schermo
  // come TESTO (appConfirm non sapeva mostrare contenuto preparato dall'app) e «Salva» non cambiava
  // niente: tutti gli altri test erano verdi lo stesso, perché nessuno apriva il popup.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      fblSalaFam={}; tgGruppi=['@nuova']; tgGruppiSyntra=[];
      const p = fblSalaChiediFamiglie('@nuova');
      await new Promise(res => setTimeout(res, 80));   // appConfirm appende l'overlay (rAF)
      const fx = document.getElementById('fblSalaFamFx');
      const cr = document.getElementById('fblSalaFamCr');
      const caselle = !!(fx && cr && fx.type === 'checkbox' && cr.type === 'checkbox');
      if (fx) fx.checked = false;                       // scegli SOLO cripto
      if (cr) cr.checked = true;
      const ok = document.querySelector('.appConfirmOverlay [data-role="ok"]');
      if (ok) ok.click();
      const salvato = await p;
      return {caselle, salvato, fam: fblSalaFamDi('@nuova'),
              inFx: fblSaleDiFamiglia('fx').includes('@nuova'),
              inCr: fblSaleDiFamiglia('cr').includes('@nuova')};
    });
    assert.equal(r.caselle, true, 'le due caselle devono esistere nel popup, non il loro testo');
    assert.equal(r.salvato, true);
    assert.deepEqual({fx: r.fam.fx, cr: r.fam.cr, saputo: r.fam.saputo},
      {fx: false, cr: true, saputo: true}, 'scegliendo solo cripto la sala resta solo nelle cripto');
    assert.equal(r.inFx, false);
    assert.equal(r.inCr, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('e chi non sceglie lascia la sala dov\'era', async () => {
  // «Decido dopo» non deve diventare una scelta per caso: la sala resta in tutte e due le sezioni.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      fblSalaFam={}; tgGruppi=['@nuova']; tgGruppiSyntra=[];
      const p = fblSalaChiediFamiglie('@nuova');
      await new Promise(res => setTimeout(res, 80));
      const cancel = document.querySelector('.appConfirmOverlay [data-role="cancel"]');
      if (cancel) cancel.click();
      const esito = await p;
      return {esito, saputo: fblSalaFamDi('@nuova').saputo,
              inFx: fblSaleDiFamiglia('fx').includes('@nuova'),
              inCr: fblSaleDiFamiglia('cr').includes('@nuova')};
    });
    assert.equal(r.esito, false);
    assert.equal(r.saputo, false, 'non scegliere non è una scelta: resta «non si sa»');
    assert.equal(r.inFx, true);
    assert.equal(r.inCr, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
