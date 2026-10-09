# BACHECA DI COORDINAMENTO — Forex Backtest LAB

Questo file è la **regia**. Lo tiene e lo aggiorna solo il **coordinatore** (l'agente principale).
Gli altri agenti lo LEGGONO prima di cominciare e **non** lo modificano.

## Regole della squadra
- **Un solo scrittore su `app.html`**: il coordinatore. Gli agenti non toccano mai `app.html`.
- Gli agenti di esplorazione sono **sola lettura** su tutto il resto.
- Il **passa parola** sta nella cartella `MESSAGGI/`: ogni agente riceve nei propri compiti i messaggi
  già prodotti (estratti), così le informazioni passano da un agente all'altro senza che si pestino i piedi.
- Ogni report di agente viene archiviato qui dal coordinatore come `MESSAGGI/NN-<tema>.md`.
- Prima di dichiarare "fatto" un bug: un test in `laboratorio/` che **prima falliva** e **ora passa**,
  poi `node laboratorio/strumenti/sintassi_app.mjs` e `bash laboratorio/collauda.sh` fino a "Falliti: 0".

## Stato
- **ONDATA 0 — FATTA**: Passo 13 (instradamento segnali + famiglia Capital.com nel Trade Journal).
  Collaudo completo **verde** (`Falliti: 0`), versione `v113` / `1.0.113`.
- **ONDATA 1 — IN CORSO**:
  1. Difetto segnalato: *"aperto automaticamente da un altro dispositivo"* → **risolto**: l'apertura
     automatica la fa **solo il computer** (`tgSonoIlComputer`), senza più controllare gli altri dispositivi.
  2. Errore latente del passo 13: nel ramo Capital.com di `tgAutoValuta` si usava `sym` prima della
     dichiarazione (TDZ) → l'apertura **automatica** Capital.com andava in errore. **Risolto** (`let sym` in cima).
  3. **NUOVO**: filtro anti-doppioni dei segnali → **REALIZZATO** (versione `v116` / `1.0.116`).
     Funzioni pure nuove `fblDedupTp`/`fblDedupStesso`/`fblDedupMotivo`, inserite dopo `fblPosStessoIngresso`.
     Gancio AUTOMATICO in `tgAutoDecidi` (ritorna `no('doppione: …')`); gancio MANUALE in
     `tgEseguiSegnale` (avviso nel riepilogo + conferma esplicita già presente). Confronta:
     `positions` (tp **scalare**), `pendingOrders` (tp **scalare**), `tgStrategie` (`tps` **array**),
     `krakenPosizioni` (tp array di `{prezzo}`), `tgSegnaliRicevuti` eseguiti (`take_profit` **array**).
     Tolleranza `fblTolleranzaEntrata×0,5`. Esenti `aggiunta` e `seconda_entrata`.
     Progetto: `MESSAGGI/03`. Test: `laboratorio/app/filtro_doppioni.test.mjs` (7 casi; prima rossi,
     ora **7/7 verdi**) e test d'innesto `laboratorio/app/filtro_doppioni_auto.test.mjs` (2 casi sul
     `tgAutoDecidi` VERO, prima rossi, ora **2/2 verdi**).
  4. **NUOVO**: apertura **MANUALE** su Capital.com (barra conti). *Da fare* → `MESSAGGI/02`.
  5. **NUOVO**: difetto **(D)** attribuzione (`👤 tu` nella colonna "Sessione") → **RISOLTO** (versione
     `v115` / `1.0.115`). Causa vera, provata con numeri: la tabella delle posizioni usa
     `fblOrigineBadgeHtml`, che NON recuperava la sala dal ticket MT5, mentre il Trade Journal
     (`journalOrigineHtml`) **sì**: la STESSA posizione risultava `📡 Sala Oro` nel Journal e `👤 tu`
     nella tabella. In più `mt5AllineaApertura` usciva prima (servizio vecchio senza orario) senza
     applicare la sala. Fix (2 sostituzioni via `sostituisci.py`):
     (a) `fblOrigineBadgeHtml` chiama `mt5ApplicaSegnale(p)` se ha un ticket e non ha la sala;
     (b) `mt5AllineaApertura` applica la sala su OGNI percorso.
     Test: `laboratorio/app/attribuzione_mt5.test.mjs` (4 casi; prima **2 rossi**, ora **4 verdi**).
     Collaudo completo **verde** (`Falliti: 0`, 2026-10-09 02:32 UTC, commit `9650d3d`).
  6. **NUOVO — RISOLTO**: barra dell'**asse dei prezzi**, *"assolutamente sbagliato: da quella toolbar
     dobbiamo solo zoomare la vista e non spostare ordini"*. Due cause, entrambe corrette via
     `sostituisci.py`: (1) la striscia di zoom `#priceAxisZone` era spostata di `cobSvpExtraWidth(w)`
     (`_pz.style.right=_ex+'px'`) e finiva **sopra le colonne COB/SVP** → ora è ancorata al bordo
     (`right:'0px'`), dov'è disegnata la scala (`priceAxisX=w-76`); (2) la guardia dell'asse aveva
     `&& !tradeLevelHit(...)`, quindi con una linea TP/SL o pendente sotto il dito partiva il **drag
     della linea** → ora l'asse fa **sempre e solo** lo zoom e non avvia mai il drag linee.
  7. **NUOVO — RISOLTO**: colonne **COB/SVP** *"lo zoom lo effettuano per errore anche la colonna COB
     e SVP: toglilo; se si preme lì si sposta il grafico ma non lo zoom"*. Non zoomano più (l'overlay
     non le copre): col mouse/penna si **trascina il grafico** (pan); col dito resta il flusso normale
     dei tocchi (un dito scorre, due dita spostano). Mai zoom, mai linea, mai disegno lì.
     Test di regressione: `laboratorio/app/asse_prezzi_zoom.test.mjs` (3 casi: asse→zoom e mai linea;
     COB/SVP→pan e mai zoom; striscia ancorata al bordo). Prima **3 rossi**, ora **3 verdi**.
     Versione `v117` / `1.0.117`. Diagnosi con sub-agente `ses_ee167238effehZDhGCaq5hoW1w`.

## Passa parola (messaggi)
- `MESSAGGI/01-mappa-segnali.md` — mappa completa della pipeline segnali: parser Python, costruzione
  della `voce`, apertura auto/manuale, metadati delle posizioni, dedup già esistente, punti d'innesto.
- `MESSAGGI/02-apertura-manuale-capital.md` — piano puntuale (righe attuali) per aggiungere Capital.com
  alla barra conti manuale: HTML, `fblContoVista/Effettivo/Disegna/Scegli`, `openMarketTrade`, boot,
  rischi (ordine vero MT5 se il ramo Capital non sta prima) e 5 test proposti.
- `MESSAGGI/03-progetto-filtro-doppioni.md` — progetto del filtro anti-doppioni: impronta (strumento+
  direzione+fascia entrata+TP), tolleranza `fblTolleranzaEntrata×0,5`, fonti da confrontare (`positions`,
  `pendingOrders`, Kraken via `tgStrategie`, segnali eseguiti), esenzioni (`aggiunta`/`seconda_entrata`),
  finestre 3 min / 6 h, innesto in `tgAutoValuta`/`tgAutoDecidi` e `tgEseguiSegnale`, 8 test proposti.
- Sub-agenti di questa tornata (per rilanciarli se la sessione si interrompe):
  `ses_ee1706410ffez8sI6rVRLGoqLZ` (mappa dei dati) e `ses_ee170640fffegYfv6TBsaoXRQz` (punti
  d'innesto). Entrambi **completati**.
- `laboratorio/app/filtro_doppioni.test.mjs.da-attivare` — test del filtro anti-doppioni scritti in
  anticipo e **parcheggiati** fuori dal glob `*.test.mjs`, per non rendere rosso il collaudo finché il
  filtro non è realizzato. **Attivato**: ora è `laboratorio/app/filtro_doppioni.test.mjs`.
- `laboratorio/app/filtro_doppioni_auto.test.mjs` — test d'innesto del filtro sul `tgAutoDecidi` VERO
  (2 casi). Prima rossi (il gancio non c'era), ora **2/2 verdi**.

## Decisioni prese
- Apertura automatica: **solo il computer**. Telefono/tablet mostrano il segnale, aprono a mano.
- "Computer" = `!fblRemoto() && !fblEMobile()` (già usato nella guida "sei sul computer").
- Filtro anti-doppioni: **all'apertura** (per dispositivo), non alla ricezione: così il ponte Python
  consegna sempre tutti i messaggi (diagnostica vera) ed è l'app a decidere. Auto → blocca; manuale →
  avviso + conferma esplicita.

## Coda di lavoro
- Passi 15, 16, 17, poi 18 → 24 (uno alla volta).
- A fine percorso: documento separato con (1) elenco di TUTTE le modifiche per passo/file/funzione e
  (2) guida passo-passo per collaudare il tutto dentro il programma.
