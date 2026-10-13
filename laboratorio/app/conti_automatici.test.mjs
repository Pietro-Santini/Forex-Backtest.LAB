// SU QUALI CONTI MT5 APRONO LE POSIZIONI AUTOMATICHE DELLE SALE SEGNALI.
//
// RICHIESTO dal proprietario: con due conti MT5 salvati si deve poter dire su QUALE (o su quali)
// le sale segnali possono aprire da sole. Chi tiene un conto solo-manuale non vuole che
// l'automatico gli entri anche li'. E tre scelte in piu', perche' fanno fare al programma cose che
// nessuno vede: passare da sola al conto scelto, ripetere l'ordine su tutti i conti scelti, e
// tornare al conto che si stava guardando.
//
// E' il genere di cosa che si rompe in silenzio: un ordine aperto sul conto sbagliato non da'
// nessun errore, da' una posizione dove non doveva essercene.
//
// Come si prova che il test serve: senza la sezione nuova (tgAutoConti e tgAutoApriSuiConti) il
// primo test va rosso con "not a function".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

// Due conti salvati, il primo collegato. `scelti` sono le chiavi login@server abilitate.
const PREPARA = (scelti, opz) => {
  mt5SavedAccounts = [
    {login:'111', server:'Demo-A', password:'x'},
    {login:'222', server:'Demo-B', password:'y'}
  ];
  tgAutoConti = {conti:{}, cambiaConto:false, tuttiIConti:false, tornaIndietro:false};
  (scelti||[]).forEach(k => { tgAutoConti.conti[k] = true; });
  Object.assign(tgAutoConti, opz||{});
  mt5ContoAttivo = {login:'111', server:'Demo-A'};
  mt5Connected = true;
};

// Un segnale e una decisione gia' presa (quello che tgAutoDecidi restituisce), senza toccare nulla
// di vero: qui si prova soltanto l'instradamento fra i conti.
const FINTI = () => {
  const voce = {id:1, chat:'Sala X', segnale:{strumento:'XAUUSD', direzione:'BUY', entrata:4000, stop_loss:3990, take_profit:[4010]}};
  const d = {sala:'Sala X', rischio:1, spazio:3, cfg:{maxPosizioni:6}, A:{maxGlobali:40}};
  return {voce, d};
};

test('senza conti scelti non cambia niente: vale il conto collegato, come sempre', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')([], null);
      return {regola: tgAutoContiRegolaAttiva(), bersagli: tgAutoContiBersaglio().length,
              collegato: tgAutoContoCollegatoLogin()};
    }, PREPARA.toString());
    assert.equal(r.regola, false, 'nessuna spunta = nessuna regola da applicare');
    assert.equal(r.bersagli, 0);
    assert.equal(r.collegato, '111');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('scegliendo UN conto, solo quello riceve le aperture automatiche', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')(['222@Demo-B'], null);
      return {regola: tgAutoContiRegolaAttiva(), bersagli: tgAutoContiBersaglio().map(a=>String(a.login))};
    }, PREPARA.toString());
    assert.equal(r.regola, true);
    assert.deepEqual(r.bersagli, ['222']);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('con entrambi scelti si parte dal conto COLLEGATO: il caso normale non cambia conto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')(['111@Demo-A','222@Demo-B'], null);
      return tgAutoContiBersaglio().map(a=>String(a.login));
    }, PREPARA.toString());
    // Primo quello collegato: aprire li' non richiede nessun cambio di conto.
    assert.deepEqual(r, ['111','222']);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un conto scelto e poi ELIMINATO non decide piu\' niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate((p) => {
      eval('(' + p + ')')(['999@Demo-Z'], null);   // conto che non esiste fra i salvati
      return {regola: tgAutoContiRegolaAttiva(), bersagli: tgAutoContiBersaglio().length};
    }, PREPARA.toString());
    assert.equal(r.regola, false, 'una spunta su un conto che non c\'e\' piu\' non deve fermare tutto');
    assert.equal(r.bersagli, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('sei sul conto sbagliato e il cambio automatico e\' SPENTO: non si apre, e lo dice', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (args) => {
      eval('(' + args.prep + ')')(['222@Demo-B'], {cambiaConto:false});
      const {voce, d} = eval('(' + args.finti + ')')();
      // Se provasse ad aprire davvero, queste due si farebbero sentire: non devono essere chiamate.
      let aperture = 0, cambi = 0;
      window.tgAutoApriQui = async () => { aperture++; return true; };
      window.tgAutoVaiAlConto = async () => { cambi++; return {ok:true}; };
      const ok = await tgAutoApriSuiConti(voce, d, voce.segnale, 'mt5');
      return {ok, motivo: voce.autoMotivo, aperture, cambi, conto: mt5ContoAttivo.login};
    }, {prep: PREPARA.toString(), finti: FINTI.toString()});
    assert.equal(r.ok, false);
    assert.equal(r.aperture, 0, 'non deve aprire niente su un conto non scelto');
    assert.equal(r.cambi, 0, 'col cambio spento non deve cambiare conto');
    assert.equal(r.conto, '111', 'si resta dove si era');
    assert.match(String(r.motivo), /non . fra quelli scelti/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('col cambio automatico ACCESO passa al conto scelto e apre la\'', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (args) => {
      eval('(' + args.prep + ')')(['222@Demo-B'], {cambiaConto:true});
      const {voce, d} = eval('(' + args.finti + ')')();
      const aperture = [];
      window.tgAutoVaiAlConto = async (acc) => { mt5ContoAttivo = {login:String(acc.login), server:acc.server}; return {ok:true}; };
      window.tgAutoApriQui = async (v) => { aperture.push(String(mt5ContoAttivo.login)); v.eseguito = {}; return true; };
      const ok = await tgAutoApriSuiConti(voce, d, voce.segnale, 'mt5');
      return {ok, aperture, conto: String(mt5ContoAttivo.login), motivo: voce.autoMotivo};
    }, {prep: PREPARA.toString(), finti: FINTI.toString()});
    assert.equal(r.ok, true);
    assert.deepEqual(r.aperture, ['222'], 'deve aprire sul conto scelto, non su quello che si guardava');
    assert.equal(r.conto, '222', 'senza "torna indietro" si resta sul conto dove ha aperto');
    assert.equal(r.motivo, null);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('«su tutti i conti scelti»: lo stesso segnale si apre su entrambi, uno dopo l\'altro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (args) => {
      eval('(' + args.prep + ')')(['111@Demo-A','222@Demo-B'], {cambiaConto:true, tuttiIConti:true});
      const {voce, d} = eval('(' + args.finti + ')')();
      const aperture = [];
      window.tgAutoVaiAlConto = async (acc) => { mt5ContoAttivo = {login:String(acc.login), server:acc.server}; return {ok:true}; };
      window.tgAutoApriQui = async (v) => { aperture.push(String(mt5ContoAttivo.login)); v.eseguito = {}; return true; };
      const ok = await tgAutoApriSuiConti(voce, d, voce.segnale, 'mt5');
      return {ok, aperture, conti: (voce.eseguito&&voce.eseguito.conti)||null};
    }, {prep: PREPARA.toString(), finti: FINTI.toString()});
    assert.equal(r.ok, true);
    assert.deepEqual(r.aperture, ['111','222'], 'prima il collegato, poi l\'altro');
    assert.deepEqual(r.conti, ['111','222'], 'il pannello deve poter dire su quali conti e\' finito');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('«torna al conto che stavi guardando»: finito, si torna indietro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (args) => {
      eval('(' + args.prep + ')')(['222@Demo-B'], {cambiaConto:true, tornaIndietro:true});
      const {voce, d} = eval('(' + args.finti + ')')();
      const passaggi = [];
      window.tgAutoVaiAlConto = async (acc) => { passaggi.push(String(acc.login)); mt5ContoAttivo = {login:String(acc.login), server:acc.server}; return {ok:true}; };
      window.tgAutoApriQui = async (v) => { v.eseguito = {}; return true; };
      const ok = await tgAutoApriSuiConti(voce, d, voce.segnale, 'mt5');
      return {ok, passaggi, conto: String(mt5ContoAttivo.login)};
    }, {prep: PREPARA.toString(), finti: FINTI.toString()});
    assert.equal(r.ok, true);
    assert.deepEqual(r.passaggi, ['222','111'], 'va sul conto scelto e poi torna su quello di partenza');
    assert.equal(r.conto, '111');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se il conto scelto non risponde, il segnale resta nel pannello col motivo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (args) => {
      eval('(' + args.prep + ')')(['222@Demo-B'], {cambiaConto:true});
      const {voce, d} = eval('(' + args.finti + ')')();
      let aperture = 0;
      window.tgAutoVaiAlConto = async () => ({ok:false, message:'ponte spento'});
      window.tgAutoApriQui = async () => { aperture++; return true; };
      const ok = await tgAutoApriSuiConti(voce, d, voce.segnale, 'mt5');
      return {ok, aperture, motivo: String(voce.autoMotivo||'')};
    }, {prep: PREPARA.toString(), finti: FINTI.toString()});
    assert.equal(r.ok, false);
    assert.equal(r.aperture, 0, 'senza il cambio di conto riuscito non si apre sul conto sbagliato');
    assert.match(r.motivo, /ponte spento/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// La parte che non si puo' provare con un clic finto: che la scelta sia salvata, condivisa fra i
// dispositivi, e che l'interfaccia ci sia davvero.
test('la scelta dei conti si salva, si condivide e ha i suoi comandi a schermo', () => {
  const src = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  assert.match(src, /const TG_AUTO_CONTI_KEY='fb_tg_auto_conti'/, 'la scelta deve essere salvata in locale');
  assert.match(src, /fb_tg_auto_conti:v=>/, 'la scelta deve viaggiare anche fra i dispositivi (GRAFICO_LS)');
  ['tgAutoConti"', 'tgAutoContiCambia', 'tgAutoContiTutti', 'tgAutoContiTorna'].forEach(id => {
    assert.ok(src.includes('id="' + id.replace(/"$/, '') + '"'), 'manca il comando ' + id + ' nella configurazione');
  });
  // Il cambio di conto passa dalla stessa strada della tendina dei conti: connectToMt5Bridge e'
  // quello che mette da parte le posizioni degli altri conti (mt5AttivaConto).
  assert.match(src, /async function tgAutoVaiAlConto\(acc\)\{[\s\S]{0,600}connectToMt5Bridge\(acc\)/,
    'il passaggio di conto deve usare connectToMt5Bridge, non una scorciatoia');
});
