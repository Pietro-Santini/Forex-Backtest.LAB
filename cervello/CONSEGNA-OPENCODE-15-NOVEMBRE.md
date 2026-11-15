# Consegna a OpenCode — 15 novembre 2026

Scritta da Claude per chi riprende il lavoro. **Leggi tutto prima di toccare un file.**

Se una cosa qui non torna con quello che vedi nel codice, **il codice vince**: fermati, misura, e
scrivi al proprietario cosa hai trovato. Non indovinare: in questo progetto girano **soldi veri**
su MT5.

Ultima versione pubblicata quando questa consegna è stata scritta: **v2.2.59**.

---

## 0. Le sei regole che non si discutono

1. **Mai persistere su disco o nel cloud le posizioni e gli ordini REALI di MT5.**
   `stripMt5TrackedForSave()` deve restare nel percorso di salvataggio. Fra finestre della stessa
   macchina invece si passano interi (`collectTradingSyncPayload`): è già così, non toccare.
2. **Credenziali e segreti non entrano nel repo.** Stanno in locale sul computer del proprietario.
3. **Sul server, la scorciatoia senza chiave vale SOLO per il prefisso `/dati`.** Non allargarla.
4. **Nessuna chiave Kraken reale sul server**: `/kraken/configura` con ambiente diverso da
   `"simulato"` deve continuare a rifiutare.
5. **Prima di ogni cura, una misura.** In questo progetto si è già pagato più volte lo stesso
   errore: curare una causa *supposta*. Scrivi il numero che hai misurato, non quello che ti
   aspetti.
6. **Una voce di diario non è una prova che una cosa esista: lo è un test.** Il 15 novembre si è
   scoperto che **sei voci su dodici** delle finestre duplicate erano già curate e segnate ancora
   «da fare», perché le misure erano scritte come prosa in `cervello/BUG.md` e il banco che
   citavano **non esisteva in nessun ramo**. Se trovi una voce senza banco, la prima cosa da fare
   è **rileggere il codice** e misurare, non fidarti.

---

## 1. Come si lavora qui

### 1.1 Dove sta tutto

- **`app.html`** — l'applicazione, un unico file di ~5,9 MB. Fine riga **LF** su tutto il file
  (verificato: 0 righe CRLF). Se usi uno script per modificarlo, non convertire in CRLF.
- **`installer_build/build/bridge.py`** — il ponte MT5 sulla porta 8000. **Una sola copia nel
  repo**, ed è il punto d'ingresso di PyInstaller: finisce compilato dentro l'eseguibile.
- **`installer_build/build/mt5_feed_server.py`** — il servizio candele sulla porta 8001.
- **`sw.js`** — il service worker; il suo `CACHE_NAME` è il numero di versione.
- **`laboratorio/app/*.test.mjs`** — 349 banchi che girano su Playwright sulla pagina vera.
- **`laboratorio/ponte/test_*.py`** — 45 file, 371 prove pytest.
- **`cervello/`** — la memoria del progetto. Leggi `LEGGIMI.md` e `REGOLE.md` prima di lavorare,
  aggiorna `DIARIO.md` a ogni rilascio.

### 1.2 I comandi esatti

Controllo di sintassi, **dopo ogni modifica ad `app.html`**, prima di qualunque altra cosa:
```bash
node laboratorio/strumenti/sintassi_app.mjs
```

Il collaudo completo, **circa 20 minuti** (gira in parallelo, 4 per volta):
```bash
bash laboratorio/collauda.sh
```
Deve finire con `Falliti: 0`. L'esito resta in `laboratorio/risultati/ultimo.md`.

Una prova sola:
```bash
node --test laboratorio/app/nome_della_prova.test.mjs
```

Il ponte, ~95 secondi, oggi **371 verdi**:
```bash
python -m pytest laboratorio/ponte -q
```

### 1.3 Il metodo

1. **Misura prima di curare.**
2. **Ogni cura si prova nei DUE versi**: la prova deve essere **rossa senza** la cura e **verde
   con**. Se è verde in entrambi i casi, la prova è muta.
3. **Prove di controllo, sempre.** Una prova che «misura il vuoto» passa e non dice niente. Il 15
   novembre due prove erano verdi per il motivo sbagliato (nessun messaggio arrivava affatto) e
   solo la prova di controllo lo ha smascherato.
4. **Mai modificare `app.html` mentre gira un collaudo.** Il suo esito diventa senza valore. È
   successo il 15 novembre: uno `sed` è fallito in silenzio e ha modificato il file vero durante
   il passo dei browser.
5. **Dopo ogni pubblicazione, guarda `gh run list`.** Controllare `CACHE_NAME` su `origin/main`
   dice solo che il file è arrivato, **non** che i controlli passano. Il collaudo di GitHub è
   rimasto **rosso per due versioni** senza che nessuno lo notasse.

### 1.4 Come si pubblica

Vedi `cervello/PUBBLICARE.md`. In breve: si alzano insieme `CACHE_NAME` in `sw.js`,
`FBL_VERSIONE` in `app.html` e `MyAppVersion` in `installer_build/installer.iss`; si committa; si
pubblica **sul ramo e su `main`**. L'hook `guardia_git.py` rifiuta il push su `main` senza un
collaudo verde di meno di 30 minuti.

**L'aggiornamento dell'utente funziona già così, non cercare altre strade:** il push su `main`
fa partire il flusso «Installer Windows», che crea da sé la release con
`ForexBacktestLAB_Setup.exe` allegato (~119 MB); il pulsante «Aggiorna» dentro l'app chiama
`POST /aggiorna-programma` sul ponte, che scarica quel Setup da
`releases/latest/download/` e lo avvia. Il ponte è dentro quell'eseguibile, quindi **si aggiorna
anche lui**. Nessuno zip da mandare a mano.

---

## 2. LAVORO 1 — Il timbro dello scarto sulle candele salvate

**Priorità: alta.** Tutta l'indagine è già fatta: qui sotto ci sono i numeri e le righe esatte.
Non rifare la ricerca.

### 2.1 Cosa ha chiesto il proprietario

> «Va bene procediamo, però non voglio che ricarica ogni volta l'intero storico, soltanto
> l'ultima parte aggiunta dopo l'ultima visualizzazione, sennò è una perdita di tempo. Quindi si
> riallinea in automatico con quello che c'è e quello che manca.»

### 2.2 Il problema, misurato nel codice

Lo scarto orario del broker viene applicato **dal ponte**, non dall'app:
`mt5_feed_server.py` riga ~738 pubblica `"time": int(r["time"]) - offset`. Dal 14 novembre quello
scarto è solido e ricordato su disco, quindi **i dati nuovi sono timbrati giusti**.

Le candele scaricate **prima**, quando lo scarto era misurato male, stanno nel magazzino locale
(IndexedDB) con i timestamp sbagliati. Il magazzino salva
`{tempo, open, high, low, close, volume, digits, ultimoTs, salvatoAt}` e **non registra con che
scarto quei tempi sono stati calcolati** (`fblCandeleCacheScrivi`, `app.html` ~riga 54058).

**Cosa succede oggi**, letto in `__loadLiveHistoryFromMt5Body` (~riga 53159): l'app confronta la
sovrapposizione fra magazzino e scaricamento nuovo cercando un `time` identico e poi controllando
che OHLC combacino. Se non combaciano, il ramo `else` fa **uno scaricamento intero**
(`count=200000`) e sostituisce tutto. Quindi **sul grafico non finiscono due orologi** — il
controllo li intercetta — ma il prezzo è esattamente lo scaricamento intero che il proprietario
non vuole.

### 2.3 Le tre cose che rendono la cura facile (già verificate)

1. **Il ponte dice già lo scarto che ha applicato.** `/history` restituisce
   `utc_offset_seconds_applied` (`mt5_feed_server.py` riga ~752). **L'app non lo legge**:
   `grep -c utc_offset_seconds_applied app.html` → **0**. L'informazione c'è e viene buttata.
   Non serve toccare il ponte.
2. **La correzione è una somma, non uno scaricamento.** Siccome il tempo pubblicato è
   `broker − scarto`:
   ```
   tempo_giusto = tempo_salvato + scarto_vecchio − scarto_giusto
   ```
   Esempio: scarto vero 7200, misurato 0 → le candele salvate sono 2 ore avanti → si sottraggono
   7200 secondi. Corrisponde al sintomo descritto dal proprietario.
3. **La sovrapposizione per misurare lo scostamento c'è già.** La coda si chiede così
   (riga ~53101): `mancanti = ceil((adesso − ultimoTs)/passoTF) + 200`. Quel **margine di 200
   candele** si sovrappone a quello che è in casa: basta confrontarle per ricavare lo scostamento
   esatto, **senza nessuna richiesta in più**.

### 2.4 Cosa fare, in ordine

1. **Timbrare la scrittura.** Aggiungi un parametro `scarto` a `fblCandeleCacheScrivi()` e
   salvalo nel record. Al punto di chiamata (~riga 53222) passa
   `body.utc_offset_seconds_applied`. `fblCandeleCacheLeggi()` lo restituisce.
2. **Riallineare quando il timbro c'è e differisce.** Prima di fondere, se
   `cache.scarto` è un numero finito e diverso da quello della risposta, sposta tutti i `tempo` (e
   rigenera i `date`) di `cache.scarto − scartoOra`. Poi prosegui con la fusione normale: la
   sovrapposizione combacerà e si aggiungerà **solo la coda**.
3. **Serie senza timbro (tutte quelle già in casa).** Non si sa con che scarto sono state scritte,
   ma si **misura** dalla sovrapposizione: cerca una candela salvata i cui OHLC combacino con una
   appena scaricata, e la differenza fra i due `time` **è** lo scostamento. Applicalo a tutta la
   serie e scrivi il timbro. Confronta **almeno tre punti** diversi della sovrapposizione: se
   danno lo stesso scostamento, applicalo; se discordano, la serie ha più orologi dentro (è
   possibile: a novembre un difetto ha prodotto uno scarto di −57600) e **solo allora** si rifà lo
   scaricamento intero.
4. **Dirlo nella barra di stato** quando una serie viene riallineata, con il numero di secondi:
   un riallineamento silenzioso è indistinguibile da un difetto.

### 2.5 Il banco da scrivere

`laboratorio/app/candele_timbro_scarto.test.mjs`. Prendi come modello
`laboratorio/app/candele_in_locale.test.mjs`, che ha già il `fetch` finto che **conta i `count`
richiesti** — è esattamente lo strumento che serve.

Prove necessarie:
- una serie col timbro **uguale** → si chiede solo la coda (`count` piccolo), nessuno scaricamento
  da 200000;
- una serie col timbro **diverso** → si riallinea per somma, e **non** si scarica tutto: il
  `count` richiesto resta piccolo (è la prova che il proprietario ha chiesto);
- una serie **senza timbro** con uno scostamento di 7200 → lo scostamento viene misurato dalla
  sovrapposizione, applicato, e il timbro scritto;
- una serie **senza timbro e coerente** (scostamento 0) → nessuno spostamento, solo il timbro;
- **prova di controllo**: una serie con punti di sovrapposizione discordanti → scaricamento intero
  (il ripiego deve esistere, altrimenti si riallinea a caso);
- i `date` rigenerati devono restare in forma ISO con la `Z`: una cura del 10 novembre ha pagato
  caro l'aver scritto le date senza fuso (ogni candela spostata di 5 ore).

### 2.6 Non toccare

I CSV importati a mano hanno il loro fuso (America/New_York) **per scelta**, documentata. Questa
cura non li riguarda.

---

## 3. LAVORO 2 — L'`actual` delle notizie dalle fonti ufficiali

**Priorità: alta.** Decisione del proprietario già presa, fra quattro strade proposte.

### 3.1 Cosa ha chiesto, e cosa ha scelto

> «Cerchiamo in qualche modo di prendere in tempo reale l'actual per le notizie appena viene
> pubblicato, che arrivano per le notizie medio/grave, arancioni/gialle/rosse.»

Messe davanti quattro strade (fonti ufficiali / feed a pagamento / leggere la pagina di Forex
Factory / lasciare vuoto), ha scelto: **fonti ufficiali per i dati che contano**.

### 3.2 Il fatto che rende necessario questo lavoro (già verificato, non riverificare)

La fonte attuale **non pubblica mai l'`actual`**. È scritto in `bridge.py` nel commento sopra
`_NEWS_FEED_URL`, con la verifica: `ff_calendar_thisweek.json` di faireconomy.media è un
calendario settimanale, e un FOMC Statement delle 14:00 controllato dopo le 16 aveva ancora
`actual: null`. **Non è un problema di frequenza**: il ponte già passa da 1 ora a **2 minuti**
quando un evento cade entro 20 minuti (`_NEWS_FAST_TTL_SECONDS`, `_NEWS_FAST_WINDOW_SECONDS`), e
l'app interroga ogni minuto (`NEWS_POLL_INTERVAL_MS`).

### 3.3 Cosa è già pronto per ricevere l'`actual`

Il 15 novembre l'archivio delle notizie è stato allargato (v2.2.59):
- `notizieVoce()` conserva `fore`, `prev`, `act` e il titolo fino a 120 caratteri;
- `notizieArchivioAggiungi()` **fonde** nei campi mancanti invece di scartare le notizie già
  presenti — era il difetto che avrebbe reso inutile tutto questo lavoro, perché l'`actual` esce
  **dopo** l'orario dell'evento e arrivava sempre su una notizia già archiviata;
- un valore che c'è non viene mai sostituito da uno vuoto;
- banco: `laboratorio/app/notizie_dettagli_archivio.test.mjs` (6 prove).

Quindi **basta far arrivare il valore**: l'archivio lo tiene, lo manda nell'account e sul disco E,
e il popup lo mostra anche in replay.

### 3.4 Le fonti, provate dal vivo il 15 novembre

| fonte | esito misurato | cosa dà |
|---|---|---|
| `https://www.federalreserve.gov/feeds/press_all.xml` | **200**, 14,6 KB | titolo, link, categoria, `pubDate` |
| `https://www.ecb.europa.eu/rss/press.html` | **200**, 5,9 KB | titolo, link, `pubDate` |
| `https://api.bls.gov/publicAPI/v2/timeseries/data/CUUR0000SA0` | **200** | serie CPI |
| Eurostat `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_manr?format=JSON&lastTimePeriod=1` | **200**, 245 KB | inflazione europea |

**Indirizzi che NON funzionano** (404 — erano tentativi, non fonti verificate): Bank of England
`boeapps/rss/feeds.aspx`, BIS `list/press_rlsea`, EIA `petroleum/supply/weekly/rss.xml`. Se
servono, i loro feed veri vanno cercati e **provati** prima di scriverli nel codice.

### 3.5 Cosa fare

1. **Nel ponte**, non nell'app: una rotta nuova `GET /news/actual` che interroga le fonti
   ufficiali e restituisce `{titolo-chiave, valore, quando}`. Nel ponte perché la cache deve
   essere **una per computer**: più finestre non devono moltiplicare le richieste (è l'errore
   misurato il 15 novembre sul ponte MT5 — da ~27 letture in 6 secondi con una finestra a ~83 con
   tre).
2. **Una tabella di corrispondenza** fra il titolo dell'evento nel calendario e la serie della
   fonte ufficiale. Comincia dai pochi che contano: `CPI m/m` e `CPI y/y` → BLS `CUUR0000SA0`;
   `Non-Farm Employment Change` → BLS `CES0000000001`; `Federal Funds Rate` → Fed;
   `Core CPI` → BLS. **Non inventare i codici delle serie: provali con una richiesta vera e
   scrivi nel commento l'esito.**
3. **Quando chiedere**: solo per eventi `High` e `Medium`, e solo in una finestra attorno
   all'orario schedulato (riusa `_NEWS_FAST_WINDOW_SECONDS`). Fuori da quella finestra non si
   chiede niente.
4. **Nell'app**: quando arriva un `actual`, passalo a `notizieArchivioAggiungi()` nella forma del
   feed (`{date, country, impact, title, actual}`). La fusione fa il resto.
5. **Se il valore non c'è**, il popup deve **dirlo** invece di mostrare un trattino muto: «valore
   uscito non disponibile da questa fonte».

### 3.6 Il banco

`laboratorio/ponte/test_news_actual.py` con le fonti **finte** (come
`laboratorio/ponte/test_scarto_server.py` fa con MetaTrader5): nessuna prova deve uscire in rete,
il collaudo gira anche su GitHub dove la rete esterna è bloccata.

---

## 4. LAVORO 3 — Divisione del grafico

**Priorità: media-alta.** È la richiesta del proprietario più grossa ancora intatta: più grafici
affiancati nella stessa finestra.

**Nessuna indagine fatta.** Prima di scrivere codice, misura:
- come è strutturato `#chartWrap` e quanto del disegno dipende da variabili globali (`rows`,
  `idx`, `currentTF`, `currentAssetKey`): sono globali, quindi due grafici nella stessa pagina non
  possono semplicemente coesistere;
- se la strada più breve è riusare il meccanismo delle **finestre duplicate**, che già isola lo
  stato per finestra (`PIP_SLOT`), invece di rendere locale tutto lo stato del grafico.

**Da chiedere al proprietario prima di partire**: quanti riquadri, se devono condividere l'asset o
no, e se il mirino e il replay vanno sincronizzati fra riquadri come fra finestre (fatto il 15
novembre, vedi `mirino_fra_finestre.test.mjs`).

---

## 5. LAVORO 4 — Le richieste minori ancora aperte

### 5.1 Copiare le impostazioni da un conto a un altro
Oggi ogni conto ha le sue. Il proprietario vuole poterle copiare. Guarda `sessionByMode` e
`fblContoVista`. **Attenzione**: una cura del 13 novembre ha scoperto che `sessionByMode`
trasportava anche i **disegni** fra finestre, cancellando quelli della madre. Qualunque copia fra
conti deve dichiarare **esattamente** cosa copia, e i disegni restano liberi per finestra.

### 5.2 Il ponte deve accorgersi se cambi conto nel terminale
Oggi il cambio conto lo deve fare l'app; se lo fai a mano in MT5, il ponte non se ne accorge.
Esiste già `mt5RiagganciaSilenzioso()` che legge `GET /account`. Serve che il ponte **confronti**
periodicamente il conto del terminale con quello che crede attivo e lo annunci.

### 5.3 La domanda sulla prop firm che ritorna
La memoria per conto è stata scritta e ha il suo banco, ma il proprietario l'ha segnalato di
nuovo. **Non è riproducibile sul banco**: va riprodotto sul suo PC con i conti veri. Non curare a
intuito.

### 5.4 Togliere Tailscale del tutto
Tre passaggi già individuati in `cervello/PROGETTO-VIA-TAILSCALE.md`, nessuno eseguito.

---

## 6. Debito tecnico (non si vede usando l'app, ma costa)

1. **31 banchi che dipendono dall'orologio** — possono diventare rossi a una certa ora o in un
   certo giorno senza che nulla sia rotto. Vanno resi indipendenti dall'ora congelando il tempo.
2. **Log e cartelle che nessuno pulisce** — 16 MB di log, 602 MB di profilo, cartelle temporanee
   da 0,4 a 0,8 GB. Serve una pulizia periodica nel ponte.
3. **Tre letture dal cloud a ogni finestra** — si pagano (Firebase si paga **a banda**, vedi
   `cervello/`). Si accorpano come si è fatto col ponte MT5 il 15 novembre.
4. **Due file `.spec` che non usa nessuno** — da togliere.

---

## 7. Cose che NON devi fare tu

Queste richiedono il proprietario davanti al PC, con il ponte MT5 collegato. Sul banco **non si
riproducono**, e un banco verde non chiude una segnalazione vista dal vivo:

- **il grafico della duplicata che resta piantato sul caricamento** (il tetto di 30 secondi c'è
  dal 12 novembre, ma la causa del blocco non è provata);
- **l'elenco asset incompleto sulla seconda duplicata** (sul banco prima e seconda hanno lo stesso
  elenco della madre: probabile che dipenda da **quando** nasce la finestra);
- **le operazioni sul disco E**: i documenti ci arrivano (misurato: 2 righe), i `trades` sono
  ancora 0 e serve una chiusura vera per vederli;
- **la memoria che arriva a 15,8 GB**: misurata piatta a 1,2 GB per sette minuti, non si riproduce
  a comando. **Senza causa**: non curare niente a intuito.

---

## 8. Le trappole già pagate (non ripagarle)

1. **`page.evaluate(fn, arg)` accetta UN SOLO argomento.** Per passarne più di uno, mettili in un
   oggetto. Ci si è già cascati.
2. **Il grafico sta sotto il bordo della finestra** (`y=855`, altezza 720): `page.mouse.move()`
   muove il mouse **vero** in coordinate della finestra, quindi non entra mai nel grafico e il
   banco misura «non manda niente» mentre il programma è giusto. Serve
   `scrollIntoView()` prima, e un controllo che sotto il cursore ci sia davvero un elemento.
3. **L'annuncio dell'asset fra finestre svuota le candele della seconda finestra**
   (`asset_announce` → `applyRemoteAssetSwitch` → cancella e ricarica). In un banco sul canale fra
   finestre va messo da parte, o misurerai difetti di un'altra funzione.
4. **Il collaudo locale gira su Windows, quello di GitHub su Ubuntu.** Una prova che dipende dal
   sistema **si traveste**, non si salta: `aggiorna_programma_dettaglio()` esce subito con «vale
   solo su Windows» se `os.name != "nt"`, e la prova relativa è rossa su Linux finché non si
   falsifica `os.name`. Saltarla con uno `skipif` toglierebbe il rosso **e** il controllo.
5. **`--collect-all` di PyInstaller vuole il nome del MODULO, non del pacchetto PyPI**:
   `google.auth`, non `google-auth`. Con quello sbagliato raccoglie 0 file e l'exe parte e crasha.
6. **Niente commenti `REM` dentro un comando `cmd` continuato con `^`**: diventano argomenti di
   PyInstaller. Vanno sopra il comando.
7. **Zero non è un prezzo.** `Number(null)` vale 0 ed è finito: una chiusura giornalizzata a 0
   falsa il conto. Il ripiego esiste già (`fblPrezzoRipiegoChiusura`), usalo.
8. **Esito sconosciuto ≠ rifiuto.** Il ponte risponde 502 quando il terminale non risponde
   all'invio: l'operazione **potrebbe** essere stata eseguita. Non si ritenta mai, si rilegge.

---

## 9. Dove sta il resto

- `cervello/DIARIO.md` — cosa è cambiato, versione per versione, coi numeri misurati.
- `cervello/BUG.md` — i difetti; **la sezione F è stata rimisurata il 15 novembre**, leggila
  prima di fidarti delle sezioni più vecchie.
- `cervello/RICHIESTE-DUPLICA-FINESTRA.md` — le finestre duplicate, con la verifica del 15
  novembre in testa: sei voci su dodici erano già curate.
- `cervello/PROGETTO-TABELLA-NOTIZIE.md` — il progetto futuro della tabella notizie in tempo
  reale, con le fonti già provate. Issue GitHub **#7**.
- `cervello/LEZIONI.md` — gli errori di metodo già fatti. Leggilo: costa cinque minuti e ne fa
  risparmiare giorni.
