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

## Progetti open source proposti dal proprietario (6 ottobre 2026)
Non sono il "cervello" (quello è memoria + test): sono **motori** per analisi e strategie. Uno per
bisogno, provato su Oracle, mai collegato a ordini veri senza approvazione.
| Progetto | Cosa fa davvero | Ruolo possibile qui | Licenza | Priorità |
|---|---|---|---|---|
| Kronos (shiyu-coder) | modello che prevede candele (OHLCV) | agente "analisi": previsioni da confrontare con il backtest | MIT | B |
| Vibe-Trading (HKUDS) | agenti AI: ricerca, codice di strategia, backtest, ordini simulati | idee e struttura per gli agenti di strategia | MIT | B |
| Freqtrade | bot cripto con backtest e ottimizzazione | motore di backtest delle strategie cripto | GPL-3: attenzione se si distribuisce | C |
| NautilusTrader | motore professionale di backtest e live | alternativa a Freqtrade, più pesante | LGPL-3 | C |
| skfolio | ottimizzazione di portafoglio e rischio | ripartire il rischio fra sale e strategie | BSD-3 | C |
| Hummingbot | market making e arbitraggio | poco pertinente (qui si seguono segnali) | Apache-2.0 | scartato per ora |
Prima di tutti: server Oracle base e test sui segnali (lavori A).

## Progetto futuro: server Windows dedicato, con piu' utenti (7 ottobre 2026)

Proposto dal proprietario. Oggi la strada e' ibrida: MT5 sul computer di casa, Kraken e segnali sul
server Oracle (Linux). L'idea e' un **server Windows nel cloud** dove gira TUTTO - MT5 col suo
terminale, il ponte, Syntra, Telegram - e a cui **anche altri utenti** possono chiedere grafico e
segnali, senza tenere acceso un computer.

Perche' ha senso: toglie l'unico pezzo che oggi obbliga ad avere il PC acceso. La catena di adesso
e' `terminale MT5 -> ponte sul PC (8001) -> server -> telefono`; li' diventerebbe tutta dentro una
macchina sola, e Syntra smetterebbe di essere l'eccezione che funziona solo su Windows.

**Cosa va deciso prima di cominciare** - sono le domande che decidono se il progetto e' di una
settimana o di tre mesi:

1. **Un MT5 per utente o uno solo condiviso?** Un terminale MT5 e' legato a un conto. Piu' utenti
   veri vogliono dire piu' terminali sulla stessa macchina (memoria, licenze, finestre) oppure un
   terminale solo in sola lettura per i dati, con gli ordini che restano sul conto di ciascuno.
   E' la domanda che cambia tutto il resto.
2. **Chi entra, e come si tiene separato da chi?** Oggi la chiave e' una sola e l'accesso passa da
   Tailscale, cioe' dai dispositivi di una persona. Con piu' utenti servono identita' separate,
   dati separati e un modo per non far vedere a uno le posizioni di un altro.
3. **Soldi veri di altre persone.** `cervello/REGOLE.md` oggi vieta i conti reali agli agenti.
   Ospitare ordini di terzi e' un'altra categoria di responsabilita': va deciso dal proprietario,
   non dato per scontato.
4. **Costi.** Windows nel cloud si paga ogni mese (licenza + macchina), al contrario della ARM
   gratuita di Oracle. Va messo in conto prima, non scoperto dopo.
5. **La sessione Telegram di chi?** Una per utente, con i vincoli di `REGOLE.md`.

**Cosa e' gia' pronto e non va rifatto**: il server come porta unica (`/pc/<porta>/<percorso>`, con
il canale dal vivo), il controllo della chiave condiviso fra i tre servizi, e il modello di
strategia unico (`fblSimulaStrategia`) usato sia per le prove sia per le aperture.

Stato: **idea, non pianificata.** Vedi `cervello/ORACLE.md` per la strada attuale.
