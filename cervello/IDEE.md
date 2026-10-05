# Idee (estetica, semplicità, leggerezza, guide)

Formato: **[priorità A/B/C] titolo** — perché serve — chi l'ha proposta — stato.
A = blocca o confonde un neofita; B = migliora molto; C = rifinitura.

- **[A] Primo avvio guidato** — chi apre l'app per la prima volta non sa da dove partire (CSV?
  MT5? Kraken?). Tre domande e l'app si configura. — proprietario — da fare
- **[A] "?" accanto a ogni pannello** — spiegazione in parole semplici di cosa fa e quando usarlo. —
  proprietario — da fare
- **[A] Glossario** (lotto, pip, SL, TP, R:R, margine, leva, pendente LIMIT/STOP) raggiungibile da
  ogni etichetta. — proprietario — da fare
- **[B] Spezzare app.html** in più file: 38.500 righe in un file solo sono la prima causa di
  instabilità e di lentezza nelle modifiche. — regista — da valutare (lavoro grosso)
- **[B] Indicatore "ponte sul PC acceso/spento"** sempre visibile quando il conto scelto ne ha
  bisogno. — da fare

## Lavori chiesti dal proprietario (5 ottobre 2026), in ordine di priorità
- **[A] Segnali Syntra sulla sessione cripto** — devono arrivare chiari e leggibili e aprire le
  posizioni giuste sul conto scelto; la dashboard rispetta i segnali di ogni utente Syntra (sala).
  Primo passo: test con messaggi Syntra registrati (`storico_sale` archivia `sy_*.json`) →
  interprete → apertura sul ponte Kraken finto. — da fare
- **[A] Telegram: messaggi non capiti** — ogni messaggio che l'interprete scarta o capisce a metà
  va archiviato (sala, testo, motivo). Gli agenti lo trasformano in un caso di
  `test_formati_reali.py`, correggono l'interprete e verificano sul segnale successivo della
  stessa sala. Così "si adatta" davvero: con prove, non a sentimento. — da fare
- **[B] Analisi dei grafici e strategie (es. Fibonacci tracciato da solo)** — l'app propone
  livelli e strategie e li **mostra e spiega**; si discutono col proprietario e si provano sul
  backtest prima di qualunque uso. Mai ordini automatici da queste analisi senza approvazione. — da
  valutare dopo i due punti sopra
- **[B] Ogni piattaforma** — l'app è già una pagina web (PWA): gira su Windows, Mac, Linux,
  Android e iPhone/iPad dal browser. Il pezzo legato a Windows è il programma sul PC (MT5 esiste
  solo per Windows; BlueStacks per Syntra). Ogni modifica va provata almeno a schermo grande e
  da telefono (`avvio.test.mjs` lo fa già). Un ponte per Mac/Linux senza MT5 (solo Kraken e
  Telegram) è fattibile: da valutare dopo i lavori A. — proprietario — da valutare
