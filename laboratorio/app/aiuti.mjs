// Aiuti comuni ai test dell'app: apre app.html in Chromium senza rete (nessun dato vero esce dal
// banco di prova), nasconde i veli di accesso, prepara candele finte e un ponte Kraken finto.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
function caricaPlaywright(){
  try { return require('playwright'); } catch(e){}
  const glob = require('node:child_process').execSync('npm root -g').toString().trim();
  return require(path.join(glob, 'playwright'));
}
export const {chromium} = caricaPlaywright();
export const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const RISULTATI = path.join(RADICE, 'laboratorio', 'risultati');
fs.mkdirSync(RISULTATI, {recursive:true});

// IL SISTEMA OPERATIVO DEL BANCO E' DICHIARATO, NON EREDITATO.
//
// Dalla v158 l'app chiede "questo dispositivo e' Windows?" per decidere se proporre
// l'installazione dei pacchetti MT5 (il Setup e' un installatore Windows). Quella domanda
// rispondeva con il sistema operativo di CHI ESEGUE il collaudo: verde sul PC Windows dello
// sviluppatore, rossa su GitHub che gira su Ubuntu. Quattro test sono rimasti rossi su GitHub per
// sette versioni mentre in locale erano verdi - e un collaudo che dipende da dove gira non e' un
// collaudo, e' un'opinione.
//
// Qui il banco DICHIARA di essere un computer Windows, che e' la condizione in cui sono stati
// scritti tutti i test "su un computer". Chi deve provare l'altro caso (telefono, tablet, Mac) lo
// dice esplicitamente - vedi pacchetti_non_windows.test.mjs, che apre la pagina con la sua
// piattaforma. Cosi' il risultato e' lo stesso ovunque giri.
const UA_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
export async function apriApp({larghezza=1300, altezza=850, piattaforma='Windows', userAgent=UA_WINDOWS}={}){
  const opz = {};
  // Nel contenitore cloud Chromium e' gia' installato qui; su GitHub lo installa il flusso.
  for(const p of ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome']) if(fs.existsSync(p)) opz.executablePath = p;
  const browser = await chromium.launch(opz);
  const contesto = await browser.newContext({viewport:{width:larghezza, height:altezza}, userAgent});
  // I Client Hints non si cambiano con lo userAgent: vanno dichiarati a parte, prima che la
  // pagina parta (l'app li legge per primi).
  await contesto.addInitScript(([p]) => {
    Object.defineProperty(navigator, 'userAgentData', {configurable:true,
      get: () => (p === null ? undefined : {platform: p, mobile: false, brands: []})});
  }, [piattaforma]);
  // IL BANCO DI PROVA NON DEVE TOCCARE IL PONTE VERO DEL PROPRIETARIO.
  //
  // SEGNALATO (21 ottobre 2026): «mentre modifichi non mi chiudere e aprire il terminale MT5,
  // perche' quasi per ogni modifica che fai mi interrompi il processo di collegamento con MT5».
  // Causa: `pagina.route` qui sotto blocca le richieste HTTP, ma NON i WebSocket - Playwright li
  // instrada a parte. E l'app, appena parte, ne apre verso il feed MT5 (porta 8001) e verso il
  // ponte dei segnali (8769), che sul computer del proprietario sono VIVI e attaccati al suo
  // terminale. Un collaudo intero apre la pagina centinaia di volte: centinaia di connessioni e
  // disconnessioni sul ponte che in quel momento gli sta eseguendo gli ordini.
  // Qui il WebSocket viene sostituito prima che la pagina parta: nessuna connessione, nessun
  // errore a schermo (l'app lo tratta come uno stream che non si aggancia, caso che gestisce
  // gia'). Un collaudo non deve poter toccare niente fuori da se'.
  await contesto.addInitScript(() => {
    class WebSocketFinto {
      constructor(url){ this.url=String(url||''); this.readyState=0; this.bufferedAmount=0;
        this.onopen=null; this.onmessage=null; this.onerror=null; this.onclose=null; }
      send(){}
      close(){ this.readyState=3; try{ this.onclose&&this.onclose({code:1000,reason:'banco di prova'}); }catch(e){} }
      addEventListener(){} removeEventListener(){} dispatchEvent(){ return false; }
    }
    WebSocketFinto.CONNECTING=0; WebSocketFinto.OPEN=1; WebSocketFinto.CLOSING=2; WebSocketFinto.CLOSED=3;
    try{ Object.defineProperty(window,'WebSocket',{configurable:true,writable:true,value:WebSocketFinto}); }catch(e){}
  });
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on('pageerror', e => errori.push(String(e).slice(0,300)));
  await pagina.route('**', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await pagina.goto('file://' + path.join(RADICE, 'app.html'), {waitUntil:'domcontentloaded'});
  await pagina.waitForTimeout(2500);
  await pagina.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay').forEach(el => el.style.display='none'));
  return {browser, pagina, errori};
}

// Da eseguire DENTRO la pagina (pagina.evaluate(PREPARA_BTC)): 150 candele da 1 minuto di BTC che
// finiscono adesso, date ISO in UTC come quelle vere di Binance.
export const PREPARA_BTC = () => {
  const t0 = Date.now() - 150*60000; let p = 80000; const R = [];
  for(let i=0;i<150;i++){ const o=p, c=p+Math.sin(i/7)*60; R.push({date:new Date(t0+i*60000).toISOString(),open:o,high:Math.max(o,c)+25,low:Math.min(o,c)-25,close:c,volume:10}); p=c; }
  R[R.length-1].close = 80000;
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; currentAssetKey='BINANCE:BTCUSDT';
  liveModeActive=true; mt5Connected=false; fblContoVista='kraken';
  window.appConfirm=async()=>true; appConfirm=window.appConfirm;
};
