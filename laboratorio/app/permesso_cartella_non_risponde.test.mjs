// QUANDO IL PERMESSO SULLA CARTELLA NON RISPONDE MAI, I PULSANTI DEVONO COMUNQUE RISPONDERE.
//
// SEGNALATO dal proprietario (24 novembre 2026): «il pulsante account e connetti non rispondono,
// non mi permettono di collegarmi a MT5», «me lo fa solo sul PC, sul tablet funziona tutto
// correttamente», «non succede nulla».
//
// MISURATO sul suo PC, dentro il WebView dell'app installata, leggendo la pagina viva dalla porta
// di debug (nessun codice cambiato per misurare):
//   - il riferimento alla cartella c'era:      nome=applicazione, kind=directory
//   - handle.queryPermission({mode:'readwrite'})  -> NON si conclude (oltre 4 s, ancora pendente)
//   - handle.queryPermission({mode:'read'})       -> NON si conclude
//   - refreshMt5AccountsUI()                      -> NON si conclude (misurato 6006 ms, pendente)
//   - il pulsante era visibile e cliccabile: 113x30 px, pointerEvents auto,
//     document.elementFromPoint al suo centro restituiva il pulsante stesso.
//
// QUINDI il difetto non era il click, ne' la cache, ne' le credenziali: era UN'ATTESA SENZA FINE.
// Entrambe le voci del menu MT5 aspettano la cartella PRIMA di mostrare qualcosa:
//   «Account»  -> await refreshMt5AccountsUI() e solo dopo section.style.display='block'
//   «Connetti» -> await mt5ScegliConto(), che comincia con await refreshMt5AccountsUI()
// Una promessa che non si conclude mai le lascia entrambe a meta': nessun errore in console,
// nessuna riga nei log del ponte, e da fuori «non succede nulla». Sul tablet non capitava perche'
// lì la cartella non si usa (archivio interno), quindi nessuno chiedeva quel permesso.
//
// LA REGOLA, da qui in avanti: una risposta che non arriva vale «non lo so», non «aspetta per
// sempre». La prova di controllo di questi test e' esattamente il codice di prima: senza il
// tempo massimo i tre test diventano rossi (restano appesi al budget e lo dicono).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Prepara la pagina nella condizione misurata: una cartella salvata il cui permesso non risponde.
//
// LE ASSEGNAZIONI SONO A NOME NUDO, NON SU globalThis: nell'app queste sono dichiarate con `let`
// (es. `let mt5TerminalConfirmedBefore=false`), e un `let` di primo livello NON diventa una
// proprieta' di globalThis. Scrivendo globalThis.mt5TerminalConfirmedBefore=true si crea una
// variabile NUOVA e l'app continua a leggere la sua: il primo giro di questo test e' passato per
// questo motivo, provando la strada sbagliata (quella del primo accesso). Il nome nudo trova
// invece il legame vero nello spazio globale.
const PREPARA = () => {
  // Nessuna delle due promesse si concludera' MAI: e' il comportamento misurato nel WebView.
  const maiPiu = () => new Promise(() => {});
  globalThis.__chiamate = {query: 0, request: 0};
  libDirGet = async () => ({
    name: 'applicazione', kind: 'directory',
    queryPermission: () => { globalThis.__chiamate.query++; return maiPiu(); },
    requestPermission: () => { globalThis.__chiamate.request++; return maiPiu(); }
  });
  // La cache va svuotata, altrimenti la cartella risulta gia' buona e il permesso non si chiede.
  mt5CredsDirHandle = null;
  mt5SavedAccounts = [];
  mt5Connected = false;
  mt5MonitorOnly = false;
  // Il proprietario ha gia' completato la procedura guidata su questo PC: e' il suo caso reale,
  // ed e' quello che porta «Connetti» ad aspettare la cartella invece di aprire subito il login.
  mt5TerminalConfirmedBefore = true;
};

test('verifyDirPermission si conclude anche se il permesso non risponde mai', async () => {
  // Il cuore del difetto. Chi aspetta questa risposta deve poter proseguire: «non lo so» e' una
  // risposta, «mai» non lo e'.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (fonte) => {
      if (!supportsFS) return {salta: true};
      eval('(' + fonte + ')()');
      const handle = await libDirGet('mt5CredsDir');
      const t0 = performance.now();
      const esito = await Promise.race([
        verifyDirPermission(handle, 'readwrite'),
        // SENTINELLA LEGATA ALLA COSTANTE, non un numero a mano: a 5000 ms fissi questa gara
        // dichiarava «appeso» un caso che a 4515 ms era soltanto lento (il collaudo gira quattro
        // browser in parallelo). Un numero scritto a mano qui produce un rosso che accusa il
        // codice di un difetto che non ha.
        new Promise(r => setTimeout(() => r('__APPESO__'), FBL_PERMESSO_TIMEOUT_MS * 6))
      ]);
      return {esito, ms: Math.round(performance.now() - t0), tetto: FBL_PERMESSO_TIMEOUT_MS,
              chiamate: globalThis.__chiamate};
    }, PREPARA.toString());
    if (r.salta) return;
    assert.notEqual(r.esito, '__APPESO__',
      'verifyDirPermission non si e\' conclusa entro 5 s: e\' l\'attesa senza fine misurata sul PC');
    assert.equal(r.esito, false,
      'un permesso che non risponde non e\' un permesso concesso: deve valere false');
    assert.ok(r.ms < r.tetto * 4,
      'e si conclude, non resta appesa: misurati ' + r.ms + ' ms su un tetto di ' + r.tetto + ' ms');
    assert.ok(r.chiamate.query >= 1, 'il permesso va pur chiesto almeno una volta');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la voce «Account» apre la sua sezione anche se la cartella non risponde', async () => {
  // Il sintomo esatto del proprietario: premeva «Account» e non si apriva niente.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (fonte) => {
      if (!supportsFS) return {salta: true};
      eval('(' + fonte + ')()');
      const $ = (id) => document.getElementById(id);
      $('generalSettingsBtn').click();
      $('genSettingsTabMt5').click();
      $('mt5ModeBtn').click();
      const menuAperto = $('mt5Menu').style.display === 'block';
      $('mt5MenuAccountBtn').click();
      // Si attende che la sezione compaia, con un tetto: se non compare entro il tetto il
      // pulsante e' muto, che e' il difetto.
      const t0 = performance.now();
      while (performance.now() - t0 < 5000) {
        if ($('mt5AccountSection').style.display === 'block') break;
        await new Promise(r => setTimeout(r, 50));
      }
      return {menuAperto, sezione: $('mt5AccountSection').style.display,
              ms: Math.round(performance.now() - t0), tetto: FBL_PERMESSO_TIMEOUT_MS};
    }, PREPARA.toString());
    if (r.salta) return;
    assert.equal(r.menuAperto, true, 'il menu MT5 si apre al primo click');
    assert.equal(r.sezione, 'block',
      'la sezione dei conti non si e\' aperta: il pulsante «Account» e\' rimasto muto');
    assert.ok(r.ms < r.tetto * 4,
      'e deve aprirsi senza aspettare la cartella: misurati ' + r.ms + ' ms su un tetto di ' + r.tetto + ' ms');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il riquadro delle credenziali si riempie, e dice «non lo so» invece di restare muto', async () => {
  // LE DUE STRADE RIMASTE NUDE, trovate dalla revisione e sistemate il 25 novembre 2026.
  // `fblCredStatoCartella` chiamava `queryPermission` senza tetto: nel WebView muto il riquadro
  // «Credenziali: collegata / da riconfermare» non si riempiva MAI e il pulsante «Ricollega»
  // non compariva. Stesso meccanismo dei due pulsanti MT5, in un posto diverso.
  // Il quarto stato conta: 'daRiconfermare' offrirebbe un pulsante che non puo' riuscire.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (fonte) => {
      if (!supportsFS) return {salta: true};
      eval('(' + fonte + ')()');
      const t0 = performance.now();
      const stato = await Promise.race([
        fblCredStatoCartella('mt5CredsDir'),
        new Promise(r => setTimeout(() => r('__APPESO__'), 6000))
      ]);
      // E il riquadro deve riempirsi davvero, senza offrire il pulsante.
      await Promise.race([fblCredCartellaAggiorna(), new Promise(r => setTimeout(r, 9000))]);
      const box = document.getElementById('fblCredCartellaStato');
      const b = document.getElementById('fblCredRicollega');
      return {stato, ms: Math.round(performance.now() - t0),
              // IL MARGINE SI PRENDE DALLA COSTANTE, non si inventa: scritto a mano a 4000 ms
              // questo test e' diventato rosso a 4515 ms soltanto perche' il collaudo gira
              // quattro browser in parallelo e i timer slittano. La proprieta' vera e' «si
              // conclude», non «si conclude in un tempo preciso».
              tetto: FBL_PERMESSO_TIMEOUT_MS,
              testo: box ? (box.textContent || '').trim() : 'manca',
              pulsante: b ? b.style.display : 'manca'};
    }, PREPARA.toString());
    if (r.salta) return;
    assert.notEqual(r.stato, '__APPESO__',
      'fblCredStatoCartella non si e\' conclusa: e\' la chiamata rimasta senza tetto');
    assert.equal(r.stato, 'nonSiSa',
      'con il permesso che non risponde lo stato e\' «non lo so», non «da riconfermare» (visto: ' + r.stato + ')');
    assert.ok(r.ms < r.tetto * 4,
      'e si conclude, non resta appesa: misurati ' + r.ms + ' ms su un tetto di ' + r.tetto + ' ms');
    assert.match(r.testo, /non risponde sul permesso/,
      'il riquadro deve dire com\'e\' invece di restare vuoto: ' + r.testo);
    assert.equal(r.pulsante, 'none',
      'e NON deve offrire «Ricollega la cartella», che in questo browser non puo\' riuscire');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la lettura silenziosa dei conti risponde «non lo so» invece di restare appesa', async () => {
  // `mt5ContiSenzaChiedere` ha per contratto tre risposte, e la terza e' null = «non lo so senza
  // chiedere». Con `queryPermission` nudo non riusciva a darla: restava appesa, e chi la aspettava
  // non arrivava mai a decidere. I suoi chiamanti sono tre punti diversi dell'app.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (fonte) => {
      if (!supportsFS) return {salta: true};
      eval('(' + fonte + ')()');
      const t0 = performance.now();
      const esito = await Promise.race([
        mt5ContiSenzaChiedere(),
        new Promise(r => setTimeout(() => r('__APPESO__'), 6000))
      ]);
      return {esito: esito === '__APPESO__' ? '__APPESO__' : (esito === null ? 'null' : JSON.stringify(esito)),
              ms: Math.round(performance.now() - t0), tetto: FBL_PERMESSO_TIMEOUT_MS};
    }, PREPARA.toString());
    if (r.salta) return;
    assert.notEqual(r.esito, '__APPESO__', 'mt5ContiSenzaChiedere non si e\' conclusa');
    assert.equal(r.esito, 'null',
      '«non lo so» e\' null, non un elenco vuoto: un elenco vuoto direbbe «sono sicuro che non ci sono conti» (visto: ' + r.esito + ')');
    assert.ok(r.ms < r.tetto * 4,
      'e si conclude, non resta appesa: misurati ' + r.ms + ' ms su un tetto di ' + r.tetto + ' ms');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la voce «Connetti» arriva alla finestra di login anche se la cartella non risponde', async () => {
  // L'altra meta' del sintomo: senza conti leggibili la strada giusta e' chiedere le credenziali,
  // non restare in attesa. Qui NON si chiama il ponte: senza conti salvati non c'e' niente da
  // provare, e il banco di prova non ha comunque accesso al ponte vero.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (fonte) => {
      if (!supportsFS) return {salta: true};
      eval('(' + fonte + ')()');
      const $ = (id) => document.getElementById(id);
      $('generalSettingsBtn').click();
      $('genSettingsTabMt5').click();
      $('mt5ModeBtn').click();
      $('mt5MenuDisconnectBtn').click();
      const t0 = performance.now();
      while (performance.now() - t0 < 5000) {
        if ($('mt5LoginModalOverlay').style.display !== 'none') break;
        await new Promise(r => setTimeout(r, 50));
      }
      return {modal: $('mt5LoginModalOverlay').style.display,
              ms: Math.round(performance.now() - t0), tetto: FBL_PERMESSO_TIMEOUT_MS};
    }, PREPARA.toString());
    if (r.salta) return;
    assert.notEqual(r.modal, 'none',
      'la finestra di login non si e\' aperta: «Connetti» e\' rimasto muto, come sul PC');
    assert.ok(r.ms < r.tetto * 4,
      'e deve aprirsi senza aspettare la cartella: misurati ' + r.ms + ' ms su un tetto di ' + r.tetto + ' ms');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
