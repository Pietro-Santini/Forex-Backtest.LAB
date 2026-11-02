// IL FILTRO "A MERCATO CHIUSO" COSTRUIVA IL CALENDARIO PER OGNI CANDELA.
//
// Difetto segnalato dal proprietario (1-2 novembre 2026): "l'applicazione crasha di continuo,
// non risponde dopo l'apertura". Misurato: a mercato chiuso getVisibleData() chiamava
// fblMercatoFermoOra(currentAssetKey,t) per OGNI candela visibile; ogni chiamata costruisce il
// calendario dello strumento (orariIntervalli: dieci giorni, dieci Intl per fuso) e cerca la
// riapertura su 4*24*60 minuti. Con una fascia di candele che sta PRIMA della chiusura (il caso
// vero: mercato chiuso alle 22, candele fino alle 22) il ciclo non si interrompe mai: tanti
// calendari quante candele, nello stesso giro di disegno -> thread principale bloccato,
// "Non risponde".
//
// Dopo la cura: il calendario si costruisce UNA volta, si prende l'ultima chiusura passata e il
// confronto fra candele è un semplice `>=` fra timestamp. Stesso risultato, un calendario solo.
//
// Il test misura il COMPORTAMENTO, non il testo del sorgente: conta quante volte il calendario
// viene costruito durante una singola getVisibleData(), e controlla che le candele mostrate
// siano ESATTAMENTE quelle di prima (che il filtro tagli ancora dove deve).
//
// L'orologio si blocca (Date.now) e il fuso del calendario si mette a UTC: senza, la prova
// dipenderebbe dall'ora e dal giorno in cui gira, e non misurerebbe niente di stabile.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Martedì 3 novembre 2026, 23:00 UTC: mercato chiuso (la fascia del giorno è finita alle 22).
const ADESSO = Date.UTC(2026, 10, 3, 23, 0, 0);
// Le candele finiscono ALL'ORA DI CHIUSURA: tutta la fascia visibile sta prima della chiusura,
// che è il caso peggiore (quello che bloccava la pagina).
const N_CANDELE = 30 * 60;
const ORE = 16;

const PREPARA = (function(){
  return `(function(){
    if(!window.__orologioVero)window.__orologioVero=Date.now;
    Date.now=function(){ return ${ADESSO}; };
    const N=${N_CANDELE};
    const fine=${ADESSO}-3600000;            // un'ora prima: ultima candela 22:00
    const inizio=fine-N*60000;
    const R=[];
    for(let i=0;i<N;i++){
      const c=100+i*0.0005;
      R.push({date:new Date(inizio+i*60000).toISOString(),open:c,high:c+0.05,low:c-0.05,close:c,volume:1});
    }
    rows=R; baseRows=R; viewEnd=R.length-1; idx=R.length-1;
    rowsAssetKey='XAUUSD'; currentAssetKey='XAUUSD';
    liveModeActive=true; liveReplayActive=false; followLatest=false;
    try{ document.getElementById('market').value='XAUUSD'; }catch(e){}
    const giorni={};
    ['mon','tue','wed','thu','fri','sat','sun'].forEach(function(g){ giorni[g]=['00:00 - 22:00']; });
    orariAsset['XAUUSD']={zona:'UTC',giorni:giorni,stato:null,letto:${ADESSO}};
    return {candele:rows.length, chiusura:${ADESSO}-7200000};
  })()`;
})();

test('a mercato chiuso il calendario si costruisce UNA volta, non una per candela', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const prep = await pagina.evaluate(PREPARA);
    assert.equal(prep.candele, N_CANDELE, 'la prova deve partire da una giornata intera di candele');

    const esito = await pagina.evaluate(`(function(){
      const vera=window.orariIntervalli;
      window.__nCalendari=0;
      window.orariIntervalli=function(){ window.__nCalendari++; return vera.apply(this,arguments); };
      try{
        // LA STESSA fascia di candele che guarda getVisibleData().
        const win=getViewWindow();
        const src=rows.slice(win.dataStart,Math.min(rows.length,win.dataEnd+1));
        // Il risultato atteso, col metodo di prima: una domanda al calendario per candela.
        const attesi=[];
        for(let i=0;i<src.length;i++){
          const r=src[i], t=parseDateTime(r.date);
          if(!Number.isFinite(t)){ attesi.push(r); continue; }
          if(fblMercatoFermoOra(currentAssetKey,t)) break;
          attesi.push(r);
        }
        // ATTENZIONE AL NUMERO: è quello che misura il difetto.
        window.__nCalendari=0;
        const visti=getVisibleData();
        const calendari=window.__nCalendari;
        return {presenti:src.length, attesi:attesi.length, visti:visti.length, calendari:calendari};
      }finally{
        window.orariIntervalli=vera;
        Date.now=window.__orologioVero;
      }
    })()`);

    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.ok(esito.presenti > 60,
      'la prova deve avere abbastanza candele visibili da contare, altrimenti misura il vuoto: ' + esito.presenti);
    assert.equal(esito.visti, esito.attesi,
      'il grafico deve mostrare le stesse candele di prima (' + esito.attesi + ' su ' + esito.presenti + ')');
    // Il limite cresce col logaritmo delle candele (ricerca a metà), NON con le candele.
    // Col metodo di prima il numero era uguale alle candele visibili (24 su 24) e cresceva con esse.
    const limite = 4 + Math.ceil(Math.log2(esito.presenti + 1));
    assert.ok(esito.calendari <= limite,
      'il calendario si deve cercare su metà fascia, non candela per candela: ' + esito.calendari +
      ' calendari per ' + esito.presenti + ' candele (limite ' + limite + ')');
    // Prova di controllo SENZA la quale il test potrebbe misurare il vuoto: se il filtro non
    // tagliasse niente, "una candela sola" sarebbe vero per il motivo sbagliato.
    assert.ok(esito.visti < esito.presenti,
      'il filtro deve tagliare davvero le candele dopo la chiusura (' + esito.presenti + ' -> ' + esito.visti + ')');
  } finally { await browser.close(); }
});
