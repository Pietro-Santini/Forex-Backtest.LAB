# Scaletta — cosa manca da fare

Aggiornata il **20 ottobre 2026**, dopo le richieste del proprietario e l'allineamento al
repository (v2.0.10 pubblicata, collaudo GitHub verde).

Ordine: prima quello che **fa perdere soldi o fa fallire un'operazione**, poi quello che **era
funzionante e non lo è più**, poi il **telefono inusabile**, poi la **sincronizzazione**, poi le
**funzioni nuove**.

Prima di toccare qualcosa: `cervello/PASSAGGIO-OPENCODE.md` (dove sta il progetto, come si lavora)
e `cervello/LEZIONI.md` (gli errori già pagati).

---

## 0. Stato al 20 ottobre 2026

| | |
|---|---|
| Versione pubblicata | **2.0.10** (`sw.js` + `installer.iss` allineati) |
| Ramo | `main`, ultimo commit `7a037fc` |
| Collaudo GitHub | **verde** (Collaudo + Installer Windows), 629/629 in locale |
| Specchio sul Desktop | **fermo alla v166** — da riallineare |

⚠️ **`API Github.txt` sta nella cartella del repo, non tracciato e NON in `.gitignore`.** Al primo
`git add -A` finirebbe dentro. Va aggiunta la riga `API Github.txt` a `.gitignore` (i ganci di
sicurezza non girano in tutte le sessioni: va controllato a mano cosa entra in git).

---

## 1. Già corretto — DA PROVARE SUL DISPOSITIVO, non da rifare

Tre difetti segnalati dal proprietario sono stati corretti fra la 2.0.8 e la 2.0.10. Vanno
**provati sul telefono/tablet con la 2.0.10 installata** prima di rimetterci mano.

### 1.1 Login Google nell'APK: errore 400 e verifica in due passaggi che non finisce

Corretto in **v2.0.9** e **v2.0.10**. Due cause misurate, entrambe diverse da quelle ipotizzate:

- il popup di Firebase è una **finestra nuova** (`window.open`) e la WebView dell'APK non la crea:
  Google si apriva al posto dell'app, Firebase restava senza `opener` e rispondeva **400**. Ora
  nell'APK (e sul telefono nel browser) si usa il **reindirizzamento a pagina intera**;
- la credenziale **arrivava e nessuno la leggeva**: al ritorno
  (`https://localhost/login.html#...token...`) la WebView cambia **solo il frammento** senza
  ricaricare, e il risultato era già stato letto e svuotato — di qui la rotellina che girava per
  sempre. Ora si rilegge su `hashchange`, `pageshow` e `visibilitychange`, la bandierina scade dopo
  **un'ora** (l'approvazione su un altro dispositivo può richiedere venti minuti) e due letture
  sovrapposte non si annullano.

Test: `login_google_flusso.test.mjs` (8), `login_google_esito.test.mjs` (6),
`login_stato_google.test.mjs` (13).

**Se dopo la prova sulla 2.0.10 ancora non va**, allora si prende la strada del **login nativo**
(`@codetrix-studio/capacitor-google-auth`). Serve il proprietario: `google-services.json` dal
pannello Firebase e l'impronta **SHA-1 `64d6f827dd7db6be65b53a5972c80c8436437e31`** da registrare
sul progetto. Da non fare prima della prova: è un pezzo nativo in più da mantenere.

### 1.2 L'APK non riceveva il pacchetto di aggiornamento

Corretto in **v2.0.8** (dentro la WebView un link con `download` non scarica niente: ora
l'indirizzo si apre come navigazione e Android chiede se installare) e in **v2.0.10** (l'APK
pubblicato conteneva un `sw.js` con il numero di versione vecchio, quindi il pulsante «Aggiorna»
restava acceso per sempre; ora c'è `apk_versione.test.mjs` che confronta i due numeri sul pacchetto
davvero costruito).

### 1.3 La scala dell'interfaccia scende fino al 10%

Corretto in **v2.0.10**: il tetto minimo passa dal 70% al **10%**, e anche il testo disegnato sul
grafico scende fino al 10% (prima si fermava al 50%). Test: `scala_ui.test.mjs` (17).

---

## 2. Priorità 1 — soldi e operazioni che falliscono

### 2.1 Kraken: le aperture delle posizioni cripto falliscono ⭐

**Riferito:** «attenzione con la sincronizzazione corretta della apertura delle posizioni kraken
per le crypto, falliscono». E: **deve sparire la configurazione manuale** dell'apertura di una
posizione cripto.

Da misurare per prima cosa *quale* passo fallisce (richiesta al ponte, scostamento, margine,
lottaggio) prima di correggere: è il punto che muove ordini.

### 2.2 Kraken: il clic sul TP/SL in tabella cambia il prezzo — non deve

**Riferito:** «nelle posizioni kraken ora è in funzione che se clicco sulla tabella delle
operazioni sul tp-sl mi fa cambiare il valore del prezzo, invece no, non deve farlo».

Il TP/SL si sposta **dal grafico** (v165), non per un clic in tabella: un clic involontario su una
cella non può modificare un ordine vero.

### 2.3 Chiusura di più posizioni: una sola conferma, non una per posizione

**Riferito:** «se clicca chiudi x posizioni gli viene fuori soltanto un messaggio di conferma per
la chiusura di tutte», e lo stesso per le **operazioni in blocco**.

Oggi la conferma si ripete per ogni posizione: con dieci posizioni sono dieci popup, e un «sì» di
troppo chiude quello che non si voleva.

### 2.4 Cambio conto automatico per tipo di asset ⭐

**Riferito:** forex, indici e azioni → conto **MT5**; cripto → conto **Kraken**. «questo deve
avvenire pure con i pulsanti vai al grafico delle posizioni aperte».

Misurato: `fblVaiAlContoDi()` **esiste già** ed è richiamata solo da due punti (il salto a grafico
da una posizione, `app.html:19907` e `:20036`). Manca l'aggancio al **cambio asset**.
`fblTipoAsset()` riconosce già le cinque famiglie.

### 2.5 Operazioni in blocco anche per le posizioni Kraken

**Riferito:** «dobbiamo inserire il pulsante operazioni a blocco anche per le posizioni kraken».

Oggi il blocco esiste per il Journal (`journalBulkDeleteBtn`) e per le posizioni dell'app, non per
Kraken.

---

## 3. Priorità 2 — funzioni che c'erano e non funzionano più

### 3.1 Syntra: il robot non scansiona più ⭐⭐

**Riferito, quattro cose insieme:**

1. il robot **non esegue più la scansione**;
2. chiede di **selezionare la cartella Syntra** ma non la fa selezionare (`syntraFolderPick`,
   `app.html:1883`);
3. **mostra la porta Syntra**: non deve — «fa tutto da solo il server e pc, all'utente queste
   informazioni non devono risalire»;
4. **non mostra più i nomi utente Syntra** inseriti prima (`fb_syntra_utenti`,
   `syntraUtentiDisegna()`).

Dove: `installer_build/build/segnali_telegram/syntra_lettore.py` e il pannello Syntra in
`app.html`. ⚠️ **Richiede di ricostruire e reinstallare il ponte**: va detto al proprietario e va
mandato lo zip.

**Resta aperto anche il difetto di prima** (mai chiuso): la cronologia si ferma alla prima
operazione. Deve scorrere giù, espandere la seconda, leggere i valori, passare alla successiva
controllando **sempre la data**, fino al **periodo scelto**; e alla fine, per tornare a cercare
nuovi ordini, deve **ripremere «setup» in basso a sinistra** (accanto a «classifica») — è da lì che
si arriva a «notifiche» in alto a destra. La classifica **non basta**.
Test esistenti: `laboratorio/ponte/test_profilo_espansione.py` (13).

### 3.2 Caricamento del grafico al cambio asset ⭐

**Riferito:** «non deve mai visualizzarsi il nome dell'asset se prima ancora non è stato caricato
il grafico, la rotellina continuerà a girare fin quando non è avvenuta l'esatta sincronizzazione
del grafico per quel asset e vengono caricati tutti i dati».

Insieme alla richiesta già in lista: l'indicatore di caricamento deve mostrare la **percentuale**,
e con il grafico staccato il popup deve comparire **nella finestra PIP** (esiste già il criterio:
`popupTargetDoc()` / `moveModalToFloatingIfActive`, sistemato il 19 ottobre).

### 3.3 Freeze e scatti dopo gli aggiornamenti

**Riferito:** «dopo gli aggiornamenti l'applicazione inizia a laggare e scattare nel movimento a
scorrimento di tutta la pagina e all'interno del grafico, anche in modalità replay, ma io penso che
sia un problema a monte di connettività».

**Da misurare, non da indovinare**: profilo del browser su scorrimento pagina, scorrimento grafico
e replay, e conteggio delle richieste di rete in quei momenti. L'ipotesi della connettività va
confermata o scartata con un numero prima di toccare il disegno.

### 3.4 Footprint in replay

Mai affrontato. Il motore del replay è stato riscritto il 19 ottobre (ripresa esatta dallo STOP, 60
fps, footprint che non sparisce più a fine candela, 100x): va verificato **se il difetto c'è
ancora** prima di rimetterci mano.

---

## 4. Priorità 3 — il telefono

### 4.1 Dentro il grafico i pulsanti stanno uno sopra l'altro

**Riferito:** «sul tablet è accettabile, sul telefono no, specialmente dobbiamo intervenire sulla
visualizzazione interna del grafico perché i pulsanti sono uno sopra l'altro, la barra in alto per
aprire posizioni a comparsa deve **sempre stare attaccata al bordo alto del grafico**».

### 4.2 I popup non devono mai oltrepassare il bordo dello schermo

**Riferito:** «mai». Visto sui popup della **configurazione delle strategie**.

### 4.3 Il testo non deve mai oltrepassare il bordo del popup

Valido per **tutti** i popup, impostazioni e collegamento/modalità compresi.

### 4.4 I popup devono adattarsi al contenuto

**Riferito:** per la **cronologia delle sale** il popup è troppo piccolo per il testo che contiene:
va allargato di conseguenza.

### 4.5 La linea apertura↔chiusura sempre visibile, anche con zoom largo

**Riferito:** «deve essere sempre visibile anche se abbiamo fatto uno zoom largo più della
visualizzazione del punto di apertura e il punto di chiusura (importante)».

Nel codice la linea tratteggiata è già dichiarata «SEMPRE visibile» (`app.html:14297`), ma lì si
parla dell'hover: il caso da correggere è quello con **gli estremi fuori dallo schermo**.

### 4.6 Via i cartellini TP/SL dalla barra dei prezzi

**Riferito:** «nella barra dei prezzi togliamo i cartellini disegnati dei tp-sl, danno solo
fastidio».

---

## 5. Priorità 4 — sincronizzazione fra PC e dispositivi mobili

### 5.1 Stile e impostazioni dal PC al telefono

**Riferito:** «l'account google non riporta gli stessi style e setting del pc sui dispositivi
mobili»; e «devono essere ricordate tutte le configurazioni di style, impostazioni footprint
heatmap eccetera: devono prendere queste informazioni dalla configurazione del pc».

Il 19 ottobre è entrato il **Sync Cloud delle preferenze** (watchlist, ricerche salvate, scala
interfaccia) su `users/{uid}/data/preferenze`: lo schema esiste e funziona, va **esteso** alle
impostazioni di stile, footprint e heatmap.

⚠️ Il **footprint e la heatmap della watchlist** sono un caso a parte e **architetturale**: quei
dati vivono per dispositivo (IndexedDB, `footprintArchivio`) e sono molti. Qui si sincronizzano le
**impostazioni**; copiare tutto l'archivio è un'altra decisione, da prendere a parte.

### 5.2 Le credenziali restano dentro l'app del dispositivo

**Riferito:** «i dispositivi mobili quando effettuano la connessione con capital.com e mt5, le
credenziali devono rimanere dentro all'applicazione del dispositivo mobile, a meno che non si
disinstalla l'applicazione: i dati di accesso vengono cancellati per sicurezza».

Cioè: **non** sul cloud con le preferenze. Vale la regola del progetto: nessuna credenziale nel
repo e nessuna nella nuvola.

---

## 6. Priorità 5 — funzioni nuove

### 6.1 TP/SL della barra agganciati alla posizione selezionata ⭐

**Riferito:** cliccando una posizione a grafico (quindi selezionandola) i pulsanti **TP e SL della
barra delle operazioni si collegano a quella singola posizione**, per poterli spostare.
Deselezionando, i due pulsanti tornano a configurare **una nuova apertura**. Se si clicca il
pulsante SL/TP per una nuova apertura e poi si clicca **in un punto vuoto** del grafico,
l'impostazione si annulla: TP/SL tornano a **0** e il **preview sparisce**. «tutto questo sistema
deve essere apportato anche per la parte delle criptovalute collegate al conto Kraken».

Esiste già `posSelezionata` (`app.html:4116`) e il trascinamento dei livelli Kraken (v165).

### 6.2 Ordini pendenti: spostare entrata, TP e SL

**Riferito:** «quando abbiamo piazzato ordini pendenti dobbiamo avere la possibilità di spostare
sia l'entrata che i vari tp con sl».

Esiste già il trascinamento della **bozza** dell'ordine prima di piazzarlo (`app.html:16513`,
`:16546`): manca su un ordine **già piazzato**.

### 6.3 Ordini pendenti nella strategia delle sale e nella strategia universale

**Riferito:** il setting degli ordini pendenti va dentro il **popup strategia della sala** e nella
**strategia universale**. Le due metodologie di esecuzione del segnale restano:
**una posizione per ogni TP** (senza la strategia universale) oppure **una posizione sola con
chiusura parziale**.

Con due **freni** di sicurezza, entrambi selezionabili:

- se non scatta entro **X tempo**, l'ordine pendente si cancella da solo;
- se l'ordine limite non viene attivato e il prezzo **supera N TP**, l'ordine si cancella da solo.

E tutto questo va riportato anche nella **lista di configurazione della cronologia delle sale** e
nella loro resa.

### 6.4 Riordino di Collegamento/Modalità, con la scheda «Collegamento»

**Riferito**, e **ancora da fare**: misurato oggi, le schede sono tornate a
`live, mt5, binance, propfirm, notion, collegamento, versione` — senza Kraken e senza «Sala
segnali».

Ordine richiesto, con un pulsante in più **tutto a destra**:

1. Live/Storico (sessione Capital.com) — 2. MT5 — 3. **Kraken** — 4. Prop Firm —
5. Template Notion — 6. **Sala segnali** — 7. **Collegamento**.

Dentro **Collegamento** vanno spostati:

- la casella di visualizzazione del collegamento a Telegram e **sala in ascolto**;
- il pulsante **Ricontrolla** (resta); la **porta del ponte deve sparire** dalla vista
  dell'utente (oggi `id="tgPort"` è già `display:none`, `app.html:1780`: va tolta del tutto);
- il pulsante **accesso da altri dispositivi e server Oracle**;
- il pulsante di **collegamento a Telegram**, **«esci da Telegram / dimentica il numero»** e tutto
  il percorso del **nuovo utente** (verifica del numero e il resto).

⚠️ Attenzione: questo lavoro era già stato tentato e **lasciato a metà** (schede senza pannello,
pannelli duplicati, `liveModeSwitch` tolto dall'HTML ma ancora agganciato da JavaScript: l'app
andava in errore al caricamento e si perdevano 49 ascoltatori, fra cui tutto il menù MT5 e tutta la
Prop Firm). Il controllo di sintassi **non se ne accorge**. Il collaudo deve **aprire il popup e
cliccare ogni scheda**, verificando che compaia esattamente un pannello.

### 6.5 Aggiornamento «classico» su Windows

**Riferito:** «scarica il pacchetto, chiude i processi, lancia l'aggiornamento e poi installa,
togliendo il vecchio pacchetto di installazione».

Sul **mobile** il giro è già stato sistemato (§1.2). Sul **computer** oggi l'app scarica il Setup e
lascia all'utente l'apertura del file: mancano la **chiusura dei processi**, l'avvio
dell'installazione e la **rimozione del pacchetto vecchio**.

---

## 7. Richieste di prima, ancora aperte (non ripetute, non dimenticate)

- **Multi-selezione dei conti** nella dashboard statistiche.
- **Cancellazione di un conto che purga tutto**, con avviso esplicito: *«attenzione, se elimini il
  conto eliminerai anche le sue statistiche»*.
- **Pulsante «Chiudi» a grafico** con popup: chiusura **a mercato** oppure **parziale**, con la
  percentuale scelta dall'utente.

---

## 8. Rinviate dal proprietario — non farle se non le richiede

- **Integrazione Discord**: notifica sul gruppo a ogni modifica, con la richiesta che l'ha
  originata; canale «idee» con sondaggio che, se la maggioranza approva, fa partire la richiesta.
  Parole sue: «questa sarà una modifica che faremo più avanti, non adesso».
- **App sganciata da Chrome**: in parte superata — oggi esistono il Setup Windows e l'APK Android,
  con i pulsanti sulla landing; **iOS è ancora da completare**.

---

## 9. Cosa serve dal proprietario

1. **Installare la 2.0.10 su telefono e tablet** e dire se login Google, aggiornamento e scala al
   10% funzionano: tre voci della lista dipendono da questa risposta (§1).
2. Solo **se il login ancora non va**: `google-services.json` dal pannello Firebase e la
   registrazione dell'impronta SHA-1 `64d6f827...` (§1.1).
3. Sapere che **Syntra e il ponte** richiedono di **ricostruire e reinstallare il Setup** (§3.1).

---

## 10. Promemoria che valgono per ogni punto

- **Si misura prima di correggere.** Quasi ogni voce del diario racconta una causa trovata
  misurando, non indovinando — e più volte la causa non era dove si guardava.
- **Ogni correzione ha un test**, e il test guarda il **comportamento**, non una stringa nel
  sorgente. Un test che conta quante volte una funzione compare nel file non dice **dove** sta.
- **Conta il collaudo di GitHub**, non quello locale, e il verde si prende **sul ramo** prima di
  toccare `main`.
- Modifiche fuori da `app.html` (ponte, installer) → **ricostruire il Setup** e avvisare.
- Italiano ovunque; niente identificativi di modello; nessuna chiave API nel repo; soldi veri mai.
