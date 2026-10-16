// L'ORDER BOOK PROFILE MOSTRA TUTTI E DUE I LATI, NON SOLO QUELLO CHE VINCE.
//
// SEGNALATO dal proprietario: «sull'indicatore profilo volumetrico, l'order book profile a
// sinistra dell'istogramma: le candele a sinistra sono tutte blu, solo una è rossa. Devono
// visualizzarsi sia quelle rosse sia quelle dei bid e degli ask».
//
// LA CAUSA era una riga sola del disegno:
//     ctx.fillStyle = (bidVol[b] >= askVol[b]) ? colBid : colAsk;
// una barra per fascia, del colore del lato che aveva prevalso. In una fascia con 100 di bid e 95
// di ask si vedeva solo blu: quei 95 non esistevano a schermo, e il rosso compariva solo dove gli
// ask vincevano (i pari andavano al blu). L'accumulo dei dati invece era ed è corretto e
// simmetrico — il difetto buttava via metà informazione in fase di disegno.
//
// Questi test guardano i RETTANGOLI DIPINTI, non il testo del codice: si intercetta il contesto
// del canvas e si conta cosa è stato davvero disegnato, e di che colore.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const BLU = '#2f6fed', ROSSO = '#e05b4f';

// Prepara 60 candele su una banda di prezzo nota, un profilo volumetrico con l'order book acceso,
// e uno storico del book finto in cui OGNI fascia ha sia bid sia ask — con i bid sempre in
// maggioranza, che è la situazione in cui prima si vedeva solo blu.
const PREPARA = (quotaAsk) => `(() => {
  const t0 = Date.now() - 60*60000; const R = [];
  for(let i=0;i<60;i++){ const p = 100 + (i%10); R.push({date:new Date(t0+i*60000).toISOString(),
    open:p, high:p+1, low:p-1, close:p, volume:100}); }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; viewStart=0;
  currentAssetKey='XAUUSD'; liveModeActive=true;
  // depthKeyNow() risponde solo con MT5 collegato e un simbolo attivo: e' da li' che arriva il
  // Market Depth vero. Senza, l'order book non si disegna proprio (giusto: niente dato, niente
  // disegno) e il banco non misurerebbe niente.
  mt5Connected=true; mt5ActiveSymbol='XAUUSD';

  // Il book finto: in ogni fascia di prezzo ci sono bid E ask. Gli ask valgono ${quotaAsk} volte
  // i bid: con 0.9 i bid vincono ovunque (prima: tutto blu), con 0 gli ask non ci sono proprio.
  const snap = {time_ms: Date.now(), bids: [], asks: []};
  for(let p=95; p<=112; p++){
    snap.bids.push({price:p, volume:100});
    if(${quotaAsk} > 0) snap.asks.push({price:p, volume:100*${quotaAsk}});
  }
  orderBookHistoryByAsset[depthKeyNow()] = [snap];

  // Il profilo volumetrico, con l'order book acceso.
  const d = Object.assign(vpIndDefaultStyle(), {
    type:'vpfixed', id:'prova_ob', p1:{time:parseDateTime(R[0].date), price:100},
    p2:{time:parseDateTime(R[R.length-1].date), price:110},
    obEnabled:true, obBidColor:'${BLU}', obAskColor:'${ROSSO}'
  });
  drawings = [d];

  // Si intercetta il canvas: ogni fillRect viene annotato con il colore in uso in quel momento.
  // ATTENZIONE: nella pagina ci sono nove canvas. Quello del grafico e' #chart; prendendo il
  // primo che capita si intercetta un canvas che non dipinge niente, e il banco direbbe "zero
  // barre" qualunque cosa faccia il disegno.
  const ctx = document.getElementById('chart').getContext('2d');
  const dipinti = [];
  const veroFillRect = ctx.fillRect.bind(ctx);
  ctx.fillRect = function(x,y,w,h){ dipinti.push({x,y,w,h,col:String(this.fillStyle).toLowerCase()}); return veroFillRect(x,y,w,h); };
  try{ draw(); }catch(e){ return {errore:String(e)}; }
  ctx.fillRect = veroFillRect;

  // I colori arrivano come rgba(r, g, b, a) CON GLI SPAZI. E il rosso delle candele al ribasso
  // e' rgba(224, 91, 100): vicinissimo a quello degli ask, rgba(224, 91, 79). Si confronta la
  // tripletta esatta, altrimenti si conterebbero le candele come se fossero barre del book.
  const conta = c => dipinti.filter(r => r.col.indexOf(c) >= 0).length;
  return {blu: conta('rgba(47, 111, 237'), rosso: conta('rgba(224, 91, 79'), totali: dipinti.length};
})()`;

test('in una fascia con bid E ask si dipingono tutti e due i colori', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    // Ask al 90% dei bid: i bid vincono in OGNI fascia. Prima questo dava tutto blu e zero rosso.
    const r = await pagina.evaluate(PREPARA(0.9));
    assert.ok(!r.errore, 'il disegno non deve esplodere: ' + r.errore);
    assert.ok(r.blu > 0, 'il lato bid deve esserci');
    assert.ok(r.rosso > 0,
      'il lato ask deve essere dipinto anche quando è in minoranza: è il difetto segnalato');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se gli ask non ci sono davvero, il rosso non compare (e si vede che manca)', async () => {
  // È la distinzione che prima non si poteva fare: "ask in minoranza" e "ask assenti" davano lo
  // stesso identico disegno. Ora no.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PREPARA(0));
    assert.ok(!r.errore, 'il disegno non deve esplodere: ' + r.errore);
    assert.ok(r.blu > 0, 'i bid ci sono');
    assert.equal(r.rosso, 0, 'senza ask nel book non si inventa nessun rosso');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('più ask che bid: ci sono tutti e due lo stesso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(PREPARA(3));
    assert.ok(!r.errore, 'il disegno non deve esplodere: ' + r.errore);
    assert.ok(r.blu > 0, 'il lato bid non sparisce quando è in minoranza');
    assert.ok(r.rosso > 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
