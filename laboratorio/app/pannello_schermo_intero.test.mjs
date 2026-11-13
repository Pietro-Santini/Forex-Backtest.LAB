// LA FASCIA A SCHERMO INTERO: VIA WIN/LOSS RATE, DENTRO LA POSIZIONE CON BE E CHIUDI.
//
// Parole del proprietario (12 novembre 2026): «nel pannellino quando siamo in pagina a tutto
// schermo, quello che indica P/L live, capitale, win rate, loss rate, margine libero: prima cosa
// togliamo win rate e loss rate, non ci servono. Seconda cosa: quando apriamo una posizione o la
// selezioniamo tramite i target, lo stop loss o la freccetta della posizione, ci deve comparire
// quella posizione dentro quel riquadro sotto, cosi che avremo i pulsanti BE e Chiudi. Cosi non
// dobbiamo uscire dallo schermo intero e andare sotto alle posizioni aperte per chiuderla».
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SCENA = `(function(){
  var t0=Date.now()-150*60000, p=4000, R=[], i;
  for(i=0;i<150;i++){ var o=p, c=p+Math.sin(i/7)*4;
    R.push({date:new Date(t0+i*60000).toISOString(),open:o,high:Math.max(o,c)+2,low:Math.min(o,c)-2,close:c,volume:10});
    p=c; }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length-1; followLatest=false;
  currentAssetKey='XAUUSD'; if(typeof rowsAssetKey!=='undefined') rowsAssetKey='XAUUSD';
  liveModeActive=true; mt5Connected=false; trades=[];
  positions.length=0;
  positions.push({id:'P1', asset:'XAUUSD', side:'BUY', entry:4000, sl:3990, tp:4020, lots:0.10,
                  startTime:Date.now()-30*60000, openTF:1, mt5Ticket:null});
  active=null;
  // La fascia esiste solo quando si e in schermo intero: qui la si crea a mano, che e
  // esattamente cio che fa fblMiniDashMostra quando ci entri.
  var ancora=document.getElementById('resetView')||document.body.firstElementChild;
  fblMiniDashMostra(ancora);
  return !!document.getElementById('fblMiniDash');
})()`;

test('win rate e loss rate non ci sono piu, P/L capitale e margine restano', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((scena) => {
      const c = eval(scena);
      fblMiniDashAggiorna();
      const el = document.getElementById('fblMiniDash');
      return {creata: c, testo: (el ? el.textContent : '') || ''};
    }, SCENA);
    console.log('fascia:', JSON.stringify(r.testo));
    assert.equal(r.creata, true, 'la fascia deve esistere');
    assert.ok(!/Win rate/i.test(r.testo), 'il win rate non deve piu comparire: ' + r.testo);
    assert.ok(!/Loss rate/i.test(r.testo), 'nemmeno il loss rate: ' + r.testo);
    assert.ok(/P\/L live/i.test(r.testo), 'il P/L live resta: ' + r.testo);
    assert.ok(/Capitale/i.test(r.testo), 'il capitale resta: ' + r.testo);
    assert.ok(/Margine libero/i.test(r.testo), 'e il margine libero resta: ' + r.testo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('selezionando una posizione compaiono la posizione e i pulsanti BE e Chiudi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((scena) => {
      eval(scena);
      const el = () => document.getElementById('fblMiniDash');
      fblMiniDashAggiorna();
      const senza = {
        testo: el().textContent || '',
        be: !!el().querySelector('[data-be]'),
        chiudi: !!el().querySelector('[data-closepos]')
      };
      // Adesso la posizione viene selezionata, come quando tocchi la sua freccia o il suo stop.
      active = positions[0];
      fblMiniDashAggiorna();
      const be = el().querySelector('[data-be]');
      const chiudi = el().querySelector('[data-closepos]');
      return {
        senza,
        con: {
          testo: el().textContent || '',
          be: be ? be.getAttribute('data-be') : null,
          chiudi: chiudi ? chiudi.getAttribute('data-closepos') : null
        }
      };
    }, SCENA);
    console.log('senza selezione:', JSON.stringify(r.senza), '\ncon selezione:', JSON.stringify(r.con));

    assert.equal(r.senza.be, false, 'senza posizione selezionata non ci sono pulsanti');
    assert.equal(r.senza.chiudi, false, 'nemmeno il Chiudi');
    assert.equal(r.con.be, 'P1',
      'selezionata la posizione deve comparire il pulsante BE, legato a quella posizione: ' +
      JSON.stringify(r.con));
    assert.equal(r.con.chiudi, 'P1', 'e il pulsante Chiudi: ' + JSON.stringify(r.con));
    assert.ok(/BUY/.test(r.con.testo) && /XAUUSD/.test(r.con.testo),
      'e si deve capire QUALE posizione e: ' + r.con.testo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i pulsanti usano gli stessi attributi della tabella delle posizioni', async () => {
  // Non e un dettaglio: se avessero un gestore nuovo, un domani si comporterebbero diversamente
  // dai pulsanti della tabella (conferme, sincronizzazione su MT5). Qui si verifica che il
  // gestore dei click li riconosca davvero, senza averne scritto uno apposta.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((scena) => {
      eval(scena);
      active = positions[0];
      fblMiniDashAggiorna();
      let chiamata = null;
      const vera = window.applyBreakevenToPosition;
      window.applyBreakevenToPosition = function (pos) { chiamata = pos ? pos.id : '(senza posizione)'; return true; };
      document.getElementById('fblMiniDash').querySelector('[data-be]').click();
      window.applyBreakevenToPosition = vera;
      return {chiamata};
    }, SCENA);
    console.log('clic su BE:', JSON.stringify(r));
    assert.equal(r.chiamata, 'P1',
      'il clic sul BE della fascia deve passare dallo stesso gestore della tabella: ' +
      JSON.stringify(r));
  } finally { await browser.close(); }
});
