# Registro dei bug

Formato: **titolo** — stato — dove — causa vera — test che lo controlla.

## Aperti / limiti noti
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
