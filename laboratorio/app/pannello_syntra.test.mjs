// IL PANNELLO SYNTRA: quello che si vede deve esistere, e quello che non serve non si vede.
//
// SEGNALATO dal proprietario (21 ottobre 2026), tre cose in una riga: «ora il programma mi dice di
// selezionare la cartella syntra ma non me la fa selezionare, in più mi viene visualizzata la
// porta syntra ma a me non interessa (fa tutto da solo il server e pc), non mi fa più visualizzare
// nemmeno i nomi utenti di syntra precedentemente inseriti».
//
// TRE CAUSE DIVERSE, tutte trovate nel sorgente e tutte silenziose:
//
// 1. gli UTENTI. Il contenitore `#syntraUtentiList` era stato CANCELLATO per sbaglio dal commit
//    31d9fe3 (quello dell'APK e della scheda Versione). La funzione che lo riempie,
//    syntraUtentiDisegna(), è rimasta e continuava a essere chiamata, ma trovava `box` nullo e
//    usciva alla prima riga. Nessun errore da nessuna parte: semplicemente non compariva più
//    niente. Un contenitore che sparisce non rompe: smette di mostrare.
//
// 2. la CARTELLA. Il campo e il pulsante «Scegli cartella» erano stati aggiunti dal commit
//    229a16a senza NESSUN gestore: il campo non veniva letto, il pulsante non faceva niente, e il
//    ponte non aveva modo di riceverla. Il pulsante, per di più, non avrebbe mai potuto
//    funzionare: un browser non conosce il percorso reale di una cartella (showDirectoryPicker
//    restituisce un riferimento, non "C:\..."). Tolto il pulsante, resta il campo dove si incolla.
//
// 3. la PORTA. Mostrata e mai letta da nessuno. «All'utente queste informazioni non devono
//    risalire».
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('gli utenti Syntra hanno di nuovo un posto dove comparire', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const box = document.getElementById('syntraUtentiList');
      if (!box) return {manca: true};
      // Due utenti visti dal lettore: devono comparire nell'elenco.
      syntraVisti = [];
      tgGruppiSyntra = [];
      syntraVisto('Syntra · Gino');
      syntraVisto('Syntra · Mario');
      syntraUtentiDisegna();
      return {testo: box.textContent, righe: box.children.length};
    });
    assert.equal(r.manca, undefined,
      'manca #syntraUtentiList: la funzione che disegna gli utenti esce alla prima riga e non si vede niente');
    assert.ok(/Gino/.test(r.testo) && /Mario/.test(r.testo),
      'i nomi visti devono comparire: ' + r.testo.slice(0, 200));
    assert.equal(r.righe, 2, 'una riga per utente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza utenti lo dice, invece di restare vuoto senza spiegazione', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      syntraVisti = []; tgGruppiSyntra = [];
      syntraUtentiDisegna();
      return {testo: (document.getElementById('syntraUtentiList').textContent || '').trim()};
    });
    assert.match(r.testo, /Nessun utente/i, 'deve spiegare perché è vuoto: ' + r.testo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la porta Syntra non si vede più', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      porta: !!document.getElementById('syntraPort'),
      // E non deve essere semplicemente nascosta: non la legge nessuno, quindi non deve esserci.
      quante: document.querySelectorAll('#syntraPort').length
    }));
    assert.equal(r.porta, false, 'la porta Syntra non deve comparire: non la legge nessuno');
    assert.equal(r.quante, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il pulsante «Scegli cartella» non c\'è più, il campo dove incollare sì', async () => {
  // Il pulsante prometteva una cosa impossibile per un browser. Il campo invece funziona: il
  // percorso si incolla e viene mandato al ponte.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const campo = document.getElementById('syntraFolder');
      return {
        pulsante: !!document.getElementById('syntraFolderPick'),
        campo: !!campo,
        invito: campo ? (campo.getAttribute('placeholder') || '') : ''
      };
    });
    assert.equal(r.pulsante, false,
      'il pulsante non può funzionare in un browser: toglierlo è meglio che lasciarlo finto');
    assert.equal(r.campo, true, 'il campo dove incollare il percorso deve restare');
    assert.match(r.invito, /incolla/i, 'e deve dire che il percorso si incolla: ' + r.invito);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('scrivere la cartella la manda al ponte, e il ponte risponde riempiendo il campo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      window._inviati = [];
      // Si finge il ponte collegato: qui si misura COSA viene mandato, non la rete.
      window.tgAttivo = () => true;
      window.tgInvia = (m) => { window._inviati.push(m); return true; };
      window.tgWs = {readyState: 1};
      tgWs = window.tgWs;
      const campo = document.getElementById('syntraFolder');
      campo.value = 'C:\\Program Files\\BlueStacks_nxt';
      campo.dispatchEvent(new Event('input', {bubbles: true}));
      campo.dispatchEvent(new Event('change', {bubbles: true}));
      await new Promise(res => setTimeout(res, 150));
      return {mandato: window._inviati.slice()};
    });
    const invio = r.mandato.find(m => m && m.azione === 'cartella_syntra');
    assert.ok(invio, 'la cartella deve essere mandata al ponte: ' + JSON.stringify(r.mandato));
    assert.equal(invio.cartella, 'C:\\Program Files\\BlueStacks_nxt',
      'e deve arrivare il percorso scritto, intero');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('«Ricontrolla» chiede al ponte invece di non fare niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      window._inviati = [];
      window.tgAttivo = () => true;
      window.tgInvia = (m) => { window._inviati.push(m); return true; };
      tgWs = {readyState: 1};
      document.getElementById('syntraRefreshBtn').click();
      await new Promise(res => setTimeout(res, 150));
      return {mandato: window._inviati.slice()};
    });
    assert.ok(r.mandato.some(m => m && m.azione === 'leggi_cartella_syntra'),
      'deve chiedere al ponte lo stato: ' + JSON.stringify(r.mandato));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
