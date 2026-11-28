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
      // La serie generata e' di gennaio: con l'ora corrente il "delta" sarebbe enorme e l'app
      // riscaricherebbe 20.000 candele. La si ribasa sugli ultimi minuti, come nel banco live,
      // per misurare la richiesta di coda (pochi minuti) e non la riscarica.
      const MIN = 60000;
      const ultimo = Math.floor(Date.now() / MIN) * MIN - 2 * MIN;
      const scarto = ultimo - righe[righe.length - 1].time * 1000;
      for (const r of righe) {
        r.time = Math.floor((r.time * 1000 + scarto) / 1000);
        r.date = new Date(r.time * 1000).toISOString();
      }
      await fblCandeleCacheScrivi('XAUUSD', 'M1', righe, 2, 0);
      try {
        // Si riproduce il caso vero: Live, MT5 collegato, grafico a 15 minuti, nessuna serie in
        // memoria. Con la serie nel magazzino la rete puo' servire solo il delta di minuti
        // mancanti: deve restare piccolo, non il solito scarico da 20.000 candele.
        liveModeActive = true; liveReplayActive = false;
        mt5ActiveSymbol = 'XAUUSD';
        currentAssetKey = 'XAUUSD'; rowsAssetKey = 'XAUUSD';
        currentTF = 15;
        fblSerieM1Dimentica();
        // Si registra ogni richiesta con i suoi parametri: il `count` distingue il delta (piccolo)
        // dallo scarico da 20.000 candele. La rete e' comunque spenta: se il delta fallisce, la
        // serie del magazzino deve restare valida.
        const richieste = [];
        const veroFetch = window.fetch;
        window.fetch = function (...a) {
          const url = String(a[0] && a[0].url ? a[0].url : a[0]);
          const m = /[?&]count=(\d+)/.exec(url);
          richieste.push({url, count: m ? Number(m[1]) : null});
          return Promise.reject(new Error('rete non deve servire'));
        };
        try {
          fblSerieM1Assicura();
          if (fblM1InCorso) await fblM1InCorso;
        } finally { window.fetch = veroFetch; }
        const righeM1 = fblM1Serie.rows || [];
        const perTime = new Map(righeM1.map(x => [x.time, x]));
        const primo = perTime.get(righe[0].time);
        const ultimo = perTime.get(righe[righe.length - 1].time);
        return {richieste, righe: righeM1.length, asset: fblM1Serie.asset,
                primo: primo ? primo.close : null, ultimo: ultimo ? ultimo.close : null,
                attesoPrimo: righe[0].close, attesoUltimo: righe[righe.length - 1].close};
      } finally {
        await idbDel('candleCache:XAUUSD::M1'); await idbDel('candleCache:XAUUSD::1');
        fblSerieM1Dimentica();
      }
    }, SERIE);
    console.log('risultato:', JSON.stringify(r));
    // (a) Una richiesta per il delta e' ammessa; e' vietata invece ogni richiesta con `count`
    //     grande (20.000): qui si misura l'intenzione, non il numero di chiamate.
    const grandi = r.richieste.filter(x => x.count !== null && x.count >= 1000);
    assert.deepEqual(grandi, [], 'non scarica 20.000 candele: nessuna richiesta con count >= 1000 (richieste: ' + JSON.stringify(r.richieste) + ')');
    // (b) Qualunque sia l'esito della richiesta delta, la serie resta quella del magazzino.
    assert.ok(r.righe === 300 && r.primo === r.attesoPrimo && r.ultimo === r.attesoUltimo, 'la serie dopo il giro viene dal magazzino: 300 righe con prezzi coerenti');
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
