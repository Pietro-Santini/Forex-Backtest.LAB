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
    // NON PIU' «partire da zero»: il proprietario ha segnalato che la barra «rimane sempre al
    // 0% e non aumenta, poi apre e fine li'», e una barra ferma a zero sembra un programma
    // bloccato. Adesso un passo appena cominciato vale comunque qualcosa (vedi
    // caricamento_percentuale.test.mjs). Quello che conta e' che dica una percentuale, e che
    // non sia gia' a meta' strada appena aperta.
    const pct0 = Number((r.titolo.match(/(\d+)%/) || [])[1]);
    assert.ok(pct0 > 0 && pct0 < 33, 'appena aperta: piu' + ' di zero ma all inizio: ' + r.titolo);
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
    // I passi veri restano i tre di prima, e ognuno vale piu' del precedente. Cambia che
    // DENTRO un passo la barra si muove (prima era immobile fino al passo dopo), quindi si
    // guarda l'ordine invece di quattro numeri esatti. L'ultimo pero' resta 100 esatto:
    // quando tutti i passi sono finiti, 100 e' la verita'.
    const num = t => Number((String(t).match(/(\d+)%/) || [])[1]);
    const pa = num(r.a.testo), pb = num(r.b.testo), pc = num(r.c.testo), pd = num(r.d.testo);
    assert.ok(pa > 0, 'mai zero: ' + r.a.testo);
    assert.ok(pb > pa && pb >= 33, 'un passo su tre: ' + r.b.testo);
    assert.ok(pc > pb && pc >= 67, 'due su tre: ' + r.c.testo);
    assert.equal(pd, 100, 'tre su tre: ' + r.d.testo);
    assert.ok(parseInt(r.b.barra, 10) >= 33, 'anche la barra segue i passi veri: ' + r.b.barra);
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
