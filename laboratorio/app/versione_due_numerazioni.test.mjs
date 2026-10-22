// «SEI ALL'ULTIMA VERSIONE» DETTO A CHI E' INDIETRO DI DIECI VERSIONI.
//
// SEGNALATO dal proprietario con la schermata sotto gli occhi: «mi dice sempre che l'applicazione
// e' stata portata all'ultima versione mentre invece ancora non lo e'... mi dice l'ultima versione
// v2.0.19 ma in realta' mancano le cose della v2.0.18 e v2.0.19, manca proprio il tasto delle
// prestazioni».
//
// Il pannello scriveva, tutto insieme:
//     Versione installata su questo dispositivo: 167
//     Ultima versione pubblicata: v2.0.19   (sei all'ultima versione)
//
// LA CAUSA: 167 e' la VECCHIA numerazione (un contatore che saliva di uno a ogni consegna),
// 2.0.19 la NUOVA (maggiore.minore.correzione). Il confronto le trattava come due numeri della
// stessa specie: 2 contro 167 al primo pezzo, quindi l'installata risultava PIU' NUOVA della
// pubblicata.
//
// E LO STESSO CONFRONTO HA UN SECONDO MESTIERE che nessuno guardava: sceglie quale cache del
// service worker e' la piu' recente (fblVersioneDaChiavi). Con tutte e due presenti sceglieva la
// VECCHIA - ed e' il motivo per cui l'app servita restava indietro mentre il pannello dichiarava
// di essere aggiornata. Un difetto solo, due sintomi, e il secondo spiegava il primo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('la numerazione nuova batte sempre la vecchia', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      nuovaControVecchia: fblConfrontaVersioni('2.0.19', '167'),
      vecchiaControNuova: fblConfrontaVersioni('167', '2.0.19'),
      dueNuove: fblConfrontaVersioni('2.0.19', '2.0.18'),
      dueVecchie: fblConfrontaVersioni('167', '166'),
      uguali: fblConfrontaVersioni('2.0.19', '2.0.19')
    }));
    assert.equal(r.nuovaControVecchia, 1,
      'la 2.0.19 deve risultare PIU\' NUOVA della 167: era questo il difetto');
    assert.equal(r.vecchiaControNuova, -1, 'e viceversa');
    assert.equal(r.dueNuove, 1, 'fra due nuove vale il confronto normale');
    assert.equal(r.dueVecchie, 1, 'fra due vecchie pure');
    assert.equal(r.uguali, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con la vecchia installata, l\'aggiornamento viene offerto', async () => {
  // Il sintomo che il proprietario vedeva: la frase sbagliata, e nessun pulsante per rimediare.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const nuova = (pubblicata, installata) =>
        !installata || fblConfrontaVersioni(fblVersioneDaTag(pubblicata), installata) > 0;
      return {
        vecchiaInstallata: nuova('v2.0.19', '167'),
        giaAggiornata: nuova('v2.0.19', '2.0.19'),
        indietroDiUna: nuova('v2.0.19', '2.0.18'),
        avanti: nuova('v2.0.18', '2.0.19')
      };
    });
    assert.equal(r.vecchiaInstallata, true,
      'chi ha la vecchia numerazione deve vedersi offrire l\'aggiornamento');
    assert.equal(r.giaAggiornata, false, 'chi e\' aggiornato non deve vedere niente');
    assert.equal(r.indietroDiUna, true);
    assert.equal(r.avanti, false,
      'e se per qualche motivo si e\' avanti, non si propone di tornare indietro');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('fra le cache del service worker si sceglie quella NUOVA', async () => {
  // Il secondo mestiere del confronto, ed e' quello che faceva servire davvero l'app vecchia:
  // con due cache presenti, `fblVersioneDaChiavi` sceglieva la 167.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      miste: fblVersioneDaChiavi(['forex-backtest-lab-v167', 'forex-backtest-lab-v2.0.19']),
      invertite: fblVersioneDaChiavi(['forex-backtest-lab-v2.0.19', 'forex-backtest-lab-v167']),
      soloVecchia: fblVersioneDaChiavi(['forex-backtest-lab-v167']),
      conRumore: fblVersioneDaChiavi(['altra-cache', 'forex-backtest-lab-v2.0.19', 'x'])
    }));
    assert.equal(r.miste, '2.0.19', 'con tutte e due si serve la nuova');
    assert.equal(r.invertite, '2.0.19', 'e l\'ordine in cui arrivano non deve contare');
    assert.equal(r.soloVecchia, '167', 'ma se c\'e\' solo la vecchia, quella e\'');
    assert.equal(r.conRumore, '2.0.19', 'le chiavi di altri non confondono');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un numero piccolo senza punti resta un numero normale', async () => {
  // LA PROVA DI CONTROLLO. La regola «un numero solo e grande e' la vecchia numerazione» non deve
  // mangiarsi i casi legittimi: una ipotetica versione «3» non e' la vecchia numerazione, e
  // confrontarla come tale la farebbe sembrare sempre piu' vecchia di qualunque altra.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      tre: fblVecchiaNumerazione('3'),
      quarantanove: fblVecchiaNumerazione('49'),
      cinquanta: fblVecchiaNumerazione('50'),
      centosessantasette: fblVecchiaNumerazione('167'),
      conPunti: fblVecchiaNumerazione('2.0.19'),
      vuoto: fblVecchiaNumerazione('')
    }));
    assert.equal(r.tre, false, '«3» e\' una versione normale, non un contatore');
    assert.equal(r.quarantanove, false);
    assert.equal(r.cinquanta, true, 'da 50 in su un numero solo e\' il vecchio contatore');
    assert.equal(r.centosessantasette, true);
    assert.equal(r.conPunti, false, 'con i punti non e\' mai la vecchia');
    assert.equal(r.vuoto, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le cache della vecchia numerazione si tolgono, ma solo se c\'e\' la nuova', async () => {
  // SEGNALATO: «sui dispositivi mobili questo funziona bene, solo per il PC non funzionava».
  // Il motivo e' tutto qui: sw.js cancella le cache vecchie quando si ATTIVA, ma sul computer il
  // service worker nuovo puo' non attivarsi mai - li' la pagina la serve il ponte, e un ponte
  // anteriore alla v2.0.15 serve l'sw.js CONGELATO nell'eseguibile, che non cambia mai. Sul
  // telefono l'app arriva dal sito o dall'APK, dove l'aggiornamento funziona normalmente.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const tolte = [];
      const finte = ['forex-backtest-lab-v167', 'forex-backtest-lab-v2.0.19', 'altra-cache'];
      const veroKeys = caches.keys, veroDelete = caches.delete;
      caches.keys = async () => finte.slice();
      caches.delete = async (k) => { tolte.push(k); return true; };
      try {
        const v = await fblVersioneInstallata();
        return {v, tolte};
      } finally { caches.keys = veroKeys; caches.delete = veroDelete; }
    });
    assert.deepEqual(r.tolte, ['forex-backtest-lab-v167'],
      'si toglie SOLO quella della vecchia numerazione: ' + JSON.stringify(r.tolte));
    assert.equal(r.v, '2.0.19', 'e la versione letta diventa quella nuova');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con SOLO la vecchia cache non si cancella niente', async () => {
  // LA PROVA DI CONTROLLO: chi non ha ancora ricevuto la versione nuova resterebbe senza nessuna
  // cache, cioe' senza app quando e' offline. Si toglie il vecchio solo quando c'e' il nuovo.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const tolte = [];
      const veroKeys = caches.keys, veroDelete = caches.delete;
      caches.keys = async () => ['forex-backtest-lab-v167'];
      caches.delete = async (k) => { tolte.push(k); return true; };
      try {
        const v = await fblVersioneInstallata();
        return {v, tolte};
      } finally { caches.keys = veroKeys; caches.delete = veroDelete; }
    });
    assert.deepEqual(r.tolte, [], 'niente da cancellare: e\' l\'unica app che c\'e\'');
    assert.equal(r.v, '167', 'e si dice onestamente quale versione e\'');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se il ponte serve una copia vecchia, il pannello dice PERCHE', async () => {
  // SEGNALATO: «non gli arriva il pacchetto di installazione vero e proprio ma una finta che gli
  // fa credere di essere aggiornato». Dirgli «sei all'ultima versione» era sbagliato, ma anche
  // dirgli solo «c'e' una versione nuova» non basterebbe: premere Aggiorna non servirebbe a
  // niente, perche' l'app la serve il ponte dalla copia congelata nell'eseguibile. Va detto che
  // serve il Setup, e perche'.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      fetchMt5WithTimeout = async (p) => (p === '/health')
        ? {ok: true, data: {status: 'ok', app: {versione: '2.0.12', da: 'copia installata'}}}
        : {ok: false};
      fblLeggiUltimaRelease = async () => ({tag: 'v2.0.20', tagRaw: 'v2.0.20', note: '', letto: Date.now()});
      fblVersioneInstallata = async () => '2.0.12';
      await fblAggiornaPannelloVersione(true);
      const note = document.getElementById('fblVerNote');
      return {testo: note ? note.textContent : '', visibile: note ? note.style.display !== 'none' : false};
    });
    assert.equal(r.visibile, true, 'la nota deve comparire');
    assert.match(r.testo, /ponte su questo computer/, 'deve nominare il ponte: ' + r.testo.slice(0, 120));
    assert.match(r.testo, /Setup/, 'e dire che serve il Setup, non il pulsante Aggiorna');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
