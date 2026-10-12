// Strumento di ispezione (non e' un test): apre la modale "Apertura automatica" con due sale e
// fotografa il menu' a tendina della strategia aperto, per guardarlo.
import {apriApp} from '../app/aiuti.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PREPARA = () => {
  positions = []; pendingOrders = []; trades = [];
  tgGruppi = ['@a', '@b']; tgGruppiSyntra = [];
  tgAutoFx = {attivo:true, maxGlobali:40, perditaMaxGiorno:10, perditaAttiva:false, etaMaxS:600,
    sale:{'@a':{attivo:true, rischio:1, maxPosizioni:6}, '@b':{attivo:true, rischio:1, maxPosizioni:6}},
    spentoIl:null, predefinitiV:2, universale:null};
  tgAutoMostraFam('fx');
  document.getElementById('tgAutoOverlay').style.display = 'flex';
};

const {browser, pagina, errori} = await apriApp({larghezza:1400, altezza:900});
await pagina.evaluate((p) => { eval('(' + p + ')')(); }, PREPARA.toString());
await pagina.click('#tgAutoSale [data-tgstrat="@a"]');
await pagina.waitForTimeout(400);
await pagina.screenshot({path: path.join(RADICE, 'laboratorio', 'risultati', 'menu_strategia.png')});
console.log('errori:', JSON.stringify(errori));
await browser.close();
