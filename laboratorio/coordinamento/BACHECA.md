# BACHECA DI COORDINAMENTO — Forex Backtest LAB

Questo file è la **regia**. Lo tiene e lo aggiorna solo il **coordinatore** (l'agente principale).
Gli altri agenti lo LEGGONO prima di cominciare e **non** lo modificano.

## Regole della squadra
- **Un solo scrittore su `app.html`**: il coordinatore. Gli agenti non toccano mai `app.html`.
- Gli agenti di esplorazione sono **sola lettura** su tutto il resto.
- **Sub-agenti SEMPRE, e da rilanciare**: ogni fronte di lavoro comincia (e riprende) con un giro di
  sub-agenti di esplorazione. Se la sessione si **compatta** o si interrompe, i sub-agenti vanno
  **rilanciati** prima di proseguire: niente lavoro "a memoria". *(Regola chiesta dal proprietario,
  9 ottobre 2026.)*
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
  4. **NUOVO — RISOLTO**: apertura **MANUALE** su Capital.com (barra conti, versione `v118` / `1.0.118`).
     Pulsante 💹 Capital.com tra Kraken e Storico; `fblContoVista/Effettivo/Disegna/Scegli` conoscono
     'capital' (pallino dalla **sua** sessione, non da Kraken); `openMarketTrade` dirotta al conto
     Capital.com **PRIMA** del ramo MT5 (solo manuale): MAI un ordine vero a MT5; nuova
     `capitalOrdineManuale(side)` apre posizioni SIMULATE `account:'capital'` col prezzo del grafico o
     di Capital.com. 8 sostituzioni via `sostituisci.py` (piano `MESSAGGI/02`).
     Test: `laboratorio/app/capital_manuale.test.mjs` (5 casi; prima **4 rossi**, ora **5/5 verdi**).
     Collaudo completo **verde** (`Falliti: 0`).
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
  8. **NUOVO — FATTO**: Passi **15/16** — **storia completa di un utente Syntra** (versione `v119` /
     `1.0.119`). Il robot, su richiesta del ponte, **tocca il nome** in alto a destra di una scheda
     (nuovo `utente_xy` salvato da `leggi_schermata`), apre il **profilo**, scorre le pagine e raccoglie
     le operazioni (`leggi_profilo`). Vincolo rispettato: **mentre legge il profilo NON sfiora la pagina
     Notifiche** (ramo dedicato in `ciclo`, prima di tutto il resto) e le operazioni lette **NON** vanno
     in bacheca (niente aperture): si **ARCHIVIANO** con `storico_sale.archivia_syntra`, cosi' l'app le
     mostra nella cronologia gia' condivisa della sala `Syntra · <utente>`. Lato ponte, `_manda_storico`
     per le sale Syntra mette una richiesta in `STATO["syntra_leggi_profilo"]`, **aspetta** che il robot
     finisca (max 60 s, con messaggio chiaro se l'emulatore non e' collegato), poi risponde con l'archivio
     aggiornato; `_stato_chat`/`_firma_stato` espongono anche `syntra_profilo` (cosa fa il robot adesso).
     Cronologia e resa sono **gia' condivise** in `app.html` (nessuna modifica all'app per questo passo).
     Test: `laboratorio/ponte/test_profilo_syntra.py` (4 casi; prima **rossi**, ora **4/4 verdi**).
     Collaudo completo **verde** (`Falliti: 0`). Diagnosi con sub-agenti (mappa 15/16 e mappa 18-24).
  9. **NUOVO — FATTO**: **Passo 17** — memoria riportata al vero. `CONSEGNA.md` allineata a `v119`
     (storia `v113`→`v119`, Passi 13/15/16 segnati fatti, mappa di `app.html` a ~41.500 righe),
     `DIARIO.md` completato, `BUG.md` con i difetti dell'ondata 1 e i Passi 15/16, una lezione in
     `LEZIONI.md`, `MAPPA.md`/`IDEE.md` aggiornate, `ORACLE.md` avverte che il server Oracle va
     riallineato (`prepara_server.sh`) perché `segnali_bridge.py` è cambiato con la v119.
  10. **NUOVO — FATTO**: **Passi 18/19** (app v120). `valuta` registra `tpT`/`slT`;
      `fblCronoAncore` → `tpEnd[]`/`slEnd`; `fblCronoDisegna` ferma ogni linea sulla sua candela e
      stampa la spunta ✓ a sinistra dei TP presi; stop non preso = lunghezza dell'ultima di TP. Test
      `laboratorio/app/cronologia_linee.test.mjs` (3). Collaudo completo **verde**. Prossimi: Passo 20.

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
- `MESSAGGI/04-profilo-syntra.md` — Passi **15/16**: progetto realizzato della storia completa di un
  utente Syntra (robot: `utente_xy` + `leggi_profilo` + ramo in `ciclo`; ponte: `_manda_storico`,
  `_stato_chat`, `_firma_stato`), vincoli, test e come ricontrollare a mano.
- `laboratorio/ponte/test_profilo_syntra.py` — test dei Passi 15/16 (4 casi; prima rossi, ora
  **4/4 verdi**). Nota: negli XML sintetici i `\n` dei `content-desc` vanno scritti come `&#10;`.

## Decisioni prese
- Apertura automatica: **solo il computer**. Telefono/tablet mostrano il segnale, aprono a mano.
- "Computer" = `!fblRemoto() && !fblEMobile()` (già usato nella guida "sei sul computer").
- Filtro anti-doppioni: **all'apertura** (per dispositivo), non alla ricezione: così il ponte Python
  consegna sempre tutti i messaggi (diagnostica vera) ed è l'app a decidere. Auto → blocca; manuale →
  avviso + conferma esplicita.

## Coda di lavoro
- **Passi 20 → 24** (uno alla volta). I Passi 13, 15, 16, 17, 18 e 19 sono fatti.
- A fine percorso: documento separato con (1) elenco di TUTTE le modifiche per passo/file/funzione e
  (2) guida passo-passo per collaudare il tutto dentro il programma.
