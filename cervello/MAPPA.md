# Mappa del progetto

## I pezzi
| Pezzo | Dove | Cosa fa |
|---|---|---|
| App | `app.html` (~41.500 righe / 4,2 MB, un solo file) | Tutto il programma nel browser: grafico, backtest, ordini, Trade Journal, statistiche, sale segnali |
| Service worker | `sw.js` | Cache dell'app per telefono/tablet. `CACHE_NAME` cambia a ogni versione |
| Sito | GitHub Pages da `main` | `index.html` (presentazione), `login.html`, `app.html`, pagine legali |
| Ponte ordini | `installer_build/build/bridge.py` → `ForexBacktestLAB.exe`, porta **8000** | Ordini MT5, Kraken (`/kraken/*`), registratore, libreria CSV, avvio degli altri servizi |
| Dati MT5 | `mt5_feed_server.py` → `Mt5FeedServer.exe`, porta **8001** | Candele e tick MT5 per il grafico (processo separato dagli ordini) |
| Ponte segnali | `segnali_telegram/segnali_bridge.py` → `SegnaliBridge.exe`, porta **8769** | Legge le sale Telegram e Syntra (BlueStacks via adb), WebSocket `/ws/segnali` |
| Kraken | `kraken_ordini.py` (+ `kraken_simulato.py`) | Ordini su Kraken Futures; conti di prova simulati con prezzi veri; ordini pendenti |
| Interprete segnali | `segnali_telegram/parser_segnali.py` | Trasforma il testo di un messaggio in strumento/direzione/entrata/SL/TP |
| Accesso remoto | `accesso_condiviso.py` | Solo Tailscale; chiave di accesso per le richieste non locali |
| Installer | `installer_build/installer.iss` (Inno Setup) + `build_exe.bat` (PyInstaller) | Costruito da GitHub: flusso **Installer Windows** |
| Server Oracle | `server_oracle/` (Docker, `prepara_server.sh`, guida) | Kraken simulato + pendenti (8000) e segnali Telegram (8769) su Linux; MT5 resta sul PC |
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
- Conto scelto sopra la dashboard: `fblContoVista` (`'mt5'|'kraken'|'capital'|'storico'`),
  `fblContoScegli()`, `fblContoEffettivo`.
- Kraken: `krakenBridge()`, `krakenAggiornaConto()`, `krakenLeggiPosizioni()`, `krakenStrategieValuta()`,
  `krakenRegistraChiusura()` (Trade Journal), `krakenDisegnaGrafico()`, `krakenLeggiPendenti()`.
- Capital.com: `capitalOrdineManuale()`, `tgCapitalEseguiSegnale()`, `resolveCapitalEpic()`,
  `ensureCapitalConnected()` — prezzi dal vivo e posizioni **simulate**, mai ordini veri.
- Sale segnali: `tgStrategie`, `tgEseguiSegnale()`, `tgAutoInCoda()`, cronologia `fblCrono*`
  (`fblCronoValuta`, `fblCronoAncore`, `fblCronoStopPath`, `fblCronoDisegna`; la strategia di una sala
  sta in `localStorage['fbl_crono_strategia']`, letta con `stratLeggi`).
- Finestra PIP: gli ascoltatori vanno registrati con `fblDelega()` e cercati con `$$tutti()`,
  altrimenti nella finestra staccata non funzionano.
- Trade chiusi: array `trades`, salvati con `scheduleSave()`.

## Automatismi di Claude Code (7 ottobre 2026)

| Dove | Cosa fa |
|---|---|
| `.claude/hooks/guardia_git.py` | blocca push forzati e `reset --hard`; su `main` pretende il collaudo verde da meno di 30 minuti **e** il `CACHE_NAME` alzato quando `app.html` cambia |
| `.claude/hooks/guardia_segreti.py` | blocca `git add`/`git commit -a` se fra i file in arrivo ce n'e' uno che sembra una chiave, un token o una sessione |
| `.claude/hooks/dopo_modifica.py` | dopo ogni modifica ad `app.html` controlla che si compili |
| `.claude/skills/modifica-app/` | come si modifica `app.html` senza romperlo, con `sostituisci.py` |
| `.claude/skills/pubblica/` | la catena di pubblicazione, in ordine. Solo il proprietario la lancia |
| `.claude/agents/collaudatore-online.md` | collauda l'avvio vero: sito https, accesso, service worker, rete che va e viene |
| `.mcp.json` | server MCP di GitHub: esito dei flussi, log dei fallimenti, release |

La cartella di lavoro sul Desktop ha finalmente un `.gitignore`: era un repository git senza
commit, senza remote e **senza esclusioni**, con dentro chiavi API e codici di recupero in chiaro.
