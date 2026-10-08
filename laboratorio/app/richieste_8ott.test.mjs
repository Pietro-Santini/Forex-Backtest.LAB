// Le richieste dell'8 ottobre 2026, quelle che si possono provare senza un conto vero.
//
// Ogni prova qui guarda la cosa che POTREBBE rompersi in silenzio: una metodologia che si
// seleziona ma non cambia niente a chi esegue, un win rate che dice un numero sbagliato, un
// popup che compare dove non serve. Le parti che vivono dentro un IIFE (dashboard delle
// statistiche, cronologia delle sale) si provano dal comportamento visibile, non dalle funzioni.
import test from 'node:test';
import assert from 'node:assert/strict';
import {apriApp} from './aiuti.mjs';

test('lo spostamento dello stop vale in tutte e due le metodologie', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const regole = ['', 'entrata', '1', '2', '3', '4'];
      return {
        // Una posizione per ogni TP: le regole valgono, tagliate sui target che il segnale ha.
        posizioni: tgAutoRegolePerSegnale({modo:'posizioni', regole}, 4),
        // Una posizione sola chiusa a pezzi: lo stop e' il suo, non si sposta target per target.
        // Anche se nella configurazione fossero rimaste delle regole di prima.
        parziali:  tgAutoRegolePerSegnale({modo:'parziali', regole}, 4),
        // Senza metodologia scritta vale quella di sempre: una posizione per TP.
        vecchia:   tgAutoRegolePerSegnale({regole}, 4),
        modoVuoto: tgAutoModo({}),
        modoScritto: tgAutoModo({modo:'parziali'})
      };
    });
    assert.deepEqual(r.posizioni, [{quando:2,dove:'entrata'},{quando:3,dove:1},{quando:4,dove:2}]);
    // DECISIONE CAMBIATA dal proprietario (8 ottobre 2026): nella v107 le chiusure parziali
    // non avevano lo spostamento dello stop. L'ha richiesto indietro, e ha ragione - proprio
    // perche' la posizione e' una sola, spostare quello stop a un target gia' raggiunto mette
    // al sicuro tutto quello che resta aperto.
    assert.deepEqual(r.parziali, r.posizioni, 'lo stop si sposta anche con una posizione sola chiusa a pezzi');
    assert.deepEqual(r.vecchia, r.posizioni, 'una configurazione vecchia non cambia comportamento');
    assert.equal(r.modoVuoto, 'posizioni');
    assert.equal(r.modoScritto, 'parziali');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il riassunto della strategia dice quale metodologia è in uso', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      tgAutoMostraFam('fx');
      const a = tgAutoRiassuntoRegole({modo:'posizioni', regole:['','entrata'], quote:[]});
      const b = tgAutoRiassuntoRegole({modo:'parziali', regole:['','entrata'], quote:[20,30,50]});
      // Sulle cripto la posizione e' sempre una sola con chiusure parziali, E lo stop si sposta:
      // il riassunto deve dire entrambe le cose, perche' sono entrambe vere.
      tgAutoMostraFam('cr');
      const c = tgAutoRiassuntoRegole({modo:'posizioni', regole:['','entrata'], quote:[40,60]});
      tgAutoMostraFam('fx');
      return {a,b,c};
    });
    assert.match(r.a, /una posizione per TP/);
    assert.match(r.a, /pareggio/);
    assert.match(r.b, /chiusure parziali/);
    assert.match(r.b, /20\/30\/50%/);
    assert.match(r.b, /pareggio/, 'anche con le parziali lo stop si sposta: il riassunto deve dirlo');
    assert.match(r.c, /chiusure parziali/);
    assert.match(r.c, /pareggio/, 'sulle cripto lo stop si sposta comunque');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('nelle posizioni aperte si legge chi ha aperto: sala, utente Syntra o tu', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => ({
      sala:   fblOrigineBadgeHtml({tgSala:'Gold Signals VIP', tgTpIndice:2}),
      syntra: fblOrigineBadgeHtml({tgSala:'Syntra · CrownPips'}),
      mano:   fblOrigineBadgeHtml({}),
      // Un nome con virgolette non deve poter uscire dal suo attributo.
      cattivo: fblOrigineBadgeHtml({tgSala:'a"><script>x</script>'})
    }));
    assert.match(r.sala, /📡/);
    assert.match(r.sala, /Gold Signals VIP/);
    assert.match(r.sala, /take profit n\. 2/);
    assert.match(r.syntra, /📱/);
    assert.match(r.syntra, /CrownPips/);
    assert.doesNotMatch(r.syntra, /Syntra · CrownPips</, 'il prefisso "Syntra · " non si ripete nell\'etichetta');
    assert.match(r.mano, /👤/);
    assert.doesNotMatch(r.cattivo, /<script>/, 'il nome della sala arriva da fuori: va sempre scappato');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('le linee delle posizioni si spengono senza portarsi via le caselle e le etichette', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const partenza = fblLineePosVisibili();
      document.getElementById('toggleLineePosBtn').click();
      const dopo = fblLineePosVisibili();
      // I due interruttori accanto NON devono essere stati toccati.
      const caselle = typeof tpSlZoneFillVisible!=='undefined' ? tpSlZoneFillVisible : null;
      const etichette = fblEtichetteTpSlVisibili();
      document.getElementById('toggleLineePosBtn').click();
      return {partenza, dopo, caselle, etichette, tornato: fblLineePosVisibili()};
    });
    assert.equal(r.partenza, true, 'di base le linee si vedono, come prima');
    assert.equal(r.dopo, false);
    assert.equal(r.caselle, true, 'le caselle colorate TP/SL restano accese');
    assert.equal(r.etichette, true, 'le etichette Target/Stop restano accese');
    assert.equal(r.tornato, true, 'ripremendo si torna indietro');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il popup dei pacchetti MT5 non propone niente da installare su telefono e tablet', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const scarica = document.getElementById('mt5DownloadDesktopAppBtn');
      // Da computer: il download e' la cosa da fare, e si vede.
      mt5Passo1Parole(false);
      const pc = {visibile: scarica.style.display!=='none', titolo: document.getElementById('mt5BridgeStepTitle').textContent};
      // Da telefono: niente da installare, e si dice dove guardare davvero.
      const vero = fblEMobile;
      window.fblEMobile = () => true; fblEMobile = window.fblEMobile;
      mt5Passo1Parole(false);
      const mob = {visibile: scarica.style.display!=='none',
                   titolo: document.getElementById('mt5BridgeStepTitle').textContent,
                   testo: document.getElementById('mt5BridgeStepTesto').textContent};
      window.fblEMobile = vero; fblEMobile = vero;
      return {pc, mob};
    });
    assert.equal(r.pc.visibile, true, 'sul computer il download serve e si vede');
    assert.match(r.pc.titolo, /Installa i pacchetti/);
    assert.equal(r.mob.visibile, false, 'su telefono e tablet non c\'è niente da scaricare');
    assert.doesNotMatch(r.mob.titolo, /pacchetti/i);
    assert.match(r.mob.testo, /Accesso da altri dispositivi/);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('la curva del rendimento porta i conti di ogni momento, per poterla scorrere', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      // Tre segnali valutati: uno vinto (2 TP su 2), uno perso, uno vinto.
      const seg = (ts, raggiunti, slPreso) => ({valutato:true, tFill:ts, ts, entry:100, sl:90,
        tps:[110,120], raggiunti, slPreso});
      const ris = [seg(1000,2,false), seg(2000,0,true), seg(3000,2,false)];
      const c = fblCronoRendCurva(ris, 10000, 1);
      return {
        punti: c.punti.length,
        primo: c.punti[0],
        ultimo: c.punti[c.punti.length-1],
        usateFinali: c.usate
      };
    });
    assert.equal(r.punti, 4, 'il punto di partenza più uno per operazione contata');
    assert.equal(r.primo.usate, 0, 'il primo punto è prima di tutto: zero operazioni');
    assert.equal(r.primo.vinte, 0);
    assert.equal(r.ultimo.usate, r.usateFinali, 'l\'ultimo punto coincide col totale della curva');
    assert.equal(r.ultimo.vinte, 2);
    assert.equal(r.ultimo.perse, 1);
    assert.ok(r.ultimo.ddMax > 0, 'c\'è stato un calo: deve restare scritto nel punto');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il pulsante «Segnale manuale» c\'è in entrambe le sessioni, Telegram e Syntra', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const dentro = sessione => {
        const p = document.querySelector('[data-salasessione-panel="'+sessione+'"]');
        return !!(p && p.querySelector('.fblSegnaleManualeBtn'));
      };
      return {
        telegram: dentro('telegram'),
        syntra: dentro('syntra'),
        quanti: document.querySelectorAll('.fblSegnaleManualeBtn').length,
        // Il diario del ponte non esiste più.
        diario: !!document.getElementById('tgDiarioBtn'),
        prova: !!document.getElementById('tgProvaBtn'),
        // E si spiega che il nome digitato diventa una sala segnali.
        spiegato: /diventa una sala segnali/.test(document.querySelector('[data-salasessione-panel="syntra"]').textContent)
      };
    });
    assert.equal(r.telegram, true);
    assert.equal(r.syntra, true);
    assert.equal(r.quanti, 2, 'uno per sessione, non uno solo in cima');
    assert.equal(r.diario, false, 'il pulsante «Diario del ponte» è stato rimosso');
    assert.equal(r.prova, false, '«Pagina di prova» è diventata «Segnale manuale»');
    assert.equal(r.spiegato, true);
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});

test('il pulsante Collega di Kraken non è verde a riposo', async () => {
  const {browser, pagina, errori} = await apriApp();
  try{
    const r = await pagina.evaluate(() => {
      const b = document.getElementById('krakenCollegaBtn');
      return {acceso: b.classList.contains('active'), classe: b.className};
    });
    assert.equal(r.acceso, false, 'verde fisso vuol dire «premuto»: a conto scollegato è una bugia');
    assert.deepEqual(errori, []);
  } finally { await browser.close(); }
});
