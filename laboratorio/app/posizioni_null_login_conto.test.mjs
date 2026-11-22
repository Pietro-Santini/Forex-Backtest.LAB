// Posizione reale senza mt5Login non deve entrare nel conto attivo quando il conto è noto.
// Scaletta 8.4.12: il filtro passava se login coincideva O se non aveva login.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

const CANDELE = () => {
  const t0 = Date.now() - 300 * 60000; const R = [];
  for (let i = 0; i < 300; i++) { const t = t0 + i * 60000, p = 1.1 + Math.sin(i / 17) * 0.01;
    R.push({date: new Date(t).toISOString(), open: p, high: p + 0.0005, low: p - 0.0005, close: p, volume: 10}); }
  return R;
};

test('posizione MT5 senza mt5Login non entra nel conto attivo noto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(`(() => {
      const C=${JSON.stringify(CANDELE())};
      rows=C; baseRows=C; idx=C.length-1; viewEnd=C.length-1;
      currentAssetKey='EURUSD'; liveModeActive=true; liveReplayActive=false; fblContoVista='mt5';
      followLatest=false;
      const _v=getViewWindow();
      const _m=Math.max(0,Math.min(C.length-1,Math.floor((_v.start+_v.end)/2)));
      const _tm=new Date(C[_m].date).getTime(), _pm=C[_m].close;
      positions.length=0; pendingOrders.length=0; trades.length=0;
      positions.push({id:'mia', asset:'EURUSD', side:'BUY', entry:_pm, lots:0.1, mt5Ticket:111,
        mt5Login:'11111', mt5Server:'Broker', startTime:_tm, openTF:1});
      positions.push({id:'fantasma', asset:'EURUSD', side:'SELL', entry:_pm+0.0002, lots:0.2, mt5Ticket:999,
        mt5Login:null, mt5Server:'Broker', startTime:_tm, openTF:1});
      mt5Connected=true; mt5MonitorOnly=false; mt5ContoAttivo={login:'11111', server:'Broker'};
      const sulGrafico=positions.filter(drawableOnCurrentChart).map(p=>p.id);
      const inTabella=positions.filter(positionBelongsToCurrentView).map(p=>p.id);
      return {sulGrafico, inTabella};
    })()`);
    assert.deepEqual(r.sulGrafico, ['mia'], 'a grafico solo la posizione del conto attivo: '+JSON.stringify(r.sulGrafico));
    assert.deepEqual(r.inTabella, ['mia'], 'in tabella solo la posizione del conto attivo: '+JSON.stringify(r.inTabella));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});