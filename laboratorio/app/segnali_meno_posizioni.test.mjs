// QUANTE POSIZIONI APRE DAVVERO UN SEGNALE, E PERCHE' NON DI PIU'.
//
// SEGNALATO dal proprietario (16 novembre 2026): «Dirlo forte: scheda del segnale, stato e
// pannello». Il numero di posizioni per segnale si decide in UN punto solo (tgPiano), con tre
// riduzioni volute e giuste — i tetti della sala, il rischio della sala, i take profit che il
// prezzo ha gia' superato. Quello che manca e' la VOCE: oggi nessuna di quelle tre riduzioni
// lascia una riga leggibile, e in automatico il riepilogo addirittura si costruisce e si butta
// via. Misurato prima di scrivere questo banco:
//   - tetto della sala a 1 su un segnale da 5 take profit -> 1 posizione, NESSUN messaggio
//     (tgPiano 43854 taglia e zitto); l'unico avviso che resta (44178) scatta solo se il broker
//     rifiuta, non quando il piano e' gia' tagliato;
//   - rischio della sala che non basta -> k posizioni con `notaRidotte`, che pero' nell'apertura
//     AUTOMATICA non esce da nessuna parte (r viene costruito e buttato via a 44045);
//   - take profit TUTTI già superati dal prezzo -> tp=[] e n=max(1,0)=1: apre UNA posizione senza
//     nessun target, solo con lo stop, e l'interruttore «apri senza target» non lo impedisce
//     perche' 43839 guarda `!tutti.length` e non `!tp.length`.
//
// Questo banco misura il COMPORTAMENTO (quante posizioni, cosa resta in voce.autoMotivo, cosa
// c'e' scritto nella scheda e nella barra di stato), non il testo del sorgente.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Oro a 4090, segnale SELL con CINQUE take profit (lo stesso dello screenshot del proprietario).
const SEGNALE = {
  strumento:'XAUUSD', direzione:'SELL', entrata:4090, stop_loss:4100,
  take_profit:[4078,4067,4063,4060,4057]
};

// La preparazione: candele di XAUUSD a 4090, conto simulato, niente MT5.
const PREPARA = () => {
  const t0 = Date.now() - 200 * 60000;
  const R = [];
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
  // Le finestre di conferma rispondono sempre di si': qui si misura il piano, non la prudenza
  // di chi conferma.
  window.appConfirm = async () => true; appConfirm = window.appConfirm;
  window.appAlert = async () => true; appAlert = window.appAlert;
  return 'pronto';
};

// Il segnale dentro la pagina, come lo trova l'app.
const VOCE = () => ({id:1, chat:'Sala A', sala:'@a', stato:'nuovo', ricevuto_ms:Date.now(),
  segnale:{strumento:'XAUUSD', direzione:'SELL', entrata:4090, stop_loss:4100,
           take_profit:[4078,4067,4063,4060,4057]}});

// LA CONFIGURAZIONE DELLA SALA, dentro la pagina. page.evaluate porta con s� UNA sola
// stringa: gli aiutanti si passano quindi come testo, come fanno gli altri banchi.
// `maxPosizioni` � il rubinetto delle prove sul tetto della sala.

// ---------------------------------------------------------------------------
// PROVA DI CONTROLLO. Senza di essa tutte le altre sono mute: se il caso normale
// non producesse cinque posizioni, "ne apre una" non significherebbe niente.
// ---------------------------------------------------------------------------
test('controllo: 5 take profit e spazio sotto i tetti -> 5 posizioni, e nessun motivo di riduzione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      const voce = eval('(' + d.voce + ')')();
      tgSegnaliRicevuti.push(voce);
      const piano = tgPiano(voce.segnale, 'XAUUSD', 1, {prezzo: 4090});
      await tgEseguiSegnale(voce, {sym:'XAUUSD', piano});
      return {n: piano.n, tp: piano.tp, problemi: piano.problemi || [],
              aperte: positions.length, tps: positions.map(p => p.tp),
              motivo: piano.motivoPosizioni || null};
    }, {prep: PREPARA.toString(), voce: VOCE.toString()});
    assert.equal(r.n, 5, 'il piano deve avere una posizione per ognuno dei 5 take profit');
    assert.equal(r.aperte, 5, 'devono nascere 5 posizioni, non ' + r.aperte);
    assert.equal(r.tps.filter(t => t > 0).length, 5, 'ogni posizione porta il suo take profit');
    assert.equal(r.motivo, null, 'nel caso normale non c\'e\' nessuna riduzione da raccontare');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------------------
// IL TETTO DELLA SALA. Il piano viene tagliato a 1 posizione e finisce qui, in
// silenzio (misurato: 43854 `tp=tp.slice(0,maxN)`, nessun messaggio). Il numero
// NON cambia — il tetto e' una scelta giusta — quello che manca e' la voce.
// ---------------------------------------------------------------------------
test('tetto della sala pieno: 1 posizione su 5 previste, e il motivo lo dicono scheda e barra di stato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      const voce = eval('(' + d.voce + ')')();
      tgSegnaliRicevuti.push(voce);
      // La sala pu� aprire UNA sola posizione (tetto pieno): il segnale ne ha cinque.
      window.__backup = JSON.parse(JSON.stringify(tgAutoFx));
      tgAutoFx = tgAutoDaSalvato({attivo:true, rischio:1, maxGlobali:40, perditaAttiva:false,
        sale:{'Sala A':{attivo:true, rischio:1, maxPosizioni:1, quote:[], regole:[], avvicinamento:0}}});
      consensoValido = () => true;
      await tgAutoValuta(voce, 'sim');
      tgAutoFx = window.__backup;
      tgRenderPannello();
      const schede = [...document.querySelectorAll('#tgPanelBody .tgCardAvviso')].map(e => e.textContent);
      return {
        aperte: positions.length,
        motivo: voce.autoMotivo || null,
        stato: $('status').textContent,
        schede,
        pianiN: voce.eseguito ? voce.eseguito.tp.length : null
      };
    }, {prep: PREPARA.toString(), voce: VOCE.toString()});
    assert.equal(r.aperte, 1,
      'col tetto della sala a 1 deve aprirsi UNA posizione: aperte ' + r.aperte);
    assert.match(String(r.motivo), /tetto/i,
      'il motivo deve dire che il taglio viene dal tetto: ' + r.motivo);
    assert.match(String(r.motivo), /5/,
      'il motivo deve dire quante posizioni erano previste (5): ' + r.motivo);
    assert.ok(r.schede.some(t => /tetto/i.test(t)),
      'la scheda del segnale nel pannello deve riportare il motivo: ' + JSON.stringify(r.schede));
    assert.match(String(r.stato), /tetto/i,
      'anche la barra di stato deve dirlo: ' + r.stato);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------------------
// IL PREFISSO SBAGLIATO. Su una posizione APERTA la scheda scriveva
// «⚡ Non aperto in automatico»: il contrario di quello che e' successo.
// ---------------------------------------------------------------------------
test('su una posizione aperta in automatico non compare «Non aperto in automatico»', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      const voce = eval('(' + d.voce + ')')();
      tgSegnaliRicevuti.push(voce);
      // La sala pu� aprire UNA sola posizione (tetto pieno): il segnale ne ha cinque.
      window.__backup = JSON.parse(JSON.stringify(tgAutoFx));
      tgAutoFx = tgAutoDaSalvato({attivo:true, rischio:1, maxGlobali:40, perditaAttiva:false,
        sale:{'Sala A':{attivo:true, rischio:1, maxPosizioni:1, quote:[], regole:[], avvicinamento:0}}});
      consensoValido = () => true;
      await tgAutoValuta(voce, 'sim');
      tgAutoFx = window.__backup;
      tgRenderPannello();
      return {
        aperte: positions.length,
        schede: [...document.querySelectorAll('#tgPanelBody .tgCardAvviso')].map(e => e.textContent),
        stato: $('status').textContent
      };
    }, {prep: PREPARA.toString(), voce: VOCE.toString()});
    assert.equal(r.aperte, 1, 'la posizione deve risultare aperta, sennò la prova è muta');
    // La scheda DEVE dire qualcosa (la cura), e quello che dice non deve essere il
    // contrario della verita'. La prima asserisce è quella che rende la prova non
    // muta: senza cura la scheda resta vuota e qui cade.
    assert.ok(r.schede.length > 0,
      'la scheda deve raccontare la riduzione, non restare muta: ' + JSON.stringify(r.schede));
    for (const t of r.schede) {
      assert.ok(!/Non aperto in automatico/i.test(t),
        'la scheda dice il contrario di quello che è successo: ' + t);
    }
    assert.ok(!/Non aperto in automatico/i.test(String(r.stato)),
      'la barra di stato dice il contrario di quello che è successo: ' + r.stato);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------------------
// IL RISCHIO DELLA SALA CHE NON BASTA. Con 2.000 di saldo e l'1% di rischio
// (misurato: 20 €, e un lotto minimo su questo stop ne rischia 10) restano 2
// posizioni sulle 5 dichiarate. Oggi il motivo esiste (`notaRidotte`) ma non
// esce da nessuna parte nell'apertura automatica.
// ---------------------------------------------------------------------------
test('rischio della sala insufficiente: k posizioni su 5, e il motivo dice quanti take profit erano dichiarati', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      const voce = eval('(' + d.voce + ')')();
      const piano = tgPiano(voce.segnale, 'XAUUSD', 1,
        {prezzo: 4090, maxN: 5, entroRischio: true, saldo: 2000});
      return {n: piano.n, tp: piano.tp, problemi: piano.problemi || [],
              motivo: piano.motivoPosizioni || null, notaRidotte: piano.notaRidotte || null};
    }, {prep: PREPARA.toString(), voce: VOCE.toString()});
    assert.equal(r.n, 2, 'con quel saldo devono restare 2 posizioni, non ' + r.n);
    assert.match(String(r.motivo), /5/, 'il motivo deve dire i 5 take profit dichiarati: ' + r.motivo);
    assert.match(String(r.motivo), /2/, 'il motivo deve dire le 2 posizioni aperte: ' + r.motivo);
    assert.match(String(r.motivo), /rischio|lot|minimo/i,
      'il motivo deve dire perche\' (il rischio non basta per i lotti minimi): ' + r.motivo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------------------
// IL CASO LIMITE, misurato prima di scrivere il banco: take profit TUTTI già
// superati dal prezzo -> oggi tp=[] e n=max(1,0)=1, quindi si apre UNA
// posizione senza nessun target, solo con lo stop, e l'interruttore «apri
// senza target» non lo impedisce. Il segnale non ha piu' nessun obiettivo:
//questa prova fissa la strada scelta (NON apre, e lo dice).
// ---------------------------------------------------------------------------
test('tutti i take profit già superati: non apre una posizione senza target, e lo dice', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      const voce = eval('(' + d.voce + ')')();
      // Gli stessi cinque take profit, ma dalla parte SBAGLIA di un SELL: il prezzo
      // (4090) li ha già passati tutti.
      voce.segnale.take_profit = [4095, 4100, 4105, 4110, 4115];
      const piano = tgPiano(voce.segnale, 'XAUUSD', 1, {prezzo: 4090});
      await tgEseguiSegnale(voce, {sym:'XAUUSD', piano});
      return {problemi: piano.problemi || [], n: piano.n, tp: piano.tp,
              aperte: positions.length, stato: voce.stato,
              autoAperte: positions.filter(p => p.tp == null).length};
    }, {prep: PREPARA.toString(), voce: VOCE.toString()});
    assert.equal(r.aperte, 0,
      'con tutti i take profit già superati non si deve aprire una posizione muta: aperte ' + r.aperte);
    assert.equal(r.autoAperte, 0,
      'nessuna posizione deve nascere senza take profit: ' + r.autoAperte);
    assert.ok(r.problemi.length > 0,
      'il rifiuto va DETTO, non lasciato capire: ' + JSON.stringify(r.problemi));
    assert.match(String(r.problemi.join(' ')), /take profit|target/i,
      'il rifiuto deve parlare di take profit: ' + r.problemi.join(' '));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('tutti i take profit già superati, in automatico: il motivo finisce nella scheda', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      const voce = eval('(' + d.voce + ')')();
      voce.segnale.take_profit = [4095, 4100, 4105, 4110, 4115];
      tgSegnaliRicevuti.push(voce);
      // Qui il tetto lascia posto a tutte e sei: la riduzione non deve arrivare da lui.
      window.__backup = JSON.parse(JSON.stringify(tgAutoFx));
      tgAutoFx = tgAutoDaSalvato({attivo:true, rischio:1, maxGlobali:40, perditaAttiva:false,
        sale:{'Sala A':{attivo:true, rischio:1, maxPosizioni:6, quote:[], regole:[], avvicinamento:0}}});
      consensoValido = () => true;
      await tgAutoValuta(voce, 'sim');
      tgAutoFx = window.__backup;
      tgRenderPannello();
      return {
        aperte: positions.length,
        motivo: voce.autoMotivo || null,
        schede: [...document.querySelectorAll('#tgPanelBody .tgCardAvviso')].map(e => e.textContent)
      };
    }, {prep: PREPARA.toString(), voce: VOCE.toString()});
    assert.equal(r.aperte, 0, 'non deve aprirsi niente: aperte ' + r.aperte);
    assert.match(String(r.motivo), /take profit/i,
      'il motivo nella scheda deve dire che i take profit sono già passati: ' + r.motivo);
    assert.ok(r.schede.some(t => /take profit/i.test(t)),
      'la scheda del pannello deve riportarlo: ' + JSON.stringify(r.schede));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------------------
// IL POPUP MANUALE. Oggi `notaRidotte` non passa da questa strada (nel popup
// non si passa né maxN né entroRischio), ma le altre due riduzioni — take
// profit fuori scala e già superati — capitano lo stesso, e il riepilogo del
// popup le deve raccontare.
// ---------------------------------------------------------------------------
test('popup manuale: con 5 take profit di cui 2 fuori scala dice quante posizioni apre davvero', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      const voce = eval('(' + d.voce + ')')();
      // 5 target dichiarati, 2 dei quali non sono prezzi sensati (oltre il 20% dal mercato).
      // 5 take profit dichiarati, 2 dei quali sono prezzi impossibili per questo strumento:
      // oltre il 20% dal mercato (4090), quindi "fuori scala" per tgPiano. Restano 3 validi.
      voce.segnale.take_profit = [4078, 4067, 4057, 3200, 3100];
      tgCfg = {voce, sym:'XAUUSD', side:'SELL', sl:4100, entry:4090, pct:1,
        righe:[4078,4067,4057,3200,3100].map(tp=>({tp, attivo:true})),
        regole:['','','','',''],
        avvicinamento:{attivo:false, pct:70}, bePip:{attivo:false, pip:10}};
      const piano = tgCfgPiano();
      tgCfgDisegna();
      const testo = $('tgConfigRiepilogo').textContent;
      tgCfg = null;
      return {n: piano.n, tp: piano.tp, problemi: piano.problemi || [],
              motivo: piano.motivoPosizioni || null, testo};
    }, {prep: PREPARA.toString(), voce: VOCE.toString()});
    assert.equal(r.n, 3, 'devono restare 3 posizioni valide, non ' + r.n);
    assert.match(String(r.motivo), /5/, 'il motivo deve dire i 5 take profit dichiarati: ' + r.motivo);
    assert.match(String(r.motivo), /3/, 'il motivo deve dire le 3 posizioni: ' + r.motivo);
    assert.match(String(r.testo), /5/, 'il riepilogo del popup deve dire i 5 previsti: ' + r.testo);
    assert.match(String(r.testo), /3 posizioni/, 'il riepilogo del popup deve dire le 3 aperte: ' + r.testo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ---------------------------------------------------------------------------
// LA BARRA DEL TEMPO (richiesta dello stesso giro: «dopo l'ultima candela
// bisogna continuare a far vedere l'orario... il tempo è infinito»). Lo spazio
// vuoto oltre l'ultima candela esiste già (getViewWindow); quello che manca
// sono le TACCHE con cui leggerlo, e senza quelle non si vede l'allineamento
// con le notizie. Qui si contano le tacche e i loro valori, non una stringa
// nel sorgente.
// ---------------------------------------------------------------------------
const ASSE_PREPARA = () => {
  const t0 = Date.now() - 150 * 60000;
  const R = [];
  for (let i = 0; i < 150; i++) {
    const p = 4090;
    R.push({date: new Date(t0 + i * 60000).toISOString(), open: p, high: p + 1, low: p - 1,
            close: p, volume: 5});
  }
  rows = R; baseRows = R; idx = R.length - 1;
  currentAssetKey = 'XAUUSD';
  if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'XAUUSD';
  liveModeActive = true; mt5Connected = false; liveReplayActive = false;
  positions = []; pendingOrders = []; trades = [];
  visibleCount = 80;
  return 'pronto';
};

// Misura le tacche dell'asse con `minuti` come time frame e `extra` slot di spazio
// vuoto richiesti oltre l'ultima candela (il grafico si può scorrere a mano anche
// nello spazio dopo l'ultima candela: maxViewEnd lo permette).
// `xDaTempo` è la x che il disegno delle CANDELE assegna a quell'orario
// (chartGeometry): se una tacca delle candele esistenti si fosse spostata per far
// posto a quella di dopo, le due misure si separerebbero.
const ASSE_MISURA = (minuti, extra) => {
  currentTF = minuti;
  viewEnd = rows.length + extra;
  followLatest = false;
  timeTicks = [];
  draw();
  const g = chartGeometry();
  const ultima = Date.parse(rows[rows.length - 1].date);
  const xUltima = g.xFromTime(ultima);
  return {
    quanti: timeTicks.length,
    t: timeTicks.map(k => k.t),
    x: timeTicks.map(k => k.x),
    xDaTempo: timeTicks.map(k => g.xFromTime(k.t)),
    xUltima,
    ultimaCandela: ultima,
    passoAtteso: minuti * 60000
  };
};

test('M1: l\'asse del tempo continua DOPO l\'ultima candela, a passi di un minuto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      return eval('(' + d.mis + ')')(1, 25);
    }, {prep: ASSE_PREPARA.toString(), mis: ASSE_MISURA.toString()});
    assert.ok(r.quanti > 1, 'l\'asse deve avere delle tacche: ' + r.quanti);
    const ultimaT = r.t[r.t.length - 1];
    assert.ok(ultimaT > r.ultimaCandela,
      'l\'ultima tacca deve stare DOPO l\'ultima candela: ' + ultimaT + ' contro ' + r.ultimaCandela);
    assert.ok(r.x[r.x.length - 1] > r.xUltima,
      'l\'ultima tacca deve essere disegnata oltre l\'ultima candela: ' + r.x[r.x.length - 1]
      + ' contro ' + r.xUltima);
    const passi = r.t.slice(1).map((v, i) => v - r.t[i]);
    assert.equal(passi[passi.length - 1], r.passoAtteso,
      'il passo fra le ultime due tacche deve essere quello del time frame (M1 = 60 s): '
      + passi[passi.length - 1]);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('M5: l\'asse continua dopo l\'ultima candela a passi di cinque minuti', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      return eval('(' + d.mis + ')')(5, 25);
    }, {prep: ASSE_PREPARA.toString(), mis: ASSE_MISURA.toString()});
    const ultimaT = r.t[r.t.length - 1];
    assert.ok(ultimaT > r.ultimaCandela, 'l\'ultima tacca deve essere dopo l\'ultima candela');
    assert.ok(r.x[r.x.length - 1] > r.xUltima, 'e disegnata oltre l\'ultima candela');
    const passi = r.t.slice(1).map((v, i) => v - r.t[i]);
    assert.equal(passi[passi.length - 1], r.passoAtteso,
      'il passo deve essere quello del time frame (M5 = 300 s): ' + passi[passi.length - 1]);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le tacche delle candele esistenti non si spostano per far posto a quella di dopo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (d) => {
      eval('(' + d.prep + ')')();
      return eval('(' + d.mis + ')')(1, 25);
    }, {prep: ASSE_PREPARA.toString(), mis: ASSE_MISURA.toString()});
    const dentro = r.t.map((t, i) => ({t, x: r.x[i], xDaTempo: r.xDaTempo[i]}))
      .filter(k => k.t <= r.ultimaCandela);
    const fuori = r.t.map((t, i) => ({t, x: r.x[i]}))
      .filter(k => k.t > r.ultimaCandela);
    assert.ok(dentro.length >= 2, 'servono almeno due tacche sulle candele esistenti: ' + dentro.length);
    assert.ok(fuori.length >= 2, 'servono almeno due tacche oltre l\'ultima candela: ' + fuori.length);
    // 1. le tacche di prima restano dove il disegno delle candele le mette
    for (const k of dentro) {
      assert.ok(Math.abs(k.x - k.xDaTempo) < 1e-6,
        'una tacca delle candele esistenti si è spostata: ' + k.t + ' sta a ' + k.x
        + ' invece di ' + k.xDaTempo);
    }
    // 2. le tacche di dopo sono in ordine, spaziate di un passo di time frame
    for (let i = 1; i < fuori.length; i++) {
      assert.equal(fuori[i].t - fuori[i - 1].t, r.passoAtteso,
        'il passo fra le tacche oltre l\'ultima candela deve essere quello del time frame: '
        + (fuori[i].t - fuori[i - 1].t));
      assert.ok(fuori[i].x > fuori[i - 1].x, 'le tacche di dopo devono avanzare');
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});