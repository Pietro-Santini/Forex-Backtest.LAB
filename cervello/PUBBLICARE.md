# Come si pubblica un aggiornamento, e come funziona il collaudo

Questo file risponde a tre domande che tornano ogni volta, e che una sessione nuova non può
indovinare:

1. **Dove finisce il codice?** Non c'è un posto solo: ce ne sono tre, e si aggiornano in tre modi
   diversi.
2. **Che cosa devo fare perché l'aggiornamento arrivi anche sul telefono**, e non solo sul
   computer?
3. **Che cos'è il collaudo**, che cosa prova davvero e che cosa non può provare.

Scritto per essere letto da chi non ha mai visto questo progetto e **non ha accesso né a GitHub né
alla cartella sul computer**: tutto quello che serve sapere è qui dentro.

---

## 1. Le tre destinazioni

Il codice di questo progetto gira in tre posti diversi. Sono indipendenti: aggiornarne uno **non**
aggiorna gli altri. È la causa numero uno dei «ma l'ho corretto e non funziona».

| Dove | Che cosa ci gira | Come si aggiorna | Chi lo vede |
|---|---|---|---|
| **Il sito** (GitHub Pages) | `app.html`, `sw.js`, `login.html`, pagine legali | `git push` su `main` | computer, telefono, tablet — **tutti** |
| **Il computer di casa** (Windows) | tre programmi: ponte MT5 (porta 8000), dati del grafico (8001), lettore Syntra (8769) | si installa un **Setup nuovo** | solo il computer |
| **Il server Oracle** (Linux, sempre acceso) | Kraken simulato (8000) e sale segnali Telegram (8769) | si lancia uno script **sul server** | tutti, perché telefono e tablet passano da lì |

**Nomi delle macchine** (servono per collegarsi; sono nomi della rete privata Tailscale, non
indirizzi pubblici):

- Server Oracle: **`pietro.tail83d918.ts.net`** — utente `ubuntu`
- Computer di casa: **`desktop-d15isfu.tail83d918.ts.net`**

---

## 2. Quale file obbliga a quale aggiornamento

Questa è la tabella decisiva. Dopo aver cambiato un file, si guarda qui per sapere che cosa fare.

| File cambiato | Basta il push? | Serve un Setup nuovo? | Serve aggiornare il server? |
|---|---|---|---|
| `app.html` | **sì** (+ alzare `CACHE_NAME`) | no | no |
| `sw.js`, `index.html`, `login.html`, pagine legali | **sì** | no | no |
| `cervello/…`, `laboratorio/…`, `README.md` | sì (non cambia niente per l'utente) | no | no |
| `installer_build/build/bridge.py` | no | **sì** | no |
| `installer_build/build/mt5_feed_server.py` | no | **sì** | no |
| `installer_build/build/registratore.py` | no | **sì** | no |
| `installer_build/build/segnali_telegram/segnali_bridge.py` | no | **sì** | **sì** |
| `installer_build/build/segnali_telegram/parser_segnali.py` | no | **sì** | **sì** |
| `installer_build/build/segnali_telegram/syntra_lettore.py`, `storico_sale.py`, `avvio_bluestacks.py` | no | **sì** | **sì** |
| `installer_build/build/accesso_condiviso.py` | no | **sì** | **sì** |
| `installer_build/build/kraken_ordini.py`, `kraken_simulato.py` | no | **sì** | **sì** |
| `server_oracle/…` (`ponte_server.py`, `Dockerfile`, `docker-compose.yml`, `prepara_server.sh`) | no | no | **sì** |
| `installer_build/installer.iss` | no | **sì** | no |

**Perché proprio questi file toccano il server.** L'immagine del server copia dentro di sé
l'intera cartella `installer_build/build` più `server_oracle`, ma poi ne esegue solo due cose:
`server_oracle/ponte_server.py` (che importa `accesso_condiviso` e `kraken_ordini`, che a sua
volta importa `kraken_simulato`) e `installer_build/build/segnali_telegram/segnali_bridge.py`
(che importa `parser_segnali` e `accesso_condiviso`). Tutto quello che finisce in quella catena va
riportato sul server; `bridge.py` e `mt5_feed_server.py` no, perché sul server non girano — la
libreria di MetaTrader 5 esiste solo per Windows.

> **Il push su `main` è sempre il primo passo**, anche quando serve altro: il Setup lo costruisce
> GitHub dal repository, e lo script del server scarica da `main`. Se non hai spinto, aggiorneresti
> il server con il codice di prima.

---

## 3. Perché sul telefono non arriva l'aggiornamento

L'app è una **PWA**: il telefono si tiene una copia della pagina in memoria (la fa il file
`sw.js`, il «service worker») così si apre anche senza rete. Il rovescio è che, finché quella
copia è valida, il telefono **continua a mostrare la versione vecchia** anche se il sito è
aggiornato.

L'unica cosa che invalida quella copia è il numero di versione dentro `sw.js`:

```
const CACHE_NAME = "forex-backtest-lab-v124";
```

**Se cambi `app.html` e non alzi quel numero, sul computer magari vedi la modifica (basta un
ricarica forzato) ma su telefono e tablet no, e può restare così per giorni.** È l'errore più
comune, e dà l'impressione che la correzione non funzioni.

Regola: `app.html` cambiato → `CACHE_NAME` da `vNN` a `vNN+1`. E, per tenere allineata la
numerazione, anche `MyAppVersion` in `installer_build/installer.iss` passa a `1.0.NN+1`.

Dopo il push, sul telefono: **ricaricare la pagina**. A volte serve ricaricarla due volte — la
prima il telefono scarica la versione nuova, la seconda la usa.

---

## 4. Procedura A — pubblicare l'app (il caso normale)

Da fare nella cartella del repository sul computer.

**1. Alza la versione.** In `sw.js`, riga 55 circa, da `...-vNN` a `...-vNN+1`.
In `installer_build/installer.iss`, riga 22 circa, `MyAppVersion` allo stesso numero.

**2. Fai girare il collaudo.** Deve finire con `Falliti: 0`. Dura circa dieci minuti.

```bash
bash laboratorio/collauda.sh
```

**3. Aggiorna la memoria del progetto** (`cervello/`): `DIARIO.md` sempre; `BUG.md` se hai
corretto un difetto, con la causa vera e il test che lo copre; `LEZIONI.md` se hai imparato
qualcosa che non va ripetuto.

**4. Pubblica.** Si aggiungono i file **per nome**, mai con `git add -A`: nella cartella ci sono
anche file che non devono mai finire nel repository.

```bash
git add app.html sw.js installer_build/installer.iss cervello/DIARIO.md
git commit -m "App vNN: che cosa cambia, in italiano"
git push origin main
```

**5. Verifica che sia online davvero.** Non fidarti del push: guarda cosa c'è sul ramo pubblicato.

```bash
git fetch origin && git show origin/main:sw.js | grep CACHE_NAME
```

Deve dire il numero nuovo. Il sito si aggiorna da solo entro un minuto o due.

**6. Sul telefono**: ricarica la pagina (se serve, due volte).

---

## 5. Procedura B — aggiornare il server Oracle

Serve **solo** per i file della tabella al punto 2 che hanno «sì» nell'ultima colonna. Prima
di farlo, il push deve essere già andato.

**Come ci si collega** (la chiave privata sta solo sul computer del proprietario, fuori dal
repository):

```bash
ssh -i <percorso della chiave> ubuntu@pietro.tail83d918.ts.net
```

**Il comando che fa tutto**, una volta dentro:

```bash
cd /srv/fbl/progetto/server_oracle && bash prepara_server.sh
```

Lo script scarica l'ultima versione da `main`, ricostruisce le immagini Docker, riavvia i due
servizi, li ripubblica su Tailscale in HTTPS e stampa nome e chiave del server. Rilanciarlo è
innocuo: si può ripetere quante volte si vuole.

**Che cosa NON tocca**: la cartella `/srv/fbl/dati`, dove vivono la sessione di Telegram e la
chiave d'accesso. Per questo dopo l'aggiornamento il ponte si ricollega da solo, senza richiedere
il codice di Telegram, e la chiave già salvata su telefono e tablet resta valida.

> **Trappola, già costata un aggiornamento fatto a metà.** Lo script stampa la chiave d'accesso in
> fondo, quindi viene naturale filtrarne l'output. Ma un filtro tipo `sed -n "/Chiave/q;p"`
> **ferma lo script a metà**, perché il passo 4 si intitola «== 4) Chiave d'accesso»: il filtro
> esce lì, la pipe si chiude, e il `docker compose --build` del passo 5 non parte mai. Il
> risultato è il peggiore possibile — sorgenti aggiornati sul disco, contenitori ancora sul codice
> vecchio — e il comando riporta «riuscito», perché quell'esito è del filtro, non dello script.
> Il modo giusto: scrivere l'output in un file, leggere l'esito **dello script**, e tagliare con un
> motivo ancorato a inizio riga.

```bash
cd /srv/fbl/progetto/server_oracle && bash prepara_server.sh > /tmp/log 2>&1; echo "ESITO: $?"; sed "/^Chiave d.accesso/,\$d" /tmp/log | tail -15; rm -f /tmp/log
```

**Come si controlla che sia andata davvero**, sempre sul server:

```bash
git -C /srv/fbl/progetto log --oneline -1     # dev'essere l'ultimo commit di main
sudo docker ps                                 # due contenitori, "Up" da pochi secondi
curl -s http://127.0.0.1:8000/health           # ok:true, e pc.registrato:true
curl -s http://127.0.0.1:8769/health           # collegato:true, e l'elenco "titoli" delle sale
sudo docker logs --tail 20 server_oracle-segnali-1   # "in ascolto su: ..." per ogni sala
```

**La verifica che vale davvero** è provare la correzione dentro il contenitore, non fidarsi del
commit. Esempio, per una correzione al riconoscimento degli strumenti:

```bash
sudo docker exec server_oracle-segnali-1 python3 -c "
import sys; sys.path.insert(0,'/fbl/installer_build/build/segnali_telegram')
from parser_segnali import trova_strumento
print(trova_strumento('AUD / CAD SELL 0.993'))"
```

---

## 6. Procedura C — il Setup nuovo per il computer

Non va costruito a mano: lo costruisce GitHub da solo a ogni push su `main` che tocchi
`app.html`, `sw.js` o `installer_build/`, e **pubblica anche la release**.

Si scarica da:

```
https://github.com/Pietro-Santini/Forex-Backtest.LAB/releases/latest
```

Il file è `ForexBacktestLAB_Setup.exe`. Si installa sopra la versione precedente: il Setup chiude
da solo i programmi vecchi. Windows può avvisare (SmartScreen) perché il programma non è firmato:
«Ulteriori informazioni» → «Esegui comunque».

Il numero del Setup lo ricava GitHub da `sw.js`: app `v124` → Setup `1.0.124`.

> **Come accorgersi che il Setup è vecchio.** Se una correzione ai programmi del computer «non
> funziona», prima di cercare il guasto nella rete confronta la data di
> `ForexBacktestLAB.exe` installato con quella dell'ultima release. È già successo: MT5 non
> funzionava dal telefono perché il ponte installato era più vecchio dell'app di poche ore.

---

## 7. Il collaudo: che cos'è e che cosa prova

### Come si lancia

```bash
bash laboratorio/collauda.sh
```

Dura circa **dieci minuti** (la parte lunga apre un browser vero decine di volte). Scrive il
riassunto in `laboratorio/risultati/ultimo.md` e i registri completi in `laboratorio/risultati/`.
Finisce con `Falliti: 0` se è tutto a posto.

### I cinque passi, uno per uno

| Passo | Che cosa controlla | Se è rosso vuol dire |
|---|---|---|
| `sintassi_app` | che ogni blocco `<script>` di `app.html` si compili | hai rotto il codice: l'app non parte proprio |
| `versione_sw` | che `sw.js` abbia un `CACHE_NAME` scritto bene | la riga della versione è malformata |
| `ponte_python` | il conto Kraken simulato: stop e target sulle candele, ordini pendenti | i conti dei soldi del simulatore sbagliano |
| `interprete_segnali` | l'interpretazione dei messaggi delle sale, su messaggi veri di sei canali | un formato di segnale non viene più capito |
| `app_browser` | apre l'app in un browser vero e la prova: avvio, barra ordini, posizioni, Trade Journal, grafico, cronologia | qualcosa nell'app non si comporta come deve |

### Che cosa il collaudo NON può provare

È la parte che conta di più, perché un verde può ingannare.

- **Non prova la strada vera.** Apre `app.html` **da file**, con la **rete bloccata** e il velo
  dell'accesso nascosto. Quindi non prova il sito in HTTPS, l'accesso con Firebase, il service
  worker, né il collegamento al server. È il motivo per cui una volta il collaudo era verde mentre
  sul telefono l'app restava ferma sul logo.
- **Non prova MT5, Syntra, Telegram vero, né conti con soldi veri.** Quelli si provano solo a mano,
  sul computer, su conto demo o simulato.
- **Verde sul computer non dice niente su GitHub.** Le librerie installate sono diverse. GitHub
  rifà lo stesso collaudo da solo a ogni push (flusso «Collaudo»), e quello è l'esito che conta.

### La regola sui test, e un inganno da conoscere

Una correzione si dichiara fatta **solo con un test che prima falliva e ora passa**. Senza test è
un'opinione. Si verifica così: si mette da parte il file corretto, si rimette quello di prima, si
lancia il test e **deve essere rosso**; poi si rimette il file corretto e dev'essere verde.

Non è una formalità. Il 9 ottobre 2026 un test sulle righe disegnate sul grafico passava sia con
il difetto sia senza: le operazioni finte che usava stavano fuori dalla finestra visibile, quindi
non veniva disegnato niente e il test misurava il vuoto scambiandolo per una conferma. Se ne è
accorto solo chi ha fatto la verifica del rosso. Da lì la regola in più: un test sul disegno deve
contenere anche una **prova di controllo** che fallisce se quello che dovrebbe essere disegnato
non viene disegnato affatto.

---

## 8. Riassunto operativo

**Ho cambiato solo `app.html`** (il caso più frequente):
alza `CACHE_NAME` → collaudo verde → `git push` → verifica su `origin/main` → ricarica sul
telefono. Nient'altro.

**Ho cambiato qualcosa sotto `installer_build/build/`**:
tutto quanto sopra, **più** installa il Setup nuovo dalla pagina delle release. E se il file era
fra quelli della colonna «server» della tabella al punto 2, **anche** `bash prepara_server.sh` sul
server `pietro.tail83d918.ts.net`.

**Ho cambiato qualcosa sotto `server_oracle/`**:
push, poi `bash prepara_server.sh` sul server. Nessun Setup.

**In dubbio**: guarda la tabella al punto 2. Se il file sta in quella catena, il server va
aggiornato; se non lo fai, continuerà a girare il codice vecchio senza dirtelo.
