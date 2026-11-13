# RICHIESTE DEL PROPRIETARIO — 12 novembre 2026, sera

Dettate a voce in una sola sessione. Scritte qui parola per parola nelle parti che contano, perché
una di esse **è costata un conto prop firm vero**. L'ordine è quello della gravità, non quello in
cui sono state dette.

---

## 1. P0 — L'APERTURA AUTOMATICA DEVE ESSERE PER CONTO. HA GIÀ CHIUSO UNA PROP FIRM.

**Parole sue:** «se andiamo nelle impostazioni per il conto singolo e disabilitiamo l'interruttore
generale dell'apri le posizioni in automatico, mentre su un altro conto lo abbiamo attivo... sul
primo conto che non è attiva questa cosa non mi deve assolutamente aprire le posizioni in
automatico, perché io l'ho scelto che per quel conto nello specifico non deve aprire le posizioni
in automatico, ma devono arrivare soltanto i segnali. **Quindi è una logica da applicare
assolutamente, perché per colpa di questa cosa questa notte ci ho chiuso un conto. Ci ho chiuso una
prop firm. Che mi ha aperto delle posizioni dove io gli avevo detto di non aprire le posizioni in
automatico, invece ha preso l'impostazione dell'altro conto e l'ha applicate direttamente sull'altro
conto selezionato.**»

**LA REGOLA, come l'ha definita:**
- l'interruttore «apri le posizioni in automatico» vale **per quel conto e basta**;
- se su un conto è spento, su quel conto **non si apre niente, mai**, qualunque cosa dicano gli
  altri conti o la configurazione base;
- se più conti sono selezionati e hanno l'interruttore **acceso**, l'app passa da un conto
  all'altro, apre su ognuno, e **alla fine torna al conto che si stava guardando**;
- un conto con l'interruttore spento riceve **solo il segnale**, senza aprire.

**Cosa si sa già del codice** (letto il 12 novembre): la configurazione per conto esiste
(`tgAutoPerConto`, chiave `fb_tg_auto_per_conto`) e un conto reale nasce con `attivo:false`. Ma
`tgAutoRisolvi(fam, contoKey)` usa `tgAutoContoSelezionato` — **il conto scelto nell'INTERFACCIA**,
non quello su cui si sta per aprire. `tgAutoDi(fam)` e `tgAutoPerSimbolo(x)` lo chiamano senza
passare nessun conto, quindi **ricadono sul conto selezionato a schermo o sulla base**. È questa la
strada da cui l'impostazione di un conto è finita addosso a un altro.
Da misurare e curare: la decisione di aprire deve ricevere il conto DI DESTINAZIONE, sempre, e
senza ripiego — se il conto non si sa, **non si apre**.

---

## 2. P0 — NEL GRAFICO COMPAIONO POSIZIONI E STORICO DI ALTRI CONTI

«Se collego un conto qualsiasi, MetaQuotes oppure FTMO, collegato con una prop firm oppure quello
free o reale, mi rimangono tutte le posizioni, lo storico nel grafico di tutti quanti gli account, e
questa cosa non va bene. Quello che mi deve far vedere è la cronostoria soltanto di quello specifico
account a cui sono collegato. Stop. Non mi può far vedere altre posizioni di altri account.»

**PRECISATO DAL PROPRIETARIO il 12 novembre, dopo una mia domanda sbagliata:** «la cronostoria
intendo **sul grafico e non sul journal**, sono due cose diverse. Intendevo dire che se sono
collegato con l'account 1 non posso vedere le posizioni chiuse dell'account 2 a grafico, ed è come
funziona su qualsiasi piattaforma di trading.»

Quindi il confine è questo, e va rispettato in entrambi i versi:
- **a grafico**: solo il conto collegato, posizioni aperte (già v2.2.28) **e chiuse** (da curare);
- **nel Journal**: NON si tocca. Resta lo storico completo con la sua tendina. Avevo pianificato
  di far partire la tendina sul conto collegato: **non si fa**. Era anche la strada con la
  trappola già misurata (un filtro per conto cancella le operazioni simulate, perché
  `journalTradeMatchesFilter` scarta chi non ha un ticket MT5).

È la stessa famiglia già curata per il grafico nella v2.2.28, che però copriva solo le posizioni
APERTE. Da misurare allo stesso modo: collegare il conto A, contare le operazioni chiuse disegnate
a grafico; passare al conto B e ricontare. Sul conto B deve esserci solo il conto B.

---

## 3. P0 — LA PROP FIRM NON SI RICORDA DI ESSERE GIÀ STATA AVVIATA

«Ogni volta che apro una pagina duplicata, e sono collegato a un conto, mi dice sempre se questo
conto è una prop firm o meno. E anche sulla pagina madre. Certe volte mi dice se voglio avviare su
questo conto la challenge della prop firm, ma in realtà è già stata avviata. **Deve rimanere in
memoria fisso che quel conto è stato ormai utilizzato come prop firm ed è stata attivata, e se lo
deve ricordare. Non se lo può scordare.**»

Si lega alla voce 1: una domanda ripetuta su un conto prop firm è anche il momento in cui si fanno
scelte sbagliate in fretta.

---

## 4. P0 — I DISEGNI SI AGGIORNANO MENTRE LI STAI ANCORA SPOSTANDO

«C'è una frequenza di aggiornamento indescrivibile per quanto riguarda i disegni, quindi è una
riscrittura che fa in più ogni volta, e **molto probabilmente è anche quello che incide sulle
scritture e letture di Firebase**. Se inserisco una linea e prendo uno dei due capi e la vado a
spostare, **mi si deseleziona**, e in più mi va ad aggiornare nel tempo di qualche millisecondo
anche nelle altre pagine. Invece **mi deve dare il tempo di trascinare, spostare e modificare il
disegno finché non lo rilascio. Quando lo rilascio, allora apporta le modifiche anche alle altre
pagine.**»

**La regola: si annuncia al RILASCIO, non durante il trascinamento.** Vale per linee, profili
volumetrici, rettangoli, tutto. Il proprietario ha anche indicato da solo il legame con la bolletta,
ed è lo stesso punto della regola del cloud scritta oggi.

---

## 5. P1 — IL SALVATAGGIO DEL SETUP DEGLI INDICATORI NON FUNZIONA

«Quando vado nelle impostazioni e vado a salvare il setup, applico il nome e **non me lo salva**.»

E tre richieste collegate:
- **il setup salvato su una pagina duplicata vale per tutte**: «deve essere salvato su tutte le
  pagine duplicate, cioè all'interno di Forex Backtest LAB in generale»;
- **un indicatore aggiunto dopo deve ricordare l'ultimo settaggio usato**, non ripartire dal
  predefinito: «si deve ricordare quando l'ho modificato sulle pagine duplicate, così mi trasporta
  il setup che avevo fatto prima»;
- vale anche per gli undici indicatori nuovi (v2.2.35), che usano lo stesso pannello.

---

## 6. P1 — LE PAGINE DUPLICATE DEVONO ESSERE UNO SPECCHIO, NON UNA SESSIONE NUOVA

«Per quanto riguarda il grafico e le candele, quello che dovresti fare per le pagine duplicate è
**esattamente lo specchio di quello che carica la pagina madre, e non aprire sessioni diverse**.
La pagina sorgente è la pagina madre, poi le pagine duplicate prendono i dati dalla pagina madre.
Perché se no le scritture, i disegni delle candele eccetera peserebbero troppo, e verrebbero troppe
scritture e troppe letture, e appesantiremmo Firebase. **Bisogna fare come funziona su TradingView:
permette di duplicare la sessione, ma non apre una nuova sessione totale di tutta l'applicazione.**»

Più: «le impostazioni di stile della pagina madre vanno spalmate anche sulle pagine duplicate».

**DECISO DAL PROPRIETARIO il 12 novembre, dopo una mia proposta diversa:** «se chiudo la madre mi
si chiude tutto il programma con tutte le finestre duplicate». Quindi **niente elezione di una
nuova madre**: avevo proposto che una duplicata si promuovesse, e non si fa. Chiudere la madre
chiude tutto. È più semplice e toglie il pezzo più delicato del progetto (chi comanda quando la
madre sparisce, e cosa succede se due si promuovono insieme). Da curare invece la conseguenza:
una duplicata che resta orfana per un incidente — la madre va in crash, non la chiudi tu — non
deve restare a schermo mostrando numeri fermi che sembrano veri. Si chiude anche lei, e lo dice.

**IL CONFINE DEL PESO, che è il motivo per cui si fa:** «mi raccomando qua dobbiamo fare
assolutamente un bel lavoro, e mi raccomando attento al peso sul PC e al peso dei dati che girano
su Firebase». La regola operativa che ne esce: una duplicata **non parla con Firebase, mai** — né
legge, né scrive, né ascolta. Oggi ogni finestra apre i suoi quattro ascolti permanenti, e un
ascolto non è gratis (ogni arrivo è una lettura): con la madre più due duplicate una modifica da
telefono diventa dodici letture invece di quattro. Accettazione misurabile: aprendo una duplicata,
ascolti aggiunti = 0, scritture = 0, richieste di storico = 0.

È esattamente la strada che l'agente aveva proposto il 12 novembre (una sola fonte di verità tenuta
dalla madre, le figlie leggono e non scrivono): adesso è una richiesta esplicita del proprietario,
non più solo un parere.

---

## 7. P1 — IL PROGRAMMA PESA TROPPO, E LO SPLIT LO FA ESPLODERE

«Il programma in sé pesa veramente tanto. Quando apro una pagina split mi si sovraccarica la
memoria e **anche la scheda grafica si surriscalda**. Diventa quasi insostenibile, si riesce a
lavorare a malapena.»

Già misurato il 12 novembre: 34-36 processi del motore grafico per 1,7 GB, memoria di sistema
all'85%. Si lega alla voce 6: ogni finestra oggi è una sessione intera.

---

## 8. P1 — LO SPLIT DEL GRAFICO (progetto a sé)

«Quando abbiamo una finestra a tutto schermo possiamo utilizzare **lo split orizzontale o verticale
del grafico**: due grafici diversi, oppure anche lo stesso asset, nella stessa finestra e nella
stessa pagina, per perlustrare due grafici in contemporanea su due livelli diversi. Quando si
esegue lo split si può scegliere se metterlo orizzontale o verticale, **tramite un pulsante
dedicato**. Vale sia per la pagina madre che per le pagine duplicate.»

**E il replay deve valere anche lì:** «con lo stesso tasto replay, oltre che sulle pagine duplicate,
la funzione replay viene fatta anche sulle pagine split. Esempio: da una parte XAUUSD, dall'altra
DXY. Premendo replay si torna indietro nel tempo e si fa backtest su entrambi gli asset, e premendo
play l'avanzamento parte su tutte le pagine duplicate e su tutte le split.»

Da decidere prima di scrivere codice: **quanto pesa**. Lo split raddoppia i grafici proprio mentre
la voce 7 dice che già così è troppo. Va fatto dopo la voce 6, non prima.

---

## 9. P1 — IL PANNELLO A SCHERMO INTERO

«Nel pannellino quando siamo in pagina a tutto schermo, quello che indica P/L live, capitale, win
rate, loss rate, margine libero: **prima cosa togliamo win rate e loss rate, non ci servono**.
Seconda cosa: quando apriamo una posizione o la selezioniamo tramite i target, lo stop loss o la
freccetta della posizione, **ci deve comparire quella posizione dentro quel riquadro sotto, così
che avremo i pulsanti BE e Chiudi**. Così non dobbiamo uscire dallo schermo intero e andare sotto
alle posizioni aperte per chiuderla: ce l'abbiamo lì e la chiudiamo direttamente.»

---

## 10. P1 — SPOSTARE LA LINEA DI ENTRATA DI UN ORDINE LIMITE

«Quando c'è un ordine limite devo avere la possibilità di spostarlo, **anche se l'ordine pendente
viene creato da una sala segnali**: posso spostare la linea di entrata del buy limit e del sell
limit.»

CAUSA GIÀ TROVATA (`tradeLevelHit`): la linea di entrata si aggancia **solo nei primi 160 pixel** a
sinistra, stop e target solo negli ultimi 140 a destra. Su un grafico da 1.300 px restano oltre 900
px in mezzo in cui nessuna linea risponde, pur essendo disegnate per tutta la larghezza.

---

## 11. P1 — COPIARE LE IMPOSTAZIONI DA UN ALTRO CONTO

«Quando si aggiunge un conto nuovo viene tutto formattato in maniera standard. Possiamo avere la
possibilità di selezionare **copia impostazioni dal conto X**, così ci copia tutte le impostazioni
di quel conto che abbiamo già aggiunto in precedenza.» Alla domanda su cosa copiare: **«Voglio che
mi copi tutto praticamente»**.

ATTENZIONE, e va detto a voce prima di farlo: «tutto» non può includere **login, server, chiave,
storico operazioni, capitale e stato della challenge**, che identificano il conto e non sono
preferenze. Copiarli farebbe sembrare un conto un altro — ed è esattamente la famiglia di guai
della voce 1. Si copia tutto ciò che è PREFERENZA; si chiede conferma per l'interruttore
dell'apertura automatica, che è l'unica preferenza che può costare un conto.

---

## 12. P0 — IN UNA DUPLICATA, LA POSIZIONE APERTA IN REPLAY SPARISCE. E IL REPLAY DEVE POTER VALERE SU TUTTE LE FINESTRE (O SU UNA SOLA)

**Parole sue (12 novembre 2026, tarda sera):** «attenzione, sulle pagine duplicate, se vado ad
aprire una posizione in modalità replay con backtest attivo non me la fa visualizzare e sparisce,
e non viene presa in considerazione quando ho più pagine duplicate. Anche perché nella pagina
madre e nell'altra pagina duplicata ho il conto di MT5 collegato e non lo storico, quindi non so
se va in conflitto per questo.»

E la richiesta che ne fa derivare:

«Facciamo che quando clicchiamo il tasto replay e ci sono pagine duplicate, venga chiesto
all'utente tramite un popup se vuoi attivare la modalità replay con backtest **anche su tutte le
altre finestre**, oppure se lo vuoi fare **solo sulla finestra dove hai attivato il replay**, così
le altre finestre lavorano per conto loro, separate da quella finestra in modalità replay. Poi
quando si esce dalla modalità replay si **riallinea alle altre finestre e al conto in automatico**,
anche perché deve stare sotto in background. Quindi la pagina singola in modalità replay sarà
associata al **conto storico**, le altre invece al **conto con cui sono collegate**, e non deve
esserci contraddizione né confusione né bug né nulla: deve funzionare tutto correttamente e
lineare.»

### IL MODELLO CHE NE ESCE, ed è la cosa più importante di questa voce

Ogni finestra ha **la sua modalità** e **il suo conto**, e sono legati:

| Finestra | Modalità | Conto |
|---|---|---|
| in replay/backtest | Storico | **conto storico** |
| tutte le altre | Live | il conto MT5 con cui sono collegate |

Due conseguenze da rispettare in tutto il resto del lavoro:
- **Il progetto «duplicate come specchio» (voce 6) non può imporre la modalità della madre alle
  figlie.** Lo specchio vale per i DATI (candele, storico, prezzi, ascolti cloud: una sola fonte,
  la madre). La MODALITÀ no: una figlia in replay deve poter guardare lo storico mentre la madre
  è in Live. Senza questo paletto scritto, lo specchio romperebbe proprio questa richiesta.
- **All'uscita dal replay il riallineamento è automatico**, non va chiesto: la finestra torna al
  conto delle altre da sola, perché «deve stare sotto in background».

### CAUSA SOSPETTATA (misurata su una strada vicina, NON ancora su questa)

Il sospetto numero uno è `fblApplicaStatoTrading` (`app.html`, intorno a 53486-53512), la funzione
che applica a una finestra lo stato di trading arrivato da un'altra. È già stata misurata il 12
novembre dall'agente che ha indagato lo storico di altri conti, e il referto dice: la guardia
`_stessoContoMt5` copre `positions`, `pendingOrders` e `trades`, ma **le tre righe dopo stanno
fuori dalla guardia** — `equity`, la sessione Live parcheggiata e `statsBaselineByMode`. Misurato
in quell'indagine: `statsBaselineByMode.live` passava da 0 a 7, cioè si sposta la linea da cui si
contano capitale e statistiche, e sette operazioni sparivano dalle statistiche **in silenzio**.

Se la madre è in Live su MT5 e la figlia apre una posizione in Storico/backtest, le due hanno
conto e modalità diversi: una copia di stato che non distingue la modalità sovrascrive alla figlia
proprio quello che ha appena creato. È coerente con «non me la fa visualizzare e sparisce».

**Da misurare prima di curare**, perché resta un sospetto: due finestre vere (madre con `?pipSlot=0`
in Live, figlia con `?pipSlot=2` in Storico+backtest), aprire una posizione nella figlia, contare
quante posizioni restano nella figlia dopo che arriva il primo messaggio dalla madre. Il banco deve
contare anche i MESSAGGI scambiati: il 12 novembre un difetto delle duplicate era una tempesta di
messaggi, e la cura ingenua («mando tutto a tutti») peggiora invece di migliorare.

### CAUSA CONFERMATA LEGGENDO IL CODICE (12 novembre, poco dopo): il meccanismo è a due stadi

`fblApplicaStatoTrading` non guarda MAI la **modalità** di chi riceve: la sua unica guardia
(`_stessoContoMt5`) confronta i CONTI MT5. E prima di confrontarli fa questo:

    if(!_mt5Locale.mt5Login && _mt5Remoto.login && typeof mt5AttivaConto==='function'){
      try{ mt5AttivaConto(_mt5Remoto.login,_mt5Remoto.server); ... }catch(eL){}
    }

cioè: **se la finestra non sa su che conto è, ADOTTA il conto dichiarato nel messaggio.** Una
duplicata in Storico/backtest non ha un conto MT5 — non le serve, sta guardando lo storico.
Quindi la sequenza è:

1. la figlia è in Storico+backtest, apre una posizione simulata (nessun ticket MT5);
2. arriva il messaggio della madre, che è in Live sul conto MT5;
3. la figlia non ha un conto locale → **adotta quello della madre**;
4. adottato il conto, `_stessoContoMt5` diventa **vero**;
5. e allora: `positions = msg.positions`, `pendingOrders = msg.pendingOrders`,
   `trades = msg.trades` — **l'intero array sostituito**. La posizione aperta nel backtest non
   c'è più.

Il commento accanto a `_timbra` dice «si tocca SOLO chi ha un ticket MT5, così le posizioni
simulate del replay restano intatte»: vale per la TIMBRATURA, non per la sostituzione dell'array.
Le posizioni simulate non sono protette da niente.

La cura, di conseguenza, è su due punti e non uno:
- **una finestra in Storico/replay non adotta il conto MT5 di nessuno**: in quella modalità il
  conto è quello storico, e adottarne un altro è il primo anello della catena;
- **la guardia deve confrontare anche la MODALITÀ**: modalità diversa = mondi diversi, non si
  copia niente (posizioni, ordini, operazioni **ed `equity`, che oggi sta fuori da ogni guardia**).

Resta da MISURARE con il banco a due finestre descritto sopra, prima di toccare il codice: questa
funzione è attraversata da ogni sincronizzazione fra finestre, e una guardia in più va provata
anche nel verso opposto (due finestre nella STESSA modalità e sullo STESSO conto devono continuare
a sincronizzarsi come prima).

---

## 13. LA DOMANDA DELLA PROP FIRM: UNA VOLTA SOLA PER CONTO, E MAI MENTRE ARRIVA UN SEGNALE

**Deciso dal proprietario il 12 novembre 2026, rispondendo a una mia domanda sul cambio conto
automatico:** «il suono mi sta bene, ma il fatto che mi chieda se è una prop firm o meno non me lo
deve chiedere ogni volta, solo la prima volta che mi collego a quel conto, fine. E quando arriva
un segnale, certo che non deve apparire la domanda, assolutamente.»

Tre regole, e la terza è quella che non c'era:

1. **Il suono del collegamento resta** anche sul cambio conto automatico. Non va silenziato.
2. **La domanda si fa una volta per conto, per sempre.** È ciò per cui esiste `propChiesto`. Che
   ricompaia non è un difetto della domanda: è un difetto dell'IDENTITÀ del conto (la causa 2
   della voce 3 — lo stesso conto con due chiavi diverse secondo come si è saputo il nome del
   server) e della causa 1, già curata nella 2.2.37 (una violazione cancellava il record). Questa
   decisione conferma che la cura dell'identità è la cura vera di questo fastidio.
3. **Mentre arriva un segnale la domanda non compare, nemmeno la prima volta.** Oggi il cambio
   conto automatico passa da `updateMt5ModeUI()` senza `silenzioso`, quindi fa il rito del «mi
   sono appena collegato» — e la domanda è uno dei tre riti. È il momento peggiore: non c'è
   nessuno davanti allo schermo, e il proprietario ha detto più volte che è lì che si fanno
   scelte sbagliate in fretta.

**ATTENZIONE, la trappola di questa cura:** saltando la domanda NON si deve segnare `propChiesto`.
Se si segnasse, il conto resterebbe per sempre «già dichiarato» senza che nessuno abbia dichiarato
niente — e un conto prop firm verrebbe trattato come un conto normale, che è la famiglia di guai
della voce 1. La domanda va messa IN SOSPESO e fatta al primo momento in cui l'utente c'è davvero
(la prossima volta che apre il pannello del conto o l'app).
