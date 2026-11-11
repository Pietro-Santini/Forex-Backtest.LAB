# CONSEGNA A CLAUDE — 11 novembre 2026 (sera)

Documento scritto a mano da chi ha lavorato fino ad ora, per passarti il lavoro **senza farti
rifare le misure**. Leggilo tutto prima di toccare qualunque cosa: le trappole costate oggi sono
scritte in fondo, e una di esse (un nome di variabile sbagliato) è costata due ore.

---

## 1. DOVE SIAMO — stato verificato, non ricordato

- **Pubblicata la v2.2.28** (`8efe94d`), collaudo di GitHub **verde** (`success`) e pagine pubblicate.
  Il collaudo locale prima del commit era verde: **0 falliti** (1.382 test browser + ponte Python +
  sintassi + versione SW).
- **Specchio Desktop** (`C:\Users\pietro\Desktop\trading\backtest app\applicazione\app.html`)
  riallineato a `8efe94d`: 5.541.596 byte, 0 CR, identico alla copia di lavoro.
- **APK chiuso per questa versione**: la copia in `mobile/android/app/src/main/assets/public/app.html`
  è rifatta con la strada ufficiale (`mobile\aggiorna_www.bat`) e l'APK allegato alla release 2.2.28
  risulta **byte-identico** a quella copia (`FBL_VERSIONE_BUNDLE='2.2.28'`, `sw.js` → `v2.2.28`).
  **ATTENZIONE**: questo chiude solo la copia dentro l'APK. La segnalazione **A** qui sotto dice che
  sui telefoni l'aggiornamento NON arriva lo stesso: non è un problema di file, è un problema di
  canale. Non considerarla chiusa.
- **Lavoro in corso NON committato**: `cervello/DIARIO.md` (voce della 2.2.28), `cervello/LEZIONI.md`
  (lezioni 35, 36, 37) e questo documento. Il proprietario ha deciso che **la voce di diario va
  committata insieme alla prossima cura di codice**, non da sola (una commit solo diario aprirebbe
  una release vuota).
- Nel repo ci sono molti file `*.mjs` non tracciati in `laboratorio/` (misure e diagnostiche):
  **non sono `*.test.mjs`, il collaudo non li gira.** Non sono spazzatura, ma neanche roba da
  committare: lasciali dove sono.

---

## 2. LE REGOLE DEL PROPRIETARIO (non sono suggerimenti)

1. **Rispondere, commentare, committare in italiano.** Nessun identificativo di modello, in nessun
   commit, file o messaggio. Nessuna chiave API nel repo.
2. **Versione alzata a OGNI commit che tocca l'app**: `sw.js` (`CACHE_NAME`) e
   `installer_build/installer.iss` (`MyAppVersion`). Senza, la pagina rilasciata resta nella cache
   vecchia.
3. **Il collaudo di GitHub è la verità.** Quello locale verde non basta: si pubblica e si aspetta
   l'esito di GitHub.
4. **Un banco rosso non si committa.** Se un banco misura un difetto ancora aperto, sta FUORI da
   `laboratorio/app/` (per esempio in `banchi_aperti`, vedi §5) e il caso è annotato in
   `cervello/PROBLEMI-APERTI-2026-11-07.md`. (Lezione 31: pubblicare con un banco rosso noto ha
   reso rosso il collaudo di GitHub e rotto una release.)
5. **Ogni cura ha un banco che misura il COMPORTAMENTO**, non il testo del sorgente. Rosso senza,
   verde con.
6. **Misura prima di correggere**: riproduci il difetto e trova la causa con numeri.
7. **Mai `git reset --hard`, mai `--force`, mai riscrivere la storia.** Le operazioni distruttive si
   chiedono. Soldi veri mai: solo demo/simulato.
8. **Dopo ogni rilascio si riallinea lo specchio Desktop** con
   `git show <commit>:app.html` scritto con Python (la redirezione PowerShell scrive UTF-16 e
   corrompe il file).
9. **Il repo vero è `C:\Users\pietro\Documents\GitHub\Forex-Backtest.LAB`.** La cartella Desktop è
   solo uno specchio.

---

## 3. CHE COSA RESTA

> **Le tre voci A, B, C sono le segnalazioni della sera dell'11 novembre 2026, fatte dal proprietario
> a voce. Non sono ancora misurate: la prima cosa da fare per ognuna è RIPRODURRE il difetto con un
> numero, non correggerlo a intuito.** Le voci dalla D in giù sono quelle già in corso.

### A. L'AGGIORNAMENTO NON ARRIVA SUL TELEFONO E NON SI VEDE SUL PC  ← P0, da misurare per prima

**Cosa dice il proprietario, testuale:**
«abbiamo ancora problemi per quanto riguarda il download dell'applicazione sia sul PC che sui
dispositivi mobili. Quando aggiorno il software sul PC, l'aggiornamento di gira anche sui
dispositivi mobili — che in realtà non è così. Il pulsante Aggiorna non viene mostrato, quindi sui
dispositivi mobili l'applicazione non si aggiorna. È come se ai dispositivi mobili arrivasse scritto
che l'aggiornamento è stato fatto, mentre invece non è stato fatto.»

**Cosa si capisce da qui (e cosa NO):**
- il telefono **dice di essere aggiornato** (o comunque non mostra il pulsante) anche quando la
  release è più nuova di quello che gira sul telefono;
- quindi il telefono resta sulla versione vecchia **senza avviso**, e chi guarda non lo sa;
- il problema esiste **sia sul telefono sia sul PC**: anche sul PC il pulsante «Aggiorna» non compare
  quando dovrebbe.

**Cosa NON sappiamo ancora (da misurare, non da supporre):** quale versione il telefono crede di
avere, e da dove la legge. Le strade possibili sono già nel codice e vanno percorse una per una con
un numero:

1. `fblVersioneProgrammaInstallato()` chiede al ponte `/versione-programma`: sul telefono il ponte
   non c'è, quindi torna `''`.
2. `fblVersioneInstallata()` ripiega sulla cache del service worker, poi su `fetch('sw.js')`, poi su
   `FBL_VERSIONE_BUNDLE` (nel bundle dell'APK). In un APK Capacitor **i file sono impacchettati
   dentro l'app** (`capacitor.config.json` non ha `server.url`): `caches` e `fetch('sw.js')` possono
   non comportarsi come sul browser. Se una di queste strade risponde una versione **sbagliata per
   eccesso**, il confronto dice «sei all'ultima» e il pulsante non compare.
3. `fblControllaAggiornamento()` decide con `nuova = assetCompleti && (!installata || ...)`: se
   `installata` è vuota mostra il pulsante, se è sbagliata per eccesso non lo mostra.
4. Sul PC la pagina la serve il **ponte**, che può servire una copia congelata dentro l'eseguibile
   (è il difetto già visto e scritto in `cervello/BUG.md`, sezione «il pulsante non compare e la
   versione si aggiorna da sola»).

**La misura da fare (banco nuovo):** per ognuno dei tre stati (PC col ponte che serve la copia
vecchia, telefono/APK col bundle vecchio, pagina servita da GitHub Pages) far dire all'app **quale
versione crede di avere** e **quale vede pubblicata**, e verificare che il pulsante compaia esatto
in quelle tre situazioni. Il sintomo da misurare è uno solo: *il telefono (e il PC) devono sapere di
essere indietro e dirlo*.

**Da guardare anche:** `cervello/GUIDA-APK-AUTOMATICO.md` (come viene costruito l'APK a ogni
release), `cervello/BUG.md` § «Ogni release senza APK rompeva il collegamento per Android» e § «il
pulsante non compare», il banco esistente `laboratorio/app/aggiornamento_apk.test.mjs`.

### B. LA DASHBOARD NON SI AGGIORNA IN TEMPO REALE  ← P1, da misurare

**Cosa dice il proprietario, testuale:** «abbiamo ancora problemi per quanto riguarda
l'aggiornamento in tempo reale dei dati della dashboard».

**Cosa manca per poter lavorare:** sapere **quale riquadro** e **in quale situazione** (PC o
telefono, MT5 collegato o no, più finestre aperte o una sola). Chiedere uno screenshot col riquadro
fermo e l'ora, oppure il nome del riquadro. Le strade candidate, da misurare una per una:

- **Dati del conto MT5** (capitale, margine libero, P/L, ultimo trade chiuso): arrivano da
  `fetchMt5AccountInfo()` (polling) e `fetchMt5AccountHistory()`; `mt5StatsActive()` decide se
  mostrarli. Se il polling è spento o la risposta è 400 «Non connesso», il riquadro resta com'era.
- **Dati dal cloud** (dashboard conti, equity, posizioni fra dispositivi): gli ascolti `onSnapshot`.
  È annotato nel DIARIO che il sostituto `serverDatiAscolta` **esiste e non viene mai chiamato**: se
  è quello il riquadro, la cura è lì, non nel polling MT5.

### C. POSIZIONI E PROFITTI CHE SI SOMMANO FRA DUE ACCOUNT  ← P0, da misurare

**Cosa dice il proprietario, testuale:** «se apro una posizione su un account e poi la apro su un
altro account, mi si sommano le posizioni e i guadagni/profitti, quindi è tutto squilibrato sotto
questo punto di vista e va risolto.»

**Perché è grave e perché non è la stessa cura della 2.2.28:** lì abbiamo curato il **grafico** (le
posizioni di un altro conto non devono essere disegnate). Qui il proprietario parla di **somme**:
posizioni e profitti messi insieme, quindi un conto che mostra il lavoro dell'altro. È lo stesso
principio violato, ma in un posto diverso.

**Dove guardare (ipotesi da verificare, NON cause accertate):**
- il grafico e la tabella «Posizioni aperte» hanno il filtro per conto curato ieri: va verificato che
  la **stessa** somma non compaia da un'altra parte (journal, statistiche, equity, dashboard conti);
- `mt5AttivaConto()` quando il conto cambia **parcheggia** le posizioni dell'altro conto e riprende
  le sue: se il parcheggio/ripresa sbaglia, le posizioni restano nel conto sbagliato e i profitti si
  sommano;
- `fblContoEffettivo()`, `currentMt5AccountTag()` e il «conto per asset»: se unasset viene associato
  al conto sbagliato, i P/L finiscono nel totale sbagliato;
- `closeTrade()` scrive nei globali della **sessione corrente** (lo stesso punto che blocca la voce E).

**La misura da fare (banco nuovo):** apri una posizione sul conto A, passa al conto B, aprine una
anche lì; poi verifica **uno per uno** e con un numero: quante posizioni nel grafico, quante righe
nella tabella, quante operazioni nel journal, qual è il P/L totale mostrato, com'è l'equity. Il
risultato giusto è: **sullo schermo del conto B deve esserci solo il lavoro del conto B** (l'altro
resta parcheggiato e torna quando si torna su A).

### D. REPLAY SINCRONIZZATO FRA FINESTRE  ← **pronto, si chiude in mezz'ora**

Richiesta del proprietario (10 novembre 2026): «se abbiamo delle pagine duplicate e scegliamo di
entrare in modalita' replay su una delle pagine, prima di tutto tutte le altre pagine mi vanno in
modalita' replay con il conto associato in storico.»

**Stato: la misura è fatta, il banco è scritto ed è ROSSO per il difetto giusto, la cura è pronta.**

- **Banco**: `C:\Users\pietro\AppData\Local\Temp\opencode\banchi_aperti\replay_sync_finestre.test.mjs`
  (6 prove: ingresso, simmetria, «conto dello storico», piu' due non-regressioni e il controllo del
  file). Oggi, SENZA cura: **3 rossi / 3 verdi** — i tre rossi misurano esattamente il difetto:
  - madre entra in replay (`masterTime=1792491000000`, riga 10) e la duplicata resta fuori
    (`replay:false`, `masterTime` = ultima candela, tasto STOP nascosto);
  - la simmetria non funziona (entra la duplicata, la madre non segue);
  - la modalita' backtest («conto dello storico») non viaggia con l'ingresso.
  - le due non-regressioni sono **verdi** e devono restarlo: in Storico l'orologio continua a
    passare (3 minuti esatti), e una pagina in Storico non entra in replay da sola.
- **Cura**: `C:\Users\pietro\AppData\Local\Temp\opencode\banchi_aperti\cura_replay_ingresso.py`
  (copia di `progetto_replay_ingresso.py`). Prova a secco **gia' fatta e passata**: trova tutte e 8
  le ancore sull'`app.html` di oggi. Le ancore sono espressioni regolari tolleranti
  sull'indentazione, cercano il CONTENUTO della riga, non il numero.
  La cura in 7 punti: blocco nuovo con `broadcastReplaySync()`/`applyRemoteReplaySync()`, campo
  `replay` in `broadcastChartTimeSync()`, due guardie in `applyRemoteChartTimeSync()`, ramo
  ricevente `chart_time_sync` anche in replay, ramo ricevente `replay_sync`, annuncio in
  `avviaReplayLive()` e in `esciReplayLive()`. Il ciclo si evita perche' BroadcastChannel non
  consegna a chi ha mandato e `broadcastReplaySync()` tace se `applyingRemoteReplaySync`.
- **Misura di supporto** (non serve, ma utile): `banchi_aperti\replay_sync_misura.mjs` e
  `laboratorio\replay_sync_misura.mjs` (il rapporto finisce in `laboratorio/risultati/`).

**Come si chiude (passi precisi):**
1. `python .../banchi_aperti/cura_replay_ingresso.py` (applica la cura all'app.html del repo).
2. `node laboratorio/strumenti/sintassi_app.mjs` → «5 script, 0 errori».
3. Copia il banco in `laboratorio\app\replay_sync_finestre.test.mjs` e gira:
   `cd laboratorio; cmd /c "node --test app/replay_sync_finestre.test.mjs"` → deve diventare **6/6**.
4. Se qualcosa resta rosso, **leggi l'AVVISO stampato dal banco**: oggi riporta gli stati delle due
   pagine, ed è quello che dice se la cura ha attraversato il canale.
5. Collaudo completo (§6), poi bump a **2.2.29**, commit (dentra anche la voce di DIARIO), push,
   attesa GitHub, riallineo specchio.

### E. POSIZIONE TRACCIATA IN UN'ALTRA SESSIONE: MAI RICONCILIATA

Una posizione reale tracciata in una sessione che **non è quella a schermo** non viene mai
riconciliata: se il broker la chiude (TP), resta nella tabella di quella sessione. È il caso che
abbiamo lasciato fuori dal commit (banco rosso).
- Banco con il caso ancora rosso: `banchi_aperti\posizioni_chiuse_tablet.test.mjs` (in repo c'è la
  versione ridotta ai soli casi curati).
- **Il punto difficile, misurato**: `closeTrade()` (riga ~24610 di app.html) scrive sempre nei
  globali della sessione corrente (`positions`, `trades`, saldo). Per curare serve far scambiare i
  globali (e il saldo) al giro di riconciliazione. **Va progettato, non rattoppato.**

### F. `/orders` NON DICHIARA DI CHE CONTO È (P2, aperto oggi)

La cura 2.2.28 fa dichiarare il conto a `/positions` (header `X-MT5-Login`/`X-MT5-Server`); `/orders`
non lo fa ancora, quindi un ordine pendente di un altro conto, quando scatta, viene taggato col
conto che l'app crede suo. Curarla con un banco che misura la promozione di un ordine scattato
mentre il ponte è su un altro conto (oggi in `fetchMt5Orders` si usa `currentMt5AccountTag()` ed è
scritto il perche' nel commento). Annotato in `cervello/PROBLEMI-APERTI-2026-11-07.md`, §
«/orders NON DICHIARA DI CHE CONTO E'».

### G. MERCATO CHIUSO: QUALE OROLOGIO DECIDE LA CHIUSURA (P0)

`cervello/PROBLEMI-APERTI-2026-11-07.md` § «P0 — MERCATO CHIUSO». Ipotesi da verificare (non
ancora misurata): `liveSessionPhaseNow()` e `fblMercatoFermoOra()` giudicano sull'orologio del
DISPOSITIVO, mentre MT5 gira sull'orologio del servizio, che l'app già misura in
`mt5ScartoOrologioMs` / `mt5Adesso()`. **Serve la misura del proprietario con MT5 collegato** (il
pannello prestazioni riporta già il campo `orologio`). Non inventare la soluzione prima di quel
numero. Ci sono anche i due punti sui quali servono gli screenshot del proprietario:
- «LINEE ENTRY/TP/SL DEGLI ORDINI PENDENTI NON SI VEDONO A MERCATO CHIUSO» (§ P1 dello stesso file);
- il badge «Mercato chiuso» quando a fermarsi è l'alimentazione dati MT5, non l'orario.

### H. DISCO E: LA CARTELLA DATI RESTA VUOTA (P0)

`E:\Forex Backtest Lab\dati` è vuota. **Diagnosi non iniziata**: misurata solo la cartella. Non
toccare niente finché non si sa chi ci dovrebbe scrivere.

### I. TUNNEL / PROXY INVENTATO (R1 → R2)

Annotati come bloccati per mancanza di dettagli:
- **R1**: reverse proxy `/segnali/*` → porta 8769 sul server Oracle;
- **R2**: tunnel inverso dal PC dell'utente verso il server.
Servono i dettagli del server Oracle (indirizzo, chi ha i permessi, com'è fatta la rotta WebSocket).
Nel frattempo Tailscale deve **sparire**: il brief per questa strada è già scritto in
`cervello/PROGETTO-VIA-TAILSCALE.md`.

### J. FIREBASE: LA BOLLETTA (monitoraggio)

Cure della 2.2.27 applicate (tetto persistito, riletture allentate fuori dal Live, letture contate,
keepalive sotto tetto; banco `laboratorio/app/cloud_bolletta.test.mjs` 2/2). **Da rifare tra 24 h:
guardare la console Firebase e confrontare col pannello dell'app.** Se la rampa non si è fermata, il
prossimo colpevole è elencato nel DIARIO: i 4 ascolti `onSnapshot` (il sostituto
`serverDatiAscolta` esiste e **non viene mai chiamato**) e le Cloud Functions (in particolare
`notionSyncTick` su timer ogni 15 secondi).

### K. IL RESTO DELLA LISTA (in `cervello/PROBLEMI-APERTI-2026-11-07.md`)

In ordine di come sono elencati li: disegno lento con tante candele (P1), aggiornamento in un click
solo (P1), finestre duplicate con dati che spariscono al clic (P1, curato in v2.1.4 da verificare sul
PC), crash da solo (P0, curato in v2.1.3 da verificare), un solo profilo volumetrico costa 86 ms
(P0), pulsante aggiorna che non compare (P0 — **attinenza con la voce A**), asse che arriva a
«adesso» invece di fermarsi alle 22:00 (P0), regressione sullo spostamento orizzontale (P1),
Firebase a mercato chiuso (P2), disco E (P0), Firebase troppe letture (P0), crash per una decina di
secondi alla riapertura (P0), grafico che perde candele in mezzo allo storico (P0), spostamento a
mano che non arriva all'ultima candela (P0 — curato, da verificare), linee entry/TP/SL a mercato
chiuso (P1).

**Già chiuso e con banco verde nell'ultimo collaudo** (non ci lavorare): «Prop Firm live con MT5
collegato NON deve chiedere login capital.com» → banco `laboratorio/app/prop_live_senza_capital.test.mjs`.

---

## 4. DOVE SONO LE COSE

| Cosa | Percorso |
|---|---|
| Repo vero (tutto il lavoro) | `C:\Users\pietro\Documents\GitHub\Forex-Backtest.LAB` |
| App (unico file grosso, ~59.000 righe, **tutto LF**) | `...\app.html` |
| Collaudo locale (~18-20 min) | `bash laboratorio/collauda.sh` con `C:\Program Files\Git\bin\bash.exe` |
| Banchi (collaudo = `node --test --test-concurrency=4 app/*.test.mjs`) | `laboratorio\app\*.test.mjs` |
| Ponte MT5 (Python, CRLF) | `installer_build\build\bridge.py`, `accesso_condiviso.py` |
| Memoria del progetto | `cervello\LEZIONI.md`, `cervello\DIARIO.md`, `cervello\PROBLEMI-APERTI-2026-11-07.md`, `cervello\BUG.md` |
| Specchio Desktop (da riallineare a ogni rilascio) | `C:\Users\pietro\Desktop\trading\backtest app\applicazione\app.html` |
| **Lavori in corso, banchi rossi e cure pronte** | `C:\Users\pietro\AppData\Local\Temp\opencode\banchi_aperti\` |
| Script delle cure (usa sempre `.py`, mai comandi inline in PowerShell) | `C:\Users\pietro\AppData\Local\Temp\opencode\` |
| APK: strada ufficiale | `mobile\aggiorna_www.bat` (copia + inietta versione + `npx cap sync android`) |
| APK: compilazione | `mobile\build_apk.bat` (ma lo fa gia' il flusso `apk.yml` a ogni release) |
| Aggiornamento dell'app (le strade della versione) | `fblControllaAggiornamento()`, `fblVersioneInstallata()`, `fblVersioneProgrammaInstallato()` in `app.html`; `cervello\GUIDA-APK-AUTOMATICO.md` |

---

## 5. LA TRAPPOLA DI OGGI (leggila, è la piu' cara)

**Un nome di variabile sbagliato è invisibile all'occhio e al controllo di sintassi.**
Nel banco del replay avevo scritto il parametro `contexto` (con la X, come la parola italiana) e nel
corpo `contesto` (senza X). Risultato: `ReferenceError: contesto is not defined` — e io ho letto e
riletto quel file decine di volte vedendo **sempre** `contesto` in tutte e due le righe, perche'
l'occhio normalizza la parola che si aspetta. Ho perso due ore a sospettare Playwright, la cache di
Node, i punti di giunzione, il runner dei test — e la prova isolata (le stesse due funzioni in un
file a parte, con un ponte finto) girava perfettamente, il che era l'indizio buono: **quando una
prova isolata funziona e la stessa riga dentro il file vero no, la differenza è nel FILE, non
nell'ambiente.** Alla fine `String.prototype.replace` ha detto qual'era la riga diversa: dopo aver
rinominato `contesto`→`cont`, il corpo cambiava e la firma no.

**Come si evita la prossima volta:** quando un identificativo «non è definito», stampare
`Function.prototype.toString()` della funzione e confrontarlo con il corpo **carattere per
carattere** (`[hex(ord(c)) for c in riga]`), invece di rileggere.

---

## 6. TRAPPOLE D'AMBIENTE (ti fanno perdere tempo)

- **PowerShell non ama le virgolette annidate**: gli script complessi si scrivono in
  `.../opencode/*.py` e si lanciano con `python`. Per piu' banchi:
  `cmd /c "node --test file1 file2 ..."`.
- **I log dei test escono in UTF-16LE** quando redirezionati: decodifica con
  `raw[:2]==b'\xff\xfe'` prima di leggerli, o leggerai spazi fra le lettere.
- **`app.html` è tutto LF**: mai farlo toccare da `git stash push/pop` — riscrive il file in CRLF
  (successo oggi: 5.600.010 byte con 59.153 CR; rifatto a LF a mano). Dopo uno stash, **verifica
  sempre** `b.count(b'\r')`.
- **I file del ponte (`installer_build/build/*.py`) sono CRLF**: leggi in universale, riscrivi con
  `newline='\r\n'`.
- **`app.html` non ha indentazione uniforme**: `fetchMt5Positions` sta su 3 spazi, altre zone su 5 o
  9. Le sostituzioni testuali devono usare l'indentazione esatta, e lo script deve **fermarsi** se
  un'ancora non è unica (non applicare mezza cura).
- **La rete può mancare** (oggi è caduta per ~20 minuti: `git push` fallito con «Could not resolve
  host»). Non è colpa tua: riprova, e nel frattempo lavora su cose che non richiedono rete.

---

## 7. SE VUOI CHIARIMENTI

Il proprietario risponde in italiano e vuole **una cosa per volta**, con la misura in mano. Le
decisioni gia' prese e discusse con lui (non riaprirle):
- con **conto MT5 non noto** l'app non attribuisce nessuna posizione con un login addosso (mostra 0
  per un istante, non quelle di un altro conto): è voluto, c'è la prova di controllo nel banco;
- il **conto MT5 si sincronizza** fra PC/tablet/telefono/finestre duplicate: ricevere l'annuncio di
  un altro conto e passare a quel conto è il comportamento richiesto, non un mescolamento;
- i **disegni** restano per ASSET, posizioni e ordini per conto;
- `tradeBelongsToCurrentView` **non si tocca**: nascondere i trade senza login farebbe sparire voci
  storiche del journal.

**Sulle tre voci nuove (A, B, C) il proprietario ha detto esplicitamente: «scrivile nel documento,
che Claude le affronta, e poi ne parliamo».** Quindi: misura, cura, banco — e solo dopo si discute
con lui.
