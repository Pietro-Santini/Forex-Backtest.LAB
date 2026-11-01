// IN REPLAY CON MT5 COLLEGATO LE POSIZIONI REALI DEL CONTO SI DEVONO VEDERE.
//
// Riferito dal proprietario (1° novembre 2026): «in modalità replay con l'account MT5
// collegato non mi mostra a grafico la posizione entry/TP/SL, né l'etichetta sul bordo
// sinistro (direzione, lotti, P/L che segue il moltiplicatore); le posizioni aperte non
// compaiono nella tabella. Gli ordini pendenti invece sì. Deve esserci tutto.»
//
// CAUSA MISURATA (diagnosi dell'investigatore, due filtri in catena, non uno):
//   1. positionBelongsToCurrentView() rispondeva `return !!pos.historical` — in replay
//      passava SOLO ciò che era nato nel replay, quindi la posizione reale (mt5Ticket)
//      era scartata. La stessa funzione alimenta la tabella «Posizioni aperte».
//   2. posRevealedInReplay() faceva comparire la posizione solo quando il punto di replay
//      aveva raggiunto la sua candela di apertura (openIdx<=idx): una posizione aperta
//      ADESSO ha l'apertura nel futuro del replay, quindi non si rivelava mai.
//
// Questo test NON cerca stringhe nel sorgente: apre l'app davvero, mette in scena il replay
// con MT5 collegato e una posizione reale aperta "adesso", e misura filtri, tabella e righe
// disegnate sul canvas. Il filo della sicurezza è coperto da replay_mai_ordini_veri.test.mjs
// (in replay non parte NESSUN ordine verso il ponte) e resta intatto: qui si mostra soltanto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Scenario: replay live su XAUUSD, 120 candele intorno a 100, punto di replay alla candela 70.
// mt5: MT5 collegato o no. contoLogin: login del conto collegato. posLogin: login della
// posizione reale (uguale a contoLogin nel caso normale, diverso per provare l'isolamento).
function scenario(mt5, contoLogin, posLogin) {
  return `(function(){
    const t0=Date.UTC(2026,9,20,8,0,0); const R=[];
    for(let i=0;i<120;i++){ const c=100+Math.sin(i/11)*3;
      R.push({date:new Date(t0+i*60000).toISOString(),open:c,high:c+1,low:c-1,close:c,volume:10}); }
    rows=R; baseRows=R; idx=90; viewEnd=R.length; rowsAssetKey='XAUUSD'; currentAssetKey='XAUUSD';
    masterTime=Date.parse(R[70].date);          // il replay è alla candela 70
    liveModeActive=true; liveReplayActive=true; liveReplaySelecting=false;
    mt5Connected=${mt5};
    fblContoVista='mt5'; fblBacktestModeAttivo=false;
    try{ currentMt5AccountTag=function(){ return {mt5Login:${JSON.stringify(contoLogin)}}; }; }catch(e){}
    positions.length=0; pendingOrders.length=0; mt5RealOrders.length=0; mt5RealPositions.length=0;
    // LA POSIZIONE REALE DEL CONTO: aperta ADESSO (mt5AddedAt dopo il punto di replay).
    // Con la regola di prima era invisibile: era "nel futuro" del replay.
    positions.push({id:'p-reale',asset:'XAUUSD',side:'BUY',entry:100,sl:99,tp:102,lots:0.5,
      mt5Ticket:555001,mt5Login:${JSON.stringify(posLogin)},mt5AddedAt:Date.now(),
      startTime:Date.now(),openTF:1,createdAt:Date.now()});
    // Una posizione nata DURANTE il replay: quella si vedeva già.
    positions.push({id:'p-replay',asset:'XAUUSD',side:'SELL',entry:102,sl:104,tp:99,lots:0.2,
      mt5Ticket:null,historical:true,createdAt:Date.now(),startTime:Date.parse(R[60].date),openTF:1});
    return positions.map(p=>({
      id:p.id,
      mt5Ticket:p.mt5Ticket!=null,
      vista:(typeof positionBelongsToCurrentView==='function')?positionBelongsToCurrentView(p):'FUNZIONE ASSENTE',
      rivelata:(typeof posRevealedInReplay==='function')?posRevealedInReplay(p):'FUNZIONE ASSENTE',
      disegnabile:(typeof drawableOnCurrentChart==='function')?drawableOnCurrentChart(p):'FUNZIONE ASSENTE'
    }));
  })()`;
}

// Conta le righe orizzontali che attraversano TUTTO il grafico (bordo a bordo): sono le linee
// dei livelli. Stesso metodo di replay_live.test.mjs (larghezza 0: conta ciò che parte da
// sinistra, x1 < 25, e corre in orizzontale).
const HOOK_RIGHE = `
  const proto=CanvasRenderingContext2D.prototype;
  const vM=proto.moveTo,vL=proto.lineTo,vS=proto.stroke;
  let u=null, contate=0; const larghezza=0;
  proto.moveTo=function(x,y){ u={x1:x,y1:y}; return vM.apply(this,arguments); };
  proto.lineTo=function(x,y){ if(u){u.x2=x;u.y2=y;} return vL.apply(this,arguments); };
  proto.stroke=function(){
    if(u&&u.x2!=null&&Math.abs(u.y1-u.y2)<0.5&&u.x1<25&&(u.x2-u.x1)>larghezza*0.9)contate++;
    u=null; return vS.apply(this,arguments);
  };
  draw();
  proto.moveTo=vM; proto.lineTo=vL; proto.stroke=vS;
  return contate;
`;

test('in replay con MT5 collegato la posizione reale passa i filtri (e si vede)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const f = await pagina.evaluate(scenario(true, '12345678', '12345678'));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    const reale = f.find(x => x.id === 'p-reale');
    assert.equal(reale.vista, true, 'la posizione reale del conto deve passare positionBelongsToCurrentView');
    assert.equal(reale.rivelata, true, 'la posizione reale deve rivelarsi subito, non "quando il replay raggiunge la sua apertura"');
    assert.equal(reale.disegnabile, true, 'la posizione reale deve essere disegnabile a grafico');
    const nelReplay = f.find(x => x.id === 'p-replay');
    assert.equal(nelReplay.vista, true, 'la posizione nata nel replay deve continuare a vedersi');
    assert.equal(nelReplay.disegnabile, true, 'la posizione nata nel replay deve continuare a essere disegnabile');
  } finally { await browser.close(); }
});

test('la posizione reale compare anche nella tabella "Posizioni aperte"', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(scenario(true, '12345678', '12345678'));
    const t = await pagina.evaluate(`(function(){
      update();
      const righe=Array.from(document.querySelectorAll('#openPositions tr'));
      return {n:righe.length, testo:righe.map(tr=>tr.textContent.replace(/\\s+/g,' ').trim()).join(' | ')};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.ok(t.n >= 2, 'la tabella delle posizioni aperte ha ' + t.n + ' righe:'
      + ' la posizione reale e quella del replay devono esserci entrambe.');
    assert.ok(/BUY/.test(t.testo), 'manca la posizione BUY del conto MT5: ' + t.testo.slice(0, 200));
    assert.ok(/SELL/.test(t.testo), 'manca la posizione SELL nata nel replay: ' + t.testo.slice(0, 200));
  } finally { await browser.close(); }
});

test('in replay con MT5 collegato i livelli della posizione reale si disegnano', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(scenario(true, '12345678', '12345678'));
    const n = await pagina.evaluate(`(function(){ ${HOOK_RIGHE} })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    // entry 100, stop 99 e target 102 della posizione reale stanno tutti dentro il range del
    // grafico (le candele stanno fra 97 e 103): entry, stop e target devono comparire.
    assert.ok(n >= 3, 'a grafico compaiono ' + n + ' righe di livello: la posizione reale'
      + ' (entry 100, SL 99, TP 102) deve disegnarsele tutte e tre.');
  } finally { await browser.close(); }
});

test('senza MT5 collegato la posizione reale resta nascosta (regola di prima, invariata)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const f = await pagina.evaluate(scenario(false, '12345678', '12345678'));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    const reale = f.find(x => x.id === 'p-reale');
    assert.equal(reale.vista, false,
      'senza MT5 collegato nulla deve cambiare: la posizione reale non entra nel replay');
    const nelReplay = f.find(x => x.id === 'p-replay');
    assert.equal(nelReplay.vista, true, 'ciò che è nato nel replay si vede sempre');
  } finally { await browser.close(); }
});

test("la posizione reale di un ALTRO account non si mescola al conto collegato", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const f = await pagina.evaluate(scenario(true, '12345678', '99999999'));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    const reale = f.find(x => x.id === 'p-reale');
    assert.equal(reale.vista, false,
      'una posizione di un login diverso non deve entrare: i conti non si mescolano');
  } finally { await browser.close(); }
});

test('la posizione reale MT5 si distingue a grafico da quelle del replay o del CSV', async () => {
  // RICHIESTO DAL PROPRIETARIO (1° novembre 2026): «le posizioni aperte in questa modalita'
  // devono essere sottolineate in un altro modo rispetto alle posizioni aperte su un file csv».
  // Misurato: colore della linea orizzontale della posizione reale (ambra #f0b429, che non e'
  // ne' il verde del BUY ne' il rosso del SELL) e tesserino "MT5 " davanti all'etichetta.
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(scenario(true, '12345678', '12345678'));
    const segni = await pagina.evaluate(`(function(){
      const proto=CanvasRenderingContext2D.prototype;
      const vM=proto.moveTo,vL=proto.lineTo,vS=proto.stroke,vF=proto.fillText;
      let u=null; const colori=[]; const testi=[];
      proto.moveTo=function(x,y){ u={x1:x,y1:y,stile:String(this.strokeStyle||'')}; return vM.apply(this,arguments); };
      proto.lineTo=function(x,y){ if(u){u.x2=x;u.y2=y;} return vL.apply(this,arguments); };
      proto.stroke=function(){
        if(u&&u.x2!=null&&Math.abs(u.y1-u.y2)<0.5&&u.x1<25)colori.push(u.stile);
        u=null; return vS.apply(this,arguments);
      };
      proto.fillText=function(t,x,y){ testi.push(String(t)); return vF.apply(this,arguments); };
      draw();
      proto.moveTo=vM; proto.lineTo=vL; proto.stroke=vS; proto.fillText=vF;
      return {colori, testi};
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    const ambra = /f0b429|240,\s*180,\s*41/i;
    assert.ok(segni.colori.some(c => ambra.test(c)),
      'nessuna linea disegnata nel colore della posizione MT5: ' + segni.colori.join(' | '));
    assert.ok(segni.testi.some(t => /^MT5 /.test(t)),
      'manca il tesserino "MT5" sull\'etichetta della posizione reale: ' + segni.testi.join(' | '));
    assert.ok(segni.testi.some(t => /^SELL\b/.test(t)),
      'la posizione nata nel replay deve restare senza tesserino: ' + segni.testi.join(' | '));
  } finally { await browser.close(); }
});
