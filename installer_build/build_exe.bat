@echo off
REM ============================================================================
REM DA ESEGUIRE UNA VOLTA SOLA, SUL TUO PC WINDOWS (quello con Python), dentro
REM la cartella "installer_build" (quella che contiene anche la sottocartella
REM "build" con bridge.py, app.html, ecc.).
REM
REM Cosa fa, in ordine:
REM   1) crea un ambiente Python isolato ("venv") qui dentro, cosi' non tocca
REM      il Python che hai gia' installato sul PC
REM   2) ci installa dentro fastapi, uvicorn, MetaTrader5, pywinauto (le
REM      librerie che servono a bridge.py) + PyInstaller (lo strumento che
REM      "congela" tutto in un .exe)
REM   3) lancia PyInstaller DUE volte: crea dist\ForexBacktestLAB.exe (il
REM      bridge che esegue gli ordini reali) E dist\Mt5FeedServer.exe (il
REM      servizio SEPARATO che fornisce a app.html i dati per il grafico
REM      quando un conto MT5 e' collegato - tenuto in un eseguibile a parte
REM      di proposito, cosi' un bug li' non puo' mai toccare l'esecuzione
REM      ordini: bridge.py lo avvia da solo, come processo figlio, ogni
REM      volta che parte lui stesso - non serve avviarlo a mano) - questi
REM      due file sono quello che poi Inno Setup (vedi installer.iss)
REM      impacchetta nel vero e proprio programma di installazione da dare
REM      ai tuoi utenti.
REM
REM Richiede Python installato sul PC (vedo che hai gia'
REM python-3.13.15-amd64.exe sul Desktop: va benissimo, usa quello) e
REM connessione a Internet (per scaricare le librerie da PyPI).
REM ============================================================================
setlocal
cd /d "%~dp0"

REM app.html e sw.js NON stanno in build\ nel repository: si prendono dalla cartella principale
REM (quella pubblicata sul sito), cosi' sito e programma sul PC sono sempre la stessa versione.
REM ATTENZIONE, GIA' COSTATO UN SETUP FALLITO (17 ottobre 2026): qui si scrivono una riga per file.
REM Un a capo scritto come `r`n e' roba di PowerShell e dentro un .bat NON vuol dire niente: cmd.exe
REM legge tutta la riga come un comando solo, la copia non avviene, e il controllo qui sotto trova
REM build\app.html mancante -> "ERRORE: manca build\app.html". Sul PC del proprietario non si vedeva
REM perche' li' build\app.html era rimasto da una compilazione precedente; su GitHub si parte da una
REM cartella pulita e si ferma subito. Lo copre laboratorio/app/build_exe_copia.test.mjs.
if exist "%~dp0..\app.html" copy /y "%~dp0..\app.html" "%~dp0build\app.html" >nul
if exist "%~dp0..\login.html" copy /y "%~dp0..\login.html" "%~dp0build\login.html" >nul
if exist "%~dp0..\sw.js" copy /y "%~dp0..\sw.js" "%~dp0build\sw.js" >nul
if not exist "%~dp0build\app.html" (
  echo ERRORE: manca build\app.html. Scarica tutto il progetto ^(non solo installer_build^).
  pause
  exit /b 1
)

echo === 1) Creo l'ambiente Python isolato (venv)... ===
python -m venv venv
if errorlevel 1 (
  echo ERRORE: "python" non e' stato trovato nel PATH di sistema.
  echo Apri "Prompt dei comandi" e digita "python --version": se da' errore,
  echo reinstalla Python - quello che hai sul Desktop - e durante l'installazione
  echo spunta la casella "Add python.exe to PATH".
  pause
  exit /b 1
)

call venv\Scripts\activate.bat

echo === 2) Installo le librerie necessarie + PyInstaller... ===
python -m pip install --upgrade pip

REM BUG RISOLTO (mancava questo controllo): se pip fallisce a installare le librerie qui sotto
REM (es. un conflitto di versioni tra pacchetti, o una connessione internet che cade a meta'), lo
REM script PRIMA proseguiva comunque dritto a PyInstaller, "congelando" in un .exe un ambiente
REM Python INCOMPLETO — risultato osservato proprio cosi': un ModuleNotFoundError a runtime per una
REM libreria che in realta' non era mai stata installata, con zero indizio di questo durante la
REM compilazione stessa. Ora lo script si ferma SUBITO e mostra l'errore vero di pip, invece di
REM produrre in silenzio un exe rotto che lo scopri solo dopo, al primo avvio.
python -m pip install -r build\requirements.txt
if errorlevel 1 (
  echo.
  echo ERRORE: pip non e' riuscito a installare tutte le librerie in build\requirements.txt
  echo ^(guarda il messaggio ROSSO qui sopra per il motivo esatto — es. un conflitto di
  echo versioni tra pacchetti, o la connessione internet caduta a meta'^). NON proseguo con
  echo PyInstaller: un ambiente incompleto produrrebbe un .exe che sembra compilare bene ma
  echo poi si rompe al primo avvio con un errore tipo "No module named '...'".
  pause
  exit /b 1
)

python -m pip install pyinstaller
if errorlevel 1 (
  echo.
  echo ERRORE: pip non e' riuscito a installare PyInstaller stesso — guarda il messaggio sopra.
  pause
  exit /b 1
)

REM BUG RISOLTO ("numpy._core.multiarray failed to import" al primo avvio, tipicamente visto
REM proprio su Mt5FeedServer.exe ma presente identico anche in ForexBacktestLAB.exe): il pacchetto
REM MetaTrader5 si appoggia internamente a numpy per il proprio "core" compilato - PyInstaller, da
REM solo con --collect-all MetaTrader5, non si porta dietro sempre tutte le estensioni binarie di
REM numpy (limite noto di PyInstaller con numpy 2.x, che ha spostato quelle estensioni dentro
REM numpy._core). Fix: --collect-all numpy esplicito su ENTRAMBI gli exe qui sotto (vedi anche il
REM commento in build\requirements.txt sul perche' NON e' stato fissato un numpy<2: su Python 3.13
REM richiederebbe di compilarlo da sorgente, serve un compilatore che qui non c'e').
echo === 3a) Creo ForexBacktestLAB.exe con PyInstaller (puo' richiedere qualche minuto)... ===
pyinstaller ^
  --name ForexBacktestLAB ^
  --onefile ^
  --windowed ^
  --icon build\icon.ico ^
  --collect-all MetaTrader5 ^
  --collect-all numpy ^
  --collect-all uvicorn ^
  --hidden-import accesso_condiviso ^
  --collect-all pywinauto ^
  --collect-all google-auth ^
  --add-data "build\app.html;." ^
  --add-data "build\manifest.json;." ^
  --add-data "build\icon-192.png;." ^
  --add-data "build\icon-512.png;." ^
  --add-data "build\apple-touch-icon.png;." ^
  --add-data "build\sw.js;." ^
  --add-data "build\asset-library.html;." ^
  --add-data "build\login.html;." ^
  build\bridge.py

if errorlevel 1 (
  echo.
  echo ERRORE durante la creazione di ForexBacktestLAB.exe: guarda il messaggio sopra.
  echo Le cause piu' comuni: una libreria non installata correttamente
  echo ^(riprova il punto 2^), oppure l'antivirus che ha bloccato PyInstaller
  echo mentre scriveva i file ^(disattivalo un attimo e riprova^).
  pause
  exit /b 1
)

echo === 3b) Creo Mt5FeedServer.exe con PyInstaller (il servizio dati MT5 per il grafico, in un eseguibile SEPARATO)... ===
pyinstaller ^
  --name Mt5FeedServer ^
  --onefile ^
  --windowed ^
  --icon build\icon.ico ^
  --collect-all MetaTrader5 ^
  --collect-all numpy ^
  --collect-all uvicorn ^
  --hidden-import accesso_condiviso ^
  --collect-all websockets ^
  build\mt5_feed_server.py

if errorlevel 1 (
  echo.
  echo ERRORE durante la creazione di Mt5FeedServer.exe: guarda il messaggio sopra.
  echo ForexBacktestLAB.exe sopra si e' comunque creato correttamente: se preferisci
  echo puoi anche proseguire senza Mt5FeedServer.exe - il grafico Live restera'
  echo sempre su Capital.com anche quando ti colleghi a MT5 ^(nessun crash, solo la
  echo funzione "grafico da MT5" non attiva^), ordini e posizioni reali non ne
  echo risentono in nessun modo.
  pause
  exit /b 1
)

echo.
echo === 3c) Creo SegnaliBridge.exe con PyInstaller (il ponte delle sale segnali Telegram)... ===
REM Qui si usa il file .spec invece dei soliti parametri a riga di comando: telethon si porta
REM dietro parecchia roba caricata a runtime, e l'elenco dei --collect-all sarebbe lungo e facile
REM da sbagliare. SegnaliBridge.spec, accanto a questo file, e' l'unico posto in cui e' scritto.
pyinstaller --noconfirm SegnaliBridge.spec

if errorlevel 1 (
  echo.
  echo ERRORE durante la creazione di SegnaliBridge.exe: guarda il messaggio sopra.
  echo Gli altri due exe sopra si sono comunque creati correttamente: puoi proseguire
  echo senza questo - semplicemente le SALE SEGNALI Telegram non partiranno da sole
  echo premendo "Collegamento" nell'app ^(il resto non ne risente in alcun modo^).
  pause
  exit /b 1
)

echo === 4) Collaudo di SegnaliBridge.exe: deve avere dentro TUTTE le librerie... ===
REM RICHIESTO: "mancano le librerie, per questo il collegamento non andava". L'exe si avvia con
REM --verifica: importa telethon, fastapi, uvicorn, websockets e i moduli del ponte e si chiude
REM con 0. Se manca qualcosa esce con 3 e scrive il motivo in collaudo_ponte.txt: meglio fermarsi
REM qui che dare agli utenti un Setup che non si collega.
if exist "%~dp0collaudo_ponte.txt" del "%~dp0collaudo_ponte.txt"
start "" /wait "%~dp0dist\SegnaliBridge.exe" --verifica "%~dp0collaudo_ponte.txt"
if errorlevel 1 (
  echo.
  echo ERRORE: SegnaliBridge.exe non ha tutte le librerie. Motivo:
  if exist "%~dp0collaudo_ponte.txt" type "%~dp0collaudo_ponte.txt"
  echo Rifai build_exe.bat: se l'errore resta, mandami il testo qui sopra.
  pause
  exit /b 1
)
echo   SegnaliBridge.exe: tutte le librerie presenti.

echo === 3d) Creo ForexBacktestLABDesktop.exe (la FINESTRA dell'applicazione, quella con l'icona sul desktop)...
REM RICHIESTO dal proprietario: "l'utente non deve andare a cercare percorsi". Questo e' l'unico
REM eseguibile che si VEDE: e' la finestra vera (desktop_shell.py, dentro ..\desktop), con l'icona
REM e il titolo di Forex Backtest LAB. Gli altri tre sono servizi senza finestra che questa
REM finestra trova gia' in funzione (se il ponte non c'e' lo avvia lei, vedi _ensure_backend).
REM
REM DEVE stare qui, nello stesso script degli altri: prima era prodotto solo da
REM ..\desktop\BUILD_EXE_DESKTOP.bat, che il flusso di GitHub NON chiama — risultato, il Setup
REM uscito dal flusso non conteneva la finestra (chi installava trovava solo i servizi in
REM esecuzione e nessuna applicazione da aprire). Compilandolo qui, installer.iss lo inserisce
REM nello stesso pacchetto degli altri tre.
REM
REM pywebview e' in build\requirements.txt: senza, "import webview" in desktop_shell.py muore
REM al primo avvio dell'exe.
pyinstaller ^
  --noconfirm ^
  --onefile ^
  --windowed ^
  --name ForexBacktestLABDesktop ^
  --icon build\icon.ico ^
  --hidden-import webview.platforms.edgechromium ^
  --add-data "build\app.html;." ^
  --add-data "build\sw.js;." ^
  --add-data "build\manifest.json;." ^
  --add-data "build\icon-192.png;." ^
  --add-data "build\icon-512.png;." ^
  --add-data "build\apple-touch-icon.png;." ^
  "%~dp0..\desktop\desktop_shell.py"

if errorlevel 1 (
  echo.
  echo ERRORE durante la creazione di ForexBacktestLABDesktop.exe: guarda il messaggio sopra.
  echo Questo e' l'eseguibile dell'applicazione con la finestra: SENZA, chi installa non ha
  echo nulla da aprire, il pacchetto conterrebbe solo i servizi invisibili. Non proseguo.
  echo Se l'errore parla di "webview", installalo: pip install pywebview, e' anche nel
  echo file build\requirements.txt.
  pause
  exit /b 1
)

echo === FATTO ===
echo Trovi ForexBacktestLAB.exe, Mt5FeedServer.exe, SegnaliBridge.exe E ForexBacktestLABDesktop.exe in "dist"
echo ^(DEVONO stare insieme nella stessa cartella quando li distribuisci - vedi
echo installer.iss, che li installa gia' entrambi nello stesso posto^).
echo PROVALI SUBITO: doppio click su ForexBacktestLAB.exe - NON deve aprirsi
echo NESSUNA finestra ^(--windowed = servizio invisibile, come richiesto^) - e'
echo normale e corretto cosi'. Per controllare che sia davvero partito, apri
echo Gestione attivita' e cerca sia "ForexBacktestLAB.exe" SIA "Mt5FeedServer.exe"
echo tra i processi ^(il primo avvia da solo il secondo, vedi bridge.py^), oppure
echo vai col browser su http://127.0.0.1:8000/health e http://127.0.0.1:8001/health
echo ^(devono rispondere entrambi, non dare errore di connessione^). Se un print^(^)
echo crasha o vuoi vedere i log, li trovi nel file ForexBacktestLAB.log accanto
echo all'exe. Se funziona, prova anche a collegarti davvero a MT5 dall'app e
echo verificare che il grafico passi a MT5 come previsto. Solo se tutto va bene
echo vai avanti con installer.iss ^(vedi ISTRUZIONI_BUILD.txt^) per creare il vero
echo programma di installazione da distribuire.
echo.
pause
endlocal
