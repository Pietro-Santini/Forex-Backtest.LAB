# Scaletta — cosa manca da fare

Aggiornata il **21 ottobre 2026** (v2.0.13). Ordine: prima quello che **fa perdere soldi o fa
fallire un'operazione**, poi quello che **era funzionante e non lo è più**, poi il **telefono
inusabile**, poi la **sincronizzazione**, poi le **funzioni nuove**.

Prima di toccare qualcosa: `cervello/PASSAGGIO-OPENCODE.md` e `cervello/LEZIONI.md`.

**COME SI COMMITTA** (deciso dal proprietario il 21 ottobre): si committa **a capitolo chiuso**,
non a ogni modifica — «altrimenti troppi commit e aggiornamenti facciamo». Si lavora sul ramo con
il collaudo verde a ogni passo, e si pubblica una volta sola per capitolo.

---

## 1. Capitolo 2 — soldi e operazioni (quasi chiuso)

### 1.1 Kraken: la data di apertura delle posizioni cripto

**Correzione importante alla premessa.** All'inizio era stata segnalata come «le aperture cripto
falliscono», e la scaletta elencava i quattro motivi per cui il ponte può rifiutare. Il
proprietario ha poi chiarito (21 ottobre): «in realtà le posizioni le apre tranquillamente, è solo
il discorso della data di apertura che va risolto». Le quattro cause di rifiuto non c'entravano.

**Il sintomo vero** è quello già segnalato il 16 ottobre: «ho aperto una posizione su Kraken alle
ore 22, sono andato a riaprire il grafico e la posizione me l'ha messa alle 19.20».

**Misurato il 21 ottobre, e nel codice di oggi la catena è intera:**

```
simulatore   "aperta" (ms)  ->  _iso_apertura()  ->  "fillTime" (ISO, il nome di Kraken vero)
ponte        _ms_iso()      ->  "aperta_ms"
app          krakenOrarioApertoMs() lo preferisce a tutto: è un fatto
```

Verificato anche che il ponte **installato** sul PC del proprietario è del 21 ottobre, quindi
contiene la correzione (arrivata con la v152). Quando `aperta_ms` manca, l'app ripiega
sull'anagrafica — cioè su **quando ha visto** la posizione la prima volta: ed è esattamente così
che una posizione aperta alle 22 finisce alle 19:20. Non è un orario sbagliato, è l'orario di un
altro evento.

**Quindi: le posizioni aperte da ora devono avere l'orario giusto.** Quelle aperte PRIMA della
v152 non ce l'hanno e non possono recuperarlo: per loro c'è la cella «Eseguita», che si clicca e
si dichiara l'orario a mano (v167).

Test aggiunti: `laboratorio/ponte/test_kraken_orario_apertura.py` (4) — l'orario arriva fino in
fondo, non cambia quando si aggiunge alla stessa posizione, riparte se la posizione si capovolge,
e una posizione vecchia senza orario risponde «non lo so» invece di inventarne uno.

**Da verificare sul vivo:** aprire una posizione cripto e guardare la colonna «Eseguita». Se
mostra ancora «—», c'è un caso vero da misurare e i test sono già pronti a dire dove si rompe.

### Fatto nel capitolo 2
- clic su TP/SL nella tabella Kraken che cambiava il prezzo → tolto (si trascina dal grafico);
- **una conferma sola** per chiusura multipla e «CHIUDI TUTTE»;
- **operazioni a blocco su Kraken** (chiudi tutte / in guadagno / in perdita / per lato / per
  contratto, più stop a pareggio su tutte);
- **il conto segue l'asset**: cripto → Kraken, forex/indici/azioni/oro → MT5, anche da «vai a
  grafico» (dove però il conto della POSIZIONE vince sempre).

### 1.2 Il pareggio è zero — chiuso il 21 ottobre, dopo un errore mio

Segnalato dal proprietario: «il programma sposta le posizioni a break-even, ma perdono ugualmente
meno 2 euro». La causa era una mia correzione della stessa mattina: per difendere lo stop dal
cambio giornata avevo aggiunto al pareggio **un margine pari allo spread**. Un pulsante che si
chiama «pareggio» e lascia meno due euro non è una protezione con un piccolo costo: è un'etichetta
che mente.

**Com'è adesso:** il prezzo di pareggio è di nuovo **esatto** (netto 0,00, commissioni di andata e
ritorno e swap compresi, arrotondamento al tick sempre a favore di chi ha la posizione), e la
difesa dal rollover si è spostata dove non costa niente — chi piazza lo stop **si rifiuta** quando
quello stop cadrebbe dentro la forbice fra compra e vendi, e lo dice. Così lo stop che c'era prima,
che è **più lontano**, resta a fare il suo lavoro.

Il rifiuto è su **tutte e quattro** le strade del pareggio: pulsante della tabella (da cui passa
anche il BE di gruppo), pulsante BE della tabella «Posizioni MT5» (che legge il preventivo vero,
bid/ask), strategia della sala all'avvicinamento al primo target, regola «stop all'entrata». Nelle
due automatiche il rifiuto è silenzioso e si riprova da solo al giro dopo.

**Limite dichiarato, su Kraken:** lì lo stop a pareggio va sul prezzo d'entrata e basta, perché la
commissione dello scambio non arriva all'app posizione per posizione. Scritto nella conferma invece
di stimarlo.

---

## 2. Capitolo 3 — funzioni che c'erano e non vanno più

### 2.1 Syntra: il robot non scansiona più ⭐⭐
**Quattro cose insieme:** (1) non esegue più la scansione; (2) chiede di selezionare la cartella
Syntra ma non la fa selezionare (`syntraFolderPick`); (3) mostra la **porta** Syntra, che
all'utente non deve risalire; (4) non mostra più i **nomi utente** Syntra già inseriti.
**Resta aperto anche il difetto di prima:** la cronologia si ferma alla prima operazione; deve
scorrere, espandere, leggere, controllare la data e ripetere fino al periodo scelto; e per tornare
a cercare nuovi ordini deve **ripremere «setup» in basso a sinistra** (dalla classifica non basta).
→ `installer_build/build/segnali_telegram/syntra_lettore.py`. ⚠️ **Richiede di ricostruire e
reinstallare il ponte.**

### 2.2 Caricamento del grafico al cambio asset ⭐
«Non deve mai visualizzarsi il nome dell'asset se prima ancora non è stato caricato il grafico, la
rotellina continuerà a girare fin quando non è avvenuta l'esatta sincronizzazione.» Più la
**percentuale** di caricamento, e il popup che compare **nella finestra PIP** quando il grafico è
staccato.

### 2.3 Freeze e scatti dopo gli aggiornamenti
Da **misurare**, non da indovinare: profilo del browser su scorrimento pagina, grafico e replay, e
conteggio delle richieste di rete in quei momenti. Il proprietario sospetta la connettività — e il
21 ottobre il suo PC ha davvero perso la rete di colpo (ping al router 100% perso), quindi il
sospetto ha una base.

### 2.4 Footprint in replay
Mai affrontato. Il motore del replay è stato riscritto il 19 ottobre: va verificato **se il difetto
c'è ancora** prima di rimetterci mano.

---

## 3. Capitolo 4 - il telefono (CHIUSO il 21 ottobre 2026)

Tutti e sei i punti fatti, e **misurati**: un banco apre i 24 popup in quattro condizioni
(375x812, 320x568, orizzontale, e 375x812 con l'interfaccia al 130%) e misura di quanto il
riquadro esce dallo schermo e di quanto il contenuto esce dal riquadro.

- **i pulsanti dentro il grafico si sovrapponevano** -> `qtAutoLayout` si scansava da due gruppi
  su sei, e sotto c'erano tre numeri scritti a mano (`top:46px` per la seconda riga, `top:86px`
  per la legenda, l'elenco fisso dei gruppi). Ora e' una pila calcolata dall'alto;
- **la barra per aprire posizioni al bordo alto** -> fatta. La barra e' 360 px e il grafico su un
  telefono ne ha 309: **scelta del proprietario** fra tre possibilita', «barra in cima e pulsanti
  ridotti a icone su una riga sola». Per far stare i sei comandi in 293 px, «DATA RANDOM» perde
  la scritta e resta l'icona (388 px -> 275);
- **i popup oltre il bordo dello schermo** -> era la SCALA: a 100% non sforava nessuno, al 130%
  sforavano di 117 px sotto e 73 di lato, e i peggiori erano le due finestre delle strategie.
  `max-height:88vh` viene moltiplicato dallo zoom del body dopo il calcolo; ora la scala si
  dichiara al CSS (`--fblZoom`) e i limiti ci dividono. **Zero sfori in tutte e quattro le
  condizioni**;
- **il testo fuori dal popup** -> la striscia delle schede sforava di 109 px e quelle oltre il
  bordo erano **irraggiungibili** (ora vanno a capo); la voce «Collegamento/Modalita'» sforava di
  43 px (ora va a capo). Restano tre popup dove una **tabella** e' piu' larga dello spazio su uno
  schermo da 320 px: ora scorre dentro il popup invece di spingerlo fuori dallo schermo;
- **popup adattati al contenuto** -> sul telefono usano il 96% dell'altezza invece dell'88%
  (quasi cento pixel di schermo che restavano vuoti);
- **la linea apertura<->chiusura con lo zoom largo** -> si disegnava solo se un'estremita' era a
  schermo; ora il segmento si taglia sul riquadro e si disegna il pezzo visibile. Erano **quattro**
  i punti con lo stesso difetto;
- **via i cartellini TP/SL dalla scala prezzi** -> fatto, resta quello dell'entrata. Target e stop
  restano sulle linee e nella casella Target/Stop.

Test: `popup_bordi` (5), `grafico_pulsanti_telefono` (7), `linea_apertura_chiusura` (3),
`scala_prezzi_cartellini` (2), piu' `replay_posizioni` spostato sulla casella Target/Stop.

---

## 4. Capitolo 5 — sincronizzazione e credenziali

### 4.1 Fatto
Le impostazioni seguono l'account: footprint (stile e righe), profili indicatori, decimali per
asset, strategie delle sale, nomi e target delle sale, periodi della dashboard — oltre a watchlist,
ricerche e scala che già viaggiavano. **I segreti no**, ed è garantito da un test.

### 4.2 Le credenziali e la cartella (FATTO il 21 ottobre 2026)

**Non venivano cancellate.** Il CSV e' sempre rimasto dove l'utente l'ha messo: a ogni riavvio del
browser si perde il PERMESSO di leggere quella cartella, e senza permesso l'elenco dei conti e'
vuoto - che da fuori si legge come «cancellate». In piu' `getMt5CredsDirHandle` tornava `null` in
silenzio mentre quello di Capital.com mostrava gia' il banner: l'asimmetria toglieva la
spiegazione nel caso piu' frequente.

Adesso, nella scheda Live: lo **stato vero** delle due cartelle (collegata / da riconfermare / non
ancora scelta), un pulsante **Ricollega la cartella** che compare solo quando serve e che
riconferma il permesso **e rilegge i conti**, e la **nota**: le credenziali stanno in un CSV sul
dispositivo, non passano mai dal server e non vengono sincronizzate sull'account.
Test: `cartella_credenziali.test.mjs` (5).

### 4.2b Com'era (per capire il perche')
Le credenziali stanno in una **cartella scelta dall'utente**, e il riferimento a quella cartella
perde il permesso quando l'app si riavvia. Il meccanismo per riconcederlo esiste
(`fblChiediPermessoFile` / `unlockFilesBanner`) ma non è evidente: l'app sembra semplicemente
vuota. Serve un pulsante chiaro nei pannelli Capital.com e MT5, con scritto che **le credenziali
restano sul dispositivo e non passano mai dal server**.

### 4.3 Da sapere: tre porte d'ingresso, tre magazzini
L'app si apre dal sito (`github.io`), dal servizio locale (`127.0.0.1:8000`, lo serve `bridge.py`)
e dall'APK (`localhost`). Il browser tiene i dati **separati per indirizzo**: chi cambia porta
d'ingresso trova tutto vuoto senza aver perso niente. La sincronizzazione sopra è la cura che
funziona comunque; ridurre le porte d'ingresso a una sarebbe la cura alla radice.

---

## 5. Capitolo 6 — funzioni nuove

- **TP/SL della barra agganciati alla posizione selezionata**; deselezionando tornano a configurare
  una nuova apertura; clic nel vuoto → si annulla (TP/SL a 0, preview via). Anche su Kraken.
- **Ordini pendenti**: spostare entrata, TP e SL di un ordine **già piazzato** (oggi si trascina
  solo la bozza prima di piazzarlo).
- **Ordini pendenti nella strategia** di sala e universale, con due **freni**: cancella se non
  scatta entro X tempo; cancella se il prezzo supera N TP. Riportato anche nella cronologia sale.
- **Riordino delle schede** di Collegamento/Modalità: Live/Storico, MT5, **Kraken**, Prop Firm,
  Notion, **Sala segnali**, **Collegamento** (con dentro: casella Telegram e sala in ascolto,
  Ricontrolla, accesso altri dispositivi/Oracle, collegamento Telegram, esci/dimentica numero e il
  percorso del nuovo utente). La **porta del ponte** deve sparire dalla vista.
  ⚠️ Già tentato una volta e lasciato a metà: schede senza pannello, pannelli duplicati,
  `liveModeSwitch` tolto dall'HTML ma ancora agganciato — l'app andava in errore al caricamento e
  si perdevano 49 ascoltatori (menù MT5 e Prop Firm compresi). Il controllo di sintassi **non se ne
  accorge**: il collaudo deve aprire il popup e cliccare ogni scheda.
- **Aggiornamento «classico» su Windows**: chiudere i processi, installare, togliere il pacchetto
  vecchio (sul mobile il giro è già sistemato).
- **Multi-selezione dei conti** nella dashboard statistiche.
- **Cancellazione di un conto** che purga tutto, con avviso che si perdono le statistiche.
- **Pulsante «Chiudi» a grafico** con chiusura a mercato o parziale a percentuale scelta.

---

## 6. Rinviate dal proprietario — non farle se non le richiede
- **Discord**: notifica dei commit, canale idee con sondaggio.
- **iOS**: l'app per Android e Windows c'è; iOS è ancora da completare.
- **Spread sull'ENTRATA degli acquisti in simulazione**: oggi si modella solo sull'uscita delle
  vendite. Chiuderlo sposta l'entrata di tutti i backtest passati: è una decisione, non una
  correzione.

---

## 7. Promemoria che valgono per ogni punto
- **Si misura prima di correggere**, e più volte la causa non era dove si guardava.
- **Ogni correzione ha un test**, e il test guarda il **comportamento**.
- **Conta il collaudo di GitHub**, e il verde si prende **sul ramo** prima di toccare `main`.
- Modifiche fuori da `app.html` (ponte, installer) → **ricostruire il Setup** e avvisare.
- Un collaudo **non deve toccare niente fuori da sé**: il 21 ottobre apriva WebSocket veri verso il
  ponte del proprietario e gli interrompeva il collegamento MT5 mentre operava.
- Italiano ovunque; niente identificativi di modello; nessuna chiave API nel repo; soldi veri mai.
