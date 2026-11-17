// UNA RISPOSTA DI /account PARTITA PRIMA DEL CAMBIO CONTO NON PUO' RIPORTARE L'APP SUL CONTO DI
// PRIMA.
//
// TROVATO con l'audit del 17 novembre 2026 (voce 1.4 della scaletta). `fetchMt5Positions` ha DUE
// guardie contro esattamente questo:
//
//     if(mt5ConnessioneInCorso>0)return;   // cambio conto in corso: nessuna fotografia e' affidabile
//     const generazione=mt5GenerazioneConto;
//     ...
//     if(generazione!==mt5GenerazioneConto)return;
//
// `fetchMt5AccountInfo` non ne ha nessuna. Il suo polling gira una volta al secondo, quindi una
// risposta puo' essere partita col conto A e arrivare quando l'utente e' gia' passato al conto B:
// quella risposta dice «sei sul conto A», e l'app ci torna. Da li' in poi crede di essere su A
// mentre il ponte e' su B, e un ordine finisce sul conto sbagliato - reale compreso. Il ponte non
// puo' difendersi: nella richiesta d'ordine non esiste un campo «conto atteso», esegue su
// qualunque sessione sia aperta.
//
// IL VINCOLO DA NON ROMPERE, ed e' il motivo per cui questa funzione non si puo' semplicemente
// zittire: `fetchMt5AccountInfo` E' ANCHE il canale che propaga il cambio conto fra dispositivi.
// Richiesta del proprietario del 10 novembre: «se passo da conto 1 a conto 2 sul PC, anche sul
// tablet deve passare, e viceversa». Quindi la guardia deve scartare SOLO le risposte scavalcate
// da un cambio conto fatto QUI, e lasciar passare tutto il resto. La quarta prova di questo banco
// e' quella: senza di lei una cura che blocca tutto passerebbe le prime tre e romperebbe la
// propagazione fra dispositivi, che e' una funzione chiesta e misurata.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SUL_CONTO_A = () => {
  mt5Connected = true;
  mt5ConnessioneInCorso = 0;
  _mt5AccountInfoInFlight = false;
  mt5AttivaConto('111', 'Broker-A', false, 0);
};

test('cambio conto a metà strada: la risposta vecchia non riporta sul conto di prima', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(SUL_CONTO_A);
    const r = await pagina.evaluate(async () => {
      // La risposta di /account dice «conto 111» (il conto A) e arriva CON CALMA. Nel frattempo
      // l'utente passa al conto B: e' esattamente la corsa, riprodotta a mano.
      window.fetchMt5WithTimeout = async () => {
        await new Promise(res => setTimeout(res, 60));
        return {ok:true, data:{login:'111', server:'Broker-A', reale:false, trade_mode:0}};
      };
      const p = fetchMt5AccountInfo();
      // il cambio conto: e' quello che fa connectToMt5Bridge quando arriva in fondo
      mt5GenerazioneConto = (mt5GenerazioneConto||0) + 1;
      mt5AttivaConto('222', 'Broker-B', false, 0);
      await p;
      return {
        login: mt5ContoAttivo ? String(mt5ContoAttivo.login) : null,
        server: mt5ContoAttivo ? String(mt5ContoAttivo.server||'') : null
      };
    });
    assert.equal(r.login, '222', 'l\'app e\' tornata sul conto di prima: ' + r.login + '@' + r.server);
    assert.equal(r.server, 'Broker-B');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('mentre un collegamento e\' in corso non si chiede nemmeno il conto', async () => {
  // La prima delle due guardie di fetchMt5Positions. Durante un cambio conto nessuna fotografia
  // e' affidabile: non si fa la richiesta, cosi' non c'e' nemmeno la risposta da scartare.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(SUL_CONTO_A);
    const r = await pagina.evaluate(async () => {
      let richieste = 0;
      window.fetchMt5WithTimeout = async () => {
        richieste++;
        return {ok:true, data:{login:'111', server:'Broker-A', reale:false, trade_mode:0}};
      };
      mt5ConnessioneInCorso = 1;             // un collegamento e' in volo
      await fetchMt5AccountInfo();
      const durante = richieste;
      mt5ConnessioneInCorso = 0;             // finito
      await fetchMt5AccountInfo();
      return {durante, dopo: richieste};
    });
    assert.equal(r.durante, 0, 'ha chiesto il conto durante un cambio conto');
    assert.equal(r.dopo, 1, 'finito il cambio conto, il polling deve riprendere');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la risposta scartata non lascia la funzione bloccata', async () => {
  // Autocontrollo anti-banco-muto: se uscendo presto si dimenticasse di rimettere a posto
  // `_mt5AccountInfoInFlight`, il polling del conto morirebbe per sempre dopo il primo cambio
  // conto - un difetto peggiore di quello curato, e silenzioso.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(SUL_CONTO_A);
    const r = await pagina.evaluate(async () => {
      window.fetchMt5WithTimeout = async () => {
        await new Promise(res => setTimeout(res, 40));
        return {ok:true, data:{login:'111', server:'Broker-A', reale:false, trade_mode:0}};
      };
      const p = fetchMt5AccountInfo();
      mt5GenerazioneConto = (mt5GenerazioneConto||0) + 1;
      mt5AttivaConto('222', 'Broker-B', false, 0);
      await p;
      const bloccato = !!_mt5AccountInfoInFlight;
      // e il giro dopo deve funzionare: ora il ponte dice davvero 222
      window.fetchMt5WithTimeout = async () => ({ok:true, data:{login:'222', server:'Broker-B', reale:false, trade_mode:0}});
      await fetchMt5AccountInfo();
      return {bloccato, login: mt5ContoAttivo ? String(mt5ContoAttivo.login) : null};
    });
    assert.equal(r.bloccato, false, '_mt5AccountInfoInFlight e\' rimasto appeso: il polling e\' morto');
    assert.equal(r.login, '222');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO: senza cambio conto, il conto del ponte arriva e vince (propagazione fra dispositivi)', async () => {
  // La funzione chiesta il 10 novembre: il conto cambiato altrove deve arrivare qui. Se questa
  // prova diventa rossa, la cura ha spento la propagazione invece della corsa.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(SUL_CONTO_A);
    const r = await pagina.evaluate(async () => {
      // nessun cambio conto locale: il ponte dice che ora si e' sul 333, e l'app deve seguirlo
      window.fetchMt5WithTimeout = async () => ({ok:true, data:{login:'333', server:'Broker-C', reale:false, trade_mode:0}});
      await fetchMt5AccountInfo();
      return {
        login: mt5ContoAttivo ? String(mt5ContoAttivo.login) : null,
        server: mt5ContoAttivo ? String(mt5ContoAttivo.server||'') : null
      };
    });
    assert.equal(r.login, '333', 'il cambio conto fatto altrove deve arrivare: era una richiesta esplicita');
    assert.equal(r.server, 'Broker-C');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO: mentre un collegamento e\' in corso non si sa su che conto si e\', e non si apre', async () => {
  // La regola del progetto, applicata alla finestra del cambio conto: «non so dove sono» vale
  // fermo. Se `tgAutoContoCollegatoKey()` rispondesse con il conto VECCHIO durante un cambio, la
  // guardia finale di tgAutoApriSuiConti lo confronterebbe con un dato che sta per cambiare.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(SUL_CONTO_A);
    const r = await pagina.evaluate(() => {
      const fermo = tgAutoContoCollegatoKey();
      mt5ConnessioneInCorso = 1;
      const durante = tgAutoContoCollegatoKey();
      mt5ConnessioneInCorso = 0;
      const dopo = tgAutoContoCollegatoKey();
      return {fermo, durante, dopo};
    });
    assert.equal(r.fermo, '111@Broker-A');
    assert.equal(r.durante, null, 'durante un cambio conto la destinazione non e\' nota: deve dire null');
    assert.equal(r.dopo, '111@Broker-A', 'finito il cambio, torna a saperlo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
