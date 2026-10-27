# Progetto: modalità BACKTEST nel replay + pulizia grafico + gesti

Richiesto dal proprietario il 27 ottobre 2026. Quattro blocchi indipendenti, ognuno con il suo test.
Regola del progetto: **il test misura il comportamento, non cerca una stringa nel sorgente** (vedi
`cervello/REGOLE.md`). Ogni blocco va chiuso con una prova di controllo: rimessa la versione di
prima, il test deve diventare ROSSO.

---

## Blocco A — Pulsante "Attiva modalità backtest" nel replay

**Che cosa si vede.** Nella barra del replay, tra il pulsante «Nuova posizione» e lo stop del replay,
compare un pulsante «Attiva modalità backtest». Premendolo il replay passa al **conto dello storico**:
da lì in poi le operazioni si aprono come in un backtest su file CSV caricato da noi.

**Che cosa cambia dentro.**

1. Le posizioni dell'account MT5 **non vengono più caricate**: non compaiono a grafico, non entrano
   nelle tabelle. Resta soltanto quello che si apre da lì in poi dentro la modalità backtest.
2. Le nuove posizioni del backtest si comportano come quelle del conto storico: **freccia di apertura**,
   **linea che collega il punto di apertura al prezzo del momento**, e restano leggibili il **prezzo di
   apertura** e il **prezzo di chiusura**, come se si stesse davvero nel conto storico.
3. Uscendo dalla modalità backtest (stesso pulsante, ora «Disattiva») le posizioni MT5 tornano a
   caricarsi normalmente; le posizioni aperte nel backtest restano dov'erano, marcate come backtest.
4. Stato nuovo da memorizzare nelle preferenze: chiave dedicata (es. `replayBacktestAttivo`), così
   sopravvive al riavvio della pagina.

**Dove si aggancia.** Hook all'entrata/uscita del replay + filtro del caricamento posizioni MT5 +
`positionBelongsToCurrentView` (la posizione MT5 reale deve sparire quando la modalità è attiva).

**Test (comportamento).**
- A1: con la modalità backtest attiva, una posizione MT5 reale presente nella fotografia del ponte
  **non** compare fra le posizioni visualizzate (`positionBelongsToCurrentView` falso) e **non**
  viene aggiunta a `positions[]`.
- A2: disattivandola, la stessa posizione torna visibile.
- A3: in modalità backtest, una nuova posizione aperta ha la freccia e la linea al prezzo del momento
  (misurato: esiste il punto di ancoraggio dell'apertura e il secondo punto al prezzo mostrato), con
  prezzi di apertura/chiusura non nulli.
- A4: preferenza salvata e riletta: la modalità resta attiva dopo un ripristino di sessione.

---

## Blocco B — Rettangolino "Modalità backtest attiva" + informazione

**Che cosa si vede.** Quando la modalità è attiva, sul grafico compare un rettangolino nella **stessa
posizione** del riquadro «mercato chiuso», **spostato leggermente sopra**, così i due non si
sovrappongono se il mercato è chiuso. Scritto: «Modalità backtest attiva».

Passandoci sopra col mouse compare un'informazione che dice che **la modalità backtest non influisce
sulle posizioni in tempo reale**.

**Test (comportamento).**
- B1: attivata la modalità, l'elemento è visibile e il suo bordo superiore sta **sopra** il bordo
  inferiore dell'elemento «mercato chiuso» (misurato in pixel, non "è spostato un po'").
- B2: disattivata, l'elemento sparisce.
- B3: al passaggio del mouse compare l'informazione con la frase «non influisce sulle posizioni in
  tempo reale».

---

## Blocco C — Etichette raggruppate (da riparare, è già stato fatto ma non funziona)

**Che cosa deve fare.** Quando più posizioni hanno la linea di prezzo (o TP/SL) allo stesso livello,
si vede **una sola etichetta**. Cliccando quell'etichetta si **espande** e mostra tutte le altre.
Cliccando su un punto vuoto del grafico tornano **raggruppate**.

Il proprietario conferma che oggi **non funziona**: continua a vedere tutte le etichette una vicina
all'altra. Questo blocco è una **riparazione**, non una funzione nuova: prima si misura il difetto,
poi si trova la causa, poi si corregge con il test.

**Test (comportamento).**
- C1: con N posizioni allo stesso livello di prezzo, le etichette disegnate sono **1** (misurato
  contando le etichette effettivamente disegnate sul canvas, non leggendo il codice).
- C2: dopo il click sull'etichetta raggruppata, le etichette disegnate diventano N.
- C3: dopo un click su un punto vuoto del grafico, tornano a 1.
- C4 (prova di controllo): senza la correzione, C1 deve essere ROSSO.

---

## Blocco D — Gesti: pagina normale / fullscreen / PIP

**Regola del proprietario, da rispettare alla lettera.**

| Contesto | 1 dito | 2 dita |
|---|---|---|
| **Pagina normale** (né fullscreen né PIP) | **scorre la pagina** (non tocca il grafico) | **sposta il grafico** (pan) |
| **Schermo intero** oppure **PIP** | **sposta il grafico** (pan) | **zoom**: pinch verticale = zoom verticale, pinch orizzontale = zoom orizzontale, **isolati** |

Nella pagina normale lo zoom **non è presente** (come oggi). Nelle due modalità lo zoom c'è, e i due
assi sono isolati: un pinch verticale non deve muovere l'orizzontale e viceversa.

**Difetto segnalato oggi.** Sulla pagina principale, scorrendo con un dito sopra il grafico, la pagina
**non scorre più**: il tocco resta agganciato al grafico. Da misurare e correggere.

**Test (comportamento).**
- D1: in pagina normale, un tocco-trascinamento a un dito che parte dal grafico fa salire lo scroll
  della pagina (misurato) e NON sposta la vista del grafico.
- D2: in pagina normale, due dita spostano la vista del grafico.
- D3: in fullscreen, un dito sposta la vista del grafico.
- D4: in fullscreen, un pinch verticale cambia solo lo zoom verticale (l'orizzontale invariato) e un
  pinch orizzontale cambia solo quello orizzontale.
- D5: in PIP valgono D3 e D4 (stessa regola del fullscreen).
- D6: tornando alla pagina normale, un dito non sposta più il grafico.

---

## Blocco E — Verifica ancoraggio dei disegni

**Che cosa deve fare.** I disegni (linee, rettangoli, frecce, note) **non si devono spostare mai**:
restano agganciati alla candela, al prezzo e al timestamp, sia cambiando timeframe sia cambiando asset.

Questo blocco è una **verifica** (il proprietario chiede «piccola verifica»): misurare se oggi si
spostano, e se sì correggere.

**Test (comportamento).**
- E1: creato un disegno a un dato timestamp e prezzo, cambiando il timeframe il punto disegnato cade
  sullo **stesso timestamp** (errore tollerato: zero candele di scarto, misurato in tempo).
- E2: cambiando asset e tornando indietro, il disegno è al suo posto (i disegni sono per-asset).
- E3: cambiando timeframe, il prezzo del disegno resta quello (la coordinata verticale non slitta di
  N pip).

---

## Blocco C — ETICHETTE RAGGRUPPATE: FATTO il 27 ottobre 2026

**Il difetto misurato prima di toccare il codice** (sonda sul banco, `fillText` del canvas):
quattro posizioni con lo **stesso** target (4200.00000) ma riempite in istanti diversi
producevano **quattro** etichette sovrapposte sulla stessa riga. La regola di raggruppamento
era l'identità dell'intera casella (`asset|entrata|stop|target|orario|span`): due posizioni
riempite in momenti diversi non coincidevano **mai**, e l'anti-sovrapposizione le accatastava
una sotto l'altra.

**Tre cause distinte, tutte trovate e curate:**

1. **Nessuna tolleranza sulla regola di coincidenza.** Aggiunto un secondo livello di
   raggruppamento per **riga di pixel** (stessa linea di prezzo), con due mappe separate
   Target e Stop perché i due livelli sono indipendenti. Costante
   `FBL_TOLLERANZA_RIGA_ETICHETTA=8` px. Solo il "capo fila" della riga disegna l'etichetta;
   la **linea** del livello resta per tutte, quindi il prezzo continua a vedersi. Il gruppo
   della casella identica (con i suoi totali) ha la precedenza su quello della riga, così non
   si contano due volte le stesse posizioni.
2. **Il click col mouse era un buco morto.** Il toggle di espansione era scritto solo nel ramo
   `if(e.pointerType==='touch')`. Ora mouse e penna fanno la stessa cosa del dito, con lo
   stesso criterio (conta solo se il puntatore non si è spostato). **Causa seconda, trovata
   misurando:** l'etichetta ×N è disegnata *dentro* la striscia dell'asse prezzi, quindi il
   click col mouse finiva nel ramo "zoom verticale" e non arrivava mai all'etichetta. Ora se
   sotto il puntatore c'è un'etichetta, l'etichetta ha la precedenza sullo zoom.
3. **La ricomposizione al click sul vuoto non ridisegnava.** `expandedTpSlGroups.clear()` era
   seguito da `draw()` solo se c'era qualcosa di selezionato: senza selezione, le etichette
   restavano espanse a occhio fino al primo tick/pan/zoom. Ora si ridisegna sempre.

**Test:** `laboratorio/app/etichette_livello_prezzo.test.mjs` (3 prove).
Misura il comportamento con `fillText` del canvas reale.
- C1: 4 posizioni sullo stesso target, riempimenti diversi → **1** etichetta con `×4`.
- C2: click col **mouse** sull'etichetta → espansione; click sul vuoto, sempre col mouse → torna 1.
- C3 (prova di controllo): due target lontani restano due etichette numerate.
Prova di controllo fatta: rimessa la versione di prima, C1 era ROSSO (4 etichette).

**Commento sistemato:** il commento sopra il gruppo descriveva ancora il pulsante
"Esplodi etichette", che non esiste più (era stato rimosso).

---

## Blocco D — Gesti: pagina normale / schermo intero / PIP. FATTO il 27 ottobre 2026

**La regola del proprietario, ora scritta nel codice:**

| Contesto | 1 dito | 2 dita |
|---|---|---|
| **pagina normale** | **scorre la pagina** — non tocca il grafico | sposta il grafico (pan) |
| **schermo intero** e **finestra staccata/PIP** | **sposta il grafico** | **zoom isolato per asse** |

**Cosa è stato trovato misurando.** Nel banco, con un punto libero del grafico, la pagina
*scrollava già* (`touch-action:pan-y` era corretto e nessun handler la bloccava): il difetto
«la pagina non scorre» **non si è riprodotto** in nessuno dei casi provati (dito libero, dito
sopra una linea TP/SL, subito dopo un pinch a due dita). La regola però era **fragile**: lo
scroll dipendeva da `touch-action` e da una decina di `preventDefault` sparsi (linea TP/SL,
disegno, piazzamento SL/TP, penna). Se uno di quelli scattava nel momento sbagliato, la pagina
restava agganciata al grafico.

**Cura (rende la regola garantita invece che casuale):**
1. In pagina normale i `preventDefault` **preventivi** (toccare una linea TP/SL o un disegno
   senza aver ancora iniziato niente) **non bloccano più** lo scroll. Restano quelli di un
   gesto deliberato: piazzamento SL/TP armato, penna, utensile di disegno scelto.
2. In schermo intero/PIP **un dito sposta il grafico** su tutti e due gli assi
   (`pointermove` del ramo touch ora applica il pan quando è attivo: prima usciva subito e il
   pan a un dito non era possibile).
3. In schermo intero/PIP **due dita fanno lo zoom, isolato per asse**: la distanza *orizzontale*
   fra le dite cambia solo quante candele si vedono, quella *verticale* solo la scala dei prezzi.
   Sulla pagina normale due dita restano lo spostamento libero di sempre.

**Test:** `laboratorio/app/gesti_pagina_fullscreen.test.mjs` (4 prove, eventi touch **veri** via
CDP — è lo scroll nativo del browser ciò che si misura).
- pagina normale: 1 dito → `window.scrollY` cambia **e** `viewEnd` non si muove.
- schermo intero: 1 dito → `viewEnd` si muove; pinch verticale → `priceZoomFactor` cambia e
  `visibleCount` no; pinch orizzontale → `visibleCount` cambia e `priceZoomFactor` no.
- finestra staccata/PIP: stessa regola dello schermo intero (via `floatingWin`).
- tornati sulla pagina normale: 1 dito non sposta più il grafico.

**Prova di controllo:** il test sullo schermo intero era ROSSO prima della cura
(`viewEnd 300 -> 300`: il pan a un dito non partiva). Nel banco il difetto D1 del proprietario
non si riproduce, quindi quel test è una **garanzia** della regola, non una prova di un difetto
riprodotto: se un giorno la pagina smette di scorrere, quel test lo dice.

---

## Blocco A+B — MODALITÀ BACKTEST nel replay. FATTO il 27 ottobre 2026

**Il pulsante.** Nella barra del replay, **tra «Nuova posizione» e lo STOP**, c'è ora
«🧪 Modalità backtest». Compare solo **dentro** il replay (fuori non c'è niente da backtestare).
Premendolo si accende, premendolo di nuovo si spegne; il testo del pulsante dice in che stato è.

**Cosa cambia dentro, quando è accesa.**
- Le posizioni dell'account MT5 **non vengono caricate**: il filtro in `fetchMt5Positions`
  (punto in cui le posizioni esterne venivano adottate) è chiuso, non è solo un nascondiglio a
  schermo. Misurato con la fotografia del ponte finta.
- A grafico entra **soltanto ciò che si apre da lì in poi**: `positionBelongsToCurrentView` in
  modalità backtest risponde vero solo per le posizioni marcate `backtest`. Le posizioni MT5 e
  quelle aperte prima nel replay spariscono.
- Le nuove posizioni nascono già col pieno corredo del conto storico: **freccia di apertura**,
  **linea che segue il prezzo del momento**, **prezzi di apertura e chiusura**. Non è codice
  nuovo: è il percorso delle posizioni simulate, che ora il filtro lascia passare.
- La preferenza è **persistita** (`localStorage`, chiave `fbl_replay_backtest`) e ha il suo
  **interruttore in Impostazioni → 🔁 Replay**, che è lo stesso interruttore del pulsante (uno
  comanda, l'altro mostra lo stato).

**Il rettangolino.** «🧪 Modalità backtest attiva» comparie in basso a destra, nella **stessa
posizione** del riquadro «mercato chiuso», **spostato sopra di un'intera altezza più 6 px** di
stacco, così i due non si sovrappongono se il mercato è chiuso. Passandoci sopra col mouse
compare il fumetto che dice la cosa che conta: *«le operazioni che apri qui non influiscono sulle
posizioni in tempo reale»*. Col dito il fumetto non compare (non c'è hover).

**Test:** `laboratorio/app/modalita_backtest.test.mjs` (4 prove).
- Il pulsante esiste, sta **fra** «Nuova posizione» e lo STOP (misurato sull'ordine dei fratelli),
  si vede dentro il replay, e il click accende/spegne salvando la preferenza.
- Accesa: posizione MT5 → invisibile; posizione vecchia del replay → invisibile; posizione del
  backtest → visibile; a grafico ne passa **una sola**. Spenta, il comportamento di prima è
  **intatto** (nessuna regressione).
- La posizione nuova è marcata, senza ticket MT5, con apertura/stop/target, e la sua freccia di
  apertura viene disegnata.
- Il rettangolino: spento non c'è, acceso c'è, sotto di lui resta lo spazio del riquadro «mercato
  chiuso» (misurato in pixel), e al mouse il fumetto dice «non influiscono sulle posizioni in
  tempo reale».

---

## Blocco E — Verifica ancoraggio disegni. CHIUSO il 27 ottobre 2026

**L'architettura era già corretta** (verificato in sola lettura prima di toccare niente): i disegni
sono ancorati a **timestamp assoluto in millisecondi + prezzo**, senza indici di candela, e al
cambio timeframe `dataPosFromTime()` colloca l'istante alla frazione giusta dentro la candela
nuova. Il test che copriva il cambio di timeframe passava già (2 prove, misurate sul timestamp).

**Due cose sono state chiuse lo stesso:**
1. Il commento sopra `fblDisegniRiAgganciaAlTf()` descriveva il **vecchio** comportamento (il
   riaggancio forzato alle candele, che *era* il difetto) contraddicendo il codice. Ora spiega
   perché il no-op è la cura, e rimanda al test.
2. Il cambio di **asset** non era coperto da nessun test. Aggiunto
   `laboratorio/app/disegni_cambio_asset.test.mjs` (2 prove): uscendo da un asset e rientrando il
   disegno è **identico al millisecondo e al prezzo**, e un giro fra tre asset consecutivi non lo
   degrada.

**Resto annotato, non toccato:** il tipo di disegno `vpfixed` (profilo volume a numero fisso di
candele) riscrive il proprio `p2.time` al cambio di timeframe, perché per quel tipo il numero di
candele è più importante dell'intervallo di tempo. È una scelta dichiarata nel codice, non un
difetto: cambiandola si altererebbe il profilo volume. Per i disegni normali (linee, rettangoli,
fib, note) l'ancoraggio è solido e coperto dai test.

---

## Ordine di lavoro

1. Le 4 esplorazioni (in corso) dicono dove agganciarsi.
2. Blocco C prima (riparazione, difetto confermato dal proprietario), poi D (difetto di scroll
   confermato), poi A+B (funzione nuova), poi E (verifica).
3. Ogni blocco: misura del difetto → causa → correzione → test verde → prova di controllo rossa.
4. Alla fine: bump `CACHE_NAME`, collaudo, APK, release (procedura di `cervello/PUBBLICARE.md`).
