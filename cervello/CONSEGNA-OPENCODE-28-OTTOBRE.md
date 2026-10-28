# Consegna a OpenCode — 28 ottobre 2026

Scritto da Claude. Tutto quello che è stato fatto oggi, **cosa non toccare per non rompere**, e
tutto quello che resta da fare.

> **Regola zero.** Il proprietario ha pubblicato la **2.0.38**. Tutto il lavoro della prop firm
> descritto qui è **su GitHub ma NON ancora rilasciato**: sul suo PC e sul telefono gira la
> 2.0.38. Prima di dirgli «prova», guarda quale versione ha davvero installato.

---

## 1. COSA C'È ADESSO (fatto oggi, tutto su `main`)

### Prop firm — riscritta da capo, sei passi

| Passo | Cosa |
|---|---|
| 1 | I limiti si misurano sul **capitale iniziale**, come FTMO. Erano sbagliati in **tre** funzioni |
| 2 | Le regole in **un posto solo** (`FBL_PROP_REGOLE`), preset one step e two step |
| 3 | **Fasi** vere: seconda sfida, giorni minimi, costanza, massimo che insegue |
| 4 | **Commissioni**: valori tipici FTMO + imparate dal conto MT5 vero |
| 5 | **Quattro strategie** per sala (normale / one step / sfida 1 / sfida 2) |
| 6 | **Quanto ti spetterebbe** (90% one step, 80% two step) |

Più, su richiesta successiva del proprietario:

- **Overnight e notizie avvisano, non chiudono** il conto (vedi §2, è importante)
- **Tipo di conto Standard / Swing**, con restrizioni diverse
- **Ciclo di vita legato al conto**, non alla sessione
- **Conto perso: la domanda** «pratica o elimino?» con le due strade

### Fuori dalla prop firm

- **Aggiornamento automatico del PC**: il ponte scarica e installa sé stesso (`/aggiorna-programma`)
- **APK costruito da GitHub** a ogni release, firmato con chiave di rilascio
- **Zoom a un asse solo** sul pizzico a due dita
- **Modalità backtest** nasconde anche lo storico MT5, con interruttore
- **Strisce di vicinanza** spostate in «Posizioni sul grafico»
- **Trade Journal**: un'operazione senza `pips` non rompe più tutta la tabella

---

## 2. DIECI COSE DA NON TOCCARE

Ognuna è costata ore. Cambiarle senza leggere il perché rimette un difetto già pagato.

**1. I limiti prop si misurano sul CAPITALE INIZIALE, non sul saldo del giorno.**
FTMO: *«Maximum Daily Loss: 5% of the Initial Simulated Capital»*. Il limite in euro è **fisso**;
si azzera il *riferimento*, non il limite. Conto da 10.000 salito a 10.800: il limite resta 500,
non diventa 540.

**2. Overnight e notizie NON chiudono il conto.**
FTMO scrive *«may result in termination»* — **may**, non **will**: è una revisione umana. Solo i
due limiti di perdita sono automatici. Trattarle come violazioni ci renderebbe **più severi di
FTMO**, e un conto dichiarato violato che è ancora vivo è un risultato sbagliato.
**`blockedByPropFirmNews()` non blocca più l'ordine**: avvisa. Un'app che blocca abitua a una
protezione che nella realtà non c'è.

**3. Il massimo del two step è STATICO, quello del one step INSEGUE il saldo di fine giornata.**
Non il minimo intraday: è una terza formula ancora.

**4. `fasi` è un elenco, e non esiste nessun `if(oneStep)`.**
Il one step è un elenco da uno. Se aggiungi un ramo per il one step, hai due copie della stessa
regola — e due copie divergono sempre.

**5. La sfida 2 riparte dal CAPITALE INIZIALE**, non dal conto cresciuto. FTMO fa così.

**6. Il profitto delle SFIDE non si incassa.**
La cifra che spetta si misura **dopo** lo sblocco. Contando anche le sfide, nel caso di prova si
passava da 540 € a 1.440 €.

**7. Le quattro strategie: la copia è un punto di partenza, non un legame.**
`JSON.parse(JSON.stringify(...))` è voluto. Se restassero agganciate, modificare il one step
cambierebbe anche il conto normale: silenzioso, e su soldi veri.

**8. Il flusso dell'APK NON può ascoltare l'evento «release pubblicata».**
GitHub non propaga gli eventi creati col token automatico. Per tre release l'APK non è arrivato e
il flusso risultava verde **perché non girava affatto**. Ora `installer.yml` **chiama**
`apk.yml` nello stesso giro. Se lo «semplifichi» rimettendo il trigger sull'evento, torna tutto
come prima — in silenzio.

**9. `skipifsilent` è stato tolto da `installer.iss` di proposito.**
Senza, l'aggiornamento automatico installerebbe benissimo e lascerebbe l'app **spenta**.

**10. Con MT5 collegato, il ponte NON si spegne quando la pagina se ne va.**
Non è una grazia più lunga: è **nessuno spegnimento**, e ha la precedenza sulla grazia dei 90
secondi. La grazia salva la ricarica; non salvava il caso del proprietario, che tiene il ponte
acceso e il browser chiuso — lì nessuno torna e il ponte si uccideva, portandosi via MT5. Se
rimetti un conto alla rovescia unico «tanto poi torna qualcuno», torna il difetto: i segnali
arrivano e gli ordini non partono. Senza MT5 collegato la grazia c'è ancora, ed è giusto che ci
sia. Vedi [NON-INTERROMPERE-MAI-MT5.md](NON-INTERROMPERE-MAI-MT5.md).

---

## 3. COSA RESTA DA FARE

### A. Replay su MT5 — il prossimo, ed è spiegato dal proprietario

> *«Se abbiamo avviato la sfida prop firm e siamo collegati a MT5 ed effettuiamo la modalità
> replay, le operazioni che apriremo in replay andranno sul conto dello storico e non sul conto
> MT5. Si applicano le stesse regole della prop firm classica. Le operazioni aperte in replay non
> inficiano su quelle del conto MT5 ma solo su quelle del conto storico.»*

**C'è un difetto da correggere nello stesso punto.** Oggi `fblPropContoId()` risponde
`'simulato'` per tutto ciò che non è MT5: **lo storico e il simulato Capital.com condividono la
stessa sfida**. Perdi la prop in storico e te la ritrovi persa anche sull'altro.

Vanno separati in tre — `mt5:<login>@<server>`, `storico`, `simulato` — **e in replay deve valere
sempre quello storico, anche con MT5 collegato.** È lo stesso pezzo di codice.

### B. Dashboard dei conti archiviati

La logica c'è (`fblPropContiElenco`, `fblPropContoEliminaDefinitivo`) e i test la coprono, ma
**manca il punto nell'interfaccia** da cui vederli e cancellarli definitivamente.

### C. Effetto wow

È nel file (`fblWowLancia`, `wowOverlay`, `wowCanvas`, «clicca per saltare») ma
**`fblWowLancia()` non è chiamata da nessuna parte**: è codice inerte, non si vede. Manca il filo
che lo accende. Le guardie sono già fatte bene — non parte sotto test, non parte con posizioni
aperte, una volta per sessione.

### D. Resa totale di più sale

Progetto intero, mai iniziato. **Analisi e decisioni sono già scritte** in
[PROGETTO-RESA-TOTALE-SALE.md](PROGETTO-RESA-TOTALE-SALE.md): leggi quello prima di disegnare
qualcosa, le scelte le ha già prese il proprietario.

Il lavoro di codice è **uno solo**: `rendCurva` oggi riceve *una* strategia e *una* serie di
candele e le applica a tutti i segnali. Deve ricevere **due funzioni** che, dato il segnale,
dicono quali sono i suoi. Con una sala sola deve dare **numeri identici a oggi**: è anche il modo
di provare che non si è rotto niente.

**Requisito gridato dal proprietario** sulla percentuale di avanzamento: *«deve essere
incrementale e non deve fermarsi»*. Il totale va contato **prima** di cominciare — senza
denominatore non esiste una percentuale onesta, ed è esattamente la causa dell'inciampo già
pagato con la percentuale di caricamento ferma a 0%.

### E. Autonomia a programma chiuso — e NON è un difetto da sistemare

Il proprietario crede che le operazioni girino sul server e che la pagina non serva. **Non è
così, ed è misurato**: `/order/market`, `/order/close` e `/order/modify` sono chiamati **solo**
da `app.html`. Il ponte dei segnali non apre nessun ordine; il server legge i segnali e si ferma
lì. Con la pagina chiusa non parte niente.

Prima di dirgli che funziona, leggi [NON-INTERROMPERE-MAI-MT5.md](NON-INTERROMPERE-MAI-MT5.md):
c'è la catena intera e le due strade possibili. La strada giusta è portare la decisione dentro
`bridge.py`, che è un servizio e non muore — e provarla **contro** quella della pagina, segnale
per segnale, finché non dà numeri identici. Quel confronto non è un dettaglio: è l'unico modo
onesto di dimostrare che il ponte decide come decide la pagina oggi, su soldi veri.

### F. Pubblicare la 2.0.39

Tutto il lavoro della prop firm è su `main` ma **non rilasciato**. Da questa volta serve **anche
un Setup nuovo**: la correzione del punto 10 è in `bridge.py`, cioè dentro l'eseguibile, e non
arriva con l'aggiornamento della pagina.

---

## 4. COME SI LAVORA QUI

**Ogni correzione ha un test che era ROSSO prima**, e ogni test ha una **prova di controllo** —
un caso che deve restare verde, altrimenti si «ripara» togliendo l'informazione invece di
difenderla.

**Il collaudo locale verde non dice niente su quello di GitHub**: sistemi e librerie diversi.
Oggi quattro test passavano qui e cadevano là perché cominciavano con «se non è Windows, esci».

**Non spingere mai un test prima del codice che deve farlo passare**: in locale un rosso è
informazione, su GitHub è un allarme rotto che nessuno sa leggere. (Successo oggi.)

**`app.html` è condiviso.** `git add app.html` non è più sicuro di `git add -A` quando ci lavora
anche qualcun altro: guarda cosa entra davvero nel commit.

**Lezioni aggiornate oggi:** vedi `cervello/LEZIONI.md`, numeri 17-22.
