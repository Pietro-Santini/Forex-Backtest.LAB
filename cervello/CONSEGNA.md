# Consegna del lavoro — stato al 7 ottobre 2026

Questo documento serve a chi riprende il lavoro da zero (persona o agente AI) **senza aver visto le
sessioni precedenti**. Dice com'è fatto il sistema, cosa è stato fatto oggi, cosa manca e con che
regole si lavora.

Scritto il 7 ottobre 2026, con l'app a **v99** e il Setup a **1.0.77**.

> Prima di toccare qualunque cosa: leggi `cervello/REGOLE.md` (regole non negoziabili),
> `cervello/METODO.md`, `cervello/MAPPA.md` e le voci di `cervello/BUG.md` sulla parte che tocchi.
> Questo file è il riassunto, non il sostituto.

---

## 1. Che cos'è il progetto

**Forex Backtest LAB**: applicazione web per backtest e operatività su forex e cripto, con replay
del grafico, indicatori (footprint, heatmap, profilo volumetrico 3D), Trade Journal, statistiche,
lettura di sale segnali Telegram e dell'app Android *Syntra*, e apertura di ordini reali su
MetaTrader 5 e Kraken Futures.

Il proprietario **non è una sala segnali**: le sale sono di terzi e l'app si limita a leggerne i
messaggi pubblici.

### I pezzi

| Pezzo | Dove sta | Che cos'è |
|---|---|---|
| `app.html` | repo, servita da GitHub Pages | **l'applicazione**: 4,3 MB, ~38.700 righe, il 91% in un solo blocco `<script>`, nessun framework, 1.365 funzioni al primo livello |
| `sw.js` | repo | service worker: cache offline e aggiornamenti |
| `index.html`, `login.html` | repo | sito e accesso (Firebase) |
| `installer_build/build/bridge.py` | PC, porta **8000** | ponte MT5: ordini veri, Kraken, servizio dell'app |
| `installer_build/build/mt5_feed_server.py` | PC, porta **8001** | dati del grafico dal terminale MT5 |
| `installer_build/build/segnali_telegram/segnali_bridge.py` | PC o server, porta **8769** | sale segnali Telegram + lettore Syntra |
| `installer_build/build/accesso_condiviso.py` | condiviso dai tre servizi | **un solo** controllo d'accesso: chiave, Tailscale, porte |
| `server_oracle/` | server Oracle (Linux) | Dockerfile, `docker-compose.yml`, `ponte_server.py`, `prepara_server.sh` |
| `laboratorio/` | repo | banco di prova: 21 file di test (Playwright + node:test + pytest) |
| `cervello/` | repo | **memoria del progetto**: regole, mappa, bug, lezioni, idee, diario |

---

## 2. Repository e pubblicazione

- **Repo**: `https://github.com/Pietro-Santini/Forex-Backtest.LAB` — ramo **`main`**.
- **Sito**: GitHub Pages da `main` → `https://pietro-santini.github.io/Forex-Backtest.LAB/app.html`.
- **Accesso**: GitHub CLI (`gh`) installato e collegato sul PC del proprietario (account
  `Pietro-Santini`). `gh run list`, `gh run view --log-failed`, `gh run watch` funzionano.
- `.mcp.json` dichiara il server MCP di GitHub.

### Come si pubblica (obbligatorio, non è uno stile)

1. `bash laboratorio/collauda.sh` deve finire con **`Falliti: 0`**.
2. **Alzare `CACHE_NAME` in `sw.js`** (`forex-backtest-lab-vNN` → `vNN+1`) ogni volta che cambia
   `app.html`. È l'unica cosa che fa arrivare l'aggiornamento a telefoni e tablet.
3. Salvare su un ramo `lavoro/<nome>`, poi **merge** su `main` (mai riscrivere la storia, mai
   `--force`).
4. Verificare che sia online davvero: `git show origin/main:sw.js | grep CACHE_NAME`.
5. **Controllare il collaudo SU GITHUB**: `gh run list --workflow=collaudo.yml --limit 3`.
   Verde sul PC non dice niente su GitHub — le librerie installate sono diverse.

Due controlli automatici lo impongono (`.claude/hooks/guardia_git.py`): bloccano il push su `main`
se il collaudo non è verde da meno di 30 minuti, o se `app.html` cambia senza un `CACHE_NAME`
nuovo. Un terzo (`guardia_segreti.py`) blocca `git add` se stanno per entrare chiavi o sessioni.

### L'installer

Il flusso GitHub **«Installer Windows»** (`.github/workflows/installer.yml`) costruisce
`ForexBacktestLAB_Setup.exe` a ogni push che tocca `app.html`, `sw.js` o `installer_build/`. Si
scarica con `gh run download <id>`. Per creare anche la **release** serve lanciarlo a mano con
`pubblica=true` dopo aver alzato `MyAppVersion` in `installer_build/installer.iss`.

**Importante**: l'app si aggiorna da sola dal sito, ma i **tre eseguibili sul PC no**. Ogni
modifica a `bridge.py`, `mt5_feed_server.py` o `segnali_bridge.py` richiede un Setup nuovo.

---

## 3. Come sono collegati i dispositivi

### Tailscale, e solo Tailscale

Niente porte aperte sul router, niente regole del firewall, niente Wi-Fi locale. Tutti i
dispositivi stanno sulla rete privata Tailscale dello stesso account.

I tre servizi ascoltano **solo su `127.0.0.1`**, sempre. Dagli altri dispositivi ci si arriva con
**Tailscale Serve**, che risponde in **HTTPS** sul nome `.ts.net` e gira le richieste ai servizi
locali. Si usa il **nome**, mai l'indirizzo `100.x.y.z`: il collegamento è in https e il
certificato vale solo per il nome.

**Conseguenza non ovvia, già costata tempo**: «arriva da 127.0.0.1» non vuol più dire «è il PC».
Ci arriva anche Tailscale Serve per conto del tablet. `accesso_condiviso.richiesta_locale()` lo
distingue da due cose che Tailscale Serve fa sempre: mette `X-Forwarded-For` e lascia l'`Host`
originale (il nome `.ts.net`).

### La macchine, oggi

| | Nome Tailscale | Che cosa fa |
|---|---|---|
| PC di casa | `desktop-d15isfu.tail83d918.ts.net` | MT5 (terminale + ponte 8000), dati grafico (8001). **Windows**: Syntra gira solo qui |
| Server Oracle | `pietro.tail83d918.ts.net` | Kraken simulato (8000), sale segnali Telegram (8769). **Sempre acceso** |
| Telefono, tablet | — | aprono il sito e parlano col server |

### Il server è la PORTA UNICA

Deciso dal proprietario il 7 ottobre: **dal telefono si scrive solo nome e chiave del server**, mai
più quelli del computer. Ma MT5 gira sul PC e sul server non ci sarà mai (la libreria MetaTrader5
esiste solo per Windows). Quindi:

1. **Il PC si presenta al server da solo.** L'app, aperta sul PC, chiama `POST /registra-al-server`
   sul ponte locale (accettato solo da `127.0.0.1`); il ponte legge il proprio nome Tailscale e la
   propria chiave e li manda al server con `POST /pc/registra`. Il server li salva in
   `/srv/fbl/dati/pc.json`, che sopravvive al riavvio del contenitore.
2. **Il server gira le richieste al PC**: `/pc/<porta>/<percorso>` per le tre porte previste
   (8000 ordini, 8001 grafico, 8769 segnali) e **anche i canali WebSocket**, che servono ai prezzi
   dal vivo. `/pc/<percorso>` senza porta vale 8000.
3. **L'app sceglie la strada da sola**: chiede una volta se il ponte locale risponde
   (`fblControllaPonteLocale`, ricontrollato ogni minuto). Sul computer va **diretta** (più veloce,
   e i dati del grafico non fanno il giro fino in Oracle); dal telefono **passa dal server**.
4. **La chiave giusta la mette un punto solo**: `fblConChiave()` riconosce l'indirizzo del server —
   sia `https://` sia `wss://` — e usa la chiave del server. Metterla nei singoli punti
   significherebbe dimenticarsene in qualcuno.

La catena dei prezzi dal vivo è: **terminale MT5 → ponte sul PC (8001) → server → telefono**.

### Il server Oracle, in pratica

- Ubuntu + Docker, macchina AMD del piano gratuito.
- Progetto in **`/srv/fbl/progetto`**, dati in **`/srv/fbl/dati`** (volume Docker).
- Chiave d'accesso in `/srv/fbl/dati/accesso_remoto.json` — **non esce mai dal server verso l'app**.
- Due contenitori: `ponte` (8000) e `segnali` (8769), `restart: unless-stopped`.
- **Per aggiornarlo basta un comando**, ed è idempotente:
  ```bash
  curl -fsSLO https://raw.githubusercontent.com/Pietro-Santini/Forex-Backtest.LAB/main/server_oracle/prepara_server.sh
  bash prepara_server.sh
  ```
  Scarica la versione nuova, ricostruisce l'immagine (`--build`), riavvia, ripubblica su Tailscale
  e stampa nome e chiave.
- Verifica: `curl -s http://127.0.0.1:8000/health` → deve dire `"servizio":"server-oracle"` e
  `"pc":{"registrato":true,...}`.

**Il server rifiuta per progetto le chiavi Kraken reali**: lì gira solo il conto simulato.

---

## 4. Che cosa è stato fatto oggi (7 ottobre 2026)

Diciotto pubblicazioni su `main`, dalla v88 alla v99. Tutte con il collaudo di GitHub verde.

### Prima di tutto: il collaudo era rotto

**Il flusso Collaudo su GitHub era rosso dal 6 ottobre, a ogni push, e nessuno se n'era accorto.**
La regola «si pubblica solo col collaudo verde» era rispettata solo sul PC. Causa: il flusso
installava `fastapi` ma non `uvicorn`, e `segnali_bridge.py` esce già all'import con «Mancano le
librerie» — i test del ponte **non partivano affatto**. Ora le librerie si prendono da
`requirements.txt`, il file che le dichiara.

### Le versioni

| | Che cosa |
|---|---|
| **v90** | Non si chiede più di «installare i pacchetti aggiuntivi» a chi li ha già: l'app provava `/health` una volta sola, ora aspetta e riprova |
| **v91** | **Il telefono non resta più fermo sul logo.** Misurato: `app.html` pesa 4,03 MB e il service worker lo riscaricava a ogni apertura (`cache:'no-store'`), mostrando la copia salvata solo dopo 4 secondi. Ora la copia si mostra subito e la rete aggiorna dietro |
| **v92** | **Si lavora in backtest anche senza internet**, con una verifica vera della connessione (`navigator.onLine` dice «sì» anche su una Wi-Fi che non naviga) |
| **v93** | Collegamento/Modalità: **si scrive solo il server**; tre righe dicono se ordini, grafico e segnali rispondono, aggiornate da sole ogni 6 s |
| **v94** | **Trade Journal di Kraken ricostruito dal server**: le chiusure avvenute a app spenta non si perdono più |
| **v95** | Cronologia delle sale **per periodo** (1, 2, 5 mesi, 1 o 2 anni) e simulatore di rendimento |
| **v96** | **La strategia si imposta e si prova** sulla cronologia: quote per TP, spostamento dello stop, chiusura parziale |
| **v97** | Barre dei grafici non più sopra i nomi; accesso Telegram che dice cosa farà al prossimo tentativo |
| **v98** | **Dal telefono funziona anche il grafico** (porta 8001 girata dal server); «computer spento» separato da «nessun computer registrato»; Syntra dice la verità quando gira su Linux |
| **v99** | **Prezzi dal vivo dal telefono** (canali WebSocket girati dal server); pulsante «Pagina di prova» che si apre all'indirizzo giusto |
| **v100** | Linee TP/SL di Kraken **ferme** (prima avanzavano col prezzo); posizioni Kraken in un riquadro **separato** da MT5, con le stesse colonne e i pulsanti «vai a grafico», «seleziona», «BE» |
| **v101** | TP automatico **1:1** quando si apre senza target; prima di confermare si vede **l'entrata media e la dimensione totale** che risulteranno dalla fusione |
| **v102** | Si **seleziona** una posizione Kraken e si **spostano TP e SL** (nuovo `POST /tp` sul ponte: su Kraken un target è un ordine limite «reduce only», quindi si mette il nuovo **prima** di togliere il vecchio) |
| **v103** | **Percentuale di investimento per ogni TP**, in tutte le sale. Il modo non si sceglie: sul forex ogni target è una posizione sua, sulle cripto è una posizione sola che ogni target chiude in **parte** — è come funzionano i due mercati, e l'app lo scrive |
| **v104** | **Le criptovalute si riconoscono** (prima nessuna, nemmeno nella pagina di prova); **Syntra non si blocca più** in silenzio; **conti Kraken separati dai Forex** nelle statistiche, con **linea di tendenza** sulle barre del profitto |

Più: **server come porta unica** (registrazione del PC + inoltro) e **automatismi** (guardia dei
segreti, controllo del `CACHE_NAME`, skill `modifica-app` e `pubblica`, agente
`collaudatore-online`).

### Difetti trovati dai test, che non si sarebbero visti

- **`Number(null)` fa 0**: un segnale senza stop veniva contato con stop a zero, falsando il
  giudizio su una sala.
- **La chiave anti-doppioni del Trade Journal usava il nome del conto**: al primo «rinomina»
  sarebbero tornate tutte le righe in doppio. Ora usa l'identificativo.
- **Un hook falliva in silenzio** per una codifica sbagliata: sembrava proteggere e non bloccava
  nulla.
- **Le barre negative dei grafici**: un `transform` SVG cancellato dall'animazione CSS. Riprodotto
  a schermo, non dedotto.
- **La chiave non veniva attaccata agli indirizzi `wss://`**: i prezzi dal vivo sarebbero partiti
  senza chiave.

---

## 5. Che cosa manca

In ordine di importanza.

### 1. La strategia nelle aperture automatiche — **il pezzo grosso**

Richiesto dal proprietario: *«questo lo riportiamo anche nelle posizioni automatiche della
configurazione per le sale segnali, sia per Syntra che per Telegram, non solo nella modalità
rendimento storico»*.

Oggi si può **provare** una strategia sulla cronologia, ma l'app non la **esegue**: le quote per
ogni TP e la chiusura parziale non arrivano agli ordini veri.

- **Pronto**: il modello `fblSimulaStrategia(seg, candele, cfg)` in `app.html`, con
  `fblStrategiaNormalizza` e `fblStrategiaNuovoStop`. 10 test in
  `laboratorio/app/strategia_esecuzione.test.mjs`. La strategia è
  `{modo:'posizioni'|'parziali', quote:[…], regole:['', 'entrata', '1', …]}`.
- **Da fare**: portare `modo` e `quote` dentro `tgAutoSala()` / `tgAutoUni()`, l'interfaccia nella
  configurazione dell'apertura automatica, e soprattutto **il calcolo dei lotti in `tgPiano()`**,
  che oggi divide il rischio in parti uguali fra N posizioni.
- **Attenzione**: è l'unico punto dove un errore costa soldi veri. Si fa con i suoi test, e mai su
  un conto reale (`cervello/REGOLE.md`).

### 2. Caselle TP/SL non visualizzate

Segnalato dal proprietario, **mai riprodotto**. Non è chiaro se riguardi le caselle a grafico sulle
posizioni aperte o la spunta «Caselle TP-SL» nella cronologia delle sale. **Prima chiedere quale
delle due**, poi riprodurre, poi correggere.

### 3. Già corretto nel codice, serve un Setup nuovo per arrivare all'utente

Il ponte diceva «Server non raggiungibile» **senza dire quale nome aveva provato**: un nome scritto
male e Tailscale spento davano lo stesso messaggio. Ora il messaggio contiene il nome. Serve
ricostruire `ForexBacktestLAB.exe`.

### 4. Limiti noti (non difetti) — vedi `cervello/BUG.md`

- **Syntra funziona solo col ponte sul computer**: legge BlueStacks via ADB, su Linux non esiste.
  Da v104 l'app **lo dice**: prima il messaggio finiva in una chiave che l'app non legge, e si
  vedeva «Syntra attiva, nessun errore, nessuna sala».
- **Ordini pendenti Kraken** di un conto di prova non attivo non vengono controllati.
- **Eseguibili non firmati**: Windows SmartScreen avvisa all'installazione.
- **Telegram, Syntra e MT5 non si collaudano nel cloud**: servono sessione, BlueStacks, Windows.
- **Il grafico dal vivo dal telefono** passa da un WebSocket girato dal server: funziona, ma è una
  catena lunga (MT5 → PC → server → telefono) e va osservata sotto carico vero.

---

## 6. Come si lavora qui

### Il banco di prova

```bash
bash laboratorio/collauda.sh        # sintassi app, ponte Python, interprete segnali, app nel browser
```

Serve `pytest` e `playwright` (`pip install pytest`, `npm install -g playwright && npx playwright
install chromium`). Su Windows `python3` può essere il segnaposto del Microsoft Store: lo script
sceglie da solo l'interprete che ha davvero pytest.

**Un bug si dichiara corretto solo con un test in `laboratorio/` che prima falliva e ora passa.**
Senza test è un'opinione. Si verifica così:

```bash
cp app.html /tmp/nuova.html && git checkout app.html
cd laboratorio && node --test --test-concurrency=1 app/iltuo.test.mjs   # deve essere ROSSO
cd .. && cp /tmp/nuova.html app.html
cd laboratorio && node --test --test-concurrency=1 app/iltuo.test.mjs   # deve essere VERDE
```

**Attenzione a un limite del banco**: `apriApp()` apre `app.html` **da file, con la rete bloccata e
il velo di accesso nascosto**. Non prova la strada vera (sito in https, accesso, service worker):
per quella c'è l'agente `collaudatore-online`. È il motivo per cui il collaudo era verde mentre sul
telefono l'app restava ferma sul logo.

### Modificare `app.html`

4,3 MB in un solo blocco `<script>`: non si legge intero e non si riscrive. Si fanno
**sostituzioni mirate**. La skill `.claude/skills/modifica-app/` e lo strumento `sostituisci.py`
contengono il metodo. Le due trappole che fanno perdere più tempo:

- **`app.html` ha a capo Windows (CRLF)**: un blocco cercato con `\n` non combacia mai, e l'errore
  («0 occorrenze») fa pensare che il testo sia sbagliato mentre è giusto.
- **Lo script salva solo alla fine**: se un passo fallisce **non ha scritto niente**, ed è voluto
  (niente mezze modifiche) — ma le righe «ok» già stampate ingannano: dopo un errore vanno rifatte
  **tutte** le sostituzioni, non solo quella fallita.

### Regole non negoziabili (`cervello/REGOLE.md`)

- **Mai conti con soldi veri.** Kraken solo simulato, MT5 solo demo.
- **Mai chiavi API nel repository, nel cloud o nei messaggi.**
- **La sessione Telegram** può stare solo sul server del proprietario.
- Si pubblica su `main` **solo con il collaudo verde**, unendo il ramo, mai riscrivendo la storia.
- Nessun identificativo di modello AI in commit, codice o pagine.
- Si scrive **in italiano**, in modo che lo capisca anche chi non è sviluppatore.

### Alla fine di ogni lavoro

Aggiornare `cervello/`: `BUG.md` (causa vera + test), `LEZIONI.md` (regola pratica, non racconto),
`DIARIO.md` (cosa ha fatto questo giro). **Non si cancellano mai** voci di `BUG.md` o `LEZIONI.md`:
si chiudono, con data.

---

## 7. Mappa rapida di `app.html`

| Righe (circa) | Che cosa |
|---|---|
| 28–806 | CSS |
| 871–1290 | modulo Firebase: accesso, abbonamento, stato sessione — **qui si decide se l'app parte** |
| 1300–3700 | markup, ~26 finestre (`…Overlay`) |
| 3700–37800 | il programma: grafico, indicatori, ordini, conti, sale segnali, collegamenti |
| 38300–38800 | pagina Statistiche |

Famiglie di funzioni più grosse: `tg…` (sale segnali), `fbl…` (collegamenti e server),
`footprint…`, `kraken…`.
