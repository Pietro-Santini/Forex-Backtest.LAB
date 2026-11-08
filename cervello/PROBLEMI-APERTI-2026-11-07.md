# Problemi aperti da risolvere PRIMA delle migliorie (7 novembre 2026)

Lista fatta col proprietario. Si fa **una cosa per volta**, con misura e test,
e si pubblica solo a collaudo verde. Le migliorie (finestre duplicate) aspettano.

## P0 — MERCATO CHIUSO: QUALE OROLOGIO DECIDE LA CHIUSURA
- Sintomo: «il grafico continua ad avanzare dopo la chiusura; l'ultima candela segna orari
  impossibili — 21:59, poi 22:59, mentre sono le 17» e il badge «Mercato chiuso» non compare.
  Nella finestra duplicata invece ultima candela e badge sono GIUSTI: due pagine, due
  risultati — una gira il codice nuovo, una quello rimasto nella cache.
- Nota del proprietario, già scritta nel cervello del progetto: «MT5 effettivamente va un'ora
  più avanti... mi segna che sono le 17, l'ultima candela su MT5, ma in realtà ora italiana
  sono le 16».
- Ipotesi da verificare (NON ancora curata): `liveSessionPhaseNow()` e `fblMercatoFermoOra()`
  giudicano sull'orologio del DISPOSITIVO (`Date.now()`), mentre MT5 gira sull'orologio del
  servizio, che l'app misura già e tiene in `mt5ScartoOrologioMs` (`mt5Adesso()`). Se i due
  non combaciano, la chiusura viene decisa un'ora fuori.
- FATto: il pannello prestazioni ora riporta il campo `orologio`
  `{dispositivo, mt5, scartoMinuti, fase, fermo, ultimaCandela}`.
- Stato: IN ATTESA DELLA MISURA del proprietario con MT5 collegato.

## P1 — DISEGNO LENTO CON TANTE CANDELE
- Dalla misura: `disegnoMedio_ms 238`, di cui `zoneZeroPrint 183`; `scattoPeggiore 1789 ms`;
  con 50000 candele un profilo volumetrico (`vpfixed`) arriva a 14 ms a fotogramma.
- Stato: DA FARE.

## P1 — AGGIORNAMENTO IN UN CLICK SOLO
- Sintomo: «col primo click ha scaricato app.html, col secondo click ha lanciato il setup.
  Deve fare tutto insieme in un unico click».
- Causa probabile (misurata nel codice, cura NON ancora applicata perche' richiede una
  modifica al piano aggiornamento che và provata con calma): il ripiego conclude «basta
  ricaricare la pagina» quando non riesce a leggere la versione del programma.
- Stato: DA FARE.

## P1 — FINESTRE DUPLICATE: DATI CHE SPARISCONO AL CLIC
- «Clicco sul grafico e mi spariscono candele e indicatori; devo premere torna all'ultima
  candela». CURATO in v2.1.4 (il taglio mercato-chiuso non svuota più il grafico), da
  verificare sul PC.

## P0 — CRASH: il programma crasha da solo, anche restando dentro
- Sintomo: «continua a crashare anche quando sono dentro da un momento all'altro,
  piu' andiamo avanti e piu' crasha».
- **CAUSA TROVATA CON LA MISURA** (pannello prestazioni del proprietario, 7 novembre 2026):
  la pagina era servita dal ponte di QUESTO computer («da questa pagina:
  http://127.0.0.1:8000»), ma la strada degli ordini era 'server' (/pc/8000). Risultato:
  lettura posizioni 1135 volte di cui **1132 non riuscite**, ordini 1131 su 1135, lettura
  conto 50 su 53; tempi fino a 30-40 s a Richiesta persa. La pagina passava il suo tempo
  ad aspettare risposte che non arrivavano.
- CURA (v2.1.3): se l'indirizzo della pagina e' il computer stesso, gli ordini stanno in
  locale, scelto senza indagini; e dopo tre letture fallite il polling si allenta.
- Stato: CURATO in v2.1.3, DA VERIFICARE sul PC (rileggere il pannello prestazioni:
  `lettura posizioni ... 0 non riuscite`).

## P0 — DISEGNO LENTO: UN SOLO PROFILO VOLUMETRICO COSTA 86 ms A FOTOGRAMMA
- Dalla stessa misura: `disegni 9`, `disegnoMedio_ms 113`, di cui `disegniUtente 86` e
  `disegno:vpfixed 86`. Con 95347 candele e 271199 tick il profilo volumetrico si rifa
  troppo spesso: e' quello che fa "scattare" il grafico (`scatti 9`, `scattoPeggiore 141 ms`).
- Stato: DA FARE.

## P0 — AGGIORNAMENTO: il pulsante non compare e la versione si aggiorna da sola
- Sintomo: «ero sulla 2.0.99, entro, non mi mostra il pulsante aggiorna, chiudo e
  riapro, crash ripetuti, poi mi ritrovo sulla 2.1.1 senza aver toccato nulla e
  senza che mi abbia installato i pacchetti».
- MISURATO sul PC: il ponte serviva `app_aggiornata\app.html` congelato dalla
  **v2.1.1** (marcatori `_applicaRimanente`, `const end0=` trovati nel file).
  Il bridge aveva quindi la COPIA WEB nuova mentre gli .exe erano quelli vecchi:
  web aggiornato dal service worker / rotta /aggiorna-app, programma MAI reinstallato.
- Conseguenze: il bug del mercato chiuso «torna» perche' la pagina nuova gira sopra
  un ponte vecchio, e l'app sembra aggiornata senza esserlo (proprio il sintomo
  «finta che gli fa credere di essere aggiornato»).
- Da fare: la versione MOSTRATA deve essere quella del PROGRAMMA installato, non
  quella della copia web; il piano aggiornamento va deciso su quella; quando web e
  programma non combaciano, il pulsante DEVE comparire (anche se il tag visto e'
  gia' quello nuovo).
- Stato: DA FARE.

## P0 — MERCATO CHIUSO: l'asse arriva a «adesso» invece di fermarsi alle 22:00
- Sintomo: «mi mostra l'orario di adesso mentre il mercato si e' chiuso ieri alle
  22:00» / «l'ultima candela inserita mi segna le 19:29».
- Nota: e' un problema GIA' successo e poi risolto (v2.0.99 tolse «il tempo e'
  infinito»). Con la pagina v2.1.1 servita sopra un ponte vecchio il sintomo e'
  tornato: la cura va rifatta e resa stabile.
- Stato: FATTO in v2.1.2 (congelamento solo in auto-segui). Da ricontrollare sul PC.

## P1 — REGRESSIONE MIA (v2.1.0): bloccavo lo spostamento orizzontale
- Sintomo: «il grafico mi si sposta solo in verticale ma non in orizzontale».
- CAUSA: congelavo `end` sempre a mercato chiuso, anche durante pan/zoom manuale.
  Di sabato (chiuso tutto il giorno) non si poteva piu' scorrere la cronologia.
- CURA: congelamento solo se `followLatest` (auto-segui): ciucci si sposta il
  grafico followLatest diventa false e il congelamento sparisce.
  Test obbligatori: pan libero a mercato chiuso + auto-segui che non avanza.
- Stato: FATTO e pubblicato in v2.1.2. Congelamento solo se followLatest: appena si sposta
  il grafico followLatest diventa false e il congelamento non c'e' piu'. Provato nei due versi
  (congelamento spento del tutto -> 2 prove rosse; cura v2.1.0 rimessa -> la prova del pan in
  avanti resta rossa).

## P2 — FIREBASE: continua a leggere e scrivere a mercato chiuso
- Sintomo (segnalato dal proprietario): «nonostante tutto i mercati sono chiusi, su Firebase
  continua ad aumentare la scrittura e la lettura del progetto... in realta' non dovrebbe
  ne' leggere ne' scrivere nulla a mercati chiusi».
- Numeri già visti: 57K scritture / 114K letture al giorno contro un limite di 20K/50K.
- Ipotesi da misurare (NON ancora verificate): il giro di salvataggio (scheduleSave) e/o il
  controllo aggiornamenti / polling MT5 continuano a scrivere anche quando il mercato è
  chiuso e non cambia niente.
- Da fare: misurare quali scritture/letture partono a mercato chiuso, poi zittirle.
- Stato: PRIMA CURA in v2.1.7 (la rilettura di sicurezza, che era una al minuto). RESTA da
  misurare chi altro scrive/legge a mercato chiuso: la quota diceva 3,1K scritture giorno, e
  quelle non vengono da una rilettura.

## Dopo — finestre duplicate (cervello/RICHIESTE-DUPLICA-FINESTRA.md)
- 9 voci, lavoro a se. Non si tocca finche' P0/P1 non sono chiusi e pubblicati.

## P0 — DISCO E: LA CARTELLA DATI RESTA VUOTA
- Sintomo: `E:\Forex Backtest Lab\dati` esiste ma non contiene niente. Il ponte è configurato
  per scriverci, e `bridge.log` non mostra nessuna richiesta `/dati`.
- Misurato finora: il ponte risponde 401 senza token (le rotte ci sono); la pagina è servita da
  `http://127.0.0.1:8000`.
- DA VERIFICARE sul PC: (a) lo stato del toggle «tieni i dati sul mio computer» — se è spento i
  documenti vanno su Firebase invece che sul disco, ed è il comportamento atteso, non un guasto;
  (b) `bridge.log` per le chiamate `/dati` con token; (c) che la cartella sia scrivibile.
- Stato: DA FARE (dopo R1-R3 e finestre duplicate, come richiesto).

## P0 — FIREBASE: TROPPE SCRITTURE E LETTURE, E FATTURA TROPPO
- Sintomo (proprietario, 8 novembre 2026): «firebase calcola troppe scritture e letture andando a
  fatturare troppo, non deve sforare e c'è qualcosa che gli fa calcolare dai in continuo senza
  volerlo».
- Numeri misurati: 7 novembre scritture 3,1K/giorno su 20K, letture 6,4K/giorno su 50K (15,3% e
  12,8% della quota gratuita). Prima erano 57K scritture e 114K letture — cioè 18 e 2,3 volte
  oltre il limite. La crescita è il problema, non il livello di oggi.
- PRIMA CURA fatta (v2.1.7): la rete di sicurezza rileggeva l'intero documento dal cloud ogni 60
  secondi; a mercato chiuso ora si allenta a mezz'ora.
- DA FARE: misurare CHI scrive e chi legge ancora (le scritture 3,1K/giorno non vengono da una
  rilettura). Ipotesi da verificare: salvataggio periodico, sincronizzazione preferenze,
  controllo aggiornamenti, footprint/notion.
- Stato: DA FARE (dopo R1-R3 e finestre duplicate, come richiesto).

## P0 — IL GRAFICO PERDE LE CANDELE IN MEZZO ALLO STORICO (e non si sposta oltre l'ultima)
- Stato: CURATO in v2.2.3.
  SEGNALATO (8 novembre 2026, tre foto in tre punti diversi): «quando sto scorrendo il grafico
  a mercato chiuso il grafico si rompe in delle zone specifiche, smette di far visualizzare le
  candele lungo il grafico in parte; se ci spostiamo un altro po' ritorna a funzionare». Nella
  stessa giornata: «ile grafico non mi permette di andare oltre l'ultima candela spostandomi»
  e l'etichetta del prezzo che segue l'ultima candela visibile invece dell'ultima creata.
  CAUSA MISURATA, una sola per i tre sintomi: il confine della chiusura si cercava con una
  ricerca binaria che dà per certo che il predicato sia ordinato (prima tutte aperte, poi tutte
  chiuse). Il mercato non è ordinato così: pausa notturna 22:00-00:00, riapertura, weekend.
  Misurato su 3000 candele da un minuto: la finestra che attraversa la pausa notturna teneva 60
  candele su 300 (240 sparite), 269 finestre su 3000 con buchi, e spostandosi i buchi si
  spostano. Stessa ricerca sbagliata era il tetto di maxViewEnd() e il congelamento
  dell'autosegui, e la riga del prezzo leggeva l'ultima candela visibile.
  CURA: il confine si prende dall'ultima candela dei dati e si taglia SOLO LA CODA chiusa. Due
  confini separati (lezione del collaudo completo, che ha trovato una prova rossa invece di
  lasciar passare la cura): fblConfineChiusura() col calendario comanda il taglio e il tetto
  dello spostamento a mano; fblConfineAutosegui() con l'orario della sessione più l'istante di
  chiusura comanda il congelamento dell'autosegui. Resta valida la richiesta del 1 novembre: le
  candele oltre la chiusura non si mostrano, e il grafico non si svuota mai.
- Test: laboratorio/app/buco_grafico_chiuso.test.mjs

## P1 — LINEE ENTRY/TP/SL DEGLI ORDINI PENDENTI NON SI VEDONO A MERCATO CHIUSO
- Sintomo (proprietario, 8 novembre 2026): «non si vedono piu' le linee entry tp-sl degli ordini
  pendenti, ne' in modalita' replay ne' in tempo reale, quando il mercato e' chiuso».
- ATTENZIONE: e' una REGRESSIONE delle cure di questi giorni, non un difetto nuovo. Le cure
  toccate: il congelamento della finestra (v2.1.2), il taglio mercato-chiuso che non svuota piu'
  il grafico (v2.1.4), il margine futuro che si decide su due autorita' (v2.1.5).
- Ipotesi da misurare (NON ancora verificata): a mercato chiuso la finestra si ferma prima
  (`end` congelato, margine futuro zero), quindi il punto di ancoraggio delle linee - che sta
  sull'istante dell'ordine - cade oltre il bordo destro e viene ritagliato dal clip del disegno.
  Se l'ordine e' stato piazzato con l'ultima candela visibile, basta un pixel di confine per
  farlo sparire del tutto.
- DA FARE: misurare con un test (finestra congelata a mercato chiuso + ordine pendente ancorato
  all'ultima candela) e curare. Le linee di un ordine pendente sono INFORMAZIONE, non carico:
  devono vedersi anche a mercato chiuso, esattamente come le candele del passato.
- Stato: CURATO in v2.1.9 (il tetto di viewEnd a mercato chiuso e' l'ultima candela aperta).
