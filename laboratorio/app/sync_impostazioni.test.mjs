// LE IMPOSTAZIONI SEGUONO L'ACCOUNT; I SEGRETI NO.
//
// RICHIESTO dal proprietario: «con i dispositivi mobili devono essere ricordate tutte le
// configurazioni di style, impostazioni footprint heatmap eccetera: devono prendere queste
// informazioni dalla configurazione del pc».
//
// E un secondo motivo, emerso il 21 ottobre. Dopo un aggiornamento «spariscono pure gli asset
// watchlist eccetera». Non è una cancellazione: il browser tiene un magazzino SEPARATO per ogni
// indirizzo, e l'app si apre da tre porte d'ingresso diverse (il sito, il servizio locale che la
// serve su 127.0.0.1, l'APK su localhost). Quello che viaggia sull'account torna da solo anche
// cambiando porta; quello che vive solo in localStorage sembra sparito per sempre.
//
// L'ALTRA META' DELLA REGOLA, ed è quella che questi test difendono davvero: credenziali, chiavi,
// numeri di telefono e indirizzi di server NON devono finire lassù. Parole del proprietario:
// «l'utente sceglie la cartella dove salvare le credenziali, così si spiega anche che le
// credenziali rimangono sul dispositivo e non circolano online». Un test che lo verifica vale più
// di un commento: impedisce che fra sei mesi qualcuno aggiunga una chiave all'elenco per comodità.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('le impostazioni che il proprietario ha chiesto viaggiano con l\'account', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => Object.keys(GRAFICO_LS));
    const attese = [
      'fbl_footprint_style',        // le impostazioni del footprint, chieste per nome
      'fbl_footprint_rows_target',
      'fbl_profili_indicatori',     // i profili degli indicatori
      'fbl_decimali_per_asset',     // come si leggono i prezzi di ogni asset
      'fbl_crono_strategia',        // le strategie delle sale
      'fbl_sale_nomi', 'fbl_sale_target',
      'fb_dash_periodi'             // i periodi della dashboard
    ];
    const mancanti = attese.filter(k => !r.includes(k));
    assert.deepEqual(mancanti, [], 'queste impostazioni devono seguire l\'account: ' + mancanti.join(', '));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('NESSUN segreto nella sincronizzazione: credenziali, chiavi, numeri, server', async () => {
  // La garanzia che si promette all'utente. Se un domani qualcuno aggiunge una di queste chiavi
  // all'elenco, questo test diventa rosso e dice perché.
  const {browser, pagina, errori} = await apriApp();
  try{
    const chiavi = await pagina.evaluate(() => Object.keys(GRAFICO_LS));
    const vietate = [
      'fb_chiave_ponte',      // la chiave del ponte locale
      'fb_indirizzo_ponte',
      'fb_tg_telefono',       // il numero di telefono dell'account Telegram
      'fbl_server_chiave',    // la chiave del server Oracle
      'fbl_server_host'
    ];
    const dentro = vietate.filter(k => chiavi.includes(k));
    assert.deepEqual(dentro, [],
      'questi NON devono mai viaggiare sull\'account: ' + dentro.join(', '));
    // E nessuna chiave dal nome sospetto, nemmeno aggiunta in futuro.
    const sospette = chiavi.filter(k => /(cred|chiave|token|password|segret|telefono|session)/i.test(k));
    assert.deepEqual(sospette, [],
      'chiavi dal nome sospetto nell\'elenco sincronizzato: ' + sospette.join(', '));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la scala NON viaggia piu\': non si pubblica e non si accetta (3 novembre 2026)', async () => {
  // RICHIESTO DAL PROPRIETARIO: «se vado a modificare la scala sul telefono o sul tablet me la va
  // a modificare anche sul PC. Assolutamente no, non deve funzionare in questo modo. Rimane
  // indipendente rispetto agli altri dispositivi.»
  // Questo test era rosso prima della cura: pubblicava la scala e la accettava dal cloud (era
  // nato per provare che una scala al 30% passasse, quando la regola era l'opposto). Ora prova
  // il contrario: la scala resta di questo schermo. Cambiare il verso di un test esistente e'
  // la prova che la cura ha cambiato il comportamento, non solo il codice.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const finto = (valori) => ({
        dati: Object.assign({}, valori),
        getItem(k){ return this.dati[k] === undefined ? null : this.dati[k]; },
        setItem(k, v){ this.dati[k] = String(v); },
        removeItem(k){ delete this.dati[k]; }
      });
      // Questo dispositivo ha una preferenza VERA (la watchlist) e anche la scala al 30%.
      const store = finto({
        [FBL_SYNC_WATCHLIST_KEY]: JSON.stringify(['XAU/USD']),
        [FBL_UI_SCALA_KEY]: '30'
      });
      const pubblicato = fblSyncPrepara(store);
      // Un documento dal cloud che PORTA la scala non deve sovrascrivere quella locale.
      const dest = finto({});
      dest.setItem(FBL_UI_SCALA_KEY, '120');       // la scala di QUESTO schermo
      const accettato = fblSyncRicevi({watchlist: [], ricerche: [], scala: 30}, dest);
      return {
        pubblicatoQualcosa: !!pubblicato,
        watchlistPubblicata: pubblicato ? pubblicato.watchlist : null,
        haCampoScala: pubblicato ? ('scala' in pubblicato) : null,
        accettato,
        scalaDopo: dest.getItem(FBL_UI_SCALA_KEY)
      };
    });
    assert.equal(r.pubblicatoQualcosa, true,
      'il dispositivo ha una preferenza vera: deve pubblicare qualcosa');
    assert.deepEqual(r.watchlistPubblicata, ['XAU/USD'],
      'la watchlist deve continuare a viaggiare');
    assert.equal(r.haCampoScala, false,
      'il documento non deve portare proprio il campo scala: ' + r.haCampoScala);
    assert.equal(r.scalaDopo, '120',
      'la scala di questo schermo deve restare la sua anche se dal cloud ne arriva un\'altra');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una chiave sincronizzata arriva e si scrive nel magazzino di questo dispositivo', async () => {
  // La prova che aggiungere la chiave all'elenco basta davvero: il valore remoto viene scritto e
  // la funzione della voce viene chiamata, senza errori.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      try { localStorage.removeItem('fbl_footprint_style'); } catch(e) {}
      graficoApplica('ls|fbl_footprint_style', 'delta');
      const sel = document.getElementById('footprintStyle');
      return {salvato: localStorage.getItem('fbl_footprint_style'), campo: sel ? sel.value : null};
    });
    assert.equal(r.salvato, 'delta', 'il valore arrivato deve finire nel magazzino');
    assert.equal(r.campo, 'delta', 'e la casella a schermo deve mostrarlo: ' + r.campo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
