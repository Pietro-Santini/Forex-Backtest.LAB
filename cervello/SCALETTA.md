# Scaletta — cosa manca da fare

Aggiornata il 16 ottobre 2026. Ordine proposto: prima quello che fa vedere **numeri sbagliati** o
che è **rotto**, poi le funzionalità, poi il resto.

Prima di toccare qualcosa: `cervello/PASSAGGIO-OPENCODE.md` (dove sta il progetto, come si lavora)
e `cervello/LEZIONI.md` (gli errori già pagati).

---

## 0. Da chiudere subito — v166 non pubblicata

Ramo **`v166-sale-per-famiglia`**, modifiche non committate, collaudo locale in corso.

Contiene: sale divise fra forex e cripto (popup a selezione multipla + apprendimento dai segnali) e
l'orario di esecuzione nelle quattro tabelle.

Da fare, in quest'ordine (le prime tre voci sono cambiate dopo la revisione: il collaudo di GitHub
gira su **ogni push**, non solo su `main`, quindi il verde si prende SUL RAMO - prima di toccare
`main`):

1. collaudo **locale** verde (su Windows `bash` non è nel PATH: usa Git bash);
2. `git add -A` e commit in italiano;
3. `git push origin v166-sale-per-famiglia`;
4. aspettare il verde su GitHub (`gh run list --limit 3`) — e se è rosso, scaricare l'artefatto,
   perché il log è troncato: `gh run download <ID>`;
5. SOLO ORA `git checkout main && git merge --no-ff v166-sale-per-famiglia && git push origin main`;
6. ricopiare `app.html` nello specchio sul Desktop e committare lì;
7. controllare di nuovo il collaudo su `main`.

---

## 1. Difetti segnalati, ancora aperti

### 1.1 Syntra: la cronologia si ferma alla prima operazione ⭐ priorità

**Sintomo riferito dal proprietario:** «il robot si comporta bene fino a quando entra dentro al
profilo dell'utente, espande la prima operazione e poi si ferma, non fa più nulla».

**Cosa deve fare invece:** scorrere giù, espandere la seconda operazione, leggere i valori, passare
alla successiva, controllando **sempre la data**, e ripetere fino al **periodo scelto** — un mese =
fino al 16 settembre se oggi è il 16 ottobre; due mesi = fino ad agosto; e così via.

**E il ritorno alle notifiche:** finita la cronologia, per tornare a cercare nuovi ordini deve
**ripremere il pulsante «setup» in basso a sinistra**, accanto a «classifica». È da lì che si
arriva al pulsante «notifiche» in alto a destra. Passare solo dalla classifica **non basta**.

- Dove: `installer_build/build/segnali_telegram/syntra_lettore.py`, funzione `leggi_profilo`.
- Test esistenti: `laboratorio/ponte/test_profilo_espansione.py` (13 prove, incluse quelle che
  dimostrano che le notifiche non vengono toccate durante la lettura dello storico).
- ⚠️ **Richiede di ricostruire e reinstallare il ponte** per avere effetto: va detto al
  proprietario e va mandato lo zip.

### 1.2 Footprint in replay

Mai affrontato. La costruzione del footprint durante il replay non è stata verificata né corretta.
Il proprietario l'ha elencato fra i «due pezzi grossi» insieme al comportamento a mercato chiuso
(quest'ultimo chiuso in v157).

### 1.3 Footprint e heatmap della watchlist sui dispositivi mobili

**Sintomo:** sul computer i dati degli asset in watchlist ci sono, su telefono e tablet no.

È **architetturale**, non un difetto puntuale: quei dati vivono per dispositivo (IndexedDB,
`footprintArchivio`). Serve decidere **cosa** si condivide e **quanto**, perché sono molti dati.
Vale la lezione già scritta: *se una cosa si vede solo sul dispositivo che l'ha creata, il dato è
nel posto sbagliato* — ma qui la soluzione non può essere copiare tutto.

---

## 2. Funzionalità richieste, non ancora toccate

### 2.1 Caricamento asset con percentuale, e popup nella finestra PIP

Al cambio di asset deve comparire l'indicatore di caricamento **con la percentuale**. E se il
grafico è staccato nella finestra separata (PIP), il popup deve comparire **lì**, non sulla pagina
principale che l'utente non ha sott'occhio.

- Esiste già il criterio nel codice: `popupTargetDoc()` / `moveModalToFloatingIfActive`.

### 2.2 Cambio conto automatico per tipo di asset

Passando a una cripto → conto **Kraken**; passando a un forex → conto **MT5**.

- Esiste già `fblVaiAlContoDi(x)` / `fblContoDiOperazione(x)`, usate per il salto a grafico da una
  posizione: vanno estese al **cambio asset**.
- Esiste già `fblTipoAsset(asset)` che riconosce le cinque famiglie.

### 2.3 Multi-selezione dei conti nella dashboard statistiche

Poter scegliere **quali conti** vedere, con selezione multipla. (I conti chiusi sono già raggruppati
a parte dalla v… precedente.)

### 2.4 Cancellazione di un conto che purga tutto

Eliminando un conto **non deve più esistere niente** di suo nell'applicazione. Con avviso esplicito
prima: *«attenzione, se elimini il conto eliminerai anche le sue statistiche»*.

### 2.5 Pulsante «Chiudi» a grafico, con chiusura parziale

Premendo su un'operazione a grafico deve comparire anche il pulsante **Chiudi**, che apre un popup:
chiusura **a mercato** oppure **parziale**, con la percentuale scelta dall'utente.

---

## 3. Rinviate dal proprietario — non farle se non le richiede

### 3.1 Integrazione Discord
Notifica sul gruppo a ogni modifica implementata, con la richiesta che l'ha originata; e un canale
«idee» con sondaggio prestabilito che, se la maggioranza approva, fa partire in automatico la
richiesta di procedere.

> Parole sue: «questa sarà una modifica che faremo più avanti, non adesso, quindi non inserirla
> adesso».

### 3.2 App scaricabile e installabile, sganciata da Chrome
Con sezione download su GitHub. *(Nota: un installer Windows esiste già in `installer_build/`; qui
si parla di rendere l'app un programma vero, non una pagina agganciata al browser.)*

---

## 4. In sospeso: serve una parola del proprietario

### 4.1 «Togliamo il più in là»
Nella v161 l'etichetta *«e target un ulteriore X % più in là»* è stata **riscritta** in *«e target a
X % oltre il pareggio»*, ma **il campo è rimasto**. Se intendeva eliminare l'impostazione e non
solo la formula oscura, va tolta (e con lei `tgTpExtraPct` e i punti che la leggono).

### 4.2 Orario delle posizioni Kraken già aperte
L'anagrafica (v163) si riempie **da quando esiste**: una posizione aperta prima, di cui il ponte non
manda più `aperta_ms`, non recupera l'orario — quel dato non ce l'ha più nessuno. Era stata proposta
una **correzione manuale per singola posizione**: va fatta solo se la vuole.

---

## 5. Promemoria che valgono per ogni punto

- **Si misura prima di correggere.** Quasi ogni voce del diario racconta una causa trovata
  misurando, non indovinando.
- **Ogni correzione ha un test**, e il test guarda il **comportamento**, non una stringa nel
  sorgente.
- **Conta il collaudo di GitHub**, non quello locale.
- Modifiche fuori da `app.html` (ponte, installer) → **ricostruire il Setup** e avvisare.
- Italiano ovunque; niente identificativi di modello; nessuna chiave API nel repo; soldi veri mai.
