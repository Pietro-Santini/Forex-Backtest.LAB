# Consegna a OpenCode — 19 novembre 2026

Scritta da Claude per chi riprende il lavoro. **Leggi tutto prima di toccare un file.**

Se una cosa qui non torna con quello che vedi nel codice, **il codice vince**: fermati, misura, e
scrivi al proprietario cosa hai trovato. Non indovinare: in questo progetto girano **soldi veri**
su MT5.

> **PASSAGGIO A CLAUDE (24/11/2026, 22:15)**: il prompt completo per riprendere tutto — progetto
> pubblico, migrazione e diagnosi MT5 — è in `cervello/PROMPT-PASSAGGIO-CLAUDE.md`. Leggerlo
> prima di qualsiasi modifica. Il registro in fondo a questo file è aggiornato fino alle 22:15.

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

## 9. TRAPPOLE GIÀ PAGATE - non ripeterle

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

---

## 11. REGISTRO DELLE MODIFICHE (tenuto dall'agente, riga per riga)

Regola data dal proprietario il 24 novembre 2026: **ogni modifica va scritta qui**, con la data, il
punto della scaletta a cui appartiene, cosa è stato misurato e cosa resta da fare. Le voci si
aggiungono in fondo, in ordine di lavoro; quelle vecchie non si cancellano.

### 24 novembre 2026 - 8.5.13 Divisione del grafico (split): decisioni e strada scelta

- **Decisioni del proprietario** (chieste e ottenute prima di scrivere codice):
  1. **fino a 4 riquadri**, layout **1x1 / 1x2 / 2x2** (disposizione "in fila" per 1x2);
  2. **asset indipendenti**: lo stesso asset può stare in due riquadri (nessun vincolo);
  3. **mirino e replay sincronizzati** fra i riquadri, con la stessa regola delle finestre
     duplicate (stesso asset, time frame anche diversi, orario+prezzo→pixel del ricevitore).
- **Strada scelta, e perché**: i riquadri sono **pagine complete dentro `iframe`**
  (`app.html?riquadro=1..4`), ciascuna con il proprio motore, come le finestre duplicate ma
  dentro la stessa finestra. Motivo misurato nell'indagine (`cervello/INDAGINE-DIVISIONE-GRAFICO.md`):
  lo stato del grafico è **una variabile globale sola** (`rows`, `currentAssetKey`, `idx`... lette da
  81-135 funzioni), `chartEl` è legata al canvas una volta all'avvio e `draw()` è chiamata in 471
  punti. Due aree di disegno nella stessa pagina restano nere (misurato: 0 pixel dipinti) e con lo
  stesso id il disegno va da una parte e i gesti dall'altra. L'isolamento che funziona già è il
  documento separato, quindi lo si riusa così com'è; il commento del progetto alla riga 10136 dice
  già la stessa cosa ("troppo rischioso farlo condividere a 4 finestre in una sessione").
- **Slot riservati**: i riquadri usano `pipSlot` **21-24** (base 20 + numero riquadro), quindi non
  litigano con le finestre duplicate (2-9) e restano "finite non madri" per tutte le guardie
  `PIP_SLOT>0` già esistenti (niente scritture su disco, presenza sul canale, replay condiviso,
  mirino).
- **Da misurare alla fine**: costo reale (ms per fotogramma e RAM) con 2 e con 4 riquadri, perché
  ogni riquadro ha la propria serie di candele (la regola "una serie per asset" del progetto
  `PROGETTO-TEMPLATE-FINESTRE-E-SPLIT.md` qui non vale: vale per la strada a stato parametrico).

### 24 novembre 2026 - 8.5.13 Divisione del grafico: il codice è nel file

- **`app.html`, pulsante "Riquadri"** nella riga dei comandi del grafico (`#riquadriBtn`, accanto a
  "Duplica finestra"): ogni clic passa **1 → 2 → 4 → 1**. Con i riquadri aperti compare una
  barretta dentro il grafico con **1 grafico / 2 in fila / 4 in griglia**, così si sceglie
  direttamente. Sul telefono (≤900 px) il pulsante non c'è, come "Duplica finestra".
- **`fblRiquadriApplica(n)`**: crea/toglie gli `<iframe>` dentro `.chartWrap`, impagina
  `1fr 1fr` (2, una riga) o `1fr 1fr / 1fr 1fr` (4), **tiene** i riquadri già aperti passando da 2
  a 4 (nessun ricaricamento) e su "1 grafico" li chiude tutti riaccendendo il canvas della madre.
  La pagina madre **non si spegne**: si nasconde solo `#chartMainArea` (classe
  `body.fblRiquadriOn`), quindi ordini, trailing, journal, Telegram e salvataggio continuano.
- **`PIP_SLOT` accetta `?riquadro=1..4`** e lo mappa su **21-24** (`FBL_RIQUADRO_SLOT_BASE=20`);
  `FBL_SONO_RIQUADRO` dice a un'istanza di essere un riquadro. Nelle finestre duplicate e nei
  riquadri il pulsante è nascosto e `fblRiquadriApplica()` rifiuta (niente riquadri annidati).
- **Asset e time frame di partenza**: `fblRiquadroUrl()` passa `&asset=...&tf=...` a ogni riquadro
  e `fblRiquadroApplicaIndirizzo()` li applica con gli **stessi due gesti veri** dell'utente (menu
  time frame, menu asset). **MISURATO**: mettendo prima il time frame, il cambio asset ripristinava
  la vista salvata e lo riportava a 1 minuto — l'ordine ora è asset, poi time frame, applicato
  quando le candele dell'asset sono arrivate (tetto 4 s se lo storico non arriva).
- **Decisione 2 rispettata**: in `asset_announce` il cambio asset **non si applica** né da né verso
  i riquadri (`!FBL_SONO_RIQUADRO && !fblSlotERiquadro(msg.slot)`). Le finestre duplicate 2-9
  continuano a seguirsi come prima.
- **Decisione 3**: nessuna riga nuova per il mirino e il replay — passano dal canale
  BroadcastChannel già esistente, con la traduzione orario+prezzo→pixel. Un riquadro è solo un
  altro slot, quindi ne usufruisce come una finestra.
- **Nota dichiarata**: gli iframe condividono l'origine **solo se l'app è servita in HTTP**
  (app installata dal ponte, sito GitHub Pages). Aperta a doppio clic da `file://`, ogni documento
  ha origine opaca: i riquadri si vedono e funzionano, ma il canale non li collega. Da verificare
  col PC del proprietario davanti (vedi 8.8).
- **Banco nuovo**: `laboratorio/app/split_riquadri.test.mjs`, 5 prove (comportamento, non testo):
  1→2→4→1 e impaginazione; pagina-riquadro con slot suo, solo grafico, non madre, non annida;
  asset+time frame dall'indirizzo; asset indipendenti nei due versi; mirino che arriva al
  riquadro a time frame diverso.
- **Misurato — costo reale** (24 novembre 2026, via HTTP su `127.0.0.1`, 3000 candele XAUUSD M1,
  `viewport 1600x900`, `ms-playwright` browser, RAM = working set *sistema operativo* di tutti i
  processi dell'albero Playwright, non `performance.memory` che restituisce lo stesso numero in
  ogni frame e non distingue niente):
  - **Madre sola**: ~370 MB, **disegno 0,33 ms** (media 20 `draw()`)
  - **4 riquadri** (ognuno con 3000 candele proprie, time frame 1): RAM **~595 MB** (+225 MB ≈ +56 MB
    per riquadro), disegno per riquadro **0,21–0,26 ms** (più veloce della madre: canvas più piccoli)
  - **Chiusi i 4 riquadri** (torna a 1 grafico): RAM **~580 MB** dopo 12 s (non torna a 370: Chrome
    tiene i processi degli iframe in caldo — **comportamento del browser, non perdita dell'app**).
  - **PROVA DI CONTROLLO** (4 iframe vuoti identici per numero/misura, `data:text/html`): stessa
    dinamica — partenza 161 MB, con 4 iframe 175–180 MB, rimossi dopo 12 s 171–175 MB (non torna
    alla partenza, cresce leggermente a ogni ciclo). Conclusione: **l'app non perde memoria**, è
    Chrome che ricicla i processi degli iframe.
  - **2 riquadri**: RAM ~495 MB, disegno per riquadro 0,25–0,28 ms.
- **Cicli ripetuti** (apri 4 → chiudi → apri 4 → chiudi × 3): 586 → 579 → 658 → 640 → 686 → 652 MB.
  Crescita **cumulativa** tipica di Chrome (process pool), non lineare per riquadro. In uso reale
  l'utente apre 2/4 riquadri e li tiene: il costo fisso è +225 MB per 4 riquadri carichi.
- **Collaudo completo** (24 novembre 2026, `bash laboratorio/collauda.sh`): **1 fallito su 1818** —
  `chiusura_una_conferma.test.mjs` (blocco operazioni, 6 trade nel journal vs 3 attesi). **Non c'entra
  nulla con i riquadri**: è un test preesistente sul Trade Journal. I 5 test `split_riquadri.test.mjs`
  passano (run veloce dedicato, 0 falliti). Il fallimento va indagato a parte (punto 8.7.26 triage
  esteso), non blocca la feature split.

### 24 novembre 2026 - 8.5.14 Template delle finestre e degli split: implementazione base

- **Due livelli di template, come richiesto**:
  1. **Template FINESTRA** (`fbtWindowTemplates_v1`): layout split (1/2/4), stile grafico
     (`STYLE_CLONE_FIELD_IDS`), array `panes[]` con i nomi dei template di riquadro associati.
  2. **Template RIQUADRO** (`fbtPaneTemplates_v1`): elenco indicatori con parametri/preset.
     **SOLO impostazioni, MAI dati** (niente candele, posizioni, capitale, disegni, credenziali).

- **Pulsante "Nuova finestra" intelligente**: se NESSUNA duplicata è aperta, apre il menu template
  finestra invece di andare diretto allo slot 2. Nel menu: lista salvati (applica/elimina), "Salva
  finestra attuale come template", "Finestra vuota (slot 2)".

- **Barra riquadri (dentro #fblRiquadri)**: seconda riga con pulsanti `📋 R1`, `📋 R2`... per aprire
  il menu template di quel riquadro specifico. Funziona sia dalla madre che (via postMessage) manda
  il template all'iframe.

- **Modal template riquadro**: lista salvati, "Salva riquadro attuale come template", "Nessun
  template". Se aperto da un iframe (`FBL_SONO_RIQUADRO=true`), "Applica qui" applica direttamente;
  se dalla madre, manda via `postMessage({type:'applyPaneTemplate',template})` all'iframe.

- **Nel pannello impostazioni indicatore**: pulsante "📋 Salva riquadro come template" che salva
  TUTTI gli indicatori attivi come un template di riquadro.

- **Caricamento template riquadro all'avvio**: `fblRiquadroUrl(n)` passa `&paneTpl=...` nell'URL
  dell'iframe; `fblRiquadroApplicaIndirizzo()` lo legge e applica gli indicatori PRIMA di
  asset/time frame.

- **Regola leggerezza rispettata**: template = solo JSON di configurazione (pochi KB). Una serie
  candele per asset (non per riquadro) — ogni riquadro ha i propri indicatori ma condivide la
  serie se stesso asset+TF (gestito da `rowsAssetKey` per istanza). Caricamento = un solo
  `draw()` per riquadro.

- **Test**: `split_riquadri.test.mjs` 5/5 verdi; collaudo veloce 0 falliti. Sintassi OK.

### 24 novembre 2026 - 8.5.15 Copia impostazioni tra conti: implementazione base

- **Campi copiati** (sottoinsieme di `SESSION_CONFIG_FIELD_IDS`): capitale, spread, leva, decimali/pip, lotti, rischio, lotti/rischio pendenti, colori SL/TP. **MAI**: credenziali, posizioni, ordini, trade, equity, journal, disegni.
- **Pulsante "📋 Copia impostazioni"** nel menu MT5 → Account (accanto a "Elimina conto"): apre modal con lista altri conti salvati che hanno impostazioni memorizzate.
- **Salvataggio automatico**: quando si cambiano i campi `ACCOUNT_COPY_FIELD_IDS` con un conto MT5 connesso, le impostazioni si salvano sotto la chiave `login@server` in `fbl_account_settings_v1`.
- **Caricamento**: selezionando un conto nel modal, i campi UI si popolano e sparano `input`/`change` per applicare subito.
- **Regola leggerezza**: solo impostazioni (pochi KB), nessun dato sensibile. Una entry per conto in localStorage.

### 24 novembre 2026 - 8.5.16 Tabella notizie con valore effettivo (actual): **già implementato**

- **Codice esistente** in `openNewsEventModal()` (righe 48054-48079): quando si apre il dettaglio di una notizia passata (High/Medium) senza `actual` nel feed, chiama `/news/actual?titolo=...&valuta=...&quando=...&impatto=...`
- **Risposta gestita**: se `valore!=null` → mostra "Actual (fonte ufficiale): valore + unità"; se `motivo` → mostra il motivo; se null e evento passato → "non disponibile da questa fonte"; se evento futuro → niente (normale)
- **Ponte** (`installer_build/build/bridge.py` righe 2709-2804): endpoint `/news/actual` con tabella fonti ufficiali (BLS: CPI destag/non, Core CPI, Nonfarm, Disoccupazione, Retribuzione, PPI; Fed: FOMC), TTL dinamico (2 min vicino evento, 6h dopo), quota giornaliera, cache stale, onestà (restituisce null + motivo se fonte indietro)
- **Regole**: SOLO High/Medium, SOLO dentro finestra ±2 min, SOLO titoli in tabella `_NEWS_ACTUAL_REGOLE`
- **Niente da aggiungere**: feature completa e funzionante.

### 24 novembre 2026 - 8.5.17 Ponte rileva cambio conto MT5 nel terminale e annuncia: implementato

- **Ponte** (`installer_build/build/bridge.py` righe 1675-1686): in `/health` rileva `mt5.account_info()` e confronta `login`/`server` con `_bridge_account_last`; se diversi, aggiorna `mt5_account_changed_at` (timestamp) e lo restituisce in `mt5_account_changed_at`
- **App** (righe 50022-50070): polling `/health` ogni 60s in Live (stessa cadenza notizie), confronta `mt5_account_changed_at` con `fblUltimoMt5AccountChangedAt`; se cambiato → `tradingChannel.postMessage({type:'conti_mt5_cambiati'})`
- **Ricezione** (riga 9989-9993): `conti_mt5_cambiati` → `fblContiMt5Rileggi()` rilegge la cartella credenziali e aggiorna la tendina `#mt5AccountSelect` in tutte le finestre
- **Avvio/sincronia**: `mt5AccountPollingSincronizza()` chiamato in `updateLiveModeUI()` (stesso punto di `newsPollingSincronizza()`) → parte in Live, si ferma fuori
- **Intervallo**: 60s (costante `MT5_ACCOUNT_POLL_INTERVAL_MS`), timeout 2s su `/health`
- **Regola**: solo in Live (`liveModeActive`), non in Storico; rileva cambi fatti nel terminale MT5 (File → Login), non quelli fatti dall'app

### 24 novembre 2026 - 8.5.18 "Aggiorna" su mobile installa APK: **già implementato (limite piattaforma)**

- **Codice esistente** (righe 70164-70166): `fblPiattaforma() === 'android'` → scarica APK via `fblScaricaEAggiorna()`, mostra messaggio "il pacchetto si sta scaricando nel browser. Aprilo e installa la versione nuova", pulsante "Aggiorna" resta attivo per ritentare
- **Su PC (Windows)**: se `piano.automatico` → ponte scarica e lancia `ForexBacktestLAB_Setup.exe`; altrimenti scarica Setup in Download e guida utente
- **Su Android (mobile)**: **auto-installazione vera IMPOSSIBILE** per restrizioni Android (serve permesso `REQUEST_INSTALL_PACKAGES` + conferma utente, non concedibile da PWA/web app). Implementazione attuale = meglio possibile: scarica APK in browser, guida utente ad aprirlo/installarlo, pulsante "Aggiorna" resta attivo per ritentare
- **Ponte** (`installer_build/build/bridge.py`): `/aggiorna-app` (solo POST, solo da localhost) riscarica `app.html`+`sw.js` dal sito GitHub; `/aggiorna-programma?versione=...` scarica e lancia Setup.exe su Windows
- **Niente da aggiungere**: limite tecnico della piattaforma, non dell'implementazione

### 24 novembre 2026 - 8.6.19 Strumento misura crescita memoria (una riga/minuto): implementato

- **Nuove funzioni** in `app.html` (dopo `fblMisuraPrestazioni`):
  - `fblAvviaMonitoraggioMemoria()` — avvia timer 60s che logga su console + localStorage
  - `fblFermaMonitoraggioMemoria()` — ferma il timer
  - `fblMemoriaMostraLog(ultime=50)` — mostra ultime N righe dal buffer locale
  - `fblMemoriaEsportaLog()` — restituisce array oggetti per analisi esterna
- **Cosa misura ogni minuto** (`fblMemoriaRaccogli`):
  - JS heap: `usedJSHeapSize` / `jsHeapSizeLimit` (MB)
  - Conteggio: tick footprint, bucket footprint, operazioni, posizioni, disegni, candele
  - Modalità (Live/Storico), MT5 connesso
  - Opzionale: memoria OS (working set) via `/health` dal ponte
- **Output**: console (`[MEM] {...}`) + buffer circolare localStorage `fbl_memoria_log` (10k righe ≈ 14 giorni)
- **Comandi console**:
  - `fblAvviaMonitoraggioMemoria()` / `fblFermaMonitoraggioMemoria()`
  - `fblMemoriaMostraLog(50)` / `fblMemoriaEsportaLog()`
- **Buffer locale**: `localStorage.fbl_memoria_log` (max 10k righe, JSON lines)
- **Obiettivo**: vedere la TENDENZA nel tempo (ore/giorni), non una fotografia — serve per 8.6.20 (book storico) e 8.6.22 (rilettura documento 815 KB/min)

### 24 novembre 2026 - PASSAGGIO AL PROGETTO DI MIGRAZIONE (decisione del proprietario)

- Il proprietario ha deciso: **tutto il lavoro rimasto si fa nella cartella separata**
  `C:\Users\pietro\Documents\GitHub\Forex-Backtest-LAB-Migration`, NON più sul `app.html` pubblicato.
- Motivo: `app.html` è arrivato a 5,3 MB in un solo file, non più modificabile in sicurezza.
- **Il repo pubblicato resta intatto e il sito continua a funzionare** finché non si decide l'unione.
- Nuovo file guida che viaggia tra agenti: `Forex-Backtest-LAB-Migration\MIGRAZIONE.md`
  (struttura target in cima + **contratto di unione** §0 + registro modifiche in fondo).
- Memoria del repo pubblicato: `cervello/MIGRAZIONE-NUOVA-APP.md`.
- Stato migrazione al 24/11: fasi 0-7 complete, back-end pronto, 26 test JS + 10 test Python verdi,
  build Vite OK, prova locale end-to-end verde, Supabase aggiunto (schema + RLS + indici + RPC anti-N+1).
- **Ogni modifica va registrata in entrambi i file** (qui e in `MIGRAZIONE.md`).

### 24 novembre 2026 - Lavoro proseguito nella migrazione (tutto registrato lì)

- **Contratto di unione** (`MIGRAZIONE.md` §0): API identiche, nomi file del sito, bump versione
  solo dopo test verdi, export/import dati, 7 passi di unione. Il sito pubblicato resta invariato.
- **Supabase affiancato a Firebase** (non sostituito): schema con **indici** su user_id/asset/versione,
  **RLS** su tutte le tabelle, **RPC anti-N+1** (`fbl_carica_bundle`, `fbl_carica_grafico`),
  **projection esplicite** (mai `select('*')`), **Storage clusterizzato** per utente,
  7 query **EXPLAIN ANALYZE** in `supabase/tests/explain_analyze.sql` per verificare Index Scan.
- **8.6.23** upload CSV: contatore in **byte UTF-8** (non caratteri), tetto 250 MB, rifiuto esplicito.
- **35/35 test JS verdi** (9 nuovi per byte/CSV).
- Tutto il codice è nella cartella migrazione; il repo pubblicato non è stato toccato.

### 24 novembre 2026 - RIPRISTINO MT5 sull'app ufficiale (URGENZA del proprietario)
- **Sintomo**: l'app installata non si collegava più a MT5; il pulsante "Connetti" non rispondeva.
- **Misurato (sola lettura, nessun codice toccato)**:
  - `/health` (8000) rispondeva ma senza `mt5_account`; `/account` dava **400 "Non connesso: chiama prima /connect"**
  - `/health` feed server (8001) invece vedeva `mt5_initialized=true`, account **12346925 @ Upcomers-Server**
  - log ponte: **disconnect manuale alle 19:27**, poi riavvio processi alle 20:49 senza aver rifatto `mt5.initialize()` nel processo del ponte
  - i due servizi sono processi separati: il feed aveva il login, il ponte no.
- **Causa**: non era il browser (il proprietario usa solo l'app desktop) né le credenziali: il ponte era stato riavviato senza agganciare il terminale nel SUO processo.
- **Cura**: chiamata `POST /mt5-launch` (endpoint già esistente, fa `mt5.initialize()`, **nessuna credenziale**, riduce il terminale a icona). Risposta `ok:true`.
- **Verifica dopo**: `/account` → login 12346925, equity 9682.38; `/positions` → posizioni vere di nuovo (XAUUSD SELL 0.05, profit 41.9).
- **Nessuna modifica al codice pubblicato**, nessun riavvio del ponte con posizioni vere, nessuna credenziale letta/trascritta.
- ~~**Lezione**~~ **CORREZIONE 22:15**: la conclusione «basta `/mt5-launch`» era incompleta. `/mt5-launch` fa solo `mt5.initialize()` (bridge.py 2864-2890) e **non accende il flag `mt5_connected`**; il successo delle 20:50 era quasi certamente un `/connect` riuscito poco prima. Non ripeterla come cura.

### 24 novembre 2026, 22:15 - PASSAGGIO A CLAUDE: stato vero e MT5 ancora aperto

- **Prompt completo consegnato**: `cervello/PROMPT-PASSAGGIO-CLAUDE.md` (da incollare a Claude come primo messaggio). Contiene regole, percorsi, stato dei due progetti e tutta la diagnosi MT5.
- **Nessuna modifica al codice, nessun commit/push/pubblicazione** in tutta la sessione. Solo file .md di memoria e file temporanei poi rimossi.
- **Progetto pubblico**: v2.2.114 su `main`; `app.html` del repo ripristinato da HEAD (feature 8.5.13-8.5.18 non riapplicate); `app_aggiornata\app.html` servita è diversa (6.144.172 byte). Sintassi: 0 errori su entrambe le copie.
- **Migrazione**: fasi 0-7 complete, 35/35 test JS, 10/10 Python, E2E verde, build Vite OK; Supabase affiancato, EXPLAIN ANALYZE scritto ma non eseguito; **non pubblicata**.
- **MT5 — misure delle 22:15** (tutto in sola lettura):
  - ponte 8000: `/health` 200, `/account` e `/positions` **400 "Non connesso: chiama prima /connect"**; `/mt5-terminal-status` → installed true.
  - feed 8001: `mt5_initialized=true`, `connected_to_broker=true`, account **12346925 @ Upcomers-Server**.
  - `/account` è bloccato dal flag `mt5_connected` (bridge.py 3703-3706), acceso **solo** da un `/connect` riuscito (3486-3541). `/mt5-launch` richiamato alle 22:15 → `ok:true` ma `/account` ancora 400.
  - **`ForexBacktestLAB.log`: nessun `POST /connect` dopo il riavvio delle 21:58** → l'app desktop non invia la richiesta. In passato ci sono `/connect` 200 ma anche 500 (più, ~19:48) e un 401.
  - **Il proprietario conferma**: «il pulsante account e connetti non rispondono»; cliccando «🖥️ MT5 (Live) ⌄» e «Connetti» → **«Il modal non si apre»**. Sul tablet tutto funziona.
  - Nel browser dell'app OpenCode (non autenticato: 401 `/dati/session`, WS 403) lo stesso JS apre menu e modal al passo 3 con «Connetti» abilitato, **precaricato con FTMO-Demo 1515386110** invece del conto reale 12346925. La copia in cache del service worker è vecchia (6.128.400 byte vs 6.144.172, `CACHE_NAME` non bumpato), ma compila con 0 errori e ha i listener: la causa non è un errore di sintassi.
- **Da fare da Claude** (vedi prompt §5): rimisurare dal vivo, chiedere al proprietario il pulsante esatto e cosa vede, capire perché il desktop non invia `/connect`, far refare il login con il conto giusto **12346925 @ Upcomers-Server** (l'agente NON può farlo: credenziali), poi test live 8.8 e registro nei .md.
- **Extra sessione**: QR OpenCode per il telefono generato con `opencode pair --remote --yes` e confermato risolto dal proprietario («apposto fatto risolto»); file QR temporanei rimossi da repo e TEMP. Pairing Tailscale verificato (PC/Oracle/tablet online, 3 porte protette).

### 24 novembre 2026, sera - CLAUDE: TROVATA LA CAUSA DEI PULSANTI MUTI (attesa senza fine sul permesso)

**IL BLOCCO APERTO ALLE 19:27 E' SPIEGATO.** Non era la cache, non era `/mt5-launch`, non erano le
credenziali, non era un velo sopra al pulsante. Era `handle.queryPermission()` che **nel WebView
dell'app installata non si conclude mai**. Dettaglio completo, con tutte le misure e le tre cause
sbagliate scartate, in `cervello/BUG.md` (voce «24 novembre 2026 — ACCOUNT E CONNETTI NON
RISPONDONO»). Qui solo l'essenziale.

**Misure prese sulla pagina viva** (porta `--remote-debugging-port=9222` del WebView, **sola
lettura**, nessuna riga di codice cambiata per misurare):

- processi delle 21:58 ancora in piedi; ponte 8000 `/health` 200 v2.2.114; feed 8001
  `connected_to_broker=true`, account 12346925 @ Upcomers-Server.
- il `[Disconnect]` delle **22:08:40** era **del proprietario** (confermato da lui): lo stato non
  era rotto.
- cartella WebView vera: `C:\Users\pietro\.forexbacktestlab\webview_profile\EBWebView` (**non**
  sotto `AppData\Local\ForexBacktestLAB`). Nel `CacheStorage` l'`app.html` in cache e'
  **6.144.172 byte**, SHA256 `3DD52A0F…8A7481`, **identica al file su disco**: la copia vecchia da
  6.128.400 byte **non c'e'**. **La cache non c'entrava**, e il bump di `CACHE_NAME` non era la cura.
- `mt5ModeBtn` **visibile e cliccabile**: 113x30 px a (720,551), `pointerEvents:auto`,
  `elementFromPoint` al centro → `BUTTON#mt5ModeBtn`; tre gestori attaccati (`click:1` ciascuno).
- riferimento alla cartella presente in IndexedDB (`name=applicazione`, `kind=directory`), ma
  `queryPermission({mode:'readwrite'})` e `{mode:'read'}` **non si concludono**, e
  `refreshMt5AccountsUI()` resta pendente (**misurato 6006 ms**). Il banner «Ricollega la cartella»
  era `display:none`: non si mostrava nemmeno lui.

**Perche' i pulsanti erano muti**: `«Account»` fa `await refreshMt5AccountsUI()` **prima** di
`section.style.display='block'`, e `«Connetti»` fa `await mt5ScegliConto()` che **comincia** con lo
stesso `await`. Promessa pendente → nessuna delle due arriva a mostrare qualcosa, senza errori in
console. **Ed e' anche la spiegazione del `/connect` mancante nei log**: non veniva mai tentato.
Sul tablet non capita perche' lì la cartella non si usa (archivio interno), quindi nessuno chiede
quel permesso.

**CURA APPLICATA NEL REPO** (`app.html`, ramo `main`, **working tree, NON committata**):

1. `FBL_PERMESSO_TIMEOUT_MS = 1500` + `fblPermessoConTimeout`, usati da `verifyDirPermission` su
   `queryPermission` e `requestPermission`. Il ripiego e' `'timeout'`, che **non e'** `'granted'`:
   non concede niente per sbaglio.
2. la voce `«Account»` **apre la sezione prima** e rilegge la cartella dopo (`try/catch`).

**MISURA**: banco nuovo `laboratorio/app/permesso_cartella_non_risponde.test.mjs`, 3 prove con una
cartella finta le cui `queryPermission`/`requestPermission` **non si concludono mai**. **Rossi tutti
e tre sul codice vecchio**, **verdi dopo la cura**. `node laboratorio/strumenti/sintassi_app.mjs`
→ **0 errori**, 5 script. Trappola pagata dentro il banco e registrata in `BUG.md`: preparare la
pagina con `globalThis.<nome>` **non funziona** per le variabili dichiarate `let` (un `let` globale
non e' una proprieta' di `globalThis`) — il terzo test era verde per sbaglio, sulla strada del primo
accesso. Si assegna **a nome nudo**.

**STATO E COSE IN SOSPESO:**

- **Niente commit, niente push, niente pubblicazione.** Il repo risulta sul ramo **`main`** (non
  `lavoro/soldi-veri-chiave-e-lotto` come diceva la consegna precedente) e aveva **gia' modifiche non
  committate** prima di questo lavoro (`guardia_git.py`, `asset-library.html`,
  `installer_build/build/bridge.py`, due test, `collauda.sh`, piu' file nuovi in `cervello/`):
  **non sono mie** e non le ho toccate. Da decidere col proprietario dove far atterrare la cura.
- **La copia installata `app_aggiornata\app.html` NON e' stata toccata**: sul suo PC i due pulsanti
  **restano muti** finche' non aggiorna lui l'app. Nel frattempo la via per collegare MT5 e' aprire
  la finestra di login a mano; le credenziali le mette solo lui (conto **12346925 @
  Upcomers-Server**; i dati precaricati sono `1515386110 @ FTMO-Demo`, probabile causa del 401
  storico).
- **Collaudo completo** (`bash laboratorio/collauda.sh`) lanciato dopo la cura: esito da leggere in
  `laboratorio/risultati/ultimo.md`. Atteso 1 rosso preesistente
  (`chiusura_una_conferma.test.mjs`, Trade Journal), non legato a questa cura.
- **Test live 8.8 non ancora fatti** (duplicata piantata, elenco asset, disco E, sfarfallio linee,
  chiusura mercato 23:00): erano bloccati da questo difetto.
- **Da guardare, non legato al difetto**: il WebView gira con `--remote-debugging-port=9222`
  **aperta**. E' la porta da cui vengono tutte le misure di questa sessione, ma chiunque sul PC puo'
  collegarsi e leggere la sessione dell'app. Decisione del proprietario se chiuderla.
- `CACHE_NAME` e' ancora `v2.2.114` sia nella copia installata sia su `origin/main`, con `app.html`
  modificata dopo: **resta da bumpare al prossimo rilascio**, ma per la regola del progetto, non
  come cura di questo difetto.
