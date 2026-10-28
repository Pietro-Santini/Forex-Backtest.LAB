@echo off
setlocal
rem LA JDK SI DICHIARA, NON SI PRENDE DA UN PROGRAMMA CHE SI AGGIORNA DA SOLO.
rem Fino al 20 ottobre 2026 qui c'era "C:\Program Files\Android\Android Studio\jbr": Android
rem Studio si e' aggiornato, quella JDK e' passata a Java 25, e Gradle 8.14.3 non la supporta.
rem La compilazione cadeva in 4 secondi con "Unsupported class file major version 69" - senza
rem che nel progetto fosse cambiato niente. Ora si punta a una JDK 21 dichiarata: e' quella
rem che Gradle 8.14 vuole, e non cambia sotto i piedi.
rem Se un domani si alza Gradle, va alzata anche questa riga (le due cose vanno insieme).
set "JAVA_HOME=C:\Users\pietro\.jdks\jbr-21.0.11"
if not exist "%JAVA_HOME%\bin\java.exe" (
  echo JDK non trovata in %JAVA_HOME%
  echo Installa una JDK 21 oppure correggi JAVA_HOME qui sopra.
  exit /b 1
)
set "APKSIGNER=C:\Users\pietro\AppData\Local\Android\Sdk\build-tools\35.0.0\apksigner.bat"
set "KEYSTORE=C:\Users\pietro\.android\debug.keystore"
set "APKDIR=%~dp0android\app\build\outputs\apk\debug"
cd /d "%~dp0android"
echo Compilo l'APK (gradlew clean assembleDebug) con Java di %JAVA_HOME%...
call "%~dp0android\gradlew.bat" clean assembleDebug
if errorlevel 1 (
  echo BUILD FALLITO
  exit /b 1
)
echo Firma l'APK...
call "%APKSIGNER%" sign --ks "%KEYSTORE%" --ks-pass pass:android --key-pass pass:android --out "%APKDIR%\ForexBacktestLAB.apk" "%APKDIR%\app-debug.apk"
if errorlevel 1 (
  echo FIRMA FALLITA
  exit /b 1
)
echo.
echo APK firmato pronto: %APKDIR%\ForexBacktestLAB.apk
