# Lezioni (errori di ragionamento da non ripetere)

1. **Prima la prova, poi l'ipotesi.** Sul 403 del WebSocket si sono persi giri su librerie e
   permessi del browser; la causa era un decoratore spostato. Riprodurre e leggere il codice che
   risponde, prima di teorizzare.
2. **Candele finte con date ISO con la Z** (`new Date().toISOString()`). Le date senza fuso vengono
   lette come ora del broker e spostano tutto: una posizione "sparisce" dal grafico per colpa del
   test, non dell'app.
3. **Id generati col tempo collidono.** Due oggetti creati nello stesso millisecondo: aggiungere
   una parte casuale.
4. **Percorsi veri, mai inventati.** Il proprietario estrae lo zip in
   `C:\Users\pietro\Desktop\trading` (vecchio PC) e la cartella si chiama sempre `installer_build`.
   Sul PC nuovo il percorso va chiesto, non indovinato.
5. **Un comando per riga** nelle istruzioni per Windows, con la cartella da cui lanciarlo.
6. **Uno screenshot non è un test.** Ogni verifica visiva va trasformata in un'asserzione in
   `laboratorio/`.
7. **Nella finestra PIP il `document` è un altro.** Ascoltatori con `fblDelega`, ricerche con `$$tutti`.
8. **Un valore "comodo" può nascondere un modello sbagliato.** I pip forex su BTC davano 1.500.000:
   quando un numero è assurdo, il modello è sbagliato per quello strumento.
9. **Verde qui, rosso su GitHub = il test dipende dall'ambiente.** Il simulatore Kraken scaricava i
   prezzi veri appena creato: nel contenitore Kraken non si raggiunge, su GitHub sì, e il prezzo
   reale faceva scattare i TP finti. Ora `laboratorio/ponte/_percorsi.py` blocca ogni connessione
   non locale. Un test non deve mai dipendere da internet.
10. **Oracle gratuito: "Out of capacity" sulla ARM è normale.** Non insistere a vuoto: forma più
    piccola, altro availability domain, oppure la AMD Micro gratuita (con swap) per partire subito.
11. **Oracle: l'immagine predefinita è Oracle Linux, non Ubuntu.** Utente `opc`, non `ubuntu`;
    "Permission denied (publickey,gssapi-...)" con `ubuntu@` è il segnale. La guida ora dice di
    premere Change image.
12. **Ubuntu sì, ma 24.04.** Nell'elenco delle immagini Oracle c'è anche la 20.04 (fuori supporto,
    senza Docker): far controllare `lsb_release -d` appena dentro il server.
13. **Prima di inventare una numerazione, guardare quella che c'è.** Le release del proprietario
    erano già `v1.0.NN`: la mia `app-v86-setup-1.0.8` faceva sembrare il Setup più vecchio.
14. **Prima di avviare un servizio su un server "nuovo", guardare chi tiene già la porta.** Sul
    server Oracle un vecchio `forex-bridge.service` (systemd) occupava 127.0.0.1:8769 e il
    container `segnali` ripartiva in tondo con "porta occupata". `ss -ltnp | grep 8769` lo dice
    subito.
15. **"Dimentica il numero" deve voler dire "esci".** Togliere solo il numero lasciava la
    sessione Telegram attiva: il proprietario si aspettava di essere scollegato.
16. **Una guida che dice "sezione X" deve nominare ogni pulsante da premere per arrivarci.** "Prova
    il server" era dietro "Accesso da altri dispositivi", un nome che non c'entrava col server.

17. **Una regola copiata in tre formule diverge, e i test non se ne accorgono se i numeri cadono
    dalla stessa parte.** Il limite giornaliero della prop firm viveva in `checkPropFirmRules`,
    `pfMt5Metrics` e `fblPropDedicataConta`, sbagliato in tutti e tre allo stesso modo: il 5% del
    saldo di apertura del giorno invece che del capitale iniziale. Undici test lo coprivano e
    passavano tutti, perche' i loro numeri davano lo stesso verdetto con tutte e due le formule.
    Per TROVARLO serve un caso costruito apposta perche' le due regole rispondano OPPOSTO; per
    non RITROVARSELO serve che il numero stia in un posto solo.

18. **Un sorvegliante che muore tace identico a uno che sorveglia.** Un `ssh` dentro un ciclo di
    sfondo moriva al primo giro (uscita 255, nessuna riga stampata): senza `-n` prova a leggere
    un ingresso standard che li' non esiste. Il silenzio sembrava "tutto tranquillo". Chi
    sorveglia non deve MAI uscire per un errore di rete, e deve dire qualcosa anche quando la
    cosa sorvegliata smette di esistere.

19. **Un doppione finto incompleto non e' piu' semplice: e' rotto piu' tardi.** Il finto cloud di
    `cloud_incrementale.test.mjs` aveva 5 dei 12 metodi che l'app usa davvero. Da solo passava
    sempre; nel collaudo completo i processi in parallelo allungavano i tempi e un timer faceva
    in tempo a chiamarne uno inesistente, bloccando la pubblicazione. E al primo tentativo l'ho
    "riparato" aggiungendo `ready` come FUNZIONE, mentre l'app ci fa `.then()` sopra: e' una
    PROMESSA. Riparare senza guardare come il pezzo viene usato sposta il difetto, non lo toglie.

21. **Non si spinge MAI un test prima del codice che deve farlo passare.** Scritto un file di
    test mentre aspettavo un collaudo - per non stare fermo - e' finito nel commit insieme ad
    altro. L'implementazione e' arrivata dopo, e su GitHub due dei sei test sono caduti: il
    proprietario ha visto un semaforo rosso che non sapeva spiegare. **In locale un test rosso e'
    informazione; su GitHub e' solo un allarme rotto.** Se un test si scrive in anticipo, resta
    fuori dal commit finche' non c'e' il codice - oppure si parcheggia con un nome che il
    collaudo non raccoglie (`.DA-ATTIVARE.mjs`), come gia' fatto per il preset della prop firm.

22. **Un test che passa SENZA il codice che dovrebbe provare non sta provando niente.** Degli
    stessi sei test, quattro passavano anche con la vecchia implementazione a slot unico. Non e'
    una buona notizia: vuol dire che misuravano qualcosa che era gia' vero. Il modo di
    accorgersene e' guardarli diventare rossi PRIMA, uno per uno - e se uno non diventa rosso,
    chiedersi che cosa stia davvero affermando.

20. **Dentro le virgolette doppie la shell esegue i backtick. Sempre, dovunque.** Vale in
    `python -c "..."`, in `git commit -m "..."`, in qualunque stringa fra virgolette doppie: ogni
    nome fra backtick diventa un comando eseguito e sostituito col suo risultato, quasi sempre il
    nulla. Il comando riesce lo stesso, e il buco si vede solo rileggendo.

    **E' successo TRE VOLTE in una giornata** (28 ottobre 2026): scrivendo questa stessa lezione,
    poi in un messaggio di commit, poi di nuovo in un altro. Una volta la shell ha perfino
    eseguito `npm ci` e letto un file YAML riga per riga come se fossero comandi. Sapere la
    regola non basta: serve non averne l'occasione.

    **LE DUE REGOLE SECCHE, senza eccezioni per i messaggi corti:**
    - gli script che toccano i file si scrivono **su file**, mai in una riga di comando;
    - i messaggi di commit si passano **sempre** con `git commit -F <file>`, mai con `-m "..."`.

    La tentazione arriva quando il messaggio sembra breve abbastanza da non meritare un file.
    E' esattamente il momento in cui ricapita.

- **`app.html` ha a capo Windows (CRLF).** Uno script di modifica che cerca blocchi su piu' righe
  scritti con `
` non trova mai niente e l'assert boccia senza spiegare perche'. Convertire gli
  a capo del blocco cercato prima di cercarlo.
- **Nei test, «non risponde mai» si scrive `Infinity`, non `999`.** Con l'attesa accorciata si
  fanno oltre mille tentativi in pochi secondi: un 999 viene raggiunto davvero e la prova che
  doveva fallire riesce, dicendo il falso.
- **Le variabili lette da `localStorage` all'avvio della pagina** non cambiano se il test scrive
  nel deposito dopo il caricamento: va impostata anche la variabile in memoria.
- **Su Windows `python3` puo' essere il segnaposto del Microsoft Store**, un interprete diverso da
  quello con le librerie: il collaudo bocciava senza motivo. `collauda.sh` ora sceglie
  l'interprete che ha davvero pytest.
- **`subprocess.run(..., text=True)` su Windows decodifica con la codifica locale (cp1252).** Su
  `app.html` scoppia dentro un thread di lettura: l'eccezione non arriva al chiamante, il
  risultato resta vuoto e il controllo **non blocca mai**. Passare sempre
  `encoding="utf-8", errors="replace"`. Un controllo che fallisce in silenzio e' peggio di un
  controllo assente, perche' si crede di essere protetti: provare sempre anche il caso che DEVE
  bloccare, non solo quello che deve passare.
- **Meglio chiedere a git se un file e' cambiato (`git diff --quiet`) che leggerlo e confrontarlo.**
  Su un file da 4 MB e' piu' veloce e non c'e' nessun problema di codifica.
- **Collaudo verde sul PC non vuol dire verde su GitHub.** Dal 6 al 7 ottobre 2026 il flusso
  Collaudo e' rimasto rosso a ogni push senza che nessuno guardasse: sul PC le librerie c'erano,
  nel flusso no. Dopo ogni pubblicazione: `gh run list --workflow=collaudo.yml --limit 3`.
- **Le librerie di un servizio si installano dal file che le dichiara** (`requirements.txt`), non
  elencandole a mano nel flusso: l'elenco a mano resta indietro al primo import nuovo, e il
  programma esce all'avvio con "Mancano le librerie" invece di dire quale manca.

- **Il bug era in `installer_build/build/segnali_telegram/requirements.txt` vs `collaudo.yml`.**
  `pip install fastapi` senza `uvicorn` fa fallire l'import di `segnali_bridge` prima di ogni test.
- **Una chiave di deduplicazione non si ricava mai da un nome che l'utente puo' cambiare.** Al
  primo rinomina tutte le chiavi cambiano e tornano tutti i doppioni. Si usa l'identificativo.
- **Lo script di modifica salva solo alla fine: se un passo fallisce, NON ha scritto niente.** E'
  voluto (niente mezze modifiche), ma le righe "ok" gia' stampate ingannano: dopo un errore vanno
  rifatte TUTTE le sostituzioni, non solo quella fallita.
- **Gli heredoc di bash, in questo ambiente, mangiano UN livello di backslash** anche fra
  apici singoli. Uno script che cerca blocchi contenenti `\n` o `\'` non combacia piu', e
  l'errore dice solo "0 occorrenze": si finisce a dubitare del testo invece che del modo in
  cui e' arrivato. **Gli script di modifica si scrivono come file e si lanciano**, mai
  incollati in un heredoc.
- **`Number(null)` e' 0, non NaN** (terza volta che costa un difetto). Convertire e *poi* filtrare
  con `Number.isFinite` lascia passare i valori mancanti travestiti da zero: nella linea di
  tendenza ogni periodo vuoto diventava un pareggio e tirava la retta verso il basso. Si scarta
  **prima** di convertire. L'ha trovato un test scritto apposta per questo caso, non la lettura
  del codice.
- **Un messaggio onesto scritto nella chiave sbagliata non esiste.** Il controllo "Syntra non
  funziona su Linux" scriveva in `stato["syntra"]`, ma l'app mostra `syntra_errore`: dal server
  l'app diceva "attiva, nessun errore, nessuna sala". Quando si aggiunge un avviso, si verifica
  **chi lo legge**, non solo che venga scritto.
- **Un elenco scritto a mano e' una lista di cose che prima o poi mancano.** Le criptovalute
  riconosciute erano due (BTC, ETH) e nemmeno in tutte le loro forme: `BTCUSDT` c'era, `ETHUSDT`
  no. Le coppie forex erano gia' generate "invece di elencarne 28 a mano": era la stessa
  situazione, trattata in due modi diversi nello stesso file.
- **Lo stesso dato normalizzato in due posti si sistema in due posti.** Il ponte riconosceva la
  moneta, l'app doveva poi ritrovare l'asset dai suoi gruppi di sinonimi: correggerne uno solo
  avrebbe dato il risultato peggiore, segnale riconosciuto e poi scartato piu' avanti con un
  messaggio diverso.
- **Una condizione d'avvio che non si chiude mai blocca tutto il giro.** In Syntra `primo`
  ("non ho ancora fatto l'inventario") diventava False solo se la pagina Notifiche veniva trovata;
  se non si trovava al primo giro, da li' in poi la pagina non si aggiornava **piu'** e nessuna
  notifica veniva consegnata - con lo stato che diceva "collegato, nessun errore". Ogni stato
  d'avvio deve avere una via d'uscita, e il fallimento va **detto**.
- **Il testo che arriva da fuori non si stampa mai come viene.** Il 7 ottobre 2026 alle 16:29 il
  ponte dei segnali e' MORTO per una spunta verde: `UnicodeEncodeError: 'charmap' codec can't
  encode character '✅'` dentro `_log`. La console di Windows e' cp1252 (256 caratteri, nessuna
  emoji) e le sale segnali di emoji sono piene — quindi non era un caso raro, era il caso normale:
  bastava aspettare. Il file *sapeva gia'* del problema (c'era il commento "solo ASCII in queste
  righe, gia' successo su un altro ponte") ma proteggeva il testo NOSTRO, lasciando scoperto quello
  che arriva da fuori, che e' l'unico che non si controlla.
- **Una riga di diario non deve poter fermare il lavoro.** Stesso episodio: scrivere nel log e' un
  di piu', leggere i segnali e' il lavoro. Ogni `print` o scrittura di diario su testo altrui va in
  `try/except`, altrimenti un accessorio si porta via il servizio.
- **Un servizio che qualcuno accendeva e nessuno accende piu'.** `/segnali-launch` lo chiamava
  l'app; da quando c'e' il server, `tgAssicuraPonte` risponde "c'e' gia'" e non lo accende. Il
  ponte era morto da ore e niente lo diceva. Spostando un servizio altrove, va sempre chiesto: **chi
  avviava quello di prima, e cosa ci girava dentro che non si e' spostato?**
- **`sys.stdout` sotto pytest e' di pytest.** Sostituirlo da un test non funziona (la cattura lo
  rimette) e i test falliscono per il motivo sbagliato. Se una funzione deve essere provata,
  l'informazione che le serve si passa come parametro invece di leggerla da una variabile globale.
- **Misurare prima, sempre.** L'8 ottobre 2026 il proprietario segnala l'app lenta. L'ipotesi
  ovvia erano i 35 cicli automatici e `update()` che rifa' le tabelle: misurati, costavano 3,6 ms
  in tutto. Il tempo stava altrove e in posti che nessuno avrebbe indovinato - meta' del primo
  disegno a convertire le date delle candele, un `ts.every(...)` su centomila elementi dentro
  `chartGeometry` a ogni disegno, i profili volumi che riscorrevano giorni di candele sessanta
  volte al secondo. Con la CPU rallentata sei volte (telefono) i numeri si leggono; su un computer
  tutto sembra a posto e non si trova niente.
- **Una cache si giudica da quando NON risponde.** Le due memorie aggiunte al disegno hanno i
  test sul caso in cui l'ingresso cambia, non su quello in cui resta uguale: una cache che
  risponde con roba vecchia e' peggio del lavoro che risparmia.
- **Un servizio può essere vivo come processo e morto come porta.** Il 9 ottobre
  il ponte degli ordini: il processo c'era, il log finiva con 200 OK di pochi
  minuti prima, ma `netstat -ano` non mostrava NESSUN ascolto su 8000 (grafico e
  segnali invece ascoltavano). Un hang silenzioso lascia il processo in vita senza
  nessun errore da leggere: il log dice "va tutto bene" perché l'ultima riga a
  buon fine risale a prima del blocco. Chi dice "il servizio non risponde" va
  creduto e verificato sulla PORTA (`netstat -ano | findstr :8000`), non sul
  processo e non sul log. E il riavvio è rimedio sufficiente: l'exe a ogni avvio
  fa piazza pulita delle istanze vecchie di sé e del feed.
- **Nel test, aspetta quello che SPARISCE, non quello che resta.** Nel gate MT5
  il titolo del passo 1 è visibile anche al passo 2: attendere che "compaia"
  fa leggere lo schermo una ventina di secondi prima del vero esito. Il segnale
  giusto è la chiusura del gate (display diverso da `flex`), che avviene solo
  quando il flusso cambia davvero passo.
- **`resolveMt5SymbolForAsset` ritorna `null` ANCHE per le cripto** — in cima ha
  `if(binanceAssetKey(asset))return null;`, quindi quel `null` vuol dire due cose diverse:
  «MT5 non ce l'ha» e «è una cripto, non guardare qui». Chi lo legge come la sola prima cosa
  («MT5 non ce l'ha, vado su un altro mercato») dirotta a torto le cripto. Prima di usarlo come
  prova, escludere esplicitamente gli asset cripto. Copre il caso
  `laboratorio/app/capital_instradamento.test.mjs`. — 9 ottobre 2026.
- **Un esito che dipende da una CHIAMATA (a MT5, a Capital.com) non si decide in una funzione
  sincrona:** l'unica risposta possibile sarà quella di ripiego, e sembrerà una scelta. Se la
  decisione deve chiedere, la funzione va resa asincrona, e la si mette dove l'`await` è già
  ammesso (qui `tgAutoValuta`, non `tgContoPerSegnale`). — 9 ottobre 2026.
- **Un finto che solleva prima di stampare sembra un ramo che non chiama.** Nel test del profilo
  Syntra il finto `leggi_profilo` moriva su una variabile `chiamate` mai dichiarata (`NameError`
  valutato negli argomenti della `print`, quindi **prima** della stampa) e l'`except Exception` del
  ramo inghiottiva l'errore: il sintomo era «la funzione non viene chiamata», mentre veniva chiamata
  e falliva. Nei finti dei test vanno definiti **tutti** i contenitori, e un'eccezione inattesa deve
  arrivare al test invece di essere assorbita. — 9 ottobre 2026.
- **Un test sul disegno va prima visto fallire, e poi gli si chiede perche' passava.** Il 9
  ottobre 2026 il test sulle righe di prezzo era verde sia col difetto sia senza: le operazioni
  finte stavano agli indici 10-30 mentre a schermo c'erano i 100-399, quindi non veniva disegnato
  niente e l'assenza delle righe non dimostrava nulla. Chi prova un disegno deve mettere nel test
  una **prova di controllo** - «questa roba viene disegnata davvero?» - altrimenti misura il
  vuoto e lo scambia per una conferma.
- **Un test che ricalcola le coordinate di un grafico con costanti proprie (margini, larghezze) si rompe quando cambia il disegno.** Il test della resa usava il margine del vecchio canvas (16) dopo il passaggio all'SVG (10): il collaudo e' rimasto rosso su main e su GitHub senza che nessuno guardasse, e la tolleranza di ±2 degli altri test nascondeva lo scarto. Quando si cambia un disegno, si cercano i test che ne ricalcolano le misure. - 10 ottobre 2026.

- **"Non funziona a volte" su una cosa che si clicca: misura il bersaglio PRIMA di cercare il bug
  nella logica.** (14 ottobre 2026, cambio stile del footprint.) Il proprietario segnalava che il
  cambio stile funzionava solo sulla candela di adesso. Riprodotto nel banco di prova, rispondeva
  su tutte: la logica era giusta da sempre. L'area sensibile era 9 px per 45, con il 38% di
  colonna morta fra una candela e l'altra - impossibile da prendere col dito. Un test che tocca
  UN punto scelto bene passa anche con un bersaglio inutilizzabile: il test giusto tocca tutte le
  candele, i bordi, e controlla che fra una zona sensibile e l'altra non restino vuoti.

- **"Funziona col mouse ma non col dito": guarda le uscite anticipate del gestore di pointerup.**
  (14 ottobre 2026, seconda volta.) Quel gestore esce presto per `pointerType==='touch'`, e tutto
  quello che sta scritto DOPO quell'uscita col dito non succede mai. E' gia' capitato col cambio
  stile del footprint e poi con la deselezione delle posizioni. Quando una cosa deve valere per
  tutti i puntatori, si scrive in una funzione e la si chiama da tutti i rami.
- **Una variabile che l'app riassegna da sola non puo' anche voler dire "scelto dall'utente".**
  (14 ottobre 2026, `active`.) Appena acquista il secondo significato, ogni riassegnazione
  automatica diventa una scelta che nessuno ha fatto - e il difetto sembra casuale, perche' scatta
  quando cambia qualcos'altro. Due significati, due variabili.

- **`Number(null)` fa 0, e 0 passa `Number.isFinite`.** (14 ottobre 2026, seconda volta con un
  altro vestito: la prima era `nt["quando"] or 0` nel lettore Syntra, dove una data illeggibile
  diventava il 1970 e la notifica veniva buttata come "vecchia".) Un valore ASSENTE che diventa
  zero non da' errore e non si vede: diventa una data del 1970, un prezzo di zero, un istante
  valido. Prima si guarda se il valore c'e' (`===null`, `===undefined`, `===''`), e solo dopo se
  e' un numero. Il controllo "e' un numero finito" non sa distinguere niente da zero.
  TERZA VOLTA, 14 ottobre 2026: un take profit mancante nel messaggio di una sala diventava un
  target a PREZZO ZERO - e in un BUY lo zero si piazza pure primo nell'ordinamento, cioe' diventa
  il TP1. Dove si leggono prezzi che arrivano da fuori, il filtro non e' "e' finito" ma "c'e', ed
  e' maggiore di zero".
  QUARTA VOLTA, stesso giorno: il ponte manda `sl: null` per una posizione Kraken senza ordine
  di stop, e quel null diventava uno STOP A PREZZO ZERO - la casella partiva dall'entrata e
  arrivava a zero, coprendo mezzo grafico. Quattro volte in un giorno sono un segnale: dove si
  leggono prezzi che arrivano da fuori si passa da una funzione che dice "c'e' ed e' un prezzo",
  non da Number() piu' Number.isFinite.

- **Un disegno "sovrapposto dopo" lampeggia: o lo fa il disegnatore, o non esiste.** (14 ottobre
  2026, la candela in formazione del replay.) Era dipinta DOPO draw(), e solo dal battito del
  replay: ogni altro ridisegno la cancellava. Il difetto peggiorava accelerando - piu' eventi,
  piu' ridisegni "senza" - ed e' la stessa forma gia' vista tre volte in questo file: agganciarsi
  a UNA strada invece che al punto che tutte attraversano. Se una cosa deve esserci sempre, deve
  stare dentro la funzione che disegna, non in un ritocco di chi l'ha chiamata.
- **Un timer non dice quanto tempo e' passato: lo dice l'orologio.** (14 ottobre 2026, il play che
  "si bloccava" sulle schede in secondo piano.) setInterval(f,50) NON garantisce 50 ms: i browser
  rallentano apposta i timer delle schede nascoste a uno al secondo o meno. Chi avanza "di un
  tanto per battito" invece che "del tempo davvero passato" rallenta di venti volte senza che
  niente segnali un errore. Si misura performance.now(), con un tetto per non tentare di
  recuperare in un colpo solo un'assenza lunghissima.

- **Se una cosa si vede solo sul dispositivo che l'ha creata, il dato e' nel posto sbagliato.**
  (14 ottobre 2026, stop e target delle posizioni Kraken.) Il motore che AGISCE puo' - e a volte
  deve - restare su un dispositivo solo: due che muovono lo stesso stop fanno danni. Ma quello che
  si GUARDA deve stare dove lo guardano tutti. Quando un disegno ripiega su uno stato locale,
  chiedersi sempre: su un altro dispositivo questo stato esiste? Se no, pubblicare i soli dati che
  servono a mostrarlo, in sola lettura.

- **Un test che legge il testo del codice dimostra che l'hai scritto, non che serve.** (15 ottobre
  2026, la v155 sul footprint "a strati".) La correzione c'era, il test la trovava nel sorgente,
  il collaudo era verde - e non fermava un solo tick, perche' la condizione dipendeva da uno stato
  ('capital') che dalla v131 non esiste piu'. Tre test verdi su una correzione inerte. Dove si
  corregge un COMPORTAMENTO, il test deve mettere il programma nella situazione segnalata e
  guardare cosa cambia: il prezzo si e' mosso? la posizione si e' chiusa? il tick e' finito nel
  registro? Un `assert` su una regex del sorgente serve solo a tenere fermo un invariante di forma
  (due chiamate che devono usare la stessa variabile), mai a dimostrare un effetto.
  E prima di correggere: misurare. Il banco che ha trovato la causa vera ci ha messo dieci minuti,
  e ha anche scoperto una cosa che nessuno cercava - a mercato chiuso uno stop poteva SCATTARE.

- **Se la stessa domanda ha tre risposte, prima o poi due sono sbagliate.** (15 ottobre 2026, il
  comportamento a mercato chiuso.) "Il mercato di questo asset e' fermo adesso?" era chiesta dalle
  candele al calendario dell'asset, dal footprint a liveSessionPhaseAt - ma solo con MT5 collegato
  - e dal prezzo che valuta le posizioni a nessuno. Erano tre regole scritte in tre momenti
  diversi, ognuna giusta per chi l'aveva scritta. Il risultato: il grafico fermo e i numeri che si
  muovevano, cioe' esattamente lo scenario in cui l'utente non puo' accorgersi che qualcosa non
  torna. Quando due pezzi devono stare d'accordo, non si scrivono due controlli uguali: si scrive
  una funzione che risponde, e la chiamano tutti.

- **"In corso" non e' uno stato: e' quello che si scrive quando non si sa.** (15 ottobre 2026, il
  ponte dei segnali che "rimaneva escluso per sempre".) Tre punti dell'app dicevano che qualcosa
  stava succedendo - la frase di stato, l'etichetta dell'interruttore, il semaforo del server - e
  nessuno dei tre lo sapeva: il primo era un ramo di scarto in fondo a una catena di `else if`, il
  secondo era scritto a mano come contrario di "collegato", il terzo provava una porta sola e
  concludeva sulle altre. Nel frattempo il ponte mandava la risposta giusta in un campo che nessuno
  leggeva. Un'attesa senza fine e' peggio di un errore: un errore manda a cercare, "in corso" dice
  di aspettare. Dove si scrive uno stato, o lo si sa o si dice che non lo si sa - e si dice da
  quanto, perche' e' il "da quanto" che distingue un'attesa da un blocco.

- **Un semaforo verde deve coprire tutto quello che promette, o promettere di meno.** (15 ottobre
  2026, "Prova il server".) Provava la porta 8000 e scriveva "Server raggiungibile": i segnali
  stanno sulla 8769 e non venivano mai toccati. Chi legge quel verde smette di cercare li' - quindi
  un controllo parziale non e' "meglio di niente", e' peggio, perche' sposta la ricerca altrove.
  O si provano tutti i servizi che la frase lascia intendere, o la frase deve dire quale si e'
  provato.

- **Un numero senza la sua unita' di misura e' un malinteso che aspetta.** (15 ottobre 2026, il
  "5%" delle sale segnali.) La casella diceva "5" e la colonna "Rischio", ma chi la compilava
  pensava "metto dentro il 5% del conto" mentre il codice calcolava "posso perdere il 5% del
  conto": sullo stesso segnale, 4,16 lotti contro 18,51. Nessuno dei due era un errore di
  programmazione - era un errore di LETTURA, reso possibile dall'interfaccia. La differenza si
  vedeva solo a posizione aperta, nel margine impegnato, e infatti e' arrivata come "come mai ha
  usato 5.839 euro?". Dove un numero puo' voler dire due cose, l'unita' di misura si mette
  ATTACCATA al numero e si lascia scegliere: non in una schermata di impostazioni, non in una nota,
  non nel nome della colonna.

- **Un limite scritto per un mercato va riletto quando ne arriva un altro.** (15 ottobre 2026, lo
  stop al 22% su SOL.) Il controllo "questo stop e' lontanissimo, non e' un prezzo vero" era al 20%
  per tutti, e andava benissimo finche' c'erano solo forex e oro. Sulle cripto rifiutava segnali
  perfettamente normali, in silenzio e prima di ogni altro calcolo - tanto che il difetto e' saltato
  fuori solo scrivendo i test per un'altra cosa. Quando si aggiunge una famiglia di strumenti non
  bastano i listini e le conversioni: vanno ripassate anche tutte le SOGLIE scritte addosso alla
  famiglia di prima.

- **Un collaudo che dipende da dove gira non e' un collaudo, e' un'opinione.** (16 ottobre 2026,
  quattro test rossi su GitHub per sette versioni.) Dalla v158 l'app chiede "questo dispositivo e'
  Windows?" per decidere se proporre l'installazione dei pacchetti MT5. Quella domanda rispondeva
  con il sistema operativo di CHI ESEGUE il collaudo: verde sul PC Windows, rossa su GitHub che
  gira su Ubuntu. In locale era verde ogni volta, e ogni volta ho pubblicato credendo fosse tutto a
  posto - mentre su GitHub, che e' quello che vale, era rosso dalla v158 alla v164.
  DUE ERRORI, e il secondo e' peggiore del primo. Il primo: un test ha ereditato una condizione
  dall'ambiente invece di dichiararla. Il secondo: ho guardato il collaudo che avevo a portata di
  mano invece di quello che decide. Quando esistono due collaudi, quello che conta e' sempre
  l'altro.
  LA REGOLA: tutto cio' che il programma chiede all'AMBIENTE - sistema operativo, fuso orario,
  lingua, dimensione dello schermo, rete - nel banco di prova si DICHIARA. Un banco che eredita
  non misura il programma: misura la macchina su cui e' acceso.

- **Un test che legge il SORGENTE non ha mai visto il programma.** (16 ottobre 2026, v166.) Due dei
  test nuovi dell'orario contavano quante volte "fblOrarioEsecuzione(...)" compare nel testo di
  app.html, e uno cercava "p.aperta_ms" fra le righe. Sembravano severi e non misuravano niente: uno
  si chiamava "e le celle restano allineate" mentre nella riga raggruppata l'orario e l'asset erano
  SCAMBIATI - contare le celle non dice DOVE stanno. E nessun test apriva il popup che il proprietario
  aveva chiesto: tutti verdi mentre due richieste su due non funzionavano.
  LA REGOLA: un test apre il programma e guarda l'EFFETTO - rende la tabella e legge la cella sotto la
  sua intestazione (per NOME di colonna, non per numero), apre il popup e preme "Salva". Un assert sul
  testo del codice va bene solo per un invariante di forma, mai per dimostrare un comportamento. E
  quando si corregge, si prova il test anche AL CONTRARIO: rimesso il difetto, quel test deve
  diventare rosso. Un test che passa in tutti e due i casi non vale niente.

- **«Ho calcolato il numero giusto» non è «l'utente ha scelto il numero».** (19 ottobre 2026.) Il
  calcolo del lottaggio consigliato era giusto fin dall'inizio: partiva dallo stop e dal rischio e
  dava il lotto esatto. Il difetto non stava nel calcolo, stava nel fatto che il risultato finiva
  **scritto dentro il campo che poi l'ordine legge**. Così l'utente vedeva un lottaggio «già
  pronto» che non aveva scritto lui, e lo mandava all'ordine al primo click; il rischio vero non
  era quello scritto nella casella RISCHIO. Il numero non era nemmeno stabile (dipendeva da quale
  livello fosse stato toccato per ultimo), quindi non si poteva nemmeno correggere a mente.
  LA REGOLA: un campo che l'utente poi usa per un'azione vera si scrive solo con un'azione sua. Il
  programma può calcolare, consigliare e mostrarlo in un posto che NON è quello — ma la parola
  «consigliato» e quella «impostato» non si scambiano, e quando si scambiano l'utente non ha più
  modo di sapere che cosa sta per mandare. Se proprio si vuole il collegamento automatico, la
  condizione è che sia il dato di ingresso a cambiare il dato di uscita (l'utente cambia il
  rischio → il lottaggio si aggiorna, e lo sa perché ha toccato il rischio). Prima di correggere,
  misurare di quanto il numero si sposta: 0,07 → 0,05 è un difetto che si spiega in tre righe.

- **Uno script che cerca un pattern corto puo' colpire l'INIZIO del file.** (19 ottobre 2026, Sync
  Cloud delle preferenze.) Per agganciare la pubblicazione della scala UI ho usato uno script Python
  che sostituiva una stringa in app.html. Il pattern era corto e poco ancorato, quindi ha trovato la
  prima occorrenza del file: `<!DOCTYPE html>`. Il documento cominciava con tre righe di commento e il
  doctype era ridotto a `!DOCTYPE html>`. Il controllo di sintassi degli script era verde lo stesso
  (quegli script restavano validi): l'avrebbe mostrato solo l'apertura della pagina vera. Nello stesso
  giro, gli script hanno riscritto i fine riga in LF mentre app.html e' in CRLF, e `git diff --stat` e'
  passato a 47.000 righe cambiate per una modifica di 200.
  LA REGOLA: su un file grande come app.html le sostituzioni si ancorano a un blocco INTERO e UNICO (una
  funzione intera, con il commento che la precede), mai a una stringa corta che puo' comparire anche
  altrove. E prima di dire "fatto" si guarda `git diff --stat`: se le righe cambiate non assomigliano a
  quelle che si sono scritte, si e' rotto qualcosa - si torna indietro senza committare. Per separare
  un vero problema dai soli fine riga, `git diff --ignore-cr-at-eol --stat`.

- **Un nome che esiste "sopra" non esiste "sotto".** (19 ottobre 2026, Sync Cloud delle preferenze.)
  La pubblicazione delle preferenze la chiama lo script classico, ma la funzione era dichiarata dentro
  il modulo Firebase: i nomi di un modulo non sono globali. La chiamata c'era, scritta bene, e valeva
  `pubblicaPreferenze is not defined` nell'app vera - la stellina andava in errore e la preferenza non
  partiva. A trovarlo e' stato il collaudo largo (un test che toccava la watchlist), non la lettura del
  codice: a occhio la riga sembrava giusta. Il file ha gia' il modo di passare i confini - `window.` con
  la guardia `&&` - e vale per ogni chiamata che attraversa modulo e script classico.
  LA REGOLA: quando si collega uno script classico a un modulo, il nome si prende da `window` e si
  controlla che ci sia, mai per nome nudo. E il collaudo largo va fatto girare sempre: i test nuovi
  guardavano solo il blocco isolato, e li' il difetto non si poteva vedere.

- **Una funzione dichiarata due volte e' una funzione sola: vince l'ultima, e nessuno se ne accorge.**
  (19 ottobre 2026, popup sulla pagina giusta.) `moveModalToFloatingIfActive` era scritta due volte in
  app.html. La seconda, piu' in basso, sovrascriveva la prima: il refactoring che instradava i popup
  nel documento del pulsante premuto era codice morto, e in produzione restava il comportamento
  vecchio. Nessun errore, nessun avviso: solo un comportamento che non corrispondeva al commento
  scritto sopra la funzione buona. A trovarlo e' stato il proprietario che segnalava il sintomo, e la
  sonda in Chromium che lo ha misurato (`daPagina = "pip"`).
  LA REGOLA: quando una funzione e' dichiarata in piu' punti, NON e' una variante: e' un errore. Se ne
  tiene una. E il modo per accorgersene non e' leggere il file (a occhio sembrava tutto a posto): e'
  cercare il nome e contare le definizioni, oppure misurare il comportamento in Chromium. Un difetto
  che nessuno strumento segnala va cercato contando, non leggendo.

- **Un pulsante che scarica non e' un pulsante che funziona: il file va verificato.** (19 ottobre
  2026, l'APK che rispondeva 404.) Il sito puntava a un indirizzo stabile "latest/download/
  forexbacktestlab.apk" e per otto release quel file non c'era piu' (dalla v2.0.4-126 le release
  allegano solo il Setup Windows): ogni tablet finiva su una pagina d'errore GitHub. Nessun test lo
  vedeva, perche' i test controllavano che il pulsante ci fosse, non che il file esistesse. E il
  commento nel codice dichiarava il difetto ("oggi risponde 404: il riquadro lo dichiara") mentre il
  riquadro non lo dichiarava: un commento che descrive una protezione mai scritta e' peggio di
  nessun commento, perche' mette tranquillo.
  LA REGOLA: quando una pagina offre un download, o il file e' nel repository insieme alla pagina
  (e allora c'e' sempre), o lo si verifica prima di offrirlo. L'API delle release dice quali asset
  esistono: si chiede a quella. E un file di installazione che manca non si "aggiusta" scrivendo
  "premi qui": si costruisce e si allega.

- **La versione va letta da dove vive, non scritta a mano.** (19 ottobre 2026, scheda Versione.)
  Il proprietario non poteva sapere se l'app era la 2.0.5 o la 2.0.6: nessuna schermata lo diceva.
  Scrivere "2.0.6" in una costante avrebbe funzionato fino alla prima dimenticanza al momento del
  rilascio, e allora la schermata avrebbe mentito con sicurezza. La versione vera sta nella cache
  del service worker (`forex-backtest-lab-v2.0.6`) e nel sw.js del dispositivo: si legge da li'.
  E si confronta a NUMERI: "2.0.10" e' piu' nuovo di "2.0.9", mentre l'ordine alfabetico dice il
  contrario.
  LA REGOLA: un dato che l'utente usa per decidere (versione, data, stato) si legge dalla fonte che
  lo produce, non si ricopia. Se la fonte non risponde, si scrive "non disponibile": mai un numero
  inventato.

- Un pulsante che scarica non e' un pulsante che funziona: il file va verificato. (19 ottobre 2026, l'APK che rispondeva 404.) Il sito puntava a un indirizzo stabile "latest/download/forexbacktestlab.apk" e per otto release quel file non c'era piu' (dalla v2.0.4-126 le release allegano solo il Setup Windows): ogni tablet finiva su una pagina d'errore GitHub. Nessun test lo vedeva, perche' i test controllavano che il pulsante ci fosse, non che il file esistesse. E il commento nel codice dichiarava il difetto ("oggi risponde 404: il riquadro lo dichiara") mentre il riquadro non lo dichiarava: un commento che descrive una protezione mai scritta e' peggio di nessun commento, perche' mette tranquillo. LA REGOLA: quando una pagina offre un download, o il file e' nel repository insieme alla pagina (e allora c'e' sempre), o lo si verifica prima di offrirlo. L'API delle release dice quali asset esistono: si chiede a quella. E un file di installazione che manca non si "aggiusta" scrivendo "premi qui": si costruisce e si allega.

- La versione va letta da dove vive, non scritta a mano. (19 ottobre 2026, scheda Versione.) Il proprietario non poteva sapere se l'app era la 2.0.5 o la 2.0.6: nessuna schermata lo diceva. Scrivere "2.0.6" in una costante avrebbe funzionato fino alla prima dimenticanza al momento del rilascio, e allora la schermata avrebbe mentito con sicurezza. La versione vera sta nella cache del service worker (forex-backtest-lab-v2.0.6) e nel sw.js del dispositivo: si legge da li'. E si confronta a NUMERI: "2.0.10" e' piu' nuovo di "2.0.9", mentre l'ordine alfabetico dice il contrario. LA REGOLA: un dato che l'utente usa per decidere (versione, data, stato) si legge dalla fonte che lo produce, non si ricopia. Se la fonte non risponde, si scrive "non disponibile": mai un numero inventato.

- Una schermata che cresce senza ordine diventa un deposito. (19 ottobre 2026, riorganizzazione Impostazioni.) La scheda "Sala segnali" aveva accumulato: ponte, apertura automatica, suono, accesso dispositivi, server Oracle, account Telegram, configurazione, gruppi. Quando il proprietario ha chiesto "spostiamo tutto dentro un pulsante Collegamento", la mossa era chiara ma il rischio era rompere i test che cercavano i pulsanti dentro le sottoschede Telegram/Syntra. Il test richieste_8ott.test.mjs ha misurato il problema: dopo lo spostamento i due pulsanti "Segnale manuale" non c'erano piu' (perche' i sottopannelli non erano stati copiati). Aggiungerli dentro il nuovo panel ha rimesso il test in verde. LA REGOLA: quando si sposta un blocco di UI, i test che lo cercano per selettore (data-attribute, classe, id) vanno rotti se il DOM cambia. Prima di dire "fatto" si lancia il test che quel comportamento lo misura.

- Un nome che esiste "sopra" non esiste "sotto". (19 ottobre 2026, Sync Cloud delle preferenze.) La pubblicazione delle preferenze la chiama lo script classico, ma la funzione era dichiarata dentro il modulo Firebase: i nomi di un modulo non sono globali. La chiamata c'era, scritta bene, e valeva "pubblicaPreferenze is not defined" nell'app vera - la stellina andava in errore e la preferenza non partiva. A trovarlo e' stato il collaudo largo (un test che toccava la watchlist), non la lettura del codice: a occhio la riga sembrava giusta. Il file ha gia' il modo di passare i confini - window. con la guardia && - e vale per ogni chiamata che attraversa modulo e script classico. LA REGOLA: quando si collega uno script classico a un modulo, il nome si prende da window e si controlla che ci sia, mai per nome nudo. E il collaudo largo va fatto girare sempre: i test nuovi guardavano solo il blocco isolato, e li' il difetto non si poteva vedere.

- Una funzione dichiarata due volte e' una funzione sola: vince l'ultima, e nessuno se ne accorge. (19 ottobre 2026, popup sulla pagina giusta.) moveModalToFloatingIfActive era scritta due volte in app.html. La seconda, piu' in basso, sovrascriveva la prima: il refactoring che instradava i popup nel documento del pulsante premuto era codice morto, e in produzione restava il comportamento vecchio. Nessun errore, nessun avviso: solo un comportamento che non corrispondeva al commento scritto sopra la funzione buona. A trovarlo e' stato il proprietario che segnalava il sintomo, e la sonda in Chromium che lo ha misurato (daPagina = "pip"). LA REGOLA: quando una funzione e' dichiarata in piu' punti, NON e' una variante: e' un errore. Se ne tiene una. E il modo per accorgersene non e' leggere il file (a occhio sembrava tutto a posto): e' cercare il nome e contare le definizioni, oppure misurare il comportamento in Chromium. Un difetto che nessuno strumento segnala va cercato contando, non leggendo.

- Un pulsante che scarica non e' un pulsante che funziona: il file va verificato. (19 ottobre 2026, l'APK che rispondeva 404.) Il sito puntava a un indirizzo stabile "latest/download/forexbacktestlab.apk" e per otto release quel file non c'era piu' (dalla v2.0.4-126 le release allegano solo il Setup Windows): ogni tablet finiva su una pagina d'errore GitHub. Nessun test lo vedeva, perche' i test controllavano che il pulsante ci fosse, non che il file esistesse. E il commento nel codice dichiarava il difetto ("oggi risponde 404: il riquadro lo dichiara") mentre il riquadro non lo dichiarava: un commento che descrive una protezione mai scritta e' peggio di nessun commento, perche' mette tranquillo. LA REGOLA: quando una pagina offre un download, o il file e' nel repository insieme alla pagina (e allora c'e' sempre), o lo si verifica prima di offrirlo. L'API delle release dice quali asset esistono: si chiede a quella. E un file di installazione che manca non si "aggiusta" scrivendo "premi qui": si costruisce e si allega.



- Nell'app dentro l'APK un download con l'attributo "download" non SCARICA niente: la WebView di
  Capacitor non mette nessun DownloadListener, e il pacchetto semplicemente non parte. (20 ottobre
  2026, "sul telefono non arriva la nuova versione".) Il meccanismo di aggiornamento era scritto
  e funzionava sul computer: un <a href="..." download> su cui si fa click. Nella WebView
  dell'app Android quel click viene ignorato, e l'utente - che aveva visto comparire il pulsante
  "Aggiorna" - restava con la versione vecchia senza capire perche'. Il collaudo non lo
  vedeva: il test misurava che il click sull'ancora fosse avvenuto, e in Chromium il click
  avviene. LA REGOLA: il comportamento di un download si misura nel DOPPIO ambiente in cui
  vive, non solo in quello in cui si sviluppa. Il trucco che funziona nella WebView e' la
  NAVIGAZIONE verso l'indirizzo esterno: Capacitor apre il browser di sistema (l'host non e'
  fra quelli ammessi dentro l'app), li' il file viene scaricato davvero e Android chiede se
  installarlo. E chi non ha ancora installato non e' aggiornato: per quello il tag della
  release si annota solo DOPO, e il pulsante "Aggiorna" resta premibile.

- Il numero di build nel tag della release non e' un numero di versione. (20 ottobre 2026, stesso
  lavoro.) Il tag e' "v2.0.7-131": il "-131" e' il contatore delle esecuzioni del flusso di
  pubblicazione, non la versione. Confrontato cosi' com'era, "2.0.7-131" sembrava sempre piu'
  nuovo di "2.0.7" e il pulsante "Aggiorna" compariva anche subito dopo l'installazione, su
  ogni dispositivo. LA REGOLA: un numero che si confronta con un altro va ripulito da cio' che
  non e' parte del numero (i prefissi, i suffissi), altrimenti il confronto e' un confronto fra
  due cose diverse. E il confronto delle versioni e' numerico, mai fra stringhe: "2.0.10" e'
  piu' nuovo di "2.0.9".

- Il popup di Firebase non funziona dentro una WebView, e li' muore con un errore che sembra
  un altro problema. (20 ottobre 2026, "l'accesso con Google nell'app mi da errore 400".) Il
  popup di Firebase e' una FINESTRA NUOVA (window.open). Dentro la WebView dell'APK quella
  finestra non viene creata: la pagina di Google si apre al posto dell'app e Firebase,
  trovandosi senza "opener", non sa a chi restituire la credenziale - e risponde 400. Il
  sintomo che si vede ("errore 400", "verifica in due passaggi" che non finisce, "schermata
  bianca al secondo tentativo") sembra un problema di rete, di account o di versione: non lo e'.
  LA REGOLA: una libreria che usa una finestra va provata nell'ambiente in cui vive davvero. Il
  reindirizzamento invece e' una normale navigazione e funziona: la WebView apre Google, l'utente
  fa il login, Firebase richiama l'app (l'indirizzo di ritorno e' la pagina stessa) e li' la
  credenziale viene letta. Nell'APK il giro resta DENTRO l'app solo se gli host della pagina di
  accesso sono fra quelli ammessi (capacitor.config.json, allowNavigation): altrimenti la WebView
  li passa al browser di sistema e il ritorno non arriva piu'.

- Un pulsante che "non funziona" va guardato nel posto dove viene premuto, non dove e' scritto.
  (20 ottobre 2026, stesso lavoro.) Per mesi il codice diceva "su Capacitor il popup, il
  reindirizzamento non funziona" - e il commento sopra diceva esattamente il contrario
  ("su mobile usiamo il reindirizzamento"). Il commento era quello giusto: la riga sotto
  aveva fatto il contrario, e per un motivo che al momento sembrava buono. LA REGOLA: quando un
  commento e il codice si contraddicono, il codice ha sbagliato (o il commento): e in ogni caso
  uno dei due mente. Il rimedio non e' scegliere: e' misurare, e scrivere il motivo accanto
  al codice.

- Un risultato che arriva senza ricaricare la pagina va letto quando arriva, non solo una volta
  all'avvio. (20 ottobre 2026, login con Google nell'APK.) Firebase richiama l'app con la
  credenziale nel FRAGMENTO (https://localhost/login.html#...token...): dentro la WebView il
  fragmento puo' cambiare senza che la pagina si ricarichi, e il codice - che aveva gia' letto
  (e svuotato) il risultato - non lo rileggeva. La credenziale arrivava e nessuno la leggeva.
  LA REGOLA: quando il risultato di un'operazione viaggia in un URL (fragmento, query, deep
  link), la lettura non e' "una volta all'avvio": e' "quando arriva". E se due letture si
  sovrappongono, la seconda non si salta: si rimanda. Il sintomo (l'utente deve riavviare
  l'app perche' "solo cosi' mi fa l'accesso") dice gia' tutto: l'accesso era riuscito, la LETTURA
  no.

- Un numero di versione che sta in tre posti va tenuto allineato, e va controllato sul PACCHETTO.
  (20 ottobre 2026, l'APK che proponeva l'aggiornamento per sempre.) La versione sta in sw.js, in
  installer.iss e nel sw.js dentro l'APK. Se uno dei tre resta indietro, l'app crede di essere
  vecchia e propone l'aggiornamento per sempre - e sembra un difetto della logica di versione.
  LA REGOLA: la versione si verifica dove l'utente la vede, cioe' DENTRO il pacchetto, non
  solo nella cartella da cui e' partito. Un test che confronta i due numeri (e che salta se il
  pacchetto non c'e') e' il modo per non ritrovarselo.

- Il minimo di una scala non e' un numero: e' una richiesta. (20 ottobre 2026, la scala
  dell'interfaccia.) Era stato deciso un tetto del 70% "per non rompere niente", e il
  proprietario su un telefono non ci leggeva niente: serviva il 50, il 20, il 10. LA REGOLA:
  quando si mette un tetto, si chiede perche' quel numero e non un altro; e se non c'e' un
  motivo tecnico (il sotto il 10% non si vede), il tetto si allarga. Un limite messo per
  prudenza, e non chiesto, diventa un muro.

- La copia dei file in un'altra cartella va FATTA DOPO che il contenuto e' finale, e va
  verificata. (20 ottobre 2026, stessa vicenda.) Lo sw.js era stato copiato nell'app mobile
  prima di alzare la versione, e poi non era stato ricopiato: l'APK pubblicato come 2.0.9
  portava dentro la 2.0.8. LA REGOLA: la copia finale si verifica confrontando il file di
  destinazione con quello di partenza (un hash, un numero di versione), non guardandolo.

- Un campo che si applica MENTRE si scrive non si puo' usare. (20 ottobre 2026, la scala
  dell'interfaccia e il testo del grafico.) I due campi erano agganciati all'evento `input`, che
  scatta a ogni tasto: con "50" dentro, un backspace lascia "5", e il "5" veniva applicato,
  schiacciato al tetto minimo e RISCRITTO nel campo. Risultato: dal 50% non si poteva arrivare al
  30%, perche' il numero cambiava sotto le dita a metà. LA REGOLA: un campo numerico con un tetto
  si applica a MODIFICA FINITA (`change`: uscita dal campo o Invio), mai a ogni tasto; e il valore
  svuotato o messo a zero non e' un valore, si rimette quello di prima. Il sintomo da riconoscere
  e' "non mi fa mettere il numero che voglio", che sembra un problema di validazione e invece e'
  il momento in cui si applica.

- Un test che chiama un programma esterno dipende da QUALE programma vince nel PATH. (20 ottobre
  2026, il collaudo della versione dentro l'APK.) Il test leggeva l'APK con `execFileSync('tar',
  ...)`: con il tar di Windows (System32, che e' bsdtar e sa aprire gli zip) passava, con quello
  che installa Git (GNU tar) cadeva due volte - legge `C:\...` come se `C` fosse un computer
  remoto ("Cannot execute remote shell") e comunque non apre gli zip. Stesso file, stesso APK,
  stesso Windows, esito diverso da una sessione all'altra. E' la lezione 9 un passo piu' in la':
  non basta che il test non erediti il sistema operativo, non deve nemmeno ereditare il PATH.
  LA REGOLA: se una libreria del linguaggio puo' fare il lavoro, si usa quella (un APK e' uno zip:
  si legge con `node:zlib` in quaranta righe, ed e' anche cento volte piu' veloce).

- Un livello spostato non si confronta col passato in cui non c'era. (21 ottobre 2026, la posizione
  chiusa a un prezzo che il mercato non aveva toccato.) La riscansione dello storico confrontava lo
  stop di ADESSO con tutte le candele dall'apertura in poi: uno stop portato a pareggio trovava il
  massimo di tre ore prima e chiudeva. LA REGOLA: quando un valore puo' cambiare nel tempo, ogni
  confronto col passato deve sapere DA QUANDO quel valore vale; se non lo si sa, nel dubbio non si
  fa l'azione irreversibile. Il sintomo da riconoscere e' «succede sempre a una riapertura»: vuol
  dire che a farlo e' qualcosa che gira al ricaricamento, non il tempo reale.
- Il prezzo che vedi non e' il prezzo che esegue. (21 ottobre 2026, stessa vicenda, parte MT5.) Lo
  stop di una SELL scatta sull'ASK, i grafici disegnano il BID, e alla pausa giornaliera lo spread
  si apre di decine di pip: una chiusura «a un prezzo mai toccato» puo' essere regolarissima. Prima
  di dare la colpa al codice si guarda se il codice poteva anche solo toccare quella posizione: qui
  non poteva, le posizioni reali sono escluse da entrambe le funzioni che chiudono.

- Il prezzo che vedi non e' il prezzo che esegue, e la differenza si apre proprio quando fa male.
  (21 ottobre 2026, il rollover di EURCHF.) I grafici disegnano il BID; lo stop di una VENDITA si
  esegue sull'ASK. Al cambio giornata lo spread passa da 0,2 a 50 pip - misurati sui tick veri - e
  una posizione viene chiusa a un prezzo che il grafico non mostra MAI, anzi mentre il grafico va
  nella direzione opposta. LA REGOLA: ovunque si confronti un livello con un prezzo (stop, target,
  avvisi, simulazione) bisogna sapere QUALE lato della forbice conta; e un numero come "quanto si
  apre lo spread" si MISURA dai dati che passano gia' davanti, non si stima a mente. Il sintomo da
  riconoscere e' "chiuso a un prezzo dove il mercato non e' mai andato".

- Uno stop al pareggio esatto puo' stare dentro la forbice: il rimedio e' NON PIAZZARLO, non
  spostarlo. (21 ottobre 2026 - e questa lezione e' stata scritta sbagliata e corretta nella
  stessa giornata, quindi vale il doppio.)
  Il fatto: due SELL EURCHF aperte a 0,92828 avevano lo stop a 0,92827 (un decimo di pip), messo
  li' dal pareggio, e il rollover le ha prese quando lo spread si e' aperto a 50 pip.
  PRIMA VERSIONE DI QUESTA LEZIONE, SBAGLIATA: "un livello di protezione va messo FUORI dal rumore
  che lo circonda" - e quindi al pareggio era stato aggiunto un margine pari allo spread. Il
  proprietario ha misurato il risultato: «sposta le posizioni a break-even, ma perdono ugualmente
  meno 2 euro».
  LA REGOLA VERA: quando una protezione costa, NON si fa pagare al nome della cosa che protegge.
  Il margine era una risposta giusta alla domanda sbagliata - non "come allontano lo stop dalla
  forbice", ma "quando NON si deve piazzare quello stop". La seconda si risolve senza togliere un
  centesimo a nessuno: il prezzo resta esatto (netto 0,00) e chi lo piazza si RIFIUTA quando
  cadrebbe dentro la forbice, lasciando al suo posto lo stop di prima, che e' piu' lontano.
  COROLLARIO: un pulsante che si chiama "pareggio" e lascia meno due euro non e' una protezione
  con un piccolo costo, e' un'etichetta che mente - e chi la legge decide basandosi su quella.

- Prima di dare la colpa al codice, guardare se il codice poteva anche solo TOCCARE quella cosa.
  (21 ottobre 2026.) La prima diagnosi era un difetto vero, ma non c'entrava con il caso segnalato:
  la posizione era reale su MT5, ed evaluate() e scanHistoricalSlTpTouches() escludono entrambe le
  posizioni con mt5Ticket. Bastava leggere quel filtro per sapere che la causa stava altrove.
  L'ha fatto notare il proprietario, non io: "MT5 dovrebbe essere indipendente dall'applicazione".

- Un test che diventa rosso dopo una correzione VOLUTA non si aggiusta di nascosto.
  (21 ottobre 2026, gruppi_be_chiudi.) Pretendeva lo stop esattamente sull'entrata, cioe' il
  comportamento che si era appena deciso di cambiare. Si aggiorna il numero atteso, si tiene
  l'intento (ogni stop sul pareggio della SUA posizione, non un valore unico per il gruppo) e si
  SCRIVE nel commento perche' e' cambiato: altrimenti fra un mese sembra che qualcuno l'abbia
  piegato per farlo passare.

- Quanti test cadono dopo una modifica dice quanto quella parte era coperta. (21 ottobre 2026.)
  Modellare lo spread sull'uscita delle vendite ha fatto cadere UN solo test: segno che la
  valutazione degli stop sulle vendite era quasi scoperta - proprio il lato che aveva fatto perdere
  i soldi. Un collaudo che non si accorge di un cambiamento del genere non sta proteggendo quella
  parte: e' un'informazione da leggere, non un sollievo.

- Una protezione messa su una sola delle strade fa credere di essere protetti su tutte.
  (21 ottobre 2026, il pareggio.) Al pareggio una posizione ci arriva da quattro parti: il pulsante
  della tabella delle posizioni, il pulsante BE della tabella MT5, la strategia della sala
  all'avvicinamento al target e la regola "stop all'entrata" al raggiungimento di un TP. Metterci
  il controllo solo sulla prima avrebbe lasciato il difetto vivo nelle altre tre. Si cercano TUTTI
  i punti che fanno la stessa cosa (qui: tutte le chiamate a mt5PrezzoPareggio) prima di dichiarare
  chiusa una correzione.

- Quando un dato non c'e', si dichiara il limite invece di inventare il numero.
  (21 ottobre 2026, il pareggio su Kraken.) Lo stop a pareggio su Kraken va sul prezzo d'entrata e
  basta: la commissione dello scambio non arriva all'app posizione per posizione, il ponte da' solo
  il totale del conto. Stimarla avrebbe prodotto un altro "pareggio" che non pareggia. Scritto
  nella conferma: "lo stop va sul PREZZO DI ENTRATA, la commissione dello scambio non e' compresa".
  Un limite dichiarato e' utilizzabile; un limite nascosto dietro una parola rassicurante no.

- Un test che misura la finestra «come viene fuori dal banco» misura una situazione che sul
  dispositivo vero non esiste. (21 ottobre 2026, i pulsanti dentro il grafico.) Il banco diceva
  ZERO sovrapposizioni fra i gruppi flottanti, e il proprietario le vedeva: nel banco meta' di
  quei gruppi e' NASCOSTA (barra del replay, legenda degli indicatori, barra degli strumenti), e
  qtAutoLayout si scansava da due su sei. La misura va fatta nella condizione del difetto - i
  gruppi accesi, la scala al 130% - non in quella comoda.

- Un numero scritto a mano in un layout vale finche' quello che gli sta sopra non cresce.
  (21 ottobre 2026, capitolo del telefono.) Tre nello stesso punto, tutti con la stessa forma di
  errore: `top:46px` per la seconda riga di pulsanti (giusto se la prima sta su UNA riga: sul
  telefono va a capo e diventa alta 86), `top:86px` per la legenda degli indicatori, e un elenco
  fisso di due gruppi da cui scansarsi su sei esistenti. Si misura e si impila, non si indovina.

- Una scala applicata con `zoom` moltiplica le misure DOPO che il CSS le ha calcolate, e nessuna
  regola CSS la puo' leggere. (21 ottobre 2026, i popup fuori dallo schermo.) `max-height:88vh`
  con lo zoom al 130% diventa il 114% dello schermo: 812 x 0,88 x 1,3 = 929, cioe' i 117 px di
  sforo misurati. La scala va DICHIARATA al CSS (una variabile, qui --fblZoom) e i limiti devono
  dividerci. Corollario: una regola che annulla un limite (`max-width:none`) "perche' tanto ci
  pensa il contenitore" lascia crescere il riquadro appena un figlio ha una larghezza minima
  propria.

- Una riga che scorre, su un telefono, non si vede che scorre. (21 ottobre 2026.) Le schede delle
  impostazioni sforavano di 109 px senza scorrimento: quelle oltre il bordo erano IRRAGGIUNGIBILI.
  Ma la cura non e' aggiungere lo scorrimento: e' far stare le cose. Vanno a capo le schede, e la
  riga di comandi del grafico ci sta perche' il pulsante piu' largo perde la scritta e resta
  l'icona (388 px -> 275, in 293 disponibili). Lo scorrimento resta solo come valvola.

- Una modifica «di buon senso» che non si misura e' una scommessa. (21 ottobre 2026.) Annullare
  tutte le larghezze minime dentro i popup (`min-width:0`) sembrava la pulizia giusta: ha portato
  gli sfori da 0 a 3 sullo schermo da 375 px. Misurato e rimesso indietro nello stesso giro.

- Quando due cose non ci stanno nello stesso posto, quale cede NON si deduce dal codice: si chiede.
  (21 ottobre 2026, la barra delle operazioni sul telefono.) 360 px di barra in 309 px di grafico:
  una delle due deve lasciare il bordo alto. Misurare dice che il conflitto esiste e quanto vale;
  dire chi vince e' del proprietario, e ha scelto la barra in cima con i pulsanti a icone.

- Un elenco vuoto non e' un dato cancellato. (21 ottobre 2026, le credenziali.) Il proprietario
  segnalava «all'aggiornamento le credenziali spariscono»: il file CSV era sempre al suo posto, e
  quello che si perdeva a ogni riavvio del browser era il PERMESSO di leggere quella cartella -
  revocato dal browser, impossibile da conservare. Prima di credere al sintomo, chiedersi cosa
  esattamente e' andato perso: una perdita di dati si ripara reinserendo, un permesso con un clic,
  e dirlo all'utente vale piu' di qualunque correzione.

- Un ramo di uscita anticipata dentro un test lo rende verde anche quando la correzione non c'e'.
  (21 ottobre 2026, cartella_credenziali.) Due test uscivano subito se il browser non sapeva
  collegare una cartella (`if(!supportsFS)return`). Controllato nel banco che supportsFS sia true,
  cioe' che quel ramo NON scatti: senza quella verifica erano due verdi sul vuoto.

- Quando l'utente segnala un difetto GIA' CORRETTO, la domanda giusta non e' «dove ho sbagliato
  la correzione» ma «quale versione sta usando». (21 ottobre 2026.) Tre volte di fila la risposta
  era quella - conferma unica delle chiusure, riquadro di caricamento, break-even negativo: tutte
  gia' pubblicate, tutte descritte fedelmente com'erano nella v2.0.12 che lui aveva in mano. La
  quarta volta ha smesso di essere una coincidenza ed e' diventata la causa da cercare: il canale
  di aggiornamento era rotto (il ponte serviva app.html congelato dentro l'eseguibile) e teneva
  nascosto tutto il lavoro fatto. UN DIFETTO CHE BLOCCA LA CONSEGNA VALE PIU' DI DIECI DIFETTI NEL
  PRODOTTO. Come si verifica, invece di discutere: `git show <tag>:app.html | grep <la correzione>`.

- Un aggiornatore che sbaglia e' peggio di nessun aggiornatore. (21 ottobre 2026.) Tre regole, e
  ognuna nasce da un modo concreto di fare danno: LA COPPIA O NIENTE (app.html e sw.js insieme,
  altrimenti un'app nuova dichiara una versione vecchia e il pulsante Aggiorna non si spegne piu');
  MAI INDIETRO (una cache di un proxy non deve retrocedere l'app di chi la sta usando); SI
  CONTROLLA CHE SIA DAVVERO L'APP (su GitHub Pages una pagina 404 arriva con HTTP 200).

- Prima di correggere quello che l'utente vede nel Gestione attivita', guardare i NUMERI che ha
  mandato. (21 ottobre 2026.) «Due processi Mt5FeedServer, penso che il lag derivi da questo»: 72 K
  + 93.820 K. Un processo da 72 K non fa lavoro - e' l'avviatore di PyInstaller in modalita'
  onefile, che mostra sempre due processi per programma. Sospetto chiuso senza scrivere una riga.
  (Il doppione VERO era un altro, e si evita chiedendo alla porta se qualcuno risponde gia'.)

- Un bersaglio SOTTILE E MIRATO si prende il clic; un RIEMPIMENTO LARGO no. (21 ottobre 2026, tre
  difetti con una causa sola.) La casella Target/Stop e' un rettangolo che va dall'entrata fino ad
  adesso: dandole la precedenza su tutta la sua area si uccidevano, in silenzio e su mezzo grafico,
  sia la deselezione sia il cambio stile del footprint. Una linea TP/SL, una freccia, un disegno,
  una candela sono bersagli che si prendono di proposito: quelli vincono.

- La tolleranza di un tocco col dito non e' quella di un clic col mouse. (21 ottobre 2026.) Dieci
  pixel di scivolamento annullavano il cambio stile sul telefono, senza dire niente: la soglia di
  sistema su Android e' 8dp, che su uno schermo moderno fa 16-24 px reali. E un tocco dura di piu'
  di un clic. Dove non c'e' un'azione legata alla pressione lunga, allargare la finestra non toglie
  niente a nessuno.

- Un numero che non torna con quello che si vede davanti e' un numero sbagliato. (21 ottobre 2026,
  sera.) Contando da riga di comando i backslash rimasti in app.html mi sono tornati 176, poi 378,
  poi 71: numeri che avrebbero giustificato una sostituzione di massa, cioe' esattamente l'errore
  che stavo riparando. Erano tutti falsi - la shell mangiava i backslash prima che arrivassero a
  Python, e stavo contando APOSTROFI. L'ho capito perche' gli esempi stampati accanto ai numeri non
  avevano nessun backslash. Rifatta la misura da FILE (dove la shell non c'entra): 31 casi veri, e
  521 escape legittimi dentro stringhe JS che toglierli avrebbe rotto l'app.

- Una sostituzione di massa deve sapere distinguere dove un carattere e' SINTASSI e dove e' TESTO.
  (21 ottobre 2026.) Uno script del 19 ottobre trasformava `l'app` in `l'app` ovunque, commenti e
  attributi HTML compresi (dove il backslash non e' un escape: si legge), e in piu' avanzava di 4
  caratteri invece di 5, riscrivendo l'ultima lettera: 165 parole storpiate in «appp», alcune
  visibili all'utente. La riparazione ha dovuto fare la distinzione che lo script non faceva.

- Il disordine non e' mai solo disordine. (21 ottobre 2026.) La lamentela del proprietario era sui
  cinquanta file lasciati sul Desktop; cercando chi li aveva scritti e' saltato fuori che uno di
  loro aveva storpiato 165 parole dentro app.html, e nessun test se ne era accorto.

- Una correzione che passa i test vecchi non e' fortunata: e' FINITA. (21 ottobre 2026, notte.)
  Sul robot di Syntra tre tentativi su quattro erano sbagliati, e nessuno dei tre l'ho trovato
  rileggendo il codice: li ha fermati il banco di prova, ognuno con un test scritto mesi fa per un
  motivo diverso - il canale che non si apriva, il traffico inutile verso 127.0.0.1 su un telefono
  (server_oracle: «nessuna chiamata al PC»), la sonda del ponte buttata via quando invece serve a
  distinguere computer e telefono (due_ponti_segnali). Tutte e tre sarebbero arrivate all'utente
  senza fare danni evidenti SUBITO.

- Quando un test vecchio diventa rosso, la prima domanda non e' «come lo aggiorno» ma «HA RAGIONE
  LUI?». (21 ottobre 2026.) Stasera aveva ragione tre volte su quattro. La quarta
  (caricamento_asset, che pretendeva lo 0% di avanzamento) codificava esattamente il difetto da
  correggere, e andava aggiornato - scrivendo nel test PERCHE' la regola e' cambiata.

- Due segnali in OR battono un segnale solo, quando ognuno copre un caso che l'altro sbaglia.
  (21 ottobre 2026, Syntra.) Il ponte locale vivo DIMOSTRA che si e' su un computer, ma non c'e'
  sempre; la volonta' dell'utente copre il caso in cui il ponte e' spento. Pretendere la sonda era
  il difetto, ignorarla l'eccesso opposto.

- Una linea che non finisce non racconta niente. (21 ottobre 2026.) La linea di entrata dei segnali
  arrivava al bordo della vista invece che alla fine dell'operazione: con molti segnali sullo
  stesso asset il grafico diventava una ragnatela bianca. Ma la cura NON deve accorciare le
  operazioni ancora vive - e' il caso di controllo che tiene onesta la correzione.

- Una barra di avanzamento ferma a zero sembra un programma bloccato; una ferma a cento dice una
  cosa falsa. (21 ottobre 2026.) Mai zero mentre qualcosa succede, mai cento DENTRO un passo, ma
  cento esatto quando i passi sono finiti davvero.

- Un indizio dell'utente puo' valere piu' di un profilatore. (22 ottobre 2026.) «La velocita' della
  pagina accelera veramente tanto quando i mercati sono chiusi» non era un'impressione: era una
  misura, e indicava il punto esatto. A mercato aperto ogni prezzo buttava le cache dell'aggregazione
  (confrontano il RIFERIMENTO dell'array, e il percorso Live ne crea uno nuovo a ogni tick): 58 ms
  di blocco per ogni singolo prezzo su 200.000 candele, diventati 2,11. Quando l'utente dice
  «succede QUANDO...», quella e' la variabile da isolare.

- La voce piu' cara di un giro non e' quasi mai quella che si sospetta. (22 ottobre 2026.) Cercando
  il costo per tick sospettavo la copia dell'array: 0,69 ms. Era invece la RETE DI SICUREZZA che
  riconvalidava tutte le 200.000 date a ogni prezzo: 17,57 ms. Si misura la ripartizione, non si
  ottimizza il sospettato.

- Uno strumento di misura deve rimettere a posto tutto quello che tocca. (22 ottobre 2026.) Se
  restassero avvolti setTimeout, draw, update e i pezzi del disegno, ogni disegno pagherebbe per
  sempre il costo della misura: il rallentamento peggiorerebbe PROPRIO dopo averlo misurato. C'e'
  un test che lo tiene fermo, ed elenca anche i pezzi.

- Due salvataggi identici su Firestore costano come due diversi. (22 ottobre 2026.) Si paga a
  scrittura e a byte: confrontare una firma del contenuto con quella dell'ultima scrittura RIUSCITA
  toglie lo spreco piu' facile. Due trappole evitate: vale anche per le scritture «forzate» (force
  scavalca il limite di frequenza, non autorizza a pagare due volte), e la firma si aggiorna solo
  DOPO il successo - aggiornarla prima vorrebbe dire credere di aver salvato, cioe' un risparmio
  pagato coi dati.

- Prima di spostare pezzi di interfaccia, contare gli id duplicati. (22 ottobre 2026.) Nel markup
  ce n'erano NOVE, quasi tutti nella zona da riorganizzare: getElementById prende il primo, quindi
  meta' di quei controlli era gia' morta senza che nessuno se ne fosse accorto. Spostando il primo
  si «accende» il secondo, e il comportamento cambia in modo inspiegabile.
  **E si contano sul DOM VIVO, non sul testo del file.** (22 ottobre 2026, stessa giornata.) Nel
  testo del sorgente ne sembrano TREDICI: cinque pero' non esistono - uno sta dentro un commento,
  tre dentro stringhe JavaScript, e uno viene creato a runtime sostituendo il primo (il codice
  rimpiazza tutto il contenuto del contenitore, quindi ne resta uno solo). Nel DOM vero i
  duplicati erano OTTO, tutti `x2`. Un conto fatto sul testo sbaglia: fa perdere tempo a cercare
  duplicati che non ci sono, e fa sfuggire quelli che ci sono. La regola quando si trova un
  duplicato: **si tiene il PRIMO e si butta il SECONDO** (il primo e' quello che `getElementById`
  restituisce, e quindi quello che il codice usa davvero). Con un test che conta sul DOM: tre
  righe, e protegge per sempre.

- Due numerazioni diverse non si confrontano a numeri. (22 ottobre 2026.) Il pannello diceva
  «Versione installata: 167 - Ultima pubblicata: v2.0.19 (sei all'ultima versione)»: 167 e' la
  VECCHIA numerazione (un contatore), 2.0.19 la nuova, e a numeri 167 batte 2 al primo pezzo.
  L'app concludeva che l'installata fosse piu' nuova della pubblicata. Lo stesso confronto aveva
  un SECONDO mestiere che nessuno guardava - scegliere quale cache del service worker e' la piu'
  recente - e sceglieva la vecchia: ecco perche' l'app servita restava indietro MENTRE il pannello
  dichiarava di essere aggiornata. Un difetto solo, due sintomi, e il secondo spiegava il primo.

- Quando una cosa funziona su un dispositivo e non sull'altro, la differenza E' la causa.
  (22 ottobre 2026.) «Sui dispositivi mobili funziona bene, solo per il PC non funzionava»: sul
  telefono l'app arriva dal sito o dall'APK e il service worker si aggiorna normalmente; sul
  computer la serve il PONTE, e un ponte anteriore alla v2.0.15 serve l'sw.js CONGELATO
  nell'eseguibile - che non cambia mai, quindi il browser non vede nessun aggiornamento, per
  sempre. La frase del proprietario conteneva gia' la risposta.

- Dire «c'e' una versione nuova» non basta se premere Aggiorna non serve a niente. (22 ottobre
  2026.) Quando e' il ponte a servire una copia congelata, il pulsante non puo' funzionare: il
  pannello deve dire CHE COSA sta succedendo e che serve il Setup. Un messaggio giusto ma inutile
  fa perdere piu' tempo di un messaggio assente.
- Una porta nuova per interrogare il ponte e' una porta che nessuno conosce. (22 ottobre 2026.)
  Per decidere se il pacchetto di installazione serviva, ho scritto una sonda con una `fetch`
  sua (3 secondi, AbortController). Il test di prima, `versione_due_numerazioni`, e' diventato
  rosso: mockava `fetchMt5WithTimeout`, non `fetch`. La sonda e' passata dalla STESSA porta di
  sempre (`fetchMt5WithTimeout('/health')`) e il test e' tornato verde senza toccarlo. Quando
  serve una domanda nuova al ponte, si passa dalla porta che c'e': i test di prima devono
  continuare a poter parlare con lui, e il tempo di attesa deve restare quello gia' pensato
  (su localhost un servizio spento rifiuta la connessione all'istante: il timeout e' solo un
  soffitto, non un'attesa).

- Un pulsante che scarica una cosa inutile non e' un pulsante, e' un distributore di file. (22
  ottobre 2026.) «30-40 file nella cartella Download invece di uno sostituito»: ogni release
  pubblicata scaricava un Setup, e ogni Setup era un file in piu'. Il nome con il suffisso
  `(1)`, `(2)` lo mette il BROWSER (una pagina web non puo' sostituire un file nella cartella
  dell'utente), ma il file lo scaricavano NOI, e lo scaricavamo anche quando non serviva a
  niente: il programma installato gia' sapeva aggiornarsi da solo. Prima di litigare con il
  nome del file, bisogna chiedersi se il file serve.

- Il prodotto spesso sa gia' la risposta: e' il prodotto che non se la chiede. (22 ottobre 2026.)
  Il ponte dichiarava gia' in `/health` quale copia dell'app stava servendo (`app.da`): se e'
  una copia aggiornata, il Setup non avrebbe portato niente. La domanda esisteva, la risposta
  era gia' li', e noi scaricavamo lo stesso. Il costo piu' grosso non e' stato scrivere la
  funzione: e' stato accorgersi che la domanda si poteva fare.

- Un test che non puo' diventare rosso non e' un test, e' una rassicurazione. (22 ottobre 2026.)
  Il primo test del taglio del registro tick faceva il taglio PRIMA di qualsiasi salvataggio,
  quando lo stato dei blocchi non esiste ancora: togliendo apposta la riga che tiene allineati i
  blocchi, il test restava VERDE. Il caso vero era il secondo taglio, con il registro gia' sul
  disco. La prova di controllo non e' una formalita': e' l'unica cosa che distingue un test che
  guarda da un test che passa.

- Si taglia a blocchi interi, o i blocchi non sono piu' blocchi. (22 ottobre 2026.) Lo script
  "quasi pronto" della sessione prima tagliava il registro un tick alla volta: il log si sposta di
  uno, i blocchi pieni restano della stessa lunghezza, il confronto dice "gia' scritto" e sul
  disco restano blocchi stalati - e il blocco in coda non viene mai scritto. Con una struttura a
  blocchi numerati, ogni accorciamento dalla testa deve buttare via un blocco INTERO e rinumerare
  di uno: mezze misure producono dati che sembrano giusti e non lo sono.

- Uno strumento di misura che resta attaccato diventa la causa del rallentamento successivo. (22
  ottobre 2026.) I 23 cronometri dentro `draw()` costano quasi niente, ma ventitré letture
  dell'orologio a ogni fotogramma sono comunque un costo che non serve a nessuno fuori dalla
  misura: si accendono nella misura e si spengono alla fine, e c'e' un test che controlla che da
  spenti non accumulino niente.

- La prima misura smentisce il sospetto, ed e' per questo che si misura. (22 ottobre 2026.) Due
  volte su due: il disegno lento non era colpa del salvataggio del footprint (3,4% fra tutti i
  pezzi cronometrati) ed era invece nel CORPO di `draw()` (96,6%); e il costo non stava in una
  funzione da ottimizzare ma in 2.100 righe senza cronometri. Il lavoro utile non e' ottimizzare:
  e' mettere il cronometro nel punto giusto e rifare la misura.

- Una finestra aperta su una pagina vuota mostra la barra del browser, non quella dell'app. (22
  ottobre 2026.) La finestra "PIP" era un `window.open('')` su una pagina VUOTA: percio' il
  browser la mostrava come un sito qualsiasi, con "about:blank" in alto e senza logo. Non era un
  difetto di stile: era una pagina web. La domanda da porsi non e' "come nascondo la barra", ma
  "sto aprendo una pagina o sto aprendo l'app?" - e la risposta e' cambiata con la Document
  Picture-in-Picture nativa, che contiene lo STESSO documento (misurato: 0 script e un solo
  canvas dentro, cioe' un solo cervello e nessun doppio ordine).

- Uno zoom che viaggia col nodo e' uno zoom che nessuno misura. (22 ottobre 2026.) Il contro-zoom
  della scala UI sta sul `#chartWrap` e lo segue quando il grafico si sposta in un'altra
  finestra, dove il body invece NON e' zoomato: il grafico si rimpiccioliva (misurato: 950 px
  di layout contro 730 px a schermo) e il puntatore finiva 78 px a sinistra e 55 px in alto. La
  regola che resta: **quello che disegni dev'essere quello che si vede** (`clientWidth ==
  rect.width`), e va tenuta in un test, perche' nessuno la guarda a occhio.

- Una colonna che manca sposta tutte le altre. (22 ottobre 2026.) La riga del gruppo delle
  posizioni non aveva la striscia di vicinanza, e percio' aveva 14 celle invece di 15: tutte le
  colonne della riga erano spostate a sinistra. Il sintomo che il proprietario aveva descritto
  ("i cartellini mancano") era la conseguenza, non la causa: quando una tabella e' disallineata,
  la domanda giusta non e' "che colore deve avere questa cella", ma "quante colonne ci sono".
- Un metro confrontato con se stesso non misura niente. (22 ottobre 2026.) Il fermo di una
  posizione non si mette se cade dentro la forbice del cambio giornata; il margine di chiusura
  E' quella forbice; quindi il fermo col margine non era mai "troppo vicino" e il margine non
  sarebbe mai scattato. Il difetto non era nel numero del margine, era nel metro: due cose
  uguali non si possono confrontare per capire se una e' abbastanza lontana. Il metro giusto
  era lo spread ORDINARIO (lo stop non deve essere preso dal primo allargamento), mentre per il
  pareggio esatto resta la forbice.

- Lo stato che si aggiorna prima del conto e' una bugia. (22 ottobre 2026.) Il giro del pareggio
  scriveva lo stop nel campo locale PRIMA di sapere se il ponte lo avesse accettato: se il
  broker rifiutava, l'app mostrava uno stop che sul conto non c'era. E il tentativo non era
  tracciato, quindi il giro successivo riprovava due secondi dopo, per sempre. Ora lo stato
  cambia solo se il conto ha preso lo stop, e il tentativo (anche quello fallito) fa scadere
  cinque minuti prima di riprovare.

- Un tentativo senza tempo e' un tentativo ogni due secondi. (22 ottobre 2026.) Tracciare
  l'ultimo tentativo serve a una cosa sola: dire al giro dopo "hai gia' provato, aspetta", e per
  dirlo serve il tempo iniettato. Senza tempo iniettato il test non puo' provare niente, e per
  farlo passare si finisce col premere i tasti dell'app all'ora giusta.

- Un prezzo che viene da una somma in virgola mobile non e' un prezzo. (22 ottobre 2026.)
  1,08500 + 0,00500 fa 1,0899999999999999: uno stop cosi' non e' un prezzo che il broker possa
  accettare. Le somme vanno arrotondate alla griglia del prezzo dello strumento, come gia'
  faceva il pareggio esatto.

- Un'ancora e' precisa solo nella scala in cui l'hai presa. (23 ottobre 2026.) Le punte dei
  disegni giacciono su un istante che, nel TF in cui sono state disegnate, era l'apertura di una
  candela; ad altra aggregazione (5m/15m/1H) l'istante resta reale MA non e' piu' apertura di
  nessuna candela, e la punta slitta fino a quasi una candela. Ogni volta che una scala cambia
  (timeframe, aggregazione, risoluzione) cio' che e' ancorato va riagganciato alla candela piu'
  vicina DELLA NUOVA scala: non basta che il tempo sia "vero", deve restare agganciato al
  contenitore.

- Un dato messo nel sacchetto unico si sposta con chi lo porta. (23 ottobre 2026.) Lo zoom
  viaggiava nel pacchetto di sessione che va anche al cloud: si muoveva da una macchina
  all'altra senza che nessuno l'avesse deciso. Quando si raccoglie uno "stato", ogni campo va
  deciso esplicitamente: o e' della SESSIONE (deve viaggiare) o e' del DISPOSITIVO (qui un
  localStorage separato, e lontano dal pacchetto). Il punto unico di passaggio
  (`trimTradesForCloudBudget`: e' lui l'UNICO che scrive in cloud, report e keepalive) e' il
  posto giusto dove applicare la regola, e clonando: un oggetto che prepari per l'invio NON deve
  cancellare i campi dell'originale che resta in memoria.

- Un'interruzione puo' riporre i file a meta' capitolo: il commit va verificato, non presunto.
  (23 ottobre 2026.) A capitolo zoom finito (patch, test verdi 3/3, commit dato per buono da
  almeno 20 secondi) un ripristino del checkpoint della conversazione ha riportato i file a meta'
  capitolo: app.html con la patch, il commit sparito (neppure nel reflog), il test cancellato e
  pure metà dei file d'aiuto in Temp. Il collaudo che girava e' uscito verde, perche' misurava
  altro. La regola: dopo ogni interruzione o ripristino, PRIMA di continuare devono essere
  verificate e documentate le condizioni di base (`git log`, `git status`, che il file del test
  ci sia davvero): un commit presunto e' un capitolo chiuso una volta doppia.

- Prima di aggiungere un gesto, misura CHI lo sta prendendo già. (23 ottobre 2026.) Il tocco
  sull'etichetta TP/SL pareva "un click sulla casella": tre proprietari lo contendevano e il
  banco (PointerEvent sintetici + sonda) l'ha mostrato: la pillola sta sulla STESSA altezza
  della linea TP/SL, e il controllo dei livelli (che seleziona senza aprire le statistiche)
  la mangiava; la casella LARGA invece era il "vuoto" che deseleziona, richiesta vecchia e
  ancora valida. La cura non è raccogliere il gesto in un solo posto: è scegliere il
  BERSAGLIO STRETTO (l'etichetta, che seleziona e apre le statistiche) e lasciare il
  RETTANGOLO LARGO alla regola del vuoto. Appendice strumentale: la soglia "è stato un
  trascinamento?" va misurata con `chartDownXY` (impostata a OGNI pointerdown) e NON con
  `panStartX`: i rami che armano un trascinamento (linee, livelli) ritornano PRIMA di armare
  il pan, e al loro rilascio `panStartX` vale ancora il gesto precedente — direbbe
  "trascinamento" a un click fermo.


- In replay il ramo «reale» va bloccato ALL'INGRESSO della funzione, non solo dentro il
  bridge: altrimenti il guard del bridge (che ritorna false) lascia la funzione chiamante
  senza posizione, e l'apertura simulata non avviene. Il controllo giusto è «se in replay,
  vai direttamente al ramo simulato». (25 ottobre 2026, commit 98e7937.)
- Un flag booleano (`historical`) su una posizione deve essere propagato in TUTTI i punti di
  `positions.push` (apertura manuale, pendente attivato, segnale Capital.com, attivazione in
  background), altrimenti i trade "storici" sfuggono ai filtri di statistiche/equity. (25
  ottobre 2026, revisore.)
- Quando una posizione non pusha un punto equity (posizione storica), `removeTradeRecordAt`
  deve ricomputare l'indice solo sulle posizioni che hanno un punto: mescolare i due insiemi
  desincronizza l'equity curve. (25 ottobre 2026, revisore.)
- Su mobile (Capacitor WebView) la File System Access API non esiste: le credenziali vanno
  persistite con un handle virtuale su IndexedDB, non con showDirectoryPicker. (25 ottobre
  2026, commit 7f1d9a3.)
- Un file che contiene emoji NON si riscrive con PowerShell 5.1 senza `-Encoding`:
  `Get-Content -Raw` legge i byte come ANSI, e `Set-Content -Encoding UTF8` risalva un file
  UTF-8 valido con il testo già rovinato ("ðŸ..."). Il danno è silenzioso: nessun errore, e a
  occhio nel sorgente sembra tutto a posto. Si misura contando i mojibake e le emoji vere
  (`\U0001F300-\U0001FAFF`) nel file prodotto — 716 emoji vere e 0 "ðŸ" è la condizione sana.
  (25 ottobre 2026, APK v2.0.27 con tutte le icone rotte.)
- Il test giusto per un difetto di codifica non è "il .bat contiene ancora quella riga": è
  eseguire lo strumento su un campione con emoji e guardare i byte che escono (segnaposto
  sostituito, emoji intatte, CRLF invariati, nessun BOM). Un test che legge il testo dello
  script dimostra che l'hai scritto, non che funziona.
- Un filtro del tipo "se MT5 è collegato, mostra solo le posizioni con `mt5Ticket`" scarta in
  silenzio **tutte** le posizioni simulate: replay e conto Storico non hanno ticket per
  costruzione, quindi spariscono dal grafico E dalla tabella senza nessun errore. Prima di un
  filtro di proprietà va sempre chiesto "questa posizione appartiene a un conto reale?", non
  "ha un ticket?". (26 ottobre 2026, difetto del P/L in replay.)
- In replay il prezzo live "di adesso" è il **futuro** rispetto a ciò che si sta guardando.
  Qualunque funzione che valuti un conto (equity, margine, P/L flottante, "prezzo corrente"
  in tabella) deve usare il prezzo mostrato, non `livePriceByAsset`: mescolarli fa apparire un
  capitale storico da 8.481 € al posto di 10.000 € e sembra un errore di calcolo, mentre è un
  errore di epoca. (26 ottobre 2026.)
- Uno spostamento fatto durante il replay va datato **all'istante del replay**, non a
  `Date.now()`: la memoria dei livelli (`posStoriaSegna` / `posLivelliAlTempo`) rilegge i
  livelli "in forza a quell'istante", e una data nel futuro lascia in vigore il livello vecchio
  — il trascinamento sembra non funzionare. (26 ottobre 2026.)
- Un test che misura il comportamento trova difetti che la segnalazione non nomina: la quarta
  causa di questo bug (livelli che tornavano indietro) è uscita dal test sul trascinamento,
  non dal racconto del proprietario. (26 ottobre 2026.)
- Un conto si isola in TUTTI i punti che lo calcolano, non solo nel numero grande in alto:
  `equityNow`/`freeMargin` (mt5StatsActive), `floatingPL`, `statsTrades`/`closedPL` (win/loss
  rate), `usedMargin`, il Margin Call e la chiusura SL/TP. Correggerne uno solo lascia il conto
  mescolato e il difetto sembra risolto perché il numero che si guarda è giusto. (26 ottobre
  2026, revisione del conto storico in replay: 3 punti su 7 trovati solo così.)
- Un banco di prova che riusa lo stato globale deve azzerare TUTTO quello che conta, non solo
  `positions`: con `trades` non azzerato il caso D misurava il +1.000 lasciato dal caso C
  (11.000 invece di 10.000) e sembrava un difetto del codice. Se un test fallisce solo dopo un
  altro test, il sospetto numero uno è lo stato condiviso. (26 ottobre 2026.)
- Quando una scelta del proprietario è documentata come esplicita ("le posizioni simulate
  continuano a essere gestite in tempo reale in background"), quella scelta vale per il conto a
  cui è stata pensata: una posizione NATA nel replay non può essere chiusa dal prezzo di oggi.
  L'eccezione va scritta accanto alla regola, altrimenti la regola la cancella. (26 ottobre 2026.)


## Lezioni del 26 ottobre 2026 (multi-account, P/L, etichette, disegni)

- **Un filtro che protegge i CONTI va applicato allo STESSO modo alle posizioni aperte e ai
  trade chiusi.** `tradeBelongsToCurrentView()` filtrava per `mt5Login` (conto attivo), ma
  `positionBelongsToCurrentView()` si fermava a `mt5Ticket!=null`: collegato all'account 1 si
  vedevano le posizioni dell'account 2. Quando una regola esiste in due punti, una sola copia è
  sempre la copia sbagliata.
- **"Il P/L del terminale è diverso" vuol dire quasi sempre: manca lo swap (e la commissione).**
  Il terminale somma profit+swap+commissione; l'app che somma solo il profit mostra un numero
  diverso e sembra un errore di calcolo. La differenza si vede subito confrontando i due numeri
  per la STESSA posizione.
- **"L'aggiornamento è lento" va misurato in millisecondi, non a sensazione.** Il polling MT5
  era a 2000 ms: la posizione si aggiornava sì, ma con un ritardo percepito di secondi. Portarlo
  a 1000 ms ha risolto il disagio senza toccare nient'altro.
- **Un comportamento che l'utente può spegnere a mano prima o poi viene spento per sbaglio.** Il
  raggruppamento delle etichette era alternativo a un pulsante: ora è il default e non si può
  disattivare; lo stato temporaneo (gruppo espanso) si ottiene col click sull'etichetta e si
  annulla da sé col click sul vuoto, senza lasciare tracce.
- **Quando un ancoraggio è a TEMPO ASSOLUTO, cambiare scala non deve riscriverlo.** Spostare le
  ancore dei disegni alla candela del timeframe nuovo più vicina le fa slittare di quasi una
  candela intera a ogni cambio; la conversione va fatta al momento del DISEGNO (interpolando il
  timestamp dentro la nuova candela), non riscrivendo il dato salvato.

- **Quando una modifica tocca un comportamento già protetto da un test, il collaudo locale lo prende prima di GitHub.** Spegnere il pulsante "Aggiorna" in tutti i casi ha rotto aggiornamento_apk.test.mjs: nell'APK il pulsante DEVE restare (l'utente installa il pacchetto a mano). La regola è: prima di togliere un comportamento, cercare chi lo misura — il test trovato era la prova che quel comportamento serviva. (26 ottobre 2026.)
- **Due sessioni sullo stesso repository: verificare SEMPRE git log prima di committare.** Il proprietario aveva pushato due commit che modificavano app.html mentre lavoravo localmente: committare la mia copia avrebbe annullato il suo lavoro. Stash + pull --rebase + stash pop ha salvato entrambi, e il diff residuo è risultato pulito. (26 ottobre 2026.)

- **Un flag che protegge i soldi veri va messo in OGNI funzione che parla col bridge, non solo in quella che apre.** Le guardie del replay c'erano in placeRealMt5Order e placeRealMt5PendingOrder, ma mancavano in cinque altre funzioni (chiusura, modifica, spostamento stop, pareggio): bastava una strada dimenticata per toccare il conto reale.Quando il proprietario dice "assolutamente", la difesa a più livelli non è un eccesso. (26 ottobre 2026.)
- **Attenzione al prezzo confrontato con se stesso.** In tgPiano il prezzo scelto veniva scritto in `entry` e poi confrontato con `entry` per decidere se era "diverso dal mercato": sempre falso. La regola è: il valore di riferimento (mercato) va salvato in una variabile PRIMA di sovrascrivere quella che descrive la scelta. (26 ottobre 2026.)
- **`const reale=!!mt5Connected` è un esempio di condizione che sembra completa e non lo è.** Mancava la sessione: in replay e in Storico non si deve aprire nulla di reale, con o senza MT5 collegato. Le condizioni sui soldi vanno scritte in forma positiva e completa: sessionelive && collegato && !replay. (26 ottobre 2026.)

- **Una misura vale più di dieci ipotesi.** Il proprietario ha mandato i numeri del pannello prestazioni e in dieci righe si vedeva tutto: 4,8 fotogrammi al secondo, 276 ms per disegno, e le sezioni che dicevano DOVE stava il tempo (zoneZeroPrint 128 ms, disegniUtente 84 ms, indicatori 46 ms). Senza quei numeri si sarebbe indovinato "il grafico è pesante" e si sarebbe toccato il posto sbagliato. (26 ottobre 2026.)
- **"Si ricalcola tutto a ogni frame" è il difetto prestazionale più comune, e il più facile da non vedere.** La zona zero-print rifaceva 12.000 candele di lavoro per un risultato identico al precedente: la cache va messa li dove il risultato dipende solo dai dati, non dal disegno. (26 ottobre 2026.)
- **Un tetto "per asset" moltiplicato per gli asset aperti diventa un problema di memoria.** 150.000 tick per asset sembravano ragionevoli per UN asset; con 7 asset sono 1.042.311 tick e 1.350 MB. I limiti vanno sempre pensati per il caso peggiore del proprietario, non per quello del negozio. (26 ottobre 2026.)

- **"Il salvataggio si spegne da solo" non e' la stessa cosa di "non si riscrive mai".** La firma anti-doppioni era implementata, ma calcolata su un testo che includeva savedAt:Date.now(): due fotografie identiche avevano firme diverse e si riscrivevano sempre. Un meccanismo di ottimizzazione va testato con un test che PRIMA fallisce e poi passa, non solo letto. (27 ottobre 2026.)
- **Quando si separa un dato (es. trades) dal documento principale, il ripristino deve unire i due — e deve restare retrocompatibile.** Se il documento principale porta ancora il dato (versione vecchia), quello vince; altrimenti si legge dal documento a parte. Mai un cambio secco sui dati di soldi veri. (27 ottobre 2026.)
- **Il keepalive della chiusura pagina fa UNA sola richiesta.** Non si puo' farci passare anche le operazioni nuove: vanno mandate dal sync normale, che gira anche subito prima (sullo stesso pagehide, force=true). (27 ottobre 2026.)

- **Una funzione che accetta sia un valore sia una funzione e' piu' robusta di due firme separate.** (28 ottobre 2026, rendCurva multi-sala.) rendCurva oggi riceve una serie e una strategia applicate a tutti i segnali; per l'aggregazione servono una serie e una strategia per segnale. Invece di cambiare la firma e rompere tutte le chiamate esistenti, la stessa funzione accetta o un valore (costante, come prima) o una funzione (che riceve il segnale). Con valori costanti il comportamento e' identico a prima: e' anche il modo di provare che non si e' rotto niente.

- **Due release con lo stesso numero non arrivano a nessuno.** (29 ottobre 2026, la 2.0.39
  pubblicata due volte.) Io avevo pubblicato `v2.0.39`; poche ore dopo il lavoro di OpenCode e'
  uscito come `v2.0.39-210`, perche' `CACHE_NAME` era rimasto fermo. Risultato: il service
  worker non invalidava niente (la pagina non si rinfrescava) e l'aggiornatore del programma
  rispondeva «il programma e' gia' alla 2.0.39: non c'e' niente da installare». Un rilascio
  intero, verde su GitHub, **irraggiungibile per chi lo deve usare**.
  LA REGOLA: il numero di versione non e' un'etichetta, e' la CHIAVE con cui l'app decide se
  aggiornarsi. Chiunque rilasci alza `CACHE_NAME` - e se due sessioni diverse lavorano sullo
  stesso giorno, la seconda controlla cosa ha gia' pubblicato la prima prima di spingere.

- **Dieci guardie sparse valgono meno di una alla porta.** (29 ottobre 2026, replay e ordini
  MT5.) Il divieto di inviare ordini veri in replay era stato messo in sette funzioni su dieci.
  Le tre scoperte erano probabilmente irraggiungibili - ma «probabilmente» su soldi veri non e'
  una risposta, e soprattutto la prossima funzione che qualcuno aggiunge nasce scoperta.
  Spostato il controllo in `fetchMt5WithTimeout`, da cui passano TUTTE le chiamate al ponte:
  una riga, e copre anche quello che non e' stato ancora scritto. Con la prova di controllo che
  le LETTURE devono continuare a passare, se no si spegne il grafico per difendere gli ordini.

- **«Non pubblicare» non e' un'istruzione che si puo' dare: il rilascio parte da solo.**
  (29 ottobre 2026, la 2.0.40 pubblicata due volte - il giorno dopo la 2.0.39 pubblicata due
  volte.) Avevo scritto nel prompt per OpenCode «NON alzare CACHE_NAME e NON pubblicare
  release». Sbagliato: il flusso «Installer Windows» ha un trigger su `app.html`, quindi
  pubblica comunque. Quell'istruzione non ha evitato la release - ha solo garantito che uscisse
  col numero DUPLICATO, cioe' esattamente l'inciampo che avevo appena finito di documentare.
  LA REGOLA GIUSTA E' L'OPPOSTA: **chi tocca `app.html` alza `CACHE_NAME`**, perche' il
  rilascio avviene che lo si voglia o no. L'unico modo di non pubblicare e' non spingere su
  `main`.
  E la lezione dentro la lezione: prima di vietare un comportamento, guardare se dipende da chi
  lo esegue. Qui non dipendeva.

**Il collaudo rosso non accusa l'ultimo commit: accusa il PRIMO dei rossi.**

  (30 ottobre 2026.) Tre push di fila col Collaudo rosso - 7cf609b, 66b5d6e, 717a7ec - e per un
  giorno ho guardato l'ultimo convinto di essere stato io. Sbagliato: l'ultimo VERDE era
  b208ab4, quindi il rosso nasceva con 7cf609b e gli altri due lo avevano solo ereditato. I log
  dimostravano che i due test caduti erano **byte-identici** in tutti e tre i run: se una sola
  modifica rompesse, il nome e il messaggio sarebbero cambiati fra un run e l'altro.

  LA REGOLA: quando il collaudo e' rosso, la domanda non e' "cosa ho cambiato per ultimo" ma
  "**qual e' l'ultimo commit verde**", e da li' si risale. Confrontare i log dei run rossi: se
  sono identici, la causa sta in un commit solo e antico; se differiscono, il danno e' recente.

  E il conteggio delle righe di un diff non misura una causa: 66b5d6e sembrava il colpevole con
  53k righe cambiate (fine-riga LF/CRLF), ma con `--ignore-cr-at-eol` cambiava **10 righe**, e
  l'unica modifica vera era un filtro. Il sospetto era fondato sul RUMORE del diff, non sulla
  sostanza.

  Corollario, e costa caro: **il proprietario ha chiesto "verifica sempre prima di pubblicare"**.
  Non gli ho dato retta e ho pubblicato tre volte di fila un collaudo rosso. Da adesso: prima di
  ogni push, collaudo completo verde in locale. Senza eccezioni.

**Il nome di una funzione si copia, non si detta.**

  (30 ottobre 2026, e l'ho pagata con un collaudo completo rosso a 13 minuti dalla fine.) Ho
  scritto un test nuovo per la cura dei pacchetti che si accumulano e l'ho pubblicato SENZA
  eseguirlo da solo, perche' "tanto il collaudo completo lo copre". Il collaudo completo l'ha
  eseguito, ed e' caduto con `fblAppQuiGiaAggionata is not defined`.

  La funzione vera si chiama `fblAppQuiGiaAggiornata` - **A-g-g-i-o-r-n-a-t-a**. Io avevo scritto
  "Aggionata", senza la "r" di "Aggiornata". Una lettera. E il messaggio d'errore me l'aveva
  scritta in faccia, nome per nome.

  LE DUE REGOLE, entrambe pagate:

  1. **Un test nuovo si esegue da solo PRIMA di infilarlo in un collaudo completo.** Il collaudo
     completo e' la verifica finale, non il primo tentativo: costa 13 minuti e butta via il giro
     intero per un errore che in 5 secondi si vedeva. Provare il singolo file, poi l'insieme.
  2. **I nomi si copiano dal sorgente, non si riscrivono a memoria.** Quando serve il nome esatto
     di una funzione lo cerco nel file e lo incollo - o estraggo con una regex, come
     `/async function (fblApp\w*Aggiornat\w*)\s*\(`/. Dettarlo vuol dire sbagliarlo, e la
     statistica dice che la cosa piu' probabile e' proprio sbagliarlo.

**Le chiavi di un oggetto si copiano come i nomi delle funzioni - e "sembra giusto" non e' una prova.**

  (30 ottobre 2026, stessa sessione, errore dello stesso tipo del precedente a poche ore di
  distanza: questo e' il segnale che non ho imparato la lezione, l'ho solo letta.) Il test della
  cura ai pacchetti era rosso con "la versione installata e' piu' vecchia di quella remota /
  true !== false", cioe' l'app risultava AGGIORNATA anche con la 2.0.40 contro la 2.0.45.

  La tentazione era dire "il confronto versione e' rotto". Invece i pezzi, misurati uno per uno
  con una prova buttata via dopo, funzionavano tutti: `fblConfrontaVersioni('2.0.45','2.0.40')`
  tornava 1, esatto. Il guasto era nella MIA prova: passavo `{instalata: "2.0.40"}` mentre
  l'oggetto si aspetta `installata` - **"installata" ha due L, io ne avevo scritte una**. Con
  `...setup` la mia chiave diventava un campo di troppo e `installata` restava '2.0.45': il
  test misurava la versione di prima, non quella che credevo di avere messo.

  LA REGOLA, che e' la stessa di prima detta al contrario: **quando una prova fallisce, la prima
  cosa da misurare e' la PROVA, non il codice.** Un test che cade per un suo errore interno
  assomiglia in tutto a un test che cade per un difetto vero - stesso colore, stesso messaggio -
  e la differenza si vede solo misurando i pezzi uno per uno. Se il difetto fosse stato vero, quei
  pezzi avrebbero detto un altro numero.

  E il particolare che avrebbe dovuto farmi insospettire subito: la prova passava con un
  oggetto VUOTO `{}` (quindi coi valori predefiniti) e cadeva con quello pieno. Una cura che
  funziona coi predefiniti e non coi dati veri quasi sempre è una prova costruita male, non un
  programma rotto.

**Il caso piu' semplice possibile, prima del caso reale.**

  (30 ottobre 2026, la quinta volta.) Ho scritto una prova per la cura ai pacchetti che si
  accumulano, e l'ho pubblicata SENZA eseguirla da sola - perche' "tanto il collaudo completo
  lo copre". Il collaudo completo l'ha eseguita, ed e' caduta con "fblAppQuiGiaAggionata is
  not defined".

  La funzione vera si chiama fblAppQuiGiaAggiornata - A-g-g-i-o-r-n-a-t-a. Io avevo scritto
  "Aggionata", senza la "r" di "Aggiornata". Una lettera. E il messaggio d'errore me l'aveva
  scritta in faccia, nome per nome.

  LE DUE REGOLE, entrambe pagate:
  1. Un test nuovo si esegue da solo PRIMA di infilarlo in un collaudo completo. Il collaudo
     completo e' la verifica finale, non il primo tentativo: costa 13 minuti e butta il giro
     per un errore che in 5 secondi si vedeva. Provare il singolo file, poi l'insieme.
  2. I nomi si copiano dal sorgente, non si riscrivono a memoria. Ora li estraggo con una
     regex dal file, come /async function (fblApp\w*Aggiornat\w*)\s*\(/. Dettarli vuol dire
     sbagliarli, e la statistica dice che la cosa piu' probabile e' proprio sbagliarli.

  E il particolare che avrebbe dovuto farmi insospettire subito: la prova passava con un oggetto
  VUOTO {} (quindi coi valori predefiniti) e cadeva con quello pieno. Una cura che funziona
  coi predefiniti e non coi dati veri quasi sempre e' una prova costruita male, non un
  programma rotto.
**Un modulo va ricaricato, non preso per fidato: la cache di Python mente.**

  (30 ottobre 2026, ponte.) Ho scritto tre test per bridge.py che passavano da soli e cadevano
  nel ponte completo. Il motivo: il mio "import bridge" restituiva il modulo GIA' importato da un
  altro file di prova - creato col MT5 finto di quel file, che non aveva order_send. La mia
  monkeypatch.setattr(bridge.mt5, ...) andava in errore su un oggetto che non era il mio.

  LA REGOLA: in una fixture che importa un modulo con delle dipendenze finte, il modulo va
  RICARICATO (importlib.reload), non solo importato. Senza reload il modulo in cache arriva da
  un altro file, con le sue patch, e dir(modulo) vede roba che il sorgente non contiene - e le
  asserzioni misurano lo stato di un altro test invece di quello che dicono.

  E il sintomo che avrebbe dovuto farmi insospettare subito: la prova passava da sola e cadeva
  nell'insieme, con un errore su un attributo che il MIO finto aveva di sicuro. Quando una prova
  si comporta in modo diverso da sola e in compagnia, il problema è quasi sempre lo stato
  condiviso, non la logica.
