// NELLA FINESTRA DUPLICATA IL DIALOGO «RICERCA SIMBOLO» DEVE AVERE GLI STESSI ASSET DELLA MADRE.
//
// MISURATO dal proprietario con due screenshot (8 novembre 2026):
//   madre:     «ASSET DISPONIBILI (35)», stelline della watchlist piene;
//   duplicata: «ASSET DISPONIBILI (5)»,  stelline tutte vuote.
//
// CAUSA MISURATA nel codice: availableAssets() costruisce l'elenco dalle voci di #market piu'
// customAssets. Una finestra PIP aggiuntiva nasce VUOTA per scelta esplicita (initExtraPipWindow),
// quindi parte con i cinque simboli di default e customAssets vuoto: anche se la madre ne ha
// trentacinque, la duplicata non può mostrarne piu' di cinque.
//
// CURA: la madre passa il proprio elenco e la propria watchlist sullo STESSO messaggio che già
// usa per il clone (pip_clone_snapshot), e la duplicata lo applica all'apertura.
//
// Il test misura il COMPORTAMENTO. Come fa a non misurarsi addosso: la madre è un ELENCO DI DATI
// qui sotto, non uno stato applicato a questa finestra - se la si costruisse davvero sulla
// finestra, la duplicata avrebbe già gli asset della madre e il test sarebbe verde a vuoto
// (provato: era esattamente l'errore della prima stesura).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Cosa possiede la MADRE: un elenco di dati, non uno stato di questa pagina.
const MADRE = {
  assets: ['EURUSD','GBPUSD','USDJPY','XAUUSD','XAGUSD','US30','SILVER','GBPJPY','AUDUSD','NZDUSD'],
  customAssets: [
    {symbol:'US30', name:'Wall Street 30', type:'indici'},
    {symbol:'SILVER', name:'Argento', type:'metalli'}
  ],
  watchlist: ['XAUUSD','EURUSD']
};

test('la duplicata eredita l\'elenco degli asset della madre (voce 4/5)', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=2'});
  try{
    const r = await pagina.evaluate((madre) => {
      // Prima: solo i cinque di default della finestra appena nata.
      const prima = availableAssets().length;
      // Ora arriva lo snapshot della madre.
      tradingChannel.onmessage({data:{
        type:'pip_clone_snapshot', slot:0, storico:true, asset:'XAUUSD',
        styleFields:{}, mt5Connected:false,
        assets: madre.assets, customAssets: madre.customAssets, watchlist: madre.watchlist
      }});
      const dopo = availableAssets();
      const sel = $('market');
      const nelMenu = sym => sel ? [...sel.options].some(o => o.value === sym) : false;
      const nomeUS30 = nelMenu('US30') ? (() => { const o = [...sel.options].find(x => x.value==='US30'); return o ? o.textContent : ''; })() : '';
      return {
        prima, madre: madre.assets.length, dopo: dopo.length,
        tuttiQuelliDellaMadre: madre.assets.every(nelMenu),
        nomeUS30, wl: favoriteAssets.slice(),
        ordineUguale: JSON.stringify(dopo.filter(a => madre.assets.includes(a))) ===
                      JSON.stringify(madre.assets.filter(a => dopo.includes(a)))
      };
    }, MADRE);
    assert.ok(r.prima < r.madre,
      'la duplicata deve nascere con meno asset della madre (era il difetto): ' + JSON.stringify(r));
    assert.equal(r.dopo, r.madre,
      'dopo lo snapshot li deve avere tutti, contati: ' + JSON.stringify(r));
    assert.equal(r.tuttiQuelliDellaMadre, true,
      'e devono essere nel menu, non solo in un contatore: ' + JSON.stringify(r));
    assert.equal(r.ordineUguale, true,
      "nello stesso ordine della madre (l'utente ha chiesto «elencati allo stesso modo»): " + JSON.stringify(r));
    assert.equal(r.nomeUS30.indexOf('Wall Street')>=0, true,
      "e col nome che aveva nella madre, non il simbolo nudo: '" + r.nomeUS30 + "'");
    assert.ok(r.wl.indexOf('XAUUSD')>=0 && r.wl.indexOf('EURUSD')>=0,
      'e la watchlist della madre deve arrivare con le sue stelline: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: uno snapshot senza elenco non cancella niente', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=3'});
  try{
    const r = await pagina.evaluate(() => {
      const prima = availableAssets().length;
      const wlPrima = favoriteAssets.slice();
      tradingChannel.onmessage({data:{type:'pip_clone_snapshot', slot:0, storico:true,
        asset:'XAUUSD', styleFields:{}, mt5Connected:false}});
      return {prima, dopo: availableAssets().length, wlPrima, wlDopo: favoriteAssets.slice()};
    });
    assert.equal(r.dopo, r.prima,
      'senza elenco nel messaggio non si tocca niente: ' + JSON.stringify(r));
    assert.deepEqual(r.wlDopo, r.wlPrima,
      'e la watchlist non si svuota per un messaggio che non la porta: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
