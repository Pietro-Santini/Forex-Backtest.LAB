# Finestra dell'applicazione (ForexBacktestLABDesktop.exe)

Questa cartella contiene **`desktop_shell.py`**: il codice della finestra che l'utente
vede e apre dall'icona sul Desktop o del menu Start. È l'unico eseguibile del pacchetto
che mostra qualcosa: `ForexBacktestLAB.exe`, `Mt5FeedServer.exe` e `SegnaliBridge.exe`
sono servizi che girano senza finestra.

## Come si produce

**Il flusso normale è `installer_build\build_exe.bat`** (passo 3d): costruisce tutti e
quattro gli eseguibili insieme, dentro `installer_build\dist\`. Da lì
`installer_build\installer.iss` li impacchetta nel `ForexBacktestLAB_Setup.exe` — con
l'icona sul Desktop, la voce nel menu Start e la casella "Avvia Forex Backtest LAB" alla
fine dell'installazione. Il flusso di GitHub (`.github/workflows/installer.yml`) fa la
stessa cosa e, se `ForexBacktestLABDesktop.exe` manca, fallisce di proposito: un
pacchetto senza finestra non si deve poter pubblicare.

Per ricompilare **solo** la finestra, senza toccare i servizi:

```bat
cd desktop
BUILD_EXE_DESKTOP.bat
```

Poi copia `dist\ForexBacktestLABDesktop.exe` in `installer_build\dist\` (accanto agli
altri tre) e compila `installer_build\installer.iss`, oppure rilanza
build_exe.bat che fa tutto da solo.

## Come si prova dai sorgenti

```sh
pip install -r requirements_desktop.txt
python desktop_shell.py
```

Impostare `DESKTOP_SHELL_DEBUG=1` per DevTools, `BACKEND_URL=http://...` per provare la
finestra contro un indirizzo diverso dal ponte locale (per chi sviluppa).

## Cosa garantisce la finestra

1. **Il logo in alto a sinistra**: prende `icon-512.png` (quello dell'icona sul Desktop),
   lo incorpora come indirizzo dati e lo mette nel tab della finestra. Se il file non si
   trova, la pagina tiene il proprio.
2. **Il titolo** "Forex Backtest LAB" e la finestra grande abbastanza da lavorare
   (1280×820).
3. **Funziona su qualunque PC**: di default parla con il ponte locale
   (`http://127.0.0.1:8000/app.html`), che l'installazione mette già in funzione. Se il
   ponte non risponde, la finestra lo avvia da sola e aspetta.
4. **Se il servizio non parte**, appare una pagina che lo dice con un pulsante
   "Riprova", invece di una finestra vuota che sembra rotta.
5. **Il collegamento del sito** `forexbacktestlab://` apre questa stessa finestra, non il
   servizio invisibile (registrato da `installer.iss`).

## Nota su MT5 e cross-platform

- Il bridge MT5 reale è **Windows-only** (MetaTrader5 ufficiale): è per questo che il
  pacchetto di installazione è Windows.
- Su macOS/Linux/iOS/Android valgono solo i feed **Binance/Capital.com** + simulazione.
- Per iOS/Android serve Capacitor o Tauri Mobile (non incluso in questo prototipo).

## Profiling PIP

1. Apri con `DESKTOP_SHELL_DEBUG=1 python desktop_shell.py`.
2. DevTools → Performance → registrazione 10 secondi sul pannello PIP.
3. Cerca `setInterval` + repaint/force-reflow.
