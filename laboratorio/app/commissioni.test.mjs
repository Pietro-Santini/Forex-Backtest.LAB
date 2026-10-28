// LE COMMISSIONI: valori tipici FTMO, e quelli IMPARATI dal conto MT5 vero.
//
// RICHIESTO dal proprietario: «i valori FTMO tipici espressi in percentuale e li impari dal mio
// conto MT5, quindi insieme».
//
// PERCHE' SERVE: finora lo storico, il replay e il rendimento delle sale NON avevano nessun
// costo. Una curva senza commissioni e' ottimista per costruzione - e su una prop firm, dove si
// decide con un 5% e un 10%, un costo che manca puo' far sembrare passata una sfida che non lo
// sarebbe. Le commissioni esistevano solo sulle posizioni MT5 vere, cioe' proprio dove non
// servivano a questo conto.
//
// LA REGOLA CHE VALE PIU' DI TUTTE: un valore IMPARATO da poche operazioni e' PEGGIO del valore
// tipico, perche' sembra piu' preciso e non lo e'. Serve una soglia, e si deve sempre poter dire
// quale dei due si sta usando.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

async function nellApp(codice){
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(codice);
    assert.deepEqual(errori, [], 'la pagina non deve avere errori JS');
    return r;
  } finally { await browser.close(); }
}

test('senza storico MT5 si usa il valore tipico, e lo si dichiara', async () => {
  const r = await nellApp(`(function(){
    trades = [];
    const c = fblCommissionePct('EURUSD');
    return {pct:c.pct, fonte:c.fonte, quante:c.quante};
  })()`);
  assert.ok(r.pct > 0, 'una commissione ci dev\'essere: zero sarebbe la bugia di prima');
  assert.equal(r.fonte, 'tipica', 'e si deve sapere che e\' un valore tipico, non misurato');
});

test('con abbastanza operazioni vere si impara dal conto, e lo si dichiara', async () => {
  // Venti operazioni chiuse su EURUSD, ognuna con 1 lotto e 7 euro di commissione: il costo
  // imparato dev'essere quello vero, non quello tipico.
  const r = await nellApp(`(function(){
    trades = Array.from({length:20}, (_,i) => ({
      id:'t'+i, asset:'EURUSD', mt5Ticket:100+i, lots:1,
      commission:-7, entry:1.1000, exit:1.1050, closedAt:'2026-10-0'+(i%9+1)
    }));
    const c = fblCommissionePct('EURUSD');
    return {fonte:c.fonte, quante:c.quante, perLotto:c.perLotto};
  })()`);
  assert.equal(r.fonte, 'imparata', 'con venti operazioni vere si usa il dato misurato');
  assert.equal(r.quante, 20, 'e si deve poter dire su quante e\' stato calcolato');
  assert.ok(Math.abs(r.perLotto - 7) < 0.01,
    'sette euro a lotto: e\' quello che il conto ha pagato davvero, era ' + r.perLotto);
});

test('con POCHE operazioni NON si impara: due numeri non fanno una media', async () => {
  // LA REGOLA CHE CONTA. Un costo medio ricavato da due operazioni sembra piu' preciso del
  // valore tipico e non lo e': basta un'operazione strana per sballarlo. Senza soglia, l'app
  // darebbe un numero sbagliato con l'aria di saperlo.
  const r = await nellApp(`(function(){
    trades = [
      {id:'a', asset:'EURUSD', mt5Ticket:1, lots:1, commission:-99, entry:1.1, exit:1.11},
      {id:'b', asset:'EURUSD', mt5Ticket:2, lots:1, commission:-99, entry:1.1, exit:1.11}
    ];
    const c = fblCommissionePct('EURUSD');
    return {fonte:c.fonte, quante:c.quante};
  })()`);
  assert.equal(r.fonte, 'tipica',
    'con due sole operazioni si resta sul valore tipico, anche se un dato misurato ci sarebbe');
});

test('le operazioni di un ALTRO strumento non contano', async () => {
  // PROVA DI CONTROLLO della precedente: se bastasse contare le operazioni senza guardare lo
  // strumento, venti di oro farebbero "imparare" una commissione per EURUSD che nessuno ha mai
  // pagato su EURUSD.
  const r = await nellApp(`(function(){
    trades = Array.from({length:20}, (_,i) => ({
      id:'x'+i, asset:'XAUUSD', mt5Ticket:200+i, lots:1, commission:-7, entry:4000, exit:4010
    }));
    const c = fblCommissionePct('EURUSD');
    return {fonte:c.fonte, quante:c.quante};
  })()`);
  assert.equal(r.fonte, 'tipica', 'venti operazioni su oro non dicono niente su EURUSD');
  assert.equal(r.quante, 0);
});

test('la curva delle sale paga le commissioni: la resa scende', async () => {
  // La prova che serve davvero: due curve identiche, una col costo e una senza. Quella col
  // costo DEVE rendere di meno - ed e' il motivo per cui si fa tutto questo: senza, una sfida
  // prop firm puo' sembrare passata quando non lo sarebbe.
  const r = await nellApp(`(function(){
    trades = [];
    const ris = Array.from({length:30}, (_,i) => ({
      valutato:true, tFill: Date.UTC(2026,0,2+i,12), entry:1.1000, sl:1.0950,
      tps:[1.1100], raggiunti:1, slPreso:false
    }));
    const senza = fblCronoRendCurva(ris, 10000, 1, null, null, {commissioni:false});
    const con   = fblCronoRendCurva(ris, 10000, 1, null, null, {commissioni:true});
    return {senza:senza.finale, con:con.finale};
  })()`);
  assert.ok(r.con < r.senza,
    'con le commissioni il conto finale dev\'essere piu\' basso: era ' + r.con + ' contro ' + r.senza);
  // Ma non sproporzionato: trenta operazioni non possono costare un terzo del conto.
  assert.ok(r.con > r.senza * 0.8,
    'e il costo dev\'essere plausibile, non divorare la curva: ' + r.con + ' contro ' + r.senza);
});
