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
