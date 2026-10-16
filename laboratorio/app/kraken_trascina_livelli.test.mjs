// STOP E TARGET DI UNA POSIZIONE KRAKEN SI TRASCINANO SUL GRAFICO.
//
// SEGNALATO dal proprietario: «sia dal tablet che dal telefono, sul conto Kraken, non riesco a
// spostare target e stop con il dito. Con la penna sul tablet sì, con il dito no. Anzi, neanche
// sul PC me li fa spostare: devono essere modificabili».
//
// LA CAUSA, una sola per tutti e tre i casi: le posizioni Kraken NON stanno in positions[] — sono
// disegnate da un percorso separato — e tradeLevelHit(), la funzione che decide quale linea si sta
// afferrando, non conteneva un solo riferimento a Kraken. Non c'era niente da afferrare, con
// nessun dispositivo. (La penna «funzionava» su altre linee, non su queste.)
//
// DUE PROTEZIONI, e servono tutte e due. «Prima deve essere selezionato, poi si può trascinare»
// (richiesto esplicitamente): l'armamento evita di afferrare per sbaglio. E al rilascio si chiede
// conferma: dice COSA sta per succedere, cosa che un doppio tocco non fa. Qui il rilascio non
// scrive un numero, manda un ordine a un exchange.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

// Una posizione Kraken su BTC con stop e due target, disegnata sul grafico.
const PREPARA = `
  const t0 = Date.now() - 150*60000; const R = [];
  // Le candele devono COPRIRE stop e target: una linea fuori dalla scala visibile non si disegna
  // e giustamente non si afferra. Con candele strette (80000-80190) il banco misurava zero zone e
  // sembrava un difetto del codice: era il banco a non mostrare quelle linee.
  for(let i=0;i<150;i++){ const p = 79200 + (i%40)*50; R.push({date:new Date(t0+i*60000).toISOString(),
    open:p, high:p+30, low:p-30, close:p, volume:10}); }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; viewStart=0;
  currentAssetKey='BINANCE:BTCUSDT'; liveModeActive=true;
  krakenConto={configurato:true, collegato:true, ambiente:'simulato', leva:2, saldo:10000,
               disponibile:9000, conto_id:'conto-1', conto_nome:'Prova'};
  krakenPosizioni={posizioni:[{simbolo:'PF_XBTUSD', lato:'BUY', quantita:0.2, entrata:80000,
    // mark ALLINEATO all'ultima candela: il disegno applica lo scostamento Kraken<->Binance
    // (krakenScostamento, i due mercati non quotano identico) e con un mark diverso i livelli
    // slittavano di +550, spingendo il secondo target fuori scala. Quella compensazione ha gia'
    // il suo test: qui si misura il trascinamento.
    mark:R[R.length-1].close, pnl:20, aperta_ms: Date.now()-30*60000,
    sl:79500, tp:[{id:'t1',prezzo:80500,quantita:0.1},{id:'t2',prezzo:81000,quantita:0.1}]}]};
  try{ draw(); }catch(e){ return {errore:String(e)}; }`;

// Ogni prova aggiunge la SUA domanda in fondo alla preparazione.
const CHIEDI = (domanda) => '(() => {' + PREPARA + '\n  return ' + domanda + ';\n})()';

test('stop e target della posizione Kraken diventano afferrabili', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(CHIEDI(
      '{zone: krakenLivelloHitRects.map(z=>({tipo:z.tipo, indice:z.indice, prezzo:z.prezzo}))}'));
    assert.ok(!r.errore, 'il disegno non deve esplodere: ' + r.errore);
    const tipi = r.zone.map(z => z.tipo);
    assert.ok(tipi.includes('SL'), 'lo stop deve essere afferrabile');
    assert.equal(tipi.filter(t => t === 'TP').length, 2, 'ogni target deve essere afferrabile da solo');
    // Ogni target porta il suo indice: senza, al rilascio si sposterebbe quello sbagliato.
    assert.deepEqual(r.zone.filter(z => z.tipo === 'TP').map(z => z.indice), [0, 1]);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('si afferra la linea PIÙ VICINA, non la prima che capita', async () => {
  // Stop e target possono stare a pochi pixel: prendere quella sbagliata qui vuol dire spostare
  // l'ordine sbagliato.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(CHIEDI(`(() => {
      const g = chartGeometry();
      const perTp2 = krakenLivelloHitRects.find(z => z.tipo==='TP' && z.indice===1);
      const perSl  = krakenLivelloHitRects.find(z => z.tipo==='SL');
      const x = (perTp2.x1 + perTp2.x2) / 2 + g.rect.left;
      return {suTp2: krakenLivelloHit(x, perTp2.yy + g.rect.top),
              suSl:  krakenLivelloHit(x, perSl.yy  + g.rect.top),
              lontano: krakenLivelloHit(x, perSl.yy + g.rect.top + 200)};
    })()`));
    assert.equal(r.suTp2 && r.suTp2.tipo, 'TP');
    assert.equal(r.suTp2 && r.suTp2.indice, 1, 'sul secondo target si afferra il secondo');
    assert.equal(r.suSl && r.suSl.tipo, 'SL', 'sullo stop si afferra lo stop');
    assert.equal(r.lontano, null, 'lontano dalle linee non si afferra niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PRIMA si seleziona, POI si trascina', async () => {
  // Richiesto esplicitamente. Un tocco impreciso su uno stop di Kraken manderebbe un ordine vero.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(CHIEDI(`(() => {
      const sl = krakenLivelloHitRects.find(z => z.tipo==='SL');
      const primaDiTutto = krakenLivelloPronto(sl);     // appena disegnata: non pronta
      krakenLivelloArma(sl);
      const dopoArmata = krakenLivelloPronto(sl);       // ora sì
      // Ma solo QUELLA linea: armarne una non arma le altre.
      const altraLinea = krakenLivelloPronto(krakenLivelloHitRects.find(z => z.tipo==='TP'));
      // E l'armamento scade: una linea "pronta" e dimenticata è una trappola per il clic dopo.
      krakenLivelloArmato.quando = Date.now() - KRAKEN_LIVELLO_ARMA_MS - 1000;
      const scaduta = krakenLivelloPronto(sl);
      return {primaDiTutto, dopoArmata, altraLinea, scaduta};
    })()`));
    assert.equal(r.primaDiTutto, false, 'appena disegnata nessuna linea è pronta da trascinare');
    assert.equal(r.dopoArmata, true, 'dopo la selezione sì');
    assert.equal(r.altraLinea, false, 'selezionarne una non seleziona le altre');
    assert.equal(r.scaduta, false, 'la selezione scade: non resta armata per sempre');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le zone si rifanno a ogni disegno: una posizione chiusa non resta afferrabile', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(CHIEDI(`(() => {
      const prima = krakenLivelloHitRects.length;
      krakenPosizioni = {posizioni: []};      // la posizione si chiude
      try{ draw(); }catch(e){}
      return {prima, dopo: krakenLivelloHitRects.length};
    })()`));
    assert.ok(r.prima > 0);
    assert.equal(r.dopo, 0, 'niente deve restare afferrabile dopo la chiusura');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il rilascio toglie lo scostamento fra Kraken e Binance', () => {
  // Il grafico mostra i prezzi di Binance, l'ordine vive su Kraken: i due non quotano identico e
  // il disegno applica uno scostamento. Mandare il prezzo letto a schermo sposterebbe lo stop di
  // quella differenza.
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  assert.ok(src.indexOf('if(krakenLivelloDrag){') > 0, 'il rilascio deve esistere');
  const blocco = src.slice(src.indexOf('const perKraken='), src.indexOf('const perKraken=') + 200);
  assert.ok(/prezzoGrafico-\(Number\(drag\.scostamento\)\|\|0\)/.test(blocco),
    'al rilascio lo scostamento va tolto prima di mandare il prezzo a Kraken');
});

test('niente parte senza conferma, e fermi sul posto non si chiede nulla', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const i = src.indexOf('async function krakenLivelloApplica');
  assert.ok(i > 0, 'la funzione che applica deve esistere');
  const fn = src.slice(i, i + 3000);
  // La conferma deve venire PRIMA di qualunque chiamata al ponte.
  const posConferma = fn.indexOf('appConfirm');
  const posPonte = fn.indexOf('krakenBridge');
  assert.ok(posConferma > 0 && posPonte > posConferma,
    'si chiede conferma prima di mandare l\'ordine, mai dopo');
  // E un rilascio senza spostamento non deve nemmeno aprire la finestra.
  // ATTENZIONE: 'if(krakenLivelloDrag){' compare DUE volte - nel trascinamento e nel rilascio -
  // e indexOf prende la prima. Si parte da un pezzo che esiste solo nel rilascio.
  const r = src.indexOf('const drag=krakenLivelloDrag;');
  assert.ok(r > 0, 'il rilascio deve esistere');
  const rilascio = src.slice(r, r + 2200);
  assert.ok(/Math\.abs\(prezzoGrafico-drag\.prezzoIniziale\)<1e-9\)return/.test(rilascio),
    'fermo sul posto = nessuno spostamento: non si chiede conferma di non fare niente');
  // Spostata la linea, la selezione si consuma: il clic dopo non la sposta di nuovo.
  assert.ok(/krakenLivelloDisarma\(\)/.test(rilascio),
    'dopo lo spostamento la selezione si consuma');
});
