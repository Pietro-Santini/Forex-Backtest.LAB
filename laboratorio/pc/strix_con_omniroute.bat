@echo off
REM ============================================================================
REM Strix (ricerca di vulnerabilita') sul TUO PC, usando OmniRoute come fornitore del modello AI.
REM
REM Serve, una volta sola:
REM   1) Docker Desktop installato e AVVIATO (Strix prova gli attacchi dentro un contenitore).
REM   2) Python 3.12 o piu' recente, poi nel Prompt dei comandi:
REM        pip install pipx
REM        pipx install strix-agent
REM   3) OmniRoute acceso: http://localhost:20128 deve aprirsi nel browser.
REM
REM Prima di lanciarlo, cambia le due righe "set" qui sotto:
REM   MODELLO      = il nome di un modello come lo mostra OmniRoute (pagina dei modelli), preceduto
REM                  da "openai/" perche' OmniRoute parla come OpenAI. Esempio: openai/auto
REM   CHIAVE       = la chiave che OmniRoute ti da' per le richieste (se non la chiede, lascia "x").
REM La chiave resta su questo PC: non scriverla in nessun file del progetto e non mandarla a nessuno.
REM
REM Da dove lanciarlo: dalla cartella del progetto (quella con app.html), per esempio
REM   cd /d C:\percorso\del\progetto
REM   laboratorio\pc\strix_con_omniroute.bat
REM ============================================================================
setlocal
set MODELLO=openai/auto
set CHIAVE=x

set STRIX_LLM=%MODELLO%
set LLM_API_KEY=%CHIAVE%
set LLM_API_BASE=http://localhost:20128/v1

cd /d "%~dp0..\.."
if not exist app.html (
  echo ERRORE: lancialo dalla cartella del progetto, quella che contiene app.html.
  pause
  exit /b 1
)
docker info >nul 2>&1
if errorlevel 1 (
  echo ERRORE: Docker Desktop non e' avviato. Aprilo, aspetta che sia pronto e rilancia.
  pause
  exit /b 1
)
curl -s -o nul http://localhost:20128/v1/models
if errorlevel 1 (
  echo ERRORE: OmniRoute non risponde su http://localhost:20128 - avvialo e rilancia.
  pause
  exit /b 1
)
echo Scansione in corso: puo' durare da pochi minuti a un'ora. Il rapporto finisce in strix_runs\
strix -n -t .\ --scan-mode quick --instruction "Progetto: app di trading (app.html) e ponte locale Python (installer_build/build). Priorita': XSS da testo esterno (messaggi delle sale segnali), endpoint del ponte senza autenticazione, fughe di chiavi API, esecuzione di ordini non voluti. Non contattare servizi esterni reali."
echo.
echo Fatto. Passa il rapporto (cartella strix_runs) all'agente sentinella-sicurezza per la verifica.
pause
endlocal
