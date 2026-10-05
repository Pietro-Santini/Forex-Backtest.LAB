# Registro dei bug

Formato: **titolo** — stato — dove — causa vera — test che lo controlla.

## Aperti / limiti noti
- **Ordini pendenti Kraken fermi a PC spento** — limite — `kraken_ordini.py` — li tiene il ponte sul
  PC. Senza un server sempre acceso non si risolve.
- **Pendenti di un conto di prova non attivo non controllati** — limite — `controlla_pendenti()`
  guarda solo il conto collegato.
- **Livelli dal grafico Binance, scatto sul prezzo Kraken** — limite — piccola differenza di prezzo.
- **Exe non firmati** — limite — Windows SmartScreen avvisa all'installazione.
- **Telegram, Syntra, MT5 non collaudabili nel cloud** — limite — servono sessione/BlueStacks/Windows.
  Nel cloud si collauda l'interprete sui messaggi registrati.

## Risolti
- **WebSocket segnali 403 ("ponte non raggiungibile")** — risolto v70 — `segnali_bridge.py` — il
  decoratore `@app.websocket("/ws/segnali")` era finito sopra `_manda_storico`. Controllo: `--verifica`.
- **Barra ordini con Kraken: rischio e lotto col modello forex** — risolto app v85 — usava saldo
  MT5/backtest e contratti da 100.000. Test: `laboratorio/app/barra_kraken.test.mjs`.
- **Anteprima sul grafico in € forex con Kraken** — risolto app v85 — `drawTpSlZoneBox`. Test: idem.
- **Id ordini pendenti uguali nello stesso millisecondo** — risolto — STOP SELL non scattava.
  Test: `laboratorio/ponte/test_kraken_pendenti.py::test_stop_sell_e_id_diversi`.
- **Pendente scattato registrato due volte nel Journal** — prevenuto — memoria locale degli id presi.
  Test: `barra_kraken.test.mjs` "preso in carico una sola volta".
- **Casella posizione Kraken che non arrivava all'ultima candela** — risolto — `keepPaceIdx` voleva
  un indice, riceveva `true`. Test: `journal_kraken.test.mjs`.
- **Pulsanti e schede che "non funzionavano" nella finestra PIP** — risolto — ascoltatori delegati
  solo su `document`. Ora `fblDelega()`.
