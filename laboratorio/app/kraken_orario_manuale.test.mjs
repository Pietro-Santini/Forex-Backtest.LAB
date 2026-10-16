// L'ORARIO DI UNA POSIZIONE KRAKEN SI PUO' DIRE A MANO QUANDO IL PONTE NON LO MANDA PIU'.
//
// RICHIESTO/approvato dal proprietario: le posizioni aperte PRIMA della v163 non recuperano
// l'orario — l'anagrafica si riempie da quando esiste, e quel dato non ce l'ha piu' nessuno. In
// tabella restano a «—» e a grafico finiscono ancorate a un ripiego. La correzione a mano per
// singola posizione e' la risposta: la cella «Eseguita» si clicca e si dice quando e' stata aperta.
//
// TRE cose che questi test tengono ferme:
//   - se l'orario VERO dell'exchange c'e', quello e' un fatto e non si tocca: la cella non si
//     clicca. Una posizione NUOVA (stesso simbolo) eredita solo quanto e' vero: la correzione
//     vecchia muore, perche' la nuova ha già l'orario vero;
//   - tabella e grafico raccontano la STESSA ora (krakenOrarioApertoMs): era il difetto della v163.
//     Qui si misura con dati veri, la tabella e l'ancora della casella disegnata sul grafico
//     (zoneBoxHitRects) — il comportamento, non una stringa cercata nel sorgente;
//   - la regola "exchange > mano" vale anche FRA I DISPOSITIVI: l'anagrafica viaggia intera e
//     viene fusa da posAnagraficaSegna, quindi un fatto vero arrivato dall'altro dispositivo
//     supera una correzione a mano scritta qui (e viceversa). Altrimenti: due dispositivi, due ore.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const SENZA_ORARIO = () => {
  krakenConto = {collegato: true, ambiente: 'simulato', saldo: 10000, conto_id: 'conto-1',
                conto_nome: 'Conto prova 1', leva: 5};
  krakenPosizioni = {posizioni: [
    {simbolo: 'PF_ETHUSD', lato: 'SELL', quantita: 3, entrata: 2500, mark: 2560, sl: 2520, tp: [], pnl: 0}
  ]};
  krakenPendenti = [];
  krakenPosPannello();
};

test('la cella «Eseguita» si clicca e la posizione si data a mano', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      const iEse = [...document.querySelectorAll('#krakenPosPanel th')]
        .map(t => t.textContent.trim()).indexOf('Eseguita');
      const cella = () => document.querySelector('#krakenPosPanel table')
        .querySelectorAll('tbody tr')[0].querySelectorAll('td')[iEse];
      const prima = cella().textContent.trim();
      cella().click();
      await new Promise(z => setTimeout(z, 60));
      const inp = document.querySelector('.appConfirmOverlay input[type="datetime-local"]');
      if(!inp) return {prima, mancaInput: true, titodo: 'X'};
      const d = new Date(Date.now() - 2 * 3600 * 1000);
      const due = n => String(n).padStart(2, '0');
      inp.value = d.getFullYear() + '-' + due(d.getMonth() + 1) + '-' + due(d.getDate())
        + 'T' + due(d.getHours()) + ':' + due(d.getMinutes());
      document.querySelector('.appConfirmOverlay [data-role="ok"]').click();
      await new Promise(z => setTimeout(z, 150));
      const dopo = cella().textContent.trim();
      const anag = posAnagraficaDi('kraken:PF_ETHUSD|conto-1');
      const persistito = (localStorage.getItem(POS_ANAGRAFICA_KEY) || '').includes('orarioManuale');
      return {prima, dopo, atteso: fblOrarioEsecuzione(d.getTime()), titodo: cella().title,
              anag, persistito};
    }, SENZA_ORARIO.toString().replace(/simbolo/g, 'simbolo'));
    assert.equal(r.prima, '—', 'prima non si sa: si scrive —, non un orario inventato');
    assert.ok(!r.mancaInput, 'la cella deve offrire la correzione a mano quando non c\'è l\'orario vero');
    assert.equal(r.dopo, r.atteso, 'dopo la correzione la tabella mostra l\'ora indicata');
    assert.match(r.titodo, /Orario indicato a mano\./,
                'il titodo della cella segnala che la correzione è a mano');
    assert.equal(r.anag && r.anag.orarioManuale, true, 'la correzione si marca: non è una fonte automatica');
    assert.equal(r.persistito, true, 'e sopravvive al riavvio (localStorage)');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// A clean test for title alone is folded into the one above.

test('con l\'orario vero dell\'exchange la cella non si corregge', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async (p) => {
      eval('(' + p + ')')();
      const iEse = [...document.querySelectorAll('#krakenPosPanel th')]
        .map(t => t.textContent.trim()).indexOf('Eseguita');
      const cella = () => document.querySelector('#krakenPosPanel table')
        .querySelectorAll('tbody tr')[0].querySelectorAll('td')[iEse];
      const testo = cella().textContent.trim();
      cella().click();
      await new Promise(z => setTimeout(z, 60));
      const popup = !!document.querySelector('.appConfirmOverlay input[type="datetime-local"]');
      return {testo, popup};
    }, `() => {
      const d = new Date(Date.now()-2*3600*1000);
      krakenConto = {collegato: true, ambiente: 'simulato', saldo: 10000, conto_id: 'conto-1', conto_nome: 'C', leva: 5};
      krakenPosizioni = {posizioni: [
        {simbolo: 'PF_ETHUSD', lato:'SELL', quantita:3, entrata:2500, mark:2560, sl:2520, tp:[], pnl:0, aperta_ms: d.getTime()}
      ]};
      krakenPendenti = [];
      krakenPosPannello();
    }`.replace(/simbolo/g,'simbolo'));
    assert.match(r.testo, /\d{2}:\d{2}/, 'c\'è l\'orario vero: si mostra quello');
    assert.equal(r.popup, false, 'un orario vero non si corregge: è un fatto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la fonte dell\'orario è una sola: exchange, poi anagrafica (compresa la correzione), poi niente', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      krakenConto = {conto_id: 'conto-2'};
      const k = 'kraken:PF_ETHUSD|conto-2';
      const quando = Date.UTC(2026, 9, 15, 20, 0, 0);
      posAnagraficaManuale(k, quando, {entry: 2500, side: 'SELL'});
      const mano = krakenOrarioApertoMs({simbolo: 'PF_ETHUSD', entrata: 2500, aperta_ms: null});
      const sovrascritto = posAnagraficaSegna(k, {apertaMs: quando + 999999, orarioManuale: false});
      const resta = posAnagraficaDi(k);
      const vero = Date.UTC(2026, 9, 16, 8, 0, 0);
      const exchange = krakenOrarioApertoMs({simbolo: 'PF_ETHUSD', aperta_ms: vero});
      const ignoto = krakenOrarioApertoMs({simbolo: 'PF_NOPEUSD', aperta_ms: null});
      ({mano, sovrascritto, resta, exchange, ignoto, quando, vero})
    }`.replace(/simbolo/g, 'simbolo'));
    assert.equal(r.mano.fonte, 'manuale');
    assert.equal(r.mano.ms, r.quando);
    assert.equal(r.sovrascritto, true, 'un valore non-a-mano che arriva supera la correzione a mano');
    assert.equal(r.resta.apertaMs, r.quando + 999999, 'e l anagrafica ora porta quello piu robusto');
    assert.equal(r.resta.orarioManuale, undefined, 'e la correzione a mano viene tolta');
    assert.equal(r.exchange.fonte, 'exchange');
    assert.equal(r.exchange.ms, r.vero);
    assert.equal(r.ignoto.fonte, 'ignota');
    assert.equal(r.ignoto.ms, null);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un orario storto o vuoto si rifiuta senza perdere la correzione già scritta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`{
      krakenConto = {conto_id: 'conto-3'};
      krakenPosizioni = {posizioni: []}; krakenPendenti = [];
      const p = {simbolo: 'PF_ETHUSD', lato: 'SELL', entrata: 2500, mark: 2560, aperta_ms: null};
      const k = 'kraken:PF_ETHUSD|conto-3';
      const buono = Date.UTC(2026, 9, 15, 20, 0, 0);
      posAnagraficaManuale(k, buono, {});
      const storto = krakenImpostaOrarioManuale(p, 'non-una-data');
      const vuoto = krakenImpostaOrarioManuale(p, '   ');
      const dopo = krakenOrarioApertoMs(p);
      ({storto, vuoto, dopo, anag: posAnagraficaDi(k), buono})
    }`.replace(/simbolo/g, 'simbolo'));
    assert.equal(r.storto.ok, false);
    assert.equal(r.vuoto.ok, false);
    assert.equal(r.dopo.fonte, 'manuale');
    assert.equal(r.dopo.ms, r.buono);
    assert.equal(r.anag.orarioManuale, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la posizione corretta a mano si ancora alla candela di quell\'ora anche nel grafico', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(() => {
      const t0 = Date.now() - 150*60000; const R = [];
      for(let i=0;i<150;i++){ const p = 79200 + (i%40)*50;
        R.push({date:new Date(t0+i*60000).toISOString(), open:p, high:p+30, low:p-30, close:p, volume:10}); }
      rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; viewStart=0;
      currentAssetKey='BINANCE:BTCUSDT'; liveModeActive=true;
      krakenConto={configurato:true, collegato:true, ambiente:'simulato', leva:2, saldo:10000,
                   disponibile:9000, conto_id:'conto-1', conto_nome:'Prova'};
      krakenPosizioni={posizioni:[{simbolo:'PF_XBTUSD', lato:'BUY', quantita:0.2, entrata:80000,
        mark:R[R.length-1].close, pnl:20, sl:79500, tp:[{id:'t1',prezzo:80500,quantita:0.1}]}]};
      try{ draw(); }catch(e){ return {errore:String(e)}; }
      const g=chartGeometry();
      const ancora=()=>{ const b=zoneBoxHitRects.find(z=>z.ownerKey==='kraken:PF_XBTUSD'); return b?b.xOrigin:null; };
      const ripiego=ancora();
      const quando=new Date(R[100].date).getTime();
      posAnagraficaManuale('kraken:PF_XBTUSD|conto-1', quando, {entry:80000, side:'BUY'});
      try{ draw(); }catch(e){ return {errore:String(e)}; }
      return {ripiego, corretto:ancora(), atteso:g.xLocal(100), attesoRipiego:g.xLocal(130)};
    })()`.replace(/simbolo/g,'simbolo'));
    assert.ok(!r.errore);
    assert.ok(Number.isFinite(r.ripiego));
    assert.ok(Math.abs(r.ripiego - r.attesoRipiego) < 1.5);
    assert.ok(Math.abs(r.corretto - r.atteso) < 1.5);
    assert.ok(Math.abs(r.corretto - r.ripiego) > 10);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('quando l\'orario vero dell\'exchange torna, supera la correzione a mano anche nell\'anagrafica', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(() => {
      const t0 = Date.now() - 60*60000; const R = [];
      for(let i=0;i<60;i++){ const p=80000;
        R.push({date:new Date(t0+i*60000).toISOString(), open:p, high:p+30, low:p-30, close:p, volume:10}); }
      rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length; viewStart=0;
      currentAssetKey='BINANCE:BTCUSDT'; liveModeActive=true;
      krakenConto={configurato:true, collegato:true, ambiente:'simulato', leva:2, saldo:10000,
                   disponibile:9000, conto_id:'conto-4', conto_nome:'Prova'};
      const k='kraken:PF_XBTUSD|conto-4';
      posAnagraficaManuale(k, Date.now()-10*60000, {});
      const primaManuale=!!posAnagraficaDi(k).orarioManuale;
      const vero=Date.now()-30*60000;
      krakenPosizioni={posizioni:[{simbolo:'PF_XBTUSD', lato:'BUY', quantita:0.2, entrata:80000,
        mark:80000, pnl:0, aperta_ms:vero, sl:79800, tp:[]}]};
      try{ draw(); }catch(e){ return {errore:String(e)}; }
      const dopo=posAnagraficaDi(k);
      return {primaManuale, apertaMs:dopo.apertaMs, manuale:!!dopo.orarioManuale, vero};
    })()`.replace(/simbolo/g,'simbolo'));
    assert.ok(!r.errore);
    assert.equal(r.primaManuale, true);
    assert.equal(r.apertaMs, r.vero);
    assert.equal(r.manuale, false);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il fatto vero ricevuto da un altro dispositivo supera la correzione a mano locale', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(`(() => {
      const k = 'kraken:PF_ETHUSD|conto-5';
      const mano = Date.UTC(2026, 9, 15, 20, 0, 0);
      const vero = Date.UTC(2026, 9, 16, 8, 0, 0);
      posAnagraficaManuale(k, mano, {});
      const diede = posAnagraficaSegna(k, {apertaMs: vero, orarioManuale: false});
      const dopoSolido = posAnagraficaDi(k);
      // caso viceversa: fatto solido locale resiste all'arrivo di una mano
      const k2 = 'kraken:PF_ETHUSD|conto-6';
      posAnagraficaSegna(k2, {apertaMs: vero, orarioManuale: false});
      const manoDopo = posAnagraficaSegna(k2, {apertaMs: mano, orarioManuale: true});
      const dopo2 = posAnagraficaDi(k2);
      return {dopoSolido, manoDopo, dopo2, vero, mano, diede};
    })()`);
    assert.equal(r.dopoSolido.apertaMs, r.vero, 'il vero ricevuto supera la correzione a mano locale');
    assert.equal(r.dopoSolido.orarioManuale, undefined, 'e la correzione a mano viene tolta');
    assert.equal(r.manoDopo, false, 'una mano ricevuta non scavalca un fatto solido');
    assert.equal(r.dopo2.apertaMs, r.vero, 'il vero locale resta il vero');
    assert.equal(r.dopo2.orarioManuale, undefined);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});