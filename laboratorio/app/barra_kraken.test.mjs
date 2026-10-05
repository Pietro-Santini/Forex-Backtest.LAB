// Barra ordini dentro il grafico col conto Kraken: rischio %, lotto, ordini pendenti.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {apriApp, PREPARA_BTC, RISULTATI} from './aiuti.mjs';

const PONTE_FINTO = () => {
  window.__chiamate = []; window.__pend = [];
  fetchMt5WithTimeout = async (p, opt) => {
    const corpo = opt && opt.body ? JSON.parse(opt.body) : null; window.__chiamate.push([p, corpo]);
    if(p==='/kraken/stato') return {ok:true,data:{configurato:true,collegato:true,ambiente:'simulato',leva:2,saldo:10000,disponibile:9000,pnl_aperto:0,conto_id:'conto-2',conto_nome:'Prova B',simulazione:{}}};
    if(p.startsWith('/kraken/strumento/')) return {ok:true,data:{simbolo:'PF_XBTUSD',prezzo:80010,tick:0.5,step:0.0001,min:0.0001}};
    if(p==='/kraken/posizioni') return {ok:true,data:{posizioni:[],ordini_aperti:[]}};
    if(p==='/kraken/pendenti') return {ok:true,data:{pendenti:window.__pend}};
    if(p==='/kraken/pendente'){ const o=Object.assign({id:'pd1',stato:'attesa'},corpo); window.__pend=[o]; return {ok:true,data:{ok:true,pendente:o}}; }
    if(p==='/kraken/pendente/preso'){ window.__pend.forEach(o=>{ if(o.id===corpo.id)o.preso=true; }); return {ok:true,data:{}}; }
    return {ok:true,data:{}};
  };
};

test('barra Kraken: lotto dal rischio, rischio vero, pendente inviato al ponte', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA_BTC);
    await pagina.evaluate(PONTE_FINTO);
    const r = await pagina.evaluate(async () => {
      await krakenAggiornaConto(); krakenInfoCorrente(); await new Promise(r=>setTimeout(r,100));
      const out = {};
      $('risk').value=1; $('lots').value=0.01;
      setTradeLevel('SL',79000);                       // stop a 1000 $ con saldo 10.000 e rischio 1%
      out.lotto = Number($('lots').value); out.rischio = $('quickRiskReale').textContent;
      $('quickLotsVal').value='0.2'; $('quickLotsVal').dispatchEvent(new Event('input'));
      out.rischioDoppio = $('quickRiskReale').textContent; out.sopra = $('quickRiskReale').classList.contains('sopra');
      $('sl').value=''; quickPendingConfirmActive=true; pendingOrderKind='LIMIT'; $('riskPending').value=1;
      setTradeLevel('ENTRY',79500); setTradeLevel('SL_PENDING',79000); setTradeLevel('TP_PENDING',81000);
      out.lottoPendente = Number($('lotsPending').value);
      confirmPendingOrderFromFields(false); await new Promise(r=>setTimeout(r,300));
      out.inviato = window.__chiamate.filter(c=>c[0]==='/kraken/pendente').map(c=>c[1]);
      out.inAttesa = krakenPendenti.length;
      return out;
    });
    assert.equal(r.lotto, 0.1);
    assert.equal(r.rischio, '= 1.00%');
    assert.equal(r.rischioDoppio, '= 2.00%');
    assert.equal(r.sopra, true);
    assert.equal(r.lottoPendente, 0.2);
    assert.equal(r.inviato.length, 1);
    assert.deepEqual({lato:r.inviato[0].lato,tipo:r.inviato[0].tipo,entrata:r.inviato[0].entrata,sl:r.inviato[0].sl,tp:r.inviato[0].tp,q:r.inviato[0].quantita},
                     {lato:'BUY',tipo:'LIMIT',entrata:79500,sl:79000,tp:[81000],q:0.2});
    assert.equal(r.inAttesa, 1);
    await pagina.evaluate(() => { $('chart').scrollIntoView({block:'center'}); draw(); });
    await pagina.screenshot({path: path.join(RISULTATI,'barra_kraken.png'), clip: await pagina.locator('.chartWrap').first().boundingBox()});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('pendente scattato sul PC: preso in carico una sola volta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA_BTC);
    await pagina.evaluate(PONTE_FINTO);
    const r = await pagina.evaluate(async () => {
      await krakenAggiornaConto();
      window.__pend = [{id:'pd9',gruppo:'pdX',simbolo:'PF_XBTUSD',lato:'BUY',tipo:'LIMIT',entrata:79500,sl:79000,tp:[81000],quantita:0.2,
        stato:'eseguito',il:Date.now()/1000,prezzo_scatto:79498,risultato:{simbolo:'PF_XBTUSD',quantita:0.2,entrata:79498,sl:{id:'s9'},tp:[{indice:1,id:'t9',quantita:0.2}]}}];
      krakenPendentiAt=0; await krakenLeggiPendenti();
      const presa = !!tgStrategie.pdX;
      delete tgStrategie.pdX; window.__pend.forEach(o=>o.preso=false);   // il "preso" non e' arrivato al PC
      krakenPendentiAt=0; await krakenLeggiPendenti();
      return {presa, rinata: !!tgStrategie.pdX};
    });
    assert.deepEqual(r, {presa:true, rinata:false});
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
