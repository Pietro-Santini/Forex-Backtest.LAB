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

