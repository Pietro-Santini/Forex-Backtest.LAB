# Registro dei bug

Formato: **titolo** — stato — dove — causa vera — test che lo controlla.

## Aperti / limiti noti
- **Collegato a un account MT5 si vedevano anche le posizioni dell'altro account** - risolto 2.0.29 - 26 ottobre 2026, segnalato con «se mi collego a un account devo vedere sul grafico soltanto le posizioni di quell'account ... non posso vedere entrambe le posizioni di tutti e due gli account». Causa: `positionBelongsToCurrentView()` con MT5 collegato accettava qualunque posizione con `mt5Ticket!=null`, senza confrontare il login del conto attivo (`currentMt5AccountTag()`), mentre `tradeBelongsToCurrentView()` lo faceva già per i trade chiusi. Ora il filtro delle posizioni aperte è identico a quello dei chiusi.
- **Il P/L live dell'app era diverso dal terminale MT5** - risolto 2.0.29 - 26 ottobre 2026, segnalato con «andando a vedere sul terminale MT5 vedo il PL Live ed è diverso rispetto a quello che mi mostra qui l'applicazione». Causa: `floatingPL()` sommava `mt5RealProfit()` (solo profitto di prezzo), lasciando fuori swap e commissione che il terminale include. Ora usa `mt5RealNet()` (profit+swap+commissione).
- **Il P/L live si aggiornava dopo secondi** - risolto 2.0.29 - 26 ottobre 2026, segnalato con «l'aggiornamento è veramente lento, si aggiorna dopo secondi». Causa: il polling delle posizioni MT5 dal bridge era a 2000 ms. Portato a 1000 ms.
- **Le etichette TP/SL si sovrapponevano e serviva un pulsante per scompattarle** - risolto 2.0.29 - 26 ottobre 2026, segnalato con «devono raggrupparsi nel grafico se nella stessa linea di prezzo ci sono più etichette ... l'utente premerà quell'unica etichetta e quando la preme si espanderà ... e non deve stare il pulsante all'interno di style». Causa: il raggruppamento era solo una modalità alternativa al pulsante "Esplodi etichette" nelle impostazioni. Ora il raggruppamento è il comportamento di default sempre attivo, il pulsante è rimosso, il gruppo si espande al click sull'etichetta ×N e si ricompone al click su un punto vuoto.
- **I disegni slittavano a ogni cambio di timeframe** - risolto 2.0.29 - 26 ottobre 2026, segnalato con «i disegni devono rispettare sempre la stessa identica posizione ... non è possibile che ogni volta che cambia time frame si spostano». Causa: `fblDisegniRiAgganciaAlTf()` spostava ogni ancora al timestamp della candela del TF nuovo più vicina (10:07 → 10:05 o 10:10), cambiando la posizione visiva del disegno. Ora i disegni mantengono il timestamp ASSOLUTO e `dataPosFromTime()` li mappa dentro la candela del nuovo TF alla stessa frazione. Test: `laboratorio/app/disegni_cambio_tf.test.mjs` (riscritto: misura che timestamp e prezzi non si toccano e che 10:07 cade nella candela 5m 10:05-10:10 al 40%).
- **Le candele del grafico erano sfasate di 8h20** - risolto 2.0.2 - 18 ottobre 2026,
  segnalato con «XAU/USD chiude alle 04:55 su MT5, qui alle 13:15 sull'app». Causa misurata:
  `_server_time_offset_seconds()` (`mt5_feed_server.py` per le candele, `bridge.py` per
  posizioni e ordini pendenti) calcolava lo scarto fra orologio server e UTC come
  `tick.time - time.time()` su QUALUNQUE tick, anche uno lasciato indietro da ore: con la
  chiusura giornaliera dell'oro il tick aveva 8h20 di età e quella età sostituiva il fuso
  reale. Ora la misura ha una guardia a 4 livelli: tick fresco → scarto vero (griglia 1800 s
  dei broker); altro simbolo che quota adesso → il suo orologio fa da misura per tutti;
  scan Market Watch al più una volta al minuto; altrimenti 0 o l'ultimo scarto buono, mai un
  numero a caso. Test: `laboratorio/ponte/test_scarto_server.py` (12 prove, con `time` e
  `MetaTrader5` finti, gira anche su CI Ubuntu).
- **Il riquadro dell'installazione da telefono sbagliava su certi dispositivi Android** -
  risolto 2.0.2 - 18 ottobre 2026, `index.html`. Sintomo: «Non c'è una versione installabile
  per questo dispositivo» su Android, e «resta sul web invece di riaprire l'app» dopo il login.
  Causa: `piattaforma()` guardava solo `navigator.userAgent`, e certi browser/webview Android
  non si dichiarano tali — il riquadro cadeva nel ramo «altro» e l'intent verso l'app non
  partiva mai. Ora, falliti i nomi, si guarda l'hardware (`userAgentData.mobile`, oppure
  tocco + `pointer:coarse`): quel telefono riceve la porta Android e l'offerta dell'APK.
  Test: `laboratorio/app/porta_dopo_login.test.mjs` (i tre casi «UA senza nomi»).
- **Login Google da telefono: pagina «400» di Google al primo accesso** - limite noto, non
  risolvibile da noi - 18 ottobre 2026, APK. Dopo l'installazione il primo accesso con
  l'account Google finisce su una pagina di errore **400** mostrata da `accounts.google.com`
  (si vede nell'indirizzo), non dall'app; premendo «Indietro» e riprovando il login riesce.
  Causa: la prima apertura interrompe la continuità OAuth di Google (il browser interno
  dell'APK non ha ancora la sessione pending, e Google rifiuta la richiesta in corso con il
  suo 4 corposo); al secondo tentativo la sessione c'è e il flusso va a buon fine. Nessun
  rimedio in codice: è «riprova e funziona», documentato qui perché non sembri un guasto
  dell'app.
- **Il login con Google su telefono e tablet non veniva mai eseguito** - risolto 2.0.1 - 18
  ottobre 2026, segnalato con due errori ("Unable to process request due to missing initial state"
  e "Impossibile raggiungere il sito / Connessione negata da localhost"). DUE cause misurate, tutte
  e due nella strada del reindirizzamento di Firebase:
  (1) `capacitor.config.json` non aveva `server.allowNavigation`, e `Bridge.launchIntent` di
  Capacitor butta nel BROWSER ESTERNO ogni navigazione fuori dall'app: il giro di Google finiva in
  Chrome (app → firebaseapp.com → accounts.google.com → https://localhost/login.html), e su
  localhost Chrome non trova nulla. Ora `allowNavigation` contiene "*.firebaseapp.com" e
  "*.google.com"; il sito resta fuori, perche' il collegamento in alto a sinistra dell'APK deve
  aprirsi nel browser (test `apk_login_google.test.mjs`).
  (2) Lo stato del reindirizzamento vive in `sessionStorage`, in memoria del processo: Android
  uccide la WebView durante la scelta dell'account e al ritorno Firebase butta "missing initial
  state". Ora il pulsante Google archivia tutto in `localStorage` prima di partire e lo rimette al
  posto PRIMA di `getRedirectResult`; la bandierina porta l'orario, cosi' un backup scaduto viene
  consumato e non blocca l'accesso di chi e' gia' loggato. Telefono e tablet usano il
  reindirizzamento anche nel browser (niente popup); un popup bloccato ripiega sul
  reindirizzamento. Test: `laboratorio/app/login_stato_google.test.mjs`.
  In piu', dopo il login sul SITO si torna alla porta d'ingresso (`index.html?dopo=login`) che
  apre l'app installata o offre l'installazione, con sempre l'uscita "Continua col sito web"
  verso app.html: test `laboratorio/app/porta_dopo_login.test.mjs`.
- **Colonne COB/SVP con righe di altezza diversa da asset a asset, e staccate sulle cripto** -
  risolto v146 - 14 ottobre 2026, segnalato con tre foto (EUR/USD, XAU/USD, BTC/USDT). Il passo
  delle righe veniva da `footprintStepForAsset`, cioe' dall'impostazione del FOOTPRINT: pip per
  "altezza riga", un numero tarato sull'altezza di una CANDELA. Una scaletta di liquidita' non
  c'entra niente con l'altezza di una candela, e quel passo cambia da strumento a strumento in modo
  tutto suo: su EUR/USD usciva una riga da una decina di pixel, su XAU un paio, e sulle cripto era
  cosi' fine rispetto all'intervallo di prezzo che i livelli del book finivano in bin sparsi, coi
  buchi in mezzo. Ora il passo si decide in PIXEL (COB_SVP_RIGA_PX) e si arrotonda a un passo tondo
  dello strumento (1/2/5 x 10^n volte il pip, con le soglie geometriche). In piu' i bordi sono
  arrotondati al pixel e le barre hanno l'altezza piena: era quel mezzo pixel a farle sembrare
  staccate. Test: `laboratorio/app/cob_svp_scala.test.mjs`.
- **Le bandiere delle notizie non si vedevano su telefono e tablet** - risolto v146 - 14 ottobre
  2026. Le bandiere si disegnano solo se `newsEvents` ha qualcosa dentro, e quello si riempie solo
  col POLLING - che partiva da due strade sole: il passaggio Storico->Live fatto a mano, e la
  riconnessione automatica a Capital.com dopo un refresh. La seconda sul telefono NON PUO'
  avvenire: legge le credenziali da una cartella del computer (File System Access API, che su
  telefono e tablet non esiste). In Live da telefono newsEvents restava vuoto per sempre. Nota: lo
  stesso difetto era gia' stato corretto una volta sul PC, ma aggiungendo la chiamata in QUEL ramo
  - una cura che vale solo per la strada che si conosce. Ora newsPollingSincronizza() allinea il
  polling allo stato, ed e' chiamata da updateLiveModeUI(), l'unico punto che tutte le strade
  attraversano. Test: `laboratorio/app/notizie_altri_dispositivi.test.mjs`.
- **Una posizione si "selezionava da sola" e nascondeva le altre** - risolto v146 - 14 ottobre
  2026, segnalato dal proprietario ("da un momento all'altro, in maniera casuale, viene
  visualizzata la singola operazione; noi non abbiamo premuto niente"). `active` faceva DUE
  mestieri: la posizione su cui lavorano le caselle SL/TP - che l'app riassegna DA SOLA in cinque
  punti, tutti con la stessa riga `active = l'ultima posizione di questo asset` (cambio asset,
  chiusura di una posizione, ripristino di sessione, adozione dal conto MT5) - e, dalla v142,
  anche la posizione SCELTA, quella che fa sparire le caselle di tutte le altre. Finche' il
  mestiere era uno solo nessuno se ne accorgeva; col secondo, ogni riassegnazione automatica
  diventa una selezione che l'utente non ha fatto, e sembra che succeda "a caso" perche' succede
  quando cambia qualcos'altro. Ora c'e' `posSelezionata`, che mette solo un clic e toglie solo un
  clic sul vuoto. Test: `laboratorio/app/selezione_posizioni.test.mjs`.
  LEZIONE: quando una variabile che l'app riassegna da sola acquista un SECONDO significato
  "deciso dall'utente", vanno separate. Il difetto che ne esce sembra casuale e non lo e'.
- **Col dito il tocco sul vuoto non deselezionava (serviva la penna)** - risolto v146 - il gestore
  di pointerup del grafico esce prima per `pointerType==='touch'`, e il blocco della deselezione
  stava DOPO quell'uscita: col dito non ci si arrivava mai. E' lo stesso identico difetto gia'
  pagato una volta sulla stessa uscita anticipata (il cambio stile del footprint). Ora il blocco e'
  una funzione, `fblClickSuVuoto()`, chiamata da tutti e due i rami.
- **Syntra: un utente che manda segnali ogni giorno non veniva MAI rilevato** - risolto v145 -
  14 ottobre 2026, segnalato dal proprietario ("le operazioni crypto non vengono acquisite, c'e'
  Gino che manda segnali ogni giorno e non lo rileva mai"). Due cause, tutte e due silenziose:
  (1) una notifica veniva riconosciuta solo se la data stava sulla PRIMA riga e aveva l'anno di
  quattro cifre; la stessa app scrive le date anche senza anno. (2) Peggio: `nt["quando"] or 0` -
  una data NON LETTA diventava 0, cioe' il 1 gennaio 1970, e il controllo sull'eta' la dichiarava
  "vecchia" sempre, scartandola senza dire niente. Ora la data si legge in piu' forme e una data
  sconosciuta NON vuol dire vecchia: la notifica si apre lo stesso (l'insieme `visti` basta gia' a
  non riaprire le stesse). Test: `laboratorio/ponte/test_syntra_notifiche.py`.
  LEZIONE: `x or 0` su un valore che puo' essere None e che poi si confronta con un tempo e' una
  trappola: trasforma "non lo so" in "vecchissimo".
- **Syntra: segnali senza target ne' stop, quindi scartati** - risolto v145 - le due espressioni
  che leggono TP e SL pretendevano etichetta e numero NELLO STESSO nodo ("TP #1:
80335"). Dove
  l'app li scrive in due nodi separati non trovavano niente, il segnale usciva senza livelli e
  veniva buttato. Ora c'e' il ripiego gia' usato per "Entrata": etichetta, poi il primo numero.
  Test: `laboratorio/ponte/test_syntra_asset.py`.
- **Il cambio stile del footprint non si prendeva sulle candele passate** - risolto v145 -
  14 ottobre 2026, segnalato due volte dal proprietario ("deve funzionare su TUTTE le candele, in
  qualsiasi timeframe e per tutti gli asset, rendilo definitivo"). LA DIAGNOSI SBAGLIATA sarebbe
  stata "il gestore guarda solo la candela di adesso": riprodotto nel banco di prova, il
  meccanismo rispondeva su OGNI candela. Il difetto era il BERSAGLIO: la fascia sensibile era
  larga quanto il CORPO della candela (bw, cioe' il 62% della colonna, con un tetto di 12 px senza
  footprint) e alta quanto la candela piu' 18 px sopra e 6 sotto - misurati 9 px per 45. Un
  bersaglio cosi' si prende per fortuna, col dito su un tablet mai, e fra una colonna e l'altra
  restava il 38% di spazio morto. Ora la fascia e' tutta la colonna (cw/n) e si allarga sopra e
  sotto di almeno 22 px, restando comunque legata al prezzo di QUELLA candela (lontano dalle
  candele il grafico non viene toccato) e con le precedenze di prima (posizioni, caselle TP/SL,
  livelli, disegni). Test: `laboratorio/app/footprint_tocco_stile.test.mjs`, che ora prova OGNI
  candela a schermo, i due bordi della colonna e due zoom diversi: e' quello il guard-rail che
  impedisce al difetto di tornare.
  LEZIONE: quando una cosa "non funziona a volte", misurare il bersaglio prima di cercare il bug
  nella logica. Qui la logica era giusta da sempre.
- **Footprint sparpagliato: righe fuori dalla candela e righe alte in modo diverso** - risolto
  v145 - 14 ottobre 2026, segnalato con una foto. Due cause insieme: (a) le righe nascono dai tick
  e possono cadere fuori dall'alta/bassa della candela, e tolto `footprintResliceFisse` (v144)
  nessuno le riportava piu' dentro; (b) il disegno usava il passo salvato DENTRO ogni bucket
  (`bucket.step`), quindi bucket costruiti con passi diversi - dopo un cambio del passo
  automatico, e sempre con le celle aggregate che arrivano dal backup cloud di un altro
  dispositivo - davano righe alte in modo diverso sullo stesso grafico. Ora
  `footprintDentroLaCandela` fa tutt'e due le cose: riporta le righe dentro la candela sommandole
  al bordo (niente volume perso) e riporta il bucket sulla griglia del passo GLOBALE, che draw()
  calcola una volta sola. Test: `laboratorio/app/footprint_scala_unica.test.mjs`.
- **In replay il footprint non si vedeva formarsi** - risolto v145 - la candela in formazione
  accumulava il volume in una mappa sua (`f.fp[prezzo]=numero`, livelli non sulla griglia) e lo
  disegnava come trattini orizzontali. Ora accumula celle vere sulla griglia globale e si disegna
  con lo stesso `drawFootprintCandle` delle altre candele. LIMITE ONESTO che resta: per le candele
  gia' rivelate il footprint c'e' solo dove i tick erano stati registrati davvero - andando
  indietro oltre il log dei tick non c'e' niente da mostrare, e non si inventa.
- **In replay la candela in formazione era un blocco verde/rosso** - risolto v145 - 14 ottobre
  2026, segnalato con due foto. `replayDisegnaFormazione` calcolava la larghezza del corpo su
  `padH*.62` (il 62% di tutta l'area del grafico) invece che su una colonna: col footprint acceso
  il tetto e' 90 px, quindi accanto a candele larghe 12 usciva un rettangolo largo 90. Non era un
  problema di avanzamento - la candela si formava davvero, ma larga nove volte tanto. Ora la
  formula e' quella delle candele vere, `cw/n*.62`, e colori e stoppino sono quelli di Style.
  Test: `laboratorio/app/replay_live.test.mjs` 8).
- **In replay la linea del prezzo restava ferma** - risolto v145 - stessa segnalazione. La linea
  del prezzo corrente e l'etichetta sull'asse usavano sempre `rows[idx].close`, cioe' la chiusura
  dell'ultima candela RIVELATA: durante la formazione non si muovevano, e il prezzo che saliva e
  scendeva si vedeva solo da una riga tratteggiata colorata disegnata apposta. Ora
  `replayPrezzoFormazione()` da' il prezzo della formazione e la linea principale lo segue; la
  riga tratteggiata in piu' e' stata tolta. Test: `laboratorio/app/replay_live.test.mjs` 9).
- **In replay Live il PLAY non aggiornava la candela** - risolto v144 - 13 ottobre 2026, segnalato
  dal proprietario. `getViewWindow` riservava la colonna extra per la candela in formazione solo
  se `!liveModeActive`: durante il replay-Live restava 0, la candela all'indice idx+1 cadeva oltre
  il bordo dell'area di disegno e il clip di `draw()` la tagliava. L'etichetta sull'asse prezzi
  invece si disegna FUORI dal clip e continuava ad aggiornarsi: si vedeva la casellina colorata
  muoversi e il corpo della candela fermo. Ora lo spazio si riserva anche con `liveReplayActive`.
  Test: `laboratorio/app/replay_live.test.mjs` 7).
- **Nel timer MT5 draw() girava anche in replay** - risolto v144 - trovato rileggendo il lavoro
  del giro precedente: `if(!liveReplayActive)update();draw();` - senza graffe solo `update()` sta
  dentro l'if, `draw()` e' un'istruzione a se' e girava sempre. Il ramo Capital.com, scritto con le
  graffe, era corretto: lo stesso commento sopra due righe diverse e' il modo piu' facile di non
  accorgersene. Test: asserzione statica nel 5) di `replay_live.test.mjs`.
- **La prop firm della cronologia si misurava sul capitale gia' cresciuto** - risolto v144 -
  13 ottobre 2026, segnalato dal proprietario. `fblPropDedicataConta` partiva dall'ultimo punto
  PRIMA della data di apertura: su una sala che da 10.000 era arrivata a 20.000, il pop-up «Prop
  firm sbloccata» mostrava 20.000 come capitale all'apertura, e la prop non era piu' confrontata
  col conto versato. Ora la base e' sempre il CONTO INIZIALE del campo e la curva dopo l'apertura
  si riporta su quel conto (percentuali identiche, euro e obiettivo +10% riferiti al conto vero).
  Nello stesso giro: la data di apertura non restava piu' quella della prova precedente.
  Test: `laboratorio/app/prop_firm_cronologia.test.mjs`.
- **Gli indicatori nascosti pesavano come quelli accesi** - risolto v144 - nel ciclo di `draw()`
  `def.compute()` stava FUORI dalla guardia `if(!ind.hidden)`, che proteggeva solo `def.render()`:
  spegnere l'occhio nascondeva l'indicatore ma non ne toglieva il costo. Test:
  `laboratorio/app/indicatori_nascosti.test.mjs`.
- **Le righe di prezzo comparivano anche sulle operazioni chiuse** - risolto v124 -
  9 ottobre 2026, segnalato dal proprietario: «vedo centinaia di righe, esce fuori un bordello».
  L'interruttore del passo 22 disegnava le orizzontali di apertura E chiusura dentro
  `drawClosedTradeMarkers`, cioe' per ogni trade concluso: con uno storico lungo sono due righe
  per operazione che attraversano tutto il grafico. Ora restano solo sulle posizioni APERTE,
  dove dicono a che prezzo si e' entrati su qualcosa di ancora vivo; su una conclusa non
  aggiungevano nulla, perche' ci sono gia' freccia e casella.
  Test: `laboratorio/app/interruttori_posizioni.test.mjs` (prima rosso: 20 righe da 10 operazioni).
- **Il grafico del rendimento si bloccava e lampeggiava bianco al tocco** - risolto v111 -
  8 ottobre 2026, segnalato su telefono e tablet. Quattro difetti nello scorrimento introdotto
  con la v107: (1) il canvas veniva RIALLOCATO a ogni movimento del dito - riassegnare
  width/height lo cancella, e su un telefono lo si prende a meta' strada: ecco il bianco;
  (2) il rettangolo del canvas si rimisurava a ogni movimento, ma i numeri sopra il grafico
  cambiano mentre si scorre e lo spostano - il dito finiva su un punto diverso da quello che
  toccava, ed e' il «salta a caso»; (3) `touchAction:'none'` si mangiava anche lo scorrimento
  verticale della pagina; (4) si ridisegnava a ogni evento invece che a ogni immagine.
  Ora: canvas toccato solo se la misura cambia, rettangolo misurato UNA volta per gesto,
  'pan-y', presa del puntatore e ridisegno una volta per immagine.
  Test: `laboratorio/app/rendimento_scorrimento.test.mjs`.
- **Operazioni segnate come aperte da te, che non erano tue** - risolto v109 - 8 ottobre 2026:
  il nome della sala veniva preso solo da `voce.chat` (il titolo del gruppo), ma il ponte ne manda
  DUE - `chat` e `sala`, la voce esatta scritta nelle impostazioni. Senza titolo la posizione
  nasceva senza sala, e senza sala veniva mostrata come aperta a mano. Peggio: quelle che l'app
  non apre da sola (tetto, freno, margine) il proprietario le apre dalla barra ordini, e da li'
  non c'era nessun legame col segnale. Ora `fblNomeSala` non torna mai vuoto, «tu» si scrive solo
  se non c'e' NESSUNA traccia di un segnale, e una posizione aperta a mano cerca il segnale a cui
  appartiene (stesso asset, stessa direzione, entro due ore, non gia' eseguito).
  Un'operazione attribuita a te sparisce dal profitto per sala: non era estetica.
  Test: `laboratorio/app/origine_operazioni.test.mjs`, `attribuzione_segnale.test.mjs`.
- **Le posizioni di uno stesso ingresso non si raggruppavano** - risolto v109 - 8 ottobre 2026:
  si univano solo con l'entrata IDENTICA, e dieci ordini non si aprono tutti allo stesso prezzo.
  Ora comanda il codice del segnale quando c'e'; dove manca, tolleranza proporzionata alla
  distanza entrata-stop di quella operazione (non un numero fisso: tre punti sull'oro sono niente,
  sull'euro-dollaro sono un'enormita') piu' una finestra di tre minuti.
  Test: `laboratorio/app/gruppi_posizioni.test.mjs`.
- **La stessa sala con due nomi diversi in due schermate** - risolto v109 - 8 ottobre 2026: la
  tabella dell'apertura automatica mostrava la voce configurata, le operazioni il titolo del
  gruppo. Ora il ponte manda i titoli di TUTTE le sale appena si mette in ascolto (li risolveva
  gia' e li buttava via dopo averli scritti nel diario) e l'app li usa ovunque.
  Si riconosce con la chiave, si mostra con il titolo. Test: `laboratorio/app/nomi_sale.test.mjs`.
- **MT5 non si collegava dal telefono, con tutto verde** - risolto v108 - 8 ottobre 2026:
  l'indirizzo degli ordini (porta 8000) veniva INDOVINATO da `fblBaseUrl(8000)`, che passa dal
  server solo col campo "computer" vuoto. Con un indirizzo rimasto scritto da prima, dal telefono
  tutte le chiamate di MT5 ci andavano dritte e il server non veniva nemmeno provato. Il grafico
  no, perche' dalla v105 la sua strada se la prova: da qui il sintomo che non tornava, grafico e
  segnali che funzionavano e la sola sezione MT5 morta. E il pannello «Cosa risponde adesso»
  restava verde perche' la riga Ordini provava una rotta SUA (`/pc/health`) invece di quella in
  uso. Ora la strada degli ordini si prova come quella del grafico (`fblScegliStradaOrdini`), il
  pannello prova l'indirizzo vero, e il popup di MT5 la riscegli prima di dire che non risponde.
  Test: `laboratorio/app/strada_ordini.test.mjs`.
- **Ordini pendenti Kraken fermi a PC spento** — limite — `kraken_ordini.py` — li tiene il ponte sul
  PC. Senza un server sempre acceso non si risolve.
- **Pendenti di un conto di prova non attivo non controllati** — limite — `controlla_pendenti()`
  guarda solo il conto collegato.
- **Livelli dal grafico Binance, scatto sul prezzo Kraken** — limite — piccola differenza di prezzo.
- **Exe non firmati** — limite — Windows SmartScreen avvisa all'installazione.
- **Telegram, Syntra, MT5 non collaudabili nel cloud** — limite — servono sessione/BlueStacks/Windows.
  Nel cloud si collauda l'interprete sui messaggi registrati.

## Risolti
- **In replay la posizione aperta non si vedeva, e i numeri del conto erano di un'altra epoca** — risolto 2.0.28 — 26 ottobre 2026, segnalato con «in modalità replay il PL live non viene visualizzato al momento in cui si apre una posizione in modalità replay che va a finire in storico [...] verranno visualizzati i profitti/perdite della posizione aperta in replay le etichette tp-sl-stop profit eccetera, si aggiornerà anche quello che è la tabella contenente il margine libero, win/loss rate, capitale eccetera dell'account storico quando siamo in modalità replay live». **QUATTRO cause, tutte misurate sul banco Playwright prima di toccare il codice** (`laboratorio/app/replay_conto_storico.test.mjs`):
  (1) `positionBelongsToCurrentView()` con MT5 collegato accettava solo `pos.mt5Ticket!=null`: una posizione simulata (replay e conto Storico) non ha ticket, quindi veniva scartata → `drawableOnCurrentChart()` false → **zero linee, zero etichette, zero righe in `#openPositions`**. Misura: 0 testi con l'euro sulla tela, 0 righe in tabella. Ora `pos.historical`, `!liveModeActive` e `liveReplayActive` escono dal filtro prima del controllo del ticket; la vista Live del conto reale resta identica.
  (2) `floatingPL()` nel ramo live valutava al `livePriceByAsset`, cioè al prezzo VERO di adesso: con un tick a 4.300 e il replay fermo a 4.080 il capitale storico scendeva a **8.481 € invece di 10.000 €** (-1.518 € su una posizione appena aperta e mai mossa). Il prezzo di adesso è il futuro rispetto a ciò che si rivede. In replay ora si valuta al `prezzoMostratoOra()`, e solo per l'asset a grafico.
  (3) `mt5StatsActive()` era vero anche in replay, quindi equity e margine libero arrivavano dal conto MT5 reale: due conti mescolati. Aggiunto `&& !liveReplayActive`.
  (4) trovata dal test, non dalla segnalazione: in replay SL/TP si trascinavano ma **tornavano al valore di prima**, perché `posStoriaAggiornaTutte()` datava lo spostamento a `Date.now()` — il futuro rispetto al punto del replay — e `posLivelliAlTempo()` a quell'istante trovava ancora in vigore il livello vecchio. Ora la data è `replayMomentoMostrato()`.
  **ALTRI TRE PUNTI, trovati dal revisore e misurati prima di correggerli** — il conto storico era ancora mescolato col conto reale, nei due sensi, e il filtro della vista era troppo largo:
  (5) `floatingPL` aggiungeva il profitto VERO di una posizione MT5 (+250 misurati → capitale "storico" 10.250) e `statsTrades` con MT5 collegato restituiva **solo** le operazioni reali: una chiusa a -3.000 portava il capitale a 7.000, mentre una simulata del replay chiusa a +1.000 non entrava mai. Ora in replay contano solo le posizioni `historical` e le operazioni senza `mt5Ticket`; `usedMargin` ignora le posizioni di altri conti.
  (6) `evaluate()` chiudeva le posizioni simulate sulla candela VERA di oggi: con il replay fermo a 4.080 e un target a 4.090, la candela vera a 4.199 la chiudeva subito mentre il grafico mostrava +0,00 — il backtest diventava inutilizzabile. Ora una posizione `historical` si valuta sulla candela del replay (la scelta "gestione in tempo reale" resta per le posizioni del conto Live); anche il Margin Call in replay usa il prezzo del replay.
  (7) Il filtro della vista era troppo largo: dopo lo STOP una posizione simulata restava a grafico nel conto MT5, e durante il replay entrava una posizione reale Capital.com. Ora in replay si vede solo `historical`; la vista Live normale è identica a prima.
  Test: `laboratorio/app/replay_conto_storico.test.mjs` (8 prove: disegno + P/L, conto non valutato al prezzo live, P/L che segue il replay, SL/TP trascinabili e disegnati, conto Storico con MT5 collegato, soldi reali esclusi dal conto storico, nessuna chiusura al prezzo di oggi, vista Live invariata).
- **Posizionare lo Stop Loss scriveva il lottaggio da solo** — risolto 2.0.4 — 19 ottobre 2026, segnalato con «il lottaggio viene esclusivamente modificato solo se l'utente preme direttamente dentro la casella e inserisce lui un valore, oppure solo quando ha scritto quello che è il rischio in percentuale e poi clicca il bottone lottaggio […]: ora il campo si scrive solo scrivendolo o premendo il pulsante del lottaggio consigliato. Test: `laboratorio/app/lottaggio_solo_su_richiesta.test.mjs`.
- **Cambiando asset restavano due grafici sullo schermo** — risolto 2.0.4 — 19 ottobre 2026, segnalato con «vedremo delle candele di un asset e delle candele di un altro» e posizioni fuori scala (XAUUSD a 4000 sulla fascia di AUDCAD a 0,98). Causa: la risposta dello storico dell'asset vecchio scriveva in `csvLibrary` senza verificare che l'asset fosse ancora a schermo. Ora ogni loader (MT5, Capital.com, Binance) scarta la risposta se `asset !== currentAssetKey`. Test: `laboratorio/app/cambio_asset_doppio.test.mjs`.
- **Caricamento di 200.000 candele in un colpo** — risolto 2.0.4 — 19 ottobre 2026, scaricava decine di megabyte per dispositivo e andava in crash sulle macchine da 1 GB con pochi utenti. Ora si caricano al massimo 5.000 candele (fattore 40 in meno di traffico), sufficienti per indicatori e disegni; il resto arriva con la risincronizzazione periodica se l'utente scorre indietro.
- **Mercato chiuso che sfasava le candele di 48 ore** — risolto 2.0.4 — 19 ottobre 2026, XAUUSD a 4161 giovedì 15 ore 06 mostrato come sabato 17 ore 05:50. Causa: `_scarto_fresco_da_epoch()` in `mt5_feed_server.py` e `bridge.py` usava il residuo dalla griglia di mezz'ora invece dell'età del tick, accettando tick vecchi di giorni. Ora rifiuta tick con `|età| > 24h` e `|residuo dalla mezz'ora| > 5min`. Test: `laboratorio/ponte/test_scarto_server.py` (12 prove).
- **Orario di apertura vicino al numero identificativo** — risolto 2.0.4 — 19 ottobre 2026, nelle tabelle posizioni e ordini pendenti compare l'etichetta «apertura» per le posizioni e «inserimento» per gli ordini pendenti, accanto all'orario di esecuzione.
- **Pannello "Accesso da altri dispositivi" senza chiave visibile** — risolto 2.0.4 — 19 ottobre 2026, rimossa la sezione "Come si fa, passo per passo" (procedura Tailscale scritta a mano), il riquadro "Chiave di questo computer" con copia-incolla, e i campi nome/chiave del server visibili. Rimane il pulsante "Consenti l'accesso dagli altri miei dispositivi" e il pannello "Cosa risponde adesso". Tutto passa dal server, niente chiave in giro.
- **Pulsante "Avvia i 7 Giorni Gratuiti" con scelta piattaforma** — risolto 2.0.4 — 19 ottobre 2026, invece di indovinare il dispositivo, apre un modale con tre scelte: Android (APK), iPhone/iPad/Mac (nessun pacchetto ancora, messaggio onesto), PC (Windows, installer). Test: navigazione manuale.
- **Tetti di rischio/capitale e dello stop portati al 100%** — risolto 2.0.4 — 19 ottobre 2026, da 20% (cripto 40%) a 100% per tutti, su richiesta esplicita: «la percentuale sia di rischio che del capitale può essere impostata fino al 100%». I numeri che non sono prezzi restano scartati dal controllo dell'entrata.

- **Posizionare lo Stop Loss scriveva il lottaggio da solo** — risolto 2.0.3 — 19 ottobre 2026,
  segnalato con «il lottaggio viene esclusivamente modificato solo se l'utente preme direttamente
  dentro la casella e inserisce lui un valore, oppure solo quando ha scritto quello che è il rischio
  in percentuale e poi clicca il bottone lottaggio […] e non deve scrivere direttamente quello che è
  il lottaggio in maniera automatica quando io vado a posizionare quello che è lo stop loss prima di
  aprire un'operazione». Causa vera: la funzione `autoLottoDaGrafico()`, chiamata dai TRE punti in
  cui si posiziona un livello prima di aprire un ordine (stop a mercato, stop/target dell'ordine
  pendente, entrata del pendente), finiva con `$(pending?'lotsPending':'lots').value=s.lots` —
  cioè scriveva il numero calcolato dentro il campo Lottaggio. A schermo compariva un lottaggio
  «già pronto» che l'utente non aveva scelto, e quel numero finiva nell'ordine al primo click: il
  rischio vero non era quello scritto nella casella RISCHIO. MISURATO sul banco (EUR/USD a 1.1000,
  rischio 1% su 10.000): mettere lo stop a 1.078 portava il campo da **0,07 a 0,05** senza che
  nessuno avesse premuto niente; sull'ordine pendente da **0,07 a 0,03**. Peggio, il numero non
  era stabile: dipendeva da quale livello fosse stato toccato per ultimo, quindi due caselle
  diverse potevano mostrarlo in momenti diversi. Ora la funzione calcola il consiglio (serve al
  messaggio in basso e resta la base del pulsante che applica) ma **non scrive niente**; il
  messaggio dice «Consigliato 0,05 lot […] Non è stato impostato». Verificato con un grep su
  tutto il file: i sei punti rimasti che scrivono un campo lottaggio sono tutti specchi o azioni
  esplicite (la casella, i quattro pulsanti ﹀/︿/﹂/﹁, i due pulsanti «APPLICA LOTTAGGIO
  CONSIGLIATO»). Test: `laboratorio/app/lottaggio_solo_su_richiesta.test.mjs` (5 prove, viste
  rosse prima della correzione).
- **Il Setup non si costruiva su GitHub: «ERRORE: manca build\app.html. Scarica tutto il progetto
  (non solo installer_build)»** — risolto v168 — 17 ottobre 2026, scoperto solo alla pubblicazione,
  non in locale — la riga che copia `app.html` dentro `installer_build\build\` conteneva un a capo
  scritto `r`n: quella è la sintassi di **PowerShell** per andare a riga nuova, e dentro un `.bat`
  non significa niente. `cmd.exe` leggeva tutta la riga come un **unico comando storto**, la copia
  non avveniva mai, e il controllo immediatamente dopo trovava `build\app.html` assente. Non saltava
  fuori in locale perche' `build\app.html` c'era **gia'** lì da una compilazione precedente, che ha
  mascherato il difetto: su GitHub si parte da una cartella pulita e lo script si fermava subito.
  LEZIONE: un `.bat` si scrive e si legge con `cmd.exe`, non con PowerShell — sono due linguaggi
  diversi e quello della shell corrente vince dentro ogni riga che contengono. Simile a
  `sintassi_app` per `app.html`, ma non basta leggere il file: qui il test le **esegue** le righe
  vere con `cmd.exe` su una cartella di prova e guarda se i file arrivano.
  Test: `laboratorio/app/build_exe_copia.test.mjs` (rosso con la riga rotta, con lo stesso identico
  messaggio d'errore che appariva su GitHub, poi verde con la riga corretta).
- **Linee SL e TP delle posizioni Kraken che seguivano il prezzo** — risolto app v100 —
  `krakenDisegnaGrafico` compensava la differenza fra i prezzi del grafico (Binance) e quelli di
  Kraken con uno scostamento **ricalcolato a ogni disegno**: muovendosi il prezzo si muoveva anche
  lo scostamento, e con lui le linee. Una linea di stop che insegue il prezzo non dice piu' dove
  chiudera' la posizione. Ora si calcola una volta, alla comparsa della posizione, e si butta
  quando la posizione si chiude. Test: `laboratorio/app/kraken_linee.test.mjs` (4).
- **Posizioni Kraken nella stessa casella di quelle MetaTrader** — risolto app v100 — riquadro
  separato, con le stesse colonne di MT5 (asset, side, entry, SL, TP, R/R, lotti, margine, prezzo
  corrente, P/L live) e i pulsanti «vai a grafico», «seleziona», «BE», «chiudi». Il R/R usa lo stop
  di APERTURA: con quello di adesso, portandolo a pareggio diventerebbe infinito.
  Test: `laboratorio/app/kraken_posizioni.test.mjs` (6).
- **Dal telefono il grafico diceva «nessuna risposta»** — risolto app v98 + server — il grafico sta
  sulla porta 8001 del PC, ma il server girava al PC solo la 8000: dal telefono non aveva nessuna
  strada. Ora il server gira tutte e tre le porte previste (`/pc/<porta>/<percorso>`, solo
  8000/8001/8769) e l'app capisce da sola se il ponte locale c'e' (sul computer) o no (sul
  telefono) chiedendolo una volta e ricontrollando ogni minuto. **La chiave giusta la mette
  `fblConChiave`**, che riconosce l'indirizzo del server: metterla nei singoli punti avrebbe
  voluto dire dimenticarsene in qualcuno.
  **Resta aperto**: i tick dal vivo passano da WebSocket, che il server non gira ancora. Dal
  telefono il grafico si disegna con lo storico ma non si muove da solo.
- **«computer spento» detto anche quando nessun computer era registrato** — risolto app v98 — 502 e
  503 sono due cose diverse che si risolvono in modi opposti, e avere lo stesso messaggio ha fatto
  cercare un guasto che non c'era. Test: `porta_unica.test.mjs`.
- **Syntra sul server: «[Errno 2] No such file or directory: C:\platform-toolsdb.exe»** —
  risolto — spostando il ponte dei segnali sul server (Linux), Syntra tentava lo stesso di aprire
  ADB con un percorso di Windows. Ora dice la verita': Syntra legge BlueStacks sul computer e sul
  server non puo' funzionare (gia' previsto in ORACLE.md, fase 4).
- **Le barre dei grafici disegnate SOPRA i nomi** (profitto per strategia, per sala, per asset) —
  risolto app v97 — `graficoOrizz` disegnava le barre negative normali e le ribaltava con un
  `transform` SVG (`translate(...) scale(-1,1)`). Ma l'animazione CSS `fsGrowX` scrive anch'essa
  sul transform e lo SOSTITUISCE: finita l'animazione la barra perdeva spostamento e ribaltamento
  e ricompariva nell'angolo in alto a sinistra, sopra il nome della prima riga. Si vedeva solo con
  valori negativi e carta stretta. Ora le barre negative si disegnano alle coordinate vere
  (`hbarPath(...,sinistra)`), senza nessun transform.
  Test: `laboratorio/app/grafici_statistiche.test.mjs` (3, 5 rossi prima).
- **«Accesso a Telegram interrotto, premi di nuovo Collegamento»** — migliorato app v97 — il
  comportamento era gia' giusto (col numero salvato si rimanda il codice; senza, si richiede prima
  il numero) ma non lo diceva, e restava una richiesta a meta' in sospeso. Ora il messaggio dice
  cosa accadra' al prossimo tentativo e lo stato si azzera.
  Test: `laboratorio/ponte/test_accesso_interrotto.py` (3).
- **Trade Journal di Kraken vuoto per le chiusure avvenute a app chiusa** — risolto app v94 — le
  righe le scriveva l'app nel momento della chiusura (`krakenRegistraChiusura`). Con il server
  sempre acceso le posizioni si chiudono anche a app chiusa - cioe' proprio il caso per cui il
  server esiste - e quelle righe non nascevano per nessuno; su un dispositivo nuovo il giornale
  mostrava solo cio' che quel dispositivo aveva visto. Ora `krakenRicostruisciGiornale()` le
  ricava dallo storico del server (gia' persistente, fino a 2000 esecuzioni), seguendo la
  posizione netta per simbolo. Niente doppioni: ogni riga porta una chiave ricavata dal dato del
  server (`kr:<conto_id>:<simbolo>:<ts>`), e la riga scritta dal vivo porta la stessa.
  **conto_id e non il nome**: il nome si puo' rinominare, e al primo rinomina sarebbero tornati
  tutti doppioni. Test: `laboratorio/app/giornale_kraken.test.mjs` (5).
- **Collegamento/Modalita' chiedeva due indirizzi e due chiavi** — risolto app v93 — dal telefono
  si scriveva nome e chiave del computer E nome e chiave del server, e la chiave del computer si
  ricopiava a mano da una parte all'altra. Ora si scrive solo il **server**: il computer si
  presenta da solo (`/registra-al-server` -> `/pc/registra`), e gli ordini MT5 il server li gira
  al PC. In cima tre righe - ordini, grafico, segnali - che si aggiornano da sole ogni 6 secondi
  finche' la schermata e' aperta, e si fermano alla chiusura.
  Test: `laboratorio/app/porta_unica.test.mjs` (5), `laboratorio/ponte/test_porta_unica.py` (5).
  Trovato dal test: togliendo il blocco dei campi era sparito anche `fblRemotoEsito`, dove
  finiscono i messaggi di Salva e Prova — `fblRemotoApri` scoppiava all'apertura.
- **Il collaudo su GitHub era rosso dal 6 ottobre e nessuno se n'era accorto** — risolto 7 ottobre
  2026 — `.github/workflows/collaudo.yml` installava `fastapi` ma non `uvicorn`, e
  `segnali_bridge.py` esce gia' all'import ("Mancano le librerie"): i test del ponte non partivano
  proprio. Ora le librerie si prendono da `requirements.txt`, il file che le dichiara. Controllo:
  `gh run list --workflow=collaudo.yml`.
- **Niente da fare mentre internet non c'e'** — risolto app v92 — l'avvio aspettava il
  collegamento e dopo 25 secondi offriva solo «Riprova», mentre il backtest lavora su dati gia'
  presenti sul dispositivo. Ora c'e' `fblInternetVero()` (prova davvero, non si fida di
  `navigator.onLine`, che su una Wi-Fi che non naviga dice "si") e «Continua solo in backtest»,
  con un contrassegno in alto e un «Accedi» che porta al login **solo** se la verifica dice che
  internet c'e'. Test: `laboratorio/app/solo_backtest.test.mjs`.
- **Sul telefono l'app resta ferma sul logo** — risolto app v91 — `sw.js` — MISURATO: `app.html`
  pesa 4,03 MB e ci mette 3,2 s a scaricarsi da un computer con rete veloce (su dati mobili molto
  di piu'). Il service worker chiedeva SEMPRE la rete, con `cache: 'no-store'` che salta apposta
  anche la cache del browser, e si decideva a mostrare la copia salvata solo dopo 4 secondi
  (`RISERVA_MS`): con un file da 4 MB quell'attesa c'era praticamente sempre, e i 4 MB si
  riscaricavano a ogni apertura. Ora la copia salvata si mostra SUBITO e la rete aggiorna dietro
  (senza `no-store`: con l'ETag l'aggiornamento e' una domanda da pochi byte). Quando arriva una
  versione nuova la pagina lo dice con un avviso e un pulsante «Ricarica», invece di ricaricarsi
  da sola mentre si guarda una posizione aperta.
  Test: `laboratorio/app/avvio_cache.test.mjs` (6, rossi prima).
- **«Installa i pacchetti aggiuntivi» chiesto a chi li ha gia' installati** — risolto app v90 —
  `mt5StartLoginFlow()` provava `/health` UNA volta sola e, se non rispondeva, mostrava il passo 1,
  che e' la schermata dell'installazione. Ma `/health` muto quasi sempre vuol dire che il servizio
  non ha finito di partire (parte da solo; su un PC appena acceso ci mette qualche secondo). La
  procedura precedente (`mt5StartLoginFlowLegacy`) aspettava con `waitForBridgeHealthy(20000)`:
  quella nuova aveva perso l'attesa. Ora aspetta, e se il servizio ha gia' risposto almeno una
  volta su questo PC (`fxbt_ponteGiaVisto`) la schermata dice «non risponde» con «Riprova», non
  «installa». Test: `laboratorio/app/pacchetti.test.mjs`.
- **WebSocket segnali 403 ("ponte non raggiungibile")** — risolto v70 — `segnali_bridge.py` — il
  decoratore `@app.websocket("/ws/segnali")` era finito sopra `_manda_storico`. Controllo: `--verifica`.
- **Barra ordini con Kraken: rischio e lotto col modello forex** — risolto app v85 — usava saldo
  MT5/backtest e contratti da 100.000. Test: `laboratorio/app/barra_kraken.test.mjs`.
- **Anteprima sul grafico in € forex con Kraken** — risolto app v85 — `drawTpSlZoneBox`. Test: idem.
- **Id ordini pendenti uguali nello stesso millisecondo** — risolto — STOP SELL non scattava.
  Test: `laboratorio/ponte/test_kraken_pendenti.py::test_stop_sell_e_id_diversi`.
- **Pendente scattato registrato due volte nel Journal** — prevenuto — memoria locale degli id presi.
  Test: `barra_kraken.test.mjs` "preso in carico una sola volta".
- **Casella posizione Kraken che non arrivava all'ultima candela** — risolto — `keepPaceIdx` voleva
  un indice, riceveva `true`. Test: `journal_kraken.test.mjs`.
- **Pulsanti e schede che "non funzionavano" nella finestra PIP** — risolto — ascoltatori delegati
  solo su `document`. Ora `fblDelega()`.
- **Test del ponte che usavano la rete vera** — risolto 2026-10-05 — `laboratorio/ponte/_percorsi.py`
  — il simulatore scaricava i prezzi di Kraken; ora rete esterna bloccata nei test.
- **Segnali e apertura dai segnali senza consenso informato** — risolto app v86 — consenso a due
  livelli (`consensoRischi('segnali'|'esecuzione')`), registrato con data e versione, sincronizzato
  sull'account; l'apertura automatica si ferma se manca. Test: `laboratorio/app/consenso.test.mjs`.
- **"Dimentica il numero" non scollegava da Telegram** — risolto app v88 — ora "Esci da Telegram":
  il ponte fa il logout, cancella sessione e numero; ricollegandosi chiede numero e codice.
  Test: `laboratorio/app/esci_telegram.test.mjs`, `laboratorio/ponte/test_esci_telegram.py`.
- **Nessuna criptovaluta veniva riconosciuta nella pagina di prova** — risolto app v104 — le monete
  riconosciute erano due (BTC, ETH) e non in tutte le forme (`BTCUSDT` si', `ETHUSDT` no). Ora si
  generano da un elenco di 31 monete, in **due** posti: `CRIPTO` in `parser_segnali.py` (il ponte
  normalizza `SOL`, `SOLUSDT`, `SOLANA`, `SOLPERP` in `SOLUSD`) e `TG_CRIPTO` in `app.html` (i
  gruppi di sinonimi con cui l'app ritrova l'asset dal broker). Aggiungere una moneta = una riga di
  qua e una di la'. Test: `test_parser.py` (sezione CRIPTOVALUTE), `laboratorio/app/cripto_gruppi.test.mjs`.
- **Syntra smetteva di aggiornare la pagina e non rilevava piu' le sale** — risolto app v104 — due
  difetti, tutti e due silenziosi. (1) `primo` diventava False solo quando la pagina Notifiche
  veniva trovata: se al primo giro non si trovava, da li' in avanti `aggiorna_notifiche` non veniva
  piu' chiamata (sta sotto `if not primo`) e ogni notifica veniva segnata come vista senza essere
  consegnata — con lo stato che diceva "collegato, nessun errore". Ora l'aggiornamento non dipende
  da `primo`, i tentativi a vuoto si contano e si dicono in `syntra_errore`, e dopo 20 giri Syntra
  viene riaperta nell'emulatore. (2) Il messaggio "Syntra non funziona su Linux" finiva in
  `stato["syntra"]`, una chiave che l'app non legge: ora in `syntra_errore`.
  Test: `laboratorio/ponte/test_syntra_blocco.py` (4 dei 6 fallivano prima della correzione).
- **I trade Kraken finivano nel conto "Live" delle statistiche** — risolto app v104 — `contoDi()`
  guardava solo `mt5Ticket`; le righe Kraken (`account:'kraken'`, `mode:'live'`) diventavano "Live"
  insieme ai trade simulati, e non erano separabili nemmeno a mano. Ora si chiamano
  `🐙 Kraken <conto>`, il menu ha due famiglie («Tutti i conti Forex» / «Tutti i conti Kraken»),
  si parte dal solo Forex e la somma fra i due mondi resta possibile ma con un avviso scritto.
  Test: `laboratorio/app/dashboard_conti.test.mjs`.
- **Il ponte dei segnali moriva su una emoji** — risolto v106 — 7 ottobre 2026, 16:29:
  `UnicodeEncodeError: 'charmap' codec can't encode character '✅'` in `_log`, console cp1252.
  Da quel momento niente piu' segnali, ne' Telegram ne' Syntra, e nessuno lo ha riacceso. Ora
  `_scrivibile()` riduce il testo a cio' che la console sa scrivere (l'emoji diventa `?`) e `_log`
  non puo' sollevare nulla. Test: `laboratorio/ponte/test_diario_emoji.py`.
- **Syntra non partiva piu' da quando i segnali sono sul server** — risolto v106 — il ponte sul
  computer lo accendeva l'app con `/segnali-launch`, e con un server configurato non lo accende
  piu'. Ma Syntra vive li' (legge BlueStacks via ADB). Ora i ponti sono DUE: Telegram sul server,
  Syntra sul computer avviata con `--solo-syntra`, che non tocca Telegram — avviare qui la sorgente
  Telegram vorrebbe dire chiedere il codice per un account gia' collegato sul server. I segnali dei
  due finiscono nella stessa bacheca; lo stato di Syntra lo scrive solo il ponte di Syntra.
  Test: `laboratorio/ponte/test_solo_syntra.py`, `laboratorio/app/due_ponti_segnali.test.mjs`.
- **Il grafico dal telefono non passava mai dal server** — risolto v105 — dei tre servizi era
  l'unico senza `srv ?`: usava `fblBaseUrl(8001)`, che va al server solo col campo "computer" vuoto.
  Con un indirizzo vecchio rimasto scritto, ordini e segnali lo ignoravano e il grafico ci sbatteva.
  Ora si prova: prima dritto al computer (una tappa in meno per i prezzi al millisecondo), poi dal
  server; e c'e' scritto quale strada e' in uso. Test: `laboratorio/app/strada_grafico.test.mjs`.
- **«Installa i pacchetti aggiuntivi» compariva ancora su telefono e tablet** —
  risolto app v112 — 9 ottobre 2026. Due buchi con la stessa conseguenza:
  (1) il gate «hai già installato MT5?» (passo 2) cadeva sul passo 1 col testo
  STATICO dell'installazione (`mt5ShowStepVisible(1)` senza `mt5Passo1Parole`)
  quando il bridge smetteva di rispondere mentre si era al gate — esattamente
  cosa fa un ponte impallato — mostrando «Installa i pacchetti aggiuntivi» col
  pulsante di download su QUALSIASI dispositivo, e lo stesso testo statico anche
  sul computer quando i pacchetti c'erano già; (2) `fblEMobile()` non riconosceva
  un telefono con il browser in «modalità desktop»: la User-Agent mente e il
  controllo chiedeva `maxTouchPoints > 1` (un telefono così ne ha anche solo 1).
  Ora il gate adatta le parole prima di mostrare il passo 1
  (`mt5Passo1Parole(pontGiaVisto)`), `fblEMobile()` guarda l'hardware (touch —
  anche di una sola punta — + puntatore grossolano + schermo piccolo) e i Client
  Hints del sistema operativo, e la condizione vale anche per `fblRemoto()`
  (la chiave ereditata `fb_indirizzo_ponte`, scritta solo sui telefoni prima del
  7 ottobre). Il pulsante «Scarica MetaTrader 5» del gate non compare più fuori
  dal computer, e il suo messaggio dice che il terminale si installa sul COMPUTER.
  Test: `laboratorio/app/pacchetti_mobile.test.mjs` (4 test, 3 fallivano prima).
- **Segnale su un asset che vive solo su Capital.com mandato a MT5** — risolto app v113 —
  9 ottobre 2026. PASSO 13. Con MT5 collegato, il segnale di una sala su uno strumento che non
  esiste né su Kraken né su MT5 (un'azione, un indice) veniva comunque mandato a MT5 come ORDINE
  VERO, con l'epic di Capital.com come simbolo: il broker quel simbolo non lo conosce e lo
  rifiuta, la posizione non si apriva e il segnale restava «eseguito» a metà.
  Catena del difetto (righe di `app.html` PRIMA della correzione): `tgContoPerSegnale` (25518)
  ritornava solo `'kraken' | 'mt5' | 'sim'`; `tgAssetPerStrumento` (26940) trovava GIÀ l'epic su
  Capital.com (26976-26979); `tgEseguiSegnale` (27234) procedeva con `reale=!!mt5Connected`;
  `openMarketTrade` (19565) dirottava a `placeRealMt5Order`, che fa `POST /order/market` (19473)
  con quel simbolo. Capital.com nell'app è di sola LETTURA: nessun endpoint per inviare ordini
  (l'unica POST è il login `/api/v1/session`), le posizioni «Capital.com» sono simulate in app
  (`positions.push`).
  CAUSA VERA: la decisione del conto stava in una funzione SINCRONA (`tgContoPerSegnale`) che non
  poteva né chiedere a MT5 se conosce lo strumento né accendere la connessione a Capital.com:
  l'unico esito possibile era `'mt5'`.
  CORREZIONE: nuova `tgContoEffettivoPerSegnale(seg)` ASINCRONA che, se il conto sarebbe `'mt5'`,
  chiede a `resolveMt5SymbolForAsset` se il broker ha lo strumento (`null` = «non ce l'ha»,
  definitivo; `undefined` = errore di rete, nel dubbio si resta su MT5) e in tal caso accende
  Capital.com in silenzio (`tgCapitalAccendiInSilenzio`, coi dati salvati, senza aprire moduli) e
  ritorna `'capital'` se Capital.com conosce l'epic. Nuovo ramo `conto==='capital'` in
  `tgAutoValuta` (prezzo da Capital.com via `fetchLatestPriceRest`, `tgPiano`, apertura con
  `tgCapitalEseguiSegnale`). `tgCapitalEseguiSegnale` apre posizioni SIMULATE in `positions[]`
  marcate `account:'capital'`: MAI un ordine a MT5. Capital.com diventa poi una FAMIGLIA A PARTE
  nel Trade Journal: `contoDi` ritorna `'💹 Capital.com'` per `account==='capital'`, nuovo helper
  `eCapital`, gruppo dedicato in `opzioniConto`, filtro `__capital`, badge in
  `journalSessionBadgeHtml`.
  Test: `laboratorio/app/capital_instradamento.test.mjs` — 5 test: (1) MT5 non ha lo strumento ma
  Capital sì → conto `'capital'`; (2) se MT5 lo ha → resta `'mt5'`; (3) senza connessione a
  Capital.com non si tenta; (4) l'esecutore apre simulato e a MT5 arrivano 0 ordini; (5) nel
  Journal Capital.com è famiglia a parte, non «Live». Prima della correzione i 5 test erano rossi.
- **Sei difetti dell'ondata 1 (v115–v117)** — risolti 9 ottobre 2026.
  - **Apertura automatica da un altro dispositivo** (v117): l'apertura automatica la fa **solo il
    computer** (`tgSonoIlComputer`); telefono e tablet mostrano il segnale e aprono a mano.
    Test: `laboratorio/app/apertura_solo_computer.test.mjs`.
  - **Errore latente del passo 13** (v117): nel ramo Capital di `tgAutoValuta` si usava `sym` prima
    della dichiarazione (TDZ), quindi l'apertura **automatica** Capital.com andava in errore. Corretto
    con `let sym` in cima.
  - **Attribuzione della sala** (v115): `fblOrigineBadgeHtml` non recuperava la sala dal ticket MT5,
    mentre il Trade Journal sì: la stessa posizione era `📡 Sala Oro` nel Journal e `👤 tu` nella
    tabella. Ora `fblOrigineBadgeHtml` chiama `mt5ApplicaSegnale(p)` e `mt5AllineaApertura` applica la
    sala su ogni percorso. Test: `laboratorio/app/attribuzione_mt5.test.mjs` (4).
  - **Asse dei prezzi e colonne COB/SVP** (v117): l'asse faceva partire il **drag** di TP/SL o
    pendenti sotto il dito (guardia con `&& !tradeLevelHit(...)`) e la striscia di zoom era spostata
    sopra le colonne COB/SVP; COB/SVP, dal canto loro, zoomano per errore. Ora l'asse fa **solo
    zoom**, la striscia è ancorata al bordo (`right:'0px'`), e su COB/SVP si **trascina** il grafico
    (mai zoom, mai linea). Test: `laboratorio/app/asse_prezzi_zoom.test.mjs` (3).
- **I segnali doppioni riaprono una seconda posizione** — risolto app v116 — 9 ottobre 2026: stesso
  strumento, stessa direzione, stessa fascia d'entrata e stessi target non aprono più una seconda
  posizione. Funzioni pure `fblDedupTp`/`fblDedupStesso`/`fblDedupMotivo`; gancio in `tgAutoDecidi`
  (ritorna `no('doppione: …')`) e in `tgEseguiSegnale` (avviso + conferma esplicita già presente).
  Esenti «aggiunta» e «seconda entrata»; tolleranza `fblTolleranzaEntrata×0,5`. Test:
  `laboratorio/app/filtro_doppioni.test.mjs` (7) e `filtro_doppioni_auto.test.mjs` (2), prima rossi.
- **Capital.com non si poteva usare per un ordine MANUALE** — risolto app v118 — 9 ottobre 2026:
  aggiunto il pulsante 💹 Capital.com fra Kraken e Storico nella barra conti; `fblContoVista`
  (`'mt5'|'kraken'|'capital'|'storico'`), `openMarketTrade` dirotta al conto Capital.com PRIMA del ramo
  MT5 (solo manuale) e `capitalOrdineManuale(side)` apre posizioni **SIMULATE** `account:'capital'` —
  **mai** un ordine vero a MT5. Test: `laboratorio/app/capital_manuale.test.mjs` (5, 4 rossi prima).
- **Di un utente Syntra si vedevano solo le notifiche nuove, non la storia** — risolto app v119 —
  9 ottobre 2026 — PASSO 15/16: `leggi_schermata` salva il punto del **nome** (`utente_xy`),
  `leggi_profilo` tocca il nome, apre il profilo e legge le operazioni, e il ramo dedicato in `ciclo`
  le **archivia** (`storico_sale.archivia_syntra`) nella cronologia della sala `Syntra · <utente>`,
  **senza** toccare la pagina Notifiche e **senza** metterle in bacheca. Lato ponte, `_manda_storico`
  chiede la lettura e aspetta (max 60 s). Test: `laboratorio/ponte/test_profilo_syntra.py` (4, prima
  rossi). *Limite noto*: la lettura richiede l'emulatore collegato e può durare fino a un minuto.
- **Le linee TP/SL della cronologia finivano tutte alla stessa candela** — risolto app v120 —
  9 ottobre 2026 — PASSI 18/19: `valuta` teneva solo il conteggio dei TP (`raggiunti`) e un unico
  `tFine`, quindi il disegno non sapeva SU QUALE candela ogni livello fosse scattato. Ora registra
  `tpT` (tempo di ogni TP) e `slT` (tempo dello stop); `fblCronoAncore` calcola `tpEnd[]`/`slEnd`;
  `fblCronoDisegna` ferma ogni linea sulla sua candela e mette la **spunta ✓ a sinistra** del punto
  in cui un TP è stato preso. Se lo stop non è preso, la sua linea prende la lunghezza dell'ultima
  di TP. Test: `laboratorio/app/cronologia_linee.test.mjs` (3, prima rossi).

- **Nell'APK il pacchetto di aggiornamento non arrivava mai** - risolto app v2.0.8 - 20 ottobre 2026:
  segnalato dal proprietario ("l'applicazione sui dispositivi mobili non riesce a ricevere il
  pacchetto di aggiornamento della versione"). Il pulsante "Aggiorna" compariva, ma il pacchetto
  non partiva: dentro l'APK la pagina gira in una WebView (Capacitor) e li' il download con
  l'attributo `download` non scarica niente (la WebView di Capacitor non mette nessun
  `DownloadListener`), quindi il file spariva senza nessun errore. Difetto minore collegato: il
  numero di build nel tag della release (`v2.0.7-131`) veniva confrontato come numero di
  versione, e il pulsante "Aggiorna" compariva anche subito dopo l'installazione. Correzione:
  nell'APK il pacchetto si apre come **navigazione** (link senza `download`), che Capacitor
  passa al browser di sistema dove il file viene scaricato davvero; il tag si annota e l'app si
  chiude solo DOPO l'installazione, non prima; il build number viene tolto prima del confronto.
  Test: `laboratorio/app/aggiornamento_apk.test.mjs` (4, prima rossi).

- **Nell'APK l'accesso con Google finiva con errore 400 e schermata bianca** - risolto app v2.0.9 -
  20 ottobre 2026: segnalato dal proprietario ("inserisco l'email, inserisco la password, poi mi
  manda all'autorizzazione da un altro dispositivo, e quando do l'autorizzazione si ricollega con la
  pagina web e mi manda sempre con errore 400 [...] mi dà tutta schermata bianca"). Causa misurata:
  il pulsante usava il POPUP di Firebase, che dentro la WebView dell'APK non ha la finestra nuova in
  cui rimandare la credenziale (Firebase risponde 400), e inoltre lasciava l'app a meta giro
  ("verifica in due passaggi" che non finiva) e, al secondo tentativo, la WebView restava sulla
  pagina di errore (schermata bianca). Correzione: nell'APK e sul telefono nel browser si usa il
  REINDIRIZZAMENTO (una normale navigazione, che torna nell'app); sul computer il popup resta, col
  reindirizzamento come ripiego se il browser lo blocca. In piu' l'app non resta piu' ferma su una
  pagina che non e' sua: al riavvio, se la WebView e' su una pagina esterna che non fa parte del
  giro di accesso, si torna alla pagina dell'app (MainActivity). Test:
  `laboratorio/app/login_google_flusso.test.mjs` (8, prima rossi).

- **L'APK proposeva l'aggiornamento anche quando era gia' all'ultima versione** - risolto app
  v2.0.10 - 20 ottobre 2026: segnalato dal proprietario ("il tasto aggiorna e' sempre presente.
  Io lo clicco, mi manda il pacchetto di aggiornamento, che e' effettivamente il 2.0.9, e' l'ultimo.
  [...] c'e' effettivamente la 2.0.9, ma l'applicazione mi dice che c'e' presente una nuova
  versione"). Causa misurata: l'APK pubblicato conteneva dentro se' uno sw.js con CACHE_NAME
  "forex-backtest-lab-v2.0.8" (copiato prima di alzare la versione e poi dimenticato). L'app
  credeva quindi di essere alla 2.0.8, la release era la 2.0.9, e il pulsante restava sempre
  li'. Correzione: il sw.js dell'APK riallineato al repository e un test che confronta i due
  numeri sul pacchetto costruito (`laboratorio/app/apk_versione.test.mjs`).
- **Il login con Google nell'APK finiva con errore 400 e schermata bianca, e sul tablet non
  finiva piu'** - risolto app v2.0.9 - 20 ottobre 2026: segnalato dal proprietario ("il login
  riesce, il problema e' che porta sempre sulla pagina di Google con l'errore 400 [...] mi da' tutta
  schermata bianca"). Due cause distinte, misurate: (1) il popup di Firebase non funziona dentro
  una WebView (non viene creata la finestra nuova in cui rimandare la credenziale: errore 400), e
  si usa quindi il reindirizzamento; (2) la credenziale che arrivava con il reindirizzamento non
  veniva letta, perche' nella WebView il fragmento cambia senza ricaricare la pagina - e l'app
  restava ferma sulla pagina di accesso (mentre l'accesso era riuscito: bastava riaprire l'app).
  Correzione: il risultato si legge sempre e si rilegge quando il fragmento arriva, e la
  bandierina scade dopo un'ora invece che dopo dieci minuti. Test:
  `laboratorio/app/login_google_esito.test.mjs` (6) e `login_google_flusso.test.mjs` (8).
- **La scala dell'interfaccia non scendeva sotto il 70%** - risolto app v2.0.10 - 20 ottobre
  2026: richiesto dal proprietario ("sul telefono il 70% dell'interfaccia e' troppo, posso
  scendere anche a 60, 50, 10, 15, 20 - e stessa cosa per la dimensione del testo. Non devi avere
  limiti"). Correzione: il tetto minimo della scala passa a 10% e anche il testo del grafico
  scende fino al 10% (prima 50%). Test: `laboratorio/app/scala_ui.test.mjs` (17).
- **La finestra separata (PIP) si mostrava come una pagina web: barra delle informazioni del sito
  con "about:blank", nessun titolo, nessuna icona, e il logo dell'app che mancava** - risolto app
  v2.0.21 - 22 ottobre 2026 (da pubblicare): segnalato dal proprietario ("in modalita' pip viene
  mostrata la barra delle informazioni del sito, con about blank, e quella deve essere tolta [...]
  deve essere una seconda schermata della STESSA applicazione, non un qualcosa collegato via web
  [...] la finestra non ha il logo come la pagina madre"). Causa misurata: la finestra veniva
  aperta con `window.open('')` su una pagina **vuota**, quindi il browser la trattava come una
  pagina web qualsiasi (e non come una finestra del programma). Correzione: si prova prima la
  **Document Picture-in-Picture nativa** (finestra senza barra del browser, senza indirizzo,
  con lo STESSO documento dentro: misurato dentro la finestra 0 script, un solo canvas e il
  motore inesistente, quindi un solo cervello e nessun doppio ordine); se l'API non c'e' si cade
  sul popup di prima, ma con l'icona dell'app nel titolo e una barra interna col logo e il nome
  "BacktestLAB FOREX EDITION". Scartata di proposito la seconda istanza dell'app (`?pipSlot=N`):
  aprirebbe un secondo collegamento a MT5/Capital.com. Test:
  `laboratorio/app/pip_finestra.test.mjs` (2).
- **Il puntatore del mouse nel grafico della finestra separata era sfasato in X e in Y** - risolto
  app v2.0.21 - 22 ottobre 2026 (da pubblicare): segnalato dal proprietario ("il puntatore e'
  sfasato di posizione sia dell'asse X che dell'asse Y: io punto il mouse sopra il grafico e la
  posizione effettiva e' spostata in alto a sinistra"). Causa misurata: con la scala UI al 130%
  il canvas era **950 px di layout contro 730 px a schermo** e il mirino cadeva 78 px a sinistra e
  55 px in alto; il mirino, da solo, era giusto (scarto -1/-1 px: arrotondamento). La causa vera
  era il **contro-zoom** della scala UI: sta sul `#chartWrap` e viaggia col nodo quando il grafico
  si sposta in un'altra finestra, dove il `body` invece non e' zoomato - il grafico si
  rimpiccioliva senza che nessuno lo misurasse (il disegno e la lettura del puntatore parlavano
  di due grafici diversi). Correzione: il contro-zoom si toglie quando il grafico cambia finestra
  e si rimette al rientro; l'invariante tenuta in test e' `clientWidth == rect.width`. Test:
  `laboratorio/app/pip_puntatore.test.mjs` (2).
- **La riga del gruppo delle posizioni non aveva la striscia di vicinanza, e per questo aveva una
  colonna in meno: tutte le colonne erano spostate a sinistra** - risolto app v2.0.21 - 22
  ottobre 2026 (da pubblicare): segnalato dal proprietario ("la linea in fondo a destra di ogni
  posizione deve essere visualizzata anche all'interno dei gruppi [...] se c'e' una posizione che
  e' piu' vicina allo stop profit mi visualizza il cartellino blu, se invece e' piu' vicina a una
  linea del tipo TP mi visualizzera' quella che e' il cartellino verde, e allo stesso tempo, se e'
  la piu' vicina a uno stop loss [...] il cartellino rosso"). Causa misurata: la riga del gruppo
  generava **14 celle invece di 15** (mancava proprio la cella della striscia), quindi non era un
  difetto di colore ma una colonna assente. Correzione: dentro il gruppo ogni singola operazione
  mostra il **proprio** cartellino, e sulla riga aggregata c'e' il cartellino della posizione
  **piu' vicina** a un livello (blu = stop a profitto, verde = take profit, rosso = stop loss),
  con nel titolo il numero della posizione dentro il gruppo ("Posizione 2 di 3: ..."); per
  scegliere la piu' vicina `fblStrisciaPosizione` restituisce adesso anche la percentuale (`perc`:
  0 = livello gia' superato, cioe' il caso piu' urgente). Test:
  `laboratorio/app/gruppi_striscia.test.mjs` (2).
- **Il margine di chiusura non sarebbe mai scattato: il metro era confrontato con se stesso** —
  risolto 2.0.21 (da pubblicare) — 22 ottobre 2026, `app.html` (punto 4 della consegna). Sintoma:
  il margine dello spread intorno alla chiusura del mercato non partiva mai. Causa misurata: la
  regola che rifiuta uno stop «troppo vicino» confrontava la distanza fermo/prezzo con la
  **forbice del cambio giornata**, e il margine E' quella forbice: confrontarli significa
  confrontare la forbice con se stessa, quindi il fermo col margine non era mai «abbastanza
  lontano». Correzione: il metro del margine è lo spread **ordinario** (`fblSpreadNormalePrezzo`),
  mentre per il pareggio esatto resta la forbice (la regola del 21 ottobre, che non si tocca).
  Test: `laboratorio/app/margine_chiusura.test.mjs` (8 casi, tempo iniettato).
- **Lo stop scritto in app prima che il conto lo avesse preso, e il giro che riprovava ogni due
  secondi** — risolto 2.0.21 (da pubblicare) — 22 ottobre 2026, `app.html` (punto 4 della consegna).
  Sintoma: se il ponte rifiutava lo spostamento dello stop, l'app mostrava comunque lo stop
  nuovo (che sul conto non c'era) e riprovava a ogni giro del polling MT5 (ogni 2 secondi).
  Causa misurata: il giro scriveva `pos.sl`/`pos.beChiusura` senza sapere il risultato della
  chiamata al ponte, e il tentativo non era tracciato da nessuna parte. Correzione: il tentativo
  si traccia **prima** (in `pos.beChiusuraTentativo`), lo stato locale si aggiorna **solo** se il
  conto ha preso lo stop, e il giro successivo aspetta **cinque minuti**. La stessa attesa mancava
  nel ramo «ritorno al pareggio esatto»: se il conto rifiutava quello, il giro riprovava due
  secondi dopo, per tutta la sessione. Test: i casi 7 e 9 di
  `laboratorio/app/margine_chiusura.test.mjs` (il ponte finto che rifiuta).
- **Il fermo col margine non era un prezzo** — risolto 2.0.21 (da pubblicare) — 22 ottobre 2026,
  `app.html` (punto 4 della consegna). Sintoma: lo stop calcolato per la SELL era
  `1,0899999999999999` (1,08500 + 0,00500 in virgola mobile) e andava al broker così com'era.
  Causa misurata: la somma del pareggio esatto e del margine non veniva arrotondata alla griglia
  del prezzo. Correzione: il fermo col margine viene arrotondato alle cifre del prezzo che dice
  il conto MT5 (come già faceva `mt5PrezzoPareggio` per il pareggio esatto). Test: il caso 3 di
  `laboratorio/app/margine_chiusura.test.mjs` (la SELL a 1,09000 esatto).

- **Le forme al grafico slittavano al cambio Time Frame** - risolto (da pubblicare) - 23 ottobre
  2026, commit `06d401b`, `app.html`. Sintoma: «cambio TF e trend, quadrati e linee slittano
  rispetto alle candele». Causa misurata: le punte dei disegni sono ancorate a un Istante reale
  (ms) che nel TF vecchio era l'apertura di una candela; al cambio TF le candele diventano bucket
  aggregati (5m/15m/1H da M1) e quell'istante non e' piu' l'apertura di nessuna candela: la punta
  slitta in mezzo alla candela (fino a quasi una larghezza intera) e l'inclinazione si riscrive.
  Correzione: `fblDisegniRiAgganciaAlTf()` riaggancia ogni punto alla candela del TF attuale piu'
  vicina (ricerca binaria su `rows`), lo stesso aggancio che il punto aveva al momento del
  disegno; la chiamano SOLO i veri cambi TF (il listener del timeframe in storico e i tre percorsi
  Live Capital/MT5/Binance con `opts.tfChangeSpanMinutes`), cosi' le risincronizzazioni periodiche
  dello stesso TF non toccano niente. Test: `laboratorio/app/disegni_cambio_tf.test.mjs` (2, con
  prova di controllo: prima della cura 10:07 NON e' apertura di una candela 5m).
- **Lo zoom si sincronizzava tra macchine** - risolto (da pubblicare) - 23 ottobre 2026, commit
  `a844e4c`, `app.html`. Sintoma: aprendo l'app su un'altra macchina arrivava lo zoom di quella
  prima, e alla sincronizzazione successiva scappava pure lo zoom scelto qui. Causa misurata:
  lo zoom (priceZoomFactor, viewPriceLo/Hi) viaggiava nel pacchetto di sessione
  (`collectLightSessionState`) destinato ANCHE al cloud, e `assetChartViews` portava pure lo zoom
  orizzontale e l'autogamma. Correzione: lo zoom di QUESTA macchina vive in un localStorage
  separato (`fbl_zoom_dispositivo`, aggiornato ad ogni salvataggio) e non entra piu' nel
  pacchetto; `trimTradesForCloudBudget` (unico punto di passaggio delle scritture cloud: report
  intero e keepalive) lo separa clonando senza toccare la memoria locale; chi applica uno stato
  remoto legge lo zoom solo dal file del proprio dispositivo, con semina una tantum dal pacchetto
  vecchio per non perdere lo zoom al primo avvio dopo l'aggiornamento. Le ancore di posizione
  (masterTime/viewEnd) viaggiano come prima. Test: `laboratorio/app/zoom_dispositivo.test.mjs`
  (3: pacchetto pulito, memoria intatta, pacchetto vecchio ignorato).
- **Le etichette TP/SL sovrapposte si impilavano** - risolto (da pubblicare) - 23 ottobre
  2026, commit `e231310`, `app.html`. Sintoma: nel gruppo di un segnale (stessa sala, N
  posizioni con entrata/stop/target identici) le N caselle TP/SL coincidono e le N etichette si
  scrivono una sopra l'altra: TP1/TP2/TP3 impilati e non si leggono. Causa: la casella si
  disegna per OGNI posizione (`drawTpSlZoneBox` una chiamata ciascuna) e un'etichetta non sa di
  avere sorelle gemelle sotto. Correzione: a ogni draw una mappa dei gruppi con la chiave della
  casella INTERA (asset, punto d'apertura, livelli, span risolto); le caselle gemelle si
  disegnano una volta sola, dalla prima posizione del gruppo, con un'unica etichetta (numero di
  posizioni, origine comune, accumulo della perdita sugli SL); durante il trascinamento di un
  livello il raggruppamento si stacca. Test: `laboratorio/app/etichette_raggruppate.test.mjs`
  (3).
- **Il gruppo delle etichette non s'esplodeva, e il tocco sull'etichetta non selezionava** -
  risolto (da pubblicare) - 23 ottobre 2026, `app.html`. Sintomi (tre richieste in un capitolo):
  «un pulsante che ci esplode tutte le etichette», «selezionare una posizione anche toccando
  l'etichetta tp-sl-stop profit», e il popup del Collegamento/Modalità intitolato
  «Impostazioni generali» invece di «Impostazioni di sistema». Causa misurata col banco dei
  PointerEvent sintetici: (a) il raggruppamento era una strada sola, senza invertitore;
  (b) la casella LARGA apre le statistiche e DESELEZIONA pure, perché è nella lista dei
  «vuoti» di `fblClickSuVuoto` (richiesta vecchia del proprietario: un rettangolo largo mezzo
  grafico non deve trattenere la selezione), quindi ogni selezione scritta al pointerup della
  casella veniva rispazzata nello stesso gesto; (c) la pillola dell'etichetta sta sulla STESSA
  altezza della linea TP/SL, e il controllo dei livelli la mangiava, selezionando la posizione
  senza aprire le statistiche. Correzioni: invertitore `#explodeTpSlEtichetteBtn` accanto a
  «Mostra/nascondi etichette» (scelta in localStorage `fbl_etichette_esplose`; con l'esplosione
  la mappa dei gruppi non si costruisce e ogni casella si disegna sua); hit-rect propri delle
  etichette (`tpSlPillHitRects`, riempito da `drawZonePill` che ora restituisce il rettangolo
  VERO dopo lo spostamento anti-sovrapposizione), candidato che al pointerdown si scrive PRIMA
  del hit dei livelli (la linea, sulla stessa y, lo mangerebbe) e al pointerup, se il gesto è
  fermo, SELEZIONA la posizione e apre le statistiche; in `fblClickSuVuoto` l'etichetta non è
  più «vuoto» (trattiene la selezione), la casella larga resta «vuoto» com'era voluto allora;
  titolo del popup rinominato in tutte le 8 occorrenze. Test: `etichette_esplodi_tocco.test.mjs`
  (3: scompatta/ricompone, tocco sull'etichetta del gruppo seleziona il rappresentante e apre
  le statistiche, tocco su TP2 scompattata seleziona p2) e `impostazioni_sistema.test.mjs` (2).


- **Credenziali MT5/Capital.com che spariscono su mobile** - risolto (da pubblicare) - 25
  ottobre 2026, commit `7f1d9a3`, `app.html`. Sintomo: su telefono/tablet il pulsante
  «Scegli» (cartella credenziali) non faceva nulla, le credenziali si perdevano a ogni
  riavvio/aggiornamento, e «Aggiungi nuovo conto» non apriva il popup. Causa misurata:
  `supportsFS=false` nel WebView Capacitor, quindi `getMt5CredsDirHandle()` tornava `null` e
  il salvataggio era gated da `if(supportsFS)`. Correzione: archivio IndexedDB interno
  (`FxbtCredsDB`) con handle virtuale (`getFileHandle`/`createWritable`), salvataggio
  abilitato su mobile, gate del bridge saltato con pulsante «Inserisci credenziali (salva
  nell'app)». Test: pacchetti_mobile (verdi), collaudo Falliti 0.
- **Pulsante «Aggiorna» che resta acceso su mobile** - risolto (da pubblicare) - 25 ottobre
  2026, commit `7f1d9a3`. Causa: `fblVersioneInstallata()` restituiva '' (caches vuote,
  fetch sw.js fallito nel bundle), quindi il confronto cadeva sul tag visto (vecchio) e il
  pulsante non si spegneva mai. Correzione: fallback `FBL_VERSIONE_BUNDLE` iniettato da
  `aggiorna_www.bat`, e ramo di spegnimento indipendente da `installata`.
- **Icone accanto ai testi diventate lettere strane nell'APK** - risolto (da pubblicare) - 25
  ottobre 2026, `aggiorna_www.bat`, `strumenti/inietta_versione.py`. Sintomo segnalato dal
  proprietario: «tutte le icone nei testi adesso mi dà tutti simboli di lettere strane».
  Misurato sull'`app.html` DENTRO l'APK v2.0.27: 800 "ðŸ", 1965 "â€", 4852 "Ã", ZERO emoji
  vere; lo stesso file sul Desktop era sano. Causa: l'iniezione della versione usava
  `(Get-Content app.html -Raw) | Set-Content -Encoding UTF8`; in Windows PowerShell 5.1
  `Get-Content` senza `-Encoding` legge i byte come ANSI (Windows-1252) e risalva il testo
  rovinato, con BOM. Correzione: iniezione fatta da uno script Python con UTF-8 esplicito,
  `newline=''` (CRLF intatti) e nessun BOM. Test: `iniezione_versione.test.mjs` (2), che
  esegue lo strumento su un file con emoji e controlla i byte in uscita.
- **Posizioni che si spostano a mercato chiuso** - risolto (da pubblicare) - 25 ottobre 2026,
  `app.html`. Sintomo: nel fine settimana le caselle Target/Stop "avanzavano" nel grafico
  mentre disegni e rettangoli restavano fermi. Causa misurata: il bordo destro della casella
  seguiva `idx` a ogni fotogramma (`keepPaceIdx:idx+replayFrazioneBarra()`), e a mercato chiuso
  `idx`/`viewEnd` avanzavano lo stesso per tre strade: rollover del refresh live, watchdog dei
  15s che ricaricava lo storico, guardiano candele MT5. Correzione: guardia
  `fblMercatoFermoOra` in tutte e tre, e `keepPaceIdx` fermo su `originBox` a mercato chiuso.
  Test: `mercato_chiuso.test.mjs` (7, di cui 2 nuovi che misurano il disegno vero e il
  ricaricamento dello storico).

  25 ottobre 2026, commit `98e7937`, `app.html`. Sintomo: in live replay con MT5 collegato,
  BUY/SELL non creavano nulla (il guard di placeRealMt5Order bloccava tutto) oppure, se MT5
  era scollegato, creavano posizioni simulate che finivano nelle statistiche del conto live.
  Correzione: il ramo reale viene saltato in replay (posizione simulata con mt5Ticket=null e
  flag historical:true, mode backtest in chiusura, equity invariata, nessuna chiamata al
  bridge, chiusura posizioni reali bloccata). Test: replay_storico.test.mjs (2).

- **Il tasto "Aggiorna" restava sulla pagina principale anche dopo l'aggiornamento** - risolto 2.0.30 - 26 ottobre 2026, segnalato con «rimane il tasto aggiorna in alto a destra della pagina, mentre dentro impostazioni di versione il tasto aggiorna non c'è, rimane in memoria e non va via il pulsante sulla pagina principale». Causa: nel ramo "pacchetto aperto nel browser esterno" di fblApplicaAggiornamento() il pulsante veniva RIATTIVATO invece di spento, e il tag non veniva annotato. Ora su computer il pulsante si spegne e il tag si annota; nell'APK il comportamento è INVARIATO (protetto da aggiornamento_apk.test.mjs: il pacchetto si apre nel browser e l'utente deve ancora installarlo a mano, quindi il pulsante deve restare). In più, su computer l'app non si chiude più da sola dopo il download: chiudere l'applicazione alle spalle dell'utente era fastidioso e non si capiva che il pacchetto era già in Download.
- **Il menù della strategia di sala stava a destra, tagliato dal bordo, e non si vedeva a tutto schermo** - risolto 2.0.30 - 26 ottobre 2026, segnalato con «quei pop-up delle strategie vengono messi tutti alla destra, invece no, deve stare al centro pagina ... in modalità a tutto schermo ... non viene visualizzata». Causa: tgAutoPosizionaPop() ancorava il menù al pulsante premuto, e lo z-index era 96 (troppo basso per stare sopra al grafico a tutto schermo). Ora il menù è centrato orizzontalmente, z-index 100000, e in testa porta il nome della sala, così si riconosce quale strategia si sta modificando.

- **In replay i segnali aprivano posizioni VERE sul conto MT5** - risolto 2.0.31 - 26 ottobre 2026, segnalato con «in modalità replay le posizioni non vengono aperte nell'account storico, ma vengono aperte sull'account MT5. Devi assolutamente correggere, non va bene. Non possono essere aperte nell'account MT5». Causa: tgEseguiSegnale() decideva se aprire ordini veri con `const reale=!!mt5Connected;` — la sessione replay non entrava nel calcolo, quindi con MT5 collegato gli ordini dei segnali partivano veri (placeRealMt5Order / placeRealMt5PendingOrder) anche mentre si rivede il passato. Ora `reale` è vero solo in sessione Live, con MT5 collegato e FUORI dal replay. Aggiunta anche la guardia del replay a tutte le altre funzioni che parlano col bridge (closeMt5PositionReal, closeMt5TicketFromTable, modifyMt5TicketFromTable, fblMt5SpostaStop, applyBreakevenToMt5TicketDirect): il proprietario ha detto "assolutamente", quindi è impossibile toccare il conto reale in replay per qualsiasi strada. Test: laboratorio/app/replay_segnali_conto_storico.test.mjs (3 prove).
- **L'ordine limite scelto dall'utente apriva comunque a mercato** - risolto 2.0.31 - 26 ottobre 2026, segnalato con «con il pulsante dell'ordine limite premuto ce le apre comunque a prezzo del mercato e non ce la posiziona come un ordine limite selezionando il prezzo per l'ordine pendente». Causa: in tgPiano() il prezzo scelto dall'utente veniva messo subito in `entry`, e il confronto che decide "pendente o mercato" era `opz.prezzo!==entry` — il prezzo confrontato con SE STESSO, sempre falso, quindi sempre a mercato (e anche il tipo limite/stop si deduceva da un confronto sbagliato). Ora il prezzo di mercato è salvato da parte (prezzoMercato) e i confronti usano quello.
