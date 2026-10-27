# Creare il server ARM su Oracle — guida passo passo

Questa è **solo la parte che devi fare tu**, nella console di Oracle. Tutto il resto
(preparazione, trasferimento dati, verifica) lo faccio io via SSH appena mi dai l'indirizzo.

**Tempo:** 10 minuti, se la capacità ARM è disponibile. **Costo:** zero.

---

## PRIMA DI COMINCIARE

Apri questo file e tienilo a portata di mano: ti serve al passo 6.

```
C:\Users\pietro\Documents\FBL-backup-server\chiave-pubblica-per-oracle.txt
```

È la **chiave pubblica** ricavata da quella che usi già. Usando questa, l'accesso al server nuovo
funziona con la stessa chiave di oggi e non devi gestirne una seconda.

⚠️ **Non cancellare e non spegnere la macchina attuale.** Resta accesa fino alla fine, è la tua
rete di sicurezza.

---

## I PASSI

### 1. Entra nella console
Vai su **cloud.oracle.com** e accedi.

### 2. Vai alle istanze
Menu ☰ in alto a sinistra → **Compute** → **Instances**.

### 3. Controlla la regione (in alto a destra)
Deve essere la **stessa** dove sta il server di oggi. Se ne hai una sola, è quella.

### 4. Premi «Create instance»

### 5. Nome
Scrivi un nome che si distingua, per esempio **`fbl-arm`**.
(Il nome di rete vero lo sistemiamo dopo, non è questo.)

### 6. Immagine e forma — IL PASSO CHE CONTA

Nel riquadro **«Image and shape»** premi **«Edit»**, poi:

**a) Immagine:** premi «Change image» → scegli **Canonical Ubuntu** → versione **22.04** o
**24.04** → «Select image».

**b) Forma:** premi «Change shape» → scheda **«Ampere»** → scegli **`VM.Standard.A1.Flex`**.

Compaiono due cursori:
- **OCPU:** portalo a **4**
- **Memory (GB):** portalo a **24**

> Devi leggere **«Always Free-eligible»** accanto alla forma. Se non c'è, **fermati e dimmelo**:
> vuol dire che quella configurazione verrebbe fatturata.

### 7. Rete
Nel riquadro **«Networking»**, lascia tutto com'è ma verifica che
**«Assign a public IPv4 address»** sia su **Yes**. Senza indirizzo pubblico non riesco a entrare.

### 8. Chiave SSH — IL PASSO DOVE SI SBAGLIA

Nel riquadro **«Add SSH keys»** scegli **«Paste public keys»** (NON «Generate a key pair for me»).

Apri il file `chiave-pubblica-per-oracle.txt`, **copia tutta la riga** e incollala nel riquadro.

> Se scegli «Generate a key pair», Oracle ti dà una chiave nuova da scaricare e io non potrò
> entrare con quella che ho. Si può rimediare, ma è tempo perso.

### 9. Disco
Riquadro **«Boot volume»**: lascia il valore predefinito (46-50 GB). Ce n'è d'avanzo: oggi ne usi
7,6.

### 10. Crea
Premi **«Create»** e aspetta. In un paio di minuti lo stato passa da *Provisioning* a
**Running** (verde).

### 11. Copia l'indirizzo
Nella pagina dell'istanza, campo **«Public IP address»**. È un numero tipo `140.238.xxx.xxx`.

---

## 12. MANDAMI QUESTO

Scrivimi in chat:

```
IP: 140.238.xxx.xxx
```

Da lì in poi faccio io:
- preparo la macchina (Docker, Tailscale, progetto, servizi);
- porto i dati dalla copia già verificata;
- controllo che risponda;
- ti dico esattamente cosa provare nell'app prima di spegnere la vecchia.

---

## SE ORACLE DICE «OUT OF CAPACITY»

È il messaggio più comune con le ARM gratuite, e **non è un errore tuo**: significa che in quel
momento, in quel dominio, non ci sono macchine ARM libere.

Cosa fare, in ordine:

1. **Riprova subito**, premendo di nuovo «Create». A volte basta.
2. **Cambia dominio di disponibilità** (se la tua regione ne ha più d'uno): nel riquadro
   «Placement», prova AD-1, AD-2, AD-3.
3. **Riprova a ore diverse.** La capacità si libera, spesso di notte o presto la mattina.
4. **Prova con meno risorse:** 2 OCPU e 12 GB. Sono comunque **dodici volte** la memoria di oggi,
   e si può alzare dopo senza rifare niente.

> **Non passare al piano a pagamento per aggirare il problema.** Il «Upgrade to Paid» che Oracle
> propone in quel momento risolve la capacità ma fa partire la fatturazione, ed è esattamente
> quello che stiamo cercando di evitare.

---

## COSA NON FARE

- ❌ Non cancellare né spegnere la macchina attuale: serve fino alla fine
- ❌ Non scegliere «Generate a key pair for me» al passo 8
- ❌ Non accettare l'upgrade a pagamento se compare l'errore di capacità
- ❌ Non cambiare regione: i dati e la rete stanno dove stanno

## SE QUALCOSA VA STORTO

Non succede niente di irreparabile: finché non tocchiamo la macchina vecchia, **l'app continua a
funzionare esattamente come adesso**. Un'istanza creata male si cancella e si rifà in cinque
minuti.
