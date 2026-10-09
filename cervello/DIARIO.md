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
- 2026-10-08 - Claude - app v108: MT5 dal telefono. La strada degli ordini si prova invece di
  indovinarla, e il pannello dei servizi prova l'indirizzo che la sezione MT5 usa davvero (prima
  era verde su una rotta diversa). Trovato riproducendo il telefono nel laboratorio con la rete
  vera verso il server. 3 test nuovi - verde
- 2026-10-08 - Claude - app v109, sette passi concordati a voce col proprietario: prestazioni
  (date delle candele lette a mano, decimali una volta per disegno, due memorie nel disegno -
  primo disegno da 3241 a 1060 ms e trascinamento da 50 a 24 ms per immagine su telefono),
  raggruppamento delle posizioni con codice del segnale e tolleranza, origine delle operazioni,
  un solo nome di sala ovunque (col ponte che manda i titoli), numero di target preso dalla
  storia della sala e tetto da 5 a 10. 32 test nuovi in 6 file - verde
- 2026-10-08 - Claude - app v110, passi 8-12 della scaletta: distribuzione equa, «chiusura
  parziale» col nome giusto, lo spostamento dello stop RIMESSO anche nelle chiusure parziali
  (decisione cambiata dal proprietario), le stesse scelte dentro l'apertura automatica, e ogni
  sala con le sue righe di target - imparate dai segnali che arrivano, non uguali per tutte.
  Verificato con una prova che la resa della sala tiene conto dello spostamento dello stop, e
  che senza candele in memoria NON lo fa (ora la nota sotto il grafico lo dice a chiare lettere).
  2 test nuovi, 3 aggiornati alla decisione nuova - verde
- 2026-10-08 - Claude - app v111: risolto il bug del grafico del rendimento al tocco (segnalato
  dal proprietario) e passo 14, le operazioni a blocco sulle posizioni aperte in stile
  MetaTrader 5: tutte, in guadagno, in perdita, per direzione, e un asset alla volta con dentro
  buy e sell. Ogni voce dice quante posizioni tocca e con che risultato, e chiede conferma.
  10 test nuovi - verde
- 2026-10-09 - Claude - prima il guasto vivo, poi la richiesta del proprietario.
  Il ponte degli ordini si era impallato verso le 01:59: il processo
  ForexBacktestLAB era ancora in lista e il log finiva con 200 OK di pochi
  minuti prima, ma la porta 8000 non ascoltava piu' (grafico 8001 e segnali
  8769 invece si') - da lì "la connessione a ordini dà problemi" e il telefono,
  che passa dal server, non seguiva piu' MT5. Basta riavviare l'exe: a ogni
  avvio uccide le istanze vecchie di sé e di Mt5FeedServer e riparte pulito.
  Poi app v112, chiesta a voce: il popup «scarica i pacchetti aggiuntivi» non
  deve esistere su telefono e tablet. Due buchi (vedi BUG.md): il gate cadeva
  sul passo 1 col testo statico quando il ponte moriva mentre si era al gate, e
  fblEMobile() non vedeva il telefono in «modalità desktop». Il download di
  MetaTrader 5 esce dal gate su ogni dispositivo che non sia il computer.
  4 test nuovi (laboratorio/app/pacchetti_mobile.test.mjs) - verde
- 2026-10-09 - agenti - passo 13 della scaletta, l'instradamento su Capital.com
  app v113 / Setup 1.0.113. Con MT5 collegato, il segnale di una sala su uno
  strumento che non esiste ne' su Kraken ne' su MT5 (azione, indice) finiva
  mandato a MT5 come ordine vero con l'epic di Capital.com, e il broker lo
  rifiutava. Ora c'e' tgContoEffettivoPerSegnale (asincrona) che chiede a MT5
  se ha lo strumento e, se non ce l'ha, accende Capital.com da sola (in
  silenzio, senza moduli) e apre li' una posizione SIMULATA, mai un ordine a
  MT5. Le posizioni Capital.com sono una famiglia a parte nel Trade Journal
  ('💹 Capital.com'), come Kraken. Prima il test che fallisce: nuovo file
  laboratorio/app/capital_instradamento.test.mjs, 5 test che prima erano rossi
  e ora passano; sintassi dell'app pulita. Versioni alzate: sw.js CACHE_NAME a
  forex-backtest-lab-v113 e installer_build/installer.iss MyAppVersion a
  1.0.113. Nota di metodo: il lavoro e' stato preparato facendo esplorare il
  codice a tre agenti indipendenti in parallelo e poi confrontando le loro
  letture con la fonte. La lezione e' che gli agenti servono a non fidarsi di
  una sola lettura, ma la verifica vera resta sempre il file e il test. Non e'
  stato pubblicato nulla: tutto resta non committato in attesa del via del
  proprietario.
- 2026-10-09 - agenti - ONDATA 1 della scaletta, in un colpo solo e con piu' agenti in
  parallelo. Apertura automatica dei segnali: la fa SOLO il computer (telefono e
  tablet mostrano il segnale e aprono a mano). Corretto l'errore latente del passo
  13: nel ramo Capital di tgAutoValuta si usava sym prima della dichiarazione (TDZ)
  e l'apertura automatica Capital.com andava in errore. Filtro anti-doppioni dei
  segnali (v116): stesso strumento, direzione, fascia d'entrata e target non aprono
  una seconda posizione - in automatico blocca, a mano avvisa e chiede conferma.
  Attribuzione della sala nella tabella posizioni allineata al Trade Journal (v115),
  cosi' la STESSA posizione mostra la stessa sala e non piu' 'tu'. L'asse dei prezzi
  e le colonne COB/SVP non zoomano piu' per errore (v117). Capital.com nella barra
  dei conti (v118): ordini MANUALI simulati, mai a MT5. Test nuovi:
  apertura_solo_computer, filtro_doppioni (+_auto), attribuzione_mt5,
  asse_prezzi_zoom, capital_manuale. Pubblicato: commit 86f6293 (v117) e 560f95b
  (v118) - verde - Falliti: 0
- 2026-10-09 - agenti - Passi 15/16: storia completa di un utente Syntra. Il robot
  tocca il nome in alto a destra di una scheda, apre il profilo, scorre e legge
  tutte le operazioni, e le ARCHIVIA nella cronologia della sala 'Syntra · <utente>'
  (mai in bacheca, senza toccare la pagina Notifiche). Il ponte _manda_storico per
  le sale Syntra chiede la lettura e aspetta che finisca (max 60 s). app v119 /
  Setup 1.0.119. Test: laboratorio/ponte/test_profilo_syntra.py (4, prima rossi) -
  verde - Falliti: 0 - 6fc0a5b
- 2026-10-09 - agenti - Passo 17: memoria riportata al vero. CONSEGNA allineata a
  v119 (storia v113->v119, passi 13/15/16 chiusi, mappa di app.html a ~41.500
  righe), diario e registro bug completati, MAPPA e IDEE aggiornate. - verde
- 2026-10-09 - agenti - Passi 18/19: linee TP/SL della cronologia a grafico. Ora valuta registra la
  candela di colpimento di OGNI TP (tpT) e quella dello stop (slT); fblCronoAncore le traduce in
  indici a grafico (tpEnd, slEnd); fblCronoDisegna disegna ogni linea fino alla SUA candela (non
  piu' tutte fino all'evento finale) e stampa una spunta a SINISTRA del punto in cui un TP e' stato
  preso. Se lo stop non e' stato preso, la sua linea prende la lunghezza dell'ultima di TP. app v120
  / Setup 1.0.120. Test: laboratorio/app/cronologia_linee.test.mjs (3, prima rossi). - verde -
  Falliti: 0
