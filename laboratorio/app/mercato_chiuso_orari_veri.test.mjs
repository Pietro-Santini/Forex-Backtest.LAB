// «MERCATO CHIUSO» LO DICONO GLI ORARI VERI DELLO STRUMENTO, NON UN'ORA SCRITTA A MANO.
//
// SEGNALATO dal proprietario il 24 novembre 2026, alle 22:41 del suo orologio: «il mercato non è
// chiuso, chiude alle 23:00 su questo broker... il mercato è chiuso solo quando non riceve
// aggiornamenti dei dati delle candele e confronta l'ora di apertura e chiusura di ogni asset di
// quel broker con i suoi orologi diversi dal tipo di broker».
//
// MISURATO sulla sua pagina viva in quel momento: `#status` diceva «🌙 Mercato chiuso: grafico
// salvato e fermo... riapertura (00:00)» con `fblChiusuraMinutiLocali()` = **1320** (22:00) e
// `liveSessionPhaseNow()` = **'closed'**, mentre `fblScartoServerSec` era **noto** (3600). La
// catena: l'orologio del broker e quello di Roma sono nello stesso fuso, la «mezzanotte del server
// vista da Roma» cade su 0, il codice la scarta e **ripiega su LIVE_MT5_CLOSE_MIN = 22:00**. Un'ora
// piena di errore, su un broker che chiude alle 23:00.
//
// LA RICHIESTA DEL 1 NOVEMBRE 2026 E' STATA REVOCATA DAL PROPRIETARIO il 24 novembre: «va
// eliminata non è più valida mi ero sbagliato». Diceva che la chiusura MT5 a 22:00 era **piu'
// restrittiva** del calendario di Capital.com e doveva vincere sempre, anche senza MT5 collegato,
// «cosi' l'ultima candela segna 22:00 e non 00:00». Era giusta per il broker di allora, sbagliata
// per questo. Da qui in avanti: **dentro l'orario vero dello strumento il mercato NON e' chiuso**,
// e l'orologio nostro non puo' dire il contrario.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Martedi' 24 novembre 2026, 21:41 UTC = 22:41 a Roma: l'istante esatto della segnalazione.
const ISTANTE = Date.UTC(2026, 10, 24, 21, 41);
const ASSET = 'EURUSD';

const PREPARA = (modo) => {
  liveModeActive = true;
  mt5Connected = false;              // come il suo PC: aveva disconnesso alle 22:08
  currentAssetKey = 'EURUSD';
  // CALENDARIO REALISTICO, non 24 ore su 24 (cambiato il 25 novembre 2026). Qui c'era
  // `00:00 - 23:59` su tutti e sette i giorni, cioe' un calendario che **non chiude mai**: da
  // quella data l'app non ci crede piu' e risponde «non ho un calendario utilizzabile», perche'
  // per un asset non-cripto «mai chiuso» non puo' essere vero (mancherebbe anche il weekend).
  // `00:00 - 23:00` copre l'istante della segnalazione (21:41 UTC) e lascia un'ora di chiusura al
  // giorno: il calendario dice qualcosa, invece di dire tutto.
  const quasiSempre = ['00:00 - 23:00'];
  const soloNotte = ['00:00 - 01:00'];
  const quali = (modo === 'oreAperte') ? quasiSempre : soloNotte;
  orariAsset['EURUSD'] = {giorni: {mon: quali, tue: quali, wed: quali, thu: quali, fri: quali,
                                   sat: quali, sun: quali}};
};

test('dentro l\'orario vero dello strumento il mercato NON e\' chiuso, anche se l\'orologio dice 22:00', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    // NOTA: page.evaluate di Playwright accetta UN SOLO argomento — tre argomenti danno
    // «Too many arguments» e il test muore prima di misurare qualsiasi cosa (preso in faccia).
    const r = await pagina.evaluate(async ({fonte, istante, asset}) => {
      eval('(' + fonte + ')("oreAperte")');
      return {
        // LE PREMESSE, dichiarate: se cadono, il test non sta misurando quello che crede.
        premessaOrologioDiceChiuso: liveSessionPhaseAt(istante),
        premessaChiusuraCalcolata: fblChiusuraMinutiLocali(istante),
        // LA MISURA
        stato: (() => { const s = statoMercato(asset, istante); return s ? (s.chiuso ? ('chiuso/' + s.fonte) : 'aperto') : 'non chiuso'; })()
      };
    }, {fonte: PREPARA.toString(), istante: ISTANTE, asset: ASSET});
    assert.equal(r.premessaOrologioDiceChiuso, 'closed',
      'premessa: a quell\'istante l\'orologio nostro deve dire chiuso, altrimenti non si misura niente');
    assert.equal(r.premessaChiusuraCalcolata, 1320,
      'premessa: la chiusura calcolata deve essere il ripiego delle 22:00 (1320 minuti)');
    assert.equal(r.stato, 'non chiuso',
      'lo strumento e\' dentro il suo orario vero: «Mercato chiuso» qui e\' una bugia (visto: ' + r.stato + ')');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('fuori dall\'orario vero resta chiuso, e lo dice la fonte giusta', async () => {
  // La prova che non ho spento il cartello: una chiusura VERA deve restare una chiusura, e
  // dichiarare di venire dagli orari dello strumento, non da un'ora scritta a mano.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async ({fonte, istante, asset}) => {
      eval('(' + fonte + ')("oreChiuse")');
      const s = statoMercato(asset, istante);
      return {chiuso: !!(s && s.chiuso), fonte: s ? s.fonte : 'nessuna',
              haOraDiApertura: !!(s && s.apreAt)};
    }, {fonte: PREPARA.toString(), istante: ISTANTE, asset: ASSET});
    assert.equal(r.chiuso, true, 'fuori dall\'orario dello strumento il mercato e\' chiuso');
    assert.equal(r.fonte, 'orari', 'e la fonte deve essere gli orari veri, non \'mt5\': ' + r.fonte);
    assert.equal(r.haOraDiApertura, true, 'e deve saper dire quando riapre');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('una sola regola per «chiuso adesso», con tre risposte distinte', async () => {
  // LA CURA ERA A META', e questo e' il banco della seconda meta'. `statoMercato` guardava il
  // calendario, ma il TAGLIO delle candele, il confine dell'AUTOSEGUI e l'ACCETTAZIONE DEI PREZZI
  // restavano sull'orologio: il cartello «Mercato chiuso» spariva e il grafico si fermava uguale
  // alle 22:00. Ora la risposta e' una sola, `fblChiusoAllIstante`, e deve distinguere TRE casi:
  // dentro l'orario vero, fuori dall'orario vero, e «non ho il calendario» (solo allora
  // l'orologio). Confondere il terzo con il secondo e' il difetto che fa sparire le candele.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async ({fonte, istante, asset}) => {
      eval('(' + fonte + ')("oreAperte")');
      const dentro = fblChiusoAllIstante(asset, istante);
      const statoDentro = fblOrariAssetStato(asset, istante);
      eval('(' + fonte + ')("oreChiuse")');
      const fuori = fblChiusoAllIstante(asset, istante);
      const statoFuori = fblOrariAssetStato(asset, istante);
      // Terzo caso: nessun calendario per quell'asset -> deve ripiegare sull'orologio, che a
      // quell'istante dice chiuso (premessa verificata nei test sopra).
      delete orariAsset[asset];
      const senzaCalendario = fblChiusoAllIstante(asset, istante);
      const statoSenza = fblOrariAssetStato(asset, istante);
      return {dentro, fuori, senzaCalendario, statoDentro, statoFuori, statoSenza,
              orologio: liveSessionPhaseAt(istante)};
    }, {fonte: PREPARA.toString(), istante: ISTANTE, asset: ASSET});
    assert.equal(r.orologio, 'closed', 'premessa: l\'orologio nostro dice chiuso a quell\'istante');
    assert.equal(r.statoDentro, 'aperto', 'il calendario che copre l\'istante deve dire «aperto»');
    assert.equal(r.dentro, false,
      'dentro l\'orario vero NON e\' chiuso, qualunque cosa dica l\'orologio');
    assert.equal(r.statoFuori, 'chiuso', 'il calendario che non copre l\'istante deve dire «chiuso»');
    assert.equal(r.fuori, true, 'fuori dall\'orario vero e\' chiuso');
    assert.equal(r.statoSenza, null, 'senza calendario la risposta e\' «non lo so», non «chiuso»');
    assert.equal(r.senzaCalendario, true,
      'e solo allora decide l\'orologio, che qui dice chiuso: e\' l\'unica fonte che resta');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un calendario che non chiude MAI non blocca il congelamento (e i salvataggi di fine giornata)', async () => {
  // IL DIFETTO PIU' SUBDOLO DI QUESTA FAMIGLIA, trovato in revisione il 24 novembre 2026.
  // `orariIntervalli` fonde gli intervalli che si toccano entro 60 secondi, e il salto
  // 23:59 -> 00:00 e' esattamente 60.000 ms: un calendario `00:00 - 23:59` su sette giorni diventa
  // UN SOLO intervallo continuo, quindi «aperto» sempre. La guardia non avrebbe mai permesso il
  // congelamento, e con lui NON sarebbero mai partiti i salvataggi di fine giornata (stato
  // leggero, footprint, archivio footprint, storico del book, righe fuori sessione), ne' si
  // sarebbe impostato `fblNotteMt5`. Dati persi in silenzio, non un fastidio.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async ({fonte, istante, asset}) => {
      eval('(' + fonte + ')("oreAperte")');
      // Calendario che non chiude mai, come lo manderebbe un broker troppo generoso.
      const sempre = ['00:00 - 23:59'];
      orariAsset[asset] = {giorni: {mon: sempre, tue: sempre, wed: sempre, thu: sempre,
                                    fri: sempre, sat: sempre, sun: sempre}};
      const stato = fblOrariAssetStato(asset, istante);
      const aperto = fblOrariAssetAperto(asset, istante);
      // E il congelamento deve poter avvenire: si conta quante volte viene chiamato.
      let congelato = 0;
      const veroFreeze = liveSessionFreezeMt5, veroPhase = liveSessionPhaseNow;
      try{
        liveSessionFreezeMt5 = async () => { congelato++; };
        liveSessionPhaseNow = () => 'closed';
        liveSessionPhase = 'mt5';
        liveSessionBusy = false;
        await liveSessionTick();
      } finally { liveSessionFreezeMt5 = veroFreeze; liveSessionPhaseNow = veroPhase; }
      return {stato, aperto, congelato};
    }, {fonte: PREPARA.toString(), istante: ISTANTE, asset: ASSET});
    assert.equal(r.stato, null,
      'un calendario che non chiude mai non e\' un calendario: la risposta e\' «non lo so» (visto: ' + r.stato + ')');
    assert.equal(r.aperto, false,
      'e quindi non si deve rispondere «aperto», che bloccherebbe il congelamento per sempre');
    assert.equal(r.congelato, 1,
      'il congelamento deve avvenire, altrimenti i salvataggi di fine giornata non partono mai');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il grafico non si congela se gli orari veri dicono aperto', async () => {
  // L'altra meta' del difetto: non bastava togliere il cartello, perche' era il congelamento di
  // sessione a fermare il grafico e a scrivere «riapertura (00:00)». Qui si conta quante volte
  // liveSessionFreezeMt5 viene chiamata: a mercato aperto, zero.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async ({fonte, asset}) => {
      eval('(' + fonte + ')("oreAperte")');
      let congelato = 0;
      const veroFreeze = liveSessionFreezeMt5, veroPhase = liveSessionPhaseNow;
      try{
        liveSessionFreezeMt5 = async () => { congelato++; };
        liveSessionPhaseNow = () => 'closed';     // l'orologio propone la chiusura
        liveSessionPhase = 'mt5';
        liveSessionBusy = false;
        await liveSessionTick();
        return {congelato, fase: liveSessionPhase};
      } finally { liveSessionFreezeMt5 = veroFreeze; liveSessionPhaseNow = veroPhase; }
    }, {fonte: PREPARA.toString(), asset: ASSET});
    assert.equal(r.congelato, 0,
      'con lo strumento dentro il suo orario vero il grafico non va congelato');
    assert.equal(r.fase, 'mt5', 'e la fase resta quella di prima, per rivalutare al giro dopo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
