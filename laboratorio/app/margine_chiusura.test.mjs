// IL MARGINE DELLO SPREAD SOLO INTORNO ALLA CHIUSURA E ALLA RIAPERTURA DEL MERCATO.
//
// PERCHE' SERVE, e i numeri da cui nasce.
//
// Il 21 ottobre 2026 il proprietario ha misurato il danno vero: al cambio giornata lo spread
// di EURCHF e' passato da 0,2 pip a 50 pip (bid 0,92461 / ask 0,92961 alle 00:00:42). Lo stop di
// una SELL si esegue sull'ASK, e il fermo a pareggio esatto sta dentro la forbice: al primo
// allargamento viene preso, e la posizione si chiude a un prezzo che il grafico non ha mai
// mostrato. Il 21 ottobre la risposta fu DI RIFIUTARE: se lo stop cadrebbe dentro la forbice,
// non si sposta niente e si dice perche'.
//
// Il 22 ottobre il proprietario chiede la stessa protezione, ma con una differenza: il margine
// esiste SOLO nella finestra di chiusura/riapertura, e quando il mercato si stabilizza il fermo
// torna al pareggio esatto. Con un interruttore nelle impostazioni.
//
// TRE REGOLE CHE I QUESTI TESTI FISANO (e che vengono da misure, non da opinioni):
//
//  1. IL MARGINE E' LA FORBICE DEL CAMBIO GIORNATA (50 pip misurati), non lo spread tipico.
//     Con lo spread tipico (~0,6 pip) lo stop resterebbe dentro la forbice: il margine non
//     proteggerebbe niente. E' la stessa ragione per cui il margine della v2.0.12 (che usava lo
//     spread tipico) non ha mai salvato niente.
//
//  2. IL METRO DEL "TROPPO VICINO" E' DIVERSO PER IL MARGINE. Confrontare il margine con la
//     forbice significa confrontare la forbice con se stessa: il margine non sarebbe mai
//     "abbastanza lontano" e non scatterebbe mai. Per il margine il metro e' lo spread
//     ORDINARIO (lo stop non deve trovarsi cosi' vicino da essere preso al primo allargamento);
//     per il pareggio esatto resta la forbice (la regola del 21 ottobre).
//
//  3. LO STATO LOCALE RACCONTA LA VERITA'. Se il ponte rifiuta lo spostamento, l'app non
//     scrive lo stop come se fosse stato messo: e non riprova ogni due secondi, ma ogni cinque
//     minuti.
//
// Il tempo e' sempre iniettato: nessun test dipende dall'ora vera della macchina.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Martedì 20 ottobre 2026 (UTC). Il mercato è aperto dalle 00:00 alle 21:59.
const T = (h, m, s) => Date.UTC(2026, 9, 20, h, m, s || 0);

// La forbice del cambio giornata MISURATA (50 pip, il numero del 21 ottobre) dichiarata per
// l'asset del test: il margine deve valere esattamente 50 pip, non una stima.
const PREPARA = () => {
  liveModeActive = true;
  mt5Connected = false;
  orariAsset = {
    EURUSD: {
      zona: 'UTC',
      giorni: {
        mon: ['00:00 - 21:59'], tue: ['00:00 - 21:59'], wed: ['00:00 - 21:59'],
        thu: ['00:00 - 21:59'], fri: ['00:00 - 21:59']
      },
      letto: Date.now()
    }
  };
  fblSpreadRoll = {EURUSD: {pips: 50, il: Date.now()}};
};

// Una posizione REALE (ticket presente, prezzi veri nel ponte) con costi a zero: il pareggio
// esatto e' l'entrata. bid 1,08498 / ask 1,08502: lo spread normale di 0,4 pip.
const REALE = (side, bid, ask) => {
  const pos = {asset: 'EURUSD', side: side, entry: 1.08500, mt5Ticket: 4242, sl: 1.08500, tp: 0};
  mt5RealPositions = [{
    ticket: 4242, symbol: 'EURUSD', side: side, price_open: 1.08500,
    bid: bid, ask: ask, sl: 1.085, tp: 0,
    commission: 0, swap: 0, point: 0.00001, digits: 5, valore_punto: 10
  }];
  return pos;
};

// Il banco di prova: si prepara il mondo e si consegna la funzione che crea le posizioni.
const BANCO = {prepara: PREPARA.toString(), reale: REALE.toString()};

test('la finestra: il margine serve solo intorno alla chiusura e alla riapertura', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((b) => {
      eval('(' + b.prepara + ')')();
      const t = (h, m) => Date.UTC(2026, 9, 20, h, m, 0);
      const f = (h, m) => fblFinestraChiusura('EURUSD', t(h, m));
      return {
        prima: f(21, 45), esattamenteTrenta: f(21, 29), troppoPrima: f(21, 28), giorno: f(18, 0),
        riapertura: f(0, 10), esattamenteTrentaRi: f(0, 30), troppoTardi: f(0, 31), chiuso: f(22, 30)
      };
    }, BANCO);
    assert.equal(r.prima.calda, true, 'quindici minuti prima della chiusura siamo nella finestra');
    assert.equal(r.prima.fase, 'chiusura');
    assert.equal(r.esattamenteTrenta.calda, true, 'trenta minuti esatti prima della chiusura siamo ancora dentro');
    assert.equal(r.troppoPrima.calda, false, 'un minuto dopo, no');
    assert.equal(r.giorno.calda, false, 'in orario normale no');
    assert.equal(r.giorno.fase, null, 'e in orario normale non c\'e\' nessuna fase');
    assert.equal(r.riapertura.calda, true, 'dieci minuti dopo la riapertura siamo nella finestra');
    assert.equal(r.riapertura.fase, 'riapertura');
    assert.equal(r.esattamenteTrentaRi.calda, true, 'trenta minuti esatti dopo la riapertura siamo ancora dentro');
    assert.equal(r.troppoTardi.calda, false, 'un minuto dopo, no');
    assert.equal(r.chiuso.calda, false, 'a mercato chiuso non si ordina niente: la finestra e\' spenta');
    assert.equal(r.chiuso.fase, 'chiuso');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('fuori dalla finestra il pareggio e\' esatto; dentro, il fermo si allontana di uno spread', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((b) => {
      eval('(' + b.prepara + ')')();
      const REALE = eval('(' + b.reale + ')');
      const t = (h, m) => Date.UTC(2026, 9, 20, h, m, 0);
      const pos = REALE('BUY', 1.08498, 1.08502);
      const fuori = fblPareggioPerStop(pos, t(18, 0));
      const dentro = fblPareggioPerStop(pos, t(21, 45));
      const dFuori = fblPareggioChiusuraDecide(pos, t(18, 0));
      const dDentro = fblPareggioChiusuraDecide(pos, t(21, 45));
      return {
        esatto: fuori.esatto, margineFuori: fuori.margine, prezzoFuori: fuori.prezzo,
        margineDentro: dentro.margine, prezzoDentro: dentro.prezzo,
        azioneFuori: dFuori.azione, azioneDentro: dDentro.azione,
        prezzoDecisione: dDentro.prezzo, fase: dDentro.fase
      };
    }, BANCO);
    assert.equal(r.esatto, 1.085, 'il pareggio esatto e\' l\'entrata: costi zero');
    assert.equal(r.margineFuori, 0, 'fuori dalla finestra non c\'e\' margine');
    assert.equal(r.prezzoFuori, 1.085, 'e il fermo resta il pareggio esatto');
    assert.equal(r.azioneFuori, 'nessuna', 'fuori dalla finestra non si tocca niente');
    // 50 pip (la forbice misurata il 21 ottobre) su EURUSD = 50 x 0,0001 = 0,0050.
    assert.equal(r.margineDentro, 0.005, 'il margine e\' la forbice del cambio giornata: 50 pip');
    assert.equal(r.prezzoDentro, 1.08, 'e un BUY sposta il fermo SOTTO, dalla parte da cui puo\' essere preso');
    assert.equal(r.azioneDentro, 'margine', 'nella finestra il fermo si allontana');
    assert.equal(r.prezzoDecisione, 1.08, 'alla decisione, lo stesso prezzo');
    assert.equal(r.fase, 'chiusura', 'e la finestra dice perche\': stiamo chiudendo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una vendita sposta il fermo SOPRA: dalla parte da cui puo\' essere presa', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((b) => {
      eval('(' + b.prepara + ')')();
      const REALE = eval('(' + b.reale + ')');
      const t = (h, m) => Date.UTC(2026, 9, 20, h, m, 0);
      const pos = REALE('SELL', 1.08498, 1.08502);
      const dentro = fblPareggioPerStop(pos, t(21, 45));
      const d = fblPareggioChiusuraDecide(pos, t(21, 45));
      return {prezzo: dentro.prezzo, margine: dentro.margine, azione: d.azione};
    }, BANCO);
    assert.equal(r.margine, 0.005, 'il margine e\' lo stesso dei due lati');
    assert.equal(r.prezzo, 1.09, 'ma una SELL sposta il fermo SOPRA: 1,08500 + 50 pip');
    assert.equal(r.azione, 'margine', 'e la decisione e\' di allontanarlo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l\'interruttore spento: il pareggio resta esatto, sempre', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((b) => {
      eval('(' + b.prepara + ')')();
      const REALE = eval('(' + b.reale + ')');
      const t = (h, m) => Date.UTC(2026, 9, 20, h, m, 0);
      const el = document.getElementById('fblMargineChiusura');
      const acceso = el ? el.checked : null;
      const pos = REALE('BUY', 1.08498, 1.08502);
      const prima = fblPareggioPerStop(pos, t(21, 45)).margine;
      if (el) el.checked = false;
      const spento = fblMargineChiusuraAttivo();
      const pos2 = REALE('BUY', 1.08498, 1.08502);
      const conSpento = fblPareggioPerStop(pos2, t(21, 45)).margine;
      const azione = fblPareggioChiusuraDecide(pos2, t(21, 45)).azione;
      if (el) el.checked = true;
      const pos3 = REALE('BUY', 1.08498, 1.08502);
      const riaccenso = fblPareggioPerStop(pos3, t(21, 45)).margine;
      return {acceso, prima, spento, conSpento, azione, riaccenso};
    }, BANCO);
    assert.equal(r.acceso, true, 'l\'interruttore esiste ed e\' acceso di default');
    assert.equal(r.prima, 0.005, 'col interruttore acceso, nella finestra c\'e\' il margine');
    assert.equal(r.spento, false, 'l\'interruttore spento si sente');
    assert.equal(r.conSpento, 0, 'col interruttore spento non c\'e\' margine, nemmeno nella finestra');
    assert.equal(r.azione, 'nessuna', 'e quindi non si tocca niente');
    assert.equal(r.riaccenso, 0.005, 'riaccendendolo il margine torna');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la macchina a stati: pareggio -> margine nella finestra, e ritorno al pareggio quando il mercato si stabilizza', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((b) => {
      eval('(' + b.prepara + ')')();
      const REALE = eval('(' + b.reale + ')');
      const t = (h, m) => Date.UTC(2026, 9, 20, h, m, 0);
      // 1) fermo al pareggio esatto, finestra calda -> si allontana
      const pos1 = REALE('BUY', 1.08498, 1.08502);
      const d1 = fblPareggioChiusuraDecide(pos1, t(21, 45));
      // 2) fermo col margine, mercato stabilizzato (prezzo lontano) -> torna al pareggio esatto
      const pos2 = REALE('BUY', 1.08600, 1.08604);
      pos2.sl = 1.08;
      pos2.beChiusura = {prezzo: 1.08, esatto: 1.085, margine: 0.005, fase: 'chiusura', at: t(21, 45)};
      const d2 = fblPareggioChiusuraDecide(pos2, t(18, 0));
      // 3) fermo spostato a mano -> non si tocca, e il segno del margine va via
      const pos3 = REALE('BUY', 1.08600, 1.08604);
      pos3.sl = 1.079;
      pos3.beChiusura = {prezzo: 1.08, esatto: 1.085, margine: 0.005, fase: 'chiusura', at: t(21, 45)};
      const d3 = fblPareggioChiusuraDecide(pos3, t(18, 0));
      // 4) fermo al pareggio esatto ma mercato chiuso -> non si ordina niente
      const pos4 = REALE('BUY', 1.08498, 1.08502);
      const d4 = fblPareggioChiusuraDecide(pos4, t(22, 30));
      return {
        a1: d1.azione, p1: d1.prezzo,
        a2: d2.azione, p2: d2.prezzo,
        a3: d3.azione, segno3: pos3.beChiusura,
        a4: d4.azione
      };
    }, BANCO);
    assert.equal(r.a1, 'margine', 'al pareggio esatto, nella finestra, il fermo si allontana');
    assert.equal(r.p1, 1.08, 'di 50 pip');
    assert.equal(r.a2, 'pareggio', 'finita la finestra, il fermo col margine torna al pareggio');
    assert.equal(r.p2, 1.085, 'al pareggio ESATTO: profitto netto zero');
    assert.equal(r.a3, 'nessuna', 'uno stop spostato a mano non si tocca mai');
    assert.equal(r.segno3, null, 'e il segno del margine sparisce: non si ripartira\' da li\'');
    assert.equal(r.a4, 'nessuna', 'a mercato chiuso non si sposta niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una posizione simulata non riceve mai il margine', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((b) => {
      eval('(' + b.prepara + ')')();
      const t = (h, m) => Date.UTC(2026, 9, 20, h, m, 0);
      const pos = {asset: 'EURUSD', side: 'BUY', entry: 1.08500, mt5Ticket: null, sl: 1.085, tp: 0};
      const scelta = fblPareggioPerStop(pos, t(21, 45));
      const d = fblPareggioChiusuraDecide(pos, t(21, 45));
      return {margine: scelta.margine, prezzo: scelta.prezzo, azione: d.azione};
    }, BANCO);
    assert.equal(r.margine, 0, 'su una posizione simulata il margine non c\'e\': lo spread e\' gia\' dentro l\'entrata');
    assert.equal(r.prezzo, 1.085, 'il fermo resta il pareggio esatto');
    assert.equal(r.azione, 'nessuna', 'e la decisione non propone niente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il giro sposta lo stop sul conto e, se il conto rifiuta, l\'app non mente e non insiste ogni due secondi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (b) => {
      eval('(' + b.prepara + ')')();
      const REALE = eval('(' + b.reale + ')');
      const t = (h, m, s) => Date.UTC(2026, 9, 20, h, m, s || 0);
      // IL PONTE FINTO: conta le chiamate e dice quello che vuole.
      let chiamate = 0;
      window.fetchMt5WithTimeout = async () => { chiamate++; return {ok: true}; };
      window.fetchMt5Positions = async () => {};
      const pos = REALE('BUY', 1.08498, 1.08502);
      positions = [pos];
      const primo = await fblPareggioChiusuraGiro(t(21, 45));
      const slDopo = pos.sl;
      const segno = pos.beChiusura ? pos.beChiusura.prezzo : null;
      const tentativo = pos.beChiusuraTentativo;
      const secondo = await fblPareggioChiusuraGiro(t(21, 45, 1));
      const chiamateDopo = chiamate;
      // IL PONTE CHE RIFIUTA: lo stop non si sposta.
      let chiamate2 = 0;
      window.fetchMt5WithTimeout = async () => { chiamate2++; return {ok: false, message: 'rifiutato'}; };
      const pos2 = REALE('BUY', 1.08498, 1.08502);
      pos2.sl = 1.085;
      positions = [pos2];
      const giroRifiutato = await fblPareggioChiusuraGiro(t(21, 45));
      const slRifiutato = pos2.sl;
      const subito = await fblPareggioChiusuraGiro(t(21, 45, 1));
      const chiamateRifiutate = chiamate2;
      const dopoCinqueMinuti = await fblPareggioChiusuraGiro(t(21, 50));
      return {
        primo, slDopo, segno, tentativo, secondo, chiamateDopo,
        giroRifiutato, slRifiutato, subito, chiamateRifiutate,
        dopoCinqueMinuti, chiamateFinali: chiamate2
      };
    }, BANCO);
    assert.equal(r.primo, 1, 'il giro ha spostato lo stop di una posizione');
    assert.equal(r.slDopo, 1.08, 'e lo stop e\' davvero quello col margine');
    assert.equal(r.segno, 1.08, 'il segno del margine e\' lo stesso prezzo');
    assert.equal(r.tentativo, Date.UTC(2026, 9, 20, 21, 45, 0), 'il tentativo e\' tracciato con l\'ora iniettata');
    assert.equal(r.secondo, 0, 'il giro dopo non sposta niente: il fermo e\' gia\' al margine');
    assert.equal(r.chiamateDopo, 1, 'e non riprova a ogni due secondi');
    // IL CONTO RIFIUTA
    assert.equal(r.giroRifiutato, 0, 'se il conto rifiuta, il giro non dichiara nessuno spostamento');
    assert.equal(r.slRifiutato, 1.085, 'e lo stop locale resta quello vero: il pareggio esatto');
    assert.equal(r.subito, 0, 'non si insiste un secondo dopo');
    assert.equal(r.chiamateRifiutate, 1, 'il ponte e\' stato chiamato una volta sola');
    assert.equal(r.dopoCinqueMinuti, 0, 'dopo cinque minuti si riprova (e il conto rifiuta ancora)');
    assert.equal(r.chiamateFinali, 2, 'quindi il ponte e\' stato chiamato due volte in tutto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il ritorno al pareggio esatto aspetta cinque minuti come l\'altro, se il conto rifiuta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (b) => {
      eval('(' + b.prepara + ')')();
      const REALE = eval('(' + b.reale + ')');
      const t = (h, m, s) => Date.UTC(2026, 9, 20, h, m, s || 0);
      let chiamate = 0;
      window.fetchMt5WithTimeout = async () => { chiamate++; return {ok: false, message: 'rifiutato'}; };
      window.fetchMt5Positions = async () => {};
      // Il fermo col margine, il mercato stabilizzato: il giro dovrebbe riportarlo al pareggio esatto.
      const pos = REALE('BUY', 1.08600, 1.08604);
      pos.sl = 1.08;
      pos.beChiusura = {prezzo: 1.08, esatto: 1.085, margine: 0.005, fase: 'chiusura', at: t(21, 45)};
      positions = [pos];
      const primo = await fblPareggioChiusuraGiro(t(18, 0));
      const slDopo = pos.sl;
      const segno = pos.beChiusura ? pos.beChiusura.prezzo : null;
      const subito = await fblPareggioChiusuraGiro(t(18, 0, 1));
      const chiamateDopo = chiamate;
      const dopoCinqueMinuti = await fblPareggioChiusuraGiro(t(18, 5));
      return {primo, slDopo, segno, subito, chiamateDopo, dopoCinqueMinuti, chiamateFinali: chiamate};
    }, BANCO);
    assert.equal(r.primo, 0, 'se il conto rifiuta, il giro non dichiara nessuno spostamento');
    assert.equal(r.slDopo, 1.08, 'e il fermo locale resta quello col margine: la verita\'');
    assert.equal(r.segno, 1.08, 'e il segno del margine resta: il ritorno non e\' ancora avvenuto');
    assert.equal(r.subito, 0, 'non si insiste un secondo dopo');
    assert.equal(r.chiamateDopo, 1, 'il ponte e\' stato chiamato una volta sola');
    assert.equal(r.dopoCinqueMinuti, 0, 'dopo cinque minuti si riprova (e il conto rifiuta ancora)');
    assert.equal(r.chiamateFinali, 2, 'quindi il ponte e\' stato chiamato due volte in tutto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il pulsante BE mette il fermo col margine nella finestra, ma il Journal dice la verita\'', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((b) => {
      eval('(' + b.prepara + ')')();
      const REALE = eval('(' + b.reale + ')');
      const t = (h, m) => Date.UTC(2026, 9, 20, h, m, 0);
      window.fetchMt5WithTimeout = async () => ({ok: true});
      window.fetchMt5Positions = async () => {};
      // 1) nella finestra: il fermo va col margine
      const pos = REALE('BUY', 1.08498, 1.08502);
      let fatto = false, errore = '';
      try { fatto = applyBreakevenToPosition(pos, t(21, 45)); } catch (e) { errore = String(e); }
      const sl = pos.sl;
      const segno = pos.beMarkerSl;
      const chiusura = pos.beChiusura ? pos.beChiusura.prezzo : null;
      // 2) fuori dalla finestra, fermo troppo vicino al prezzo: la regola del 21 ottobre
      //    (la forbice) rifiuta, e questo vale anche col pulsante.
      const pos2 = REALE('BUY', 1.08498, 1.08502);
      let rifiutato = true;
      try { rifiutato = applyBreakevenToPosition(pos2, t(18, 0)); } catch (e) {}
      const sl2 = pos2.sl;
      // 3) fuori dalla finestra e lontano dal prezzo: pareggio esatto
      const pos3 = REALE('BUY', 1.09100, 1.09104);
      let fatto3 = false;
      try { fatto3 = applyBreakevenToPosition(pos3, t(18, 0)); } catch (e) {}
      const sl3 = pos3.sl;
      const segno3 = pos3.beMarkerSl;
      const chiusura3 = pos3.beChiusura;
      return {fatto, errore, sl, segno, chiusura, rifiutato, sl2, fatto3, sl3, segno3, chiusura3};
    }, BANCO);
    assert.equal(r.errore, '', 'il pulsante non deve esplodere');
    assert.equal(r.fatto, true, 'il pulsante ha spostato il fermo');
    assert.equal(r.sl, 1.08, 'nella finestra il fermo va col margine: 50 pip dal pareggio esatto');
    assert.equal(r.segno, 1.085, 'ma il segno del Trade Journal resta il pareggio ESATTO');
    assert.equal(r.chiusura, 1.08, 'e il segno del margine dice da quale prezzo ripartire');
    assert.equal(r.rifiutato, false, 'fuori dalla finestra, fermo dentro la forbice: il pulsante rifiuta');
    assert.equal(r.sl2, 1.085, 'e non tocca niente');
    assert.equal(r.fatto3, true, 'fuori dalla finestra e lontano dal prezzo, il pulsante mette il pareggio esatto');
    assert.equal(r.sl3, 1.085, 'al pareggio esatto');
    assert.equal(r.segno3, 1.085, 'e il segno del Journal coincide col fermo: qui \"BE\" e\' vero');
    assert.equal(r.chiusura3, null, 'fuori dalla finestra non c\'e\' nessun margine da riportare indietro');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
