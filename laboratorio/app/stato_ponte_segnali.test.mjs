// LO STATO DEL PONTE DEI SEGNALI DICE QUELLO CHE SUCCEDE, NON QUELLO CHE SI SPERA.
//
// SEGNALATO dal proprietario, dal telefono, con due foto: «il ponte Telegram rimane escluso per
// sempre, anche se il server dice che il collegamento è stabilito. Non può esistere che dica che è
// collegato e poi non si riesca a connettere. E infatti non prende i segnali dalle sale e non
// esegue nemmeno gli ordini, zero».
//
// LA CAUSA: non c'era nessuno stato, c'era una catena di `else if` con un ramo di scarto in fondo
// — «Ponte avviato, collegamento a Telegram in corso…» — dove cadeva tutto quello che non
// rientrava nei quattro casi previsti. Fra le cose che ci cadevano dentro c'è il caso in cui il
// ponte dichiara di NON occuparsi di Telegram (`modalita: 'solo-syntra'`): l'app quel campo non lo
// guardava, e traduceva «qui Telegram è spento per scelta» in «collegamento in corso», per sempre.
//
// LA REGOLA che questi test tengono ferma: non si scrive mai che qualcosa «è in corso» se non lo
// si sa. Un'attesa senza fine non è uno stato: è una bugia che impedisce di cercare il guasto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Ogni caso riparte da zero: tgStatoVero ricorda da quanto Telegram non si aggancia.
const AZZERA = `tgNonAgganciatoDa=0; tgGruppi=['@sala1','@sala2'];`;

test('modalità solo-syntra: lo dice, invece di fingere un collegamento in corso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`${AZZERA}
      tgStatoVero({modalita:'solo-syntra', credenziali_presenti:true, collegato:false})`);
    assert.equal(r.chiave, 'solo-syntra');
    assert.doesNotMatch(r.frase, /in corso/,
      'questo ponte non sta collegando niente: dirlo "in corso" è il difetto segnalato');
    assert.match(r.frase, /SOLO Syntra/, 'deve dire che qui Telegram non viene acceso');
    assert.match(r.frase, /8769/, 'e deve dire dove sta il ponte di Telegram');
    assert.equal(r.tono, 'err', 'non è una situazione normale: il pallino non può essere neutro');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il ponte risponde ma Telegram non si aggancia: dopo un po\' lo dice, con da quanto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`${AZZERA}
      const m={modalita:'telegram', credenziali_presenti:true, collegato:false, telefono_salvato:false};
      const subito = tgStatoVero(m);
      // Si sposta indietro l'istante da cui si conta: gli stessi 90 secondi, senza aspettarli.
      tgNonAgganciatoDa = Date.now() - 90000;
      const dopo = tgStatoVero(m);
      ({subito, dopo})`);
    // I primi venti secondi un'attesa è davvero un'attesa.
    assert.equal(r.subito.chiave, 'aggancio', 'appena arrivato può ancora essere un aggancio in corso');
    // Dopo, no.
    assert.equal(r.dopo.chiave, 'fermo');
    assert.match(r.dopo.frase, /90 secondi|1 minuti|2 minuti/, 'deve dire DA QUANTO');
    assert.match(r.dopo.frase, /nessun segnale/, 'e deve dire la conseguenza: non arriva niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('quando Telegram aspetta qualcosa, dice cosa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`${AZZERA}
      ['telefono','codice','password'].map(c=>tgStatoVero(
        {modalita:'telegram', credenziali_presenti:true, collegato:false, accesso_serve:c}))`);
    assert.deepEqual(r.map(x=>x.chiave), ['accesso','accesso','accesso']);
    assert.match(r[0].frase, /numero di telefono/);
    assert.match(r[1].frase, /codice di verifica/);
    assert.match(r[2].frase, /password/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il ponte che non ha mai risposto non è "in corso": è muto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`${AZZERA} tgStatoVero(null)`);
    assert.equal(r.chiave, 'muto');
    assert.doesNotMatch(r.frase, /in corso/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('collegato davvero: lo dice, e conta le sale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`${AZZERA}
      tgNonAgganciatoDa = Date.now() - 90000;
      const st = tgStatoVero({modalita:'telegram', credenziali_presenti:true, collegato:true});
      ({st, azzerato: tgNonAgganciatoDa})`);
    assert.equal(r.st.chiave, 'collegato');
    assert.equal(r.st.tono, 'ok');
    assert.match(r.st.frase, /Sale in ascolto: 2/);
    // Il cronometro riparte da zero: se cadesse di nuovo, il conteggio deve essere quello nuovo.
    assert.equal(r.azzerato, 0, 'agganciandosi il cronometro si azzera');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l\'etichetta dell\'interruttore non inventa più un accesso in corso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`${AZZERA}
      // Interruttore acceso, ponte in solo-syntra: prima qui c'era scritto "accesso in corso…".
      try{ localStorage.setItem('fb_tg_on','1'); }catch(e){}
      tgCollegatoTelegram = false;
      tgUltimoStato = {modalita:'solo-syntra', credenziali_presenti:true, collegato:false};
      tgAggiornaInterruttore();
      ({acceso: tgAttivo(), testo: ($('tgToggleBtn')||{}).textContent})`);
    if(r.acceso){
      assert.doesNotMatch(r.testo, /accesso in corso/,
        'nessun accesso è in corso: l\'etichetta non deve dirlo');
      assert.match(r.testo, /Telegram non è acceso/);
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
