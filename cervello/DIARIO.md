# Diario dei giri di agenti

Formato: data — chi — cosa — esito collaudo — commit.

- 2026-10-05 — impianto iniziale — creati cervello, laboratorio (11 test ponte + interprete + 6
  test app), flussi GitHub Collaudo e Installer Windows, agenti — collaudo verde
- 2026-10-05 — impianto — primo Setup costruito da GitHub (94 MB, collaudo librerie ponte ok);
  release automatica pronta (scatta su main); collaudo GitHub rosso→verde (test del ponte usavano
  la rete vera) — verde — 026b3ee
- 2026-10-06 — Claude — memoria aggiornata (contesto attività, antiriciclaggio in sospeso);
  consenso informato ai rischi prima di segnali e apertura dai segnali (app v86) — verde
- 2026-10-06 — Claude — pacchetto server Oracle (ponte senza MT5 solo simulato, ponte segnali con
  dati nel volume, Docker, prepara_server.sh, guida); 6 test del server; collaudo GitHub con Docker
- 2026-10-06 — Claude — PR #6 unita (sito su v86, prima release automatica); Setup 1.0.73 e
  release con la numerazione v1.0.NN del proprietario — verde
- 2026-10-07 — Claude — server Oracle avviato dal proprietario (Docker, Tailscale); app v87 con il
  server per Kraken e segnali; Setup 1.0.74 — verde
- 2026-10-07 — Claude — app v88 "Esci da Telegram" (logout vero, sessione e numero cancellati,
  rientro con numero e codice); Setup 1.0.75 — verde
- 2026-10-07 — Claude — app v89: pulsante "Accesso da altri dispositivi e server Oracle" (il
  proprietario non trovava "Prova il server"); guida corretta; Setup 1.0.76 — verde
- 2026-10-08 - Claude - app v106 pubblicata (ponte dei segnali che non muore su una emoji, Syntra
  con --solo-syntra) - verde - 1a3eaf5
- 2026-10-08 - Claude - app v107, quindici richieste del proprietario in un colpo: popup dei
  pacchetti MT5 solo su computer; conti Kraken sincronizzati (Aggiorna li rilegge, Scollega non li
  nasconde, Collega non e' piu' verde a riposo); via il Diario del ponte; "Pagina di prova" ->
  "Segnale manuale" in entrambe le sessioni; sale selezionabili nella dashboard dei win rate;
  journal e trade per periodo anche giornalieri; trade per fascia oraria; win rate degli Esiti
  senza i pareggi; sala/utente Syntra scritti nelle posizioni aperte e posizioni raggruppate per
  entrata con P/L sommato; interruttore per le sole linee delle posizioni; grafico del rendimento
  scorrevole con i numeri che seguono; metodologia della strategia (una posizione per TP oppure
  una sola chiusa a pezzi) nella cronologia e nell'apertura automatica, cripto escluse -
  8 test nuovi (laboratorio/app/richieste_8ott.test.mjs) - verde
- 2026-10-08 - Claude - server Oracle aggiornato alla v107 (prepara_server.sh): contenitori
  ricostruiti, ponte Telegram ricollegato da solo a tutte le sale senza chiedere il codice, la
  correzione dell'emoji ora gira davvero sul server. Il primo tentativo era rimasto a meta': il
  filtro che nascondeva la chiave d'accesso usciva sul titolo del passo 4 e il build non partiva -
  sorgenti nuovi, contenitori vecchi, exit code 0 bugiardo. Vedi la trappola in memoria. - verde
- 2026-10-08 - Claude - app v108: MT5 dal telefono. La strada degli ordini si prova invece di
  indovinarla, e il pannello dei servizi prova l'indirizzo che la sezione MT5 usa davvero (prima
  era verde su una rotta diversa). Trovato riproducendo il telefono nel laboratorio con la rete
  vera verso il server. 3 test nuovi - verde
- 2026-10-08 - Claude - app v109, sette passi concordati a voce col proprietario: prestazioni
  (date delle candele lette a mano, decimali una volta per disegno, due memorie nel disegno -
  primo disegno da 3241 a 1060 ms e trascinamento da 50 a 24 ms per immagine su telefono),
  raggruppamento delle posizioni con codice del segnale e tolleranza, origine delle operazioni,
  un solo nome di sala ovunque (col ponte che manda i titoli), numero di target preso dalla
  storia della sala e tetto da 5 a 10. 32 test nuovi in 6 file - verde
- 2026-10-08 - Claude - app v110, passi 8-12 della scaletta: distribuzione equa, «chiusura
  parziale» col nome giusto, lo spostamento dello stop RIMESSO anche nelle chiusure parziali
  (decisione cambiata dal proprietario), le stesse scelte dentro l'apertura automatica, e ogni
  sala con le sue righe di target - imparate dai segnali che arrivano, non uguali per tutte.
  Verificato con una prova che la resa della sala tiene conto dello spostamento dello stop, e
  che senza candele in memoria NON lo fa (ora la nota sotto il grafico lo dice a chiare lettere).
  2 test nuovi, 3 aggiornati alla decisione nuova - verde
- 2026-10-08 - Claude - app v111: risolto il bug del grafico del rendimento al tocco (segnalato
  dal proprietario) e passo 14, le operazioni a blocco sulle posizioni aperte in stile
  MetaTrader 5: tutte, in guadagno, in perdita, per direzione, e un asset alla volta con dentro
  buy e sell. Ogni voce dice quante posizioni tocca e con che risultato, e chiede conferma.
  10 test nuovi - verde
- 2026-10-09 - Claude - prima il guasto vivo, poi la richiesta del proprietario.
  Il ponte degli ordini si era impallato verso le 01:59: il processo
  ForexBacktestLAB era ancora in lista e il log finiva con 200 OK di pochi
  minuti prima, ma la porta 8000 non ascoltava piu' (grafico 8001 e segnali
  8769 invece si') - da lì "la connessione a ordini dà problemi" e il telefono,
  che passa dal server, non seguiva piu' MT5. Basta riavviare l'exe: a ogni
  avvio uccide le istanze vecchie di sé e di Mt5FeedServer e riparte pulito.
  Poi app v112, chiesta a voce: il popup «scarica i pacchetti aggiuntivi» non
  deve esistere su telefono e tablet. Due buchi (vedi BUG.md): il gate cadeva
  sul passo 1 col testo statico quando il ponte moriva mentre si era al gate, e
  fblEMobile() non vedeva il telefono in «modalità desktop». Il download di
  MetaTrader 5 esce dal gate su ogni dispositivo che non sia il computer.
  4 test nuovi (laboratorio/app/pacchetti_mobile.test.mjs) - verde
- 2026-10-09 - agenti - passo 13 della scaletta, l'instradamento su Capital.com
  app v113 / Setup 1.0.113. Con MT5 collegato, il segnale di una sala su uno
  strumento che non esiste ne' su Kraken ne' su MT5 (azione, indice) finiva
  mandato a MT5 come ordine vero con l'epic di Capital.com, e il broker lo
  rifiutava. Ora c'e' tgContoEffettivoPerSegnale (asincrona) che chiede a MT5
  se ha lo strumento e, se non ce l'ha, accende Capital.com da sola (in
  silenzio, senza moduli) e apre li' una posizione SIMULATA, mai un ordine a
  MT5. Le posizioni Capital.com sono una famiglia a parte nel Trade Journal
  ('💹 Capital.com'), come Kraken. Prima il test che fallisce: nuovo file
  laboratorio/app/capital_instradamento.test.mjs, 5 test che prima erano rossi
  e ora passano; sintassi dell'app pulita. Versioni alzate: sw.js CACHE_NAME a
  forex-backtest-lab-v113 e installer_build/installer.iss MyAppVersion a
  1.0.113. Nota di metodo: il lavoro e' stato preparato facendo esplorare il
  codice a tre agenti indipendenti in parallelo e poi confrontando le loro
  letture con la fonte. La lezione e' che gli agenti servono a non fidarsi di
  una sola lettura, ma la verifica vera resta sempre il file e il test. Non e'
  stato pubblicato nulla: tutto resta non committato in attesa del via del
  proprietario.
- 2026-10-09 - agenti - ONDATA 1 della scaletta, in un colpo solo e con piu' agenti in
  parallelo. Apertura automatica dei segnali: la fa SOLO il computer (telefono e
  tablet mostrano il segnale e aprono a mano). Corretto l'errore latente del passo
  13: nel ramo Capital di tgAutoValuta si usava sym prima della dichiarazione (TDZ)
  e l'apertura automatica Capital.com andava in errore. Filtro anti-doppioni dei
  segnali (v116): stesso strumento, direzione, fascia d'entrata e target non aprono
  una seconda posizione - in automatico blocca, a mano avvisa e chiede conferma.
  Attribuzione della sala nella tabella posizioni allineata al Trade Journal (v115),
  cosi' la STESSA posizione mostra la stessa sala e non piu' 'tu'. L'asse dei prezzi
  e le colonne COB/SVP non zoomano piu' per errore (v117). Capital.com nella barra
  dei conti (v118): ordini MANUALI simulati, mai a MT5. Test nuovi:
  apertura_solo_computer, filtro_doppioni (+_auto), attribuzione_mt5,
  asse_prezzi_zoom, capital_manuale. Pubblicato: commit 86f6293 (v117) e 560f95b
  (v118) - verde - Falliti: 0
- 2026-10-09 - agenti - Passi 15/16: storia completa di un utente Syntra. Il robot
  tocca il nome in alto a destra di una scheda, apre il profilo, scorre e legge
  tutte le operazioni, e le ARCHIVIA nella cronologia della sala 'Syntra · <utente>'
  (mai in bacheca, senza toccare la pagina Notifiche). Il ponte _manda_storico per
  le sale Syntra chiede la lettura e aspetta che finisca (max 60 s). app v119 /
  Setup 1.0.119. Test: laboratorio/ponte/test_profilo_syntra.py (4, prima rossi) -
  verde - Falliti: 0 - 6fc0a5b
- 2026-10-09 - agenti - Passo 17: memoria riportata al vero. CONSEGNA allineata a
  v119 (storia v113->v119, passi 13/15/16 chiusi, mappa di app.html a ~41.500
  righe), diario e registro bug completati, MAPPA e IDEE aggiornate. - verde
- 2026-10-09 - agenti - Passi 18/19: linee TP/SL della cronologia a grafico. Ora valuta registra la
  candela di colpimento di OGNI TP (tpT) e quella dello stop (slT); fblCronoAncore le traduce in
  indici a grafico (tpEnd, slEnd); fblCronoDisegna disegna ogni linea fino alla SUA candela (non
  piu' tutte fino all'evento finale) e stampa una spunta a SINISTRA del punto in cui un TP e' stato
  preso. Se lo stop non e' stato preso, la sua linea prende la lunghezza dell'ultima di TP. app v120
  / Setup 1.0.120. Test: laboratorio/app/cronologia_linee.test.mjs (3, prima rossi). - verde -
  Falliti: 0
- 2026-10-09 - agenti - Passo 20 (v121): lo stop mobile a grafico. fblSimulaStrategia registra il
  percorso dello stop (storicoStop) e se e' stato colpito (stopColpito); fblCronoStopPath rigioca il
  segnale con la strategia della sala e torna i punti (tempo, livello) o null se lo stop non si e'
  mosso; fblCronoDisegna disegna lo stop a SCALA (segmento a ogni livello + salto verticale), la X
  dove viene colpito e l'etichetta «Stop P» quando si e' spostato. app v121 / Setup 1.0.121. Test:
  laboratorio/app/stop_mobile.test.mjs (3, prima rossi). - verde - Falliti: 0
- 2026-10-09 - agenti - Passo 21 (v122): il grafico della resa deve restare fermo. Due cause, due
  rimedi: (1) il gesto di zoom (pinch da trackpad = evento wheel con ctrlKey) sopra la cronologia non
  era bloccato, quindi la pagina si zoomava: ora #fblCronoOverlay e #fblRendGrafico hanno
  touch-action:pan-y e il canvas blocca ctrl/meta+rotellina (la rotellina normale scorre ancora). (2)
  la larghezza con cui si disegna la resa si riprendeva a ogni disegno: passando il mouse il riquadro
  si spostava di qualche pixel e il canvas veniva riallocato (lampo bianco) e la curva riscalata. Ora
  la larghezza e' fissa e si ricalcola solo su un vero resize della finestra; .fbModalBody ha
  scrollbar-gutter:stable. In piu' il minimo/massimo della curva si calcola a ciclo (lo sparpagliamento
  Math.min(...) su serie lunghe puo' fallire e lasciare il canvas bianco). app v122 / Setup 1.0.122.
  Test: laboratorio/app/resa_ferma.test.mjs (2, prima rossi). - verde - Falliti: 0
- 2026-10-09 - Claude - app v123: passo 22, due interruttori piu' fini in Impostazioni -> Style.
  Uno spegne SOLO la linea tratteggiata fra la freccia di apertura e quella di chiusura
  (apertura->prezzo attuale per le posizioni ancora aperte), l'altro SOLO le orizzontali di
  prezzo di apertura e chiusura. Linee TP/SL, frecce e caselle non si toccano; le due scelte si
  sincronizzano fra i dispositivi. Nello stesso giro: il parser riconosce le coppie scritte con
  spazi e barra ("AUD / CAD"), che Syntra usa e che prima venivano scartate in silenzio; e
  `rowsAssetKey` separa l'asset delle candele CARICATE da quello selezionato, cosi' il prezzo
  dal vivo non puo' piu' essere attribuito all'asset sbagliato durante un cambio.
  Test: interruttori_posizioni.test.mjs, test_syntra_audcad.py (aggiunto anche a collauda.sh,
  dove non sarebbe mai girato). - verde - Falliti: 0
- 2026-10-09 - Claude - app v124: le orizzontali di prezzo solo sulle posizioni aperte, non piu'
  sui trade chiusi (segnalato dal proprietario). Il test e' costato tre tentativi e la lezione
  sta in LEZIONI.md: passava sia prima sia dopo, perche' le operazioni finte cadevano fuori
  dalla finestra visibile e non venivano disegnate affatto. - verde - Falliti: 0
- 2026-10-10 - Claude - app v125: nuovo indicatore nativo "Gann 21.7 Profit Factor (4h)" in INDICATOR_DEFS (gann217), personalizzabile dal pannello impostazioni. Test: laboratorio/app/indicatore_gann217.test.mjs (prima rosso senza l'indicatore). Nello stesso giro corretto laboratorio/app/rendimento_scorrimento.test.mjs, che era rosso su main (anche su GitHub): usava il margine 16 del vecchio canvas invece del 10 dell'SVG (pl/pr di rendDisegnaGrafico), e dava 2 invece di 0 a sinistra e 98 invece di 100 a destra. L'app non cambia. - verde - Falliti: 0
- 2026-10-14 - Claude - app v144 / Setup 1.0.144. Cinque lavori in un giro.
  (1) REPLAY IN LIVE, chiusura dei difetti visti dal proprietario: col PLAY la candela si forma
  davvero a schermo (getViewWindow riserva la colonna extra anche con liveReplayActive: prima lo
  spazio non c'era e il clip di draw() tagliava via il corpo, si muoveva solo l'etichetta
  dell'asse); via la casellina verde/rossa dalla candela in formazione; posizioni reali, ordini
  pendenti, disegni ed etichette dell'asse si rivelano solo quando il replay raggiunge il loro
  momento (posRevealedInReplay, createdAt sugli ordini); COB e SVP spenti in replay; il conto
  alla rovescia scorre col moltiplicatore (replayForm.sub su replaySecondsPerBar); i timer da 1 s
  non ridisegnano piu'. CORRETTO QUI un difetto del giro precedente: nel timer MT5 le graffe
  mancavano (`if(!liveReplayActive)update();draw();`), quindi draw() girava comunque.
  Test: replay_live.test.mjs 7) + asserzioni statiche nel 5).
  (2) PROP FIRM DELLA CRONOLOGIA SALE: il riferimento e' SEMPRE il conto iniziale scritto nel
  campo, non il capitale a cui la sala era arrivata il giorno dell'apertura (la curva dopo
  l'apertura si riporta su quel conto: le percentuali non cambiano, gli euro e l'obiettivo +10%
  si'); la data di apertura torna vuota ogni volta che si ACCENDE l'interruttore e quando si
  conferma il pop-up «Prop firm sbloccata» (solo se il pop-up veniva da qui: lo stesso pulsante
  lo usano anche MT5 reale e Kraken). Test: prop_firm_cronologia.test.mjs (6 nuovi).
  (3) APERTURA AUTOMATICA, SU QUALI CONTI MT5: nuova sezione nella configurazione. Si spuntano i
  conti su cui le sale possono aprire da sole (nessuna spunta = come prima, il conto collegato) e
  tre interruttori: passa da sola al conto scelto, apri su tutti i conti scelti, torna al conto
  che stavi guardando. Il cambio passa da connectToMt5Bridge, cioe' dalla stessa strada della
  tendina dei conti (mt5AttivaConto mette da parte le posizioni degli altri conti).
  Test: conti_automatici.test.mjs (10, prima rossi).
  (4) INDICATORI NASCOSTI: non vengono piu' calcolati (prima si saltava solo il disegno, e dieci
  indicatori spenti costavano come dieci accesi). Riaccendendoli il calcolo incrementale recupera
  da solo. Test: indicatori_nascosti.test.mjs (3).
  (5) FOOTPRINT A SCALA UNIFORME, in sostituzione delle righe fisse per candela: tolto
  footprintResliceFisse, il passo e' uno solo per tutto il grafico (quello dei bucket), quindi una
  candela corta mostra meno righe e una lunga di piu', tutte alte uguali e con lo stesso testo.
  Test: footprint_globale.test.mjs (3 nuovi, al posto dei 2 sulle righe fisse).
  - verde - Falliti: 0
- 2026-10-14 - Claude - app v145 / Setup 1.0.145. Segnalato dal proprietario con due foto: in
  replay "rimane quel blocco verde e il blocco rosso" e "la linea del prezzo bianca rimane
  fissa, ferma". Due difetti veri, nessuno dei quali era un problema di avanzamento:
  (1) in replayDisegnaFormazione la larghezza del corpo era
  `Math.min(tetto, padH*.62)`, cioe' il 62% di TUTTA l'area del grafico invece che di UNA
  colonna. Col footprint acceso il tetto e' 90 px: usciva un rettangolo largo 90 accanto a
  candele larghe 12 - un blocco, non una candela. Ora e' la stessa formula di draw(),
  `cw/n*.62`. Nello stesso punto: colori presi da currentCandleColors() invece dei due fissi
  #2e8b57/#d64545 (accanto a candele blu e bianche sembrava un'altra cosa) e stoppino pieno del
  colore del corpo invece che al 35% di opacita'.
  (2) la linea del prezzo corrente, con la sua etichetta sull'asse, usava sempre
  rows[idx].close, cioe' la chiusura dell'ultima candela RIVELATA: in replay restava ferma
  mentre la candela successiva si formava, e il movimento si vedeva solo da una riga
  tratteggiata colorata disegnata in piu' ("un'altra linea aggiuntiva"). Ora c'e'
  replayPrezzoFormazione(): in replay la linea principale segue la formazione, e la riga
  tratteggiata in piu' e' stata tolta perche' diceva la stessa cosa due volte.
  Test: replay_live.test.mjs 8) e 9), provati rossi rimettendo il vecchio codice. - verde - Falliti: 0
  Nello stesso giro (v145), footprint - segnalato con una foto: "ci sono piu' livelli di
  footprint, mentre invece deve esserci soltanto un livello, e' tutto sparpagliato... devono
  essere visualizzati soltanto a fianco alla candela e non sopra, sotto". Due cause distinte:
  (a) le righe nascono dai TICK e possono cadere FUORI dall'alta/bassa della candela disegnata
  (candele dall'OHLC del broker, tick dal feed, piu' l'arrotondamento al passo che sposta fino a
  mezza riga). Finche' c'era footprintResliceFisse venivano schiacciate dentro per forza; tolto
  quello (v144, scala uniforme) sono rimaste fuori. Ora footprintDentroLaCandela le riporta
  dentro SOMMANDOLE alla riga di bordo: il volume non si perde e il disegno non esce.
  (b) ogni bucket si porta dietro il passo con cui e' stato costruito (bucket.step) e il disegno
  usava QUELLO: due candele costruite con passi diversi - dopo un cambio del passo automatico, e
  sempre con le celle gia' aggregate che arrivano dal backup cloud di un ALTRO dispositivo, dove
  il passo era un altro - finivano sullo stesso grafico con righe alte in modo diverso. E' il
  "piu' livelli" della segnalazione. Ora il passo GLOBALE vince: draw() lo calcola una volta
  (_footprintStepGlobale) e lo passa, e un bucket con un passo diverso viene riportato su quella
  griglia prima di essere disegnato.
  E il footprint vive anche in REPLAY (richiesto): la candela in formazione accumula le sue righe
  sulla STESSA griglia globale, con le stesse celle (replayAvviaFormazione + replaySubAccumulo), e
  si disegna con lo stesso drawFootprintCandle delle candele vere invece che con l'istogramma di
  trattini che aveva prima: cresce un secondo alla volta insieme alla candela.
  Test: footprint_scala_unica.test.mjs (6, nuovo; il quarto va rosso togliendo il confinamento).
  Ancora nella v145, cinque richieste del proprietario in un giro.
  (1) CRONOLOGIA DELLE SALE A GRAFICO: resta su QUESTO dispositivo. Due cose la facevano
  viaggiare: fblCronoDisegna guardava solo vista.sala e l'asset A GRAFICO (e l'asset a grafico si
  sincronizza fra i dispositivi), quindi bastava finire su un asset con dei risultati salvati per
  quella sala e ricompariva da sola; e la chiave di salvataggio era uguale su tutti. Ora si
  disegna solo se currentAssetKey===vista.asset e la chiave e' fbl_crono_vista:<idDispositivo>.
  In piu': pulsante «Togli dal grafico», e il cambio di sala toglie da solo quella di prima
  (prima azzerava solo vista.asset e la sala restava).
  (2) PULSANTE «Salva come strategia della sala» nella resa: porta rischio, metodologia,
  distribuzione equa, percentuali e spostamenti dello stop dentro tgAuto.sale[sala] della famiglia
  dell'asset analizzato (le due apertura automatiche sono separate: scrivere in tutt'e due
  sovrascriverebbe una scelta fatta apposta). Avvisa se la strategia universale e' accesa.
  (3) SYNTRA, UTENTI ESCLUSI: syntraEsclusi + syntraEscluso(), controllati in tgMessaggioSegnali
  SUBITO DOPO syntraVisto() - cosi' il messaggio non diventa un segnale ma l'utente entra lo
  stesso nell'elenco, da dove si riammette. Confronto senza maiuscole e senza il prefisso
  «Syntra · »: una esclusione che non scatta per una lettera e' peggio di nessuna esclusione.
  (4) FAMIGLIA DELL'ASSET nelle posizioni aperte e nel Trade Journal (fblFamigliaBadgeHtml):
  ricavata dall'asset con tgFamDaSimbolo, non da un campo salvato, cosi' vale anche per le
  operazioni vecchie e non puo' mai essere in disaccordo con lo strumento vero.
  (5) GRUPPI DI POSIZIONI: pulsanti BE e Chiudi sulla riga del gruppo. BE usa
  applyBreakevenToPosition su tutte; Chiudi riusa fblChiudiBlocco (che gia' chiede conferma
  dicendo quante sono e quanto fanno) e ora dice anche a chiusura avvenuta QUANTO ha reso. Solo
  sulla sessione a schermo: le altre tre non hanno le loro posizioni in `positions`.
  Test: cronologia_locale (4), strategia_dalla_resa (2), syntra_esclusi (3), famiglia_asset (2),
  gruppi_be_chiudi (4).
  Ancora v145, quarta tornata.
  (a) SEGNALE "ENTRY @ 176.755" di EasyForexPips che il proprietario dava per non riconosciuto:
  provato, il parser DI QUESTO REPO lo legge bene, @ compreso, in tutte le varianti (spazi
  insecabili, CRLF, ENTRY@176.755, ENTRY: @ ..., virgola decimale). Non c'era niente da
  correggere: il parser che gira sul computer e' quello del SETUP, non quello del repo - serve
  reinstallare. Il caso e' entrato lo stesso in test_formati_reali.py come guard-rail.
  ATTENZIONE: nello scriverlo ho aggiunto una classe unittest DOPO il sys.exit finale del file:
  codice morto che non girava mai. Tolta. In quel file i casi si aggiungono a CASI, non come
  classi.
  (b) SYNTRA, "legge RR come asset": l'asset si prendeva con due regole deboli (la prima riga con
  una barra, e come ripiego il PRIMO testo in ordine di documento nella meta' sinistra). "RR" sta
  in alto a sinistra, e' corto e non ha barra: passava. Ora asset_valido() (elenco di etichette
  che non sono mai un simbolo + controllo di forma: niente numeri, niente 1:2, almeno due lettere)
  e scegli_asset() che prende il piu' in ALTO e, a pari altezza, il piu' a SINISTRA - come chiesto.
  In piu' una rete di sicurezza in segnale(): un simbolo senza forma di simbolo non diventa un
  ordine. Effetto collaterale utile: le schede CRIPTO senza barra (BTCUSDT) ora trovano l'asset.
  (c) RESA DELLA SALA: anche il massimo calo in una sola giornata, accanto al calo dal picco.
  (d) DASHBOARD, profitto per sala: resa %, guadagno medio, R/R e calo massimo nel riquadro e in
  tabella.
  Test: test_formati_reali.py (+1 caso), ponte/test_syntra_asset.py (7, nuovo),
  resa_drawdown_giornaliero (3), sala_metriche (3).
  DA FARE, chiesto e NON fatto in questo giro: cronologia Syntra via Classifica (navigazione
  nell'app), cripto non rilevate dalle notifiche (serve un dump XML vero: syntra_diagnosi.py),
  storico Syntra locale dentro la pagina della cronologia, profilo volumetrico che salta sabato e
  domenica sugli asset che chiudono nel weekend, e il setup chiavi-in-mano per un utente nuovo.
  Quinta tornata v145 - SYNTRA, rifatto il modo di riconoscere le cose. Il proprietario ha chiesto
  che "funzioni perfettamente, senza problemi di riconoscimento utente, asset, prezzi,
  cronologia". La causa comune di tutti i difetti era la stessa: si riconosceva per POSIZIONE
  ("il primo testo in alto a sinistra", "il nodo nella meta' destra"), e bastava una scheda
  fatta un po' diversa - una cripto, un'azione - per leggere la cosa sbagliata senza accorgersene.
  Ora c'e' tipo_riga(): ogni riga si classifica da quello che DICE (data, lato, tipo, etichetta,
  tp, sl, stato, qualita, rr, comando, icona, numero, asset), e la posizione resta solo come
  spareggio fra due candidati ugualmente validi. Su quello poggiano scegli_asset() e
  scegli_utente(). Corretti nello stesso giro i due difetti che facevano sparire i segnali cripto
  (data senza anno, e `or 0` che trasformava una data ignota in "vecchissima") e i prezzi con
  etichetta e numero in nodi separati. Test: ponte/test_syntra_notifiche.py (5, nuovo),
  ponte/test_syntra_asset.py (12, era 7).
  AVVIATO E NON FINITO: server_oracle/multiutente.py - la base del punto A (piu' utenti sullo
  stesso server, col PC che apre LUI il canale verso il server invece di farsi chiamare via
  Tailscale, che per il PC di un altro utente non si puo' fare). Il modulo c'e' ed e' commentato,
  ma NON e' ancora collegato a ponte_server.py ne' all'app: non cambia niente di quello che gira.
- 2026-10-14 - Claude - app v146 / Setup 1.0.146. Due difetti della selezione delle posizioni,
- 2026-10-19 - Claude - app v2.0.4 / Setup 2.0.4. Molte correzioni su app.html, index.html, sw.js, installer.iss, mt5_feed_server.py, bridge.py:
  1. Lottaggio non si scrive più da solo posizionando lo stop (difetto misurato: 0,07→0,05).
  2. Cambio asset: mai due grafici, posizioni sulla scala giusta (difetto misurato: XAUUSD a 4000 su fascia AUDCAD 0,98).
  3. Etichette TP1/TP2/TP3 e SL con origine (sala/manuale/sala di prova/non riconosciuta) sulle caselle grafiche.
  4. Cronologia delle sale spostata fuori da Style, voce propria nella barra di sinistra con pop-up invariato.
  5. Toggle: «mostra/nascondi etichette TP SL stop profit».
  6. Tetti rischio/capitale e dello stop portati al 100% (cripto e forex).
  7. Caricamento candele ridotto da 200.000 a max 5.000 (fattore 40 in meno di traffico).
  8. Guardia freschezza server: rifiuta tick >24h, risolve sfascio di 48 ore sul grafico a mercato chiuso.
  9. Orario vicino al numero ID: «apertura» per posizioni, «inserimento» per ordini pendenti.
  10. Pannello «Accesso da altri dispositivi»: tolta sezione passo-passo Tailscale, riquadro chiave computer e campi nome/chiave visibili; tutto passa dal server.
  11. Pulsante «Avvia i 7 Giorni Gratuiti»: scelta esplicita Android / iPhone-iPad-Mac / PC invece di indovinare il dispositivo.
  Test: 21 prove nuove (lottaggio 5, cambio asset 3, etichette 6, ponte 105), collaudo browser in corso.
  segnalati insieme. (1) Una posizione si sceglieva da sola e nascondeva le altre: `active` faceva
  due mestieri (vedi BUG.md). Separato in `posSelezionata`, che la mette solo un clic. (2) Col dito
  il tocco sul vuoto non deselezionava: il gestore di pointerup esce prima per il touch e il blocco
  stava dopo. Estratto in fblClickSuVuoto() e chiamato da tutti e due i rami - stesso difetto gia'
  pagato sulla stessa uscita anticipata col cambio stile del footprint, ed e' la seconda volta:
  quella uscita anticipata e' un posto in cui vale la pena guardare ogni volta che qualcosa
  "funziona col mouse ma non col dito".
  Test: selezione_posizioni.test.mjs (4; tre vanno rossi col vecchio codice, il quarto - il clic
  che seleziona davvero - resta verde perche' quello funzionava gia').
  Nella stessa v146: le bandiere delle notizie non si vedevano su telefono e tablet. Il polling
  partiva solo da due strade, nessuna delle quali esiste su un telefono (vedi BUG.md). Corretto
  allineando il polling allo stato invece che alla strada percorsa. E' la terza volta in due giorni
  che il difetto e' della stessa forma: una cosa agganciata a UNA strada invece che al punto che
  tutte le strade attraversano (prima l'uscita anticipata del pointerup, due volte).
  Test: notizie_altri_dispositivi.test.mjs (3; due vanno rossi senza la correzione).
  Ancora v146: colonne COB/SVP. Il passo delle righe arrivava dall'impostazione del footprint, che
  e' tarata sull'altezza di una candela: da qui righe altissime su EUR/USD, fitte su XAU, sparse
  sulle cripto. Ora si decide in pixel e si arrotonda a un passo tondo dello strumento, cosi' le
  colonne hanno lo stesso aspetto ovunque. Test: cob_svp_scala.test.mjs (4).
  NOTA per il futuro: a questa densita' i numeri dentro le colonne (showNums, soglia 10 px) non
  compaiono piu'. E' voluto - su XAU, che il proprietario ha indicato come "giusto", non si
  vedevano gia' - ma se li rivuole servira' un'impostazione per l'altezza di riga, non il ritorno
  al passo del footprint.
  Ancora v146, tre cose. (1) ARCHIVIO DEL FOOTPRINT: il footprint si ricostruiva sempre dal log
  dei tick, che ha un tetto di 150.000 tick per asset e scarta i piu' vecchi: su 4h o 1D restavano
  solo le ultime candele. Ora si conservano le celle gia' aggregate AL MINUTO (poche centinaia di
  byte l'una) su IndexedDB, una chiave per asset e per giorno, per 60 giorni; da li' si costruisce
  qualunque timeframe sommando i minuti, ri-aggregati sul passo del momento. L'archivio vale fino
  al primo tick ancora in memoria, poi comanda il log: niente doppi conteggi.
  Test: footprint_archivio.test.mjs (5).
  (2) POSIZIONE SELEZIONATA: delle altre restano le linee di stop e target con le etichette, in
  grigio (prima sparivano del tutto, v142), mentre il riempimento colorato resta solo a quella
  scelta. drawTpSlZoneBox sapeva gia' disegnare 'spento': bastava smettere di saltarla e spegnere
  il riempimento quando dimmed. I test di selezione_posizioni sono stati riscritti sulla sonda
  nuova (quante posizioni vengono disegnate in grigio) perche' quella vecchia misurava il
  comportamento superato.
  (3) CRONOLOGIA: cerchietto di avanzamento accanto al pulsante mentre scarica le candele, con la
  percentuale vera (binanceKlines ora dice quanti blocchi ha preso) e cosa sta scaricando.
  Test: cronologia_avanzamento.test.mjs (3).
  Ancora v146, due cose sul PONTE (girano dal Setup, non dal repo: serve il reinstaller).
  (1) SYNTRA, LA STRADA DELLA CLASSIFICA. Il proprietario ha descritto la procedura guardando
  l'app e ha mandato le foto: Classifica (in fondo) -> si scorre fino all'utente -> si entra nel
  profilo ('Info sul fornitore di setup') -> si scorrono i setup espandendo 'Vedi dettagli TP/SL'
  fino al periodo chiesto. Prima leggi_profilo cercava il nome su una SUA scheda gia' visibile nel
  riquadro dei setup: se non aveva pubblicato di recente - o se si era sulle Notifiche, che e' la
  modalita' predefinita - quel nome a schermo non c'era e la lettura moriva con 'nome non trovato'.
  Aggiunte leggi_classifica(), e_pagina_profilo(), stesso_utente_syntra() (la classifica scrive
  'Gino', il profilo 'Gino - SGM FREE', l'app 'Syntra . Gino'), apri_classifica() e
  cerca_in_classifica() che smette di scorrere quando la pagina non cambia piu'. I due test del
  profilo sono stati riscritti sulla strada nuova, con XML che ricalcano le foto vere.
  (2) IL TERMINALE MT5 SI RIDUCE A ICONA dopo ogni /connect (primo collegamento e cambio conto):
  prima si riapriva a tutto schermo ogni volta. Il tentativo non puo' far fallire il collegamento:
  se non riesce lo dice nella risposta (terminale_ridotto / terminale_ridotto_detail).
  Test: ponte/test_profilo_syntra.py (8, era 5), ponte/test_mt5_finestra.py (4, nuovo).

## 14 ottobre 2026 - v147: il replay e le posizioni
  RICHIESTO: "in modalita' replay, quando avanza col play, le linee delle posizioni devono essere
  sincronizzate alla velocita' di aggiornamento selezionata; devono vedersi entry, TP e stop loss
  con i relativi valori di guadagno/perdita; e devono vedersi gli spostamenti mano a mano: si deve
  ricordare ogni movimento che e' stato fatto".
  (1) NON SEGUIVANO L'AVANZAMENTO. P/L, connettore e bordo delle caselle Target/Stop passavano
  tutti da currentPrice(), che e' rows[idx].close: la chiusura dell'ultima candela COMPIUTA.
  Dentro la formazione quel numero non cambia mai, quindi facevano un salto secco una volta per
  candela qualunque fosse il moltiplicatore. Ora leggono prezzoMostratoOra() (il prezzo svelato
  finora, lo stesso che muove la linea bianca da ieri) e keepPaceIdx porta la FRAZIONE di candela
  svelata, cosi' il bordo destro avanza con la formazione invece di scattare.
  (2) DEGLI SPOSTAMENTI NON RESTAVA TRACCIA DA NESSUNA PARTE. Una posizione portava solo i livelli
  ATTUALI: uno stop alzato tre volte lasciava il valore finale, e rivedendo quel trade in replay si
  vedeva lo stop di oggi su candele di ieri. Ogni posizione ora tiene storiaLivelli (una riga per
  movimento, tetto 400) e il disegno rilegge i livelli in forza all'istante mostrato
  (posLivelliAlTempo): linee, etichette, caselle e etichette sulla scala prezzi, tutte dalla stessa
  fonte. Si registra IN UN PUNTO SOLO, in testa a draw(): stop e target vengono cambiati da dieci
  strade diverse (trascinamento, tabella, pareggio, trailing, allineamento MT5, e il terminale MT5
  stesso da fuori dall'app) e draw() e' il punto che tutte attraversano subito dopo. La storia
  viaggia con la posizione nel salvataggio, quindi sopravvive al ricaricamento.
  (3) In replay il P/L non e' piu' il netto del terminale MT5: quello e' il profitto di ADESSO, al
  prezzo di adesso, mentre a grafico si sta guardando un altro momento.
  BUG MIO, preso dal test: Number(null) fa 0 e passa Number.isFinite, quindi "nessun istante"
  diventava l'istante zero (1970) e fuori dal replay si disegnavano per sempre i livelli di
  APERTURA. Stesso inganno del `nt["quando"] or 0` del lettore Syntra, in un'altra lingua.
  Test: replay_posizioni.test.mjs (5).

## 14 ottobre 2026 - v147 (seconda parte): il lampeggio, e il TP1
  (1) LA CANDELA IN FORMAZIONE LAMPEGGIAVA. Segnalato: "si accende e si spegne subito, ad ogni
  aggiornamento; quelle completate vanno bene, il problema e' l'ultima". LA CAUSA: era un RITOCCO
  applicato DOPO draw(), e lo applicava solo il battito del replay. Ogni altro ridisegno - il
  mirino, il pannello, e soprattutto forward() ad ogni candela completata - ridipingeva il grafico
  SENZA di lei. Piu' si alzava il moltiplicatore, piu' spesso le candele si completavano, piu'
  spesso il grafico veniva dipinto "senza": ecco perche' peggiorava accelerando. Ora la disegna
  draw() stesso, in fondo all'area protetta: non esiste piu' un modo di dipingere il grafico senza.
  (2) IL PLAY CHE "A VOLTE SI BLOCCA", soprattutto su un'altra scheda. Il battito dava per scontati
  50 ms fra un giro e l'altro; sulle schede non in primo piano i browser rallentano i timer a uno
  al secondo, quindi si avanzavano 50 ms di mercato ogni 1000 di orologio - venti volte piu' lento,
  che visto da fuori e' "bloccato". Ora si misura l'orologio vero (replayElapsedMs), con un tetto a
  5 secondi per non tentare di recuperare un'assenza lunghissima in un colpo solo.
  (3) SCATTI AI MOLTIPLICATORI ALTI: ogni candela completata dentro un giro si portava dietro un
  draw() e un update() interi. forward(true) ora e' silenzioso (valuta tutto, non disegna) e il
  battito disegna una volta sola alla fine.
  Test: replay_fluido.test.mjs (4). L'invariante provata non e' "quante volte lampeggia" (non si
  saprebbe contare): e' che nessun draw() puo' concludersi senza la candela in formazione.
  (4) IL TP1 E' SEMPRE IL PIU' VICINO ALL'ENTRATA. Richiesto: "se una sala scrive i TP al
  contrario li deve numerare bene lo stesso". Non c'era NESSUN ordinamento: si teneva l'ordine di
  scrittura della sala. Il caso vero (oro): TP 4130, 4115, 4096, 4092, 4088 su un BUY a 4085 -
  TP1 diventava 4130, l'ultimo obiettivo. E non e' un'etichetta: la strategia sposta gli stop
  "quando il prezzo raggiunge il take profit n.1". Ora tgTpInOrdine() ordina per direzione (BUY
  crescente, SELL decrescente) ed e' l'unica strada: pannello, finestra di configurazione e
  apertura vera passano tutte di li'.
  (5) IL RIFIUTO DELLO STOP DICEVA IL NUMERO SBAGLIATO. Segnalato: "IMPOSSIBILE, il prezzo e' a
  4090". Il messaggio chiamava "prezzo di adesso" il valore `entry`, che per un ordine PENDENTE e'
  il prezzo scritto dalla sala, non il mercato. Ora dice quale numero sta guardando, mostra anche
  il mercato vero quando e' diverso, e dice da che parte dovrebbe stare lo stop. Il controllo in
  se' restava giusto: su quel segnale di prova lo stop (4175) era davvero sopra l'entrata di un
  BUY, cioe' dalla parte sbagliata.
  Test: tp_in_ordine.test.mjs (4).

## 14 ottobre 2026 - v148: sale sulle notizie, e Kraken sui dispositivi mobili
  (1) SALE SULLE NOTIZIE IMPORTANTI (richiesto): nuova carta nella dashboard. Per ogni sala, le
  operazioni APERTE entro mezz'ora da un dato a gravita' rossa che tocca una valuta del suo asset,
  con il confronto fra quella sala sulle notizie e la stessa sala fuori: e' il confronto a
  rispondere alla domanda, perche' una sala puo' guadagnare di piu' sulle notizie solo perche'
  opera di piu'. Serviva un ARCHIVIO: newsEvents e' l'ultima fotografia del calendario e viene
  sostituita ad ogni aggiornamento, quindi le notizie importanti si conservano man mano che
  arrivano (stessa idea dell'archivio footprint). Limite detto: parte da questa versione.
  Test: sale_notizie.test.mjs (5), compreso il disegno vero della carta.
  (2) POSIZIONI KRAKEN SU TELEFONO E TABLET (segnalato): "non mi mostra piu' TP e SL, solo
  l'entrata e il P/L; e vai a grafico non carica l'asset". TRE difetti diversi.
  (a) I livelli si prendono dagli ordini veri su Kraken e, quando li' non ci sono - sempre, se a
  gestirli e' l'app - si ripiegava su tgStrategie, che e' DI PROPOSITO del solo dispositivo che ha
  aperto ("e' stato, non configurazione", sta scritto accanto a GRAFICO_LS). Sul telefono quella
  voce non esiste. Ora i LIVELLI si pubblicano in fb_kraken_livelli, condivisa e in sola lettura
  per chi la riceve: il motore delle strategie resta dov'era, perche' due dispositivi che muovono
  lo stesso stop sarebbero peggio del problema.
  (b) `sl: null` dal ponte diventava uno stop a PREZZO ZERO (Number(null) fa 0): quarta volta con
  questo inganno. Ora krakenPrezzo() chiede che il valore ci sia e sia maggiore di zero.
  (c) "Vai a grafico": tutti e quattro i punti chiamavano loadLiveHistoryFromCapital, che comincia
  con `if(!capitalSessionTokens)return;` - e su un telefono quella sessione non c'e'. Usciva in
  silenzio: niente errore, niente candele, il menu sul nuovo asset e il grafico sul vecchio. Ora
  caricaStoricoPerSaltoAGrafico() sceglie la fonte come il cambio timeframe, ripiega sulla
  libreria, e CONTROLLA il risultato con rowsAssetKey.
  (d) In piu': la casella Target/Stop non e' piu' chiusa dentro `if(openIdx!=null)`.
  Test: kraken_mobile.test.mjs (7).

## 14 ottobre 2026 - v149: Kraken, lo stop spostato scambiato per uno stop eseguito
  SEGNALATO (BNBUSD, SELL da 734.95, quattro TP): "ha preso il primo e ha chiuso in parziale; i pip
  mi segna 0.0, il conto mi dice NaN, e adesso non vedo piu' ne' stop loss ne' TP".
  (1) LA CORSA. krakenStrategieValuta decide "stop eseguito" guardando se st.stopId e' ancora fra
  gli ordini aperti. Ma appena un TP viene colpito la strategia SPOSTA lo stop, e spostarlo vuol
  dire cancellare l'ordine e piazzarne un altro: per un istante il vecchio id non c'e' piu' e il
  nuovo non e' ancora nella fotografia. Un giro con la fotografia di PRIMA cancellava i TP rimasti,
  scriveva la chiusura e cancellava la strategia - ed e' esattamente quello che e' successo dopo il
  primo TP. Ora st.toccatoAt segna l'istante della nostra mossa e una lettura piu' vecchia di
  quella non puo' decidere niente.
  (2) `pips:0` scritto fisso nella riga di Journal: "+0.0" per qualunque operazione cripto. Ora si
  calcola con pipsFromPrice e i decimali veri dell'asset.
  (3) `account:'kraken'` - ma quella colonna passa da euro(), e una stringa non e' un numero: in
  tabella si leggeva "NaN EUR". Ora e' il saldo vero convertito in euro, come il P/L della riga.
  Che il conto sia Kraken si sa gia' da krakenConto/krakenChiave (quello che guarda la dashboard).
  Test: kraken_journal.test.mjs (3).
  RESTA APERTO, non ancora risolto: il comportamento a mercato chiuso (posizioni e footprint che si
  sfalsano) e la costruzione del footprint in replay. Trovato per ora un indizio e un difetto
  vicino: fblAllineaRigheSera() e liveOffSessionRowsFor() sono CODICE MORTO (definite, mai
  chiamate), quindi le candele serali salvate in OFFSESSION_ROWS_KEY non vengono mai riusate.

## 15 ottobre 2026 - v150: Syntra, il profilo che non leggeva niente
  SEGNALATO: "il robot fa la procedura giusta - classifica, utente, profilo - pero' una volta sul
  profilo non esegue piu' nulla", e l'app riceveva "0 operazioni lette, 3 in archivio".
  LA CAUSA, un cane che si morde la coda: leggi_schermata() riconosce una scheda SOLO se contiene
  la riga "Entrata:", che c'e' solo a dettaglio APERTO. Sul profilo le operazioni arrivano CHIUSE.
  I pulsanti "Vedi dettagli TP/SL" venivano pero' cercati DENTRO le schede gia' riconosciute
  (sc["toggle"]): nessuna scheda riconosciuta -> nessun pulsante -> niente da espandere -> niente
  da riconoscere. E lo scorrimento si calcolava dall'ingombro delle schede, quindi senza schede non
  avveniva nemmeno: si restava fermi sulla stessa schermata per tutte le pagine previste.
  (1) trova_espansori() cerca i pulsanti NELL'ALBERO INTERO, e si espande una posizione per volta
  dall'alto in basso finche' ce ne sono; ci si ferma da soli se un tocco non cambia piu' niente.
  (2) Si scorre anche senza schede riconosciute (due terzi di schermo), ma dopo tre schermate vuote
  di fila ci si ferma: non e' la pagina che pensiamo di avere davanti.
  (3) Si smette quando due schermate di fila mostrano le stesse operazioni (stessa idea gia' usata
  per la classifica).
  (4) Il profilo ha il suo tetto di schermate: 60, non le 2 del giro delle notifiche - a fermarlo
  deve essere il PERIODO chiesto, non un numero deciso a tavolino.
  (5) syntra_viva(): se l'app e' stata chiusa a forza si riapre. Il controllo che esisteva gira
  ogni 30 s nel ciclo principale, ma un profilo si legge in MINUTI dentro un solo giro di quel
  ciclo, quindi proprio mentre serviva non arrivava mai. Serve anche a non toccare lo schermo AL
  BUIO: con Syntra morta, un tocco a coordinate fisse preme quello che c'e' sotto.
  Test: ponte/test_profilo_espansione.py (9), con un emulatore finto che si comporta come quello
  vero: classifica, poi profilo, schede chiuse che si aprono al tocco.

## 15 ottobre 2026 - v150 (seconda parte): il TP1 anche su Kraken e nella cronologia
  SEGNALATO con un caso vero (SELL BNB/USD da 730, target 725-720-711-702): a grafico "TP1" stava
  a 702 e "TP4" a 725, al contrario. In v147 l'ordinamento era stato messo sui segnali Telegram, ma
  restavano TRE punti che si costruivano la lista da soli: la tabella delle posizioni Kraken, il
  loro disegno a grafico, e la cronologia delle sale.
  La causa: il ponte Kraken manda i take profit ordinati per PREZZO crescente, sempre, qualunque
  sia il lato (kraken_ordini.py: sorted(tps, key=prezzo)). Su un SELL il primo della lista e' quindi
  il piu' lontano dall'entrata.
  Nella cronologia non era solo un'etichetta: i TP raggiunti si contano scorrendo quella lista IN
  ORDINE (`while(... c.h>=tps[k+nuovi] ...)`), quindi l'ordine sbagliato falsava il conteggio, il
  win rate per TP e tutte le statistiche della pagina - non solo le scritte a grafico.
  Lezione, la stessa di stamattina in un'altra forma: corretto un punto, vanno cercati gli altri
  che fanno la stessa cosa invece di fidarsi che fosse l'unico.
  Test: tp_in_ordine.test.mjs (6, erano 4).

## 15 ottobre 2026 - v151: ordini pendenti a grafico, e il margine su Kraken
  (1) ORDINI PENDENTI (richiesto): l'etichetta a grafico diceva lato, tipo e prezzo ma non QUANTO -
  per saperlo bisognava aprire la tabella. Ora c'e' il lottaggio. E scegliendo una posizione gli
  ordini pendenti si spengono come le altre posizioni: le loro righe di stop e target spariscono
  del tutto (attraversano tutto il grafico, ed erano proprio quelle che impedivano di leggere la
  posizione scelta), l'entrata resta spenta. Si riusa activeOnChart, la stessa identica condizione
  delle posizioni: non una seconda regola scritta a parte.
  Test: ordini_pendenti_grafico.test.mjs (4).
  (2) KRAKEN, IL MARGINE. Segnalato: "conto da 10.000, nella sala ho impostato il 2%: come mai ha
  usato 5.839 di margine?". NON era un errore di calcolo, ed e' importante che resti scritto: il 2%
  e' il RISCHIO (quanto si perde allo stop), la quantita' esce da li' (rischio diviso la distanza
  dallo stop) e il margine e' una conseguenza di prezzo e leva. Con stop a 10 punti su 730: 20
  monete, 14.600 di valore, 7.300 di margine a leva 2x. Stop stretto + leva bassa = molto margine
  per poco rischio.
  Mancava il modo di metterci un tetto: ora c'e' "Margine massimo per operazione, % del conto",
  rispettato dal lottaggio consigliato e dai segnali. Sui segnali il piano viene RICALCOLATO con un
  rischio ridotto della stessa proporzione, cosi' minimi del contratto e fette per ogni target
  restano coerenti invece di essere aggiustati a posteriori; la riduzione si legge nella scheda del
  segnale, mai in silenzio. 100% = nessun tetto, come prima.
  VERIFICATO, perche' era la domanda vera: la formula del rischio e' GIA' la stessa di MT5 -
  importo di rischio diviso la perdita per unita' (MT5: riskAmount/lossPerLot, Kraken:
  riskAmount/dist, dove dist e' la perdita per una moneta). A cambiare e' solo cosa vale "una
  unita'". C'e' un test che lo fissa, cosi' le due strade non possono divergere in silenzio.
  Test: kraken_margine.test.mjs (5).

## 15 ottobre 2026 - v152: Kraken ancorato alla candela vera, Syntra che non si ferma al primo
  (1) POSIZIONI KRAKEN STACCATE DALLE CANDELE (segnalato con foto: "il punto d'entrata non combacia
  con le candele, la posizione e' stata aperta in una parte dove il grafico non l'ha toccata").
  LA CAUSA stava nel PONTE, non nel disegno: /kraken/posizioni non diceva quando la posizione era
  stata aperta. Kraken lo manda in "fillTime" ma non veniva letto, quindi l'app ripiegava sulla
  data di creazione della STRATEGIA (che su un altro dispositivo non esiste) e in ultimo su "venti
  candele prima della fine" - un punto qualunque. Ora il ponte manda aperta_ms, e anche il conto
  simulato si segna l'istante di apertura (e lo rinnova quando la posizione si gira dall'altra
  parte, perche' quella e' una posizione nuova).
  Tornano anche la FRECCIA di apertura e la LINEA fino al prezzo di adesso, che per le posizioni
  Kraken non erano mai state disegnate. Si disegnano SOLO con l'orario vero (origineVera): con un
  ripiego indicherebbero una candela a caso, che e' peggio di non indicarne nessuna.
  (2) "VAI A GRAFICO" PORTA ANCHE SUL CONTO (richiesto): fblContoDiOperazione() riconosce da com'e'
  fatta se un'operazione e' Kraken, MT5 o Capital, e fblVaiAlContoDi() porta l'app li' prima di
  caricare l'asset (dopo vorrebbe dire caricarlo due volte). Una simulata non cambia niente: non
  appartiene a nessun conto vero. Test: conto_al_salto.test.mjs (3).
  (3) SYNTRA: IL DETTAGLIO CHE APRE UNA PAGINA. Segnalato: "apre la prima posizione, legge i valori
  e basta". Toccare "Vedi dettagli TP/SL" spesso non espande sul posto: apre una PAGINA A SE'. Da
  li' non c'erano piu' pulsanti da toccare, si leggeva quell'unica operazione, e alla schermata dopo
  la pagina era sempre quella: due letture uguali = "non scorre piu'", e via. Ora si riconosce il
  caso (e_pagina_profilo dopo il tocco), si legge quella pagina, si torna indietro e si riprende
  dalla posizione seguente; se il tasto indietro non riporta sul profilo ci si ferma invece di
  toccare al buio. Test: ponte/test_profilo_espansione.py (13, erano 9), compreso un test ad ALBERO
  (ast) che fissa il vincolo "mentre legge la cronologia non tocca le notifiche": i due rami sono
  alternativi nello stesso if, quindi non e' una promessa in un commento ma la forma del codice.
  NOTA DI METODO: su app.html (4,6 MB) non si usa assert.match - quando fallisce stampa l'INTERO
  file e il messaggio vero si perde. Si prova la condizione e si scrive a mano cosa mancava.

## 15 ottobre 2026 - v153: i segnali cripto su Kraken, origine e tipo, conti chiusi
  (1) SEGNALE CRIPTO APERTO SU CAPITAL.COM invece che su Kraken (segnalato). DUE buchi:
  (a) krakenOrdiniAttivi() partiva SPENTA; da spenta tgContoPerSegnale ricadeva su 'mt5', e
  tgContoEffettivoPerSegnale, non trovando lo strumento su MT5, dirottava su 'capital'. Ora parte
  accesa (il valore '0' scritto a mano resta rispettato).
  (b) Tutto il riconoscimento delle cripto passava da binanceSymbolForAsset(), cioe' da una TABELLA
  DI NOMI: una moneta scritta in una forma non prevista non risultava cripto per niente. Ora, prima
  di dirottare, si chiede a Kraken se ha quel contratto - fonte autorevole invece di un elenco da
  mantenere. Si chiede solo per gli strumenti che POTREBBERO esserlo (fblTipoAsset = cripto o
  "azione", il mucchio dell'ignoto): un primo tentativo basato sulla LUNGHEZZA del nome sbagliava
  due volte - lasciava passare le coppie di valute e fermava proprio le monete dal nome lungo.
  Test: segnali_cripto_su_kraken.test.mjs (4).
  (2) ORIGINE E TIPO: colonna "Origine" negli ordini pendenti (entrambe le righe) e nelle posizioni
  Kraken; famiglia dello strumento (forex/cripto/materia prima/indice/azione) anche nel Journal.
  fblTipoAsset() e' separata da fblFamigliaAsset(): la prima dice COS'E', la seconda sceglie la
  strategia dell'apertura automatica (due famiglie, non cinque) e non va confusa.
  Nella tabella Kraken i clic su SL/TP erano legati ai numeri di colonna 4 e 5 scritti a mano:
  aggiungendo una colonna sarebbero scivolati. Ora ogni cella si numera da sola.
  Test: tipo_asset.test.mjs (5).
  (3) CONTI CHIUSI (richiesto): i conti MT5 non piu' salvati restano consultabili in un gruppo loro
  ma escono da ogni vista "insieme". Il controllo che conta: con l'elenco dei conti VUOTO non si
  dichiara chiuso niente - all'avvio e' vuoto, e senza quella riga la dashboard si svuoterebbe.
  Test: conti_chiusi.test.mjs (3).
  (4) Andamento del conto: nel riquadro si legge anche il capitale dopo quell'operazione.

## 15 ottobre 2026 - v153 (seconda parte): la barra degli ordini dentro al grafico
  (1) RICHIESTO: "trasportiamo il sistema sulla barra degli ordini, e a fianco a SL e TP il campo
  del valore, cosi' l'utente puo' anche cancellarlo; il pannello sulla pagina madre non serve piu'".
  PRIMA di toccare ho MISURATO: i campi di quel pannello non sono un duplicato, sono lo stato che
  legge tutta l'app - $('sl') 17 volte, $('tp') 15, $('pendingEntry') 23, $('slPending') 22,
  $('tpPending') 20. Cancellare il pannello avrebbe rotto anche la barra nel grafico, che ci scrive
  dentro. Quindi: i campi veri restano la fonte di verita', e nella barra si aggiungono due caselle
  che si RISPECCHIANO sopra - esattamente lo schema gia' usato da lottaggio e rischio. Svuotare la
  casella toglie il livello (e' il motivo per cui e' stata chiesta).
  Lo specchio si aggiorna da refreshSlTpEuroPreview(), il punto che TUTTE le strade attraversano
  quando stop o target cambiano - anche il trascinamento sul grafico, che non fa scattare eventi.
  (2) Interruttore in Style per gli ordini pendenti a grafico (richiesto). Spento: nessuna riga,
  nessuna casella in evidenza. Acceso di base, com'era prima.
  (3) Colonna "Origine" anche nelle posizioni MT5: un test tiene ferme le due tabelle come gemelle,
  e aggiungerla solo a Kraken lo avrebbe rotto - giustamente.
  (4) DIFETTO LATENTE trovato dal collaudo: krakenConto poteva diventare null (r.ok vero ma r.data
  vuoto) e la riga dopo moriva con "Cannot set properties of null", a ogni giro, in silenzio. Non
  l'ha creato questa versione: accendendo di base i segnali cripto su Kraken quella strada ha
  cominciato a essere percorsa, e il difetto e' saltato fuori.
  (5) QUATTRO TEST aggiornati perche' misuravano comportamenti che il proprietario ha chiesto di
  cambiare (l'oro ora e' "materia prima", le tabelle hanno una colonna in piu'). Due di quelli
  leggevano le celle PER NUMERO: riscritti per nome di colonna - e' la stessa fragilita' che ho
  tolto dall'app poche ore prima, e si era ripresentata nei test.
  NOTA DI METODO: mai mettere EMOJI nelle ancore degli script di modifica. Nel sorgente dello
  script l'emoji va scritta come escape, e l'escape non e' il carattere: l'ancora non trova niente.
  Mi e' costato quattro tentativi a vuoto oggi.

## 15 ottobre 2026 - v154: via il pannello degli ordini dalla pagina
  RICHIESTO: "visto che ora si aprono gli ordini dalla barra dentro al grafico, il pannello sulla
  pagina madre non serve piu'".
  NASCOSTO, non cancellato, e il perche' e' tutto: i campi di quel pannello (#lots #risk #sl #tp e
  i gemelli pendenti) non sono un duplicato della barra, sono LA MEMORIA dell'app - $('sl') letto
  17 volte, $('pendingEntry') 23, $('slPending') 22 - e la barra ci scrive sopra. Cancellarli
  avrebbe rotto proprio la barra che li ha sostituiti.
  VERIFICATO PRIMA: avevo detto al proprietario che mancavano i campi dell'ordine pendente e la
  scelta LIMIT/STOP nel grafico. Mi ha corretto, e aveva ragione: ci sono gia' (il pulsante che
  crea l'ordine pendente, il selettore LIMIT/STOP accanto, la conferma), e l'entrata si fissa
  cliccando sul grafico. Avevo cercato dei CAMPI DI TESTO e non avevo visto i pulsanti.
  E le chiusure: una posizione dal suo pulsante nella tabella, a blocchi dal menu "Operazioni a
  blocco" - che offre piu' del vecchio "CHIUDI TUTTE" (per risultato, direzione, asset).
  Test: pannello_ordini_nascosto.test.mjs (4), che tiene fermo l'invariante "invisibili ma vivi".

## 15 ottobre 2026 - v155: il footprint "a strati" alla chiusura del mercato
  SEGNALATO con foto: "il footprint lo ha caricato a pezzoni, a strati; tutto questo quando si
  ferma il mercato, poi quando riprende torna a visualizzarsi correttamente".
  LA CAUSA, trovata leggendo chi riceve quale prezzo: nella fascia 22-23 fblCapitalSeraAllinea()
  sposta il prezzo Capital.com per agganciarlo al livello MT5. Quello spostamento si applica solo
  se l'epic e' quello A GRAFICO (`p.epic===capitalWsPrimaryEpic`). Il ramo degli asset in
  background registrava quindi nel footprint il prezzo GREZZO, mentre lo stesso asset a grafico lo
  registrava SPOSTATO: due livelli per lo stesso prezzo, a decine di punti di distanza, nello
  stesso registro. Disegnati insieme: due bande staccate.
  LA SCELTA: coerenza invece di copertura. In quell'ora il footprint degli asset NON a grafico si
  ferma. Si perde un'ora di dati di sottofondo su quegli asset; si evita un footprint che racconta
  due prezzi diversi per lo stesso istante, che e' peggio che non averlo.
  Test: footprint_sera.test.mjs (3).
  RESTA APERTO: le POSIZIONI sfalsate a mercato chiuso, e la costruzione del footprint in replay.
  Sono due cose diverse da questa, e vanno misurate a parte.
  Aggiunto ai formati reali il BTC con "Target1..4" e il dollaro staccato (segnalato: "perche' non
  e' arrivato come segnale?"). Il lettore lo capisce al 100%: il caso resta li' a dimostrarlo.

## 15 ottobre 2026 - v156: su Kraken il lottaggio si adatta al margine che c'e'
  SEGNALATO: "l'applicazione mi sta dicendo che il margine e' insufficiente su Kraken; io ho messo
  il 5% del capitale, quindi devi basare il lottaggio in base alla disposizione del nostro conto".
  Aveva ragione. Il codice RIFIUTAVA il segnale ("servono 12.568 USD, disponibili 8.803") anche
  quando una posizione piu' piccola ci sarebbe stata benissimo. Il rischio scelto e' un TETTO, non
  una quota da spendere per forza: se con quel rischio la posizione non ci sta, si apre quella che
  ci sta - dicendolo - invece di non aprire niente.
  COME: due tetti e vale il piu' stretto, quello scelto dall'utente (krakenMargineTetto) e quello
  davvero disponibile sul conto meno un filo di sicurezza (disponibile * 0.98 - Kraken rifiuta al
  pelo). Il piano si RICALCOLA con tgPiano() e un rischio ridotto della stessa proporzione, non si
  ritoccano i numeri a mano: cosi' minimi del contratto, fette per ogni target ed "entro rischio"
  restano coerenti fra loro.
  E DOPO SI CONTROLLA. Ricalcolare non garantisce di rientrare: con un contratto dal lotto minimo
  alto il piano ridotto puo' sforare lo stesso. Solo se anche quello non ci sta si rifiuta, e il
  messaggio dice QUALE dei due tetti non si e' potuto rispettare - "il tetto del 5% che hai
  scelto" oppure "il margine disponibile sul conto": sono due problemi con due rimedi diversi.
  La riduzione finisce in voce.autoMotivo, scritta nella scheda del segnale: una posizione aperta
  con meno rischio di quello scelto deve dire perche', altrimenti domani sembra che il rischio
  della sala non funzioni - che e' esattamente il dubbio da cui e' nata questa funzione.
  Test: kraken_margine.test.mjs sale a 6 (il nuovo copre proprio il caso segnalato: tetto del
  conto piu' stretto di quello scelto, e si apre ridotto invece di rifiutare).
  RESTA APERTO, invariato: le POSIZIONI sfalsate a mercato chiuso e il footprint in replay.

## 15 ottobre 2026 - v157: a mercato chiuso si ferma tutto, non solo il disegno
  SEGNALATO: "il comportamento a mercato chiuso - posizioni e footprint sfalsati". Due sintomi,
  una causa sola: TRE pezzi dell'app rispondevano in tre modi diversi alla stessa domanda, "il
  mercato di questo asset e' fermo adesso?".
    - le CANDELE la chiedevano a statoMercato(), il calendario vero dello strumento -> si fermavano;
    - il FOOTPRINT la chiedeva a liveSessionPhaseAt(), ma tutto il cancello stava dentro
      `if(mt5Connected)`: col grafico su Capital.com e MT5 staccato non la chiedeva a nessuno;
    - il PREZZO CHE VALUTA LE POSIZIONI (livePriceByAsset) non la chiedeva affatto.
  MISURATO PRIMA DI TOCCARE IL CODICE, su banco (scratchpad/misura_chiusura*.mjs):
    - candele ferme a 4105, prezzo che valuta le posizioni gia' a 4130, P/L da -150 a -400 senza
      che una sola candela lo mostrasse;
    - candela rifiutata (false) e tick footprint registrato lo stesso (0 -> 1): ecco gli "strati",
      livelli di prezzo per minuti in cui non esiste nessuna candela sotto;
    - e il pezzo grosso: un tick a 4080, sotto lo stop a 4090, su un asset in SOTTOFONDO faceva
      scattare lo stop (1 posizione aperta -> 0). Un'operazione chiusa a un prezzo che il grafico
      non ha mai avuto. Non era un difetto estetico.
  LA CORREZIONE: una funzione sola, fblMercatoFermoOra(asset,t), accanto a statoMercato che ne e'
  la fonte. La usano il footprint e il tick in arrivo (che si ferma PRIMA di scrivere il prezzo e
  prima di evaluateLiveBackgroundAsset, dove stanno stop e ordini pendenti). Il controllo sta dopo
  lastLiveTickAt apposta: il tick e' arrivato davvero e il watchdog deve saperlo, altrimenti a
  mercato chiuso si riconnetterebbe in continuazione credendo di aver perso lo stream.
  Cripto escluse (non chiudono mai) e Storico/replay intatti (li' il tempo lo decide il replay).
  Test: mercato_chiuso.test.mjs (5). Il terzo e' il piu' importante: a mercato APERTO il prezzo si
  muove e lo stop scatta - la correzione non deve spegnere il motore.

  CORREGGE ANCHE LA v155, e va detto. La v155 sosteneva di aver risolto il footprint "a strati"
  fermando la registrazione nella fascia serale 22-23. Non ha mai fermato un solo tick: dalla
  v131 liveSessionPhaseAt() non restituisce piu' 'capital', quindi quella condizione era sempre
  vera. Il collaudo non poteva accorgersene perche' i test leggevano il TESTO del codice invece di
  misurarne l'effetto. footprint_sera.test.mjs e' stato riscritto: ora prova che la fascia non
  esiste (una settimana intera, minuto per minuto) invece di cercare una riga nel sorgente.

## 15 ottobre 2026 - v158: niente "installa i pacchetti" dove non si installa niente
  SEGNALATO: "quando faccio l'accesso a un nuovo dispositivo e vado ad aggiungere un account di
  MT5, mi compare il messaggio dell'installazione dei pacchetti per il servizio MT5, io comunque
  al server sono collegato. Risolviamo questo bug sui dispositivi mobili".
  COSA C'ERA GIA': il 9 ottobre quel popup era gia' stato tolto da telefoni e tablet, con
  fblEMobile() - che riconosce il dispositivo dalla User-Agent e dal touch. Ma la User-Agent mente
  di proposito quando il browser e' in "modalita' desktop", e in quel caso fblEMobile() dice "e' un
  computer", fblRemoto() dice "l'indirizzo e' ancora locale", e la schermata torna fuori.
  LA SCELTA: smettere di indovinare dove c'e' una risposta certa. Il Setup e' un installatore
  Windows (installer_build/installer.iss): se qui non e' Windows, quei pacchetti non si installano
  e basta. Il sistema operativo il browser lo dichiara nei Client Hints
  (navigator.userAgentData.platform), che la modalita' desktop non cambia; se mancano si guarda la
  User-Agent. La nuova fblQuiSiInstallaIlServizio() non sostituisce fblEMobile: si aggiunge, come
  terza strada, e copre anche il Mac - dove il Setup non si esegue comunque.
  NOTA ONESTA: questo chiude i dispositivi che Windows non sono. Il "server" a cui il proprietario
  e' collegato e' quello Oracle, che porta Kraken e i segnali ma NON MT5 (MT5 resta sul computer,
  vedi cervello/ORACLE.md): essere collegati al server non toglie il bisogno del computer acceso,
  e il messaggio ora lo dice.
  Test: pacchetti_non_windows.test.mjs (4), con i quattro di pacchetti_mobile.test.mjs che
  restano verdi - compreso quello che pretende che su Windows la schermata ci sia ancora.

## 15 ottobre 2026 - v159: i segnali che non arrivavano (due cause, nessuna delle due dove si guardava)
  SEGNALATO dal telefono, con foto: "il ponte Telegram rimane escluso per sempre, anche se il
  server dice che il collegamento e' stabilito. Non puo' esistere che dica che e' collegato e poi
  non si riesca a connettere. E infatti non prende i segnali dalle sale e non esegue ordini, zero".
  PRIMA CAUSA - LO STATO MENTIVA, in tre punti diversi e tutti e tre per lo stesso motivo: nessuno
  sapeva davvero cosa stesse succedendo, e tutti e tre tiravano a indovinare l'ottimismo.
    - la frase di stato era una catena di `else if` con un ramo di scarto in fondo: "Ponte avviato,
      collegamento a Telegram in corso...". Ci cadeva dentro TUTTO quello che non rientrava nei
      quattro casi previsti - compreso il caso in cui il ponte manda `modalita: 'solo-syntra'`,
      cioe' dichiara di non toccare Telegram per scelta (i ponti sono due: Telegram sul server,
      Syntra sul computer - vedi CONSEGNA.md v106). L'app quel campo non lo guardava nemmeno;
    - l'etichetta dell'interruttore scriveva "accesso in corso..." come semplice contrario di
      "collegato", senza che nessun accesso fosse in corso;
    - "Prova il server" provava SOLO la porta 8000 e poi scriveva "Server raggiungibile". I segnali
      stanno sulla 8769, un altro servizio: quella porta non veniva mai toccata. Un semaforo verde
      che copre meta' impianto manda a cercare il guasto dove non e'.
  Ora la domanda la fa una funzione sola, tgStatoVero(), e la risposta e' uno dei casi VERI:
  solo-Syntra, in attesa di numero/codice/password, ponte muto, errore del ponte, oppure "risponde
  ma Telegram non si aggancia da N minuti" con la conseguenza scritta accanto. "Prova il server"
  prova tutte e due le porte e dice di ognuna com'e' andata, modalita' compresa.
  LA REGOLA: non si scrive mai che qualcosa "e' in corso" se non lo si sa. Un'attesa senza fine non
  e' uno stato, e' una bugia che impedisce di cercare.
  SECONDA CAUSA, trovata mentre si provava una richiesta diversa ("controlla se questi ordini
  vengono compresi"): i prezzi con le MIGLIAIA all'italiana uscivano sbagliati di mille volte.
  "Entrata: 105,91" si leggeva benissimo, ma "Entrata: 80.958,50" diventava 80.958 - il punto delle
  migliaia preso per un decimale, e il ",50" riletto come un numero a se' che finiva fra i "target
  fuori scala". Su BTC e ETH, dove le migliaia ci sono sempre, entrata, stop e TUTTI i target
  uscivano sbagliati: l'ordine o veniva rifiutato dal broker o sarebbe passato a un prezzo che non
  c'entrava niente. E' quasi certamente il motivo per cui il BTC segnalato il giorno prima "non era
  mai arrivato".
  LA REGOLA, che non ha bisogno di sapere da che paese arriva il messaggio: se ci sono sia il punto
  sia la virgola, l'ULTIMO dei due e' il decimale e l'altro separa le migliaia - vale per
  "80.958,50" e per "80,958.50" senza distinguerli. Resta ambiguo, e si lascia com'era, un
  separatore solo seguito da tre cifre ("1.234"): nessuna regola puo' deciderlo guardando il numero.
  Test: stato_ponte_segnali.test.mjs (6); tre casi nuovi nei formati reali del lettore (la sala si
  chiama "Segnali" - GANNFAN e' la STRATEGIA scritta in fondo al messaggio, correzione del
  proprietario; il nome della sala l'app lo prende dal titolo del gruppo, mai dal testo).
  DA RICORDARE: il lettore che gira sul server e sul PC usa i file del SETUP, non quelli del repo.
  La correzione dei prezzi arriva ai segnali veri solo reinstallando il ponte.

## 15 ottobre 2026 - v160: la percentuale delle sale puo' essere rischio o quota di capitale
  CHIESTO dal proprietario con un esempio preciso: "SOL a 120, stop a 93, conto da 10.000 euro, 5%
  del capitale: mi deve dare intorno ai 4 lotti. Fammi il calcolo".
  IL CALCOLO, ed e' quello che ha chiarito tutto:
    - 5% come RISCHIO    -> 500 / 27 (la distanza dello stop) = 18,51 lotti. Allo stop perdi 500,
      cioe' il 5% esatto. Posizione da 2.221 USD.
    - 5% come QUOTA DI CAPITALE -> 500 / 120 (il prezzo) = 4,16 lotti. Posizione da 499 USD. Allo
      stop perdi 112, cioe' l'1,12%.
  I "4/5 lotti" che si aspettava sono i secondi. L'app ha sempre fatto i primi (tgPiano:
  `importoTot = saldo*pct/100` e poi diviso per la perdita di un lotto) - ed e' anche la
  spiegazione del "ho messo il 2% e ha usato 5.839 euro di margine" segnalato giorni fa: era il
  rischio, non la spesa, e con uno stop stretto il rischio gonfia la posizione.
  LA SCELTA, decisa dal proprietario fra tre opzioni: tutte e due, con un interruttore per sala.
  Predefinito 'rischio', perche' cambiare il significato alle sale gia' configurate senza che
  nessuno l'abbia chiesto vorrebbe dire far aprire a ognuna posizioni diverse da quelle attese.
  Il tetto di margine su Kraken resta, come rete di sicurezza sopra tutti e due (sua richiesta).
  DOVE STA: un menu attaccato alla percentuale, nella riga della sala - non in una schermata a
  parte. Un numero e la sua unita' di misura separati sono il modo migliore per leggere "5%" e
  intendere un'altra cosa, che e' esattamente quello che era successo.
  NEL CODICE cambia una riga sola in sostanza: il DIVISORE. Con 'rischio' si divide per quanto si
  perde con un lotto, con 'capitale' per quanto vale un lotto. Tutto il resto - target, quote,
  lotto minimo, arrotondamento per difetto - resta identico. Attenzione pero' al taglio
  "entroRischio" e alle quote per target: confrontavano con `perLotto`, e con base 'capitale'
  avrebbero paragonato una perdita a un valore di posizione. Ora usano la stessa grandezza del
  tetto.
  SUL FOREX la quota di capitale vale poco, e si dice invece di lasciarlo scoprire: un lotto EURUSD
  sono 100.000 unita', quindi "posizione da 500 euro" sarebbe 0,005 lotti, sotto il minimo. E'
  scritto nella nota sotto la tabella.

  TROVATO SCRIVENDO I TEST, e non lo cercava nessuno: quello stesso esempio veniva RIFIUTATO in
  partenza, prima ancora di arrivare al lottaggio. Il tetto "lo stop e' lontanissimo: non e' un
  prezzo vero" era 20% per tutti, e lo stop a 93 su 120 e' -22,5%. Su una cripto uno stop al 22%
  non e' un errore di battitura. Ora il tetto e' 40% sulle cripto e resta 20% altrove: serve contro
  i numeri che non sono prezzi (e' nato da "XAUUSD entrata 4" con l'oro a 4000), non contro gli
  stop larghi.
  Test: lottaggio_base.test.mjs (5), con i numeri dell'esempio dentro.

## 15 ottobre 2026 - v161: tre richieste della lista, chiuse
  (1) APERTURA AUTOMATICA, DUE INTERRUTTORI. Richiesto: "dobbiamo avere all'interno delle
  impostazioni dell'apertura automatica dei tasti che attivano o disattivano la posizione senza
  stop della sala, stessa cosa per il take profit".
  Prima la risposta era sempre si', calcolandoli: lo stop dal rischio dedicato, il target da una
  percentuale della distanza dello stop. Sono due INVENZIONI dell'app, non due numeri della sala, e
  chi non le voleva se ne accorgeva a posizione aperta. Ora, spenti, quel segnale non si apre da
  solo: resta nel pannello e il motivo e' scritto. Predefiniti ACCESI - spegnerli di nascosto
  vorrebbe dire smettere di aprire segnali che prima si aprivano.
  Valgono SOLO per l'automatico, e il confine e' quello gia' in uso per il rischio dedicato
  (pctForzata valorizzata = la percentuale arriva dalla sala): a mano ogni segnale si configura
  come si vuole, ed e' una scelta cosciente.
  Richiesto anche "togliamo il piu' in la', che non serve": l'etichetta diceva "e target un
  ulteriore X % piu' in la'", che e' una formula che non dice rispetto a cosa. Ora: "e target a
  X % oltre il pareggio". Il numero resta - serve a sapere dove va il target calcolato.
  (2) UNA X PER TOGLIERE UN ASSET DALL'ELENCO. Richiesto: "nel pop-up della ricerca dell'asset,
  accanto alla sezione asset disponibili, dobbiamo avere la possibilita' con una X di togliere quel
  asset dall'elenco".
  Si e' scelta una LISTA DI TOLTI, non "cancello la voce", e la ragione e' precisa: l'elenco e'
  fatto di due cose diverse - le voci scritte nella pagina (quelle di sempre) e gli asset salvati
  cercandoli. Cancellare funziona solo sui secondi: una voce della pagina tornerebbe al primo
  ricaricamento e l'utente la vedrebbe riapparire senza capire perche'. Ricordare quali sono stati
  tolti copre tutti e due i casi con una regola sola.
  Due protezioni: la X non c'e' sull'asset a GRAFICO (e la funzione lo rifiuta comunque - una
  regola che vive solo nel disegno di un pulsante e' una regola che si perde al primo altro punto
  che chiama quella funzione), e un asset tolto tempo fa RICOMPARE se ci si arriva lo stesso, per
  esempio saltando al grafico da una posizione vecchia: meglio vederlo che avere un grafico aperto
  su qualcosa che il menu giura non esistere.
  Si torna indietro ricercandolo e sceglendolo. Sincronizzato fra i dispositivi (GRAFICO_LS).
  (3) KRAKEN FRA LE SESSIONI DEL TRADE JOURNAL. Richiesto: "nel Trade Journal dobbiamo inserire
  anche come sessione e conto anche quella di Kraken". Kraken non e' una "modalita'" (non e' un
  valore di t.mode) ma un CONTO: si riconosce con fblContoDiOperazione, la stessa funzione che usa
  tutto il resto dell'app. Scriverne una seconda versione qui avrebbe voluto dire avere due idee
  diverse di "operazione su Kraken" e accorgersene il giorno che non coincidono.
  Conseguenza voluta: "Live Capital.com" non si prende piu' le Kraken, che pure hanno mode 'live'
  perche' sono nate con la sessione Live accesa. Chi filtra Capital.com vuole quelle di
  Capital.com.
  Test: apri_senza_livelli.test.mjs (6), asset_tolti.test.mjs (5), journal_filtro_kraken.test.mjs (5).

## 16 ottobre 2026 - v162: l'order book profile mostra tutti e due i lati
  SEGNALATO: "sull'indicatore profilo volumetrico, l'order book profile a sinistra dell'istogramma:
  le candele a sinistra sono tutte blu, solo una e' rossa. Devono visualizzarsi sia quelle rosse
  sia quelle dei bid e degli ask".
  LA CAUSA, una riga sola:
      ctx.fillStyle = (bidVol[b] >= askVol[b]) ? colBid : colAsk;
  Una barra per fascia, del colore del lato che aveva prevalso. In una fascia con 100 di bid e 95
  di ask si vedeva solo blu: quei 95 non esistevano a schermo. Il rosso compariva solo dove gli ask
  vincevano, e i pari andavano al blu per via del >=.
  L'ACCUMULO DEI DATI ERA GIUSTO: bucketOrderBookDominanceProfile legge sia bids/asks sia la forma
  compatta b/a e somma simmetricamente. Il difetto buttava via meta' informazione in fase di
  DISEGNO, che e' il motivo per cui sembrava un problema di dati mancanti.
  ORA: la barra resta lunga quanto la liquidita' totale della fascia, ma e' divisa in due pezzi in
  proporzione - bid attaccato all'asse, ask oltre, ordine sempre uguale cosi' le fasce si possono
  confrontare a occhio. Un lato presente ma piccolissimo prende almeno un pixel: "c'e' poco" e
  "non c'e'" sono due cose diverse.
  MISURATO, non dedotto: stesso banco (book finto con 100 di bid e 90 di ask in ogni fascia) fatto
  girare sulla v161 e sulla v162. Prima: 11 barre blu, 0 rosse. Dopo: 11 e 11.
  EFFETTO COLLATERALE UTILE: se il broker non pubblicasse i volumi ask si vedrebbero barre tutte
  blu ma SOTTILI invece che piene, e si capirebbe subito che manca il dato a monte. Con il disegno
  di prima "ask assenti" e "ask in minoranza" davano lo stesso identico risultato a schermo.
  Test: order_book_due_lati.test.mjs (3), che guardano i RETTANGOLI DIPINTI intercettando il
  contesto del canvas - non il testo del codice. Due trappole pagate scrivendoli: nella pagina ci
  sono nove canvas e quello del grafico e' #chart (col primo che capita si misura zero), e i colori
  arrivano come "rgba(r, g, b, a)" CON GLI SPAZI, col rosso delle candele al ribasso
  (224, 91, 100) vicinissimo a quello degli ask (224, 91, 79).

## 16 ottobre 2026 - v163: l'anagrafica della posizione viaggia con la posizione
  SEGNALATO: "ho aperto una posizione su Kraken alle 22. Dopo aver aggiornato l'applicazione,
  chiusa e riaperta, sono andato a riaprire il grafico e la posizione me l'ha messa alle 19:20.
  Per ogni posizione salva questi dati, sono stra importanti: non possiamo avere un cambio di
  posizione dentro il grafico, ne' di apertura ne' di chiusura. Deve sempre combaciare con la
  candela giusta".
  LA CAUSA: l'ancoraggio provava tre fonti in ordine - l'orario vero dell'exchange (p.aperta_ms),
  la data della strategia locale, e in ultimo Math.max(0,(rows.length||1)-20), cioe' "venti candele
  prima della fine". Le prime due vivono in memoria o in una mappa che scade: dopo un riavvio
  dell'app resta solo la terza, che non e' un orario ma un ripiego. Da li' il salto a un'ora
  qualunque.
  LA REGOLA: un fatto osservato una volta si SCRIVE. L'orario e il prezzo di apertura sono fatti
  successi nel mondo, non stati dell'applicazione: non possono dipendere dal riavvio del programma
  ne' da quale dispositivo sta guardando. Nuova anagrafica (fbl_pos_anagrafica), salvata e
  sincronizzata come i livelli Kraken.
  DUE SCELTE CHE CONTANO:
    - si scrive solo cio' che si SA: un ripiego non entra mai nell'anagrafica, altrimenti
      cristallizzerebbe per sempre un orario inventato;
    - una volta noto, un orario NON si riscrive. Rincorrere la fonte del momento e' esattamente il
      difetto da cui nasce questa funzione.
  STESSA FALLA, ALTRO SINTOMO, segnalato nello stesso momento: "per il trade journal e anche sulle
  colonne di ordini pendenti, posizioni MT5, Kraken, nei dispositivi mobili visualizza sempre
  l'origine in maniera manuale, cosa che non e' assolutamente vera. Le posizioni aperte dalle sale
  segnali non le apro io". Le mappe che dicono CHI ha aperto vivevano solo sul dispositivo che
  l'aveva aperta: fb_mt5_ticket_segnale non era fra le chiavi sincronizzate, e i livelli Kraken
  pubblicati contenevano sl/slIniziale/tps ma non la sala. E' la lezione gia' scritta in
  LEZIONI.md il 14 ottobre, applicata a meta'.
  Ora: ticket MT5 -> sala e anagrafica si sincronizzano, FONDENDOSI invece di sostituirsi (ogni
  dispositivo puo' aver aperto ticket suoi, una sostituzione secca cancellerebbe quelli dell'altro),
  e i livelli Kraken portano anche il nome della sala.
  E dove non si sa si DICE: "origine da confermare" invece di "Manuale". Attribuire a te
  un'operazione di una sala non e' un dettaglio estetico - falsa il profitto per sala.
  LIMITE DICHIARATO: l'anagrafica si riempie da adesso. Le posizioni gia' aperte di cui il ponte
  non manda piu' l'orario vero non lo recuperano: quel dato non ce l'ha piu' nessuno.
  Test: anagrafica_posizione.test.mjs (7).

## 16 ottobre 2026 - v164: "salva configurazione" trasferiva solo meta' strategia
  RICHIESTO: "quando andiamo nella cronologia delle sale segnali impostiamo la configurazione di
  take profit, anche per quanto riguarda il pareggio anticipato - a che punto della strada verso il
  primo target, la percentuale - e la percentuale di rischio o del capitale a seconda di quella che
  ha selezionato. Quando premiamo salva configurazione deve trasferire tutto nella strategia di
  quella sala".
  IL BUCO, trovato leggendo le due funzioni una accanto all'altra: stratDallaUi() CALCOLAVA GIA' il
  pareggio anticipato - torna avv:{attivo,pct} - e salvaStrategiaNellaSala() non lo copiava. Lo si
  configurava nella cronologia, si premeva salva, e nella sala non arrivava: nessun errore, nessun
  avviso, spariva e basta. Trasferiva metodologia, distribuzione, quote e spostamenti dello stop;
  restavano fuori il pareggio anticipato e la base rischio/capitale della v160 - che nella
  cronologia non esisteva nemmeno come campo.
  PERCHE' ERA FACILE DA SBAGLIARE, e perche' ora ci sono dei test: le due parti parlano due lingue
  diverse. Nella riga della sala l'avvicinamento e' UN NUMERO dove 0 vuol dire spento; nella
  cronologia sono DUE campi (una spunta e una percentuale). Chi ha scritto il salvataggio aveva
  davanti due forme della stessa cosa, e ne ha portata una sola.
  LA BASE: aggiunta accanto alla percentuale, con lo stesso significato della riga della sala
  (tgBaseLotto). Salvare una percentuale senza la sua unita' di misura vuol dire mandare alla sala
  un numero che poi interpreta a modo suo - ed e' esattamente il malinteso da cui e' nata la v160.
  Predefinito 'rischio', come li': cambiarlo di nascosto farebbe aprire posizioni diverse da quelle
  attese. La scelta si ricorda fra una riapertura e l'altra, come il capitale e la percentuale.
  PUNTO 13, nella stessa versione: la cronologia delle sale si apre anche da Impostazioni grafico.
  NON e' un secondo pulsante con una sua logica: stessa classe .fblCronoBtn, stesso ascoltatore
  delegato, uno solo. Due strade diverse per aprire la stessa cosa e' il modo migliore per
  ritrovarsi con due comportamenti diversi senza accorgersene - e c'e' un test che tiene fermo
  proprio questo (due pulsanti, UN solo punto di apertura).
  Test: crono_salva_strategia.test.mjs (5).

## 16 ottobre 2026 - v165: stop e target di Kraken si trascinano sul grafico
  SEGNALATO: "sia dal tablet che dal telefono, sul conto Kraken, non riesco a spostare target e
  stop con il dito. Con la penna sul tablet si', con il dito no. Anzi, neanche sul PC me li fa
  spostare: devono essere modificabili".
  LA CAUSA, una sola per tutti e tre i casi: le posizioni Kraken NON stanno in positions[] - sono
  disegnate da krakenDisegnaGrafico, un percorso separato - e tradeLevelHit(), la funzione che
  decide quale linea si sta afferrando, non conteneva un solo riferimento a Kraken. Le caselle
  erano per giunta disegnate con noHandle:true. Non c'era niente da afferrare, con nessun
  dispositivo: la penna "funzionava" su altre linee, non su queste.
  PERCHE' UNO STATO SEPARATO e non un ramo dentro tradeLevelHit: quella funzione torna una STRINGA
  ('SL','TP','ENTRY'...) e tutta la macchina del trascinamento ragiona su quelle. Una linea Kraken
  deve dire anche QUALE contratto e QUALE target: ci vuole un oggetto. Infilarlo li' dentro voleva
  dire cambiare il tipo di ritorno in una decina di punti che funzionano - compreso il
  trascinamento di MT5, che tocca ordini veri. Uno stato parallelo si aggiunge senza toccarli.
  DUE PROTEZIONI, e servono tutte e due:
    - PRIMA SI SELEZIONA, POI SI TRASCINA (richiesto esplicitamente dal proprietario): il primo
      tocco arma e la linea si illumina, il secondo trascina. Evita di afferrare per sbaglio.
      L'armamento SCADE dopo 8 secondi: una linea lasciata "pronta" e dimenticata e' una trappola
      per il clic dopo. E si consuma a spostamento fatto.
    - AL RILASCIO SI CHIEDE CONFERMA, con prezzo vecchio e nuovo, piu' gli avvisi gia' in uso
      nella finestra della tabella (stop oltre il prezzo = chiusura immediata; target dalla parte
      della perdita). Un doppio tocco non dice COSA sta per succedere; una conferma da sola non
      impedisce di afferrare la linea sbagliata.
  IL PREZZO MANDATO A KRAKEN toglie lo scostamento che il disegno applica (krakenScostamento:
  Kraken e Binance non quotano identico). Senza, lo stop finirebbe spostato di quella differenza.
  Fermi sul posto non si chiede niente: non si conferma di non fare nulla.
  I target si mandano tutti insieme, come gia' fa la finestra della tabella: si sostituisce solo
  quello trascinato e si rimandano gli altri com'erano.
  DUE TRAPPOLE PAGATE SCRIVENDO IL BANCO, e vanno ricordate perche' non si vedono:
    1. il richiamo a krakenDisegnaGrafico dentro draw() e' avvolto in un try/catch che INGHIOTTE
       gli errori: un'eccezione li' dentro e' invisibile, draw() non segnala niente e si crede di
       avere un problema di dati. Per trovarla va chiamata la funzione direttamente;
    2. una linea fuori dalla scala di prezzo visibile non si disegna - giusto - e quindi non si
       afferra. Il banco aveva candele strette e misurava zero zone: sembrava un difetto del
       codice, era il banco a non mostrare quelle linee. E lo scostamento Kraken<->Binance sposta
       i livelli: con un mark non allineato all'ultima candela il secondo target usciva di scala.
  Test: kraken_trascina_livelli.test.mjs (6).

  CORREZIONE NELLA STESSA VERSIONE, e va detta: il collaudo su GITHUB era ROSSO dalla v158 alla
  v164 mentre in locale era verde ogni volta. Quattro test del popup "installa i pacchetti MT5"
  cadevano la' e non qui. La causa: dalla v158 l'app chiede "questo dispositivo e' Windows?" e
  quella domanda rispondeva con il sistema operativo di CHI ESEGUE il collaudo - Windows sul PC,
  Ubuntu su GitHub, dove la schermata non compare mai e i test che la pretendono falliscono.
  Ho guardato il collaudo locale e pubblicato sette volte credendo fosse verde. Il collaudo che
  conta e' quello di GitHub.
  LA CURA non e' aggiustare i quattro test uno per uno: il banco (laboratorio/app/aiuti.mjs) ora
  DICHIARA di essere un computer Windows, che e' la condizione in cui quei test sono stati scritti.
  Chi deve provare l'altro caso lo dice esplicitamente, come fa gia' pacchetti_non_windows.test.mjs.
  Cosi' il risultato e' lo stesso ovunque giri. Lezione in LEZIONI.md.

## 16 ottobre 2026 - v166: le sale divise per famiglia, e l'orario di esecuzione nelle tabelle
  (1) LE SALE SI DIVIDONO. Richiesto: "nella sezione apertura automatica dobbiamo suddividere bene
  le sale. Nella sezione cripto verranno messe solo le sale che hanno aperto almeno una volta
  un'operazione cripto. Non possiamo avere le stesse identiche sale sia nel forex sia nelle cripto.
  A meno che una sala non mandi entrambi i segnali".
  DUE STRADE CHE SI SOMMANO:
    - la SCELTA dell'utente, chiesta con un popup quando la sala si aggiunge. A selezione multipla
      come richiesto ("non lo salva appena preme il bottone, ma e' un toggle"): una delle due, o
      tutte e due. Si puo' anche non rispondere;
    - quello che la sala MANDA davvero: ogni segnale aggiunge la sua famiglia. E' l'esempio del
      proprietario - quattro segnali forex, il quinto cripto, e da quel momento la sala sta in
      tutte e due.
  SI AGGIUNGE SOLTANTO, mai si toglie da sola: una sala che ha mandato una cripto a settembre resta
  nelle cripto anche se da allora manda solo forex. Toglierla vorrebbe dire far sparire una
  configurazione che l'utente aveva fatto, senza dirglielo.
  SENZA NIENTE DI SAPUTO si vede in tutte e due: e' il comportamento di prima, ed e' la scelta
  prudente - una sala che sparisce da una sezione e' una sala che non apre piu' posizioni li'.
  La famiglia si riconosce dal NOME dello strumento del segnale (fblTipoAsset: "BTCUSD",
  "PF_XBTUSD"), non da tgFamDaSimbolo che vuole una chiave del grafico e su un nome grezzo direbbe
  sempre forex.
  Si cambia quando si vuole dalla riga della sala (una sala puo' cambiare mestiere, e senza un modo
  per correggerlo l'unica strada sarebbe toglierla e rimetterla perdendo la configurazione), e la
  scelta si sincronizza fondendosi, non sostituendo: ogni dispositivo puo' aver visto segnali che
  l'altro non ha visto.
  appConfirm ha imparato a mostrare contenuto preparato DALL'APP (opts.html), perche' questa
  conferma contiene due caselle. Mai con testo che arriva da fuori: quello resta da sfuggire.
  Le caselle si leggono MENTRE la finestra e' aperta: appConfirm chiama opts.onOk con l'overlay
  ancora nel documento, e si cerca DENTRO quel nodo - cosi' funziona anche nella finestra separata
  (PIP), dove un getElementById di questa pagina non troverebbe niente.
  (2) ORARIO DI ESECUZIONE. Richiesto: "nelle posizioni aperte, sia per Kraken che per MT5 e anche
  gli ordini pendenti, ci mettiamo l'orario di esecuzione". Colonna "Eseguita" nelle posizioni
  aperte (app, MT5, Kraken) e "Messo" negli ordini pendenti.
  DUE SCELTE: quando l'orario non si SA si scrive "-", non "adesso" - un orario inventato e' falso
  e per giunta credibile, lo stesso errore che spostava le posizioni a un'ora qualunque (v163). E
  MT5 manda i SECONDI mentre il resto dell'app i millisecondi: una funzione sola (fblMsDaOrario) a
  deciderlo, perche' convertire a mano in ogni punto e' il modo piu' sicuro per dimenticarsene e
  ritrovarsi una data del 1970.
  Su Kraken la tabella legge la STESSA fonte che ancora la posizione alla candela (aperta_ms, poi
  l'anagrafica della v163): tabella e grafico non possono raccontare due cose diverse.
  Test: sale_per_famiglia.test.mjs (8), orario_esecuzione.test.mjs (5),
  kraken_posizioni.test.mjs (7).
  LA COLONNA SU MT5 L'HA TROVATA IL COLLAUDO: kraken_posizioni.test.mjs pretende che la tabella
  Kraken e quella MT5 abbiano le STESSE colonne (tolto il Ticket), ed e' andato rosso perche'
  "Eseguita" l'avevo messa su Kraken e non su MT5 - che era una delle tre richieste. Un test
  scritto per tenere due cose gemelle ha segnalato un pezzo di lavoro mancante, non un difetto.
  Aggiornato anche tipo_asset.test.mjs: una sua riga pretendeva Origine ATTACCATA a Side. Ora
  controlla che l'intestazione ci sia, non chi le sta accanto: si devono poter aggiungere colonne
  senza far cadere un test che parla d'altro.

  CORREZIONE PRIMA DI PUBBLICARE, e va detta (revisione della modifica, 16 ottobre). Tre difetti
  veri, su DUE richieste su due: la revisione li ha trovati MISURANDO (aprendo app.html nel banco),
  non leggendo il sorgente.
    1. IL POPUP NON ESISTEVA. appConfirm chiamava escapeHtmlLite(message) SEMPRE e non conosceva
       opts.html: le due caselle finivano a schermo come TESTO. "Salva" non cambiava niente, e il
       percorso dalla riga della sala era morto. Ora opts.html c'e', e le caselle si leggono con
       opts.onOk (vedi sopra).
    2. LA RIGA RAGGRUPPATA AVEVA LE CELLE SCAMBIATE: l'orario sotto "Asset", l'asset sotto
       "Eseguita". Succede a ogni gruppo - un segnale a piu' target, cioe' sempre.
    3. L'ORDINE PENDENTE NON HA "startTime". Quelli creati dall'app portano createdAt (o mt5AddedAt
       se reali su MT5): leggendo startTime la colonna "Messo" restava vuota. Era il caso NORMALE -
       l'apertura automatica.
  E UN DIFETTO NEI TEST, che e' la lezione: i test dell'orario CONTavano quante volte
  "fblOrarioEsecuzione(...)" compare nel sorgente, e nessun test apriva il popup. Erano verdi mentre
  due richieste su due non funzionavano - lo stesso copione della v158-v164. Ora si rende la tabella
  vera e si legge ogni cella SOTTO LA SUA INTESTAZIONE (per nome di colonna, non per numero), e il
  popup si apre davvero. PROVA DI CONTROLLO fatta: rimessi i tre difetti, sono esattamente quei tre
  test a diventare rossi - un test che passa anche senza la correzione non vale niente.

## 16 ottobre 2026 - v167: «oltre il pareggio», e le posizioni Kraken si datano a mano

  (1) «TOGLIAMO IL PIU' IN LA'». Richiesto: «semplicemente devi togliere il testo più in là». La v161
  aveva riscritto l'ETICHETTA del campo («e target a X % oltre il pareggio») ma TRE riepiloghi che
  l'utente legge davvero dicevano ancora «un ulteriore X% più in là»: la scheda del segnale nel
  pannello, il riepilogo della configurazione e la conferma PRIMA DI APRIRE - il momento peggiore,
  perche' sta per partire un ordine. Il CAMPO e' rimasto: il numero serve, dice dove va il target
  calcolato. Ora tutti e tre dicono «a X% oltre il pareggio».
  E' la lezione della v166 applicata subito: il test che difendeva quella frase LEGGEVA IL SORGENTE
  (cercava «più in là» nel testo di app.html) e non apriva mai le tre schermate. Tolto. Al suo posto
  oltre_il_pareggio.test.mjs fa parlare le funzioni vere e legge cosa scrivono a schermo.

  (2) L'ORARIO DI UNA POSIZIONE KRAKEN SI PUO' DIRE A MANO. Era la proposta rimasta in sospeso della
  v163 («va fatta solo se la vuole»): la vuole. Il limite dichiarato allora: l'anagrafica si riempie
  da quando esiste, e una posizione aperta prima, di cui il ponte non manda piu' l'orario vero, non
  lo recupera - quel dato non ce l'ha piu' nessuno. Ora la cella «Eseguita» di quella posizione si
  clicca e si dice quando e' stata aperta.
  DUE SCELTE:
    - la correzione si MARCA (orarioManuale) ed e' un fatto DICHIARATO DA UNA PERSONA, non una fonte
      che si rincorre: per questo puo' riscrivere un valore gia' presente, e per questo le fonti
      automatiche non la riscrivono. E' l'unica eccezione alla regola «un orario noto non si
      riscrive», ed e' voluta - con una eccezione DENTRO l'eccezione: l'orario VERO dell'exchange,
      se torna a esserci, e' un fatto migliore e supera la correzione (le toglie anche il segno);
    - tabella e grafico leggono la STESSA funzione (krakenOrarioApertoMs): orario vero dell'exchange,
      poi anagrafica (compresa la correzione), poi niente. Era proprio il difetto della v163 avere la
      tabella a un'ora e il grafico a un'altra.
  Se l'orario VERO dell'exchange c'e', la cella NON si tocca: e' un fatto. Serve anche a non far
  ereditare a una posizione NUOVA (stesso simbolo) una correzione vecchia, perche' la nuova l'orario
  vero ce l'ha.
  NON si "toglie" la correzione: l'anagrafica viaggia fra i dispositivi senza tombstone, quindi una
  cancellazione qui non arriverebbe agli altri e al primo riallineamento tornerebbe indietro -
  sarebbe una promessa falsa (il rilievo e' venuto dalla revisione). Chi vuole correggere indica un
  altro orario, e basta.
  Test: oltre_il_pareggio.test.mjs (3), kraken_orario_manuale.test.mjs (7: la cella, il rifiuto di un
  orario storto, la fonte unica, l'ancora del GRAFICO alla candela indicata, e l'orario vero che
  supera la correzione).

## 17 ottobre 2026 - DECISIONE: la prossima versione e' la 2.0.1 (da applicare, non ora)
  Richiesto dal proprietario: «d'ora in poi la versione di tutto il programma e del repository andra'
  alla versione 2.0.1, visto che l'abbiamo resa una vera e propria applicazione». Da applicare alla
  prossima pubblicazione; richiesta esplicita di limitarsi a registrarla per ora ("salvalo per dopo").
  ATTENZIONE, MISURATO (provato su file temporanei, non a intuito): il numero del Setup e il tag della
  release NON si scrivono a mano, si RICAVANO da CACHE_NAME in sw.js con
  `grep -o 'forex-backtest-lab-v[0-9]*'`, che si ferma al primo carattere non numerico.
    - v167  -> APP=167, Setup 1.0.167, tag v1.0.167, passo versione_sw PASSA
    - v2.0.1 -> APP=2,   Setup 1.0.2,   tag v1.0.2,   passo versione_sw FALLISCE
    - v2-0-1 -> APP=2,   Setup 1.0.2,   tag v1.0.2,   passo versione_sw FALLISCE
    - v201  -> APP=201,  Setup 1.0.201, tag v1.0.201, passo versione_sw PASSA
  Quindi mettere "v2.0.1" senza altro NON alza la versione: la ABBASSA a 1.0.2 per il Setup e rende
  il collaudo rosso (il passo versione_sw cerca la forma `-v[0-9]*"`), bloccando la pubblicazione.
  Quando si applichera', vanno toccati INSIEME questi punti:
    (1) sw.js: forma di CACHE_NAME (col punto "2.0.1" va prima corretta la regex; oppure v201 e la
        2.0.1 resta solo nel nome mostrato);
    (2) .github/workflows/installer.yml: il grep (~riga 52 e ~92), SETUP="1.0.${APP}" (~96) e TAG (~97);
    (3) laboratorio/collauda.sh: il passo versione_sw (cerca `-v[0-9]*"`);
    (4) installer_build/installer.iss: MyAppVersion (che comunque installer.yml riscrive da solo a
        ogni build con sed, quindi la fonte vera e' CACHE_NAME).
  La regola operativa e' anche in cervello/PUBBLICARE.md, dove si guarda quando si pubblica.

## 17 ottobre 2026 - v168: i pulsanti della landing portano all'app (o all'installazione), e dentro l'app il collegamento in alto a sinistra torna al sito

Due richieste del proprietario, il 17 ottobre 2026.

**«qualsiasi pulsante di index.html collegato ad app.html deve portare all'installazione dell'APK;
ovvio oggi non esiste ancora e' da implementare; e se ha gia' installato l'applicazione lo riporta
dentro l'app, collegamento diretto, cosi' ci sganciamo da Chrome».**

**Requisito 1.** I 7 pulsanti della landing (5 che andavano a `login.html`, uno a `app.html`, uno a
`app.html?buy=license`) non vanno piu' dritti: passano tutti da `window.FBL.apriApp`, nuova porta
inserita nel `head` di `index.html`. Comportamento **unico per tutti i tre casi**, come scelto dal
proprietario: Android apre l'app se c'e' e altrimenti tira su l'APK (intent
`intent://avvia#Intent;scheme=forexbacktestlab;package=...` con `S.browser_fallback_url`); Windows
tenta la stessa strada e, se non risponde, mostra il riquadro con «Apri l'app», «Scarica
l'installer» e «Continua col sito web»; iPhone/Mac spiegano che si usa dal browser, **senza offrire
download che non esistono**.
La decisione di fondo, scritta nella porta stessa: **un sito non puo' sapere se un'app e'
installata**, perche' non ha alcun modo di misurarlo. Si sceglie quindi di *provare* ad aprirla e di
giudicare dopo: se la finestra perde il fuoco nel primo istante, l'app si e' aperta; se no, si offre
l'installazione. **Nessuna eccezione, sempre con l'uscita «Continua col sito web»** verso la
destinazione originale del pulsante: un vicolo cieco sarebbe molto peggio di un riquadro in piu'.
Limite onesto, accettato dal proprietario: su Windows il browser non concede a una pagina di aprire
un programma da sola, quindi sono due tocchi invece di uno (riquadro, poi «Apri l'app»).

**«dentro l'APK il collegamento in alto a sinistra verso index.html deve funzionare e riportare
alla pagina web; oggi da' "pagina non raggiungibile"».**

**Requisito 2.** Causa misurata, doppia: dentro l'APK `index.html` **non e' il sito** ma il
bootstrap locale da 660 byte (`www/index.html`), e la navigazione e' l'**unico** caso in cui la
richiesta del service worker non arriva al server locale della WebView: non trovando ne' copia ne'
rete, `rispostaSubitoPoiAggiorna` rifiutava la risposta e il sistema mostrava la sua pagina di
errore. Correzione in tre punti: `app.html` punta ora all'indirizzo assoluto del sito; `sw.js` passa
a v168 con tutte le pagine apribili in `ASSETS` (incluso `asset-library.html`, che aveva lo stesso
difetto) e con una **pagina vera** al posto dell'errore crudo quando a mancare e' una navigazione;
l'`AndroidManifest.xml` del progetto mobile riceve l'intent-filter dello scheme `forexbacktestlab`,
senza il quale Android non sa a chi girare la chiamata e riscaricherebbe l'APK anche a chi ce l'ha
gia' installata (cioe' perderebbe i dati salvati). `index.html` **non** entra in `ASSETS`: nel sito
sarebbero 2,4 MB di doppia copia e `"./"` la copre gia'.

**Difetto di costruzione trovato alla pubblicazione.** L'Installer Windows su GitHub e' fallito con
«ERRORE: manca build\app.html»: `installer_build/build_exe.bat` conteneva un a capo in sintassi
PowerShell (i caratteri `r` e `n` fra due apici rovesciati) dentro una riga `.bat`, per cui la copia
non avveniva mai; in locale il difetto era mascherato da `build\app.html` rimasto dalle compilazioni
passate. Vedi `BUG.md`. Ordine tenuto: misura (il test diventa ROSSO e riproduce esattamente il
messaggio di GitHub), correzione, verde, collaudo intero.

**Collaudo.** Locali: `porta_ingresso.test.mjs` (8), `landing_ingresso.test.mjs` (4, preme i pulsanti
in Chromium), `collegamento_al_sito.test.mjs` (1), `avvio_cache.test.mjs` (+2 per la navigazione),
`build_exe_copia.test.mjs` (1). Ognuna delle nuove e' stata vista **diventare rossa** con il codice
di prima, non solo passare. Collaudo locale completo 5/5 verdi; **su GitHub 5/5 verdi** (collaudo
9m1s, server_oracle 19s).

**Pubblicazione.** Push su `main`: sito, Setup 1.0.168 e release. L'APK non viene costruito da
GitHub (il flusso `installer.yml` costruisce solo il Setup Windows): si compila a mano con
`build_apk.bat` e si carica **sulla release come allegato** con il nome esatto
`forexbacktestlab.apk`, che e' quello scritto in `URL_APK` nella landing. Scelta del proprietario:
caricarlo subito dopo la push, accettando una finestra di pochi minuti in cui l'indirizzo dell'APK
risponde ancora 404.

---

## 2026-10-18 — OpenCode — login Google su telefono/tablet: due cause misurate, porta post-login, schema 2.0.1 — collaudo locale 5/5 verde

**Il difetto.** Il proprietario segnala che su telefono e tablet "il login con Google non viene
eseguito", con due errori visibili: Firebase "Unable to process request due to missing initial
state" e "Impossibile raggiungere il sito / Connessione negata da localhost".

**Causa 1, misurata sul sorgente nativo.** `capacitor.config.json` non aveva
`server.allowNavigation`, e `Bridge.launchIntent` (nodo `@capacitor/android`, Bridge.java) butta
nel BROWSER ESTERNO ogni navigazione verso un host che non sia l'app: "Accedi con Google" dentro
l'APK partiva per firebaseapp.com dentro Chrome, il giro veniva completato là, e al ritorno Chrome
cercava https://localhost — l'indirizzo che dentro la WebView esiste e fuori no. Da lì
"Connessione negata da localhost". Correzione: `allowNavigation: ["*.firebaseapp.com",
"*.google.com"]`. Il sito resta FUORI dalla lista, perché il collegamento in alto a sinistra
dell'APK deve aprirsi nel browser — e lo fa per lo stesso meccanismo (test
`apk_login_google.test.mjs`, che salta in modo visibile su GitHub, dove il progetto APK non c'è).

**Causa 2, misurata nel flusso di Firebase.** Lo stato del reindirizzamento vive in
sessionStorage, in memoria del processo: durante la scelta dell'account Android può uccidere la
WebView e al ritorno Firebase butta "missing initial state". Ora il pulsante Google archivia
tutto in localStorage prima di partire (`salvaStatoAuth`) e, al ritorno, rimette ogni chiave
mancante al suo posto PRIMA di `getRedirectResult` (`ripristinaStatoAuth`); la bandierina porta
l'orario, così un backup più vecchio di dieci minuti viene consumato e non lascia l'accesso
automatico fermo. Telefono e tablet usano il reindirizzamento anche nel browser (puntatore
grossolano: niente popup); un popup bloccato ripiega sul reindirizzamento. Test
`login_stato_google.test.mjs` (10), che simula la morte del processo sui magazzini finti estratti
da login.html.

**Requisito del proprietario: dopo il login, sul sito, l'APK o l'apertura diretta.** login.html
sul sito non finisce più su app.html ma su `index.html?dopo=login`: la porta d'ingresso della
landing si apre da sola (stessa codifica dei pulsanti), con sempre l'uscita "Continua col sito
web" verso app.html, e la query viene pulita via replaceState. Test `porta_dopo_login.test.mjs` (9).

**Diagnosi del collaudo rosso su GitHub.** La run 39063565232 era caduta con 1 test su 506 senza
che il nome risultasse da nessuna parte: GitHub tronca i log lunghi. `collauda.sh`, quando un
passo fallisce, stampa ora anche le righe "not ok" dal log completo in `laboratorio/risultati/`.
Con la stampa nuova il nome è saltato fuori (run 39094494504): era `build_exe_copia.test.mjs`,
che fa eseguire le righe vere di build_exe.bat da cmd.exe — e sul runner di GitHub
(`ubuntu-latest`) cmd.exe non esiste: "uscita con null" in 7 millisecondi. Era il colpevole anche
della run rossa dei 506, non era niente di nuovo. Il dettaglio completo si è letto scaricando
l'artefatto `laboratorio/risultati/` dalla run 39094806171. Correzione: su Linux il test salta
con motivo visibile (stesso schema del test APK), e il comportamento della copia si prova per
davvero solo sul Windows del collaudo locale.

**Versione 2.0.1 applicata** (decisione del 17 ottobre): `CACHE_NAME` "forex-backtest-lab-v2.0.1",
filtri `forex-backtest-lab-v[0-9][0-9.]*` in installer.yml (grep ~52 e ~92, `SETUP="${APP}"`,
`--match 'v2.0.*'`), passo `versione_sw` in collauda.sh, `MyAppVersion "2.0.1"` in installer.iss.
Filtro verificato end-to-end prima del push: APP=2.0.1, TAG=v2.0.1. Aggiornate anche le
istruzioni operative che descrivevano lo schema 1.0.NN (PUBBLICARE, SKILL pubblica, CONSEGNA,
REGOLE, CLAUDE).

**Giro storto da ricordare.** La prima stesura di questa voce è stata appesa con `Add-Content` di
PowerShell, che scrive in CP1252: il flusso Pages di GitHub è andato rosso con "invalid byte
sequence in UTF-8" su proprio questo file (Jekyll converte anche `cervello/*.md`). Misurato,
troncato al marcatore, riscritto con l'editor. Un file di testo va toccato con un editor che
scrive UTF-8, non con comandi di riga che ereditano la codifica della console.

**Collaudo.** Locale 5/5 verdi, 528 test 0 falliti (22 in più). I due test nuovi sono stati visti
**diventare rossi** prima della correzione. La sintassi dell'intero modulo di login.html è
verificata a parte con `node --check` (nessun test la compila per intero).

## 19 ottobre 2026 - v2.0.3: posizionare lo stop non scrive più il lottaggio

**«il lottaggio viene esclusivamente modificato solo se l'utente preme direttamente dentro la casella
e inserisce lui un valore, oppure solo quando ha scritto quello che è il rischio in percentuale e poi
clicca il bottone lottaggio […] non deve scrivere direttamente quello che è il lottaggio in maniera
automatica quando io vado a posizionare quello che è lo stop loss prima di aprire un'operazione. No.
Prima posiziono lo stop loss, poi scrivo il rischio, pigio il pulsante e allora a quel punto mi farà
vedere il lottaggio consigliato.**

**Il difetto, e dove stava.** Non era il calcolo: quello era giusto fin dall'inizio. Il difetto era
che il risultato finiva **scritto**. La funzione `autoLottoDaGrafico()` chiudeva con
`$(pending?'lotsPending':'lots').value=s.lots`, e veniva chiamata dai tre punti in cui si posiziona
un livello **prima** di aprire un ordine: lo stop a mercato (con o senza posizione attiva), lo
stop/target dell'ordine pendente e l'entrata del pendente. Perciò mettere lo stop faceva comparire
un lottaggio «già pronto» che l'utente non aveva scelto — e quel numero andava nell'ordine al primo
click, perché il campo Lottaggio è proprio quello che `openMarketTrade()` e
`createPendingOrder()` leggono.

**Misurato prima di correggere** (EUR/USD a 1.1000, saldo 10.000, rischio 1%, conto da 0,07 scritto
a mano): stop a 1.078 → il campo passa a **0,05**. Ordine pendente con stop a 1.073 → **0,03**.
Nessun click dell'utente, in entrambi i casi.

**Il peggio, che il numero non era nemmeno stabile.** Il campo dipendeva da *quale livello fosse
stato toccato per ultimo*: mettere lo stop e poi il target restituiva indietro il consiglio del
target, quindi due caselle diverse mostravano numeri diversi nello stesso momento. Non era un
valore stabile su cui ragionare, e quindi nemmeno correggibile a mente.

**La correzione.** `autoLottoDaGrafico()` calcola ancora il consiglio — serve al messaggio in basso e
resta la base del pulsante che applica — ma non scrive niente. Il messaggio è cambiato con la
parola giusta: prima diceva «Lotto: 0,05 lot (rischio 1,00% = 100,00 $)», adesso dice «**Consigliato**
0,05 lot per un rischio del 1,00% = 100,00 $. **Non è stato impostato**: per applicarlo premi il
pulsante del lottaggio consigliato». Restano aggiornati i riquadri che sono **letture** (quanto
perdo/guadagno, rischio vero del lotto attuale), che descrivono il lottaggio che c'è, non quello
consigliato.

**Verificato che non restasse nessun altro scrittore.** Un grep su tutto il file trova sei punti che
scrivono un campo lottaggio, e sono tutti legittimi: la casella e i quattro pulsanti ﹀ / ︿ / ﹂ / ﹁
(azioni dell'utente), i due pulsanti «APPLICA LOTTAGGIO CONSIGLIATO» (azioni dell'utente), più lo
specchio che riflette il campo vero dentro la barra del grafico. Nessuna scrittura automatica.

**Test.** `laboratorio/app/lottaggio_solo_su_richiesta.test.mjs`, 5 prove, e sono state **viste
diventare rosse prima della correzione** (2 su 5, con il numero esatto nel messaggio: «0,05 invece
di 0,07»). Coprono: lo stop a mercato, il target, lo stop e l'entrata dell'ordine pendente, il
pulsante che continua ad applicare esattamente il consigliato, il numero scritto a mano che resta, e
lo stop spostato dopo che la posizione è già aperta.

## 19 ottobre 2026 — Sync Cloud delle preferenze: watchlist, ricerche e scala vanno sull'account

**Cosa mancava.** La watchlist (stelle), le ricerche salvate del menu ASSET e la scala dell'interfaccia
restavano chiuse dentro il dispositivo dove le avevi scelte: sul telefono la watchlist era vuota, e la
scala scelta sul PC non arrivava da nessuna parte. Aggiungere un asset a mano su ogni dispositivo non e'
"una preferenza", e' un lavoro.

**Come e' fatto.** Stesso schema del collegamento del server, che era gia' collaudato: un documento
Firestore a parte, `users/{uid}/data/preferenze`, raggiunto da due metodi nuovi del ponte
(`preferenzeSalva` / `preferenzeAscolta`). Il blocco `SYNC PREFERENZE` (marcato INIZIO/FINE, come i
blocchi della scala e del collegamento) contiene solo funzioni pure - `fblSyncValidoSimbolo`,
`fblSyncPrepara`, `fblSyncRicevi`, `fblSyncPubblica`, `fblSyncAvvia` - e ogni funzione prende magazzino
e nuvola dai suoi parametri. La pubblicazione parte a ogni modifica vera (stellina aggiunta, stellina
tolta, ricerca salvata, scala cambiata); l'arrivo dal cloud si applica e basta, **non ripubblica**, o i
due dispositivi si rimbalzerebbero le preferenze all'infinito.

**Le regole di sicurezza del documento.** Un documento che arriva da un altro dispositivo si accetta
solo intero e ben formato: se la watchlist ha piu' di 10 voci, o anche una sola voce che non e' un
simbolo valido, o le ricerche non sono valide, si rifiuta tutto e il magazzino resta com'e'. Un dato
difettoso non deve poter cancellare una preferenza buona. Il simbolo valido ammette anche la barra
("EUR/USD"): era il difetto misurato dal test, che all'inizio lo rifiutava.

**Test.** `laboratorio/app/sync_preferenze.test.mjs`, 10 prove con magazzino e nuvola finti: pubblica
quando c'e' qualcosa e non pubblica un documento vuoto (ingannerebbe gli altri), il telefono riceve da
solo, due dispositivi dello stesso account finiscono uguali, il PC cambia e gli altri seguono, un
documento difettoso viene rifiutato senza toccare niente, una nuvola muta non blocca l'avvio, e in
modalita' privata non esplode niente.

**L'incidente.** Per agganciare la pubblicazione della scala ho usato uno script Python che sostituiva
una stringa in app.html: il pattern era troppo corto e ha trovato la PRIMA occorrenza del file, cioe'
`<!DOCTYPE html>`. Il documento si era aperto con tre righe di commento e il doctype spezzato. Il
controllo di sintassi non se ne accorge (gli script restavano validi). Secondo errore nello stesso
giro: gli script hanno scritto i fine riga in LF mentre il file e' in CRLF, e `git diff --stat` e'
schizzato a 47.000 righe cambiate per una modifica di 200. Sistemato guardando
`git diff --ignore-cr-at-eol --stat` (si leggevano le 183 righe vere) e riportando il file a CRLF.
La lezione sta in LEZIONI.md: su app.html si sostituiscono blocchi interi e unici, e si guarda sempre
il numero di righe del diff prima di dire "fatto".

**Il secondo difetto, e l'ha trovato il collaudo, non io.** La pubblicazione delle preferenze la
chiama lo script classico (la stellina, la ricerca salvata, la scala), ma `pubblicaPreferenze` vive
dentro il modulo Firebase, e un modulo non mette i suoi nomi fra quelli globali. Sulla carta la
chiamata c'era; nell'app vera valeva `pubblicaPreferenze is not defined` e la stellina andava in
errore. Il collaudo largo l'ha misurato su un test che toccava la watchlist: 596 su 597. La
correzione e' la stessa di tutto il resto del file: si espone `window.pubblicaPreferenze` e si chiama
`window.pubblicaPreferenze && window.pubblicaPreferenze()`, cosi' dallo script classico non parte mai
un nome che li' non esiste.

## 19 ottobre 2026 — Il popup compare sulla pagina del pulsante che lo hai premuto

**Il difetto misurato.** Con il grafico staccato nella finestra separata (PIP), un popup aperto
premendo un pulsante nella pagina principale finiva comunque nel PIP, che magari non stavi nemmeno
guardando. La misura e' stata fatta prima di toccare: una sonda in Chromium con le due finestre vere
dava `daPagina = "pip"`, cioe' esattamente il contrario della regola chiesta dal proprietario («se lo
apro dalla pagina principale, sulla principale; se lo apro dal PIP, sul PIP»).

**Perche' succedeva, e il secondo errore.** Il file teneva gia' il documento dell'ultimo tocco
(`lastInteractionDoc`), ma nessuno lo leggeva per decidere dove mettere il popup: `popupHostDoc()`
rispondeva sempre "PIP" appena il grafico era staccato. In piu' `moveModalToFloatingIfActive` era
dichiarata DUE volte nel file: in JavaScript vince l'ultima, quindi la versione nuova (quella che
instrada nel documento giusto) era di fatto codice morto, e restava attiva la vecchia che spostava
sempre nel PIP in una sola direzione.

**La correzione.** `popupHostDoc()` guarda `lastInteractionDoc`: il PIP solo se l'ultimo tocco e' li'.
Una sola `moveModalToFloatingIfActive`, quella che instrada (e sa tornare indietro). Tolta la seconda
definizione, con il commento che dice cosa c'era e perche' e' stata tolta.

**Test.** `laboratorio/app/popup_pagina_giusta.test.mjs`, visto ROSSO prima della correzione
(`expected 'principale', actual 'pip'`) e verde dopo. Misura cinque cose con due documenti veri
(iframe same-origin, come il test del menu Strategia): popup dalla pagina principale, popup dal PIP,
rientro, copertura automatica dell'osservatore, e uscita dal PIP senza popup appesi.

## 19 ottobre 2026 — L'APK che rispondeva 404, e la versione che si vede

**Il difetto, riferito dal tablet.** «Sul sito, il pulsante scarica l'APK, mi riporta alla pagina
GitHub con 404.» Misurato con l'API: l'ultima release con l'APK allegato era la v2.0.4-125; dalla
v2.0.4-126 in poi le release allegano solo il Setup Windows, mentre index.html punta a un indirizzo
stabile (`releases/latest/download/forexbacktestlab.apk`) che quindi risponde 404. Il commento nel
sito diceva addirittura «oggi l'APK non e' ancora pubblicato e l'indirizzo risponde 404: il riquadro
lo dichiara» - ma il riquadro non lo dichiarava affatto.

**La correzione, in due parti.** Primo: l'APK e' stato ricostruito dal progetto mobile (build_apk),
con la STESSA chiave della v2.0.4-125 (impronta SHA-256 identica, verificata con apksigner): cosi'
il tablet aggiorna sopra l'app esistente senza disinstallare e senza perdere i dati. E' stato
caricato sulla release v2.0.6 col nome esatto che il sito si aspetta, e l'indirizzo stabile ora
risponde 200 con il tipo giusto. Secondo: index.html non offre piu' un download alla cieca. Chiede
all'API quali file ci sono davvero nell'ultima release e, se l'APK manca, lo dice e toglie quel
pulsante (anche il "ritiro" dell'intent, che puntava allo stesso file inesistente, ora porta al
sito). Se la rete non risponde resta il link stabile di sempre. Test: landing_apk.test.mjs, con
l'API finta e la pagina vera.

**La versione che si vede.** «Io ero alla 2.0.5... non so adesso se e' la versione giusta 2.0.6 o
e' rimasta quella di prima. Magari nelle impostazioni generali mettiamo una nota di rilascio che fa
vedere la versione che e' presente sul dispositivo.» Aggiunta la scheda **Versione** nelle
Impostazioni generali: versione installata, data di caricamento della pagina, ultima versione
pubblicata, cosa cambia, e un pulsante **Aggiorna ora**. La versione non e' scritta a mano: si legge
dalla cache del service worker che sta servendo la pagina, oppure dal sw.js presente sul dispositivo
(nell'APK e' il file incorporato). Il confronto e' numerico (2.0.10 e' piu' nuovo di 2.0.9).

**Perche' il pulsante non era comparso.** Il controllo girava al caricamento e poi ogni 24 ORE: con
l'app lasciata aperta, la release uscita nel pomeriggio si sarebbe vista solo il giorno dopo. Ora il
controllo e' ogni 30 minuti e anche quando l'app torna in primo piano.

**Test.** versione_visibile.test.mjs (7 prove): confronto numerico, versione dalla cache, versione
dal pacchetto quando la cache manca, "sconosciuta" senza nulla (senza errori), pannello con API
finta (installata 2.0.6, pubblicata 2.0.7, note, pulsante), dispositivo gia' aggiornato (pulsante
nascosto), e senza rete ("non disponibile", nessun numero inventato). landing_apk.test.mjs (2
prove): senza APK il download sparisce e si puo' proseguire; con l'APK il download resta.

## 19 ottobre 2026 (pomeriggio-sera) — Fix critici: fullscreen, replay engine, login Google, APK

### 1. Fullscreen: rimossa barra duplicata livePL
Il problema: in modalita' tutto schermo, il box livePL (OPERAZIONE, PREZZO ATTUALE, P/L LIVE, R/R) veniva spostato nella sidebar di destra, ma l'utente lo vedeva gia' sopra i controlli replay. Risultato: informazione duplicata e fastidiosa.
La correzione: rimosse moveLivePLIntoSidebar e restoreLivePLHome dal gestore fullscreenchange. Il box livePL resta nella sua posizione originale (sopra il grafico, fuori dall'area fullscreen) e non appare piu' nella sidebar.

### 2. Replay engine: rewrite completo per fluidita' e realismo
I difetti misurati:
- STOP -> PLAY ripartiva da sub=1 (inizio candela) invece di riprendere dal secondo esatto.
- Alto moltiplicatore (es. 30x): footprint aggiornato 30 volte/frame = 600 calcoli/sec, freeze visibili.
- Tick irrealistici: la candela saliva/scendeva in linea retta, senza micro-movimenti bid/ask.
- Footprint sparisce a fine candela: i livelli accumulati durante la formazione sparivano al forward().
- Volume footprint costante per livello: ogni riga mostrava lo stesso numero per tutta la candela.

La riscrittura completa:
- Ripresa esatta: replayFerma preserva replayForm (con sub = secondo esatto); startPlayInterval lo riprende senza azzerare sub.
- Frame rate fisso 16ms (~60fps) indipendente dal moltiplicatore; lo step replayAdvanceSteps scala i secondi di mercato per frame.
- Tick realistici (OU process): replaySintesiPathRealistica genera path con mean-reversion verso close + rumore, micro-movimenti bid/ask ogni secondo.
- Footprint per-secondo accurato: replaySubAccumulo usa path[sub-1] -> path[sub] per direzione esatta, volume distribuito sui livelli attraversati IN QUEL SECONDO.
- Batching footprint: delta accumulati in _footprintDelta e applicati UNA sola volta per frame (replayApplicaFootprintDelta), da 30x calcoli/frame a 1.
- Footprint persistente: replayFinalizzaFootprint copia il footprint accumulato in rows[idx].footprint; le candele completate MANTENGONO il loro footprint per sempre (non sparisce).
- Moltiplicatore esteso a 100x (era 30x).
- Frame rate 16ms (~60fps) invece di 50ms.

Test: 21 test replay tutti verdi (replay*.test.mjs).

### 3. Login Google su tablet/APK: fix errore 400
Il problema: su Capacitor (APK) il popup Google veniva bloccato -> fallback a signInWithRedirect con redirect URI web (firebaseapp.com/__/auth/handler) che non torna nell'app Capacitor (scheme forexbacktestlab://). Risultato: pagina Firebase 400, stato OAuth perso, schermo bianco al ritorno.
La correzione: su Capacitor (isCapacitor): MAI usare signInWithRedirect. Solo signInWithPopup (WebView moderno supporta popup se WebChromeClient li gestisce). Se il popup fallisce per motivi DIVERSI da "popup-blocked", errore chiaro. Il redirect resta solo per browser mobile NON Capacitor.
File: login.html (modulo Google).

### 4. APK 404 -> 200: ricostruito e caricato
Il problema: il link stabile del sito (releases/latest/download/forexbacktestlab.apk) rispondeva 404: dalla v2.0.4-126 le release allegavano solo il Setup Windows.
La correzione:
- Ricostruito APK dal progetto mobile (build_apk.bat), STESSA chiave della v2.0.4-125 (impronta SHA-256 74117fbd... identica -> aggiornamento in-place senza disinstallare, dati conservati).
- Caricato su release "latest" (v2.0.7-130) col nome esatto forexbacktestlab.apk.
- Link stabile ora 200 OK (6.7 MB, application/vnd.android.package-archive).
- index.html ora chiede all'API quali file ci sono davvero: se APK manca, lo dice e toglie il pulsante (anche il fallback dell'intent ora punta al sito, non al 404). Test: landing_apk.test.mjs 14/14.

### 5. Versione visibile + controllo aggiornamenti intelligente
Richiesta: "Non so se e' la 2.0.6 o la 2.0.5. Nelle impostazioni mettiamo la versione e una nota di rilascio."
Fatto: scheda INFO Versione in Impostazioni generali:
- Versione installata (letta da cache SW / sw.js, non scritta a mano).
- Data/ora caricamento pagina.
- Ultima versione pubblicata (da GitHub API, con note).
- Pulsante Aggiorna ora (scarica Setup/APK, non chiude l'app: l'utente apre il file).
- Controllo automatico ogni 30 minuti (era 24 ore) + al focus pagina (visibilitychange).
Test: versione_visibile.test.mjs 7/7.

### 6. Schede Impostazioni riorganizzate
Nuovo ordine:
1. Live/Storico
2. MT5
3. Kraken
4. Prop Firm
5. Template Notion
6. Sala segnali (Telegram/Syntra con sottoschede, Segnale manuale, gruppi, config Syntra)
7. Collegamento (ponte: solo Ricontrolla + porta nascosta; Accesso dispositivi/Oracle; Account Telegram: collegamento, esci, dimentica numero)
8. Versione

Lazy-load: pannelli "Sala segnali" e "Collegamento" iniettati al primo click (DOM bloat evitato, scrolling fluido). Test: richieste_8ott.test.mjs 8/8 (pulsante "Segnale manuale" in entrambe le sessioni).

### 7. Sito onesto: niente download fantasma
index.html chiede all'API GitHub gli asset dell'ultima release: se APK manca, lo dice e toglie il pulsante (anche il fallback dell'intent porta al sito). Senza rete resta link stabile. Test: landing_apk.test.mjs 2/2 (con APK: download c'e'; senza: sparisce e resta "Continua col sito web").

### 8. Pulizia UI vecchie
Rimosse tracce di "Prova il server", "Salva il server", "Mostra/Nascondi/Copia" chiave PC (esistevano solo nell'APK v2.0.4-125).

### Test completi
- Locale: 607/607 verdi (browser + unit + sintassi).
- GitHub Actions (commit 229a16a): Collaudo VERDE, Installer VERDE (release v2.0.7 + v2.0.7-130 con APK).

### Versioni
- sw.js: forex-backtest-lab-v2.0.7
- installer.iss: 2.0.7
- APK: v2.0.7 firmato con chiave v2.0.4-125 (aggiornamento in-place su tablet).



### 9. L'APK riceve davvero il pacchetto di aggiornamento
Richiesta: "l'applicazione sui dispositivi mobili non riesce a ricevere il pacchetto di aggiornamento
della versione... non puo' essere che un dispositivo mobile non gli arriva la nuova versione pronta da
scaricare dopo una nuova versione lanciata".

Misurata la causa: dentro l'APK la pagina gira in una WebView (Capacitor), e li' il download con
l'attributo "download" NON funziona - la WebView di Capacitor non mette nessun DownloadListener, e
il pacchetto non parte. Il pulsante "Aggiorna" compariva, il click non produceva niente, e
l'utente restava con la versione vecchia senza accorgersene. Il collaudo non lo vedeva: il test
guardava che il click sull'ancora fosse avvenuto, e in Chromium avviene.

Fatto:
- nell'APK il pacchetto si apre come NAVIGAZIONE (link senza l'attributo "download"): Capacitor
  passa l'indirizzo esterno al browser di sistema, li' il file viene scaricato e Android chiede se
  installarlo. Nel browser normale il download diretto resta (li' funziona);
- nell'APK il tag della release NON si annota e l'app non si chiude: l'utente deve ancora
  installare, quindi il pulsante "Aggiorna" resta premibile finche' la versione nuova non e' li';
- il numero di build nel tag ("v2.0.7-131") non viene piu' confrontato come numero di versione:
  se no', il pulsante compariva anche subito dopo l'installazione (2.0.7-131 sembra piu' nuovo di 2.0.7);
- un solo percorso per l'aggiornamento (fblApplicaAggiornamento), cosi' le regole valgono per
  entrambi i pulsanti (header e scheda Versione).

Test: aggiornamento_apk.test.mjs 4/4 (nell'APK il pacchetto si apre come navigazione, il tag non si
annota e il pulsante resta premibile; nel browser il download diretto resta; il build number non
falso segnala un aggiornamento).

### Versioni
- sw.js: forex-backtest-lab-v2.0.8
- installer.iss: 2.0.8

### 10. Il login con Google nell'APK funziona (e non lascia piu' schermata bianca)
Richiesta: "ho sempre problemi con l'accesso con Google [...] mi manda sempre con errore 400 [...]
Quando la verifico mi porta sulla pagina web, mi dà quell'errore. [...] quando stavolta premo il
pulsante Google mi dà tutta schermata bianca".

Misurata la causa: il popup di Firebase è una FINESTRA NUOVA (window.open). Dentro la WebView
dell'APK quella finestra non viene creata: la pagina di Google si apre al posto dell'app e
Firebase, trovandosi senza "opener", non sa a chi restituire la credenziale - e risponde con
l'errore 400. Non era rete, né account, né versione: era il popup.

Fatto:
- nell'APK e sul telefono nel browser si usa il REINDIRIZZAMENTO (pagina intera): la WebView apre
  Google, l'utente fa il login, Firebase richiama l'app (l'indirizzo di ritorno è questa pagina
  stessa, https://localhost/login.html, e "localhost" è fra i domini autorizzati del progetto) e
  qui getRedirectResult() legge la credenziale. Il giro resta DENTRO l'app perché
  "accounts.google.com" e "*.firebaseapp.com" sono già fra gli host ammessi;
- sul computer il popup resta il primo tentativo, col reindirizzamento come ripiego;
- lo stato del giro viene salvato prima di partire (il processo può morire durante la scelta
  dell'account: era già previsto, ma solo per il percorso del reindirizzamento);
- l'app non resta più ferma su una pagina che non è sua: al riavvio, se la WebView è su una
  pagina esterna che non fa parte del giro di accesso, si torna alla pagina dell'app
  (MainActivity.java);
- il blocco del pulsante Google è diventato un blocco marcato ("SCEGLTA FLUSSO GOOGLE"), provato
  per intero con Firebase e finestra finti.

Test: login_google_flusso.test.mjs 8/8 (prima rossi).

### Versioni
- sw.js: forex-backtest-lab-v2.0.9
- installer.iss: 2.0.9

### 11. Il login con Google nell'APK: la credenziale arrivava e nessuno la leggeva
Richiesta: "il login riesce, il problema e' che porta sempre sulla pagina di Google con l'errore
400. Solo che stavolta ho chiuso, sono ritornato indietro. Ho chiuso l'applicazione, l'ho riaperta
e mi ha fatto l'accesso. Mentre invece sul tablet continua a riaprirsi quella che e' la pagina
verifica in due passaggi e l'accesso con Google."

Misurata la causa vera: quando Firebase richiama l'app (https://localhost/login.html#...token...),
la WebView puo' cambiare SOLO il fragmento e NON ricaricare la pagina. Il codice della pagina
resta quello di prima, che aveva gia' letto (e svuotato) il risultato: la credenziale arrivava e
nessuno la leggeva. L'app restava ferma sulla pagina di accesso, e al giro dopo la bandierina
"login in corso" faceva ripartire tutto (sul tablet non finiva piu'). Sul telefono bastava riaprire
l'app: Firebase aveva gia' salvato l'utente, e al riavvio onAuthStateChanged lo trovava - ed e'
infatti il "riavvia e ti fa l'accesso" che il proprietario aveva descritto era la prova che
l'accesso andava, a leggerlo no.

Fatto:
- il risultato del giro si legge SEMPRE (non solo quando la bandierina "login in corso" dice che il
  giro e' partito) e si rilegge quando il fragmento arriva (hashchange), quando la pagina torna
  dalla cronologia (pageshow) e quando l'utente torna sull'app (visibilitychange);
- se due letture si sovrappongono, la seconda non viene saltata ma rimandata: altrimenti la
  credenziale che arriva durante la prima non verrebbe mai letta (l'ho trovato coi test);
- la bandierina scade dopo un'ora e non dopo dieci minuti: l'approvazione in due passaggi su un
  altro dispositivo puo' durare anche una ventina di minuti, e prima scadeva mentre l'utente
  era ancora al lavoro;
- se l'utente e' gia' dentro ma il fragmento e' sparito, l'app va nell'app: non resta ferma
  sulla pagina di accesso con l'utente gia' autenticato.

Test: login_google_esito.test.mjs 6/6 (prima rossi: senza la rilettura al cambio di fragmento
il test del fragmento che arriva dopo diventa rosso).

### 12. La scala dell'interfaccia si puo' ridurre fino al 10%
Richiesta: "il 70% dell'interfaccia e' troppo [sul telefono], devo poter scendere anche a 60, 50,
10, 15, 20. E stessa cosa anche per quanto riguarda la dimensione del testo. Non devi avere
limiti."

Fatto:
- il tetto minimo della scala dell'interfaccia (Impostazioni -> Stile) passa dal 70% al 10%: il
  campo accetta 10, 15, 20, 50, 60... e il valore si ricorda;
- anche il testo disegnato sul grafico scende fino al 10% (prima il minimo era 50%);
- sotto il 10% la scala si ferma al tetto: non ha senso scendere al 1%, non si vede piu' niente.

Test: scala_ui.test.mjs 17/17 (prima 15, e il tetto vecchio era 70/50).

### 13. L'APK ora porta dentro la versione del repository
Misurato: l'APK pubblicato come "v2.0.9" conteneva dentro se' uno sw.js con CACHE_NAME
"forex-backtest-lab-v2.0.8" (era stato copiato PRIMA di alzare la versione, e poi non era stato
ricopiato). Conseguenza per l'utente, sul telefono: il pulsante "Aggiorna" era SEMPRE visibile,
perche' l'app credeva di essere alla 2.0.8 mentre la release era la 2.0.9 - e premendolo proponeva
di scaricare di nuovo la 2.0.9, per sempre. Sembrava un difetto della logica di versione: era
invece il pacchetto fuori data.

Fatto: un test confronta il CACHE_NAME del sw.js del repository con quello davvero dentro l'APK
costruito (laboratorio/app/apk_versione.test.mjs, salta se il progetto mobile non c'e' - sta
fuori dal repository). Verificato che diventa rosso con il difetto e verde col rimedio.

### Versioni
- sw.js: forex-backtest-lab-v2.0.10
- installer.iss: 2.0.10

## 20 ottobre 2026 - v2.0.11: l'accesso con Google lo fa il sistema, e i campi si applicano quando hai finito

### 1. Il login con Google nell'APK: terza volta, e stavolta cambiando strada

**Riferito dal proprietario:** «quando installiamo l'applicazione e andiamo a fare il login con
google ci manda al collegamento con firebase e ci fa mettere email e password, poi ci porta
all'autenticazione a due fattori, una volta che confermiamo l'autenticazione invece di accedere
all'applicazione ci rimanda alla pagina web google con errore 400. [...] dopo di che ritorno
sull'applicazione e rimane ancora in corso l'autenticazione a due fattori che continua a girare la
rotellina del caricamento ma io l'ho confermato, quindi è un bug, va risolto!»

**Prima misura, e serviva.** Il sospetto comodo era che avesse provato un pacchetto vecchio. Falso,
e verificato con le date: `www` aggiornato alle 11:09, APK costruito alle **11:10**. Il pacchetto
che aveva in mano conteneva già la correzione della 2.0.10 — e il test `apk_versione.test.mjs` lo
conferma da solo. Quindi la correzione non aveva funzionato: non c'era niente da ri-provare.

**La causa, questa volta quella vera.** Dentro la WebView dell'app il giro OAuth di Google non è
una strada percorribile, in nessuna delle due forme: col **popup** la WebView non crea la finestra
nuova e Firebase, senza `opener`, non sa a chi restituire la credenziale (400); col
**reindirizzamento** si finisce comunque su una pagina di Google con errore 400 dopo la verifica in
due passaggi. Le due correzioni precedenti (v2.0.9: passa al reindirizzamento; v2.0.10: rileggi
l'esito su hashchange/pageshow/visibilitychange) erano due modi di restare sulla stessa strada
chiusa. In `capacitor.config.json` c'era perfino `allowNavigation` su `*.google.com`, cioè la
scelta esplicita di tenere il giro DENTRO la WebView: era il problema, non la soluzione.

**Come funziona adesso.** Lo fa il sistema operativo, fuori dalla pagina: plugin nativo, Android
mostra il suo elenco di account, restituisce un `idToken`, e il token si scambia con Firebase qui
nella pagina (`signInWithCredential`). Nessuna navigazione, nessuna finestra, nessun esito da
rileggere — sparisce per costruzione tutta la classe di difetti delle tre versioni precedenti.

**Il plugin: non quello suggerito.** Il consiglio di partenza era
`@codetrix-studio/capacitor-google-auth`. Misurato prima di installarlo: ultima versione
**3.4.0-rc.4** (una release candidate) e `peerDependencies: @capacitor/core ^6.0.0`, mentre il
progetto è su **Capacitor 8**. Si usa `@capacitor-firebase/authentication` **8.5.2**, che dichiara
`@capacitor/core >=8.0.0`. Configurato con `skipNativeAuth: true`, così la sessione vera resta UNA
(quella del Firebase della pagina, che è quella che usa tutta l'app) e non ce ne sono due che
possono divergere. Si chiama dal ponte globale `window.Capacitor.Plugins` e non con un `import`:
qui Firebase arriva dalla CDN e nel progetto mobile non c'è nessun bundler.

**Configurazione fatta dal proprietario e verificata.** `google-services.json` in `android/app/`,
con dentro: pacchetto `com.pietrosantini.forexbacktestlab`, client OAuth **ANDROID** con impronta
`64d6f827dd7d...` (quindi lo SHA-1 è registrato) e client OAuth **WEB** (quello che serve per
restituire il token). Gradle era già pronto: `classpath com.google.gms:google-services` c'era, e
`app/build.gradle` applica il plugin da solo appena il file esiste.

**Nell'app non si ripiega sulla pagina.** Se il nativo non riesce, NON si torna al popup né al
reindirizzamento: sarebbe ripiegare esattamente nell'errore 400. Si dice cosa è andato storto e si
resta sulla pagina di accesso. E i messaggi sono stati scritti apposta, perché gli errori del
plugin **non hanno** un `code` in stile Firebase: con il solo `traduciErrore()` l'utente leggeva
«Errore: undefined» — e proprio nel caso da riconoscere, "DEVELOPER_ERROR" (impronta di firma o
client OAuth non corrispondenti), dove un messaggio generico lo manderebbe a cercare il problema
nel suo account Google per sempre.

**Test:** `login_google_nativo.test.mjs` (11), che estrae il blocco marcato da login.html e lo
esegue con Firebase, plugin e finestra finti: strada nativa presa, nessun ripiego, token scambiato,
utente nuovo con email di benvenuto, annullamento, impronta sbagliata, plugin che risponde senza
token (il caso della rotellina), APK vecchio senza plugin (si torna alla strada di prima), e sul
computer nulla cambia. Tutti i test del login insieme: **51/51**.

**Un accorpamento rifatto indietro, e la ragione va ricordata.** Il blocco «dopo l'accesso» era
copiato in tre punti e l'ho accorpato in `entraNellApp()`. Due test di
`login_google_esito.test.mjs` sono diventati rossi: quel pezzo sta in un **blocco estratto e
collaudato a parte**, e chiamando una funzione dell'altro blocco il collaudo avrebbe dovuto
fingerla — provando il finto invece del vero. Le righe sono tornate dove stavano, con il commento
che spiega perché. Due righe ripetute valgono meno di un collaudo che non misura più niente.

### 2. La scala dell'interfaccia e il testo: si applicano quando hai finito di scrivere

**Riferito:** «l'utente clicca sul valore da modificare, modifica il valore e solo allora, quando
ha inserito il valore e clicca fuori, viene applicata la modifica, e non mentre la sta inserendo
[...] se la percentuale è impostata a 50% e l'utente vuole mettere il 30%, l'app non glielo fa
mettere: quando cancella lo 0 e poi il 5 ripristina automaticamente il valore di 50, oppure se
inserisce un numero prima del 5 gli porta la scala alla scala massima di 150%».

**La causa.** I due campi (`fblUiScalaPct` e `chartFontScalePct`) erano agganciati all'evento
`input`, che scatta a OGNI TASTO. Con "50" dentro, un backspace lascia "5": il 5 veniva applicato,
schiacciato al tetto minimo, e — peggio — `fblScalaUiApplica` **riscrive il campo** col valore
schiacciato. Il numero cambiava sotto le dita a metà. Il test l'ha fotografato: `actual: '10',
expected: '5'`.

**La correzione.** Entrambi i campi si applicano su `change` (uscita dal campo o Invio), che è
anche l'evento che ridispara `STYLE_CLONE_FIELD_IDS`, quindi il ripristino della sessione continua
a funzionare. Campo svuotato o messo a zero: si rimette il valore di prima, non il minimo e non il
100%. Il tetto vale ancora, ma solo alla fine (300 → mostra 200).

**Test:** 3 nuovi in `scala_ui.test.mjs`, che rifanno la sequenza 50 → 30 tasto per tasto e sono
stati visti **rossi prima**. I due test che sparavano `input` sono stati aggiornati a `change`, con
il commento che dice che il comportamento è cambiato su richiesta: quello che misurano (il campo
scala la pagina e non il grafico) è rimasto identico.

### 3. Un collaudo che dipendeva dal PATH

`apk_versione.test.mjs` (aggiunto ieri) leggeva l'APK con `execFileSync('tar', ...)`: passava con
il `tar` di Windows (System32, che è bsdtar e sa aprire gli zip) e cadeva con quello che installa
Git (GNU tar), che legge `C:\...` come se `C` fosse un computer remoto e comunque non apre gli zip.
Stesso file, stesso APK, stesso Windows, esito diverso da una sessione all'altra — la lezione 9 un
passo più in là: non basta che un test non erediti il sistema operativo, non deve ereditare nemmeno
il PATH. Riscritto per leggere lo zip col solo `node:zlib`: nessun programma esterno, e da due
chiamate esterne a **8 millisecondi**.

### 4. Android Studio si è aggiornato e ha portato Java 25: l'APK non si compilava più

Alla prima compilazione Gradle è caduto in 4 secondi con `Unsupported class file major version 69`
(= Java 25). Causa: `build_apk.bat` punta `JAVA_HOME` alla JDK dentro Android Studio
(`Android Studio\jbr`), e quella JDK è passata a **25.0.3** — mentre il progetto usa Gradle
**8.14.3**, che non la supporta. Non era colpa del plugin nuovo: era l'aggiornamento di Android
Studio, avvenuto dopo la compilazione delle 11:10 di stamattina (che infatti era riuscita).
Sul computer c'era già una JDK **21.0.11** in `C:\Users\pietro\.jdks\jbr-21.0.11`, che è quella
giusta per Gradle 8.14: `build_apk.bat` ora punta lì, così il prossimo aggiornamento di Android
Studio non rompe più la compilazione.
LA REGOLA: una compilazione che prende la JDK da dentro un programma che si aggiorna da solo è una
compilazione che si rompe da sola. La versione va dichiarata.

### 5. Il token di GitHub fuori dal repository

`API Github.txt` stava nella cartella del repo: non tracciato e **non ignorato**, quindi al primo
`git add -A` sarebbe finito pubblicato. Controllato su tutti i rami: nella storia non è mai
entrato, quindi la chiave non è esposta. Spostato in
`C:\Users\pietro\Documents\credenziali-forex-lab`, e in `.gitignore` è stata messa la rete di
sicurezza (nome esatto più `*token*.txt`, `*.pem`, `*.p12`, `*.jks`, `*.keystore`), verificando che
nessun file già tracciato ci cascasse dentro.

### 6. Da sapere: l'APK pubblicato è firmato con la chiave di DEBUG

Misurato: il SHA-256 di `~/.android/debug.keystore` è `74:11:7F:BD:81:6B:...`, lo stesso con cui è
firmato l'APK della release, e il file allegato alla v2.0.10 è esattamente il
`ForexBacktestLAB.apk` della cartella `debug` (stessi byte). Quella chiave ha la password pubblica
«android», è stata creata il 17 ottobre 2026 e Android la rigenera senza avvisare: **se si perde,
nessuno può più aggiornare l'app sopra quella installata** (bisogna disinstallare, perdendo i
dati). Va salvata una copia al sicuro e, prima o poi, va fatta una chiave di release vera. Detto al
proprietario.

### Versioni
- sw.js: forex-backtest-lab-v2.0.11
- installer.iss: 2.0.11

## 21 ottobre 2026 - lo stop spostato confrontato col passato, e il clic che muoveva ordini dalla tabella

### 1. Una posizione chiusa a un prezzo che il mercato non aveva toccato ⭐

**Segnalato dal proprietario**, con il grafico dell'app e quello di MT5 a confronto (EURCHF,
20 ottobre): «Come ha fatto ad arrivare il prezzo fino a lassù? Non è stato tracciato [...]
effettivamente il mercato vero e proprio non ci è arrivato al prezzo di 0,92830. È andato nel senso
opposto e ha toccato il livello minimo di 0,9247. È più di una volta che mi succede. [...] Lì c'era
lo stop loss, 2 ha chiuso in perdita e a break even».

**Come è stata trovata.** Leggendo la scala di prezzo del suo grafico: la stella della chiusura sta
a 0,92830 e **alla stessa ora dello spike delle 23:00**, ma il massimo di quella candela è ~0,92721.
Quindi non è stata quella candela a far scattare lo stop — `evaluate()` non poteva aver chiuso.
L'altra funzione che chiude esattamente al prezzo dello stop è `scanHistoricalSlTpTouches()`, che
gira a **ogni ricaricamento dello storico** (e alle 23:00 c'era stata una riconnessione).

**La causa.** Quella riscansione ripassa tutte le candele e chiude se una qualsiasi ha toccato lo
stop, con un solo filtro: «candele successive all'APERTURA». Ma lo stop con cui confronta è quello
di **adesso**, che nel frattempo può essere stato spostato. Nel caso vero: SELL aperta alle 17:10 a
0,9283; alle 17:2x il prezzo sale a 0,9285 e tocca 0,9283 **davvero**, ma lì lo stop era ancora
lontano e infatti non successe niente; più tardi lo stop viene portato a pareggio (0,92830); alle
23:00 la riscansione ritrova la candela delle 17:2x e chiude. Il mercato ci era andato — **tre ore
prima che lo stop fosse lì**.

**La correzione.** Una candela vale per lo stop solo se è successiva a **quando quello stop è stato
messo** (`slAt`, scritto adesso da tutti e sei i punti che spostano un livello: pareggio manuale,
pareggio della strategia, stop spostato al raggiungimento di un TP, modifica dal grafico, modifica
dalla barra). Per le posizioni aperte **prima** di questa correzione `slAt` non c'è: lì si guarda se
lo stop è diverso da quello di apertura (`rrSl`, già congelato per il R/R) e, se è stato spostato
senza sapere quando, **dallo storico non si chiude**. Chiudere per sbaglio costa soldi; non chiudere
costa che la posizione resta aperta e la si chiude guardandola.

**Test:** `stop_spostato_storico.test.mjs` (4), visti **rossi prima** — la posizione veniva chiusa a
0,9283 con esito «SP», esattamente il sintomo riferito. Gli altri tre tengono ferme le cose che NON
devono cambiare: uno stop toccato dopo essere stato messo chiude ancora, uno stop mai spostato si
comporta come sempre, e una posizione vecchia con lo stop spostato non si chiude.

**Quello che questa correzione NON spiega, detto chiaramente.** Il proprietario ha fatto notare che
la chiusura è avvenuta **anche sul terminale MT5**. Verificato nel codice: `evaluate()` e la
riscansione escludono entrambe le posizioni reali (`p.mt5Ticket==null`), quindi l'app non chiude mai
una posizione MT5 — la chiude il broker e l'app la rispecchia. Questa correzione vale per le
posizioni **simulate**. Per quella reale la spiegazione tecnica è un'altra: lo stop di una SELL
scatta sull'**ASK**, mentre i grafici (il nostro e MT5) disegnano il **BID**; alla pausa giornaliera
delle 23:00 lo spread si apre di decine di pip, e infatti il grafico MT5 mostra proprio lì uno spike
verticale del bid verso il basso (0,9247) — la firma della rollover. Si verifica dal suo MT5:
storico operazioni (commento `sl`?) e linea Ask attivata (F8) fra le 23:00 e le 23:30. Dal web non
si verifica: nessuna fonte pubblica ha il minuto, e tutte pubblicano il bid.

**Da sapere, e segnalato:** la nostra simulazione valuta gli stop **solo sul bid, senza spread**.
Una posizione simulata sopravvive quindi a eventi che sul reale l'avrebbero chiusa: i risultati del
simulato sono più ottimistici del reale proprio nei momenti peggiori.

### 2. Su Kraken il clic in tabella non muove più stop e target

**Richiesto:** «nelle posizioni kraken ora è in funzione che se clicco sulla tabella delle
operazioni sul tp-sl mi fa cambiare il valore del prezzo, invece no non deve farlo».

Il clic sulle celle SL/TP apriva una finestrella e mandava l'ordine al ponte. Era nato il 7 ottobre,
quando non c'era altro modo; dalla v165 stop e target si spostano **trascinando la linea sul
grafico**. Era quindi una seconda strada per muovere un ordine vero, e la più facile da premere per
sbaglio, perché la tabella si scorre col dito. Tolto il clic, le due funzioni (`krakenSpostaSl` /
`krakenSpostaTp`) non avevano più nessun chiamante: tolte anche quelle, con la nota al loro posto.
La cella «Eseguita» resta cliccabile (v167: l'orario si dichiara a mano) — lì non si muove nessun
ordine.

**Due commenti sbagliati corretti nello stesso giro.** Dicevano che il trascinamento «riusa» le
funzioni della tabella: non è mai stato vero, le chiamate al ponte lì sono scritte di nuovo. Era una
duplicazione dichiarata come riuso, cioè il modo più sicuro per far divergere due strade credendo
che siano una.

**Test:** `kraken_sposta.test.mjs` riscritto (6). Le due garanzie del vecchio banco **non sono state
perse** ma spostate sul trascinamento, che ora è l'unica strada che manda ordini: il ponte legge il
campo `sl` (con `prezzo` non dà errore, dà uno stop che non si muove) e i target si mandano **tutti
insieme** (mandando solo quello spostato, gli altri si cancellano).

**Collaudo locale:** 5/5 verdi, 0 falliti.
