# Divisione del grafico — decisioni del proprietario e misure

Scritto il 16 novembre 2026, subito dopo le risposte del proprietario. Le misure sono in
`cervello/INDAGINE-DIVISIONE-GRAFICO.md` (sola lettura, fatta il 15 novembre): qui restano le
**decisioni**, che sono sue, e i **rischi** che le sue scelte portano con sé, dichiarati prima di
scrivere una riga di codice.

## 1. Cosa ha chiesto
> «Più grafici affiancati nella stessa finestra.»

## 2. Le sue decisioni (parole sue, 15 novembre 2026)

| domanda | risposta del proprietario |
|---|---|
| quanti riquadri | «l'utente può scegliere la diapositiva dei grafici, 1x1, 1x2, fino a un massimo di 2x2» |
| stesso asset in due riquadri | «Sì, entrambi operano» |
| mirino e replay fra i riquadri | «Sì, stessa regola delle finestre» |
| staccare un riquadro in una finestra | «i riquadri li possiamo cambiare di posizione tra un riquadro e l'altro, se ho una suddivisione quindi un grafico a destra e uno a sinistra posso trascinare uno dei due e fargli cambiare la posizione, quindi su 4 suddivisioni se trascino un riquadro sopra un altro riquadro dei 4 cambiano la posizione, questo per tutte suddivisioni possibili» |
| footprint e watchlist | «il footprint semplicemente viene stampato dalle altre pagine che lo contengono già, viene trasmesso in tempo reale e viene fatto un copia incolla; per quanto riguarda asset diversi invece ognuno è indipendente dall'altro ovviamente. La watchlist rimane la stessa per tutti i riquadri e finestre» |

Quindi: **layout a scelta fra 1x1, 1x2 e 2x2**, riquadri **trascinabili** per scambiare la posizione,
**stesso asset permesso su più riquadri**, mirino e replay con la regola già usata fra le finestre,
footprint come già funziona nelle pagine che ce l'hanno, watchlist unica per tutti.

## 3. I rischi che queste scelte portano, dichiarati

1. **«Entrambi operano» sullo stesso asset: la stessa posizione può essere chiusa due volte.** Non è
   un'ipotesi: è un difetto già visto fra le finestre duplicate, e la guardia che lo impedisce
   (`anotherWindowOwnsAssetEvaluation`, `app.html` ~9493: valuta SL/TP solo lo slot più basso) esiste
   già. Con i riquadri va **replicata**, altrimenti due riquadri sullo stesso asset valutano lo stesso
   stop e chiudono due volte. **CHIARITO col proprietario il 16 novembre 2026**: «Giudica solo il
   riquadro attivo». Tutti i riquadri disegnano e si aggiornano; stop, target e tutto ciò che
   valuta una posizione girano **solo nel riquadro sotto il cursore**. La guardia da replicare è
   `anotherWindowOwnsAssetEvaluation` (`app.html` ~9493), che oggi conta le **finestre**: va resa
   capace di contare anche i **riquadri** della stessa finestra.
2. **Trascinare un riquadro sopra un altro** è una nuova interfaccia (non esiste nulla del genere nel
   progetto) e va misurata: bersaglio piccolo = difetto già pagato qui («funziona col mouse ma non col
   dito», ottobre 2026). Serve bersaglio ampio, conferma visibile, e un annullo.
3. **Il footprint duplicato costa memoria**: misurati 1.350 MB e 1.042.311 tick con 7 asset aperti
   (`LEZIONI.md`). La decisione «footprint come nelle altre pagine» va interpretata come: **uno solo
   attivo**, nel riquadro sotto il cursore, non due calcolati insieme.
4. **Il tetto dei riquadri non è misurabile oggi**: l'ultima misura del disegno è del 12 novembre
   (64,44 ms, 4,7 fps) e le cure del 13 novembre non sono state rimisurate. Con 4 riquadri quel
   numero va moltiplicato per quattro: **prima di scrivere codice si rimisura**.
5. **`PIP_SLOT` non è riusabile dentro la pagina**: 91 occorrenze, 43 funzioni, ma 11 guardie
   `if(PIP_SLOT>0)return`. Isola lo stato **per finestra**, non per riquadro: due riquadri in pagina
   non possono ereditarlo.

## 4. La strada raccomandata dall'indagine (confermata, a freddo)
Strada A fatta in piccolo: **due riquadri** (1x2), solo la parte di **vista** resa per riquadro, con
una fotografia di 37 campi, `draw()` che gira su un contesto scelto invece che sui globali, e le zone
di presa dei clic separate. Non toccare `draw()` per prima. La strada B (finestre `<iframe>`) isola
meglio ma duplica RAM e canale, e la strada C (due finestre del browser affiancate) è già possibile
con «Duplica finestra».

## 5. Cosa misurare prima di scrivere codice

### MISURATO dal proprietario il 16 novembre 2026, ore 00:14, versione 2.2.59 in Live
Questi numeri sono **dopo** le cure del 13 novembre e chiudono il punto aperto n. 1.

| numero | valore | cosa dice |
|---|---|---|
| `fotogrammiAlSecondo` | **59** | la macchina tiene il fotogramma: il grafico non è al limite |
| `scatti` / `scattoPeggiore_ms` | 2 / **343 ms** | due sporgenze in 5 secondi, da spiegare prima di moltiplicare il disegno |
| `disegni` / `disegnoMedio_ms` | 8 / **12,81 ms** | il disegno del grafico costa 12,81 ms di media |
| `draw` (pannello traffico) | 313 giri, media **23 ms**, peggiore **343 ms** | il disegno «intero» costa il doppio della sezione misurata: la differenza è nei pezzi sotto |
| `pezziDelDisegno_ms` (totale 59 ms) | `checkPropFirmRules` **24** · `applyMt5AccountStatsToPanel` **21** · `statsTrades` 7 · resto ≤2 | **45 ms su 59, cioè il 76% del giro, non è il grafico**: sono i due pannelli |
| `aggiornamentoMedio_ms` | 4,84 | |
| `memoria_MB` | 163 | con 50.015 candele, 527.159 tick di footprint, 2.664 bucket |
| cloud oggi | 34 scritture, 15 letture, 13,2 MB | dentro le quote con margine largo |
| risposta servizi | Ordini 36 ms · Grafico 15 ms · Segnali (server) 25 ms | nessun collo di bottiglia locale |

**Cosa ne consegue, misurato:**
- **2 riquadri (1x2) sono fattibili oggi**: 12,81 × 2 ≈ 26 ms, e il giro intero resterebbe sotto i 60
  fps. Il suo 2x2 invece porterebbe il disegno a ~51 ms e il giro a ~95 ms → **12-20 fps**, troppo.
- **La strada più corta non è rendere il grafico più magro: è curare i due pannelli.** `checkPropFirmRules`
  e `applyMt5AccountStatsToPanel` costano 45 ms su 59 e non dipendono dal numero di riquadri: curarli
  (o facendoli girare quando servono invece che a ogni giro) libera il budget per 4 riquadri. Con quei
  due a ~5 ms, 4 riquadri stanno in ~41 ms → 24 fps, e 2 riquadri in ~26 ms.
- **Da spiegare prima di moltiplicare**: i due `scattoPeggiore_ms` da 343 ms. Uno scatto ogni 2,5
  secondi moltiplicato per quattro riquadri diventa un fermo visibile.

**DA VERIFICARE, detto chiaro:** nei `tempiPonte` del pannello compaiono `lettura conto: 12784 volte`,
`fetchMt5Positions: 12368`, `fetchMt5Orders: 12368`. Se quei contatori sono **del periodo di 5
secondi**, sono ~2.500 letture al secondo e sarebbe un difetto da aprire subito (la cura del 15
novembre aveva portato il ponte a ~27 letture in 6 secondi con una finestra); se sono **dall'apertura
della pagina**, la media di 13 ms è normale e non c'è niente da fare. La misura non distingue le due
cose: va guardato se il contatore si azzera periodo per periodo.

### Resta aperto
1. Se due finestre duplicate stiano su **due processi** distinti del browser (Task Manager o
   `about:processes`): decide fra strada A e strada B.
2. Quanto del disegno dipenda davvero da `assetChartViews`/`assetDrawings` invece che dai globali.
3. La causa dei due scatti da 343 ms.

## 6. Stato
**Non ancora iniziato.** Nessuna riga di codice scritta. Questo documento è il punto d'ingresso.