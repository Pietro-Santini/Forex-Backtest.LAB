// I BLOCCHI DI TICK CHE NESSUNO LEGGE PIU' SI CANCELLANO ALL'AVVIO.
//
// MISURATO sul PC del proprietario il 18 novembre 2026: 799 MB di file blob in 4.779 file, e nel
// registro solo 339 chiavi - di cui 243 blocchi di tick del footprint (`ftick:`). I tetti che il
// proprietario ha deciso il 26 ottobre (3 giorni, 150.000 tick per asset) ne ammettono 7-8 per
// asset: ce n'erano trenta volte tanti.
//
// CAUSA: `st.daCancellare` vive solo in memoria, l'indice su disco contiene solo `base` e `len`.
// Un blocco tagliato dal tetto e una chiusura prima del salvataggio dopo = quel blocco resta su
// disco per sempre, fuori dall'indice, e nessuno lo legge mai piu'.
//
// Le due prove di controllo sono quelle che contano davvero, perche' questa e' una funzione che
// CANCELLA: senza indice non deve toccare niente, e un blocco vivo non si tocca mai.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {apriApp, RADICE} from './aiuti.mjs';

// Tre blocchi vivi (l'indice li nomina) e tre orfani (l'indice non li nomina).
const PREPARA = `(async () => {
  for(const k of (await idbChiavi())||[]) if(k.indexOf('ftick:')===0) await idbDel(k);
  for(const n of [10,11,12]) await idbPut('ftick:EURUSD:'+n, {finto:true, n});
  for(const n of [0,1,9])    await idbPut('ftick:EURUSD:'+n, {finto:true, n});   // orfani
  await idbPut('ftick:XAUUSD:7', {finto:true});                                  // asset non nell'indice
  await idbPut('ftickIndice', {EURUSD:{base:10, len:[20000,20000,20000]}});
  const prima=((await idbChiavi())||[]).filter(k=>k.indexOf('ftick:')===0).length;
  return prima;
})()`;

const QUALI = `(async () => ((await idbChiavi())||[]).filter(k=>k.indexOf('ftick:')===0).sort())()`;

test('i blocchi fuori dall indice si cancellano, quelli vivi restano', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const prima = await pagina.evaluate(PREPARA);
    assert.equal(prima, 7, 'la preparazione deve mettere 7 blocchi: ne ha messi ' + prima);
    const buttati = await pagina.evaluate(`fblTickPulisciOrfani()`);
    const restano = await pagina.evaluate(QUALI);
    assert.equal(buttati, 4, 'doveva cancellare i 4 orfani: ne ha cancellati ' + buttati);
    assert.deepEqual(restano, ['ftick:EURUSD:10','ftick:EURUSD:11','ftick:EURUSD:12'],
      'devono restare solo i tre blocchi che l\'indice nomina: restano ' + JSON.stringify(restano));
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('CONTROLLO: senza indice non si cancella NIENTE', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    await pagina.evaluate(PREPARA);
    const r = await pagina.evaluate(async () => {
      await idbDel('ftickIndice');                       // indice assente (o lettura fallita)
      const buttati = await fblTickPulisciOrfani();
      return {buttati, quanti: ((await idbChiavi())||[]).filter(k=>k.indexOf('ftick:')===0).length};
    });
    assert.equal(r.buttati, 0, 'senza indice non deve cancellare niente: ne ha cancellati ' + r.buttati);
    assert.equal(r.quanti, 7, 'tutti i blocchi devono essere ancora al loro posto');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('CONTROLLO: una finestra duplicata non cancella niente', async () => {
  const {browser, pagina, errori} = await apriApp({query:'?pipSlot=2'});
  try{
    await pagina.evaluate(PREPARA);
    const r = await pagina.evaluate(async () => {
      const buttati = await fblTickPulisciOrfani();
      return {slot: (typeof PIP_SLOT!=='undefined'?PIP_SLOT:null), buttati,
              quanti: ((await idbChiavi())||[]).filter(k=>k.indexOf('ftick:')===0).length};
    });
    assert.ok(r.slot>0, 'la finestra di prova deve essere una duplicata: PIP_SLOT=' + r.slot);
    assert.equal(r.buttati, 0, 'una duplicata non cancella niente dal disco');
    assert.equal(r.quanti, 7, 'i blocchi devono essere tutti ancora al loro posto');
  } finally { await browser.close(); }
  assert.deepEqual(errori, [], 'niente errori in pagina');
});

test('la pulizia e agganciata all avvio, subito dopo la lettura dell indice', () => {
  const testo = fs.readFileSync(path.join(RADICE, 'app.html'), 'utf8');
  const i = testo.indexOf('blocchiTick=await fblTickCaricaBlocchi()');
  const j = testo.indexOf('await fblTickPulisciOrfani()', i);
  assert.ok(i > 0, 'il caricamento dei blocchi deve esserci');
  assert.ok(j > i && j - i < 400,
    'la pulizia deve stare subito dopo il caricamento dei blocchi, non altrove: distanza ' + (j - i));
});
