# Consegna del lavoro — stato al 9 ottobre 2026

Questo documento serve a chi riprende il lavoro **senza aver visto le sessioni precedenti**:
persona o agente AI. Dice che cos'è il sistema, com'è fatto, a che cosa è collegato, dove sta
andando, che cosa è stato fatto, che cosa manca e con che regole si lavora.

Stato alla scrittura: app **v111**, Setup **1.0.111**, server Oracle allineato a `main`.

> Prima di toccare qualunque cosa: `cervello/REGOLE.md` (regole non negoziabili),
> `cervello/METODO.md`, `cervello/MAPPA.md`, e le voci di `cervello/BUG.md` sulla parte che tocchi.
> Questo file è il riassunto, non il sostituto.

---

## 1. Che cos'è il progetto, e dove sta andando

**Forex Backtest LAB** è un'applicazione web per fare backtest e operare su forex, indici, azioni e
criptovalute. Non è un sito vetrina: è un programma intero che vive in una pagina sola.

Che cosa permette di fare, in concreto:

- **Backtest con replay**: si carica uno storico (CSV o dati del broker) e si riproduce il mercato
  candela per candela, aprendo e chiudendo posizioni come se fosse dal vivo.
- **Grafico e indicatori**: candele su Canvas, footprint (volumi per prezzo con lato compratore o
  venditore), heatmap del book, profilo volumetrico giornaliero e per sessioni, profilo volumetrico
  3D, FVG e squilibri, setup ICT, rotture di supporti e resistenze, EMA, indicatori personalizzati
  convertiti da PineScript con l'aiuto di un assistente AI.
- **Operatività vera**: ordini su **MetaTrader 5** (conto demo) e su **Kraken Futures** (conto
  simulato interno, con i prezzi veri). Posizioni, ordini pendenti, stop e target, chiusure
  parziali, operazioni a blocco in stile MetaTrader.
- **Sale segnali**: legge i messaggi dei gruppi **Telegram** di cui il proprietario è già membro, e
  le operazioni condivise dell'app Android **Syntra** letta dentro l'emulatore BlueStacks. Li
  interpreta, li mostra in un pannello, e — se lo si accende — apre le posizioni da solo con freni
  espliciti.
- **Cronologia e giudizio delle sale**: rilegge tutta la storia di una sala, valuta ogni segnale
  sulle candele vere (non su quello che la sala dice di aver preso) e dice il win rate totale e per
  livello di target, più quanto avrebbe reso quel conto con una strategia a scelta.
- **Trade Journal e statistiche**: ogni operazione chiusa finisce in un registro, con dashboard,
  grafici, win rate, profitto per sala, per asset, per strategia, per fascia oraria.
- **Modalità Prop Firm**: una challenge simulata con le regole di FTMO o di Kraken Prop, isolata
  dal conto normale.
- **Template Notion**: componente aggiuntivo che porta il Trade Journal dentro Notion.

**La direzione**, decisa dal proprietario: tutto quello che può girare 24 ore su 24 si sposta sul
server sempre acceso, e il computer di casa resta necessario solo per ciò che non può stare
altrove (MetaTrader 5 e Syntra). L'app deve funzionare allo stesso modo da computer, telefono e
tablet, **senza che l'utente debba sapere dove gira cosa**.

**Il proprietario non è una sala segnali.** Le sale sono di terzi: l'app legge messaggi pubblici di
gruppi di cui l'utente è già membro, non vende segnali e non ne garantisce la qualità.

### I pezzi

| Pezzo | Dove sta | Che cos'è |
|---|---|---|
| `app.html` | repo, servita da GitHub Pages | **l'applicazione**: 4,2 MB, ~41.200 righe, quasi tutto in un blocco `<script>`, nessun framework, ~1.250 funzioni di primo livello, 26 finestre |
| `sw.js` | repo | service worker: cache offline e aggiornamenti (`CACHE_NAME` = la versione) |
| `index.html`, `login.html` | repo | sito pubblico e pagina di accesso |
| `privacy.html`, `termini.html`, `informativa-bot.html`, `rischi-finanziari.html` | repo | pagine legali |
| `installer_build/build/bridge.py` | PC, porta **8000** | ponte MT5: ordini veri, conto Kraken, servizi dell'app |
| `installer_build/build/mt5_feed_server.py` | PC, porta **8001** | dati del grafico dal terminale MT5 (candele, tick, book) |
| `installer_build/build/segnali_telegram/segnali_bridge.py` | PC **o** server, porta **8769** | sale segnali Telegram + lettore Syntra |
| `installer_build/build/accesso_condiviso.py` | condiviso dai tre servizi | **un solo** controllo d'accesso: chiave, Tailscale, porte |
| `server_oracle/` | server Oracle (Linux) | `Dockerfile`, `docker-compose.yml`, `ponte_server.py`, `prepara_server.sh` |
| `laboratorio/` | repo | banco di prova: 36 file di test del browser + 10 del ponte |
| `cervello/` | repo | **memoria del progetto**: regole, mappa, bug, lezioni, idee, diario, questa consegna |

---

## 2. A che cosa è collegato

### Firebase — accesso, dati dell'utente, abbonamento

Progetto Firebase **`forex-backtest-lab`**, regione **`europe-west1`**. La configurazione web sta
in chiaro in cima ad `app.html`: è pubblica per progetto, le chiavi web di Firebase non sono
segreti e la sicurezza la fanno le regole di Firestore.

Serve per quattro cose:

1. **Accesso** (Firebase Auth). Senza utente collegato l'app non parte: c'è un velo che copre tutto
   finché l'accesso non è confermato. La pagina è `login.html`.
2. **Stato di sessione** (Firestore, `users/{uid}/data/session`): posizioni, ordini, trade,
   impostazioni. È ciò che permette di aprire l'app sul telefono e ritrovare quello che si stava
   facendo sul computer.
3. **Licenza e abbonamento** (Firestore, `licenses/{uid}`). L'app **legge soltanto**: a scrivere è
   il server, dai webhook del pagamento. Un'app che si auto-dichiara pagata sarebbe aggirabile con
   la console del browser.
4. **Cloud Functions** (`europe-west1`), in due gruppi: `abbonamento`
   (`createSubscriptionCheckout`, `createBillingPortal`, `abbonamentoWebhook`) e `notion`
   (Template Notion).

### Pagamenti — Stripe

- **Abbonamento 30 €/mese**, con **7 giorni di prova gratuita senza carta** dall'iscrizione.
  Sostituisce la vecchia licenza a vita da 50 €.
- Il pagamento avviene sulla **pagina di Stripe**, mai dentro l'app: l'app chiama
  `createSubscriptionCheckout` e manda l'utente lì. La gestione dell'abbonamento (disdetta, carta,
  fatture) passa da `createBillingPortal`.
- Lo stato vero dell'abbonamento lo tiene il webhook di Stripe, che aggiorna `licenses/{uid}`.
- Esiste un codice sconto (50% per sempre, primi 20 iscritti) inseribile nella pagina Stripe.
- **Template Notion**: componente aggiuntivo a parte, pagamento unico di **10 €**.

> **Il codice delle Cloud Functions non è in questo repository.** La copia di riferimento è sul
> computer del proprietario (`abbonamento_kit/`, `notion_template_kit/`). Chi riprende il lavoro
> sulle funzioni deve chiederle.

### Mercati e dati

| Fornitore | Che cosa dà | Come |
|---|---|---|
| **MetaTrader 5** | candele, tick, book, **ordini veri** (demo) | terminale sul PC Windows + libreria Python `MetaTrader5`. Esiste **solo per Windows**: è il motivo per cui il PC serve ancora |
| **Kraken Futures** | prezzi veri delle cripto, conto **simulato** interno | `kraken_ordini.py` / `kraken_simulato.py`, gira anche su Linux |
| **Binance Futures** | candele e footprint delle cripto | quotazioni pubbliche, nessun conto, nessuna chiave |
| **Capital.com** | prezzi dal vivo per il grafico | usato come riferimento quando MT5 non c'è |
| **Telegram** | messaggi delle sale segnali | libreria `telethon`, con la **sessione del proprietario**: può stare solo sul suo server |
| **Syntra** (app Android) | operazioni condivise dagli utenti | letta dentro **BlueStacks** via ADB, sul PC. Non esiste altra strada |
| **Notion** | Trade Journal esportato | Cloud Functions + API Notion |

### Le macchine

| | Nome Tailscale | Che cosa fa |
|---|---|---|
| PC di casa | `desktop-d15isfu.tail83d918.ts.net` | MT5 (terminale + ponte 8000), dati grafico (8001), Syntra/BlueStacks. **Windows** |
| Server Oracle | `pietro.tail83d918.ts.net` | Kraken simulato (8000), sale segnali Telegram (8769). **Sempre acceso** |
| Telefono, tablet | — | aprono il sito e parlano col server |

---

## 3. Come sono collegati i dispositivi

### Tailscale, e solo Tailscale

Niente porte aperte sul router, niente regole del firewall, niente Wi-Fi locale. Tutti i
dispositivi stanno sulla rete privata Tailscale dello stesso account.

I tre servizi ascoltano **solo su `127.0.0.1`**. Dagli altri dispositivi ci si arriva con
**Tailscale Serve**, che risponde in **HTTPS** sul nome `.ts.net` e gira le richieste ai servizi
locali. Si usa il **nome**, mai l'indirizzo `100.x.y.z`: il certificato vale solo per il nome.

**Conseguenza non ovvia, già costata tempo**: «arriva da 127.0.0.1» non vuol più dire «è il PC».
Ci arriva anche Tailscale Serve per conto del tablet. `accesso_condiviso.richiesta_locale()` lo
distingue da due cose che Tailscale Serve fa sempre: mette `X-Forwarded-For` e lascia l'`Host`
originale (il nome `.ts.net`).

### Il server è la PORTA UNICA

Deciso dal proprietario il 7 ottobre 2026: **dal telefono si scrive solo nome e chiave del
server**, mai quelli del computer. Ma MT5 gira sul PC e sul server non ci sarà mai. Quindi:

1. **Il PC si presenta al server da solo.** L'app, aperta sul PC, chiama `POST /registra-al-server`
   sul ponte locale (accettato solo da `127.0.0.1`); il ponte manda nome Tailscale e propria chiave
   al server con `POST /pc/registra`. Il server li salva in `/srv/fbl/dati/pc.json`.
2. **Il server gira le richieste al PC**: `/pc/<porta>/<percorso>` per le tre porte previste
   (8000 ordini, 8001 grafico, 8769 segnali) e **anche i canali WebSocket**, che servono ai prezzi
   dal vivo. `/pc/<percorso>` senza porta vale 8000.
3. **L'app sceglie la strada da sola, provandola.** Due funzioni gemelle:
   `fblScegliStradaGrafico()` per la porta 8001 e `fblScegliStradaOrdini()` per la 8000. Provano in
   ordine: ponte locale, computer in diretta, server. **Non si indovina mai**: è esattamente il bug
   che ha tenuto MT5 morto sul telefono per un giorno (vedi `BUG.md`, v108).
4. **La chiave giusta la mette un punto solo**: `fblConChiave()` riconosce l'indirizzo del server —
   sia `https://` sia `wss://` — e usa la chiave del server.

La catena dei prezzi dal vivo è: **terminale MT5 → ponte sul PC (8001) → server → telefono**.
Misurata il 9 ottobre: circa **3 prezzi al secondo**, e il passaggio dal server non costa niente
rispetto ad andare dritti al computer.

### Il server Oracle, in pratica

- Ubuntu + Docker, macchina AMD del piano gratuito (1 GB di RAM + 2 GB di swap).
- Progetto in **`/srv/fbl/progetto`**, dati in **`/srv/fbl/dati`**.
- Chiave d'accesso in `/srv/fbl/dati/accesso_remoto.json` — **non esce mai dal server verso l'app**.
- Due contenitori: `ponte` (8000) e `segnali` (8769), `restart: unless-stopped`.
- Accesso: `ssh -i <chiave> ubuntu@pietro.tail83d918.ts.net`. La chiave sta **solo** sul computer
  del proprietario, fuori dal repository.
- Aggiornamento, idempotente:
  ```bash
  cd /srv/fbl/progetto/server_oracle && bash prepara_server.sh
  ```
  Scarica la versione nuova, ricostruisce le immagini, riavvia, ripubblica su Tailscale e stampa
  nome e chiave.

> **Trappola già pagata**: `prepara_server.sh` stampa la chiave d'accesso in fondo, quindi
> l'output va filtrato — ma filtrarlo con un motivo non ancorato (`sed -n "/Chiave/q;p"`) **ferma
> lo script a metà**, perché il passo 4 si intitola «== 4) Chiave d'accesso». Risultato: sorgenti
> aggiornati, contenitori ancora sul codice vecchio, ed exit code 0 bugiardo (quello di `sed`).
> Il modo giusto: scrivere l'output in un file, leggere l'esito **dello script**, e tagliare con un
> motivo ancorato a inizio riga.

**Il server rifiuta per progetto le chiavi Kraken reali**: lì gira solo il conto simulato.

### Come si controlla che sia tutto a posto

```bash
git -C /srv/fbl/progetto log --oneline -1          # deve essere l'ultimo commit di main
sudo docker ps                                     # due contenitori, "Up" da poco
curl -s http://127.0.0.1:8000/health               # ok:true, e pc.registrato:true
curl -s http://127.0.0.1:8769/health               # collegato:true, e l'elenco "titoli" delle sale
sudo docker logs --tail 20 server_oracle-segnali-1 # "in ascolto su: ..." per ogni sala
```

Dall'esterno, con la chiave del server, la strada che usa il telefono:
`https://<server>:8000/pc/8000/health` (ordini), `/pc/8001/health` (grafico), `/pc/8769/health`
(segnali). Se la prima dà 502 e la seconda risponde, **non è la rete**: è il ponte installato sul
PC più vecchio dell'app.

---

## 4. Repository e pubblicazione

- **Repo**: `https://github.com/Pietro-Santini/Forex-Backtest.LAB` — ramo **`main`**.
- **Sito**: GitHub Pages da `main` → `https://pietro-santini.github.io/Forex-Backtest.LAB/app.html`.
- Esiste un secondo repository omonimo e **vuoto** su un altro account (`Pietrosant/...`): è un
  residuo, non è quello attivo.
- `gh` (GitHub CLI) **non è installato** sul PC: per leggere lo stato dei flussi si usa l'API
  pubblica (`https://api.github.com/repos/Pietro-Santini/Forex-Backtest.LAB/actions/runs`).

### Come si pubblica (obbligatorio, non è uno stile)

1. `bash laboratorio/collauda.sh` deve finire con **`Falliti: 0`**.
2. **Alzare `CACHE_NAME` in `sw.js`** (`forex-backtest-lab-vNN` → `vNN+1`) ogni volta che cambia
   `app.html`. È l'unica cosa che fa arrivare l'aggiornamento a telefoni e tablet.
   Nel repository la copia di `sw.js` è **una sola**, nella radice.
3. Alzare `MyAppVersion` in `installer_build/installer.iss` allo stesso numero (`app vNN` →
   `Setup 1.0.NN`). Il flusso lo riscrive comunque da `sw.js`, ma chi compila a mano prende questo.
4. Commit e push su `main` (mai riscrivere la storia, mai `--force`).
5. Verificare che sia online davvero: `git show origin/main:sw.js | grep CACHE_NAME`.

### I flussi automatici su GitHub

- **Collaudo** (`collaudo.yml`): gira a ogni push, rifà tutto il banco di prova su Linux.
  Verde sul PC non dice niente su GitHub: le librerie installate sono diverse.
- **Installer Windows** (`installer.yml`): a ogni push che tocca `app.html`, `sw.js` o
  `installer_build/` costruisce `ForexBacktestLAB_Setup.exe` e, **se il push è su `main`, pubblica
  da solo la release** con i due allegati dai nomi esatti (`ForexBacktestLAB_Setup.exe` e
  `installer_build.zip`: `app.html` punta a `releases/latest/download/<nome>`, quindi i nomi non si
  possono cambiare). La versione del Setup la ricava da `sw.js`.

### Quando serve un Setup nuovo

L'app si aggiorna da sola dal sito; i **tre eseguibili sul PC no**. Ogni modifica a `bridge.py`,
`mt5_feed_server.py` o `segnali_bridge.py` richiede un Setup nuovo e una reinstallazione, e va
**detto esplicitamente al proprietario**: altrimenti la modifica sembra fatta e sul computer non
esiste. Se la modifica tocca il ponte dei segnali Telegram serve **anche** aggiornare il server.

> **Già successo**: il 9 ottobre MT5 non funzionava dal telefono perché il ponte installato sul PC
> era più vecchio dell'app di poche ore. Prima di cercare il guasto nella rete, **confrontare la
> data di `ForexBacktestLAB.exe` installato con l'ultima release.**

### I ganci di sicurezza

In `.claude/hooks/` ci sono tre controlli (`guardia_git.py`, `guardia_segreti.py`,
`dopo_modifica.py`) registrati in `.claude/settings.json` del clone GitHub.

> **Attenzione**: non girano se la sessione di lavoro parte da una cartella diversa dal clone (per
> esempio la cartella di lavoro sul Desktop del proprietario). In quel caso **non c'è nessuna
> protezione automatica**: va controllato a mano cosa entra in git, e si aggiungono i file per
> nome invece che con `git add -A`. Un controllo che fallisce in silenzio è peggio di un controllo
> assente.

---

## 5. Che cosa è stato fatto (storia recente, v106 → v111)

| Versione | Che cosa |
|---|---|
| **v106** | Il ponte dei segnali non muore più su una emoji (`UnicodeEncodeError` in `_log`, console cp1252: una spunta verde fermava tutti i segnali). I ponti diventano **due**: Telegram sul server, Syntra sul computer con `--solo-syntra` |
| **v107** | Quindici richieste in un colpo: popup pacchetti MT5 solo su computer; conti Kraken sincronizzati; «Segnale manuale» in entrambe le sessioni; sale selezionabili nella dashboard dei win rate; journal e trade per periodo anche giornalieri; trade per fascia oraria; win rate degli Esiti senza i pareggi; sala e utente Syntra scritti nelle posizioni aperte; posizioni raggruppate con P/L sommato; interruttore per le sole linee delle posizioni; grafico del rendimento scorrevole; metodologia della strategia |
| **v108** | **MT5 dal telefono**: la strada degli ordini si prova invece di indovinarla, e il pannello dei servizi prova l'indirizzo che la sezione MT5 usa davvero |
| **v109** | **Prestazioni** (sotto), origine delle operazioni, raggruppamento con tolleranza, un solo nome di sala ovunque, numero di target dalla storia della sala |
| **v110** | Distribuzione equa, «chiusura parziale» col nome giusto, spostamento dello stop rimesso anche nelle chiusure parziali, le stesse scelte nell'apertura automatica, ogni sala con i suoi target |
| **v111** | Risolto il bug del grafico della resa al tocco; **operazioni a blocco** in stile MetaTrader 5 |

### Le prestazioni (v109–v111), perché è istruttivo

Il proprietario segnala l'app lenta. L'ipotesi ovvia erano i 35 cicli automatici e `update()` che
rifà le tabelle: **misurati, costavano 3,6 ms in tutto**. Il tempo stava in posti che nessuno
avrebbe indovinato:

- metà del primo disegno a **convertire le date** delle candele (espressione regolare + `Date.parse`
  su ogni candela);
- un `ts.every(...)` su centomila elementi dentro `chartGeometry`, **a ogni disegno**;
- i profili volumi che **ricostruivano le loro istanze** riscorrendo giorni di candele, sessanta
  volte al secondo durante il trascinamento.

Risultati su CPU rallentata sei volte (telefono di fascia media):

| | Prima | Dopo |
|---|---|---|
| Primo disegno, tutti gli indicatori, 300.000 candele | 3241 ms | 1060 ms |
| Ogni immagine durante il trascinamento | 50 ms | 24 ms |
| Grafico senza indicatori, ogni immagine | 10 ms | 3,2 ms |

**Il metodo conta più del risultato**: misurare col profilatore e con la CPU rallentata, perché su
un computer non si vede niente. Vedi `LEZIONI.md`.

---

## 6. Che cosa manca

Il lavoro procede su una **scaletta concordata a voce** col proprietario l'8 ottobre 2026, in 18
passi. I passi 1–12 e 14 sono fatti. Restano:

### Passo 13 — Instradamento su Capital.com
Se una sala manda un segnale su uno strumento che **non esiste né su Kraken né su MT5** (un'azione,
un indice), l'app deve cercarlo su Capital.com e aprirlo lì. Se non lo trova da nessuna parte non
apre niente, ma il segnale resta segnalato nel pannello.
**Da verificare per primo**: che cosa sa fare davvero il collegamento a Capital.com nell'app di
oggi. Potrebbe essere solo lettura prezzi, e in quel caso il lavoro è molto più grande di così.

### Passi 15 e 16 — Storico di un utente Syntra
Oggi di Syntra si leggono solo le notifiche nuove. Serve poter scegliere un nome utente e vederne
la storia completa, **identica a quella delle sale Telegram**: operazioni raggruppate per asset,
win rate per asset e totale, resa, con lo stesso selettore di periodo.

Come si fa, secondo il proprietario: il robot tocca il nome in alto a destra di ogni casella, si
apre il profilo dell'utente, scorre e legge tutte le operazioni.

**Vincolo da non dimenticare**: mentre fa questa ricerca il robot **non deve aggiornare la pagina
delle notifiche**, altrimenti va in confusione. Riprende quando ha finito.

Questi due passi vivono in `segnali_bridge.py`, quindi richiedono un **Setup nuovo** e una
reinstallazione sul PC.

### Passo 17 — Cervello e memoria
Aggiornare i documenti a ogni giro. Questo file ne fa parte.

### Limiti noti, non difetti

- **Con tutti e otto gli indicatori accesi insieme** il trascinamento su telefono sta a 24 ms per
  immagine, sopra il budget di 16. Con tre o quattro indicatori, che è l'uso normale, è
  abbondantemente sotto. Quel che resta è il profilo volumetrico 3D e il setup ICT.
- **L'app ci mette circa 2 secondi ad aprirsi** su un telefono: sono 4,2 MB di pagina da leggere e
  compilare. Si risolve solo dividendo `app.html` in moduli e caricando a richiesta le parti che non
  servono subito (statistiche, cronologia, footprint). È un lavoro a sé, rischioso, da fare quando
  il resto è a posto. **Non è una riscrittura in JavaScript**: l'app è già tutta JavaScript, e la
  voce del README che parla di «separare il JavaScript in moduli» significa esattamente questo.
- **La resa di una sala tiene conto dello spostamento dello stop solo dopo «Analizza e mostra a
  grafico»**, perché servono le candele. Senza, può solo contare quanti target sono stati raggiunti
  prima dello stop iniziale. La nota sotto il grafico lo dice.
- `cervello/BUG.md` ha l'elenco completo, con la causa vera e il test che lo copre.

---

## 7. Come si lavora qui

### Il banco di prova

```bash
bash laboratorio/collauda.sh   # sintassi app, versione sw, ponte Python, interprete segnali, app nel browser
```

Serve `pytest` e `playwright` (`pip install pytest`, `npm install -g playwright && npx playwright
install chromium`). Su Windows `python3` può essere il segnaposto del Microsoft Store: lo script
sceglie da solo l'interprete che ha davvero pytest.

**Un bug si dichiara corretto solo con un test in `laboratorio/` che prima falliva e ora passa.**
Senza test è un'opinione.

**Limite del banco**: `apriApp()` apre `app.html` **da file, con la rete bloccata e il velo di
accesso nascosto**. Non prova la strada vera (sito in https, accesso, service worker). Per
riprodurre il telefono si può usare Playwright con `Emulation.setCPUThrottlingRate` (CPU
rallentata) e bloccando solo `http://127.0.0.1`, lasciando passare il server.

Le funzioni che vivono dentro un modulo chiuso (cronologia delle sale, dashboard delle statistiche)
non si vedono da fuori: quelle che contano sono esposte apposta su `window` «per il collaudo».

### Modificare `app.html`

4,2 MB in un blocco solo: non si legge intero e non si riscrive. Si fanno **sostituzioni mirate**.
Le trappole che fanno perdere più tempo, tutte già pagate:

- **`app.html` ha a capo Windows (CRLF)**: un blocco cercato con `\n` non combacia mai, e «0
  occorrenze» fa pensare che il testo sia sbagliato mentre è giusto. I modelli vanno normalizzati.
- **Scrivere il file in modo atomico**: scrivere su un file accanto e poi sostituire. Una scrittura
  che fallisce a metà **lascia `app.html` vuoto** (è successo: recuperato dal commit).
- **Mai sostituzioni basate su indici** calcolati sul testo intero: hanno già troncato due file. Si
  lavora per righe, con un controllo di quante righe si stanno sostituendo.
- **Attenzione agli escape dentro gli heredoc della shell**: `\\'` e `\\u` perdono un livello e
  producono stringhe JavaScript rotte o surrogati non validi. Meglio scrivere lo script con uno
  strumento di scrittura file che con un heredoc.
- Dopo ogni modifica: `node laboratorio/strumenti/sintassi_app.mjs`.

### Regole non negoziabili (`cervello/REGOLE.md`)

- **Mai conti con soldi veri.** Kraken solo simulato, MT5 solo demo.
- **Mai chiavi API, sessioni o chiavi d'accesso nel repository, nel cloud o nei messaggi.**
- **La sessione Telegram** può stare solo sul server del proprietario.
- Si pubblica su `main` **solo con il collaudo verde**, mai riscrivendo la storia.
- Nessun identificativo di modello AI in commit, codice o pagine.
- Si scrive **in italiano**, in modo che lo capisca anche chi non è sviluppatore. Vale per
  l'interfaccia, per i commenti e per i messaggi di commit.

### Come scrive il proprietario, e cosa si aspetta

Detta a voce, quindi i messaggi sono lunghi e contengono molte richieste insieme: vanno **estratte
tutte, nessuna esclusa**, e conviene restituirgliele come scaletta numerata prima di cominciare.
Vuole che si proceda **un passo alla volta**, che si dica a parole cosa si è fatto, e che **non si
pubblichi** finché non lo dice lui.

Quando una cosa non si può fare o non si è potuta verificare, lo vuole sentito dire chiaramente.
Quando cambia idea su una decisione precedente (è successo con lo spostamento dello stop nelle
chiusure parziali) si cambia, ma si **lascia scritto nel test il motivo di prima**, così fra un mese
si capisce perché era diverso.

### Alla fine di ogni lavoro

Aggiornare `cervello/`: `BUG.md` (causa vera + test), `LEZIONI.md` (regola pratica, non racconto),
`DIARIO.md` (cosa ha fatto questo giro), e questa consegna se cambia il quadro generale.
**Non si cancellano mai** voci di `BUG.md` o `LEZIONI.md`: si chiudono, con data.

---

## 8. Mappa rapida di `app.html`

| Righe (circa) | Che cosa |
|---|---|
| 30–810 | CSS |
| 870–1300 | modulo Firebase: accesso, abbonamento, stato sessione — **qui si decide se l'app parte** |
| 1300–3750 | markup, 26 finestre (`…Overlay`) |
| 3750–38800 | il programma: grafico, indicatori, ordini, conti, sale segnali, collegamenti |
| 38800–39400 | cronologia delle sale segnali e rendimento di una sala |
| 39400–41200 | pagina Statistiche |

Famiglie di funzioni, riconoscibili dal nome: `tg…` sale segnali · `fbl…` collegamenti, server,
nomi delle sale, posizioni raggruppate · `kraken…` conto cripto · `mt5…` ponte e ordini veri ·
`footprint…`, `vp…`, `tvp3d…` indicatori di volume · `strat…`, `rend…` strategia e resa di una sala.
