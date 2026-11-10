// MISURA (non correzione) — DIFETTO 2: disattivando la modalità Prop Firm, le sette caselle
//   - gain effettivo / profitto effettivo / profitto netto / profitto effettivo (EUR) /
//     guadagno effettivo (prop firm) / Daily Drawdown / Max Drawdown -
// devono SPARIRE. Qui si misura quante restano davvero a schermo, in numeri.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SETTE = ['pfGainPanel','pfEffectiveGainPanel','pfNetProfitPanel',
               'pfProfittoEffettivoPanel','pfGuadagnoEffettivoPanel',
               'pfDailyDDPanel','pfMaxDDPanel'];

const candele = (minuti=300) => {
  const t0 = Date.now() - minuti*60000; let p = 4161; const R = [];
  for (let i=0;i<minuti;i++){ const o=p, c=p+Math.sin(i/7)*2;
    R.push({date:new Date(t0+i*60000).toISOString(), open:o, high:Math.max(o,c)+2, low:Math.min(o,c)-2, close:c, volume:10}); p=c; }
  return R;
};

const BASE = `(function(){
  var C=${'$'}{CAND};
  rows=C; baseRows=C; idx=C.length-1; viewEnd=C.length-50;
  currentAssetKey='XAUUSD'; liveModeActive=false; mt5Connected=false; isPropFirmMode=false;
  csvLibrary=[{id:'a',name:'A',addedAt:Date.now(),rows:C}];
  return true;
})()`;

test('disattivando la Prop Firm, tutte e 7 le caselle devono sparire', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      var C=${'$'}{CAND};
      ${'$'}{BASE}
      // --- ATTIVAZIONE VERA (pulsante "MODALITÀ PROP FIRM" -> Storico -> capitale) ---
      await proceedEnablePropFirm(false);
      await startNewPropFirmChallenge(10000);
      // Ciò che fa checkPropFirmRules al primo giro: mostra le sette caselle.
      isPropFirmMode=true; updatePropFirmDrawdownDisplay(1.5,4.2,250,'sorgenta di prova','EUR');
      var visPrima=${'$'}{IDS}.filter(id=>{var e=document.getElementById(id);return e&&e.style.display!=='none';}).length;
      // --- DISATTIVAZIONE VERA (pulsante ripremuto) ---
      await disablePropFirmMode();
      var dopo=${'$'}{IDS}.map(id=>{var e=document.getElementById(id);return {id:id,display:e?e.style.display:'ASSENTE'};});
      return {modo:currentMode(), isPropFirmMode:isPropFirmMode, visPrima:visPrima, dopo:dopo,
              restoVisibili:dopo.filter(x=>x.display!=='none'&&x.display!=='ASSENTE').length,
              nascoste:dopo.filter(x=>x.display==='none').length};
    })()`.replace(/\$\{BASE\}/g, BASE)
            .replace(/\$\{CAND\}/g, JSON.stringify(candele(300)))
            .replace(/\$\{IDS\}/g, JSON.stringify(SETTE)));
    assert.equal(r.visPrima, 7, 'in Prop Firm le sette caselle sono visibili');
    assert.equal(r.modo, 'backtest', 'la sessione è tornata a Storico');
    assert.equal(r.isPropFirmMode, false, 'la modalità Prop Firm è spenta');
    // CORRETTO (10 novembre 2026): prima solo le 2 caselle del drawdown venivano nascoste e le 5
    // del guadagno restavano a schermo da SPENTE. Ora la funzione che sa nasconderle tutte e sette
    // viene chiamata davvero all'uscita dalla Prop Firm.
    assert.equal(r.nascoste, 7, 'tutte e 7 le caselle devono sparire disattivando la Prop Firm');
    assert.equal(r.restoVisibili, 0,
      'nessuna casella deve restare a schermo da SPENTA: ' + JSON.stringify(r.dopo.filter(x=>x.display!=='none'&&x.display!=='ASSENTE')));
    assert.deepEqual(errori, [], 'nessun errore di pagina');
  } finally { await browser.close(); }
});

test('la funzione che nasconde tutte e sette esiste già: viene chiamata solo da checkPropFirmRules', async () => {
  const {browser, pagina} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      var C=${'$'}{CAND};
      ${'$'}{BASE}
      await proceedEnablePropFirm(false);
      await startNewPropFirmChallenge(10000);
      isPropFirmMode=true; updatePropFirmDrawdownDisplay(1,2,3,'s','EUR');
      // PROVA DI CONTROLLO: la funzione, chiamata a sessione Prop Firm spenta, nasconde TUTTE.
      isPropFirmMode=false; updatePropFirmDrawdownDisplay(0,0,0,'','EUR');
      var dopo=${'$'}{IDS}.map(id=>{var e=document.getElementById(id);return e?e.style.display:'ASSENTE';});
      return {tutteNascoste:dopo.every(d=>d==='none'),display:dopo};
    })()`.replace(/\$\{BASE\}/g, BASE)
            .replace(/\$\{CAND\}/g, JSON.stringify(candele(300)))
            .replace(/\$\{IDS\}/g, JSON.stringify(SETTE)));
    assert.equal(r.tutteNascoste, true,
      'updatePropFirmDrawdownDisplay() sa nascondere tutte e sette: '+JSON.stringify(r.display));
  } finally { await browser.close(); }
});

test('anche saltando alla sessione base dal Trade Journal (ensureSessionActive) le sette restano visibili', async () => {
  const {browser, pagina} = await apriApp();
  try{
    const r = await pagina.evaluate(`(async function(){
      var C=${'$'}{CAND};
      ${'$'}{BASE}
      await proceedEnablePropFirm(false);
      await startNewPropFirmChallenge(10000);
      isPropFirmMode=true; updatePropFirmDrawdownDisplay(1,2,3,'s','EUR');
      var ok=await ensureSessionActive('backtest');   // "Vai a grafico" su un trade Storico
      var dopo=${'$'}{IDS}.map(id=>{var e=document.getElementById(id);return e?e.style.display:'ASSENTE';});
      return {ok:ok,modo:currentMode(),nascoste:dopo.filter(d=>d==='none').length,
              visibili:dopo.filter(d=>d!=='none'&&d!=='ASSENTE').length};
    })()`.replace(/\$\{BASE\}/g, BASE)
            .replace(/\$\{CAND\}/g, JSON.stringify(candele(300)))
            .replace(/\$\{IDS\}/g, JSON.stringify(SETTE)));
    assert.equal(r.ok, true, 'ensureSessionActive è rientrata in Storico');
    assert.equal(r.modo, 'backtest', 'sessione base');
    assert.equal(r.nascoste, 0, 'in questo percorso NON viene nascosta nemmeno una casella');
    assert.equal(r.visibili, 7, 'tutte e sette le caselle restano a schermo');
  } finally { await browser.close(); }
});
