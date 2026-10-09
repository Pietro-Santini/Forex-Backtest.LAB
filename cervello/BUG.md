# Registro dei bug

Formato: **titolo** — stato — dove — causa vera — test che lo controlla.

## Aperti / limiti noti
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
