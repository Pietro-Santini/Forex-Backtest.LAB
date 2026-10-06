# Server Oracle per Forex Backtest LAB — guida passo passo

Cosa ottieni: un server sempre acceso, gratis (piano "Always Free" di Oracle), dove girano il conto
Kraken **simulato**, gli ordini pendenti e il ponte delle sale **Telegram**. L'app lo raggiunge
ovunque tramite Tailscale. MT5 resta sul PC di casa (strada "ibrida", `cervello/ORACLE.md`).

Tempo: circa 40 minuti la prima volta. Le condizioni del piano gratuito le decide Oracle: se una
schermata è diversa da come è scritto qui, segui quella di Oracle.

## 1. Account Oracle
1. Vai su oracle.com/cloud/free e crea l'account (serve una carta per la verifica; il piano
   Always Free non addebita nulla finché non passi a pagamento).
2. Scegli come regione una vicina (es. Milano o Francoforte). **Non si cambia dopo.**

## 2. La macchina
1. Menu → Compute → Instances → **Create instance**.
2. Nome: `fbl-server`.
3. Image: premi **Change image** → **Ubuntu** → **Canonical Ubuntu 24.04** (la predefinita è
   Oracle Linux: con quella lo script non funziona).
   Nell'elenco delle versioni scegli proprio **24.04**: la 20.04 non riceve più aggiornamenti di
   sicurezza gratuiti e Docker non la supporta più. Una volta dentro, `lsb_release -d` deve dire 24.04.
4. Shape: **Ampere** → `VM.Standard.A1.Flex`, 2 OCPU e 12 GB di memoria (dentro il gratuito).
5. Networking: lascia quello proposto, con indirizzo IP pubblico.
6. SSH keys: **Generate a key pair for me** → scarica **la chiave privata** e tienila al sicuro
   (è la chiave del server: non va mandata a nessuno).
7. Create. Dopo un paio di minuti lo stato è "Running": annota il **Public IP address**.

### Se compare "Out of capacity for shape VM.Standard.A1.Flex"
Le macchine ARM gratuite sono esaurite in quella zona: capita spesso. In ordine:
1. **Più piccola:** 1 OCPU e 6 GB (bastano per questo server) e riprova.
2. **Altro availability domain:** se la regione ne ha più di uno (AD-1, AD-2, AD-3), prova gli
   altri. Milano ne ha uno solo; Francoforte tre.
3. **Piano B, subito:** la macchina **AMD gratuita** `VM.Standard.E2.1.Micro` (1 OCPU, 1 GB) di
   solito è disponibile. Per questo server basta: lo script aggiunge da solo 2 GB di swap. Più
   avanti si può passare alla ARM senza perdere niente (si rilancia lo script sulla nuova).
4. **Pay As You Go:** passare l'account a pagamento a consumo sblocca spesso la capacità ARM; le
   risorse Always Free restano gratuite. Prima imposta un **budget con avviso a 1 €**
   (Billing → Budgets) per non avere sorprese.

### Se la macchina non ha "Public IP address" (solo l'IP privato)
Senza IP pubblico non ci entri dal PC e il server non scarica niente. Si aggiunge senza rifarla:
1. Compute → Instances → la tua macchina → in basso **Attached VNICs** → clicca la VNIC.
2. In basso **IPv4 Addresses** → tre puntini ⋮ sulla riga dell'IP privato → **Edit**.
3. "Public IP type": **Ephemeral public IP** → **Update**. Il numero compare nella pagina della macchina.

Se "Ephemeral public IP" non si può scegliere, la macchina è in una rete privata: Networking →
Virtual cloud networks → **Start VCN Wizard** → **Create VCN with Internet Connectivity**, poi
ricrea la macchina scegliendo quella rete e la sua **public subnet**.

## 3. Entrare nel server (dal PC Windows)
`ubuntu` è il nome dell'utente del server e resta così; al posto di INDIRIZZO-IP-PUBBLICO va solo il
numero (es. `ubuntu@130.61.45.78`).
Nel Prompt dei comandi, dalla cartella dove hai salvato la chiave (es. `Download`):

```
cd /d %USERPROFILE%\Downloads
```
```
ssh -i nome-della-chiave.key ubuntu@INDIRIZZO-IP-PUBBLICO
```
Alla domanda "Are you sure you want to continue connecting" scrivi `yes`.

Se Windows risponde **"UNPROTECTED PRIVATE KEY FILE"**, dalla stessa cartella:
```
icacls nome-della-chiave.key /inheritance:r
```
```
icacls nome-della-chiave.key /grant:r "%USERNAME%:R"
```
e rilancia il comando `ssh`. Quando vedi `ubuntu@fbl-server:~$` sei dentro il server.

Se risponde **"Permission denied (publickey,gssapi-keyex,gssapi-with-mic)"**:
- probabilmente la macchina è **Oracle Linux** e non Ubuntu (l'immagine predefinita): prova
  `ssh -i nome-della-chiave.key opc@INDIRIZZO-IP-PUBBLICO`. Se entra, ricrea la macchina con
  **Change image → Ubuntu 24.04** (la guida e lo script sono per Ubuntu): Terminate, poi Create.
- se non entra nemmeno `opc`, la chiave non è quella di questa macchina: serve il file `.key`
  (non `.key.pub`) scaricato quando hai creato **questa** istanza.
- macchina ricreata con lo stesso IP: prima dell'ssh, `ssh-keygen -R INDIRIZZO-IP-PUBBLICO`.

## 4. Preparare tutto (sul server)
Una riga alla volta:

```
curl -fsSLO https://raw.githubusercontent.com/Pietro-Santini/Forex-Backtest.LAB/main/server_oracle/prepara_server.sh
```
```
bash prepara_server.sh
```
Lo script installa Docker e Tailscale, scarica il progetto, crea la chiave d'accesso, avvia i
servizi e li pubblica sulla tua rete Tailscale. A metà ti mostra un link Tailscale: aprilo e
accedi con lo **stesso account Tailscale** del PC e del telefono.

Alla fine stampa:
- **l'indirizzo del server** (`https://fbl-server.xxxx.ts.net`);
- **la chiave d'accesso**.

Tienili per il punto 6. La chiave non va mandata a nessuno, nemmeno a Claude.

**Finché il lavoro non è unito a `main`** lo script non è su `main`: scaricalo e lancialo dal
ramo di lavoro, al posto dei due comandi sopra:
```
curl -fsSLO https://raw.githubusercontent.com/Pietro-Santini/Forex-Backtest.LAB/ccr-40c44692-qdmdmj/server_oracle/prepara_server.sh
```
```
FBL_RAMO=ccr-40c44692-qdmdmj bash prepara_server.sh
```

## 5. Telegram sul server
La sessione Telegram vivrà nella cartella `/srv/fbl/dati/segnali` del server (decisione del 6
ottobre 2026). Il primo collegamento (api_id, api_hash, codice di verifica) si fa dall'app,
puntata al server, come si fa oggi col PC.

## 6. Collegare l'app al server
Nell'app (v87 o successiva): **Collegamento/Modalità → sezione "Server sempre acceso (Oracle)"**.
1. "Nome del server": quello stampato alla fine dello script (es. `nome.tail1234.ts.net`).
2. "Chiave del server": quella stampata dallo script.
3. **Prova il server** → deve dire "✅ Server raggiungibile". Poi **Salva il server**.
Da quel momento Kraken (conto simulato) e sale segnali passano dal server; MT5 resta sul computer.
Il dispositivo deve avere Tailscale acceso, con lo stesso account del server. Va fatto su ogni
dispositivo (PC, telefono, tablet): la chiave non viaggia da sola tra un dispositivo e l'altro.

## Aggiornare il server
Sul server, rilancia `bash prepara_server.sh`: scarica la versione nuova e riavvia i servizi.

## Sicurezza
- Nessuna porta del server è aperta su internet per l'app: i servizi ascoltano solo in locale e
  arrivano ai tuoi dispositivi tramite Tailscale, con la chiave.
- Sul server **solo il conto Kraken simulato**: il ponte rifiuta le chiavi reali.
- La chiave SSH e la chiave d'accesso sono credenziali: non condividerle.
