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
- 2026-10-08 - Claude - app v106 pubblicata (ponte dei segnali che non muore su una emoji, Syntra
  con --solo-syntra) - verde - 1a3eaf5
- 2026-10-08 - Claude - app v107, quindici richieste del proprietario in un colpo: popup dei
  pacchetti MT5 solo su computer; conti Kraken sincronizzati (Aggiorna li rilegge, Scollega non li
  nasconde, Collega non e' piu' verde a riposo); via il Diario del ponte; "Pagina di prova" ->
  "Segnale manuale" in entrambe le sessioni; sale selezionabili nella dashboard dei win rate;
  journal e trade per periodo anche giornalieri; trade per fascia oraria; win rate degli Esiti
  senza i pareggi; sala/utente Syntra scritti nelle posizioni aperte e posizioni raggruppate per
  entrata con P/L sommato; interruttore per le sole linee delle posizioni; grafico del rendimento
  scorrevole con i numeri che seguono; metodologia della strategia (una posizione per TP oppure
  una sola chiusa a pezzi) nella cronologia e nell'apertura automatica, cripto escluse -
  8 test nuovi (laboratorio/app/richieste_8ott.test.mjs) - verde
- 2026-10-08 - Claude - server Oracle aggiornato alla v107 (prepara_server.sh): contenitori
  ricostruiti, ponte Telegram ricollegato da solo a tutte le sale senza chiedere il codice, la
  correzione dell'emoji ora gira davvero sul server. Il primo tentativo era rimasto a meta': il
  filtro che nascondeva la chiave d'accesso usciva sul titolo del passo 4 e il build non partiva -
  sorgenti nuovi, contenitori vecchi, exit code 0 bugiardo. Vedi la trappola in memoria. - verde
