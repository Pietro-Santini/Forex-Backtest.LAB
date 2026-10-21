// CHIUDERE DA SOLI PRIMA CHE CHIUDA IL MERCATO.
//
// RICHIESTO dal proprietario (21 ottobre 2026), dopo aver letto i tick del rollover sul suo conto:
// «facciamo in modo nella configurazione delle strategie delle sale che se c'è una posizione ancora
// aperta prima di scattare la chiusura del mercato, un minuto prima, se la posizione è in guadagno,
// l'utente può selezionare se chiudere automaticamente la posizione prima dello scadere della
// chiusura del mercato. Questo deve stare sia sulla strategia universale che sulle strategie
// singole per ogni sala».
//
// PERCHE'. Al cambio giornata lo spread si apre di decine di pip (misurati 50 su EURCHF, contro gli
// 0,2 abituali) e lo stop di una SELL si esegue sull'ASK: tre posizioni sono state chiuse a 0,92827
// mentre il grafico del bid mostrava 0,92461. Non si può impedire al broker di eseguire: si può non
// farsi trovare lì.
//
// DUE SCELTE che questi test tengono ferme, ed entrambe vogliono dire «nel dubbio non si tocca»:
//   - si chiude SOLO se la posizione è in GUADAGNO. Una in perdita non si chiude per l'orario:
//     vorrebbe dire trasformare in perdita certa quella che poteva ancora girare;
//   - è SPENTO di predefinito. Chiude posizioni vere: lo si accende sapendo cosa fa.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Calendario come quello che manda il broker: chiusura alle 21:59 UTC. La posizione è una SELL
// EURCHF come quelle della notte del 20 ottobre.
const PREPARA = () => {
  liveModeActive = true;
  orariAsset = {
    EURCHF: {zona: 'UTC', giorni: {
      mon: ['00:00 - 21:59'], tue: ['00:00 - 21:59'], wed: ['00:00 - 21:59'],
      thu: ['00:00 - 21:59'], fri: ['00:00 - 21:59']}, letto: Date.now()}
  };
  window.CHIUSURA = Date.UTC(2026, 9, 20, 21, 59, 0);   // martedì
  window.POS = {id: 'P1', asset: 'EURCHF', side: 'SELL', entry: 0.92828, sl: 0.92827,
                lots: 1.38, tgSala: 'Segnali'};
  // Il guadagno lo decide il test: qui si parte in guadagno.
  window.fblPlCorrente = () => 120;
  // L'impostazione vive nello stesso oggetto che il pannello della strategia già salva:
  // tgAuto.universale per quella universale, tgAuto.sale[nome] per la singola sala.
  tgAutoFx = tgAutoVuoto();
  tgAuto = tgAutoFx;
  tgAutoFx.sale = {};
  window.UNI = () => tgAutoUni(tgAutoFx);
  window.SALA = (nome) => { tgAutoFx.sale[nome] = tgAutoFx.sale[nome] || {attivo: true}; return tgAutoFx.sale[nome]; };
};

test('di predefinito non chiude niente: va acceso apposta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      return {
        predefinito: fblChiusuraPreVuota(),
        decisione: fblDaChiuderePrimaDellaChiusura(window.POS, window.CHIUSURA - 30000)
      };
    }, PREPARA.toString());
    assert.equal(r.predefinito.attivo, false, 'spento di predefinito: chiude posizioni vere');
    assert.equal(r.predefinito.minuti, 1, 'e il predefinito è un minuto, come chiesto');
    assert.equal(r.decisione, false, 'spento vuol dire spento');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('acceso e in guadagno, un minuto prima: si chiude', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      window.UNI().chiusuraPre = {attivo: true, minuti: 1};
      return {
        unMinutoPrima: fblDaChiuderePrimaDellaChiusura(window.POS, window.CHIUSURA - 60000),
        mezzoMinutoPrima: fblDaChiuderePrimaDellaChiusura(window.POS, window.CHIUSURA - 30000),
        dieciMinutiPrima: fblDaChiuderePrimaDellaChiusura(window.POS, window.CHIUSURA - 600000)
      };
    }, PREPARA.toString());
    assert.equal(r.unMinutoPrima, true);
    assert.equal(r.mezzoMinutoPrima, true);
    assert.equal(r.dieciMinutiPrima, false, 'dieci minuti prima è ancora presto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in PERDITA non si chiude, nemmeno un secondo prima', async () => {
  // La regola più importante: non si trasforma in perdita certa quella che poteva ancora girare.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      window.UNI().chiusuraPre = {attivo: true, minuti: 1};
      window.fblPlCorrente = () => -439.53;    // la perdita vera di quella notte
      const inPerdita = fblDaChiuderePrimaDellaChiusura(window.POS, window.CHIUSURA - 1000);
      window.fblPlCorrente = () => 0;          // esattamente a pareggio: non è un guadagno
      const aPareggio = fblDaChiuderePrimaDellaChiusura(window.POS, window.CHIUSURA - 1000);
      window.fblPlCorrente = () => null;       // non si sa
      const senzaPl = fblDaChiuderePrimaDellaChiusura(window.POS, window.CHIUSURA - 1000);
      return {inPerdita, aPareggio, senzaPl};
    }, PREPARA.toString());
    assert.equal(r.inPerdita, false, 'in perdita si lascia correre');
    assert.equal(r.aPareggio, false, 'a pareggio esatto non c\'è guadagno da proteggere');
    assert.equal(r.senzaPl, false, '«non si sa» non diventa mai «sì»');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la strategia della SALA vince su quella universale, nei due sensi', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const quasi = window.CHIUSURA - 30000;
      // Universale accesa, sala spenta: comanda la sala.
      window.UNI().chiusuraPre = {attivo: true, minuti: 1};
      window.SALA('Segnali').chiusuraPre = {attivo: false, minuti: 1};
      const salaSpenta = fblDaChiuderePrimaDellaChiusura(window.POS, quasi);
      // Universale spenta, sala accesa: comanda la sala.
      window.UNI().chiusuraPre = {attivo: false, minuti: 1};
      window.SALA('Segnali').chiusuraPre = {attivo: true, minuti: 1};
      const salaAccesa = fblDaChiuderePrimaDellaChiusura(window.POS, quasi);
      // Una posizione di un'altra sala, senza impostazione propria: segue l'universale.
      window.UNI().chiusuraPre = {attivo: true, minuti: 1};
      const altra = Object.assign({}, window.POS, {tgSala: 'Altra Sala'});
      const seguiUniversale = fblDaChiuderePrimaDellaChiusura(altra, quasi);
      // E una aperta a mano, senza sala: anche lei segue l'universale.
      const aMano = Object.assign({}, window.POS, {tgSala: ''});
      const manuale = fblDaChiuderePrimaDellaChiusura(aMano, quasi);
      return {salaSpenta, salaAccesa, seguiUniversale, manuale};
    }, PREPARA.toString());
    assert.equal(r.salaSpenta, false, 'la sala che dice no vince sull\'universale che dice sì');
    assert.equal(r.salaAccesa, true, 'e la sala che dice sì vince sull\'universale che dice no');
    assert.equal(r.seguiUniversale, true, 'una sala senza impostazione propria segue l\'universale');
    assert.equal(r.manuale, true, 'e una posizione aperta a mano pure');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('i minuti si possono scegliere, e un numero assurdo torna a uno', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      window.UNI().chiusuraPre = {attivo: true, minuti: 15};
      const quindici = fblDaChiuderePrimaDellaChiusura(window.POS, window.CHIUSURA - 14 * 60000);
      const sedici = fblDaChiuderePrimaDellaChiusura(window.POS, window.CHIUSURA - 16 * 60000);
      return {
        quindici, sedici,
        zero: fblChiusuraPreNormalizza({attivo: true, minuti: 0}).minuti,
        negativo: fblChiusuraPreNormalizza({attivo: true, minuti: -5}).minuti,
        enorme: fblChiusuraPreNormalizza({attivo: true, minuti: 9999}).minuti,
        testo: fblChiusuraPreNormalizza({attivo: true, minuti: 'boh'}).minuti,
        quattroOre: fblChiusuraPreNormalizza({attivo: true, minuti: 240}).minuti
      };
    }, PREPARA.toString());
    assert.equal(r.quindici, true, 'con la soglia a 15, quattordici minuti prima si chiude');
    assert.equal(r.sedici, false, 'sedici minuti prima no');
    assert.equal(r.zero, 1, 'zero non è una soglia');
    assert.equal(r.negativo, 1);
    assert.equal(r.enorme, 1, '9999 minuti chiuderebbe le posizioni sempre: torna a uno');
    assert.equal(r.testo, 1);
    assert.equal(r.quattroOre, 240, 'quattro ore è il massimo consentito, e resta');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le cripto non hanno chiusura: non si chiude niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      window.UNI().chiusuraPre = {attivo: true, minuti: 1};
      const cripto = Object.assign({}, window.POS, {asset: 'BTCUSD'});
      const giaChiuso = fblDaChiuderePrimaDellaChiusura(window.POS, Date.UTC(2026, 9, 20, 23, 30, 0));
      return {cripto: fblDaChiuderePrimaDellaChiusura(cripto, window.CHIUSURA - 30000), giaChiuso};
    }, PREPARA.toString());
    assert.equal(r.cripto, false, 'il mercato cripto non chiude: non c\'è niente da anticipare');
    assert.equal(r.giaChiuso, false, 'a mercato già chiuso non si chiude niente «in anticipo»');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ============================================================================================
// L'ESECUZIONE: non basta decidere, bisogna che chiuda davvero — e che non chieda conferma.
// ============================================================================================

const PREPARA_GIRO = () => {
  const T = Date.UTC(2026, 9, 20, 21, 59, 0);
  liveModeActive = true;
  orariAsset = {EURCHF: {zona: 'UTC', giorni: {
    mon: ['00:00 - 21:59'], tue: ['00:00 - 21:59'], wed: ['00:00 - 21:59'],
    thu: ['00:00 - 21:59'], fri: ['00:00 - 21:59']}, letto: Date.now()}};
  tgAutoFx = tgAutoVuoto(); tgAuto = tgAutoFx; tgAutoFx.sale = {};
  tgAutoUni(tgAutoFx).chiusuraPre = {attivo: true, minuti: 1};
  window.CHIUSURA = T;
  window._chiuse = [];
  window._conferme = 0;
  window.fblPlCorrente = () => 120;
  window.fblPrezzoChiusura = () => 0.9265;
  window.closeTrade = (motivo, prezzo, pos) => {
    window._chiuse.push({motivo, prezzo, id: pos && pos.id, reale: false});
    positions = positions.filter(p => p !== pos);
  };
  window.appConfirm = async () => { window._conferme++; return true; };
  window.closeMt5PositionReal = async (pos, motivo, opz) => {
    if (!(opz && opz.senzaConferma)) await window.appConfirm();
    window._chiuse.push({motivo, id: pos.id, reale: true});
    positions = positions.filter(p => p !== pos);
    return true;
  };
  positions = [{id: 'SIM', asset: 'EURCHF', side: 'SELL', entry: 0.92828, lots: 1.38, tgSala: 'Segnali'}];
  fblChiusuraPreUltimoGiro = 0;
};

test('un minuto prima chiude davvero la posizione simulata in guadagno', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      const fatte = await fblChiusuraPreGiro(window.CHIUSURA - 30000);
      return {fatte, chiuse: window._chiuse, rimaste: positions.length};
    }, PREPARA_GIRO.toString());
    assert.equal(r.fatte, 1, 'deve chiuderne una');
    assert.equal(r.chiuse.length, 1);
    assert.equal(r.chiuse[0].motivo, 'PRE-CHIUSURA', 'nel Journal si deve leggere perché è stata chiusa');
    assert.equal(r.rimaste, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una posizione REALE su MT5 si chiude SENZA chiedere conferma', async () => {
  // All'ora di chiusura non c'è nessuno davanti allo schermo: una conferma qui vorrebbe dire
  // non chiudere niente. La scelta è già stata fatta accendendo l'interruttore.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      positions = [{id: 'REALE', asset: 'EURCHF', side: 'SELL', entry: 0.92828, lots: 1.38,
                    tgSala: 'Segnali', mt5Ticket: 58976305959}];
      const fatte = await fblChiusuraPreGiro(window.CHIUSURA - 30000);
      return {fatte, chiuse: window._chiuse, conferme: window._conferme};
    }, PREPARA_GIRO.toString());
    assert.equal(r.fatte, 1);
    assert.equal(r.chiuse[0].reale, true, 'la posizione reale va chiusa sul conto, non in locale');
    assert.equal(r.conferme, 0, 'nessun popup di conferma: non c\'è nessuno a premerlo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in perdita non tocca niente, e lontano dalla chiusura nemmeno', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      window.fblPlCorrente = () => -439.53;
      const inPerdita = await fblChiusuraPreGiro(window.CHIUSURA - 30000);
      window.fblPlCorrente = () => 120;
      fblChiusuraPreUltimoGiro = 0;
      const lontano = await fblChiusuraPreGiro(window.CHIUSURA - 3600000);
      return {inPerdita, lontano, chiuse: window._chiuse.length, rimaste: positions.length};
    }, PREPARA_GIRO.toString());
    assert.equal(r.inPerdita, 0, 'in perdita si lascia correre');
    assert.equal(r.lontano, 0, 'un\'ora prima non è «prima della chiusura»');
    assert.equal(r.chiuse, 0);
    assert.equal(r.rimaste, 1, 'la posizione resta aperta');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la stessa posizione non viene chiusa due volte', async () => {
  // La chiusura reale è asincrona: senza una bandierina, il giro successivo la richiederebbe
  // una seconda volta mentre il broker sta ancora rispondendo.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      let sbloccare = null;
      const attesa = new Promise(res => { sbloccare = res; });
      positions = [{id: 'REALE', asset: 'EURCHF', side: 'SELL', entry: 0.92828, lots: 1.38,
                    tgSala: 'Segnali', mt5Ticket: 1}];
      window.closeMt5PositionReal = async (pos, motivo, opz) => {
        window._chiuse.push({motivo, id: pos.id});
        await attesa;                       // il broker ci mette un po'
        positions = positions.filter(x => x !== pos);
        return true;
      };
      const primo = fblChiusuraPreGiro(window.CHIUSURA - 30000);
      fblChiusuraPreUltimoGiro = 0;          // il giro dopo arriva mentre il primo aspetta
      await fblChiusuraPreGiro(window.CHIUSURA - 29000);
      sbloccare();
      await primo;
      return {richieste: window._chiuse.length};
    }, PREPARA_GIRO.toString());
    assert.equal(r.richieste, 1, 'una sola richiesta al broker, non due');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('in Storico non chiude niente: lì si sta rivedendo il passato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      liveModeActive = false;
      const fatte = await fblChiusuraPreGiro(window.CHIUSURA - 30000);
      return {fatte, rimaste: positions.length};
    }, PREPARA_GIRO.toString());
    assert.equal(r.fatte, 0, 'in Storico «sta per chiudere il mercato» non vuol dire niente');
    assert.equal(r.rimaste, 1);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('l\'interruttore c\'è nel pannello della strategia, ed è lo stesso per sala e universale', async () => {
  // Il pannello è UNO: tgAutoApriStrat gli passa l'oggetto della strategia universale oppure
  // quello della sala. Provando che la riga scrive dentro l'oggetto che riceve, si prova che
  // funziona per entrambe — ed è il motivo per cui non ci sono due interfacce da tenere allineate.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')();
      const cfg = {attivo: true, regole: ['', '', ''], quote: [], avvicinamento: 70};
      const box = document.createElement('div');
      document.body.appendChild(box);
      tgAutoCostruisciRegole(box, cfg, 3, 'di prova', () => {});
      const etichette = [...box.querySelectorAll('label')];
      const quale = etichette.findIndex(l => /prima della chiusura del mercato/i.test(l.textContent));
      if (quale < 0) return {manca: true, etichette: etichette.map(l => l.textContent.trim())};
      const cb = etichette[quale].querySelector('input[type=checkbox]');
      if (!cb) return {manca: true, etichette: ['senza casella']};
      cb.checked = true;
      cb.dispatchEvent(new Event('change', {bubbles: true}));
      return {scritto: cfg.chiusuraPre, etichetta: etichette[quale].textContent.trim()};
    }, PREPARA_GIRO.toString());
    assert.equal(r.manca, undefined,
      'nel pannello della strategia manca l\'interruttore: ' + JSON.stringify(r.etichette));
    assert.ok(r.scritto, 'spuntando la casella la scelta deve finire nell\'oggetto della strategia');
    assert.equal(r.scritto.attivo, true);
    assert.equal(r.scritto.minuti, 1, 'con il predefinito di un minuto, come chiesto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
