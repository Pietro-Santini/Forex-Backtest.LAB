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
