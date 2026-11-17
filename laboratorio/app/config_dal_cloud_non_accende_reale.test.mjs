// LA CONFIGURAZIONE CHE ARRIVA DAL CLOUD NON PUO' ACCENDERE L'APERTURA AUTOMATICA SU UN CONTO
// REALE. Mai. Solo una conferma esplicita, data su QUESTO dispositivo, può farlo.
//
// TROVATO con l'audit del 17 novembre 2026 (voce 1.2 della scaletta). Spuntare a mano un conto
// reale chiede una conferma apposta (`window.confirm`, con il rollback della spunta se rispondi
// no): è la barriera che protegge i soldi. Ma le due chiavi che tengono quella decisione —
// `fb_tg_auto_conti` e `fb_tg_auto_per_conto` — arrivano anche dalla sincronizzazione fra
// dispositivi, e là vengono **sostituite in blocco**:
//
//     fb_tg_auto_conti:v=>{ ... tgAutoConti=tgAutoContiDaSalvato(o) ... }
//     fb_tg_auto_per_conto:v=>{ ... tgAutoPerConto=o; tgAutoPerContoSalva(); ... }
//
// Nessun filtro sui conti reali, nessuna conferma, e nessuna regola «spento vince» — che invece
// `fblMigraChiaviConto` applica già quando sposta le stesse chiavi fra due nomi dello stesso
// conto, con un commento che dice «non negoziabile». Quindi un documento vecchio, o scritto da un
// altro dispositivo, può accendere l'automatico su un conto reale e spuntarlo nell'elenco. E la
// spunta, da sola, è l'unica autorizzazione che il percorso di apertura pretende.
//
// LA REGOLA, ed è la stessa già scritta nel progetto: su un conto reale il cloud può **spegnere**
// ma non **accendere**. «Non lo so» vale fermo, non fai pure — quindi un conto di cui l'app non
// sa ancora se è demo vale come reale, come stabilisce `tgAutoContoDaTrattareComeReale`.
//
// CONSEGUENZA VOLUTA, da sapere: se spunti un conto reale sul tablet, sul PC NON si spunta da
// solo — la conferma va data anche lì. È il prezzo scelto, ed è il verso giusto in cui sbagliare.
//
// ATTENZIONE AL PUNTO IN CUI SI CURA: `graficoApplica` scrive in `localStorage` il valore grezzo
// appena arrivato E POI chiama chi lo interpreta. Ripulire solo l'oggetto in memoria non basta:
// alla ricarica si rileggerebbe il valore non ripulito. Per questo il banco controlla anche
// `localStorage`, non solo la variabile.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// 111@Broker-Live è REALE (lo ha detto il ponte), 222@Demo-B è demo.
const PREPARA = () => {
  mt5SavedAccounts = [
    {login:'111', server:'Broker-Live', password:'x'},
    {login:'222', server:'Demo-B', password:'y'}
  ];
  mt5ContoRealePerChiave = {'111@Broker-Live': true, '222@Demo-B': false};
  try{ mt5ContoRealeSalva(); }catch(e){}
  tgAutoConti = {conti:{}, cambiaConto:false, tuttiIConti:false, tornaIndietro:false};
  tgAutoPerConto = {};
  try{ tgAutoPerContoSalva(); }catch(e){}
  try{ localStorage.setItem('fb_tg_auto_conti', JSON.stringify(tgAutoConti)); }catch(e){}
};

test('dal cloud arriva un blocco ACCESO su un conto REALE: resta spento', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA);
    const r = await pagina.evaluate(() => {
      const inArrivo = {
        '111@Broker-Live': {fx:{attivo:true, maxGlobali:5, sale:{'Sala A':{attivo:true, rischio:2}}}},
        '222@Demo-B':      {fx:{attivo:true, maxGlobali:5, sale:{'Sala A':{attivo:true, rischio:2}}}}
      };
      graficoApplica('ls|fb_tg_auto_per_conto', JSON.stringify(inArrivo));
      let salvato = null;
      try{ salvato = JSON.parse(localStorage.getItem('fb_tg_auto_per_conto')||'null'); }catch(e){}
      return {
        realeInMemoria: !!(tgAutoPerConto['111@Broker-Live'] && tgAutoPerConto['111@Broker-Live'].fx.attivo),
        realeSuDisco:   !!(salvato && salvato['111@Broker-Live'] && salvato['111@Broker-Live'].fx.attivo),
        demoInMemoria:  !!(tgAutoPerConto['222@Demo-B'] && tgAutoPerConto['222@Demo-B'].fx.attivo),
        rischioReale:   (tgAutoPerConto['111@Broker-Live']||{fx:{}}).fx.maxGlobali
      };
    });
    assert.equal(r.realeInMemoria, false, 'il cloud ha ACCESO l\'automatico su un conto reale');
    assert.equal(r.realeSuDisco, false, 'acceso in localStorage: alla ricarica tornerebbe su');
    // Il resto della configurazione arriva: si spegne l'interruttore, non si butta il blocco.
    assert.equal(r.rischioReale, 5, 'la configurazione deve arrivare, è l\'interruttore che resta spento');
    // Prova di controllo dentro la stessa misura: sul demo l'interruttore passa.
    assert.equal(r.demoInMemoria, true, 'su un conto demo il cloud deve funzionare come prima');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('dal cloud arriva una SPUNTA su un conto REALE non spuntato qui: non si spunta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA);
    const r = await pagina.evaluate(() => {
      const inArrivo = {conti:{'111@Broker-Live':true, '222@Demo-B':true}, cambiaConto:true, tuttiIConti:true, tornaIndietro:false};
      graficoApplica('ls|fb_tg_auto_conti', JSON.stringify(inArrivo));
      let salvato = null;
      try{ salvato = JSON.parse(localStorage.getItem('fb_tg_auto_conti')||'null'); }catch(e){}
      return {
        realeSpuntato: !!(tgAutoConti.conti && tgAutoConti.conti['111@Broker-Live']),
        realeSuDisco:  !!(salvato && salvato.conti && salvato.conti['111@Broker-Live']),
        demoSpuntato:  !!(tgAutoConti.conti && tgAutoConti.conti['222@Demo-B']),
        cambiaConto:   !!tgAutoConti.cambiaConto
      };
    });
    assert.equal(r.realeSpuntato, false, 'il cloud ha spuntato un conto REALE senza nessuna conferma');
    assert.equal(r.realeSuDisco, false, 'spuntato in localStorage: alla ricarica tornerebbe su');
    assert.equal(r.demoSpuntato, true, 'il conto demo si spunta come prima');
    assert.equal(r.cambiaConto, true, 'il resto delle impostazioni arriva normalmente');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un conto di cui non si sa niente vale come reale: il cloud non lo accende', async () => {
  // La regola del dubbio, già in uso in tutto il percorso dei soldi: `sconosciuto => reale`.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(() => {
      mt5SavedAccounts = [{login:'999', server:'Chi-Sa', password:'z'}];
      mt5ContoRealePerChiave = {};              // il ponte non ha mai detto niente su 999
      try{ mt5ContoRealeSalva(); }catch(e){}
      tgAutoConti = {conti:{}, cambiaConto:false, tuttiIConti:false, tornaIndietro:false};
      tgAutoPerConto = {};
      try{ tgAutoPerContoSalva(); }catch(e){}
    });
    const r = await pagina.evaluate(() => {
      graficoApplica('ls|fb_tg_auto_conti', JSON.stringify({conti:{'999@Chi-Sa':true}, cambiaConto:false, tuttiIConti:false, tornaIndietro:false}));
      graficoApplica('ls|fb_tg_auto_per_conto', JSON.stringify({'999@Chi-Sa':{fx:{attivo:true, sale:{}}}}));
      return {
        spuntato: !!(tgAutoConti.conti && tgAutoConti.conti['999@Chi-Sa']),
        acceso: !!((tgAutoPerConto['999@Chi-Sa']||{fx:{}}).fx.attivo)
      };
    });
    assert.equal(r.spuntato, false, '«non lo so» vale fermo, non fai pure');
    assert.equal(r.acceso, false, '«non lo so» vale fermo anche per l\'interruttore');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il cloud PUO\' spegnere un conto reale: spento vince in entrambi i versi', async () => {
  // La regola non è «il cloud non tocca i conti reali»: è «sul reale il cloud può solo
  // spegnere». Se così non fosse, spegnere l'automatico dal tablet non arriverebbe al PC —
  // e quella è la direzione in cui si DEVE poter agire da lontano.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(() => {
      mt5SavedAccounts = [{login:'111', server:'Broker-Live', password:'x'}];
      mt5ContoRealePerChiave = {'111@Broker-Live': true};
      try{ mt5ContoRealeSalva(); }catch(e){}
      // qui l'utente aveva confermato a mano: spuntato e acceso
      tgAutoConti = {conti:{'111@Broker-Live':true}, cambiaConto:false, tuttiIConti:false, tornaIndietro:false};
      tgAutoPerConto = {'111@Broker-Live':{fx:{attivo:true, sale:{}}}};
      try{ tgAutoPerContoSalva(); }catch(e){}
    });
    const r = await pagina.evaluate(() => {
      graficoApplica('ls|fb_tg_auto_per_conto', JSON.stringify({'111@Broker-Live':{fx:{attivo:false, sale:{}}}}));
      graficoApplica('ls|fb_tg_auto_conti', JSON.stringify({conti:{}, cambiaConto:false, tuttiIConti:false, tornaIndietro:false}));
      return {
        acceso: !!((tgAutoPerConto['111@Broker-Live']||{fx:{}}).fx.attivo),
        spuntato: !!(tgAutoConti.conti && tgAutoConti.conti['111@Broker-Live'])
      };
    });
    assert.equal(r.acceso, false, 'spegnere dal cloud deve funzionare');
    assert.equal(r.spuntato, false, 'togliere la spunta dal cloud deve funzionare');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('CONTROLLO: su conti demo la sincronizzazione resta identica a prima', async () => {
  // Senza questa, una cura che blocca tutto passerebbe le prove di sopra e romperebbe la
  // condivisione fra dispositivi per tutti i conti demo.
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA);
    const r = await pagina.evaluate(() => {
      const perConto = {'222@Demo-B':{fx:{attivo:true, maxGlobali:9, perditaMaxGiorno:3, sale:{'Sala B':{attivo:true, rischio:1.5, maxPosizioni:4}}}}};
      graficoApplica('ls|fb_tg_auto_per_conto', JSON.stringify(perConto));
      graficoApplica('ls|fb_tg_auto_conti', JSON.stringify({conti:{'222@Demo-B':true}, cambiaConto:true, tuttiIConti:true, tornaIndietro:true}));
      const b = tgAutoPerConto['222@Demo-B'].fx;
      return {
        attivo:b.attivo, maxGlobali:b.maxGlobali, perdita:b.perditaMaxGiorno,
        sala:b.sale['Sala B'], spuntato:!!tgAutoConti.conti['222@Demo-B'],
        tutti:!!tgAutoConti.tuttiIConti, torna:!!tgAutoConti.tornaIndietro
      };
    });
    assert.equal(r.attivo, true);
    assert.equal(r.maxGlobali, 9);
    assert.equal(r.perdita, 3);
    assert.deepEqual(r.sala, {attivo:true, rischio:1.5, maxPosizioni:4});
    assert.equal(r.spuntato, true);
    assert.equal(r.tutti, true);
    assert.equal(r.torna, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
