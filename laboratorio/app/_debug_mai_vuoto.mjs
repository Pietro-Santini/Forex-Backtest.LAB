import {apriApp} from './aiuti.mjs';
const {browser, pagina, errori} = await apriApp();
const out = await pagina.evaluate(`(() => {
  const VEN = Date.UTC(2026,10,6,20,0,0);
  rows = []; baseRows = []; let p = 4100;
  for (let i = 0; i < 120; i++) {
    const t = VEN + i*60000, o = p, c = p + Math.sin(i/7)*2;
    rows.push({date:new Date(t).toISOString(),open:o,high:Math.max(o,c)+1,low:Math.min(o,c)-1,close:c,volume:10});
    p = c;
  }
  for (let i = 0; i < 60; i++) {
    const t = VEN + 120*60000 + (i+1)*3600000;
    rows.push({date:new Date(t).toISOString(),open:4100,high:4101,low:4099,close:4100,volume:0});
  }
  baseRows = rows.slice(); idx = rows.length-1; viewEnd = rows.length;
  currentAssetKey = 'XAUUSD'; csvLibrary = [{id:'xau', rows:rows}];
  liveModeActive = true; liveReplayActive = false; mt5Connected = false;
  orariAsset['XAUUSD'] = {zona:'UTC', giorni:{mon:[],tue:[],wed:[],thu:[],fri:[],sat:[],sun:[]},
                          stato:'CLOSED', letto:Date.now()};
  const diretta = _fblConfineChiusuraCalcola('XAUUSD', rows.length);
  const tUlt = parseDateTime(rows[rows.length-1].date);
  const passoAPasso = (() => {
    const tLimite = tUlt - 8*86400000;
    for (let i = rows.length-1; i >= 0; i--) {
      const t = parseDateTime(rows[i].date);
      if (!Number.isFinite(t)) continue;
      if (t < tLimite) return {stop: 'tempo', i: i};
      if (liveSessionPhaseAt(t) !== 'closed') return {aperta: i, data: rows[i].date};
    }
    return {aperta: null};
  })();
  return {righe: rows.length, diretta: diretta,
          binance: (()=>{ try { return binanceSymbolForAsset('XAUUSD'); } catch(e) { return 'ERR'; } })(),
          mt5noto: (()=>{ try { return fblMercatoMt5Noto('XAUUSD'); } catch(e) { return 'ERR'; } })(),
          tUlt: new Date(tUlt).toISOString(), passoAPasso: passoAPasso,
          cache: JSON.stringify(__fblConfineCacheCh)};
})()`);
console.log(JSON.stringify(out, null, 1));
console.log('errori pagina:', errori.length);
await browser.close();
