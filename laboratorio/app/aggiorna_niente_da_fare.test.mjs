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
    if(b && b.textContent.indexOf('in corso')<0 && !b.disabled) break;
    if(document.getElementById('fblAggOverlay') && i>25) break;
  }
  const b=document.getElementById('fblVerAggiornaBtn');
  const velo=document.getElementById('fblAggOverlay');
  return {
    etichetta:b?b.textContent:'(niente)',
    pulsanteSpento:b?!!b.disabled:null,
    pulsanteVisibile:b?getComputedStyle(b).display!=='none':null,
    veloInPiedi:!!(velo&&getComputedStyle(velo).display!=='none'),
    stato:(document.getElementById('status')||{}).textContent||'',
    scaricati:(window.__clic||[]).filter(u=>/\\.(exe|apk|msi|dmg)$/i.test(u)),
    attesa:(function(){ try{ return localStorage.getItem('fbl_aggiornamento_atteso'); }catch(e){ return 'errore'; } })()
  };
})()`;

test('se il ponte dice «niente da installare», l\'app lo dice e non resta bloccata', async () => {
  const {browser, pagina, errori} = await apriConPonte(
    {ok: true, avviato: false, messaggio: "il programma e' gia' alla 2.0.81: non c'e' niente da installare"});
  try {
    const r = await pagina.evaluate(PREMI_E_GUARDA);
    assert.ok(!r.errore, r.errore || '');
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    assert.equal(r.veloInPiedi, false,
      'il velo bloccante non deve restare su: non c\'è nessuna installazione in corso');
    assert.equal(r.pulsanteSpento, false, 'il pulsante deve tornare premibile');
    assert.ok(r.stato.indexOf('niente da installare') >= 0,
      'lo stato deve riportare il motivo detto dal ponte, invece dice: "' + r.stato + '"');
    assert.ok(r.stato.indexOf('installazione in corso') < 0 && r.stato.indexOf('si riapre da sola') < 0,
      'non deve dire che si sta installando qualcosa: "' + r.stato + '"');
    assert.equal(r.attesa, null,
      'non si deve restare in attesa di una versione nuova che non sta arrivando');
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
