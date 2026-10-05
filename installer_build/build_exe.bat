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
if exist "%~dp0..\app.html" copy /y "%~dp0..\app.html" "%~dp0build\app.html" >nul
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
  --add-data "build\app.html;." ^
  --add-data "build\manifest.json;." ^
  --add-data "build\icon-192.png;." ^
  --add-data "build\icon-512.png;." ^
  --add-data "build\apple-touch-icon.png;." ^
  --add-data "build\sw.js;." ^
  --add-data "build\asset-library.html;." ^
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

echo === FATTO ===
echo Trovi ForexBacktestLAB.exe, Mt5FeedServer.exe E SegnaliBridge.exe in "dist"
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
