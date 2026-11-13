// L'IDENTITA' DI UN CONTO E' IL SERVER COME LO DICHIARA MT5 — E IL TRASLOCO NON PERDE NIENTE.
//
// DECISO dal proprietario il 12 novembre 2026: «certo, e' come la dichiara MT5, non si possono
// avere interferenze sotto questo aspetto».
//
// IL DIFETTO: lo stesso conto MT5 prendeva DUE identita' secondo da dove l'app lo imparava. Il
// ponte restituisce due stringhe diverse per il server: su `/connect` quella DIGITATA nel modulo
// di accesso (`body.server`), su `/account` quella che DICHIARA il terminale (`info.server`). La
// finestra madre impara dalla prima, le duplicate e gli altri dispositivi dalla seconda. Basta
// una maiuscola di differenza perche' `login@server` diventi due chiavi — e con due chiavi la
// prop firm si scorda la challenge e l'interruttore dell'apertura automatica di quel conto non si
// applica piu'.
//
// LA PARTE PERICOLOSA DELLA CURA, ed e' quella che queste prove guardano per prima: l'identita'
// e' la CHIAVE di tre archivi. Spostarla senza portarsi dietro quello che c'era farebbe ricadere
// un conto con l'interruttore SPENTO sulla configurazione base — e la base accesa addosso a un
// conto vero e' esattamente quello che a novembre ha chiuso una prop firm al proprietario.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const LOGIN = '5057460278';
const VECCHIA = LOGIN + '@ftmo-demo';      // come l'aveva digitata lui
const NUOVA = LOGIN + '@FTMO-Demo';        // come la dichiara MT5

test("IL CUORE: un conto con l'apertura automatica SPENTA resta spento anche con la chiave nuova", async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(([login, vecchia, nuova]) => {
      // Lo stato di partenza: l'utente ha spento l'interruttore su QUEL conto, e la
      // configurazione base e' ACCESA (il caso peggiore, quello che ha fatto il danno).
      const blocco = (attivo) => {
        const c = JSON.parse(JSON.stringify(tgAutoFx));
        c.attivo = attivo;
        return c;
      };
      tgAutoPerConto[vecchia] = {fx: blocco(false), cr: blocco(false)};
      delete tgAutoPerConto[nuova];
      tgAutoFx.attivo = true;
      // Adesso l'app impara il conto con il nome che dichiara MT5.
      mt5AttivaConto(login, nuova.split('@')[1]);
      const b = tgAutoPerConto[nuova];
      return {
        esisteSottoLaNuova: !!b,
        attivoFx: b && b.fx ? b.fx.attivo : null,
        attivoCr: b && b.cr ? b.cr.attivo : null,
        // e la risposta che conta davvero: la configurazione che DECIDE per quel conto
        decideAttivo: (function () {
          try { return !!tgAutoConfigPerDestinazione('XAUUSD', nuova).attivo; }
          catch (e) { return 'ERRORE: ' + e.message; }
        })()
      };
    }, [LOGIN, VECCHIA, NUOVA]);
    console.log('dopo il trasloco:', JSON.stringify(r));

    assert.equal(r.esisteSottoLaNuova, true,
      'la configurazione del conto deve esistere anche sotto la chiave nuova: senza, si ricade ' +
      "sulla base - ed e' la base accesa addosso a un conto vero che ha chiuso una prop firm");
    assert.equal(r.attivoFx, false, 'e deve essere ancora SPENTA: ' + JSON.stringify(r));
    assert.equal(r.decideAttivo, false,
      'la configurazione che decide per quel conto deve dire SPENTO: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se le due chiavi litigano, vince SPENTO', async () => {
  // Non e' un dettaglio: la chiave vecchia dice spento, la nuova (creata magari da un'altra
  // strada) dice acceso. Su soldi veri il disaccordo non puo' risolversi in «apri».
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(([login, vecchia, nuova]) => {
      const blocco = (attivo) => { const c = JSON.parse(JSON.stringify(tgAutoFx)); c.attivo = attivo; return c; };
      tgAutoPerConto[vecchia] = {fx: blocco(false), cr: blocco(false)};
      tgAutoPerConto[nuova] = {fx: blocco(true), cr: blocco(true)};
      mt5AttivaConto(login, nuova.split('@')[1]);
      return {attivoFx: tgAutoPerConto[nuova].fx.attivo, attivoCr: tgAutoPerConto[nuova].cr.attivo};
    }, [LOGIN, VECCHIA, NUOVA]);
    console.log('litigio:', JSON.stringify(r));
    assert.equal(r.attivoFx, false, 'se una delle due dice spento, spento vince: ' + JSON.stringify(r));
    assert.equal(r.attivoCr, false, 'anche per le cripto');
  } finally { await browser.close(); }
});

test('la prop firm si porta dietro challenge, preset e tipo di conto', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(([login, vecchia, nuova]) => {
      localStorage.setItem('fbl_prop_conti', JSON.stringify({
        ['mt5:' + vecchia]: {stato: 'in_corso', propChiesto: true, preset: 'ftmo-1step',
                             tipoConto: 'swing', faseSuperata: 1}
      }));
      mt5AttivaConto(login, nuova.split('@')[1]);
      const d = JSON.parse(localStorage.getItem('fbl_prop_conti') || '{}');
      const n = d['mt5:' + nuova] || null;
      return {
        sottoLaNuova: n,
        // e la domanda che il proprietario non vuole piu' sentire
        chiede: (function () {
          try { return !!fblPropAttivazioneDaChiedere('mt5:' + nuova); }
          catch (e) { return 'ERRORE: ' + e.message; }
        })()
      };
    }, [LOGIN, VECCHIA, NUOVA]);
    console.log('prop traslocata:', JSON.stringify(r));
    assert.ok(r.sottoLaNuova, 'il record della prop firm deve esistere sotto la chiave nuova');
    assert.equal(r.sottoLaNuova.propChiesto, true, "la challenge era gia' dichiarata");
    assert.equal(r.sottoLaNuova.preset, 'ftmo-1step',
      'il preset tiene il limite giornaliero: perderlo cambia i numeri senza dirlo');
    assert.equal(r.sottoLaNuova.tipoConto, 'swing', 'e il tipo di conto');
    assert.equal(r.chiede, false,
      'LA DOMANDA NON DEVE RIPARTIRE con la chiave nuova: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('PROVA DI CONTROLLO: una configurazione fatta sulla chiave NUOVA non viene sovrascritta', async () => {
  // Il trasloco non deve diventare un rullo compressore: se l'utente ha configurato il conto
  // sotto la chiave nuova, quella e' la sua volonta' piu' recente e si tiene.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(([login, vecchia, nuova]) => {
      const blocco = (attivo, rischio) => {
        const c = JSON.parse(JSON.stringify(tgAutoFx)); c.attivo = attivo; c.rischio = rischio; return c;
      };
      tgAutoPerConto[vecchia] = {fx: blocco(true, 1), cr: blocco(true, 1)};
      tgAutoPerConto[nuova] = {fx: blocco(true, 7), cr: blocco(true, 7)};
      mt5AttivaConto(login, nuova.split('@')[1]);
      return {rischio: tgAutoPerConto[nuova].fx.rischio, attivo: tgAutoPerConto[nuova].fx.attivo};
    }, [LOGIN, VECCHIA, NUOVA]);
    console.log('non sovrascritta:', JSON.stringify(r));
    assert.equal(r.rischio, 7, 'la configurazione sulla chiave nuova si tiene: ' + JSON.stringify(r));
    assert.equal(r.attivo, true, 'e se nessuna delle due era spenta, resta accesa');
  } finally { await browser.close(); }
});

test('il conto REALE resta reale dopo il trasloco', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(([login, vecchia, nuova]) => {
      mt5ContoRealePerChiave[vecchia] = true;
      delete mt5ContoRealePerChiave[nuova];
      mt5AttivaConto(login, nuova.split('@')[1]);
      return {
        realeSottoLaNuova: mt5ContoRealePerChiave[nuova],
        daTrattareComeReale: (function () {
          try { return !!tgAutoContoDaTrattareComeReale(login, nuova.split('@')[1]); }
          catch (e) { return 'ERRORE: ' + e.message; }
        })()
      };
    }, [LOGIN, VECCHIA, NUOVA]);
    console.log('reale:', JSON.stringify(r));
    assert.equal(r.realeSottoLaNuova, true,
      "un conto dichiarato REALE non puo' diventare «non lo so» per un cambio di chiave: " +
      JSON.stringify(r));
    assert.equal(r.daTrattareComeReale, true, 'e va ancora trattato come soldi veri');
  } finally { await browser.close(); }
});
