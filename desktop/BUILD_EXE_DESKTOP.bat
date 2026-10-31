@echo off
REM ============================================================================
REM BUILD_EXE_DESKTOP.bat - Crea ForexBacktestLABDesktop.exe (senza console)
REM
REM ATTENZIONE (31 ottobre 2026): la stessa compilazione sta ANCHE dentro
REM ..\installer_build\build_exe.bat (passo 3d), ed e' QUELLO il flusso che gira su
REM GitHub: produrre la finestra la' fa finire l'eseguibile nello stesso pacchetto
REM degli altri tre servizi. Questo file serve solo a ricompilare la finestra da
REM sola, senza toccare i servizi.
REM
REM Prima questo script usava percorsi assoluti scritti a mano (il PC del
REM proprietario): su un altro PC non trovava niente e l'eseguibile non si
REM compilava. Ora i percussi sono relativi alla cartella del progetto
REM (%~dp0.. = cartella principale): funziona ovunque stia il progetto.
REM ============================================================================

cd /d "%~dp0"
set RADICE=%~dp0..

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

echo === 2) Creo l'eseguibile (senza console, con icona e con il logo dentro) ===
python -m PyInstaller ^
  --noconfirm ^
  --onefile ^
  --windowed ^
  --name ForexBacktestLABDesktop ^
  --icon "%RADICE%\installer_build\build\icon.ico" ^
  --hidden-import webview.platforms.edgechromium ^
  --add-data "%RADICE%\app.html;." ^
  --add-data "%RADICE%\sw.js;." ^
  --add-data "%RADICE%\manifest.json;." ^
  --add-data "%RADICE%\icon-192.png;." ^
  --add-data "%RADICE%\icon-512.png;." ^
  --add-data "%RADICE%\apple-touch-icon.png;." ^
  desktop_shell.py

if errorlevel 1 (
  echo.
  echo ERRORE durante la compilazione. Guarda il messaggio sopra.
  echo Se parla di "webview": pip install pywebview
  pause
  exit /b 1
)

echo.
echo === FATTO ===
echo Trovi ForexBacktestLABDesktop.exe in "dist\"
echo Provalo con doppio click: deve aprirsi la finestra dell'applicazione, senza
echo nessuna finestra nera. Il logo compare in alto a sinistra.
echo.
echo Copia ForexBacktestLABDesktop.exe in installer_build\dist\ ^(accanto agli altri^) e
echo poi compila installer_build\installer.iss con Inno Setup, oppure rilancia
echo installer_build\build_exe.bat che fa tutto da solo.
pause
