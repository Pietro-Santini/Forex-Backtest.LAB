// UN CONTO NON E' UN NUMERO: E' login@server. E NEL PERCORSO AUTOMATICO DEVE ESSERE QUELLO.
//
// TROVATO con un audit del 17 novembre 2026, non da una segnalazione. La protezione sui conti
// reali e' scritta bene e usa la chiave intera (`tgAutoContoDaTrattareComeReale(login,server)`,
// `mt5AccountKey` = login+'@'+server). Ma il percorso che decide DOVE si apre confronta solo il
// numero, in due punti di `tgAutoApriSuiConti`:
//
//   const collegatoAbilitato=!!(loginPartenza&&bersagli.some(a=>String(a.login)===loginPartenza));
//   ...
//   if(String(acc.login)!==String(tgAutoContoCollegatoLogin()||'')){ ...cambio conto... }
//
// Quindi con lo STESSO numero su due server:
//   - collegato a 111@Broker-Live (REALE, NON spuntato)
//   - in elenco c'e' 111@Broker-Demo (demo, spuntato)
// l'app conclude «il conto collegato e' fra quelli scelti» (i numeri combaciano), SALTA il cambio
// conto (i numeri combaciano) e apre sulla sessione corrente: cioe' sul conto REALE, con la
// configurazione ACCESA del conto demo. La guardia sui conti reali non scatta perche' guarda
// `acc` (il demo, legittimamente spuntato), non il conto su cui si stava davvero per aprire.
//
// NON E' UN CASO DI SCUOLA: `fblMigraChiaviConto` esiste proprio perche' la stringa del server
// dello STESSO conto oscilla (quella digitata a mano contro quella che riporta MT5), quindi lo
// stesso conto fisico puo' stare in `mt5SavedAccounts` con due chiavi, una marcata demo e una
// marcata reale.
//
// PERCHE' NESSUN BANCO LO VEDEVA: `conti_reali_auto.test.mjs` registra le aperture con
// `String(mt5ContoAttivo.login)` - solo il numero. Misura con la stessa lente che causa il
// difetto, e i suoi conti hanno sempre numeri diversi (111/222). Qui si registra la CHIAVE
// INTERA: e' l'unica misura che puo' distinguere i due conti.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Due conti con lo STESSO numero su due server: uno reale non spuntato (quello collegato), uno
// demo spuntato. E' la configurazione che oggi apre sul conto sbagliato.
const PREPARA_STESSO_NUMERO = () => {
  mt5SavedAccounts = [
    {login:'111', server:'Broker-Live', password:'x'},
    {login:'111', server:'Broker-Demo', password:'y'}
  ];
  tgAutoConti = {conti:{'111@Broker-Demo':true}, cambiaConto:true, tuttiIConti:false, tornaIndietro:false};
  mt5ContoAttivo = {login:'111', server:'Broker-Live'};
  mt5Connected = true;
  mt5ContoRealePerChiave = {'111@Broker-Live': true, '111@Broker-Demo': false};
  try{ mt5ContoRealeSalva(); }catch(e){}
  consensoValido = () => true;
  fblRemoto = () => false;
  fblEMobile = () => false;
  tgAutoDecidi = () => ({apri:true});
  tgAssetPerStrumento = async () => null;
};

// Registra la CHIAVE INTERA del conto su cui si sta davvero aprendo, non il solo numero.
const GIRA = async () => {
  const voce = {segnale:{strumento:'XAUUSD', direzione:'BUY', entrata:4000, stop_loss:3990, take_profit:[4010]}};
  const aperture = [], cambi = [];
  window.tgAutoVaiAlConto = async (acc) => {
    cambi.push(String(acc.login)+'@'+String(acc.server||''));
    mt5ContoAttivo = {login:String(acc.login), server:acc.server};
    return {ok:true};
  };
  window.tgAutoApriQui = async () => {
    aperture.push(String(mt5ContoAttivo.login)+'@'+String(mt5ContoAttivo.server||''));
    return true;
  };
  const ok = await tgAutoApriSuiConti(voce, {sala:'Sala X', rischio:1, spazio:3, cfg:{maxPosizioni:6}, A:{maxGlobali:40}}, voce.segnale, 'mt5');
  return {ok, aperture, cambi, motivo: voce.autoMotivo || ''};
};

test('stesso numero su due server: NON si apre sul conto reale non spuntato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA_STESSO_NUMERO);
    const r = await pagina.evaluate(GIRA);
    // Questa e' la misura che conta: nessuna apertura sul conto REALE.
    assert.ok(!r.aperture.includes('111@Broker-Live'),
      'APERTO SUL CONTO REALE non spuntato. Aperture: ' + JSON.stringify(r.aperture));
    // E se si apre, si apre sul conto demo spuntato, dopo un cambio conto VERO.
    if(r.aperture.length){
      assert.deepEqual(r.aperture, ['111@Broker-Demo'],
        'si deve aprire solo sul conto spuntato: ' + JSON.stringify(r.aperture));
      assert.ok(r.cambi.includes('111@Broker-Demo'),
        'il cambio conto non puo' + "'" + ' essere saltato solo perche' + "'" + ' i numeri combaciano: ' + JSON.stringify(r.cambi));
    }
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il cambio conto si decide sulla chiave intera, non sul numero', async () => {
  // Misura diretta del secondo punto bucato: con il numero uguale e il server diverso, il
  // cambio conto DEVE avvenire. Saltarlo e' quello che fa aprire sulla sessione sbagliata.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA_STESSO_NUMERO);
    const r = await pagina.evaluate(GIRA);
    assert.ok(r.cambi.length >= 1,
      'nessun cambio conto: con 111@Broker-Live collegato e 111@Broker-Demo come bersaglio, ' +
      'il cambio e' + "'" + ' obbligatorio. Cambi: ' + JSON.stringify(r.cambi));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('non si apre mai su un conto diverso da quello deciso (la guardia finale)', async () => {
  // IL PUNTO UNICO. Qualunque sia il motivo per cui la sessione non e' quella prevista - i
  // numeri che combaciano, un cambio conto che dice ok ma atterra altrove, una risposta di
  // /account in ritardo che riporta l'app sul conto di prima - prima di aprire si guarda DOVE
  // SI E'. Se non e' il conto deciso, non si apre.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(() => {
      mt5SavedAccounts = [
        {login:'111', server:'Broker-Live', password:'x'},
        {login:'222', server:'Broker-Demo', password:'y'}
      ];
      tgAutoConti = {conti:{'222@Broker-Demo':true}, cambiaConto:true, tuttiIConti:false, tornaIndietro:false};
      mt5ContoAttivo = {login:'111', server:'Broker-Live'};
      mt5Connected = true;
      mt5ContoRealePerChiave = {'111@Broker-Live': true, '222@Broker-Demo': false};
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
      // IL CAMBIO CONTO MENTE: dice ok ma la sessione resta sul conto reale. E' il caso che
      // nessuno controlla oggi, e nella realta' si presenta come la corsa fra la risposta di
      // /account e il cambio conto.
      window.tgAutoVaiAlConto = async () => ({ok:true});
      window.tgAutoApriQui = async () => {
        aperture.push(String(mt5ContoAttivo.login)+'@'+String(mt5ContoAttivo.server||''));
        return true;
      };
      const ok = await tgAutoApriSuiConti(voce, {sala:'Sala X', rischio:1, spazio:3, cfg:{maxPosizioni:6}, A:{maxGlobali:40}}, voce.segnale, 'mt5');
      return {ok, aperture, motivo: voce.autoMotivo || ''};
    });
    assert.deepEqual(r.aperture, [],
      'il cambio conto non e' + "'" + ' avvenuto davvero: non si deve aprire niente. Aperture: ' + JSON.stringify(r.aperture));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// --- PROVE DI CONTROLLO: il caso normale non cambia di una virgola -----------------------------

test('CONTROLLO numeri diversi: si apre sul conto spuntato, come adesso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(() => {
      mt5SavedAccounts = [
        {login:'111', server:'Demo-A', password:'x'},
        {login:'222', server:'Demo-B', password:'y'}
      ];
      tgAutoConti = {conti:{'222@Demo-B':true}, cambiaConto:true, tuttiIConti:false, tornaIndietro:false};
      mt5ContoAttivo = {login:'111', server:'Demo-A'};
      mt5Connected = true;
      mt5ContoRealePerChiave = {'111@Demo-A': false, '222@Demo-B': false};
      try{ mt5ContoRealeSalva(); }catch(e){}
      consensoValido = () => true;
      fblRemoto = () => false;
      fblEMobile = () => false;
      tgAutoDecidi = () => ({apri:true});
      tgAssetPerStrumento = async () => null;
    });
    const r = await pagina.evaluate(GIRA);
    assert.deepEqual(r.aperture, ['222@Demo-B'], 'nessuna regressione sul caso di tutti i giorni');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO conto collegato GIA\' quello giusto: nessun cambio conto inutile', async () => {
  // La ragione per cui il confronto esiste: se si e' gia' sul conto bersaglio non si deve
  // rifare il collegamento, perche' per tentare un accesso nuovo il ponte CHIUDE quello che
  // c'e' (vedi il commento di tgAutoVaiAlConto: e' costato un terminale piantato).
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(() => {
      mt5SavedAccounts = [{login:'222', server:'Demo-B', password:'y'}];
      tgAutoConti = {conti:{'222@Demo-B':true}, cambiaConto:true, tuttiIConti:false, tornaIndietro:false};
      mt5ContoAttivo = {login:'222', server:'Demo-B'};
      mt5Connected = true;
      mt5ContoRealePerChiave = {'222@Demo-B': false};
      try{ mt5ContoRealeSalva(); }catch(e){}
      consensoValido = () => true;
      fblRemoto = () => false;
      fblEMobile = () => false;
      tgAutoDecidi = () => ({apri:true});
      tgAssetPerStrumento = async () => null;
    });
    const r = await pagina.evaluate(GIRA);
    assert.deepEqual(r.aperture, ['222@Demo-B']);
    assert.deepEqual(r.cambi, [], 'nessun cambio conto: si era gia' + "'" + ' sul conto giusto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
