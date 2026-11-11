# Richieste aperte — finestra duplicata («Duplica finestra»)

Lista creata il 7 novembre 2026. Lavoro separato dal rilascio mercato-chiuso.
Ogni voce va riprodotta e misurata prima di curare (regola: si misura prima di correggere).

## Difetti segnalati

1. **Sfarfallio delle posizioni aperte** nella duplicata: TP, SL, punti di entrata,
   P/L live, prezzo attuale non coincidono con la madre e lampeggiano. Causa da misurare:
   due loop che si pestano o stato condiviso non sincronizzato.
   - Stato: DA FARE.

2. **Schermo intero bloccato sulla pagina madre** dopo aver duplicato una finestra.
   La madre deve poter andare a schermo intero anche con duplicate aperte.
   - Stato: DA FARE.

3. **Scroll indesiderato** nella duplicata: rodellina/dito fanno scorrere la pagina,
   ma deve esserci solo il grafico. La barra laterale degli strumenti e del replay
   deve restare ancorata a sinistra.
   - Stato: DA FARE.

4. **Elenco asset limitato / modalità CSV** su una seconda duplicata: la duplicata
   mostra pochi asset, perde le watchlist, in alcuni casi si apre in modalità storico CSV
   invece di seguire il conto della madre. Asset e watchlist devono essere identici,
   e il conto (MT5 / CSV / Kraken) lo stesso.
   - Stato: FATTO IN PARTE (v2.1.1): la duplicata ora entra in Live se la madre e' in Live
   (vedi pip_conto_madre.test.mjs). RESTA: elenco asset identico alla madre e watchlist
   (oggi l'elenco arriva solo da MT5/Capital di questa finestra).

5. **Collegamento tra le sessioni**: le duplicate sono sessioni diverse ma devono
   condividere il conto selezionato. Se la madre passa da MT5 a CSV, le duplicate
   si adattano automaticamente.
   - Stato: PARZIALE (v2.1.1): all'apertura la duplicata prende la modalita' della madre.
   RESTA: propagare il CAMBIO di modalita' dopo l'apertura (madre che passa Live->Storico
   o cambia conto con duplicate gia' aperte).

6. **Replay sincronizzato**: premendo Replay con duplicate aperte, il programma chiede
   se applicare il replay anche alle altre duplicate. Se confermato, le duplicate
   entrano in replay e le posizioni replay si trasportano sulle altre.
   - Stato: DA FARE.

7. **Disegni sincronizzati**: un disegno manuale aggiunto su una pagina deve
   comparire anche sulle altre duplicate, indipendentemente da quale è la madre.
   - Stato: DA FARE.

8. **Modello sulla barra strumenti**: selezionando un disegno salvato come modello e
   poi cliccando sul grafico, il disegno viene tracciato subito con le priorità salvate;
   al trascinamento/applicazione si applicano tutte le priorità salvate.
   (Verificare: potrebbe già funzionare.)
   - Stato: DA VERIFICARE.

9. **Chiusura lenta delle operazioni** (TP che scatta, chiusura a mercato): già lenta
   di suo, e con duplicate aperte rallenta ancora di più. Le chiusure devono essere
   istantanee. Le duplicate non devono rallentare il sistema.
   - Stato: DA FARE.

## Note per chi cura
- Misurare prima: riprodurre il flickering con le DevTools (Performance) e contare
  quanti aggiornamenti al secondo arrivano alla duplicata.
- Il guardiano `currentAssetKey` («Mai far comparire due grafici») va rispettato
  anche sulla strada nuova.
- Non mescolare queste modifiche con il rilascio mercato-chiuso: lavoro a sé.

## Ordine proposto
Iniziare dalle più concrete e misurabili:
  - 3 (scroll/overflow) — CSS, verificabile in 1 minuto.
  - 4 (asset list / conto) — confronto asset disponibili tra madre e duplicata.
  - 1 (flickering) — richiede misura degli aggiornamenti.
  - 7 (disegni) — estendere il canale BroadcastChannel esistente.
  - 6 (replay) — aggiungere richiesta di conferma + sync.
  - 5 (collegamento conto) — propagazione del conto selezionato.
  - 2 (schermo intero) — likely facile, da verificare.
  - 8 (modello) — verifica comportamento attuale.
  - 9 (prestazioni) — profiling, da fare per ultimo.

## Voce 4/5 — ELENCO ASSET DELLA DUPLICATA (misurato 8 novembre 2026)

Dagli screenshot del proprietario, dialogo «Ricerca simbolo» aperto nelle due finestre:
- pagina madre: ASSET DISPONIBILI (35), con la stellina della watchlist piena su XAUUSD;
- pagina duplicata: ASSET DISPONIBILI (5) — solo EURUSD, GBPUSD, USDJPY, XAUUSD, XAGUSD, e le
  stelline della watchlist tutte vuote.

CAUSA MISURATA nel codice: una finestra PIP aggiuntiva nasce VUOTA per scelta esplicita (non
ripristina da storage, vedi initExtraPipWindow). L'elenco degli asset si costruisce da quello
che la finestra ha caricato o ricevuto lei: senza l'eredita' dalla madre restano solo i cinque
di base. La watchlist sta in localStorage, che una finestra appena nata non ha ancora letto.

RICHIESTO: gli asset disponibili e la watchlist devono essere identici a quelli della pagina
madre, elencati allo stesso modo. Non sono due elenchi da tenere allineati a mano: la duplicata
deve EREDITARE quello della madre, una volta, all'apertura.

STRADA (da misurare prima di curare): il messaggio pip_clone_snapshot porta gia' stili, asset
corrente e credenziali MT5 (vedi il gestore). Gli stessi campi che costruiscono l'elenco — il
risultato della ricerca Capital.com e la watchlist — viaggiano la' dentro, e la duplicata li
applica prima di mostrare il dialogo. Misura: contare le voci del dialogo nelle due finestre
dopo l'apertura (oggi 35 contro 5).

- Stato: DA FARE (dopo la regressione delle linee entry/tp/sl: tocca lo stesso canale di
  comunicazione tra finestre, meglio non aprirne due fronti insieme).


## SEGNALAZIONI DELLA SERA DELL'11 NOVEMBRE 2026 (a voce, dal proprietario)

Arrivate DOPO la v2.2.28. Quasi tutte sono voci GIA' APERTE in questa lista, e una di esse
(l'elenco asset) era GIA' MISURATA l'8 novembre: sono rimaste indietro mentre si curava altro.
Nessuna va curata a intuito: per ognuna c'e' scritto se la misura esiste o manca.

**IL PRINCIPIO, parole sue:** «la pagina duplicata quello che deve fare e' semplicemente un copia
e incolla di quello che c'e' sulla pagina madre, solo con le limitazioni che ho scritto e ho
definito. Che alcune cose devono essere trasportate, alcune no. Tipo quelle dei disegni, gli
indicatori, i time frame, eccetera.»
Quindi il comportamento atteso NON e' «qualche campo viaggia»: e' **copia della madre** piu' una
lista chiusa di eccezioni. Le eccezioni sono quelle scritte in questo documento e nel DIARIO.

### 10. IL GRAFICO DELLA DUPLICATA RESTA PIANTATO SUL CARICAMENTO  ← P0, NUOVO, da misurare
Parole sue: «adesso le pagine duplicate, il grafico fa sempre scarico lo storico in corso, carico
l'asset e rimane sempre li' piantato. Non carica.»
Non misurato. Da misurare: in quale stato si ferma (il messaggio a schermo e' quello dello
scaricamento storico), se la richiesta al ponte parte, se torna, e se il disegno riprende. Da
guardare per prime: l'eredita' del conto all'apertura (se la duplicata non sa quale conto usare,
puo' restare in attesa di dati che non arrivano) e il guardiano `currentAssetKey`.
- Stato: DA MISURARE.

### 11. IL CONTO ARRIVA IN RITARDO, E LA TERZA DUPLICATA PRENDE QUELLO VECCHIO  ← P0
Parole sue: «a un certo punto ci aveva salvato che era collegato con un account, poi dopo un po' di
tempo si e' collegato effettivamente all'account che e' stato caricato sulla pagina principale» e
«ho aperto una terza pagina duplicata e ancora mi da' il conto selezionato in precedenza, non
quello corrente».
E' la voce 5 di questa lista (propagare il CAMBIO di conto dopo l'apertura), piu' un caso nuovo e
preciso: **la TERZA finestra**. Le cure di v2.2.26 e v2.2.28 hanno fatto viaggiare il conto, ma
qui la finestra nuova eredita uno stato VECCHIO, non quello corrente. Da misurare: con tre
finestre aperte e un cambio di conto sulla madre, quale conto dichiara ognuna delle tre e in che
ordine temporale (il ritardo e' parte del sintomo, non un dettaglio).
- Stato: DA MISURARE. Collegata alla voce 5.

### 12. ELENCO ASSET INCOMPLETO SOLO SULLA SECONDA DUPLICATA IN POI  ← P1
Parole sue: «vado a selezionare gli asset e me ne fa vedere solo alcuni, non mi fa vedere come
quelli della pagina principale, mentre invece la prima pagina duplicata si'.»
E' la voce 4, GIA' MISURATA l'8 novembre (madre 35 asset, duplicata 5) e mai curata. La novita'
utile: la PRIMA duplicata adesso e' a posto, la SECONDA no. Questo restringe la causa:
l'eredita' funziona per chi nasce dalla madre e non per chi nasce da una duplicata (o per chi
nasce quando la madre ha gia' una figlia).
- Stato: DA FARE, misura esistente da ripetere con TRE finestre.
