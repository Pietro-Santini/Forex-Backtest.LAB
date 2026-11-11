// «AGGIORNA» NON DEVE DIRE «INSTALLAZIONE IN CORSO» SE NON È PARTITO NIENTE.
//
// SEGNALATO dal proprietario (4 novembre 2026): «ho premuto il tasto aggiorna e non mi ha chiuso
// l'applicazione, non mi ha fatto nulla, cioè è stato molto istantaneo».
//
// CAUSA MISURATA, e non era dove l'avevo cercata la prima volta. Avevo accusato il RIPIEGO di
// `fblPianoAggiornamento` e l'avevo perfino cambiato: sbagliato, e due test giusti sono andati
// rossi per dirmelo. La misura diceva un'altra cosa — il ponte del proprietario rispondeva
// {programma 2.0.79, pagina 2.0.80, da_aggiornare:true}, cioè il ramo PRECISO, che il pacchetto
// lo chiede già. Il difetto sta più avanti: nella rotta /aggiorna-programma del ponte, che
// rispondeva `ok:true` in DUE casi diversi — «installazione avviata» e «il programma è già alla
// tal versione: non c'è niente da installare» — e qui si guardava solo `ok`. Nel secondo caso
// l'app diceva «installazione in corso, l'app si riavvia da sola», lasciava il velo bloccante
// sullo schermo, e non succedeva niente. Un esito vero detto in modo ambiguo è peggio di un
// errore: l'errore almeno si vede.
//
// Ora il ponte manda anche `avviato` (vedi aggiorna_programma_dettaglio in bridge.py, con i suoi
// test in laboratorio/ponte/test_aggiorna_programma.py) e qui si guarda quello.
//
// RIMISURATO il 10 novembre 2026, pero': quella cura lasciava il difetto per l'altra meta'.
// SEGNALATO: «premo aggiorna, mi esce il popup, si chiude dopo 2 secondi e non fa
// letteralmente nulla nemmeno il refresh». CAUSA MISURATA nei log del ponte dello stesso
// giorno: /aggiorna-programma rispondeva ok:true avviato:false («il programma e' gia' alla
// 2.2.24: non c'e' niente da installare») - il ramo giusto - e il velo spariva lasciando
// una riga di stato che non si legge. Il primo clic aveva installato DAVVERO (sei POST
// /aggiorna-programma nei log, installer chiuso e riaperto), il secondo cadeva qui. Adesso
// l'esito resta visibile e la pagina si ricarica.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const RELEASE_FINTA = {
  tag_name: 'v99.0.0',
  body: 'release di prova',
  assets: [
    {name: 'ForexBacktestLAB_Setup.exe', browser_download_url: 'https://esempio.test/Setup.exe'},
  ],
};

// Il ponte dice: «il mio eseguibile è indietro rispetto alla pagina» (così il piano diventa
// automatico:true e si passa dalla rotta /aggiorna-programma), e poi risponde all'aggiornamento
// con quello che gli si dice.
async function apriConPonte(rispostaAggiorna) {
  const {browser, pagina, errori} = await apriApp();
  await pagina.route(u => u.host.indexOf('api.github.com') >= 0, r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(RELEASE_FINTA)}));
  await pagina.route(u => u.pathname.endsWith('/versione-programma'), r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({programma: '2.0.79', pagina: '2.0.81', da_aggiornare: true})}));
  await pagina.route(u => u.pathname.endsWith('/health'), r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({status: 'ok', app: {versione: '2.0.81', da: 'copia aggiornata'}})}));
  await pagina.route(u => u.pathname.endsWith('/aggiorna-programma'), r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(rispostaAggiorna)}));
  await pagina.route(u => u.pathname.endsWith('/aggiorna-app'), r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ok: true})}));
  await pagina.evaluate(() => {
    window.__clic = [];
    HTMLAnchorElement.prototype.click = function(){ window.__clic.push(this.getAttribute('href') || ''); };
    window.fblRicaricaPagina = function(){ window.__ricaricato = (window.__ricaricato||0)+1; };
  });
  return {browser, pagina, errori};
}

const PREMI_E_GUARDA = `(async function(){
  // fblAggiornaPannelloVersione e' asincrona: senza aspettarla il pulsante non e' ancora
  // configurato e il clic non fa niente (misurato: lo stato restava "Carica il CSV per iniziare").
  await fblAggiornaPannelloVersione(true);
  const btn0=document.getElementById('fblVerAggiornaBtn');
  if(!btn0 || getComputedStyle(btn0).display==='none') return {errore:"il pulsante Aggiorna non e comparso"};
  btn0.click();
  // Il giro passa da una fetch: si aspetta che il pulsante si fermi su uno stato stabile.
  for(let i=0;i<60;i++){
    await new Promise(r=>setTimeout(r,100));
    const b=document.getElementById('fblVerAggiornaBtn');
    // Se il pannello e' su, NON si esce al primo pulsante tornato premibile: da quando il
    // ramo «niente da installare» ricarica la pagina dopo 2,5 s (misurato il 10 novembre
    // 2026), uscire prima significava misurare lo stato di mezzo e non l'esito. Si aspetta
    // il pannello fino a 2,6 s, cioe' oltre la sua scadenza.
    const veloSu=!!document.getElementById('fblAggOverlay');
    if(b && b.textContent.indexOf('in corso')<0 && !b.disabled && !veloSu) break;
    if(veloSu && i>25) break;
  }
  const b=document.getElementById('fblVerAggiornaBtn');
  const velo=document.getElementById('fblAggOverlay');
  return {
    etichetta:b?b.textContent:'(niente)',
    pulsanteSpento:b?!!b.disabled:null,
    pulsanteVisibile:b?getComputedStyle(b).display!=='none':null,
    veloInPiedi:!!(velo&&getComputedStyle(velo).display!=='none'),
    veloTesto:(document.getElementById('fblAggFase')||{}).textContent||'',
    stato:(document.getElementById('status')||{}).textContent||'',
    ricariche:window.__ricaricato||0,
    scaricati:(window.__clic||[]).filter(u=>/\\.(exe|apk|msi|dmg)$/i.test(u)),
    attesa:(function(){ try{ return localStorage.getItem('fbl_aggiornamento_atteso'); }catch(e){ return 'errore'; } })()
  };
})()`;

test('se il ponte dice «niente da installare», l\'app lo dice SENZA SPARIRE e ricarica', async () => {
  const {browser, pagina, errori} = await apriConPonte(
    {ok: true, avviato: false, programma: '2.2.24',
     messaggio: "il programma e' gia' alla 2.2.24: non c'e' niente da installare"});
  try {
    const r = await pagina.evaluate(PREMI_E_GUARDA);
    assert.ok(!r.errore, r.errore || '');
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    // IL VELO DEVE RESTARE CON L'ESITO, non chiudersi in silenzio.
    //
    // SEGNALATO dal proprietario (10 novembre 2026): «premo il pulsante aggiorna, mi fa vedere
    // soltanto questo popup, si chiude subito dopo 2 secondi e non fa letteralmente nulla
    // nemmeno il refresh». MISURATO nei log del ponte: /aggiorna-programma rispondeva
    // ok:true avviato:false («il programma e' gia' alla 2.2.24: non c'e' niente da installare»)
    // e il velo spariva, lasciando come unica traccia una riga di stato lunga tre parole.
    // Prima del 4 novembre questo ramo diceva «installazione in corso» a vuoto; la cura di
    // allora fece sparire il velo, e cosi' l'esito vero divento' invisibile. Adesso resta:
    // il pannello non blocca per sempre (c'e' il pulsante «Torna all'app»), ma non tace.
    assert.equal(r.veloInPiedi, true,
      'il pannello con l\'esito deve restare visibile: «premo aggiorna, mi fa vedere ' +
      'soltanto questo popup» e poi non si deve capire che fine ha fatto');
    assert.ok(r.veloTesto.indexOf('ultima versione pubblicata') >= 0,
      'il pannello deve dire la versione e che non c\'era niente da installare, invece dice: "' +
      r.veloTesto + '"');
    assert.ok(r.veloTesto.indexOf('installazione in corso') < 0,
      'non deve dire che si sta installando qualcosa: "' + r.veloTesto + '"');
    assert.equal(r.pulsanteSpento, false, 'il pulsante deve tornare premibile');
    assert.ok(r.stato.indexOf('niente da installare') >= 0,
      'lo stato deve riportare il motivo detto dal ponte, invece dice: "' + r.stato + '"');
    assert.equal(r.attesa, null,
      'non si deve restare in attesa di una versione nuova che non sta arrivando');
    assert.equal(r.scaricati.length, 0,
      'non c\'e\' niente da installare: scaricare un pacchetto sarebbe un doppione');
    // E LA PAGINA SI RICARICA: e' il «nemmeno il refresh» della segnalazione. La versione
    // nuova e' installata; chi ha ancora davanti la copia vecchia nella cache del browser
    // deve vederla comparire da sola.
    assert.ok(r.ricariche >= 1,
      'dopo aver detto «niente da installare» la pagina si deve ricaricare: la versione ' +
      'nuova e\' sul disco e va messa davanti agli occhi. Ricariche viste: ' + r.ricariche);
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: quando l'installazione parte DAVVERO, tutto deve restare come prima —
// velo in piedi, pulsante via. Senza questa prova, bastava non dire mai «installazione in corso»
// per far passare il test qui sopra.
test('PROVA DI CONTROLLO: se l\'installazione parte davvero, il velo resta e il pulsante sparisce', async () => {
  const {browser, pagina, errori} = await apriConPonte(
    {ok: true, avviato: true, messaggio: 'pacchetto scaricato e installazione avviata'});
  try {
    const r = await pagina.evaluate(PREMI_E_GUARDA);
    assert.ok(!r.errore, r.errore || '');
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.veloInPiedi, true,
      'da qui in poi l\'installer chiude l\'app: il velo deve restare, non si tocca più niente');
    assert.equal(r.pulsanteVisibile, false, 'il pulsante deve sparire');
    assert.equal(r.scaricati.length, 0,
      'il ponte sta già installando: scaricare anche il pacchetto a mano sarebbe un doppione');
  } finally { await browser.close(); }
});

// PROVA DI CONTROLLO: un ponte VECCHIO non manda `avviato`. Lì vale la regola di prima (ok =
// partito), altrimenti un aggiornamento partito per davvero finirebbe anche a scaricare il
// pacchetto a mano — un file in più in Download a ogni versione, che è il difetto che
// setup_non_necessario.test.mjs difende da tempo.
test('PROVA DI CONTROLLO: col ponte vecchio, che non manda «avviato», vale la regola di prima', async () => {
  const {browser, pagina, errori} = await apriConPonte({ok: true, messaggio: 'installazione avviata'});
  try {
    const r = await pagina.evaluate(PREMI_E_GUARDA);
    assert.ok(!r.errore, r.errore || '');
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.veloInPiedi, true, 'col ponte vecchio ok vuol dire partito, come ieri');
    assert.equal(r.scaricati.length, 0, 'e nessun pacchetto scaricato a mano');
  } finally { await browser.close(); }
});
