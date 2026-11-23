// BOS auto-open: gli aggiornamenti su st.ops (TP/SL/BE/chiusura) devono propagarsi
// alla posizione reale/demo collegata via autoPosId.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('bosSyncAutoPos aggiorna TP/SL della posizione reale collegata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const pos = {id: 123, asset:'EURUSD', side:'BUY', entry:1.1, sl:1.09, tp:1.12, lots:0.1};
      positions.push(pos);
      const op = {autoPosId: 123, sl:1.095, tp:1.13};
      bosSyncAutoPos(op);
      return {sl: pos.sl, tp: pos.tp};
    });
    assert.equal(r.sl, 1.095);
    assert.equal(r.tp, 1.13);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('bosChiudiAutoPos chiude la posizione reale collegata', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(() => {
      const closed = [];
      const orig = closeTrade;
      try {
        closeTrade = (reason, price, p) => { closed.push({reason, price, id:p && p.id}); positions = positions.filter(x=>x!==p); };
        const pos = {id: 456, asset:'EURUSD', side:'BUY', entry:1.1, sl:1.09, tp:1.12, lots:0.1};
        positions.push(pos);
        const op = {autoPosId: 456, sl:1.09, tp:1.12};
        bosChiudiAutoPos(op, 'TP', 1.12);
      } finally { closeTrade = orig; }
      return {closed, rimaste: positions.filter(p=>p && p.id===456).length};
    });
    assert.deepEqual(r.closed, [{reason:'TP', price:1.12, id:456}]);
    assert.equal(r.rimaste, 0);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
