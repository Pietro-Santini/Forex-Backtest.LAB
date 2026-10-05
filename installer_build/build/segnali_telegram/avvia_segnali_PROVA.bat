@echo off
REM ============================================================================
REM  Ponte dei segnali - MODALITA' PROVA (simulatore).
REM
REM  NON si collega a Telegram e non serve nessuna credenziale: i messaggi sono
REM  inventati. Serve a provare tutta la catena - interpretazione, pannello,
REM  apertura delle posizioni - senza aspettare che una sala mandi qualcosa.
REM
REM  Con il ponte acceso, la pagina per inserire un segnale a mano e':
REM      http://127.0.0.1:8769/prova
REM ============================================================================
cd /d "%~dp0"

echo Controllo che la porta 8769 sia libera...
powershell -NoProfile -Command ^
  "$c = Get-NetTCPConnection -LocalPort 8769 -State Listen -ErrorAction SilentlyContinue; if ($c) { $c | ForEach-Object { Write-Host ('  chiudo un ponte gia'' in ascolto (pid ' + $_.OwningProcess + ')'); Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 800 } else { Write-Host '  porta libera' }"

echo.
echo MODALITA' PROVA: i messaggi sono inventati, nessun collegamento a Telegram.
echo Pagina per inserire un segnale a mano: http://127.0.0.1:8769/prova
echo.
python segnali_bridge.py --sim
echo.
echo Il ponte si e' chiuso.
pause
