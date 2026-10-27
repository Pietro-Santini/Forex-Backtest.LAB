# Migrazione del server Oracle: da Micro ad ARM Ampere

**Perché:** è il guadagno più grosso a costo zero dell'intera analisi. Alza il tetto da ~20-50
utenti contemporanei a diverse centinaia, e toglie di mezzo il limite di memoria che oggi
condiziona tutto.

**Costo:** zero. È dentro lo stesso piano gratuito Oracle che hai già.

---

## 1. Da dove si parte (misurato il 27 ottobre 2026)

| | Oggi (Micro) | Dopo (ARM Ampere) |
|---|---|---|
| Processori | 2 core x86_64 | fino a **4 OCPU** |
| Memoria | **951 MB** (al 53% con UN utente) | fino a **24 GB** |
| Disco | 242 GB (7,6 usati) | 200 GB |
| Tetto stimato di utenti | 20-50 | **diverse centinaia** |

**I dati da portare sono 2,8 MB in tutto** (348 KB compressi). La migrazione non è un problema di
dati: è un problema di *nomi di rete*, ed è lì che si sbaglia.

---

## 2. LA TRAPPOLA, da leggere prima di cominciare

L'app raggiunge il server con il nome Tailscale: **`pietro.tail83d918.ts.net`**, salvato in
`fbl_server_host` su ogni dispositivo.

Una macchina nuova entra in Tailscale con un nome **diverso** (tipicamente `pietro-1`). Se finisci
la migrazione e spegni la vecchia, **tutti i dispositivi smettono di trovare il server** e devi
riscrivere l'indirizzo a mano su ognuno — telefono compreso, dove è più scomodo.

**La cura:** a migrazione finita, si **rimuove la vecchia macchina da Tailscale** e si **rinomina
la nuova** in `pietro`. Così il nome resta identico e nessun dispositivo si accorge di niente.
È il passo 6, ed è quello da non saltare.

---

## 3. La procedura

### Passo 1 — Creare l'istanza ARM (console Oracle, lo fai tu)

Compute → Istanze → Crea istanza:
- **Immagine:** Ubuntu 22.04 o 24.04
- **Forma:** `VM.Standard.A1.Flex` → **4 OCPU, 24 GB** (è tutto gratuito)
- **Chiave SSH:** carica la stessa che usi oggi (`ssh-key-2026-10-06.key`), così l'accesso non
  cambia
- **Rete:** VCN pubblica con IP, come l'attuale

⚠️ **Se Oracle dice «out of capacity»** per la forma ARM nella tua regione: è normale, capita
spesso. Si riprova a ore diverse, oppure si cambia *dominio di disponibilità* nella stessa
regione. **Non pagare per aggirarlo**: la capacità si libera.

### Passo 2 — PRIMA I DATI, POI LA PREPARAZIONE (l'ordine conta)

> **Perche' in quest'ordine, ed e' il punto che evita il conflitto piu' insidioso.**
>
> La chiave del server NON arriva dal server: e' il PC che prende la coppia {indirizzo, chiave}
> dalla propria memoria e la PUBBLICA sull'account Google (`fblCollegamentoPubblica`); da li' gli
> altri dispositivi la ricevono da soli, senza digitare niente.
>
> `prepara_server.sh`, su una macchina vuota, **genera una chiave nuova**. Se in quella finestra
> un dispositivo si collegasse al server nuovo, il PC pubblicherebbe sull'account una coppia che
> il server non riconosce - e TUTTI i dispositivi si allineerebbero a quella sbagliata, telefono
> compreso.
>
> Mettendo i dati PRIMA, lo script trova `accesso_remoto.json` gia' li' e **non genera niente**
> (il controllo e' `if [ ! -f "$DATI/accesso_remoto.json" ]`). La chiave non cambia mai, neanche
> per un minuto, e con lei restano al loro posto `utenti_server.json` (la chiave legata al tuo
> account Google) e `pc.json`.

**a) Dal tuo PC**, manda la copia sulla macchina nuova:

```
scp -i ssh-key-2026-10-06.key "C:/Users/pietro/Documents/FBL-backup-server/fbl-dati-20261027.tgz" ubuntu@IP-DELLA-NUOVA:/tmp/
```

**b) Sulla macchina nuova**, mettila al suo posto PRIMA di qualunque altra cosa:

```
sudo mkdir -p /srv/fbl && sudo chown -R ubuntu /srv/fbl
sudo tar xzf /tmp/fbl-dati.tgz -C /srv/fbl
sudo chown -R ubuntu /srv/fbl/dati
ls -la /srv/fbl/dati/accesso_remoto.json    # deve esistere: e' la prova che la chiave non cambiera'
```

**c) Solo adesso** si prepara il server:

```
curl -fsSLO https://raw.githubusercontent.com/Pietro-Santini/Forex-Backtest.LAB/main/server_oracle/prepara_server.sh
bash prepara_server.sh
```

Lo script fa tutto (Docker, Tailscale, progetto, servizi) e alla fine stampa la chiave: **deve
essere la stessa di oggi**. Se ne stampa una diversa, qualcosa non e' andato al suo posto al
punto (b): fermati e dimmelo.

### Passo 3 — Verificare che la nuova macchina funzioni, PRIMA di toccare la vecchia

```
curl -s http://127.0.0.1:8000/health
```

Deve rispondere `{"ok": true, ...}`. Se non risponde, **fermati qui**: la vecchia è ancora viva e
non hai perso niente.

### Passo 4 — I dati sono gia' al loro posto

Sono stati messi al passo 2, PRIMA di preparare il server: e' quello che impedisce alla chiave
di cambiare. Qui non c'e' niente da fare.

### Passo 5 — Provare davvero, con la vecchia ancora accesa

Nell'app, cambia temporaneamente l'indirizzo del server nel nome **nuovo**
(`pietro-1.tail83d918.ts.net`) e verifica:
- il pannello segnali si collega;
- le posizioni Kraken si vedono;
- `/health` dall'app risponde.

**Finché questo non funziona, non spegnere niente.**

### Passo 6 — Il nome (IL PASSO DA NON SALTARE)

Nella console Tailscale (login.tailscale.com → Machines):
1. **rimuovi** la macchina vecchia;
2. **rinomina** la nuova in `pietro`.

Dopo qualche secondo la nuova risponde su `pietro.tail83d918.ts.net`, cioè **l'indirizzo che tutti
i dispositivi hanno già salvato**. Rimetti quell'indirizzo nell'app e non devi toccare altro.

### Passo 7 — Spegnere la vecchia, ma non subito

Lascia la vecchia istanza **spenta ma non cancellata per qualche giorno**. Se salta fuori qualcosa
che non avevamo considerato, si riaccende in un minuto.

⚠️ Oracle recupera le istanze **inattive** del piano gratuito: quando sei sicuro, cancellala
davvero, altrimenti rischi che ti tolgano la ARM nuova invece della vecchia.

---

## 4. Cosa NON cambia

- **La chiave d'accesso dell'app**: non viene mai rigenerata, perche' i dati si mettono PRIMA
  di preparare il server (passo 2). E' la differenza fra una migrazione pulita e un conflitto
  sull'account Google.
- **La chiave legata al tuo account Google** (`utenti_server.json`): si porta con i dati, e
  l'ho riaperta dalla copia per leggerla - c'e' il tuo uid e la tua email.
- L'indirizzo che i dispositivi hanno salvato (se fai il passo 6)
- Il PC: continua a registrarsi da solo al server, come fa oggi
- Firebase: non c'entra niente con questa migrazione

## 5. Come si torna indietro

Fino al passo 6 la vecchia macchina è intatta e funzionante: si rimette l'indirizzo vecchio
nell'app e si è tornati come prima. Dopo il passo 6, si riaccende la vecchia e si rinomina lei
`pietro`.

**La copia dei dati sta sul PC** (`C:\Users\pietro\Documents\FBL-backup-server\`), verificata: 38
file, chiave d'accesso compresa.

---

## 6. E dopo, finalmente: i backup automatici

Oggi **non esiste nessun backup automatico** — questa copia è la prima, e l'ho fatta a mano.
Con 24 GB di RAM e la macchina nuova, il passo successivo naturale è un backup giornaliero
di `/srv/fbl/dati` (sono 348 KB compressi: si può tenere un mese di copie in 10 MB).

Vale soprattutto adesso che su quel disco stanno per arrivare **i dati di tutti gli utenti**
(`dati_utenti.db`): fino a ieri lì c'era solo configurazione, da domani c'è il conto della gente.
