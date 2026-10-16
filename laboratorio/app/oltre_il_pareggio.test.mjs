// IL TARGET CHE CALCOLA L'APP SI DICE SEMPRE ALLO STESSO MODO.
//
// RICHIESTO dal proprietario: «togliamo il più in là, che non serve». La formula «un ulteriore X%
// più in là» non dice rispetto a cosa è misurata. La v161 aveva riscritto l'ETICHETTA del campo
// («e target a X % oltre il pareggio») ma TRE riepiloghi che l'utente legge davvero — la scheda del
// segnale nel pannello, il riepilogo della configurazione, la conferma prima di aprire — dicevano
// ancora «più in là». Qui si fanno parlare le funzioni vere e si legge quello che scrivono a
// schermo: non si cerca la frase nel sorgente, che direbbe solo che è stata scritta.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Oro a 4100, un segnale con lo stop ma senza take profit: il target se lo calcola l'app.
const OPZ = `{prezzo:4100, saldo:10000, entroRischio:true}`;
const SEGNALE_SENZA_TP = `{strumento:'XAUUSD', direzione:'BUY', entrata:4120, stop_loss:4080, take_profit:[]}`;

test('nella scheda del segnale senza target si dice «oltre il pareggio»', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const testo = await pagina.evaluate(`{
      positions=[]; pendingOrders=[]; tgStrategie={}; tgSegnaliRicevuti=[];
      tgSegnaliRicevuti.push({id:1, chat:'Sala A', sala:'@a', stato:'nuovo', ricevuto_ms:Date.now(),
        segnale:${SEGNALE_SENZA_TP}});
      tgRenderPannello();
      const b=document.getElementById('tgPanelBody');
      b?b.textContent:''
    }`);
    assert.match(testo, /target a 10% oltre il pareggio/,
      'la scheda deve dire dove va il target, misurato dal pareggio');
    assert.ok(!/più in là/.test(testo), 'la formula oscura non deve più comparire');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nel riepilogo della configurazione si dice «oltre il pareggio»', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const testo = await pagina.evaluate(`{
      const piano = tgPiano({direzione:'BUY', stop_loss:4080}, 'XAUUSD', 1, ${OPZ});
      tgCfg = {sym:'XAUUSD', righe:[], regole:[]};
      tgCfgDisegnaRiepilogo(piano);
      const b=document.getElementById('tgConfigRiepilogo');
      b?b.textContent:''
    }`);
    assert.match(testo, /il target a 10% oltre il pareggio/,
      'il riepilogo deve dire dove va il target, misurato dal pareggio');
    assert.ok(!/più in là/.test(testo), 'la formula oscura non deve più comparire');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nella conferma prima di aprire si dice «oltre il pareggio»', async () => {
  // Il testo che il proprietario legge prima di premere «apri»: è il momento in cui la formula
  // oscura faceva più danno, perché stava per far partire un ordine.
  const {browser, pagina, errori} = await apriApp();
  try{
    const testo = await pagina.evaluate(async () => {
      positions=[]; pendingOrders=[]; tgStrategie={}; tgSegnaliRicevuti=[];
      mt5Connected=false;                             // niente ordini veri: posizioni simulate
      const piano = tgPiano({direzione:'BUY', stop_loss:4080}, 'XAUUSD', 1, {prezzo:4100, saldo:10000, entroRischio:true});
      piano.margine = 0;                              // il margine non deve fermare la conferma
      let catturato='';
      window.appConfirm = async (m)=>{ catturato=String(m); return false; };  // annulla: non si apre niente
      appConfirm = window.appConfirm;
      await tgEseguiSegnale({id:1, chat:'Sala A', sala:'@a', stato:'nuovo', ricevuto_ms:Date.now(),
        segnale:{strumento:'XAUUSD', direzione:'BUY', entrata:4120, stop_loss:4080, take_profit:[]}},
        {sym:'XAUUSD', piano});
      return catturato;
    });
    assert.match(testo, /il target a 10% oltre il pareggio/,
      'la conferma deve dire dove va il target, misurato dal pareggio');
    assert.ok(!/più in là/.test(testo), 'la formula oscura non deve più comparire');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
