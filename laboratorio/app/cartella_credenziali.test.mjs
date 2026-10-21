// LA CARTELLA DELLE CREDENZIALI: DIRE LO STATO VERO, E DARE UN PULSANTE.
//
// SEGNALATO dal proprietario: «quando segui l'aggiornamento mi succede che le credenziali di
// capital.com, MT5 e tutto quello che c'entra con le credenziali spariscono, quindi vengono
// cancellate». E poi: «facciamo in modo di salvarlo... cosi' si spiega anche che le credenziali
// rimangono sul dispositivo e non circolano online».
//
// NON ERANO SPARITE, e questa e' la parte che conta. Il file CSV e' sempre stato dove l'utente
// l'ha messo: quello che l'app perde a ogni riavvio del browser e' il PERMESSO di leggere quella
// cartella. Lo revoca il browser, per sicurezza, e non c'e' modo di tenerlo. Senza permesso
// l'elenco dei conti e' vuoto - e da fuori si legge come «le credenziali sono state cancellate».
//
// Il meccanismo per riconfermare esisteva (fblChiediPermessoFile) ma partiva solo quando qualcosa
// andava a cercare la cartella, e per MT5 NON partiva affatto: getMt5CredsDirHandle tornava null
// in silenzio, mentre quello di Capital.com il banner lo mostrava gia'. L'asimmetria era una
// dimenticanza, e costava la spiegazione proprio nel caso piu' frequente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

test('lo stato della cartella distingue i tre casi che contano', async () => {
  // «non scelta», «collegata» e «da riconfermare» portano a tre azioni diverse dell'utente:
  // scegliere una cartella, non fare niente, premere un pulsante. Confonderli e' il difetto.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const vero = libDirGet;
      const fai = (stato) => { libDirGet = async () => (stato === null ? null
        : {queryPermission: async () => stato, requestPermission: async () => 'granted'}); };
      try{
        fai(null);        const manca = await fblCredStatoCartella('mt5CredsDir');
        fai('granted');   const ok = await fblCredStatoCartella('mt5CredsDir');
        fai('prompt');    const daFare = await fblCredStatoCartella('mt5CredsDir');
        return {manca, ok, daFare, supporto: supportsFS};
      } finally { libDirGet = vero; }
    });
    if (!r.supporto) {
      // Senza File System Access API i tre stati non esistono: lo si dice invece di far finta.
      assert.equal(r.manca, 'nonSupportato');
      return;
    }
    assert.equal(r.manca, 'manca', 'nessuna cartella salvata');
    assert.equal(r.ok, 'ok', 'permesso ancora valido');
    assert.equal(r.daFare, 'daRiconfermare',
      'permesso dimenticato dal browser: e\' il caso dopo ogni riavvio');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il pulsante compare quando c\'e\' qualcosa da riconfermare, e non prima', async () => {
  // Un pulsante «Ricollega la cartella» offerto a chi non ha mai scelto una cartella promette una
  // cosa che non puo' fare: premendolo non succederebbe niente.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      if (!supportsFS) return {salta: true};
      const vero = libDirGet;
      const leggi = () => {
        const b = document.getElementById('fblCredRicollega');
        return {visibile: !!b && b.style.display !== 'none',
                stato: (document.getElementById('fblCredCartellaStato') || {}).textContent || ''};
      };
      try{
        libDirGet = async () => null;
        await fblCredCartellaAggiorna();
        const senza = leggi();
        libDirGet = async () => ({queryPermission: async () => 'prompt',
                                  requestPermission: async () => 'granted'});
        await fblCredCartellaAggiorna();
        const con = leggi();
        return {senza, con};
      } finally { libDirGet = vero; }
    });
    if (r.salta) return;
    assert.equal(r.senza.visibile, false, 'senza cartelle salvate il pulsante non si offre');
    assert.match(r.senza.stato, /non ancora scelta/, 'e lo stato lo dice: ' + r.senza.stato);
    assert.equal(r.con.visibile, true, 'con un permesso da riconfermare il pulsante c\'e\'');
    assert.match(r.con.stato, /da riconfermare/, 'e lo stato lo dice: ' + r.con.stato);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('ricollegare riconferma il permesso E rilegge i conti', async () => {
  // La meta' che si dimentica: riavuto il permesso, se nessuno rilegge il file l'elenco dei conti
  // resta vuoto e sembra che il pulsante non abbia funzionato.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      if (!supportsFS) return {salta: true};
      const veroGet = libDirGet, veroRefresh = refreshMt5AccountsUI;
      let chiesto = 0, riletto = 0;
      try{
        libDirGet = async () => ({
          queryPermission: async () => 'prompt',
          requestPermission: async () => { chiesto++; return 'granted'; }
        });
        refreshMt5AccountsUI = async () => { riletto++; };
        await fblCredRicollegaCartelle();
        return {chiesto, riletto, stato: document.getElementById('status').textContent};
      } finally { libDirGet = veroGet; refreshMt5AccountsUI = veroRefresh; }
    });
    if (r.salta) return;
    assert.equal(r.chiesto, 2, 'il permesso va chiesto per entrambe le cartelle (Capital.com e MT5)');
    assert.equal(r.riletto, 1, 'e i conti MT5 vanno riletti, altrimenti l\'elenco resta vuoto');
    assert.match(r.stato, /Capital\.com: collegata/, 'il messaggio dice com\'e\' andata: ' + r.stato);
    assert.match(r.stato, /non hanno mai lasciato il dispositivo/,
      'e ribadisce dove sono i dati: ' + r.stato);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la nota sulla privacy c\'e\', e dice le due cose che il proprietario ha chiesto', () => {
  // Non e' un dettaglio di stile: e' la risposta alla domanda «dove finiscono le mie password».
  // Deve dire DOVE stanno (sul dispositivo) e DOVE NON passano (il server).
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const i = src.indexOf('id="fblCredCartellaBox"');
  assert.ok(i > 0, 'il blocco della cartella delle credenziali deve esistere nel pannello Live');
  const blocco = src.slice(i, i + 2200);
  assert.match(blocco, /restano sul tuo dispositivo/i, 'deve dire che restano sul dispositivo');
  assert.match(blocco, /non passano mai dal server/i, 'e che non passano dal server');
  assert.match(blocco, /dimentica il permesso/i,
    'e deve spiegare il motivo per cui sembrano sparite, altrimenti il pulsante resta misterioso');
});

test('anche MT5 spiega perche\' i conti non si vedono, come Capital.com', () => {
  // L'asimmetria da cui nasceva «le credenziali sono sparite»: Capital.com mostrava il banner,
  // MT5 tornava null e basta.
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const i = src.indexOf('async function getMt5CredsDirHandle(');
  const f = src.slice(i, i + 1400);
  assert.match(f, /fblChiediPermessoFile\('usare i conti MT5 salvati'/,
    'getMt5CredsDirHandle deve chiedere il permesso con un motivo, non tornare null in silenzio');
});
