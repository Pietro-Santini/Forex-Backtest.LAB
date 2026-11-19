// LA SERIE AL MINUTO DEI PROFILI DEVE USCIRE DAL MAGAZZINO.
//
// DALLA CONSEGNA (punto 8.2 #7): «La serie al minuto dei profili non usa mai il magazzino: chi legge
// cerca `::1`, chi scrive salva `::M1`. Ramo morto, e ogni volta si scaricano 20.000 candele dalla
// rete.»
//
// MISURATO: il grafico scrive la voce con la chiave `candleCache:XAUUSD::M1` (la stringa di
// `fblTfMt5Per`), mentre `fblSerieM1Assicura` la cerca con `1` (il numero): `candleCache:XAUUSD::1`.
// Due chiavi diverse per la stessa serie. Quando il magazzino non risponde, e c'e' MT5 collegato,
// parte una richiesta da 20.000 candele al servizio dati: e' il difetto del proprietario (rete e
// tempo) e non il magazzino che non funziona.
//
// QUESTO BANCO GUARDA IL COMPORTAMENTO, non il testo del codice: scrive come scrive il grafico e
// legge come leggono i profili, poi spegne la rete e pretende che la serie si trovi lo stesso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SERIE = `(function(n){
  const t0=Date.UTC(2026,0,1,10,0,0), R=[];
  for(let i=0;i<n;i++){
    const ms=t0+i*60000;
    R.push({date:new Date(ms).toISOString(), time:Math.floor(ms/1000),
            open:1+i/1000, high:1.2+i/1000, low:0.8+i/1000, close:1.1+i/1000, volume:5+i%3});
  }
  return R;
})`;

test('una serie M1 scritta dal grafico si ritrova quando la cercano i profili', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (serie) => {
      const righe = eval(serie)(50);
      // Si scrive con l'API del grafico, che riceve il time frame come lo manda MT5 ('M1').
      await fblCandeleCacheScrivi('XAUUSD', 'M1', righe, 2, 0);
      try {
        const grafico = await fblCandeleCacheLeggi('XAUUSD', 'M1');
        const profili = await fblCandeleCacheLeggi('XAUUSD', 1);
        return {grafico: grafico && grafico.rows ? grafico.rows.length : 0,
                profili: profili && profili.rows ? profili.rows.length : 0,
                chiavi: (await idbChiavi()).filter(k => String(k).indexOf('candleCache:XAUUSD') === 0)};
      } finally {
        await idbDel('candleCache:XAUUSD::M1'); await idbDel('candleCache:XAUUSD::1');
      }
    }, SERIE);
    console.log('letto:', JSON.stringify(r));
    assert.equal(r.grafico, 50, 'il grafico deve rileggere quello che ha scritto');
    assert.equal(r.profili, 50, 'i profili devono trovare la serie scritta dal grafico (chiavi: ' + JSON.stringify(r.chiavi) + ')');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con la serie nel magazzino i profili non scaricano 20.000 candele dalla rete', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (serie) => {
      const righe = eval(serie)(300);   // sopra le 200 che il profilo considera utilizzabili
      await fblCandeleCacheScrivi('XAUUSD', 'M1', righe, 2, 0);
      try {
        // Si riproduce il caso vero: Live, MT5 collegato, grafico a 15 minuti, nessuna serie in
        // memoria. Se il magazzino risponde, il ramo di rete non deve nemmeno partire.
        liveModeActive = true; liveReplayActive = false;
        mt5ActiveSymbol = 'XAUUSD';
        currentAssetKey = 'XAUUSD'; rowsAssetKey = 'XAUUSD';
        currentTF = 15;
        fblSerieM1Dimentica();
        let richieste = 0;
        const veroFetch = window.fetch;
        window.fetch = function (...a) { richieste++; return Promise.reject(new Error('rete non deve servire')); };
        try {
          fblSerieM1Assicura();
          if (fblM1InCorso) await fblM1InCorso;
        } finally { window.fetch = veroFetch; }
        return {richieste, righe: fblM1Serie.rows ? fblM1Serie.rows.length : 0,
                asset: fblM1Serie.asset};
      } finally {
        await idbDel('candleCache:XAUUSD::M1'); await idbDel('candleCache:XAUUSD::1');
        fblSerieM1Dimentica();
      }
    }, SERIE);
    console.log('risultato:', JSON.stringify(r));
    assert.equal(r.richieste, 0, 'la serie era nel magazzino: nessuna richiesta al servizio dati');
    assert.equal(r.righe, 300, 'la serie al minuto deve essere quella del magazzino');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: time frame diversi restano voci diverse', async () => {
  // Se il banco passasse perche' la chiave e' stata svuotata di ogni distinzione (una voce sola per
  // tutte), due serie diverse si sovrascriverebbero: qui si scrivono M1 e M15 con lunghezze
  // diverse e si pretende che restino due.
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (serie) => {
      const a = eval(serie)(50), b = eval(serie)(30);
      await fblCandeleCacheScrivi('XAUUSD', 'M1', a, 2, 0);
      await fblCandeleCacheScrivi('XAUUSD', 'M15', b, 2, 0);
      try {
        const m1 = await fblCandeleCacheLeggi('XAUUSD', 1);
        const m15 = await fblCandeleCacheLeggi('XAUUSD', 'M15');
        return {m1: m1 && m1.rows ? m1.rows.length : 0, m15: m15 && m15.rows ? m15.rows.length : 0};
      } finally {
        await idbDel('candleCache:XAUUSD::M1'); await idbDel('candleCache:XAUUSD::1');
        await idbDel('candleCache:XAUUSD::M15'); await idbDel('candleCache:XAUUSD::15');
      }
    }, SERIE);
    console.log('letto:', JSON.stringify(r));
    assert.equal(r.m1, 50, 'la voce del minuto resta quella del minuto');
    assert.equal(r.m15, 30, 'la voce a 15 minuti resta la sua');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
