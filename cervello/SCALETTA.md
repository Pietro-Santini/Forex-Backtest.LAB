# Scaletta - cosa manca da fare

Aggiornata il **21 ottobre 2026**, dopo la v2.0.15.

**COME SI LEGGE.** Un punto e' FATTO solo quando esiste un test che prima falliva e ora passa, e
il collaudo completo e' verde. Prima di toccare qualcosa: `cervello/PASSAGGIO-OPENCODE.md` e
`cervello/LEZIONI.md`.

**COME SI COMMITTA** (deciso dal proprietario il 21 ottobre): a capitolo chiuso, non a ogni
modifica - «altrimenti troppi commit e aggiornamenti facciamo».

**UNA VERIFICA CHE VIENE PRIMA DI TUTTE.** Se il proprietario segnala un difetto che risulta gia'
corretto, prima di rimetterci le mani si controlla QUALE VERSIONE sta usando:

```
git show v2.0.12:app.html | grep "la correzione"
```

Il 21 ottobre e' successo tre volte di fila (conferma unica delle chiusure, riquadro di
caricamento, break-even negativo): erano tutte gia' pubblicate, e lui descriveva fedelmente la
v2.0.12 che aveva in mano. La causa vera era il canale di aggiornamento rotto - vedi v2.0.15.

---

## 1. Da fare - difetti con la causa gia' trovata

### 1.1 Trade Journal che sparisce dopo aggiornamenti e reinstallazioni
Segnalato: «non rimane salvato in memoria nel trade journal e sparisce alla prossima installazione
del programma o aggiornamento». CAUSA TROVATA: le operazioni vivono in localStorage+IndexedDB
(separati per indirizzo d'ingresso: sito, 127.0.0.1 del ponte, localhost dell'APK), e la copia sul
cloud si scrive SOLO su `pagehide` - cioe' nell'istante in cui la pagina viene distrutta, quando
una scrittura su Firestore puo' non arrivare mai. All'avvio il cloud viene letto solo se in locale
non c'e' niente. CURA: scrivere il journal sul cloud QUANDO CAMBIA (un'operazione che si chiude e'
un evento raro), piu' la scrittura all'uscita forzata.

### 1.2 Cambio asset: si vede ancora l'asset precedente
Segnalato: «viene visualizzato ancora il grafico precedente, le posizioni, il prezzo dell'asset
precedente, mentre ha caricato l'asset selezionato». Da verificare dopo la v2.0.15: il riquadro di
caricamento fino a sincronizzazione completa (anche in PIP) e' della v2.0.13, che il proprietario
non aveva.

### 1.3 Margine utilizzato sempre a 0
FATTO (v2.0.16, solo MT5: su Kraken funzionava gia', confermato dal proprietario).

### 1.4 ~~Robot di Syntra fermo~~ FATTO
I comandi finivano al server, dove BlueStacks non esiste. Vedi il diario del 21 ottobre notte:
tre correzioni sbagliate fermate da tre test diversi prima di quella giusta.

### 1.5 ~~Linea di entrata infinita a grafico~~ FATTO
Finiva al bordo della vista invece che allo stop preso o all'ultimo TP colpito.

### 1.6 ~~Percentuale di caricamento ferma a 0%~~ FATTO
Era aritmetica: tre passi, passo/3, e il primo passo e' lo zero.

### 1.7 Popup che sforano con lo zoom: MISURATO, NON C'E' PIU'
Misurati 24 riquadri, poi tutti i 27 elementi a sovrapposizione, dal 70% al 250%, su due
schermi, e con dentro un figlio da 2400x4000 px: nessuno sfora. La segnalazione descrive la
v2.0.12. Se ricompare SULLA 2.0.15 o superiore, e' un riquadro fuori da quell'elenco: chiedere
quale.
Nelle tabelle posizioni aperte, Kraken e MT5: va calcolato il margine vero di ogni singola
posizione.

---

## 2. Da fare - difetti da misurare

### 2.1 Degrado delle prestazioni nel tempo
«Appena installato era fluidissimo, zero freeze, tre schede aperte senza problemi. Dopo un po'
incominciava a calare». INDIZIO CHE VALE PIU' DI OGNI ALTRO: una cosa che parte veloce e peggiora
NON e' un costo fisso - e' una PERDITA che si accumula (timer, ascoltatori, dati in memoria che
crescono). Si trova misurando la stessa cosa due volte a distanza di tempo, non leggendo il codice.
La v2.0.13 ha gia' tolto 66 risvegli al secondo su 77,6; questo e' un altro difetto.

### 2.2 Fluidita' del replay
«Carica bene la candela, poi si blocca, salta a due successive, riprende, si ferma, salta a tre»,
e peggiora salendo col moltiplicatore. Il proprietario sospetta un blocco a monte quando arrivano
dati dal server.

### 2.3 I pacchetti di installazione si accumulano
Trenta o quaranta file nella cartella Download invece di uno sostituito. NOTA: il nome del file lo
decide l'app, ma a scaricarlo e' il browser di sistema, che aggiunge (1), (2), (3)... Una pagina
web non puo' sostituire un file nella cartella Download. La scelta (nome con la versione dentro,
oppure altra strada) e' da fare col proprietario.

---

## 3. Da fare - funzioni nuove

### 3.1 Apertura immediata al prezzo corrente (soldi veri)
Quando arriva un segnale su un asset diverso da quello a grafico, la posizione deve aprirsi SUBITO
al prezzo corrente di quell'asset, senza aspettare il caricamento del grafico: «sono quei secondi,
magari un minuto, che ci fanno perdere l'apertura precisa». Vale per cripto, forex, indici, azioni.
TERRENO GIA' PRONTO: `placeRealMt5Order` accetta un asset non a grafico con il prezzo indicativo
(`forz.sym`/`forz.prezzo`), e c'e' un commit «ordini MT5 senza cambiare grafico». Da verificare se
il flusso dei segnali aspetta comunque il caricamento.

### 3.1-bis ~~Stop e target automatici per sala~~ FATTO (v2.0.16)
ATTENZIONE per chi legge: il CALCOLO c'era gia' (stop da una perdita massima in euro, target a
una percentuale della distanza dello stop). Mancava DOVE si sceglie - era per famiglia di
strumento, non per sala - e il target in PIP. Verificare sempre prima di riscrivere.

### 3.2 Livelli comuni del segnale: rischio o capitale
Nel pulsante «apri N posizioni», accanto al rischio totale, la stessa scelta che c'e' nelle
strategie: rischio basato sullo stop loss, oppure quanto capitale investire. Cambia molto per le
cripto.

### 3.3 Strisce di vicinanza nella lista posizioni
A destra di ogni riga (Kraken e MT5), una striscia verticale quando la posizione e' al 10% dal
livello: verde TP, rossa SL, azzurra stop profit. TP e SL si misurano dall'ENTRATA; lo stop profit
dall'ULTIMO TP RAGGIUNTO. Percentuale modificabile e spegnibile in Style, in una nuova sezione
«Posizioni». Default acceso. Come l'app MT5 per telefono, che la mette a sinistra: qui a destra.

### 3.4 Il margine dello spread solo intorno alla chiusura del mercato
Il pareggio resta ZERO (vedi la v2.0.13 e la lezione sul pareggio), ma nella fase di chiusura e
riapertura del mercato si puo' adottare il margine dello spread, tornando al pareggio esatto quando
il mercato si e' stabilizzato. Con un interruttore nelle impostazioni.

### 3.5 Replay: le cose chieste il 21 ottobre
- le posizioni aperte in replay devono mostrare l'andamento del P/L come dal vivo (c'era, e' stato
  tolto);
- premendo di nuovo replay si deve poter scegliere un'altra data senza uscire dalla modalita'
  (un pulsante «nuova posizione»);
- fermando l'avanzamento a meta' candela si resta a meta' candela, non si torna al suo inizio;
- cambiando asset si esce automaticamente dal replay e si carica l'ultimo prezzo.

### 3.6 Sezione «Sale segnali» separata da «Collegamento»
Cronologia, configurazione dell'apertura automatica e tutto quello che riguarda le sale va spostato
dalla scheda Collegamento a una sezione sua, come era prima.

### 3.7 Le altre, dalla scaletta originaria
- barra TP/SL legata alla posizione scelta;
- ordini pendenti trascinabili sul grafico;
- ordini pendenti nelle strategie di sala e universale, con i due freni;
- aggiornamento Windows classico;
- dashboard multi-conto con selezione;
- cancellazione conto che pulisce tutto;
- «Chiudi» nel grafico con chiusura parziale;
- doppioni di id nel markup: `tgApiId` e `tgApiHash` compaiono due volte.

---

## 4. Fatto, in ordine di pubblicazione

**v2.0.15** - l'app si aggiorna da sola anche aperta dall'icona (era il ponte a servirla congelata
dentro l'eseguibile: e' il difetto che teneva nascosto tutto il lavoro fatto); il grafico non salta
piu' al cambio timeframe (una moltiplicazione senza tetto: 300.000 candele e il bordo a marzo);
una regola sola per tre difetti di clic (deselezione che non avveniva dentro la casella Target/Stop
e sopra gli indicatori, enfasi che si accendeva da sola, cambio stile del footprint che moriva in
silenzio su mezzo grafico).

**v2.0.14** - il telefono (popup mai fuori dallo schermo: era la scala al 130%; schede delle
impostazioni raggiungibili; barra operazioni al bordo alto; linea apertura-chiusura con lo zoom
largo; cartellini TP/SL via dalla scala prezzi); la cartella delle credenziali (non erano sparite:
si perdeva il PERMESSO di leggerle); MT5 che non si stacca piu' agli aggiornamenti (spegnimento
con grazia).

**v2.0.13** - il pareggio e' zero; operazioni a blocco e una conferma sola; il conto segue l'asset;
Syntra; caricamento del grafico al cambio asset; footprint in replay; 66 risvegli al secondo tolti.

**v2.0.12** - avviso prima della chiusura, forbice del rollover misurata, vendite che si chiudono
sull'ask, chiusura automatica delle posizioni in guadagno.

---

## 5. Rinviate dal proprietario - non farle se non le richiede

(invariate rispetto alla scaletta precedente)

---

## 6. Promemoria che valgono per ogni punto

- **Si misura prima di correggere.** Il 21 ottobre ha evitato due correzioni inutili (i processi
  «doppi» che non erano doppioni) e ha trovato due cause esatte (il salto del timeframe, i popup
  fuori dallo schermo al 130%).
- **Una correzione si dichiara fatta solo con un test che prima falliva.** Si verifica mettendo da
  parte il file corretto e rimettendo quello di prima: il test DEVE diventare rosso.
- **Quando si tocca `bridge.py` o un file sotto `installer_build/build/`, serve il Setup nuovo** -
  e va detto. Vedi `cervello/PUBBLICARE.md`.
