// CAPITOLO 8.6.19 — CAMPIONI DI MEMORIA OGNI 60 SECONDI, FINO A 240 RIGHE.
//
// PERCHE' ESISTE QUESTO TEST.
// Il cervello del progetto (STATO-SCALETTA-19-NOVEMBRE.md, righe 64 e 139) ricorda:
// «Campionamento memoria ogni 60s (fblMemoriaCampioni, max 240 righe, t/mb/nodi),
// esposto in fblMisuraPrestazioni» e, il 27 novembre, «PERSO». La funzione e il
// suo banco sono spariti sia da app.html sia dalla storia git: li riportiamo.
//
// Il banco e' BEHAVIORAL e gira dentro la pagina: orologio, MB e conteggio nodi
// sono INIETTATI. Nessun timer reale, nessun performance.memory vero, nessun DOM
// inventato: se una lettura manca, non deve nascere una riga con uno zero falso
// (Number(null) vale 0, e qui 0 MB e' un valore lecito).
//
// Undici prove: le dieci del modulo di migrazione, piu' l'integrazione con il
// referto delle prestazioni (l'ultimo campione passato come contesto).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// PROVA DI CONTROLLO (senza toccare il repo): se FBL_APP_PROVA punta a una copia
// temporanea di app.html, il banco carica QUELLA invece del file del repo. Serve a
// mostrare il rosso quando il gestore del pulsante non passa il contesto.
const APP_PROVA = process.env.FBL_APP_PROVA || null;
async function apriBanco(opzioni = {}) {
  if (!APP_PROVA) return apriApp(opzioni);
  const vecchia = opzioni.primaDiNavigare || null;
  return apriApp(Object.assign({}, opzioni, {primaDiNavigare: async (pagina) => {
    if (vecchia) await vecchia(pagina);
    await pagina.route((u) => u.pathname.endsWith('/app.html'), (r) => r.fulfill({path: APP_PROVA, contentType: 'text/html'}));
  }}));
}

// Aiuti installati DENTRO la pagina, prima di ogni prova. Chiamano le funzioni
// globali solo al momento dell'uso: cosi', se mancano, la prova fallisce per la
// ragione giusta (funzione assente) e non per un aiuto rotto.
const PREPARA_BANCO = () => {
  window.__orologioFinto = (inizio) => {
    let t = inizio === undefined ? 0 : inizio;
    return {ora: () => t, avanza: (dt) => { t += dt; }};
  };
  window.__campionatoreCon = (o, mb, nodi, extra) => window.fblMemoriaCreaCampionatore(Object.assign({
    ora: o.ora,
    memoriaMb: typeof mb === 'function' ? mb : () => mb,
    nodiPagina: typeof nodi === 'function' ? nodi : () => nodi,
  }, extra || {}));
};

// ---- Il ritmo ---------------------------------------------------------

test('8.6.19: il primo campione nasce subito, con t/mb/nodi iniettati', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    await pagina.evaluate(PREPARA_BANCO);
    const esito = await pagina.evaluate(() => {
      const o = window.__orologioFinto(1000);
      const c = window.__campionatoreCon(o, 128.5, 4300);
      const r = c.campiona();
      return {aggiunto: r.aggiunto, righe: c.stato.campioni.length, primo: c.stato.campioni[0]};
    });
    assert.equal(esito.aggiunto, true);
    assert.equal(esito.righe, 1);
    assert.deepEqual(esito.primo, {t: 1000, mb: 128.5, nodi: 4300});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('8.6.19: prima dei 60 secondi non si aggiunge nessuna riga', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    await pagina.evaluate(PREPARA_BANCO);
    const esito = await pagina.evaluate(() => {
      const o = window.__orologioFinto(0);
      const c = window.__campionatoreCon(o, 100, 10);
      c.campiona();
      o.avanza(30000);
      const prima = c.campiona();
      const righeDopoMezzo = c.stato.campioni.length;
      o.avanza(30000);
      const seconda = c.campiona();
      return {prima: prima.aggiunto, righeDopoMezzo, seconda: seconda.aggiunto,
              righe: c.stato.campioni.length, t: c.stato.campioni[1] && c.stato.campioni[1].t};
    });
    assert.equal(esito.prima, false);
    assert.equal(esito.righeDopoMezzo, 1);
    assert.equal(esito.seconda, true);
    assert.equal(esito.righe, 2);
    assert.equal(esito.t, 60000);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('8.6.19: intervallo iniettato, nessun timer interno', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    await pagina.evaluate(PREPARA_BANCO);
    const esito = await pagina.evaluate(() => {
      const o = window.__orologioFinto(500);
      const c = window.__campionatoreCon(o, 10, 1, {intervalloMs: 1000});
      c.campiona();
      o.avanza(999);
      const prima = c.campiona().aggiunto;
      o.avanza(1);
      const seconda = c.campiona().aggiunto;
      const altro = window.__campionatoreCon(window.__orologioFinto(99000), 20, 2, {intervalloMs: 1000});
      altro.campiona();
      return {prima, seconda, t: altro.stato.campioni[0].t};
    });
    assert.equal(esito.prima, false);
    assert.equal(esito.seconda, true);
    assert.equal(esito.t, 99000);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('8.6.19: fblMemoriaDeveCampionare e\' puro e non dipende da uno stato mutabile', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    const esito = await pagina.evaluate(() => ({
      a: window.fblMemoriaDeveCampionare(null, 0, 60000),
      b: window.fblMemoriaDeveCampionare({ultimoT: 100}, 100 + 59999, 60000),
      c: window.fblMemoriaDeveCampionare({ultimoT: 100}, 100 + 60000, 60000),
    }));
    assert.equal(esito.a, true);
    assert.equal(esito.b, false);
    assert.equal(esito.c, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ---- Il tetto di 240 righe -------------------------------------------

test('8.6.19: il tetto e\' 240 righe e cadono le piu\' vecchie', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    await pagina.evaluate(PREPARA_BANCO);
    const esito = await pagina.evaluate(() => {
      const o = window.__orologioFinto(0);
      const c = window.__campionatoreCon(o, 42, 7);
      for (let i = 0; i < 250; i++) { c.campiona(); o.avanza(60000); }
      return {righe: c.stato.campioni.length, primo: c.stato.campioni[0].t,
              ultimo: c.stato.campioni[239] && c.stato.campioni[239].t};
    });
    assert.equal(esito.righe, 240);
    assert.equal(esito.primo, 600000);
    assert.equal(esito.ultimo, 249 * 60000);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('8.6.19: il tetto e\' iniettabile', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    await pagina.evaluate(PREPARA_BANCO);
    const esito = await pagina.evaluate(() => {
      const o = window.__orologioFinto(0);
      const c = window.__campionatoreCon(o, 1, 1, {maxRighe: 3});
      for (let i = 0; i < 5; i++) { c.campiona(); o.avanza(60000); }
      return {righe: c.stato.campioni.length, tempi: c.stato.campioni.map((r) => r.t)};
    });
    assert.equal(esito.righe, 3);
    assert.deepEqual(esito.tempi, [120000, 180000, 240000]);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ---- Crescita e integrazione con fblMisuraPrestazioni ----------------

test('8.6.19: crescita misura il delta MB fra primo e ultimo campione', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    const esito = await pagina.evaluate(() => {
      const righe = [
        {t: 0, mb: 100, nodi: 100},
        {t: 60000, mb: 140, nodi: 120},
        {t: 120000, mb: 130, nodi: 115},
      ];
      return {q: window.fblMemoriaCrescita(righe), vuota: window.fblMemoriaCrescita([])};
    });
    assert.equal(esito.q.righe, 3);
    assert.equal(esito.q.inizioMb, 100);
    assert.equal(esito.q.fineMb, 130);
    assert.equal(esito.q.deltaMb, 30);
    assert.equal(esito.q.massimoMb, 140);
    assert.equal(esito.q.minimoMb, 100);
    assert.equal(esito.vuota.righe, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('8.6.19: il referto prestazioni legge l\'ultimo campione', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    await pagina.evaluate(PREPARA_BANCO);
    const esito = await pagina.evaluate(() => {
      const o = window.__orologioFinto(0);
      const c = window.__campionatoreCon(o, () => 100 + o.ora() / 60000, () => 500 + o.ora() / 60000);
      c.campiona();
      o.avanza(60000);
      c.campiona();
      return {contesto: window.fblMemoriaContestoPerMisura(c),
              vuoto: window.fblMemoriaContestoPerMisura(null)};
    });
    assert.equal(esito.contesto.memoria_MB, 101);
    assert.equal(esito.contesto.nodiPagina, 501);
    assert.deepEqual(esito.vuoto, {memoria_MB: null, nodiPagina: 0});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ---- Guasti e valori mancanti ----------------------------------------

test('8.6.19: una lettura non valida non inventa un campione', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    await pagina.evaluate(PREPARA_BANCO);
    const esito = await pagina.evaluate(() => {
      const o = window.__orologioFinto(0);
      const c = window.__campionatoreCon(o, () => null, () => 5);
      const r = c.campiona();
      const guasto = window.__campionatoreCon(o, () => { throw new Error('letto negato'); }, () => 5);
      let lanciato = false;
      try { guasto.campiona(); } catch (e) { lanciato = true; }
      return {aggiunto: r.aggiunto, righe: c.stato.campioni.length, motivo: r.motivo,
              righeGuasto: guasto.stato.campioni.length, lanciato};
    });
    assert.equal(esito.aggiunto, false);
    assert.equal(esito.righe, 0);
    assert.match(esito.motivo, /non valida/);
    assert.equal(esito.lanciato, false);
    assert.equal(esito.righeGuasto, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('8.6.19: nodi mancanti restano null, orologio assente non lancia', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    const esito = await pagina.evaluate(() => {
      const c = window.fblMemoriaCreaCampionatore({memoriaMb: 12});
      let lanciato = false, lanciatoVuoto = false;
      try { c.campiona(); } catch (e) { lanciato = true; }
      try { window.fblMemoriaCreaCampionatore().campiona(); } catch (e) { lanciatoVuoto = true; }
      const r = c.stato.campioni[0];
      return {lanciato, lanciatoVuoto, mb: r && r.mb, nodi: r && r.nodi};
    });
    assert.equal(esito.lanciato, false);
    assert.equal(esito.mb, 12);
    assert.equal(esito.nodi, null, 'una lettura mancante non diventa uno zero inventato');
    assert.equal(esito.lanciatoVuoto, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ---- L'integrazione vera: il contesto arriva al referto ---------------

test('8.6.19: il contesto passato a fblMisuraPrestazioni contiene i valori dell\'ultimo campione', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    await pagina.evaluate(PREPARA_BANCO);
    const esito = await pagina.evaluate(async () => {
      const o = window.__orologioFinto(0);
      const c = window.__campionatoreCon(o, () => 100 + o.ora() / 60000, () => 500 + o.ora() / 60000);
      c.campiona();
      o.avanza(60000);
      c.campiona();
      const contesto = window.fblMemoriaContestoPerMisura(c);
      // Il contesto dell'ultimo campione viene passato al referto: i valori che
      // il proprietario legge devono essere quelli li', non una lettura nuova.
      const r = await window.fblMisuraPrestazioni(1, contesto);
      return {contesto, memoria: r.memoria_MB, nodi: r.nodiPagina,
              secondi: r.secondi, quando: r.quando, risvegli: r.risvegliAlSecondo};
    });
    assert.deepEqual(esito.contesto, {memoria_MB: 101, nodiPagina: 501});
    assert.equal(esito.memoria, 101, 'il referto riporta la memoria dell\'ultimo campione');
    assert.equal(esito.nodi, 501, 'il referto riporta i nodi dell\'ultimo campione');
    // Il formato del referto esistente non cambia: le chiavi di sempre ci sono.
    assert.equal(typeof esito.secondi, 'number');
    assert.equal(typeof esito.quando, 'string');
    assert.equal(typeof esito.risvegli, 'number');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ---- I cinque rilievi del revisore ------------------------------------

test('8.6.19: un contesto con memoria vuota non diventa 0 MB nel referto', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    const esito = await pagina.evaluate(async () => {
      const r = await window.fblMisuraPrestazioni(1, {memoria_MB: '', nodiPagina: '  '});
      return {memoria: r.memoria_MB, nodi: r.nodiPagina};
    });
    assert.notEqual(esito.memoria, 0, 'una stringa vuota non puo diventare 0 MB: ' + esito.memoria);
    assert.ok(esito.memoria === null || esito.memoria > 0,
      'senza memoria valida resta null, o la lettura viva: ' + esito.memoria);
    assert.ok(esito.nodi > 0, 'anche gli spazi non diventano zero nodi: ' + esito.nodi);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('8.6.19: il pulsante Misura passa l ultimo campione globale al referto', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    // fblMemoriaCampioni e' una costante globale: si riempie il SUO stato, non si sostituisce.
    const esiste = await pagina.evaluate(() => {
      fblMemoriaCampioni.stato.campioni.length = 0;
      fblMemoriaCampioni.stato.campioni.push({t: 1000, mb: 321.5, nodi: 777});
      window.fblUltimaMisuraPrestazioni = null;
      return !!document.getElementById('fblMisuraPrestBtn');
    });
    assert.equal(esiste, true, 'il pulsante Misura esiste nella pagina');
    await pagina.evaluate(() => document.getElementById('fblMisuraPrestBtn').click());

    // Il gestore impiega cinque secondi: si aspetta il referto, non un timer del banco.
    await pagina.waitForFunction(() => window.fblUltimaMisuraPrestazioni != null, null, {timeout: 15000});
    const esito = await pagina.evaluate(() => ({
      memoria: window.fblUltimaMisuraPrestazioni.memoria_MB,
      nodi: window.fblUltimaMisuraPrestazioni.nodiPagina,
    }));
    assert.equal(esito.memoria, 321.5, 'il referto riporta la memoria dell ultimo campione globale');
    assert.equal(esito.nodi, 777, 'il referto riporta i nodi dell ultimo campione globale');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('8.6.19: la crescita arriva nel referto con la chiave memoriaCrescita', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    const esito = await pagina.evaluate(async () => {
      fblMemoriaCampioni.stato.campioni.length = 0;
      fblMemoriaCampioni.stato.campioni.push(
        {t: 0, mb: 100, nodi: 10},
        {t: 60000, mb: 140, nodi: 12},
        {t: 120000, mb: 130, nodi: 11});
      const r = await window.fblMisuraPrestazioni(1);
      return r.memoriaCrescita;
    });
    assert.equal(esito.righe, 3);
    assert.equal(esito.deltaMb, 30);
    assert.equal(esito.massimoMb, 140);
    assert.equal(esito.minimoMb, 100);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('8.6.19: fblMemoriaCrescita scarta mb null e non inventa uno zero', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    const esito = await pagina.evaluate(() => window.fblMemoriaCrescita([
      {t: 0, mb: null, nodi: 1}, {t: 1, mb: 20, nodi: 2},
      {t: 2, mb: '', nodi: 3}, {t: 3, mb: '  ', nodi: 4},
    ]));
    assert.equal(esito.minimoMb, 20, 'il minimo e 20, non uno zero inventato: ' + esito.minimoMb);
    assert.equal(esito.massimoMb, 20);
    assert.equal(esito.inizioMb, 20);
    assert.equal(esito.fineMb, 20);
    assert.equal(esito.deltaMb, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('8.6.19: nodi null nel campione non diventano 0 nel referto', async () => {
  const {browser, pagina, errori} = await apriBanco();
  try {
    const esito = await pagina.evaluate(async () => {
      const c = window.fblMemoriaCreaCampionatore({
        ora: () => 1000, memoriaMb: () => 100, nodiPagina: () => null,
      });
      c.campiona();
      const contesto = window.fblMemoriaContestoPerMisura(c);
      const r = await window.fblMisuraPrestazioni(1, contesto);
      return {nodiCampione: c.stato.campioni[0].nodi, contesto,
              nodiReferto: r.nodiPagina, memoria: r.memoria_MB};
    });
    assert.equal(esito.nodiCampione, null, 'nel campione la lettura mancante resta null');
    assert.equal(esito.contesto.nodiPagina, null, 'nel contesto resta null');
    assert.ok(esito.nodiReferto > 0, 'il referto usa il conteggio vivo, non uno zero inventato');
    assert.equal(esito.memoria, 100);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
