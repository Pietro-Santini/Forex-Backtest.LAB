# Lista completa delle richieste del proprietario (aggiornata l'8 novembre 2026)

Ordine di lavoro dall'alto verso il basso. Ogni voce: **misurare → curare → test → pubblicare**.
Lo stato dice dove siamo.

## A. In corso / appena fatto

### A1. Aggiornamento in UN CLICK SOLO — CURATO (v2.1.8)
«Premo aggiorna, non mi installa i pacchetti: aggiorna solo app.html; al SECONDO click installa
e riavvia.» Causa: il ripiego del piano concludeva «basta ricaricare la pagina» perché il ponte
serviva la copia aggiornata di `app.html` — cioè nel caso normale. Ora il ripiego non può mai
escludere il pacchetto, e il piano si ricalcola appena il ponte risponde invece di restare sulla
decisione presa quand'era muto. — **VERDE, da provare sul PC con UN click.**

### A2. Indicatori che si allungano nel futuro — CURATO (v2.1.8)
«Gli indicatori continuano a scorrere il tempo e non si fermano all'ultima candela prima della
chiusura.» Causa: l'offset di disegno dell'EMA spingeva il punto finale della linea oltre
l'ultima candela vera, e a mercato chiuso quello spazio è vuoto. Ora il punto finale non supera
mai `idx`. — **VERDE.**

### A3. Finestra duplicata che apre un secondo accesso a MT5 — CURATO
«Quando apro la pagina duplicata è come se mi eseguisse l'accesso automatico a MT5, perché sento
il suono.» Era il warm-start che avevo aggiunto io: chiamava `connectToMt5Bridge` con le
credenziali della madre — secondo accesso, stesso conto, stessa macchina. Ora eredita lo stato.
— **VERDE.**

### A4. F5 / Ctrl+R / Ctrl+Shift+R — CURATO (v2.1.5)
«È un'applicazione, non un sito: quei tasti non devono fare nulla.» Ora bloccati (dove si scrive
restano liberi). — **VERDE.**

### A5. Firebase a mercato chiuso — PRIMA CURA (v2.1.7)
La rete di sicurezza rileggeva l'intero documento dal cloud ogni 60 secondi. A mercato chiuso
ora si allenta a mezz'ora. — **RESTA la cura completa (voce E2).**

### A6. Aggiornamento: mostrare quale versione gira DAVVERO — fatto
Il pannello Versione dice la versione in esecuzione (letta dalla pagina stessa) oltre a quella
installata, e avvisa se è più vecchia di quella pubblicata. — **VERDE** (serve per non ripetere
il pomeriggio in cui una cura pubblicata non si vedeva).

## B. Regressioni mie da correggere SUBITO (prossime)

### B1. Click sul grafico che porta in una «zona morta» senza dati — DA FARE (prossimo)
«Se clicco sul grafico all'apertura mi porta tutto avanti in una zona non esistente dove non
c'è nessun dato; anche quando clicco "torna all'ultima candela" e poi clicco dentro al grafico
lui si sposta automaticamente più avanti nella zona morta, in modo del tutto casuale.»
Ipotesi da misurare: il click esce dall'auto-segui (`followLatest=false`) e poi qualcosa —
anticipo, snap-to-candela, o la cura del congelamento che cambia la finestra — sposta la vista
oltrel'ultima candela. Misura: dove cade `start`/`end` dopo un click, con e senza «torna
all'ultima candela».

### B2. Linee entry/TP/SL degli ordini pendenti non si vedono a mercato chiuso — DA FARE
«Non si vedono più le linee entry/tp/sl degli ordini pendenti, né in replay né in tempo reale,
quando il mercato è chiuso.» Ipotesi: la finestra congelata le spinge oltre il bordo destro.
Le linee di un ordine pendente sono informazione, non carico: devono vedersi sempre.

### B3. Elenco asset e watchlist nella finestra duplicata — DA FARE
Madre: 35 asset e stelline piene. Duplicata: 5 asset e stelline vuote. Causa: la finestra PIP
nasce vuota e non eredita l'elenco. Cura: far viaggiare l'elenco e la watchlist sul canale che
esiste già (`pip_clone_snapshot`).

## C. Finestre duplicate — le 9 voci (dopo B)

1. Sfarfallio delle posizioni aperte nella duplicata (TP, SL, entry, P/L live, prezzo attuale).
2. Schermo intero sulla pagina madre bloccato con duplicate aperte.
3. Scroll indesiderato nella duplicata (deve esserci solo il grafico, barra ancorata a sinistra).
4. ~~Elenco asset / watchlist~~ → spostato in B3.
5. Collegamento tra le sessioni (il conto selezionato deve propagarsi: MT5 ↔ CSV ↔ Kraken).
6. Replay sincronizzato: chiedere se applicarlo alle duplicate, e trasportare le posizioni replay.
7. Disegni sincronizzati: un disegno su una pagina deve comparire sulle altre.
8. Modello sulla barra strumenti: selezionando un disegno salvato, il click lo traccia con le
   priorità salvate (da verificare se già funziona).
9. Prestazioni: chiusure lente (TP/mercato) e duplicate che rallentano tutto.

## D. R1 → R2 → R3 (server, dopo C)

- **R1** — percorsi Caddy per segnali/Kraken sul dominio (oggi il dominio espone solo `/dati`).
- **R2** — tunnel inverso dal PC al server (raggiungere il PC senza Tailscale).
- **R3** — togliere i riferimenti a ts.net.

## E. Da chiudere alla fine, come richiesto

### E1. Disco E — la cartella dati resta vuota
`E:\Forex Backtest Lab\dati` esiste ma è vuota. Da verificare sul PC: lo stato del toggle «tieni
i dati sul mio computer» (se spento, i documenti vanno su Firebase ed è atteso), le chiamate
`/dati` con token in `bridge.log`, e che la cartella sia scrivibile.

### E2. Firebase — troppe scritture e letture, e fattura troppo
«Non deve sforare e c'è qualcosa che gli fa calcolare dai in continuo senza volerlo.»
Numeri: oggi 3,1K scritture e 6,4K letture (15% e 13% della quota gratuita); prima 57K scritture
e 114K letture — cioè 18 e 2,3 volte oltre il limite. Resta da misurare CHI scrive (3,1K
scritture al giorno non vengono da una rilettura).

## F. Regole che valgono per tutto
- Si misura prima di correggere: ogni cura ha un test che misura il **comportamento**, non il
  testo del sorgente, e va provato nei due versi (rosso senza / verde con).
- Italiano ovunque (codice, commenti, commit).
- Nessun identificativo di modello, nessuna chiave nel repository.
- GitHub è la verità: si pubblica a collaudo verde e l'aggiornamento arriva dal pulsante, non da
  F5. Ogni modifica pubblicabile = versione successiva.
