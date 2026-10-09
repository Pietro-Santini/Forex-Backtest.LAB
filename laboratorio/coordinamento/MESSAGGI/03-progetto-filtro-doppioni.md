# 03 — Progetto: filtro anti-doppioni dei segnali

Archiviato dal **coordinatore** (unico scrittore di `app.html`) dal lavoro dell'agente D (sola lettura).
Le righe citate sono quelle attuali di `app.html` (dopo l'ONDATA 1).

## 1. Il problema
Una stessa idea di ingresso arriva **due volte** dalla stessa sala (o da due sale diverse) con parole
leggermente diverse: "BUY GOLD 4120 SL 4100 TP 4140" e "🟢 Oro long da 4119,5 target 4140 stop 4101".
Sono lo **stesso** ordine, ma il testo è diverso: chi si basa sul testo non li riconosce, e l'app apre
**due posizioni** dov'era una. Vale per l'apertura **automatica** (`tgAutoValuta`) e per quella
**manuale** dal pop-up (`tgEseguiSegnale`).

## 2. La regola
Due segnali sono lo **stesso doppione** se hanno:
- **strumento uguale** (confronto "normalizzato": solo lettere/cifre, senza prefisso di borsa —
  esiste già `fblStessoStrumento`, riga ~4093);
- **stessa direzione** (BUY/SELL). **Direzione opposta NON è un doppione**: è un'inversione, va aperta;
- **stesse fasce di prezzo di apertura**: le entrate/le fasce di entrata coincidono entro tolleranza;
- **stessi take profit**: la lista TP coincide (stesso numero di target e valori entro tolleranza).
- Lo **stop loss NON entra nell'impronta**: le sale lo scrivono in modi diversi pur essendo lo stesso
  ordine, e comunque due entrate con gli stessi TP sono lo stesso trade. (Da riconfermare col
  proprietario in fase di realizzazione: se vuole lo stop nell'impronta, si aggiunge.)

Le **parole del messaggio non contano**: si confrontano solo i numeri sopra.

## 3. L'impronta (chiave di confronto)
Costruirla in una funzione pura nuova (es. `fblImprontaSegnale(seg)`) che restituisce:
- `sym` normalizzato con `fblStessoStrumento`;
- `side` (BUY/SELL);
- `entrate` = `[seg.entrata, seg.entrata_max]` (o fascia) filtrate/normalizzate;
- `tp` = `(seg.take_profit||[]).map(Number).filter(Number.isFinite)` ordinati.

Il confronto è **a tolleranza**, non a uguaglianza esatta, perché i prezzi arrivano con arrotondamenti
diversi. La tolleranza riusa la misura naturale già esistente:

```
tolleranza = fblTolleranzaEntrata(posizione) * 0.5      // metà dell'attuale, più stretta
```

`fblTolleranzaEntrata` (riga ~4156) vale `15%` della distanza entry→stop (o `0,05%` del prezzo senza
stop). Il fattore `0,5` la rende più selettiva: due segnali sulla stessa fascia, non due vicini per caso.

## 4. Con quali cose si confronta (le fonti reali)
Un segnale in arrivo è doppione se **una di queste** contiene già lo stesso trade:

| Fonte | Dove vive | Note |
|---|---|---|
| Posizioni simulate/backtest | `positions[]` (riga ~3808) | hanno `asset, side, entry, tp` e i metadati `tgSala/tgGruppo` |
| Ordini pendenti | `pendingOrders[]` (riga ~3808) | stessi campi |
| Posizioni reali MT5 | lista adottata da `fetchMt5Positions` (~29800) | hanno `mt5Ticket`; il confronto usa prezzo/TP letti dal broker |
| Posizioni reali Kraken | `krakenPosizioni.posizioni` (~35849) | conto cripto: campo `simbolo` + lato/mark |
| Registro strategie | `tgStrategie` (righe ~25011, ~27448) | per Kraken è **l'unico posto** dove vive una posizione aperta (`conto:'kraken'`, ~36684): va incluso, altrimenti su Kraken il doppione sfugge |
| Segnali già eseguiti | `tgSegnaliRicevuti` con `stato==='eseguito'` (~23547) | copre il caso "già aperto pochi istanti fa, non ancora riletto dal conto" |

## 5. Direzione opposta
SELL su un asset con un BUY già aperto **non** è doppione: è un'inversione voluta. Il filtro blocca
solo **stessa direzione**. (Da esplicitare nel test.)

## 6. Esenzioni
- `voce.sottotipo === 'aggiunta'` (raddoppio/aggiunta dedotta): **esente** dal filtro. È già gestita a
  parte e non si apre mai da sola (riga ~25677). Il filtro non deve bloccarla due volte.
- `voce.sottotipo === 'seconda_entrata'`: **esente**. È per definizione un'aggiunta sulla stessa idea
  (riga ~24536): bloccarla ucciderebbe la strategia della sala.
- Un segnale **senza TP** (livelli calcolati dall'app, `p.senzaLivelli`): il confronto sui TP non è
  possibile → si confronta solo strumento+direzione+fascia di entrata, con la stessa tolleranza.

## 7. Finestre temporali
- **Alla ricezione** (freno anti-raffica): un doppione dello **stesso messaggio ripetuto** si riconosce
  entro **3 minuti** (`FBL_POS_FINESTRA_MS`, riga ~4155) — è il tempo di una raffica di ripetizioni.
- **Contro i già eseguiti**: la ricerca in `positions/pendingOrders/tgStrategie/segnali eseguiti` guarda
  le **ultime 6 ore** (una posizione ancora aperta è comunque un doppione, anche se più vecchia: la
  finestra serve solo a non confrontare con roba chiusa da giorni).

## 8. Dove innestarlo
1. **Automatico** — dentro `tgAutoValuta` (riga ~26156) **prima** di aprire, oppure meglio dentro
   `tgAutoDecidi` (riga ~25640), accanto al blocco esistente `sottotipo==='aggiunta'` (~25677): se è
   doppione → `no('è un doppione di ... già aperto da ...')` con `voce.autoMotivo` (così si legge nella
   scheda del pannello).
2. **Manuale** — dentro `tgEseguiSegnale` (riga ~27310) subito dopo il calcolo del piano e **prima** di
   aprire: se è doppione, avviso chiaro con **conferma esplicita** ("sembra lo stesso trade di X già
   aperto: apro lo stesso?"). Il manuale non si blocca di netto: l'utente può voler raddoppiare a mano.

**Nessuna modifica al ponte Python**: il filtro è solo lato app. Il ponte (`parser_segnali.py`,
`segnali_bridge.py`) continua a consegnare tutti i messaggi; è l'app a decidere. Così la diagnostica
resta vera e non si perde nessun messaggio.

## 9. Test proposti (test-first, in `laboratorio/app/`)
Nuovo file `laboratorio/app/filtro_doppioni.test.mjs`. Deve **prima fallire** e poi passare:
1. **Stesso doppione, testo diverso**: BUY XAUUSD 4120 SL 4100 TP 4140 vs "oro long 4119,8 target
   4140 stop 4101" → il secondo **non** apre (né in auto né in manuale senza conferma).
2. **Direzione opposta**: SELL XAUUSD con BUY XAUUSD già aperto → **apre** (non è doppione).
3. **TP diversi**: BUY XAUUSD TP 4140 con già aperto BUY XAUUSD TP 4160 → **apre** (target diversi,
   non è lo stesso trade).
4. **Fuori tolleranza**: entrate 4120 vs 4130 (oltre la tolleranza) → **apre**.
5. **Esente `seconda_entrata`**: lo stesso trade con `sottotipo:'seconda_entrata'` → **apre**.
6. **Kraken via `tgStrategie`**: doppione di una posizione Kraken registrata in `tgStrategie` → **non**
   apre.
7. **Attraverso due sale diverse**: stesso trade da sala A e sala B → **non** apre il secondo (la
   richiesta esplicita dice di bloccare anche fra sale).
8. **Manuale con conferma**: dal pop-up, doppione → compare l'avviso e, confermando, apre.

## 10. Punti d'innesto (riferimenti di riga attuali)
- `fblTolleranzaEntrata` ~4156 · `FBL_POS_FINESTRA_MS` ~4155 · `fblStessoStrumento` ~4093
- `positions[]`/`pendingOrders[]` ~3808 · `sessionByMode` ~4511
- `tgSegnaliRicevuti` ~23547 · scadenza/seppellimento ~24224-24249
- `tgStrategie` ~25011 / salvataggio ~25013 / uso Kraken ~36684
- `tgChiaveSala` ~25611 · `tgAutoDecidi` ~25640 (gancio `sottotipo` ~25677) · `tgAutoAperte` ~25585
- `tgContoPerSegnale` ~25506 · `tgContoEffettivoPerSegnale` ~25534
- `tgAutoValuta` ~26156 · `tgAutoInCoda` ~26127 · `meta` delle posizioni ~27410
- `tgEseguiSegnale` ~27310 (/gancio manuale) · pop-up conferma ~24993-25002
- `krakenPosizioni` ~35849 · `fetchMt5Positions` ~29800

## 11. Punti aperti da riconfermare col proprietario
- Il **SL** va nell'impronta? (proposta: no)
- Il manuale: blocco netto o **avviso+conferma**? (proposta: avviso+conferma)
- Finestra "già eseguiti": 6 ore proposta, o "solo se ancora aperta"?
