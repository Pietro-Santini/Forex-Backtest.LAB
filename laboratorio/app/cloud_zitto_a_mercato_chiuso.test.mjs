// A MERCATO CHIUSO NON SI CHIEDE NIENTE AL CLOUD.
//
// MISURATO dal proprietario (7 novembre 2026): a mercato chiuso il progetto continua a leggere
// e scrivere - letture 6,4K al giorno, scritture 3,1K - e «in realta' non dovrebbe ne' leggere
// ne' scrivere nulla a mercati chiusi».
//
// La rete di sicurezza rilegge l'intero documento dal cloud ogni 60 secondi: a mercato chiuso
// gli altri dispositivi non stanno lavorando sul grafico, quindi e' una lettura al minuto per
// scoprire niente. Quindi, chiuso, si allenta a mezz'ora; e se qualcosa cambia davvero (si
// torna sull'app, la si riapre, si tocca un disegno) la rilettura parte lo stesso, perche'
// quei casi passano forza=true.
//
// COME SI MIDE. La decisione sta in una funzione sua (fblGraficoRiletturaConsentita): si prova
// LEI, che e' il comportamento che abbiamo curato. Non si puo' contare le chiamate al cloud
// sostituendole: dentro il guscio la chiamata sta in un try/catch e nel banco `cloud` non
// esiste nemmeno - la sostituzione non attacca e il contatore resta a zero (provato: i test
// erano verdi per sbaglio, cioe' non misuravano niente).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = () => {
  rows = []; baseRows = []; let p = 4100;
  for (let i = 0; i < 40; i++) {
    rows.push({date: new Date(Date.now() - (40 - i) * 60000).toISOString(), open: p, high: p + 1, low: p - 1, close: p, volume: 1});
  }
  baseRows = rows.slice(); idx = rows.length - 1; viewEnd = rows.length;
  currentAssetKey = 'XAUUSD'; csvLibrary = [{id: 'x', rows}];
  liveModeActive = true; liveReplayActive = false; mt5Connected = false;
  orariAsset['XAUUSD'] = {zona: 'UTC', giorni: {mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: []},
                          stato: 'CLOSED', letto: Date.now()};
};

test('a mercato chiuso la rilettura si allenta: la prima si, le subito dopo no', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      (${PREPARA})();
      return {
        prima: fblGraficoRiletturaConsentita(false),
        seconda: fblGraficoRiletturaConsentita(false),
        terza: fblGraficoRiletturaConsentita(false),
        chiuso: fblMercatoFermoOra(currentAssetKey, Date.now())
      };
    })()`);
    assert.equal(r.chiuso, true, 'il banco deve avere il mercato davvero chiuso: ' + JSON.stringify(r));
    assert.equal(r.prima, true, 'la prima rilettura si concede (senza, non si vedrebbe mai niente)');
    assert.equal(r.seconda, false,
      'la seconda di fila no: a mercato chiuso non si chiede niente al cloud: ' + JSON.stringify(r));
    assert.equal(r.terza, false, 'neanche la terza: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('col mercato APERTO la rilettura continua come prima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      (${PREPARA})();
            // MT5 e' l'autorita': se dice che il mercato e' aperto, non e' fermo. Sabato o no,
      // cosi' si prova il caso "mercato aperto" senza dipendere dal giorno in cui gira.
      fblMercatoMt5Cache['XAUUSD'] = {aperto: true, letto: Date.now()};
      return {
        prima: fblGraficoRiletturaConsentita(false),
        seconda: fblGraficoRiletturaConsentita(false),
        terza: fblGraficoRiletturaConsentita(false),
        chiuso: fblMercatoFermoOra(currentAssetKey, Date.now())
      };
    })()`);
    assert.equal(r.chiuso, false, 'il mercato deve risultare aperto: ' + JSON.stringify(r));
    assert.equal(r.prima, true, 'a mercato aperto ogni giro rilegge');
    assert.equal(r.seconda, true, 'e continua: ' + JSON.stringify(r));
    assert.equal(r.terza, true, 'e continua: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con forza=true la rilettura parte comunque, anche a mercato chiuso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(function(){
      (${PREPARA})();
      const prima = fblGraficoRiletturaConsentita(false);   // il primo giro si concede sempre
      const senza = fblGraficoRiletturaConsentita(false);   // subito dopo, chiuso, no
      const con = fblGraficoRiletturaConsentita(true);
      return {prima: prima, senza: senza, con: con};
    })()`);
    assert.equal(r.prima, true, 'il primo giro si concede sempre');
    assert.equal(r.senza, false, 'senza forza, a mercato chiuso, la seconda di fila non passa');
    assert.equal(r.con, true,
      'tornando sull app la rilettura parte: un giro forzato non si nega a nessuno');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
