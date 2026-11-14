// IL PULSANTE «AGGIORNA» NON SI ACCENDE QUANDO NON C'E' NIENTE DA AGGIORNARE.
//
// SEGNALATO dal proprietario il 14 novembre 2026: «se l'installazione è stata fatta come mai
// ancora ho il tasto aggiorna attivo sia sotto alla pagina che sopra?».
//
// MISURATO sul suo PC, con tutto gia' alla 2.2.52:
//   - il ponte serviva app.html 2.2.52 e sw.js forex-backtest-lab-v2.2.52
//   - la copia su disco (app_aggiornata) 2.2.52
//   - la cache del service worker conteneva FBL_VERSIONE='2.2.52'
//   - sw.js identico byte per byte a due richieste di fila
// Non c'era NIENTE da aggiornare, e i due avvisi erano accesi lo stesso.
//
// LA CAUSA: nessuno dei due guardava la versione DELLA PAGINA CHE STA GIRANDO. La striscia in
// basso nasce da un messaggio del service worker - un evento del suo ciclo di vita, non una
// prova di essere indietro - e il pulsante in alto compariva senza condizioni.
//
// Un avviso che compare quando non serve insegna a ignorarlo, e il giorno che serve davvero non
// lo guarda piu' nessuno. Per questo la cura non e' cosmetica.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Si sostituisce la sola risposta del ponte: e' l'unica cosa che decide.
const CON_PONTE_CHE_DICE = `((pagina, programma) => {
  window.fblPonteVersioneProgramma = async () => ({pagina, programma, da_aggiornare: false});
})`;

test('se la pagina che gira e gia quella servita dal ponte, non si e indietro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const r = await pagina.evaluate(async (finto) => {
      eval(finto)(FBL_VERSIONE, FBL_VERSIONE);          // tutto allineato
      return {versione: FBL_VERSIONE, gia: await fblSonoGiaAggiornato()};
    }, CON_PONTE_CHE_DICE);
    console.log('allineato:', JSON.stringify(r));
    assert.equal(r.gia, true,
      'con la pagina, il ponte e il programma tutti alla stessa versione non c e niente da ' +
      'aggiornare: ' + JSON.stringify(r));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('se il ponte serve una pagina PIU NUOVA, si e indietro davvero', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(async (finto) => {
      eval(finto)('99.99.99', '99.99.99');
      return {gia: await fblSonoGiaAggiornato()};
    }, CON_PONTE_CHE_DICE);
    console.log('indietro:', JSON.stringify(r));
    assert.equal(r.gia, false,
      'la cura non deve spegnere l avviso quando serve davvero: ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('se il PROGRAMMA e indietro rispetto alla pagina, l avviso resta', async () => {
  // Il caso che rompeva il collegamento con MT5: pagina nuova, eseguibile vecchio.
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(async (finto) => {
      eval(finto)(FBL_VERSIONE, '2.2.40');              // pagina a posto, programma indietro
      return {gia: await fblSonoGiaAggiornato()};
    }, CON_PONTE_CHE_DICE);
    console.log('programma indietro:', JSON.stringify(r));
    assert.equal(r.gia, false,
      'una pagina aggiornata con un eseguibile vecchio NON e "gia aggiornato": e la situazione ' +
      'in cui si rompe il collegamento con MT5. ' + JSON.stringify(r));
  } finally { await browser.close(); }
});

test('se il ponte non risponde, nel dubbio l avviso si mostra', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(async () => {
      window.fblPonteVersioneProgramma = async () => null;
      return {gia: await fblSonoGiaAggiornato()};
    });
    console.log('ponte muto:', JSON.stringify(r));
    assert.equal(r.gia, false,
      'senza risposta non si puo sapere: meglio un avviso in piu che uno in meno');
  } finally { await browser.close(); }
});

test('il pulsante in alto si NASCONDE quando non serve', async () => {
  const {browser, pagina} = await apriApp();
  try {
    const r = await pagina.evaluate(async (finto) => {
      eval(finto)(FBL_VERSIONE, FBL_VERSIONE);
      let btn = document.getElementById('fblAggiornaBtn');
      if (!btn) { btn = document.createElement('button'); btn.id = 'fblAggiornaBtn'; document.body.appendChild(btn); }
      btn.style.display = '';
      const tornato = await fblMostraPulsanteAggiorna({}, 'v' + FBL_VERSIONE);
      return {display: btn.style.display, tornato: tornato === null};
    }, CON_PONTE_CHE_DICE);
    console.log('pulsante:', JSON.stringify(r));
    assert.equal(r.display, 'none', 'il pulsante deve sparire: ' + JSON.stringify(r));
    assert.equal(r.tornato, true, 'e la funzione deve dire che non ha mostrato niente');
  } finally { await browser.close(); }
});
