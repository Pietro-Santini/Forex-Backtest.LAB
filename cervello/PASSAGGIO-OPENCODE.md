# Passaggio di consegne — 16 ottobre 2026

Scritto per chi riprende il lavoro (OpenCode). Il progetto lo conosci già: qui c'è **dove sta**,
**cosa è stato fatto nella notte fra il 15 e il 16 ottobre**, **cosa resta**, e **dove guardare**.

---

## 1. Dove sta il progetto

| cosa | percorso |
|---|---|
| **Repo vero** (quello che si pubblica) | `C:\Users\pietro\Documents\GitHub\Forex-Backtest.LAB` |
| Specchio sul Desktop (solo `app.html`) | `C:\Users\pietro\Desktop\trading\backtest app\applicazione` |
| Remoto | `https://github.com/Pietro-Santini/Forex-Backtest.LAB` — ramo `main` |

**Il repo è avanti, la cartella sul Desktop è solo uno specchio di `app.html`.** Dopo ogni
pubblicazione si ricopia `app.html` nello specchio e si committa lì separatamente. Non lavorare
sul Desktop.

File che contano:

- `app.html` — l'applicazione intera (~4,7 MB, 5 blocchi `<script>`). Qui sta il 95% del lavoro.
- `sw.js` — `CACHE_NAME` va alzato **a ogni rilascio**, con la nota di cosa cambia.
- `installer_build/installer.iss` — `MyAppVersion`, stesso numero del `CACHE_NAME`.
- `installer_build/build/segnali_telegram/` — il ponte dei segnali (Telegram + Syntra),
  `parser_segnali.py`, `segnali_bridge.py`, `syntra_lettore.py`.
- `laboratorio/app/*.test.mjs` — collaudo del browser (node:test + Playwright).
- `laboratorio/ponte/*.py` — collaudo del ponte (pytest).
- `cervello/DIARIO.md` — cosa è stato fatto e **perché**, versione per versione. Leggilo.
- `cervello/LEZIONI.md` — gli errori già pagati. **Leggilo prima di toccare qualcosa.**

Comandi:

```bash
cd "C:/Users/pietro/Documents/GitHub/Forex-Backtest.LAB" && bash laboratorio/collauda.sh
```

```bash
cd "C:/Users/pietro/Documents/GitHub/Forex-Backtest.LAB" && node laboratorio/strumenti/sintassi_app.mjs
```

---

## 2. ⚠️ La cosa più importante che devi sapere

**Esistono DUE collaudi e conta quello di GitHub.** Fra la v158 e la v164 il collaudo locale era
verde e quello su GitHub rosso: sette versioni pubblicate credendo fosse tutto a posto. La causa:
un test che chiedeva «questo dispositivo è Windows?» e rispondeva con il sistema operativo di chi
esegue — Windows in locale, Ubuntu su GitHub.

Corretto in v165 (`laboratorio/app/aiuti.mjs` ora **dichiara** la piattaforma invece di ereditarla).
Dalla v165 GitHub è verde.

**Dopo ogni push, controlla l'esito su GitHub, non solo quello locale:**

```bash
cd "C:/Users/pietro/Documents/GitHub/Forex-Backtest.LAB" && gh run list --limit 3
```

Se fallisce, il log di GitHub è troncato: scarica l'artefatto.

```bash
gh run download <ID> --repo Pietro-Santini/Forex-Backtest.LAB
```

---

## 3. Stato adesso

**Ultima versione pubblicata: v165** (collaudo GitHub verde).

**v166 è PRONTA MA NON PUBBLICATA**: ramo `v166-sale-per-famiglia`, con modifiche non committate
e un collaudo in corso. Va finita: aspettare il collaudo, committare, unire in `main`, pushare,
riallineare lo specchio, controllare GitHub.

### Fatto nella notte (v156 → v166)

| | cosa |
|---|---|
| v156 | Kraken: il lottaggio si **adatta** al margine disponibile invece di rifiutare il segnale |
| v157 | A mercato chiuso si ferma tutto (candele, footprint, prezzo che valuta le posizioni). Prima uno stop poteva **scattare** su un prezzo mai esistito |
| v158 | Niente «installa i pacchetti» dove non è Windows |
| v159 | Stato del ponte segnali veritiero; prezzi con le migliaia all'italiana (`80.958,50` leggeva 80.958) |
| v160 | La percentuale della sala può essere **rischio** o **quota di capitale**, a scelta; stop fino al 40% sulle cripto |
| v161 | Interruttori «apri senza stop / senza target»; ✕ per togliere un asset dall'elenco; Kraken nel filtro del Journal |
| v162 | Order book profile: bid **e** ask, non più solo il lato vincente |
| v163 | **Anagrafica della posizione**: orario e prezzo di apertura salvati e sincronizzati; origine corretta sui dispositivi mobili |
| v164 | «Salva configurazione» trasferisce **tutta** la strategia; cronologia sale anche dalle impostazioni |
| v165 | Stop e target di Kraken **trascinabili** (selezione poi trascinamento); correzione del banco di prova |
| v166 | Sale divise fra forex e cripto; **orario di esecuzione** nelle quattro tabelle |
| v167 | I riepiloghi dicono «**oltre il pareggio**» e non più «più in là»; le posizioni Kraken **già aperte** si possono **datare a mano** dalla cella «Eseguita» — *da pubblicare* |

---

## 4. Cosa resta da fare

### Difetti segnalati, ancora aperti

1. **Syntra, cronologia delle sale.** Il robot entra nel profilo, espande la prima operazione e si
   ferma. Deve: scorrere giù, espandere la seconda, leggere i valori, passare alla successiva,
   controllare sempre la data, e ripetere **fino al periodo scelto** (un mese = fino al 16
   settembre, due mesi = fino ad agosto). Finito, per tornare a cercare nuove operazioni deve
   **ripremere il pulsante «setup» in basso a sinistra**, accanto a «classifica»: è da lì che si
   arriva al pulsante «notifiche» in alto a destra. Non basta la classifica.
   → `installer_build/build/segnali_telegram/syntra_lettore.py`, funzione `leggi_profilo`.
   Test esistenti: `laboratorio/ponte/test_profilo_espansione.py`.
   **Richiede di reinstallare il ponte per avere effetto.**

2. **Footprint in replay** — la costruzione del footprint durante il replay non è mai stata
   affrontata.

3. **Footprint e heatmap della watchlist sui dispositivi mobili** — sul PC ci sono, sul telefono
   no. È architetturale: quei dati vivono per dispositivo (IndexedDB).

### Funzionalità richieste, non ancora toccate

4. **Caricamento asset con percentuale**: rotellina + percentuale al cambio asset, e il popup deve
   comparire **nella finestra PIP** quando il grafico è staccato.
5. **Cambio conto automatico per tipo di asset**: passando a una cripto → Kraken, a un forex → MT5.
   (Esiste già `fblVaiAlContoDi` per il salto da una posizione: va esteso al cambio asset.)
6. **Multi-selezione dei conti** nella dashboard statistiche.
7. **Cancellazione di un conto** che purga tutto, con avviso esplicito che si perdono le statistiche.
8. **Pulsante «Chiudi» a grafico** con popup: chiusura a mercato oppure parziale a percentuale scelta.

### Rinviate dal proprietario (non farle senza che le richieda)

9. Integrazione Discord (notifiche dei commit, canale idee con sondaggio).
10. App scaricabile e installabile, sganciata da Chrome, con sezione download su GitHub.
    *(Nota: un installer Windows esiste già in `installer_build/`.)*

### Risolte nella v167 (16 ottobre 2026)

11. ~~Nella v161 l'etichetta «% più in là» è stata riscritta in «% oltre il pareggio» ma il campo era
    rimasto.~~ **Fatto:** il campo è rimasto (il numero serve), ma i tre riepiloghi che dicevano
    ancora «più in là» ora dicono «oltre il pareggio». Test: `oltre_il_pareggio.test.mjs`.
12. ~~Le posizioni Kraken già aperte non recuperano l'orario perduto.~~ **Fatto:** la cella «Eseguita»
    si clicca e l'orario si dice a mano; tabella e grafico leggono la stessa funzione
    (`krakenOrarioApertoMs`). Test: `kraken_orario_manuale.test.mjs`.

---

## 5. Come si lavora qui (regole del proprietario)

- **Italiano** in codice, commenti e messaggi di commit. Niente inglese.
- **Ogni correzione ha un test**, e il test deve misurare il **comportamento**, non cercare una
  stringa nel sorgente. (Vedi in LEZIONI.md: «un test che legge il testo del codice dimostra che
  l'hai scritto, non che serve».)
- **Si misura prima di correggere.** Nel diario quasi ogni voce racconta una causa trovata
  misurando, non indovinando.
- `app.html` e `CACHE_NAME` si pubblicano **insieme**; `MyAppVersion` stesso numero.
- Su `main` si pubblica **solo con collaudo verde** — quello di GitHub.
- **Mai** `--force`, mai riscrivere la storia.
- **Nessun identificativo di modello** nei commit, nel codice o nelle pagine.
- Soldi veri mai: MT5 demo, Kraken solo simulato. Nessun permesso di prelievo.
- **Nessuna chiave API** nel repo, nel cloud o nei messaggi.
- Modifiche **fuori** da `app.html` (ponte, installer) richiedono di **ricostruire il Setup**: va
  detto al proprietario e va mandato lo zip.

### Trappole già pagate (ti risparmiano ore)

- `Number(null) === 0` passa `Number.isFinite`. Dove si leggono prezzi che arrivano da fuori, il
  filtro è «c'è ed è maggiore di zero», mai `Number()` + `isFinite`. Successo **quattro volte**.
- Le **emoji e gli accenti** scritti come `\uXXXX` negli script di modifica **non combaciano** col
  file: vanno usati i caratteri veri, oppure ci si ancora su righe senza caratteri speciali.
- Uno script di modifica che esce con errore **prima di salvare** fa perdere anche le modifiche
  riuscite: far scrivere sempre il file e segnalare a parte cosa non si è trovato.
- Il richiamo a `krakenDisegnaGrafico` dentro `draw()` è avvolto in un `try/catch` che **inghiotte
  gli errori**: un'eccezione lì dentro è invisibile. Per trovarla, chiamare la funzione
  direttamente.
- Nella pagina ci sono **nove canvas**: quello del grafico è `#chart`.
- Una linea fuori dalla scala di prezzo visibile **non si disegna** e quindi non si afferra: se un
  banco di prova misura zero, controlla prima le candele.
- `assert.match` su `app.html` riversa 4,7 MB in caso di errore: usare
  `const c=(re,cosa)=>assert.ok(re.test(src),'manca: '+cosa)`.

---

## 6. Cose installate in questa sessione (ambiente, non progetto)

Su richiesta del proprietario, sul PC sono state installate **95 skill** (ne aveva 25) e tre
componenti esterni. Tre avvertenze aperte:

- **OmniRoute** è installato ma npm ha **bloccato gli script di postinstall** (comportamento sicuro
  di default): per usarlo davvero vanno sbloccati.
- **graphify** (`graphifyy`) è installato ma **non è nel PATH**:
  `C:\Users\pietro\AppData\Roaming\Python\Python314\Scripts`.
- **effortless** è installato come plugin di Claude Code ma ha **16 opzioni non configurate**
  (`/plugin configure effortless@effortless`): sono scelte del proprietario.

Attenzione: **ponytail** e **effortless** cambiano il comportamento dell'assistente (ponytail
spinge alla «soluzione più pigra che funziona»). Su un'app che muove ordini veri vanno usate con
criterio.
