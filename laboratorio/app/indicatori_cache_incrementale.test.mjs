// BANCO ROSSO — «con quattro indicatori accesi il grafico va a 4,7 fotogrammi al secondo».
//
// QUANDO QUESTO BANCO ENTRA NEL REPOSITORY (laboratorio/app/), l'unica riga da cambiare e'
// l'import: diventa   import {apriApp} from './aiuti.mjs';
//
// LA MISURA DEL PROPRIETARIO che lo ha fatto nascere (pannello prestazioni, 12 novembre 2026
// 17:30, v2.2.12, 50.029 candele, quattro indicatori accesi):
//     fotogrammiAlSecondo 4,7   disegnoMedio_ms 64,44   sezioni: indicatori=58,11 (il resto ~6)
//     ind:bsl_ssl_fvg:calcolo 23,15   ind:amd_poc_trade:calcolo 20,83
//     ind:order_blocks:calcolo 12,34  ind:ema_ind:calcolo 1,42
//     (i rispettivi :disegno costano 0,04-0,16 ms: NON e' il disegno, e' il CALCOLO)
//
// COSA MISURA, e perche' ognuna delle tre prove e' una REGOLA e non un gusto:
//
//   1. L'IDENTITA' DELLE CANDELE NON DEVE CAMBIARE SE E' CAMBIATA SOLO LA CODA.
//      In diretta, a ogni prezzo che arriva, `rebuildBaseRowsFromLibrary()` (app.html riga
//      12581) fa `baseRows = src.slice()` e `rebuildRows()` (riga 12458) fa
//      `const disp = fullAgg.slice()`. Due array nuovi di zecca per una candela che si e'
//      mossa di mezzo pip. La `.slice()` e' VOLUTA e il commento accanto lo dice: serviva a
//      invalidare le cache di `getBaseTimes()`/`getFullAgg()`, che confrontano per
//      riferimento. Nessuno ha visto che la stessa riga azzera anche le cache dei 17 calcoli
//      degli indicatori.
//
//   2. NESSUN INDICATORE DEVE AZZERARE `builtTo` SE E' CAMBIATA SOLO LA CODA.
//      Tutti e 17 i calcoli con cache sono scritti per essere INCREMENTALI: tengono
//      `st.builtTo` e il ciclo e' `for(let i=st.builtTo+1;i<=upToIdx;i++)`. Ma la guardia che
//      decide se tenere la cache e'
//          if(st.ref!==rows || st.builtParamsKey!==JSON.stringify(p) || upToIdx<st.builtTo)
//      e `st.ref!==rows` confronta per RIFERIMENTO. Con la prova 1 rossa, questa e' sempre
//      vera: la macchina incrementale c'e' e non viene mai lasciata lavorare.
//
//   3. IL RAPPORTO, non il tempo secco. Un millisecondo misurato su una macchina carica e'
//      un'opinione (il proprietario lavora sulla stessa macchina, e 20 browser invisibili del
//      collaudo la piegano). Quindi si misurano DUE cose nello STESSO giro e si confronta:
//      quanto costa un tick, e quanto costa un ricalcolo da zero. Un tick guadagna UNA candela
//      su decine di migliaia: deve costare una frazione del ricalcolo intero. La soglia e' un
//      ventesimo — larghissima, perche' a regime il rapporto misurato con l'identita' stabile
//      e' circa un millesimo. OGGI IL RAPPORTO MISURATO VALE 0,50 a m5 e 0,59 a m1: un tick
//      costa fra la meta' e i tre quinti di un ricalcolo da zero. Non e' 1,0 tondo per un
//      motivo onesto e non per un risparmio: il PRIMO giro paga anche la compilazione a caldo
//      del browser, i giri dopo no. Il lavoro svolto e' lo stesso, tutte le candele da capo.
//
// PERCHE' IL SOSPETTO NUMERO DUE E' INNOCENTE, e sta qui perche' non torni: `JSON.stringify(p)`
// dei parametri, eseguito a ogni fotogramma per ogni indicatore, costa 0,2-0,8 MICROsecondi
// (mille giri cronometrati in diag_indicatori_cache.mjs). Su quattro indicatori sono 0,002 ms
// per fotogramma: tre ordini di grandezza sotto il difetto. Non va toccato.
//
// LA STRADA DELLA CURA, con un precedente gia' in casa: il 9 novembre lo stesso problema era
// stato risolto SOLO per `getFullAgg()`. `fblStessoLivello()` (riga 12304) riconosce «sono le
// stesse candele» con tre punti fissi (prima, mezzo, ultima) e uno scarto dello 0,5%, e
// `segnalaCodaCambiata()` dice alle cache «e' cambiata solo la coda, da questo indice». Oggi
// quel segnale lo legge solo `getFullAgg` (`codaValidaPer`). Gli indicatori non lo vedono.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// I quattro indicatori della misura del proprietario, nello stesso ordine.
const QUATTRO = ['bsl_ssl_fvg', 'amd_poc_trade', 'order_blocks', 'ema_ind'];

// Prepara la pagina come la diretta vera: 50.029 candele da 1 minuto nella libreria Live, i
// quattro indicatori accesi con i loro parametri di serie, e poi TICK tick con la stessa coda
// che esegue `applyLivePriceToChart()` (app.html riga 50831): il prezzo nuovo entra
// nell'ultima candela, poi `rebuildBaseRowsFromLibrary()` e `rebuildRows()`.
async function misura(pagina, {tf, candele = 50029, tick = 20}) {
  return await pagina.evaluate(async ([tf, N, TICK, CHIAVI]) => {
    const R = [];
    // Base oraria DENTRO la sessione di New York: le sessioni di amd_poc_trade sono in ora di
    // New York, e con tutte le candele fuori sessione il suo calcolo salterebbe quasi tutto —
    // la misura sarebbe falsa per difetto, cioe' una misura che consola.
    const t0 = Date.UTC(2026, 9, 1, 14, 0, 0);
    let p = 2000;
    for (let i = 0; i < N; i++) {
      const o = p;
      const c = p + Math.sin(i / 11) * 1.2 + Math.sin(i / 97) * 4;
      R.push({date: new Date(t0 + i * 60000).toISOString(), open: o,
              high: Math.max(o, c) + 0.4, low: Math.min(o, c) - 0.4, close: c, volume: 10 + (i % 7)});
      p = c;
    }

    liveModeActive = true;
    csvLibrary = [{name: 'live', rows: R, addedAt: Date.now()}];
    currentAssetKey = 'MT5:EURUSD';
    activeIndicators = hydrateIndicators(CHIAVI.map((k, i) => ({
      id: 'banco' + i, key: k, params: INDICATOR_DEFS[k].defaultParams(), hidden: false
    })));

    currentTF = tf;
    fullAggCache = new Map();
    baseRowsCoda = null;
    baseRows = [];
    rebuildBaseRowsFromLibrary();
    masterTime = closeTimeOf(baseRows[baseRows.length - 1]);
    rebuildRows();

    // SE LA PREPARAZIONE NON VALE, LA PROVA DEVE CADERE, NON SALTARE (regola del cervello,
    // 12 novembre: un banco che si salta da' una sicurezza falsa, peggio di uno rosso).
    if (!rows || rows.length < 1000) return {errore: 'candele non preparate: ' + (rows ? rows.length : 'nessuna')};
    if (activeIndicators.length !== CHIAVI.length) return {errore: 'indicatori non accesi: ' + activeIndicators.length};

    // --- A) QUANTO COSTA UN RICALCOLO DA ZERO, tutti e quattro insieme ---
    activeIndicators.forEach(ind => { ind.calc = {ref: null, builtTo: -1}; });
    const a0 = performance.now();
    activeIndicators.forEach(ind => INDICATOR_DEFS[ind.key].compute(rows, idx, ind));
    const daZero = performance.now() - a0;

    // --- B) QUANTO COSTA UN TICK, e quante volte si butta la cache ---
    let cambiIdentita = 0;
    let prevSerie = (typeof rowsSerie === 'function') ? rowsSerie() : null;
    const azzerati = {}; const costo = {};
    CHIAVI.forEach(k => { azzerati[k] = 0; costo[k] = 0; });
    let prevRows = rows;
    let tickFatti = 0;
    const b0 = performance.now();
    for (let t = 0; t < TICK; t++) {
      const L = csvLibrary[0].rows[csvLibrary[0].rows.length - 1];
      const nuovo = L.close + (t % 2 ? 0.05 : -0.05);
      L.close = nuovo;
      if (nuovo > L.high) L.high = nuovo;
      if (nuovo < L.low) L.low = nuovo;
      rebuildBaseRowsFromLibrary();
      masterTime = closeTimeOf(baseRows[baseRows.length - 1]);
      rebuildRows();
      tickFatti++;
      // LA TARGA, NON IL RIFERIMENTO (13 novembre 2026). Qui si contava `rows !== prevRows`,
      // cioe' il cambio di IDENTITA' dell'array. La cura presa e' un'altra: la `.slice()` resta
      // (serve a invalidare getBaseTimes()/getFullAgg(), che non sono state toccate) e cambia
      // cosa CONFRONTANO le guardie degli indicatori - una targa della serie. Il risultato che
      // conta e' lo stesso e si misura qui: la targa non deve cambiare se e' cresciuta la coda.
      const serieOra = (typeof rowsSerie === 'function') ? rowsSerie() : ('senza-targa:' + t);
      if (serieOra !== prevSerie) cambiIdentita++;
      prevSerie = serieOra;
      prevRows = rows;
      activeIndicators.forEach(ind => {
        // La guardia vera di app.html, letta PRIMA di chiamare compute: e' questa che butta.
        // E' una COPIA di quella che sta nel sorgente, e va tenuta in passo: il 13 novembre il
        // confronto e' passato dal riferimento (`ind.calc.ref !== rows`) alla targa della serie,
        // e questa riga ha continuato a dire «buttata» quando non lo era piu'. Qui la copia si
        // accetta perche' questo banco MISURA il meccanismo: la prova che conta davvero - il
        // rapporto fra il costo di un tick e quello di un ricalcolo da zero - non dipende da
        // nessuna copia, e cadrebbe lo stesso se la cache venisse buttata per un altro motivo.
        const butta = (ind.calc.serie !== rowsSerie())
          || (ind.calc.builtParamsKey !== JSON.stringify(ind.params))
          || (idx < ind.calc.builtTo);
        if (butta) azzerati[ind.key]++;
        const a = performance.now();
        INDICATOR_DEFS[ind.key].compute(rows, idx, ind);
        costo[ind.key] += performance.now() - a;
      });
    }
    const perTick = (performance.now() - b0) / TICK;

    const arrotonda = (o) => { const f = {}; Object.keys(o).forEach(k => f[k] = Math.round(o[k] / TICK * 100) / 100); return f; };
    return {
      tf, candele: rows.length, tickFatti,
      cambiIdentita,
      azzerati,
      daZero_ms: Math.round(daZero * 100) / 100,
      perTick_ms: Math.round(perTick * 100) / 100,
      perTickPerIndicatore_ms: arrotonda(costo),
      // IL NUMERO CHE CONTA: quanta parte di un ricalcolo intero costa un singolo tick.
      // Due misure dello stesso giro: la macchina carica le sposta entrambe, il rapporto resta.
      quotaDiUnRicalcolo: daZero > 0 ? Math.round(perTick / daZero * 1000) / 1000 : null,
      memoria_MB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null
    };
  }, [tf, candele, tick, QUATTRO]);
}

// Il tetto del rapporto: un tick guadagna UNA candela su decine di migliaia, quindi non puo'
// costare piu' di un ventesimo di un ricalcolo da zero. Con l'identita' stabile il rapporto
// misurato e' circa un millesimo (0,001): la soglia e' venti volte larga di proposito, cosi'
// non diventa un banco che cade per il vento.
const TETTO_QUOTA = 0.05;

for (const tf of [5, 1]) {
  const nome = tf === 1 ? 'a m1 (50.029 candele, il caso del proprietario)' : 'a m5 (50.029 minuti aggregati)';

  test(`gli indicatori non ricalcolano da zero a ogni tick — ${nome}`, async (t) => {
    const {browser, pagina, errori} = await apriApp();
    try {
      const m = await misura(pagina, {tf});
      assert.equal(m.errore, undefined, 'la preparazione del banco non e\' valida: ' + m.errore);
      t.diagnostic(JSON.stringify(m));

      // PROVA 1 — l'identita' delle candele non cambia se e' cambiata solo la coda.
      assert.equal(m.cambiIdentita, 0,
        `la targa della serie e' cambiata ${m.cambiIdentita} volte su ${m.tickFatti} tick, ` +
        `e un tick muove solo l'ultima candela. Causa: rebuildBaseRowsFromLibrary() riga 12581 ` +
        `(\`baseRows=src.slice()\`) e rebuildRows() riga 12458 (\`const disp=fullAgg.slice()\`). ` +
        `Serve una targa della serie (cambia su asset/timeframe/storico ricaricato/salto nel ` +
        `replay, NON sulla coda), come fa gia' fblStessoLivello()+segnalaCodaCambiata() per getFullAgg().`);

      // PROVA 2 — nessun indicatore butta la cache se e' cambiata solo la coda.
      QUATTRO.forEach(k => {
        assert.equal(m.azzerati[k], 0,
          `l'indicatore ${k} ha buttato la cache ${m.azzerati[k]} volte su ${m.tickFatti} tick ` +
          `e ha rifatto ${m.candele} candele da capo per guadagnarne una. Il suo calcolo E' ` +
          `incrementale (st.builtTo): e' la guardia \`st.ref!==rows\` che non lo lascia lavorare.`);
      });

      // PROVA 3 — IL RAPPORTO: un tick non costa un ricalcolo intero.
      assert.ok(m.quotaDiUnRicalcolo <= TETTO_QUOTA,
        `un tick costa il ${Math.round(m.quotaDiUnRicalcolo * 100)}% di un ricalcolo da zero ` +
        `(tick ${m.perTick_ms} ms, da zero ${m.daZero_ms} ms su ${m.candele} candele): il tetto ` +
        `e' il ${TETTO_QUOTA * 100}%. Dettaglio per indicatore, ms per tick: ` +
        JSON.stringify(m.perTickPerIndicatore_ms) + '. Con l\'identita\' stabile la quota ' +
        `misurata e' ~0,001 (tutti e quattro sotto 0,01 ms per tick).`);

      assert.equal(errori.length, 0, 'errori in pagina durante la misura: ' + errori.slice(0, 3).join(' | '));
    } finally {
      await browser.close();
    }
  });
}
