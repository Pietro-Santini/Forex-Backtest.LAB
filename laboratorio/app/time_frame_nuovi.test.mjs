// I TIME FRAME NUOVI, E I CONFINI DELLE CANDELE.
//
// RICHIESTO dal proprietario (15 novembre 2026): «aggiungiamo piu' time frame: 3 minuti, 10
// minuti, 2h 3h 4h 5h 12h 2g 3g 5g 1w 2w 1 mese» (4h c'era gia').
//
// IL LAVORO NON ERA IL MENU. I gruppi si contavano dall'EPOCA UNIX:
//     Math.floor(t/(minuti*60000))
// Va bene per 1, 5, 15, 30, 60, 240 minuti, che dividono esattamente la giornata. Per i time
// frame nuovi si sarebbero viste candele dai bordi sbagliati, senza nessun avviso:
//   - 5h (300 min): 1440/300 = 4,8, quindi i confini SLITTANO di giorno in giorno;
//   - 2g, 3g, 5g, 1w, 2w: il 1 gennaio 1970 era un GIOVEDI', quindi le settimane sarebbero
//     cominciate di giovedi';
//   - 1 mese: 43.200 minuti sono 30 giorni fissi, non il mese del calendario.
//
// Qui si prova ogni famiglia, e soprattutto si prova che i TIME FRAME DI SEMPRE non sono
// cambiati: e' la cosa che si romperebbe in silenzio, perche' sotto ai confini delle candele
// stanno footprint, replay e indicatori.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const G = 86400000;

test('NON-REGRESSIONE: i time frame di sempre hanno i confini di prima', async () => {
  // Il conto vecchio, scritto qui in chiaro, contro quello nuovo. Se un giorno divergessero,
  // cambierebbero le candele di tutti gli utenti senza che nessuno l abbia chiesto.
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const vecchio = (t, m) => Math.floor(t / (m * 60000)) * (m * 60000);
      const istanti = [
        Date.UTC(2026, 10, 10, 8, 37, 12),
        Date.UTC(2026, 10, 10, 0, 0, 0),
        Date.UTC(2026, 10, 10, 23, 59, 59),
        Date.UTC(2026, 0, 1, 12, 0, 0),
        Date.UTC(2026, 6, 4, 17, 5, 0)
      ];
      const fuori = [];
      for (const m of [1, 5, 15, 30, 60, 240, 1440]) {
        for (const t of istanti) {
          const a = vecchio(t, m), b = fblInizioBucket(t, m);
          if (a !== b) fuori.push({minuti: m, t, vecchio: a, nuovo: b});
        }
      }
      return {fuori};
    });
    console.log('differenze sui time frame di sempre:', JSON.stringify(r.fuori));
    assert.deepEqual(r.fuori, [],
      'i time frame che esistevano prima devono dare ESATTAMENTE gli stessi confini: '
      + JSON.stringify(r.fuori));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('5 ORE: i confini partono da mezzanotte, non dall epoca', async () => {
  // 1440/300 = 4,8: contando dall epoca le candele attraverserebbero la mezzanotte e si
  // sposterebbero ogni giorno. Ancorate a mezzanotte, invece, ogni giorno comincia alle 00:00.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const giorno = Date.UTC(2026, 10, 10);
      const inizi = [];
      for (let ore = 0; ore < 24; ore++) {
        inizi.push(fblInizioBucket(giorno + ore * 3600000, 300) - giorno);
      }
      // E il giorno dopo deve ricominciare da zero, non proseguire slittato.
      const dopo = Date.UTC(2026, 10, 11);
      const primoDelGiornoDopo = fblInizioBucket(dopo + 60000, 300) - dopo;
      // L ultima candela del giorno e piu corta: dalle 20 alla mezzanotte.
      const ultima = fblInizioBucket(giorno + 22 * 3600000, 300);
      const fineUltima = fblFineBucket(ultima, 300);
      return {oreDiInizio: [...new Set(inizi.map(v => v / 3600000))],
              primoDelGiornoDopo: primoDelGiornoDopo / 3600000,
              ultimaDura: (fineUltima - ultima) / 3600000};
    });
    console.log('5 ore:', JSON.stringify(r));
    assert.deepEqual(r.oreDiInizio, [0, 5, 10, 15, 20],
      'le candele da 5 ore devono cominciare alle 00, 05, 10, 15 e 20: ' + JSON.stringify(r));
    assert.equal(r.primoDelGiornoDopo, 0,
      'il giorno dopo deve ricominciare dalla mezzanotte, non proseguire slittato');
    assert.equal(r.ultimaDura, 4,
      'l ultima candela del giorno dura 4 ore, non 5: e il prezzo di non attraversare la '
      + 'mezzanotte, e va saputo. ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('SETTIMANE: la candela comincia di LUNEDI', async () => {
  // Contando dall epoca sarebbe cominciata di giovedi, perche il 1 gennaio 1970 era un giovedi.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const nomi = ['domenica','lunedi','martedi','mercoledi','giovedi','venerdi','sabato'];
      const prova = (minuti) => {
        const fuori = [];
        // Un anno intero di mercoledi: il bucket deve sempre cadere di lunedi.
        for (let k = 0; k < 52; k++) {
          const t = Date.UTC(2026, 0, 7, 15, 0, 0) + k * 7 * 86400000;
          const inizio = fblInizioBucket(t, minuti);
          const d = new Date(inizio);
          if (d.getUTCDay() !== 1 || d.getUTCHours() !== 0) {
            fuori.push({t, inizio, giorno: nomi[d.getUTCDay()], ora: d.getUTCHours()});
          }
        }
        return fuori;
      };
      // Col conto vecchio, per confronto: di che giorno sarebbe stato?
      const vecchio = Math.floor(Date.UTC(2026, 0, 7) / (10080 * 60000)) * (10080 * 60000);
      return {unaSettimana: prova(10080), dueSettimane: prova(20160),
              giornoDelContoVecchio: nomi[new Date(vecchio).getUTCDay()]};
    });
    console.log('settimane:', JSON.stringify(r));
    assert.equal(r.giornoDelContoVecchio, 'giovedi',
      'controprova: col conto vecchio la settimana cominciava di giovedi. Se questo non fosse '
      + 'vero, la cura non servirebbe a niente e questa prova non misurerebbe nulla.');
    assert.deepEqual(r.unaSettimana, [],
      'la candela da una settimana deve cominciare di lunedi a mezzanotte: '
      + JSON.stringify(r.unaSettimana));
    assert.deepEqual(r.dueSettimane, [],
      'e anche quella da due settimane: ' + JSON.stringify(r.dueSettimane));
  } finally { await browser.close(); }
});

test('GIORNI MULTIPLI: 2, 3 e 5 giorni cadono a mezzanotte e sono lunghi il giusto', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const out = {};
      for (const m of [1440, 2880, 4320, 7200]) {
        const t = Date.UTC(2026, 10, 10, 13, 20, 0);
        const inizio = fblInizioBucket(t, m);
        const fine = fblFineBucket(inizio, m);
        const d = new Date(inizio);
        out[m] = {oraInizio: d.getUTCHours(), minutiInizio: d.getUTCMinutes(),
                  giorniDiDurata: (fine - inizio) / 86400000,
                  contieneLIstante: (inizio <= t && t < fine)};
      }
      return out;
    });
    console.log('giorni multipli:', JSON.stringify(r));
    for (const [m, v] of Object.entries(r)) {
      assert.equal(v.oraInizio, 0, 'il time frame da ' + m + ' minuti deve partire a mezzanotte');
      assert.equal(v.minutiInizio, 0);
      assert.equal(v.giorniDiDurata, Number(m) / 1440,
        'e durare ' + (Number(m) / 1440) + ' giorni: ' + JSON.stringify(v));
      assert.equal(v.contieneLIstante, true,
        'e contenere l istante che lo ha generato: ' + JSON.stringify(v));
    }
  } finally { await browser.close(); }
});

test('UN MESE e il mese del CALENDARIO, non 30 giorni fissi', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const mesi = {};
      for (const [anno, mese, nome] of [[2026,1,'febbraio 2026'],[2024,1,'febbraio 2024 (bisestile)'],
                                        [2026,0,'gennaio 2026'],[2026,3,'aprile 2026']]) {
        const t = Date.UTC(anno, mese, 17, 9, 30, 0);
        const inizio = fblInizioBucket(t, 43200);
        const fine = fblFineBucket(inizio, 43200);
        const d = new Date(inizio);
        mesi[nome] = {giorno: d.getUTCDate(), mese: d.getUTCMonth(), anno: d.getUTCFullYear(),
                      durataGiorni: (fine - inizio) / 86400000};
      }
      return mesi;
    });
    console.log('mesi:', JSON.stringify(r));
    assert.equal(r['febbraio 2026'].durataGiorni, 28, 'febbraio 2026 dura 28 giorni');
    assert.equal(r['febbraio 2024 (bisestile)'].durataGiorni, 29,
      'febbraio 2024 ne dura 29: col conto a 30 giorni fissi sarebbero stati 30 per tutti');
    assert.equal(r['gennaio 2026'].durataGiorni, 31);
    assert.equal(r['aprile 2026'].durataGiorni, 30);
    for (const v of Object.values(r)) {
      assert.equal(v.giorno, 1, 'ogni candela mensile comincia il primo del mese');
    }
  } finally { await browser.close(); }
});

test('L AGGREGAZIONE VERA: le candele si raggruppano come dicono i confini', async () => {
  // Non basta che il conto dei confini sia giusto: va provato che le candele VERE si raggruppino,
  // perche' e' quello che si vede sul grafico.
  //
  // NIENTE NUMERI SCRITTI A MANO, e il motivo e' una misura. La prima versione di questa prova
  // diceva «tre giorni a due ore fanno 36 candele» e trovava 37: le date scritte come
  // "2026-11-09 00:00" diventano le 05:00 dentro l'app, perche' parseDateTime le interpreta nel
  // fuso dell'applicazione. I dati quindi NON cominciano su un confine, e il primo gruppo e'
  // parziale - cosa giusta, che un numero fisso scambiava per un difetto.
  // Si controllano invece le proprieta' che devono valere SEMPRE, qualunque sia l'allineamento:
  //   1. tante candele quanti sono i gruppi distinti dei dati di partenza;
  //   2. nessun volume perso e nessuno contato due volte;
  //   3. candele in ordine, senza doppioni.
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const base = Date.UTC(2026, 10, 9);   // 9 novembre 2026, un lunedi
      const R = [];
      for (let i = 0; i < 3 * 24 * 60; i++) {
        const o = 1.08 + i * 0.000001;
        R.push({date: new Date(base + i * 60000).toISOString().slice(0,16).replace('T',' '),
                open: o, high: o + 0.0001, low: o - 0.0001, close: o + 0.00005, volume: 1});
      }
      baseRows = R;
      rowsAssetKey = currentAssetKey = 'EURUSD';
      liveModeActive = false; liveReplayActive = false;
      masterTime = closeTimeOf(baseRows[baseRows.length - 1]);
      const tempiBase = baseRows.map(x => parseDateTime(x.date));
      const volumeTotale = baseRows.reduce((a, x) => a + x.volume, 0);
      const out = {primoOrario: new Date(tempiBase[0]).toISOString().slice(0,16),
                   volumeTotale, tf: {}};
      for (const m of [1, 3, 10, 60, 120, 180, 300, 720, 1440, 2880, 4320, 7200,
                       10080, 20160, 43200]) {
        currentTF = m;
        rebuildRows();
        const gruppiAttesi = new Set(tempiBase.map(t => fblInizioBucket(t, m))).size;
        const volume = rows.reduce((a, x) => a + (Number(x.volume) || 0), 0);
        let inOrdine = true;
        for (let k = 1; k < rows.length; k++) {
          if (!(parseDateTime(rows[k].date) > parseDateTime(rows[k-1].date))) inOrdine = false;
        }
        out.tf[m] = {candele: rows.length, gruppiAttesi, volume, inOrdine};
      }
      return out;
    });
    console.log('primo orario dentro l app:', r.primoOrario, '| volume totale:', r.volumeTotale);
    console.log('aggregazione:', JSON.stringify(r.tf));
    for (const [m, v] of Object.entries(r.tf)) {
      assert.equal(v.candele, v.gruppiAttesi,
        'a ' + m + ' minuti le candele devono essere quante i gruppi dei dati di partenza: '
        + JSON.stringify(v));
      assert.equal(v.volume, r.volumeTotale,
        'a ' + m + ' minuti non si deve perdere ne contare due volte nessuna candela: '
        + JSON.stringify(v));
      assert.equal(v.inOrdine, true,
        'a ' + m + ' minuti le candele devono essere in ordine e senza doppioni');
    }
    // CONTROPROVA: i time frame alti devono davvero RAGGRUPPARE, altrimenti le tre verifiche
    // qui sopra sarebbero vere anche se l aggregazione non facesse niente.
    assert.ok(r.tf[1440].candele < r.tf[60].candele,
      'a un giorno devono esserci meno candele che a un ora: ' + JSON.stringify(r.tf[1440]));
    assert.ok(r.tf[43200].candele <= 2,
      'tre giorni di dati stanno in uno o due mesi di calendario: ' + JSON.stringify(r.tf[43200]));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('A MT5 si chiede il piu grande time frame che DIVIDE quello voluto', async () => {
  // Prima si ripiegava su M1 per tutto cio che non era in mappa: per un mese sarebbero 43.200
  // candele da un minuto, e per uno storico sensato centinaia di migliaia.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const out = {};
      for (const m of [1, 3, 5, 10, 15, 30, 60, 120, 180, 240, 300, 720, 1440, 2880, 4320,
                       7200, 10080, 20160, 43200]) out[m] = fblTfMt5Per(m);
      return out;
    });
    console.log('time frame chiesti a MT5:', JSON.stringify(r));
    assert.equal(r[3], 'M3');
    assert.equal(r[10], 'M10');
    assert.equal(r[120], 'H2');
    assert.equal(r[180], 'H3');
    assert.equal(r[300], 'H1',
      'MT5 non ha H5: si chiede H1, che divide 300, e si aggrega per cinque');
    assert.equal(r[720], 'H12');
    for (const m of [2880, 4320, 7200, 10080, 20160, 43200]) {
      assert.equal(r[m], 'D1',
        'per giorni, settimane e mese si chiede D1, non M1: ' + m + ' -> ' + r[m]);
    }
    // E i time frame di sempre non cambiano la richiesta.
    assert.equal(r[1], 'M1'); assert.equal(r[5], 'M5'); assert.equal(r[15], 'M15');
    assert.equal(r[30], 'M30'); assert.equal(r[60], 'H1'); assert.equal(r[240], 'H4');
    assert.equal(r[1440], 'D1');
  } finally { await browser.close(); }
});

test('i time frame chiesti sono TUTTI nel menu', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const leggi = (id) => {
        const el = document.getElementById(id);
        return el ? Array.from(el.options).map(o => Number(o.value)) : null;
      };
      return {grafico: leggi('tfChart'), nascosto: leggi('tf')};
    });
    console.log('menu:', JSON.stringify(r));
    const attesi = [1, 3, 5, 10, 15, 30, 60, 120, 180, 240, 300, 720,
                    1440, 2880, 4320, 7200, 10080, 20160, 43200];
    assert.deepEqual(r.grafico, attesi,
      'il menu sul grafico deve avere tutti i time frame chiesti, in ordine: '
      + JSON.stringify(r.grafico));
    assert.deepEqual(r.nascosto, attesi,
      'e anche la copia tecnica, altrimenti le due si contraddicono: '
      + JSON.stringify(r.nascosto));
  } finally { await browser.close(); }
});
