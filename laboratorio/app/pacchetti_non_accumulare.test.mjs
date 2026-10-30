// I PACCHETTI NON SI ACCUMULANO NELLA CARTELLA DOWNLOAD.
//
// SEGNALATO dal proprietario (consegna 22 ottobre, punto 6): "30-40 file nella cartella Download
// invece di uno sostituito". Una pagina web NON puo' sostituire un file nella cartella Download:
// non esiste un'API che lo permetta. Quindi il problema non si "gestisce", si fa in modo che il
// download non serva piu'.
//
// La strada scelta dal proprietario fra le due proposte (la seconda: "il problema sparisce invece
// di essere gestito"): se l'app qui e' GIA' AGGIORNATA, riscaricare il Setup non cambia niente -
// il programma si aggiorna da solo - e aggiunge un file a ogni richiesta. Il pulsante sparisce.
//
// Cosa misura questo banco, e perche' conta:
//   1. app aggiornata  -> il pulsante sparisce (e resta un link alla pagina delle versioni per
//      reinstallare a mano, perche' toglierlo del tutto lascerebbe senza uscita chi ha un altro
//      problema);
//   2. app NON aggiornata -> il pulsante RESTA (prova di controllo: se sparisse sempre, il
//      servizio non risponderebbe per un motivo qualsiasi e nessuno potrebbe piu' installare);
//   3. versione sconosciuta -> il pulsante RESTA. Nel dubbio non si nasconde niente: nascondere
//      un download che serve lascia l'utente su una strada senza uscita, ed e' peggio di un file
//      in piu' nella cartella Download.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Il banco gira sia su Windows sia su Ubuntu (il collaudo di GitHub): se lasciassi decidere allo
// user agent, su Linux `fblQuiSiInstallaIlServizio()` sarebbe falsa e la prova finirebbe di
// diritto nel ramo "telefono", misurando tutt'altro. Qui l'ambiente lo comando io.
const PREPARA = (setup) => {
  const s = {
    mobile: false, remoto: false, installa: true,
    release: {tag: 'v2.0.45', tagRaw: 'v2.0.45'},
    installata: '2.0.45',     // gia' aggiornata
    health: true,             // il servizio risponde: i pacchetti ci sono gia'
    ...setup
  };
  fblEMobile = () => s.mobile;
  fblRemoto = () => s.remoto;
  fblQuiSiInstallaIlServizio = () => s.installa;
  fblUltimaRelease = s.release;
  fblVersioneInstallata = async () => s.installata;
  fetchMt5WithTimeout = async (percorso) => (percorso === '/health' && !s.health) ? {ok: false} : {ok: true, data: {}};
  return s;
};

test('app gia\' aggiornata: il pulsante di download sparisce, e resta scritto perche\'', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (prep) => {
      eval('(' + prep + ')({})');
      const scarica = document.getElementById('mt5DownloadDesktopAppBtn');
      const testo = document.getElementById('mt5BridgeStepTesto');
      await mt5Passo1Parole(true);          // i pacchetti risultano gia' installati
      return {aggiornata: await fblAppQuiGiaAggiornata(),
              visibile: scarica.style.display !== 'none',
              testo: testo.innerHTML};
    }, PREPARA.toString());
    assert.equal(r.aggiornata, true, 'la versione installata non e\' piu\' vecchia di quella remota');
    // QUESTO e' il punto della consegna: senza questo, il file si accumula a ogni richiesta.
    assert.equal(r.visibile, false,
      'con l\'app gia\' aggiornata il download non si offre piu\': aggiungerebbe solo un file');
    // Ma l'uscita manuale resta: chi ha un problema diverso deve poterlo riscaricare a mano.
    assert.match(r.testo, /pagina delle versioni/i,
      'togliere anche il link lascerebbe senza uscita chi ha un altro problema');
    assert.match(r.testo, /gi.[ aggiornata]/i, 'il testo deve dire che e\' gia\' aggiornata');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: app non aggiornata, il pulsante RESTA', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (prep) => {
      eval('(' + prep + ')({installata: "2.0.40", release: {tag: "v2.0.45", tagRaw: "v2.0.45"}})');
      const scarica = document.getElementById('mt5DownloadDesktopAppBtn');
      await mt5Passo1Parole(true);
      return {aggiornata: await fblAppQuiGiaAggiornata(),
              visibile: scarica.style.display !== 'none',
              etichetta: scarica.textContent};
    }, PREPARA.toString());
    assert.equal(r.aggiornata, false, 'la versione installata e\' piu\' vecchia di quella remota');
    // Se sparisse anche qui, chi ha davvero bisogno del Setup non potrebbe piu' prenderlo.
    assert.equal(r.visibile, true, 'con l\'app non aggiornata il download serve, e si vede');
    assert.doesNotMatch(r.etichetta, /non cambierebbe niente/i,
      'l\'etichetta non deve dire che non serve: qui serve');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('versione sconosciuta: nel dubbio il pulsante resta, non si nasconde mai niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (prep) => {
      eval('(' + prep + ')({release: null})');      // non si sa quale sia l'ultima versione
      const scarica = document.getElementById('mt5DownloadDesktopAppBtn');
      await mt5Passo1Parole(true);
      return {aggiornata: await fblAppQuiGiaAggiornata(),
              visibile: scarica.style.display !== 'none'};
    }, PREPARA.toString());
    // Nascondere un download che magari serve lascia sulla strada senza uscita: peggio di un
    // file in piu' nella cartella Download. Chi non sa, non nasconde.
    assert.equal(r.aggiornata, false, 'senza la versione remota non si puo\' dire che sia aggiornata');
    assert.equal(r.visibile, true, 'nel dubbio il download resta offerto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('pacchetti NON ancora installati: si propone l\'installazione, non l\'attesa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (prep) => {
      eval('(' + prep + ')({health: false})');      // il servizio non risponde per niente
      const scarica = document.getElementById('mt5DownloadDesktopAppBtn');
      const titolo = document.getElementById('mt5BridgeStepTitle');
      const avanti = document.getElementById('mt5BridgeContinueBtn');
      await mt5Passo1Parole(false);                 // i pacchetti NON ci sono
      return {visibile: scarica.style.display !== 'none',
              titolo: titolo.textContent,
              avanti: avanti.textContent};
    }, PREPARA.toString());
    assert.equal(r.visibile, true, 'se i pacchetti non ci sono, il download e\' la cosa da fare');
    assert.match(r.titolo, /Installa i pacchetti/i, 'il passo deve dire di installarli');
    assert.match(r.avanti, /installato/i, 'il pulsante avanti parla di aver installato');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
