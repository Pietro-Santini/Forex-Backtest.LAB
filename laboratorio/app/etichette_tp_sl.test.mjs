// LE ETICHETTE A GRAFICO SCRIVONO "TP1, TP2, TP3" E "SL", E DICONO DA CHI VENGONO.
//
// SEGNALATO (19 ottobre 2026): «su i target e stop delle posizioni a grafico [...] vedo tutti i TP
// con l'etichetta scritto target, e invece no, deve essere scritto TP1, TP2, TP3, eccetera. E a
// fianco, su ogni target, ci inseriamo quello che è l'etichetta, all'interno dell'etichetta,
// l'origine: quindi se è stata una sala segnali, oppure un'operazione manuale, la sala di prova.
// Perché se no così vedremo soltanto target e stop. Quindi togliamo target e stop. Inseriamo
// invece TP e SL numerati con l'identificativo della sala segnali oppure operazione manuale».
// E: «se lo stop loss si sposta stop profit da SL diventa uno stop profit».
//
// IL DIFETTO: l'etichetta diceva una parola sola, "Target", e la parola è identica per tutte le
// posizioni. Con dieci posizioni aperte lo schermo è una griglia di "Target" uguali: non si distingue
// il primo dal secondo dal terzo obiettivo della strategia, e non si sa chi ha aperto l'operazione.
//
// I DATI ESISTEVANO GIÀ, non li si calcola: ogni posizione aperta da una sala porta con sé quale dei
// suoi target sta inseguendo (`tgTpIndice`, 1 based) e da quale sala è partita (`tgSala`). Nell'
// etichetta semplicemente non ci finivano.
//
// I test qui sotto NON guardano il sorgente: costruiscono posizioni vere e leggono il testo che
// viene effettivamente scritto sulla casella.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const GRAFICO = () => {
  const t0 = Date.now() - 200*60000; let p = 4161; const R = [];
  for (let i=0;i<200;i++){ const o=p, c=p+Math.sin(i/7)*2;
    R.push({date:new Date(t0+i*60000).toISOString(), open:o, high:Math.max(o,c)+1, low:Math.min(o,c)-1, close:c, volume:10}); p=c; }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; currentAssetKey='XAUUSD';
  csvLibrary=[{id:'mt5_live_XAUUSD',name:'MT5 Live',addedAt:Date.now(),rows:R}];
  visibleCount=200;
  liveModeActive=false; mt5Connected=false;
};

// Il testo che finisce davvero sulla casella. Il gancio è `fillText` del contesto 2D REALE, non
// la funzione che disegna la pillola: dentro il programma le funzioni si chiamano per nome (scope
// lessicale), quindi sostituire la funzione dalla finestra non le intercetterebbe — mentre il
// testo passa davvero dal contesto, quindi qui si legge esattamente quello che va a schermo.
const CATTURA = () => {
  const c=document.getElementById('chart').getContext('2d');
  window.__pill=[];
  if(!c.__fillTextOriginale) c.__fillTextOriginale=c.fillText;
  c.fillText=function(t){ window.__pill.push(String(t)); return c.__fillTextOriginale.apply(this, arguments); };
};

test('una posizione sola si chiama TP1 e SL, con l\'origine scritta dentro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      window.__pill=[];
      var ctx=document.getElementById('chart').getContext('2d');
      var pos={id:'p1',side:'BUY',entry:4161,sl:4100,tp:4200,lots:0.1,asset:'XAUUSD'};
      positions=[pos]; active=pos;
      drawTpSlZoneBox(ctx,{ownerKey:'pos:p1',originIdx:5,entry:pos.entry,sl:pos.sl,tp:pos.tp,
        lots:pos.lots,assetKey:'XAUUSD',pad:{l:0,r:120,t:0,b:0},cw:800,n:200,start:0,w:1000,
        y:function(v){return 500-v;},hidePills:false,tpEtichetta:fblEtichettaTpBreve(pos),
        origine:fblEtichettaOrigineBreve(pos)});
      return window.__pill.slice();
    })()`);
    const tp=r.find(t=>t.indexOf('4161')<0 && /4[12]00/.test(t));
    assert.ok(r.length>=2, 'devono esserci le due etichette, trovate: '+JSON.stringify(r));
    const insieme=r.join(' || ');
    assert.ok(!insieme.includes('Target:'), 'l\'etichetta dice ancora "Target": '+insieme);
    assert.ok(/TP1:/.test(insieme), 'manca "TP1:": '+insieme);
    assert.ok(/SL:/.test(insieme), 'manca "SL:": '+insieme);
    assert.ok(/manuale/.test(insieme), 'manca l\'origine della posizione manuale: '+insieme);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la seconda e la terza posizione di una strategia si chiamano TP2 e TP3', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})();
      var sala={tgSala:'PipHunter',tgGruppo:'g1',tgSegnaleId:'s1'};
      var out={};
      [1,2,3].forEach(function(n){
        var p=Object.assign({id:'p'+n,side:'BUY',entry:4161,sl:4100,tp:4200,lots:0.1,asset:'XAUUSD'},
                            sala,{tgTpIndice:n});
        out['TP'+n]=fblEtichettaTpBreve(p);
      });
      // Una posizione senza numero: una sola posizione, quindi TP1.
      out.senzaNumero=fblEtichettaTpBreve({tgSala:'PipHunter'});
      out.origineSala=fblEtichettaOrigineBreve({tgSala:'PipHunter'});
      out.origineProva=fblEtichettaOrigineBreve({tgProva:true,tgSala:'Sala di prova'});
      out.origineMancante=fblEtichettaOrigineBreve({tgGruppo:'g1',tgSegnaleId:'s1'});
      out.origineManuale=fblEtichettaOrigineBreve({id:'x'});
      out.origineLunga=fblEtichettaOrigineBreve({tgSala:'Una Sala Dal Nome Molto Lungo'});
      return out;
    })()`);
    assert.equal(r.TP1, 'TP1');
    assert.equal(r.TP2, 'TP2');
    assert.equal(r.TP3, 'TP3');
    assert.equal(r.senzaNumero, 'TP1', 'senza numero è una posizione sola, quindi TP1');
    assert.equal(r.origineSala, 'PipHunter', 'con il nome della sala si scrive il nome');
    assert.equal(r.origineProva, 'sala di prova', 'il segnale scritto a mano è la sala di prova');
    assert.equal(r.origineMancante, 'sala non riconosciuta',
      'c\'è la traccia di un segnale ma non il nome: NON si scrive "manuale", sarebbe falso');
    assert.equal(r.origineManuale, 'manuale');
    // Un nome lunghissimo non può mangiare tutta l'etichetta: viene accorciato, e il resto si
    // legge nel suggerimento passando col mouse (come già faceva il badge nelle tabelle).
    assert.ok(r.origineLunga.length<=16 && r.origineLunga.endsWith('…'),
      'il nome lunghissimo deve essere accorciato: '+r.origineLunga);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('lo stop profit continua a chiamarsi Stop Profit, non diventa SL', async () => {
  // Il proprietario: «lo stop profit è quello che deve rimanere. Quindi se lo stop loss si sposta
  // stop profit da SL diventa uno stop profit». È l'unica eccezione alla regola SL.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(function(){
      (${GRAFICO})(); (${CATTURA})();
      window.__pill=[];
      var ctx=document.getElementById('chart').getContext('2d');
      var pos={id:'p1',side:'BUY',entry:4161,sl:4200,tp:4250,lots:0.1,asset:'XAUUSD'};
      positions=[pos]; active=pos;
      drawTpSlZoneBox(ctx,{ownerKey:'pos:p1',originIdx:5,entry:pos.entry,sl:pos.sl,tp:pos.tp,
        lots:pos.lots,assetKey:'XAUUSD',pad:{l:0,r:120,t:0,b:0},cw:800,n:200,start:0,w:1000,
        y:function(v){return 500-v;},hidePills:false,stopProfit:true,
        tpEtichetta:fblEtichettaTpBreve(pos),origine:fblEtichettaOrigineBreve(pos)});
      return window.__pill.slice();
    })()`);
    const insieme=r.join(' || ');
    assert.ok(/Stop Profit:/.test(insieme), 'lo stop profit deve restare Stop Profit: '+insieme);
    assert.ok(!/SL:/.test(insieme), 'non deve diventare SL: '+insieme);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il pulsante di Style si chiama "mostra/nascondi etichette TP SL stop profit"', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(()=>{
      const b=document.getElementById('toggleTpSlEtichetteBtn');
      return {testo:b?b.textContent:null, titolo:b?b.getAttribute('title'):null};
    })()`);
    assert.ok(r.testo, 'il pulsante deve esistere');
    assert.ok(/TP SL stop profit/i.test(r.testo), 'il testo del pulsante: '+r.testo);
    assert.ok(!/Target/i.test(r.testo), 'il pulsante non deve più dire Target: '+r.testo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la cronologia è una sezione sua nella barra di sinistra, non dentro Style', async () => {
  // Il proprietario l'ha chiesto esplicitamente: «dobbiamo spostare il pulsante cronologia delle
  // sale nella barra laterale a sinistra sulle impostazioni e quindi toglierla all'interno della
  // sezione style. Deve essere proprio una sezione separata, che pigiamo quel pulsante e ci si
  // apre quello che è il pop-up di sempre».
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(()=>{
      const nav=document.getElementById('chartSettingsTabCronologia');
      const pannello=document.querySelector('[data-settings-panel="cronologia"]');
      const dentroStyle=document.querySelector('[data-settings-panel="style"]');
      const pulsantiStyle=dentroStyle?[...dentroStyle.querySelectorAll('.fblCronoBtn')].length:-1;
      const pulsantiCrono=pannello?[...pannello.querySelectorAll('.fblCronoBtn')].length:-1;
      return {navEsiste:!!nav, scheda:nav?nav.dataset.settingsTab:null,
              pannelloEsiste:!!pannello, pulsantiStyle:pulsantiStyle, pulsantiCrono:pulsantiCrono};
    })()`);
    assert.equal(r.navEsiste, true, 'manca la voce Cronologia nella barra di sinistra');
    assert.equal(r.scheda, 'cronologia', 'la voce deve avere una scheda tutta sua');
    assert.equal(r.pannelloEsiste, true, 'manca il pannello della cronologia');
    assert.equal(r.pulsantiCrono, 1, 'il pannello deve avere il pulsante della cronologia');
    assert.equal(r.pulsantiStyle, 0, 'il pulsante è ancora dentro Style: va tolto di lì');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('premere la nuova voce apre il pop-up della cronologia, quello di sempre', async () => {
  // Il requisito è che il pop-up sia "come sempre", non una copia: si prova davvero.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(`(()=>{
      // Prima la voce di sinistra (deve mostrare il pannello), poi il pulsante dentro il pannello
      // (deve aprire il pop-up). Sono due gesti distinti e qui si fanno entrambi, come l'utente.
      document.getElementById('chartSettingsTabCronologia').click();
      const pannello=document.querySelector('[data-settings-panel="cronologia"]');
      pannello.querySelector('.fblCronoBtn').click();
    })()`);
    const r = await pagina.evaluate(`(()=>{
      const box=document.getElementById('fblCronoOverlay');
      const pannello=document.querySelector('[data-settings-panel="cronologia"]');
      return {aperto:!!box && box.style.display!=='none',
              visibilePannello:!!pannello && pannello.style.display!=='none',
              titolo:box?((box.querySelector('h3')||{}).textContent||''):''};
    })()`);
    assert.equal(r.visibilePannello, true, 'il pannello della cronologia non si mostra');
    assert.equal(r.aperto, true, 'il pop-up della cronologia non si è aperto');
    assert.ok(/Cronologia delle sale/i.test(r.titolo), 'il titolo del pop-up: '+r.titolo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
