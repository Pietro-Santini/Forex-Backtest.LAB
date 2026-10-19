# CONSEGNA — lavori del 19 ottobre 2026

Stato al 19 ottobre 2026. Repo: `C:\Users\pietro\Documents\GitHub\Forex-Backtest.LAB`.
Ramo di lavoro: **`lavoro/sette-richieste`**. `main` non è stato toccato e **non è stato pubblicato niente**.

Attenzione: in questa cartella c'era anche un lavoro NON committato sul collegamento cloud, fatto prima
di questa sessione. È stato lasciato com'è e non è stato toccato.

---

## 1. FATTO, CON TEST CHE SONO STATI VISTI ROSSI PRIMA (regola del progetto rispettata)

### a) Il lottaggio non si scrive più da solo
`app.html`, `autoLottoDaGrafico()`.
**Causa misurata:** la funzione finiva con `$(pending?'lotsPending':'lots').value=s.lots` e veniva
chiamata dai tre punti in cui si posiziona un livello **prima** di aprire un ordine. Posizionando lo
stop compariva un lottaggio che l'utente non aveva scelto, e quel numero finiva nell'ordine.
Misurato su EUR/USD a 1.1000, conto 10.000, rischio 1%: stop a 1.078 portava il campo da **0,07 a
0,05**; sull'ordine pendente da **0,07 a 0,03**. Il numero non era nemmeno stabile (dipendeva da
quale livello fosse toccato per ultimo).
**Ora:** il campo si scrive solo scrivendolo o premendo il pulsante del lottaggio consigliato. Il
messaggio dice «Consigliato … Non è stato impostato».
Test: `laboratorio/app/lottaggio_solo_su_richiesta.test.mjs` (5 prove, 2 viste rosse prima).
**Attenzione:** `laboratorio/app/barra_kraken.test.mjs` asseriva il vecchio difetto ed è stato
aggiornato: ora verifica che mettere lo stop **non** cambi il lotto e che sia il **pulsante** a
sceglierlo.

### b) Cambio asset: mai due grafici
`app.html`, tre loader (`__loadLiveHistoryFromMt5Body`, `__loadLiveHistoryFromCapitalImpl`, Binance).
**Causa misurata:** la richiesta dello storico è asincrona; la risposta dell'asset **vecchio**
scriveva in `csvLibrary` senza chiedere se quell'asset era ancora a schermo. È anche la causa delle
posizioni fuori scala (una BUY su XAUUSD a 4161 finiva sulla fascia di AUDCAD a 0,98).
Binance **aveva già** la guardia (`currentAssetKey!==asset`): MT5 e Capital erano i due senza.
Test: `laboratorio/app/cambio_asset_doppio.test.mjs` (3 prove, 2 viste rosse prima).

### c) Etichette TP1/TP2/TP3, SL, e l'origine dentro
`app.html`. Funzioni nuove `fblEtichettaTpBreve()` e `fblEtichettaOrigineBreve()`.
Le quattro origini: nome della sala / **sala di prova** (segnale scritto a mano) / sala non
riconosciuta / manuale. «Stop Profit» resta «Stop Profit», non diventa SL.
Test: `laboratorio/app/etichette_tp_sl.test.mjs` (6 prove).

### d) Il marchio "sala di prova"
`installer_build/build/segnali_telegram/segnali_bridge.py`: `/inietta` passa `prova=True`, la voce
porta `"prova": true`, l'app la copia sulla posizione come `tgProva`. Prima il segnale scritto a mano
era indistinguibile da una sala vera.

### e) Cronologia delle sale spostata
Fuori dalla sezione Style, in una voce **propria** della barra di sinistra
(`data-settings-tab="cronologia"`), con lo stesso `.fblCronoBtn` e quindi lo stesso pop-up di sempre.
Verificato anche che il pulsante non è più dentro Style.

### f) Tetti portati al 100%
`maxStop` da 40/20 → **100** su cripto e forex. Tetto del rischio in 5 punti da 20 → 100
(`tgRischioTotale`, `tgRischioSenzaSl`, `tgCfg.pct`, `cfg.rischio`, `tgAutoUni().rischio`, più i
`max="20"` degli input e il `pctForzata`). Test `lottaggio_base.test.mjs` aggiornato.

---

## 2. NON FATTO — e perché (le decisioni che spettano al proprietario)

### a) Instradare tutto dal server ed eliminare la chiave del computer
**È la prossima cosa da fare.** L'infrastruttura del collegamento automatico **esiste già** ma è
lavoro **non committato** (funzioni `collegamentoSalva`/`collegamentoAscolta`, `avviaCollegamentoCloud`,
`fblCollegamentoPubblica`, `fblCollegamentoAvvia`). Serve:
- instradare ordini, grafico e segnali **tutti** dal server;
- togliere dal pannello «Accesso da altri dispositivi» la sezione «Come si fa, passo per passo», i
  campi con nome e chiave, e il riquadro «Chiave di questo computer» (che oggi ha il copia-incolla);
- **tenere** il pulsante «Consenti l'accesso dagli altri miei dispositivi» e il pannello «Cosa
  risponde adesso».
Attenzione: la chiave del computer serve oggi per il **grafico in diretta** telefono↔PC. Se il
grafico passa dal server, si elimina. **Decidere questo prima di toccare il pannello.**

### b) Capacità del server con 5-20 utenti
Risposta ragionata: MT5 gira sul **PC**, non sul server. Il server non calcola il grafico, fa da
corridoio. Con 20 utenti il collo di bottiglia sono i PC accesi, non il server.
**Il rischio vero è il traffico:** il caricamento storico chiede fino a **200.000 candele M1** in un
colpo (`count=200000` e il tetto di fusione poco sotto). Con un dispositivo non si nota; con venti
diventa il problema. La soluzione è chiedere **solo le candele visibili** e il resto a scorrimento.

### c) Freni spostati dentro la strategia di sala
Il proprietario vuole che «apri anche senza lo stop della sala», «apri anche senza il TP», il filtro
notizie e la percentuale (rischio o capitale) vivano **nella strategia di ogni sala**, oppure nella
**strategia universale** se è quella selezionata.
**Metà di questo esiste già:** `tgAutoUni()` è la strategia universale e **già sovrascrive** la config
di sala (`tgCfg`, riga ~28742); i freni senza stop/senza TP ci sono; i tetti sono saliti a 100.
**Quello che manca:** i freni sono oggi per **simbolo** (`tgAutoPerSimbolo`), non per sala, e non
c'è la scelta **rischio/capitale** per la posizione senza stop.
**Decisione da prendere con il proprietario:** senza stop e base "capitale", non c'è alcun tetto di
perdita — la posizione può valere tutto il capitale. Va deciso cosa la ferma.

### d) Pulsante "Avvia prova gratuita di 7 giorni" con scelta piattaforma
Non fatto. Esiste già il riquadro di installazione in `index.html`, che distingue android / windows /
ios-mac.
**Fatto:** per Android (.apk) e PC (Setup .exe) i pacchetti esistono. **Per iPhone, iPad e Mac NON
esiste alcun pacchetto** (né App Store né .dmg). Il proprietario ha chiesto di «preparare comunque il
pacchetto»: le variabili vanno preparate con il collegamento VUOTO e va detto chiaramente che su
quelli dispositivi si usa la versione web — non mettere un link inventato.

### e) Orario di apertura vicino al numero identificativo
Non fatto. Serve: vicino al numero, con **«apertura»** per le posizioni e **«inserimento»** per gli
ordini pendenti.

### f) Asse temporale a mercato chiuso — CAUSA TROVATA, NON CORRETTA
**Non è il tempo che avanza: è la correzione del fuso orario sul PC.**
`installer_build/build/mt5_feed_server.py`, `_scarto_fresco_da_epoch()`: la guardia di freschezza
controlla il **residuo dalla griglia di mezz'ora**, non l'**età** del tick. Ma `allineato` è derivato
da `grezzo`, quindi il residuo è ≤900 s **per costruzione**: la guardia è un no-op. Un tick lasciato
indietro di 48 ore passa, e la sua età viene scalata da ogni candela come se fosse il fuso del
broker. Caso del proprietario esatto: prezzo reale gio 15/10 06:00 → etichettato sab 17/10 05:50.
Lo stesso difetto è in `bridge.py`, `_scarto_fresco_da_epoch()`.
Amplificatori lato app: `app.html:41668` (`mt5ScartoOrologioMs`, senza tetto e solo in aumento),
`app.html:38790` (l'autocorrezione con tetto 6h non può mai riportare l'orologio indietro).
**Attenzione:** la correzione NON è «stringere la guardia» — un tick fresco di due ore è
indistinguibile da un fuso di due ore. La strada è rifiutare gli scarti che non sono fusi reali
(|offset| oltre le 12-14 ore) e usare `_scarto_da_un_simbolo_quiunque`, che già esiste e non viene
usato.

---

## 3. COLLAUDO — dove siamo

Prima delle modifiche di questa sessione: **571 test verdi su 572**, l'unica falla era
`barra_kraken`, che asseriva proprio il difetto del lottaggio ed è stato poi corretto.
Ponte Python: **105 verdi**.
Interpretore segnali: **tutto ok**.

**DOPO queste modifiche il collaudo completo NON è stato riguardato.** Va rifatto prima di qualsiasi
pubblicazione. I test nuovi (21 prove) passano tutti, ma non è la stessa cosa.

`sw.js` è già a `forex-backtest-lab-v2.0.3` e `installer.iss` a `2.0.3`. **Non pubblicare senza
rifare il collaudo e senza il nuovo `CACHE_NAME`.**

---

## 4. COME RIPRENDERE

```powershell
cd "C:\Users\pietro\Documents\GitHub\Forex-Backtest.LAB"
git branch                      # deve essere lavoro/sette-richieste
cd laboratorio
node --test --test-concurrency=4 --test-reporter=tap app/*.test.mjs
```
Non c'è `bash` su questa macchina: `collauda.sh` va eseguito a passi (sintassi, versione sw,
`pytest laboratorio/ponte`, i tre `test_*.py` del ponte, `node --test` sui browser). `python3` è lo
stub di Microsoft Store: usare `python`.

Regole del progetto che valgono ancora: risposta in italiano, mai chiavi nel repository, ogni
correzione con un test che misura il comportamento (non il sorgente), e **quando ci sono due
collaudi conta quello di GitHub**.
