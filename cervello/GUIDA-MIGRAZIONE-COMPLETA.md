# Migrazione del server su Oracle ARM — guida completa

Tutto quello che serve, dall'inizio alla fine. **👤 = lo fai tu** · **🤖 = lo faccio io via SSH**

**Tempo:** ~20 minuti in tutto. **Costo:** zero, è dentro il piano gratuito che hai già.

---

## PERCHÉ LA FACCIAMO

| | Oggi | Dopo |
|---|---|---|
| Processori | 2 core | fino a **4** |
| Memoria | 951 MB | fino a **24 GB** |
| Tetto stimato di utenti | 20-50 | **diverse centinaia** |

> ⚠️ **CORREZIONE del 27 ottobre 2026, misurata sul server vivo.** Qui c'era scritto
> «951 MB, già al 53% con te solo — la memoria è il limite che oggi condiziona tutto».
> **E' falso, e aveva letto male il numero.** Misure reali:
>
> | | |
> |---|---|
> | Memoria **disponibile** | **596 MB su 951** |
> | Swap usato | 292 MB su 2048 — **1,7 GB mai toccati** |
> | Carico CPU | **0,06** su 2 core: ferma al 3% |
> | Uptime | **20 giorni**, nessun riavvio |
> | Esaurimenti di memoria | **zero** |
> | L'app vera (ponte + segnali) | **126 MB** |
>
> Linux conta come «usata» anche la cache, che si libera da sola: il numero che conta è
> *available*. I 475 MB occupati erano quasi tutti sistema (Tailscale 84, Docker 43, registro
> eventi 31, `fwupd` 28, snapd 24), non l'applicazione.
>
> **Spenti `fwupd` e messo un tetto al registro eventi si è passati da 476 a 596 MB disponibili,
> +25%, gratis.** La migrazione ARM resta un miglioramento sensato per il futuro, ma **non sta
> riparando niente**: non c'è nessuna emergenza, e nessun motivo di accettare scorciatoie a
> pagamento per ottenerla.

---

## LE DUE TRAPPOLE, da leggere prima di toccare qualsiasi cosa

### Trappola 1 — La chiave legata al tuo account Google

L'app **non prende la chiave dal server**: è il tuo PC che pubblica la coppia
`{indirizzo, chiave}` sull'account Google, e gli altri dispositivi la ricevono da lì.

`prepara_server.sh`, su una macchina vuota, **genera una chiave nuova**. Se in quel momento un
dispositivo si collegasse al server nuovo, il PC pubblicherebbe sull'account una coppia che il
server non riconosce, e **tutti i dispositivi si allineerebbero a quella sbagliata**.

> **La cura:** si mettono i dati **PRIMA** di preparare il server. Lo script trova la chiave già
> lì e non ne genera un'altra. È il passo 3, e l'ordine non va invertito.

### Trappola 2 — Il nome di rete

I dispositivi cercano il server su **`pietro.tail83d918.ts.net`**, salvato su ognuno. Una macchina
nuova entra in Tailscale con un nome **diverso** (`pietro-1`).

> **La cura:** alla fine si rimuove la vecchia da Tailscale e si **rinomina la nuova `pietro`**.
> È il passo 7, ed è quello da non saltare.

---

## PRIMA DI COMINCIARE

**🤖 La copia di sicurezza è già fatta e verificata** (riaperta e letta: 38 file, chiave
d'accesso e chiave dell'account comprese):

```
C:\Users\pietro\Documents\FBL-backup-server\fbl-dati-20261027.tgz
```

**👤 Tieni a portata di mano la chiave pubblica**, ti serve al passo 1g:

```
C:\Users\pietro\Documents\FBL-backup-server\chiave-pubblica-per-oracle.txt
```

⚠️ **Non spegnere e non cancellare la macchina attuale.** Resta accesa fino alla fine: è la rete
di sicurezza.

---

# PASSO 1 👤 — Creare l'istanza (console Oracle)

**a)** Vai su **cloud.oracle.com** e accedi.

**b)** Menu ☰ → **Compute** → **Instances**.

**c)** Controlla la **regione** in alto a destra: deve essere la stessa del server di oggi.

**d)** Premi **«Create instance»**.

**e) Nome:** `fbl-arm`

**f) Immagine e forma** — riquadro «Image and shape» → **«Edit»**:

- **Immagine:** «Change image» → **Canonical Ubuntu** → **22.04** o **24.04** → «Select image»
- **Forma:** «Change shape» → scheda **«Ampere»** → **`VM.Standard.A1.Flex`**

**La scala da scendere, fermandosi al primo che passa** (misurato il 27 ottobre 2026: 3 OCPU/18 GB
e 2 OCPU/12 GB hanno dato «out of capacity»):

| Tentativo | OCPU | Memoria | Quante volte quella di oggi |
|---|---|---|---|
| 1° | 4 | 24 GB | 25× |
| 2° | 2 | 12 GB | 12× |
| 3° | **1** | **6 GB** | **6×** |

Qualunque di questi **da' molto piu' respiro** di oggi; il collo di bottiglia e' la memoria, non
i core (e vedi la correzione piu' sopra: oggi non e' nemmeno stretta).
E l'A1.Flex **si ridimensiona a macchina spenta**: partire da 1 OCPU non chiude nessuna porta.

> ⚠️ Deve comparire **«Always Free-eligible»**. Se non c'è, **fermati e dimmelo**: quella
> configurazione verrebbe fatturata.

### Il tipo di capacità: lasciarlo stare

Sotto «Advanced options» c'è **«Capacity type»**, e quando Oracle dice «out of capacity» viene
naturale andarlo a cercare. **Non c'è niente da trovare: deve restare «On-demand».**

| Voce | Cosa fa | |
|---|---|---|
| **On-demand** | il normale | ✅ **l'unico compreso nel piano gratuito** |
| Preemptible | Oracle si riprende la macchina **quando vuole** | ❌ si paga, e il ponte non può spegnersi a sorpresa |
| Capacity reservation | riserva capacità in anticipo | ❌ si paga la riserva anche inutilizzata, e per crearla serve comunque capacità libera |
| Dedicated host | un host fisico tutto tuo | ❌ centinaia di euro al mese |
| Compute cluster | rete per calcolo scientifico | ❌ non c'entra, e si paga |

Il piano Always Free copre **solo l'on-demand standard**. Cambiare tipo di capacità significa
uscire dal gratuito per risolvere un problema di gratuito.

**g) Chiave SSH** — riquadro «Add SSH keys»:

- scegli **«Paste public keys»** (**NON** «Generate a key pair for me»)
- apri `chiave-pubblica-per-oracle.txt`, copia **tutta la riga**, incollala

> ⚠️ Con una chiave generata da Oracle io non entro più con quella di oggi.

**h) Rete** — riquadro «Networking»: verifica che **«Assign a public IPv4 address»** sia su **Yes**.

**i) Disco** — «Boot volume»: **50 GB**, prestazioni **VPU 10**. Oggi ne usi 7,6.

> ⚠️ **Oracle ti mostrerà «€1,98/mese» per il boot volume. È un falso allarme.** Lo dice Oracle
> stessa nella riga sotto il totale: *«does not reflect any tier unit pricing»* — quel preventivo
> calcola i prezzi di listino e **non applica il piano gratuito**.
>
> Il piano Always Free comprende **200 GB** di dischi in tutto, a **VPU 10**. Vecchia macchina
> (~47 GB) + nuova (50 GB) = **97 GB**: sei a metà di quello che hai già incluso.
>
> Quello da non superare è **VPU 10**: alzare le prestazioni del disco **si paga davvero**.

**l)** Premi **«Create»**. In un paio di minuti lo stato diventa **Running** (verde).

**m)** Copia il **«Public IP address»** (tipo `140.238.xxx.xxx`).

### 👤 MANDAMI QUESTO

```
IP: 140.238.xxx.xxx
```

---

## SE ORACLE DICE «OUT OF CAPACITY»

È il messaggio più comune con le ARM gratuite e **non è un errore tuo**: in quel momento, in quel
dominio, non ci sono macchine ARM libere.

In ordine:
1. **Riprova subito**, premendo di nuovo «Create».
2. **Scendi di taglia**, seguendo la scala del punto 1f: 4→24 → 2→12 → **1→6**. È la mossa che
   funziona più spesso, perché un pezzo piccolo trova posto dove uno grande non entra.
3. **Riprova a ore diverse** — tipicamente **di notte o presto la mattina** nel fuso della regione.
   Un tentativo ogni qualche ora, non serve starci dietro.
4. **Cambiare dominio di disponibilità** (riquadro «Placement») solo **se ne hai più di uno**.
   Molte regioni — **compresa la tua** — hanno **solo AD-1**: in quel caso la voce non si può
   cambiare, e non c'è niente di sbagliato.

> **Se resta bloccata, non è un problema tuo e non è urgente.** Il server di oggi funziona: questa
> migrazione è un **miglioramento**, non una riparazione.

## NON SERVE PIÙ PREMERE CREATE A MANO — ci pensa il server (dal 27 ottobre 2026)

Premere «Create» a mano una volta ogni tanto non funziona quasi mai: Oracle libera le ARM a
sprazzi, spesso di notte e per pochi minuti. **Chi riprova ogni minuto e mezzo giorno e notte,
prima o poi la prende.**

Sul server attuale gira ora un servizio che fa esattamente questo:

| | |
|---|---|
| Servizio | `fbl-arm.service` (riparte da solo dopo un riavvio) |
| Programma | `/srv/fbl/arm/insisti.sh` |
| Ritmo | un tentativo ogni ~90 secondi |
| Taglie | **cicla** fra 4/24, 2/12 e 1/6 — prende il meglio che passa |
| Quando riesce | **si ferma**, scrive `/srv/fbl/arm/RIUSCITO.txt` con l'indirizzo IP, e non prova mai piu' |
| Registro | `/srv/fbl/arm/tentativi.log` |

**Perche' cicla fra tre taglie:** quando si libera un posto non si sa di che misura sia. Si chiede
prima la piu' grande e si scende, invece di aspettare esattamente quella che si era decisa.

**Perche' non puo' fare danni:**
- se riesce **esce** e non crea una seconda macchina;
- se l'errore **non e'** di capacita' si ferma e lo scrive, invece di martellare a vuoto;
- ha un tetto di memoria (`MemoryMax=400M`) e `OOMScoreAdjust=800`: se il sistema dovesse
  liberare memoria, **sacrifica questo e non il ponte degli ordini**. Ne usa 127 MB.

### Come si controlla a che punto e'

```
systemctl status fbl-arm.service
tail -5 /srv/fbl/arm/tentativi.log
cat /srv/fbl/arm/RIUSCITO.txt      # esiste solo quando ce l'ha fatta
```

### Le credenziali

Servono una **chiave API Oracle** in `~/.oci/chiave-api.pem` e `~/.oci/config` (permessi 600,
generati dal proprietario il 27 ottobre 2026 — regione `eu-milan-1`). **A migrazione finita la
chiave API va cancellata dalla console** (Profilo → API keys): e' una credenziale con pieni
poteri sull'account e non serve piu'.

> ❌ **Non accettare l'«Upgrade to Paid»** che Oracle propone proprio in quel momento: risolve la
> capacità e fa partire la fatturazione, cioè esattamente quello che stiamo evitando.

---

# PASSO 2 🤖 — Rifaccio la copia, fresca di minuti

Prima di toccare qualunque cosa rifaccio il salvataggio dal server attuale, così la copia è di
pochi minuti prima e non di ore.

---

# PASSO 3 🤖 — I DATI PRIMA, POI LA PREPARAZIONE

**L'ordine che evita la Trappola 1.** Sulla macchina nuova:

```
sudo mkdir -p /srv/fbl && sudo chown -R ubuntu /srv/fbl
sudo tar xzf /tmp/fbl-dati.tgz -C /srv/fbl
sudo chown -R ubuntu /srv/fbl/dati
```

Verifico che `accesso_remoto.json` sia al suo posto: è la prova che la chiave **non cambierà**.

**Solo dopo** preparo il server:

```
bash prepara_server.sh
```

Lo script installa Docker, Tailscale, il progetto e avvia i servizi. Alla fine stampa la chiave:
**deve essere identica a quella di oggi**. Se è diversa, mi fermo e te lo dico.

---

# PASSO 4 🤖 — Verifico che risponda

```
curl -s http://127.0.0.1:8000/health
```

Deve dare `{"ok": true, ...}`. Controllo anche le rotte `/dati` e che un token falso venga
rifiutato.

Se qualcosa non va, **mi fermo qui**: la macchina vecchia è ancora accesa e non hai perso niente.

---

# PASSO 5 👤 — Provi tu, con la vecchia ancora accesa

Ti do il nome nuovo (tipo `pietro-1.tail83d918.ts.net`). Nell'app, impostazioni → Collegamento,
mettilo **temporaneamente** al posto di quello attuale e verifica:

- il pannello **segnali** si collega
- le posizioni **Kraken** si vedono
- il **PC** risulta registrato

> **Finché questo non funziona, non spegniamo niente.**

---

# PASSO 6 👤 — Il nome (IL PASSO DA NON SALTARE)

Su **login.tailscale.com** → **Machines**:

1. **rimuovi** la macchina vecchia
2. **rinomina** la nuova in **`pietro`**

Dopo qualche secondo la nuova risponde su **`pietro.tail83d918.ts.net`** — l'indirizzo che tutti i
dispositivi hanno già salvato.

**Rimetti quell'indirizzo nell'app** e da lì in poi tutto torna come prima, su ogni dispositivo,
senza digitare altro.

---

# PASSO 7 👤 — Spegnere la vecchia, ma non cancellarla

Lascia l'istanza vecchia **spenta ma esistente per qualche giorno**. Se salta fuori qualcosa, si
riaccende in un minuto.

⚠️ Oracle recupera le istanze **inattive** del piano gratuito: quando sei sicuro, **cancellala
davvero**, altrimenti rischi che ti tolgano la ARM nuova al posto della vecchia.

---

## COSA NON CAMBIA

- **La chiave d'accesso**: non viene mai rigenerata (passo 3)
- **La chiave legata al tuo account Google** (`utenti_server.json`): si porta con i dati — l'ho
  riaperta dalla copia per leggerla, c'è il tuo uid e la tua email
- **L'indirizzo salvato sui dispositivi**: resta valido grazie al passo 6
- **Il PC**: continua a registrarsi da solo
- **Firebase**: non c'entra niente con questa migrazione
- **Conto, posizioni, Trade Journal**: non sono su questo server — stanno su Firestore e in locale.
  **La migrazione non può toccarli.**

## COME SI TORNA INDIETRO

Fino al passo 6 la macchina vecchia è intatta: rimetti l'indirizzo vecchio nell'app e sei
esattamente come adesso. Dopo il passo 6, si riaccende la vecchia e si rinomina lei `pietro`.

## COSA NON FARE

- ❌ Spegnere o cancellare la macchina attuale prima del passo 7
- ❌ Scegliere «Generate a key pair for me» al passo 1g
- ❌ Accettare l'upgrade a pagamento se compare l'errore di capacità
- ❌ Cambiare regione
- ❌ Collegare l'app al server nuovo **prima** del passo 3 (è la Trappola 1)

## DOPO LA MIGRAZIONE

Con 24 GB di memoria il passo successivo naturale è il **backup automatico giornaliero** di
`/srv/fbl/dati`: sono 348 KB compressi, un mese di copie sta in 10 MB.

Vale soprattutto adesso che su quel disco stanno per arrivare **i dati di tutti gli utenti**
(`dati_utenti.db`): fino a ieri lì c'era solo configurazione, da domani c'è il conto della gente.
