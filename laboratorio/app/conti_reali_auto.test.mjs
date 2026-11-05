// RILASCIO A — sicurezza sui conti reali: se il conto collegato e' REALE (o prop, o
// sconosciuto) e NON e' spuntato nella configurazione delle aperture automatiche, non si
// apre niente e il segnale resta nel pannello col motivo. Sui conti demo tutto come prima.
//
// La regola del dubbio: reale === null («non lo so») si tratta come reale. Mai come false.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const PREPARA_REALE = () => {
  mt5SavedAccounts = [{login:'111', server:'Demo-A', password:'x'}];
  tgAutoConti = {conti:{}, cambiaConto:false, tuttiIConti:false, tornaIndietro:false};
  mt5ContoAttivo = {login:'111', server:'Demo-A'};
  mt5Connected = true;
  // il ponte ha detto che e' reale
  mt5ContoRealePerChiave = {'111@Demo-A': true};
  try{ mt5ContoRealeSalva(); }catch(e){}
  consensoValido = () => true;
  fblRemoto = () => false;
  fblEMobile = () => false;
  tgAutoDecidi = () => ({apri:true});
  tgAssetPerStrumento = async () => null;
};

const PREPARA_DEMO = () => {
  mt5SavedAccounts = [{login:'111', server:'Demo-A', password:'x'}];
  tgAutoConti = {conti:{}, cambiaConto:false, tuttiIConti:false, tornaIndietro:false};
  mt5ContoAttivo = {login:'111', server:'Demo-A'};
  mt5Connected = true;
  mt5ContoRealePerChiave = {'111@Demo-A': false};
  try{ mt5ContoRealeSalva(); }catch(e){}
  consensoValido = () => true;
  fblRemoto = () => false;
  fblEMobile = () => false;
  tgAutoDecidi = () => ({apri:true});
  tgAssetPerStrumento = async () => null;
};

const FINTO = () => ({segnale:{strumento:'XAUUSD', direzione:'BUY', entrata:4000, stop_loss:3990, take_profit:[4010]}});

test('conto REALE non spuntato, collegati a quello: non apre niente, e autoMotivo contiene il motivo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA_REALE);
    const r = await pagina.evaluate(async () => {
      const voce = {segnale:{strumento:'XAUUSD', direzione:'BUY', entrata:4000, stop_loss:3990, take_profit:[4010]}};
      let aperture = 0;
      window.tgAutoApriQui = async () => { aperture++; return true; };
      await tgAutoValuta(voce, 'mt5');
      return {motivo: voce.autoMotivo || '', aperture};
    });
    assert.equal(r.aperture, 0, 'non deve aprire niente su un conto reale non spuntato');
    assert.match(r.motivo, /aperture automatiche non sono attive/i);
    assert.match(r.motivo, /111/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('conto DEMO con lista vuota: apre come adesso (nessuna regressione)', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA_DEMO);
    const r = await pagina.evaluate(async () => {
      const voce = {segnale:{strumento:'XAUUSD', direzione:'BUY', entrata:4000, stop_loss:3990, take_profit:[4010]}};
      let aperture = 0;
      window.tgAutoApriQui = async () => { aperture++; return true; };
      await tgAutoValuta(voce, 'mt5');
      return {motivo: voce.autoMotivo, aperture};
    });
    assert.equal(r.aperture, 1, 'su un conto demo con lista vuota deve aprire come prima');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('reale === null («non lo so»): si comporta come reale, non apre', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(() => {
      mt5SavedAccounts = [{login:'111', server:'Demo-A', password:'x'}];
      tgAutoConti = {conti:{}, cambiaConto:false, tuttiIConti:false, tornaIndietro:false};
      mt5ContoAttivo = {login:'111', server:'Demo-A'};
      mt5Connected = true;
      mt5ContoRealePerChiave = {'111@Demo-A': null};
      try{ mt5ContoRealeSalva(); }catch(e){}
      consensoValido = () => true;
      fblRemoto = () => false;
      fblEMobile = () => false;
      tgAutoDecidi = () => ({apri:true});
      tgAssetPerStrumento = async () => null;
    });
    const r = await pagina.evaluate(async () => {
      const voce = {segnale:{strumento:'XAUUSD', direzione:'BUY', entrata:4000, stop_loss:3990, take_profit:[4010]}};
      let aperture = 0;
      window.tgAutoApriQui = async () => { aperture++; return true; };
      await tgAutoValuta(voce, 'mt5');
      return {motivo: voce.autoMotivo || '', aperture};
    });
    assert.equal(r.aperture, 0, 'con reale sconosciuto non deve aprire');
    assert.match(r.motivo, /aperture automatiche non sono attive/i);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('«su tutti i conti» salta il conto reale non spuntato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(() => {
      mt5SavedAccounts = [
        {login:'111', server:'Demo-A', password:'x'},
        {login:'222', server:'Demo-B', password:'y'}
      ];
      tgAutoConti = {conti:{'222@Demo-B':true}, cambiaConto:true, tuttiIConti:true, tornaIndietro:false};
      mt5ContoAttivo = {login:'111', server:'Demo-A'};
      mt5Connected = true;
      // 111 reale non spuntato, 222 demo spuntato
      mt5ContoRealePerChiave = {'111@Demo-A': true, '222@Demo-B': false};
      try{ mt5ContoRealeSalva(); }catch(e){}
      consensoValido = () => true;
      fblRemoto = () => false;
      fblEMobile = () => false;
      tgAutoDecidi = () => ({apri:true});
      tgAssetPerStrumento = async () => null;
    });
    const r = await pagina.evaluate(async () => {
      const voce = {segnale:{strumento:'XAUUSD', direzione:'BUY', entrata:4000, stop_loss:3990, take_profit:[4010]}};
      const aperture = [];
      window.tgAutoVaiAlConto = async (acc) => { mt5ContoAttivo = {login:String(acc.login), server:acc.server}; return {ok:true}; };
      window.tgAutoApriQui = async () => { aperture.push(String(mt5ContoAttivo.login)); return true; };
      const ok = await tgAutoApriSuiConti(voce, {sala:'Sala X', rischio:1, spazio:3, cfg:{maxPosizioni:6}, A:{maxGlobali:40}}, voce.segnale, 'mt5');
      return {ok, aperture};
    });
    assert.deepEqual(r.aperture, ['222'], 'il conto reale non spuntato (111) deve essere saltato');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});