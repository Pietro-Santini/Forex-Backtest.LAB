@echo off
setlocal
set "REPO=C:\Users\pietro\Documents\GitHub\Forex-Backtest.LAB"
set "WWW=%~dp0www"
echo Copio i file aggiornati da %REPO%
for %%F in (app.html login.html sw.js manifest.json asset-library.html informativa-bot.html privacy.html rischi-finanziari.html termini.html icon-192.png icon-512.png) do (
  copy /Y "%REPO%\%%F" "%WWW%\%%F" >nul
)
echo Inietto la versione del bundle (da sw.js) in app.html...
for /f "delims=" %%V in ('python -c "import re,io; print(re.search(r'forex-backtest-lab-v([\d.]+)', io.open(r'%REPO%\sw.js',encoding='utf-8').read()).group(1))"') do set "FBLVER=%%V"
if not defined FBLVER ( echo ERRORE: versione non trovata in sw.js & exit /b 1 )
rem L'iniezione la fa uno script Python con UTF-8 esplicito: PowerShell 5.1 leggeva il file
rem come ANSI e risalvava le emoji come "ðŸ..." (tutte le icone rotte nell'APK v2.0.27).
python "%REPO%\strumenti\inietta_versione.py" "%WWW%\app.html" %FBLVER%
if errorlevel 1 ( echo ERRORE: iniezione della versione fallita & exit /b 1 )
echo Versione iniettata: %FBLVER%
echo Sincronizzo Capacitor (npx cap sync)...
cd /d "%~dp0"
call npx cap sync android
if errorlevel 1 (
  echo SYNC FALLITO
  exit /b 1
)
echo.
echo Fatto: www aggiornato e sincronizzato con il progetto Android.
