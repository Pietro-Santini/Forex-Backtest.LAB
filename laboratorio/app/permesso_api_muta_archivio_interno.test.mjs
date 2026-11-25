// QUANDO L'API DEI PERMESSI E' MUTA: ARCHIVIO INTERNO, E NESSUN POPUP.
//
// RICHIESTO dal proprietario (24 novembre 2026): «eliminiamo il popup che esce fuori del sblocca i
// file collegati eccetera, non deve visualizzarsi, lo fa in automatico».
//
// PERCHE' TOGLIERLO E' GIUSTO, e non e' nascondere un problema sotto il tappeto: MISURATO sul suo
// PC che in quel WebView NON risponde ne' `queryPermission` ne' `requestPermission` (i 3002 ms di
// `verifyDirPermission` sono la somma dei DUE tetti da 1500). Il banner «Sblocca i file collegati»
// chiedeva quindi un gesto **che non puo' riuscire**. Al suo posto si usa l'archivio interno
// dell'app, lo stesso del tablet: i dati restano sul dispositivo, cambia solo dove sono tenuti.
//
// I TRE CASI CHE DEVONO RESTARE DISTINTI (ed e' tutto il senso di questo banco):
//   1. API muta        -> archivio interno, nessun banner
//   2. permesso da riconfermare su un browser che RISPONDE -> il banner serve ancora, e deve restare
//   3. un solo silenzio -> NON basta per cambiare strada (un browser lento non e' un browser muto)
// Il caso 2 e' la prova che questa cura non ha spento il banner per tutti: spegnerlo sempre
// riporterebbe il difetto «le credenziali sono sparite» che `cartella_credenziali.test.mjs` chiude.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Riporta la pagina a uno stato pulito e installa una cartella finta col comportamento chiesto.
// Nota: assegnazioni a NOME NUDO, perche' nell'app queste sono `let` e un `let` globale non e' una
// proprieta' di globalThis (trappola gia' pagata, vedi BUG.md).
const PREPARA = (modo) => {
  const maiPiu = () => new Promise(() => {});
  try { localStorage.removeItem('fbl_permesso_api_muta'); } catch (e) {}
  fblPermessoApiMuta = false;
  fblPermessiSenzaRisposta = 0;
  fblPermessoRimandati = new Set();
  fblPermessoInAttesa = [];
  mt5CredsDirHandle = null;
  capitalCredsDirHandle = null;
  mt5SavedAccounts = [];
  const el = document.getElementById('unlockFilesBanner');
  if (el) el.style.display = 'none';

  if (modo === 'muta') {
    // Tacciono entrambe: serve il gesto attivo, altrimenti requestPermission non viene nemmeno
    // provata e di silenzi se ne conta uno solo.
    fblHaGesto = () => true;
    libDirGet = async () => ({name: 'applicazione', kind: 'directory',
      queryPermission: () => maiPiu(), requestPermission: () => maiPiu()});
  } else if (modo === 'risponde') {
    // Browser normale che ha dimenticato il permesso: risponde 'prompt', subito.
    fblHaGesto = () => false;
    libDirGet = async () => ({name: 'applicazione', kind: 'directory',
      queryPermission: async () => 'prompt', requestPermission: async () => 'granted'});
  } else if (modo === 'verdettoMaCartellaBuona') {
    // Il verdetto e' GIA' ricordato da un avvio precedente, ma adesso la cartella risponde:
    // e' il caso reale del proprietario dopo aver rifatto il login (permesso fresco, dato da lui).
    fblPermessoApiMuta = true;
    try { localStorage.setItem('fbl_permesso_api_muta', '1'); } catch (e) {}
    fblHaGesto = () => true;
    libDirGet = async () => ({name: 'conti trading', kind: 'directory',
      queryPermission: async () => 'granted', requestPermission: async () => 'granted'});
  } else if (modo === 'rispondeSubito') {
    // Browser PERFETTAMENTE SANO: il permesso c'e' e risponde all'istante.
    fblHaGesto = () => true;
    libDirGet = async () => ({name: 'conti trading', kind: 'directory',
      queryPermission: async () => 'granted', requestPermission: async () => 'granted'});
  } else if (modo === 'mutaPoiBuona') {
    // Prima chiamata muta, poi la cartella risponde: e' il caso reale del proprietario, che dopo
    // il login concede il permesso con un gesto suo e da quel momento la cartella funziona.
    let giro = 0;
    fblHaGesto = () => true;
    libDirGet = async () => ({name: 'conti trading', kind: 'directory',
      queryPermission: () => (++giro <= 1 ? new Promise(() => {}) : Promise.resolve('granted')),
      requestPermission: () => (giro <= 1 ? new Promise(() => {}) : Promise.resolve('granted'))});
  } else if (modo === 'unSoloSilenzio') {
    // Solo la prima tace; senza gesto la seconda non viene nemmeno provata.
    fblHaGesto = () => false;
    libDirGet = async () => ({name: 'applicazione', kind: 'directory',
      queryPermission: () => maiPiu(), requestPermission: async () => 'granted'});
  }
};

const LEGGI = () => {
  const el = document.getElementById('unlockFilesBanner');
  return el ? getComputedStyle(el).display : 'manca';
};

test('API muta: si usa l\'archivio interno e il banner non compare', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (fonte) => {
      if (!supportsFS) return {salta: true};
      eval('(' + fonte + ')("muta")');
      const t0 = performance.now();
      const h = await Promise.race([
        getMt5CredsDirHandle(),
        new Promise(r => setTimeout(() => r('__APPESO__'), 8000))
      ]);
      const el = document.getElementById('unlockFilesBanner');
      return {
        nome: (h === '__APPESO__') ? '__APPESO__' : (h ? String(h.name || '') : 'null'),
        ms: Math.round(performance.now() - t0),
        banner: el ? getComputedStyle(el).display : 'manca',
        verdetto: fblPermessoApiMuta,
        ricordato: (() => { try { return localStorage.getItem('fbl_permesso_api_muta'); } catch (e) { return 'err'; } })()
      };
    }, PREPARA.toString());
    if (r.salta) return;
    assert.notEqual(r.nome, '__APPESO__', 'getMt5CredsDirHandle non si e\' conclusa');
    assert.notEqual(r.nome, 'null',
      'con l\'API muta deve tornare l\'archivio interno, non null (null = elenco vuoto senza spiegazione)');
    assert.match(r.nome, /Archivio locale/,
      'e deve essere proprio l\'archivio interno dell\'app, non la cartella: ' + r.nome);
    assert.equal(r.banner, 'none', 'il banner «Sblocca i file collegati» NON deve comparire');
    // QUI NON SI ASSERISCE NULLA SUL VERDETTO APPICCICOSO, DI PROPOSITO: quante chiamate mute
    // servano per latchare «API muta» e' una decisione del proprietario ancora aperta al 25
    // novembre 2026 («decidiamo poi»). Il ripiego invece e' deciso, e dipende dal silenzio del
    // tentativo appena fatto (`fblPermessoMutoUltimoGiro`), non dal verdetto. Legare questo test
    // alla soglia lo renderebbe rosso per una scelta non ancora fatta, che e' il modo piu' sicuro
    // di far ignorare un test rosso.
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('browser che RISPONDE: il banner resta, e l\'archivio interno non si usa', async () => {
  // La prova che non ho spento il banner per tutti. Senza questa, la cura di sopra sarebbe
  // indistinguibile da «nascondi il popup e ignora il problema».
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (fonte) => {
      if (!supportsFS) return {salta: true};
      eval('(' + fonte + ')("risponde")');
      const h = await getMt5CredsDirHandle();
      const el = document.getElementById('unlockFilesBanner');
      return {
        nome: h ? String(h.name || '') : 'null',
        banner: el ? getComputedStyle(el).display : 'manca',
        verdetto: fblPermessoApiMuta,
        motivo: (document.getElementById('unlockFilesDesc') || {}).textContent || ''
      };
    }, PREPARA.toString());
    if (r.salta) return;
    assert.equal(r.verdetto, false,
      'un browser che risponde «prompt» non e\' muto: il verdetto non va preso');
    assert.equal(r.nome, 'null', 'e non si deve ripiegare sull\'archivio interno');
    assert.equal(r.banner, 'flex', 'il banner deve comparire, com\'era prima');
    assert.match(r.motivo, /conti MT5 salvati/, 'e dire per cosa serve: ' + r.motivo.slice(0, 80));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('col verdetto già preso, una cartella che RISPONDE vince sull\'archivio interno', async () => {
  // LA PROVA CHE EVITA UN DANNO VERO, e viene da una misura: il 24 novembre, dopo che il
  // proprietario ha rifatto il login, la cartella `conti trading` rispondeva e conteneva il suo
  // conto `12346925 @ Upcomers-Server`. Se il verdetto ricordato facesse tornare subito l'archivio
  // interno, quella cartella non verrebbe letta MAI piu' e il suo conto spariderebbe dall'elenco:
  // il «le credenziali sono sparite» di sempre, causato stavolta dalla cura. Il verdetto serve a
  // non mostrare il banner, NON a smettere di provare la cartella.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (fonte) => {
      if (!supportsFS) return {salta: true};
      eval('(' + fonte + ')("verdettoMaCartellaBuona")');
      const h = await getMt5CredsDirHandle();
      const el = document.getElementById('unlockFilesBanner');
      return {nome: h ? String(h.name || '') : 'null',
              verdetto: fblPermessoApiMuta,
              banner: el ? getComputedStyle(el).display : 'manca'};
    }, PREPARA.toString());
    if (r.salta) return;
    assert.equal(r.verdetto, true, 'il verdetto resta quello ricordato');
    assert.equal(r.nome, 'conti trading',
      'la cartella che risponde deve vincere: tornando l\'archivio interno il conto salvato sparirebbe (visto: ' + r.nome + ')');
    // (giro esplicito invece di assert.notMatch, che esiste ma e' meno chiaro da leggere qui)
    assert.equal(/Archivio locale/.test(r.nome), false, 'e quindi NON deve essere l\'archivio interno');
    assert.equal(r.banner, 'none', 'e nessun banner, perche\' il permesso c\'era');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un solo silenzio non basta: un browser lento non e\' un browser muto', async () => {
  // Il guardrail contro il falso positivo: se bastasse UN timeout, una macchina carica farebbe
  // cambiare strada all'app e i conti della cartella sparirebbero dalla vista.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (fonte) => {
      if (!supportsFS) return {salta: true};
      eval('(' + fonte + ')("unSoloSilenzio")');
      const h = await getMt5CredsDirHandle();
      return {nome: h ? String(h.name || '') : 'null',
              silenzi: fblPermessiSenzaRisposta, verdetto: fblPermessoApiMuta};
    }, PREPARA.toString());
    if (r.salta) return;
    assert.equal(r.silenzi, 1, 'di silenzi ce n\'e\' stato uno solo');
    assert.equal(r.verdetto, false, 'e uno solo non deve far scattare il verdetto appiccicoso');
    // ATTENZIONE, ASSERZIONE CAMBIATA IL 25 NOVEMBRE 2026, e il motivo conta.
    // Prima qui si pretendeva `nome === 'null'`: «con un solo silenzio niente archivio interno».
    // Era giusto quando il ripiego dipendeva dal verdetto, ed e' DIVENTATO SBAGLIATO quando i due
    // sono stati separati: un elenco vuoto senza spiegazione e' il difetto che la cura chiude,
    // quindi se la cartella tace ADESSO il ripiego deve partire ADESSO. Quello che il singolo
    // silenzio non deve fare e' latchare il verdetto (riga sopra), cioe' spegnere il banner per
    // sempre su un browser solo lento.
    assert.match(r.nome, /Archivio locale/,
      'col tentativo muto il ripiego parte subito, senza aspettare un secondo silenzio: ' + r.nome);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('browser SANO: una risposta immediata non conta come silenzio, nemmeno dopo il tetto', async () => {
  // IL TEST CHE MANCAVA, ed e' quello che avrebbe visto il difetto peggiore di questa cura:
  // `Promise.race` non annulla il perdente, quindi il `setTimeout` sparava comunque dopo 1500 ms e
  // contava un silenzio che NON c'era stato. Due chiamate qualsiasi (MT5 + Capital.com all'avvio)
  // latchavano «API muta» su un browser sanissimo, per sempre, con i conti che poi sparivano.
  // Gli altri test di questo file NON lo vedevano perche' leggevano lo stato SUBITO dopo l'await,
  // cioe' PRIMA che i timer sparassero. Qui si aspetta oltre il tetto, di proposito.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (fonte) => {
      // La premessa si dichiara: senza File System Access questi test non misurano nulla, e un
      // `return` muto li farebbe passare per finta.
      if (!supportsFS) return {salta: true, supporto: false};
      eval('(' + fonte + ')("rispondeSubito")');
      const h = await libDirGet('mt5CredsDir');
      // DUE chiamate, come all'avvio vero (credenziali MT5 + Capital.com).
      const a = await verifyDirPermission(h, 'readwrite');
      const b = await verifyDirPermission(h, 'readwrite');
      const subito = {silenzi: fblPermessiSenzaRisposta, verdetto: fblPermessoApiMuta};
      // SI ASPETTA OLTRE IL TETTO: e' qui che il difetto si manifestava.
      await new Promise(r => setTimeout(r, FBL_PERMESSO_TIMEOUT_MS + 1200));
      return {esiti: [a, b], subito,
              dopo: {silenzi: fblPermessiSenzaRisposta, verdetto: fblPermessoApiMuta},
              ricordato: (() => { try { return localStorage.getItem('fbl_permesso_api_muta'); } catch (e) { return 'err'; } })()};
    }, PREPARA.toString());
    if (r.salta) { assert.fail('il banco non espone showDirectoryPicker: questi test non misurerebbero niente'); }
    assert.deepEqual(r.esiti, [true, true], 'un permesso concesso deve risultare concesso');
    assert.equal(r.subito.silenzi, 0, 'nessun silenzio subito dopo le due risposte immediate');
    assert.equal(r.dopo.silenzi, 0,
      'e NESSUN silenzio nemmeno dopo il tetto: il timer va annullato quando la risposta arriva (visti ' + r.dopo.silenzi + ')');
    assert.equal(r.dopo.verdetto, false,
      'su un browser che risponde il verdetto «API muta» non deve mai scattare');
    assert.equal(r.ricordato, null, 'e non deve nemmeno essere ricordato in localStorage');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il ripiego non si appiccica: alla seconda chiamata la cartella che risponde torna a vincere', async () => {
  // L'altro difetto trovato in revisione: il ripiego veniva scritto dentro `mt5CredsDirHandle`,
  // cioe' nella stessa variabile di cache della cartella vera. Dalla prima volta in poi la riga
  // in cima alla funzione restituiva l'archivio interno e la cartella non veniva piu' provata per
  // tutta la sessione — mentre il commento prometteva «si prova sempre». In scrittura era peggio:
  // un conto salvato finiva nell'archivio interno vuoto mentre la cartella teneva l'elenco vecchio.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (fonte) => {
      if (!supportsFS) return {salta: true};
      eval('(' + fonte + ')("mutaPoiBuona")');
      // Primo giro: la cartella tace -> ripiego sull'archivio interno (e verdetto preso).
      const primo = await getMt5CredsDirHandle();
      // Secondo giro: ora la cartella risponde 'granted'. Deve tornare LEI.
      const secondo = await getMt5CredsDirHandle();
      return {primo: primo ? String(primo.name || '') : 'null',
              secondo: secondo ? String(secondo.name || '') : 'null',
              verdetto: fblPermessoApiMuta};
    }, PREPARA.toString());
    if (r.salta) return;
    assert.match(r.primo, /Archivio locale/,
      'col primo silenzio si ripiega sull\'archivio interno: ' + r.primo);
    assert.equal(r.secondo, 'conti trading',
      'ma alla chiamata dopo la cartella che risponde deve tornare a vincere, altrimenti il conto salvato sparisce (visto: ' + r.secondo + ')');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
