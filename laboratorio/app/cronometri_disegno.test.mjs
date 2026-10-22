// CAPITOLO 7b — I CRONOMETRI DENTRO draw(), SEZIONE PER SEZIONE.
//
// PERCHE' ESISTE QUESTO TEST.
// La misura del proprietario (22 ottobre) ha detto una cosa che ha smentito il sospetto di
// partenza: il disegno si mangia il 78% del tempo, ma tutti i pezzi gia' cronometrati insieme
// (le funzioni che draw() chiama) fanno il 3,4%. Il 96,6% sta nel CORPO di draw(). Per
// guardare li' servono i cronometri di sezione, e un cronometro che nessuno controlla puo'
// dire qualunque cosa: qui si controlla che MISURI IL DISEGNO DAVVERO.
//
// I tre casi:
//  1. con i cronometri accesi, la somma delle sezioni e' vicina al tempo totale del disegno
//     (se le sezioni dicessero zero, il rapporto sarebbe zero: e' la prova che misurano);
//  2. con i cronometri spenti il disegno non accumula niente (lo strumento non resta attaccato);
//  3. la misura dell'app riporta le sezioni nel suo risultato (quello che il proprietario legge).
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp, PREPARA_BTC} from './aiuti.mjs';

test('i cronometri di sezione misurano DAVVERO il disegno: la somma delle sezioni e\' il tempo del disegno', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA_BTC);
    const esito = await pagina.evaluate(async () => {
      fblSezioniDraw = {};
      fblCronoSezioni = true;
      const t0 = performance.now();
      for(let i = 0; i < 20; i++)draw();
      const totale = performance.now() - t0;
      fblCronoSezioni = false;
      const sezioni = Object.assign({}, fblSezioniDraw);
      let somma = 0;
      for(const k of Object.keys(sezioni))somma += sezioni[k];
      return {sezioni, nomi: Object.keys(sezioni), totale, somma};
    });

    // Le sezioni ci sono, e sono quelle del corpo di draw() (non un numero inventato).
    assert.ok(esito.nomi.length >= 10,
      'le sezioni cronometrate sono almeno dieci, trovate: ' + esito.nomi.length + ' (' + esito.nomi.join(', ') + ')');
    for(const nome of ['avvio', 'grigliaPrezzi', 'grigliaTempo', 'candele', 'disegniUtente', 'coda']){
      assert.ok(esito.nomi.includes(nome), 'manca la sezione "' + nome + '"');
    }

    // Le candele si disegnano davvero (non un grafico vuoto).
    assert.ok(esito.sezioni.candele > 0,
      'la sezione "candele" e\' costata qualcosa: ' + esito.sezioni.candele + ' ms');

    // LA PROVA CHE MISURANO: la somma delle sezioni copre il tempo del disegno. Se i cronometri
    // dicessero zero (o un numero inventato) questo rapporto non tornerebbe.
    assert.ok(esito.totale > 0, 'il disegno e\' costato qualcosa: ' + esito.totale + ' ms');
    const rapporto = esito.somma / esito.totale;
    assert.ok(rapporto > 0.5 && rapporto < 1.5,
      'la somma delle sezioni (' + esito.somma.toFixed(2) + ' ms) copre il tempo del disegno (' +
      esito.totale.toFixed(2) + ' ms): rapporto ' + rapporto.toFixed(2));

    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con i cronometri spenti il disegno non accumula niente: lo strumento non resta attaccato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA_BTC);
    const esito = await pagina.evaluate(async () => {
      // Si accende, si disegna, si spegne: da qui in poi il disegno non deve piu' toccare i conti.
      fblSezioniDraw = {};
      fblCronoSezioni = true;
      draw();
      fblCronoSezioni = false;
      const dopoUna = JSON.stringify(fblSezioniDraw);
      for(let i = 0; i < 5; i++)draw();
      return {dopoUna, dopoCinque: JSON.stringify(fblSezioniDraw), acceso: fblCronoSezioni};
    });
    assert.equal(esito.acceso, false, 'i cronometri sono spenti fuori dalla misura');
    assert.equal(esito.dopoCinque, esito.dopoUna,
      'con i cronometri spenti cinque disegni non cambiano i conti: ' + esito.dopoUna);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la misura dell\'app riporta le sezioni del disegno: e\' il numero che il proprietario legge', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA_BTC);
    const r = await pagina.evaluate(async () => {
      // La misura gira un secondo: intanto si disegna, come farebbe l'app col mercato aperto.
      const misura = fblMisuraPrestazioni(1);
      for(let i = 0; i < 12; i++){ draw(); await new Promise(res => setTimeout(res, 80)); }
      return await misura;
    });

    assert.ok(r.disegni > 0, 'la misura ha visto dei disegni: ' + r.disegni);
    assert.equal(typeof r.sezioniDelDisegno_ms, 'string',
      'il risultato della misura contiene le sezioni del disegno: ' + JSON.stringify(r.sezioniDelDisegno_ms));
    assert.ok(r.sezioniDelDisegno_ms.includes('candele'),
      'tra le sezioni c\'e\' il disegno delle candele: ' + r.sezioniDelDisegno_ms);
    assert.ok(r.sezioniTotale_ms > 0,
      'e il loro totale e\' un numero vero: ' + r.sezioniTotale_ms + ' ms per disegno');
    // La misura non deve piu' dire che non si e' disegnato niente: qui si e' disegnato.
    assert.ok(!String(r.ATTENZIONE || '').includes('non si e\' disegnato'),
      'la misura non si lamenta che non si e\' disegnato: ' + r.ATTENZIONE);
    // E dopo la misura i cronometri sono spenti: il disegno di tutti i giorni non li paga.
    const acceso = await pagina.evaluate(() => fblCronoSezioni);
    assert.equal(acceso, false, 'alla fine della misura i cronometri si spengono');

    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
