// FRECCE DELLA TASTIERA per spostare il grafico, e UNA SOLA coppia di frecce sullo schermo.
//
// Riferito dal proprietario (1° novembre 2026):
//  - «nel grafico non mi devo soltanto poter spostare con le freccettine sullo schermo, ma
//     anche con le frecce sulla tastiera, freccia destra e freccia sinistra»;
//  - «sulla pagina madre ci sono le due frecce accanto al tasto play E altre due frecce sotto,
//     avanti e indietro: è un doppione. Lasciare soltanto le due freccette accanto al play in
//     pagina principale; a schermo intero sono due ed è giusto».
//
// CAUSA MISURATA: la navigazione da tastiera esisteva già (handleChartArrowNav) ma era vincolata
// a `chartHovered` - serviva il MOUSE sopra il grafico. Il doppione era #replayControlsRow
// (#back/#next), visibile insieme alle frecce ufficiali #pipHistBackBtn/#pipHistNextBtn.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Storico CSV con 100 candele, punto di partenza a metà. replay e Live spenti: la navigazione
// nel tempo funziona in Storico, quindi è quello lo scenario.
const SCENARIO = `(function(){
  const t0=Date.UTC(2026,9,20,8,0,0); const R=[];
  for(let i=0;i<100;i++){ const c=100+i*0.1;
    R.push({date:new Date(t0+i*60000).toISOString(),open:c,high:c+0.5,low:c-0.5,close:c,volume:10}); }
  rows=R; baseRows=R; viewEnd=R.length; idx=50; rowsAssetKey='XAUUSD'; currentAssetKey='XAUUSD';
  liveModeActive=false; liveReplayActive=false; followLatest=false;
  try{ document.getElementById('market').value='XAUUSD'; }catch(e){}
  return {righe:rows.length, idx:idx, followLatest:followLatest};
})()`;

const LEGGI_IDX = 'Number(idx)';

test('le frecce della tastiera spostano il grafico senza mouse sopra di esso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENARIO);
    const prima = await pagina.evaluate(LEGGI_IDX);
    // Nessun passaggio del mouse sul grafico: il mouse è fuori dalla pagina.
    await pagina.keyboard.press('ArrowRight');
    await pagina.waitForTimeout(120);
    const dopoDestra = await pagina.evaluate(LEGGI_IDX);
    await pagina.keyboard.press('ArrowLeft');
    await pagina.waitForTimeout(120);
    const dopoSinistra = await pagina.evaluate(LEGGI_IDX);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(dopoDestra, prima + 1,
      'la freccia DESTRA deve far avanzare di una candela (' + prima + ' -> ' + dopoDestra + ')');
    assert.equal(dopoSinistra, prima,
      'la freccia SINISTRA deve tornare indietro di una candela (' + dopoDestra + ' -> ' + dopoSinistra + ')');
  } finally { await browser.close(); }
});

test('in Live le frecce non spostano il grafico (lo storico è il presente)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENARIO);
    await pagina.evaluate('(function(){ liveModeActive=true; return true; })()');
    const prima = await pagina.evaluate(LEGGI_IDX);
    await pagina.keyboard.press('ArrowRight');
    await pagina.waitForTimeout(120);
    const dopo = await pagina.evaluate(LEGGI_IDX);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(dopo, prima,
      'in diretta le frecce non devono spostare il grafico: il presente non si riavvolge');
  } finally { await browser.close(); }
});

// IL TEST QUI SOTTO PASSAVA MENTRE IL DIFETTO C'ERA, ED E' LA LEZIONE DEL 3 NOVEMBRE 2026.
// Guarda la pagina APPENA APERTA, dove la riga doppione e' nascosta dall'HTML. Ma TRE punti del
// codice la rimettevano a 'grid' appena l'interfaccia si aggiornava, e il proprietario il
// doppione continuava a vederlo, foto alla mano. Qui sotto lo stato si misura DOPO aver fatto
// girare updateLiveModeUI()/updateLiveReplayUI(): com'e' la pagina mentre la si usa davvero.
const STATO_FRECCE = `(function(){
  const visibile = (el) => {
    if(!el) return false;
    const s = getComputedStyle(el);
    if(s.display==='none'||s.visibility==='hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width>0 && r.height>0;
  };
  const riga=document.getElementById('replayControlsRow');
  const back=document.getElementById('pipHistBackBtn');
  const next=document.getElementById('pipHistNextBtn');
  return {doppione:visibile(riga), stile:riga?getComputedStyle(riga).display:'ASSENTE',
          ufficiali:visibile(back)&&visibile(next)};
})()`;

test('in Storico, DOPO l\'aggiornamento dell\'interfaccia, il doppione resta nascosto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENARIO);
    await pagina.evaluate(`(function(){ liveModeActive=false; liveReplayActive=false; updateLiveModeUI(); return true; })()`);
    const v = await pagina.evaluate(STATO_FRECCE);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(v.doppione, false, 'la seconda coppia di frecce deve restare nascosta (stile: '+v.stile+')');
    assert.equal(v.ufficiali, true, 'le frecce accanto al PLAY devono restare visibili');
  } finally { await browser.close(); }
});

test('in Live col replay acceso — il caso della foto — il doppione resta nascosto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENARIO);
    await pagina.evaluate(`(function(){ liveModeActive=true; liveReplayActive=true;
      updateLiveModeUI(); updateLiveReplayUI(); return true; })()`);
    const v = await pagina.evaluate(STATO_FRECCE);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(v.doppione, false, 'era QUESTO lo stato in cui si vedevano due coppie (stile: '+v.stile+')');
    assert.equal(v.ufficiali, true, 'e le frecce accanto al PLAY ci devono essere, altrimenti non si naviga piu\'');
  } finally { await browser.close(); }
});

test('in Live col replay acceso le frecce della tastiera muovono le candele', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENARIO);
    await pagina.evaluate(`(function(){ liveModeActive=true; liveReplayActive=true; return true; })()`);
    const prima = await pagina.evaluate(LEGGI_IDX);
    await pagina.keyboard.press('ArrowRight');
    await pagina.waitForTimeout(150);
    const dopo = await pagina.evaluate(LEGGI_IDX);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(dopo, prima + 1,
      'dentro al replay la freccia DESTRA deve avanzare di una candela (' + prima + ' -> ' + dopo + ')');
  } finally { await browser.close(); }
});

test('su una pagina principale c\'è UNA sola coppia di frecce: quella accanto al play', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const viste = await pagina.evaluate(`(function(){
      const visibile = (el) => {
        if(!el) return false;
        const s = getComputedStyle(el);
        if(s.display==='none'||s.visibility==='hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width>0 && r.height>0;
      };
      const riga = document.getElementById('replayControlsRow');
      const back = document.getElementById('pipHistBackBtn');
      const next = document.getElementById('pipHistNextBtn');
      const play = document.getElementById('play');
      // La coppia ufficiale è nella stessa riga del PLAY (fratelli): è quella che resta.
      const stessaRigaDelPlay = !!(back && play && back.parentElement === play.parentElement);
      return {
        doppionVisibile: visibile(riga),
        doppionStile: riga ? getComputedStyle(riga).display : 'ASSENTE',
        ufficialiVisibili: visibile(back) && visibile(next),
        stessaRigaDelPlay: stessaRigaDelPlay
      };
    })()`);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(viste.doppionVisibile, false,
      'la seconda coppia di frecce (#replayControlsRow) deve essere nascosta: era il doppione segnalato');
    assert.equal(viste.ufficialiVisibili, true,
      'le frecce accanto al PLAY devono restare visibili (stile: ' + viste.doppionStile + ')');
    assert.equal(viste.stessaRigaDelPlay, true,
      'le frecce che restano devono essere quelle nella riga del PLAY');
  } finally { await browser.close(); }
});

test('le frecce ufficiali accanto al play continuano a spostare il grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENARIO);
    const prima = await pagina.evaluate(LEGGI_IDX);
    await pagina.click('#pipHistNextBtn');
    await pagina.waitForTimeout(150);
    const dopo = await pagina.evaluate(LEGGI_IDX);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(dopo, prima + 1,
      'la freccia ▶ accanto al PLAY deve far avanzare di una candela (' + prima + ' -> ' + dopo + ')');
  } finally { await browser.close(); }
});

test('le frecce non rubano la scrittura dentro un campo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(SCENARIO);
    const prima = await pagina.evaluate(LEGGI_IDX);
    const cestello = await pagina.evaluate(`(function(){
      let inp=document.querySelector('#quickLots, input[type=text], input[type=number]');
      if(!inp){ inp=document.createElement('input'); inp.id='fblTestInput'; document.body.appendChild(inp); }
      inp.focus();
      return document.activeElement===inp;
    })()`);
    await pagina.keyboard.press('ArrowRight');
    await pagina.waitForTimeout(120);
    const dopo = await pagina.evaluate(LEGGI_IDX);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    if (cestello) {
      assert.equal(dopo, prima,
        'colFocus dentro un campo la freccia deve servire a scrivere, non a spostare le candele');
    }
  } finally { await browser.close(); }
});
