// DENTRO LE DUE SEZIONI CARE: QUALE DISEGNO E QUALE INDICATORE COSTA.
//
// PERCHÉ ESISTE. Il 5 novembre 2026 il proprietario ha incollato il suo pannello di diagnosi:
// `disegnoMedio_ms 54.57`, `fotogrammiAlSecondo 14`, `candele 51172`, e dentro il disegno
// `sezioniDelDisegno_ms disegniUtente=27.1 indicatori=23.74` — 50,8 ms su 54,55, il 93%.
// Lì la misura si fermava: due numeri grossi, e nessun modo di sapere su cosa mettere le mani.
// Dentro `disegniUtente` ci sono disegni di tipi diversi (e la costruzione dei profili VP, che
// non è un disegno dell'utente ma vive nella stessa sezione), dentro `indicatori` ce ne sono N,
// ognuno col suo calcolo e il suo disegno.
//
// Lo strumento non cura niente: serve a non ottimizzare a occhio. È la lezione del 4 novembre,
// pagata due volte sullo stesso indicatore.
//
// QUESTE PROVE non misurano la VELOCITÀ (sarebbe un numero che cambia da macchina a macchina e
// renderebbe il test inaffidabile): misurano che lo strumento **riempie il dettaglio** e che i
// suoi numeri **stanno dentro** quelli della sezione che li contiene. Un contatore che resta a
// zero sarebbe peggio di nessun contatore: direbbe «nessun problema qui».
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Banco: candele vere, tre disegni di tipi diversi (uno dei quali un profilo, che è il pezzo
// caro), un indicatore acceso. Si disegna più volte perché i numeri sono somme.
const MISURA = (cronometro) => `(function(){
  const t0=Date.UTC(2026,9,20,8,0,0); const R=[]; let p=1900;
  for(let i=0;i<700;i++){ p+=(Math.sin(i/13)+Math.cos(i/7))*0.3;
    R.push({date:new Date(t0+i*60000).toISOString(),open:p,high:p+0.8,low:p-0.8,close:p+0.1,volume:10+(i%7)}); }
  csvLibrary=[{name:'t',rows:R}]; rebuildBaseRowsFromLibrary();
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD'; liveModeActive=false; liveReplayActive=false;
  currentTF=1; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
  viewEnd=rows.length-1; idx=rows.length-1; visibleCount=120;
  autoFitWidth=false; followLatest=false;

  const a=rows.length-300, b=rows.length-1;
  const tempo=j=>parseDateTime(rows[j].date);
  drawings=[
    {id:'t1',type:'trendline',p1:{time:tempo(a),price:rows[a].close},p2:{time:tempo(b),price:rows[b].close}},
    {id:'r1',type:'rectangle',p1:{time:tempo(a),price:rows[a].low},p2:{time:tempo(b),price:rows[b].high}},
    {id:'v1',type:'vpfixed',p1:{time:tempo(a),price:rows[a].close},p2:{time:tempo(b),price:rows[b].close},
     buckets:120,barSizePct:500,upColor:'#2fbf71',downColor:'#e05252',_vpIndBars:true,
     bgEnabled:false,lvnEnabled:false,pocEnabled:false,vahEnabled:false,valEnabled:false,extendRight:false}
  ];
  selectedDrawing=null; pendingDrawing=null;
  activeIndicators.length=0;
  addIndicator('volume_default');

  fblCronoSezioni=${cronometro};
  fblSezioniDraw={}; fblSezioniDettaglio={};
  draw(); draw(); draw(); draw(); draw();
  fblCronoSezioni=false;
  return {
    dettaglio:Object.assign({},fblSezioniDettaglio),
    sezioni:Object.assign({},fblSezioniDraw),
    indicatoriAccesi:activeIndicators.length,
    disegni:drawings.length
  };
})()`;

// I nomi che contengono '>' sono ANNIDATI: stanno dentro un altro numero della stessa lista
// (per esempio `disegno:vpfixed>calcolo` dentro `disegno:vpfixed`). Sommarli col genitore darebbe
// un totale piu' grande del disegno intero, quindi la somma li salta — come fa il rapporto.
const somma = (o, prefisso) => Object.keys(o)
  .filter(k => k.startsWith(prefisso) && !k.includes('>'))
  .reduce((s, k) => s + o[k], 0);

test('il dettaglio dice quale disegno e quale indicatore costa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(MISURA(true));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');

    // Controllo del banco PRIMA di tutto: se non si fosse disegnato niente, ogni asserzione
    // sotto sarebbe vera per il motivo sbagliato — è l'errore del 22 ottobre (una misura col
    // grafico vuoto che sembrava dire «va tutto bene»).
    assert.equal(r.disegni, 3, 'il banco deve avere tre disegni');
    assert.equal(r.indicatoriAccesi, 1, 'il banco deve avere un indicatore acceso');
    assert.ok(r.sezioni.disegniUtente > 0,
      'la sezione disegniUtente è a zero: il banco non ha disegnato niente');

    const nomi = Object.keys(r.dettaglio);
    // I tre tipi di disegno devono comparire col loro nome, non in un totale unico.
    ['disegno:trendline', 'disegno:rectangle', 'disegno:vpfixed'].forEach(atteso => {
      assert.ok(nomi.includes(atteso),
        'manca il dettaglio «' + atteso + '»: trovati ' + nomi.join(', '));
    });
    // L'indicatore deve comparire con CALCOLO e DISEGNO separati: sono due cure diverse.
    assert.ok(nomi.includes('ind:volume_default:calcolo'),
      'manca il calcolo dell\'indicatore: ' + nomi.join(', '));
    assert.ok(nomi.includes('ind:volume_default:disegno'),
      'manca il disegno dell\'indicatore: ' + nomi.join(', '));

    // I numeri devono essere numeri, non zeri: un contatore a zero direbbe «qui non c'è
    // problema» proprio dove il problema vive.
    assert.ok(somma(r.dettaglio, 'disegno:') > 0, 'i disegni sommano zero millisecondi');
    assert.ok(somma(r.dettaglio, 'ind:') > 0, 'l\'indicatore somma zero millisecondi');

    // IL PEZZO ANNIDATO: il calcolo del profilo sta DENTRO il suo disegno, e deve esserci —
    // e' la domanda che viene subito dopo («costa il conto o costa disegnarlo?»), e la risposta
    // misurata sul banco e' che il conto e' in cache e il costo e' l'istogramma.
    assert.ok(nomi.includes('disegno:vpfixed>calcolo'),
      'manca il calcolo del profilo: ' + nomi.join(', '));
    assert.ok(r.dettaglio['disegno:vpfixed>calcolo'] <= r.dettaglio['disegno:vpfixed'] + 0.5,
      'il calcolo del profilo (' + r.dettaglio['disegno:vpfixed>calcolo'].toFixed(2)
      + ') non puo\' costare piu\' del disegno che lo contiene ('
      + r.dettaglio['disegno:vpfixed'].toFixed(2) + ')');
  } finally { await browser.close(); }
});

test('i numeri del dettaglio stanno dentro quelli della sezione che li contiene', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(MISURA(true));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');

    // Il dettaglio è una SCOMPOSIZIONE, non una misura a parte: la somma dei pezzi non può
    // superare il pezzo intero. Se la supera, qualche cronometro è aperto fuori dalla sezione e
    // sta contando due volte — un numero gonfiato manderebbe a ottimizzare la cosa sbagliata.
    const dentroDisegni = somma(r.dettaglio, 'disegno:') + somma(r.dettaglio, 'profiliVP:');
    const dentroInd = somma(r.dettaglio, 'ind:');
    assert.ok(dentroDisegni <= r.sezioni.disegniUtente + 1,
      'i disegni sommano ' + dentroDisegni.toFixed(2) + ' ms, più della loro sezione ('
      + r.sezioni.disegniUtente.toFixed(2) + '): qualcosa è contato due volte');
    assert.ok(dentroInd <= (r.sezioni.indicatori || 0) + 1,
      'gli indicatori sommano ' + dentroInd.toFixed(2) + ' ms, più della loro sezione ('
      + (r.sezioni.indicatori || 0).toFixed(2) + '): qualcosa è contato due volte');

    // E devono spiegare una parte VERA della sezione, altrimenti il dettaglio è decorativo:
    // con tre disegni su tre e un indicatore su uno, quasi tutto il costo è nominato.
    assert.ok(dentroDisegni >= r.sezioni.disegniUtente * 0.3,
      'il dettaglio spiega solo ' + dentroDisegni.toFixed(2) + ' dei '
      + r.sezioni.disegniUtente.toFixed(2) + ' ms della sezione: così non serve a niente');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: fuori dalla misura lo strumento non deve costare niente.
// Senza questa, un cronometro sempre acceso passerebbe le prove qui sopra e diventerebbe la
// causa del rallentamento successivo — è già successo in questo progetto con altri strumenti.
test('PROVA DI CONTROLLO: col cronometro spento il dettaglio resta vuoto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(MISURA(false));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.ok(r.disegni === 3 && r.indicatoriAccesi === 1,
      'il banco deve essere lo stesso dell\'altra prova, o questa non dimostra niente');
    assert.deepEqual(r.dettaglio, {},
      'col cronometro spento il dettaglio deve restare vuoto: invece ha '
      + Object.keys(r.dettaglio).join(', '));
    assert.deepEqual(r.sezioni, {},
      'col cronometro spento nemmeno le sezioni devono accumulare');
  } finally { await browser.close(); }
});
