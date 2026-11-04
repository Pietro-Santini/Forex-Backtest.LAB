// L'ISTOGRAMMA DEL PROFILO NON SI ACCORCIA AL CAMBIO DI TIMEFRAME.
//
// Riferito dal proprietario (3-4 novembre 2026): «se stabilisco 300 barre con un time frame a un
// minuto, passando a 5 minuti non possono dimezzare, e a 15 minuti dimezzarsi ancora di più.
// Devono rimanere sempre uguali... È come funziona su TradingView.» E alla domanda su cosa
// cambiasse: «la fascia di prezzo rimane corretta, e lo fanno TUTTI i profili: disegno a mano,
// giornaliero e per sessione».
//
// CAUSA MISURATA, e NON è il numero delle fasce — quello non è mai dipeso dal timeframe. A
// cambiare era la SCALA ORIZZONTALE: la lunghezza massima della barra era una frazione della
// larghezza IN PIXEL del periodo coperto dal profilo, e un periodo fisso nel TEMPO occupa molti
// meno pixel quando ogni candela vale 15 minuti invece di 1. Misurato su 300 minuti di mercato,
// a parità di candele a vista: 684 px a 1 minuto, 599 a 5 minuti, 200 a 15 minuti. Tutte le
// barre si accorciano dello stesso fattore, le piccole scendono sotto il pixel e spariscono.
//
// La cura àncora la larghezza al RIQUADRO invece che al periodo — che è quello che fa
// TradingView, da cui il suo «Width 70%» identico a ogni timeframe.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Disegna un profilo manuale sullo stesso periodo di mercato a tre timeframe e misura la barra
// più lunga che finisce sul canvas. Si contano i rettangoli dell'istogramma: partono tutti dal
// bordo sinistro del profilo, quindi il più largo è la barra del POC.
const BARRA_PIU_LUNGA = (tf) => `(function(){
  const t0=Date.UTC(2026,9,20,8,0,0); const R=[]; let p=1900;
  for(let i=0;i<900;i++){ p+=(Math.sin(i/13)+Math.cos(i/7))*0.3;
    R.push({date:new Date(t0+i*60000).toISOString(),open:p,high:p+0.8,low:p-0.8,close:p+0.1,volume:10+(i%7)}); }
  csvLibrary=[{name:'t',rows:R}]; rebuildBaseRowsFromLibrary();
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD'; liveModeActive=false; liveReplayActive=false;
  currentTF=${tf}; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
  viewEnd=rows.length-1; idx=rows.length-1;
  // STESSE candele a vista nei tre casi: così l'unica variabile è il timeframe.
  visibleCount=80; autoFitWidth=false; followLatest=false;
  // Il profilo copre gli ULTIMI 300 MINUTI DI MERCATO in tutti e tre i casi, non le ultime N
  // candele: altrimenti si confronterebbero periodi di durata diversa.
  const ultime=Math.round(300/${tf});
  const a=rows.length-ultime, b=rows.length-1;
  drawings=[{id:'vp1',type:'vpfixed',
    p1:{time:parseDateTime(rows[a].date),price:rows[a].close},
    p2:{time:parseDateTime(rows[b].date),price:rows[b].close},
    buckets:120,barSizePct:500,upColor:'#2fbf71',downColor:'#e05252',
    _vpIndBars:true,bgEnabled:false,lvnEnabled:false,pocEnabled:false,vahEnabled:false,valEnabled:false,extendRight:false}];
  // NIENTE STIME DAL CANVAS: il disegnatore registra gia' la geometria ESATTA di ogni barra in
  // vpIndBarRects quando il profilo ha _vpIndBars acceso (e' il meccanismo usato dai profili
  // indicatore). Le prime due versioni di questa misura leggevano i rettangoli del canvas e
  // prendevano dentro anche candele, sfondi e la zona a basso volume: numeri piu' larghi del
  // grafico stesso. Qui si legge il dato vero.
  draw();
  const barre=vpIndBarRects.get('vp1')||[];
  let piuLunga=0;
  barre.forEach(function(b){ const L=b.x2-b.x1; if(L>piuLunga)piuLunga=L; });
  return {barre:barre.length, piuLunga:Math.round(piuLunga)};
})()`;

test('la barra più lunga è la stessa a 1, 5 e 15 minuti', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const a = await pagina.evaluate(BARRA_PIU_LUNGA(1));
    const b = await pagina.evaluate(BARRA_PIU_LUNGA(5));
    const c = await pagina.evaluate(BARRA_PIU_LUNGA(15));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    // Controllo del banco: se non disegna niente, le uguaglianze qui sotto sarebbero banalmente
    // vere e misurerebbero il vuoto.
    assert.ok(a.barre > 50 && b.barre > 50 && c.barre > 50,
      'il banco non disegna l\'istogramma: barre ' + a.barre + '/' + b.barre + '/' + c.barre);
    const scarto = Math.max(a.piuLunga, b.piuLunga, c.piuLunga) - Math.min(a.piuLunga, b.piuLunga, c.piuLunga);
    assert.ok(scarto <= 2,
      'la scala dell\'istogramma cambia col timeframe: 1m=' + a.piuLunga + 'px, 5m=' + b.piuLunga
      + 'px, 15m=' + c.piuLunga + 'px');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: «Dimensione istogramma» deve continuare a funzionare. Senza questa, la
// cura potrebbe aver bloccato la larghezza su un numero fisso, ignorando la scelta dell'utente.
test('la manopola «Dimensione istogramma» continua a cambiare la larghezza', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const grande = await pagina.evaluate(BARRA_PIU_LUNGA(5));
    const piccola = await pagina.evaluate(BARRA_PIU_LUNGA(5).replace('barSizePct:500', 'barSizePct:150'));
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.ok(piccola.piuLunga < grande.piuLunga,
      'al 150% le barre devono essere più corte che al 500% (' + piccola.piuLunga + 'px contro '
      + grande.piuLunga + 'px)');
  } finally { await browser.close(); }
});
