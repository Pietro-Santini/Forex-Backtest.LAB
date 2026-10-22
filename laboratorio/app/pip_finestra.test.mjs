// LA FINESTRA SEPARATA (PIP) DEVE ESSERE UNA FINESTRA DELL'APP, NON UNA PAGINA WEB.
//
// RICHIESTA del proprietario (22 ottobre 2026): «in modalita' pip viene mostrata la barra delle
// informazioni del sito, con about blank, e quella deve essere tolta ... questa deve essere una,
// praticamente, una seconda schermata della STESSA applicazione, non e' un qualcosa collegato via
// web ... me ne accorgo anche dal fatto che la finestra non ha il logo come la pagina madre».
//
// La finestra era un popup aperto su una pagina VUOTA (window.open('')): il browser le metteva la
// barra con "about:blank" e nessun titolo/icona dell'app. Ora:
//  - si usa la Document Picture-in-Picture NATIVA: una finestra senza barra del browser, senza
//    indirizzo e senza "about:blank", con lo STESSO documento dentro (stato identico per costruzione);
//  - se l'API non c'e' (o il browser la rifiuta), si cade sul popup di prima, ma con l'icona
//    dell'app e una barra in alto col logo e il nome: anche il fallback si VEDE come l'app.
//
// Come si prova che il test serve: prima di queste modifiche nella finestra non c'era nessuna
// barra col logo e nessuna icona, e la finestra era il popup "about:blank" -> il test va rosso.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp, PREPARA_BTC} from './aiuti.mjs';

test('la finestra separata si apre come finestra NATIVA dell\'app, col logo dentro', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA_BTC);
    await pagina.waitForTimeout(200);

    await pagina.click('#floatChartBtn');
    await pagina.waitForTimeout(900);

    const stato = await pagina.evaluate(() => ({
      aperta: floatingChartActive(),
      nativa: !!floatingWinPip,
      eQuellaNativa: !!(window.documentPictureInPicture && window.documentPictureInPicture.window) && window.documentPictureInPicture.window === floatingWin,
      barra: !!(floatingDoc && floatingDoc.getElementById('fblPipBar')),
      logo: !!(floatingDoc && floatingDoc.querySelector('#fblPipBar img')),
      nomeApp: !!(floatingDoc && /Backtest/.test(floatingDoc.getElementById('fblPipBar') ? floatingDoc.getElementById('fblPipBar').textContent : '')),
      icona: !!(floatingDoc && floatingDoc.querySelector('link[rel="icon"]')),
      stato: document.getElementById('status').textContent
    }));

    assert.equal(stato.aperta, true, 'la finestra separata non si e\' aperta');
    assert.equal(stato.barra, true, 'nella finestra non c\'e\' la barra col logo dell\'app: sembra una pagina web');
    assert.equal(stato.logo, true, 'la barra della finestra non ha il logo dell\'app');
    assert.equal(stato.nomeApp, true, 'la barra della finestra non ha il nome dell\'app');
    assert.equal(stato.icona, true, 'la finestra non ha l\'icona dell\'app: il titolo del browser mostra la pagina vuota');
    // Se il browser ha concesso la Picture-in-Picture nativa, la finestra DEVE essere quella:
    // e' l'unica che non ha la barra del browser con "about:blank".
    if (stato.nativa) {
      assert.equal(stato.eQuellaNativa, true, 'la finestra non e\' la Picture-in-Picture nativa');
    }
    assert.match(stato.stato, /finestra separata|Picture-in-Picture/, 'il messaggio deve dire che finestra e\' aperta: ' + stato.stato);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('senza la Picture-in-Picture nativa la finestra di riserva mostra lo stesso logo', async () => {
  // Se l'API non c'e' (Firefox, Safari, un browser che la rifiuta) la finestra deve comunque
  // sembrare dell'app: la barra col logo dentro e l'icona dell'app nel titolo.
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA_BTC);
    await pagina.evaluate(() => {
      try { Object.defineProperty(window, 'documentPictureInPicture', {value: undefined, configurable: true}); } catch (e) {}
    });
    await pagina.waitForTimeout(200);

    await pagina.click('#floatChartBtn');
    await pagina.waitForTimeout(900);

    const stato = await pagina.evaluate(() => ({
      aperta: floatingChartActive(),
      nativa: !!floatingWinPip,
      barra: !!(floatingDoc && floatingDoc.getElementById('fblPipBar')),
      logo: !!(floatingDoc && floatingDoc.querySelector('#fblPipBar img')),
      icona: !!(floatingDoc && floatingDoc.querySelector('link[rel="icon"]'))
    }));

    assert.equal(stato.aperta, true, 'la finestra di riserva non si e\' aperta');
    assert.equal(stato.nativa, false, 'senza l\'API non deve fingere di essere la finestra nativa');
    assert.equal(stato.barra, true, 'la finestra di riserva non ha la barra col logo');
    assert.equal(stato.logo, true, 'la finestra di riserva non ha il logo');
    assert.equal(stato.icona, true, 'la finestra di riserva non ha l\'icona dell\'app');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
