# Mettere il server su internet senza Tailscale — guida passo passo

Scritta il 5 novembre 2026 per chi non ha mai fatto queste cose. Ogni passo dice **dove sei**
(davanti a quale schermo), **cosa premere** con il testo esatto, e **perché** serve.

I passi sono numerati **in modo continuo**: il passo 7 è il passo 7 anche quando cambi schermo,
così gli altri passi possono citarlo.

---

## Prima: le tre cose, spiegate in parole

**DuckDNS — il cartello col tuo nome.**
Il tuo server ha un indirizzo numerico (tipo `130.61.x.x`). I certificati di sicurezza non si
rilasciano per un numero: servono per un **nome**. DuckDNS ti regala un nome tipo
`forexlab.duckdns.org` e lo fa puntare al tuo numero. È gratis e non scade finché lo usi. Pensalo
come il cartello col nome sulla porta: la casa è la stessa, ma ora ha un indirizzo che si può
scrivere.

**Caddy — il portinaio con le chiavi.**
È un programma che sta davanti al tuo server. Fa due lavori:
1. **prende e rinnova da sé il certificato** di sicurezza (il lucchetto 🔒 del browser), gratis,
   da Let's Encrypt — senza di lui dovresti rinnovarlo a mano ogni tre mesi;
2. **fa passare solo quello che decidiamo noi.** Nella configurazione che ho preparato passa
   *soltanto* `/dati` (i documenti). Tutto il resto — Kraken, i segnali, l'inoltro al tuo PC —
   risponde «non disponibile» a chi arriva da internet, e resta raggiungibile solo da dentro la
   macchina.

Serve perché l'app è servita in HTTPS, e **un browser rifiuta di chiamare un indirizzo non
sicuro da una pagina sicura**. È la ragione tecnica per cui non si può semplicemente «aprire la
porta»: senza certificato il telefono non parla col server, e non è una scelta nostra.

**Security List della VCN — il cancello del quartiere.**
Oracle mette le sue macchine dentro una rete privata (la VCN). Quella rete ha un **cancello**, e
per default è chiuso: passa solo la porta 22 (quella con cui entri a scrivere comandi). La porta
443 — quella del traffico sicuro — **è chiusa**, e non la apri dal server: la apri dal **sito di
Oracle**. Questo è il passo che fa perdere mezz'ora a tutti, perché da dentro la macchina sembra
tutto a posto e la richiesta non arriva mai.

Quindi i cancelli sono **due**, e vanno aperti entrambi:
- quello del **quartiere** (Oracle, dal sito) → passo 7;
- quello della **casa** (il firewall della macchina) → lo apre lo script da sé, passo 11.

---

## Passi 1-6 — Il nome (DuckDNS) · sei al **computer**, nel browser

**1.** Ti serve l'indirizzo numerico pubblico del server. Apri il **Prompt dei comandi** e scrivi:

```bash
ssh -i "C:\Users\pietro\Desktop\trading\backtest app\applicazione\oracle\ssh-key-2026-10-06.key" ubuntu@100.100.244.65 "curl -s https://api.ipify.org; echo"
```

Esce un numero tipo `130.61.12.34`. **Scrivilo da parte**: è l'indirizzo di casa.
*Perché:* il cartello deve puntare al numero giusto, e questo è l'unico modo di saperlo con
certezza invece di indovinarlo.

**2.** Vai su **duckdns.org**. In alto scegli come entrare (Google, GitHub…). Usa un accesso che
ritrovi fra sei mesi.
*Perché:* se un domani il numero del server cambia, da lì si aggiorna il cartello.

**3.** Nella pagina che si apre, nel campo **«sub domain»** scrivi un nome, per esempio
`forexlab`, e premi **«add domain»**.
*Perché:* diventa `forexlab.duckdns.org`, e quello sarà l'indirizzo del server.

**4.** Nella riga appena creata, nel campo **«current ip»**, incolla il numero del passo 1 e premi
**«update ip»**.
*Perché:* è il momento in cui il cartello viene appeso alla porta giusta.

**5.** Nella stessa pagina, in alto, vedi scritto **«token»** con una sigla lunga. **Copiala e
tienila da parte** in un posto tuo (non nel progetto).
*Perché:* serve solo se un domani vuoi che il server aggiorni il numero da sé. Non serve ora, ma
dopo non la ritrovi.

**6.** Controlla che il cartello sia appeso. Sempre nel Prompt dei comandi:

```bash
nslookup forexlab.duckdns.org 8.8.8.8
```

Deve rispondere col numero del passo 1. Se dice «non-existent domain», **aspetta due minuti e
riprova**: il DNS ci mette un po'.
*Perché:* se questo passo non torna, il passo 12 fallirà e non capiresti perché — il certificato
si ottiene solo se il nome risponde.

---

## Passi 7-9 — Il cancello del quartiere (Oracle) · sei al **computer**, sul sito di Oracle

**7.** Entra su **cloud.oracle.com**, poi dal menu ☰ scegli **Networking → Virtual Cloud
Networks**. Clicca sulla tua VCN, poi su **Subnets**, poi sulla subnet che compare, e infine su
**Security Lists** → la lista che vedi (si chiama tipo «Default Security List for vcn-…»).
*Perché:* è il pannello che decide quale traffico entra nella rete del server.
*Nota:* Oracle rinomina spesso le voci del menu. Se non trovi un nome esatto, cerca **Networking**
e poi qualcosa con **VCN** dentro.

**8.** Premi **«Add Ingress Rules»** e compila così:

| campo | valore |
|---|---|
| Stateless | lascia **non** spuntato |
| Source Type | **CIDR** |
| Source CIDR | `0.0.0.0/0` |
| IP Protocol | **TCP** |
| Source Port Range | lascia vuoto |
| Destination Port Range | `443` |
| Description | `HTTPS per i documenti` |

Poi **«Add Ingress Rules»** in fondo.
*Perché:* `0.0.0.0/0` vuol dire «da qualunque parte del mondo», ed è giusto così: i clienti
arrivano da casa loro. Quello che li ferma non è il cancello, è il **token personale** su ogni
richiesta — e passa solo `/dati`, niente altro.

**9.** Controlla che la regola compaia nell'elenco, con `443` nella colonna delle porte.
*Perché:* se è andata a buon fine la vedi; se no, hai premuto Salva sulla schermata sbagliata — ed
è un errore che non dà nessun messaggio.

---

## Passi 10-13 — Il portinaio (Caddy) · sei nel **terminale del server**

**10.** Entra nel server. Dal Prompt dei comandi del computer:

```bash
ssh -i "C:\Users\pietro\Desktop\trading\backtest app\applicazione\oracle\ssh-key-2026-10-06.key" ubuntu@100.100.244.65
```

Quando il prompt diventa `ubuntu@pietro:~$` **sei dentro**: da qui in avanti i comandi girano sul
server, non sul tuo computer.
*Se risponde «Permission denied (publickey)»:* è la trappola già pagata l'8 ottobre, i permessi
del file chiave. Esci e dal Prompt del computer lancia
`icacls "…\oracle\ssh-key-2026-10-06.key" /grant:r "pietro:(R)"`, poi riprova.

**11.** Scarica il progetto aggiornato e lancia la preparazione, mettendo **il tuo** nome al posto
di quello di esempio:

```bash
cd /srv/fbl/progetto && git pull && FBL_DOMINIO=forexlab.duckdns.org bash server_oracle/prepara_dominio.sh
```

*Perché:* lo script apre la 443 sul firewall **della macchina** (il secondo cancello), installa
Caddy, prende il certificato ed espone solo `/dati`. Si ferma da sé con un messaggio chiaro se il
dominio non punta qui — non fa danni a metà.

**12.** Leggi le ultime righe. Lo script si prova da solo e ti dice due numeri:

| cosa vedi | significa |
|---|---|
| `401` su `/dati/session` | ✅ **perfetto.** La rotta c'è, il certificato è valido, e chiede chi sei |
| `404` su `/health` | ✅ **perfetto.** Tutto il resto del ponte non è esposto |
| nessuna risposta | ❌ il cancello del quartiere: torna al passo 8 |
| errore sul certificato | ❌ il nome non risponde: torna al passo 6 |

**13.** Prova dal telefono, **con i dati mobili e non col Wi-Fi di casa**. Apri il browser e vai su
`https://forexlab.duckdns.org/dati/session`.
Devi vedere il **lucchetto** 🔒 e una scritta tipo «Token Firebase mancante».
*Perché:* quel messaggio è la risposta giusta — vuol dire che il server ti ha sentito e ti ha
chiesto chi sei. E coi dati mobili sei fuori dalla tua rete, quindi stai provando la strada vera,
quella che faranno i clienti.

---

## Passo 14 — Dirlo all'app · sei al **computer**

**14.** Questo passo lo faccio io nel codice, e arriva in un rilascio a sé: l'app deve usare
`https://forexlab.duckdns.org` al posto del nome Tailscale. **Dimmi il nome che hai scelto al
passo 3** e lo collego.
*Perché:* finché l'app non lo sa, il server è raggiungibile ma nessuno lo chiama — e solo **dopo**
che questo funziona si toglie Tailscale, non prima.

---

## Se non funziona, quasi sempre è uno di questi tre

1. **La 443 nella Security List** (passo 8). Il sintomo è «nessuna risposta», non un errore: da
   dentro la macchina sembra tutto a posto. È il primo posto da guardare, sempre.
2. **Il nome che non punta ancora** (passo 6). Il DNS ci mette qualche minuto. Il sintomo è un
   errore sul certificato, che sembra un problema di Caddy e non lo è.
3. **La memoria del server.** Quella macchina ha ~951 MB di RAM. Se un'installazione si interrompe
   senza spiegazioni, è la memoria — non la configurazione. Si rilancia il passo 11: è innocuo,
   riprende da dove era.

## Una cosa che vale la pena sapere

Da qui in avanti il tuo server è su internet. Non è il furto dei dati il pericolo — per quello ci
sono i token personali, verificati contro Google, e ogni riga del database è legata all'utente che
l'ha scritta (c'è un test che lo misura). Il pericolo è che qualcuno **tenga occupata** una
macchina da 951 MB. La protezione che hai subito è che esiste **un solo percorso** raggiungibile;
il limite di richieste per indirizzo arriva come passo a sé, misurato, perché in Caddy richiede un
modulo aggiuntivo e preferisco farlo con la sua verifica che scriverti una riga che non parte.

---

# Parte seconda — il disco del server a 200 GB

## Prima: cosa ho misurato, perché cambia la richiesta

Entrato nel server il 5 novembre 2026, il disco dice questo:

```
/dev/sda1       242G  8.9G  233G   4% /
sda       8:0    0   250G  0 disk
```

Il disco **non è da ingrandire: è già da 250 GB**, e ne usi 8.9 (il 4%). Dentro ci sono 2.9 MB di
dati del ponte e 3.8 MB di backup. Quindi la richiesta «portiamolo a 200 GB» va letta al
rovescio: bisogna **scendere** da 250 a dentro i 200, perché 200 GB è il tetto che Oracle regala
per sempre (Always Free: 200 GB di block storage in tutto, boot volume compresi).

E qui c'è la cosa importante da sapere prima di toccare qualunque bottone:

- **Oracle sa ingrandire un boot volume, non sa rimpicciolirlo.** Non è una voce nascosta nel
  menu: non esiste. E nemmeno la strada del backup funziona, perché un backup si può ripristinare
  solo su un disco **grande almeno quanto l'originale**.
- Quindi i 250 GB non si tagliano. Si **sostituisce la macchina** con una uguale che ha il disco
  giusto — e questo si può fare senza spendere niente e senza restare offline, perché Always Free
  dà **due** macchine E2.1.Micro: la nuova nasce mentre la vecchia lavora ancora.
- Perché vale la pena farlo: finito il trial, le risorse oltre i limiti Always Free non vengono
  solo fatturate — possono essere **reclamate**. Il rischio non è una bolletta da un euro: è
  ritrovarsi senza server.

Se invece preferisci non muovere niente, l'alternativa onesta è passare a Pay As You Go e pagare i
50 GB in eccesso (storage a blocchi, nell'ordine dell'euro e mezzo al mese). È una scelta tua: i
passi qui sotto sono per la strada che non costa.

**Target: 50 GB.** Non 200: ne usi 8.9. Cinquanta è il minimo che Oracle accetta per un boot
volume, sta larghissimo, e ti lascia **150 GB di tetto libero** per il server dati che vuoi
comprare in futuro.

## Passi 15-17 — Prepararsi · sei al **computer**, sul sito di Oracle

**15.** Console Oracle → menu ☰ → **Storage → Block Volumes**, e poi **Storage → Boot Volumes**.
Somma le dimensioni di tutto quello che vedi.
*Perché:* il tetto dei 200 GB è sul **totale**, non sul singolo disco. Se trovi dischi di vecchie
prove staccati (stato «Available», non «Attached»), quelli occupano il tetto senza servire a
niente: sono i primi da cancellare, e magari il problema finisce qui.

**16.** Nella riga del boot volume della macchina «Pietro» → i tre puntini → **Create Boot Volume
Backup** → tipo **Full** → Create.
*Perché:* i passi dopo cancellano un disco. Always Free comprende 5 backup, quindi questo non
costa, e per dieci minuti di attesa ti compri la possibilità di tornare indietro.

**17.** Aspetta che il backup sia in stato **Available** prima di proseguire.
*Perché:* un backup «Creating» non è un backup.

## Passi 18-20 — La macchina nuova · sei al **computer**, sul sito di Oracle

**18.** **Compute → Instances → Create Instance**. Compila così, e sono tutti campi che devono
combaciare con la macchina di adesso:

| campo | valore |
|---|---|
| Name | `Pietro2` (un nome qualunque, serve solo a te) |
| Availability domain | lo stesso di adesso: `xVZl:EU-MILAN-1-AD-1` |
| Image | **Ubuntu 26.04** (la stessa che hai) |
| Shape | **VM.Standard.E2.1.Micro** — deve comparire **Always Free eligible** |
| Virtual cloud network | la **stessa VCN** di adesso |
| Subnet | la **stessa subnet** di adesso |
| Public IPv4 address | **Assign a public IPv4 address** |
| SSH keys | **Paste public keys**, e incolli il contenuto di `ssh-key-2026-10-06.key.pub` |

Poi apri **Specify a custom boot volume size** e scrivi **50**.

*Perché la stessa VCN e subnet:* così la regola della 443 che hai aperto al passo 8 vale già anche
per questa macchina, e non devi rifare niente.
*Perché «Always Free eligible»:* se quella scritta non c'è, stai creando una macchina a pagamento.
*Se dice «Out of capacity»:* è il muro già incontrato a ottobre con le ARM. Non cambiare niente e
riprova più tardi — Milano ha un solo availability domain, quindi non c'è un altro posto dove
spostarsi.

**19.** Quando la macchina è **Running**, copia il suo **Public IP address** dalla pagina dei
dettagli e scrivilo da parte: lo chiamo `IP-NUOVO`.

**20.** Entra nella macchina nuova e installa il ponte. Dal Prompt dei comandi del computer:

```bash
ssh -i "C:\Users\pietro\Desktop\trading\backtest app\applicazione\oracle\ssh-key-2026-10-06.key" ubuntu@IP-NUOVO
```

e poi, **dentro** la macchina nuova:

```bash
sudo mkdir -p /srv/fbl && sudo chown ubuntu:ubuntu /srv/fbl && cd /srv/fbl && git clone https://github.com/Pietro-Santini/Forex-Backtest.LAB.git progetto && cd progetto/server_oracle && bash prepara_server.sh
```

*Perché:* `prepara_server.sh` è lo stesso script che ha preparato la macchina di adesso — installa
Docker, costruisce i due contenitori e li avvia. Non c'è niente da configurare a mano.

## Passi 21-23 — Il trasloco · sei al **computer**

**21.** Porta via i dati della macchina vecchia (sono 7 MB in tutto, ci vogliono pochi secondi).
Dal Prompt dei comandi del **computer**, tre comandi in fila:

```bash
ssh -i "C:\Users\pietro\Desktop\trading\backtest app\applicazione\oracle\ssh-key-2026-10-06.key" ubuntu@100.100.244.65 "sudo tar czf /tmp/dati-fbl.tgz -C /srv/fbl dati backup && sudo chown ubuntu /tmp/dati-fbl.tgz"
```

```bash
scp -i "C:\Users\pietro\Desktop\trading\backtest app\applicazione\oracle\ssh-key-2026-10-06.key" ubuntu@100.100.244.65:/tmp/dati-fbl.tgz "%USERPROFILE%\Desktop\dati-fbl.tgz"
```

```bash
scp -i "C:\Users\pietro\Desktop\trading\backtest app\applicazione\oracle\ssh-key-2026-10-06.key" "%USERPROFILE%\Desktop\dati-fbl.tgz" ubuntu@IP-NUOVO:/tmp/
```

*Perché passa dal tuo computer:* le due macchine non si conoscono fra loro — la chiave ce l'hai tu,
non loro. Il file resta anche sul Desktop, ed è una copia in più che non fa male.

**22.** Nella macchina **nuova**, rimetti i dati al loro posto e riavvia i contenitori:

```bash
sudo tar xzf /tmp/dati-fbl.tgz -C /srv/fbl && sudo docker compose -f /srv/fbl/progetto/server_oracle/docker-compose.yml restart && sudo docker ps
```

Devi vedere **due contenitori Up**. Se ne vedi uno solo, guarda il perché con
`sudo docker compose -f /srv/fbl/progetto/server_oracle/docker-compose.yml logs --tail 40`.

**23.** Sposta il nome sulla macchina nuova: torna su **duckdns.org**, metti `IP-NUOVO` nel campo
**«current ip»** e premi **«update ip»**. Poi, dentro la macchina nuova:

```bash
cd /srv/fbl/progetto && FBL_DOMINIO=forexlab.duckdns.org bash server_oracle/prepara_dominio.sh
```

Deve finire con **401** su `/dati/session` e **404** su `/health`, come al passo 12. E riprova dal
telefono coi dati mobili, come al passo 13.
*Perché prima il nome e poi il certificato:* Let's Encrypt chiama il dominio per verificarlo, e
deve finire sulla macchina nuova. Se lanci lo script prima di aver spostato il nome, lo script si
ferma da sé e te lo dice.

## Passo 24 — Cancellare, e cancellare davvero

**24.** Solo **dopo** che il telefono vede la macchina nuova: console Oracle → **Compute →
Instances** → la macchina vecchia («Pietro») → **More actions → Terminate**, e **spunta
«Permanently delete the attached boot volume»**.

Poi vai in **Storage → Boot Volumes** e controlla che il disco da 250 GB **non ci sia più**.
*Perché questo passo è il punto di tutta la seconda parte:* se non spunti quella casella, la
macchina sparisce e **il disco da 250 GB resta**. Avresti 250 + 50 = 300 GB occupati del tetto,
cioè peggio di come hai iniziato. È l'unico errore qui che non dà nessun messaggio.

Alla fine devi avere **un disco da 50 GB** e, se tieni il backup del passo 16, un backup: totale
dentro i 200 GB, con 150 GB di margine.
