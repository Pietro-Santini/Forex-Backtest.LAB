# Diario dei giri di agenti

Formato: data — chi — cosa — esito collaudo — commit.

- 2026-10-05 — impianto iniziale — creati cervello, laboratorio (11 test ponte + interprete + 6
  test app), flussi GitHub Collaudo e Installer Windows, agenti — collaudo verde
- 2026-10-05 — impianto — primo Setup costruito da GitHub (94 MB, collaudo librerie ponte ok);
  release automatica pronta (scatta su main); collaudo GitHub rosso→verde (test del ponte usavano
  la rete vera) — verde — 026b3ee
- 2026-10-06 — Claude — memoria aggiornata (contesto attività, antiriciclaggio in sospeso);
  consenso informato ai rischi prima di segnali e apertura dai segnali (app v86) — verde
- 2026-10-06 — Claude — pacchetto server Oracle (ponte senza MT5 solo simulato, ponte segnali con
  dati nel volume, Docker, prepara_server.sh, guida); 6 test del server; collaudo GitHub con Docker
- 2026-10-06 — Claude — PR #6 unita (sito su v86, prima release automatica); Setup 1.0.73 e
  release con la numerazione v1.0.NN del proprietario — verde
- 2026-10-07 — Claude — server Oracle avviato dal proprietario (Docker, Tailscale); app v87 con il
  server per Kraken e segnali; Setup 1.0.74 — verde
- 2026-10-07 — Claude — app v88 "Esci da Telegram" (logout vero, sessione e numero cancellati,
  rientro con numero e codice); Setup 1.0.75 — verde
- 2026-10-07 — Claude — app v89: pulsante "Accesso da altri dispositivi e server Oracle" (il
  proprietario non trovava "Prova il server"); guida corretta; Setup 1.0.76 — verde
- 2026-10-08 — Claude — fix Tailscale/MT5 mobile: chiave del PC visibile in "Accesso da altri
  dispositivi" (riquadro con copia); sincronizzate tutte le copie (root/Forex-Backtest.LAB/
  /installer_build/build/); sw.js v78; guida aggiornata — in attesa test mobile
  Kraken separato da MT5 e tabella completa con R/R, margine, Vai a grafico, Seleziona e BE;
  aggiunto test di regressione `posizioni_kraken.test.mjs` — collaudo locale da eseguire — non pubblicato
