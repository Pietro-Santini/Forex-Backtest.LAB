# Consegna a OpenCode — 19 novembre 2026

Scritta da Claude per chi riprende il lavoro. **Leggi tutto prima di toccare un file.**

Se una cosa qui non torna con quello che vedi nel codice, **il codice vince**: fermati, misura, e
scrivi al proprietario cosa hai trovato. Non indovinare: in questo progetto girano **soldi veri**
su MT5.

Ultima versione pubblicata quando questa consegna è stata scritta: **v2.2.84** su `main`
(la **2.2.85** era in collaudo: controlla con il comando al punto 4.6 prima di dare per buono
qualunque numero scritto qui).

---

## 0. LE REGOLE CHE NON SI DISCUTONO

1. **Misura prima di curare.** Mai partire da una causa supposta. Se non riesci a riprodurre il
   difetto, **dillo** e chiedi al proprietario il gesto esatto: non toccare il codice a caso. Il
   19 novembre questo ha evitato una versione sbagliata sul replay, e tre risposte dell'utente
   («finestra separata; il replay parte da tutte; i pulsanti ci sono solo dove è stato lanciato»)
   hanno portato alla riga esatta in dieci minuti.
2. **Un banco si scrive ROSSO prima della cura.** Se il banco passa anche col difetto rimesso,
   non misura niente: riscrivilo finché la prova di controllo non lo fa cadere. È successo due
   volte il 19 novembre, su `bos_due_entrate` e su `strategia_sala_be`.
3. **`bash laboratorio/collauda.sh` deve essere verde (`Falliti: 0`) prima di pubblicare.**
   Chiudi l'app desktop prima di lanciarlo e non modificare file mentre gira.
4. **Mai persistere su disco o nel cloud le posizioni e gli ordini REALI di MT5.**
   `stripMt5TrackedForSave()` resta nel percorso di salvataggio.
5. **Credenziali e segreti non entrano nel repo.** Stanno in locale sul PC del proprietario.
   Prima di ogni commit guarda `git status` riga per riga: i ganci di sicurezza **non girano**
   se la sessione parte dalla cartella sul Desktop.
6. **Mai dati inventati.** Niente candele finte spacciate per vere, niente backtest su dati
   costruiti. Se un dato non c'è, si dice che non c'è.
7. **Nessuna modifica che apre o chiude posizioni reali senza un banco verde.** Non toccare
   posizioni MT5 vere da script o da test.
8. **L'ora sul grafico è SEMPRE quella locale**, mai quella del broker (decisione del
   proprietario, 19 novembre). Una differenza di un'ora con MT5 è normale e non va «curata»:
   MT5 mostra l'ora del suo server (UTC+2 per FTMO), l'app mostra quella del dispositivo.
   Vedi `cervello/REGOLE.md`.

---

## 1. DOVE SI LAVORA

- **Repository (fonte di verità):** `C:\Users\pietro\Documents\GitHub\Forex-Backtest.LAB`
- **Ramo di lavoro:** `lavoro/soldi-veri-chiave-e-lotto` (si pubblica anche su `main`)
- La cartella `C:\Users\pietro\Desktop\trading\backtest app\applicazione` è solo uno **specchio**
  di `app.html`: non è il repository, e i ganci di git lì non girano.
- **Lingua: italiano**, nei commenti del codice, nei commit e nei messaggi all'utente.
- La memoria del progetto è in `cervello/`: leggi `LEGGIMI.md`, `REGOLE.md`, `LEZIONI.md` e la
  coda di `DIARIO.md` prima di cominciare, e aggiornali alla fine.

---

## 2. COME SI SCRIVE UNA CURA (il metodo che funziona in questo progetto)

1. **Riproduci il difetto** con una misura, non con il ragionamento. Strumenti che funzionano:
   - far girare l'app nel banco (`laboratorio/app/aiuti.mjs` → `apriApp()`) e stampare lo stato;
   - interrogare i servizi vivi del proprietario quando sono accesi (vedi punto 6);
   - registrare **lo stack di chi chiama** una funzione sospetta, invece di dedurre chi la chiama.
2. **Scrivi il banco rosso** in `laboratorio/app/<nome>.test.mjs`, con dentro:
   - le parole esatte della segnalazione del proprietario;
   - la misura che hai fatto, con i numeri;
   - una **premessa stringente** (`assert`) che faccia cadere la prova se la scena non riproduce
     davvero la condizione: un banco che non può fallire non difende niente.
3. **Cura**, con un commento che spiega *perché* e cosa era stato misurato.
4. **Prova di controllo**: rimetti il difetto e verifica che il banco torni rosso. Poi ripristina.
5. Fai girare **i banchi vicini** (stessa area) prima del collaudo intero.
6. Aggiorna `cervello/DIARIO.md` (e `LEZIONI.md` se hai imparato qualcosa di generale).

### Errori di banco già pagati — non rifarli
- **Un banco che eredita l'ambiente invece di dichiararlo.** È costato tre collaudi:
  il *sistema operativo* (15 novembre), l'*orologio* (18 novembre), il *fuso* (19 novembre).
  - sistema operativo: `aiuti.mjs` lo dichiara già;
  - ora del giorno: dichiarala (`pagina.clock.setFixedTime`) **oppure** dichiara lo stato che
    conta (mercato aperto/chiuso) quando la prova misura qualcosa che vive nel tempo che passa:
    congelare `Date.now()` ferma anche i battiti e la prova passa per il motivo sbagliato;
  - fuso: usa `oraDiRoma(pagina, h, m)` di `aiuti.mjs`. GitHub gira in **UTC**, il PC in
    Europe/Rome, e l'app ragiona sempre su Roma. Riproduci in locale con `TZ=UTC node --test …`.
- **Collaudo lanciato mentre modifichi file o con l'app desktop aperta**: tre giri falsi.
- **Sostituire un banco con un altro per farlo passare.** Se la regola cambia, riscrivi il banco
  con la regola nuova e spiega nel commento perché è cambiata.

---

## 3. IL COLLAUDO

```bash
bash laboratorio/collauda.sh
```

- Dura **circa 12-14 minuti** (blocco `app_browser` ~11). Il numero di banchi in parallelo lo
  decide la macchina (`nproc`, tetto 10, minimo 2): non rimetterlo a mano.
- Il blocco `app_browser` ha un **tetto di 45 minuti** (`TETTO_BROWSER`): se lo supera **cade**
  invece di restare appeso. Il 19 novembre un giro è rimasto bloccato **undici ore** prima che
  esistesse quel tetto.
- Esito in `laboratorio/risultati/ultimo.md` (`Falliti: 0` = verde) e dettaglio in
  `laboratorio/risultati/app_browser.log`.
- Un banco solo: `node --test laboratorio/app/<file>.test.mjs`
- Con un altro fuso: `TZ=UTC node --test laboratorio/app/<file>.test.mjs`
- Sintassi di `app.html`: `node laboratorio/strumenti/sintassi_app.mjs`

**Se il collaudo sembra fermo:** guarda l'orario dell'ultima riga scritta in
`laboratorio/risultati/app_browser.log`. Se non cresce da minuti, è appeso: uccidi il processo
`node --test` e i `headless_shell` orfani (**mai** il Chrome dell'utente, e mai i `node` dei
server MCP `@playwright/mcp`).

---

## 4. COME SI PUBBLICA UNA VERSIONE (procedura completa, in ordine)

### 4.1 Alzare la versione nei TRE punti, sempre insieme
| file | cosa |
|---|---|
| `sw.js` | `const CACHE_NAME = "forex-backtest-lab-v2.2.X"` |
| `app.html` | `const FBL_VERSIONE='2.2.X'` |
| `installer_build/installer.iss` | `#define MyAppVersion "2.2.X"` |

Il collaudo controlla che `sw.js` e `app.html` combacino. **Se non alzi `CACHE_NAME`, telefono e
tablet restano sulla versione vecchia**: il service worker serve la cache finché quel nome non
cambia.

### 4.2 Guardare cosa entra
```bash
git status --short
```
Riga per riga. Nessuna credenziale, nessun file di dati, nessuno zip.

### 4.3 Commit (in italiano, con il perché e la misura)
Il messaggio dice: cosa è stato segnalato, **cosa hai misurato** (con i numeri), cosa hai curato,
quali banchi. Chiudi con:
```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

### 4.4 Pubblicare su ramo **e** su main
```bash
git fetch -q origin
git merge-base --is-ancestor origin/main HEAD   # dev'essere un avanzamento pulito
git push origin lavoro/soldi-veri-chiave-e-lotto
git push origin HEAD:main
```

### 4.5 Verificare che sia arrivata davvero
```bash
git fetch -q origin
git show origin/main:sw.js | grep -o 'forex-backtest-lab-v[0-9.]*'
git show origin/main:app.html | grep -o "FBL_VERSIONE='[0-9.]*'"
```

### 4.6 Aspettare il collaudo di GitHub — **obbligatorio**
```bash
gh run list --limit 3 --branch main
gh run watch <ID> --exit-status
gh run view <ID> --json conclusion --jq .conclusion
```
- `success` = verde. `failure` = rosso: **cura prima di andare avanti**.
- `cancelled` = **né verde né rosso**: il job è stato tagliato dal tetto di tempo (oggi 60 minuti
  in `.github/workflows/collaudo.yml`). Non vale come verde.
- Il verde locale **non** dice che GitHub è verde: gira su Ubuntu e in UTC. È già costato due
  pubblicazioni con rosso vero e una cancellata.

### 4.7 Aggiornare il PC del proprietario
```bash
curl -s -X POST http://127.0.0.1:8000/aggiorna-app
curl -s http://127.0.0.1:8000/health
```
Aspetta che GitHub Pages abbia pubblicato (qualche minuto dopo il push), altrimenti il ponte
riscarica la versione vecchia e te ne accorgi solo dal numero nella risposta.

---

## 5. PC E DISPOSITIVI MOBILI: SONO DUE STRADE DIVERSE

Questa differenza spiega la metà delle segnalazioni «sul tablet funziona, sul PC no».

| | PC (app desktop) | Telefono / tablet |
|---|---|---|
| chi serve la pagina | il **ponte locale** su `127.0.0.1:8000`, da `app_aggiornata` | **GitHub Pages** |
| quando si aggiorna | **solo all'avvio del ponte**, o con `POST /aggiorna-app` | a ogni ricarica, se `CACHE_NAME` è cambiato |
| cosa conta | la copia scaricata in `%LOCALAPPDATA%\Programs\Forex Backtest LAB\app_aggiornata` | il service worker |
| memoria locale | origine `127.0.0.1:8000` | origine `pietro-santini.github.io` |

Conseguenze pratiche:
- **un ponte acceso da ore serve la versione di quando è partito**: se il proprietario dice «sul
  PC non c'è», chiedi `GET /health` prima di cercare difetti nel codice;
- **localStorage è diverso fra PC e mobile**: modelli, setup e impostazioni **non** si trasferiscono
  da soli. Non è un difetto;
- i modelli e i setup stanno in `localStorage` e hanno un tetto (~5 MB). Se la scrittura fallisce,
  l'app **deve dirlo** (`fblMemoriaPienaAvvisa`) e non deve dire «salvato».

---

## 6. I SERVIZI DEL PROPRIETARIO (quando sono accesi, misura con questi)

| servizio | porta | serve a |
|---|---|---|
| ponte MT5 | `127.0.0.1:8000` | conto, posizioni, ordini, aggiornamento app |
| servizio dati | `127.0.0.1:8001` | storico candele, tick, book, libreria |

Esempi usati davvero il 19 novembre:
```bash
curl -s http://127.0.0.1:8000/health
curl -s http://127.0.0.1:8000/account
curl -s "http://127.0.0.1:8001/history?symbol=XAUUSD&timeframe=M1&count=5"
```
`/history` dichiara `utc_offset_seconds_applied` = lo scarto del server del broker (7200 = UTC+2).
**Non spegnere mai il ponte** se MT5 è collegato: ci sono posizioni vere.

---

## 7. COSA È STATO FATTO IL 18-19 NOVEMBRE (per non rifarlo)

- **2.2.77** — l'ora di chiusura del mercato la dice il broker, non una costante: la chiusura è la
  mezzanotte del server riportata all'ora di Roma (`fblChiusuraMinutiLocali`). Prima era scolpita
  alle 22:00, giusta solo per un server UTC+3.
- **2.2.78** — in replay nessuno ridisegna il grafico da sotto (il conto alla rovescia a grafico
  fermo e il congelamento di fine sessione rispettano il replay).
- **2.2.79** — Valid BOS Pullback con **due entrate** (pullback e conferma), ognuna col suo
  lottaggio e le sue linee; scaletta passata da 6 a 7 passi.
- **2.2.80** — la seconda entrata non sparisce più; scritte sul grafico riscritte; **break-even
  nelle impostazioni dell'indicatore** (% verso il target, pip oltre l'entrata, linea che si vede
  prima che scatti).
- **2.2.81** — i modelli del profilo volumetrico si ritrovano; tetto di tempo al collaudo.
- **2.2.82** — **il break-even automatico delle sale torna a scattare** (tre difetti: la strategia
  non veniva valutata se il grafico guardava altrove; il BE in pip era annidato nel posto
  sbagliato; una regola rifiutata restava «fatta» per sempre).
- **2.2.83** — i modelli si vedono **dove li salvi**: il menu «Modello ⌄» legge tutte e tre le
  memorie, gli indicatori hanno la lista dei setup con il cestino, i profili e il VWAP hanno
  «Salva come modello…».
- **2.2.84** — una posizione nasce **sull'asset a grafico**, non su quello della tendina.
- **2.2.85** (in collaudo quando questa consegna è stata scritta) — in replay i comandi compaiono
  su **tutte** le finestre, non solo su quella che l'ha lanciato.

---

## 8. COSA RESTA DA FARE — in ordine

### 8.1 Replay nelle finestre duplicate (il blocco aperto)
Il proprietario lavora con **finestre separate**, e il replay parte **su tutte**.
1. **Passo per time frame della finestra.** Su una duplicata a 1 minuto le frecce devono avanzare
   di una candela; sulla madre a 15 minuti, di un quindicesimo alla volta («la regola del
   pezzetto»). Oggi il passo non è per finestra.
2. **L'avanzamento deve propagarsi da QUALSIASI finestra**, non solo dalla madre.
3. **Il puntatore del mouse in tutti e due i versi**: oggi il mirino della madre si vede sulle
   duplicate, non il contrario.
4. **Posizioni aperte in replay che spariscono e non arrivano al Trade Journal.** Attenzione:
   il 19 novembre **non sono riuscito a riprodurlo** (né in Storico né in Live, con e senza MT5,
   e nemmeno facendole valutare da una finestra non in replay). Una causa possibile è stata
   chiusa nella 2.2.84 (l'asset preso dalla tendina). **Prima di toccare altro, chiedi al
   proprietario di riprovare con la 2.2.84 o più recente** e, se succede ancora, fatti dire il
   gesto esatto.

### 8.2 Grafico e dati
5. **Zoom indietro in Live** che si ferma sempre allo stesso giorno. Ipotesi da misurare: la serie
   di base è limitata e l'aggregazione parte da lei.
6. **Il magazzino non distingue il broker**: la chiave è asset + timeframe, due broker con lo
   stesso `XAUUSD` scrivono nella stessa voce.
7. **La serie al minuto dei profili non usa mai il magazzino**: chi legge cerca `::1`, chi scrive
   salva `::M1`. Ramo morto, e ogni volta si scaricano 20.000 candele dalla rete.

### 8.3 Indicatore e backtest
8. **Backtest del Valid BOS Pullback sullo storico MT5**: operazioni, vincenti, profit factor,
   drawdown massimo e giornaliero, per **ciascuna** delle due entrate. I parametri vanno validati
   su un periodo **non** usato per tararli. Servono dal proprietario: simbolo e periodo.

### 8.4 Finestre duplicate: il resto
9. Prop firm vera / trial / esercitazione: tre risposte invece di due, con un identificativo per
   conto che memorizzi la scelta (oggi la domanda ritorna a ogni riavvio).
10. Il popup di violazione esce su tutte le finestre: deve uscire solo sulla madre.
11. Il pulsante «ricomincia» non avvisa le duplicate (restano col vecchio capitale).
12. Sul grafico si vedono le posizioni di tutti i conti: una posizione passa il filtro se ha il
    login del conto attivo **o se non ha login**. La strada giusta è scrivere la targhetta quando
    la posizione si legge dal ponte.

### 8.5 Richieste grosse mai iniziate
13. **Divisione del grafico (split)** — prima di scrivere codice, misura quanto del disegno dipende
    da variabili globali. Servono tre decisioni del proprietario: quanti riquadri, se condividono
    l'asset, se mirino e replay sono sincronizzati.
14. **Template delle finestre e degli split** (dipende da 13): un template è **solo impostazioni,
    mai dati**.
15. **Copiare le impostazioni da un conto a un altro** — solo impostazioni (rischio, lotti, SL/TP,
    filtri), mai disegni, capitale o credenziali.
16. **Tabella delle notizie** con il valore effettivo dalle fonti ufficiali: il valore va preso nel
    **ponte**, non nell'app, così più finestre non moltiplicano le richieste.
17. **Il ponte deve accorgersi se cambi conto nel terminale MT5** e annunciarlo.
18. **«Aggiorna» su mobile deve installare da sé l'APK** (sul PC il pulsante scarica il Setup e lo
    lancia; su telefono no).

### 8.6 Memoria, Firebase, magazzino
19. Strumento che misura la **crescita** della memoria (una riga al minuto, non una fotografia).
20. Storico del book **in memoria**: 150-275 MB per simbolo a regime, e cambiando asset le 12 ore
    del precedente restano lì.
21. Firebase: un punto unico dove si decide server **oppure** cloud.
22. La rilettura che spiega la banda: il documento del grafico pesa 815 KB e viene riletto intero
    ogni minuto (~1,1 GB al giorno per dispositivo).
23. Upload dei CSV senza tetto e senza contatore; il contatore del traffico misura **caratteri**
    invece di byte.

### 8.7 Collaudo e server
24. **Il blocco alla pubblicazione guarda solo il collaudo locale**: va preteso il verde di
    **entrambi** (locale e GitHub). Oggi è una regola che vale solo se chi lavora la rispetta.
25. **Collaudo veloce** per i giri di lavoro: solo i banchi toccati e i loro vicini, un paio di
    minuti, lasciando quello intero a GitHub. (Il parallelismo è già fatto: 24 → 11 minuti.)
26. **30 banchi leggono ancora l'orologio del PC**: vanno passati alla dichiarazione esplicita
    (vedi punto 2).
27. Un commit del server dimenticato su un ramo: `auto_https disable_redirects` per Caddy, scritto
    il 6 novembre e mai pubblicato. Senza, lo script del dominio non funziona.
28. Il limite di richieste annunciato e non installato: `rate_limit` non compare nel repository.
29. Cinque prove su Telegram che non girano mai (il collaudo ne lancia 3 di 8, elencati a mano).

### 8.8 Da provare col PC del proprietario davanti (un banco verde non chiude niente)
30. Grafico della duplicata piantato sul caricamento.
31. Elenco asset incompleto sulla seconda duplicata.
32. Disco E: i documenti arrivano, le operazioni no.
33. Sfarfallio delle linee di una posizione chiusa.
34. **La chiusura del mercato alle 23:00** (cura 2.2.77) va vista una sera dal vivo: alle 22:30 le
    candele devono scorrere e l'etichetta rossa tacere; alle 23:05 il grafico si ferma con
    «Mercato chiuso» e il conto alla rovescia fino a mezzanotte.

---

## 9. TRAPPOLE GIÀ PAGATE — non ripeterle

- **Pulizia di LevelDB contando le chiavi**: il conteggio è per difetto. Usa la **dimensione dei
  file**.
- **Break-even come prezzo di entrata nudo**: il pareggio vero include commissioni e swap
  (`mt5PrezzoPareggio`), e nella mezz'ora prima della chiusura lo stop va allontanato di uno
  spread di rollover.
- **Trasporto delle credenziali sul canale fra finestre**: solo il segnale «rileggi».
- **`Number(null)` fa 0**, che è uno scarto orario vero (broker su Greenwich): riconosci il «non
  lo so» **prima** di convertire.
- **Un `try{}catch(e){}` muto su una chiamata che deve esistere**: il 19 novembre nascondeva una
  funzione mai scritta (`renderVpTemplateMenu`), e i modelli dei profili finivano in un cassetto
  che nessuno apriva. Se metti un catch, **scrivi almeno un `console.warn`**.
- **Dare la colpa al carico**: due rossi identici in due giri diversi **non** sono rumore. Il
  carico spiega un rosso che cambia, non uno che si ripete uguale.
- **Una rete di sicurezza che funziona nasconde il difetto sotto**: quando una cura fa passare i
  dati *nonostante* una regola, misura la regola invece di aggirarla.

---

## 10. SE QUALCOSA VA STORTO

- **Hai pubblicato e GitHub è rosso:** cura subito, non accumulare. Il proprietario vede il rosso
  su `main` prima di te.
- **Hai rotto qualcosa e non sai cosa:** `git log --oneline -10`, poi `git diff <commit>` sul file
  sospetto. Ogni commit di questo progetto spiega cosa è stato misurato: usali.
- **Non riesci a riprodurre un difetto:** scrivilo nel diario e **chiedi al proprietario il gesto
  esatto** (che finestra, da dove parte, cosa manca o non risponde). Tre risposte sue valgono
  un'ora di tentativi.
- **Il proprietario dice «sul tablet funziona, sul PC no»:** prima di tutto `GET /health` sul
  ponte (punto 5).
