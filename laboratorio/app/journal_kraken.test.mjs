// Posizione Kraken chiusa -> Trade Journal; posizione aperta -> casella a grafico.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {apriApp, PREPARA_BTC, RISULTATI} from './aiuti.mjs';

const PREPARA = () => {
  krakenCambioEur = async () => 1.10;
  window.__storico = []; window.__pos = [{simbolo:'PF_XBTUSD',lato:'BUY',quantita:0.2,entrata:79800,mark:80000,pnl:40,
    tp:[{id:'t1',prezzo:80100,quantita:0.1},{id:'t2',prezzo:80250,quantita:0.1}],sl:79650,stops:[]}];
  window.__aperti = ['s1','t1','t2'];
  fetchMt5WithTimeout = async (p) => {
    if(p==='/kraken/stato') return {ok:true,data:{configurato:true,collegato:true,ambiente:'simulato',leva:2,saldo:10000,disponibile:9000,conto_id:'conto-2',conto_nome:'Prova B',simulazione:{}}};
    if(p==='/kraken/posizioni') return {ok:true,data:{posizioni:window.__pos,ordini_aperti:window.__aperti}};
    if(p==='/kraken/pendenti') return {ok:true,data:{pendenti:[]}};
    if(p.startsWith('/kraken/storico')) return {ok:true,data:{supportato:true,operazioni:window.__storico}};
    return {ok:true,data:{ok:true,sl:{id:'s2',prezzo:79800}}};
  };
  window.__creato = Date.now() - 40*60000;
  tgStrategie = {sgA:{conto:'kraken',sala:'Manuale',simbolo:'PF_XBTUSD',sym:'BINANCE:BTCUSDT',side:'BUY',entry:79800,tps:[80100,80250],regole:[],fatte:[],
    creato:window.__creato,quantita:0.2,quota:0.1,tpIds:[{indice:1,id:'t1',quantita:0.1},{indice:2,id:'t2',quantita:0.1}],stopId:'s1',quantitaStop:0.2,
    sl:79650,slIniziale:79650,contoId:'conto-2',gruppo:'sgA'}};
};

test('posizione Kraken aperta: casella a grafico fino all\'ultima candela', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA_BTC); await pagina.evaluate(PREPARA);
    const r = await pagina.evaluate(async () => {
      await krakenAggiornaConto(); await krakenLeggiPosizioni();
      const o = drawTpSlZoneBox; const log = [];
      drawTpSlZoneBox = function(c, x){ const b = o.apply(this, arguments); if(String(x.ownerKey).startsWith('kraken:')) log.push({origine:x.originIdx, passo:x.keepPaceIdx, disegnata:!!b}); return b; };
      draw(); drawTpSlZoneBox = o;
      return log;
    });
    assert.equal(r.length, 1, 'la posizione Kraken deve essere disegnata');
    assert.ok(r[0].disegnata && r[0].origine > 100 && r[0].passo === 149, JSON.stringify(r[0]));
    await pagina.evaluate(() => { $('chart').scrollIntoView({block:'center'}); draw(); });
    await pagina.screenshot({path: path.join(RISULTATI,'kraken_posizione.png'), clip: await pagina.locator('.chartWrap').first().boundingBox()});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('chiusura Kraken nel Trade Journal: TP1 + pareggio, stop pieno, altro conto non toccato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA_BTC); await pagina.evaluate(PREPARA);
    const r = await pagina.evaluate(async () => {
      await krakenAggiornaConto(); await krakenLeggiPosizioni();
      const c = window.__creato, out = {};
      window.__storico = [{ts:c+1000,simbolo:'PF_XBTUSD',lato:'buy',quantita:0.2,prezzo:79800,tipo:'mercato',pnl:0,commissione:7.98,cliOrdId:'fbl_sgA_in'},
        {ts:c+600000,simbolo:'PF_XBTUSD',lato:'sell',quantita:0.1,prezzo:80100,tipo:'take profit',pnl:30,commissione:1.6,cliOrdId:'fbl_sgA_tp1'},
        {ts:c+900000,simbolo:'PF_XBTUSD',lato:'sell',quantita:0.1,prezzo:79800,tipo:'stop',pnl:0,commissione:3.99,cliOrdId:'fbl_sgA_sl'}].reverse();
      krakenStoricoAt=0; window.__pos=[]; window.__aperti=['t2']; krakenPosizioniAt=0;
      const n0 = trades.length; await krakenLeggiPosizioni(); await krakenStrategieValuta();
      const a = trades[trades.length-1];
      out.A = {nuovi:trades.length-n0, result:a.result, exit:a.exit, plUsd:a.plUsd, rimaste:Object.keys(tgStrategie).length};
      const c2 = Date.now()-20*60000;
      tgStrategie.sgB = {conto:'kraken',sala:'VIP',simbolo:'PF_XBTUSD',sym:'BINANCE:BTCUSDT',side:'SELL',entry:80000,tps:[79700],regole:[],fatte:[],creato:c2,
        quantita:0.1,quota:0.1,tpIds:[{indice:1,id:'t9',quantita:0.1}],stopId:'s9',quantitaStop:0.1,sl:80200,slIniziale:80200,contoId:'conto-2',gruppo:'sgB'};
      window.__storico = [{ts:c2+500,simbolo:'PF_XBTUSD',lato:'sell',quantita:0.1,prezzo:80000,tipo:'mercato',pnl:0,commissione:4,cliOrdId:'fbl_sgB_in'},
        {ts:c2+300000,simbolo:'PF_XBTUSD',lato:'buy',quantita:0.1,prezzo:80200,tipo:'stop',pnl:-20,commissione:4,cliOrdId:'fbl_sgB_sl'}].reverse();
      krakenStoricoAt=0; window.__aperti=['t9']; krakenPosizioniAt=0; await krakenLeggiPosizioni(); await krakenStrategieValuta();
      const b = trades[trades.length-1]; out.B = {result:b.result, plUsd:b.plUsd, sala:b.tgSala};
      tgStrategie.sgC = {conto:'kraken',simbolo:'PF_ETHUSD',side:'BUY',entry:3000,tps:[3100],creato:Date.now()-60000,tpIds:[{indice:1,id:'x'}],stopId:'y',contoId:'conto-1',gruppo:'sgC'};
      const n1 = trades.length; krakenPosizioniAt=0; await krakenLeggiPosizioni(); await krakenStrategieValuta();
      out.C = {nuovi:trades.length-n1, ancora:!!tgStrategie.sgC};
      return out;
    });
    assert.deepEqual(r.A, {nuovi:1, result:'BE', exit:79950, plUsd:16.43, rimaste:0});
    assert.deepEqual(r.B, {result:'SL', plUsd:-28, sala:'VIP'});
    assert.deepEqual(r.C, {nuovi:0, ancora:true});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
