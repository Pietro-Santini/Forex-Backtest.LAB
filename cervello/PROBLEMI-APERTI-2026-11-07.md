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

## P0 - CHIUDENDO E RIAPRENDO L'APP CRASHA PER UNA DECINA DI SECONDI (processi in piu')
- Stato: CURATO in v2.2.8.
  SEGNALATO (9 novembre): «mi crashava di continuo per una decina di secondi, ci sono processi
  che gli danno fastidio».
  CAUSA MISURATA: la pulizia anti-orphano chiudeva due nomi su tre (mancava SegnaliBridge.exe),
  e non aspettava che le porte si liberassero davvero - taskkill torna quando ha CHIESTO, non
  quando e' avvenuto. Il ponte nuovo trovava la 8000 occupata, bind fallito, riprova ogni 2
  secondi: la finestra dava «non risponde» per quel tempo.
  CURA: elenco dei nomi come l'installer, attesa vera delle porte 8000/8001, e quando il bind
  fallisce si dice CHI tiene la porta (PID e nome) - misurato sul PC: PID 9916, Tailscale, non
  uno dei nostri.
- Test: laboratorio/ponte/test_processi_orfani_avvio.py

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

## P0 - LO SPOSTAMENTO A MANO NON ARRIVAVA FINO ALL'ULTIMA CANDELA
- Stato: CURATO in v2.2.5 (9 novembre 2026).
  SEGNALATO: «ile grafico non mi permette di andare oltre l'ultima candela spostandomi».
  CAUSA MISURATA: il tetto a mercato chiuso valeva sempre, anche con l'autosegui spento, ed
  era l'ultima candela APERTA: su 180 righe con 60 aperte la vista si fermava alla riga 60.
  CURA: il tetto vale solo con l'autosegui acceso; a mano si arriva fino all'ultima candela
  vera e oltre (col margine di sempre). E perCHE' il clic non faccia saltare la vista
  (difetto dell'8 novembre, misurato ancora in piedi), prima di spegnere l'autosegui viewEnd si
  riallinea a dove si vedeva.
- Test: laboratorio/app/zona_morta.test.mjs

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

## NUOVO PROGETTO — REPLAY SINCRONIZZATO SU TUTTE LE FINESTRE (10 novembre 2026)

Richiesta del proprietario, testuale: «per quanto riguarda la modalita' replay, vorrei che se
abbiamo delle pagine duplicate e scegliamo di entrare in modalita' replay su una delle pagine,
prima di tutto tutte le altre pagine mi vanno in modalita' replay con il conto associato in
storico. E quando clicco il pulsante play, deve funzionare per tutte le pagine, sia la pagina
madre che le pagine duplicate. Quindi, se pigio per esempio il tasto play sulla pagina madre,
avanzano allo stesso momento, in maniera sincronizzata, allo stesso tempo, quindi anche il
moltiplicatore di velocita' sara' lo stesso spalmato sulle finestre, e andra' avanti allo stesso
momento per tutte le finestre duplicate. Uguale anche se lo avvio per esempio su una pagina
duplicata, me lo trasporta sulla pagina principale e sulle altre pagine duplicate che sono state
create. Questo per poter permettere di vedere magari piu' time frame diversi su finestre diverse
e anche gli indicatori come si comportano in maniera diversa su piu' schermi, su piu' finestre.»

### Cosa deve fare, in concreto
1. Entrare in replay su UNA finestra → TUTTE le finestre (madre + duplicate) entrano in replay,
   con il conto associato in Storico.
2. Il play/pausa vale per tutte: premuto sulla madre avanzano tutte, premuto su una duplicata
   avanzano tutte (madre compresa).
3. Stesso punto del tempo, stesso moltiplicatore di velocita', stesso momento su tutte.
4. Time frame diversi su finestre diverse devono restare possibili: la sincronizzazione e' sul
   TEMPO, non sul time frame ne' sugli indicatori (quelli restano di ogni finestra, come oggi).

### Registro dei compiti (sub-agent, misurati e collaudati)
- [ ] A. Canale: estendere il BroadcastChannel 'trading_sync_v1' (o riusare il ramo esistente)
      con un messaggio 'replay_sync' che porta {inReplay, asset, masterTime, velocita', inPausa}.
- [ ] B. Ingresso in replay: `switchAccountMode(false)` / il pulsante replay su una finestra
      devono annunciare, e le altre applicare.
- [ ] C. Play/pausa/velocita': un solo orologio maestro (la finestra che ha premuto play),
      le altre seguono senza rimandare indietro (niente ciclo). Misura: due finestre, play su
      una, l'altra deve avere lo stesso masterTime entro un giro.
- [ ] D. Banchi rossi-verdi in laboratorio/app/*.test.mjs (madre + duplicata ?pipSlot=2).
- [ ] E. Collaudo completo + pubblicazione.

Stato: DA FARE (dopo il commit in corso).

## P0 — POSIZIONI DI UN ALTRO CONTO (11 novembre 2026) — CURATO in v2.2.28
CURATO in v2.2.28, con i banchi DENTRO il repo e verdi:
- `laboratorio/app/posizioni_un_solo_conto.test.mjs` (6/6) — il ponte dichiara di che conto e'
  la fotografia (`/positions` risponde con gli header `X-MT5-Login` / `X-MT5-Server`, esposti
  dal CORS); l'app scarta la fotografia di un altro conto (ne' adozione ne' chiusure), impara
  il proprio conto dal polling di `/account` e dall'annuncio della madre, timbra le posizioni
  che arrivano senza conto, e il filtro non fa piu' passare tutto quando il conto non si sa.
  SCELTA DICHIARATA: conto ignoto ⇒ l'app non attribuisce NESSUNA posizione con un login
  addosso (meglio zero per un istante che quelle di un altro). Prova di controllo nel banco:
  appena il conto si conosce, la posizione giusta torna.
- `laboratorio/app/posizioni_chiuse_tablet.test.mjs` — la parte curata: dopo il cambio conto
  annunciato la pagina ridipinge SUBITO (misurata a 1536 ms) e il banco aspetta 3000 ms.

RESTA APERTO UN CASO DIVERSO (banco fuori dal repo, in
`C:\Users\pietro\AppData\Local\Temp\opencode\banchi_aperti\posizioni_chiuse_tablet.test.mjs`):
una posizione reale tracciata in una sessione che NON e' quella a schermo non viene mai
riconciliata — se il broker la chiude (TP), resta nella tabella di quella sessione. Curarla
significa far scambiare i globali (`positions`, `trades`, saldo) al giro di riconciliazione,
cioe' toccare `closeTrade` (che scrive sempre nella sessione corrente): va progettato, non
rattoppato. Un banco rosso non si committa (lezione 31).

## P2 — /orders NON DICHIARA DI CHE CONTO E' (11 novembre 2026)
La cura 2.2.28 fa dichiarare il conto a `/positions` (header `X-MT5-Login`/`X-MT5-Server`) e
l'app scarta la fotografia di un altro conto. `/orders` invece non lo dichiara ancora: un
ordine pendente di un ALTRO conto, promosso a posizione quando scatta, viene taggato col conto
che l'app crede suo (`currentMt5AccountTag()`). Stessa famiglia del difetto P0 curato sopra,
ma per gli ordini pendenti. Da curare con un banco che misuri la promozione di un ordine
scattato mentre il ponte e' su un altro conto.

## P1 — TRAFFICO CLOUD: CURE APPLICATE, DA MISURARE SUL CAMPO (11 novembre 2026)
Applicate in `app.html`: tetto giornaliero persistito su localStorage, rilettura del grafico
allentata a 5 minuti fuori dal Live, letture contate anche nei quattro percorsi che il pannello
non vedeva, keepalive sotto il tetto. Banco: `laboratorio/app/cloud_bolletta.test.mjs`.
Da fare: guardare la console Firebase dopo 24 ore e confrontare con il pannello dell'app.

## P0 — L'AGGIORNAMENTO NON ARRIVA SUI DISPOSITIVI MOBILI (e non si vede sul PC) — 11 nov sera
Segnalato dal proprietario: «quando aggiorno il software sul PC, l'aggiornamento di gira anche sui
dispositivi mobili — che in realtà non è così. Il pulsante Aggiorna non viene mostrato, quindi sui
dispositivi mobili l'applicazione non si aggiorna. È come se ai dispositivi mobili arrivasse scritto
che l'aggiornamento è stato fatto, mentre invece non è stato fatto.»
Non misurato. Da misurare: quale versione l'app CREDE di avere su telefono (APK) e su PC (ponte che
serve una copia congelata), e da quale strada la legge (`fblVersioneProgrammaInstallato()` →
`/versione-programma` del ponte, `fblVersioneInstallata()` → cache del service worker / `sw.js` /
`FBL_VERSIONE_BUNDLE`). Se una di queste strade risponde una versione piu' nuova di quella che gira,
il confronto dice «sei all'ultima» e il pulsante non compare mai.
Riferimenti: `cervello/GUIDA-APK-AUTOMATICO.md`, `cervello/BUG.md` § «il pulsante non compare» e §
«ogni release senza APK», banco `laboratorio/app/aggiornamento_apk.test.mjs`.
Stato: DA MISURARE (banco nuovo: la versione creduta e quella pubblicata nei tre stati — PC con
copia congelata, telefono/APK col bundle vecchio, pagina da GitHub Pages).

## P1 — LA DASHBOARD NON SI AGGIORNA IN TEMPO REALE — 11 nov sera
Segnalato dal proprietario: «abbiamo ancora problemi per quanto riguarda l'aggiornamento in tempo
reale dei dati della dashboard.»
Manca l'indicazione del RIQUADRO e della situazione (PC o telefono, MT5 collegato o no, una finestra
o piu'): chiedere uno screenshot col riquadro fermo e l'ora. Strade candidate da misurare una per
una: (a) riquadri del conto MT5 — `fetchMt5AccountInfo()` / `fetchMt5AccountHistory()` e
`mt5StatsActive()`; (b) riquadri dal cloud — gli ascolti `onSnapshot`, con il sostituto
`serverDatiAscolta` che esiste e non viene mai chiamato (vedi DIARIO).
Stato: DA MISURARE.

## P0 — POSIZIONI E PROFITTI CHE SI SOMMANO FRA DUE ACCOUNT — 11 nov sera
Segnalato dal proprietario: «se apro una posizione su un account e poi la apro su un altro account,
mi si sommano le posizioni e i guadagni/profitti, quindi è tutto squilibrato sotto questo punto di
vista e va risolto.»
È lo stesso principio della voce «POSIZIONI DI UN ALTRO CONTO» (curata in v2.2.28 per il grafico), ma
qui la somma compare da un'altra parte. Da misurare: aprire una posizione sul conto A, passare al
conto B, aprirne una anche li', e contare UNO PER UNO posizioni a grafico, righe in tabella,
operazioni nel journal, P/L totale, equity. Il risultato giusto è: sul conto B solo il lavoro del
conto B, l'altro parcheggiato e di ritorno quando si torna su A.
Ipotesi da verificare (non cause accertate): il parcheggio/ripresa di `mt5AttivaConto()`,
`fblContoEffettivo()`, il «conto per asset», e `closeTrade()` che scrive nei globali della sessione
corrente (stesso punto della voce sulla riconciliazione cross-sessione).
Stato: DA MISURARE (banco nuovo).


## P0 — CALO DRASTICO DELLE PRESTAZIONI — 11 nov sera
Segnalato dal proprietario: «l'applicazione in se' per se' ha fatto un calo drastico delle
prestazioni».
Non misurato, e la parola che conta e' **drastico**: va confrontato con un numero di PRIMA, non
giudicato a occhio. Il pannello prestazioni dell'app misura gia' per voce (il 5 novembre dava
`disegniUtente 27,1 ms` + `indicatori 23,74 ms` su 54,55 ms totali: due voci su tre del budget di
un fotogramma). Da misurare: il tempo per fotogramma oggi, nelle stesse condizioni, e quale voce
e' cresciuta. Serve sapere anche SE il calo e' arrivato con una versione precisa: fra il 9 e l'11
novembre sono uscite dodici versioni, e il confronto fra due di esse isola la causa.
Candidati da guardare con la misura in mano, non prima: le finestre duplicate aperte (la voce 9 di
`RICHIESTE-DUPLICA-FINESTRA.md` dice che rallentano il sistema), gli ascolti del cloud, il polling
del conto MT5, il footprint e il profilo volumetrico (un solo profilo costava 86 ms).
Stato: DA MISURARE (banco nuovo: tempo per fotogramma per voce, due versioni a confronto).

## P1 — SUL TELEFONO LE CANDELE NON SONO DISEGNATE COME SUL PC — 11 nov sera
Segnalato dal proprietario: «sui dispositivi mobili le candele non vengono disegnate esattamente
come sono disegnate sul PC».
Non misurato, e manca il DETTAGLIO di cosa cambia: larghezza, spaziatura, code, colore, numero di
candele a schermo, o la soglia del «grafico a blocchi» curata in v2.2.17. Da chiedere: una foto
dello stesso asset e timeframe sui due dispositivi, alla stessa ora.
Da guardare: la v2.2.17 ha toccato proprio la larghezza delle candele e il disegno a blocchi
(banchi `candele_blocco_5m.misura`, `candele_footprint_larghezza.misura`,
`candele_soglia_blocco.misura`), e la v2.2.19 ha cambiato come il mobile riconosce il ponte. Il
sospetto da verificare e' il rapporto di pixel dello schermo (`devicePixelRatio`) o una soglia
tarata sulla larghezza in pixel, che su un telefono cade dall'altra parte.
Stato: DA MISURARE (serve la foto dei due schermi).


## P0 — IL PC SI INCHIODA, E ALLA RIAPERTURA L'APP «NON RISPONDE» — 11 nov sera
Segnalato dal proprietario: «quando chiudo l'applicazione poi la vado a riaprire subito dopo, la
pagina mi da' sempre forex backtest lab non risponde, e si inchioda» e «fa bloccare tutto il PC,
non funziona piu' niente. Nessun tasto, nessuna applicazione».

MISURATO sul suo PC l'11 novembre alle 15:21 (sola lettura: netstat, tasklist, Get-Process).

1. DUE ETA' DIVERSE FRA PONTE E GUSCIO. `ForexBacktestLAB.exe` (il ponte, PID 19964) era partito
   alle 14:22:51, cioe' 23 secondi dopo `explorer.exe`: parte AL LOGIN di Windows, da chiave di
   registro (e' scritto nel commento di `bridge.py` ~riga 967). `ForexBacktestLABDesktop.exe` (il
   guscio della finestra) era invece delle 15:20:33, un minuto prima della misura. Quindi alla
   riapertura il guscio NUOVO si attacca a un ponte VECCHIO di un'ora, con dentro il codice di
   quando e' partito.
2. LA PULIZIA NON CONOSCE IL GUSCIO. L'elenco dei nomi che il ponte chiude all'avvio
   (`bridge.py` ~riga 992) e' `ForexBacktestLAB.exe`, `Mt5FeedServer.exe`, `SegnaliBridge.exe`.
   **`ForexBacktestLABDesktop.exe` non compare in NESSUN sorgente di `installer_build/`**
   (verificato con grep ricorsivo): la pulizia non puo' chiuderlo, e due gusci possono convivere.
   Alla misura ce n'erano infatti due (PID 10284 e 21464).
3. TAILSCALE TIENE LE NOSTRE TRE PORTE. `tailscaled.exe` (PID 8352) era in ascolto su
   100.120.227.56 porte **8000, 8001 e 8769** — tutte e tre le nostre. Il ponte sta su
   127.0.0.1:8000. E' lo stesso fenomeno gia' misurato per la v2.2.8 (allora PID 9916).
4. IPOTESI SMENTITA DALLA MISURA, e va scritto per non ripeterla: sospettavo processi `WebView`
   orfani di sessioni vecchie dell'app. **Falso.** Dei 19 `msedgewebview2` vivi, risalendo la
   catena dei padri solo 7 erano nostri (figli di `ForexBacktestLABDesktop`): gli altri erano di
   `WhatsApp.Root.exe` e di `SearchApp.exe` (la ricerca di Windows).

PERCHE' SI INCHIODA TUTTO IL PC (e non solo l'app): misurata la memoria, 15,9 GB totali con 4,6
liberi (71% occupata) e la **Compressione memoria di Windows gia' attiva a 801 MB**, che e' il
segno che il sistema sta comprimendo per non finire. In quella condizione basta aprire qualche
finestra duplicata (ogni finestra e' un WebView da 100-250 MB) per arrivare a zero: Windows
inizia a scaricare su disco e TUTTO si ferma, non solo il programma. Non e' un difetto del
codice dell'app: e' esaurimento di memoria.

Stato: CAUSA PARZIALMENTE MISURATA. Resta da registrare la sequenza chiudi/riapri con i processi
sotto osservazione (registratore gia' pronto) per vedere CHI sopravvive alla chiusura.

## P0 — IL PC E' LENTO IN GENERALE: CHI MANGIA LA MEMORIA — 11 nov sera
Segnalato dal proprietario: «da quando abbiamo cominciato a fare questo progetto, il computer a
livello di prestazioni e' calato drasticamente... certe volte mi arriva la memoria a 95%, quasi al
100%» e «mi fa comparire non so quante schede di Chrome Atlas Shell.exe... e anche Microsoft Edge
WebView 2. Me ne apre molte».

MISURATO l'11 novembre alle 15:25: **331 processi vivi**, 15,9 GB di RAM con 4,67 liberi.
Memoria per famiglia, le prime voci:

    chrome-headless-shell   20 processi   2.392 MB
    claude                  11 processi   2.348 MB
    ChatGPT                 13 processi   1.088 MB
    svchost                 86 processi   1.083 MB
    msedgewebview2          19 processi   1.028 MB
    Notion                   7 processi     945 MB
    node                    10 processi     879 MB
    Memory Compression       1 processo     801 MB
    OpenCode                 6 processi     624 MB
    opencode-cli             1 processo     352 MB
    BlueStacksServices       4 processi     235 MB

LA RISPOSTA ALLA SUA DOMANDA, con il numero: **i venti `chrome-headless-shell` erano nati tutti
nello stesso secondo (15:24:51-53), zero minuti di vita: sono i browser invisibili del COLLAUDO
in corso in quel momento.** Non sono spazzatura rimasta li', ma sono il costo vero di ogni giro
di collaudo: 2,4 GB. Sommati a Claude (2,3 GB), node (0,9), OpenCode (1,0), gli strumenti con cui
si SVILUPPA il progetto occupano da soli circa **6,5 GB sui 15,9 disponibili**, cioe' il 40%
della macchina. Con sopra Chrome/Atlas, ChatGPT, Notion e l'app con le finestre duplicate si
arriva al 95-100%, ed e' esattamente quello che vede.

ATTENZIONE, da verificare: se un collaudo viene interrotto a meta' (Ctrl+C, crash, finestra
chiusa), quei venti browser possono restare ORFANI e nessuno li chiude. Da misurare: contarli
prima e dopo un'interruzione.

Stato: MISURATO. La cura non e' nel codice dell'app: e' nel modo di lavorare (quanti strumenti
aperti insieme) e, per la parte nostra, nel chiudere i browser del collaudo quando il giro
finisce o viene interrotto.


## AGGIORNAMENTO ALLA VOCE «DASHBOARD IN TEMPO REALE» — 11 nov sera (con foto)
Il proprietario ha mandato la foto della fascia dei riquadri e ha detto QUALI sono fermi, che era
il dato mancante per poter lavorare:
«il riquadro che non mi si aggiorna in tempo reale e' questo qua, e in modalita' pagina intera e'
quella sulla barra degli strumenti sotto, che c'e' comunque il margine libero, il capitale e tutto
il resto che non mi si aggiorna in tempo reale. O comunque sia in ritardo... deve essere un
aggiornamento come si aggiorna il profitto, si aggiorna anche il capitale, il margine libero. E
tutto il resto. Si deve aggiornare tutto in tempo reale. Non esiste che non si aggiorna. Per
minuti.»

QUINDI, con precisione:
- **si aggiorna**: il P/L (e il profitto);
- **NON si aggiorna, o arriva con minuti di ritardo**: MARGINE LIBERO e CAPITALE, piu' il resto
  della fascia; e la stessa fascia sulla barra degli strumenti in modalita' pagina intera.
- Nella foto i due numeri fermi erano identici fra loro (margine libero 11.102,54 e capitale
  11.102,54), col capitale marcato «Capitale della Challenge Prop Firm (simulato)».

DOVE GUARDARE (da misurare, non da supporre): il P/L vivo si ricalcola a ogni tick dal prezzo,
mentre capitale e margine libero arrivano da `fetchMt5AccountInfo()` — un polling con un suo
intervallo. Se quell'intervallo e' lungo (o la risposta e' 400 «Non connesso», o il polling e'
agganciato a uno stato che in Prop Firm non e' attivo) i due numeri restano fermi mentre il P/L
continua a muoversi: e' esattamente il sintomo descritto. Da misurare: ogni quanti secondi parte
la richiesta del conto, ogni quanto risponde, e quanto passa fra due aggiornamenti dei due
riquadri. Il confronto giusto e' col P/L, che si muove.
Stato: ORA MISURABILE (prima mancava il riquadro).


### PROVA REGISTRATA DAL VIVO DELLA CHIUSURA/RIAPERTURA — 11 novembre, 15:24:37 -> 15:25:10
Registrati i processi ogni 2 secondi mentre il proprietario chiudeva e riapriva l'app (sola
lettura). La sequenza, secondo per secondo:

    15:24:37  Ponte x1, Guscio x3, Mt5Feed x1, Segnali x2    app aperta e sana
    15:24:41  Ponte x1,            Mt5Feed x1, Segnali x2    muoiono i gusci (chiusura)
    15:24:45  Ponte x1,                        Segnali x2    muore Mt5FeedServer
    15:24:47                                   Segnali x2    muore anche il Ponte
    15:24:49  Guscio x1,                       Segnali x2    riapertura: nasce il guscio
    15:24:52  Ponte x1, Guscio x2,             Segnali x2    nasce il ponte
    15:24:54  Ponte x2, Guscio x2,             Segnali x2    <-- DUE PONTI INSIEME
    15:24:56  Ponte x1, Guscio x2                            torna uno
    15:24:58  Ponte x1, Guscio x2, Mt5Feed x1
    15:25:00  Ponte x1, Guscio x2, Mt5Feed x2                <-- DUE Mt5FeedServer
    15:25:10  Ponte x1, Guscio x2, Mt5Feed x2, Segnali x2    stato finale: Mt5Feed DOPPIO

DUE FATTI MISURATI, non supposti:
1. **Per circa due secondi convivono DUE ponti** (15:24:54). Il nuovo nasce prima che il vecchio
   sia finito di morire. E' la stessa famiglia del difetto della v2.2.8: `taskkill` torna appena
   ha CHIESTO la chiusura, non quando e' avvenuta.
2. **Dalle 15:25:00 restano DUE `Mt5FeedServer` e non tornano piu' uno** (verificato fino alle
   15:27:18, fine della registrazione). Questo e' l'orfano che resta addosso alla sessione nuova.

PERCHE' NASCE IL SECONDO Mt5FeedServer (ipotesi fortissima, da confermare con una prova): nel
ponte c'e' un **custode** che riaccende `Mt5FeedServer.exe` appena la porta **8001** smette di
rispondere (commento in `bridge.py` ~riga 1579-1583, che avvisa anche che «quel figlio sopravvive
alla morte del padre»). Durante la chiusura la 8001 tace, il custode del ponte che sta morendo lo
fa rinascere, e intanto il ponte NUOVO ne avvia uno suo: due.
**E qui si lega la misura di Tailscale**: `tailscaled.exe` e' in ascolto proprio su 8000, 8001 e
8769. Il giudizio «la 8001 e' muta» puo' essere falsato da chi quella porta la tiene su un altro
indirizzo. Le due cose vanno misurate insieme, non separate.

CONSEGUENZA PRATICA: due `Mt5FeedServer` vivi significano due client che parlano con lo stesso
terminale MT5. E' la condizione in cui l'app «non risponde» alla riapertura.

PROSSIMO PASSO (misura, non cura): ripetere chiusura/riapertura con il registratore acceso E con
Tailscale FERMO, e confrontare le due sequenze. Se con Tailscale fermo il secondo Mt5FeedServer
non nasce, la causa e' quella e la cura e' nel giudizio sulla porta. Se nasce lo stesso, la causa
e' solo il custode e si cura spegnendolo prima della chiusura.


## P0 — I DISEGNI SUL GRAFICO SPARISCONO DOPO ORE O DOPO UN AGGIORNAMENTO — 11 nov sera
Segnalato dal proprietario: «disegno qualcosa al grafico, lo lascio andare per ore e ore, poi dopo
magari quando facciamo qualche aggiornamento, oppure chiudo l'applicazione e poi la vado a
riaprire, quei disegni non ci sono piu'.»
Non misurato. Due inneschi dichiarati, e vanno misurati SEPARATAMENTE perche' possono avere cause
diverse: (a) il tempo che passa, a programma aperto; (b) la chiusura/riapertura o un aggiornamento.
Da guardare: i disegni stanno per ASSET (decisione del proprietario) e viaggiano anche sul
documento condiviso del cloud. La v2.2.6 ha introdotto la regola «identico = non si scrive» con una
firma del contenuto: **se la firma si calcola male, o il documento viene riscritto da una finestra
con meno disegni, la scrittura buona puo' essere sovrascritta da una vuota**. La v2.2.25 ha toccato
i disegni fra finestre. Il documento condiviso era inoltre vicino al tetto di 900 KB oltre il quale
l'app smette di condividere (misurato 815 KB il 9 novembre): da verificare se oggi il tetto viene
superato, perche' in quel caso le scritture nuove si perdono in silenzio.
Da misurare: disegnare, contare i disegni in memoria e nel deposito locale e nel documento cloud,
aspettare, riaprire, ricontare. Il numero che conta e' quante forme ci sono nei tre posti prima e
dopo.
Stato: DA MISURARE.


## P0 — SELEZIONARE UNA POSIZIONE RICHIEDE PIU' TOCCHI, E SPOSTARE SL/TP E' LENTO — 11 nov sera
Segnalato dal proprietario: «il selezionamento delle posizioni non me seleziona correttamente. Non
e' fluida come cosa. Prima di selezionare una posizione ho dovuto toccare 3 volte la linea della
posizione. Per spostare stop loss e take profit. Quindi rendiamolo molto piu' veloce come cosa,
anche perche' sono spostamenti magari che una persona dovrebbe fare anche molto velocemente,
quindi non deve avere ritardi. E quindi ritorniamo come era magari in passato... e funzionava in
maniera precisa e corretta. Senza bug.»

DUE COSE DIVERSE, da misurare separate:
(a) **QUANTI TOCCHI SERVONO** per agganciare la linea: tre invece di uno. E' un problema di
    TOLLERANZA (quanti pixel di distanza dalla linea vengono accettati come «hai toccato la
    linea»), oppure di ordine di priorita' fra chi raccoglie il tocco (se un altro elemento
    sopra la linea se lo prende per primo).
(b) **IL RITARDO** nel trascinamento: una volta agganciata, la linea deve seguire il dito o il
    mouse senza ritardo percepibile.

E' UNA REGRESSIONE, non un difetto di sempre: il proprietario dice che in passato funzionava. Va
quindi trovata per CONFRONTO fra versioni, non per lettura del codice di oggi. La v2.2.25
(11 novembre, 01:39) ha toccato esattamente questa zona: il suo titolo e' «linee SL/TP e
break-even...» e ha aggiunto il banco `laboratorio/app/sl_tp_selezione_trascinamento.test.mjs`.
Primo sospetto da verificare: la cura di quel giorno ha stretto la tolleranza o ha aggiunto una
condizione in piu' prima di agganciare.

DA CHIARIRE CON IL PROPRIETARIO: nel messaggio compare la frase «come anche c'e' la route to
cloud», che non si capisce (probabile errore di trascrizione vocale). Chiedere cosa intendeva
prima di tirarne conclusioni.

LA MISURA DA FARE: contare quanti tocchi servono oggi a distanze crescenti dalla linea (0, 2, 4,
6, 8 pixel) e confrontare lo stesso conto con la versione precedente alla 2.2.25. Il numero che
conta e' la distanza massima a cui il primo tocco aggancia. Per il ritardo: misurare i
millisecondi fra il movimento e lo spostamento della linea.
Stato: DA MISURARE (regressione, confronto fra versioni).

### CAUSA TROVATA NEL CODICE (lettura, 11 nov sera) — due ostacoli che si SOMMANO
`tradeLevelHit()` sta a `app.html:21513`. La tolleranza verticale e' 14 pixel e va bene. Il
problema sono due condizioni in piu', messe tutte e due di proposito:

1. **IL TOCCO DEVE CADERE DENTRO LA CASELLA Target/Stop, IN ORIZZONTALE.** Dal commento nel
   codice: «In ORIZZONTALE il trascinamento parte solo da DENTRO la casella Target/Stop (o dal
   suo bordo, con un margine di tolleranza): fuori da quell'area, anche se il mouse passa alla
   stessa altezza (Y) della linea durante un pan del grafico, non deve agganciarla.» Quindi
   toccare la linea nel punto sbagliato dell'asse orizzontale non fa NIENTE, e a schermo non si
   distingue da un tocco mancato.
2. **IL PRIMO CLIC MARCA, NON TRASCINA.** E' il comportamento che la v2.2.25 ha introdotto e
   difeso con la prova A del banco `sl_tp_selezione_trascinamento.test.mjs`, il cui titolo e'
   letteralmente «il primo clic sulla linea la MARCA, non deve trascinare la posizione».

I due sommati spiegano i tre tocchi: uno o due vanno persi fuori dalla casella, e quello buono
marca soltanto. Il trascinamento parte dal tocco dopo.

ATTENZIONE PRIMA DI CURARE: tutte e due le condizioni sono scritte come volute, e una porta la
nota «richiesto esplicitamente». La prima serve a non agganciare le linee per sbaglio mentre si
trascina il grafico. Quindi NON si allarga e basta: va chiesto al proprietario quale dei due
comportamenti vuole cambiare, perche' toglierli entrambi puo' far tornare il difetto opposto
(linee che si spostano da sole durante un pan).
Da misurare comunque: la larghezza vera della casella Target/Stop a schermo, perche' se e'
stretta il bersaglio e' piccolo anche quando si fa tutto giusto.

## P0 — CAPITALE E MARGINE LIBERO NON SI AGGIORNANO (misurato l'11 novembre 2026, cura NON applicata)

Sintomo del proprietario: «il margine libero, il capitale e tutto il resto non mi si aggiorna in
tempo reale. O comunque sia in ritardo... deve essere un aggiornamento come si aggiorna il
profitto». Nella foto: margine libero e capitale identici (11.102,54) e sotto il capitale
«Capitale della Challenge Prop Firm (simulato)».

### MISURATO (banco `C:\Users\pietro\Documents\banchi_aperti_forex\capitale_in_tempo_reale.test.mjs`, 3 prove rosse)
Ponte MT5 finto che risponde SUBITO con numeri sempre nuovi, polling vero dell'app, finestra di
8 secondi:

| strada | letture dal ponte | cambi a schermo |
|---|---|---|
| P/L live (`/positions` -> `mt5RealPositions` -> `floatingPL`) | **9** | **9** (uno al secondo) |
| Capitale e Margine libero (`/account` -> `mt5AccountInfo`) | **1** | **1**, poi fermi |

### CAUSA VERA (non ipotesi): il cancello di `mt5PositionsGiro`, `app.html:42822-42826`
```
function mt5PositionsGiro(){
 fetchMt5Positions();
 fetchMt5Orders();
 if(!mt5PositionsFetchInFlight&&!mt5OrdersFetchInFlight)fetchMt5AccountInfo();
}
```
Le due chiamate della riga sopra alzano quei due interruttori in modo SINCRONO (prima del loro
primo `await`): quando si arriva al controllo sono sempre alzati, quindi `/account` **non parte
mai**. `fetchMt5AccountInfo` ha solo due chiamanti: `app.html:42805`
(`startMt5PositionsPolling`, cioe' il collegamento) e questa riga 42825, sbarrata. Capitale e
margine libero reali si leggono **una volta sola, al collegamento**, e poi mai piu' finche'
qualcuno non riavvia il polling (cambio conto, riconnessione): da qui il «ritardo di minuti».

### SECONDO DIFETTO, nella stessa fascia: l'errore del ponte e' MUTO in Prop Firm
`mostraFonteCapitale()` (`app.html:42529`) prova i rami in quest'ordine: `mt5StatsActive()` ->
replay -> **`isPropFirmMode`** -> `!liveModeActive` -> `mt5MonitorOnly` -> `mt5Connected`.
L'avviso «i dati del conto MT5 non arrivano (…)» sta nell'ultimo ramo, quindi in Modalita' Prop
Firm non compare MAI: col ponte che risponde 400 «Non connesso» si legge
«Capitale della Challenge Prop Firm (simulato)» — esattamente la riga della foto — e il numero
resta fermo senza che nulla lo dica. Riprodotto dalla terza prova del banco.

### ALTRO MISURATO, utile a chi cura
- La fascia (`mMargin` 14072, `mCapital` 14039, `mPL` 14050, `applyMt5AccountStatsToPanel` 14077)
  si riscrive SOLO dentro `update()`. Nessun timer la aggiorna per conto suo.
- L'unica parte della fascia con un timer proprio e' la mini dashboard della barra strumenti in
  pagina intera: `setInterval(fblMiniDashAggiorna,1000)` (`app.html:28352`). Ma quella ricalcola
  da sola solo il P/L live (`floatingPL()`); Capitale, Win rate, Loss rate e Margine libero li
  **copia come testo** da `#mCapital`/`#mMargin` (`app.html:28348`). Quindi non possono essere
  piu' freschi della fascia: e' il motivo per cui in pagina intera si vede il P/L muoversi e il
  capitale fermo.
- Il pennello fine (`fblPitturaPrezzoFine`, 250 ms, `app.html:51087`) chiama solo `draw()`: il
  grafico e il prezzo restano vivi anche quando `update()` non gira. L'occhio quindi non ha
  nessun indizio che la fascia sia ferma.
- In Modalita' Prop Firm `mt5StatsActive()` resta VERO su un conto sconosciuto, perche'
  `tgAutoContoDaTrattareComeReale` risponde «reale» quando non sa (`app.html:35049`,
  «sconosciuto => per sicurezza reale»). La strada «Prop Firm simulata» si imbocca quindi solo
  quando `mt5AccountInfo` manca o non ha equity — ed e' proprio cio' che succede se la PRIMA
  lettura di `/account` va male, visto che non viene mai ritentata.
- Ipotesi del DIARIO caduta: `serverDatiAscolta` **viene chiamato** (`app.html:39473`, via
  `ascoltaServer`) e riguarda i documenti del cloud nostro, non questa fascia.

### CURA PROPOSTA (non applicata, da decidere col proprietario)
1. Togliere il cancello: in `mt5PositionsGiro` chiamare `fetchMt5AccountInfo()` sempre — ha gia'
   la sua guardia `_mt5AccountInfoInFlight`, che e' il freno giusto (e lo stesso che usano
   posizioni e ordini). Il cancello e' un freno messo dove il freno c'era gia' (lezione 34).
2. Far ridisegnare la fascia quando arriva un conto nuovo: alla fine di `fetchMt5AccountInfo`,
   se equity/margine sono cambiati, chiamare `applyMt5AccountStatsToPanel()` +
   `mostraFonteCapitale()` (o `update()`), invece di aspettare il tick del grafico.
3. Spostare il ramo `isPropFirmMode` di `mostraFonteCapitale()` DOPO il ramo che segnala
   `mt5AccountInfoErrore`, o unirli: «Challenge Prop Firm (simulato) — i dati del conto MT5 non
   arrivano (Non connesso)».
4. Nella mini dashboard, ricalcolare Capitale e Margine libero con `equityNow()`/`freeMargin()`
   invece di copiare il testo della fascia.
   **CORREZIONE del 11 novembre sera, verificata con grep:** quella frase e' SBAGLIATA.
   `ForexBacktestLABDesktop.exe` c'e' in `installer_build/installer.iss` (righe 32, 260 e 277:
   la procedura `UccidiTutti` lo chiude per secondo). Manca solo nell'elenco di `bridge.py`.
   Quindi gli elenchi del ponte (3 nomi) e dell'installer (4 nomi) NON sono gli stessi, e il
   test `test_l_elenco_dei_nomi_e_lo_stesso_dell_installer` non se ne accorge perche' controlla
   solo i tre nomi che il ponte ha.


## MISURA VERA DAL PC DEL PROPRIETARIO — 11 novembre 2026, 15:57:46
Pannello prestazioni dell'app, mandato dal proprietario. E' la misura che mancava a tre voci
aperte, e ne CHIUDE una.

### 1. LA PAGINA CHE GIRA E' LA 2.2.12, NON LA 2.2.28 — la voce A e' risolta
    versione (pannello dell'app in esecuzione): 2.2.12
    ponte sulla stessa macchina, /versione-programma: {"programma":"2.2.28","pagina":"2.2.28",
                                                       "da_aggiornare":false}
    ponte, /sw.js:                                    forex-backtest-lab-v2.2.28
I FILE sul PC sono aggiornati. E' la FINESTRA APERTA che sta eseguendo codice vecchio di sedici
versioni (dalla 2.2.13 alla 2.2.28 nessuna cura e' mai entrata in esecuzione su quel computer).

**PERCHE' IL PULSANTE NON COMPARE MAI, con i numeri davanti:** `fblControllaAggiornamento()`
confronta la versione del PROGRAMMA con quella della PAGINA SERVITA, e sono tutte e due 2.2.28:
`da_aggiornare:false`, nessun pulsante. Nessuna delle due strade guarda la versione che sta
DAVVERO girando dentro la finestra. Quindi il confronto e' fra due file sul disco, mentre il
codice in esecuzione e' una terza cosa che nessuno interroga.
**LA CURA:** confrontare la versione in esecuzione (la costante dentro la pagina viva) con quella
pubblicata, e quando sono diverse dirlo e offrire il ricaricamento. E' una riga di confronto in
piu', ma cambia tutto: oggi un utente puo' restare indietro per settimane senza un avviso.
**DA DIRE SUBITO AL PROPRIETARIO:** basta ricaricare la pagina per avere le sedici versioni di
cure. E ATTENZIONE, ne discende una cosa che riguarda TUTTE le altre segnalazioni di stasera:
sono state fatte su codice 2.2.12, quindi alcune possono essere gia' curate e non in esecuzione.
Prima di rimisurarle, ricaricare e riprovare.

### 2. IL DISEGNO COSTA 238 ms, E IL 58% E' UN SOLO DISEGNO
    fotogrammiAlSecondo : 4          (dovrebbero essere decine)
    disegnoMedio_ms     : 238.34     scattoPeggiore_ms: 735
    draw: 10.280 giri, 10.160 LENTI, media dei lenti 172 ms
Dove va il tempo (sezioni del disegno, totale 238,28 ms):
    disegniUtente = 139.42 ms   (58%)
    indicatori    =  88.57 ms   (37%)
    tutto il resto <   3 ms
E dentro quelle due:
    disegno:vpfixed             = 139.23 ms   <- UN SOLO profilo volumetrico fisso
    ind:bsl_ssl_fvg:calcolo     =  49.20 ms
    ind:order_blocks:calcolo    =  29.86 ms
    ind:ict_reversal_setup      =   4.25 ms
    ind:ema_ind                 =   3.28 ms
**Il «calo drastico delle prestazioni» ha un nome e un numero: un profilo volumetrico fisso che
da solo mangia piu' della meta' del fotogramma, e due indicatori che insieme ne mangiano 79 ms.**
I disegni salvati sono 3 e le candele 83.341: il profilo si ricalcola su una finestra enorme.
Da misurare: perche' vpfixed costa 139 ms a fotogramma invece di essere calcolato una volta e
riusato (il suo risultato non cambia se non cambiano le candele sotto).

### 3. IL PONTE RISPONDE IN SECONDI, NON IN MILLISECONDI
    lettura conto     :  67 volte, media 3.832 ms, peggiore 23.262 ms, 1 non riuscita
    lettura posizioni : 683 volte, media 1.943 ms, peggiore 24.280 ms
    ordine (altro)    : 689 volte, media 1.919 ms, peggiore 24.290 ms
    modifica stop/target: 3 volte, media 2.745 ms, peggiore 4.866 ms
    riquadro "Ordini, questo computer": risponde 5.167 ms
Due secondi di media e ventiquattro di picco. Questo spiega da solo: la dashboard che sembra
ferma, lo spostamento di stop e target che «ha ritardi» (2,7 secondi di media per confermare), e
la sensazione generale di lentezza. **La cura del capitale (v2.2.29) fa partire la richiesta a
ogni giro, ma se il ponte ci mette 3,8 secondi a rispondere il numero resta comunque indietro:
il collo di bottiglia e' il ponte, e va misurato a parte.**

### 4. LA BANDA DEL CLOUD: 222 MB IN UN GIORNO PER UN DOCUMENTO SOLO
    grafico : 68 scritture, 294 letture, 222.406,1 KB
    TOTALE  : 81 scritture, 322 letture, 224.752,9 KB
Il documento dei disegni condivisi pesa in media 756 KB a lettura e viene riletto 294 volte in un
giorno. E' il 99% della banda. Si lega alla voce dei disegni che spariscono: lo stesso documento
e' vicino al tetto oltre il quale le scritture vengono rifiutate in silenzio.


### 5. LA BOLLETTA FIREBASE, dalla console (foto del proprietario, 11 novembre)
    Costo del progetto      6,31 EUR
      Cloud Functions       5,21 EUR   <- l'82% della spesa
      Cloud Firestore       1,05 EUR
      Non-Firebase Services 0,06 EUR
    Quote giornaliere gratuite di Firestore:
      scritture  15K su 20K/giorno  (76,3%)
      letture    32K su 50K/giorno  (63,5%)
      eliminazioni 0
    La curva della spesa sale dal 1 al 9 novembre e **da li' in poi e' piatta**.

TRE COSE DA NOTARE, e una e' una contraddizione da misurare:
1. **Il grosso NON e' Firestore: sono le Cloud Functions** (5,21 su 6,31). La memoria del progetto
   diceva «Firebase: si paga la banda», e per Firestore resta vero, ma la voce piu' cara oggi e'
   un'altra e va guardata per prima. Da capire quali funzioni girano e chi le chiama (il Notion
   Template Kit ha le sue, e il pannello dell'app segna `notionChiamateServer: 2`,
   `notionGiriTimer: 66`).
2. **CONTRADDIZIONE DA MISURARE**: il pannello dell'app conta **81 scritture e 322 letture** nella
   giornata, la console ne conta **15.000 e 32.000**. Un fattore 185. O ci sono molti dispositivi
   e sessioni che scrivono, o qualcosa scrive senza passare dal contatore dell'app (le Cloud
   Functions scrivono anche loro su Firestore, e quelle il contatore dell'app non le vede). Finche'
   non si sa CHI fa quelle 15.000 scritture, qualunque cura sulla bolletta e' un tentativo.
3. La curva piatta dal 9 novembre e' una buona notizia ma **non e' merito della cura della v2.2.27**
   (e' dell'11, e su quel PC non sta nemmeno girando: vedi il punto 1 di questa misura). Da capire
   cosa e' cambiato il 9.

### 6. DETTAGLIO GOOGLE CLOUD (seconda foto, 11 novembre) — e chi puo' far partire le funzioni
    01-11 nov 2026 : 2,30 EUR   (-64,94% rispetto al 21-31 ottobre)
    previsto 01-30 : 2,23 EUR   (-69,86%)
    voce in salita : Cloud Run Functions 1,25 EUR (+29.486%), progetto forex-backtest-lab,
                     regione europe-west1
    picchi nel grafico: 6 novembre (~0,68) e 10 novembre (~0,43), tutti e due di Cloud Run Functions.
In valore assoluto non e' un'emergenza e la tendenza SCENDE. Il +29.486% e' una percentuale su una
base quasi zero: prima quelle funzioni non venivano quasi mai chiamate.

VERIFICATO NEL CODICE (per non cercare a caso): le funzioni stanno in due cartelle fuori dal repo,
`abbonamento_kit/functions-abbonamento` (createSubscriptionCheckout, createBillingPortal,
abbonamentoWebhook) e `notion_template_kit/functions-notion` (notionSyncTrades, notionStatus,
notionAuthUrl, notionOAuthCallback, notionDisconnect, notionReleaseMt5Account, createNotionCheckout,
stripeWebhook).
**Nessuna ha un trigger su Firestore e nessuna e' programmata a orario** (cercati
onDocumentWritten/onDocumentCreated/onSchedule: zero). Quindi NON partono da sole a ogni scrittura:
qualcuno le chiama. I chiamanti possibili sono due: l'app (c'e' un timer che nella misura segnava
`notionGiriTimer: 66` e `notionChiamateServer: 2`) e i webhook di Stripe/Notion dall'esterno.
DA MISURARE prima di curare: quante chiamate al minuto fa quel timer quando l'app resta aperta, e
cosa e' successo il 6 e il 10 novembre. Il divario fra le 81 scritture contate dall'app e le 15.000
della console resta da spiegare: le funzioni scrivono anche loro, e il contatore dell'app non le
vede.


## P1 — IL BANCO «identico = non si scrive» CADE A INTERMITTENZA, E PUO' ESSERE UN DIFETTO VERO
Osservato il 12 novembre, tre volte in un giorno: `laboratorio/app/cloud_incrementale.test.mjs`,
prova «PROVA DI CONTROLLO: se non cambia niente, non si scrive niente», cade con **1 invece di 0**
scritture. Rigirato DA SOLO passa; cade quando il collaudo e' sotto carico (in locale) e **e'
caduto anche sul collaudo di GitHub** (commit bce88ca, macchina pulita e scarica).

PERCHE' NON VA LIQUIDATO COME «BANCO INSTABILE»: la prova misura la regola su cui si regge la
bolletta del cloud («identico = non si scrive», v2.2.6). Se quella regola salta anche solo a
intermitenza, l'app scrive piu' del dovuto - e la banda e' esattamente la voce che il proprietario
paga. Il banco porta gia' dentro una difesa contro il disturbo (misura la DIFFERENZA fra due
chiamate, non il totale), e cade lo stesso.

PRIMO FATTO MISURATO (lettura del codice, 12 novembre): dentro `syncFullStatusToFirebase`
(app.html:9890) ci sono **DUE** chiamate a `window.fxbtCloud.save()`, a riga **9945** e a riga
**10054** (la seconda su un pacchetto ridotto, `trimmedBundle`). Quindi una sola chiamata alla
funzione puo' produrre due scritture. Da misurare: in quale caso si entra nella seconda, e se e'
quello il «+1» che compare a intermittenza.

DA MISURARE, in ordine: (a) quale delle due righe scrive quando la prova cade; (b) se la firma
anti-doppioni confronta un payload che contiene qualcosa che cambia da solo (un orario, un
contatore, l'ordine di una mappa); (c) quante scritture al giorno costa davvero sul conto del
proprietario, visto che la console Firebase ne conta 15.000 contro le 81 che l'app dichiara - il
divario resta non spiegato ed e' annotato piu' sopra.
Stato: DA MISURARE. Non e' un banco da rendere piu' tollerante: finche' non si sa, va tenuto
severo, perche' e' l'unico che guarda quella regola.


## P0 — I DISEGNI CHE SPARISCONO: due strade curate (v2.2.36), una terza ancora aperta
CURATE il 12 novembre, su misura dell'indagine dell'11:
1. **La copia di un account non si sovrascrive piu' da scollegati.** Riaprendo senza account il
   ripristino scartava la copia firmata con l'uid (il filtro vuole l'uid uguale, e `null` non e'
   uguale a niente): a schermo zero disegni mentre sul disco ce n'erano due. Fin li' si
   recuperava; ma il primo disegno nuovo riscriveva la stessa chiave firmata `uid:null` e
   cancellava i vecchi - da li' la perdita era definitiva. Adesso una sessione senza account
   scrive in una chiave sua (`..._scollegato`) e non tocca la copia di nessuno.
2. **Senza account non si resta a mani vuote**: se nessuno e' collegato, il filtro per uid non
   butta piu' via i disegni di questo dispositivo. Con un account collegato il filtro resta come
   prima: i disegni di un altro non si mostrano.
3. **Uno stato vuoto non batte un deposito pieno.** Lo stato di sessione viene riscritto di
   continuo, quindi e' quasi sempre piu' recente del deposito dei disegni: la data da sola lo
   faceva vincere anche quando non conteneva NESSUN disegno. Fra «piu' recente ma vuoto» e «piu'
   vecchio ma pieno», per i disegni vince il pieno.

**RESTA ROSSA la prova DUE** di `banchi_aperti_forex\disegni_chiudi_riapri.test.mjs`, e si sa
perche': il banco ricarica la pagina e il ripristino passa per un percorso di avvio diverso da
quello curato (`comeRipristinato: "copia locale (questo dispositivo)"`, cioe' il ramo
`localMatchesAccount` di initSession, non `restoreDrawingsFromBackupIfNewer`). Da misurare: se in
quel ramo `assetDrawings` venga sovrascritto DOPO il ripristino, e da chi. Non-regressione
verificata: 31 prove verdi su tutti i banchi dei disegni.

**RESTANO APERTE le altre due strade misurate l'11 novembre**, non ancora curate:
- una voce del cloud piu' VECCHIA e piu' povera vince su quella locale piu' ricca (misurato 5
  disegni -> 1): il confronto usa un «seme» che vale 6 contro millisecondi veri;
- il tetto di peso e' controllato sul PACCHETTO e non sul DOCUMENTO, quindi si supera il limite
  del cloud e la scrittura viene rifiutata IN SILENZIO (`graficoAvvisoPieno` resta falso e la
  barra di stato non dice niente). E' il «spariscono senza dire niente».


## P1 — SPOSTARE LA LINEA DI ENTRATA DI UN ORDINE LIMITE — 12 nov, CAUSA TROVATA
Richiesto dal proprietario: «quando c'e' un ordine limite devo avere la possibilita' di spostarlo,
anche se l'ordine pendente viene creato da una sala segnali: posso spostare la linea di entrata
del buy limit e del sell limit».
CAUSA TROVATA a lettura (app.html, dentro `tradeLevelHit`):

    if(px<=g.pad.l+160 && Math.abs(py-g.y(p.entry))<=tolerance) return `pending:${p.id}:entry`;
    const rightZoneX=(g.rect.width-g.pad.r)-140;
    if(Number.isFinite(p.sl) && px>=rightZoneX ...) return `pending:${p.id}:sl`;

La linea di ENTRATA si aggancia **solo nei primi 160 pixel** dopo il margine sinistro; stop e
target solo negli ultimi 140 a destra. Su un grafico da 1.300 px restano **oltre 900 px in mezzo
in cui nessuna delle tre linee risponde**, pur essendo disegnate per tutta la larghezza. La
tolleranza verticale e' 14 px, quindi il bersaglio dell'entrata e' una striscia di 160x28.
La divisione sinistra/destra esiste per un motivo (tre linee alla stessa altezza vanno distinte),
ma la fascia e' troppo stretta ed e' invisibile: non c'e' niente a schermo che dica «qui si
aggancia, qui no».
NON E' SPECIFICO DEI SEGNALI: il filtro e' `pendingOrders.filter(drawableOnCurrentChart)`, quindi
vale per qualunque ordine pendente dell'asset a grafico, da segnale o fatto a mano. Da misurare
pero' il caso del proprietario: un ordine nato da un segnale su un asset di un ALTRO conto
potrebbe non passare `drawableOnCurrentChart`, e allora non sarebbe disegnato ne' agganciabile -
e' una seconda strada, da verificare col banco.
Stato: DA CURARE (allargare la fascia utile, e renderla visibile).

## P1 — COPIARE LE IMPOSTAZIONI DA UN ALTRO CONTO — 12 nov, richiesta nuova
Parole del proprietario: «per le impostazioni del conto, su apertura automatica delle posizioni,
quando si seleziona il conto si puo' avere la possibilita' di copiare le impostazioni di un altro
conto. Quando si aggiunge un conto nuovo viene tutto formattato in maniera standard: noi possiamo
avere la possibilita' di selezionare "copia impostazioni dal conto X", cosi' ci copia tutte le
impostazioni di quel conto che abbiamo gia' aggiunto in precedenza».
Da fare: nel pannello del conto, accanto alla scelta del conto, un menu «copia le impostazioni
da…» con l'elenco degli altri conti salvati. Da stabilire PRIMA di scrivere il codice: QUALI
impostazioni si copiano (apertura automatica, rischio, lottaggio, regole Prop Firm, sale seguite,
strategia) e quali NON si devono copiare mai (il login, il server, la chiave, lo storico delle
operazioni e il capitale, che sono del conto e non delle preferenze). Copiare qualcosa che
identifica il conto sarebbe peggio che non avere la funzione.
Stato: DA FARE (serve prima l'elenco di cosa si copia).

---

## 13 novembre 2026 — TRENTUNO BANCHI DIPENDONO DALL'ORA IN CUI SI LANCIA IL COLLAUDO

**Misurato**, non supposto: `grep` dei banchi in `laboratorio/app/` che costruiscono candele a
partire da `Date.now()` **e** toccano il mercato o il disegno (`fblMercatoFermoOra`,
`liveSessionPhase*`, `maxViewEnd`, `getViewWindow`, `draw()`), **senza** fissare l'orologio:
**31 file**. Fra questi: `mercato_chiuso`, `congelamento_solo_autosegui`, `replay_fluido`,
`replay_posizioni`, `pendenti_fantasma`, `telefono_tocco_grafico`, `ordini_pendenti_grafico`.

**Perche' conta, con i fatti del 12-13 novembre.** In una sola nottata sono andati rossi, uno
alla volta e per questa ragione, quattro banchi diversi:
- `posizioni_un_solo_conto` — verde sul PC, rosso su GitHub (la' e' notte in UTC);
- `notizie_altri_dispositivi` — verde di giorno, rosso dopo le 22 di Roma;
- `mercato_per_asset_dai_dati` — verde da solo, rosso nel collaudo intero (due letture distanti);
- `zona_morta` — verde il giovedi' sera, rosso **cinquanta minuti dopo**, perche' nel frattempo
  era passata la mezzanotte ed era diventato venerdi' (la sua scena dichiara «venerdi' aperto»,
  e l'app chiede «aperto ADESSO?» all'orologio vero: il margine futuro e' tornato e il tetto e'
  passato da 60 a 235).

Ogni volta il sospetto naturale e' una regressione del codice, e ogni volta sono venti minuti di
collaudo buttati piu' il tempo dell'indagine. Una volta su quattro **era** un difetto vero
(il calendario del mercato spento con l'asset ignoto, curato nella 2.2.37): ed e' il motivo per
cui questi banchi NON vanno rilassati, vanno resi deterministici.

**La ricetta, gia' applicata ai quattro:**
1. chi misura qualcosa che si DISEGNA dichiara la finestra con `followLatest = false` («questa
   vista l'ha scelta l'utente»): cosi' l'app non congela e non allunga niente;
2. chi deve mettere un oggetto dentro la vista non sceglie l'indice a mano: legge
   `getViewWindow()` e prende una candela in mezzo;
3. chi misura «aperto o chiuso adesso» fissa l'orologio della pagina (`__NOW_VERO`/`__NOW_OFF`,
   come in `mercato_per_asset_dai_dati` e ora in `zona_morta`);
4. due misure che devono descrivere lo STESSO istante si fanno in UNA sola chiamata alla pagina.

**Non sono stati riscritti tutti e 31 in blocco, di proposito:** oggi sono verdi, e trentun
modifiche alla cieca su banchi che nessuno sta guardando sono piu' rischiose del problema. Si
curano quando diventano rossi — ma chi li trova rossi deve leggere PRIMA questa voce, perche' la
prima domanda non e' «cosa ho rotto» ma «che ora era».

---

## 13 novembre 2026 — DUPLICATE COME SPECCHIO: primo passo fatto, e cosa resta

**Fatto (v2.2.42): una finestra duplicata non parla piu' con il cloud.** Misurato con un Firebase
finto che conta invece di parlare, prima e dopo:

| | madre | duplicata PRIMA | duplicata DOPO |
|---|---|---|---|
| ascolti permanenti | 3 | **2** | **0** |
| scritture | si' | si' | **no** |
| letture una tantum all'avvio | 4 | 3 | 3 (da chiudere) |

Gli ascolti sono la voce che conta: ognuno produce UNA lettura ogni volta che un qualunque
dispositivo scrive quel documento. Con la madre piu' due duplicate una modifica dal telefono
diventava tre letture. Adesso le letture non dipendono piu' dal numero di finestre.
Banco: `laboratorio/app/duplicata_non_parla_col_cloud.test.mjs` (5 prove).

**RESTA DA FARE, in ordine:**
1. **Le 3 letture una tantum all'avvio di ogni duplicata**: passano dai percorsi di lettura
   diretta (`getDoc`), non dagli ascolti. Vanno girate alla madre con lo stesso meccanismo gia'
   scritto (`cloud_doc_chiedi` / `fblUltimiDocCloud`).
2. **Le candele**: oggi ogni finestra scarica e tiene il suo storico. E' la voce che pesa sul PC,
   e va presa dalla madre.
3. **Il calcolo degli indicatori**: con la v2.2.41 costa 0,6 ms per tick invece di 262, quindi
   spostarlo sulla madre adesso ha senso (prima avrebbe spostato il lavoro sbagliato).
4. **Il disegno resta per finestra**: una tela per finestra, non si condivide. E' la parte
   leggera (0,04-0,16 ms per indicatore).

**NON MISURATO, e va detto:** la memoria. `performance.memory` nel browser di prova resta fermo
a 25 MB anche con 50.029 candele caricate (valore quantizzato), quindi il peso per finestra NON
e' stato misurato qui. La cifra che abbiamo e' quella del proprietario, dal suo PC, il 12
novembre: 34-36 processi del motore grafico, 1,7 GB, memoria di sistema all'85%. La verifica del
passo 2 dovra' farla lui con il suo pannello, non questo banco.

**PALETTO DA NON PERDERE** (voce 12 delle richieste del 12 novembre sera): lo specchio vale per i
DATI, non per la MODALITA'. Una figlia in replay deve poter guardare lo storico mentre la madre
e' in Live. Una «unica fonte di verita'» che impone anche la modalita' romperebbe quella
richiesta.
