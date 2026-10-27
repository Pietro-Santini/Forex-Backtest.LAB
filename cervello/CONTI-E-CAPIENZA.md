# Conti, capienza e stato delle prestazioni — 27 ottobre 2026

Scritto da Claude su richiesta del proprietario: quanto si consuma su Firebase, quanto costerà
dopo le modifiche, quanti utenti regge il sistema prima di dover affittare un server vero, e dove
sono ancora le lacune di velocità.

**Tutti i numeri qui dentro sono misurati o presi dalla console, mai stimati a sentimento.** Dove
c'è una stima, è dichiarata come tale con le ipotesi sotto.

---

## 1. QUANTO SI CONSUMA OGGI (console Firebase, 30 giorni, UN solo utente)

| Voce | Consumo | Quota gratuita | Dove siamo |
|---|---|---|---|
| Letture | **293.000** | 50.000/giorno = ~1.500.000/mese | **20%** — larghi |
| Scritture | **107.000** | 20.000/giorno = ~600.000/mese | **18%** — larghi |
| **Larghezza di banda** | **oltre 10 GB** | 10 GiB/mese | **SFORATA** |
| ~~Byte archiviati~~ | ~~oltre 1 GB~~ | 1 GiB | ❌ **DATO SBAGLIATO** — vedi sotto: sono **10 MB** |

### La conclusione che cambia tutto

**Non stai pagando le operazioni: stai pagando banda e archiviazione.** Le letture e le scritture
sono dentro il gratuito con ampio margine. A costare sono i **byte**.

E il motivo è uno solo: **ogni operazione muoveva un documento da 305 KB**, di cui 194 KB erano
lo storico delle operazioni rimandato per intero ogni volta.

> ✅ **Questa conclusione e' stata poi CONFERMATA** dal report per SKU (sotto): la banda e'
> l'unica voce che si paga. **L'archiviazione invece no**: quel numero era sbagliato.

### AGGIORNAMENTO del 27 ottobre, pomeriggio: la bolletta vera, per SKU

Non piu' ipotesi. Questi sono i costi reali di ottobre, presi dal report di fatturazione Google
Cloud raggruppato per SKU:

| SKU | Utilizzo | Costo |
|---|---|---|
| **Cloud Firestore Internet Data Transfer Out** | **43,86 GiB** | **€3,57** |
| Secret version replica storage (Secret Manager) | 9,96 mesi-versione | €0,21 |
| Cloud Run Functions Data Transfer Out | 0,1 GiB | €0,01 |
| Cloud Firestore Entity Writes | 115.154 | **€0,00** |
| **Cloud Firestore Storage** | **0,01 GiB** | **€0,00** |

**Si paga UNA cosa sola: i byte che escono da Firestore.** 43,86 GiB in 27 giorni, con un solo
utente: 1,6 GB al giorno.

### DUE IPOTESI MIE, SMENTITE ENTRAMBE

**1. Gli indici che gonfiano l'archiviazione: FALSO.** L'archiviazione e' **0,01 GiB** — dieci
megabyte — e costa **zero**. Il «oltre 1 GB archiviato» scritto piu' sopra in questo stesso
documento era sbagliato, e con esso tutta la teoria delle esenzioni di indice. **Non fare quel
lavoro: non servirebbe a niente.**

**2. Il PITR o i backup programmati: FALSO.** Controllata la scheda Disaster recovery: *Recupero
point-in-time* **disabilitato**, *Backup pianificati* **disabilitati**, nessun backup in elenco.

**Il gradino del 20 ottobre non era un'impostazione accesa quel giorno:** il piano gratuito
comprende **10 GiB di traffico al mese**. Fino a quella soglia la curva sta a zero; superata —
intorno al 20 — parte la fatturazione. Era semplicemente il gratuito che finiva.

### PERCHE' IL TRAFFICO E' COSI' ALTO, E PERCHE' E' GIA' RISOLTO

Il conto torna: **9,8K letture al giorno × un documento da 305 KB ≈ 2,9 GB al giorno.** Le
operazioni sono poche (letture al 15,8% della quota, scritture al 19,8%), ma **ognuna si trascina
dietro un documento enorme**. Si pagano i byte, non le operazioni — e questo pezzo della diagnosi
di stamattina era giusto.

**Verificato nel codice a v2.0.35** che la cura e' gia' dentro:

- `trades` e' un documento **separato** da `session` (passo 1);
- e soprattutto **`trades` NON ha ascoltatori**. I quattro `onSnapshot` stanno su `session`,
  `grafico` (i disegni condivisi), `collegamento` e `preferenze` — documenti piccoli.

Lo storico da 194 KB **non viene piu' riscaricato da nessun dispositivo, mai.**

### COSA ASPETTARSI, E COSA GUARDARE

La bolletta misura **i 27 giorni passati**, quasi tutti con i dispositivi su versioni vecchie. Il
traffico cala man mano che i dispositivi passano a v2.0.35, non il giorno in cui si pubblica.

**Il numero da ricontrollare fra una settimana** e' sempre quello: *Firestore Internet Data
Transfer Out*. Deve scendere **sotto i 10 GiB al mese**, cioe' dentro il gratuito. Se resta sopra,
il colpevole e' uno dei quattro documenti ascoltati, e si guarda quale.

> ⚠️ Da non ripetere: in questa pagina avevo scritto due diagnosi sbagliate (indici,
> PITR) prima di guardare il report per SKU. **Il report per SKU e' il primo posto dove guardare,
> non l'ultimo:** dice il nome esatto della cosa che si paga, e costa due clic.

### Nota minore: Secret Manager, €0,21

9,96 mesi-versione di segreti archiviati, mentre il gratuito ne comprende 6 attive. Sono vecchie
versioni che si accumulano a ogni rotazione. Due euro e mezzo l'anno: non urgente, ma e' spreco
puro e si ripulisce distruggendo le versioni vecchie.

## 2. COSA CAMBIA CON LE MODIFICHE GIÀ FATTE

### Passo 1 — operazioni separate (fatto, v2.0.32)

Misurato oggi sul codice attuale:

| | Prima | Dopo |
|---|---|---|
| Documento `session` | **199 KB** | **~5 KB** |
| di cui storico operazioni | 194 KB | 0 (sta in un documento a parte) |
| Una operazione nuova | rimandava tutto | **259 byte** |

**La banda crolla del ~97% per ogni salvataggio di sessione.** Da «oltre 10 GB» si dovrebbe
scendere sotto il gigabyte al mese — cioè dentro il gratuito con un fattore dieci di margine.

### Passo 4 — gli ascolti (in corso)

Oggi ogni modifica fa riscaricare l'intero documento a ogni dispositivo in ascolto, **compreso
quello che l'ha appena scritto**. Dopo, arrivano `{nome, versione}` — una ventina di byte — e chi
ha già quella versione non chiede niente.

Con due dispositivi accesi insieme (il tuo caso normale) questo **dimezza ancora** le letture.

### Previsione

| | Oggi | Dopo passo 1 | Dopo passo 4+5 |
|---|---|---|---|
| Banda/mese | >10 GB | **<1 GB** | **~0** (Firebase non porta più dati) |
| Archiviazione | >1 GB | da verificare (vedi §1) | **~0** |
| Costo | **si paga** | **gratis, con margine** | **gratis** |

---

## 3. UNA COSA DA GUARDARE: 107.000 SCRITTURE AL MESE CON UN UTENTE

Sono **3.566 scritture al giorno**, cioè una ogni 24 secondi di giornata intera. L'app scrive
quando si chiude un'operazione e all'uscita della pagina: non bastano a spiegarle.

**Il candidato è la sincronizzazione dei disegni.** C'è un controllo ogni 1,5 secondi
(`setInterval(graficoControllaModifiche, 1500)`) che, quando vede qualcosa di cambiato, programma
una scrittura del documento `grafico`.

Non è detto che sia lui — ho già sbagliato una volta accusandolo, misurando male. **Come si
verifica davvero:** nella console Firestore si guarda quale **documento** riceve le scritture. Se
è `grafico`, si allarga l'intervallo (1,5 s → 15 s) e si accorpano le modifiche.

Nota: dopo lo spostamento sul server Oracle questo smette di costare soldi, ma **continua a
costare batteria e banda del telefono**. Vale la pena guardarlo comunque.

---

## 4. QUANTI UTENTI REGGE, PRIMA DI DOVER AFFITTARE UN SERVER

### 4.1 Firebase, restando com'è adesso (login + abbonamenti + dati)

Ipotesi: dopo il passo 1, un utente attivo consuma **~200 scritture e ~500 letture al giorno**, e
**~50 MB di banda al mese**.

| Limite gratuito | Quanti utenti |
|---|---|
| 20.000 scritture/giorno | **~100 utenti** |
| 50.000 letture/giorno | **~100 utenti** |
| 10 GiB banda/mese | **~200 utenti** |
| 1 GiB archiviazione | **~50-100 utenti** (dipende dagli indici, vedi §1) |

> **Il tetto vero è intorno ai 50-100 utenti attivi**, e il primo a cedere è l'archiviazione.

### 4.2 Firebase dopo lo spostamento (solo login + abbonamenti)

| Limite | Quanti utenti |
|---|---|
| Autenticazione | **decine di migliaia** (il gratuito è molto alto) |
| Cloud Functions (2M invocazioni/mese) | **migliaia** (due chiamate per abbonamento) |

> **Firebase smette di essere il vincolo.** Diventa quello che deve essere: login e pagamenti.

### 4.3 Il server Oracle (Micro: 1 GB di RAM, CPU condivisa, ~45 GB di disco)

Qui bisogna distinguere **due lavori diversi**, e il secondo è molto più pesante del primo.

**(a) Solo l'archivio dati** (le rotte `/dati` + SQLite + i WebSocket di avviso):

| Risorsa | Conto | Capienza |
|---|---|---|
| Disco | ~5-50 MB per utente all'anno | **migliaia di utenti** |
| CPU | poche richieste da pochi KB | **centinaia** |
| RAM per WebSocket | ~50-100 KB a connessione ferma | **~500-1.000 connessioni** |

> Per **i soli dati**, l'Oracle regge **qualche centinaio di utenti** senza affanno.

**(b) Il ponte che inoltra MT5, grafico e segnali** — il lavoro che già fa oggi:

Questo è un'altra cosa: tiene canali aperti verso ogni PC, inoltra richieste, fa girare il lettore
Telegram. È **molto** più pesante della lettura e scrittura di un blob.

> Stima prudente: **20-50 utenti attivi contemporanei** su una macchina da 1 GB, prima che la RAM
> e la CPU condivisa diventino il collo di bottiglia. **Questo è il tetto vero del sistema**, non
> i dati.

### 4.4 Quando affittare un server vero

Il momento NON è quando cresce lo spazio occupato — quello non arriva prima di migliaia di utenti.

**Il momento è quando il ponte comincia ad arrancare**, e si vede da tre segnali:
1. la memoria del server stabilmente sopra il 70-80%;
2. i tempi di risposta di `/health` che salgono;
3. i canali verso i PC che cadono e si riagganciano spesso.

**Prima di affittare**, due passi intermedi che costano poco:
- passare l'Oracle da **Micro (1 GB) ad ARM Ampere (fino a 4 core e 24 GB di RAM, sempre
  gratuito)** — è dentro il piano gratuito di Oracle, basta che ci sia disponibilità nella
  regione. **Da fare comunque: è il miglioramento più grosso a costo zero di tutto questo
  documento**;
- separare i due lavori su due macchine: i dati da una parte, il ponte dall'altra.

---

## 5. LE PRESTAZIONI: DOVE SIAMO, MISURATO

Tutto da misure fatte sulla macchina del proprietario (22 ottobre) o sul banco di prova.

### 5.1 Già risolto, con i numeri

| Difetto | Prima | Dopo |
|---|---|---|
| **Ogni prezzo in arrivo, a mercato aperto** (200.000 candele) | **58 ms di blocco** | **2,11 ms** |
| `rebuildBaseRowsFromLibrary` | 13,51 ms | **0,26 ms** |
| Cambio timeframe (1h → 1m) | 300.000 candele, vista a marzo | tetto ai pixel, centro rispettato |
| `update()` | 21,47 ms | **2,6 ms** |
| Salvataggio sul cloud | 305 KB | **~5 KB + 259 B per operazione** |

### 5.2 Ancora aperto, in ordine di quanto si sente

| Problema | Misura | Stato |
|---|---|---|
| **Cambio asset: blocco di 2.818 ms** | misurato | causa probabile: salvataggio del registro tick (750.000 tick). **Cura già scritta**: `laboratorio/strumenti/tick_blocchi_DA_APPLICARE.py` |
| **Disegno: 32-53 ms** (dovrebbe stare sotto 16) | misurato | **il 96,6% è nel corpo di `draw()`**, non nelle funzioni che chiama. Il footprint è innocente: costa <1 ms |
| **Memoria: 721 MB** | misurato | 752.683 tick di footprint (tetto 150.000 × 5 asset). Da decidere quanto storico serve davvero |
| **21-27 fotogrammi al secondo** | misurato | conseguenza dei due punti sopra |

### 5.3 Come si prosegue (non a intuito)

Per il disegno, il passo è **aggiungere cronometri dentro `draw()`**, sezione per sezione, e
rifare la misura. La prima misura ha già smentito **due sospetti su due** (il footprint e i pezzi
cronometrati): continuare a indovinare costa più che misurare.

Lo strumento è nell'app: **impostazioni → Versione → «Misura le prestazioni»**. Avvisa da solo
quando una misura non vale (grafico vuoto, non in Live).

### 5.4 Cosa non è mai stato misurato, e andrebbe

- **Il tempo di apertura di un ordine** dal clic alla conferma del broker: non c'è un cronometro
  su quella strada. È la cosa che conta di più e di cui sappiamo di meno.
- **Il primo caricamento su un telefono** (rete mobile vera, non WiFi).
- **La velocità sul telefono** in generale: tutte le misure di cui sopra vengono dal PC.

---

## 6. LE TRE COSE DA FARE PER PRIME

1. **Guardare la divisione dello spazio su Firestore** (documenti contro indici). Se sono gli
   indici, si risolve con un'impostazione e si smette di pagare **subito**, senza aspettare lo
   spostamento.
2. **Applicare il salvataggio a blocchi del registro tick.** È scritto e misurato, e toglie il
   blocco da 2,8 secondi al cambio asset.
3. **Valutare il passaggio dell'Oracle da Micro ad ARM Ampere** (gratuito, fino a 24 GB di RAM).
   È il miglioramento più grosso a costo zero: alza il tetto degli utenti da ~20-50 a diverse
   centinaia, e toglie il problema della memoria che oggi limita tutto.
