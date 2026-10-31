## Stato dell'implementazione

- **Passo 1 (salvataggio incrementale) — FATTO il 27 ottobre 2026 (rilasciato 2.0.32).**
  Le operazioni stanno in un documento a parte (`users/{uid}/data/trades`) e si aggiungono con
  `arrayUnion` (~259 byte per operazione nuova invece di 305 KB). Il documento session non porta
  piu' lo storico. `load()` unisce i due documenti e resta retrocompatibile. Anche il keepalive
  manda il documento senza operazioni. La misura riporta `cloudTradesInviati`.
  Difetto trovato per strada: la firma anti-doppioni non aveva mai funzionato (savedAt:Date.now()
  cambiava ad ogni raccoglimento) — ora calcola la firma sul contenuto stabile.
  Test: `laboratorio/app/cloud_incrementale.test.mjs` (3 prove, col comportamento misurato in byte;
  prova di controllo fatta: rimesso il file vecchio, il test diventa rosso).

- **Passo 2 (verifica del token Firebase sul server) — FATTO il 27 ottobre 2026.**
  Il server Oracle verifica il token ID di Firebase (firma JWT contro le chiavi pubbliche di Google,
  scadenza, audience = PROJECT_ID) e ne ricava l'uid. Nessuna rotta accetta un uid dal client.
  Implementato in `server_oracle/ponte_server.py`: funzione `verifica_token_firebase(token)` che
  restituisce l'uid o None, rotte `/dati/{nome}` (GET/PUT/PATCH), `/dati/trades/aggiungi` (POST),
  `/dati/trades` (GET) e WebSocket `/dati/ascolta` (manda solo {nome, versione}), archivio SQLite
  su `/dati/dati_utenti.db` (tabelle `documenti` e `trades`).
  Il controllo della chiave condivisa viene bypassato per `/dati/` (le rotte usano il token Firebase).
  Dockerfile aggiornato con `google-auth`. L'app non usa ancora queste rotte: restano pronte per
  il passo 3 (scrittura in due posti).
  Test: `laboratorio/ponte/test_passo2_token.py` (7 prove: token finto rifiutato, senza token
  rifiutato, nome documento non bypassa, verifica_token restituisce None, project_id corretto,
  tabelle create).


- **Passo 1 (salvataggio incrementale) — FATTO il 27 ottobre 2026 (commit in arrivo).**
  Le operazioni stanno in un documento a parte (`users/{uid}/data/trades`) e si aggiungono con
  `arrayUnion` (~259 byte per operazione nuova invece di 305 KB). Il documento session non porta
  piu' lo storico. `load()` unisce i due documenti e resta retrocompatibile. Anche il keepalive
  manda il documento senza operazioni. La misura riporta `cloudTradesInviati`.
  Difetto trovato per strada: la firma anti-doppioni non aveva mai funzionato (savedAt:Date.now()
  cambiava ad ogni raccoglimento) — ora calcola la firma sul contenuto stabile.
  Test: `laboratorio/app/cloud_incrementale.test.mjs` (3 prove, col comportamento misurato in byte;
  prova di controllo fatta: rimesso il file vecchio, il test diventa rosso).


# I dati a casa nostra: togliere Firestore, tenere login e abbonamenti

Deciso dal proprietario il 26 ottobre 2026, dopo che **la bolletta Firebase ha iniziato a salire
con un solo utente**: «vorrei adottare il sistema proprio per questa situazione e lasciare il login
e gli abbonamenti».

Questo documento è il progetto. Non è stato ancora implementato.

---

## 1. Cosa si sposta e cosa NO

Firebase oggi fa **quattro mestieri**. Solo uno costa.

| Mestiere | Dove sta | Decisione | Perché |
|---|---|---|---|
| **Login Google** (uid, token) | `firebase-auth` | **RESTA** | gratis a queste dimensioni e per sempre; rifarlo significa gestire password, reset, verifica email — tanto lavoro, zero risparmio, e il punto dove un errore si paga caro |
| **Abbonamenti Stripe** | Cloud Functions `createSubscriptionCheckout`, `createBillingPortal` | **RESTA** | due chiamate per abbonamento su 2 milioni/mese gratis; riscrivere un'integrazione di pagamento è la cosa più rischiosa dell'elenco |
| **4 documenti per utente** | Firestore: `session`, `grafico`, `collegamento`, `preferenze` | **SI SPOSTA** | è l'unica parte che si paga |
| **Ascolto in tempo reale** (`onSnapshot` × 4) | Firestore | **SI SPOSTA** | ogni modifica su un dispositivo è una lettura per ogni altro in ascolto |

---

## 2. Quanto pesa oggi (misurato, non stimato)

Con i dati veri del proprietario (760 operazioni chiuse, 13 disegni, footprint al tetto):

| Pezzo del documento `session` | Peso |
|---|---|
| **`trades`** | **194 KB — il 64%** |
| `footprintCells` | 106 KB |
| tutto il resto (campi, disegni, viste per asset) | ~5 KB |
| **Totale a ogni salvataggio** | **305 KB** |

**`trades` cresce per sempre.** Ogni salvataggio rimanda l'intero storico, comprese le operazioni
di mesi fa che non cambieranno mai più. Con 2.000 operazioni saranno 500 KB a scrittura.

> **Questo è il vero guadagno dello spostamento, più del costo.** Il modello di Firestore è «un
> documento, tutto o niente»: per aggiungere un'operazione si riscrive tutto. Con un'API nostra si
> manda **solo quello che è cambiato**. Spostare i dati senza cambiare questo vorrebbe dire solo
> spostare lo spreco dalla bolletta alla propria banda.

---

## 3. L'architettura

### 3.1 L'identità: il token di Firebase, verificato dal nostro server

Il client manda a ogni richiesta:

```
Authorization: Bearer <ID token di Firebase>
```

Il server lo **verifica** (firma JWT contro le chiavi pubbliche di Google, scadenza, `aud` =
l'ID del progetto) e ne ricava `uid`. Da lì in poi `uid` è la chiave di tutto.

**Questo chiude una debolezza già annotata** in `server_oracle/multiutente.py`: oggi l'identità si
regge su «il primo che arriva ha ragione», e il file stesso dice che quando gli utenti saranno
tanti servirà il token. Questa è l'occasione.

⚠️ **Da non sbagliare:** la verifica va fatta **sul server**, non fidandosi di un `uid` mandato dal
client. Un `uid` nel corpo della richiesta è una dichiarazione, non una prova: chiunque potrebbe
scrivere quello di un altro. In Python si usa `google-auth` (`google.oauth2.id_token.verify_firebase_token`)
o si verifica il JWT a mano con le chiavi pubbliche, con la cache delle chiavi.

### 3.2 Dove finiscono i dati

**Raccomandazione: SQLite.** Una tabella, un file, nessun processo in più.

```sql
CREATE TABLE documenti (
  uid        TEXT NOT NULL,
  nome       TEXT NOT NULL,          -- session | grafico | collegamento | preferenze
  contenuto  TEXT NOT NULL,          -- JSON
  versione   INTEGER NOT NULL,       -- cresce a ogni scrittura: serve agli ascolti e ai conflitti
  aggiornato INTEGER NOT NULL,       -- epoch ms
  PRIMARY KEY (uid, nome)
);
```

**Perché non MySQL**, visto che era stato proposto: il modello dati è «un blob JSON per utente» —
niente join, niente query complesse: MySQL risolverebbe problemi che qui non esistono. E l'Oracle
Micro ha **1 GB di RAM** con già dentro Python/FastAPI in Docker: aggiungere MySQL (più PHP e
Apache, se si volesse quello stack) significa **due impianti da mantenere** e memoria che non c'è.
Se un domani servisse davvero di più, Postgres è il passo successivo naturale, non MySQL.

**Perché non PHP**, visto che era stato proposto: il server parla già FastAPI e ha già i
WebSocket, l'autenticazione a chiave e il modulo multiutente. Aggiungere PHP vuol dire un secondo
linguaggio, un secondo server web, una seconda catena di aggiornamenti e una seconda superficie di
attacco — per fare le stesse quattro cose che il codice già lì fa in venti righe.

### 3.3 Le rotte

Tutte sotto `Authorization: Bearer <token>`, tutte su `ponte_server.py`.

| Rotta | Cosa fa | Sostituisce |
|---|---|---|
| `GET /dati/{nome}` | legge un documento (restituisce anche `versione`) | `getDoc` |
| `PUT /dati/{nome}` | sostituisce il documento | `setDoc` |
| `PATCH /dati/{nome}` | fonde i campi mandati | `setDoc(..., {merge:true})` |
| `POST /dati/trades/aggiungi` | **aggiunge solo le operazioni nuove** | *non esisteva: è il guadagno* |
| `WS /dati/ascolta` | spinge `{nome, versione}` a ogni modifica di questo utente | `onSnapshot` |

**Sull'ascolto:** si manda **solo l'avviso** (`nome` + `versione`), non il contenuto. Chi riceve
decide se leggere. Così un dispositivo che ha già quella versione non scarica niente — ed è
esattamente lo spreco che oggi si paga a Firestore.

**All'uscita della pagina** (`pagehide`) si usa `navigator.sendBeacon` verso `PUT /dati/session`:
funziona come il `keepalive:true` di oggi, con il token nel corpo perché sendBeacon non manda
intestazioni.

---

## 4. Come si passa senza perdere niente

**Mai un cambio secco.** Ci sono dentro conto, posizioni e Trade Journal di soldi veri.

1. **Si scrive in due posti, si legge da Firebase.** Nessun rischio: se la nostra API sbaglia, non
   se ne accorge nessuno. Si guardano i log per qualche giorno.
2. **Si legge dalla nostra, con Firebase come rete.** Se la nostra risponde male o è irraggiungibile,
   si ricade su Firestore. Si confronta che i due contenuti coincidano, e si registra quando no.
3. **Si spengono gli ascolti di Firestore** (`onSnapshot`): è la voce che costa di più e la prima
   da togliere quando la nostra regge.
4. **Si smette di scrivere su Firestore.** I documenti restano lì come copia finché non si è
   sicuri.
5. **Si cancellano.**

A ogni passo si può tornare indietro cambiando un interruttore. Un interruttore vero in
`localStorage`, non una modifica da ripubblicare.

---

## 5. Quello che diventa tuo (e prima non lo era)

Detto chiaro, perché sono i costi veri dello spostamento:

- **I backup.** Oggi li fa Google. Domani serve una copia del file SQLite fuori dal server, fatta
  da sola e **verificata** (un backup che non si è mai provato a ripristinare non è un backup).
- **La continuità.** Se l'Oracle cade, nessuno sincronizza più. Firestore non cadeva.
- **La sicurezza.** Lì dentro ci sono dati di trading: HTTPS, token verificato, e nessuna rotta che
  accetti un `uid` dal client.
- **Il piano gratuito Oracle può essere revocato** — è scritto nei loro termini per le istanze
  poco usate. Vale la pena saperlo prima, non dopo.

---

## 6. L'ordine in cui farlo

1. **Prima tagliare, poi spostare.** Il salvataggio incrementale delle operazioni
   (`POST /dati/trades/aggiungi`) toglie il 64% del traffico. Se si sposta prima e si taglia dopo,
   si costruisce un'API attorno a uno spreco.
2. **Verifica del token sul server** — è il pezzo su cui non si improvvisa.
3. **Le quattro rotte + SQLite**, con il doppio scritto del passo 1 della migrazione.
4. **Il WebSocket per gli ascolti**, che è quello che fa risparmiare di più.
5. **Lo spegnimento progressivo di Firestore**, un passo alla volta.

---

## 7. Prima di cominciare: un numero che manca

**Nella console Firebase, pagina Usage di Firestore, serve la ripartizione** fra letture,
scritture, traffico in uscita e spazio occupato.

Non è burocrazia: cambia cosa si fa per primo.
- se sono **letture** → gli ascolti in tempo reale, e si spengono per primi;
- se sono **scritture** → qualcosa salva troppo spesso, e va trovato PRIMA di spostarlo (altrimenti
  si sposta anche quello);
- se è **traffico** → sono i 305 KB per operazione, e il punto 1 li taglia da solo;
- se è **spazio** → è qualcosa che si accumula e che nessuno ha ancora guardato.

*Nota di metodo, dalla sessione del 22 ottobre:* cercando questa stessa causa avevo creduto di
aver trovato una tempesta di scritture ogni 1,5 secondi. Era un errore del mio confronto — misuravo
ogni giro contro il primo campione invece che contro il precedente. Rifatta la misura nel modo
giusto, quel meccanismo era stabile. **Senza i numeri della console si corregge il sospettato, non
il colpevole.**

---

## 8. LE PRESTAZIONI: non deve rallentare, deve accelerare

Chiesto dal proprietario: «questo rallenta la velocità di carico? Non vorrei mi rallentasse la
velocità di calcolo di tutta l'applicazione, e se riusciamo rendiamolo ancora più performante di
come lo è oggi».

**Misurato il 26 ottobre, coi suoi dati veri (760 operazioni chiuse):**

| | |
|---|---|
| Pacchetto di sessione | **196 KB** |
| Serializzarlo (`JSON.stringify`) | **0,40 ms** |
| Calcolarne la firma anti-doppioni | **0,83 ms** |
| **Una sola operazione chiusa** | **259 byte** |

### 8.1 Il caricamento NON è sul percorso critico, e deve restarci fuori

Oggi l'app legge **prima la copia locale**: se esiste ed è dell'account giusto, vince quella e il
cloud non viene nemmeno interrogato (vedi `localMatchesAccount` nel ripristino). Firestore si legge
**solo** quando in locale non c'è niente: dispositivo nuovo, o cache pulita.

> **REGOLA DA NON VIOLARE:** la nuova API non deve MAI finire sul percorso di avvio quando esiste
> una copia locale valida. Se qualcuno la mette lì «per avere sempre il dato fresco», l'avvio
> dipenderà dalla rete e dalla velocità del server — ed è il contrario di quello che è stato
> chiesto.

**L'avvio diventa anzi più veloce**: sparisce l'import di `firebase-firestore.js`, cioè una
libreria in meno da scaricare, analizzare ed eseguire a ogni apertura.

### 8.2 Il salvataggio incrementale è il guadagno principale

| | Oggi | Dopo |
|---|---|---|
| Un'operazione che si chiude | rimanda **196 KB** (tutto lo storico) | manda **259 byte** |

Settecentocinquanta volte meno dati. E meno dati vuol dire **meno lavoro anche sul filo
principale del browser**, non solo meno traffico: oggi ogni tentativo di salvataggio paga 1,23 ms
fra serializzazione e firma sul banco di prova, che sulla macchina del proprietario (misurata ~10
volte più lenta) fanno **circa 10 ms**. Con 259 byte quel costo sparisce.

### 8.3 Gli ascolti mandano l'avviso, non il contenuto

Oggi, se si tocca qualcosa sul computer, il telefono in ascolto **riscarica 305 KB**. Dopo deve
ricevere `{nome, versione}` — venti byte — e decidere da sé se gli serve leggere.

È la voce che fa risparmiare di più **e** quella che alleggerisce i dispositivi più deboli.

### 8.4 Il punto dove si potrebbe PERDERE, e come si copre

L'Oracle Micro è **una macchina sola, 1 GB di RAM, CPU condivisa**; Google ha un'infrastruttura
mondiale. Nei casi normali non si vede, perché i salvataggi sono asincroni e non bloccano niente.

**Ma c'è un caso dove si vedrebbe: il primo avvio su un dispositivo nuovo**, quando non esiste
copia locale e bisogna scaricare tutto. Lì un server lento significa attesa più lunga.

Come si copre, in ordine:
1. è un caso raro — una volta per dispositivo;
2. si mostra il riquadro di caricamento che **esiste già** (`fblCaricamentoMostra`), così l'attesa
   si vede invece di sembrare un blocco;
3. si scarica **prima quello che serve subito** (conto e posizioni aperte) e **poi il resto**
   (Trade Journal storico, disegni): si può operare mentre il resto arriva.

### 8.5 Come si verifica che non sia peggiorato

Lo strumento c'è già: **impostazioni → Versione → «Misura le prestazioni»**. Riporta già
`cloudScritture`, `cloudSaltate` e `cloudUltimoPeso_KB`.

**Prima di cominciare**, farsi dare dal proprietario una misura di riferimento. **Dopo ogni passo
della migrazione**, rifarla e confrontare. Se `cloudUltimoPeso_KB` non è crollato, il salvataggio
incrementale non sta funzionando davvero — e si è spostato lo spreco invece di toglierlo.


## Stato passo 3 (scrittura in due posti) — FATTO il 27 ottobre 2026 (rilasciato 2.0.35)

L'app scrive ora su Firebase E sul server Oracle (doppio scritto), e legge dal server con fallback
su Firebase. I metodi aggiunti a fxbtCloud: serverDatiLeggi, serverDatiScrivi, serverDatiFondi,
serverTradesAggiungi, serverTradesLeggi, serverDatiAscolta (WebSocket). Il caricamento da cloud
(initSession) prova prima il server Oracle e ricade su Firebase se non configurato o non raggiungibile.
Il syncFullStatusToFirebase fa il doppio scritto dopo il save su Firebase. Collaudo locale: 895 test,
0 fallimenti. Il server Oracle (rotte /dati, SQLite, verifica token Firebase) era gia' pronto dal
passo 2.

## Stato passo 4, prima cura: il footprint nel documento suo — FATTO il 31 ottobre 2026 (2.0.56)

DOMANDA DEL PROPRIETARIO: «non possiamo risparmiare questi dati? far sì che non incrementi e che
non sovrascriva sempre la copia esistente e quindi risparmiare tempo, dati e soldi.»

RISPOSTA MISURATA. La bolletta di ottobre era **8,49 €** (Firestore 6,80 + Cloud Functions 1,40 +
altro 0,29), col grafico in impennata dal 20 ottobre. Due cause distinte, e una già curata:

1. **Il session rimandava tutto (CURATA il 26-27 ottobre, attiva sul PC solo dal 30 con la 2.0.53).**
   Il modello di Firestore è «un documento, tutto o niente»: per salvare un'operazione chiusa si
   riscriveva l'intero storico — 305 KB, di cui 194 KB di operazioni. La cura (salvataggio
   incrementale, `arrayUnion` su `users/{uid}/data/trades`) era nel repo ma **non nella build
   installata**: `installer_build/build/app.html` era fermo al 26 ottobre, senza `arrayUnion` né
   `trades/aggiungi`. Verificato sul PC: dalla 2.0.53 le cure ci sono.
   **Lezione, ed è costata un mese di bolletta: la cura nel repo non cura niente, cura ciò che sta
   nella versione installata.** `build_exe.bat` copia `app.html` dalla root alla build, quindi la
   build si rigenera da sé — ma ciò che girava sul PC era la vecchia.

2. **Il footprint rimaneva dentro ogni salvataggio (CURATA oggi).**
   `footprintCollectCloudAggregate()` arriva fino a `FOOTPRINT_CLOUD_MAX_BYTES` (400 KB) ed era
   aggiunto a `bundle.footprintCells`, quindi finiva **dentro** il documento session: fino a 400 KB
   rimandati a ogni salvataggio (pagehide, logout, operazione chiusa). È il secondo pezzo grosso
   dopo lo storico, e coi numeri della console («larghezza di banda oltre 10 GB» in 30 giorni) è
   la voce che resta.

**Cosa fa la cura.** Il footprint esce dal documento session e sta in
`users/{uid}/data/footprint`, scritto:
- solo se **cambiato** (firma sul testo, stesso meccanismo «identico = non si scrive» del session);
- al massimo **una volta al minuto** (`FOOTPRINT_CLOUD_SYNC_MS`): è una rete di sicurezza per gli
  asset senza log tick locale, non un dato che cambia a ogni tick — un minuto di ritardo non si
  vede, 400 KB a salvataggio si pagano;
- anche sul server Oracle (doppio scritto, `serverDatiScrivi('footprint', …)`).

Retrocompatibilità: gli account che hanno ancora `footprintCells` dentro il session lo leggono da
lì (initSession); se nel session non c'è, si legge il documento separato. Nessuna perdita nel
passaggio. Resta nel percorso di **fallback completo** (fotografia intera quando il documento delle
operazioni non si sa leggere): lì va tenuto tutto.

Misura nuova in «Misura le prestazioni»: `footprintInviati` — quante volte il footprint è stato
scritto nel documento suo. Se resta fermo mentre `cloudScritture` cresce, il risparmio funziona.

Test: `laboratorio/app/footprint_documento_suo.test.mjs` (3 prove, sui byte che partono davvero:
il session non porta più il footprint, il footprint parte da solo nel documento suo, tre
salvataggi ravvicinati lo scrivono una volta sola, senza celle non si chiama niente).

**Restano aperte, in ordine di costo:**
- **1 GB archiviati** sulla console con un utente solo non tornano (4 documenti per utente ≈ 1 MB):
  numero da chiedere al proprietario (Utilizzo → Firestore → Spazio di archiviazione).

## Terza cura: footprint sul server, e Notion misurato — 31 ottobre 2026 (2.0.58)

**Difetto trovato leggendo il server mentre si pubblicava la cura del footprint:** il server
Oracle accettava solo `session`, `grafico`, `collegamento`, `preferenze`. Il documento `footprint`
nuovo veniva perciò **rifiutato con 400**, e la scrittura finiva nel `catch` del client: in
silenzio. Il risparmio restava a metà — la parte che si paga no (la rete di sicurezza Firebase
era rimasta), ma il doppio scritto sul server non arrivava da nessuna parte. Ora `footprint` è
nell'elenco, e l'elenco è **uno solo** (`NOMI_DOCUMENTI`) invece di tre copie nelle tre rotte: due
elenchi che divergono sono un documento che si scrive da una parte e non si legge dall'altra.
Test: `laboratorio/ponte/test_nomi_documenti_server.py` (4 prove: footprint accolto su GET/PUT/
PATCH, un nome non previsto rifiutato con 400, l'elenco è uno solo, session resta il primo).

**Cloud Functions (1,40 €): strumentate, non tagliate alla cieca.** Le funzioni non sono solo
Stripe: ci sono anche quelle Notion (`notionSyncTrades`, `notionStatus`, `notionReleaseMt5Account`,
`createNotionCheckout`, `notionAuthUrl`, `notionDisconnect`). Non si può sapere quale produca i
1,40 € senza contarle, quindi ora si contano: `notionChiamateServer` (quante invocazioni vere) e
`notionGiriTimer` (quanti giri trovino davvero qualcosa da fare), entrambi in «Misura le
prestazioni». Il timer è passato da **15 s a 30 s**: metà del lavoro per una sincronizzazione che è
un backup verso Notion, non un dato in tempo reale.

**Perché non c'è un test comportamentale su Notion:** `notionSyncTick` esce subito se Notion non è
collegato, quindi in banco non ci sono giri da misurare — un test che contasse le stringhe nel
sorgente dimostrerebbe che il codice è stato scritto, non che funziona. Quando il proprietario
avrà letto i due numeri dalla console, si decide con quelli: tenere, rallentare ancora, o spegnere.

## Stato passo 4, seconda cura: gli ascolti commutati sul server — FATTO il 31 ottobre 2026 (2.0.57)

**Cosa facevano.** `onSnapshot` su tre documenti: `collegamento` (host e chiave del server, perché
gli altri dispositivi li trovino da soli), `preferenze` (watchlist, ricerche, scala UI) e
`grafico` (disegni e indicatori condivisi). Il quarto, `session`, era spento: `onChange` non
viene chiamato da nessuna parte. **Costo:** ogni modifica di un documento è una lettura per ogni
dispositivo in ascolto — ed è la voce che, coi numeri della console (293K letture, 10 GB di banda
in 30 giorni), pesa di più dopo le scritture.

**Perché non si potevano spegnere e basta.** Sincronizzano davvero qualcosa: spegnerli senza
sostituto vorrebbe dire perdere la sincronizzazione fra dispositivi. Un peggioramento, non una cura.

**La cura.** Commutazione, non sostituzione secca: una funzione sola `fblAscoltaDocumento` che
- se il server Oracle è configurato, ascolta il **WebSocket** `/dati/ascolta` (manda solo
  `{nome, versione}`) e legge il documento **solo quando la versione cambia** — chi ha già quella
  versione non scarica niente;
- se il server non è configurato, resta `onSnapshot`, esattamente come prima: la sincronizzazione
  fra dispositivi non deve MAI dipendere da una configurazione che non c'è.

**Il pezzo che rendeva la commutazione sicura: il doppio scritto.** `collegamentoSalva`,
`preferenzeSalva` e `graficoSalva` scrivevano **solo** su Firestore. Commutare la lettura al
server senza questo avrebbe voluto dire leggere un posto dove nessuno scrive: gli altri
dispositivi non avrebbero più visto né il collegamento, né le preferenze, né i disegni. Ora,
quando il server c'è, scrivono su tutti e due; se il server non risponde non è un fallimento —
Firebase ha già salvato e resta la rete di sicurezza.

**Difetto trovato e curato per strada: il canale server non rinasceva.** `serverDatiAscolta`
chiudeva con `chiuso=true` e non riapriva più niente: un solo problema di rete — server che si
riavvia, wireless che cambia, PC che dorme — e quel dispositivo smetteva di ricevere gli
aggiornamenti dagli altri, in silenzio e per sempre. È lo stesso difetto della "porta muta" del
servizio dati, in un'altra stanza. Ora si riapre da solo con attesa crescente (5 s → 30 s).

**Perché la logica è una funzione sola nello script principale e non dentro il modulo Firebase:**
nel banco di prova il modulo Firebase non carica (nessuna rete), quindi dentro il modulo non sarebbe
raggiungibile da nessun test — e tre copie della stessa logica in tre metodi divergono sempre (la
lezione del 28 ottobre, pagata due volte in un giorno).

Test: `laboratorio/app/ascolto_documento_server.test.mjs` (6 prove, con nuvola finta):
l'avviso fa leggere il documento e passa il contenuto; la stessa versione non si rilegge (il
risparmio); due avvisi ravvicinati non si accavallano e l'ultimo applicato è il più recente; gli
avvisi degli altri documenti non disturbano; chiuso l'ascolto non arriva più niente; senza chi
ascolta non si rompe niente.
