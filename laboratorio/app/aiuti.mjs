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

export async function apriApp({larghezza=1300, altezza=850}={}){
  const opz = {};
  // Nel contenitore cloud Chromium e' gia' installato qui; su GitHub lo installa il flusso.
  for(const p of ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome']) if(fs.existsSync(p)) opz.executablePath = p;
  const browser = await chromium.launch(opz);
  const pagina = await browser.newPage({viewport:{width:larghezza, height:altezza}});
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
