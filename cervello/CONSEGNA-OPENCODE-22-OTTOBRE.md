# Consegna a OpenCode — 22 ottobre 2026

Scritta da Claude al termine di una sessione lunga (dalla v2.0.12 alla v2.0.18). Serve a tre cose,
in quest'ordine:

1. **non rifare** quello che è già fatto — è successo più volte in questa sessione di scoprire che
   metà di una richiesta esisteva già;
2. **non rompere** quello che regge — c'è una lista precisa di cose da non toccare, e il perché;
3. **finire** quello che manca, nell'ordine deciso dal proprietario.

---

## 0. LA REGOLA CHE VIENE PRIMA DI TUTTE

**Se il proprietario segnala un difetto che risulta già corretto, prima di rimetterci le mani
controlla QUALE VERSIONE sta usando:**

```bash
git show v2.0.12:app.html | grep "la correzione"
```

Il 21 ottobre è successo **quattro volte di fila** (conferma unica delle chiusure, riquadro di
caricamento, break-even negativo, popup fuori dallo schermo con lo zoom): erano tutte già
pubblicate, e lui descriveva fedelmente la versione che aveva installata. La causa vera era il
canale di aggiornamento rotto, non il difetto.

**Corollario:** quando un test vecchio diventa rosso, la prima domanda non è «come lo aggiorno»
ma **«ha ragione lui?»**. Nella notte del 21 aveva ragione tre volte su quattro.

---

## 1. COSA È STATO FATTO (non rifarlo)

### 1.1 L'app si aggiorna da sola — v2.0.15 ⭐ il difetto che nascondeva gli altri

`bridge.py` serviva `app.html` da `sys._MEIPASS`, cioè la copia **congelata dentro l'eseguibile**
al momento della compilazione. Nessun aggiornamento web poteva toccarla: l'unico modo di
aggiornare era reinstallare il Setup.

Ora il ponte scarica `app.html` e `sw.js` dal sito in una cartella scrivibile e serve quella copia.
**Tre regole che NON vanno indebolite:**

1. **LA COPPIA O NIENTE** — i due file si sostituiscono insieme. `sw.js` porta il numero di
   versione che il pannello legge: un `app.html` nuovo con un `sw.js` vecchio terrebbe il pulsante
   «Aggiorna» acceso per sempre.
2. **MAI INDIETRO** — una versione più vecchia (cache di un proxy, rollback) non sostituisce
   quella installata.
3. **SI CONTROLLA CHE SIA DAVVERO L'APP** — su GitHub Pages una pagina 404 arriva con HTTP 200.

Test: `laboratorio/ponte/test_app_aggiornata.py` (8).
`/health` ora dichiara quale versione sta servendo e da dove: **usalo** per sapere cosa sta girando.

### 1.2 Prestazioni a mercato aperto — v2.0.17 ⭐ la correzione più grossa

**Misurato:** ogni prezzo in arrivo buttava le cache dell'aggregazione e dei tempi (confrontano il
*riferimento* dell'array, e il percorso Live ne crea uno nuovo a ogni tick), costringendo a
riaggregare tutto lo storico.

| Candele base | Prima (per prezzo) | Dopo |
|---|---|---|
| 50.000 | 8,3 ms | 0,86 ms |
| 200.000 | **58 ms** | **2,11 ms** |

Due pezzi: le cache distinguono «è cambiato tutto» da «è cambiata solo la coda»
(`baseRowsCoda` / `segnalaCodaCambiata`), e la convalida delle date si stende **solo su ciò che è
nuovo** (`csvLibrary[0].__dateOk`).

**NON TOCCARE:** `rows` **può essere lo stesso array** della cache (`rebuildRows` fa
`rows=fullAgg`). Non mutare le cache sul posto per guadagnare le ultime copie: cambieresti i dati
sotto il grafico mentre disegna. Sta scritto nel test, con il perché.

Test: `laboratorio/app/cache_coda_live.test.mjs` (5) — i primi quattro guardano la **correttezza**:
un'aggregazione incrementale sbagliata non si vede, produce candele leggermente diverse in
silenzio.

### 1.3 Altre correzioni pubblicate

| Cosa | Versione | La causa, in una riga |
|---|---|---|
| Il pareggio è **zero** | 2.0.13 | c'era un margine che perdeva 2 € |
| MT5 non si stacca agli aggiornamenti | 2.0.14 | il beacon di `pagehide` spegneva tutto: ora c'è una **grazia di 90 s** annullata dal primo client che torna |
| Popup dentro lo schermo | 2.0.14 | era la **scala UI**: `max-height:88vh` moltiplicato dallo zoom del body. Ora la scala si dichiara al CSS in `--fblZoom` |
| Il grafico non salta al cambio timeframe | 2.0.15 | «stessa finestra di tempo» da 1h a 1m moltiplica per 60: 300.000 candele. Ora c'è un **tetto legato ai pixel** |
| I clic sul grafico | 2.0.15 | la casella Target/Stop e gli indicatori assorbivano i clic. **Regola: un bersaglio sottile e mirato si prende il clic, un riempimento largo no** |
| Trade Journal che non sparisce | 2.0.16 | si salvava sul cloud solo su `pagehide`, dove la scrittura può non arrivare. Ora anche **quando cambia**, con attesa di 8 s che accorpa una chiusura a blocco |
| Margine utilizzato vero | 2.0.16 | non era calcolato male: **non veniva chiesto a nessuno**. Ora `order_calc_margin` |
| Robot Syntra | 2.0.16 | i comandi finivano al server, dove BlueStacks non esiste |
| Linea di entrata che finisce | 2.0.16 | arrivava al bordo della vista invece che allo stop preso o all'ultimo TP |
| Percentuale di caricamento | 2.0.16 | `passo/3` e il primo passo è zero. **Mai zero, mai cento dentro un passo, cento esatto alla fine** |
| Stop e target automatici per sala | 2.0.16 | il calcolo c'era: mancava poterlo scegliere **per sala**, e il target in pip |
| Segnali che non aspettano il grafico | 2.0.18 | fino a 15 s per leggere tre numeri. Ora `/symbol-check` |
| Strisce di vicinanza | 2.0.18 | TP e stop **dall'entrata**, stop a profitto **dall'ultimo target raggiunto** |
| Rischio/capitale per sala | da pubblicare | `tgBaseDi(cfgSala, predefinita)` |
| Firebase: niente doppioni | da pubblicare | firma del contenuto: identico = non si scrive |

### 1.4 Strumento di misura delle prestazioni

**Impostazioni → Versione → «Misura le prestazioni (5 secondi)».** Dà risvegli dei timer al
secondo, costo medio di disegno e aggiornamento, **costo dei singoli pezzi del disegno**,
fotogrammi saltati, memoria, consumo Firebase, e quanto si è accumulato nelle memorie che crescono.

**Si usa così:** una misura quando l'app va bene, una quando rallenta. La differenza è la causa.

**La prima misura del proprietario (22 ottobre) ha già dato numeri importanti:**

```
disegnoMedio_ms       : 67.22     ← dieci volte il banco di prova
fotogrammiAlSecondo   : 25.6      ← dovrebbero essere ~60
scattoPeggiore_ms     : 1264      ← un blocco di 1,26 secondi
tickFootprint         : 197373
candele               : 50000
posizioniAperte       : 28
```

**AGGIORNAMENTO del 22 ottobre, pomeriggio: i tick sono diventati 752.683, la memoria 721 MB, e il
cambio asset blocca per 2.818 ms. Tutto misurato: vedi la sezione 7-bis.**

**Lo scatto da 1.264 ms è quasi certamente il salvataggio del registro tick** (sul banco: 100 ms
per 197k tick, e la sua macchina è ~10× più lenta). La cura è scritta sotto, al punto 7 della
roadmap: **salvare il registro a blocchi**, riscrivendo solo quello in coda. Il codice è già
pronto in uno script, vedi §4.

---

## 2. COSA NON TOCCARE (e perché)

1. **`rows` può essere la cache dell'aggregazione.** Mai mutare `fullAggCache` o `baseTimesCache`
   sul posto. (§1.2)
2. **La grazia dello spegnimento del ponte** (`/disconnect?grazia=1`, 90 s): toglierla fa
   staccare MT5 a ogni ricarica della pagina. Era un difetto segnalato tre volte.
3. **`tgMetaNota()`**: non aggirarlo riempiendo solo i decimali. Senza **dimensione del
   contratto** il lotto si calcola con quella di EUR/USD, su soldi veri. Se `/symbol-check` non
   dà tutti i numeri, si torna alla strada col grafico — è la prova di controllo di
   `apertura_senza_grafico.test.mjs`.
4. **Un comando di Syntra non va mai al server.** La condizione è
   `fblServer() && (tgSyntraVoluto() || fblPonteLocaleVivo===true)`: due segnali in OR, e nessuno
   dei due da solo basta. Pretendere la sonda era il difetto; ignorarla l'eccesso opposto.
5. **La firma delle scritture Firebase si aggiorna solo DOPO una scrittura riuscita.**
   Aggiornarla prima = credere di aver salvato = perdere dati.
6. **Il pareggio è ZERO.** Non rimettere margini "di sicurezza" nel calcolo del break-even: ne è
   già stato tolto uno che perdeva 2 € a operazione. (Il margine dello spread intorno alla
   chiusura del mercato è un'altra cosa, ed è il punto 4 della roadmap.)
7. **Le due tabelle posizioni (MT5 e Kraken) devono restare gemelle.**
   `kraken_posizioni.test.mjs` lo tiene fermo confrontando le colonne: se ne aggiungi una a una,
   aggiungila all'altra.
8. **Niente scritture su Firestore nel giro dell'autosalvataggio** (gira ogni ~800 ms). Il cloud
   si tocca solo quando cambia qualcosa di vero.
9. **`laboratorio/collauda.sh` non deve mai toccare il ponte MT5 del proprietario**: i test usano
   finti. È già stato un problema.

---

## 3. COME SI LAVORA QUI

- **Si misura prima di correggere.** In questa sessione ha evitato due correzioni inutili (i
  processi «doppi» che erano stub di PyInstaller; i popup con lo zoom che già rispettavano i
  bordi) e ha trovato quattro cause esatte.
- **Una correzione si dichiara fatta solo con un test che PRIMA falliva.** Si verifica mettendo da
  parte il file corretto e rimettendo quello di prima: il test deve diventare rosso.
- **Ogni test porta una prova di controllo**: qualcosa che deve restare vero, perché una cura
  troppo zelante è un difetto nuovo.
- **Commit a capitolo chiuso**, non a ogni modifica (deciso dal proprietario).
- **Quando si tocca `bridge.py`, `mt5_feed_server.py` o qualcosa sotto `installer_build/build/`,
  serve il Setup nuovo — e va detto.** Tutto il resto in `app.html` arriva da solo.
- **Attenzione alla shell**: scrivendo script Python come heredoc, la shell mangia i backslash.
  Usa file veri (`Write`), non heredoc, quando il codice contiene `\'` o `\n`. In questa sessione
  mi ha ingannato tre volte, una delle quali mi ha fatto contare 176 problemi che non esistevano.

---

## 4. LA RODMAP, nell'ordine deciso dal proprietario

Ordine richiesto: **3 (fatto), poi 5, 6, 7, 4, 2.**

### ✅ 3. Rischio o capitale per sala — FATTO, da pubblicare
`tgBaseDi(cfgSala, predefinita)` + tendina nella configurazione della sala. Campo vuoto = vale
l'impostazione generale. Test: `base_rischio_capitale.test.mjs`.

### 5. Sezione «Sale segnali» separata da «Collegamento»

**Richiesta del proprietario, parola per parola:** «non può stare tutto quanto all'interno di
collegamento. Le cose del collegamento saranno all'interno della pagina collegamento. Le cose che
riguardano la sala segnale, la cronologia, configurazione di apertura automatica e tutto quello
che riguarda le sale andrà proprio nella sezione sale segnali».

**Stato misurato:** il pannello `data-gensettings-panel="collegamento"` occupa le righe
**1852-2000** di `app.html` e contiene **entrambe le cose**:

| Resta in COLLEGAMENTO | Va in SALE SEGNALI |
|---|---|
| `tgStatusBox` (stato del ponte) | `tgGroupList` + `tgNewGroup` + `tgAddBtn` (elenco sale) |
| `tgPort`, `tgRefreshBtn` | `tgAutoBtn` (configurazione apertura automatica) |
| `tgToggleBtn` (collega Telegram) | `tgOpenPanelBtn` (pannello segnali) |
| `tgSetupBox`, `tgApiId`, `tgApiHash`, `tgSalvaCredBtn` | tutta la sezione **Syntra** (dalla riga ~1943) |
| `tgDimenticaTelBtn`, `tgTelefonoForgetBtn` | la cronologia delle sale (`fblCronoOverlay` si apre da qui) |

**Come si aggiunge una scheda:** cerca `data-gensettings-panel="versione"` per il modello completo
(pulsante nella navigazione + `<div data-gensettings-panel="sale">`).

⚠️ **ATTENZIONE, scoperto misurando:** nel markup ci sono **9 id duplicati**, quasi tutti in questa
zona:

```
liveModeSwitch x2, tgToggleBtn x2, tgDimenticaTelBtn x2, tgTelefonoSalvatoLbl x2,
tgTelefonoForgetBtn x2, tgSetupBox x2, tgApiId x2, tgApiHash x2, tgSalvaCredBtn x2
```

`getElementById` restituisce **il primo**, quindi oggi metà di quei controlli è morta e non se ne
accorge nessuno. **Vanno risolti PRIMA di spostare le cose**, altrimenti spostando il primo si
"accende" il secondo e il comportamento cambia in modo inspiegabile. Aggiungi un test che conti
gli id duplicati nel markup e pretenda zero: è tre righe e protegge per sempre.

### 6. I pacchetti di installazione si accumulano

**Segnalato:** 30-40 file nella cartella Download invece di uno sostituito.

**Cosa è già noto:** il nome del file lo decide il server (GitHub Releases), ma a scaricarlo è il
browser di sistema, che aggiunge `(1)`, `(2)`, `(3)`… Una pagina web **non può** sostituire un
file nella cartella Download: non esiste un'API che lo permetta.

**Le due strade, da far scegliere al proprietario:**
1. **Nome con la versione dentro** (`ForexBacktestLAB_Setup_2.0.18.exe`): i file restano tanti ma
   si capisce quale è quale, e i vecchi si cancellano a colpo d'occhio. Costa una riga nel flusso
   `installer.yml` + l'aggiornamento di `DESKTOP_APP_DOWNLOAD_URL` in `app.html` (riga ~33621).
   ⚠️ Il link `releases/latest/download/<nome>` richiede un nome **fisso**: con la versione dentro
   servirebbe leggere prima l'API delle release per sapere il nome esatto.
2. **Non scaricare più niente**: dopo la v2.0.15 l'app si aggiorna da sola, quindi il Setup serve
   solo quando cambia il ponte. Si può **nascondere il pulsante di download** quando la versione
   installata è già aggiornata — il pannello Versione sa già confrontarle.

**La seconda è migliore** e costa meno: il problema sparisce invece di essere gestito.

### 7. Le prestazioni che restano ⭐ il lavoro più utile

**7a. Lo scatto da 1.264 ms — il salvataggio del registro tick.**
**✅ FATTO il 22 ottobre 2026 (test verdi, collaudo locale verde) — da pubblicare.**
Realizzato come previsto, con due precisazioni che la misura ha imposto: la forma dei blocchi è
**compatta** (array tipizzati, 2,5 ms per blocco contro 24,5 ms con gli oggetti) e il tetto si
rispetta buttando via un **blocco intero** dalla testa (tagliare un tick alla volta lasciava i
blocchi stalati: lo script lasciato in `scratchpad/` era difettoso). Lo script applicato è
`laboratorio/strumenti/tick_blocchi_7a.py`; il test è `laboratorio/app/footprint_blocchi.test.mjs`.
I test obbligatori ci sono tutti (rilettura identica, vecchio formato leggibile, blocco pieno non
riscritto) più la prova di controllo sul taglio.
La cura è pronta e misurata: spezzare `footprintTickLogByAsset` in blocchi da 20.000 tick
(`ftick:<asset>:<n>`) e riscrivere **solo il blocco in coda**, con un indice (`ftickIndice`) e la
lettura che ricade sul vecchio blob unico se i blocchi non ci sono ancora.
Lo script completo è stato scritto ma **non applicato** (la sessione è finita prima): sta in
`scratchpad/tick_blocchi.py`; se non c'è più, le quattro parti sono:
`FOOTPRINT_BLOCCO=20000`, `saveFootprintTicksNow` che cicla sui blocchi confrontando le lunghezze
già scritte, `fblTickLeggiBlocchi()`, e la lettura all'avvio che prova prima i blocchi.
**Test obbligatori:** rileggere dopo aver scritto dà lo stesso registro; il vecchio formato si
legge ancora; un blocco pieno non viene riscritto.

**7b. Il costo del disegno - MISURATO, e il sospetto era sbagliato.** Vedi la sezione 7-bis piu'
sotto per i numeri completi. In breve: il disegno si mangia il 78% del tempo, ma tutti i pezzi
cronometrati insieme fanno il 3,4%. **Il 96,6% sta nel CORPO di `draw()`**, non nelle funzioni che
chiama - e il footprint, sospettato numero uno, costa meno di un millisecondo. Il passo successivo
e' aggiungere cronometri DENTRO draw(), sezione per sezione, e rifare la misura.
**✅ FATTO il 22 ottobre 2026 (test verdi, collaudo locale verde) — da pubblicare.**
23 cronometri di sezione dentro `draw()` (spenti di default, accesi solo dalla misura), riportati
nella misura come `sezioniDelDisegno_ms` e `sezioniTotale_ms`; aggiunti ai pezzi cronometrati anche
i candidati del cambio asset (`saveFootprintTicksNow`, `footprintRebuildBucketsForCurrentAsset`,
`caricaStoricoPerSaltoAGrafico`, `binanceKlines`). **La misura vera sulla macchina del proprietario
va ancora fatta** (pulsante «Misura le prestazioni»): il banco di prova ha disegni da meno di 1 ms
e non e' il suo carico.

**7c. Il degrado nel tempo** (parte fluido e peggiora). Serve il confronto di due misure, una
quando va bene e una quando rallenta. Già misurato e **scartato**: il registro tick al suo tetto
costa 28 ms da ricostruire, `update()` e `draw()` con 5.000 operazioni costano 3,7 e 6,4 ms.

### ✅ 8. Le tre richieste NUOVE del 22 ottobre — FATTE (da pubblicare)

Non erano nella roadmap: sono arrivate dopo, dal proprietario, e si chiudono tutte e tre qui.

**8a. La finestra PIP senza la barra «about:blank», e come seconda finestra dell'app.**
«deve essere una seconda schermata della STESSA applicazione, non un qualcosa collegato via
web ... la finestra non ha il logo come la pagina madre». La finestra era un `window.open('')` su
una pagina **vuota**: il browser la mostrava come una pagina web (barra delle informazioni del
sito con «about:blank», nessun titolo, nessuna icona). Ora si usa prima la **Document
Picture-in-Picture nativa**: finestra senza barra del browser, senza indirizzo, con lo STESSO
documento dentro (misurato dentro la finestra: **0 script, un solo canvas, il motore non
esiste** → un solo cervello, nessun doppio ordine). Fallback: il popup di prima, ma con l'icona
dell'app nel titolo e una **barra interna col logo e il nome «BacktestLAB FOREX EDITION»**.
Scartata di proposito la seconda istanza completa (`?pipSlot=N`): aprirebbe un secondo
collegamento a MT5/Capital.com.

**8b. Il puntatore sfasato in X e Y nel grafico.** Misurato: il canvas era **950 px di layout
contro 730 px a schermo** (scala UI 130%), il mirino cadeva 78 px a sinistra e 55 px in alto. La
causa è il **contro-zoom** della scala UI: sta sul `#chartWrap` e viaggia col nodo nella finestra
staccata, dove il body invece non è zoomato → il grafico si rimpiccioliva senza che nessuno lo
misurasse. Ora il contro-zoom si toglie quando il grafico cambia finestra e si rimette al
rientro; l'invariante tenuta in test è **`clientWidth == rect.width`**.

**8c. I cartellini di vicinanza anche sulla riga dei gruppi.** La riga del gruppo **non aveva la
striscia** e per questo aveva 14 celle invece di 15 (tutte le colonne spostate a sinistra). Ora
ogni posizione del gruppo ha il **proprio** cartellino e la riga del gruppo ha quello della
posizione **più vicina** a un livello (blu = stop a profitto, verde = TP, rosso = SL), con nel
titolo il numero della posizione dentro il gruppo.

Test: `laboratorio/app/pip_finestra.test.mjs`, `laboratorio/app/pip_puntatore.test.mjs`,
`laboratorio/app/gruppi_striscia.test.mjs` (6 casi, con la prova di controllo: con il file
originale vanno tutti rossi).

---

## 7-bis. LE MISURE VERE DEL 22 OTTOBRE (sulla macchina del proprietario)

Queste non sono stime: sono tre misure prese con lo strumento dentro l'app, sul computer dove il
difetto vive. **Leggile prima di toccare le prestazioni**, perché smentiscono due sospetti che
sembravano ovvi.

### Il ponte si aggiorna da solo: confermato

```json
{"status":"ok","app":{"versione":"2.0.19","da":"copia aggiornata",
 "cartella_aggiornamenti":"C:\\Users\\pietro\\AppData\\Local\\Programs\\Forex Backtest LAB\\app_aggiornata"}}
```

`"da": "copia aggiornata"` vuol dire che il ponte ha scaricato `app.html` e `sw.js` dal sito e sta
servendo quelli. **L'aggiornatore della v2.0.15 funziona.** Da qui in poi le modifiche ad
`app.html` arrivano senza reinstallare: serve il Setup solo per `bridge.py` e
`mt5_feed_server.py`.

### Misura 1 — muovendo il grafico

```
secondi               : 5
fotogrammiAlSecondo   : 27.5          (dovrebbero essere ~60)
scatti                : 19
scattoPeggiore_ms     : 267
disegni               : 121
disegnoMedio_ms       : 32.04
aggiornamenti         : 70
aggiornamentoMedio_ms : 2.6           ← update() NON e' piu' un problema
memoria_MB            : 721           ← era 111 due ore prima
tickFootprint         : 752683        ← erano 197.373
bucketFootprint       : 3193
operazioni            : 760
candele               : 50000
pezziDelDisegno_ms    : drawClosedTradeMarkers=131  krakenDisegnaGrafico=1  drawFootprintVpocLine=1
pezziTotale_ms        : 133
```

### Misura 2 — cambiando asset

```
fotogrammiAlSecondo   : 21.1
scatti                : 5
scattoPeggiore_ms     : 2818          ← un blocco di QUASI TRE SECONDI
disegni               : 14
disegnoMedio_ms       : 53.32
aggiornamenti         : 34
aggiornamentoMedio_ms : 2.46
memoria_MB            : 667
pezziDelDisegno_ms    : drawClosedTradeMarkers=15
```

### Cosa dicono questi numeri ⭐ (la parte che conta)

**1. Il costo NON e' nei pezzi che credevo.** In 5 secondi il disegno e' costato
`121 x 32,04 = 3.877 ms`, cioe' il **78% del tempo**. Ma tutti i pezzi cronometrati insieme fanno
**133 ms: il 3,4%**. `drawClosedTradeMarkers` e' il piu' caro dei tre e fa 1,1 ms per disegno -
**non e' lui**. E `drawFootprintCandle` non compare affatto: costa meno di un millisecondo, quindi
**il footprint e' innocente**, contro ogni aspettativa (era il sospettato numero uno).

> **Il 96,6% del costo sta nel CORPO di `draw()`**, non nelle funzioni che chiama: il giro sulle
> candele visibili, la griglia, la scala dei prezzi, gli indicatori disegnati in linea.
> **E' li' che va guardato**, e il modo giusto e' aggiungere altri cronometri DENTRO draw()
> (sezione per sezione) e rifare la misura, non ottimizzare a intuito.

**2. `update()` non e' piu' un problema.** 2,6 ms e 2,46 ms nelle due misure, contro i 21,47 di
quella presa col grafico vuoto. Quel 21,47 era un caso particolare (nessuna candela), e non va
inseguito.

**3. La memoria e' esplosa: 111 MB -> 721 MB in due ore**, e i tick del footprint sono passati da
197.373 a **752.683**. Il tetto e' `FOOTPRINT_MAX_TICKS_PER_ASSET = 150.000` **per asset**: con
cinque asset visitati si arriva proprio li'. Sono i due numeri che crescono insieme, e vanno
guardati insieme: 721 MB di memoria significano pressione sul raccoglitore, e ogni raccolta e'
uno scatto.

**4. Il cambio asset blocca per 2.818 ms.** E' il difetto piu' grosso rimasto, e non e' il
disegno (14 disegni in quella misura). Candidati, in ordine di probabilita':
- il salvataggio del registro tick su IndexedDB: **750.000 tick** da copiare (vedi 7a: con 197.000
  costava gia' ~1,2 s su questa macchina, e ora sono quasi quattro volte tanti);
- la ricostruzione dei bucket del footprint per il nuovo asset;
- la lettura dello storico del nuovo asset.
**Il modo per distinguerli:** cronometrare `saveFootprintTicksNow`,
`footprintRebuildBucketsForCurrentAsset` e il caricatore dello storico - si aggiungono all'elenco
`PEZZI_UPD` dentro `fblMisuraPrestazioni` e si rifa' la misura cambiando asset.

### L'ordine giusto per lavorarci

1. **7a — il registro tick a blocchi** (`tick_blocchi_DA_APPLICARE.py`). Con 750.000 tick e'
   diventato ancora piu' urgente di quando e' stato scritto: e' il candidato numero uno per i
   2.818 ms del cambio asset, e si risolve senza toccare il disegno.
2. **Altri cronometri dentro `draw()`**, poi una misura nuova. Senza, si ottimizza al buio: la
   prima misura ha gia' smentito due sospetti su due.
3. **Il tetto dei tick per asset.** 150.000 x 5 asset = 750.000 oggetti in memoria. Vale la pena
   chiedere al proprietario quanto storico di footprint gli serve davvero: se bastano le ultime
   48 ore, il tetto puo' scendere di molto e la memoria con lui.

### 4. Il margine dello spread solo intorno alla chiusura del mercato

**Richiesta:** il pareggio resta **zero** nelle condizioni normali, ma nella fase di chiusura e
riapertura del mercato si adotta il margine dello spread, tornando al pareggio esatto quando il
mercato si è stabilizzato. **Con un interruttore nelle impostazioni.**

**Da sapere prima di toccare:** il margine era stato tolto perché faceva chiudere in perdita di
~2 € ogni operazione (il proprietario l'ha segnalato come «cosa più importante di tutte»). Esiste
già `fblPareggioTroppoVicino` e il rifiuto quando lo stop cadrebbe dentro la forbice. La finestra
«chiusura/riapertura» è già conosciuta dall'app: cerca l'avviso prima della chiusura mercato e la
misura della forbice del rollover (v2.0.12).

### 2. Il replay

Quattro richieste distinte, tutte dal proprietario:

1. **Il P/L delle posizioni aperte in replay deve muoversi** come dal vivo, seguendo il prezzo
   della candela rivelata. «Qualche versione fa era già implementata, poi è stata tolta.»
2. **Si deve poter scegliere un'altra data senza uscire dal replay**: premendo di nuovo il tasto
   replay compare «nuova posizione» e ci si sposta avanti o indietro.
3. **Fermando l'avanzamento a metà candela si resta a metà candela.** Esempio suo: timeframe 15
   minuti, mancano 3 minuti alla chiusura, si preme stop → deve restare lì, non ricominciare dal
   minuto 15.
4. **Cambiando asset si esce automaticamente dal replay** e si carica l'ultimo prezzo.

**Dove guardare:** `replayAnimTick()` (riga ~22678, cadenza `REPLAY_FRAME_MS=50`),
`replayAvviaFormazione()`, `replayForm`, `liveReplayActive` (riga ~4246).
Il motore **misura l'orologio** invece di fidarsi della cadenza nominale: è già la correzione del
«a volte si blocca». La fluidità dovrebbe essere migliorata parecchio dalla correzione delle cache
(§1.2): **rimisurare prima di intervenire.**

---

## 5. L'EFFETTO «WOW» ALL'APERTURA — specifica da realizzare

⚠️ **Nota onesta:** il proprietario ricorda che questa parte era già scritta da OpenCode nel
repository. **L'ho cercata e non c'è**: né «wow» nei file di testo e nel codice (solo falsi
positivi in audio base64), né nella storia di git, né sotto i sinonimi (animazione, avvio,
apertura, benvenuto, schermata iniziale). Quella che segue è quindi **scritta da zero**.

### Cosa deve essere

I primi due secondi dell'app devono dire **cos'è questo prodotto**: uno strumento di trading
serio, costruito con cura. Non un logo che gira. L'app ha già tutto quello che serve per
raccontarsi da sola: un grafico a candele.

**La proposta: il grafico si disegna da solo.**

1. Schermo scuro (lo stesso `#0e141c` dell'app, nessuno stacco).
2. Le candele dell'ultimo asset usato entrano da sinistra, **una ogni ~12 ms**, come se il mercato
   le stesse formando. Non una dissolvenza: una **formazione**.
3. Mentre entrano, la scala dei prezzi a destra si "accende" riga per riga.
4. All'ultima candela, due linee tratteggiate (un TP verde e uno SL rosso) si estendono da sinistra
   verso destra in 300 ms.
5. Il nome dell'app compare **sotto**, piccolo, e svanisce: il protagonista è il grafico.
6. Totale: **1,5 secondi**, mai di più.

### I vincoli, che valgono più dell'effetto

- **Non deve ritardare l'uso.** L'animazione gira **sopra** l'app che sta già caricando: quando i
  dati veri sono pronti, l'animazione si dissolve in 200 ms — anche a metà. *Chi apre l'app per
  lavorare non deve aspettare la grafica.*
- **Si salta con un clic, un tocco o un tasto qualsiasi.**
- **Una volta sola per sessione**, e un interruttore in Style per spegnerla del tutto. Alla decima
  apertura della giornata l'effetto wow è un ostacolo.
- **Mai su una posizione aperta.** Se all'avvio ci sono posizioni reali, l'animazione **non parte**:
  chi riapre l'app con soldi a mercato vuole vedere i numeri, non uno spettacolo.
- **Costo zero quando è spenta**: niente timer, niente canvas, niente nodi.
- **Niente dati veri nell'animazione**: candele generate, non quelle del conto. Se il grafico vero
  non è ancora pronto, un'animazione con dati finti scambiata per reali sarebbe pericolosa.

### Come misurarla

Un test che verifichi: parte una volta sola; si salta col tasto; **non parte con posizioni
aperte**; quando è spenta non crea né timer né nodi; e che **non ritardi** il primo disegno vero
del grafico (è il vincolo che conta).

---

## 6. Dove sono le cose

| File | Cosa |
|---|---|
| `cervello/LEZIONI.md` | le regole imparate sul campo, con la data e il caso che le ha generate |
| `cervello/DIARIO.md` | cosa è successo, giorno per giorno, con le misure |
| `cervello/SCALETTA.md` | la lista dei lavori, aggiornata |
| `cervello/PUBBLICARE.md` | come si pubblica una versione |
| `cervello/ORACLE.md` | il server sempre acceso |
| `laboratorio/collauda.sh` | il collaudo completo (~11 minuti) |
| `laboratorio/app/*.test.mjs` | i test dell'app (browser vero) |
| `laboratorio/ponte/*.py` | i test del ponte |

**Prima di toccare qualunque cosa:** `cervello/PASSAGGIO-OPENCODE.md` e `cervello/LEZIONI.md`.
