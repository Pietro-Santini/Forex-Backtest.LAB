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

## Ordine di lavoro

1. Le 4 esplorazioni (in corso) dicono dove agganciarsi.
2. Blocco C prima (riparazione, difetto confermato dal proprietario), poi D (difetto di scroll
   confermato), poi A+B (funzione nuova), poi E (verifica).
3. Ogni blocco: misura del difetto → causa → correzione → test verde → prova di controllo rossa.
4. Alla fine: bump `CACHE_NAME`, collaudo, APK, release (procedura di `cervello/PUBBLICARE.md`).
