// LA RESA TOTALE DEVE DARE I NUMERI GIUSTI, non solo «non esplodere».
//
// PERCHE' QUESTO FILE: le statistiche aggregate (TP per TP, giorno per giorno, sala per sala,
// fasce orarie, notizie, prop firm) sono arrivate senza un solo collaudo. Un riquadro che si apre
// non dice niente su cosa c'e' scritto dentro, e qui i numeri servono per decidere con soldi veri.
//
// LA PROVA PIU' IMPORTANTE E' LA PRIMA: con UNA SOLA sala, l'aggregato deve dare numeri IDENTICI
// al calcolo di sempre. E' l'unico modo di dimostrare che sommare piu' sale non ha cambiato il
// conto che gia' funzionava.
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

// Quattro segnali su una sala: due vinti pieni, uno vinto a meta', uno perso.
const DATI = `
  const G = 86400000, T0 = Date.UTC(2026,0,5,9,0,0);
  const RIGHE = [
    {valutato:true, ts:T0,        entry:100, sl:99, tps:[101,102], raggiunti:2, slPreso:false, asset:'EURUSD'},
    {valutato:true, ts:T0+G,      entry:100, sl:99, tps:[101,102], raggiunti:2, slPreso:false, asset:'EURUSD'},
    {valutato:true, ts:T0+2*G,    entry:100, sl:99, tps:[101,102], raggiunti:1, slPreso:true,  asset:'EURUSD'},
    {valutato:true, ts:T0+3*G,    entry:100, sl:99, tps:[101,102], raggiunti:0, slPreso:true,  asset:'EURUSD'}
  ];
  window.tgAssetPerSala = () => ['EURUSD'];
  window.risultatiDi = () => RIGHE.map(x => Object.assign({}, x));
  tgAssetPerSala = window.tgAssetPerSala; risultatiDi = window.risultatiDi;
`;

test('PROVA DI CONTROLLO: con UNA sala l\'aggregato da\' gli stessi numeri di sempre', async () => {
  const r = await nellApp(`(function(){
    ${DATI}
    const multi = rendCurvaMultiSale(['A'], 10000, 1, {});
    // Gli STESSI accessori che usa rendCurvaMultiSale al suo interno: confrontare due calcoli
    // nutriti in modo diverso non direbbe niente.
    const dammiSerie = () => null;
    const dammiStrategia = (x) => { try{ return stratLeggi(x.sala,
      (typeof fblStratSlotCorrente==='function'?fblStratSlotCorrente():0)); }catch(e){ return null; } };
    const righe = RIGHE.map(x => Object.assign({}, x, {sala:'A', asset:'EURUSD'}));
    const solo  = window.fblCronoRendCurva(righe, 10000, 1, dammiSerie, dammiStrategia, {});
    return {
      capMulti: multi && multi.punti ? multi.punti[multi.punti.length-1].cap : null,
      capSolo : solo  && solo.punti  ? solo.punti[solo.punti.length-1].cap  : null,
      nMulti  : multi && multi.punti ? multi.punti.length : -1,
      nSolo   : solo  && solo.punti  ? solo.punti.length  : -2
    };
  })()`);
  assert.notEqual(r.capMulti, null, 'la curva aggregata deve esistere');
  assert.equal(r.nMulti, r.nSolo, 'stesso numero di punti');
  assert.equal(r.capMulti, r.capSolo,
    'con una sala sola il capitale finale deve essere IDENTICO: se cambia, l\'aggregazione ha alterato il calcolo di sempre');
});

test('TP per TP: le percentuali sono quelle vere, livello per livello', async () => {
  // Quattro segnali con due TP: TP1 preso 3 volte su 4 (75%), TP2 preso 2 su 4 (50%).
  const r = await nellApp(`(function(){
    ${DATI}
    const righe = RIGHE.map(x => Object.assign({}, x, {sala:'A', asset:'EURUSD'}));
    return resaTotaleSaleTP(righe);
  })()`);
  assert.equal(r.length, 2, 'due livelli di TP');
  assert.equal(r[0].hit, 3, 'TP1 preso tre volte');
  assert.equal(r[1].hit, 2, 'TP2 preso due volte');
});

test('fasce orarie: l\'ora e\' quella di ROMA, non UTC', async () => {
  // 5 gennaio: l'Italia e' a UTC+1. Un segnale alle 09:00 UTC e' le 10:00 a Roma.
  const r = await nellApp(`(function(){
    return resaTotaleSaleRomaMinuti(Date.UTC(2026,0,5,9,0,0));
  })()`);
  assert.equal(r, 600, '09:00 UTC in gennaio sono le 10:00 a Roma, cioe\' 600 minuti');
});

test('PROVA DI CONTROLLO: d\'estate il fuso di Roma e\' un\'ora piu\' avanti', async () => {
  // Senza questa prova, un codice che somma sempre +60 passerebbe il test sopra pur essendo
  // sbagliato per meta' anno.
  const r = await nellApp(`(function(){
    return resaTotaleSaleRomaMinuti(Date.UTC(2026,6,5,9,0,0));
  })()`);
  assert.equal(r, 660, '09:00 UTC in luglio sono le 11:00 a Roma, cioe\' 660 minuti');
});

test('prop firm: due fasi passate, e quello che spetta e\' l\'80%', async () => {
  // Curva che cresce fino a +20%: la Sfida 1 (10%) e poi la Sfida 2 (5%) devono passare.
  const r = await nellApp(`(function(){
    const G=86400000, T0=Date.UTC(2026,0,5,9,0,0);
    const punti=[]; for(let i=0;i<=40;i++) punti.push({t:T0+i*G, cap:10000+i*50});
    const due = fblPropDedicataConta(punti, 10000, T0, 'ftmo-2step');
    const uno = fblPropDedicataConta(punti, 10000, T0, 'ftmo-1step');
    return {
      quotaDue: due.quotaTrader, fasiDue: (due.fasi||[]).map(f=>f.esito),
      quotaUno: uno.quotaTrader, fasiUno: (uno.fasi||[]).map(f=>f.esito)
    };
  })()`);
  assert.equal(r.quotaDue, 80, 'two step: al trader spetta l\'80%');
  assert.equal(r.quotaUno, 90, 'one step: al trader spetta il 90%');
  assert.equal(r.fasiUno.length, 1, 'il one step ha UNA fase sola');
  assert.equal(r.fasiDue.length, 2, 'il two step ne ha due');
  assert.deepEqual(r.fasiDue, ['passata','passata'], 'su una curva che sale del 20% passano entrambe');
});
