# PROGETTO: la decisione nel ponte ("strada 2")

> «la regola "questo segnale è questo ordine, con questo rischio, con questi stop" va portata in
> `bridge.py`, che è un servizio e non muore. La pagina diventa quello che dovrebbe essere — il
> **cruscotto**: guarda, configura, interviene a mano.» — consegna 28 ottobre, punto E

## 1. Cos'è, in una frase

Oggi **la pagina decide** e il ponte esegue. Il progetto sposta **la decisione** nel ponte, così
funziona 24/7, anche a pagina chiusa.

## 2. Cosa ho misurato (numeri, non impressioni)

| Pezzo | Dove sta oggi | Quanto è |
|---|---|---|
| La decisione (`tgPiano`) | `app.html` riga 34079 | **212 righe** |
| Le sue dipendenze | `tgRischioTotale`, `tgStopCalcolato`, `tgTpSenzaTpPctDi`, `tgRischioSenzaSlDi`, `tgTpInOrdine`, `tgAutoPerSimbolo`, `tgApreSenzaSl/Tp`… | **11 funzioni** |
| L'esecuzione (`tgEseguiSegnale`) | `app.html` riga 34320 | chiama il ponte |
| La gestione dal vivo (`evaluate`, `tgStrategiaValuta`: pareggio, break-even, sposta stop) | `app.html` | altre migliaia di righe |
| La decisione **nel ponte** | `bridge.py` | **zero**. Zero funzioni di rischio, zero endpoint che trasformi una % in lottaggio. L'unica correzione che fa è arrotondare il volume al passo del simbolo (`_round_volume`) |

**Conclusione della misura: il confronto oggi dà numeri diversi per costruzione.** Da una parte
c'è chi decide, dall'altra chi esegue. Finché il ponte non decide, non c'è niente da confrontare —
ed è esattamente il perché con la pagina chiusa non parte nessun ordine.

**Una buona notizia, già misurata:** `bridge.py` **lancia già** `segnali_bridge.py` (porta 8769).
Vuol dire che il ponte ordini può già leggere i segnali: non bisogna costruire un canale nuovo.

## 3. Cosa deve contenere il ponte, alla fine

1. **Legge i segnali** dal ponte segnali (già lanciato da lui).
2. **Decide**: symbol → side, entrata (mercato/limite/stop), stop, target in ordine, rischio % →
   lotti, quote per target, quali tenere, quali scartare, con gli stessi rifiuti della pagina
   («entrata troppo lontana», «stop dalla parte sbagliata», «la sala non ha dato lo stop e hai
   scelto di non aprire»…).
3. **Esegue** su MT5 (già lo fa).
4. **Gestisce dal vivo**: pareggio %, break-even in pip, «al target n sposta lo stop», stop
   iniziale. Deve farlo con un **tick** da MT5 (il terminale è già connesso, non serve il
   WebSocket della pagina).
5. **Riporta**:alla pagina lo stato, i numeri, i ticket. La pagina mostra e permette di intervenire.

## 4. Come si fa senza rompere niente — l'ordine giusto

**Il confronto PRIMA della riscrittura.** La consegna lo chiede e ha ragione: senza, non si
dimostra niente. Quindi:

- **Fase 1 — lo strumento di confronto** (`laboratorio/confronto/`): N casi reali (i segnali veri
  del proprietario), passati alla pagina (`tgPiano`) e al port Python. Stampa la tabella delle
  differenze. **Strumento, non test CI**: all'inizio è rosso, e un test rosso non può stare in
  CI. Quando è verde su tutti i casi, diventa un test.
- **Fase 2 — la matematica del prezzo in Python** (`pipSizeForAsset`, `euroAtLevel`,
  `marginForLots`, `calculateForexPL`): prende i dati dal `symbol_info` di MT5, che il ponte ha
  già. Test: stessi numeri della pagina per N simboli.
- **Fase 3 — la decisione in Python** (`tgPiano` → `decida()`): guida da un **unico file di
  configurazione** esportato dalla pagina. Due config che un domani divergono sono due
  comportamenti diversi: la config resta una sola. Test: piani identici per N segnali.
- **Fase 4 — il ponte legge i segnali**: la coda dal segnali_bridge (già suo figlio).
- **Fase 5 — la gestione dal vivo in Python**, su tick MT5. È il pezzo che non deve morire mai.
- **Fase 6 — il commutatore**: quando il ponte dice «pronto», l'automatico passa a lui e la pagina
  resta il cruscotto. Fino ad allora, l'automatico resta della pagina.

## 5. Cosa NON fare (trappole già pagate)

- **Non duplicare la configurazione.** Una config per la pagina e una per il ponte = due
  comportamenti che divergono. Una sola, esportata.
- **Non cambiare comportamento mentre si sposta.** Il confronto deve dare numeri **identici**;
  appena cambia un numero, ci si ferma e si capisce quale dei due ha ragione.
- **Non spegnere il resto per «semplificare».** Il ponte segnali, il feed server e la grazia
  hanno ognuno una ragione scritta: si leggono prima.
- **Non partire dalla fase 5** (la gestione dal vivo): è la più pericolosa, e senza le fasi 1-4
  non si può provare.

## 6. Stima onesta

Non è una serata: è la riscrittura in Python della parte che calcola rischio, volume, stop e
target, più la gestione dal vivo. La parte **misurabile** (fasi 1-3) è ciò che dà il permesso di
fare la 4-6: finché il confronto non è verde, spostare la decisione sarebbe spostare un difetto.

## 7. DECISIONE DEL PROPRIETARIO (31 ottobre 2026): gli ordini restano della pagina

> «per quanto riguarda gli ordini in realtà il server deve solo inoltrare, non deve prendere le
> decisioni lui, il sistema rimane lo stesso di oggi, ma solo per gli ordini. tutto il resto va
> cambiato e aggiornato e deve funzionare in maniera maniacale.»

Cosa dice, tradotto in lavoro:

- **Gli ordini non si spostano.** La decisione resta in `app.html` (`tgPiano`); il ponte ordini e
  il server Oracle **inoltrano ed eseguono**, come oggi. Coerente con la misura fatta in apertura:
  `server_oracle/ponte_server.py` ha 8 endpoint, tutti di inoltro, e zero riferimenti a
  rischio/lotto/stop/target — è la strada, non il conducente.
- **Le fasi 5 e 6 sono FERMATE.** Niente gestione dal vivo autonoma nel ponte, niente commutatore
  che spenga l'automatico della pagina. La Fase 4 resta, ma **per quello che è**: lettura dei
  segnali e messa da parte dell'ultimo — il ponte sa quali segnali sono arrivati, e non esegue
  niente da sé. Nessuna autonomia, quindi nessun ordine mandato senza che la pagina lo chieda.
- **Le fasi 1-3 restano valide e restano in CI.** Misurano che il Python del laboratorio e la
  pagina fanno gli stessi numeri: sono uno strumento, non un trampolino per accendere l'automatico.
  Se un domani la decisione si sposta davvero, quello è il permesso già conquistato.
- **Il lavoro vero ora è «tutto il resto»**: servizi, servizio dati, segnali, prestazioni, replica,
  interfaccia. Quello va curato uno per uno, con la solita regola: si misura, si cura, il test
  misura il comportamento, non la presenza di una stringa nel sorgente.
