# Indagine — divisione del grafico (più grafici affiancati nella stessa finestra)

**LAVORO 3** della `cervello/CONSEGNA-OPENCODE-15-NOVEMBRE.md`. Indagine di **sola lettura**: nessuna
riga di `app.html` è stata modificata, nessun file di codice toccato, nessun collaudo lanciato.
L'unico file scritto è questo.

**Fotografia misurata** (il file era in modifica da un altro agente mentre misuravo — quindi i numeri
valgono per QUESTA versione, non per «l'ultima»):

    app.html   5.879.407 byte   65.363 righe   LF (0 righe CRLF)   SHA256 inizia con C76F88CB
                modificato 15/11/2026 18:59
    ultima versione committata: v2.2.58 (04fc811)

Per le misure statiche ho lavorato su una copia congelata (`app_misura.html`, stesso hash): i numeri
non cambiano sotto i piedi.

---

## 1. Cosa ha chiesto il proprietario

> «Più grafici affiancati nella stessa finestra» — LAVORO 3 della consegna, priorità media-alta, la
> richiesta più grossa ancora intatta. La consegna dice: *«Nessuna indagine fatta. Prima di scrivere
> codice, misura»*. Questo rapporto è quella misura.

**Da chiedere a lui, non da indovinare**: quante aree, se lo stesso asset può stare in due, e se
mirino e replay devono viaggiare fra i riquadri come fra le finestre (§5).

**Un fatto che cambia la domanda.** «Duplica finestra» esiste già e funziona: ogni clic apre una
pagina completa e indipendente (`openExtraPipWindow()`, riga **32844**; pulsante riga **4529**;
listener riga **33941**, che assegna lo slot libero da 2 a 9). Quindi la richiesta non è «poter
guardare due grafici insieme» — quello c'è — ma «averli **dentro la stessa finestra**, affiancati».
È una differenza grossa: §3.

---

## 2. Le misure

### 2.1 Com'è fatto `#chartWrap`

**Markup**: `app.html` righe **4365–4588** = **224 righe** di HTML per il solo contenitore, con
**47 id distinti** dentro (contati con `grep -o 'id="[A-Za-z0-9_]*"'` su quel blocco). Dentro:

| elemento | riga | a cosa serve |
|---|---|---|
| `#chartFsSidebar` | 4366 | strumenti di disegno (spostata/vuotata in schermo intero) |
| `#chartMainArea` | 4378 | area di disegno |
| `#chart` (canvas) | **4379** | **l'unico canvas del grafico** |
| `#priceAxisZone`, `#timeAxisZone` | 4380 | zone di presa per trascinare gli assi |
| `#quickTradeCluster` | 4398 | barra ordine rapido, 19 id suoi |
| `#chartFloatControls`, `#chartFloatControlsExtra`, `#activeIndicators` | 4472, 4575, 4586 | toolbar e legenda dentro il grafico |

**Canvas davvero presenti nella pagina: 10**, misurati a runtime con
`document.querySelectorAll('canvas')` su Chromium:

    8 senza id    300x150, invisibili (creati con createElement('canvas'): misure di testo, LUT
                  della heatmap, figure della guida)
    1  #chart     il grafico
    1  #wowCanvas l'effetto "wow"

(Il dato «nove canvas» che girava nel prompt è vicino ma non esatto: **sono 10**, e il grafico è
`#chart`. Nel sorgente i tag `<canvas` scritti a mano sono **3** — righe 4379, 50311 in un template,
65255 — e `createElement('canvas')` compare **3** volte: gli altri nascono a runtime.)

**Chi lo ridimensiona**: nessun `ResizeObserver` (0 occorrenze). Il canvas si dimensiona **dentro
`draw()`**, riga **23605**:
`const c=$('chart'), ctx=c.getContext('2d'), dpr=devicePixelRatio||1, w=c.clientWidth, h=c.clientHeight;`
e righe 23620-23622: `if(c.width!==_cw||c.height!==_ch||typeof ctx.reset!=='function'){c.width=_cw;...}`.
Cioè: **il ridimensionamento è un effetto collaterale del disegno**. Le altre 9 chiamate a
`addEventListener('resize')` non toccano il canvas.

**Chi lo ridisegna**: `draw()` — righe **23592–26081**, **2.490 righe**, **162 KB** di codice, la
funzione più lunga del file. Non c'è nessun ciclo `requestAnimationFrame` che la guidi: **`draw()` è
chiamata a mano in 471 punti** (`grep -c '\bdraw()'`), di cui **339 `draw();` da sola** e **54 insieme a
`update()`**. Il `draw()` è accoppiato a `update()` (righe 14984, 522 righe, 166 chiamate): chi
pensa «ridisegna il grafico» deve oggi sapere che l'altra metà della pagina (tabelle, pannelli,
journal) si aggiorna con un'altra funzione.

**Quante funzioni assumono UNA sola area di disegno** (misurato sul codice, non a occhio):

    $('chart') ...................... 21 occorrenze
    getElementById('chart') .........  3
    chartEl (const, riga 33954) ..... 108 occorrenze, in 18 funzioni di primo livello
      di cui chartEl.addEventListener ... 35
      di cui chartEl.getBoundingClientRect 24
    $('chartWrap') / id="chartWrap" .  1 + 2
    priceAxisZone ................... 28
    timeAxisZone .................... 35
    chartMainArea ................... 10

Il punto duro è la riga **33954**: `const chartEl=$('chart');` — **letta UNA volta all'avvio**. Tutti i
35 listener (rotellina, trascinamento, dito, doppio clic, click) e i 24 `getBoundingClientRect`
passano da quella costante. Un secondo canvas non diventerebbe mai `chartEl`.

E `$()` stessa (riga **12232**) conosce **un solo documento in più**:

    const $=x=>document.getElementById(x)||(floatingDoc&&floatingDoc.getElementById(x));

Cioè: il progetto ha già un trucco per avere il grafico «altrove» — **staccare lo stesso nodo**
(`openFloatingChart`, finestra flottante singola) — e lo risolve con un fallback a un documento. Due
aree **nella stessa pagina** non stanno in questa forma: gli id si scontrerebbero e `$()` prenderebbe
sempre il primo.

### 2.2 Quanto del disegno dipende da variabili globali

`app.html` ha **6 blocchi `<script>`**; il motore è il terzo (righe **5049–61157**, 56.108 righe,
classico, non modulo): **2.068 funzioni di primo livello** e **957 globali** dichiarate a colonna 0
(`let/var/const` + `window.X=`). In un `<script>` classico quei `let` finiscono nell'ambiente
lessicale globale **condiviso da tutti gli script della pagina**: è esattamente per questo che due
grafici nella stessa pagina si pestano i piedi.

**Lo stato del grafico nasce in due righe:**

- riga **5081**, un solo `let` da **40 nomi**: `rows, baseRows, rowsAssetKey, csvLibrary, idx,
  viewEnd, masterTime, positions, active, trades, equity, history, tradeSLLine, tradeTPLine,
  pendingOrders, timer, currentTF, panDrag, panStart* (7), tradeLevelDrag, touchPoints,
  twoFinger* (10), zoneWidthDrag`. Classificati: **31 sono di vista/gesto (vanno per riquadro)**,
  **9 sono di conto/dati comuni** (`csvLibrary, positions, active, trades, equity, history,
  tradeSLLine, tradeTPLine, pendingOrders`);
- righe **10915–10926** e **15505**: `priceZoomFactor, followLatest, viewPriceLo, viewPriceHi,
  autoFitWidth, visibleCount` — altri **6 campi di vista**.

Totale: **37 campi di vista** contro **9 di conto**. E c'è già, in casa, la fotografia di quei campi:
`captureChartViewInto()` (riga **7887**) salva **10 di quei campi** in
`assetChartViews[sessione][assetKey]` (riga 7886), e i disegni stanno in
`assetDrawings[sessione][assetKey]` (riga 7945). **La memoria «per asset» esiste già: manca la
dimensione «per riquadro».**

**Quante funzioni li leggono** (conteggio dei token dentro il corpo di ogni funzione, non delle righe):

| globale | funzioni che la nominano | dentro `draw()` |
|---|---|---|
| `currentAssetKey` | **135** | sì |
| `rows` | **129** | sì |
| `liveModeActive` | **128** | sì |
| `idx` | **81** | sì |
| `liveReplayActive` | 61 | sì |
| `positions` | 54 | sì |
| `currentTF` | **51** | sì |

**Il costo del disegno, in funzioni da toccare:**

    draw() tocca 59 globali distinte e chiama DIRETTAMENTE 142 funzioni di primo livello
    chiusura a profondità 1: 143 funzioni,  5.059 righe, 124 globali distinte
    chiusura a profondità 2: 251 funzioni,  6.791 righe, 158 globali
    chiusura a profondità 3: 323 funzioni,  7.993 righe, 187 globali
    chiusura a profondità 6: 454 funzioni,  9.416 righe, 245 globali

`draw()` da sola legge e scrive 59 globali: fra queste non ci sono solo i dati, ci sono le **cache del
disegno** (`footprintByBucket`, `footprintVersione`, `heatmapCellsMeta`, `_hmImgCache`,
`orderBookHistoryByAsset`, `_zonePrintCacheKey`) e le **zone di presa dei clic**
(`zoneBoxHitRects, openPosHitRects, tpSlPillHitRects, footprintCellHitRects, footprintStyleHitRects,
tvp3dHits, newsDotHitRects, lockButtonRects, vpIndBarRects`). Sono **9 array riempiti a ogni
fotogramma e letti dal `pointerdown`**: con due riquadri nella stessa pagina sarebbero la stessa
lista, quindi un clic nel riquadro A potrebbe colpire la casella disegnata nel riquadro B.

**Quanti elementi DOM vanno per riquadro** (misurato): delle 47 id dentro `#chartWrap`, la chiusura di
`draw()` a profondità 2 ne prende con `$('id')` solo **7**; le altre passano da `chartEl` o da
variabili locali. Quindi **il DOM pesa meno dello stato** (27 funzioni su 2.068 toccano un id di
`#chartWrap`): il problema non è clonare il markup, è che **lo stato è uno solo**.

### 2.3 Il sintomo riprodotto (banco, 1 browser, ~40 secondi)

Banco scritto come file e lanciato con `node` (non incollato in un heredoc). Fa tre cose sulla
pagina vera, con 600 candele finte iniettate:

    1) conta i canvas della pagina                          -> 10 (vedi §2.1)
    2) carica 600 candele e disegna                         -> #chart: 126.926/126.926 pixel pieni
    3) COPIA #chartWrap nella stessa pagina, rinomina gli
       id della copia, azzera il bitmap della copia, draw()-> copia: 0/126.926 pixel pieni,
                                                               vero: 126.926/126.926
    4) mette un secondo <canvas id="chart"> PRIMA del vero,
       poi chiama draw()                                    -> il "finto" prende l'id: $('chart') e
                                                               document.getElementById('chart')
                                                               restituiscono LUI, chartEl resta il
                                                               vero; draw() dipinge il finto
                                                               (25.715/25.715 pixel) e lascia il
                                                               vero com'era

**Cosa dicono i numeri**: una seconda area di disegno nella stessa pagina **resta nera** — ha il
layout giusto (1234×720 px) e **zero pixel dipinti** dopo un `draw()` completo. E se le si dà lo
stesso id, il disegno va **da una parte** (`$('chart')`) mentre i gesti e le letture di posizione
restano **dall'altra** (`chartEl`): il programma non ha nessuna nozione di «quale grafico».

Il banco è in `C:\Users\pietro\AppData\Local\Temp\opencode\diag_divisione2.mjs`; per promuoverlo in
`laboratorio/app/` basta usare `apriApp()` di `laboratorio/app/aiuti.mjs` e la stessa scena di
`mirino_fra_finestre.test.mjs` (600 candele iniettate in `baseRows`, `rebuildRows()`, `draw()`).

### 2.4 La strada delle finestre duplicate: che cosa isola `PIP_SLOT`

    PIP_SLOT occorrenze ............... 91, in 43 funzioni
    guardie `PIP_SLOT>0` .............. 37   (di cui 11 `if(PIP_SLOT>0)return;`)
    `PIP_SLOT===0` / `!==0` ........... 4 / 1
    FBL_FINESTRE_MAX .................. 9  (slot 2..9 = otto finestre oltre la principale)
    EXTRA_PIP_WINDOWS_ENABLED ......... true (riga 5158)

**Come funziona davvero** (riga 5167): legge `?pipSlot=N` dall'URL **una volta all'avvio** e
restituisce un numero. Non isola niente da solo: **non c'è nessun oggetto di stato per slot.** Lo
stato è isolato perché ogni finestra è un **documento separato, con un motore JS suo**. `PIP_SLOT`
serve solo a tre cose: (a) **non scrivere su disco** dalle finestre 2-9 (è l'unica fonte di verità
persistente è lo slot 0); (b) **firmare** i messaggi sul canale; (c) decidere **chi valuta gli SL/TP**
quando lo stesso asset è in due finestre (`anotherWindowOwnsAssetEvaluation`, riga 9493, usata alle
righe 30149 e 30243: vince lo slot più basso).

**Conseguenza per la divisione del grafico, ed è la risposta alla domanda della consegna:** il
meccanismo delle finestre **non si può riusare dentro una pagina**, perché non è un meccanismo — è
il browser che dà a ogni finestra un ambiente globale suo. Dentro una pagina `let rows` è **una sola
variabile**.

**Un commento vecchio da non credere**: sopra `EXTRA_PIP_WINDOWS_ENABLED` (righe 5151-5157) c'è
scritto «finestre PIP aggiuntive DISATTIVATE … con `false`»: **la costante vale `true`** e le
finestre si aprono. Il codice vince.

**Canale fra finestre**: `BroadcastChannel`, 46 riferimenti a `tradingChannel`, **16 tipi di
messaggio**:

    trading_sync, trading_sync_request, presenza, presenza_request, asset_announce,
    drawings_sync, drawings_sync_request, mirino, mirino_taglio, replay_sync,
    random_jump_sync, chart_time_sync, setup_indicatore, cloud_doc, cloud_doc_chiedi,
    pip_clone_request, pip_clone_snapshot

### 2.5 Cosa va sincronizzato e cosa no — dove vive lo stato OGGI

| cosa | dove vive oggi | viaggia fra finestre? |
|---|---|---|
| **mirino** | `crosshair` (11142) + geometria `fblGeoGrafico` (10960) | **sì**: messaggio `mirino` con `{orario, prezzo, asset}`, max 25 al secondo (`FBL_MIRINO_OGGI_MS=40`), solo stesso asset, TF anche diversi. Chi riceve lo riconverte coi propri pixel (`fblMirinoRemoto`, 10958) |
| **replay (taglio)** | `liveReplayActive` (5088), `masterTime`, `idx`, `fblGuidaRemota` (10959) | **sì** se il replay è condiviso: `replay_sync` + `mirino_taglio` + `chart_time_sync` + `random_jump_sync` |
| **timeframe** | `currentTF` (5081) + select `#tfChart` | **no**: nessun messaggio per il TF. Ogni finestra ha il suo (ed è voluto: il banco `mirino_fra_finestre` usa 1m contro 15m) |
| **asset** | `currentAssetKey` (7662) | **annunciato, non applicato**: `asset_announce` serve solo alla guardia anti doppia chiusura e all'elenco asset della duplicata |
| **posizioni/ordini/conto** | `positions, pendingOrders, trades, equity` (5081) | **sì, sempre**: `trading_sync`, lo stesso conto in ogni finestra. Chi applica non ri-annuncia (`fblSenzaRiannunciare`) |
| **disegni** | `drawings` (11149) + `assetDrawings[sessione][asset]` (7945) | **sì**, solo per lo stesso asset e solo i tipi condivisi (`fblDisegnoCondiviso`: VWAP, profilo volumetrico e linee Allarme restano locali) |
| **indicatori** | `activeIndicators` (16238) | **mai** (commento riga 9534: scelta esplicita). Viaggiano solo gli **ultimi parametri** usati (`setup_indicatore`, riga 22183) |

Letto per la divisione: **mirino e replay hanno già una traduzione «orario+prezzo → pixel del
ricevitore»** che è indipendente dal contenitore. Fra due riquadri della stessa pagina la stessa
funzione varrebbe identica — anzi più semplice, perché non serve il canale: una chiamata diretta.

### 2.6 Il tetto pratico — cosa è misurato e cosa no

**Misurato** (numeri veri dal PC del proprietario e dal banco, citati dal diario):

| misura | valore | fonte |
|---|---|---|
| disegno medio, 50.029 candele, 4 indicatori, v2.2.12 | **64,44 ms/fotogramma, 4,7 fps**, di cui `indicatori` **58,11 ms** | `cervello/BUG.md` riga 54 |
| prima delle cure, 51.172 candele | **54,57 ms, 14 fps**, `disegniUtente 27,1 + indicatori 23,74 = 50,8` | `DIARIO.md` 954, 5491 |
| 11 novembre, profilo volumetrico | **238,34 ms/fotogramma, 4 fps**, `vpfixed 139,23` (58%), scatto peggiore 735 ms | `DIARIO.md` 6179 |
| 26 ottobre, zone zero-print | **276 ms/fotogramma, 4,8 fps**, 128 ms nella sola `zoneZeroPrint` | `DIARIO.md` 5385 |
| lo stesso disegno **sul banco** | **4,5-5 ms** | `DIARIO.md` 5512 |
| un `draw()` con 120 candele, scena del banco | **0,8 ms** | banco di §2.3 |
| RAM di UNA finestra aperta (working set) | **253-266 MB**; motore web a 7 processi **847 MB**; totale app **1.196 MB** | `DIARIO.md` 6696, 6712 |
| footprint: 150.000 tick/asset × 7 asset | **1.042.311 tick, 1.350 MB** | `LEZIONI.md` 1267 |
| dopo la «targa della serie» (13 nov) | indicatori **262 ms → 0,6 ms per tick** | `LEZIONI.md` 1568 |

**NON misurato, e va detto**: **non c'è una misura di fotogrammi fatta DOPO le cure del 13 novembre.**
L'ultima è 4,7 fps del 12 novembre, quando il calcolo degli indicatori costava 58 ms su 64. Quindi
**oggi non sappiamo quanto costa un fotogramma**, e di conseguenza **non sappiamo quanti riquadri
regge la macchina**. Chi dice «due o quattro» oggi lo sta indovinando.

Quello che si può dire con i numeri che ci sono: con 64 ms per grafico, **due grafici ridisegnati a
ogni evento nella stessa pagina costano ~129 ms**, cioè il tetto teorico scende sotto gli 8
fotogrammi al secondo — nella stessa pagina. Due finestre separate hanno due cicli di eventi distinti
(ma **se il browser le tenga su due processi o su uno non l'ho misurato**: §6).

---

## 3. Le tre strade possibili

### Strada A — riquadri veri nella stessa pagina (stato parametrico)

Bisogna trasformare i **37 campi di vista** in stato per riquadro e farli leggere a chi li usa:
`currentAssetKey` **135** funzioni, `rows` **129**, `liveModeActive` **128**, `idx` **81**,
`currentTF` **51**. Più `draw()` (2.490 righe, 59 globali) e i **471 punti di chiamata** di `draw()`,
di cui **339 `draw();` da sola** che oggi non dicono *quale* grafico ridisegnare. Più `chartEl`
(108 usi, 35 listener) e i 9 array delle zone di presa dei clic.

- **Costo**: 130-330 funzioni da toccare (a seconda di dove ci si ferma nella chiusura), i 471 punti
  di `draw()`, 37 campi.
- **Rischio**: alto. Non è un rifattorizzare meccanico: le funzioni dentro `draw()` **scrivono** stato
  globale (cache, zone di presa, `posStoriaAggiornaTutte`, `broadcastAssetAnnounce`). Un clic nel
  riquadro B colpirebbe le caselle del riquadro A finché non si separano anche quelle.
- **Vantaggio**: è quello che ha chiesto; un solo `update()`, un solo conto, una sola watchlist.

### Strada B — finestre duplicate (quello che c'è già)

Non c'è niente da rendere parametrico: l'isolamento è il documento. Ci sono già gli 8 slot, il
canale, i 16 messaggi, la synchronizzazione di conto/posizioni/disegni/replay/mirino, e «spegni il
salvataggio su disco» (`PIP_SLOT>0`, 37 guardie).

- **Costo**: **zero** sul grafico. Al massimo: un pulsante «affianca» che dispone due finestre del
  sistema operativo (fuori dal perimetro dell'app, e su Windows l'app è un `pywebview` con più
  finestre: `pywebview.api.nuova_finestra`, riga 32848).
- **Rischio**: basso (è già in produzione). Ma **non è la richiesta**: restano due finestre del
  sistema, non due riquadri nell'app.
- **Costo misurato per finestra**: una pagina da 5,87 MB da caricare, **253-266 MB di RAM**, e uno
  **scaricamento storico per finestra** (ogni finestra ha i suoi `rows`).

### Strada C — una via di mezzo: cambio di contesto attorno a `draw()`

Il progetto **ha già** la fotografia della vista per `[sessione][asset]` (10 campi,
`captureChartViewInto` riga 7887) e i disegni per `[sessione][asset]` (7945). Si può immaginare:
per ogni riquadro, *caricare* la sua fotografia nei globali → `draw()` sul *suo* canvas → *salvare*
la fotografia.

- **Costo**: si toccano **`draw()` (una funzione), `$`/`chartEl` (una risoluzione per volta), e la
  fotografia (10 → 37 campi)**. È un ordine di grandezza meno della strada A.
- **Rischio**: **reentranza**. `draw()` chiama 142 funzioni che scrivono stato globale e le cache del
  disegno; e `draw()` è chiamata da timer, fetch e messaggi del canale, **quando il contesto corrente
  potrebbe essere un altro riquadro** (471 punti di chiamata). Se una di quelle funzioni scrive nel
  riquadro sbagliato, il difetto sarà intermittente — la categoria peggiore da misurare. Inoltre le
  `zoneBoxHitRects` e le altre 8 liste dei clic hanno lo stesso problema.
- Serve una **prova di controllo** prima di crederci: due riquadri, un trascinamento di SL su uno,
  e la verifica che sull'altro non si muova niente.

---

## 4. La raccomandazione

**1. Prima si misura il fotogramma di oggi, poi si sceglie.** Costa mezz'ora: si apre l'app col
pannello prestazioni (`fblMisuraPrestazioni`, riga 58429) e si legge `disegnoMedio_ms` e
`fotogrammiAlSecondo` **dopo** le cure del 13 novembre. Da quel numero esce il tetto vero di
riquadri. **Oggi quel numero non esiste**, e senza di lui qualunque scelta è un'intuizione.

**2. Per la richiesta così com'è, la strada con il rapporto migliore è la A fatta in piccolo, ma non
subito.** Concretamente: **due** riquadri, non quattro, e **solo la parte di vista**, con le zone di
presa dei clic separate per riquadro. Se il fotogramma di oggi è ~10 ms, due riquadri costano ~20 ms e
si sta larghi; se è ancora ~60 ms, due riquadri sono **inutilizzabili** e la strada giusta è la B
(finestre) con la dichiarazione onesta al proprietario che «affiancati dentro la stessa finestra»
non è compatibile con la sua macchina finché il disegno costa così.

**3. Il ponte fra le due strade c'è già ed è la cosa da non perdere**: mirino e taglio del replay
viaggiano come **orario + prezzo**, non come pixel. Qualunque strada si scelga, quella traduzione
(`fblMirinoSuSchermo`, riga 11063 e dintorni) è la parte riusabile.

**4. Non toccare `draw()` per prima.** La funzione più lunga del file (2.490 righe) è anche quella
da cui dipendono 143 funzioni e 124 globali: qualunque modifica va fatta con il banco di §2.3 già in
piedi e una prova di non-regressione sul grafico a un riquadro.

---

## 5. Le domande al proprietario (secche, con la mia raccomandazione)

**D1 — Quanti riquadri?**
(a) 2 affiancati · (b) 4 in griglia 2×2 · (c) da 1 a 4, scelti da lui · (d) quanti ne stanno.
**Raccomando (a) due**, e non per prudenza: il canvas misurato è **1234 px** su una finestra da 1300;
due riquadri sono **~600 px a testa**, quattro **~600×350**. A 600 px la toolbar del grafico (47 id,
`#chartFloatControls`, `#quickTradeCluster`) non ci sta: o si nasconde, o si sposta fuori. Con 4
riquadri il lavoro di §3-A si moltiplica per due e la leggibilità crolla.

**D2 — Lo stesso asset può stare in due riquadri?**
(a) sì, anche lo stesso asset · (b) no, solo asset diversi · (c) sì, ma uno solo dei due opera.
**Raccomando (a) con la regola (c) dentro**: la guardia esiste già per le finestre
(`anotherWindowOwnsAssetEvaluation`, riga 9493: valuta SL/TP solo lo slot più basso) e con due
riquadri va replicata, altrimenti **la stessa posizione viene chiusa due volte** — è un difetto già
visto, non un'ipotesi.

**D3 — Mirino e replay devono viaggiare fra i riquadri come fra le finestre?**
(a) sì, stessa regola (stesso asset, TF anche diversi, orario+prezzo) · (b) mirino sì, replay no ·
(c) tutto indipendente.
**Raccomando (a)**: è la stessa richiesta che ha fatto il 15 novembre per le finestre («si deve
trasportare anche sulle altre… esattamente come funziona su TradingView»), e il conto
orario+prezzo→pixel esiste già.

**D4 — Un riquadro si può staccare in una finestra (e viceversa)?**
(a) sì, «stacca» apre una finestra e libera il riquadro · (b) no, restano due funzioni separate ·
(c) il riquadro *è* una finestra incorporata.
**Raccomando (b) per la prima versione.** Il ponte sembra gratis ma non lo è: c'è una regola di
progetto («scrive su disco **solo** lo slot 0») e con i riquadri bisogna decidere chi eredita quel
ruolo. Da fare dopo, non insieme.

**D5 — Con due riquadri, footprint/order flow e watchlist?**
(a) footprint acceso **solo nel riquadro sotto il cursore**, spento negli altri · (b) acceso in tutti ·
(c) ognuno con la sua memoria · watchlist sempre una sola.
**Raccomando (a) + watchlist unica.** Il footprint è la parte più cara: `FOOTPRINT_MAX_TICKS_PER_ASSET`
a 150.000 tick per asset, misurati **1.042.311 tick e 1.350 MB con 7 asset aperti** (`LEZIONI.md`
1267). Con due riquadri su due asset diversi quella memoria sta **nello stesso mucchio**, e la
watchlist è già una sola e persistita solo dallo slot 0.

---

## 6. Cosa resta IPOTESI (dichiarato)

1. **Quanto costa un fotogramma oggi**: non misurato dopo le cure del 13 novembre. Tutti i conti sul
   «tetto di riquadri» poggiano su un numero del 12 novembre.
2. **Se due finestre separate girino su due processi o su uno**: non misurato. Con la stessa origine
   il browser può tenerle nello stesso processo, e allora «due finestre» non è più veloce di «due
   riquadri». **È la misura che decide fra la strada A e la strada B**: si fa con due finestre
   aperte e il Task Manager (o `about:processes` in Chromium).
3. **Che la strada C (cambio di contesto) funzioni**: non provata. Il rischio di reentranza è
   dichiarato, non misurato.
4. **Quanto del disegno sia davvero per-asset**: `assetChartViews` e `assetDrawings` esistono, ma
   quante funzioni *dipendono* da quella struttura invece di leggere i globali non l'ho contato.
5. **Il comportamento del desktop (`pywebview`)**: le finestre dell'app le crea pywebview, non il
   browser. Non ho misurato né memoria né tempi lì; tutte le misure di questa indagine sono su
   Chromium del banco, che la `DIARIO.md` (riga 5512) dice essere **dieci volte più veloce** del suo
   PC.

---

## 7. Come rifare le misure (comandi)

```bash
# struttura, funzioni, chiusura di draw(), globali toccate
node "$TEMP/opencode/misura2.mjs" app.html          # -> 2068 funzioni, 957 globali, 59 in draw()

# chi prende il canvas / quanti id dentro #chartWrap / quante chiamate a draw()
node "$TEMP/opencode/misura3.js"                    # -> 47 id, chartEl 108, draw() 471
node "$TEMP/opencode/misura10.js"                   # -> id di #chartWrap usati nella chiusura
node "$TEMP/opencode/misura16.js"                   # -> 40 nomi nella riga 5081: 31 vista + 9 conto

# il sintomo riprodotto (1 browser, ~40 s, nessuna rete)
node "$TEMP/opencode/diag_divisione2.mjs"           # -> copia: 0 pixel; finto dipinto, chartEl no

# conteggi a mano, se serve rifarli in fretta
grep -c "PIP_SLOT" app.html                         # 91 (43 funzioni, 37 guardie >0)
grep -c "\bdraw()" app.html                         # 471
grep -c "chartEl" app.html                          # 108
```

I banchi stanno in `C:\Users\pietro\AppData\Local\Temp\opencode\` e **non sono stati committati**:
questa indagine non doveva scrivere nel repo. Se servono, si promuovono in `laboratorio/app/` con
`apriApp()` di `laboratorio/app/aiuti.mjs`.

**Non ho lanciato `bash laboratorio/collauda.sh`** (20 browser, 2,4 GB) come da istruzioni: le misure
nel browser sono un Chromium solo, headless, chiuso a fine banco.
