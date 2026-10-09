// Apertura automatica dei segnali: la fa SOLO il computer (dove stanno MT5 e i conti). Il computer ha
// la precedenza e NON chiede il permesso agli altri dispositivi: se il segnale va aperto in
// automatico, lo apre. Telefono e tablet non aprono da soli: mostrano il segnale, e lo si apre a mano.
//
// Difetto segnalato (9 ottobre 2026): il PC mostrava spesso
// "⚡ aperto automaticamente da un altro dispositivo collegato al tuo account" e NON apriva, perché
// la prenotazione sul cloud ("chi arriva primo") veniva vinta da un altro dispositivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA = () => {
  localStorage.removeItem('fbl_consensi_rischi');
  fetchMt5WithTimeout = async () => ({ok:false, message:'ponte finto spento'});
};

test('sul computer si apre anche se il cloud dice "già preso da un altro dispositivo"', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA);
    const r = await pagina.evaluate(async () => {
      tgAutoDecidi = () => ({apri:true});
      consensoValido = () => true;
      fblRemoto = () => false;    // sono il computer…
      fblEMobile = () => false;   // …e non un telefono o tablet
      tgAssetPerStrumento = async () => null;   // ferma la strada Capital subito dopo la decisione
      let rivendicato = false;
      tgRivendicaSegnale = async () => { rivendicato = true; return false; };  // "un altro l'ha preso"
      const voce = {segnale:{strumento:'AAPL', direzione:'BUY'}};
      await tgAutoValuta(voce, 'capital');
      return {motivo: voce.autoMotivo || '', rivendicato};
    });
    assert.doesNotMatch(r.motivo, /altro dispositivo/i, 'il computer non deve più essere fermato dagli altri dispositivi');
    assert.equal(r.rivendicato, false, 'il computer non chiede più il permesso al cloud');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('su telefono o tablet non apre da solo, e lo dice', async () => {
  const {browser, pagina} = await apriApp();
  try{
    await pagina.evaluate(PREPARA);
    const r = await pagina.evaluate(async () => {
      tgAutoDecidi = () => ({apri:true});
      consensoValido = () => true;
      fblRemoto = () => true;     // dispositivo collegato da fuori
      fblEMobile = () => true;    // telefono o tablet
      tgAssetPerStrumento = async () => null;
      let rivendicato = false;
      tgRivendicaSegnale = async () => { rivendicato = true; return true; };
      const voce = {segnale:{strumento:'AAPL', direzione:'BUY'}};
      await tgAutoValuta(voce, 'capital');
      return {motivo: voce.autoMotivo || '', rivendicato};
    });
    assert.match(r.motivo, /computer/i, 'da telefono/tablet lo dice: ci pensa il computer');
    assert.equal(r.rivendicato, false);
  } finally { await browser.close(); }
});

test('non è "il computer" se manca anche una sola delle due condizioni', async () => {
  const {browser, pagina} = await apriApp();
  try{
    await pagina.evaluate(PREPARA);
    const r = await pagina.evaluate(() => {
      const esiti = {};
      fblRemoto = () => false; fblEMobile = () => false; esiti.computer = tgSonoIlComputer();
      fblRemoto = () => true;  fblEMobile = () => false; esiti.daFuori = tgSonoIlComputer();
      fblRemoto = () => false; fblEMobile = () => true;  esiti.mobile = tgSonoIlComputer();
      return esiti;
    });
    assert.deepEqual(r, {computer:true, daFuori:false, mobile:false});
  } finally { await browser.close(); }
});
