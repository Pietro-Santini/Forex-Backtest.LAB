// UN INDICATORE AGGIUNTO DOPO RIPARTE DALL'ULTIMO SETTAGGIO USATO, NON DAI PREDEFINITI.
//
// CHIESTO dal proprietario (12 novembre 2026): «quando vado nelle impostazioni e vado a salvare
// il setup, applico il nome e non me lo salva»; e le tre richieste collegate: «il setup salvato
// su una pagina duplicata deve essere salvato su tutte le pagine duplicate, cioe' all'interno di
// Forex Backtest LAB in generale»; «un indicatore aggiunto dopo deve ricordare l'ultimo settaggio
// usato, non ripartire dal predefinito».
//
// MISURATO il 13 novembre, prima di toccare niente: il setup NOMINATO si salva davvero (si
// scrive in localStorage, sopravvive alla riapertura della pagina, e funziona anche in una
// finestra duplicata). Quindi il «non me lo salva» non era quello. Quello che mancava davvero e'
// la memoria dell'ULTIMO settaggio: togliendo un indicatore e rimettendolo tornavano i
// predefiniti - e da fuori e' identico a «non ha salvato niente».
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('cambiando un parametro e riaggiungendo l indicatore, il valore resta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const key = 'ema_ind', def = INDICATOR_DEFS[key];
      try { localStorage.removeItem('fbtUltimiParam_v1_' + key); } catch (e) {}
      activeIndicators = [];
      // 1) si aggiunge come fa il menu
      addIndicator(key);
      const nato = activeIndicators[0];
      const predefinito = def.defaultParams().length;
      // 2) si cambia un parametro, come fa il pannello (stessa riga dell'evento 'change')
      nato.params.length = 123;
      fblRicordaParamIndicatore(key, nato.params);
      // 3) si toglie l'indicatore e lo si rimette
      activeIndicators = [];
      addIndicator(key);
      const rinato = activeIndicators[0];
      return {predefinito, dopoIlCambio: nato.params.length, rinato: rinato.params.length,
              chiaviRicordate: Object.keys(rinato.params).sort().join(',') ===
                               Object.keys(def.defaultParams()).sort().join(',')};
    });
    console.log('setup ricordato:', JSON.stringify(r));
    assert.notEqual(r.predefinito, 123, 'la prova non vale se 123 e gia il predefinito');
    assert.equal(r.dopoIlCambio, 123, 'il cambio si applica');
    assert.equal(r.rinato, 123,
      'riaggiungendo l indicatore deve tornare l ultimo settaggio usato, non il predefinito: ' +
      JSON.stringify(r));
    assert.equal(r.chiaviRicordate, true,
      'e le chiavi devono restare quelle che l indicatore conosce oggi');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un settaggio vecchio con chiavi sparite non rompe l indicatore', async () => {
  // Un indicatore cambia nel tempo: parametri che spariscono, parametri nuovi. Il settaggio
  // ricordato ieri non deve poter rompere quello di oggi.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const key = 'ema_ind', def = INDICATOR_DEFS[key];
      const base = def.defaultParams();
      // Si finge un settaggio vecchio: una chiave che non esiste piu, e una che manca.
      const vecchio = {...base, parametroSparito: 'xyz', length: 55};
      delete vecchio.color;
      localStorage.setItem('fbtUltimiParam_v1_' + key, JSON.stringify(vecchio));
      activeIndicators = [];
      addIndicator(key);
      const p = activeIndicators[0].params;
      let calcolo = 'ok';
      try {
        const t0 = Date.now() - 300 * 60000, R = [];
        for (let i = 0; i < 300; i++) { const x = 100 + Math.sin(i / 7);
          R.push({date: new Date(t0 + i * 60000).toISOString(), open: x, high: x + 1, low: x - 1, close: x, volume: 5}); }
        rows = R; baseRows = R; idx = R.length - 1;
        def.compute(rows, idx, activeIndicators[0]);
      } catch (e) { calcolo = 'ERRORE: ' + e.message; }
      return {length: p.length, color: p.color, sparito: ('parametroSparito' in p), calcolo};
    });
    console.log('settaggio vecchio:', JSON.stringify(r));
    assert.equal(r.length, 55, 'il valore ancora valido si tiene');
    assert.ok(r.color, 'una chiave che mancava deve arrivare dai predefiniti: ' + JSON.stringify(r));
    assert.equal(r.sparito, false, 'una chiave che non esiste piu non deve entrare');
    assert.equal(r.calcolo, 'ok', 'e il calcolo deve funzionare: ' + r.calcolo);
  } finally { await browser.close(); }
});

test('un setup cambiato in un altra finestra arriva anche qui', async () => {
  // «deve essere salvato su tutte le pagine duplicate, cioe' all'interno di Forex Backtest LAB
  // in generale». localStorage e' gia' condiviso fra le finestre della stessa origine, ma la
  // finestra che non l'ha scritto resterebbe con i valori di prima finche' non la si riapre.
  const {browser, pagina} = await apriApp({query: '?pipSlot=2'});
  try {
    const r = await pagina.evaluate(() => {
      const key = 'ema_ind';
      try { localStorage.removeItem('fbtUltimiParam_v1_' + key); } catch (e) {}
      const prima = fblParamRicordatiIndicatore(key);
      // Arriva l'annuncio di un'altra finestra, sul canale vero.
      tradingChannel.onmessage({data: {type: 'setup_indicatore', slot: 0, key,
                                       params: {...INDICATOR_DEFS[key].defaultParams(), length: 99}}});
      const dopo = fblParamRicordatiIndicatore(key);
      activeIndicators = [];
      addIndicator(key);
      return {prima, dopo: dopo ? dopo.length : null, nuovoIndicatore: activeIndicators[0].params.length};
    });
    console.log('fra finestre:', JSON.stringify(r));
    assert.equal(r.prima, null, 'si parte senza niente');
    assert.equal(r.dopo, 99, 'il settaggio annunciato da un altra finestra si registra qui: ' + JSON.stringify(r));
    assert.equal(r.nuovoIndicatore, 99,
      'e un indicatore aggiunto qui adesso nasce con quel settaggio: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: i setup NOMINATI restano una cosa a parte', async () => {
  // I setup col nome sono scelte che l'utente ha battezzato: non devono cambiare da sole perche'
  // nel frattempo ha mosso una manopola.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(async () => {
      const key = 'ema_ind', def = INDICATOR_DEFS[key];
      try { localStorage.removeItem('fbtPresets_v1_' + key); } catch (e) {}
      activeIndicators = [];
      addIndicator(key);
      const ind = activeIndicators[0];
      ind.params.length = 7;
      window.appPrompt = async () => 'Il mio setup';
      await savePresetForIndicator(ind);
      // Adesso si cambia la manopola: il setup NOMINATO non si deve muovere.
      ind.params.length = 88;
      fblRicordaParamIndicatore(key, ind.params);
      const salvato = loadIndicatorPresets(key)['Il mio setup'];
      return {nelSetupNominato: salvato ? salvato.length : null,
              ultimoUsato: fblParamRicordatiIndicatore(key).length};
    });
    console.log('nominato vs ultimo:', JSON.stringify(r));
    assert.equal(r.nelSetupNominato, 7, 'il setup col nome resta com era: ' + JSON.stringify(r));
    assert.equal(r.ultimoUsato, 88, 'e l ultimo settaggio usato e un altra cosa');
  } finally { await browser.close(); }
});
