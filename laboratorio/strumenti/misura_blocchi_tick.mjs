// MISURA 2 (22 ottobre 2026): a blocchi, ma in CHE FORMA.
//
// La prima misura (misura_salvataggio_tick.mjs) ha detto:
//   - oggi: 105 ms per scrivere tutto il registro (150.000 tick)
//   - a blocchi da 20.000 tick, con gli OGGETTI: ~13 ms per blocco
//   - in forma COMPATTA (4 array numerici), tutto il registro: 12 ms
//
// Qui la domanda e' una: il blocco in forma compatta quanto costa davvero, e il giro torna
// ESATTAMENTE uguale? (i tick vivi hanno {t,price,side,weight,src}; quelli storici aggiungono
// {aggr,vol,mode}: se la forma compatta perde un campo, il footprint perde una feature e nessuno
// se ne accorge -> quindi qui si controlla, non si presume).
//
// Uso: node laboratorio/strumenti/misura_blocchi_tick.mjs

import {apriApp} from '../app/aiuti.mjs';

const N_TICK = 150000;
const BLOCCO = 20000;

const {browser, pagina} = await apriApp();

const esito = await pagina.evaluate(async ({n, blocco}) => {
  const log = [];
  for(let i = 0; i < n; i++){
    log.push({t: 1760000000000 + i * 37, price: 1.1 + (i % 500) / 100000, side: (i % 2) ? 1 : -1, weight: 1, src: 'mt5'});
  }
  // Un blocco "storico" per prova: con i campi in piu' (aggr/vol/mode).
  const storico = {t: 1760000000000, price: 1.2, side: 1, weight: 3, aggr: -1, vol: 3, mode: 'flags'};

  const SRC = [undefined, 'mt5', 'capital', 'binance'];
  const MODE = [undefined, 'flags', 'bidask', 'tickrule'];

  // CODIFICA COMPATTA: i quattro numeri sempre, gli altri campi solo se servono.
  function codifica(blocco){
    const m = blocco.length;
    const t = new Float64Array(m), p = new Float64Array(m), s = new Int8Array(m), w = new Float64Array(m);
    const sc = new Uint8Array(m), md = new Uint8Array(m), ag = new Int8Array(m), vo = new Float64Array(m);
    const extra = [];
    for(let i = 0; i < m; i++){
      const x = blocco[i];
      t[i] = x.t; p[i] = x.price; s[i] = x.side; w[i] = x.weight;
      sc[i] = Math.max(0, SRC.indexOf(x.src));
      md[i] = Math.max(0, MODE.indexOf(x.mode));
      ag[i] = (x.aggr===undefined)?127:x.aggr;
      vo[i] = (x.vol===undefined)?NaN:x.vol;
      // QUALSIASI campo che non conosciamo resta VERBATIM: niente si perde, niente si inventa.
      if(Object.keys(x).some(k => !['t','price','side','weight','src','mode','aggr','vol'].includes(k))) extra.push([i, x]);
    }
    return {v:1, n:m, t, p, s, w, sc, md, ag, vo, extra};
  }
  function decodifica(c){
    const fuori = [];
    for(let i = 0; i < c.n; i++){
      const x = {t:c.t[i], price:c.p[i], side:c.s[i], weight:c.w[i]};
      if(c.sc[i])x.src = SRC[c.sc[i]];
      if(c.md[i])x.mode = MODE[c.md[i]];
      if(c.ag[i]!==127)x.aggr = c.ag[i];
      if(Number.isFinite(c.vo[i]))x.vol = c.vo[i];
      fuori.push(x);
    }
    for(const [i, o] of (c.extra||[])) fuori[i] = o;
    return fuori;
  }
  const uguale = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  const tempo = async (nome, fn) => {
    const t0 = performance.now();
    const esito = await fn();
    return {nome, ms: Math.round((performance.now() - t0) * 10) / 10, esito};
  };
  const righe = [];

  // 1. Il blocco con gli oggetti (la forma di oggi, ma solo 20.000 tick).
  righe.push(await tempo('blocco con OGGETTI (20.000 tick)', async () => {
    const ok = await idbPut('misura2:oggetti', log.slice(0, blocco));
    return ok ? 'scritto' : 'FALLITO';
  }));

  // 2. Il blocco compatto, con la codifica e la decodifica.
  righe.push(await tempo('blocco COMPATTO (20.000 tick) - solo la codifica', async () => {
    const c = codifica(log.slice(0, blocco));
    const ok = await idbPut('misura2:compatto', c);
    return ok ? 'scritto' : 'FALLITO';
  }));
  righe.push(await tempo('blocco COMPATTO (20.000 tick) - codifica + scrittura', async () => {
    const c = codifica(log.slice(0, blocco));
    const ok = await idbPut('misura2:compatto2', c);
    return ok ? 'scritto' : 'FALLITO';
  }));

  // 3. E la lettura: decodifica + ricostruzione degli oggetti.
  righe.push(await tempo('lettura del blocco COMPATTO + ricostruzione', async () => {
    const c = await idbGet('misura2:compatto2');
    const fuori = decodifica(c);
    return fuori.length + ' tick ricostruiti';
  }));
  righe.push(await tempo('lettura del blocco con OGGETTI', async () => {
    const v = await idbGet('misura2:oggetti');
    return v ? v.length + ' tick' : 'non letto';
  }));

  // 4. IL GIRO DEVE ESSERE ESATTO. Se un campo sparisce, il footprint perde una feature.
  const c1 = codifica([log[0], log[1], storico]);
  const d1 = decodifica(c1);
  righe.push({nome: 'FEDELTA: il giro conserva i campi?', ms: 0, esito: uguale([log[0], log[1], storico], d1)
    ? 'SI, tick per tick identici (src, mode, aggr, vol compresi)'
    : 'NO: ' + JSON.stringify(d1)});
  // E con un campo sconosciuto, che deve restare VERBATIM.
  const conExtra = Object.assign({}, log[0], {mioCampo: 42});
  righe.push({nome: 'FEDELTA: un campo sconosciuto resta?', ms: 0, esito: uguale([conExtra], decodifica(codifica([conExtra]))) ? 'SI' : 'NO'});

  // 5. Tutti i blocchi insieme: il costo di una riscrittura completa, nelle due forme.
  let tot = 0;
  for(let k = 0; k * blocco < n; k++){
    const r = await tempo('blocco compatto ' + k, async () => {
      const c = codifica(log.slice(k * blocco, (k + 1) * blocco));
      const ok = await idbPut('misura2:b:' + k, c);
      return ok ? 'scritto' : 'FALLITO';
    });
    tot += r.ms;
  }
  righe.push({nome: 'TOTALE blocchi compatti (tutti insieme)', ms: Math.round(tot * 10) / 10, esito: 'la somma di quello sopra'});

  return righe;
}, {n: N_TICK, blocco: BLOCCO});

console.log('');
console.log('MISURA 2 - IL BLOCCO IN DUE FORME (' + BLOCCO + ' tick per blocco)');
console.log('-'.repeat(78));
for(const r of esito){
  console.log(('[' + String(r.ms).padStart(8) + ' ms]  ' + r.nome).padEnd(62) + ' ' + r.esito);
}
console.log('-'.repeat(78));

await browser.close();
process.exit(0);
