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

test('la scala al 30% si pubblica e si accetta: il minimo e\' 10, non 70', async () => {
  // Il tetto minimo e' sceso al 10% nella v2.0.10 («sul telefono il 70% e' troppo»), ma questi due
  // controlli erano rimasti al vecchio minimo: una scala al 30% scelta sul telefono non veniva mai
  // pubblicata, e se arrivava da un altro dispositivo veniva rifiutata. Non si vedeva nessun
  // errore: semplicemente la scala non seguiva l'account.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const finto = (valori) => ({
        dati: Object.assign({}, valori),
        getItem(k){ return this.dati[k] === undefined ? null : this.dati[k]; },
        setItem(k, v){ this.dati[k] = String(v); },
        removeItem(k){ delete this.dati[k]; }
      });
      const store = finto({[FBL_UI_SCALA_KEY]: '30'});
      const pubblicato = fblSyncPrepara(store);
      const dest = finto({});
      const accettato = fblSyncRicevi({watchlist: [], ricerche: [], scala: 30}, dest);
      // Il 2% non e' una scala utilizzabile (sotto il tetto non si vede piu' niente): il
      // documento resta valido — watchlist e ricerche lo sono — ma la scala NON si scrive.
      // La garanzia che conta e' questa, non il valore restituito.
      const piccolo = finto({});
      const troppoPiccolaAccettato = fblSyncRicevi({watchlist: [], ricerche: [], scala: 2}, piccolo);
      return {
        pubblicata: pubblicato ? pubblicato.scala : null,
        accettato, scalaRicevuta: dest.getItem(FBL_UI_SCALA_KEY),
        troppoPiccolaAccettato, scalaPiccola: piccolo.getItem(FBL_UI_SCALA_KEY)
      };
    });
    assert.equal(r.pubblicata, 30, 'una scala al 30% deve essere pubblicata: ' + r.pubblicata);
    assert.equal(r.accettato, true, 'e una scala al 30% che arriva va accettata');
    assert.equal(r.scalaRicevuta, '30', 'e scritta nel magazzino: ' + r.scalaRicevuta);
    assert.equal(r.scalaPiccola, null,
      'una scala del 2% non va scritta: sotto il tetto non si vedrebbe piu\' niente (trovato: ' + r.scalaPiccola + ')');
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
