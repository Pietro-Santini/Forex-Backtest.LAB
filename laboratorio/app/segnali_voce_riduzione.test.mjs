// QUANDO UN SEGNALE APRE MENO POSIZIONI DEL PREVISTO, DEVE DIRLO FORTE.
//
// RICHIESTO DAL PROPRIETARIO: «Dirlo forte: scheda del segnale, stato e pannello».
//
// MISURATO prima della cura (16 novembre 2026): un segnale con cinque take profit poteva aprire
// UNA sola posizione, in automatico e in SILENZIO. Il motivo esisteva già nel codice ma in tre
// posti diversi e nessuno lo mostrava dove il proprietario guarda:
//   - il tetto della sala (`maxN`) tagliava il piano senza scrivere niente da nessuna parte;
//   - la riduzione per lotto minimo scriveva `notaRidotte`, che in automatico finiva nel
//     riepilogo della conferma... che in automatico non viene mostrato a nessuno;
//   - l'unico messaggio auto-visibile scattava solo se il BROKER rifiutava, e finiva nella
//     scheda col prefisso «Non aperto in automatico» anche quando la posizione era stata aperta.
//
// COSA SI MISURA QUI (il percorso vero dell'apertura automatica, tgAutoValuta -> tgAutoApriQui
// -> tgEseguiSegnale, conto simulato):
//  1. CONTROLLO: 5 take profit con spazio sotto i tetti → 5 posizioni, e NESSUN avviso (se il
//     motivo comparisse anche qui sarebbe un falso allarme);
//  2. tetto della sala pieno, posto per 1 → 1 posizione, e il motivo dice «tetto» coi numeri
//     (5 previste, 1 aperta), nella scheda del segnale, nella barra di stato e nel testo del
//     piano; nella scheda NON deve comparire «Non aperto in automatico» (la posizione c'è);
//  3. rischio della sala troppo piccolo per i lotti minimi → k posizioni, stesso racconto;
//  4. tutti i take profit già superati dal prezzo → la strada scelta: NON apre niente, e lo dice.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Oro a 4090, segnale SELL con cinque take profit, conto simulato: lo stesso segnale usato dal
// banco segnali_piu_posizioni, così le due misure sono confrontabili.
const SEGNALE = {
  strumento:'XAUUSD', direzione:'SELL', entrata:4090, stop_loss:4100,
  take_profit:[4078,4067,4063,4060,4057]
};

const PREPARA = () => {
  const R = [];
  const t0 = Date.now() - 200 * 60000;
  for (let i = 0; i < 200; i++) {
    const p = 4090;
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: p, high: p + 1, low: p - 1,
            close: p, volume: 5});
  }
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  currentAssetKey = 'XAUUSD';
  if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'XAUUSD';
  liveModeActive = true; mt5Connected = false;
  positions = []; pendingOrders = []; trades = [];
  tgStrategie = {}; tgSegnaliRicevuti = [];
  return 'pronto';
};

// Il segnale SELL coi take profit TUTTI già passati: sopra l'entrata, dalla parte sbagliata.
// Il prezzo di adesso è 4090 e i target stanno sopra: aprirli vorrebbe dire nascere già oltre
// l'obiettivo di ognuno.
const SEGNALE_SCADUTO = {
  strumento:'XAUUSD', direzione:'SELL', entrata:4090, stop_loss:4100,
  take_profit:[4095,4098,4102,4106,4110]
};

// Il percorso completo dell'apertura automatica. `cfg` è la configurazione della sala (tetti e
// rischio); `segnale` permette di cambiare segnale fra una prova e l'altra.
const AUTO = (cfg, segnale) => `(async function(){
  const cfg = ${JSON.stringify(cfg)};
  const segnale = ${JSON.stringify(segnale)};
  window.__voce = {id:7, chat:'Sala A', sala:'@a', stato:'nuovo', ricevuto_ms:Date.now(),
    segnale: segnale};
  const voce = window.__voce;
  tgSegnaliRicevuti.push(voce);
  window.__piano = null;
  const _esegui = tgEseguiSegnale;
  tgEseguiSegnale = async function(v, o){
    if (o && o.piano) window.__piano = o.piano;
    return _esegui.apply(this, arguments);
  };
  window.__fxBackup = JSON.parse(JSON.stringify(tgAutoFx));
  tgAutoFx = tgAutoDaSalvato(cfg);
  consensoValido = () => true;          // il consenso ai rischi è già stato dato dall'utente
  await tgAutoValuta(voce, 'sim');
  tgEseguiSegnale = _esegui;
  tgAutoFx = window.__fxBackup;
  tgRenderPannello();
  const p = window.__piano;
  return {
    posizioni: positions.length,
    motivo: voce.autoMotivo || null,
    stato: ($('status') && $('status').textContent) || '',
    piano: p ? {n: p.n, tp: p.tp, problemi: p.problemi || [], nota: p.motivoPosizioni || null,
                importoTot: p.importoTot, lotti: p.lotti,
                notaRidotte: p.notaRidotte || null} : null,
    scheda: ($('tgPanelBody') && $('tgPanelBody').textContent) || '',
    aperta: voce.stato,
    aperteN: voce.aperte || 0,
  };
})()`;

// La configurazione della famiglia Forex con la sala spuntata: `maxPosizioni` è il tetto della
// sala, `rischio` la sua percentuale, `maxGlobali` il tetto complessivo.
const CFG = (maxPosizioni, rischio) => ({attivo:true, rischio:rischio, maxGlobali:40,
  perditaAttiva:false,
  sale:{'Sala A':{attivo:true, rischio:rischio, maxPosizioni:maxPosizioni, quote:[], regole:[],
                  avvicinamento:0}}});

test('CONTROLLO: 5 take profit con spazio sotto i tetti → 5 posizioni, e nessun avviso', async () => {
  // Senza questa, un motivo che comparisse sempre non dimostrerebbe niente: qui deve tacere.
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      return eval('(' + d.mis + ')');
    }, {prep: PREPARA.toString(), mis: AUTO(CFG(6, 1), SEGNALE)});
    console.log('controllo:', JSON.stringify(r));
    assert.equal(r.posizioni, 5,
      'col posto sotto i tetti le cinque posizioni si devono aprire tutte: ' + JSON.stringify(r));
    assert.equal(r.piano.n, 5, 'il piano deve dire 5 posizioni');
    assert.equal(r.motivo, null,
      'e non deve cucinarsi nessun motivo: ' + JSON.stringify(r.motivo));
    assert.equal(r.piano.nota, null, 'il piano non deve avere riduzioni da raccontare');
    assert.equal(r.aperta, 'eseguito', 'la voce deve risultare eseguita');
    // La riga in testa al pannello NON deve comparire: questo segnale è completo.
    assert.equal(r.scheda.indexOf('Ultimo segnale aperto con meno posizioni del previsto'), -1,
      'a posto fatto, la riga di allarme non deve restare: ' + r.scheda.slice(0, 300));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('tetto della sala pieno, posto per 1 → 1 posizione, e il motivo lo dice nella scheda e nello stato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      return eval('(' + d.mis + ')');
    }, {prep: PREPARA.toString(), mis: AUTO(CFG(1, 1), SEGNALE)});
    console.log('tetto:', JSON.stringify(r));
    assert.equal(r.posizioni, 1, 'col tetto pieno si apre una posizione sola: ' + JSON.stringify(r));
    // --- il motivo esiste, UNA volta sola, dentro il piano ---
    assert.ok(r.piano.nota && r.piano.nota.length,
      'il piano deve portare il motivo della riduzione: ' + JSON.stringify(r.piano));
    assert.match(r.piano.nota, /tetto/,
      'il motivo deve dire che il taglio viene dal tetto della sala: ' + r.piano.nota);
    assert.ok(r.piano.nota.indexOf('5') !== -1 && r.piano.nota.indexOf('1') !== -1,
      'e deve portare i numeri: quante posizioni erano previste (5) e quante se ne aprono (1): '
      + r.piano.nota);
    // --- lo stesso motivo esce dove il proprietario guarda ---
    assert.ok(r.motivo && /tetto/.test(r.motivo),
      'la scheda del segnale deve avere il motivo: ' + r.motivo);
    assert.ok(r.stato.indexOf('tetto') !== -1,
      'e anche la barra di stato: ' + r.stato);
    // --- il prefisto sbagliato non deve comparire su una posizione APERTA ---
    assert.ok(r.scheda.indexOf('Non aperto in automatico') === -1,
      'la posizione è stata aperta: la scheda non può dire il contrario. Testo trovato: ' + r.scheda);
    // La riga in testa al PANNELLO: il terzo posto richiesto («scheda, stato e pannello»).
    assert.ok(r.scheda.indexOf('Ultimo segnale aperto con meno posizioni del previsto') !== -1,
      'il pannello deve dirlo in testa, non solo nella scheda del segnale: ' + r.scheda.slice(0, 300));
    assert.ok(/Ultimo segnale aperto con meno posizioni del previsto:[^]*tetto/.test(r.scheda),
      'e la riga in testa deve portare lo stesso motivo della scheda: ' + r.scheda.slice(0, 300));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('rischio della sala troppo piccolo per i lotti minimi → k posizioni, col motivo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      // Saldo piccolo (5.000) e rischio della sala 0,4%: il rischio scelto basta per pochissime
      // posizioni al lotto minimo, non per tutte e cinque.
      realizedBalanceNow = () => 5000;
      return eval('(' + d.mis + ')');
    }, {prep: PREPARA.toString(), mis: AUTO(CFG(6, 0.4), SEGNALE)});
    console.log('rischio:', JSON.stringify(r));
    assert.ok(r.posizioni >= 1 && r.posizioni < 5,
      'il rischio della sala deve ridurre le posizioni a quelle che ci stanno davvero: '
      + JSON.stringify(r));
    assert.ok(r.motivo && /minimo|rischio/.test(r.motivo),
      'il motivo deve dire che il taglio viene dal lotto minimo: ' + r.motivo);
    assert.match(r.motivo, /5/);
    assert.ok(r.stato.indexOf('minimo') !== -1 || r.stato.indexOf('rischio') !== -1,
      'anche la barra di stato deve dirlo: ' + r.stato);
    assert.ok(r.scheda.indexOf('Non aperto in automatico') === -1,
      'e il prefisso sbagliato non deve comparire: ' + r.scheda);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('tutti i take profit già superati dal prezzo → non apre, e lo dice', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      return eval('(' + d.mis + ')');
    }, {prep: PREPARA.toString(), mis: AUTO(CFG(6, 1), SEGNALE_SCADUTO)});
    console.log('scaduto:', JSON.stringify(r));
    assert.equal(r.posizioni, 0,
      'con tutti i take profit già superati dal prezzo non si deve aprire niente: '
      + JSON.stringify(r));
    assert.ok(r.motivo && /take profit/.test(r.motivo) && /superat|passat/i.test(r.motivo),
      'il motivo deve dire che i take profit sono già stati superati: ' + r.motivo);
    assert.ok(r.scheda.indexOf('Non aperto in automatico') !== -1,
      'qui il prefisso «Non aperto in automatico» è quello giusto: non è stata aperta niente. '
      + 'Testo trovato: ' + r.scheda);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il popup manuale dal pannello mostra lo stesso motivo dei take profit scartati', async () => {
  // Il secondo posto dove il proprietario guarda: la finestra «Configura le posizioni del
  // segnale», aperta dal pannello col tasto del segnale. Qui il tetto della sala non passa, ma i
  // take profit già superati dal prezzo capitano, e prima si leggeva solo «il prezzo ha già
  // superato N take profit» senza dire quante posizioni si aprono davvero.
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      // Il segnale SELL col PRIMO take profit (4095) già sopra il prezzo: scartato.
      const SEGNALE = {strumento:'XAUUSD', direzione:'SELL', entrata:4090, stop_loss:4100,
        take_profit:[4095,4078,4067,4063,4060]};
      const voce = {id:9, chat:'Sala A', sala:'@a', stato:'nuovo', ricevuto_ms:Date.now(),
        segnale:SEGNALE};
      tgSegnaliRicevuti.push(voce);
      window.appConfirm = async () => true;
      appConfirm = window.appConfirm;
      await tgApriConfigurazione(voce);
      const piano = tgCfgPiano();
      tgCfgDisegna();
      const testo = ($('tgConfigOverlay') && $('tgConfigOverlay').textContent) || '';
      return {piano: {n: piano.n, tp: piano.tp, motivo: piano.motivoPosizioni || null},
        testo: testo};
    }, {prep: PREPARA.toString()});
    console.log('popup manuale:', JSON.stringify(r));
    assert.ok(r.piano.motivo && r.piano.motivo.indexOf('superat') !== -1,
      'il piano del popup deve avere il motivo dei take profit scartati: ' + r.piano.motivo);
    assert.ok(r.testo.indexOf(r.piano.motivo) !== -1,
      'e il popup deve MOSTRARLO (è lo stesso testo unico della scheda del segnale). '
      + 'Testo trovato: ' + r.testo.slice(0, 600));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});