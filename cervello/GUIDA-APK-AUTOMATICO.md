# APK costruito da GitHub a ogni release — guida completa

**👤 = lo fai tu · 🤖 = lo faccio io**

**Il problema che risolve:** `index.html` punta a `releases/latest/download/forexbacktestlab.apk`.
Ogni volta che esce una release senza APK allegato, quel collegamento dà **404** e i telefoni non
trovano più l'aggiornamento. È già successo due volte (2.0.36 e 2.0.37).

---

## QUELLO CHE HO MISURATO PRIMA DI SCRIVERE

Non è un piano a sentimento: ho aperto l'APK della 2.0.36 e il progetto sul tuo computer.

| Cosa | Com'è oggi | Perché conta |
|---|---|---|
| Firma | **chiave di DEBUG** (`CN=Android Debug`), da `~/.android/debug.keystore` | sta solo sul tuo PC: GitHub non ce l'ha |
| Tipo di build | `gradlew assembleDebug` | è una build di debug per un'app che muove soldi veri |
| Debug della WebView | `webContentsDebuggingEnabled: true` | acceso in produzione |
| `versionCode` | **1, mai alzato** | Android lo usa per capire se un APK è più nuovo |
| Contenuto | l'APK **si porta dentro tutto il sito** (`assets/public/app.html`, `sw.js`) | ogni versione ha bisogno del SUO APK |
| Progetto | `Desktop\trading\forex-backtest-mobile`, 106 MB | ma solo ~10 MB sono sorgenti veri |

---

# PASSO 0 👤 — LA DECISIONE CHE VIENE PRIMA DI TUTTO

**Android rifiuta un aggiornamento firmato con una chiave diversa da quella installata.** La tua
chiave di debug sta solo sul tuo computer. Quindi o la porti su GitHub, o cambi chiave — e
cambiare chiave costa **una reinstallazione, una volta sola**.

### Strada A — chiave di rilascio vera *(consigliata)*

Si crea una chiave nuova, fatta per pubblicare, e si mette su GitHub come segreto.

- ✅ È il modo corretto: una build di **rilascio**, senza debug acceso
- ✅ È l'unica strada che un domani permette il Play Store
- ✅ La chiave dura 27 anni e non cambia più
- ⚠️ **Una volta sola**, sul telefono: disinstallare e reinstallare

### Strada B — portare su GitHub la chiave di debug che hai già

- ✅ Nessuna reinstallazione: gli aggiornamenti continuano a funzionare subito
- ❌ Resta una build di **debug**, col debug della WebView acceso
- ❌ La chiave di debug ha una password nota a tutti (`android`): chiunque la ottenga può firmare
  un finto aggiornamento che il telefono accetterebbe come tuo
- ❌ Col Play Store non ci si va mai

> **Consiglio: la A.** Il costo è una disinstallazione sola, oggi, su un dispositivo.
> La B ti lascia per sempre su una strada che non porta da nessuna parte, e su un'app che gestisce
> ordini veri tenere il debug acceso non è un dettaglio.

### ⚠️ Cosa si perde reinstallando (strada A)

Solo quello che sta **su quel telefono**: le impostazioni locali, l'indirizzo del server scritto
a mano, i blocchi di tick salvati in memoria. **Non** si perdono conto, posizioni e Trade
Journal: quelli stanno su Firebase e sul server Oracle, e tornano da soli al primo accesso.

---

# PASSO 1 🤖 — Mettere il progetto nel repo (senza la spazzatura)

Dei 106 MB se ne salvano **meno di dieci**: tutto il resto si ricostruisce da solo.

| Cartella | Peso | Va nel repo? |
|---|---|---|
| `android/app/build` | 45 MB | ❌ la ricostruisce Gradle |
| `node_modules` | 37 MB | ❌ la ricostruisce `npm ci` |
| `android/.gradle` | 7,4 MB | ❌ cache |
| `www` | 5,3 MB | ❌ **è una copia del sito**: la rifà `aggiorna_www` |
| sorgenti, `android/app/src`, gradle wrapper, `package.json` | ~10 MB | ✅ |

`www` fuori dal repo è importante: è una **copia** di `app.html` e compagnia. Tenerne due dentro
lo stesso repo significa che un giorno saranno diverse e nessuno saprà quale vale.

---

# PASSO 2 👤 — Creare la chiave di rilascio *(solo strada A)*

Apri il **Prompt dei comandi** e incolla **una riga sola**:

```bash
"C:\Users\pietro\.jdks\jbr-21.0.11\bin\keytool" -genkeypair -v -keystore "C:\Users\pietro\fbl-rilascio.jks" -alias fbl -keyalg RSA -keysize 2048 -validity 10000
```

Ti chiederà, in quest'ordine:

1. **Enter keystore password** → scegline una e **scrivila da qualche parte**: se la perdi, non
   potrai mai più aggiornare l'app sui telefoni già installati. Non la vedrai mentre digiti.
2. **Re-enter new password** → la stessa
3. Nome, reparto, città, provincia, paese → metti quello che vuoi (es. il tuo nome, poi `IT`)
4. **Is CN=... correct?** → scrivi `si` oppure `yes`
5. Se chiede una password per la chiave, **premi Invio**: usa la stessa del keystore

> 🔒 **Il file `fbl-rilascio.jks` non va MAI nel repo.** Tienilo fuori, e fanne una copia in un
> posto sicuro: è l'unica cosa che permette di aggiornare l'app.

---

# PASSO 2-bis 👤 — ⚠️ DIRE A FIREBASE LA CHIAVE NUOVA, o l'accesso con Google si rompe

**Questo passo non è facoltativo, ed è quello che si dimentica.**

Dentro `google-services.json` c'è un `certificate_hash`: è l'**impronta della chiave di firma**, e
Firebase la usa per decidere se l'app che chiede l'accesso con Google è davvero la tua. Con una
chiave nuova quell'impronta non corrisponde più: l'app si installa, si apre, e al momento di
accedere dà un errore che **non spiega niente**.

**a)** Leggi l'impronta della chiave nuova. Prompt dei comandi, una riga:

```bash
"C:\Users\pietro\.jdks\jbr-21.0.11\bin\keytool" -list -v -keystore "C:\Users\pietro\fbl-rilascio.jks" -alias fbl
```

Chiede la password del passo 2. Nell'uscita cerca il blocco **`Certificate fingerprints`** e copia
la riga **`SHA1:`** (una sequenza tipo `AB:CD:12:...`).

**b)** Vai su **console.firebase.google.com** → progetto **forex-backtest-lab** → l'ingranaggio
in alto a sinistra → **Impostazioni progetto** → scorri fino a **Le tue app** → l'app Android
**com.pietrosantini.forexbacktestlab** → **Aggiungi impronta digitale** → incolla lo SHA1 → salva.

> 💡 **Non togliere quella vecchia.** Tenendole tutte e due, l'app firmata col debug che hai
> adesso continua a funzionare finché non reinstalli. Si toglie dopo, con calma.

**c)** Sempre lì, scarica il **`google-services.json`** aggiornato e **mandamelo** (oppure salvalo
sul Desktop e dimmi dove): lo metto io al posto di quello nel repo.

---

# PASSO 3 👤 — Mettere la chiave su GitHub come segreto

GitHub non può ricevere un file binario come segreto: va trasformato in testo. **Una riga:**

```bash
powershell -Command "[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\Users\pietro\fbl-rilascio.jks')) | Set-Clipboard"
```

Il testo è ora negli appunti (non comparirà a schermo: è giusto così).

Poi su **github.com** → il repo **Forex-Backtest.LAB** → **Settings** → nel menù a sinistra
**Secrets and variables** → **Actions** → pulsante **New repository secret**.

Ne servono **quattro**, uno alla volta:

| Nome (copialo esatto) | Valore |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | incolla (Ctrl+V) il testo degli appunti |
| `ANDROID_KEYSTORE_PASSWORD` | la password scelta al passo 2 |
| `ANDROID_KEY_ALIAS` | `fbl` |
| `ANDROID_KEY_PASSWORD` | la stessa password (se al passo 2 hai premuto Invio) |

> I segreti si scrivono e non si rileggono più: GitHub li mostra solo come `***`, anche nei
> registri delle compilazioni. **Io non li vedo e non li tocco** — li inserisci solo tu.

---

# PASSO 4 🤖 — La firma dentro Gradle, e il numero di versione

Due cose, tutte e due mie:

**a)** `android/app/build.gradle` impara a firmare col keystore passato da GitHub, e a usare la
build di **rilascio** invece di quella di debug.

**b)** Il `versionCode` smette di essere `1` per sempre. Android decide se un APK è più nuovo
**da quel numero**, non dal nome: con `1` fisso, prima o poi un telefono rifiuta l'aggiornamento
dicendo soltanto «app non installata». Si ricava dalla versione del sito: `2.0.37` → `20037`.

---

# PASSO 5 🤖 — Il flusso che costruisce l'APK

Un flusso nuovo, `apk.yml`, che a ogni release:

1. prende i file del sito dal repo e li copia in `www` (lo stesso che fa `aggiorna_www.bat`)
2. **inietta la versione** in `app.html` con `strumenti/inietta_versione.py` — lo stesso script
   che usi già, con UTF-8 esplicito: senza, le emoji diventano `ðŸ...` e tutte le icone
   dell'app si rompono (è già successo nella 2.0.27)
3. `npm ci` e `npx cap sync android`
4. ricostruisce la chiave dal segreto e compila `assembleRelease`
5. allega `forexbacktestlab.apk` **a quella release**

Così «ogni release ha il suo APK» smette di essere una cosa da ricordarsi.

---

# PASSO 6 👤 — La prima volta, sul telefono *(solo strada A)*

La prima build firmata con la chiave nuova **non può aggiornare** quella vecchia: chiavi diverse.
Una volta sola:

1. **Disinstalla** Forex Backtest LAB dal telefono
2. Scarica il nuovo APK dalla pagina di installazione
3. Installalo, accedi col tuo account Google

Conto, posizioni e Trade Journal tornano da soli: stanno sul cloud, non sul telefono.

**Da quel momento in poi ogni aggiornamento è automatico**, e questa guida non serve più.

---

## COSA CAMBIA NELLA CATENA DI PUBBLICAZIONE

In `.claude/skills/pubblica/SKILL.md` il passo 6 diventa: l'APK **non va più costruito a mano**.
Si controlla soltanto che sia arrivato:

```bash
gh release view v2.0.XX --json assets --jq '.assets[].name'
```

Devono comparire tutti e tre: `forexbacktestlab.apk`, `ForexBacktestLAB_Setup.exe`,
`installer_build.zip`.

## COSA NON FARE

- ❌ Mettere `fbl-rilascio.jks` nel repo (è la chiave: nel repo è pubblica per sempre)
- ❌ Perdere la password del keystore: senza, i telefoni già installati non si aggiornano mai più
- ❌ Mettere `www` o `node_modules` nel repo
- ❌ Lanciare il flusso a mano subito dopo un push: parte già da solo, e due build in corsa si
  pestano i piedi sulla stessa release (successo il 28 ottobre 2026)
