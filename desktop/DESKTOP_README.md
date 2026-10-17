# Desktop Shell (no-Chrome) – Prototipo

## Come avviare
```sh
cd forex-backtest-desktop
pip install -r requirements_desktop.txt
python desktop_shell.py
```
Impostare `DESKTOP_SHELL_DEBUG=1` per DevTools.

## Cosa fa
- Carica la stessa `app.html` da ` http://127.0.0.1:812x/app.html` (backend minimale)
- Usa la WebView del sistema (WebView2 su Windows, WebKit su Mac/Linux).

## Note su MT5 e cross-platform
- Il bridge MT5 reale è **Windows-only** (MetaTrader5 ufficiale).
- Su macOS/Linux/iOS/Android valgono solo i feed **Binance/Capital.com** + simulazione.
- Per iOS/Android serve Capacitor o Tauri Mobile (non incluso in questo prototipo).

## Profiling PIP
1. Apri con `DESKTOP_SHELL_DEBUG=1 python desktop_shell.py`.
2. DevTools → Performance → registrazione 10 secondi sul pannello PIP.
3. Cerca `setInterval` + repaints/force-reflow.<|end|>