// BANCO VERDE — §3.4.2. Ora in laboratorio/app/, dentro il collaudo: la cura e' in app.html.
// Misura che sul trade vero MT5 siano registrati il costo dell'esecuzione rispetto al segnale
// (entrySegnale, stopSegnale, stopEseguito, costoEsecuzioneEUR) e la commissione contabile.
// La fonte corretta e' la fotografia REALE /positions del bridge (commissione calcolata sui deal
// di ingresso): /deal_reason non la contiene, quindi non e' li' che va cercata.
//
// MISURA GIÀ FATTA (laboratorio/misura_costo_esecuzione.mjs, sonda gitignota):
//   segnale/ombra  entry 2000,00  stop 1990,00
//   MT5            entry 2000,30 (3 pip, +3,00 EUR)  stop eseguito 1989,60 (4 pip, -4,00 EUR)
//   Journal        entry 2000,30 / exit 1989,60 / pl -107 / pips -107   -> GIÀ GIUSTO
//   ombra          entry 2000,00 / stopOra 1990,00 / R -1,02            -> resta del segnale
//   commissione    fonte 'tipica' 0,003%, quante 0                       -> non si impara
// Il prezzo vero arriva nel P/L. Mancava un campo che dicesse quanto e' costata l'esecuzione
// rispetto al segnale, e mancava la commissione contabile nei trade: non sta in /deal_reason,
// ma nella fotografia REALE /positions del bridge (calcolata sui deal di ingresso).
// Da li' la legge l'app, cosi' fblCommissioneImparata puo' contare le operazioni.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const ENTRATA_SEGNALE=2000.00, STOP_SEGNALE=1990.00;
const ENTRATA_MT5=2000.30, STOP_LIVELLO=1990.00, STOP_ESEGUITO=1989.60;
const PROFIT_NETTO=-107.00, COMMISSIONE=-1.5;

const PREPARA=`(function(){
  const t0=Date.UTC(2026,10,27,8,0,0), R=[];
  for(let i=0;i<60;i++){ const c=${ENTRATA_SEGNALE};
    R.push({date:new Date(t0+i*60000).toISOString(),open:c,high:c+0.05,low:c-0.05,close:c,volume:10}); }
  rows=R; baseRows=R; idx=R.length-1; viewEnd=R.length;
  currentAssetKey='XAUUSD'; rowsAssetKey='XAUUSD'; currentTF='M15';
  liveModeActive=true; liveReplayActive=false; fblBacktestModeAttivo=false;
  mt5Connected=true; mt5ConnessioneInCorso=0; mt5GenerazioneConto=1;
  mt5ActiveSymbol=null; lastMt5TickPrice=NaN;
  mt5ContoAttivo={login:'11111',server:'Demo-Server'};
  mt5AccountInfo={login:'11111',server:'Demo-Server',reale:false,balance:10000};
  fblContoVista='mt5';
  positions.length=0; pendingOrders.length=0; trades.length=0; equity.length=0;
  localStorage.setItem('fbl_motore_auto','{}');
  localStorage.removeItem('fbl_motore_ombra');
  localStorage.removeItem('fbl_motore_registro');
  localStorage.removeItem('fbl_auto_aperture');
  fblMotoreUltimaBase=Math.floor(Date.now()/60000);
  if(typeof mt5PositionsPollTimer!=='undefined'&&mt5PositionsPollTimer){clearInterval(mt5PositionsPollTimer);mt5PositionsPollTimer=null;}
  if(typeof mt5AccountHistoryTimer!=='undefined'&&mt5AccountHistoryTimer){clearInterval(mt5AccountHistoryTimer);mt5AccountHistoryTimer=null;}
  playOrderSound=function(){};
  if(window.__ponte)window.__ponte.posAperta=true;
  return true;
})()`;

const APRI=`(async function(){
  const reg={id:'misura',key:'misura',tf:'M15',obiettivoR:3,be:[1,0]};
  fblMotoreDecidi(reg,{dir:1,stop:${STOP_SEGNALE}},rows,rows.length-1,true);
  await new Promise(r=>setTimeout(r,400));
  return true;
})()`;

const CHIUDI=`(function(){ window.__ponte.posAperta=false; return true; })()`;

const LEGGI=`(function(){
  const t=trades.find(x=>x&&String(x.mt5Ticket)==='777001')||null;
  const om=fblMotoreLeggi('fbl_motore_ombra')[0]||null;
  return {
    trade:t?Object.assign({},t):null,
    ombra:om?{entry:om.entry,stop:om.stop,stopOra:om.stopOra,R:om.R,stato:om.stato}:null,
    imparata:fblCommissioneImparata('XAUUSD'),
    pct:fblCommissionePct('XAUUSD')
  };
})()`;

// Il banco mima il bridge REALE: /positions porta la commissione (calcolata dai deal di ingresso),
// /deal_reason NO (vedi bridge.py: restituisce solo reason, prezzi/orari, volume, profit_net, saldo).
async function giro(extra){
  const cfgFinale=Object.assign({motivo:'SL',prezzoDeal:STOP_ESEGUITO,profitNet:PROFIT_NETTO},extra);
  const {browser, pagina, errori}=await apriApp({primaDiNavigare: async p=>{
    await p.addInitScript((cfgIn)=>{
      const cfg=Object.assign({posAperta:true,
        timeOpen:Math.floor(Date.now()/1000)-600,timeClose:Math.floor(Date.now()/1000)},cfgIn);
      window.__ponte=cfg;
      const R=(d)=>new Response(JSON.stringify(d),{status:200,
        headers:{'Content-Type':'application/json','X-MT5-Login':'11111','X-MT5-Server':'Demo-Server'}});
      window.fetch=async function(u,opt){
        const url=String((u&&u.url)?u.url:u);
        const c=url.replace(/^https?:\/\/[^/]+/,'').split('?')[0];
        if(c.indexOf('/order/market')>=0)return R({ok:true,ticket:cfg.ticket,price:cfg.filled});
        if(c.indexOf('/order/modify')>=0)return R({ok:true});
        if(c.indexOf('/positions')>=0)return R(cfg.posAperta?[{
          ticket:cfg.ticket,symbol:'XAUUSD',side:'BUY',type:0,volume:0.10,
          price_open:cfg.filled,price_current:1999.00,bid:1999.00,ask:1999.05,
          sl:cfg.sl,tp:cfg.tp,profit:-13,swap:0,commission:cfg.commissione,
          time:cfg.timeOpen,point:0.01
        }]:[]);
        if(c.indexOf('/deal_reason')>=0)return R({
          reason:cfg.motivo,price:cfg.prezzoDeal,price_open:cfg.filled,volume:0.10,
          profit_net:cfg.profitNet,balance:10000+cfg.profitNet,
          time:cfg.timeClose,time_open:cfg.timeOpen
        });
        if(c.indexOf('/orders')>=0||c.indexOf('/history_deals')>=0||c.indexOf('/account_history')>=0)return R([]);
        if(c.indexOf('/account')>=0)return R({balance:10000,login:11111,server:'Demo-Server'});
        if(c.indexOf('/health')>=0||c.indexOf('/mt5-terminal-status')>=0)return R({ok:true});
        if(c.indexOf('/news')>=0)return R([]);
        return R({});
      };
    },{ticket:777001,filled:ENTRATA_MT5,sl:STOP_LIVELLO,tp:2030.00,
       motivo:cfgFinale.motivo,prezzoDeal:cfgFinale.prezzoDeal,profitNet:cfgFinale.profitNet,
       commissione:COMMISSIONE});
  }});
  try{
    await pagina.evaluate(PREPARA);
    await pagina.evaluate(APRI);
    await pagina.evaluate(CHIUDI);
    await pagina.evaluate('fetchMt5Positions()');
    await pagina.waitForTimeout(250);
    await pagina.evaluate('fetchMt5Positions()');
    await pagina.waitForTimeout(400);
    const misura=await pagina.evaluate(LEGGI);
    assert.deepEqual(errori,[],'la pagina non deve avere errori JS');
    return misura;
  } finally { await browser.close(); }
}

test('CONTROLLO VERDE: i prezzi veri di MT5 finiscono nel P/L e nel Journal', async () => {
  const m=await giro();
  assert.equal(m.trade.entry,ENTRATA_MT5,'l\'entrata del Journal e\' il prezzo eseguito da MT5');
  assert.equal(m.trade.exit,STOP_ESEGUITO,'l\'uscita del Journal e\' il prezzo reale del deal di stop');
  assert.equal(m.trade.pl,PROFIT_NETTO,'il P/L e\' il profit_net vero del broker');
  assert.equal(m.trade.pips,-107,'i pip sono calcolati sull\'entrata/esecuzione vera');
});

test('ROSSO: manca il campo che misura il costo vero di esecuzione contro il segnale', async () => {
  const m=await giro();
  // L'ombra resta del segnale (e' progettata cosi'). Serve PERO' una misura separata,
  // sulla riga del trade vero, che dica quanto e' costato scostarsi dal segnale.
  assert.equal(m.ombra.entry,ENTRATA_SEGNALE,' presupposto: l\'ombra e\' la foto del segnale');
  assert.equal(m.ombra.stopOra,STOP_SEGNALE,' presupposto: lo stop dell\'ombra e\' quello del segnale');
  assert.equal(m.trade.entrySegnale,ENTRATA_SEGNALE,
    'il trade deve portare il prezzo di segnale da cui e\' partito il motore');
  assert.equal(m.trade.stopSegnale,STOP_SEGNALE,
    'il trade deve portare lo stop del segnale');
  assert.equal(m.trade.stopEseguito,STOP_ESEGUITO,
    'il trade deve portare il prezzo a cui MT5 ha ESEGUITO lo stop, distinto dal livello sl');
  assert.ok(Math.abs(m.trade.costoEsecuzioneEUR-7)<0.01,
    'il costo totale segnale→MT5 deve essere 3,00 + 4,00 = 7,00 EUR; trovato '+m.trade.costoEsecuzioneEUR);
});

test('VERDE: la commissione vera di /positions finisce nei trade, il costo medio si impara', async () => {
  const m=await giro();
  assert.equal(m.trade.commission,COMMISSIONE,
    'la commissione della fotografia /positions del bridge deve essere salvata sul trade');
  assert.equal(m.imparata.quante,1,
    'con un trade vero si deve poter contare la commissione imparata');
  assert.ok(Math.abs(m.imparata.perLotto-15)<0.01,
    'fblCommissioneImparata fa somma(|commission|)/somma(|lots|): 1,50 EUR su 0,10 lotti = 15 EUR/lotto; trovato '+m.imparata.perLotto);
  // Non si chiede qui che `pct.fonte` diventi 'imparata': servono 10 operazioni (FBL_COMM_MINIME),
  // e una sola non basta. Si chiede solo che il DATO ci sia e sia contabile.
});

test('VERDE: un TP senza stop eseguito non ne inventa uno e conserva la commissione di /positions', async () => {
  const m=await giro({motivo:'TP',prezzoDeal:2030.00,profitNet:30});
  assert.ok(!('stopEseguito' in m.trade),
    'una chiusura TP non puo\' avere uno stop eseguito: nessun prezzo di stop verificato');
  assert.ok(!('costoEsecuzioneEUR' in m.trade),
    'senza stop eseguito verificato il costo di esecuzione resta assente, non inventato');
  assert.equal(m.trade.commission,COMMISSIONE,
    'la commissione resta quella della fotografia REALE /positions, non del deal_reason');
});
