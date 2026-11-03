// L'ISTOGRAMMA DEL PROFILO HA LO STESSO NUMERO DI RIGHE A OGNI TIMEFRAME.
//
// Riferito dal proprietario (3 novembre 2026): «se io dico che ci sono 300 barre devono esserci
// 300 barre. Se stabilisco 300 barre con un time frame a un minuto, passando a 5 minuti non
// possono dimezzare, e a 15 minuti dimezzarsi ancora... sennò il not volume non riesce bene a
// calcolarlo, perché noi avevamo fatto calcolare su 300 barre. È come funziona su TradingView.»
//
// MISURATO PRIMA DI TOCCARE: le fasce CHIESTE non sono mai dipese dal timeframe — con lo stesso
// storico e 300 fasce, computeVolumeProfile ne restituisce 300 a 1, 5 e 15 minuti. A cambiare
// era quante se ne DISEGNANO: il ciclo del disegno saltava le fasce vuote (`if(total<=0)continue`)
// e, con candele più grosse, di fasce vuote ce ne sono di più. Da qui l'istogramma che "dimezza".
//
// Stessa cura già accettata per la colonna SVP (v2.0.73): la fascia vuota prende una barretta
// minima spenta, così la griglia delle righe è sempre la stessa — ed è quella su cui si misura
// la zona a basso volume.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Conta le fasce chieste e quelle NON vuote, allo stesso numero di barre, su tre timeframe.
const CONTA = `(function(){
  const t0=Date.UTC(2026,9,20,8,0,0); const R=[]; let p=1900;
  for(let i=0;i<600;i++){ p+=(Math.sin(i/13)+Math.cos(i/7))*0.35;
    R.push({date:new Date(t0+i*60000).toISOString(),open:p,high:p+0.8,low:p-0.8,close:p+0.1,volume:10+(i%7)}); }
  csvLibrary=[{name:'t',rows:R}]; rebuildBaseRowsFromLibrary();
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD'; liveModeActive=false; liveReplayActive=false;
  const out={};
  [1,5,15].forEach(function(tf){
    currentTF=tf; masterTime=closeTimeOf(baseRows[baseRows.length-1]); rebuildRows();
    const prof=computeVolumeProfile(0, rows.length-1, 300);
    out['tf'+tf]=prof?prof.buckets:0;
  });
  return out;
})()`;

test('le fasce chieste non cambiano col timeframe', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(CONTA);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.tf1, 300, 'a 1 minuto devono essere 300');
    assert.equal(r.tf5, 300, 'a 5 minuti devono restare 300, non dimezzarsi');
    assert.equal(r.tf15, 300, 'e a 15 minuti ancora 300');
  } finally { await browser.close(); }
});

// COSA HO MISURATO, E PERCHE' QUI NON C'E' UNA CURA.
//
// Il sospetto era che l'istogramma saltasse le fasce VUOTE (`if(total<=0)continue` nel ciclo del
// disegno) e che, con candele piu' grosse, di fasce vuote ce ne fossero di piu'. Ho costruito un
// banco apposta — prezzo quasi fermo per lunghi tratti e poi a scatti — e ho contato: a 15 minuti
// risultavano piene TUTTE E 120 le fasce. Le candele aggregate sono piu' ALTE, quindi il loro
// volume si spalma su PIU' fasce, non su meno: l'opposto del sintomo segnalato.
//
// Quindi il dimezzamento non nasce da li', e non ho toccato quel ciclo: riempire la zona a basso
// volume di barrette grigie avrebbe sporcato proprio la lettura che serve al proprietario, senza
// una misura che lo giustifichi.
//
// PER RIPRENDERE IL LAVORO servono due cose dal caso vero: (1) se il profilo che si dimezza e'
// quello ancorato/a intervallo fisso disegnato a mano oppure quello dell'indicatore «Profili
// volumetrici giornalieri»; (2) se, cambiando timeframe, l'istogramma copre ancora la STESSA
// fascia di prezzo o si accorcia anche quella — perche' se si accorcia il problema e' nel
// risolvere gli ancoraggi del disegno sul nuovo timeframe, non nel conteggio delle fasce.
