// BANCO DI PROVA — IL NOME DEL MODELLO DI DISEGNO NON VIENE SALVATO.
//
// SEGNALATO dal proprietario (16 novembre 2026):
//   «ATTENZIONE succede troppe volte che non mi permette di salvare il nome del modello, me lo fa
//    scrivere ma quando lo vado a salvare non me lo salva, sia per i disegni normali delle linee che
//    per i rettangoli che per i ritracciamenti di fibonacci, risolviamo assolutamente, quelli devono
//    sempre rimanere in memoria e non devono essere tolti né modificati in futuro da parte
//    dell'utente.»
//
// DOVE STA IL PERCORSO NEL SORGENTE (app.html, letto, non esecuito — numeri di oggi):
//   - il campo del nome è l'<input data-role="input"> della finestra appPrompt (riga 12650),
//     aperta da saveCurrentDrawingAsTemplate (riga 11622) e dal salvataggio del modello Fibonacci
//     (riga 44862). Sotto il campo, la lista dei nomi già usati (data-role="suggerimenti",
//     riga 12649) e la domanda di sovrascrittura sì/no (chiediNomeModello, riga 11593);
//   - linea/rettangolo (e qualunque disegno selezionato): menu "Modello ⌄" (#drawTemplateBtn,
//     riga 4270) → "💾 Salva come..." (#drawTemplateSaveAs, riga 4272) → saveCurrentDrawingAsTemplate
//     (riga 11622) → localStorage 'fbtDrawingTemplates_v1' (riga 11491);
//   - fibonacci: dal modale ⚙️ del disegno (openFibSettingsModal, riga 11911) → "Modello Fib ⌄"
//     (#fibTemplateBtn, riga 3016) → "💾 Salva come..." (#fibTemplateSaveAs, riga 3018) →
//     localStorage 'fbtFibTemplates_v1' (riga 11791);
//   - il nome NON è un campo del disegno: l'oggetto disegno nasce a riga 34709 senza alcun campo
//     "nome", e il suo testo è un altro campo (d.text). Il nome sta in una chiave localStorage
//     SEPARATA dalla memoria dei disegni (assetDrawings). Resta così: il nome è del MODELLO.
//
// QUESTO BANCO MISURA il comportamento, non il testo del sorgente. I numeri sono quelli delle
// sezioni qui sotto:
//   1. PROVA DI CONTROLLO: il disegno si crea davvero sul canvas e la finestra del nome si apre
//      davvero (senza questa, "zero" non significherebbe niente — misurerebbe il vuoto);
//   2. il nome scritto per la LINEA finisce nella memoria (localStorage) e si vede nel menu;
//   3. lo stesso per il RETTANGOLO;
//   4. lo stesso per il FIBONACCI, dalla sua strada;
//   5. il nome sopravvive alla ricarica della pagina;
//   6. PROVA DI CONTROLLO INVERSA: annullando la finestra del nome non deve comparire niente;
//   7. UN NOME GIÀ USATO NON È PIÙ UN RIFIUTO: compare la domanda di sovrascrittura con sì/no
//      (richiesto dal proprietario il 16 novembre 2026: «viene chiesto se sovrascrivere il modello
//      salvato precedentemente con quel nome... e l'utente tra sì o no. Classico.»);
//   8. i NOMI GIÀ USATI si vedono dentro la finestra del nome mentre si scrive, ognuno con la
//      famiglia da cui viene (disegno generico oppure Fibonacci: due famiglie, un nome solo);
//   9. col SÌ il modello con quel nome è il NUOVO (stesso nome, contenuto nuovo);
//  10. col NO il modello vecchio resta INTATTO: a proteggerlo è il «no», non più il rifiuto;
//  11. nessun percorso rinomina: dopo la sovrascrittura il nome è identico a prima;
//  12. anche la strada Fibonacci chiede la sovrascrittura e la applica;
//  13. il Fibonacci salvato dalla strada GENERICA porta TUTTI i campi dello strumento (levels/opts),
//      altrimenti il modello c'è ma è inutilizzabile;
//  14. il nome non si deve poter cambiare dall'utente (regola del proprietario del 16 novembre
//      2026): né campo, né modifica da tastiera. Il MODELLO resta invece cancellabile (🗑).
//
// La prova che misurava il RIFIUTO («un nome GIÀ USATO viene rifiutato») NON Esiste più: il
// proprietario ha chiesto che il rifiuto sparisca e torni la domanda con sì/no. Quello che quella
// prova difendeva — il modello salvato prima non si cancella per sbaglio — ora lo difende la
// prova 10: a proteggerlo è il «no», non più il rifiuto.
//
// TRAPPOLE RISPETTATE (sono già costate care):
//   - page.evaluate(fn, arg) prende UN SOLO argomento: tutte le funzioni qui sotto ne usano uno;
//   - il grafico sta SOTTO il bordo della finestra: senza scrollIntoView() il clic non arriva al
//     canvas e il disegno non nasce (misurato: top 855 in una finestra alta 850). Per ogni punto
//     si controlla che sotto il cursore ci sia davvero #chart;
//   - dopo il primo clic si controlla placingStep===1, altrimenti la prova misurerebbe il vuoto;
//   - "non risponde mai" si scrive Infinity, non 999.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

// Le due chiavi dove oggi finisce il nome (lette dal sorgente, non inventate).
const CHIAVE_DISEGNI = 'fbtDrawingTemplates_v1';
const CHIAVE_FIB = 'fbtFibTemplates_v1';

// 180 candele piatte sullo stesso asset: i modelli non sono per asset, ma la pagina deve mostrare
// la stessa asset con cui si disegna. Prezzo attorno a 100: i punti scelti sotto stanno dentro la
// scala visibile, così il disegno si vede e si afferra davvero.
const PREPARA = () => {
  const T0 = Date.UTC(2026, 9, 20, 10, 0, 0);
  const R = [];
  for (let i = 0; i < 180; i++) R.push({date: new Date(T0 + i * 60000).toISOString(),
    open: 100, high: 100.8, low: 99.2, close: 100.1, volume: 10});
  rows = R; baseRows = R; idx = R.length - 1; viewEnd = R.length - 1;
  if (typeof rowsAssetKey !== 'undefined') rowsAssetKey = 'EURUSD';
  currentAssetKey = 'EURUSD';
  liveModeActive = false; mt5Connected = false;
  positions = []; trades = []; active = null; pendingOrders = [];
  drawings = []; selectedDrawing = null; pendingDrawing = null; placingStep = 0;
  try { draw(); } catch (e) {}
  // Quante candele si vedono davvero: se questo è zero, qualunque misura dopo è vuoto.
  return {candeleInVista: typeof visibleCount !== 'undefined' ? visibleCount : null,
          asset: currentAssetKey, modo: currentMode()};
};

// Punto sicuro dentro l'area di disegno del grafico (non sull'asse prezzi a destra, non
// sull'asse tempo in basso, non sui controlli in alto a sinistra). fx/fy sono frazioni
// dell'area del canvas.
// ESCLUSIONE DELLE ZONE CHE NON SONO IL CANVAS: il punto del clic deve stare dentro il canvas.
// Misurato: con i valori di default una delle finestre di prova finiva dentro la tabella qui sotto
// (elementFromPoint = TD) e il disegno non nasceva, quindi la prova misurava il vuoto. fx/fy sono
// frazioni dell'area di disegno; -1..00 è il bordo sinistro/basso esclusi.
async function puntoSulGrafico(pagina, fx, fy) {
  // IL GRAFICO STA SOTTO IL BORDO DELLA FINESTRA (misurato: top 855, viewport alto 850).
  // Senza questa riga il clic non arriva a niente e la prova misurerebbe il vuoto invece del
  // difetto. È la prima trappola che ha fatto cadere tutte le prove al primo giro.
  await pagina.evaluate(() => document.getElementById('chart').scrollIntoView({block: 'center'}));
  await pagina.waitForTimeout(120);
  const box = await pagina.locator('#chart').boundingBox();
  if (!box) throw new Error('canvas #chart non trovato');
  // SOTTO IL PUNTO CI DEVE ESSERE IL CANVAS, e non basta sperarlo: si CHIEDE al browser
  // (elementFromPoint). Il punto richiesto si prova per primo; se lì c'è altro (una tabella che
  // copre una fascia del grafico, un pannello, il bordo dell'asse) si cerca il punto VALIDO PIÙ
  // VICINO a quello richiesto, scandendo una griglia.
  // MISURATO: nella prima prova del file il punto a 0.42/0.42 cadeva su una cella TD e la prova
  // moriva dicendo «sotto i clic non c'è il canvas» — un rosso del banco, non dell'app: il disegno
  // nasce benissimo appena il clic arriva al canvas (le altre dieci prove lo dimostrano).
  // Il punto scelto resta ANCH'ESSO verificato: se nessun punto della griglia è il canvas, il
  // chiamante fallisce coi numeri in mano invece di misurare il vuoto.
  const validi = [];
  for (let i = 0; i <= 16; i++) {
    for (let j = 0; j <= 16; j++) {
      const ux = Math.min(0.94, Math.max(0.06, i / 16));
      const uy = Math.min(0.94, Math.max(0.06, j / 16));
      validi.push([ux, uy]);
    }
  }
  // Ordine: prima il punto richiesto, poi gli altri dal più vicino al più lontano a quello richiesto.
  const dist = ([ux, uy]) => (ux - fx) * (ux - fx) + (uy - fy) * (uy - fy);
  const ordinati = validi.slice().sort((a, b) => dist(a) - dist(b));
  let ultimo = null;
  for (const [ux, uy] of ordinati) {
    const x = Math.round(box.x + box.width * ux);
    const y = Math.round(box.y + box.height * uy);
    const sotto = await pagina.evaluate(([px, py]) => {
      const el = document.elementFromPoint(px, py);
      return el ? (el.id || el.className || el.tagName) : null;
    }, [x, y]);
    ultimo = {x, y, box, sotto, fx: ux, fy: uy};
    if (String(sotto) === 'chart') return ultimo;
  }
  return ultimo;
}

// Crea un disegno col percorso VERO dell'utente: strumento attivo + due clic sul canvas.
// "strumento" è 'trendline' (linea normale), 'rectangle' o 'fib'.
async function disegna(pagina, strumento) {
  await pagina.evaluate((s) => { setDrawTool(s); }, strumento);
  const p1 = await puntoSulGrafico(pagina, 0.42, 0.42);
  const p2 = await puntoSulGrafico(pagina, 0.62, 0.62);
  if (String(p1.sotto) !== 'chart' || String(p2.sotto) !== 'chart') {
    throw new Error('sotto i clic non c\'è il canvas: ' + JSON.stringify({p1: p1.sotto, p2: p2.sotto}));
  }
  // I due punti devono essere DIVERSI: se il ripiego li portasse sullo stesso pixel, il disegno
  // nascerebbe di dimensione zero e la prova misurerebbe qualcosa che non è un disegno.
  const scarto = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
  if (scarto < 20) {
    throw new Error('i due clic sono troppo vicini per essere un disegno: ' + JSON.stringify({p1, p2}));
  }
  await pagina.mouse.click(p1.x, p1.y);
  await pagina.waitForTimeout(80);
  // Dopo il primo click placingStep deve essere 1: se non lo è, il primo punto non è stato preso
  // e la prova misurerebbe il vuoto. Sibutta subito, con il numero, invece di tirare a indovinare.
  const dopoPrimo = await pagina.evaluate(() => ({placingStep, pending: !!pendingDrawing}));
  if (dopoPrimo.placingStep !== 1) {
    throw new Error('il primo clic non è stato preso: ' + JSON.stringify(dopoPrimo));
  }
  await pagina.mouse.click(p2.x, p2.y);
  await pagina.waitForTimeout(120);
  const stato = await pagina.evaluate(() => ({
    quanti: drawings.length,
    tipi: drawings.map(d => d.type),
    selezionato: selectedDrawing ? selectedDrawing.type : null,
    haPunti: selectedDrawing ? !!(selectedDrawing.p1 && selectedDrawing.p2) : false
  }));
  return {p1, p2, stato};
}

// Legge le due memorie dei nomi e il testo del menu modelli (stato della pagina, non il sorgente).
async function leggiNomi(pagina) {
  return pagina.evaluate(([k1, k2]) => {
    const leggi = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
    return {
      disegni: leggi(k1),
      fib: leggi(k2),
      menuDisegniTesto: (document.getElementById('drawTemplateList') || {}).textContent || '',
      menuFibTesto: (document.getElementById('fibTemplateList') || {}).textContent || '',
      stato: (document.getElementById('status') || {}).textContent || ''
    };
  }, [CHIAVE_DISEGNI, CHIAVE_FIB]);
}

// Percorso utente del nome: menu → "Salva come..." → scrive → Ok. Ritorna cosa si vede dopo.
async function salvaModelloDisegno(pagina, nome) {
  await pagina.locator('#drawTemplateBtn').click();
  await pagina.locator('#drawTemplateSaveAs').click();
  // La finestra del nome si deve aprire davvero: senza questo controllo un "non salva" potrebbe
  // significare solo che la finestra non si è aperta.
  const campo = pagina.locator('.appConfirmOverlay [data-role="input"]').last();
  await campo.waitFor({timeout: 5000});
  await campo.fill(nome);
  await pagina.locator('.appConfirmOverlay [data-role="ok"]').last().click();
  await pagina.waitForTimeout(150);
  return leggiNomi(pagina);
}

async function salvaModelloFib(pagina, nome) {
  await pagina.locator('#fibTemplateBtn').click();
  await pagina.locator('#fibTemplateSaveAs').click();
  const campo = pagina.locator('.appConfirmOverlay [data-role="input"]').last();
  await campo.waitFor({timeout: 5000});
  await campo.fill(nome);
  await pagina.locator('.appConfirmOverlay [data-role="ok"]').last().click();
  await pagina.waitForTimeout(150);
  return leggiNomi(pagina);
}

// La finestra del nome, aperta dal percorso generico (menu "Modello ⌄" → "Salva come..."), senza
// scrivere niente: serve a guardare DENTRO la finestra mentre si scrive.
async function apriFinestraNomeDisegno(pagina) {
  await pagina.locator('#drawTemplateBtn').click();
  await pagina.locator('#drawTemplateSaveAs').click();
  const campo = pagina.locator('.appConfirmOverlay [data-role="input"]').last();
  await campo.waitFor({timeout: 5000});
  return campo;
}

// Cosa si vede DENTRO la finestra del nome: le righe dei nomi già usati, con il nome e la famiglia
// (il menu da cui il nome viene). Misura il CONTENUTO della finestra, non una stringa nel sorgente.
async function leggiSuggerimenti(pagina) {
  return pagina.evaluate(() => Array.from(document.querySelectorAll('.appConfirmOverlay [data-role="suggerimento"]'))
    .map(r => ({
      nome: r.getAttribute('data-nome') || '',
      testo: (r.textContent || '').trim(),
      famiglia: ((r.querySelector('[data-role="suggerimento-famiglia"]') || {}).textContent || '').trim()
    })));
}

// Strada utente del nome GIÀ USATO: si scrive lo stesso nome, si preme Ok, compare la domanda di
// sovrascrittura e si risponde 'si' oppure 'no'. Con {fib:true} si passa dal menu "Modello Fib ⌄".
async function salvaStessoNome(pagina, nome, risposta, opzioni) {
  const fib = !!(opzioni && opzioni.fib);
  await pagina.locator(fib ? '#fibTemplateBtn' : '#drawTemplateBtn').click();
  await pagina.locator(fib ? '#fibTemplateSaveAs' : '#drawTemplateSaveAs').click();
  const campo = pagina.locator('.appConfirmOverlay [data-role="input"]').last();
  await campo.waitFor({timeout: 5000});
  await campo.fill(nome);
  await pagina.locator('.appConfirmOverlay [data-role="ok"]').last().click();
  // La domanda di sovrascrittura DEVE comparire: senza, il nome viene rifiutato e non si arriva a
  // scegliere niente - ed è esattamente il difetto che questa cura tolse.
  const ruolo = risposta === 'si' ? 'ok' : 'cancel';
  const bottone = pagina.locator('.appConfirmOverlay [data-role="' + ruolo + '"]').last();
  await bottone.waitFor({timeout: 5000});
  await bottone.click();
  await pagina.waitForTimeout(200);
}

// ===================== 1b. I NOMI GIÀ USATI SI VEDONO MENTRE SI SCRIVE =====================
// RICHIESTA DEL PROPRIETARIO (16 novembre 2026): «io vorrei che mostriamo i nomi già usati mentre si
// scrive. Assolutamente, questa è comoda come cosa.» Il refusto si vede PRIMA di premere Ok, non dopo.
// È la cura vera del problema dei nomi: non serve nessuna strada di rinomina.
test('i nomi GIÀ USATI si vedono dentro la finestra del nome mentre si scrive', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA);
    // Due famiglie diverse, così si vede che l'elenco non è di una famiglia sola.
    await disegna(pagina, 'trendline');
    await salvaModelloDisegno(pagina, 'Supporto giornaliero');
    await disegna(pagina, 'rectangle');
    await salvaModelloDisegno(pagina, 'Zona domanda');
    const d = await disegna(pagina, 'fib');
    assert.ok(d.stato.quanti >= 3, 'il fibonacci si deve aggiungere ai due disegni già in scena: ' + JSON.stringify(d.stato));
    assert.equal(d.stato.tipi[d.stato.tipi.length - 1], 'fib', 'l ultimo disegno deve essere il fibonacci: ' + JSON.stringify(d.stato.tipi));
    await pagina.evaluate(() => { openFibSettingsModal(selectedDrawing); });
    await pagina.waitForTimeout(120);
    await salvaModelloFib(pagina, 'Fib 61.8 ritracciato');
    // IL MODALE ⚙️ DEL FIBONACCI RESTA APERTO dopo il salvataggio, e copre il grafico: senza
    // chiuderlo il clic successivo finisce sull'overlay e non sul canvas (misurato: sotto i clic
    // c'era «fibModalOverlay»). È il gesto che fa l'utente - si chiude la finestra e si continua -
    // quindi si chiude dalla strada sua, closeFibSettingsModal(), e si controlla che sia chiusa.
    await pagina.evaluate(() => { closeFibSettingsModal(); });
    await pagina.waitForTimeout(120);
    const modaleChiuso = await pagina.evaluate(() =>
      (document.getElementById('fibModalOverlay') || {}).style.display === 'none');
    assert.equal(modaleChiuso, true, 'il modale del fibonacci deve essere chiuso prima di ridisegnare');
    // Si riapre la finestra del nome su un disegno qualunque: l'elenco dei nomi occupati deve
    // esserci, col nome e la famiglia di ciascuno.
    await disegna(pagina, 'trendline');
    await pagina.locator('#drawTemplateBtn').click();
    await pagina.locator('#drawTemplateSaveAs').click();
    const campo = pagina.locator('.appConfirmOverlay [data-role="input"]').last();
    await campo.waitFor({timeout: 5000});
    const suggeriti = await leggiSuggerimenti(pagina);
    const nomiSuggeriti = suggeriti.map(s => s.nome);
    assert.ok(nomiSuggeriti.includes('Supporto giornaliero'),
      'il nome dei disegni generici deve vedersi mentre si scrive: ' + JSON.stringify(nomiSuggeriti));
    assert.ok(nomiSuggeriti.includes('Zona domanda'),
      'anche il secondo modello generico: ' + JSON.stringify(nomiSuggeriti));
    assert.ok(nomiSuggeriti.includes('Fib 61.8 ritracciato'),
      'e il modello Fibonacci, che sta nell\'altra famiglia: ' + JSON.stringify(nomiSuggeriti));
    // La famiglia deve essere dichiarata per ogni nome: cercare nel menu sbagliato era una delle
    // cause del «non me lo salva».
    const fib = suggeriti.find(s => s.nome === 'Fib 61.8 ritracciato');
    assert.ok(fib && /fib/i.test(fib.famiglia),
      'il modello Fibonacci deve dire di che famiglia è: ' + JSON.stringify(fib));
    // E scrivendo il nome la lista si restringe: quello che si sta scrivendo si riconosce subito.
    await campo.fill('Supporto');
    await pagina.waitForTimeout(120);
    const filtrati = (await leggiSuggerimenti(pagina)).map(s => s.nome);
    assert.ok(filtrati.includes('Supporto giornaliero'),
      'scrivendo, il nome già usato deve restare visibile: ' + JSON.stringify(filtrati));
    assert.ok(!filtrati.includes('Zona domanda'),
      'quelli che non combaciano devono sparire, sennò la lista non serve a niente: ' + JSON.stringify(filtrati));
    await pagina.keyboard.press('Escape');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ===================== 1c. SOVRASCRITTURA: SÌ =====================
// «se si scrive lo stesso nome e si preme OK, viene fuori il classico pop-up "attenzione, vuoi
// sovrascrivere il modello precedente?" e l'utente tra sì e no.» Con SÌ il modello nuovo prende il
// posto del vecchio: STESSO nome, contenuto nuovo. È l'unico modo per correggere un refusto di
// contenuto senza rinominare niente (e nessun percorso rinomina un modello, nemmeno questo).
test('SÌ alla domanda: il modello col quel nome viene sostituito, non duplicato né rinominato', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA);
    // Primo modello: una linea col nome da riusare.
    await disegna(pagina, 'trendline');
    await salvaModelloDisegno(pagina, 'Zeta ripetuta');
    const primoJson = await pagina.evaluate((k) => {
      try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
    }, CHIAVE_DISEGNI);
    assert.ok(primoJson && primoJson['Zeta ripetuta'],
      'il primo modello deve esistere: ' + JSON.stringify(primoJson));
    // Secondo modello, di tipo DIVERSO, con lo STESSO nome: si risponde sì alla domanda.
    const d = await disegna(pagina, 'rectangle');
    // `quanti` conta TUTTI i disegni della scena: qui il rettangolo è il secondo (dopo la linea),
    // quindi l'assert giusto è che il NUOVO disegno sia l'ultimo della lista, non che ce ne sia uno.
    assert.ok(d.stato.quanti >= 2, 'il rettangolo deve essersi aggiunto ai disegni: ' + JSON.stringify(d.stato));
    assert.equal(d.stato.tipi[d.stato.tipi.length - 1], 'rectangle',
      'l ultimo disegno aggiunto deve essere il rettangolo: ' + JSON.stringify(d.stato.tipi));
    await pagina.locator('#drawTemplateBtn').click();
    await pagina.locator('#drawTemplateSaveAs').click();
    const campo = pagina.locator('.appConfirmOverlay [data-role="input"]').last();
    await campo.waitFor({timeout: 5000});
    await campo.fill('Zeta ripetuta');
    await pagina.locator('.appConfirmOverlay [data-role="ok"]').last().click();
    const conferma = pagina.locator('.appConfirmOverlay [data-role="ok"]').last();
    await conferma.waitFor({timeout: 5000});
    await conferma.click();
    await pagina.waitForTimeout(250);
    const dopo = await pagina.evaluate((k) => {
      try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
    }, CHIAVE_DISEGNI);
    const nomi = Object.keys(dopo || {});
    assert.deepEqual(nomi, ['Zeta ripetuta'],
      'con SÌ il nome resta uno solo: due modelli omonimi sarebbero il difetto: ' + JSON.stringify(nomi));
    assert.equal(dopo['Zeta ripetuta'].type, 'rectangle',
      'il modello col quel nome deve essere il NUOVO (un rettangolo, non la linea di prima)');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ===================== 1. PROVA DI CONTROLLO =====================
test('PROVA DI CONTROLLO: il disegno nasce sul canvas e la finestra del nome si apre', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    const vista = await pagina.evaluate(PREPARA);
    assert.ok(vista.candeleInVista > 0, 'devono esserci candele in vista, sennò misura il vuoto: ' + JSON.stringify(vista));
    const d = await disegna(pagina, 'trendline');
    assert.equal(d.stato.quanti, 1, 'il disegno deve nascere davvero: ' + JSON.stringify(d.stato));
    assert.equal(d.stato.tipi[0], 'trendline', 'deve essere una linea');
    assert.ok(d.stato.haPunti, 'la linea deve avere i due punti');
    assert.ok(d.p1.sotto === 'chart' || String(d.p1.sotto).includes('chart'),
      'sotto il primo clic ci deve essere il canvas, non ' + d.p1.sotto);
    // La finestra del nome si deve aprire davvero: qui NON si scrive niente, si annulla con Esc.
    await pagina.locator('#drawTemplateBtn').click();
    await pagina.locator('#drawTemplateSaveAs').click();
    const aperta = await pagina.locator('.appConfirmOverlay [data-role="input"]').last()
      .waitFor({timeout: 5000}).then(() => true).catch(() => false);
    assert.equal(aperta, true, 'la finestra del nome si deve aprire: senza questa il resto non conta');
    await pagina.keyboard.press('Escape');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ===================== 2. IL NOME DELLA LINEA =====================
test('il nome scritto per la LINEA finisce nella memoria e si vede nel menu', async () => {
  const {browser, pagina, errori} = await apriApp();
  try {
    await pagina.evaluate(PREPARA);
    const d = await disegna(pagina, 'trendline');
    assert.equal(d.stato.quanti, 1, 'la linea deve esistere prima di salvarne il modello');
    const dopo = await salvaModelloDisegno(pagina, 'Linea sostegno');
    const t = dopo.disegni || {};
    const nomi = Object.keys(t);
    assert.equal(nomi.length, 1, 'deve esserci UN modello salvato, trovati ' + nomi.length + ': ' + JSON.stringify(t));
    assert.ok(t['Linea sostegno'], 'il nome scritto deve essere la chiave del modello: ' + JSON.stringify(t));
    assert.equal(t['Linea sostegno'].type, 'trendline', 'il modello salvato dalla linea è una linea');
    assert.ok(dopo.menuDisegniTesto.includes('Linea sostegno'),
      'il nome deve vedersi nel menu "Modello ⌄" dopo il salvataggio');
    assert.ok(dopo.stato.includes('Linea sostegno'),
      'la barra di stato deve confermare il nome salvato: ' + JSON.stringify(dopo.stato));
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

// ===================== 3. IL NOME DEL RETTANGOLO =====================
test('il nome scritto per il RETTANGOLO finisce nella memoria e si vede nel menu', async () => {
  const {browser, pagina} = await apriApp();
  try {
    await pagina.evaluate(PREPARA);
    const d = await disegna(pagina, 'rectangle');
    assert.equal(d.stato.quanti, 1, 'il rettangolo deve esistere prima di salvarne il modello');
    assert.equal(d.stato.tipi[0], 'rectangle');
    const dopo = await salvaModelloDisegno(pagina, 'Zona domanda');
    const t = dopo.disegni || {};
    assert.ok(t['Zona domanda'], 'il nome scritto deve essere la chiave del modello: ' + JSON.stringify(t));
    assert.equal(t['Zona domanda'].type, 'rectangle', 'il modello salvato dal rettangolo è un rettangolo');
    assert.ok(dopo.menuDisegniTesto.includes('Zona domanda'),
      'il nome deve vedersi nel menu "Modello ⌄" dopo il salvataggio');
  } finally { await browser.close(); }
});

// ===================== 4. IL NOME DEL FIBONACCI (strada sua) =====================
test('il nome scritto per il FIBONACCI finisce nella memoria e si vede nel menu', async () => {
  const {browser, pagina} = await apriApp();
  try {
    await pagina.evaluate(PREPARA);
    const d = await disegna(pagina, 'fib');
    assert.equal(d.stato.quanti, 1, 'il fibonacci deve esistere prima di salvarne il modello');
    assert.equal(d.stato.tipi[0], 'fib');
    // Il modello Fibonacci si salva dal modale ⚙️ del disegno: si apre sul disegno selezionato.
    await pagina.evaluate(() => { openFibSettingsModal(selectedDrawing); });
    await pagina.waitForTimeout(120);
    const dopo = await salvaModelloFib(pagina, 'Fib 61.8');
    const t = dopo.fib || {};
    assert.ok(t['Fib 61.8'], 'il nome scritto deve essere la chiave del modello Fibonacci: ' + JSON.stringify(t));
    assert.ok(Array.isArray(t['Fib 61.8'].levels), 'il modello Fibonacci deve portare i livelli');
    assert.ok(t['Fib 61.8'].opts && typeof t['Fib 61.8'].opts === 'object',
      'il modello Fibonacci deve portare le opzioni');
    assert.ok(dopo.menuFibTesto.includes('Fib 61.8'),
      'il nome deve vedersi nel menu "Modello Fib ⌄" dopo il salvataggio');
  } finally { await browser.close(); }
});

// ===================== 5. SOPRAVVIVE ALLA RICARICA =====================
test('il nome salvato SOPRAVVIVE alla ricarica della pagina', async () => {
  const {browser, pagina} = await apriApp();
  try {
    await pagina.evaluate(PREPARA);
    await disegna(pagina, 'trendline');
    await salvaModelloDisegno(pagina, 'Linea da ritrovare');
    const prima = await pagina.evaluate((k) => {
      try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
    }, CHIAVE_DISEGNI);
    assert.ok(prima && prima['Linea da ritrovare'],
      'PRIMA della ricarica il nome deve esserci: ' + JSON.stringify(prima));
    // RICARICA VERA: la memoria dei disegni viene riletta e la pagina ripartita.
    await pagina.reload({waitUntil: 'domcontentloaded'});
    await pagina.waitForTimeout(2600);
    await pagina.evaluate(() => document.querySelectorAll('#auth-check-overlay,.fbModalOverlay')
      .forEach(el => el.style.display = 'none'));
    await pagina.evaluate(PREPARA);
    const dopo = await pagina.evaluate((k) => {
      try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
    }, CHIAVE_DISEGNI);
    assert.ok(dopo && dopo['Linea da ritrovare'],
      'dopo la ricarica il nome deve essere ancora in memoria: ' + JSON.stringify(dopo));
    // E si deve rivedere nel menu, riaperto da capo.
    await pagina.locator('#drawTemplateBtn').click();
    const menu = await pagina.evaluate(() =>
      (document.getElementById('drawTemplateList') || {}).textContent || '');
    assert.ok(menu.includes('Linea da ritrovare'),
      'dopo la ricarica il nome deve vedersi nel menu: ' + JSON.stringify(menu));
  } finally { await browser.close(); }
});

// ===================== 6. PROVA DI CONTROLLO INVERSA =====================
test('PROVA DI CONTROLLO INVERSA: annullando la finestra del nome non si salva niente', async () => {
  const {browser, pagina} = await apriApp();
  try {
    await pagina.evaluate(PREPARA);
    await disegna(pagina, 'trendline');
    await pagina.locator('#drawTemplateBtn').click();
    await pagina.locator('#drawTemplateSaveAs').click();
    // Si scrive e poi si annulla con Esc (la finestra si chiude senza salvare).
    await pagina.locator('.appConfirmOverlay [data-role="input"]').last().fill('Nome da buttare');
    await pagina.keyboard.press('Escape');
    await pagina.waitForTimeout(120);
    const t = await pagina.evaluate((k) => {
      try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
    }, CHIAVE_DISEGNI);
    // Se QUI comparisse un modello, il banco non distinguerebbe "salvato" da "non salvato".
    assert.ok(!t || Object.keys(t).length === 0,
      'annullando non deve restare niente in memoria: ' + JSON.stringify(t));
  } finally { await browser.close(); }
});

// ===================== 7. UN NOME GIÀ USATO CHIEDE SE SOVRASCRIVERE =====================
// La prova 7 di prima («un nome GIÀ USATO viene rifiutato») è stata RISCRITTA, non aggiustata per
// farla passare: il proprietario ha chiesto esplicitamente che il rifiuto sparisca e torni la
// domanda «attenzione, vuoi sovrascrivere il modello precedente?» con sì/no. Quello che quella
// prova difendeva - il modello salvato prima non si cancella per sbaglio - ora lo difendono le
// prove 9 e 10 qui sotto: a proteggerlo è il «no», non più il rifiuto.
test('un nome GIÀ USATO fa comparire la domanda di sovrascrittura (sì/no), non un rifiuto', async () => {
  const {browser, pagina} = await apriApp();
  try {
    await pagina.evaluate(PREPARA);
    await disegna(pagina, 'trendline');
    await salvaModelloDisegno(pagina, 'Nome duplice');
    const firmaPrima = await pagina.evaluate((k) => localStorage.getItem(k), CHIAVE_DISEGNI);
    // Secondo disegno, di tipo diverso, e si ritenta lo STESSO nome.
    await disegna(pagina, 'rectangle');
    await pagina.locator('#drawTemplateBtn').click();
    await pagina.locator('#drawTemplateSaveAs').click();
    const campo = pagina.locator('.appConfirmOverlay [data-role="input"]').last();
    await campo.waitFor({timeout: 5000});
    await campo.fill('Nome duplice');
    await pagina.locator('.appConfirmOverlay [data-role="ok"]').last().click();
    // La domanda, col sì e col no, che nomina il modello in questione.
    const domanda = await pagina.evaluate(() => {
      const o = document.querySelector('.appConfirmOverlay');
      if (!o) return null;
      const si = o.querySelector('[data-role="ok"]');
      const no = o.querySelector('[data-role="cancel"]');
      return {
        testo: (o.querySelector('.appConfirmBody') || {}).textContent || '',
        titolo: (o.querySelector('h3') || {}).textContent || '',
        si: si ? si.textContent : '',
        no: no ? no.textContent : ''
      };
    });
    assert.ok(domanda, 'scrivendo un nome già usato deve comparire la domanda di sovrascrittura');
    assert.match(domanda.testo, /sovrascriv/i, 'la domanda deve chiedere se sovrascrivere: ' + JSON.stringify(domanda));
    assert.match(domanda.testo, /Nome duplice/, 'la domanda deve dire quale nome è già occupato: ' + JSON.stringify(domanda));
    assert.match(domanda.si, /sì/i, 'il pulsante di conferma deve dire sì: ' + JSON.stringify(domanda));
    assert.match(domanda.no, /no/i, 'il pulsante di rifiuto deve dire no: ' + JSON.stringify(domanda));
    // Mentre la domanda è aperta niente è stato salvato: la memoria è intatta.
    const firmaConDomanda = await pagina.evaluate((k) => localStorage.getItem(k), CHIAVE_DISEGNI);
    assert.equal(firmaConDomanda, firmaPrima, 'la domanda non deve aver già salvato niente');
    // Esc sulla domanda vale «no» (come il clic fuori dal riquadro): niente viene salvato.
    await pagina.keyboard.press('Escape');
    await pagina.waitForTimeout(150);
    const firmaDopoEsc = await pagina.evaluate((k) => localStorage.getItem(k), CHIAVE_DISEGNI);
    assert.equal(firmaDopoEsc, firmaPrima, 'annullare la domanda non deve salvare niente');
  } finally { await browser.close(); }
});

// ===================== 8. IL FIBONACCI DALLA STRADA GENERICA =====================
test('il FIBONACCI salvato dalla strada generica porta levels e opts (modello utilizzabile)', async () => {
  const {browser, pagina} = await apriApp();
  try {
    await pagina.evaluate(PREPARA);
    const d = await disegna(pagina, 'fib');
    assert.equal(d.stato.quanti, 1, 'il fibonacci deve esistere prima di salvarne il modello');
    // Stessa finestra "Modello ⌄" usata per linee e rettangoli, non quella del modale Fib.
    const dopo = await salvaModelloDisegno(pagina, 'Fib generico');
    const t = dopo.disegni || {};
    assert.ok(t['Fib generico'], 'il nome scritto deve essere la chiave del modello: ' + JSON.stringify(t));
    assert.equal(t['Fib generico'].type, 'fib', 'il modello salvato dal fibonacci è un fibonacci');
    assert.ok(Array.isArray(t['Fib generico'].levels) && t['Fib generico'].levels.length > 0,
      'il modello deve portare i livelli del fibonacci: ' + JSON.stringify(t['Fib generico']));
    assert.ok(t['Fib generico'].opts && typeof t['Fib generico'].opts === 'object',
      'il modello deve portare le opzioni del fibonacci: ' + JSON.stringify(t['Fib generico']));
  } finally { await browser.close(); }
});

// ===================== 9. NOME INTOCCO, MODELLO CANCELLABILE =====================
test('dopo la cura il nome non si deve poter CAMBIARE (oggi non si può: è la regola da mantenere)', async () => {
  const {browser, pagina} = await apriApp();
  try {
    await pagina.evaluate(PREPARA);
    await disegna(pagina, 'trendline');
    await salvaModelloDisegno(pagina, 'Nome difeso');
    await pagina.locator('#drawTemplateBtn').click();
    await pagina.waitForTimeout(120);
    // La riga del modello, com'è oggi: un div col nome e un pulsante 🗑 che lo cancella.
    const riga = await pagina.evaluate(() => {
      const nomeEl = document.querySelector('#drawTemplateList .drawTemplateRowName');
      if (!nomeEl) return {trovata: false};
      return {
        trovata: true,
        tag: nomeEl.tagName,
        contentedibile: nomeEl.getAttribute('contenteditable'),
        haCampoInput: !!nomeEl.querySelector('input'),
        cestinoPresente: !!document.querySelector('#drawTemplateList .drawTemplateRowDel'),
        testo: nomeEl.textContent
      };
    });
    assert.equal(riga.trovata, true, 'la riga col nome deve esserci nel menu');
    // IL NOME NON DEVE ESSERE MODIFICABILE: né campo <input>, né contenteditable.
    assert.equal(riga.haCampoInput, false,
      'il nome non deve essere un campo modificabile: ' + JSON.stringify(riga));
    assert.ok(!riga.contentedibile,
      'il nome non deve essere editabile: ' + JSON.stringify(riga));
    // TENTATIVO VERO di modifica: messa a fuoco dell'elemento col nome e scrittura da tastiera.
    // Un div non è focalizzabile, quindi oggi non succede niente — dopo la cura il nome dovrà
    // restare identico comunque, perché quello è il comportamento richiesto.
    try {
      await pagina.locator('#drawTemplateList .drawTemplateRowName').first().focus();
      await pagina.keyboard.type('XYZ');
      await pagina.keyboard.press('Enter');
    } catch (e) {}
    await pagina.waitForTimeout(120);
    const testoDopo = await pagina.evaluate(() =>
      (document.querySelector('#drawTemplateList .drawTemplateRowName') || {}).textContent || '');
    assert.equal(testoDopo, riga.testo,
      'tentare di cambiarlo non deve cambiarlo: ' + JSON.stringify({prima: riga.testo, dopo: testoDopo}));
    // IL MODELLO RESTA CANCELLABILE (regola del proprietario del 16 novembre 2026: il nome è
    // immutabile per sempre, il modello si può buttare). Il cestino ci deve essere.
    assert.equal(riga.cestinoPresente, true,
      'il modello deve restare cancellabile col cestino: ' + JSON.stringify(riga));
    // L'Invio di sopra ha CHIUSO il menu (misurato: il focus resta sul pulsante "Modello ⌄" e
    // Invio su un pulsante è un clic), quindi lo riapro prima di toccare il cestino.
    await pagina.locator('#drawTemplateBtn').click();
    await pagina.waitForTimeout(140);
    // E il cestino deve essere un pulsante VERO, visibile nel menu aperto (non un elemento sepolto).
    const visibile = await pagina.evaluate(() => {
      const d = document.querySelector('#drawTemplateList .drawTemplateRowDel');
      return !!d && d.getBoundingClientRect().height > 0
        && document.getElementById('drawTemplateMenu').style.display === 'block';
    });
    assert.equal(visibile, true, 'il cestino deve essere visibile nel menu aperto');
    // Il clic sul cestino passa da un click VERO del browser (element.click()), come quello
    // dell'utente col mouse.
    await pagina.evaluate(() => document.querySelector('#drawTemplateList .drawTemplateRowDel').click());
    await pagina.waitForTimeout(150);
    // La cancellazione chiede conferma (appConfirm): si risponde col pulsante Ok.
    await pagina.locator('.appConfirmOverlay [data-role="ok"]').last().click();
    await pagina.waitForTimeout(150);
    const dopoCestino = await pagina.evaluate((k) => {
      try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
    }, CHIAVE_DISEGNI);
    assert.ok(!dopoCestino || Object.keys(dopoCestino).length === 0,
      'dopo il cestino il modello non deve più esserci: ' + JSON.stringify(dopoCestino));
  } finally { await browser.close(); }
});