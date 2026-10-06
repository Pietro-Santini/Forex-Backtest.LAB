@echo off
REM ============================================================================
REM  Ponte dei segnali - MODALITA' VERA (legge le tue sale su Telegram).
REM
REM  Serve solo se avvii il ponte A MANO: normalmente lo avvia l'app da sola
REM  quando premi "Collegamento" nella sezione Telegram.
REM
REM  Numero di telefono e codice di verifica NON si scrivono piu' qui: li chiede
REM  l'app con un popup, e li manda al ponte. Questa finestra serve solo a vedere
REM  cosa sta succedendo.
REM
REM  Le credenziali stanno in configurazione.json, in questa cartella, e non
REM  escono mai da qui.
REM ============================================================================
cd /d "%~dp0"

REM Se un ponte vecchio e' rimasto in ascolto, il nuovo non parte e si continua a
REM vedere il comportamento di quello vecchio: e' successo, e fa perdere un sacco
REM di tempo. Qui si chiude prima di partire.
echo Controllo che la porta 8769 sia libera...
powershell -NoProfile -Command ^
  "$c = Get-NetTCPConnection -LocalPort 8769 -State Listen -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Write-Host ('  chiudo un ponte gia'' in ascolto (pid ' + $_.OwningProcess + ')'); Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 800 } else { Write-Host '  porta libera' }"

echo.
REM Le librerie del ponte (telethon, fastapi, uvicorn, websockets): se mancano si installano qui,
REM invece di far morire il ponte con "No module named ...".
python -c "import telethon, fastapi, uvicorn, websockets" 2>nul
if errorlevel 1 (
  echo Installo le librerie del ponte ^(serve internet, solo la prima volta^)...
  python -m pip install -r requirements.txt
)
echo.
python segnali_bridge.py
echo.
echo Il ponte si e' chiuso.
pause
