- 2026-11-07 - OpenCode - **v2.1.6: la riga degli orologi ora si legge.**
  SEGNALATO dal proprietario: «orologio non c'e'». Il campo C'ERA (l'avevo aggiunto per sapere
  quale orologio decide la chiusura del mercato), ma il rendering lo stampava come
  "orologio: [object Object]" - una riga che non si legge e non si copia, cioe' inutile.
  Senza quei numeri non si puo' curare la chiusura decisa sull'orologio sbagliato (MT5 va
  avanti anche di un'ora rispetto al dispositivo, come e' gia' scritto nel cervello del
  progetto).
  CURA: il valore si rende leggibile - ogni oggetto si apre in coppie chiave=valore. La riga
  esce come:
    orologio             : {dispositivo=..., mt5=..., scartoMinuti=0, fase=closed, fermo=true, ultimaCandela=...}
  Test: misura_orologio_leggibile.test.mjs (rosso-senza/verde-con provati).
  Collaudo: prove verdi sui file toccati, ponte 302 verdi.

- 2026-11-07 - OpenCode - **v2.1.5: a mercato chiuso l'asse si ferma, e questa e' un'applicazione.**
  **1) L'ASSE SI ALLUNGAVA OLTRE LA CHIUSURA.** Dallo screenshot del proprietario: XAU/USD 1m con
  l'asse da "nov 22:29" a "07 nov '26 23:59" - di SABATO, mercato chiuso dal venerdi' sera.
  CAUSA MISURATA: lo spazio vuoto dopo l'ultima candela (liveMargin) si metteva guardando UNA
  sola autorita', fblMercatoFermoOra(), che risponde "non fermo" quando MT5 dice che il mercato
  e' aperto - e la sua risposta puo' essere vecchia di dieci minuti. Basta quel minuto per far
  ripartire l'asse. CURA: il margine esiste solo a mercato aperto, e la chiusura si decide su DUE
  autorita' (calendario dello strumento E fase della sessione, che non dipende da quella cache).
  Test: asse_si_ferma_alla_chiusura.test.mjs (2 prove, rosso-senza/verde-con).
  **2) F5, CTRL+R E CTRL+SHIFT+R NON FANNO PIU' NIENTE.** RICHIESTO: «questa e' un'applicazione
  e deve essere del tutto sganciata da un sito web o da Chrome... questi pulsanti non devono
  esserci e non devono fare nulla». Ricaricare mentre si guarda una posizione aperta butta lo
  stato in memoria, mentre l'app ha gia' il SUO modo di aggiornarsi: il pulsante Aggiorna.
  Dove si scrive (caselle di testo) i tasti restano liberi. Test: applicazione_non_sito.test.mjs
  (3 prove con la TASTIERA VERA: il primo tentativo con eventi sintetici non misurava niente,
  provato - restava verde nei due versi).
  **3) IL DISEGNO DELLE ZONE ZERO-PRINT.** Object.keys() sulle righe di footprint alloca un array
  con tutti i livelli di prezzo della candela, 2000 candele a fotogramma: 200.000 array buttati
  via per sapere se il primo esiste. Ora un giro che si ferma al primo risultato. (Misurato dal
  proprietario: 183 ms sui 238 di disegno con 50000 candele.)
  Collaudo: prove verdi sui file toccati, ponte 302 verdi.

- 2026-11-07 - OpenCode - **v2.1.4: due cure, una trovata dal proprietario guardando la duplicata.**
  **VERIFICATA LA CURA DEI CRASH.** Lo stesso pannello del proprietario, con MT5 collegato:
  `lettura posizioni: 318 volte, media 24 ms, peggiore 354 ms` - ZERO non riuscite (prima 1132
  su 1135, media 609 ms, picco 30 s). E il pannello servizi dice «Ordini (questo computer)
  risponde in 13 ms». La strada locale senza indagini tiene.
  **1) IL GRAFICO NON SI SVUOTA PIU' SCORRENDO NEL WEEKEND.** SEGNALATO dal proprietario nella
  finestra duplicata: «clicco sul grafico e mi spariscono candele e indicatori; devo premere
  torna all'ultima candela». CAUSA MISURATA: a mercato chiuso getVisibleData() taglia le
  candele dopo la chiusura; con la vista TUTTA dopo la chiusura il punto di taglio e' ZERO e
  `slice(0,0)` e' un array vuoto - grafico bianco. CURA: se il taglio non lascia niente non si
  taglia. Chi guarda il passato guarda il passato; le candele FABBRICATE dopo la chiusura
  continuano a non vedersi (provato). Test: grafico_mai_vuoto.test.mjs (2 prove).
  **2) STESSA CURA PER LA STRADA DEL GRAFICO.** Dal pannello: «Ordini (questo computer) 13 ms»
  ma «Grafico (computer, in diretta) 157 ms» - stessa pagina, stessa macchina, due strade. Le
  candele uscivano su Tailscale per tornare a casa. Ora dal ponte locale anche il servizio dati
  (porta 8001) sta in locale, scelto senza indagini.
  Collaudo: 36 prove verdi sui file toccati, ponte 302 verdi.

- 2026-11-07 - OpenCode - **v2.1.3: trovata con la MISURA la causa dei «crasha da un momento
  all'altro».** Dal pannello prestazioni del proprietario, nero su bianco:
    lettura posizioni: 1135 volte, media 609 ms, peggiore 30000 ms, 1132 NON RIUSCITE
    ordine (altro):    1135 volte, media 609 ms, peggiore 40877 ms, 1131 non riuscite
    lettura conto:       53 volte, peggiore 13892 ms, 50 non riuscite
  e sulla stessa pagina: «da questa pagina: http://127.0.0.1:8000».
  Gli ordini giravano dal SERVER (/pc/8000) mentre la pagina la serviva il ponte DI QUESTO
  computer: 99,7% delle letture perse, ognuna con la sua attesa fino a 30 s, e la pagina che
  passava il suo tempo ad aspettare risposte che non arrivavano.
  CURA 1: se l'indirizzo della pagina e' il computer stesso, la strada degli ordini e' LOCALE,
  scelta senza chiedere niente a nessuno (fblPaginaDalPonteLocale). Non e' un'ipotesi: chi
  serve la pagina ha anche le rotte degli ordini. Prima si sceglieva con una prova che puo'
  fallire (ponte occupato, scadenza a 2,5 s) e si ricontrollava solo ogni 30 s.
  CURA 2: dopo tre letture fallite di fila il polling si allenta (1s -> 2s -> 4s, max 10s) e al
  primo successo torna a 1s. Una strada morta non si martella.
  Test: laboratorio/app/strada_ordini_locale.test.mjs (3 prove, rosso-senza/verde-con).
  Collaudo: 302 prove del ponte verdi (erano 237), app browser verde.

- 2026-11-07 - OpenCode - **v2.1.2: tre cure, tutte misurate, ai problemi che facevano crashare l'app.**
  **1) REGRESSIONE MIA RITIRATA (v2.1.0).** Congelavo `end` in getViewWindow() SEMPRE a mercato
  chiuso: di sabato il grafico non si spostava piu' in orizzontale (segnalato: «mi si sposta solo
  in verticale»). Riportato indietro e rifatto bene: il congelamento vale SOLO in auto-segui
  (`followLatest`), mai durante pan/zoom. Test: laboratorio/app/congelamento_solo_autosegui.test.mjs
  (5 prove, provate nei due versi: con la cura rotta una sola resta verde, spenta del tutto due).
  **2) IL PULSANTE AGGIORNA NON COMPARIVA.** MISURATO sul PC: il ponte serviva
  `app_aggiornata\app.html` della v2.1.1 mentre gli .exe erano vecchi, e fblVersioneInstallata()
  legge la versione dalla CACHE DEL SERVICE WORKER, cioe' da quella copia web: rispondeva 2.1.1,
  il confronto col tag diceva «pari», pulsante spento. L'app sembrava aggiornata senza esserlo.
  CURA: a decidere e' la versione dell'ESEGUIBILE (fblVersioneProgrammaInstallato, la legge il
  ponte dal registro); la copia web resta il ripiego. Test: versione_programma_non_web.test.mjs
  (3 prove, rosso-senza/verde-con).
  **3) desktop_shell.py: il patch dello zoom era codice morto.** Leggeva `on_webview_ready` e
  scriveva `on_web_view_ready` (due attributi diversi): non agganciava niente. Corretto.
  In piu' la ricerca della riapertura di mercato si tiene in memoria per minuto (era fino a
  5760 giri con Intl per chiamata, nel percorso caldo). Test: chiusura_mercato_costo.test.mjs.
  Collaudo: verde.

- 2026-11-07 - OpenCode - **v2.1.1: la finestra duplicata apre col conto della madre, non con lo Storico CSV.** Voce 4/5 di cervello/RICHIESTE-DUPLICA-FINESTRA.md. CAUSA MISURATA: initExtraPipWindow() parte sempre in Storico (liveModeActive=false, csvLibrary vuoto) e il gestore di pip_clone_snapshot applicava solo stili/asset/warm-start MT5 senza mai passare in Live. Con la madre in Live MT5 la duplicata restava in Storico con elenco asset vuoto. CURA: nel gestore, se la madre e in Live (storico:false) e la finestra PIP no, switchAccountMode(true) prima del resto. Test: laboratorio/app/pip_conto_madre.test.mjs (rosso senza, verde con). Collaudo da verificare.

- 2026-11-07 - OpenCode - **v2.1.0: disegni e indicatori si fermano a mercato chiuso.** Dopo v2.0.99 le candele si fermavano ma la finestra temporale (start/dataStart) avanzava ancora con viewEnd, quindi i disegni e gli indicatori scivolavano. CURA: in getViewWindow() il congelamento (end = min(end, ultima candela aperta)) viene applicato PRIMA di calcolare start/dataStart/dataEnd, cosi la vista orizzontale resta ferma. Congelamento solo a mercato chiuso, solo in Live (non replay), mai per le crypto. Usa solo liveSessionPhaseAt per non costruire il calendario dello strumento a ogni passo. Collaudo: verde.

# Diario dei giri di agenti

Formato: data — chi — cosa — esito collaudo — commit.

- 2026-11-07 — OpenCode — **v2.0.99: a mercato chiuso l'asse temporale si ferma.** Difetto segnalato dal proprietario: il tempo continuava a scorrere oltre l'ultimo orario di scrittura (XAUUSD chiude alle 22, ma l'asse mostrava orari oltre) e con esso si spostavano tutti i disegni e gli indicatori. CAUSA MISURATA: in draw() c'erano DUE strade che leggevano i dati del grafico — getVisibleData() applicava il taglio mercato-chiuso (cura del 1 novembre), ma draw() usava rows.slice(dataStart,dataEnd+1) SENZA taglio, quindi disegnava anche le candele oltre la chiusura. In piu' il blocco 'il tempo e' infinito' proseguiva l'asse oltre l'ultima candela reale in Live senza guardare se il mercato era chiuso. CURA: rimosso il blocco 'il tempo e' infinito' e taglio delle candele oltre la chiusura in draw(). Collaudo: verde.

- 2026-11-06 — Claude — **v2.0.98: il log aveva 91 MB, l'88% era il nostro polling, e dentro
  c'era la chiave in chiaro 250.000 volte**.
  1. **MISURATO, e la misura mi ha smentito.** Avevo detto al proprietario che il log era gonfiato
     da «una cosa che bussa su /v1/models e non e' nostra». Contate le righe:
     `/positions` ~295.000, `/orders` ~286.000, `/account` ~279.000, `/health` ~29.000,
     `/account_history` ~17.000 — l'**88%** di 1.023.510 righe era il **nostro** polling riuscito
     (l'app interroga MT5 tre volte al secondo, e uvicorn scrive una riga per chiamata).
     `/v1/models` era l'**1%**. Zittire il disturbo esterno non avrebbe risolto niente: e' il
     motivo per cui qui si conta prima di curare, e stavolta l'ho pagato io.
  2. **LA COSA PIU' SERIA NON ERA LO SPAZIO.** In circa **250.000** righe compariva
     `?chiave=...` in chiaro: la chiave condivisa del ponte, scritta su disco centinaia di
     migliaia di volte. Un log non e' il posto di una chiave.
  3. **LA CURA STA ALL'ULTIMO CANCELLO**, la scrittura del file (`_LogConTetto`), e non nei logger
     di uvicorn: uvicorn riconfigura il logging da se' quando parte, e un filtro messo sui suoi
     logger potrebbe venire spazzato via senza che nessuno se ne accorga. Tre regole: la chiave
     diventa `chiave=***` sempre; il polling **riuscito** (2xx/304 su quelle rotte) non si scrive,
     ma **gli errori si'** — 4xx e 5xx sono esattamente cio' che si cerca quando qualcosa si
     rompe; oltre 5 MB il file ruota tenendo una copia `.1`, quindi al massimo ~10 MB in tutto.
     Le righe si decidono **intere**: uvicorn scrive il messaggio e il terminatore in due volte, e
     decidere su un pezzo vorrebbe dire scartare mezza riga.
  4. **DUE ERRORI MIEI NEL CONTROLLO, scritti qui perche' sono istruttivi.** Per provare la cura
     nel verso opposto ho spento le regole, e la prima volta ho manomesso il file con una
     sostituzione che ha preso piu' del previsto: una prova che doveva restare verde e' diventata
     rossa e una che doveva diventare rossa e' rimasta verde. **Un esito cosi' non dimostra
     niente**, e l'ho rifatto. Al secondo giro ho spento la regola della chiave con
     un'espressione **senza gruppo di cattura**: `sub(r"***", ...)` con un gruppo che non
     esiste solleva, l'eccezione e' finita nel `try/except` che protegge il servizio, e il file
     risultava vuoto — sembrava un difetto della cura, era il banco. Rifatto con
     `(?!x)(x)`: spenta la regola la chiave finisce nel file, accesa no. Idem per il rumore.
     Il `try/except` largo resta giusto (un log non deve mai far cadere il servizio) ma nasconde
     gli errori di programmazione: le prove sono l'unica rete, ed e' per questo che
     `test_la_chiave_non_finisce_nel_file` controlla anche che ci sia `chiave=***` e non solo che
     il segreto manchi.
  5. **Una curiosita' utile:** quelle 11.008 chiamate a `/v1/models` sono qualcosa sul computer
     del proprietario che cerca un'API in stile OpenAI sulla porta 8000. Rispondiamo 404 e non
     cambia niente, ma da ora non riempie piu' il log.
  **Collaudo:** ponte **237 verdi** (230 + 7 nuove in `test_log_con_tetto.py`), provate nei due
  versi una regola per volta. **Serve reinstallare il Setup**: e' cambiato `bridge.py`.
  **Commit:** uno, versione 2.0.98.

- 2026-11-06 — Claude — **v2.0.97: l'app era inutilizzabile perché UNA variabile rispondeva a DUE
  domande. Il login Google nell'app desktop torna sul popup, e il ponte smette di spegnersi da
  solo**.
  1. **IL SINTOMO, con le sue parole.** «Mi sono sloggato dall'account e poi è nato tutto quanto il
     problema. Inizialmente dava detail not found… adesso ci siamo piantati e non mi funziona più
     bene l'applicazione ed è inutilizzabile.» E poi il dettaglio che ha chiuso il caso: «la pagina
     pop-up tramite web view non è supportata, va in conflitto, quindi dopo succede il crash… mi
     dice accesso non riuscito con Google, premi rieffettua il login per riprovare, ma mi dà sempre
     lo stesso errore».
  2. **LA CAUSA, misurata nel SUO log e nella storia di git, non supposta.** In `login.html` una
     sola variabile (`isCapacitor`) decideva due cose diverse:
     **(1)** dove si va dopo il login riuscito; **(2)** quale flusso di Google si usa.
     Fino alla v2.0.95 era solo il controllo di Capacitor, quindi nell'app desktop era `false` e si
     usava il **popup**. La v2.0.96 l'ha allargata a `window.pywebview` e `?from=app` per sistemare
     la (1) — giusto — e ha cambiato **di nascosto** anche la (2): nell'app desktop ha iniziato a
     partire `signInWithRedirect`.
     Nel suo `ForexBacktestLAB.log` c'è tutta la catena, in tre righe consecutive:
     ```
     GET /login.html?from=app 200
     [Ponte] La pagina e' andata via: spengo fra 90 secondi, a meno che non torni qualcuno.
     POST /disconnect?grazia=1 200
     ```
     cioè: il reindirizzamento porta la finestra **fuori** dall'app (su `accounts.google.com`), il
     ponte vede la pagina andarsene, **comincia a spegnersi e stacca MT5**. Quello è il «crash»:
     non un errore di Python — i `ConnectionResetError` nel log sono rumore di asyncio di quando la
     finestra se ne va a metà richiesta, cioè un **sintomo** del redirect, non la causa.
     E non poteva nemmeno riuscire: **Google rifiuta l'OAuth dentro una webview incorporata**
     (`disallowed_useragent`). Al ritorno `getRedirectResult()` è vuoto e, con lo stato del giro
     salvato (`loginGoogleInCorso`), si finisce esattamente alla riga 309 di `login.html`, quella
     che stampa il messaggio che lui legge. Ripremi e rifà lo stesso giro: per sempre.
  3. **PERCHÉ IL POPUP È LA STRADA GIUSTA NELL'APP DESKTOP, e l'ho verificato invece di crederci.**
     `desktop/desktop_shell.py` installa `on_new_window_request -> set_Handled(False)`: WebView2
     apre il popup di Google come finestra **vera**, fuori dalla webview. Misurato sulla pywebview
     installata: `on_new_window_request` **esiste** (quindi quel patch va a posto davvero).
  4. **LA CURA: due domande, due variabili.**
     `eApk` = solo l'APK Capacitor → decide il **flusso** (lì il popup non esiste).
     `dentroLApp` = APK **oppure** app desktop → decide **solo** la destinazione (resta la cura
     buona della v2.0.96, che il ri-login torni in `app.html`).
     E `usaRedirect = eApk || (tocchiGrossi() && !dentroLApp)`: il tocco decide solo nel
     **browser**, perché il problema del reindirizzamento non è il dito, è la webview. Inoltre,
     nell'app desktop il ripiego del popup bloccato **non** è più il reindirizzamento (romperebbe
     l'app): si dice all'utente cosa fare.
  5. **PERCHÉ TUTTE LE PROVE DICEVANO «VERDE», ed è la lezione da tenere.** I banchi
     (`login_google_flusso`, `login_google_nativo`) **iniettano `isCapacitor` come parametro**:
     eseguono il blocco vero del pulsante Google, ma **non** la riga che lo calcola. La riga
     cambiata era proprio quella, quindi era invisibile a ogni prova. E al banco mancava del tutto
     la dimensione «**app desktop**»: fingeva solo APK e browser.
     Aggiunte 4 prove in `login_google_flusso.test.mjs`: nell'app desktop si usa il popup; con lo
     schermo a tocco **comunque** il popup (la trappola fine: `tocchiGrossi()` da solo manderebbe
     al redirect anche dentro l'app); col popup bloccato **non** si ripiega sul redirect e non si
     lascia appeso lo stato del giro; e la **prova di controllo** che nell'APK il reindirizzamento
     resta — senza di lei, una cura che spegne il redirect *ovunque* passerebbe e romperebbe il
     telefono. Provate rosse con il comportamento della v2.0.96 e verdi con la cura.
  6. **DUE DIFETTI MINORI TROVATI PER STRADA, curati nella stessa uscita.**
     a. **Le pagine linkate non erano nel pacchetto.** `app.html` linka `termini.html` e
        `rischi-finanziari.html`, `login.html` linka `index.html`: dentro il programma rispondevano
        **404**, e nel suo log si vede `GET /privacy.html 404`. Il ponte ha una StaticFiles
        generica su `_BASE_DIR`, quindi il 404 non era una rotta mancante: **i file non c'erano**,
        perché `build_exe.bat` ne copiava e impacchettava solo una manciata scelta a mano.
        Aggiunte al pacchetto (copia + `--add-data`): `index.html`, `privacy.html`, `termini.html`,
        `rischi-finanziari.html`, `informativa-bot.html`. Nota: `index.html` mancante **è** il
        «detail not found» da cui tutta questa storia è partita.
     b. **La rotta `/login.html` era dichiarata due volte**, identica parola per parola (la stessa
        toppa applicata due volte fra la v2.0.95 e la v2.0.96). FastAPI usa la prima, quindi la
        seconda era codice morto: rimossa.
  7. **UN DIFETTO TROVATO E NON CURATO, di proposito.** In `desktop_shell.py`:
     ```python
     _orig = ec.EdgeChrome.on_webview_ready      # legge  on_webview_ready
     ec.EdgeChrome.on_web_view_ready = _patched  # scrive on_web_view_ready
     ```
     legge un nome e ne scrive un altro. Misurato: `on_webview_ready` esiste, `on_web_view_ready`
     no — quindi quel patch (tasti acceleratori e zoom da tastiera) è **codice morto da sempre**.
     Non l'ho sistemato qui: ripararlo **accenderebbe** un comportamento che è stato assente per
     settimane (F12, Ctrl+R dentro l'app), e non è quello che è stato chiesto. Va fatto da sé,
     quando lo si vuole davvero.
  8. **Da dire al proprietario:** `installer_build/build/bridge.py` è cambiato, quindi **serve
     reinstallare il Setup**: il tasto «Aggiorna» aggiorna solo le pagine. In più il suo
     `ForexBacktestLAB.log` è arrivato a **91 MB** e cresce senza limite (10.954 righe sono una
     sola cosa che bussa su `/v1/models` e non è nostra): va messo un tetto, in un'uscita a sé.
  **Collaudo:** login **55 prove su 55 verdi** (sei file), ponte **230 verdi**, `node --check` su
  tutti e 5 gli script di `app.html`. Il giro intero del browser era in corso al momento del push:
  la cura è stata pubblicata subito perché l'app era inutilizzabile, e la parte toccata è coperta
  dalle 55 prove qui sopra. **Commit:** uno, versione 2.0.97.

- 2026-11-06 — OpenCode — **v2.0.96: il ri-login torna dentro l'app**. Difetto misurato: dopo il logout `location.replace('login.html')` portava a una pagina 404 perché il ponte serviva solo `/` e `/sw.js`. Cura v2.0.95 ha aggiunto la rotta `/login.html` (FileResponse) e percorsi_liberi. Ma `login.html` calcolava `isCapacitor` solo sul Capacitor: nell'app desktop (`window.pywebview`) era false, quindi dopo il login andava a `index.html?dopo=login` invece che a `app.html`. Cura: `isCapacitor` ora include anche `!!window.pywebview` e il marcatore `?from=app` nel redirect dell'app, così DESTINATION='app.html'. In più, `login.html` aggiunto a `_FILE_AGGIORNABILI` (bridge.py) così il ponte lo scarica/aggiorna da solo insieme ad app.html e sw.js. Collaudo: verde.

- 2026-11-06 — OpenCode — **v2.0.96: login.html riconosce l'app desktop (pywebview)**. Difetto
  misurato: dopo il logout `window.location.replace('login.html')` portava a una pagina 404 perché il
  ponte serviva solo `/` e `/sw.js`. Cura v2.0.95 ha aggiunto la rotta `/login.html` (FileResponse)
  e `percorsi_liberi` in accesso_condiviso. Ma login.html, all'avvio, calcolava `isCapacitor` solo
  sul Capacitor: nell'app desktop (`window.pywebview`) era `false` e dopo il login andava a
  `index.html?dopo=login` invece che a `app.html`. Cura: `isCapacitor` ora include anche
  `!!window.pywebview`, così DESTINATION='app.html' e il login torna dentro l'app. In più,
  `login.html` aggiunto a `_FILE_AGGIORNABILI` (bridge.py) così il ponte lo scarica/aggiorna da
  solo insieme ad app.html e sw.js. Collaudo: verde.

- 2026-11-06 — OpenCode — **v2.0.95: il ponte serve anche login.html**. Difetto misurato: app.html fa `location.replace('login.html')` quando l'utente non e' autenticato o esce, ma il ponte serviva SOLO '/' (app.html) e '/sw.js': `/login.html` rispondeva 404 ('detail not found') e l'utente restava chiuso fuori. Cura: rotta `@app.get("/login.html")` in bridge.py (FileResponse da _BASE_DIR, no-cache) + `percorsi_liberi=("/login.html",)` in installa_controllo_chiave (pagina pubblica, senza chiave) + `--add-data "build\login.html;."` in build_exe.bat. Prova rosso/verde: `test_login_html_servito.py`. Richiede il Setup nuovo (bridge.py fuori app.html). Collaudo: verde.

- 2026-11-06 — OpenCode — **v2.0.94: /dati sul PC tornava 401 sempre → dati su E: mai scritti**.
  Difetto misurato: `documenti_utente.py` verifica il token Firebase con `google.oauth2.id_token`
  e, se l'import manca, `_FB_AUTH_OK=False` e risponde 401 a QUALUNQUE login. `google-auth`
  era nel Dockerfile del **server** ma NON nel `requirements.txt` del **ponte locale** (PC) né
  congelata nell'exe (build_exe.bat). Quindi il ponte installato rifiutava ogni token, `/dati`
  non scriveva mai e `E:\Forex Backtest Lab\dati` (cartella sì, DB no) restava vuota, con i dati
  che andavano solo su Firestore. Cura: `google-auth` nel requirements del ponte +
  `--collect-all google-auth` in build_exe.bat. Prove: rosso/verde
  `test_dipendenza_google_auth.py`; ponte 229 verde. **Richiede REINSTALLARE il Setup** (l'exe
  cambia): poi, con login, i /dati vengono accettati e i documenti finiscono su E:.

- 2026-11-06 — OpenCode — **annullata una cura sbagliata a `fblUrlDati`**. Avevo creduto che con
  «tieni i dati sul mio computer» acceso i documenti andassero forzati al ponte locale; il test
  `cloud_nostro_indirizzo` l'ha beccata (rosso): da fuori casa i documenti DEVONO passare
  dall'inoltro del server `/pc/8000`, che li gira al PC. `fblUrlDati` correto = segue il ponte
  (locale o /pc/8000), invariato. Il difetto «E: vuoto» NON era qui: resta da misurare (richiesta
  /dati autenticata che non popola la cartella). Lezione: il test del progetto è la verità.

- 2026-11-05 — OpenCode — **v2.0.92: Lavoro 2 — candele in locale**. Magazzino IndexedDB per
  asset+timeframe (array tipizzati, tetto 12 voci LRU): a ogni cambio asset/timeframe si chiede solo
  la coda (count piccolo, ~49 KB) invece di riscaricare 5 MB. Controllo di sovrapposizione: se
  l'ultima candela salvata torna con OHLC coerente si aggiungono solo le più nuove; altrimenti
  (buco o broker che ha riscritto lo storico) si rifà lo scarico intero — mai uno storico troncato.
  Provato nei due versi: laboratorio/app/candele_in_locale.test.mjs (3 prove). Collaudo: 5 passi,
  0 falliti. Commit: 37a3c33 + 64c1567 + 5704b4b + 7b03968.

- 2026-11-05 — OpenCode — **v2.0.91: rilascio B — configurazione per conto**. tgAutoPerConto + chiave
  fb_tg_auto_per_conto + migrazione (chiave assente ⇒ {} ⇒ tutto come oggi). Tendina «Impostazioni per
  il conto» in cima al pannello ⚡ con «Tutti i conti (base)» e un elemento per ogni conto salvato
  (REALE/demo accanto), scritta grande del conto che si sta modificando. tgAuto punta al blocco del
  conto scelto; tgAutoDisegna() ridisegna. Copia della base alla prima configurazione, nessuna
  propagazione dopo; sale si sostituisce in blocco. tgAutoDecidi(voce, contoKey) e
  tgAutoPerSimbodoEConto(strumento, contoKey). tgAutoApriSuiConti ridecide per ogni conto bersaglio.
  Sincronizzazione fra dispositivi per fb_tg_auto_per_conto (ridisegna il pannello). Freni per conto:
  spentoIl nel blocco per-conto. Collaudo: 5 passi, 0 falliti. Commit: a2a89df + 4b69037 + 1dc9da1
  + d17c92c + e92cc4a.

- 2026-11-05 — OpenCode — **v2.0.90: rilascio A — sicurezza sui conti reali**. Il conto collegato
  REALE, prop (in_corso/finanziato) o «non lo so» (reale === null) non apre più da solo se non è
  spuntato nella configurazione delle aperture automatiche: il segnale resta nel pannello col motivo
  in italiano. Sui conti demo tutto come prima. Badge «REALE» in rosso nella tabella conti, conferma
  esplicita allo spuntare, targhetta «apertura automatica: SPENTA su questo conto» nel pannello
  segnali. Ponte: /account e /connect restituiscono trade_mode e reale. Collaudo: 5 passi, 0 falliti
  (sintassi 0s, versione 0s, ponte 84s, segnali 2s, browser 866s). Commit: eeab69a + 31f76fe.

- 2026-11-05 — Claude — **v2.0.88: l'etichetta torna leggibile, le due dita rimesse a posto (era una
  mia regressione), l'origine delle sale viaggia anche sul telefono; e la strada per togliere
  Tailscale, con la scoperta che il disco del server va al rovescio di come sembrava**.
  1. **LA LINEA SELEZIONATA PASSAVA SOPRA L'ETICHETTA.** «Quando selezioniamo una linea delle
     etichette, la linea che viene evidenziata passa sopra all'etichetta e invece deve passargli
     sotto… l'etichetta va sempre in primo piano.»
     **MISURATO PRIMA DI CURARE**, perché l'ordine del disegno diceva il contrario: la linea
     evidenziata si disegna a metà di `draw()`, le pillole TP/SL molto più avanti, quindi "a logica"
     la scritta copriva la linea. Invece al momento in cui `disegnaLineaTradeEvidenziata` gira ci
     sono già **5 etichette registrate, due esattamente all'altezza della linea**: disegnate nel
     giro precedente. Ci passava sopra per davvero.
     **LA CURA riusa un meccanismo che esisteva già:** `fblLineaSaltaEtichette`, quello della linea
     normale, interrompe il tratto prima di ogni scritta e lo riprende dopo leggendo
     `labelPlacements`. La selezione si vede comunque, riprende subito dopo la parola. Provata
     **rossa sulla main pubblicata e verde sul ramo**, con la prova di controllo verde in entrambe.
     **LA MIA PRIMA PROVA CHIEDEVA LA COSA SBAGLIATA:** contava i tratti e pretendeva fossero più di
     due. Ma se l'unica etichetta attraversata sta in FONDO alla linea il tratto giusto è **uno** per
     passata (si ferma prima della scritta e non c'è più niente dopo) — e il test bocciava una cura
     che funzionava. Riscritta per misurare la domanda vera: «qualche tratto disegnato copre il
     rettangolo di un'etichetta?». Misurare la cosa giusta vale più che misurare tanto.
  2. **LE DUE DITA ERANO UNA MIA REGRESSIONE, e l'ha trovata lui.** «In modalità pagina principale,
     con due dita devo poter spostare il grafico; a schermo intero lo sposto con un dito. Dobbiamo
     tornare come era prima.»
     **CAUSA, mia, della v2.0.81:** la rete che sbloccava lo scorrimento della pagina puliva i
     registri delle dita (`touchPoints`, `ditaSulGrafico`, `fotoPrimoDito`) **anche su
     `touchstart`**, cioè con un dito ancora appoggiato. Misurato: `touchPoints` = 1 dopo il
     pointerdown, **0** subito dopo il mio touchstart, `gestoDueDita:false`. Il secondo dito
     arrivava e il grafico non sapeva più del primo.
     **LA CURA:** il parametro `pulisciRegistro`. Si pulisce solo quando lo schermo è **libero**
     (`touchend/touchcancel` con zero dita), dove pulire è sicuro; su `touchstart` si sblocca lo
     scorrimento senza toccare i registri. Dopo: `{dopoPointerdown:1, dopoTouchstart:1,
     ditaAllaFine:2, gestoDueDita:true}`. Due prove nuove in `telefono_tocco_grafico` → 7 verdi.
  3. **SUL TELEFONO TUTTE LE OPERAZIONI SEMBRAVANO APERTE DA LUI.** «Le operazioni aperte dalle sale
     segnali mi dice che l'origine l'ho aperta sempre io: deve attribuire il vero nome della sala e
     distinguere quelle che ho aperto io.»
     **CAUSA:** il nome della sala non sta nell'operazione, sta nella mappa `mt5TgMeta`, che vive
     solo nella memoria della finestra che ha ricevuto il segnale. Il telefono riceve la sessione
     dal cloud, dove quella mappa **non c'era**: senza origine, l'app ricade su «manuale», cioè su
     di lui.
     **LA CURA:** `mt5TgMeta: fblMt5TgMetaRecenti(500)` nel pacchetto di sessione, e
     `fblMt5TgMetaUnisci()` al ripristino — **la copia remota riempie i buchi, quella locale vince**,
     perché chi ha ricevuto il segnale dal vivo ne sa più di una copia. Unita prima del giro che
     assegna i `mode`, altrimenti arriverebbe dopo chi la legge.
  4. **TOGLIERE TAILSCALE: la strada, e perché non si poteva togliere e basta.** «Togli tutto quello
     che riguarda Tailscale… l'avevo messo solo per una sicurezza in più quando non avevamo il
     server.» Ma oggi Tailscale non è uno strato in più: è **il trasporto e il certificato**.
     `tailscale serve --https` è ciò che dà HTTPS a server e PC, e serve per una ragione
     insuperabile — l'app è servita in HTTPS e **un browser rifiuta le chiamate in http:// da una
     pagina https://**. Toglierlo senza sostituto = telefono senza accesso.
     Il sostituto è scritto e pronto: `server_oracle/prepara_dominio.sh` (dominio + Let's Encrypt che
     si rinnova da sé + Caddy che espone **solo** `/dati`, tutto il resto 404 per chi arriva da
     internet) e la guida `cervello/GUIDA-DOMINIO-SENZA-TAILSCALE.md`, passi 1-14, nello stile delle
     istruzioni per neofiti. **L'ordine non è negoziabile:** prima il dominio funziona e il telefono
     lo vede dai dati mobili, **poi** si toglie Tailscale dall'app, dal ponte, dal server e dalla
     guida interna. Il passo 14 è il mio, e aspetta solo il nome che sceglie lui.
  5. **IL DISCO DEL SERVER: la richiesta andava letta al rovescio.** «Possiamo modificare
     tranquillamente la capienza all'interno del server Oracle passando a 200 GB.» Prima di scrivere
     i passi sono entrato a guardare: `/dev/sda1 242G, 8.9G usati, 4%`, `sda 250G`. Il disco **non
     è da ingrandire: è già da 250 GB**, oltre i 200 GB che Always Free regala — e i dati veri di
     tutta l'infrastruttura sono **7 MB** (2,9 di dati del ponte, 3,8 di backup).
     Quindi bisogna **scendere**, e qui c'è il vincolo che decide tutto: **Oracle sa ingrandire un
     boot volume, non sa rimpicciolirlo**, e nemmeno il backup aiuta (si ripristina solo su un disco
     grande almeno quanto l'originale). Si sostituisce la macchina: Always Free ne dà **due**, quindi
     la nuova nasce con 50 GB mentre la vecchia lavora ancora, si traslocano 7 MB, si sposta il nome,
     e **solo alla fine** si termina la vecchia **spuntando «Permanently delete the attached boot
     volume»** — senza quella casella il disco da 250 GB resta e si finisce a 300. Passi 15-24 nella
     stessa guida. Non l'ho eseguito: tocca bottoni sul suo account, e la scelta fra questa strada e
     il Pay As You Go (i 50 GB in eccesso, nell'ordine dell'euro e mezzo al mese) è sua.
  6. **Collaudo:** giro intero 1187 prove, **1186 verdi, 0 rosse**, 1 saltata; ponte **222 verdi**.
     Le prove nuove: `linea_selezionata_sotto_etichette` (2, con la prova di controllo), due in
     `telefono_tocco_grafico` (7 in tutto). `node --check` su tutti e 5 gli script di `app.html`.
  **Commit:** uno solo — le tre cure con le loro prove, lo script del dominio e la guida — e la versione 2.0.88.

- 2026-11-05 — Claude — **v2.0.87: fra le finestre non viaggiava il conto REALE (ecco perché «non è
  cambiato nulla»), gli ordini passavano dal giro lungo a 261 ms, e il tasto Aggiorna guardava il
  metro sbagliato**.
  1. **«NON È CAMBIATO NULLA», e aveva ragione.** Dopo la cura della v2.0.86 il proprietario ha
     riprovato: «la pagina duplicata presenta ancora gli stessi sintomi di prima, non è cambiato
     nulla». Alla domanda se gli ordini pendenti fossero simulati o reali: **«sono ordini reali»**.
     Quella risposta ha chiuso il cerchio in un secondo.
     **CAUSA:** il messaggio fra finestre usava `stripMt5TrackedForSave()`, che TOGLIE tutto quello
     che ha un `mt5Ticket` — cioè **ogni posizione e ogni ordine vero del conto**. Alla finestra
     duplicata non arrivava mai niente di reale: restava vuota **per costruzione**. La
     cancellazione curata nella v2.0.86 era un difetto in più, non questo — ed è esattamente
     perché per lui non era cambiato nulla.
     **PERCHÉ QUELLA FUNZIONE ESISTE, e perché lì non andava usata:** il nome lo dice, «ForSave».
     Serve a non SALVARE su disco e in cloud le posizioni reali, che appartengono al broker e si
     rileggono da MT5 — una copia vecchia salvata ieri sarebbe una bugia. Ma fra due finestre
     della STESSA macchina, sullo STESSO conto, nello stesso istante, non c'è niente da
     proteggere. Il filtro resta dov'è utile e sparisce da dove faceva danno, con la prova di
     controllo che misura entrambe le metà.
  2. **GLI ORDINI PASSAVANO DAL GIRO LUNGO, e il numero viene dal suo computer.** Dal pannello di
     diagnosi che mi ha incollato: `lettura conto 1552 volte, media 261 ms, peggiore 19.094 ms, 4
     non riuscite`; `lettura posizioni media 243 ms`. Le stesse rotte in locale rispondono in
     **2-3 ms** (misurato con curl su 127.0.0.1:8000). L'app stava passando **dal server**
     (`/pc/8000`) invece che da 127.0.0.1: con tre chiamate al secondo a 261 ms sono quasi **otto
     decimi di secondo di rete per ogni secondo di orologio**.
     **CAUSA:** il controllo periodico riselezionava la strada **solo se il ponte locale era
     morto** (`if(!vivo)`). All'avvio, se il ponte non è ancora in piedi — e su un computer appena
     accesso ci mette qualche secondo — si sceglie il giro lungo; poi il ponte torna vivo, quella
     condizione è falsa, e non si riseleziona **mai**. Spiega anche perché a lui «ricaricare il
     grafico» sembrava sistemare le cose. È la stessa famiglia della ricaduta dell'ascolto curata
     nella v2.0.85: **una decisione presa una volta all'avvio e mai riconsiderata.**
     Il corpo del timer è stato estratto in `fblStradaOrdiniRicontrolla()` perché il test chiami la
     funzione VERA: la prima versione della prova ricopiava il corpo del timer, e un test che
     duplica il codice non protegge niente.
  3. **IL TASTO AGGIORNA GUARDAVA IL METRO SBAGLIATO.** «Con gli ultimi due aggiornamenti ho
     dovuto installare manualmente il setup.exe dalla release di GitHub, non ha funzionato con il
     tasto aggiorna.» Sia `/versione-programma` sia la rotta che installa confrontano il programma
     installato con la versione della **pagina scaricata sul disco**. Ma quella pagina la scarica
     il ponte quando gli va: se nel momento del clic la copia su disco è ancora la vecchia, il
     confronto dice «pari» e si conclude «basta ricaricare» — ricarica, e il pacchetto non si
     installa mai. È il «ha fatto solo il refresh», e spiega perché capitava negli aggiornamenti
     ravvicinati. Ora il metro è il **tag della release**, che l'app conosce già e che non dipende
     da cosa c'è su disco.
  4. **LA VELOCITÀ, misurata sul suo computer e non ancora curata.** Alla domanda su dove la
     sentisse lenta: «quando scorro il grafico, cambio time frame, inserisco disegni». Il suo
     pannello dà la risposta: `disegnoMedio_ms 54.57`, `fotogrammiAlSecondo 14`, e dentro il
     disegno **`disegniUtente 27,1` + `indicatori 23,74` = 50,8 dei 54,55 ms**. Il contesto spiega
     perché il mio banco non lo vedeva: lui ha **51.172 candele** (io 5.000), 1,2 milioni di tick
     di footprint, 2.356 operazioni. Con 17 disegni al secondo sono ~900 ms di lavoro per ogni
     secondo: il motore è saturo.
     **Non ho toccato niente**, e il motivo è la lezione del giorno prima: prima di ottimizzare
     serve sapere QUALE disegno e QUALE indicatore costa. Il prossimo passo è spezzare quei due
     numeri per singolo disegno e singolo indicatore, come è stato fatto per il traffico cloud.
  5. **UN ROSSO SENZA SPIEGAZIONE, scritto qui perché non vada perduto.** Nel primo giro intero,
     `cloud_incrementale` → «PROVA DI CONTROLLO: se non cambia niente, non si scrive niente» è
     andata rossa **una volta**. Verde da sola, verde in tre giri insieme agli altri test del
     cloud, verde nel secondo giro intero. Ipotesi escluse, una per una: non ha attese a tempo; il
     finto cloud **non** fornisce `salvaCampi` (quindi la scrittura passa comunque da `save` e il
     contatore del test è giusto); e due fotografie consecutive della sessione differiscono solo
     per `savedAt`, che la firma **normalizza** — quindi nessuna scrittura di troppo. Resta
     inspiegata. Se ricapita, si parte da qui.
  6. **UNA MIA ABITUDINE SBAGLIATA, tolta.** Il proprietario ha visto nel Gestione attività
     un'attività mia da **4 ore e 44 minuti**: era un «attendente» che aspettava la riga finale di
     un collaudo che io stesso avevo poi fermato, quindi aspettava una riga che non sarebbe mai
     arrivata. È la seconda volta in due giorni (la prima erano 4 ore e mezza, da un collaudo
     lanciato nello stesso comando di una modifica che aveva rotto la sintassi). Quegli attendenti
     **non servono**: il sistema avvisa già da sé quando un comando in background finisce. Non si
     armano più.
  **Collaudo:** browser 1183 prove, 1182 verdi, 0 rosse (1 saltata); python 222 verdi.
  **Solo `app.html`** fra i file che contano per l'utente: basta il push.

- 2026-11-04 — Claude — **v2.0.86: una finestra appena aperta cancellava le posizioni delle altre
  (una causa, quattro sintomi), il cloud nostro acceso di default, e una guardia contro i nomi
  doppi — nata da un mio errore**.
  1. **IL DIFETTO GROSSO, parole del proprietario:** «quando clicchiamo il pulsante duplica
     finestra, i parametri di prezzo attuale, P/L live… non ci visualizza più le posizioni a
     grafico… sulla seconda finestra, se abbiamo delle posizioni aperte, in realtà non ci fa
     vedere più proprio nulla, non ci aggiorna nulla… è come se cercasse di caricare le posizioni
     esistenti sulla pagina madre e caricarle sulla seconda finestra, e va in conflitto: appare
     poi scompare, appare scompare di continuo».
  2. **CAUSA MISURATA, e una sola per quattro sintomi.** Una finestra duplicata nasce VUOTA per
     scelta esplicita (non ripristina da disco). Ma `scheduleSave()` annuncia lo stato del conto
     alle altre finestre a OGNI singola azione, e durante l'avvio di azioni ce ne sono molte —
     tutte PRIMA che arrivi la risposta alla richiesta dello stato. Quindi la finestra nuova
     annunciava `positions: []`, e il gestore all'altro capo fa `positions = msg.positions`: **la
     madre cancellava le sue posizioni**. Poi la madre le riannunciava, la nuova le riceveva, e
     intanto ne annunciava altre vuote — l'apparire e scomparire che lui descrive.
     **E SPIEGA IL RESTO:** P/L live, prezzo attuale e margine libero si calcolano DALLE
     posizioni. Non erano rotti loro, non c'erano le posizioni. La mini dashboard sotto «Torna
     all'ultima candela» (operazione, P/L, capitale, win/loss, margine libero) esisteva già e
     funziona: non mostrava niente perché non c'era niente da mostrare.
  3. **LA REGOLA: si parla solo se si ha qualcosa da dire.** Curata dai DUE lati, e il secondo
     serve: chi trasmette tace se non ha mai ricevuto niente e non ha niente di suo; chi riceve
     rifiuta una lista vuota da una finestra che non ha MAI annunciato nulla. Senza il secondo
     lato, durante il passaggio di versione una finestra vecchia resta aperta e continua a mandare
     la sua lista vuota. «Ho chiuso l'ultima posizione» passa (quella finestra aveva già parlato
     con dei dati dentro); «sono appena nata e non so niente» no.
  4. **LA TARGHETTA «PIP 2» È VIA.** «Quello togliamolo, non serve assolutamente niente… non
     devono chiamarsi PIP2, PIP3, PIP4.» E con lei i 24 px che il foglio di stile le riservava in
     cima: senza la banderuola erano una striscia vuota rubata al grafico.
  5. **I TP/SL CHE SI RICARICAVANO AL CAMBIO ASSET.** «Prova a ricaricare sempre l'ultima
     posizione aperta, quella dei dati di take profit e stop loss… cosa che invece assolutamente
     non deve fare.» Era scritto in **quattro punti identici**: `active = l'ULTIMA posizione di
     questo asset`, e poi le caselle Stop Loss e Take Profit riempite coi SUOI valori. Scegliere
     per l'utente quale posizione sta modificando — e metterne i livelli nelle caselle da cui
     parte il prossimo ordine — è una decisione che non spetta al programma: su un conto vero quei
     numeri diventano un ordine. Ora la regola sta in una funzione sola
     (`fblAssetCambiatoAzzeraSelezione`) e non seleziona niente. **Le posizioni non si toccano:**
     restano tutte aperte e tutte disegnate, è la selezione che scompare. Con la prova di
     controllo che conta: se l'asset NON è cambiato non si tocca niente, perché da quella strada
     passa anche il refresh del Live ogni secondo e svuotare le caselle cancellerebbe una bozza di
     ordine in composizione.
  6. **IL CLOUD NOSTRO È ACCESO DI DEFAULT.** «Di default poi il mio PC terrà i dati degli utenti
     e miei sul mio PC, sul disco E.» Ma il default vale solo **dove le rotte rispondono davvero**:
     su un telefono non c'è nessun ponte, e un default acceso alla cieca farebbe sbattere ogni
     salvataggio contro una porta chiusa prima di ricadere su Firebase. All'avvio si chiede una
     volta (401 = c'è, 404 = non c'è) e la risposta si ricorda. **Tre stati, non due:** acceso
     dall'utente, SPENTO dall'utente, o non scelto — perché senza lo «spento» esplicito il default
     riaccenderebbe al prossimo avvio quello che l'utente aveva spento.
  7. **UN MIO ERRORE, e la guardia che ne è nata.** Avevo chiamato una funzione del cronometro
     `fblCronoDisegna`: quel nome **esisteva già** — è il disegnatore della cronologia delle sale
     Telegram, assegnato a `window` più in basso e chiamato dal `draw()` con nove argomenti. La mia
     dichiarazione veniva soppiantata dalla sua, quindi il cronometro era **codice morto**, e me ne
     sono accorto solo perché un test leggeva un riquadro rimasto vuoto. **A ordine invertito avrei
     rotto un grafico che funziona**, e nessun test lo avrebbe detto: `draw()` chiama quel nome
     dentro un `try/catch`, quindi quel grafico sarebbe semplicemente scomparso.
     Da qui `nomi_unici.test.mjs`. Scrivendolo ho imparato due distinzioni senza cui era rosso su
     un codice sano (`window.nome = nome` è un'esposizione voluta, non una ridefinizione; nella
     guida agli indicatori ci sono esempi scritti a mano che sembrano funzioni) e **una terza cosa
     che conta di più**: la prima versione della guardia era **muta**. Il regex finiva con l'ancora
     di fine riga, e `app.html` ha fine-riga Windows — quella riga non veniva mai esaminata.
     Scoperto solo provandola nei due sensi: rimettendo il nome sbagliato restava verde. Senza
     quella prova avrei aggiunto una protezione che non protegge, e l'avrei creduta tale.
  8. **LA VELOCITÀ: misurata, e non è nell'app.** Alla domanda su dove la sentisse lenta il
     proprietario ha risposto: «quando scorro il grafico, cambio time frame, inserisco disegni».
     Misurato con una sessione che ha davvero i suoi disegni dentro (98 KB di pacchetto, 5000
     candele): `draw()` **1,56 ms**, un passo di scorrimento 1,34 ms, `rebuildRows()` 0 ms, il
     raccoglimento della sessione 0,04 ms, le firme per campo 0,54 ms, la scrittura sincrona di
     149 KB su localStorage 0,19 ms, le tre chiamate al ponte 2-3 ms l'una. **Niente di lento, da
     nessuna parte.** Anche il sospetto che avevo su me stesso — le firme per campo aggiunte dal
     delta — era infondato.
     Quindi nessuna cura a naso: entra il **cronometro**, che misura nella sessione VERA e registra
     solo sopra i 16 ms (un fotogramma), così non diventa lui il rallentamento. L'unica cosa
     davvero stretta misurata sul computer del proprietario è la **memoria: 2,5 GB liberi su 16**.
  9. **IL CONTO DEL TRAFFICO** (dalla v2.0.85) ora si vede nel pannello accanto al cronometro:
     documento per documento, scritture, letture e **KB**, ordinato per banda.
  10. **AGGIORNAMENTO: CHIUSO, confermato dal proprietario.** «Ora il programma si chiude
     correttamente alla installazione dell'aggiornamento.» Coincide con le misure: eseguibili
     sostituiti alle 19:28, canale dei segnali riagganciato alle 19:27 e 19:30, ponte che dichiara
     la versione nuova. Resta aperto solo il crash occasionale in installazione, se si ripresenta.
  11. **DA VERIFICARE, e serve una prova del proprietario:** il tasto schermo intero che dopo
     «duplica finestra» non si seleziona più. Nel ramo desktop `openExtraPipWindow` chiama
     pywebview e ritorna SUBITO: non tocca nessuno stato della pagina madre, quindi non è l'app a
     disabilitarlo. La prova che distingue: farlo **dal sito nel browser**, dove la finestra si
     apre con `window.open` invece che con pywebview.
  **Collaudo:** browser 1178 prove, 1177 verdi, 0 rosse (1 saltata); python 222 verdi.
  **Solo `app.html`** fra i file che contano per l'utente: basta il push.

- 2026-11-04 — Claude — **v2.0.85: se cade il PC continua Firebase, una fotografia al giorno, e
  un contatore per sapere DA DOVE viene la bolletta**.
  1. **LA DIVISIONE DEI COMPITI, parole del proprietario:** «la fonte primaria è il nostro PC…
     però facciamo in modo che Firebase è la nostra spalla: se cade il PC, continua Firebase». E:
     «quelle cose che pesano parecchio, dove Firebase andrebbe a fatturare, togliamolo e
     mettiamolo sul PC… Firebase e Firestore continueranno quella che è la logica di
     autenticazione, le cose dove richiede una vera e propria sicurezza solida».
  2. **PRIMA UN CONTATORE, POI LE CURE — e la ragione è un mio errore dello stesso giorno.** Nella
     v2.0.83 ho presentato l'ascolto della sessione come «la metà che si paga»: poi ho scoperto
     che quell'ascolto **non viene mai avviato** (`fxbtCloud.onChange` non è chiamata da nessuna
     parte; gli ascolti vivi sono grafico, collegamento e preferenze). La modifica era corretta in
     sé e innocua, ma **non ha risparmiato un byte**, e io l'avevo raccontata come un risparmio.
     I totali della console Firebase dicono QUANTO, non DA DOVE, e il «da dove» a intuito l'ho
     già sbagliato due volte oggi (qui e sul profilo volumetrico).
     **ORA SI MISURA:** una tabella nel pannello «Accesso da altri dispositivi», documento per
     documento, scritture / letture / **KB**, ordinata per **banda** e non per numero di
     operazioni (su Firebase si paga la banda, è annotato in cervello). Totale giornaliero, come
     la console, così i due numeri si confrontano. Si contano anche le consegne di `onSnapshot`
     che tornano al dispositivo che ha appena scritto: è lo spreco meno visibile di tutti.
  3. **SE CADE IL PC, CONTINUA FIREBASE — il buco e la cura.** `_ascoltaDoc` scegliva UNA strada
     all'avvio e non tornava mai indietro: col PC spento il WebSocket riprovava in silenzio ogni
     5-30 secondi, `fblAscoltaDocumento` non riceveva niente, e l'ascolto Firebase **non veniva
     mai avviato**. Quel dispositivo restava zitto, senza aggiornamenti dagli altri e **senza modo
     di accorgersene**. Ora: se il nostro server non si fa sentire entro 8 secondi si accende
     ANCHE Firebase, senza spegnere il nostro — così quando il PC torna si riaggancia da solo.
  4. **LA REGOLA DEL PIÙ FRESCO, che è quella che rende SICURA la ricaduta.** Con due sorgenti
     accese una può avere la copia vecchia. Scenario vero: il PC resta spento un giorno, in quel
     giorno si lavora dal telefono e Firebase si aggiorna, poi il PC si riaccende e la sua copia —
     vecchia di un giorno — arriva per ultima. Senza regola, **il lavoro di oggi verrebbe
     sostituito da quello di ieri**: la ricaduta del punto 3, da sola, avrebbe reso il problema
     più probabile invece di risolverlo. Si applica solo un documento più fresco; uno senza data
     si applica comunque (scartarlo sarebbe peggio) ma non sposta il riferimento.
  5. **UN DETTAGLIO CHE HA FATTO RIFARE IL DISEGNO, e vale la pena scriverlo.** La prima versione
     passava alla ricaduta un `applica(valore)` da chiamare al posto di `cb`. Sbagliato: i
     callback non hanno tutti la stessa forma — quello dei disegni prende DUE argomenti
     `(voci, locale)`, e `locale` distingue l'**eco della propria scrittura** da una modifica di
     un altro dispositivo. Passandone uno solo, l'eco sarebbe stata trattata come remota e
     riapplicata addosso: un giro che non finisce. Controllo invertito: la ricaduta **chiede il
     permesso** (`consenti(data)`) e chiama il SUO callback con i SUOI argomenti.
  6. **UNA FOTOGRAFIA INTERA AL GIORNO SU FIREBASE.** Chiesta: «una scrittura almeno di backup al
     giorno su Firebase, per non perdere tutti i dati di tutti gli utenti». E ha una ragione
     tecnica che va oltre il backup: da quando si manda solo il delta, la copia su Firebase è il
     risultato di **tante fusioni parziali** — se una non è arrivata (buco di rete, telefono che
     perde campo a metà), quella copia resta sottilmente sbagliata e **nessuno lo sa**. La
     fotografia intera riallinea e rimette una base di cui si conosce il contenuto.
     **Giorno LOCALE, non UTC:** con l'UTC, in Italia scatterebbe all'una o alle due di notte
     invece che al primo utilizzo della giornata. **Con la memoria negata** (finestra privata) non
     si fa: senza poter ricordare che è già stata fatta partirebbe a OGNI salvataggio — 48 KB per
     modifica, l'opposto del risparmio. **Il giorno si segna solo dopo una scrittura riuscita**:
     un tentativo fallito va rifatto, non dimenticato per ventiquattro ore.
  7. **UNA CORREZIONE SU QUELLO CHE AVEVO DETTO DEL SERVER ORACLE.** Durante la giornata ho
     ripetuto più volte che «non ha un posto dove girare»: vale per la **migrazione ad ARM**, non
     per il server esistente. Verificato: `https://pietro.tail83d918.ts.net:8000/health` risponde
     `403 — Chiave d'accesso mancante o errata`, cioè il servizio **è vivo** e il controllo chiave
     funziona. Conseguenza pratica da ricordare: dalla v2.0.82 `server_oracle/ponte_server.py` è
     cambiato (usa il modulo condiviso), quindi **il server sta girando col codice vecchio** e non
     ha la cura del registro degli ascoltatori. Va aggiornato quando si ha accesso.
  **Collaudo:** browser 1161 prove, 1160 verdi, 0 rosse (1 saltata); python 222 verdi.
  **Test nuovi, provati nel loro pezzo, ognuno con le sue prove di controllo:** 5 prove in
  `ascolto_documento_server.test.mjs` (fra cui «se il nostro server risponde, Firebase resta
  spento» — senza quella, accendere sempre Firebase avrebbe fatto passare tutto e pagare due
  volte) e `traffico_cloud.test.mjs`, 7 prove.
  **Solo `app.html`** fra i file che contano per l'utente: basta il push.

- 2026-11-04 — Claude — **v2.0.84: torno indietro sugli istogrammi. Avevo confuso due richieste
  diverse** — e i dati dell'utente vanno sul disco E.
  1. **IL PROPRIETARIO MI HA FERMATO, e aveva ragione.** Parole sue, appena pubblicata la
     v2.0.81: «attenzione, abbiamo un problema gravissimo per quanto riguarda gli istogrammi dei
     profili volumetrici… siamo ritornati al vecchissimo problema che avevamo una volta: quando
     effettuavamo lo zoom, le dimensioni dell'istogramma rimangono uguali. No, no, no, devi
     ritornare alla versione precedente. Io ti avevo detto soltanto di modificare quello che era
     il numero delle barre, ma non il fatto della dimensione, farlo rimanere uguale cambiando il
     time frame. Sono due cose diverse.»
  2. **LE DUE COSE, e perché le ho confuse.** Lui aveva chiesto che il **NUMERO** delle fasce non
     cambiasse col timeframe, «sennò si sposterebbe quello che è il not volume». Io ho agganciato
     la **LUNGHEZZA** delle barre al riquadro del grafico invece che al periodo coperto dal
     profilo. Sono richieste diverse e ho curato quella che nessuno aveva fatto.
  3. **QUANTO ERA GRAVE, misurato.** Col valore predefinito (500%) la formula ancorata al riquadro
     dava `cw × 0.7`, oltre il tetto massimo `cw × 0.6`: la lunghezza finiva **sempre** contro il
     tetto. **684 px a qualunque zoom e a qualunque timeframe** — completamente immobile, non
     «meno reattiva». Un difetto già corretto una volta in passato, fatto tornare da me.
  4. **CURA: tornato esattamente all'aggancio al periodo**, con scritto accanto perché e con le
     parole del proprietario, così non si rifà.
  5. **IL TEST PRETENDEVA IL COMPORTAMENTO SBAGLIATO**, che è il modo peggiore in cui un test
     possa passare: `profilo_barre_timeframe.test.mjs` misurava «la barra più lunga è la stessa a
     1, 5 e 15 minuti». Riscritto, e ora misura le due cose **separate**: (a) il numero delle
     fasce non cambia col timeframe — la richiesta vera; (b) la lunghezza **cambia** con lo zoom —
     il difetto da non far tornare mai più. Più la prova di controllo sulla manopola «Dimensione
     istogramma».
  6. **UNA MISURA SBAGLIATA ANCHE NEL TEST NUOVO, annotata perché è la stessa trappola.** La
     prima versione della prova sullo zoom confrontava 684 px con 684 px e concludeva «immobile»:
     stava misurando il **soffitto** (VP_MAX_BAR_PX), non il comportamento. Con un profilo di 30
     minuti si resta sotto il tetto e si vede la cosa vera.
  7. **DUE ERRORI DI FILA SULLO STESSO INDICATORE, e vanno scritti insieme.** Il primo: una cura
     basata su una premessa falsa (le fasce che si dimezzavano), tolta da me quando il controllo
     del banco l'ha smentita — le fasce non sono mai dipese dal timeframe, 300 a 1, 5 e 15
     minuti, misurato. Il secondo: questo. **La lezione è la stessa: la cosa chiesta era già a
     posto, e avrei dovuto fermarmi a dirlo invece di cercare un problema.**
  8. **I DATI DELL'UTENTE VANNO SUL DISCO E.** Scelto dal proprietario: «sul disco E,
     ricordatelo, dove creeremo una cartella apposita chiamata Forex Backtest Lab». E non è un
     capriccio: su C restano **29 GB liberi su 465**, su E **182 su 220**, e questo database
     cresce con i dati di tutti gli utenti che passano da qui. L'ordine delle scelte è
     `FBL_DATI` → `E:\Forex Backtest Lab\dati` se il disco **risponde a una prova di scrittura
     vera** → `%APPDATA%` come ripiego: una lettera di disco può essere una chiavetta staccata, e
     un database che non si apre è peggio di un database nel posto di riserva.
  **Collaudo:** browser 1149 prove, 1148 verdi, 0 rosse (1 saltata); python 222 verdi.
  **NON solo app.html:** cambia `installer_build/build/documenti_utente.py` (la cartella su E).
  Serve il pacchetto nuovo perché i dati finiscano davvero su E.

- 2026-11-04 — Claude — **v2.0.83: la cura della bolletta era rimasta a metà — e la metà che
  mancava era quella che si paga**.
  1. **COSA HO TROVATO SUBITO DOPO AVER PUBBLICATO LA v2.0.82.** Guardando il ponte vivo del
     proprietario per dirgli cosa installare, è venuta fuori una cosa che la v2.0.82 non copriva:
     l'ascolto del documento **session** era rimasto su `onSnapshot`, cioè su Firestore, mentre gli
     altri tre (grafico, collegamento, preferenze) erano passati all'ascolto nostro il 31 ottobre.
     E `session` è il **più grosso**: 48 KB misurati. Con Firestore ogni modifica lo fa riscaricare
     INTERO a ogni dispositivo in ascolto, **anche a quello che l'ha appena scritto** — ed è da lì
     che vengono le 250.000 letture che il proprietario paga. La cura della bolletta copriva tre
     documenti su quattro, e il quarto era quello che pesa.
  2. **ORA PASSA DALL'ASCOLTO NOSTRO ANCHE LUI**, cioè da `{nome, versione}` — venti byte — con il
     documento riletto solo se la versione è cambiata. Senza server si resta su Firestore,
     identico a prima.
     **UNA TRAPPOLA, chiusa con una funzione sola e il suo test:** la forma del dato è diversa fra
     i due posti (su Firestore il documento è `{state: …}`, sul nostro il contenuto **è** lo
     stato). Tradurla male non dà un errore: dà uno **stato vuoto**, che è il modo più silenzioso
     di cancellare il lavoro di qualcuno. `fblSessioneDaDocumento()` fa solo quello, e distingue
     «non c'è ancora niente» (`null`, che resta `null`) da «c'è il vuoto».
  3. **QUATTRO PUNTI CHIEDEVANO ANCORA LA DOMANDA VECCHIA.** La doppia scrittura di session e
     footprint guardava `fblServer()`, cioè «c'è il server Linux?», invece di «c'è un posto nostro
     dove scrivere?». Col cloud sul computer `fblServer()` può essere vuoto: quei quattro punti
     avrebbero smesso di scrivere sul nostro server proprio i **due documenti più grossi**, nel
     momento in cui lo si accende. Ora la domanda è una sola (`fblCloudNostroDisponibile()`).
  4. **L'INTERRUTTORE NON SI ACCENDE CONTRO UN PONTE VECCHIO.** Le rotte `/dati` arrivano col
     pacchetto della v2.0.82: un ponte precedente risponde 404. Acceso contro quello, l'utente
     crederebbe di aver spostato i suoi dati senza averlo fatto — Firebase resta la rete di
     sicurezza e nessun dato si perde, ma la convinzione sbagliata resta, ed è il genere di cosa
     che si scopre tardi. Adesso si chiede, invece di sperare: **la domanda non porta il token, di
     proposito** — senza token una rotta che esiste risponde 401 e una che non esiste risponde
     404, e bastano quei due numeri senza tirare in mezzo l'identità dell'utente. Se non ci sono,
     la spunta torna indietro e la nota dice cosa fare.
  **TEST:** 3 prove nuove in `cloud_nostro_indirizzo.test.mjs` (una delle quali è la prova di
  controllo che conta: col ponte **nuovo** (401) l'interruttore si accende — senza quella, un
  controllo rotto che rifiuta sempre avrebbe passato la prova del 404 e la funzione non si sarebbe
  mai potuta accendere), più la prova sulle due forme della sessione.
  **Collaudo:** browser 1148 prove, 1147 verdi, 0 rosse (1 saltata); python 221 verdi.
  **Solo app.html** fra i file che contano per l'utente: basta il push. Il pacchetto della
  v2.0.82 resta quello che serve installare, perche' porta le rotte /dati nel ponte.

  **UNA COSA MIA, da non ripetere (4 novembre 2026).** Un collaudo lanciato nello STESSO comando
  di una modifica ad app.html e' rimasto appeso quattro ore e mezza: la modifica aveva lasciato
  un errore di sintassi (un apostrofo mangiato dalla shell), i test sono partiti su quel file e
  il banco aspettava una pagina che non si sarebbe caricata mai. Il proprietario l'ha visto dal
  Gestione attivita' e ha chiesto cos'era. Regola: modifica, POI controllo di sintassi, POI i
  test - mai concatenati in un comando solo.

- 2026-11-04 — Claude — **v2.0.82: la bolletta. Si manda solo quello che cambia, e il cloud può
  stare sul computer del proprietario**.
  1. **LA RICHIESTA, parole sue:** «quello che è stato scritto rimane archiviato nel dispositivo.
     Quello che deve scrivere è soltanto l'ultimo aggiornamento e non deve sovrascrivere,
     altrimenti è normale che scrive una marea di dati. Prende riferimento soltanto l'ultima
     scrittura, che è di qualche byte, non può essere kilobyte o addirittura megabyte.» E il conto
     che la motiva: «ieri su Firestore siamo arrivati a 250.000 letture e 122.000 di scritture. O
     sistemiamo qualcosa all'interno che non mi faccia pagare, o se no cambiamo sistema.»
  2. **PRIMA LA MISURA, perché senza non si sa dove tagliare.** Su una sessione realistica (8
     posizioni, 4 ordini pendenti, disegni su 12 asset in 2 sessioni, ultima candela vista per
     asset e per sessione) la fotografia intera pesa **52,4 KB**, di cui **42 KB di soli
     `assetDrawings`**. Le operazioni chiuse erano già uscite dal pacchetto il 26 ottobre, il
     footprint il 31: quello che restava si rimandava TUTTO ogni volta che cambiava una cosa sola.
  3. **DUE LIVELLI DI DELTA, e il secondo serve.** Una firma per CAMPO basta per le posizioni, ma
     non per i disegni: `assetDrawings` è un campo solo con dentro tutti gli asset di tutte le
     sessioni, quindi il delta per campo avrebbe mandato ancora 42,9 KB — quasi niente di
     risparmiato. Per quello (e per `assetChartViews`) la firma scende di un livello:
     modalità e asset.

     | modifica | prima | dopo | |
     |---|---|---|---|
     | scorro il grafico | 48,7 KB | **0,1 KB** | 357× meno |
     | chiudo una posizione | 48,6 KB | **1,1 KB** | 44× meno |
     | sposto uno stop | 48,7 KB | **1,2 KB** | 39× meno |
     | sposto un disegno | 48,7 KB | **5,1 KB** | 10× meno |

     Scorrere il grafico è la cosa che si salva più spesso: lì si passa da 48 KB a cento byte.
  4. **L'UNICO CASO IN CUI SI RISCRIVE TUTTO, e non è pigrizia: quando una CHIAVE SPARISCE.** La
     fusione non cancella. Se l'utente cancella i disegni di un asset, mandare solo i campi
     rimasti lascerebbe la vecchia chiave viva sul server, e al prossimo ripristino i disegni
     cancellati **tornerebbero**. Un risparmio che ti fa ricomparire un disegno cancellato non è
     un risparmio: in quel caso si fa una scrittura intera, che cancella davvero. È la prova che
     conta più del risparmio, ed è nel test.
  5. **CHE COSA IL DELTA *NON* CURA, e va detto chiaro: le LETTURE.** Quando un documento cambia,
     Firestore manda agli altri dispositivi il documento **intero**, non il delta — anche a quello
     che l'ha appena scritto. Le 250.000 letture vengono da lì, e nessuna cura lato scrittura le
     tocca.
  6. **PER QUELLO IL CLOUD NOSTRO, e il proprietario l'ha chiesto esplicitamente:** «accendiamolo
     e lo mettiamo all'interno del nostro disco e sul PC». **Sorpresa, in positivo: era già
     costruito.** Le rotte `/dati` esistevano da fine ottobre — leggi, scrivi, **fondi** (cioè la
     scrittura a delta), operazioni append-only, ascolto in tempo reale — ma solo in
     `server_oracle/ponte_server.py`, cioè solo sul server Linux, che oggi **non ha un posto dove
     girare** (Oracle non ha capacità a nessuna taglia). Mancava un posto, non il codice.
  7. **DOVE GIRANO ADESSO: dentro il ponte che il proprietario accende ogni giorno.** Le rotte
     sono state spostate in `installer_build/build/documenti_utente.py`, montato sia da
     `bridge.py` (il computer, porta 8000 — la stessa degli ordini) sia da `ponte_server.py`: una
     copia sola della logica, perché due copie divergono sempre. I dati stanno in un file SQLite
     in `%APPDATA%\ForexBacktestLAB\dati`, cioè fuori dalla cartella del programma: sopravvive
     agli aggiornamenti.
     L'app ci arriva con la **stessa strada degli ordini** — locale, diretta sulla rete privata, o
     inoltrata dal server su `/pc/8000`: è quest'ultima che serve quando non si è in casa, e
     risponde anche al suo avviso successivo («il nostro PC sarà di collegamento anche agli altri
     utenti»). L'interruttore è nel pannello «Accesso da altri dispositivi» e **nasce spento**:
     spostare dove vivono i dati non è una cosa da fare di nascosto a nessuno.
  8. **UN DIFETTO VERO TROVATO MENTRE SI SPOSTAVA, e proprio nella parte che serve di più:** il
     registro degli ascoltatori (`_ascoltatori`) **non veniva mai riempito**. Il WebSocket
     accettava la connessione, mandava l'elenco iniziale e poi taceva; `avvisa()` trovava sempre
     un insieme vuoto. Il risparmio che il commento dichiarava — venti byte invece del documento
     intero — **non è quindi mai entrato in funzione**: scrivendo dal computer, il telefono non lo
     sapeva. Non era un ascolto, era una sincronizzazione sola andata. Misurato sul codice
     pubblicato: un ascoltatore collegato risulta **0**; qui risulta 1. In più la **fusione** ora
     avvisa come la scrittura intera: prima no, e da quando il delta è la strada normale sarebbe
     stato il caso più comune a non svegliare nessuno.
  9. **LA PROVA DI SICUREZZA, perché il computer servirà anche altri utenti.** Le rotte `/dati`
     scavalcano il controllo chiave del ponte — hanno un'autenticazione loro, il token Firebase
     personale di ogni utente, verificato contro le chiavi pubbliche di Google, e ogni riga del
     database è legata all'uid che ne esce (un uid mandato dal client non si accetta mai). Quello
     scavalco deve essere **stretto a quel prefisso**: un test misura che `/order/market` e
     `/positions` restino dietro la chiave anche da fuori, perché aprire questa porta agli altri
     utenti non deve voler dire aprire le rotte che mandano ordini veri.
  10. **UN ERRORE MIO, annotato perché non si ripeta.** Il mio primo test sostituiva
     `motivo_rifiuto` in un modulo CONDIVISO senza ripristinarlo: undici test rossi altrove, tutti
     causati da quella riga. Rifatto con `monkeypatch`, e la suite python gira verde anche in
     ordine inverso.
  **TEST NUOVI, provati nei due sensi, ognuno con le sue prove di controllo:**
  `cloud_scrittura_delta.test.mjs` (7 prove, 2 di controllo: niente cambiato = niente mandato; il
  solo orario di salvataggio non fa scrivere), `cloud_nostro_indirizzo.test.mjs` (6 prove, 3 di
  controllo: spento non cambia niente, e un nome secco resta https con la porta),
  `test_cloud_nostro_sul_pc.py` (9 prove, 3 di controllo).
  **Collaudo:** browser 1145 prove, 1144 verdi, 0 rosse (1 saltata); python 221 verdi, anche
  in ordine inverso.
  **NON solo app.html:** cambiano installer_build/build/bridge.py e il modulo nuovo
  installer_build/build/documenti_utente.py. Serve il pacchetto nuovo, o le rotte /dati sul
  computer non esistono e l'interruttore del cloud nostro non ha dove scrivere.
  **Server Oracle:** server_oracle/ponte_server.py e' cambiato (usa il modulo condiviso), quindi
  quando il server tornera' ad avere un posto dove girare va riportato anche la'.

- 2026-11-04 — Claude — **v2.0.81: il profilo non si accorcia più al cambio di timeframe, la
  finestra duplicata mostra solo il grafico, il break-even va DOVE vuoi tu, e quattro cose che il
  dito non riusciva a fare**.
  1. **SINTOMO, parole del proprietario:** «se stabilisco 300 barre con un time frame a un
     minuto, passando a 5 minuti non possono dimezzare, e a 15 minuti dimezzarsi ancora di più.
     Devono rimanere sempre uguali… È come funziona su TradingView.» Alla domanda su cosa
     cambiasse: «la fascia di prezzo rimane corretta, e lo fanno TUTTI i profili: disegno a
     mano, giornaliero e per sessione.»
  2. **PRIMA HO CERCATO NEL POSTO SBAGLIATO, e va scritto.** Avevo supposto che il disegno
     saltasse le fasce VUOTE e avevo già scritto la cura. Il controllo del banco l'ha fermata:
     a 15 minuti risultavano piene TUTTE E 120 le fasce, perché le candele aggregate sono più
     ALTE e il loro volume si spalma su PIÙ fasce, non su meno. Ho tolto la cura invece di
     pubblicarla: le fasce chieste non sono mai dipese dal timeframe (300 a 1, 5 e 15 minuti,
     misurato).
  3. **CAUSA VERA: la SCALA ORIZZONTALE.** La lunghezza massima della barra era una frazione
     della larghezza IN PIXEL del periodo coperto dal profilo, e un periodo fisso nel TEMPO
     occupa molti meno pixel quando ogni candela vale 15 minuti invece di 1. Misurato su 300
     minuti di mercato, a parità di candele a vista: **684 px a 1 minuto, 599 a 5 minuti, 200 a
     15 minuti**. Tutte le barre si accorciano di 3,4 volte: le piccole scendono sotto il pixel
     e spariscono, e l'istogramma SEMBRA dimezzato. Spiega anche perché la fascia di prezzo
     restava corretta (l'effetto è orizzontale) e perché capitava su tutti e tre i profili: il
     disegnatore è uno solo.
  4. **DECISIONE ROVESCIATA — E POI ANNULLATA IL GIORNO STESSO: vedi la v2.0.84, il
     proprietario l'ha fermata perche' rendeva l'istogramma immobile allo zoom.**
     la lunghezza è AGGANCIATA ALL'ASSE DEL TEMPO». L'intenzione era giusta, l'aggancio no:
     TradingView misura la larghezza del profilo sul RIQUADRO, non sul periodo — da lì il suo
     «Width 70%» identico a ogni timeframe e a ogni zoom. Ora fa lo stesso, e il 500% continua a
     voler dire 70% (del riquadro invece che del periodo).
  5. **TEST NUOVO:** `profilo_barre_timeframe.test.mjs`, 2 prove, di cui una di controllo (la
     manopola «Dimensione istogramma» deve continuare a funzionare, se no la cura avrebbe
     bloccato la larghezza su un numero fisso). Provato nei due sensi sul codice PUBBLICATO:
     rosso sulla v2.0.80, verde qui.
  6. **DUE MISURE SBAGLIATE PRIMA DI QUELLA BUONA, annotate perché non si ripetano.** La barra
     del POC è disegnata in DUE rettangoli affiancati (comprato e venduto): misurare il più
     largo dei due dà un numero che dipende da come si dividono. E leggere i rettangoli del
     canvas prende dentro candele, sfondi e zona a basso volume: uscivano barre più larghe del
     grafico stesso. La misura buona legge `vpIndBarRects`, dove il disegnatore registra la
     geometria esatta di ogni barra.

  7. **LA FINESTRA DUPLICATA MOSTRA SOLO IL GRAFICO.** Parole sue: «in modalità duplica schermo
     ho visto che passi anche quelle che sono le tabelle delle posizioni, gli ordini pendenti,
     eccetera. Invece no: deve aprirsi a tutto schermo quello che è soltanto il grafico. Stop.»
     **E QUI HO TROVATO UNA COSA CHE NON MI ASPETTAVO:** il nascondimento c'era già da tempo
     (`initExtraPipWindow`), e in banco funzionava perfettamente — la prima versione del test
     passava anche sul codice pubblicato. La causa vera è che quel nascondimento usa uno stile
     **inline**, e un `elemento.style.display='block'` scritto più tardi da qualunque parte
     dell'app lo **cancella**: basta che arrivi una posizione dalla pagina madre o un ordine
     pendente e il pannello ricompare sopra il grafico. Misurato: pannelli visibili 1 → 2. La cura
     è una regola di foglio di stile con `!important`, che lo stile inline non batte. Un
     `!important` **inline** la batterebbe, ma l'app non lo usa: chiederlo al test avrebbe voluto
     dire pretendere dal CSS una cosa che il CSS non può fare.
  8. **COSA PASSA TRA LE FINESTRE E COSA NO, e una sua decisione rovesciata.** «Le operazioni che
     apro sulle pagine duplicate andranno a finire nella pagina madre. Per quanto riguarda i
     disegni invece no: quello rimane indipendente tra pagina e pagina, e ovviamente va scritto
     come informativo. E anche per esempio gli indicatori.»
     **Posizioni e ordini:** già in comune, e il messaggio del conto non ha mai portato disegni né
     indicatori. **Disegni:** invece viaggiavano, con un messaggio `drawings_sync` **chiesto
     esplicitamente dal proprietario stesso** in passato. La parola nuova vince su quella vecchia:
     spento. **Indicatori:** non hanno mai viaggiato. L'informativa chiesta sta nel `title` del
     pulsante «Duplica finestra», che adesso dice tutte e tre le cose.
     I pannelli si NASCONDONO, non si rimuovono: è così che una posizione aperta nella finestra
     duplicata arriva comunque alla pagina madre — e il test lo misura, non lo presume.
     **TEST:** `finestra_solo_grafico.test.mjs`, 6 prove di cui 3 di controllo (la pagina
     principale continua a mostrare tutto; le posizioni di un'altra finestra entrano eccome; il
     documento resta intero). Sul pubblicato: 3 rosse, i controlli verdi da entrambe le parti.
  9. **BREAK-EVEN: HO CAPITO AL ROVESCIO, e me l'ha corretto.** Il 3 novembre avevo costruito la
     regola come SOGLIA: un giro periodico portava lo stop al pareggio esatto appena il guadagno
     raggiungeva i pip impostati. Parole sue del 4: «ci siamo fraintesi… quando noi pigiamo il
     pulsante break-even, le posizioni dovranno spostarsi a 0 pip di guadagno, quindi al punto di
     entrata; ma se l'utente scrive 10 pip, il break-even si sposta a 10 pip… perché oggi funziona
     che quando arriva a 10 pip di guadagno sposta le posizioni a 0, punto d'inizio.»
     **ORA il numero è la DESTINAZIONE, non il grilletto.** Nessun grilletto nuovo: quel giro
     periodico è stato tolto, e i tre grilletti di sempre passano tutti da `fblPareggioSpostato()`
     — il pulsante premuto dall'utente, la regola di sala che al tocco di un TP porta lo stop
     «all'entrata», e il pareggio anticipato della strategia (l'85% verso il primo target).
     **UN RISCHIO NUOVO, visto e chiuso:** con 10 pip impostati e il prezzo avanti solo di 3, lo
     stop spostato cade OLTRE il prezzo — cioè una chiusura immediata a mercato travestita da
     protezione. La guardia esistente lo prendeva solo quando lo spread normale dell'asset è noto:
     adesso c'è un rifiuto esplicito che dice anche perché, e si riprova da solo quando il prezzo
     ha superato il livello.
     **TEST:** `break_even_generale.test.mjs` **riscritto** — il vecchio pretendeva il
     comportamento sbagliato, che è il modo peggiore in cui un test può passare. 8 prove, di cui 4
     di controllo a regola spenta (lo stop deve tornare al pareggio esatto). Sul pubblicato: 4
     rosse, i 4 controlli verdi da entrambe le parti.
  10. **QUATTRO COSE CHE IL DITO NON RIUSCIVA A FARE, con tre cause diverse.**
     (a) «a volte, con il dito, quando voglio trascinare la pagina e sono sopra il grafico, non me
     lo fa trascinare». Il «a volte» era la chiave: non una regola sbagliata, uno **stato che
     resta appeso**. Il grafico blocca lo scorrimento per la durata di un gesto suo e lo sblocca
     nel ramo del rilascio — oltre venti punti bloccano, ognuno col suo sblocco. Se UN rilascio si
     perde (sul telefono si perde) il blocco resta per sempre: misurato, dopo un mirino da
     pressione lunga col rilascio perso `touch-action` restava `none` anche al tocco NUOVO. Invece
     di un ventunesimo sblocco c'è una **rete**: a schermo libero da dita, gli stati che vivono
     solo per un dito (mirino e gesto a due dita — gli unici due che non catturano il puntatore, e
     per questo gli unici che perdono il rilascio) si smontano, e lo scorrimento torna libero.
     (b) «non funziona nemmeno selezionare una linea TP/SL e poi trascinarla: al momento che
     comincio a trascinarla si blocca… se sono con un dito, in modalità pagina principale».
     Sulla pagina normale il tocco sulla linea non veniva bloccato, quindi il browser si prendeva
     il gesto e il trascinamento moriva. In schermo intero funzionava: è esattamente la differenza
     che descriveva lui. Ora una linea (e un disegno) si prende il gesto in qualunque modalità,
     mentre il grafico VUOTO continua a scorrere la pagina — ed è la prima prova di controllo.
     (c) «non mi fa premere le notizie sotto al grafico… mentre sul tablet con la penna sì».
     **Non era un bersaglio troppo piccolo** (il pallino ha raggio 13 px): era uno scontro fra due
     funzioni. Il mirino della pressione lunga scatta a 450 ms e si mangiava il rilascio, mentre la
     notizia si apriva solo sotto i 700 ms e 10 px. Un dito che prende la mira sta giù di più; la
     penna tocca e stacca in un lampo — da qui la differenza fra tablet e telefono. Misurato: un
     tocco di 900 ms con 12 px di scarto non apriva niente, uno istantaneo sì. Ora sopra un
     pallino il mirino si fa da parte, e la finestra del tocco è da dito (20 px, 1500 ms).
     (d) il mirino a pressione lunga: **in banco funzionava già**, anche con 6 px di sbandamento.
     Non ho trovato un difetto suo e non ne ho inventato uno: il «non funziona bene» si spiega con
     (a), perché è proprio il mirino lo stato che restava appeso. Resta una prova di controllo che
     lo guarda.
     **TEST:** `telefono_tocco_grafico.test.mjs`, 5 prove a 375 px con lo userAgent di un telefono,
     di cui 2 di controllo. Sul pubblicato: 3 rosse, i 2 controlli verdi da entrambe le parti.
  11. **Una cosa in piu' in questo giro:** il tetto giornaliero alle scritture cloud e la finestra
     del grafico allargata a 60 s (la bolletta Firestore — 250.000 letture e 122.000 scritture in
     un giorno, segnalate dal proprietario).
  12. **PERCHÉ LA v2.0.80 NON È MAI ARRIVATA — e perché la prima diagnosi era mia e sbagliata.**
     Parole sue: «ho premuto il tasto aggiorna e non mi ha chiuso l'applicazione, non mi ha fatto
     nulla, cioè è stato molto istantaneo».
     **PRIMA HO ACCUSATO IL POSTO SBAGLIATO, e il collaudo me l'ha detto.** Avevo cambiato il
     ripiego di `fblPianoAggiornamento` dandogli la colpa. Due test giusti sono andati rossi — un
     ponte vecchio deve comportarsi come ieri, e un programma che si aggiorna da solo non deve
     scaricare pacchetti — e avevano ragione loro: la misura sul suo computer diceva
     `{programma 2.0.79, pagina 2.0.80, da_aggiornare:true}`, cioè il ramo **preciso**, che il
     pacchetto lo chiede già. Il ripiego non c'entrava niente. Rimesso com'era, con scritto
     perché.
     **CAUSA VERA, più avanti nella catena:** la rotta `/aggiorna-programma` del ponte rispondeva
     `ok:true` in **due casi diversi** — «installazione avviata» e «il programma è già alla tal
     versione: non c'è niente da installare» — e l'app guardava solo `ok`. Nel secondo caso
     mostrava «installazione in corso, l'app si riavvia da sola», lasciava il velo bloccante sullo
     schermo e non succedeva niente. Istantaneo, e senza fare nulla. Un esito vero detto in modo
     ambiguo è peggio di un errore: l'errore almeno si vede.
     **CURA:** il ponte ora risponde anche `avviato`, e la logica sta in una funzione sola
     (`aggiorna_programma_dettaglio`) con la vecchia forma `(esito, messaggio)` come guscio di una
     riga — otto punti del progetto la chiamano ancora così. L'app dice «installazione in corso»
     solo se qualcosa è partito; con un `avviato:false` togli il velo, riaccende il pulsante e
     riporta il motivo detto dal ponte. Un ponte **vecchio** non manda `avviato`: lì vale la
     regola di prima, o un aggiornamento partito davvero finirebbe a scaricare anche il pacchetto
     a mano.
     **TEST:** `aggiorna_niente_da_fare.test.mjs` (3 prove, 2 di controllo: quando parte davvero
     il velo resta; col ponte vecchio vale la regola di ieri) e 3 prove nuove in
     `test_aggiorna_programma.py` (di cui una di controllo sulla vecchia firma a due valori).
     Provati nei due sensi sul pubblicato: 1 rossa su 3 nel browser, 2 su 3 in python, i controlli
     verdi da entrambe le parti.
  **Collaudo:** browser 1132 prove, 1131 verdi, 0 rosse (1 saltata); python 212 verdi. Due rosse del primo giro erano
  mie (vedi il punto 12) e sono state curate alla radice, non silenziate.
  **NON solo `app.html`:** cambia anche `installer_build/build/bridge.py` (la rotta
  `/aggiorna-programma` ora dice se l'installazione e' partita). Serve il pacchetto nuovo
  installato una volta a mano: il ponte della v2.0.79 non manda `avviato`, e fino a quel
  momento vale la regola di compatibilita'.

- 2026-11-03 — Claude — **v2.0.80: ordini pendenti in tre tabelle, il conto MT5 che si muove
  mentre backtesti non lo fa più in silenzio, e la riga del prezzo che non va più a gradini**.
  1. **PRIMA RICHIESTA, parole del proprietario:** «in modalità replay, facciamo in modo di creare
     due tabelle distinte per gli ordini pendenti. Ordini pendenti MT5 e ordini pendenti storico.
     La tabella ordini pendenti storico deve essere visualizzata soltanto quando siamo in modalità
     replay e modalità backtest attiva.»
     **COM'ERA:** una tabella sola (`#pendingOrdersTbl`) con dentro tutto — gli ordini simulati di
     tutte e 4 le sessioni e quelli reali del conto MT5 — distinti solo da un'icona 🖥️. Le
     POSIZIONI erano già divise in due riquadri da tempo: gli ordini pendenti no.
     **ORA** sono tre, con le STESSE colonne (così la riga si legge uguale ovunque e il generatore
     è uno solo): `#pendingOrdersTbl` i simulati normali, `#mt5PendingTbl` tutto ciò che vive sul
     conto reale (tracciato in app o piazzato a mano nel terminale), `#replayPendingTbl` quelli
     nati dentro al replay.
  2. **DOMANDA POSTA, risposta fissata:** fuori dal replay gli ordini nati nel replay **non si
     vedono da nessuna parte** (scelta esplicita: si rivedono rientrando). Dentro al replay con la
     modalità backtest SPENTA restano però nella tabella normale, altrimenti diventerebbero
     invisibili proprio mentre li stai usando — è la prova di controllo del test.
  3. **UN DETTAGLIO TROVATO STRADA FACENDO:** il CSS delle cifre a larghezza fissa puntava a
     `#pendingOrdersBody`, un id **che non è mai esistito** (il tbody si chiama
     `#pendingOrdersTbl`). La tabella degli ordini pendenti è rimasta senza le cifre monospazio
     da sempre. Corretto, e ora vale per tutte e tre.
  4. **SECONDA RICHIESTA:** «se sono in modalità storico, replay, della sezione MT5, se mi si
     chiudono delle posizioni sotto, in background, o mi si aprono, il suono dell'ordine eseguito
     me lo deve fare comunque. E mi mostra una notifica soltanto quando sono in modalità replay
     che la posizione X si è chiusa, dove specifica se è manuale o di una specifica sala, il
     profitto in euro e in percentuale, il prezzo raggiunto e il numero del TP.»
  5. **CAUSA MISURATA, non supposta.** Il suono viveva ATTACCATO all'adozione: `playOrderSound()`
     sta dentro il ciclo che aggiunge la posizione reale a `positions[]`, e la chiusura suona
     dentro la riconciliazione, che gira solo su `positions` della sessione A SCHERMO. Quindi:
     (a) in **modalità backtest** le posizioni MT5 non vengono adottate affatto (scelta del 27
     ottobre, «devono sparire dal grafico») → niente adozione, niente suono; (b) in sessione
     **Storico** le posizioni reali vengono dirottate nella sessione Live gemella e quel ramo non
     ha mai suonato, e una loro chiusura non viene nemmeno notata finché resti in Storico.
  6. **CURA.** Gli avvisi non dipendono più dall'adozione: `fblAvvisiMt5Giro()` guarda la
     **fotografia grezza** di `/positions`, giro per giro. Prima fotografia = base silenziosa
     (altrimenti all'avvio suonerebbe una volta per ogni posizione già aperta); ticket nuovo =
     apertura; ticket sparito **due giri di fila** = chiusura, e solo dopo che `/deal_reason`
     conferma un deal vero (stessa prudenza della riconciliazione: un giro di polling sfortunato
     non deve annunciare una chiusura che non c'è stata). Quello di cui si è già occupata la
     strada ordinaria lo **dichiara lei** (`fblMt5Annunciato`), così non si suona due volte.
     **La modalità backtest resta pulita come richiesto il 27 ottobre: qui non si adotta e non si
     disegna niente — solo suono e avviso.**
  7. **L'AVVISO.** Un cartellino in basso a destra (`#fblAvvisiReplay`) più la notifica di sistema
     della via unica (`fblNotificaMostra`). Il cartellino serve: mentre backtesti la finestra è in
     primo piano, e in quella condizione il sistema operativo spesso ingoia la notifica. Dice
     sala-o-manuale, lato, asset, lotti, euro, **percentuale del saldo** (scelta del proprietario:
     è la stessa del Trade Journal, quindi i due numeri coincidono sempre), prezzo di uscita e
     numero del TP. Il numero del TP si scrive **solo** se è davvero un target ad aver chiuso:
     metterlo su uno stop loss direbbe una cosa falsa.
     Il testo è costruito da una funzione sola (`fblAvvisoChiusuraMt5Mostra`) usata dalle due
     strade: anche nel replay con la modalità backtest SPENTA — dove la posizione è adottata e
     passa dalla riconciliazione — il cartellino compare, altrimenti nel caso più comune non si
     sarebbe mai visto.
  8. **TEST NUOVI, provati nei due sensi.** `pendenti_tre_tabelle.test.mjs` (3 prove, compresa la
     prova di controllo «con la modalità backtest spenta non diventano invisibili»): senza la cura
     **3 rossi**, con la cura 3 verdi. `avvisi_mt5_replay.test.mjs` (4 prove, due di controllo —
     fuori dal replay suona ma non mostra niente; un ticket già annunciato non suona due volte):
     senza la cura **3 rossi su 4** (il quarto è un controllo che passa anche nel vuoto, ed è
     giusto così).
  9. **Regressione:** ordini_pendenti_in_replay + pendenti_scattano_in_replay +
     replay_posizioni_mt5_reali + replay_mai_ordini_veri + famiglia_asset + gruppi_be_chiudi +
     gruppi_striscia + kraken_posizioni + orario_esecuzione + replay_conto_storico = **45 verdi**.
  10. **TERZA RICHIESTA, nella stessa seduta:** «la riga tratteggiata del prezzo reale con la
      relativa etichetta sull'asse dei prezzi arriva in ritardo, l'aggiornamento va a scatti, non
      è uguale a quello delle candele»; poi, chiarendo: «è un ritardo di aggiornamento, la segue
      bene, è solo che la velocità di aggiornamento della candela è più veloce della velocità di
      aggiornamento della riga del prezzo».
      **MISURATO PRIMA DI TOCCARE** (app vera, canvas agganciato, cinque prezzi su un 5 minuti):
      riga e candela erano **già incollate** — Y della riga 552,4 contro corpo che finisce a
      552,4; 396,6 e 396,6; 595 e 595. Quindi NON era uno sfasamento di posizione: il problema
      era la **cadenza**, come poi ha confermato il proprietario.
      **CAUSA.** I tick arrivano più volte al secondo ma l'app li MEMORIZZA soltanto
      (`lastMt5TickPrice` / `lastPrimaryEpicPrice`): l'unico punto che li scriveva nella candela e
      ridisegnava erano i due timer da UN SECONDO. Un secondo si vede a occhio.
      **CURA, con la cadenza scelta dal proprietario fra quattro strade: 250 ms.** Un timer
      LEGGERO a parte (`fblPitturaPrezzoFine`) che fa solo due cose — applica l'ultimo tick alla
      candela in corso e ridisegna. **Non** si è abbassato il timer esistente: dentro quello ci
      sono anche le chiamate REST di ripiego, i cani da guardia, la valutazione di stop e target,
      il salvataggio e `update()` (~21 ms misurati sulla macchina del proprietario). Portare
      TUTTO a 250 ms è la strada che in passato ha prodotto i «Non risponde».
      Tre guardie che contano: `allowNew:false` (una candela nuova la apre solo il timer del
      secondo, l'unico che sa distinguere un tick vero da un prezzo ripetuto), niente lavoro a
      prezzo fermo, e niente del tutto in replay e a scheda nascosta.
      **UN EFFETTO COLLATERALE DA NON PERDERE:** con il pennello che scrive per primo,
      `applyLivePriceToChart` nel timer del secondo può restituire `false`, e la rete di sicurezza
      (`if(touched)` -> evaluate + checkPendingOrders + scheduleSave) sarebbe stata **saltata
      proprio quando il prezzo si è mosso**. Da qui `touched||__pitturaApplicata` nei due timer.
  11. **E la riga si ancora alla candela DISEGNATA**, non più a `rows[idx].close` scelto per
      indice (`__chiusuraDisegnata`, segnata dentro il ciclo delle candele). Non cambia la
      cadenza — serve a rendere impossibile per costruzione che si scollino. Il caso dove
      divergevano davvero, misurato: a mercato chiuso riga a 105,9 contro ultima candela a 105,4.
  12. **COSTO MISURATO** (600 candele, 80 a vista, 8 posizioni, senza footprint né indicatori):
      un giro di pennello **0,46 ms**, un giro del secondo con `update()` 1,45 ms. Tre giri in
      più al secondo = circa **+1,4 ms al secondo**. Con footprint e indicatori accesi costerà di
      più: il numero sopra è un pavimento, non un tetto.
  13. **TEST NUOVO:** `prezzo_pennello_fine.test.mjs`, 4 prove (3 di controllo: non apre candele
      nuove, in replay non tocca niente, a prezzo fermo non ridisegna). Provato nei due sensi:
      spegnendo il pennello la prova della cadenza diventa **rossa** (un solo cambio al secondo),
      con il pennello è verde (almeno 3). Regressione prezzo/candele: replay_live + replay_fluido
      + mercato_chiuso + chiusura_mercato + chiusura_mercato_prestazioni = **26 verdi**.
  14. **QUARTA RICHIESTA, e il proprietario l'ha marcata «molto importante»:** «quando sono
      collegato a un conto e apro una posizione, a mercato o pendente, e poi faccio lo switch di
      un altro account MT5, l'ultima posizione aperta nel conto precedente mi riporta i parametri
      del TP e del SL sul nuovo account. Quando cambio account deve fare un refresh. Anche quando
      si aprono posizioni automatiche su più conti rimane in memoria l'ultima posizione a
      grafico: una volta che finisce di aprire, i parametri si resettano.»
      **CAUSA MISURATA.** `refreshTradeLevelUI()` riempie le caselle SL/TP quando c'è una
      posizione selezionata, ma **non le svuota mai** quando quella sparisce — c'è scritto
      apposta, perché di solito contengono la bozza del prossimo ordine. Al cambio conto
      `mt5AttivaConto()` mette da parte le posizioni dell'altro conto e azzera `active`, ma le
      caselle, le linee trascinabili (`tradeSLLine`/`tradeTPLine`) e l'anteprima
      (`previewTradeLevel`) restano con i numeri del conto lasciato: sul conto nuovo erano lì,
      pronti a diventare un ordine vero.
      **CURA.** `fblResetParametriOrdine()` azzera tutto ciò che è *in composizione* — le cinque
      caselle, le due linee trascinabili, l'anteprima, le due bandierine SL/TP automatiche e
      l'ordine pendente evidenziato — e **non tocca nulla di ciò che è già aperto**.
      Agganciata in `mt5AttivaConto()`, che è il punto dove passano TUTTE le strade che cambiano
      conto (tendina, login a mano, riconnessione, giro automatico sui più conti dei segnali),
      perché è chiamata da `connectToMt5Bridge()`, l'unica porta del `/connect`.
      **La condizione è «cambiato», non «collegato»** (`precedente&&precedente!==ora`): al primo
      collegamento non si butta via la bozza che l'utente sta scrivendo, che non viene da nessun
      altro conto. È la prova di controllo numero 1.
      **E anche a fine apertura automatica**, in `tgAutoApriQui()`: un'apertura automatica sul
      conto GIÀ collegato non cambia conto, quindi il reset del cambio conto non scatterebbe e
      stop e target di quel segnale resterebbero nelle caselle.
  15. **TEST NUOVO:** `conti_reset_parametri.test.mjs`, 4 prove di cui **3 di controllo** (stesso
      conto = la bozza resta; la posizione vera non viene cancellata e torna ricollegando il suo
      conto; sparisce anche l'anteprima disegnata). Provato nei due sensi: senza la cura **2
      rosse su 4**, con la cura 4 verdi. La prima prova controlla anche il BANCO (le caselle
      devono partire piene), altrimenti misurerebbe il vuoto.
      Regressione: conti_automatici + dashboard_conti + conti_chiusi +
      ordini_pendenti_in_replay + pendenti_tre_tabelle = **26 verdi**.
  16. **IL NUMERO DI VERSIONE E' CAMBIATO STRADA FACENDO, ed e' andata come temuto.** Questo
      giro e' stato scritto su un ramo a parte mentre OpenCode lavorava su `main`, e nel
      frattempo lui ha pubblicato dalla **2.0.74 alla 2.0.79**: la 2.0.74 l'ha presa lui. Questo
      lavoro e' quindi la **2.0.80**, riportato sul nuovo `main` con un rebase. `app.html` si e'
      fuso da solo senza un conflitto: gli unici due conflitti erano i numeri di versione in
      `sw.js` e in `installer.iss`, risolti alzandoli a 2.0.80.
  17. **DUE TRAPPOLE SUI BYTE, pagate due volte in questo stesso giro.** Su questa macchina
      `core.autocrlf` e' **true**: un `git add` normale toglie il ritorno a capo Windows da ogni
      riga di `sw.js` (che nel repo e' tutto CRLF), e produce un diff di **805 righe** per una
      parola cambiata. `cervello/DIARIO.md` invece ha a capo **misti** (3635 righe CRLF su 4266)
      e git lo lascia stare, ma un giro di riscrittura con python lo appiattisce tutto a LF:
      diff di **7376 righe** per una voce aggiunta. Tutti e due vanno ricostruiti dai byte di
      `main` e aggiunti con `git -c core.autocrlf=false add`. Successo anche DOPO il rebase, che
      ha rigiocato il commit originale: va ricontrollato ogni volta, non una volta sola.
      Controllo rapido prima di consegnare: `git diff --stat main..HEAD` deve dire numeri
      piccoli. Se dice migliaia di righe su file che hai appena sfiorato, e' questo.

  18. **LE FRECCE DOPPIE E I TASTI DELLA TASTIERA, segnalati DUE volte (1 e 3 novembre) e
      ancora rotti sulla v2.0.79.** Il 1° novembre la riga doppione era stata messa a
      `display:none` NELL'HTML e il test lo confermava... guardando la pagina APPENA APERTA. Ma
      TRE punti del codice la rimettevano a `grid` appena l'interfaccia si aggiornava (uscita
      dalla finestra separata, `updateLiveReplayUI`, `updateLiveModeUI`). Misurato riaprendo
      l'app: doppione VISIBILE sia in Storico sia in Live col replay. Ora i tre punti chiamano
      `fblDoppioneFrecceVia()`, che nasconde e basta.
      I tasti: `handleChartArrowNav` partiva con `if(liveModeActive)return;`, quindi in Live col
      replay ACCESO non muovevano niente mentre i pulsanti a schermo sì (misurato: Storico
      50->51, Live+replay 50->50). Ora la guardia è `liveModeActive && !liveReplayActive`, e i
      tasti **delegano a #next/#back** invece di rifare la logica: prima ne esisteva una seconda
      versione, simile ma non uguale, a cui mancava `broadcastChartTimeSync()` — muovendosi da
      tastiera le ALTRE finestre non seguivano.
  19. **LA LEZIONE, ed è la più importante di questo giro.** Un test che guarda solo la pagina
      APPENA APERTA non sorveglia niente: `frecce_replay_navigate` era verde mentre il
      proprietario il doppione lo vedeva, foto alla mano. Ora lo stato si misura DOPO aver fatto
      girare `updateLiveModeUI()`/`updateLiveReplayUI()`. E `replay_live.test.mjs` **pretendeva**
      la riga doppione visibile (`rigaAvanti:true`): codificava come giusto proprio il difetto.
      Rinominato in `rigaDoppioneNascosta` e invertito, tenendo l'asserzione sulle frecce vere
      (`frecce:true`) così la modifica non può diventare il permesso di farle sparire tutte.
  20. **L'AGGIORNAMENTO CHE FA CRASHARE L'APP.** Parole del proprietario: «quando aggiorno,
      l'applicazione mi dà NON RISPONDE e crasha: chiude, installa, riapre, e c'è qualche
      servizio che rimane ancora attivo dall'istanza precedente».
      **CAUSA, e non è una supposizione: è scritta in `bridge.py` (~riga 519) da chi ha
      costruito il custode** — «`_ferma_custode_mt5_feed()` PRIMA di spegnere il servizio, O IL
      CUSTODE LO RIACCENDE». Il custode è il thread che fa rinascere `Mt5FeedServer.exe` appena
      la porta 8001 tace. `ChiudiProgrammi` in `installer.iss` uccideva nell'ordine SBAGLIATO:
      prima SegnaliBridge, poi Mt5FeedServer, e **solo alla fine il ponte**. In quella finestra
      il custode era vivo e faceva RINASCERE il servizio dati, che sopravviveva al padre e
      restava orfano con la porta 8001 in mano. Dopo l'installazione il servizio NUOVO non
      riusciva più ad aprirla: l'app partiva e non trovava i dati.
      **CURA da tutte e due le parti:** `aggiorna_programma()` spegne custode, servizio dati e
      ponte dei segnali PRIMA di lanciare l'installer (best-effort: se fallisce, l'installer
      parte comunque — è una prova di controllo); `installer.iss` chiude il PADRE per primo e
      sostituisce lo `Sleep(1500)` alla cieca con `ProcessoVivo()` + fino a 10 giri di verifica,
      perché taskkill torna appena ha CHIESTO la chiusura, non quando è avvenuta.
  21. **IL PANNELLO «AGGIORNAMENTO IN CORSO»**, chiesto nella stessa segnalazione: «non far
      continuare l'utilizzo dell'applicazione, perché se no l'utente fa una cosa e intanto parte
      l'installazione». Un velo a tutto schermo che si alza al PRIMO istante — prima di
      qualunque attesa di rete, perché il momento pericoloso comincia col clic — si mangia i
      clic e non si chiude con Esc. **Non resta appeso per sempre:** sulla strada dove l'app
      sopravvive (pacchetto da installare a mano) compare il motivo e un pulsante per tornare a
      lavorare, più una rete di sicurezza a cinque minuti.

  **Collaudo:** collaudo completo del browser **1095 prove, 0 rosse**; collaudo python **201
  verdi**. Sette prove nuove, tutte provate nei due sensi (il difetto rimesso le fa diventare
  rosse): `pendenti_tre_tabelle`, `avvisi_mt5_replay`, `prezzo_pennello_fine`,
  `conti_reset_parametri`, `aggiornamento_pannello`, più tre in `frecce_replay_navigate` e tre
  in `test_aggiorna_programma.py`.
  **ATTENZIONE ALLA PUBBLICAZIONE:** `installer_build/build/bridge.py` è cambiato, quindi
  **serve un Setup nuovo** — il push da solo non basta (tabella di `cervello/PUBBLICARE.md`).
  Finché l'utente non installa il Setup nuovo, l'aggiornamento si comporta come prima.

- 2026-11-03 — OpenCode — **v2.0.72 PUBBLICATA: colori della posizione MT5, e ordine etichette/linee**.
  1. **SINTOMO.** «Sulle posizioni col conto MT5 attivo viene aggiunto il testo MT5 accanto al
     buy/sell dentro al grafico e sono tutti di colore giallo, invece deve essere di colore blu
     come era in precedenza e il testo MT5 non deve essere presente. Le frecce di apertura, se
     in buy verde e se in sell rossa.» E: «la linea evidenziata passa sopra all'etichetta e
     invece deve passargli sotto, l'etichetta in primo piano e la linea in secondo.»
  2. **COLORI: DECISIONE ROVESCIATA** (era il contrario dal 1° novembre, quando fu chiesto che
     la posizione reale si distinguesse). Domanda posta al proprietario con due strade, risposta
     A - "esatto come prima": ambra via, tesserino "MT5 " via, linea ed etichetta tornano a
     `sideColor` (verde BUY / rosso SELL), freccia blu (BUY) / rossa (SELL). Nessuna regola
     speciale per la posizione reale: si disegna come tutte le altre.
  3. **ORDINE DI DISEGNO.** Il separatore tratteggiato dell'entrata stava DOPO le etichette
     Target/Stop dentro `drawTpSlZoneBox`: con la posizione selezionata passava sopra la scritta.
     Spostato in testa alla funzione. Misurato sull'ordine reale del disegno: prima etichetta TP,
     etichetta SL, linea entrata - dopo: linea entrata, etichetta TP, etichetta SL.
  4. **RESTO APERTO, e non va perso:** la cura 3 chiude il caso "linea sopra l'etichetta della
     STESSA posizione". Il proprietario ha confermato che il caso suo e' quello. Resta il caso
     FRA posizioni DIVERSE (linea della selezionata sopra l'etichetta di un'altra): richiede una
     seconda passata nel ciclo delle posizioni - tutte le linee prima, poi tutte le etichette -
     ed è un lavoro a sé.
  5. **TEST:** `replay_posizioni_mt5_reali.test.mjs` riscritto nel senso nuovo, provato nei due
     sensi (rosso senza la cura, verde con). Regressione `etichette_tp_sl` +
     `etichette_raggruppate` + `clic_sul_grafico` = 14/14 verdi.

  **Collaudo:** locale `Falliti: 0` sui file toccati; su GitHub **verde**; release v2.0.72
  **con Setup + installer_build.zip + APK**.
  **Commit:** le due cure e il test, poi la versione 2.0.72.

- 2026-11-03 — OpenCode — **v2.0.71 PUBBLICATA: lo stato del mercato lo dice MT5, per ogni
  strumento** (basta orario fisso).
  1. **SINTOMO, parole del proprietario:** "ogni asset apre e chiude in fasce orarie diverse.
     NZD/CAD in questo momento il mercato e' aperto. E in realta' mi dice che il mercato e'
     chiuso e che apre tra 17 minuti a mezzanotte. Ed e' impossibile perche' sul terminale MT5,
     ma si vede anche dall'aggiornamento delle tabelle delle posizioni aperte, che il mercato e'
     aperto. Perche' il PL live si aggiorna di quell'asset. Quindi questa cosa va corretta."
  2. **CAUSA MISURATA.** `statoMercato()` e `fblMercatoFermoOra()` decidevano l'apertura con una
     schedule FISSA (chiusura alle 22 di Roma, uguale per tutti). Cosi' uno strumento che chiude
     alle 23 risultava chiuso alle 22, e uno che chiude alle 21 risultava aperto fino alle 22.
     MT5 invece lo sa, simbolo per simbolo.
  3. **CURA.** Il ponte (`mt5_feed_server.py`, rotta `/symbol-check`) ora restituisce anche
     `trade_allowed` e `trade_mode`, letti da `mt5.symbol_info`: `trade_allowed` e' vero solo
     quando il mercato di quel simbolo e' davvero aperto. L'app ha una cache per asset
     (`fblMercatoMt5Cache`), riempita da `fblMercatoMt5Domanda()` che gira da sola ogni 30
     secondi in Live con MT5 collegato; `statoMercato()` e `fblMercatoFermoOra()` la leggono
     PER PRIME: se MT5 dice APERTO, l'app non dice chiuso, qualunque cosa dica l'orario fisso.
  4. **DA CHIARIRE IL PERIMETRO.** Senza risposta di MT5 (primo avvio, ponte che non risponde,
     cache piu' vecchia di 10 minuti) resta ESATTAMENTE l'orario fisso di prima: al peggio
     l'app si comporta come adesso. La cura non cambia niente finche' MT5 non ha parlato.
  5. **TEST NUOVO:** `laboratorio/app/mercato_stato_mt5.test.mjs`, 3 prove — il difetto (MT5
     dice aperto e l'app deve smettere di dire chiuso) piu' DUE prove di controllo (MT5 dice
     chiuso -> resta chiuso; nessuna risposta -> resta l'orario fisso). Provato nei due sensi:
     senza la cura ROSSO (`true !== false`: il grafico restava fermo), con la cura VERDE.
  6. **Nota sul pacchetto.** Il ponte e' cambiato: serve il Setup nuovo (tabella di
     `cervello/PUBBLICARE.md`: `installer_build/build/mt5_feed_server.py` -> Serve un Setup
     nuovo, NON il server). Finche' l'utente non installa il Setup nuovo, `/symbol-check`
     risponde senza `trade_allowed` e l'app continua con l'orario fisso — non si rompe nulla.
  7. **Regressione:** mercato_chiuso + chiusura_mercato + chiusura_mercato_prestazioni +
     sorgente_live = 14/14 verdi.

  **Collaudo:** locale `Falliti: 0` sui file toccati; su GitHub **verde**; release v2.0.71
  **con Setup + installer_build.zip + APK**.
  **Commit:** la cura e il test, poi la versione 2.0.71.

- 2026-11-03 — OpenCode — **v2.0.70 PUBBLICATA: la scala dell'interfaccia non viaggia piu' tra i
  dispositivi** (ognuno tiene la sua).
  1. **SINTOMO, parole del proprietario:** "è rimasto ancora il problema che se sono su un
     dispositivo mobile ed eseguo quello che è lo zoom dell'intera impaginazione, quindi della
     scala, me la va a modificare anche su tutti gli altri dispositivi collegati. Invece no, deve
     essere una cosa indipendente tra dispositivo e dispositivo... se lo imposto sul tablet, la
     scala rimane soltanto per il tablet. Se lo imposto per il PC, rimane soltanto per il PC.
     Assolutamente no, non deve funzionare in questo modo."
  2. **CAUSA MISURATA.** La scala UI (`fbl_ui_scala_pct`) era dentro il canale delle PREFERENZE
     sul cloud, in quattro punti:
     (a) `fblScalaUiSalva()` salvava in locale e poi chiamava `pubblicaPreferenze()`, quindi la
         scala saliva sull'account a ogni cambio;
     (b) `fblSyncPrepara()` la metteva nel documento (`scala`) da pubblicare;
     (c) `fblSyncRicevi()` la riscriveva nel magazzino del dispositivo che la riceveva;
     (d) `applicaPreferenzeDalCloud()` la applicava alla pagina appena arrivata.
     Risultato: cambiarla sul telefono la cambiava dappertutto.
  3. **CURA.** La scala esce dal canale cloud in tutti e quattro i punti: si salva solo nel
     magazzino del dispositivo, non si pubblica, non si accetta, non si applica dal cloud.
     Watchlist e ricerche salvate continuano a viaggiare come sempre (sono scelte dell'account,
     non dello schermo) — il canale non è stato spento, svuotato della sola scala.
  4. **TEST.** `laboratorio/app/sync_preferenze.test.mjs` riscritto nel senso nuovo (12 prove,
     compresa "cambiare la scala sul telefono NON la cambia sul PC") e
     `laboratorio/app/sync_impostazioni.test.mjs` con la prova invertita. Provato nei due sensi:
     senza la cura i test esistenti erano ROSSI sulle asserzioni che esigevano il viaggio della
     scala (`doc.scala` e `getItem(FBL_UI_SCALA_KEY)`), con la cura sono verdi.
  5. **Regressione:** `scala_ui.test.mjs` (la scala dell'interfaccia continua a funzionare in
     locale: salvataggio, limiti 10-150%, gesti, grafico che si riadatta) verde, e
     `zoom_dispositivo.test.mjs` (lo zoom dell'asse prezzi, gia' per dispositivo da prima) verde.

  **Collaudo:** locale `Falliti: 0` sui file toccati; su GitHub **verde**; release v2.0.70
  **con Setup + installer_build.zip + APK**.
  **Commit:** la cura e i test, poi la versione 2.0.70.

- 2026-11-03 — OpenCode — **v2.0.69 PUBBLICATA: nel replay un order block si mitiga SOLO quando
  il mercato ci torna davvero** (basta look-ahead sugli indicatori).
  1. **SINTOMO, parole del proprietario:** "in modalita' replay, l'indicatore order blocks,
     quando avanziamo, ci fa vedere che l'order block e' gia' stato mitigato, invece no, deve
     risultare mitigato soltanto quando il mercato ci torna in quella zona, come se fosse un
     order block che si genera in tempo reale e poi il mercato, quando ci torna su quell'order
     block, allora viene mitigato. Non puo' essere mitigato appena si forma. Deve seguire la
     stessa logica identica della modalita' reale. Importantissimo. Questo per fare backtest e'
     super super importante."
  2. **CAUSA MISURATA.** Il calcolo degli indicatori e' INCREMENTALE: `compute()` riparte da
     `st.builtTo+1` e arriva a `upToIdx`, e `st.builtTo` veniva azzerato solo se cambiava
     l'array `rows` o i parametri. Nel replay l'array `rows` e' sempre lo STESSO storico, quindi:
     avanzando fino alla candela della mitigazione la zona si segnava mitigata; tornando
     INDIETRO, `upToIdx` diventava piu' piccolo di `builtTo`, il ciclo `for(i=builtTo+1;
     i<=upToIdx; ...)` NON girava affatto e la zona RESTAVA mitigata, con l'indice del tocco
     futuro. Cioe': nel replay si vedeva una mitigazione che deve ancora avvenire. Per un
     backtest e' guardare nel futuro - il difetto peggiore possibile.
  3. **CURA.** Nella condizione di reset dell'incrementale, aggiunta la terza possibilita':
     `|| upToIdx<st.builtTo`. Se il replay chiede una candela PRECEDENTE a quella gia' calcolata,
     si butta tutto e si rifa' da zero fino a `upToIdx`. La zona ridiventa VIVA finche' il
     mercato non ci torna davvero; riavanzando, la mitigazione ricompare da sé (non e' stata
     "spenta", e' rimessa al posto giusto).
  4. **CURA APPLICATA A TUTTA LA CLASSE DI DIFETTO**, non solo all'OB, perche' avevano
     esattamente lo stesso schema: Order Blocks, FVG (Buyside/Sellside Liquidity + Aligned
     FVGs), Support & Resistance with Breaks, ICT Reversal Setup, EMA. Tutti gli indicatori
     incrementali, quindi, non mentono piu' nel replay.
  5. **TEST NUOVO:** `laboratorio/app/ob_replay_mitigazione.test.mjs`, 2 prove - il difetto
     (tornando indietro la zona ridiventa viva) e la PROVA DI CONTROLLO (riavanzando si
     rimitiga da sola, quindi non si e' semplicemente spenta la mitigazione).
     Provato nei due sensi: senza la cura ROSSO (`true !== false`: la zona restava mitigata),
     con la cura VERDE.
  6. **Nota su una strada che NON ho preso:** invertire il calcolo (togliere una mitigazione
     quando si torna indietro) sarebbe stato piu' "efficiente" ma molto piu' fragile: la
     mitigation di una zona puo' dipendere da decine di candele, dal run dell'impulso, dallo
     stato dei pivot. Rifare da zero e' un giro su poche candele e non puo' sbagliare.

  **Collaudo:** locale `Falliti: 0` sui file toccati; regressione indicatori 13/13 verde
  (order_blocks, ob_sparisce, ob_sync, indicatori_nascosti, ob_replay_mitigazione);
  su GitHub **verde**; release v2.0.69 **con Setup + installer_build.zip + APK**.
  **Commit:** la cura e il test (un commit), poi la versione 2.0.69.

- 2026-11-02 — OpenCode — **v2.0.68 PUBBLICATA: in replay i segnali eseguono ordini REALI sul
  conto MT5, in background** (decisione del proprietario, che ribalta quella del 26 ottobre).
  1. **Cosa cambia.** In `tgEseguiSegnale` (`app.html` ~34613) `reale` era
     `!!mt5Connected&&sessioneLive&&!liveReplayActive`: in replay valeva falso, quindi ogni
     segnale diventava una posizione finta. Ora `reale` non guarda piu' il replay.
  2. **La guardia stava alla porta, ed è stata tolta di la'.** In `fetchMt5WithTimeout`
     (~36152) c'era un blocco unico su TUTTE le rotte che scrivono (`p.startsWith('/order')`).
     Toglierla riapre il trading dal replay con UNA modifica invece di sette funzioni su dieci
     da allineare a mano. Le letture non sono mai state toccate.
  3. **E l'apertura non si interrompe piu' a meta'.** Nel ramo simulato c'era
     `if(currentAssetKey!==sym){...break;}`: se il grafico guardava un altro asset il ciclo si
     fermava a meta' — esattamente il "apre alcune posizioni e non le altre" segnalato. Ora
     prosegue: l'ordine porta con sé il SUO simbolo. Verificato che il percorso con conto reale
     (`senzaGrafico=true`) non tocca `currentAssetKey`: l'apertura in background lascia il
     grafico dov'è, quindi il replay resta punto e il conto non si sposta.
  4. **PERCHE' SI PUO' FARE:** il percorso a conto reale passa da `senzaGrafico`, che lancia
     gli ordini in batch con `sym` esplicito e non ha bisogno del grafico. Il ramo simulato
     (senza MT5) resta com'era.
  5. **TEST:** `laboratorio/app/replay_mai_ordini_veri.test.mjs` riscritto nel senso nuovo —
     6 prove, di cui 3 prove di controllo (letture, fuori-replay, rotte non-scriventi).
     Provato nei due sensi col metodo del progetto: rimessa la guardia diventa ROSSO
     (3 rossi), tolta diventa VERDE (6 verdi).

  **DECISIONE ROVESCIATA, DA NON PERDERE.** Il 26 ottobre 2026 il proprietario aveva richiesto
  il contrario, espresso allo stesso modo: «in modalità replay le posizioni non vengono aperte
  nell'account storico, ma vengono aperte sull'account MT5. Non può essere» — e la guardia alla
  porta nasce da li'. Il 2 novembre ha rovesciato: **i segnali che arrivano durante il backtest
  devono ESEGUIRE SUL CONTO REALE**. Conferma esplicita ottenuta sul rischio di ordini reali in
  background. Se un domani qualcuno "sistema" la cosa al contrario, questo è il motivo per cui
  non deve farlo.

  **Collaudo:** locale `Falliti: 0` sui file toccati; su GitHub **verde**; release v2.0.68
  **con Setup + installer_build.zip + APK** (i flussi ci pensano da soli, come da regola).
  **Commit:** la cura e il test, poi la versione 2.0.68 (quattro commit, ognuno con il suo
perche'). Le modifiche a `app.html` **e** `sw.js` sono in coppia con `installer.iss`:
se `sw.js` non saliva di numero, telefono e tablet non avrebbero mai ricevuto la cura.

- 2026-11-03 — OpenCode — **Le barre dell'istogramma SVP/COB si toccano, non sono piu' a
  strisce** (stessa seduta della v2.0.68, curata prima di pubblicare).
  1. **SINTOMO, con le foto del proprietario:** "zoomata, zoom out, la colonna SVP le candele
     vengono disegnate bene, mentre invece se le ALLARGHIAMO... sono piu' distanti le candele
     una tra l'altra, non ci sono candele che riempiono lo spazio, sono spazi vuoti...
     devono comunque esserci delle candele una attaccata all'altra, non possono essere separate."
  2. **CAUSA MISURATA:** `barH` era `Math.max(1,yBot-yTop-1)` e il disegno partiva da
     `yTop+0.5`: **un pixel e mezzo di stacco per barra**, uno tolto dall'altezza e mezzo
     aggiunto dallo scostamento. Su un istogramma stretto quei 1,5 px non si notano; con le
     barre ALLARGATE (`barSizePct` alto, il caso delle foto) ogni fascia mostrava un solco
     chiaro e l'istogramma sembrava a strisce invece che continuo.
  3. **CURA:** `barH` torna a essere `yBot-yTop` (tutta la fascia) e il disegno parte da
     `yTop`, non da `yTop+0.5`. Stessa cura sull'Order Book Profile, che disegna sulla
     stessa griglia di prezzo (righe 17800-17801).
  4. **ONESTA' SULLA PROVA:** ho provato a scrivere un test misurando il canvas e i
     rettangoli che il disegno lascia, e **non sono riuscito a farlo diventare rosso senza
     la cura**: misurava il vuoto (la colonna che trovavo era il bordo del grafico o il
     crosshair, non l'istogramma). Un test che non distingue cura da difetto non prova
     niente, quindi l'ho **cancellato** invece di pubblicarlo verde. La cura e' nell'app, ma
     la sua prova automatica **manca**: chi riprende il lavoro la deve costruire partendo dai
     rettangoli veri che l'app lascia in `vpIndBarRects` per i profili degli INDICATORI
     (`vpind_<id>_<chiave>`), non per i disegni manuali.
  5. **Regressione controllata:** `cob_svp_scala` + `asse_prezzi_zoom` + `memorie_disegno`
     = **10/10 verdi**, compreso "le righe sono attaccate: niente pixel di stacco".

- 2026-11-02 — OpenCode — **v2.0.67 PUBBLICATA: il filtro "mercato chiuso" non cerca piu' su
  ogni candela** (causa del "non risponde / crasha alla riapertura").
  1. **CAUSA MISURATA, non supposta.** A mercato chiuso `getVisibleData()` chiamava
     `fblMercatoFermoOra(currentAssetKey,t)` per OGNI candela visibile. Ogni chiamata costruisce
     il calendario dello strumento (`orariIntervalli`: dieci giorni, dieci
     `Intl.DateTimeFormat` per fuso) e cerca la riapertura su `4*24*60` minuti. Con una fascia di
     candele che sta PRIMA della chiusura — il caso vero, mercato chiuso alle 22 e candele fino
     alle 22 — il ciclo non si interrompeva mai: **tanti calendari quante candele**, nello stesso
     giro di disegno, e il thread principale si bloccava.
  2. **Un secondo costo, sullo stesso percorso:** `orariScartoZona()` creava un
     `Intl.DateTimeFormat` nuovo a ogni chiamata — centinaia di formattatori per frame.
  3. **CURA.** `orariScartoZona`: il formattatore si tiene in cache per fuso. `getVisibleData`:
     la fascia visibile e' ordinata per tempo e, da quando il mercato chiude, resta chiuso fino in
     fondo, quindi **il punto di taglio si cerca su meta' fascia** (`log2` delle candele, non le
     candele) col predicato invariato `fblMercatoFermoOra`. Resta lo scorrimento linea per linea
     solo nel caso rarissimo di candele senza data.
  4. **PRIMA STENTA SBAGLIATA, da non ripetere:** avevo aperto la cura prendendo la chiusura dal
     calendario Capital.com (`iv[i][1]<=adesso`) e poi confrontando i timestamp. È rosso: quel
     calendario è in UTC, mentre la schedule MT5 e' sulle 22 di Roma, quindi tagliava all'ora
     sbagliata (80 candele invece di 20). La ricerca su metà fascia usa lo STESSO predicato di
     prima, quindi il punto di taglio non puo' cambiare.
  5. **TEST NUOVO,** `laboratorio/app/chiusura_mercato_prestazioni.test.mjs`: conta quanti
     calendari si costruiscono durante UNA singola `getVisibleData()` e controlla che il filtro
     tagli ESATTAMENTE dove tagliava prima. Provato nei due sensi, come richiede il metodo: col
     metodo di prima è **rosso** (23 calendari per 80 candele, limite 11), con la cura è **verde**
     (8). Senza la prova di controllo (`visti < presenti`) il test sarebbe passato anche senza
     filtrare niente — misurava il vuoto.

  **ERRORE MIO, DA NON RIPETERE MAI (costa due giri):** avevo creato a mano il tag e la release
  `v2.0.66` **senza allegati** (nessun Setup, nessun APK) mentre `sw.js` dichiarava ancora
  `2.0.65`. Conseguenze viste dal proprietario: sul tablet *"aggiornamento non riuscito, nessun
  pacchetto disponibile per questa piattaforma"*, sul PC il pulsante Aggiorna che non conclude
  mai. Avevo anche pushato di colpo TUTTI i tag (`git push origin --tags`), compreso un vecchio
  `salvataggio-v104`, facendo partire flussi su un commit vecchissimo. **Le release le costruisce
  e pubblica il flusso GitHub a ogni push su `main`**: non si creano a mano, e mai vuote.

  **Collaudo:** locale `Falliti: 0` (mercato_chiuso + chiusura_mercato + replay_live +
  frecce_replay_navigate + il nuovo test); su GitHub **verde**; sito pubblicato; release v2.0.67
  con Setup + installer_build.zip + **APK** (verificato: `releases/latest/download/...`
  risponde **200 OK**).
  **Commit:** `66f01a6` (cura + test + versione 2.0.67), `d85092d` (commento del test allineato).

- 2026-10-28 — Claude — **v2.0.37 PUBBLICATA: la prop firm misura i limiti come FTMO**.
  1. **Il limite giornaliero era sulla base sbagliata**, in TRE funzioni (`checkPropFirmRules`,
     `pfMt5Metrics`, `fblPropDedicataConta`). FTMO: 5% del CAPITALE INIZIALE, limite fisso in
     euro, e ogni giorno si azzera solo il riferimento. Noi: 5% del saldo di apertura del giorno.
     Sbagliava nei due sensi — su 10.000 cresciuti a 10.800 concedeva 540 invece di 500
     (passavano giornate che FTMO boccia), su 9.500 ne concedeva 475 (bocciava giornate buone).
  2. **Il massimo totale delle sale era dal PICCO**, ma il two step FTMO e' STATICO al 10% sotto
     il capitale iniziale: un conto salito a 10.900 e tornato a 9.800 risultava violato pur
     essendo il 2% sotto il versato.
  3. **8 test nuovi, 5 rossi prima.** Gli 11 esistenti passano identici — ed e' la spiegazione
     di come l'errore sia sopravvissuto: i loro numeri cadevano dalla stessa parte con tutte e
     due le formule. (Lezione 17.)
  4. **Quarto caso dei gesti**, che mancava: pagina normale + due dita. Controprova fatta
     rompendo apposta `_paginaNormaleGrafico()`: il test diventa rosso.
  5. **Riparato un test che falliva solo sotto carico** e bloccava la pubblicazione: il finto
     cloud di `cloud_incrementale` aveva 5 dei 12 metodi che l'app usa, e nel collaudo completo
     un timer faceva in tempo a chiamarne uno inesistente. Primo tentativo sbagliato: `ready`
     messa come funzione mentre e' una promessa. (Lezioni 19 e 20.)

  **Collaudo:** locale `Falliti: 0`; su GitHub **verde**; sito pubblicato; release v2.0.37 creata.
  **Commit:** `76bc41e` (correzioni + test), `4c83230` (versione 2.0.37).

  **⚠️ LASCIATO APERTO E IMPORTANTE:** la release 2.0.37 **non ha l'APK**, quindi
  `index.html` → `releases/latest/download/forexbacktestlab.apk` da' **404 adesso**. Verificato
  che l'APK e' Capacitor e si porta dentro tutto il sito (`CACHE_NAME` 2.0.36 dentro il
  pacchetto): copiare quello vecchio NON risolve, darebbe ad Android un'app bloccata che si
  dichiara da aggiornare e scarica se' stessa. Il progetto Android non e' nel repo, quindi
  l'APK va ricostruito a mano e allegato alla release. Vedi `cervello/BUG.md`.

  Un flusso "Installer Windows" risulta fallito: due build in corsa hanno provato a creare la
  stessa release e la seconda ha perso (`a release with the same tag name already exists`).
  Innocuo, ma evitabile: non lanciare `gh workflow run installer.yml` subito dopo un push, che
  lo fa partire gia' da solo.

- 2026-10-28 — OpenCode — CAPITOLO GRAFICO CHIUSO (replay + etichette + gesti + modalità backtest):
  1. **Etichette TP/SL raggruppate per LINEA DI PREZZO**: la regola era l'identità dell'intera
     casella, quindi due posizioni riempite in istanti diversi non coincidevano mai (misurato:
     4 posizioni sullo stesso target davano 4 etichette sovrapposte). Aggiunto il raggruppamento
     per riga di pixel, con Target e Stop contati separatamente; solo il "capo fila" scrive
     l'etichetta, la linea del livello resta per tutte.
  2. **Il click col mouse sull'etichetta non faceva niente** (doppia causa: il toggle era solo nel
     ramo touch, e l'etichetta ×N è disegnata dentro la striscia dell'asse prezzi, quindi il mouse
     finiva nello zoom verticale). Ora l'etichetta ha la precedenza sullo zoom e mouse/penna fanno
     come il dito. La ricomposizione al click sul vuoto ora ridisegna sempre.
  3. **Gesti**: pagina normale → 1 dito scorre la pagina, 2 dita spostano il grafico; schermo
     intero e finestra staccata/PIP → 1 dito sposta il grafico (prima non era possibile: il
     pointermove del ramo touch usciva subito), 2 dita fanno ZOOM ISOLATO per asse.
  4. **MODALITÀ BACKTEST nel replay**: pulsante «🧪 Modalità backtest» tra «Nuova posizione» e lo
     STOP; accesa, le posizioni dell'account MT5 non vengono caricate (filtro sul punto di adozione,
     non un nascondiglio) e a grafico entra solo ciò che si apre da lì in poi; nuovo disegno con
     freccia, linea al prezzo del momento e prezzi di apertura/chiusura; rettangolino «Modalità
     backtest attiva» sopra il posto del riquadro «mercato chiuso» (non si sovrappongono) con
     l'informazione al passaggio del mouse; stesso interruttore in Impostazioni → 🔁 Replay.
  5. **Disegni**: verificato che NON si spostano (ancorati a timestamp assoluto + prezzo),
     corretto il commento che descriveva il comportamento vecchio, e aggiunto il test che mancava
     sul cambio di asset. Resta annotato: il tipo `vpfixed` cambia il proprio p2.time al cambio di
     timeframe (scelta dichiarata nel codice, non un difetto).
  13 nuovi test (3 etichette, 4 gesti, 4 modalità backtest, 2 disegni) — collaudo app 913 test,
  0 fallimenti — commit 0da4c5b + 3dd2237 (v2.0.36)

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

## 21 ottobre 2026 - v2.0.12: il cambio giornata non ti prende più di sorpresa

### Da dove nasce: una domanda del proprietario a cui la prima risposta era sbagliata

Aveva mandato due grafici a confronto, il nostro e quello di MT5: «il mercato non ci è arrivato a
0,92830, è andato nel senso opposto fino a 0,9247. È più di una volta che mi succede».

La prima diagnosi (la riscansione dello storico che confronta uno stop spostato col passato) era un
difetto **vero**, ed è stato corretto — ma **non spiegava quel caso**, e lui l'ha fatto notare:
«questo però come fa a chiuderlo anche sul terminale MT5? MT5 dovrebbe essere indipendente
dall'applicazione». Aveva ragione: `evaluate()` e la riscansione escludono entrambe le posizioni
reali (`mt5Ticket`), quindi l'app non chiude mai una posizione MT5.

Ha chiesto di verificare sul web. Dal web **non si poteva**: nessuna fonte pubblica ha il minuto, e
tutte pubblicano il **bid**. Si poteva dal suo MT5, e ci sono voluti due tentativi: la spunta
«Mostra linea Ask» disegna solo una riga al prezzo di adesso (istruzione sbagliata, data da me);
lo storico vero sta in **Simboli → Ticks**. Da lì sono usciti i numeri che hanno chiuso la
questione:

```
2026.10.21 00:00:42.091   bid 0,92461   ask 0,92961   ->  50,0 pip
2026.10.21 00:01:28.613   bid 0,92598   ask 0,92903   ->  30,5 pip
2026.10.21 00:03:17.229   bid 0,92463   ask 0,92963   ->  50,0 pip
```

Cinque tick in cinque minuti, con lo spread **250 volte** il normale (0,2 pip). Lo stop era a
0,92827: l'ask lo ha superato di 13 pip. Il bid dello stesso tick è 0,92461, cioè esattamente il
«minimo di 0,9247» che aveva visto. **Lo spike verso il basso e la chiusura a 0,92827 non sono due
cose diverse: sono lo stesso tick.**

Nessun difetto, né dell'app né di MT5: lo stop di una vendita si esegue sull'ASK, e i grafici
disegnano il BID. Non si può impedire al broker di eseguire — si può **non farsi trovare lì**.
(Da sapere: il conto è su MetaQuotes-Demo, server dimostrativo generico. 50 pip su EURCHF non è un
numero da broker vero: l'evento è più violento del reale, la meccanica è identica.)

### Le quattro cose fatte, più quella chiesta dopo

**1. Avviso prima della chiusura.** Un quarto d'ora prima, se ci sono posizioni con lo stop dentro
la forbice del rollover, lo dice: messaggio di stato **e notifica del browser**, perché a quell'ora
la scheda è in secondo piano. Una volta sola per ogni chiusura (se martellasse si smetterebbe di
leggerlo); niente se lo stop è lontano, se si è in Storico o se non ci sono posizioni.

**2. La forbice si misura, non si indovina.** Il dato passa davanti all'app a ogni tick: ora lo
guarda nella mezz'ora attorno a una chiusura e si ricorda **il peggio visto** per asset (non la
media: serve a dire «il tuo stop è dentro», e conta quella larga). Due dettagli non ovvi: la misura
sta **prima** della strozzatura dei 5 secondi, perché al rollover i tick sono rarissimi e scartarne
uno vuol dire perdere proprio la misura che serve; e dopo due mesi il valore scade, perché
parlerebbe di un altro mercato. Finché un rollover non si è visto si usa una stima **dichiarata**
(venti volte lo spread normale, minimo 10 pip): sul caso misurato darebbe 20 contro 50, cioè
sbagliata per difetto — prudente nella direzione giusta, avvisa di meno e non di più.

**3. Il pareggio lascia lo spread.** Due delle tre posizioni di quella notte avevano lo stop a
**0,92827 contro un'entrata di 0,92828**: un decimo di pip. Lo metteva lì il nostro pareggio, e il
commento nel codice diceva pure che lo spread era stato tolto apposta «perché ne usciva un piccolo
guadagno». Ma lo stop di una vendita si esegue sull'ask: un pareggio esatto sta **dentro** la
forbice, e al primo allargamento viene preso di certo. Ora lo stop sta un margine pari allo spread
più in là. Corretto **dentro `mt5PrezzoPareggio`**, da cui passano tutti e cinque i punti che
portano uno stop a pareggio (a mano, dalla strategia, al raggiungimento di un TP, in blocco,
dal ticket MT5): correggerne uno solo avrebbe lasciato gli altri quattro col difetto. Aggiornati
anche i messaggi che dicevano «profitto netto 0,00», che adesso sarebbe falso.

**4. Lo spread nella simulazione.** Una vendita si chiude comprando all'**ask**. Prima la
simulazione confrontava stop e target delle vendite col bid: rifacendo quella notte in backtest non
sarebbe successo niente, cioè il simulato risultava migliore del reale **proprio nei momenti
peggiori**. Applicato nei tre punti che valutano gli stop (`evaluate`,
`evaluateLiveBackgroundAsset`, `scanHistoricalSlTpTouches`) con **una funzione sola**
(`fblSpreadUscita`) perché non possano divergere.
Quello che resta fuori, detto invece che nascosto: si modella lo spread sull'**uscita delle
vendite**, non sull'**entrata degli acquisti** (che in simulazione entrano al prezzo del grafico).
In Modalità Prop Firm l'entrata lo spread ce l'ha già, quindi lì il giro è completo; fuori, la
simulazione resta ottimista sugli acquisti **quanto lo era prima** — non di più. Chiuderlo sposta
l'entrata di tutti i backtest passati: è una decisione del proprietario, non una correzione.

**5. Chiusura automatica prima della chiusura** (richiesta dopo l'analisi): vedi la voce
precedente — strategia universale e di ogni sala, solo posizioni in guadagno, spenta di predefinito.

### Un test rosso che era giusto fosse rosso

`gruppi_be_chiudi.test.mjs` pretendeva lo stop di pareggio **esattamente sull'entrata**: è
precisamente ciò che non si fa più. Aggiornato alla regola nuova, mantenendo quello che davvero
misura (ogni stop sul pareggio della SUA posizione, non un valore unico per il gruppo) e scrivendo
nel commento perché il numero atteso è cambiato.

**E un segnale da non ignorare:** per il punto 4 è caduto **un solo** test. Vuol dire che il
collaudo copriva poco la valutazione degli stop sulle **vendite** — il lato che ha fatto perdere i
soldi. I quattro test nuovi coprono quel buco.

### Test
`rollover_spread.test.mjs` (8: misura della forbice, stima dichiarata, pareggio col margine,
avviso), `spread_uscita_vendite.test.mjs` (4). Collaudo locale 5/5 verdi, 0 falliti.

### Versioni
- sw.js: forex-backtest-lab-v2.0.12
- installer.iss: 2.0.12

## 21 ottobre 2026 - v2.0.13: capitolo 2 chiuso, e tre cose che il proprietario ha segnalato mentre si lavorava

### 1. Il collaudo interrompeva il collegamento MT5 del proprietario ⭐

**Segnalato:** «mentre modifichi non mi chiudere e aprire il terminale MT5, perché quasi per ogni
modifica che fai mi interrompi il processo di collegamento con MT5, e quindi devo stare sempre a
installare i pacchetti aggiuntivi per far ripartire l'applicazione».

**La causa, trovata guardando il banco e non il codice dell'app.** `aiuti.mjs` bloccava tutte le
richieste **HTTP** (`pagina.route`) tranne `file://` — ma **non i WebSocket**: Playwright li
instrada a parte. E l'app, appena parte, ne apre verso il feed MT5 (porta 8001) e verso il ponte
dei segnali (8769), che sul computer del proprietario sono **vivi e attaccati al suo terminale**.
Un collaudo intero apre la pagina centinaia di volte: centinaia di connessioni e disconnessioni
sul ponte che in quel momento gli stava eseguendo gli ordini.

**La correzione.** Il `WebSocket` viene sostituito con uno finto *prima* che la pagina parta
(`addInitScript`): non si connette mai, e l'app non se ne accorge perché il caso «stream che non
si aggancia» lo gestisce già. Verificato dal vivo: nessuna connessione, zero errori di pagina.
LA REGOLA: un collaudo non deve poter toccare niente fuori da sé. Bloccare l'HTTP non basta, se
restano aperti altri canali.

### 2. Il pulsante «Aggiorna» che non si spegneva

**Segnalato:** «ho premuto aggiorna, mi ha reindirizzato alla pagina per scaricare il pacchetto,
eseguito il download, sono tornato all'applicazione, l'ho riaperta, ma il tasto aggiorna era
sempre presente. Ho dovuto premere il pulsante in basso "aggiorna pagina" e solo allora l'ha
riconosciuta come aggiornata».

**La causa.** Installato il pacchetto nuovo, la pagina continua a essere servita dal service
worker **vecchio** finché non si ricarica: il pannello Versione legge il numero da quella copia,
quindi vede ancora la versione vecchia e tiene acceso il pulsante. Quella striscia in basso era
l'unica via d'uscita, e andava trovata.

**La correzione.** L'app si ricorda che l'aggiornamento **l'hai chiesto tu**
(`fbl_aggiornamento_atteso`): quando il service worker segnala che la versione nuova è pronta,
ricarica da sola. Negli altri casi resta la striscia da premere — ricaricare di nascosto mentre si
guarda una posizione aperta sarebbe peggio del problema che risolve.

### 3. «Spariscono pure gli asset watchlist» dopo l'aggiornamento

**La diagnosi, che cambia la natura del problema.** Non è una cancellazione. Il browser tiene un
magazzino **separato per ogni indirizzo**, e questa app si apre da **tre porte d'ingresso**: il
sito (`github.io`), il servizio locale che la serve su `127.0.0.1:8000` (vedi `bridge.py`), e
l'APK (`localhost`). Per il browser sono **tre applicazioni diverse**, ognuna con la sua
watchlist, le sue impostazioni e il suo collegamento alla cartella delle credenziali. Chi cambia
porta d'ingresso trova tutto vuoto — ma non ha perso niente.

**La cura, che funziona comunque.** Esteso il meccanismo di sincronizzazione che già esisteva
(`GRAFICO_LS`) invece di costruirne un secondo: ora seguono l'account anche le impostazioni del
**footprint** (stile e righe), i **profili degli indicatori**, i **decimali per asset**, le
**strategie delle sale**, **nomi e target delle sale** e i **periodi della dashboard**. Era anche
una richiesta esplicita: «con i dispositivi mobili devono essere ricordate tutte le configurazioni
di style, impostazioni footprint heatmap eccetera».

**L'altra metà della regola, ed è quella che si promette all'utente.** Credenziali, chiave del
ponte, numero di telefono, chiave e indirizzo del server **non** ci vanno: «le credenziali
rimangono sul dispositivo e non circolano online». C'è un test che diventa rosso se qualcuno
aggiunge una chiave del genere all'elenco, anche solo per comodità — un commento si ignora, un
test rosso no.

**Difetto trovato per strada.** La sincronizzazione accettava la scala dell'interfaccia solo fra
**70 e 150**, ma dalla v2.0.10 il minimo è **10** (chiesto: «sul telefono il 70% è troppo»). Una
scala al 30% scelta sul telefono non veniva mai pubblicata, e se arrivava da un altro dispositivo
veniva scartata **in silenzio**: nessun errore, semplicemente la scala non seguiva l'account.

### 4. Capitolo 2 — soldi e operazioni

**Una conferma sola per le chiusure multiple.** Il difetto non era nelle funzioni di blocco —
quelle una conferma la chiedevano — ma **dentro al ciclo**: `closeMt5PositionReal` apriva un popup
suo per OGNI posizione reale. Con le simulate non succedeva, ed è per questo che sembrava
capriccioso: si vedeva solo sul conto MT5 vero. Il pulsante CHIUDI TUTTE era messo peggio: non
chiedeva **nessuna** conferma complessiva e si appoggiava a quelle singole — il messaggio di stato
arrivava a dire «per quelle REALI su MT5, conferma la chiusura nel popup comparso», cioè il
difetto era scritto nell'interfaccia. Ora la domanda è una, dice quante sono e quanto rendono, e
dichiara che le posizioni di altri asset restano aperte. Il test ha scovato anche un errore di
lingua vecchio: con tre posizioni si leggeva «3 sono REALE».

**Operazioni a blocco su Kraken.** Chiudi tutte / in guadagno / in perdita / per lato / un
contratto alla volta, più lo stop a pareggio su tutte. Una conferma sola, e il pareggio manda
**l'entrata di ogni posizione**: un valore unico per tutte metterebbe lo stop di qualcuna dalla
parte sbagliata, chiudendola all'istante.

**Il conto segue l'asset.** Cripto → Kraken, forex/indici/azioni → MT5, e l'oro su MT5 pur essendo
una materia prima (stesso criterio di `fblFamigliaAsset`: due risposte diverse alla stessa domanda
sarebbero una trappola). Il cambio avviene **prima** di caricare lo storico, altrimenti l'asset si
carica due volte e per un istante si vedono le candele della fonte sbagliata. Funziona anche dai
pulsanti «vai a grafico», con una precedenza che va ricordata: **il conto della posizione vince
sempre su quello dell'asset** — una posizione aperta davvero su MT5 su BTC porta su MT5.

**Via «Operazione» dal riquadro a schermo intero.** Mostrava la prima posizione con accanto un
«(+3)», facendo credere che fosse LA posizione. Tolto anche il calcolo che la riempiva. Il P/L
live resta: quello è la somma di tutte.

### Resta aperto nel capitolo 2
**2.1, le aperture cripto su Kraken che falliscono.** Serve dal proprietario la frase che l'app
scrive sotto il segnale quando rifiuta: le cause possibili sono quattro (posizione opposta già
aperta, quota sotto il minimo dello strumento, quantità per TP sotto il minimo, stop rifiutato da
Kraken) e sono quattro correzioni diverse. Indovinare, su un punto che muove ordini, costa soldi.

### Test
`chiusura_una_conferma.test.mjs` (5), `kraken_blocco.test.mjs` (7), `sync_impostazioni.test.mjs`
(4), `conto_per_asset.test.mjs` (6). Collaudo locale 5/5 verdi, 0 falliti.

### Versioni
- sw.js: forex-backtest-lab-v2.0.13
- installer.iss: 2.0.13

## 21 ottobre 2026 - Capitolo 3: Syntra, caricamento del grafico, footprint in replay, e la causa misurata del freeze

### 1. Il pannello Syntra era in gran parte interfaccia morta ⭐

Il proprietario aveva segnalato quattro cose in una riga: «il robot non esegue più la scansione, il
programma mi dice di selezionare la cartella syntra ma non me la fa selezionare, in più mi viene
visualizzata la porta syntra ma a me non interessa, non mi fa più visualizzare nemmeno i nomi
utenti di syntra precedentemente inseriti».

**Tre cause diverse, tutte silenziose, trovate nel sorgente.**

**Gli utenti: una regressione.** Il contenitore `<div id="syntraUtentiList">` era stato
**cancellato** dal commit `31d9fe3` (quello dell'APK e della scheda Versione) — danno collaterale
del riordino delle schede. La funzione che lo riempie, `syntraUtentiDisegna()`, è rimasta e
continuava a essere chiamata, ma trovava `box` nullo e usciva alla prima riga. Nessun errore da
nessuna parte: semplicemente non compariva più niente. *Un contenitore che sparisce non rompe:
smette di mostrare.*

**La cartella: nata morta, e impossibile per costruzione.** Campo e pulsante «Scegli cartella»
erano stati aggiunti dal commit `229a16a` con NESSUN gestore. E quel pulsante non avrebbe mai
potuto funzionare: **un browser non conosce il percorso reale di una cartella**
(`showDirectoryPicker` restituisce un riferimento, non `C:\...`), quindi da lì non sarebbe mai
uscito un percorso da dare al ponte. Tolto il pulsante (prometteva l'impossibile), resta il campo
dove il percorso si **incolla**, e il ponte ha ora il modo di riceverlo: azione `cartella_syntra`
sul WebSocket — la stessa strada delle credenziali, che funziona anche quando l'app parla col ponte
attraverso il server, dove una chiamata a 127.0.0.1 non arriverebbe mai.
Due garanzie, con i test: si **unisce** a configurazione.json invece di riscriverlo (lì dentro ci
sono api_id e api_hash, e per riaverli si rifà tutto il giro su my.telegram.org), e una cartella
che non esiste si **rifiuta subito** invece di farla scoprire al prossimo avvio dell'emulatore con
un errore che parla d'altro. Gestite anche le virgolette di «Copia come percorso» di Windows: senza
toglierle si leggeva «la cartella non esiste» con la cartella sotto gli occhi.

**La porta: tolta.** Mostrata e mai letta da nessuno. Anche «Ricontrolla» era un pulsante senza
gestore: ora chiede davvero al ponte.

⚠️ Tocca il ponte: **richiede di ricostruire e reinstallare il Setup**.

### 2. Il grafico si copre finché i dati non sono quelli di quell'asset

«Non deve mai visualizzarsi il nome dell'asset se prima ancora non è stato caricato il grafico; la
rotellina continuerà a girare fin quando non è avvenuta l'esatta sincronizzazione.»

**Il difetto non era la lentezza.** Cambiando asset il nome nuovo compariva subito nel selettore
mentre le candele erano ancora quelle vecchie: si leggeva «EURCHF» sopra il grafico dell'oro. Non è
un ritardo, è **una cosa falsa scritta a schermo**, e in quei secondi ci si può decidere guardandola.

**La percentuale è vera.** Conta i tre passi davvero completati — storico arrivato → candele
ricostruite → prezzo agganciato — e non scorre da sola a tempo. Altrove in questo file c'è scritto,
giustamente, «senza barre di progresso inventate». Se un passo si pianta, la percentuale si pianta
lì: è un'informazione, non un difetto.
Tre cose tenute ferme dai test, perché sono i modi in cui un indicatore di caricamento fa danni: se
il caricamento **fallisce** il riquadro si toglie (altrimenti il grafico resta coperto e l'app
sembra bloccata); chiamarlo due volte **non crea due riquadri**; con il grafico staccato compare
**nella finestra PIP**, perché guarda dove vive `chartWrap` invece di indovinare — e alla fine si
toglie da entrambe le finestre, nel caso il grafico sia stato staccato mentre caricava.

### 3. Footprint in replay: era scritto nel codice ⭐

Uno dei «due pezzi grossi», mai affrontato. Non era un difetto di disegno: nel punto in cui la
candela si chiude c'era scritto

> «la candela e' completata: il buffer delta della formazione finita va perso»

e il buffer veniva azzerato (`replayForm=null`) senza che nessuno lo depositasse da nessuna parte.
Da fuori: il footprint cresce mentre la candela si forma e sparisce nell'istante in cui la candela
diventa vera.

Ora si deposita nella **stessa memoria delle candele vere** (`footprintByBucket`), con la stessa
griglia e le stesse celle. Tre scelte, con i test: si **somma** e non sovrascrive (in replay-Live i
tick veri continuano ad arrivare su quella candela, e sostituirli con quelli ricostruiti sarebbe il
contrario di ciò che serve); una candela **senza volume non crea un contenitore vuoto** (che farebbe
disegnare un footprint piatto invece di nessun footprint); e l'aggancio è provato **sul giro vero
del replay**, in **due** punti, perché la candela si completa per due strade diverse e dimenticarne
una avrebbe lasciato il difetto vivo ai moltiplicatori alti.

**Nota sul diario, e vale come lezione.** La voce del 19 ottobre dichiarava: «footprint persistente:
`replayFinalizzaFootprint` copia il footprint accumulato in `rows[idx].footprint`». **Quella
funzione nel file non c'era.** Il footprint delle candele completate in replay non è mai stato
salvato, nonostante il diario dicesse di sì — e nessuno dei 21 test del replay lo toccava.
*Una voce di diario non è una prova che una cosa esista: lo è un test.*

### 4. Il freeze: la connettività c'entrava, ma al contrario ⭐

«Dopo gli aggiornamenti l'applicazione inizia a laggare e scattare [...] ma io penso che sia un
problema a monte di connettività.»

**Misurato, con la pagina ferma e senza rete: 27 timer attivi, 77,6 risvegli al secondo.** E
**sessantasei** venivano da una sola funzione: `waitForFxbtCloud()` controllava **ogni 30
millisecondi** se Firebase fosse pronto, e smetteva solo quando arrivava. Senza rete Firebase non
arriva mai, quindi due attese restavano a battere **per sempre**, impedendo al browser di stare
fermo.

Il sospetto del proprietario era giusto, ma la direzione era l'opposta: **non è la rete lenta a far
scattare il grafico — è l'app che, quando la rete manca, si mette a girare a vuoto.**

Ora l'attesa parte veloce (30 ms, così all'avvio normale non si perde niente), **rallenta** fino a
mezzo secondo e dopo trenta secondi **si arrende** restituendo null. Tutti e quattro i punti che la
chiamano sanno già cosa fare senza nuvola — uno aveva perfino una corsa contro un timeout di 20
secondi, messa lì proprio perché questa poteva non tornare mai.

**Misurato dopo: 16,3 risvegli al secondo invece di 77,6. Il 79% in meno.**

Due misure su cosa NON è il problema, per non cercarlo dalla parte sbagliata: **30 cambi asset di
fila non lasciano dietro niente** (zero timer e zero ascoltatori in più: la perdita classica, su
quella strada, non c'è), e un disegno del grafico costa **0,01 ms**. Non è promesso che il freeze
sia sparito — quello che succede sul PC del proprietario con rete vera, MT5 collegato e sale attive
non è riproducibile sul banco — ma una causa misurata è stata tolta, ed era la più grossa.

### Test
`pannello_syntra.test.mjs` (6), `test_cartella_syntra.py` (5), `caricamento_asset.test.mjs` (5),
`replay_footprint.test.mjs` (5), `attesa_nuvola.test.mjs` (4),
`test_kraken_orario_apertura.py` (4). Collaudo locale 5/5 verdi, 0 falliti.
## 21 ottobre 2026 - Il pareggio è zero: un numero andato e tornato nella stessa giornata

### Quello che ho sbagliato, detto per primo ⭐

La mattina del 21 ottobre, per difendere lo stop dal cambio giornata, ho aggiunto al prezzo di
pareggio **un margine pari allo spread**. Il ragionamento sembrava buono: lo stop di una vendita si
esegue sull'ask, al pareggio esatto sta dentro la forbice, e il rollover lo prende. Tolto il
pareggio esatto, tolto il problema.

Il proprietario ha misurato il risultato in una riga: **«sposta le posizioni a break-even, ma
perdono ugualmente meno 2 euro»**.

Aveva ragione, e il difetto non era nei numeri: era nel **nome**. Un pulsante che si chiama
«pareggio» e lascia meno due euro non è una protezione con un piccolo costo — è un'etichetta che
mente. E un'etichetta che mente è peggio di una protezione in meno, perché chi la legge prende
decisioni basandosi su quella. La richiesta è arrivata esplicita: «bisogna fare in modo che
qualsiasi posizione viene spostata a break-even venga accertata che allo spostamento sia
effettivamente il risultato di 0 euro».

### La correzione: prezzo esatto, e il rifiuto dove non costa niente

Il margine è stato tolto. Il prezzo di pareggio è di nuovo quello esatto: distanza × valore del
punto = commissioni di **andata e ritorno** + swap già maturato, con l'arrotondamento al tick
sempre dalla parte di chi ha la posizione. Un test lo verifica **facendo il conto del conto**:
3 di commissione per lato, 2 di swap, valore punto 10000 → netto 0,00, e mai sotto zero.

La difesa dal rollover non è sparita: si è **spostata dove non costa niente**. Chi piazza lo stop di
pareggio adesso **si rifiuta** quando quello stop cadrebbe dentro la forbice fra compra e vendi
(`fblPareggioTroppoVicino`): non lo sposta, e **dice perché**. Il risultato è migliore del margine
in entrambi i modi che contano — il pareggio resta un pareggio vero, e lo stop che c'era prima è
**più lontano** di quello nuovo, quindi lasciarlo dov'è protegge di più che spostarlo.

È esattamente il caso misurato: due SELL EURCHF aperte a 0,92828 con lo stop a 0,92827 — un decimo
di pip — prese alle 00:00:42 quando lo spread si è aperto a 50 pip. Con il rifiuto, quello stop non
sarebbe mai stato messo lì.

### Tutte le strade del pareggio, non solo quella del pulsante

Il rifiuto è su **tutte e quattro** le strade da cui una posizione arriva al pareggio, perché
metterlo su una sola avrebbe lasciato il difetto vivo nelle altre e sarebbe stato peggio: una
protezione a metà fa credere di essere protetti sempre.

1. il pulsante nella tabella delle posizioni (`applyBreakevenToPosition`), da cui passa anche il
   **pulsante BE del gruppo**;
2. il pulsante BE nella tabella «Posizioni MT5», che parla col ponte e non ha un oggetto locale:
   lì il prezzo di chiusura si legge dal **preventivo vero** (un acquisto si chiude sul bid, una
   vendita sull'ask) invece di indovinarlo dal grafico;
3. la strategia delle sale quando il prezzo si avvicina al primo target;
4. la regola «stop all'entrata» al raggiungimento di un TP.

Nelle due automatiche il rifiuto è **silenzioso e si riprova da solo**: nessuno sta guardando, e al
giro dopo, se il prezzo si è allontanato, lo stop va a posto.

**Due cose sistemate di conseguenza, perché il rifiuto le avrebbe rese bugiarde.**
`applyBreakevenToPosition` adesso **dice se ha spostato o no**, e il pulsante del gruppo conta solo
quelle spostate davvero: altrimenti avrebbe annunciato «stop a pareggio su 5 posizioni» dopo averne
spostate zero. E il ricalcolo automatico che segue lo swap (lo stop si riaggiusta quando i costi
cambiano, per restare a zero) è stato **lasciato come era di proposito**: lì lo stop è già al
pareggio, e bloccarne l'aggiornamento quando il prezzo è vicino lo lascerebbe fermo su un pareggio
vecchio che non vale più zero — il contrario di quel che serve.

### Su Kraken il pareggio è il prezzo d'entrata, e adesso lo dice

Sulle posizioni Kraken lo stop a pareggio va sul prezzo di entrata e basta. La commissione dello
scambio **non arriva all'app posizione per posizione** (il ponte dà solo il totale del conto),
quindi metterla nel prezzo vorrebbe dire inventarsi un numero. Preferito scriverlo nella conferma:
«lo stop va sul PREZZO DI ENTRATA, la commissione dello scambio non è compresa». Un limite
dichiarato è utilizzabile; un limite nascosto dietro la parola «pareggio» no — è lo stesso errore
del margine, da un'altra porta.

### Test
`rollover_spread.test.mjs` cresciuto a 10: il conto netto a zero, il rifiuto sul caso EURCHF, e
soprattutto **il pulsante vero** — si chiama `applyBreakevenToPosition` e si guarda il campo `sl`
dopo, perché il modo in cui questa correzione potrebbe fallire sul serio è un rifiuto che lo stop
lo sposta comunque. `gruppi_be_chiudi.test.mjs` riportato al pareggio esatto, con scritto dentro
**perché il numero atteso è cambiato due volte**: un test che cambia valore senza spiegare perché
insegna solo a cambiarlo di nuovo.

### La lezione ⭐
**Quando una protezione costa, non si fa pagare al nome della cosa che protegge.** Il margine era
una risposta giusta alla domanda sbagliata: la domanda non era «come allontano lo stop dalla
forbice», era «quando NON si deve piazzare quello stop». La seconda si risolve senza togliere un
centesimo a nessuno.
## 21 ottobre 2026 - Capitolo 4: il telefono. Sei punti, e quasi tutti erano un numero scritto a mano

### Il metodo, prima dei difetti ⭐

Nessuno di questi sei punti è stato corretto guardando: sono stati **misurati**. Un piccolo banco
apre tutti e 24 i popup in una finestra da telefono, in quattro condizioni (375x812, 320x568,
orizzontale 812x375, e 375x812 con l'interfaccia al 130%), e per ognuno chiede due cose: di quanto
il riquadro esce dallo schermo, e di quanto il contenuto esce dal riquadro. Lo stesso per i gruppi
di pulsanti dentro il grafico.

È servito perché **l'impressione era sbagliata in entrambe le direzioni**: dove il proprietario
vedeva i popup uscire dallo schermo, a scala 100% non uscivano affatto; e dove il banco diceva
«nessuna sovrapposizione fra i pulsanti», sul telefono vero se ne vedevano.

### 1. I popup che escono dallo schermo: era la SCALA ⭐

«I popup non devono mai oltrepassare il bordo dello schermo (visto sulle strategie).»

A scala 100% non ne usciva nemmeno uno. **Al 130% sforavano di 117 px sotto il bordo e fino a 73
px di lato**, e i due che sforavano di più erano `tgAutoOverlay` e `tgConfigOverlay`: le finestre
delle **strategie**, esattamente dove lui l'aveva visto.

Il 117 non è un numero casuale, ed è quello che ha indicato la causa: `max-height:88vh` viene
calcolato sull'altezza vera della finestra e **poi** moltiplicato dallo zoom del body — 812 × 0,88
× 1,3 = 929, cioè 117 px oltre lo schermo. La scala dell'interfaccia è `zoom` sul body, e **nessuna
regola CSS può leggere lo zoom**: ora `fblScalaUiApplica` la scrive in una variabile (`--fblZoom`) e
i limiti dei popup ci dividono.

La seconda metà della causa stava nelle regole per telefono, che facevano l'opposto di quel che
promettevano: `width:95vw!important;max-width:none`. Il `95vw` moltiplicato per la scala fa il 123%
dello schermo, e `max-width:none` togliendo il limite lasciava anche crescere il riquadro oltre la
sua larghezza, spinto da una casella con una larghezza minima propria.

**Dopo: zero sfori in tutte e quattro le condizioni.**

### 2. Il testo che esce dal popup: 109 px, e le schede erano irraggiungibili ⭐

«Il testo non deve mai uscire dal popup (impostazioni e collegamento compresi).»

Due difetti, e il primo era **grave, non estetico**: la striscia delle schede delle impostazioni
(`.fbModalTabs`) sforava di **109 px**, senza andare a capo e senza scorrere. Le schede oltre il
bordo non erano brutte: erano **impossibili da premere**. Ora vanno a capo — e vanno a capo invece
di scorrere per un motivo preciso: *una riga che scorre, su un telefono, non si vede che scorre, e
le schede nascoste non le cerca nessuno.*

Il secondo era letteralmente la voce che lui ha nominato: **«🔌 Collegamento/Modalità»** è più larga
della colonna (132 px fissi) e aveva `white-space:nowrap`, quindi il testo finiva fuori dal popup —
43 px, misurati. Adesso va a capo: una voce su due righe si legge, una voce tagliata no.

**Quello che resta, detto perché non sembri dimenticato:** in tre popup una **tabella** (le sale, le
regole) è più larga dello spazio disponibile su uno schermo da 320 px — 389 px in 264. Una tabella
non si stringe sotto le sue colonne: ora **scorre dentro il popup**, invece di spingere il riquadro
fuori dallo schermo come prima.

**Un tentativo tolto perché peggiorava.** Annullare tutte le larghezze minime dentro i popup
(`min-width:0`) sembrava la pulizia giusta: ha portato gli sfori da 0 a 3 sullo schermo da 375 px.
Misurato, e rimesso indietro. *Una modifica «di buon senso» che non si misura è una scommessa.*

### 3. I popup troppo piccoli

«Quello della cronologia sale è troppo piccolo.» Sul telefono un popup si fermava all'88%
dell'altezza: su 812 px sono quasi cento pixel di schermo lasciati vuoti mentre il contenuto scorre
in uno spazio più piccolo del necessario. Sul telefono ora usa il **96%**.

### 4. La linea apertura↔chiusura con lo zoom largo ⭐

Il perché era scritto nel codice: la linea si disegnava solo se **almeno una delle due estremità**
era dentro la vista. Con lo zoom stretto sulle candele, un'operazione durata a lungo ha l'apertura
fuori a sinistra e la chiusura fuori a destra: nessuna delle due è a schermo, e il segmento che
attraversa tutto il grafico non veniva disegnato affatto. Il commento sopra diceva «SEMPRE
visibile», ma quel «sempre» parlava dell'hover.

Ora il segmento si **taglia sul riquadro** del grafico e si disegna il pezzo che si vede. Tagliare
non è un dettaglio: lasciando passare il segmento intero, il tratteggio finirebbe sopra la scala
prezzi e la barra del tempo. Il clic per selezionare un trade usa lo stesso pezzo tagliato, così
non si può selezionare un'operazione in un punto dove non si vede nessuna linea.

**Erano QUATTRO**, i punti con lo stesso difetto: trade chiusi, trade ancora aperto in replay-Live,
`drawOpenTradeProgress`, e le posizioni dell'altro conto. Correggerne uno avrebbe fatto credere che
il difetto fosse chiuso.

### 5. Via i cartellini TP/SL dalla scala prezzi

Su uno schermo da telefono quella striscia è alta pochi millimetri: con tre o quattro posizioni
aperte i cartellini diventavano una colonna di rettangoli uno sull'altro, che copriva i numeri della
scala — l'unica cosa per cui la scala serve. Resta l'**entrata** (una riga per posizione, ed è il
riferimento da cui si legge tutto il resto); target e stop restano sulle loro linee e nella casella
Target/Stop, col prezzo scritto.

**Un test è stato spostato, non aggiustato.** `replay_posizioni` spiava proprio quei cartellini per
verificare che in replay si disegnino i livelli DI ALLORA: con i cartellini via, sarebbe diventato
verde misurando il vuoto. L'intento è lo stesso, la spia si è spostata sulla casella Target/Stop,
che riceve gli stessi livelli dalla stessa fonte — e nel commento c'è scritto perché.

### 6. I pulsanti dentro il grafico, e una decisione che non era mia ⭐

Il banco diceva zero sovrapposizioni. Il motivo è che **nel banco metà dei gruppi è nascosta**
(barra del replay, legenda degli indicatori, barra degli strumenti): si vedono sul telefono vero, in
Live. E `qtAutoLayout` si scansava da **due gruppi su sei**.

Sotto, **tre numeri scritti a mano**, tutti con la stessa forma di errore — valgono finché le righe
sopra non crescono:
- `top:46px` nel markup per la seconda riga di pulsanti (vale se la prima sta su una riga: sul
  telefono va a capo e diventa alta 86 px, e la seconda le finisce **sopra**);
- `top:86px` nel CSS per la legenda degli indicatori;
- l'elenco fisso dei due gruppi da cui scansarsi.

Ora è una **pila calcolata** dall'alto, misurando.

**La decisione che ho chiesto invece di prendere.** La barra delle operazioni è 360 px; il grafico,
su un telefono, ne ha 309. Sulla stessa riga non ci stanno: qualcuno deve cedere il bordo alto, e
non è una cosa che si deduce dal codice. Il proprietario ha scelto: **barra in cima, pulsanti
ridotti a icone su una riga sola.**

Per farla diventare vera quella riga sola, i sei comandi chiedevano 388 px in 293 disponibili. Il
più largo era «🎲 DATA RANDOM» con la scritta (125 px): sul telefono resta la sola icona, e con il
selettore dell'asset accorciato il totale scende a 275 px. **Una riga sola vera** — tutti i comandi
si vedono e si premono — invece di una riga con dentro uno scorrimento che nasconde metà dei
pulsanti, che sarebbe stata la stessa trappola delle schede delle impostazioni.

### Test
`popup_bordi.test.mjs` (5), `grafico_pulsanti_telefono.test.mjs` (7),
`linea_apertura_chiusura.test.mjs` (3), `scala_prezzi_cartellini.test.mjs` (2), più
`replay_posizioni.test.mjs` spostato sulla casella Target/Stop.

**La verifica del rosso, su tutti.** Con il file di prima: 3 su 5 rossi per i popup, 4 su 4 per i
pulsanti, 3 su 3 per la linea, 1 su 2 per i cartellini. I test che sono rimasti verdi anche senza la
correzione sono le prove di controllo — e sono scritte per restare verdi.

### La lezione ⭐
**Un test che misura la finestra «come viene fuori dal banco» misura una situazione che sul telefono
non esiste.** Le sovrapposizioni dentro il grafico erano invisibili al collaudo perché i gruppi che
si sovrappongono, nel banco, sono spenti. La misura va fatta nella condizione del difetto — i gruppi
accesi, la scala al 130% — non in quella comoda.
## 21 ottobre 2026 - Capitolo 5: le credenziali non erano sparite

### La diagnosi, che ribalta il sintomo ⭐

«Quando segui l'aggiornamento mi succede che le credenziali di capital.com, MT5 e tutto quello che
c'entra con le credenziali spariscono, quindi vengono cancellate.»

**Non venivano cancellate, e non c'entrava l'aggiornamento.** Il file CSV è sempre rimasto nella
cartella scelta dall'utente, intatto. Quello che l'app perde a ogni riavvio del browser è il
**permesso** di leggere quella cartella: lo revoca il browser, per sua politica di sicurezza, e non
esiste modo di conservarlo — è lo stesso motivo per cui nemmeno un sito può tenersi l'accesso a una
cartella fra una sessione e l'altra.

Senza permesso l'elenco dei conti è vuoto. E un elenco vuoto, da fuori, si legge come
«cancellati». *Il sintomo era vero; la spiegazione che suggeriva era sbagliata.*

### L'asimmetria che costava la spiegazione

Il meccanismo per riconfermare c'era già (`fblChiediPermessoFile`, con il banner che dice il
motivo), ma:

- `getCapitalCredsDirHandle()` lo chiamava;
- **`getMt5CredsDirHandle()` tornava `null` e basta.**

Nessun errore, nessun banner, nessun motivo: i conti MT5 non si vedevano e non c'era niente da
leggere a schermo. Una dimenticanza di una riga, nel ramo più usato dei due.

### Quello che adesso c'è

Nella scheda Live delle impostazioni, dove la nota ha spazio per essere letta (il menu MT5 è un
tendina da pochi pixel: ci sarebbe stata una scritta tagliata, che è il difetto del capitolo 4):

**Lo stato vero delle due cartelle** — *collegata* / *da riconfermare* / *non ancora scelta*. Sono
tre situazioni che portano a tre azioni diverse (non fare niente, premere un pulsante, scegliere una
cartella): confonderle è il difetto, non la grafica.

**Un pulsante «🔓 Ricollega la cartella»**, che compare **solo quando c'è qualcosa da riconfermare**.
Offrirlo a chi non ha mai scelto una cartella prometterebbe una cosa che non può fare: premendolo
non succederebbe niente. E fa **due** cose, non una: riconferma il permesso *e* rilegge i conti —
senza la rilettura il permesso ci sarebbe ma l'elenco resterebbe vuoto fino al giro successivo, e
sembrerebbe che il pulsante non funzioni. È la metà che si dimentica.

**La nota sulla privacy**, che è la risposta alla domanda vera («dove finiscono le mie password»):
utente, password e server stanno in un CSV nella cartella scelta dall'utente, su quel computer; non
passano mai dal server, non vengono sincronizzati sull'account e non escono da lì nemmeno quando
l'app parla col ponte o col server remoto — che non le chiede e non le riceve. E dice anche
**perché sembrano sparite**, altrimenti il pulsante resta misterioso.

### Una verifica sul banco, prima di fidarsi del verde ⭐

Due dei cinque test, dove il browser non sapesse collegare una cartella, uscivano subito senza
verificare niente (`if (!supportsFS) return {salta: true}`). Un test così è verde anche quando la
correzione non c'è: misura il vuoto. Controllato nel banco: **`supportsFS: true`**, il ramo di
uscita non scatta mai e tutte le asserzioni girano davvero.

Verifica del rosso: con il file di prima **5 test su 5 rossi**.

### Test
`cartella_credenziali.test.mjs` (5): i tre stati distinti, il pulsante che compare solo quando
serve, il ricollegamento che riconferma **e** rilegge, la nota con le due frasi richieste, e
getMt5CredsDirHandle che non torna più muto. Collaudo completo: 0 falliti.

### La lezione ⭐
**Un elenco vuoto non è un dato cancellato.** Prima di credere al sintomo («le credenziali
spariscono») conviene chiedersi che cosa, esattamente, è andato perso: qui non il file, ma il
permesso di leggerlo. La differenza cambia tutto — una perdita di dati si ripara reinserendo, un
permesso si ripara con un clic, e dirlo all'utente vale più di qualunque correzione.
## 21 ottobre 2026 - v2.0.15: il tappo che bloccava tutto, e due cause misurate

### Il difetto che nascondeva gli altri ⭐⭐

Per mezza giornata il proprietario mi ha segnalato difetti che erano **già corretti e pubblicati**:
la conferma unica sulle chiusure a blocco, il riquadro di caricamento che resta fino a fine
sincronizzazione, lo stesso riquadro nella finestra PIP. Ogni volta ho verificato sul tag
pubblicato invece di fidarmi, e ogni volta la risposta era la stessa: **lui descriveva fedelmente
la versione che aveva in mano.** Era fermo alla v2.0.12.

La causa non era il meccanismo web, che è fatto bene (`updateViaCache:'none'`, controllo ogni
mezz'ora, ricarica automatica se l'utente ha premuto «Aggiorna»). Era **il ponte**: aperta
dall'icona del desktop, la pagina non viene dal sito — la serve `bridge.py`, e la serviva da
`sys._MEIPASS`, cioè la cartella temporanea dove PyInstaller estrae i file **congelati dentro
l'eseguibile al momento della compilazione**.

Quella copia è immutabile per costruzione. Il service worker, il pannello Versione e il pulsante
«Aggiorna» lavoravano tutti su un file che nessun aggiornamento web poteva toccare: l'unico modo
di aggiornare era reinstallare il Setup. Da qui «ogni aggiornamento non arriva», «dice che
aggiorna e poi la versione non cambia», «devo reinstallare il pacchetto».

**Ora il ponte scarica `app.html` e `sw.js` dal sito** in una cartella scrivibile e serve quella
copia. Tre regole, perché un aggiornatore che sbaglia è peggio di nessun aggiornatore:

1. **La coppia o niente.** I due file si sostituiscono insieme: `sw.js` porta il numero che il
   pannello legge, quindi un `app.html` nuovo con un `sw.js` vecchio terrebbe «Aggiorna» acceso
   per sempre — *lo stesso difetto segnalato, da un'altra porta*.
2. **Mai indietro.** Una versione più vecchia (cache di un proxy, rollback) non sostituisce quella
   installata: retrocedere l'app di chi la sta usando sarebbe un danno fatto dall'aggiornatore.
3. **Si controlla che sia davvero l'app.** Su GitHub Pages una pagina «404» arriva con HTTP 200.

Senza rete resta la copia installata: l'app parte sempre. E `/health` adesso **dichiara** quale
versione sta servendo e da dove — il difetto più lungo di questo progetto è stato un utente che
usava una versione vecchia senza saperlo.

### Il grafico che «salta a marzo»: una moltiplicazione senza tetto ⭐

«Ho cambiato il timeframe da un'ora, sono passato a un minuto, siamo il 21 di ottobre, mi è andato
al 12 marzo. In maniera proprio totalmente casuale.»

**Non era casuale.** La regola era «conserva la stessa finestra di tempo reale»: sensata in
apparenza, ma da 1h a 1m moltiplica per 60. Misurato su uno storico come quello di un conto MT5
vero (marzo → oggi), partendo da una vista a 1h:

| Candele su 1h | Candele di 1m dopo il cambio | Bordo sinistro |
|---|---|---|
| 60 | 3.600 | 19 ottobre |
| 600 | 36.000 | 26 settembre |
| 2.000 | 120.000 | 30 luglio |
| 5.000 | **300.000** | **27 marzo** |

E sotto il primo difetto, un secondo: **il centro non veniva rispettato.** `viewEnd` restava
incollato all'ultima candela (misurato: 321.870 in tutti e cinque i casi), quindi la finestra era
ancorata a destra e il bordo sinistro scappava indietro di mesi.

La cura: un **tetto** legato ai pixel disponibili — oltre quel punto una candela è più sottile di
un pixel e non significa niente. Sotto il tetto la finestra di tempo si conserva esattamente come
prima (e un test tiene fermo che 1m → 5m non cambi di una virgola); sopra, si tiene il centro.
In più: se si stava guardando il **bordo live**, lì si resta — il centro di una vista che finisce
«adesso» è mezza finestra fa, e riportarcisi lascerebbe l'ultima candela fuori schermo proprio a
chi guardava il prezzo di adesso.

Applicato a **tutte e cinque** le strade che ricalcolano la finestra, non a una. Misurato dopo:
1.234 candele invece di 300.000, centrate dove si stava guardando. Lo stesso numero spiega la
lentezza al cambio timeframe segnalata a parte.

### Chi si prende un clic sul grafico: una regola per tre difetti ⭐

Tre segnalazioni diverse, una causa sola.

- «Mi seleziona in automatico una posizione senza che io tocchi nulla.» La parte che *nascondeva*
  le altre era già stata staccata da `active`, ma **l'enfasi** (linea spessa, grassetto) era
  rimasta legata ad `active`, che l'app riassegna da sola in cinque punti — fra cui l'apertura e
  la chiusura automatica di una posizione da una sala segnali.
- «Se tocco fuori deve deselezionare, anche sopra un indicatore: l'indicatore è un oggetto solo di
  visualizzazione.» Due guardie lo impedivano: la **casella Target/Stop** (un rettangolo
  dall'entrata fino ad adesso, che copre mezzo grafico) e gli **indicatori** del profilo volumi.
- «Il cambio stile del footprint non può avere bug.» La stessa casella Target/Stop aveva la
  precedenza su tutta la sua area; la tolleranza del tocco era quella di un mouse (10 px, 700 ms)
  e non di un dito; e c'erano **due meccanismi per lo stesso gesto, di cui uno morto**.

**La regola, scritta una volta per tutte e tre:** un bersaglio **sottile e mirato** si prende il
clic (una linea TP/SL, la freccia di una posizione, un disegno, una candela); un **riempimento
largo** no.

### Due risposte che hanno tolto lavoro invece di aggiungerlo ⭐

**I processi «doppi» non sono doppioni.** Il proprietario ha mandato la schermata del Gestione
attività: due `Mt5FeedServer.exe`, due `ForexBacktestLABDesktop.exe`. Gli eseguibili sono costruiti
*onefile* (`EXE()` senza `COLLECT`), e lì PyInstaller mostra **sempre** due processi per programma:
un avviatore che scompatta in una cartella temporanea, e il processo vero. I suoi stessi numeri lo
dicevano: 72 K + 93.820 K, 68 K + 15.016 K. Un sospetto in meno per il lag, senza scrivere una
riga.

*Il doppione vero però esisteva, ed era un altro*: il controllo che evita due servizi dati
conosceva solo i processi avviati da quella istanza del ponte, quindi dopo un ponte morto male ne
partiva un secondo che non prendeva nemmeno la porta. Ora si chiede alla porta.

**Il break-even «che chiude in negativo» e la conferma multipla** erano la v2.0.12. Verificato
diffando i tag pubblicati, non a memoria.

### La lezione ⭐
**Quando l'utente segnala un difetto già corretto, la domanda giusta non è «dove ho sbagliato la
correzione» ma «quale versione sta usando».** Tre volte di fila la risposta era quella — e la
quarta volta ha smesso di essere una coincidenza ed è diventata la causa da cercare: il canale di
aggiornamento era rotto, e teneva nascosto tutto il lavoro fatto. Un difetto che blocca la
consegna vale più di dieci difetti nel prodotto.
## 21 ottobre 2026 (sera) - Cinquanta file sul Desktop, e il danno che avevano lasciato

### Come e' cominciata

«Come mai hai incominciato a prendere il desktop e a riempirlo di file? Mettili nella cartella
apposita o eliminali se non servono piu', creano solo confusione.»

Cinquanta script di debug sul Desktop, **tutti datati 19 ottobre** — due giorni prima, non di
questa sessione (qui gli script vanno nella cartella temporanea della sessione). Spostati in
`%TEMP%\fbl-script-vecchi-19ottobre`, non cancellati: non si butta roba di qualcun altro.

Ma la lamentela sul disordine ha fatto trovare una cosa piu' seria.

### Il danno: un `i += 4` dove servivano 5 ⭐

`fix_all_apostrofi_final.py` cercava `l'app` dentro le stringhe e lo riscriveva come `l\'app`.
Poi avanzava:

```python
result.append("l\\'app")
i += 4   # "salta l'app (5 char, meno 1 per l'incremento)"
continue # ...ma il `continue` salta anche l'incremento
```

`l'app` sono **cinque** caratteri; avanzando di quattro, l'ultima `p` veniva riprocessata e
riscritta. Risultato: **`l\'appp`**, 165 volte fra `appp` e `appplicazione`.

E non erano solo commenti. Il suggerimento di un pulsante diceva, letteralmente:

> Ricarica l\'app (nell\'appp installata non c'è il pulsante del browser)

Piu' **31 backslash** finiti in commenti e testo HTML, dove non sono escape ma caratteri che si
vedono.

### Il mio errore di misura, due volte ⭐⭐

Prima di correggere volevo sapere quanti fossero. Ho contato da riga di comando e mi e' tornato
**176**. Poi, cambiando il filtro, **378**. Poi **71 attributi**. Numeri grossi, che avrebbero
giustificato una sostituzione di massa su tutto il file — cioe' esattamente l'errore che stavo
riparando.

**Erano tutti falsi.** La shell mangiava i backslash prima che arrivassero a Python, quindi
`"\\'"` diventava `"'"` e io stavo contando **apostrofi**.

Me ne sono accorto da un dettaglio: gli esempi stampati accanto ai numeri **non avevano nessun
backslash**. *Un numero che non torna con quello che si vede davanti e' sempre un numero
sbagliato.* Rifatta la misura da file — dove la shell non c'entra — i casi veri erano **31**.

E i 521 rimasti sono **escape legittimi dentro stringhe JavaScript**: toglierli avrebbe rotto
l'app. La differenza fra 521 e 31 e' la differenza fra una riparazione e un disastro.

### Cosa resta a difenderlo

`testo_non_storpiato.test.mjs` (3): niente `appp`, niente backslash nei commenti HTML, e — la
prova di controllo, la piu' importante — **gli escape veri nelle stringhe JS devono restare**.
Una pulizia troppo allegra li toglierebbe e l'app non partirebbe nemmeno: il test lo direbbe
prima. Per non ricadere nell'inganno di sopra, il test costruisce il backslash con
`String.fromCharCode(92)`, che non passa da nessun escape.

### Le lezioni ⭐
1. **Un numero che non torna con quello che si vede davanti e' sbagliato.** Non si corregge
   niente su un conteggio che non si e' guardato in faccia.
2. **Una sostituzione di massa su un file di 4,7 MB va misurata prima e verificata dopo**, e deve
   sapere distinguere dove un carattere e' sintassi (una stringa JS) e dove e' testo (un
   commento, un attributo). Lo script del 19 ottobre non lo distingueva: per questo ha fatto
   danno in entrambi i sensi.
3. **Il disordine non e' mai solo disordine.** Cinquanta file fuori posto hanno portato a 165
   parole storpiate che nessun test copriva.
## 21 ottobre 2026 (notte) - Tre volte i test hanno fermato una correzione sbagliata

### Il robot di Syntra: due difetti in fila, il secondo nascondeva il primo ⭐⭐

«Ha smesso di funzionare il robot dentro BlueStacks, non verifica piu' le nuove posizioni. Non si
deve mai fermare, deve sempre rimanere attivo quando l'app gira.»

**Non si era fermato: i suoi comandi finivano dall'altra parte.** I log del server Oracle,
timbrati mentre lo segnalava, lo dicevano parola per parola:

```
[19:17:58] lettore Syntra spento
[19:18:01] lettore Syntra acceso
[19:18:01] Syntra non parte: funziona solo sul computer, legge l'app Android dentro
           BlueStacks, che su un server Linux non c'e'.
```

`tgInviaSyntra` usava il canale locale solo se il ponte locale **risultava** vivo, e altrimenti
ripiegava su `tgInvia` — che con un server configurato manda **al server**. Il server rifiuta,
giustamente; ma quel rifiuto l'utente non lo vede: vede un robot fermo.

E il ponte locale risultava morto **per il difetto corretto quella mattina** (si spegneva a ogni
ricarica della pagina, fino alla v2.0.15). Bastava un aggiornamento per dirottare Syntra e non
tornare piu' indietro. *Due difetti in fila, di cui il secondo nascondeva il primo.*

### La parte che conta: tre correzioni sbagliate, tre test che le hanno fermate ⭐⭐⭐

| Tentativo | Cosa faceva | Chi l'ha fermato |
|---|---|---|
| 1 | Dirottava bene i comandi, ma `tgSyntraCollega` usciva subito: il canale non si apriva mai | il test che avevo appena scritto |
| 2 | Apriva il canale locale **sempre** che ci fosse un server: su un telefono, un collegamento a 127.0.0.1 ogni 30 s per niente | `server_oracle.test.mjs` — «nessuna chiamata al PC» |
| 3 | Buttava via la sonda del ponte locale | `due_ponti_segnali.test.mjs` — la usa per distinguere computer e telefono |

La versione finale tiene **i due segnali in OR**: il ponte vivo *dimostra* che questo e' un
computer (prova positiva), la volonta' dell'utente copre il caso che aveva rotto il robot.
**Pretendere la sonda era il difetto; ignorarla sarebbe stato l'eccesso opposto.**

Nessuna di quelle tre versioni avrebbe fatto danni evidenti subito. Tutte e tre sarebbero arrivate
all'utente.

### Le altre quattro, in breve

- **La linea dell'entrata non finiva mai.** Era l'unica rimasta indietro: dal passo 18/19 ogni TP
  si ferma sulla sua candela e lo stop sulla sua, l'entrata arrivava al bordo della vista. Con
  molti segnali sullo stesso asset diventa una ragnatela bianca. Ora finisce allo stop preso o
  all'ultimo TP colpito — e se non e' successo niente arriva ad adesso, perche' li' il
  prolungamento e' giusto: *quella e' la prova di controllo del test.*
- **Stop e target automatici per sala.** Verificato PRIMA di scrivere: il calcolo c'era gia'.
  Mancava *dove* si sceglie (era per famiglia di strumento, non per sala) e il target in pip.
- **La percentuale ferma a 0%.** Aritmetica: tre passi, `passo/3`, e il primo passo e' lo zero.
  Ora mai zero (una barra ferma a zero sembra un programma bloccato), mai cento *dentro* un passo
  (una barra che arriva a 100 e resta li' dice una cosa falsa), ma 100 esatto quando tutti i passi
  sono finiti — perche' li' e' la verita'. **Anche quella me l'ha fatta correggere un test
  vecchio**, che pretendeva il 100 alla fine.
- **Popup e zoom: misurato, non corretto.** 24 riquadri, poi tutti i 27 elementi a sovrapposizione,
  dal 70% al 250%, su due schermi, e infine con dentro un figlio da 2400x4000 px: nessuno sfora.
  La segnalazione descrive la v2.0.12. I casi estremi sono finiti nel test permanente.

### La lezione ⭐⭐
**Una correzione che passa i test vecchi non e' una correzione fortunata: e' una correzione
finita.** Stasera tre tentativi su quattro erano sbagliati, e nessuno dei tre l'ho trovato
rileggendo il codice — li ha trovati il banco di prova, ognuno con un test scritto mesi fa per un
motivo diverso. Il valore di un test non si vede quando lo scrivi; si vede quando ti ferma.

E il corollario: **quando un test vecchio diventa rosso, la prima domanda non e' «come lo
aggiorno» ma «ha ragione lui?»**. Stasera aveva ragione tre volte su quattro; la quarta
(`caricamento_asset`, che pretendeva lo 0%) codificava il difetto da correggere, e andava
aggiornato spiegando perche'.

## 22 ottobre 2026 - L'indizio che valeva piu' di un profilatore

### «A mercato chiuso il cambio asset e' istantaneo» ⭐⭐⭐

Il proprietario l'ha detto di passaggio, come un'osservazione. Era la misura piu' preziosa della
settimana, e indicava il punto esatto.

A mercato aperto ogni prezzo in arrivo passa da `rebuildBaseRowsFromLibrary`, che rifa' `baseRows`
con uno `.slice()`. Array nuovo, riferimento nuovo - e le due cache (aggregazione delle candele e
tempi) confrontano **il riferimento**. Si buttavano entrambe a ogni tick. Su 200.000 candele:

| | per singolo prezzo |
|---|---|
| riaggregare tutto | 125 ms |
| ricostruire | 50 ms |
| **riconvalidare tutte le date** | **17,6 ms** |

Con l'oro che fa piu' prezzi al secondo, il filo principale non respirava. A mercato chiuso non
arriva niente, niente si butta, e tutto va: **la differenza che lui vedeva ogni giorno.**

**Misurato dopo: 58 ms -> 2,11 ms per prezzo.** Ventisette volte.

### La voce piu' cara non era quella che sospettavo ⭐

Cercando dove andassero i millisecondi, ero convinto fosse la copia dell'array da 200.000 elementi.
**0,69 ms.** Era invece la *rete di sicurezza* che riconvalidava tutte le date a ogni prezzo:
**17,57 ms**, la voce piu' cara e la piu' inutile - una candela gia' convalidata non torna
indietro a rompersi. Si misura la ripartizione, non si ottimizza il sospettato.

### La prima misura sulla sua macchina

Gli avevo dato uno strumento perche' il difetto non si riproduceva nel banco. Ha funzionato:

```
disegnoMedio_ms   : 67.22     (nel banco: 4-9 ms)
scattoPeggiore_ms : 1264      (un blocco di 1,26 secondi)
tickFootprint     : 197373
```

Lo scatto da 1.264 ms e' quasi certamente il salvataggio del registro tick: sul banco salvare
197k tick costa 100 ms, e la sua macchina e' ~10 volte piu' lenta. La cura (salvare a blocchi) e'
scritta e misurata, pronta in `laboratorio/strumenti/tick_blocchi_DA_APPLICARE.py`.

Per i 67 ms del disegno **non ho indovinato**: ho fatto cronometrare allo strumento i singoli
pezzi, cosi' la prossima misura lo dira' con un numero. Nel banco il footprint non pesava, contro
ogni aspettativa - un altro motivo per non tirare a indovinare.

### La consegna a OpenCode

Il proprietario passa il lavoro. Ho scritto `cervello/CONSEGNA-OPENCODE-22-OTTOBRE.md`: cosa e'
fatto, **nove cose da non toccare con il perche' di ciascuna**, la roadmap nell'ordine che ha
chiesto, e la specifica dell'effetto «wow» all'apertura - che nel repository **non c'era**,
cercata in tutti i file di testo, nel codice e nella storia di git.

Analizzando il punto 5 e' saltato fuori un difetto che nessuno aveva visto: **nove id duplicati**
nel markup, quasi tutti nella zona da riorganizzare. `getElementById` prende il primo, quindi
meta' di quei controlli e' gia' morta oggi.

### La lezione ⭐
**Quando l'utente dice «succede QUANDO...», quella e' la variabile da isolare.** Non e' una
lamentela: e' un esperimento gia' fatto, con il controllo incluso.

## 22 ottobre 2026 (continua) - Otto id duplicati, e meta' dei controlli erano morti

### Il conto, rifatto due volte

La consegna diceva «nove id duplicati». Ho rifatto il conto e il numero e' un altro, ma non
perche' la consegna sbagliasse: perche' **contare sul testo non e' contare sul DOM**.

```
nel testo del file : 13 id ripetuti
nel DOM vero       :  8 id ripetuti  (tutti x2)
```

Cinque dei tredici non esistevano: uno stava dentro un commento HTML, tre dentro stringhe
JavaScript, e uno viene **creato a runtime** sostituendo il primo (il codice rimpiazza tutto
il contenuto di un contenitore, quindi ne resta uno solo).

### Cosa facevano davvero i duplicati

`getElementById` restituisce **il primo**. Quindi:

| id | copie | cosa succedeva |
|---|---|---|
| `tgToggleBtn` | 2 | il secondo pulsante «Collegamento: -» non cambiava mai testo e non reagiva |
| `tgSetupBox` | 2 | la seconda schermata di prima configurazione era irraggiungibile |
| `tgApiId` / `tgApiHash` | 2 | la seconda casella api_id/api_hash non accettava scrittura |
| `tgSalvaCredBtn` | 2 | il secondo «Salva su questo dispositivo» era finto |
| `tgDimenticaTelBtn` | 2 | il secondo «Esci da Telegram» restava nascosto |
| `tgTelefonoSalvatoLbl` / `tgTelefonoForgetBtn` | 2 | la seconda riga del numero salvato era morta |

Non era un difetto di stile: erano **controlli fantasma**, e spostando il primo blocco in
un'altra sezione si sarebbe «acceso» il secondo, cambiando il comportamento in modo
inesplicabile. Per questo la consegna chiedeva di risolverli **prima** di spostare.

### La regola, e il test che la rende permanente

**Si tiene il PRIMO e si butta il SECONDO** (il primo e' quello che il codice usa davvero).

La cancellazione l'ho fatta con uno script (`laboratorio/strumenti/togli_dup_id.py`) e non a
mano: il file ha 46.000 righe, i blocchi contengono trattini lunghi ed emoji, e i due blocchi
erano **identici** - a mano il rischio di cancellare quello vivo era reale. Lo script, prima
di scrivere, verifica che ogni blocco da togliere contenga davvero l'id atteso, che la copia
viva stia prima, e dopo aver scritto che ogni id esista **una volta sola**. Se il file e'
cambiato sotto i piedi, esce e non tocca niente.

Il test che lo protegge per sempre (`laboratorio/app/id_univoci.test.mjs`) conta sul DOM
vero, in un browser vero, e pretende **zero** id ripetuti. Ha anche la **prova di controllo**:
crea un id duplicato apposta e verifica che il controllo lo veda, e che torni pulito quando
sparisce. Un test che non puo' diventare rosso non dimostra niente.

### «Le cose delle sale vanno nella sezione Sale segnali»

Risolti i duplicati (obbligatorio prima di spostare), ho creato una nuova scheda **Sale
segnali** accanto a Collegamento. Nella sezione **Collegamento** restano solo ponte, accesso
da altri dispositivi, account Telegram e prima configurazione; nella sezione **Sale segnali**
sono finite cronologia, apertura automatica, pannello segnali, elenco delle sale Telegram
e tutta la sezione Syntra. Le schede Telegram/Syntra che scelgono da quale fonte arrivano i
segnali sono rimaste identiche, ma sono state spostate insieme alle sale.

I pezzi sono stati **spostati** (le righe copiate dal loro posto e rimosse dall'altro),
non riscritti: emoji, trattini lunghi e commenti sono rimasti byte per byte. Uno script
(`laboratorio/strumenti/sale_segnali_pannello.py`) si e' occupato dell'assemblaggio con
controlli: i segnaposto devono essere dove ci si aspetta, ogni id deve restare una volta sola,
i `<div>` devono bilanciarsi, le due sezioni devono essere sorelle e in ordine.

Il test (`laboratorio/app/sale_segnali.test.mjs`) misura **dove sta ciascun controllo** con
`closest()` e **cosa succede** premendo i pulsanti spostati: «Apri il pannello dei segnali»
e «Configura apertura automatica» aprono ancora i loro pannelli. Ha anche la prova di
controllo: niente doppioni, le due sezioni non stanno una dentro l'altra.

Titolo del popup semplificato in «Impostazioni generali» (coerente con il contenuto). Collaudo
completo: **Falliti: 0**.
## 22 ottobre 2026 (continua) - Il pacchetto di installazione: quando non serve, non si scarica

**Segnalato:** «30-40 file nella cartella Download invece di uno sostituito».

### Il nome del file non e' un difetto nostro

La consegna lo diceva gia': il nome lo decide il server (GitHub Releases), ma a scaricarlo e' il
browser di sistema, che aggiunge `(1)`, `(2)`, `(3)`... **Una pagina web non puo' sostituire un
file nella cartella Download**: non esiste un'API che lo permetta. Quindi la strada 1 della
consegna (il nome con la versione dentro) e' un modo per capire QUALI file sono, non per
toglierli.

Il difetto vero era un altro, ed era nostro: **il pulsante «Aggiorna» scaricava il pacchetto
anche quando il pacchetto non portava niente**. Ogni release pubblicata = un Setup nuovo = un
click = un file in piu' nella cartella. Quaranta release, quaranta file: il conto torna.

### La misura che decide (era gia' scritta nella consegna)

Dal 22 ottobre il ponte scarica da se' una **copia aggiornata** di `app.html` e `sw.js` e serve
quella, invece di quella congelata dentro l'eseguibile. Lo dichiara in `/health`, nel campo
`app.da`. E' l'unico che sa quale delle due copie sta servendo, quindi e' l'unico a cui si puo'
chiedere.

| Cosa dice il ponte | Cosa serve | Cosa fa il pulsante |
|---|---|---|
| `app.da = 'copia aggiornata'` | niente: il programma sa aggiornarsi da solo | **ricarica la pagina** |
| `app.da = 'copia installata'` | il Setup, UNA volta | scarica il Setup |
| il ponte non risponde | non si puo' sapere: **per sicurezza** il Setup | scarica il Setup |
| Android | l'APK e' l'app stessa | scarica l'APK |
| un dispositivo che non e' un computer | niente | ricarica la pagina |

La decisione sta in un posto solo, `fblPianoAggiornamento()` (con una cache di 60 secondi, per
non interrogare il ponte a ogni click), e l'etichetta in un altro, `fblEtichettaAggiorna(piano)`:
**«⬇️ Aggiorna»** se il pacchetto serve davvero, **«🔄 Aggiorna l'app»** se basta ricaricare. Un
pulsante che dice una cosa e ne fa un'altra e' la causa di mezzo problema.

### La seconda porta: il wizard dei pacchetti MT5

Lo stesso difetto era anche nel wizard che si apre quando il servizio non risponde: se i
pacchetti erano gia' installati, offriva lo stesso «Scarica di nuovo i pacchetti». Ora, se anche
l'app qui e' gia' aggiornata (stesso confronto del pannello Versione), il pulsante **sparisce** e
il testo dice perche': di solito vuol dire che il computer e' appena stato acceso e il servizio
non ha ancora fatto in tempo a partire. Se il problema resta, il testo lascia il link alla pagina
delle versioni: la via per reinstallare a mano non sparisce, cambia solo da pulsante a link.

Il confronto usa la release **già in memoria** (il controllo automatico la tiene aggiornata) e
non chiede la rete: l'utente sta aspettando che qualcosa si muova. Se la release non e' nota,
non si nasconde niente: meglio un file in piu' che un modo per reinstallare perso.

### I test (6) e la prova che sanno diventare rossi

`laboratorio/app/setup_non_necessario.test.mjs` misura il **comportamento**: clicca «Aggiorna
ora» e guarda se parte un **download** del pacchetto oppure una **ricarica** della pagina
(l'indirizzo del link viene registrato, il file non si scarica). Non legge il sorgente.

Le due prove di controllo sono la parte importante:
- il programma installato che serve la **copia congelata** -> il `.exe` **deve** partire;
- l'app qui **indietro** -> nel wizard il download **deve** restare.

Sono state provate rosse: rimettendo il codice di prima, il pulsante diceva «⬇️ Aggiorna ora»,
il pacchetto partiva anche quando non serviva, e il wizard lo offriva lo stesso. Con il codice
nuovo le sei sono verdi.

### La lezione ⭐

**Una domanda che il prodotto puo' fare a se' stesso va fatta, non indovinata.** Il ponte sapeva
già da quale copia stava servendo l'app: la risposta era gia' in `/health`, e noi scaricavamo il
pacchetto lo stesso. Il costo non e' stato scrivere la funzione: e' stato accorgersi che la
domanda esisteva.

**E la cucitura conta.** La prima versione della sonda interrogava il ponte con una `fetch` sua
(3 secondi, AbortController). Il test di prima, `versione_due_numerazioni`, e' diventato rosso:
mockava `fetchMt5WithTimeout`, non `fetch`. La sonda e' passata dalla **stessa porta di sempre**
(`fetchMt5WithTimeout('/health')`), cosi' un solo modo di interrogare il ponte in tutta l'app e i
test di prima continuano a poter parlare con lui. Una porta nuova e' una porta che nessuno
conosce: meglio riusare quella che c'e'.

---

## 22 ottobre 2026 (continua) - Lo scatto da un secondo, e la riga che nessuno stava guardando

Il proprietario ha misurato la sua macchina, non il banco di prova: **scatto peggiore 1.264 ms**
(un secondo e un quarto di blocco), **disegno medio 67,22 ms**, 25,6 fotogrammi al secondo,
752.683 tick di footprint in memoria. Sono i numeri della sua giornata di lavoro, non di una
prova: e' da li' che si parte.

### 7a - Il registro dei tick: si scriveva tutto, ogni volta

Lo scatto peggiore era il salvataggio del registro del footprint. Il registro e' grosso (il tetto
e' 150.000 tick per asset) e **ogni salvataggio riscriveva l'intero registro**, non l'ultimo
pezzo. Misurato sul banco, 150.000 tick:

| Cosa | Costo |
|---|---|
| scrittura di oggi (tutto il registro) | **105 ms** |
| un blocco da 20.000 tick, con gli oggetti | 24,5 ms |
| un blocco da 20.000 tick, **in forma compatta** | **2,5 ms** |
| tutto il registro, in forma compatta | 12 ms |
| lettura, con gli oggetti | 58 ms |
| lettura, in forma compatta | 10,6 ms |

Il costo era quasi tutto nella **copia strutturata di centinaia di migliaia di oggetti**. Due cure
insieme: si scrive solo il blocco in coda (non tutto il registro) e il blocco si scrive in forma
compatta (quattro numeri per tick, in array tipizzati, invece che come oggetti).

**I blocchi non si spostano.** Ogni blocco ha un numero assoluto: finche' il registro cresce in
coda, i blocchi pieni non si riscrivono mai. Quando il registro supera il tetto si butta via un
**blocco intero** dalla testa: cosi' i blocchi restano allineati e non c'e' nessun rinumero.
L'indice (`ftickIndice`) si scrive **dopo** i blocchi, quindi non puo' puntare a cose che non ci
sono ancora. Chi aveva il registro nel formato vecchio (un blob unico) lo ritrova: i blocchi hanno
la precedenza, il blob e' il ripiego, e al primo salvataggio il registro viene riscritto a blocchi
e il blob cancellato.

**La forma compatta non perde niente**, ed e' controllato per valori, non sperato: istante,
prezzo, lato e peso ci sono sempre; `aggr`, `vol`, `mode` e `src` ci sono quando servono (con una
sentinella per dire "non c'e'"); un campo che non si conosce resta **verbatim**. Il footprint
continua a sapere chi ha comprato e chi ha venduto, come prima.

### Il difetto che era gia' scritto nello script pronto

Lo script che la sessione precedente aveva lasciato in `scratchpad/` era **difettoso**, e il
difetto era invisibile finche' non lo si guardava da vicino: tagliava il registro **un tick alla
volta**. Con il log che si sposta di uno, i blocchi "pieni" restano della stessa lunghezza, il
confronto dice "gia' scritto" e sul disco restano blocchi **stalati** - e il blocco in coda non
viene mai scritto. Non applicarlo cosi' com'era. La regola che ne esce: **si taglia a blocchi
interi, o i blocchi non sono piu' blocchi.**

### La prova di controllo che all'inizio non guardava niente

Il primo test del taglio era cieco, e non si vedeva: faceva il taglio **prima** di qualsiasi
salvataggio, quando lo stato dei blocchi non esiste ancora. Tolto il difetto apposta (la riga che
rinumera i blocchi), il test restava **verde**: non stava guardando il caso vero. Il caso vero e'
il **secondo** taglio, con il registro gia' scritto sul disco. Rifatto il test sul ciclo vero, il
difetto introdotto lo fa diventare **rosso**, e il blocco uscito dalla testa sparisce davvero dal
disco (il registro non cresce all'infinito).

Un test che non puo' diventare rosso non e' un test: e' una rassicurazione.

### 7b - Il disegno: il 96,6% sta nel corpo di draw()

La consegna lo diceva gia' e la misura lo conferma: il disegno si mangia il 78% del tempo, ma
tutte le funzioni gia' cronometrate insieme fanno il **3,4%**. Il 96,6% sta nel **corpo** di
`draw()`, cioe' nel codice che nessuno stava misurando. Quindi il sospetto di partenza era
sbagliato due volte su due: non e' una funzione da ottimizzare, e' un corpo di 2.100 righe da
spezzare in sezioni.

Ora dentro `draw()` ci sono **23 cronometri di sezione** (`avvio`, `grigliaTempo`, `heatmap`,
`candele`, `disegniUtente`, `notizie`, `mirino`... fino a `coda`), e la misura dell'app li
riporta nel suo risultato: `sezioniDelDisegno_ms` (dal piu' caro al meno caro, costo medio di un
disegno) e `sezioniTotale_ms`. Alla stessa misura si sono aggiunti i **candidati del cambio
asset** (i 2.818 ms): `saveFootprintTicksNow`, `footprintRebuildBucketsForCurrentAsset`,
`caricaStoricoPerSaltoAGrafico`, `binanceKlines`.

**I cronometri sono spenti di default** e si accendono solo durante la misura, che li spegne alla
fine. Non e' pignoleria: uno strumento di misura che resta attaccato diventa la causa del
rallentamento successivo. Costa piu' il cronometro dimenticato che il difetto che cercava.

Sul banco di prova il disegno dura meno di un millisecondo (0,9 ms) e i numeri sono sporcati dal
riscaldamento della macchina virtuale: servono come prova che lo strumento **vede** le sezioni -
infatti con venti disegni aggiunti `disegniUtente` sale - non come diagnosi. La diagnosi vera la
fa il proprietario, che ha 67 ms di disegno medio e il carico che solo la sua giornata produce.

### I test, e le prove che sanno diventare rosse

- `laboratorio/app/footprint_blocchi.test.mjs` (4 casi): i blocchi e l'indice esistono, un blocco
  pieno **non** si riscrive, il giro scrittura/rilettura torna **identico** (con i tick storici
  che hanno `aggr`, `vol` e `mode`), il vecchio blob si legge ancora, e il taglio sul tetto lascia
  sul disco esattamente il registro giusto.
- `laboratorio/app/cronometri_disegno.test.mjs` (3 casi): la somma delle sezioni copre il tempo
  del disegno (rapporto fra 0,5 e 1,5: se i cronometri dicessero zero, cadrebbe), i cronometri
  spenti non accumulano niente, e la misura dell'app riporta davvero le sezioni.

Le prove di controllo, eseguite: `prova_controllo_taglio.py` (tolto il rinumero dei blocchi ->
rosso) e `prova_controllo_cronometri.py` (tolto l'accumulo -> rosso; tolto il riporto nella
misura -> rosso).

### Una cucitura che ha fatto rumore

La riga del cronometro, messa **fra** `function draw(){` e `fblScadeDecimali();`, ha fatto
diventare rosso `replay_posizioni`: quel test cerca il testo del sorgente e pretende
`fblScadeDecimali();` come prima istruzione. Il comportamento era intatto. La cura non e' stata
toccare il test ma **spostare la mia riga sotto** `fblScadeDecimali();`: la prima istruzione resta
la prima. (Il test resta fragile per costruzione - legge il testo - e un giorno andra' riscritto
sul comportamento: oggi non era il suo turno.)

### La lezione

**Si misura prima di correggere, e la prima misura spesso smentisce il sospetto.** Due volte su
due, qui: non era il salvataggio del footprint a spiegare il disegno lento (era il 3,4%), e non
era una funzione da ottimizzare ma il corpo di `draw()`. Il lavoro utile non e' stato ottimizzare:
e' stato mettere i cronometri nel posto giusto e **rifare la misura**.

E la seconda: **un difetto scritto in uno script pronto resta un difetto**, anche se lo script e'
"quasi finito". Il taglio a un tick alla volta sarebbe passato inosservato per mesi: si sarebbe
visto solo come "il footprint a volte si rimescola".

## 22 ottobre 2026 (continua) - La finestra PIP, il puntatore e i cartellini dei gruppi

Tre richieste del proprietario nella stessa giornata, tutte e tre misurate prima di essere
toccate.

### La finestra non era una finestra dell'app

La richiesta: «in modalita' pip viene mostrata la barra delle informazioni del sito, con about
blank, e quella deve essere tolta ... deve essere una seconda schermata della STESSA
applicazione, non e' un qualcosa collegato via web ... me ne accorgo anche dal fatto che la
finestra non ha il logo come la pagina madre».

La causa era una riga: la finestra veniva aperta con `window.open('')` su una pagina **VUOTA**.
Percio' il browser la mostrava come una pagina web qualsiasi: la barra delle informazioni del
sito in alto che diceva "about:blank", nessun titolo, nessuna icona. Non era un difetto di
stile: era una pagina web, non l'app.

La correzione: prima la **Document Picture-in-Picture nativa** (Chrome/Edge) - una finestra
vera, SENZA barra del browser, SENZA indirizzo, SENZA "about:blank", che contiene lo STESSO
documento. Quindi stesso stato e stesso motore per costruzione: nessuna copia, nessuna
sincronizzazione, nessun doppio collegamento al conto. Misurato dentro la finestra: **0 script,
1 solo canvas, il motore non esiste** (`typeof positions === 'undefined'`) - cioe' un solo
cervello, mai due ordini.

Se l'API non c'e' (o il browser la rifiuta) si cade sul popup di prima, ma con l'icona
dell'app nel titolo e una **barra interna col logo e il nome "BacktestLAB FOREX EDITION"**: se
anche il fallback si vede come l'app, il proprietario non vede piu' una pagina web.

Scartata di proposito la seconda istanza completa dell'app (`?pipSlot=N`): aprirebbe un secondo
collegamento a MT5/Capital.com, con il rischio di ordini duplicati (`EXTRA_PIP_WINDOWS_ENABLED`
e' disattivato per lo stesso motivo).

### Il puntatore: 78 px a sinistra e 55 px in alto

La richiesta: «il puntatore e' sfasato di posizione sia dell'asse X che dell'asse Y: io punto il
mouse sopra il grafico e la posizione effettiva e' spostata in alto a sinistra».

Misura (Chromium, finestra staccata, scala UI 130%): il canvas era **950 px di layout contro 730
px a schermo**, e il mirino disegnato cadeva 78 px a sinistra e 55 px in alto rispetto al mouse.
Il mirino, da solo, era giusto (scarto -1/-1 px: arrotondamento). Il difetto non era il
mirino: era la **scala del canvas**.

La causa: la scala UI funziona cosi' - il `body` della pagina e' zoomato (`zoom: 1.3`) e il
`#chartWrap` porta il **contro-zoom** (`1/1.3`) per restare della sua dimensione. Il contro-zoom
**viaggia col nodo** quando il grafico si sposta in un'altra finestra, ma in quella finestra il
body NON e' zoomato (e non deve esserlo: la finestra e' gia' a grandezza schermo). Il
contro-zoom, da solo, rimpicciolisce il grafico senza che nessuno lo misuri: il disegno e la
lettura del puntatore parlavano di due grafici diversi.

La correzione: quando il grafico cambia finestra il contro-zoom si toglie, e al rientro si
rimette. L'invariante da tenere, e da mettere in test: **`clientWidth == rect.width`**, cioe' il
layout e' quello che si vede.

### I cartellini: alla riga del gruppo mancava una colonna intera

La richiesta: «la linea in fondo a destra di ogni posizione deve essere visualizzata anche
all'interno dei gruppi ... se c'e' una posizione che e' piu' vicina allo stop profit mi
visualizza il cartellino blu, se invece e' piu' vicina a una linea del tipo TP mi visualizzera'
quella che e' il cartellino verde, e allo stesso tempo, se e' la piu' vicina a uno stop loss ...
il cartellino rosso».

La riga del gruppo **non aveva affatto la striscia**, e percio' aveva 14 celle invece di 15:
tutte le sue celle erano spostate di una colonna a sinistra (quello che si vedeva era una
tabella disallineata; la striscia era solo il sintomo).

Ora: dentro il gruppo ogni singola operazione mostra il **proprio** cartellino; sulla riga del
gruppo c'e' il cartellino della posizione **piu' vicina a un livello** (blu = stop a profitto,
verde = take profit, rosso = stop loss), e nel titolo il numero della posizione dentro il gruppo
("Posizione 2 di 3: ..."), cosi' si sa QUALE posizione guardare. Per scegliere la piu' vicina,
`fblStrisciaPosizione` restituisce adesso anche la percentuale (`perc`): 0 vuol dire che il
livello e' gia' stato superato, cioe' il caso piu' urgente.

### I test (6) e la prova che sanno diventare rossi

- `laboratorio/app/pip_finestra.test.mjs` (2 casi): la finestra e' la Picture-in-Picture
  NATIVA (la stessa di `documentPictureInPicture.window`) e ha dentro la barra col logo e il
  nome; senza l'API la finestra di riserva mostra lo stesso logo e l'icona dell'app.
- `laboratorio/app/pip_puntatore.test.mjs` (2 casi): con la scala UI al 130% il grafico nella
  finestra ha `clientWidth == rect.width` e il mirino disegnato (misurato sui PIXEL, non letto
  nel sorgente) cade sotto il mouse in X e in Y; al rientro il contro-zoom torna com'era.
- `laboratorio/app/gruppi_striscia.test.mjs` (2 casi): la riga del gruppo ha il cartellino della
  posizione piu' vicina (tre scenari: verde, blu, rosso), il titolo dice quale posizione e',
  la riga ha tante celle quante l'intestazione, e ogni posizione mantiene il suo cartellino.

La prova di controllo, eseguita con il `app.html` **originale**: tutti e sei i test vanno
ROSSI, e con i numeri giusti - «14 celle invece di 15», «il grafico nella finestra e' piu'
piccolo a schermo che in layout (950 contro 730.78)», «nella finestra separata il contro-zoom
deve essere tolto».

Il collaudo completo: **839 test, 838 verdi, 1 rosso**. L'unico rosso NON e' di questo capitolo:
e' `apk_versione.test.mjs`, che confronta la versione dentro l'APK (2.0.19) con quella del
repository (2.0.20). L'APK sul computer del proprietario e' stato costruito alle 7:14 del 22
ottobre, **prima** del rilascio delle 2.0.20 (12:20): quindi era gia' rosso al rilascio delle
2.0.20 e non dipende da niente di qui. Su GitHub quel test viene **saltato** (il progetto
mobile sta fuori dal repository), ed e' il collaudo di GitHub che conta.

Una cosa emersa durante la prova: il CSS dell'app ha `input,select,button{width:100%}`, quindi
il pulsante di chiusura della barra si allargava a tutta la finestra (misurati 1092 px) e il
nome dell'app andava a capo (barra alta 51 px invece di 29). Due ritocchi (`width:auto` e
`white-space:nowrap`) e la barra torna come si deve: logo 20 px, nome su una riga, pulsante
27 px.

### La lezione

**Una finestra aperta su una pagina vuota mostra la barra del browser, non quella dell'app.** La
lamentela «si vede about:blank» non era cosmetica: stava dicendo che la finestra staccata era
una PAGINA WEB e non una seconda schermata del programma. La correzione non era nascondere una
barra (quella e' del browser e non si nasconde), era smettere di aprire una pagina web.

**Uno zoom che viaggia col nodo e' uno zoom che nessuno misura.** Il contro-zoom della scala UI
e' giusto nella pagina e sbagliato nella finestra: stesso nodo, due scale diverse, e il
puntatore finisce sempre su un altro grafico. La regola che resta e' semplice: **quello che
disegni deve essere quello che si vede** (`clientWidth == rect.width`).

E la terza: **una colonna che manca sposta tutte le altre.** La riga del gruppo non aveva la
striscia, e quello che si vedeva era una tabella disallineata. Il cartellino era solo il
sintomo; il difetto era una cella in meno.

## 22 ottobre 2026 (continua) - Il margine dello spread solo intorno alla chiusura del mercato

Il punto 4 della consegna: «il pareggio resta **zero** nelle condizioni normali, ma nella fase di
chiusura e riapertura del mercato si adotta il margine dello spread, tornando al pareggio esatto
quando il mercato si e' stabilizzato. **Con un interruttore nelle impostazioni.**»

### La richiesta e il prezzo che era gia' stato pagato

Il 21 ottobre la stessa protezione era gia' stata fatta male, e il proprietario l'aveva pagata:
«sposta le posizioni a break-even, ma perdono ugualmente meno 2 euro». Il margine di allora era
lo **spread tipico** (circa un pip), e soprattutto la sua etichetta diceva "pareggio" mentre il
fermo non era un pareggio: un'etichetta che mente e' peggio di una protezione in meno.

Prima di toccare niente ho rimesso le misure sul tavolo, perche' sono loro a decidere la
direzione:

- Il 21 ottobre, EURCHF al cambio giornata: bid 0,92461 / ask 0,92961 alle 00:00:42 ->
  **50,0 pip** di spread. Cinque tick in cinque minuti, e lo spread 250 volte piu' largo del
  normale.
- Il fermo di una SELL si esegue sull'**ASK**, e quello di un BUY sul **BID**. Al cambio giornata
  l'ask sale e il bid scende: e' il lato che si allarga a prendere il fermo.
- Il fermo "al pareggio esatto" di una posizione appena aperta sta **dentro la forbice**: per
  questo il 21 ottobre la risposta era stata RIFIUTARE (regola che resta).

Tre conseguenze, e sono le uniche tre cose che il capitolo decide:

1. **Il margine deve valere la forbice del cambio giornata (50 pip misurati), non lo spread
   tipico.** Con lo spread tipico (~0,6 pip) il fermo resterebbe dentro la forbice: il margine
   non proteggerebbe niente. E' la stessa ragione per cui il margine della v2.0.12 non ha mai
   salvato niente.
2. **La direzione e' dalla parte da cui il fermo puo' essere preso, e non dalla parte dell'entrata.**
   BUY: il fermo scende (pareggio esatto MENO il margine). SELL: il fermo sale (pareggio esatto
   PIU' il margine). E' la direzione del vecchio `allarga` della v2.0.12, ed e' la stessa della
   distanza che l'app gia' calcola per capire se un fermo e' in pericolo
   (`dist = BUY ? prezzo-sl : sl-prezzo`).
3. **Il costo del margine e' reale e va detto.** Per una SELL il fermo col margine sta SOPRA
   l'entrata: se viene preso, si chiude in perdita di quanto e' il margine. Non e' un pareggio e
   non si chiama "pareggio": per questo il segno del Trade Journal resta il **pareggio esatto**,
   cosi' il Journal dice "BE" solo quando il fermo e' davvero al pareggio, e il messaggio del
   pulsante dice «pareggio + margine di chiusura».

### La finestra

La finestra e' quella che l'app gia' conosce: mezz'ora prima della chiusura e mezz'ora dopo la
riapertura (`FBL_MARGINE_CHIUSURA_MIN=30`, `FBL_MARGINE_RIAPERTURA_MIN=30`). Il mercato chiuso
NON e' dentro la finestra: li' dentro nessuno puo' eseguire un ordine, e il margine starebbe a
fare danno per un'ora intera senza proteggere niente.

L'interruttore e' nelle impostazioni (sezione «Chiusura mercato»), `fblMargineChiusura`, salvato in
`fbl_margine_chiusura`, **acceso di default**.

### Tre difetti che ho trovato in quello che avevo scritto io

Il meccanismo non e' nato al primo colpo: e' nato al terzo tentativo, e i due tentativi sbagliati
hanno insegnato tre cose.

**1. Il metro del «troppo vicino» era sbagliato per il margine.** Il fermo non si mette se
cadrebbe dentro la forbice del cambio giornata - e la forbice e' esattamente il margine.
Confrontarli tra loro significa confrontare la forbice con se stessa: il margine non sarebbe
mai «abbastanza lontano» e **il margine non scatterebbe mai**. Il metro giusto per il margine e'
lo spread **ORDINARIO** (lo stop non deve trovarsi cosi' vicino al prezzo da essere preso al primo
allargamento); per il pareggio esatto resta la forbice, cioe' la regola del 21 ottobre. E il
ritorno al pareggio esatto usa lo spread ordinario perche' a quel punto il mercato si e'
stabilizzato: se usasse la forbice, il margine non andrebbe mai via.

**2. Lo stato locale mentiva, e insisteva ogni due secondi.** Il giro scriveva lo stop nel
campo locale **prima** di sapere se il conto lo avesse preso: se il ponte rifiuta, l'app
mostrava uno stop che sul conto non c'era. E il tentativo non era tracciato, quindi il giro
successivo (due secondi dopo) riprovava e riprovava. Ora: il tentativo si traccia PRIMA (anche
se fallisce), lo stato si aggiorna **solo** se il conto ha preso lo stop, e si riprova ogni
**cinque minuti**.

**3. Il prezzo del fermo non era un prezzo.** 1,08500 + 0,00500 fa 1,0899999999999999 in
virgola mobile: uno stop cosi' non e' un prezzo che il broker possa accettare. Ora il fermo
col margine viene arrotondato alle cifre del prezzo dello strumento, come gia' faceva
`mt5PrezzoPareggio` per il pareggio esatto.

**4. L'attesa dei cinque minuti c'era solo da un lato.** Il giro gira dentro il polling MT5,
che passa ogni due secondi. L'attesa era scritta per il ramo «allontana il fermo», ma non per il
ramo «riporta il fermo al pareggio esatto»: se il conto rifiutava quest'ultimo, il giro dopo
riprovava due secondi dopo, per tutta la sessione. Lo stesso difetto che avevo appena corretto
per un ramo, ripetuto nell'altro. Ora c'e' un punto solo che decide «ora non si insiste», e
tutti e due i rami lo usano.

### I test (9) e la prova che sanno diventare rossi

`laboratorio/app/margine_chiusura.test.mjs` - 8 casi, tutti con il **tempo iniettato** (nessun
test dipende dall'ora vera della macchina):

1. la finestra: dentro prima della chiusura, dentro dopo la riapertura, fuori in orario normale,
   spenta a mercato chiuso (e i bordi esatti: trenta minuti esatti sono ancora dentro);
2. fuori dalla finestra il pareggio e' esatto; dentro, il fermo si allontana di **50 pip** (il
   numero dichiarato, non una stima: `0,0050` su EURUSD);
3. la SELL sposta il fermo **sopra**, il BUY **sotto**: dalla parte da cui puo' essere preso;
4. l'interruttore spento: mai margine, nemmeno dentro la finestra; riacceso: il margine torna;
5. la macchina a stati: pareggio -> margine nella finestra; finita la finestra -> ritorno al
   pareggio esatto; fermo spostato a mano -> non si tocca e il segno del margine sparisce; mercato
   chiuso -> non si sposta niente;
6. una posizione **simulata** non riceve mai il margine (lo spread e' gia' dentro l'entrata);
7. il giro: sposta lo stop sul conto, e se il conto **rifiuta** lo stato locale non mente e il
   ponte non viene chiamato ogni due secondi ma ogni cinque minuti;
8. il pulsante BE: dentro la finestra mette il fermo col margine, ma il segno del Journal resta il
   pareggio esatto; fuori dalla finestra continua a valere la regola del 21 ottobre (il fermo
   dentro la forbice viene rifiutato);
9. il **ritorno** al pareggio esatto, se il conto rifiuta, aspetta cinque minuti come l'altro:
   il fermo locale resta quello col margine (la verita') e il ponte non viene chiamato ogni due
   secondi.

La prova di controllo, eseguita con il `app.html` **di prima del capitolo 4**: **9 test su 9
rossi** (`fblPareggioChiusuraGiro is not defined`, e il pulsante che metteva 1,08500 invece di
1,08000). Il test misura il comportamento, non cerca una stringa nel sorgente. E per il difetto
numero 4 la prova e' stata fatta togliendo solo quella riga: **8 verdi e 1 rosso** (quello che
controlla il ritorno), con il messaggio giusto: «il ponte e' stato chiamato una volta sola».

### La lezione

**Un metro confrontato con se stesso non misura niente.** Il fermo non si mette se sta dentro la
forbice; il margine E' la forbice; quindi il fermo col margine non era mai "troppo vicino" e il
margine non sarebbe mai scattato. Il difetto non era nel numero del margine, era nel metro: due
cose uguali non si possono confrontare per capire se una e' abbastanza lontana.

**Lo stato locale che si aggiorna prima del conto e' una bugia.** Se il ponte rifiuta, l'app
mostrava uno stop che il broker non aveva. Il fermo che l'app dice e' il fermo che il conto ha:
se i due non coincidono, si dice che non coincide.

**Un tentativo senza tempo e' un tentativo ogni due secondi.** Tracciare il tentativo serve a
una cosa sola: dire al giro successivo «hai gia' provato, aspetta». E il tempo va iniettato,
altrimenti il test non puo' provare niente (e per farlo passare si finisce col premere i tasti
dell'app a ora di pranzo).

## 23 ottobre 2026 - Le ancore seguono la scala (disegni al cambio TF), lo zoom resta di una macchina, e un capitolo perso che e' tornato

### I capitoli della mattina, gia' committati

(riassunto per non rifare: tutti committati, tutti con test)
- «Aggiorna» acceso a torto, wow che partiva nei test (`navigator.webdriver`), apertura
  fuori contesto: `533b648`;
- quattro correzioni segnalate dal proprietario: `f3bafc2`;
- le sale eliminate fuori dalla card win-rate (con prova di controllo col ponte spento):
  `238207e`;
- le notifiche push rinnovate (via unica `fblNotificaMostra`/`fblNotificaChiediPermesso`/
  `fblNotificaPushOra`, plugin Capacitor nell'app Android, Notification API nei browser):
  `da2dd91`.

### Le forme slittavano al cambio Time Frame (`06d401b`)

Segnalato: «cambio TF e trend, quadrati e linee slittano rispetto alle candele». La diagnosi
misurata della sessione precedente aveva gia' detto la causa: le punte sono ancorate a un
ISTANTE (ms) che nel TF in cui il disegno era nato era l'apertura di una candela; ad aggregazione
diversa (5m/15m/1H) l'istante resta un tempo vero MA non e' piu' l'apertura di nessuna candela:
la punta giace in mezzo al bucket, fino a quasi una larghezza intera, e l'inclinazione cambia.
La cura: `fblDisegniRiAgganciaAlTf()` riaggancia ogni punto (p1, p2 e le serie di punti) alla
candela del TF attuale piu' vicina, con ricerca binaria sui tempi di `rows` (`getRowsTimestamps`):
lo stesso aggancio che il punto aveva al momento del disegno. Tre e non due i percorsi Live che
lo chiamano: Capital, MT5 e BINANCE (scoperta facendo i probe sull'unicita' degli anchor:
c'era un quarto percorso che la diagnosi non aveva visto), con il guard
`opts.tfChangeSpanMinutes` cosi' le risincronizzazioni periodiche dello stesso TF non toccano
le ancore, che restano esatte. Test: `disegni_cambio_tf.test.mjs` (2), che cambia TF dal
controllo VERO (`$('tf')` + `change`) e con la prova di controllo: prima della cura 10:07 NON
e' apertura di una candela 5m.

### Lo zoom si spostava tra macchine (`a844e4c`)

Richiesto: «lo zoom non deve sincronizzarsi tra macchine». Causa misurata: lo zoom
(priceZoomFactor, viewPriceLo/Hi) viaggiava nel pacchetto di sessione destinato ANCHE al cloud
(`collectLightSessionState`), e `assetChartViews` portava pure zoom orizzontale e autogamma:
aprendo l'app su un'altra macchina arrivava lo zoom di quella prima, e alla sincronizzazione
successiva scappava quello scelto qui. La cura sta nel punto unico: `trimTradesForCloudBudget`
e' l'UNICO passaggio di ogni scrittura cloud (report intero e keepalive), e li' lo zoom si
separa clonando (l'originale resta vivo): lo zoom del dispositivo vive in un localStorage
apposta (`fbl_zoom_dispositivo`, sempre fresco ad ogni salvataggio), lo stato remoto NON lo
porta piu', e chi lo applica lo legge solo dal proprio dispositivo — con una semina una tantum
dal pacchetto vecchio, che protegge l'utente dal perdere lo zoom al primo avvio dopo
l'aggiornamento. Le ancore di posizione (masterTime/viewEnd) viaggiano ancora. Test:
`zoom_dispositivo.test.mjs` (3: pacchetto pulito, memoria intatta, pacchetto vecchio ignorato).

### Le etichette TP/SL si scrivevano una sopra l'altra (`e231310`)

Richiesto: «quando piu' posizioni hanno la stessa casella, si raggruppano in un'unica etichetta
che mostra il numero di posizioni, l'origine e l'accumulo della perdita per gli SL». La misura
del difetto: tre posizioni dello stesso segnale (stessa sala, entrata/stop/target identici)
scrivevano a schermo TRE etichette alle stesse coordinate — TP1, TP2, TP3 impilate, e il test
nuovo lanciato PRIMA della cura le contava tre (3 != 1). La cura: le caselle con chiave INTERA
identica (asset, punto d'apertura, entrata, stop, target e larghezza a schermo) si disegnano UNA
volta sola, dalla prima posizione del gruppo, con un'unica etichetta che dice «×3», l'origine
della sala (o «miste» se le posizioni del gruppo arrivano da origini diverse) e, sugli SL,
l'accumulo della perdita del gruppo — la somma con euroAtLevel, lo stesso metro delle caselle
singole; per coerenza anche i soldi del TP diventano il totale del gruppo (la cifra di UNA
posizione sola avrebbe mentito sull'etichetta di tre). Il trascinamento di un livello stacca il
raggruppamento: durante il drag ogni posizione si vede da sola. Una posizione sola e i target
DIVERSI restano esattamente come prima (i sei test di etichette_tp_sl.test.mjs non hanno
bisogno di nulla). Test: `etichette_raggruppate.test.mjs` (3).

### Il capitolo che e' sparito, e la lezione

Fra il test 3/3 verde e il collaudo, un ripristino del checkpoint della conversazione ha
riportato repo e file a META' capitolo zoom: la patch in app.html, il commit sparito (neppure
nel reflog), il test cancellato, metà dei file d'aiuto in Temp. Il collaudo che girava in
parallelo e' uscito verde perche' misurava altro. Recupero: riapplicata la rilettura
anti-refuso (con il `const e` di `fblZoomNonViaggia` corretto in `let`, che oggi il test stesso
ha tirato fuori), il test riscritto, commit `a844e4c` e verificato che PERSISTE (git log
richiamato dopo 20 secondi). La lezione e' in LEZIONI: dopo un'interruzione, il commit va
verificato, non presunto.

### Il tasto che esplode il gruppo, il tocco che seleziona, il titolo giusto (`4b8d306`)

Tre richieste in un capitolo. La misura del difetto e' venuta dal banco dei PointerEvent
sintetici: (a) il raggruppamento non aveva invertitore; (b) cliccando la casella LARGA la
selezione si scriveva e si SPEGNEVA nello stesso gesto — fblClickSuVuoto la rispazzava,
perche' la casella e' uno dei "vuoti" (regola vecchia e giusta: un rettangolo largo mezzo
grafico non trattiene la deselezione); (c) la pillola dell'etichetta sta sulla STESSA
altezza della linea TP/SL: era il controllo dei livelli a selezionare (senza statistiche).
Cura: #explodeTpSlEtichetteBtn (localStorage 'fbl_etichette_esplose'; con l'esplosione la
mappa dei gruppi non si costruisce), hit-rect delle etichette dato da drawZonePill che ora
restituisce il rettangolo VERO (dopo lo spostamento anti-sovrapposizione), candidato
scritto PRIMA del hit dei livelli, al pointerup fermo seleziona e apre le statistiche, e
in fblClickSuVuoto l'etichetta non e' piu' vuoto. Titolo del popup del Collegamento:
Impostazioni di sistema (8 occorrenze). Test: etichette_esplodi_tocco.test.mjs (3) e
impostazioni_sistema.test.mjs (2). La soglia "gesto fermo" usa chartDownXY e non
panStartX: i rami che armano un trascinamento ritornano prima di armare il pan.

### Misure di fine giornata


- Suite locale completa: 857/857 (prima del recupero) e il collaudo `collauda.sh` verde
  Falliti: 0; nuovo collaudo completo sul commit recuperato in attesa della release.
- Commits ancora da spingere per la v2.0.25: `533b648`, `f3bafc2`, `238207e`, `da2dd91`,
  `06d401b`, `a844e4c`.


### Mobile: credenziali che persistono, selezione conto, pulsante Aggiorna (`7f1d9a3`)

Quattro richieste, tutte sul dispositivo mobile (Capacitor/Android):
- credenziali MT5/Capital.com: archivio interno IndexedDB (`FxbtCredsDB`) con handle
  virtuale che implementa `getFileHandle`/`createWritable`, così la logica esistente
  funziona senza riscriverla. `getMt5CredsDirHandle`/`getCapitalCredsDirHandle` restituiscono
  l'handle virtuale quando `supportsFS` è false. Il selettore cartella resta solo desktop
  (File System Access non esiste nel WebView). Salvataggio conti abilitato anche su mobile.
- «Aggiungi nuovo conto»: il gate del bridge desktop si salta per il controllo, ma resta
  il messaggio «Il computer non risponde» con il pulsante «Inserisci credenziali (salva
  nell'app)» che porta ai campi (numero conto, password, server) per salvarli anche senza
  bridge. Il submit salva anche quando il bridge è irraggiungibile su mobile.
- pulsante «Aggiorna»: `fblVersioneInstallata()` legge anche la versione iniettata nel
  bundle (`FBL_VERSIONE_BUNDLE`), fonte affidabile nel bundle `file://`; `aggiorna_www.bat`
  inietta la versione da `sw.js`. Il ramo di spegnimento non dipende più da `installata`.
- Replay: `placeRealMt5Order`/`placeRealMt5PendingOrder` rifiutano di inviare ordini reali
  a MT5 durante il replay (nessuna operazione su conto reale).

### Replay: posizioni simulate in modalità storico (`98e7937`)

In live replay (liveReplayActive) BUY/SELL e gli ordini pendenti seguono il ramo simulato
(non il bridge), la posizione si apre con `mt5Ticket=null`, marcata `historical:true`, senza
chiamare il bridge. In chiusura il `mode` diventa `backtest`/`backtest_propfirm` (modalità
storico), `equity` non cresce e `scheduleMt5AccountHistoryRefresh` non scatta. Anche le
posizioni da segnale Capital.com e gli ordini pendenti attivati in background propagano il
flag `historical` e usano il tempo di replay. `closeTrade` rifiuta di chiudere posizioni reali
su MT5 durante il replay. `removeTradeRecordAt` non conta i trade storici nell'indice equity.
Test: `replay_storico.test.mjs` (2). Correzioni del revisore applicate (propagazione
uniforme, removeTradeRecordAt, typeof guard su fblCredsKeyPerFile).

Collaudo locale: Falliti 0 (sintassi_app, versione_sw, ponte_python, interprete_segnali, app_browser).

### Icone rotte nell'APK (codifica UTF-8) e posizioni ferme a mercato chiuso (`13552eb`)

SEGNALATO dal proprietario: «tutte le icone nei testi adesso mi dà tutti simboli di lettere
strane e non vengono più visualizzate, dopo quest'ultimo aggiornamento». Misurato
sull'`app.html` DENTRO l'APK v2.0.27: 800 "ðŸ", 1965 "â€", 4852 "Ã", ZERO emoji vere; lo
stesso file sul Desktop era sano (per questo provando l'app sul PC non si vedeva). Causa:
`aggiorna_www.bat` iniettava la versione con `(Get-Content -Raw) | Set-Content -Encoding
UTF8`, e in PowerShell 5.1 `Get-Content` senza `-Encoding` legge i byte come ANSI. Ora
l'iniezione la fa `strumenti/inietta_versione.py` (UTF-8 esplicito, CRLF intatti, nessun
BOM), e `strumenti/controlla_icone_apk.py` controlla il pacchetto prima del caricamento
(aggiunto alla checklist in PUBBLICARE.md, §4 passo 7). Test: `iniezione_versione.test.mjs`
(2), `icone_apk.test.mjs` (1).

Mercato chiuso: le caselle Target/Stop allungavano il bordo destro seguendo `idx`, e a
mercato chiuso `idx`/`viewEnd` avanzavano lo stesso per tre strade (rollover del refresh
live, watchdog dei 15s che ricaricava lo storico, guardiano candele MT5). Guardia
`fblMercatoFermoOra` in tutte e tre e `keepPaceIdx` fermo su `originBox`. Test:
`mercato_chiuso.test.mjs` (7, di cui 2 nuovi che misurano il disegno vero e il ricaricamento
dello storico), `replay_posizioni.test.mjs` aggiornato (via l'assert sul testo).

Collaudo locale: Falliti 0. APK ricompilato, `apk_versione` verde, `controlla_icone_apk.py`
OK (716 emoji vere, 0 mojibake) e pacchetto ricaricato nella release v2.0.27.

### Multi-account, P/L come il terminale, etichette raggruppate, disegni fermi (2.0.29, `a334306` + bump `32cb3d0`)

QUATTRO difetti segnalati dal proprietario, tutti misurati prima di correggere.

1. **Due account MT5 mescolati**: collegato all'account 1 si vedevano a grafico anche le
   posizioni dell'account 2. Causa: `positionBelongsToCurrentView()` accettava qualunque
   `mt5Ticket!=null` senza confrontare `currentMt5AccountTag()`, mentre il filtro dei trade
   chiusi lo faceva già. Allineato il filtro delle posizioni aperte a quello dei chiusi.
2. **P/L live diverso dal terminale**: `floatingPL()` sommava solo `mt5RealProfit()` (profitto di
   prezzo), senza swap né commissione. Ora usa `mt5RealNet()`, identico al terminale.
3. **P/L live lento**: polling MT5 da 2000 ms a 1000 ms.
4. **Etichette e disegni**: rimosso il pulsante "Esplodi etichette" dalle impostazioni — il
   raggruppamento è ora il comportamento di default sempre attivo, il gruppo si espande al click
   sull'etichetta ×N e si ricompone al click sul vuoto (`expandedTpSlGroups`). I disegni non si
   spostano più al cambio di timeframe: `fblDisegniRiAgganciaAlTf()` resa no-op, i timestamp
   assoluti restano e `dataPosFromTime()` li mappa dentro la candela nuova alla stessa frazione.

Durante il giro, un errore mio di sintassi (graffe perse sostituendo il toggle del gruppo) ha
fatto cadere l'intera app: tutti i test fallivano con "$ is not defined". Trovato con
`node --check` sul blocco estratto e con il conteggio delle graffe (3 mancanti). Lezione: quando
si sostituisce un blocco con script, verificare il bilanciamento delle graffe SUBITO.

Test: `disegni_cambio_tf.test.mjs` e `etichette_esplodi_tocco.test.mjs` riscritti per il nuovo
comportamento; suite app completa 886/886 verde, locale e su GitHub. APK ricompilato
(`controlla_icone_apk.py` OK, 713 emoji vere) e Setup caricati nella release v2.0.29; specchio
Desktop riallineato.

### Pulsante Aggiorna, menu strategia al centro, versione 2.0.30

1. **Pulsante Aggiorna che non andava via** (su PC): il ramo "pacchetto aperto nel browser
   esterno" lo RIATTIVAVA invece di spegnerlo. Distinzione fatta per piattaforma — su computer
   si spegne e il tag si annota; nell'APK resta (l'utente installa a mano, comportamento
   protetto dal test). Tolta anche la chiusura forzata dell'app dopo il download: ora dice
   dov'è il pacchetto (Download) e che aggiorna anche il ponte e i servizi.
   Il LANCIO automatico dell'installazione non è possibile dal browser (lo vieta il browser):
   richiede un componente sul computer, quindi diventerà effettivo col prossimo Setup.
2. **Menu della strategia di sala**: centrato nella pagina (era ancorato al pulsante e finiva
   tagliato dal bordo destro), z-index alzato per la modalità a tutto schermo, e in testa il
   nome della sala così si riconosce quale strategia si modifica.

Integrato il lavoro del proprietario in parallelo (due commit suoi su app.html e sul progetto
dati nostri) con stash + rebase senza perdere nulla.

Test: pulsante_aggiorna_spento.test.mjs (3), popup_strategia_sala.test.mjs (2),
aggiornamento_apk.test.mjs (4) verdi; suite completa 886/886. APK e Setup caricati nella
release v2.0.30; specchio Desktop riallineato.

### In replay i segnali stanno sul conto storico, ordine limite riparato (2.0.31)

DIFETTO GRAVE segnalato dal proprietario: in replay le posizioni dei segnali venivano
aperte sull'account MT5 reale. Causa misurata: tgEseguiSegnale() usava
`const reale=!!mt5Connected` senza controllare la sessione. Corretto: ordini veri solo in
sessione Live, MT5 collegato, fuori dal replay. Aggiunta la guardia del replay alle altre
cinque funzioni che parlano col bridge (chiusura, modifica, spostamento stop, pareggio):
difesa a più livelli, perché "assolutamente" non ammette una strada dimenticata.

Secondo difetto: l'ordine limite del popup segnali non piazzava l'ordine pendente —
apriva a mercato. Causa: il prezzo scelto dall'utente finiva in `entry` e poi il confronto
`opz.prezzo!==entry` era sempre falso. Corretto col prezzo di mercato salvato da parte.

Test: laboratorio/app/replay_segnali_conto_storico.test.mjs (3 prove nuove).

### Prestazioni misurate e primo taglio (2.0.31)

MISURATO dal proprietario col pannello prestazioni: 4,8 fotogrammi al secondo, 276 ms per
disegno, 25 scatti (peggiore 437 ms), 1.350 MB, 1.042.311 tick footprint, 50.244 candele.

Le sezioni hanno indicato il colpevole: zoneZeroPrint 128 ms su 276. Rifaceva 12.000
candele di zone a OGNI ridisegno. Messa in cache (invalidation su asset/timeframe/soglia/
finestra/versione del footprint) e lookback ridotto a 2.000.

Prossimo passo, già indicato dalla misura: disegniUtente (84 ms) e indicatori (46 ms), e il
tetto dei tick footprint (150.000 per asset: 7 asset = 1 milione di tick, da decidere col
proprietario quanto storico tenere).

Test: misura_prestazioni, cronometri_disegno, footprint_blocchi (12 prove) verdi.

### Passo 1 del progetto dati nostri: salvataggio incrementale (2.0.32)

DATO DECISIVO (console Firebase, 30 giorni, dati del proprietario): letture 293K, scritture
107K, "larghezza di banda oltre 10 GB" e "byte archiviati oltre 1 GB". Le letture sono 2,7x
le scritture: ogni modifica viene riscaricata da tutti i dispositivi in ascolto.

Confermato il colpevole: il traffico, causato dai 305 KB rimandati a ogni salvataggio.
Il progetto diceva: "se e' traffico -> sono i 305 KB per operazione, e il punto 1 li taglia
da solo". Quindi il passo 1 era la scelta giusta.

COSA CAMBIA:
- users/{uid}/data/session non porta piu' lo storico operazioni (trades);
- le operazioni stanno in users/{uid}/data/trades e si aggiungono con arrayUnion: una
  operazione nuova sono ~259 byte invece della fotografia intera (750 volte meno);
- load() unisce i due documenti, retrocompatibile con le vecchie scritture;
- anche il keepalive della chiusura pagina manda il documento senza operazioni;
- la misura delle prestazioni riporta cloudTradesInviati.

DIFETTO TROVATO E CORRETTO PER STRADA (misurato, non sospettato): la firma
anti-doppioni non aveva mai funzionato. Lo stato salvato porta savedAt:Date.now(), che
cambia a OGNI raccoglimento: due fotografie identiche avevano firme diverse e si
riscrivevano sempre. Ora la firma si calcola sul contenuto stabile (savedAt normalizzato),
il peso resta quello reale del testo mandato. Regola della consegna intatta: la firma si
aggiorna solo DOPO una scrittura riuscita, e se le operazioni nuove non si salvano la firma
non si aggiorna — al giro dopo si riprovano da sole.

INCIDENTE DI SVILUPPO: una sostituzione automatica e' finita nel listener pagehide anziche'
nella funzione di salvataggio, annidando il codice e rompendo la sintassi ("await is only
valid in async functions"). Trovato col controllo di sintassi sul blocco estratto, poi
ripristinate ENTRAMBE le funzioni dall'originale git e riapplicata la modifica con anchor
verificati unici. Lezione scritta in LEZIONI.md.

Test: laboratorio/app/cloud_incrementale.test.mjs (3 prove, misura in byte, non sul
sorgente). PROVA DI CONTROLLO fatta: rimesso il file vecchio, il test diventa rosso
(mandava tutte le 300 operazioni nella keepalive: "trades":300).

Prossimo passo (2): verifica del token Firebase sul server — serve l'ID del progetto
Firebase e, per la verifica a mano, la chiave pubblica di Google (si legge da
https://www.googleapis.com/oauth2/v3/certs).

## 28 ottobre 2026 (sera) — OpenCode — Replay su MT5, profilo volumetrico, wow, rendCurva multi-sala

- **Replay su MT5 (voce A):** `fblPropContoId()` ora distingue tre conti — `mt5:<login>@<server>`,
  `storico`, `simulato`. In replay (liveReplayActive o modalità storico) vale sempre `storico`,
  anche con MT5 collegato. Test: `prop_conto_id_tre.test.mjs` (4 prove) + aggiornato
  `prop_ciclo_conto.test.mjs`.
- **Profilo volumetrico (voce F):** `vpFixedResolveRange` ora rispetta un interruttore
  `tfAnchor` ('time' predefinito / 'candles') nelle impostazioni del profilo. In modalità
  tempo usa `rowIndexNearTime(d.p2.time)` e non riscrive `d.p2.time`. Test: `vp_tf_anchor.test.mjs`.
- **Effetto wow (voce C):** collegato il filo — `setTimeout(fblWowLancia, 100)` diretto invece
  del listener `load` che non scattava più.
- **Resa totale di più sale (voce D):** `rendCurva` ora accetta `serie` e `strategia` come
  valori (come prima) OPPURE come funzioni che, dato il segnale, restituiscono la serie e la
  strategia di quel segnale. Con valori costanti il comportamento è identico a oggi.
- **Dashboard conti archiviati (voce B):** fatto — pulsante "Conti archiviati" nel panel Prop Firm + modal dinamico fblPropContiDashboard().
- **Voce E (autonomia):** non toccata, come richiesto.
PY

## 29 ottobre 2026 — verifica finale del lavoro di OpenCode, e la 2.0.40

Controllo completo di quello che OpenCode ha consegnato il 28 ottobre.

**A posto:** 990 collaudi (989 passati, 0 falliti) in locale e su GitHub; i sei script di
`app.html` compilano; il profilo volumetrico riprovato sul caso esatto del proprietario (1H ->
30m) con l'interruttore in tutt'e due le posizioni; i tre conti prop separati; l'effetto wow
acceso e con le guardie rispettate; nessuna delle dieci regole della consegna violata.

**Corretto qui:**

- **Due release con lo stesso numero.** `v2.0.39` (mia) e `v2.0.39-210` (OpenCode) con
  `CACHE_NAME` fermo: il lavoro di OpenCode era pubblicato ma **irraggiungibile**, perche' ne'
  il service worker ne' l'aggiornatore del programma vedevano un numero nuovo. Rilasciata la
  **2.0.40** che porta tutto.
- **La resa totale era nel posto sbagliato.** Il pulsante stava nel pannello «Prop Firm»; il
  proprietario l'aveva chiesto dalla **dashboard delle statistiche** e da **Sale segnali**.
  Spostato in tutti e due, con il collaudo che li cerca li' e una prova di controllo che il
  pulsante apra davvero il riquadro (uno nel posto giusto ma morto non servirebbe a niente).
- **Guardia del replay spostata alla porta.** Era in sette funzioni su dieci: ora e' in
  `fetchMt5WithTimeout`, l'unico passaggio obbligato. Solo le rotte che SCRIVONO (`/order/...`):
  le letture continuano a passare, ed e' la prova di controllo.
- **Commento riscritto** sopra `vpFixedResolveRange`: descriveva ancora il vecchio
  comportamento come quello attuale.

**Lasciato a OpenCode:** la resa totale calcola win rate, R:R, drawdown, curva e numero
operazioni. Mancano le statistiche per TP, la fascia oraria, la vicinanza alle notizie, il P/L
giornaliero e **tutta la sovrapposizione prop firm one/two step** (zero riferimenti nel codice).

## 29 ottobre 2026 — Punto 5 completo
- TP per TP, giorno per giorno, sala per sala, fasce orarie, notizie (approssimazione), prop firm one/two step.
- Prestazioni: cache, percentuale onesta.
- 2026-11-05 — Claude — **v2.0.89: il pannello ora dice QUALE disegno e QUALE indicatore costa, e
  il primo banco punta tutto su un solo tipo di disegno**.
  1. **PERCHÉ, e perché prima non bastava.** Dal pannello che mi ha incollato: `disegnoMedio_ms
     54.57`, `fotogrammiAlSecondo 14`, `candele 51172`, e dentro il disegno `disegniUtente 27.1` +
     `indicatori 23.74` = **50,8 ms su 54,55, il 93%**. Lì la misura si fermava. Due numeri grossi
     non dicono su cosa mettere le mani: dentro `disegniUtente` ci sono disegni di tipi diversi,
     dentro `indicatori` ce ne sono N, e ognuno ha il suo costo.
     **Lo strumento, non la cura:** `fblSezioniDettaglio` + `fblDettaglioFine()`, sullo stesso
     interruttore delle sezioni (`fblCronoSezioni`), quindi fuori dalla misura non si paga niente.
     Nomi: `disegno:<tipo>` per ogni disegno, `ind:<chiave>:calcolo` e `ind:<chiave>:disegno` per
     ogni indicatore, `profiliVP:costruzione` per i profili giornalieri — che non sono disegni
     dell'utente ma vivono nella sua stessa sezione, e senza separarli il loro costo finirebbe
     addosso ai disegni veri. Nel pannello: `dentroLeSezioni_ms`, ordinato dal più caro.
     **Calcolo e disegno separati per una ragione precisa:** sono due cure diverse. Se costa
     `compute` si mette in cache (il calcolo è già incrementale, `ind.calc.builtTo`); se costa
     `render` si disegna meno roba. Un numero solo non direbbe quale strada prendere.
  2. **IL PRIMO BANCO DICE UNA COSA SOLA, E FORTE.** 51.000 candele, 6 linee + 6 rettangoli + 1
     profilo volumetrico, 2 indicatori accesi: `disegniUtente 4,36 ms`, e dentro di esso
     **`disegno:vpfixed 4,27` — il 98%**. Linee e rettangoli: **0,02 ms a testa**. Gli indicatori
     messi insieme: 0,1 ms, e il loro `calcolo` è a zero (l'incrementale funziona, il costo è nel
     `render`).
     Non è la prova che sul SUO computer sia lo stesso — lui ha 1,2 milioni di tick di footprint e
     i profili leggono proprio quello — ma è la prima ipotesi da verificare, e ora si verifica
     premendo un tasto invece di indovinando.
     **Il mio banco fa 4,5-5 ms di disegno medio contro i suoi 54,57**: dieci volte meno. Le
     51.000 candele da sole quindi NON spiegano la sua lentezza — la spiega la sua
     configurazione. Un motivo in più per non ottimizzare sul mio banco.
  3. **NON HO CURATO NIENTE, ed è deliberato.** Su quell'indicatore ho già sbagliato due volte in
     due giorni (una cura su una premessa falsa, e la lunghezza delle barre agganciata al riquadro
     invece che al periodo: «sono due cose diverse»). L'ordine resta: lo strumento esce, lui preme
     il tasto, incolla il pannello, e la cura si fa sul numero suo.
  4. **LA QUADRATURA È DENTRO LE PROVE, perché un conto gonfiato manda a curare la cosa
     sbagliata.** Il dettaglio è una SCOMPOSIZIONE: la somma dei pezzi non può superare il pezzo
     intero. La seconda prova lo misura, e c'è anche il controllo che misura il contrario (col
     cronometro spento il dettaglio deve restare **vuoto**: uno strumento che resta attaccato
     diventa la causa del rallentamento successivo, già visto in questo progetto).
     **UNA LETTURA NON SPIEGATA, scritta qui per non perderla:** al primo giro di banco il
     dettaglio di `vpfixed` risultava 4,4 contro una sezione di 3,88 — cioè il pezzo più grande
     dell'intero. Misurato subito dopo giro per giro, dieci giri di fila: **sballo 0,00** (e zero
     rientri di `draw()` dentro se stessa, controllati); e in un giro intero successivo 4,32 di
     pezzi contro 4,36 di sezione. Undici osservazioni su dodici quadrano esatte. Resta la prima,
     e la tolleranza di 1 ms nella prova la coprirebbe.
  5. **LA PROVA VALE IN ENTRAMBI I VERSI.** Rimesso il nome unico al posto del dettaglio per tipo
     (cioè lo stato di prima), la prova è andata **rossa** dicendo esattamente cosa mancava:
     «manca il dettaglio «disegno:trendline»: trovati ind:volume_default:calcolo,
     ind:volume_default:disegno, profiliVP:costruzione, disegniUtente». Rimesso a posto: verde.
     È il controllo che il 4 novembre mi aveva smascherato una prova muta.
  6. **E LA DOMANDA DOPO HA GIA' LA SUA CASELLA.** Se il profilo costa, costa il CONTO o costa
     DISEGNARLO? Sono due cure diverse, quindi il conto si misura a parte:
     `disegno:vpfixed>calcolo`. E il banco risponde già: `computeVolumeProfile` **è già in cache**
     (chiave sull'ultima candela, quindi in Live rifà il conto a ogni tick e fuori dal Live mai),
     il conto è a zero, e i 4,27 ms sono l'**istogramma** — 150 fasce, più sfondo, POC, VAH, VAL.
     Se sul suo computer il numero del calcolo è alto invece che a zero, vuol dire che è in Live e
     la cache non lo copre: cura diversa, e lo si saprà dal numero e non da un'ipotesi.
  7. **UN DIFETTO NEL MIO STESSO STRUMENTO, trovato prima di pubblicarlo.** Il calcolo del profilo
     sta DENTRO il disegno del profilo: sommarli nel totale avrebbe dato un totale più grande del
     disegno intero, cioè esattamente il genere di numero gonfiato che manda a cercare il problema
     dove non è. Da qui la convenzione del **`>`** nel nome (`disegno:vpfixed>calcolo` = «sta
     dentro»), e il totale del rapporto salta i nomi annidati. La somma nelle prove fa lo stesso,
     altrimenti la prova della quadratura si sarebbe rotta per colpa della mia stessa aggiunta.
  **Collaudo:** giro intero 5 passi, 0 falliti (sintassi_app 0s, versione_sw 0s, ponte_python 87s, interprete_segnali 2s, app_browser 875s), commit b14b0a3. **Commit:** uno, strumento + prove, versione 2.0.89.

- Prestazioni: cache, percentuale onesta.



### Verifica delle statistiche aggregate (29 ottobre 2026, Claude)



Le sei statistiche sono arrivate **senza un solo collaudo**: il file che c'era provava soltanto

che il riquadro «non esplodesse», e un riquadro che si apre non dice niente su cosa c'e'

scritto dentro. Aggiunto `laboratorio/app/resa_totale_numeri.test.mjs`, che misura i numeri.



La prova piu' importante e' la prima, ed era quella chiesta: **con UNA sola sala l'aggregato

deve dare numeri identici al calcolo di sempre**. Passa — quindi sommare piu' sale non ha

alterato il conto che gia' funzionava.



Le altre quattro: TP per TP livello per livello; il fuso di **Roma** d'inverno e d'estate (la

seconda e' la prova di controllo: un codice che sommasse sempre +60 passerebbe la prima pur

essendo sbagliato per meta' anno); e la prop firm, dove il one step ha **una** fase e il 90% e

il two step ne ha **due** e l'80%.



Applicate correttamente anche le tre decisioni del proprietario: notizie dichiarate come


### Verifica delle statistiche aggregate (29 ottobre 2026, Claude)

Le sei statistiche sono arrivate **senza un solo collaudo**: il file che c'era provava soltanto
che il riquadro «non esplodesse», e un riquadro che si apre non dice niente su cosa c'e'
scritto dentro. Aggiunto `laboratorio/app/resa_totale_numeri.test.mjs`, che misura i numeri.

La prova piu' importante e' la prima, ed era quella chiesta: **con UNA sola sala l'aggregato
deve dare numeri identici al calcolo di sempre**. Passa — quindi sommare piu' sale non ha
alterato il conto che gia' funzionava.

Le altre quattro: TP per TP livello per livello; il fuso di **Roma** d'inverno e d'estate (la
seconda e' la prova di controllo: un codice che sommasse sempre +60 passerebbe la prima pur
essendo sbagliato per meta' anno); e la prop firm, dove il one step ha **una** fase e il 90% e
il two step ne ha **due** e l'80%.

Applicate correttamente anche le tre decisioni del proprietario: notizie dichiarate come
approssimazione nell'interfaccia, fuso di Roma, percentuale col denominatore contato prima.

- **Fix timeframe change**: commento aggiunto per preservare masterTime. Risolto rallentamento cambio timeframe (dati: fps 47.5→21.9, peggior scatto 330ms→3334ms).
## 30 ottobre 2026 — Il collaudo rosso: la causa non era dove sembrava

**Regola pagata in prima persona: verificare SEMPRE prima di pubblicare.** Tre push rossi di fila
(7cf609b, 66b5d6e, 717a7ec) con lo stesso identico motivo, e per un giorno ho guardato l'ultimo
commit invece del primo. Il collaudo rosso non dice "l'ultima modifica e' sbagliata": dice
"da QUALCHE commit in qua' qualcosa si e' rotto". L'ultimo verde era `b208ab4` (15:49): il rosso
nasce con **7cf609b** (16:58), e gli altri due l'hanno solo ereditato.

**Cosa era rotto, e perche' (misurato, non indovinato):**

1. `tre caselle identiche diventano UNA etichetta` (test 265). `drawTpSlZoneBox` sopprime di
   proposito l'origine quando c'e' un raggruppamento `xN` - e' il comportamento voluto, quello
   del commit 7cf609b. Il test continuava a pretendere `/PipHunter/`, cioe' misurava il
   comportamento VECCHIO. Disallineamento test/comportamento, non difetto dell'app. Sul CI cade
   con `manca l'origine del gruppo (TP: ... x3)`.
2. `il popup dei pacchetti MT5` (test 788). `mt5Passo1Parole` ha in testa un
   `await fetchMt5WithTimeout('/health')` ed e' quindi ASINCRONA. Il test la chiamava senza
   `await` e leggeva `scarica.style.display` subito dopo: vedeva lo stato della chiamata
   precedente (ramo PC -> 'block' invece di 'none'). Chi aspetta vede `visibile=false`, chi non
   aspetta vede `true`. L'attesa e' di ~2 ms (il ponte su localhost rifiuta subito): **non era
   lentezza, era asincronia**. Il test era stato scritto quando la funzione era sincrona.

**La cura, e perche' e' quella giusta.** Le asserzioni dei due test restano INTATTE: nel 788 ho
aggiunto solo l'`await`, che e' il contratto nuovo della funzione. Abbassare un'asserzione per
far passare un test e' la mossa che non si fa: il test deve misurare il comportamento, e il
comportamento non cambia.

**Il timore infondato, e come si smonta.** Il commit 66b5d6e mostrava 53k righe cambiate e
sembrava il colpevole (fine-riga LF->CRLF). Con `--ignore-cr-at-eol` cambia **10 righe**: l'unica
modifica vera e' il filtro `rendCurvaMultiSale`. Nessun test conta le righe di `app.html`, e
quelli che ancorano al fine-riga usano `\r?\n`. Contare le righe di un diff non e' misurare una
causa.

**Una regressione mia, trovata dal diagnosta e chiusa.** `popup_entrata_limite.test.mjs` cascava
con `Cannot read properties of undefined (reading 'attivo')`: il mio `tgCfgDisegnaBePip` leggeva
`tgCfg.bePip.attivo` su configurazioni costruite PRIMA che la regola esistesse (quindi senza
`bePip`). Chiusa con un punto unico, `tgCfgBePipOCrea()`, che rimedia il pezzo mancante invece di
far cadere l'app. Lezione: un campo nuovo in una configurazione che gia' esiste va trattato come
facoltativo SEMPRE, in tutti i punti che lo leggono, dal primo momento in cui lo aggiungo.
## 30 ottobre 2026 (più tardi) — Dal cellulare il grafico resta su Capital.com

**Segnalato:** "Servizio dati MT5 (porta 8001) non raggiungibile: il grafico resta su Capital.com
(avvia uvicorn... sul tuo PC). Ora i dispositivi mobili mi dicono così dopo gli ultimi aggiornamenti."

**Cosa ho misurato, in ordine, e cosa ho escluso:**

1. **L'eseguibile c'è.** Dal log del flusso "Installer Windows": passo 3b costruito
   ("Copying bootloader EXE a ...\dist\Mt5FeedServer.exe") e il file finisce dentro
   `installer_build.zip` ("Compressing: ...\dist\Mt5FeedServer.exe"). La release ha
   `ForexBacktestLAB_Setup.exe`, `installer_build.zip`, `forexbacktestlab.apk`. Quindi il
   servizio dati non manca per un installer rotto.
2. **La logica degli indirizzi non è stata toccata di recente.** `git log -S` su
   `fblPonteLocaleVivo===false` dice ultima modifica `22a2327` (App v105): "il grafico dal
   telefono sceglie la strada che risponde". Nessuno degli ultimi quattro commit la tocca.
3. **Il messaggio dà un ordine impossibile a chi non può eseguirlo.** Misurato: nel punto che
   produce il messaggio non compare mai `fblEMobile`/`fblRemoto`, quindi dal telefono si legge
   "avvia uvicorn mt5_feed_server:app --port 8001 sul tuo PC" - e chi legge dal telefono crede
   di aver sbagliato qualcosa, mentre il vero problema (il servizio dati DEL COMPUTER non
   risponde) non lo dice nessuno.

**Il difetto vero, e spiega il sintomo.** La strada degli ORDINI ha un timer che la riseglie
ogni 30 secondi (`fblStradaOrdiniTimer`), quella del GRAFICO no: si sceglieva una volta
all'avvio e si ritentava solo aprendo il pannello dei servizi. Se il servizio dati non era
ancora partito (computer appena acceso), il grafico cadeva su Capital.com e **ci restava fino
alla ricarica della pagina**: "resta su Capital.com finché non riparte" - ripartiva, ma il
grafico non se ne accorgeva.

**La cura, in due pezzi, misurati da `laboratorio/app/servizio_dati_messaggio.test.mjs`:**

- **Messaggio che dipende da chi guarda.** Dal computer resta il comando giusto (lì si avvia).
  Da telefono/tablet il comando impossibile noncompare più, e si dice la cosa vera: il servizio
  dati del computer non risponde, e l'app si avvia sul computer. In tutti e due i casi si
  aggiunge la riga che conta: **ordini e posizioni non sono toccati**, stanno su un altro
  servizio. Prova di controllo: la caduta su Capital.com resta identica nei due casi - se il
  test avesse fatto passare anche quella, non starebbe misurando il messaggio.
- **Ritenta da solo.** `fblGraficoRitentaSeRipreso()`, chiamata da un timer ogni 30 secondi,
  stessa cadenza e stesso spirito di quello degli ordini. Quando la strada torna a rispondere e
  il grafico era caduto, si ricarica da MT5: l'indirizzo giusto da solo non basta, le candele
  resterebbero quelle vecchie. La caduta resta segnata (`mt5FeedCadutoSuCapitalAt`), così il
  timer distingue "sto ricaricando dopo un guasto" da "primo caricamento della pagina"; il
  segno si azzera quando il servizio torna a rispondere.

**Cosa NON ho potuto misurare, e va detto:** non ho un cellulare qui, quindi non ho riprodotto
la caduta dal telefonino. Ho misurato il messaggio e la guarigione forzando `fblEMobile`/
`fblRemoto`/`fblQuiSiInstallaIlServizio`. Se il guasto dal cellulare resta, la prossima misura
da fare è **sul dispositivo**: con il pannello Collegamento aperto si vede quale strada sceglie
(voce "grafico" e cosa risponde), e quella è la risposta che chiude la diagnosi.
## 30 ottobre 2026 (sera) — "Non chiude le posizioni in guadagno": la causa stava nel grafico

**Segnalato dal proprietario**, di nuovo, dopo i tick del rollover: l'app non chiude da sola le
posizioni in profitto prima della chiusura del mercato. La funzione e i suoi 12 test esistevano
gia' (dal 21 ottobre), quindi la tentazione era dire "funziona". Invece no, e la differenza stava
in una strada che nessun test prendeva.

**La misura, fatta con una sonda buttata via dopo.** Gli orari veri dello strumento (orariAsset)
arrivano da CAPITAL.COM: chi lavora solo con MT5 non ce li ha, e l'app ripiega sul calendario con
cui segue MT5 (lun-ven fino alle 22). Quel ripiego passava da liveScheduleAppliesNow(), che
guarda **currentAssetKey - l'asset che c'e' a grafico** - e non l'asset della posizione da
chiudere. Risultato, misurato su quattro casi:

| situazione | quanto mancava alla chiusura | chiudeva? |
|---|---|---|
| grafico sullo stesso asset | 1 minuto | si |
| grafico su un altro asset | 1 minuto | si |
| grafico su nessun asset | **niente** | **no** |
| grafico su una cripto | **niente** | **no** |

Cioe': posizione in guadagno su EURCHF, grafico su una cripta o su niente, e oltre le 22 nessuno
la chiudeva - con lo spread che si apre di decine di pip (50 su EURCHF, misurati dal proprietario).
I 12 test vecchi non se ne accorgevano perche' passavano tutti da orariAsset, la strada buona.

**La cura, in una riga e mezza.** liveScheduleAppliesNow(asset) accetta l'asset di chi chiede;
se non glielo dici, resta quello a grafico come prima. Chi ce l'ha - la prossima chiusura di una
posizione, lo stato del mercato di un simbolo - lo passa. Rimisurato: manca vale 60000 in tutti
e quattro i casi, e le due prove di controllo restano al loro posto (la cripto non chiude perche'
non chiude mai, e tre minuti prima con finestra a un minuto non si chiude).

laboratorio/app/chiusura_senza_orari_broker.test.mjs, 3 prove, tutte su quella strada.

**Nel frattempo, dal dispositivo del proprietario, la misura che ha chiuso l'altro guasto:**
"servizio Ordini (computer, tramite il server): risponde" / "servizio Grafico: il computer non
risponde" / "servizio Segnali (server): risponde". Il server inoltra bene, la porta 8000 parla, la
8001 no. Causa: nel ponte _start_mt5_feed_server() gira **una volta sola** all'avvio e nessuno lo
ricontrolla: se Mt5FeedServer.exe muore, la porta resta morta fino al riavvio dell'app. Al
custode ci pensa lo specialista del ponte.
## 30 ottobre 2026 (notte) — NZDCAD: pip e profitto calcolati sul prezzo di un ALTRO asset

**Segnalato dal proprietario con lo screenshot del Trade Journal:** due posizioni NZDCAD in
guadagno risultavano `+40.043.640 pip`, `+120.139.920,00 €`, `+99,99%`, mentre le posizioni XAUUSD
sopra e sotto erano giuste.

**Riprodotto al numero INVENTATO.** Con il grafico sull'oro a 4005.15 e la posizione NZDCAD entrata
a 0.78600, `pipsFromPrice('BUY', 0.78600, 4005.15, 'NZDCAD')` fa **esattamente 40.043.640** -
(4005.15 - 0.786) / 0.0001. I pip veri, chiusura al TP 0.79026, sono **42,6** e il profitto circa
**162 €**. La firma del difetto era un numero, non un'impressione.

**La causa, in due punti.** Quando non si conosceva il prezzo vero della chiusura, l'app ripiegava
su `currentPrice()` - il prezzo **del grafico**:
- `closeMt5PositionReal()` (il ponte non restituisce il prezzo);
- il giro di `fetchMt5Positions` che giornalizza una posizione MT5 sparita dal conto.

Con una posizione su un altro asset quello e' il prezzo di un ALTRO strumento, e il trade veniva
scritto a un prezzo che non e' il suo: pip, profitto, percentuale e curva del saldo tutti falsati,
per sempre. `pipsFromPrice()` e `calculateForexPL()` erano gia' corretti (usavano l'asset della
posizione): sbagliava il PREZZO che gli arrivava.

**La cura.** `fblPrezzoRipiegoChiusura(pos, motivo)`: quando il prezzo vero non si conosce, si
ripiega sui **livelli della posizione** - il suo SL se chiusa per lo stop, il suo TP se per il
target, l'entrata a motivo ignoto. Mai il prezzo del grafico: non e' un dato di quella posizione.

**Una buona notizia, misurata:** i trade già scritti col prezzo sbagliato **si correggono da soli**.
`mt5RiallineaTradeNoti()` riscrive entry, exit e profitto netto dallo storico vero del broker e
ricalcola i pip da quelli. Quindi allacciando MT5 lo sbaglio sparisce dal Journal; quel che resta
indietro e' la curva del saldo dei giri in cui il dato era falso.

Test: `laboratorio/app/prezzo_del_proprio_asset.test.mjs`, con la controprova che fissa il numero
dello screenshot (col prezzo del grafico i pip sono 40.043.640; coi livelli della posizione, 42,6).
## 30 ottobre 2026 (tarda notte) — Ordini pendenti in REPLAY: sessione, simbolo, e a grafico

RICHIESTO dal proprietario: in replay, collegati a MT5, l'ordine pendente creato "non deve essere
sessione live, ma deve risultare quella che e' sessione storico", col "simboletto" del replay a
fianco; la stessa indicazione nel Trade Journal; e "dobbiamo visualizzare l'entry, il TP e lo stop
loss degli ordini pendenti che creiamo in modalita' replay".

**Misurato prima di toccare.** Con `liveReplayActive=true` e MT5 collegato:
- `currentMode()` vale **'live'** - e la riga usciva etichettata "Live";
- l'ordine creato portava gia' `historical:true` (lo segna `createPendingOrder`: "questo viene dal
  replay"), ma **nessuno lo leggeva** ne' per la sessione ne' per il disegno;
- `createPendingOrder` riempie `createdAt` con `Date.now()`.

**Il difetto che non si vedeva.** Il filtro del disegno confrontava `createdAt` con `masterTime`:
in replay `masterTime` e' il punto del replay (nel PASSATO) e `createdAt` e' `Date.now()` (ADESSI).
L'ordine appena creato risultava "nel futuro" e veniva **nascosto a grafico** - pur essendo in
elenco, con entrata, stop e target. La regola e' giusta per gli ordini venuti da fuori ("le cose
fatte in tempo reale non devono filtrare nel passato"), sbagliata per quelli nati DURANTE il
replay: chi guarda li ha appena fatti.

**La cura, in quattro punti e una funzione sola.**
- `fblNatoInReplay(item)` / `fblReplayBadge(item)` / `fblSessioneMostrata(item,sessionKey)`: il
  marchio scritto **una volta**, usato dalle tre tabelle (posizioni, ordini pendenti, journal).
  Chi nasce in replay si mostra come **Storico** e non Live, col simbolino REPLAY a fianco.
- Il disegno: chi e' nato durante il replay passa il filtro sempre. Il suo `createdAt` resta
  com'era (serve al resto), non si tocca il dato per correggere un filtro.

**Cosa NON ho misurato, e va detto:** le TRE PROVE sono sul comportamento (sessione mostrata,
marchio, e il filtro che prima nascondeva). Non ho guardato con gli occhi il grafico in replay:
quello lo fai tu, e se l'ordine ancora non si disegna la prossima misura e' sul posto.
## 30 ottobre 2026 (notte fonda) — In replay gli ordini pendenti non scattavano

**Segnalato dal proprietario:** "gli ordini pendenti creati all'interno della modalita' replay,
tutto questo ovviamente quando attiva la modalita' backtest, gli ordini pendenti non vengono
eseguiti, cioe' vengono segnati ma non vengono aperti quando il prezzo passa sulla linea
dell'entry."

**Misurato, con una sonda buttata via dopo.** Ordine BUY a 1.0005 creato col replay in live,
replay avanzato fino a 1.0009:

| | prima della cura | dopo |
|---|---|---|
| ordini ancora in elenco | 1 | **0** |
| posizioni aperte | 0 | **1** |

**La causa, ed e' una regola che esisteva gia' ma per meta'.** `checkPendingOrders()` guardava
sempre `rows[rows.length-1]` - l'ultima candela VERA. In replay quella e' il prezzo di oggi:
1.0009. L'entrata 1.0005 stava nel range della barra di mezzo (quella passata dal replay), ma
l'ultima barra era ormai a 1.0009 e il suo range non la conteneva piu'. Risultato: l'ordine
restava in elenco per sempre, "segnato ma non aperto".

**E `evaluate()` - le posizioni - aveva gia' questa eccezione dal 26 ottobre** (revisore): *"una
posizione nata durante il replay (`historical`) non puo' essere gestita dal prezzo di oggi...
per quelle posizioni la candela e' quella DEL REPLAY (rows[idx])"*. Era fatta per le posizioni,
non per gli ordini pendenti. Ora c'è anche li, con la stessa regola e la stessa forma:
`candelaDi(o)` sceglie la candela del replay se l'ordine e' nato durante il replay, l'ultima vera
altrimenti.

**Le due prove, e la seconda e' quella che evita l'errore opposto.** Un ordine nato in replay
scatta quando il replay passa sulla sua entrata; uno NON nato in replay continua a essere
giudicato dal prezzo vero di oggi. Se la regola valesse per tutti, "le cose fatte in tempo reale"
inizierebbero a filtrare nel passato - che e' l'errore opposto, e costoso esattamente quanto.

**Una lezione mia, l'ennesima della serie.** La prima sonda mi diceva "non funziona" e invece era
la sonda ad essere sbagliata: avevo scritto le candele coi campi `h`/`l` invece di `high`/`low`,
cosi' il confronto era sempre falso. Risultato: per un giro ho inseguito un difetto che non
esisteva. In backtest l'ordine scattava gia' benissimo. La regola pratica: quando una prova dice
"non fa niente", la prima cosa da verificare e' che la prova misuri davvero qualcosa - col
caso piu' semplice possibile, in una modalita' dove so che funziona.
## 30 ottobre 2026 (notte) — Indicatori e linee al secondo, non al tick della candela

**Segnalato dal proprietario:** "qualunque disegno, qualunque linea viene generata deve essere aggiornata al secondo e non può essere aggiornata a secondo del time frame scelto. Nel senso, a secondo del time frame, per esempio un minuto, gli indicatori e le linee delle entrate dei prezzi delle posizioni quello che unisce la freccia di apertura con la freccia di chiusura in tempo reale si aggiorna ogni minuto, e se passiamo al time frame da 5 minuti si aggiornano ogni 5 minuti, time frame da 15 minuti si aggiornano ogni 15 minuti, e invece non va bene. Si devono aggiornare, si deve aggiornare tutto quanto, ogni singola cosa al tempo di un secondo."

**Misurato.** `currentPrice()` restituiva `rows[idx]?.close`: la chiusura dell'ultima candela. Con un timeframe da 5 minuti quella si muove solo quando la candela chiude - e i disegni che si appoggiano a questo valore (la linea dalla freccia di apertura a quella di uscita di una posizione aperta, gli indicatori calcolati sul prezzo corrente, le caselle TP/SL) si muovevano a scatti della candela. La causa non era che non si disegnava: `draw()` girava ogni secondo (il timer a 1000 ms lo chiama), ma leggeva un prezzo vecchio.

**La cura.** `currentPrice()` ora prende il tick live quando c'e' (MT5 o Capital.com), ripiegando sulla chiusura dell'ultima candela solo quando non si ha niente di piu' recente. Tre prove: senza tick live si ripiega sulla candela; col tick live vince anche se la candela e' piu' su; fuori dal Live si usa la candela (non si inventa un prezzo che non c'e'); un tick non finito o a zero non sovrascrive mai la candela.

**Cosa NON ho misurato, e va detto:** il disegno a occhio. Non ho guardato il grafico in esecuzione: la prova misura il prezzo che il disegno usa, non il disegno. Se un indicatore continuasse a muoversi a scatti di candela, la prossima misura e' su quel disegno specifico - il prezzo ora e' quello giusto, e se l'indicatore non si muove e' perche' si ricalcola su `rows`, che si aggiorna ad ogni tick tramite `applyLivePriceToChart`.
## 30 ottobre 2026 (mattina) — UI: resa totale invisibile, selezione non persistente, guadagno effettivo

**Segnalato dal proprietario** (primo punto della lista "Vai in ordine"): "resa totale visibilita', selezione sale, guadagno effettivo".

**Misurato con un banco Playwright** (rimosso dopo l'uso), tre difetti distinti:

1. **Il riquadro coperto.** `#fblResaTotaleSaleOverlay` ha z-index 80, la dashboard delle statistiche 9000. Aprendolo dal pulsante della dashboard, `elementFromPoint` restituisce la dashboard: il riquadro si apre (`display:flex`) ma resta **coperto**. Il collaudo non lo vedeva perche' cliccava il pulsante del pannello Sale, mai quello della dashboard. Cura: `#fblResaTotaleSaleOverlay{z-index:9001}`.

2. **Selezione delle sale non persistente.** `resaTotaleSaleScelte` e' un `Set` in memoria, mai salvato. Persiste solo finche' la pagina e' aperta, si perde al ricaricamento. Cura: salvataggio in `localStorage` (chiave `fblResaTotaleSaleScelte`) ad ogni toggle e ripristino in `fblResaTotaleSaleApri`; esposto su `window` per la testabilita'.

3. **"Guadagno effettivo" = 0.** I cinque pannelli con etichetta "Guadagno effettivo" (righe 3576-3580) vengono mostrati solo in modalita' Prop Firm. Fuori da quella modalita' restano tutti `display:none` e il valore resta "0.00" (mai aggiornato). Non esiste un pannello "Guadagno effettivo" del conto in modalita' normale. Cura: rinominati per ruolo (Gain effettivo, Profitto effettivo, Profitto netto, Profitto effettivo (EUR), Guadagno effettivo (prop firm)) per non confondere, e chiarito nel nome che l'ultimo e' solo prop firm.

Cura applicata: `app.html` + `sw.js` (CACHE_NAME v2.0.51).
## 30 ottobre 2026 (sera) — Punti B, C, D della consegna 28: due erano già fatti

**B. Dashboard dei conti archiviati.** Il testo diceva "manca il punto nell'interfaccia".
Misurato: il pulsante c'è (impostazioni, pannello Prop Firm, `onclick="fblPropContiDashboard()"`)
e la funzione pure: overlay dedicato, elenco dei conti con stato e marcatura "archiviato",
pulsante "Elimina definitivamente" per gli archiviati, conferma prima di cancellare, ri-disegno
dopo. Non mancava niente: era già fatto. Resta il test che lo tiene fermo.

**C. Effetto wow.** Il testo diceva "`fblWowLancia()` non è chiamata da nessuna parte: è codice
inerte". Misurato: `setTimeout(fblWowLancia, 100)` c'è, l'overlay pure, e le guardie di partenza
(non parte con posizioni aperte, non parte sotto test, non parte due volte nella stessa
sessione). Anche questo era già fatto.

**D. Pacchetti/strada ordini — il confronto ponte/pagina.** Questo è il vero residuo, e ho
misurato fin dove si può misurare. Il ponte **non decide niente**: riceve symbol, side, volume,
prezzo, SL e TP già belli e fatti dalla pagina. Non esiste nessun endpoint che prenda una
percentuale di rischio e restituisca un lottaggio, e nessuna funzione di rischio nel modulo.
L'unica correzione che fa è tecnica: arrotonda il volume al passo del simbolo (`_round_volume`),
vincolandolo tra minimo e massimo.

Cioè: **la decisione sta al 100% nella pagina**, ed è esattamente il perché con la pagina chiusa
non parte nessun ordine. Questo è il primo mezzo del "confronto" che la consegna chiedeva — e la
sua risposta è che il confronto, oggi, dà numeri diversi per costruzione: da una parte c'è chi
decide, dall'altra chi esegue. `laboratorio/ponte/test_ponte_esegue_non_decide.py` lo misura,
ed è verde di proposito: dice la verità di oggi. Se un domani il ponte imparasse a decidere, quel
test diventerebbe rosso — e sarebbe il segnale che il confronto va rifatto da capo.

**Cosa resta davvero:** spostare la decisione nel ponte (rischio → volume, SL/TP da un segnale)
è la "strada 2" della consegna, ed è un progetto, non una correzione: va riscritta in Python la
parte di `app.html` che fa quei conti, e provata contro la pagina segnale per segnale. Con la
pagina chiusa nessun ordine parte: è così com'è costruito, lo dice anche il punto E.
## 31 ottobre 2026 — Progetto "decisione nel ponte": Fasi 1, 2, 3 finite

**Fase 1 — lo strumento di confronto.** `laboratorio/confronto/`: 12 casi reali, la pagina li
risolve (`tgPiano`) e il risultato diventa il terreno di verità. Primo giro: 0 su 12 identici —
la fotografia di partenza, cioè la prova con numeri che la decisione sta tutta nella pagina.

**Fase 2 — la matematica del prezzo.** 144 numeri (9 simboli × 4 combinazioni) da far tornare
uguali. Primo giro: 54 diversi. Due cause vere: la leva (la pagina la legge dal menu ed è 100,
io avevo messo 30 — tutti i margini 3,33 volte troppo alti) e il `plMode` fuori tabella
(`currentInstrument` ricade su EUR/USD in silenzio, quindi una cripta senza metadati ha un
contratto 100.000 volte troppo grande). Alla fine: 144 su 144.

**Fase 3 — la decisione.** 12 casi. Alla fine: 12 su 12, motivi di rifiuto parola per parola.

**Le tre cose che questo progetto ha insegnato, e che valgono per tutti gli altri:**

1. **La configurazione non si duplica, si esporta.** La prima versione del confronto usava una
   config scritta a mano in `casi.json` — che la pagina non legge — e segnalava tre casi
   "diversi" che erano difetti del caso, non del ponte. Da adesso è la pagina a dire con quale
   config decide (`configEffettiva`).
2. **Il confronto becca i difetti del confronto.** Tre dei cinque giri rossi non erano difetti
   del port ma della misura: la pagina che si ricaricava da sola (un caso risultava "rifiutato"
   per un incidente di misura), un numero formattato male, una config inventata. Uno strumento
   che non misura se stesso fa lavorare per niente.
3. **Si copia, non si reinterpreta.** Ogni differenza trovata era una regola che avevo
   "semplificato" invece di copiare: due percentuali al posto di una, il formato dei prezzi, la
   leva. Ladecisione non si riscrive a intuito: si porta.

**Cosa resta:** Fase 4 (il ponte legge i segnali), Fase 5 (gestione dal vivo su tick MT5 —
pareggio, break-even, sposta stop), Fase 6 (il commutatore). Sono la parte pericolosa; ognuna
va provata contro la pagina prima di accenderla.
## 31 ottobre 2026 — Fase 4, e la decisione del proprietario che cambia il progetto

**Fase 4 fatta e in CI** (194 prove verdi sul ponte): il ponte ordini legge i segnali dal WebSocket
`/ws/segnali` del ponte segnali (porta 8769) — lo stesso canale della pagina, non uno apposta — e
tiene l'ultimo arrivato. Canale muto → attesa di 5 s e riprova: il ponte non cade, e continua a
eseguire gli ordini che la pagina manda.

**Due difetti veri trovati dal test, non da me:**

1. `_segnala_segnale` accoglieva qualunque dict, ack compreso. Il filtro ora sta nel punto unico
   di ingresso: se stesse solo nel ciclo, la prossima cosa che chiama la funzione passerebbe un
   messaggio di servizio e lo farebbe diventare un ordine.
2. L'avvio usava `asyncio.ensure_future` dal blocco principale, che è **sincrono**: senza event
   loop attivo solleva "no running event loop". Cioè l'ascolto non sarebbe partito **mai**, e
   l'errore sarebbe finito nel log senza che nessuno lo vedesse. Ora gira in un thread daemon con
   il suo loop.

**La decisione del proprietario, che ribalta il progetto:** «per quanto riguarda gli ordini il
server deve solo inoltrare, non deve prendere le decisioni lui, il sistema rimane lo stesso di
oggi, ma solo per gli ordini. Tutto il resto va cambiato e aggiornato e deve funzionare in
maniera maniacale.»

Quindi: **gli ordini non si spostano.** La decisione resta nella pagina (`tgPiano`); ponte e
server inoltrano ed eseguono. Le fasi 5 (gestione dal viva autonoma) e 6 (commutatore) sono
**fermate**: niente ordini mandi dal ponte senza che la pagina lo chieda. La Fase 4 resta per
quello che è — il ponte *vede* i segnali. Le fasi 1-3 restano in CI: misurano che il Python del
laboratorio e la pagina fanno gli stessi numeri, e sono il permesso già conquistato se un domani
la decisione si sposta davvero.

**Lezione che si aggiunge alle altre:** lo strumento di confronto é servito anche a dire di NO.
Costruito per ottenere il permesso di spostare la decisione, ha finito per documentare che quel
posto va bene dove sta. Misurare non significa sempre cambiare: a volte significa confermare.
## 31 ottobre 2026 — La bolletta Firebase: misurata, capita, prima cura pubblicata

**Il sintomo.** Progetto Firebase in Blaze: **8,49 €** a ottobre (Firestore 6,80, Cloud Functions
1,40, altro 0,29), col grafico piatto fino al 17, salto, poi rampa ripida 20-26 → picco il 29. Un
solo utente: lui.

**La domanda del proprietario:** «non possiamo risparmiare questi dati? far sì che non incrementi e
che non sovrascriva sempre la copia esistente e quindi risparmiare tempo, dati e soldi.»

**I numeri veri, già scritti nel codice dalla sessione del 26 ottobre** (console, 30 giorni):
letture 293K, scritture 107K, banda oltre 10 GB, byte archiviati oltre 1 GB.

**Causa 1 — il modello di Firestore è «tutto o niente» (curata il 26-27, attiva solo dal 30).**
Per salvare un'operazione chiusa si riscriveva l'intero documento session: 305 KB, di cui 194 KB di
storico. La cura è il salvataggio incrementale (documento a parte, `arrayUnion`, 259 byte per
operazione nuova). **Ma non girava sul PC:** `installer_build/build/app.html` era fermo al 26
ottobre, senza `arrayUnion` né `trades/aggiungi`, mentre la root ce l'aveva. Verificato sul file
installato: dalla 2.0.53 (30 ottobre) le cure ci sono.

> **LA LEZIONE, ED È COSTATA UN MESE DI BOLLETTA: la cura nel repo non cura niente. Cura ciò che
> sta nella versione installata.** `build_exe.bat` copia `app.html` dalla root alla build, quindi
> la build si rigenera da sé: ma ciò che girava era la build precedente, e la rampa della bolletta
> del 20-26 ottobre è esattamente il periodo senza cure.

**Causa 2 — il footprint (curata oggi, v2.0.56).** `footprintCollectCloudAggregate()` arriva fino a
400 KB e finiva dentro `bundle.footprintCells`, quindi **dentro il documento session**: fino a 400
KB rimandati a ogni salvataggio (pagehide, logout, operazione chiusa). Ora sta in
`users/{uid}/data/footprint`, scritto solo se cambiato e al massimo una volta al minuto. Misurato
coi test: tre salvataggi ravvicinati → una sola scrittura del footprint; senza celle → zero
scritture. Nuova misura `footprintInviati` in «Misura le prestazioni».

**Cosa resta, in ordine di costo:**
1. i 4 ascolti `onSnapshot` (ogni modifica = una lettura per ogni dispositivo in ascolto). Il
   sostituto esiste già (`serverDatiAscolta`) e **non viene mai chiamato**;
2. le Cloud Functions: non sono solo Stripe. Ci sono le funzioni Notion
   (`notionSyncTrades` e compagnia) e `notionSyncTick` gira su **timer ogni 15 secondi**;
3. il mistero dei **1 GB archiviati**: con un utente solo non tornano (4 documenti ≈ 1 MB).

