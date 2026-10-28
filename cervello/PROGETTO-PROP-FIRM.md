# Prop firm: analisi prima di toccare il codice

**27 ottobre 2026 — studio, non implementazione.** Richiesto dal proprietario: scegliere fra
regole FTMO **one step** e **two step**, con percentuali configurabili, su **MT5, storico, replay
e rendimento delle sale**, con **commissioni reali** e la cifra che spetterebbe a conto sbloccato.
Più una strategia di sala distinta per conto normale / prop one step / prop two step, e il tipo
di conto chiesto alla creazione.

---

## 1. LA SCOPERTA PIÙ IMPORTANTE: metà del lavoro c'è già

Non si parte da zero. In `app.html` ci sono **444 occorrenze** e ~30 funzioni già scritte:

| Pezzo | Dove | Stato |
|---|---|---|
| Quattro sessioni (Storico / Live / Storico+PF / Live+PF) | `sessionByMode`, `isPropFirmMode` | funziona |
| Motore delle regole, richiamato a ogni tick | `checkPropFirmRules()` dentro `update()` | funziona |
| Giornata di riferimento con fuso Europe/Rome | `cetDateKey()`, `ensurePropFirmDailyBaseline()` | funziona |
| **L'orologio del replay** | `currentPropFirmNowMs()` usa `masterTime` in storico | **già pronto per replay** |
| Violazione, schermata rossa, "sbloccata", ricomincia | `triggerPropFirmViolation()` e compagnia | funziona |
| Blocco notizie (±2 minuti, solo Live) | `blockedByPropFirmNews()` | funziona |
| Prop sul conto MT5 **vero** | `pfUsesRealMt5()`, `pfMt5Metrics()` | funziona |
| **Prop nel rendimento delle sale** | `fblPropDedicataConta()`, con test | **esiste già** |

`currentPropFirmNowMs()` è il pezzo che vale di più: in storico usa l'orario **simulato** della
candela, non l'orologio del computer. Vuol dire che **lo storico e il replay sono già coperti**
dall'architettura, e lì non c'è da inventare niente.

---

> ## ✅ PASSO 1 FATTO — 28 ottobre 2026
>
> I due errori del capitolo 2 sono **corretti**, in tutti e tre i punti dove stavano:
> `fblPropDedicataConta()` (le sale), `checkPropFirmRules()` (la sessione) e `pfMt5Metrics()`
> (il conto MT5 vero).
>
> **8 test nuovi**, in `prop_firm_regole_ftmo.test.mjs` e `prop_firm_limite_giornaliero.test.mjs`:
> 5 erano **rossi prima** della correzione, 3 sono prove di controllo che erano e restano verdi
> (servono a impedire che "correggere" diventi "non bocciare mai piu' niente").
>
> Gli **11 test gia' esistenti passano identici**: i loro numeri cadevano dalla stessa parte con
> tutte e due le formule, ed e' esattamente per questo che l'errore era sopravvissuto. I casi
> nuovi sono costruiti apposta perche' le due regole diano verdetti OPPOSTI.
>
> ## ✅ PASSO 2 FATTO — 28 ottobre 2026
>
> Le regole stanno in **`FBL_PROP_REGOLE`**, un posto solo, coi preset `ftmo-1step` e
> `ftmo-2step`. Il motore li **legge**: `checkPropFirmRules()` non ha più nessun 5, 10 o 10
> scritto dentro.
>
> **4 test nuovi**, e i due che contano davvero cambiano il preset e guardano se il verdetto
> cambia. **Controprova eseguita:** rimettendo i numeri fissi vanno rossi esattamente quei due,
> e restano verdi i due che controllano solo il catalogo.
>
> **I 19 test di prima passano senza toccarne uno**, che era la garanzia richiesta: a parita' di
> impostazioni l'app fa esattamente quello che faceva.
>
> **Prossimo:** passo 3 — seconda sfida, giorni minimi, costanza, trailing.

> ## ✅ PASSO 3 FATTO — 28 ottobre 2026
>
> Le fasi si percorrono **tutte**: seconda sfida che riparte dal capitale iniziale col 5%,
> **giorni minimi** (4 nel two step, e si dice quanti ne mancano), **massimo che insegue** il
> saldo di fine giornata nel one step, **regola di costanza** che segnala e non boccia.
>
> Nessun `if(oneStep)` da nessuna parte: è l'elenco `fasi` a fare la differenza.
>
> **6 test nuovi** con due prove di controllo incrociate (la stessa curva che il one step boccia,
> col two step è sana). **Due test vecchi aggiornati** perché descrivevano il mondo a fase unica:
> raggiungere l'obiettivo non è più «sbloccata», è «sfida 1 passata».
>
> **29 test della prop firm, tutti verdi.**

---

## 5-quater. PASSO 4: LE COMMISSIONI — come è disegnato

È il pezzo grosso, e il proprietario ha scelto **tutte e due le strade insieme**: valori FTMO
tipici **in percentuale**, e **imparati dal conto MT5 vero**.

### Il pezzo che rende fattibile la seconda strada

`bridge.py` (righe ~2567 e ~2646) restituisce già, per ogni operazione MT5 chiusa, la
**commissione davvero addebitata**, sommata dai suoi *deal*. Non è un'ipotesi: il dato c'è.
Da lì si ricava il costo medio per lotto, strumento per strumento.

### Le tre decisioni da prendere scrivendolo

**1. Quanti trade servono prima di fidarsi del valore imparato.** Un costo medio ricavato da due
operazioni è peggio del valore tipico, e nessuno se ne accorgerebbe. Serve una soglia, e va
**mostrato quale dei due si sta usando** — «imparato da 37 operazioni» contro «valore tipico».

**2. Dove si applicano.** Oggi le commissioni esistono solo sulle posizioni MT5 vere. Vanno
aggiunte dove oggi non c'è niente: **storico, replay e rendimento delle sale**. È lì che la prop
firm fa i conti, ed è lì che un risultato senza commissioni è ottimista per costruzione.

**3. Che fine fanno nei numeri già scritti.** Aggiungere un costo cambia tutte le curve già
mostrate. Non è un difetto — è la ragione per cui si fa — ma va detto chiaramente, se no sembra
che qualcosa si sia rotto.

---

## 2. DUE ERRORI VERI, TROVATI CONFRONTANDO COL SITO FTMO

Vanno sistemati **prima** di aggiungere qualsiasi cosa: oggi ogni simulazione prop dà un
risultato sbagliato, e aggiungere one step/two step sopra un calcolo storto moltiplica l'errore.

### Errore 1 — il limite giornaliero è calcolato sulla base sbagliata

FTMO dice: *Maximum Daily Loss: **5% of the Initial Simulated Capital***, ricalcolato ogni giorno
alle 00:00 CE(S)T. Il **limite in euro è fisso**; quello che si azzera ogni giorno è il
**riferimento** da cui si misura.

L'app invece calcola il limite sul saldo di apertura di quel giorno:

| Dove | Codice |
|---|---|
| `checkPropFirmRules()` | `dailyLossLimit = propFirmDailyStartBalance * 0.05` |
| `pfMt5Metrics()` | `dailyLossLimit: dailyStart * 0.05` |
| `fblPropDedicataConta()` | `(g.start - g.min) / g.start * 100` |

**Conseguenza concreta.** Conto da 100.000, limite FTMO **5.000 euro al giorno, sempre**.
Se il conto è salito a 108.000, l'app concede 5.400 euro: **lascia passare una giornata che FTMO
avrebbe bocciato**. Se è sceso a 95.000, l'app concede 4.750: **boccia una giornata che FTMO
avrebbe accettato**.

### Errore 2 — nelle sale il drawdown massimo è trailing, ma il two step è statico

`fblPropDedicataConta()` misura il drawdown totale **dal picco raggiunto**:
`(peak - p.cap) / peak`. Ma nel **two step** FTMO il Maximum Loss è **statico**: 10% sotto il
capitale **iniziale**, e non si muove.

Un conto salito a 109.000 e poi sceso a 99.000 oggi risulta **violato** (−9,2% dal picco) mentre
FTMO lo considera **sanissimo** (è sopra il capitale iniziale).

> Curiosamente questa formula è quasi giusta per il **one step**, dove il massimo È trailing —
> ma trailing **sul saldo di fine giornata**, non sul minimo intraday. Quindi serve comunque
> riscriverla: una formula per il two step (statica) e una per il one step (trailing di fine
> giornata).

---

## 3. LE REGOLE FTMO VERE (lette dal sito il 27 ottobre 2026)

| | **One step** | **Two step — Sfida 1** | **Two step — Sfida 2** |
|---|---|---|---|
| Obiettivo di profitto | **10%** | **10%** | **5%** |
| Perdita giornaliera max | **3%** | **5%** | **5%** |
| Perdita totale max | **10% TRAILING** (sul massimo saldo di fine giornata) | **10% STATICO** | **10% STATICO** |
| Giorni minimi di trading | nessuno | **4** | **4** |
| Regola di costanza | miglior giorno ≤ **50%** del profitto | — | — |
| Limite di tempo | nessuno | nessuno | nessuno |
| **Quota del trader** | **90%** | **80%** (90% con lo Scaling Plan) | |

Tutti i limiti sono percentuali del **capitale iniziale**, e la perdita si misura su
**saldo + P/L aperto + swap − commissioni**.

Oggi l'app ha codificato **5% / 10% statico / obiettivo 10%**: cioè esattamente la **Sfida 1 del
two step**, e nient'altro.

---

## 4. COSA MANCA DAVVERO

| # | Cosa | Difficoltà | Nota |
|---|---|---|---|
| 1 | Le regole in **un oggetto solo** invece che sparse come numeri fissi | bassa | è il passo zero: senza questo niente altro si può fare |
| 2 | Scelta **one step / two step / personalizzata** | bassa | una volta fatto il punto 1 |
| 3 | **Seconda sfida** del two step | media | vedi la domanda sul ripartire da capo |
| 4 | **Trailing** del massimo per il one step | media | algoritmo nuovo: serve la serie dei saldi di fine giornata |
| 5 | **Giorni minimi (4)** | bassa | i giorni sono già contati in `fblPropDedicataConta` |
| 6 | **Regola di costanza** (one step) | bassa | serve il profitto per giornata, già disponibile |
| 7 | **Commissioni** nello storico, nel replay e nelle sale | **ALTA** | oggi esistono solo sulle posizioni MT5 vere (`p.commission`, `p.swap`) |
| 8 | **Tipo di conto** (personale / prop) alla creazione | media | tocca MT5, Kraken e i conti simulati |
| 9 | **Strategia di sala** sdoppiata normale / prop one / prop two | media | `stratLeggi(sala)` diventa `stratLeggi(sala, tipo)` |
| 10 | **Quanto ti spetterebbe** (90% / 80%) | bassa | una moltiplicazione, più il pop-up sul conto demo |

Il punto **7** è il vero lavoro: tutto il resto è contabilità.

---

## 5. DOVE SI TOCCA

- Motore e regole: `app.html` righe **~5500-5960** (`checkPropFirmRules` e dintorni)
- Conto MT5 vero: **~37250-37320** (`pfUsesRealMt5`, `pfMt5Metrics`)
- Sale segnali: **~49640-49760** (`fblPropDedicata*`), test in
  `laboratorio/app/prop_firm_cronologia.test.mjs`
- Strategia di sala: **~49436-49500** (`stratLeggi`, `stratSalva`, `stratDallaUi`),
  memoria in `localStorage['fbl_crono_strategia']`
- Scelta del conto: `fblContoVista` (riga **43579**), `fblContoEffettivo()`

**Attenzione:** Kraken ha già un suo "conto Prop" con regole DIVERSE (3% giornaliero alle 00:30
UTC, riga 1910). **Non è FTMO e non va unificato con la forza**: va tenuto separato, o
trasformato in un altro preset accanto a FTMO.

---

## 5-bis. DECISIONI DEL PROPRIETARIO (27 ottobre 2026)

**Commissioni — le due strade insieme.** Si parte da una tabella precompilata coi valori tipici
FTMO **espressi in percentuale**, e in parallelo si **imparano dal conto MT5 vero**: dalle
operazioni già chiuse si ricava il costo medio effettivo per strumento, che sovrascrive il valore
tipico quando c'è abbastanza storia.

> Da decidere in fase di scrittura: **quanti trade servono** su uno strumento prima di fidarsi del
> valore imparato invece di quello tipico, e **mostrare sempre quale dei due si sta usando** —
> un costo "imparato" da due operazioni sarebbe peggio del valore tipico, e nessuno se ne
> accorgerebbe.

**Consegna — a passi, correzioni per prime.** Prima i due errori del capitolo 2 e le regole
raccolte in un oggetto solo, con i test; poi il resto. Non si vede niente di nuovo, ma i calcoli
diventano giusti: è il passo che rende sensato tutto quello che viene dopo.

**Strategie di sala — quattro per sala:** normale, prop one step, prop two step **sfida 1**, prop
two step **sfida 2**. La sfida 2 chiede solo il 5% di obiettivo, quindi ha senso poterci
rischiare meno.

> Conseguenza sulla memoria: `fbl_crono_strategia` oggi è `{sala: cfg}` e diventa
> `{sala: {normale, prop1, prop2a, prop2b}}`. **Va previsto il passaggio dal vecchio formato**:
> una configurazione già salvata diventa quella "normale", e le altre tre partono da una sua
> copia invece che vuote — chi ha già impostato una sala non deve rifare tutto da zero.

---

## 5-ter. PASSO 2: LE REGOLE IN UN POSTO SOLO — come è disegnato

Oggi i numeri `5`, `10` e `10` sono **scritti dentro le formule**, in tre funzioni diverse. Finché
restano lì, «one step o two step?» non è una scelta: è una riscrittura.

### La forma

```js
const FBL_PROP_REGOLE = {
  'ftmo-1step': {
    nome:'FTMO one step',
    fasi:[ {nome:'Unica', obiettivo:10} ],
    perditaGiorno:3, perditaTotale:10, totaleInsegue:true,
    giorniMinimi:0, costanzaMaxGiorno:50, quotaTrader:90
  },
  'ftmo-2step': {
    nome:'FTMO two step',
    fasi:[ {nome:'Sfida 1', obiettivo:10}, {nome:'Sfida 2', obiettivo:5} ],
    perditaGiorno:5, perditaTotale:10, totaleInsegue:false,
    giorniMinimi:4, costanzaMaxGiorno:0, quotaTrader:80
  }
};
```

### Le quattro scelte, e il perché di ognuna

**1. Tutte le percentuali sono del CAPITALE INIZIALE, e lo si dice una volta sola.**
È l'errore appena corretto: lasciare che ogni formula decida da sola la base è il modo in cui è
nato. Qui la base è una proprietà del posto, non di chi legge.

**2. `fasi` è un ELENCO, e qui sta tutto il guadagno.**
Il one step è un elenco da uno, il two step da due. Così **non esiste nessun `if(oneStep)`**: lo
stesso codice percorre l'elenco e si ferma quando le fasi finiscono. Senza questo, ogni regola
andrebbe scritta due volte — e due copie divergono sempre, prima o poi.

**3. `totaleInsegue` è un interruttore, ma non basta.**
Il trailing del one step **insegue il saldo di FINE GIORNATA**, non il minimo toccato durante il
giorno. È una formula diversa, non un parametro diverso: serve una funzione sua, che l'interruttore
sceglie. Scriverlo come se fosse solo un flag sarebbe il terzo errore della stessa famiglia dei
due appena corretti.

**4. Il preset predefinito è `ftmo-2step`, fase 1.**
È esattamente quello che l'app fa oggi (5% / 10% statico / obiettivo 10%). Chi non tocca niente
non deve accorgersi di nulla: il passo 2 **non cambia nessun comportamento**, sposta solo dove
stanno i numeri. Ed è anche il modo di provarlo — a parità di impostazioni, gli stessi 19 test di
adesso devono restare verdi senza toccarne uno.

### Cosa NON entra nel passo 2

Giorni minimi, regola di costanza, trailing, seconda fase e commissioni **esistono come dato** ma
nessuno li legge ancora: arrivano al passo 3. Mescolarli qui vorrebbe dire non poter più dire
«non è cambiato niente», che è l'unica garanzia che rende sicuro questo passaggio.

---

## 6. COME LO FAREI, IN ORDINE

1. **Le due correzioni del capitolo 2** (base del limite giornaliero, drawdown statico), con i
   test che falliscono prima. Senza questo si costruisce su un calcolo storto.
2. **Un oggetto solo con le regole**, tre preset (one step, two step sfida 1, two step sfida 2) e
   la voce "personalizzata". Nessun comportamento nuovo: a parità di impostazioni l'app deve
   fare *esattamente* quello che faceva prima.
3. **Seconda sfida, giorni minimi, costanza, trailing.**
4. **Commissioni** (il pezzo grosso).
5. **Tipo di conto e strategia sdoppiata.**
6. **Quanto ti spetterebbe**, pop-up sul demo compreso.

I passi 1 e 2 si possono fare subito e non si vedono: a quel punto l'app è pronta e il resto
diventa configurazione.

Fonti: <https://ftmo.com/en/trading-objectives/> e
<https://ftmo.com/en/reward-growth-and-scaling-plan/>
