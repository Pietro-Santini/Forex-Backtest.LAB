// MISURA (22 ottobre 2026): quanto costa davvero salvare il registro dei tick.
//
// Il proprietario ha misurato «scatto peggiore 1.264 ms» e l'ha indicato come il salvataggio del
// registro tick. La consegna prescrive i blocchi da 20.000 tick. Prima di applicare qualsiasi
// cosa si MISURA, e si misura anche l'alternativa (scrivere i tick in forma compatta), perche'
// finche' non si sa quanto costa ciascuna strada non si sceglie.
//
// NON TOCCA il ponte MT5 del proprietario: la pagina aperta e' quella di laboratorio, il
// salvataggio e' su chiavi di prova ('misura:*') e non tocca il registro vero.
//
// Uso: node laboratorio/strumenti/misura_salvataggio_tick.mjs

import {apriApp} from '../app/aiuti.mjs';

const N_TICK = 150000;      // il tetto per asset (FOOTPRINT_MAX_TICKS_PER_ASSET)
const BLOCCO = 20000;       // il blocco prescritto dalla consegna

const {browser, pagina} = await apriApp();

const esito = await pagina.evaluate(async ({n, blocco}) => {
  // Un registro di tick come quello vero: t (ms), price, side, weight, src.
  const log = [];
  for(let i = 0; i < n; i++){
    log.push({t: 1760000000000 + i * 37, price: 1.1 + (i % 500) / 100000, side: (i % 2) ? 1 : -1, weight: 1, src: 'mt5'});
  }
  const tempo = async (nome, fn) => {
    const t0 = performance.now();
    const esito = await fn();
    return {nome, ms: Math.round((performance.now() - t0) * 10) / 10, esito};
  };
  const righe = [];

  // 1. La copia strutturata di TUTTO il registro: e' il costo che blocca la pagina.
  righe.push(await tempo('copia strutturata del registro intero', async () => {
    structuredClone({EURUSD: log});
    return '150.000 tick in un oggetto';
  }));

  // 2. La scrittura di oggi: tutto il registro, tutto gli asset, ogni volta.
  righe.push(await tempo('scrittura di oggi (tutto il registro)', async () => {
    const ok = await idbPut('misura:tutto', {EURUSD: log});
    return ok ? 'scritto' : 'FALLITO';
  }));

  // 3. I blocchi da 20.000 tick: un blocco alla volta.
  let totBlocchi = 0;
  for(let k = 0; k * blocco < n; k++){
    const r = await tempo('blocco ' + k + ' (' + blocco + ' tick)', async () => {
      const ok = await idbPut('misura:blocco:' + k, log.slice(k * blocco, (k + 1) * blocco));
      return ok ? 'scritto' : 'FALLITO';
    });
    totBlocchi += r.ms;
    righe.push(r);
  }
  righe.push({nome: 'TOTALE dei blocchi (tutti insieme)', ms: Math.round(totBlocchi * 10) / 10, esito: 'la somma di quello sopra'});

  // 4. La forma COMPATTA: gli stessi tick in quattro array numerici (Float64Array).
  //    t, price, side, weight: quattro numeri per tick, niente oggetti.
  righe.push(await tempo('costruzione della forma compatta (4 array)', async () => {
    const t = new Float64Array(n), p = new Float64Array(n), s = new Float64Array(n), w = new Float64Array(n);
    for(let i = 0; i < n; i++){
      const x = log[i];
      t[i] = x.t; p[i] = x.price; s[i] = x.side; w[i] = x.weight;
    }
    return '4 array da ' + n;
  }));
  righe.push(await tempo('scrittura compatta (4 array)', async () => {
    const t = new Float64Array(n), p = new Float64Array(n), s = new Float64Array(n), w = new Float64Array(n);
    for(let i = 0; i < n; i++){
      const x = log[i];
      t[i] = x.t; p[i] = x.price; s[i] = x.side; w[i] = x.weight;
    }
    const ok = await idbPut('misura:compatto', {t, p, s, w});
    return ok ? 'scritto' : 'FALLITO';
  }));

  // 5. E la rilettura (conta: il registro va riletto a ogni riapertura).
  righe.push(await tempo('rilettura del registro intero', async () => {
    const v = await idbGet('misura:tutto');
    return v && v.EURUSD ? v.EURUSD.length + ' tick' : 'non letto';
  }));
  righe.push(await tempo('rilettura compatta', async () => {
    const v = await idbGet('misura:compatto');
    return v && v.t ? v.t.length + ' tick' : 'non letto';
  }));

  // 6. La ricostruzione degli oggetti dalla forma compatta: il costo che si paga alla riapertura.
  righe.push(await tempo('ricostruzione degli oggetti dalla forma compatta', async () => {
    const v = await idbGet('misura:compatto');
    const fuori = [];
    for(let i = 0; i < v.t.length; i++){
      fuori.push({t: v.t[i], price: v.p[i], side: v.s[i], weight: v.w[i], src: 'mt5'});
    }
    return fuori.length + ' tick ricostruiti';
  }));

  // Pulizia: le chiavi di misura non devono restare nel database di prova.
  for(const k of ['misura:tutto', 'misura:compatto']){ try{ await idbDel(k); }catch(e){} }
  for(let k = 0; k * blocco < n; k++){ try{ await idbDel('misura:blocco:' + k); }catch(e){} }

  return righe;
}, {n: N_TICK, blocco: BLOCCO});

console.log('');
console.log('MISURA DEL SALVATAGGIO DEL REGISTRO TICK (' + N_TICK + ' tick)');
console.log('-'.repeat(78));
for(const r of esito){
  const ms = String(r.ms);
  console.log(('[' + ms.padStart(8) + ' ms]  ' + r.nome).padEnd(70) + ' ' + r.esito);
}
console.log('-'.repeat(78));

await browser.close();
process.exit(0);
