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
