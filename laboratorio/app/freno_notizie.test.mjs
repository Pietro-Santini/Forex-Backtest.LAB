// Freno notizie Forex Factory per l'APERTURA AUTOMATICA delle sale segnali (Telegram + utenti
// Syntra). Copre le richieste del 13 ottobre 2026:
//  - per OGNI gravità (alta/media/bassa) si sceglie se quella notizia sospende o no l'apertura;
//  - si sceglie per QUALI paesi/valute, con il pulsante "Tutti i paesi" che è un ON/OFF;
//  - i minuti di sospensione PRIMA e DOPO la notizia sono due valori separati (prima ce n'era uno);
//  - il freno vale per TUTTE le sale (il gate è in tgAutoValuta, prima dei rami per conto);
//  - il vecchio campo unico "newsMin" continua a valere per le configurazioni già salvate.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {apriApp} from './aiuti.mjs';

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');

test('freno notizie v143: gravità, paesi ON/OFF, minuti prima/dopo separati e migrazione', async () => {
  // 1) presenze statiche: markup, default e gate.
  for (const id of ['tgAutoNewsAttiva','tgAutoNewsMinPre','tgAutoNewsMinPost','tgAutoNewsHigh','tgAutoNewsMedium','tgAutoNewsLow','tgAutoNewsPaesi'])
    assert.ok(APP.includes('id="' + id + '"'), 'manca #' + id);
  assert.ok(APP.includes('id="tgAutoNewsPaesiTutte"'), 'manca il pulsante ON/OFF dei paesi');
  assert.ok(APP.includes('newsAttiva:false,newsMinPre:15,newsMinPost:15,newsSeverita:{High:true,Medium:false},newsPaesi:null'),
    'default: spento, 15 minuti prima e 15 dopo, solo notizie alte, tutti i paesi');
  assert.ok(APP.includes('if(dt<=minPre&&-dt<=minPost){'), 'la finestra separa i minuti prima dai minuti dopo');
  assert.ok(APP.includes('function tgAutoNewsTuttiSelezionati()'), 'manca il calcolo tutti/nessuno dei paesi');
  assert.ok(APP.includes('freno notizie <b>acceso</b>'), 'il riepilogo mostra il freno notizie');
  assert.ok(APP.includes("voce.autoMotivo='sospesa dal freno notizie: "), 'il segnale sospeso resta col motivo');
  const iValuta = APP.indexOf('async function tgAutoValuta(');
  const iGate = APP.indexOf('if(A.attivo&&A.newsAttiva){', iValuta);
  const iKraken = APP.indexOf("if(conto==='kraken'){", iValuta);
  const iCapital = APP.indexOf("if(conto==='capital'){", iValuta);
  assert.ok(iValuta > 0 && iGate > iValuta, 'il gate del freno deve stare dentro tgAutoValuta');
  assert.ok(iGate < iKraken && iGate < iCapital,
    'il freno è controllato PRIMA dei rami per conto: vale per tutte le sale (Telegram e Syntra)');

  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const out = {};
      const ora = Date.now();
      const ev = (impact, country, off) => ({impact, country, date:new Date(ora + off*60000).toISOString(), title:impact+' '+country});
      const vic = (o) => tgAutoNotiziaRossaVicina(Object.assign({newsSeverita:{High:true}, newsPaesi:null}, o));

      // 2) minuti PRIMA e DOPO separati.
      newsEvents = [ev('High','US',+5)];                              // fra 5 minuti
      out.primaLargo = !!vic({newsMinPre:10, newsMinPost:0});         // true
      out.primaStretto = vic({newsMinPre:3, newsMinPost:0});          // null
      out.zeroPreInFuturo = vic({newsMinPre:0, newsMinPost:0});       // null: 0 non deve diventare 15
      newsEvents = [ev('High','US',-5)];                              // 5 minuti fa
      out.dopoLargo = !!vic({newsMinPre:0, newsMinPost:10});          // true
      out.dopoStretto = vic({newsMinPre:0, newsMinPost:3});           // null
      out.entrambiZero = vic({newsMinPre:0, newsMinPost:0});          // null

      // 3) gravità: ognuna decide da sé, sull'evento della SUA gravità.
      newsEvents = [ev('High','US',-5)];
      out.gAlta = !!vic({newsMinPre:0, newsMinPost:15, newsSeverita:{High:true}});
      newsEvents = [ev('Medium','US',-5)];
      out.gMedia = !!vic({newsMinPre:0, newsMinPost:15, newsSeverita:{High:false,Medium:true}});
      out.gMediaSpenta = vic({newsMinPre:0, newsMinPost:15, newsSeverita:{High:true,Medium:false}});
      newsEvents = [ev('Low','US',-5)];
      out.gBassa = !!vic({newsMinPre:0, newsMinPost:15, newsSeverita:{High:false,Low:true}});
      out.gNessuna = vic({newsMinPre:0, newsMinPost:15, newsSeverita:{High:false,Medium:false,Low:false}});

      // 4) paesi: pulsante ON/OFF (tutti -> nessuno -> tutti).
      newsEvents = [ev('High','US',-5), ev('High','GB',-5)];
      tgAuto.newsPaesi = null; tgAutoNewsPaesiRender();
      out.listaPaesi = newsCountriesForAuto();
      $('tgAutoNewsPaesiTutte').click();
      out.dopoPrimoClic = JSON.parse(JSON.stringify(tgAuto.newsPaesi));
      out.etichettaDopoPrimoClic = $('tgAutoNewsPaesiTutte').textContent;
      $('tgAutoNewsPaesiTutte').click();
      out.dopoSecondoClic = tgAuto.newsPaesi;
      out.etichettaDopoSecondoClic = $('tgAutoNewsPaesiTutte').textContent;
      // Con "nessun paese" spuntato nessuna notizia sospende.
      out.nessunPaeseNonSospende = tgAutoNotiziaRossaVicina({newsMinPre:0, newsMinPost:15, newsSeverita:{High:true}, newsPaesi:{US:false, GB:false}});

      // 5) migrazione dal vecchio campo unico.
      const m1 = tgAutoDaSalvato({newsMin:30});
      out.migVecchio = {pre:m1.newsMinPre, post:m1.newsMinPost};
      const m2 = tgAutoDaSalvato({newsMinPre:5, newsMinPost:45});
      out.migNuovo = {pre:m2.newsMinPre, post:m2.newsMinPost};
      const def = tgAutoVuoto();
      out.def = {pre:def.newsMinPre, post:def.newsMinPost};

      newsEvents = [];
      return out;
    });

    assert.equal(r.primaLargo, true, 'una notizia fra 5 minuti sospende col "prima" a 10');
    assert.equal(r.primaStretto, null, 'una notizia fra 5 minuti NON sospende col "prima" a 3');
    assert.equal(r.zeroPreInFuturo, null, '"prima" a 0 non sospende una notizia futura (0 non diventa il default)');
    assert.equal(r.dopoLargo, true, 'una notizia di 5 minuti fa sospende col "dopo" a 10');
    assert.equal(r.dopoStretto, null, 'una notizia di 5 minuti fa NON sospende col "dopo" a 3');
    assert.equal(r.entrambiZero, null, 'con entrambi a 0 la finestra è vuota');
    assert.equal(r.gAlta, true, 'l\'Alta sospende quando è spuntata');
    assert.equal(r.gMedia, true, 'la Media sospende quando è spuntata');
    assert.equal(r.gMediaSpenta, null, 'una notizia Media non sospende se è spuntata solo l\'Alta');
    assert.equal(r.gBassa, true, 'la Bassa sospende quando è spuntata');
    assert.equal(r.gNessuna, null, 'senza nessuna gravità spuntata non sospende mai');
    assert.deepEqual(r.listaPaesi, ['GB','US'], 'i paesi arrivano dagli eventi del feed');
    assert.deepEqual(r.dopoPrimoClic, {GB:false, US:false}, 'primo clic: toglie la spunta a tutti i paesi');
    assert.equal(r.dopoSecondoClic, null, 'secondo clic: riseleziona tutti i paesi');
    assert.ok(/Seleziona tutti/i.test(r.etichettaDopoPrimoClic), 'l\'etichetta invita a riselezionare tutti: ' + r.etichettaDopoPrimoClic);
    assert.ok(/Deseleziona tutti/i.test(r.etichettaDopoSecondoClic), 'l\'etichetta invita a deselezionare tutti: ' + r.etichettaDopoSecondoClic);
    assert.equal(r.nessunPaeseNonSospende, null, 'con nessun paese spuntato nessuna notizia sospende');
    assert.deepEqual(r.migVecchio, {pre:30, post:30}, 'il vecchio newsMin diventa 30 minuti prima e 30 dopo');
    assert.deepEqual(r.migNuovo, {pre:5, post:45}, 'i nuovi campi non vengono sovrascritti dalla migrazione');
    assert.deepEqual(r.def, {pre:15, post:15}, 'i default sono 15 minuti prima e 15 dopo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
