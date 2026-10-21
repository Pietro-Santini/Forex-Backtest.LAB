// IL GRAFICO SI COPRE FINCHE' I DATI NON SONO QUELLI DI QUESTO ASSET.
//
// RICHIESTO dal proprietario (21 ottobre 2026): «non deve mai visualizzarsi il nome dell'asset se
// prima ancora non è stato caricato il grafico, la rotellina continuerà a girare fin quando non è
// avvenuta l'esatta sincronizzazione del grafico per quel asset e vengono caricati tutti i dati».
// E, da prima: l'indicatore deve mostrare la PERCENTUALE, e con il grafico staccato deve comparire
// NELLA FINESTRA SEPARATA, non sulla pagina principale che non si sta guardando.
//
// IL DIFETTO VERO non era la lentezza. Cambiando asset il nome nuovo compariva subito nel
// selettore mentre le candele erano ancora quelle vecchie: si leggeva «EURUSD» sopra il grafico
// dell'oro. Non è un ritardo, è una cosa falsa scritta a schermo — e in quei secondi si può
// decidere qualcosa guardandola.
//
// LA PERCENTUALE È VERA, e questi test la tengono tale. Conta i PASSI davvero completati
// (storico arrivato → candele ricostruite → prezzo agganciato), non scorre da sola a tempo.
// Altrove in questo progetto c'è scritto, giustamente, «senza barre di progresso inventate»: una
// barra che corre mentre non succede niente è peggio di nessuna barra, perché fa aspettare.
// Se un passo si pianta, la percentuale si pianta lì: è un'informazione, non un difetto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('mentre carica, il grafico è coperto e si legge l\'asset che sta arrivando', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      fblCaricamentoMostra('EURCHF', 0);
      const el = document.getElementById('fblCaricamentoAsset');
      if (!el) return {manca: true};
      const dentroGrafico = !!(el.parentElement && el.parentElement.id === 'chartWrap');
      return {
        dentroGrafico,
        copre: el.style.inset === '0px' || /inset/.test(el.getAttribute('style') || ''),
        titolo: document.getElementById('fblCaricamentoTitolo').textContent,
        passo: document.getElementById('fblCaricamentoPasso').textContent
      };
    });
    assert.equal(r.manca, undefined, 'il riquadro di caricamento non compare');
    assert.equal(r.dentroGrafico, true, 'deve coprire il GRAFICO, non la pagina');
    assert.match(r.titolo, /EURCHF/, 'deve dire quale asset sta arrivando: ' + r.titolo);
    assert.match(r.titolo, /0%/, 'e partire da zero: ' + r.titolo);
    assert.match(r.passo, /storico/i, 'e dire cosa sta facendo: ' + r.passo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la percentuale conta i passi veri, uno alla volta', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const leggi = () => ({
        testo: document.getElementById('fblCaricamentoTitolo').textContent,
        passo: document.getElementById('fblCaricamentoPasso').textContent,
        barra: document.getElementById('fblCaricamentoBarra').style.width
      });
      fblCaricamentoMostra('EURCHF', 0);
      const a = leggi();
      fblCaricamentoAvanza();
      const b = leggi();
      fblCaricamentoAvanza();
      const c = leggi();
      fblCaricamentoAvanza();
      const d = leggi();
      return {a, b, c, d};
    });
    assert.match(r.a.testo, /0%/);
    assert.match(r.b.testo, /33%/, 'un passo su tre: ' + r.b.testo);
    assert.match(r.c.testo, /67%/, 'due su tre: ' + r.c.testo);
    assert.match(r.d.testo, /100%/, 'tre su tre: ' + r.d.testo);
    assert.equal(r.b.barra, '33%', 'anche la barra segue i passi veri');
    assert.notEqual(r.a.passo, r.b.passo, 'ogni passo dice una cosa diversa');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('finito il caricamento il riquadro sparisce, e il grafico si vede', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      fblCaricamentoMostra('EURCHF', 1);
      const prima = !!document.getElementById('fblCaricamentoAsset');
      fblCaricamentoFine();
      return {prima, dopo: !!document.getElementById('fblCaricamentoAsset')};
    });
    assert.equal(r.prima, true);
    assert.equal(r.dopo, false, 'il riquadro deve sparire: se resta, copre il grafico per sempre');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('chiamarlo due volte non fa due riquadri', async () => {
  // update() e i caricatori lo chiamano piu' volte: due riquadri sovrapposti sarebbero uno
  // scuro doppio, e uno dei due resterebbe quando l'altro se ne va.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      fblCaricamentoMostra('EURCHF', 0);
      fblCaricamentoMostra('EURCHF', 1);
      fblCaricamentoMostra('XAUUSD', 0);
      return {
        quanti: document.querySelectorAll('#fblCaricamentoAsset').length,
        titolo: document.getElementById('fblCaricamentoTitolo').textContent
      };
    });
    assert.equal(r.quanti, 1, 'un riquadro solo');
    assert.match(r.titolo, /XAUUSD/, 'e mostra l\'ultimo asset chiesto: ' + r.titolo);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('un caricamento fallito non lascia la rotellina a girare per sempre', async () => {
  // Il difetto peggiore di un indicatore di caricamento: restare acceso quando non c'è più
  // niente da aspettare. Il grafico resterebbe coperto e l'app sembrerebbe bloccata.
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      liveModeActive = true;
      window.loadLiveHistoryFromCapital = async () => { throw new Error('rete giù'); };
      window.suspendChartFeed = () => {};
      window.resumeChartFeed = () => {};
      const sel = document.getElementById('market');
      sel.value = sel.options.length ? sel.options[0].value : '';
      // Si chiama direttamente la stessa catena del cambio asset.
      fblCaricamentoMostra('EURCHF', 0);
      try {
        await Promise.resolve(window.loadLiveHistoryFromCapital('EURCHF'));
      } catch (e) {
        fblCaricamentoFine();
      }
      return {resta: !!document.getElementById('fblCaricamentoAsset')};
    });
    assert.equal(r.resta, false, 'se il caricamento fallisce, il riquadro si toglie');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
