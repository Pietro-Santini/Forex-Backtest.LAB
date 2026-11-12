// LA PROP FIRM NON SI PUO' SCORDARE CHE LA CHALLENGE E' GIA' STATA AVVIATA.
//
// SEGNALATO dal proprietario il 12 novembre 2026: «ogni volta che apro una pagina duplicata, e
// sono collegato a un conto, mi dice sempre se questo conto e' una prop firm o meno. E anche
// sulla pagina madre. Certe volte mi dice se voglio avviare su questo conto la challenge della
// prop firm, ma in realta' e' gia' stata avviata. Deve rimanere in memoria fisso che quel conto
// e' stato ormai utilizzato come prop firm ed e' stata attivata, e se lo deve ricordare. Non se
// lo puo' scordare.»
//
// Qui si misurano le DUE cause curate (una terza - la chiave del conto che cambia secondo come
// si e' saputo il nome del server - e' misurata e scritta in cervello/BUG.md, e non e' curata).
//
// CAUSA 1, la piu' grave perche' tocca i soldi senza dirlo: `fblPropContoStatoSalva()`
// SOSTITUIVA il record del conto invece di aggiungerci sopra. Diciotto chiamate su diciannove
// passavano un oggetto gia' fuso; `triggerPropFirmViolation()` passava `{stato,motivo}` nudo, e
// con quello si perdevano `propChiesto` (la domanda riparte), `preset` e `tipoConto` (il limite
// giornaliero mostrato passa dal 3% al 5%) e `faseSuperata` (una fase pagata non era piu'
// scritta da nessuna parte).
//
// CAUSA 2: una finestra duplicata eseguiva il rito del «mi sono appena collegato»
// (`updateMt5ModeUI()` senza `silenzioso`), da cui partono il suono di benvenuto e la domanda
// della prop firm. Una duplicata non si collega mai: eredita.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const CONTO = 'mt5:5057460278@FTMO-Demo';

test('una violazione NON cancella quello che si sapeva del conto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate((conto) => {
      // Un conto con la challenge avviata, preset one step e conto swing: la memoria che il
      // proprietario dice di non poter perdere.
      localStorage.setItem('fbl_prop_conti', JSON.stringify({
        [conto]: {stato: 'in_corso', propChiesto: true, preset: 'ftmo-1step',
                  tipoConto: 'swing', faseSuperata: 1, faseSuperataQuando: 1762900000000}
      }));
      const leggi = () => JSON.parse(localStorage.getItem('fbl_prop_conti') || '{}')[conto] || {};
      const prima = leggi();
      // La riga esatta che esegue la violazione (triggerPropFirmViolation, app.html).
      fblPropContoStatoSalva(conto, {stato: 'chiuso', motivo: 'perdita giornaliera'});
      return {prima, dopo: leggi()};
    }, CONTO);
    console.log('prima:', JSON.stringify(r.prima), '\ndopo :', JSON.stringify(r.dopo));

    assert.equal(r.dopo.stato, 'chiuso', 'la violazione deve comunque chiudere il conto');
    assert.equal(r.dopo.motivo, 'perdita giornaliera', 'e deve dire perche');
    assert.equal(r.dopo.propChiesto, true,
      'LA DOMANDA NON DEVE RIPARTIRE: propChiesto non si perde con la violazione ' +
      JSON.stringify(r.dopo));
    assert.equal(r.dopo.preset, 'ftmo-1step',
      'il preset tiene il limite giornaliero (one step 3%, two step 5%): perderlo cambia i ' +
      'numeri mostrati senza dirlo. ' + JSON.stringify(r.dopo));
    assert.equal(r.dopo.tipoConto, 'swing',
      'un conto Swing non deve tornare Standard da solo (restrizioni notte e notizie)');
    assert.equal(r.dopo.faseSuperata, 1, 'una fase superata e pagata resta scritta');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: su un conto mai visto la domanda DEVE comparire', async () => {
  // Una cura che smette di chiedere sarebbe peggio del difetto: all'aggiunta di un conto nuovo
  // quella domanda e' l'unico momento in cui si dichiara se e' una prop firm.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate((conto) => {
      localStorage.setItem('fbl_prop_conti', JSON.stringify({
        [conto]: {stato: 'in_corso', propChiesto: true}
      }));
      const chiede = (id) => {
        try { return !!fblPropAttivazioneDaChiedere(id); } catch (e) { return 'ERRORE: ' + e.message; }
      };
      return {noto: chiede(conto), maiVisto: chiede('mt5:99999999@Altro-Demo')};
    }, CONTO);
    console.log('chiede?', JSON.stringify(r));
    assert.equal(r.noto, false, 'su un conto gia' + '\' dichiarato non si chiede piu\'');
    assert.equal(r.maiVisto, true, 'su un conto nuovo si deve chiedere: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('una finestra duplicata eredita il collegamento in silenzio: niente rito, niente domande', async () => {
  // La duplicata riceve lo scatto della madre (pip_clone_snapshot). Da li' non devono partire
  // i tre riti del collegamento. Si misura la strada vera: updateMt5ModeUI chiamata col
  // parametro `silenzioso`, cioe' _justConnected falso.
  // La pagina si apre COME finestra duplicata (?pipSlot=2): il gestore dello scatto della madre
  // si applica solo in una copia, e solo li' il difetto si vede.
  const {browser, pagina} = await apriApp({query: '?pipSlot=2'});
  try {
    // Il gestore passa da switchAccountMode(...).then(...): la chiamata arriva DOPO, quindi si
    // consegna il messaggio, si aspetta, e solo allora si legge. Misurare subito dava «mai
    // chiamata» e avrebbe fatto credere curato un difetto solo perche' la misura era precoce.
    await pagina.evaluate(() => {
      window.__silenzioso = [];
      const vera = window.updateMt5ModeUI;
      window.__veraUpdate = vera;
      window.updateMt5ModeUI = function (silenzioso) { window.__silenzioso.push(!!silenzioso); return undefined; };
      const msg = {type: 'pip_clone_snapshot', slot: 0, mt5Connected: true, storico: false,
                   mt5CredsDraft: {login: '5057460278', server: 'FTMO-Demo'}};
      window.__erroreCanale = null;
      try {
        if (typeof tradingChannel !== 'undefined' && tradingChannel && tradingChannel.onmessage) {
          tradingChannel.onmessage({data: msg});
        } else { window.__erroreCanale = "il canale fra le finestre non e' acceso in questa pagina"; }
      } catch (e) { window.__erroreCanale = String(e); }
    });
    await pagina.waitForTimeout(1500);
    const r = await pagina.evaluate(() => {
      const out = {chiamate: window.__silenzioso.slice(), errore: window.__erroreCanale,
                   slot: (typeof PIP_SLOT !== 'undefined') ? PIP_SLOT : null};
      window.updateMt5ModeUI = window.__veraUpdate;
      return out;
    });
    console.log('updateMt5ModeUI chiamata con silenzioso =', JSON.stringify(r));
    if (r.errore) assert.fail('la prova non ha potuto misurare: ' + r.errore);
    assert.ok(r.chiamate.length > 0, 'la duplicata deve aggiornare la UI');
    assert.deepEqual(r.chiamate.filter(x => x === false), [],
      'ereditare il collegamento NON e\' collegarsi: updateMt5ModeUI va chiamata silenziosa, ' +
      'altrimenti partono suono di benvenuto, domanda sulle sale e domanda della prop firm. ' +
      JSON.stringify(r.chiamate));
  } finally { await browser.close(); }
});
