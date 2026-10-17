@echo off
REM ============================================================================
REM BUILD_EXE_DESKTOP.bat - Crea ForexBacktestLABDesktop.exe (senza console)
REM ============================================================================

cd /d "%~dp0"

echo === 1) Verifico dipendenze ===
python -c "import webview; print('webview ok')" 2>nul
if errorlevel 1 (
  echo ERRORE: webview non installato. Esegui: pip install pywebview
  pause
  exit /b 1
)
python -m PyInstaller --version 2>nul
if errorlevel 1 (
  echo ERRORE: PyInstaller non installato. Esegui: pip install pyinstaller
  pause
  exit /b 1
)

echo === 2) Creo l'eseguibile (senza console, con icona) ===
python -m PyInstaller ^
  --noconfirm ^
  --onefile ^
  --windowed ^
  --name ForexBacktestLABDesktop ^
  --icon "C:\Users\pietro\Documents\GitHub\Forex-Backtest.LAB\installer_build\build\icon.ico" ^
  --add-data "C:\Users\pietro\Documents\GitHub\Forex-Backtest.LAB\app.html;." ^
  --add-data "C:\Users\pietro\Documents\GitHub\Forex-Backtest.LAB\sw.js;." ^
  --hidden-import webview.platforms.edgechromium ^
  desktop_shell.py

if errorlevel 1 (
  echo ERRORE durante la compilazione. Guarda il messaggio sopra.
  pause
  exit /b 1
)

echo.
echo === FATTO ===
echo Trovi ForexBacktestLABDesktop.exe in "dist\"
echo Provalo con doppio click: NON deve aprire nessuna finestra nera.
echo.
pause
endlocal