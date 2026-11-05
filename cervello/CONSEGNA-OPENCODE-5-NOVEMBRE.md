# Consegna a OpenCode — 5 novembre 2026

Scritta da Claude per chi riprende il lavoro. **Leggi tutto prima di toccare un file.** Dentro ci
sono quattro lavori da fare, il modo in cui si lavora su questo progetto, e le trappole già pagate
(ognuna è costata ore: non ripagarle).

Se una cosa qui non torna con quello che vedi nel codice, **il codice vince**: fermati, misura, e
scrivi al proprietario cosa hai trovato. Non indovinare: in questo progetto girano **soldi veri**
su MT5.

---

## 0. Le cinque regole che non si discutono

1. **Mai persistere su disco o nel cloud le posizioni e gli ordini REALI di MT5.** La funzione
   `stripMt5TrackedForSave()` deve restare nel percorso di salvataggio (`collectLightSessionState`
   e nel ripristino). Fra finestre della stessa macchina invece si passano interi — è già così,
   non toccare (`collectTradingSyncPayload`).
2. **Credenziali e segreti non entrano nel repo.** Mai. Stanno in locale sul computer del
   proprietario.
3. **Sul server, la scorciatoia senza chiave vale SOLO per il prefisso `/dati`.** Tutto il resto
   del ponte (ordini reali compresi) resta dietro la chiave condivisa. Non allargarla.
4. **Nessuna chiave Kraken reale sul server**: `/kraken/configura` con ambiente diverso da
   `"simulato"` deve continuare a rifiutare.
5. **Prima di ogni cura, una misura.** Vedi il paragrafo 1.3: in questo progetto si è già pagato
   tre volte lo stesso errore, cioè curare una causa *supposta*.

---

## 1. Come si lavora qui

### 1.1 Dove sta tutto

| cosa | percorso |
|---|---|
| **Repo vero** (quello che si pubblica) | `C:\Users\pietro\Documents\GitHub\Forex-Backtest.LAB` |
| ~~Specchio sul Desktop~~ **NON USARLO** | `C:\Users\pietro\Desktop\trading\backtest app\applicazione` |
| Remoto | `https://github.com/Pietro-Santini/Forex-Backtest.LAB`, ramo **`main`** |
| Chiave SSH del server Oracle | `C:\Users\pietro\Desktop\trading\backtest app\applicazione\oracle\ssh-key-2026-10-06.key` |
| Server Oracle | `ubuntu@100.100.244.65`, progetto in `/srv/fbl/progetto` |

> **ATTENZIONE sulla cartella del Desktop.** Le vecchie consegne dicono di ricopiarci
> `app.html` dopo ogni pubblicazione. **Non si fa piu' da un pezzo, e non serve.** Misurato il
> 5 novembre 2026: quella cartella e' ferma alla **v2.0.56** e il suo `sw.js` dice **v2.0.33**,
> mentre il repo e' alla 2.0.89 - trenta versioni, e nessuno se n'e' accorto, il che dimostra
> che **niente dipende da lei**: l'app installata nasce dal Setup che il workflow costruisce dal
> repo, e la versione web da GitHub Pages, cioe' sempre dal repo.
>
> Quindi **non leggere codice da li'** (crederesti di guardare il codice vivo e guarderesti
> quello di settimane fa) e **non lavorarci**. Se il proprietario vuole si riallinea una volta
> sola, o si cancella: e' una sua decisione, non una tua iniziativa.

File che contano:

- **`app.html`** — l'applicazione intera, ~55.000 righe, **5 blocchi `<script>`**, righe con
  **CRLF**. Qui sta il 95% del lavoro.
- **`sw.js`** — `CACHE_NAME` va alzato **a ogni rilascio**.
- **`installer_build/installer.iss`** — `MyAppVersion`, **lo stesso numero** del `CACHE_NAME`.
- `installer_build/build/bridge.py` — ponte ordini MT5, porta **8000**. Soldi veri.
- `installer_build/build/mt5_feed_server.py` — servizio dati (candele, tick), porta **8001**.
- `installer_build/build/documenti_utente.py` — le rotte `/dati`, montate SIA dal ponte sul PC SIA
  dal server Oracle. **Un file solo, due posti**: se lo cambi, va riaggiornato anche il server.
- `server_oracle/ponte_server.py`, `server_oracle/prepara_server.sh`, `server_oracle/prepara_dominio.sh`
- `laboratorio/app/*.test.mjs` — collaudo browser (node:test + Playwright)
- `laboratorio/ponte/*.py` — collaudo ponte (pytest)
- `cervello/` — la memoria del progetto: `DIARIO.md`, `BUG.md`, `LEZIONI.md`, `REGOLE.md`,
  `METODO.md`, `PUBBLICARE.md`. **Leggi `METODO.md` e `REGOLE.md` prima di iniziare.**

### 1.2 I comandi esatti del collaudo

```bash
node laboratorio/strumenti/sintassi_app.mjs
```
Deve stampare `app.html: 5 script, 0 errori di sintassi`. **Lanciala dopo ogni modifica ad
`app.html`**, prima di qualunque altra cosa: è un secondo e ti evita di scoprire un errore di
sintassi dopo venti minuti di test.

```bash
cd laboratorio && npm run test:app
```
Il giro intero del browser. **Attenzione: dura circa un'ora** (≈1190 prove, una per volta). Non è
`node --test laboratorio/app/` — quella forma non trova niente e finisce in 40 millisecondi
dicendo «test failed»: è una trappola, ci sono già cascato.

Una prova sola:
```bash
node --test laboratorio/app/nome_della_prova.test.mjs
```

```bash
python -m pytest laboratorio/ponte -q
```
Il ponte, ≈90 secondi. Oggi sono **227 verdi**.

### 1.3 Il metodo, in cinque righe

1. **Misura prima di curare.** Una causa supposta è un'ipotesi, non un fatto. Scrivi il numero che
   hai misurato, non quello che ti aspetti.
2. **Ogni cura si prova nei DUE versi**: la prova deve essere **rossa senza** la cura e **verde
   con**. Se è verde in entrambi i casi, la prova è muta e non protegge niente.
3. **Prove di controllo**, sempre: una prova che misura il contrario, perché una prova che
   «misura il vuoto» (un banco vuoto, un numero sempre zero) passa e non dice nulla.
4. **Mai mescolare una modifica e un test nello stesso comando.** Se il test gira su un file che
   stai cambiando, il suo esito non vuol dire niente. Prima modifichi, poi lanci.
5. **Una voce nel `DIARIO.md` per ogni rilascio**: cosa era il difetto, cosa hai misurato, cosa hai
   cambiato, cosa è rimasto non spiegato. In cima al file, formato come le voci che ci sono già.

### 1.4 Come si pubblica (`cervello/PUBBLICARE.md`)

1. `sw.js` → `CACHE_NAME = "forex-backtest-lab-vX.Y.Z"`
2. `installer_build/installer.iss` → `#define MyAppVersion "X.Y.Z"` (stesso numero)
3. giro intero verde (browser **e** ponte)
4. voce nel `DIARIO.md`
5. commit e `git push origin HEAD:main`
6. i workflow di GitHub fanno il resto: **Collaudo**, **Installer Windows**, **pages build**, e
   pubblicano la release con `ForexBacktestLAB_Setup.exe`, l'APK e `installer_build.zip`.
   Si controlla con `gh run list --limit 5` e `gh release view`.

**Modifiche fuori da `app.html` e `sw.js`** (ponte, servizio dati, `documenti_utente.py`):
il tasto «Aggiorna» dell'app **non basta**, serve **reinstallare** il Setup. Dillo al proprietario
esplicitamente ogni volta, con scritto *perché*.

**Modifiche in `server_oracle/`**: dopo il push vanno applicate sul server:
```bash
cd /srv/fbl/progetto && git pull && bash server_oracle/prepara_server.sh
```

---

## 2. Stato al 5 novembre 2026

**Pubblicate**: fino alla **v2.0.88** (commit `d3fa2cc`), release su GitHub con Setup, APK e zip.
Collaudo CI verde.

**In corso, da finire e pubblicare come v2.0.89** (il lavoro è già tutto scritto, mancava solo il
giro intero del browser):

- `app.html`: strumento di misura nuovo nel pannello prestazioni — `fblSezioniDettaglio` +
  `fblDettaglioFine(nome,t0)`, sullo stesso interruttore `fblCronoSezioni`. Nomi:
  `disegno:<tipo>`, `disegno:vpfixed>calcolo`, `ind:<chiave>:calcolo`, `ind:<chiave>:disegno`,
  `profiliVP:costruzione`. Nel rapporto: `dentroLeSezioni_ms` e `dentroSezioniTotale_ms`
  (**il totale salta i nomi con `>`**, che sono annidati dentro un altro: sommarli darebbe un
  totale più grande del disegno intero).
- `laboratorio/app/dettaglio_lentezza.test.mjs` — 3 prove, verdi, provate anche nel verso rosso.
- `installer_build/build/bridge.py`: `/account` e `/connect` ora tornano **`trade_mode`** e
  **`reale`** (vedi lavoro 1). `laboratorio/ponte/test_conto_reale_o_demo.py` — 5 prove verdi,
  provate nel verso rosso.
- `sw.js` e `installer.iss` già a **2.0.89**; la voce del diario è già scritta, dentro c'è
  `__COLLAUDO__` da sostituire con l'esito del giro intero.

**Numeri misurati che servono ai lavori qui sotto** (sono misure vere, sul computer del
proprietario, non stime):

| misura | valore |
|---|---|
| disegno medio sul suo computer | **54,57 ms**, 14 fotogrammi al secondo, 51.172 candele |
| dentro il disegno | `disegniUtente` 27,1 + `indicatori` 23,74 = **il 93%** |
| sul banco con 51.000 candele | un **solo** profilo volumetrico = 4,27 ms su 4,36 di tutta la sezione (**98%**); linee e rettangoli 0,02 ms a testa |
| disegno medio sul banco | 4,5-5 ms, **dieci volte meno del suo**: le candele da sole non spiegano la lentezza, la spiega la sua configurazione |
| `/history` di un asset | **4,95 MB**, 50.000 candele, 0,64 s in locale |
| `JSON.parse` di quel payload | 23 ms; costruzione delle righe 46 ms |
| dati di tutta l'infrastruttura sul server | **7 MB** (2,9 dati + 3,8 backup) |
| disco del server Oracle | **250 GB**, usati 8,9 (il 4%) |

---

## 3. LAVORO 1 — Apertura automatica delle sale **per conto** (SOLDI VERI)

> Questo lavoro tocca denaro reale. Fallo **per primo** e **da solo**, in due rilasci separati come
> scritto sotto. Se una parte non è provata, **non pubblicarla**.

### 3.1 Cosa ha chiesto il proprietario, con le sue parole

«Se siamo loggati a un conto reale, prop firm, dove girano soldi veri, dobbiamo avere la
possibilità di attivare le operazioni automatiche di quel conto oppure disattivarle, e quindi i
segnali magari arrivano soltanto come notifica, ma non si aprono da sole.»

«Tra un conto e l'altro possiamo selezionare indipendentemente: su un conto n sale, su un altro
altre. Se noi su un conto impostiamo determinate sale, non deve spalmarsi su tutti i conti… sarà
salvato in memoria per quel specifico conto.»

«Tutto quello che è la configurazione all'interno del pannello di impostazioni dell'apertura
automatica deve essere diverso per ogni conto… anche le impostazioni delle strategie, con i freni
all'interno delle strategie, con la percentuale di rischio o del capitale o del margine. Cioè per
ogni conto è tutto diverso.»

### 3.2 Com'è fatto oggi (verificato nel codice, non supposto)

- `tgAutoVuoto()` (≈riga 33326) descrive **la forma** della configurazione: `attivo`, `maxGlobali`,
  `perditaMaxGiorno`, `perditaAttiva`, `etaMaxS`, `rischioSenzaSl`, `apriSenzaSl`, `apriSenzaTp`,
  `bePipTutte`, filtro notizie (`newsAttiva`, `newsMinPre/Post`, `newsSeverita`, `newsPaesi`),
  **`sale: {}`** (mappa sala → la sua configurazione: `attivo`, `rischio`, `maxPosizioni`,
  `regole`, `avvicinamento`, `quote`, `modo`, `baseLotto`), `universale`, `spentoIl`.
- Ci sono **due** configurazioni complete, per famiglia di strumenti:
  `tgAutoFx` (chiave `fb_tg_auto`) e `tgAutoCr` (chiave `fb_tg_auto_cripto`).
  `tgAutoDi(fam)`, `tgAutoPerSimbolo(strumento)`, e `tgAuto` è **il puntatore** su cui lavora
  tutta l'interfaccia del pannello.
- La scelta dei **conti** è separata e condivisa: `tgAutoConti` (chiave `fb_tg_auto_conti`), con
  `conti:{}`, `cambiaConto`, `tuttiIConti`, `tornaIndietro`.
- La decisione: `tgAutoDecidi(voce)` (≈33919) → `tgAutoValuta(voce,conto)` (≈34988) →
  per MT5, se ci sono conti scelti, `tgAutoApriSuiConti(voce,d,seg,conto)` (≈35259), che cicla sui
  conti bersaglio e per ognuno chiama `tgAutoApriQui(voce,d,seg,conto,spazio)`.
- **IL BUCO, ed è la riga che conta** (≈35198):
  ```js
  if(conto==='mt5' && tgAutoContiRegolaAttiva()) return await tgAutoApriSuiConti(voce,d,seg,conto);
  await tgAutoApriQui(voce,d,seg,conto,d.spazio);   // nessun conto scelto: apre DOVE SEI
  ```
  `tgAutoContiRegolaAttiva()` è `tgAutoContiScelti().length>0`. Quindi **con nessuna spunta si
  apre sul conto collegato, qualunque sia**: un conto reale aggiunto dopo finisce sotto apertura
  automatica **per omissione**. Non esiste oggi un modo di dire «su questo conto mai da sola».
- I freni contano **per tipo di conto, non per conto**: `tgAutoAperte(sala,'mt5')` somma le
  posizioni di *tutti* i conti MT5, e così `tgAutoSpazioOra(d,conto)` e la perdita di giornata.

### 3.3 Le due decisioni già prese dal proprietario (non riaprirle)

1. **La lista vuota continua a valere «il conto collegato», ma un conto REALE o prop non ci
   rientra mai** se non lo spunta lui. Sui demo tutto come adesso.
2. **Per conto è TUTTO**: sale, numeri di ogni sala, strategie e loro freni, base del lotto
   (rischio/capitale), freni generali, filtro notizie, break-even, interruttore generale.

### 3.4 Il modello da scrivere

Non uno strato di eccezioni parziali: **una copia intera della configurazione per conto**. È la
forma che il proprietario ha chiesto, ed è anche la più semplice da far funzionare, perché tutta
l'interfaccia lavora già su un puntatore.

```js
const TG_AUTO_CONTO_KEY='fb_tg_auto_per_conto';
// { "12345@Broker-Live": { fx:<configurazione completa>, cr:<configurazione completa> }, ... }
let tgAutoPerConto={};
```

- `tgAutoFx` / `tgAutoCr` **restano** e diventano la configurazione di **«Tutti i conti (base)»**,
  usata quando un conto non ha un blocco suo. Così niente di quello che il proprietario ha già
  configurato cambia comportamento.
- Quando si configura un conto per la prima volta, il suo blocco nasce come **copia della base**
  (`JSON.parse(JSON.stringify(...))`), poi vive indipendente. **Nessuna propagazione successiva**:
  cambiare la base non deve più toccare i conti già configurati — è esattamente il «non deve
  spalmarsi».
- **Un conto REALE nasce con `attivo:false`** nel suo blocco. Questo *è* la regola di sicurezza:
  l'interruttore generale sta dentro la copia.
- `sale` **si sostituisce in blocco**, non si fonde per sala: se si fondesse, una sala accesa nella
  base e assente nel blocco del conto resterebbe accesa, cioè si spalmerebbe.

Risoluzione (una funzione sola, usata da tutti):

```js
function tgAutoContoChiaveCorrente(){ /* login@server del conto collegato ADESSO */ }
function tgAutoRisolvi(fam, contoKey){
  const b = tgAutoPerConto[contoKey];
  return (b && b[fam]) ? b[fam] : tgAutoDi(fam);
}
function tgAutoPerSimboloEConto(strumento, contoKey){
  return tgAutoRisolvi(tgFamDaSimbolo(strumento), contoKey);
}
```

Per il conto collegato usa `tgAutoContoCollegatoLogin()` (≈33545) + il server, con
`mt5AccountKey({login,server})` (≈49969, `login+'@'+server`) — **la chiave è `login@server`**,
non il solo login, perché lo stesso numero può esistere su due server.

### 3.5 Come riconoscere un conto reale (**già fatto da Claude, non rifarlo**)

`installer_build/build/bridge.py` ora torna in `/account` e in `/connect`:

```python
"trade_mode": getattr(info, "trade_mode", None),   # 0 demo, 1 concorso, 2 REALE
"reale": (None if ... is None else bool(... == 2)),
```

Prove: `laboratorio/ponte/test_conto_reale_o_demo.py` (5, verdi).

**La regola del dubbio**: `reale === null` vuol dire «non lo so» (pacchetto MetaTrader5 vecchio) e
va trattato **come se fosse reale**, cioè non si abilita niente da sola. `false` vuol dire demo. Mai
trattare `null` come `false`: sarebbe la bugia che fa aprire posizioni su un conto reale.

Nell'app: leggi `mt5ContoAttivo` (risposta di `/connect`, l'unica fonte sicura nei primi secondi
dopo un cambio conto) e `mt5AccountInfo` (polling di `/account`, ≈40628). Ricorda che il
proprietario deve **reinstallare** il programma perché questa modifica arrivi: è fuori da
`app.html`.

In più, un conto è «da trattare come soldi veri» anche se ha una configurazione prop:
`fblPropContoStato(id)` con stato `in_corso` o `finanziato` (≈6470).

### 3.6 I passi, in ordine, e cosa pubblicare

**RILASCIO A (piccolo, fallo per primo: protegge subito i soldi)**

1. L'app legge `reale`/`trade_mode` e li tiene per conto (`login@server`).
2. La riga del buco diventa: se il conto su cui si aprirebbe è **reale o prop o «non lo so»** e
   **non è spuntato** in `tgAutoConti.conti`, non si apre. Il segnale **non si butta**: resta nel
   pannello con `voce.autoMotivo` scritto in italiano, per esempio
   «conto 12345 (REALE): le aperture automatiche non sono attive su questo conto — aprilo a mano
   dal pannello segnali, oppure spuntalo nella configurazione».
3. Lo stesso controllo dentro `tgAutoApriSuiConti`, nel ciclo: un conto reale non spuntato non
   diventa bersaglio **nemmeno** con «apri su tutti i conti» acceso.
4. Targhetta visibile: nel pannello segnali e accanto al selettore dei conti, «apertura automatica:
   SPENTA su questo conto». Nella tabella dei conti del pannello ⚡, la scritta **REALE** in rosso.
5. Conferma esplicita (non una spunta che si tocca per sbaglio) quando si abilita l'automatico su un
   conto reale.

**Prove del rilascio A** (tutte e quattro, e la prima **oggi è rossa**):
- conto reale **non** spuntato, collegati a quello → **non apre niente**, e `voce.autoMotivo`
  contiene il motivo;
- conto demo con lista vuota → **apre come adesso** (prova di controllo: nessuna regressione);
- `reale === null` → si comporta come reale (non apre);
- «apri su tutti i conti» **salta** il conto reale non spuntato.

**RILASCIO B (la configurazione per conto)**

6. `tgAutoPerConto` + salvataggio (`localStorage`) + migrazione: se la chiave non c'è, è `{}` e
   tutto si comporta come oggi.
7. Aggiungi la chiave nuova alla mappa della sincronizzazione fra dispositivi (cerca
   `fb_tg_auto_conti` intorno a riga 7747: c'è una mappa `GRAFICO_LS` con una voce per chiave; va
   aggiunta la stessa cosa per `fb_tg_auto_per_conto`, che **ridisegni** il pannello dopo).
8. Nel pannello ⚡, in cima, una tendina **«Impostazioni per il conto:»** con
   `[Tutti i conti (base)]` e un elemento per ogni conto salvato (`mt5SavedAccounts`), con
   `REALE`/`demo` accanto. Scegliendo un conto, `tgAuto` punta al blocco di quel conto e
   `tgAutoDisegna()` ridisegna: **nessun controllo del pannello va modificato**, è il punto di
   forza di questo modello. Scrivi a schermo quale conto si sta modificando, grande e chiaro.
9. `tgAutoDecidi` prende il conto come parametro e risolve con `tgAutoPerSimboloEConto`.
10. **`tgAutoApriSuiConti` deve ridecidere PER OGNI conto bersaglio**, dentro il ciclo: oggi `d`
    (con `d.A` e `d.cfg`) è calcolato **una volta sola** prima del ciclo, e con le sale per conto
    questo è il difetto principale da evitare — aprirebbe sul conto 2 con le sale del conto 1.
    Per ogni conto: risolvi la sua configurazione, controlla che la sala sia spuntata **lì**,
    ricalcola rischio e spazio **con i suoi numeri**, e se non si apre scrivi il motivo **con il
    numero del conto dentro**.
11. I freni per conto: `tgAutoAperte()` e `tgAutoSpazioOra()` devono poter contare **per
    `login@server`** e non per tipo di conto. Lo stesso per la perdita di giornata (`spentoIl`,
    `tgAutoPerditaOggi()`): vive dentro il blocco del conto, quindi un conto che si è spento per
    oggi non deve spegnere gli altri.

**Prove del rilascio B**:
- conto 1 con la sala A spuntata, conto 2 con la sala B: un segnale della sala A si apre **solo**
  sul conto 1; uno della sala B **solo** sul conto 2;
- cambiare una sala sul conto 1 **non** cambia niente sul conto 2 né sulla base (è letteralmente la
  richiesta: «non deve spalmarsi»);
- rischio diverso per conto → lotti diversi sui due conti per lo stesso segnale;
- il tetto posizioni del conto 1 pieno **non** blocca il conto 2;
- la perdita di giornata del conto 1 **non** spegne il conto 2;
- prova di controllo: **nessun** blocco per conto → tutto si comporta come la base, esattamente
  come oggi.

---

## 4. LAVORO 2 — Le candele restano in locale (velocità)

### 4.1 Cosa ha chiesto

«Ogni volta che cambiamo tra asset e asset, oppure chiudiamo e riapriamo l'applicazione, se lo ha
caricato già la prima volta, i dati delle candele se le deve salvare in locale, così alla
riapertura aggiorna soltanto le ultime candele aggiunte… non è possibile che ogni volta che
cambiamo asset ci riscarica tutte 50.000 le candele.»

### 4.2 Cosa succede oggi (misurato)

In Live con MT5, `__loadLiveHistoryFromMt5Body` (≈45452) fa, **a ogni cambio asset E a ogni cambio
timeframe**:

```js
const timeframe=(MT5_TIMEFRAME_MAP[currentTF]||'M1');
const res=await fetch(fblConChiave(MT5_FEED_URL+'/history?symbol='+resolved+'&timeframe='+timeframe+'&count=200000'));
```

Misurato sulla sua macchina: **4,95 MB**, 50.000 candele, 0,64 s in locale (dal telefono passa dal
giro lungo, molto peggio). Poi `const mt5Rows=(body.candles||[]).map(...)` (≈45574) costruisce le
righe facendo **due** conversioni di data per candela (`new Date().toISOString()` e poi
`parseDateTime` nel filtro): 23 ms di `JSON.parse` + 46 ms di costruzione.

In modalità Storico esiste già una copia interna dei CSV (`FBL_CSV_CACHE='csvCache:'`,
`fblCsvCacheSalva` / `fblFileDaCache`, ≈46361) ma tiene il **testo** del CSV e lo **ri-analizza**
ogni volta con `parseCSVAsync`.

### 4.3 La buona notizia: non serve cambiare il servizio dati

`/history?count=N` restituisce le **ultime N** candele (`copy_rates_from_pos(sym, tf, 0, count)`).
Quindi, sapendo l'ultima candela che si ha in locale, si chiede **solo la coda**: 500 candele sono
**49 KB** invece di 5 MB. Non aggiungere parametri al server: non servono.

### 4.4 Come farlo

1. Magazzino in **IndexedDB**, una voce per **asset + timeframe**:
   `{ simbolo, digits, ultimoTs, tempo:Float64Array, open/high/low/close:Float64Array, volume:Float64Array, salvatoAt }`.
   Le colonne come array tipizzati: IndexedDB li salva e li rilegge senza passare da JSON.
   ~2,2 MB per asset invece di 5. Tieni un tetto (per esempio le 12 voci usate più di recente) e
   butta le più vecchie, o la memoria del browser si riempie.
2. All'apertura di un asset: leggi il magazzino, **costruisci le righe e disegna subito**, senza
   rete.
3. Poi calcola quante candele mancano: `ceil((adesso - ultimoTs)/secondiDelTimeframe) + 200` di
   margine, e chiedi **quel** `count`.
4. **Controllo di sovrapposizione, obbligatorio**: nella risposta cerca la candela con
   `time === ultimoTs`. Se c'è **e** il suo OHLC coincide con quello salvato → aggiungi solo le
   più nuove. Se non c'è (buco troppo grande) **o** non coincide (il broker ha riscritto lo
   storico) → scarico intero (`count=200000`) e sostituzione. **Senza questo controllo si cuce uno
   storico falso, che è molto peggio di uno lento.**
5. Salva il magazzino **non a ogni tick**: quando si lascia l'asset/timeframe, o ogni N candele
   nuove.
6. Rispetta il guardiano che c'è già: se nel frattempo l'utente ha cambiato asset, la risposta
   vecchia **non** deve entrare nel grafico (c'è già un controllo su `currentAssetKey`, cercalo nei
   commenti «Mai far comparire due grafici»).

**Prove**: con il magazzino vuoto deve chiedere il `count` grande; con il magazzino pieno un
`count` **piccolo** (misura il valore chiesto, stubbando `fetch`); lo storico risultante deve
essere **identico** a quello scaricato intero (stesse candele, stesso ordine, nessun doppione);
OHLC diverso nella sovrapposizione → scarico intero; prova di controllo: nessun magazzino →
comportamento di oggi.

---

## 5. LAVORO 3 — Il server su un dominio, e via Tailscale

Tutto il necessario **è già scritto e nel repo**. Non riscriverlo.

- `server_oracle/prepara_dominio.sh` — apre la 443 sulla macchina **e la salva** (altrimenti al
  riavvio torna chiusa), installa Caddy, prende il certificato Let's Encrypt che si rinnova da sé,
  ed espone **solo** `@documenti path /dati /dati/*`; tutto il resto risponde 404. Si lancia così,
  sul server:
  ```bash
  cd /srv/fbl/progetto && git pull && FBL_DOMINIO=<nome.duckdns.org> bash server_oracle/prepara_dominio.sh
  ```
  Si ferma da sé con un messaggio chiaro se il dominio non punta a quella macchina.
- `cervello/GUIDA-DOMINIO-SENZA-TAILSCALE.md` — la guida passo passo per il proprietario, passi
  1-14 per il dominio e 15-24 per il disco. **È scritta per un neofita: se la modifichi, tieni
  quello stile** (dove sei, cosa premere col testo esatto, perché).

**L'ORDINE NON È NEGOZIABILE.** Tailscale oggi non è uno strato in più: è **il trasporto e il
certificato**. `tailscale serve --https` è ciò che dà HTTPS al server e al PC, e serve per una
ragione insuperabile: l'app è servita in HTTPS (GitHub Pages) e **un browser rifiuta le chiamate in
`http://` da una pagina `https://`**. Quindi:

1. il proprietario fa i passi 1-13 (dominio DuckDNS, 443 nella Security List della VCN, script);
2. si verifica **dal telefono con i dati mobili** che `https://<dominio>/dati/session` risponda
   **401** con il lucchetto;
3. **solo allora** il passo 14: puntare l'app su `https://<dominio>` e **togliere Tailscale da
   tutto** — `app.html`, `bridge.py`, `mt5_feed_server.py`, `server_oracle/`, e la guida interna
   all'app. Cerca ogni occorrenza di `tailscale`, `ts.net`, `Funnel`, `MagicDNS`.

Se togli Tailscale prima del punto 2, il proprietario resta **senza accesso remoto**.

Nota utile già pagata: `pietro.tail83d918.ts.net` **non** è risolvibile pubblicamente (verificato
con 8.8.8.8), e il «nessuna risposta» con tutto il resto giusto è quasi sempre la 443 chiusa nella
Security List di Oracle — che **non** si apre dal server, si apre dal sito di Oracle.

---

## 6. LAVORO 4 — Il disco del server a 200 GB

**La richiesta va letta al rovescio, e questo è misurato**: il disco **non è da ingrandire, è già
da 250 GB** (`/dev/sda1 242G, 8.9G usati, 4%`), cioè **sopra** i 200 GB che Oracle Always Free
regala. I dati veri sono **7 MB**. Quindi bisogna **scendere** dentro i 200, e il vincolo che
decide tutto è: **Oracle sa ingrandire un boot volume, non sa rimpicciolirlo**, e nemmeno la strada
del backup aiuta (un backup si ripristina solo su un disco **grande almeno quanto l'originale**).

Quindi si **sostituisce la macchina**, e si può fare gratis e senza interruzione perché Always Free
dà **due** macchine E2.1.Micro. I passi completi, con il testo esatto dei bottoni della console
Oracle, sono già scritti: **`cervello/GUIDA-DOMINIO-SENZA-TAILSCALE.md`, passi 15-24**. In sintesi,
e nell'ordine:

1. **passi 15-17** — guarda il totale in Storage → Boot Volumes + Block Volumes (il tetto è sul
   totale) e fai un **backup Full** del boot volume, aspettando che sia `Available`;
2. **passi 18-20** — crea la **seconda** macchina gratis: stessa AD (`xVZl:EU-MILAN-1-AD-1`),
   Ubuntu 26.04, shape `VM.Standard.E2.1.Micro` con la scritta **Always Free eligible**, **stessa
   VCN e stessa subnet** (così la regola della 443 vale già), e **boot volume da 50 GB** (non 200:
   ne usa 8,9, e 50 è il minimo che Oracle accetta — restano 150 GB di tetto per il server dati
   futuro). Poi `git clone` del repo in `/srv/fbl/progetto` e `bash server_oracle/prepara_server.sh`;
3. **passi 21-23** — trasloca i 7 MB (`tar` di `/srv/fbl/dati` e `/srv/fbl/backup`, scp dal
   computer alla macchina nuova: le due macchine non si conoscono fra loro), riavvia i contenitori
   (**devono essere due, Up**), sposta il nome DuckDNS sul nuovo IP e rilancia
   `prepara_dominio.sh`;
4. **passo 24** — **solo dopo** che il telefono vede la macchina nuova: Terminate della vecchia
   **spuntando «Permanently delete the attached boot volume»**, e poi **controlla in Storage → Boot
   Volumes che il disco da 250 GB non ci sia più**. Senza quella spunta la macchina sparisce e il
   disco resta: 250 + 50 = 300 GB, peggio di come si era partiti. È l'unico errore lì che non dà
   nessun messaggio.

**Questi passi li esegue il proprietario**, non tu: toccano bottoni sul suo account Oracle. Il tuo
lavoro è accompagnarlo e verificare, non cliccare al posto suo.

---

## 7. Le trappole già pagate (non ripagarle)

1. **`node --test laboratorio/app/`** non lancia niente: finisce in 40 ms dicendo «test failed».
   Si usa `cd laboratorio && npm run test:app`.
2. **Non chiudere mai un comando che modifica un file insieme al comando che lancia i test.** Una
   volta è rimasta un'attività appesa per **4 ore e 30** perché un errore di sintassi ha bloccato
   il test lanciato nella stessa riga; un'altra per **4 ore e 44** per un'attesa armata a mano.
   Non armare attese: lancia e aspetta la notifica.
3. **Gli heredoc di bash mangiano gli apostrofi e i backtick.** Su questo progetto, che scrive
   tutto in italiano, è una trappola continua: un backtick in un heredoc non quotato ha **eseguito
   un comando** e corrotto una riga del diario. Usa gli strumenti di scrittura file, oppure
   `<<'FINE'` quotato, oppure python.
4. **`app.html` ha righe CRLF.** Una regex che finisce con `$` senza `m`, o un `.` che dovrebbe
   attraversare un fine riga, **non trova niente**: è così che una prova è rimasta **muta** (passava
   sempre). Dopo aver scritto una prova, **rompi la cura di proposito** e guarda se diventa rossa.
5. **Controlla i nomi doppi.** Una funzione nuova chiamata come una che esiste già
   (`window.fblCronoDisegna`) l'ha silenziosamente sostituita. C'è una prova che lo impedisce:
   `laboratorio/app/nomi_unici.test.mjs` — tienila verde.
6. **Non ottimizzare l'indicatore del profilo volumetrico «a occhio».** Ci si è già sbagliato
   **due volte in due giorni**: una cura su una premessa falsa, e la lunghezza delle barre
   agganciata al riquadro del grafico invece che al periodo coperto. Parole del proprietario:
   «il numero delle fasce e la dimensione delle barre **sono due cose diverse**». Il numero delle
   fasce **non** cambia col timeframe; la lunghezza delle barre **sì** con lo zoom. Le due prove
   stanno in `laboratorio/app/profilo_barre_timeframe.test.mjs`.
7. **Un test che modifica uno stato condiviso deve usare `monkeypatch`** (pytest): un attributo
   lasciato sporco ha fatto fallire **11** prove non collegate.
8. **FastAPI, in questa versione, non mostra le rotte dei router inclusi** in `app.routes`: non
   provare il montaggio contando le rotte, provalo col **comportamento** (401 contro 404).
9. Il comando di aggiornamento del server è
   `cd /srv/fbl/progetto/server_oracle && bash prepara_server.sh` — **non** `git pull && docker compose`.
10. **Una misura presa a vuoto non dice «va tutto bene»: dice che non c'era niente da misurare.**
    Il pannello prestazioni ha un avviso apposta (`ATTENZIONE`) quando il grafico era vuoto.

---

## 8. Cosa resta aperto, in ordine di importanza

> La lista operativa passo per passo e' la **sezione 11**: questa e' solo il riassunto.

1. **LAVORO 1**, rilascio A poi B (soldi veri).
2. **LAVORO 2** (le candele in locale).
3. **Pubblicare la v2.0.89**: manca solo il giro intero del browser e la sostituzione di
   `__COLLAUDO__` nella voce del diario già scritta.
4. **Le linee entry/TP/SL degli ordini pendenti non si vedono** (segnalato): sul banco si
   disegnano. Il filtro Live+MT5 richiede `pos.mt5Login === currentMt5AccountTag().mt5Login`, e un
   ordine reale **senza** `mt5Login` resta nascosto quando un login è noto (misurato:
   `senzaLogin:false`). Serve sapere da lui se non le vede sulla pagina **madre** o su quella
   **duplicata** prima di curare.
5. **La velocità del disegno**: ora lo strumento c'è. Fai premere «Misura prestazioni» al
   proprietario **mentre usa l'app come fa di solito**, e leggi `dentroLeSezioni_ms`. Il primo
   sospetto misurato è il profilo volumetrico, e il suo **calcolo è già in cache**
   (`computeVolumeProfile`, ≈12461): se il numero di `disegno:vpfixed>calcolo` è basso e
   `disegno:vpfixed` alto, il costo è nel **disegno** dell'istogramma (150 fasce, sfondo, POC, VAH,
   VAL), non nella matematica. **Non curare prima di avere il suo numero.**
6. `E:\Forex Backtest Lab\dati` è ancora vuoto: la cartella nasce da `cartella_dati()` all'avvio
   del ponte, il database alla prima richiesta `/dati`. Da verificare dopo che accende
   l'interruttore del cloud nostro.
7. Il tasto schermo intero dopo aver duplicato la finestra: nessun meccanismo nostro trovato. Se
   la riga di stato dice «Il browser ha bloccato la richiesta di schermo intero» è un rifiuto di
   pywebview/browser, non nostro.
8. Limite di richieste per indirizzo in Caddy: rimandato di proposito, richiede un modulo compilato
   nel binario. La protezione attuale è che **un solo percorso** è esposto.

---

## 9. L'ultima cosa, e la più importante

Il proprietario ti chiederà delle cose con parole da utente, non da programmatore. Il tuo lavoro
non è eseguire le parole: è capire **il risultato** che vuole. Due esempi veri di oggi:

- «portiamo il disco a 200 GB» → il disco era **già** da 250, e la cosa giusta era **scendere**;
- «ci riscarica tutte le candele» → non era il download di una cosa nuova, era **5 MB a ogni
  cambio asset E a ogni cambio timeframe**.

E quando una sua richiesta ti sembra basata su una premessa sbagliata, **misura e diglielo** con il
numero in mano, poi fai quello che ha deciso lui. Mai cambiare in silenzio quello che ha chiesto.

---

## 10. L'ARCHITETTURA DEI DATI — e perché Firebase non deve costare niente

Questa è una decisione del proprietario, ripetuta più volte, e vale per **tutti gli utenti**, non
solo per lui. Chi la dimentica rimette i dati su Firestore e **fa arrivare una bolletta**.

### 10.1 Chi tiene i dati

```
   utente (telefono, tablet, altro PC)
            |
            v
   SERVER ORACLE  ... la spalla: risponde quando il PC e' spento o non raggiungibile
            |
            v
   IL PC DEL PROPRIETARIO  <-- la FONTE PRIMARIA, su disco E:\Forex Backtest Lab\dati
            |
            v
   FIREBASE / FIRESTORE  <-- UNA fotografia al giorno, e nient'altro
```

Con le sue parole: «i dati di tutti gli utenti passano per il server ma arrivano al mio PC per lo
stoccaggio dati, e il server diventa da spalla qualora il PC fosse spento o avesse problemi di
connessione»; «di default il mio PC terrà i dati degli utenti e miei sul disco E»; «Firebase è lì
pronto, soltanto che fa un backup al giorno, per non perdere completamente tutti i dati qualora
avvenisse qualche inconveniente con il mio PC»; «così limitiamo del tutto le scritture, le letture
e il cloud su Firebase e cerchiamo di **non pagare assolutamente nulla** su Firebase e Firestore».

In futuro comprerà un **server dati dedicato**: quando arriverà, prende il posto del PC in quello
schema. Scrivi il codice in modo che la fonte primaria sia un **indirizzo configurabile**, non «il
PC» incollato dentro.

### 10.2 Com'è fatto oggi (già scritto e funzionante)

- `installer_build/build/documenti_utente.py` — **un file solo**, montato SIA dal ponte sul PC
  (porta 8000) SIA dal server Oracle. Contiene le rotte `/dati`:
  `GET/PUT/PATCH /dati/{nome}`, `POST /dati/trades/aggiungi`, `GET /dati/trades`,
  WebSocket `/dati/ascolta`.
- `cartella_dati()` sceglie dove scrivere, in quest'ordine: variabile `FBL_DATI` →
  **`E:\Forex Backtest Lab\dati`** se si può scrivere → `%APPDATA%\ForexBacktestLAB\dati` →
  `/dati` (è il caso del contenitore sul server).
- Ogni richiesta porta un **token Firebase verificato contro le chiavi pubbliche di Google**, e
  ogni riga del database è legata all'`uid` che ne esce. La prova che i dati di due utenti non si
  toccano esiste: `test_i_dati_di_due_utenti_non_si_toccano`.
- Nell'app: `fblCloudNostro()` (tre stati: acceso `'1'`, spento `'0'`, oppure «visto, quindi
  acceso»), `fblUrlDati()`, `fblUrlDatiAscolto(token)`, `fblCloudDoveScrivere()`,
  `fblCloudNostroDisponibile()`, `fblCloudNostroRotteCiSono()` (401 = le rotte esistono, 404 = no),
  `fblCloudNostroGuarda()` su un timer da 4 secondi.
- La scrittura verso Firestore è già **a delta**: `fxbtCloud.salvaCampi(parti)` con
  `{state:parti, updatedAt}, {merge:true}`, e `fblCloudCampiCambiati(pacchetto, firmePrec)` che
  decide quali campi sono cambiati davvero (`FBL_CAMPI_PROFONDI=['assetDrawings','assetChartViews']`,
  `fblFirmaValore`, `fblCloudFirmeDi`, `fblCloudChiaveSparita`). Risparmio misurato: **357×, 44×,
  39×, 10×** a seconda del campo.
- La fotografia giornaliera: `fblFotoGiornalieraServe()` / `fblFotoGiornalieraFatta()`,
  `fblGiornoDiOggi()`.
- Il contatore del traffico, per sapere **da dove** viene la bolletta: `fblTrafficoSegna()`,
  `fblTrafficoRiassunto()`, `fblTrafficoDisegna()`.

### 10.3 Le regole da rispettare quando ci lavori

1. **Firestore si tocca una volta al giorno.** Ogni scrittura in più va giustificata con un numero
   misurato. Se aggiungi un ascolto (`onSnapshot`), sappi che **ogni consegna costa una lettura del
   documento INTERO**, non del pezzo cambiato: è così che si è arrivati a 250.000 letture e 122.000
   scritture in un giorno.
2. **Su Firebase si paga la BANDA**, non le operazioni né l'archiviazione (memoria del progetto
   `firebase-si-paga-la-banda`). Il report per SKU va guardato **per primo**, non per ultimo.
3. **`setDoc` con `{merge:true}` fonde le mappe annidate ma non cancella mai una chiave.** Se una
   chiave deve sparire, va gestita a mano (c'è già `fblCloudChiaveSparita`).
4. **Il PC è la fonte, il server è la spalla, Firebase è il paracadute.** Non invertire mai questo
   ordine «perché è più semplice».
5. L'autenticazione resta su Firebase: è l'unica cosa per cui si usa sempre, e va bene così.
6. Il server ha **951 MB di RAM**: non è un posto dove tenere i dati di tutti, è un posto da cui
   passano. Se un'installazione si interrompe senza spiegazioni lì, è la memoria.

---

## 11. LA LISTA, passo per passo, nell'ordine in cui va fatta

Fai un passo per volta. **Dopo ogni passo** la domanda è una sola: «la prova dice quello che
volevo?». Se no, non è finito.

### PASSO 0 — Finire e pubblicare la v2.0.89 (è già scritta, manca il collaudo)

| | |
|---|---|
| **stato** | codice scritto, prove nuove verdi, `sw.js` e `installer.iss` già a 2.0.89, voce del diario già scritta |
| **cosa manca** | il giro intero del browser (circa un'ora) e sostituire `__COLLAUDO__` nel diario con l'esito |
| **una rossa trovata e curata** | la mia prova `dettaglio_lentezza` pretendeva `somma('ind:') > 0`: verde da sola, **rossa nel giro intero**, perche' `volume_default` costa cosi' poco che su macchina carica arrotonda a 0,00 ms. Un'asserzione su un TEMPO dipende dalla macchina: lezione n. 9. Curata misurando le **voci create** invece del loro valore. **Zero millisecondi per un indicatore leggero e' una misura giusta, non un guasto.** |
| **da confermare** | nel giro in cui e' uscita quella rossa, l'output era tagliato e **non si vedevano i totali**: serve un giro intero pulito per sapere che non ci fosse altro rosso. E' il primo punto del PASSO 0. |

1. `node laboratorio/strumenti/sintassi_app.mjs` → deve dire `5 script, 0 errori`.
2. `cd laboratorio && npm run test:app` → leggi `pass` e `fail` alla fine.
3. `python -m pytest laboratorio/ponte -q` → oggi **227 passed**.
4. In `cervello/DIARIO.md`, nella voce della v2.0.89, sostituisci `__COLLAUDO__` con i numeri veri
   (esempio: «giro intero 1190 prove, 1189 verdi, 0 rosse, 1 saltata; ponte 227 verdi»).
5. Commit e `git push origin HEAD:main`.
6. `gh run list --limit 5` → le tre build verdi; `gh release view` → Setup, APK e zip presenti.
7. **Di' al proprietario che serve REINSTALLARE** il Setup: `bridge.py` è cambiato (i campi
   `trade_mode` e `reale`), e il tasto «Aggiorna» aggiorna solo la pagina.

### PASSO 1 — Sicurezza sui conti reali (LAVORO 1, rilascio A)

Il dettaglio sta nel paragrafo 3.6. In breve, nell'ordine:

1. **Prima la prova, rossa**: conto reale non spuntato + collegati a quello → oggi **apre**, e la
   prova deve dirlo.
2. L'app legge `reale`/`trade_mode` da `/connect` e `/account` e li tiene per `login@server`.
   `reale === null` ⇒ **trattalo come reale**.
3. Il blocco nella riga ≈35198 e, **nel ciclo**, dentro `tgAutoApriSuiConti`.
4. Il motivo scritto in `voce.autoMotivo`, in italiano, con il numero del conto dentro. Il segnale
   **resta nel pannello**: non si butta mai.
5. La targhetta «apertura automatica: SPENTA su questo conto» nel pannello segnali e accanto al
   selettore conti; **REALE** in rosso nella tabella dei conti.
6. La conferma esplicita per abilitare l'automatico su un conto reale.
7. Le altre tre prove del paragrafo 3.6 (demo invariato, `null` come reale, «tutti i conti» salta
   il conto reale non spuntato).
8. Diario, versione, giro intero, push. **Pubblica questo da solo**, senza il passo 2 dentro.

### PASSO 2 — Configurazione per conto (LAVORO 1, rilascio B)

Il dettaglio sta nei paragrafi 3.4 e 3.6. Nell'ordine:

1. `tgAutoPerConto` + chiave `fb_tg_auto_per_conto` + migrazione (chiave assente ⇒ `{}` ⇒ tutto
   come oggi).
2. La voce nella mappa della sincronizzazione fra dispositivi (vicino a `fb_tg_auto_conti`,
   ≈7747), che **ridisegni** il pannello.
3. La tendina «Impostazioni per il conto» in cima al pannello ⚡, con `REALE`/`demo` accanto a ogni
   conto, e la scritta grande di quale conto si sta modificando.
4. `tgAuto` punta al blocco del conto scelto; `tgAutoDisegna()` ridisegna. **Nessun controllo del
   pannello va modificato.**
5. Copia della base alla prima configurazione di un conto, e **nessuna propagazione dopo**.
   `sale` si **sostituisce in blocco**, non si fonde.
6. `tgAutoDecidi(voce, contoKey)` e `tgAutoPerSimboloEConto(strumento, contoKey)`.
7. **`tgAutoApriSuiConti` ridecide per ogni conto bersaglio, dentro il ciclo.** È il difetto
   principale da evitare: oggi `d` è calcolato una volta sola e aprirebbe sul conto 2 con le sale
   del conto 1.
8. I freni per conto: `tgAutoAperte()`, `tgAutoSpazioOra()`, `spentoIl`, `tgAutoPerditaOggi()`.
9. Le sei prove del paragrafo 3.6 (rilascio B), prova di controllo compresa.
10. Diario, versione, giro intero, push.

### PASSO 3 — Le candele in locale (LAVORO 2)

Il dettaglio sta nel paragrafo 4.4. Nell'ordine:

1. **Prima la misura**: stubba `fetch` e registra il `count` chiesto a ogni cambio asset e a ogni
   cambio timeframe. Oggi è `200000` sempre: scrivi il numero nella prova.
2. Il magazzino IndexedDB per **asset + timeframe**, colonne in array tipizzati, con il tetto
   delle voci più recenti.
3. Lettura e disegno **senza rete**.
4. Il `count` piccolo calcolato dall'ultima candela salvata, più margine.
5. **Il controllo di sovrapposizione** (c'è la candela con `time === ultimoTs`? il suo OHLC
   coincide?) e il ritorno allo scarico intero quando non torna.
6. Il salvataggio non a ogni tick.
7. Il guardiano della risposta vecchia (`currentAssetKey`) rispettato anche sulla strada nuova.
8. Le cinque prove del paragrafo 4.4: la più importante è **lo storico identico a quello scaricato
   intero**.
9. Poi, se serve, la stessa cosa per la modalità Storico (i CSV): oggi la copia interna tiene il
   **testo** e lo ri-analizza ogni volta.
10. Diario, versione, giro intero, push.

### PASSO 4 — Il dominio, e solo dopo via Tailscale (LAVORO 3)

1. Il proprietario fa i passi 1-13 della guida (li fa **lui**: toccano il sito di Oracle e
   DuckDNS). Tu lo accompagni e verifichi.
2. Verifica **dal telefono con i dati mobili**: `https://<dominio>/dati/session` deve dare **401**
   col lucchetto, e `/health` **404**.
3. **Solo allora** il passo 14: l'app punta su `https://<dominio>`, e **togli Tailscale da tutto** —
   `app.html`, `bridge.py`, `mt5_feed_server.py`, `server_oracle/`, la guida dentro l'app. Cerca
   `tailscale`, `ts.net`, `Funnel`, `MagicDNS`.
4. Prove: che l'app non nomini più Tailscale da nessuna parte, e che l'indirizzo dei dati sia
   quello nuovo. Diario, versione, giro intero, push. **Modifiche in `server_oracle/`** ⇒ sul
   server `git pull && bash server_oracle/prepara_server.sh`.

### PASSO 5 — Il disco del server a 200 GB (LAVORO 4)

Lo esegue **il proprietario**, con la guida (passi 15-24). Tu verifichi dopo ogni blocco:

1. backup Full `Available`;
2. macchina nuova `Running` con **50 GB** e la scritta Always Free eligible;
3. due contenitori **Up** sulla nuova e i 7 MB di dati arrivati;
4. il telefono vede la macchina nuova (401 col lucchetto);
5. Terminate della vecchia **con la spunta** «Permanently delete the attached boot volume», e in
   Storage → Boot Volumes il disco da 250 GB **non c'è più**.

### PASSO 6 — La velocità del disegno (solo dopo il suo numero)

1. Fai premere **Misura prestazioni** al proprietario **mentre usa l'app come fa di solito**
   (scorre, cambia timeframe, mette un disegno), e fatti incollare il risultato col tasto Copia.
2. Leggi `dentroLeSezioni_ms`: dice quale disegno e quale indicatore costa, e per il profilo
   volumetrico separa il **calcolo** dal **disegno**.
3. **Solo allora** la cura, sul pezzo che il suo numero indica, con la prova nei due versi.
   Niente ottimizzazioni «a occhio»: su quell'indicatore si è già sbagliato due volte.

### PASSO 7 — I punti rimasti

1. Le linee entry/TP/SL degli ordini pendenti (paragrafo 8, punto 4): **prima** chiedigli se non
   le vede sulla pagina madre o su quella duplicata.
2. `E:\Forex Backtest Lab\dati` ancora vuoto: verifica dopo che accende l'interruttore del cloud
   nostro.
3. Il tasto schermo intero dopo la duplicazione: fatti leggere la riga di stato.
4. Il limite di richieste per indirizzo in Caddy: richiede un modulo compilato nel binario.
   Rimandato di proposito, non dimenticato.
