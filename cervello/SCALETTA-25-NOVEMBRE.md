# Scaletta — cosa resta da fare (25 novembre 2026)

Chiesta dal proprietario: «mi crei una lista su quello che dobbiamo fare successivamente, una
scaletta dei punti, la migrazione e tutto quello che rimane».

Snapshot datato, come `SCALETTA-12-NOVEMBRE.md` e `STATO-SCALETTA-19-NOVEMBRE.md`. Sostituisce in
pratica la sezione «Da fare da Claude» di `CONSEGNA-OPENCODE-19-NOVEMBRE.md` §5, che è esaurita: il
blocco MT5 che fermava tutto è risolto e pubblicato. `SCALETTA.md` è ferma al 21 ottobre (v2.0.15):
per lo stato di adesso vale questo file.

**Legenda:** 🙋 serve il proprietario · 🤖 lo posso fare da solo · ⚖️ serve una sua decisione prima

---

## 0. Dove siamo adesso (fatti, non impressioni)

- Pubblicato su `main`: **v2.2.117** (in collaudo al momento di scrivere), dopo **v2.2.115** e
  **v2.2.116**. `CACHE_NAME` e `FBL_VERSIONE` verificati su `origin/main` a ogni pubblicazione.
- MT5 **collegato** sul conto `12346925 @ Upcomers-Server`, cartella credenziali `conti trading`
  funzionante, popup «Sblocca i file collegati» non più mostrato.
- Collaudo completo verde: `Falliti: 0` su **1824** test.
- La copia installata sul PC del proprietario ha ancora le patch messe a mano il 24 novembre:
  **non** ha ancora preso la versione nuova dal pulsante Aggiorna.

---

## 1. Subito, appena lui ha un minuto

1. 🙋 **Premere Aggiorna nell'app** e dirmelo: verifico in pochi secondi dalla porta di debug che i
   due pulsanti MT5, il riquadro delle credenziali e gli orari si comportino come nei banchi. È
   l'unica verifica che manca: tutto il resto è misurato sul banco, non sul suo PC.
2. 🙋 **Test live 8.8**, bloccati fin qui dal difetto MT5 e ora possibili: duplicata piantata,
   elenco asset, disco E, sfarfallio delle linee, chiusura mercato alle 23:00. Serve lui davanti
   all'app; io leggo e misuro.

## 2. Decisioni sue, piccole ma bloccanti

3. ⚖️ **Le sue 8 modifiche non committate** nel repo: `.claude/hooks/guardia_git.py`,
   `asset-library.html`, `installer_build/build/bridge.py`, i due test dei segnali,
   `laboratorio/app/cloud_bolletta.test.mjs`,
   `laboratorio/app/replay_posizione_non_si_chiude_subito.test.mjs`, `laboratorio/collauda.sh`,
   più tre file nuovi in `cervello/`. Le ho lasciate fuori da tutti i miei commit. Vanno
   committate, scartate o finite.
4. ⚖️ **La porta di debug `9222`** è aperta sul WebView dell'app installata. È da lì che vengono
   tutte le misure di questi due giorni, ma chiunque sul PC può collegarsi e leggere la sessione.
   Da decidere se chiuderla nella prossima versione.
5. ⚖️ **La soglia del verdetto «API muta»**: uno o due silenzi prima di spegnere il banner per
   sempre. Rimandata («decidiamo poi»). Non è urgente: il ripiego sull'archivio interno non dipende
   più da questa scelta.
6. ⚖️ **Weekend**: per gli asset il cui calendario di Capital.com copre sabato e domenica
   (apertura della domenica sera, CFD 7/7) ora si segue il calendario, quindi il mercato può
   risultare aperto di sabato. Da confermare che è quello che vuole.

## 3. Lavoro mio, senza bisogno di lui

7. ~~**`collauda.sh` deve troncare `ultimo.md`**~~ **PUNTO SBAGLIATO, RITIRATO il 25 novembre.**
   `collauda.sh` **tronca già** il file (`: > "$OUT"`, riga 39, e c'è da sempre). Avevo visto due
   corse nello stesso file e dedotto un difetto dello script senza aprirlo. La causa vera:
   avevo **fermato** un collaudo e lanciato subito il successivo, e `TaskStop` uccide il processo
   che lo avvolge, non `collauda.sh`, che continuava a girare — il nuovo ha troncato, il vecchio ha
   scritto dopo.
   **Quello che resta di vero**, e vale saperlo: il controllo di `guardia_git.py` cerca la
   **sottostringa** `"Falliti: 0"` in tutto il file, quindi due corse sovrapposte possono farlo
   passare anche con l'ultima rossa. Non è un difetto dello script, è un motivo per non lanciare
   due collaudi insieme.
8. 🤖 **I margini di tempo scritti a mano** negli altri banchi della famiglia permessi
   (`assert.ok(r.ms < 4000)` con un tetto nominale di 1500). Ne ho già corretto uno dopo un rosso
   finto a 4515 ms: il collaudo gira quattro browser in parallelo e i timer slittano. Gli altri
   vanno legati alla costante.
9. 🤖 **Ripristinare gli stub nei banchi nuovi**: `libDirGet`, `fblHaGesto`, `fblPermessoRimandati`
   restano sostituiti per il resto della vita della pagina. Non è fatale (ogni test apre un browser
   nuovo) ma è una fonte di rossi casuali, e il banco preesistente `cartella_credenziali` lo fa
   correttamente.

## 4. Il pezzo grosso del progetto pubblico

10. ⚖️🤖 **Riapplicare le feature 8.5.13–8.5.18.** Erano state fatte, poi `app.html` è stata
    ripristinata da HEAD dopo una corruzione da parentesi sbilanciate e **non sono mai tornate**.
    Verificato: `fblSplitRiquadri`, `fblRiquadroPagina`, `bookStoricoPerAsset`, `memoriaCampioni`
    hanno **0 occorrenze** in `app.html`.
    I loro quattro banchi sono pronti in `laboratorio/in-attesa-feature-8.5/`: sono la specifica
    già scritta (8 test), basta rimetterli in `laboratorio/app/` quando il codice torna.
    È il lavoro più grosso che resta sul pubblico, e va deciso **prima o dopo la migrazione** —
    perché farlo due volte, qui e nella nuova app, sarebbe lavoro doppio.

## 5. La migrazione (`Forex-Backtest-LAB-Migration`, cartella privata, mai pubblicata)

Stato dichiarato in `MIGRAZIONE.md`: fasi **0-7 complete** (fondamenta, chart core, moduli feature,
cloud/sync, UI/split, updater in-app, adapter notifiche), build Vite OK (`app.html` da 5,3 MB a
1,41 KB, 37 moduli), **35/35** test JS e **10/10** Python verdi, E2E locale verde.

11. 🤖 **Portare le cure dei permessi nella migrazione.** ATTENZIONE: la prima verifica che avevo
    scritto qui («sotto `src/` non c'è...») **non provava niente**: in quel progetto **`src/` non
    esiste**, le cartelle sono `js/`, `css/`, `config/`, `backend/`, `supabase/`, `test/`. Rifatta
    il 25 novembre dove sta il codice (`js/`, 43 file, più `config/` e `app.html`): **zero**
    occorrenze di `verifyDirPermission`, `queryPermission`, `showDirectoryPicker`, `mt5CredsDir`.
    La conclusione regge, ma ora per il motivo giusto: la gestione della cartella delle credenziali
    non è ancora stata portata. Quando la si porta, **il tetto va portato con
    lei**, altrimenti la nuova app eredita identico un difetto che qui è costato un pomeriggio di
    diagnosi: un `await` su un permesso di file non deve mai essere senza tetto, e la UI non deve
    dipendere da quella risposta per aprirsi. Già annotato in `MIGRAZIONE.md`.
12. 🙋 **Eseguire i 7 `EXPLAIN ANALYZE`** di `supabase/tests/explain_analyze.sql`: sono **scritti
    ma mai eseguiti** su un database reale o locale. Finché non girano, le promesse sulle
    prestazioni delle query (RPC anti-N+1, indici, projection) non sono misurate — sono scritte.
13. ⚖️ **Il backlog §4b**: responsive, trading bot, notifiche background reali, audit dei collaudi,
    test live 8.8 nella nuova app.
14. ⚖️ **L'unione** (contratto §0 di `MIGRAZIONE.md`): API identiche, nomi file del sito, bump di
    versione solo dopo collaudo verde, export/import dati, 7 passi.
    **CORREZIONE DEL 25 NOVEMBRE:** avevo scritto che era «la decisione più importante che resta».
    Non lo è, perché **era già presa**: il §0 dice, deciso dal proprietario il 24 novembre, che
    «tutto il lavoro rimasto si fa qui», nella migrazione. Quindi il punto 10 si fa **là**, non in
    `app.html`. Quello che resta da decidere non è *se* unire ma **quando**, e soprattutto in quale
    **ordine** portare il comportamento.
    **MISURATO il 25 novembre**, perché «fasi 0-7 complete» legge come «quasi finito» e non lo è:
    la migrazione è **3.480 righe** in `js/` (125 kB) contro le ~**70.000** righe di `app.html`
    (6,2 MB), cioè circa il **5%**. L'architettura è in piedi e verificata (35/35 JS, 10/10
    Python, build Vite 307 ms); il comportamento è quasi tutto da portare — `js/indicators` sono
    342 righe contro footprint, heatmap, Temporal VP 3D e order book dell'app vera.

## 6. Server e cloud — da confermare con lui

Qui non ho misure di questi due giorni, quindi lo scrivo come **da verificare**, non come stato:

15. 🙋 Il **cloud sul suo PC** (disco E) con Firebase come spalla e autenticazione: da confermare
    che funziona ancora e che il backup notturno dei dati del ponte gira.
16. 🙋 La **migrazione ARM su Oracle** risulta bloccata per mancanza di capacità a ogni taglia, con
    la configurazione già giusta. Da decidere se riprovare o lasciar perdere.

---

## Come la vedrei io, se dovessi scegliere l'ordine

**Prima** il punto 1 (premere Aggiorna e verificare): costa un minuto e chiude i due giorni di
lavoro con una misura sul suo PC invece che solo sul banco.

**Poi** il punto 14, la decisione sull'unione. Non perché sia urgente, ma perché **decide il punto
10**: riapplicare le 8.5.13–8.5.18 nel progetto pubblico ha senso solo se la nuova app non sta per
sostituirlo. Finché quella decisione non è presa, ogni lavoro grosso sul pubblico rischia di essere
fatto due volte.

**In mezzo**, quando serve riempire tempo senza di lui, i punti 7, 8, 9 e 11: piccoli, misurabili, e
togliono trappole che altrimenti fanno perdere mezze giornate — come è già successo con `ultimo.md`
e con un margine scritto a mano.
