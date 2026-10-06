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
3. Image: **Ubuntu** (24.04).
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

## 3. Entrare nel server (dal PC Windows)
Nel Prompt dei comandi, dalla cartella dove hai salvato la chiave (es. `Download`):

```
cd /d %USERPROFILE%\Downloads
```
```
ssh -i nome-della-chiave.key ubuntu@INDIRIZZO-IP-PUBBLICO
```
Alla domanda "Are you sure you want to continue connecting" scrivi `yes`.

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

Finché il lavoro non è unito a `main`, lancia lo script con il ramo di lavoro:
```
FBL_RAMO=ccr-40c44692-qdmdmj bash prepara_server.sh
```

## 5. Telegram sul server
La sessione Telegram vivrà nella cartella `/srv/fbl/dati/segnali` del server (decisione del 6
ottobre 2026). Il primo collegamento (api_id, api_hash, codice di verifica) si fa dall'app,
puntata al server, come si fa oggi col PC.

## 6. Collegare l'app al server
Nell'app servirà indicare l'indirizzo del server e la chiave: è il prossimo passo di sviluppo
(oggi l'app usa un solo indirizzo, quello del PC).

## Aggiornare il server
Sul server, rilancia `bash prepara_server.sh`: scarica la versione nuova e riavvia i servizi.

## Sicurezza
- Nessuna porta del server è aperta su internet per l'app: i servizi ascoltano solo in locale e
  arrivano ai tuoi dispositivi tramite Tailscale, con la chiave.
- Sul server **solo il conto Kraken simulato**: il ponte rifiuta le chiavi reali.
- La chiave SSH e la chiave d'accesso sono credenziali: non condividerle.
