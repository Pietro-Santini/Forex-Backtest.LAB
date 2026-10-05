# Mappa del progetto

## I pezzi
| Pezzo | Dove | Cosa fa |
|---|---|---|
| App | `app.html` (~38.500 righe, un solo file) | Tutto il programma nel browser: grafico, backtest, ordini, Trade Journal, statistiche, sale segnali |
| Service worker | `sw.js` | Cache dell'app per telefono/tablet. `CACHE_NAME` cambia a ogni versione |
| Sito | GitHub Pages da `main` | `index.html` (presentazione), `login.html`, `app.html`, pagine legali |
| Ponte ordini | `installer_build/build/bridge.py` → `ForexBacktestLAB.exe`, porta **8000** | Ordini MT5, Kraken (`/kraken/*`), registratore, libreria CSV, avvio degli altri servizi |
| Dati MT5 | `mt5_feed_server.py` → `Mt5FeedServer.exe`, porta **8001** | Candele e tick MT5 per il grafico (processo separato dagli ordini) |
| Ponte segnali | `segnali_telegram/segnali_bridge.py` → `SegnaliBridge.exe`, porta **8769** | Legge le sale Telegram e Syntra (BlueStacks via adb), WebSocket `/ws/segnali` |
| Kraken | `kraken_ordini.py` (+ `kraken_simulato.py`) | Ordini su Kraken Futures; conti di prova simulati con prezzi veri; ordini pendenti |
| Interprete segnali | `segnali_telegram/parser_segnali.py` | Trasforma il testo di un messaggio in strumento/direzione/entrata/SL/TP |
| Accesso remoto | `accesso_condiviso.py` | Solo Tailscale; chiave di accesso per le richieste non locali |
| Installer | `installer_build/installer.iss` (Inno Setup) + `build_exe.bat` (PyInstaller) | Costruito da GitHub: flusso **Installer Windows** |
| Banco di prova | `laboratorio/` | `collauda.sh`: sintassi, ponte Python, interprete, app nel browser |

## Catena degli ordini
app → `ForexBacktestLAB.exe` (8000) → MT5 / Kraken. Segnali: app → 8000 `/segnali-launch` →
`SegnaliBridge.exe` (8769, senza finestra). Diario del ponte segnali:
`%APPDATA%\ForexBacktestLAB\segnali\ponte_segnali.log`.

## Dati sul PC (`%APPDATA%\ForexBacktestLAB\`)
- `kraken\` chiavi (cifrate), `simulati\<id>.json` + `conti.json` (conti di prova), `pendenti.json`.
- `segnali\` configurazione, sessione Telegram (**sensibile**), diario, `storico_sale\`.

## Dentro app.html: dove cercare
- Grafico: `draw()`, `update()`, `drawTpSlZoneBox()`, `chartGeometry()`, `rows`/`idx`/`currentAssetKey`.
- Ordini manuali: `openMarketTrade()`, `createPendingOrder()`, `setTradeLevel()`, barra rapida
  `#quickTradeCluster` (`updateQuickTradeBar`, `quickAdjustLots`).
- Rischio e lotto: `computeSuggestedLots()`, `computeSuggestedLotsPending()`; Kraken:
  `krakenModoOrdini()`, `krakenLottiConsigliati()`, `rischioRealeLotto()`, `autoLottoDaGrafico()`.
- Conto scelto sopra la dashboard: `fblContoVista` (`'mt5'|'kraken'|'storico'`), `fblContoScegli()`.
- Kraken: `krakenBridge()`, `krakenAggiornaConto()`, `krakenLeggiPosizioni()`, `krakenStrategieValuta()`,
  `krakenRegistraChiusura()` (Trade Journal), `krakenDisegnaGrafico()`, `krakenLeggiPendenti()`.
- Sale segnali: `tgStrategie`, `tgEseguiSegnale()`, `tgAutoInCoda()`, cronologia `fblCrono*`.
- Finestra PIP: gli ascoltatori vanno registrati con `fblDelega()` e cercati con `$$tutti()`,
  altrimenti nella finestra staccata non funzionano.
- Trade chiusi: array `trades`, salvati con `scheduleSave()`.
