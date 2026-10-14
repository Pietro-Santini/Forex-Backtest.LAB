// IL SETUP PROVATO SULLA RESA DIVENTA LA STRATEGIA DELLA SALA.
//
// RICHIESTO dal proprietario: «quando andiamo a fare il calcolo della resa dobbiamo avere a
// disposizione un pulsante che ci permette di salvare il setup configurato... in questo modo
// applica tutta la configurazione alla strategia di entrata automatica nella finestra apposita
// delle aperture automatiche inerenti a quella sala. Quindi se andiamo ad aprire la strategia
// singola di quella sala ci ritroviamo il setup scelto precedentemente sulla cronologia».
//
// Senza, il setup andava ricopiato a mano nella finestra dell'apertura automatica — e una copia a
// mano prima o poi diverge da quella che si e' provata.
//
// Come si prova che il test serve: senza salvaStrategiaNellaSala il primo test va rosso con
// "not a function".
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Una sala analizzata su EURUSD con tre target, e il pannello della resa gia' a schermo.
const PREPARA = () => {
  const t0 = Date.now() - 100 * 60000;
  const ris = [];
  for (let i = 0; i < 6; i++) ris.push({
    ts: t0 + i * 60000, tFill: t0 + i * 60000 + 1000, tFine: t0 + (i + 10) * 60000,
    dir: 'BUY', entry: 100, sl: 99, tps: [101, 102, 103], raggiunti: (i % 4), esito: 'TP', valutato: true
  });
  localStorage.setItem('fbl_crono_ris:Sala X|EURUSD', JSON.stringify(ris));
  const sel = document.getElementById('fblCronoSala');
  const o = document.createElement('option'); o.value = 'Sala X'; o.textContent = 'Sala X';
  sel.appendChild(o); sel.value = 'Sala X';
  window.fblCronoVista({sala: 'Sala X', asset: 'EURUSD', mostra: true});
  document.getElementById('fblRendRischio').value = '2.5';
  window.fblRendCalcola();                       // disegna i comandi della strategia
  window.appConfirm = async () => true; appConfirm = window.appConfirm;
};

test('il setup finisce nella strategia dell\'apertura automatica di quella sala', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      // Si sceglie un setup riconoscibile: chiusura parziale, stop a pareggio al TP1 e al TP2.
      document.getElementById('fblStratModo').value = 'parziali';
      document.getElementById('fblStratR0').value = '';
      document.getElementById('fblStratR1').value = 'entrata';
      document.getElementById('fblStratR2').value = '1';
      await window.fblCronoSalvaStrategia();
      const cfg = tgAutoDi('fx').sale['Sala X'];
      return {cfg: cfg ? {rischio: cfg.rischio, modo: cfg.modo, regole: cfg.regole.slice(0, 3)} : null,
              cripto: !!(tgAutoDi('cr').sale && tgAutoDi('cr').sale['Sala X'])};
    }, PREPARA.toString());
    assert.ok(r.cfg, 'la sala deve avere una strategia nell\'apertura automatica');
    assert.equal(r.cfg.rischio, 2.5, 'il rischio per segnale e\' quello scritto nella resa');
    assert.equal(r.cfg.modo, 'parziali', 'la metodologia e\' quella scelta');
    assert.deepEqual(r.cfg.regole, ['', 'entrata', '1'], 'gli spostamenti dello stop sono quelli scelti');
    assert.equal(r.cripto, false,
      'EURUSD e\' Forex: la strategia CRIPTO di quella sala non si tocca, puo\' essere diversa apposta');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza un\'analisi a schermo non si salva niente, e lo dice', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      window.appConfirm = async () => true; appConfirm = window.appConfirm;
      window.fblCronoVista({sala: '', asset: null});
      await window.fblCronoSalvaStrategia();
      return {stato: document.getElementById('fblCronoStato').textContent,
              sale: Object.keys(tgAutoDi('fx').sale || {}).length};
    });
    assert.match(r.stato, /analizza/i, 'deve dire cosa manca invece di non fare niente in silenzio');
    assert.equal(r.sale, 0, 'non deve inventare una strategia dal nulla');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
