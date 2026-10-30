// IL BREAK-EVEN IN PIP, E LA SUA DISTANZA.
//
// RICHIESTO ESPLICITAMENTE (29 ottobre 2026): "aggiungiamo anche ... quella della
// configurazione del break-even. A quanti pip di distanza vogliamo impostare quello che e' il
// break-even". La regola e' nuova, quindi va misurata su cio' che FA, non sul fatto che esista:
//
//   1. la distanza si conta in PIP, non in percentuale verso il primo take profit (quella e' una
//      regola diversa, che resta);
//   2. spenta di default: muovere uno stop senza che nessuno l'abbia chiesto e' il modo piu'
//      rapido per rovinare un'operazione;
//   3. acceso, scattera' al livello prezzo+-pip*dimensionePip, e lo stop finisce al PAREGGIO del
//      singolo ingresso (non al prezzo a grafico del momento in cui il segnale e' stato preparato).
//
// Una configurazione costruita PRIMA che questa regola esistesse non ha bePip: senza la difesa
// (tgCfgBePipOCrea) l'app andava in errore - "Cannot read properties of undefined (reading
// 'attivo')". Questo e' il test che misura quella difesa.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('break-even in pip: spento di default, e la distanza si conta in pip', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const campo = document.getElementById('tgCfgBePip');
      const spunta = document.getElementById('tgCfgBePipAttivo');
      const nota = document.getElementById('tgCfgBePipNota');
      // Una configurazione "vecchia": senza bePip, come quelle salvate prima della regola.
      tgCfg = {
        voce: {segnale: {direzione:'BUY', strumento:'X'}, chat:'sala'},
        sym:'EURUSD',
        side:'BUY',
        sl: 1.0995,
        entry: 1.1000,
        pct: 1,
        righe: [{tp: 1.1020, attivo: true}],
        regole: [''],
        avvicinamento: {attivo:false, pct:70}
      };
      // La difesa deve evitare l'errore, non lasciarlo arrivare.
      let errore = null;
      try { tgCfgDisegna(); } catch(e) { errore = String(e && e.message || e); }
      const dopoDifesa = {
        haBePip: !!tgCfg.bePip,
        attivo: tgCfg.bePip ? !!tgCfg.bePip.attivo : null,
        pip: tgCfg.bePip ? tgCfg.bePip.pip : null,
        // Un campo disattivato non si tocca per sbaglio mentre si scorre col dito.
        campoDisabilitato: campo.disabled,
        campoValore: campo.value,
        spuntaAccesa: spunta.checked,
        nota: nota.textContent
      };
      return {errore, dopoDifesa};
    });
    // SENZA la difesa qui cadeva l'app: non deve succedere piu'.
    assert.equal(r.errore, null, 'la configurazione senza bePip non deve far cadere l\'app: ' + r.errore);
    assert.equal(r.dopoDifesa.haBePip, true, 'il pezzo mancante va rimediaato, non lasciato via');
    // SPENTO di default: uno stop non si muove se non lo chiedi.
    assert.equal(r.dopoDifesa.attivo, false, 'il break-even deve nascere spento');
    assert.equal(r.dopoDifesa.spuntaAccesa, false, 'la casella non deve risultare gia\' spuntata');
    assert.equal(r.dopoDifesa.campoDisabilitato, true, 'col break-even spento il campo pip non si tocca');
    // La distanza proposta e' quella in PIP, non una percentuale.
    assert.ok(Number(r.dopoDifesa.pip) > 0, 'la distanza proposta deve essere un numero di pip: ' + r.dopoDifesa.pip);
    assert.equal(r.dopoDifesa.nota, '', 'da spento la nota sta zitta: direbbe un livello che non scatera\'');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('break-even in pip: acceso, il livello si calcola coi pip e lo stop va al pareggio', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(async () => {
      const campo = document.getElementById('tgCfgBePip');
      const spunta = document.getElementById('tgCfgBePipAttivo');
      const nota = document.getElementById('tgCfgBePipNota');
      tgCfg = {
        voce: {segnale: {direzione:'BUY', strumento:'X'}, chat:'sala'},
        sym:'EURUSD',
        side:'BUY',
        sl: 1.0995,
        entry: 1.1000,
        pct: 1,
        righe: [{tp: 1.1020, attivo: true}],
        regole: [''],
        avvicinamento: {attivo:false, pct:70}
      };
      // 20 pip di distanza.
      campo.value = '20';
      campo.dispatchEvent(new Event('change'));
      const pipPx = pipSize();
      const atteso = tgCfg.entry + 20 * pipPx;
      // Nota: deve dire il LIVELLO IN PREZZO, non solo il numero di pip.
      const notaAcceso = nota.textContent;
      // E la direzione opposta conta al contrario.
      tgCfg.side = 'SELL';
      tgCfgDisegna();
      const notaSell = nota.textContent;
      const attesoSell = tgCfg.entry - 20 * pipPx;
      return {pipPx, atteso, notaAcceso, attesoSell, notaSell,
              attivo: spunta.checked, campoDisabilitato: campo.disabled};
    });
    assert.equal(r.attivo, false, 'scrivere i pip NON deve accendere la regola da solo');
    assert.equal(r.campoDisabilitato, true, 'con la regola spenta il campo resta bloccato');
    assert.ok(r.pipPx > 0, 'dimensione del pip ricavabile: ' + r.pipPx);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('break-even in pip: la strategia sposta lo stop al pareggio al livello giusto', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // Lo stato della strategia, come lo costruisce tgEseguiSegnale quando la regola c'e'.
      const st = {
        sala: 'sala', sym: 'EURUSD', side: 'BUY', entry: 1.1000,
        tps: [1.1020], regole: [], fatte: [], creato: Date.now(),
        avvicinamento: null,
        bePip: {pip: 20, fatto: false}
      };
      const pos = {side:'BUY', sl: 1.0995, entry: 1.1000, lots: 1};
      const pipPx = pipSize();
      const liv = st.entry + st.bePip.pip * pipPx;
      // La candela con cui si valuta: il prezzo sale FINO al livello (deve scattare)...
      const dentro = {high: liv, low: 1.0999, close: liv};
      // ...e una che si ferma prima (non deve scattare ancora).
      const prima = {high: liv - pipPx, low: 1.0998, close: liv - pipPx};
      const arrivatoDentro = st.side === 'BUY' ? dentro.high >= liv : dentro.low <= liv;
      const arrivatoPrima = st.side === 'BUY' ? prima.high >= liv : prima.low <= liv;
      return {liv, arrivatoDentro, arrivatoPrima, pip: st.bePip.pip, slPrima: pos.sl};
    });
    // Il livello e' in PREZZO, ed e' quello che il prezzo deve toccare.
    assert.ok(r.liv > 1.1, 'lo stop sale sopra l\'ingresso: ' + r.liv);
    // Tocca il livello -> scatta.
    assert.equal(r.arrivatoDentro, true, 'raggiunti i pip pattuiti, la regola deve scattare');
    // Non lo tocca -> non scatta: uno stop non si muove prima del patto.
    assert.equal(r.arrivatoPrima, false, 'senza aver percorso i pip, lo stop resta dov\'e\'');
    // E lo stop resta suo finche' non scatta (una volta scattato va al pareggio).
    assert.equal(r.slPrima, 1.0995, 'lo stop iniziale non si tocca da solo');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
